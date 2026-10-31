import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { SOUND_REGIONS } from '../src/data/sound.js';
import { REGIONS, REGION_BY_ID, regionAt, regionCenter } from '../src/data/world.js';
import { QUESTS } from '../src/data/quests.js';
import { newGame, normalizeSave, acceptQuest, completeQuest, questProgress, unlockAchievements } from '../src/core/state.js';
import { recordEnemyDefeat } from '../src/core/bestiary.js';
import { navigationTarget } from '../src/core/navigation.js';
import { describeEvent } from '../src/core/chronicle.js';
import { GameEngine } from '../src/game/engine.js';
import { World } from '../src/game/world.js';
import { makeTideAnchor } from '../src/game/models.js';
import { createTideCycle, advanceTide, inTideSurge, repairTideAnchor, waterMovementFactor, TIDE_WARNING_SECONDS } from '../src/core/tides.js';
import { firstChargeHit, CHARGE_DISTANCE, CHARGE_HIT_RADIUS } from '../src/core/charge.js';

test('the ten Sound regions connect to the Wilds and have safe, authored points of interest',()=>{
  assert.equal(SOUND_REGIONS.length,10);
  assert.equal(new Set(SOUND_REGIONS.map(r=>r.id)).size,10);
  assert.equal(new Set(SOUND_REGIONS.map(r=>r.npc.id)).size,10);
  for (const r of SOUND_REGIONS) {
    assert.equal(regionAt(regionCenter(r).x,regionCenter(r).z).id,r.id);
    assert.equal(r.chapter,4);assert.equal(r.surges.length,2);
    assert.ok(r.roads.length>=2 && r.npc.tideReaction && r.lore.text && r.water.length);
    assert.ok(r.enemies.some(([type])=>type==='surger'));
    assert.equal(QUESTS[r.npc.quest].giver,r.npc.name);
    for (const surge of r.surges) {
      assert.ok(surge.radius>=2 && surge.radius<=3 && Number.isFinite(surge.offset));
      for (const item of [r.npc,r.shrine,r.anchor,r.lore])
        assert.ok(Math.hypot(surge.x-item.x,surge.z-item.z)>surge.radius+2.4,`${r.id}: warning too close to a fixed interaction`);
    }
  }
  assert.equal(regionAt(108,297).id,'tidegate');
  assert.equal(regionAt(108,296).id,'ashshore');
  assert.equal(REGIONS.length,40);
});

test('anchors spend atomically, record the repair once and change only local water',()=>{
  for (const region of SOUND_REGIONS) {
    const s=newGame();const {ore,echoes}=region.anchor.cost;
    s.player.ore=ore;s.player.echoes=echoes-1;
    assert.equal(repairTideAnchor(s,region.id).reason,'materials');
    assert.equal(s.player.ore,ore);assert.equal(s.player.echoes,echoes-1);
    s.player.echoes=echoes;
    assert.equal(waterMovementFactor(s,region.id),.72);
    assert.equal(repairTideAnchor(s,region.id).ok,true);
    assert.equal(s.player.ore,0);assert.equal(s.player.echoes,0);
    assert.equal(repairTideAnchor(s,region.id).reason,'already');
    assert.equal(waterMovementFactor(s,region.id),.88);
    assert.equal(waterMovementFactor(s,'haven'),.72);
    const events=s.world.events.filter(e=>e.type==='anchor');assert.equal(events.length,1);
    assert.match(describeEvent(events[0]),/Tide Anchor/);
    const loaded=normalizeSave(s);assert.deepEqual(loaded.world.tideAnchors,[region.id]);
    assert.ok(loaded.world.visited.includes(region.id));
  }
  const s=newGame();assert.equal(repairTideAnchor(s,'constructor').reason,'invalid');
  s.world.tideAnchors=['tidegate','tidegate','haven','constructor',null];
  assert.deepEqual(normalizeSave(s).world.tideAnchors,['tidegate']);
});

