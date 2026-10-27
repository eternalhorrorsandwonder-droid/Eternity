/**
 * The game scene.
 *
 * Everything the player sees and does inside a run lives here: the renderer,
 * the chunk streaming, the entity list, mining and placing, and combat
 * resolution. It owns no UI and no save state — it reports through a small
 * callback interface and reads player state back, which keeps it runnable
 * headless for tests.
 *
 * Streaming is deliberately simple: every frame the scene asks the renderer to
 * (re)mesh a shell of chunks around the player, and the renderer's governor
 * decides how many of them to actually build. Chunks are cheap to keep because
 * the world is one flat `Uint16Array` — a chunk is just an offset into it.
 */

import * as THREE from 'three';
import { World, WORLD_W, WORLD_D, WORLD_H, BOSS_ARENA_CELLS } from '../../engine/render/World';
import { balance } from '../config/Balance';
import { ProgressTracker } from '../systems/Progress';
import { WorldRenderer, WorldMaterials } from '../../engine/render/WorldRenderer';
import { TextureAtlas } from '../../engine/render/TextureAtlas';
import { PlayerModel } from '../../engine/render/PlayerModel';
import { ParticleSystem } from '../../engine/render/Particles';
import { Atmosphere } from '../../engine/render/Atmosphere';
import { CameraRig } from '../../engine/render/CameraRig';
import { AudioEngine } from '../../engine/audio/AudioEngine';
import { MusicEngine } from '../../engine/audio/MusicEngine';
import { Input } from '../../engine/core/Input';
import { RNG } from '../../engine/core/RNG';
import { boxFrom, type AABB, type VoxelGrid } from '../../engine/core/Collision';
import { TILE_BY_ID, TILE_VARIANTS, initTileTables, syncColliderFlags } from '../data/Tiles';
import { ITEMS, itemName } from '../data/Items';
import { resolveEnemy } from '../data/Enemies';
import { regionAt, biomeOfRegion, REGION_BY_ID } from '../data/Regions';
import { DUNGEON_BY_ID, DUNGEONS } from '../data/Dungeons';
import { STRUCTURE_BY_ID } from '../data/Structures';
import { BIOME_AMBIENT, TRACK_BY_ID } from '../data/Music';
import { QUEST_BY_ID } from '../data/Quests';
import { SKILL_BY_ID } from '../data/Skills';
import { Enemy, type EnemySpawn } from '../entities/Enemy';
import { Player, type PlayerInput, type PlayerState } from '../entities/Player';
import { Spawner } from '../systems/Spawner';

export const CHUNK_W = 16;
export const CHUNK_H = 32;
export const CHUNK_D = 16;

export interface HudSnapshot {
  health: number; maxHealth: number;
  mana: number; maxMana: number;
  stamina: number; hunger: number;
  level: number; xp: number; xpNeeded: number; xpText: string;
  regionName: string; biomeName: string; biomeId: string;
  coordinates: { x: number; y: number; z: number };
  armor: number; damage: number; crit: number; dodge: number; speed: number;
  hotbar: { id: number; count: number; selected: boolean }[];
  activeSkills: { id: string; name: string; level: number; ready: boolean }[];
  activeQuests: { id: string; name: string; ready: boolean }[];
  objectives: { text: string; have: number; need: number; done: boolean }[];
  dungeon: string | null;
  boss: string | null;
  bossHealth: number | null;
  nearby: { name: string; distance: number; quest: string | null; kind: string }[];
  fps: number;
  chunkCount: number;
  triangles: number;
  playtime: number;
  /** Percentage of the world's surface chunks the player has been near. */
  exploration: number;
  /** Regions visited / total, for the map and the HUD. */
  regionsVisited: number;
  interact: string | null;
}

export interface GameMessage {
  text: string;
  color: number;
  kind: 'info' | 'quest' | 'achievement' | 'damage' | 'system' | 'rare';
  life: number;
}

export interface GameSceneCallbacks {
  onHud(hud: HudSnapshot): void;
  onMessage(msg: GameMessage): void;
  onDeath(cause: string): void;
  onMusic(trackId: string): void;
  onSave(): void;
  onLoad(): void;
  onPauseChange(paused: boolean): void;
  onInteract(prompt: { text: string; action: string } | null): void;
  /** Open the furnace interface, when a furnace is in reach. */
  onFurnace?(): void;
  /** Open the enchanting interface, when a table is in reach. */
  onEnchant?(): void;
}

export interface GameSceneOptions {
  dungeon?: string | null;
  arena?: string | null;
  worldSeed?: number;
  /** The session's shared world memory, owned by the game. */
  progress?: ProgressTracker;
}

/** A hit on a voxel: the cell and the face it was entered from. */
export interface VoxelHit { x: number; y: number; z: number; nx: number; ny: number; nz: number; }

export class GameScene {
  world: World;
  player: Player;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(62, 16 / 9, 0.5, 1200);
  private renderer: THREE.WebGLRenderer;
  private atlas: TextureAtlas;
  private materials: WorldMaterials;
  private worldRenderer: WorldRenderer;
  private particles: ParticleSystem;
  private atmosphere: Atmosphere;
  private playerModel: PlayerModel;
  private audio: AudioEngine;
  private music: MusicEngine;

  /** The music engine, so the UI can switch tracks. */
  get musicEngine(): MusicEngine { return this.music; }
  private input: Input;
  private callbacks: GameSceneCallbacks;
  private spawner: Spawner;
  /** Everything the world remembers about this player. */
  progress: ProgressTracker;
  private rig = new CameraRig();
  private rng = new RNG(20260101);
  private enemies: Enemy[] = [];
  private enemyMeshes = new Map<string, THREE.Object3D>();
  private spawnAccumulator = 0;
  private lastPlayerChunk = { x: -99, y: -99, z: -99 };
  private streamRadius = 5;
  private fps = 60;
  private frameTime = 16;
  private playtime = 0;
  private dungeon: string | null = null;
  private dungeonOrigin = { x: 0, z: 0 };
  private arenaActive = false;
  private arenaId = '';
  private messages: GameMessage[] = [];
  private hudTimer = 0;
  private lastHud: HudSnapshot | null = null;
  private currentTrack = '';
  private hitFlash = 0;
  private deathTimer = 0;
  private dead = false;
  private cause = '';
  private interactTarget: { text: string; action: string } | null = null;
  private markerTimer = 0;
  private markers: { id: string; name: string; x: number; z: number; color: number; distance: number; quest: string | null; kind: string }[] = [];
  private biomeTimer = 0;
  private belowFade = 0;
  private shake = 0;
  private fallingBlocks: THREE.Mesh[] = [];
  private disposed = false;
  /** Whether the world is recording what the player has seen. */
  discoveryEnabled = true;
  private ambient: THREE.AmbientLight;
  private hemi: THREE.HemisphereLight;
  private dirLight: THREE.DirectionalLight;
  private water: THREE.Mesh;
  private inputState: PlayerInput = {
    forward: 0, back: 0, left: 0, right: 0,
    jump: false, sprint: false, sneak: false, attack: false,
    active1: false, active2: false, active3: false, active4: false,
    dash: false, interact: false,
  };

