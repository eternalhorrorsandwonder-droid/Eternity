/**
 * Enemy catalogue: the ordinary threats and the twelve titans.
 *
 * Every entry is a hand-authored balance line. `tier` is the level band the
 * enemy is meant to be met at, and the stats are tuned so that a player
 * fighting at their correct level takes a fight — three or four hits landed,
 * a dodge used, a potion drunk — and not a meeting of two numbers.
 *
 * `kind` drives AI: a melee chaser never kites, a ranged caster keeps distance
 * and punishes the player for closing, a flyer ignores terrain, a bruiser trades
 * hits for hits, a summoner spawns adds and dies last.
 */

export type EnemyKind = 'melee' | 'ranged' | 'flyer' | 'caster' | 'bruiser' | 'summoner' | 'ambush' | 'charger' | 'boss';

export interface EnemyDef {
  id: string;
  name: string;
  tier: number;
  health: number;
  damage: number;
  armor: number;
  speed: number;
  /** Approximate collision radius in blocks. */
  size: number;
  color: number;
  xp: number;
  kind: EnemyKind;
  /** Drop table: item id -> chance (0..1). */
  drops: [number, number][];
  abilities: string[];
  description: string;
  /** World-surface spawn weight relative to other enemies of the same tier. */
  spawnWeight: number;
  /** Whether this enemy can appear in the open world. */
  outdoor: boolean;
}

function e(
  id: string, name: string, tier: number, health: number, damage: number, armor: number,
  speed: number, size: number, color: number, xp: number, kind: EnemyKind,
  drops: [number, number][], abilities: string[], description: string,
  spawnWeight = 10, outdoor = true
): EnemyDef {
  return { id, name, tier, health, damage, armor, speed, size, color, xp, kind, drops, abilities, description, spawnWeight, outdoor };
}

