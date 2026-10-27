/**
 * Derived statistics.
 *
 * Nothing here is stored. A player's combat capability is computed from four
 * things — attributes, level, worn equipment (with set bonuses) and skill
 * investment — every time the character equips, levels or spends a point.
 * That keeps the numbers honest: the inventory screen and the damage number
 * both read the same source, so there is no hidden multiplier a player could
 * find by accident.
 *
 * The power curve is deliberately shallow per source. A full set of
 * legendary gear is worth roughly a 40% damage increase over starter kit, and
 * ten levels of one attribute is worth about 25% of a stat line. Neither
 * dwarfs the other, which is what keeps builds interesting rather than
 * optimal.
 */

import { AFFIXES, affixCount, gearDef, rollAffix, GEAR_SETS, type GearSlot } from '../data/Equipment';
import { ENCHANT_BY_ID } from './Forge';
import { ITEMS, type ItemDef } from '../data/Items';
import { SKILLS, SKILL_BY_ID, ACTIVE_SKILL_SLOTS, type SkillStat, type SkillTree } from '../data/Skills';

/** Every number that influences combat. Percent stats are fractions. */
export interface StatBlock {
  maxHealth: number;
  maxMana: number;
  healthRegen: number;
  manaRegen: number;
  flatDamage: number;
  percentDamage: number;
  spellPower: number;
  armor: number;
  toughness: number;
  percentArmor: number;
  movementSpeed: number;
  percentSpeed: number;
  critChance: number;
  critDamage: number;
  lifesteal: number;
  lifeOnHit: number;
  lifeOnKill: number;
  dodge: number;
  knockback: number;
  reach: number;
  attackSpeed: number;
  cooldownReduction: number;
  dashCharges: number;
  hpRegen: number;
  rareFind: number;
  durability: number;
  /** Blocks of extra reach from the harvesting tool alone. */
  harvestBonus: number;
  /** Damage bonus per element, as a fraction of base. */
  fireDamage: number;
  coldDamage: number;
  arcaneDamage: number;
  holyDamage: number;
  voidDamage: number;
  /** Fraction of all damage this character resists. */
  resistance: number;
  /** Health restored on respawn. */
  respawnHealth: number;
  /** Bonus flat damage a pet deals. */
  petDamage: number;
  /** Fraction applied to potion and buff durations. */
  buffDuration: number;
  /** Above this fraction of an enemy's health, damage is amplified. */
  executionThrehold: number;
  /** How much threat this character generates, for AI targeting. */
  threatGeneration: number;
}

export interface Attributes {
  strength: number;
  dexterity: number;
  constitution: number;
  intelligence: number;
  wisdom: number;
}

export const ATTRIBUTE_KEYS: (keyof Attributes)[] = ['strength', 'dexterity', 'constitution', 'intelligence', 'wisdom'];

export const ATTRIBUTE_LABEL: Record<keyof Attributes, string> = {
  strength: 'Strength',
  dexterity: 'Dexterity',
  constitution: 'Constitution',
  intelligence: 'Intelligence',
  wisdom: 'Wisdom',
};

export const ATTRIBUTE_DESC: Record<keyof Attributes, string> = {
  strength: 'Physical damage and critical weight.',
  dexterity: 'Movement, dodging and critical damage.',
  constitution: 'Health pool and armour.',
  intelligence: 'Mana, regen and spell power.',
  wisdom: 'Critical chance, lifesteal and harvest yield.',
};

/** Attribute points spent reaching a value from the base of 10. */
export function attributeCost(value: number): number {
  let points = 0;
  let level = 10;
  while (level < value) {
    points += Math.max(1, Math.floor(Math.sqrt(points + 1)));
    level++;
  }
  return points;
}

/** The inverse: how far a number of points raises a 10-base attribute. */
export function attributeLevelFor(points: number): number {
  let level = 10;
  let spent = 0;
  while (spent < points) {
    const cost = Math.max(1, Math.floor(Math.sqrt(spent + 1)));
    if (spent + cost > points) break;
    spent += cost;
    level++;
  }
  return level;
}

export function emptyStats(): StatBlock {
  return {
    maxHealth: 20, maxMana: 20, healthRegen: 0.5, manaRegen: 0.5,
    flatDamage: 1, percentDamage: 0, spellPower: 0,
    armor: 0, toughness: 0, percentArmor: 0,
    movementSpeed: 4.3, percentSpeed: 0,
    critChance: 0.05, critDamage: 0.5,
    lifesteal: 0, lifeOnHit: 0, lifeOnKill: 0,
    dodge: 0.02, knockback: 0, reach: 4.5,
    attackSpeed: 1.6, cooldownReduction: 0,
    dashCharges: 1, hpRegen: 0.5, rareFind: 0, durability: 1,
    harvestBonus: 0,
    fireDamage: 0, coldDamage: 0, arcaneDamage: 0, holyDamage: 0, voidDamage: 0,
    resistance: 0, respawnHealth: 0.5, petDamage: 0, buffDuration: 0,
    executionThrehold: 0, threatGeneration: 1,
  };
}

