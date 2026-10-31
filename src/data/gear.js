/** Equippable charms: deliberate trade-offs and capped, authored recipes. */
export const CHARMS = [
  {
    id:'oak-heart', name:'Oakheart Brooch', icon:'heart', unlock:0,
    description:'An old piece of living wood, worn by those who carry supplies for others.',
    effect:'+24 maximum vitality; movement speed −3%.',
    cost:{ore:3,bloom:2}, stats:{health:24,speed:-.03},
  },
  {
    id:'keen-edge', name:'Keen Edge', icon:'sword', unlock:0,
    description:'A sharpened sliver that rewards an assertive, careful fighter.',
    effect:'+5 strike power; maximum vitality −10.',
    cost:{ore:4,echoes:2}, stats:{attack:5,health:-10},
  },
  {
    id:'swift-thread', name:'Swift Thread', icon:'dash', unlock:1,
    description:'A courier’s braided thread, light enough to forget until you need it.',
    effect:'Movement speed +8%; dodge recovery −0.2 seconds.',
    cost:{bloom:4,echoes:2}, stats:{speed:.08,dash:-.2},
  },
  {
    id:'garden-vial', name:'Garden Vial', icon:'potion', unlock:2,
    description:'A small vessel of concentrated sunpetal extract.',
    effect:'Remedies restore 20 more vitality; maximum vitality −8.',
    cost:{bloom:6,ore:2}, stats:{heal:20,health:-8},
  },
  {
    id:'stone-scale', name:'Stone Scale', icon:'shield', unlock:3,
    description:'A polished quarry scale that turns the edge of an incoming blow.',
    effect:'Incoming damage −10%; movement speed −4%.',
    cost:{ore:6,echoes:3}, stats:{damageFactor:.9,speed:-.04},
  },
  {
    id:'resonant-glass', name:'Resonant Glass', icon:'pulse', unlock:4,
    description:'A listening lens tuned to the Wayfinder’s pulse.',
    effect:'Light Pulse damage +20%; Pulse recovery −0.5 seconds.',
    cost:{ore:5,echoes:4}, stats:{pulse:.2,pulseCooldown:-.5},
  },
  {
    id:'wayfarer-knot', name:'Wayfarer Knot', icon:'compass', unlock:6,
    description:'A compact braid worn by the first people to link the Wilds.',
    effect:'+12 vitality, +2 strike power and movement speed +3%.',
    cost:{ore:5,bloom:5,echoes:3}, stats:{health:12,attack:2,speed:.03},
  },
  {
    id:'storm-anchor', name:'Storm Anchor', icon:'gem', unlock:8,
    description:'A fragment that steadies both the hand and the ground under it.',
    effect:'Incoming damage −8%; +3 strike power; dodge recovery +0.3 seconds.',
    cost:{ore:7,echoes:5}, stats:{damageFactor:.92,attack:3,dash:.3},
  },
];
export const CHARM_BY_ID=Object.freeze(Object.fromEntries(CHARMS.map(charm=>[charm.id,charm])));
