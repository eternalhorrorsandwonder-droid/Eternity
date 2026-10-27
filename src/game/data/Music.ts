/**
 * Music.
 *
 * The audio engine synthesises every track at runtime — there are no audio
 * files in the repository. This file is the *composition* layer: sixteen
 * hand-tuned moods that map onto the world, each built from a root note, a
 * scale and a rhythmic template.
 *
 * A track's identity comes from four things: its scale (minor for the dark
 * places, whole-tone for the eldritch, pentatonic for the void), its tempo, its
 * timbre (sine and triangle for the calm worlds, sawtooth for the tense ones),
 * and its drum template. Two tracks can share a scale and still sound nothing
 * alike because their rhythm is different.
 *
 * Everything is soft by design: the engine keeps the bus at roughly -6 dB and
 * rate-limits repetition, so a long exploration session never builds up an
 * ear-ache.
 */

import type { MusicTrack } from '../../engine/audio/MusicEngine';

const MINOR = [0, 2, 3, 5, 7, 8, 10];
const MAJOR = [0, 2, 4, 5, 7, 9, 11];
const DORIAN = [0, 2, 3, 5, 7, 9, 10];
const PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
const LYDIAN = [0, 2, 4, 6, 7, 9, 11];
const WHOLE_TONE = [0, 2, 4, 6, 8, 10];
const PENTA_MINOR = [0, 3, 5, 7, 10];

type Mood = 'calm' | 'plains' | 'mystery' | 'tense' | 'epic' | 'menu' | 'village' | 'ocean'
  | 'snow' | 'volcanic' | 'crimson' | 'warped' | 'verdant' | 'arcane' | 'void' | 'final';

/** MIDI note to frequency. */
function hz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12);
}

interface MoodTemplate {
  bpm: number;
  lead: MusicTrack['lead'];
  pad: MusicTrack['pad'];
  cutoff: number;
  percussion: number;
  bars: number;
  /** Chord progression as scale degrees. */
  chords: number[];
  /** Arpeggio figure. */
  arp: number[][];
  arpOctave: number;
  /** Bass steps. */
  bass: number[];
  /** Drums. */
  drums: { k: number[]; s: number[]; h: number[]; c: number[] };
}

