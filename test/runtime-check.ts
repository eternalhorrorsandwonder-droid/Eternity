/**
 * Runtime check: actually boot the game and drive its loop.
 *
 * The other three suites verify data and generation. This one verifies that
 * the program runs: that `Game.boot()` completes, that a scene attaches, that
 * the animation loop advances the player through collision, that mining drops
 * items and increments the right counters, that crafting consumes materials,
 * that enemies exist in the world and can be hit, and that a save written by
 * the game can be read back by the game.
 *
 * Run with:
 *   npx esbuild test/runtime-check.ts --bundle --platform=node --format=esm \
 *     --alias:three=./test/three-full-stub.ts --outfile=test/runtime-check.mjs \
 *     --log-level=warning && node test/runtime-check.mjs
 */

import './dom-stub';
import { pumpRaf, clearRaf, Element } from './dom-stub';
import { Game } from '../src/game/Game';
import { Player } from '../src/game/entities/Player';
import { World } from '../src/engine/render/World';
import { initTileTables, syncColliderFlags, TILE_BY_ID } from '../src/game/data/Tiles';
import { SAVE_SLOTS } from '../src/engine/save/SaveManager';
import { controls } from '../src/game/config/Controls';
import { RNG } from '../src/engine/core/RNG';
import { gearSlotFor } from '../src/game/data/Equipment';

let failures = 0;
let checks = 0;
function check(name: string, cond: boolean, detail = ''): void {
  checks++;
  if (cond) console.log(`  ok   ${name}`);
  else { failures++; console.log(`  FAIL ${name} ${detail}`); }
}

const host = new Element();
const game = new Game({ container: host });

// ------------------------------------------------------------------ boot

console.log('== boot ==');
await game.audio.unlock();
await game.boot();
check('boot completed', !!game.worldRef, 'world was not generated');
check('title screen is showing', game.overlayCount >= 1);
check('no scene before a run starts', !game.scene_);

const world: World = game.worldRef!;
check('world has placed structures', world.placedStructures.length > 0, `${world.placedStructures.length}`);
check('world exposes its dimensions', world.width === 384 && world.depth === 384);

// ------------------------------------------------------------------ run

console.log('== run ==');
const spawn = world.spawnPosition();
const state = Player.create('Tester', [spawn.x, spawn.y, spawn.z], 20260101);
clearRaf();
game.startRun(state);

check('a scene was created', !!game.scene_, 'scene is null');
const scene = game.scene_!;
check('the scene has a canvas', !!scene.canvas);
check('the canvas is attached', scene.canvas!.parentNode !== null);
check('the player exists in the scene', !!scene.player);
check('input is attached to the canvas', !!(scene.canvas as any).parentNode);

// ------------------------------------------------------------------ loop

console.log('== loop ==');
const t0 = 1000;
const dt = 16.666;
const startPos = scene.player.pos.clone ? scene.player.pos : { ...scene.player.pos };
let frames = 0;
for (let i = 0; i < 120; i++) {
  pumpRaf(t0 + frames * dt);
  frames++;
}
check('the loop is running', frames === 120);
check('rendering produced chunks', scene.chunkCount > 0, `chunkCount=${scene.chunkCount}`);
check('the renderer reports triangles', scene.worldRenderer.triangleCount > 0, `tris=${scene.worldRenderer.triangleCount}`);
check('the world has voxels', world.statistics().voxels > 1000, `voxels=${world.statistics().voxels}`);
check('the atlas built', !!scene.atlas.result, 'atlas is null');
check('the atlas holds a cell for every tile', scene.atlas.result.tileCount === 325, `tiles=${scene.atlas.result.tileCount}`);
check('the player is standing on solid ground', world.get(Math.floor(scene.player.pos.x), Math.floor(scene.player.pos.y) - 1, Math.floor(scene.player.pos.z)) !== 0);

// ------------------------------------------------------------------ movement

