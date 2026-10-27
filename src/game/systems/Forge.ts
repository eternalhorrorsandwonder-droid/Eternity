/**
 * Furnace, enchanting table and loot tables.
 *
 * Two blocks in the world advertised a job and then did not do it: the furnace
 * said "Use Furnace" and the enchanting table said "Enchant", and pressing the
 * key answered "Nothing to do here." A block that promises something and then
 * refuses is worse than no block at all, so this file is the missing machinery.
 *
 * The design rules the tables follow:
 *
 *   - **Smelting is a conversion, not a reward.** One input becomes one output
 *     after a fixed time, and it needs fuel. The point is to make ore worth
 *     carrying and to give coal a second job beyond trading.
 *   - **Enchanting costs progression currency.** It spends experience levels
 *     and lapis, and the cost rises with the enchant's own tier, so a player
 *     cannot dump every bonus onto one sword in a single visit.
 *   - **Bookshelves raise the level, not the price.** Standing near them is how
 *     a player reaches the higher tiers; the table itself stays cheap.
 *   - **Loot scales with the region, not with a roll.** A chest in a level-8
 *     region cannot contain a level-60 item, which is what keeps the power
 *     curve under the game's control rather than the random number generator's.
 *
 * Everything here is pure data plus pure arithmetic. The player-facing methods
 * live on `Player`, which keeps this file importable from anywhere without
 * dragging the save format along with it.
 */

import { RNG } from '../../engine/core/RNG';
import { ITEMS, type ItemKind } from '../data/Items';

// ---------------------------------------------------------------- smelting

export interface SmeltRecipe {
  input: number;
  output: number;
  /** Seconds at one unit of fuel. */
  time: number;
}

/**
 * Smelting table.
 *
 * Ordered most-common-first because `smeltSeconds` does a linear scan and
 * players smelt ore far more often than they smelt ancient debris.
 */
export const SMELTING: SmeltRecipe[] = [
  { input: 1040, output: 1031, time: 2.0 },  // Iron Ore -> Iron Ingot
  { input: 1041, output: 1032, time: 2.0 },  // Gold Ore -> Gold Ingot
  { input: 1042, output: 1033, time: 3.0 },  // Diamond Ore -> Diamond
  { input: 1044, output: 1031, time: 1.5 },  // Raw Iron -> Iron Ingot
  { input: 1045, output: 1032, time: 1.5 },  // Raw Gold -> Gold Ingot
  { input: 1046, output: 1043, time: 1.5 },  // Raw Copper -> Copper Ingot
  { input: 1050, output: 1049, time: 8.0 },  // Ancient Debris -> Netherite Scrap
  { input: 1212, output: 1206, time: 1.0 },  // Raw Beef -> Cooked Beef
  { input: 1213, output: 1208, time: 1.0 },  // Raw Mutton -> Cooked Mutton
  { input: 1214, output: 1209, time: 1.0 },  // Raw Chicken -> Cooked Chicken
  { input: 1215, output: 1210, time: 1.0 },  // Raw Salmon -> Cooked Salmon
  { input: 1216, output: 1211, time: 1.0 },  // Raw Cod -> Cooked Cod
];

/** Every material that can be burned, and for how long. */
export const FUELS: { id: number; seconds: number }[] = [
  { id: 1038, seconds: 1600 },  // Coal
  { id: 1039, seconds: 1600 },  // Charcoal
  { id: 1051, seconds: 1200 },  // Blaze Rod
  { id: 1004, seconds: 300 },   // Wooden Plank
  { id: 1006, seconds: 100 },   // Stick
];

/** Seconds of smelting one unit, or 0 when the item cannot be smelted. */
export function smeltSeconds(inputId: number): number {
  const recipe = SMELTING.find((r) => r.input === inputId);
  return recipe ? recipe.time : 0;
}

/** The smelted product of an item, or 0 when there is no recipe. */
export function smeltOutput(inputId: number): number {
  return SMELTING.find((r) => r.input === inputId)?.output ?? 0;
}

/** True when the item can be smelted at all. */
export function isSmeltable(inputId: number): boolean {
  return smeltSeconds(inputId) > 0;
}

