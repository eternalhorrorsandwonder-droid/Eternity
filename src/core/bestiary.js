import { BESTIARY, BESTIARY_BY_ID } from '../data/bestiary.js';
export const OBSERVATION_CAP=1_000_000;
export function normalizeBestiary(raw,stats={},flags={}) {
  const result={};
  for (const entry of BESTIARY) {
    const value=raw?.[entry.id];
    let count=Number.isFinite(value?.defeated) ? Math.max(0,Math.min(OBSERVATION_CAP,Math.floor(value.defeated))) : 0;
    // Earlier schemas recorded these totals but did not distinguish Hushlings and Thornlings.
    if (entry.id==='sentinel') count=Math.max(count,Math.min(OBSERVATION_CAP,stats.sentinels || 0));
    if (entry.id==='caster') count=Math.max(count,Math.min(OBSERVATION_CAP,stats.casters || 0));
    if (['guardian','warden','tempest'].includes(entry.id) && flags[entry.id]) count=Math.max(count,1);
    if (value?.seen===true || count>0) result[entry.id]={seen:true,defeated:count};
  }
  return result;
}
export function observeEnemy(state,type) {
  if (!Object.hasOwn(BESTIARY_BY_ID,type)) return false;
  if (state.world.bestiary[type]?.seen) return false;
  state.world.bestiary[type]={seen:true,defeated:0};
  return true;
}
export function recordEnemyDefeat(state,type) {
  if (!Object.hasOwn(BESTIARY_BY_ID,type)) return false;
  observeEnemy(state,type);
  state.world.bestiary[type].defeated=Math.min(OBSERVATION_CAP,state.world.bestiary[type].defeated+1);
  return true;
}
