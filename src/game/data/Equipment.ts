/**
 * Equipment: gear sets, affixes and upgrade paths.
 *
 * Base tools and weapons live in `Items.ts`; this file is about what makes
 * equipment *build-defining*. A set bonus only fires when enough pieces are
 * worn, an affix is rolled onto a piece when it is forged, and an upgrade path
 * is a named sequence of smithing steps that a player can choose between.
 *
 * The power curve is deliberately shallow per piece and steep per set: a single
 * legendary shoulder is worth maybe 15% of a player's damage, but completing a
 * full four-piece set is a real power spike. That keeps the game rewarding
 * without turning every enemy into a sponge.
 */
import { ITEMS } from './Items';

export type GearSlot = 'weapon' | 'offhand' | 'helmet' | 'chest' | 'legs' | 'boots' | 'accessory';

export const SLOT_ORDER: GearSlot[] = ['weapon', 'offhand', 'helmet', 'chest', 'legs', 'boots', 'accessory'];

export const SLOT_LABEL: Record<GearSlot, string> = {
  weapon: 'Weapon',
  offhand: 'Off-hand',
  helmet: 'Helmet',
  chest: 'Chestplate',
  legs: 'Leggings',
  boots: 'Boots',
  accessory: 'Accessory',
};

export interface AffixDef {
  id: string;
  name: string;
  /** Which stats this affix contributes to. */
  stat: 'flat_damage' | 'percent_damage' | 'flat_hp' | 'percent_hp' | 'flat_armor' | 'percent_armor'
    | 'flat_speed' | 'percent_speed' | 'crit_chance' | 'crit_damage' | 'lifesteal' | 'life_on_kill'
    | 'mana_regen' | 'spell_damage' | 'knockback' | 'reach' | 'durability' | 'rare_find';
  /** Min and max roll at the affix's level. */
  min: number;
  max: number;
  /** How the value scales with the item's level. */
  scaling: number;
  /** Prefix (before the name) or suffix (after). */
  position: 'prefix' | 'suffix';
  /** Minimum item tier this can appear on. */
  minTier: number;
  description: string;
}

