/**
 * Tile registry.
 *
 * This is the material backbone of the entire world: every block the player can
 * place, mine, walk on or light up is declared here exactly once. Texture
 * pattern, opacity class, emissive glow and physical flags all live in one row,
 * which is what lets the mesher, the physics and the crafting system agree on
 * a single definition without duplicating knowledge.
 *
 * Category (`cat`) is the mesher's three-way split:
 *   1 = opaque (depth-write, sorted first)
 *   2 = translucent-solid (glass, leaves, water — no depth write)
 * and `glow` marks tiles that also emit an additive light quad.
 */

import type { PatternType, TileSpec } from '../../engine/render/TextureAtlas';
import { TILE_FLAGS } from '../../engine/core/Collision';

export interface TileDef extends TileSpec {
  /** How many colour variants this tile uses in the atlas (1..3). */
  variant?: number;
  /** Mining time in seconds at base strength (multiplied by tool efficiency). */
  hardness: number;
  /** What drops when the block is destroyed. */
  drop: number;
  /** Tool tiers that can harvest this (0 = any hand). */
  harvest: number;
  /** Fuel value for furnaces, or 0. */
  fuel: number;
}

const OPAQUE = 1 as const;
const TRANS = 2 as const;

/** Build a tile definition with sensible defaults. */
function t(
  id: number, name: string, base: [number, number, number], pattern: PatternType,
  hardness: number, drop: number,
  extra: Partial<TileDef> = {}
): TileDef {
  return {
    id, name, base, pattern,
    cat: OPAQUE,
    flags: 1,
    hardness, drop,
    harvest: 0,
    fuel: 0,
    ...extra,
  };
}

