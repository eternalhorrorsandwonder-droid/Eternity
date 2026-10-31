/** Three deliberately different tactical preparations; only one is readied. */
export const KIT_CAP=5;
export const KIT_ITEMS = [
  {
    id:'flash',name:'Dawnflash Powder',short:'FLASH',icon:'sun',unlock:0,
    description:'A small packet that scatters a bright, harmless flash around you.',
    effect:'Interrupts and stuns nearby non-boss creatures for 1.2 seconds. Bosses and already-fired bolts are unaffected.',
    cost:{ore:2,echoes:2},cooldown:12,
  },
  {
    id:'tonic',name:'Trail Tonic',short:'TONIC',icon:'leaf',unlock:2,
    description:'A light preparation favoured by couriers on long roads.',
    effect:'Move 15% faster for 10 seconds. Cannot be stacked or used while already active.',
    cost:{bloom:3,echoes:1},cooldown:16,
  },
  {
    id:'draught',name:'Moss Draught',short:'DRAUGHT',icon:'potion',unlock:4,
    description:'A slow, soothing draught that works best when you make room to breathe.',
    effect:'Restores up to 36 vitality over 6 seconds. Taking damage ends the effect.',
    cost:{bloom:4,ore:2},cooldown:18,
  },
];
export const KIT_BY_ID=Object.freeze(Object.fromEntries(KIT_ITEMS.map(item=>[item.id,item])));
