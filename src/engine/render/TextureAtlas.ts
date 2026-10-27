/**
 * Procedural texture atlas.
 *
 * Eternity ships **zero image files**. Every block face is painted at runtime
 * into one 1024x1024 RGBA canvas (32 tiles per row, 1024 cells, 32px each)
 * which becomes a single `CanvasTexture`. That means:
 *
 *   - the download is a few hundred KB instead of a hundred MB of PNGs,
 *   - textures are infinitely sharp on any DPI because they are generated at
 *     full resolution from maths, not stretched from a bitmap,
 *   - the whole atlas builds in roughly 15ms, once, at boot.
 *
 * Each tile declares a base colour, an accent colour and a *pattern*; the
 * pattern functions are what give the world its hand-authored texture variety
 * (brickwork, planks, cracked stone, leaf litter, sand, snow, forged metal…).
 */

import type * as THREE from 'three';

export type PatternType =
  | 'solid'
  | 'noise'
  | 'cracks'
  | 'stripes'
  | 'stripesV'
  | 'diag'
  | 'dots'
  | 'brick'
  | 'planks'
  | 'leaf'
  | 'sand'
  | 'snow'
  | 'metal'
  | 'rings'
  | 'glass'
  | 'water'
  | 'lava'
  | 'crystal'
  | 'bone'
  | 'cloth'
  | 'carpet'
  | 'chain'
  | 'soil'
  | 'moss'
  | 'scorch'
  | 'ember'
  | 'void';

export interface TileSpec {
  id: number;
  name: string;
  base: [number, number, number];
  accent?: [number, number, number];
  accent2?: [number, number, number];
  pattern: PatternType;
  /** 0 = empty, 1 = opaque, 2 = translucent-solid (glass, leaves, water). */
  cat: 0 | 1 | 2;
  flags: number;
  /** 0..1 emissive brightness (torches, runes, crystals, lava). */
  glow?: number;
  /** Number of colour variants generated for this tile id. */
  variants?: number;
  /** Per-face override (e.g. GRASS_TOP on top of DIRT). */
  top?: number;
  side?: number;
  bottom?: number;
}

export const TILE_PX = 32;
export const ATLAS_TILES_PER_ROW = 32;
export const ATLAS_SIZE = TILE_PX * ATLAS_TILES_PER_ROW; // 1024
export const ATLAS_CAPACITY = ATLAS_TILES_PER_ROW * ATLAS_TILES_PER_ROW; // 1024

/** Cheap deterministic per-pixel hash → [0,1). */
function prand(x: number, y: number, salt: number): number {
  let h = (x | 0) * 374761393 + (y | 0) * 668265263 + salt * 2147483647;
  h = (h ^ (h >>> 13)) * 1274126177;
  h = h ^ (h >>> 16);
  return ((h >>> 0) % 100000) / 100000;
}

