import { VALE_REGIONS, REGION_BY_ID } from "./world.js";
import { MERIDIAN_QUESTS } from "./meridian-quests.js";
import { SOUND_QUESTS } from "./sound-quests.js";
import { TRAILS } from "./trails.js";
const VALE_IDS = new Set(VALE_REGIONS.map((region) => region.id));

export const QUESTS = {
  "first-light": {
    id: "first-light",
    name: "A Light to Follow",
    giver: "Mira",
    introduction:
      "The Hush has scattered our light, but it hasn’t put it out. Gather three echoes from the little creatures on the road, then use them to wake the waystone in Sunpetal Fields. I’ll be right here when you return.",
    waiting:
      "The Sunpetal waystone is just east of here. Three echoes should be enough to wake it. Take your time; the light isn’t going anywhere.",
    completeText:
      "You did it. Look at that light! My grandmother used to say every beginning is a small act of courage. Here, let me teach you something she taught me.",
    hint: "Gather 3 echoes, then wake the waystone east in Sunpetal Fields.",
    kind: "first",
    reward: { xp: 85, coins: 35, skill: "pulse" },
  },
  flowers: {
    id: "flowers",
    name: "A Pocketful of Sunshine",
    giver: "Rowan",
    introduction:
      "My remedies are running low. Could you bring me three sunpetals? I’ll turn a few into something useful for the road.",
    waiting:
      "Look for the little golden flowers. They grow back, given a little time and kindness.",
    completeText:
      "Perfect. These will help more people than you know. Take a couple of remedies for yourself, too.",
    hint: "Bring Rowan 3 sunpetals.",
    kind: "item",
    item: "bloom",
    amount: 3,
    reward: { xp: 55, coins: 20, potions: 2 },
  },
  scout: {
    id: "scout",
    name: "Room to Breathe",
    giver: "Fen",
    introduction:
      "The little Hush creatures aren’t wicked, only frightened. Could you settle five of them? The paths will be safer for everyone.",
    waiting:
      "Five settled creatures should give the grove some breathing room.",
    completeText:
      "The forest sounds different already. I’ll tell the others the path is safe. Thank you, friend.",
    hint: "Settle 5 Hush creatures anywhere in the Vale.",
    kind: "kills",
    amount: 5,
    reward: { xp: 80, coins: 30 },
  },
  river: {
    id: "river",
    name: "The River’s Due",
    giver: "Neri",
    introduction:
      "I leave an echo by the water for each person who can’t make it home. If you can spare four, I’ll see they’re remembered.",
    waiting:
      "Four echoes, when you can spare them. There’s no rush on remembering.",
    completeText:
      "Listen. The river sounds brighter already. I’ll carry their names a little farther today.",
    hint: "Bring Neri 4 echoes.",
    kind: "item",
    item: "echoes",
    amount: 4,
    reward: { xp: 90, coins: 45, potions: 1 },
  },
  smith: {
    id: "smith",
    name: "A Good Edge",
    giver: "Bram",
    introduction:
      "A blade is a promise to make it home. Bring me three pieces of ore and I’ll make that promise a little sturdier.",
    waiting:
      "There’s good ore tucked among the stones. Three pieces should do nicely.",
    completeText:
      "There. Balanced, sharp, and made to last. Mind you look after it, and yourself.",
    hint: "Bring Bram 3 pieces of ore.",
    kind: "item",
    item: "ore",
    amount: 3,
    reward: { xp: 60, coins: 25, weapon: 1 },
  },
  memories: {
    id: "memories",
    name: "Things We Keep",
    giver: "Iona",
    introduction:
      "People leave stories at the little stone markers. Would you read three of them for me? A memory is safer when it’s shared.",
    waiting:
      "Three stories, from anywhere. Read them slowly. They belong to someone.",
    completeText:
      "Thank you for holding them with me. I think that’s how we keep the past from becoming a lonely place.",
    hint: "Read 3 memory stones.",
    kind: "lore",
    amount: 3,
    reward: { xp: 110, coins: 40 },
  },
  stone: {
    id: "stone",
    name: "The Patient Earth",
    giver: "Orla",
    introduction:
      "I’m mending the old bridge fittings. Four bits of ore would save me a long walk back down the hill.",
    waiting: "Four pieces of ore should be enough to put the bridge right.",
    completeText:
      "Good stone, good hands. The bridge will outlast us both if we do this properly.",
    hint: "Bring Orla 4 pieces of ore.",
    kind: "item",
    item: "ore",
    amount: 4,
    reward: { xp: 110, coins: 65 },
  },
  map: {
    id: "map",
    name: "The Long Way Around",
    giver: "Sol",
    introduction:
      "A map is really a collection of footsteps. Visit five places along any of the roads, and come back to tell me what I’ve missed.",
    waiting:
      "Five different places. Take the long way if it looks interesting.",
    completeText:
      "Aha! I knew there was a path there. Your footsteps have made my map a little more honest.",
    hint: "Discover 5 regions.",
    kind: "regions",
    amount: 5,
    reward: { xp: 120, coins: 55 },
  },
  roots: {
    id: "roots",
    name: "A Brighter Canopy",
    giver: "Ves",
    introduction:
      "The old roots drink the light from our waystones. Restore three stones and this forest will have enough to heal.",
    waiting: "Three restored waystones will give the roots room to grow again.",
    completeText:
      "Can you feel it? Even the ground seems to be breathing easier. The trees thank you in their own time.",
    hint: "Restore 3 waystones beyond the Haven.",
    kind: "shrines",
    amount: 3,
    reward: { xp: 150, coins: 65, potions: 2 },
  },
  stars: {
    id: "stars",
    name: "A Sky Full of Stories",
    giver: "Cael",
    introduction:
      "There are stories written across the Vale, not just in the sky. Find six memory stones and tell me what they say.",
    waiting: "Six stories. Perhaps together they make a constellation.",
    completeText:
      "I think I see the shape of it now. Not a constellation of stars, but of people who cared.",
    hint: "Read 6 memory stones.",
    kind: "lore",
    amount: 6,
    reward: { xp: 160, coins: 75 },
  },
  crown: {
    id: "crown",
    name: "The Last Light",
    giver: "Orin",
    introduction:
      "The guardian at the Crown was made to protect the light. The Hush has turned its duty into a wound. Can you quiet it without forgetting what it was?",
    waiting:
      "The guardian is beyond the broken stones. Watch the ground, make room for its blows, and strike when it rests.",
    completeText:
      "The Crown is quiet. Not empty—quiet. There’s a difference, and you’ve given it back to us.",
    hint: "Quiet the Crown Guardian.",
    kind: "boss",
    reward: { xp: 300, coins: 150, potions: 3 },
  },
  "first-beacon": {
    id: "first-beacon", name: "A Signal in the Mist", giver: "Tavi",
    introduction: "The old beacons still speak to one another, but most have gone dark. Repair one with two echoes and two pieces of ore, and I will show you how its light can protect you, too.",
    waiting: "Find a signal beacon in the Reaches. Two echoes and two ore will bring it back online.",
    completeText: "There it is! Each repaired signal calms nearby creatures. Hold this light close and it can soften a blow when you need it most.",
    hint: "Repair a Reaches signal beacon with 2 echoes and 2 ore.", kind: "beacons", amount: 1, reward: { xp: 140, coins: 35, skill: "ward" },
  },
  "lost-parcels": {
    id: "lost-parcels", name: "Leave Something Behind", giver: "Yara",
    introduction: "Couriers left supply chests for travellers who followed them. Find three and put their contents to good use; that is what they were meant for.",
    waiting: "Three old supply chests are scattered across the Reaches. They only need opening once.",
    completeText: "Those parcels kept someone going once. I am glad they are doing it again.",
    hint: "Open 3 Reaches supply caches.", kind: "caches", amount: 3, reward: { xp: 150, coins: 45, potions: 1 },
  },
  "many-lights": {
    id: "many-lights", name: "A Chain of Light", giver: "Mila",
    introduction: "The crossings feel closer when the waystones are awake. Restore eight beyond Haven and even the longest return will be gentler.",
    waiting: "Eight restored waystones beyond Haven. Each one is a place to rest and a road back.",
    completeText: "I can see a light in every direction now. The river feels less like a boundary and more like a meeting place.",
    hint: "Restore 8 waystones beyond Haven.", kind: "shrines", amount: 8, reward: { xp: 200, coins: 80, potions: 2 },
  },
  "saltmarsh-salve": {
    id: "saltmarsh-salve", name: "A Salve for the Road", giver: "Isla",
    introduction: "My clinic is short of sunpetals. Bring five and I can make enough medicine for the whole crossing, with some left for you.",
    waiting: "Five sunpetals, please. They grow back if you give the roots a little time.",
    completeText: "These will make a fine salve. Your kindness will travel farther than either of us.",
    hint: "Bring Isla 5 sunpetals.", kind: "item", item: "bloom", amount: 5, reward: { xp: 160, coins: 55, potions: 3 },
  },
  "five-new-roads": {
    id: "five-new-roads", name: "Beyond the Crossing", giver: "Pip",
    introduction: "Maps should leave room for a surprise. Find five different places in the Reaches and tell me which path deserves a new sign.",
    waiting: "Five places south of the bluffs. Walk wherever the road looks interesting.",
    completeText: "I will add those paths and draw the signposts a little brighter. Thanks for helping the next wanderer.",
    hint: "Discover 5 regions in the Reaches.", kind: "chapter-regions", chapter: 2, amount: 5, reward: { xp: 200, coins: 70 },
  },
  "quiet-sentinels": {
    id: "quiet-sentinels", name: "Let the Reeds Sing", giver: "Kesh",
    introduction: "The sentinels ring when they sense movement. They are not malicious, but their alarms frighten the wildlife. Could you settle four? Watch for the wide circle before they discharge.",
    waiting: "Four sentinels. Step outside the warning circle before striking back.",
    completeText: "I can hear the reeds again. Even the little birds have come back to the path.",
    hint: "Settle 4 signal sentinels.", kind: "sentinels", amount: 4, reward: { xp: 220, coins: 90 },
  },
  "reaches-stories": {
    id: "reaches-stories", name: "The Water Keeps a Record", giver: "Rena",
    introduction: "The garden archives washed away, but the memory stones survived. Read four in the Reaches so the stories have another home.",
    waiting: "Four memories from these southern roads, whenever you find them.",
    completeText: "Thank you. A story carried by someone is much harder to wash away.",
    hint: "Read 4 Reaches memory stones.", kind: "chapter-lore", chapter: 2, amount: 4, reward: { xp: 190, coins: 75 },
  },
  "five-beacons": {
    id: "five-beacons", name: "The Courier's Promise", giver: "Daro",
    introduction: "A working beacon makes the creatures nearby less watchful and their blows weaker. Repair five, and I can send couriers along the whole middle road again.",
    waiting: "Five signal beacons. Each repair needs two echoes and two ore.",
    completeText: "The couriers can travel in daylight or fog now. I will leave a parcel for the next person who needs one.",
    hint: "Repair 5 signal beacons in the Reaches.", kind: "beacons", amount: 5, reward: { xp: 240, coins: 110, potions: 2 },
  },
  "whole-reaches": {
    id: "whole-reaches", name: "A Harbour for Everyone", giver: "Aven",
    introduction: "A harbour is a promise between all the roads that lead to it. Visit each of the ten places in the Reaches, then help me finish the map.",
    waiting: "Ten places south of the bluffs. There is no need to hurry past the good parts.",
    completeText: "Every path has a name again. Now anyone looking at this map can find a way home.",
    hint: "Discover all 10 Reaches regions.", kind: "chapter-regions", chapter: 2, amount: 10, reward: { xp: 300, coins: 130, potions: 2 },
  },
  "last-signal": {
    id: "last-signal", name: "Answer the Storm", giver: "Lyra",
    introduction: "The Storm Warden is still guarding the last signal, long after the storm has passed. Quiet it and we can finally answer the people who sent it.",
    waiting: "Watch its warning circles. When its light weakens, its wide shockwave returns a second time.",
    completeText: "We can hear it now: 'We are here. We see your light.' All this time, someone had answered us.",
    hint: "Quiet the Storm Warden at the Spire.", kind: "boss", flag: "warden", reward: { xp: 420, coins: 180, potions: 3 },
  },

  ...MERIDIAN_QUESTS,
  ...SOUND_QUESTS,
};

