import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCHIVES, ARCHIVE_GLYPHS } from '../src/data/archives.js';
import { CHARMS } from '../src/data/gear.js';
import { MERIDIAN } from '../src/data/meridian.js';
import { QUESTS } from '../src/data/quests.js';
import { rotateArchive, submitArchive, readArchive, archiveCount, buildProject, projectRewardFactor } from '../src/core/frontier.js';
import { canCraftCharm, craftCharm, equipCharm } from '../src/core/gear.js';
import { newGame, normalizeSave, addXp, LEVEL_CAP, TALENT_CAPS, spendTalent, maxHealth, attackPower, dashCooldown, pulsePower, pulseCooldown, remedyPower, acceptQuest, questProgress, completeQuest, enemyDamage, unlockAchievements } from '../src/core/state.js';
import { encryptSave, decryptSave } from '../src/core/save.js';
import { firstProjectileHit, segmentCircleHit } from '../src/core/collision.js';

function turnToSolution(state,id) {
  const solution=ARCHIVES[id].solution;
  for(let index=0;index<3;index++) {
    const target=ARCHIVE_GLYPHS.findIndex(glyph=>glyph.id===solution[index]);
    while(readArchive(state,id).dials[index]!==target)
      assert.equal(rotateArchive(state,id,index).ok,true);
  }
}
function align(state,id) {turnToSolution(state,id); return submitArchive(state,id);}

test('all ten hand-authored archives have valid clues, solutions, placements and rewards', () => {
  assert.equal(Object.keys(ARCHIVES).length,10);
  for(const region of MERIDIAN) {
    const archive=ARCHIVES[region.id];
    assert.ok(region.archive && region.project && archive && region.roads.length===2);
    assert.equal(archive.solution.length,3);
    assert.ok(archive.inscription.length>45 && archive.fragment.length>45);
    assert.ok(archive.solution.every(id=>ARCHIVE_GLYPHS.some(glyph=>glyph.id===id)));
    assert.ok(archive.reward.xp>0 && archive.reward.coins>0);
    for(const road of region.roads) {
      assert.ok(road.points.length>=4 && road.width>0);
      const start=road.points[0],end=road.points.at(-1);
      assert.ok((start[0]===-27 && end[0]===27) || (start[1]===-27 && end[1]===27));
    }
  }
});

test('wrong alignments preserve progress, solved archives pay only once, including after reload', () => {
  const s=newGame();
  assert.equal(submitArchive(s,'southgate').reason,'alignment');
  assert.equal(readArchive(s,'southgate').attempts,1);
  rotateArchive(s,'southgate',1);
  const partial=normalizeSave(s);
  assert.deepEqual(readArchive(partial,'southgate').dials,[0,1,0]);
  const result=align(partial,'southgate');
  assert.equal(result.ok,true);
  assert.equal(result.entry.attempts,2);
  const coins=partial.player.coins,ore=partial.player.ore;
  assert.equal(submitArchive(partial,'southgate').reason,'solved');
  assert.equal(rotateArchive(partial,'southgate',1).reason,'solved');
  const saved=normalizeSave(partial);
  assert.equal(submitArchive(saved,'southgate').reason,'solved');
  assert.equal(saved.player.coins,coins);assert.equal(saved.player.ore,ore);
  assert.equal(saved.world.events.filter(event=>event.type==='archive' && event.id==='southgate').length,1);
});

test('normalization rejects forged, malformed and unknown archive and project state', () => {
  const s=newGame();
  s.world.archives={southgate:{dials:[0,0,0],solved:true,attempts:900},copperwood:{dials:[NaN,0,3],solved:true},invented:{dials:[0,1,2],solved:true}};
  s.world.projects={southgate:'shelter',invented:'watch',copperwood:'both'};
  s.player.gear={owned:['keen-edge','keen-edge','invented','toString'],equipped:'invented'};
  const out=normalizeSave(s);
  assert.equal(out.world.archives.southgate.solved,false);
  assert.equal(out.world.archives.southgate.attempts,99);
  assert.equal(out.world.archives.copperwood.solved,false);
  assert.equal(out.world.archives.invented,undefined);
  assert.deepEqual(out.world.projects,{southgate:'shelter'});
  assert.deepEqual(out.player.gear,{owned:['keen-edge'],equipped:null});
  assert.ok(out.world.visited.includes('southgate'));
});

