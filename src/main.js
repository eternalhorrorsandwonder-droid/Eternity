import "./styles.css";
import { UI } from "./ui.js";
import { GameEngine } from "./game/engine.js";
import { loadArtAssets } from "./game/assets.js";
import { Soundscape } from "./core/audio.js";
import { createSessionGuard } from "./core/session.js";
import { SaveStatus } from "./core/save-status.js";
import { normalizeBindings } from "./core/keybindings.js";
import { newGame } from "./core/state.js";
import {
  deleteSlot,
  exportSave,
  importSave,
  listSlots,
  loadSlot,
  readSlotRaw,
  saveSlot,
} from "./core/save.js";

const defaults = {
  music: 0.35,
  sfx: 0.55,
  reducedMotion: false,
  quality: "balanced",
  guidance: true,
};
let savedSettings = {};
try {
  const parsed = JSON.parse(localStorage.getItem("eternity.settings") || "{}");
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) savedSettings = parsed;
} catch {}
const settings = {
  music: Number.isFinite(savedSettings.music)
    ? Math.max(0, Math.min(1, savedSettings.music))
    : defaults.music,
  sfx: Number.isFinite(savedSettings.sfx)
    ? Math.max(0, Math.min(1, savedSettings.sfx))
    : defaults.sfx,
  reducedMotion: savedSettings.reducedMotion === true,
  quality: ["balanced", "high"].includes(savedSettings.quality)
    ? savedSettings.quality
    : defaults.quality,
  guidance: savedSettings.guidance !== false,
  bindings: normalizeBindings(savedSettings.bindings),
  largeText: savedSettings.largeText === true,
  highContrast: savedSettings.highContrast === true,
};
const ui = new UI(document.querySelector("#app"), settings),
  sound = new Soundscape(settings);
let engine = null,
  state = null,
  currentSlot = null,
  saveTimer = null,
  transitioning = false,
  autoFullscreenAttempted = false;

// Session changes involve Web Crypto and storage. Overlapping clicks must not
// install two engines or replace a slot while another action is in flight.
const sessionTransition = createSessionGuard(busy => ui.setTransitioning(busy));
const saveStatus = new SaveStatus(status=>ui.setSaveStatus(status));

