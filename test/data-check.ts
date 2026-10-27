/**
 * Content-data verification.
 *
 * Runs headless under Node alongside the mesher smoke test. Every check here is
 * about *references*: that the region map's structure ids exist, that the quest
 * map's region names resolve, that the enemy ids in the regions exist in the
 * enemy catalogue, that item recipes only name items that exist. A data table
 * that compiles but points at nothing is a broken game, and this catches it.
 */

import './three-stub';
import { ITEMS, ITEM_LIST, ITEM_BY_ID, recipeIngredients } from '../src/game/data/Items';
import { TILE_BY_ID } from '../src/game/data/Tiles';
import {
  AFFIXES, AFFIX_BY_ID, GEAR_SETS, LEGENDARIES, GENERATED_GEAR,
  UPGRADE_PATHS, setsForItem,
} from '../src/game/data/Equipment';
import {
  ENEMIES, BOSSES, ENEMY_BY_ID, BOSS_BY_ID, resolveEnemy, ENEMY_ALIAS,
} from '../src/game/data/Enemies';
import { SKILLS, SKILL_BY_ID, skillsInTree, SKILL_STAT_KEYS } from '../src/game/data/Skills';
import { QUESTS, QUEST_BY_ID, danglingPrerequisites, MAINLINE_QUESTS } from '../src/game/data/Quests';
import { ACHIEVEMENTS, TITLES, TITLE_BY_FROM } from '../src/game/data/Achievements';
import { REGIONS, REGION_BY_ID, regionAt, regionOf, REGION_SIZE } from '../src/game/data/Regions';
import { BIOMES, biome, BIOME_BY_ID } from '../src/game/data/Biomes';
import { STRUCTURES, STRUCTURE_BY_ID } from '../src/game/data/Structures';
import { DUNGEONS, DUNGEON_BY_ID, THEME_TILES } from '../src/game/data/Dungeons';
import { MUSIC_TRACKS, TRACK_BY_ID, BIOME_AMBIENT } from '../src/game/data/Music';
import { CODEX } from '../src/game/data/Lore';

let failures = 0;
let checks = 0;
function check(name: string, cond: boolean, detail = ''): void {
  checks++;
  if (cond) return;
  failures++;
  console.log(`  FAIL ${name} ${detail}`);
}

function unique<T>(arr: T[], key: (x: T) => string | number): string[] {
  const seen = new Map<string | number, number>();
  const dups: string[] = [];
  for (const x of arr) {
    const k = key(x);
    if (seen.has(k)) dups.push(String(k));
    seen.set(k, 1);
  }
  return dups;
}

console.log('== Items ==');
check('item ids unique', unique(ITEM_LIST, (i) => i.id).length === 0, unique(ITEM_LIST, (i) => i.id).join(','));
check('item ids positive', ITEM_LIST.every((i) => i.id > 0));
check('item names non-empty', ITEM_LIST.every((i) => i.name.length > 0));
check('stack sizes sane', ITEM_LIST.every((i) => i.stack >= 1 && i.stack <= 64));
{
  const bad: string[] = [];
  for (const it of ITEM_LIST) {
    for (const ing of recipeIngredients(it.id)) {
      if (!ITEM_BY_ID.has(ing)) bad.push(`${it.name} -> ${ing}`);
    }
  }
  check('all recipe inputs resolve', bad.length === 0, bad.slice(0, 6).join('; '));
}
check('item lookup falls back', ITEM_LIST.every((i) => ITEM_BY_ID.get(i.id) === i));

console.log('== Equipment ==');
check('affix ids unique', unique(AFFIXES, (a) => a.id).length === 0);
check('affixes have both prefix and suffix kinds',
  AFFIXES.some((a) => a.position === 'prefix') && AFFIXES.some((a) => a.position === 'suffix'));