  constructor(
    world: World,
    playerState: PlayerState,
    audio: AudioEngine,
    music: MusicEngine,
    input: Input,
    callbacks: GameSceneCallbacks,
    options: GameSceneOptions = {},
  ) {
    this.world = world;
    this.player = new Player(playerState);
    this.audio = audio;
    this.music = music;
    this.input = input;
    this.callbacks = callbacks;
    this.spawner = new Spawner(world);
    this.progress = options.progress ?? new ProgressTracker();
    this.dungeon = options.dungeon ?? null;
    this.arenaId = options.arena ?? '';

    const host = document.createElement('div');
    host.className = 'game-canvas-host';
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    host.appendChild(this.renderer.domElement);
    this.hostElement = host;

    // ---------------------------------------------------------------- atlas
    this.atlas = new TextureAtlas();
    initTileTables();
    syncColliderFlags();
    const specs = TILE_BY_ID.filter((t): t is NonNullable<typeof t> => !!t && t.id > 0);
    this.atlas.build(specs, TILE_VARIANTS);

    this.materials = new WorldMaterials(this.atlas);
    // The world *is* a tile source: `get(x, y, z)` answers every query the
    // mesher makes, so no second voxel array is needed.
    this.worldRenderer = new WorldRenderer(this.scene, world, this.materials, this.atlas);
    this.worldRenderer.renderDistance = this.streamRadius;
    this.worldRenderer.minRenderDistance = Math.max(2, this.streamRadius - 2);
    this.worldRenderer.maxRenderDistance = this.streamRadius + 1;
    // Wire the tile tables the mesher reads: glow and variant indices are
    // indexed by tile id, so they are built from the registry directly.
    const glow = new Float32Array(1024);
    const variants = new Int32Array(1024);
    for (let i = 0; i < TILE_BY_ID.length; i++) {
      const d = TILE_BY_ID[i];
      if (!d) continue;
      glow[i] = d.glow ?? 0;
      variants[i] = Math.max(1, Math.min(3, d.variant ?? 1));
    }
    this.worldRenderer.setVariantDefs(Array.from(variants));
    this.worldRenderer.setGlowTable(glow);

    // ---------------------------------------------------------------- lights
    this.ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(this.ambient);
    this.hemi = new THREE.HemisphereLight(0xbfe0ff, 0x4a4030, 0.5);
    this.scene.add(this.hemi);
    this.dirLight = new THREE.DirectionalLight(0xfff2d8, 1.05);
    this.dirLight.position.set(60, 110, 40);
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    this.scene.fog = new THREE.Fog(0x9fd0ff, 40, 160);
    this.scene.background = new THREE.Color(0x9fd0ff);

    this.particles = new ParticleSystem(this.scene);
    this.atmosphere = new Atmosphere(this.scene, this.particles);
    this.atmosphere.setWeather('none', 0);

        this.playerModel = new PlayerModel({
      skin: this.materials.opaque, cloth: this.materials.opaque, pants: this.materials.opaque,
      boots: this.materials.opaque, hair: this.materials.opaque, sword: this.materials.opaque,
    });
    this.scene.add(this.playerModel.root);

    const waterGeo = new THREE.PlaneGeometry(WORLD_W, WORLD_D, 1, 1);
    waterGeo.rotateX(-Math.PI / 2);
    this.water = new THREE.Mesh(waterGeo, new THREE.MeshStandardMaterial({
      color: 0x2a6fd0, transparent: true, opacity: 0.72, roughness: 0.18, metalness: 0.05,
    }));
    this.water.position.y = 62;
    this.water.renderOrder = -1;
    this.scene.add(this.water);

    // ---------------------------------------------------------------- spawn
    if (this.arenaId) {
      this.enterArena(this.arenaId);
    } else if (this.dungeon) {
      this.enterDungeon(this.dungeon);
    } else {
      const sp = world.spawnPosition();
      this.player.pos = { x: sp.x, y: sp.y, z: sp.z };
      this.player.state.position = [sp.x, sp.y, sp.z];
      this.player.state.visitedRegions = [world.startRegion.id];
    }
    this.updateBiome(99);
    this.audio.play('ui_open', 0.5);
    this.hudDirty = true;
  }

  private hostElement: HTMLElement;
  private hudDirty = false;

  /** The canvas element the renderer drew into. */
  get canvas(): HTMLCanvasElement { return this.renderer.domElement; }

  /** The host element holding the canvas, ready to append to the page. */
  get host(): HTMLElement { return this.hostElement; }

  /** Attach the canvas to a container and size the renderer to it. */
  attach(container: HTMLElement): void {
    container.appendChild(this.hostElement);
    const w = container.clientWidth || 1280;
    const h = container.clientHeight || 720;
    this.resize(w, h);
  }

  /** Render a frame without advancing the simulation (behind a menu). */
  renderOnly(dt: number): void {
    this.atmosphere.update(dt, this.camera.position);
    this.atmosphere.tickWeather(dt);
    this.particles.update(dt);
    this.applyShake(dt);
    this.updateFallingBlocks(dt);
    this.worldRenderer.update(this.player.pos.x, this.player.pos.y, this.player.pos.z, 4);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();
  }

  /** Change the streaming radius at runtime. */
  setRenderDistance(r: number): void {
    this.streamRadius = Math.max(2, Math.min(9, Math.round(r)));
    this.worldRenderer.renderDistance = this.streamRadius;
    this.worldRenderer.minRenderDistance = Math.max(2, this.streamRadius - 2);
    this.worldRenderer.maxRenderDistance = this.streamRadius + 1;
    this.stream(true);
  }

  /** Toggle scene fog on and off. */
  setFog(on: boolean): void {
    this.scene.fog = on ? new THREE.Fog(0x9fd0ff, 34, 150) : null;
  }

  /** Force the HUD to refresh on the next frame. */
  requestHud(): void { this.hudDirty = true; }

  // ------------------------------------------------------- world memory

  /** Seconds since the last slow, expensive memory sweep. */
  private memoryTimer = 0;
  /** Exploration percentage, recomputed at the memory throttle. */
  private explorationPct = 0;

  /**
   * Keep the world's memory of the player up to date.
   *
   * Two rates, because the two kinds of fact have different costs. Exploration
   * is coarse and cheap enough to do every frame: one bitmask write per
   * chunk in a small box around the player and one byte for the region. The
   * slow sweep that recomputes a percentage and re-reads the structure list
   * is throttled, because it is the kind of thing that shows up as a frame
   * drop if it runs unguarded.
   */
  private tickWorldMemory(dt: number): void {
    if (!this.discoveryEnabled) return;
    const p = this.player.pos;
    const r = Math.max(1, Math.round(balance.get('discoverRadius')));
    const cx = Math.floor(p.x / 16) * 16;
    const cz = Math.floor(p.z / 16) * 16;
    for (let dx = -r; dx <= r; dx++) {
      for (let dz = -r; dz <= r; dz++) {
        this.progress.discover(cx + dx * 16, cz + dz * 16);
      }
    }
    const region = this.world.regionIdAt(Math.floor(p.x), Math.floor(p.z));
    if (region > 0) this.progress.visitRegion(region);

    this.memoryTimer += dt;
    const flush = Math.max(0.5, balance.get('progressFlushMs') / 1000);
    if (this.memoryTimer < flush) return;
    this.memoryTimer = 0;
    this.explorationPct = this.progress.explorationPercent();
    this.rememberNearbyStructures();
    this.markNearbyMarkers();
  }

  /**
   * Record the structures within earshot.
   *
   * The world's structure list is a few hundred entries, so a linear scan on
   * a one-second timer is free, and it means the map gains a landmark the
   * moment the player walks towards it rather than only when they stand on it.
   */
  private rememberNearbyStructures(): void {
    const p = this.player.pos;
    const reach = 64;
    for (const placed of this.world.placedStructures) {
      if (Math.abs(placed.x - p.x) > reach || Math.abs(placed.z - p.z) > reach) continue;
      const def = STRUCTURE_BY_ID.get(placed.id);
      this.progress.rememberStructure({
        id: placed.id,
        name: def?.name || placed.id,
        x: placed.x, y: placed.y, z: placed.z, region: placed.region,
      }, false);
    }
  }

