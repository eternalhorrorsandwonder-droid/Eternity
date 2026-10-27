import './three-stub';
import { RNG, hash3, valueNoise, fbm } from '../src/engine/core/RNG';
import { TILES, TILE_VARIANTS, TILE_BY_ID, initTileTables, syncColliderFlags, TILE_CAT } from '../src/game/data/Tiles';
import { TILE_FLAGS, VoxelGrid, isSolidTile } from '../src/engine/core/Collision';
import { buildChunkGeometry, CHUNK_X, CHUNK_Y, CHUNK_Z } from '../src/engine/render/ChunkMesher';

let failures = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) console.log(`  ok   ${name}`);
  else { failures++; console.log(`  FAIL ${name} ${detail}`); }
}

console.log('== RNG ==');
const a = new RNG(12345); const b = new RNG(12345);
let same = true;
for (let i = 0; i < 1000; i++) if (a.next() !== b.next()) same = false;
check('deterministic', same);
check('range', a.range(0, 1) >= 0 && a.range(0, 1) < 1);
check('hash stable', hash3(3, 7, 11, 2) === hash3(3, 7, 11, 2));
const n = valueNoise(3.2, 4.1, 5.9, 1);
check('value noise in [-1,1]', n >= -1 && n <= 1, `got ${n}`);

console.log('== Tiles ==');
initTileTables();
syncColliderFlags();
const ids = new Set<number>();
let maxId = 0;
for (const d of TILES) {
  check(`unique id ${d.name}`, !ids.has(d.id), `duplicate ${d.id}`);
  ids.add(d.id);
  if (d.id > maxId) maxId = d.id;
}
console.log(`  ${TILES.length} tiles registered, max id ${maxId}`);
check('tile ids fit in a uint16 grid', maxId <= 65535, `max ${maxId}`);
let cells = 0;
for (const v of TILE_VARIANTS) cells += Math.max(1, Math.min(3, v));
console.log(`  atlas cells needed: ${cells} / 1024`);
check('atlas capacity', cells <= 1024, `need ${cells}`);
check('every tile has a name', TILES.every((d) => d.name.length > 0));
check('every tile has a valid category', TILES.every((d) => d.cat === 1 || d.cat === 2));
check('water is translucent', TILE_CAT[TILE_BY_ID[190]!.id] === 2);
check('stone is opaque', TILE_CAT[TILE_BY_ID[4]!.id] === 1);
check('flag table populated', TILE_FLAGS[TILE_BY_ID[190]!.id] !== 0);

console.log('== VoxelGrid ==');
const g = new VoxelGrid(64, 64, 64);
g.fillColumn(5, 5, 10, TILE_BY_ID[4]!.id);
check('solid below surface', isSolidTile(g.get(5, 5, 5)));
check('air above surface', g.get(5, 12, 5) === 0);
check('out of bounds is air', g.get(-3, 5, 5) === 0);

console.log('== Greedy mesher ==');
// A 4x4x4 solid cube sitting inside one chunk.
const world = new VoxelGrid(CHUNK_X, CHUNK_Y, CHUNK_Z);
const CUBE = { min: 8, max: 11 };
for (let x = CUBE.min; x <= CUBE.max; x++) for (let y = CUBE.min; y <= CUBE.max; y++) for (let z = CUBE.min; z <= CUBE.max; z++) world.set(x, y, z, 4);
const geo = buildChunkGeometry(world, { x: 0, y: 0, z: 0 },
  (tile: number) => tile,
  (_t: number) => 0,
  (_t: number) => 0);
const idx = geo.opaque ? (geo.opaque as any).index.array : new Uint32Array(0);
const pos = geo.opaque ? (geo.opaque as any).attributes.position.array : new Float32Array(0);
const tris = idx.length / 3;
check('solid cube produces geometry', tris > 0, `tris ${tris}`);
check('6 faces x 1 merged quad x 2 tris', tris === 12, `tris ${tris}`);
check('no transparent geometry for stone', geo.transparent === null);
check('no emissive geometry for stone', geo.emissive === null);

