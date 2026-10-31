import test from 'node:test';
import assert from 'node:assert/strict';
import { createSessionGuard } from '../src/core/session.js';

test('session guard excludes overlapping operations and unlocks after success or failure', async () => {
  const run = createSessionGuard();
  let release;
  const pending=run(()=>new Promise(resolve=>{release=resolve;}));
  await assert.rejects(()=>run(()=>Promise.resolve()),/still in progress/);
  release('done');assert.equal(await pending,'done');
  await assert.rejects(()=>run(()=>{throw new Error('operation failed');}),/operation failed/);
  assert.equal(await run(()=>42),42);
});
