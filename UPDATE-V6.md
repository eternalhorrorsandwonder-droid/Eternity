# Version 6 — stability and controls

> **Offline HTML:** [`Eternity-V6.html`](Eternity-V6.html) is self-contained. [README.md](README.md) covers browser requirements, controls, saves and rebuilding. Versions 2–5 remain separate and unchanged.

This iteration fixes issues found in the existing four-chapter game; it does not add another chapter or claim the original scope is complete.

## Fixes

- **Safer save transitions:** Save & Return, Save Now, starting a slot, import/export and deletion lock the relevant controls while their session operation completes. Escape and movement cannot resume the game after the final save snapshot. A failed save leaves the live journey paused so it can be retried or exported from memory.
- **Defensive slots and imports:** A storage read failure is shown as unavailable, not empty. Obviously malformed data, including an empty string, is marked as needing attention rather than overwritten as a new journey. Importing over an occupied slot requires confirmation; the selected payload is rechecked after asynchronous work and immediately before writing. If an active replacement fails, the live session and its saved snapshot remain available; reselect the slot before retrying. A slow file read cannot replace a newer selection or reopen a dismissed import menu. These checks are not an atomic cross-tab lock—avoid concurrent tabs on the same slot and keep exports.
- **Touch controls:** A second finger can strike, dodge or use a HUD button while the first holds the joystick. Releasing the stick after a pause or blur no longer clicks a newly revealed menu. Movement resets on pause, blur, hiding, rotation, lost capture or destruction; a second joystick finger cannot steal the first. Compact landscape HUD hit areas and notification placement were adjusted. At widths of 390 CSS pixels or less, Journal and Character remain available as atlas tabs, and fullscreen remains in the title screen and Settings.
- **Combat readability:** Dawnflash no longer makes a peaceful Haven creature hostile, but it preserves existing aggression. Pending melee and projectile windups, runner charges and boss aftershocks are cancelled when they leave the active area instead of resuming with a partial warning. Already-fired projectiles remain. A newly created boss follow-up receives its full 0.65-second warning, and creature warning rings sit above the shallow water surface.
- **Guidance and performance:** Tracked waystone, beacon, anchor and restoration objectives point to missing renewable materials first, then to the repair. The first request distinguishes earned echoes from echoes still available to spend; interaction labels include costs. The minimap draws intersecting regions with edge padding rather than all 40 regions on every redraw.

## Saves and compatibility

The save schema remains **5**, using the existing slot keys and AES-GCM envelope. Version 1–5 saves can be imported; export a backup before upgrading. Local encryption uses an embedded key and is not private from someone inspecting the application; an optional export passphrase uses a separate derived key. Storage and `file://` restrictions vary by browser and origin.

## Validation

- **89 Node tests** cover state, migration, collision, material-aware guidance, calm and hostile Dawnflash reactions, warning cancellation and timing, minimap region selection, storage faults and import preconditions.
- Chromium development-browser tests reproduce a delayed save-and-exit, failed writes, active-slot replacement failure and retry, inaccessible/corrupt slots, wrong passwords, occupied-slot confirmation, a changing destination, and competing file reads. Tests also exercise existing desktop, quest, tide, combat and encrypted-reload flows.
- Touch emulation checks primary HUD hitboxes, visible prompts, notifications and actual taps at **360×240, 390×260, 400×260, 440×260, 441×260, 480×320, 568×320, 720×320 and 801×320**. Chrome's touch protocol checks two-finger combat, pointer ownership, pause/blur/capture-loss/rotation/visibility resets and prevention of a release-triggered menu click. These are emulated browser tests, not physical-device certification.
- Protected exports from the delivered V3, V4 and V5 HTML editions were imported into the current build. The V5 test preserves a Sound anchor, request and route through an encrypted reload. The V6 standalone file was exercised offline, including Nia's embedded portrait, an anchor repair and two-finger actions; the production site repeated repair and reload after precaching 37 resources. Late-game scenarios use fixtures or dev-only positioning, not a full campaign playthrough.

## Remaining gaps

This is still a stylized, single-player foundation, not a networked MMORPG or expansive high-poly production. It remains far short of the requested 30,000 meaningful game-code lines plus a separate 5,000-line optimized engine; no filler was added. Ten hours of authored play, full-campaign balance, real-device mobile usability and consistent 60 fps remain unverified. Tests cover selected scenarios, not every possible defect.