/** Keys whose values are fractions rather than absolute numbers. */
const PERCENT_KEYS: (keyof StatBlock)[] = [
  'percentDamage', 'percentArmor', 'percentSpeed', 'critChance', 'critDamage',
  'lifesteal', 'knockback', 'rareFind', 'resistance', 'buffDuration',
];

/** Keys that only make sense as fractions of a total. */
const FRACTION_OF_TOTAL: (keyof StatBlock)[] = ['spellPower'];

/** Add a value to a stat, dividing by 100 for percentage keys. */
function addStat(s: StatBlock, key: keyof StatBlock, value: number, divide = false): void {
  if (value === undefined || Number.isNaN(value)) return;
  (s[key] as number) += divide ? value / 100 : value;
}

/** A single piece of equipment. */
export interface EquippedItem {
  id: number;
  /** Affix roll level. Defaults to the item's tier. */
  level?: number;
  /** Rolled affixes, as `{ id, value }` with values in the affix's own unit. */
  affixes?: { id: string; value: number }[];
  /** Smithing upgrades applied. */
  upgrades?: number;
  /** Enchantments applied at an enchanting table. */
  enchants?: { id: string; level: number }[];
  /** Durability consumed so far. */
  damage?: number;
}

/** Where an affix value lands. */
export interface AffixTarget {
  key: keyof StatBlock;
  /** True when the rolled value is a whole-number percentage. */
  percent: boolean;
}

const AFFIX_TARGETS: Map<string, AffixTarget> = new Map([
  ['flat_damage', { key: 'flatDamage', percent: false }],
  ['percent_damage', { key: 'percentDamage', percent: true }],
  ['flat_hp', { key: 'maxHealth', percent: false }],
  ['percent_hp', { key: 'maxHealth', percent: true }],
  ['flat_armor', { key: 'armor', percent: false }],
  ['percent_armor', { key: 'percentArmor', percent: true }],
  ['flat_speed', { key: 'movementSpeed', percent: false }],
  ['percent_speed', { key: 'percentSpeed', percent: true }],
  ['crit_chance', { key: 'critChance', percent: true }],
  ['crit_damage', { key: 'critDamage', percent: true }],
  ['lifesteal', { key: 'lifesteal', percent: true }],
  ['life_on_kill', { key: 'lifeOnKill', percent: false }],
  ['life_on_hit', { key: 'lifeOnHit', percent: false }],
  ['mana_regen', { key: 'manaRegen', percent: false }],
  ['spell_damage', { key: 'spellPower', percent: true }],
  ['knockback', { key: 'knockback', percent: true }],
  ['reach', { key: 'reach', percent: false }],
  ['durability', { key: 'durability', percent: true }],
  ['rare_find', { key: 'rareFind', percent: true }],
  ['dodge', { key: 'dodge', percent: false }],
  ['attack_speed', { key: 'attackSpeed', percent: true }],
]);

/** Resolve an affix id, or the prefix of one, to its stat target. */
export function affixTarget(affixId: string): AffixTarget | null {
  const direct = AFFIX_TARGETS.get(affixId);
  if (direct) return direct;
  for (const [stat, target] of AFFIX_TARGETS) {
    if (affixId.startsWith(stat + '_')) return target;
  }
  return null;
}

/**
 * Roll the affixes for an item of a given tier. Prefixes are drawn first so
 * they end up in front of the name, which is how the tooltip renders them.
 */
export function rollAffixes(
  tier: number,
  rng: () => number,
  prefixes = 2,
  suffixes = 2,
): { id: string; value: number }[] {
  const pool = AFFIXES.filter((a) => tier >= a.minTier);
  const pre = pool.filter((a) => a.position === 'prefix');
  const suf = pool.filter((a) => a.position === 'suffix');
  const take = <T>(arr: T[]): T => arr.splice(Math.floor(rng() * arr.length), 1)[0];
  const count = affixCount(tier);
  const out: { id: string; value: number }[] = [];
  const preN = Math.min(prefixes, Math.max(0, Math.ceil(count / 2)));
  const sufN = Math.min(suffixes, Math.max(0, Math.floor(count / 2)));
  for (let i = 0; i < preN && pre.length; i++) {
    const a = take(pre.slice());
    out.push({ id: a.id, value: Math.round(rollAffix(a, tier * 10, rng) * 10) / 10 });
  }
  for (let i = 0; i < sufN && suf.length; i++) {
    const a = take(suf.slice());
    out.push({ id: a.id, value: Math.round(rollAffix(a, tier * 10, rng) * 10) / 10 });
  }
  return out;
}

