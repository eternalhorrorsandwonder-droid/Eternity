/**
 * Game state machine.
 *
 * One class owns the loop, the screen state and the save files. The scene
 * does the drawing; the UI modules do the DOM; this file decides which of the
 * two is in front of the player and wires the keyboard, mouse and touch
 * controls to the right action.
 *
 * The state model is a stack rather than a switch: playing can be paused by
 * the pause menu, the inventory, the boards, the settings and the death
 * screen, each of which adds a layer and removes it in order. That is what
 * makes "pause, open the map, close the map, still paused" work without
 * special cases.
 */

import { World } from '../engine/render/World';
import { AudioEngine } from '../engine/audio/AudioEngine';
import { MusicEngine } from '../engine/audio/MusicEngine';
import type { MusicTrack } from '../engine/audio/MusicEngine';
import { Input } from '../engine/core/Input';
import { SaveManager, SAVE_SLOTS, type SaveMeta } from '../engine/save/SaveManager';
import { GameScene, type GameMessage, type GameSceneCallbacks, type HudSnapshot } from './scenes/GameScene';
import { Player, type PlayerState } from './entities/Player';
import { INVENTORY_SIZE } from './entities/Player';
import { AppUi } from './ui/AppUi';
import { controls, type RemapResult, type InputAction, type ControlBindings as ControlBindingsLike } from './config/Controls';
import { balance, BALANCE_DEFS, DEFAULT_BALANCE, type BalanceKey } from './config/Balance';
import { ProgressTracker } from './systems/Progress';
import { ENCHANT_BY_ID } from './systems/Forge';
import type { BindingMap } from '../engine/core/Input';

/** Display name for an enchantment, without pulling the UI layer in. */
function ITEMS_NAME_FOR(id: string): string {
  return ENCHANT_BY_ID.get(id)?.name || id;
}

/** Which layer is currently covering the game. */
export type Overlay =
  | 'none' | 'pause' | 'death' | 'inventory' | 'skills' | 'attributes'
  | 'boards' | 'map' | 'settings' | 'save' | 'codex' | 'dialogue'
  | 'furnace' | 'enchant';

export interface GameOptions {
  container: HTMLElement;
  onReady?(): void;
}

const WORLD_SEED = 20260101;

export class Game {
  readonly container: HTMLElement;
  readonly audio = new AudioEngine();
  readonly music = new MusicEngine(this.audio);
  readonly input = new Input();
  readonly saves = new SaveManager();
  private ui: AppUi;
  private world: World | null = null;
  private scene: GameScene | null = null;
  private overlays: Overlay[] = ['none'];
  private raf = 0;
  private lastNow = 0;
  private saveTimer = 0;
  private currentSlot = -1;
  private hud: HudSnapshot | null = null;
  private messages: GameMessage[] = [];
  private messagesDirty = false;
  private busy = false;
  private fullscreen = false;

  /**
   * World memory: which regions and chunks the player has seen, which
   * structures they have found, which bosses they have beaten. Bounded by
   * construction in `ProgressTracker`; this is the only copy and it travels
   * inside the encrypted save.
   */
  readonly progress = new ProgressTracker();
  private progressTimer = 0;
  /** Remaps and tuning remembered from a previous session on this device. */
  private profileKey = 'eternity.profile.v1';

  constructor(options: GameOptions) {
    this.container = options.container;
    this.ui = new AppUi(this, options.container);
    options.onReady?.();
  }

  // ---------------------------------------------------------------- boot

  async boot(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    await this.saves.init();
    // The world is generated once per session; it is deterministic, so a
    // returning player lands in the same place they left.
    this.world = new World(WORLD_SEED);
    this.world.generate();
    this.ui.setWorldInfo(this.world);
    this.ui.setStatus(`${this.world.statistics().columns} columns · ${this.world.statistics().tiles.toLocaleString()} voxels`);
    // Apply the remembered control scheme and tuning before the title screen,
    // so a reloaded page behaves like the page the player left.
    controls.applyTo(this.input);
    this.loadProfile();
    this.busy = false;
    this.ui.showTitle(await this.saves.list());
  }

  // ---------------------------------------------------------------- loop

