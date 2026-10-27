/**
 * Structure placement.
 *
 * Every feature id referenced by `Regions.ts` gets a builder here. A builder is
 * a plain function that paints tiles into a small box above the region's ground
 * level. Nothing is randomised across a whole structure's footprint: each
 * structure uses a deterministic seeded stream derived from its own address, so
 * a village in the Savanna looks the same on every boot and still differs from
 * the one in the Foothills.
 *
 * Builders are intentionally simple — a house is walls, a roof, a door and a
 * torch — because the world's identity comes from where the structures sit and
 * what the player does inside them, not from their geometry.
 *
 * The tile ids used below are the canonical ids from `Tiles.ts`; the local
 * constants exist so a builder reads like a builder and not like a spreadsheet.
 */

import type { RNG } from '../../engine/core/RNG';

// --- tile ids (mirror src/game/data/Tiles.ts) -----------------------------
const AIR = 0;
const DIRT = 1;
const GRASS_TOP = 2;
const GRASS_SIDE = 3;
const STONE = 4;
const COBBLE = 5;
const GRAVEL = 6;
const SAND = 7;
const SNOW = 9;
const CLAY = 11;
const MUD_BRICK = 13;
const BASALT = 17;
const OBSIDIAN = 21;
const DEEPSLATE = 25;
const DEEPSLATE_BRICKS = 26;
const OAK_LOG = 30;
const BIRCH_LOG = 32;
const OAK_LEAVES = 40;
const SPRUCE_LEAVES = 42;
const VINES = 49;
const CACTUS = 48;
const OAK_PLANKS = 60;
const SPRUCE_PLANKS = 62;
const STONE_BRICK = 67;
const QUARTZ_BLOCK = 71;
const GLASS = 87;
const GLASS_PANE = 89;
const WOOD_FENCE = 91;
const WOOD_DOOR = 93;
const TRAPDOOR = 95;
const LEVER = 97;
const CHEST = 103;
const FURNACE = 108;
const CRAFTING_TABLE = 111;
const ENCHANTING_TABLE = 112;
const BOOKSHELF = 113;
const BEDROCK = 126;
const IRON_ORE = 138;
const GOLD_ORE = 139;
const DIAMOND_ORE = 140;
const NETHERRACK = 202;
const NETHERBRICK = 203;
const SCULK = 182;
const WATER = 190;
const LAVA = 191;
const TORCH = 230;
const LANTERN = 233;
const GLOWSTONE = 238;
const CAMPFIRE = 235;
const END_STONE = 170;
const END_BRICKS = 171;
const END_ROD = 172;
const END_PORTAL_FRAME = 173;
const END_CRYSTAL = 174;
const PURPUR = 175;
const EMBER_CRYSTAL = 328;
const EMBER_BRICKS = 330;
const EMBER_LANTERN = 331;
const ETERNITY_CRYSTAL = 313;
const ETERNITY_PEDESTAL = 314;
const ETERNITY_FRAME = 315;
const ETERNITY_PORTAL = 316;
const WORLD_CORE = 318;
const WORLD_HEART = 319;

export interface StructureCtx {
  /** Absolute world coordinates of the structure's origin (bottom-north-west). */
  ox: number;
  oz: number;
  /** Ground level in the region, before the structure is applied. */
  ground: number;
  set: (x: number, y: number, z: number, tile: number) => void;
  rng: RNG;
}

export interface StructureDef {
  id: string;
  name: string;
  /** Structure footprint in blocks. */
  size: [number, number, number];
  build: (ctx: StructureCtx, ...args: number[]) => void;
  description: string;
  /** True when the structure is a dungeon entrance. */
  dungeon?: boolean;
  /** True when this is a boss arena. */
  arena?: boolean;
  /** True when this structure is the world spawn. */
  spawn?: boolean;
}

/** Fill a rectangular box. */
function box(ctx: StructureCtx, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, tile: number): void {
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) for (let z = z0; z <= z1; z++) {
    ctx.set(x, y, z, tile);
  }
}