const MOODS: Record<Mood, MoodTemplate> = {
  calm: {
    bpm: 76, lead: 'sine', pad: 'triangle', cutoff: 2600, percussion: 0, bars: 4,
    chords: [0, 5, 3, 4],
    arp: [[0], [2], [4], [2], [1], [3], [5], [3]],
    arpOctave: 0, bass: [0, 0, 0, 0, 0, 0, 0, 0],
    drums: { k: [], s: [], h: [0, 0, 0, 0, 0, 0, 0, 0], c: [] },
  },
  plains: {
    bpm: 96, lead: 'triangle', pad: 'triangle', cutoff: 3400, percussion: 0.35, bars: 4,
    chords: [0, 4, 5, 3],
    arp: [[0, 2], [2, 4], [4, 2], [2, 1], [1, 3], [3, 5], [5, 4], [4, 2]],
    arpOctave: 0, bass: [0, 0, 0, 0, 0, 0, 0, 0],
    drums: { k: [0, 0, 1, 0, 0, 0, 0, 0], s: [0, 0, 0, 0, 1, 0, 0, 0], h: [0, 1, 0, 1, 0, 1, 0, 1], c: [] },
  },
  mystery: {
    bpm: 72, lead: 'sine', pad: 'sine', cutoff: 1800, percussion: 0.1, bars: 4,
    chords: [0, 5, 2, 6],
    arp: [[0], [3], [5], [3], [6], [4], [2], [3]],
    arpOctave: 0, bass: [0, 0, 0, 0, 0, 0, 0, 0],
    drums: { k: [0, 0, 0, 0, 0, 0, 0, 0], s: [], h: [0, 0, 1, 0, 0, 0, 1, 0], c: [] },
  },
  tense: {
    bpm: 108, lead: 'sawtooth', pad: 'triangle', cutoff: 4200, percussion: 0.6, bars: 4,
    chords: [0, 5, 0, 4],
    arp: [[0, 4], [4, 2], [2, 0], [0, 3], [3, 5], [5, 4], [4, 2], [2, 0]],
    arpOctave: 0, bass: [0, 0, 4, 0, 0, 0, 3, 0],
    drums: { k: [1, 0, 0, 0, 1, 0, 0, 0], s: [0, 0, 0, 0, 1, 0, 0, 0], h: [0, 1, 0, 1, 0, 1, 1, 1], c: [0, 0, 0, 0] },
  },
  epic: {
    bpm: 138, lead: 'sawtooth', pad: 'sawtooth', cutoff: 5000, percussion: 1, bars: 4,
    chords: [0, 5, 3, 4],
    arp: [[0, 2, 4], [4, 2, 0], [0, 3, 5], [5, 3, 0], [0, 2, 4], [4, 5, 3], [3, 2, 0], [0, 4, 5]],
    arpOctave: 0, bass: [0, 0, 0, 0, 4, 4, 4, 4],
    drums: { k: [1, 0, 0, 1, 1, 0, 0, 1], s: [0, 0, 0, 0, 1, 0, 0, 0], h: [1, 1, 1, 1, 1, 1, 1, 1], c: [1, 0, 0, 0] },
  },
  menu: {
    bpm: 66, lead: 'sine', pad: 'sine', cutoff: 2200, percussion: 0, bars: 4,
    chords: [0, 4, 5, 3],
    arp: [[0], [4], [5], [4], [3], [1], [0], [1]],
    arpOctave: 0, bass: [0, 0, 0, 0, 0, 0, 0, 0],
    drums: { k: [], s: [], h: [], c: [] },
  },
  village: {
    bpm: 92, lead: 'triangle', pad: 'triangle', cutoff: 3200, percussion: 0.3, bars: 4,
    chords: [0, 3, 4, 5],
    arp: [[0, 2], [2, 4], [4, 3], [3, 2], [2, 1], [1, 0], [0, 2], [2, 4]],
    arpOctave: 0, bass: [0, 0, 3, 3, 4, 4, 5, 5],
    drums: { k: [1, 0, 0, 0, 0, 0, 0, 0], s: [0, 0, 0, 0, 1, 0, 0, 0], h: [0, 1, 0, 1, 0, 1, 0, 1], c: [] },
  },
  ocean: {
    bpm: 84, lead: 'sine', pad: 'sine', cutoff: 2000, percussion: 0.2, bars: 4,
    chords: [0, 5, 4, 3],
    arp: [[0], [4], [5], [4], [3], [2], [0], [2]],
    arpOctave: 0, bass: [0, 0, 0, 0, 0, 0, 0, 0],
    drums: { k: [1, 0, 0, 0, 0, 0, 0, 0], s: [], h: [0, 0, 1, 0, 0, 0, 1, 0], c: [] },
  },
  snow: {
    bpm: 78, lead: 'sine', pad: 'triangle', cutoff: 2400, percussion: 0.15, bars: 4,
    chords: [0, 5, 2, 4],
    arp: [[0], [5], [3], [2], [4], [1], [0], [3]],
    arpOctave: 0, bass: [0, 0, 0, 0, 0, 0, 0, 0],
    drums: { k: [], s: [], h: [0, 0, 1, 0, 0, 0, 1, 0], c: [] },
  },
  volcanic: {
    bpm: 116, lead: 'sawtooth', pad: 'sawtooth', cutoff: 4600, percussion: 0.85, bars: 4,
    chords: [0, 0, 5, 4],
    arp: [[0, 5], [5, 0], [0, 3], [3, 0], [0, 5], [5, 4], [4, 0], [0, 3]],
    arpOctave: 0, bass: [0, 0, 0, 0, 5, 5, 5, 5],
    drums: { k: [1, 0, 0, 0, 1, 0, 0, 0], s: [0, 0, 0, 0, 1, 0, 0, 0], h: [1, 1, 1, 1, 1, 1, 1, 1], c: [1, 0, 0, 1] },
  },
  crimson: {
    bpm: 124, lead: 'square', pad: 'sawtooth', cutoff: 4400, percussion: 0.9, bars: 4,
    chords: [0, 5, 0, 3],
    arp: [[0, 3], [3, 5], [5, 3], [3, 0], [0, 5], [5, 0], [0, 4], [4, 0]],
    arpOctave: 0, bass: [0, 0, 5, 0, 0, 0, 3, 0],
    drums: { k: [1, 0, 0, 1, 1, 0, 0, 1], s: [0, 0, 0, 0, 1, 0, 0, 0], h: [1, 1, 0, 1, 1, 1, 1, 1], c: [1, 0, 0, 0] },
  },
  warped: {
    bpm: 90, lead: 'triangle', pad: 'sine', cutoff: 3000, percussion: 0.45, bars: 4,
    chords: [0, 5, 2, 6],
    arp: [[0, 3], [3, 2], [2, 5], [5, 3], [3, 0], [0, 2], [2, 5], [5, 0]],
    arpOctave: 0, bass: [0, 0, 2, 2, 5, 5, 3, 3],
    drums: { k: [1, 0, 0, 0, 0, 0, 1, 0], s: [0, 0, 0, 0, 1, 0, 0, 0], h: [0, 1, 0, 1, 0, 1, 0, 1], c: [0, 0, 1, 0] },
  },
  verdant: {
    bpm: 88, lead: 'sine', pad: 'triangle', cutoff: 3000, percussion: 0.3, bars: 4,
    chords: [0, 3, 5, 4],
    arp: [[0, 2], [2, 4], [4, 3], [3, 1], [1, 2], [2, 3], [3, 4], [4, 2]],
    arpOctave: 0, bass: [0, 0, 3, 3, 5, 5, 4, 4],
    drums: { k: [1, 0, 0, 0, 0, 0, 0, 0], s: [0, 0, 0, 0, 1, 0, 0, 0], h: [0, 1, 0, 1, 0, 1, 0, 1], c: [] },
  },
  arcane: {
    bpm: 100, lead: 'sine', pad: 'sine', cutoff: 3800, percussion: 0.4, bars: 4,
    chords: [0, 4, 5, 6],
    arp: [[0, 4], [4, 6], [6, 5], [5, 4], [4, 0], [0, 6], [6, 4], [4, 0]],
    arpOctave: 1, bass: [0, 0, 4, 4, 5, 5, 6, 6],
    drums: { k: [1, 0, 0, 0, 1, 0, 0, 0], s: [0, 0, 0, 0, 1, 0, 0, 0], h: [0, 1, 0, 1, 0, 1, 0, 1], c: [0, 0, 0, 1] },
  },
  void: {
    bpm: 70, lead: 'sine', pad: 'sine', cutoff: 1600, percussion: 0.05, bars: 4,
    chords: [0, 0, 0, 0],
    arp: [[0], [2], [4], [1], [3], [0], [2], [4]],
    arpOctave: 0, bass: [0, 0, 0, 0, 0, 0, 0, 0],
    drums: { k: [], s: [], h: [0, 0, 0, 0, 0, 0, 0, 0], c: [] },
  },
  final: {
    bpm: 150, lead: 'sawtooth', pad: 'sawtooth', cutoff: 5600, percussion: 1, bars: 4,
    chords: [0, 5, 3, 4],
    arp: [[0, 2, 4, 5], [5, 4, 2, 0], [0, 3, 5, 4], [4, 3, 2, 0], [0, 2, 4, 5], [5, 4, 3, 2], [2, 3, 4, 5], [5, 4, 2, 0]],
    arpOctave: 0, bass: [0, 0, 0, 0, 4, 4, 4, 4],
    drums: { k: [1, 0, 1, 0, 1, 0, 1, 0], s: [0, 0, 0, 0, 1, 0, 0, 0], h: [1, 1, 1, 1, 1, 1, 1, 1], c: [1, 0, 1, 0] },
  },
};

