# Eternity — Version 6: Stability and controls

> **Standalone HTML:** Download [`Eternity-V6.html`](Eternity-V6.html) and open it in a modern browser with WebGL, JavaScript, local storage and Web Crypto enabled. Game code, artwork, models, fonts and applicable third-party licenses are embedded; no network connection is required. Some browsers restrict storage or Web Crypto for `file://` pages—if so, use the local-server instructions below. The earlier [`V5`](Eternity-V5.html), [`V4`](Eternity-V4.html), [`V3`](Eternity-V3.html) and [`V2`](Eternity-V2.html) standalone editions remain unchanged.

Eternity is a **single-player, offline-friendly** fantasy action RPG foundation. Four chapters contain **40 connected regions, 41 requests, 16 optional field routes and 32 achievements**. Version 6 focuses on save safety, touch input, combat warnings and clearer guidance; it does not add a new chapter. See [UPDATE-V6.md](UPDATE-V6.md) for the fixes and [UPDATE-V5.md](UPDATE-V5.md) for the Glasswater Sound chapter.

**Scope honesty:** this is not a networked MMORPG. Its comparatively small, 54-unit zones and stylized low-poly models do not meet the requested expansive high-poly MMO scope. The requested 30,000 meaningful game-code lines **plus** a separate 5,000-line optimized engine are not met: the `src` JavaScript tree is approximately 9,400 raw lines including comments and blank lines, and `src/game/engine.js` is approximately 1,900 raw lines. These are not counts of meaningful lines. No filler was added to inflate them. Ten hours of authored play, real-device mobile quality and consistent 60 fps remain unverified. See [DESIGN.md](DESIGN.md) for limitations and extension guidance.

## Start the website version

Requires Node.js 20.19+ (20.x) or 22.12+.

```sh
npm ci
npm run dev
```

For the production website with offline caching:

```sh
npm run build
npm run preview
```

Open the production site once while online and wait for its service worker to install; subsequent visits to the **same HTTPS origin or localhost** can run offline. The development server is not cached. The standalone HTML does not need a service worker or an initial online visit.

Browser saves are local to the browser and origin. The standalone `file://` edition and a hosted/localhost edition generally have different storage; file-origin behavior also varies by browser. To transfer progress, export a save from one edition and import it into the other. Clearing browser/site data or using private browsing can erase saves; keep an exported backup.

## Controls

These are the defaults; action keys can be changed in Settings. WASD, arrow keys and Escape remain reserved for movement and pause.

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move | WASD or arrow keys; click nearby ground to walk | Left joystick |
| Strike / dodge | J / Space; click a nearby creature to strike | STRIKE / DODGE |
| Talk, gather, read, restore or interact | E; click a nearby object to approach and interact | USE |
| Light Pulse / Ward / remedy / field kit | K / L / Q / R | PULSE / WARD / REMEDY / kit button |
| Atlas / journal / character boards | M / Tab / C | Bottom-left buttons or atlas companion tabs |
| Pause | Esc | Pause button |

Click movement plans a **short local route**, not unrestricted automatic travel; moving manually or opening a menu cancels it. If the path becomes blocked, it retries and stops rather than walking indefinitely. The objective bearing is a straight-line direction, not a path around scenery. In the atlas, pin a discovered region to override the current quest/route bearing. When a tracked repair needs materials, guidance points to a renewable source before the repair. Guidance can be turned off in Settings.

Rotate a phone or tablet to landscape; gameplay pauses under the portrait rotation screen. Starting the game attempts fullscreen when the browser allows it; a fullscreen button remains available if declined. Settings include music, sound effects, reduced motion, graphics, larger menu text, high contrast and key rebinding. The touch USE label names the nearby interaction and its cost. Menus scroll on small screens; on very narrow screens, scroll the atlas for region details and use the journal for full objectives. At widths of 390 CSS pixels or less, open the atlas to reach its Journal and Character tabs; fullscreen remains available on the title screen and in Settings.

## Your first steps

