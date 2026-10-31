# Eternity — world and systems design

## Intent and scope

This repository contains a **single-player, four-chapter playable foundation**, not a networked MMORPG, a verified ten-hour campaign, or the requested 30,000 lines of meaningful game code plus a separate 5,000-line engine. The goal is an active first minute and an extensible, coherent set of systems—not padding. There are four connected 5 × 2 grids of 54-unit regions. Residents, requests, enemies, resources, memories, waystones, chapter-specific interactions and landmarks have authored placements and stable IDs. The Wilds and Sound road curves are authored; older chapter road curves and small ground-cover decorations use stable seeds. The zones are modest in scale and the visuals are stylized low-poly, not the requested expansive high-poly production.

The intended loop is: **meet a neighbour → explore and settle the Hush → gather resources → restore a waystone, repair a beacon or fulfil a request → earn experience and spend a power point → reach another part of the world**. The introductory request directs the player east and unlocks Light Pulse on return to Mira. The second chapter begins south of Windward Bluffs; Tavi introduces the signal network and unlocks Ward. The third begins south of Dawnreach; Kea introduces archives and irreversible restoration choices, while Sera and Jun draw the fragments together. South of Ashshore, Nia introduces the Sound’s tide anchors and Tala coordinates the reopened harbor.

## Chapter one — The Sundered Vale

| Region | Suggested danger | Identity and role |
| --- | ---: | --- |
| Larkspur Haven | Safe | Mira introduces the waystones; Bram exchanges ore and gold for a sharper blade. Local Hushlings are peaceful until struck. |
| Sunpetal Fields | 1 | Rowan's garden and herbalism introduce renewable sunpetals and remedies. |
| Mosswhisper Grove | 2 | Fen maintains a safe forest route and asks the player to settle creatures. |
| Amber Run | 3 | Neri remembers lost travellers; a bridge avoids the water movement penalty. |
| Glassmere Reach | 4 | Iona tends stories and asks the player to read memory stones. |
| Redstone Rise | 5 | Orla needs ore to mend old fittings. |
| Gloamwood Veil | 7 | Ves links restored stones to the forest's health. |
| Windward Bluffs | 7 | Sol rewards exploration; the road continues south into the Reaches. |
| Starfall Basin | 9 | Cael interprets the stories left throughout the Vale. |
| The Hollow Crown | 10 | Orin asks the player to quiet the Crown Guardian, whose second phase adds a telegraphed aftershock. |

## Chapter two — The Lantern Reaches

| Region | Suggested danger | Identity and role |
| --- | ---: | --- |
| Lanternbridge Crossing | 5 | Tavi repairs the signal network and teaches Ward. |
| Saffron Saltmarsh | 6 | Isla gathers sunpetals for her field clinic. |
| Brackwater Fold | 7 | Mila asks for a chain of restored waystones. |
| Moorlight Mire | 8 | Yara recovers supplies left for future travellers. |
| Saltwind Strand | 8 | Pip maps routes through coastal squalls. |
| Shellwake Dunes | 9 | Daro asks the player to repair five beacons. |
| The Flooded Court | 10 | Rena collects memories of the old garden. |
| Dawnreach Harbor | 10 | Aven wants to reconnect all ten parts of the Reaches. |
| Hollowreed Fen | 11 | Kesh asks the player to quiet four sentinels. |
| Stormglass Spire | 14 | Lyra needs the Storm Warden's signal answered. |

## Chapter three — The Meridian Wilds

| Region | Suggested danger | Identity and role |
| --- | ---: | --- |
| Harborward Gate | 11 | Kea opens the Wilds and asks for the Gate Register and a restored yard. |
| Embercross Observatory | 12 | Sera compares conflicting archives and restores the observatory yard. |
| Sungold Terraces | 13 | Ben connects the terrace account, its memory and three restored sites. |
| Copperwood Orchard | 14 | Mara replants after fire, requiring the orchard record, commons and seedlings. |
| Slatefall Quarry | 15 | Oren uses the quarry ledger and ore to mark an evacuation route. |
| Stillwater Fen | 15 | Eda preserves differing accounts and asks for safe passage through shardcasters. |
| Ashshore Inlet | 16 | Bao carries an answer across the water after its record and landing are restored. |
| Cloudstep Ridge | 17 | Ren follows the ridge log and asks the player to explore and settle shardcasters. |
| Oldmeasure Ruins | 18 | Ilya preserves a dissenting diagram and restores a place for disagreement. |
| The Meridian Heart | 20 | Jun asks for six fragments and the Tempest Engine's defeat before changing its order. |