export const AFFIXES: AffixDef[] = [
  affix('flat_damage', 'Sharp', 1, 3, 1.0, 'prefix', 1, '+{v} physical damage'),
  affix('flat_damage', 'Keen', 2, 4, 1.1, 'prefix', 2, '+{v} physical damage'),
  affix('flat_damage', 'Executioner', 4, 8, 1.3, 'prefix', 4, '+{v} physical damage'),
  affix('flat_damage', 'Sundering', 7, 14, 1.5, 'prefix', 6, '+{v} physical damage'),
  affix('flat_damage', 'Annihilating', 12, 24, 1.8, 'prefix', 8, '+{v} physical damage'),
  affix('percent_damage', 'Of Might', 5, 12, 1.0, 'suffix', 2, '+{v}% damage'),
  affix('percent_damage', 'Of Fury', 9, 18, 1.2, 'suffix', 4, '+{v}% damage'),
  affix('percent_damage', 'Of Annihilation', 15, 30, 1.5, 'suffix', 7, '+{v}% damage'),
  affix('flat_hp', 'Of Vitality', 8, 20, 1.0, 'suffix', 2, '+{v} max health'),
  affix('flat_hp', 'Of the Bear', 16, 40, 1.3, 'suffix', 4, '+{v} max health'),
  affix('flat_hp', 'Of the Mountain', 30, 70, 1.6, 'suffix', 7, '+{v} max health'),
  affix('percent_hp', 'Of the Leviathan', 3, 8, 1.0, 'suffix', 5, '+{v}% max health'),
  affix('percent_hp', 'Of Eternity', 6, 14, 1.4, 'suffix', 9, '+{v}% max health'),
  affix('flat_armor', 'Plated', 2, 6, 1.0, 'prefix', 1, '+{v} armour'),
  affix('flat_armor', 'Reinforced', 5, 12, 1.2, 'prefix', 3, '+{v} armour'),
  affix('flat_armor', 'Warded', 10, 24, 1.5, 'prefix', 6, '+{v} armour'),
  affix('flat_armor', 'Aegis', 18, 42, 1.8, 'prefix', 8, '+{v} armour'),
  affix('percent_armor', 'Of the Turtle', 4, 10, 1.0, 'suffix', 3, '+{v}% armour'),
  affix('percent_armor', 'Of the Wall', 8, 18, 1.3, 'suffix', 6, '+{v}% armour'),
  affix('flat_speed', 'Swift', 0.1, 0.4, 1.0, 'prefix', 1, '+{v} movement speed'),
  affix('flat_speed', 'Fleet', 0.2, 0.8, 1.2, 'prefix', 3, '+{v} movement speed'),
  affix('flat_speed', 'Sprinter', 0.4, 1.2, 1.5, 'prefix', 6, '+{v} movement speed'),
  affix('percent_speed', 'Of the Wind', 3, 8, 1.0, 'suffix', 3, '+{v}% movement speed'),
  affix('percent_speed', 'Of the Gale', 6, 15, 1.4, 'suffix', 7, '+{v}% movement speed'),
  affix('crit_chance', 'Lucky', 2, 6, 1.0, 'prefix', 2, '+{v}% critical chance'),
  affix('crit_chance', 'Lucid', 5, 12, 1.2, 'prefix', 4, '+{v}% critical chance'),
  affix('crit_chance', 'Fated', 9, 20, 1.5, 'prefix', 7, '+{v}% critical chance'),
  affix('crit_damage', 'Of the Sniper', 10, 30, 1.0, 'suffix', 3, '+{v}% critical damage'),
  affix('crit_damage', 'Of the Assassin', 20, 50, 1.3, 'suffix', 6, '+{v}% critical damage'),
  affix('crit_damage', 'Of the Executioner', 35, 80, 1.6, 'suffix', 9, '+{v}% critical damage'),
  affix('lifesteal', 'Vampiric', 0.5, 2.0, 1.0, 'suffix', 4, '+{v}% lifesteal'),
  affix('lifesteal', 'Of the Leech', 1.5, 4.0, 1.3, 'suffix', 7, '+{v}% lifesteal'),
  affix('life_on_kill', 'Of the Harvest', 1, 4, 1.0, 'suffix', 4, '+{v} health per kill'),
  affix('life_on_kill', 'Of the Reaper', 3, 10, 1.4, 'suffix', 8, '+{v} health per kill'),
  affix('mana_regen', 'Of the Mage', 1, 4, 1.0, 'suffix', 3, '+{v} mana regen'),
  affix('mana_regen', 'Of the Archmage', 3, 9, 1.4, 'suffix', 7, '+{v} mana regen'),
  affix('spell_damage', 'Arcane', 3, 9, 1.0, 'prefix', 3, '+{v}% spell damage'),
  affix('spell_damage', 'Eldritch', 7, 18, 1.3, 'prefix', 6, '+{v}% spell damage'),
  affix('spell_damage', 'Void', 12, 30, 1.6, 'prefix', 9, '+{v}% spell damage'),
  affix('knockback', 'Of the Sledge', 5, 15, 1.0, 'suffix', 4, '+{v}% knockback'),
  affix('reach', 'Of the Spear', 0.5, 1.5, 1.0, 'suffix', 5, '+{v} blocks reach'),
  affix('durability', 'Of the Smith', 10, 30, 1.0, 'suffix', 4, '+{v}% durability'),
  affix('rare_find', 'Of the Treasurer', 5, 15, 1.0, 'suffix', 5, '+{v}% rare drop chance'),
];

function affix(
  stat: AffixDef['stat'], name: string, min: number, max: number, scaling: number,
  position: 'prefix' | 'suffix', minTier: number, description: string
): AffixDef {
  return { id: `${stat}_${name}`, name, stat, min, max, scaling, position, minTier, description };
}

export const AFFIX_BY_ID: Map<string, AffixDef> = new Map(AFFIXES.map((a) => [a.id, a]));

/** Roll an affix value for an item of the given level. */
export function rollAffix(def: AffixDef, itemLevel: number, rng: () => number): number {
  const span = def.max - def.min;
  const base = def.min + span * rng();
  return base * (1 + def.scaling * (itemLevel - 1) * 0.06);
}

/** Number of affixes an item of this tier carries. */
export function affixCount(tier: number): number {
  if (tier <= 1) return 0;
  if (tier <= 3) return 1;
  if (tier <= 5) return 2;
  if (tier <= 7) return 3;
  return 4;
}

