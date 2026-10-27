/**
 * The hand-authored world map.
 *
 * Eternity's world is 384 x 384 blocks, divided into a 12 x 12 grid of 32 x 32
 * regions. Every one of the 144 cells below is written by hand: its name, its
 * biome, how high the ground sits, which structures are planted on it, which
 * enemies roam it, the level range it is balanced for, which quests reference it
 * and — for the ones that matter — a line of lore.
 *
 * There is no procedural continent generation. The terrain *heightfield* is
 * still computed from seeded noise so that hills and valleys look natural, but
 * every place a player is meant to go, every dungeon, every boss arena and every
 * settlement has a fixed address. Walking back to a place you remember finds it
 * exactly where you left it, which is what makes an open world feel like a world
 * rather than a generator.
 */

import type { BiomeDef } from './Biomes';
import { biome as lookupBiome } from './Biomes';

export interface RegionDef {
  /** Grid coordinates, 0..11. Region origin in world space is (gx*32, gz*32). */
  gx: number;
  gz: number;
  id: number;
  name: string;
  biome: string;
  /** Added to the biome's base height. */
  heightBias: number;
  /** True when the region is sunk below sea level. */
  ocean: boolean;
  /** Extra peak amplitude for mountain regions. */
  peaks: number;
  /** Structure ids placed inside the region. */
  features: string[];
  /** Enemy ids that can spawn here. */
  enemies: string[];
  /** Recommended player level range. */
  levelRange: [number, number];
  /** Music track index. */
  ambient: number;
  /** Quest ids that reference this region. */
  quests: string[];
  /** Short lore line, shown on the map and in the codex. */
  lore?: string;
  /** Spawn density multiplier (0 = peaceful). */
  spawn: number;
}

const START_REGION = { gx: 0, gz: 2 };

/**
 * Build a region row. The shorthand keeps 144 hand-written cells readable while
 * still forcing every field to be stated explicitly.
 */
function r(
  gx: number, gz: number, name: string, biome: string,
  heightBias: number, ocean: boolean, peaks: number,
  features: string[], enemies: string[], levelRange: [number, number],
  ambient: number, quests: string[],
  extra: Partial<RegionDef> = {}
): RegionDef {
  return {
    gx, gz,
    id: gz * 12 + gx,
    name, biome, heightBias, ocean, peaks,
    features, enemies, levelRange, ambient, quests,
    spawn: 1,
    ...extra,
  };
}

