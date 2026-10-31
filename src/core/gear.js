import { CHARMS, CHARM_BY_ID } from '../data/gear.js';
import { archiveCount } from './frontier.js';

export function gearStats(player) {
  const id=player.gear?.equipped;
  return id && player.gear?.owned?.includes(id) && Object.hasOwn(CHARM_BY_ID,id)
    ? CHARM_BY_ID[id].stats : {};
}
export function canCraftCharm(state,id) {
  if (!Object.hasOwn(CHARM_BY_ID,id)) return {ok:false,reason:'invalid'};
  const charm=CHARM_BY_ID[id];
  if (state.player.gear.owned.includes(id)) return {ok:false,reason:'owned'};
  if (archiveCount(state)<charm.unlock) return {ok:false,reason:'locked'};
  if (Object.entries(charm.cost).some(([item,amount])=>state.player[item]<amount))
    return {ok:false,reason:'materials'};
  return {ok:true};
}
export function craftCharm(state,id) {
  const result=canCraftCharm(state,id);
  if (!result.ok) return result;
  for (const [item,amount] of Object.entries(CHARM_BY_ID[id].cost)) state.player[item]-=amount;
  state.player.gear.owned.push(id);
  return {ok:true,charm:CHARM_BY_ID[id]};
}
export function equipCharm(state,id) {
  if (id===null) {state.player.gear.equipped=null;return true;}
  if (!Object.hasOwn(CHARM_BY_ID,id) || !state.player.gear.owned.includes(id)) return false;
  state.player.gear.equipped=id;
  return true;
}
export function normalizeGear(raw) {
  const allowed=new Set(CHARMS.map(charm=>charm.id));
  const owned=Array.isArray(raw?.owned)
    ? [...new Set(raw.owned.filter(id=>typeof id==='string'&&allowed.has(id)))].slice(0,CHARMS.length) : [];
  return {owned,equipped:owned.includes(raw?.equipped)?raw.equipped:null};
}
