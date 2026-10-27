/**
 * Enemy spawning.
 *
 * Regions list the creatures that belong there, but not where. Spawning is
 * deterministic per region: the same seed and the same player level produce
 * the same pack, so a save file reproduces the world exactly. That matters for
 * the quest objectives that say "kill five wolves in Whispering Woods" — the
 * wolves have to be there when the player arrives.
 *
 * Spawn density is capped and scaled with the region's danger rating, so the
 * early coast and the deep wastes never feel like the same place.
 */

import { RNG } from '../../engine/core/RNG';
import { World } from '../../engine/render/World';
import { REGIONS, regionAt, REGION_SIZE, REGION_BY_ID } from '../data/Regions';
import { WORLD_W, WORLD_D } from '../../engine/render/World';
import { resolveEnemy } from '../data/Enemies';
import { Enemy, type EnemySpawn } from '../entities/Enemy';
import { DUNGEON_BY_ID, type DungeonDef } from '../data/Dungeons';

/** How many creatures a region will hold before the cap kicks in. */
const BASE_CAP = 4;
const CAP_PER_TIER = 1.6;

/** A pack of spawned creatures plus the region it belongs to. */
export interface SpawnPack {
  regionId: number;
  enemies: Enemy[];
}

export class Spawner {
  private world: World;
  private cache = new Map<number, SpawnPack>();

  constructor(world: World) {
    this.world = world;
  }

  /**
   * Spawn one region's pack at a given player level.
   *
   * The result is memoised per region, because the same region is sampled from
   * every chunk that overlaps it; rebuilding the pack each time would cost more
   * than the memoised copy of a handful of enemies.
   */
  spawn(regionId: number, playerLevel: number): Enemy[] {
    const pack = this.get(regionId, playerLevel);
    return pack.enemies.slice();
  }

  private get(regionId: number, playerLevel: number): SpawnPack {
    const key = regionId * 1000 + Math.min(80, Math.floor(playerLevel));
    const existing = this.cache.get(key);
    if (existing) return existing;

    const region = REGION_BY_ID.get(regionId) || regionAt(0, 0);
    const pack = this.build(region, playerLevel);
    this.cache.set(key, pack);
    return pack;
  }

  private build(region: ReturnType<typeof regionAt>, playerLevel: number): SpawnPack {
    const rng = new RNG(0x1ce1ce1 ^ (region.id * 2654435761));
    const enemies: Enemy[] = [];
    const [lo, hi] = region.levelRange;
    const level = Math.max(1, Math.min(80, Math.round((lo + hi) / 2 + (playerLevel - region.levelRange[1]) * 0.15)));

    for (const id of region.enemies) {
      const def = resolveEnemy(id);
      if (!def) continue;
      if (!def.outdoor) continue;
      // Each creature rolls a placement; rare ones roll fewer.
      const count = def.tier >= 8 ? 1 : def.tier >= 5 ? 1 + Math.floor(rng.nextFloat() * 2) : 1 + Math.floor(rng.nextFloat() * 3);
      for (let i = 0; i < count; i++) {
        const spot = this.findSpot(region.id, rng);
        if (!spot) break;
        const enemy = new Enemy(def, spot, level, region.name, rng.next());
        enemies.push(enemy);
      }
    }

    // Regions with fewer listed creatures get filler from the region's own
    // tier, so no region is ever empty.
    if (enemies.length < BASE_CAP) {
      const filler = pickFiller(region, rng);
      while (enemies.length < BASE_CAP && filler) {
        const spot = this.findSpot(region.id, rng);
        if (!spot) break;
        enemies.push(new Enemy(filler, spot, level, region.name, rng.next()));
      }
    }

    return { regionId: region.id, enemies };
  }

  /** Find a surface spot inside a region that is not inside a structure. */
  private findSpot(regionId: number, rng: RNG): EnemySpawn | null {
    const region = REGION_BY_ID.get(regionId) || regionAt(0, 0);
    const gx = region.gx * REGION_SIZE;
    const gz = region.gz * REGION_SIZE;
    for (let attempt = 0; attempt < 32; attempt++) {
      const x = gx + 2 + Math.floor(rng.nextFloat() * (REGION_SIZE - 4));
      const z = gz + 2 + Math.floor(rng.nextFloat() * (REGION_SIZE - 4));
      if (x < 0 || x >= WORLD_W || z < 0 || z >= WORLD_D) continue;
      const h = this.world.surfaceHeight(x, z);
      if (h < 4) continue;
      // Do not spawn inside a solid block, or buried in a tree canopy.
      const y = h + 1;
      let blocked = false;
      for (let dy = 0; dy <= 3; dy++) {
        if (this.world.get(x, y + dy, z) !== 0) { blocked = true; break; }
      }
      if (blocked) continue;
      if (this.world.get(x, y - 1, z) === 0) continue;
      return { id: region.enemies[0] || 'slime_wisp', x, y, z };
    }
    return null;
  }

  /** Spawn a dungeon's interior pack around the entrance. */
  spawnDungeon(dungeonId: string, playerLevel: number, origin: { x: number; z: number }): Enemy[] {
    const dungeon: DungeonDef | undefined = DUNGEON_BY_ID.get(dungeonId);
    if (!dungeon) return [];
    const rng = new RNG(0x5ee1d0 ^ (dungeon.id.length * 2654435761) ^ (playerLevel * 40503));
    const enemies: Enemy[] = [];
    const level = Math.max(1, Math.round(playerLevel * (1 + dungeon.recommendedLevel * 0.02)));
    for (const id of dungeon.enemies) {
      const def = resolveEnemy(id);
      if (!def) continue;
      const count = 1 + Math.floor(rng.nextFloat() * Math.max(1, dungeon.enemies.length));
      for (let i = 0; i < count; i++) {
        const x = Math.floor(origin.x) + 6 + Math.floor(rng.nextFloat() * 14);
        const z = Math.floor(origin.z) + 6 + Math.floor(rng.nextFloat() * 14);
        const h = this.world.surfaceHeight(x, z);
        const y = Math.max(h + 1, 8);
        enemies.push(new Enemy(def, { id, x, y, z }, level, dungeon.id, rng.next()));
      }
    }
    return enemies;
  }

  /** The spawn pack covering a world coordinate. */
  packFor(x: number, z: number, playerLevel: number): SpawnPack {
    const regionId = this.world.regionIdAt(Math.floor(x), Math.floor(z));
    return this.get(regionId, playerLevel);
  }

  /** Clear every memoised pack, e.g. after a world seed change. */
  clear(): void {
    this.cache.clear();
  }
}

/** Fill a region with something appropriate when its own list is thin. */
function pickFiller(region: ReturnType<typeof regionAt>, rng: RNG): ReturnType<typeof resolveEnemy> {
  const tier = Math.max(0, Math.round(region.levelRange[0]));
  const candidates = REGIONS.filter((r) => r.levelRange[0] <= tier + 1 && r.levelRange[1] >= tier - 1)
    .flatMap((r) => r.enemies);
  if (!candidates.length) return resolveEnemy('slime_wisp');
  const id = candidates[Math.floor(rng.nextFloat() * candidates.length)];
  return resolveEnemy(id);
}

export { REGION_SIZE };
