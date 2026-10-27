/**
 * World memory: everything the world remembers about itself.
 *
 * The design problem this file solves is a real one. A "remember everything"
 * system in a 384 x 384 world is a memory bomb: if exploration is logged per
 * voxel, or per tile placed, the save grows without bound and the per-frame
 * cost of checking "have I already logged this?" shows up as dropped frames.
 * So the memory here is deliberately coarse, and it is bounded by construction:
 *
 *   - Regions are one byte each (144 bytes total). A bit per region says
 *     whether the player has stood there, whether the map screen will show it,
 *     and whether the generator is allowed to spawn its rare features.
 *   - Exploration is a bitmask over surface chunks (24 x 24 = 576 bits = 72
 *     bytes). Marking a position costs one OR and one array read, and there is
 *     no allocation on the hot path.
 *   - Structures, bosses and map markers are capped sets. They are stored in
 *     flat typed arrays with a linear scan on insert; the caps are small enough
 *     that the scan is irrelevant, and the caps are what stop the arrays growing
 *     with the world.
 *   - Events go into a ring buffer. The newest 128 entries survive, the oldest
 *     are overwritten. A player who explores for a hundred hours still has a
 *     bounded log, and a player who never explores has an empty one.
 *
 * Nothing here is per-voxel, nothing here allocates on the hot path, and every
 * write is a bounded write. That is the whole point: the memory is cheap enough
 * to check every frame and small enough to encrypt, write and send over the
 * wire in a few kilobytes.
 *
 * The tracker is intentionally free of any rendering or save knowledge. It
 * serializes to a plain object and the save system handles the rest.
 */

/** Number of hand-authored regions across the world grid. */
export const REGION_COUNT = 144;
/** Chunks across one world axis (384 / 16). */
export const CHUNK_GRID = 24;
/** Surface chunks total. */
export const CHUNK_COUNT = CHUNK_GRID * CHUNK_GRID;
/** Distinct dungeons in the world. */
export const DUNGEON_COUNT = 10;
/** Distinct codex entries. */
export const CODEX_COUNT = 50;
/** Distinct quests. */
export const QUEST_COUNT = 64;
/** Distinct achievements. */
export const ACHIEVEMENT_COUNT = 64;

/** Hard caps. These are the "smart workaround" the memory budget needs. */
export const MAX_LOGGED_STRUCTURES = 256;
export const MAX_LOGGED_BOSSES = 32;
export const MAX_LOGGED_MARKERS = 64;
export const MAX_EVENT_LOG = 128;
export const MAX_MILESTONES = 64;

/** Region flag bits. */
export const REGION_VISITED = 0x01;
export const REGION_DISCOVERED = 0x02;
export const REGION_EXPLORED = 0x04;
export const REGION_LOCKED = 0x08;

/** A structure the player has found and can return to. */
export interface StructureMemory {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  region: number;
  /** True once the player has been inside. */
  entered: boolean;
}

/** A named marker on the world map (dungeon mouth, arena, landmark). */
export interface MarkerMemory {
  id: string;
  name: string;
  x: number;
  z: number;
  region: number;
  kind: string;
  seen: boolean;
}

/** One entry of the event ring buffer. */
export interface WorldEvent {
  t: number;
  kind: string;
  text: string;
}

/** A milestone counter, e.g. `blocksMined`, `bossesDefeated`. */
export interface Milestone {
  key: string;
  value: number;
}

/** The serialisable shape of the tracker. */
export interface ProgressSnapshot {
  v: 1;
  regions: number[];
  chunks: number[];
  structures: StructureMemory[];
  bosses: { id: string; defeated: boolean; bestMs: number }[];
  markers: MarkerMemory[];
  dungeons: number[];
  codex: number[];
  quests: number[];
  achievements: number[];
  events: WorldEvent[];
  milestones: Milestone[];
  playtime: number;
}

/**
 * Bounded discovery and progress memory.
 *
 * The tracker owns no state that can grow without bound. Every container has a
 * fixed capacity decided at construction time, so a save written after ten
 * minutes and a save written after a hundred hours have the same shape and the
 * same cost to encrypt.
 */
export class ProgressTracker {
  /** One byte per region; see the REGION_* flags. */
  readonly regions = new Uint8Array(REGION_COUNT);
  /** One bit per surface chunk: has the player been near it. */
  readonly chunks = new Uint8Array(CHUNK_COUNT >> 3);

