import test from "node:test";
import assert from "node:assert/strict";
import { GameEngine } from "../src/game/engine.js";
import { World } from "../src/game/world.js";
import { newGame } from "../src/core/state.js";

test("movement substeps prevent tunnelling and handle an exact-center collision", () => {
  const state = newGame();
  state.player.x = -3;
  state.player.z = 0;
  const fake = {
    state,
    world: {
      colliders: () => [{ x: 0, z: 0, r: 1 }],
      enemies: () => [],
      npcs: () => [],
    },
  };
  GameEngine.prototype.movePlayer.call(fake, 6, 0);
  assert.ok(state.player.x <= -1.31);
  state.player.x = 0;
  GameEngine.prototype.movePlayer.call(fake, 0, 0);
  assert.ok(Number.isFinite(state.player.x));
  assert.ok(Math.hypot(state.player.x, state.player.z) >= 1.31);
});

test("a strike hits only living enemies ahead and within range", () => {
  const state = newGame();
  state.player.x = 0;
  state.player.z = 0;
  const hits = [];
  const enemies = [
    { id: "front", x: 1, z: 0, type: "hush", alive: true },
    { id: "behind", x: -1, z: 0, type: "hush", alive: true },
    { id: "far", x: 4, z: 0, type: "hush", alive: true },
    { id: "dead", x: 1, z: 0, type: "hush", alive: false },
  ];
  const fake = {
    state,
    world: { enemies: () => enemies },
    hitEnemy: (e) => hits.push(e.id),
    addRing: () => {},
    sound: { effect: () => {} },
    shake: 0,
  };
  GameEngine.prototype.resolveStrike.call(fake, { x: 1, y: 0 });
  assert.deepEqual(hits, ["front"]);
});

test("the authored Amber Run bridge avoids the water movement penalty", () => {
  // Amber Run is centered at x=108; its eastern pond is centered at (14,10).
  assert.equal(World.prototype.inWater.call(null, 122, 10), false);
  assert.equal(World.prototype.inWater.call(null, 122, 12), true);
});


test("ward softens only one hit and respects invulnerability", () => {
  const state = newGame();
  const fake = {state,dead:false,invulnerable:0,wardTimer:3,wardAura:{visible:true},kitTimers:{regen:0},
    ui:{toast:()=>{}},sound:{effect:()=>{}},particles:{burst:()=>{}},floaters:[],nextFloat:0,
    movePlayer:()=>{},queueSave:()=>{}};
  GameEngine.prototype.hurt.call(fake,20,{x:1,z:0});
  assert.equal(state.player.hp,93);assert.equal(fake.wardTimer,0);assert.equal(fake.wardAura.visible,false);
  GameEngine.prototype.hurt.call(fake,20,{x:1,z:0});
  assert.equal(state.player.hp,93);
  fake.invulnerable=0;GameEngine.prototype.hurt.call(fake,20,{x:1,z:0});
  assert.equal(state.player.hp,73);
});

test("enemy collision resolves even when centered inside an obstacle", () => {
  const fake={world:{colliders:()=>[{x:0,z:0,r:1}]}};
  const enemy={x:0,z:0};GameEngine.prototype.moveEnemy.call(fake,enemy,0,0);
  assert.ok(Number.isFinite(enemy.x));assert.ok(Math.hypot(enemy.x,enemy.z)>=1.37);
});

test('lethal boss hits skip the phase warning and cannot award defeat twice', () => {
  const state=newGame(),messages=[];
  const fake={state,ui:{toast:(title)=>messages.push(title)},particles:{burst:()=>{}},sound:{effect:()=>{}},
    floaters:[],nextFloat:0,gainXp:()=>{},checkAchievements:()=>{},queueSave:()=>{},hideAim:()=>{}};
  const enemy={id:'enemy:stormglass:2',type:'warden',alive:true,hp:50,maxHp:200,x:0,z:0,level:14,
    model:{visible:true,userData:{ring:{visible:true}}}};
  fake.defeat=e=>GameEngine.prototype.defeat.call(fake,e);
  GameEngine.prototype.hitEnemy.call(fake,enemy,100);
  const coins=state.player.coins,echoes=state.player.echoes;
  GameEngine.prototype.defeat.call(fake,enemy);
  assert.equal(state.world.flags.warden,true);assert.equal(state.stats.defeated,1);
  assert.equal(state.player.coins,coins);assert.equal(state.player.echoes,echoes);
  assert.deepEqual(messages,['The warden is quiet']);
});

test('equipped damage-reduction charm and ward stack without bypassing invulnerability', () => {
  const state=newGame();state.player.gear={owned:['stone-scale'],equipped:'stone-scale'};
  const fake={state,dead:false,invulnerable:0,wardTimer:0,wardAura:{visible:false},kitTimers:{regen:0},
    ui:{toast:()=>{}},sound:{effect:()=>{}},particles:{burst:()=>{}},floaters:[],nextFloat:0,
    movePlayer:()=>{},queueSave:()=>{}};
  GameEngine.prototype.hurt.call(fake,20,{x:1,z:0});
  assert.equal(state.player.hp,82);
  fake.invulnerable=0;fake.wardTimer=3;
  GameEngine.prototype.hurt.call(fake,20,{x:1,z:0});
  assert.equal(state.player.hp,76); // ceil(20*.35) then round(7*.9)
});