export const TILES: TileDef[] = [
  // ---- dirt & basic terrain -------------------------------------------------
  t(1, 'Dirt', [134, 96, 66], 'soil', 0.45, 1, { accent: [150, 110, 74] }),
  t(2, 'Grass Top', [96, 168, 72], 'noise', 0.4, 1, { accent: [140, 205, 95], accent2: [170, 225, 120], glow: 0 }),
  t(3, 'Grass Side', [134, 96, 66], 'soil', 0.4, 1, { accent: [96, 168, 72] }),
  t(4, 'Stone', [128, 128, 132], 'solid', 1.5, 4, { accent: [146, 146, 150] }),
  t(5, 'Cobblestone', [122, 122, 126], 'cracks', 2.0, 5, { accent: [150, 150, 154] }),
  t(6, 'Gravel', [132, 128, 122], 'dots', 0.8, 6, { accent: [160, 154, 144], variant: 3 }),
  t(7, 'Sand', [214, 196, 142], 'sand', 0.5, 7, { accent: [232, 216, 168], variant: 3 }),
  t(8, 'Red Sand', [196, 148, 96], 'sand', 0.5, 7, { accent: [220, 172, 120], variant: 2 }),
  t(9, 'Snow Block', [236, 242, 250], 'snow', 0.5, 9, { accent: [250, 253, 255], variant: 2 }),
  t(10, 'Snow Grass', [236, 242, 250], 'snow', 0.35, 9, { accent: [120, 170, 110] }),
  t(11, 'Clay', [150, 158, 168], 'solid', 0.7, 11, { accent: [172, 180, 190] }),
  t(12, 'Mud', [104, 84, 62], 'soil', 0.35, 12, { accent: [126, 102, 78] }),
  t(13, 'Mud Brick', [140, 108, 80], 'brick', 0.9, 13, { accent: [168, 134, 100] }),
  t(14, 'Mossy Stone', [96, 132, 78], 'moss', 1.6, 14, { accent: [72, 112, 62] }),
  t(15, 'Ash', [126, 122, 118], 'scorch', 0.9, 15, { accent: [96, 92, 88] }),
  t(16, 'Scorched Stone', [72, 66, 64], 'scorch', 1.8, 16, { accent: [96, 40, 30] }),
  t(17, 'Basalt', [58, 54, 62], 'solid', 2.2, 17, { accent: [78, 72, 84], accent2: [40, 38, 46] }),
  t(18, 'Marble', [226, 224, 222], 'diag', 1.9, 18, { accent: [196, 194, 192] }),
  t(19, 'Limestone', [196, 194, 168], 'noise', 1.7, 19, { accent: [220, 218, 192] }),
  t(20, 'Granite', [178, 132, 112], 'dots', 1.9, 20, { accent: [206, 158, 134] }),
  t(21, 'Obsidian', [32, 26, 40], 'solid', 7.0, 21, { accent: [72, 44, 96], glow: 0.12 }),
  t(22, 'Tuff', [112, 104, 96], 'cracks', 1.6, 22, { accent: [138, 128, 116] }),
  t(23, 'Pumice', [118, 112, 108], 'dots', 1.4, 23, { accent: [148, 142, 136] }),
  t(24, 'Crimson Ash', [140, 58, 62], 'scorch', 1.5, 24, { accent: [190, 84, 78] }),
  t(25, 'Deepslate', [52, 50, 58], 'solid', 3.0, 25, { accent: [72, 68, 80] }),
  t(26, 'Deepslate Bricks', [62, 58, 70], 'brick', 3.2, 26, { accent: [86, 80, 96] }),

  // ---- wood, plants & foliage ----------------------------------------------
  t(30, 'Oak Log', [142, 108, 62], 'planks', 2.0, 30, { accent: [168, 132, 80] }),
  t(31, 'Oak Log Top', [158, 122, 74], 'rings', 2.0, 30, { accent: [120, 88, 52] }),
  t(32, 'Birch Log', [186, 160, 116], 'planks', 2.0, 32, { accent: [210, 186, 142] }),
  t(33, 'Spruce Log', [96, 74, 46], 'planks', 2.0, 33, { accent: [120, 94, 58] }),
  t(34, 'Acacia Log', [168, 128, 68], 'planks', 2.0, 34, { accent: [196, 158, 92] }),
  t(35, 'Dark Oak Log', [64, 48, 34], 'planks', 2.0, 35, { accent: [88, 66, 46] }),
  t(36, 'Mangrove Log', [104, 78, 52], 'planks', 2.0, 36, { accent: [132, 102, 68] }),
  t(40, 'Oak Leaves', [72, 142, 62], 'leaf', 0.3, 40, { cat: TRANS, accent: [104, 176, 84], accent2: [58, 118, 52], variant: 3 }),
  t(41, 'Birch Leaves', [152, 186, 96], 'leaf', 0.3, 41, { cat: TRANS, accent: [186, 216, 128], accent2: [128, 162, 72], variant: 3 }),
  t(42, 'Spruce Leaves', [52, 108, 62], 'leaf', 0.3, 42, { cat: TRANS, accent: [78, 142, 86], accent2: [40, 84, 48], variant: 3 }),
  t(43, 'Flower', [226, 96, 110], 'dots', 0.2, 43, { accent: [250, 180, 190] }),
  t(44, 'Bluebell', [120, 168, 236], 'dots', 0.2, 44, { accent: [170, 208, 250] }),
  t(45, 'Dandelion', [236, 214, 84], 'dots', 0.2, 45, { accent: [252, 240, 150] }),
  t(46, 'Tall Grass', [122, 178, 82], 'noise', 0.2, 46, { accent: [158, 208, 112] }),
  t(47, 'Bush', [88, 138, 68], 'leaf', 0.3, 47, { accent: [120, 176, 90], accent2: [60, 104, 52] }),
  t(48, 'Cactus', [96, 148, 84], 'stripesV', 0.5, 48, { accent: [128, 182, 106] }),
  t(49, 'Vines', [72, 124, 62], 'leaf', 0.2, 49, { cat: TRANS, accent: [96, 156, 78] }),
  t(50, 'Glow Flower', [150, 220, 120], 'dots', 0.2, 50, { accent: [200, 255, 190], glow: 0.55 }),
  t(51, 'Glow Berries', [236, 236, 108], 'dots', 0.2, 51, { accent: [255, 255, 190], glow: 0.6 }),
  t(52, 'Pumpkin', [226, 148, 52], 'dots', 0.7, 52, { accent: [250, 178, 74] }),
  t(53, 'Melon', [128, 196, 68], 'dots', 0.7, 53, { accent: [160, 226, 92] }),
  t(54, 'Sugar Cane', [186, 214, 128], 'stripesV', 0.4, 54, { accent: [220, 244, 170] }),
  t(55, 'Bamboo', [168, 198, 110], 'stripesV', 0.5, 55, { accent: [208, 234, 152] }),
  t(56, 'Kelp', [78, 158, 118], 'stripesV', 0.3, 56, { cat: TRANS, accent: [108, 192, 152] }),
  t(57, 'Seagrass', [96, 178, 148], 'noise', 0.2, 57, { cat: TRANS, accent: [138, 210, 182] }),
  t(58, 'Moss Block', [84, 132, 68], 'moss', 0.4, 58, { accent: [112, 168, 92], variant: 2 }),

  // ---- building blocks -----------------------------------------------------
  t(60, 'Oak Planks', [158, 124, 76], 'planks', 1.5, 60, { accent: [182, 150, 98] }),
  t(61, 'Birch Planks', [196, 170, 126], 'planks', 1.5, 61, { accent: [222, 196, 156] }),
  t(62, 'Spruce Planks', [106, 82, 52], 'planks', 1.5, 62, { accent: [134, 106, 70] }),
  t(63, 'Acacia Planks', [182, 138, 74], 'planks', 1.5, 63, { accent: [212, 168, 100] }),
  t(64, 'Dark Oak Planks', [74, 56, 40], 'planks', 1.5, 64, { accent: [102, 78, 54] }),
  t(65, 'Mangrove Planks', [118, 88, 58], 'planks', 1.5, 65, { accent: [150, 118, 80] }),
  t(66, 'Brick', [168, 84, 68], 'brick', 1.8, 66, { accent: [196, 110, 90] }),
  t(67, 'Stone Brick', [128, 130, 136], 'brick', 1.9, 67, { accent: [152, 154, 160] }),
  t(68, 'Mossy Brick', [112, 138, 96], 'brick', 1.9, 68, { accent: [142, 168, 122] }),
  t(69, 'Crimson Brick', [148, 56, 62], 'brick', 1.9, 69, { accent: [186, 84, 88] }),
  t(70, 'Warped Brick', [72, 118, 116], 'brick', 1.9, 70, { accent: [102, 156, 152] }),
  t(71, 'Quartz Block', [226, 226, 236], 'solid', 1.4, 71, { accent: [196, 196, 210] }),
  t(72, 'Chiseled Quartz', [232, 232, 242], 'dots', 1.4, 72, { accent: [190, 190, 206] }),
  t(73, 'Pillar Quartz', [214, 214, 226], 'stripesV', 1.4, 73, { accent: [240, 240, 250] }),
  t(74, 'Smooth Stone', [138, 138, 142], 'solid', 1.8, 74, { accent: [162, 162, 168] }),
  t(75, 'Polished Granite', [190, 142, 122], 'solid', 1.9, 75, { accent: [218, 168, 146] }),
  t(76, 'Polished Diorite', [178, 178, 184], 'solid', 1.9, 76, { accent: [206, 206, 214] }),
  t(77, 'Polished Basalt', [66, 62, 70], 'solid', 2.0, 77, { accent: [92, 86, 98] }),
  t(78, 'Andesite', [142, 140, 146], 'dots', 1.7, 78, { accent: [172, 168, 176] }),
  t(79, 'Andesite Slab', [150, 148, 154], 'stripes', 1.5, 79, { accent: [178, 174, 182] }),
  t(80, 'Glazed Terracotta Blue', [96, 148, 208], 'diag', 1.4, 80, { accent: [138, 186, 238] }),
  t(81, 'Glazed Terracotta Red', [208, 96, 96], 'diag', 1.4, 81, { accent: [238, 142, 138] }),
  t(82, 'Glazed Terracotta Gold', [208, 178, 84], 'diag', 1.4, 82, { accent: [238, 210, 138] }),
  t(83, 'Glazed Terracotta Purple', [148, 96, 196], 'diag', 1.4, 83, { accent: [188, 142, 232] }),
  t(84, 'Terracotta', [188, 118, 88], 'noise', 1.4, 84, { accent: [214, 148, 112] }),
  t(85, 'White Concrete', [228, 228, 232], 'solid', 1.4, 85, { accent: [200, 200, 206] }),
  t(86, 'Black Concrete', [48, 48, 54], 'solid', 1.4, 86, { accent: [72, 72, 80] }),
  t(87, 'Glass', [176, 216, 240], 'glass', 0.4, 87, { cat: TRANS }),
  t(88, 'Tinted Glass', [128, 196, 214], 'glass', 0.4, 88, { cat: TRANS }),
  t(89, 'Glass Pane', [196, 228, 246], 'glass', 0.35, 89, { cat: TRANS }),
  t(90, 'Iron Bars', [178, 178, 184], 'chain', 1.6, 90, { cat: TRANS }),
  t(91, 'Wood Fence', [138, 102, 62], 'planks', 0.8, 91, { accent: [168, 132, 84] }),
  t(92, 'Iron Fence', [168, 168, 174], 'chain', 1.5, 92, { accent: [196, 196, 202] }),
  t(93, 'Wood Door', [128, 96, 58], 'planks', 0.9, 93, { accent: [162, 126, 76] }),
  t(94, 'Iron Door', [162, 162, 168], 'stripesV', 1.4, 94, { accent: [190, 190, 196] }),
  t(95, 'Trapdoor', [146, 112, 68], 'planks', 0.7, 95, { accent: [180, 142, 86] }),
  t(96, 'Button Stone', [142, 142, 148], 'dots', 0.4, 96, { accent: [168, 168, 174] }),
  t(97, 'Lever', [190, 178, 148], 'solid', 0.3, 97, { accent: [120, 116, 110] }),
  t(98, 'Redstone Lamp', [148, 78, 68], 'solid', 0.6, 98, { accent: [196, 108, 92], glow: 0.0 }),
  t(99, 'Redstone Lamp On', [236, 148, 108], 'solid', 0.6, 99, { accent: [255, 186, 150], glow: 0.75 }),
  t(100, 'Rail', [158, 158, 164], 'stripesV', 0.5, 100, { accent: [120, 120, 128] }),
  t(101, 'Detector Rail', [158, 158, 164], 'stripesV', 0.5, 101, { accent: [196, 196, 60], glow: 0.4 }),
  t(102, 'Powered Rail', [178, 148, 74], 'stripesV', 0.5, 102, { accent: [226, 186, 110], glow: 0.45 }),
  t(103, 'Chest', [138, 98, 56], 'planks', 0.9, 103, { accent: [186, 138, 74] }),
  t(104, 'Large Chest', [138, 98, 56], 'planks', 0.9, 104, { accent: [186, 138, 74] }),
  t(105, 'Trapped Chest', [158, 108, 58], 'planks', 0.9, 105, { accent: [206, 148, 74], glow: 0.3 }),
  t(106, 'Ender Chest', [128, 96, 178], 'solid', 1.0, 106, { accent: [178, 142, 226], glow: 0.35 }),
  t(107, 'Barrel', [148, 118, 72], 'stripesV', 0.9, 107, { accent: [184, 148, 92] }),
  t(108, 'Furnace', [148, 142, 138], 'brick', 1.2, 108, { accent: [178, 172, 168] }),
  t(109, 'Blast Furnace', [142, 132, 128], 'brick', 1.5, 109, { accent: [172, 162, 158] }),
  t(110, 'Smoker', [148, 140, 136], 'brick', 1.2, 110, { accent: [182, 174, 170] }),
  t(111, 'Crafting Table', [148, 118, 72], 'planks', 1.0, 111, { accent: [186, 150, 94] }),
  t(112, 'Enchanting Table', [96, 82, 168], 'solid', 2.0, 112, { accent: [138, 122, 220], glow: 0.4 }),
  t(113, 'Bookshelf', [138, 106, 62], 'brick', 1.0, 113, { accent: [172, 138, 86] }),
  t(114, 'Brewing Stand', [236, 236, 236], 'stripesV', 0.8, 114, { accent: [178, 118, 68] }),
  t(115, 'Cauldron', [128, 128, 134], 'solid', 1.0, 115, { accent: [88, 88, 96] }),
  t(116, 'Anvil', [118, 118, 124], 'solid', 2.5, 116, { accent: [150, 150, 158], accent2: [72, 72, 78] }),
  t(117, 'Grindstone', [128, 128, 134], 'stripesV', 1.5, 117, { accent: [96, 96, 104] }),
  t(118, 'Cartography Table', [158, 128, 78], 'planks', 1.0, 118, { accent: [196, 160, 102] }),
  t(119, 'Fletching Table', [148, 118, 72], 'planks', 1.0, 119, { accent: [186, 148, 92] }),
  t(120, 'Loom', [168, 132, 84], 'stripesV', 1.0, 120, { accent: [206, 164, 108] }),
  t(121, 'Stonecutter', [142, 142, 148], 'stripesV', 1.0, 121, { accent: [176, 176, 184] }),
  t(122, 'Composter', [118, 92, 56], 'stripesV', 0.8, 122, { accent: [158, 124, 78] }),
  t(123, 'Beehive', [236, 196, 96], 'dots', 0.6, 123, { accent: [255, 224, 142] }),
  t(124, 'Sign', [148, 118, 72], 'planks', 0.5, 124, { accent: [236, 236, 236] }),
  t(125, 'Hanging Sign', [148, 118, 72], 'planks', 0.5, 125, { accent: [236, 236, 236] }),
  t(126, 'Bedrock', [72, 70, 78], 'solid', 20.0, 126, { accent: [96, 92, 104] }),
  t(127, 'Command Block', [48, 96, 168], 'solid', 20.0, 127, { accent: [78, 132, 208] }),

  // ---- ores & metal blocks -------------------------------------------------
  t(130, 'Iron Block', [186, 186, 192], 'metal', 3.0, 130, { accent: [216, 216, 224] }),
  t(131, 'Gold Block', [236, 208, 108], 'metal', 3.0, 131, { accent: [255, 236, 168] }),
  t(132, 'Diamond Block', [128, 224, 224], 'crystal', 4.0, 132, { accent: [186, 248, 248] }),
  t(133, 'Emerald Block', [96, 226, 148], 'crystal', 4.0, 133, { accent: [152, 248, 190] }),
  t(134, 'Coal Block', [44, 44, 48], 'solid', 3.0, 134, { accent: [68, 68, 74] }),
  t(135, 'Redstone Block', [188, 62, 62], 'solid', 3.0, 135, { accent: [226, 108, 108], glow: 0.35 }),
  t(136, 'Lapis Block', [58, 88, 196], 'solid', 3.0, 136, { accent: [96, 132, 232] }),
  t(137, 'Netherite Block', [72, 62, 108], 'metal', 5.0, 137, { accent: [118, 102, 168], glow: 0.2 }),
  t(138, 'Iron Ore', [148, 142, 138], 'dots', 2.5, 138, { accent: [196, 128, 96] }),
  t(139, 'Gold Ore', [168, 152, 96], 'dots', 2.5, 139, { accent: [236, 196, 110] }),
  t(140, 'Diamond Ore', [128, 148, 148], 'dots', 4.0, 140, { accent: [186, 228, 228] }),
  t(141, 'Emerald Ore', [112, 158, 122], 'dots', 4.0, 141, { accent: [172, 228, 178] }),
  t(142, 'Coal Ore', [58, 56, 58], 'dots', 2.0, 142, { accent: [108, 102, 104] }),
  t(143, 'Redstone Ore', [138, 68, 68], 'dots', 2.5, 143, { accent: [208, 96, 96], glow: 0.25 }),
  t(144, 'Lapis Ore', [68, 98, 178], 'dots', 2.5, 144, { accent: [112, 148, 222] }),
  t(145, 'Quartz Ore', [226, 214, 198], 'dots', 3.0, 145, { accent: [250, 242, 230] }),
  t(146, 'Ancient Debris', [96, 78, 92], 'dots', 6.0, 146, { accent: [152, 124, 148], glow: 0.15 }),
  t(147, 'Raw Iron Block', [168, 152, 142], 'metal', 2.5, 147, { accent: [196, 180, 168] }),
  t(148, 'Raw Gold Block', [226, 196, 128], 'metal', 2.5, 148, { accent: [250, 224, 172] }),
  t(149, 'Raw Copper Block', [196, 128, 84], 'metal', 2.5, 149, { accent: [232, 168, 122] }),
  t(150, 'Copper Block', [196, 122, 78], 'metal', 2.5, 150, { accent: [236, 166, 122] }),
  t(151, 'Cut Copper', [214, 142, 92], 'stripes', 2.0, 151, { accent: [246, 182, 132] }),
  t(152, 'Weathered Copper', [148, 108, 78], 'noise', 2.0, 152, { accent: [186, 148, 112] }),
  t(153, 'Oxidized Copper', [112, 148, 108], 'noise', 2.0, 153, { accent: [148, 188, 148] }),

  // ---- magic, crystal & end ------------------------------------------------
  t(160, 'Arcane Stone', [108, 92, 168], 'solid', 2.2, 160, { accent: [148, 132, 214] }),
  t(161, 'Rune Stone', [72, 62, 128], 'cracks', 2.0, 161, { accent: [128, 112, 208], glow: 0.3 }),
  t(162, 'Conduit', [86, 196, 226], 'crystal', 2.4, 162, { accent: [142, 236, 252], glow: 0.5 }),
  t(163, 'Crystal Blue', [96, 178, 246], 'crystal', 2.0, 163, { accent: [168, 222, 255], glow: 0.65 }),
  t(164, 'Crystal Red', [236, 96, 138], 'crystal', 2.0, 164, { accent: [255, 152, 186], glow: 0.65 }),
  t(165, 'Crystal Green', [112, 226, 148], 'crystal', 2.0, 165, { accent: [172, 252, 196], glow: 0.65 }),
  t(166, 'Crystal Purple', [178, 108, 246], 'crystal', 2.0, 166, { accent: [222, 168, 255], glow: 0.65 }),
  t(167, 'Crystal Gold', [236, 208, 108], 'crystal', 2.0, 167, { accent: [255, 236, 168], glow: 0.7 }),
  t(168, 'Void Stone', [38, 34, 58], 'solid', 3.0, 168, { accent: [64, 58, 96], glow: 0.1 }),
  t(169, 'Ethereal Block', [178, 168, 246], 'solid', 2.5, 169, { accent: [218, 208, 255], glow: 0.25 }),
  t(170, 'End Stone', [226, 226, 214], 'solid', 3.0, 170, { accent: [250, 250, 240] }),
  t(171, 'End Bricks', [214, 214, 202], 'brick', 3.2, 171, { accent: [240, 240, 228] }),
  t(172, 'End Rod', [226, 226, 236], 'stripesV', 1.2, 172, { accent: [252, 252, 255], glow: 0.6 }),
  t(173, 'End Portal Frame', [128, 96, 208], 'solid', 2.0, 173, { accent: [186, 142, 246], glow: 0.8 }),
  t(174, 'End Crystal', [178, 236, 246], 'crystal', 1.0, 174, { accent: [232, 255, 255], glow: 0.85 }),
  t(175, 'Purpur Block', [138, 96, 168], 'solid', 2.2, 175, { accent: [178, 138, 214] }),
  t(176, 'Purpur Pillar', [152, 106, 184], 'stripesV', 2.2, 176, { accent: [196, 152, 228] }),
  t(177, 'End Stone Bricks', [216, 216, 204], 'brick', 3.2, 177, { accent: [242, 242, 232] }),
  t(178, 'Ender Eye', [148, 128, 68], 'solid', 1.5, 178, { accent: [236, 236, 236], glow: 0.7 }),
  t(179, 'Dragon Egg', [196, 196, 196], 'dots', 8.0, 179, { accent: [128, 128, 196] }),
  t(180, 'Skull', [226, 226, 226], 'solid', 1.5, 180, { accent: [196, 196, 196], glow: 0.15 }),
  t(181, 'Wither Skull', [72, 72, 78], 'solid', 5.0, 181, { accent: [118, 118, 128], glow: 0.5 }),
  t(182, 'Sculk', [58, 78, 68], 'noise', 1.5, 182, { accent: [88, 118, 98], glow: 0.12 }),
  t(183, 'Sculk Catalyst', [118, 168, 138], 'dots', 1.5, 183, { accent: [168, 228, 192], glow: 0.35 }),
  t(184, 'Sculk Vein', [58, 78, 68], 'cracks', 1.0, 184, { accent: [108, 148, 118], glow: 0.2 }),

  // ---- liquids, ice & hazards ----------------------------------------------
  t(190, 'Water', [58, 138, 216], 'water', 0.0, 190, { cat: TRANS, flags: 4, glow: 0.05 }),
  t(191, 'Lava', [208, 96, 24], 'lava', 0.0, 191, { cat: TRANS, flags: 8, glow: 0.9 }),
  t(192, 'Lava Still', [168, 72, 18], 'lava', 0.0, 192, { cat: TRANS, flags: 8, glow: 0.8 }),
  t(193, 'Magma', [148, 62, 32], 'lava', 0.0, 193, { cat: TRANS, flags: 8, glow: 0.7 }),
  t(194, 'Ice', [186, 236, 250], 'solid', 0.5, 194, { accent: [222, 250, 255] }),
  t(195, 'Packed Ice', [158, 216, 242], 'solid', 0.7, 195, { accent: [196, 240, 252] }),
  t(196, 'Blue Ice', [128, 208, 246], 'solid', 0.9, 196, { accent: [178, 236, 255], glow: 0.15 }),
  t(197, 'Snow Layer', [240, 246, 252], 'snow', 0.2, 197, { accent: [255, 255, 255] }),
  t(198, 'Powdered Snow', [226, 236, 246], 'noise', 0.3, 198, { accent: [250, 255, 255] }),
  t(199, 'Cobweb', [226, 226, 226], 'solid', 0.1, 199, { cat: TRANS, accent: [196, 196, 206] }),
  t(200, 'Soul Sand', [196, 186, 152], 'sand', 0.9, 200, { accent: [226, 216, 182], variant: 2 }),
  t(201, 'Soul Soil', [128, 118, 98], 'soil', 0.9, 201, { accent: [158, 148, 128] }),
  t(202, 'Netherrack', [128, 58, 58], 'noise', 1.2, 202, { accent: [168, 88, 82], variant: 2 }),
  t(203, 'Nether Brick', [118, 58, 58], 'brick', 1.5, 203, { accent: [158, 88, 84] }),
  t(204, 'Nether Gold Ore', [186, 158, 78], 'dots', 2.5, 204, { accent: [236, 206, 128] }),
  t(205, 'Nether Quartz Ore', [206, 196, 178], 'dots', 3.0, 205, { accent: [242, 236, 222] }),
  t(206, 'Gilded Blackstone', [68, 58, 62], 'dots', 2.5, 206, { accent: [158, 128, 68] }),
  t(207, 'Crimson Nylium', [158, 68, 72], 'noise', 1.2, 207, { accent: [198, 98, 102], variant: 2 }),
  t(208, 'Crimson Stem', [148, 62, 62], 'stripesV', 1.5, 208, { accent: [188, 88, 88] }),
  t(209, 'Crimson Fungus', [198, 78, 84], 'leaf', 0.4, 209, { accent: [236, 118, 122], cat: TRANS }),
  t(210, 'Crimson Roots', [128, 58, 58], 'cracks', 0.6, 210, { accent: [168, 84, 84] }),
  t(211, 'Warped Nylium', [68, 118, 116], 'noise', 1.2, 211, { accent: [102, 158, 154], variant: 2 }),
  t(212, 'Warped Stem', [58, 108, 106], 'stripesV', 1.5, 212, { accent: [88, 148, 144] }),
  t(213, 'Warped Fungus', [108, 158, 152], 'leaf', 0.4, 213, { accent: [152, 208, 202], cat: TRANS }),
  t(214, 'Warped Wart', [78, 138, 134], 'dots', 0.4, 214, { accent: [122, 182, 176] }),
  t(215, 'Blackstone', [48, 44, 52], 'solid', 2.5, 215, { accent: [74, 68, 80] }),
  t(216, 'Black Concrete Powder', [68, 64, 74], 'dots', 0.8, 216, { accent: [96, 90, 104] }),
  t(217, 'Blue Concrete Powder', [96, 148, 208], 'dots', 0.8, 217, { accent: [138, 186, 238] }),
  t(218, 'Red Concrete Powder', [208, 96, 96], 'dots', 0.8, 218, { accent: [238, 142, 138] }),
  t(219, 'White Concrete Powder', [228, 228, 232], 'dots', 0.8, 219, { accent: [200, 200, 206] }),
  t(220, 'Turtle Egg', [226, 226, 212], 'dots', 0.6, 220, { accent: [186, 196, 172] }),

  // ---- decorative / lighting ----------------------------------------------
  t(230, 'Torch', [186, 142, 78], 'solid', 0.2, 230, { accent: [255, 224, 142], glow: 0.95 }),
  t(231, 'Soul Torch', [196, 196, 226], 'solid', 0.2, 231, { accent: [128, 226, 252], glow: 1.0 }),
  t(232, 'Redstone Torch', [158, 62, 58], 'solid', 0.2, 232, { accent: [236, 108, 96], glow: 0.8 }),
  t(233, 'Lantern', [148, 132, 62], 'stripesV', 0.5, 233, { accent: [255, 228, 152], glow: 0.9 }),
  t(234, 'Soul Lantern', [186, 186, 226], 'stripesV', 0.5, 234, { accent: [128, 226, 252], glow: 0.95 }),
  t(235, 'Campfire', [148, 118, 72], 'solid', 0.4, 235, { accent: [255, 148, 58], glow: 0.85 }),
  t(236, 'Soul Campfire', [148, 178, 196], 'solid', 0.4, 236, { accent: [128, 226, 252], glow: 0.95 }),
  t(237, 'Jack o Lantern', [226, 168, 62], 'dots', 0.4, 237, { accent: [255, 224, 142], glow: 0.9 }),
  t(238, 'Glowstone', [226, 216, 148], 'dots', 0.5, 238, { accent: [255, 248, 208], glow: 0.85 }),
  t(239, 'Sea Lantern', [128, 216, 246], 'dots', 0.5, 239, { accent: [196, 248, 255], glow: 0.9 }),
  t(240, 'Prismarine', [96, 196, 226], 'solid', 1.2, 240, { accent: [142, 232, 252] }),
  t(241, 'Prismarine Bricks', [86, 178, 214], 'brick', 1.4, 241, { accent: [132, 222, 252] }),
  t(242, 'Dark Prismarine', [52, 128, 158], 'solid', 1.2, 242, { accent: [82, 168, 202] }),
  t(243, 'Conduit Frame', [118, 196, 226], 'stripesV', 1.0, 243, { accent: [168, 236, 252], glow: 0.4 }),
  t(244, 'Shell Block', [250, 226, 186], 'noise', 1.0, 244, { accent: [224, 196, 156], variant: 2 }),
  t(245, 'White Stained Glass', [228, 238, 248], 'glass', 0.4, 245, { cat: TRANS }),
  t(246, 'Yellow Stained Glass', [246, 228, 128], 'glass', 0.4, 246, { cat: TRANS }),
  t(247, 'Lime Stained Glass', [168, 228, 128], 'glass', 0.4, 247, { cat: TRANS }),
  t(248, 'Magenta Stained Glass', [226, 128, 226], 'glass', 0.4, 248, { cat: TRANS }),
  t(249, 'Light Blue Stained Glass', [128, 208, 246], 'glass', 0.4, 249, { cat: TRANS }),
  t(250, 'Orange Stained Glass', [246, 168, 96], 'glass', 0.4, 250, { cat: TRANS }),
  t(251, 'Red Stained Glass', [236, 108, 108], 'glass', 0.4, 251, { cat: TRANS }),
  t(252, 'Black Stained Glass', [48, 48, 54], 'glass', 0.4, 252, { cat: TRANS }),
  t(253, 'Wool White', [236, 236, 240], 'carpet', 0.6, 253, { accent: [214, 214, 220] }),
  t(254, 'Wool Orange', [246, 158, 78], 'carpet', 0.6, 254, { accent: [216, 128, 52] }),
  t(255, 'Wool Magenta', [218, 118, 226], 'carpet', 0.6, 255, { accent: [178, 88, 186] }),
  t(256, 'Wool Light Blue', [128, 198, 246], 'carpet', 0.6, 256, { accent: [98, 168, 216] }),
  t(257, 'Wool Yellow', [246, 228, 118], 'carpet', 0.6, 257, { accent: [216, 198, 88] }),
  t(258, 'Wool Lime', [168, 228, 118], 'carpet', 0.6, 258, { accent: [138, 198, 88] }),
  t(259, 'Wool Pink', [246, 168, 218], 'carpet', 0.6, 259, { accent: [216, 138, 186] }),
  t(260, 'Wool Gray', [128, 128, 138], 'carpet', 0.6, 260, { accent: [98, 98, 108] }),
  t(261, 'Wool Light Gray', [178, 178, 188], 'carpet', 0.6, 261, { accent: [148, 148, 158] }),
  t(262, 'Wool Cyan', [118, 218, 226], 'carpet', 0.6, 262, { accent: [88, 188, 196] }),
  t(263, 'Wool Purple', [148, 108, 196], 'carpet', 0.6, 263, { accent: [118, 78, 166] }),
  t(264, 'Wool Blue', [96, 148, 226], 'carpet', 0.6, 264, { accent: [66, 118, 196] }),
  t(265, 'Wool Brown', [138, 112, 88], 'carpet', 0.6, 265, { accent: [108, 88, 68] }),
  t(266, 'Wool Green', [118, 188, 118], 'carpet', 0.6, 266, { accent: [88, 158, 88] }),
  t(267, 'Wool Red', [218, 98, 98], 'carpet', 0.6, 267, { accent: [188, 68, 68] }),
  t(268, 'Wool Black', [58, 58, 66], 'carpet', 0.6, 268, { accent: [38, 38, 46] }),
  t(269, 'Banner', [226, 108, 108], 'stripesV', 0.6, 269, { accent: [255, 255, 255] }),
  t(270, 'Bed White', [236, 236, 240], 'carpet', 0.6, 270, { accent: [206, 206, 214] }),
  t(271, 'Bed Red', [218, 98, 98], 'carpet', 0.6, 271, { accent: [178, 68, 68] }),
  t(272, 'Bed Blue', [96, 148, 226], 'carpet', 0.6, 272, { accent: [66, 118, 196] }),
  t(273, 'Bed Green', [118, 188, 118], 'carpet', 0.6, 273, { accent: [88, 158, 88] }),
  t(274, 'Bed Purple', [148, 108, 196], 'carpet', 0.6, 274, { accent: [118, 78, 166] }),
  t(275, 'Bed Yellow', [246, 228, 118], 'carpet', 0.6, 275, { accent: [216, 198, 88] }),
  t(276, 'Hay Block', [226, 198, 118], 'stripesV', 0.7, 276, { accent: [206, 178, 98] }),
  t(277, 'Dried Kelp Block', [178, 158, 96], 'stripesV', 0.7, 277, { accent: [206, 188, 128] }),
  t(278, 'Stem Honey', [236, 196, 96], 'stripesV', 0.9, 278, { accent: [255, 224, 152] }),
  t(279, 'Honey Block', [246, 208, 96], 'solid', 0.9, 279, { accent: [255, 236, 152] }),
  t(280, 'Amethyst Block', [168, 128, 226], 'crystal', 2.0, 280, { accent: [214, 178, 252], glow: 0.4 }),
  t(281, 'Amethyst Bud', [196, 158, 246], 'dots', 0.4, 281, { accent: [236, 208, 255], glow: 0.5 }),
  t(282, 'Amethyst Shard', [214, 188, 252], 'crystal', 0.3, 282, { accent: [242, 224, 255], glow: 0.6 }),
  t(283, 'Copper Bud', [196, 122, 78], 'dots', 0.4, 283, { accent: [236, 166, 122] }),
  t(284, 'Copper Shard', [236, 166, 122], 'crystal', 0.3, 284, { accent: [255, 208, 172] }),
  t(285, 'Pointed Dripstone', [168, 148, 128], 'stripesV', 0.6, 285, { accent: [196, 176, 156] }),
  t(286, 'Dripstone Block', [158, 138, 118], 'stripesV', 1.0, 286, { accent: [188, 168, 148] }),
  t(287, 'Azalea', [118, 178, 108], 'leaf', 0.3, 287, { accent: [158, 218, 148], cat: TRANS }),
  t(288, 'Azalea Roots', [108, 92, 62], 'cracks', 0.5, 288, { accent: [148, 128, 88] }),
  t(289, 'Flowering Azalea', [198, 128, 178], 'leaf', 0.3, 289, { accent: [158, 218, 148], cat: TRANS }),
  t(290, 'Moss Carpet', [84, 132, 68], 'moss', 0.2, 290, { accent: [112, 168, 92], variant: 2 }),
  t(291, 'Moss Block Tall', [84, 132, 68], 'moss', 0.3, 291, { accent: [112, 168, 92] }),
  t(292, 'Large Dripstone', [168, 148, 128], 'stripesV', 0.5, 292, { accent: [196, 176, 156] }),
  t(293, 'Oxidized Bud', [112, 148, 108], 'dots', 0.4, 293, { accent: [148, 188, 148] }),
  t(294, 'Oxidized Shard', [148, 188, 148], 'crystal', 0.3, 294, { accent: [196, 232, 192] }),
  t(295, 'Weathered Bud', [148, 108, 78], 'dots', 0.4, 295, { accent: [186, 148, 112] }),
  t(296, 'Weathered Shard', [186, 148, 112], 'crystal', 0.3, 296, { accent: [222, 186, 148] }),
  t(297, 'Resin Block', [226, 178, 96], 'crystal', 0.8, 297, { accent: [255, 214, 142], glow: 0.25 }),
  t(298, 'Resin Pillar', [226, 178, 96], 'stripesV', 0.8, 298, { accent: [255, 214, 142], glow: 0.2 }),
  t(299, 'Resin Bricks', [226, 178, 96], 'brick', 0.9, 299, { accent: [255, 214, 142] }),
  t(300, 'Resin Chandelier', [255, 228, 168], 'dots', 0.4, 300, { accent: [255, 255, 236], glow: 0.7 }),
  t(301, 'Decorated Pot', [196, 128, 108], 'solid', 0.5, 301, { accent: [158, 88, 72] }),
  t(302, 'Midnight Stone', [44, 38, 74], 'solid', 2.6, 302, { accent: [68, 58, 104], glow: 0.08 }),
  t(303, 'Eclipse Glass', [118, 88, 168], 'glass', 0.5, 303, { cat: TRANS, accent: [168, 138, 226] }),
  t(304, 'Starlight Stone', [236, 236, 148], 'solid', 2.4, 304, { accent: [255, 255, 208], glow: 0.3 }),
  t(305, 'Moonstone', [216, 226, 252], 'crystal', 2.2, 305, { accent: [252, 255, 255], glow: 0.45 }),
  t(306, 'Starglass', [188, 208, 252], 'glass', 0.5, 306, { cat: TRANS, accent: [228, 242, 255], glow: 0.2 }),
  t(307, 'Voidglass', [58, 48, 88], 'glass', 0.5, 307, { cat: TRANS, accent: [88, 74, 128] }),
  t(308, 'Eldritch Stone', [88, 68, 58], 'cracks', 2.8, 308, { accent: [138, 108, 88], glow: 0.12 }),
  t(309, 'Eldritch Bricks', [72, 58, 52], 'brick', 3.0, 309, { accent: [112, 92, 78] }),
  t(310, 'Eldritch Lantern', [148, 96, 68], 'stripesV', 0.6, 310, { accent: [255, 168, 96], glow: 0.85 }),
  t(311, 'Eldritch Torch', [168, 112, 72], 'solid', 0.2, 311, { accent: [255, 186, 112], glow: 0.9 }),
  t(312, 'Eldritch Heart', [208, 88, 138], 'crystal', 1.0, 312, { accent: [255, 148, 196], glow: 0.95 }),
  t(313, 'Eternity Crystal', [255, 224, 128], 'crystal', 12.0, 313, { accent: [255, 255, 224], glow: 1.0 }),
  t(314, 'Eternity Pedestal', [236, 226, 208], 'solid', 6.0, 314, { accent: [255, 250, 236], glow: 0.35 }),
  t(315, 'Eternity Frame', [196, 168, 118], 'diag', 6.0, 315, { accent: [255, 236, 186], glow: 0.4 }),
  t(316, 'Eternity Portal', [178, 138, 246], 'solid', 0.0, 316, { cat: TRANS, accent: [236, 208, 255], glow: 0.7 }),
  t(317, 'Eternity Glass', [228, 218, 255], 'glass', 0.6, 317, { cat: TRANS, accent: [255, 255, 255], glow: 0.2 }),
  t(318, 'World Core', [128, 96, 208], 'crystal', 15.0, 318, { accent: [196, 168, 255], glow: 0.8 }),
  t(319, 'World Heart', [255, 128, 178], 'crystal', 15.0, 319, { accent: [255, 208, 236], glow: 0.9 }),
  t(320, 'Ancient Core', [255, 178, 88], 'crystal', 10.0, 320, { accent: [255, 224, 168], glow: 0.85 }),
  t(321, 'Sky Titanium', [188, 236, 255], 'metal', 4.0, 321, { accent: [232, 255, 255] }),
  t(322, 'Aurora Block', [128, 228, 208], 'solid', 2.5, 322, { accent: [178, 252, 236], glow: 0.3 }),
  t(323, 'Verdant Stone', [88, 168, 98], 'noise', 2.4, 323, { accent: [128, 218, 148], variant: 2 }),
  t(324, 'Verdant Bricks', [72, 148, 88], 'brick', 2.6, 324, { accent: [112, 198, 132] }),
  t(325, 'Verdant Lantern', [148, 228, 138], 'stripesV', 0.6, 325, { accent: [208, 255, 198], glow: 0.8 }),
  t(326, 'Verdant Torch', [128, 198, 118], 'solid', 0.2, 326, { accent: [208, 255, 198], glow: 0.85 }),
  t(327, 'Verdant Heart', [178, 255, 178], 'crystal', 1.0, 327, { accent: [236, 255, 236], glow: 0.9 }),
  t(328, 'Ember Crystal', [255, 128, 58], 'crystal', 2.0, 328, { accent: [255, 196, 128], glow: 0.8 }),
  t(329, 'Ember Stone', [128, 58, 38], 'scorch', 2.2, 329, { accent: [196, 96, 62], glow: 0.15 }),
  t(330, 'Ember Bricks', [108, 48, 32], 'brick', 2.4, 330, { accent: [168, 82, 58] }),
  t(331, 'Ember Lantern', [255, 148, 78], 'stripesV', 0.6, 331, { accent: [255, 208, 148], glow: 0.85 }),
  t(332, 'Ember Torch', [255, 168, 92], 'solid', 0.2, 332, { accent: [255, 232, 192], glow: 0.9 }),
  t(333, 'Ember Heart', [255, 108, 48], 'crystal', 1.0, 333, { accent: [255, 188, 128], glow: 0.9 }),
  t(334, 'Ember Core', [255, 208, 138], 'crystal', 8.0, 334, { accent: [255, 248, 218], glow: 0.95 }),
];

