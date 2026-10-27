/**
 * Achievements.
 *
 * Sixty-plus unlockable trophies, grouped into the same categories the board
 * renders: Exploration, Combat, Progression, Crafting, Social and Secrets.
 *
 * Each one carries a `check` key that the achievement system interprets — it is
 * the string shown in the codex and matched against the live counters the
 * systems push. Keeping the condition in the data (rather than in code) means a
 * designer can add an achievement without touching the runtime.
 */

export type AchievementGroup = 'exploration' | 'combat' | 'progression' | 'crafting' | 'social' | 'secrets';

export interface AchievementDef {
  id: string;
  name: string;
  group: AchievementGroup;
  /** Counter key the system watches. */
  check: string;
  /** How many of that counter are required. */
  count: number;
  description: string;
  /** Icon tint. */
  color: number;
  /** True when the achievement is hidden until unlocked. */
  secret?: boolean;
}

const a = (
  id: string, name: string, group: AchievementGroup, check: string, count: number,
  description: string, color: number, secret = false
): AchievementDef => ({ id, name, group, check, count, description, color, secret });

export const ACHIEVEMENTS: AchievementDef[] = [
  // ------------------------------------------------------------- exploration
  a('explore_first', 'First Horizon', 'exploration', 'regions_visited', 1, 'Set foot in a new region.', 0x8ad0ff),
  a('explore_walker', 'The Walker', 'exploration', 'regions_visited', 10, 'Visit 10 regions.', 0x8ad0ff),
  a('explore_pilgrim', 'Pilgrim of the Whole World', 'exploration', 'regions_visited', 60, 'Visit every region.', 0x8ad0ff),
  a('explore_distance', 'Long Legs', 'exploration', 'distance_walked', 10000, 'Walk 10,000 blocks.', 0x5ae0a0),
  a('explore_distance_2', 'The Wanderer', 'exploration', 'distance_walked', 100000, 'Walk 100,000 blocks.', 0x5ae0a0),
  a('explore_peak', 'Top of the World', 'exploration', 'max_height', 100, 'Reach height 100.', 0xfff0a0),
  a('explore_depth', 'Down Below', 'exploration', 'min_height', -20, 'Descend below y=-20.', 0x8a6ae8),
  a('explore_ocean', 'The Deep Blue', 'exploration', 'ocean_tiles_swum', 500, 'Swim 500 blocks.', 0x40a0d0),
  a('explore_every_biome', 'Homebody', 'exploration', 'biomes_visited', 35, 'Visit every biome.', 0x7ce8e8),
  a('explore_night', 'Night Walker', 'exploration', 'nights_survived', 5, 'Survive five nights.', 0x4040a0),
  a('explore_storm', 'Storm Rider', 'exploration', 'storms_survived', 3, 'Survive three world storms.', 0x8a8ad0),
  a('explore_map', 'Cartographer', 'exploration', 'map_sections', 100, 'Map 100 regions.', 0x8ad0ff),

  // ------------------------------------------------------------------ combat
  a('combat_first_kill', 'First Blood', 'combat', 'enemies_killed', 1, 'Defeat an enemy.', 0xe05050),
  a('combat_slayer', 'Slayer', 'combat', 'enemies_killed', 100, 'Defeat 100 enemies.', 0xe05050),
  a('combat_butcher', 'Butcher', 'combat', 'enemies_killed', 1000, 'Defeat 1,000 enemies.', 0xe05050),
  a('combat_no_hit', 'Untouched', 'combat', 'no_hit_fights', 1, 'Win a fight without taking damage.', 0xffd040),
  a('combat_combo', 'Combo', 'combat', 'max_combo', 20, 'Land a 20-hit combo.', 0xff8a3a),
  a('combat_crit', 'Critical Eye', 'combat', 'crits_landed', 50, 'Land 50 critical hits.', 0xff5050),
  a('combat_boss', 'Titan Slayer', 'combat', 'bosses_killed', 1, 'Defeat a boss.', 0xff5ac0),
  a('combat_titan_killer', 'Titan Killer', 'combat', 'bosses_killed', 12, 'Defeat every boss.', 0xff3aa0),
  a('combat_denied', 'Denied', 'combat', 'bosses_escaped', 1, 'Let a boss escape at low health.', 0x8a6a4a, true),
  a('combat_parity', 'Even Terms', 'combat', 'fights_at_level', 50, 'Defeat an enemy 5 levels above you.', 0xffd040),
  a('combat_bait', 'Bait', 'combat', 'elites_killed', 10, 'Defeat 10 elite enemies.', 0xb040e0),
  a('combat_unarmed', 'Bare Hands', 'combat', 'unarmed_kills', 5, 'Defeat 5 enemies with no weapon.', 0xc0a060, true),
  a('combat_all_types', 'Encyclopaedist of Pain', 'combat', 'enemy_types_killed', 40, 'Kill 40 different enemy types.', 0xe05050),

  // -------------------------------------------------------------- progression
  a('prog_first_level', 'Level Up', 'progression', 'levels_gained', 1, 'Gain a level.', 0xffe070),
  a('prog_twenty', 'Twenty', 'progression', 'level_reached', 20, 'Reach level 20.', 0xffe070),
  a('prog_fifty', 'Half a Century', 'progression', 'level_reached', 50, 'Reach level 50.', 0xffe070),
  a('prog_hundred', 'One Hundred', 'progression', 'level_reached', 100, 'Reach level 100.', 0xffe070),
  a('prog_first_skill', 'A New Talent', 'progression', 'skills_learned', 1, 'Learn a skill.', 0xa080e8),
  a('prog_max_tree', 'Mastery', 'progression', 'skills_learned', 24, 'Learn every skill in a tree.', 0xa080e8),
  a('prog_all_trees', 'Polymath', 'progression', 'trees_completed', 3, 'Complete all three skill trees.', 0xc080ff),
  a('prog_completionist', 'Everything, Eventually', 'progression', 'achievements_unlocked', 60, 'Unlock 60 achievements.', 0xffe070),
  a('prog_quest_first', 'Quest Hero', 'progression', 'quests_completed', 1, 'Complete a quest.', 0x5ae070),
  a('prog_quest_main', 'The Mainline', 'progression', 'mainline_progress', 80, 'Reach the end of the mainline.', 0xffe070),
  a('prog_quest_all', 'Nobody Left Behind', 'progression', 'quests_completed', 60, 'Complete every quest.', 0x7ce8c0),
  a('prog_crown', 'Sovereign', 'progression', 'crown_obtained', 1, 'Claim the Broken Crown.', 0xffd060),
  a('prog_vault', 'Vault Opener', 'progression', 'vault_opened', 1, 'Open the Eternity Vault.', 0xff5ac0),
  a('prog_heart', 'Heart of the World', 'progression', 'world_heart_seen', 1, 'Stand at the heart of the world.', 0xff3aa0),

  // ---------------------------------------------------------------- crafting
  a('craft_first', 'I Made This', 'crafting', 'items_crafted', 1, 'Craft an item.', 0xd0a060),
  a('craft_hundred', 'Hammer and Torch', 'crafting', 'items_crafted', 100, 'Craft 100 items.', 0xd0a060),
  a('craft_diamond', 'Diamond Worker', 'crafting', 'diamond_items', 1, 'Craft a diamond tool.', 0x6ce8e8),
  a('craft_netherite', 'Netherite Forger', 'crafting', 'netherite_items', 1, 'Forge a netherite item.', 0x8a7bd0),
  a('craft_armour', 'Full Plate', 'crafting', 'armour_pieces', 4, 'Craft a full armour set.', 0xb8b8c0),
  a('craft_set', 'Set Collector', 'crafting', 'gear_sets_complete', 6, 'Complete all six gear sets.', 0xffe070),
  a('craft_legendary', 'Legend', 'crafting', 'legendaries_found', 1, 'Find a legendary item.', 0xffd040),
  a('craft_legendary_all', 'The Whole Pantheon', 'crafting', 'legendaries_found', 14, 'Find every legendary.', 0xffd040),
  a('craft_brew', 'Alchemist', 'crafting', 'potions_brewed', 10, 'Brew 10 potions.', 0xb0e0ff),
  a('craft_enchant', 'Enchanter', 'crafting', 'items_enchanted', 5, 'Enchant an item.', 0x9050e0),
  a('craft_farm', 'Green Thumb', 'crafting', 'crops_grown', 50, 'Grow 50 crops.', 0x7ce05a),
  a('craft_mine', 'Miner', 'crafting', 'blocks_mined', 500, 'Mine 500 blocks.', 0xb0b0b8),
  a('craft_diamond_mine', 'Deep Miner', 'crafting', 'blocks_mined', 5000, 'Mine 5,000 blocks.', 0xb0b0b8),
  a('craft_cook', 'Chef', 'crafting', 'foods_cooked', 25, 'Cook 25 meals.', 0xe09040),

  // ----------------------------------------------------------------- social
  a('social_save_first', 'Saved', 'social', 'saves_made', 1, 'Save the game.', 0x8ad0ff),
  a('social_save_ten', 'Cautious', 'social', 'saves_made', 10, 'Save the game 10 times.', 0x8ad0ff),
  a('social_restart', 'Restarter', 'social', 'restarts', 1, 'Restart from death.', 0xe05050),
  a('social_fullscreen', 'The Whole Screen', 'social', 'fullscreen_used', 1, 'Enter fullscreen.', 0x8ad0ff),
  a('social_touch', 'Thumb Warrior', 'social', 'touch_sessions', 1, 'Play a session on touch controls.', 0x5ae0a0),
  a('social_no_death', 'Careful', 'social', 'sessions_no_death', 1, 'Finish a session without dying.', 0x7ce8c0),
  a('social_codex', 'Codex Reader', 'social', 'codex_entries', 30, 'Read 30 codex entries.', 0xd0d0ff),
  a('social_title', 'Titled', 'social', 'titles_earned', 1, 'Earn a title.', 0xffd060),
  a('social_title_all', 'The Whole Roster', 'social', 'titles_earned', 12, 'Earn every title.', 0xffd060),
  a('social_hours', 'Wanderer', 'social', 'playtime_minutes', 600, 'Play for 10 hours.', 0x8ad0ff),

  // ----------------------------------------------------------------- secrets
  a('secret_tutorial', 'The First Pillar', 'secrets', 'tutorial_revisited', 1, 'Return to the First Pillar after leaving.', 0xffe070),
  a('secret_hidden_shrine', 'The Hidden Shrine', 'secrets', 'hidden_shrines', 1, 'Find a shrine that is not on any map.', 0x7ce8e8, true),
  a('secret_void_echo', 'The Echo', 'secrets', 'void_echo_found', 1, 'Meet your echo in the void.', 0x8a6ae8, true),
  a('secret_star_fall', 'Under the Starfall', 'secrets', 'starfall_survived', 1, 'Survive the starfall.', 0xfff0a0),
  a('secret_moonwell', 'The Well', 'secrets', 'moonwell_filled', 1, 'Fill the moonwell at the top of the world.', 0xc0d0ff),
  a('secret_end_gate', 'The Last Lock', 'secrets', 'end_gate_opened', 1, 'Open the End Gate.', 0x8a6ae8),
  a('secret_dragon_egg', 'The Egg', 'secrets', 'dragon_egg_found', 1, 'Find the dragon egg.', 0xc0c0d0, true),
  a('secret_world_heart', 'The Heart', 'secrets', 'world_heart_touched', 1, 'Touch the heart of the world.', 0xff3aa0),
  a('secret_vault_final', 'The Last Room', 'secrets', 'vault_final_room', 1, 'Enter the last room of the Eternity Vault.', 0xffe070, true),
  a('secret_fifty_achievements', 'Enough', 'secrets', 'achievements_unlocked', 50, 'Unlock 50 achievements.', 0xffe070),
];