1. Speak to **Mira** in Larkspur Haven. Settle creatures for three echoes, restore the Sunpetal Fields waystone to the east, and return to unlock **Light Pulse**.
2. Open **Journal → Field Routes**. Track a route; its persistent objectives count even if completed before tracking. Claim a finished route near any restored waystone for its one-time reward and seal. Route rewards complement, rather than replace, the existing requests.
3. Near a restored waystone, open **Character → Field Kit** to craft and ready a preparation. Dawnflash interrupts nearby non-boss creatures without turning peaceful Haven creatures hostile; Trail Tonic grants temporary speed; Moss Draught slowly restores health until damage interrupts it. The latter recipes unlock with route seals. Each type has a five-item capacity and a recovery time.
4. Follow the road south through **Windward Bluffs** to **Lanternbridge Crossing**. Help **Tavi** repair a beacon for **2 echoes and 2 ore** to learn **Ward**. Ward softens one hit to 35% damage during its three-second window and has a 12-second cooldown.
5. From **Dawnreach Harbor** in the Reaches, follow the road south to **Harborward Gate** and meet **Kea**. Examine an archive, read its inscription, then turn its three lenses in order. Incorrect attempts cost nothing; dial positions and recovered fragments persist. Journal → Archives lets you reread solved fragments.
6. At a Wilds restoration site, choose **shelter** (local enemy damage × 0.85) or **watch** (local enemy XP and gold × 1.25). The displayed material cost is paid once; the choice is **permanent for that journey**. Residents comment on what you built.
7. Stand near any restored waystone and open **Character → Charms** to craft or change one equipped charm. Recipes show costs and trade-offs; further recipes unlock with aligned archives. The level cap is 30. **Journal → Field Guide** records encountered creature types, their tells and counterplay.
8. From **Ashshore Inlet**, go south to **Tidegate Landing** and speak to **Nia**. A red circle warns before a surge: move your character's center outside it or time a dodge. Repair each tide anchor with the displayed ore and echoes to permanently stop surges in that region and reduce its water slowdown. Tide-runners lock a rounded warning lane before charging; step sideways, dodge, use scenery, or interrupt a nearby runner with Dawnflash. Tala at Echo Harbor brings the network's story together.

Restored waystones heal, become checkpoints, and permit fast travel to another restored waystone from nearby. The atlas has four chapter tabs; the journal tracks requests, routes, memories, archives and the 80 most recent milestones. Creatures and gathering nodes return after a little real time. Discoveries, choices, archives, tide anchors, equipment, requests and boss victories persist. Falling returns you to the last rested stone and costs 10% of carried gold without erasing permanent progress.

## Saves and privacy

The HUD reports unsaved changes, saving, a completed save or a failure. Autosave runs during play; **Pause → Save Now** writes on demand. If storage fails, remain in the session and use **Pause → Export Current Journey**: it exports the current in-memory state, including progress that could not be saved. Restore storage and use Save Now, or import the backup elsewhere. Elapsed play-time can advance between autosaves. Save-and-return and other session changes lock controls until their save operation finishes; on a failure the live journey remains available.

Three local slots are encrypted and authenticated with AES-256-GCM, using a fresh random salt and IV and PBKDF2-SHA-256. The default local key is embedded in the application: it discourages casual edits but **does not provide secrecy** against someone inspecting the code. An optional export passphrase derives a separate key; a lost passphrase cannot be recovered. Slot names, level, region and last-saved time are stored as unencrypted menu metadata. Web Crypto and working browser storage are required. Imports are validated and capped at 1 MB. Occupied slots ask for confirmation before replacement; inaccessible or obviously malformed slots are not treated as empty. If a destination changes during import, the game checks again and asks you to reselect it. This is not cross-tab locking: avoid playing the same slot in multiple tabs, and keep backups.

Version 6 keeps save schema 5 and accepts Version 1–5 saves while retaining the encrypted envelope and slot keys. **Export a backup before upgrading**; older versions cannot necessarily read a save after it is updated. Tide-anchor IDs, wounded creatures and expiring respawns are bounded by authored locations, the chronicle and field-guide counters are capped, and decorative ground cover is regenerated from stable seeds rather than saved per object.

## Development

- `npm test` — run state, progression, encounters, collision, migration, cryptography and standalone-builder tests.
- `npm run test:browser` — optional Chromium desktop and touch regression suite against the **development** server. Install Chromium/Chrome separately, start `npm run dev`, then set `CHROMIUM_PATH=/path/to/chromium`; optionally set `ETERNITY_URL` if the server is not at `http://localhost:5173`. Tests use dev-only repositioning and resource grants for some scenarios.
- `npm run test:migration` — exercise passphrase-protected V3, V4 and V5 HTML exports and V6 imports against the dev server, including wrong-passphrase rejection. Set the same environment variables as above.
- `npm run test:offline` — after `npm run build:html` and starting a production preview on port 5175, test the V6 standalone file and hosted offline cache; set `CHROMIUM_PATH` and optionally `ETERNITY_PRODUCTION_URL`. The tests import an encrypted late-game fixture to reach the new chapter without a full playthrough.
- `npm run build` — create the static production site and a content-versioned offline cache in `dist/`.
- `npm run build:html` — rebuild the production site and `Eternity-V6.html`; this does **not** overwrite Versions 2–5.

The game bundles local assets; see [CREDITS.md](CREDITS.md) for model and font attribution. Designs, save assumptions and extension guardrails are in [DESIGN.md](DESIGN.md).
