/** Ten hand-written archive mechanisms. The order is LEFT, MIDDLE, RIGHT. */
export const ARCHIVE_GLYPHS = Object.freeze([
  { id:'sun', name:'Sun', icon:'sun' },
  { id:'river', name:'River', icon:'river' },
  { id:'tree', name:'Tree', icon:'tree' },
  { id:'star', name:'Star', icon:'star' },
]);

export const ARCHIVES = Object.freeze({
  southgate: {
    title:'The Gate Register',
    inscription:'The sun rises over the river; the tree stands on the far bank. Set the three signs in the order the traveller sees them.',
    solution:['sun','river','tree'],
    fragment:'The gate was designed to close when the storm came. Its keeper wrote a second instruction in the margin: leave a way out for the people already inside.',
    reward:{xp:45,coins:18,ore:1},
  },
  copperwood: {
    title:'The Orchard Record',
    inscription:'The tree shaded the sun-marked table. A star was carved last. The river mark belongs to another page.',
    solution:['tree','sun','star'],
    fragment:'The orchard owners agreed to feed the crews, but no one asked where they would go if the firebreak failed. A later hand added their names to the plan.',
    reward:{xp:55,coins:24,bloom:2},
  },
  slatefall: {
    title:'The Quarry Ledger',
    inscription:'A star guided the surveyor to the river. The sun rose only after the crossing; the tree is absent.',
    solution:['star','river','sun'],
    fragment:'The quarry supplied the machine. Its workers asked for an evacuation road as carefully as they asked for payment. The road appears on the rejected drawing.',
    reward:{xp:55,coins:24,ore:2},
  },
  embercross: {
    title:'The Observatory Index',
    inscription:'The river reflects a star. Beneath that reflection grows a tree; no sun appears in this night picture.',
    solution:['river','star','tree'],
    fragment:'The Meridian was not simply a machine. It was a promise that weather would be shared fairly. The calculations were precise; the consent was not.',
    reward:{xp:60,coins:30,echoes:1},
  },
  sungold: {
    title:'The Terrace Account',
    inscription:'The sun warms the tree. Its roots reach the river. Follow that path from sky to water.',
    solution:['sun','tree','river'],
    fragment:'The terraces had enough water for everyone until the network redirected the flood. The missing allocation was not an error in arithmetic; it was a person omitted from the meeting.',
    reward:{xp:55,coins:25,bloom:2},
  },
  cloudstep: {
    title:'The Ridge Log',
    inscription:'A tree marks the beginning of the climb. Beyond it, the river shines under the star. Read the route from the ground upward.',
    solution:['tree','river','star'],
    fragment:'The ridge crew could see the storm coming. Their warning reached the tower, but the receiving bell was disconnected to keep the experiment undisturbed.',
    reward:{xp:70,coins:35,ore:2},
  },
  oldmeasure: {
    title:'The Dissenting Diagram',
    inscription:'The star was placed first. The tree was drawn between it and the sun. The river was never part of this diagram.',
    solution:['star','tree','sun'],
    fragment:'The dissenting engineers did not demand that the work be abandoned. They asked that the people at risk be given the power to stop it.',
    reward:{xp:75,coins:35,echoes:2},
  },
  meridianheart: {
    title:'The Heart Directive',
    inscription:'The river feeds the tree. The sun follows both. Arrange the order in which a living thing would need them.',
    solution:['river','tree','sun'],
    fragment:'The final instruction was amended: hold the storm until every voice has been heard. The engine could not tell a silence imposed by fear from agreement.',
    reward:{xp:90,coins:50,potions:1},
  },
  stillfen: {
    title:'The Fen Testimony',
    inscription:'The star was reflected in the river, then dawn brought the sun. Read the marks in the order the witnesses describe.',
    solution:['star','river','sun'],
    fragment:'Three families gave different accounts of the flood. The archivist kept every version and left the disagreement visible, rather than declaring one memory convenient.',
    reward:{xp:65,coins:30,bloom:2},
  },
  ashshore: {
    title:'The Inlet Reply',
    inscription:'The river carried the message to the sunlit shore. That night the star answered. Read from departure to reply.',
    solution:['river','sun','star'],
    fragment:'The answer from the far shore was never “let the machine decide.” It was “we are coming, and we will decide together.”',
    reward:{xp:70,coins:35,echoes:1},
  },
});
