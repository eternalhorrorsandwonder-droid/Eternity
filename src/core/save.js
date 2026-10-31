import { LEVEL_CAP, normalizeSave, pruneRespawns } from "./state.js";
import { REGION_BY_ID, regionAt } from "../data/world.js";

const PREFIX = "eternity.vale.v1";
const DEFAULT_SECRET = "Eternity / Sundered Vale / local save protection v1";
const ITERATIONS = 150000;
const MAX_IMPORT_BYTES = 1024 * 1024;
const queues = new Map();
const encoder = new TextEncoder();
const decoder = new TextDecoder();
const keyName = (slot) => `${PREFIX}.slot.${slot}`;
const metaName = (slot) => `${PREFIX}.meta.${slot}`;
const bytesTo64 = (bytes) => {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary);
};
const base64ToBytes = (base64) =>
  Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));

function cryptoAPI() {
  if (!globalThis.crypto?.subtle)
    throw new Error(
      "Encrypted saves require a secure browser connection (HTTPS or localhost).",
    );
  return globalThis.crypto;
}
async function deriveKey(secret, salt) {
  const subtle = cryptoAPI().subtle;
  const material = await subtle.importKey(
    "raw",
    encoder.encode(secret),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}
export async function encryptSave(state, passphrase = "") {
  const crypto = cryptoAPI();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase || DEFAULT_SECRET, salt);
  const payload = encoder.encode(JSON.stringify(state));
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv, additionalData: encoder.encode(PREFIX) },
    key,
    payload,
  );
  return {
    format: "eternity-vale-save",
    version: 1,
    protected: !!passphrase,
    salt: bytesTo64(salt),
    iv: bytesTo64(iv),
    data: bytesTo64(new Uint8Array(encrypted)),
  };
}
export async function decryptSave(envelope, passphrase = "") {
  if (
    !envelope ||
    envelope.format !== "eternity-vale-save" ||
    envelope.version !== 1 ||
    typeof envelope.data !== "string" ||
    envelope.data.length > MAX_IMPORT_BYTES
  )
    throw new Error("This file is not an Eternity save.");
  if (envelope.protected && !passphrase)
    throw new Error("This save needs its export passphrase.");
  const crypto = cryptoAPI();
  try {
    const salt = base64ToBytes(envelope.salt),
      iv = base64ToBytes(envelope.iv),
      data = base64ToBytes(envelope.data);
    if (salt.length !== 16 || iv.length !== 12 || data.length < 16)
      throw new Error("Invalid envelope");
    const key = await deriveKey(
      envelope.protected ? passphrase : DEFAULT_SECRET,
      salt,
    );
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv, additionalData: encoder.encode(PREFIX) },
      key,
      data,
    );
    return normalizeSave(JSON.parse(decoder.decode(plain)));
  } catch (error) {
    if (error.message?.includes("compatible Eternity")) throw error;
    throw new Error(
      "Could not open the save. The passphrase may be wrong or the file was changed.",
    );
  }
}
export function listSlots() {
  return [0, 1, 2].map((slot) => {
    try {
      const raw = localStorage.getItem(keyName(slot));
      if (raw === null) return { slot, empty: true };
      let damaged = false;
      try {
        // This catches obvious damage only; authenticated decryption still
        // happens when opening the slot. Never mistake bad data for emptiness.
        if (raw.length > MAX_IMPORT_BYTES + 4096) throw new Error("Oversized slot");
        const envelope = JSON.parse(raw);
        damaged = !envelope || envelope.format !== "eternity-vale-save" || envelope.version !== 1 ||
          typeof envelope.data !== "string" || typeof envelope.salt !== "string" || typeof envelope.iv !== "string";
      } catch { damaged = true; }
      let meta = {};
      try {
        meta = JSON.parse(localStorage.getItem(metaName(slot)) || "{}") || {};
      } catch {}
      // Metadata is deliberately unencrypted; never let damaged metadata hide a save.
      return {
        slot,
        damaged,
        name: damaged ? "Save needs attention" :
          typeof meta.name === "string"
            ? meta.name.slice(0, 24)
            : "Saved journey",
        level: Number.isFinite(meta.level)
          ? Math.max(1, Math.min(LEVEL_CAP, Math.floor(meta.level)))
          : 1,
        region:
          typeof meta.region === "string"
            ? meta.region.slice(0, 60)
            : "Unknown",
        savedAt: Number.isFinite(meta.savedAt) ? meta.savedAt : 0,
      };
    } catch {
      // A read error is not proof that a slot is empty. Treating it as a new
      // journey could overwrite recoverable data if writes still succeed.
      return { slot, unavailable: true };
    }
  });
}

