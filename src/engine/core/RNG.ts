/**
 * Deterministic pseudo-random numbers.
 *
 * Two independent generators are exposed:
 *   - `RNG`   : a fast splitmix64-seeded xorshift128+ state machine used for
 *               gameplay rolls (drops, crits, spawns). Cheap, never allocates.
 *   - `hash32`: a pure integer hash used for *world* generation so that terrain
 *               is stable across sessions and machines (no floating point drift).
 *
 * Everything the world builds from is a hash of (x, y, z, salt), which means a
 * hand-authored region table can be scattered across an infinite-looking map
 * without ever producing the same hill twice.
 */

export type RNGState = [number, number, number, number];

export const MASK32 = 0xffffffff;

/** Reinterpret a float as its 32-bit bit pattern. */
export function bits(n: number): number {
  return n | 0;
}

/** Integer hash of three ints -> uint32. Cheap, branchless, well distributed. */
export function hash3(x: number, y: number, z: number, salt = 0): number {
  let h = salt | 0;
  h = Math.imul(h ^ (x | 0), 0x27d4eb2d);
  h = Math.imul(h ^ (y | 0), 0x165667b1);
  h = Math.imul(h ^ (z | 0), 0x9e3779b1);
  h ^= h >>> 15;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Hash two ints -> uint32. */
export function hash2(x: number, y: number, salt = 0): number {
  return hash3(x, y, 0, salt);
}

/** Float in [0,1) from a uint32. */
export function unif(h: number): number {
  return h * 2.3283064365386963e-10;
}

/** Float in [-1,1). */
export function range(h: number): number {
  return unif(h) * 2 - 1;
}

/**
 * Value noise: bilinear-smoothed hash noise in [-1,1].
 * `period` optionally wraps the lattice so repeating structures tile seamlessly.
 */
export function valueNoise(x: number, y: number, z: number, salt = 0): number {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const w = zf * zf * (3 - 2 * zf);
  const c000 = unif(hash3(xi, yi, zi, salt));
  const c100 = unif(hash3(xi + 1, yi, zi, salt));
  const c010 = unif(hash3(xi, yi + 1, zi, salt));
  const c110 = unif(hash3(xi + 1, yi + 1, zi, salt));
  const c001 = unif(hash3(xi, yi, zi + 1, salt));
  const c101 = unif(hash3(xi + 1, yi, zi + 1, salt));
  const c011 = unif(hash3(xi, yi + 1, zi + 1, salt));
  const c111 = unif(hash3(xi + 1, yi + 1, zi + 1, salt));
  const x00 = c000 + (c100 - c000) * u;
  const x10 = c010 + (c110 - c010) * u;
  const x01 = c001 + (c101 - c001) * u;
  const x11 = c011 + (c111 - c011) * u;
  const y0 = x00 + (x10 - x00) * v;
  const y1 = x01 + (x11 - x01) * v;
  return y0 + (y1 - y0) * w;
}

/** Fractal Brownian motion — sums N octaves of value noise. */
export function fbm(
  x: number, y: number, z: number,
  octaves = 4, salt = 0, lacunarity = 2.03, gain = 0.5
): number {
  let sum = 0, amp = 1, norm = 0, f = 1;
  for (let i = 0; i < octaves; i++) {
    sum += amp * valueNoise(x * f, y * f, z * f, salt + i * 1013);
    norm += amp;
    amp *= gain;
    f *= lacunarity;
  }
  return sum / norm;
}

/** Worley/cellular-ish jitter for organic placement. */
export function cellular(x: number, z: number, salt = 0): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  const xf = x - xi, zf = z - zi;
  let best = 1, second = 1;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dz = -1; dz <= 1; dz++) {
      const n = unif(hash2(xi + dx, zi + dz, salt));
      const d = Math.hypot(dx + n - xf, dz + unif(hash2(xi + dx + 91, zi + dz + 7, salt + 3)) - zf);
      if (d < best) { second = best; best = d; }
      else if (d < second) second = d;
    }
  }
  return best + (second - best) * 0.5;
}

/** Fast, allocation-free xorshift128+ RNG. */
export class RNG {
  private a = 0; private b = 0; private c = 0; private d = 0;

