/**
 * Tween engine.
 *
 * Two flavours:
 *   - `Tween`     : imperative, you own the object, you call `.update(dt)`.
 *   - `Timeline`  : declarative sequence/parallel groups for UI and menu
 *                   choreography (title screen, level-up burst, game over).
 *
 * Every tween is allocation-conscious: completed tweens are dropped from their
 * owner list instead of being kept alive, which matters on mobile where GC
 * pauses are the enemy of 60fps.
 */

export interface TweenOptions {
  duration: number;
  delay?: number;
  ease?: (t: number) => number;
  /** Called with the eased value every frame. */
  onUpdate: (v: number, raw: number) => void;
  onComplete?: () => void;
  onCancel?: () => void;
  /** Loop: `repeat` times, or `true` for ping-pong forever. */
  repeat?: number | boolean;
  yoyo?: boolean;
  /** Remove itself from the owner when done. */
  autoRemove?: boolean;
}

export class Tween {
  time = 0;
  delay = 0;
  duration = 1;
  ease: (t: number) => number;
  onUpdate: (v: number, raw: number) => void;
  onComplete?: () => void;
  onCancel?: () => void;
  repeat: number | boolean = 0;
  yoyo = false;
  autoRemove = true;
  private loops = 0;
  private ping = false;
  done = false;

  constructor(opts: TweenOptions) {
    this.duration = Math.max(0.0001, opts.duration);
    this.delay = opts.delay ?? 0;
    this.ease = opts.ease ?? ((t: number) => t);
    this.onUpdate = opts.onUpdate;
    this.onComplete = opts.onComplete;
    this.onCancel = opts.onCancel;
    this.repeat = opts.repeat ?? 0;
    this.yoyo = opts.yoyo ?? false;
    this.autoRemove = opts.autoRemove ?? true;
  }

  update(dt: number): boolean {
    if (this.done) return false;
    if (this.delay > 0) { this.delay -= dt; return true; }
    this.time += dt;
    let t = Math.min(1, this.time / this.duration);
    const eased = this.ease(this.ping ? 1 - t : t);
    this.onUpdate(eased, t);
    if (t < 1) return true;

    // Completed a pass.
    if (this.onComplete) this.onComplete();

    if (this.repeat === true) {
      this.loops = 0;
      this.ping = !this.ping;
      this.time = 0;
      return true;
    }
    if (typeof this.repeat === 'number' && this.loops < this.repeat) {
      this.loops++;
      this.ping = !this.ping;
      this.time = 0;
      return true;
    }
    this.done = true;
    return false;
  }

  cancel(): void {
    if (this.done) return;
    this.done = true;
    if (this.onCancel) this.onCancel();
  }
}

/** A list of tweens that updates and prunes itself. */
export class TweenList {
  private items: Tween[] = [];

  add(tw: Tween): Tween {
    this.items.push(tw);
    return tw;
  }

  /** Build a tween with fluent-ish options. */
  to(opts: Omit<TweenOptions, 'autoRemove'> & { autoRemove?: boolean }): Tween {
    const tw = new Tween(opts as TweenOptions);
    this.items.push(tw);
    return tw;
  }

  update(dt: number): void {
    if (this.items.length === 0) return;
    const keep: Tween[] = [];
    for (let i = 0; i < this.items.length; i++) {
      const tw = this.items[i];
      if (tw.update(dt)) keep.push(tw);
      else if (!tw.autoRemove) keep.push(tw);
    }
    this.items = keep;
  }

  clear(cancel = true): void {
    if (cancel) for (const t of this.items) t.cancel();
    this.items.length = 0;
  }

  get count(): number { return this.items.length; }
  get empty(): boolean { return this.items.length === 0; }
}

export interface TimelineStep {
  at: number;
  fn: () => void;
}

/** A fire-and-forget sequence used by UI screens. */
export class Timeline {
  private steps: TimelineStep[] = [];
  private t = 0;
  private cursor = 0;

  constructor(steps: TimelineStep[] = []) {
    this.steps = steps.slice();
    this.steps.sort((a, b) => a.at - b.at);
  }

  update(dt: number): void {
    this.t += dt;
    while (this.cursor < this.steps.length && this.t >= this.steps[this.cursor].at) {
      this.steps[this.cursor].fn();
      this.cursor++;
    }
  }

  get finished(): boolean { return this.cursor >= this.steps.length; }
}

/** A very small state machine helper for UI screens. */
export class FSM<T extends string> {
  private states = new Map<T, Set<(from: T | null, to: T) => void>>();
  private current: T | null = null;
  history: T[] = [];

  on(state: T, fn: (from: T | null, to: T) => void): void {
    let set = this.states.get(state);
    if (!set) { set = new Set(); this.states.set(state, set); }
    set.add(fn);
  }

  get currentState(): T | null { return this.current; }

  go(to: T, push = true): void {
    const from = this.current;
    if (from === to) return;
    this.current = to;
    if (push && from !== null) this.history.push(from);
    if (this.history.length > 32) this.history.shift();
    const set = this.states.get(to);
    if (set) for (const fn of Array.from(set)) fn(from, to);
  }

  back(): T | null {
    if (this.history.length === 0) return this.current;
    const prev = this.history.pop()!;
    this.go(prev, false);
    return prev;
  }
}
