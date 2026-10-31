/** Shared encounter rules keep spawned creatures and imported health in sync. */
export const ENEMY_TYPES = Object.freeze(['wisp', 'thorn', 'sentinel', 'caster', 'surger', 'guardian', 'warden', 'tempest']);
export const isBossType = type => type === 'guardian' || type === 'warden' || type === 'tempest';
export function creatureMaxHealth(type, level) {
  const boss = isBossType(type);
  return (boss ? 180 : type === 'sentinel' ? 55 : type === 'caster' ? 42 : type === 'surger' ? 47 : type === 'thorn' ? 49 : 36) + Math.max(1, level) * (boss ? 12 : 5);
}