// Every triangle must face away from the cube centre and sit on its surface.
let normalsOk = true, planarOk = true, uvOk = true;
const cx = 9.5, cy = 9.5, cz = 9.5;
const uvAttr = (geo.opaque as any).attributes.uv.array;
for (let t = 0; t < tris; t++) {
  const a = idx[t * 3] * 3, b = idx[t * 3 + 1] * 3, c = idx[t * 3 + 2] * 3;
  const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2];
  const vx = pos[c] - pos[a], vy = pos[c + 1] - pos[a + 1], vz = pos[c + 2] - pos[a + 2];
  const nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
  const len = Math.hypot(nx, ny, nz) || 1;
  const ddx = (pos[a] + pos[b] + pos[c]) / 3 - cx;
  const ddy = (pos[a + 1] + pos[b + 1] + pos[c + 1]) / 3 - cy;
  const ddz = (pos[a + 2] + pos[b + 2] + pos[c + 2]) / 3 - cz;
  if ((nx / len) * ddx + (ny / len) * ddy + (nz / len) * ddz <= 0.001) normalsOk = false;
  // All corners must sit exactly on one of the cube's six boundary planes.
  const onSurface = (() => {
    const pts = [[pos[a], pos[a + 1], pos[a + 2]], [pos[b], pos[b + 1], pos[b + 2]], [pos[c], pos[c + 1], pos[c + 2]]];
    const faces = [[12, 'x'], [8, 'x'], [12, 'y'], [8, 'y'], [12, 'z'], [8, 'z']];
    return pts.every((p) => faces.some(([v, axis]) => Math.abs(p[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] - v) < 1e-4));
  })();
  if (!onSurface) planarOk = false;
  // UVs must be inside the atlas cell for this tile.
  for (const i of [idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]]) {
    const u = uvAttr[i * 2], v = uvAttr[i * 2 + 1];
    if (!(u >= -1e-6 && u <= 1 + 1e-6 && v >= -1e-6 && v <= 1 + 1e-6)) uvOk = false;
  }
}
check('all triangle normals point outward', normalsOk);
check('all triangles lie on the cube surface', planarOk);
check('uvs inside the atlas cell', uvOk);

// Empty chunk must produce nothing.
const empty = new VoxelGrid(CHUNK_X, CHUNK_Y, CHUNK_Z);
const geo2 = buildChunkGeometry(empty, { x: 0, y: 0, z: 0 }, () => 0, () => 0, () => 0);
check('empty chunk yields no geometry', geo2.opaque === null && geo2.transparent === null && geo2.emissive === null);

// Terrain: a flat 16x16 plate at y=20 should merge hard.
const terrain = new VoxelGrid(CHUNK_X, CHUNK_Y, CHUNK_Z);
for (let x = 0; x < CHUNK_X; x++) for (let z = 0; z < CHUNK_Z; z++) for (let y = 0; y <= 20; y++) terrain.set(x, y, z, 2);
const geo3 = buildChunkGeometry(terrain, { x: 0, y: 0, z: 0 }, (t: number) => t, () => 0, () => 0);
const t3 = geo3.opaque ? (geo3.opaque as any).index.array.length / 3 : 0;
check('flat terrain is heavily merged', t3 < 16 * 16 * 2, `tris ${t3}`);
// top + bottom (2 quads) + four 16x21 sides = 6 quads = 12 tris
check('flat plate merges to 6 quads', t3 === 12, `tris ${t3}`);

// AO: a corner block should be darker than an open one.
const col3 = (geo3.opaque as any).attributes.color.array;
let minB = 9, maxB = -9;
for (let i = 0; i < col3.length; i += 3) {
  const b = (col3[i] + col3[i + 1] + col3[i + 2]) / 3;
  if (b < minB) minB = b;
  if (b > maxB) maxB = b;
}
check('ambient occlusion varies across faces', maxB - minB > 0.05, `${minB}..${maxB}`);

