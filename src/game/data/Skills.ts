/**
 * Skill trees: Might, Finesse, Arcana.
 *
 * Each tree has eight skills that must be unlocked in order. A skill's effect
 * is expressed as a *per-level* delta over the base stat block, so the tree
 * grants a slow, compounding improvement rather than a burst. The two passive
 * capstones (tier 7 and tier 8 of each tree) are the only things that change
 * how the game feels rather than how much damage it does.
 *
 * Points are rare: a level grants one, and a player who wants a capstone has to
 * spend twelve levels getting there. That is the point.
 */

export type SkillTree = 'might' | 'finesse' | 'arcana';

export const TREE_ORDER: SkillTree[] = ['might', 'finesse', 'arcana'];

export const TREE_LABEL: Record<SkillTree, string> = {
  might: 'Might',
  finesse: 'Finesse',
  arcana: 'Arcana',
};

export const TREE_COLOR: Record<SkillTree, number> = {
  might: 0xff6a3a,
  finesse: 0x5ae0a0,
  arcana: 0xa080e8,
};

export const TREE_DESCRIPTION: Record<SkillTree, string> = {
  might: 'HP, armour, raw damage and the right to keep swinging.',
  finesse: 'Speed, reach, crit and the ability to be somewhere you were not.',
  arcana: 'Mana, spell power, cooldowns and the patience to use both.',
};

/** All stat keys a skill can contribute to, as a runtime list for validation. */
export const SKILL_STAT_KEYS = [
  'flat_damage', 'percent_damage', 'attack_speed', 'move_speed',
  'flat_speed', 'percent_speed',
  'flat_hp', 'percent_hp', 'flat_armor', 'percent_armor',
  'crit_chance', 'crit_damage', 'lifesteal', 'life_on_kill',
  'mana_max', 'mana_regen', 'spell_power', 'cooldown_reduction',
  'dodge', 'knockback', 'reach', 'hp_regen', 'dash_charges',
  'buff_duration', 'pet_damage', 'threat_generation', 'fire_damage',
  'cold_damage', 'arcane_damage', 'void_damage', 'resistance',
  'respawn_health', 'execution_threshold',
] as const;

/** Stat keys a skill can contribute to. */
export type SkillStat =
  | 'flat_damage' | 'percent_damage' | 'attack_speed' | 'move_speed'
  | 'flat_speed' | 'percent_speed'
  | 'flat_hp' | 'percent_hp' | 'flat_armor' | 'percent_armor'
  | 'crit_chance' | 'crit_damage' | 'lifesteal' | 'life_on_kill'
  | 'mana_max' | 'mana_regen' | 'spell_power' | 'cooldown_reduction'
  | 'dodge' | 'knockback' | 'reach' | 'hp_regen' | 'dash_charges'
  | 'buff_duration' | 'pet_damage' | 'threat_generation' | 'fire_damage'
  | 'cold_damage' | 'arcane_damage' | 'holy_damage' | 'void_damage'
  | 'resistance' | 'respawn_health' | 'execution_threshold';

export interface SkillDef {
  id: string;
  name: string;
  tree: SkillTree;
  /** 0..7, in unlock order. */
  tier: number;
  maxLevel: number;
  description: string;
  /** Per-level stat contributions. */
  perLevel: Partial<Record<SkillStat, number>>;
  /** What the skill actually does, for the UI. */
  detail: string;
  /** Whether the skill is a passive or an active. */
  kind: 'passive' | 'active';
  /** Active skills: cooldown at level 1, in seconds. */
  cooldown?: number;
  /** Active skills: mana cost at level 1. */
  cost?: number;
  /** Active skills: how the cooldown scales with level. */
  cooldownScale?: number;
  /** Active skills: how the mana cost scales with level. */
  costScale?: number;
}

function s(
  id: string, name: string, tree: SkillTree, tier: number, maxLevel: number,
  description: string, perLevel: Partial<Record<SkillStat, number>>,
  detail: string, kind: 'passive' | 'active' = 'passive',
  cooldown?: number, cost?: number, cooldownScale?: number, costScale?: number
): SkillDef {
  return { id, name, tree, tier, maxLevel, description, perLevel, detail, kind, cooldown, cost, cooldownScale, costScale };
}

