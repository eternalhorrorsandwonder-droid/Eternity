/**
 * Vec3 math that does not allocate.
 *
 * Hot loops (chunk meshing, particle updates, physics) call these instead of
 * `new Vector3()` everywhere. The tiny per-frame allocation tax is exactly what
 * causes GC stalls on mobile, so the engine never allocates in a loop.
 */
export const Vec3 = {
  add(a: number[] | Float32Array, b: number[] | Float32Array, out: number[] | Float32Array, i = 0): void {
    out[i] = a[i] + b[i]; out[i + 1] = a[i + 1] + b[i + 1]; out[i + 2] = a[i + 2] + b[i + 2];
  },
  sub(a: number[] | Float32Array, b: number[] | Float32Array, out: number[] | Float32Array, i = 0): void {
    out[i] = a[i] - b[i]; out[i + 1] = a[i + 1] - b[i + 1]; out[i + 2] = a[i + 2] - b[i + 2];
  },
  scale(a: number[] | Float32Array, s: number, out: number[] | Float32Array, i = 0): void {
    out[i] = a[i] * s; out[i + 1] = a[i + 1] * s; out[i + 2] = a[i + 2] * s;
  },
  len(a: number[] | Float32Array, i = 0): number {
    return Math.sqrt(a[i] * a[i] + a[i + 1] * a[i + 1] + a[i + 2] * a[i + 2]);
  },
  dist(a: number[] | Float32Array, b: number[] | Float32Array, i = 0): number {
    const dx = a[i] - b[i], dy = a[i + 1] - b[i + 1], dz = a[i + 2] - b[i + 2];
    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  },
  dist2(a: number[] | Float32Array, b: number[] | Float32Array, i = 0): number {
    const dx = a[i] - b[i], dy = a[i + 1] - b[i + 1], dz = a[i + 2] - b[i + 2];
    return dx * dx + dy * dy + dz * dz;
  },
  dot(a: number[] | Float32Array, b: number[] | Float32Array, i = 0): number {
    return a[i] * b[i] + a[i + 1] * b[i + 1] + a[i + 2] * b[i + 2];
  },
  cross(a: number[] | Float32Array, b: number[] | Float32Array, out: number[] | Float32Array, i = 0): void {
    const ax = a[i], ay = a[i + 1], az = a[i + 2];
    const bx = b[i], by = b[i + 1], bz = b[i + 2];
    out[i] = ay * bz - az * by;
    out[i + 1] = az * bx - ax * bz;
    out[i + 2] = ax * by - ay * bx;
  },
  normalize(a: number[] | Float32Array, out: number[] | Float32Array, i = 0): number {
    const l = Vec3.len(a, i);
    if (l < 1e-8) { out[i] = 0; out[i + 1] = 0; out[i + 2] = 0; return 0; }
    const inv = 1 / l;
    out[i] = a[i] * inv; out[i + 1] = a[i + 1] * inv; out[i + 2] = a[i + 2] * inv;
    return l;
  },
  lerp(a: number[] | Float32Array, b: number[] | Float32Array, t: number, out: number[] | Float32Array, i = 0): void {
    out[i] = a[i] + (b[i] - a[i]) * t;
    out[i + 1] = a[i + 1] + (b[i + 1] - a[i + 1]) * t;
    out[i + 2] = a[i + 2] + (b[i + 2] - a[i + 2]) * t;
  },
  copy(a: number[] | Float32Array, out: number[] | Float32Array, i = 0): void {
    out[i] = a[i]; out[i + 1] = a[i + 1]; out[i + 2] = a[i + 2];
  },
};

/** Object pool with O(1) alloc/free via a free-list. */
export class Pool<T> {
  private free: T[] = [];
  private alive: T[] = [];

  constructor(
    private factory: () => T,
    private reset: (o: T) => void,
    initial = 0
  ) {
    for (let i = 0; i < initial; i++) this.free.push(factory());
  }

  acquire(): T {
    const o = this.free.pop() ?? this.factory();
    this.alive.push(o);
    return o;
  }

  release(o: T): void {
    const i = this.alive.indexOf(o);
    if (i >= 0) {
      this.alive[i] = this.alive[this.alive.length - 1];
      this.alive.pop();
      this.reset(o);
      this.free.push(o);
    }
  }

  releaseAll(): void {
    for (const o of this.alive) { this.reset(o); this.free.push(o); }
    this.alive.length = 0;
  }

  get size(): number { return this.alive.length; }
  forEach(fn: (o: T, i: number) => void): void {
    for (let i = 0; i < this.alive.length; i++) fn(this.alive[i], i);
  }
  /** Iterate and let the callback decide removals. */
  drain(fn: (o: T, i: number) => boolean): number {
    let removed = 0;
    let i = 0;
    while (i < this.alive.length) {
      const o = this.alive[i];
      if (fn(o, i)) {
        this.reset(o); this.free.push(o);
        this.alive[i] = this.alive[this.alive.length - 1];
        this.alive.pop();
        removed++;
      } else {
        i++;
      }
    }
    return removed;
  }
}

/** A fixed-capacity ring buffer of scalar samples (for FPS/perf graphs). */
export class RingBuffer {
  private data: Float32Array;
  private head = 0;
  private count = 0;

  constructor(private cap: number) {
    this.data = new Float32Array(cap);
  }

  push(v: number): void {
    this.data[this.head] = v;
    this.head = (this.head + 1) % this.cap;
    if (this.count < this.cap) this.count++;
  }

  get length(): number { return this.count; }
  get(i: number): number {
    if (i >= this.count) return 0;
    const start = (this.head - this.count + this.cap) % this.cap;
    return this.data[(start + i) % this.cap];
  }
  last(): number { return this.count ? this.data[(this.head - 1 + this.cap) % this.cap] : 0; }
  max(): number {
    let m = 0;
    for (let i = 0; i < this.count; i++) m = Math.max(m, this.get(i));
    return m;
  }
  avg(): number {
    let s = 0;
    for (let i = 0; i < this.count; i++) s += this.get(i);
    return this.count ? s / this.count : 0;
  }
}
