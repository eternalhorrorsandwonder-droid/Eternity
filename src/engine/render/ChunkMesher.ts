/**
 * Greedy chunk mesher.
 *
 * Each chunk is 16 x 32 x 16 voxels. For every one of the six directions the
 * mesher walks the chunk one depth-slice at a time and merges coplanar,
 * same-texture quads into rectangles. On flat terrain that cuts the vertex
 * count by roughly 4x versus one quad per face — the difference between a phone
 * holding 60fps and one dropping to 20.
 *
 * Tiles are read through a `TileSource` that can reach *into neighbouring
 * chunks*, so there are no holes at chunk seams and no duplicate geometry to
 * z-fight. A chunk can be rebuilt at any time without special-casing borders.
 *
 * Face maths, stated once so it stays right:
 *
 *   A block at integer P occupies [P, P+1]^3. Its outward face with normal n
 *   lies on the plane Q where Q = P on the axis of n when n is negative and
 *   Q = P + 1 when n is positive; on the two tangent axes Q = P. A face exists
 *   exactly once, and only when P is solid and P + n is empty — the face
 *   always belongs to the solid block and faces the empty space. Rendering it
 *   from both sides is what duplicates every surface.
 *
 * Three geometry passes come out of one sweep:
 *   opaque      – rock, dirt, wood, brick (depth write)
 *   transparent – glass, leaves, water (depth write off, drawn last)
 *   emissive    – torches, runes, lava, crystals (unlit, additive)
 *
 * Vertex colours carry a per-vertex ambient-occlusion term plus a directional
 * sky-light ramp. That is what gives the world depth without paying for real
 * shadow maps on mobile.
 */

import { AIR, TILE_FLAGS } from '../core/Collision';
import { ATLAS_TILES_PER_ROW } from './TextureAtlas';

import * as THREE from 'three';

export interface TileSource {
  get(x: number, y: number, z: number): number;
}

export const CHUNK_X = 16;
export const CHUNK_Y = 32;
export const CHUNK_Z = 16;

/** 0 = empty, 1 = opaque, 2 = translucent-solid. */
export function passOf(tile: number): 0 | 1 | 2 {
  if (tile === AIR) return 0;
  if ((TILE_FLAGS[tile] & 2) !== 0) return 2;
  return 1;
}

/** Does this tile block the mesher's occlusion test? */
export function occludes(tile: number): boolean {
  return tile !== AIR;
}

interface DirSpec {
  nx: number; ny: number; nz: number;
  /** Axis of the normal (0=x, 1=y, 2=z). */
  depthAxis: 0 | 1 | 2;
  /** Tangent axes, both traversed in their positive direction. */
  uAxis: 0 | 1 | 2;
  vAxis: 0 | 1 | 2;
  /** true when +u x +v points opposite to the normal, so the winding flips. */
  flip: boolean;
}

/**
 * Tangent cross products:
 *   +X: (+Y)x(+Z) = +X   -X: (+Y)x(+Z) = +X ≠ -X  → flip
 *   +Y: (+X)x(+Z) = -Y   -Y: (+X)x(+Z) = -Y     → no flip
 *   +Z: (+X)x(+Y) = +Z   -Z: (+X)x(+Y) = +Z ≠ -Z → flip
 */
const FACES: DirSpec[] = [
  { nx: 1, ny: 0, nz: 0, depthAxis: 0, uAxis: 1, vAxis: 2, flip: false },
  { nx: -1, ny: 0, nz: 0, depthAxis: 0, uAxis: 1, vAxis: 2, flip: true },
  { nx: 0, ny: 1, nz: 0, depthAxis: 1, uAxis: 0, vAxis: 2, flip: true },
  { nx: 0, ny: -1, nz: 0, depthAxis: 1, uAxis: 0, vAxis: 2, flip: false },
  { nx: 0, ny: 0, nz: 1, depthAxis: 2, uAxis: 0, vAxis: 1, flip: false },
  { nx: 0, ny: 0, nz: -1, depthAxis: 2, uAxis: 0, vAxis: 1, flip: true },
];