export const ACHIEVEMENT_BY_ID: Map<string, AchievementDef> = new Map(ACHIEVEMENTS.map((x) => [x.id, x]));

export const ACHIEVEMENT_GROUPS: { id: AchievementGroup; label: string; color: number }[] = [
  { id: 'exploration', label: 'Exploration', color: 0x8ad0ff },
  { id: 'combat', label: 'Combat', color: 0xe05050 },
  { id: 'progression', label: 'Progression', color: 0xffe070 },
  { id: 'crafting', label: 'Crafting', color: 0xd0a060 },
  { id: 'social', label: 'Journey', color: 0x7ce8c0 },
  { id: 'secrets', label: 'Secrets', color: 0xb040e0 },
];

/** Titles, unlocked by quests and achievements. */
export interface TitleDef {
  id: string;
  name: string;
  description: string;
  color: number;
  /** Achievement id that grants it. */
  from: string;
}

export const TITLES: TitleDef[] = [
  { id: 'title_novice', name: 'Novice', description: 'Reached level 5.', color: 0xa0a0a8, from: 'prog_first_level' },
  { id: 'title_walker', name: 'Walker', description: 'Visited 10 regions.', color: 0x8ad0ff, from: 'explore_walker' },
  { id: 'title_slayer', name: 'Slayer', description: 'Defeat 100 enemies.', color: 0xe05050, from: 'combat_slayer' },
  { id: 'title_hero', name: 'Hero', description: 'Complete 10 quests.', color: 0x5ae070, from: 'prog_quest_first' },
  { id: 'title_warden', name: 'Warden of the Flames', description: 'Defeat the Nether Warden.', color: 0xe04020, from: 'combat_boss' },
  { id: 'title_twin', name: 'Twin Slayer', description: 'Defeat Verdega.', color: 0x5aa090, from: 'q_warped_twin' },
  { id: 'title_storm', name: 'Storm Cutter', description: 'Reach the top of the Cinderfall Peaks.', color: 0x8a8ad0, from: 'q_peaks_summit' },
  { id: 'title_crown', name: 'Crown Bearer', description: 'Claim the Broken Crown.', color: 0xffd060, from: 'q_crown_challenge' },
  { id: 'title_moon', name: 'Moonfall Keeper', description: 'Perform the Moonfall Rite.', color: 0xc0d0ff, from: 'q_moonfall_rite' },
  { id: 'title_well', name: 'Well Keeper', description: 'Fill the moonwell.', color: 0xc0d0ff, from: 'q_moonwell_deep' },
  { id: 'title_sovereign', name: 'Eternal Sovereign', description: 'End the war at the world core.', color: 0xffe070, from: 'q_core_finale' },
  { id: 'title_heart', name: 'World-Heart Bearer', description: 'Stand at the heart of the world.', color: 0xff3aa0, from: 'q_heart_of_world' },
];

export const TITLE_BY_FROM: Map<string, TitleDef> = new Map(TITLES.map((t) => [t.from, t]));