export interface GearSetDef {
  id: string;
  name: string;
  /** Item ids that count toward the set. */
  pieces: number[];
  /** Bonuses keyed by how many pieces are equipped. */
  bonuses: Record<number, GearBonus>;
  color: number;
  description: string;
}

export interface GearBonus {
  name: string;
  description: string;
  /** Applied through the stat system. */
  stats: Partial<Record<GearStat, number>>;
}

export type GearStat =
  | 'flat_damage' | 'percent_damage' | 'flat_hp' | 'percent_hp'
  | 'flat_armor' | 'percent_armor' | 'flat_speed' | 'percent_speed'
  | 'crit_chance' | 'crit_damage' | 'lifesteal' | 'life_on_kill'
  | 'mana_regen' | 'spell_damage' | 'knockback' | 'reach' | 'durability' | 'rare_find'
  | 'life_on_hit' | 'dodge' | 'attack_speed';

export const GEAR_SETS: GearSetDef[] = [
  set('set_ember', 'Emberborn Warrior', [2001, 2002, 2003, 2004, 2005], 0xff7028,
    'Forged in the Cinderfall forges.',
    {
      2: { name: 'Emberheart', description: '+15% damage', stats: { percent_damage: 0.15 } },
      4: { name: 'Ember Resilience', description: '+20% max health, +10% armour', stats: { percent_hp: 0.2, percent_armor: 0.1 } },
      5: { name: 'Emberborn', description: '+25% damage, +15% lifesteal, fire aura', stats: { percent_damage: 0.25, lifesteal: 0.15 } },
    }),
  set('set_void', 'Voidwalker', [3001, 3002, 3003, 3004, 3005], 0x7050c0,
    'Worn by those who walk between the stars.',
    {
      2: { name: 'Void Step', description: '+12% movement speed, +10% dodge', stats: { percent_speed: 0.12, dodge: 0.1 } },
      4: { name: 'Void Shroud', description: '+20% armour, +8% lifesteal', stats: { percent_armor: 0.2, lifesteal: 0.08 } },
      5: { name: 'Voidwalker', description: '+30% spell damage, +15% crit chance', stats: { spell_damage: 0.3, crit_chance: 0.15 } },
    }),
  set('set_verdant', 'Verdant Warden', [4001, 4002, 4003, 4004, 4005], 0x5ae070,
    'Grown, not built.',
    {
      2: { name: 'Rooted', description: '+25% max health', stats: { percent_hp: 0.25 } },
      4: { name: 'Thorned', description: '+15% armour, +2 life on hit', stats: { percent_armor: 0.15, life_on_hit: 2 } },
      5: { name: 'Verdant Warden', description: '+20% damage, +3 life on kill, regen', stats: { percent_damage: 0.2, life_on_kill: 3 } },
    }),
  set('set_arcane', 'Arcane Scholar', [5001, 5002, 5003, 5004, 5005], 0xa080e8,
    'The price of knowledge is never paid by the wise.',
    {
      2: { name: 'Studied', description: '+20% spell damage, +10% mana regen', stats: { spell_damage: 0.2, mana_regen: 0.1 } },
      4: { name: 'Enchanted', description: '+15% crit damage, +10% spell damage', stats: { crit_damage: 0.15, spell_damage: 0.1 } },
      5: { name: 'Arcane Scholar', description: '+35% spell damage, +20% mana regen, +15% crit chance', stats: { spell_damage: 0.35, mana_regen: 0.2, crit_chance: 0.15 } },
    }),
  set('set_eldritch', 'Eldritch Heretic', [6001, 6002, 6003, 6004, 6005], 0xb04080,
    'The old gods remember.',
    {
      2: { name: 'Unholy', description: '+15% damage, +1 life on kill', stats: { percent_damage: 0.15, life_on_kill: 1 } },
      4: { name: 'Cursed', description: '+20% max health, +10% lifesteal', stats: { percent_hp: 0.2, lifesteal: 0.1 } },
      5: { name: 'Eldritch Heretic', description: '+40% damage, +25% crit damage, +5% lifesteal', stats: { percent_damage: 0.4, crit_damage: 0.25, lifesteal: 0.05 } },
    }),
  set('set_eternity', 'Eternity Guardian', [7001, 7002, 7003, 7004, 7005, 7006], 0xffe070,
    'The armour of the last king.',
    {
      2: { name: 'Eternal', description: '+25% max health, +15% armour', stats: { percent_hp: 0.25, percent_armor: 0.15 } },
      4: { name: 'Immortal', description: '+20% damage, +10% lifesteal', stats: { percent_damage: 0.2, lifesteal: 0.1 } },
      6: { name: 'Eternity Guardian', description: '+50% damage, +30% max health, +20% armour, +15% crit chance', stats: { percent_damage: 0.5, percent_hp: 0.3, percent_armor: 0.2, crit_chance: 0.15 } },
    }),
];

