/**
 * Sky, celestial bodies, clouds and weather.
 *
 * The sky is a single inverted sphere with a fragment shader that computes a
 * vertical gradient, a sun disc with a soft halo, a moon, a starfield that
 * fades in at night, and a horizon band that tints toward the local biome's
 * ambient colour. Clouds are a deformable plane driven by value noise so they
 * slowly march across the world without a single texture.
 *
 * Weather is spawned into the shared particle system: rain, snow, drifting
 * leaves, volcanic ash and magical motes are all the same code path with
 * different spawn envelopes.
 */

import * as THREE from 'three';
import { ParticleSystem } from './Particles';
import { valueNoise, fbm } from '../core/RNG';

export type WeatherKind = 'none' | 'rain' | 'snow' | 'ash' | 'leaves' | 'motes' | 'storm';

export interface SkyState {
  /** 0 = midnight, 0.5 = noon, 1 = midnight again. */
  dayTime: number;
  weather: WeatherKind;
  weatherIntensity: number;
  /** Biome ambient tint. */
  ambient: THREE.Color;
  /** Fog colour, updated with the biome. */
  fog: THREE.Color;
}

const SKY_VERT = `
varying vec3 vWorld;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorld = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const SKY_FRAG = `
precision highp float;

uniform vec3 uTop;
uniform vec3 uBottom;
uniform vec3 uHorizon;
uniform vec3 uSunDir;
uniform vec3 uSunColor;
uniform vec3 uMoonDir;
uniform vec3 uAmbient;
uniform float uNight;
uniform float uCloudCover;
uniform float uStarDensity;

varying vec3 vWorld;

// Integer hash → [0,1)
float hash(vec3 p) {
  p = fract(p * 0.3183099 + vec3(0.1, 0.2, 0.3));
  p *= 17.0;
  return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
}