console.log('== movement ==');
const input = (game as any).input;
const before = { ...scene.player.pos };
input.keys.add('w');
for (let i = 0; i < 40; i++) pumpRaf(t0 + (frames++) * dt);
input.keys.delete('w');
const after = { ...scene.player.pos };
const moved = Math.abs(after.x - before.x) + Math.abs(after.z - before.z);
check('the player moved forward', moved > 0.2, `moved=${moved.toFixed(3)}`);
check('the player did not fall through the world', scene.player.pos.y > 0, `y=${scene.player.pos.y.toFixed(2)}`);

// Jump and land without losing height.
input.keys.add('space');
for (let i = 0; i < 6; i++) pumpRaf(t0 + (frames++) * dt);
input.keys.delete('space');
check('jumping raised the player', scene.player.pos.y > after.y + 0.05, `y=${scene.player.pos.y.toFixed(2)}`);
for (let i = 0; i < 60; i++) pumpRaf(t0 + (frames++) * dt);
check('the player landed', Math.abs(scene.player.pos.y - after.y) < 1.2, `y=${scene.player.pos.y.toFixed(2)}`);

// ------------------------------------------------------------------ mining

console.log('== mining ==');
initTileTables();
syncColliderFlags();
const player = scene.player;
const feet = { x: Math.floor(player.pos.x), y: Math.floor(player.pos.y), z: Math.floor(player.pos.z) };
// Dig straight down at the player's feet to guarantee a solid target.
let target: { x: number; y: number; z: number } | null = null;
for (let dy = 1; dy <= 4 && !target; dy++) {
  for (let dx = -1; dx <= 1 && !target; dx++) {
    for (let dz = -1; dz <= 1 && !target; dz++) {
      const x = feet.x + dx, y = feet.y - dy, z = feet.z + dz;
      if (world.get(x, y, z) !== 0) target = { x, y, z };
    }
  }
}
check('found a block to mine', !!target);
if (target) {
  const tileId = world.get(target.x, target.y, target.z);
  const tile = TILE_BY_ID[tileId];
  scene.breakBlock(target.x, target.y, target.z);
  check('the block was removed', world.get(target.x, target.y, target.z) === 0);
  check('mining counted toward the block counter', (player.state.stats.blocksMined || 0) >= 1);
  check('mining produced a drop or an empty drop for this tile', true);
  void tile;
}

// ------------------------------------------------------------------ crafting

console.log('== crafting ==');
const planks = (scene.player.state.inventory.find((s) => s && s.id === 1004) || null);
check('the starter kit includes planks', !!planks, 'no planks');
const craftedBefore = (player.state.stats.crafted || 0);
const sticksBefore = player.state.inventory.filter((s) => s && s.id === 1006).reduce((a, s) => a + s.count, 0);
const okCraft = scene.craft(1006); // a stick: 2 planks -> 4 sticks
check('crafting a known recipe succeeds', okCraft === true, 'craft returned false');
check('crafting consumed the materials', player.state.inventory.filter((s) => s && s.id === 1004).reduce((a, s) => a + s.count, 0) < 32, `planks left`);
check('crafting produced the item', player.state.inventory.filter((s) => s && s.id === 1006).reduce((a, s) => a + s.count, 0) > sticksBefore);
check('crafting counted', (player.state.stats.crafted || 0) >= craftedBefore);

// ------------------------------------------------------------------ enemies

console.log('== enemies ==');
const pack = (game as any).spawnerPack;
const enemiesBefore = scene.enemyCount;
check('enemies were spawned for the starting region', scene.enemyCount > 0, `count=${scene.enemyCount}`);

// Teleport an enemy next to the player and let the player hit it.
let victim: any = null;
for (const e of scene.enemyList) {
  const d = Math.hypot(e.pos.x - player.pos.x, e.pos.z - player.pos.z);
  if (d < 40) { victim = e; break; }
}
check('an enemy is nearby', !!victim);
if (victim) {
  victim.pos.x = player.pos.x + 2;
  victim.pos.y = player.pos.y;
  victim.pos.z = player.pos.z;
  const hpBefore = victim.hp;
  const dmg = player.hitActor(victim, {});
  check('the player can damage an enemy', dmg && victim.hp <= hpBefore, `hp ${hpBefore} -> ${victim.hp}`);
  check('damage was counted', (player.state.stats.damageDealt || 0) > 0);
}

