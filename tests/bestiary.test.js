import test from 'node:test';
import assert from 'node:assert/strict';
import {newGame,normalizeSave} from '../src/core/state.js';
import {BESTIARY} from '../src/data/bestiary.js';
import {observeEnemy,recordEnemyDefeat,OBSERVATION_CAP} from '../src/core/bestiary.js';

test('field guide observations and defeats are bounded and reject unknown IDs',()=>{
  const s=newGame();assert.equal(BESTIARY.length,8);
  assert.equal(observeEnemy(s,'wisp'),true);assert.equal(observeEnemy(s,'wisp'),false);
  assert.equal(recordEnemyDefeat(s,'wisp'),true);assert.equal(s.world.bestiary.wisp.defeated,1);
  s.world.bestiary.wisp.defeated=OBSERVATION_CAP;recordEnemyDefeat(s,'wisp');
  assert.equal(s.world.bestiary.wisp.defeated,OBSERVATION_CAP);assert.equal(observeEnemy(s,'constructor'),false);
  const loaded=normalizeSave(s);assert.equal(loaded.world.bestiary.wisp.defeated,OBSERVATION_CAP);
});
test('v3 migration recovers only the enemy counts previously tracked by type',()=>{
  const s=newGame();s.version=3;delete s.world.bestiary;
  s.stats.defeated=12;s.stats.sentinels=3;s.stats.casters=2;s.world.flags.warden=true;
  const out=normalizeSave(s);
  assert.equal(out.world.bestiary.sentinel.defeated,3);assert.equal(out.world.bestiary.caster.defeated,2);
  assert.equal(out.world.bestiary.warden.defeated,1);assert.equal(out.world.bestiary.wisp,undefined);
});
