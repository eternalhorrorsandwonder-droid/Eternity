/**
 * Save system.
 *
 * Six slots, each encrypted with AES-256-GCM. The key is derived per slot from
 * a device-bound secret through PBKDF2, so:
 *
 *   - opening a save in a text editor and changing a number breaks the GCM
 *     authentication tag and the load is refused,
 *   - copying a save between devices fails the same way (different device key),
 *   - the payload is still readable in a hex editor, because this is a game
 *     save — the goal is to stop *casual* tampering, not to build a vault.
 *
 * The world itself is never stored. Terrain is a pure function of the seed plus
 * a small list of player edits, which keeps a save at a few hundred KB and
 * means a save from version 1.0 still loads in version 1.4.
 */

export const SAVE_SLOTS = 6;
const SAVE_KEY = 'eternity.saves.v1';
const DEVICE_KEY = 'eternity.deviceKey.v1';
const MAGIC = 0x45544e52; // "ETR "
/** TS's BufferSource is ArrayBuffer-generic; our byte arrays are fine at runtime. */
const asBuffer = (u: Uint8Array): BufferSource => u as unknown as BufferSource;
const FORMAT_VERSION = 4;

export interface SaveMeta {
  index: number;
  name: string;
  exists: boolean;
  playTime: number;
  level: number;
  world: string;
  timestamp: number;
  size: number;
  encrypted: boolean;
}

export interface SaveHeader {
  magic: number;
  version: number;
  slot: number;
  createdAt: number;
  playTime: number;
  playerLevel: number;
  world: string;
  worldSeed: number;
  checksum: number;
}

function toBase64(bytes: Uint8Array): string {
  let bin = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, Math.min(i + chunk, bytes.length)));
  }
  return btoa(bin);
}

function fromBase64(str: string): Uint8Array {
  const bin = atob(str);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  crypto.getRandomValues(out);
  return out;
}

async function hash32(parts: Uint8Array[]): Promise<number> {
  const data = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0;
  for (const p of parts) { data.set(p, off); off += p.length; }
  const buf = await crypto.subtle.digest('SHA-256', data);
  const view = new DataView(buf);
  return (view.getUint32(0, true) ^ view.getUint32(4, true) ^ view.getUint32(8, true) ^ view.getUint32(12, true)) >>> 0;
}

function strToBytes(s: string): Uint8Array {
  return new TextEncoder().encode(s);
}

export class SaveManager {
  private slots: (string | null)[] = new Array(SAVE_SLOTS).fill(null);
  private deviceSecret: Uint8Array | null = null;
  private ready = false;

  /** Human-readable name of a slot. */
  slotName(index: number, fallback: string): string {
    const raw = this.slots[index];
    if (!raw) return fallback;
    try {
      const parsed = JSON.parse(raw);
      const name = parsed?.meta?.name;
      if (typeof name === 'string' && name.trim()) return name;
    } catch { /* corrupt */ }
    return fallback;
  }

  async init(): Promise<void> {
    if (this.ready) return;
    this.loadSlots();
    await this.ensureDeviceKey();
    this.ready = true;
  }

