/**
 * The codex.
 *
 * Lore is delivered as a book, not as a wall of text: short entries the player
 * finds as quest rewards, in chests, and by doing things. Every entry has a
 * `source` so the codex can say *how* the player learned it, and every entry is
 * short enough to read in a glance — a codex that is a chore to read is a codex
 * nobody reads.
 *
 * The tone is deliberately restrained. The world is strange, but it is not
 * cosmic-horror strange: things are wrong here, and they have reasons, and most
 * of those reasons are understandable. The horror is in the scale, not the
 * incomprehensibility.
 */

export type CodexCategory = 'history' | 'people' | 'places' | 'bestiary' | 'magic' | 'mysteries';

export interface CodexEntry {
  id: string;
  category: CodexCategory;
  title: string;
  /** The body of the entry. */
  text: string;
  /** Where the player can find it. */
  source: string;
  /** Region id the entry belongs to, or -1 for global entries. */
  region: number;
  /** Colour used for the entry's icon. */
  color: number;
}

const c = (
  id: string, category: CodexCategory, title: string, text: string,
  source: string, region: number, color: number
): CodexEntry => ({ id, category, title, text, source, region, color });

export const CODEX: CodexEntry[] = [
  c('lore_creation', 'history', 'The Making of the World',
    'The world was not made. It was woken.\n\nBefore the first king there was a long silence, and in that silence the world dreamed of grass and water and something that could walk on it. When the dream became too large to hold, the world cracked, and the first people walked out of the crack.\n\nThey were not made by the world. They were what the world had been dreaming about.',
    'Found in a chest beneath the First Pillar.', -1, 0xffe070),

  c('lore_first_king', 'history', 'The First King',
    'The first king had no name, because names were something he invented afterwards.\n\nHe did three things. He built the Eternity Vault to hold the world\'s first light. He raised the twelve crowns of the old kingdoms to mark the edges of what was civilised. And he forged the Eternity Guardian to stand at the core and keep the world from waking up again.\n\nThen he went into the vault, and he did not come out.',
    'Given by the First Pillar when you return after leaving the vale.', -1, 0xffd060),

  c('lore_the_crown', 'history', 'The Broken Crown',
    'The crown was not broken in a battle. It was broken on purpose.\n\nThe first king could not see the end of the world. He could only see that it had an end, and that whatever was at the end would need a lock. The crown was the lock, and it was also the key, and it was made so that it could only be used by someone who would not use it.\n\nWhoever picks it up takes the kingdom. Whoever puts it down keeps it.',
    'Recovered from the Dune Tomb.', 70, 0xffd060),

  c('lore_the_vault', 'mysteries', 'The Eternity Vault',
    'The vault has eight floors and it has never been finished.\n\nEvery floor past the fifth is a test, and every test is a question the first king wanted answered before he trusted the world with its own history. The last room on the eighth floor is empty. There is a drawing on the wall of what it was meant to hold.\n\nThe drawing is of a person.',
    'Read from the Archive on the seventh floor of the vault.', 126, 0xffe070),

  c('lore_the_heart', 'mysteries', 'The Heart of the World',
    'The world has a heart, and it is not a metaphor.\n\nIt sits at the core, below the Eternity Arena, and it is the thing the first king built the guardian to protect. It is the reason the world has grass and water and something that walks on it. It is also the reason the world has storms, wars, and the long silence at the end of every age.\n\nThe heart does not want to be protected. It wants to be seen.',
    'Given by the World Heart after the final fight.', 143, 0xff3aa0),

  c('lore_the_starfall', 'mysteries', 'The Starfall',
    'A star fell out of the sky, and it was a fist.\n\nIt came down on the east of the world and made a crater the size of a country. What it was holding closed. What it was holding has been crawling out of the crater ever since.\n\nThe thing that fell was not the star. It was the hand that was holding it.',
    'Found in the fused glass of the Starfall Crater.', 141, 0xfff0a0),

  c('lore_the_moonwell', 'mysteries', 'The Moonwell',
    'There is a well at the top of the world, and it has never held water.\n\nThe well is a bowl of stone at the highest point of the highest peak. It was built to hold the moon, because the first king believed the moon was something that could be kept, if you were high enough and patient enough and had a bowl the right shape.\n\nHe was wrong about the shape. He was right about the patience.',
    'Read from the shrine at Stormpeak.', 5, 0xc0d0ff),

  c('lore_the_end_gate', 'mysteries', 'The End Gate',
    'The gate at the end of the world is not a gate. It is a lock.\n\nIt was built to keep something out of the world. Not a monster — the gate was built long after the monsters, and it was built by people who knew what they were doing. It was built to keep out the thing the world was dreaming about before it cracked.\n\nThe lock has never been opened. It has been nearly opened twice.',
    'Read from the ruins beneath the Eternity Gate.', 114, 0x8a6ae8),

  c('lore_the_deep_dark', 'mysteries', 'The Deep Dark',
    'There is a dark under the world that is older than the world.\n\nIt does not have a name. The first people called it the deep dark because they had nothing better to call it, and the name stuck the way names do. It lives in the hollow places, and it makes a sound, and that sound is the only thing in the world that is not part of the world.\n\nThe hollow wardens are not its guardians. They are its librarians.',
    'Given by the Hollow Warden.', 84, 0x3a4a3a),

  c('lore_the_aether', 'mysteries', 'The Aether Vale',
    'The sky over the aether vale is missing a piece.\n\nNot a cloud, not a star — a piece of the sky itself. You can see it if you stand at the observatory at the right hour: a hole in the middle of the night, the size of a fist, that nothing falls through and nothing comes out of.\n\nThe first king put the hole there. It was the last thing he did before he went into the vault.',
    'Read at the aether observatory.', 53, 0xa080e8),

  c('lore_the_void', 'mysteries', 'The Void Expanse',
    'Past the edge of the world there is nothing, and the nothing has an echo of you.\n\nIt is not a reflection and it is not a ghost. It is a thing that the world dreamed about when it dreamed of grass and water and something that could walk on it — it is the something the world would have made if the first king had not woken it first.\n\nThe echo is not hostile. It is curious. That is what makes it dangerous.',
    'Given by the Echo in the Void Expanse.', 110, 0x5040a0),

  c('lore_the_old_gods', 'mysteries', 'The Old Gods',
    'The old gods were never gods. They were people who wanted to live forever, and who found a way.\n\nThey live in the eldritch rift, and they are old in the way that a wound is old. They do not want to rule the world. They want the world to stop changing, because a world that stops changing cannot hurt them any more.\n\nThey are not evil. They are the wrong kind of patient.',
    'Given by the Eldritch Heart.', 109, 0xb04080),

  c('lore_the_verdant', 'history', 'The Verdant Heart',
    'The oldgrowth at the centre of the grove was a heart, before the first king built the world\'s heart.\n\nIt is the oldest thing alive, and it was alive before anything was alive. It grew the forest, and the forest grew the people, and the people grew the world, and then the world grew a heart of its own and it did not need the old one any more.\n\nThe old one is still there. It has been waiting for someone to need it.',
    'Given by the Verdant Heart.', 120, 0x5ae070),

  c('lore_the_ember', 'history', 'The Ember Titan',
    'Ignis was a blacksmith before he was a titan.\n\nHe built the forges of the Cinderfall, and he built them to make weapons for a war that he believed would end the world. The war came, and he made the weapons, and the war ended, and the weapons were left in the forges.\n\nHe went back to the forges to put them out. He did not come out.',
    'Given by Ignis, the Ember Titan.', 73, 0xff6020),

  c('lore_the_citadel', 'history', 'The Citadel Warden',
    'The citadel was built to guard a gate, and the gate was closed three hundred years ago.\n\nThe warden was built to guard the gate, and the gate was closed, and the warden did not notice. It stands in the ruins of the citadel and it does not move, because it was built not to move unless the gate opened.\n\nThe gate is not going to open. The warden does not know that.',
    'Given by the Citadel Warden.', 77, 0xb0b0c0),

  c('lore_the_warden', 'history', 'The Nether Warden',
    'The fortress at the nether gate has never fallen.\n\nIt was built to hold the gate against the things in the nether, and it has held, and the people who built it are gone, and the things in the nether have not changed, and the warden has not changed, and the gate has not moved.\n\nThe warden held the gate alone for four hundred years. He does not remember why he started.',
    'Given by the Nether Warden.', 98, 0xe04020),

  c('lore_the_warped', 'history', 'The Warped Twins',
    'Verdega was one evoker, once.\n\nHe was caught between two places at once — a warp that went wrong — and the two halves of him did not agree about which half was the real one. They have been arguing for three hundred years.\n\nThey are not a monster. They are an argument, and arguments are the most dangerous things in the world.',
    'Given by Verdega, the Warped Twin.', 89, 0x5aa090),

  c('lore_the_dragon', 'history', 'The Ender Dragon',
    'The dragon is the last child of the old sky.\n\nIt was born before the first king, and it remembers the crack, and it has been waiting for the world to wake up again ever since. It does not hate the world. It is just very old, and very bored, and very hungry.\n\nIt will not thank you for killing it. It would have thanked you for fighting it.',
    'Given by the Ender Dragon.', 114, 0x8a6ae8),

  c('lore_the_wither', 'history', 'The Wither',
    'The wither was a king who wanted a kingdom that could not die.\n\nHe found three skulls and he put them on a body, and the body did not die, and the kingdom did not die, and the skulls did not die, and they have been ruling a kingdom of three skulls for three hundred years.\n\nHe is not unhappy. He is just very, very tired of his own kingdom.',
    'Given by the Wither.', 6, 0x4a4a52),

  c('lore_the_guardian', 'history', 'The Eternity Guardian',
    'The guardian is the last thing the first king built.\n\nIt was built to stand at the core and keep the world from waking up, and it has done that for longer than anything else has lasted, and it is still standing, and it is still doing it, and it does not know that the world woke up anyway.\n\nIt will thank you for telling it. It will not thank you for stopping it.',
    'Given by the Eternity Guardian.', 138, 0xffe070),

  c('lore_the_starfall_titan', 'mysteries', 'The Starfall Titan',
    'The titan that fell out of the sky was holding something closed.\n\nIt fell on the crater floor and it kept holding. Whatever it was holding is still in the crater, and it is still being held, and the titan is still holding it, even though the titan is dead.\n\nThe hand does not let go when the arm is gone. That is the whole problem.',
    'Given by the Starfall Titan.', 117, 0xfff0a0),

  c('lore_the_arcane_twins', 'history', 'The Arcane Twins',
    'The twins were one spell, once, and the spell split.\n\nThe split was not an accident. It was the first king\'s last spell, and it was meant to make the world something the first king could love, and the spell decided that two minds would love better than one.\n\nThey have been arguing about it for three hundred years. They are almost finished.',
    'Given by the Arcane Twins.', 113, 0xa080e8),

  c('lore_the_world_core', 'mysteries', 'The Eternity Core',
    'The core of the world is a room, and the room has a door, and the door is locked with a crown.\n\nThe room was built by the first king for the heart of the world. He put the heart in the room, and he locked the door with the crown, and he went into the vault, and the world woke up anyway.\n\nThe room is empty. The heart is not.',
    'Given by the World Heart.', 138, 0xff3aa0),

  c('lore_the_first_people', 'people', 'The First People',
    'The first people walked out of the crack in the world and they had no names and no tools and no idea what they were.\n\nThey learned to make a fire, and the fire taught them to talk, and talking taught them to remember, and remembering taught them to be afraid, and being afraid taught them to build a wall, and the wall taught them to build a city, and the city taught them that they were not the first people after all.\n\nThere were people before the crack. They went back through it.',
    'Found in the archives of the Arcane Reach.', 113, 0xd0d0ff),

  c('lore_the_villagers', 'people', 'The People of Emberwake',
    'Emberwake was a forge town before it was a town.\n\nThe forges are cold now, and the houses are warm, and the people who live in them are the children of the people who worked the forges, and the grandchildren of the people who ran from the forges when Ignis fell into his own fire.\n\nThey are not afraid of the dark. They are afraid of the light going out.',
    'Given by Villager Mara.', 36, 0xd0a060),

  c('lore_the_hermit', 'people', 'Hermit Ravn',
    'Ravn was a scholar before he was a hermit.\n\nHe went to the world to read the world, and he found the world was already being read — by the hollow wardens, by the deep dark, by the thing under the sanctum — and he decided that he would rather listen than read.\n\nHe is the only person in the world who knows what the world is, and he does not tell you. He tells you what it wants.',
    'Given by Hermit Ravn.', -1, 0x8a8a92),

  c('lore_the_druid', 'people', 'Druid Isel',
    'Isel is a druid, which means she is a person who has decided that the forest is older than she is and that it is right.\n\nShe does not worship the verdant heart. She talks to it. It does not answer. She has been talking to it for thirty years.\n\nShe will tell you that the forest is not dying. She will tell you that it is resting, and that it will wake up when it is ready, and that you should not be the one to wake it up.',
    'Given by Druid Isel.', 120, 0x5ae070),

  c('lore_the_hunter', 'people', 'Hunter Vadi',
    'Vadi has killed everything in the world that can be killed.\n\nHe is not proud of it. He is tired of it. He hunts because hunting is the only thing he knows how to do, and he knows how to do it because he has done it for forty years, and he is not going to stop, because stopping would mean that the forty years were for nothing.\n\nHe will tell you that the crag thing was not alive. He will tell you that it was stored. He will not tell you who stored it.',
    'Given by Hunter Vadi.', 73, 0xc0a060),

  c('lore_the_climber', 'people', 'Climber Ansel',
    'Ansel climbs because the top of the world is a door, and he has seen the door, and he cannot stop thinking about it.\n\nHe has climbed every peak and every tower and every spire, and he has found a door on four of them, and all four of them were the same door, and it was closed every time.\n\nHe is not afraid of the door. He is afraid of what is on the other side of it. He is more afraid of never knowing.',
    'Given by Climber Ansel.', 74, 0x8a8ad0),

  c('lore_the_archaeologist', 'people', 'Archaeologist Vey',
    'Vey digs up things that were never meant to be dug up, and she is the only person in the world who is sorry about that.\n\nShe has read every ruin, every warren, every hollow and every vault, and she has found that the world has been trying to tell people something for three thousand years, and that the people kept not listening.\n\nShe will tell you that the world is not dying. She will tell you that the world is a wound. She will not tell you which one she means.',
    'Given by Archaeologist Vey.', -1, 0xb0b0b8),

  c('lore_the_quartermaster', 'people', 'The Quartermaster',
    'The quartermaster of Norhaven counts everything, and he has counted everything for thirty years, and the numbers are always wrong.\n\nHe does not think the numbers are wrong because he is bad at counting. He thinks the numbers are wrong because the town is being fed by something that is not in the town, and he would like to know what it is.\n\nHe will thank you for the bread. He will not tell you where the bread came from.',
    'Given by the Norhaven quartermaster.', 23, 0xd0a060),

  c('lore_the_witch', 'people', 'The Witch',
    'The witch in the mire is honest, and that is why nobody trusts her.\n\nShe will trade you anything for anything, and she will tell you the price before you ask, and she will not lie about it, and she will not tell you why she wants what she wants.\n\nCor owes her. So does everyone who has ever bought anything from her.',
    'Given by Swamp hermit Cor.', 44, 0x6aa060),

  c('lore_the_keeper', 'people', 'Keeper Otho',
    'Otho has kept the lighthouse for eleven days, and he has not slept for eleven days, and he has started counting backwards.\n\nThe lighthouse is there to keep the ships off the rocks. The ships stopped coming three years ago. Otho has not noticed.\n\nHe will thank you for the lens. He will ask you if you have seen a ship. He will not believe you when you say no.',
    'Given by Keeper Otho.', 46, 0x8ad0ff),

  c('lore_the_soren', 'people', 'Blacksmith Soren',
    'Soren is a blacksmith who has not made anything in three years.\n\nHe lights the forge every morning, and he puts the hammer down, and he picks it up, and he puts it down, and he does that until the forge goes cold, and then he lights it again.\n\nHe is waiting for someone to bring him something that needs to be made. He is not sure what it is. He thinks it will be obvious.',
    'Given by Blacksmith Soren.', 72, 0xb0b0b8),

  c('lore_the_mar', 'people', 'Villager Mara',
    'Mara is the one who remembers the vale.\n\nShe was a child when the vale was full of people, and she remembers the festivals and the bread and the fact that the world used to be smaller, and she remembers the day it got bigger, and she remembers that she did not notice at first.\n\nShe will tell you that the vale is where you are from, even if you are not from anywhere.',
    'Given by Villager Mara.', 24, 0xd0a060),

  c('lore_the_nerish', 'people', 'Arcane Scholar Neris',
    'Neris studies the sky because the sky is the only thing in the world that does not change as fast as Neris does.\n\nShe has been wrong about the sky eleven times. She has been right about it three times. The three times are the ones she remembers.\n\nShe will tell you that the sky is not wrong. She will tell you that the sky is missing a piece. She will tell you that the piece is not lost. She will not tell you where it is.',
    'Given by Arcane Scholar Neris.', 53, 0xa080e8),

  c('lore_the_brakk', 'people', 'Warden Brakk',
    'Brakk was a warden before he was a warden of the flames.\n\nHe lost two brothers to the crimson war, and he counts them every morning, and he has counted them for eleven years, and he has stopped adding them up because the sum keeps changing.\n\nHe will tell you that the war is not over. He will tell you that it is a war about a forest that wants to march, and he will tell you that the forest is not evil, and he will tell you that he does not care.',
    'Given by Warden Brakk.', 85, 0xe04020),

  c('lore_the_isen', 'people', 'Druid Isel, again',
    'Isel has talked to the heart for thirty years and it has not answered, and she is not sure that it has not been answering.\n\nThe forest moves when she is not looking. The sap comes up out of the ground when she is not looking. The flowers bloom when she is not looking. She has started to think that the not-looking is the answer.\n\nShe will tell you that the heart is not a monster. She will tell you that it is a caretaker. She will tell you that it is very tired.',
    'Given by Druid Isel.', 120, 0x5ae070),

  c('lore_the_first_pillar', 'places', 'The First Pillar',
    'The pillar at the centre of the vale is a column of quartz, and it is nine blocks tall, and it has been there for three thousand years.\n\nIt was not built. It grew. It is the first thing that grew in the world after the crack, and it grew because the world wanted something to point at, so that the first people would know where the centre of everything was.\n\nIt points at nothing now. The centre of everything is elsewhere.',
    'Stand at the pillar and look up.', 24, 0x7ce8e8),

  c('lore_the_emberwake', 'places', 'Emberwake',
    'Emberwake is a town of forty houses and one forge, and the forge is cold, and the houses are warm, and the people who live in them do not remember why the town is called emberwake.\n\nThey think it is a word from an old language. It is not. It is the name of the night the forge went cold, and the night the town woke up.',
    'Talk to the people of Emberwake.', 36, 0xff7028),

  c('lore_the_verdant_vale', 'places', 'Verdant Vale',
    'The vale is where the first people learned to like the world.\n\nIt is a bowl of grass and water and one very large oak, and it is the smallest place in the world that has a story, and the story is that the world was not scary here, and that is why the first people stayed.\n\nThe vale is the same size it always was. The people who remember it are not.',
    'Return to the vale after the mainline.', 24, 0x5ae070),

  c('lore_the_oldgrowth', 'places', 'The Oldgrowth',
    'The oldgrowth is a forest, and it is the oldest thing alive, and it is not a forest any more.\n\nIt is a single organism the size of a country, and it has a heart, and the heart is tired, and the forest is trying to decide whether it wants to be a forest or a world.\n\nIt will let you decide. It will not help you.',
    'Given by the Verdant Heart.', 28, 0x5ae070),

  c('lore_the_citadel_ruin', 'places', 'The Ruined Citadel',
    'The citadel is a ruin, and it is a ruin because the gate it was built to guard closed, and it is a ruin because the warden did not notice, and it is a ruin because the people who built it left, and it is a ruin because it is still standing.\n\nIt is the only thing in the world that is still doing what it was built to do.',
    'Walk through the citadel ruins.', 77, 0xb0b0c0),

  c('lore_the_nether', 'places', 'The Hollow Depths',
    'The hollow depths are the nether, and the nether is the world\'s basement.\n\nIt is where the world put everything it did not want to think about: the fire, the bone, the cold ash, the wars that ended, the kings that died, the thing that the first people went back through the crack to find.\n\nIt is not hell. It is a filing cabinet. And something has been taking things out of it.',
    'Given by the Nether Warden.', 88, 0x905050),

  c('lore_the_rift', 'places', 'The Eldritch Rift',
    'The rift is a crack in the world that is not the crack in the world.\n\nThe first crack was at the centre and it made the world. The rift is at the edge and it is made by the old gods, who are people who wanted to live forever and who found a way, and the way involves not changing, and the way involves the world not changing, and the way involves you.\n\nThey are not evil. They are the wrong kind of patient.',
    'Given by the Eldritch Heart.', 109, 0xb04080),

  c('lore_the_void_expanse', 'places', 'The Void Expanse',
    'The void expanse is the nothing at the edge of the world, and the nothing is not empty.\n\nIt is the space the world did not become. It is full of echoes, and the echoes are the things the world dreamed about and did not make, and the echoes are not hostile, and the echoes are not friendly, and the echoes are not echoes.\n\nThey are the world\'s other children.',
    'Given by the Echo.', 110, 0x5040a0),

  c('lore_the_core', 'places', 'The Eternity Core',
    'The core is a room at the centre of the world, and it is empty, and it is not empty.\n\nThe heart is not in the room. The heart is the room. The walls are the heart. The floor is the heart. The door is the heart, and the door is locked with a crown, and the crown is in the vault, and the vault is in the world, and the world is in the heart.\n\nYou have been inside the heart since you were born. You have not been in the room.',
    'Given by the World Heart.', 138, 0xff3aa0),

  c('lore_the_world_heart', 'places', 'The World Heart',
    'The world heart is the thing the first king built the guardian to protect, and it is not in the room.\n\nIt is the world. It is the grass and the water and the something that walks on it. It is the storms and the wars and the long silence. It is the world, and it is not awake, and the first king wanted it to stay that way, and the first king was wrong.\n\nThe heart wants to be awake. It has always wanted that.',
    'Given by the World Heart.', 143, 0xff3aa0),

  c('lore_magic', 'magic', 'Arcane Magic',
    'Magic is not a force. It is a language, and the language is the world\'s, and the world is not speaking.\n\nYou learn magic by listening to the places where the world is speaking loudly — the spires, the rifts, the towers, the hearts — and by repeating what you hear until you can say it in your own voice.\n\nThe old gods learned it by not listening. That is why they are wrong about everything.',
    'Read from the bookshelves in the Arcane Reach.', 113, 0xa080e8),

  c('lore_magic2', 'magic', 'The Void School',
    'Void magic is the art of using the nothing at the edge of the world.\n\nIt is not dangerous because it is nothing. It is dangerous because it is patient. A void spell does not do anything immediately; it does something in ten seconds, or in ten years, or in the space between the words of the spell.\n\nPeople who learn void magic stop sleeping. That is not a side effect.',
    'Read from the spires at the void expanse.', 111, 0x5040a0),

  c('lore_magic3', 'magic', 'Verdant Magic',
    'Verdant magic is the art of asking the forest for things.\n\nIt is not a spell. It is a favour, and the favour is returned, and the return is not always what you asked for. The forest has its own ideas about what you need, and its ideas are better than yours, and it does not mind telling you.\n\nIt will not help you kill. It will help you grow. That is the whole problem.',
    'Given by Druid Isel.', 120, 0x5ae070),

  c('lore_magic4', 'magic', 'Ember Magic',
    'Ember magic is the art of keeping a fire alive when there is nothing to burn.\n\nIt is the oldest magic in the world, and it is the simplest: you keep a thing warm, and the thing keeps you warm, and the thing is a forge, and a heart, and a candle on a long night.\n\nIt is not about destruction. It is about the opposite. It is about the fact that everything that is warm is alive, and everything that is alive is going to die.',
    'Given by Ignis, the Ember Titan.', 73, 0xff6020),

  c('lore_bestiary1', 'bestiary', 'Slime Wisp',
    'The slime wisp is the first thing that the world made that was not a plant.\n\nIt is a small green blob that bounces in odd arcs, and it does not have a brain, and it does not need one, because the world tells it where to go, and the world is very good at telling things where to go.\n\nIt is not a monster. It is a finger-point. It is the world saying: here.',
    'Defeat a slime wisp and read the codex.', -1, 0x6ae06a),

  c('lore_bestiary2', 'bestiary', 'Zombie',
    'A zombie is a person who stopped being a person and did not stop being a body.\n\nThey are not angry. They are not hungry. They are not even slow. They are just still trying to do the thing they were doing when the world cracked, and the world has moved on, and they have not.\n\nThey are the most common death in the world, and the most forgiven.',
    'Defeat a zombie and read the codex.', -1, 0x6a8a5a),

  c('lore_bestiary3', 'bestiary', 'Piglin',
    'A piglin will not attack you while you hold gold.\n\nThis is not a kindness. It is a rule, and the rule is that the piglin has decided what gold is worth, and you have not, and the piglin is not going to argue with you about it.\n\nPut the gold down and it will attack you. That is the point. It wants you to decide.',
    'Defeat a piglin and read the codex.', -1, 0xb09050),

  c('lore_bestiary4', 'bestiary', 'Enderman',
    'An enderman will leave you alone if you do not look at it.\n\nThis is not a kindness either. It is a rule about attention, and the rule is that the enderman does not want to be seen, and looking at it is the same as touching it, and touching it is the same as knowing it.\n\nIt is not hostile. It is private. That is what makes it dangerous.',
    'Defeat an enderman and read the codex.', -1, 0x4a3a6a),

  c('lore_bestiary5', 'bestiary', 'Ender Dragon',
    'The ender dragon is the last child of the old sky.\n\nIt was born before the first king, and it remembers the crack, and it has been waiting for the world to wake up again ever since. It is not evil. It is old, and it is bored, and it is hungry.\n\nIt will not thank you for killing it. It would have thanked you for fighting it.',
    'Defeat the ender dragon and read the codex.', 114, 0x8a6ae8),

  c('lore_bestiary6', 'bestiary', 'World Heart Tendril',
    'The world heart has tendrils, and the tendrils are the world\'s ways of feeling.\n\nThey come out when the world is hurting, and the world is always hurting, and the tendrils are not aggressive. They are the world asking whether you are going to help.\n\nIf you do not help, the tendrils go away. If you hurt them, the world stops asking.',
    'Defeat a tendril and read the codex.', 138, 0xff3aa0),

  c('lore_bestiary7', 'bestiary', 'Starborn Mote',
    'A starborn mote is a living piece of a falling star.\n\nIt is not a creature. It is a thought, and the thought is the star\'s, and the star is dead, and the thought is still falling. It is the size of a fist and it moves like it is trying to hit something.\n\nIt is not hostile. It is not friendly. It is not even there.',
    'Defeat a starborn mote and read the codex.', 117, 0xfff0a0),

  c('lore_bestiary8', 'bestiary', 'Arcane Warden',
    'An arcane warden is a construct of the old towers, and it is still obedient.\n\nIt was built to keep people out of the towers, and it keeps people out of the towers, and it does not know that the towers are empty, and it does not know that the people are gone, and it does not know that it is the only thing left.\n\nIt is not a monster. It is a job that nobody quit.',
    'Defeat an arcane warden and read the codex.', 113, 0xa080e8),

  c('lore_bestiary9', 'bestiary', 'Hollow Warden',
    'A hollow warden is a librarian.\n\nIt lives in the deep dark, and it collects the things that the deep dark says, and it writes them down, and it has been writing them down for longer than the world has been standing, and it does not understand that the things it is writing down are the world\'s.\n\nIt is not evil. It is a librarian. Librarians are dangerous.',
    'Defeat a hollow warden and read the codex.', 84, 0x3a4a3a),

  c('lore_bestiary10', 'bestiary', 'Eternity Spawn',
    'An eternity spawn is one of the first children of the world.\n\nThey were born when the world cracked, and they never grew up, and they never died, and they have been waiting in the vault for three thousand years for someone to open the door and tell them what to do.\n\nThey are not monsters. They are children. They are very, very tired of being children.',
    'Defeat an eternity spawn and read the codex.', 126, 0xffe070),
];

export const CODEX_BY_ID: Map<string, CodexEntry> = new Map(CODEX.map((x) => [x.id, x]));

export const CODEX_CATEGORIES: { id: CodexCategory; label: string; color: number }[] = [
  { id: 'history', label: 'History', color: 0xffe070 },
  { id: 'people', label: 'People', color: 0xd0a060 },
  { id: 'places', label: 'Places', color: 0x8ad0ff },
  { id: 'bestiary', label: 'Bestiary', color: 0xe05050 },
  { id: 'magic', label: 'Magic', color: 0xa080e8 },
  { id: 'mysteries', label: 'Mysteries', color: 0xb040e0 },
];
