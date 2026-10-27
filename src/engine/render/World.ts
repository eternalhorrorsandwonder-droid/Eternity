/**
 * The world.
 *
 * Eternity's world is 384 x 384 blocks with a height of 128, divided into a
 * 12 x 12 grid of 32 x 32 hand-authored regions (`src/game/data/Regions.ts`).
 * This class owns the voxel array the whole game reads from.
 *
 * Two deliberate design choices:
 *
 *   1. **The heightfield is authored by regions, not by a continent generator.**
 *      A region declares a biome, a height bias, an ocean flag and a peak
 *      amplitude; the noise only decides *how the ground within that region
 *      moves*, never *where the region is*. Every place the player is meant to
 *      go has a fixed address, so walking back to a place finds it exactly
 *      where it was left.
 *
 *   2. **Structures are painted after the terrain, not generated with it.**
 *      A village is a village because the region says so and the structure
 *      builder places it there — flattening whatever hill it happens to sit on.
 *      Boss arenas are flattened to a fixed floor so the fight has a floor.
 *
 * Storage is one flat `Uint16Array` (roughly 38 MB) because the mesher reads
 * across chunk boundaries through the `TileSource` interface and a flat array
 * is the only layout that makes that a single bounds check.
 */

import type { TileSource } from './ChunkMesher';
import { RNG, fbm, valueNoise } from '../core/RNG';
import { isSolidTile } from '../core/Collision';
import { REGIONS, REGION_BY_ID, regionAt, biomeOfRegion, START_REGION_DEF, WORLD_SIZE, REGION_SIZE, WORLD_HEIGHT } from '../../game/data/Regions';
import { BIOMES, biome } from '../../game/data/Biomes';
import { STRUCTURES, structure, StructureCtx } from '../../game/data/Structures';
import { DUNGEON_BY_ID } from '../../game/data/Dungeons';
import { TILE_BY_ID } from '../../game/data/Tiles';

export const WORLD_W = WORLD_SIZE;
export const WORLD_D = WORLD_SIZE;
export const WORLD_H = WORLD_HEIGHT;
export const SEA_LEVEL = 62;
export const BEDROCK_LEVEL = 3;

/** Index of a voxel in the flat storage array. */
function idx(x: number, y: number, z: number): number {
  return ((z * WORLD_H) + y) * WORLD_W + x;
}

/** Region-grid coordinates for every boss arena, so each titan has a fixed home. */
export const BOSS_ARENA_CELLS: Record<string, [number, number][]> = {
  boss_arena_ember: [[7, 6]],
  boss_arena_fortress: [[2, 8]],
  boss_arena_warped: [[5, 8]],
  boss_arena_verdant: [[0, 10]],
  boss_arena_eternity: [[6, 10], [11, 11]],
  boss_arena_arcane: [[5, 11]],
  boss_arena_eldritch: [[1, 11]],
  boss_arena_starfall: [[9, 11]],
  boss_arena_end: [[8, 10]],
  boss_arena_wither: [[3, 8]],
};

/** Decoration names to tiles. */
const DECORATION_TILES: Record<string, number> = {
  flower: 43,
  bluebell: 44,
  dandelion: 45,
  tall_grass: 46,
  bush: 47,
  cactus: 48,
  vines: 49,
  glow_flower: 50,
  glow_berries: 51,
  pumpkin: 52,
  melon: 53,
  sugar_cane: 54,
  bamboo: 55,
  kelp: 56,
  seagrass: 57,
  moss: 58,
  snow_layer: 197,
  powdered_snow: 198,
  cobweb: 199,
  azalea: 287,
  flowering_azalea: 289,
  dead_bush: 288,
  crystal_blue: 163,
  crystal_red: 164,
  crystal_green: 165,
  crystal_purple: 166,
  crystal_gold: 167,
  sculk: 182,
  amethyst_bud: 281,
  amethyst_shard: 282,
  pointed_dripstone: 285,
  resin_block: 297,
  coral: 43,
  spore: 50,
  mushroom: 43,
  grass: 46,
};