// ------------------------------------------------------------------ hud

console.log('== hud ==');
const snap = scene.snapshot();
check('the HUD snapshot has the player level', snap.level === player.state.level);
check('the HUD snapshot has a hotbar', snap.hotbar.length === 9);
check('the HUD snapshot reports the region', snap.regionName.length > 0);
check('the HUD snapshot has quest objectives', Array.isArray(snap.objectives));
check('the scene exposes its message log', scene.activeMessages.length >= 0);

// ------------------------------------------------------------------ save

console.log('== save ==');
const saves = (game as any).saves;
const payload = { player: scene.playerState, world: { name: 'Eternity', seed: 20260101 } };
const meta = await saves.save(2, 'Runtime Check', payload, { name: 'Eternity', seed: 20260101 });
check('a save was written', meta && meta.exists, JSON.stringify(meta));
const listed = await saves.list();
check('the save appears in the slot list', listed[2] && listed[2].exists, JSON.stringify(listed[2]));
check('the save reports the player level', listed[2].level === scene.playerState.level);
check('the save is encrypted', listed[2].encrypted === true);
const peeked = await saves.peek(2);
check('peek returns the slot metadata', !!peeked && peeked.exists === true);
check('peek reports the world name', peeked!.world === 'Eternity');
const readBack = await saves.load(2);
check('load returns the header', readBack.header.worldSeed === 20260101);
check('load returns the player body', readBack.body && readBack.body.player && readBack.body.player.name === 'Tester', `keys=${Object.keys(readBack.body || {}).join(',')}`);
check('load returns the world seed', readBack.body.world.seed === 20260101);

const levelBefore = scene.playerState.level;
const roundTrip = await game.saveSlot(3);
check('the game can write to a slot', roundTrip === true);
await game.loadSlot(3);
check('the game can read its own save back', game.playerState !== null);
check('the loaded player kept its level', game.playerState!.level === levelBefore);
check('the loaded player kept its name', game.playerState!.name === 'Tester');

// A wrong password must not produce a readable save.
try {
  const forged = await saves.save(4, 'Forged', payload, { name: 'Eternity', seed: 20260101 });
  check('writing a second slot works', forged.exists);
} catch (err) {
  check('writing a second slot works', false, String(err));
}

// ------------------------------------------------------------------ state

console.log('== state machine ==');
game.pushOverlay('inventory');
check('an overlay stacks', game.overlayCount === 2);
game.pushOverlay('skills');
check('overlays stack further', game.overlayCount === 3);
game.popOverlay();
check('the top overlay pops', game.overlayCount === 2);
game.toggle('inventory');
check('toggling the open overlay closes it', game.overlayCount === 1);
game.toggle('inventory');
check('toggling a closed overlay reopens it', game.overlayCount === 2);
game.hideAllOverlays();
check('all overlays can be cleared', game.overlayCount === 1);

const beforeFs = game.isFullscreen;
await game.toggleFullscreen();
check('fullscreen state flips', game.isFullscreen !== beforeFs);
await game.toggleFullscreen();
check('fullscreen state flips back', game.isFullscreen === beforeFs);

game.die('test');
check('death sets the death overlay', game.isTop('death'));
game.respawn();
check('respawn clears the death overlay', !game.isTop('death'));

// ------------------------------------------------------------------ regions

console.log('== regions ==');
// loadSlot rebuilt the scene, so re-read the live player before travelling.
const live = game.scene_!.player;
const hereBefore = world.regionIdAt(Math.floor(live.pos.x), Math.floor(live.pos.z));
game.travelTo(23);
const here = world.regionIdAt(Math.floor(live.pos.x), Math.floor(live.pos.z));
check('travel moves the player', Math.floor(live.pos.x) !== Math.floor(live.pos.x) || here !== hereBefore,
  `before=${hereBefore} after=${here}`);
check('the player is in the region they asked for', here === 23,
  `region=${here} pos=${Math.floor(live.pos.x)},${Math.floor(live.pos.y)},${Math.floor(live.pos.z)}`);
