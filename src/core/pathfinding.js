import { segmentCircleHit } from './collision.js';

/** Small binary heap keeps local A* work bounded without sorting on every node. */
class MinHeap {
  constructor() { this.items=[]; }
  push(node) {
    const a=this.items;a.push(node);let i=a.length-1;
    while(i>0) {const p=(i-1)>>1;if(a[p].score<=node.score) break;a[i]=a[p];i=p;}a[i]=node;
  }
  pop() {
    const a=this.items;if (!a.length) return null;
    const root=a[0],last=a.pop();if (!a.length) return root;
    let i=0;
    while(true) {
      let child=i*2+1;if(child>=a.length) break;
      if(child+1<a.length && a[child+1].score<a[child].score) child++;
      if(a[child].score>=last.score) break;
      a[i]=a[child];i=child;
    }
    a[i]=last;return root;
  }
  get size() {return this.items.length;}
}

const sq=(x)=>x*x;
function inCircle(point,circle,padding) {
  return sq(point.x-circle.x)+sq(point.z-circle.z)<sq(circle.r+padding);
}
/** True when the swept player circle has room along a whole segment. */
export function segmentClear(a,b,obstacles,padding=.42) {
  for (const c of obstacles) {
    // If a player starts inside an obstacle, allow the first step outward.
    const startInside=inCircle(a,c,padding);
    const endInside=inCircle(b,c,padding);
    if (startInside) {
      const before=sq(a.x-c.x)+sq(a.z-c.z),after=sq(b.x-c.x)+sq(b.z-c.z);
      if (after>before && !endInside) continue;
      return false;
    }
    if (segmentCircleHit(a.x,a.z,b.x,b.z,c.x,c.z,c.r+padding)!==null) return false;
  }
  return true;
}

/**
 * Plan a short on-screen path around static circular obstacles.
 * A* is bounded by search size and expansions. Dynamic NPC/enemy collisions
 * may still change: callers should cancel or replan if movement becomes stuck.
 * Returns waypoints, or null if no safe path was found in the local budget.
 */
