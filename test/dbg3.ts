import './three-stub';
import { VoxelGrid } from '../src/engine/core/Collision';
import { buildChunkGeometry, CHUNK_X, CHUNK_Y, CHUNK_Z } from '../src/engine/render/ChunkMesher';
const seam = new VoxelGrid(CHUNK_X * 2, CHUNK_Y, CHUNK_Z);
for (let x = 0; x < CHUNK_X * 2; x++) for (let y = 0; y < CHUNK_Y; y++) for (let z = 0; z < CHUNK_Z; z++) seam.set(x, y, z, 4);
const g = buildChunkGeometry(seam, { x: 0, y: 0, z: 0 }, (t: number) => t, () => 0, () => 0);
const pos = (g.opaque as any).attributes.position.array as Float32Array;
const idx = (g.opaque as any).index.array as Uint32Array;
console.log('verts', pos.length / 3, 'idx', idx.length);
const seen = new Map<string, number>();
for (let t = 0; t < idx.length / 3; t++) {
  const tri = [0,1,2].map(k => `(${pos[idx[t*3+k]*3].toFixed(2)},${pos[idx[t*3+k]*3+1].toFixed(2)},${pos[idx[t*3+k]*3+2].toFixed(2)})`).join(' ');
  seen.set(tri, (seen.get(tri) ?? 0) + 1);
}
for (const [k, v] of seen) console.log(`x${v}  ${k}`);
