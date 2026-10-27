/**
 * Procedural music engine.
 *
 * Every track in Eternity is a small data blob (see `game/data/Music.ts`) that
 * describes a chord progression, an arpeggio figure, a bass line and a drum
 * pattern. The engine renders those into actual audio with a lookahead
 * scheduler, so:
 *
 *   - there are no music files to download or buffer,
 *   - a "calm exploration" version and a "combat" version of the same track can
 *     be mixed on the fly without a crossfade seam,
 *   - the density of the mix scales with the number of enemies nearby.
 *
 * A 60fps game cannot afford to build AudioContext nodes per note inside the
 * render loop, so all scheduling happens on a 25ms timer with a 0.15s lookahead.
 */

import type { AudioEngine } from './AudioEngine';

export interface MusicTrack {
  id: string;
  name: string;
  bpm: number;
  /** Root MIDI note. */
  root: number;
  /** Scale intervals in semitones from the root. */
  scale: number[];
  /** Chord progression as scale-degree indices, one per bar. */
  chords: number[];
  /** Arpeggio figure: array of steps, each step is a scale index + octave. */
  arp: number[][];
  arpOctave: number;
  /** Bass pattern: steps of scale indices (negative = root an octave down). */
  bass: number[];
  /** Drum pattern: 16 steps of {k,s,h,c} booleans. */
  drums: { k: number[]; s: number[]; h: number[]; c: number[] };
  /** Timbre. */
  lead: OscillatorType;
  pad: OscillatorType;
  cutoff: number;
  /** How much of the mix is drums/percussion 0..1. */
  percussion: number;
  /** Bar count before the progression repeats (for variety). */
  bars: number;
}