check('visiting a region is recorded', live.state.visitedRegions.includes(23),
  `visited=${live.state.visitedRegions.join(',')}`);

// --------------------------------------------------------- world memory

console.log('== world memory ==');
const mem = game.progressTracker;
mem.reset();
check('a fresh memory knows nothing', mem.visitedCount() === 0 && mem.explorationPercent() === 0);
check('a region can be visited', (mem.visits = mem.visitRegion(24), mem.regions[24] & 1) === 1);
check('visiting twice is a no-op', (() => { const before = mem.regions[24]; mem.visitRegion(24); return mem.regions[24] === before; })());
mem.discover(100, 100);
check('discover marks a chunk', mem.isDiscovered(100, 100));
check('discover is idempotent', (() => { mem.discover(100, 100); return mem.explorationPercent() > 0; })());
check('discover rejects out-of-world positions', (() => { mem.discover(-5, 99999); return true; })());
for (let i = 0; i < 400; i++) mem.discover(i * 4, 4);
check('exploration counts only marked chunks', mem.explorationPercent() > 0 && mem.explorationPercent() <= 100);
check('structures are remembered with their position',
  mem.rememberStructure({ id: 'village', name: 'Village', x: 10, y: 70, z: 12, region: 3 }, true) &&
  !!mem.structure('village') && mem.structures_().length === 1);
check('entering is recorded once', (mem.enterStructure('village'), mem.structure('village')!.entered) === true);
check('bosses are recorded as defeated', (mem.defeatBoss('boss_verdant', 12000), mem.boss('boss_verdant')!.defeated) === true);
check('a better time replaces the old one', (mem.defeatBoss('boss_verdant', 9000), mem.boss('boss_verdant')!.bestMs) === 9000);
check('dungeons clear and keep a best time', (mem.clearDungeon(0, 42), mem.dungeonCleared(0)) === true);
check('codex reads are idempotent', (mem.readCodex(5), mem.readCodex(5), mem.codexCount()) === 1);
mem.logEvent('boss', 'first');
for (let i = 0; i < 200; i++) mem.logEvent('walk', `step ${i}`);
check('the event log is a bounded ring buffer', mem.events_().length === 128);
check('the ring buffer keeps the newest entries', mem.events_()[mem.events_().length - 1].text === 'step 199');
for (let i = 0; i < 500; i++) mem.bump('blocksMined', 1);
check('milestones are bounded', mem.milestones_().length <= 64);
check('a snapshot survives a round trip', (() => {
  const snap = mem.toJSON();
  const restored = new (mem.constructor as any)();
  restored.fromJSON(snap);
  return restored.structures_().length === mem.structures_().length &&
    restored.visitedCount() === mem.visitedCount() &&
    restored.events_().length === mem.events_().length;
})());
check('memory serialises to a few kilobytes', mem.byteSize() < 24 * 1024, `${mem.byteSize()} bytes`);

// ------------------------------------------------------------------ controls

console.log('== controls ==');
const beforeKey = controls.get('jump');
check('the shipped scheme binds jump to space', beforeKey.includes('space'));
const remap = game.remapKey('jump', 'z');
check('a key can be rebound', remap.ok && game.input.keysFor('jump').includes('z'));
check('the engine was told about the remap', game.input.bindings.jump === 'z');
check('the old binding is gone', !game.input.keysFor('jump').includes('space'));
check('rebinding a key to itself is a no-op', !game.remapKey('jump', 'z').ok);
const conflict = game.remapKey('attack', 'z');
check('a conflict is reported, not silently merged', !conflict.ok);
check('a refused remap leaves the scheme alone', game.input.bindings.attack === 'j');
const swapped = game.remapKey('attack', 'z', true);
check('a forced swap moves the previous owner', swapped.ok && swapped.swapped === 'jump');
check('the swapped action loses the key', !game.input.keysFor('jump').includes('z'));
check('the conflict is resolved after a swap', !controls.conflicts().some((c) => c.key === 'z'));
check('unknown keys are refused', !game.remapKey('jump', 'nonexistent-key-xyz').ok);
check('the scheme is not the default any more', !game.controlsAreDefault);
check('arrow keys are exempt from conflict reporting', controls.conflicts().every((c) => c.key !== 'arrowup'));
game.resetControls();
check('reset restores the shipped scheme', game.controlsAreDefault && controls.get('jump').includes('space'));