export const ENEMIES: EnemyDef[] = [
  // ---------------------------------------------------------------- tier 0-6
  e('slime_wisp', 'Slime Wisp', 1, 22, 4, 0, 1.6, 0.55, 0x6ae06a, 4, 'melee', [[1047, 0.6]], ['Sticky'], 'A small green blob that bounces toward you in odd arcs.', 12),
  e('boarling', 'Boarling', 2, 34, 6, 1, 1.9, 0.7, 0xa0805a, 7, 'charger', [[1212, 0.5], [1005, 0.2]], ['Charge', 'Gore'], 'It lowers its head before it runs at you. Learn the tell.', 14),
  e('bat', 'Bat', 1, 12, 3, 0, 2.6, 0.45, 0x4a3a4a, 3, 'flyer', [], ['Swarm'], 'A nuisance that circles and bites.', 10),
  e('llama', 'Llama', 3, 46, 8, 2, 1.7, 0.75, 0xd0c0a0, 11, 'melee', [[1212, 0.4], [1006, 0.1]], ['Spit'], 'Spits when you are not looking at it.', 12),
  e('wolf_hound', 'Wolf Hound', 3, 44, 9, 1, 2.4, 0.6, 0x8a7868, 9, 'ambush', [[1212, 0.45], [1006, 0.15]], ['Pounce', 'Howl'], 'Hunts in a pack. Five teeth, one mind.', 16),
  e('cave_spider', 'Cave Spider', 4, 40, 7, 1, 1.8, 0.6, 0x5a4a3a, 12, 'ambush', [[1245, 0.5]], ['Venom', 'Web Shot'], 'Waits in the dark. Its venom slows you.', 14),
  e('silverfish', 'Silverfish', 4, 26, 5, 1, 2.0, 0.45, 0xb0a898, 8, 'ambush', [[1005, 0.6]], ['Tunnel'], 'Small, fast, and fond of walls. It hides in stone.', 10),
  e('stray', 'Stray', 4, 52, 10, 3, 1.7, 0.65, 0xb0a898, 14, 'melee', [[1200, 0.4], [1006, 0.15]], ['Bash'], 'An undead thing with a fathomless patience.', 14),
  e('husk', 'Husk', 5, 62, 12, 4, 1.6, 0.7, 0xc8b088, 18, 'melee', [[1200, 0.45], [1006, 0.2]], ['Rot'], 'Corrupted by the dust. Slow, heavy, relentless.', 14),
  e('zombie', 'Zombie', 5, 58, 11, 3, 1.5, 0.65, 0x6a8a5a, 16, 'melee', [[1200, 0.45], [1006, 0.2]], ['Rotten Touch'], 'The most common death in the world, and the most forgiven.', 18),
  e('skeleton', 'Skeleton', 6, 52, 13, 4, 1.6, 0.6, 0xe0e0d0, 20, 'ranged', [[1038, 0.4], [1006, 0.2], [1031, 0.1]], ['Arrow Volley'], 'It stops at range and shoots.', 16),
  e('drowned', 'Drowned', 6, 68, 14, 5, 1.4, 0.7, 0x5a7a8a, 22, 'melee', [[1216, 0.5], [1060, 0.1]], ['Drown'], 'Found in water. It drags you down.', 14, true),
  e('guardian', 'Guardian', 7, 90, 16, 8, 1.3, 0.85, 0x5ad0c0, 28, 'bruiser', [[1089, 0.3], [1090, 0.2]], ['Slam', 'Gaze'], 'Ancient and slow. Its gaze costs you your reach.', 10),
  e('squid', 'Squid', 5, 44, 8, 2, 1.6, 0.65, 0x5a6a8a, 14, 'melee', [[1211, 0.5], [1060, 0.2]], ['Ink'], 'Coastal water, and a painful nuisance.', 10),
  e('phantom', 'Phantom', 8, 60, 18, 3, 2.2, 0.6, 0x6a6ad0, 30, 'flyer', [[1061, 0.5]], ['Screech', 'Fade'], 'Appears when you have not slept. It is always hungry.', 8, false),
  e('witch', 'Witch', 8, 76, 15, 4, 1.6, 0.65, 0x6aa060, 34, 'caster', [[1245, 0.4], [1316, 0.2], [1006, 0.3]], ['Hex', 'Poison Potion', 'Heal'], 'It drinks, and then it throws the rest at your face.', 8),
  e('imp', 'Imp', 9, 70, 17, 3, 2.1, 0.55, 0xd06020, 32, 'ranged', [[1051, 0.25], [1248, 0.3]], ['Fireball'], 'A small hellion with a big mouth.', 14, false),
  e('vex', 'Vex', 10, 64, 19, 4, 2.3, 0.5, 0xd0c0a0, 36, 'flyer', [[1487, 0.2], [1488, 0.1]], ['Summon Minions', 'Screech'], 'A broken construct that summons its betters.', 8, false),
  e('arcane_warden', 'Arcane Warden', 11, 120, 22, 10, 1.4, 0.85, 0x8060d0, 48, 'bruiser', [[1071, 0.4], [1070, 0.3]], ['Arcane Slam', 'Beam'], 'A construct of the old towers. Still obedient.', 8),
  e('crystal_golem', 'Crystal Golem', 12, 190, 26, 16, 1.1, 1.0, 0x7ce8e8, 64, 'bruiser', [[1070, 0.5], [1033, 0.3]], ['Crystal Shards', 'Reflect'], 'It is made of the thing you are mining for.', 8),
  e('pillager', 'Pillager', 12, 96, 24, 8, 1.8, 0.7, 0x5a6a4a, 42, 'ranged', [[1006, 0.4], [1031, 0.25], [1095, 0.3]], ['Crossbow Volley', 'Banner'], 'They travel in a group, and they fight as one.', 12),
  e('blaze', 'Blaze', 15, 130, 28, 8, 1.8, 0.6, 0xff9030, 60, 'flyer', [[1051, 0.5], [1249, 0.4]], ['Fireball', 'Slam'], 'A rod of living flame. It resents water.', 10, false),
  e('magma_cube', 'Magma Cube', 15, 170, 30, 14, 1.2, 0.9, 0xd05020, 66, 'bruiser', [[1248, 0.5], [1455, 0.3]], ['Explosion', 'Slam'], 'It splits when it dies, and the pieces are still angry.', 10, false),
  e('ghast', 'Ghast', 16, 150, 32, 8, 1.7, 0.9, 0xe8e0c0, 72, 'ranged', [[1052, 0.4], [1051, 0.3]], ['Fireball', 'Moan'], 'It floats above you and weeps. The weeping is fatal.', 8, false),
  e('piglin', 'Piglin', 16, 110, 31, 10, 1.9, 0.7, 0xb09050, 58, 'melee', [[1031, 0.3], [1032, 0.25]], ['Golden Axe', 'Taunt'], 'It will not attack you while you hold gold. This is not a kindness.', 12, false),
  e('hoglin', 'Hoglin', 17, 180, 34, 16, 1.6, 0.85, 0xb07060, 76, 'charger', [[1212, 0.4], [1006, 0.2]], ['Charge', 'Bull'], 'Small, ugly, and unreasonably determined.', 10, false),
  e('wither_skeleton', 'Wither Skeleton', 18, 140, 38, 14, 1.7, 0.65, 0x4a4a52, 82, 'melee', [[1035, 0.4], [1038, 0.3]], ['Wither', 'Sword Dance'], 'The bones carry the curse. The sword carries the rest.', 10, false),
  e('shulker', 'Shulker', 19, 120, 36, 12, 1.5, 0.6, 0xc0a0e0, 88, 'flyer', [[1426, 0.4]], ['Levitate', 'Suck'], 'It clings to the ceiling and does not come down.', 8, false),
  e('evoker', 'Evoker', 20, 160, 40, 10, 1.7, 0.7, 0x60a090, 100, 'summoner', [[1426, 0.3], [1488, 0.2]], ['Summon Vex', 'Velocity Bolt', 'Fangs'], 'The warped grove\'s true power. It does not fight you. It fights your future.', 6, false),
  e('enderman', 'Enderman', 20, 130, 38, 8, 2.2, 0.8, 0x4a3a6a, 90, 'ambush', [[1053, 0.4]], ['Teleport', 'Stare'], 'Look at its eyes and it will leave you alone. That is not the same as safe.', 10, false),
  e('wraith', 'Wraith', 24, 150, 44, 8, 2.4, 0.7, 0x607090, 110, 'flyer', [[1061, 0.3]], ['Invisibility', 'Soul Drain'], 'It feeds on the light you do not have.', 8),
  e('banshee', 'Banshee', 26, 170, 48, 10, 2.3, 0.65, 0xc0a0d0, 130, 'caster', [[1245, 0.3]], ['Wail'], 'Its cry strips your buffs and your courage at once.', 6),
  e('wight', 'Wight', 28, 220, 52, 18, 1.6, 0.85, 0x8a8a6a, 150, 'bruiser', [[1033, 0.3], [1061, 0.2]], ['Curse', 'Bash'], 'A knight who forgot his oath, and kept his strength.', 8),
  e('cursed', 'Cursed One', 30, 200, 56, 20, 1.9, 0.75, 0x904080, 170, 'melee', [[1063, 0.3], [1062, 0.3]], ['Curse of the Deep', 'Miasma'], 'Where it walks, nothing grows.', 6),
  e('spectral', 'Spectral Knight', 32, 240, 60, 24, 2.0, 0.8, 0xc0c0e0, 200, 'ranged', [[1033, 0.35], [1489, 0.15]], ['Spectral Bolt', 'Phasing'], 'A ghost with a grudge and a budget.', 6),
  e('bloodmote', 'Bloodmote', 34, 230, 64, 20, 2.6, 0.5, 0xc02020, 220, 'flyer', [[1048, 0.4]], ['Blood Burst'], 'A swarm of ticks with a single mind.', 8, false),
  e('void_wraith', 'Void Wraith', 40, 300, 74, 24, 2.4, 0.8, 0x5040a0, 300, 'ambush', [[1074, 0.4], [1075, 0.25]], ['Void Rift', 'Fade'], 'It comes from the spaces between the stars.', 6, false),
  e('ember_knight', 'Ember Knight', 36, 320, 78, 30, 2.1, 0.85, 0xff5020, 280, 'melee', [[1081, 0.35], [1051, 0.3]], ['Flame Wreath', 'Slam'], 'A knight of the Cinderfall, still burning when the war ended.', 8, false),
  e('hollow_warden', 'Hollow Warden', 44, 400, 90, 36, 1.8, 1.0, 0x3a4a3a, 400, 'bruiser', [[1427, 0.3], [1630, 0.2]], ['Deepslam', 'Summon Shrieker'], 'It has been waiting in the dark for a very long time.', 6, false),
  e('starborn_mote', 'Starborn Mote', 48, 380, 96, 30, 2.5, 0.55, 0xfff0a0, 460, 'flyer', [[1077, 0.35], [1078, 0.3]], ['Starlight', 'Teleport'], 'A living piece of a falling star. It is not sorry.', 6, false),
  e('eternity_spawn', 'Eternity Spawn', 55, 520, 110, 40, 2.2, 0.9, 0xffe070, 600, 'summoner', [[1076, 0.3]], ['Summon', 'Chrono Rift'], 'The first children of the world. They never grew up.', 5, false),
  e('world_heart_tendril', 'World Heart Tendril', 60, 640, 128, 44, 2.0, 0.95, 0xff3aa0, 700, 'bruiser', [[1086, 0.25]], ['Heart Pulse', 'Eruption'], 'The world is not dead. It is hurting.', 5, false),
  e('abyssal_leviathan', 'Abyssal Leviathan', 64, 820, 140, 48, 1.6, 1.4, 0x2040a0, 900, 'bruiser', [[1478, 0.3], [1053, 0.2]], ['Abyssal Slam', 'Water Rupture'], 'It is longer than your boat. That is the whole fight.', 4, false),
  e('moonwell_guardian', 'Moonwell Guardian', 68, 700, 132, 52, 2.0, 0.9, 0xc0d0ff, 800, 'caster', [[1078, 0.35], [1077, 0.25]], ['Moonlight', 'Heal'], 'The well has always had a caretaker. Now you have met it.', 4, false),
  e('crimson_warlord', 'Crimson Warlord', 70, 900, 150, 58, 2.1, 0.95, 0xe02040, 950, 'melee', [[1062, 0.3], [1032, 0.2]], ['War Cry', 'Whirlwind'], 'He died for the war, and the war has not finished.', 5, false),
  e('verdant_spirit', 'Verdant Spirit', 74, 780, 140, 44, 2.4, 0.8, 0x7ce05a, 850, 'caster', [[1080, 0.4], [1080, 0.2]], ['Verdant Vines', 'Rebirth'], 'The forest remembers every axe. It will return them.', 4, false),
  e('arcane_twin', 'Arcane Twin', 78, 620, 148, 46, 2.6, 0.6, 0xa080e8, 900, 'ranged', [[1071, 0.4], [1072, 0.3]], ['Mirrored Bolt', 'Counterspell'], 'Two minds, one spell, and a very polite disagreement.', 4, false),
];