function scheduleSave() {
  saveStatus.dirty();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = null;
    saveCurrent().catch((error) =>
      ui.toast("Could not save", error.message, "info"),
    );
  }, 700);
}
async function saveCurrent(options = {}) {
  clearTimeout(saveTimer);
  saveTimer = null;
  if (transitioning || !state || currentSlot === null) return;
  const token=saveStatus.begin();
  try {const serialized=await saveSlot(currentSlot, state, options);saveStatus.finish(token);return serialized;}
  catch (error) {saveStatus.finish(token,error);throw error;}
}
function requestFullscreen() {
  if (document.fullscreenElement) return document.exitFullscreen?.();
  if (!document.documentElement.requestFullscreen) {
    ui.toast(
      "Fullscreen unavailable",
      "Use your browser’s fullscreen control instead.",
      "info",
    );
    return Promise.resolve();
  }
  return document.documentElement
    .requestFullscreen()
    .then(() => {
      if (screen.orientation?.lock)
        screen.orientation.lock("landscape").catch(() => {});
    })
    .catch(() => {
      ui.toast(
        "Fullscreen unavailable",
        "Try the fullscreen button or your browser’s controls.",
        "info",
      );
    });
}
async function start(slot) {
  // An unreadable slot is not an empty slot. Never start a new journey over
  // data we could not inspect, even if writes happen to be permitted.
  const initial = listSlots().find(item => item.slot === slot);
  if (!initial || initial.unavailable) throw new Error("This save slot could not be read. Check browser storage and try again.");
  // Invoke while still inside the click gesture; browsers may decline the request.
  if (!autoFullscreenAttempted && !document.fullscreenElement) {
    autoFullscreenAttempted = true;
    requestFullscreen();
  }
  await Promise.all([sound.start(), loadArtAssets()]);
  if (engine) await saveCurrent();
  // The load above is asynchronous: recheck before deciding a slot is empty.
  const entry = listSlots().find((item) => item.slot === slot);
  if (!entry || entry.unavailable) throw new Error("This save slot could not be read. Check browser storage and try again.");
  const next = entry.empty ? newGame() : await loadSlot(slot);
  if (engine) engine.destroy();
  state = next;
  currentSlot = slot;
  saveStatus.reset();
  ui.closeOverlay(false);
  ui.setState(state);
  ui.setPlaying(true);
  try {
    engine = new GameEngine(
      ui.canvasHost,
      ui,
      state,
      settings,
      sound,
      scheduleSave,
      () => saveStatus.continuousChange(),
    );
  } catch (error) {
    engine = null;
    state = null;
    currentSlot = null;
    saveStatus.reset();
    sound.stop();
    ui.canvasHost.replaceChildren();
    ui.setPlaying(false);
    throw new Error(`The 3D world could not start: ${error.message}`);
  }
  scheduleSave();
}
async function returnTitle() {
  await saveCurrent();
  if (engine) engine.destroy();
  engine = null;
  state = null;
  currentSlot = null;
  saveStatus.reset();
  sound.stop();
  ui.setPlaying(false);
}
async function removeSlot(slot) {
  const active = engine && currentSlot === slot;
  // Drain pending writes before deleting; never tear down a live journey on failure.
  if (active) await saveCurrent();
  if (active) transitioning = true;
  try {
    await deleteSlot(slot);
    if (active) {
      engine.destroy();
      engine = null;
      state = null;
      currentSlot = null;
      saveStatus.reset();
      sound.stop();
      ui.setPlaying(false);
    }
  } finally { transitioning = false; }
}
async function exportSlot(slot, passphrase) {
  // A live export snapshots memory directly. This remains available even if
  // localStorage is full or unavailable, avoiding loss of unsaved progress.
  const saved = engine && currentSlot === slot
      ? JSON.parse(JSON.stringify(state)) : await loadSlot(slot),
    text = await exportSave(saved, passphrase);
  const url = URL.createObjectURL(
      new Blob([text], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = `eternity-journey-${slot + 1}.eternity`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
async function importSlot(text, slot, passphrase, allowOverwrite = false, expectedRaw = undefined) {
  const imported = await importSave(text, passphrase);
  if (expectedRaw === undefined || readSlotRaw(slot) !== expectedRaw)
    throw new Error("This slot changed. Choose it again to confirm replacement.");
  if (expectedRaw !== null && !allowOverwrite)
    throw new Error("This slot changed and is no longer empty. Choose it again to confirm replacement.");
  const active = engine && currentSlot === slot;
  // An active snapshot is itself a write, so compare against the same
  // selection and carry its exact new payload forward to the replacement.
  if (active) expectedRaw = await saveCurrent({ requireReadable: true, expectedRaw });
  if (active) transitioning = true;
  try {
    // Never dispose of the live session until its confirmed replacement is durable.
    // Recheck after encryption, immediately before writing, in case a slot changed.
    await saveSlot(slot, imported, { requireReadable: true, requireEmpty: !allowOverwrite, expectedRaw });
    if (active) {
      engine.destroy();
      engine = null;
      state = null;
      currentSlot = null;
      saveStatus.reset();
      sound.stop();
      ui.setPlaying(false);
    }
  } finally { transitioning = false; }
}
ui.bind({
  start: slot => sessionTransition(() => start(slot)),
  fullscreen: requestFullscreen,
  returnTitle: () => sessionTransition(returnTitle),
  deleteSlot: slot => sessionTransition(() => removeSlot(slot)),
  exportSlot: (slot, passphrase) => sessionTransition(() => exportSlot(slot, passphrase)),
  importSlot: (text, slot, passphrase, allowOverwrite, expectedRaw) => sessionTransition(() => importSlot(text, slot, passphrase, allowOverwrite, expectedRaw)),
  saveNow: () => sessionTransition(saveCurrent),
  currentSlot: () => currentSlot,
  setPaused: (value) => engine?.setPaused(value),
  settings: (updated) => {
    try {
      localStorage.setItem("eternity.settings", JSON.stringify(updated));
    } catch {}
    ui.applyAccessibility();
    engine?.applySettings();
  },
  attack: () => engine?.attack(),
  dash: () => engine?.dash(),
  pulse: () => engine?.pulse(),
  ward: () => engine?.ward(),
  potion: () => engine?.potion(),
  interact: () => engine?.interact(),
  travel: (id) => engine?.travel(id),
  canTravel: () => engine?.canTravel() || false,
  acceptQuest: (id) => engine?.acceptQuest(id),
  completeQuest: (id) => engine?.completeQuest(id),
  trackQuest: (id) => engine?.trackQuest(id),
  pinRegion: (id) => engine?.pinRegion(id),
  trackRoute: (id) => engine?.trackRoute(id),
  claimRoute: (id) => engine?.claimRoute(id),
  craftPreparation: (id) => engine?.craftPreparation(id),
  equipPreparation: (id) => engine?.equipPreparation(id),
  kit: () => engine?.useKit(),
  talent: (type) => engine?.talent(type),
  forge: () => engine?.forge(),
  brew: () => engine?.brew(),
  cycleArchive: (item,index) => engine?.cycleArchiveDial(item,index),
  alignArchive: (item) => engine?.alignArchive(item),
  restoreProject: (item,choice) => engine?.restoreProject(item,choice),
  craftCharm: (id) => engine?.craftCharm(id),
  equipCharm: (id) => engine?.equipCharm(id),
  restart: () => engine?.respawn(),
});

// Flush an already-dirty journey as soon as the page is hidden, rather than
// waiting for the debounce timer while a mobile browser suspends the tab.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && state) void saveCurrent().catch(() => {});
});
window.addEventListener("pagehide", () => {
  if (state) void saveCurrent().catch(() => {});
});

if (import.meta.env.PROD && location.protocol !== "file:" && "serviceWorker" in navigator) {
  window.addEventListener("load", () =>
    navigator.serviceWorker.register("./sw.js").catch(() => {}),
  );
}

if (import.meta.env.DEV)
  window.__ETERNITY_DEV__ = () => ({ engine, state, currentSlot });