/**
 * Build a track from a mood and a scale. The scale does the heavy lifting: the
 * same rhythm in Phrygian sounds like a desert caravan and in Lydian sounds
 * like a high plateau at dawn.
 */
function track(
  id: string, name: string, mood: Mood, rootMidi: number, scale: number[]
): MusicTrack {
  const t = MOODS[mood];
  // normalise chord degrees into the scale
  const chords = t.chords.map((d) => ((d % scale.length) + scale.length) % scale.length);
  const arp = t.arp.map((step) => step.map((s) => ((s % scale.length) + scale.length) % scale.length));
  const bass = t.bass.map((b) => (b >= 0 ? ((b % scale.length) + scale.length) % scale.length : b));
  return {
    id, name, bpm: t.bpm, root: rootMidi, scale,
    chords, arp, arpOctave: t.arpOctave, bass,
    drums: {
      k: t.drums.k, s: t.drums.s, h: t.drums.h,
      c: t.drums.c.length ? t.drums.c : [0, 0, 0, 0],
    },
    lead: t.lead, pad: t.pad, cutoff: t.cutoff,
    percussion: t.percussion, bars: t.bars,
  };
}

export const MUSIC_TRACKS: MusicTrack[] = [
  track('menu', 'The Title', 'menu', 57, MAJOR),
  track('vale', 'Verdant Vale', 'village', 50, MAJOR),
  track('plains', 'Golden Savanna', 'plains', 52, MAJOR),
  track('forest', 'Whispering Woods', 'mystery', 48, MINOR),
  track('snow', 'Frostbound Shore', 'snow', 53, DORIAN),
  track('ocean', 'The Cold Sea', 'ocean', 55, MAJOR),
  track('savanna', 'Windswept Steppe', 'plains', 50, DORIAN),
  track('desert', 'Sun-Baked Dunes', 'plains', 49, PHRYGIAN),
  track('badlands', 'Ochre Badlands', 'tense', 45, MINOR),
  track('mining', 'The Crawler Warrens', 'tense', 42, MINOR),
  track('citadel', 'Ruined Citadel', 'tense', 43, PHRYGIAN),
  track('volcanic', 'Cinderfall Peaks', 'volcanic', 41, PHRYGIAN),
  track('nether', 'The Hollow Depths', 'crimson', 38, MINOR),
  track('crimson', 'Crimson Expanse', 'crimson', 37, PHRYGIAN),
  track('warped', 'Warped Grove', 'warped', 39, DORIAN),
  track('verdant', 'Verdant Sanctum', 'verdant', 44, MAJOR),
  track('eldritch', 'Eldritch Rift', 'mystery', 36, WHOLE_TONE),
  track('arcane', 'Arcane Reach', 'arcane', 46, LYDIAN),
  track('void', 'The Void Expanse', 'void', 34, PENTA_MINOR),
  track('end', 'The Eternity Gate', 'epic', 32, MINOR),
  track('starfall', 'Starfall Plateau', 'epic', 30, MINOR),
  track('finale', 'The World Heart', 'final', 28, MINOR),
  track('boss', 'Arena', 'epic', 26, MINOR),
  track('calm', 'Rest', 'calm', 48, MAJOR),
];