export const ENEMY_BY_ID: Map<string, EnemyDef> = new Map(ENEMIES.map((n) => [n.id, n]));

/**
 * Aliases for boss ids. The region map refers to titans by their common name
 * (`verdant_heart`, `eternity_guardian`, …) while the encounter code refers to
 * them by their internal id. Both resolve to the same definition.
 */
export const ENEMY_ALIAS: Record<string, string> = {
  silverfish: 'silverfish',
  verdant_heart: 'boss_verdant',
  eldritch_heart: 'boss_eldritch',
  starfall_titan: 'boss_starfall',
  eternity_guardian: 'boss_eternity',
  ender_dragon: 'boss_end',
  wither: 'boss_wither',
};

/** Resolve any enemy or boss id to a usable EnemyDef. */
export function resolveEnemy(id: string): EnemyDef | undefined {
  if (ENEMY_BY_ID.has(id)) return ENEMY_BY_ID.get(id);
  const alias = ENEMY_ALIAS[id];
  if (alias && ENEMY_BY_ID.has(alias)) return ENEMY_BY_ID.get(alias);
  const boss = BOSS_BY_ID.get(alias ?? id);
  if (boss) return bossToEnemy(boss);
  return undefined;
}

/** Wrap a boss as an EnemyDef so the same AI code can drive it. */
export function bossToEnemy(boss: BossDef): EnemyDef {
  return {
    id: boss.id, name: boss.name, tier: boss.tier,
    health: boss.health, damage: boss.damage, armor: boss.armor,
    speed: 1.5, size: 1.1, color: boss.color, xp: boss.xp,
    kind: 'boss', drops: boss.drops, abilities: boss.abilities,
    description: boss.description, spawnWeight: 0, outdoor: false,
  };
}