  /** Start the render loop. Safe to call once per scene. */
  private loop = (now: number): void => {
    this.raf = requestAnimationFrame(this.loop);
    if (!this.scene) return;
    if (this.lastNow === 0) this.lastNow = now;
    let dt = (now - this.lastNow) / 1000;
    this.lastNow = now;
    if (dt > 0.1) dt = 0.1; // clamp tab-switch spikes
    if (dt < 0) dt = 0;

    const paused = this.overlays.length > 1;
    if (!paused) {
      this.tickInput();
      this.scene.frame(dt);
    } else {
      // Still render the world behind an overlay so it never freezes visually.
      this.scene.renderOnly(dt);
    }
    this.scene.adaptQuality(dt * 1000);
    // Autosave cadence is tunable: a cautious player can write every fifteen
    // seconds, a performance player once every five minutes.
    if (this.saveTimer > 0) {
      this.saveTimer -= dt;
      if (this.saveTimer <= 0) {
        this.saveTimer = Math.max(15, balance.get('autosaveInterval'));
        this.autosave();
      }
    }
  };

  // ---------------------------------------------------------------- scenes

  /** Create a run: either a fresh character or a restored save. */
  startRun(state: PlayerState, options: { dungeon?: string | null; arena?: string | null } = {}): void {
    if (this.scene) {
      this.scene.dispose();
      this.scene = null;
    }
    const callbacks: GameSceneCallbacks = {
      onHud: (h) => { this.hud = h; this.ui.updateHud(h, this.messages); },
      onMessage: (m) => { this.messages.push(m); this.messagesDirty = true; },
      onDeath: (cause) => this.die(cause),
      onMusic: (id) => this.ui.setMusic(id),
      onSave: () => this.autosave(),
      onLoad: () => this.ui.toast('Use the Save screen to load a slot'),
      onPauseChange: (p) => { if (p) this.pushOverlay('pause'); else this.popOverlay(); },
      onInteract: (p) => this.ui.setInteract(p),
      onFurnace: () => this.pushOverlay('furnace'),
      onEnchant: () => this.pushOverlay('enchant'),
    };
    this.scene = new GameScene(this.world!, state, this.audio, this.music, this.input, callbacks, { ...options, progress: this.progress });
    this.scene.attach(this.container);
    this.input.attach(this.scene.canvas);
    this.input.recomputeAxes();
    this.overlays = ['none'];
    this.ui.setPlaying(true);
    this.ui.setStatus('');
    this.lastNow = 0;
    if (!this.raf) this.raf = requestAnimationFrame(this.loop);
    this.saveTimer = 45;
    this.ui.toast(`Welcome, ${state.name}`, 0x5ae070);
    this.requestHud();
  }

  /** Start a brand new character. */
  newRun(name: string): void {
    const sp = this.world!.spawnPosition();
    const state = Player.create(name, [sp.x, sp.y, sp.z], WORLD_SEED);
    this.currentSlot = -1;
    this.progress.reset();
    this.startRun(state);
  }

