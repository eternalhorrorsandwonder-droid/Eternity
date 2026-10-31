import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { World } from '../src/game/world.js';
import { GameEngine } from '../src/game/engine.js';
import { makeCreature } from '../src/game/models.js';
import { cancelUnseenAttack } from '../src/core/encounter-state.js';
import { minimapRegions } from '../src/core/minimap.js';
import { navigationTarget } from '../src/core/navigation.js';
import { newGame, acceptQuest, questProgress } from '../src/core/state.js';
import { REGIONS, REGION_BY_ID } from '../src/data/world.js';
import { listSlots, loadSlot, saveSlot } from '../src/core/save.js';
import { createSessionGuard } from '../src/core/session.js';

function enemyFixture(type = 'wisp', region = 'haven') {
  const state = newGame();
  state.player.x = 0; state.player.z = 0;
  const enemy = {
    id:`enemy:${region}:0`, type, region, alive:true, x:1, z:0, homeX:1, homeZ:0,
    level:1, hp:40, maxHp:40, state:'idle', stateTime:0, cooldown:0,
    hitFlash:0, phase:0, pattern:0, aftershock:0, aggravated:false,
    model:makeCreature(type), warnings:[],
  };
  const hits=[];
  const fake = {
    state, time:0, paused:false, dead:false, orientationBlocked:false, invulnerable:0,
    cooldowns:{kit:0}, kitTimers:{haste:0,regen:0}, floaters:[], nextFloat:0,
    world:{enemies:()=>[enemy],colliders:()=>[],npcs:()=>[]},
    particles:{burst(){}}, sound:{effect(){}}, ui:{toast(){}}, addRing(){},
    checkAchievements(){}, queueSave(){}, hurt:amount=>hits.push(amount),
  };
  for (const key of ['moveEnemy','directionToPlayer','hideAim','showAim'])
    fake[key] = GameEngine.prototype[key].bind(fake);
  return {state, enemy, fake, hits};
}

test('an actual Dawnflash leaves a peaceful Haven creature peaceful, but preserves prior aggression', () => {
  const {state,enemy,fake}=enemyFixture();
  state.player.kit.supplies.flash=2;
  GameEngine.prototype.useKit.call(fake);
  assert.equal(enemy.state,'stunned');
  assert.equal(enemy.aggravated,false);
  GameEngine.prototype.updateEnemies.call(fake,1.21);
  assert.equal(enemy.state,'idle');
  GameEngine.prototype.updateEnemies.call(fake,.1);
  assert.equal(enemy.state,'idle'); // player is within ordinary aggression range
  enemy.aggravated=true;fake.cooldowns.kit=0;
  GameEngine.prototype.useKit.call(fake);
  GameEngine.prototype.updateEnemies.call(fake,1.21);
  assert.equal(enemy.state,'chase');
  assert.equal(state.player.kit.supplies.flash,0);
});

test('unseen melee, projectile and boss windups are cancelled, including their follow-ups', () => {
  for (const [type,state,aftershock] of [
    ['wisp','windup',0], ['caster','windup',0], ['surger','charging',0],
    ['warden','recover',.3], ['tempest','recover',.1],
  ]) {
    const enemy={type,state,stateTime:.9,chargeRemaining:4,aftershock,volley:[{x:1,z:0}],
      model:{userData:{ring:{visible:true}}},warnings:[{visible:true}]};
    assert.equal(cancelUnseenAttack(enemy),true,type);
    assert.equal(enemy.state,'return');assert.equal(enemy.stateTime,0);
    assert.equal(enemy.chargeRemaining,0);assert.equal(enemy.aftershock,0);
    assert.equal(enemy.volley,null);assert.equal(enemy.warnings[0].visible,false);
    assert.equal(enemy.model.userData.ring.visible,false);
  }
  const idle={state:'idle',aftershock:0};
  assert.equal(cancelUnseenAttack(idle),false);assert.equal(idle.state,'idle');
  // Projectiles are not part of the enemy's pending state and remain in flight.
  const fired=[{x:1}];cancelUnseenAttack({state:'windup',aftershock:0});assert.deepEqual(fired,[{x:1}]);
});