test('watchpost affects earned gold and XP for enemies from that region only', () => {
  const state=newGame();state.world.projects.southgate='watch';
  let xp=0;
  const fake={state,hideAim:()=>{},gainXp:amount=>{xp+=amount;},checkAchievements:()=>{},queueSave:()=>{},
    particles:{burst:()=>{}},sound:{effect:()=>{}},ui:{toast:()=>{}}};
  const enemy={id:'enemy:southgate:1',type:'caster',region:'southgate',level:11,alive:true,x:0,z:0,
    model:{visible:true,userData:{ring:{visible:false}}}};
  GameEngine.prototype.defeat.call(fake,enemy);
  assert.equal(state.player.coins,Math.round((4+11*2)*1.25));
  assert.equal(xp,Math.round((13+11*4)*1.25));
  assert.equal(state.stats.casters,1);
});

test('charm changes are refused away from a waystone and preserve health caps', () => {
  const state=newGame();state.player.ore=20;state.player.bloom=20;
  const fake={state,canTravel:()=>false,sound:{effect:()=>{}},queueSave:()=>{},checkAchievements:()=>{}};
  assert.equal(GameEngine.prototype.craftCharm.call(fake,'oak-heart').reason,'waystone');
  fake.canTravel=()=>true;
  assert.equal(GameEngine.prototype.craftCharm.call(fake,'oak-heart').ok,true);
  assert.equal(GameEngine.prototype.equipCharm.call(fake,'oak-heart'),true);
  state.player.hp=124;
  assert.equal(GameEngine.prototype.equipCharm.call(fake,null),true);
  assert.equal(state.player.hp,100);
});

test('hidden gathered ore no longer blocks movement and returns when visible', () => {
  const ore={visible:true};
  const world={records:()=>[{colliders:[{x:1,z:1,r:.5,model:ore},{x:2,z:2,r:1}]}]};
  assert.equal(World.prototype.colliders.call(world).length,2);
  ore.visible=false;
  assert.equal(World.prototype.colliders.call(world).length,1);
  ore.visible=true;
  assert.equal(World.prototype.colliders.call(world).length,2);
});

test('streaming rebuilds visible entity lists only when the player changes regions', () => {
  const state=newGame(), scene={add:()=>{},remove:()=>{}}, world=new World(scene,state);
  let builds=0;
  world.build=region=>{builds++;const record={data:region,group:{},colliders:[],enemies:[{id:region.id}],npcs:[]};world.regions.set(region.id,record);return record;};
  assert.equal(world.updateStreaming(0,0).id,'haven');
  const records=world.records(),enemies=world.enemies(),initialBuilds=builds;
  assert.equal(world.updateStreaming(1,1),null);assert.equal(world.records(),records);assert.equal(world.enemies(),enemies);assert.equal(builds,initialBuilds);
  assert.equal(world.updateStreaming(54,0).id,'fields');
  assert.notEqual(world.records(),records);assert.ok(world.enemies().some(enemy=>enemy.id==='fields'));
});

test('Dawnflash interrupts nearby non-bosses without affecting bosses or fired projectiles',()=>{
  const state=newGame();state.player.x=0;state.player.z=0;state.player.kit.supplies.flash=2;
  const minion={type:'caster',alive:true,x:2,z:0,state:'windup',stateTime:.5,
    model:{userData:{ring:{visible:true}}}};
  const boss={type:'guardian',alive:true,x:1,z:0,state:'windup',stateTime:.5,
    model:{userData:{ring:{visible:true}}}};
  const fired=[{alive:true}], hidden=[];
  let enemies=[minion,boss];
  const fake={state,world:{enemies:()=>enemies},paused:false,dead:false,orientationBlocked:false,
    cooldowns:{kit:0},kitTimers:{haste:0,regen:0},projectiles:fired,
    hideAim:enemy=>hidden.push(enemy),addRing:()=>{},particles:{burst:()=>{}},
    sound:{effect:()=>{}},ui:{toast:()=>{}},floaters:[],nextFloat:0,queueSave:()=>{}};
  GameEngine.prototype.useKit.call(fake);
  assert.equal(minion.state,'stunned');assert.equal(minion.stateTime,0);
  assert.equal(minion.model.userData.ring.visible,false);assert.deepEqual(hidden,[minion]);
  assert.equal(boss.state,'windup');assert.equal(boss.model.userData.ring.visible,true);
  assert.equal(fake.projectiles,fired);assert.equal(fired[0].alive,true);
  assert.equal(state.player.kit.supplies.flash,1);
  enemies=[boss];fake.cooldowns.kit=0;
  GameEngine.prototype.useKit.call(fake); // No valid target: no item is consumed.
  assert.equal(state.player.kit.supplies.flash,1);assert.equal(fake.cooldowns.kit,0);
});