/** A simple pitched roof over a rectangle. */
function roof(ctx: StructureCtx, x0: number, z0: number, x1: number, z1: number, y: number, tile: number): void {
  for (let dx = 0; dx <= (x1 - x0); dx++) {
    for (let dz = 0; dz <= (z1 - z0); dz++) {
      const distFromRidge = Math.abs(dx - (x1 - x0) / 2) + Math.abs(dz - (z1 - z0) / 2);
      const yy = y + Math.round(distFromRidge * 0.5);
      ctx.set(x0 + dx, yy, z0 + dz, tile);
    }
  }
}

/** A stone floor slab at `y`, two blocks thick. */
function floor(ctx: StructureCtx, x0: number, z0: number, x1: number, z1: number, y: number, tile: number): void {
  box(ctx, x0, y, z0, x1, y + 1, z1, tile);
}

/** A 4-high interior wall, with a doorway left open on +z. */
function wall(ctx: StructureCtx, x0: number, z0: number, x1: number, z1: number, y: number, tile: number): void {
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
    for (let y2 = y; y2 <= y + 3; y2++) {
      if (z === z0 && Math.abs(x - (x0 + x1) / 2) <= 0.5 && y2 >= y + 1 && y2 <= y + 2) continue;
      ctx.set(x, y2, z, tile);
    }
  }
}

/** A torch on a wall, every few blocks. */
function torches(ctx: StructureCtx, x0: number, z0: number, x1: number, z1: number, y: number): void {
  for (let x = x0 + 2; x <= x1 - 2; x += 4) {
    for (let z = z0 + 2; z <= z1 - 2; z += 4) {
      ctx.set(x, y, z, TORCH);
    }
  }
}

/** A small village house with a door, a window, a roof and a floor. */
function house(ctx: StructureCtx, x0: number, z0: number, w: number, d: number, y: number, plank: number): void {
  const x1 = x0 + w - 1;
  const z1 = z0 + d - 1;
  floor(ctx, x0, z0, x1, z1, y, plank);
  wall(ctx, x0, z0, x1, z1, y + 1, plank);
  ctx.set(Math.floor((x0 + x1) / 2), y + 2, z0, GLASS);
  ctx.set(Math.floor((x0 + x1) / 2) + 1, y + 2, z0, GLASS);
  roof(ctx, x0, z0, x1, z1, y + 4, OAK_LOG);
  ctx.set(x0 + 1, y + 1, z0 + 1, CRAFTING_TABLE);
  ctx.set(x0 + 1, y + 2, z0 + 1, TORCH);
  ctx.set(x0 + 1, y + 1, z1 - 1, CHEST);
}

/** Fenced farmland with a water channel and a hay pile. */
function farm(ctx: StructureCtx, x0: number, z0: number, w: number, d: number, y: number): void {
  const x1 = x0 + w - 1;
  const z1 = z0 + d - 1;
  floor(ctx, x0, z0, x1, z1, y, DIRT);
  for (let x = x0 + 1; x <= x1 - 1; x++) for (let z = z0 + 1; z <= z1 - 1; z++) {
    ctx.set(x, y + 1, z, DIRT);
  }
  for (let x = x0; x <= x1; x++) {
    ctx.set(x, y + 1, z0, WATER);
    ctx.set(x, y + 1, z1, WATER);
  }
  for (let z = z0; z <= z1; z++) {
    ctx.set(x0, y + 1, z, WATER);
    ctx.set(x1, y + 1, z, WATER);
  }
  for (let x = x0; x <= x1; x++) {
    ctx.set(x, y + 2, z0, WOOD_FENCE);
    ctx.set(x, y + 2, z1, WOOD_FENCE);
  }
  for (let z = z0; z <= z1; z++) {
    ctx.set(x0, y + 2, z, WOOD_FENCE);
    ctx.set(x1, y + 2, z, WOOD_FENCE);
  }
}

