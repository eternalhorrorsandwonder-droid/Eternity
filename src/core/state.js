import { CHRONICLE_LIMIT, recordEvent, validChronicleEntry } from "./chronicle.js";
import { ACHIEVEMENTS, QUESTS } from "../data/quests.js";
import { REGIONS, REGION_BY_ID, worldBounds } from "../data/world.js";
import { creatureMaxHealth, isBossType } from "../data/encounters.js";
import { archiveCount, projectCount, normalizeFrontier, projectDamageFactor } from "./frontier.js";
import { gearStats, normalizeGear } from "./gear.js";
import { INVENTORY_LIMIT, STAT_LIMIT, creditInventory, creditStat } from "./limits.js";
import { normalizeTrails } from "./trails.js";
import { emptyKit, normalizeKit } from "./kit.js";
import { KIT_ITEMS, KIT_BY_ID } from "../data/kit.js";
import { normalizeBestiary } from "./bestiary.js";

export const SAVE_VERSION = 5;
export const BEACON_COST = Object.freeze({ echoes: 2, ore: 2 });
export const WAYSTONE_COST = 3;
export const LEVEL_CAP = 30;
export const TALENT_CAPS = { might: 9, vitality: 9, grace: 5, focus: 6 };
export const ITEM_NAMES = {
  bloom: "Sunpetals",
  ore: "Vale ore",
  echoes: "Echoes",
  potions: "Remedies",
};

export function newGame(name = "Wayfinder") {
  return {
    version: SAVE_VERSION,
    player: {
      name: String(name).trim().slice(0, 24) || "Wayfinder",
      x: 0,
      z: 4,
      hp: 100,
      level: 1,
      xp: 0,
      coins: 0,
      echoes: 0,
      bloom: 0,
      ore: 0,
      potions: 3,
      weapon: 0,
      points: 0,
      talents: { might: 0, vitality: 0, grace: 0, focus: 0 },
      gear: { owned: [], equipped: null },
      kit: emptyKit(),
      skills: { pulse: false, ward: false },
      lastShrine: "haven",
    },
    world: {
      visited: ["haven"],
      activated: ["haven"],
      lore: [],
      quests: {},
      flags: {},
      respawns: {},
      wounded: {},
      beacons: [],
      tideAnchors: [],
      openedCaches: [],
      archives: {},
      projects: {},
      trails: { claimed: [], active: null },
      pinnedRegion: null,
      bestiary: {},
      events: [{ type: "discovery", id: "haven", at: Date.now() }],
    },
    stats: {
      defeated: 0,
      sentinels: 0,
      casters: 0,
      completed: 0,
      echoes: 0,
      blooms: 0,
      ore: 0,
      earned: 0,
      distance: 0,
      falls: 0,
      seconds: 0,
    },
    achievements: [],
    activeQuest: "first-light",
    createdAt: Date.now(),
    savedAt: Date.now(),
  };
}

export const xpRequired = (level) =>
  Math.round(40 + level * 25 + level * level * 4);
export const maxHealth = (player) =>
  Math.max(1, 100 + (player.level - 1) * 8 + player.talents.vitality * 12 + (gearStats(player).health || 0));
export const attackPower = (player) =>
  Math.round(
    14 +
      (player.level - 1) * 1.5 +
      player.weapon * 3 +
      player.talents.might * 2 +
      (gearStats(player).attack || 0),
  );
export const dashCooldown = (player) =>
  Math.max(1.5, 3.2 - player.talents.grace * 0.25 + (gearStats(player).dash || 0));
export const pulseCooldown = (player) =>
  Math.max(4, 8 - (player.talents.focus || 0) * .5 + (gearStats(player).pulseCooldown || 0));
export const pulsePower = (player) =>
  attackPower(player) * (1.15 + (player.talents.focus || 0) * .08) * (1 + (gearStats(player).pulse || 0));
export const remedyPower = (player) => 45 + (gearStats(player).heal || 0);

export function addXp(state, amount) {
  const p = state.player;
  if (p.level >= LEVEL_CAP) return [];
  p.xp += Math.max(0, Math.floor(amount));
  const levels = [];
  while (p.level < LEVEL_CAP && p.xp >= xpRequired(p.level)) {
    p.xp -= xpRequired(p.level);
    p.level += 1;
    p.points += 1;
    p.hp = maxHealth(p);
    levels.push(p.level);
  }
  if (p.level === LEVEL_CAP) p.xp = 0;
  return levels;
}