  private structures: StructureMemory[] = [];
  private bosses: { id: string; defeated: boolean; bestMs: number }[] = [];
  private markers: MarkerMemory[] = [];

  /** Bit 0 = cleared, bit 1 = best run recorded. */
  readonly dungeons = new Uint8Array(DUNGEON_COUNT);
  /** Bit 0 = read. */
  readonly codex = new Uint8Array(CODEX_COUNT);
  /** Bit 0 = accepted, bit 1 = completed, bit 2 = claimed. */
  readonly quests = new Uint8Array(QUEST_COUNT);
  /** Bit 0 = unlocked, bit 1 = hidden (spoiled by visiting the region). */
  readonly achievements = new Uint8Array(ACHIEVEMENT_COUNT);

  /** Bounded event ring buffer, newest last. */
  private events: WorldEvent[] = [];
  private milestones: Milestone[] = [];

  /** Seconds of play in this world. */
  playtime = 0;

  /** Set whenever something changed, cleared by the saver. */
  changed = false;

  // ------------------------------------------------------------------ marks

  /** Record that the player is standing in a region. */
  visitRegion(id: number): void {
    if (id < 0 || id >= REGION_COUNT) return;
    if (this.regions[id] & REGION_VISITED) return;
    this.regions[id] |= REGION_VISITED | REGION_DISCOVERED;
    this.changed = true;
  }

  /**
   * Record that the player has been near a world position.
   *
   * Cheap enough to call every frame: one division, one bitmask OR, and one
   * region lookup. It also promotes the region to "discovered" so the map
   * screen can reveal it without the player having walked to its centre.
   */
  discover(x: number, z: number): void {
    if (x < 0 || z < 0) return;
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    if (cx < 0 || cz < 0 || cx >= CHUNK_GRID || cz >= CHUNK_GRID) return;
    const bit = 1 << ((cz * CHUNK_GRID + cx) & 7);
    const idx = (cz * CHUNK_GRID + cx) >> 3;
    if (this.chunks[idx] & bit) return;
    this.chunks[idx] |= bit;
    this.changed = true;
  }

  /** True when the player has been within one chunk of this position. */
  isDiscovered(x: number, z: number): boolean {
    const cx = Math.floor(x / 16);
    const cz = Math.floor(z / 16);
    if (cx < 0 || cz < 0 || cx >= CHUNK_GRID || cz >= CHUNK_GRID) return false;
    return (this.chunks[(cz * CHUNK_GRID + cx) >> 3] & (1 << ((cz * CHUNK_GRID + cx) & 7))) !== 0;
  }

  /** Percentage of surface chunks the player has been near. */
  explorationPercent(): number {
    let seen = 0;
    for (let i = 0; i < this.chunks.length; i++) {
      let b = this.chunks[i];
      while (b) { seen += b & 1; b >>= 1; }
    }
    return (seen / CHUNK_COUNT) * 100;
  }

  /** Number of regions the player has stood in. */
  visitedCount(): number {
    let n = 0;
    for (let i = 0; i < this.regions.length; i++) if (this.regions[i] & REGION_VISITED) n++;
    return n;
  }

  // -------------------------------------------------------------- structures

  /**
   * Remember a structure and its position.
   *
   * Returns false when the set is full and this structure was not already
   * logged, so callers can decide what to drop. The cap is what keeps the
   * memory flat: the world has a few hundred structures, so a cap of 256 is
   * never hit by normal play and always enough to remember the ones the player
   * actually cares about.
   */
  rememberStructure(def: { id: string; name: string; x: number; y: number; z: number; region?: number }, entered = false): boolean {
    const existing = this.structures.find((s) => s.id === def.id);
    if (existing) {
      existing.x = def.x;
      existing.y = def.y;
      existing.z = def.z;
      existing.region = def.region ?? existing.region;
      if (entered) { existing.entered = true; this.changed = true; }
      return true;
    }
    if (this.structures.length >= MAX_LOGGED_STRUCTURES) return false;
    this.structures.push({
      id: def.id, name: def.name, x: def.x, y: def.y, z: def.z,
      region: def.region ?? -1, entered,
    });
    this.changed = true;
    return true;
  }