/** Tier bands: the level range where each enemy is at its fairest. */
export function enemyTierBand(tier: number): [number, number] {
  return [tier * 4 - 2, tier * 4 + 6];
}

/** Pick an enemy id appropriate to a level and biome theme. */
export function enemyForLevel(level: number, rng: () => number): string {
  const tier = Math.max(1, Math.min(20, Math.round((level + 2) / 4)));
  const pool = ENEMIES.filter((e) => e.tier === tier && e.outdoor);
  if (!pool.length) return ENEMIES[0].id;
  const total = pool.reduce((s, x) => s + x.spawnWeight, 0);
  let roll = rng() * total;
  for (const cand of pool) {
    roll -= cand.spawnWeight;
    if (roll <= 0) return cand.id;
  }
  return pool[pool.length - 1].id;
}

/** ------------------------------------------------------------ the twelve
 * Each boss is a named arena encounter with a phase count. The phase count is
 * not flavour: it is the number of health thresholds at which the encounter
 * changes its behaviour, and the fight is authored around them.
 */

export interface BossDef {
  id: string;
  name: string;
  tier: number;
  health: number;
  damage: number;
  armor: number;
  phases: number;
  xp: number;
  /** The region feature id of its arena. */
  arena: string;
  /** The coordinates of its arena, in region-grid units. */
  arenaAt: [number, number];
  color: number;
  drops: [number, number][];
  abilities: string[];
  description: string;
}