function set(
  id: string, name: string, pieces: number[], color: number,
  description: string, bonuses: Record<number, GearBonus>
): GearSetDef {
  return { id, name, pieces, bonuses, color, description };
}

export const GEAR_SET_BY_ID: Map<string, GearSetDef> = new Map(GEAR_SETS.map((s) => [s.id, s]));

/** Which sets a given item id belongs to. */
export function setsForItem(itemId: number): GearSetDef[] {
  return GEAR_SETS.filter((s) => s.pieces.includes(itemId));
}

/** Named smithing upgrade paths. */
export interface UpgradePath {
  id: string;
  name: string;
  /** The item id this path upgrades. */
  from: number;
  /** The item id produced. */
  to: number;
  /** Required materials. */
  cost: number[];
  /** What it grants. */
  grants: Partial<Record<GearStat, number>>;
  description: string;
  /** Minimum player level. */
  level: number;
}

export const UPGRADE_PATHS: UpgradePath[] = [
  upgrade('up_iron_sword', 'Iron to Diamond', 1024, 1026, [1033, 1033, 1033], { percent_damage: 0.08 }, 'A sharper edge.', 12),
  upgrade('up_diamond_sword', 'Diamond to Netherite', 1026, 1027, [1049, 1049, 1049], { percent_damage: 0.12, knockback: 0.2 }, 'Forged in soul fire.', 30),
  upgrade('up_iron_armor', 'Iron to Diamond Armour', 2111, 2131, [1033, 1033, 1033, 1033], { percent_armor: 0.15 }, 'Lighter and stronger.', 14),
  upgrade('up_diamond_armor', 'Diamond to Netherite Armour', 2131, 2141, [1049, 1049, 1049, 1049], { percent_armor: 0.2, percent_hp: 0.1 }, 'Soul-forged plate.', 32),
  upgrade('up_bow', 'Diamond Bow', 1410, 1411, [1033, 1033, 1006], { percent_damage: 0.1, reach: 2 }, 'A longer string.', 20),
  upgrade('up_crossbow', 'Tipped Crossbow', 1411, 1412, [1302, 1033], { percent_damage: 0.15 }, 'Poisoned bolts.', 26),
  upgrade('up_trident', 'Riptide Trident', 1413, 2200, [1034, 1034, 1034], { knockback: 0.4, percent_damage: 0.1 }, 'The sea answers.', 40),
  upgrade('up_pickaxe', 'Diamond Pickaxe', 1003, 1008, [1033, 1033, 1033], { percent_damage: 0.1 }, 'Strike true.', 12),
  upgrade('up_shovel', 'Diamond Shovel', 1017, 1018, [1033, 1033], { percent_damage: 0.1 }, 'Move the earth.', 12),
  upgrade('up_hoe', 'Diamond Hoe', 1020, 1021, [1033, 1033], { percent_damage: 0.1 }, 'Till the soil.', 12),
  upgrade('up_axe', 'Diamond Axe', 1012, 1013, [1033, 1033, 1033], { percent_damage: 0.12 }, 'Cleave the wood.', 14),
  upgrade('up_fishing', 'Angleer\'s Rod', 1409, 1409, [1034, 1031], { reach: 3 }, 'Patience, measured.', 10),
];

function upgrade(
  id: string, name: string, from: number, to: number, cost: number[],
  grants: Partial<Record<GearStat, number>>, description: string, level: number
): UpgradePath {
  return { id, name, from, to, cost, grants, description, level };
}