/** Ambient occlusion at a face point: 0 (dark) .. 3 (bright). */
function aoAt(
  src: TileSource, px: number, py: number, pz: number,
  o1x: number, o1y: number, o1z: number,
  o2x: number, o2y: number, o2z: number,
  o3x: number, o3y: number, o3z: number,
  nx: number, ny: number, nz: number
): number {
  let ao = 0;
  const offs = [[o1x, o1y, o1z], [o2x, o2y, o2z], [o3x, o3y, o3z]];
  for (let i = 0; i < 3; i++) {
    const ax = px + offs[i][0], ay = py + offs[i][1], az = pz + offs[i][2];
    let side = 0;
    if (occludes(src.get(ax, ay, az))) {
      side = occludes(src.get(ax - nx, ay - ny, az - nz)) ? 2 : 1;
    }
    ao += side;
  }
  return 3 - ao;
}

class MeshBuilder {
  pos: Float32Array;
  nor: Float32Array;
  uv: Float32Array;
  col: Float32Array;
  idx: Uint32Array;
  verts = 0;
  indices = 0;

  constructor(initial = 4096) {
    this.pos = new Float32Array(initial * 3);
    this.nor = new Float32Array(initial * 3);
    this.uv = new Float32Array(initial * 2);
    this.col = new Float32Array(initial * 3);
    this.idx = new Uint32Array(initial * 6);
  }

  private ensure(v: number): void {
    if (v * 3 <= this.pos.length) return;
    let cap = this.pos.length;
    while (cap < v * 3) cap *= 2;
    const np = new Float32Array(cap); np.set(this.pos); this.pos = np;
    const nn = new Float32Array(cap); nn.set(this.nor); this.nor = nn;
    const nc = new Float32Array(cap); nc.set(this.col); this.col = nc;
    const nu = new Float32Array((cap / 3) * 2);
    nu.set(this.uv.subarray(0, this.verts * 2));
    this.uv = nu;
    const ni = new Uint32Array((cap / 3) * 6);
    ni.set(this.idx.subarray(0, this.indices * 6));
    this.idx = ni;
  }

  vertex(
    px: number, py: number, pz: number,
    nx: number, ny: number, nz: number,
    u: number, v: number,
    r: number, g: number, b: number
  ): number {
    const i = this.verts;
    this.ensure(i + 1);
    this.pos[i * 3] = px; this.pos[i * 3 + 1] = py; this.pos[i * 3 + 2] = pz;
    this.nor[i * 3] = nx; this.nor[i * 3 + 1] = ny; this.nor[i * 3 + 2] = nz;
    this.uv[i * 2] = u; this.uv[i * 2 + 1] = v;
    this.col[i * 3] = r; this.col[i * 3 + 1] = g; this.col[i * 3 + 2] = b;
    this.verts++;
    return i;
  }

  /** Emit a quad. `order` is the corner winding: 0 = (00,10,11,01), 1 = (00,01,11,10). */
  quad(a: number, b: number, c: number, d: number): void {
    this.ensure(this.verts + 4);
    const k = this.indices;
    this.idx[k] = a; this.idx[k + 1] = b; this.idx[k + 2] = c;
    this.idx[k + 3] = a; this.idx[k + 4] = c; this.idx[k + 5] = d;
    this.indices = k + 6;
  }