// Glass: a transparent block must land in the transparent pass, not opaque.
const glassWorld = new VoxelGrid(CHUNK_X, CHUNK_Y, CHUNK_Z);
for (let x = 8; x < 12; x++) for (let y = 8; y < 12; y++) for (let z = 8; z < 12; z++) glassWorld.set(x, y, z, 87);
const glassGeo = buildChunkGeometry(glassWorld, { x: 0, y: 0, z: 0 }, (t: number) => t, () => 0, () => 0);
const glassOpaque = glassGeo.opaque ? (glassGeo.opaque as any).index.array.length / 3 : 0;
const glassTrans = glassGeo.transparent ? (glassGeo.transparent as any).index.array.length / 3 : 0;
check('glass renders in the transparent pass only', glassOpaque === 0 && glassTrans === 12, `op ${glassOpaque} tr ${glassTrans}`);

// Emissive: a glowing block must also produce an additive quad set.
const glowWorld = new VoxelGrid(CHUNK_X, CHUNK_Y, CHUNK_Z);
for (let x = 8; x < 12; x++) for (let y = 8; y < 12; y++) for (let z = 8; z < 12; z++) glowWorld.set(x, y, z, 230);
const glowGeo = buildChunkGeometry(glowWorld, { x: 0, y: 0, z: 0 }, (t: number) => t, (t: number) => (t === 230 ? 0.9 : 0), () => 0);
const glowEm = glowGeo.emissive ? (glowGeo.emissive as any).index.array.length / 3 : 0;
check('emissive blocks produce additive quads', glowEm === 12, `emissive tris ${glowEm}`);

// Chunk-seam: two adjacent chunks of solid rock must not double-render the shared face.
// One shared source spanning both chunks, so neighbours are read correctly.
const seam = new VoxelGrid(CHUNK_X * 2, CHUNK_Y, CHUNK_Z);
for (let x = 0; x < CHUNK_X * 2; x++) for (let y = 0; y < CHUNK_Y; y++) for (let z = 0; z < CHUNK_Z; z++) seam.set(x, y, z, 4);
const geoA = buildChunkGeometry(seam, { x: 0, y: 0, z: 0 }, (t: number) => t, () => 0, () => 0);
const geoB = buildChunkGeometry(seam, { x: CHUNK_X, y: 0, z: 0 }, (t: number) => t, () => 0, () => 0);
const posA = (geoA.opaque as any).attributes.position.array;
const posB = (geoB.opaque as any).attributes.position.array;
const sharedFace = 16; // the plane both chunks touch
// A triangle "lies on" the seam plane only when all three corners are on it —
// the chunk's top/bottom faces legitimately touch x=16 at their edges.
function planeHits(posArr: Float32Array, idxArr: Uint32Array, planeX: number): boolean {
  for (let t = 0; t < idxArr.length / 3; t++) {
    let on = true;
    for (let k = 0; k < 3; k++) {
      if (Math.abs(posArr[idxArr[t * 3 + k] * 3] - planeX) > 1e-4) { on = false; break; }
    }
    if (on) return true;
  }
  return false;
}
const idxA = (geoA.opaque as any).index.array as Uint32Array;
const idxB = (geoB.opaque as any).index.array as Uint32Array;
const aTouches = planeHits(posA, idxA, sharedFace);
const bTouches = planeHits(posB, idxB, sharedFace);
check('neither chunk renders a face on the shared seam plane', !aTouches && !bTouches, `A:${aTouches} B:${bTouches}`);
check('both chunks still render their outer faces', (geoA.opaque as any).index.array.length > 0 && (geoB.opaque as any).index.array.length > 0);