test('each real archive can be solved, grants its own one-time reward and unlocks the archive milestone', () => {
  const s=newGame();
  for(const id of Object.keys(ARCHIVES)) {
    const before=s.player.coins;
    const result=align(s,id);
    assert.equal(result.ok,true,id);
    assert.equal(s.player.coins-before,ARCHIVES[id].reward.coins);
  }
  assert.equal(archiveCount(s),10);
  const achievements=unlockAchievements(s).map(a=>a.id);
  assert.ok(achievements.includes('first-archive') && achievements.includes('archives-all'));
  assert.equal(archiveCount(normalizeSave(s)),10);
});

test('restoration checks materials atomically and the chosen local effect is permanent', () => {
  const s=newGame();s.player.ore=1;s.player.bloom=5;
  assert.equal(buildProject(s,'southgate','shelter').reason,'materials');
  assert.equal(s.player.ore,1);assert.equal(s.player.bloom,5);
  s.player.ore=2;
  const enemy={type:'caster',level:11,region:'southgate'};
  const before=enemyDamage(s,enemy);
  assert.equal(buildProject(s,'southgate','shelter').ok,true);
  assert.equal(s.player.ore,0);assert.equal(s.player.bloom,3);
  assert.equal(enemyDamage(s,enemy),Math.round(before*.85));
  assert.equal(buildProject(s,'southgate','watch').reason,'already');
  assert.equal(normalizeSave(s).world.projects.southgate,'shelter');
  assert.equal(projectRewardFactor(s,'southgate'),1);
  s.player.ore=20;s.player.bloom=20;
  assert.equal(buildProject(s,'copperwood','watch').ok,true);
  assert.equal(projectRewardFactor(s,'copperwood'),1.25);
  assert.equal(projectRewardFactor(s,'southgate'),1);
});

test('multi-objective requests accept pre-completed world actions and consume deliveries once', () => {
  const s=newGame();s.player.ore=20;s.player.bloom=20;
  align(s,'copperwood');buildProject(s,'copperwood','watch');
  assert.equal(acceptQuest(s,'orchard-after-fire'),true);
  assert.equal(questProgress(s,'orchard-after-fire').ready,true);
  const before=s.player.bloom,coins=s.player.coins;
  assert.ok(completeQuest(s,'orchard-after-fire'));
  assert.equal(s.player.bloom,before-3);
  assert.equal(s.player.coins,coins+QUESTS['orchard-after-fire'].reward.coins);
  assert.equal(completeQuest(s,'orchard-after-fire'),null);
  assert.equal(s.player.bloom,before-3);
  const out=normalizeSave(s);
  assert.equal(out.world.quests['orchard-after-fire'],'complete');
  assert.equal(out.world.projects.copperwood,'watch');
});

test('multi-objective quest is never rewarded before every task is met', () => {
  const s=newGame();s.player.ore=3;s.player.bloom=3;
  acceptQuest(s,'gate-of-questions');
  assert.equal(questProgress(s,'gate-of-questions').details.length,2);
  align(s,'southgate');
  assert.equal(questProgress(s,'gate-of-questions').current,1);
  const coins=s.player.coins;
  assert.equal(completeQuest(s,'gate-of-questions'),null);
  assert.equal(s.player.coins,coins);
  buildProject(s,'southgate','shelter');
  assert.equal(questProgress(s,'gate-of-questions').ready,true);
  assert.ok(completeQuest(s,'gate-of-questions'));
});