  build(): THREE.BufferGeometry | null {
    if (this.verts === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos.subarray(0, this.verts * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(this.nor.subarray(0, this.verts * 3), 3));
    g.setAttribute('uv', new THREE.BufferAttribute(this.uv.subarray(0, this.verts * 2), 2));
    g.setAttribute('color', new THREE.BufferAttribute(this.col.subarray(0, this.verts * 3), 3));
    g.setIndex(new THREE.BufferAttribute(this.idx.subarray(0, this.indices), 1));
    g.computeBoundingSphere();
    return g;
  }

  get triangleCount(): number { return Math.floor(this.indices / 3); }
}

export interface ChunkGeometry {
  opaque: THREE.BufferGeometry | null;
  transparent: THREE.BufferGeometry | null;
  emissive: THREE.BufferGeometry | null;
  tris: number;
}

/**
 * Build the three geometries for one chunk.
 * `origin` is the chunk's world-space minimum corner.
 */
export function buildChunkGeometry(
  src: TileSource,
  origin: { x: number; y: number; z: number },
  atlasCellOf: (tile: number) => number,
  glowOf: (tile: number) => number,
  variantOf: (tile: number) => number
): ChunkGeometry {
  const op = new MeshBuilder(4096);
  const tr = new MeshBuilder(2048);
  const em = new MeshBuilder(1024);

  const axisLen = (a: number) => (a === 0 ? CHUNK_X : a === 1 ? CHUNK_Y : CHUNK_Z);
  const originAx = (a: number) => (a === 0 ? origin.x : a === 1 ? origin.y : origin.z);

  for (let f = 0; f < FACES.length; f++) {
    const dir = FACES[f];
    const du = axisLen(dir.uAxis);
    const dv = axisLen(dir.vAxis);
    const dd = axisLen(dir.depthAxis);

    const tileAt = new Int32Array(du * dv).fill(-1);
    const passAt = new Uint8Array(du * dv);

    // Unit vectors along the two tangent axes.
    const uDir = [0, 0, 0]; uDir[dir.uAxis] = 1;
    const vDir = [0, 0, 0]; vDir[dir.vAxis] = 1;
    // Unit normal.
    const nrm = [dir.nx, dir.ny, dir.nz];

    for (let d = 0; d < dd; d++) {
      tileAt.fill(-1);
      for (let i = 0; i < tileAt.length; i++) passAt[i] = 0;

      for (let vv = 0; vv < dv; vv++) {
        for (let uu = 0; uu < du; uu++) {
          // Block P — the solid side of the face.
          const p = [0, 0, 0];
          p[dir.depthAxis] = originAx(dir.depthAxis) + d;
          p[dir.uAxis] = originAx(dir.uAxis) + uu;
          p[dir.vAxis] = originAx(dir.vAxis) + vv;

          const tile = src.get(p[0], p[1], p[2]);
          if (!occludes(tile)) continue;
          const front = src.get(p[0] + nrm[0], p[1] + nrm[1], p[2] + nrm[2]);
          if (occludes(front)) continue;

          const idx = vv * du + uu;
          tileAt[idx] = tile;
          passAt[idx] = passOf(tile);
        }
      }

      // ---- greedy merge across this slice --------------------------
      // Consumed cells are cleared to -1 instead of being skipped by moving the
      // row cursor, so a wide quad and a tall quad can coexist in one slice.
      for (let vv = 0; vv < dv; vv++) {
        let uu = 0;
        while (uu < du) {
          const i0 = vv * du + uu;
          const tile0 = tileAt[i0];
          if (tile0 < 0) { uu++; continue; }
          const pass0 = passAt[i0];

          let w = 1;
          while (uu + w < du) {
            const inext = vv * du + (uu + w);
            if (tileAt[inext] !== tile0 || passAt[inext] !== pass0) break;
            w++;
          }

          let h = 1;
          while (vv + h < dv) {
            let ok = true;
            for (let k = 0; k < w; k++) {
              const cell = (vv + h) * du + (uu + k);
              if (tileAt[cell] !== tile0 || passAt[cell] !== pass0) { ok = false; break; }
            }
            if (!ok) break;
            h++;
          }

          // ---- face plane origin Q --------------------------------
          const q = [0, 0, 0];
          q[dir.depthAxis] = originAx(dir.depthAxis) + d + (nrm[dir.depthAxis] > 0 ? 1 : 0);
          q[dir.uAxis] = originAx(dir.uAxis) + uu;
          q[dir.vAxis] = originAx(dir.vAxis) + vv;

          // ---- per-vertex ambient occlusion -----------------------
          // The minimum across the four corners keeps seams dark rather than
          // bright, which reads as "solid" instead of "gappy".
          let aoMin = 3;
          const cornerSigns = [[-1, -1], [1, -1], [-1, 1], [1, 1]];
          for (let s = 0; s < 4; s++) {
            const su = cornerSigns[s][0], sv = cornerSigns[s][1];
            const cx = q[0] + su * uDir[0] * w + sv * vDir[0] * h;
            const cy = q[1] + su * uDir[1] * w + sv * vDir[1] * h;
            const cz = q[2] + su * uDir[2] * w + sv * vDir[2] * h;
            const ao = aoAt(
              src, cx, cy, cz,
              su * uDir[0], su * uDir[1], su * uDir[2],
              sv * vDir[0], sv * vDir[1], sv * vDir[2],
              su * uDir[0] + sv * vDir[0],
              su * uDir[1] + sv * vDir[1],
              su * uDir[2] + sv * vDir[2],
              nrm[0], nrm[1], nrm[2]
            );
            if (ao < aoMin) aoMin = ao;
          }

          let light = 0.72;
          if (nrm[1] > 0) light = 1.0;
          else if (nrm[1] < 0) light = 0.3;
          const bright = light * (0.55 + (aoMin / 3) * 0.45);

          // ---- texture cell ---------------------------------------
          const cell = atlasCellOf(tile0) + variantOf(tile0);
          const inv = 1 / ATLAS_TILES_PER_ROW;
          const texU0 = (cell % ATLAS_TILES_PER_ROW) * inv;
          const texV0 = Math.floor(cell / ATLAS_TILES_PER_ROW) * inv;
          const texU1 = texU0 + inv;
          const texV1 = texV0 + inv;

          const target = pass0 === 2 ? tr : op;
          // Corner (i,j): i in {0,w} along u, j in {0,h} along v.
          const c00x = q[0], c00y = q[1], c00z = q[2];
          const c10x = q[0] + uDir[0] * w, c10y = q[1] + uDir[1] * w, c10z = q[2] + uDir[2] * w;
          const c01x = q[0] + vDir[0] * h, c01y = q[1] + vDir[1] * h, c01z = q[2] + vDir[2] * h;
          const c11x = c10x + vDir[0] * h, c11y = c10y + vDir[1] * h, c11z = c10z + vDir[2] * h;

          const n0 = nrm[0], n1 = nrm[1], n2 = nrm[2];
          const v00 = target.vertex(c00x, c00y, c00z, n0, n1, n2, texU0, texV0, bright, bright, bright);
          const v10 = target.vertex(c10x, c10y, c10z, n0, n1, n2, texU1, texV0, bright, bright, bright);
          const v11 = target.vertex(c11x, c11y, c11z, n0, n1, n2, texU1, texV1, bright, bright, bright);
          const v01 = target.vertex(c01x, c01y, c01z, n0, n1, n2, texU0, texV1, bright, bright, bright);
          if (dir.flip) target.quad(v00, v01, v11, v10);
          else target.quad(v00, v10, v11, v01);

          const g = glowOf(tile0);
          if (g > 0.02) {
            const gr = Math.min(1, g * 1.25), gg = Math.min(1, g * 1.0), gb = Math.min(1, g * 1.35);
            const e00 = em.vertex(c00x, c00y, c00z, n0, n1, n2, texU0, texV0, gr, gg, gb);
            const e10 = em.vertex(c10x, c10y, c10z, n0, n1, n2, texU1, texV0, gr, gg, gb);
            const e11 = em.vertex(c11x, c11y, c11z, n0, n1, n2, texU1, texV1, gr, gg, gb);
            const e01 = em.vertex(c01x, c01y, c01z, n0, n1, n2, texU0, texV1, gr, gg, gb);
            if (dir.flip) em.quad(e00, e01, e11, e10);
            else em.quad(e00, e10, e11, e01);
          }

          // Claim the covered cells so none of them are re-emitted.
          for (let l = 0; l < h; l++) {
            for (let k = 0; k < w; k++) {
              tileAt[(vv + l) * du + (uu + k)] = -1;
            }
          }
          uu += w;
        }
      }
    }
  }

  return {
    opaque: op.build(),
    transparent: tr.build(),
    emissive: em.build(),
    tris: op.triangleCount + tr.triangleCount + em.triangleCount,
  };
}