test('v4 saves migrate to schema five without invented repairs or observations',()=>{
  const s=newGame('Returning');s.version=4;delete s.world.tideAnchors;
  s.player.coins=4321;s.world.quests['the-order-we-change']='complete';
  s.world.bestiary={caster:{seen:true,defeated:2}};s.stats.casters=2;s.stats.defeated=2;
  const loaded=normalizeSave(s);
  assert.equal(loaded.version,5);assert.equal(loaded.player.coins,4321);
  assert.deepEqual(loaded.world.tideAnchors,[]);assert.equal(loaded.world.bestiary.surger,undefined);
  assert.equal(loaded.world.quests['the-order-we-change'],'complete');
  assert.equal(loaded.world.bestiary.caster.defeated,2);
});

test('a surge always presents its full warning and its hit radius matches the visible edge',()=>{
  const cycle=createTideCycle();
  assert.equal(advanceTide(cycle,100),false); // suspended-tab gap never skips the warning
  assert.equal(cycle.phase,'warning');assert.equal(cycle.remaining,TIDE_WARNING_SECONDS);
  assert.equal(advanceTide(cycle,1.49),false);assert.equal(cycle.phase,'warning');
  assert.equal(advanceTide(cycle,.02),true);assert.equal(cycle.phase,'rest');
  assert.equal(advanceTide(cycle,.1),false);
  const zone={x:4,z:-3,radius:2.5};
  assert.equal(inTideSurge(zone,{x:6.5,z:-3}),true);
  assert.equal(inTideSurge(zone,{x:6.5001,z:-3}),false);
});

test('live tide cycles damage only the occupied unrepaired region, reset on return, and stop after repair',()=>{
  const s=newGame();s.player.x=1;s.player.z=0;
  const zone=(offset=0)=>({x:0,z:0,radius:2,offset,cycle:createTideCycle(offset),warning:{visible:false},
    fill:{material:{opacity:0}},rim:{material:{opacity:0}}});
  const first={data:{id:'tidegate'},surges:[zone()]}, second={data:{id:'netwright'},surges:[zone()]};
  let current={id:'tidegate'},hits=0,rings=0;
  const fake={state:s,tideRegion:null,world:{get current(){return current;},records:()=>[first,second]},
    hurt:()=>hits++,addRing:()=>rings++,particles:{burst:()=>{}}};
  GameEngine.prototype.updateTides.call(fake,100);
  assert.equal(first.surges[0].warning.visible,true);assert.equal(second.surges[0].warning.visible,false);
  GameEngine.prototype.updateTides.call(fake,1.51);assert.equal(hits,1);assert.equal(rings,1);
  GameEngine.prototype.updateTides.call(fake,.1);assert.equal(hits,1);
  current={id:'netwright'};GameEngine.prototype.updateTides.call(fake,.1);
  assert.equal(first.surges[0].warning.visible,false);assert.equal(second.surges[0].cycle.phase,'rest');
  current={id:'tidegate'};GameEngine.prototype.updateTides.call(fake,.1);
  assert.equal(first.surges[0].cycle.phase,'rest');assert.ok(first.surges[0].cycle.remaining>2);
  s.world.tideAnchors.push('tidegate');GameEngine.prototype.updateTides.call(fake,100);
  assert.equal(first.surges[0].warning.visible,false);assert.equal(hits,1);
});

test('actual anchor interaction changes its model, awards XP only once and persists',()=>{
  const s=newGame();const region=REGION_BY_ID.tidegate;
  s.player.ore=10;s.player.echoes=10;s.player.x=0;s.player.z=0;
  const thing={kind:'anchor',region:'tidegate',x:1,z:0,model:makeTideAnchor(false)};
  const zone={warning:{visible:true}},record={surges:[zone]};let xp=0,saves=0;
  const fake={state:s,paused:false,dead:false,world:{regions:new Map([['tidegate',record]])},
    gainXp:n=>xp+=n,queueSave:()=>saves++,checkAchievements:()=>{},addRing:()=>{},
    particles:{burst:()=>{}},sound:{effect:()=>{}},ui:{toast:()=>{}}};
  GameEngine.prototype.interact.call(fake,thing);
  assert.equal(thing.model.userData.active,true);assert.equal(zone.warning.visible,false);
  assert.equal(xp,60);assert.equal(saves,1);assert.equal(s.player.ore,8);assert.equal(s.player.echoes,8);
  GameEngine.prototype.interact.call(fake,thing);assert.equal(xp,60);assert.equal(saves,1);assert.equal(s.player.ore,8);
  assert.deepEqual(normalizeSave(s).world.tideAnchors,['tidegate']);
});