export const UPGRADE_BY_ID: Map<string, UpgradePath> = new Map(UPGRADE_PATHS.map((u) => [u.id, u]));

/**
 * Legendary items: single named pieces with a unique effect. These are the
 * rewards for beating a boss or completing a hard quest chain.
 */
export interface LegendaryDef {
  id: number;
  name: string;
  slot: GearSlot;
  tier: number;
  /** Base stats, as if the item had these affixes. */
  stats: Partial<Record<GearStat, number>>;
  /** Unique passive. */
  unique: string;
  description: string;
  /** Where it can be found. */
  source: string;
  color: number;
}

export const LEGENDARIES: LegendaryDef[] = [
  legend(8001, 'Blade of the First Light', 'weapon', 9, { flat_damage: 14, percent_damage: 0.25, crit_chance: 0.1 }, 'Crit damage also heals for 20% of the damage dealt.', 'Drops from the Eternity Guardian.', 0xffe070),
  legend(8002, 'Heart of the World', 'chest', 9, { flat_hp: 120, percent_hp: 0.3, percent_armor: 0.2 }, 'Taking damage below 30% health grants 5 seconds of damage immunity once per minute.', 'The Eternity Vault.', 0xff5ac0),
  legend(8003, 'Voidwalker\'s Cloak', 'chest', 8, { percent_speed: 0.2, dodge: 0.15, percent_armor: 0.1 }, 'Dodge also cancels the next attack\'s damage.', 'The Void Expanse.', 0x7050c0),
  legend(8004, 'Crown of the Fallen King', 'helmet', 9, { percent_damage: 0.2, crit_chance: 0.1, percent_hp: 0.15 }, 'Killing an enemy extends all buff durations by 2 seconds, up to 10 stacks.', 'The Eternity Crown.', 0xffd060),
  legend(8005, 'Emberheart Flamebringer', 'weapon', 8, { flat_damage: 10, percent_damage: 0.2, lifesteal: 0.1 }, 'Attacking applies a stacking burn.', 'Cinderfall Peaks.', 0xff7028),
  legend(8006, 'Aegis of the Deep', 'chest', 7, { percent_armor: 0.35, flat_hp: 90 }, 'Reflects 15% of melee damage taken.', 'The Abyss.', 0x40a0d0),
  legend(8007, 'Spear of the Starfall', 'weapon', 9, { flat_damage: 12, reach: 6, crit_damage: 0.4 }, 'Hits pierce and hit an additional target behind.', 'Starfall Crater.', 0xfff0a0),
  legend(8008, 'Rootwarden\'s Roots', 'legs', 7, { percent_hp: 0.25, percent_armor: 0.15, life_on_hit: 3 }, 'Regenerates 2 health per second in any biome.', 'Verdant Sanctum.', 0x5ae070),
  legend(8009, 'The Eternal Crown', 'helmet', 10, { percent_damage: 0.35, crit_chance: 0.2, percent_hp: 0.25, spell_damage: 0.2 }, 'Death is a setback, not an end: respawn with full health and mana.', 'The World Heart.', 0xffe070),
  legend(8010, 'Soulrender', 'weapon', 9, { flat_damage: 16, lifesteal: 0.25, percent_damage: 0.2 }, 'Each kill grants +2% damage for 30 seconds, stacking to 20.', 'The Hollow Depths.', 0xe04060),
  legend(8011, 'Arcane Quill of Truths', 'accessory', 8, { spell_damage: 0.3, mana_regen: 0.25, crit_chance: 0.1 }, 'Spells crit on a 1-in-4 chance regardless of crit chance.', 'Arcane Reach.', 0xa080e8),
  legend(8012, 'Boots of the Gale', 'boots', 7, { percent_speed: 0.3, flat_speed: 0.6, dodge: 0.1 }, 'Sprinting grants 20% damage reduction.', 'Windswept Steppe.', 0x80c0ff),
  legend(8013, 'Mark of the Heretic', 'accessory', 9, { percent_damage: 0.2, crit_damage: 0.4, life_on_kill: 5 }, 'Killing an elite enemy grants a 10-second damage buff.', 'Eldritch Rift.', 0xb04080),
  legend(8014, 'World Core Shard', 'accessory', 10, { percent_hp: 0.4, percent_damage: 0.3, spell_damage: 0.3 }, 'All resistances +20%.', 'The Eternity Core.', 0xff5ac0),
];

