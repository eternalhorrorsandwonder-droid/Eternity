import { KIT_ITEMS, KIT_BY_ID, KIT_CAP } from '../data/kit.js';

export function emptyKit() {
  return {selected:'flash',supplies:Object.fromEntries(KIT_ITEMS.map(item=>[item.id,0]))};
}
export function normalizeKit(raw) {
  const kit=emptyKit();
  if (typeof raw?.selected==='string' && Object.hasOwn(KIT_BY_ID,raw.selected)) kit.selected=raw.selected;
  for (const item of KIT_ITEMS) {
    const count=raw?.supplies?.[item.id];
    kit.supplies[item.id]=Number.isFinite(count) ? Math.max(0,Math.min(KIT_CAP,Math.floor(count))) : 0;
  }
  return kit;
}
export function canCraftKit(state,id) {
  if (!Object.hasOwn(KIT_BY_ID,id)) return {ok:false,reason:'invalid'};
  const item=KIT_BY_ID[id];
  if (state.world.trails.claimed.length<item.unlock) return {ok:false,reason:'locked'};
  if (state.player.kit.supplies[id]>=KIT_CAP) return {ok:false,reason:'full'};
  if (Object.entries(item.cost).some(([key,value])=>state.player[key]<value)) return {ok:false,reason:'materials'};
  return {ok:true};
}
/** Call only near a restored waystone. All checks happen before materials change. */
export function craftKit(state,id) {
  const result=canCraftKit(state,id);
  if (!result.ok) return result;
  const item=KIT_BY_ID[id];
  for (const [key,value] of Object.entries(item.cost)) state.player[key]-=value;
  state.player.kit.supplies[id]++;
  return {ok:true,item};
}
export function equipKit(state,id) {
  if (!Object.hasOwn(KIT_BY_ID,id) || state.world.trails.claimed.length<KIT_BY_ID[id].unlock) return false;
  state.player.kit.selected=id;
  return true;
}
export function spendKit(state,id) {
  if (!Object.hasOwn(KIT_BY_ID,id) || state.world.trails.claimed.length<KIT_BY_ID[id].unlock || state.player.kit.supplies[id]<1) return false;
  state.player.kit.supplies[id]--;
  return true;
}
