/**
 * GPU particle system.
 *
 * One `THREE.Points` draw call carries up to ~6000 particles. Position, colour,
 * size and alpha live in typed-array attributes that the CPU writes each frame;
 * the vertex shader does perspective-correct point sizing and the fragment
 * shader samples a soft, procedurally generated sprite.
 *
 * Two blend modes exist — `normal` for dust, smoke, snow and blood, and
 * `add` for sparks, magic and fire — because the difference between a
 * satisfying hit and a muddy smudge is exactly which of those you picked.
 */

import * as THREE from 'three';

export type ParticleKind = 'normal' | 'add';

export interface Particle {
  x: number; y: number; z: number;
  vx: number; vy: number; vz: number;
  life: number; maxLife: number;
  size: number;
  r: number; g: number; b: number;
  alpha: number;
  gravity: number;
  drag: number;
  kind: ParticleKind;
  /** Optional per-particle growth/shrink. */
  grow: number;
  /** Rotation phase for textured particles (unused by the sprite shader). */
  spin: number;
  active: boolean;
}

const MAX_PARTICLES = 6000;

const VERT = `
attribute float aSize;
attribute float aAlpha;
attribute vec3 aColor;
attribute float aKind;

uniform float uPixelRatio;
uniform float uScale;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  float dist = -mv.z;
  gl_PointSize = aSize * uPixelRatio * uScale / max(dist, 0.5);
  gl_PointSize = clamp(gl_PointSize, 1.0, 220.0);
  vColor = aColor;
  vAlpha = aAlpha;
}
`;

const FRAG = `
uniform sampler2D uSprite;
uniform float uOpacity;

varying vec3 vColor;
varying float vAlpha;

void main() {
  vec4 tex = texture2D(uSprite, gl_PointCoord);
  if (tex.a < 0.01) discard;
  float a = tex.a * vAlpha * uOpacity;
  if (a < 0.004) discard;
  gl_FragColor = vec4(vColor, a);
}
`;

export class ParticleSystem {
  private points: THREE.Points;
  private material: THREE.ShaderMaterial;
  private pos: Float32Array;
  private col: Float32Array;
  private size: Float32Array;
  private alpha: Float32Array;
  private kind: Float32Array;
  private cursor = 0;
  private pool: Particle[] = [];
  private geo: THREE.BufferGeometry;
  sprite: THREE.Texture;
  max = MAX_PARTICLES;

  constructor(scene: THREE.Scene) {
    this.pos = new Float32Array(MAX_PARTICLES * 3);
    this.col = new Float32Array(MAX_PARTICLES * 3);
    this.size = new Float32Array(MAX_PARTICLES);
    this.alpha = new Float32Array(MAX_PARTICLES);
    this.kind = new Float32Array(MAX_PARTICLES);

    this.geo = new THREE.BufferGeometry();
    this.geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.geo.setAttribute('aColor', new THREE.BufferAttribute(this.col, 3));
    this.geo.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    this.geo.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    this.geo.setAttribute('aKind', new THREE.BufferAttribute(this.kind, 1));
    this.geo.setDrawRange(0, 0);

    this.sprite = this.makeSprite();

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uSprite: { value: this.sprite },
        uPixelRatio: { value: Math.min(window.devicePixelRatio || 1, 2) },
        uScale: { value: 420.0 },
        uOpacity: { value: 1.0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.points = new THREE.Points(this.geo, this.material);
    this.points.frustumCulled = false;
    this.points.renderOrder = 20;
    scene.add(this.points);

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.pool.push({
        x: 0, y: -1000, z: 0, vx: 0, vy: 0, vz: 0,
        life: 0, maxLife: 1, size: 1,
        r: 1, g: 1, b: 1, alpha: 1,
        gravity: 0, drag: 0, kind: 'normal',
        grow: 0, spin: 0, active: false,
      });
    }
  }