export const SKILLS: SkillDef[] = [
  // ------------------------------------------------------------------ MIGHT
  s('might_0', 'Heavy Hands', 'might', 0, 5,
    'Your attacks deal more damage.',
    { percent_damage: 0.04 },
    '+4% damage per level. The most reliable number in the game.'),
  s('might_1', 'Thick Skin', 'might', 1, 5,
    'Gain armour and health.',
    { percent_armor: 0.05, percent_hp: 0.03 },
    '+5% armour and +3% max health per level.'),
  s('might_2', 'Brutish Stance', 'might', 2, 5,
    'Increase knockback and your effective weight.',
    { knockback: 0.06, flat_armor: 2 },
    '+6% knockback per level, +2 flat armour per level.'),
  s('might_3', 'Rage', 'might', 3, 5,
    'Gain Rage as you deal and take damage. Rage increases damage.',
    { percent_damage: 0.05, flat_damage: 1 },
    'Every 10 Rage gives +5% damage and +1 flat damage. Caps at 100 Rage.',
    'passive'),
  s('might_4', 'Cleave', 'might', 4, 4,
    'Your heavy attack hits a wider arc.',
    { reach: 0.35, knockback: 0.1 },
    '+0.35 blocks of reach and +10% knockback per level.'),
  s('might_5', 'Endure', 'might', 5, 5,
    'Recover health when you kill.',
    { life_on_kill: 0.5, hp_regen: 0.1 },
    '+0.5 health per kill and +0.1 health per second per level.'),
  s('might_6', 'Executioner\'s Cut', 'might', 6, 5,
    'Damage low-health enemies for more.',
    { execution_threshold: 0.06, percent_damage: 0.03 },
    '+6% damage against enemies below 30% health, +3% damage per level.'),
  s('might_7', 'Unbreakable', 'might', 7, 3,
    'You cannot be killed. You can be knocked down.',
    { respawn_health: 0.5, resistance: 0.08 },
    'On death you revive with 50% health and +8% resistance per level instead of dying. Three uses per hour.'),
  s('might_active_0', 'Whirlwind', 'might', 0, 5, 'Spin, damaging everything around you.',
    {},
    'Sweeps a 3-block radius, dealing 150% of your damage.',
    'active', 9, 0, 0.9, 0),
  s('might_active_1', 'Shattering Slam', 'might', 1, 5, 'Leap and smash the ground.',
    {},
    'Leaps 8 blocks, deals 220% damage in a 5-block radius and stuns for 1.5s.',
    'active', 16, 0, 0.9, 0),
  s('might_active_2', 'Iron Wall', 'might', 2, 5, 'Raise a shield and stop everything.',
    {},
    '4 seconds of 80% damage reduction. Push to attack cancels it.',
    'active', 20, 0, 0.88, 0),

  // --------------------------------------------------------------- FINESSE
  s('finesse_0', 'Light Steps', 'finesse', 0, 5, 'Move faster.',
    { percent_speed: 0.045, flat_speed: 0.02 },
    '+4.5% movement speed and +0.02 flat per level.'),
  s('finesse_1', 'Eyes of the Hawk', 'finesse', 1, 5, 'Strike more accurately.',
    { crit_chance: 0.025, reach: 0.2 },
    '+2.5% critical chance and +0.2 blocks of reach per level.'),
  s('finesse_2', 'Serrated Edge', 'finesse', 2, 5, 'Critical hits hurt more.',
    { crit_damage: 0.1, flat_damage: 0.5 },
    '+10% critical damage and +0.5 flat damage per level.'),
  s('finesse_3', 'Dodge', 'finesse', 3, 5, 'Roll away.',
    { dodge: 0.02, attack_speed: 0.03 },
    '+2% dodge chance and +3% attack speed per level.'),
  s('finesse_4', 'Swift Strike', 'finesse', 4, 5, 'Attack faster.',
    { attack_speed: 0.05 },
    '+5% attack speed per level. Caps at +40%.'),
  s('finesse_5', 'Vampiric Touch', 'finesse', 5, 5, 'Feed on the wounded.',
    { lifesteal: 0.02, life_on_kill: 0.25 },
    '+2% lifesteal and +0.25 health per kill per level.'),
  s('finesse_6', 'Dancer\'s Step', 'finesse', 6, 5, 'Reposition mid-fight.',
    { dash_charges: 0.2, dodge: 0.015 },
    '+0.2 charges per second and +1.5% dodge per level.'),
  s('finesse_7', 'Bladestorm', 'finesse', 7, 3, 'Become the storm.',
    { attack_speed: 0.25, crit_chance: 0.1, percent_damage: 0.1 },
    'Your next 6 attacks in 8 seconds deal double damage and all crit.'),
  s('finesse_active_0', 'Dash', 'finesse', 0, 5, 'Flick of motion.',
    {},
    'Dash forward 6 blocks, invulnerable, and leave a afterimage that damages enemies you pass through.',
    'active', 4, 0, 0.85, 0),
  s('finesse_active_1', 'Phantom Strike', 'finesse', 1, 5, 'Strike from nowhere.',
    {},
    'Teleport behind the nearest enemy within 12 blocks and strike for 200% damage.',
    'active', 12, 0, 0.9, 0),
  s('finesse_active_2', 'Marked Prey', 'finesse', 2, 5, 'Hunt one thing.',
    {},
    'Mark an enemy for 10 seconds: +50% damage to it, and every 3rd hit stuns.',
    'active', 18, 0, 0.92, 0),

  // ---------------------------------------------------------------- ARCANA
  s('arcana_0', 'Mana Well', 'arcana', 0, 5, 'Hold more mana and refill it faster.',
    { mana_max: 0.06, mana_regen: 0.06 },
    '+6% max mana and +6% mana regen per level.'),
  s('arcana_1', 'Arcane Affinity', 'arcana', 1, 5, 'Spells hit harder.',
    { spell_power: 0.07, flat_damage: 0.4 },
    '+7% spell damage and +0.4 flat spell damage per level.'),
  s('arcana_2', 'Quickened Casting', 'arcana', 2, 5, 'Cast faster.',
    { cooldown_reduction: 0.045, attack_speed: 0.02 },
    '-4.5% cooldowns and +2% attack speed per level.'),
  s('arcana_3', 'Elemental Mastery', 'arcana', 3, 5, 'Your elemental damage carries more weight.',
    { fire_damage: 0.08, cold_damage: 0.08, arcane_damage: 0.08, void_damage: 0.06 },
    '+8% fire, cold and arcane damage, +6% void damage per level.'),
  s('arcana_4', 'Frost Lance', 'arcana', 4, 5, 'A spell that slows.',
    { cold_damage: 0.15, cooldown_reduction: 0.02 },
    'Your projectiles slow enemies by 15% for 3 seconds. +15% cold damage per level.'),
  s('arcana_5', 'Arcane Surge', 'arcana', 5, 5, 'Burst of power.',
    { spell_power: 0.05, buff_duration: 0.08 },
    'Attacking stacks Surge to 5. At 5, your next spell deals +50% damage.'),
  s('arcana_6', 'Void Shield', 'arcana', 6, 5, 'Absorb the hit.',
    { resistance: 0.05, mana_max: 0.04 },
    '+5% resistance and +4% max mana per level.'),
  s('arcana_7', 'Eternity Loop', 'arcana', 7, 3, 'Break the second clock.',
    { cooldown_reduction: 0.12, spell_power: 0.15 },
    'Active skill cooldowns fall to 40% of their value for 6 seconds, every 40 seconds.'),
  s('arcana_active_0', 'Fireball', 'arcana', 0, 5, 'A simple, honest spell.',
    {},
    'Launches a fireball dealing 180% spell damage, exploding for 120% in a 3-block radius.',
    'active', 7, 8, 0.9, 1.1),
  s('arcana_active_1', 'Frost Nova', 'arcana', 1, 5, 'Freeze everything nearby.',
    {},
    'Freezes all enemies in a 5-block radius for 3 seconds and deals 100% spell damage.',
    'active', 14, 12, 0.9, 1.15),
  s('arcana_active_2', 'Chain Lightning', 'arcana', 2, 5, 'Find a target, then another.',
    {},
    'Bolts to the nearest enemy, then 60% damage to the next, then 36% to the next.',
    'active', 11, 14, 0.9, 1.2),
  s('arcana_active_3', 'Meteor', 'arcana', 3, 5, 'Ask the sky nicely.',
    {},
    'A meteor falls 12 blocks away, dealing 400% spell damage and leaving a 3-second fire field.',
    'active', 30, 30, 0.95, 1.3),
];

export const SKILL_BY_ID: Map<string, SkillDef> = new Map(SKILLS.map((x) => [x.id, x]));

/** All skills in a tree, in unlock order. */
export function skillsInTree(tree: SkillTree): SkillDef[] {
  return SKILLS.filter((s) => s.tree === tree).sort((a, b) => a.tier - b.tier);
}

/** A tree costs one point per level of any skill in it. */
export function totalSkillPointsNeeded(tree: SkillTree): number {
  return skillsInTree(tree).reduce((sum, s) => sum + s.maxLevel, 0);
}

/** Skill ids for the "active" shortcut slots in the HUD. */
export const ACTIVE_SKILL_SLOTS = 4;
