/** Movement and Escape are reserved; actions can be rebound without collisions. */
export const BINDING_ACTIONS=Object.freeze([
  ['attack','Strike'],['dodge','Dodge'],['interact','Interact'],['potion','Remedy'],
  ['pulse','Light Pulse'],['ward','Ward'],['kit','Field kit'],
  ['map','Atlas'],['journal','Journal'],['character','Character'],
]);
export const DEFAULT_BINDINGS=Object.freeze({
  attack:'KeyJ',dodge:'Space',interact:'KeyE',potion:'KeyQ',pulse:'KeyK',ward:'KeyL',kit:'KeyR',
  map:'KeyM',journal:'Tab',character:'KeyC',
});
const RESERVED=new Set(['KeyW','KeyA','KeyS','KeyD']);
export const allowedBinding=code=>typeof code==='string' &&
  (/^Key[A-Z]$/.test(code) || /^Digit[0-9]$/.test(code) || code==='Space' || code==='Tab') && !RESERVED.has(code);
export function normalizeBindings(raw) {
  const values={};
  for (const [id] of BINDING_ACTIONS) values[id]=allowedBinding(raw?.[id]) ? raw[id] : DEFAULT_BINDINGS[id];
  return new Set(Object.values(values)).size===BINDING_ACTIONS.length ? values : {...DEFAULT_BINDINGS};
}
export function setBinding(bindings,action,code) {
  if (!Object.hasOwn(DEFAULT_BINDINGS,action) || !allowedBinding(code))
    return {ok:false,reason:'reserved'};
  const conflict=BINDING_ACTIONS.find(([id])=>id!==action && bindings[id]===code);
  if (conflict) return {ok:false,reason:'conflict',other:conflict[1]};
  return {ok:true,bindings:{...bindings,[action]:code}};
}
export function keyLabel(code) {
  if (code?.startsWith('Key')) return code.slice(3);
  if (code?.startsWith('Digit')) return code.slice(5);
  return code==='Space' ? 'SPACE' : code==='Tab' ? 'TAB' : code || '?';
}