/** A ruined wall line and a floor of broken stone. */
function ruins(ctx: StructureCtx, x0: number, z0: number, w: number, d: number, y: number): void {
  const x1 = x0 + w - 1;
  const z1 = z0 + d - 1;
  floor(ctx, x0, z0, x1, z1, y, COBBLE);
  for (let x = x0; x <= x1; x++) {
    const h = ctx.rng.range(1, 5);
    for (let i = 0; i < h; i++) ctx.set(x, y + 1 + i, z0, STONE_BRICK);
  }
  for (let z = z0; z <= z1; z++) {
    const h = ctx.rng.range(1, 5);
    for (let i = 0; i < h; i++) ctx.set(x1, y + 1 + i, z, STONE_BRICK);
  }
  for (let i = 0; i < 8; i++) {
    ctx.set(x0 + Math.floor(ctx.rng.nextFloat() * w), y + 1, z0 + Math.floor(ctx.rng.nextFloat() * d), COBBLE);
  }
  for (let i = 0; i < 4; i++) {
    ctx.set(x0 + Math.floor(ctx.rng.nextFloat() * w), y + 1, z0 + Math.floor(ctx.rng.nextFloat() * d), GRAVEL);
  }
}

/** A mine entrance: a dark doorway in a stone face, and ore veins nearby. */
function mine(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  box(ctx, x0, y + 1, z0, x0 + 4, y + 4, z0 + 2, STONE);
  box(ctx, x0, y + 1, z0 + 2, x0 + 4, y + 1, z0 + 2, STONE);
  ctx.set(x0 + 2, y + 2, z0 + 2, AIR);
  ctx.set(x0 + 2, y + 3, z0 + 2, AIR);
  ctx.set(x0 + 2, y + 4, z0 + 2, AIR);
  for (let i = 0; i < 3; i++) ctx.set(x0 + 2, y + 1 + i, z0 + 3, STONE);
  const ore = [IRON_ORE, GOLD_ORE, DIAMOND_ORE];
  for (let i = 0; i < 8; i++) {
    const t = ore[Math.floor(ctx.rng.nextFloat() * ore.length)];
    ctx.set(x0 + Math.floor(ctx.rng.nextFloat() * 8), y + Math.floor(ctx.rng.nextFloat() * 5) + 1, z0 + Math.floor(ctx.rng.nextFloat() * 5), t);
  }
}

/** An open shrine: stone ring, altar, torches and a chest. */
function shrine(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  floor(ctx, x0, z0, x0 + 6, z0 + 6, y, STONE_BRICK);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    ctx.set(Math.floor(x0 + 3 + Math.cos(a) * 3), y + 1, Math.floor(z0 + 3 + Math.sin(a) * 3), STONE_BRICK);
  }
  ctx.set(x0 + 3, y + 1, z0 + 3, STONE);
  ctx.set(x0 + 3, y + 2, z0 + 3, GLOWSTONE);
  ctx.set(x0 + 1, y + 1, z0 + 1, CHEST);
  ctx.set(x0 + 5, y + 2, z0 + 5, TORCH);
}

/** A tall cylindrical tower with a spiral of blocks up the inside. */
function tower(ctx: StructureCtx, x0: number, z0: number, y: number, height: number, stone: number): void {
  const x1 = x0 + 3;
  const z1 = z0 + 3;
  box(ctx, x0, y + 1, z0, x1, y + 1, z1, stone);
  for (let yy = y + 2; yy <= y + height; yy++) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      if (x === x0 || x === x1 || z === z0 || z === z1) ctx.set(x, yy, z, stone);
    }
  }
  // staircase spiralling up the inside wall
  for (let yy = y + 2; yy <= y + height - 1; yy++) {
    const side = Math.floor((yy - y) / 3) % 4;
    const sx = side === 0 || side === 3 ? x0 : x1;
    const sz = side === 0 || side === 1 ? z0 : z1;
    ctx.set(sx, yy, sz, OAK_PLANKS);
  }
  // viewing platform
  box(ctx, x0 - 1, y + height, z0 - 1, x1 + 1, y + height, z1 + 1, OAK_PLANKS);
  ctx.set(x0 + 1, y + height + 1, z0 + 1, TORCH);
}

