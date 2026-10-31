import test from 'node:test';
import assert from 'node:assert/strict';
import { SaveStatus } from '../src/core/save-status.js';

test('a save in flight does not mark later changes as durable',()=>{
  const tracker=new SaveStatus();tracker.reset();tracker.dirty();
  const first=tracker.begin();assert.equal(tracker.snapshot().status,'saving');
  tracker.dirty();tracker.finish(first,null,123);
  assert.deepEqual(tracker.snapshot(),{status:'pending',lastSaved:123,error:''});
  const second=tracker.begin();tracker.finish(second,null,456);
  assert.deepEqual(tracker.snapshot(),{status:'saved',lastSaved:456,error:''});
});
test('failed writes remain visible until a subsequent durable write',()=>{
  const tracker=new SaveStatus();tracker.dirty();const first=tracker.begin();
  tracker.finish(first,new Error('storage full'));assert.equal(tracker.snapshot().status,'error');
  assert.equal(tracker.snapshot().error,'storage full');
  const retry=tracker.begin();tracker.finish(retry,null,10);
  assert.equal(tracker.snapshot().status,'saved');assert.equal(tracker.snapshot().error,'');
});
test('results from an old session cannot update the current session',()=>{
  const tracker=new SaveStatus();tracker.dirty();const old=tracker.begin();tracker.reset();
  tracker.dirty();tracker.finish(old,new Error('old failure'));
  assert.equal(tracker.snapshot().status,'pending');assert.equal(tracker.snapshot().error,'');
});
test('continuous movement marks unsaved once per snapshot without triggering a write per frame',()=>{
  const tracker=new SaveStatus();
  tracker.continuousChange();
  const firstRevision=tracker.revision;
  for(let i=0;i<100;i++) tracker.continuousChange();
  assert.equal(tracker.revision,firstRevision);
  const snapshot=tracker.begin();
  tracker.continuousChange(); // The player moved while encryption was in flight.
  assert.equal(tracker.revision,firstRevision+1);
  tracker.finish(snapshot,null,123);
  assert.equal(tracker.snapshot().status,'pending');
  const retry=tracker.begin();tracker.finish(retry,null,456);
  assert.equal(tracker.snapshot().status,'saved');
});
