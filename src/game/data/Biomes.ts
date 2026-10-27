/**
 * Biome definitions.
 *
 * A biome is a *recipe*: which stone, dirt and grass tiles make up its
 * ground, which tree grows on it, how high and jagged the terrain is, what
 * decorations litter the surface and which weather rolls it can produce. The
 * world generator is nothing more than a region table interpreted through the
 * biome that region declares, so adding a biome is a single edit that instantly
 * applies to every region using it.
 *
 * Nothing here is random at runtime — every field is a constant, and the only
 * randomness is the seeded hash of the coordinates. That is deliberate: a
 * player can walk back to the same hill and find it exactly where they left it.
 */

import type { WeatherKind } from '../../engine/render/Atmosphere';

export type TreeKind =
  | 'none' | 'oak' | 'birch' | 'spruce' | 'acacia' | 'darkoak' | 'mangrove'
  | 'pine' | 'palm' | 'cactus' | 'dead' | 'crystal' | 'coral' | 'bamboo' | 'redwood';

export interface BiomeDef {
  id: string;
  name: string;
  /** Key into Atmosphere.SKIES. */
  sky: string;
  stone: number;
  dirt: number;
  grass: number;
  sand: number;
  snow: number;
  water: number;
  leaf: number;
  log: number;
  tree: TreeKind;
  /** Base terrain height (voxels). */
  heightBase: number;
  /** Extra amplitude on top of the base. */
  heightAmp: number;
  /** 0 = glassy plains, 1 = jagged. */
  rough: number;
  /** -1 = freezing, 0 = temperate, 1 = volcanic. */
  temp: number;
  /** 0 = dry, 1 = soaking. */
  humid: number;
  decorations: string[];
  weather: WeatherKind[];
  /** Index into the music table. */
  ambient: number;
  /** Multiplies the world's ambient light level. */
  light: number;
  /** Where the surface sits relative to sea level. */
  seaLevel: number;
}

const B = (
  id: string, name: string, sky: string,
  stone: number, dirt: number, grass: number, sand: number, snow: number,
  tree: TreeKind, heightBase: number, heightAmp: number, rough: number,
  temp: number, humid: number, decorations: string[], weather: WeatherKind[],
  ambient: number, light: number, seaLevel = 62,
  extra: Partial<BiomeDef> = {}
): BiomeDef => ({
  id, name, sky, stone, dirt, grass, sand, snow,
  water: 190, leaf: 40, log: 30,
  tree, heightBase, heightAmp, rough, temp, humid, decorations, weather,
  ambient, light, seaLevel, ...extra,
});