export function addCoins(state, amount) {
  amount = Math.max(0, Math.floor(amount));
  creditInventory(state.player,"coins",amount);
  creditStat(state.stats,"earned",amount);
}

/** Each objective is stable and may be completed before a request is accepted. */
export function milestoneProgress(state, objective) {
  let current=0, required=objective.amount || 1;
  if (objective.kind === "archive") current=state.world.archives?.[objective.id]?.solved ? 1 : 0;
  else if (objective.kind === "archives") current=archiveCount(state);
  else if (objective.kind === "project") current=state.world.projects?.[objective.id] ? 1 : 0;
  else if (objective.kind === "projects") current=projectCount(state);
  else if (objective.kind === "lore") current=state.world.lore.includes(objective.id) ? 1 : 0;
  else if (objective.kind === "boss") current=state.world.flags[objective.id] ? 1 : 0;
  else if (objective.kind === "casters") current=state.stats.casters || 0;
  else if (objective.kind === "surger") current=state.world.bestiary?.surger?.defeated || 0;
  else if (objective.kind === "anchor") current=state.world.tideAnchors.includes(objective.id) ? 1 : 0;
  else if (objective.kind === "anchors") current=state.world.tideAnchors.length;
  else if (objective.kind === "visit") current=state.world.visited.includes(objective.id) ? 1 : 0;
  else if (objective.kind === "quest") current=state.world.quests[objective.id] === "complete" ? 1 : 0;
  else if (objective.kind === "item") current=state.player[objective.item] || 0;
  else if (objective.kind === "chapter-regions")
    current=state.world.visited.filter(id => (REGION_BY_ID[id]?.chapter || 1) === objective.chapter).length;
  return {label:objective.label,current:Math.min(current,required),required,ready:current>=required};
}

export function questProgress(state, questOrId) {
  const q = typeof questOrId === "string" ? (Object.hasOwn(QUESTS, questOrId) ? QUESTS[questOrId] : null) : questOrId;
  if (!q) return { current: 0, required: 1, ready: false, text: "" };
  let current = 0,
    required = q.amount || 1;
  if (q.kind === "milestones") {
    const details=q.objectives.map(objective=>milestoneProgress(state,objective));
    const complete=details.filter(detail=>detail.ready).length;
    const next=details.find(detail=>!detail.ready);
    return {current:complete,required:details.length,ready:complete===details.length,
      text:next ? `${complete}/${details.length} tasks · ${next.label}` : `${complete}/${details.length} tasks complete`,details};
  }
  if (q.kind === "first") {
    const echoes = Math.min(state.stats.echoes, 3);
    const stone = state.world.activated.includes("fields");
    return {
      current: echoes + (stone ? 1 : 0),
      required: 4,
      ready: echoes >= 3 && stone,
      text: `${echoes}/3 echoes gathered  ·  ${stone ? "Waystone restored" : `Sunpetal waystone: ${state.player.echoes}/${WAYSTONE_COST} echoes on hand`}`,
    };
  }
  if (q.kind === "item") current = state.player[q.item] || 0;
  if (q.kind === "kills") current = state.stats.defeated;
  if (q.kind === "regions") current = state.world.visited.length;
  if (q.kind === "lore") current = state.world.lore.length;
  if (q.kind === "shrines")
    current = Math.max(0, state.world.activated.length - 1);
  if (q.kind === "boss") current = state.world.flags[q.flag || "guardian"] ? 1 : 0;
  if (q.kind === "beacons") current = state.world.beacons.length;
  if (q.kind === "caches") current = state.world.openedCaches.length;
  if (q.kind === "sentinels") current = state.stats.sentinels;
  if (q.kind === "chapter-regions") current = state.world.visited.filter(id => (REGION_BY_ID[id]?.chapter || 1) === q.chapter).length;
  if (q.kind === "chapter-lore") current = state.world.lore.filter(id => (REGION_BY_ID[id]?.chapter || 1) === q.chapter).length;
  const label =
    q.kind === "item"
      ? ITEM_NAMES[q.item]
      : {
          kills: "creatures settled",
          regions: "regions discovered",
          lore: "memories read",
          shrines: "waystones restored",
          boss: "guardian quieted",
          beacons: "signal beacons repaired",
          caches: "supply caches opened",
          sentinels: "sentinels settled",
          "chapter-regions": q.chapter === 3 ? "Wilds regions discovered" : "Reaches regions discovered",
          "chapter-lore": q.chapter === 3 ? "Wilds memories read" : "Reaches memories read",
        }[q.kind] || "";
  return {
    current: Math.min(current, required),
    required,
    ready: current >= required,
    text: `${Math.min(current, required)}/${required} ${label}`,
  };
}