/** Tree canopy tiles by kind. */
const LEAF_BY_TREE: Record<string, number> = {
  oak: 40,
  birch: 41,
  spruce: 42,
  acacia: 63,
  darkoak: 64,
  mangrove: 65,
  pine: 42,
  palm: 40,
  dead: 40,
  crystal: 163,
  coral: 57,
  bamboo: 55,
  redwood: 40,
};

/** Log tile by tree kind. */
const LOG_BY_TREE: Record<string, number> = {
  oak: 30,
  birch: 32,
  spruce: 33,
  acacia: 34,
  darkoak: 35,
  mangrove: 36,
  pine: 33,
  palm: 30,
  dead: 22,
  crystal: 30,
  coral: 203,
  bamboo: 55,
  redwood: 30,
};

export class World implements TileSource {
  /** Flat voxel storage. 0 = air. */
  tiles: Uint16Array;
  /** Precomputed surface height per column (0..WORLD_H-1). */
  height: Uint8Array;
  /** The region id each column belongs to, for fast lookups. */
  regionIds: Uint16Array;

  private rng: RNG;
  private generated = false;
  /** Floor height for each flattened boss arena, keyed `id@gx,gz`. */
  arenaFloors = new Map<string, number>();
  /** Where each structure was actually placed, for dungeon entrances. */
  placedStructures: { id: string; x: number; y: number; z: number; region: number }[] = [];

  constructor(seed: number = 20260101) {
    this.tiles = new Uint16Array(WORLD_W * WORLD_H * WORLD_D);
    this.height = new Uint8Array(WORLD_W * WORLD_D);
    this.regionIds = new Uint16Array(WORLD_W * WORLD_D);
    this.rng = new RNG(seed);
  }

  // ------------------------------------------------------------- tile access