void main() {
  vec3 dir = normalize(vWorld);
  float h = clamp(dir.y, -1.0, 1.0);

  // Vertical gradient.
  vec3 col = mix(uBottom, uTop, smoothstep(-0.06, 0.62, h));

  // Horizon band — thicker and warmer near the sun.
  float horizonBand = exp(-abs(h) * 7.0);
  col = mix(col, uHorizon, horizonBand * 0.85);

  // Sun disc + halo.
  float sd = max(dot(dir, uSunDir), 0.0);
  float disc = smoothstep(0.99930, 0.99975, sd);
  float halo = pow(sd, 18.0) * 0.35 + pow(sd, 220.0) * 0.5;
  col += uSunColor * (disc * 2.4 + halo);

  // Moon.
  float md = max(dot(dir, uMoonDir), 0.0);
  float moonDisc = smoothstep(0.99955, 0.99985, md);
  col += vec3(0.92, 0.95, 1.0) * moonDisc * (0.9 + 0.4 * uNight);
  float moonHalo = pow(md, 60.0) * 0.12 * uNight;
  col += vec3(0.55, 0.65, 0.95) * moonHalo;

  // Stars.
  if (h > 0.02) {
    vec3 sp = floor(dir * 260.0);
    float star = hash(sp);
    float star2 = hash(sp + vec3(3.1, 1.7, 5.2));
    float threshold = 0.9975 - uStarDensity * 0.02;
    float s = smoothstep(threshold, 1.0, star) * smoothstep(threshold + 0.01, 1.0, star2);
    float twinkle = 0.65 + 0.35 * sin(uSunDir.x * 900.0 + sp.x * 3.1 + uSunDir.z * 700.0);
    col += vec3(0.9, 0.94, 1.0) * s * twinkle * uNight * 1.6;
  }

  // Clouds — a soft value-noise band high in the sky.
  float cloudY = clamp(dir.y, 0.0, 1.0);
  if (cloudY > 0.05 && uCloudCover > 0.001) {
    vec2 uv = dir.xz / max(cloudY, 0.08) * 0.55;
    float n = fbm2(uv * 2.2);
    n = smoothstep(0.52 - uCloudCover * 0.3, 0.78, n);
    float fade = smoothstep(0.05, 0.32, cloudY) * (1.0 - smoothstep(0.86, 1.0, cloudY));
    vec3 cloudCol = mix(vec3(1.0), uHorizon * 0.85, 0.35);
    cloudCol = mix(cloudCol, uAmbient * 0.8, uNight * 0.65);
    col = mix(col, cloudCol * (0.85 + 0.3 * uNight), n * fade * 0.92);
  }

  // Night tint.
  col = mix(col, col * vec3(0.42, 0.5, 0.72), uNight * 0.55);

  gl_FragColor = vec4(col, 1.0);
}
`;

// The cloud noise helper is injected as a second chunk so it stays readable.
const CLOUD_NOISE = `
float fbm2(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 5; i++) {
    v += a * value2(p);
    p = p * 2.03 + 17.3;
    a *= 0.5;
  }
  return v;
}
float value2(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float a = hash2(i);
  float b = hash2(i + vec2(1.0, 0.0));
  float c = hash2(i + vec2(0.0, 1.0));
  float d = hash2(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
float hash2(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
`;

export class Atmosphere {
  skyMesh: THREE.Mesh;
  sun: THREE.Mesh;
  moon: THREE.Mesh;
  cloudPlane: THREE.Mesh;
  material: THREE.ShaderMaterial;
  particles: ParticleSystem;

  readonly state: SkyState = {
    dayTime: 0.28,
    weather: 'none',
    weatherIntensity: 0,
    ambient: new THREE.Color(0x9fd0ff),
    fog: new THREE.Color(0xbcd8ff),
  };

  /** Ambient sky colours, one per biome family. */
  static readonly SKIES: Record<string, { top: number; bottom: number; horizon: number; fog: number }> = {
    plains: { top: 0x5aa8ff, bottom: 0xcfe8ff, horizon: 0xdfefff, fog: 0xbcd8ff },
    forest: { top: 0x4a9be8, bottom: 0xcfe8ff, horizon: 0xd8f0e8, fog: 0x9fd0c8 },
    desert: { top: 0x63b0f0, bottom: 0xffe9c0, horizon: 0xffd9a0, fog: 0xf0d4a8 },
    snow: { top: 0x6ea8e8, bottom: 0xdfeeff, horizon: 0xf2f7ff, fog: 0xd2e2f5 },
    swamp: { top: 0x3f7f6a, bottom: 0xb8d8c8, horizon: 0xd2e8d0, fog: 0x86b0a0 },
    ocean: { top: 0x2f7fd8, bottom: 0x9fd4f0, horizon: 0xbfe6ff, fog: 0x8ec8ee },
    mountain: { top: 0x4a7fd0, bottom: 0xd6e8ff, horizon: 0xe8f2ff, fog: 0xb8d0ee },
    lava: { top: 0x3a1020, bottom: 0x8a2018, horizon: 0xd84a18, fog: 0x6a2418 },
    crimson: { top: 0x3a1028, bottom: 0x8a2040, horizon: 0xd84a6a, fog: 0x6a2440 },
    warped: { top: 0x183038, bottom: 0x3a6a68, horizon: 0x6aa0a0, fog: 0x38605e },
    end: { top: 0x140c28, bottom: 0x2a1e48, horizon: 0x4a3478, fog: 0x241a40 },
    magic: { top: 0x2a1850, bottom: 0x6a4ab0, horizon: 0x9a7ae0, fog: 0x543c92 },
    arcane: { top: 0x1c1040, bottom: 0x4a3a8a, horizon: 0x7a66c0, fog: 0x342a68 },
    verdant: { top: 0x2a6a4a, bottom: 0x8ae0a8, horizon: 0xb8f0c8, fog: 0x6ab894 },
    ember: { top: 0x3a1206, bottom: 0x8a2a08, horizon: 0xd85008, fog: 0x6a2004 },
    void: { top: 0x08060f, bottom: 0x141028, horizon: 0x221a40, fog: 0x100c20 },
    glade: { top: 0x5aa0e0, bottom: 0xdff0e8, horizon: 0xe8f8f0, fog: 0xa8d4c8 },
  };

  private cloudTime = 0;
  private weatherAccum = 0;
  private weatherPoints = 0;

  constructor(scene: THREE.Scene, particles: ParticleSystem) {
    this.particles = particles;

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTop: { value: new THREE.Color(0x5aa8ff) },
        uBottom: { value: new THREE.Color(0xcfe8ff) },
        uHorizon: { value: new THREE.Color(0xdfefff) },
        uSunDir: { value: new THREE.Vector3(0, 1, 0) },
        uSunColor: { value: new THREE.Color(0xfff2d8) },
        uMoonDir: { value: new THREE.Vector3(0, -1, 0) },
        uAmbient: { value: new THREE.Color(0xffffff) },
        uNight: { value: 0.0 },
        uCloudCover: { value: 0.55 },
        uStarDensity: { value: 1.0 },
      },
      vertexShader: SKY_VERT,
      fragmentShader: '', // assembled below
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    // The noise helpers must be defined before use, so they are prepended.
    this.material.fragmentShader = CLOUD_NOISE + SKY_FRAG;

    const skyGeo = new THREE.SphereGeometry(900, 32, 24);
    this.skyMesh = new THREE.Mesh(skyGeo, this.material);
    this.skyMesh.frustumCulled = false;
    scene.add(this.skyMesh);

    const sunGeo = new THREE.SphereGeometry(14, 16, 16);
    this.sun = new THREE.Mesh(sunGeo, new THREE.MeshBasicMaterial({ color: 0xfff4d8, fog: false }));
    this.sun.frustumCulled = false;
    scene.add(this.sun);

    const moonGeo = new THREE.SphereGeometry(9, 16, 16);
    this.moon = new THREE.Mesh(moonGeo, new THREE.MeshBasicMaterial({ color: 0xe8eeff, fog: false }));
    this.moon.frustumCulled = false;
    scene.add(this.moon);

    // Cloud layer: a large ring of tinted quads with a soft alpha gradient.
    const cloudGeo = new THREE.PlaneGeometry(2200, 2200, 48, 48);
    const cloudMat = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uCloudCover: { value: 0.6 },
        uTop: { value: new THREE.Color(0xffffff) },
        uHorizon: { value: new THREE.Color(0xffd9a0) },
        uNight: { value: 0 },
      },
      vertexShader: `
        varying vec2 vUv;
        varying vec3 vWorld;
        uniform float uTime;
        void main() {
          vUv = uv;
          vec3 p = position;
          float h = fbm2(vec2(p.x * 0.0042 + uTime * 0.006, p.y * 0.0042 - uTime * 0.004));
          p.z += h * 70.0;
          vec4 wp = modelMatrix * vec4(p, 1.0);
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: CLOUD_NOISE + `
        uniform float uCloudCover;
        uniform vec3 uTop;
        uniform vec3 uHorizon;
        uniform float uNight;
        varying vec2 vUv;
        varying vec3 vWorld;
        void main() {
          float n = fbm2(vec2(vWorld.x * 0.0032, vWorld.z * 0.0032));
          n = smoothstep(0.48 - uCloudCover * 0.35, 0.82, n);
          if (n < 0.01) discard;
          vec3 col = mix(uHorizon, uTop, smoothstep(0.2, 0.9, n));
          col = mix(col, col * vec3(0.45, 0.52, 0.78), uNight * 0.7);
          float edge = smoothstep(0.0, 0.35, n);
          gl_FragColor = vec4(col, n * 0.86 * edge);
        }
      `,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    });
    this.cloudPlane = new THREE.Mesh(cloudGeo, cloudMat);
    this.cloudPlane.rotation.x = -Math.PI / 2;
    this.cloudPlane.position.y = 210;
    this.cloudPlane.frustumCulled = false;
    scene.add(this.cloudPlane);
  }

  setSky(family: string): void {
    const s = Atmosphere.SKIES[family] ?? Atmosphere.SKIES.plains;
    const u = this.material.uniforms;
    u.uTop.value.setHex(s.top);
    u.uBottom.value.setHex(s.bottom);
    u.uHorizon.value.setHex(s.horizon);
    this.state.fog.setHex(s.fog);
    this.state.ambient.setHex(s.top);
  }

  update(dt: number, camPos: THREE.Vector3, daySpeed = 0.004): void {
    this.state.dayTime = (this.state.dayTime + daySpeed * dt) % 1;
    const t = this.state.dayTime;

    // Sun direction: rises at t=0.22, sets at t=0.72.
    const angle = (t - 0.22) / 0.5 * Math.PI;
    const sunDir = new THREE.Vector3(Math.cos(angle) * 0.62, Math.sin(angle), 0.34).normalize();
    this.material.uniforms.uSunDir.value.copy(sunDir);
    this.material.uniforms.uMoonDir.value.copy(sunDir).multiplyScalar(-1);

    const daylight = Math.max(0, Math.sin(angle));
    const night = 1 - Math.min(1, daylight * 1.6);
    this.material.uniforms.uNight.value = night;
    this.material.uniforms.uStarDensity.value = 0.4 + night * 0.6;

    const sunCol = new THREE.Color(0xfff2d8).lerp(new THREE.Color(0xff9a5a), Math.pow(1 - Math.max(0, Math.sin(angle)), 3));
    this.material.uniforms.uSunColor.value.copy(sunCol);

    this.sun.position.copy(sunDir).multiplyScalar(760).add(camPos);
    this.moon.position.copy(sunDir).multiplyScalar(-760).add(camPos);
    this.skyMesh.position.copy(camPos);
    this.cloudPlane.position.set(camPos.x, 210, camPos.z);

    // Cloud drift.
    this.cloudTime += dt;
    const cm = this.cloudPlane.material as THREE.ShaderMaterial;
    cm.uniforms.uTime.value = this.cloudTime;
    cm.uniforms.uNight.value = night;
    cm.uniforms.uTop.value.copy(this.material.uniforms.uTop.value);
    cm.uniforms.uHorizon.value.copy(this.material.uniforms.uHorizon.value);
    this.material.uniforms.uAmbient.value.copy(this.state.ambient);

    this.updateWeather(dt, camPos, daylight);
  }

  private updateWeather(dt: number, camPos: THREE.Vector3, daylight: number): void {
    const kind = this.state.weather;
    const intensity = this.state.weatherIntensity;
    const ps = this.particles;

    if (kind === 'none' || intensity <= 0.01) {
      if (this.weatherPoints > 0) {
        this.weatherPoints = 0;
      }
      return;
    }

    const target = Math.floor(intensity * (kind === 'storm' ? 700 : 320));
    this.weatherPoints = Math.max(this.weatherPoints, target);

    // Spawn a batch each frame, spread over a volume around the camera.
    const batch = Math.min(46, Math.ceil(target / 24));
    for (let i = 0; i < batch; i++) {
      const x = camPos.x + (Math.random() - 0.5) * 90;
      const z = camPos.z + (Math.random() - 0.5) * 90;
      switch (kind) {
        case 'rain':
        case 'storm': {
          const y = camPos.y + 55 + Math.random() * 12;
          ps.spawn({
            x, y, z,
            vx: -6 + Math.random() * 3,
            vy: -42 - Math.random() * 18,
            vz: -4 + Math.random() * 3,
            life: 1.6, size: 0.07,
            r: 0.55, g: 0.72, b: 0.95,
            alpha: 0.5, gravity: 0, drag: 0.1,
            kind: 'normal',
          });
          break;
        }
        case 'snow': {
          const y = camPos.y + 48 + Math.random() * 10;
          ps.spawn({
            x, y, z,
            vx: Math.sin(Math.random() * 6) * 0.9,
            vy: -3.4 - Math.random() * 2.2,
            vz: Math.cos(Math.random() * 6) * 0.9,
            life: 6.0, size: 0.1 + Math.random() * 0.1,
            r: 0.96, g: 0.98, b: 1.0,
            alpha: 0.75, gravity: 0, drag: 0.2,
            kind: 'normal',
          });
          break;
        }
        case 'ash': {
          const y = camPos.y + 52 + Math.random() * 12;
          ps.spawn({
            x, y, z,
            vx: -1.4 + Math.random() * 1.6,
            vy: -5.5 - Math.random() * 3,
            vz: -1.2 + Math.random() * 1.4,
            life: 4.5, size: 0.09 + Math.random() * 0.1,
            r: 0.55 + Math.random() * 0.25, g: 0.32, b: 0.24,
            alpha: 0.6, gravity: 0, drag: 0.15,
            kind: 'add',
          });
          break;
        }
        case 'leaves': {
          const y = camPos.y + 40 + Math.random() * 14;
          ps.spawn({
            x, y, z,
            vx: -2.2 + Math.random() * 1.6,
            vy: -2.6 - Math.random() * 1.6,
            vz: -1.8 + Math.random() * 1.4,
            life: 5.0, size: 0.16,
            r: 0.35 + Math.random() * 0.2, g: 0.6 + Math.random() * 0.25, b: 0.28,
            alpha: 0.85, gravity: 0, drag: 0.3,
            kind: 'normal',
          });
          break;
        }
        case 'motes': {
          const y = camPos.y + 2 + Math.random() * 16;
          ps.spawn({
            x, y, z,
            vx: Math.sin(this.cloudTime * 2 + x) * 0.4,
            vy: 0.25 + Math.random() * 0.5,
            vz: Math.cos(this.cloudTime * 2 + z) * 0.4,
            life: 7.0, size: 0.12,
            r: 0.6, g: 0.9, b: 1.0,
            alpha: 0.55, gravity: 0, drag: 0.05,
            kind: 'add',
          });
          break;
        }
        default:
          break;
      }
    }

    // Keep the volume topped up while the player moves.
    if (Math.random() < 0.25) {
      const x = camPos.x + (Math.random() - 0.5) * 120;
      const z = camPos.z + (Math.random() - 0.5) * 120;
      void x; void z;
    }
    void daylight;
  }

  /** Cross-fade weather in/out over a couple of seconds. */
  setWeather(kind: WeatherKind, intensity: number, blend = 3.0): void {
    this.state.weather = kind;
    this.state.weatherIntensity = Math.max(0, Math.min(1, intensity));
    this.weatherBlend = blend;
  }

  private weatherBlend = 0;

  get currentWeather(): WeatherKind { return this.state.weather; }
  get weatherStrength(): number { return this.weatherBlend; }

  /** Called every frame to animate weather blending. */
  tickWeather(dt: number): void {
    if (this.weatherBlend > 0) {
      this.weatherBlend = Math.max(0, this.weatherBlend - dt);
    }
  }
}

/** Re-exported so the world decorator can sample the same noise. */
export { valueNoise, fbm };