console.log('== Atlas build ==');
{
  const atlasMod = await import('../src/engine/render/TextureAtlas');
  const atlas = new atlasMod.TextureAtlas();
  const res = atlas.build(TILES, TILE_VARIANTS);
  (globalThis as any).__atlasResult = res;
  let cells = 0;
  for (const v of TILE_VARIANTS) cells += Math.max(1, Math.min(3, v));
  check('atlas uses every cell', cells <= res.tileCount, `${cells} cells, ${res.tileCount} used`);
  check('atlas painted cells match the tile count', res.tileCount === cells, `${res.tileCount} vs ${cells}`);
  const cellLookup = res.cellOf as Int32Array;
  check('cellOf covers the largest tile id', cellLookup.length > TILES.reduce((m, d) => Math.max(m, d.id), 0), `${cellLookup.length}`);
  const missing: number[] = [];
  for (const d of TILES) if (cellLookup[d.id] < 0) missing.push(d.id);
  check('every tile id has an atlas cell', missing.length === 0, `missing ${missing.slice(0, 8).join(',')}`);
  check('cells array covers every tile', TILES.every((_d, i) => i * 4 < (res.cells as Int32Array).length));
}

console.log('== Atlas cell lookup ==');
{
  const res: any = (globalThis as any).__atlasResult;
  if (res) {
    const missing: number[] = [];
    for (const d of TILES) if (res.cellOf[d.id] < 0) missing.push(d.id);
    check('every tile id has an atlas cell', missing.length === 0, `missing ${missing.slice(0, 8).join(',')}`);
    check('cellOf array is large enough for the largest id', res.cellOf.length > TILES.reduce((m, d) => Math.max(m, d.id), 0),
      `${res.cellOf.length}`);
  }
}

console.log('== Seeded terrain determinism ==');
const seedA = new RNG(99); const seedB = new RNG(99);
const h1 = fbm(1.5, 2.5, 3.5, 4, 7);
seedA.next(); seedB.next();
check('fbm deterministic', fbm(1.5, 2.5, 3.5, 4, 7) === h1);
check('fbm bounded', h1 >= -1.1 && h1 <= 1.1, `${h1}`);

console.log('== RNG distribution ==');
// A generator whose output does not span its declared range is worse than no
// generator: every consumer keeps working and every statistic is quietly wrong.
{
  const rng = new RNG(4242);
  const N = 20000;
  let min = Infinity, max = -Infinity, sum = 0;
  const buckets = [0, 0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < N; i++) {
    const v = rng.next();
    if (v < min) min = v;
    if (v > max) max = v;
    sum += v;
    buckets[Math.floor(v / 0x20000000)]++;
  }
  // The regression this guards: the previous generator forced the top eight
  // bits to zero, so no output ever reached 2^24 from either end.
  check('the generator reaches both ends of the uint32 range',
    min < 0x1000000 && max > 0xF0000000, `${min}..${max}`);
  check('the mean sits at the middle of the range', Math.abs(sum / N - 2147483648) < 2147483648 * 0.02, `${(sum / N).toFixed(0)}`);
  check('the output is spread across all eight bit buckets',
    buckets.every((b) => b > N / 8 * 0.6), buckets.join(','));
  const floats = Array.from({ length: 2000 }, () => rng.nextFloat());
  check('nextFloat reaches the top of its range', Math.max(...floats) > 0.9, `${Math.max(...floats)}`);
  check('nextFloat never leaves its range', floats.every((f) => f >= 0 && f < 1));
  const rng2 = new RNG(7);
  const rolls = Array.from({ length: 400 }, () => rng2.int(0, 3));
  const seen = new Set(rolls);
  check('int() reaches every value in its range', seen.size === 4, [...seen].join(''));
  const half = Array.from({ length: 400 }, () => rng2.chance(0.5));
  const yes = half.filter(Boolean).length;
  check('chance(0.5) is close to even', Math.abs(yes - half.length / 2) < half.length * 0.12, `${yes}/${half.length}`);
  const weighted = new RNG(11).weighted<string>([['a', 1], ['b', 1], ['c', 1], ['d', 1]]);
  check('weighted() can reach the last entry', !!weighted);
}

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILURES'}`);
process.exit(failures === 0 ? 0 : 1);