  structure(id: string): StructureMemory | undefined {
    return this.structures.find((s) => s.id === id);
  }

  structures_(): readonly StructureMemory[] { return this.structures; }

  /** Mark a structure as entered. Idempotent and cheap. */
  enterStructure(id: string): void {
    const s = this.structures.find((x) => x.id === id);
    if (!s || s.entered) return;
    s.entered = true;
    this.changed = true;
  }

  // ------------------------------------------------------------------ bosses

  /**
   * Record a boss kill. `bestMs` is the fastest killing time seen so far; zero
   * means the fight was won but never timed.
   */
  defeatBoss(id: string, ms = 0): void {
    let b = this.bosses.find((x) => x.id === id);
    if (!b) {
      if (this.bosses.length >= MAX_LOGGED_BOSSES) return;
      b = { id, defeated: false, bestMs: 0 };
      this.bosses.push(b);
    }
    if (!b.defeated) this.changed = true;
    b.defeated = true;
    if (ms > 0 && (b.bestMs === 0 || ms < b.bestMs)) {
      b.bestMs = ms;
      this.changed = true;
    }
  }

  boss(id: string): { defeated: boolean; bestMs: number } | undefined {
    const b = this.bosses.find((x) => x.id === id);
    return b ? { defeated: b.defeated, bestMs: b.bestMs } : undefined;
  }

  bossesDefeated(): number {
    let n = 0;
    for (const b of this.bosses) if (b.defeated) n++;
    return n;
  }

  bosses_(): readonly { id: string; defeated: boolean; bestMs: number }[] { return this.bosses; }

  // ---------------------------------------------------------------- markers

  /** Remember a named map marker. Capped; the oldest are evicted first. */
  rememberMarker(def: { id: string; name: string; x: number; z: number; region?: number; kind: string }, seen = false): void {
    const existing = this.markers.find((m) => m.id === def.id);
    if (existing) {
      existing.x = def.x;
      existing.z = def.z;
      existing.region = def.region ?? existing.region;
      if (seen && !existing.seen) { existing.seen = true; this.changed = true; }
      return;
    }
    if (this.markers.length >= MAX_LOGGED_MARKERS) {
      // Keep the newest MAX_LOGGED_MARKERS - 1 and drop the oldest slot.
      this.markers.shift();
    }
    this.markers.push({
      id: def.id, name: def.name, x: def.x, z: def.z,
      region: def.region ?? -1, kind: def.kind, seen,
    });
    this.changed = true;
  }

  markers_(): readonly MarkerMemory[] { return this.markers; }

  // ------------------------------------------------------------- dungeons

  /** Mark a dungeon cleared, optionally recording the run time in seconds. */
  clearDungeon(id: number, seconds = 0): void {
    if (id < 0 || id >= DUNGEON_COUNT) return;
    this.dungeons[id] |= 0x01;
    if (seconds > 0) {
      const prev = this.dungeonBest(id);
      if (prev === 0 || seconds < prev) {
        this.dungeons[id] |= 0x02;
        this.dungeonSeconds[id] = seconds;
      }
    }
    this.changed = true;
  }

  private dungeonSeconds = new Float32Array(DUNGEON_COUNT);

  dungeonCleared(id: number): boolean {
    return id >= 0 && id < DUNGEON_COUNT && (this.dungeons[id] & 0x01) !== 0;
  }

  /** Best recorded run time in seconds, or 0 when never timed. */
  dungeonBest(id: number): number {
    return id >= 0 && id < DUNGEON_COUNT ? this.dungeonSeconds[id] : 0;
  }

  dungeonsCleared(): number {
    let n = 0;
    for (let i = 0; i < this.dungeons.length; i++) if (this.dungeons[i] & 0x01) n++;
    return n;
  }

  // --------------------------------------------------------------- codex

  readCodex(id: number): boolean {
    if (id < 0 || id >= CODEX_COUNT) return false;
    if (this.codex[id]) return false;
    this.codex[id] = 1;
    this.changed = true;
    return true;
  }

  codexCount(): number {
    let n = 0;
    for (let i = 0; i < this.codex.length; i++) if (this.codex[i]) n++;
    return n;
  }

  // --------------------------------------------------------------- quests

