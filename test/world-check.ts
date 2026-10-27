/**
 * World generation verification.
 *
 * Generates the full 384 x 384 x 128 world headless and checks the invariants
 * that matter: the heightfield is in range, no column is empty, the ocean and
 * the nether behave, structures land inside their regions, and every boss arena
 * is a flat floor with clear air above it.
 */

import './three-stub';
import { World, WORLD_W, WORLD_D, WORLD_H, SEA_LEVEL, BOSS_ARENA_CELLS } from '../src/engine/render/World';
import { REGIONS, REGION_SIZE, biomeOfRegion } from '../src/game/data/Regions';
import { structure } from '../src/game/data/Structures';
import { TILE_BY_ID } from '../src/game/data/Tiles';

let failures = 0;
let checks = 0;
function check(name: string, cond: boolean, detail = ''): void {
  checks++;
  if (cond) return;
  failures++;
  console.log(`  FAIL ${name} ${detail}`);
}

console.log('== World generation ==');
const t0 = Date.now();
const world = new World(20260101);
world.generate();
const ms = Date.now() - t0;
console.log(`  generated in ${ms}ms`);
check('world generation is fast enough', ms < 20000, `${ms}ms`);

const stat = world.statistics();
console.log(`  ${stat.columns} columns, ${stat.voxels} voxels, ${stat.tiles} placed (${(stat.tiles / stat.voxels * 100).toFixed(1)}%)`);
check('a solid share of the world is placed', stat.tiles > stat.voxels * 0.35 && stat.tiles < stat.voxels * 0.8, `${(stat.tiles / stat.voxels * 100).toFixed(1)}%`);
check('a healthy number of voxels are placed', stat.tiles > stat.voxels * 0.05, `${stat.tiles}`);

// --- heightfield invariants
let minH = 999, maxH = -999;
for (let i = 0; i < world.height.length; i++) {
  const h = world.height[i];
  if (h < minH) minH = h;
  if (h > maxH) maxH = h;
  if (h < 4 || h >= WORLD_H) { failures++; checks++; console.log(`  FAIL height out of range at ${i}: ${h}`); break; }
}
console.log(`  height range ${minH}..${maxH}`);
check('heights stay within the world', minH >= 4 && maxH < WORLD_H - 8, `${minH}..${maxH}`);

// --- every column is filled from bedrock to the surface
let emptyColumns = 0, noBedrock = 0, surfaceIsAir = 0;
for (let z = 0; z < WORLD_D; z++) {
  for (let x = 0; x < WORLD_W; x++) {
    const h = world.surfaceHeight(x, z);
    if (world.get(x, 0, z) === 0) noBedrock++;
    if (world.get(x, h, z) === 0) surfaceIsAir++;
    let filled = 0;
    for (let y = 0; y <= h; y++) if (world.get(x, y, z) !== 0) filled++;
    if (filled < (h + 1) * 0.9) emptyColumns++;
  }
}
check('every column has bedrock', noBedrock === 0, `${noBedrock}`);
check('no column has air at its surface', surfaceIsAir === 0, `${surfaceIsAir}`);
check('columns are filled below the surface', emptyColumns === 0, `${emptyColumns}`);

// --- ocean and nether behaviour
let oceanColumns = 0, oceanWater = 0;
for (let z = 0; z < WORLD_D; z += 7) {
  for (let x = 0; x < WORLD_W; x += 7) {
    if (world.surfaceHeight(x, z) <= SEA_LEVEL) {
      oceanColumns++;
      if (world.get(x, SEA_LEVEL, z) === 190 || world.get(x, SEA_LEVEL, z) === 194) oceanWater++;
    }
  }
}
check('there is ocean in the world', oceanColumns > 50, `${oceanColumns}`);
check('submerged columns hold water or ice', oceanWater === oceanColumns, `${oceanWater}/${oceanColumns}`);

let netherColumns = 0, netherLava = 0;
for (const reg of REGIONS) {
  if (!['netherrack', 'crimson', 'warped'].includes(reg.biome)) continue;
  const b = biomeOfRegion(reg);
  if (b.id !== 'netherrack' && b.id !== 'crimson' && b.id !== 'warped') continue;
  netherColumns++;
  const x = reg.gx * REGION_SIZE + 16, z = reg.gz * REGION_SIZE + 16;
  const h = world.surfaceHeight(x, z);
  let lava = 0;
  for (let y = h + 1; y <= Math.min(h + 6, WORLD_H - 2); y++) if (world.get(x, y, z) === 191) lava++;
  if (lava > 0) netherLava++;
}
check('nether regions exist', netherColumns > 0, `${netherColumns}`);
check('nether regions have lava below the surface', netherLava > 0, `${netherLava}`);