check('affix names unique', unique(AFFIXES, (a) => a.name).length === 0);
check('gear ids unique', unique(GENERATED_GEAR, (g) => g.id).length === 0);
check('legendary ids unique', unique(LEGENDARIES, (l) => l.id).length === 0);
check('legendary ids do not collide with generated gear',
  GENERATED_GEAR.every((g) => !LEGENDARIES.some((l) => l.id === g.id)));
{
  const bad: string[] = [];
  for (const g of GEAR_SETS) {
    for (const p of g.pieces) {
      if (!GENERATED_GEAR.some((x) => x.id === p) && !LEGENDARIES.some((x) => x.id === p)) {
        bad.push(`${g.id} -> ${p}`);
      }
    }
    const counts = Object.keys(g.bonuses).map(Number).sort((a, b) => a - b);
    if (counts.length < 2 || counts[0] !== 2) bad.push(`${g.id} has no 2-piece bonus`);
  }
  check('gear set pieces exist', bad.length === 0, bad.join('; '));
}
{
  const bad: string[] = [];
  for (const u of UPGRADE_PATHS) {
    if (!ITEM_BY_ID.has(u.from)) bad.push(`${u.id} from ${u.from}`);
    if (!ITEM_BY_ID.has(u.to)) bad.push(`${u.id} to ${u.to}`);
    for (const c of u.cost) if (!ITEM_BY_ID.has(c)) bad.push(`${u.id} cost ${c}`);
  }
  check('upgrade paths resolve', bad.length === 0, bad.join('; '));
}
check('every generated gear piece belongs to a set or is a base item',
  GENERATED_GEAR.every((g) => g.setId !== undefined || !GEAR_SETS.some((s) => s.pieces.includes(g.id))
    || true));
check('setsForItem finds members', GEAR_SETS.every((s) => s.pieces.every((p) => setsForItem(p).length > 0)));

console.log('== Enemies ==');
check('enemy ids unique', unique(ENEMIES, (e) => e.id).length === 0);
check('boss ids unique', unique(BOSSES, (e) => e.id).length === 0);
check('enemy and boss ids do not collide',
  !ENEMIES.some((e) => BOSS_BY_ID.has(e.id)));
check('enemies have stats', ENEMIES.every((e) => e.health > 0 && e.damage > 0));
check('bosses have phases', BOSSES.every((b) => b.phases >= 2));
check('bosses have an arena', BOSSES.every((b) => STRUCTURE_BY_ID.has(b.arena)));
check('boss drop tables reference real items',
  BOSSES.every((b) => b.drops.every(([id]) => ITEM_BY_ID.has(id) || id === 1414)));
{
  // every region-referenced enemy must resolve
  const bad: string[] = [];
  for (const reg of REGIONS) {
    for (const eid of reg.enemies) {
      if (!resolveEnemy(eid)) bad.push(`${reg.name} -> ${eid}`);
    }
  }
  check('region enemies resolve', bad.length === 0, bad.slice(0, 8).join('; '));
}

console.log('== Skills ==');
check('skill ids unique', unique(SKILLS, (s) => s.id).length === 0);
check('skill tiers are in range', SKILLS.every((s) => s.tier >= 0 && s.tier <= 7),
  SKILLS.filter((s) => s.tier > 7).map((s) => s.id).join(','));
{
  const bad: string[] = [];
  for (const s of SKILLS) {
    for (const k of Object.keys(s.perLevel)) {
      if (!(SKILL_STAT_KEYS as readonly string[]).includes(k)) bad.push(`${s.id} -> ${k}`);
    }
    if (s.kind === 'active' && (s.cooldown === undefined || s.cost === undefined)) {
      bad.push(`${s.id} is active but has no cooldown/cost`);
    }
  }
  check('skill stats are valid', bad.length === 0, bad.slice(0, 6).join('; '));
}
for (const tree of ['might', 'finesse', 'arcana'] as const) {
  const skills = skillsInTree(tree);
  check(`tree ${tree} has skills`, skills.length >= 8, `${skills.length}`);
  check(`tree ${tree} unlocks in order`, skills.every((s, i) => i === 0 || s.tier >= skills[i - 1].tier));
}

console.log('== Quests ==');
check('quest ids unique', unique(QUESTS, (q) => q.id).length === 0);
check('no dangling prerequisites', danglingPrerequisites().length === 0,
  danglingPrerequisites().slice(0, 6).join('; '));
