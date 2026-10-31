import { REGION_BY_ID } from '../data/world.js';
import { QUESTS, ACHIEVEMENTS } from '../data/quests.js';
import { TRAIL_BY_ID } from '../data/trails.js';

export const CHRONICLE_LIMIT = 80;
const regionEvents = new Set(['discovery','waystone','memory','beacon','cache','fall','archive','project','anchor']);
const bossNames = {guardian:'Crown Guardian',warden:'Storm Warden',tempest:'Tempest Engine'};

/** Entries contain only a known event type, stable authored ID and timestamp. */
export function validChronicleEntry(entry, now = Date.now()) {
  if (!entry || typeof entry !== 'object' || typeof entry.type !== 'string' ||
      typeof entry.id !== 'string' || !Number.isFinite(entry.at) || entry.at < 0 || entry.at > now + 86400000) return false;
  if (regionEvents.has(entry.type)) {
    const region = Object.hasOwn(REGION_BY_ID, entry.id) ? REGION_BY_ID[entry.id] : null;
    return !!region && (entry.type !== 'beacon' || !!region.beacon) && (entry.type !== 'cache' || !!region.cache) && (entry.type !== 'archive' || !!region.archive) && (entry.type !== 'project' || !!region.project) && (entry.type !== 'anchor' || !!region.anchor);
  }
  if (entry.type === 'accept' || entry.type === 'complete') return Object.hasOwn(QUESTS,entry.id);
  if (entry.type === 'achievement') return ACHIEVEMENTS.some(a=>a.id===entry.id);
  if (entry.type === 'boss') return Object.hasOwn(bossNames,entry.id);
  if (entry.type === 'trail') return Object.hasOwn(TRAIL_BY_ID,entry.id);
  return false;
}
export function recordEvent(state, type, id, at = Date.now()) {
  const entry = {type,id,at};
  if (!validChronicleEntry(entry)) return false;
  if (!Array.isArray(state.world.events)) state.world.events=[];
  state.world.events.push(entry);
  if (state.world.events.length > CHRONICLE_LIMIT)
    state.world.events.splice(0,state.world.events.length-CHRONICLE_LIMIT);
  return true;
}
export function describeEvent(entry) {
  const region=REGION_BY_ID[entry.id];
  switch(entry.type) {
    case 'discovery': return `Discovered ${region.name}.`;
    case 'waystone': return `Restored the ${region.name} waystone.`;
    case 'memory': return `Read “${region.lore.title}” in ${region.name}.`;
    case 'beacon': return `Repaired the ${region.name} signal beacon.`;
    case 'cache': return `Opened a courier's cache in ${region.name}.`;
    case 'archive': return `Aligned the archive in ${region.name}.`;
    case 'project': return `Restored ${region.project.name} in ${region.name}.`;
    case 'anchor': return `Repaired ${region.anchor.name} in ${region.name}.`;
    case 'fall': return `Returned to the light at ${region.name}.`;
    case 'accept': return `Accepted “${QUESTS[entry.id].name}”.`;
    case 'complete': return `Completed “${QUESTS[entry.id].name}”.`;
    case 'achievement': return `Earned “${ACHIEVEMENTS.find(a=>a.id===entry.id).name}”.`;
    case 'boss': return `Quieted the ${bossNames[entry.id]}.`;
    case 'trail': return `Completed the field route “${TRAIL_BY_ID[entry.id].name}”.`;
    default: return '';
  }
}
