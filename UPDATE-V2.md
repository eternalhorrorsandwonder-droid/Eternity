# Version 2 — Expansive, Polish & Systems Update

> **HTML edition:** [`Eternity-V2.html`](Eternity-V2.html) is a self-contained, offline-playable build. Download it and open it in a modern browser; see the [README](README.md) for browser requirements and saves. This historical file is preserved; the current `build:html` command generates Version 5 instead.

## New content

- A connected second chapter, **The Lantern Reaches**, adds ten authored regions, ten residents with requests, ten memories, waystones, signal beacons and one-time supply caches. There are now 20 regions, 21 requests and 15 achievements in total.
- **Tavi** introduces beacon repair and rewards the defensive **Ward**. Repaired beacons permanently calm enemies originating in that region. Caches give authored supplies once.
- **Sentinels** add a longer-range pulse; the **Storm Warden** is a new persistent boss with alternating attacks and a second-phase echo.
- The atlas switches between chapter maps. The journal includes a bounded, persistent **Chronicle** of recent discoveries and milestones.

## Systems and polish

- Version 1 save migration preserves the existing encrypted slot format. Validation checks authored IDs, chapter objectives, talent budgets, creature health and boss flags; saved milestone history is capped at 80 entries.
- Active-slot replacement/deletion waits for pending writes and leaves the current session intact if the authoritative operation fails. Nonessential metadata failures do not invalidate a completed save or deletion.
- Beacon costs are atomic, caches and boss rewards cannot repeat, enemy collision handles exact overlap, and warning-ring radii match the associated hit checks. Several lore/cache positions were moved clear of rocks. Narrow landscape touch controls have separate space for movement, utility powers and combat.
- The portable build embeds fonts, art, models, styles and game code. The production website retains a content-versioned offline cache.

## Validation and known limits

Automated tests cover state migration, quests, one-time rewards, combat geometry, Ward, collisions, encrypted saves, slot ordering and standalone embedding. Browser checks exercised the standalone `file://` build and save/reload, chapter navigation and dialogue, enemy telegraphs and combat, touch emulation, migration, and import/delete failure handling. Real mobile hardware and sustained performance have not been benchmarked.

This remains a **single-player foundation**, not an online MMORPG. The requested 30,000 meaningful game-code lines have not been reached; ten hours of authored play and consistent 60 fps on desktop/mobile remain unverified. More authored content, longer balance/playability testing and real-device profiling are needed; no update can guarantee that every hidden defect is gone.