/** Fast lookup: id -> definition. */
export const TILE_BY_ID: (TileDef | undefined)[] = [];
for (const def of TILES) {
  if (!TILE_BY_ID[def.id]) TILE_BY_ID[def.id] = def;
}

/** Number of variants each tile uses (drives atlas layout). */
export const TILE_VARIANTS: number[] = TILES.map((d) => {
  const v = (d as any).variant ?? 1;
  return Math.max(1, Math.min(3, v | 0));
});

/** Category array indexed by tile id. */
export const TILE_CAT: Uint8Array = new Uint8Array(1024);
/** Emissive brightness array indexed by tile id. */
export const TILE_GLOW: Float32Array = new Float32Array(1024);
/** Hardness array indexed by tile id (for mining). */
export const TILE_HARDNESS: Float32Array = new Float32Array(1024);
/** Drop table array indexed by tile id. */
export const TILE_DROP: Int32Array = new Int32Array(1024);
/** Flags array indexed by tile id. */
export const TILE_FLAGS_ARR: Uint8Array = new Uint8Array(1024);

export function initTileTables(): void {
  for (let i = 0; i < 512; i++) {
    const d = TILE_BY_ID[i];
    if (!d) continue;
    TILE_CAT[i] = d.cat;
    TILE_GLOW[i] = d.glow ?? 0;
    TILE_HARDNESS[i] = d.hardness;
    TILE_DROP[i] = d.drop;
    TILE_FLAGS_ARR[i] = (d.cat === 2 ? 2 : 1) | (d.flags & 0x0f);
  }
}

/** Publish the tile flags into the collision/mesher module. */
export function syncColliderFlags(): void {
  for (let i = 0; i < TILE_FLAGS_ARR.length; i++) {
    TILE_FLAGS[i] = TILE_FLAGS_ARR[i];
  }
}

export function tileName(id: number): string {
  return TILE_BY_ID[id]?.name ?? `Tile#${id}`;
}

export function tileFlagsOf(id: number): number {
  return TILE_FLAGS_ARR[id] | 0;
}
