/**
 * Audio engine.
 *
 * Everything the game plays — music *and* sound effects — is synthesised with
 * the Web Audio API at runtime. There are no audio files in the repo: a
 * 200MB of OGGs would be dead weight on a phone, and a synth costs nothing.
 *
 * The design rule is "pleasant, never nagging":
 *   - every voice goes through a low-pass and a soft attack,
 *   - no sound exceeds ~-6dB at the bus,
 *   - repeated SFX are rate-limited so a machine-gun attack cannot stack
 *     dozens of identical bursts into a wall of noise,
 *   - a global "dynamic range" control scales how loud combat gets.
 */

export interface ToneOptions {
  type?: OscillatorType;
  attack?: number;
  decay?: number;
  sustain?: number;
  release?: number;
  gain?: number;
  freq?: number;
  detune?: number;
  filter?: number;       // cutoff Hz
  filterType?: BiquadFilterType;
  pan?: number;          // -1..1
  delay?: number;
  glideTo?: number;      // frequency ramp
}

export interface NoiseOptions {
  gain?: number;
  attack?: number;
  decay?: number;
  filter?: number;
  filterType?: BiquadFilterType;
  q?: number;
  pan?: number;
  pitch?: number;        // playbackRate of the buffer
}

export class AudioEngine {
  ctx: AudioContext | null = null;
  master!: GainNode;
  sfxBus!: GainNode;
  musicBus!: GainNode;
  ambientBus!: GainNode;
  uiBus!: GainNode;

  masterVolume = 0.75;
  musicVolume = 0.5;
  sfxVolume = 0.85;
  /** 0 = quiet, 1 = full. Scales combat layers only. */
  dynamicRange = 0.55;
  muted = false;
  started = false;

  private lastPlay: Map<string, number> = new Map();
  private noiseBuffer: AudioBuffer | null = null;
  private unlockPromise: Promise<void> | null = null;

  /** Advance a limiter clock used by SFX throttling. */
  now(): number {
    return this.ctx ? this.ctx.currentTime : performance.now() / 1000;
  }