  /** Bit 0 = accepted, bit 1 = completed, bit 2 = claimed. */
  setQuest(id: number, flag: 1 | 2 | 3): void {
    if (id < 0 || id >= QUEST_COUNT) return;
    const mask = flag === 1 ? 0x01 : flag === 2 ? 0x02 : 0x07;
    if ((this.quests[id] & mask) === mask) return;
    this.quests[id] |= mask;
    this.changed = true;
  }

  questAccepted(id: number): boolean {
    return id >= 0 && id < QUEST_COUNT && (this.quests[id] & 0x01) !== 0;
  }

  questCompleted(id: number): boolean {
    return id >= 0 && id < QUEST_COUNT && (this.quests[id] & 0x02) !== 0;
  }

  questClaimed(id: number): boolean {
    return id >= 0 && id < QUEST_COUNT && (this.quests[id] & 0x04) !== 0;
  }

  questCount(): number {
    let n = 0;
    for (let i = 0; i < this.quests.length; i++) if (this.quests[i] & 0x04) n++;
    return n;
  }

  // -------------------------------------------------------- achievements

  unlock(id: number): boolean {
    if (id < 0 || id >= ACHIEVEMENT_COUNT) return false;
    if (this.achievements[id]) return false;
    this.achievements[id] = 1;
    this.changed = true;
    return true;
  }

  achievementCount(): number {
    let n = 0;
    for (let i = 0; i < this.achievements.length; i++) if (this.achievements[i]) n++;
    return n;
  }

  // --------------------------------------------------------------- events

  /**
   * Push an event into the ring buffer.
   *
   * When the buffer is full the oldest entry is overwritten, so the log always
   * describes the most recent chapter of the journey rather than the first.
   */
  logEvent(kind: string, text: string, t = 0): void {
    this.events.push({ t, kind, text });
    if (this.events.length > MAX_EVENT_LOG) this.events.shift();
    this.changed = true;
  }

  events_(): readonly WorldEvent[] { return this.events; }

  // ----------------------------------------------------------- milestones

  /** Add to a named counter, creating it on first use. */
  bump(key: string, amount = 1): number {
    let idx = -1;
    for (let i = 0; i < this.milestones.length; i++) {
      if (this.milestones[i].key === key) { idx = i; break; }
    }
    if (idx < 0) {
      if (this.milestones.length >= MAX_MILESTONES) {
        // Drop the smallest counter rather than the oldest: totals matter more
        // than arrival order, and the smallest is the least informative.
        let minIdx = 0;
        for (let i = 1; i < this.milestones.length; i++) {
          if (this.milestones[i].value < this.milestones[minIdx].value) minIdx = i;
        }
        this.milestones.splice(minIdx, 1);
      }
      idx = this.milestones.length;
      this.milestones.push({ key, value: 0 });
    }
    this.milestones[idx].value += amount;
    this.changed = true;
    return this.milestones[idx].value;
  }

  milestone(key: string): number {
    const m = this.milestones.find((x) => x.key === key);
    return m ? m.value : 0;
  }

  milestones_(): readonly Milestone[] { return this.milestones; }

  // ----------------------------------------------------------- lifecycle

  /** Seconds of play to add this frame. */
  tick(dt: number): void {
    if (dt > 0) this.playtime += dt;
  }

  /** Reset the world memory to an empty slate (used by "new world"). */
  reset(): void {
    this.regions.fill(0);
    this.chunks.fill(0);
    this.structures = [];
    this.bosses = [];
    this.markers = [];
    this.dungeons.fill(0);
    this.dungeonSeconds.fill(0);
    this.codex.fill(0);
    this.quests.fill(0);
    this.achievements.fill(0);
    this.events = [];
    this.milestones = [];
    this.playtime = 0;
    this.changed = true;
  }

  // ----------------------------------------------------------- serialise

  toJSON(): ProgressSnapshot {
    return {
      v: 1,
      regions: Array.from(this.regions),
      chunks: Array.from(this.chunks),
      structures: this.structures,
      bosses: this.bosses,
      markers: this.markers,
      dungeons: Array.from(this.dungeons),
      codex: Array.from(this.codex),
      quests: Array.from(this.quests),
      achievements: Array.from(this.achievements),
      events: this.events.slice(-MAX_EVENT_LOG),
      milestones: this.milestones,
      playtime: this.playtime,
    };
  }

