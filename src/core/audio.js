/** A small, gentle score: pentatonic notes and warm sine pads, no audio assets. */
export class Soundscape {
  constructor(settings) {
    this.settings = settings;
    this.context = null;
    this.timer = null;
    this.step = 0;
    this.playing = false;
  }
  async start() {
    try {
      const Context = window.AudioContext || window.webkitAudioContext;
      if (!Context) return;
      if (!this.context) this.context = new Context();
      if (this.context.state === "suspended") await this.context.resume();
      this.playing = true;
      if (!this.timer) this.schedule();
    } catch {
      /* Sound is optional. */
    }
  }
  stop() {
    this.playing = false;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }
  schedule() {
    if (!this.playing || !this.context) {
      this.timer = null;
      return;
    }
    const scale = [
      293.66, 369.99, 440, 493.88, 587.33, 440, 369.99, 329.63, 293.66, 440,
      493.88, 369.99, 329.63, 293.66, 246.94, 329.63,
    ];
    if (this.settings.music > 0) {
      const i = this.step % scale.length;
      this.tone(scale[i], 0.95, "sine", this.settings.music * 0.055, 0.06);
      if (i % 4 === 0)
        this.tone(
          [146.83, 164.81, 196, 220][Math.floor(this.step / 4) % 4],
          2.7,
          "sine",
          this.settings.music * 0.032,
          0.6,
        );
    }
    this.step++;
    this.timer = setTimeout(() => this.schedule(), 810);
  }
  tone(freq, duration, type, volume, attack = 0.015, slide = 1) {
    if (!this.context || this.context.state !== "running" || volume <= 0)
      return;
    const now = this.context.currentTime;
    const oscillator = this.context.createOscillator(),
      gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(20, freq * slide),
      now + duration,
    );
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(
      Math.max(0.0002, volume),
      now + attack,
    );
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain).connect(this.context.destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
  }
  effect(name) {
    const v = this.settings.sfx * 0.08;
    if (!v) return;
    const sounds = {
      swing: [240, 0.13, "sine", 0.55],
      hit: [165, 0.12, "triangle", 0.65],
      pickup: [510, 0.24, "sine", 1.35],
      heal: [440, 0.48, "sine", 1.4],
      hurt: [125, 0.25, "sine", 0.6],
      level: [392, 0.6, "sine", 1.5],
      shrine: [330, 0.9, "sine", 1.8],
      click: [440, 0.08, "sine", 1.1],
      dash: [210, 0.18, "sine", 1.5],
    };
    const s = sounds[name];
    if (s) this.tone(s[0], s[1], s[2], v, 0.01, s[3]);
  }
}