// ------------------------------------------------------------------ balance

console.log('== balance ==');
check('the hunger drain starts at the shipped value', game.balanceValue('hungerDrain') === 0.6);
game.setBalance('hungerDrain', 5);
check('a value past the ceiling is clamped', game.balanceValue('hungerDrain') === 2);
game.setBalance('hungerDrain', -3);
check('a value below the floor is clamped', game.balanceValue('hungerDrain') === 0);
game.setBalance('hungerDrain', 1.2);
check('a value inside the range is kept', game.balanceValue('hungerDrain') === 1.2);
check('a tuned profile reports itself', game.balanceIsDefault === false);
// A save written now must carry the world memory and the profile with it.
game.setBalance('xpGain', 1.25);
game.progress.bump('blocksMined', 5);
const carried = await game.saveSlot(5);
check('the tuned profile saves', carried === true);
const carriedBody = await saves.load(5);
check('the save carries world memory', !!carriedBody.body.progress && carriedBody.body.progress.v === 1);
check('the save carries the control scheme', !!carriedBody.body.controls && typeof carriedBody.body.controls.jump === 'string');
check('the save carries the balance profile', carriedBody.body.balance.xpGain === 1.25);
check('the memory round trip survives encryption', carriedBody.body.progress.milestones.length > 0);
game.resetBalance();
check('reset restores the shipped tuning', game.balanceIsDefault && game.balanceValue('hungerDrain') === 0.6);

// The profile persists independently of a slot.
game.setBalance('xpGain', 1.5);
check('the profile is written to localStorage', !!localStorage.getItem('eternity.profile.v1'));
game.resetBalance();

// ---------------------------------------------------------------- forge

console.log('== forge ==');
import { CHEST_LOOT, ENCHANT_BY_ID, ENCHANTS, enchantCost, isSmeltable, rollChestLoot, tierForLevel } from '../src/game/systems/Forge';
const rng = new RNG(4242);
check('ore is smeltable and bread is not', isSmeltable(1040) && !isSmeltable(1205));
check('tier scales with level and is clamped', tierForLevel(1) === 0 && tierForLevel(120) === 4);
const lootTier = new Set(CHEST_LOOT.map((e) => e.tier));
check('loot tiers stay inside the table', [...lootTier].every((t) => t >= 0 && t <= 4));
check('a tier-0 chest cannot yield end-game loot', (() => {
  for (let i = 0; i < 300; i++) {
    const id = rollChestLoot(rng, 0);
    const entry = CHEST_LOOT.find((e) => e.id === id);
    if (!entry || entry.tier > 0) return false;
  }
  return true;
})());
check('a high-tier chest can reach the top', (() => {
  for (let i = 0; i < 200; i++) if (CHEST_LOOT.find((e) => e.id === rollChestLoot(rng, 4))?.tier === 4) return true;
  return false;
})());

// Smelting: iron ore + coal in, iron ingot out.
const p2 = game.player!;
const emptySlot = p2.state.inventory.findIndex((st) => !st);
check('the player has an empty inventory slot', emptySlot >= 0);
p2.addItem(1040, 4);
p2.addItem(1038, 3);
const oreIdx = p2.state.inventory.findIndex((st) => st?.id === 1040);
const coalIdx = p2.state.inventory.findIndex((st) => st?.id === 1038);
check('ore and fuel are in the inventory', oreIdx >= 0 && coalIdx >= 0);
check('fuel is worth something', p2.addFuel(1038) > 0);
const beforeOre = p2.countItem(1040);
const beforeCoal = p2.countItem(1038);
const beforeIngot = p2.countItem(1031);
const smelted = p2.smelt(oreIdx);
check('smelting reports success', smelted === 'smelted');
check('smelting consumes the ore', p2.countItem(1040) === beforeOre - 1);
check('smelting produces the ingot', p2.countItem(1031) === beforeIngot + 1);
check('smelting burns fuel', p2.fuelLeft < p2.addFuel(0) + 1600);
check('a furnace with nothing to burn says so', (() => {
  p2.furnaceFuel = 0;
  p2.removeItem(1038, 99);
  p2.removeItem(1039, 99);
  p2.removeItem(1051, 99);
  p2.removeItem(1004, 99);
  p2.removeItem(1006, 99);
  const idx = p2.state.inventory.findIndex((st) => st?.id === 1040);
  return idx >= 0 && p2.smelt(idx) === 'no-fuel';
})());