/** Fuel value of an item in seconds, taken from the item's own `fuel` field. */
export function fuelSeconds(id: number): number {
  const def = ITEMS[id];
  if (def && typeof def.fuel === 'number' && def.fuel > 0) return def.fuel;
  return FUELS.find((f) => f.id === id)?.seconds ?? 0;
}

/** True when the item can keep a furnace running. */
export function isFuel(id: number): boolean {
  return fuelSeconds(id) > 0;
}

// --------------------------------------------------------------- enchanting

export interface EnchantDef {
  id: string;
  name: string;
  /** Base cost in experience levels. */
  cost: number;
  /** The highest level this enchantment reaches. */
  maxLevel: number;
  /** Which item kinds may carry it. */
  kinds: ItemKind[];
  /** The stat it improves. */
  stat: EnchantStat;
  /** Amount added per level. */
  perLevel: number;
  description: string;
}

export type EnchantStat =
  | 'flatDamage' | 'percentDamage' | 'armor' | 'toughness'
  | 'critChance' | 'critDamage' | 'knockback' | 'harvestBonus'
  | 'rareFind' | 'fireDamage' | 'attackSpeed' | 'cooldownReduction';

export const ENCHANTS: EnchantDef[] = [
  { id: 'sharpness', name: 'Sharpness', cost: 1, maxLevel: 5,
    kinds: ['weapon'], stat: 'flatDamage', perLevel: 0.75,
    description: '+0.75 damage per level.' },
  { id: 'smite', name: 'Smite', cost: 1, maxLevel: 5,
    kinds: ['weapon'], stat: 'flatDamage', perLevel: 1.25,
    description: '+1.25 damage against the forces of the dark.' },
  { id: 'efficiency', name: 'Efficiency', cost: 2, maxLevel: 5,
    kinds: ['tool'], stat: 'harvestBonus', perLevel: 0.75,
    description: 'Mine faster and recover more of what you break.' },
  { id: 'fortune', name: 'Fortune', cost: 3, maxLevel: 3,
    kinds: ['tool'], stat: 'rareFind', perLevel: 0.2,
    description: '+20% rare drops per level.' },
  { id: 'silk_touch', name: 'Silk Touch', cost: 4, maxLevel: 2,
    kinds: ['tool'], stat: 'harvestBonus', perLevel: 2.5,
    description: 'Break blocks whole. The rarest mining enchantment.' },
  { id: 'protection', name: 'Protection', cost: 1, maxLevel: 4,
    kinds: ['armor'], stat: 'armor', perLevel: 2.0,
    description: '+2.0 armour per level.' },
  { id: 'thorns', name: 'Thorns', cost: 2, maxLevel: 3,
    kinds: ['armor'], stat: 'toughness', perLevel: 0.75,
    description: 'Armour that bites back.' },
  { id: 'power', name: 'Power', cost: 2, maxLevel: 5,
    kinds: ['weapon'], stat: 'critDamage', perLevel: 0.25,
    description: '+25% critical damage per level.' },
  { id: 'punch', name: 'Punch', cost: 2, maxLevel: 2,
    kinds: ['weapon'], stat: 'knockback', perLevel: 0.2,
    description: '+0.2 knockback per level.' },
  { id: 'flame', name: 'Flame', cost: 3, maxLevel: 3,
    kinds: ['weapon'], stat: 'fireDamage', perLevel: 0.1,
    description: '+10% fire damage per level.' },
  { id: 'respiration', name: 'Respiration', cost: 2, maxLevel: 3,
    kinds: ['armor'], stat: 'toughness', perLevel: 0.5,
    description: 'Tougher in the deep and underwater.' },
  { id: 'swift', name: 'Swiftness', cost: 2, maxLevel: 3,
    kinds: ['armor', 'weapon'], stat: 'attackSpeed', perLevel: 0.06,
    description: '+6% attack speed per level.' },
  { id: 'arcane', name: 'Arcane Resonance', cost: 3, maxLevel: 3,
    kinds: ['weapon', 'armor', 'tool', 'magic'], stat: 'cooldownReduction', perLevel: 0.05,
    description: '+5% cooldown recovery per level.' },
];