function legend(
  id: number, name: string, slot: GearSlot, tier: number,
  stats: Partial<Record<GearStat, number>>, unique: string, source: string, color: number
): LegendaryDef {
  return { id, name, slot, tier, stats, unique, source, color, description: unique };
}

export const LEGENDARY_BY_ID: Map<number, LegendaryDef> = new Map(LEGENDARIES.map((l) => [l.id, l]));

/** Named equipment pieces that count toward gear sets (generated per tier). */
export const GENERATED_GEAR: { id: number; name: string; slot: GearSlot; tier: number; color: number; setId?: string }[] = [
  { id: 2001, name: 'Emberborn Helm', slot: 'helmet', tier: 4, color: 0xff7028, setId: 'set_ember' },
  { id: 2002, name: 'Emberborn Chestplate', slot: 'chest', tier: 4, color: 0xff7028, setId: 'set_ember' },
  { id: 2003, name: 'Emberborn Leggings', slot: 'legs', tier: 4, color: 0xff7028, setId: 'set_ember' },
  { id: 2004, name: 'Emberborn Boots', slot: 'boots', tier: 4, color: 0xff7028, setId: 'set_ember' },
  { id: 2005, name: 'Emberborn Warhammer', slot: 'weapon', tier: 5, color: 0xff7028, setId: 'set_ember' },
  { id: 3001, name: 'Voidwalker Helm', slot: 'helmet', tier: 6, color: 0x7050c0, setId: 'set_void' },
  { id: 3002, name: 'Voidwalker Robe', slot: 'chest', tier: 6, color: 0x7050c0, setId: 'set_void' },
  { id: 3003, name: 'Voidwalker Leggings', slot: 'legs', tier: 6, color: 0x7050c0, setId: 'set_void' },
  { id: 3004, name: 'Voidwalker Boots', slot: 'boots', tier: 6, color: 0x7050c0, setId: 'set_void' },
  { id: 3005, name: 'Void Scythe', slot: 'weapon', tier: 7, color: 0x7050c0, setId: 'set_void' },
  { id: 4001, name: 'Verdant Crown', slot: 'helmet', tier: 7, color: 0x5ae070, setId: 'set_verdant' },
  { id: 4002, name: 'Verdant Breastplate', slot: 'chest', tier: 7, color: 0x5ae070, setId: 'set_verdant' },
  { id: 4003, name: 'Verdant Leggings', slot: 'legs', tier: 7, color: 0x5ae070, setId: 'set_verdant' },
  { id: 4004, name: 'Verdant Boots', slot: 'boots', tier: 7, color: 0x5ae070, setId: 'set_verdant' },
  { id: 4005, name: 'Verdant Blade', slot: 'weapon', tier: 8, color: 0x5ae070, setId: 'set_verdant' },
  { id: 5001, name: 'Scholar\'s Crown', slot: 'helmet', tier: 7, color: 0xa080e8, setId: 'set_arcane' },
  { id: 5002, name: 'Scholar\'s Robe', slot: 'chest', tier: 7, color: 0xa080e8, setId: 'set_arcane' },
  { id: 5003, name: 'Scholar\'s Leggings', slot: 'legs', tier: 7, color: 0xa080e8, setId: 'set_arcane' },
  { id: 5004, name: 'Scholar\'s Boots', slot: 'boots', tier: 7, color: 0xa080e8, setId: 'set_arcane' },
  { id: 5005, name: 'Scholar\'s Staff', slot: 'weapon', tier: 8, color: 0xa080e8, setId: 'set_arcane' },
  { id: 6001, name: 'Heretic\'s Mask', slot: 'helmet', tier: 8, color: 0xb04080, setId: 'set_eldritch' },
  { id: 6002, name: 'Heretic\'s Robe', slot: 'chest', tier: 8, color: 0xb04080, setId: 'set_eldritch' },
  { id: 6003, name: 'Heretic\'s Leggings', slot: 'legs', tier: 8, color: 0xb04080, setId: 'set_eldritch' },
  { id: 6004, name: 'Heretic\'s Boots', slot: 'boots', tier: 8, color: 0xb04080, setId: 'set_eldritch' },
  { id: 6005, name: 'Heretic\'s Blade', slot: 'weapon', tier: 9, color: 0xb04080, setId: 'set_eldritch' },
  { id: 7001, name: 'Guardian Helm', slot: 'helmet', tier: 9, color: 0xffe070, setId: 'set_eternity' },
  { id: 7002, name: 'Guardian Plate', slot: 'chest', tier: 9, color: 0xffe070, setId: 'set_eternity' },
  { id: 7003, name: 'Guardian Leggings', slot: 'legs', tier: 9, color: 0xffe070, setId: 'set_eternity' },
  { id: 7004, name: 'Guardian Boots', slot: 'boots', tier: 9, color: 0xffe070, setId: 'set_eternity' },
  { id: 7005, name: 'Guardian Blade', slot: 'weapon', tier: 10, color: 0xffe070, setId: 'set_eternity' },
  { id: 7006, name: 'Guardian Aegis', slot: 'offhand', tier: 10, color: 0xffe070, setId: 'set_eternity' },
];