export function acceptQuest(state, id) {
  if (!Object.hasOwn(QUESTS, id) || state.world.quests[id]) return false;
  state.world.quests[id] = "active";
  recordEvent(state, "accept", id);
  state.activeQuest = id;
  return true;
}

export function completeQuest(state, id) {
  const q = Object.hasOwn(QUESTS, id) ? QUESTS[id] : null;
  if (
    !q ||
    state.world.quests[id] !== "active" ||
    !questProgress(state, q).ready
  )
    return null;
  const deliveries = q.kind === "item" ? [{item:q.item,amount:q.amount}]
    : q.kind === "milestones" ? q.objectives.filter(objective=>objective.kind === "item") : [];
  const costs = {};
  for (const delivery of deliveries) costs[delivery.item]=(costs[delivery.item] || 0)+delivery.amount;
  if (Object.entries(costs).some(([item,amount])=>state.player[item]<amount)) return null;
  for (const [item,amount] of Object.entries(costs)) state.player[item]-=amount;
  state.world.quests[id] = "complete";
  recordEvent(state, "complete", id);
  const reward = q.reward;
  const levels = addXp(state, reward.xp || 0);
  addCoins(state, reward.coins || 0);
  if (reward.potions) creditInventory(state.player,"potions",reward.potions);
  if (reward.weapon)
    state.player.weapon = Math.min(5, state.player.weapon + reward.weapon);
  if (reward.skill) state.player.skills[reward.skill] = true;
  state.stats.completed = (state.stats.completed || 0) + 1;
  if (state.activeQuest === id) {
    state.activeQuest =
      Object.keys(state.world.quests).find(
        (key) => state.world.quests[key] === "active",
      ) || "";
  }
  return { reward, levels };
}

/** Spend resources atomically. Beacons change local enemy behavior permanently. */
export function repairBeacon(state, regionId) {
  const region = REGION_BY_ID[regionId];
  if (!region?.beacon) return { ok: false, reason: "invalid" };
  if (state.world.beacons.includes(regionId)) return { ok: false, reason: "already" };
  if (state.player.echoes < BEACON_COST.echoes || state.player.ore < BEACON_COST.ore)
    return { ok: false, reason: "materials" };
  state.player.echoes -= BEACON_COST.echoes;
  state.player.ore -= BEACON_COST.ore;
  state.world.beacons.push(regionId);
  recordEvent(state, "beacon", regionId);
  return { ok: true };
}

/** A cache is a one-time authored reward; its region ID is its stable save key. */
export function openCache(state, regionId) {
  const region = REGION_BY_ID[regionId];
  if (!region?.cache) return { ok: false, reason: "invalid" };
  if (state.world.openedCaches.includes(regionId)) return { ok: false, reason: "already" };
  const reward = region.cache.reward;
  for (const item of ["echoes", "bloom", "ore", "potions"])
    creditInventory(state.player,item,reward[item] || 0);
  addCoins(state, reward.coins || 0);
  state.world.openedCaches.push(regionId);
  recordEvent(state, "cache", regionId);
  return { ok: true, reward };
}

export function enemyDamage(state, enemy, multiplier = 1) {
  const boss = isBossType(enemy.type);
  const base = 6 + enemy.level * (boss ? 2.3 : 1.6);
  return Math.max(1, Math.round(base * multiplier * (state.world.beacons.includes(enemy.region) ? 0.8 : 1) * projectDamageFactor(state, enemy.region)));
}

export function spendTalent(state, type) {
  const p = state.player;
  if (
    !Object.hasOwn(TALENT_CAPS, type) ||
    p.points < 1 ||
    p.talents[type] >= TALENT_CAPS[type]
  )
    return false;
  const oldMax = maxHealth(p);
  p.points--;
  p.talents[type]++;
  p.hp += maxHealth(p) - oldMax;
  return true;
}

