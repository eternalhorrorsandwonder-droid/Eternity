import test from "node:test";
import assert from "node:assert/strict";
import {
  newGame,
  addXp,
  xpRequired,
  maxHealth,
  spendTalent,
  acceptQuest,
  questProgress,
  completeQuest,
  normalizeSave,
  unlockAchievements,
  pruneRespawns,
  repairBeacon,
  openCache,
  enemyDamage,
} from "../src/core/state.js";
import { REGIONS, regionAt, regionCenter } from "../src/data/world.js";
import { ruinPlacements } from "../src/game/world.js";
import {
  encryptSave,
  decryptSave,
  saveSlot,
  loadSlot,
  listSlots,
  deleteSlot,
} from "../src/core/save.js";

test("all four chapters have ten distinct authored, addressable regions", () => {
  assert.equal(REGIONS.length, 40);
  assert.equal(REGIONS.filter(r => (r.chapter || 1) === 1).length, 10);
  assert.equal(REGIONS.filter(r => r.chapter === 2).length, 10);
  assert.equal(REGIONS.filter(r => r.chapter === 3).length, 10);
  assert.equal(REGIONS.filter(r => r.chapter === 4).length, 10);
  assert.equal(new Set(REGIONS.map((r) => r.id)).size, 40);
  for (const region of REGIONS) {
    const p = regionCenter(region);
    assert.equal(regionAt(p.x, p.z)?.id, region.id);
    assert.ok(region.npc);
    assert.ok(region.shrine);
    assert.ok(region.lore);
  }
  assert.equal(regionAt(0, 0).id, "haven");
  assert.equal(regionAt(54, 0).id, "fields");
  assert.equal(regionAt(0, 108).id, "lanternbridge");
  assert.equal(regionAt(0, 270).id, "meridianheart");
  assert.equal(regionAt(108, 324).id, "tidegate");
});
test("levels grant points and health, talents have hard caps", () => {
  const state = newGame();
  const threshold = xpRequired(1);
  assert.deepEqual(addXp(state, threshold), [2]);
  assert.equal(state.player.points, 1);
  assert.equal(state.player.hp, maxHealth(state.player));
  assert.equal(spendTalent(state, "vitality"), true);
  assert.equal(state.player.hp, maxHealth(state.player));
  assert.equal(spendTalent(state, "vitality"), false);
  state.player.points = 10;
  for (let i = 0; i < 10; i++) spendTalent(state, "might");
  assert.equal(state.player.talents.might, 9);
});
test("first request requires both echoes and the field waystone", () => {
  const state = newGame();
  acceptQuest(state, "first-light");
  state.stats.echoes = 3;
  assert.equal(questProgress(state, "first-light").ready, false);
  state.world.activated.push("fields");
  assert.equal(questProgress(state, "first-light").ready, true);
  const reward = completeQuest(state, "first-light");
  assert.ok(reward);
  assert.equal(state.player.skills.pulse, true);
  assert.equal(completeQuest(state, "first-light"), null);
});
test("item requests consume resources only once", () => {
  const state = newGame();
  state.player.bloom = 3;
  acceptQuest(state, "flowers");
  assert.equal(questProgress(state, "flowers").ready, true);
  completeQuest(state, "flowers");
  assert.equal(state.player.bloom, 0);
  assert.equal(state.player.potions, 5);
  assert.equal(completeQuest(state, "flowers"), null);
});
test("achievements are awarded once and respawn ledger is bounded on import", () => {
  const state = newGame();
  state.stats.defeated = 1;
  assert.equal(
    unlockAchievements(state).filter((a) => a.id === "first-step").length,
    1,
  );
  assert.equal(unlockAchievements(state).length, 0);
  state.world.respawns = {
    invented: Date.now() + 100000,
    "node:haven:0": Date.now() + 100000,
    "enemy:haven:0": Date.now() - 100,
  };
  const restored = normalizeSave(state);
  assert.deepEqual(Object.keys(restored.world.respawns), ["node:haven:0"]);
  pruneRespawns(restored, Date.now() + 200000);
  assert.equal(Object.keys(restored.world.respawns).length, 0);
});
test("AES-GCM saves round-trip and reject wrong passwords or tampering", async () => {
  const state = newGame();
  state.player.coins = 42;
  const envelope = await encryptSave(state, "a gentle secret");
  const restored = await decryptSave(envelope, "a gentle secret");
  assert.equal(restored.player.coins, 42);
  await assert.rejects(
    () => decryptSave(envelope, "wrong"),
    /passphrase|changed/i,
  );
  const data = Buffer.from(envelope.data, "base64");
  data[0] ^= 1;
  envelope.data = data.toString("base64");
  await assert.rejects(
    () => decryptSave(envelope, "a gentle secret"),
    /passphrase|changed/i,
  );
});

