import { REGIONS, REGION_BY_ID, regionCenter, worldPosition } from '../data/world.js';
import { QUESTS } from '../data/quests.js';
import { BEACON_COST, WAYSTONE_COST, milestoneProgress, questProgress } from './state.js';
import { trailProgress } from './trails.js';

const exists=(object,key)=>Object.hasOwn(object,key);
const point=(region,item,label,kind)=>({
  ...worldPosition(region,item.x,item.z),region:region.id,label,kind,
});
const closest=(state,items)=>items.reduce((best,item)=>{
  const distance=(item.x-state.player.x)**2+(item.z-state.player.z)**2;
  return !best || distance<best.distance ? {...item,distance} : best;
},null);
const regionItem=(id,key,label,kind=key)=>{
  const region=REGION_BY_ID[id], item=region?.[key];
  return item ? point(region,item,label,kind) : null;
};
function findGiver(id) {
  for (const region of REGIONS) for (const npc of [region.npc,region.extraNpc])
    if (npc?.quest === id) return point(region,npc,`Talk to ${npc.name}`,'npc');
  return null;
}
function findEnemy(state,type,now) {
  const candidates=[];
  for (const region of REGIONS) region.enemies.forEach(([enemy,x,z],index)=>{
    const id=`enemy:${region.id}:${index}`;
    if (type && enemy!==type) return;
    if (state.world.flags?.[enemy] || (state.world.respawns?.[id] || 0)>now) return;
    if (enemy==='guardian'||enemy==='warden'||enemy==='tempest') {
      if (type!==enemy) return;
    }
    const names={wisp:'Hushling',thorn:'Thornling',sentinel:'Sentinel',caster:'Shardcaster',surger:'Tide-runner',guardian:'Crown Guardian',warden:'Storm Warden',tempest:'Tempest Engine'};
    candidates.push(point(region,{x,z},`Find ${names[enemy] || 'a creature'}`,'enemy'));
  });
  return closest(state,candidates);
}
function findNode(state,type,now) {
  const candidates=[];
  for (const region of REGIONS) region.nodes.forEach(([node,x,z],index)=>{
    if (node!==type || (state.world.respawns?.[`node:${region.id}:${index}`] || 0)>now) return;
    candidates.push(point(region,{x,z},type==='ore'?'Gather ore':'Gather sunpetals','node'));
  });
  return closest(state,candidates);
}
function nearestRegionItem(state,key,filter,label) {
  const candidates=REGIONS.filter(region=>region[key] && filter(region)).map(region=>point(region,region[key],label, key));
  return closest(state,candidates);
}
/** Point to a renewable source when a tracked repair cannot yet be paid for. */
function materialTarget(state,key,amount,now) {
  const resource=key==='echoes' ? findEnemy(state,null,now) : findNode(state,key,now);
  if (!resource) return null;
  const name=key==='bloom' ? 'sunpetals' : key;
  return {...resource,label:`Gather ${name} · ${Math.min(state.player[key],amount)}/${amount}`};
}
function withMaterials(state,target,cost,now) {
  if (!target || !cost) return target;
  for (const key of ['ore','bloom','echoes']) {
    const amount=cost[key] || 0;
    if (state.player[key]<amount) return materialTarget(state,key,amount,now) || target;
  }
  return target;
}
function targetObjective(state,objective,now) {
  const id=objective.id;
  switch(objective.kind) {
    case 'visit': return exists(REGION_BY_ID,id) ? {...regionCenter(REGION_BY_ID[id]),region:id,label:`Visit ${REGION_BY_ID[id].name}`,kind:'visit'} : null;
    case 'waystone': return withMaterials(state,regionItem(id,'shrine',`Restore ${REGION_BY_ID[id]?.name || 'the'} waystone`),{echoes:WAYSTONE_COST},now);
    case 'memory': case 'lore': return regionItem(id,'lore',`Read ${REGION_BY_ID[id]?.name || 'the'} memory`);
    case 'beacon': return withMaterials(state,regionItem(id,'beacon','Repair the signal beacon'),BEACON_COST,now);
    case 'anchor': return withMaterials(state,regionItem(id,'anchor','Repair the tide anchor'),REGION_BY_ID[id]?.anchor?.cost,now);
    case 'anchors': {
      const target=nearestRegionItem(state,'anchor',r=>!state.world.tideAnchors.includes(r.id),'Repair a tide anchor');
      return withMaterials(state,target,REGION_BY_ID[target?.region]?.anchor?.cost,now);
    }
    case 'surger': return findEnemy(state,'surger',now);
    case 'cache': return regionItem(id,'cache','Find the courier cache');
    case 'archive': return regionItem(id,'archive','Align the archive');
    case 'project': return withMaterials(state,regionItem(id,'project','Restore the local site'),REGION_BY_ID[id]?.project?.cost,now);
    case 'boss': return findEnemy(state,id,now);
    case 'quest': return questTarget(state,id,now) || findGiver(id);
    case 'item': return materialTarget(state,objective.item,objective.amount || 1,now);
    case 'casters': return findEnemy(state,'caster',now);
    case 'archives': return nearestRegionItem(state,'archive',r=>!state.world.archives?.[r.id]?.solved,'Align an archive');
    case 'projects': {
      const target=nearestRegionItem(state,'project',r=>!state.world.projects?.[r.id],'Restore a site');
      return withMaterials(state,target,REGION_BY_ID[target?.region]?.project?.cost,now);
    }
    case 'chapter-regions': return closest(state,REGIONS.filter(r=>(r.chapter||1)===objective.chapter && !state.world.visited.includes(r.id))
      .map(r=>({...regionCenter(r),region:r.id,label:`Discover ${r.name}`,kind:'visit'})));
    default: return null;
  }
}
function questTarget(state,id,now) {
  if (!exists(QUESTS,id)) return null;
  const quest=QUESTS[id],status=state.world.quests[id];
  if (!status) return findGiver(id);
  if (status !== 'active') return null;
  if (questProgress(state,quest).ready) return findGiver(id);
  if (quest.kind==='first') {
    const stone=state.world.activated.includes('fields');
    if (state.stats.echoes<3 || (!stone && state.player.echoes<WAYSTONE_COST)) {
      const enemy=findEnemy(state,null,now);
      if (!enemy) return regionItem('fields','shrine','Restore the Sunpetal waystone');
      const count=!stone && state.player.echoes<WAYSTONE_COST ? state.player.echoes : state.stats.echoes;
      return {...enemy,label:`Gather echoes · ${Math.min(count,3)}/3`};
    }
    return regionItem('fields','shrine','Restore the Sunpetal waystone');
  }
  if (quest.kind==='milestones') {
    const next=quest.objectives.find(objective=>!milestoneProgress(state,objective).ready);
    return next ? targetObjective(state,next,now) : findGiver(id);
  }
  if (quest.kind==='item') return targetObjective(state,quest,now);
  if (quest.kind==='kills') return findEnemy(state,null,now);
  if (quest.kind==='sentinels') return findEnemy(state,'sentinel',now);
  if (quest.kind==='boss') return findEnemy(state,quest.flag || 'guardian',now);
  if (quest.kind==='regions' || quest.kind==='chapter-regions') {
    const candidates=REGIONS.filter(r=>!state.world.visited.includes(r.id) && (!quest.chapter || (r.chapter||1)===quest.chapter))
      .map(r=>({...regionCenter(r),region:r.id,label:`Discover ${r.name}`,kind:'visit'}));
    return closest(state,candidates);
  }
  if (quest.kind==='lore' || quest.kind==='chapter-lore')
    return nearestRegionItem(state,'lore',r=>!state.world.lore.includes(r.id) && (!quest.chapter || (r.chapter||1)===quest.chapter),'Read a memory stone');
  if (quest.kind==='shrines') return withMaterials(state,nearestRegionItem(state,'shrine',r=>!state.world.activated.includes(r.id),'Restore a waystone'),{echoes:WAYSTONE_COST},now);
  if (quest.kind==='beacons') return withMaterials(state,nearestRegionItem(state,'beacon',r=>!state.world.beacons.includes(r.id),'Repair a signal beacon'),BEACON_COST,now);
  if (quest.kind==='caches') return nearestRegionItem(state,'cache',r=>!state.world.openedCaches.includes(r.id),'Open a courier cache');
  return null;
}
function nextStoryTarget(state) {
  if (state.world.quests['first-light']!=='complete') return findGiver('first-light');
  if (state.world.quests['first-beacon']!=='complete') return findGiver('first-beacon');
  if (state.world.quests['last-signal']!=='complete') return findGiver('last-signal');
  if (state.world.quests['gate-of-questions']!=='complete') return findGiver('gate-of-questions');
  if (state.world.quests['measure-of-a-promise']!=='complete') return findGiver('measure-of-a-promise');
  if (state.world.quests['the-order-we-change']!=='complete') return findGiver('the-order-we-change');
  if (state.world.quests['opening-the-sound']!=='complete') return findGiver('opening-the-sound');
  if (state.world.quests['when-water-answers']!=='complete') return findGiver('when-water-answers');
  return null;
}
/** Guidance is a straight-line bearing, not an automatic path or fast travel. */
export function navigationTarget(state,now=Date.now()) {
  const pin=state.world.pinnedRegion;
  if (typeof pin==='string' && state.world.visited.includes(pin) && exists(REGION_BY_ID,pin)) {
    const region=REGION_BY_ID[pin];
    return {...regionCenter(region),region:pin,label:`Pinned: ${region.name}`,kind:'pin',source:'pin'};
  }
  const trail=state.world.trails?.active;
  if (trail) {
    const progress=trailProgress(state,trail);
    if (progress?.ready) {
      const stone=nearestRegionItem(state,'shrine',r=>state.world.activated.includes(r.id),'Return to a restored waystone');
      return stone && {...stone,source:'trail'};
    }
    const objective=progress?.objectives.find(item=>!item.done);
    const target=objective && targetObjective(state,objective,now);
    if (target) return {...target,source:'trail'};
  }
  const target=questTarget(state,state.activeQuest,now) || nextStoryTarget(state);
  return target && {...target,source:'quest'};
}
export function bearingTo(player,target) {
  if (!target) return null;
  const dx=target.x-player.x,dz=target.z-player.z,distance=Math.hypot(dx,dz);
  const names=['N','NE','E','SE','S','SW','W','NW'];
  const angle=(Math.atan2(dx,-dz)+Math.PI*2)%(Math.PI*2);
  return {distance,direction:names[Math.round(angle/(Math.PI/4))%8],angle};
}