  private makeSprite(): THREE.Texture {
    const size = 64;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const ctx = c.getContext('2d')!;
    const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.72)');
    g.addColorStop(0.7, 'rgba(255,255,255,0.2)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, size, size);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }

  setPixelRatio(pr: number): void {
    (this.material.uniforms.uPixelRatio as any).value = Math.min(pr, 2);
  }
  setScale(s: number): void {
    (this.material.uniforms.uScale as any).value = s;
  }

  private next(): Particle | null {
    // Find a dead particle, preferring the oldest slot to keep the array dense.
    for (let i = 0; i < 32; i++) {
      const idx = (this.cursor + i) % MAX_PARTICLES;
      const p = this.pool[idx];
      if (!p.active) {
        this.cursor = (idx + 1) % MAX_PARTICLES;
        return p;
      }
    }
    return null;
  }

  /**
   * Spawn one particle. Returns the particle (or null when the pool is full,
   * in which case the oldest particle is evicted so a burst never stalls).
   */
  spawn(opts: {
    x: number; y: number; z: number;
    vx?: number; vy?: number; vz?: number;
    life?: number; size?: number;
    r?: number; g?: number; b?: number;
    alpha?: number; gravity?: number; drag?: number;
    kind?: ParticleKind; grow?: number;
  }): Particle | null {
    let p = this.next();
    if (!p) {
      // Queue is saturated: recycle the oldest.
      p = this.pool[this.cursor];
      this.cursor = (this.cursor + 1) % MAX_PARTICLES;
    }
    p.active = true;
    p.x = opts.x; p.y = opts.y; p.z = opts.z;
    p.vx = opts.vx ?? 0; p.vy = opts.vy ?? 0; p.vz = opts.vz ?? 0;
    p.life = p.maxLife = Math.max(0.02, opts.life ?? 0.6);
    p.size = opts.size ?? 0.12;
    p.r = opts.r ?? 1; p.g = opts.g ?? 1; p.b = opts.b ?? 1;
    p.alpha = opts.alpha ?? 1;
    p.gravity = opts.gravity ?? 0;
    p.drag = opts.drag ?? 0;
    p.kind = opts.kind ?? 'normal';
    p.grow = opts.grow ?? 0;
    p.spin = 0;
    return p;
  }

  /** A short, sharp burst — the workhorse for hits, explosions and pickups. */
  burst(
    x: number, y: number, z: number, count: number,
    color: [number, number, number], opts: {
      speed?: number; life?: number; size?: number;
      gravity?: number; drag?: number; kind?: ParticleKind;
      spread?: number; upward?: number;
    } = {}
  ): void {
    const speed = opts.speed ?? 3;
    const life = opts.life ?? 0.5;
    const size = opts.size ?? 0.14;
    const gravity = opts.gravity ?? 6;
    const drag = opts.drag ?? 1.2;
    const kind = opts.kind ?? 'add';
    const spread = opts.spread ?? 1;
    const upward = opts.upward ?? 0.35;
    const [r, g, b] = color;
    for (let i = 0; i < count; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(Math.random() * (1 - upward) - upward);
      const s = speed * (0.35 + Math.random() * 0.75) * spread;
      const vx = Math.sin(phi) * Math.cos(theta) * s;
      const vy = Math.cos(phi) * s + speed * upward * 0.4;
      const vz = Math.sin(phi) * Math.sin(theta) * s;
      this.spawn({
        x, y, z, vx, vy, vz,
        life: life * (0.6 + Math.random() * 0.8),
        size: size * (0.6 + Math.random() * 0.9),
        r, g, b,
        alpha: 0.9,
        gravity, drag, kind,
        grow: -0.6,
      });
    }
  }

  update(dt: number): void {
    const pos = this.pos;
    const col = this.col;
    const size = this.size;
    const alpha = this.alpha;
    const kind = this.kind;
    let write = 0;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.pool[i];
      if (!p.active) continue;

      p.life -= dt;
      if (p.life <= 0) { p.active = false; continue; }

      // drag
      const dragFactor = Math.exp(-p.drag * dt);
      p.vx *= dragFactor;
      p.vy *= dragFactor;
      p.vz *= dragFactor;
      p.vy -= p.gravity * dt;

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;

      const t = p.life / p.maxLife;
      const a = Math.min(1, p.alpha * (t < 0.25 ? t / 0.25 : 1) * (t > 0.6 ? (1 - t) / 0.4 : 1));
      if (a <= 0.004) { p.active = false; continue; }

      const i3 = write * 3;
      pos[i3] = p.x; pos[i3 + 1] = p.y; pos[i3 + 2] = p.z;
      col[i3] = p.r; col[i3 + 1] = p.g; col[i3 + 2] = p.b;
      size[write] = Math.max(0.01, p.size * (1 + p.grow * (1 - t)));
      alpha[write] = a;
      kind[write] = p.kind === 'add' ? 1 : 0;
      write++;
    }

    this.geo.setDrawRange(0, write);
    const pa = this.geo.attributes.position as THREE.BufferAttribute;
    pa.needsUpdate = true;
    (this.geo.attributes.aColor as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aSize as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aAlpha as THREE.BufferAttribute).needsUpdate = true;
    (this.geo.attributes.aKind as THREE.BufferAttribute).needsUpdate = true;
  }

  get count(): number {
    let n = 0;
    for (const p of this.pool) if (p.active) n++;
    return n;
  }

  clear(): void {
    for (const p of this.pool) p.active = false;
    this.geo.setDrawRange(0, 0);
  }
}
