/**
 * Dungeons.
 *
 * Ten hand-authored dungeons, each with a fixed entrance in a fixed region and a
 * fixed tile theme. A dungeon is not a random corridor generator: it is a
 * sequence of rooms and corridors laid out as a small graph, so that a player
 * who maps it can map it *correctly*.
 *
 * Each dungeon owns a progression gate (`minLevel`), a boss (optional), and a
 * fixed reward table, which is what makes the "variable board" meaningful: a
 * player can see exactly what a dungeon is worth before they decide to enter.
 */

export type DungeonTileTheme = 'cobble' | 'deepslate' | 'nether' | 'crimson' | 'warped'
  | 'end' | 'obsidian' | 'verdant' | 'arcane' | 'eldritch';

export interface DungeonRoomDef {
  /** Room id, referenced by `connections`. */
  id: string;
  name: string;
  /** Room size in blocks, x/z. */
  size: [number, number];
  /** Position in the dungeon layout, in 16-block cells. */
  cell: [number, number];
  description: string;
  /** Chests placed in this room. */
  chests?: number;
  /** Enemy ids that spawn in this room. */
  enemies?: string[];
  /** True when this room contains a boss. */
  boss?: string;
}

export interface DungeonDef {
  id: string;
  name: string;
  /** The structure id of its entrance. */
  entrance: string;
  region: number;
  theme: DungeonTileTheme;
  minLevel: number;
  recommendedLevel: number;
  /** Floor count. Floors below this are procedurally assembled from the rooms. */
  floors: number;
  rooms: DungeonRoomDef[];
  enemies: string[];
  boss?: string;
  bossFloor: number;
  /** Scaling: how much health and damage grow per floor beyond the base. */
  scalingPerFloor: number;
  rewards: [number, number][];
  description: string;
  lore: string;
}

function d(
  id: string, name: string, entrance: string, region: number, theme: DungeonTileTheme,
  minLevel: number, recommendedLevel: number, floors: number, rooms: DungeonRoomDef[],
  enemies: string[], bossFloor: number, scalingPerFloor: number,
  rewards: [number, number][], description: string, lore: string,
  extra: Partial<DungeonDef> = {}
): DungeonDef {
  return {
    id, name, entrance, region, theme, minLevel, recommendedLevel, floors, rooms,
    enemies, bossFloor, scalingPerFloor, rewards, description, lore,
    ...extra,
    boss: extra.boss,
  };
}

const r = (
  id: string, name: string, size: [number, number], cell: [number, number],
  description: string, extra: Partial<DungeonRoomDef> = {}
): DungeonRoomDef => ({ id, name, size, cell, description, ...extra });