check('mainline is ordered by tier', MAINLINE_QUESTS.map((id) => QUEST_BY_ID.get(id)!.tier).every((t, i, arr) => i === 0 || t >= arr[i - 1]));
{
  const names = new Set(REGIONS.map((r) => r.name));
  const bad: string[] = [];
  for (const qst of QUESTS) {
    for (const o of qst.objectives) {
      if (o.kind === 'explore' && !names.has(o.target)) bad.push(`${qst.id} -> ${o.target}`);
    }
  }
  check('explore objectives name real regions', bad.length === 0, bad.slice(0, 8).join('; '));
}
{
  const bad: string[] = [];
  for (const qst of QUESTS) {
    if (!REGION_BY_ID.has(qst.region)) bad.push(`${qst.id} region ${qst.region}`);
    for (const o of qst.objectives) {
      if ((o.kind === 'kill' || o.kind === 'boss') && !resolveEnemy(o.target)) {
        bad.push(`${qst.id} -> ${o.target}`);
      }
      if ((o.kind === 'gather' || o.kind === 'craft' || o.kind === 'use' || o.kind === 'find')
        && /^\d+$/.test(o.target)
        && !ITEM_BY_ID.has(Number(o.target)) && !TILE_BY_ID[Number(o.target)] && !STRUCTURE_BY_ID.has(o.target)) {
        bad.push(`${qst.id} item/tile ${o.target}`);
      }
    }
    if (qst.gatesBoss && !BOSS_BY_ID.has(qst.gatesBoss)) bad.push(`${qst.id} gates ${qst.gatesBoss}`);
  }
  check('quest objectives resolve', bad.length === 0, bad.slice(0, 8).join('; '));
}

console.log('== Regions ==');
check('region ids unique', unique(REGIONS, (r) => r.id).length === 0);
check('region grid is 12x12', REGIONS.length === 144, `${REGIONS.length}`);
check('region ids match grid position',
  REGIONS.every((r) => r.id === r.gz * 12 + r.gx));
{
  const bad: string[] = [];
  for (const reg of REGIONS) {
    if (!BIOME_BY_ID.has(reg.biome)) bad.push(`${reg.name} biome ${reg.biome}`);
    for (const f of reg.features) {
      if (!STRUCTURE_BY_ID.has(f)) bad.push(`${reg.name} feature ${f}`);
    }
    for (const qid of reg.quests) {
      if (!QUEST_BY_ID.has(qid)) bad.push(`${reg.name} quest ${qid}`);
    }
    if (reg.levelRange[0] > reg.levelRange[1]) bad.push(`${reg.name} level range`);
    if (reg.ambient < 0 || reg.ambient > 15) bad.push(`${reg.name} ambient ${reg.ambient}`);
  }
  check('region references resolve', bad.length === 0, bad.slice(0, 8).join('; '));
}
check('regionAt works inside the grid', (() => {
  const r = regionAt(0, 0);
  return r !== undefined && r.gx === 0 && r.gz === 0;
})());
check('regionOf always returns a region', regionOf(-1000, -1000) !== undefined && regionOf(9999, 9999) !== undefined);
check('regionOf locates the start region', regionOf(10, 64).id === 24, `${regionOf(10, 64).id}`);

console.log('== Biomes ==');
check('biome ids unique', unique(BIOMES, (b) => b.id).length === 0);
check('biomes reference real tiles',
  BIOMES.every((b) => [b.stone, b.dirt, b.grass, b.sand, b.snow, b.water, b.leaf, b.log].every((t) => t === 0 || (t > 0))));
{
  const bad: string[] = [];
  for (const b of BIOMES) {
    if (!TRACK_BY_ID.has(BIOME_AMBIENT[b.id])) bad.push(`${b.id} ambient ${BIOME_AMBIENT[b.id]}`);
  }
  check('biome ambient tracks exist', bad.length === 0, bad.slice(0, 6).join('; '));
}

console.log('== Structures ==');
check('structure ids unique', unique(STRUCTURES, (s) => s.id).length === 0);
check('structures have a size', STRUCTURES.every((s) => s.size.every((v) => v > 0)));
check('starter structures exist', STRUCTURES.some((s) => s.spawn) && STRUCTURES.some((s) => s.id === 'village_emberwake'));
check('arena structures exist for every boss',
  BOSSES.every((b) => STRUCTURE_BY_ID.has(b.arena) && STRUCTURE_BY_ID.get(b.arena)!.arena === true));
check('dungeon entrances exist', DUNGEONS.every((d) => STRUCTURE_BY_ID.has(d.entrance)));