test('distance and region streaming cancel real enemy windups without removing fired bolts', () => {
  for(const [type,stage,aftershock] of [['wisp','windup',0],['caster','windup',0],['warden','recover',.2]]) {
    const {state,enemy,fake}=enemyFixture(type,'tidegate');
    state.player.x=50;enemy.state=stage;enemy.aftershock=aftershock;
    enemy.volley=[{x:1,z:0}];enemy.warnings=[{visible:true}];enemy.model.userData.ring.visible=true;
    const bolt={remaining:9};fake.projectiles=[bolt];
    GameEngine.prototype.updateEnemies.call(fake,.1);
    assert.equal(enemy.state,'return');assert.equal(enemy.aftershock,0);
    assert.equal(enemy.warnings[0].visible,false);assert.equal(enemy.model.userData.ring.visible,false);
    assert.deepEqual(fake.projectiles,[bolt]);
  }
  const {enemy}=enemyFixture('caster','haven');enemy.state='windup';enemy.aftershock=0;
  enemy.warnings=[{visible:true}];enemy.model.userData.ring.visible=true;
  const haven={data:REGION_BY_ID.haven,enemies:[enemy],npcs:[],group:{id:'haven'}};
  const streaming={current:REGION_BY_ID.haven,visible:new Set(['haven']),regions:new Map([['haven',haven]]),
    scene:{add(){},remove(){}},build(data){const record={data,enemies:[],npcs:[],group:{id:data.id}};this.regions.set(data.id,record);return record;}};
  World.prototype.updateStreaming.call(streaming,108,324);
  assert.equal(enemy.state,'return');assert.equal(enemy.warnings[0].visible,false);
  assert.equal(enemy.model.userData.ring.visible,false);assert.equal(streaming.visible.has('haven'),false);
});

test('the tempest displays its full volley warning before spawning three bolts', () => {
  const {enemy,fake}=enemyFixture('tempest','tidegate');
  enemy.state='windup';enemy.stateTime=.95;enemy.windup=1;enemy.pattern=2;
  enemy.attackRange=4.2;enemy.hp=10;enemy.maxHp=40;
  enemy.warnings=[new THREE.Group(),new THREE.Group(),new THREE.Group()];
  fake.rotateDirection=GameEngine.prototype.rotateDirection.bind(fake);
  const shots=[];fake.spawnBolt=(_e,direction)=>shots.push(direction);
  GameEngine.prototype.updateEnemies.call(fake,.1);
  assert.equal(enemy.aftershock,.65);assert.equal(shots.length,0);
  assert.ok(enemy.warnings.every(w=>w.visible));
  GameEngine.prototype.updateEnemies.call(fake,.64);
  assert.equal(shots.length,0);assert.ok(enemy.warnings.every(w=>w.visible));
  GameEngine.prototype.updateEnemies.call(fake,.02);
  assert.equal(shots.length,3);assert.ok(enemy.warnings.every(w=>!w.visible));
});

test('a wounded boss shows its entire follow-up warning, and rings sit above water', () => {
  const {enemy,fake,hits}=enemyFixture('warden','stormglass');
  enemy.state='windup';enemy.stateTime=.95;enemy.windup=1;enemy.pattern=2;
  enemy.attackRange=4.2;enemy.hp=10;enemy.maxHp=40;
  GameEngine.prototype.updateEnemies.call(fake,.1);
  assert.equal(hits.length,1);
  assert.equal(enemy.aftershock,.65);
  assert.equal(enemy.model.userData.ring.visible,true);
  assert.ok(enemy.model.userData.ring.position.y>.07);
  assert.equal(enemy.model.userData.ring.scale.x,enemy.aftershockRange+.32);
  GameEngine.prototype.updateEnemies.call(fake,.64);
  assert.equal(hits.length,1);assert.equal(enemy.model.userData.ring.visible,true);
  GameEngine.prototype.updateEnemies.call(fake,.02);
  assert.equal(hits.length,2);assert.equal(enemy.model.userData.ring.visible,false);
});

test('the minimap draws only intersecting regions, including neighboring edges and corners', () => {
  assert.deepEqual(minimapRegions(REGIONS,{x:0,z:0}).map(r=>r.id),['haven']);
  assert.deepEqual(new Set(minimapRegions(REGIONS,{x:27,z:0}).map(r=>r.id)),new Set(['haven','fields']));
  assert.deepEqual(new Set(minimapRegions(REGIONS,{x:27,z:27}).map(r=>r.id)),new Set(['haven','fields','bluffs','glassmere']));
  assert.ok(minimapRegions(REGIONS,{x:0,z:0}).length < REGIONS.length);
});