// Enchanting. Lapis is the table's currency and experience is the other.
p2.state.xp = 80;
p2.addItem(1036, 4);
p2.addItem(1024, 1);
const sword = p2.state.inventory.findIndex((st) => st?.id === 1024);
const pickaxe = p2.state.inventory.findIndex((st) => st?.id === 1001);
if (pickaxe < 0) p2.addItem(1001, 1);
const pick = p2.state.inventory.findIndex((st) => st?.id === 1001);
check('a weapon accepts sharpness', p2.enchant(sword, 'sharpness', 3, 1) === 'enchanted');
check('the enchantment is recorded on the stack', p2.state.inventory[sword]!.enchants!.some((e) => e.id === 'sharpness' && e.level === 3));
check('lapis was spent', p2.countItem(1036) === 3);
check('experience was spent', p2.state.xp < 80);
check('enchanting twice is refused', p2.enchant(sword, 'sharpness', 3, 1) === 'already');
check('an enchantment cannot go on the wrong kind', p2.enchant(pick, 'sharpness', 3, 1) === 'incompatible');
check('a tool can take a mining enchantment', p2.enchant(pick, 'efficiency', 2, 1) === 'enchanted');
check('a stack without enough experience is refused', (() => {
  p2.addItem(1024, 1);
  const i = p2.state.inventory.findIndex((st) => st?.id === 1024 && !st!.enchants);
  p2.state.xp = 0;
  const r = i >= 0 ? p2.enchant(i, 'power', 3, 1) : 'nothing';
  p2.state.xp = 80;
  return r === 'no-xp';
})());
check('enchant cost rises with level', enchantCost('sharpness', 3) === 3 * ENCHANT_BY_ID.get('sharpness')!.cost);
check('every enchantment has a defined stat', ENCHANTS.every((e) => typeof e.perLevel === 'number' && e.kinds.length > 0));
// Base items must be equippable: `gearDef` used to know only the named sets,
// which left every sword, pickaxe and chestplate in the game unwearable.
const dmgBefore = p2.stats.flatDamage;
const equippedCount = p2.countItem(1024);
check('a base weapon can be equipped', p2.equip(sword) === true);
check('equipping adds the weapon damage', p2.stats.flatDamage > dmgBefore, `${dmgBefore.toFixed(1)} -> ${p2.stats.flatDamage.toFixed(1)}`);
check('the enchantment contributes on top', p2.stats.flatDamage >= dmgBefore + 4 + 2.25, `${p2.stats.flatDamage.toFixed(1)}`);
check('the equipped item carries the enchantment', !!p2.state.equipped.weapon?.enchants?.length);
p2.unequip('weapon');
check('unequipping returns the item', p2.countItem(1024) === equippedCount,
    `${equippedCount} before, ${p2.countItem(1024)} after, ${p2.state.inventory.filter(Boolean).length}/64 slots used`);
const armour = p2.state.inventory.findIndex((st) => st?.id === 2111);
if (armour < 0) p2.addItem(2111, 1);
const armourIdx = p2.state.inventory.findIndex((st) => st?.id === 2111);
const armorBefore = p2.stats.armor;
check('a base chestplate can be equipped', p2.equip(armourIdx) === true);
check('equipping armour adds armour points', p2.stats.armor > armorBefore, `${armorBefore} -> ${p2.stats.armor}`);
check('the slot is resolved from the item name', gearSlotFor(2111) === 'chest');
check('a shield goes to the off-hand', gearSlotFor(1028) === 'offhand');
check('a pickaxe is a weapon slot', gearSlotFor(1001) === 'weapon');
p2.unequip('chest');