Each Wilds region has a three-dial archive and a restoration site with two permanent choices. The ten clues, solutions, fragments, rewards and project costs are authored. Some objective kinds are shared, but each request has multiple concrete prerequisites and its own dialogue/rewards; the design has not been evaluated for ten hours of variety. NPCs acknowledge their local choice, and Jun's completed dialogue summarizes the number of shelters and watches.

## Chapter four — The Glasswater Sound

| Region | Suggested danger | Identity and role |
| --- | ---: | --- |
| Tidegate Landing | 16 | Nia explains warning circles and the first repair; the road enters from Ashshore. |
| Netwright Quay | 17 | Teren repairs nets and shares the ferry knot. |
| Paperreef Library | 18 | Iri keeps conflicting accounts and copies in separate places. |
| Saltpan Steps | 18 | Mari maintains a shared kitchen and an extra bowl for late arrivals. |
| Bellreed Marsh | 19 | Omi waits for the last boat and connects its warning to the causeway. |
| Quiet Cove | 19 | Esme protects both a place to speak and the right to remain silent. |
| Lowtide Causeway | 20 | Pax maps for the slowest traveler, not the quickest runner. |
| Seaglass Lanterns | 20 | Leen makes distinct lights for different households. |
| Wreckwatch Point | 21 | Nilo records passengers and rescuers rather than recovered cargo. |
| Echo Harbor | 22 | Tala asks for Nia’s help, six repairs and a safer route before reopening the warning network. |

Each Sound region has one anchor and two manually placed surge sites, as well as a resident, memory, waystone, resources and enemies. Four additional field routes connect its people and places. The regions remain 54-unit tiles, not the expansive maps requested in the original brief; the authored paths and stories do not establish a ten-hour campaign.

Danger is a recommendation, not a gate. Each region has a memory, a waystone, a resident and a request; the Reaches also has one authored signal beacon and one one-time courier cache per region. Chapter-specific discovery and memory objectives only count the correct chapter. Some requests count cumulative progress made before they are accepted; item deliveries consume the required materials on completion. A request, boss victory, beacon or cache cannot be rewarded twice.

## Combat, balance and consequences

- A strike has a short windup and a directional, distance-limited hit test. Dodge has a cooldown and a brief invulnerable window. Thornlings attack wider and slower than Hushlings; sentinels project a longer-range pulse. The Crown Guardian and Storm Warden alternate attacks and add a telegraphed aftershock below half health. Warning rings use the same outer radius as the attack hit test. Shardcasters lock a straight warning lane, then fire a swept projectile that stops at the first solid or player; the wounded Tempest Engine follows a wide hit with three telegraphed lanes and bolts.
- Tavi's completed request unlocks Ward. It lasts up to three seconds, reduces one hit to 35% damage and has a 12-second cooldown. Each repaired beacon costs two echoes and two ore and permanently reduces the aggression range of enemies originating in that region to 75% and their damage to 80%.
- Levels grant power points through level 30. Might increases strike power, Heart increases maximum vitality, Grace reduces dodge recovery, and Focus boosts and accelerates Light Pulse; each has a cap. A shelter reduces local enemy damage to 85%, while a watch raises local enemy XP and gold to 125%. Eight charms can be crafted and equipped near restored waystones, with the effects and trade-offs displayed on the Character board. Bram's blade upgrades cost gold and ore. Rowan brews remedies from sunpetals. Rewards and costs are deliberately bounded, but the overall campaign still needs longer balance playtests.
- A Sound surge shows its red warning for 1.5 seconds before dealing 22 base damage to a player whose center is inside the displayed radius. Dodge invulnerability and Ward work normally. Each repaired anchor spends its listed ore and echoes once, suppresses only its region’s surges permanently, and changes wading speed there from 72% to 88% of normal. Re-entering a region starts its warning cycle with a grace period; paused/off-region cycles cannot strike unseen. Residents and the atlas reflect the repair.
- Tide-runners lock a 1.25-second capsule-shaped warning lane, then charge straight for up to seven units. Swept collision stops them at the first solid, other creature, resident or vulnerable player; a timely dodge avoids the hit, and Dawnflash can interrupt the charge. Any pending windup, charge or boss follow-up cancelled by streaming or distance must begin a new warning before attacking again; already-fired projectiles remain in flight. A new boss follow-up gets its full warning interval. Their field-guide entry records observations and bounded defeats.
- Wading is slower than walking on land or the Amber Run bridge. Restored waystones heal, become checkpoints, and permit travel to another restored waystone when the player is nearby. Falling returns the player to the last rested stone and costs 10% of carried gold without erasing permanent progress.