test('unreadable or malformed slots are never reported as empty', async () => {
  const old=globalThis.localStorage;
  globalThis.localStorage={getItem(key){
    if (key.endsWith('.slot.0')) throw new Error('read denied');
    if (key.endsWith('.slot.2')) return ''; // damaged, but present
    return null;
  }};
  try {
    const slots=listSlots();
    assert.equal(slots[0].unavailable,true);assert.equal(slots[0].empty,undefined);
    assert.equal(slots[1].empty,true);assert.equal(slots[2].empty,undefined);assert.equal(slots[2].damaged,true);
    await assert.rejects(()=>loadSlot(2),/damaged.*backup/i);
  } finally {globalThis.localStorage=old;}
});

test('an empty-slot import precondition refuses a newly occupied or unreadable slot', async () => {
  const old=globalThis.localStorage,values=new Map([['eternity.vale.v1.slot.0','prior journey']]);
  let blocked=false;
  globalThis.localStorage={
    getItem(key){if(blocked && key.endsWith('.slot.0')) throw new Error('blocked');return values.get(key) ?? null;},
    setItem(key,value){values.set(key,String(value));},
  };
  try {
    await assert.rejects(()=>saveSlot(0,newGame(),{requireEmpty:true}),/no longer empty/);
    assert.equal(values.get('eternity.vale.v1.slot.0'),'prior journey');
    blocked=true;
    await assert.rejects(()=>saveSlot(0,newGame(),{requireReadable:true}),/could not be read/);
    assert.equal(values.get('eternity.vale.v1.slot.0'),'prior journey');
  } finally {globalThis.localStorage=old;}
});

test('session busy state unlocks after both success and failure', async () => {
  const changes=[];const run=createSessionGuard(value=>changes.push(value));
  let release;const operation=run(()=>new Promise(resolve=>{release=resolve;}));
  assert.deepEqual(changes,[true]);
  await assert.rejects(()=>run(()=>1),/still in progress/);
  release();await operation;assert.deepEqual(changes,[true,false]);
  await assert.rejects(()=>run(()=>{throw new Error('failure');}),/failure/);
  assert.deepEqual(changes,[true,false,true,false]);
});

test('guidance requests missing materials before a waystone, beacon, project or anchor', () => {
  const first=newGame();acceptQuest(first,'first-light');first.stats.echoes=3;first.player.echoes=0;
  assert.equal(navigationTarget(first).kind,'enemy');
  assert.match(navigationTarget(first).label,/0\/3/);
  assert.match(questProgress(first,'first-light').text,/0\/3 echoes on hand/);
  first.player.echoes=3;assert.equal(navigationTarget(first).kind,'shrine');
  first.world.activated.push('fields');assert.equal(navigationTarget(first).label,'Talk to Mira');

  const beacon=newGame();acceptQuest(beacon,'first-beacon');
  assert.equal(navigationTarget(beacon).kind,'node');assert.match(navigationTarget(beacon).label,/ore/);
  beacon.player.ore=2;assert.equal(navigationTarget(beacon).kind,'enemy');assert.match(navigationTarget(beacon).label,/echoes/);
  beacon.player.echoes=2;assert.equal(navigationTarget(beacon).kind,'beacon');

  const project=newGame();acceptQuest(project,'gate-of-questions');
  project.world.archives.southgate={solved:true};
  const cost=REGION_BY_ID.southgate.project.cost;
  assert.match(navigationTarget(project).label,/ore/);
  project.player.ore=cost.ore;assert.match(navigationTarget(project).label,/sunpetals/);
  project.player.bloom=cost.bloom;assert.equal(navigationTarget(project).kind,'project');

  const anchor=newGame();acceptQuest(anchor,'opening-the-sound');
  assert.match(navigationTarget(anchor).label,/ore/);
  anchor.player.ore=2;assert.match(navigationTarget(anchor).label,/echoes/);
  anchor.player.echoes=2;assert.equal(navigationTarget(anchor).kind,'anchor');
  anchor.world.tideAnchors.push('tidegate');assert.equal(navigationTarget(anchor).kind,'lore');
});
