import { REGION_SIZE, regionCenter } from '../data/world.js';

/** Regions whose ground or edge details can intersect the square minimap. */
export function minimapRegions(regions, player, size = 160, scale = 3.4) {
  const view = size / (2 * scale) + 2; // include marker and road stroke overhang
  const radius = REGION_SIZE / 2;
  return regions.filter(region => {
    const center = regionCenter(region);
    return Math.abs(center.x - player.x) <= view + radius &&
      Math.abs(center.z - player.z) <= view + radius;
  });
}
