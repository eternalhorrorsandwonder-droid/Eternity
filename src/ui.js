import { icon } from "./icons.js";
import { REGIONS, REGION_BY_ID, regionAt } from "./data/world.js";
import { QUESTS, ACHIEVEMENTS } from "./data/quests.js";
import {
  BEACON_COST,
  ITEM_NAMES,
  WAYSTONE_COST,
  LEVEL_CAP,
  TALENT_CAPS,
  attackPower,
  dashCooldown,
  pulseCooldown,
  maxHealth,
  questProgress,
  xpRequired,
} from "./core/state.js";
import { listSlots, readSlotRaw, saveIsProtected } from "./core/save.js";
import { describeEvent } from "./core/chronicle.js";
import { ARCHIVES, ARCHIVE_GLYPHS } from "./data/archives.js";
import { CHARMS } from "./data/gear.js";
import { archiveCount, projectCount, readArchive } from "./core/frontier.js";
import { canCraftCharm } from "./core/gear.js";
import { TRAILS, TRAIL_BY_ID } from "./data/trails.js";
import { trailProgress } from "./core/trails.js";
import { navigationTarget, bearingTo } from "./core/navigation.js";
import { KIT_ITEMS, KIT_BY_ID, KIT_CAP } from "./data/kit.js";
import { canCraftKit } from "./core/kit.js";
import { BESTIARY } from "./data/bestiary.js";
import { BINDING_ACTIONS, DEFAULT_BINDINGS, keyLabel, setBinding } from "./core/keybindings.js";

// Literal local URLs let the single-file builder embed every dialogue portrait.
const PORTRAITS = Object.freeze({
  mira:"/assets/mira-portrait.webp",tavi:"/assets/tavi-portrait.webp",sera:"/assets/sera-portrait.webp",
  rowan:"/assets/rowan-portrait.webp",bram:"/assets/bram-portrait.webp",kea:"/assets/kea-portrait.webp",
  nia:"/assets/nia-portrait.webp",
});

const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ],
  );
const percent = (n, d) => Math.max(0, Math.min(100, d ? (n / d) * 100 : 0));
const pad = (n) => String(n).padStart(2, "0");
const mapPoint = (x, z) => ({
  x: (x / 54 + 0.5) * 100,
  y: (z / 54 + 0.5) * 100,
});
function mapIllustration(region) {
  const trees = region.trees
    .map(([x, z, scale]) => {
      const p = mapPoint(x, z),
        r = Math.min(2.8, 1.6 * scale);
      return `<g transform="translate(${p.x} ${p.y})"><path d="M0 ${r * 0.5}v${r * 1.7}"/><path d="M0 ${-r * 1.4}l${-r} ${r * 1.8}h${r * 2}Z"/></g>`;
    })
    .join("");
  const rocks = region.rocks
    .map(([x, z, scale]) => {
      const p = mapPoint(x, z),
        r = 2 * scale;
      return `<path d="M${p.x - r} ${p.y + r * 0.6}l${r * 0.8} ${-r * 1.5} ${r * 1.4} ${r * 1.5}Z"/>`;
    })
    .join("");
  const lakes = (region.water || [])
    .map((w) => {
      const p = mapPoint(w.x, w.z);
      return `<ellipse class="atlas-water" cx="${p.x}" cy="${p.y}" rx="${(w.rx / 54) * 100}" ry="${(w.rz / 54) * 100}"/>`;
    })
    .join("");
  const roads=(region.roads || []).map(road=>{
    const points=road.points.map(([x,z])=>{const point=mapPoint(x,z);return `${point.x},${point.y}`;}).join(" ");
    return `<polyline class="atlas-road" points="${points}" style="stroke-width:${road.width/54*100}"/>`;
  }).join("");
  return `<svg class="map-illustration" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${roads}${lakes}${trees}${rocks}</svg>`;
}
const button = (action, label, iconName, extra = "") =>
  `<button type="button" class="${extra}" data-action="${action}">${iconName ? icon(iconName, 18) : ""}<span>${label}</span></button>`;