  async unlock(): Promise<void> {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        try { await this.ctx.resume(); } catch { /* ignore */ }
      }
      return;
    }
    const Ctx = window.AudioContext || (window as any).webkitAudioContext;
    if (!Ctx) return;
    const ctx: AudioContext = new Ctx();
    this.ctx = ctx;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 24;
    comp.ratio.value = 12;
    comp.attack.value = 0.004;
    comp.release.value = 0.22;

    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.masterVolume;
    this.master.connect(comp);
    comp.connect(ctx.destination);

    this.sfxBus = ctx.createGain();
    this.sfxBus.gain.value = this.sfxVolume;
    this.sfxBus.connect(this.master);

    this.musicBus = ctx.createGain();
    this.musicBus.gain.value = this.musicVolume;
    this.musicBus.connect(this.master);

    this.ambientBus = ctx.createGain();
    this.ambientBus.gain.value = 0.0;
    this.ambientBus.connect(this.master);

    this.uiBus = ctx.createGain();
    this.uiBus.gain.value = 0.6;
    this.uiBus.connect(this.master);

    this.noiseBuffer = this.makeNoise(2.0);
    this.started = true;
    try { await ctx.resume(); } catch { /* ignore */ }
  }

  private makeNoise(seconds: number): AudioBuffer {
    const ctx = this.ctx!;
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    // Pink-ish noise (filtered white) sounds far less "sparkly" and harsh.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + w * 0.0555179;
      b1 = 0.99332 * b1 + w * 0.0750759;
      b2 = 0.969 * b2 + w * 0.153852;
      b3 = 0.8665 * b3 + w * 0.3104856;
      b4 = 0.55 * b4 + w * 0.5329522;
      b5 = -0.7616 * b5 - w * 0.016898;
      d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
      b6 = w * 0.115926;
    }
    return buf;
  }

  setMasterVolume(v: number): void {
    this.masterVolume = v;
    if (this.master) this.master.gain.value = this.muted ? 0 : v;
  }
  setMusicVolume(v: number): void {
    this.musicVolume = v;
    if (this.musicBus) this.musicBus.gain.value = v;
  }
  setSfxVolume(v: number): void {
    this.sfxVolume = v;
    if (this.sfxBus) this.sfxBus.gain.value = v;
  }
  setDynamicRange(v: number): void { this.dynamicRange = v; }
  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.masterVolume;
  }

  // ------------------------------------------------------------------ voices
  /**
   * A single oscillator voice with an ADSR envelope, an optional low-pass and
   * an optional pitch glide. This is the workhorse for every musical sound.
   */
  tone(freq: number, dur: number, opts: ToneOptions = {}): AudioScheduledSourceNode | null {
    const ctx = this.ctx;
    if (!ctx || this.muted) return null;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const type = opts.type ?? 'sine';
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (opts.glideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, opts.glideTo), t0 + dur);
    if (opts.detune) osc.detune.value = opts.detune;

    const gain = ctx.createGain();
    const a = opts.attack ?? 0.005;
    const d = opts.decay ?? 0.08;
    const s = opts.sustain ?? 0.6;
    const r = opts.release ?? 0.08;
    const peak = opts.gain ?? 0.2;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + a);
    gain.gain.linearRampToValueAtTime(peak * s, t0 + a + d);
    gain.gain.setValueAtTime(peak * s, t0 + dur);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur + r);

    const bus = opts.delay !== undefined ? this.sfxBus : this.sfxBus;
    let node: AudioNode = osc;
    if (opts.filter) {
      const f = ctx.createBiquadFilter();
      f.type = opts.filterType ?? 'lowpass';
      f.frequency.setValueAtTime(opts.filter, t0);
      f.Q.value = 1;
      osc.connect(f);
      node = f;
    }
    if (opts.pan !== undefined && ctx.createStereoPanner) {
      const p = ctx.createStereoPanner();
      p.pan.value = opts.pan;
      (node as AudioNode).connect(p);
      node = p;
    }
    node.connect(gain);
    gain.connect(bus);
    osc.start(t0);
    osc.stop(t0 + dur + r + 0.05);
    osc.onended = () => { try { gain.disconnect(); } catch { /* already gone */ } };
    return osc;
  }

  /** Two detuned oscillators — the "fat" bass/lead sound. */
  fat(freq: number, dur: number, opts: ToneOptions = {}): void {
    const types: OscillatorType[] = ['triangle', 'sawtooth'];
    for (let i = 0; i < 2; i++) {
      this.tone(freq * (i === 0 ? 1 : 1.006), dur, {
        ...opts,
        type: types[i],
        detune: (i - 0.5) * 6,
        gain: (opts.gain ?? 0.18) * 0.6,
      });
    }
  }

  noise(dur: number, opts: NoiseOptions = {}): void {
    const ctx = this.ctx;
    if (!ctx || this.muted || !this.noiseBuffer) return;
    const t0 = ctx.currentTime + (opts.gain === undefined ? 0 : 0);
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;
    src.playbackRate.value = opts.pitch ?? 1;
    const f = ctx.createBiquadFilter();
    f.type = opts.filterType ?? 'lowpass';
    f.frequency.setValueAtTime(opts.filter ?? 1200, t0);
    f.Q.value = opts.q ?? 1;
    const gain = ctx.createGain();
    const peak = opts.gain ?? 0.2;
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.linearRampToValueAtTime(peak, t0 + (opts.attack ?? 0.004));
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f); f.connect(gain); gain.connect(this.sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  /** A quick upward/downward blip used for UI. */
  blip(freq: number, to: number, dur: number, gain = 0.12): void {
    this.tone(freq, dur, { glideTo: to, type: 'triangle', gain, filter: 3200, attack: 0.004, decay: dur * 0.7, release: dur * 0.4 });
  }

  // -------------------------------------------------------------- throttling
  /**
   * Throttle a named SFX. `minGap` is in seconds. Returns false when the sound
   * was suppressed, so callers can skip their visual/logic follow-up.
   */
  throttle(name: string, minGap: number): boolean {
    const t = this.now();
    const last = this.lastPlay.get(name);
    if (last !== undefined && t - last < minGap) return false;
    this.lastPlay.set(name, t);
    return true;
  }

  // ------------------------------------------------------------------- SFX
  /** Every named effect in the game. Kept deliberately soft and rounded. */
  play(name: string, intensity = 1): void {
    if (!this.ctx || this.muted) return;
    const i = Math.max(0.2, Math.min(2, intensity));
    switch (name) {
      case 'swing':
        if (!this.throttle('swing', 0.11)) return;
        this.noise(0.14, { gain: 0.1 * i, filter: 2600, pitch: 1.1 + i * 0.2 });
        this.tone(320 + i * 60, 0.09, { type: 'triangle', gain: 0.05 * i, glideTo: 160, filter: 1800 });
        break;
      case 'hit_flesh':
        if (!this.throttle('hit_flesh', 0.08)) return;
        this.noise(0.12, { gain: 0.24 * i, filter: 900 + i * 200, pitch: 0.9 });
        this.tone(110 + i * 20, 0.11, { type: 'square', gain: 0.09 * i, filter: 500, glideTo: 55 });
        break;
      case 'hit_metal':
        if (!this.throttle('hit_metal', 0.07)) return;
        this.tone(2400, 0.06, { type: 'square', gain: 0.05 * i, filter: 6000, decay: 0.02, release: 0.05 });
        this.tone(3100, 0.05, { type: 'triangle', gain: 0.035 * i, filter: 7000, decay: 0.02, release: 0.04 });
        this.noise(0.05, { gain: 0.1 * i, filter: 5200 });
        break;
      case 'hit_shield':
        if (!this.throttle('hit_shield', 0.09)) return;
        this.tone(700, 0.1, { type: 'sine', gain: 0.12 * i, filter: 2200, decay: 0.03, release: 0.14 });
        this.tone(1050, 0.08, { type: 'triangle', gain: 0.06 * i, filter: 3000 });
        break;
      case 'crit':
        this.tone(1400, 0.12, { type: 'sawtooth', gain: 0.1 * i, filter: 4200, glideTo: 2600, attack: 0.002 });
        this.tone(2100, 0.1, { type: 'triangle', gain: 0.06 * i, filter: 5400 });
        this.noise(0.1, { gain: 0.16 * i, filter: 4000, pitch: 1.3 });
        break;
      case 'break_block':
        if (!this.throttle('break_block', 0.05)) return;
        this.noise(0.18, { gain: 0.16 * i, filter: 1500 + i * 400, pitch: 0.85 });
        this.tone(180, 0.13, { type: 'triangle', gain: 0.07 * i, glideTo: 70, filter: 900 });
        break;
      case 'place_block':
        if (!this.throttle('place_block', 0.05)) return;
        this.tone(150, 0.07, { type: 'square', gain: 0.06 * i, filter: 800, decay: 0.02, release: 0.05 });
        this.noise(0.05, { gain: 0.07 * i, filter: 1200 });
        break;
      case 'jump':
        this.tone(420, 0.1, { type: 'triangle', gain: 0.07, glideTo: 640, filter: 2000, decay: 0.04, release: 0.08 });
        break;
      case 'land':
        this.tone(130, 0.09, { type: 'sine', gain: 0.07 * Math.min(2, i), glideTo: 70, filter: 700 });
        this.noise(0.07, { gain: 0.06 * i, filter: 800 });
        break;
      case 'dash':
        this.noise(0.2, { gain: 0.14 * i, filter: 2600, pitch: 1.4, attack: 0.002 });
        this.tone(600, 0.16, { type: 'sawtooth', gain: 0.05 * i, glideTo: 240, filter: 1600 });
        break;
      case 'hurt':
        this.tone(200, 0.2, { type: 'sawtooth', gain: 0.1 * i, glideTo: 90, filter: 1100, attack: 0.006 });
        this.noise(0.16, { gain: 0.1 * i, filter: 700 });
        break;
      case 'player_die':
        this.tone(300, 0.9, { type: 'sawtooth', gain: 0.14, glideTo: 60, filter: 1400, attack: 0.02, decay: 0.4, release: 0.5 });
        this.tone(150, 0.9, { type: 'triangle', gain: 0.1, glideTo: 40, filter: 900, attack: 0.03 });
        break;
      case 'enemy_die':
        this.tone(220, 0.24, { type: 'sawtooth', gain: 0.09 * i, glideTo: 60, filter: 1200 });
        this.noise(0.2, { gain: 0.1 * i, filter: 1000, pitch: 0.7 });
        break;
      case 'levelup': {
        const notes = [523.25, 659.25, 783.99, 1046.5];
        notes.forEach((n, k) => this.tone(n, 0.3, { type: 'triangle', gain: 0.11, delay: k * 0.07, filter: 4200, attack: 0.005, decay: 0.12, release: 0.2 }));
        break;
      }
      case 'skill_cast':
        this.tone(520, 0.3, { type: 'sawtooth', gain: 0.1, glideTo: 1500, filter: 3600, attack: 0.008 });
        this.tone(780, 0.24, { type: 'triangle', gain: 0.06, glideTo: 2100, filter: 4600 });
        break;
      case 'skill_impact':
        this.tone(90, 0.35, { type: 'sine', gain: 0.2 * i, glideTo: 40, filter: 800, attack: 0.003, decay: 0.2 });
        this.noise(0.3, { gain: 0.18 * i, filter: 1400, pitch: 0.6, attack: 0.003 });
        this.tone(260, 0.2, { type: 'square', gain: 0.06 * i, filter: 2000, glideTo: 90 });
        break;
      case 'explosion':
        this.noise(0.65, { gain: 0.28 * i, filter: 900, pitch: 0.55, attack: 0.004, decay: 0.45 });
        this.tone(60, 0.6, { type: 'sine', gain: 0.24 * i, glideTo: 24, filter: 500, attack: 0.004, decay: 0.4 });
        this.tone(120, 0.35, { type: 'triangle', gain: 0.1 * i, glideTo: 40, filter: 900 });
        break;
      case 'pickup':
        this.tone(880, 0.08, { type: 'triangle', gain: 0.09, filter: 3600 });
        this.tone(1320, 0.1, { type: 'triangle', gain: 0.07, filter: 4600, delay: 0.05 });
        break;
      case 'coin':
        this.tone(1568, 0.06, { type: 'square', gain: 0.06, filter: 5000, decay: 0.02, release: 0.05 });
        this.tone(2093, 0.1, { type: 'square', gain: 0.05, filter: 6000, delay: 0.05, decay: 0.03, release: 0.07 });
        break;
      case 'quest_complete': {
        const notes = [659.25, 783.99, 987.77, 1318.5];
        notes.forEach((n, k) => this.tone(n, 0.28, { type: 'triangle', gain: 0.1, delay: k * 0.08, filter: 4400, attack: 0.006, decay: 0.1, release: 0.22 }));
        break;
      }
      case 'quest_fail':
        this.tone(330, 0.3, { type: 'triangle', gain: 0.1, glideTo: 180, filter: 2600 });
        this.tone(220, 0.4, { type: 'triangle', gain: 0.08, glideTo: 110, filter: 2000, delay: 0.14 });
        break;
      case 'ui_click':
        this.tone(720, 0.05, { type: 'square', gain: 0.05, filter: 3200, decay: 0.015, release: 0.03 });
        break;
      case 'ui_hover':
        this.tone(520, 0.03, { type: 'sine', gain: 0.025, filter: 3000, decay: 0.01, release: 0.02 });
        break;
      case 'ui_back':
        this.tone(440, 0.08, { type: 'triangle', gain: 0.06, glideTo: 300, filter: 2600 });
        break;
      case 'ui_error':
        this.tone(180, 0.16, { type: 'square', gain: 0.07, filter: 1200, decay: 0.05, release: 0.1 });
        this.tone(150, 0.16, { type: 'square', gain: 0.05, filter: 1000, delay: 0.07 });
        break;
      case 'ui_open':
        this.tone(520, 0.12, { type: 'triangle', gain: 0.06, glideTo: 780, filter: 3400, attack: 0.005 });
        break;
      case 'portal':
        for (let k = 0; k < 6; k++) {
          this.tone(300 + k * 130, 0.4, { type: 'sine', gain: 0.07, delay: k * 0.05, filter: 2600, attack: 0.01, decay: 0.18, release: 0.3 });
        }
        break;
      case 'teleport':
        this.tone(1200, 0.4, { type: 'sawtooth', gain: 0.08, glideTo: 200, filter: 3000, attack: 0.01 });
        break;
      case 'bow_shoot':
        this.noise(0.09, { gain: 0.09, filter: 3200, pitch: 1.6 });
        this.tone(900, 0.06, { type: 'triangle', gain: 0.05, glideTo: 500, filter: 2400 });
        break;
      case 'arrow_hit':
        this.tone(400, 0.08, { type: 'square', gain: 0.06, filter: 2000, decay: 0.02, release: 0.05 });
        this.noise(0.06, { gain: 0.07, filter: 2600 });
        break;
      case 'fire':
        this.noise(0.5, { gain: 0.1 * i, filter: 700, pitch: 0.8, attack: 0.05 });
        break;
      case 'ice':
        this.tone(2400, 0.24, { type: 'sine', gain: 0.07 * i, filter: 6000, attack: 0.01, decay: 0.14, release: 0.3 });
        this.tone(3200, 0.18, { type: 'triangle', gain: 0.04 * i, filter: 7000, delay: 0.04 });
        break;
      case 'lightning':
        this.noise(0.3, { gain: 0.2 * i, filter: 4000, pitch: 1.8, attack: 0.002 });
        this.tone(1800, 0.1, { type: 'sawtooth', gain: 0.06 * i, filter: 8000, glideTo: 400 });
        break;
      case 'heal':
        this.tone(587.33, 0.24, { type: 'sine', gain: 0.1, filter: 3200, attack: 0.02, decay: 0.12, release: 0.3 });
        this.tone(880, 0.24, { type: 'sine', gain: 0.07, filter: 4200, delay: 0.1, attack: 0.02, decay: 0.12, release: 0.3 });
        break;
      case 'stamina':
        this.tone(660, 0.1, { type: 'triangle', gain: 0.05, filter: 3000 });
        break;
      case 'guard':
        this.tone(260, 0.16, { type: 'square', gain: 0.08, filter: 1600, decay: 0.05, release: 0.12 });
        this.noise(0.1, { gain: 0.1, filter: 2400 });
        break;
      case 'merchant':
        this.tone(660, 0.08, { type: 'triangle', gain: 0.07, filter: 3000 });
        this.tone(990, 0.12, { type: 'triangle', gain: 0.06, filter: 3800, delay: 0.08 });
        break;
      case 'boss_roar':
        this.tone(70, 1.2, { type: 'sawtooth', gain: 0.2, glideTo: 45, filter: 700, attack: 0.08, decay: 0.5, release: 0.7 });
        this.tone(105, 1.0, { type: 'square', gain: 0.09, glideTo: 55, filter: 1000, attack: 0.1 });
        this.noise(1.0, { gain: 0.1, filter: 500, pitch: 0.4, attack: 0.05 });
        break;
      case 'minimap':
        this.tone(1000, 0.04, { type: 'sine', gain: 0.03, filter: 4000 });
        break;
      case 'save':
        this.tone(523.25, 0.1, { type: 'triangle', gain: 0.08, filter: 3600 });
        this.tone(783.99, 0.14, { type: 'triangle', gain: 0.07, filter: 4400, delay: 0.1 });
        break;
      case 'load':
        this.tone(783.99, 0.1, { type: 'triangle', gain: 0.08, filter: 4000 });
        this.tone(523.25, 0.16, { type: 'triangle', gain: 0.07, filter: 3600, delay: 0.1 });
        break;
      case 'respawn':
        for (let k = 0; k < 5; k++) {
          this.tone(330 * Math.pow(1.26, k), 0.2, { type: 'triangle', gain: 0.09, delay: k * 0.07, filter: 3800, attack: 0.008, decay: 0.08, release: 0.18 });
        }
        break;
      default:
        break;
    }
  }
}