export const DUNGEONS: DungeonDef[] = [
  d('dun_crawler', 'Crawler Warrens', 'dungeon_crawler', 84, 'deepslate', 10, 14, 5,
    [r('entrance', 'Entrance Hall', [10, 10], [0, 0], 'A dim stairwell descending into the dark.', { chests: 1, enemies: ['cave_spider', 'silverfish'] }),
     r('tunnel', 'The Burrow', [8, 6], [1, 0], 'A low tunnel. It gets narrower.', { enemies: ['cave_spider'] }),
     r('chamber', 'The Chamber', [12, 12], [2, 1], 'A wide room. Something was waiting here.', { chests: 2, enemies: ['husk', 'zombie'] }),
     r('pit', 'The Drop', [8, 8], [2, 2], 'A pit with a ladder and a chest at the bottom.', { chests: 1, enemies: ['silverfish'] }),
     r('sanctum', 'The Hollow Sanctum', [14, 14], [3, 1], 'The deepest room. The walls breathe.', { chests: 3, enemies: ['wraith', 'banshee'] })],
    ['cave_spider', 'silverfish', 'husk', 'zombie', 'wraith'], 4, 0.18,
    [[1031, 8], [1033, 3], [1082, 1]],
    'A warren that was dug by something that needed to go somewhere. It never arrived.',
    'The warren was not dug. It grew. The walls are still growing.'),

  d('dun_blaze', 'Blaze Warrens', 'dungeon_blaze', 92, 'nether', 24, 30, 6,
    [r('entrance', 'The Foundry', [12, 12], [0, 0], 'A forge that fell into the nether.', { chests: 1, enemies: ['blaze', 'magma_cube'] }),
     r('bridge', 'The Lava Bridge', [8, 14], [1, 0], 'A bridge over a sea of lava. Half of it is gone.', { enemies: ['blaze'] }),
     r('cells', 'The Iron Cells', [10, 8], [1, 1], 'Cells built for people who never came back.', { chests: 2, enemies: ['husk', 'stray'] }),
     r('forge', 'The Great Forge', [14, 12], [2, 1], 'A forge the size of a house. It is still warm.', { chests: 3, enemies: ['magma_cube', 'blaze'] }),
     r('throne', 'The Blaze Throne', [16, 16], [3, 1], 'A throne of cooled magma. Someone is sitting in it.', { chests: 4, enemies: ['blaze', 'ghast'] })],
    ['blaze', 'magma_cube', 'ghast', 'husk', 'stray'], 5, 0.2,
    [[1051, 8], [1049, 3], [1082, 1]],
    'A forge built to make weapons for a war that ended before the first hammer fell.',
    'The war did not end. It moved.'),

  d('dun_citadel', 'Citadel Depths', 'dungeon_citadel', 77, 'cobble', 26, 32, 7,
    [r('entrance', 'The Citadel Gate', [14, 14], [0, 0], 'The gate the warden still defends.', { chests: 1, enemies: ['skeleton', 'wither_skeleton'] }),
     r('court', 'The Courtyard', [12, 12], [1, 0], 'A courtyard with a dried-up fountain.', { chests: 2, enemies: ['skeleton', 'guardian'] }),
     r('armory', 'The Armory', [10, 10], [1, 1], 'Rust and patience.', { chests: 2, enemies: ['stray', 'wither_skeleton'] }),
     r('dungeon', 'The Pit', [8, 12], [2, 1], 'A pit with cells at the bottom.', { chests: 1, enemies: ['husk', 'zombie'] }),
     r('sanctum', 'The Citadel Sanctum', [16, 16], [3, 1], 'The room the warden was built to guard.', { chests: 4, enemies: ['guardian', 'wither_skeleton'] })],
    ['skeleton', 'wither_skeleton', 'stray', 'guardian', 'husk'], 6, 0.22,
    [[1031, 10], [1033, 4], [1082, 1]],
    'A citadel built to hold a gate that closed three hundred years ago.',
    'The gate did not close. It was only told to.'),

  d('dun_eldritch', 'Eldritch Hollow', 'dungeon_eldritch', 108, 'eldritch', 42, 50, 6,
    [r('entrance', 'The Hollow Mouth', [12, 12], [0, 0], 'The entrance was not built. It bit through.', { chests: 1, enemies: ['banshee', 'wraith'] }),
     r('hall', 'The Writhing Hall', [10, 12], [1, 0], 'Walls that move when you do not look.', { enemies: ['wraith', 'cursed'] }),
     r('grove', 'The Withered Grove', [12, 10], [1, 1], 'A grove that grew in the dark.', { chests: 2, enemies: ['cursed', 'wight'] }),
     r('chamber', 'The Old Chamber', [14, 14], [2, 1], 'A chamber older than the world.', { chests: 3, enemies: ['banshee', 'spectral'] }),
     r('heart', 'The Eldritch Heart', [18, 18], [3, 1], 'The heart of the hollow. It beats.', { chests: 4, enemies: ['spectral', 'cursed'] })],
    ['banshee', 'wraith', 'cursed', 'wight', 'spectral'], 5, 0.25,
    [[1063, 10], [1074, 6], [1083, 1]],
    'A hollow that was not dug out of the world. It was dug out of the world\'s fear.',
    'The heart under the hollow was not evil. It was hungry, and it has been hungry for a very long time.'),

  d('dun_nether', 'The Hollow Fortress', 'nether_fortress', 98, 'nether', 34, 42, 8,
    [r('gate', 'The Fortress Gate', [14, 14], [0, 0], 'The gate that has held for four hundred years.', { chests: 1, enemies: ['piglin', 'blaze'] }),
     r('bridge', 'The Lava Bridge', [8, 16], [1, 0], 'A bridge of nether brick over lava.', { enemies: ['blaze', 'ghast'] }),
     r('hall', 'The Warder Hall', [12, 12], [1, 1], 'A hall full of broken wardens.', { chests: 2, enemies: ['piglin', 'hoglin'] }),
     r('cells', 'The Wither Cells', [10, 10], [2, 1], 'Cells that held wither skeletons. They are empty.', { chests: 2, enemies: ['wither_skeleton'] }),
     r('throne', 'The Warden\'s Throne', [16, 16], [3, 1], 'A throne in a hall of burning light.', { chests: 4, enemies: ['ghast', 'blaze', 'piglin'] })],
    ['piglin', 'hoglin', 'blaze', 'ghast', 'wither_skeleton'], 7, 0.24,
    [[1062, 12], [1049, 4], [1083, 1]],
    'A fortress that never fell. It did not need to.',
    'The warden held the gate alone for four hundred years. He will not thank you for the relief.'),

  d('dun_verdant', 'Verdant Sanctum', 'boss_arena_verdant', 108, 'verdant', 46, 55, 6,
    [r('entrance', 'The Glade Gate', [14, 14], [0, 0], 'A gate of woven vines. It let you in.', { chests: 1, enemies: ['cave_spider', 'husk'] }),
     r('grove', 'The Living Grove', [12, 12], [1, 0], 'Trees that move to stay in your way.', { chests: 2, enemies: ['cave_spider', 'stray'] }),
     r('hall', 'The Sap Hall', [10, 10], [1, 1], 'The walls are alive, and they are calm.', { chests: 2, enemies: ['husk'] }),
     r('chamber', 'The Heart Chamber', [16, 16], [2, 1], 'A chamber of roots and one very large heart.', { chests: 3, enemies: ['stray', 'zombie'] })],
    ['cave_spider', 'husk', 'stray', 'zombie'], 5, 0.22,
    [[1080, 12], [1033, 4], [1086, 1]],
    'A sanctum built by the forest to hold the heart that outlived it.',
    'The heart is not a monster. It is a caretaker, and it is very tired.'),

  d('dun_arcane', 'The Arcane Reach', 'tower', 113, 'arcane', 50, 58, 7,
    [r('entrance', 'The Reach Entrance', [12, 12], [0, 0], 'A staircase into a sky full of towers.', { chests: 1, enemies: ['arcane_warden', 'vex'] }),
     r('lab', 'The Laboratory', [10, 10], [1, 0], 'A lab with a fire that never goes out.', { chests: 2, enemies: ['vex', 'arcane_warden'] }),
     r('library', 'The Library', [12, 10], [1, 1], 'Books that read themselves when you are not looking.', { chests: 2, enemies: ['spectral'] }),
     r('chamber', 'The Conjuring Chamber', [14, 14], [2, 1], 'A chamber with two doors, both locked.', { chests: 3, enemies: ['arcane_warden', 'vex'] }),
     r('summit', 'The Summit Room', [16, 16], [3, 1], 'The top of the tower. The sky is close here.', { chests: 4, enemies: ['spectral', 'arcane_warden'] })],
    ['arcane_warden', 'vex', 'spectral'], 6, 0.26,
    [[1071, 12], [1072, 8], [1083, 1]],
    'A reach full of towers built by people who wanted to see further than anyone else.',
    'They saw further than they wanted. That is why the towers are empty.'),

  d('dun_starfall', 'The Starfall Crater', 'boss_arena_starfall', 141, 'obsidian', 58, 66, 5,
    [r('rim', 'The Crater Rim', [14, 14], [0, 0], 'The rim of the crater where the star fell.', { chests: 1, enemies: ['starborn_mote', 'spectral'] }),
     r('slide', 'The Ash Slide', [8, 12], [1, 0], 'A slide of fused glass and ash.', { chests: 1, enemies: ['starborn_mote'] }),
     r('hall', 'The Fused Hall', [12, 12], [1, 1], 'A hall of glass where the star passed through.', { chests: 2, enemies: ['spectral', 'cursed'] }),
     r('chamber', 'The Fall Chamber', [16, 16], [2, 1], 'The floor of the crater. It is still warm.', { chests: 3, enemies: ['starborn_mote', 'spectral'] })],
    ['starborn_mote', 'spectral', 'cursed'], 4, 0.28,
    [[1077, 14], [1078, 8], [1087, 1]],
    'A crater that was made by something falling out of the sky.',
    'It was not a rock. It was a fist, and it has not finished knocking.'),

  d('dun_vault', 'The Eternity Vault', 'boss_arena_eternity', 126, 'obsidian', 66, 76, 8,
    [r('gate', 'The Vault Gate', [18, 18], [0, 0], 'A gate of eternity crystal. It hums.', { chests: 2, enemies: ['eternity_spawn'] }),
     r('hall', 'The First Hall', [16, 16], [1, 0], 'A hall built to be walked through by someone worthy.', { chests: 2, enemies: ['eternity_spawn', 'void_wraith'] }),
     r('trial', 'The Trial Chamber', [12, 12], [1, 1], 'A chamber that tests what it should.', { chests: 3, enemies: ['void_wraith', 'spectral'] }),
     r('archive', 'The Archive', [14, 12], [2, 1], 'Every name the first king ever spoke.', { chests: 3, enemies: ['spectral'] }),
     r('room', 'The Last Room', [20, 20], [3, 1], 'The last room of the vault. It is not finished.', { chests: 4, enemies: ['eternity_spawn', 'world_heart_tendril'] })],
    ['eternity_spawn', 'void_wraith', 'spectral', 'world_heart_tendril'], 7, 0.3,
    [[1076, 16], [1086, 2], [1087, 2]],
    'A vault built by the first king for a heir who never came.',
    'The vault was never finished. That is why it is still full of surprises.'),

  d('dun_arena', 'The Arena', 'boss_arena_eternity', 138, 'end', 80, 90, 4,
    [r('gate', 'The Arena Gate', [16, 16], [0, 0], 'The gate to the arena at the core.', { chests: 2, enemies: ['eternity_spawn'] }),
     r('sand', 'The Fighting Sand', [14, 14], [1, 0], 'Sand that has been trod on by every champion the world has had.', { chests: 2, enemies: ['spectral', 'cursed'] }),
     r('throne', 'The Champion Throne', [16, 16], [2, 1], 'A throne for the one who wins.', { chests: 3, enemies: ['eternity_spawn', 'world_heart_tendril'] })],
    ['eternity_spawn', 'spectral', 'cursed', 'world_heart_tendril'], 3, 0.32,
    [[1076, 20], [1086, 3], [1087, 2]],
    'The arena at the core of the world. Built for the last fight the world will have.',
    'The world does not end. It stops hurting.'),
];

