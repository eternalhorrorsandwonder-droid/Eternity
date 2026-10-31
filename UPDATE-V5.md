# Version 5 — The Glasswater Sound

> **Offline HTML edition:** [`Eternity-V5.html`](Eternity-V5.html) is self-contained. See [README.md](README.md) for browser requirements, controls, saves and rebuilding. Versions 2–4 remain separate and unchanged.

## New content and consequences

- **A fourth chapter:** ten connected, manually placed 54-unit coastal regions south of Ashshore, with ten residents, distinct memories and requests, authored roads, water and encounter placements. Nia introduces the crossing; Tala's harbor request brings the network together. These are compact regions, not expansive maps.
- **Tide anchors:** each region has two local surge sites and one repairable anchor. A red circle appears for 1.5 seconds before a surge; the displayed outer radius is the actual hit test for the player's center. A hit deals 22 base damage before Ward or equipped damage modifiers. Dodge invulnerability applies. Each anchor costs its displayed amount of ore and echoes once; repair permanently removes local surges and reduces local water slowdown from 72% to 88% of normal movement speed. Repairs change the gauge, atlas status, nearby resident dialogue, quest objectives and chronicle. Entering a region gives its cycles a fresh grace period; paused and off-region cycles do not strike unseen.
- **Tide-runners:** a new non-boss creature locks a capsule-shaped warning lane for 1.25 seconds before charging straight up to seven units. Swept collision stops it at the first scenery, resident, other creature or vulnerable player, even over a long frame. An attack that leaves streaming range is cancelled rather than resuming without warning. Step sideways, dodge through it, use scenery, or interrupt it with Dawnflash. It has a field-guide entry and bounded observation/defeat count.
- **Four new field routes** weave together Sound residents, memories and repairs. As before, progress is retroactive and each route is claimed once at a restored waystone. Five new achievements cover the Sound's repairs, discovery, routes and harbor story; the existing field-guide achievement now lists all eight encounter types, while previously earned achievements remain earned.
- **Touch improvements:** the USE prompt shows the nearby action and material cost without covering the tested controls. At the smallest tested landscape width, the atlas stacks a larger map above scrollable region details rather than compressing its ten targets into a tiny strip. Nia has a new embedded dialogue portrait.

## Compatibility and state

Save schema **5** accepts schemas 1–4 and retains the existing encrypted envelope and slot keys. Tide anchors are stored as a deduplicated list of known authored region IDs, with at most ten entries. The temporary warning cycle is not saved: it restarts safely after loading or re-entering a region. Unknown IDs and duplicate anchors are discarded, and an imported repair implies that region was discovered. Keep an exported backup before upgrading; older editions may not read updated saves. The default local encryption key remains embedded and is not secret; use an export passphrase for a separate key.

## Validation

- **79 Node tests** cover the existing systems plus Sound placements, clearances, one-time repair costs, local water effects, hazard timing and edges, runner sweeps and interruption, ten request rewards, guidance and schema-4 migration.
- Chromium desktop integration exercises Nia's real dialogue, displayed warning/model state, damage and dodge edges, actual repair interaction, memory and request completion, runner warning/charge/collision, atlas and field guide, and encrypted reload. Some late-game scenarios use dev-only repositioning and resources rather than a full campaign playthrough.
- Touch emulation checks four atlas tabs, repair interaction, interaction-label/control separation and small-map targets at **801 × 320**, **720 × 320**, **568 × 320**, **480 × 320** and **400 × 260**. The 400-pixel atlas uses a scrollable layout; other compact controls still need real-device usability testing.
- A passphrase-protected V4 HTML journey was exported and imported into V5, preserving an active request and tracked route and rejecting a wrong password. V3 migration is also checked. The V5 `file://` build ran without network access, displayed Nia's actual embedded portrait, repaired an anchor and retained the repair after encrypted reload. The production site did the same after precaching **37 resources**.

## Remaining gaps

This is still a stylized, single-player foundation, not the requested networked MMORPG or an expansive high-poly production. It remains far short of the separate 30,000 meaningful game-code and 5,000-line optimized-engine quotas. No filler was added to imply otherwise. Ten hours of authored play, campaign-wide balance, consistent 60 fps and real-device mobile performance have not been established. Tests cover selected scenarios, not every possible bug or a complete playthrough.
