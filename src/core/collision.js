/** First hit parameter on a swept point segment against a circle, or null.
 * Used with the combined radii of the target and a projectile so fast bolts do
 * not tunnel through the player or scenery when a frame is long. */
export function segmentCircleHit(x1, z1, x2, z2, cx, cz, radius) {
  const dx=x2-x1, dz=z2-z1, fx=x1-cx, fz=z1-cz;
  const c=fx*fx+fz*fz-radius*radius;
  if (c<=0) return 0;
  const a=dx*dx+dz*dz;
  if (a===0) return null;
  const b=2*(fx*dx+fz*dz), discriminant=b*b-4*a*c;
  if (discriminant<0) return null;
  const t=(-b-Math.sqrt(discriminant))/(2*a);
  return t>=0 && t<=1 ? t : null;
}

/** Nearest collision along the segment; a solid wins an exact-distance tie. */
export function firstProjectileHit(from, to, radius, player, colliders) {
  let result=null, fraction=Infinity;
  for (const collider of colliders) {
    const t=segmentCircleHit(from.x,from.z,to.x,to.z,collider.x,collider.z,radius+collider.r);
    if (t!==null && t<fraction) { fraction=t; result={kind:'solid',fraction:t}; }
  }
  const t=segmentCircleHit(from.x,from.z,to.x,to.z,player.x,player.z,radius+.52);
  if (t!==null && t<fraction) result={kind:'player',fraction:t};
  return result;
}