export const DUNGEON_BY_ID: Map<string, DungeonDef> = new Map(DUNGEONS.map((x) => [x.id, x]));

/** Dungeons a player of this level can reasonably enter. */
export function dungeonsForLevel(level: number): DungeonDef[] {
  return DUNGEONS.filter((d) => level >= d.minLevel);
}

/** A dungeon's tile ids for the given theme. */
export const THEME_TILES: Record<DungeonTileTheme, { wall: number; floor: number; accent: number; glow: number }> = {
  cobble: { wall: 5, floor: 74, accent: 67, glow: 238 },
  deepslate: { wall: 25, floor: 26, accent: 117, glow: 233 },
  nether: { wall: 203, floor: 202, accent: 206, glow: 238 },
  crimson: { wall: 69, floor: 207, accent: 209, glow: 235 },
  warped: { wall: 70, floor: 211, accent: 214, glow: 234 },
  end: { wall: 170, floor: 171, accent: 172, glow: 174 },
  obsidian: { wall: 21, floor: 17, accent: 313, glow: 313 },
  verdant: { wall: 323, floor: 324, accent: 287, glow: 325 },
  arcane: { wall: 160, floor: 162, accent: 164, glow: 174 },
  eldritch: { wall: 308, floor: 309, accent: 310, glow: 312 },
};