  constructor(seed = 0x9e3779b9) {
    // splitmix32 seeding: the standard way to fill a xorshift state from a
    // single integer. A plain multiply leaves the high words correlated with
    // the seed, which is how a generator ends up biased without looking wrong.
    let z = (seed >>> 0) || 1;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    this.a = (z ^ (z >>> 16)) >>> 0;
    z = Math.imul(this.a ^ (this.a >>> 15), 0x27d4eb2f) >>> 0;
    this.b = (z ^ (z >>> 15)) >>> 0;
    z = Math.imul(this.b ^ (this.b >>> 15), 0x27d4eb2f) >>> 0;
    this.c = (z ^ (z >>> 15)) >>> 0;
    z = Math.imul(this.c ^ (this.c >>> 15), 0x27d4eb2f) >>> 0;
    this.d = (z ^ (z >>> 15)) >>> 0;
    // xorshift32 stalls on a zero state, and a seed of 0 is a legal input.
    if (this.a === 0 && this.b === 0) this.b = 0x9e3779b9;
    if (this.c === 0 && this.d === 0) this.d = 0x85ebca6b;
  }

  /**
   * Next uint32, full range.
   *
   * Two independent streams are XORed together: a canonical xorshift128+ on the
   * low words and a xorshift32 on the high words. Both halves of the state stay
   * live, which is what makes `state`/`load` reproduce a fork exactly, and XOR
   * of two full-range streams is itself full-range.
   *
   * The earlier version of this method mixed the words in a way that forced the
   * top eight bits of every output to zero. That capped `nextFloat()` at about
   * 0.004, so `chance(0.5)` was always true, `int(0, 3)` always returned 0 and
   * every weighted table collapsed onto its first entry. Every drop table, affix
   * roll and spawn pick in the game ran on that, which is a bug worth stating
   * plainly: the numbers were random-looking and the distribution was not.
   */
  next(): number {
    const s0 = this.a;
    const s1 = this.b;
    const result = (s0 + s1) >>> 0;
    this.a = s1;
    this.b = result;

    let x = this.c;
    x = (x ^ (x << 13)) >>> 0;
    x = (x ^ (x >>> 17)) >>> 0;
    x = (x ^ (x << 5)) >>> 0;
    this.c = this.d;
    this.d = x;

    return (result ^ x) >>> 0;
  }

  /** Float in [0,1). */
  nextFloat(): number {
    return this.next() * 2.3283064365386963e-10;
  }

  /** Float in [min,max). */
  range(min: number, max: number): number {
    return min + (max - min) * this.nextFloat();
  }

  /** Integer in [min,max] inclusive. */
  int(min: number, max: number): number {
    if (max <= min) return min;
    return min + Math.floor(this.nextFloat() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean {
    return this.nextFloat() < p;
  }

  /** Weighted pick. `items` is [value, weight] pairs. */
  weighted<T>(items: Array<[T, number]>): T {
    let total = 0;
    for (let i = 0; i < items.length; i++) total += items[i][1];
    let r = this.nextFloat() * total;
    for (let i = 0; i < items.length; i++) {
      r -= items[i][1];
      if (r <= 0) return items[i][0];
    }
    return items[items.length - 1][0];
  }

  /** Pick one element of an array. */
  pick<T>(arr: readonly T[]): T {
    return arr[this.int(0, arr.length - 1)];
  }

  /** Shuffle into a new array (Fisher-Yates). */
  shuffle<T>(arr: readonly T[]): T[] {
    const out = arr.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = this.int(0, i);
      const t = out[i]; out[i] = out[j]; out[j] = t;
    }
    return out;
  }

  /** Standard normal via Box-Muller. */
  gauss(mean = 0, std = 1): number {
    let u = 0, v = 0;
    while (u === 0) u = this.nextFloat();
    while (v === 0) v = this.nextFloat();
    return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  get state(): RNGState {
    return [this.a, this.b, this.c, this.d];
  }

  load(s: RNGState): void {
    this.a = s[0] || 1; this.b = s[1]; this.c = s[2]; this.d = s[3];
  }
}

/** A RNG that can be forked cheaply — used by per-region generators. */
export class ForkedRNG {
  readonly root: RNG;
  private depth = 0;

  constructor(seed: number) {
    this.root = new RNG(seed);
  }

  fork(label: number): RNG {
    const base = hash2(this.root.next() >>> 0, label, 0x5bd1e995);
    return new RNG(base);
  }

  push(): void { this.depth++; }
  pop(): void { this.depth--; }
}