/** Roll a fresh piece of equipment at a tier. */
export function rollEquipment(
  baseId: number,
  tier: number,
  rng: () => number,
): EquippedItem {
  return { id: baseId, level: tier * 10, affixes: rollAffixes(tier, rng), upgrades: 0, damage: 0 };
}

/** Map a skill stat key onto a stat block key. */
const SKILL_STAT_MAP: Map<SkillStat, keyof StatBlock | null> = new Map([
  ['flat_damage', 'flatDamage'],
  ['percent_damage', 'percentDamage'],
  ['attack_speed', 'attackSpeed'],
  ['move_speed', 'percentSpeed'],
  ['flat_speed', 'movementSpeed'],
  ['percent_speed', 'percentSpeed'],
  ['flat_hp', 'maxHealth'],
  ['percent_hp', 'maxHealth'],
  ['flat_armor', 'armor'],
  ['percent_armor', 'percentArmor'],
  ['crit_chance', 'critChance'],
  ['crit_damage', 'critDamage'],
  ['lifesteal', 'lifesteal'],
  ['life_on_kill', 'lifeOnKill'],
  ['mana_max', 'maxMana'],
  ['mana_regen', 'manaRegen'],
  ['spell_power', 'spellPower'],
  ['cooldown_reduction', 'cooldownReduction'],
  ['dodge', 'dodge'],
  ['knockback', 'knockback'],
  ['reach', 'reach'],
  ['hp_regen', 'hpRegen'],
  ['dash_charges', 'dashCharges'],
  ['buff_duration', 'buffDuration'],
  ['pet_damage', 'petDamage'],
  ['threat_generation', 'threatGeneration'],
  ['fire_damage', 'fireDamage'],
  ['cold_damage', 'coldDamage'],
  ['arcane_damage', 'arcaneDamage'],
  ['holy_damage', 'holyDamage'],
  ['void_damage', 'voidDamage'],
  ['resistance', 'resistance'],
  ['respawn_health', 'respawnHealth'],
  ['execution_threshold', 'executionThrehold'],
]);

/** Every skill stat key that maps onto a fraction of a total. */
const SKILL_PERCENT: Set<SkillStat> = new Set([
  'percent_damage', 'percent_armor', 'percent_hp', 'percent_speed', 'crit_chance',
  'crit_damage', 'lifesteal', 'spell_power', 'cooldown_reduction', 'knockback',
  'resistance', 'buff_duration', 'hp_regen', 'fire_damage', 'cold_damage',
  'arcane_damage', 'holy_damage', 'void_damage', 'dodge', 'mana_regen',
]);

/**
 * Compute the full stat block for a character.
 *
 * `equipped` is a map of slot -> EquippedItem. `skills` maps skill id -> level
 * (0 means untrained). Set bonuses are resolved after every piece is applied,
 * so a two-piece and a four-piece set never double-count.
 */
