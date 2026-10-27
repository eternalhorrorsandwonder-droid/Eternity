/**
 * Quests.
 *
 * Sixty hand-authored chains. Every region's `quests` list is satisfied here,
 * and every quest points at a real place — a region, a structure, an enemy or a
 * tile — so the objective text can be specific instead of "collect 10 things".
 *
 * Prerequisites form a loose web rather than a wall: the mainline runs from the
 * tutorial to the World Heart, and the regional chains slot in beside it. A
 * player who wanders into the Frostbound Shore at level 5 and does the local
 * chain is never punished for it; they are rewarded for it.
 *
 * Region ids are the numeric ids assigned in `Regions.ts` (gz * 12 + gx).
 */

export type ObjectiveKind =
  | 'kill' | 'boss' | 'gather' | 'craft' | 'reach' | 'explore'
  | 'talk' | 'use' | 'place' | 'survive' | 'find';

export interface QuestObjective {
  kind: ObjectiveKind;
  /** Enemy id, item id, region name, structure id or tile id. */
  target: string;
  count: number;
  text: string;
}

export interface QuestReward {
  xp: number;
  coins: number;
  items: [number, number][];
  /** Skill points granted on completion. */
  skillPoints?: number;
  /** Title unlocked on completion. */
  title?: string;
}

export interface QuestDef {
  id: string;
  name: string;
  tier: number;
  /** The region id this quest is centered on, or -1 for global quests. */
  region: number;
  description: string;
  /** Who gives the quest. */
  giver: string;
  prerequisites: string[];
  objectives: QuestObjective[];
  rewards: QuestReward;
  lore: string;
  /** True when completing this quest unlocks a boss arena. */
  gatesBoss?: string;
  /** True when this quest is part of the mainline chain. */
  mainline?: boolean;
}

const obj = (kind: ObjectiveKind, target: string, count: number, text: string): QuestObjective =>
  ({ kind, target, count, text });

/** Region names, so an `explore` objective reads as a place rather than an index. */
const R = {
  frostbound: 'Frostbound Shore',
  glacial: 'Glacial Shelf',
  stormpeak: 'Stormpeak',
  norhaven: 'Norhaven',
  tidewatch: 'Tidewatch',
  vale: 'Verdant Vale',
  whispering: 'Whispering Woods',
  bay: 'Coral Bay',
  oldgrowth: 'Oldgrowth',
  arcaneGlade: 'Arcane Glade',
  glade: 'Sunlit Glade',
  savanna: 'Golden Savanna',
  mire: 'Marrowdeep Mire',
  crystal: 'Crystal Meadow',
  dunes: 'Sun-Baked Dunes',
  duneHollow: 'Dune Hollow',
  aether: 'Aether Vale',
  badlands: 'Ochre Badlands',
  dust: 'Dust Wastes',
  ruins: 'Ancient Ruins',
  foothills: 'Cinderfall Foothills',
  grove: 'Grove of Whispers',
  basalt: 'Basalt Reach',
  crag: 'Ember Crag',
  peaks: 'Cinderfall Peaks',
  citadel: 'Ruined Citadel',
  hollow: 'Hollow Depths',
  crimson: 'Crimson Wastes',
  netherGate: 'Nether Gate',
  warped: 'Warped Grove',
  rift: 'Ember Rift',
  sanctum: 'Verdant Sanctum',
  eldritch: 'Eldritch Rift',
  void: 'The Void Expanse',
  spires: 'Eternity Spires',
  waste: 'Crystal Wastes',
  reach: 'Arcane Reach',
  endGate: 'Eternity Gate',
  scar: 'Eldritch Scar',
  starfall: 'Starfall Plateau',
  heart: 'Verdant Heart',
  basin: 'Eternity Basin',
  moonfall: 'Moonfall Glade',
  vault: 'Eternity Vault',
  crown: 'Eternity Crown',
  final: 'Eternity Reach',
  moonwell: 'Moonwell',
  core: 'The Eternity Core',
  worldHeart: 'The World Heart',
  crater: 'Starfall Crater',
  bogside: 'Bogside',
  heights: 'Cinderfall Peaks',
};

function q(
  id: string, name: string, tier: number, region: number, description: string,
  giver: string, prerequisites: string[], objectives: QuestObjective[],
  rewards: QuestReward, lore: string, extra: Partial<QuestDef> = {}
): QuestDef {
  return { id, name, tier, region, description, giver, prerequisites, objectives, rewards, lore, ...extra };
}