/** Look up any equipment definition by id, generated gear or legendary included. */
/**
 * Which slot a base item belongs to.
 *
 * Derived from the item's name because that is the one place the slot is
 * recorded for the hundreds of hand-written tools, weapons and armour in
 * `Items.ts`: adding a `slot` field to every entry would be a large,
 * error-prone edit, and the names are already consistent ("Iron Chestplate",
 * "Diamond Boots", "Wooden Sword").
 *
 * Order matters — the first word that matches wins, so the compound words are
 * listed before the short ones that could appear inside them.
 */
const SLOT_WORDS: [string, GearSlot][] = [
  ['chestplate', 'chest'], ['breastplate', 'chest'],
  ['helmet', 'helmet'], ['leggings', 'legs'], ['boots', 'boots'],
  ['shield', 'offhand'],
  ['pickaxe', 'weapon'], ['warhammer', 'weapon'], ['scythe', 'weapon'],
  ['crossbow', 'weapon'], ['sword', 'weapon'], ['tome', 'weapon'],
  ['trident', 'weapon'], ['staff', 'weapon'], ['wand', 'weapon'],
  ['axe', 'weapon'], ['bow', 'weapon'], ['hoe', 'weapon'], ['shovel', 'weapon'],
];

/** The gear slot a base item occupies, or null when it is not equipment. */
export function gearSlotFor(id: number): GearSlot | null {
  const item = ITEMS[id];
  if (!item) return null;
  const name = item.name.toLowerCase();
  for (const [word, slot] of SLOT_WORDS) {
    if (name.includes(word)) return slot;
  }
  // Fall back to the kind so an item named in an unfamiliar way is still
  // wearable rather than silently locked out of the equipment system.
  if (item.kind === 'weapon' || item.kind === 'tool') return 'weapon';
  if (item.kind === 'armor') return 'chest';
  return null;
}

export function gearDef(id: number): {
  name: string; slot: GearSlot; tier: number; color: number; setId?: string; stats: Partial<Record<GearStat, number>>;
  unique?: string; description?: string; source?: string;
} | null {
  const leg = LEGENDARY_BY_ID.get(id);
  if (leg) {
    return {
      name: leg.name, slot: leg.slot, tier: leg.tier, color: leg.color,
      stats: leg.stats, unique: leg.unique, description: leg.description, source: leg.source,
    };
  }
  const gen = GENERATED_GEAR.find((g) => g.id === id);
  if (gen) {
    return {
      name: gen.name, slot: gen.slot, tier: gen.tier, color: gen.color,
      setId: gen.setId, stats: {},
    };
  }
  // Base items. The slot is derived above; the numbers are deliberately left
  // out of `stats` because `computeStats` already applies an item's damage,
  // armour and knockback straight from `Items.ts`, and repeating them here
  // would double-count every sword and chestplate the player owns.
  const item = ITEMS[id];
  if (!item) return null;
  const slot = gearSlotFor(id);
  if (!slot) return null;
  return {
    name: item.name, slot,
    tier: item.tier ?? 0,
    color: item.color ?? 0xcccccc,
    stats: {},
    description: item.description,
  };
}