test("only authored, living wounded creatures survive save validation", () => {
  const state = newGame();
  state.world.wounded = {
    "enemy:haven:0": 12,
    "enemy:invented:4": 5,
    "node:haven:0": 3,
  };
  const restored = normalizeSave(state);
  assert.deepEqual(restored.world.wounded, { "enemy:haven:0": 12 });
  state.world.respawns["enemy:haven:0"] = Date.now() + 10000;
  assert.deepEqual(normalizeSave(state).world.wounded, {});
});

test("slot writes are ordered and damaged metadata never hides a save", async () => {
  const values = new Map();
  const previous = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (key) => (values.has(key) ? values.get(key) : null),
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: (key) => values.delete(key),
  };
  try {
    const first = newGame(),
      second = newGame();
    first.player.coins = 1;
    second.player.coins = 20;
    await Promise.all([saveSlot(0, first), saveSlot(0, second)]);
    assert.equal((await loadSlot(0)).player.coins, 20);
    values.set("eternity.vale.v1.meta.0", "{broken");
    assert.equal(listSlots()[0].empty, undefined);
    assert.equal((await loadSlot(0)).player.coins, 20);
    await deleteSlot(0);
    assert.equal(listSlots()[0].empty, true);
  } finally {
    globalThis.localStorage = previous;
  }
});

test("every authored region has a valid resident request and bounded interactables", async () => {
  const { QUESTS } = await import("../src/data/quests.js");
  const occupied = new Set();
  for (const region of REGIONS) {
    const coordinate = `${region.gx},${region.gz}`;
    assert.equal(occupied.has(coordinate), false);
    occupied.add(coordinate);
    assert.ok(QUESTS[region.npc.quest]);
    assert.ok(region.nodes.length > 0);
    assert.ok(region.enemies.length > 0);
    for (const [, x, z] of [...region.nodes, ...region.enemies])
      assert.ok(Math.abs(x) < 27 && Math.abs(z) < 27);
  }
});


test("beacons spend atomically once, persist and change local danger", () => {
  const s = newGame();
  s.player.echoes = 1; s.player.ore = 2;
  assert.equal(repairBeacon(s, "lanternbridge").reason, "materials");
  assert.equal(s.player.ore, 2);
  s.player.echoes = 2;
  const enemy = { type: "sentinel", level: 5, region: "lanternbridge" };
  const before = enemyDamage(s, enemy);
  assert.equal(repairBeacon(s, "lanternbridge").ok, true);
  assert.equal(s.player.echoes, 0);assert.equal(s.player.ore, 0);
  assert.ok(enemyDamage(s, enemy) < before);
  assert.equal(repairBeacon(s, "lanternbridge").reason, "already");
  assert.deepEqual(normalizeSave(s).world.beacons, ["lanternbridge"]);
});

test("cache rewards are one-time and survive save validation", () => {
  const s = newGame();
  assert.equal(openCache(s,"lanternbridge").ok, true);
  assert.equal(s.player.ore, 3);assert.equal(s.player.echoes, 1);
  assert.equal(openCache(s,"lanternbridge").reason, "already");
  assert.equal(s.player.ore, 3);
  s.world.openedCaches.push("fabricated");
  assert.deepEqual(normalizeSave(s).world.openedCaches, ["lanternbridge"]);
});

test("v1 saves migrate without discarding progress and validate current bounds", () => {
  const old = newGame();old.version = 1;
  delete old.world.beacons; delete old.world.openedCaches; delete old.player.skills.ward;
  old.player.level=6; old.player.points=4;old.player.talents.might=1;
  old.world.quests['first-light']='complete';old.player.skills.pulse=false;
  old.world.visited.push('fields');old.world.activated.push('fields');old.player.lastShrine='fields';
  const migrated=normalizeSave(old);
  assert.equal(migrated.version, 5);assert.equal(migrated.player.level, 6);
  assert.equal(migrated.player.points, 4);assert.equal(migrated.player.skills.pulse, true);
  assert.equal(migrated.player.lastShrine, 'fields');assert.deepEqual(migrated.world.beacons, []);
  const v2 = newGame();v2.player.x=0;v2.player.z=180;v2.world.visited.push('dawnreach');
  v2.player.points=999;v2.player.lastShrine='dawnreach';
  const restored=normalizeSave(v2);
  assert.equal(restored.player.z,180);assert.equal(restored.player.points,0);
  assert.equal(restored.player.lastShrine,'haven');assert.ok(restored.world.visited.includes('dawnreach'));
});

test("chapter quests and original completion awards count the right regions", () => {
  const s = newGame();s.world.visited.push(...REGIONS.filter(r=>r.chapter===2).map(r=>r.id));
  assert.equal(questProgress(s,'whole-reaches').ready,true);
  assert.equal(unlockAchievements(s).some(a=>a.id==='whole-vale'),false);
  s.world.visited.push(...REGIONS.filter(r=>!r.chapter && r.id!=='haven').map(r=>r.id));
  assert.equal(unlockAchievements(s).some(a=>a.id==='whole-vale'),true);
});

