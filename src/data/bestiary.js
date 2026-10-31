/** Observations are intentionally specific to the actual encounter rules. */
export const BESTIARY = [
  {
    id:'wisp',name:'Hushling',category:'Wandering light',icon:'star',
    description:'A small piece of unsettled light. Hushlings drift close to their homes and return there if a chase carries them too far.',
    tell:'A short circular warning appears before a close-range strike.',
    counter:'Step beyond the warning or dodge through the hit. In Larkspur Haven, Hushlings remain peaceful until struck.',
    fieldNote:'An echo is not a trophy. The neighbours use that light to wake waystones and make the roads easier to travel.',
  },
  {
    id:'thorn',name:'Thornling',category:'Wandering light',icon:'leaf',
    description:'A heavier Hush creature wrapped in thorn-like growth. It presses close and has a wider, slower strike than a Hushling.',
    tell:'Its warning circle is wider and lingers longer before the blow.',
    counter:'Leave room to move. Strike after the warning resolves; a dodge has a short recovery and cannot be repeated immediately.',
    fieldNote:'The grove is not made safer by hurrying through a crowd. Fen asks for breathing room, not a contest of strength.',
  },
  {
    id:'sentinel',name:'Sentinel',category:'Old signal machinery',icon:'shield',
    description:'A signal device still following an old alarm. Its pulse reaches farther than a Hushling’s swing.',
    tell:'A broad circular warning marks the full area of its discharge.',
    counter:'Move outside the edge before it fires. A repaired local beacon reduces its aggression range and damage.',
    fieldNote:'Kesh listens for the reeds when the alarms fall silent. The machines were built to warn people, not frighten everything away.',
  },
  {
    id:'caster',name:'Shardcaster',category:'Meridian fragment',icon:'gem',
    description:'A Meridian fragment that aims a straight bolt instead of chasing into melee range.',
    tell:'It locks a straight lane toward your position before firing. The lane does not follow you after it is aimed.',
    counter:'Step sideways or dodge out of the lane. The bolt can be stopped by solid scenery; an already-fired bolt is not interrupted by a flash.',
    fieldNote:'Ren’s ridge route is easier when a traveller recognizes a warning line before trying to close the distance.',
  },
  {
    id:'surger',name:'Tide-runner',category:'Glasswater current',icon:'pulse',
    description:'A restless current given a shell. It holds position, chooses a line and then rushes along it rather than following a moving target.',
    tell:'A rounded, straight warning lane locks in place for over a second before the charge. The runner cannot turn during its rush.',
    counter:'Step sideways beyond the lane or dodge through the rush. Solid scenery, people and other creatures stop the runner; a Dawnflash can interrupt it.',
    fieldNote:'Omi keeps the last bell quiet until every boat is counted. A settled runner gives the crews more time to hear it.',
  },
  {
    id:'guardian',name:'Crown Guardian',category:'Major encounter',icon:'crown',
    description:'The old protector of the Crown. It is not hostile to the memory of its original duty, but its attacks are dangerous.',
    tell:'It alternates a close strike and a wider warning. Below half vitality, its wide strike is followed by a second warning and aftershock.',
    counter:'Watch both circles before closing in. A dodge’s invulnerability is brief; do not assume it covers the entire aftershock.',
    fieldNote:'Orin asks that the guardian be quieted without forgetting what it was built to protect.',
  },
  {
    id:'warden',name:'Storm Warden',category:'Major encounter',icon:'pulse',
    description:'A Reaches signal keeper caught in a storm of its own making.',
    tell:'Its attacks alternate close and wide. Once wounded, the wide attack echoes with a second, smaller circle.',
    counter:'Move beyond the warning edge, then wait for the echo before approaching. Ward can soften one hit if timed carefully.',
    fieldNote:'Lyra wants an answer to the storm, not another alarm with no person at the other end.',
  },
  {
    id:'tempest',name:'Tempest Engine',category:'Major encounter',icon:'compass',
    description:'The mechanism at the Meridian Heart, still carrying out an order built from incomplete testimony.',
    tell:'After its wide strike below half vitality, three straight warning lanes announce a fan of bolts.',
    counter:'Leave the indicated lanes, not merely the original circle. The bolts are blocked by scenery and cannot pass through it.',
    fieldNote:'Jun asks for six archives as well as a quiet engine. A changed decision requires the voices the old order omitted.',
  },
];
export const BESTIARY_BY_ID=Object.freeze(Object.fromEntries(BESTIARY.map(entry=>[entry.id,entry])));