test('charm recipes require unlocks and resources, and equipment effects have the stated trade-offs', () => {
  const s=newGame();s.player.ore=50;s.player.bloom=50;s.player.echoes=50;
  assert.equal(canCraftCharm(s,'swift-thread').reason,'locked');
  assert.equal(craftCharm(s,'oak-heart').ok,true);
  assert.equal(craftCharm(s,'oak-heart').reason,'owned');
  assert.equal(equipCharm(s,'oak-heart'),true);assert.equal(maxHealth(s.player),124);
  assert.equal(craftCharm(s,'keen-edge').ok,true);
  assert.equal(equipCharm(s,'keen-edge'),true);assert.equal(maxHealth(s.player),90);assert.equal(attackPower(s.player),19);
  assert.equal(equipCharm(s,'invented'),false);
  assert.equal(equipCharm(s,null),true);assert.equal(maxHealth(s.player),100);
  for(const id of Object.keys(ARCHIVES).slice(0,8)) align(s,id);
  for(const charm of CHARMS) if(!s.player.gear.owned.includes(charm.id)) assert.equal(craftCharm(s,charm.id).ok,true,charm.id);
  equipCharm(s,'swift-thread');assert.equal(dashCooldown(s.player),3);
  equipCharm(s,'garden-vial');assert.equal(remedyPower(s.player),65);
  equipCharm(s,'resonant-glass');assert.equal(pulseCooldown(s.player),7.5);assert.ok(Math.abs(pulsePower(s.player)-attackPower(s.player)*1.15*1.2)<1e-9);
  equipCharm(s,'storm-anchor');assert.equal(dashCooldown(s.player),3.5);
  assert.equal(normalizeSave(s).player.gear.equipped,'storm-anchor');
});

test('level 30 supplies exactly enough points to fill all four talent trees', () => {
  const s=newGame();addXp(s,1e9);
  assert.equal(s.player.level,LEVEL_CAP);assert.equal(s.player.points,29);
  for(const [talent,cap] of Object.entries(TALENT_CAPS))
    for(let i=0;i<cap;i++) assert.equal(spendTalent(s,talent),true);
  assert.equal(s.player.points,0);
  assert.equal(pulseCooldown(s.player),5);
  const saved=normalizeSave(s);
  assert.deepEqual(saved.player.talents,s.player.talents);
});

test('encrypted v2 payloads migrate while retaining previous fields and initialize current schema safely', async () => {
  const old=newGame('Mira');old.version=2;
  delete old.world.archives;delete old.world.projects;delete old.player.gear;
  delete old.player.talents.focus;delete old.stats.casters;
  old.player.level=12;old.player.coins=123;old.player.skills.ward=true;
  old.world.beacons=['lanternbridge'];old.world.openedCaches=['lanternbridge'];old.world.flags.warden=true;
  const out=await decryptSave(await encryptSave(old,'secret'),'secret');
  assert.equal(out.version,5);assert.equal(out.player.name,'Mira');assert.equal(out.player.coins,123);
  assert.deepEqual(out.world.beacons,['lanternbridge']);assert.equal(out.player.skills.ward,true);
  assert.equal(out.world.flags.warden,true);assert.deepEqual(out.world.archives,{});
  assert.deepEqual(out.world.projects,{});assert.deepEqual(out.player.gear,{owned:[],equipped:null});
});

test('swept projectiles hit the nearest target without tunnelling through solids or the player', () => {
  assert.equal(segmentCircleHit(0,0,10,0,5,0,1),.4);
  assert.equal(segmentCircleHit(0,0,10,0,5,2,1),null);
  assert.equal(segmentCircleHit(0,0,0,0,0,0,1),0);
  const from={x:0,z:0},to={x:20,z:0},player={x:15,z:0};
  assert.equal(firstProjectileHit(from,to,.2,player,[{x:8,z:0,r:1}]).kind,'solid');
  assert.equal(firstProjectileHit(from,to,.2,{x:5,z:0},[{x:8,z:0,r:1}]).kind,'player');
  assert.equal(firstProjectileHit(from,to,.2,{x:5,z:3},[{x:8,z:3,r:1}]),null);
});

test('all ten Meridian residents have valid objectives and each request pays once', () => {
  for (const region of MERIDIAN) {
    const s=newGame();s.player.ore=200;s.player.bloom=200;s.player.echoes=200;
    for(const entry of MERIDIAN) {
      align(s,entry.id);
      assert.equal(buildProject(s,entry.id,'shelter').ok,true);
      s.world.visited.push(entry.id);s.world.lore.push(entry.id);
    }
    s.stats.defeated=4;s.stats.casters=4;s.world.flags.tempest=true;
    const quest=QUESTS[region.npc.quest];
    assert.ok(quest && quest.kind==='milestones' && quest.giver===region.npc.name,region.id);
    assert.ok(quest.objectives.every(o=>o.label && (o.id || o.amount)),region.id);
    assert.equal(acceptQuest(s,quest.id),true);
    assert.ok(questProgress(s,quest.id).ready,quest.id);
    const resources={ore:s.player.ore,bloom:s.player.bloom,echoes:s.player.echoes},coins=s.player.coins;
    assert.ok(completeQuest(s,quest.id),quest.id);
    const costs=quest.objectives.filter(o=>o.kind==='item');
    for(const key of Object.keys(resources))
      assert.equal(s.player[key],resources[key]-costs.filter(o=>o.item===key).reduce((sum,o)=>sum+o.amount,0),`${quest.id} ${key}`);
    assert.equal(s.player.coins,coins+quest.reward.coins);
    assert.equal(completeQuest(s,quest.id),null);
    assert.equal(s.player.coins,coins+quest.reward.coins);
    assert.equal(normalizeSave(s).world.quests[quest.id],'complete');
  }
});