function midiToFreq(m: number): number {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export interface MusicState {
  track: MusicTrack | null;
  /** 0 = calm, 1 = full combat. Mixes the drum bus and doubles the arp rate. */
  intensity: number;
  playing: boolean;
  volume: number;
}

export class MusicEngine {
  audio: AudioEngine;
  ctx: AudioContext | null = null;
  private timer: number | null = null;
  private nextNoteTime = 0;
  private step = 0;
  private bar = 0;
  private track: MusicTrack | null = null;
  private targetIntensity = 0;
  private intensity = 0;
  private padVoices: OscillatorNode[] = [];
  private padGains: GainNode[] = [];
  private padFilters: BiquadFilterNode[] = [];
  private ambientSrc: AudioBufferSourceNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientFilter: BiquadFilterNode | null = null;
  private ambientLfo: OscillatorNode | null = null;
  volume = 0.5;

  constructor(audio: AudioEngine) {
    this.audio = audio;
  }

  init(): void {
    this.ctx = audioCtx(this.audio);
    this.startAmbient();
  }

  /** Crossfade from the current track to a new one. */
  play(track: MusicTrack | null, fade = 0.8): void {
    if (this.track === track) return;
    if (this.track && this.ctx) {
      const t = this.ctx.currentTime;
      for (let i = 0; i < this.padGains.length; i++) {
        const g = this.padGains[i];
        if (g) g.gain.cancelScheduledValues(t);
        if (g) g.gain.setTargetAtTime(0.0001, t, fade * 0.4);
      }
    }
    this.stopPads();
    this.track = track;
    this.step = 0;
    this.bar = 0;
    if (!this.ctx || !track) return;
    this.nextNoteTime = this.ctx.currentTime + fade * 0.5;
    this.buildPads(track);
    this.schedule();
  }

  stop(fade = 0.6): void {
    const old = this.track;
    this.track = null;
    if (this.ctx && old) {
      const t = this.ctx.currentTime;
      for (const g of this.padGains) {
        if (g) g.gain.cancelScheduledValues(t);
        if (g) g.gain.setTargetAtTime(0.0001, t, fade * 0.35);
      }
    }
    this.stopPads();
  }

  setIntensity(v: number): void {
    this.targetIntensity = Math.max(0, Math.min(1, v));
  }

  get currentTrack(): MusicTrack | null { return this.track; }
  get playing(): boolean { return !!this.track; }

  setVolume(v: number): void {
    this.volume = v;
  }

  // ------------------------------------------------------------------ pads
  private buildPads(track: MusicTrack): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    // Three detuned voices per chord tone gives the pads their "breathing" width.
    const tones = track.chords.length ? 3 : 3;
    for (let i = 0; i < tones; i++) {
      const osc = ctx.createOscillator();
      osc.type = track.pad;
      osc.frequency.value = midiToFreq(track.root - 12);
      osc.detune.value = (i - 1) * 7;
      const g = ctx.createGain();
      g.gain.value = 0.0001;
      g.gain.setTargetAtTime(0.05, t, 0.8);
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = track.cutoff * 0.5;
      f.Q.value = 0.6;
      osc.connect(f); f.connect(g); g.connect(this.audio.musicBus);
      osc.start(t);
      this.padVoices.push(osc);
      this.padGains.push(g);
      this.padFilters.push(f);
    }
    this.refreshPad();
  }

  private refreshPad(): void {
    if (!this.track || !this.ctx) return;
    const track = this.track;
    const t = this.ctx.currentTime;
    const deg = track.chords[this.bar % track.chords.length] ?? 0;
    const root = track.root - 12;
    for (let i = 0; i < this.padVoices.length; i++) {
      const idx = (deg + i) % track.scale.length;
      const m = root + track.scale[idx];
      const f = midiToFreq(m);
      const osc = this.padVoices[i];
      if (osc) {
        osc.frequency.cancelScheduledValues(t);
        osc.frequency.setTargetAtTime(f, t, 0.35);
      }
      const flt = this.padFilters[i];
      if (flt) flt.frequency.setTargetAtTime(track.cutoff * (0.45 + i * 0.25), t, 0.6);
    }
  }

  private stopPads(): void {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    for (const osc of this.padVoices) { try { osc.stop(t + 0.2); } catch { /* ignore */ } }
    for (const g of this.padGains) { try { g.gain.setTargetAtTime(0.0001, t, 0.1); } catch { /* ignore */ } }
    this.padVoices = [];
    this.padGains = [];
    this.padFilters = [];
  }

  // ------------------------------------------------------------- scheduling
  private schedule(): void {
    if (!this.ctx || !this.track || this.timer !== null) return;
    const lookahead = 0.15;
    const ctx = this.ctx;
    this.timer = window.setInterval(() => this.tick(ctx, lookahead), 25);
  }

  private tick(ctx: AudioContext, lookahead: number): void {
    if (!this.track || !this.audio.ctx) return;
    const now = ctx.currentTime;
    if (this.nextNoteTime < now) this.nextNoteTime = now + 0.05;
    while (this.nextNoteTime < now + lookahead) {
      this.scheduleStep(this.nextNoteTime);
      const beat = 60 / this.track.bpm;
      // 16th notes
      this.nextNoteTime += beat / 4;
      this.step++;
      if (this.step >= 16) { this.step = 0; this.bar++; }
    }
  }

  private scheduleStep(time: number): void {
    const track = this.track;
    if (!track || !this.ctx) return;
    const ctx = this.ctx;
    const beat = 60 / track.bpm;
    const sixteenth = beat / 4;
    const intensity = this.intensity;

    // ---- drums --------------------------------------------------------
    if (track.percussion > 0) {
      const k = track.drums.k[this.step];
      const s = track.drums.s[this.step];
      const h = track.drums.h[this.step];
      const c = track.drums.c[this.step];
      const drive = 0.35 + intensity * 0.65;
      if (k) this.kick(time, 0.42, 0.3 * track.percussion * drive);
      if (s) this.snare(time, 0.22, 0.16 * track.percussion * drive);
      if (h) this.hat(time, 0.07, 0.07 * track.percussion * drive);
      if (c) this.hat(time, 0.12, 0.06 * track.percussion * drive);
    }

    // ---- bass ---------------------------------------------------------
    const bassStep = track.bass[this.step];
    if (bassStep !== undefined && bassStep !== 0) {
      const idx = bassStep < 0 ? 0 : ((bassStep % track.scale.length) + track.scale.length) % track.scale.length;
      const m = track.root - 24 + track.scale[idx];
      const dur = sixteenth * (this.step % 4 === 0 ? 3 : 1.6);
      this.bassNote(midiToFreq(m), time, dur, 0.22 * (0.6 + intensity * 0.5));
    }

    // ---- arpeggio -----------------------------------------------------
    const arp = track.arp[this.step];
    if (arp) {
      const deg = arp[0] ?? 0;
      const oct = arp[1] ?? track.arpOctave;
      const idx = ((deg % track.scale.length) + track.scale.length) % track.scale.length;
      const m = track.root + track.scale[idx] + 12 * oct;
      const dur = sixteenth * 1.6;
      this.leadNote(midiToFreq(m), time, dur, 0.075 * (0.6 + intensity * 0.55), track);
    }

    // ---- chord stabs on bar starts ------------------------------------
    if (this.step === 0) {
      this.refreshPad();
      if (track.percussion < 0.2 && intensity < 0.25) {
        // Ambient mode: soft bell on the downbeat of every other bar.
        if (this.bar % 2 === 0) {
          const deg = track.chords[this.bar % track.chords.length] ?? 0;
          for (let i = 0; i < 3; i++) {
            const idx = (deg + i) % track.scale.length;
            this.leadNote(midiToFreq(track.root + track.scale[idx]), time, beat * 2.4, 0.045, track, 0.02 * i);
          }
        }
      }
    }
  }

  private kick(t: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.12);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(this.audio.musicBus);
    osc.start(t); osc.stop(t + dur + 0.05);
  }

  private snare(t: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = (this.audio as any).noiseBuffer;
    if (!src.buffer) return;
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = 1800; f.Q.value = 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.audio.musicBus);
    src.start(t); src.stop(t + dur + 0.02);
    // Body tone.
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(240, t);
    osc.frequency.exponentialRampToValueAtTime(140, t + 0.08);
    const g2 = ctx.createGain();
    g2.gain.setValueAtTime(gain * 0.5, t);
    g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.1);
    osc.connect(g2); g2.connect(this.audio.musicBus);
    osc.start(t); osc.stop(t + 0.15);
  }

  private hat(t: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = (this.audio as any).noiseBuffer;
    if (!src.buffer) return;
    src.playbackRate.value = 2.0;
    const f = ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.002);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(this.audio.musicBus);
    src.start(t); src.stop(t + dur + 0.02);
  }

  private bassNote(freq: number, t: number, dur: number, gain: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, t);
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(freq * 2, t);
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(700, t);
    f.frequency.exponentialRampToValueAtTime(220, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.01);
    g.gain.setTargetAtTime(gain * 0.7, t + 0.06, 0.1);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(f); osc2.connect(f); f.connect(g); g.connect(this.audio.musicBus);
    osc.start(t); osc2.start(t);
    osc.stop(t + dur + 0.05); osc2.stop(t + dur + 0.05);
  }

  private leadNote(freq: number, t: number, dur: number, gain: number, track: MusicTrack, delay = 0): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = track.lead;
    osc.frequency.value = freq;
    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.value = freq * 2;
    osc2.detune.value = 4;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(track.cutoff, t + delay);
    f.frequency.exponentialRampToValueAtTime(track.cutoff * 0.5, t + delay + dur);
    const g = ctx.createGain();
    const a = 0.008;
    g.gain.setValueAtTime(0.0001, t + delay);
    g.gain.linearRampToValueAtTime(gain, t + delay + a);
    g.gain.setTargetAtTime(gain * 0.55, t + delay + a + dur * 0.3, 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + delay + dur);
    osc.connect(f); osc2.connect(f); f.connect(g); g.connect(this.audio.musicBus);
    osc.start(t + delay); osc2.start(t + delay);
    osc.stop(t + delay + dur + 0.05); osc2.stop(t + delay + dur + 0.05);
  }

  /** Slowly morph intensity toward the target (used by the combat mixer). */
  update(dt: number): void {
    this.intensity += (this.targetIntensity - this.intensity) * Math.min(1, dt * 1.6);
  }

  // ------------------------------------------------------------- ambience
  /** Continuous, slowly modulated wind/room tone underneath the music. */
  private startAmbient(): void {
    const ctx = this.audio.ctx;
    if (!ctx || !(this.audio as any).noiseBuffer) return;
    const src = ctx.createBufferSource();
    src.buffer = (this.audio as any).noiseBuffer;
    src.loop = true;
    src.playbackRate.value = 0.5;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = 420;
    f.Q.value = 0.7;
    const g = ctx.createGain();
    g.gain.value = 0.0;
    src.connect(f); f.connect(g); g.connect(this.audio.ambientBus);
    src.start();

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.06;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 220;
    lfo.connect(lfoGain); lfoGain.connect(f.frequency);
    lfo.start();

    this.ambientSrc = src;
    this.ambientGain = g;
    this.ambientFilter = f;
    this.ambientLfo = lfo;
  }

  setAmbient(level: number, weatherBias = 0): void {
    if (!this.ambientGain) return;
    const t = this.audio.ctx ? this.audio.ctx.currentTime : 0;
    // Weather bias pushes the wind filter darker/lighter.
    const target = Math.max(0, Math.min(0.16, level * 0.09 + weatherBias * 0.03));
    this.ambientGain.gain.setTargetAtTime(target, t, 0.6);
    if (this.ambientFilter) {
      const cut = 380 + weatherBias * 900;
      this.ambientFilter.frequency.setTargetAtTime(cut, t, 0.8);
    }
  }

  destroy(): void {
    if (this.timer !== null) { clearInterval(this.timer); this.timer = null; }
    this.stopPads();
  }
}

function audioCtx(audio: AudioEngine): AudioContext | null {
  return audio.ctx;
}