export const BIOMES: BiomeDef[] = [
  B('plains', 'Verdant Plains', 'plains', 4, 1, 2, 7, 9, 'oak', 66, 5, 0.18, 0.12, 0.35,
    ['flowers', 'grass', 'bushes', 'pumpkins', 'beehives'], ['rain', 'none'], 0, 1.0),
  B('forest', 'Whispering Woods', 'forest', 4, 1, 2, 7, 9, 'oak', 66, 8, 0.34, 0.15, 0.62,
    ['flowers', 'grass', 'bushes', 'vines', 'mushrooms', 'logs'], ['rain', 'leaves'], 1, 1.0),
  B('birch_forest', 'Birch Hollow', 'forest', 4, 1, 2, 7, 9, 'birch', 67, 7, 0.28, 0.18, 0.55,
    ['flowers', 'grass', 'bushes', 'mushrooms'], ['rain', 'none'], 1, 1.0),
  B('taiga', 'Frosted Taiga', 'forest', 4, 1, 10, 7, 9, 'spruce', 68, 12, 0.42, 0.02, 0.4,
    ['grass', 'bushes', 'snow', 'pines'], ['snow', 'none'], 2, 1.0),
  B('savanna', 'Golden Savanna', 'desert', 5, 1, 2, 7, 9, 'acacia', 65, 4, 0.12, 0.42, 0.18,
    ['grass', 'flowers', 'bushes', 'termite'], ['none', 'ash'], 3, 1.05),
  B('desert', 'Sun-Baked Dunes', 'desert', 5, 1, 2, 7, 9, 'none', 64, 6, 0.2, 0.7, 0.05,
    ['sand', 'cactus', 'dead bush', 'wells'], ['none', 'ash'], 3, 1.1),
  B('badlands', 'Ochre Badlands', 'desert', 22, 1, 2, 8, 9, 'dead', 66, 14, 0.5, 0.6, 0.1,
    ['grass', 'cactus', 'dead bush', 'terracotta'], ['ash', 'none'], 3, 1.08),
  B('swamp', 'Marrowdeep Mire', 'swamp', 14, 12, 1, 7, 9, 'mangrove', 62, 3, 0.1, -0.1, 0.95,
    ['grass', 'bushes', 'vines', 'mushrooms', 'lily', 'mud'], ['rain', 'none'], 4, 0.82),
  B('ocean', 'Shimmering Sea', 'ocean', 4, 1, 2, 7, 9, 'coral', 48, 4, 0.06, 0.2, 0.7,
    ['kelp', 'seagrass', 'coral', 'sand'], ['rain', 'none'], 5, 0.9),
  B('deep_ocean', 'Abyssal Trench', 'ocean', 25, 1, 2, 7, 9, 'none', 40, 6, 0.14, 0.1, 0.8,
    ['kelp', 'seagrass', 'sand'], ['none'], 5, 0.7),
  B('beach', 'Shell-Swept Shore', 'ocean', 4, 1, 2, 7, 9, 'none', 61, 2, 0.08, 0.25, 0.5,
    ['sand', 'grass', 'shells', 'turtles'], ['rain', 'none'], 5, 0.95),
  B('snow', 'Frostbound Reach', 'snow', 4, 1, 10, 7, 9, 'spruce', 72, 16, 0.5, -0.55, 0.3,
    ['snow', 'grass', 'ice', 'pines'], ['snow', 'storm'], 6, 0.9),
  B('ice', 'Glacial Shelf', 'snow', 194, 1, 10, 7, 9, 'none', 74, 8, 0.24, -0.8, 0.4,
    ['ice', 'snow', 'blue ice'], ['snow', 'storm'], 6, 0.85, 60, { seaLevel: 58 }),
  B('mountain', 'Cinderfall Peaks', 'mountain', 4, 1, 2, 7, 9, 'spruce', 78, 34, 0.72, 0.05, 0.25,
    ['grass', 'stone', 'snow', 'peaks'], ['none', 'ash'], 7, 1.0),
  B('volcanic', 'Ember Crag', 'lava', 29, 16, 2, 202, 9, 'dead', 70, 22, 0.6, 0.9, 0.2,
    ['ash', 'scorch', 'lava', 'basalt'], ['ash', 'storm'], 8, 0.95),
  B('netherrack', 'Hollow Depths', 'crimson', 202, 16, 2, 200, 9, 'none', 66, 10, 0.3, 0.8, 0.4,
    ['netherrack', 'soul sand', 'fungus', 'fortress'], ['none'], 9, 0.7),
  B('crimson', 'Crimson Wastes', 'crimson', 207, 16, 2, 200, 9, 'none', 66, 8, 0.22, 0.7, 0.3,
    ['crimson', 'fungus', 'roots', 'netherrack'], ['none'], 9, 0.72),
  B('warped', 'Warped Grove', 'warped', 211, 16, 2, 200, 9, 'none', 66, 6, 0.18, 0.6, 0.5,
    ['warped', 'fungus', 'wart', 'netherrack'], ['none'], 9, 0.74),
  B('end', 'Eternity Spires', 'end', 170, 1, 2, 7, 9, 'none', 74, 20, 0.5, 0.0, 0.1,
    ['end stone', 'purpur', 'crystals', 'ender'], ['none'], 10, 0.8),
  B('magic', 'Arcane Glade', 'magic', 160, 1, 2, 7, 9, 'crystal', 68, 12, 0.36, 0.2, 0.5,
    ['crystals', 'arcane', 'runes', 'flowers'], ['motes', 'none'], 11, 1.0),
  B('verdant', 'Verdant Sanctum', 'verdant', 323, 1, 2, 7, 9, 'redwood', 70, 18, 0.4, 0.15, 0.7,
    ['verdant', 'flowers', 'lanterns', 'shrines'], ['motes', 'leaves'], 12, 1.05),
  B('eldritch', 'Eldritch Rift', 'arcane', 308, 1, 2, 7, 9, 'dead', 66, 16, 0.55, 0.3, 0.35,
    ['eldritch', 'runes', 'hearts', 'void'], ['motes', 'ash'], 13, 0.78),
  B('void', 'The Void Expanse', 'void', 168, 1, 2, 7, 9, 'none', 60, 8, 0.3, 0.0, 0.0,
    ['void', 'stars', 'ruins'], ['none'], 14, 0.6),
  B('lush_cave', 'Lush Cavern', 'glade', 4, 1, 2, 7, 9, 'none', 40, 3, 0.2, 0.2, 0.8,
    ['mushrooms', 'azalea', 'vines', 'glow'], ['motes', 'none'], 15, 0.85),
  B('dripstone', 'Dripstone Cavern', 'mountain', 4, 1, 2, 7, 9, 'none', 38, 4, 0.3, 0.1, 0.6,
    ['dripstone', 'stalactite', 'azalea'], ['motes', 'none'], 15, 0.8),
  B('mangrove', 'Mangrove Fen', 'swamp', 36, 12, 1, 7, 9, 'mangrove', 63, 5, 0.14, 0.05, 0.9,
    ['grass', 'vines', 'mud', 'lily', 'mushrooms'], ['rain', 'none'], 4, 0.85),
  B('snowy_mountain', 'Highfrost Summit', 'snow', 4, 1, 10, 7, 9, 'spruce', 84, 30, 0.7, -0.4, 0.25,
    ['snow', 'ice', 'stone', 'peaks'], ['snow', 'storm'], 6, 0.92),
  B('mushroom', 'Mushroom Isles', 'glade', 4, 1, 2, 7, 9, 'none', 62, 4, 0.1, 0.1, 0.85,
    ['mushrooms', 'grass', 'azalea'], ['motes', 'rain'], 15, 0.9),
  B('coral', 'Coral Reef', 'ocean', 4, 1, 2, 7, 9, 'coral', 50, 3, 0.05, 0.3, 0.75,
    ['coral', 'kelp', 'seagrass', 'sand'], ['rain', 'none'], 5, 0.95),
  B('savanna_plateau', 'Acacia Mesa', 'desert', 5, 1, 2, 7, 9, 'acacia', 76, 12, 0.4, 0.45, 0.15,
    ['grass', 'flowers', 'bushes'], ['none', 'ash'], 3, 1.08),
  B('windswept', 'Windswept Steppe', 'plains', 4, 1, 2, 7, 9, 'none', 68, 6, 0.2, 0.2, 0.2,
    ['grass', 'flowers', 'bushes', 'ruins'], ['none', 'ash'], 0, 1.0),
  B('ancient', 'Ancient Ruins', 'mountain', 4, 1, 2, 7, 9, 'none', 66, 10, 0.3, 0.1, 0.3,
    ['ruins', 'pillars', 'vines', 'torches'], ['leaves', 'none'], 7, 0.95),
  B('glade', 'Sunlit Glade', 'glade', 4, 1, 2, 7, 9, 'oak', 65, 6, 0.2, 0.2, 0.5,
    ['flowers', 'grass', 'bushes', 'beehives'], ['rain', 'none'], 0, 1.05),
];

export const BIOME_BY_ID: Map<string, BiomeDef> = new Map(BIOMES.map((b) => [b.id, b]));

export function biome(id: string): BiomeDef {
  const b = BIOME_BY_ID.get(id);
  if (!b) throw new Error(`unknown biome "${id}"`);
  return b;
}

/** Names of every biome, for the world map legend. */
export const BIOME_NAMES: string[] = BIOMES.map((b) => b.name);