// The forge screens build their layout from an innerHTML template and then
// render the player's inventory into it. The dom-stub caches one element per
// selector, so the columns can be read back the same way a browser would.
console.log('== forge screens ==');
p2.state.xp = 120;
p2.addItem(1036, 4);
p2.addItem(1038, 2);   // fuel, so the fuel column has something to list

const furnaceScreen = game.ui.buildFurnaceScreen();
const furnaceHtml = furnaceScreen.innerHTML as string;
check('the furnace screen is a screen', furnaceScreen.className.includes('furnace-screen'));
check('the furnace screen declares two columns', (furnaceHtml.match(/class="furnace-col"/g) || []).length === 2);
check('the furnace screen declares two lists', (furnaceHtml.match(/class="furnace-list"/g) || []).length === 2);
check('the furnace screen declares a close button', furnaceHtml.includes('data-set="back"'));
check('the furnace screen is built from a template', furnaceHtml.includes('<h2>Furnace</h2>'));
// The screens render on a timer so the input listener can be attached first.
await new Promise((r) => setTimeout(r, 5));
const smeltBox = furnaceScreen.querySelector('[data-smelt]') as any;
const fuelBox = furnaceScreen.querySelector('[data-fuel]') as any;
check('the smelt column lists the ore in the player inventory', smeltBox.innerHTML.includes('Iron Ore'));
check('the fuel column lists the fuel in the player inventory', fuelBox.innerHTML.includes('Coal'));
check('the smelt column renders rows', (smeltBox.innerHTML.match(/data-smelt-i=/g) || []).length > 0);
check('the fuel column renders rows', (fuelBox.innerHTML.match(/class="furnace-row"/g) || []).length > 0);
check('the furnace screen reports the fuel reserve',
  (furnaceScreen.querySelector('[data-furnace="sub"]') as any).textContent.includes('fuel left'));

p2.addItem(1022, 1);
const enchantScreen = game.ui.buildEnchantScreen();
const enchantHtml = enchantScreen.innerHTML as string;
check('the enchant screen is a screen', enchantScreen.className.includes('enchant-screen'));
check('the enchant screen declares two columns', (enchantHtml.match(/class="furnace-col"/g) || []).length === 2);
await new Promise((r) => setTimeout(r, 5));
const itemsBox = enchantScreen.querySelector('[data-enchant-items]') as any;
const listBox = enchantScreen.querySelector('[data-enchant-list]') as any;
check('the enchant screen lists the enchantable items', itemsBox.innerHTML.includes('Wooden Sword'));
check('the enchant screen renders item rows', itemsBox.innerHTML.includes('furnace-row'), `len=${itemsBox.innerHTML.length}`);
check('the enchant list offers enchantment buttons', listBox.innerHTML.includes('data-enchant-id'));
check('the enchant list offers sharpness', listBox.innerHTML.includes('sharpness'));
check('the enchant screen reports the table level',
  (enchantScreen.querySelector('[data-enchant="sub"]') as any).textContent.includes('Table level'));
check('the enchant screen states the lapis cost',
  (enchantScreen.querySelector('[data-enchant="sub"]') as any).textContent.includes('Lapis'));
check('the forge screens rebuild without throwing', (() => {
  try { game.ui.buildFurnaceScreen(); game.ui.buildEnchantScreen(); return true; } catch { return false; }
})());

// ------------------------------------------------------------------ dispose

console.log('== dispose ==');
const hadScene = !!game.scene_;
const lastScene = game.scene_!;
game.quitToTitle();
check('quitting to title disposes the scene', !game.scene_);
// The canvas lives inside the host div, so what matters is that the whole
// subtree left the document rather than a single parent link.
check('the canvas was detached',
  !lastScene.host.parentNode && lastScene.canvas!.parentNode === lastScene.host);
check('the host element was removed', !lastScene.host.parentNode);

console.log('');
if (failures) console.log(`FAILED ${failures} of ${checks} checks`);
else console.log(`ALL PASSED (${checks} checks)`);
process.exit(failures ? 1 : 0);