export function unlockAchievements(state) {
  const unlocked = [];
  for (const achievement of ACHIEVEMENTS) {
    if (
      !state.achievements.includes(achievement.id) &&
      achievement.test(state)
    ) {
      state.achievements.push(achievement.id);
      recordEvent(state, "achievement", achievement.id);
      unlocked.push(achievement);
    }
  }
  return unlocked;
}

export function pruneRespawns(state, now = Date.now()) {
  for (const [id, until] of Object.entries(state.world.respawns)) {
    if (!Number.isFinite(until) || until <= now)
      delete state.world.respawns[id];
  }
}

/** Validate untrusted imports and migrate known fields onto a fresh schema. */
export function normalizeSave(source) {
  if (
    !source ||
    typeof source !== "object" ||
    ![1, 2, 3, 4, SAVE_VERSION].includes(source.version) ||
    !source.player || typeof source.player !== "object" || Array.isArray(source.player) ||
    !source.world || typeof source.world !== "object" || Array.isArray(source.world)
  ) {
    throw new Error("This is not a compatible Eternity save.");
  }
  const out = newGame(source.player.name);
  const numeric = (value, fallback, min = 0, max = 1e9) =>
    Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
  const p = source.player,
    target = out.player;
  for (const key of [
    "level",
    "xp",
    "hp",
    "coins",
    "echoes",
    "bloom",
    "ore",
    "potions",
    "weapon",
    "points",
  ]) {
    target[key] = numeric(
      p[key],
      target[key],
      0,
      key === "level" ? LEVEL_CAP : INVENTORY_LIMIT,
    );
  }
  target.level = Math.max(1, Math.floor(target.level));
  target.weapon = Math.min(5, Math.floor(target.weapon));
  for (const key of ["xp", "coins", "echoes", "bloom", "ore", "potions", "points"]) target[key] = Math.floor(target[key]);
  target.x = numeric(p.x, 0, worldBounds.minX, worldBounds.maxX);
  target.z = numeric(p.z, 4, worldBounds.minZ, worldBounds.maxZ);
  for (const key of Object.keys(TALENT_CAPS))
    target.talents[key] = Math.floor(
      numeric(p.talents?.[key], 0, 0, TALENT_CAPS[key]),
    );
  // Talent points only come from levels; reject impossible imported allocations.
  let budget = target.level - 1;
  for (const key of Object.keys(TALENT_CAPS)) {
    target.talents[key] = Math.min(target.talents[key], budget);
    budget -= target.talents[key];
  }
  target.points = Math.min(target.points, budget);
  target.xp = target.level >= LEVEL_CAP ? 0 : Math.min(target.xp, xpRequired(target.level) - 1);
  target.gear = normalizeGear(p.gear);
  target.kit = normalizeKit(p.kit);
  target.skills.pulse = p.skills?.pulse === true;
  target.skills.ward = p.skills?.ward === true;
  target.hp = Math.min(target.hp, maxHealth(target));
  const regionIds = new Set(REGIONS.map((region) => region.id));
  const unique = (arr, allowed, max) =>
    Array.isArray(arr)
      ? [
          ...new Set(
            arr.filter((item) => typeof item === "string" && allowed.has(item)),
          ),
        ].slice(0, max)
      : [];
  out.world.visited = unique(source.world.visited, regionIds, REGIONS.length);
  out.world.activated = unique(source.world.activated, regionIds, REGIONS.length);
  if (!out.world.visited.includes("haven")) out.world.visited.unshift("haven");
  if (!out.world.activated.includes("haven"))
    out.world.activated.unshift("haven");
  // Restored stones imply discovery; a checkpoint may not point at a dormant stone.
  for (const id of out.world.activated) if (!out.world.visited.includes(id)) out.world.visited.push(id);
  target.lastShrine = out.world.activated.includes(p.lastShrine) ? p.lastShrine : "haven";
  out.world.lore = unique(source.world.lore, regionIds, REGIONS.length);
  const beaconIds = new Set(REGIONS.filter(region => region.beacon).map(region => region.id));
  const cacheIds = new Set(REGIONS.filter(region => region.cache).map(region => region.id));
  out.world.beacons = unique(source.world.beacons, beaconIds, beaconIds.size);
  const tideAnchorIds = new Set(REGIONS.filter(region => region.anchor).map(region => region.id));
  out.world.tideAnchors = unique(source.world.tideAnchors, tideAnchorIds, tideAnchorIds.size);
  out.world.openedCaches = unique(source.world.openedCaches, cacheIds, cacheIds.size);
  ({archives:out.world.archives,projects:out.world.projects}=normalizeFrontier(source.world));
  for (const id of [...out.world.lore, ...out.world.beacons, ...out.world.tideAnchors, ...out.world.openedCaches, ...Object.keys(out.world.archives), ...Object.keys(out.world.projects)])
    if (!out.world.visited.includes(id)) out.world.visited.push(id);
  out.world.events = Array.isArray(source.world.events)
    ? source.world.events.filter(entry => validChronicleEntry(entry)).slice(-CHRONICLE_LIMIT)
      .map(({type,id,at})=>({type,id,at})) : [];
  for (const [id, status] of Object.entries(source.world.quests || {})) {
    if (Object.hasOwn(QUESTS, id) && ["active", "complete"].includes(status))
      out.world.quests[id] = status;
  }
  out.world.flags.guardian = source.world.flags?.guardian === true || out.world.quests.crown === "complete";
  out.world.flags.warden = source.world.flags?.warden === true || out.world.quests["last-signal"] === "complete";
  out.world.flags.tempest = source.world.flags?.tempest === true || out.world.quests["the-order-we-change"] === "complete";
  if (out.world.quests["first-light"] === "complete") target.skills.pulse = true;
  if (out.world.quests["first-beacon"] === "complete") target.skills.ward = true;
  // Only the finite set of authored IDs may occupy this sparse, expiring ledger.
  const allowedRespawns = new Set(), allowedWounded = new Map();
  for (const region of REGIONS) {
    region.nodes.forEach((_, i) => allowedRespawns.add(`node:${region.id}:${i}`));
    region.enemies.forEach(([type], i) => {
      const id = `enemy:${region.id}:${i}`;
      if (!isBossType(type)) allowedRespawns.add(id);
      if (!isBossType(type) || !out.world.flags[type])
        allowedWounded.set(id, creatureMaxHealth(type, region.danger));
    });
  }
  for (const [id, until] of Object.entries(source.world.respawns || {})) {
    if (
      allowedRespawns.has(id) &&
      Number.isFinite(until) &&
      until > Date.now() &&
      until < Date.now() + 86400000
    )
      out.world.respawns[id] = until;
  }
  for (const [id, hp] of Object.entries(source.world.wounded || {})) {
    if (
      allowedWounded.has(id) &&
      Number.isFinite(hp) &&
      hp > 0 &&
      hp < allowedWounded.get(id) &&
      !out.world.respawns[id]
    )
      out.world.wounded[id] = hp;
  }
  for (const key of Object.keys(out.stats)) {
    const value = numeric(source.stats?.[key], 0, 0, STAT_LIMIT);
    out.stats[key] = key === "distance" || key === "seconds" ? value : Math.floor(value);
  }
  out.stats.sentinels = Math.min(out.stats.sentinels, out.stats.defeated);
  out.stats.casters = Math.min(out.stats.casters, out.stats.defeated);
  out.stats.completed = Object.values(out.world.quests).filter(status => status === "complete").length;
  out.achievements = unique(
    source.achievements,
    new Set(ACHIEVEMENTS.map((a) => a.id)),
    ACHIEVEMENTS.length,
  );
  out.world.bestiary = normalizeBestiary(source.world.bestiary, out.stats, out.world.flags);
  out.world.trails = normalizeTrails(source.world.trails, out);
  for (const item of KIT_ITEMS) if (item.unlock > out.world.trails.claimed.length) target.kit.supplies[item.id]=0;
  if (KIT_BY_ID[target.kit.selected].unlock > out.world.trails.claimed.length) target.kit.selected="flash";
  out.world.pinnedRegion = typeof source.world.pinnedRegion === "string" && out.world.visited.includes(source.world.pinnedRegion)
    ? source.world.pinnedRegion : null;
  out.activeQuest = out.world.quests[source.activeQuest] === "active"
    ? source.activeQuest
    : Object.keys(out.world.quests).find(id => out.world.quests[id] === "active") ||
      (!out.world.quests["first-light"] ? "first-light" : "");
  out.createdAt = numeric(
    source.createdAt,
    Date.now(),
    0,
    Date.now() + 86400000,
  );
  out.savedAt = numeric(source.savedAt, Date.now(), 0, Date.now() + 86400000);
  return out;
}