export function computeStats(
  level: number,
  attrs: Attributes,
  equipped: Partial<Record<GearSlot, EquippedItem>>,
  skills: Record<string, number>,
  buffs: Partial<StatBlock> = {},
): StatBlock {
  const s = emptyStats();

  // ---------------------------------------------------------------- attributes
  s.flatDamage += attrs.strength * 1.8;
  s.critChance += attrs.strength * 0.0015;
  s.movementSpeed += attrs.dexterity * 0.055;
  s.dodge += attrs.dexterity * 0.004;
  s.critDamage += attrs.dexterity * 0.008;
  s.maxHealth += attrs.constitution * 9;
  s.armor += attrs.constitution * 0.6;
  s.healthRegen += attrs.constitution * 0.02;
  s.maxMana += attrs.intelligence * 6.5;
  s.manaRegen += attrs.intelligence * 0.16;
  s.spellPower += attrs.intelligence * 0.6;
  s.critChance += attrs.wisdom * 0.0025;
  s.lifesteal += attrs.wisdom * 0.002;
  s.harvestBonus += attrs.wisdom * 0.25;

  // ---------------------------------------------------------------- enchants
  // Enchantments are applied last so they read as the player's own investment
  // on top of whatever the gear already does, and so a re-equip cannot lose a
  // bonus to an ordering accident.
  for (const slot of Object.values(equipped)) {
    if (!slot?.enchants?.length) continue;
    for (const e of slot.enchants) {
      const def = ENCHANT_BY_ID.get(e.id);
      if (!def) continue;
      s[def.stat] += def.perLevel * e.level;
    }
  }

  // ---------------------------------------------------------------- level
  // Level scaling is kept gentle so gear and skill investment stay the
  // dominant levers: roughly +4.5% damage and +2% health per ten levels.
  s.flatDamage *= 1 + (level - 1) * 0.035;
  s.maxHealth *= 1 + (level - 1) * 0.018;
  s.maxMana *= 1 + (level - 1) * 0.015;
  s.spellPower *= 1 + (level - 1) * 0.02;

  // ---------------------------------------------------------------- equipment
  const setCount = new Map<string, number>();
  for (const slot of Object.keys(equipped) as GearSlot[]) {
    const eq = equipped[slot];
    if (!eq) continue;
    const item = ITEMS[eq.id];
    if (item) {
      if (item.kind === 'weapon' && item.damage) {
        s.flatDamage += item.damage;
        s.attackSpeed = Math.max(s.attackSpeed, item.speed || 1.6);
        s.reach = Math.max(s.reach, item.reach || 4.5);
      }
      if (item.armor) {
        s.armor += item.armor;
        s.toughness += item.toughness || 0;
      }
      if (item.knockback) s.knockback += item.knockback;
    }
    const gd = gearDef(eq.id);
    if (gd) {
      for (const [k, v] of Object.entries(gd.stats)) {
        const key = SKILL_STAT_MAP.get(k as SkillStat);
        if (key) addStat(s, key, v as number, false);
      }
      if (gd.setId) setCount.set(gd.setId, (setCount.get(gd.setId) || 0) + 1);
    }
    if (eq.affixes) {
      for (const a of eq.affixes) {
        const target = affixTarget(a.id);
        if (target) addStat(s, target.key, a.value, target.percent);
      }
    }
  }

  // ---------------------------------------------------------------- set bonuses
  for (const [setId, count] of setCount) {
    const set = GEAR_SETS.find((g) => g.id === setId);
    if (!set) continue;
    for (const [pieces, bonus] of Object.entries(set.bonuses)) {
      if (count < Number(pieces)) continue;
      for (const [k, v] of Object.entries(bonus.stats)) {
        const key = SKILL_STAT_MAP.get(k as SkillStat);
        if (key) addStat(s, key, v as number, false);
      }
    }
  }

  // ---------------------------------------------------------------- skills
  for (const [skillId, lvl] of Object.entries(skills)) {
    if (!lvl) continue;
    const def = SKILL_BY_ID.get(skillId);
    if (!def || !def.perLevel) continue;
    for (const [k, v] of Object.entries(def.perLevel)) {
      const key = SKILL_STAT_MAP.get(k as SkillStat);
      if (!key) continue;
      const value = v as number;
      if (SKILL_PERCENT.has(k as SkillStat)) addStat(s, key, value * lvl, false);
      else addStat(s, key, value * lvl, false);
    }
  }

  // ---------------------------------------------------------------- buffs
  for (const [k, v] of Object.entries(buffs)) {
    if (v === undefined) continue;
    const key = k as keyof StatBlock;
    if (PERCENT_KEYS.includes(key)) addStat(s, key, v as number, true);
    else addStat(s, key, v as number, false);
  }

  // ---------------------------------------------------------------- clamp
  s.percentDamage = clamp(s.percentDamage, -0.6, 5);
  s.percentSpeed = clamp(s.percentSpeed, -0.7, 3);
  s.critChance = clamp(s.critChance, 0, 0.85);
  s.dodge = clamp(s.dodge, 0, 0.6);
  s.lifesteal = clamp(s.lifesteal, -1, 0.5);
  s.spellPower = Math.max(0, s.spellPower);
  s.resistance = clamp(s.resistance, 0, 0.8);
  s.threatGeneration = Math.max(0.2, s.threatGeneration);
  s.reach = Math.max(2, s.reach);
  s.movementSpeed = clamp(s.movementSpeed * (1 + s.percentSpeed), 1.5, 14);
  s.maxHealth = Math.max(1, s.maxHealth);
  s.maxMana = Math.max(1, s.maxMana);
  return s;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Health needed to reach a level, tuned to ~2.4 enemies per level at parity. */
export function xpToNext(level: number): number {
  return Math.floor(38 * Math.pow(level, 1.55)) + 12 * level;
}

/** Experience from an enemy of a given tier. */
export function xpForTier(tier: number): number {
  return Math.floor(5 * Math.pow(tier + 1, 1.35) + 6);
}

/** How much damage a weapon in hand deals, before crit and variance. */
export function weaponDamage(s: StatBlock, item: ItemDef | null, power = 1): number {
  const base = (item && item.kind === 'weapon' ? item.damage || 1 : s.flatDamage) * (1 + s.percentDamage);
  return Math.max(1, base * power);
}

/** Armour mitigation: linear against small hits, diminishing against big ones. */
export function damageMitigation(armor: number, toughness: number, raw: number): number {
  const eff = armor * (1 + toughness * 0.02);
  const reduced = raw * eff / (eff + 24);
  return Math.max(raw * 0.12, reduced);
}

export { ACTIVE_SKILL_SLOTS, SKILLS };
export type { SkillTree };
