/**
 * The player-facing UI.
 *
 * Everything is DOM. The canvas sits underneath and the HUD is a set of
 * absolutely positioned layers, which means the game keeps running at 60fps
 * behind a menu instead of stalling, and the UI can be styled in CSS without
 * touching a line of rendering code.
 *
 * The boards are deliberately data-driven: each one reads the same
 * registries the game uses, so an achievement listed on the achievement board
 * is the exact same object the engine checks. Nothing is duplicated, which is
 * what keeps the numbers on screen honest.
 */

import { Game, type Overlay } from '../Game';
import type { GameMessage, HudSnapshot } from '../scenes/GameScene';
import { SAVE_SLOTS, type SaveMeta } from '../../engine/save/SaveManager';
import { World } from '../../engine/render/World';
import { buildInventory, buildSkills, buildAttributes, buildBoards, buildMap, buildCodex } from './Screens';
import { regionAt, REGIONS, REGION_SIZE, REGION_BY_ID } from '../data/Regions';
import { QUESTS, QUEST_BY_ID } from '../data/Quests';
import { ACHIEVEMENT_BY_ID, ACHIEVEMENT_GROUPS } from '../data/Achievements';
import { TITLES } from '../data/Achievements';
import { SKILLS, skillsInTree, TREE_LABEL, TREE_ORDER } from '../data/Skills';
import { ITEMS, itemName, type ItemKind } from '../data/Items';
import { SLOT_ORDER, SLOT_LABEL, GEAR_SETS, gearDef } from '../data/Equipment';
import { ENEMIES, resolveEnemy } from '../data/Enemies';
import { DUNGEONS, DUNGEON_BY_ID } from '../data/Dungeons';
import { CODEX_BY_ID, CODEX_CATEGORIES } from '../data/Lore';
import { BIOME_AMBIENT, MUSIC_TRACKS } from '../data/Music';
import { STRUCTURES } from '../data/Structures';
import { BOSS_ARENA_CELLS } from '../../engine/render/World';
import { attributeLevelFor, xpToNext } from '../systems/Stats';
import { ACTION_GROUPS, ACTION_LABELS, controls, displayKey, type InputAction } from '../config/Controls';
import { ENCHANTS, ENCHANT_BY_ID, enchantCount, enchantCost, fuelSeconds, hasEnchant, isFuel, isSmeltable } from '../systems/Forge';
import { BALANCE_DEFS, balance } from '../config/Balance';
/** Item kinds an enchanting table will accept. */
const ENCHANTABLE_KINDS: ItemKind[] = ['tool', 'weapon', 'armor', 'magic'];

import { CHUNK_COUNT, MAX_EVENT_LOG, MAX_LOGGED_BOSSES, MAX_LOGGED_MARKERS, MAX_LOGGED_STRUCTURES, REGION_COUNT } from '../systems/Progress';

type AnyEl = HTMLElement;

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K, className?: string, text?: string,
): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  return e;
}

function div(className?: string, text?: string): AnyEl { return el('div', className, text); }

function hex(n: number): string {
  return '#' + n.toString(16).padStart(6, '0');
}

export interface SettingsState {
  renderDistance: number;
  volume: number;
  music: number;
  sfx: number;
  shadows: boolean;
  fog: boolean;
  musicOn: boolean;
  sfxOn: boolean;
  /** Touch: 0.8 compact, 1 normal, 1.25 large. */
  touchScale: number;
  /** Touch: drag the right half of the screen to look around. */
  touchLook: boolean;
  /** Touch: hide the control layer while the player is not touching. */
  touchAutoHide: boolean;
  /** Record which regions and chunks the player has seen. */
  discoveryOn: boolean;
  /** Remember named structures and their positions. */
  discoveryStructures: boolean;
  /** Keep the bounded event log of journey milestones. */
  discoveryEvents: boolean;
}

export const DEFAULT_SETTINGS: SettingsState = {
  renderDistance: 5, volume: 0.75, music: 0.8, sfx: 0.9,
  shadows: false, fog: true, musicOn: true, sfxOn: true,
  touchScale: 1, touchLook: true, touchAutoHide: true,
  discoveryOn: true, discoveryStructures: true, discoveryEvents: true,
};

export class AppUi {
  readonly root: HTMLElement;
  private game: Game;
  private hudLayer!: AnyEl;
  private overlayLayer!: AnyEl;
  private toastLayer!: AnyEl;
  private touchLayer!: AnyEl;
  private screens = new Map<Overlay, AnyEl>();
  private hud: HudSnapshot | null = null;
  private settings: SettingsState = { ...DEFAULT_SETTINGS };
  private settingsLoaded = false;
  private titleSaves: SaveMeta[] = [];
  private deathCause = '';
  private musicLabel = '';
  private fpsAcc = 0;
  private fpsFrames = 0;
  private mapDrag: { x: number; y: number } | null = null;
  private minimapDirty = true;
  private minimapCanvas!: HTMLCanvasElement;
  private minimapCtx!: CanvasRenderingContext2D;
  private savedScreens: Overlay[] = [];
  private toasts: { el: AnyEl; left: number; color: string }[] = [];
  private interactEl!: AnyEl;
  private messageEl!: AnyEl;
  private questEl!: AnyEl;
  private bossEl!: AnyEl;
  private hintTimer = 0;
  private titleTime = 0;
  private titleCanvas!: HTMLCanvasElement;
  private titleCtx!: CanvasRenderingContext2D;
  private titleSprite: { x: number; y: number; vx: number; vy: number; r: number; c: string }[] = [];