  /** Continue the most recently played slot. */
  async continueRun(): Promise<void> {
    const metas = await this.saves.list();
    const latest = metas.filter((m) => m).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))[0];
    if (!latest) {
      this.ui.toast('No save files yet', 0xe05050);
      return;
    }
    const loaded = await this.saves.load(latest.index);
    this.loadBody(loaded.body);
  }

  private loadBody(body: any): void {
    if (!body || !body.player) {
      this.ui.toast('That save is corrupted', 0xe05050);
      return;
    }
    this.currentSlot = body.slot ?? -1;
    const sp = this.world!.spawnPosition();
    const state: PlayerState = { ...body.player, position: body.player.position || [sp.x, sp.y, sp.z] };
    // The world memory travels with the character: a save is not just the
    // player's inventory, it is everything the world has recorded about them.
    if (body.progress) this.progress.fromJSON(body.progress);
    if (body.controls) {
      controls.fromJSON(body.controls);
      controls.applyTo(this.input);
    }
    if (body.balance) balance.fromJSON(body.balance);
    this.startRun(state);
  }

  async loadSlot(slot: number): Promise<void> {
    try {
      const loaded = await this.saves.load(slot);
      this.loadBody({ ...loaded.body, slot });
    } catch (err) {
      this.ui.toast(`Could not read slot ${slot + 1}: ${(err as Error).message}`, 0xe05050);
    }
  }

  /** Persist the current run to a slot. */
  async saveSlot(slot: number): Promise<boolean> {
    if (!this.scene) return false;
    try {
      const body = {
        version: 5,
        slot,
        player: this.scene.playerState,
        world: { name: 'Eternity', seed: WORLD_SEED },
        progress: this.progress.toJSON(),
        controls: controls.toJSON(),
        balance: balance.toJSON(),
      };
      await this.saves.save(slot, this.playerState?.name || 'Eternity', body, { name: 'Eternity', seed: WORLD_SEED });
      this.currentSlot = slot;
      this.ui.toast(`Saved to slot ${slot + 1}`, 0x5ae070);
      this.audio.play('save', 0.9);
      return true;
    } catch (err) {
      this.ui.toast(`Save failed: ${(err as Error).message}`, 0xe05050);
      return false;
    }
  }

  autosave(): void {
    if (!this.scene || this.currentSlot < 0) return;
    void this.saveSlot(this.currentSlot);
  }

  // ---------------------------------------------------------------- overlays

  pushOverlay(o: Overlay): void {
    if (this.overlays[this.overlays.length - 1] === o) return;
    this.overlays.push(o);
    this.ui.showOverlay(o);
    if (o !== 'none') this.audio.play('ui_open', 0.6);
  }

  popOverlay(): void {
    if (this.overlays.length <= 1) return;
    const removed = this.overlays.pop() as Overlay;
    this.ui.hideOverlay(removed);
    this.audio.play('ui_back', 0.6);
    if (this.overlays.length === 1) this.ui.setPlaying(true);
  }

  /** Whether a given overlay is the top of the stack. */
  isTop(o: Overlay): boolean {
    return this.overlays[this.overlays.length - 1] === o;
  }

  /** The overlay on top of the stack. */
  topOverlay(): Overlay {
    return this.overlays[this.overlays.length - 1];
  }

  /** How many layers are on the stack (1 means nothing is covering the game). */
  get overlayCount(): number {
    return this.overlays.length;
  }

  toggle(o: Overlay): void {
    if (this.isTop(o)) this.popOverlay();
    else this.pushOverlay(o);
  }

  die(cause: string): void {
    if (this.isTop('death')) return;
    this.pushOverlay('death');
    this.ui.setDeath(cause, this.scene?.playerState);
  }

  respawn(): void {
    this.scene?.respawn();
    this.popOverlay();
    this.saveTimer = 20;
  }

  quitToTitle(): void {
    if (this.scene) {
      this.scene.dispose();
      this.scene = null;
    }
    this.overlays = ['none'];
    this.ui.setPlaying(false);
    this.ui.hideAllOverlays();
    this.ui.showTitle(this.saves.list().catch(() => [] as SaveMeta[]));
  }

  // ---------------------------------------------------------------- input

  /** Handle one frame of non-game keys and overlay navigation. */
  handleInput(): void {
    const i = this.input;
    i.recomputeAxes();
    if (i.keyPressed('escape')) {
      if (this.overlays.length > 1) {
        if (this.isTop('pause')) this.popOverlay();
        else if (this.isTop('dialogue')) this.popOverlay();
        else this.popOverlay();
      } else {
        this.pushOverlay('pause');
      }
      return;
    }
    if (this.overlays.length > 1) return;
    if (i.keyPressed('f5')) {
      void this.saveSlot(this.currentSlot >= 0 ? this.currentSlot : 0);
      return;
    }
    if (i.keyPressed('i')) this.pushOverlay('inventory');
    else if (i.keyPressed('k')) this.pushOverlay('attributes');
    else if (i.keyPressed('u')) this.pushOverlay('skills');
    else if (i.keyPressed('b')) this.pushOverlay('boards');
    else if (i.keyPressed('m')) this.pushOverlay('map');
    else if (i.keyPressed('c')) this.pushOverlay('codex');
    else if (i.keyPressed('o')) this.pushOverlay('settings');
    else if (i.keyPressed('s')) this.pushOverlay('save');
    if (i.keyPressed('enter')) this.pushOverlay('save');
  }

  /** Called from the RAF loop before the scene updates. */
  private tickInput(): void {
    this.handleInput();
    if (this.messagesDirty) {
      this.messagesDirty = false;
      this.messages = this.scene ? this.scene.activeMessages : this.messages;
    }
  }

  // ---------------------------------------------------------------- accessors

  get snapshot(): HudSnapshot | null { return this.hud; }
  get messageLog(): GameMessage[] { return this.messages; }
  get scene_(): GameScene | null { return this.scene; }
  get isPaused(): boolean { return this.overlays.length > 1; }
  get slotCount(): number { return SAVE_SLOTS; }

  /** Toggle the browser fullscreen and report the new state. */
  async toggleFullscreen(): Promise<void> {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
        this.fullscreen = true;
      } else {
        await document.exitFullscreen();
        this.fullscreen = false;
      }
    } catch {
      this.fullscreen = document.fullscreenElement !== null;
    }
    this.ui.setFullscreen(this.fullscreen);
    if (this.fullscreen) {
      this.ui.toast('Fullscreen', 0x5ae070);
      this.audio.play('ui_click', 0.6);
    }
  }

  /** True when the browser is in fullscreen, updated on the change event. */
  get isFullscreen(): boolean { return this.fullscreen; }

  setFullscreenState(v: boolean): void {
    this.fullscreen = v;
    this.ui.setFullscreen(v);
  }

  /** Resize the renderer to the container. */
  resize(): void {
    if (this.scene) this.scene.resize(this.container.clientWidth || 1280, this.container.clientHeight || 720);
  }

  /** Apply a setting change that affects the scene. */
  applySettings(settings: {
    renderDistance: number; volume: number; music: number; sfx: number;
    shadows: boolean; fog: boolean;
    touchScale?: number; touchLook?: boolean; touchAutoHide?: boolean;
    discoveryOn?: boolean; discoveryStructures?: boolean; discoveryEvents?: boolean;
  }): void {
    if (this.scene) {
      this.scene.setRenderDistance(settings.renderDistance);
      this.scene.setFog(settings.fog);
      // The world memory is the expensive part of persistence, so a player who
      // is chasing frames can turn it off entirely rather than lower a quality
      // setting and still pay for it.
      if (typeof settings.discoveryOn === 'boolean') this.scene.setDiscoveryEnabled(settings.discoveryOn);
    }
    this.audio.setMasterVolume(settings.volume);
    this.audio.setMusicVolume(settings.music);
    this.audio.setSfxVolume(settings.sfx);
  }

  // ------------------------------------------------------- controls & tuning

  /**
   * Rebind a logical action to a physical key.
   *
   * The engine is the only thing that reads keys, so this is a single call:
   * the scheme is updated, pushed into the input layer immediately (the
   * remap takes effect on the next frame, not the next save) and written to
   * localStorage so it survives a reload.
   */
  remapKey(action: InputAction, key: string, swap = false): RemapResult {
    const result = controls.remap(action, key, { swap });
    if (result.ok) {
      controls.applyTo(this.input);
      this.input.recomputeAxes();
      this.persistProfile();
    }
    return result;
  }

  /** Wipe the control scheme back to the shipped defaults. */
  resetControls(): void {
    controls.reset();
    controls.applyTo(this.input);
    this.input.recomputeAxes();
    this.persistProfile();
  }

  /** Reset every resource and progression knob to its shipped value. */
  resetBalance(): void {
    balance.reset();
    this.persistProfile();
  }

  // ---------------------------------------------------------------- forge

  /**
   * Bookshelves within reach of a position.
   *
   * Counted by reading the tiles rather than by scanning entities, because a
   * bookcase is a block and the world is already indexed by block. Capped so a
   * room lined with shelves cannot produce an unbounded enchantment level.
   */
  bookCountAt(x: number, y: number, z: number): number {
    if (!this.world) return 0;
    let n = 0;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dz = -3; dz <= 3; dz++) {
        for (let dy = -2; dy <= 2; dy++) {
          if (this.world.get(Math.floor(x + dx), Math.floor(y + dy), Math.floor(z + dz)) === 113) n++;
        }
      }
    }
    return Math.min(15, n);
  }

  /** Enchantment level a table at this position offers, before any cap. */
  enchantPowerAt(x: number, y: number, z: number): number {
    return this.bookCountAt(x, y, z);
  }

  /** Smelt one item from the inventory at a furnace. */
  smeltSlot(index: number): 'smelted' | 'no-fuel' | 'nothing' {
    const result = this.scene?.player.smelt(index) ?? 'nothing';
    if (result === 'smelted') {
      this.audio.play('ui_open', 0.7);
      this.scene?.pushMessage({ text: 'The furnace works.', color: 0xffa040, kind: 'info', life: 1.6 });
    } else if (result === 'no-fuel') {
      this.audio.play('ui_error', 0.8);
      this.scene?.pushMessage({ text: 'The furnace has no fuel.', color: 0xe05050, kind: 'system', life: 2.2 });
    }
    return result;
  }

  /** Enchant an item from the inventory at an enchanting table. */
  enchantSlot(index: number, enchantId: string, lapis = 1): string {
    const scene = this.scene;
    const player = scene?.player;
    if (!player) return 'nothing';
    const near = player.pos;
    const power = this.enchantPowerAt(near.x, near.y, near.z);
    const result = player.enchant(index, enchantId, power, lapis);
    if (result === 'enchanted') {
      this.audio.play('skill_cast', 0.9);
      scene.pushMessage({ text: `${ITEMS_NAME_FOR(enchantId)} applied`, color: 0xc080ff, kind: 'rare', life: 2.4 });
    } else if (result === 'no-xp') {
      this.audio.play('ui_error', 0.8);
      scene.pushMessage({ text: 'Not enough experience.', color: 0xe05050, kind: 'system', life: 2.2 });
    } else if (result === 'no-lapis') {
      this.audio.play('ui_error', 0.8);
      scene.pushMessage({ text: `Needs ${lapis} Lapis Lazuli.`, color: 0xe05050, kind: 'system', life: 2.2 });
    } else if (result === 'incompatible') {
      this.audio.play('ui_error', 0.8);
      scene.pushMessage({ text: 'That enchantment does not suit this item.', color: 0xe0a040, kind: 'system', life: 2.2 });
    }
    return result;
  }

  /** True when the player is standing somewhere a furnace will work. */
  get atFurnace(): boolean { return !!this.scene?.nearbyTile(108, 3); }

  /** True when the player is standing somewhere an enchanting table works. */
  get atEnchantingTable(): boolean { return !!this.scene?.nearbyTile(112, 3); }

  /** The live player object, or null before a run starts. */
  get player(): Player | null { return this.scene?.player ?? null; }

  /** The session's world memory, for the memory panel and the map. */
  get progressTracker(): ProgressTracker { return this.progress; }

  /** The live control scheme, for the keybind editor. */
  get controlScheme(): ReturnType<ControlBindingsLike['toJSON']> {
    return controls.toJSON();
  }

  /** True when any remap differs from the shipped defaults. */
  get controlsAreDefault(): boolean {
    return controls.isDefault();
  }

  /** Every resource and progression knob, in settings order. */
  get balanceDefs() {
    return BALANCE_DEFS;
  }

  /** The current value of a tuning knob. */
  balanceValue(key: BalanceKey): number {
    return balance.get(key);
  }

  /** Set a tuning knob and persist it. Returns the clamped value. */
  setBalance(key: BalanceKey, value: number): number {
    const next = balance.set(key, value);
    this.persistProfile();
    return next;
  }

  /** Human-readable form of a tuning value, for tooltips. */
  balanceLabel(key: BalanceKey): string {
    return balance.format(key);
  }

  /** True when any knob differs from its shipped value. */
  get balanceIsDefault(): boolean {
    return !balance.isTuned();
  }

  /** The shipped tuning, for the reset button. */
  get defaultBalance() {
    return DEFAULT_BALANCE;
  }

  // ---------------------------------------------------------------- profile

  /**
   * Remember the control scheme and tuning on this device.
   *
   * This runs independently of the encrypted saves: a player who changes
   * their keys should keep them after a reload even if they never save, and a
   * player who deletes every slot should not lose their scheme.
   */
  persistProfile(): void {
    try {
      localStorage.setItem(this.profileKey, JSON.stringify({
        v: 1,
        controls: controls.toJSON(),
        balance: balance.toJSON(),
      }));
    } catch { /* storage may be unavailable in private mode */ }
  }

  private loadProfile(): void {
    try {
      const raw = localStorage.getItem(this.profileKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      controls.fromJSON(parsed?.controls);
      controls.applyTo(this.input);
      balance.fromJSON(parsed?.balance);
    } catch { /* a corrupt profile must never block boot */ }
  }

  /** Play a music track through the running scene's music engine. */
  musicPlay(track: MusicTrack | null, fade = 1): void { this.scene?.musicEngine.play(track, fade); }

  /** Pause or resume the game loop from a screen button. */
  setPlaying(v: boolean): void { this.ui.setPlaying(v); }

  /** The renderer's canvas, for the UI to size against. */
  get canvas(): HTMLCanvasElement | null { return this.scene?.canvas ?? null; }

  /** Expose the world for the map screen. */
  get worldRef(): World | null { return this.world; }

  /** Current character state, for the UI boards. */
  get playerState(): PlayerState | null { return this.scene?.playerState ?? null; }

  /** Spend an attribute point through the UI. */
  spendAttribute(key: 'strength' | 'dexterity' | 'constitution' | 'intelligence' | 'wisdom'): boolean {
    if (!this.scene) return false;
    return this.scene.player.spendAttribute(key);
  }

  resetAttributes(): void { this.scene?.player.resetAttributes(); }

  spendSkill(id: string): boolean { return this.scene?.player.spendSkill(id) ?? false; }

  setActiveSkills(ids: string[]): boolean { return this.scene?.player.setActiveSkills(ids) ?? false; }

  equip(slot: number): boolean { return this.scene?.player.equip(slot) ?? false; }

  unequip(slot: 'weapon' | 'offhand' | 'helmet' | 'chest' | 'legs' | 'boots' | 'accessory'): boolean {
    return this.scene?.player.unequip(slot) ?? false;
  }

  craft(itemId: number): boolean { return this.scene?.craft(itemId) ?? false; }

  consume(slot: number): 'potion' | 'food' | null { return this.scene?.player.consume(slot) ?? null; }

  acceptQuest(id: string): boolean { return this.scene?.player.acceptQuest(id) ?? false; }

  claimQuest(id: string): { xp: number; coins: number; items: [number, number][]; title?: string } | null {
    return this.scene?.player.claimQuest(id) ?? null;
  }

  travelTo(regionId: number): void { this.scene?.travelTo(regionId); }

  enterDungeon(id: string): boolean { return this.scene?.enterDungeonById(id) ?? false; }

  leaveDungeon(): void { this.scene?.leaveDungeon(); }

  /** Toggle between a dungeon run and the open world. */
  setDungeon(id: string | null): void {
    if (!this.scene) return;
    if (id) this.scene.enterDungeonById(id);
    else this.scene.leaveDungeon();
  }

  setArena(id: string | null): void {
    // Arenas are a separate run: recreate the scene so the player starts
    // inside the flattened floor rather than walking to it.
    if (!this.scene || !this.world) return;
    if (id) this.startRun(this.scene.playerState, { arena: id });
    else this.startRun(this.scene.playerState);
  }

  /** Whether a skill can be trained one more level. */
  canTrainSkill(id: string): boolean { return this.scene?.player.canTrain(id) ?? false; }

  spendSkillReady(id: string): boolean { return this.scene?.player.canTrain(id) ?? false; }

  /** Remove every overlay at once. */
  hideAllOverlays(): void {
    // The UI can hide screens on its own, but the pause stack has to agree:
    // if only the DOM clears, the game would stay paused forever behind an
    // empty screen.
    this.overlays = ['none'];
    this.ui.hideAllOverlays();
  }

  /** Rebuild the overlay currently on top. */
  refreshOverlay(): void { this.ui.refreshOverlay(); }

  /** Mark the HUD as needing a refresh. */
  requestHud(): void { if (this.scene) this.scene.requestHud(); }

  /** Slot metadata for the save screen. */
  async listSaves(): Promise<SaveMeta[]> { return this.saves.list(); }

  async deleteSlot(slot: number): Promise<void> { await this.saves.remove(slot); }

  async copySlot(from: number, to: number): Promise<void> { await this.saves.copy(from, to); }

  get inventorySize(): number { return INVENTORY_SIZE; }
}