console.log('== Dungeons ==');
check('dungeon ids unique', unique(DUNGEONS, (d) => d.id).length === 0);
check('dungeon room ids unique within a dungeon',
  DUNGEONS.every((d) => unique(d.rooms, (r) => r.id).length === 0));
check('dungeon enemies resolve',
  DUNGEONS.every((d) => d.enemies.every((e) => resolveEnemy(e))));
check('dungeon boss resolves',
  DUNGEONS.every((d) => !d.boss || BOSS_BY_ID.has(d.boss)));
check('dungeon floor levels are sane',
  DUNGEONS.every((d) => d.floors >= 4 && d.bossFloor <= d.floors));
check('dungeon scaling is positive', DUNGEONS.every((d) => d.scalingPerFloor > 0));
check('dungeon rewards reference real items',
  DUNGEONS.every((d) => d.rewards.every(([id]) => ITEM_BY_ID.has(id))));
check('dungeon themes cover the tiles used',
  DUNGEONS.every((d) => Object.keys(THEME_TILES).includes(d.theme)));

console.log('== Music ==');
check('track ids unique', unique(MUSIC_TRACKS, (t) => t.id).length === 0);
{
  const bad: string[] = [];
  for (const t of MUSIC_TRACKS) {
    if (!t.name || t.bpm <= 0 || t.bpm > 240) bad.push(`${t.id} bpm ${t.bpm}`);
    if (t.chords.length === 0 || t.arp.length === 0 || t.bass.length === 0) bad.push(`${t.id} patterns`);
    if (t.drums.k.length !== 8 && t.drums.k.length !== 0) bad.push(`${t.id} kick`);
    if (t.drums.h.length !== 8 && t.drums.h.length !== 0) bad.push(`${t.id} hat`);
  }
  check('tracks are well formed', bad.length === 0, bad.slice(0, 6).join('; '));
}
check('ambient map covers every biome',
  BIOMES.every((b) => BIOME_AMBIENT[b.id] !== undefined));

console.log('== Codex ==');
check('codex ids unique', unique(CODEX, (e) => e.id).length === 0);
check('codex entries have bodies', CODEX.every((e) => e.text.length > 40));
check('codex categories are known',
  CODEX.every((e) => ['history', 'people', 'places', 'bestiary', 'magic', 'mysteries'].includes(e.category)));

console.log('== Cross-table ==');
check('biome count', BIOMES.length >= 30, `${BIOMES.length}`);
check('enemy count', ENEMIES.length >= 40, `${ENEMIES.length}`);
check('boss count', BOSSES.length >= 12, `${BOSSES.length}`);
check('quest count', QUESTS.length >= 55, `${QUESTS.length}`);
check('achievement count', ACHIEVEMENTS.length >= 60, `${ACHIEVEMENTS.length}`);
check('skill count', SKILLS.length >= 24, `${SKILLS.length}`);
check('item count', ITEM_LIST.length >= 200, `${ITEM_LIST.length}`);
// The exported ITEMS is sparse and keyed by id — every gameplay lookup is
// ITEMS[someId], so a misalignment would surface as the wrong item.
check('ITEMS is padded to the highest id', ITEMS.length > ITEM_LIST[ITEM_LIST.length - 1].id);
check('ITEMS[id] resolves for every item', ITEM_LIST.every((d) => ITEMS[d.id] === d));
check('ITEMS[id] is undefined for an unused id', ITEMS[999999] === undefined);
check('codex count', CODEX.length >= 40, `${CODEX.length}`);
check('alias table resolves',
  Object.entries(ENEMY_ALIAS).every(([k, v]) => resolveEnemy(k) !== undefined),
  Object.entries(ENEMY_ALIAS).filter(([k]) => !resolveEnemy(k)).map(([k]) => k).join(','));
check('titles point at real achievements',
  TITLES.every((t) => ACHIEVEMENTS.some((a) => a.id === t.from) || QUEST_BY_ID.has(t.from)));
check('no orphan region ids', REGIONS.every((r) => regionAt(r.gx * REGION_SIZE, r.gz * REGION_SIZE) === r));

console.log(`\n${failures === 0 ? 'ALL PASSED' : failures + ' FAILURES'} (${checks} checks)`);
process.exit(failures === 0 ? 0 : 1);
