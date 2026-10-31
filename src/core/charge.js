import { segmentCircleHit } from './collision.js';

export const RUNNER_RADIUS = .4;
export const PLAYER_RADIUS = .32;
export const CHARGE_DISTANCE = 7;
export const CHARGE_SPEED = 8;
export const CHARGE_WINDUP = 1.25;
export const CHARGE_HIT_RADIUS = RUNNER_RADIUS + PLAYER_RADIUS;

/** Sweep the moving runner's circular body; the nearest solid wins ties. */
export function firstChargeHit(from,to,player,colliders) {
  let result=null, fraction=Infinity;
  for (const collider of colliders) {
    const t=segmentCircleHit(from.x,from.z,to.x,to.z,collider.x,collider.z,RUNNER_RADIUS+collider.r);
    if (t!==null && t<fraction) {fraction=t;result={kind:'solid',fraction:t};}
  }
  if (player) {
    const t=segmentCircleHit(from.x,from.z,to.x,to.z,player.x,player.z,CHARGE_HIT_RADIUS);
    if (t!==null && t<fraction) result={kind:'player',fraction:t};
  }
  return result;
}
