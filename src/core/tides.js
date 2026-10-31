import { REGION_BY_ID } from '../data/world.js';
import { recordEvent } from './chronicle.js';

// The warning must finish visibly before a pulse can fire. Large frame gaps do
// not consume both phases at once; returning from a suspended tab stays fair.
export const TIDE_WARNING_SECONDS = 1.5;
export const TIDE_REST_SECONDS = 6.5;
export const TIDE_ENTRY_GRACE = 2.5;
export const TIDE_DAMAGE = 22;

export function createTideCycle(offset = 0) {
  return { phase:'rest', remaining:TIDE_ENTRY_GRACE + Math.max(0, Number.isFinite(offset) ? offset : 0) };
}

/** Returns true exactly once when the warning resolves. Never skips a warning. */
export function advanceTide(cycle, dt) {
  if (!cycle || !Number.isFinite(dt) || dt <= 0) return false;
  cycle.remaining = Math.max(0, cycle.remaining - dt);
  if (cycle.remaining > 0) return false;
  if (cycle.phase === 'rest') {
    cycle.phase = 'warning';
    cycle.remaining = TIDE_WARNING_SECONDS;
    return false;
  }
  cycle.phase = 'rest';
  cycle.remaining = TIDE_REST_SECONDS;
  return true;
}

/** The drawn outer ring is the radius used for the player's center hit test. */
export function inTideSurge(surge, player) {
  const dx=player.x-surge.x, dz=player.z-surge.z;
  return dx*dx + dz*dz <= surge.radius*surge.radius;
}

/** Repair is permanent, region-local, and consumes the exact cost only once. */
export function repairTideAnchor(state, id) {
  const region = Object.hasOwn(REGION_BY_ID,id) ? REGION_BY_ID[id] : null;
  if (!region?.anchor) return {ok:false, reason:'invalid'};
  if (state.world.tideAnchors.includes(id)) return {ok:false, reason:'already'};
  const {ore,echoes}=region.anchor.cost;
  if (state.player.ore < ore || state.player.echoes < echoes) return {ok:false, reason:'materials', cost:region.anchor.cost};
  state.player.ore-=ore;
  state.player.echoes-=echoes;
  state.world.tideAnchors.push(id);
  recordEvent(state,'anchor',id);
  return {ok:true,cost:region.anchor.cost};
}

/** Bridges already avoid water entirely; repaired Sound water is easier to cross. */
export function waterMovementFactor(state, regionId) {
  return state.world.tideAnchors.includes(regionId) ? .88 : .72;
}
