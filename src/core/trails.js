import { TRAILS, TRAIL_BY_ID } from '../data/trails.js';
import { creditInventory, creditStat } from './limits.js';

/** Progress is derived from monotonic world facts; selecting a route never resets it. */
export function trailObjectiveDone(state, objective) {
  switch (objective.kind) {
    case 'visit': return state.world.visited.includes(objective.id);
    case 'waystone': return state.world.activated.includes(objective.id);
    case 'memory': return state.world.lore.includes(objective.id);
    case 'beacon': return state.world.beacons.includes(objective.id);
    case 'anchor': return state.world.tideAnchors.includes(objective.id);
    case 'cache': return state.world.openedCaches.includes(objective.id);
    case 'archive': return state.world.archives?.[objective.id]?.solved === true;
    case 'project': return !!state.world.projects?.[objective.id];
    case 'boss': return state.world.flags?.[objective.id] === true;
    case 'quest': return state.world.quests?.[objective.id] === 'complete';
    default: return false;
  }
}
export function trailProgress(state, id) {
  const trail=Object.hasOwn(TRAIL_BY_ID,id) ? TRAIL_BY_ID[id] : null;
  if (!trail) return null;
  const objectives=trail.objectives.map(objective=>({...objective,done:trailObjectiveDone(state,objective)}));
  const current=objectives.filter(objective=>objective.done).length;
  return {objectives,current,required:objectives.length,ready:current===objectives.length};
}
export function trackTrail(state, id) {
  if (id !== null && (!Object.hasOwn(TRAIL_BY_ID,id) || state.world.trails.claimed.includes(id))) return false;
  state.world.trails.active=id;
  return true;
}
/** The caller enforces waystone proximity; state changes and rewards are atomic. */
export function claimTrail(state, id) {
  const progress=trailProgress(state,id), trail=TRAIL_BY_ID[id];
  if (!progress || !progress.ready || state.world.trails.claimed.includes(id)) return {ok:false};
  state.world.trails.claimed.push(id);
  if (state.world.trails.active === id) state.world.trails.active=null;
  creditInventory(state.player,'coins',trail.reward.coins || 0);
  creditStat(state.stats,'earned',trail.reward.coins || 0);
  creditInventory(state.player,'potions',trail.reward.potions || 0);
  return {ok:true,trail,reward:trail.reward};
}
/** Validate claimed routes against their monotonic objectives, not just ID shape. */
export function normalizeTrails(raw,state) {
  const claimed=Array.isArray(raw?.claimed)
    ? [...new Set(raw.claimed.filter(id=>typeof id==='string' && Object.hasOwn(TRAIL_BY_ID,id)))]
        .filter(id=>trailProgress(state,id)?.ready).slice(0,TRAILS.length)
    : [];
  const active=typeof raw?.active==='string' && Object.hasOwn(TRAIL_BY_ID,raw.active) && !claimed.includes(raw.active)
    ? raw.active : null;
  return {claimed,active};
}