  get(x: number, y: number, z: number): number {
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H || z < 0 || z >= WORLD_D) return 0;
    return this.tiles[((z * WORLD_H) + y) * WORLD_W + x];
  }

  set(x: number, y: number, z: number, id: number): void {
    if (x < 0 || x >= WORLD_W || y < 0 || y >= WORLD_H || z < 0 || z >= WORLD_D) return;
    this.tiles[((z * WORLD_H) + y) * WORLD_W + x] = id;
  }

  /** True when the voxel is solid (blocks movement and the mesher). */
  isSolid(x: number, y: number, z: number): boolean {
    return isSolidTile(this.get(x, y, z));
  }

  surfaceHeight(x: number, z: number): number {
    if (x < 0 || x >= WORLD_W || z < 0 || z >= WORLD_D) return 0;
    return this.height[z * WORLD_W + x];
  }

  regionIdAt(x: number, z: number): number {
    if (x < 0 || x >= WORLD_W || z < 0 || z >= WORLD_D) return 0;
    return this.regionIds[z * WORLD_W + x];
  }

  /** The region definition covering a world coordinate. */
  regionOf(x: number, z: number): (typeof REGIONS)[number] {
    return regionAt(x, z);
  }

  // ------------------------------------------------------------ generation

  /** Generate the whole world. Call once at boot; takes a few hundred ms. */
  generate(): void {
    if (this.generated) return;
    const t0 = (typeof performance !== 'undefined' ? performance.now() : 0);
    this.buildHeightfield();
    this.buildColumns();
    this.plantTrees();
    this.placeDecorations();
    // Arenas are flattened *before* structures are placed, so a village or a
    // fortress sits on level ground and the arena's own rim is the last thing
    // written. The heightfield is updated in place so later lookups agree.
    this.flattenArenas();
    this.placeStructures();
    this.generated = true;
    const t1 = (typeof performance !== 'undefined' ? performance.now() : 0);
    console.log(`[World] generated ${WORLD_W}x${WORLD_H}x${WORLD_D} voxels in ${Math.round(t1 - t0)}ms`);
  }

  /** Heightfield: region bias + biome recipe + seeded noise. */
  private buildHeightfield(): void {
    for (let z = 0; z < WORLD_D; z++) {
      for (let x = 0; x < WORLD_W; x++) {
        const reg = regionAt(x, z);
        const b = biomeOfRegion(reg);
        const hx = x / 32, hz = z / 32;
        // Two octaves of noise at region scale, plus a fine octave for detail.
        let n = fbm(hx * 0.55, hz * 0.55, reg.id * 3.1, 3, 2.2);
        n += fbm(hx * 1.9, hz * 1.9, reg.id * 5.7 + 11, 3, 0.55) * 0.35;
        let h = Math.round(b.heightBase + reg.heightBias + n * b.heightAmp * (0.6 + b.rough * 0.6));
        // Mountain regions get a sharper ridge along their own axis.
        if (reg.peaks > 0) {
          const ridge = Math.sin((x / WORLD_W) * Math.PI * (1 + reg.peaks * 0.02));
          h += Math.round(ridge * reg.peaks * 0.5);
        }
        if (reg.ocean) {
          const depth = 4 + Math.round(Math.abs(fbm(hx * 0.4, hz * 0.4, reg.id * 2.3, 2, 1.6)) * 14);
          h = SEA_LEVEL - depth;
        }
        h = Math.max(4, Math.min(WORLD_H - 12, h));
        this.height[z * WORLD_W + x] = h;
        this.regionIds[z * WORLD_W + x] = reg.id;
      }
    }
  }

  /** Fill every column from bedrock to sky. */
  private buildColumns(): void {
    const air = 0;
    for (let z = 0; z < WORLD_D; z++) {
      for (let x = 0; x < WORLD_W; x++) {
        const i = z * WORLD_W + x;
        const h = this.height[i];
        const reg = REGION_BY_ID.get(this.regionIds[i]) ?? REGIONS[0];
        const b = biomeOfRegion(reg);
        let base = h;

        // The top two blocks are the "surface": grass, sand, snow or mud.
        let surface = b.grass;
        if (h <= SEA_LEVEL) surface = b.sand;
        if (b.temp < -0.45) surface = b.snow;
        if (b.humid > 0.7 && b.temp > 0.1) surface = b.dirt;

        for (let y = 0; y < BEDROCK_LEVEL; y++) this.set(x, y, z, TILE_BY_ID[126]!.id);
        for (let y = BEDROCK_LEVEL; y < h; y++) {
          // Dirt layer under the grass, stone below that, and ore veins.
          if (y >= h - 4) this.set(x, y, z, b.dirt);
          else {
            let tile = b.stone;
            // Ore: cheap hash per column-depth band so veins look continuous.
            const vein = Math.floor((y + x * 13 + z * 7) / 11) % 9;
            if (vein === 0) tile = 138;      // iron
            else if (vein === 1) tile = 139; // gold
            else if (vein === 2 && h > 40) tile = 140; // diamond
            else if (vein === 3) tile = 142; // coal
            else if (vein === 4) tile = 143; // redstone
            else if (vein === 5 && h > 55) tile = 146; // ancient debris
            this.set(x, y, z, tile);
          }
        }
        this.set(x, h, z, surface);

        // Water fills down to sea level.
        if (h <= SEA_LEVEL) {
          const waterTile = b.water || 190;
          for (let y = h + 1; y <= SEA_LEVEL; y++) this.set(x, y, z, waterTile);
          this.set(x, SEA_LEVEL, z, waterTile);
        }

        // Ice on cold water.
        if (b.temp < -0.3 && h <= SEA_LEVEL && this.get(x, SEA_LEVEL, z) === 190) {
          this.set(x, SEA_LEVEL, z, 194);
        }

        // A snow layer on cold land.
        if (b.temp < -0.45 && h > SEA_LEVEL && this.get(x, h, z) !== 0) {
          this.set(x, h + 1, z, 197);
          base = h;
        }

        // Lava seas in the nether, at the bottom of deep valleys.
        if (b.id === 'netherrack' || b.id === 'crimson' || b.id === 'warped') {
          for (let y = h + 1; y <= Math.min(h + 6, WORLD_H - 2); y++) {
            if (this.get(x, y, z) === air) this.set(x, y, z, 191);
          }
        }

        void base;
      }
    }
  }

  /** Trees: one hash-based decision per grass column. */
  private plantTrees(): void {
    for (const reg of REGIONS) {
      const b = biomeOfRegion(reg);
      if (b.tree === 'none') continue;
      const density = b.tree === 'bamboo' ? 0.35 : b.tree === 'pine' ? 0.16 : 0.09;
      const x0 = reg.gx * REGION_SIZE, z0 = reg.gz * REGION_SIZE;
      for (let z = z0; z < z0 + REGION_SIZE; z++) {
        for (let x = x0; x < x0 + REGION_SIZE; x++) {
          const h = this.height[z * WORLD_W + x];
          if (h <= SEA_LEVEL) continue;
          const top = this.get(x, h, z);
          if (top !== b.grass && top !== b.dirt && top !== b.sand) continue;
          const r = valueNoise(x * 0.071, z * 0.071, reg.id * 0.37, 3);
          if (r > density * 2 - 1) continue;
          this.placeTree(x, h + 1, z, b.tree, reg.id);
        }
      }
    }
  }

  /** Plant one tree at (x, baseY, z). */
  private placeTree(x: number, y: number, z: number, kind: string, salt: number): void {
    if (kind === 'bamboo') {
      const h = 6 + Math.floor(valueNoise(x * 0.3, z * 0.3, salt, 2) * 5);
      for (let i = 0; i < h; i++) this.set(x, y + i, z, 55);
      for (let dx = -1; dx <= 1; dx++) this.set(x + dx, y + h, z, 40);
      return;
    }
    if (kind === 'cactus') {
      const h = 3 + Math.floor(valueNoise(x * 0.4, z * 0.4, salt, 2) * 3);
      for (let i = 0; i < h; i++) this.set(x, y + i, z, 48);
      for (let dx = -1; dx <= 1; dx += 2) this.set(x + dx, y + Math.floor(h * 0.6), z, 48);
      return;
    }
    if (kind === 'palm') {
      const h = 5 + Math.floor(valueNoise(x * 0.3, z * 0.3, salt, 2) * 4);
      for (let i = 0; i < h; i++) this.set(x, y + i, z, 30);
      for (let dx = -2; dx <= 2; dx++) for (let dz = -2; dz <= 2; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= 3) this.set(x + dx, y + h, z + dz, 40);
      }
      return;
    }
    if (kind === 'crystal') {
      const h = 4 + Math.floor(valueNoise(x * 0.3, z * 0.3, salt, 2) * 3);
      for (let i = 0; i < h; i++) this.set(x, y + i, z, 30);
      for (let dx = -1; dx <= 1; dx++) for (let dz = -1; dz <= 1; dz++) {
        this.set(x + dx, y + h, z + dz, 163);
      }
      this.set(x, y + h + 1, z, 163);
      return;
    }
    if (kind === 'coral') {
      for (let i = 0; i < 4; i++) {
        this.set(x, y + i, z, 240);
        this.set(x + 1, y + i, z, 240);
      }
      for (let dx = -2; dx <= 2; dx++) this.set(x + dx, y + 4, z, 241);
      return;
    }

    // Generic trunked trees.
    const tall = kind === 'birch' || kind === 'pine' || kind === 'redwood';
    const trunk = tall ? 6 : (kind === 'mangrove' ? 5 : 4);
    const log = LOG_BY_TREE[kind] ?? 30;
    const leaf = LEAF_BY_TREE[kind] ?? 40;
    const canopy = kind === 'darkoak' ? 3 : kind === 'acacia' ? 2 : kind === 'redwood' ? 4 : 2;
    const h = trunk + Math.floor(valueNoise(x * 0.29, z * 0.29, salt, 2) * 3);

    for (let i = 0; i <= h; i++) {
      if (kind === 'mangrove' && i % 2 === 1) {
        this.set(x - 1, y + i, z, log);
        this.set(x + 1, y + i, z, log);
      } else if (kind === 'mangrove' && i % 2 === 0) {
        this.set(x, y + i, z, log);
      } else {
        this.set(x, y + i, z, log);
      }
    }

    if (kind === 'pine' || kind === 'spruce') {
      for (let i = 0; i <= h + 3; i++) {
        const w = Math.max(0, Math.floor((h + 3 - i) / 2));
        for (let dx = -w; dx <= w; dx++) for (let dz = -w; dz <= w; dz++) {
          if (Math.abs(dx) + Math.abs(dz) <= w + 1 && this.get(x + dx, y + i, z + dz) === 0) {
            this.set(x + dx, y + i, z + dz, leaf);
          }
        }
      }
      return;
    }

    if (kind === 'acacia') {
      for (let dx = -canopy; dx <= canopy; dx++) for (let dz = -canopy; dz <= canopy; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= canopy + 1) {
          this.set(x + dx, y + h + 1, z + dz, leaf);
          this.set(x + dx, y + h + 2, z + dz, leaf);
        }
      }
      return;
    }

    for (let dy = 0; dy <= 2; dy++) {
      const w = canopy - Math.floor(dy / 2);
      for (let dx = -w; dx <= w; dx++) for (let dz = -w; dz <= w; dz++) {
        if (Math.abs(dx) + Math.abs(dz) <= w + 1 && this.get(x + dx, y + h + dy, z + dz) === 0) {
          this.set(x + dx, y + h + dy, z + dz, leaf);
        }
      }
    }
    this.set(x, y + h + 3, z, leaf);
  }

  /** Surface decorations: flowers, grass, mushrooms, crystals, snow. */
  private placeDecorations(): void {
    for (let z = 0; z < WORLD_D; z++) {
      for (let x = 0; x < WORLD_W; x++) {
        const i = z * WORLD_W + x;
        const reg = REGION_BY_ID.get(this.regionIds[i]) ?? REGIONS[0];
        const b = biomeOfRegion(reg);
        const h = this.height[i];
        const r = valueNoise(x * 0.11, z * 0.11, reg.id * 0.61, 3);
        if (r > 0.72) continue;
        const top = this.get(x, h, z);
        if (top === 0) continue;
        // Only on grass, dirt, sand, snow, mud or underwater ground.
        const onLand = top === b.grass || top === b.dirt || top === b.sand
          || top === b.snow || top === 13 || top === 12;
        if (!onLand && b.id !== 'ocean' && b.id !== 'deep_ocean' && b.id !== 'coral') continue;
        // Pick a decoration from the biome's list by hash.
        const list = b.decorations;
        if (list.length === 0) continue;
        const choice = list[Math.floor(valueNoise(x * 0.5, z * 0.5, reg.id * 1.7, 2) * list.length) % list.length];
        const tile = DECORATION_TILES[choice];
        if (tile === undefined) continue;
        if (b.id === 'snow' || b.id === 'ice' || b.id === 'snowy_mountain') {
          this.set(x, h + 1, z, 197);
          continue;
        }
        if (tile === 56 || tile === 57) {
          // Kelp and seagrass go underwater.
          if (h >= SEA_LEVEL) continue;
          this.set(x, SEA_LEVEL - 1, z, tile);
          this.set(x, SEA_LEVEL - 2, z, tile);
          continue;
        }
        if (this.get(x, h + 1, z) !== 0) continue;
        this.set(x, h + 1, z, tile);
      }
    }
  }

  /** Place every structure declared by every region. */
  private placeStructures(): void {
    for (const reg of REGIONS) {
      for (let f = 0; f < reg.features.length; f++) {
        const sid = reg.features[f];
        const def = structure(sid);
        if (!def) continue;
        // Deterministic placement inside the region, biased away from the edges
        // so a 20-block arena never overlaps the neighbouring region.
        const rng = new RNG(0x9e3779b9 ^ (reg.id * 2654435761) ^ (f * 40503));
        let px: number, pz: number;
        if (def.arena || def.size[0] > 18) {
          // Arenas are placed on the exact footprint `flattenArenas` carved,
          // so the structure's own rim lines up with the flattened floor.
          px = reg.gx * REGION_SIZE + 2;
          pz = reg.gz * REGION_SIZE + 2;
        } else {
          px = reg.gx * REGION_SIZE + 4 + Math.floor(rng.nextFloat() * Math.max(1, REGION_SIZE - def.size[0] - 8));
          pz = reg.gz * REGION_SIZE + 4 + Math.floor(rng.nextFloat() * Math.max(1, REGION_SIZE - def.size[2] - 8));
        }
        const gy = this.surfaceHeight(px, pz) + 1;
        const ctx: StructureCtx = {
          ox: px,
          oz: pz,
          ground: gy,
          set: (x, y, z, tile) => this.set(x, y, z, tile),
          rng,
        };
        try {
          def.build(ctx);
          this.placedStructures.push({ id: def.id, x: px, y: gy, z: pz, region: reg.id });
        } catch (err) {
          console.warn(`[World] structure ${sid} in ${reg.name} failed:`, err);
        }
      }
    }
  }

  /**
   * Flatten every boss arena so the fight has a level floor and the titan does
   * not stand on a hill. Runs after structures so an arena's own rim survives.
   */
  private flattenArenas(): void {
    for (const [arenaId, cells] of Object.entries(BOSS_ARENA_CELLS)) {
      for (const [gx, gz] of cells) {
        const x0 = gx * REGION_SIZE + 2;
        const z0 = gz * REGION_SIZE + 2;
        const size = 20;
        // The arena sits at the highest point of its own footprint and is
        // carved down to it, never built up over water.
        let floorY = 4;
        for (let x = x0; x < x0 + size; x++) {
          for (let z = z0; z < z0 + size; z++) {
            if (x < 0 || x >= WORLD_W || z < 0 || z >= WORLD_D) continue;
            const h = this.surfaceHeight(x, z);
            if (h > floorY) floorY = h;
          }
        }
        for (let x = x0; x < x0 + size; x++) {
          for (let z = z0; z < z0 + size; z++) {
            if (x < 0 || x >= WORLD_W || z < 0 || z >= WORLD_D) continue;
            const h = this.surfaceHeight(x, z);
            for (let y = floorY; y <= h; y++) this.set(x, y, z, 0);
            this.set(x, floorY, z, 170);
            this.set(x, floorY - 1, z, 170);
            this.height[z * WORLD_W + x] = floorY;
          }
        }
        // Clear the air above the floor so nothing occludes the arena.
        for (let x = x0; x < x0 + size; x++) {
          for (let z = z0; z < z0 + size; z++) {
            for (let y = floorY + 1; y < WORLD_H; y++) {
              if (this.get(x, y, z) !== 0) this.set(x, y, z, 0);
            }
          }
        }
        this.arenaFloors.set(`${arenaId}@${gx},${gz}`, floorY);
      }
    }
  }

  /** Where the entrance of a dungeon is, or null if it is not in this world. */
  dungeonEntrance(dungeonId: string): { x: number; y: number; z: number } | null {
    const entry = DUNGEON_BY_ID.get(dungeonId);
    if (!entry) return null;
    const match = this.placedStructures.find((p) => p.id === entry.entrance);
    if (!match) return null;
    const h = this.surfaceHeight(match.x, match.z);
    return { x: match.x + 0.5, y: h + 2, z: match.z + 0.5 };
  }

  /** Floor height of a flattened arena cell, if it has one. */
  arenaFloor(arenaId: string, gx: number, gz: number): number | undefined {
    return this.arenaFloors.get(`${arenaId}@${gx},${gz}`);
  }

  // ------------------------------------------------------------------ misc

  /** The region the player starts in. */
  get width(): number { return WORLD_W; }

  /** World size in blocks along Z. */
  get depth(): number { return WORLD_D; }

  /** Side length in blocks of the whole world, for save headers. */
  get size(): number { return WORLD_W; }

  get startRegion(): (typeof REGIONS)[number] {
    return START_REGION_DEF;
  }

  /** World-space spawn position: just above the start region's surface. */
  spawnPosition(): { x: number; y: number; z: number } {
    const x = this.startRegion.gx * REGION_SIZE + 16;
    const z = this.startRegion.gz * REGION_SIZE + 16;
    return { x, y: this.surfaceHeight(x, z) + 2, z };
  }

  /** Tile counts, for the debug overlay and the save summary. */
  statistics(): { columns: number; voxels: number; tiles: number } {
    let nonAir = 0;
    for (let i = 0; i < this.tiles.length; i++) if (this.tiles[i] !== 0) nonAir++;
    return { columns: WORLD_W * WORLD_D, voxels: this.tiles.length, tiles: nonAir };
  }
}

/** Convenience: every biome definition, re-exported for the world generator. */
export const ALL_BIOMES = BIOMES;
export { biome, BIOMES };