  /** Record dungeon mouths and arenas the player has come within sight of. */
  private markNearbyMarkers(): void {
    const p = this.player.pos;
    const reach = 48;
    for (const d of DUNGEONS) {
      const entry = this.world.dungeonEntrance(d.id);
      if (!entry) continue;
      if (Math.abs(entry.x - p.x) > reach || Math.abs(entry.z - p.z) > reach) continue;
      this.progress.rememberMarker({
        id: `dungeon_${d.id}`, name: d.name, x: entry.x, z: entry.z,
        region: this.world.regionIdAt(Math.floor(entry.x), Math.floor(entry.z)),
        kind: 'dungeon',
      }, true);
    }
    if (this.arenaActive && this.arenaId) {
      const cells = BOSS_ARENA_CELLS[this.arenaId] || [[6, 10]];
      const [gx, gz] = cells[0];
      this.progress.rememberMarker({
        id: `arena_${this.arenaId}`, name: this.arenaId,
        x: gx * 32 + 16, z: gz * 32 + 16,
        region: this.world.regionIdAt(gx * 32 + 16, gz * 32 + 16),
        kind: 'arena',
      }, true);
    }
  }

  /** Turn world-memory recording on or off, for players chasing frames. */
  setDiscoveryEnabled(on: boolean): void { this.discoveryEnabled = on; }

  /** Current exploration percentage, for the HUD and the map. */
  get exploredPercent(): number { return this.explorationPct; }

  /** Current streaming radius, for the settings screen. */
  get renderDistanceSetting(): number { return this.streamRadius; }

  resize(w: number, h: number): void {
    this.camera.aspect = Math.max(0.5, w / Math.max(1, h));
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }

  // ---------------------------------------------------------------- lifecycle

  begin(): void {
    this.stream(true);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    // Detach the whole DOM subtree, otherwise a second scene appended to the
    // same container stacks its canvas on top of the dead one.
    this.hostElement.remove();
    this.input.detach();
    this.particles.clear();
    for (const mesh of this.enemyMeshes.values()) this.scene.remove(mesh);
    this.enemyMeshes.clear();
    this.enemies = [];
    this.markers = [];
    this.messages = [];
    this.worldRenderer.disposeAll();
    this.materials.dispose();
    this.audio.play('ui_back', 0.4);
    this.renderer.dispose();
  }

  /** Advance and draw one frame. `dt` is seconds, already clamped. */
  frame(dt: number): void {
    this.frameTime = this.frameTime * 0.9 + dt * 1000 * 0.1;
    this.fps = 1000 / Math.max(1, this.frameTime);

    if (this.dead) {
      this.deathTimer += dt;
      this.updateFallingBlocks(dt);
      this.particles.update(dt);
      this.rendererWorldTick(dt);
      this.renderer.render(this.scene, this.camera);
      if (this.deathTimer > 1.2) this.callbacks.onDeath(this.cause);
      return;
    }

    this.update(dt);
    this.tickWorldMemory(dt);
    this.worldRenderer.update(this.player.pos.x, this.player.pos.y, this.player.pos.z, Math.max(8, this.frameTime * 0.6));
    this.atmosphere.update(dt, this.camera.position);
    this.atmosphere.tickWeather(dt);
    this.particles.update(dt);
    this.updateWater(dt);
    this.updateFallingBlocks(dt);
    this.applyShake(dt);
    this.renderer.render(this.scene, this.camera);
    this.input.endFrame();

    this.hudTimer -= dt;
    if (this.hudDirty || this.hudTimer <= 0) {
      this.hudTimer = 0.12;
      this.hudDirty = false;
      this.callbacks.onHud(this.snapshot());
    }
    this.flushMessages(dt);
  }

  private rendererWorldTick(dt: number): void {
    this.particles.update(dt);
    void dt;
  }

  // ---------------------------------------------------------------- update

  private update(dt: number): void {
    this.playtime += dt;
    this.player.state.playtime = this.playtime;
    this.player.updateResources(dt);
    this.player.tickEffects(dt);
    this.player.tickCooldowns(dt);
    this.handleHotbar();
    this.readInput();
    this.handleCamera();
    this.handleMining();
    this.handleInteraction();
    this.player.move(dt, this.inputState, this.world);
    this.player.updateSwing(dt);
    this.resolveAttacks();
    this.updateEnemies(dt);
    this.spawnAround();
    this.stream(false);
    this.updateMarkers(dt);
    this.updateBiome(dt);
    if (this.hitFlash > 0) this.hitFlash = Math.max(0, this.hitFlash - dt);
  }

  private handleHotbar(): void {
    const i = this.input;
    if (i.keyPressed('digit1')) this.player.setHotbar(0);
    if (i.keyPressed('digit2')) this.player.setHotbar(1);
    if (i.keyPressed('digit3')) this.player.setHotbar(2);
    if (i.keyPressed('digit4')) this.player.setHotbar(3);
    if (i.keyPressed('digit5')) this.player.setHotbar(4);
    if (i.keyPressed('digit6')) this.player.setHotbar(5);
    if (i.keyPressed('digit7')) this.player.setHotbar(6);
    if (i.keyPressed('digit8')) this.player.setHotbar(7);
    if (i.keyPressed('digit9')) this.player.setHotbar(8);
    if (i.mouse.wheel) {
      this.player.cycleHotbar(i.mouse.wheel > 0 ? 1 : -1);
      i.mouse.wheel = 0;
    }
  }

  private readInput(): void {
    const i = this.input;
    const s = this.inputState;
    s.forward = i.moveY;
    s.back = -i.moveY;
    s.left = -i.moveX;
    s.right = i.moveX;
    s.jump = i.key('space');
    s.sprint = i.key('shift') || i.btnSprint2;
    s.sneak = i.key('ctrl');
    s.attack = i.mouse.down || i.key('j');
    s.dash = i.key('space') && i.key('shift');
    s.active1 = i.btnSkill1;
    s.active2 = i.btnSkill2;
    s.active3 = i.btnSkill3;
    s.active4 = i.btnSkill4;
    s.interact = i.keyPressed('e');
    if (i.btnHotbarLeft) this.player.cycleHotbar(-1);
    if (i.btnHotbarRight) this.player.cycleHotbar(1);
    if (i.btnSprint2) this.inputState.sprint = true;
  }

  private handleCamera(): void {
    const i = this.input;
    i.lookDX *= 0.0024;
    i.lookDY *= 0.0024;
    this.player.yaw += i.lookDX * 0.5;
    this.player.pitch = Math.max(-0.15, Math.min(1.2, this.player.pitch + i.lookDY * 0.5));
    i.lookDX = 0;
    i.lookDY = 0;

    this.rig.yaw = this.player.yaw;
    this.rig.pitch = this.player.pitch;
    this.rig.target.set(this.player.pos.x, this.player.pos.y + 1.1, this.player.pos.z);
    this.rig.update(1 / 60, this.world as unknown as VoxelGrid);
    const pos = this.rig.position.clone();
    if (this.shake > 0) {
      pos.x += (Math.random() - 0.5) * this.shake;
      pos.y += (Math.random() - 0.5) * this.shake;
      pos.z += (Math.random() - 0.5) * this.shake;
    }
    this.camera.position.copy(pos);
    this.camera.lookAt(this.rig.target);
  }

