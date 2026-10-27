import './three-stub';
import { VoxelGrid } from '../src/engine/core/Collision';
import { buildChunkGeometry, CHUNK_X, CHUNK_Y, CHUNK_Z } from '../src/engine/render/ChunkMesher';

const world = new VoxelGrid(CHUNK_X, CHUNK_Y, CHUNK_Z);
for (let x = 8; x < 12; x++) for (let y = 8; y < 12; y++) for (let z = 8; z < 12; z++) world.set(x, y, z, 4);

// Re-implement the face scan standalone to count faces per direction.
const FACES = [
  { nx: 1, ny: 0, nz: 0, depthAxis: 0, depthDir: 1, uAxis: 2, uSign: -1, vAxis: 1, vLabel: 'y' },
  { nx: -1, ny: 0, nz: 0, depthAxis: 0, depthDir: -1, uAxis: 2, uSign: 1, vAxis: 1, vLabel: 'y' },
  { nx: 0, ny: 1, nz: 0, depthAxis: 1, depthDir: 1, uAxis: 0, uSign: 1, vAxis: 2, vLabel: 'z' },
  { nx: 0, ny: -1, nz: 0, depthAxis: 1, depthDir: -1, uAxis: 0, uSign: 1, vAxis: 2, vLabel: 'z' },
  { nx: 0, ny: 0, nz: 1, depthAxis: 2, depthDir: 1, uAxis: 0, uSign: 1, vAxis: 1, vLabel: 'y' },
  { nx: 0, ny: 0, nz: -1, depthAxis: 2, depthDir: -1, uAxis: 0, uSign: -1, vAxis: 1, vLabel: 'y' },
];
const ax = (a: number) => (a === 0 ? CHUNK_X : a === 1 ? CHUNK_Y : CHUNK_Z);
for (const dir of FACES) {
  const du = ax(dir.uAxis), dv = ax(dir.vAxis), dd = ax(dir.depthAxis);
  let faces = 0;
  let slicesWithFaces: number[] = [];
  for (let d = 0; d < dd; d++) {
    let inSlice = 0;
    for (let v = 0; v < dv; v++) {
      for (let u = 0; u < du; u++) {
        const A = [0,0,0] as number[];
        A[dir.depthAxis] = d; A[dir.uAxis] = u; A[dir.vAxis] = v;
        const a = world.get(A[0], A[1], A[2]);
        const b = world.get(A[0]+dir.nx, A[1]+dir.ny, A[2]+dir.nz);
        if (a !== 0 && b === 0) { faces++; inSlice++; }
        else if (a === 0 && b !== 0) { faces++; inSlice++; }
      }
    }
    if (inSlice) slicesWithFaces.push(d);
  }
  console.log(`dir(${dir.nx},${dir.ny},${dir.nz}) du=${du} dv=${dv} dd=${dd} unitFaces=${faces} slices=${slicesWithFaces.join(',')}`);
}
const geo = buildChunkGeometry(world, {x:0,y:0,z:0}, (t:number)=>t, ()=>0, ()=>0);
console.log('tris', geo.opaque ? (geo.opaque as any).index.array.length/3 : 0);