export const REGIONS: RegionDef[] = [
  // ------------------------------------------------------------------ row 0
  r(0, 0, 'Frostbound Shore', 'snow', 4, false, 6, ['camp', 'ruins'], ['wolf_hound', 'stray', 'husk'], [14, 22], 6, ['q_frost_promise']),
  r(1, 0, 'Highfrost Crag', 'snowy_mountain', 16, false, 14, ['mine', 'ruins'], ['wolf_hound', 'stray', 'cave_spider'], [18, 28], 6, []),
  r(2, 0, 'Glacial Shelf', 'ice', 8, false, 10, ['ruins'], ['stray', 'husk', 'phantom'], [22, 32], 6, ['q_frozen_heart']),
  r(3, 0, 'The Cold Sea', 'ocean', -10, true, 0, ['shipwreck'], ['drowned', 'squid', 'guardian'], [16, 26], 5, []),
  r(4, 0, 'Northwind Tundra', 'snow', 6, false, 8, ['camp', 'farmstead'], ['wolf_hound', 'stray', 'zombie'], [12, 20], 6, []),
  r(5, 0, 'Stormpeak', 'snowy_mountain', 22, false, 20, ['mine', 'shrine'], ['stray', 'cave_spider', 'silverfish'], [26, 36], 6, ['q_storm_caller'], { lore: 'The peak that drinks the storm.' }),
  r(6, 0, 'The Cold Sea', 'ocean', -12, true, 0, ['shipwreck', 'ruins'], ['drowned', 'guardian', 'squid'], [18, 28], 5, []),
  r(7, 0, 'Frostfang Ridge', 'snowy_mountain', 20, false, 18, ['mine', 'tower'], ['wolf_hound', 'stray', 'cave_spider'], [24, 34], 6, []),
  r(8, 0, 'Widow\'s Fen', 'swamp', -2, false, 4, ['swamp_hut', 'ruins'], ['witch', 'cave_spider', 'husk'], [20, 30], 4, ['q_witch_deal']),
  r(9, 0, 'The Cold Sea', 'ocean', -10, true, 0, ['shipwreck'], ['drowned', 'guardian'], [16, 26], 5, []),
  r(10, 0, 'Glacial Bay', 'ice', 6, false, 8, ['ruins', 'camp'], ['stray', 'husk', 'phantom'], [22, 32], 6, []),
  r(11, 0, 'Northern Arrow', 'snow', 4, false, 6, ['camp', 'watchtower'], ['wolf_hound', 'stray', 'zombie'], [12, 20], 6, []),

  // ------------------------------------------------------------------ row 1
  r(0, 1, 'Everfrost Plains', 'snow', 3, false, 5, ['farmstead', 'camp'], ['wolf_hound', 'stray', 'zombie'], [10, 18], 6, []),
  r(1, 1, 'Crags of Karrow', 'snowy_mountain', 14, false, 12, ['mine', 'ruins'], ['stray', 'cave_spider', 'silverfish'], [16, 26], 6, []),
  r(2, 1, 'Hoarfrost Vale', 'snow', 2, false, 6, ['village'], ['wolf_hound', 'stray', 'zombie'], [8, 16], 6, ['q_vale_blight']),
  r(3, 1, 'Shimmering Sea', 'ocean', -14, true, 0, ['shipwreck', 'ruins'], ['drowned', 'guardian', 'squid'], [14, 24], 5, []),
  r(4, 1, 'Wyrmrest Tundra', 'snow', 5, false, 7, ['camp', 'shrine'], ['wolf_hound', 'stray', 'husk'], [12, 22], 6, ['q_wyrm_wake']),
  r(5, 1, 'Aetherfall', 'magic', 6, false, 8, ['shrine', 'observatory'], ['arcane_warden', 'imp', 'vex'], [22, 34], 11, ['q_aether_crystal']),
  r(6, 1, 'The Pale Sea', 'ocean', -12, true, 0, ['shipwreck'], ['drowned', 'guardian'], [16, 26], 5, []),
  r(7, 1, 'Winter\'s Heart', 'snow', 4, false, 6, ['ruins', 'camp'], ['stray', 'husk', 'zombie'], [14, 24], 6, []),
  r(8, 1, 'Briarfen', 'swamp', -4, false, 4, ['swamp_hut'], ['witch', 'cave_spider', 'husk'], [18, 28], 4, []),
  r(9, 1, 'The Pale Sea', 'ocean', -10, true, 0, ['shipwreck', 'ruins'], ['drowned', 'guardian', 'phantom'], [16, 26], 5, []),
  r(10, 1, 'Frostweald', 'forest', 3, false, 5, ['village', 'farm'], ['wolf_hound', 'stray', 'skeleton'], [8, 16], 1, []),
  r(11, 1, 'Norhaven', 'snow', 2, false, 4, ['village', 'port'], ['wolf_hound', 'stray', 'zombie'], [6, 14], 6, ['q_norhaven_supplies']),

  // ------------------------------------------------------------------ row 2
  r(0, 2, 'Verdant Vale', 'plains', 0, false, 2, ['village_emberwake', 'farm', 'tutorial_pillar'], ['slime_wisp', 'boarling', 'bat'], [1, 6], 0, ['q_first_steps', 'q_vale_blight'], { spawn: 1.2 }),
  r(1, 2, 'Whispering Woods', 'forest', 1, false, 3, ['village', 'ruins'], ['boarling', 'wolf_hound', 'cave_spider'], [4, 12], 1, ['q_whispering_woods']),
  r(2, 2, 'Birch Hollow', 'birch_forest', 2, false, 3, ['farmstead', 'ruins'], ['boarling', 'slime_wisp', 'bat'], [3, 10], 1, []),
  r(3, 2, 'Coral Bay', 'beach', -2, false, 2, ['port', 'shipwreck'], ['drowned', 'squid', 'boarling'], [6, 14], 5, ['q_bay_lighthouse']),
  r(4, 2, 'Oldgrowth', 'forest', 2, false, 4, ['ruins', 'shrine'], ['boarling', 'wolf_hound', 'cave_spider'], [8, 16], 1, ['q_oldgrowth_heart']),
  r(5, 2, 'Arcane Glade', 'magic', 5, false, 6, ['shrine', 'tower'], ['imp', 'vex', 'arcane_warden'], [14, 24], 11, ['q_glade_secret']),
  r(6, 2, 'Shimmering Sea', 'ocean', -16, true, 0, ['shipwreck', 'ruins'], ['drowned', 'guardian', 'squid'], [10, 20], 5, []),
  r(7, 2, 'Golden Savanna', 'savanna', 0, false, 3, ['village', 'camp'], ['llama', 'boarling', 'stray'], [8, 16], 3, ['q_savanna_hunt']),
  r(8, 2, 'Marrowdeep Mire', 'swamp', -6, false, 4, ['swamp_hut', 'ruins'], ['witch', 'cave_spider', 'husk'], [12, 22], 4, ['q_mire_depths']),
  r(9, 2, 'Coral Reef', 'coral', -8, true, 0, ['ruins'], ['guardian', 'drowned', 'squid'], [10, 20], 5, []),
  r(10, 2, 'Shell Shore', 'beach', -2, false, 2, ['port', 'camp'], ['drowned', 'squid', 'boarling'], [6, 14], 5, []),
  r(11, 2, 'Driftwood Coast', 'beach', -1, false, 2, ['village', 'shipwreck'], ['drowned', 'boarling', 'squid'], [5, 13], 5, []),

  // ------------------------------------------------------------------ row 3
  r(0, 3, 'Emberwake Shore', 'beach', -1, false, 2, ['village_emberwake', 'port'], ['boarling', 'slime_wisp', 'drowned'], [3, 10], 0, ['q_first_steps'], { spawn: 1.2 }),
  r(1, 3, 'Verdant Plains', 'plains', 0, false, 2, ['farm', 'camp'], ['boarling', 'slime_wisp', 'bat'], [4, 12], 0, []),
  r(2, 3, 'Sunlit Glade', 'glade', 1, false, 2, ['village', 'shrine'], ['boarling', 'slime_wisp', 'wolf_hound'], [5, 13], 0, ['q_glade_wish']),
  r(3, 3, 'Shell-Swept Shore', 'beach', -3, false, 2, ['port', 'ruins'], ['drowned', 'squid', 'guardian'], [8, 16], 5, []),
  r(4, 3, 'Whispering Grove', 'forest', 2, false, 4, ['ruins', 'shrine'], ['boarling', 'wolf_hound', 'cave_spider'], [8, 16], 1, []),
  r(5, 3, 'Crystal Meadow', 'magic', 4, false, 5, ['shrine', 'observatory'], ['imp', 'vex', 'arcane_warden'], [14, 24], 11, ['q_crystal_meadow']),
  r(6, 3, 'The Shallows', 'ocean', -14, true, 0, ['shipwreck'], ['drowned', 'guardian', 'squid'], [10, 20], 5, []),
  r(7, 3, 'Acacia Mesa', 'savanna_plateau', 8, false, 6, ['village', 'ruins'], ['llama', 'boarling', 'stray'], [12, 22], 3, []),
  r(8, 3, 'Bogside', 'swamp', -5, false, 4, ['swamp_hut'], ['witch', 'cave_spider', 'husk'], [14, 24], 4, []),
  r(9, 3, 'The Shallows', 'ocean', -12, true, 0, ['shipwreck', 'ruins'], ['drowned', 'guardian'], [10, 20], 5, []),
  r(10, 3, 'Tidewatch', 'beach', -2, false, 2, ['port', 'watchtower'], ['drowned', 'squid', 'guardian'], [8, 16], 5, ['q_tidewatch_light']),
  r(11, 3, 'Coral Cays', 'coral', -6, true, 0, ['ruins', 'shipwreck'], ['guardian', 'drowned', 'squid'], [10, 20], 5, []),

  // ------------------------------------------------------------------ row 4
  r(0, 4, 'Sun-Baked Dunes', 'desert', 0, false, 3, ['village', 'ruins'], ['stray', 'husk', 'boarling'], [12, 20], 3, ['q_dunes_caravan']),
  r(1, 4, 'Golden Savanna', 'savanna', 0, false, 3, ['camp', 'farm'], ['llama', 'boarling', 'stray'], [10, 18], 3, []),
  r(2, 4, 'Windswept Steppe', 'windswept', 2, false, 4, ['ruins', 'camp'], ['stray', 'husk', 'wolf_hound'], [12, 20], 0, []),
  r(3, 4, 'Dune Sea', 'desert', -1, false, 3, ['ruins', 'mine'], ['stray', 'husk', 'cave_spider'], [14, 22], 3, ['q_dune_tomb']),
  r(4, 4, 'Verdant Plains', 'plains', 1, false, 3, ['village', 'farm'], ['boarling', 'slime_wisp', 'wolf_hound'], [8, 16], 0, []),
  r(5, 4, 'Aether Vale', 'magic', 5, false, 6, ['shrine', 'tower'], ['imp', 'vex', 'arcane_warden'], [18, 28], 11, ['q_aether_vale']),
  r(6, 4, 'The Open Sea', 'ocean', -18, true, 0, ['shipwreck', 'ruins'], ['drowned', 'guardian', 'squid'], [14, 24], 5, []),
  r(7, 4, 'Ochre Badlands', 'badlands', 4, false, 8, ['mine', 'ruins'], ['stray', 'husk', 'cave_spider'], [18, 28], 3, ['q_badlands_ore']),
  r(8, 4, 'Mirefen', 'swamp', -7, false, 4, ['swamp_hut', 'ruins'], ['witch', 'cave_spider', 'husk'], [16, 26], 4, []),
  r(9, 4, 'The Open Sea', 'ocean', -16, true, 0, ['shipwreck'], ['drowned', 'guardian'], [14, 24], 5, []),
  r(10, 4, 'Sandy Reach', 'desert', 0, false, 3, ['camp', 'ruins'], ['stray', 'husk', 'boarling'], [14, 22], 3, []),
  r(11, 4, 'Reef Holm', 'coral', -5, true, 0, ['ruins'], ['guardian', 'drowned', 'squid'], [12, 22], 5, []),

  // ------------------------------------------------------------------ row 5
  r(0, 5, 'Dunecrest', 'desert', 2, false, 5, ['mine', 'ruins'], ['stray', 'husk', 'cave_spider'], [18, 28], 3, []),
  r(1, 5, 'Acacia Savanna', 'savanna', 1, false, 4, ['village', 'camp'], ['llama', 'boarling', 'stray'], [14, 22], 3, []),
  r(2, 5, 'Golden Plains', 'savanna', 0, false, 3, ['farm', 'ruins'], ['llama', 'boarling', 'stray'], [12, 20], 3, []),
  r(3, 5, 'Dust Wastes', 'desert', -2, false, 4, ['mine', 'ruins'], ['stray', 'husk', 'cave_spider'], [20, 30], 3, ['q_dust_tempest']),
  r(4, 5, 'Windswept Steppe', 'windswept', 3, false, 5, ['ruins', 'camp'], ['stray', 'husk', 'wolf_hound'], [16, 26], 0, []),
  r(5, 5, 'Ancient Ruins', 'ancient', 2, false, 6, ['dungeon_crawler', 'ruins'], ['skeleton', 'cave_spider', 'stray'], [22, 32], 7, ['q_ruins_awakening']),
  r(6, 5, 'The Deep Sea', 'deep_ocean', -24, true, 0, ['shipwreck', 'ruins'], ['drowned', 'guardian', 'phantom'], [18, 30], 5, []),
  r(7, 5, 'Cinderfall Foothills', 'mountain', 10, false, 10, ['mine', 'village'], ['stray', 'cave_spider', 'silverfish'], [24, 34], 7, ['q_foothills_ore']),
  r(8, 5, 'Grove of Whispers', 'forest', 3, false, 5, ['shrine', 'ruins'], ['wolf_hound', 'cave_spider', 'witch'], [20, 30], 1, ['q_grove_spirit']),
  r(9, 5, 'The Deep Sea', 'deep_ocean', -22, true, 0, ['shipwreck'], ['drowned', 'guardian'], [18, 30], 5, []),
  r(10, 5, 'Dune Hollow', 'desert', 0, false, 4, ['mine', 'ruins'], ['stray', 'husk', 'cave_spider'], [20, 30], 3, []),
  r(11, 5, 'Coral Shoals', 'coral', -4, true, 0, ['ruins'], ['guardian', 'drowned', 'squid'], [16, 28], 5, []),

  // ------------------------------------------------------------------ row 6
  r(0, 6, 'Basalt Reach', 'volcanic', 8, false, 12, ['mine', 'ruins'], ['blaze', 'magma_cube', 'stray'], [28, 40], 8, ['q_basalt_forge']),
  r(1, 6, 'Ember Crag', 'volcanic', 10, false, 14, ['dungeon_blaze', 'mine'], ['blaze', 'magma_cube', 'ghast'], [30, 42], 8, ['q_crag_heart']),
  r(2, 6, 'Cinderfall Peaks', 'mountain', 18, false, 20, ['mine', 'shrine'], ['stray', 'cave_spider', 'silverfish'], [30, 42], 7, ['q_peaks_summit']),
  r(3, 6, 'Ashen Ridge', 'volcanic', 9, false, 13, ['ruins', 'mine'], ['blaze', 'stray', 'magma_cube'], [28, 40], 8, []),
  r(4, 6, 'Highlands', 'mountain', 14, false, 16, ['village', 'mine'], ['stray', 'cave_spider', 'wolf_hound'], [26, 38], 7, []),
  r(5, 6, 'Ruined Citadel', 'ancient', 4, false, 8, ['dungeon_citadel', 'ruins'], ['skeleton', 'pillager', 'vex'], [30, 42], 7, ['q_citadel_fall']),
  r(6, 6, 'The Abyss', 'deep_ocean', -30, true, 0, ['shipwreck', 'ruins'], ['drowned', 'guardian', 'phantom'], [24, 38], 5, []),
  r(7, 6, 'Cinderfall Peaks', 'mountain', 20, false, 22, ['mine', 'shrine', 'boss_arena_ember'], ['stray', 'cave_spider', 'blaze'], [34, 46], 7, ['q_peaks_summit'], { lore: 'Where the mountain was born.' }),
  r(8, 6, 'Frostbite Ridge', 'snowy_mountain', 16, false, 18, ['mine', 'ruins'], ['stray', 'cave_spider', 'husk'], [30, 42], 6, []),
  r(9, 6, 'The Abyss', 'deep_ocean', -28, true, 0, ['shipwreck'], ['drowned', 'guardian'], [24, 38], 5, []),
  r(10, 6, 'Ember Wash', 'volcanic', 7, false, 10, ['mine', 'ruins'], ['blaze', 'stray', 'magma_cube'], [28, 40], 8, []),
  r(11, 6, 'Coral Wall', 'coral', -3, true, 0, ['ruins'], ['guardian', 'drowned'], [20, 32], 5, []),

  // ------------------------------------------------------------------ row 7
  r(0, 7, 'Hollow Depths', 'netherrack', 0, false, 6, ['nether_fortress', 'ruins'], ['ghast', 'blaze', 'piglin'], [42, 55], 9, ['q_hollow_depths']),
  r(1, 7, 'Crimson Wastes', 'crimson', 0, false, 5, ['nether_fortress', 'ruins'], ['hoglin', 'piglin', 'blaze'], [44, 56], 9, ['q_crimson_war'], { lore: 'The forest that burned forever.' }),
  r(2, 7, 'Ashen Crag', 'volcanic', 6, false, 10, ['mine', 'dungeon_blaze'], ['blaze', 'magma_cube', 'ghast'], [40, 52], 8, []),
  r(3, 7, 'Nether Gate', 'netherrack', -2, false, 4, ['portal', 'ruins'], ['ghast', 'blaze', 'wither_skeleton'], [46, 58], 9, ['q_nether_gate']),
  r(4, 7, 'The Hollow Depths', 'netherrack', 0, false, 6, ['nether_fortress', 'mine'], ['ghast', 'blaze', 'piglin'], [42, 54], 9, []),
  r(5, 7, 'Warped Grove', 'warped', 0, false, 4, ['ruins', 'shrine'], ['evoker', 'vex', 'shulker'], [48, 60], 9, ['q_warped_grove']),
  r(6, 7, 'The Hollow Sea', 'netherrack', -4, false, 4, ['ruins', 'nether_fortress'], ['ghast', 'blaze', 'wither_skeleton'], [44, 56], 9, []),
  r(7, 7, 'Crimson Expanse', 'crimson', 1, false, 5, ['nether_fortress', 'ruins'], ['hoglin', 'piglin', 'blaze'], [46, 58], 9, []),
  r(8, 7, 'Emberfall', 'volcanic', 8, false, 12, ['mine', 'dungeon_blaze'], ['blaze', 'magma_cube', 'ghast'], [42, 54], 8, ['q_emberfall_core']),
  r(9, 7, 'Warped Fen', 'warped', -1, false, 4, ['ruins', 'shrine'], ['evoker', 'vex', 'shulker'], [48, 60], 9, []),
  r(10, 7, 'The Hollow Depths', 'netherrack', 0, false, 6, ['nether_fortress'], ['ghast', 'blaze', 'piglin'], [44, 56], 9, []),
  r(11, 7, 'Crimson Shore', 'crimson', -2, false, 4, ['ruins', 'portal'], ['hoglin', 'piglin', 'ghast'], [46, 58], 9, []),

  // ------------------------------------------------------------------ row 8
  r(0, 8, 'The Hollow Depths', 'netherrack', 0, false, 6, ['nether_fortress', 'mine'], ['ghast', 'blaze', 'piglin'], [50, 62], 9, []),
  r(1, 8, 'Crimson Reach', 'crimson', 1, false, 5, ['nether_fortress', 'ruins'], ['hoglin', 'piglin', 'blaze'], [52, 64], 9, []),
  r(2, 8, 'Nether Fortress', 'netherrack', -1, false, 4, ['nether_fortress', 'boss_arena_fortress'], ['ghast', 'blaze', 'wither_skeleton'], [56, 70], 9, ['q_fortress_warden']),
  r(3, 8, 'Warped Wastes', 'warped', 0, false, 4, ['ruins', 'shrine'], ['evoker', 'vex', 'shulker'], [54, 66], 9, []),
  r(4, 8, 'The Hollow Depths', 'netherrack', 0, false, 6, ['nether_fortress'], ['ghast', 'blaze', 'piglin'], [50, 62], 9, []),
  r(5, 8, 'Warped Grove', 'warped', 0, false, 4, ['ruins', 'boss_arena_warped'], ['evoker', 'vex', 'shulker'], [58, 72], 9, ['q_warped_twin']),
  r(6, 8, 'Crimson Hollow', 'crimson', -1, false, 4, ['nether_fortress', 'ruins'], ['hoglin', 'piglin', 'blaze'], [54, 66], 9, []),
  r(7, 8, 'The Hollow Depths', 'netherrack', 0, false, 6, ['nether_fortress', 'mine'], ['ghast', 'blaze', 'wither_skeleton'], [52, 64], 9, []),
  r(8, 8, 'Ember Rift', 'volcanic', 9, false, 14, ['mine', 'dungeon_blaze'], ['blaze', 'magma_cube', 'ghast'], [50, 62], 8, ['q_rift_magma']),
  r(9, 8, 'Warped Thicket', 'warped', 0, false, 4, ['ruins', 'shrine'], ['evoker', 'vex', 'shulker'], [56, 68], 9, []),
  r(10, 8, 'The Hollow Depths', 'netherrack', 0, false, 6, ['nether_fortress'], ['ghast', 'blaze', 'piglin'], [52, 64], 9, []),
  r(11, 8, 'Crimson Cliffs', 'crimson', 2, false, 6, ['ruins', 'portal'], ['hoglin', 'piglin', 'ghast'], [54, 66], 9, []),

  // ------------------------------------------------------------------ row 9
  r(0, 9, 'Verdant Sanctum', 'verdant', 4, false, 8, ['shrine', 'village'], ['arcane_warden', 'crystal_golem', 'imp'], [66, 78], 12, ['q_sanctum_keeper']),
  r(1, 9, 'Eldritch Rift', 'eldritch', 2, false, 8, ['ruins', 'dungeon_eldritch'], ['wraith', 'banshee', 'wight'], [70, 82], 13, ['q_rift_unbound'], { lore: 'A scar in the world that will not close.' }),
  r(2, 9, 'The Void Expanse', 'void', 0, false, 5, ['ruins'], ['void_wraith', 'cursed', 'spectral'], [72, 84], 14, ['q_void_echo']),
  r(3, 9, 'Eternity Spires', 'end', 8, false, 14, ['ruins', 'end_gate'], ['enderman', 'shulker', 'wither_skeleton'], [74, 86], 10, ['q_spires_rise']),
  r(4, 9, 'Crystal Wastes', 'magic', 6, false, 10, ['shrine', 'mine'], ['crystal_golem', 'arcane_warden', 'imp'], [68, 80], 11, ['q_crystal_waste']),
  r(5, 9, 'Arcane Reach', 'magic', 7, false, 10, ['shrine', 'tower'], ['arcane_warden', 'vex', 'crystal_golem'], [70, 82], 11, ['q_arcane_reach']),
  r(6, 9, 'Eternity Gate', 'end', 10, false, 16, ['end_gate', 'ruins'], ['enderman', 'shulker', 'eternity_guardian'], [80, 92], 10, ['q_gate_warden']),
  r(7, 9, 'The Void Expanse', 'void', 0, false, 5, ['ruins'], ['void_wraith', 'cursed', 'spectral'], [74, 86], 14, []),
  r(8, 9, 'Eldritch Scar', 'eldritch', 3, false, 9, ['dungeon_eldritch', 'ruins'], ['wraith', 'banshee', 'bloodmote'], [72, 84], 13, ['q_scar_bleed']),
  r(9, 9, 'Starfall Plateau', 'magic', 9, false, 12, ['shrine', 'observatory'], ['arcane_warden', 'crystal_golem', 'vex'], [76, 88], 11, ['q_starfall_meteor']),
  r(10, 9, 'Voidscar', 'void', 0, false, 6, ['ruins'], ['void_wraith', 'cursed', 'spectral'], [76, 88], 14, []),
  r(11, 9, 'Eternity Heights', 'end', 12, false, 18, ['ruins', 'spire'], ['enderman', 'eternity_guardian', 'shulker'], [82, 94], 10, ['q_heights_apex']),

  // ------------------------------------------------------------------ row 10
  r(0, 10, 'Verdant Heart', 'verdant', 5, false, 9, ['shrine', 'boss_arena_verdant'], ['arcane_warden', 'crystal_golem', 'verdant_heart'], [80, 92], 12, ['q_heart_bloom']),
  r(1, 10, 'Eldritch Glen', 'eldritch', 3, false, 9, ['ruins', 'shrine'], ['wraith', 'banshee', 'bloodmote'], [78, 90], 13, []),
  r(2, 10, 'The Void', 'void', -1, false, 5, ['ruins'], ['void_wraith', 'cursed', 'spectral'], [80, 92], 14, []),
  r(3, 10, 'Eternity Basin', 'end', 11, false, 16, ['ruins', 'spire'], ['enderman', 'eternity_guardian', 'shulker'], [84, 96], 10, ['q_basin_crystal']),
  r(4, 10, 'Moonfall Glade', 'magic', 8, false, 11, ['shrine', 'observatory'], ['arcane_warden', 'crystal_golem', 'vex'], [82, 94], 11, ['q_moonfall_rite']),
  r(5, 10, 'Astral Meadow', 'magic', 8, false, 11, ['shrine', 'ruins'], ['arcane_warden', 'vex', 'crystal_golem'], [80, 92], 11, []),
  r(6, 10, 'Eternity Vault', 'end', 13, false, 20, ['spire', 'end_gate', 'boss_arena_eternity'], ['eternity_guardian', 'enderman', 'shulker'], [90, 100], 10, ['q_vault_opened']),
  r(7, 10, 'The Void', 'void', -1, false, 5, ['ruins'], ['void_wraith', 'cursed', 'spectral'], [82, 94], 14, []),
  r(8, 10, 'Eldritch Hollow', 'eldritch', 4, false, 10, ['dungeon_eldritch', 'ruins'], ['wraith', 'banshee', 'bloodmote'], [80, 92], 13, []),
  r(9, 10, 'Stardrift Plain', 'magic', 10, false, 13, ['shrine', 'observatory'], ['arcane_warden', 'crystal_golem', 'vex'], [84, 96], 11, []),
  r(10, 10, 'Voidreach', 'void', 0, false, 6, ['ruins'], ['void_wraith', 'cursed', 'spectral'], [84, 96], 14, []),
  r(11, 10, 'Eternity Crown', 'end', 15, false, 24, ['spire', 'boss_arena_eternity'], ['eternity_guardian', 'enderman', 'wither'], [94, 100], 10, ['q_crown_challenge']),

  // ------------------------------------------------------------------ row 11
  r(0, 11, 'Verdant Edge', 'verdant', 4, false, 8, ['shrine', 'ruins'], ['arcane_warden', 'crystal_golem', 'verdant_heart'], [86, 96], 12, []),
  r(1, 11, 'Eldritch Vale', 'eldritch', 4, false, 10, ['ruins', 'boss_arena_eldritch'], ['wraith', 'banshee', 'eldritch_heart'], [88, 98], 13, ['q_vale_oblivion']),
  r(2, 11, 'Voidscar Rim', 'void', 0, false, 6, ['ruins'], ['void_wraith', 'cursed', 'spectral'], [88, 98], 14, []),
  r(3, 11, 'Eternity Reach', 'end', 14, false, 22, ['spire', 'ruins'], ['eternity_guardian', 'enderman', 'shulker'], [92, 100], 10, ['q_reach_final'], { lore: 'The last land before the core.' }),
  r(4, 11, 'Astral Reach', 'magic', 10, false, 14, ['shrine', 'observatory'], ['arcane_warden', 'crystal_golem', 'vex'], [90, 100], 11, []),
  r(5, 11, 'Moonwell', 'magic', 9, false, 12, ['shrine', 'boss_arena_arcane'], ['arcane_warden', 'vex', 'arcane_twin'], [92, 100], 11, ['q_moonwell_deep']),
  r(6, 11, 'The Eternity Core', 'end', 16, false, 28, ['spire', 'boss_arena_eternity', 'end_gate'], ['eternity_guardian', 'wither', 'ender_dragon'], [96, 100], 10, ['q_core_awakening', 'q_core_finale'], { lore: 'The heart of the world, still beating.' }),
  r(7, 11, 'Voidscar Edge', 'void', 0, false, 6, ['ruins'], ['void_wraith', 'cursed', 'spectral'], [90, 100], 14, []),
  r(8, 11, 'Eldritch Vale', 'eldritch', 5, false, 11, ['ruins', 'dungeon_eldritch'], ['wraith', 'banshee', 'eldritch_heart'], [88, 98], 13, []),
  r(9, 11, 'Starfall Crater', 'magic', 12, false, 16, ['shrine', 'observatory', 'boss_arena_starfall'], ['arcane_warden', 'crystal_golem', 'starfall_titan'], [94, 100], 11, ['q_crater_impact']),
  r(10, 11, 'Voidscar', 'void', 0, false, 7, ['ruins'], ['void_wraith', 'cursed', 'spectral'], [92, 100], 14, []),
  r(11, 11, 'The World Heart', 'end', 18, false, 32, ['spire', 'boss_arena_eternity', 'end_gate'], ['eternity_guardian', 'ender_dragon', 'wither'], [98, 100], 10, ['q_heart_of_world'], { lore: 'Where the story ends, and begins.' }),
];