export const QUESTS: QuestDef[] = [
  // --------------------------------------------------------------- tutorial
  q('q_first_steps', 'The First Steps', 1, 24, 'Learn to move, strike and gather.', 'The First Pillar',
    [],
    [obj('explore', R.vale, 1, 'Stand at the First Pillar'),
     obj('gather', '1004', 8, 'Gather 8 wooden planks'),
     obj('kill', 'slime_wisp', 3, 'Defeat 3 Slime Wisps'),
     obj('craft', '1022', 1, 'Craft a Wooden Sword')],
    { xp: 60, coins: 10, items: [[1022, 1], [1004, 4], [1006, 8]], skillPoints: 1 },
    'The pillar does not speak. It only stands, and it has stood longer than anyone living.',
    { mainline: true }),

  q('q_vale_blight', 'The Blight in the Vale', 3, 24, 'Something is killing the trees east of the start.', 'Villager Mara',
    ['q_first_steps'],
    [obj('kill', 'cave_spider', 6, 'Defeat 6 Cave Spiders'),
     obj('find', '1084', 1, 'Find the blighted core'),
     obj('kill', 'wraith', 2, 'Defeat the blight carrier')],
    { xp: 140, coins: 24, items: [[1003, 1], [1001, 1]], skillPoints: 1 },
    'The core in your hand is warm. It is not a seed.'),

  q('q_whispering_woods', 'The Whispering Woods', 4, 25, 'The woods are talking. Answer them.', 'Hermit Ravn',
    ['q_first_steps'],
    [obj('explore', R.whispering, 1, 'Enter the Whispering Woods'),
     obj('gather', '1004', 16, 'Gather 16 oak planks'),
     obj('kill', 'wolf_hound', 4, 'Defeat 4 Wolf Hounds'),
     obj('talk', 'village', 1, 'Return to the village with the wood')],
    { xp: 200, coins: 32, items: [[1024, 1], [1016, 1]], skillPoints: 1 },
    'Ravn says the woods do not whisper. They listen.'),

  q('q_bay_lighthouse', 'The Bay Lighthouse', 4, 27, 'A ship went out in the storm and did not come back. Light the lamp.', 'Keeper Otho',
    ['q_first_steps'],
    [obj('reach', 'port', 1, 'Reach the bay port'),
     obj('gather', '11', 16, 'Gather 16 clay'),
     obj('gather', '60', 12, 'Gather 12 oak planks'),
     obj('use', '108', 1, 'Place and light the furnace in the lighthouse')],
    { xp: 240, coins: 40, items: [[1109, 1], [1031, 4]], skillPoints: 1 },
    'Otho has not slept in eleven days. He does not remember why he stopped.'),

  q('q_oldgrowth_heart', 'The Oldgrowth Heart', 8, 28, 'The forest at the centre of the grove is dying. Find out why.', 'Druid Isel',
    ['q_whispering_woods'],
    [obj('explore', R.oldgrowth, 1, 'Enter the Oldgrowth'),
     obj('kill', 'husk', 8, 'Defeat 8 Husks'),
     obj('boss', 'boss_verdant', 1, 'Defeat the Verdant Heart')],
    { xp: 620, coins: 90, items: [[1080, 8], [1083, 1]], skillPoints: 2, title: 'Heart of the Grove' },
    'The heart was never a monster. It was a caretaker.',
    { gatesBoss: 'boss_verdant', mainline: true }),

  q('q_glade_secret', 'The Glade Secret', 5, 38, 'There is a shrine under the old tree. Open it.', 'Hermit Ravn',
    ['q_whispering_woods'],
    [obj('find', 'shrine', 1, 'Find a shrine in the glade'),
     obj('gather', '138', 8, 'Gather 8 iron ore'),
     obj('use', '173', 1, 'Set the End portal frame in the shrine')],
    { xp: 320, coins: 48, items: [[1082, 1], [1082, 1]], skillPoints: 1 },
    'The shrine was not built for you. It was built for whoever came after the first king.'),

  q('q_glade_wish', 'The Glade Wish', 7, 29, 'A child in the village wants to see a star fall.', 'Villager Mara',
    ['q_glade_secret'],
    [obj('gather', '1078', 3, 'Gather 3 moonstones'),
     obj('survive', R.glade, 180, 'Survive 3 minutes in the glade at night'),
     obj('find', '1077', 2, 'Find 2 star fragments')],
    { xp: 480, coins: 70, items: [[1077, 2], [1079, 4]], skillPoints: 1 },
    'The child gets the star. You get the wish.'),

  q('q_savanna_hunt', 'The Savanna Hunt', 8, 31, 'Something has been taking the herds. Hunt it.', 'Hunter Vadi',
    ['q_oldgrowth_heart'],
    [obj('kill', 'boarling', 5, 'Defeat 5 Boarlings'),
     obj('kill', 'llama', 4, 'Defeat 4 Llamas'),
     obj('kill', 'wolf_hound', 5, 'Defeat 5 Wolf Hounds')],
    { xp: 540, coins: 80, items: [[1212, 16], [1044, 4]], skillPoints: 1 },
    'Vadi gives you the skin and keeps the teeth.'),

  q('q_mire_depths', 'The Mire Depths', 10, 32, 'The swamp hut holds something that should not be kept.', 'Swamp hermit Cor',
    ['q_savanna_hunt'],
    [obj('explore', R.mire, 1, 'Enter the Marrowdeep Mire'),
     obj('find', 'swamp_hut', 1, 'Find the swamp hut'),
     obj('kill', 'drowned', 6, 'Defeat 6 Drowned'),
     obj('find', '1053', 3, 'Find 3 ender pearls')],
    { xp: 700, coins: 100, items: [[1053, 3], [1060, 4]], skillPoints: 1 },
    'Cor says the thing was not found. It was planted.'),

  q('q_crystal_meadow', 'The Crystal Meadow', 11, 41, 'A meadow of blue crystals has grown over the old road. Gather it.', 'Miner Tobin',
    ['q_savanna_hunt'],
    [obj('explore', R.crystal, 1, 'Enter the Crystal Meadow'),
     obj('gather', '163', 12, 'Gather 12 blue crystal'),
     obj('kill', 'crystal_golem', 2, 'Defeat 2 Crystal Golems')],
    { xp: 820, coins: 120, items: [[163, 12], [1033, 2]], skillPoints: 1 },
    'The golems do not defend the meadow. They guard what is beneath it.'),

  q('q_dunes_caravan', 'The Dunes Caravan', 12, 48, 'A caravan is stuck in the dunes. Get it moving.', 'Caravan master Halim',
    ['q_mire_depths'],
    [obj('reach', 'port', 1, 'Reach the dunes port'),
     obj('kill', 'pillager', 8, 'Defeat 8 Pillagers'),
     obj('gather', '7', 32, 'Gather 32 sand'),
     obj('use', '190', 1, 'Pour water on the caravan wheels')],
    { xp: 900, coins: 140, items: [[1032, 4], [7, 16]], skillPoints: 1 },
    'Halim counts his wares twice. The second count is always smaller.'),

  q('q_dune_tomb', 'The Dune Tomb', 14, 70, 'An ancient tomb lies under the sands. Open it.', 'Archaeologist Vey',
    ['q_dunes_caravan'],
    [obj('find', 'ruins', 1, 'Find the tomb entrance'),
     obj('gather', '126', 8, 'Gather 8 bedrock'),
     obj('use', '1548', 1, 'Use the Ancient Tomb Key'),
     obj('find', '1085', 1, 'Claim the Broken Crown')],
    { xp: 1200, coins: 180, items: [[1085, 1], [1033, 4]], skillPoints: 2, title: 'Tomb Opener' },
    'The crown was placed there by the king himself. He wanted it back.'),

  q('q_aether_vale', 'The Aether Vale', 15, 53, 'The sky above the vale is wrong. Fix it.', 'Aether scholar Neris',
    ['q_dune_tomb'],
    [obj('explore', R.aether, 1, 'Enter the Aether Vale'),
     obj('kill', 'phantom', 6, 'Defeat 6 Phantoms'),
     obj('find', 'observatory', 1, 'Reach the observatory'),
     obj('find', '1077', 4, 'Collect 4 star fragments')],
    { xp: 1400, coins: 200, items: [[1077, 4], [1079, 8]], skillPoints: 1 },
    'Neris says the sky is not wrong. It is missing a piece.'),

  q('q_aether_crystal', 'The Aether Crystal', 15, 53, 'A crystal in the aether vale sings the sky back into place.', 'Aether scholar Neris',
    ['q_aether_vale'],
    [obj('find', '163', 1, 'Find the aether crystal'),
     obj('gather', '163', 16, 'Gather 16 blue crystal'),
     obj('survive', R.aether, 300, 'Survive 5 minutes in the aether storm')],
    { xp: 1500, coins: 220, items: [[1077, 6], [1079, 6]] },
    'The crystal sings. It is the only thing in the vale that does.'),

  q('q_badlands_ore', 'Badlands Ore', 16, 55, 'The badlands are rich and the golems are awake.', 'Miner Tobin',
    ['q_dunes_caravan'],
    [obj('explore', R.badlands, 1, 'Enter the Ochre Badlands'),
     obj('gather', '139', 20, 'Gather 20 gold ore'),
     obj('kill', 'stray', 10, 'Defeat 10 Strays'),
     obj('boss', 'boss_citadel', 1, 'Defeat the Citadel Warden')],
    { xp: 1700, coins: 240, items: [[1032, 12], [1082, 1]], skillPoints: 2, title: 'Warden Slayer' },
    'The warden was built to hold a gate. The gate closed three hundred years ago. It has not noticed.',
    { gatesBoss: 'boss_citadel', mainline: true }),

  q('q_dust_tempest', 'The Dust Tempest', 17, 63, 'A storm is grinding the badlands down. End it.', 'Caravan master Halim',
    ['q_badlands_ore'],
    [obj('survive', R.dust, 300, 'Survive 5 minutes in the storm'),
     obj('kill', 'pillager', 12, 'Defeat 12 Pillagers'),
     obj('gather', '24', 40, 'Gather 40 red sand'),
     obj('use', '237', 1, 'Place the jack o lantern at the storm centre')],
    { xp: 1900, coins: 260, items: [[1032, 8], [24, 16]], skillPoints: 1 },
    'The storm was not natural. It was a signal.'),

  q('q_ruins_awakening', 'Ruins Awakening', 18, 65, 'The citadel ruins have woken up. Put them back down.', 'Archaeologist Vey',
    ['q_badlands_ore'],
    [obj('find', 'ruins', 3, 'Find 3 ruins'),
     obj('kill', 'skeleton', 14, 'Defeat 14 Skeletons'),
     obj('kill', 'wither_skeleton', 4, 'Defeat 4 Wither Skeletons'),
     obj('find', '1082', 1, 'Recover the Ancient Key')],
    { xp: 2100, coins: 300, items: [[1082, 1], [1033, 6]], skillPoints: 2 },
    'The ruins did not wake up. They were woken.'),

  q('q_foothills_ore', 'Foothills Ore', 19, 67, 'The foothills are rich in iron. Claim them.', 'Miner Tobin',
    ['q_badlands_ore'],
    [obj('explore', R.foothills, 1, 'Enter the Cinderfall Foothills'),
     obj('gather', '138', 24, 'Gather 24 iron ore'),
     obj('kill', 'zombie', 12, 'Defeat 12 Zombies'),
     obj('use', '108', 1, 'Smelt the ore in the foothills forge')],
    { xp: 2300, coins: 320, items: [[1031, 16], [1032, 4]], skillPoints: 1 },
    'Tobin says the foothills are the honest part of the world. He is wrong about that too.'),

  q('q_grove_spirit', 'The Grove Spirit', 20, 68, 'The grove spirit will not speak to you. Make it.', 'Druid Isel',
    ['q_oldgrowth_heart'],
    [obj('find', '1080', 6, 'Gather 6 Verdant Sap'),
     obj('explore', R.grove, 1, 'Enter the Grove of Whispers'),
     obj('boss', 'boss_verdant', 1, 'Defeat the Verdant Heart again'),
     obj('talk', 'village', 1, 'Return with the spirit\'s answer')],
    { xp: 2600, coins: 360, items: [[1086, 1], [1080, 8]], skillPoints: 2 },
    'The spirit says nothing. It does not need to.'),

  q('q_basalt_forge', 'The Basalt Forge', 22, 72, 'The forge at the basalt columns is cold. Light it.', 'Blacksmith Soren',
    ['q_foothills_ore'],
    [obj('explore', R.basalt, 1, 'Enter the Basalt Reach'),
     obj('gather', '17', 32, 'Gather 32 basalt'),
     obj('gather', '146', 12, 'Gather 12 ancient debris'),
     obj('use', '108', 1, 'Light the basalt forge')],
    { xp: 2900, coins: 400, items: [[1049, 4], [1068, 2]], skillPoints: 1 },
    'Soren lights the forge. It takes him three days to notice it is not cold any more.'),

  q('q_crag_heart', 'The Crag Heart', 24, 73, 'Something is living in the crag. Kill it.', 'Hunter Vadi',
    ['q_basalt_forge'],
    [obj('explore', R.crag, 1, 'Enter the Ember Crag'),
     obj('kill', 'crystal_golem', 5, 'Defeat 5 Crystal Golems'),
     obj('kill', 'arcane_warden', 4, 'Defeat 4 Arcane Wardens'),
     obj('find', 'tower', 1, 'Reach the tower in the crag')],
    { xp: 3200, coins: 440, items: [[1033, 6], [1071, 4]], skillPoints: 1 },
    'The thing in the crag was not living. It was stored.'),

  q('q_wyrm_wake', 'The Wyrm Wake', 36, 73, 'A wyrm sleeps under the crag. Wake it.', 'Hunter Vadi',
    ['q_crag_heart'],
    [obj('explore', R.crag, 1, 'Return to the Ember Crag'),
     obj('gather', '139', 20, 'Gather 20 gold ore'),
     obj('kill', 'crystal_golem', 8, 'Defeat 8 Crystal Golems'),
     obj('boss', 'boss_ember', 1, 'Defeat Ignis, the Ember Titan')],
    { xp: 3600, coins: 500, items: [[1081, 2], [1083, 1]], skillPoints: 1 },
    'The wyrm was not sleeping. It was digesting.',
    { gatesBoss: 'boss_ember' }),

  q('q_peaks_summit', 'The Peaks Summit', 26, 74, 'The storm at the peak is not weather. It is a door.', 'Climber Ansel',
    ['q_crag_heart'],
    [obj('survive', R.peaks, 600, 'Survive 10 minutes on the peak'),
     obj('gather', '202', 24, 'Gather 24 netherrack'),
     obj('kill', 'stray', 16, 'Defeat 16 Strays'),
     obj('find', '1077', 6, 'Collect 6 star fragments')],
    { xp: 3600, coins: 500, items: [[1077, 6], [1081, 2]], skillPoints: 2, title: 'Storm Cutter' },
    'Ansel reaches the top and finds a door. He is not surprised. He is tired.'),

  q('q_heights_apex', 'The Heights Apex', 40, 74, 'The highest point of the world has a door in it. Open it.', 'Climber Ansel',
    ['q_peaks_summit'],
    [obj('find', 'tower', 1, 'Find the tower at the apex'),
     obj('gather', '1078', 12, 'Gather 12 moonstones'),
     obj('kill', 'spectral', 8, 'Defeat 8 Spectral Knights'),
     obj('use', '173', 1, 'Place the End portal frame at the apex')],
    { xp: 3400, coins: 480, items: [[1078, 12], [173, 4]] },
    'The door at the apex is not a door. It is an eyelid.'),

  q('q_citadel_fall', 'The Citadel Falls', 28, 77, 'The citadel is standing. It should not be.', 'Archaeologist Vey',
    ['q_ruins_awakening'],
    [obj('find', 'dungeon_citadel', 1, 'Enter the Citadel Depths'),
     obj('kill', 'wither_skeleton', 10, 'Defeat 10 Wither Skeletons'),
     obj('kill', 'guardian', 8, 'Defeat 8 Guardians'),
     obj('boss', 'boss_citadel', 1, 'Defeat the Citadel Warden again')],
    { xp: 4200, coins: 600, items: [[1082, 1], [1033, 10]], skillPoints: 2, title: 'Citadel Sunderer' },
    'The citadel falls. It falls the way a mountain falls: slowly, and all at once.',
    { gatesBoss: 'boss_citadel', mainline: true }),

  q('q_hollow_depths', 'The Hollow Depths', 30, 84, 'The deep dark has a sound. Answer it.', 'Hermit Ravn',
    ['q_citadel_fall'],
    [obj('find', 'dungeon_crawler', 1, 'Enter the Crawler Warrens'),
     obj('kill', 'wraith', 10, 'Defeat 10 Wraiths'),
     obj('find', '1427', 6, 'Collect 6 echo shards'),
     obj('boss', 'boss_citadel', 1, 'Defeat the Hollow Warden')],
    { xp: 4800, coins: 700, items: [[1427, 6], [1630, 1]], skillPoints: 2 },
    'The sound is not a question. It is a countdown.'),

  q('q_crimson_war', 'The Crimson War', 32, 85, 'The crimson forest is marching. Stop the march.', 'Warden Brakk',
    ['q_citadel_fall'],
    [obj('explore', R.crimson, 1, 'Enter the Crimson Wastes'),
     obj('kill', 'blaze', 10, 'Defeat 10 Blazes'),
     obj('kill', 'magma_cube', 8, 'Defeat 8 Magma Cubes'),
     obj('kill', 'piglin', 12, 'Defeat 12 Piglins'),
     obj('boss', 'boss_fortress', 1, 'Defeat the Nether Warden')],
    { xp: 5400, coins: 800, items: [[1083, 1], [1062, 8]], skillPoints: 2, title: 'Warden of the Flames' },
    'Brakk lost two brothers to this war. He counts them every morning.',
    { gatesBoss: 'boss_fortress', mainline: true }),

  q('q_nether_gate', 'The Nether Gate', 34, 87, 'Open the gate at the fortress and go through.', 'Warden Brakk',
    ['q_crimson_war'],
    [obj('find', 'nether_fortress', 1, 'Reach the Nether Fortress'),
     obj('gather', '21', 40, 'Gather 40 obsidian'),
     obj('gather', '203', 32, 'Gather 32 nether brick'),
     obj('use', 'portal', 1, 'Build and light the portal')],
    { xp: 5800, coins: 850, items: [[1051, 8], [1062, 8]], skillPoints: 1 },
    'The gate opens onto a place that has its own weather.'),

  q('q_warped_grove', 'The Warped Grove', 36, 89, 'The grove in the nether is singing. Find the singer.', 'Druid Isel',
    ['q_nether_gate'],
    [obj('explore', R.warped, 1, 'Enter the Warped Grove'),
     obj('kill', 'vex', 10, 'Defeat 10 Vexes'),
     obj('kill', 'evoker', 4, 'Defeat 4 Evokers'),
     obj('find', '1426', 10, 'Collect 10 shulker shells')],
    { xp: 6200, coins: 900, items: [[1426, 10], [1033, 12]], skillPoints: 1 },
    'The singer is a pair. They sing in turns.'),

  q('q_warped_twin', 'The Warped Twin', 38, 89, 'The twins are one enemy. Kill them once.', 'Druid Isel',
    ['q_warped_grove'],
    [obj('find', 'boss_arena_warped', 1, 'Reach the Warped Grove Arena'),
     obj('boss', 'boss_warped', 1, 'Defeat Verdega, the Warped Twin')],
    { xp: 7000, coins: 1000, items: [[1083, 1], [1488, 4]], skillPoints: 2, title: 'Twin Slayer' },
    'They argue about it afterwards. That is the point.',
    { gatesBoss: 'boss_warped', mainline: true }),

  q('q_rift_magma', 'The Rift Magma', 40, 104, 'The rift is splitting open over the lava sea.', 'Archaeologist Vey',
    ['q_warped_twin'],
    [obj('explore', R.rift, 1, 'Enter the Ember Rift'),
     obj('survive', R.rift, 420, 'Survive 7 minutes in the rift'),
     obj('kill', 'ghast', 8, 'Defeat 8 Ghasts'),
     obj('gather', '191', 24, 'Gather 24 lava')],
    { xp: 7600, coins: 1100, items: [[1062, 12], [1051, 6]], skillPoints: 1 },
    'Vey says the rift is not splitting. It is being pulled.'),

  q('q_sanctum_keeper', 'The Sanctum Keeper', 42, 108, 'The sanctum under the rift holds something that is looking at you.', 'Hermit Ravn',
    ['q_rift_magma'],
    [obj('find', 'dungeon_eldritch', 1, 'Enter the Eldritch Hollow'),
     obj('kill', 'banshee', 8, 'Defeat 8 Banshees'),
     obj('kill', 'cursed', 8, 'Defeat 8 Cursed Ones'),
     obj('boss', 'boss_eldritch', 1, 'Defeat the Eldritch Heart')],
    { xp: 8400, coins: 1200, items: [[1083, 1], [1074, 8]], skillPoints: 2, title: 'Sanctum Opener' },
    'The thing under the sanctum was not looking at you. It was reading you.',
    { gatesBoss: 'boss_eldritch', mainline: true }),

  q('q_rift_unbound', 'The Rift Unbound', 44, 109, 'Something has been unbound in the rift. Bind it, or kill it.', 'Warden Brakk',
    ['q_sanctum_keeper'],
    [obj('kill', 'wraith', 14, 'Defeat 14 Wraiths'),
     obj('kill', 'void_wraith', 6, 'Defeat 6 Void Wraiths'),
     obj('kill', 'evoker', 8, 'Defeat 8 Evokers')],
    { xp: 9000, coins: 1300, items: [[1074, 10], [1075, 6]], skillPoints: 1 },
    'Brakk says it is too late to bind it. He says it politely.'),

  q('q_void_echo', 'The Void Echo', 46, 110, 'The void has an echo of you. Kill it before it finishes.', 'Arcane scholar Neris',
    ['q_rift_unbound'],
    [obj('find', 'spire', 2, 'Find 2 spires'),
     obj('kill', 'spectral', 10, 'Defeat 10 Spectral Knights'),
     obj('find', 'observatory', 1, 'Reach the observatory at the rift'),
     obj('find', '1074', 8, 'Collect 8 void shards')],
    { xp: 9800, coins: 1400, items: [[1074, 8], [1076, 2]], skillPoints: 1 },
    'Neris says the echo is you, from a future you will not reach.'),

  q('q_spires_rise', 'The Spires Rise', 48, 111, 'The spires are aligning. Stop them before they do.', 'Archaeologist Vey',
    ['q_void_echo'],
    [obj('find', 'spire', 5, 'Find 5 spires'),
     obj('kill', 'crystal_golem', 10, 'Defeat 10 Crystal Golems'),
     obj('use', '315', 1, 'Place the Eternity Frame at the spire base')],
    { xp: 10600, coins: 1500, items: [[1076, 4], [313, 2]], skillPoints: 2 },
    'The spires do not align by chance. They were aligned already.'),

  q('q_crystal_waste', 'The Crystal Waste', 50, 112, 'The waste is a mirror of the sky. Walk to the end of it.', 'Climber Ansel',
    ['q_spires_rise'],
    [obj('explore', R.waste, 1, 'Enter the Crystal Wastes'),
     obj('kill', 'spectral', 14, 'Defeat 14 Spectral Knights'),
     obj('find', '1077', 10, 'Collect 10 star fragments')],
    { xp: 11400, coins: 1600, items: [[1077, 10], [1078, 8]], skillPoints: 1 },
    'Ansel walks to the end of the waste and finds the sky is only a ceiling.'),

  q('q_arcane_reach', 'The Arcane Reach', 52, 113, 'The towers at the reach are awake. Find out who woke them.', 'Arcane scholar Neris',
    ['q_crystal_waste'],
    [obj('find', 'tower', 3, 'Find 3 wizard towers'),
     obj('kill', 'arcane_warden', 10, 'Defeat 10 Arcane Wardens'),
     obj('kill', 'vex', 12, 'Defeat 12 Vexes'),
     obj('find', '1071', 12, 'Collect 12 arcane dust')],
    { xp: 12200, coins: 1700, items: [[1071, 12], [1072, 6]], skillPoints: 1 },
    'Nobody woke them. They woke.'),

  q('q_gate_warden', 'The Gate Warden', 54, 114, 'The end gate is open. What comes through it is not the dragon.', 'Druid Isel',
    ['q_arcane_reach'],
    [obj('find', 'end_gate', 1, 'Reach the End Gate'),
     obj('gather', '170', 32, 'Gather 32 end stone'),
     obj('gather', '173', 12, 'Gather 12 end portal frames'),
     obj('use', 'end_gate', 1, 'Activate the End Gate')],
    { xp: 13000, coins: 1800, items: [[1087, 1], [1053, 8]], skillPoints: 2 },
    'The gate was never a gate. It was a lock.'),

  q('q_scar_bleed', 'The Scar Bleeds', 56, 116, 'The scar across the world is bleeding. Seal it.', 'Warden Brakk',
    ['q_gate_warden'],
    [obj('explore', R.scar, 1, 'Enter the Eldritch Scar'),
     obj('kill', 'bloodmote', 14, 'Defeat 14 Bloodmotes'),
     obj('kill', 'wight', 10, 'Defeat 10 Wights'),
     obj('find', 'dungeon_crawler', 2, 'Enter the warrens beneath the scar')],
    { xp: 13800, coins: 1900, items: [[1062, 16], [1083, 1]], skillPoints: 1 },
    'The scar bleeds because the world is a wound that never closed.'),

  q('q_starfall_meteor', 'The Starfall Meteor', 58, 117, 'A meteor is coming. Be under it when it lands.', 'Climber Ansel',
    ['q_scar_bleed'],
    [obj('survive', R.starfall, 600, 'Survive 10 minutes in the open before the fall'),
     obj('gather', '1077', 14, 'Gather 14 star fragments'),
     obj('kill', 'starborn_mote', 8, 'Defeat 8 Starborn Motes'),
     obj('find', 'boss_arena_starfall', 1, 'Reach the Starfall Arena')],
    { xp: 14600, coins: 2000, items: [[1077, 14], [1076, 3]], skillPoints: 2, title: 'Storm Rider' },
    'The meteor is not a rock. It is a fist.',
    { gatesBoss: 'boss_starfall', mainline: true }),

  q('q_heart_bloom', 'The Heart Bloom', 60, 120, 'A flower has bloomed at the centre of the scar. Tend it.', 'Druid Isel',
    ['q_starfall_meteor'],
    [obj('find', '1080', 16, 'Gather 16 Verdant Sap'),
     obj('find', '1077', 12, 'Gather 12 star fragments'),
     obj('find', '1078', 8, 'Gather 8 moonstones'),
     obj('use', '327', 1, 'Place the Verdant Heart at the bloom')],
    { xp: 15400, coins: 2100, items: [[1086, 1], [1087, 1]], skillPoints: 2 },
    'The flower blooms. It is the first thing in three hundred years that has grown here.'),

  q('q_basin_crystal', 'The Basin Crystal', 62, 123, 'The basin at the starfall crater is a lens. Look through it.', 'Arcane scholar Neris',
    ['q_heart_bloom'],
    [obj('find', 'boss_arena_starfall', 1, 'Return to the Starfall Arena'),
     obj('gather', '163', 20, 'Gather 20 blue crystal'),
     obj('gather', '305', 10, 'Gather 10 moonstones'),
     obj('find', 'observatory', 1, 'Reach the basin observatory')],
    { xp: 16200, coins: 2200, items: [[305, 10], [1076, 4]], skillPoints: 1 },
    'The lens does not look at the sky. It looks through it.'),

  q('q_moonfall_rite', 'The Moonfall Rite', 64, 124, 'The moon is falling. Perform the rite that halts it.', 'Druid Isel',
    ['q_basin_crystal'],
    [obj('gather', '1078', 20, 'Gather 20 moonstones'),
     obj('gather', '170', 32, 'Gather 32 end stone'),
     obj('use', '305', 1, 'Place the Moonstone at the rite circle'),
     obj('survive', R.moonfall, 900, 'Complete the rite under the falling moon')],
    { xp: 17000, coins: 2300, items: [[1078, 20], [313, 2]], skillPoints: 2, title: 'Moonfall Keeper' },
    'The moon does not fall. It is pushed.'),

  q('q_vault_opened', 'The Vault Opened', 66, 126, 'The Eternity Vault has opened. Enter it.', 'Archaeologist Vey',
    ['q_moonfall_rite'],
    [obj('find', 'boss_arena_eternity', 1, 'Reach the Eternity Arena'),
     obj('gather', '313', 8, 'Gather 8 Eternity Crystals'),
     obj('kill', 'eternity_spawn', 8, 'Defeat 8 Eternity Spawns'),
     obj('use', '315', 1, 'Place the Eternity Frame at the vault door')],
    { xp: 17800, coins: 2400, items: [[1076, 4], [1087, 1]], skillPoints: 2 },
    'The vault was built for the first king. It was never finished.'),

  q('q_crown_challenge', 'The Crown\'s Challenge', 68, 131, 'The crown is a test. Take it.', 'The First Pillar',
    ['q_vault_opened'],
    [obj('find', '1085', 1, 'Recover the Broken Crown'),
     obj('use', '1085', 1, 'Claim the crown at the vault'),
     obj('kill', 'wight', 16, 'Defeat 16 Wights'),
     obj('kill', 'spectral', 16, 'Defeat 16 Spectral Knights')],
    { xp: 18600, coins: 2500, items: [[1085, 1], [1076, 6]], skillPoints: 2, title: 'Crown Bearer' },
    'The crown is heavy. It is not the weight.'),

  q('q_vale_oblivion', 'The Vale Oblivion', 70, 24, 'The vale where you started has been forgotten. Remember it.', 'Hermit Ravn',
    ['q_crown_challenge'],
    [obj('explore', R.vale, 1, 'Return to Verdant Vale'),
     obj('find', 'tutorial_pillar', 1, 'Return to the First Pillar'),
     obj('gather', '1004', 32, 'Gather 32 oak planks'),
     obj('kill', 'slime_wisp', 20, 'Defeat 20 Slime Wisps')],
    { xp: 19400, coins: 2600, items: [[1076, 6], [1080, 12]], skillPoints: 2 },
    'You cannot remember the vale. You remember the hill you stood on to see it.'),

  q('q_reach_final', 'The Final Reach', 72, 135, 'The world is smaller than it was. Walk it.', 'Climber Ansel',
    ['q_vale_oblivion'],
    [obj('survive', R.final, 1800, 'Walk 30 minutes without dying'),
     obj('find', 'boss_arena_eternity', 1, 'Return to the Eternity Arena'),
     obj('kill', 'void_wraith', 16, 'Defeat 16 Void Wraiths')],
    { xp: 20200, coins: 2700, items: [[1076, 8], [1086, 2]], skillPoints: 2 },
    'The world is the same size. You are not.'),

  q('q_moonwell_deep', 'The Moonwell Deep', 74, 137, 'The moonwell at the top of the world is dry. Fill it.', 'Druid Isel',
    ['q_reach_final'],
    [obj('find', '1078', 24, 'Gather 24 moonstones'),
     obj('find', '1077', 16, 'Gather 16 star fragments'),
     obj('kill', 'moonwell_guardian', 1, 'Defeat the Moonwell Guardian'),
     obj('use', '305', 1, 'Fill the moonwell')],
    { xp: 21000, coins: 2800, items: [[305, 24], [1076, 8]], skillPoints: 2, title: 'Well Keeper' },
    'The well was not dry. It was waiting.'),

  q('q_core_awakening', 'The Core Awakening', 76, 138, 'The world core has woken. It wants to know who you are.', 'Archaeologist Vey',
    ['q_moonwell_deep'],
    [obj('find', 'boss_arena_eternity', 1, 'Reach the world core'),
     obj('kill', 'eternity_spawn', 16, 'Defeat 16 Eternity Spawns'),
     obj('kill', 'world_heart_tendril', 6, 'Defeat 6 World Heart Tendrils')],
    { xp: 21800, coins: 2900, items: [[1086, 2], [1076, 10]], skillPoints: 2 },
    'It already knows who you are. It wants to know what you will do about it.'),

  q('q_core_finale', 'The Core Finale', 80, 138, 'End the war the world has been fighting since the first king.', 'The First Pillar',
    ['q_core_awakening', 'q_reach_final', 'q_crown_challenge'],
    [obj('find', 'boss_arena_eternity', 1, 'Return to the world core'),
     obj('use', '318', 1, 'Place the World Core at the heart'),
     obj('boss', 'boss_world', 1, 'Defeat the World Heart')],
    { xp: 30000, coins: 4000, items: [[1086, 2], [1087, 2], [1076, 16]], skillPoints: 4, title: 'Eternal Sovereign' },
    'The world does not end. It stops hurting.',
    { gatesBoss: 'boss_world', mainline: true }),

  q('q_heart_of_world', 'The Heart of the World', 82, 143, 'The heart is whole. See it.', 'The First Pillar',
    ['q_core_finale'],
    [obj('find', 'boss_arena_eternity', 1, 'Reach the world heart'),
     obj('find', '1086', 2, 'Recover 2 World Heart Shards'),
     obj('survive', R.worldHeart, 1200, 'Stand at the heart for 20 minutes')],
    { xp: 34000, coins: 4500, items: [[1086, 2], [1076, 20]], skillPoints: 4, title: 'World-Heart Bearer' },
    'You stand at the heart of the world, and it stands still for you.'),

  q('q_crater_impact', 'The Crater Impact', 84, 141, 'The crater where the star fell is the second heart. Tend it.', 'Climber Ansel',
    ['q_heart_of_world'],
    [obj('find', 'boss_arena_starfall', 1, 'Return to the starfall crater'),
     obj('gather', '1077', 24, 'Gather 24 star fragments'),
     obj('use', '327', 1, 'Place a Verdant Heart in the crater')],
    { xp: 38000, coins: 5000, items: [[1076, 24], [1087, 2]], skillPoints: 4 },
    'Two hearts, one world. They are finally beating in time.'),

  // -------------------------------------------------------- regional chains
  q('q_emberfall_core', 'Emberfall Core', 34, 92, 'The forge at the heart of Emberfall is cold. Warm it with a core.', 'Blacksmith Soren',
    ['q_nether_gate'],
    [obj('find', 'boss_arena_ember', 1, 'Reach the Ember Arena'),
     obj('gather', '334', 8, 'Gather 8 ember cores'),
     obj('kill', 'blaze', 12, 'Defeat 12 Blazes'),
     obj('use', '328', 1, 'Place an Ember Crystal at the forge heart')],
    { xp: 5800, coins: 820, items: [[1081, 4], [334, 4]], skillPoints: 1 },
    'The forge warms. For the first time in three years, something in Emberfall is making something.'),

  q('q_fortress_warden', 'The Fortress Warden', 40, 98, 'The fortress gate has held for four hundred years. Hold it once more.', 'Warden Brakk',
    ['q_emberfall_core'],
    [obj('find', 'nether_fortress', 1, 'Return to the Nether Fortress'),
     obj('kill', 'ghast', 10, 'Defeat 10 Ghasts'),
     obj('kill', 'blaze', 14, 'Defeat 14 Blazes'),
     obj('boss', 'boss_fortress', 1, 'Defeat the Nether Warden')],
    { xp: 6400, coins: 900, items: [[1083, 1], [1062, 10]], skillPoints: 2, title: 'Gate Keeper' },
    'The warden holds the gate. He does not thank you. He has not been thanked in four hundred years.'),

  q('q_frost_promise', 'The Frostbound Promise', 14, 0, 'A promise was made on the frost shore. Keep it.', 'Frost shore elder',
    ['q_first_steps'],
    [obj('explore', R.frostbound, 1, 'Enter the Frostbound Shore'),
     obj('gather', '9', 24, 'Gather 24 snow blocks'),
     obj('kill', 'wolf_hound', 6, 'Defeat 6 Wolf Hounds')],
    { xp: 620, coins: 80, items: [[1001, 1], [9, 16]] },
    'The promise was kept once. That is why it has to be kept again.'),

  q('q_frozen_heart', 'The Frozen Heart', 22, 2, 'Something frozen into the glacial shelf is still alive.', 'Climber Ansel',
    ['q_frost_promise'],
    [obj('find', 'ruins', 1, 'Find the ruins in the ice'),
     obj('kill', 'stray', 10, 'Defeat 10 Strays'),
     obj('find', '1078', 6, 'Collect 6 moonstones')],
    { xp: 1400, coins: 180, items: [[1078, 6], [1033, 4]] },
    'It is not alive. It is waiting to be.'),

  q('q_storm_caller', 'The Storm Caller', 26, 5, 'A shrine at the peak calls the storms. Silence it.', 'Frost shore elder',
    ['q_frozen_heart'],
    [obj('find', 'shrine', 1, 'Find the shrine at the peak'),
     obj('kill', 'banshee', 6, 'Defeat 6 Banshees'),
     obj('use', '231', 1, 'Replace the shrine torch with a soul torch')],
    { xp: 2200, coins: 300, items: [[231, 4], [1078, 8]] },
    'The storm was not called. It was answered.'),

  q('q_witch_deal', 'The Witch\'s Deal', 30, 44, 'A witch in the mire will trade. Decide what you will pay.', 'Swamp hermit Cor',
    ['q_mire_depths'],
    [obj('find', 'swamp_hut', 1, 'Return to the swamp hut'),
     obj('gather', '1245', 8, 'Gather 8 spider eyes'),
     obj('gather', '132', 4, 'Gather 4 sugar')],
    { xp: 2800, coins: 400, items: [[1316, 2], [1084, 2]] },
    'Cor says the witch is honest. Cor is the one who owes her.'),

  q('q_norhaven_supplies', 'Norhaven Supplies', 20, 23, 'The town of Norhaven is running out of everything. Bring it.', 'Norhaven quartermaster',
    ['q_badlands_ore'],
    [obj('reach', 'village', 1, 'Reach Norhaven'),
     obj('gather', '1200', 24, 'Gather 24 apples'),
     obj('gather', '1205', 20, 'Gather 20 bread'),
     obj('kill', 'pillager', 10, 'Defeat 10 Pillagers')],
    { xp: 2400, coins: 340, items: [[1205, 10], [1031, 6]] },
    'The quartermaster thanks you. He has thanked three other people this week.'),

  q('q_tidewatch_light', 'The Tidewatch Light', 24, 46, 'The light at the bay has gone dark again. Relight it.', 'Keeper Otho',
    ['q_bay_lighthouse'],
    [obj('reach', 'port', 1, 'Return to the bay port'),
     obj('gather', '87', 16, 'Gather 16 glass'),
     obj('gather', '190', 20, 'Gather 20 water'),
     obj('use', '239', 1, 'Replace the lighthouse lens with a sea lantern')],
    { xp: 2600, coins: 380, items: [[239, 4], [1031, 8]] },
    'Otho has not slept in eleven days. He has started counting backwards.'),
];

export const QUEST_BY_ID: Map<string, QuestDef> = new Map(QUESTS.map((x) => [x.id, x]));

export function quest(id: string): QuestDef | undefined {
  return QUEST_BY_ID.get(id);
}

/** Quests that unlock immediately after the given one. */
export function questsUnlockedBy(id: string): QuestDef[] {
  return QUESTS.filter((x) => x.prerequisites.includes(id));
}

/** The mainline quest chain, in order, from the tutorial to the finale. */
export const MAINLINE_QUESTS = QUESTS.filter((x) => x.mainline).map((x) => x.id);

/** Every quest id referenced by the region map but missing here. */
export function danglingQuests(regionQuestIds: string[]): string[] {
  return regionQuestIds.filter((id) => !QUEST_BY_ID.has(id));
}

/** Verify every prerequisite reference resolves. Returns the bad references. */
export function danglingPrerequisites(): string[] {
  const bad: string[] = [];
  for (const questDef of QUESTS) {
    for (const pre of questDef.prerequisites) {
      if (!QUEST_BY_ID.has(pre)) bad.push(`${questDef.id} -> ${pre}`);
    }
  }
  return bad;
}
