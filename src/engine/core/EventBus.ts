/**
 * A tiny typed event bus. Systems talk to each other through it instead of
 * holding direct references, which keeps the game data-driven and makes whole
 * subsystems swappable at runtime (e.g. pausing the world but not the UI).
 */
export type Handler<T = any> = (payload: T) => void;

export class EventBus {
  private map = new Map<string, Set<Handler>>();
  private onceMap = new Map<string, Set<Handler>>();
  /** Events dropped while a system is paused. */
  private paused = false;
  private buffered: Array<[string, any]> = [];

  on<T = any>(type: string, fn: Handler<T>): () => void {
    let set = this.map.get(type);
    if (!set) { set = new Set(); this.map.set(type, set); }
    set.add(fn as Handler);
    return () => this.off(type, fn);
  }

  once<T = any>(type: string, fn: Handler<T>): () => void {
    let set = this.onceMap.get(type);
    if (!set) { set = new Set(); this.onceMap.set(type, set); }
    const wrap = (p: T) => { this.offOnce(type, wrap); fn(p); };
    set.add(wrap as Handler);
    return () => this.offOnce(type, wrap);
  }

  off(type: string, fn: Handler): void {
    this.map.get(type)?.delete(fn);
  }

  private offOnce(type: string, fn: Handler): void {
    this.onceMap.get(type)?.delete(fn);
  }

  emit<T = any>(type: string, payload?: T): void {
    if (this.paused) {
      this.buffered.push([type, payload]);
      return;
    }
    const set = this.map.get(type);
    if (set) {
      // Copy so handlers can unsubscribe mid-dispatch.
      for (const fn of Array.from(set)) {
        try { fn(payload as T); }
        catch (err) { console.error(`[bus] handler for "${type}" threw`, err); }
      }
    }
    const once = this.onceMap.get(type);
    if (once) {
      const list = Array.from(once);
      once.clear();
      for (const fn of list) {
        try { fn(payload as T); }
        catch (err) { console.error(`[bus] once handler for "${type}" threw`, err); }
      }
    }
  }

  /** Buffer every event until `resume()` — used by the pause menu. */
  pauseEvents(): void {
    this.paused = true;
    this.buffered.length = 0;
  }

  resumeEvents(): void {
    this.paused = false;
    const buffered = this.buffered;
    this.buffered = [];
    for (const [type, payload] of buffered) this.emit(type, payload);
  }

  clear(): void {
    this.map.clear();
    this.onceMap.clear();
    this.buffered.length = 0;
    this.paused = false;
  }
}

/** Console-tagged logger that respects a global verbosity flag. */
export class Log {
  static level = 1; // 0 = silent, 1 = warn+, 2 = info+, 3 = debug
  static group(tag: string, msg: string, level = 2): void {
    if (Log.level < level) return;
    const line = `[${tag}] ${msg}`;
    if (level >= 3) console.log(line);
    else if (level === 2) console.info(line);
    else console.warn(line);
  }
}