/** A watchtower: four legs, a platform, a roof and a brazier. */
function watchtower(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  const x1 = x0 + 3;
  const z1 = z0 + 3;
  for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) {
    for (let yy = y + 1; yy <= y + 8; yy++) ctx.set(cx, yy, cz, OAK_LOG);
  }
  box(ctx, x0, y + 8, z0, x1, y + 9, z1, OAK_PLANKS);
  roof(ctx, x0, z0, x1, z1, y + 10, SPRUCE_LEAVES);
  ctx.set(x0 + 1, y + 11, z0 + 1, LANTERN);
}

/** A small tent camp with a campfire and a couple of chests. */
function camp(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  floor(ctx, x0, z0, x0 + 7, z0 + 5, y, DIRT);
  for (let i = 0; i < 3; i++) {
    box(ctx, x0 + i * 3, y + 1, z0 + 1, x0 + i * 3 + 1, y + 3, z0 + 3, COBBLE);
    roof(ctx, x0 + i * 3, z0 + 1, x0 + i * 3 + 1, z0 + 3, y + 4, OAK_LEAVES);
  }
  ctx.set(x0 + 4, y + 1, z0 + 4, CAMPFIRE);
  ctx.set(x0 + 6, y + 1, z0, CHEST);
  ctx.set(x0 + 2, y + 2, z0 + 2, TORCH);
}

/** A dock with planks over water and a small warehouse. */
function port(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  for (let x = 0; x < 12; x++) for (let z = 0; z < 4; z++) {
    ctx.set(x0 + x, y + 1, z0 + z, OAK_PLANKS);
    ctx.set(x0 + x, y, z0 + z, SAND);
  }
  for (let x = 0; x < 5; x++) for (let z = 0; z < 4; z++) {
    ctx.set(x0 + 12 + x, y + 1, z0 + z, STONE_BRICK);
  }
  box(ctx, x0 + 12, y + 2, z0, x0 + 16, y + 6, z0 + 3, STONE_BRICK);
  ctx.set(x0 + 14, y + 3, z0 - 1, WOOD_DOOR);
  ctx.set(x0 + 14, y + 7, z0 + 1, TORCH);
}

/** A wrecked ship half-buried in sand, tilted on its side. */
function shipwreck(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  for (let i = 0; i < 18; i++) {
    const zz = Math.floor(z0 + i * 0.7);
    const yy = y + 1 + Math.floor(Math.sin(i * 0.3) * 1.5);
    for (let x = 0; x < 4; x++) ctx.set(x0 + x, yy, zz, OAK_LOG);
    ctx.set(x0 + 3, y + 4, zz, OAK_LOG);
  }
  ctx.set(x0 + 2, y + 5, Math.floor(z0 + 8), CHEST);
  ctx.set(x0 + 2, y + 5, Math.floor(z0 + 8) + 1, TORCH);
}

/** A swamp hut on stilts, with a ladder of logs and a hanging lantern. */
function swampHut(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  for (const [cx, cz] of [[x0, z0], [x0 + 3, z0], [x0, z0 + 3], [x0 + 3, z0 + 3]]) {
    for (let yy = y + 1; yy <= y + 4; yy++) ctx.set(cx, yy, cz, OAK_LOG);
  }
  box(ctx, x0, y + 5, z0, x0 + 3, y + 6, z0 + 3, OAK_PLANKS);
  roof(ctx, x0 - 1, z0 - 1, x0 + 4, z0 + 4, y + 7, OAK_LEAVES);
  for (let i = 0; i < 4; i++) ctx.set(x0, y + 1 + i, z0 + 4, OAK_LOG);
  ctx.set(x0 + 1, y + 6, z0 + 1, LANTERN);
  ctx.set(x0 + 2, y + 6, z0 + 2, CHEST);
}

