/** Inventory and lifetime counters use the same limits during play and import. */
export const INVENTORY_LIMIT = 10_000_000;
export const STAT_LIMIT = 1_000_000_000;
export function creditInventory(player, key, amount) {
  const before=player[key];
  player[key]=Math.min(INVENTORY_LIMIT,before+Math.max(0,Math.floor(amount)));
  return player[key]-before;
}
export function creditStat(stats, key, amount) {
  stats[key]=Math.min(STAT_LIMIT,(stats[key] || 0)+Math.max(0,amount));
}
