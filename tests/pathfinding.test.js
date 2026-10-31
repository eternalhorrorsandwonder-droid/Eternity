import test from 'node:test';
import assert from 'node:assert/strict';
import { findLocalPath, segmentClear } from '../src/core/pathfinding.js';

const bounds={minX:-20,maxX:20,minZ:-20,maxZ:20};
function assertSafe(start,path,obstacles) {
  assert.ok(path?.length,'expected a route');let previous=start;
  for(const point of path) {assert.ok(segmentClear(previous,point,obstacles),`unsafe segment ${JSON.stringify([previous,point])}`);previous=point;}
}
test('direct clicks use a single, collision-free segment',()=>{
  const path=findLocalPath({x:0,z:0},{x:8,z:4},[],{bounds});
  assert.deepEqual(path,[{x:8,z:4}]);
});
test('local path steers around a solid circle and reaches the requested free point',()=>{
  const start={x:-5,z:0},goal={x:5,z:0},obstacles=[{x:0,z:0,r:2}];
  const path=findLocalPath(start,goal,obstacles,{bounds});assertSafe(start,path,obstacles);
  assert.ok(path.length>=2);assert.deepEqual(path.at(-1),goal);
});
test('a blocked destination is adjusted to an accessible nearby point',()=>{
  const start={x:-5,z:0},goal={x:0,z:0},obstacles=[{x:0,z:0,r:1.5}];
  const path=findLocalPath(start,goal,obstacles,{bounds});assertSafe(start,path,obstacles);
  assert.ok(Math.hypot(path.at(-1).x,path.at(-1).z)>=1.9);
});
test('an impassable wall and exhausted search budget fail without producing an unsafe route',()=>{
  const obstacles=Array.from({length:11},(_,i)=>({x:0,z:-10+i*2,r:1.2}));
  assert.equal(findLocalPath({x:-6,z:0},{x:6,z:0},obstacles,{bounds:{minX:-10,maxX:10,minZ:-10,maxZ:10}}),null);
  assert.equal(findLocalPath({x:-5,z:0},{x:5,z:0},[{x:0,z:0,r:2}],{bounds,maxNodes:1}),null);
});
test('invalid or oversized searches are rejected',()=>{
  assert.equal(findLocalPath({x:NaN,z:0},{x:1,z:0},[]),null);
  assert.equal(findLocalPath({x:-500,z:0},{x:500,z:0},[{x:0,z:0,r:4}]),null);
});