/** A domed observatory with a stone base and a glass dome. */
function observatory(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  box(ctx, x0, y + 1, z0, x0 + 8, y + 3, z0 + 8, STONE_BRICK);
  for (let yy = y + 4; yy <= y + 10; yy++) {
    const inset = Math.floor((yy - (y + 4)) / 3);
    box(ctx, x0 + inset, yy, z0 + inset, x0 + 8 - inset, yy, z0 + 8 - inset, GLASS);
  }
  ctx.set(x0 + 4, y + 11, z0 + 4, TORCH);
  ctx.set(x0 + 1, y + 2, z0 + 1, ENCHANTING_TABLE);
  ctx.set(x0 + 6, y + 2, z0 + 1, BOOKSHELF);
}

/** The tutorial pillar: a glowing column of quartz at the world spawn. */
function tutorialPillar(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  for (let yy = y + 1; yy <= y + 9; yy++) ctx.set(x0, yy, z0, QUARTZ_BLOCK);
  ctx.set(x0, y + 10, z0, ETERNITY_CRYSTAL);
  ctx.set(x0, y + 11, z0, ETERNITY_CRYSTAL);
  for (let i = -2; i <= 2; i++) {
    ctx.set(x0 + i, y + 1, z0 + 2, GRASS_TOP);
    ctx.set(x0 + i, y + 1, z0 - 2, GRASS_TOP);
  }
}

/** An End-portal frame ring, dormant, in a ring of end stone. */
function endGate(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  floor(ctx, x0, z0, x0 + 9, z0 + 9, y, END_STONE);
  for (let i = 0; i < 10; i++) {
    ctx.set(x0 + 4, y + 1, z0 + i, END_PORTAL_FRAME);
    ctx.set(x0 + i, y + 1, z0 + 4, END_PORTAL_FRAME);
  }
  box(ctx, x0 + 4, y + 2, z0 + 4, x0 + 5, y + 5, z0 + 5, END_CRYSTAL);
}

/** A Nether fortress gatehouse: nether brick, a bridge and glowstone lamps. */
function netherFortress(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  box(ctx, x0, y + 1, z0, x0 + 15, y + 1, z0 + 8, NETHERBRICK);
  box(ctx, x0 + 2, y + 2, z0 + 1, x0 + 13, y + 9, z0 + 7, NETHERBRICK);
  for (let x = 0; x < 14; x++) for (let z = 0; z < 7; z++) {
    if (ctx.rng.nextFloat() < 0.12) ctx.set(x0 + 2 + x, y + 2 + Math.floor(ctx.rng.nextFloat() * 7), z0 + 1 + z, GLOWSTONE);
  }
  ctx.set(x0 + 7, y + 10, z0 + 3, LANTERN);
  ctx.set(x0 + 8, y + 6, z0, FURNACE);
  ctx.set(x0 + 8, y + 7, z0, GLOWSTONE);
}

/** A solitary obsidian spire rising from the basalt. */
function spire(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  const height = 20 + Math.floor(ctx.rng.nextFloat() * 16);
  for (let i = 0; i < height; i++) {
    const w = Math.max(1, 3 - Math.floor(i / 8));
    for (let x = -w; x <= w; x++) for (let z = -w; z <= w; z++) {
      ctx.set(x0 + x, y + 1 + i, z0 + z, OBSIDIAN);
    }
  }
  ctx.set(x0, y + 1 + height, z0, ETERNITY_CRYSTAL);
}

/** A Nether portal, active, framed in obsidian. */
function portal(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  for (let i = 0; i < 4; i++) {
    ctx.set(x0, y + 1 + i, z0, OBSIDIAN);
    ctx.set(x0 + 2, y + 1 + i, z0, OBSIDIAN);
    ctx.set(x0 + 4, y + 4, z0, OBSIDIAN);
  }
  for (let x = 1; x <= 2; x++) for (let y2 = 1; y2 <= 3; y2++) {
    ctx.set(x0 + x, y + y2, z0, ETERNITY_PORTAL);
  }
}