function b(
  id: string, name: string, tier: number, health: number, damage: number, armor: number,
  phases: number, xp: number, arena: string, arenaAt: [number, number], color: number,
  drops: [number, number][], abilities: string[], description: string
): BossDef {
  return { id, name, tier, health, damage, armor, phases, xp, arena, arenaAt, color, drops, abilities, description };
}

export const BOSSES: BossDef[] = [
  b('boss_ember', 'Ignis, the Ember Titan', 12, 1400, 26, 14, 2, 260, 'boss_arena_ember', [7, 6], 0xff6020,
    [[1081, 1], [1031, 0.8], [1051, 0.6]],
    ['Emberburst', 'Lava Geyser', 'Charge', 'Phase 2: Ashstorm'],
    'The forge-master of the Cinderfall. It fell into its own fire and did not climb back out.'),
  b('boss_citadel', 'The Citadel Warden', 26, 3600, 44, 30, 3, 620, 'boss_arena_fortress', [2, 8], 0xb0b0c0,
    [[1082, 1], [1031, 0.7], [1033, 0.4]],
    ['Stalwart Gaze', 'Boulder Toss', 'Shockwave', 'Phase 2: Shield Break', 'Phase 3: Awakened'],
    'A golem built to guard a gate that no longer exists. It does not care.'),
  b('boss_warped', 'Verdega, the Warped Twin', 42, 6200, 62, 40, 3, 1100, 'boss_arena_warped', [5, 8], 0x5aa090,
    [[1083, 1], [1426, 0.6], [1488, 0.4]],
    ['Twin Scythes', 'Summon Vex', 'Warp Step', 'Phase 2: Enraged', 'Phase 3: Unity'],
    'Two evokers raised as one. They disagree about almost everything.'),
  b('boss_verdant', 'Verdant Heart', 58, 9000, 74, 46, 3, 1700, 'boss_arena_verdant', [0, 10], 0x5ae070,
    [[1086, 1], [1080, 0.8], [1083, 0.5]],
    ['Verdant Vines', 'Forest Summon', 'Regrowth', 'Phase 2: Ancient Roots', 'Phase 3: The Whole Forest'],
    'The heart of the oldgrowth. It is not evil. It is simply not yours.'),
  b('boss_eldritch', 'The Eldritch Heart', 66, 11000, 84, 52, 3, 2000, 'boss_arena_eldritch', [1, 11], 0xb04080,
    [[1083, 1], [1074, 0.7], [1063, 0.5]],
    ['Miasma', 'Summon Wraiths', 'Tentacle Slam', 'Phase 2: Awakening', 'Phase 3: The Old One'],
    'Something old enough to have a name, and angry enough to use it.'),
  b('boss_starfall', 'The Starfall Titan', 72, 13000, 92, 56, 4, 2300, 'boss_arena_starfall', [9, 11], 0xfff0a0,
    [[1077, 1], [1078, 0.8], [1076, 0.5]],
    ['Meteor Fall', 'Gravity Well', 'Beam of Starlight', 'Phase 2: Crater', 'Phase 3: Supernova', 'Phase 4: Core'],
    'It fell out of the sky, and it was still hungry when it landed.'),
  b('boss_fortress', 'The Nether Warden', 50, 12500, 78, 44, 3, 1800, 'boss_arena_fortress', [2, 8], 0xe04040,
    [[1083, 1], [1051, 0.6], [1062, 0.5]],
    ['Blaze Barrage', 'Wither Swarm', 'Ghastly Wail', 'Phase 2: Fortress Breach', 'Phase 3: Warden Unbound'],
    'It held the fortress alone for four hundred years. It will not thank you for the relief.'),
  b('boss_arcane', 'The Arcane Twins', 70, 10500, 88, 48, 4, 2100, 'boss_arena_arcane', [5, 11], 0xa080e8,
    [[1083, 1], [1071, 0.7], [1072, 0.6]],
    ['Mirrored Bolt', 'Counterspell', 'Arcane Orbit', 'Phase 2: One Mind', 'Phase 3: Two Minds', 'Phase 4: Unity'],
    'They were one spell once. They have not spoken since the split.'),
  b('boss_end', 'The Ender Dragon', 80, 16000, 102, 60, 3, 2800, 'boss_arena_end', [8, 9], 0x8a6ae8,
    [[1087, 1], [1053, 0.8], [1077, 0.5]],
    ['Ender Breath', 'Dragon Slam', 'Summon Endermen', 'Phase 2: Wounded', 'Phase 3: The Last Sky'],
    "The old sky's last child. It has been waiting for a fight that is worth its time."),
  b('boss_wither', 'The Wither', 78, 14500, 98, 58, 4, 2600, 'boss_arena_wither', [6, 11], 0x4a4a52,
    [[1083, 1], [1035, 0.8], [1062, 0.6]],
    ['Wither Blast', 'Skull Barrage', 'Necrotic Field', 'Phase 2: Skeleton King', 'Phase 3: Skull Lord', 'Phase 4: The Curse'],
    'A king who ran out of people to rule, and found three skulls instead.'),
  b('boss_eternity', 'The Eternity Guardian', 90, 22000, 118, 66, 4, 3400, 'boss_arena_eternity', [6, 10], 0xffe070,
    [[1076, 1], [1086, 0.8], [1087, 0.6]],
    ['Chronal Rift', 'Guardian Slam', 'Shield of Eternity', 'Phase 2: Wounded', 'Phase 3: The Last Stand', 'Phase 4: Eternity Unbound'],
    'The last thing the first king built. It has been waiting for someone to earn it.'),
  b('boss_world', 'The World Heart', 95, 26000, 130, 70, 5, 4000, 'boss_arena_eternity', [11, 11], 0xff3aa0,
    [[1086, 1], [1076, 0.8], [1077, 0.6], [1087, 0.4]],
    ['Heart Pulse', 'World Rupture', 'Summon Tendrils', 'Phase 2: The Wound', 'Phase 3: The Scar', 'Phase 4: The Core', 'Phase 5: Eternity'],
    'The world is not dead. It is hurting. Fix it, or it will hurt forever.'),
];

export const BOSS_BY_ID: Map<string, BossDef> = new Map(BOSSES.map((x) => [x.id, x]));

/** Boss ids by arena feature id, for spawning when a player enters an arena. */
export const BOSS_BY_ARENA: Map<string, BossDef> = new Map(BOSSES.map((x) => [x.arena, x]));

export function bossForArena(arena: string): BossDef | undefined {
  return BOSS_BY_ARENA.get(arena);
}

export function isBossId(id: string): boolean {
  return BOSS_BY_ID.has(id);
}