## Version 4: field routes and navigation

Sixteen optional routes tie authored locations and persistent actions into four-stop journeys, including four in the Sound. Progress counts retroactively; a completed route is claimed once at a restored waystone. Seals open the Trail Tonic and Moss Draught recipes, while Dawnflash is immediately available. Each preparation has distinct conditions, materials, a shared recovery and a five-item carrying cap; no timed effect persists across reload. A Dawnflash interrupts peaceful Haven creatures without making them hostile; previously hostile creatures remain hostile.

The field guide records observations of eight encounter types. Its bounded defeat counts migrate only information older schemas tracked. Guidance prioritizes a discovered-region pin, then the active route, then the active quest or a story giver. For supported repairs it points first to renewable missing materials, then to the repair. Its compass is a straight-line bearing, not full-world pathfinding. Click movement uses bounded local A*, checks collision clearance, permits manual cancellation, and retries or stops if dynamic obstacles block progress.

## State and performance

Version 6 retains schema 5. Saves contain the player, inventory, skills, charm loadout, field-kit stock, quest and route states, discoveries, restored stones, read memories, beacons, tide anchors, opened caches, archive dials, permanent project choices, encounter observations, achievements, boss flags and aggregate statistics. The journal chronicle retains at most 80 validated milestones. A sparse ledger records wounded authored creatures and expiring non-boss enemy/resource cooldowns; it is bounded by authored IDs and expired entries are pruned. Creatures that retreat home recover there. Decorative placements regenerate from stable seeds instead of growing the save.

Version 1–4 payloads migrate to schema 5, and Version 5 payloads remain compatible while retaining the existing encrypted envelope and slot names. Imported values, IDs, cooldowns, levels, talent budgets and derived state are checked. Per-slot writes are ordered within a session; replacing or deleting an active slot drains outstanding saves before the session is torn down. An occupied import requires confirmation and compares its chosen payload again before writing. This reduces accidental overwrites but is not an atomic cross-tab lock; concurrent tabs remain unsupported. AES-GCM detects tampering, but the default embedded key is not secret. Optional passphrase-protected exports are the portable backup mechanism.

Only nearby regions are attached to the scene, with camera-frustum culling, instanced ground cover, and visible-entity lists rebuilt only on region changes. Built region records are retained for the session and bounded by the authored region count; they are not an unlimited streaming-world cache. The minimap draws only intersecting regions plus edge padding. Balanced graphics can lower render resolution when a device struggles; high graphics adds real-time shadows. These are performance strategies, not a guarantee of 60 fps on particular devices.

The production website precaches its built assets after the first online visit on a secure origin. The generated standalone HTML embeds the same game, fonts, art and models and does not require a service worker. Their browser storage may be separate, so use import/export to move a journey.

## Extension guardrails

1. Add deliberately authored regions with connections, landmarks, residents, requests, resources, encounter roles and stable IDs; do not use random decoration as gameplay content.
2. Give new requests and NPC states consequences that survive revisits. Add migration code and tests whenever the schema changes; keep entity records and logs bounded.
3. Give new encounters readable hit windows, consistent animations, working keyboard/touch controls and counterplay. Test physical movement, collisions, save/reload and one-time rewards.
4. Measure the full campaign before claiming a ten-hour duration or a consistent frame rate on specific desktop and mobile devices.
5. Online multiplayer needs an authoritative server, networking, accounts, moderation and a separate trust model. Client-side saves alone cannot provide MMO security or synchronization.
