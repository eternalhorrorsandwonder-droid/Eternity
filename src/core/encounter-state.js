/**
 * A windup, charge or boss follow-up that leaves the active area cannot
 * resume later with only a fragment of its warning visible. Discard the
 * pending attack and send the creature home; an already fired bolt is a
 * separate projectile and is deliberately not removed here.
 */
export function cancelUnseenAttack(enemy) {
  if (!enemy || (!['windup', 'charging'].includes(enemy.state) && !(enemy.aftershock > 0))) return false;
  enemy.state = 'return';
  enemy.stateTime = 0;
  enemy.chargeRemaining = 0;
  enemy.aftershock = 0;
  enemy.volley = null;
  for (const warning of enemy.warnings || []) warning.visible = false;
  if (enemy.model?.userData?.ring) enemy.model.userData.ring.visible = false;
  return true;
}