/** Read the authoritative payload without ever treating an error as empty. */
export function readSlotRaw(slot) {
  if (![0, 1, 2].includes(slot)) throw new Error("Invalid save slot.");
  try { return localStorage.getItem(keyName(slot)); }
  catch { throw new Error("This slot could not be read. Check browser storage and retry."); }
}

export async function saveSlot(slot, state, { requireReadable = false, requireEmpty = false, expectedRaw = undefined } = {}) {
  if (![0, 1, 2].includes(slot)) throw new Error("Invalid save slot.");
  pruneRespawns(state);
  state.savedAt = Date.now();
  // Take the snapshot before queueing so successive writes cannot race backwards.
  const snapshot = JSON.parse(JSON.stringify(state));
  const job = (queues.get(slot) || Promise.resolve())
    .catch(() => {})
    .then(async () => {
      const envelope = await encryptSave(snapshot);
      const region = regionAt(snapshot.player.x, snapshot.player.z);
      if (requireReadable || requireEmpty || expectedRaw !== undefined) {
        const existing = readSlotRaw(slot);
        if (requireEmpty && existing !== null)
          throw new Error("This slot changed and is no longer empty. Choose it again to confirm replacement.");
        if (expectedRaw !== undefined && existing !== expectedRaw)
          throw new Error("This slot changed. Choose it again to confirm replacement.");
      }
      const serialized = JSON.stringify(envelope);
      localStorage.setItem(keyName(slot), serialized);
      try {
        localStorage.setItem(
          metaName(slot),
          JSON.stringify({
            name: snapshot.player.name,
            level: snapshot.player.level,
            region: region?.name || REGION_BY_ID.haven.name,
            savedAt: snapshot.savedAt,
          }),
        );
      } catch {
        // The encrypted payload is already durable; metadata is only a menu hint.
      }
      return serialized;
    });
  queues.set(slot, job);
  try {
    return await job;
  } finally {
    if (queues.get(slot) === job) queues.delete(slot);
  }
}
export async function loadSlot(slot) {
  if (![0, 1, 2].includes(slot)) throw new Error("Invalid save slot.");
  if (queues.has(slot)) await queues.get(slot);
  const raw = readSlotRaw(slot);
  if (raw === null) throw new Error("This save slot is empty.");
  let envelope;
  try { envelope = JSON.parse(raw); }
  catch { throw new Error("This save's data appears damaged. Try importing a backup."); }
  return decryptSave(envelope);
}
export async function deleteSlot(slot) {
  if (![0, 1, 2].includes(slot)) throw new Error("Invalid save slot.");
  if (queues.has(slot)) await queues.get(slot);
  localStorage.removeItem(keyName(slot));
  try { localStorage.removeItem(metaName(slot)); } catch {
    // The authoritative payload is gone; leftover metadata cannot resurrect it.
  }
}
export async function exportSave(state, passphrase = "") {
  return JSON.stringify(await encryptSave(state, passphrase), null, 2);
}
export async function importSave(text, passphrase = "") {
  if (text.length > MAX_IMPORT_BYTES)
    throw new Error("That save file is too large.");
  let envelope;
  try {
    envelope = JSON.parse(text);
  } catch {
    throw new Error("That file is not valid JSON.");
  }
  return decryptSave(envelope, passphrase);
}
export function saveIsProtected(text) {
  try {
    return JSON.parse(text).protected === true;
  } catch {
    return false;
  }
}