  private applyShake(dt: number): void {
    if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 3.2);
  }

  // ---------------------------------------------------------------- mining

  /** March a ray through the world and return the first solid cell it hits. */
  raycastTile(from: THREE.Vector3, dir: THREE.Vector3, maxDist: number): VoxelHit | null {
    const fx = from.x, fy = from.y, fz = from.z;
    let x = Math.floor(fx), y = Math.floor(fy), z = Math.floor(fz);
    const stepX = dir.x >= 0 ? 1 : -1;
    const stepY = dir.y >= 0 ? 1 : -1;
    const stepZ = dir.z >= 0 ? 1 : -1;
    const tDX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
    const tDY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
    const tDZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;
    let tMX = dir.x !== 0 ? ((stepX > 0 ? x + 1 - fx : x - fx) / dir.x) : Infinity;
    let tMY = dir.y !== 0 ? ((stepY > 0 ? y + 1 - fy : y - fy) / dir.y) : Infinity;
    let tMZ = dir.z !== 0 ? ((stepZ > 0 ? z + 1 - fz : z - fz) / dir.z) : Infinity;
    let t = 0;
    let lx = 0, ly = 0, lz = 0;
    const eps = 1e-4;
    while (t < maxDist) {
      if (tMX < tMY && tMX < tMZ) { lx = -stepX; x += stepX; t = tMX; tMX += tDX; }
      else if (tMY < tMZ) { ly = -stepY; y += stepY; t = tMY; tMY += tDY; }
      else { lz = -stepZ; z += stepZ; t = tMZ; tMZ += tDZ; }
      if (x < 0 || y < 0 || z < 0 || x >= WORLD_W || y >= WORLD_H || z >= WORLD_D) return null;
      if (this.world.get(x, y, z) !== 0) return { x, y, z, nx: lx, ny: ly, nz: lz };
      void eps;
    }
    return null;
  }

  private handleMining(): void {
    const i = this.input;
    const held = this.player.heldItem();
    if (!held) return;
    const def = ITEMS[held.id];
    if (!def) return;

    const dir = this.camera.getWorldDirection(new THREE.Vector3());
    const hit = this.raycastTile(this.camera.position.clone().add(dir.clone().multiplyScalar(0.6)), dir, 6.5);
    if (!hit) return;

    if (i.mouse.down && def.kind === 'tool') {
      this.breakBlock(hit.x, hit.y, hit.z);
    } else if (i.key('alt') && def.kind === 'material') {
      this.placeBlock(hit.x, hit.y, hit.z, hit.nx, hit.ny, hit.nz, def);
    }
  }

  /** Damage a tile until it breaks. */
  breakBlock(x: number, y: number, z: number): void {
    const id = this.world.get(x, y, z);
    if (id === 0) return;
    const tile = TILE_BY_ID[id];
    if (!tile) return;

    const held = this.player.heldItem();
    const def = held ? ITEMS[held.id] : null;
    const harvest = def && def.kind === 'tool' ? (def.harvest || 0) : 0;
    if (harvest < tile.harvest) {
      // Wrong tool: the block cracks but does not break.
      if (Math.random() < 0.2) {
        this.particles.burst(0, 0, 0, 1, this.rgb(0xffffff), {});
        this.audio.play('hit_metal', 0.4);
      }
      return;
    }

    this.world.set(x, y, z, 0);
    this.worldRenderer.markDirty(Math.floor(x / CHUNK_W), Math.floor(y / CHUNK_H), Math.floor(z / CHUNK_D));
    this.particles.burst(0, 0, 0, 1, this.rgb(0xffffff), {});
    this.audio.play('break_block', 0.9);
    this.spawnFallingBlock(x, y, z, this.tileColor(id));

    const drop = tile.drop;
    if (drop > 0) {
      const amount = 1 + Math.floor(Math.random() * 3);
      if (!this.player.addItem(drop, amount)) {
        this.messages.push({ text: 'Inventory is full.', color: 0xe05050, kind: 'system', life: 1.6 });
      } else {
        this.messages.push({ text: `+${itemName(drop)} x${amount}`, color: 0xffffff, kind: 'info', life: 0.9 });
      }
    }
    this.player.bump('blocksMined', 1);
    this.player.progressQuest('gather', String(tile.id), 1);
    this.player.bumpAchievements();
    this.audio.play('pickup', 0.5);
  }

  /** A rough colour for a tile, used for particles and falling blocks. */
  /** Colour integer -> normalised RGB triple, for the particle system. */
  private rgb(c: number): [number, number, number] {
    return [((c >> 16) & 255) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
  }

  private tileColor(id: number): number {
    const def = ITEMS[id];
    if (def && def.color) return def.color;
    const tile = TILE_BY_ID[id];
    return tile ? (tile.base ? 0x888888 : 0x9a9a9a) : 0x888888;
  }

  /** Put a block against a face, if the slot holds a placeable tile. */
  placeBlock(x: number, y: number, z: number, nx: number, ny: number, nz: number, def: (typeof ITEMS)[number]): void {
    const bx = x + nx, by = y + ny, bz = z + nz;
    if (this.world.get(bx, by, bz) !== 0) return;
    if (Math.abs(this.player.pos.x - (bx + 0.5)) < 1.1 &&
        Math.abs(this.player.pos.z - (bz + 0.5)) < 1.1 &&
        Math.abs(this.player.pos.y - (by + 0.5)) < 1.7) return;
    this.world.set(bx, by, bz, def.id);
    this.worldRenderer.markDirty(Math.floor(bx / CHUNK_W), Math.floor(by / CHUNK_H), Math.floor(bz / CHUNK_D));
    this.player.removeItem(def.id, 1);
    this.audio.play('place_block', 0.7);
    this.particles.burst(0, 0, 0, 1, this.rgb(0xffffff), {});
  }

  /** A block that pops out when broken, for the satisfying drop. */
  private spawnFallingBlock(x: number, y: number, z: number, color: number): void {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(0.86, 0.86, 0.86),
      new THREE.MeshStandardMaterial({ color, roughness: 0.8 }),
    );
    mesh.position.set(x + 0.5, y + 0.5, z + 0.5);
    mesh.userData.vel = { x: (Math.random() - 0.5) * 1.4, y: 3.2, z: (Math.random() - 0.5) * 1.4 };
    mesh.userData.life = 3;
    this.scene.add(mesh);
    this.fallingBlocks.push(mesh);
  }

  private updateFallingBlocks(dt: number): void {
    for (let i = this.fallingBlocks.length - 1; i >= 0; i--) {
      const m = this.fallingBlocks[i];
      const v = m.userData.vel as { x: number; y: number; z: number };
      v.y -= 22 * dt;
      m.position.x += v.x * dt;
      m.position.y += v.y * dt;
      m.position.z += v.z * dt;
      m.rotation.x += dt * 2;
      m.rotation.z += dt * 1.4;
      m.userData.life -= dt;
      const ground = this.world.surfaceHeight(Math.floor(m.position.x), Math.floor(m.position.z));
      if (m.position.y < ground + 0.5 || m.userData.life <= 0) {
        this.scene.remove(m);
        (m.geometry as THREE.BufferGeometry).dispose();
        (m.material as THREE.Material).dispose();
        this.fallingBlocks.splice(i, 1);
      }
    }
  }

  // ---------------------------------------------------------------- interaction

  private handleInteraction(): void {
    const prompt = this.nearestInteraction();
    if (prompt && this.input.actionPressed('interact')) {
      this.interactTarget = null;
      this.doInteraction(prompt);
      return;
    }
    this.interactTarget = prompt;
    if (prompt !== this.lastInteract) {
      this.lastInteract = prompt;
      this.callbacks.onInteract(prompt ? { text: prompt.text, action: prompt.action } : null);
    }
  }

  private lastInteract: { text: string; action: string } | null = null;

  /** What is close enough to interact with right now. */
  private nearestInteraction(): { text: string; action: string } | null {
    const p = this.player.pos;
    for (let dx = -3; dx <= 3; dx++) {
      for (let dy = -3; dy <= 3; dy++) {
        for (let dz = -3; dz <= 3; dz++) {
          const id = this.world.get(Math.floor(p.x + dx), Math.floor(p.y + 1 + dy), Math.floor(p.z + dz));
          if (id === 0) continue;
          if (id === 103) return { text: 'Open Chest', action: 'chest' };
          if (id === 111) return { text: 'Craft', action: 'craft' };
          if (id === 108) return { text: 'Use Furnace', action: 'furnace' };
          if (id === 112) return { text: 'Enchant', action: 'enchant' };
        }
      }
    }
    const reg = regionAt(p.x, p.z);
    const available = this.player.availableQuests().filter((q) => QUEST_BY_ID.get(q)?.region === reg.id);
    if (available.length && Math.hypot(p.x - (reg.gx * 32 + 16), p.z - (reg.gz * 32 + 16)) < 9) {
      return { text: `Guide (${available.length} quest${available.length > 1 ? 's' : ''})`, action: 'guide' };
    }
    return null;
  }

  private doInteraction(prompt: { text: string; action: string }): void {
    if (prompt.action === 'furnace') {
      if (!this.nearbyTile(108)) {
        this.messages.push({ text: 'That furnace is out of reach.', color: 0xe0a040, kind: 'system', life: 1.8 });
        return;
      }
      this.callbacks.onFurnace();
      this.audio.play('ui_open', 0.7);
      return;
    }
    if (prompt.action === 'enchant') {
      if (!this.nearbyTile(112)) {
        this.messages.push({ text: 'That enchanting table is out of reach.', color: 0xe0a040, kind: 'system', life: 1.8 });
        return;
      }
      this.callbacks.onEnchant();
      this.audio.play('ui_open', 0.7);
      return;
    }
    if (prompt.action === 'chest') {
      const chest = this.nearbyTile(103);
      if (chest) this.openChest(chest);
      this.audio.play('ui_click', 0.6);
    } else if (prompt.action === 'guide') {
      for (const id of this.player.availableQuests().filter((q) => QUEST_BY_ID.get(q)?.region === regionAt(this.player.pos.x, this.player.pos.z).id)) {
        const def = QUEST_BY_ID.get(id);
        if (!def) continue;
        if (this.player.acceptQuest(id)) {
          this.messages.push({ text: `Quest: ${def.name}`, color: 0xffe070, kind: 'quest', life: 4 });
          this.audio.play('quest_complete', 0.7);
        }
      }
      const ready = this.player.activeQuests().filter((id) => this.player.questReadyToClaim(id));
      if (ready.length) {
        this.messages.push({ text: 'A quest is ready to complete.', color: 0x5ae070, kind: 'quest', life: 3 });
      }
    } else if (prompt.action === 'craft') {
      this.messages.push({ text: 'The crafting table is ready — open the Crafting panel.', color: 0xbfe0ff, kind: 'info', life: 2.5 });
    } else {
      this.messages.push({ text: 'Nothing to do here.', color: 0xb0b0b8, kind: 'info', life: 1.5 });
    }
  }

  /**
   * The first block of `id` within `radius` blocks of the player.
   *
   * Public because the UI needs to know whether a furnace or an enchanting
   * table is actually reachable before it offers to open one.
   */
  nearbyTile(id: number, radius = 2): { x: number; y: number; z: number } | null {
    const p = this.player.pos;
    for (let dx = -radius; dx <= radius; dx++) {
      for (let dy = -radius; dy <= radius; dy++) {
        for (let dz = -radius; dz <= radius; dz++) {
          if (this.world.get(Math.floor(p.x + dx), Math.floor(p.y + 1 + dy), Math.floor(p.z + dz)) === id) {
            return { x: Math.floor(p.x + dx), y: Math.floor(p.y + 1 + dy), z: Math.floor(p.z + dz) };
          }
        }
      }
    }
    return null;
  }

  /** Open a chest: roll its contents and hand them to the player. */
  private openChest(at: { x: number; y: number; z: number }): void {
    const rng = new RNG(this.world.regionIdAt(at.x, at.z) * 7919 + at.x * 31 + at.z);
    for (let i = 0; i < 4; i++) {
      const id = rollChestLoot(rng);
      if (this.player.addItem(id, 1 + Math.floor(rng.nextFloat() * 3))) {
        this.messages.push({ text: `Found ${itemName(id)}`, color: 0xffe070, kind: 'rare', life: 1.8 });
      }
    }
    this.player.bump('chestsOpened', 1);
    this.player.bumpAchievements();
  }

  /** Craft one item from the inventory, if the recipe is satisfiable. */
  craft(itemId: number): boolean {
    const def = ITEMS[itemId];
    if (!def || !def.recipe) return false;
    for (const slot of def.recipe) {
      if (slot === 0) continue;
      if (this.player.countItem(slot) < 1) return false;
    }
    for (const slot of def.recipe) {
      if (slot !== 0) this.player.removeItem(slot, 1);
    }
    if (!this.player.addItem(itemId, 1)) {
      for (const slot of def.recipe) if (slot !== 0) this.player.addItem(slot, 1);
      return false;
    }
    this.player.bump('crafted', 1);
    this.player.progressQuest('craft', String(itemId), 1);
    this.player.bumpAchievements();
    this.audio.play('place_block', 0.6);
    return true;
  }

  // ---------------------------------------------------------------- combat

  private resolveAttacks(): void {
    if (!this.player.attack()) return;
    this.audio.play('swing', 0.8);
    const box = this.attackBox();
    for (const e of this.enemies) {
      if (!e.alive || !e.questKillable) continue;
      if (!e.hits(box)) continue;
      const { amount, crit } = this.player.attackDamage();
      e.takeDamage(amount, {
        from: { x: this.player.pos.x, y: this.player.pos.y + 1, z: this.player.pos.z },
        crit,
        knockback: 1.15,
      });
      this.onHitEnemy(e, crit);
    }
  }

  /** The box swept by an attack: the held weapon's reach around the body. */
  private attackBox(): AABB {
    const p = this.player.pos;
    const reach = this.player.stats.reach;
    const sx = Math.sin(this.player.yaw);
    const cx = Math.cos(this.player.yaw);
    return boxFrom(p.x - sx * reach * 0.5, p.y + 0.4, p.z - cx * reach * 0.5, reach * 0.65, 1.1, 0.8);
  }

  private onHitEnemy(e: Enemy, crit: boolean): void {
    this.audio.play(crit ? 'crit' : 'hit_flesh', crit ? 1 : 0.8);
    this.particles.burst(0, 0, 0, 1, this.rgb(0xffffff), {});
    if (crit) e.stagger(0.2);
    this.player.bump('hits', 1);
    if (e.counted) this.player.progressQuest('kill', e.id, 0);
  }

  private updateEnemies(dt: number): void {
    const p = this.player;
    for (let i = this.enemies.length - 1; i >= 0; i--) {
      const e = this.enemies[i];
      if (!e.alive) {
        this.onEnemyDeath(e);
        this.removeEnemy(e);
        continue;
      }
      if (Math.abs(e.pos.x - p.pos.x) > 140 || Math.abs(e.pos.z - p.pos.z) > 140) {
        this.removeEnemy(e);
        continue;
      }
      e.rareFind = p.stats.rareFind;
      const healthBefore = p.health;
      e.update(dt, this.world, p);
      this.syncEnemyMesh(e, dt);
      if (p.health < healthBefore && this.hitFlash <= 0) {
        this.hitFlash = 0.35;
        this.onPlayerHurt();
      }
    }
  }

  private onPlayerHurt(): void {
    this.audio.play('hurt', 0.9);
    this.particles.burst(0, 0, 0, 1, this.rgb(0xffffff), {});
    if (this.player.health <= 0) this.die('defeated');
  }

  private onEnemyDeath(e: Enemy): void {
    if (!e.counted) {
      this.removeEnemy(e);
      return;
    }
    this.audio.play(e.boss ? 'boss_roar' : 'enemy_die', e.boss ? 1 : 0.85);
    this.particles.burst(0, 0, 0, 1, this.rgb(0xffffff), {});
    if (e.boss) this.cameraShake(1.2);
    this.player.bump('kills', 1);
    this.progress.bump('kills', 1);
    if (e.boss) {
      this.progress.defeatBoss(e.id, Math.round(this.playtime * 1000));
      const edef = resolveEnemy(e.id);
      this.progress.logEvent('boss', `Defeated ${edef?.name || e.id}`, this.playtime);
    }
    this.player.progressQuest('kill', e.id, 1);
    this.player.bumpAchievements();
    const { leveled, levels } = this.player.gainXp(e.experience());
    if (leveled) {
      this.audio.play('levelup', 1);
      this.messages.push({ text: `Level up! Now level ${levels[levels.length - 1]}`, color: 0xffe070, kind: 'achievement', life: 3.2 });
      this.particles.burst(0, 0, 0, 1, this.rgb(0xffffff), {});
    }
    for (const drop of e.rolls()) {
      if (this.player.addItem(drop.id, drop.count)) {
        this.messages.push({ text: `+${itemName(drop.id)} x${drop.count}`, color: 0x8ad0ff, kind: 'info', life: 1.4 });
      }
    }
    if (this.player.stats.lifeOnKill > 0) this.player.heal(this.player.stats.lifeOnKill);
    if (this.arenaActive && e.boss && this.arenaCleared()) {
      this.messages.push({ text: 'The arena falls silent.', color: 0xffe070, kind: 'achievement', life: 4 });
    }
  }

  private arenaCleared(): boolean {
    return this.enemies.filter((e) => e.alive && e.boss).length === 0;
  }

  private removeEnemy(e: Enemy): void {
    const mesh = this.enemyMeshes.get(e.uid);
    if (mesh) {
      this.scene.remove(mesh);
      this.enemyMeshes.delete(e.uid);
    }
    const idx = this.enemies.indexOf(e);
    if (idx >= 0) this.enemies.splice(idx, 1);
    if (this.bossEnemy === e) this.bossEnemy = null;
  }

  /** Build or update the mesh for an enemy. */
  private syncEnemyMesh(e: Enemy, dt: number): void {
    let mesh = this.enemyMeshes.get(e.uid);
    if (!mesh) {
      mesh = this.buildEnemyMesh(e);
      this.enemyMeshes.set(e.uid, mesh);
      this.scene.add(mesh);
    }
    mesh.position.set(e.pos.x, e.pos.y, e.pos.z);
    const dirX = e.vel.x || (e.aggroTarget ? e.aggroTarget.x - e.pos.x : 0);
    const dirZ = e.vel.z || (e.aggroTarget ? e.aggroTarget.z - e.pos.z : 0);
    mesh.rotation.y = Math.atan2(dirX, dirZ);
    if (e.state === 'attack') mesh.rotateX(-0.35 * Math.min(1, e.attackCd));
    const t = this.playtime * 6;
    const legs = mesh.userData.legs as THREE.Object3D[] | undefined;
    if (legs) {
      const swing = Math.abs(e.vel.x) + Math.abs(e.vel.z);
      const s = Math.min(0.9, swing * 0.12) * Math.sin(t);
      legs[0].rotation.x = s;
      legs[1].rotation.x = -s;
    }
    const wings = mesh.userData.wings as THREE.Object3D[] | undefined;
    if (wings) wings[0].rotation.z = Math.sin(t * 1.4) * 0.5;
    if (e.lastDamage > 0 && Math.random() < 0.5) {
      mesh.children.forEach((c) => (c as THREE.Mesh).material = new THREE.MeshStandardMaterial({
        color: 0xffffff, roughness: 0.6, flatShading: true,
      }));
    }
  }

  private buildEnemyMesh(e: Enemy): THREE.Object3D {
    const group = new THREE.Group();
    const size = Math.max(0.5, e.half.y);
    const mat = new THREE.MeshStandardMaterial({ color: e.def.color, roughness: 0.65, flatShading: true });
    e.mat = mat;

    if (e.boss) {
      const body = new THREE.Mesh(new THREE.BoxGeometry(size * 1.1, size * 1.1, size * 1.1), mat);
      body.position.y = size * 0.55;
      group.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(size * 0.7, size * 0.6, size * 0.7), mat);
      head.position.y = size * 1.4;
      group.add(head);
      for (const sx of [-1, 1]) {
        const shoulder = new THREE.Mesh(new THREE.BoxGeometry(size * 0.5, size * 0.4, size * 0.5), mat);
        shoulder.position.set(sx * size * 0.75, size * 0.75, 0);
        group.add(shoulder);
      }
      const core = new THREE.Mesh(new THREE.SphereGeometry(size * 0.3, 12, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
      core.position.y = size * 0.55;
      group.add(core);
      group.userData.core = core;
      group.userData.body = body;
      this.bossCore = core;
    } else {
      const body = new THREE.Mesh(new THREE.BoxGeometry(size * 0.8, size * 0.8, size * 0.8), mat);
      body.position.y = size * 0.4;
      group.add(body);
      const head = new THREE.Mesh(new THREE.BoxGeometry(size * 0.55, size * 0.5, size * 0.55), mat);
      head.position.y = size * 1.05;
      group.add(head);
      const legL = new THREE.Mesh(new THREE.BoxGeometry(size * 0.32, size * 0.5, size * 0.32), mat);
      legL.position.set(-size * 0.2, -size * 0.15, 0);
      group.add(legL);
      const legR = new THREE.Mesh(new THREE.BoxGeometry(size * 0.32, size * 0.5, size * 0.32), mat);
      legR.position.set(size * 0.2, -size * 0.15, 0);
      group.add(legR);
      group.userData.legs = [legL, legR];
      if (e.def.kind === 'flyer') {
        const wingL = new THREE.Mesh(new THREE.BoxGeometry(size * 0.9, size * 0.12, size * 0.5), mat);
        wingL.position.set(-size * 0.6, size * 0.55, 0);
        group.add(wingL);
        group.userData.wings = [wingL];
      }
    }
    return group;
  }

  private bossCore: THREE.Mesh | null = null;

  // ---------------------------------------------------------------- streaming

  private stream(force: boolean): void {
    const px = Math.floor(this.player.pos.x);
    const pz = Math.floor(this.player.pos.z);
    const pcx = px >> 4;
    const pcz = pz >> 4;
    const pcy = Math.floor(this.player.pos.y) >> 5;
    if (!force && pcx === this.lastPlayerChunk.x && pcy === this.lastPlayerChunk.y && pcz === this.lastPlayerChunk.z) return;
    this.lastPlayerChunk = { x: pcx, y: pcy, z: pcz };
    const r = this.streamRadius;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dz = -r; dz <= r; dz++) {
          const cx = pcx + dx, cy = pcy + dy, cz = pcz + dz;
          const dist = Math.max(Math.abs(dx), Math.abs(dy) * 0.7, Math.abs(dz));
          if (dist > r) continue;
          if (cy < 0 || cy > Math.floor(WORLD_H / CHUNK_H) - 1) continue;
          this.worldRenderer.markDirty(cx, cy, cz);
        }
      }
    }
  }

  /** Raise or lower the render distance from the observed frame time. */
  adaptQuality(frameMs: number): void {
    const r = this.streamRadius;
    if (frameMs > 30 && r > 3) {
      this.streamRadius = r - 1;
      this.worldRenderer.renderDistance = this.streamRadius;
      this.worldRenderer.minRenderDistance = Math.max(2, this.streamRadius - 2);
      this.stream(true);
    } else if (frameMs < 14 && r < 7) {
      this.streamRadius = r + 1;
      this.worldRenderer.renderDistance = this.streamRadius;
      this.worldRenderer.maxRenderDistance = this.streamRadius + 1;
    // Wire the tile tables the mesher reads: glow and variant indices are
    // indexed by tile id, so they are built from the registry directly.
    const glow = new Float32Array(1024);
    const variants = new Int32Array(1024);
    for (let i = 0; i < TILE_BY_ID.length; i++) {
      const d = TILE_BY_ID[i];
      if (!d) continue;
      glow[i] = d.glow ?? 0;
      variants[i] = Math.max(1, Math.min(3, d.variant ?? 1));
    }
    this.worldRenderer.setVariantDefs(Array.from(variants));
    this.worldRenderer.setGlowTable(glow);
      this.stream(true);
    }
  }

  // ---------------------------------------------------------------- spawning

  private spawnAround(): void {
    this.spawnAccumulator++;
    if (this.spawnAccumulator % 30 !== 0) return;
    const px = Math.floor(this.player.pos.x);
    const pz = Math.floor(this.player.pos.z);

    if (this.arenaActive) {
      if (!this.bossEnemy || !this.bossEnemy.alive) this.spawnBoss();
      return;
    }
    if (this.dungeon) return;

    const pack = this.spawner.packFor(px, pz, this.player.state.level);
    for (const e of pack.enemies) {
      if (Math.abs(e.pos.x - px) > 52 || Math.abs(e.pos.z - pz) > 52) continue;
      if (this.enemies.some((x) => x.uid === e.uid)) continue;
      if (Math.abs(e.pos.x - this.player.pos.x) < 6 && Math.abs(e.pos.z - this.player.pos.z) < 6) continue;
      this.enemies.push(e);
    }
  }

  private bossEnemy: Enemy | null = null;

  private enterDungeon(id: string): void {
    const def = DUNGEON_BY_ID.get(id);
    if (!def) return;
    const entry = this.world.dungeonEntrance(id);
    if (entry) {
      this.player.pos = { x: entry.x, y: entry.y, z: entry.z };
      this.player.state.position = [entry.x, entry.y, entry.z];
    }
    this.dungeonOrigin = { x: this.player.pos.x, z: this.player.pos.z };
    this.progress.rememberStructure({
      id: `dungeon_${id}`, name: def.name,
      x: this.player.pos.x, y: this.player.pos.y, z: this.player.pos.z,
      region: this.world.regionIdAt(Math.floor(this.player.pos.x), Math.floor(this.player.pos.z)),
    }, true);
    for (const e of this.spawner.spawnDungeon(id, this.player.state.level, this.dungeonOrigin)) this.enemies.push(e);
    this.audio.play('portal', 1);
    this.messages.push({ text: `Entered ${def.name}`, color: 0xbfe0ff, kind: 'system', life: 3.5 });
  }

  private enterArena(id: string): void {
    const cells = BOSS_ARENA_CELLS[id] || BOSS_ARENA_CELLS[Object.keys(BOSS_ARENA_CELLS).find((k) => k.includes('eternity')) || 'eternity'] || [[6, 10]];
    const [gx, gz] = cells[0];
    const floor = this.world.arenaFloor(id, gx, gz);
    const y = (floor === undefined ? 70 : floor) + 2;
    this.player.pos = { x: gx * 32 + 12, y, z: gz * 32 + 12 };
    this.player.state.position = [this.player.pos.x, y, this.player.pos.z];
    this.arenaActive = true;
    this.progress.rememberMarker({
      id: `arena_${id}`, name: id, x: gx * 32 + 16, z: gz * 32 + 16,
      region: this.world.regionIdAt(gx * 32 + 16, gz * 32 + 16), kind: 'arena',
    }, true);
    this.progress.logEvent('arena', `Entered the ${id} arena`, this.playtime);
    this.spawnBoss();
    this.audio.play('boss_roar', 1);
    this.messages.push({ text: 'The arena gates close behind you.', color: 0xff8050, kind: 'system', life: 4 });
  }

  private spawnBoss(): void {
    const bossId = this.arenaId || 'boss_verdant';
    const def = resolveEnemy(bossId) || resolveEnemy('boss_verdant');
    if (!def) return;
    const cells = BOSS_ARENA_CELLS[bossId] || [[6, 10]];
    const [gx, gz] = cells[0];
    const floor = this.world.arenaFloor(bossId, gx, gz) ?? 70;
    const spot: EnemySpawn = { id: bossId, x: gx * 32 + 20, y: floor + 1, z: gz * 32 + 20 };
    const boss = new Enemy(def, spot, Math.max(40, this.player.state.level + 6), 'arena', 7);
    this.enemies.push(boss);
    this.bossEnemy = boss;
    this.cameraShake(1.4);
  }

  private cameraShake(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  // ---------------------------------------------------------------- markers

  private updateMarkers(dt: number): void {
    this.markerTimer -= dt;
    if (this.markerTimer > 0) return;
    this.markerTimer = 0.5;
    const p = this.player.pos;
    const here = this.world.regionIdAt(Math.floor(p.x), Math.floor(p.z));
    this.markers = [];
    for (const def of QUEST_BY_ID.values()) {
      if (!def || def.region < 0) continue;
      if (def.region === here) continue;
      const r = REGION_BY_ID.get(def.region)!;
      if (!r) continue;
      this.markers.push({
        id: `q_${def.id}`, name: def.name, x: r.gx * 32 + 16, z: r.gz * 32 + 16,
        color: 0xffe070, distance: Math.hypot(r.gx * 32 + 16 - p.x, r.gz * 32 + 16 - p.z),
        quest: def.id, kind: 'quest',
      });
    }
    for (const [id, cells] of Object.entries(BOSS_ARENA_CELLS)) {
      const [gx, gz] = cells[0];
      this.markers.push({
        id: `b_${id}`, name: id.replace('boss_arena_', ''),
        x: gx * 32 + 16, z: gz * 32 + 16, color: 0xff7028,
        distance: Math.hypot(gx * 32 + 16 - p.x, gz * 32 + 16 - p.z),
        quest: null, kind: 'boss',
      });
    }
    this.markers.sort((a, b) => b.distance - a.distance);
    this.markers = this.markers.slice(0, 24);
  }

  // ---------------------------------------------------------------- biome

  private updateBiome(dt: number): void {
    this.biomeTimer -= dt;
    const reg = regionAt(this.player.pos.x, this.player.pos.z);
    const b = biomeOfRegion(reg);
    this.player.visitRegion(reg.id);
    this.atmosphere.setSky(b.sky);
    this.scene.background = new THREE.Color(b.sky);
    this.scene.fog = new THREE.Fog(b.sky, 34, 150);
    this.ambient.color.setHex(b.light);
    this.hemi.color.setHex(b.sky);
    this.hemi.groundColor.setHex(b.stone);
    this.water.material.color.setHex(b.water);
    this.atmosphere.setWeather(b.weather[0] || 'none', b.weather[0] === 'none' ? 0 : 0.7);

    const trackId = BIOME_AMBIENT[b.id] ?? 'calm';
    if (trackId !== this.currentTrack) {
      this.currentTrack = trackId;
      this.music.play(TRACK_BY_ID.get(trackId) || TRACK_BY_ID.get('calm') || null, 1.4);
      this.callbacks.onMusic(trackId);
    }
    this.music.setIntensity(this.arenaActive || this.dungeon ? 1 : 0.65);
    if (this.biomeTimer > 0) return;
    this.biomeTimer = 0.8;
  }

  private updateWater(dt: number): void {
    this.belowFade += dt;
    this.water.visible = this.player.pos.y > 55;
    this.water.position.y = 62;
  }

  // ---------------------------------------------------------------- hud

  /** Build the HUD snapshot the UI reads. */
  snapshot(): HudSnapshot {
    const p = this.player;
    const s = p.stats;
    const reg = regionAt(p.pos.x, p.pos.z);
    const b = biomeOfRegion(reg);
    const boss = this.bossEnemy && this.bossEnemy.alive ? this.bossEnemy : null;
    const hotbar = p.state.hotbar.map((slot, i) => {
      const stack = p.state.inventory[slot];
      return { id: stack ? stack.id : 0, count: stack ? stack.count : 0, selected: i === p.state.hotbarIndex };
    });
    const skills = p.state.activeSkills.map((id) => ({
      id,
      name: SKILL_BY_ID.get(id)?.name || id,
      level: p.state.skillLevels[id] || 1,
      ready: p.isReady(id),
    }));
    const objectives = p.activeQuests().slice(0, 3).flatMap((id) =>
      p.questCounters(id).map((o) => ({ text: o.text, have: o.have, need: o.need, done: o.done })),
    );
    const hud: HudSnapshot = {
      health: p.health, maxHealth: s.maxHealth,
      mana: p.mana, maxMana: s.maxMana,
      stamina: p.state.stamina, hunger: p.state.hunger,
      level: p.state.level,
      xp: Math.floor(p.state.xp),
      xpNeeded: p.xpNeeded,
      xpText: `${Math.floor(p.state.xp)} / ${p.xpNeeded}`,
      regionName: reg.name, biomeName: b.name, biomeId: b.id,
      coordinates: { x: Math.floor(p.pos.x), y: Math.floor(p.pos.y), z: Math.floor(p.pos.z) },
      armor: Math.round(s.armor),
      damage: Math.round(s.flatDamage * (1 + s.percentDamage)),
      crit: Math.round(s.critChance * 100),
      dodge: Math.round(s.dodge * 100),
      speed: Math.round(s.movementSpeed * 10) / 10,
      hotbar,
      activeSkills: skills,
      activeQuests: p.activeQuests().map((id) => ({
        id, name: QUEST_BY_ID.get(id)?.name || id, ready: p.questReadyToClaim(id),
      })),
      objectives,
      dungeon: this.dungeon,
      boss: boss ? boss.def.name : null,
      bossHealth: boss ? Math.max(0, boss.hp) : null,
      nearby: this.markers.filter((m) => m.distance < 900).slice(0, 4).map((m) => ({
        name: m.name, distance: Math.round(m.distance), quest: m.quest, kind: m.kind,
      })),
      fps: Math.round(this.fps),
      chunkCount: this.worldRenderer.chunks.size,
      triangles: this.worldRenderer.triangleCount,
      playtime: this.playtime,
      exploration: this.explorationPct,
      regionsVisited: this.progress.visitedCount(),
      interact: this.interactTarget ? this.interactTarget.text : null,
    };
    this.lastHud = hud;
    return hud;
  }

  // ---------------------------------------------------------------- messages

  pushMessage(msg: GameMessage): void { this.messages.push(msg); }

  private flushMessages(dt: number): void {
    for (let i = this.messages.length - 1; i >= 0; i--) {
      this.messages[i].life -= dt;
      if (this.messages[i].life <= 0) this.messages.splice(i, 1);
    }
  }

  /** Messages still alive, newest last, for the UI to render. */
  get activeMessages(): GameMessage[] { return this.messages.slice(-6); }

  // ---------------------------------------------------------------- state

  die(cause: string): void {
    if (this.dead) return;
    this.dead = true;
    this.cause = cause;
    this.audio.play('player_die', 1);
    this.messages.push({ text: 'You have fallen.', color: 0xe05050, kind: 'system', life: 5 });
  }

  get isDead(): boolean { return this.dead; }
  get isArena(): boolean { return this.arenaActive; }
  get isDungeon(): boolean { return this.dungeon !== null; }
  get playerState(): PlayerState { return this.player.snapshot(); }
  get chunkCount(): number { return this.worldRenderer.chunks.size; }

  /** Every live enemy in the scene, for the runtime check and debugging. */
  get enemyList(): readonly Enemy[] { return this.enemies; }

  /** How many enemies are currently simulated. */
  get enemyCount(): number { return this.enemies.length; }

  /** Respawn the player at the world spawn after a death. */
  respawn(): void {
    const sp = this.world.spawnPosition();
    this.player.respawn([sp.x, sp.y, sp.z]);
    this.dead = false;
    this.deathTimer = 0;
    this.enemies = [];
    for (const mesh of this.enemyMeshes.values()) this.scene.remove(mesh);
    this.enemyMeshes.clear();
    this.audio.play('teleport', 0.9);
    this.cameraShake(0.8);
  }

  /** Teleport to a region centre, used by the map screen. */
  travelTo(regionId: number): void {
    const reg = REGION_BY_ID.get(regionId) || REGION_BY_ID.get(0)!;
    const x = reg.gx * 32 + 16;
    const z = reg.gz * 32 + 16;
    const h = this.world.surfaceHeight(Math.floor(x), Math.floor(z));
    this.player.pos = { x, y: h + 2, z };
    this.player.state.position = [x, h + 2, z];
    this.player.visitRegion(reg.id);
    this.audio.play('teleport', 0.8);
    this.cameraShake(0.6);
    this.messages.push({ text: `Arrived in ${reg.name}`, color: 0xbfe0ff, kind: 'system', life: 3 });
  }

  /** Enter a dungeon by id, from the map screen. */
  enterDungeonById(id: string): boolean {
    const def = DUNGEON_BY_ID.get(id);
    if (!def) return false;
    if (this.player.state.level < def.minLevel) {
      this.messages.push({ text: `You need level ${def.minLevel} to enter.`, color: 0xe05050, kind: 'system', life: 3 });
      return false;
    }
    this.dungeon = id;
    this.enemies = [];
    for (const mesh of this.enemyMeshes.values()) this.scene.remove(mesh);
    this.enemyMeshes.clear();
    this.enterDungeon(id);
    return true;
  }

  /** Leave the current dungeon and return to the surface. */
  leaveDungeon(): void {
    const entry = this.world.dungeonEntrance(this.dungeon || '');
    const sp = entry || this.world.spawnPosition();
    this.dungeon = null;
    this.enemies = [];
    for (const mesh of this.enemyMeshes.values()) this.scene.remove(mesh);
    this.enemyMeshes.clear();
    this.player.pos = { x: sp.x, y: sp.y, z: sp.z };
    this.player.state.position = [sp.x, sp.y, sp.z];
    this.audio.play('teleport', 0.8);
  }
}

/** Loot from a chest, weighted toward the mid tiers. */
function rollChestLoot(rng: RNG): number {
  const r = rng.nextFloat();
  if (r < 0.34) return 1004;
  if (r < 0.5) return 1002;
  if (r < 0.62) return 1005;
  if (r < 0.74) return 1031;
  if (r < 0.86) return 1032;
  return 1033;
}