function shade(c: [number, number, number], f: number): [number, number, number] {
  return [clamp255(c[0] * f), clamp255(c[1] * f), clamp255(c[2] * f)];
}
function clamp255(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v | 0;
}
function mix(a: [number, number, number], b: [number, number, number], t: number): [number, number, number] {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** A tiny seeded RNG for tile textures so they are stable across boots. */
class TexRNG {
  private s = 1;
  constructor(seed: number) { this.s = (seed ^ 0x9e3779b9) >>> 0 || 1; }
  next(): number {
    this.s ^= this.s << 13; this.s >>>= 0;
    this.s ^= this.s >> 17;
    this.s ^= this.s << 5; this.s >>>= 0;
    return this.s / 4294967296;
  }
}

export interface AtlasResult {
  canvas: HTMLCanvasElement;
  /** atlas cell index for each (tile, variant) pair. */
  cells: Int32Array;
  /** Atlas cell for tile id (variant 0). */
  cellOf: Int32Array;
  tileCount: number;
}

export class TextureAtlas {
  result: AtlasResult | null = null;
  /** THREE texture, created after `build()`. */
  texture: THREE.Texture | null = null;

  /**
   * Build the atlas from the tile registry.
   * `variants` is the list of variant indices each tile uses; tiles with
   * `variants > 1` occupy consecutive cells so the mesher can pick a random one.
   */
  build(tiles: TileSpec[], variantCount: number[]): AtlasResult {
    const canvas = document.createElement('canvas');
    canvas.width = ATLAS_SIZE;
    canvas.height = ATLAS_SIZE;
    const ctx = canvas.getContext('2d', { willReadFrequently: false })!;
    const image = ctx.createImageData(ATLAS_SIZE, ATLAS_SIZE);
    const d = image.data;

    // Paint a transparent base so unfilled cells stay invisible.
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 0; d[i + 1] = 0; d[i + 2] = 0; d[i + 3] = 0;
    }

    // `cells` is indexed by tile position in the input array (4 per tile, one
    // per variant); `cellOf` is indexed by tile id, which runs past 255, so it
    // has to be sized by the largest id rather than by a fixed 256.
    let maxId = 0;
    for (const spec of tiles) if (spec.id > maxId) maxId = spec.id;
    const cells = new Int32Array(Math.max(ATLAS_CAPACITY, tiles.length * 4)).fill(-1);
    const cellOf = new Int32Array(maxId + 1).fill(-1);
    let cursor = 0;

    for (let t = 0; t < tiles.length; t++) {
      const spec = tiles[t];
      const nv = variantCount[t] ?? 1;
      for (let v = 0; v < nv; v++) {
        if (cursor >= ATLAS_CAPACITY) break;
        const ox = (cursor % ATLAS_TILES_PER_ROW) * TILE_PX;
        const oy = Math.floor(cursor / ATLAS_TILES_PER_ROW) * TILE_PX;
        this.paintTile(d, ox, oy, spec, v, new TexRNG(spec.id * 7919 + v * 104729 + 13));
        cells[t * 4 + v] = cursor;
        if (v === 0) cellOf[spec.id] = cursor;
        cursor++;
      }
    }

    ctx.putImageData(image, 0, 0);
    this.result = { canvas, cells, cellOf, tileCount: cursor };
    return this.result;
  }

  private paintTile(
    d: Uint8ClampedArray,
    ox: number, oy: number,
    spec: TileSpec,
    variant: number,
    rng: TexRNG
  ): void {
    const base = spec.base;
    const accent = spec.accent ?? base;
    const accent2 = spec.accent2 ?? spec.accent ?? base;
    let tintShift = 0;
    if (spec.pattern === 'leaf' || spec.pattern === 'moss' || spec.pattern === 'sand' || spec.pattern === 'soil') {
      tintShift = variant === 0 ? 0 : 1;
    }

    for (let y = 0; y < TILE_PX; y++) {
      for (let x = 0; x < TILE_PX; x++) {
        let c: [number, number, number] = base;
        let alpha = 255;
        const n = prand(x, y, spec.id * 31 + variant * 7);
        const n2 = prand(x + 11, y + 7, spec.id * 17 + variant * 3);
        switch (spec.pattern) {
          case 'solid':
            c = mix(base, accent, n * 0.35);
            c = mix(c, shade(c, 0.82 + n2 * 0.36), 0.4);
            break;
          case 'noise':
            c = mix(base, accent, n * 0.85);
            c = mix(c, shade(c, 0.7 + n2 * 0.5), 0.55);
            if (n > 0.9) c = mix(c, accent2, 0.7);
            break;
          case 'cracks':
            c = mix(base, shade(base, 0.62), 0.35);
            if (n > 0.82) {
              c = shade(base, 0.34);
              if (n2 > 0.5) c = shade(accent, 0.5);
            } else if (n > 0.7) {
              c = shade(base, 0.78);
            }
            break;
          case 'stripes':
            c = (y % 4 < 2) ? mix(base, accent, 0.15 + n * 0.2) : shade(base, 0.86 + n * 0.2);
            break;
          case 'stripesV':
            c = (x % 4 < 2) ? mix(base, accent, 0.15 + n * 0.2) : shade(base, 0.86 + n * 0.2);
            break;
          case 'diag':
            c = ((x + y) % 6 < 3) ? mix(base, accent, 0.1) : shade(base, 0.88);
            break;
          case 'dots':
            c = shade(base, 0.9);
            if (n > 0.86) c = accent;
            else if (n > 0.72) c = shade(accent, 0.7);
            break;
          case 'brick': {
            const row = Math.floor(y / 8);
            const off = (row % 2) * 8;
            const inMortar = (x + off) % 16 === 0 || (x + off) % 16 === 15 || y % 8 === 0;
            c = inMortar ? shade(base, 0.6) : mix(accent, shade(accent, 0.8), n * 0.4);
            break;
          }
          case 'rings': {
            const r = Math.hypot(x - 16, y - 16);
            c = mix(base, shade(base, 0.78), Math.max(0, 1 - r / 20) * 0.6);
            if (Math.abs(r - 8) < 1.6 || Math.abs(r - 15) < 1.6) c = shade(base, 0.62);
            break;
          }
          case 'planks': {
            const row = Math.floor(y / 6);
            const off = (row % 2) * 8;
            const seam = (x + off) % 16 === 0 || (x + off) % 16 === 15 || y % 6 === 0;
            c = seam ? shade(base, 0.55) : mix(base, accent, n * 0.3);
            if (n > 0.93) c = shade(base, 0.72); // nail / grain knot
            break;
          }
          case 'leaf':
            c = n > 0.72 ? accent : mix(base, accent, 0.25 + n * 0.5);
            if (n2 > 0.86) c = accent2;
            if (n > 0.96) c = shade(base, 0.4); // hole in the canopy
            break;
          case 'sand':
            c = mix(base, accent, n * 0.5);
            if (n > 0.9) c = shade(accent2, 0.8);
            break;
          case 'snow':
            c = mix(base, [245, 250, 255], 0.72 + n * 0.28);
            if (n > 0.94) c = [255, 255, 255];
            else if (n < 0.06) c = shade(base, 0.8);
            break;
          case 'metal':
            c = mix(base, shade(base, 0.7), 0.35 + Math.abs(Math.sin(x * 0.35)) * 0.3);
            if (n > 0.93) c = accent;
            break;
          case 'glass':
            c = [170, 215, 240];
            alpha = (x % 16 === 0 || y % 16 === 0 || ((x + y) % 16 === 0 && n > 0.5)) ? 255 : 46;
            if (n > 0.88) { c = [220, 245, 255]; alpha = 190; }
            break;
          case 'water':
            c = mix([40, 110, 200], [120, 200, 250], 0.4 + Math.sin((x + y) * 0.5) * 0.2);
            alpha = 150;
            if (n > 0.9) { c = [200, 240, 255]; alpha = 200; }
            break;
          case 'lava':
            c = n > 0.62 ? [255, 140, 30] : mix([90, 20, 5], [230, 90, 10], n * 1.2);
            if (n2 > 0.94) c = [255, 230, 140];
            break;
          case 'crystal':
            c = mix(base, accent, n * 0.7);
            if (n2 > 0.8) c = shade(accent, 1.25);
            if (n > 0.95) c = [255, 255, 255];
            break;
          case 'bone':
            c = mix([235, 228, 205], [180, 168, 140], n * 0.8);
            if (n2 > 0.9) c = [120, 110, 90];
            break;
          case 'cloth':
            c = mix(base, accent, n * 0.6);
            if (Math.floor(y / 8) % 2 === 0) c = shade(c, 0.92);
            break;
          case 'carpet':
            c = (x % 4 === 0 || y % 4 === 0) ? shade(base, 0.72) : mix(base, accent, n * 0.4);
            break;
          case 'chain':
            c = (Math.hypot(x - 16, y - 16) < 9) ? shade(base, 0.75) : shade(base, 0.45);
            break;
          case 'soil':
            c = mix(base, accent, n * 0.7);
            if (n > 0.9) c = shade(base, 0.5);
            break;
          case 'moss':
            c = n > 0.55 ? accent : shade(base, 0.8 + n * 0.3);
            if (n2 > 0.9) c = [110, 180, 90];
            break;
          case 'scorch':
            c = mix([35, 32, 30], [12, 11, 10], n);
            if (n > 0.86) c = [8, 7, 6];
            break;
          case 'ember':
            c = n > 0.5 ? mix([255, 120, 20], [120, 30, 5], n) : [40, 12, 6];
            if (n2 > 0.93) c = [255, 220, 150];
            break;
          case 'void':
            c = [8, 8, 14];
            alpha = 255;
            break;
          default:
            c = mix(base, accent, n * 0.4);
        }

        const px = ((oy + y) * ATLAS_SIZE + (ox + x)) * 4;
        d[px] = clamp255(c[0]);
        d[px + 1] = clamp255(c[1]);
        d[px + 2] = clamp255(c[2]);
        d[px + 3] = alpha;
      }
    }

    // Variants shift the base hue slightly so large surfaces don't look flat.
    if (variant > 0 && (spec.pattern === 'noise' || spec.pattern === 'leaf' || spec.pattern === 'sand' || spec.pattern === 'moss')) {
      const f = 0.9 + (variant % 3) * 0.06;
      const g = 1.0 + (variant % 2) * 0.05;
      for (let y = 0; y < TILE_PX; y++) {
        for (let x = 0; x < TILE_PX; x++) {
          const px = ((oy + y) * ATLAS_SIZE + (ox + x)) * 4;
          if (d[px + 3] < 16) continue;
          d[px] = clamp255(d[px] * f);
          d[px + 1] = clamp255(d[px + 1] * g);
          d[px + 2] = clamp255(d[px + 2] * f);
        }
      }
    }
    void tintShift;
  }

  /** Convert an atlas cell index into UV0/UV1 for a face. */
  uvFor(cell: number, out: [number, number, number, number]): void {
    if (cell < 0) { out[0] = 0; out[1] = 0; out[2] = 0.0625; out[3] = 0.0625; return; }
    const col = cell % ATLAS_TILES_PER_ROW;
    const row = Math.floor(cell / ATLAS_TILES_PER_ROW);
    const inv = 1 / ATLAS_TILES_PER_ROW;
    out[0] = col * inv;
    out[1] = row * inv;
    out[2] = out[0] + inv;
    out[3] = out[1] + inv;
  }
}