export class UI {
  constructor(root, settings) {
    this.root = root;
    this.settings = settings;
    this.actions = {};
    this.state = null;
    this.overlayType = "";
    this.board = "map";
    this.characterTab = "level";
    this.journalTab = "requests";
    this.selectedRegion = "haven";
    this.atlasChapter = 1;
    this.archiveItem = null;
    this.projectItem = null;
    this.projectSelection = null;
    this.importText = "";
    this.importReadId = 0;
    this.exportSlot = 0;
    this.exportFromPause = false;
    this.saveStatus = {status:"idle",lastSaved:null,error:""};
    this.playing = false;
    this.transitioning = false;
    this.pendingImport = null;
    this.secondaryTouches = new Map();
    this.blockedTouchClicks = new Map();
    this.lastSecondaryActivation = null;
    this.labels = new Map();
    this.lastHud = 0;
    this.guideDismissed = false;
    this.bindingAction = null;
    this.bindingError = "";
    try { this.guideDismissed = localStorage.getItem("eternity.guide.dismissed") === "1"; } catch {}
    root.innerHTML = this.shell();
    if (this.guideDismissed) root.querySelector("#guide-card").classList.add("hidden");
    this.canvasHost = root.querySelector("#world-canvas");
    this.overlay = root.querySelector("#overlay");
    this.hud = root.querySelector("#hud");
    this.title = root.querySelector("#title-screen");
    this.setupSecondaryTouch();
    root.addEventListener("click", (event) => this.onClick(event));
    root.addEventListener("input", (event) => this.onInput(event));
    root.addEventListener("change", (event) => this.onChange(event));
    root.addEventListener("keydown", event => {
      if (this.transitioning) { event.preventDefault(); event.stopPropagation(); }
    }, {capture:true});
    root.addEventListener("keydown", event=>this.onBindingKey(event), {capture:true});
    root.addEventListener("keydown", (event) => {
      if (!this.playing && this.overlayType && event.key === "Escape") {
        event.preventDefault();
        this.closeOverlay(false);
      }
    });
    document.addEventListener("fullscreenchange", () =>
      this.updateFullscreen(),
    );
    this.updateFullscreen();
    this.updateTitle();
    this.applyAccessibility();
  }
  shell() {
    return `
      <div id="world-canvas" aria-label="The Sundered Vale game world"></div>
      <div id="world-labels" aria-hidden="true"></div>
      <section id="title-screen" class="title-screen">
        <div class="title-shade"></div><div class="title-grain"></div>
        <header class="title-header">
          <div class="brand"><div class="brand-mark">${icon("compass", 32)}</div><div><strong>ETERNITY</strong><span>THE SUNDERED VALE</span></div></div>
          <div class="header-right"><span>AN ADVENTURE BY THE LIGHT</span><button class="icon-button title-fullscreen" data-action="fullscreen" aria-label="Enter fullscreen" title="Fullscreen">${icon("fullscreen", 19)}</button></div>
        </header>
        <div class="title-content">
          <div class="eyebrow"><span class="tiny-star">✦</span> A WORLD WORTH WANDERING <span class="eyebrow-line"></span></div>
          <h1>Find your<br><em>own light.</em></h1>
          <p>Somewhere beyond the familiar, a whole world is waiting. Follow the paths, meet its people, and bring a little light back to the Vale.</p>
          <div class="title-buttons">
            <button class="primary-button begin-button" data-action="begin"><span id="begin-label">BEGIN YOUR JOURNEY</span>${icon("arrow", 20)}</button>
            <button class="secondary-button" data-action="slots">${icon("book", 17)}<span> SAVE SLOTS</span></button>
          </div>
          <div class="title-hint"><span class="hint-diamond">✧</span> A handcrafted adventure <span class="hint-divider"></span> Playable offline</div>
        </div>
        <div class="title-chapter"><div class="chapter-number">04</div><div class="chapter-rule"></div><div><span>FOUR CHAPTERS TO EXPLORE</span><strong>The Glasswater Sound</strong><small>New crossings await beyond the Wilds.</small></div></div>
        <footer class="title-footer"><span>✦ &nbsp; A LITTLE LIGHT GOES A LONG WAY</span><span>MADE FOR THE CURIOUS &nbsp; · &nbsp; v6.0</span></footer>
      </section>
      <section id="hud" class="hud hidden" aria-label="Game controls and status">
        <div class="player-panel">
          <div class="portrait-wrap"><img src="/assets/wayfinder-portrait.webp" alt=""/><span id="hud-level" class="level-badge">1</span></div>
          <div class="player-details"><div class="player-name-row"><span id="hud-name">WAYFINDER</span><span class="tiny-gold">✦</span><span id="save-indicator" class="save-indicator" title="Save status">NOT SAVED YET</span></div><div class="bar health-bar"><span id="health-fill"></span></div><div class="bar-label"><span>VITALITY</span><span id="health-text">100 / 100</span></div><div class="bar xp-bar"><span id="xp-fill"></span></div><div class="bar-label xp-label"><span>JOURNEY</span><span id="xp-text">0 / 69 XP</span></div><div id="active-effects" class="active-effects hidden"></div></div>
        </div>
        <div class="region-heading"><span class="heading-flourish">✧</span><div><span id="region-kicker">THE SUNDERED VALE</span><strong id="region-name">Larkspur Haven</strong><small id="region-subtitle">A little light to come home to</small></div><span class="heading-flourish">✧</span></div>
        <div class="upper-right">
          <div class="quick-buttons"><button class="icon-button" data-action="fullscreen" aria-label="Enter fullscreen" title="Fullscreen">${icon("fullscreen", 17)}</button><button class="icon-button" data-action="pause" aria-label="Pause game" title="Pause (Esc)">${icon("pause", 17)}</button></div>
          <button class="minimap-button" data-action="map" aria-label="Open world map" title="Open atlas (M)"><canvas id="minimap" width="160" height="160"></canvas><span class="minimap-north">N</span><span class="minimap-caption"><span id="minimap-place">THE VALE</span> &nbsp; <b data-keybind="map">M</b></span></button>
        </div>
        <div class="quest-tracker"><div class="tracker-heading"><span>✦ &nbsp; YOUR JOURNEY</span><button data-action="journal" aria-label="Open journal">${icon("chevron", 15)}</button></div><div class="tracker-title" id="quest-title">A Light to Follow</div><p id="quest-objective">Find Mira by the waystone.</p><div class="tracker-progress"><span class="tracker-dot"></span><span id="quest-progress">A new beginning</span></div><div id="guide-bearing" class="guide-bearing hidden"><span class="bearing-arrow" aria-hidden="true">▲</span><span id="guide-target"></span><strong id="guide-distance"></strong></div></div>
        <div class="guide-card" id="guide-card"><button data-action="dismiss-guide" aria-label="Dismiss controls guide">${icon("close", 13)}</button><span class="guide-kicker">A LITTLE HELP TO GET STARTED</span><strong>Make yourself at home.</strong><p><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> to move <span>·</span> <kbd data-keybind="interact">E</kbd> to talk<br><kbd data-keybind="attack">J</kbd> or click to attack <span>·</span> <kbd data-keybind="dodge">SPACE</kbd> to dodge</p></div>
        <div class="context-prompt hidden" id="context-prompt"><span class="context-key" data-keybind="interact">E</span><span id="context-text">Talk</span><span class="context-arrow">›</span></div>
        <div class="bottom-dock"><div class="dock-label">EXPLORE THE WORLD</div><div class="dock-buttons"><button data-action="map" title="Atlas (M)" aria-label="Open atlas">${icon("map", 20)}<span>ATLAS</span></button><button data-action="journal" title="Journal (Tab)" aria-label="Open journal">${icon("book", 20)}<span>JOURNAL</span></button><button data-action="character" title="Character (C)" aria-label="Open character board">${icon("user", 20)}<span>CHARACTER</span></button></div></div>
        <div class="action-bar" aria-label="Actions"><button class="action-button" data-action="attack" aria-label="Attack"><span class="action-icon">${icon("sword", 24)}</span><span class="action-name">STRIKE</span><kbd data-keybind="attack">J</kbd></button><button class="action-button" data-action="dash" aria-label="Dodge"><span class="action-icon">${icon("dash", 24)}</span><span class="action-name">DODGE</span><kbd data-keybind="dodge">SPACE</kbd><i id="dash-cooldown"></i></button><button class="action-button" data-action="pulse" id="pulse-button" aria-label="Light pulse"><span class="action-icon">${icon("pulse", 23)}</span><span class="action-name">PULSE</span><kbd data-keybind="pulse">K</kbd><i id="pulse-cooldown"></i></button><button class="action-button" data-action="ward" id="ward-button" aria-label="Ward"><span class="action-icon">${icon("shield", 23)}</span><span class="action-name">WARD</span><kbd data-keybind="ward">L</kbd><i id="ward-cooldown"></i></button><button class="action-button" data-action="potion" aria-label="Use remedy"><span class="action-icon">${icon("potion", 23)}</span><span class="action-name">REMEDY</span><kbd data-keybind="potion">Q</kbd><b id="potion-count">3</b></button><button class="action-button" data-action="kit" id="kit-button" aria-label="Use preparation"><span class="action-icon" id="kit-icon">${icon("sun",23)}</span><span class="action-name" id="kit-name">FLASH</span><kbd data-keybind="kit">R</kbd><b id="kit-count">0</b><i id="kit-cooldown"></i></button></div>
        <div class="resource-strip"><span>${icon("gem", 15)} <b id="echo-count">0</b> <small>ECHOES</small></span><span class="resource-divider"></span><span class="coin-dot">●</span><b id="coin-count">0</b> <small>GOLD</small></div>
        <div class="touch-controls"><div id="joystick" class="joystick" aria-label="Movement joystick"><div class="joystick-center"></div></div><div class="touch-actions"><button data-action="interact" aria-label="Interact">${icon("hand", 25)}<small>USE</small></button><button data-action="dash" aria-label="Dodge">${icon("dash", 25)}<small>DODGE</small></button><button class="touch-strike" data-action="attack" aria-label="Attack">${icon("sword", 29)}<small>STRIKE</small></button></div></div>
      </section>
      <div id="zone-announcement" class="zone-announcement hidden"><span>✦ &nbsp; DISCOVERED &nbsp; ✦</span><strong></strong><small></small></div>
      <div id="toast-stack" class="toast-stack" aria-live="polite"></div>
      <div id="overlay" class="overlay hidden" role="dialog" aria-modal="true"></div>
      <div id="session-status" class="session-status hidden" role="status" aria-live="polite">Saving or opening your journey…</div>
      <div class="rotate-screen"><div class="rotate-icon">▱</div><span class="eyebrow">A WIDER WORLD AWAITS</span><h2>Turn your device</h2><p>Rotate your device to continue. Gameplay pauses while this screen is shown.</p><button class="secondary-button" data-action="fullscreen">${icon("fullscreen", 18)} FULLSCREEN</button></div>
      <div class="sr-only" aria-live="polite" id="announcer"></div>`;
  }
  bind(actions) {
    this.actions = actions;
  }
  blockTouchClick(pointerId) {
    // The joystick finger must never click a menu revealed under it when a
    // pause, blur, rotation or capture loss releases its pointer capture.
    this.blockedTouchClicks.set(pointerId, { ended: false });
  }
  setupSecondaryTouch() {
    this.root.addEventListener("pointerdown", event => {
      if (this.blockedTouchClicks.get(event.pointerId)?.ended) this.blockedTouchClicks.delete(event.pointerId);
    }, { capture: true });
    this.root.addEventListener("pointerup", event => {
      const blocked = this.blockedTouchClicks.get(event.pointerId);
      if (!blocked) return;
      blocked.ended = true;
      // A browser may not emit a click at all (e.g. after multi-touch).
      setTimeout(() => {
        if (this.blockedTouchClicks.get(event.pointerId) === blocked) this.blockedTouchClicks.delete(event.pointerId);
      }, 1000);
    }, { capture: true });
    this.root.addEventListener("pointercancel", event => this.blockedTouchClicks.delete(event.pointerId), { capture: true });
    // A joystick finger is the primary pointer. On Chromium a second touch
    // does not reliably synthesize a click, so explicitly activate buttons
    // on that finger's release while retaining native keyboard/mouse clicks.
    this.root.addEventListener("pointerdown", event => {
      if (event.pointerType !== "touch" || event.isPrimary || this.transitioning) return;
      const button = event.target.closest("button[data-action]");
      if (!button || button.disabled || button.closest("[inert], .hidden")) return;
      this.secondaryTouches.set(event.pointerId, button);
    });
    this.root.addEventListener("pointerup", event => {
      const button = this.secondaryTouches.get(event.pointerId);
      this.secondaryTouches.delete(event.pointerId);
      if (!button || this.transitioning || !button.isConnected || button.disabled || button.closest("[inert], .hidden")) return;
      const box = button.getBoundingClientRect();
      if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) return;
      this.lastSecondaryActivation = { button, pointerId: event.pointerId, until: performance.now() + 800 };
      button.click();
    });
    this.root.addEventListener("pointercancel", event => this.secondaryTouches.delete(event.pointerId));
    window.addEventListener("blur", () => this.secondaryTouches.clear());
    // Some browsers do produce a native click for a secondary pointer. Ignore
    // only that duplicate, not a new touch, a keyboard click or a mouse click.
    this.root.addEventListener("click", event => {
      if (event.isTrusted && this.blockedTouchClicks.has(event.pointerId)) {
        this.blockedTouchClicks.delete(event.pointerId);
        event.preventDefault();event.stopImmediatePropagation();return;
      }
      const recent = this.lastSecondaryActivation;
      if (!recent || !event.isTrusted || performance.now() > recent.until || !recent.button.contains(event.target)) return;
      const samePointer = event.pointerId === recent.pointerId;
      const legacyTouch = (event.pointerId === undefined || event.pointerId === -1) && event.sourceCapabilities?.firesTouchEvents;
      if (samePointer || legacyTouch) {
        event.preventDefault();event.stopImmediatePropagation();this.lastSecondaryActivation = null;
      }
    }, { capture: true });
  }
  setState(state) {
    this.state = state;
  }
  syncInteractionLock() {
    // While a session operation is in flight, neither Escape nor a click may
    // resume play after its final save snapshot has been taken.
    this.title.inert = this.transitioning || Boolean(this.overlayType);
    this.hud.inert = this.transitioning || Boolean(this.overlayType);
    this.overlay.inert = this.transitioning;
  }
  setTransitioning(busy) {
    if (busy) { this.operationFocus = document.activeElement; this.secondaryTouches.clear(); }
    this.transitioning = busy;
    this.root.classList.toggle("session-busy", busy);
    this.overlay.setAttribute("aria-busy", String(busy));
    this.root.querySelector("#session-status").classList.toggle("hidden", !busy);
    this.syncInteractionLock();
    if (!busy) {
      const focus = this.operationFocus;
      this.operationFocus = null;
      if (focus?.isConnected && !focus.disabled && !focus.closest("[inert], .hidden"))
        focus.focus?.({ preventScroll: true });
    }
  }
  setSaveStatus(status) {
    this.saveStatus=status;
    const labels={idle:"NOT SAVED YET",pending:"UNSAVED",saving:"SAVING…",saved:"SAVED",error:"SAVE FAILED"};
    const label=labels[status.status] || labels.idle;
    const indicator=this.root.querySelector("#save-indicator");
    if (indicator) {indicator.textContent=label;indicator.dataset.status=status.status;indicator.title=status.error || (status.lastSaved ? `Last saved ${new Date(status.lastSaved).toLocaleTimeString()}` : "No completed save yet");}
    const pause=this.overlay?.querySelector("#pause-save-status");
    if (pause) {
      pause.textContent=status.error ? `Save failed: ${status.error}. Export the current journey as a backup.`
        : status.status === "pending" ? "There are unsaved changes. Save or export your current journey."
        : status.status === "saving" ? "Saving your current journey…"
        : status.lastSaved ? `Last saved ${new Date(status.lastSaved).toLocaleTimeString()}. You can save or export now.`
        : "No completed save yet. You can export the current journey.";
      pause.dataset.status=status.status;
    }
  }
  setPlaying(playing) {
    this.playing = playing;
    this.title.classList.toggle("hidden", playing);
    this.hud.classList.toggle("hidden", !playing);
    this.root
      .querySelector("#world-labels")
      .classList.toggle("hidden", !playing);
    if (!playing) {
      this.dialogueNpc = null;
      this.closeOverlay(false);
      this.updateTitle();
    }
  }
  updateTitle() {
    const slots = listSlots();
    const saved = slots.some(slot => !slot.empty && !slot.unavailable && !slot.damaged);
    this.root.querySelector("#begin-label").textContent = saved
      ? "CONTINUE YOUR JOURNEY"
      : slots.some(slot => slot.unavailable || slot.damaged) ? "CHECK SAVE SLOTS" : "BEGIN YOUR JOURNEY";
  }
  updateFullscreen() {
    const active = !!document.fullscreenElement;
    this.root.querySelectorAll('[data-action="fullscreen"]').forEach((btn) => {
      btn.setAttribute(
        "aria-label",
        active ? "Exit fullscreen" : "Enter fullscreen",
      );
      btn.setAttribute(
        "title",
        active ? "Exit fullscreen" : "Enter fullscreen",
      );
      if (btn.classList.contains("icon-button"))
        btn.innerHTML = icon(active ? "exitfullscreen" : "fullscreen", 18);
    });
  }
  async onClick(event) {
    if (this.transitioning) return;
    const btn = event.target.closest("[data-action]");
    if (!btn || btn.disabled) return;
    const action = btn.dataset.action;
    try {
      if (action === "begin") {
        const slots = listSlots();
        const saved = slots.filter(s => !s.empty && !s.unavailable && !s.damaged)
          .sort((a, b) => b.savedAt - a.savedAt)[0];
        const empty = slots.find(s => s.empty);
        if (!saved && (!empty || slots.some(s => s.unavailable || s.damaged))) {
          this.openSlots();
          this.toast("Check your save slots", "A slot is unavailable or appears damaged. Review it before starting a new journey.", "info");
          return;
        }
        btn.disabled = true;
        try {
          await this.actions.start?.(saved?.slot ?? empty.slot);
        } finally {
          btn.disabled = false;
        }
      } else if (action === "fullscreen") await this.actions.fullscreen?.();
      else if (action === "slots") {
        if (this.playing) await this.actions.saveNow?.();
        this.openSlots();
      } else if (action === "slot-start")
        await this.actions.start?.(Number(btn.dataset.slot));
      else if (action === "slot-delete")
        this.confirmDelete(Number(btn.dataset.slot));
      else if (action === "delete-confirm") {
        await this.actions.deleteSlot?.(Number(btn.dataset.slot));
        this.openSlots();
        this.toast(
          "Journey deleted",
          "The slot is ready for a new story.",
          "book",
        );
      } else if (action === "slot-export")
        this.openExport(Number(btn.dataset.slot));
      else if (action === "export-current") {
        const slot=this.actions.currentSlot?.();
        if (slot !== null && slot !== undefined) this.openExport(slot,true);
      } else if (action === "back-export") {
        if (this.exportFromPause && this.playing) this.openPause(); else this.openSlots();
      } else if (action === "save-now") {
        await this.actions.saveNow?.();
        this.toast("Journey saved", "Your current slot is up to date.", "check");
      } else if (action === "export-confirm") {
        const pass =
          this.overlay.querySelector("#export-password")?.value || "";
        await this.actions.exportSlot?.(this.exportSlot, pass);
        this.toast(
          "Journey exported",
          "Keep the file somewhere safe.",
          "download",
        );
        if (this.exportFromPause && this.playing) this.openPause(); else this.openSlots();
      } else if (action === "choose-import")
        this.overlay.querySelector("#import-file").click();
      else if (action === "import-slot") {
        const slot = Number(btn.dataset.slot);
        const destination = listSlots().find(item => item.slot === slot);
        if (!destination || destination.unavailable)
          throw new Error("This slot could not be read. Check browser storage and retry.");
        const expectedRaw = readSlotRaw(slot);
        if ((expectedRaw === null) !== !!destination.empty)
          throw new Error("This slot changed. Choose it again to confirm replacement.");
        const pass = this.overlay.querySelector("#import-password")?.value || "";
        if (destination.empty) await this.finishImport(slot, pass, false, expectedRaw);
        else this.confirmImport(destination, pass, expectedRaw);
      } else if (action === "import-confirm") {
        const slot = this.pendingImport?.slot;
        if (slot === undefined) throw new Error("Choose a destination first.");
        const destination = listSlots().find(item => item.slot === slot);
        if (!destination || destination.unavailable)
          throw new Error("This slot could not be read. Check browser storage and retry.");
        const expectedRaw = this.pendingImport.expectedRaw;
        if (readSlotRaw(slot) !== expectedRaw)
          throw new Error("This slot changed. Choose it again to confirm replacement.");
        const pass = this.overlay.querySelector("#confirm-import-password")?.value || "";
        try { await this.finishImport(slot, pass, true, expectedRaw); }
        catch (error) {
          let changed = false;
          try { changed = readSlotRaw(slot) !== expectedRaw; } catch {}
          if (changed) throw new Error(`${error.message} The slot changed; choose it again before retrying.`);
          throw error;
        }
      } else if (action === "back-import") {
        this.pendingImport = null;
        this.openImport();
      } else if (action === "refresh-slots") this.openSlots();
      else if (action === "close") this.closeOverlay();
      else if (action === "back-slots") this.openSlots();
      else if (action === "pause") this.openPause();
      else if (action === "resume") this.closeOverlay();
      else if (action === "settings") {this.bindingAction=null;this.bindingError="";this.openSettings();}
      else if (action === "bind-key") {this.bindingAction=btn.dataset.binding;this.bindingError="";this.openSettings();}
      else if (action === "reset-bindings") {this.bindingAction=null;this.bindingError="";this.settings.bindings={...DEFAULT_BINDINGS};this.actions.settings?.(this.settings);this.openSettings();}
      else if (action === "return-title") {
        await this.actions.returnTitle?.();
      } else if (
        action === "map" ||
        action === "journal" ||
        action === "character"
      )
        this.openBoard(action);
      else if (action === "board-tab") this.openBoard(btn.dataset.board);
      else if (action === "character-tab") {
        this.characterTab = btn.dataset.tab;
        this.renderBoard();
      } else if (action === "journal-tab") {
        this.journalTab = btn.dataset.tab;
        this.renderBoard();
      } else if (action === "atlas-chapter") {
        this.atlasChapter = [1,2,3,4].includes(Number(btn.dataset.chapter)) ? Number(btn.dataset.chapter) : 1;
        const regions = REGIONS.filter(r => (r.chapter || 1) === this.atlasChapter);
        this.selectedRegion = regions.find(r => this.state.world.visited.includes(r.id))?.id || regions[0].id;
        this.renderBoard();
      } else if (action === "region-select") {
        this.selectedRegion = btn.dataset.region;
        this.renderBoard();
      } else if (action === "travel") {
        await this.actions.travel?.(this.selectedRegion);
        this.closeOverlay();
      } else if (action === "track-quest") {
        this.actions.trackQuest?.(btn.dataset.quest);
        this.renderBoard();
      } else if (action === "pin-region") {
        const id=this.state.world.pinnedRegion === this.selectedRegion ? null : this.selectedRegion;
        if (this.actions.pinRegion?.(id)) this.renderBoard();
      } else if (action === "track-route") {
        this.actions.trackRoute?.(this.state.world.trails.active === btn.dataset.trail ? null : btn.dataset.trail);
        this.renderBoard();
      } else if (action === "claim-route") {
        const result=this.actions.claimRoute?.(btn.dataset.trail);
        this.renderBoard();
        this.toast(result?.ok ? "Field route completed" : "Route not claimed",result?.ok ? `${result.trail.name} · +${result.reward.xp} XP, +${result.reward.coins} gold and one route seal.` : "Finish all objectives and stand near a restored waystone.",result?.ok ? "check" : "info");
      } else if (action === "talent") {
        this.actions.talent?.(btn.dataset.talent);
        this.renderBoard();
      } else if (action === "quest-accept") {
        this.actions.acceptQuest?.(btn.dataset.quest);
        this.showDialogue(this.dialogueNpc);
      } else if (action === "quest-complete") {
        const completed=this.actions.completeQuest?.(btn.dataset.quest);
        this.showDialogue(this.dialogueNpc, !!completed);
        if (!completed) this.toast("Request not completed", "Check the objectives and required delivery materials.", "info");
      } else if (action === "forge") {
        if (this.actions.forge?.()) {
          this.showDialogue(this.dialogueNpc);
          this.toast(
            "A finer edge",
            `Blade rank ${this.state.player.weapon} · strike power increased.`,
            "sword",
          );
        }
      } else if (action === "brew") {
        if (this.actions.brew?.()) {
          this.showDialogue(this.dialogueNpc);
          this.toast(
            "Remedy brewed",
            "One remedy added to your pack.",
            "potion",
          );
        }
      } else if (action === "archive-dial") {
        this.actions.cycleArchive?.(this.archiveItem,Number(btn.dataset.index));
        this.openArchive(this.archiveItem);
      } else if (action === "archive-align") {
        const result=this.actions.alignArchive?.(this.archiveItem);
        this.openArchive(this.archiveItem,result?.ok ? "The lenses settle into place. The fragment is yours to keep." : "The lenses do not align yet. Read the inscription and try another order.");
      } else if (action === "project-select") {
        this.projectSelection=btn.dataset.choice;
        this.openProject(this.projectItem);
      } else if (action === "project-confirm") {
        const result=this.actions.restoreProject?.(this.projectItem,this.projectSelection);
        this.openProject(this.projectItem,result?.ok ? "Your decision is now part of this place." : "Not enough materials. Gather the listed ore and sunpetals first.");
      } else if (action === "kit-craft") {
        const result=this.actions.craftPreparation?.(btn.dataset.kit);
        this.renderBoard();
        this.toast(result?.ok ? "Preparation crafted" : "Could not craft preparation",result?.ok ? `${result.item.name} added to your kit.` : "Check your seals, materials, capacity and location.",result?.ok ? "check" : "info");
      } else if (action === "kit-equip") {
        const ok=this.actions.equipPreparation?.(btn.dataset.kit);
        this.renderBoard();
        this.toast(ok ? "Preparation readied" : "Could not change kit",ok ? `Press ${this.keyName("kit")} or use the kit button in the field.` : "Stand near a restored waystone and check the unlock.",ok ? "check" : "info");
      } else if (action === "charm-craft") {
        const result=this.actions.craftCharm?.(btn.dataset.charm);
        this.renderBoard();
        this.toast(result?.ok ? "Charm crafted" : "Could not craft charm",result?.ok ? "Equip it here at a restored waystone." : "Check the recipe and your location.");
      } else if (action === "charm-equip") {
        const id=btn.dataset.charm === "none" ? null : btn.dataset.charm;
        const ok=this.actions.equipCharm?.(id);
        this.renderBoard();
        this.toast(ok ? "Loadout updated" : "Could not change loadout",ok ? "Your charm's effects are active." : "Stand near a restored waystone.");
      } else if (
        action === "attack" ||
        action === "dash" ||
        action === "pulse" ||
        action === "ward" ||
        action === "potion" ||
        action === "kit" ||
        action === "interact"
      )
        this.actions[action]?.();
      else if (action === "restart") {
        this.actions.restart?.();
        this.closeOverlay();
      } else if (action === "dismiss-guide") {
        this.guideDismissed = true;
        this.root.querySelector("#guide-card").classList.add("hidden");
        try { localStorage.setItem("eternity.guide.dismissed", "1"); } catch {}
      }
    } catch (error) {
      this.toast(
        "Something went wrong",
        error.message || "Please try again.",
        "info",
      );
      console.error(error);
    }
  }
  keyName(action) {return keyLabel((this.settings.bindings || DEFAULT_BINDINGS)[action]);}
  applyAccessibility() {
    this.root.classList.toggle("large-text",!!this.settings.largeText);
    this.root.classList.toggle("high-contrast",!!this.settings.highContrast);
    this.root.querySelectorAll("[data-keybind]").forEach(node=>{node.textContent=this.keyName(node.dataset.keybind);});
    for (const action of ["map","journal","character"]) this.root.querySelectorAll(`[data-action="${action}"]`).forEach(node=>{node.title=`${action[0].toUpperCase()+action.slice(1)} (${this.keyName(action)})`;});
  }
  onBindingKey(event) {
    if (this.overlayType!=="settings" || !this.bindingAction) return;
    event.preventDefault();event.stopPropagation();
    if (event.code==="Escape") {this.bindingAction=null;this.bindingError="";this.openSettings();return;}
    if (event.ctrlKey || event.metaKey || event.altKey) {this.bindingError="Use a single key without modifiers.";this.openSettings();return;}
    const result=setBinding(this.settings.bindings || DEFAULT_BINDINGS,this.bindingAction,event.code);
    if (!result.ok) {
      this.bindingError=result.reason==="conflict" ? `That key is already assigned to ${result.other}.` : "Choose a letter, number, Space or Tab; movement and Escape are reserved.";
      this.openSettings();return;
    }
    this.settings.bindings=result.bindings;this.bindingAction=null;this.bindingError="";
    this.actions.settings?.(this.settings);this.openSettings();
  }
  onInput(event) {
    if (this.transitioning) return;
    const key = event.target.dataset.setting;
    if (!key) return;
    let value =
      event.target.type === "checkbox"
        ? event.target.checked
        : event.target.type === "range"
          ? Number(event.target.value)
          : event.target.value;
    this.settings[key] = value;
    this.actions.settings?.(this.settings);
    const output = event.target
      .closest(".setting-row")
      ?.querySelector("output");
    if (output) output.textContent = `${Math.round(value * 100)}%`;
  }
  async onChange(event) {
    if (this.transitioning) return;
    if (event.target.id === "import-file" && event.target.files?.[0]) {
      const readId = ++this.importReadId;
      try {
        const file = event.target.files[0];
        if (file.size > 1024 * 1024)
          throw new Error("That save file is too large.");
        const text = await file.text();
        // A slow first selection must not replace a newer choice, nor reopen
        // the import dialog after the player has left the slots screen.
        if (readId !== this.importReadId || this.overlayType !== "slots") return;
        this.importText = text;
        this.openImport();
      } catch (error) {
        if (readId === this.importReadId && this.overlayType === "slots")
          this.toast("Could not read file", error.message, "info");
      }
    }
  }
  showOverlay(type, html) {
    this.secondaryTouches.clear();
    const oldFocus = document.activeElement;
    const wasOpen = Boolean(this.overlayType);
    const sameView=this.overlayType === type;
    const scrollSelectors=[".modal",".character-content",".journal-list",".atlas-detail",".atlas-layout"];
    const scrollPositions=sameView ? new Map(scrollSelectors.map(selector=>[selector,
      [...this.overlay.querySelectorAll(selector)].map(node=>node.scrollTop)])) : new Map();
    const focusedAction = this.overlay.contains(oldFocus)
      ? oldFocus.dataset?.action
      : null;
    const focusedIdentity = focusedAction ? { ...oldFocus.dataset } : null;
    if (!wasOpen) this.returnFocus = oldFocus;
    if (this.overlayType === "slots" && type !== "slots") this.importReadId++;
    if (this.overlayType === "import-confirm" && type !== "import-confirm") this.pendingImport = null;
    this.overlayType = type;
    this.overlay.innerHTML = html;
    if (sameView) for (const selector of scrollSelectors)
      [...this.overlay.querySelectorAll(selector)].forEach((node,index)=>{
        node.scrollTop=scrollPositions.get(selector)?.[index] || 0;
      });
    this.overlay.classList.remove("hidden");
    this.syncInteractionLock();
    const heading = this.overlay.querySelector("h2, h3");
    this.overlay.setAttribute(
      "aria-label",
      heading?.textContent || "Game menu",
    );
    this.actions.setPaused?.(true);
    // Preserve keyboard focus on rerendered board controls where possible.
    const buttons = [
      ...this.overlay.querySelectorAll(
        "button:not(:disabled), input:not([type=hidden]), select",
      ),
    ];
    const previous =
      focusedAction &&
      buttons.find((button) =>
        Object.entries(focusedIdentity).every(
          ([key, value]) => button.dataset[key] === value,
        ),
      );
    (previous || buttons[0])?.focus({ preventScroll: true });
  }
  closeOverlay(resume = true) {
    const wasOpen = Boolean(this.overlayType);
    this.importReadId++;
    this.overlayType = "";
    this.overlay.classList.add("hidden");
    this.overlay.innerHTML = "";
    this.pendingImport = null;
    this.syncInteractionLock();
    if (resume && this.playing) this.actions.setPaused?.(false);
    if (wasOpen && this.returnFocus?.isConnected)
      this.returnFocus.focus?.({ preventScroll: true });
    this.returnFocus = null;
  }
  overlayHeader(kicker, title, description = "") {
    return `<div class="modal-header"><div><span class="modal-kicker">✦ &nbsp; ${kicker}</span><h2>${title}</h2>${description ? `<p>${description}</p>` : ""}</div><button class="close-button" data-action="close" aria-label="Close">${icon("close", 20)}</button></div>`;
  }
  openPause() {
    if (!this.playing) return;
    this.showOverlay(
      "pause",
      `<div class="modal pause-modal">${this.overlayHeader("TAKE A BREATH", "Journey paused", "The world will be right here when you return.")}<div class="pause-decoration">${icon("compass", 42)}</div><div class="pause-actions">${button("resume", "RESUME JOURNEY", "play", "primary-button")}${button("settings", "SETTINGS", "settings", "menu-button")}${button("save-now", "SAVE NOW", "check", "menu-button")}${button("export-current", "EXPORT CURRENT JOURNEY", "download", "menu-button")}${button("slots", "SAVE SLOTS", "book", "menu-button")}${button("return-title", "SAVE & RETURN TO TITLE", "arrow", "menu-button subtle")}</div><div id="pause-save-status" class="modal-footnote">Autosave runs while you play; keep an exported backup.</div></div>`,
    );
    this.setSaveStatus(this.saveStatus);
  }
  openSettings() {
    const s = this.settings;
    this.showOverlay(
      "settings",
      `<div class="modal narrow-modal">${this.overlayHeader("MAKE IT YOURS", "Settings", "A little comfort for the road ahead.")}
      <div class="settings-list">
        <label class="setting-row"><span><strong>Music</strong><small>A gentle melody for the road</small></span><input type="range" min="0" max="1" step="0.05" value="${s.music}" data-setting="music"/><output>${Math.round(s.music * 100)}%</output></label>
        <label class="setting-row"><span><strong>Sound effects</strong><small>Combat, discovery and interactions</small></span><input type="range" min="0" max="1" step="0.05" value="${s.sfx}" data-setting="sfx"/><output>${Math.round(s.sfx * 100)}%</output></label>
        <label class="setting-row"><span><strong>Reduced motion</strong><small>Less camera shake and screen movement</small></span><input type="checkbox" class="switch" data-setting="reducedMotion" ${s.reducedMotion ? "checked" : ""}/></label>
        <label class="setting-row"><span><strong>Larger menu text</strong><small>Increase reading size in journals and menus</small></span><input type="checkbox" class="switch" data-setting="largeText" ${s.largeText ? "checked" : ""}/></label>
        <label class="setting-row"><span><strong>High contrast UI</strong><small>Stronger text and interface contrast</small></span><input type="checkbox" class="switch" data-setting="highContrast" ${s.highContrast ? "checked" : ""}/></label>
        <label class="setting-row"><span><strong>Objective guidance</strong><small>Show a straight-line bearing and map marker</small></span><input type="checkbox" class="switch" data-setting="guidance" ${s.guidance ? "checked" : ""}/></label>
        <label class="setting-row"><span><strong>Graphics</strong><small>Balanced adjusts resolution; High adds shadows</small></span><select data-setting="quality"><option value="balanced" ${s.quality === "balanced" ? "selected" : ""}>Balanced</option><option value="high" ${s.quality === "high" ? "selected" : ""}>High · shadows</option></select></label>
      </div><div class="binding-section"><div class="binding-heading"><div><strong>KEYBOARD CONTROLS</strong><small>WASD / arrows move · Escape pauses</small></div><button data-action="reset-bindings">RESET</button></div><p>Choose an action, then press a key. Escape cancels. Movement keys cannot be reassigned.</p><div class="binding-grid">${BINDING_ACTIONS.map(([id,label])=>`<button class="binding-button ${this.bindingAction===id ? "waiting" : ""}" data-action="bind-key" data-binding="${id}"><span>${esc(label)}</span><kbd>${this.bindingAction===id ? "PRESS A KEY…" : this.keyName(id)}</kbd></button>`).join("")}</div>${this.bindingError ? `<p class="binding-error" role="alert">${esc(this.bindingError)}</p>` : ""}</div><div class="settings-footer">${button("fullscreen", "TOGGLE FULLSCREEN", "fullscreen", "secondary-button dark-button")}<span>Settings are saved on this device.</span></div></div>`,
    );
  }
  openSlots() {
    this.importReadId++;
    const slots = listSlots();
    const cards = slots.map(s => {
      if (s.unavailable) return `<div class="slot-card unavailable"><div class="slot-number">${pad(s.slot + 1)}</div><div class="slot-info"><strong>Storage unavailable</strong><span>This slot could not be read. Check browser storage and retry.</span></div><div class="slot-actions"><button class="mini-button" data-action="refresh-slots">RETRY</button></div></div>`;
      return `<div class="slot-card ${s.empty ? "empty" : ""}"><div class="slot-number">${pad(s.slot + 1)}</div><div class="slot-info"><strong>${s.empty ? "A new beginning" : esc(s.name)}</strong><span>${s.empty ? "An empty page, waiting for you." : s.damaged ? "Stored data appears damaged. Try opening it or import a backup." : `LEVEL ${pad(s.level)} &nbsp; · &nbsp; ${esc(s.region)}`}</span></div><div class="slot-actions"><button class="slot-play" data-action="slot-start" data-slot="${s.slot}">${s.empty ? "START NEW" : s.damaged ? "TRY OPEN" : "CONTINUE"} ${icon("arrow", 16)}</button>${s.empty ? "" : `<button class="mini-button" data-action="slot-export" data-slot="${s.slot}" aria-label="Export slot ${s.slot + 1}" title="Export">${icon("download", 16)}</button><button class="mini-button danger" data-action="slot-delete" data-slot="${s.slot}" aria-label="Delete slot ${s.slot + 1}" title="Delete">${icon("trash", 16)}</button>`}</div></div>`;
    }).join("");
    this.showOverlay(
      "slots",
      `<div class="modal slots-modal">${this.overlayHeader("YOUR STORIES", "Saved journeys", "Choose a place for your story. Your progress saves automatically.")}
      <div class="slots-list">${cards}</div>
      <div class="slots-footer"><button class="text-button" data-action="choose-import">${icon("upload", 16)} IMPORT A JOURNEY</button><input id="import-file" type="file" accept=".json,.eternity,application/json" hidden/><span>AES-GCM protected saves · stored on this device</span></div></div>`,
    );
  }
  confirmDelete(slot) {
    this.showOverlay(
      "confirm",
      `<div class="modal narrow-modal">${this.overlayHeader("A MOMENT FIRST", "Delete this journey?", "Slot " + (slot + 1) + " and its progress will be permanently removed from this device.")}<div class="confirmation-actions">${button("back-slots", "KEEP JOURNEY", "book", "secondary-button dark-button")}<button class="danger-button" data-action="delete-confirm" data-slot="${slot}">${icon("trash", 17)} DELETE JOURNEY</button></div></div>`,
    );
  }
  openExport(slot,fromPause=false) {
    this.exportSlot = slot;
    this.exportFromPause = fromPause;
    this.showOverlay(
      "export",
      `<div class="modal narrow-modal">${this.overlayHeader("TAKE YOUR STORY WITH YOU", "Export journey", "Your save is encrypted with AES-GCM. Add an optional passphrase for protection when moving it between devices.")}<label class="field-label">EXPORT PASSPHRASE <span>OPTIONAL</span><input id="export-password" type="password" autocomplete="new-password" placeholder="Leave blank for standard protection"/></label><p class="fine-print">Without a passphrase, encryption discourages casual edits but is not a secret. A lost passphrase cannot be recovered.</p><div class="confirmation-actions">${button("back-export", "BACK", null, "secondary-button dark-button")}${button("export-confirm", "EXPORT SAVE", "download", "primary-button")}</div></div>`,
    );
  }
  openImport() {
    const protectedSave = saveIsProtected(this.importText),
      slots = listSlots();
    this.showOverlay(
      "import",
      `<div class="modal narrow-modal">${this.overlayHeader("WELCOME BACK", "Import journey", "Choose a destination. Importing will replace the journey in that slot.")}${protectedSave ? '<label class="field-label">EXPORT PASSPHRASE<input id="import-password" type="password" placeholder="Enter the passphrase" autocomplete="off"/></label>' : ""}<div class="import-choices">${slots.map((s) => `<button class="import-choice" data-action="import-slot" data-slot="${s.slot}" ${s.unavailable ? "disabled" : ""}><b>${pad(s.slot + 1)}</b><span>${s.unavailable ? "Storage unavailable" : s.empty ? "Empty slot" : `${esc(s.name)} · level ${s.level}`}</span>${icon("arrow", 18)}</button>`).join("")}</div><button class="text-button" data-action="back-slots">← BACK TO SAVE SLOTS</button></div>`,
    );
  }
  confirmImport(destination, passphrase, expectedRaw) {
    this.pendingImport = { slot: destination.slot, expectedRaw };
    const protectedSave = saveIsProtected(this.importText);
    this.showOverlay(
      "import-confirm",
      `<div class="modal narrow-modal">${this.overlayHeader("A MOMENT FIRST", "Replace this journey?", `Slot ${destination.slot + 1} ${destination.damaged ? "contains unreadable data" : `contains ${esc(destination.name)} (level ${destination.level})`}. Importing will permanently replace it. Export a backup first if you want to keep it.`)}${protectedSave ? '<label class="field-label">EXPORT PASSPHRASE<input id="confirm-import-password" type="password" autocomplete="off"/></label>' : ""}<div class="confirmation-actions">${button("back-import", "CHOOSE ANOTHER SLOT", null, "secondary-button dark-button")}${button("import-confirm", "REPLACE JOURNEY", "upload", "danger-button")}</div></div>`,
    );
    // Transfer the typed value to the new password input without embedding it in HTML.
    if (protectedSave) this.overlay.querySelector("#confirm-import-password").value = passphrase;
  }
  async finishImport(slot, passphrase, allowOverwrite = false, expectedRaw = undefined) {
    await this.actions.importSlot?.(this.importText, slot, passphrase, allowOverwrite, expectedRaw);
    this.pendingImport = null;
    this.toast("Journey imported", "Your save is ready to continue.", "check");
    this.openSlots();
  }
  openBoard(board) {
    if (!this.state) return;
    this.board = board;
    if (board === "map") {
      const current = regionAt(this.state.player.x, this.state.player.z) || REGION_BY_ID.haven;
      this.selectedRegion = current.id;
      this.atlasChapter = current.chapter || 1;
    }
    this.renderBoard();
  }
  renderBoard() {
    if (!this.state) return;
    const tabs = [
      ["map", "Atlas", "map", this.keyName("map")],
      ["journal", "Journal", "book", this.keyName("journal")],
      ["character", "Character", "user", this.keyName("character")],
    ];
    const content =
      this.board === "map"
        ? this.mapContent()
        : this.board === "journal"
          ? this.journalContent()
          : this.characterContent();
    this.showOverlay(
      "board",
      `<div class="modal board-modal"><div class="board-top"><div class="board-brand">${icon("compass", 25)}<span>THE WAYFINDER'S<br><strong>COMPANION</strong></span></div><div class="board-tabs">${tabs.map(([id, name, ic, key]) => `<button data-action="board-tab" data-board="${id}" class="${this.board === id ? "active" : ""}">${icon(ic, 17)} <span>${name}</span><kbd>${key}</kbd></button>`).join("")}</div><button class="close-button" data-action="close" aria-label="Close">${icon("close", 20)}</button></div>${content}</div>`,
    );
  }
  mapContent() {
    const s = this.state,
      region = REGION_BY_ID[this.selectedRegion] || REGION_BY_ID.haven,
      discovered = s.world.visited.includes(region.id),
      active = s.world.activated.includes(region.id),
      current = regionAt(s.player.x, s.player.z)?.id,
      chapterRegions = REGIONS.filter(r => (r.chapter || 1) === this.atlasChapter),
      guide = this.settings.guidance ? navigationTarget(s) : null;
    const canTravel =
      active && current !== region.id && this.actions.canTravel?.();
    return `<div class="board-heading"><div><span class="modal-kicker">✦ &nbsp; THE WORLD AWAITS</span><h2>World atlas</h2><p class="atlas-intro"><span class="atlas-intro-full">Every path has a story. Follow yours.</span><span class="atlas-scroll-hint">Scroll for the map and region details.</span></p></div><div class="board-counter"><strong>${pad(s.world.visited.length)} <i>/</i> ${REGIONS.length}</strong><span>PLACES DISCOVERED</span></div></div>
      <div class="atlas-layout"><div class="map-frame"><div class="map-compass">${icon("compass", 34)}<span>N</span></div><div class="atlas-chapters" aria-label="Atlas chapters">${[[1,"THE VALE"],[2,"THE REACHES"],[3,"THE WILDS"],[4,"THE SOUND"]].map(([number,name])=>`<button data-action="atlas-chapter" data-chapter="${number}" aria-label="Chapter ${number}: ${name}" title="Chapter ${number}: ${name}" class="${this.atlasChapter === number ? "active" : ""}">${pad(number)}<span class="chapter-label"> · ${name}</span></button>`).join("")}</div><div class="map-grid">${chapterRegions.map(
        (r) => {
          const seen = s.world.visited.includes(r.id),
            lit = s.world.activated.includes(r.id);
          return `<button class="map-zone ${r.roads?.length ? "authored-roads" : ""} ${seen ? "discovered" : "unknown"} ${r.id === this.selectedRegion ? "selected" : ""}" data-action="region-select" data-region="${r.id}" style="--zone:${r.accent};grid-column:${r.gx + 1};grid-row:${(r.gz % 2) + 1}">${mapIllustration(r)}<span class="map-stone ${lit ? "lit" : ""}" style="left:${mapPoint(r.shrine.x, r.shrine.z).x}%;top:${mapPoint(r.shrine.x, r.shrine.z).y}%">${lit ? "✦" : "◇"}</span>${current === r.id ? `<span class="map-player" title="Your location" style="left:${mapPoint(s.player.x - (r.gx - 2) * 54, s.player.z - r.gz * 54).x}%;top:${mapPoint(s.player.x - (r.gx - 2) * 54, s.player.z - r.gz * 54).y}%">◆</span>` : ""}${guide?.region === r.id ? `<span class="map-goal" title="${esc(guide.label)}" style="left:${mapPoint(guide.x - (r.gx - 2) * 54,guide.z - r.gz * 54).x}%;top:${mapPoint(guide.x - (r.gx - 2) * 54,guide.z - r.gz * 54).y}%">◆</span>` : ""}<span class="map-zone-name">${seen ? esc(r.name) : "UNDISCOVERED"}</span></button>`;
        },
      ).join(
        "",
      )}</div><div class="map-legend"><span><i class="legend-player"></i> YOUR LOCATION</span><span><i class="legend-stone">✦</i> RESTORED WAYSTONE</span><span><i class="legend-goal">◆</i> TRACKED DESTINATION</span></div></div>
      <aside class="atlas-detail"><span class="detail-number">${pad(REGIONS.indexOf(region) + 1)} &nbsp; / &nbsp; ${region.chapter === 4 ? "THE SOUND" : region.chapter === 3 ? "THE WILDS" : region.chapter === 2 ? "THE REACHES" : "THE VALE"}</span><div class="detail-art" style="--zone:${region.accent}">${icon("compass", 38)}</div><span class="modal-kicker">${discovered ? (region.danger ? "DANGER · LEVEL " + region.danger : "SAFE HAVEN") : "UNCHARTED"}</span><h3>${discovered ? esc(region.name) : "Somewhere new"}</h3><p>${discovered ? esc(region.description) : "A road leads somewhere you haven’t been yet. There’s only one way to find out."}</p><div class="detail-status"><span>${icon("star", 15)} ${active ? "WAYSTONE RESTORED" : "WAYSTONE DORMANT"}</span>${discovered && region.beacon ? `<span>${icon("pulse",15)} ${s.world.beacons.includes(region.id) ? "SIGNAL BEACON REPAIRED" : "SIGNAL BEACON DARK"}</span>` : ""}${discovered && region.anchor ? `<span>${icon("pulse",15)} ${s.world.tideAnchors.includes(region.id) ? "TIDE ANCHOR REPAIRED · SURGES CALM" : `TIDE ANCHOR · ${region.anchor.cost.ore} ORE + ${region.anchor.cost.echoes} ECHOES`}</span>` : ""}${discovered && region.archive ? `<span>${icon("book",15)} ${s.world.archives[region.id]?.solved ? "ARCHIVE ALIGNED" : "ARCHIVE UNALIGNED"}</span><span>${icon("shield",15)} ${s.world.projects[region.id] ? `RESTORED · ${s.world.projects[region.id].toUpperCase()}` : "RESTORATION AVAILABLE"}</span>` : ""}</div><button class="pin-button" data-action="pin-region" ${discovered ? "" : "disabled"}>${icon("flag",15)} ${s.world.pinnedRegion === region.id ? "CLEAR WAYPOINT" : "PIN THIS REGION"}</button><button class="primary-button travel-button" data-action="travel" ${canTravel ? "" : "disabled"}>${icon("compass", 16)} FAST TRAVEL</button><small>${canTravel ? "Travel from your nearby waystone." : active ? "Stand near another restored waystone to travel." : "Restore this waystone to unlock travel."}</small></aside></div>`;
  }
  journalContent() {
    const s = this.state, questIds = Object.keys(s.world.quests);
    if (!questIds.includes("first-light")) questIds.unshift("first-light");
    let entries = "";
    if (this.journalTab === "requests") {
      entries = questIds.map(id => {
        const q=QUESTS[id]; if (!q) return "";
        const status=s.world.quests[id] || "new", progress=questProgress(s,q);
        return `<article class="journal-card"><div class="journal-icon">${icon(status === "complete" ? "check" : "flag",20)}</div><div><span class="card-kicker">${status === "complete" ? "COMPLETED" : status === "new" ? "A NEW BEGINNING" : "REQUEST FROM " + esc(q.giver).toUpperCase()}</span><h3>${esc(q.name)}</h3><p>${status === "new" ? "Speak to Mira in Larkspur Haven to begin." : esc(q.hint)}</p><small>${status === "active" ? esc(progress.text) : status === "complete" ? "A little kindness goes a long way." : ""}</small>${status === "active" && progress.details ? `<ul class="objective-list">${progress.details.map(detail=>`<li class="${detail.ready ? "done" : ""}"><span aria-hidden="true">${detail.ready ? "✓" : "○"}</span> ${esc(detail.label)}${detail.required>1 ? ` <b>${detail.current}/${detail.required}</b>` : ""}</li>`).join("")}</ul>` : ""}</div>${status === "active" ? `<button class="track-button ${s.activeQuest === id ? "tracking" : ""}" data-action="track-quest" data-quest="${id}">${s.activeQuest === id ? "TRACKING" : "TRACK"}</button>` : ""}</article>`;
      }).join("");
    } else if (this.journalTab === "routes") {
      const atStone=!!this.actions.canTravel?.();
      entries=`<div class="route-intro"><strong>Field routes · ${s.world.trails.claimed.length} / ${TRAILS.length} seals</strong><p>Follow these optional, hand-written journeys across all four chapters. Progress is shared with your world and counts even before tracking. Claim a completed route at any restored waystone.</p></div>` + TRAILS.map(trail=>{
        const progress=trailProgress(s,trail.id), claimed=s.world.trails.claimed.includes(trail.id), tracking=s.world.trails.active===trail.id;
        return `<article class="route-card ${claimed ? "claimed" : ""} ${tracking ? "tracking" : ""}"><div class="route-heading"><div><span class="card-kicker">${claimed ? "SEAL EARNED" : `CHAPTER ${pad(trail.chapter)} · ${progress.current}/${progress.required} STOPS`}</span><h3>${esc(trail.name)}</h3><small>${esc(trail.subtitle)}</small></div><span class="route-seal">${icon(claimed ? "check" : "compass",23)}</span></div><p>${esc(claimed ? trail.conclusion : trail.introduction)}</p><ul class="objective-list">${progress.objectives.map(o=>`<li class="${o.done ? "done" : ""}"><span aria-hidden="true">${o.done ? "✓" : "○"}</span> ${esc(o.label)}</li>`).join("")}</ul><div class="route-footer"><span>REWARD · ${trail.reward.xp} XP · ${trail.reward.coins} GOLD${trail.reward.potions ? ` · ${trail.reward.potions} REMED${trail.reward.potions===1 ? "Y" : "IES"}` : ""} · 1 SEAL</span><div>${claimed ? "" : `<button class="track-button ${tracking ? "tracking" : ""}" data-action="track-route" data-trail="${trail.id}">${tracking ? "STOP TRACKING" : "TRACK"}</button>${progress.ready ? `<button class="route-claim" data-action="claim-route" data-trail="${trail.id}" ${atStone ? "" : "disabled"}>${atStone ? "CLAIM" : "NEAR A WAYSTONE"}</button>` : ""}`}</div></div></article>`;
      }).join("");
    } else if (this.journalTab === "field-guide") {
      const observed=Object.keys(s.world.bestiary).length;
      entries=`<div class="route-intro"><strong>Field guide · ${observed} / ${BESTIARY.length} observed</strong><p>Approach a creature to record its warning and counterplay. Entries describe what the encounter actually does; major encounters are revealed when seen.</p></div>` + BESTIARY.map(entry=>{
        const note=s.world.bestiary[entry.id];
        if (!note) return `<article class="field-card unknown"><div class="journal-icon">${icon("info",20)}</div><div><span class="card-kicker">NOT YET OBSERVED</span><h3>An unwritten page</h3><p>Explore the world to discover this encounter.</p></div></article>`;
        return `<article class="field-card"><div class="journal-icon">${icon(entry.icon,20)}</div><div><span class="card-kicker">${esc(entry.category).toUpperCase()} · ${note.defeated} SETTLED</span><h3>${esc(entry.name)}</h3><p>${esc(entry.description)}</p><dl><dt>THE WARNING</dt><dd>${esc(entry.tell)}</dd><dt>COUNTERPLAY</dt><dd>${esc(entry.counter)}</dd><dt>FIELD NOTE</dt><dd>${esc(entry.fieldNote)}</dd></dl></div></article>`;
      }).join("");
    } else if (this.journalTab === "memories") {
      entries = s.world.lore.length ? s.world.lore.map(id => {
        const r=REGION_BY_ID[id];
        return `<article class="journal-card memory-card"><div class="journal-icon">${icon("book",20)}</div><div><span class="card-kicker">${esc(r.name).toUpperCase()}</span><h3>${esc(r.lore.title)}</h3><p>${esc(r.lore.text)}</p></div></article>`;
      }).join("") : `<div class="empty-state">${icon("book",32)}<h3>The pages are still open.</h3><p>Find and read memory stones throughout the world.</p></div>`;
    } else if (this.journalTab === "archives") {
      const solved=Object.keys(ARCHIVES).filter(id=>s.world.archives[id]?.solved);
      entries=solved.length ? solved.map(id=>`<article class="journal-card memory-card"><div class="journal-icon">${icon("compass",20)}</div><div><span class="card-kicker">${esc(REGION_BY_ID[id].name).toUpperCase()}</span><h3>${esc(ARCHIVES[id].title)}</h3><p>${esc(ARCHIVES[id].fragment)}</p></div></article>`).join("") : `<div class="empty-state">${icon("compass",32)}<h3>The archive is waiting.</h3><p>Align the lenses at a Meridian archive to recover its story.</p></div>`;
    } else {
      entries = s.world.events.length ? [...s.world.events].reverse().map(event => {
        const date = new Date(event.at).toLocaleString(undefined,{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
        return `<article class="journal-card chronicle-card"><div class="journal-icon">${icon("clock",20)}</div><div><span class="card-kicker">${esc(date)}</span><p>${esc(describeEvent(event))}</p></div></article>`;
      }).join("") : `<div class="empty-state">${icon("clock",32)}<h3>Your chronicle is waiting.</h3><p>New discoveries and milestones will be recorded here.</p></div>`;
    }
    return `<div class="board-heading"><div><span class="modal-kicker">✦ &nbsp; STORIES ALONG THE WAY</span><h2>Your journal</h2><p>For the people, places, and moments worth remembering.</p></div><div class="board-counter"><strong>${pad(s.world.lore.length)} <i>/</i> ${REGIONS.length}</strong><span>MEMORIES FOUND</span></div></div><div class="sub-tabs"><button data-action="journal-tab" data-tab="requests" class="${this.journalTab === "requests" ? "active" : ""}">REQUESTS</button><button data-action="journal-tab" data-tab="routes" class="${this.journalTab === "routes" ? "active" : ""}">FIELD ROUTES</button><button data-action="journal-tab" data-tab="field-guide" class="${this.journalTab === "field-guide" ? "active" : ""}">FIELD GUIDE</button><button data-action="journal-tab" data-tab="memories" class="${this.journalTab === "memories" ? "active" : ""}">MEMORIES</button><button data-action="journal-tab" data-tab="archives" class="${this.journalTab === "archives" ? "active" : ""}">ARCHIVES</button><button data-action="journal-tab" data-tab="chronicle" class="${this.journalTab === "chronicle" ? "active" : ""}">CHRONICLE</button></div><div class="journal-list">${entries}</div>`;
  }
  characterContent() {
    const s = this.state,
      p = s.player,
      tabs = [
        ["level", "LEVELS"],
        ["powers", "POWERS"],
        ["charms", "CHARMS"],
        ["kit", "FIELD KIT"],
        ["achievements", "ACHIEVEMENTS"],
        ["stats", "STATS"],
      ];
    let content = "";
    if (this.characterTab === "level")
      content = `<div class="level-layout"><div class="character-portrait"><img src="/assets/wayfinder-portrait.webp" alt="Portrait of the Wayfinder"/><span>THE WAYFINDER</span></div><div class="level-detail"><span class="modal-kicker">YOUR JOURNEY SO FAR</span><h3>Level ${pad(p.level)}</h3><p>Every road makes you a little stronger. Earn a power point each time you level up.</p><div class="large-progress"><span style="width:${p.level >= LEVEL_CAP ? 100 : percent(p.xp, xpRequired(p.level))}%"></span></div><div class="progress-caption"><span>${p.level >= LEVEL_CAP ? "MAXIMUM LEVEL" : `${Math.floor(p.xp)} / ${xpRequired(p.level)} XP`}</span><span>${p.level >= LEVEL_CAP ? "YOUR LIGHT SHINES BRIGHT" : "NEXT LEVEL: " + pad(p.level + 1)}</span></div><div class="stat-pills"><div>${icon("heart", 18)} <span>MAX VITALITY<strong>${maxHealth(p)}</strong></span></div><div>${icon("sword", 18)} <span>STRIKE POWER<strong>${attackPower(p)}</strong></span></div><div>${icon("star", 18)} <span>POWER POINTS<strong>${p.points}</strong></span></div></div><button class="text-button" data-action="character-tab" data-tab="powers">EXPLORE YOUR POWERS ${icon("arrow", 16)}</button></div></div>`;
    if (this.characterTab === "powers") {
      const powers = [
        [
          "might",
          "Might",
          "A little more strength behind every strike.",
          "+2 strike power per point",
          "sword",
        ],
        [
          "vitality",
          "Heart",
          "A steadier heart for the longer roads.",
          "+12 maximum vitality per point",
          "heart",
        ],
        [
          "grace",
          "Grace",
          "Find your footing a little faster after dodging.",
          "−0.25s dodge recovery per point",
          "dash",
        ],
        ["focus","Focus","Shape Light Pulse into a stronger, more frequent burst.","+8% base strike as Pulse damage and −0.5s recovery per point", "pulse"],
      ];
      content = `<div class="powers-intro"><div><h3>Grow at your own pace.</h3><p>Choose where to spend the points earned from leveling up.</p></div><span class="points-badge">${p.points} POINT${p.points === 1 ? "" : "S"} AVAILABLE</span></div><div class="power-list">${powers.map(([id, name, desc, bonus, ic]) => `<article class="power-card"><div class="power-icon">${icon(ic, 24)}</div><div><h3>${name}</h3><p>${desc}</p><small>${bonus}</small></div><div class="power-rank"><span>${"● ".repeat(p.talents[id])}${"○ ".repeat(TALENT_CAPS[id] - p.talents[id])}</span><button data-action="talent" data-talent="${id}" ${!p.points || p.talents[id] >= TALENT_CAPS[id] ? "disabled" : ""}>${p.talents[id] >= TALENT_CAPS[id] ? "MAXED" : "SPEND POINT +"}</button></div></article>`).join("")}<article class="power-card skill-card"><div class="power-icon">${icon("pulse", 24)}</div><div><h3>Light Pulse</h3><p>A gentle burst that settles nearby creatures.</p><small>${p.skills.pulse ? `UNLOCKED · PRESS ${this.keyName("pulse")}` : "COMPLETE MIRA’S REQUEST TO UNLOCK"}</small></div><div class="skill-status">${p.skills.pulse ? "UNLOCKED" : "LOCKED"}</div></article><article class="power-card skill-card"><div class="power-icon">${icon("shield",24)}</div><div><h3>Waykeeper Ward</h3><p>Softens one hit for three seconds. Cooldown: 12 seconds.</p><small>${p.skills.ward ? `UNLOCKED · PRESS ${this.keyName("ward")}` : "HELP TAVI AT LANTERNBRIDGE TO UNLOCK"}</small></div><div class="skill-status">${p.skills.ward ? "UNLOCKED" : "LOCKED"}</div></article></div>`;
    }
    if (this.characterTab === "charms") {
      const atStone=!!this.actions.canTravel?.();
      const resources={ore:"ore",bloom:"sunpetals",echoes:"echoes"};
      content=`<div class="powers-intro charm-intro"><div><h3>A little something to carry.</h3><p>Craft and change one charm at a restored waystone. Alignment opens new recipes.</p></div><span class="points-badge">${archiveCount(s)} / 10 ARCHIVES</span></div><div class="charm-location ${atStone ? "available" : ""}">${icon(atStone ? "check" : "info",16)} ${atStone ? "WAYSTONE NEARBY · CRAFTING AVAILABLE" : "STAND NEAR A RESTORED WAYSTONE TO CHANGE YOUR LOADOUT"}</div>${p.gear.equipped ? `<button class="charm-unequip" data-action="charm-equip" data-charm="none" ${atStone ? "" : "disabled"}>REMOVE EQUIPPED CHARM</button>` : ""}<div class="charm-list">${CHARMS.map(charm=>{
        const owned=p.gear.owned.includes(charm.id),equipped=p.gear.equipped===charm.id,craftable=canCraftCharm(s,charm.id);
        const cost=Object.entries(charm.cost).map(([key,value])=>`${value} ${resources[key] || key}`).join(" · ");
        const status=equipped ? "EQUIPPED" : owned ? "OWNED" : archiveCount(s)<charm.unlock ? `UNLOCKS AT ${charm.unlock} ARCHIVES` : cost;
        return `<article class="charm-card ${equipped ? "equipped" : ""}"><div class="power-icon">${icon(charm.icon,22)}</div><div class="charm-copy"><span>${esc(status)}</span><h3>${esc(charm.name)}</h3><p>${esc(charm.description)}</p><strong>${esc(charm.effect)}</strong></div><button data-action="${owned ? "charm-equip" : "charm-craft"}" data-charm="${charm.id}" ${!atStone || equipped || (!owned && !craftable.ok) ? "disabled" : ""}>${equipped ? "EQUIPPED" : owned ? "EQUIP" : "CRAFT"}</button></article>`;
      }).join("")}</div>`;
    }
    if (this.characterTab === "kit") {
      const atStone=!!this.actions.canTravel?.(),seals=s.world.trails.claimed.length;
      const names={ore:"ore",bloom:"sunpetals",echoes:"echoes"};
      content=`<div class="powers-intro charm-intro"><div><h3>Prepared, not invincible.</h3><p>Craft and ready one preparation at a restored waystone. Use it with ${this.keyName("kit")} or the kit button; carrying capacity is ${KIT_CAP} each.</p></div><span class="points-badge">${seals} / ${TRAILS.length} ROUTE SEALS</span></div><div class="charm-location ${atStone ? "available" : ""}">${icon(atStone ? "check" : "info",16)} ${atStone ? "WAYSTONE NEARBY · KIT CHANGES AVAILABLE" : "STAND NEAR A RESTORED WAYSTONE TO CRAFT OR CHANGE PREPARATIONS"}</div><div class="kit-list">${KIT_ITEMS.map(item=>{
        const selected=p.kit.selected===item.id,count=p.kit.supplies[item.id],locked=seals<item.unlock,craftable=canCraftKit(s,item.id);
        const cost=Object.entries(item.cost).map(([key,value])=>`${value} ${names[key] || key}`).join(" · ");
        return `<article class="kit-card ${selected ? "equipped" : ""}"><div class="power-icon">${icon(item.icon,22)}</div><div class="kit-copy"><span>${locked ? `UNLOCKS AT ${item.unlock} ROUTE SEALS` : `${count} / ${KIT_CAP} CARRIED · ${item.cooldown}S RECOVERY`}</span><h3>${esc(item.name)}</h3><p>${esc(item.description)}</p><strong>${esc(item.effect)}</strong><small>CRAFT · ${esc(cost)}</small></div><div class="kit-actions"><button data-action="kit-craft" data-kit="${item.id}" ${!atStone || !craftable.ok ? "disabled" : ""}>CRAFT +1</button><button data-action="kit-equip" data-kit="${item.id}" ${!atStone || locked || selected ? "disabled" : ""}>${selected ? "READY" : "READY KIT"}</button></div></article>`;
      }).join("")}</div>`;
    }
    if (this.characterTab === "achievements")
      content = `<div class="powers-intro"><div><h3>Little victories, well earned.</h3><p>Some moments deserve a place of their own.</p></div><span class="points-badge">${s.achievements.length} / ${ACHIEVEMENTS.length} EARNED</span></div><div class="achievement-grid">${ACHIEVEMENTS.map((a, i) => `<article class="achievement-card ${s.achievements.includes(a.id) ? "earned" : ""}"><div class="achievement-icon">${icon(s.achievements.includes(a.id) ? "star" : "crown", 22)}</div><div><span>${s.achievements.includes(a.id) ? "ACHIEVEMENT EARNED" : "UNDISCOVERED · " + pad(i + 1)}</span><h3>${esc(a.name)}</h3><p>${esc(a.description)}</p></div></article>`).join("")}</div>`;
    if (this.characterTab === "stats") {
      const time = Math.floor(s.stats.seconds / 60);
      content = `<div class="powers-intro"><div><h3>By the numbers.</h3><p>A little record of everything you’ve carried and cared for.</p></div></div><div class="stats-grid">${[
        ["Echoes", p.echoes, "gem"],
        ["Sunpetals", p.bloom, "leaf"],
        ["Vale ore", p.ore, "gem"],
        ["Remedies", p.potions, "potion"],
        ["Gold", p.coins, "star"],
        ["Blade rank", p.weapon, "sword"],
      ]
        .map(
          ([name, n, ic]) =>
            `<div class="inventory-stat">${icon(ic, 20)}<span>${name}</span><strong>${n}</strong></div>`,
        )
        .join("")}</div><div class="variable-list">${[
        ["Creatures settled", s.stats.defeated],
        ["Sunpetals gathered", s.stats.blooms],
        ["Ore gathered", s.stats.ore],
        [
          "Requests completed",
          Object.values(s.world.quests).filter((v) => v === "complete").length,
        ],
        ["Waystones restored", s.world.activated.length],
        ["Signal beacons repaired", s.world.beacons.length],
        ["Tide anchors repaired", s.world.tideAnchors.length],
        ["Tide-runners settled", s.world.bestiary.surger?.defeated || 0],
        ["Supply caches opened", s.world.openedCaches.length],
        ["Sentinels settled", s.stats.sentinels],
        ["Shardcasters settled", s.stats.casters],
        ["Meridian archives aligned", archiveCount(s)],
        ["Wilds sites restored", projectCount(s)],
        ["Distance travelled", `${Math.floor(s.stats.distance)} m`],
        ["Times returned to the light", s.stats.falls],
        ["Time in the world", `${Math.floor(time / 60)}h ${time % 60}m`],
      ]
        .map(
          ([name, value]) =>
            `<div><span>${name}</span><strong>${value}</strong></div>`,
        )
        .join("")}</div>`;
    }
    return `<div class="board-heading"><div><span class="modal-kicker">✦ &nbsp; BECOMING WHO YOU ARE</span><h2>The Wayfinder</h2><p>There’s no wrong way to find your light.</p></div><div class="board-counter"><strong>${pad(p.level)}</strong><span>CURRENT LEVEL</span></div></div><div class="sub-tabs">${tabs.map(([id, label]) => `<button data-action="character-tab" data-tab="${id}" class="${this.characterTab === id ? "active" : ""}">${label}</button>`).join("")}</div><div class="character-content">${content}</div>`;
  }
  showDialogue(npc, justCompleted = false) {
    if (!npc || !this.state) return;
    this.dialogueNpc = npc;
    const q = QUESTS[npc.data.quest],
      status = this.state.world.quests[q.id] || "new",
      progress = questProgress(this.state, q);
    const line = justCompleted
      ? q.completeText
      : status === "new"
        ? q.introduction
        : status === "complete"
          ? q.completeText
          : progress.ready
            ? `You’re back! ${q.completeText}`
            : q.waiting;
    let dialogueLine = npc.id === "mira" && status === "complete" && !justCompleted && !this.state.world.quests["first-beacon"]
      ? `${line} Tavi is tending signal beacons south of Windward Bluffs, if you are ready for another road.` : line;
    const localChoice=this.state.world.projects[npc.region];
    if (localChoice && npc.data.reactions?.[localChoice]) dialogueLine+=` ${npc.data.reactions[localChoice]}`;
    if (npc.data.tideReaction && this.state.world.tideAnchors.includes(npc.region)) dialogueLine+=` ${npc.data.tideReaction}`;
    if (npc.id === "jun" && status === "complete") {
      const choices=Object.values(this.state.world.projects);
      const shelters=choices.filter(choice=>choice === "shelter").length;
      const watches=choices.filter(choice=>choice === "watch").length;
      dialogueLine+=` Your journey left ${shelters} ${shelters===1 ? "shelter" : "shelters"} and ${watches} ${watches===1 ? "watch" : "watches"} across the Wilds. People will use both to make their own decisions.`;
    }
    let questAction =
      status === "new"
        ? `<button class="primary-button" data-action="quest-accept" data-quest="${q.id}">ACCEPT REQUEST ${icon("arrow", 17)}</button>`
        : status === "active" && progress.ready
          ? `<button class="primary-button" data-action="quest-complete" data-quest="${q.id}">COMPLETE REQUEST ${icon("check", 17)}</button>`
          : "";
    let service = "";
    if (npc.id === "bram") {
      const rank = this.state.player.weapon,
        cost = 25 + rank * 20,
        ore = 3 + rank * 2;
      service = `<button class="service-button" data-action="forge" ${rank >= 5 ? "disabled" : ""}>${icon("sword", 18)} <span><strong>${rank >= 5 ? "BLADE FULLY FORGED" : `FORGE BLADE · RANK ${rank + 1}`}</strong><small>${rank >= 5 ? "Your blade is at its best." : `${cost} gold + ${ore} ore · +3 strike power`}</small></span>${icon("chevron", 16)}</button>`;
    }
    if (npc.id === "rowan")
      service = `<button class="service-button" data-action="brew">${icon("potion", 18)} <span><strong>BREW A REMEDY</strong><small>3 sunpetals · restores 45 vitality</small></span>${icon("chevron", 16)}</button>`;
    const earned = justCompleted
      ? `<div class="reward-note">${icon("star", 15)} <span>REQUEST REWARD · ${q.reward.xp} XP${q.reward.coins ? ` · ${q.reward.coins} GOLD` : ""}${q.reward.potions ? ` · ${q.reward.potions} REMEDIES` : ""}${q.reward.weapon ? " · BLADE UPGRADED" : ""}${q.reward.skill === "pulse" ? ` · LIGHT PULSE UNLOCKED (${this.keyName("pulse")})` : q.reward.skill === "ward" ? ` · WARD UNLOCKED (${this.keyName("ward")})` : ""}</span></div>`
      : "";
    this.showOverlay(
      "dialogue",
      `<div class="modal dialogue-modal"><button class="close-button dialogue-close" data-action="close" aria-label="Close">${icon("close", 20)}</button><div class="dialogue-art ${npc.id === "mira" ? "mira-art" : ""}" style="--npc:${esc(npc.data.color)}">${PORTRAITS[npc.id] ? `<img src="${PORTRAITS[npc.id]}" alt="${esc(npc.data.name)}, ${esc(npc.data.title)}"/>` : `<div class="dialogue-emblem">${icon("star", 38)}</div><span>${esc(npc.data.name[0])}</span>`}<div class="dialogue-art-caption"><small>${REGION_BY_ID[npc.region]?.chapter === 3 ? "A FRIEND IN THE WILDS" : REGION_BY_ID[npc.region]?.chapter === 2 ? "A FRIEND IN THE REACHES" : "A FRIEND IN THE VALE"}</small><strong>${esc(npc.data.name)}</strong></div></div><div class="dialogue-copy"><span class="modal-kicker">${esc(npc.data.title).toUpperCase()}</span><h2>${esc(npc.data.name)}</h2><div class="dialogue-rule"><span>✦</span></div><p class="dialogue-line">“${esc(dialogueLine)}”</p><div class="request-box"><div><span>${status === "complete" ? "REQUEST COMPLETE" : "A REQUEST"}</span><strong>${esc(q.name)}</strong></div><small>${status === "new" ? esc(q.hint) : status === "complete" ? "Thank you for lending a hand." : esc(progress.text)}</small></div>${earned}${service}<div class="dialogue-actions">${questAction}<button class="text-button" data-action="close">${questAction ? "MAYBE LATER" : "FAREWELL FOR NOW"}</button></div></div></div>`,
    );
  }
  openArchive(item,message="") {
    if(!item || !this.state || !ARCHIVES[item.region]) return;
    this.archiveItem=item;
    const definition=ARCHIVES[item.region],entry=readArchive(this.state,item.region),region=REGION_BY_ID[item.region];
    const reward=Object.entries(definition.reward).map(([key,value])=>`${value} ${key === "coins" ? "gold" : key === "bloom" ? "sunpetals" : key}`).join(" · ");
    this.showOverlay("archive",`<div class="modal narrow-modal archive-modal">${this.overlayHeader("MERIDIAN ARCHIVE · " + esc(region.name).toUpperCase(),esc(definition.title),"Turn each lens to follow the inscription from left to right.")}
      <div class="archive-inscription"><span>THE INSCRIPTION</span><p>“${esc(definition.inscription)}”</p></div>
      <div class="archive-dials" aria-label="Three archive lenses">${entry.dials.map((value,index)=>{const glyph=ARCHIVE_GLYPHS[value];return `<button data-action="archive-dial" data-index="${index}" aria-label="${["Left","Middle","Right"][index]} lens: ${esc(glyph.name)}. Turn to next sign." ${entry.solved ? "disabled" : ""}><small>${["LEFT","MIDDLE","RIGHT"][index]}</small>${icon(glyph.icon,28)}<strong>${esc(glyph.name)}</strong><span>${entry.solved ? "ALIGNED" : "TURN LENS"}</span></button>`;}).join("")}</div>
      ${entry.solved ? `<div class="archive-fragment"><span>FRAGMENT RECOVERED</span><p>${esc(definition.fragment)}</p><small>Saved to Journal → Archives. Reward claimed once.</small></div>` : `<p class="archive-reward">ON ALIGNMENT · ${esc(reward)}</p>`}
      ${message ? `<div class="frontier-feedback" role="status">${esc(message)}</div>` : ""}
      <div class="frontier-actions">${entry.solved ? "" : `<button class="primary-button" data-action="archive-align">ALIGN THE LENSES ${icon("arrow",16)}</button>`}<button class="text-button" data-action="close">${entry.solved ? "CARRY ON" : "LEAVE FOR NOW"}</button></div></div>`);
  }
  openProject(item,message="") {
    if(!item || !this.state) return;
    if(this.projectItem !== item) this.projectSelection=null;
    this.projectItem=item;
    const region=REGION_BY_ID[item.region],project=region?.project,choice=this.state.world.projects[item.region];
    if(!project) return;
    const selection=choice || this.projectSelection;
    this.showOverlay("project",`<div class="modal narrow-modal project-modal">${this.overlayHeader("A PLACE TO RESTORE · " + esc(region.name).toUpperCase(),esc(project.name),esc(project.context))}
      <p class="project-cost">${choice ? "YOUR LASTING DECISION" : `COST · ${project.cost.ore} ORE + ${project.cost.bloom} SUNPETALS <small>(YOU HAVE ${this.state.player.ore} ORE / ${this.state.player.bloom} SUNPETALS)</small>`}</p>
      <div class="project-options">${[["shelter","SHELTER","Local enemy damage −15%",project.shelter,"heart"],["watch","WATCH","Local enemy XP & gold +25%",project.watch,"compass"]].map(([id,title,effect,description,ic])=>`<button class="project-option ${selection===id ? "selected" : ""}" data-action="project-select" data-choice="${id}" ${choice ? "disabled" : ""}>${icon(ic,23)}<span><strong>${title}</strong><small>${esc(description)}</small><b>${effect}</b></span></button>`).join("")}</div>
      ${message ? `<div class="frontier-feedback" role="status">${esc(message)}</div>` : ""}
      <p class="project-warning">${choice ? `This place is permanently a ${choice}.` : "Choose carefully: this decision is permanent for this journey."}</p>
      <div class="frontier-actions">${choice ? "" : `<button class="primary-button" data-action="project-confirm" ${selection ? "" : "disabled"}>CONFIRM ${selection ? selection.toUpperCase() : "A CHOICE"} ${icon("check",16)}</button>`}<button class="text-button" data-action="close">${choice ? "CARRY ON" : "DECIDE LATER"}</button></div></div>`);
  }
  showMemory(region) {
    const lore = region.lore;
    this.showOverlay(
      "memory",
      `<div class="modal narrow-modal memory-modal">${this.overlayHeader("A MEMORY FROM " + esc(region.name).toUpperCase(), esc(lore.title))}<div class="memory-symbol">${icon("book", 34)}</div><p class="memory-quote">“${esc(lore.text)}”</p><div class="modal-footnote">Saved to your journal, so it won’t be forgotten.</div>${button("close", "CARRY ON", "arrow", "primary-button")}</div>`,
    );
  }
  showGameOver(lost) {
    this.showOverlay(
      "gameover",
      `<div class="modal narrow-modal gameover-modal"><span class="modal-kicker">✦ &nbsp; EVEN THE LIGHT NEEDS REST</span><h2>Every road leads<br>back to light.</h2><p>You’ll wake at your last restored waystone. ${lost ? `${lost} gold was left along the way.` : "Nothing was lost along the way."} Your discoveries and progress are safe.</p><div class="gameover-symbol">${icon("star", 40)}</div>${button("restart", "CONTINUE THE JOURNEY", "arrow", "primary-button")}${button("return-title", "SAVE & RETURN TO TITLE", null, "text-button")}</div>`,
    );
  }
  toast(title, text = "", ic = "star") {
    // Feedback from a modal action stays in the modal's flow instead of covering controls.
    if (this.overlayType) {
      const modal = this.overlay.querySelector(".modal");
      if (modal) {
        let note = modal.querySelector(".inline-feedback");
        if (!note) {
          note = document.createElement("div");
          note.className = "inline-feedback";
          const anchor = modal.querySelector(
            ".modal-header, .board-heading, .dialogue-rule",
          );
          if (anchor) anchor.after(note);
          else modal.prepend(note);
        }
        note.innerHTML = `${icon(ic, 15)} <strong>${esc(title)}</strong>${text ? `<span>${esc(text)}</span>` : ""}`;
        clearTimeout(this.inlineTimer);
        this.inlineTimer = setTimeout(() => note.remove(), 5000);
      }
    }
    const stack = this.root.querySelector("#toast-stack"),
      node = document.createElement("div");
    node.className = "toast";
    node.innerHTML = `<div class="toast-icon">${icon(ic, 18)}</div><div><strong>${esc(title)}</strong>${text ? `<span>${esc(text)}</span>` : ""}</div>`;
    stack.append(node);
    while (stack.children.length > 4) stack.firstElementChild.remove();
    setTimeout(() => {
      node.classList.add("leaving");
      setTimeout(() => node.remove(), 350);
    }, 3600);
    this.root.querySelector("#announcer").textContent = `${title}. ${text}`;
  }
  announceRegion(region) {
    const node = this.root.querySelector("#zone-announcement");
    node.querySelector("strong").textContent = region.name;
    node.querySelector("small").textContent = region.subtitle;
    node.classList.remove("hidden");
    node.classList.remove("show");
    void node.offsetWidth;
    node.classList.add("show");
    clearTimeout(this.regionTimer);
    this.regionTimer = setTimeout(() => node.classList.add("hidden"), 4200);
  }
  renderHUD(state, region, nearest, cooldowns, guide = null, kitTimers = {}) {
    if (!this.playing) return;
    this.state = state;
    const p = state.player,
      $ = (id) => this.root.querySelector("#" + id);
    $("hud-name").textContent = p.name.toUpperCase();
    $("hud-level").textContent = p.level;
    $("health-fill").style.width = percent(p.hp, maxHealth(p)) + "%";
    $("health-text").textContent = `${Math.ceil(p.hp)} / ${maxHealth(p)}`;
    $("xp-fill").style.width =
      (p.level >= LEVEL_CAP ? 100 : percent(p.xp, xpRequired(p.level))) + "%";
    $("xp-text").textContent =
      p.level >= LEVEL_CAP
        ? "MAX LEVEL"
        : `${Math.floor(p.xp)} / ${xpRequired(p.level)} XP`;
    $("region-kicker").textContent = region.chapter === 4 ? "THE GLASSWATER SOUND" : region.chapter === 3 ? "THE MERIDIAN WILDS" : region.chapter === 2 ? "THE LANTERN REACHES" : "THE SUNDERED VALE";
    $("minimap-place").textContent = region.chapter === 4 ? "THE SOUND" : region.chapter === 3 ? "THE WILDS" : region.chapter === 2 ? "THE REACHES" : "THE VALE";
    $("region-name").textContent = region.name;
    $("region-subtitle").textContent = region.subtitle;
    $("echo-count").textContent = p.echoes;
    $("coin-count").textContent = p.coins;
    $("potion-count").textContent = p.potions;
    const prepared=KIT_BY_ID[p.kit.selected] || KIT_ITEMS[0];
    $("kit-name").textContent=prepared.short;
    $("kit-count").textContent=p.kit.supplies[prepared.id];
    $("kit-cooldown").style.height=percent(cooldowns.kit,prepared.cooldown)+"%";
    $("kit-button").setAttribute("aria-label",`Use ${prepared.name}; ${p.kit.supplies[prepared.id]} remaining`);
    const effects=[kitTimers.haste>0 ? `TONIC ${Math.ceil(kitTimers.haste)}s` : "",kitTimers.regen>0 ? `DRAUGHT ${Math.ceil(kitTimers.regen)}s` : ""].filter(Boolean);
    $("active-effects").classList.toggle("hidden",!effects.length);$("active-effects").textContent=effects.join(" · ");
    if (this.kitIconId!==prepared.id) { $("kit-icon").innerHTML=icon(prepared.icon,23);this.kitIconId=prepared.id; }
    $("dash-cooldown").style.height =
      percent(cooldowns.dash, dashCooldown(p)) + "%";
    $("pulse-cooldown").style.height = percent(cooldowns.pulse, pulseCooldown(p)) + "%";
    $("pulse-button").classList.toggle("locked", !p.skills.pulse);
    $("ward-cooldown").style.height = percent(cooldowns.ward, 12) + "%";
    $("ward-button").classList.toggle("locked", !p.skills.ward);
    const q = QUESTS[state.activeQuest] || QUESTS["first-light"],
      status = state.world.quests[q.id],
      progress = questProgress(state, q);
    $("quest-title").textContent = q.name;
    $("quest-objective").textContent = !status
      ? "Find Mira by the waystone."
      : status === "complete"
        ? (state.world.quests["when-water-answers"] === "complete" ? "Revisit the Sound and the crossings you restored." : state.world.quests["opening-the-sound"] === "complete" ? "Find Tala at Echo Harbor in the Sound." : state.world.quests["the-order-we-change"] === "complete" ? "Follow the road south from Ashshore to meet Nia at Tidegate." : state.world.quests["measure-of-a-promise"] === "complete" ? "Seek Jun and the Tempest Engine at the Meridian Heart." : state.world.quests["gate-of-questions"] === "complete" ? "Meet Sera at Embercross Observatory in the Wilds." : state.world.quests["last-signal"] === "complete" ? "Follow the road south from Dawnreach to Harborward Gate." : state.world.quests["first-beacon"] === "complete" ? "Explore the Reaches and find the Storm Warden." : "Follow the road south beyond Windward Bluffs to meet Tavi.")
        : progress.ready
          ? `Return to ${q.giver}.`
          : q.hint;
    $("quest-progress").textContent = !status
      ? "A new beginning"
      : status === "complete"
        ? "Your story continues"
        : progress.text;
    const tracked=TRAIL_BY_ID[state.world.trails?.active];
    if (tracked) {
      const route=trailProgress(state,tracked.id), next=route.objectives.find(item=>!item.done);
      $("quest-title").textContent=tracked.name;
      $("quest-objective").textContent=next ? next.label : "Return to a restored waystone to claim your seal.";
      $("quest-progress").textContent=`FIELD ROUTE · ${route.current}/${route.required} stops`;
    }
    const bearing=bearingTo(p,guide), bearingNode=$("guide-bearing");
    bearingNode.classList.toggle("hidden",!guide);
    if (guide && bearing) {
      $("guide-target").textContent=guide.label;
      $("guide-distance").textContent=bearing.distance<3 ? "NEARBY" : `${bearing.direction} · ${Math.round(bearing.distance)} m`;
      bearingNode.querySelector(".bearing-arrow").style.transform=`rotate(${bearing.angle}rad)`;
      bearingNode.title=`Straight-line direction; use roads to navigate around obstacles.`;
    }
    const prompt = $("context-prompt");
    prompt.classList.toggle("hidden", !nearest);
    if (nearest) {
      let text = "";
      if (nearest.kind === "npc") text = `Talk to ${nearest.data.name}`;
      if (nearest.kind === "node")
        text = `Gather ${nearest.type === "bloom" ? "sunpetals" : "vale ore"}`;
      if (nearest.kind === "shrine")
        text = state.world.activated.includes(nearest.region)
          ? "Rest at waystone"
          : `Restore waystone · ${WAYSTONE_COST} echoes`;
      if (nearest.kind === "lore") text = "Read memory stone";
      if (nearest.kind === "anchor") {
        const cost=REGION_BY_ID[nearest.region].anchor.cost;
        text=state.world.tideAnchors.includes(nearest.region) ? "Tide anchor repaired" : `Repair tide anchor · ${cost.ore} ore + ${cost.echoes} echoes`;
      }
      if (nearest.kind === "beacon") text = state.world.beacons.includes(nearest.region) ? "Signal beacon repaired" : `Repair beacon · ${BEACON_COST.ore} ore + ${BEACON_COST.echoes} echoes`;
      if (nearest.kind === "cache") text = "Open supply cache";
      if (nearest.kind === "archive") text = state.world.archives[nearest.region]?.solved ? "Read aligned archive" : "Examine archive lenses";
      if (nearest.kind === "project") {
        const cost = REGION_BY_ID[nearest.region].project.cost;
        text = state.world.projects[nearest.region] ? "Inspect restored place" : `Restore site · ${cost.ore} ore + ${cost.bloom} sunpetals`;
      }
      $("context-text").textContent = text;
      this.root.querySelector('.touch-actions [data-action="interact"]').setAttribute("aria-label",text || "Interact");
    } else {
      this.root.querySelector('.touch-actions [data-action="interact"]').setAttribute("aria-label","Interact");
    }
  }
  setLabels(items) {
    const host = this.root.querySelector("#world-labels"),
      live = new Set();
    for (const item of items) {
      live.add(item.id);
      let el = this.labels.get(item.id);
      if (!el) {
        el = document.createElement("div");
        el.className = "world-label";
        host.append(el);
        this.labels.set(item.id, el);
      }
      el.innerHTML = item.html;
      el.style.transform = `translate(-50%,-100%) translate(${Math.round(item.x)}px,${Math.round(item.y)}px)`;
      el.className = `world-label ${item.className || ""}`;
    }
    for (const [id, el] of this.labels)
      if (!live.has(id)) {
        el.remove();
        this.labels.delete(id);
      }
  }
}