test('authored objectives remain distinct and encounter spawn points avoid solid scenery', async () => {
  const { REGIONS }=await import('../src/data/world.js');
  const { ruinPlacements }=await import('../src/game/world.js');
  for(const region of REGIONS) {
    const interactables=[region.npc,region.extraNpc,region.shrine,region.lore,region.archive,region.project,region.beacon,region.cache,region.anchor,
      ...region.nodes.map(([,x,z])=>({x,z}))].filter(Boolean);
    for(let i=0;i<interactables.length;i++) for(let j=i+1;j<interactables.length;j++)
      assert.ok(Math.hypot(interactables[i].x-interactables[j].x,interactables[i].z-interactables[j].z)>=1.8,
        `${region.id} has overlapping interactables at ${interactables[i].x},${interactables[i].z}`);
    const solids=[
      ...ruinPlacements(region).map(([x,z])=>({x,z,r:.48})),
      ...region.trees.map(([x,z,scale])=>({x,z,r:.53*scale})),
      ...region.rocks.map(([x,z,scale])=>({x,z,r:.7*scale})),
      ...(region.buildings||[]).map(([type,x,z,scale])=>({x,z,r:type==='cottage'?1.8:type==='forge'?2.1:type==='stall'?1.25:.85*scale})),
      ...(region.landmarks||[]).filter(([type])=>['crystals','anvil','windvane','observatory'].includes(type))
        .map(([type,x,z,scale])=>({x,z,r:(type==='observatory'?1.6:type==='crystals'?1:.5)*scale})),
      ...(region.landmarks||[]).filter(([type])=>type==='arch').flatMap(([,x,z,scale])=>[-1,1].map(side=>({x:x+side*1.2*scale,z,r:.32*scale}))),
      ...(region.landmarks||[]).filter(([type])=>type==='stonecircle').flatMap(([,x,z,scale])=>
        Array.from({length:7},(_,i)=>({x:x+Math.sin(i*Math.PI*2/7)*1.7*scale,z:z+Math.cos(i*Math.PI*2/7)*1.7*scale,r:.22*scale}))),
      ...[[region.shrine,.8],[region.lore,.55],[region.archive,1.05],[region.project,.55],[region.beacon,.7],[region.cache,.5],[region.anchor,.7]]
        .filter(([item])=>item).map(([item,r])=>({...item,r})),
      ...region.nodes.filter(([type])=>type==='ore').map(([,x,z])=>({x,z,r:.5})),
    ];
    for(const [type,x,z] of region.enemies) for(const solid of solids)
      assert.ok(Math.hypot(x-solid.x,z-solid.z)>=solid.r+.38,
        `${region.id} ${type} spawns inside scenery at ${solid.x},${solid.z}`);
  }
});

test('inventory credits share import limits and lifetime counters remain bounded', async () => {
  const {INVENTORY_LIMIT,STAT_LIMIT,creditInventory,creditStat}=await import('../src/core/limits.js');
  const s=newGame();s.player.ore=INVENTORY_LIMIT-1;s.stats.earned=STAT_LIMIT-1;
  assert.equal(creditInventory(s.player,'ore',5),1);
  creditStat(s.stats,'earned',50);
  assert.equal(s.player.ore,INVENTORY_LIMIT);assert.equal(s.stats.earned,STAT_LIMIT);
  const out=normalizeSave(s);
  assert.equal(out.player.ore,s.player.ore);assert.equal(out.stats.earned,s.stats.earned);
});