test('all ten Sound requests accept retroactive progress and give each reward only once',()=>{
  for (const region of SOUND_REGIONS) {
    const s=newGame();s.player.ore=200;s.player.echoes=200;s.player.bloom=200;
    for (const r of SOUND_REGIONS) {
      assert.equal(repairTideAnchor(s,r.id).ok,true);
      s.world.visited.push(r.id);s.world.lore.push(r.id);
    }
    for(let i=0;i<5;i++) recordEnemyDefeat(s,'surger');
    if (region.id!=='tidegate') s.world.quests['opening-the-sound']='complete';
    const q=QUESTS[region.npc.quest];assert.equal(acceptQuest(s,q.id),true);
    assert.equal(questProgress(s,q).ready,true,q.id);
    const before={coins:s.player.coins,ore:s.player.ore,bloom:s.player.bloom};
    assert.ok(completeQuest(s,q.id));assert.equal(s.player.coins,before.coins+q.reward.coins);
    for(const item of ['ore','bloom']) {
      const cost=q.objectives.filter(o=>o.kind==='item' && o.item===item).reduce((sum,o)=>sum+o.amount,0);
      assert.equal(s.player[item],before[item]-cost,`${q.id}: ${item}`);
    }
    assert.equal(completeQuest(s,q.id),null);assert.equal(s.player.coins,before.coins+q.reward.coins);
    assert.equal(normalizeSave(s).world.quests[q.id],'complete');
  }
});

test('guidance follows anchor, material, return, and Sound story objectives',()=>{
  const s=newGame();s.world.quests['first-light']='complete';s.world.quests['first-beacon']='complete';
  s.world.quests['last-signal']='complete';s.world.quests['gate-of-questions']='complete';
  s.world.quests['measure-of-a-promise']='complete';s.world.quests['the-order-we-change']='complete';s.activeQuest='';
  assert.equal(navigationTarget(s).label,'Talk to Nia');
  acceptQuest(s,'opening-the-sound');s.player.ore=2;s.player.echoes=2;assert.equal(navigationTarget(s).kind,'anchor');
  s.world.tideAnchors.push('tidegate');assert.equal(navigationTarget(s).kind,'lore');
  s.world.lore.push('tidegate');assert.equal(navigationTarget(s).label,'Talk to Nia');
  completeQuest(s,'opening-the-sound');assert.equal(navigationTarget(s).label,'Talk to Tala');
  const unlocked=unlockAchievements(s);assert.ok(unlocked.some(a=>a.id==='first-tide'));
});

test('a tide-runner sweep hits the nearest collision without tunnelling',()=>{
  const a={x:0,z:0},b={x:10,z:0},player={x:6,z:0};
  assert.equal(firstChargeHit(a,b,player,[{x:3,z:0,r:.6}]).kind,'solid');
  assert.equal(firstChargeHit(a,b,player,[]).kind,'player');
  assert.equal(firstChargeHit(a,b,{x:6,z:CHARGE_HIT_RADIUS+.001},[]),null);
  assert.ok(firstChargeHit(a,b,{x:6,z:CHARGE_HIT_RADIUS},[]));
  assert.equal(firstChargeHit(a,b,null,[]),null);
});

function runnerFixture() {
  const s=newGame();s.player.x=5;s.player.z=0;
  const warning=new THREE.Group();
  const enemy={id:'enemy:tidegate:1',type:'surger',region:'tidegate',alive:true,x:0,z:0,homeX:0,homeZ:0,
    level:16,hp:100,maxHp:100,state:'chase',stateTime:0,cooldown:0,hitFlash:0,phase:0,pattern:0,aftershock:0,
    model:{position:new THREE.Vector3(),rotation:{y:0},userData:{ring:{visible:false,material:{},scale:{setScalar(){}}},body:{position:{y:0},scale:{setScalar(){}}},baseScale:1}},warnings:[warning]};
  let solids=[],hits=0;
  const fake={state:s,time:0,invulnerable:0,world:{colliders:()=>solids,enemies:()=>[enemy],npcs:()=>[]},
    ui:{toast:()=>{}},checkAchievements:()=>{},queueSave:()=>{},particles:{burst:()=>{}},addRing:()=>{},hurt:()=>hits++};
  for(const key of ['moveEnemy','directionToPlayer','showChargeAim','hideAim']) fake[key]=GameEngine.prototype[key].bind(fake);
  return {s,enemy,fake,setSolids:value=>solids=value,hits:()=>hits};
}

