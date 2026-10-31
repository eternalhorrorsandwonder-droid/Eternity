/** Multi-objective requests can be satisfied in any order, before or after acceptance. */
export const MERIDIAN_QUESTS = {
  'gate-of-questions': {
    id:'gate-of-questions', name:'A Gate Left Open', giver:'Kea',
    introduction:'The signal from Dawnreach brought you here. The old gate archive is still sealed, and the yard needs a purpose. Align the three signs and decide whether the yard should be a refuge or a watch. Both are needed; this one is yours to choose.',
    waiting:'The gate archive has three turning signs. The inscription tells their order. The restoration site beside the road needs ore and sunpetals.',
    completeText:'The gate has an answer now, but not a lock. Sera at Embercross will want to hear what the archive said.',
    hint:'Align the Harborward archive and restore the gatehouse yard.',
    kind:'milestones', objectives:[
      {kind:'archive',id:'southgate',label:'Align the Gate Register'},
      {kind:'project',id:'southgate',label:'Restore the Gatehouse Yard'},
    ], reward:{xp:180,coins:60,potions:1},
  },
  'orchard-after-fire': {
    id:'orchard-after-fire', name:'Planting Twice', giver:'Mara',
    introduction:'The old plans remember the fire but not the growers. Open the orchard record, give the commons a new purpose, and bring three sunpetals for the new seedlings.',
    waiting:'The orchard archive and commons are nearby. I need three sunpetals for the seedlings when you return.',
    completeText:'The new trees have room for a path between them. Thank you for remembering the people who will use it.',
    hint:'Align the orchard archive, restore its commons and bring 3 sunpetals.',
    kind:'milestones', objectives:[
      {kind:'archive',id:'copperwood',label:'Align the Orchard Record'},
      {kind:'project',id:'copperwood',label:'Restore the Orchard Commons'},
      {kind:'item',item:'bloom',amount:3,label:'Deliver 3 sunpetals'},
    ], reward:{xp:240,coins:90,potions:2},
  },
  'stone-and-measure': {
    id:'stone-and-measure',name:'Stone and Measure',giver:'Oren',
    introduction:'Measurements are useful only if they include the people making them. Read the quarry ledger, then bring four ore so I can mark an evacuation path.',
    waiting:'The ledger stands on the upper cut. Four pieces of ore will make the markers durable.',
    completeText:'The new markers point out of the quarry as clearly as they point in. That should have been true from the start.',
    hint:'Align the quarry archive and bring 4 ore.',
    kind:'milestones',objectives:[
      {kind:'archive',id:'slatefall',label:'Align the Quarry Ledger'},
      {kind:'item',item:'ore',amount:4,label:'Deliver 4 ore'},
    ],reward:{xp:240,coins:105},
  },
  'measure-of-a-promise': {
    id:'measure-of-a-promise',name:'The Measure of a Promise',giver:'Sera',
    introduction:'The archives disagree because different people were asked different questions. Align three of them and restore the observatory yard; I will compare what survives without erasing the contradictions.',
    waiting:'Three aligned archives in the Wilds, and a use for the yard here. The lenses keep their positions if you need to leave.',
    completeText:'It was meant to share the weather, not the authority to decide. The distinction is what the plans left out.',
    hint:'Align 3 Wilds archives and restore the observatory yard.',
    kind:'milestones',objectives:[
      {kind:'archives',amount:3,label:'Align 3 Meridian archives'},
      {kind:'project',id:'embercross',label:'Restore the Observatory Yard'},
    ],reward:{xp:300,coins:110,potions:2},
  },
  'water-for-all': {
    id:'water-for-all',name:'Water for All',giver:'Ben',
    introduction:'The old system counted rain but not neighbours. Read the terrace memory, align the account, and help restore three places where people can gather or keep watch.',
    waiting:'The memory and archive are here; any three Wilds restoration sites count.',
    completeText:'The table has enough chairs this time. We can disagree about the water without forgetting who needs it.',
    hint:'Read the terrace memory, align its archive and restore 3 Wilds sites.',
    kind:'milestones',objectives:[
      {kind:'lore',id:'sungold',label:'Read The Water Table'},
      {kind:'archive',id:'sungold',label:'Align the Terrace Account'},
      {kind:'projects',amount:3,label:'Restore 3 Wilds sites'},
    ],reward:{xp:300,coins:115,potions:2},
  },
  'above-the-clouds': {
    id:'above-the-clouds',name:'A Path Is a Verb',giver:'Ren',
    introduction:'The old wind readings may explain why the warning never arrived. Align the ridge log, discover six places in the Wilds, and settle three shardcasters along the way. Their bolts travel in straight lines; step aside when they aim.',
    waiting:'Six Wilds places, three shardcasters, and the ridge log. Do not rush a warning line.',
    completeText:'Now the path carries more than the old readings. It carries people who know how to warn one another.',
    hint:'Align the ridge archive, discover 6 Wilds regions and settle 3 shardcasters.',
    kind:'milestones',objectives:[
      {kind:'archive',id:'cloudstep',label:'Align the Ridge Log'},
      {kind:'chapter-regions',chapter:3,amount:6,label:'Discover 6 Wilds regions'},
      {kind:'casters',amount:3,label:'Settle 3 shardcasters'},
    ],reward:{xp:370,coins:150,potions:2},
  },
  'a-better-measure': {
    id:'a-better-measure',name:'A Better Measure',giver:'Ilya',
    introduction:'A dissenting page survived here, but it needs the other records around it. Align eight archives, including this one, and restore the hall as a place for shelter or watch.',
    waiting:'Eight aligned archives. The hall still needs your decision, too.',
    completeText:'We have not made one story out of ten. We have made room for ten stories to change the decision.',
    hint:'Align 8 Wilds archives, including Oldmeasure, and restore the hall.',
    kind:'milestones',objectives:[
      {kind:'archives',amount:8,label:'Align 8 Meridian archives'},
      {kind:'archive',id:'oldmeasure',label:'Align the Dissenting Diagram'},
      {kind:'project',id:'oldmeasure',label:'Restore the Hall of Arguments'},
    ],reward:{xp:450,coins:180,potions:2},
  },
  'the-order-we-change': {
    id:'the-order-we-change',name:'The Order We Change',giver:'Jun',
    introduction:'The Tempest Engine is still following an order built from incomplete testimony. Align six archives so we know what was omitted, then quiet the engine. It is dangerous even when it means well.',
    waiting:'Six archives and the engine at the heart. Watch the warning circle; a wounded engine follows a wide strike with three aimed bolts.',
    completeText:'A quiet engine is not a finished answer. Now everyone can be heard before the next order is given.',
    hint:'Align 6 Wilds archives and quiet the Tempest Engine.',
    kind:'milestones',objectives:[
      {kind:'archives',amount:6,label:'Align 6 Meridian archives'},
      {kind:'boss',id:'tempest',label:'Quiet the Tempest Engine'},
    ],reward:{xp:600,coins:240,potions:3},
  },
  'voices-in-the-water': {
    id:'voices-in-the-water',name:'Voices in the Water',giver:'Eda',
    introduction:'The families who crossed here remembered different losses. Align the fen testimony, recover five archive fragments, and settle four shardcasters so the witnesses can reach the landing safely.',
    waiting:'Five archives, the fen testimony among them, and four shardcasters settled.',
    completeText:'No one had to choose which memory was true. The landing is quiet enough for all of them.',
    hint:'Align 5 Wilds archives, including Stillwater, and settle 4 shardcasters.',
    kind:'milestones',objectives:[
      {kind:'archives',amount:5,label:'Align 5 Meridian archives'},
      {kind:'archive',id:'stillfen',label:'Align the Fen Testimony'},
      {kind:'casters',amount:4,label:'Settle 4 shardcasters'},
    ],reward:{xp:350,coins:140,potions:2},
  },
  'answer-across-water': {
    id:'answer-across-water',name:'An Answer Across Water',giver:'Bao',
    introduction:'A message reached the inlet from the other shore. Align its record, restore the courier landing, and see six places in the Wilds so you can carry the answer back with context.',
    waiting:'The inlet record and landing are near the water. Six different Wilds places will make a proper route.',
    completeText:'The answer has a route again. I will send it with a person, not leave it for a machine to interpret.',
    hint:'Align the inlet archive, restore its landing and discover 6 Wilds regions.',
    kind:'milestones',objectives:[
      {kind:'archive',id:'ashshore',label:'Align the Inlet Reply'},
      {kind:'project',id:'ashshore',label:'Restore the Courier Landing'},
      {kind:'chapter-regions',chapter:3,amount:6,label:'Discover 6 Wilds regions'},
    ],reward:{xp:340,coins:135,potions:2},
  },
};
