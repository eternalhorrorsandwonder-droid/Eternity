import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_BINDINGS,normalizeBindings,setBinding,keyLabel} from '../src/core/keybindings.js';

test('defaults and valid custom controls survive settings normalization',()=>{
  assert.deepEqual(normalizeBindings(null),DEFAULT_BINDINGS);
  const result=setBinding(DEFAULT_BINDINGS,'interact','KeyF');assert.equal(result.ok,true);
  assert.equal(normalizeBindings(result.bindings).interact,'KeyF');assert.equal(keyLabel('Digit2'),'2');
});
test('movement, escape, unknown controls and duplicates are rejected',()=>{
  assert.equal(setBinding(DEFAULT_BINDINGS,'interact','KeyW').reason,'reserved');
  assert.equal(setBinding(DEFAULT_BINDINGS,'interact','Escape').reason,'reserved');
  assert.equal(setBinding(DEFAULT_BINDINGS,'interact','KeyJ').reason,'conflict');
  assert.equal(setBinding(DEFAULT_BINDINGS,'constructor','KeyF').reason,'reserved');
  assert.deepEqual(normalizeBindings({...DEFAULT_BINDINGS,interact:'KeyJ'}),DEFAULT_BINDINGS);
});