export const ENCHANT_BY_ID: Map<string, EnchantDef> = new Map(ENCHANTS.map((e) => [e.id, e]));

/** Experience-level cost of an enchantment at a given level. */
export function enchantCost(id: string, level: number): number {
  const def = ENCHANT_BY_ID.get(id);
  if (!def) return 0;
  return def.cost * level;
}

/**
 * The highest enchantment level available at a table.
 *
 * Bookshelves add one level each, up to the enchantment's own ceiling, so the
 * table is a place you *go to* rather than a thing you build once and forget.
 */
export function enchantLevelFor(bookshelves: number, def: EnchantDef): number {
  return Math.max(1, Math.min(def.maxLevel, 1 + Math.max(0, bookshelves)));
}

/** True when an item of this kind may carry this enchantment. */
export function enchantAppliesTo(def: EnchantDef, kind: ItemKind): boolean {
  return def.kinds.includes(kind);
}

/** True when the item already has this enchantment. */
export function hasEnchant(stack: { enchants?: { id: string; level: number }[] }, id: string): boolean {
  return (stack.enchants || []).some((e) => e.id === id);
}

/** Total enchantment levels on a stack, for the tooltip. */
export function enchantCount(stack: { enchants?: { id: string; level: number }[] }): number {
  return (stack.enchants || []).reduce((sum, e) => sum + e.level, 0);
}

// ------------------------------------------------------------ chest loot

export interface LootEntry { id: number; tier: number; weight: number; }

/**
 * Chest contents, weighted by region tier.
 *
 * Tiered rather than random: the loot pool is filtered by the region's level
 * band before anything is rolled, so a chest cannot hand out an end-game item
 * to a first-hour player. Within the pool the weights favour materials the
 * region's progression actually wants.
 */
export const CHEST_LOOT: LootEntry[] = [
  { id: 1004, tier: 0, weight: 26 },  // Wooden Plank
  { id: 1006, tier: 0, weight: 22 },  // Stick
  { id: 1005, tier: 0, weight: 20 },  // Cobblestone
  { id: 1038, tier: 0, weight: 12 },  // Coal
  { id: 1035, tier: 1, weight: 16 },  // Redstone
  { id: 1036, tier: 1, weight: 14 },  // Lapis Lazuli
  { id: 1031, tier: 1, weight: 12 },  // Iron Ingot
  { id: 1040, tier: 1, weight: 10 },  // Iron Ore
  { id: 1037, tier: 2, weight: 14 },  // Quartz
  { id: 1032, tier: 2, weight: 11 },  // Gold Ingot
  { id: 1041, tier: 2, weight: 9 },   // Gold Ore
  { id: 1034, tier: 2, weight: 8 },   // Emerald
  { id: 1033, tier: 3, weight: 14 },  // Diamond
  { id: 1042, tier: 3, weight: 10 },  // Diamond Ore
  { id: 1049, tier: 4, weight: 10 },  // Netherite Scrap
  { id: 1050, tier: 4, weight: 8 },   // Ancient Debris
  { id: 1076, tier: 4, weight: 5 },   // Eternity Shard
];

/**
 * Roll one chest item for a region of a given tier.
 *
 * `tier` is the region's level band divided by ten, clamped to the loot table's
 * own range, which is what ties a chest's contents to the world it sits in.
 */
export function rollChestLoot(rng: RNG, tier: number): number {
  const pool = CHEST_LOOT.filter((e) => e.tier <= tier);
  if (!pool.length) return CHEST_LOOT[0].id;
  const total = pool.reduce((sum, e) => sum + e.weight, 0);
  let roll = rng.nextFloat() * total;
  for (const entry of pool) {
    roll -= entry.weight;
    if (roll <= 0) return entry.id;
  }
  return pool[pool.length - 1].id;
}

/** How many items a chest in a region of this tier contains. */
export function chestItemCount(rng: RNG, tier: number): number {
  const base = 2 + Math.min(4, Math.floor(tier / 2));
  return base + (rng.nextFloat() < 0.35 ? 1 : 0);
}

/** A region's tier from its level band, for loot and structure scaling. */
export function tierForLevel(level: number): number {
  return Math.max(0, Math.min(4, Math.floor(Math.max(1, level) / 12)));
}
