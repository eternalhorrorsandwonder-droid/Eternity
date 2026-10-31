/**
 * Wayfinder field routes are optional, hand-authored journeys through existing
 * places. Every objective names a real, persistent world action. They never
 * expire, may be completed before selection, and do not require a particular
 * irreversible shelter/watch choice.
 */
export const TRAILS = [
  {
    id:'first-footsteps', chapter:1, name:'A Road Worth Sharing',
    subtitle:'The first paths out of Haven',
    introduction:'Mira says a road becomes safer when the people at either end know one another. Walk her first route and notice what the fields and grove already share.',
    conclusion:'A light in the fields, a story in the grove, and the path between them: a useful beginning belongs to more than one person.',
    objectives:[
      {kind:'visit',id:'fields',label:'Reach Sunpetal Fields'},
      {kind:'visit',id:'grove',label:'Reach Mosswhisper Grove'},
      {kind:'waystone',id:'fields',label:'Restore the Sunpetal waystone'},
      {kind:'memory',id:'grove',label:'Read the Mosswhisper memory'},
    ],reward:{xp:100,coins:35,potions:1},
  },
  {
    id:'water-and-memory', chapter:1, name:'What the Water Carries',
    subtitle:'Three accounts of the river',
    introduction:'Neri leaves echoes by the river, while Iona and Cael keep stories in different ways. Collect their three memories without asking them to agree.',
    conclusion:'A river carries silt and names together. These stories do not need to match to be worth keeping.',
    objectives:[
      {kind:'memory',id:'amber',label:'Read the Amber Run memory'},
      {kind:'memory',id:'glassmere',label:'Read the Glassmere memory'},
      {kind:'memory',id:'starfall',label:'Read the Starfall memory'},
      {kind:'quest',id:'memories',label:'Help Iona share her stories'},
    ],reward:{xp:170,coins:65,potions:1},
  },
  {
    id:'roots-and-stone', chapter:1, name:'Things Made to Last',
    subtitle:'The forest, the hill and the smith',
    introduction:'A blade, a stone and a tree are all promises of care. Follow the work from Bram’s forge to Orla’s hill and Ves’s forest.',
    conclusion:'The forge made an edge, the hill offered stone, and the forest offered time. None of them could have done the work alone.',
    objectives:[
      {kind:'quest',id:'smith',label:'Help Bram make a better edge'},
      {kind:'memory',id:'redstone',label:'Read the Redstone memory'},
      {kind:'waystone',id:'redstone',label:'Restore the Redstone waystone'},
      {kind:'waystone',id:'gloamwood',label:'Restore the Gloamwood waystone'},
    ],reward:{xp:180,coins:80},
  },
  {
    id:'crown-and-road', chapter:1, name:'The Quiet Crown',
    subtitle:'A difficult road, a gentler end',
    introduction:'Orin remembers why the guardian was made. Bring light along the high road and quiet it without treating its duty as a mistake.',
    conclusion:'The Crown is quiet, but its purpose is remembered. The road back is lit for the next person.',
    objectives:[
      {kind:'visit',id:'bluffs',label:'Discover Windward Bluffs'},
      {kind:'waystone',id:'starfall',label:'Restore the Starfall waystone'},
      {kind:'memory',id:'crown',label:'Read the Crown memory'},
      {kind:'boss',id:'guardian',label:'Quiet the Crown Guardian'},
    ],reward:{xp:300,coins:120,potions:2},
  },
  {
    id:'first-signal', chapter:2, name:'Signals in the Mist',
    subtitle:'The people at both ends',
    introduction:'Tavi’s beacon means little if nobody receives it. Repair the two crossings and recover the parcel left on the mire road.',
    conclusion:'The signal has two ends now. A courier has left supplies for anyone who takes the road after you.',
    objectives:[
      {kind:'beacon',id:'lanternbridge',label:'Repair the Lanternbridge beacon'},
      {kind:'beacon',id:'brackwater',label:'Repair the Brackwater beacon'},
      {kind:'cache',id:'moorlight',label:'Open the Moorlight courier cache'},
      {kind:'memory',id:'lanternbridge',label:'Read the crossing memory'},
    ],reward:{xp:230,coins:85,potions:1},
  },
  {
    id:'marsh-medicine', chapter:2, name:'A Clinic Without Walls',
    subtitle:'Supplies across the marsh',
    introduction:'Isla’s clinic serves the crossing, but its supplies come from a much longer route. Help her, find the couriers’ stores and light the way through the mire.',
    conclusion:'A clinic can be a room, a parcel, or a person who knows where the next safe stop is.',
    objectives:[
      {kind:'quest',id:'saltmarsh-salve',label:'Bring sunpetals to Isla'},
      {kind:'cache',id:'saffron',label:'Open the Saltmarsh courier cache'},
      {kind:'cache',id:'moorlight',label:'Open the Moorlight courier cache'},
      {kind:'waystone',id:'moorlight',label:'Restore the Moorlight waystone'},
    ],reward:{xp:250,coins:90,potions:2},
  },
  {
    id:'salt-and-stories', chapter:2, name:'The Long Tide',
    subtitle:'Coast, dunes and the old court',
    introduction:'The coast keeps moving; its signs must move with it. Read the stories at the strand and court, and repair the dune beacon for travellers in between.',
    conclusion:'The water will redraw the shore again. The stories and a working signal can travel with it.',
    objectives:[
      {kind:'visit',id:'saltwind',label:'Discover Saltwind Strand'},
      {kind:'memory',id:'saltwind',label:'Read the strand memory'},
      {kind:'beacon',id:'shellwake',label:'Repair the Shellwake beacon'},
      {kind:'memory',id:'floodedcourt',label:'Read the Flooded Court memory'},
    ],reward:{xp:260,coins:110,potions:1},
  },
  {
    id:'harborward-signal', chapter:2, name:'The Last Signal Home',
    subtitle:'From the reeds to Dawnreach',
    introduction:'The Warden’s signal was supposed to protect the harbor, not close the road. Follow it from the reeds to the spire and on to Dawnreach.',
    conclusion:'A warning is useful only when people can answer it. Dawnreach can listen without surrendering the road.',
    objectives:[
      {kind:'memory',id:'hollowreed',label:'Read the Hollowreed memory'},
      {kind:'beacon',id:'stormglass',label:'Repair the Stormglass beacon'},
      {kind:'boss',id:'warden',label:'Quiet the Storm Warden'},
      {kind:'visit',id:'dawnreach',label:'Reach Dawnreach Harbor'},
    ],reward:{xp:380,coins:150,potions:2},
  },
  {
    id:'open-gate', chapter:3, name:'An Open Question',
    subtitle:'The gate and the observatory',
    introduction:'Kea keeps the gate open. Sera studies the instruments beyond it. Compare their records, then give the gatehouse yard a purpose of its own.',
    conclusion:'The gate was a question, not an instruction. The observatory can now study it with the door open.',
    objectives:[
      {kind:'archive',id:'southgate',label:'Align the Gate Register'},
      {kind:'project',id:'southgate',label:'Restore the Gatehouse Yard'},
      {kind:'archive',id:'embercross',label:'Align the Observatory archive'},
      {kind:'quest',id:'gate-of-questions',label:'Report back to Kea'},
    ],reward:{xp:320,coins:125,potions:1},
  },
  {
    id:'orchard-and-water', chapter:3, name:'After the Fire, After the Rain',
    subtitle:'Planting for one another',
    introduction:'Mara replants after fire; Ben shares what rain the terraces can hold. Recover their records and restore both places for the people using them.',
    conclusion:'The orchard paths leave room to escape, and the water table leaves room for a neighbour. Both are plans worth keeping.',
    objectives:[
      {kind:'archive',id:'copperwood',label:'Align the Orchard Record'},
      {kind:'project',id:'copperwood',label:'Restore the Orchard Commons'},
      {kind:'archive',id:'sungold',label:'Align the Terrace Account'},
      {kind:'project',id:'sungold',label:'Restore the Rainward Terrace'},
    ],reward:{xp:360,coins:140,potions:2},
  },
  {
    id:'measure-the-path', chapter:3, name:'A Measure for Walking',
    subtitle:'Quarry marks and ridge paths',
    introduction:'Oren measures the quarry; Ren measures a path by the people who can walk it. Compare their records and leave both a safer place to stop.',
    conclusion:'The quarry marks point out as well as in, and the ridge has a place to pause. A measure can be an act of care.',
    objectives:[
      {kind:'archive',id:'slatefall',label:'Align the Quarry Ledger'},
      {kind:'project',id:'slatefall',label:'Restore the Surveyors’ Station'},
      {kind:'archive',id:'cloudstep',label:'Align the Ridge Log'},
      {kind:'project',id:'cloudstep',label:'Restore the Cloudstep Landing'},
    ],reward:{xp:400,coins:160,potions:1},
  },
  {
    id:'many-voices', chapter:3, name:'Room for Many Voices',
    subtitle:'The answer at the heart',
    introduction:'The fen, the inlet and the dissenting hall each kept a different part of the answer. Carry them to the Meridian Heart before declaring the story complete.',
    conclusion:'The engine is quiet, but the answer is not a single voice. The next decision can include the people who were left out.',
    objectives:[
      {kind:'archive',id:'stillfen',label:'Align the Fen Testimony'},
      {kind:'archive',id:'ashshore',label:'Align the Inlet Reply'},
      {kind:'archive',id:'oldmeasure',label:'Align the Dissenting Diagram'},
      {kind:'boss',id:'tempest',label:'Quiet the Tempest Engine'},
    ],reward:{xp:550,coins:220,potions:3},
  },
  {
    id:'a-safer-landing',chapter:4,name:'A Safer Landing',subtitle:'A warning and a welcome',
    introduction:'Nia keeps the landing open while Teren mends the lines. Learn why the warning exists, then make both sides of the crossing safer for the crews.',
    conclusion:'The first crossing is calm, the quay has a steady line, and the people using them understand why both were mended.',
    objectives:[
      {kind:'memory',id:'tidegate',label:'Read the landing memory'},
      {kind:'anchor',id:'tidegate',label:'Repair the Landing Tide Anchor'},
      {kind:'quest',id:'opening-the-sound',label:'Help Nia open the first crossing'},
      {kind:'anchor',id:'netwright',label:'Repair the Quay Tide Anchor'},
    ],reward:{xp:340,coins:130,potions:2},
  },
  {
    id:'stories-with-room',chapter:4,name:'Stories With Room',subtitle:'A copy, a bell and a silence',
    introduction:'Iri keeps more than one account, Omi listens for the last boat, and Esme respects a family’s silence. Carry the three memories without making them into one.',
    conclusion:'A reliable record includes disagreement and the right to privacy. There is room for all three in the Sound.',
    objectives:[
      {kind:'memory',id:'paperreef',label:'Read the Paperreef memory'},
      {kind:'memory',id:'bellmarsh',label:'Read the Bellreed memory'},
      {kind:'memory',id:'quietcove',label:'Read the Quiet Cove memory'},
      {kind:'quest',id:'sheltered-ink',label:'Help Iri protect the library copies'},
    ],reward:{xp:380,coins:145,potions:1},
  },
  {
    id:'lights-for-the-last-boat',chapter:4,name:'Lights for the Last Boat',subtitle:'A route with a place to pause',
    introduction:'Pax maps for the slowest walker. Omi counts the last boat, while Nilo and Leen keep the watch and lanterns ready.',
    conclusion:'The last boat has a bell, a watch and a light of its own. The map has a place to stop.',
    objectives:[
      {kind:'visit',id:'lowtide',label:'Visit Lowtide Causeway'},
      {kind:'anchor',id:'wreckwatch',label:'Repair the Wreckwatch Tide Anchor'},
      {kind:'anchor',id:'seaglass',label:'Repair the Lantern Tide Anchor'},
      {kind:'quest',id:'bells-before-tide',label:'Help Omi warn the last boat'},
    ],reward:{xp:420,coins:170,potions:2},
  },
  {
    id:'a-person-at-both-ends',chapter:4,name:'A Person at Both Ends',subtitle:'An open harbor',
    introduction:'A working signal needs a person to answer it. Help Tala reopen the harbor, then follow the route back to Mari’s kitchen and Esme’s cove.',
    conclusion:'The harbor is open, the kitchen steps are dry, and a quiet cove remains available to anyone who needs it.',
    objectives:[
      {kind:'anchor',id:'echoharbor',label:'Repair the Harbor Tide Anchor'},
      {kind:'anchor',id:'saltpan',label:'Repair the Kitchen Tide Anchor'},
      {kind:'anchor',id:'quietcove',label:'Repair the Cove Tide Anchor'},
      {kind:'quest',id:'when-water-answers',label:'Help Tala reopen the harbor'},
    ],reward:{xp:560,coins:220,potions:3},
  },
];
export const TRAIL_BY_ID = Object.freeze(Object.fromEntries(TRAILS.map(trail=>[trail.id,trail])));