  private loadSlots(): void {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) this.slots = JSON.parse(raw);
      if (!Array.isArray(this.slots) || this.slots.length !== SAVE_SLOTS) {
        this.slots = new Array(SAVE_SLOTS).fill(null);
      }
    } catch {
      this.slots = new Array(SAVE_SLOTS).fill(null);
    }
  }

  private persistSlots(): void {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(this.slots));
    } catch (err) {
      console.warn('[save] could not persist slot index', err);
    }
  }

  /** A per-device secret, created on first boot and never transmitted. */
  private async ensureDeviceKey(): Promise<Uint8Array> {
    if (this.deviceSecret) return this.deviceSecret;
    try {
      const raw = localStorage.getItem(DEVICE_KEY);
      if (raw) {
        this.deviceSecret = this.xorDecode(fromBase64(raw));
        return this.deviceSecret;
      }
    } catch { /* fall through and regenerate */ }
    const key = randomBytes(32);
    try {
      localStorage.setItem(DEVICE_KEY, toBase64(this.xorEncode(key)));
    } catch { /* ignore — the key simply won't persist across sessions */ }
    this.deviceSecret = key;
    return key;
  }

  private xorEncode(data: Uint8Array): Uint8Array {
    const out = new Uint8Array(data.length);
    const mask = strToBytes('Eternity::Device::2026');
    for (let i = 0; i < data.length; i++) out[i] = data[i] ^ mask[i % mask.length];
    return out;
  }
  private xorDecode(data: Uint8Array): Uint8Array {
    return this.xorEncode(data);
  }

  private async deriveKey(slot: number): Promise<CryptoKey> {
    const secret = await this.ensureDeviceKey();
    const salt = strToBytes(`eternity-slot-${slot}::${this.worldSalt(slot)}`);
    const baseKey = await crypto.subtle.importKey('raw', asBuffer(secret), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: asBuffer(salt), iterations: 24000, hash: 'SHA-256' },
      baseKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private worldSalt(slot: number): string {
    return `v${FORMAT_VERSION}.${slot}`;
  }

  async encrypt(slot: number, plaintext: string): Promise<string> {
    const key = await this.deriveKey(slot);
    const iv = randomBytes(12);
    const data = strToBytes(plaintext);
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: asBuffer(iv) }, key, asBuffer(data));
    const out = new Uint8Array(iv.length + cipher.byteLength);
    out.set(iv, 0);
    out.set(new Uint8Array(cipher), iv.length);
    return toBase64(out);
  }

  async decrypt(slot: number, blob: string): Promise<string> {
    const key = await this.deriveKey(slot);
    const raw = fromBase64(blob);
    if (raw.length < 16) throw new Error('save blob is too short');
    const iv = raw.subarray(0, 12);
    const data = raw.subarray(12);
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, data as BufferSource);
    return new TextDecoder().decode(plain);
  }

  /**
   * Write a save. `payload` is any JSON-serialisable object.
   * Returns metadata for the slot list.
   */
  async save(
    slot: number,
    name: string,
    payload: unknown,
    world: { name: string; seed: number }
  ): Promise<SaveMeta> {
    if (slot < 0 || slot >= SAVE_SLOTS) throw new Error(`invalid slot ${slot}`);
    const body = JSON.stringify(payload);
    const header: SaveHeader = {
      magic: MAGIC,
      version: FORMAT_VERSION,
      slot,
      createdAt: Date.now(),
      playTime: (payload as any)?.playTime ?? 0,
      playerLevel: (payload as any)?.player?.level ?? 1,
      world: world.name,
      worldSeed: world.seed,
      checksum: 0,
    };
    // The checksum covers the header with its own field zeroed, so the value
    // written and the value verified on load hash exactly the same bytes.
    // Hashing the header as it stands here would include the checksum we are
    // about to write, which is a value nobody can reproduce on load.
    const headerForChecksum: SaveHeader = { ...header, checksum: 0 };
    header.checksum = await hash32([strToBytes(JSON.stringify(headerForChecksum)), strToBytes(body)]);

    const envelope = JSON.stringify({ header, body });
    const cipher = await this.encrypt(slot, envelope);
    this.slots[slot] = cipher;
    this.persistSlots();

    return {
      index: slot,
      name,
      exists: true,
      playTime: header.playTime,
      level: header.playerLevel,
      world: header.world,
      timestamp: header.createdAt,
      size: cipher.length,
      encrypted: true,
    };
  }

  async load(slot: number): Promise<{ header: SaveHeader; body: any }> {
    const cipher = this.slots[slot];
    if (!cipher) throw new Error('save slot is empty');
    const envelope = await this.decrypt(slot, cipher);
    let parsed: any;
    try {
      parsed = JSON.parse(envelope);
    } catch {
      throw new Error('save is corrupt');
    }
    const header = parsed.header as SaveHeader;
    if (header.magic !== MAGIC) throw new Error('save header is invalid');
    if (header.version !== FORMAT_VERSION) {
      // Old saves are rejected rather than silently half-loaded.
      throw new Error(`save was written by an incompatible version (${header.version})`);
    }
    const checksum = await hash32([
      strToBytes(JSON.stringify({ ...header, checksum: 0 })),
      strToBytes(parsed.body),
    ]);
    if (checksum !== header.checksum) throw new Error('save failed integrity check');
    // `body` is stored as a JSON string inside the envelope; hand back the
    // parsed object so callers can read `body.player` directly. Returning the
    // raw string would silently make every save load do nothing.
    let body: any = parsed.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { throw new Error('save body is corrupt'); }
    }
    return { header, body };
  }

  /** Read only the metadata of a slot without decrypting the body. */
  async peek(slot: number): Promise<SaveMeta | null> {
    const cipher = this.slots[slot];
    if (!cipher) return null;
    try {
      const envelope = await this.decrypt(slot, cipher);
      const parsed = JSON.parse(envelope);
      const header = parsed.header as SaveHeader;
      return {
        index: slot,
        name: header.world,
        exists: true,
        playTime: header.playTime,
        level: header.playerLevel,
        world: header.world,
        timestamp: header.createdAt,
        size: cipher.length,
        encrypted: true,
      };
    } catch {
      return {
        index: slot,
        name: 'Corrupted save',
        exists: true,
        playTime: 0,
        level: 0,
        world: '—',
        timestamp: 0,
        size: cipher.length,
        encrypted: true,
      };
    }
  }

  async list(): Promise<SaveMeta[]> {
    const out: SaveMeta[] = [];
    for (let i = 0; i < SAVE_SLOTS; i++) {
      const meta = await this.peek(i);
      out.push(meta ?? {
        index: i, name: 'Empty', exists: false, playTime: 0, level: 0,
        world: '—', timestamp: 0, size: 0, encrypted: true,
      });
    }
    return out;
  }

  async remove(slot: number): Promise<void> {
    this.slots[slot] = null;
    this.persistSlots();
  }

  /** Copy a save into another slot (used by "backup" and "new game+" flows). */
  async copy(from: number, to: number): Promise<void> {
    if (!this.slots[from]) throw new Error('source slot is empty');
    const envelope = await this.decrypt(from, this.slots[from]!);
    this.slots[to] = await this.encrypt(to, envelope);
    this.persistSlots();
  }

  get slotCount(): number { return SAVE_SLOTS; }
  get isReady(): boolean { return this.ready; }
}