export const TRACK_BY_ID: Map<string, MusicTrack> = new Map(MUSIC_TRACKS.map((t) => [t.id, t]));

/** The track played on the title screen. */
export const TITLE_TRACK = TRACK_BY_ID.get('menu')!;
/** The track played in combat when no region music applies. */
export const COMBAT_TRACK = TRACK_BY_ID.get('boss')!;
/** The track played when the player dies. */
export const DEATH_TRACK = TRACK_BY_ID.get('void')!;
/** A short track for the world-core cutscene. */
export const FINALE_TRACK = TRACK_BY_ID.get('finale')!;

/** The default ambient track for a biome. Every biome must be covered. */
export const BIOME_AMBIENT: Record<string, string> = {
  plains: 'plains',
  forest: 'forest',
  birch_forest: 'forest',
  taiga: 'forest',
  glade: 'forest',
  savanna: 'savanna',
  savanna_plateau: 'savanna',
  windswept: 'savanna',
  desert: 'desert',
  badlands: 'badlands',
  swamp: 'calm',
  mangrove: 'calm',
  mushroom: 'calm',
  ocean: 'ocean',
  deep_ocean: 'ocean',
  beach: 'ocean',
  coral: 'ocean',
  snow: 'snow',
  ice: 'snow',
  snowy_mountain: 'snow',
  mountain: 'volcanic',
  volcanic: 'volcanic',
  netherrack: 'nether',
  crimson: 'crimson',
  warped: 'warped',
  end: 'end',
  magic: 'arcane',
  verdant: 'verdant',
  eldritch: 'eldritch',
  void: 'void',
  lush_cave: 'mining',
  dripstone: 'mining',
  ancient: 'citadel',
};

/** Map a region's music track index onto an actual track. */
export function trackForIndex(index: number): MusicTrack {
  const pool = ['vale', 'plains', 'forest', 'snow', 'ocean', 'savanna', 'desert', 'badlands', 'volcanic', 'nether', 'crimson', 'warped', 'verdant', 'eldritch', 'arcane', 'void'];
  const id = pool[((index % pool.length) + pool.length) % pool.length];
  return TRACK_BY_ID.get(id) ?? MUSIC_TRACKS[0];
}

/** The peak frequency of a track's root, for the audio meter. */
export function trackRootFreq(t: MusicTrack): number {
  return hz(t.root);
}