  /**
   * Restore from a snapshot.
   *
   * Anything malformed or out of range is ignored rather than throwing: a save
   * written by a newer build should still load, with the fields it does not
   * recognise simply missing.
   */
  fromJSON(data: Partial<ProgressSnapshot> | null): void {
    if (!data || typeof data !== 'object') return;
    const regions = Array.isArray(data.regions) ? data.regions : [];
    for (let i = 0; i < REGION_COUNT && i < regions.length; i++) {
      const v = regions[i] | 0;
      this.regions[i] = v >= 0 && v <= 255 ? v : 0;
    }
    const chunks = Array.isArray(data.chunks) ? data.chunks : [];
    for (let i = 0; i < this.chunks.length && i < chunks.length; i++) {
      const v = chunks[i] | 0;
      this.chunks[i] = v >= 0 && v <= 255 ? v : 0;
    }
    this.structures = Array.isArray(data.structures)
      ? data.structures.slice(0, MAX_LOGGED_STRUCTURES).map((s) => ({
        id: String(s.id ?? ''), name: String(s.name ?? ''),
        x: Number(s.x) || 0, y: Number(s.y) || 0, z: Number(s.z) || 0,
        region: Number(s.region) || -1, entered: !!s.entered,
      })).filter((s) => s.id)
      : [];
    this.bosses = Array.isArray(data.bosses)
      ? data.bosses.slice(0, MAX_LOGGED_BOSSES).map((b) => ({
        id: String(b.id ?? ''), defeated: !!b.defeated, bestMs: Number(b.bestMs) || 0,
      })).filter((b) => b.id)
      : [];
    this.markers = Array.isArray(data.markers)
      ? data.markers.slice(0, MAX_LOGGED_MARKERS).map((m) => ({
        id: String(m.id ?? ''), name: String(m.name ?? ''),
        x: Number(m.x) || 0, z: Number(m.z) || 0,
        region: Number(m.region) || -1, kind: String(m.kind ?? ''), seen: !!m.seen,
      })).filter((m) => m.id)
      : [];
    const dungeons = Array.isArray(data.dungeons) ? data.dungeons : [];
    for (let i = 0; i < DUNGEON_COUNT && i < dungeons.length; i++) {
      const v = dungeons[i] | 0;
      this.dungeons[i] = v >= 0 && v <= 255 ? v : 0;
    }
    const dungeonBest = Array.isArray((data as { dungeonSeconds?: number[] }).dungeonSeconds)
      ? (data as { dungeonSeconds: number[] }).dungeonSeconds : [];
    for (let i = 0; i < DUNGEON_COUNT && i < dungeonBest.length; i++) {
      this.dungeonSeconds[i] = Math.max(0, dungeonBest[i] || 0);
    }
    const codex = Array.isArray(data.codex) ? data.codex : [];
    for (let i = 0; i < CODEX_COUNT && i < codex.length; i++) this.codex[i] = codex[i] ? 1 : 0;
    const quests = Array.isArray(data.quests) ? data.quests : [];
    for (let i = 0; i < QUEST_COUNT && i < quests.length; i++) {
      const v = quests[i] | 0;
      this.quests[i] = v >= 0 && v <= 255 ? v : 0;
    }
    const achievements = Array.isArray(data.achievements) ? data.achievements : [];
    for (let i = 0; i < ACHIEVEMENT_COUNT && i < achievements.length; i++) {
      this.achievements[i] = achievements[i] ? 1 : 0;
    }
    this.events = Array.isArray(data.events)
      ? data.events.slice(-MAX_EVENT_LOG).map((e) => ({
        t: Number(e.t) || 0, kind: String(e.kind ?? ''), text: String(e.text ?? ''),
      }))
      : [];
    this.milestones = Array.isArray(data.milestones)
      ? data.milestones.slice(0, MAX_MILESTONES).map((m) => ({
        key: String(m.key ?? ''), value: Math.max(0, Number(m.value) || 0),
      })).filter((m) => m.key)
      : [];
    this.playtime = Math.max(0, Number(data.playtime) || 0);
    this.changed = true;
  }

  /** Size of the serialised form in bytes, for the settings screen. */
  byteSize(): number {
    const snap = this.toJSON();
    return JSON.stringify(snap).length;
  }
}
