/** Requests may be accepted in any order; each objective names a persistent fact. */
export const SOUND_QUESTS = {
  'opening-the-sound': {
    id:'opening-the-sound',name:'The First Safe Crossing',giver:'Nia',
    introduction:'The Meridian stopped deciding for everyone, but its last surge reached our Sound. Watch the bright circle: it marks where the water will strike. Step out or dodge as it breaks. Repair this tide anchor with two ore and two echoes, then read the landing memory so the next crew understands why it matters.',
    waiting:'The landing anchor needs two ore and two echoes. Until it is repaired, a warning circle shows the exact danger area before each surge.',
    completeText:'The landing is steady. The anchors do not command the water; they give people time and a safer way through. Tala at Echo Harbor is gathering crews to connect the other crossings.',
    hint:'Repair the Tidegate anchor and read the landing memory.',kind:'milestones',objectives:[
      {kind:'anchor',id:'tidegate',label:'Repair the Landing Tide Anchor'},
      {kind:'lore',id:'tidegate',label:'Read the landing memory'},
    ],reward:{xp:240,coins:90,potions:2},
  },
  'net-and-needle': {
    id:'net-and-needle',name:'A Knot for Everyone',giver:'Teren',
    introduction:'We can mend a line while the quay is flooded, but not safely. Calm the quay and bring four pieces of ore for needles. I will teach the knot to the children who carry the ferries, not keep it a trade secret.',
    waiting:'The quay anchor needs three ore and two echoes. I also need four separate pieces of ore when you return.',
    completeText:'There is a needle for every bench and no single keeper of the knot. That is how a line survives its maker.',
    hint:'Repair the quay anchor and deliver 4 ore.',kind:'milestones',objectives:[
      {kind:'anchor',id:'netwright',label:'Repair the Quay Tide Anchor'},
      {kind:'item',item:'ore',amount:4,label:'Deliver 4 ore for needles'},
    ],reward:{xp:290,coins:120,potions:1},
  },
  'sheltered-ink': {
    id:'sheltered-ink',name:'A Book With Two Homes',giver:'Iri',
    introduction:'One copy on a high shelf is still one copy at risk. Calm the library crossing, read my note, and find Omi’s record in the marsh. The two accounts do not agree on who rang the first bell; I intend to preserve both.',
    waiting:'Repair our anchor and read the memory stones at Paperreef and Bellreed Marsh.',
    completeText:'Neither witness has to disappear for the other to be useful. I will send copies to both kitchens.',
    hint:'Repair the library anchor and read the Paperreef and Bellreed memories.',kind:'milestones',objectives:[
      {kind:'anchor',id:'paperreef',label:'Repair the Folio Tide Anchor'},
      {kind:'lore',id:'paperreef',label:'Read the Paperreef memory'},
      {kind:'lore',id:'bellmarsh',label:'Read the Bellreed memory'},
    ],reward:{xp:330,coins:130,potions:2},
  },
  'bells-before-tide': {
    id:'bells-before-tide',name:'Before the Last Bell',giver:'Omi',
    introduction:'A warning is finished only when the farthest boat can hear it. Calm the marsh anchor and visit Pax on the causeway. The tide-runners on that road lock their charge before they move; step sideways when you see their lane.',
    waiting:'Repair the Reedbell anchor, visit Lowtide Causeway, and settle two tide-runners. Their warning lane does not follow you.',
    completeText:'The farthest crew has a bell and a route home. I can wait for the last boat without sending someone into a false alarm.',
    hint:'Repair the marsh anchor, visit Lowtide and settle 2 tide-runners.',kind:'milestones',objectives:[
      {kind:'anchor',id:'bellmarsh',label:'Repair the Reedbell Tide Anchor'},
      {kind:'visit',id:'lowtide',label:'Visit Lowtide Causeway'},
      {kind:'surger',amount:2,label:'Settle 2 tide-runners'},
    ],reward:{xp:350,coins:140,potions:2},
  },
  'two-bowls': {
    id:'two-bowls',name:'Two Bowls at the Door',giver:'Mari',
    introduction:'There is always someone who reaches the kitchen after the meal. Calm the steps and bring four sunpetals for a nourishing broth. I will keep the extra bowl at the door.',
    waiting:'The kitchen anchor needs two ore and two echoes; the broth needs four sunpetals when you return.',
    completeText:'The steps are dry, the broth is warm, and the late arrival has a seat. That is enough of a celebration for me.',
    hint:'Repair the kitchen anchor and deliver 4 sunpetals.',kind:'milestones',objectives:[
      {kind:'anchor',id:'saltpan',label:'Repair the Kitchen Tide Anchor'},
      {kind:'item',item:'bloom',amount:4,label:'Deliver 4 sunpetals'},
    ],reward:{xp:290,coins:110,potions:3},
  },
  'map-the-ebb': {
    id:'map-the-ebb',name:'The Slowest Walker',giver:'Pax',
    introduction:'A route that works for a runner may leave a neighbor behind. Repair our causeway anchor and walk six different places in the Sound. I need the whole route, including places where someone can stop.',
    waiting:'Six Sound places and the causeway anchor. The map should leave room for a rest.',
    completeText:'I marked the pauses as carefully as the crossings. Someone carrying a child can use this map too.',
    hint:'Repair the causeway anchor and discover 6 Sound regions.',kind:'milestones',objectives:[
      {kind:'anchor',id:'lowtide',label:'Repair the Causeway Tide Anchor'},
      {kind:'chapter-regions',chapter:4,amount:6,label:'Discover 6 Sound regions'},
    ],reward:{xp:400,coins:155,potions:2},
  },
  'crew-of-echoes': {
    id:'crew-of-echoes',name:'Names on the Watch',giver:'Nilo',
    introduction:'The wreck ledger named the things we saved, not the people. Calm the lookout and settle three tide-runners so our rescue crews can take the road without being charged. Then I will put the names where they belong.',
    waiting:'The lookout anchor needs three ore and three echoes. Three tide-runners settled will make the rescue road safer.',
    completeText:'Passengers and rescuers share the same page now. No one here was cargo.',
    hint:'Repair the wreckwatch anchor and settle 3 tide-runners.',kind:'milestones',objectives:[
      {kind:'anchor',id:'wreckwatch',label:'Repair the Wreckwatch Tide Anchor'},
      {kind:'surger',amount:3,label:'Settle 3 tide-runners'},
    ],reward:{xp:380,coins:150,potions:2},
  },
  'harbor-of-voices': {
    id:'harbor-of-voices',name:'The Message Not Sent',giver:'Esme',
    introduction:'The new network should carry what people choose to share. Repair the cove anchor and read the cove and library memories. Iri will understand why one family asked us to leave a lantern dark.',
    waiting:'The cove anchor and the two memories: one here, one at Paperreef.',
    completeText:'A quiet place on a map is not an empty one. Thank you for leaving room for a choice.',
    hint:'Repair the cove anchor and read the Quiet Cove and Paperreef memories.',kind:'milestones',objectives:[
      {kind:'anchor',id:'quietcove',label:'Repair the Cove Tide Anchor'},
      {kind:'lore',id:'quietcove',label:'Read the Quiet Cove memory'},
      {kind:'lore',id:'paperreef',label:'Read the Paperreef memory'},
    ],reward:{xp:320,coins:130,potions:2},
  },
  'keep-the-lights': {
    id:'keep-the-lights',name:'No Single Color',giver:'Leen',
    introduction:'Each household chose a lantern color so its people could find their own way home. Repair this anchor and three others anywhere in the Sound; I will hang a light for each safe crossing.',
    waiting:'Four Sound anchors in all, including the one here. Their material costs are written on each gauge.',
    completeText:'The lights are different colors, and the road is easier to read for it. Order was never the same thing as welcome.',
    hint:'Repair the lantern anchor and 4 anchors in total.',kind:'milestones',objectives:[
      {kind:'anchor',id:'seaglass',label:'Repair the Lantern Tide Anchor'},
      {kind:'anchors',amount:4,label:'Repair 4 Sound tide anchors'},
    ],reward:{xp:390,coins:155,potions:2},
  },
  'when-water-answers': {
    id:'when-water-answers',name:'When the Water Answers',giver:'Tala',
    introduction:'Nia can explain the anchors; my job is to make sure someone is there to answer. Help her first, restore this landing and six anchors across the Sound, and settle five tide-runners. Then we can open the warning network with crews, not orders, at both ends.',
    waiting:'Help Nia at Tidegate, repair this and six total anchors, and settle five tide-runners. The other crews can work in any order.',
    completeText:'The first warning has an answer from a person, and a choice beside it in the ledger. The harbor is open. We will keep listening, even when the water is quiet.',
    hint:'Help Nia, repair 6 anchors including the harbor, and settle 5 tide-runners.',kind:'milestones',objectives:[
      {kind:'quest',id:'opening-the-sound',label:'Complete Nia’s first crossing'},
      {kind:'anchor',id:'echoharbor',label:'Repair the Harbor Tide Anchor'},
      {kind:'anchors',amount:6,label:'Repair 6 Sound tide anchors'},
      {kind:'surger',amount:5,label:'Settle 5 tide-runners'},
    ],reward:{xp:600,coins:240,potions:3},
  },
};