  constructor(game: Game, root: HTMLElement) {
    this.game = game;
    this.root = root;
    root.classList.add('ui-root');
    this.buildShell();
    this.loadSettings();
    this.buildTouchLayer();
    this.buildTitleScreen();
    window.addEventListener('resize', () => this.onResize());
    window.addEventListener('fullscreenchange', () => this.game.setFullscreenState(document.fullscreenElement !== null));
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.game.isPaused === false) this.game.pushOverlay('pause');
    });
    this.animateTitle(0);
  }

  // ---------------------------------------------------------------- shell

  private buildShell(): void {
    this.hudLayer = div('hud-layer');
    this.overlayLayer = div('overlay-layer');
    this.toastLayer = div('toast-layer');
    this.touchLayer = div('touch-layer');
    this.overlayLayer.style.display = 'none';
    this.touchLayer.style.display = 'none';
    this.root.append(this.hudLayer, this.overlayLayer, this.toastLayer, this.touchLayer);

    this.hudLayer.append(this.buildTopBar(), this.buildHudBottom(), this.buildBossBar(),
      this.buildObjectivePanel(), this.buildMessages(), this.buildMinimap());
  }

  private buildTopBar(): AnyEl {
    const bar = div('hud-top');
    bar.append(this.buildPortrait(), this.buildCompass());
    const spacer = div('hud-spacer');
    bar.append(spacer, this.buildFps());
    this.hudLayer.append(bar);
    return bar;
  }

  private buildPortrait(): AnyEl {
    const box = div('hud-portrait');
    box.innerHTML = `
      <div class="hud-portrait-avatar"></div>
      <div class="hud-portrait-body">
        <div class="hud-name" data-hud="name">Wanderer</div>
        <div class="hud-level" data-hud="level">Lv. 1</div>
        <div class="hud-xp" data-hud="xp"><span data-hud="xptext">0 / 100</span></div>
        <div class="hud-region" data-hud="region">—</div>
        <div class="hud-biome" data-hud="biome">—</div>
      </div>`;
    return box;
  }

  private buildCompass(): AnyEl {
    const box = div('hud-compass');
    box.innerHTML = `<div class="hud-compass-dial"></div><div class="hud-compass-ticks"></div>`;
    return box;
  }

  private buildFps(): AnyEl {
    const box = div('hud-fps');
    box.innerHTML = `<span data-hud="fps">60</span>fps · <span data-hud="chunks">0</span> chunks`;
    return box;
  }

  private buildHudBottom(): AnyEl {
    const bar = div('hud-bottom');
    bar.append(this.buildVitals(), this.buildHotbar(), this.buildSkills());
    return bar;
  }

  private buildVitals(): AnyEl {
    const box = div('hud-vitals');
    box.innerHTML = `
      <div class="bar-row"><span class="bar-icon bar-hp">♥</span>
        <div class="bar"><div class="bar-fill" data-bar="hp"></div></div>
        <span class="bar-text" data-text="hp">20/20</span></div>
      <div class="bar-row"><span class="bar-icon bar-mp">✦</span>
        <div class="bar"><div class="bar-fill" data-bar="mp"></div></div>
        <span class="bar-text" data-text="mp">20/20</span></div>
      <div class="bar-row"><span class="bar-icon bar-st">⚡</span>
        <div class="bar"><div class="bar-fill" data-bar="st"></div></div>
        <span class="bar-text" data-text="st">100</span></div>
      <div class="bar-row"><span class="bar-icon bar-food">暴饮暴食</span>
        <div class="bar"><div class="bar-fill" data-bar="food"></div></div>
        <span class="bar-text" data-text="food">20</span></div>`;
    return box;
  }

  private buildHotbar(): AnyEl {
    const box = div('hud-hotbar');
    for (let i = 0; i < 9; i++) {
      const slot = div('hud-slot');
      slot.innerHTML = `<div class="hud-slot-icon" data-slot="${i}"></div><span class="hud-slot-key">${i + 1}</span>`;
      slot.addEventListener('click', () => this.game.scene_?.player.setHotbar(i));
      box.append(slot);
    }
    return box;
  }

  private buildSkills(): AnyEl {
    const box = div('hud-skills');
    for (let i = 0; i < 4; i++) {
      const slot = div('hud-skill');
      slot.innerHTML = `<span class="hud-skill-key">${['Q', 'E', 'R', 'F'][i]}</span><div class="hud-skill-body"><span data-skill="${i}">—</span></div>`;
      slot.addEventListener('click', () => {
        const ids = (this.game.scene_?.player.state.activeSkills || []).slice();
        ids[i] = ids[i] || '';
        // Cycle through the player's trained actives.
        const trained = Object.keys((this.game.scene_?.player.state.skillLevels || {})).filter((k) => (this.game.scene_?.player.state.skillLevels || {})[k] > 0);
        const idx = trained.indexOf(ids[i]);
        ids[i] = trained[(idx + 1) % Math.max(1, trained.length)] || '';
        if (this.game.scene_?.player.setActiveSkills(ids.filter(Boolean))) this.game.requestHud();
      });
      box.append(slot);
    }
    return box;
  }

  private buildBossBar(): AnyEl {
    this.bossEl = div('hud-boss', '');
    this.bossEl.innerHTML = `<div class="hud-boss-name" data-boss="name"></div><div class="hud-boss-bar"><div class="hud-boss-fill" data-boss="fill"></div></div>`;
    this.bossEl.style.display = 'none';
    this.hudLayer.append(this.bossEl);
    return this.bossEl;
  }

  private buildObjectivePanel(): AnyEl {
    this.questEl = div('hud-quests');
    this.hudLayer.append(this.questEl);
    return this.questEl;
  }

  private buildMessages(): AnyEl {
    this.messageEl = div('hud-messages');
    this.hudLayer.append(this.messageEl);
    const interact = div('hud-interact');
    this.interactEl = interact;
    this.hudLayer.append(interact);
    return this.messageEl;
  }

  private buildMinimap(): AnyEl {
    const box = div('hud-map');
    this.minimapCanvas = el('canvas', 'hud-map-canvas');
    this.minimapCanvas.width = 150;
    this.minimapCanvas.height = 150;
    this.minimapCtx = this.minimapCanvas.getContext('2d')!;
    box.append(this.minimapCanvas);
    const legend = div('hud-map-legend', 'Quest ◆ Boss ▲ Dungeon ▼');
    box.append(legend);
    box.addEventListener('click', (e) => {
      if (!this.game.scene_) return;
      const rect = this.minimapCanvas.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      if (x < 0 || y < 0 || x > 150 || y > 150) return;
      const world = this.game.worldRef!;
      const wx = Math.floor((x / 150) * 384);
      const wz = Math.floor((y / 150) * 384);
      this.game.travelTo(world.regionIdAt(wx, wz));
    });
    this.hudLayer.append(box);
    return box;
  }

  // ---------------------------------------------------------------- touch

  /**
   * Virtual controls for touch. The engine's input layer already treats the
   * left 55% of the screen as a movement stick; this layer draws the ring for
   * it and the buttons on the right, and registers their hit areas so the
   * engine can tell them apart.
   */
  private buildTouchLayer(): void {
    const layer = this.touchLayer;
    const buttons: { id: string; label: string; cls: string; r: number; x: number; y: number }[] = [];
    const place = (id: string, label: string, cls: string, r: number, fromRight: number, fromBottom: number) => {
      buttons.push({ id, label, cls, r, x: window.innerWidth - fromRight, y: window.innerHeight - fromBottom });
    };
    place('attack', '⚔', 'tbtn-attack', 62, 34, 132);
    place('jump', '↑', 'tbtn-jump', 46, 122, 34);
    place('dash', '»', 'tbtn-dash', 40, 78, 26);
    place('sprint', '»', 'tbtn-sprint', 36, 178, 132);
    place('interact', 'E', 'tbtn-interact', 38, 214, 34);
    place('skill', '✦', 'tbtn-skill-main', 40, 296, 110);
    place('skill1', 'Q', 'tbtn-skill', 32, 268, 120);
    place('skill2', 'R', 'tbtn-skill', 32, 316, 150);
    place('skill3', 'F', 'tbtn-skill', 32, 268, 176);
    place('skill4', 'G', 'tbtn-skill', 32, 316, 202);
    place('pause', '❚❚', 'tbtn-pause', 34, 240, 96);

    layer.innerHTML = '';
    const ring = div('touch-stick-ring');
    layer.append(ring);
    for (const b of buttons) {
      const node = div(`touch-btn ${b.cls}`, b.label);
      node.style.left = `${b.x - b.r}px`;
      node.style.top = `${b.y - b.r}px`;
      node.style.width = `${b.r * 2}px`;
      node.style.height = `${b.r * 2}px`;
      layer.append(node);
    }
    const hint = div('touch-hint',
      'Drag the left half to move · drag the right half to look · press a button to act');
    layer.append(hint);
    this.touchButtons = buttons;
    this.refreshTouchPositions();
  }

  private touchButtons: { id: string; label: string; cls: string; r: number; x: number; y: number }[] = [];

  /** Reposition the buttons and re-register their hit areas after a resize. */
  private refreshTouchPositions(): void {
    const layer = this.touchLayer;
    // The size toggle scales the hit areas with the visuals, so a player who
    // finds the buttons too small is not also given buttons they cannot press.
    const scale = this.settings.touchScale || 1;
    const nodes = layer.querySelectorAll('.touch-btn');
    this.touchButtons.forEach((b, i) => {
      const node = nodes[i] as HTMLElement | undefined;
      if (!node) return;
      const r = b.r * scale;
      node.style.left = `${b.x - r}px`;
      node.style.top = `${b.y - r}px`;
      node.style.width = `${r * 2}px`;
      node.style.height = `${r * 2}px`;
    });

    const w = window.innerWidth;
    const h = window.innerHeight;
    for (const b of this.touchButtons) {
      this.input().registerTouchButton(b.id, b.x, b.y, b.r * scale);
    }
    // Hotbar swipe targets sit in the bottom-right corner, where a thumb
    // rests naturally, and stay put when the control layer is hidden.
    this.input().registerTouchButton('hotbarL', w - 300, h - 60, 26);
    this.input().registerTouchButton('hotbarR', w - 240, h - 60, 26);
  }

  private b(id: string) { return this.touchButtons.find((t) => t.id === id)!; }

  private input() { return this.game.input; }

  // ---------------------------------------------------------------- title

  private titleScreen!: AnyEl;
  private titleOverlay: Overlay | 'title' = 'none';
  private titleRaf = 0;

  private buildTitleScreen(): void {
    const screen = div('screen title-screen');
    this.titleCanvas = el('canvas', 'title-canvas');
    this.titleCanvas.width = 900;
    this.titleCanvas.height = 506;
    this.titleCtx = this.titleCanvas.getContext('2d')!;
    screen.append(this.titleCanvas);

    const content = div('title-content');
    content.innerHTML = `
      <div class="title-logo">
        <span class="title-logo-sub">VOWEL</span>
        <h1>ETERNITY</h1>
        <span class="title-logo-tag">Voxel Realms</span>
      </div>
      <p class="title-tagline">A block-built open world. Four hundred hand-drawn regions, eleven
        fallen arenas, and a power curve tuned so the hundredth level still means something.</p>
      <div class="title-actions">
        <button class="btn btn-primary" data-title="continue">Continue</button>
        <button class="btn" data-title="new">New Game</button>
        <button class="btn" data-title="load">Load Save</button>
        <button class="btn btn-ghost" data-title="settings">Settings</button>
      </div>
      <div class="title-footnote">
        <span>384 × 128 × 384 voxels</span><span>144 regions</span><span>64 quests</span>
        <span>64 achievements</span><span>10 dungeons</span><span>11 arenas</span>
      </div>`;
    screen.append(content);
    this.titleScreen = screen;
    this.overlayLayer.append(screen);
    screen.style.display = 'none';

    screen.addEventListener('click', (e) => {
      const btn = (e.target as AnyEl).closest('[data-title]') as AnyEl | null;
      if (!btn) return;
      const action = btn.dataset.title;
      this.audio().play('ui_click', 0.8);
      if (action === 'continue') void this.game.continueRun().then(() => this.setPlaying(true));
      else if (action === 'new') this.startNew();
      else if (action === 'load') this.pushOverlay('save');
      else if (action === 'settings') this.pushOverlay('settings');
    });
  }

  private startNew(): void {
    const screen = this.screens.get('dialogue') || this.overlayLayer;
    const box = div('dialogue-card');
    box.innerHTML = `<h3>New Character</h3>
      <label>Name<input id="char-name" maxlength="16" value="Wanderer" /></label>
      <p class="dialogue-hint">You start in the Frostbound Shore with a wooden sword, a shortbow
        and two potions.</p>
      <div class="dialogue-actions">
        <button class="btn" data-act="cancel">Cancel</button>
        <button class="btn btn-primary" data-act="create">Begin</button>
      </div>`;
    screen.append(box);
    (box.querySelector('input') as HTMLInputElement)?.focus();
    box.addEventListener('click', (e) => {
      const btn = (e.target as AnyEl).closest('[data-act]') as AnyEl | null;
      if (!btn) return;
      const input = box.querySelector('input') as HTMLInputElement;
      if (btn.dataset.act === 'create') {
        const name = (input.value || 'Wanderer').trim().slice(0, 16);
        box.remove();
        this.game.newRun(name);
        this.setPlaying(true);
      } else {
        box.remove();
      }
    });
  }

  private animateTitle(dt: number): void {
    this.titleTime += dt;
    const ctx = this.titleCtx;
    if (!ctx) return;
    const w = this.titleCanvas.width, h = this.titleCanvas.height;
    ctx.clearRect(0, 0, w, h);
    // Drifting gradient sky, then a silhouette of the world's height profile.
    const g = ctx.createLinearGradient(0, 0, 0, h);
    g.addColorStop(0, '#12203a');
    g.addColorStop(0.5, '#243a5c');
    g.addColorStop(1, '#0a1020');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);

    // Stars.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (let i = 0; i < 90; i++) {
      const sx = (i * 97.3) % w;
      const sy = (i * 53.7) % (h * 0.6);
      const tw = 0.5 + 0.5 * Math.sin(this.titleTime * 2 + i);
      ctx.globalAlpha = 0.25 + tw * 0.6;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;

    // A horizon of voxel peaks drawn from the region heights.
    const t = this.titleTime * 0.02;
    ctx.fillStyle = '#0e1830';
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 6) {
      const hgt = 60 + ((Math.sin((x + t * 40) * 0.03) + 1) * 60)
        + ((Math.sin((x - t * 60) * 0.07) + 1) * 34);
      ctx.lineTo(x, h - hgt);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();

    // Glowing lattice above the peaks.
    ctx.strokeStyle = 'rgba(120,180,255,0.22)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= w; x += 32) {
      ctx.beginPath();
      ctx.moveTo(x, h);
      ctx.lineTo(x, h - 150);
      ctx.stroke();
    }
    for (let y = h - 150; y <= h; y += 32) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    // Floating motes.
    if (this.titleSprite.length < 40) {
      this.titleSprite.push({
        x: Math.random() * w, y: h + 20, vx: (Math.random() - 0.5) * 8,
        vy: -20 - Math.random() * 30, r: 1 + Math.random() * 2.4,
        c: ['#8ad0ff', '#ffe070', '#5ae070', '#e08aff'][Math.floor(Math.random() * 4)],
      });
    }
    for (const s of this.titleSprite) {
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (s.y < -10) { s.y = h + 20; s.x = Math.random() * w; }
      ctx.globalAlpha = 0.6;
      ctx.fillStyle = s.c;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // Light sweep.
    const sweep = (Math.sin(this.titleTime * 0.35) + 1) / 2;
    const sg = ctx.createLinearGradient(w * sweep - 120, 0, w * sweep + 120, 0);
    sg.addColorStop(0, 'rgba(255,240,180,0)');
    sg.addColorStop(0.5, `rgba(255,240,180,${0.10 + sweep * 0.10})`);
    sg.addColorStop(1, 'rgba(255,240,180,0)');
    ctx.fillStyle = sg;
    ctx.fillRect(0, 0, w, h);

    if (this.titleScreen.style.display !== 'none') {
      this.titleRaf = window.requestAnimationFrame(() => this.animateTitle(1 / 60));
    }
  }

  showTitle(saves: SaveMeta[] | Promise<SaveMeta[]>): void {
    Promise.resolve(saves).then((list) => {
      this.titleSaves = list;
      const cont = this.titleScreen.querySelector('[data-title="continue"]') as AnyEl;
      if (cont) {
        (cont as HTMLButtonElement).disabled = !list.filter((m) => m).length;
        cont.textContent = list.filter((m) => m).length ? 'Continue' : 'No saves yet';
      }
      const newBtn = this.titleScreen.querySelector('[data-title="new"]') as AnyEl;
      if (newBtn) newBtn.textContent = 'New Game';
    });
    this.hideAllOverlays();
    this.titleScreen.style.display = 'flex';
    this.setPlaying(false);
    this.titleOverlay = 'title';
    this.animateTitle(1 / 60);
  }

  // ---------------------------------------------------------------- overlays

  pushOverlay(o: Overlay): void {
    if (this.screens.has(o)) return;
    let screen = this.screenFor(o);
    if (!screen) return;
    this.screens.set(o, screen);
    this.overlayLayer.append(screen);
    screen.style.display = 'flex';
  }

  hideOverlay(o: Overlay): void {
    const screen = this.screens.get(o);
    if (!screen) return;
    screen.style.display = 'none';
    this.screens.delete(o);
    if (o === this.titleOverlay) {
      this.titleOverlay = 'none';
      this.titleScreen.style.display = 'none';
    }
  }

  hideAllOverlays(): void {
    for (const [o, screen] of this.screens) {
      if (o === this.titleOverlay) continue;
      screen.style.display = 'none';
    }
    this.screens.clear();
  }

  showOverlay(o: Overlay): void { this.pushOverlay(o); }

  private screenFor(o: Overlay): AnyEl | null {
    switch (o) {
      case 'pause': return this.buildPauseScreen();
      case 'death': return this.buildDeathScreen();
      case 'inventory': return this.screenWith('inventory', buildInventory);
      case 'skills': return this.screenWith('skills', buildSkills);
      case 'attributes': return this.screenWith('attributes', buildAttributes);
      case 'boards': return this.screenWith('boards', buildBoards);
      case 'map': return this.screenWith('map', buildMap);
      case 'settings': return this.buildSettingsScreen();
      case 'save': return this.buildSaveScreen();
      case 'codex': return this.screenWith('codex', buildCodex);
      case 'furnace': return this.buildFurnaceScreen();
      case 'enchant': return this.buildEnchantScreen();
      default: return null;
    }
  }

  /**
   * Build one of the data screens. The screen is a fresh element each time,
   * which is what makes `refreshOverlay` safe: closing a screen and reopening
   * it shows exactly the same state.
   */
  private screenWith(kind: Overlay, builder: (g: Game, s: HTMLElement) => void): AnyEl {
    const screen = div(`screen menu-screen ${kind}-screen`);
    builder(this.game, screen);
    return screen;
  }

  /** Rebuild whatever overlay is on top, preserving the stack order. */
  refreshOverlay(): void {
    if (!this.game.isTop || this.game.overlayCount < 2) return;
    const top = this.game.topOverlay();
    if (top === 'pause' || top === 'death' || top === 'settings' || top === 'save') return;
    const screen = this.screens.get(top);
    if (!screen) return;
    screen.remove();
    this.screens.delete(top);
    this.pushOverlay(top);
  }

  // ---------------------------------------------------------------- pause

  private buildPauseScreen(): AnyEl {
    const screen = div('screen menu-screen pause-screen');
    screen.innerHTML = `
      <div class="menu-card">
        <h2>Paused</h2>
        <p class="menu-sub" data-pause="sub">—</p>
        <div class="menu-list">
          <button class="btn btn-primary" data-menu="resume">Resume</button>
          <button class="btn" data-menu="inventory">Inventory <kbd>I</kbd></button>
          <button class="btn" data-menu="attributes">Attributes <kbd>K</kbd></button>
          <button class="btn" data-menu="skills">Skills <kbd>U</kbd></button>
          <button class="btn" data-menu="boards">Boards <kbd>B</kbd></button>
          <button class="btn" data-menu="map">Map <kbd>M</kbd></button>
          <button class="btn" data-menu="codex">Codex <kbd>C</kbd></button>
          <button class="btn" data-menu="settings">Settings <kbd>O</kbd></button>
          <button class="btn" data-menu="save">Save / Load <kbd>S</kbd></button>
          <button class="btn btn-danger" data-menu="quit">Quit to Title</button>
        </div>
      </div>`;
    screen.addEventListener('click', (e) => {
      const btn = (e.target as AnyEl).closest('[data-menu]') as AnyEl | null;
      if (!btn) return;
      const a = btn.dataset.menu;
      this.audio().play('ui_click', 0.7);
      if (a === 'resume') this.game.popOverlay();
      else if (a === 'quit') { this.hideAllOverlays(); this.game.quitToTitle(); }
      else this.game.pushOverlay(a as Overlay);
    });
    setTimeout(() => this.fillPauseSub(), 0);
    return screen;
  }

  private fillPauseSub(): void {
    const sub = this.screens.get('pause')?.querySelector('[data-pause="sub"]') as AnyEl | null;
    if (!sub) return;
    const s = this.game.snapshot;
    if (!s) { sub.textContent = 'Press any key to play'; return; }
    sub.textContent = `${s.regionName} · ${s.biomeName} · ${s.exploration.toFixed(0)}% explored · ${Math.floor(s.playtime / 60)} min played · ${s.fps} fps`;
  }

  // ---------------------------------------------------------------- death

  private buildDeathScreen(): AnyEl {
    const screen = div('screen menu-screen death-screen');
    screen.innerHTML = `
      <div class="menu-card death-card">
        <h2 data-death="title">You Have Fallen</h2>
        <p class="menu-sub" data-death="cause"></p>
        <div class="death-stats" data-death="stats"></div>
        <div class="menu-list">
          <button class="btn btn-primary" data-death="respawn">Respawn at World Spawn</button>
          <button class="btn" data-death="title">Quit to Title</button>
        </div>
        <p class="menu-footnote">Your inventory and progress are intact.</p>
      </div>`;
    screen.addEventListener('click', (e) => {
      const btn = (e.target as AnyEl).closest('[data-death]') as AnyEl | null;
      if (!btn) return;
      this.audio().play('ui_click', 0.7);
      if (btn.dataset.death === 'respawn') this.game.respawn();
      else { this.hideAllOverlays(); this.game.quitToTitle(); }
    });
    return screen;
  }

  setDeath(cause: string, state: any): void {
    const screen = this.screens.get('death');
    if (!screen) return;
    const title = screen.querySelector('[data-death="title"]') as AnyEl;
    const causeEl = screen.querySelector('[data-death="cause"]') as AnyEl;
    const stats = screen.querySelector('[data-death="stats"]') as AnyEl;
    title.textContent = cause === 'defeated' ? 'You Have Fallen' : `The World Claims You — ${cause}`;
    causeEl.textContent = cause === 'defeated'
      ? 'Foes were stronger this time. Your gear is waiting where you left it.'
      : 'The world took what it was owed.';
    if (state && stats) {
      const st = state.stats || {};
      stats.innerHTML = `
        <div><span>Level</span><b>${state.level}</b></div>
        <div><span>Deaths</span><b>${st.deaths || 0}</b></div>
        <div><span>Kills</span><b>${st.kills || 0}</b></div>
        <div><span>Time</span><b>${Math.floor((state.playtime || 0) / 60)}m</b></div>`;
    }
  }

  // ---------------------------------------------------------------- hud update

  setPlaying(playing: boolean): void {
    this.hudLayer.style.display = playing ? 'block' : 'none';
    this.touchLayer.style.display = playing && this.game.input.isTouch ? 'block' : 'none';
    if (!playing) this.hideAllOverlays();
  }

  updateHud(h: HudSnapshot, messages: GameMessage[]): void {
    this.hud = h;
    this.minimapDirty = true;

    const set = (sel: string, text: string) => {
      const node = this.hudLayer.querySelector(sel);
      if (node) node.textContent = text;
    };
    set('[data-hud="name"]', this.game.playerState?.name || 'Wanderer');
    set('[data-hud="level"]', `Lv. ${h.level}`);
    set('[data-hud="xptext"]', h.xpText);
    const xpPct = Math.min(100, (h.xp / Math.max(1, h.xpNeeded)) * 100);
    const xpBar = this.hudLayer.querySelector('[data-hud="xp"]') as AnyEl | null;
    if (xpBar) xpBar.style.setProperty('--fill', `${xpPct}%`);
    set('[data-hud="region"]', `${h.regionName} · ${h.exploration.toFixed(0)}% explored`);
    set('[data-hud="biome"]', h.biomeName);
    set('[data-hud="fps"]', String(h.fps));
    set('[data-hud="chunks"]', String(h.chunkCount));

    const fill = (key: string, v: number, max: number) => {
      const bar = this.hudLayer.querySelector(`[data-bar="${key}"]`) as AnyEl | null;
      const text = this.hudLayer.querySelector(`[data-text="${key}"]`) as AnyEl | null;
      const pct = Math.max(0, Math.min(100, (v / Math.max(1, max)) * 100));
      if (bar) bar.style.width = `${pct}%`;
      if (text) text.textContent = `${Math.ceil(v)}/${Math.round(max)}`;
      if (bar) bar.className = `bar-fill bar-${key}-fill`;
    };
    fill('hp', h.health, h.maxHealth);
    fill('mp', h.mana, h.maxMana);
    fill('st', h.stamina, 100);
    fill('food', h.hunger, 20);

    // Hotbar
    const slots = this.hudLayer.querySelectorAll('.hud-slot');
    h.hotbar.forEach((s, i) => {
      const node = slots[i] as AnyEl | null;
      if (!node) return;
      node.classList.toggle('selected', s.selected);
      const icon = node.querySelector(`[data-slot="${i}"]`) as AnyEl;
      const def = s.id ? ITEMS[s.id] : null;
      if (def) {
        icon.textContent = def.name.slice(0, 3);
        icon.style.background = `linear-gradient(135deg, ${hex(def.color || 0x888888)}, #262a33)`;
      } else {
        icon.textContent = '';
        icon.style.background = '#1c2028';
      }
      const count = node.querySelector('.hud-slot-count') as AnyEl | null;
      if (count) count.textContent = String(s.count);
      else if (s.count > 1) {
        const c = div('hud-slot-count', String(s.count));
        node.append(c);
      }
    });

    // Skills
    h.activeSkills.forEach((sk, i) => {
      const node = this.hudLayer.querySelector(`[data-skill="${i}"]`) as AnyEl | null;
      if (node) {
        node.textContent = sk.ready ? `${sk.name} · ${sk.level}` : `${sk.name} ${(sk as any).cd ?? ''}`;
        node.style.opacity = sk.ready ? '1' : '0.45';
      }
    });

    // Boss bar
    if (h.boss) {
      this.bossEl.style.display = 'block';
      (this.bossEl.querySelector('[data-boss="name"]') as AnyEl).textContent = h.boss;
      const fillEl = this.bossEl.querySelector('[data-boss="fill"]') as AnyEl;
      fillEl.style.width = `${Math.max(0, Math.min(100, (h.bossHealth || 0) / Math.max(1, h.bossHealth || 1) * 100))}%`;
    } else {
      this.bossEl.style.display = 'none';
    }

    // Quest tracker
    const quests = this.questEl;
    const active = h.activeQuests;
    const html = active.slice(0, 3).map((q) => {
      const objs = h.objectives.filter((o) => o.text.startsWith('') && o).slice(0, 1);
      return `<div class="quest-row ${q.ready ? 'ready' : ''}">
        <span class="quest-mark">${q.ready ? '✔' : '⚑'}</span>
        <span class="quest-name">${q.name}</span>
        ${objs.length ? `<span class="quest-obj">${objs[0].have}/${objs[0].need} ${objs[0].text.slice(0, 18)}</span>` : ''}
      </div>`;
    }).join('');
    quests.innerHTML = html;

    // Messages
    this.renderMessages(messages);

    // Interact prompt
    this.interactEl.textContent = h.interact || '';
    this.interactEl.style.display = h.interact ? 'block' : 'none';
  }

  private renderMessages(messages: GameMessage[]): void {
    if (!messages.length) {
      this.messageEl.innerHTML = '';
      return;
    }
    this.messageEl.innerHTML = messages.slice(-4).map((m) =>
      `<div class="msg msg-${m.kind}" style="color:${hex(m.color)};border-color:${hex(m.color)}">${m.text}</div>`,
    ).join('');
  }

  // ---------------------------------------------------------------- minimap

  private onResize(): void {
    this.game.resize();
    if (this.touchLayer) this.refreshTouchPositions();
  }

  /** Draw the minimap from the current HUD snapshot. */
  drawMinimap(): void {
    const h = this.hud;
    const ctx = this.minimapCtx;
    if (!h || !ctx) return;
    const w = 150, hh = 150;
    ctx.clearRect(0, 0, w, hh);
    const world = this.game.worldRef;
    if (!world) return;
    const cx = 384 / 2, cz = 384 / 2;
    // Region grid.
    for (let gx = 0; gx < 12; gx++) {
      for (let gz = 0; gz < 12; gz++) {
        const reg = REGION_BY_ID.get(gz * 12 + gx)!;
        const x = ((gx * REGION_SIZE + 16 - cx) / 384) * w + w / 2;
        const y = ((gz * REGION_SIZE + 16 - cz) / 384) * hh + hh / 2;
        const s = REGION_SIZE / 384 * w;
        ctx.fillStyle = `rgba(${reg.biome === 'forest' ? '60,140,80' : '70,90,130'},0.16)`;
        ctx.fillRect(x - s / 2, y - s / 2, s, s);
      }
    }
    // Boss arenas.
    for (const [id, cells] of Object.entries(BOSS_ARENA_CELLS)) {
      const [gx, gz] = cells[0];
      const x = ((gx * 32 + 16 - cx) / 384) * w + w / 2;
      const y = ((gz * 32 + 16 - cz) / 384) * hh + hh / 2;
      ctx.fillStyle = '#ff7028';
      ctx.beginPath();
      ctx.arc(x, y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dungeons.
    for (const d of DUNGEONS) {
      const reg = REGION_BY_ID.get(d.region)!;
      const x = ((reg.gx * 32 + 16 - cx) / 384) * w + w / 2;
      const y = ((reg.gz * 32 + 16 - cz) / 384) * hh + hh / 2;
      ctx.fillStyle = '#5ae0ff';
      ctx.fillRect(x - 2.5, y - 2.5, 5, 5);
    }
    // Player.
    const px = ((h.coordinates.x - cx) / 384) * w + w / 2;
    const py = ((h.coordinates.z - cz) / 384) * hh + hh / 2;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(px, py, 4, 0, Math.PI * 2);
    ctx.fill();
    // Compass needle.
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(px, py);
    ctx.lineTo(px, py - 16);
    ctx.stroke();
    // Region label under the map.
    const ctx2 = this.hudLayer.querySelector('.hud-map-legend') as AnyEl | null;
    if (ctx2) ctx2.textContent = `${h.regionName} · ${h.coordinates.x},${h.coordinates.z} · ${h.exploration.toFixed(0)}% explored`;
  }

  // ---------------------------------------------------------------- settings

  private buildSettingsScreen(): AnyEl {
    const screen = div('screen menu-screen settings-screen');
    screen.innerHTML = `
      <div class="menu-card wide">
        <h2>Settings</h2>
        <div class="settings-tabs">
          <button class="tab active" data-tab="audio">Audio & Render</button>
          <button class="tab" data-tab="controls">Controls</button>
          <button class="tab" data-tab="balance">Balance</button>
          <button class="tab" data-tab="discovery">World Memory</button>
        </div>
        <div class="settings-body">
          <section class="settings-panel" data-panel="audio"></section>
          <section class="settings-panel" data-panel="controls" hidden></section>
          <section class="settings-panel" data-panel="balance" hidden></section>
          <section class="settings-panel" data-panel="discovery" hidden></section>
        </div>
        <div class="menu-list">
          <button class="btn btn-primary" data-set="back">Done</button>
          <button class="btn btn-ghost" data-set="reset">Reset to Defaults</button>
        </div>
      </div>`;

    this.buildAudioPanel(screen.querySelector('[data-panel="audio"]') as AnyEl);
    this.buildControlsPanel(screen.querySelector('[data-panel="controls"]') as AnyEl);
    this.buildBalancePanel(screen.querySelector('[data-panel="balance"]') as AnyEl);
    this.buildDiscoveryPanel(screen.querySelector('[data-panel="discovery"]') as AnyEl);

    // One reader for every control: sliders, dropdowns and toggles all land in
    // the same place, which is why the settings screen has a single commit path.
    const read = () => {
      screen.querySelectorAll('[data-set]').forEach((node) => {
        const key = (node as AnyEl).dataset.set!;
        if (key === 'back' || key === 'reset' || key === 'reset-controls') return;
        const el2 = node as HTMLInputElement | HTMLSelectElement;
        if (key === 'discoverRadius' || key === 'progressFlushMs') {
          this.game.setBalance(key as 'discoverRadius' | 'progressFlushMs', Number(el2.value));
          return;
        }
        if (el2 instanceof HTMLSelectElement) this.settings[key as keyof SettingsState] = Number(el2.value) as never;
        else if (el2.type === 'checkbox') this.settings[key as keyof SettingsState] = el2.checked as never;
        else this.settings[key as keyof SettingsState] = Number(el2.value) / 100 as never;
      });
      screen.querySelectorAll('[data-disc]').forEach((node) => {
        const key = (node as AnyEl).dataset.disc as keyof SettingsState;
        if (key in this.settings) this.settings[key] = (node as HTMLInputElement).checked as never;
      });
    };
    const commit = () => { read(); this.commitSettings(); };
    screen.addEventListener('input', commit);
    screen.addEventListener('change', () => { commit(); this.populateSettings(); });

    screen.addEventListener('click', (e) => {
      const btn = (e.target as AnyEl).closest('[data-set], [data-tab], [data-capture], [data-balance]') as AnyEl | null;
      if (!btn) return;
      this.audio().play('ui_click', 0.7);

      const tab = btn.dataset.tab;
      if (tab) {
        screen.querySelectorAll('[data-tab]').forEach((t) => t.classList.toggle('active', t === btn));
        screen.querySelectorAll('[data-panel]').forEach((panel) => {
          (panel as AnyEl).hidden = (panel as AnyEl).dataset.panel !== tab;
        });
        return;
      }

      const setKey = btn.dataset.set;
      if (setKey === 'back') { this.commitSettings(); this.game.popOverlay(); return; }
      if (setKey === 'reset') {
        this.settings = { ...DEFAULT_SETTINGS };
        this.game.resetControls();
        this.game.resetBalance();
        this.populateSettings();
        this.commitSettings();
        this.audio().play('ui_back', 0.6);
        return;
      }

      const capture = btn.dataset.capture as InputAction | undefined;
      if (capture) { this.beginCapture(capture, btn); return; }

      const stat = btn.dataset.balance as string | undefined;
      if (stat) {
        const def = BALANCE_DEFS.find((d) => d.key === stat);
        if (!def) return;
        const cur = this.game.balanceValue(def.key);
        const dir = Number(btn.dataset.dir || 1);
        const next = Math.min(def.max, Math.max(def.min, Number((cur + dir * def.step).toFixed(def.digits))));
        this.game.setBalance(def.key, next);
        this.populateSettings();
      }
    });

    const grid = screen.querySelector('[data-tracks]') as AnyEl;
    if (grid) {
      grid.addEventListener('click', (e) => {
        const trackEl = (e.target as AnyEl).closest('[data-track]') as AnyEl | null;
        if (!trackEl) return;
        const track = MUSIC_TRACKS.find((t) => t.id === trackEl.dataset.track);
        if (track) this.game.musicPlay(track, 0.6);
      });
    }

    setTimeout(() => this.populateSettings(), 0);
    return screen;
  }

  // ---------------------------------------------------------- audio / render

  private buildAudioPanel(host: AnyEl): void {
    host.innerHTML = `
      <div class="settings-grid">
        <label>Render distance<select data-set="renderDistance">
          ${[3, 4, 5, 6, 7, 8].map((n) => `<option value="${n}">${n} chunks</option>`).join('')}
        </select></label>
        <label>Master volume<input type="range" min="0" max="100" data-set="volume" /></label>
        <label>Music volume<input type="range" min="0" max="100" data-set="music" /></label>
        <label>SFX volume<input type="range" min="0" max="100" data-set="sfx" /></label>
        <label>Fog<input type="checkbox" data-set="fog" /></label>
        <label>Music<input type="checkbox" data-set="musicOn" /></label>
        <label>Sound effects<input type="checkbox" data-set="sfxOn" /></label>
      </div>
      <div class="settings-tracks">
        <h4>Music</h4>
        <div class="track-grid" data-tracks></div>
      </div>`;
    (host.querySelector('[data-tracks]') as AnyEl).innerHTML = MUSIC_TRACKS.map((t) =>
      `<button class="track-chip"><b>${t.name}</b><span>${t.bpm}bpm</span></button>`,
    ).join('');
  }

  // ---------------------------------------------------------------- controls

  /** The action currently waiting for a key, if any. */
  private capturing: { action: InputAction; node: AnyEl } | null = null;
  private captureHandler: ((e: KeyboardEvent) => void) | null = null;

  /**
   * Enter key-capture mode for one action.
   *
   * The listener sits on the document in the capture phase so it sees the key
   * before the game does, which is what stops the remap key from also firing
   * the action it is being bound to.
   */
  private beginCapture(action: InputAction, node: AnyEl): void {
    if (this.capturing) this.endCapture();
    this.capturing = { action, node };
    node.classList.add('capturing');
    node.innerHTML = `<span class="capture-prompt">Press a key…</span>`;
    this.captureHandler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const key = normalizeKeyEvent(e.key);
      const result = this.game.remapKey(action, key, true);
      this.endCapture();
      if (result.ok) {
        this.audio().play('ui_open', 0.7);
        if (result.swapped) {
          this.toast(`${ACTION_LABELS[result.swapped as InputAction]} was moved`, 0xe0a040);
        }
      } else {
        this.audio().play('ui_error', 0.8);
        const why = result.reason === 'unknown'
          ? `${displayKey(key)} is not a key the game can read`
          : 'That key is already in use';
        this.toast(why, 0xe05050);
      }
      this.populateSettings();
    };
    document.addEventListener('keydown', this.captureHandler, true);
  }

  private endCapture(): void {
    if (this.captureHandler) {
      document.removeEventListener('keydown', this.captureHandler, true);
      this.captureHandler = null;
    }
    if (this.capturing) {
      this.capturing.node.classList.remove('capturing');
      this.capturing = null;
    }
  }

  private buildControlsPanel(host: AnyEl): void {
    host.innerHTML = `
      <p class="menu-sub">Click a binding and press the key you want. Pressing an
      already-used key swaps the two. Arrow keys always steer.</p>
      <div class="keybind-grid" data-keybinds></div>
      <div class="keybind-foot">
        <span data-conflicts></span>
        <button class="btn btn-ghost" data-set="reset-controls">Reset Scheme</button>
      </div>`;
    const grid = host.querySelector('[data-keybinds]') as AnyEl;
    grid.innerHTML = ACTION_GROUPS.map((group) => `
      <fieldset class="keybind-group">
        <legend>${group.label}</legend>
        ${group.actions.map((action) => `
          <button class="keybind-row" data-capture="${action}" data-action="${action}">
            <span class="keybind-label">${ACTION_LABELS[action]}</span>
            <kbd data-keyfor="${action}">${controls.display(action)}</kbd>
          </button>`).join('')}
      </fieldset>`).join('');
  }

  // ----------------------------------------------------------------- balance

  private buildBalancePanel(host: AnyEl): void {
    host.innerHTML = `
      <p class="menu-sub">Live tuning. Every value applies the moment you move it,
      travels with the save, and can be reset here. The ranges are chosen so no
      slider can produce a broken game.</p>
      <div class="balance-grid" data-balances></div>`;
    const grid = host.querySelector('[data-balances]') as AnyEl;
    grid.innerHTML = BALANCE_DEFS.map((def) => `
      <label class="balance-row">
        <span class="balance-name" title="${def.hint}">${def.label}<small>${def.hint}</small></span>
        <span class="balance-control">
          <button class="btn btn-tiny" data-balance="${def.key}" data-dir="-1" title="Decrease">&#8722;</button>
          <b data-balance-value="${def.key}">—</b>
          <button class="btn btn-tiny" data-balance="${def.key}" data-dir="1" title="Increase">&#65291;</button>
        </span>
      </label>`).join('');
  }

  // --------------------------------------------------------------- discovery

  private buildDiscoveryPanel(host: AnyEl): void {
    // The real footprint, computed from the caps rather than claimed.
    const bytes =
      REGION_COUNT + Math.ceil(CHUNK_COUNT / 8) +
      MAX_LOGGED_STRUCTURES * 4 + MAX_LOGGED_BOSSES * 24 +
      MAX_LOGGED_MARKERS * 32 + MAX_EVENT_LOG * 40 + 256;
    host.innerHTML = `
      <p class="menu-sub">The world keeps a bounded memory of what you have seen,
      so it can remember where you have been without logging a single voxel.
      Everything below is capped: the whole memory costs about
      <b>${(bytes / 1024).toFixed(1)} KB</b> however long you play.</p>
      <div class="settings-grid">
        <label class="disc-row"><span>Remember explored regions and chunks<small>The map reveals them.</small></span>
          <input type="checkbox" data-disc="discoveryOn" /></label>
        <label class="disc-row"><span>Remember structures and their positions<small>Capped at ${MAX_LOGGED_STRUCTURES}.</small></span>
          <input type="checkbox" data-disc="discoveryStructures" /></label>
        <label class="disc-row"><span>Keep the journey log<small>Newest ${MAX_EVENT_LOG} entries, oldest dropped.</small></span>
          <input type="checkbox" data-disc="discoveryEvents" /></label>
      </div>
      <div class="settings-grid">
        <label>Discovery radius<select data-set="discoverRadius">
          ${[1, 2, 3, 4, 5, 6].map((n) => `<option value="${n}">${n} chunks</option>`).join('')}
        </select></label>
        <label>Memory write throttle<select data-set="progressFlushMs">
          ${[500, 1000, 2500, 5000, 10000].map((n) => `<option value="${n}">${n} ms</option>`).join('')}
        </select></label>
      </div>
      <div class="memory-stats" data-memory></div>`;
  }

  private buildMemoryStats(): string {
    const p = this.game.progressTracker;
    if (!p) return '';
    return `
      <div class="mem-stat"><span>Regions visited</span><b>${p.visitedCount()} / ${REGION_COUNT}</b></div>
      <div class="mem-stat"><span>Surface explored</span><b>${p.explorationPercent().toFixed(1)}%</b></div>
      <div class="mem-stat"><span>Structures logged</span><b>${p.structures_().length} / ${MAX_LOGGED_STRUCTURES}</b></div>
      <div class="mem-stat"><span>Bosses defeated</span><b>${p.bossesDefeated()} / ${MAX_LOGGED_BOSSES}</b></div>
      <div class="mem-stat"><span>Markers logged</span><b>${p.markers_().length} / ${MAX_LOGGED_MARKERS}</b></div>
      <div class="mem-stat"><span>Dungeons cleared</span><b>${p.dungeonsCleared()}</b></div>
      <div class="mem-stat"><span>Quests completed</span><b>${p.questCount()}</b></div>
      <div class="mem-stat"><span>Codex read</span><b>${p.codexCount()}</b></div>
      <div class="mem-stat"><span>Serialised size</span><b>${(p.byteSize() / 1024).toFixed(1)} KB</b></div>`;
  }

  // ---------------------------------------------------------------- commit

  /** Push every setting into the game and persist the profile. */
  private commitSettings(): void {
    this.game.applySettings(this.settings);
    this.applyTouchSettings();
    this.game.persistProfile();
  }

  /** Rebuild the slider and keybind displays from the current state. */
  private populateSettings(): void {
    const screen = this.screens.get('settings');
    if (!screen) return;
    const set = (key: string, value: string | number | boolean) => {
      const node = screen.querySelector(`[data-set="${key}"]`) as HTMLInputElement | HTMLSelectElement | null;
      if (!node) return;
      if (node instanceof HTMLSelectElement) node.value = String(value);
      else if (node.type === 'checkbox') node.checked = Boolean(value);
      else node.value = String(value);
    };
    set('renderDistance', this.settings.renderDistance);
    set('volume', Math.round(this.settings.volume * 100));
    set('music', Math.round(this.settings.music * 100));
    set('sfx', Math.round(this.settings.sfx * 100));
    set('fog', this.settings.fog);
    set('musicOn', this.settings.musicOn);
    set('sfxOn', this.settings.sfxOn);
    set('discoverRadius', Math.round(this.game.balanceValue('discoverRadius')));
    set('progressFlushMs', Math.round(this.game.balanceValue('progressFlushMs')));

    for (const def of BALANCE_DEFS) {
      const node = screen.querySelector(`[data-balance-value="${def.key}"]`) as AnyEl | null;
      if (node) node.textContent = balance.format(def.key);
      const up = screen.querySelector(`[data-balance="${def.key}"][data-dir="1"]`) as AnyEl | null;
      if (up) {
        const cur = this.game.balanceValue(def.key);
        up.title = `Currently ${balance.format(def.key)} · step ${def.step}`;
        if (cur >= def.max - 1e-9) up.classList.add('at-max');
        else up.classList.remove('at-max');
      }
    }

    for (const action of Object.keys(ACTION_LABELS) as InputAction[]) {
      const node = screen.querySelector(`[data-keyfor="${action}"]`) as AnyEl | null;
      if (node) node.textContent = controls.display(action);
    }
    const conflicts = screen.querySelector('[data-conflicts]') as AnyEl | null;
    if (conflicts) {
      const list = controls.conflicts();
      conflicts.textContent = list.length
        ? `${list.length} conflicting key${list.length > 1 ? 's' : ''}: ${list.map((c) => c.actions.join('/')).join(', ')}`
        : 'No conflicts';
    }

    for (const key of ['discoveryOn', 'discoveryStructures', 'discoveryEvents'] as const) {
      const node = screen.querySelector(`[data-disc="${key}"]`) as HTMLInputElement | null;
      if (node) node.checked = Boolean(this.settings[key]);
    }

    const mem = screen.querySelector('[data-memory]') as AnyEl | null;
    if (mem) mem.innerHTML = this.buildMemoryStats();
  }

  /** Apply the touch-layer settings to the on-screen control layer. */
  applyTouchSettings(): void {
    if (!this.touchLayer) return;
    this.touchLayer.classList.toggle('look-mode', this.settings.touchLook);
    this.touchLayer.classList.toggle('auto-hide', this.settings.touchAutoHide);
    this.touchLayer.classList.toggle('touch-compact', this.settings.touchScale < 1);
    this.touchLayer.classList.toggle('touch-large', this.settings.touchScale > 1);
    this.refreshTouchPositions();
  }

  private settingsKey = 'eternity.settings.v1';

  private loadSettings(): void {
    try {
      const raw = localStorage.getItem(this.settingsKey);
      if (raw) this.settings = { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    this.settingsLoaded = true;
  }

  private saveSettings(): void {
    try { localStorage.setItem(this.settingsKey, JSON.stringify(this.settings)); } catch { /* ignore */ }
  }

  // ---------------------------------------------------------------- furnace

  /**
   * Furnace interface.
   *
   * Lists what can be smelted and what can be burned, and answers every press
   * with what actually happened. A furnace that quietly fails is the one thing
   * this screen is not allowed to be.
   */
  private buildFurnaceScreen(): AnyEl {
    const screen = div('screen menu-screen furnace-screen');
    screen.innerHTML = `
      <div class="menu-card wide">
        <h2>Furnace</h2>
        <p class="menu-sub" data-furnace="sub">—</p>
        <div class="furnace-cols">
          <div class="furnace-col">
            <h4>Smelt</h4>
            <div class="furnace-list" data-smelt></div>
          </div>
          <div class="furnace-col">
            <h4>Fuel</h4>
            <div class="furnace-list" data-fuel></div>
          </div>
        </div>
        <div class="menu-list">
          <button class="btn btn-primary" data-set="back">Close</button>
        </div>
      </div>`;
    const render = () => {
      const player = this.game.player;
      const sub = screen.querySelector('[data-furnace="sub"]') as AnyEl;
      if (!player) { sub.textContent = 'No player.'; return; }
      const fuel = player.furnaceFuel ?? 0;
      sub.textContent = `${Math.floor(fuel)}s of fuel left · ${player.hasFuel() ? 'more fuel in the inventory' : 'no fuel in the inventory'}`;

      const smelt = screen.querySelector('[data-smelt]') as AnyEl;
      const smeltables: number[] = [];
      player.state.inventory.forEach((stack, i) => {
        if (stack && isSmeltable(stack.id)) smeltables.push(i);
      });
      smelt.innerHTML = smeltables.length
        ? smeltables.map((i) => {
          const st = player.state.inventory[i];
          return `<div class="furnace-row">
            <span><b>${itemName(st!.id)}</b> x${st!.count}</span>
            <button class="btn btn-tiny" data-smelt-i="${i}">Smelt</button>
          </div>`;
        }).join('')
        : '<div class="map-note">Nothing to smelt.</div>';
      smelt.querySelectorAll('[data-smelt-i]').forEach((node) => {
        node.addEventListener('click', () => {
          this.audio().play('ui_click', 0.7);
          this.game.smeltSlot(Number((node as AnyEl).dataset.smeltI));
          render();
        });
      });

      const fuelBox = screen.querySelector('[data-fuel]') as AnyEl;
      const fuels: number[] = [];
      player.state.inventory.forEach((stack, i) => {
        if (stack && isFuel(stack.id)) fuels.push(i);
      });
      fuelBox.innerHTML = fuels.length
        ? fuels.map((i) => {
          const st = player.state.inventory[i];
          return `<div class="furnace-row">
            <span><b>${itemName(st!.id)}</b> x${st!.count}</span>
            <span class="furnace-time">${Math.round(fuelSeconds(st!.id))}s</span>
          </div>`;
        }).join('')
        : '<div class="map-note">No fuel. Coal and wood both burn.</div>';
    };
    screen.addEventListener('input', render);
    setTimeout(render, 0);
    return screen;
  }

  // -------------------------------------------------------------- enchanting

  /**
   * Enchanting interface.
   *
   * Two selections: which item to enchant, then which enchantment to apply.
   * Both lists are filtered by what is actually possible rather than by what
   * looks plausible, so a button that is guaranteed to fail never appears.
   */
  private buildEnchantScreen(): AnyEl {
    const screen = div('screen menu-screen enchant-screen');
    screen.innerHTML = `
      <div class="menu-card wide">
        <h2>Enchanting Table</h2>
        <p class="menu-sub" data-enchant="sub">—</p>
        <div class="furnace-cols">
          <div class="furnace-col">
            <h4>Item</h4>
            <div class="furnace-list" data-enchant-items></div>
          </div>
          <div class="furnace-col">
            <h4>Enchantment</h4>
            <div class="furnace-list" data-enchant-list></div>
          </div>
        </div>
        <div class="menu-list">
          <button class="btn btn-primary" data-set="back">Close</button>
        </div>
      </div>`;
    let selected = -1;
    const render = () => {
      const player = this.game.player;
      const sub = screen.querySelector('[data-enchant="sub"]') as AnyEl;
      if (!player) { sub.textContent = 'No player.'; return; }
      const power = this.game.enchantPowerAt(player.state.position[0], player.state.position[1], player.state.position[2]);
      sub.textContent = `Table level ${Math.max(1, power)} · ${player.countItem(1036)} Lapis · ${Math.floor(player.state.xp)} XP available`;

      const itemsBox = screen.querySelector('[data-enchant-items]') as AnyEl;
      const eligible: number[] = [];
      player.state.inventory.forEach((stack, i) => {
        if (stack && ENCHANTABLE_KINDS.includes(ITEMS[stack.id]?.kind || 'misc')) eligible.push(i);
      });
      // Preselect the first enchantable item: without this the pane opens on
      // "Pick an item first", which asks the player to do the obvious thing
      // before showing them anything about the obvious thing.
      if (selected < 0 && eligible.length) selected = eligible[0];
      itemsBox.innerHTML = eligible.length
        ? eligible.map((i) => {
          const st = player.state.inventory[i];
          const existing = enchantCount(st!);
          return `<div class="furnace-row ${i === selected ? 'selected' : ''}">
            <span><b>${itemName(st!.id)}</b> x${st!.count}${existing ? ` · ${existing} levels` : ''}</span>
          </div>`;
        }).join('')
        : '<div class="map-note">No enchantable item. Tools, weapons and armour only.</div>';
      itemsBox.querySelectorAll('.furnace-row').forEach((node, idx) => {
        node.addEventListener('click', () => { selected = eligible[idx]; render(); });
      });

      const listBox = screen.querySelector('[data-enchant-list]') as AnyEl;
      const stack = selected >= 0 ? player.state.inventory[selected] : null;
      const itemKind = stack ? (ITEMS[stack.id]?.kind || 'misc') : 'misc';
      const rows = ENCHANTS
        .filter((e) => e.kinds.includes(itemKind as never))
        .filter((e) => !hasEnchant(stack || { }, e.id))
        .map((e) => {
          const level = Math.max(1, Math.min(e.maxLevel, power));
          const cost = enchantCost(e.id, level);
          const affordable = player.state.xp >= cost && player.countItem(1036) >= 1;
          return `<div class="furnace-row">
            <span><b>${e.name} ${level}</b><small>${e.description}</small></span>
            <button class="btn btn-tiny ${affordable ? '' : 'disabled'}" data-enchant-id="${e.id}">
              ${cost} Lv${affordable ? '' : ' ✗'}
            </button>
          </div>`;
        });
      listBox.innerHTML = stack
        ? (rows.length ? rows.join('') : '<div class="map-note">This item has every applicable enchantment.</div>')
        : '<div class="map-note">Pick an item first.</div>';
      listBox.querySelectorAll('[data-enchant-id]').forEach((node) => {
        node.addEventListener('click', () => {
          if (selected < 0) return;
          this.audio().play('ui_click', 0.7);
          this.game.enchantSlot(selected, (node as AnyEl).dataset.enchantId!, 1);
          render();
        });
      });
    };
    screen.addEventListener('input', render);
    setTimeout(render, 0);
    return screen;
  }

  // ---------------------------------------------------------------- save screen

  private buildSaveScreen(): AnyEl {
    const screen = div('screen menu-screen save-screen');
    screen.innerHTML = `
      <div class="menu-card wide">
        <h2>Save Slots</h2>
        <p class="menu-sub">Six slots, each encrypted with AES-256-GCM and a per-slot key.</p>
        <div class="save-grid" data-saves></div>
        <div class="menu-list">
          <button class="btn btn-primary" data-save="back">Done</button>
          <button class="btn btn-danger" data-save="wipe">Wipe All</button>
        </div>
      </div>`;
    const refresh = async () => {
      const grid = screen.querySelector('[data-saves]') as AnyEl;
      const list = await this.game.listSaves();
      grid.innerHTML = list.map((m) => `
        <div class="save-card ${m ? 'filled' : 'empty'}">
          <div class="save-slot-no">Slot ${m.index + 1}</div>
          ${m ? `<div class="save-info">
            <b>${m.name}</b>
            <span>Lv. ${m.level} · ${m.timestamp ? new Date(m.timestamp).toLocaleString() : ''}</span>
            <span>${m.world} · ${Math.floor((m.playTime || 0) / 60)}m played · ${(m.size / 1024).toFixed(1)} KB</span>
          </div>
          <div class="save-actions">
            <button data-save-act="load" data-slot="${m.index}">Load</button>
            <button data-save-act="overwrite" data-slot="${m.index}">Overwrite</button>
            <button data-save-act="delete" data-slot="${m.index}">Delete</button>
          </div>` : `<div class="save-info"><b>Empty slot</b><span>Press Save Here to write to this slot.</span></div>
          <div class="save-actions"><button data-save-act="overwrite" data-slot="${m.index}">Save Here</button></div>`}
        </div>`).join('');
    };
    screen.addEventListener('click', async (e) => {
      const btn = (e.target as AnyEl).closest('[data-save-act], [data-save]') as AnyEl | null;
      if (!btn) return;
      this.audio().play('ui_click', 0.7);
      const act = btn.dataset.saveAct;
      if (act === 'load') {
        const slot = Number(btn.dataset.slot);
        await this.game.loadSlot(slot);
        this.setPlaying(true);
        this.game.popOverlay();
        this.hideAllOverlays();
      } else if (act === 'overwrite') {
        const slot = Number(btn.dataset.slot);
        const ok = await this.game.saveSlot(slot);
        if (ok) await refresh();
      } else if (act === 'delete') {
        const slot = Number(btn.dataset.slot);
        await this.game.deleteSlot(slot);
        await refresh();
      } else if (btn.dataset.save === 'back') this.game.popOverlay();
      else if (btn.dataset.save === 'wipe') {
        for (let i = 0; i < SAVE_SLOTS; i++) await this.game.deleteSlot(i);
        await refresh();
      }
    });
    void refresh();
    return screen;
  }

  // ---------------------------------------------------------------- fullscreen

  setFullscreen(on: boolean): void {
    this.root.classList.toggle('fullscreen', on);
  }

  // ---------------------------------------------------------------- misc

  toast(text: string, color = 0xffffff, ms = 2400): void {
    const node = div('toast', text);
    node.style.borderColor = hex(color);
    node.style.color = hex(color);
    this.toastLayer.append(node);
    const entry = { el: node, left: ms, color: hex(color) };
    this.toasts.push(entry);
    this.tickToasts(ms);
  }

  private tickToasts(dt: number): void {
    for (let i = this.toasts.length - 1; i >= 0; i--) {
      const t = this.toasts[i];
      t.left -= dt;
      if (t.left <= 0) {
        t.el.remove();
        this.toasts.splice(i, 1);
      }
    }
  }

  setInteract(p: { text: string; action: string } | null): void {
    if (!this.interactEl) return;
    this.interactEl.textContent = p ? p.text : '';
    this.interactEl.style.display = p ? 'block' : 'none';
  }

  setMusic(id: string): void {
    this.musicLabel = id;
  }

  setStatus(text: string): void {
    const node = this.root.querySelector('[data-status]') as AnyEl | null;
    if (node) node.textContent = text;
  }

  setWorldInfo(world: World): void {
    this.setStatus(`${world.statistics().columns} columns · ${world.statistics().voxels.toLocaleString()} voxels · ${REGIONS.length} regions`);
  }

  get hudSnapshot(): HudSnapshot | null { return this.hud; }

  audio() { return this.game.audio; }

  /** Called from the game loop to run cheap per-frame UI maintenance. */
  tick(dt: number): void {
    if (this.minimapDirty && this.hud && this.game.scene_) {
      this.drawMinimap();
      this.minimapDirty = false;
    }
    this.tickToasts(dt);
    this.hintTimer -= dt;
    if (this.hud && this.hud.interact && this.hintTimer <= 0) {
      this.hintTimer = 0.3;
    }
    if (this.titleScreen.style.display !== 'none') this.animateTitle(dt);
  }

  /** Force the minimap to redraw. */
  requestMinimap(): void { this.minimapDirty = true; }
}

/**
 * Normalize a physical key the way the engine does, so a key captured by the
 * remap editor is stored in the same shape the input layer produces. Keeping
 * the two in sync is what makes a remapped key actually reach the game.
 */
function normalizeKeyEvent(raw: string): string {
  const lower = raw.length === 1 ? raw.toLowerCase() : raw.toLowerCase();
  if (lower === ' ' || lower === 'spacebar') return 'space';
  if (lower === 'arrowup' || lower === 'arrowdown' || lower === 'arrowleft' || lower === 'arrowright') return lower;
  if (lower === 'escape') return 'escape';
  if (lower === 'enter') return 'enter';
  if (lower === 'delete') return 'backspace';
  return lower;
}