export function findLocalPath(start,goal,obstacles,options={}) {
  const cell=options.cell ?? 1.15, padding=options.padding ?? .42;
  const maxNodes=options.maxNodes ?? 6500, margin=options.margin ?? 8;
  const bounds=options.bounds || {minX:-Infinity,maxX:Infinity,minZ:-Infinity,maxZ:Infinity};
  if (![start.x,start.z,goal.x,goal.z,cell,padding].every(Number.isFinite) || cell<=0 || padding<0) return null;
  const nearby=obstacles.filter(c=>Number.isFinite(c.x)&&Number.isFinite(c.z)&&Number.isFinite(c.r)&&c.r>0 &&
    c.x+c.r+padding>=Math.min(start.x,goal.x)-margin && c.x-c.r-padding<=Math.max(start.x,goal.x)+margin &&
    c.z+c.r+padding>=Math.min(start.z,goal.z)-margin && c.z-c.r-padding<=Math.max(start.z,goal.z)+margin);
  const within=p=>p.x>=bounds.minX && p.x<=bounds.maxX && p.z>=bounds.minZ && p.z<=bounds.maxZ;
  const walkable=p=>within(p) && !nearby.some(c=>inCircle(p,c,padding));
  if (!within(start) || !within(goal)) return null;
  if (walkable(goal) && segmentClear(start,goal,nearby,padding)) return [{x:goal.x,z:goal.z}];

  const minX=Math.max(bounds.minX,Math.min(start.x,goal.x)-margin),maxX=Math.min(bounds.maxX,Math.max(start.x,goal.x)+margin);
  const minZ=Math.max(bounds.minZ,Math.min(start.z,goal.z)-margin),maxZ=Math.min(bounds.maxZ,Math.max(start.z,goal.z)+margin);
  // Click-to-move is intentionally local; don't freeze the main thread for a cross-world click.
  const width=Math.floor((maxX-minX)/cell)+1,height=Math.floor((maxZ-minZ)/cell)+1;
  if (!Number.isFinite(width*height) || width*height>20000) return null;
  const location=(x,z)=>({x:minX+x*cell,z:minZ+z*cell});
  const coords=p=>({x:Math.round((p.x-minX)/cell),z:Math.round((p.z-minZ)/cell)});
  const inside=(x,z)=>x>=0 && x<width && z>=0 && z<height;
  const key=(x,z)=>z*width+x;
  const cache=new Map();
  const passable=(x,z)=>{
    if (!inside(x,z)) return false;
    const k=key(x,z);if(!cache.has(k)) cache.set(k,walkable(location(x,z)));return cache.get(k);
  };
  const nearest=(p,anchor)=>{
    const center=coords(p);let best=null;
    // Find a free grid point reachable from the exact starting point when needed.
    for(let radius=0;radius<=6;radius++) {
      for(let dx=-radius;dx<=radius;dx++) for(let dz=-radius;dz<=radius;dz++) {
        if(Math.max(Math.abs(dx),Math.abs(dz))!==radius) continue;
        const x=center.x+dx,z=center.z+dz;if(!passable(x,z)) continue;
        const q=location(x,z);
        if(anchor && !segmentClear(anchor,q,nearby,padding)) continue;
        const distance=sq(q.x-p.x)+sq(q.z-p.z);
        if(!best || distance<best.distance) best={x,z,distance};
      }
      if(best) return best;
    }
    return null;
  };
  const origin=nearest(start,start),destination=nearest(goal,null);
  if (!origin || !destination) return null;
  const startKey=key(origin.x,origin.z),goalKey=key(destination.x,destination.z);
  const heap=new MinHeap(),cost=new Map([[startKey,0]]),parent=new Map(),closed=new Set();
  const heuristic=(x,z)=>Math.hypot(x-destination.x,z-destination.z);
  heap.push({x:origin.x,z:origin.z,score:heuristic(origin.x,origin.z),cost:0});
  const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];
  let found=false,expanded=0;
  while(heap.size && expanded<maxNodes) {
    const current=heap.pop(),k=key(current.x,current.z);
    if (closed.has(k) || current.cost!==cost.get(k)) continue;
    if(k===goalKey){found=true;break;}
    closed.add(k);expanded++;
    for(const [dx,dz] of directions) {
      const x=current.x+dx,z=current.z+dz,nk=key(x,z);
      if(!passable(x,z) || closed.has(nk)) continue;
      if(dx && dz && (!passable(current.x+dx,current.z) || !passable(current.x,current.z+dz))) continue;
      if(!segmentClear(location(current.x,current.z),location(x,z),nearby,padding)) continue;
      const next=current.cost+(dx&&dz ? Math.SQRT2 : 1);
      if(next >= (cost.get(nk) ?? Infinity)) continue;
      cost.set(nk,next);parent.set(nk,k);heap.push({x,z,cost:next,score:next+heuristic(x,z)});
    }
  }
  if(!found) return null;
  const reverse=[];let at=goalKey;
  while(at!==startKey) {
    reverse.push(location(at%width,Math.floor(at/width)));
    at=parent.get(at);if(at===undefined) return null;
  }
  reverse.push(location(origin.x,origin.z));reverse.reverse();
  if(walkable(goal) && segmentClear(reverse.at(-1),goal,nearby,padding)) reverse.push({x:goal.x,z:goal.z});
  // Remove unnecessary grid points while retaining collision-free line of sight.
  const result=[];let anchor=start,index=0;
  while(index<reverse.length) {
    let far=index;
    for(let candidate=index;candidate<reverse.length;candidate++) {
      if(segmentClear(anchor,reverse[candidate],nearby,padding)) far=candidate;
      else break;
    }
    result.push(reverse[far]);anchor=reverse[far];index=far+1;
  }
  return result.length ? result : [{x:goal.x,z:goal.z}];
}