export const ACHIEVEMENTS = [
  {
    id: "first-step",
    name: "A Beginning",
    description: "Settle your first Hush creature.",
    test: (s) => s.stats.defeated >= 1,
  },
  {
    id: "lamp-lighter",
    name: "Lamp Lighter",
    description: "Restore a waystone beyond the Haven.",
    test: (s) => s.world.activated.length >= 2,
  },
  {
    id: "good-neighbor",
    name: "A Good Neighbor",
    description: "Complete your first request.",
    test: (s) => Object.values(s.world.quests).includes("complete"),
  },
  {
    id: "wanderer",
    name: "The Long Way",
    description: "Discover five regions.",
    test: (s) => s.world.visited.length >= 5,
  },
  {
    id: "storykeeper",
    name: "Storykeeper",
    description: "Read five memory stones.",
    test: (s) => s.world.lore.length >= 5,
  },
  {
    id: "gardener",
    name: "Gentle Hands",
    description: "Gather 20 sunpetals.",
    test: (s) => s.stats.blooms >= 20,
  },
  {
    id: "steadfast",
    name: "Steadfast",
    description: "Reach level 10.",
    test: (s) => s.player.level >= 10,
  },
  {
    id: "lightkeeper",
    name: "Keeper of the Light",
    description: "Restore all ten waystones.",
    test: (s) => s.world.activated.filter((id) => VALE_IDS.has(id)).length >= 10,
  },
  {
    id: "guardian",
    name: "The Quiet Crown",
    description: "Quiet the Crown Guardian.",
    test: (s) => !!s.world.flags.guardian,
  },
  {
    id: "whole-vale",
    name: "Every Road Home",
    description: "Discover all ten regions.",
    test: (s) => s.world.visited.filter((id) => VALE_IDS.has(id)).length >= 10,
  },
  { id: "first-signal", name: "A Signal in the Mist", description: "Repair a signal beacon in the Reaches.", test: (s) => s.world.beacons.length >= 1 },
  { id: "courier", name: "Left for the Road", description: "Open five supply caches.", test: (s) => s.world.openedCaches.length >= 5 },
  { id: "network", name: "The Lights Answer", description: "Repair all ten Reaches signal beacons.", test: (s) => s.world.beacons.length >= 10 },
  { id: "storm-warden", name: "The Last Signal", description: "Quiet the Storm Warden.", test: (s) => !!s.world.flags.warden },
  { id: "far-traveller", name: "Beyond the Vale", description: "Discover all ten regions of the Reaches.", test: (s) => s.world.visited.filter((id) => REGION_BY_ID[id]?.chapter === 2).length >= 10 },

  { id:'first-archive', name:'An Open Question', description:'Align a Meridian archive.', test:s=>Object.values(s.world.archives || {}).some(a=>a.solved) },
  { id:'first-project', name:'A Place for Someone', description:'Restore a Wilds site as a refuge or watch.', test:s=>Object.keys(s.world.projects || {}).length >= 1 },
  { id:'wilds-five', name:'Into the Wilds', description:'Discover five regions in the Meridian Wilds.', test:s=>s.world.visited.filter(id=>REGION_BY_ID[id]?.chapter===3).length>=5 },
  { id:'wilds-all', name:'Every Voice on the Map', description:'Discover all ten regions in the Meridian Wilds.', test:s=>s.world.visited.filter(id=>REGION_BY_ID[id]?.chapter===3).length>=10 },
  { id:'archives-all', name:'The Record Is Never One Voice', description:'Align all ten Meridian archives.', test:s=>Object.values(s.world.archives || {}).filter(a=>a.solved).length>=10 },
  { id:'tempest', name:'The Order We Change', description:'Quiet the Tempest Engine.', test:s=>!!s.world.flags.tempest },
  { id:'first-charm', name:'Made for the Road', description:'Craft a wayfarer charm.', test:s=>(s.player.gear?.owned || []).length>=1 },
  { id:'first-route', name:'A Road Worth Sharing', description:'Complete and claim a field route.', test:s=>(s.world.trails?.claimed || []).length>=1 },
  { id:'four-routes', name:'A Well-Worn Map', description:'Complete four field routes.', test:s=>(s.world.trails?.claimed || []).length>=4 },
  { id:'all-routes', name:'The Shape of a Journey', description:'Complete the twelve Vale, Reaches and Wilds field routes.', test:s=>TRAILS.filter(t=>t.chapter<4).every(t=>(s.world.trails?.claimed || []).includes(t.id)) },
  { id:'first-observation', name:'Paying Attention', description:'Observe a creature to add it to your field guide.', test:s=>Object.keys(s.world.bestiary || {}).length>=1 },
  { id:'field-observer', name:'Know the Warning', description:'Observe every kind of creature and major encounter.', test:s=>Object.keys(s.world.bestiary || {}).length>=8 },
  { id:'first-tide', name:'Time to Choose', description:'Repair a tide anchor in the Sound.', test:s=>(s.world.tideAnchors || []).length>=1 },
  { id:'tide-network', name:'The Water Answers', description:'Repair all ten Sound tide anchors.', test:s=>(s.world.tideAnchors || []).length>=10 },
  { id:'sound-roads', name:'A Map for Everyone', description:'Discover all ten regions of the Glasswater Sound.', test:s=>s.world.visited.filter(id=>REGION_BY_ID[id]?.chapter===4).length>=10 },
  { id:'sound-routes', name:'The Long Way by Water', description:'Complete all four Glasswater Sound field routes.', test:s=>TRAILS.filter(t=>t.chapter===4).every(t=>(s.world.trails?.claimed || []).includes(t.id)) },
  { id:'harbor-open', name:'A Person at Both Ends', description:'Help Tala reopen the harbor warning network.', test:s=>s.world.quests['when-water-answers']==='complete' },

];