export const REGION_BY_ID: Map<number, RegionDef> = new Map(REGIONS.map((r) => [r.id, r]));

/** Region covering a world-space block coordinate. */
export function regionAt(x: number, z: number): RegionDef {
  const gx = Math.floor(x / 32);
  const gz = Math.floor(z / 32);
  const id = gz * 12 + gx;
  return REGION_BY_ID.get(id) ?? REGIONS[0];
}

/** World size in blocks. */
export const WORLD_SIZE = 384;
export const REGION_SIZE = 32;
export const REGION_GRID = 12;
export const WORLD_HEIGHT = 128;

/** The region the player starts in. */
export const START_REGION_DEF: RegionDef = REGIONS.find((r) => r.gx === START_REGION.gx && r.gz === START_REGION.gz)!;

export function regionOf(x: number, z: number): RegionDef {
  return regionAt(x, z);
}

/** Every region a quest may send the player to. */
export function regionsForQuest(questId: string): RegionDef[] {
  return REGIONS.filter((r) => r.quests.includes(questId));
}

export function biomeOfRegion(region: RegionDef): BiomeDef {
  return lookupBiome(region.biome);
}

/** All distinct biome ids used by the map. */
export const USED_BIOMES: string[] = Array.from(new Set(REGIONS.map((r) => r.biome)));
