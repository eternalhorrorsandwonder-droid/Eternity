/**
 * Frame clock + fixed-timestep accumulator + smooth interpolation helpers.
 *
 * The game runs a fixed 50Hz simulation with render interpolation so that
 * hit-detection and movement never depend on the display refresh rate. On a
 * 120Hz phone the sim still advances 50 times a second, which keeps netcode-free
 * collision consistent and stops "fast phone = easier game" weirdness.
 */

export const FIXED_HZ = 50;
export const FIXED_DT = 1 / FIXED_HZ;
export const MAX_FRAME_DT = 0.1;

export class Clock {
  private last = 0;
  private acc = 0;
  readonly dt: number = FIXED_DT;
  frameTime = 0;
  fps = 60;
  /** Rolling average of raw frame times (ms). */
  private ema = 16.6;

  /** Elapsed seconds since boot. */
  elapsed = 0;

  /** Game-time multiplier; 0 freezes the simulation (pause), <1 slow-mo. */
  timeScale = 1;

  reset(): void {
    this.last = performance.now();
    this.acc = 0;
    this.ema = 16.6;
  }

  /**
   * Advance the simulation. Call once per rAF.
   * Returns how many fixed steps ran (0 when paused or on the first frame).
   */
  step(now: number, update: (dt: number) => void): number {
    let elapsedMs = now - this.last;
    this.last = now;
    if (elapsedMs > MAX_FRAME_DT * 1000) elapsedMs = MAX_FRAME_DT * 1000;
    const raw = elapsedMs / 1000;
    this.ema = this.ema * 0.92 + (elapsedMs / Math.max(1, this.frameTime * 0)) * 0.08;
    this.ema = this.ema * 0.9 + (elapsedMs) * 0.1;
    this.frameTime = this.ema;
    this.fps = this.ema > 0 ? 1000 / this.ema : 60;
    this.elapsed += raw * this.timeScale;

    this.acc += raw * this.timeScale;
    let steps = 0;
    // Cap steps per frame to avoid the "spiral of death" after a reload.
    while (this.acc >= FIXED_DT && steps < 8) {
      update(FIXED_DT * this.timeScale);
      this.acc -= FIXED_DT;
      steps++;
    }
    if (this.acc > FIXED_DT * 8) this.acc = 0;
    return steps;
  }

  get smoothDt(): number {
    return Math.min(0.05, this.ema / 1000);
  }
}

/** Easing library — every juice curve in the game comes from here. */
export const Ease = {
  linear: (t: number) => t,
  inQuad: (t: number) => t * t,
  outQuad: (t: number) => t * (2 - t),
  inOutQuad: (t: number) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: (t: number) => t * t * t,
  outCubic: (t: number) => 1 - Math.pow(1 - t, 3),
  inOutCubic: (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  inQuart: (t: number) => t * t * t * t,
  outQuart: (t: number) => 1 - Math.pow(1 - t, 4),
  outQuint: (t: number) => 1 - Math.pow(1 - t, 5),
  inExpo: (t: number) => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
  outExpo: (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inBack: (t: number) => 2.70158 * t * t * t - 1.70158 * t * t,
  outBack: (t: number) => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  inOutBack: (t: number) =>
    t < 0.5
      ? (Math.pow(2 * t, 2) * (3.5949095 * 2 * t - 2.5949095)) / 2
      : (Math.pow(2 * t - 2, 2) * (3.5949095 * (t * 2 - 2) + 2.5949095) + 2) / 2,
  outElastic: (t: number) => {
    if (t === 0 || t === 1) return t;
    const p = 0.3;
    return Math.pow(2, -10 * t) * Math.sin(((t - p / 4) * (2 * Math.PI)) / p) + 1;
  },
  outBounce: (t: number) => {
    const n1 = 7.5625, d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) return n1 * (t -= 1.5 / d1) * t + 0.75;
    if (t < 2.5 / d1) return n1 * (t -= 2.25 / d1) * t + 0.9375;
    return n1 * (t -= 2.625 / d1) * t + 0.984375;
  },
};

/** Lerp / clamp helpers used everywhere. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}
export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}
export function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}
export function smoothstep(e0: number, e1: number, x: number): number {
  const t = clamp01((x - e0) / (e1 - e0 || 1e-6));
  return t * t * (3 - 2 * t);
}
export function damp(current: number, target: number, lambda: number, dt: number): number {
  return lerp(current, target, 1 - Math.exp(-lambda * dt));
}
export function approach(current: number, target: number, step: number): number {
  if (current < target) return Math.min(current + step, target);
  if (current > target) return Math.max(current - step, target);
  return target;
}
/** Smooth a frame-rate independent exponential ramp. */
export function rampTo(current: number, target: number, rate: number, dt: number): number {
  if (dt <= 0) return current;
  const t = 1 - Math.exp(-rate * dt);
  return lerp(current, target, t);
}
