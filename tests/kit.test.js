import test from 'node:test';
import assert from 'node:assert/strict';
import { newGame, normalizeSave } from '../src/core/state.js';
import { KIT_CAP } from '../src/data/kit.js';
import { canCraftKit,craftKit,equipKit,spendKit } from '../src/core/kit.js';

test('kit recipes check materials and route unlocks before spending, with a bounded stock',()=>{
  const s=newGame();s.player.ore=12;s.player.echoes=12;s.player.bloom=12;
  assert.equal(canCraftKit(s,'tonic').reason,'locked');const before={...s.player};
  assert.equal(craftKit(s,'tonic').ok,false);assert.equal(s.player.bloom,before.bloom);
  assert.equal(craftKit(s,'flash').ok,true);assert.equal(s.player.ore,10);assert.equal(s.player.echoes,10);
  assert.equal(s.player.kit.supplies.flash,1);assert.equal(spendKit(s,'flash'),true);
  assert.equal(spendKit(s,'flash'),false);assert.equal(s.player.kit.supplies.flash,0);
  s.player.kit.supplies.flash=KIT_CAP;const ore=s.player.ore;
  assert.equal(craftKit(s,'flash').reason,'full');assert.equal(s.player.ore,ore);
  assert.equal(equipKit(s,'constructor'),false);assert.equal(equipKit(s,'tonic'),false);
});

test('kit imports discard unknown types and bound quantities',()=>{
  const s=newGame();s.version=3;s.player.kit={selected:'constructor',supplies:{flash:999,tonic:-4,draught:1.8,unknown:500}};
  const out=normalizeSave(s);assert.deepEqual(out.player.kit,{selected:'flash',supplies:{flash:5,tonic:0,draught:0}});
});