/** A boss arena: a flat stone floor, a surrounding ring, and a raised dais. */
function bossArena(ctx: StructureCtx, x0: number, z0: number, y: number, variant: number): void {
  const x1 = x0 + 19;
  const z1 = z0 + 19;
  const floorTile = variant === 0 ? COBBLE : variant === 1 ? BASALT : variant === 2 ? DEEPSLATE_BRICKS : END_STONE;
  const rimTile = variant === 0 ? STONE_BRICK : variant === 1 ? BASALT : variant === 2 ? DEEPSLATE : END_BRICKS;
  floor(ctx, x0, z0, x1, z1, y, floorTile);
  for (let x = x0; x <= x1; x++) {
    ctx.set(x, y + 1, z0, rimTile);
    ctx.set(x, y + 1, z1, rimTile);
  }
  for (let z = z0; z <= z1; z++) {
    ctx.set(x0, y + 1, z, rimTile);
    ctx.set(x1, y + 1, z, rimTile);
  }
  box(ctx, x0 + 5, y + 1, z0 + 5, x0 + 10, y + 3, z0 + 10, rimTile);
  for (let x = x0 + 2; x <= x1 - 2; x += 6) {
    ctx.set(x, y + 2, z0, TORCH);
    ctx.set(x, y + 2, z1, TORCH);
  }
  for (let z = z0 + 2; z <= z1 - 2; z += 6) {
    ctx.set(x0, y + 2, z, TORCH);
    ctx.set(x1, y + 2, z, TORCH);
  }
}

/** A dungeon entrance: a stone arch set into a hill, stairs down. */
function dungeonEntrance(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  box(ctx, x0, y + 1, z0 - 2, x0 + 4, y + 6, z0 - 1, STONE_BRICK);
  box(ctx, x0 - 1, y + 1, z0 - 2, x0 + 5, y + 1, z0 - 1, STONE_BRICK);
  box(ctx, x0 + 1, y + 2, z0 - 2, x0 + 3, y + 5, z0 - 2, AIR);
  ctx.set(x0, y + 2, z0 - 2, STONE_BRICK);
  ctx.set(x0 + 4, y + 2, z0 - 2, STONE_BRICK);
  ctx.set(x0 + 2, y + 1, z0 - 2, GLOWSTONE);
  ctx.set(x0 + 2, y + 3, z0 - 2, TORCH);
}

/** A ruined wall and a chest outside the entrance. */
function dungeon(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  dungeonEntrance(ctx, x0, z0, y);
  for (let x = 0; x < 10; x++) for (let y2 = 1; y2 <= 3; y2++) ctx.set(x0 + x, y + y2, z0 - 4, STONE_BRICK);
  ctx.set(x0 + 1, y + 1, z0 - 5, CHEST);
  ctx.set(x0 + 2, y + 1, z0 - 5, GLOWSTONE);
}

/** The starter village, placed at the world spawn. */
function starterVillage(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  house(ctx, x0, z0, 5, 5, y, OAK_PLANKS);
  house(ctx, x0 + 8, z0 + 2, 5, 5, y, OAK_PLANKS);
  house(ctx, x0 + 4, z0 + 9, 5, 5, y, OAK_PLANKS);
  farm(ctx, x0 + 16, z0 + 4, 8, 6, y);
  tower(ctx, x0 - 4, z0 - 4, y, 10, STONE_BRICK);
  tutorialPillar(ctx, x0 + 2, z0 - 6, y);
}

/** Emberwake, the first town the player reaches after the tutorial. */
function emberwakeVillage(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  for (let i = 0; i < 6; i++) {
    house(ctx, x0 + i * 7, z0, 5, 5, y, SPRUCE_PLANKS);
    house(ctx, x0 + i * 7, z0 + 6, 5, 5, y, SPRUCE_PLANKS);
  }
  farm(ctx, x0 - 6, z0 + 10, 8, 6, y);
  watchtower(ctx, x0 + 20, z0 - 5, y);
  shrine(ctx, x0 + 28, z0 + 12, y);
  ctx.set(x0 + 3, y + 1, z0 + 3, CHEST);
  ctx.set(x0 + 14, y + 1, z0 + 3, CHEST);
  ctx.set(x0 + 3, y + 4, z0 + 3, FURNACE);
  ctx.set(x0 + 3, y + 5, z0 + 3, TORCH);
}

