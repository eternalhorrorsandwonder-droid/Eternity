# Version 3 — The Meridian Wilds

> **HTML edition:** [`Eternity-V3.html`](Eternity-V3.html) is a self-contained offline build. Download and open it in a compatible browser; [README.md](README.md) covers controls, browser requirements, saves, migration and how to rebuild it. The Version 2 file remains available separately; the current builder produces Version 5 without overwriting this historical file.

## Additions

- A third connected chapter with ten authored 54-unit regions, placed roads, residents, requests, memories, waystones, landmarks, archive mechanisms and restoration sites. It continues the signal narrative into a disagreement about who gets to make decisions for a community.
- Ten inscription puzzles with three persistent lenses, one-time resources/XP and recoverable story fragments. Ten multi-objective requests support progress made before acceptance and consume delivery items transactionally on turn-in.
- Ten permanent, visually reflected **shelter or watch** decisions. A shelter reduces damage from enemies of that region by 15%; a watch increases their XP and gold rewards by 25%. The residents have distinct responses to the choice.
- Eight craftable, equippable charms with different costs, archive unlocks and stat trade-offs. Crafting and loadout changes require proximity to a restored waystone. The level cap is 30, with a fourth Focus talent and enough total talent capacity for every level-up point.
- Shardcasters aim fixed-direction warning lanes before launching projectiles. Swept collision detects the first player or scenery hit rather than permitting fast projectiles to tunnel. The Tempest Engine has a phase-two, three-lane bolt fan and a permanent defeat flag.
- A third atlas tab, archive journal, objective checklists, updated variable board, Sera portrait and compact landscape layouts, with gameplay paused under the portrait rotation screen. New and old animations/obstacles received targeted corrections: stationary NPCs use idle animation, roaming enemies respect obstacles, ruin pillars and visible ore have collision, and authored encounters are placed clear of scenery.

## State and compatibility

Version 1 and 2 encrypted payloads migrate to the Version 3 schema. Archive completion is validated against its actual dial solution; impossible gear, choices, unknown IDs and malformed ledgers are discarded or bounded. Rewards and choices are one-time. Inventory and lifetime-stat caps are applied consistently during play and import. Local slots and portable imports/exports still use authenticated AES-GCM; the default embedded key is not secret. Back up saves before upgrading.

## Validation performed

- Automated Node tests cover all ten puzzles and requests, incorrect and repeated submissions, restoration costs and effects, equipment stat trade-offs, max-level talent allocation, collision geometry, V1/V2 migrations, encrypted save integrity, slot ordering and authored placement clearance.
- Chromium browser checks exercised the new content from the UI, including every archive and restoration site, turn-in, Sera dialogue, watch/shelter persistence, charm crafting/equipping, locked-direction projectile dodge/hit, the boss's three warnings and one-time defeat, and reload. These accelerated tests used direct repositioning and granted materials where indicated; a separate keyboard test walked from Dawnreach to Kea.
- A 568 × 320 landscape touch emulation exercised the chapter switcher, puzzle, restoration and charms; a rotation check verified that gameplay pauses in portrait and resumes in landscape. The standalone `file://` edition was tested with a puzzle and encrypted save/reload without external requests. A production service-worker build was reopened offline, including all five character/building models and the Sera portrait. Wrong-password and simulated storage-failure checks preserved the active session and save.

## Remaining gaps

This is still a stylized, single-player foundation, not the requested networked MMORPG or a high-poly production game. It falls substantially short of the separate 30,000 meaningful game-code and 5,000-line engine quotas; this update does not pad the code to claim otherwise. Ten hours of authored play, consistent 60 fps and real-device mobile performance have not been established. Testing samples important paths but cannot establish that every bug is fixed. More varied world content, accessibility and long-form balancing, real-device profiling, and authoritative multiplayer infrastructure would be needed for the original full scope.