test('tide-runner locks its warning lane, cannot turn, and stops at scenery or a vulnerable player',()=>{
  const {s,enemy:e,fake,setSolids,hits}=runnerFixture();
  GameEngine.prototype.updateEnemies.call(fake,.05);
  assert.equal(e.state,'windup');assert.deepEqual(e.aim,{x:1,z:0});
  s.player.z=3;
  GameEngine.prototype.updateEnemies.call(fake,.6);
  assert.equal(e.warnings[0].visible,true);assert.deepEqual(e.aim,{x:1,z:0});
  GameEngine.prototype.updateEnemies.call(fake,.66);
  assert.equal(e.state,'charging');assert.equal(e.warnings[0].visible,false);
  GameEngine.prototype.updateEnemies.call(fake,1);
  assert.equal(e.state,'recover');assert.ok(Math.abs(e.x-CHARGE_DISTANCE)<.001);assert.equal(hits(),0);
  e.x=0;e.z=0;e.state='charging';e.chargeRemaining=CHARGE_DISTANCE;e.aim={x:1,z:0};s.player.z=0;
  setSolids([{x:3,z:0,r:.6}]);GameEngine.prototype.updateEnemies.call(fake,1);
  assert.equal(e.state,'recover');assert.ok(e.x<2.01);assert.equal(hits(),0);
  e.x=0;e.z=0;e.state='charging';e.chargeRemaining=CHARGE_DISTANCE;setSolids([]);
  GameEngine.prototype.updateEnemies.call(fake,1);
  assert.equal(e.state,'recover');assert.equal(hits(),1);assert.ok(e.x<5-CHARGE_HIT_RADIUS+.01);
});

test('a dodge avoids a runner charge; a flash interrupts a charge without paying twice',()=>{
  const {s,enemy:e,fake,hits}=runnerFixture();
  e.state='charging';e.aim={x:1,z:0};e.chargeRemaining=CHARGE_DISTANCE;
  fake.invulnerable=.3;GameEngine.prototype.updateEnemies.call(fake,1);
  assert.equal(hits(),0);assert.equal(e.state,'recover');assert.ok(e.x>5);
  e.x=1;e.z=0;e.state='charging';e.chargeRemaining=CHARGE_DISTANCE;e.warnings[0].visible=true;
  s.player.x=0;s.player.z=0;s.player.kit.supplies.flash=1;
  Object.assign(fake,{paused:false,dead:false,orientationBlocked:false,cooldowns:{kit:0},kitTimers:{haste:0,regen:0},
    sound:{effect:()=>{}},floaters:[],nextFloat:0});
  GameEngine.prototype.useKit.call(fake);
  assert.equal(e.state,'stunned');assert.equal(e.warnings[0].visible,false);assert.equal(s.player.kit.supplies.flash,0);
});


test('a runner cannot resume an unseen charge after distance or streaming out',()=>{
  const {s,enemy:e,fake}=runnerFixture();
  e.state='charging';e.chargeRemaining=5;e.warnings[0].visible=true;s.player.x=100;
  GameEngine.prototype.updateEnemies.call(fake,.1);
  assert.equal(e.state,'return');assert.equal(e.chargeRemaining,0);assert.equal(e.warnings[0].visible,false);

  const scene={add:()=>{},remove:()=>{}},world=new World(scene,newGame());
  world.build=region=>{
    const enemy=region.id==='haven' ? {type:'surger',state:'windup',stateTime:.9,chargeRemaining:7,warnings:[{visible:true}],model:{userData:{ring:{visible:true}}}} : null;
    const record={data:region,group:{},colliders:[],enemies:enemy?[enemy]:[],npcs:[]};world.regions.set(region.id,record);return record;
  };
  world.updateStreaming(0,0);const dormant=world.regions.get('haven').enemies[0];
  world.updateStreaming(108,324);assert.equal(dormant.state,'return');assert.equal(dormant.warnings[0].visible,false);
});