/** A generic village: four houses, a forge, a farm. */
function village(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  house(ctx, x0, z0, 5, 5, y, OAK_PLANKS);
  house(ctx, x0 + 7, z0 + 5, 5, 5, y, OAK_PLANKS);
  house(ctx, x0 + 14, z0, 5, 5, y, OAK_PLANKS);
  house(ctx, x0 + 21, z0 + 5, 5, 5, y, OAK_PLANKS);
  farm(ctx, x0 + 8, z0 - 6, 8, 6, y);
  ctx.set(x0 + 14, y + 1, z0 + 6, FURNACE);
  ctx.set(x0 + 14, y + 2, z0 + 6, TORCH);
  ctx.set(x0 + 10, y + 1, z0 + 6, CHEST);
}

/** A small roadside farmstead: house, barn, field, silo. */
function farmstead(ctx: StructureCtx, x0: number, z0: number, y: number): void {
  house(ctx, x0, z0, 5, 5, y, OAK_PLANKS);
  box(ctx, x0 + 6, y + 1, z0, x0 + 12, y + 6, z0 + 5, OAK_LOG);
  roof(ctx, x0 + 6, z0, x0 + 12, z0 + 5, y + 7, OAK_LEAVES);
  farm(ctx, x0 + 4, z0 + 8, 10, 8, y);
  tower(ctx, x0 - 4, z0 + 12, y, 7, STONE_BRICK);
}

function mk(
  id: string, name: string, size: [number, number, number],
  description: string, build: (ctx: StructureCtx, ...args: number[]) => void,
  extra: Partial<StructureDef> = {}
): StructureDef {
  return { id, name, size, description, build, ...extra };
}

