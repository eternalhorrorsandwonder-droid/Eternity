import test from 'node:test';
import assert from 'node:assert/strict';
import { TRAILS } from '../src/data/trails.js';
import { REGION_BY_ID, REGIONS, worldPosition } from '../src/data/world.js';
import { QUESTS } from '../src/data/quests.js';
import { newGame, normalizeSave, acceptQuest } from '../src/core/state.js';
import { trailProgress, trackTrail, claimTrail } from '../src/core/trails.js';
import { bearingTo, navigationTarget } from '../src/core/navigation.js';

function completeWorld(state) {
  state.world.visited=REGIONS.map(r=>r.id);
  state.world.activated=REGIONS.map(r=>r.id);
  state.world.lore=REGIONS.map(r=>r.id);
  state.world.beacons=REGIONS.filter(r=>r.beacon).map(r=>r.id);
  state.world.tideAnchors=REGIONS.filter(r=>r.anchor).map(r=>r.id);
  state.world.openedCaches=REGIONS.filter(r=>r.cache).map(r=>r.id);
  state.world.quests=Object.fromEntries(Object.keys(QUESTS).map(id=>[id,'complete']));
  state.world.flags={guardian:true,warden:true,tempest:true};
  state.world.projects=Object.fromEntries(REGIONS.filter(r=>r.project).map(r=>[r.id,'shelter']));
  // Use actual puzzle answers so import validation recognizes these as genuine.
  return import('../src/data/archives.js').then(({ARCHIVES,ARCHIVE_GLYPHS})=>{
    state.world.archives=Object.fromEntries(Object.entries(ARCHIVES).map(([id,a])=>[id,{
      dials:a.solution.map(sign=>ARCHIVE_GLYPHS.findIndex(glyph=>glyph.id===sign)),solved:true,attempts:1,
    }]));
  });
}

test('sixteen authored routes have valid, distinct persistent objectives across all four chapters',()=>{
  assert.equal(TRAILS.length,16);assert.equal(new Set(TRAILS.map(t=>t.id)).size,16);
  for (const chapter of [1,2,3,4]) assert.equal(TRAILS.filter(t=>t.chapter===chapter).length,4);
  for (const trail of TRAILS) {
    assert.equal(trail.objectives.length,4);
    assert.ok(trail.introduction && trail.conclusion && trail.reward.xp>0 && trail.reward.coins>0);
    assert.equal(new Set(trail.objectives.map(o=>`${o.kind}:${o.id}`)).size,trail.objectives.length);
    for (const item of trail.objectives) {
      assert.ok(item.label);
      if(item.kind==='quest') assert.ok(Object.hasOwn(QUESTS,item.id),item.id);
      else if(item.kind==='boss') assert.ok(['guardian','warden','tempest'].includes(item.id));
      else {
        const region=REGION_BY_ID[item.id];assert.ok(region,item.id);
        if(item.kind==='anchor'||item.kind==='beacon'||item.kind==='cache'||item.kind==='archive'||item.kind==='project') assert.ok(region[item.kind],`${item.kind}:${item.id}`);
        if(item.kind==='memory') assert.ok(region.lore);
        if(item.kind==='waystone') assert.ok(region.shrine);
      }
    }
  }
});

test('routes make no duplicate payment, preserve retroactive progress and validate imported claims',async()=>{
  const s=newGame();assert.equal(trailProgress(s,'first-footsteps').current,0);
  assert.equal(trackTrail(s,'first-footsteps'),true);assert.equal(claimTrail(s,'first-footsteps').ok,false);
  await completeWorld(s);
  for (const route of TRAILS) {
    assert.equal(trailProgress(s,route.id).ready,true,route.id);
    const before=s.player.coins;const result=claimTrail(s,route.id);
    assert.equal(result.ok,true);assert.equal(s.player.coins,before+route.reward.coins);
    assert.equal(claimTrail(s,route.id).ok,false);assert.equal(s.player.coins,before+route.reward.coins);
  }
  const loaded=normalizeSave(s);assert.deepEqual(loaded.world.trails.claimed,s.world.trails.claimed);
  assert.equal(trackTrail(loaded,'first-footsteps'),false);
  const forged=newGame();forged.world.trails={claimed:['first-footsteps','constructor','first-footsteps'],active:'constructor'};
  assert.deepEqual(normalizeSave(forged).world.trails,{claimed:[],active:null});
});

test('guidance points to real first objectives, then a return, and manual pins take priority',()=>{
  const s=newGame();let target=navigationTarget(s,100);
  assert.equal(target.kind,'npc');assert.equal(target.label,'Talk to Mira');
  acceptQuest(s,'first-light');target=navigationTarget(s,100);
  assert.equal(target.kind,'enemy');assert.ok(REGION_BY_ID[target.region]);
  s.stats.echoes=3;s.player.echoes=3;target=navigationTarget(s,100);assert.equal(target.region,'fields');assert.equal(target.kind,'shrine');
  s.world.activated.push('fields');target=navigationTarget(s,100);assert.equal(target.label,'Talk to Mira');
  s.world.visited.push('fields');s.world.pinnedRegion='fields';target=navigationTarget(s,100);
  assert.equal(target.source,'pin');assert.equal(target.region,'fields');
  assert.equal(bearingTo({x:0,z:0},{x:0,z:-10}).direction,'N');
  assert.equal(bearingTo({x:0,z:0},{x:10,z:0}).direction,'E');
  assert.equal(bearingTo({x:0,z:0},{x:-10,z:10}).direction,'SW');
});

test('tracking a route follows its next unfinished objective and returns to a waystone when ready',()=>{
  const s=newGame();trackTrail(s,'first-footsteps');
  assert.equal(navigationTarget(s).source,'trail');assert.equal(navigationTarget(s).region,'fields');
  s.world.visited.push('fields','grove');s.world.activated.push('fields');s.world.lore.push('grove');
  assert.equal(trailProgress(s,'first-footsteps').ready,true);
  const target=navigationTarget(s);assert.equal(target.kind,'shrine');assert.match(target.label,/restored waystone/i);
});

test('schema v3 migration retains journey and initializes route and pin state',()=>{
  const original=newGame('Aster');original.version=3;delete original.world.trails;delete original.world.pinnedRegion;
  original.player.coins=321;original.world.quests['first-light']='complete';original.player.skills.pulse=true;
  const out=normalizeSave(original);assert.equal(out.version,5);assert.equal(out.player.coins,321);
  assert.equal(out.player.skills.pulse,true);assert.deepEqual(out.world.trails,{claimed:[],active:null});assert.equal(out.world.pinnedRegion,null);
});


test('resource guidance uses authored positions and skips nodes until they respawn',()=>{
  const s=newGame();s.world.quests.smith='active';s.activeQuest='smith';s.player.ore=0;
  const first=navigationTarget(s,100);assert.equal(first.kind,'node');
  const region=REGION_BY_ID[first.region];
  const index=region.nodes.findIndex(([type,x,z])=>{const p=worldPosition(region,x,z);return type==='ore' && p.x===first.x && p.z===first.z;});
  assert.ok(index>=0);s.world.respawns[`node:${region.id}:${index}`]=200;
  const next=navigationTarget(s,100);assert.notDeepEqual({x:next.x,z:next.z},{x:first.x,z:first.z});
  const restored=navigationTarget(s,201);assert.deepEqual({x:restored.x,z:restored.z},{x:first.x,z:first.z});
});