test('chronicle is bounded, persisted and rejects fabricated event IDs', async () => {
  const {CHRONICLE_LIMIT,recordEvent,describeEvent}=await import('../src/core/chronicle.js');
  const s=newGame();
  for(let i=0;i<CHRONICLE_LIMIT+12;i++) recordEvent(s,'fall','haven');
  assert.equal(s.world.events.length,CHRONICLE_LIMIT);
  assert.equal(recordEvent(s,'memory','__proto__'),false);
  s.world.events.push({type:'memory',id:'constructor',at:Date.now()},{type:'boss',id:'invented',at:Date.now()});
  const restored=normalizeSave(s);
  assert.equal(restored.world.events.length,CHRONICLE_LIMIT);
  assert.ok(restored.world.events.every(event=>describeEvent(event).includes('Larkspur Haven')));
});

test('prototype names cannot be used as talents or quest IDs', () => {
  const s=newGame();s.player.points=1;
  assert.equal(spendTalent(s,'toString'),false);assert.equal(s.player.points,1);
  assert.equal(acceptQuest(s,'constructor'),false);
  const raw=JSON.parse(JSON.stringify(s));raw.world.quests={toString:'active',constructor:'complete'};
  assert.deepEqual(normalizeSave(raw).world.quests,{});
  assert.throws(()=>normalizeSave({version:2,player:[],world:{}}),/compatible/);
});

test('deleting a slot is successful even if only its expendable metadata fails', async () => {
  const values=new Map();
  const old=globalThis.localStorage;
  globalThis.localStorage={getItem:k=>values.get(k)||null,setItem:(k,v)=>values.set(k,v),removeItem(k){if(k.includes('.meta.'))throw new Error('metadata blocked');values.delete(k);}};
  try {
    await saveSlot(0,newGame());
    await deleteSlot(0);
    assert.equal(listSlots()[0].empty,true);
    await assert.rejects(()=>loadSlot(-1),/Invalid save slot/);
    await assert.rejects(()=>deleteSlot(3),/Invalid save slot/);
  } finally { globalThis.localStorage=old; }
});

test('save normalization reconciles derived discovery and boss ledgers', () => {
  const raw=newGame();
  raw.world.visited=['haven'];raw.world.beacons=['lanternbridge'];raw.world.lore=['crown'];
  raw.world.quests={crown:'complete','last-signal':'complete'};
  raw.world.respawns={'enemy:crown:2':Date.now()+50000,'enemy:stormglass:2':Date.now()+50000};
  raw.world.wounded={'enemy:crown:2':20,'enemy:stormglass:2':30,'enemy:haven:0':99999};
  raw.stats.defeated=1.9;raw.stats.sentinels=100;
  const result=normalizeSave(raw);
  assert.ok(result.world.visited.includes('lanternbridge')&&result.world.visited.includes('crown'));
  assert.equal(result.world.flags.guardian,true);assert.equal(result.world.flags.warden,true);
  assert.equal(result.world.respawns['enemy:crown:2'],undefined);assert.equal(result.world.respawns['enemy:stormglass:2'],undefined);
  assert.equal(result.world.wounded['enemy:crown:2'],undefined);assert.equal(result.world.wounded['enemy:stormglass:2'],undefined);assert.equal(result.world.wounded['enemy:haven:0'],undefined);
  assert.equal(result.stats.sentinels,1);assert.equal(result.stats.defeated,1);
});

test('authored interactive objects do not start inside solid scenery', () => {
  for (const region of REGIONS) {
    const obstacles=[
      ...ruinPlacements(region).map(([x,z])=>({x,z,r:.48})),
      ...region.trees.map(([x,z,scale])=>({x,z,r:.53*scale})),
      ...region.rocks.map(([x,z,scale])=>({x,z,r:.7*scale})),
      ...(region.buildings||[]).map(([type,x,z,scale])=>({x,z,r:type==='cottage'?1.8:type==='forge'?2.1:type==='stall'?1.25:.85*scale})),
      ...(region.landmarks||[]).filter(([type])=>['crystals','anvil','windvane','observatory'].includes(type))
        .map(([type,x,z,scale])=>({x,z,r:(type==='observatory'?1.6:type==='crystals'?1:.5)*scale})),
      ...(region.landmarks||[]).filter(([type])=>type==='stonecircle').flatMap(([,x,z,scale])=>
        Array.from({length:7},(_,i)=>({x:x+Math.sin(i*Math.PI*2/7)*1.7*scale,z:z+Math.cos(i*Math.PI*2/7)*1.7*scale,r:.22*scale}))),
    ];
    const objects=[region.npc,region.shrine,region.lore,region.beacon,region.cache,region.archive,region.project,region.anchor,
      ...region.nodes.map(([,x,z])=>({x,z}))].filter(Boolean);
    for(const item of objects) for(const obstacle of obstacles)
      assert.ok(Math.hypot(item.x-obstacle.x,item.z-obstacle.z)>=obstacle.r+.35,
        `${region.id} interaction at ${item.x},${item.z} overlaps solid scenery`);
  }
});