export const STRUCTURES: StructureDef[] = [
  mk('tutorial_pillar', 'The First Pillar', [3, 12, 3], 'A glowing quartz column marking where the world began.', tutorialPillar, { spawn: true }),
  mk('village_emberwake', 'Emberwake', [44, 12, 30], 'The first real town. Warm, loud, and glad to see a stranger.', emberwakeVillage),
  mk('village', 'Village', [30, 10, 20], 'A small settlement of farmers, traders and one very tired blacksmith.', village),
  mk('farm', 'Farm', [10, 3, 10], 'Tilled rows, a water channel, and a fence that is not doing much.', farm),
  mk('farmstead', 'Farmstead', [20, 9, 18], 'A house, a barn, and a field that has been planted for three generations.', farmstead),
  mk('port', 'Port', [30, 6, 14], 'A wooden dock and a stone warehouse. The sea does most of the trading.', port),
  mk('camp', 'Outpost Camp', [10, 5, 8], 'A tent ring, a campfire and a chest nobody admits to owning.', camp),
  mk('ruins', 'Ruins', [12, 5, 12], 'Broken walls, rubble, and something in the dark below.', ruins),
  mk('mine', 'Mine', [8, 6, 5], 'A hillside entrance with ore veins outside. The ore is easier than the climb.', mine),
  mk('shrine', 'Shrine', [9, 4, 9], 'A ring of standing stone with an altar at the centre. Someone left a chest.', shrine),
  mk('tower', 'Wizard\'s Tower', [7, 14, 7], 'An empty tower, a spiral stair, and a platform with a view.', (ctx) => tower(ctx, ctx.ox, ctx.oz, ctx.ground, 14, STONE_BRICK)),
  mk('watchtower', 'Watchtower', [6, 14, 6], 'Four wooden legs, a platform, and a lantern that has not been lit in years.', watchtower),
  mk('shipwreck', 'Shipwreck', [24, 6, 6], 'A wreck half-swallowed by the dunes. The chest is still there.', shipwreck),
  mk('swamp_hut', 'Swamp Hut', [6, 8, 6], 'A hut on stilts above the water. The occupant is not home.', swampHut),
  mk('observatory', 'Observatory', [12, 12, 12], 'A domed stone room built to watch the sky. It still does.', observatory),
  mk('dungeon_crawler', 'Crawler Warrens', [12, 14, 12], 'A dungeon entrance sunk into the earth. The walls move.', dungeon, { dungeon: true }),
  mk('dungeon_blaze', 'Blaze Warrens', [12, 14, 12], 'A dungeon entrance of blackened stone, warm to the touch.', dungeon, { dungeon: true }),
  mk('dungeon_citadel', 'Citadel Depths', [12, 16, 12], 'A dungeon entrance beneath the ruins of the old citadel.', dungeon, { dungeon: true }),
  mk('dungeon_eldritch', 'Eldritch Hollow', [12, 16, 12], 'A dungeon entrance that was not built. It grew.', dungeon, { dungeon: true }),
  mk('nether_fortress', 'Nether Fortress', [20, 12, 12], 'A gatehouse of nether brick bridging a lava sea.', netherFortress),
  mk('end_gate', 'End Gate', [12, 8, 12], 'A ring of end stone and a dormant portal frame.', endGate),
  mk('spire', 'The Spire', [8, 40, 8], 'A solitary obsidian column. It is not a natural formation.', spire),
  mk('portal', 'Nether Portal', [6, 5, 2], 'An active portal frame. It hums.', portal),
  mk('boss_arena_ember', 'Ember Arena', [20, 8, 20], 'The forge-floor where Ignis fell.', (ctx) => bossArena(ctx, ctx.ox, ctx.oz, ctx.ground, 1), { arena: true }),
  mk('boss_arena_fortress', 'Fortress Ward', [20, 8, 20], 'The gatehouse courtyard where the Warden holds.', (ctx) => bossArena(ctx, ctx.ox, ctx.oz, ctx.ground, 0), { arena: true }),
  mk('boss_arena_warped', 'Warped Grove Arena', [20, 8, 20], 'A clearing in the grove where the twins dance.', (ctx) => bossArena(ctx, ctx.ox, ctx.oz, ctx.ground, 2), { arena: true }),
  mk('boss_arena_verdant', 'Verdant Arena', [20, 8, 20], 'The heart of the oldgrowth, cleared for a fight.', (ctx) => bossArena(ctx, ctx.ox, ctx.oz, ctx.ground, 2), { arena: true }),
  mk('boss_arena_eternity', 'Eternity Arena', [24, 10, 24], 'The arena at the core of the world. Built by the first king.', (ctx) => bossArena(ctx, ctx.ox, ctx.oz, ctx.ground, 3), { arena: true }),
  mk('boss_arena_arcane', 'Arcane Arena', [20, 8, 20], 'A stone ring in the sky-reaches, reserved for the twins.', (ctx) => bossArena(ctx, ctx.ox, ctx.oz, ctx.ground, 0), { arena: true }),
  mk('boss_arena_eldritch', 'Eldritch Arena', [20, 8, 20], 'A ring of stone in the rift, old enough to remember.', (ctx) => bossArena(ctx, ctx.ox, ctx.oz, ctx.ground, 2), { arena: true }),
  mk('boss_arena_end', 'The End Arena', [24, 10, 24], 'A ring of end stone on the outer island. The dragon lands here.', (ctx) => bossArena(ctx, ctx.ox, ctx.oz, ctx.ground, 3), { arena: true }),
  mk('boss_arena_wither', 'The Wither Arena', [20, 10, 20], 'A ring of blackstone in the nether, lit by soul fire.', (ctx) => bossArena(ctx, ctx.ox, ctx.oz, ctx.ground, 1), { arena: true }),
  mk('boss_arena_starfall', 'Starfall Arena', [20, 8, 20], 'The crater floor where the star fell. Still warm.', (ctx) => bossArena(ctx, ctx.ox, ctx.oz, ctx.ground, 3), { arena: true }),
];

export const STRUCTURE_BY_ID: Map<string, StructureDef> = new Map(STRUCTURES.map((s) => [s.id, s]));

export function structure(id: string): StructureDef | undefined {
  return STRUCTURE_BY_ID.get(id);
}

/** Tiles that are never placed by a structure and should be reset to air. */
export const NEVER_PLACE = AIR;