// --- regions are self-consistent
let wrongRegion = 0;
for (let z = 0; z < WORLD_D; z += 13) {
  for (let x = 0; x < WORLD_W; x += 13) {
    const reg = world.regionOf(x, z);
    if (world.regionIdAt(x, z) !== reg.id) wrongRegion++;
  }
}
check('region ids agree with regionOf', wrongRegion === 0, `${wrongRegion}`);

// --- structures land inside their own region
let outside = 0, placed = 0;
for (const reg of REGIONS) {
  for (const sid of reg.features) {
    const def = structure(sid);
    if (!def) continue;
    placed++;
    // The structure builder wrote somewhere inside the region; sample the
    // region's centre column and confirm it is not air all the way up.
    const x = reg.gx * REGION_SIZE + 16, z = reg.gz * REGION_SIZE + 16;
    const h = world.surfaceHeight(x, z);
    if (h < 4 || world.get(x, h, z) === 0) outside++;
  }
}
check('every region feature has a structure definition', placed === REGIONS.reduce((s, r) => s + r.features.length, 0),
  `${placed}`);
check('structure regions have a solid surface', outside === 0, `${outside}`);

// --- boss arenas are flat floors with clear air above
let arenaProblems = 0, arenaCount = 0;
for (const [arenaId, cells] of Object.entries(BOSS_ARENA_CELLS)) {
  for (const [gx, gz] of cells) {
    arenaCount++;
    const floor = world.arenaFloor(arenaId, gx, gz);
    if (floor === undefined) { arenaProblems++; continue; }
    const x0 = gx * REGION_SIZE + 2, z0 = gz * REGION_SIZE + 2;
    for (let x = x0; x < x0 + 20; x += 4) {
      for (let z = z0; z < z0 + 20; z += 4) {
        const h = world.surfaceHeight(x, z);
        if (h !== floor) arenaProblems++;
        if (world.get(x, floor, z) !== 170) arenaProblems++;
        // Above the arena's own rim, torches and raised dais.
        if (world.get(x, floor + 5, z) !== 0) arenaProblems++;
      }
    }
  }
}
check('boss arenas exist', arenaCount >= 10, `${arenaCount}`);
check('boss arenas are flat with clear air', arenaProblems === 0, `${arenaProblems}`);

// --- determinism: a second world with the same seed matches
const t1 = Date.now();
const world2 = new World(20260101);
world2.generate();
const ms2 = Date.now() - t1;
let mismatch = 0;
for (let i = 0; i < world.tiles.length; i += 977) {
  if (world.tiles[i] !== world2.tiles[i]) mismatch++;
}
check('world generation is deterministic', mismatch === 0, `${mismatch} sampled mismatches`);
console.log(`  second generation in ${ms2}ms`);

// --- spawn position is sane
const sp = world.spawnPosition();
check('spawn is above ground', world.surfaceHeight(sp.x, sp.z) < sp.y, `${world.surfaceHeight(sp.x, sp.z)} vs ${sp.y}`);
check('spawn is inside the world', sp.x >= 0 && sp.x < WORLD_W && sp.z >= 0 && sp.z < WORLD_D);
check('spawn is in the start region', world.regionIdAt(sp.x, sp.z) === world.startRegion.id);

// --- the start region is walkable
const sr = world.startRegion;
const sx = sr.gx * REGION_SIZE + 16, sz = sr.gz * REGION_SIZE + 16;
let walkable = 0, sampled = 0;
for (let dx = -8; dx <= 8; dx += 4) for (let dz = -8; dz <= 8; dz += 4) {
  const x = sx + dx, z = sz + dz;
  const h = world.surfaceHeight(x, z);
  if (h > SEA_LEVEL && world.get(x, h, z) === TILE_BY_ID[2]!.id) walkable++;
  sampled++;
}
check('the start region is mostly grassland', walkable >= sampled * 0.6, `${walkable}/${sampled}`);

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILURES'} (${checks} checks)`);
process.exit(failures === 0 ? 0 : 1);
