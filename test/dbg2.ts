import './three-stub';
import { VoxelGrid } from '../src/engine/core/Collision';
import { buildChunkGeometry, CHUNK_X, CHUNK_Y, CHUNK_Z } from '../src/engine/render/ChunkMesher';
const seam = new VoxelGrid(CHUNK_X * 2, CHUNK_Y, CHUNK_Z);
for (let x = 0; x < CHUNK_X * 2; x++) for (let y = 0; y < CHUNK_Y; y++) for (let z = 0; z < CHUNK_Z; z++) seam.set(x, y, z, 4);
for (const [name, ox] of [['A', 0], ['B', CHUNK_X]] as const) {
  const g = buildChunkGeometry(seam, { x: ox, y: 0, z: 0 }, (t: number) => t, () => 0, () => 0);
  const pos = (g.opaque as any).attributes.position.array as Float32Array;
  const xs = new Set<number>();
  for (let i = 0; i < pos.length; i += 3) xs.add(Math.round(pos[i] * 100) / 100);
  console.log(name, 'tris', (g.opaque as any).index.array.length / 3, 'uniqueX', [...xs].sort((a, b) => a - b).join(','));
}
