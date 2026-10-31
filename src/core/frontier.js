import { ARCHIVES, ARCHIVE_GLYPHS } from '../data/archives.js';
import { MERIDIAN } from '../data/meridian.js';
import { recordEvent } from './chronicle.js';
import { creditInventory, creditStat } from './limits.js';

const regionById = Object.fromEntries(MERIDIAN.map(region => [region.id, region]));
const CHOICES = new Set(['shelter','watch']);
const clampInt = (value, min, max, fallback=0) => Number.isFinite(value)
  ? Math.max(min, Math.min(max, Math.floor(value))) : fallback;

export function archiveCount(state) {
  return Object.values(state.world.archives || {}).filter(entry => entry.solved).length;
}
export function projectCount(state) {
  return Object.keys(state.world.projects || {}).length;
}
export function readArchive(state, id) {
  if (!Object.hasOwn(ARCHIVES,id)) return null;
  return state.world.archives?.[id] || { dials:[0,0,0], solved:false, attempts:0 };
}
export function rotateArchive(state, id, index) {
  if (!Object.hasOwn(ARCHIVES,id) || !Number.isInteger(index) || index < 0 || index > 2)
    return {ok:false,reason:'invalid'};
  const existing=readArchive(state,id);
  if (existing.solved) return {ok:false,reason:'solved'};
  const entry={dials:[...existing.dials],solved:false,attempts:existing.attempts};
  entry.dials[index]=(entry.dials[index]+1)%ARCHIVE_GLYPHS.length;
  state.world.archives[id]=entry;
  return {ok:true,entry};
}
export function submitArchive(state, id) {
  if (!Object.hasOwn(ARCHIVES,id)) return {ok:false,reason:'invalid'};
  const entry=readArchive(state,id);
  if (entry.solved) return {ok:false,reason:'solved'};
  const correct=entry.dials.every((value,i)=>ARCHIVE_GLYPHS[value]?.id===ARCHIVES[id].solution[i]);
  const next={dials:[...entry.dials],solved:correct,attempts:Math.min(99,entry.attempts+1)};
  state.world.archives[id]=next;
  if (!correct) return {ok:false,reason:'alignment',entry:next};
  const reward=ARCHIVES[id].reward;
  for (const key of ['ore','bloom','echoes','potions']) creditInventory(state.player,key,reward[key]||0);
  const coins=reward.coins||0;
  creditInventory(state.player,'coins',coins);
  creditStat(state.stats,'earned',coins);
  recordEvent(state,'archive',id);
  return {ok:true,entry:next,reward};
}
export function buildProject(state, id, choice) {
  if (!Object.hasOwn(regionById,id) || !CHOICES.has(choice)) return {ok:false,reason:'invalid'};
  if (state.world.projects[id]) return {ok:false,reason:'already'};
  const cost=regionById[id].project.cost;
  if (state.player.ore < cost.ore || state.player.bloom < cost.bloom)
    return {ok:false,reason:'materials',cost};
  state.player.ore-=cost.ore;
  state.player.bloom-=cost.bloom;
  state.world.projects[id]=choice;
  recordEvent(state,'project',id);
  return {ok:true,choice,cost};
}
export function normalizeFrontier(source) {
  const archives={},projects={};
  for (const [id, definition] of Object.entries(ARCHIVES)) {
    const raw=source?.archives?.[id];
    if (!raw || typeof raw!=='object' || !Array.isArray(raw.dials) || raw.dials.length!==3) continue;
    const dials=raw.dials.map(value=>clampInt(value,0,ARCHIVE_GLYPHS.length-1));
    const valid=raw.dials.every(value=>Number.isInteger(value) && value>=0 && value<ARCHIVE_GLYPHS.length);
    const correct=dials.every((value,i)=>ARCHIVE_GLYPHS[value].id===definition.solution[i]);
    archives[id]={dials,solved:raw.solved===true && valid && correct,attempts:clampInt(raw.attempts,0,99)};
  }
  for (const id of Object.keys(regionById)) {
    const choice=source?.projects?.[id];
    if (CHOICES.has(choice)) projects[id]=choice;
  }
  return {archives,projects};
}

/** Watchposts help with rewards; shelters soften enemy damage in their home region. */
export const projectDamageFactor = (state, regionId) => state.world.projects?.[regionId] === 'shelter' ? 0.85 : 1;
export const projectRewardFactor = (state, regionId) => state.world.projects?.[regionId] === 'watch' ? 1.25 : 1;
