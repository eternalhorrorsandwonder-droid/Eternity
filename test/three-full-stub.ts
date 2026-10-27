/**
 * A three.js shim for the headless runtime test.
 *
 * The meshing, texture and world-generation layers are already verified by
 * `smoke`, `data-check` and `world-check`. What is *not* verified is the game
 * loop itself: that `Game.boot()` runs, that a scene attaches, that input
 * moves the player through collision, that mining drops items, that enemies
 * fight back, that a save round-trips.
 *
 * Running that in Node means three.js has to be replaced with something that
 * has the same shape without a GPU. This stub is deliberately faithful on the
 * parts the game logic reads — vectors do maths, geometry records its
 * attributes, `Object3D` keeps a real parent/child tree — and a no-op on the
 * parts only a GPU cares about. The point is that a crash inside the game loop
 * surfaces here rather than in a browser.
 */

export const REVISION = '0.161.0-stub';

// ---------------------------------------------------------------- constants

export const SRGBColorSpace = 'srgb';
export const LinearSRGBColorSpace = 'linear-srgb';
export const NoColorSpace = 'none';
export const FrontSide = 'front';
export const BackSide = 'back';
export const DoubleSide = 'double';
export const AdditiveBlending = 2;
export const NormalBlending = 1;
export const LinearFilter = 1006;
export const LinearMipmapLinearFilter = 1008;
export const ACESFilmicToneMapping = 4;
export const PCFSoftShadowMap = 2;
export const ShadowMapType = PCFSoftShadowMap;
export const RepeatWrapping = 1000;
export const ClampToEdgeWrapping = 1001;
export const UnsignedByteType = 1009;
export const FloatType = 1015;

// ---------------------------------------------------------------- maths

export class Vector2 {
  x = 0; y = 0;
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x: number, y: number): this { this.x = x; this.y = y; return this; }
  copy(v: Vector2): this { this.x = v.x; this.y = v.y; return this; }
  clone(): Vector2 { return new Vector2(this.x, this.y); }
  add(v: Vector2): this { this.x += v.x; this.y += v.y; return this; }
  multiplyScalar(s: number): this { this.x *= s; this.y *= s; return this; }
}

export class Vector3 {
  x = 0; y = 0; z = 0;
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x: number, y: number, z: number): this { this.x = x; this.y = y; this.z = z; return this; }
  setScalar(s: number): this { this.x = s; this.y = s; this.z = s; return this; }
  setX(x: number): this { this.x = x; return this; }
  setY(y: number): this { this.y = y; return this; }
  setZ(z: number): this { this.z = z; return this; }
  copy(v: Vector3): this { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
  clone(): Vector3 { return new Vector3(this.x, this.y, this.z); }
  add(v: Vector3): this { this.x += v.x; this.y += v.y; this.z += v.z; return this; }
  addVectors(a: Vector3, b: Vector3): this { return this.copy(a).add(b); }
  sub(v: Vector3): this { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; }
  subVectors(a: Vector3, b: Vector3): this { return this.copy(a).sub(b); }
  multiplyScalar(s: number): this { this.x *= s; this.y *= s; this.z *= s; return this; }
  divideScalar(s: number): this { return this.multiplyScalar(1 / s); }
  negate(): this { this.x = -this.x; this.y = -this.y; this.z = -this.z; return this; }
  dot(v: Vector3): number { return this.x * v.x + this.y * v.y + this.z * v.z; }
  cross(v: Vector3): this {
    const ax = this.x, ay = this.y, az = this.z;
    this.x = ay * v.z - az * v.y;
    this.y = az * v.x - ax * v.z;
    this.z = ax * v.y - ay * v.x;
    return this;
  }
  crossVectors(a: Vector3, b: Vector3): this { return this.copy(a).cross(b); }
  lengthSq(): number { return this.x * this.x + this.y * this.y + this.z * this.z; }
  length(): number { return Math.sqrt(this.lengthSq()); }
  distanceToSquared(v: Vector3): number {
    const dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }
  distanceTo(v: Vector3): number { return Math.sqrt(this.distanceToSquared(v)); }
  normalize(): this { return this.divideScalar(this.length() || 1); }
  lerp(v: Vector3, t: number): this {
    this.x += (v.x - this.x) * t; this.y += (v.y - this.y) * t; this.z += (v.z - this.z) * t;
    return this;
  }
  lerpVectors(a: Vector3, b: Vector3, t: number): this { return this.copy(a).lerp(b, t); }
  min(v: Vector3): this { this.x = Math.min(this.x, v.x); this.y = Math.min(this.y, v.y); this.z = Math.min(this.z, v.z); return this; }
  max(v: Vector3): this { this.x = Math.max(this.x, v.x); this.y = Math.max(this.y, v.y); this.z = Math.max(this.z, v.z); return this; }
  applyQuaternion(q: Quaternion): this {
    const x = this.x, y = this.y, z = this.z;
    const qx = q.x, qy = q.y, qz = q.z, qw = q.w;
    const ix = qw * x + qy * z - qz * y;
    const iy = qw * y + qz * x - qx * z;
    const iz = qw * z + qx * y - qy * x;
    const iw = -qx * x - qy * y - qz * z;
    this.x = ix * qw + iw * -qx + iy * -qz - iz * -qy;
    this.y = iy * qw + iw * -qy + iz * -qx - ix * -qz;
    this.z = iz * qw + iw * -qz + ix * -qy - iy * -qx;
    return this;
  }
  equals(v: Vector3): boolean { return this.x === v.x && this.y === v.y && this.z === v.z; }
  addScaledVector(v: Vector3, s: number): this { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; }
  addScaledVectors(a: Vector3, b: Vector3, s: number): this { return this.copy(a).addScaledVector(b, s); }
  subScalar(s: number): this { this.x -= s; this.y -= s; this.z -= s; return this; }
  multiplyVectors(a: Vector3, b: Vector3): this { return this.copy(a).multiply(b); }
  multiply(v: Vector3): this { this.x *= v.x; this.y *= v.y; this.z *= v.z; return this; }
  divide(v: Vector3): this { this.x /= v.x; this.y /= v.y; this.z /= v.z; return this; }
  applyMatrix4(m: Matrix4): this {
    const e = m.elements, x = this.x, y = this.y, z = this.z, w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15] || 1);
    this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w;
    this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w;
    this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
    return this;
  }
  applyAxisAngle(axis: Vector3, angle: number): this {
    const half = Math.sin(angle / 2), c = Math.cos(angle / 2), sx = axis.x * half, sy = axis.y * half, sz = axis.z * half;
    return this.applyQuaternion(new Quaternion(sx, sy, sz, c));
  }
  setFromMatrixPosition(m: Matrix4): this { const e = m.elements; this.x = e[12]; this.y = e[13]; this.z = e[14]; return this; }
  setFromMatrixScale(m: Matrix4): this {
    const e = m.elements;
    this.x = Math.hypot(e[0], e[1], e[2]);
    this.y = Math.hypot(e[4], e[5], e[6]);
    this.z = Math.hypot(e[8], e[9], e[10]);
    return this;
  }
  clampLength(min: number, max: number): this {
    const l = this.length();
    return l > max ? this.divideScalar(l / max) : l < min ? this.divideScalar(l / min) : this;
  }
  random(rnd: () => number = Math.random): this {
    const r1 = Math.sqrt(1 - rnd() + rnd());
    const r2 = rnd() * Math.PI * 2;
    this.x = r1 * Math.cos(r2); this.y = r1 * Math.sin(r2); this.z = rnd();
    return this;
  }
}

export class Euler {
  x = 0; y = 0; z = 0; order: 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'YZX' | 'XZY' = 'XYZ';
  constructor(x = 0, y = 0, z = 0, order: 'XYZ' | 'YXZ' | 'ZXY' | 'ZYX' | 'YZX' | 'XZY' = 'XYZ') {
    this.x = x; this.y = y; this.z = z; this.order = order;
  }
  set(x: number, y: number, z: number): this { this.x = x; this.y = y; this.z = z; return this; }
  copy(e: Euler): this { this.x = e.x; this.y = e.y; this.z = e.z; this.order = e.order; return this; }
  clone(): Euler { return new Euler(this.x, this.y, this.z, this.order); }
}

export class Quaternion {
  x = 0; y = 0; z = 0; w = 1;
  constructor(x = 0, y = 0, z = 0, w = 1) { this.x = x; this.y = y; this.z = z; this.w = w; }
  set(x: number, y: number, z: number, w: number): this { this.x = x; this.y = y; this.z = z; this.w = w; return this; }
  copy(q: Quaternion): this { this.x = q.x; this.y = q.y; this.z = q.z; this.w = q.w; return this; }
  clone(): Quaternion { return new Quaternion(this.x, this.y, this.z, this.w); }
  setFromEuler(e: Euler): this { this.x = Math.sin(e.x / 2) * Math.cos(e.y / 2) * Math.sin(e.z / 2) - Math.cos(e.x / 2) * Math.sin(e.y / 2) * Math.cos(e.z / 2); this.y = Math.cos(e.x / 2) * Math.sin(e.y / 2) * Math.sin(e.z / 2) + Math.sin(e.x / 2) * Math.cos(e.y / 2) * Math.cos(e.z / 2); this.z = Math.sin(e.x / 2) * Math.cos(e.y / 2) * Math.cos(e.z / 2) + Math.cos(e.x / 2) * Math.sin(e.y / 2) * Math.sin(e.z / 2); this.w = Math.cos(e.x / 2) * Math.cos(e.y / 2) * Math.cos(e.z / 2) - Math.sin(e.x / 2) * Math.sin(e.y / 2) * Math.sin(e.z / 2); return this; }
  multiply(q: Quaternion): this {
    const a = this, b = q;
    const x = a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y;
    const y = a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x;
    const z = a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w;
    this.w = a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z;
    this.x = x; this.y = y; this.z = z;
    return this;
  }
  normalize(): this {
    const l = Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z + this.w * this.w) || 1;
    this.x /= l; this.y /= l; this.z /= l; this.w /= l;
    return this;
  }
}

export class Matrix4 {
  elements = new Float32Array(16);
  constructor() { this.identity(); }
  identity(): this { this.elements.fill(0); this.elements[0] = this.elements[5] = this.elements[10] = this.elements[15] = 1; return this; }
  copy(m: Matrix4): this { this.elements.set(m.elements); return this; }
  clone(): Matrix4 { return new Matrix4().copy(this); }
  makeRotationFromQuaternion(q: Quaternion): this {
    const x = q.x, y = q.y, z = q.z, w = q.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const e = this.elements;
    e[0] = 1 - (yy + zz); e[4] = xy - wz; e[8] = xz + wy;
    e[1] = xy + wz; e[5] = 1 - (xx + zz); e[9] = yz - wx;
    e[2] = xz - wy; e[6] = yz + wx; e[10] = 1 - (xx + yy);
    e[3] = 0; e[7] = 0; e[11] = 0; e[12] = 0; e[13] = 0; e[14] = 0; e[15] = 1;
    return this;
  }
  compose(p: Vector3, q: Quaternion, s: Vector3): this {
    const e = this.elements;
    const x = q.x, y = q.y, z = q.z, w = q.w;
    const x2 = x + x, y2 = y + y, z2 = z + z;
    const xx = x * x2, xy = x * y2, xz = x * z2;
    const yy = y * y2, yz = y * z2, zz = z * z2;
    const wx = w * x2, wy = w * y2, wz = w * z2;
    const sx = s.x, sy = s.y, sz = s.z;
    e[0] = (1 - (yy + zz)) * sx; e[1] = (xy + wz) * sx; e[2] = (xz - wy) * sx; e[3] = 0;
    e[4] = (xy - wz) * sy; e[5] = (1 - (xx + zz)) * sy; e[6] = (yz + wx) * sy; e[7] = 0;
    e[8] = (xz + wy) * sz; e[9] = (yz - wx) * sz; e[10] = (1 - (xx + yy)) * sz; e[11] = 0;
    e[12] = p.x; e[13] = p.y; e[14] = p.z; e[15] = 1;
    return this;
  }
  multiply(m: Matrix4): this {
    const a = this.elements, b = m.elements, out = new Float32Array(16);
    for (let c = 0; c < 4; c++) {
      for (let r = 0; r < 4; r++) {
        out[r * 4 + c] = a[r * 4] * b[c] + a[r * 4 + 1] * b[c + 4] + a[r * 4 + 2] * b[c + 8] + a[r * 4 + 3] * b[c + 12];
      }
    }
    this.elements = out;
    return this;
  }
}

export class Color {
  r = 1; g = 1; b = 1;
  constructor(hex: number | string = 0xffffff) { this.set(hex); }
  set(hex: number | string): this {
    if (typeof hex === 'string') {
      const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
      if (m) this.setHex(parseInt(m[1], 16));
      else { const c = /^#?([0-9a-f]{3})$/i.exec(hex.trim()); if (c) this.setHex(parseInt(c[1] + c[1] + c[1].slice(1) + c[1].slice(1) + c[1].slice(1) + c[1].slice(1), 16)); }
    } else { this.setHex(hex); }
    return this;
  }
  setHex(hex: number): this { this.r = ((hex >> 16) & 255) / 255; this.g = ((hex >> 8) & 255) / 255; this.b = (hex & 255) / 255; return this; }
  setRGB(r: number, g: number, b: number): this { this.r = r; this.g = g; this.b = b; return this; }
  getHex(): number { return Math.round(this.r * 255) << 16 | Math.round(this.g * 255) << 8 | Math.round(this.b * 255); }
  copy(c: Color): this { this.r = c.r; this.g = c.g; this.b = c.b; return this; }
  clone(): Color { return new Color().copy(this); }
  lerp(c: Color, t: number): this {
    this.r += (c.r - this.r) * t; this.g += (c.g - this.g) * t; this.b += (c.b - this.b) * t;
    return this;
  }
  lerpColors(a: Color, b: Color, t: number): this { return this.copy(a).lerp(b, t); }
  multiplyScalar(s: number): this { this.r *= s; this.g *= s; this.b *= s; return this; }
  multiply(c: Color): this { this.r *= c.r; this.g *= c.g; this.b *= c.b; return this; }
  setHSL(h: number, s: number, l: number): this {
    if (s === 0) { this.r = this.g = this.b = l; return this; }
    const f = (n: number) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    };
    this.r = f(0); this.g = f(8); this.b = f(4);
    return this;
  }
  getHSL(target: { r: number; g: number; b: number }): { h: number; s: number; l: number } {
    const r = target.r, g = target.g, b = target.b;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const l = (max + min) / 2;
    if (max === min) return { h: 0, s: 0, l };
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h = 0;
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
    return { h, s, l };
  }
  offsetHSL(h: number, s: number, l: number): this {
    const c = this.getHSL(this);
    return this.setHSL(c.h + h, Math.min(1, Math.max(0, c.s + s)), Math.min(1, Math.max(0, c.l + l)));
  }
  clamp(): this { return this; }
  equals(c: Color): boolean { return this.r === c.r && this.g === c.g && this.b === c.b; }
  getHSLHelper(): { h: number; s: number; l: number } { return this.getHSL(this); }
}

export class Fog {
  color: Color; near: number; far: number;
  constructor(color: number, near: number, far: number) { this.color = new Color(color); this.near = near; this.far = far; }
}

// ---------------------------------------------------------------- attributes

export class BufferAttribute {
  array: ArrayLike<number> | ArrayBufferView;
  itemSize: number;
  count: number;
  needsUpdate = false;
  usage = 35048;
  constructor(array: ArrayLike<number> | ArrayBufferView, itemSize: number) {
    this.array = array;
    this.itemSize = itemSize;
    this.count = (array as ArrayLike<number>).length / itemSize;
  }
  setUsage(u: number): this { this.usage = u; return this; }
  set(i: number, x: number): this { (this.array as number[])[i] = x; return this; }
  copyAt(dst: number, src: number): this { (this.array as number[])[dst] = (this.array as number[])[src]; return this; }
}

export class BufferGeometry {
  attributes: Record<string, BufferAttribute> = {};
  index: BufferAttribute | null = null;
  drawRange = { start: 0, count: Infinity };
  boundingSphere: { radius: number } | null = null;
  computeBoundingSphere(): void {
    let max = 0;
    const pos = this.attributes.position;
    if (!pos) { this.boundingSphere = { radius: 0 }; return; }
    const a = pos.array as number[];
    for (let i = 0; i < a.length; i += 3) max = Math.max(max, a[i] * a[i] + a[i + 1] * a[i + 1] + a[i + 2] * a[i + 2]);
    this.boundingSphere = { radius: Math.sqrt(max) };
  }
  computeBoundingBox(): void { /* not needed headless */ }
  setAttribute(name: string, attr: BufferAttribute): this { this.attributes[name] = attr; return this; }
  getAttribute(name: string): BufferAttribute | undefined { return this.attributes[name]; }
  setIndex(attr: BufferAttribute): this { this.index = attr; return this; }
  rotateX(): this { return this; }
  rotateY(): this { return this; }
  rotateZ(): this { return this; }
  translate(): this { return this; }
  scale(): this { return this; }
  setDrawRange(start: number, count: number): this { this.drawRange = { start, count }; return this; }
  getDrawRange() { return this.drawRange; }
  deleteAttribute(name: string): this { delete this.attributes[name]; return this; }
  setUsage(_u: number): this { return this; }
  addGroup(): this { return this; }
  dispose(): void { /* nothing to free */ }
}

class GeometryStub extends BufferGeometry {}
export class BoxGeometry extends GeometryStub {
  constructor(w = 1, h = 1, d = 1) { super(); void w; void h; void d; }
}
export class PlaneGeometry extends GeometryStub {
  constructor(w = 1, h = 1, ws = 1, hs = 1) { super(); void w; void h; void ws; void hs; }
}
export class SphereGeometry extends GeometryStub {
  constructor(r = 1, ws = 8, hs = 6) { super(); void r; void ws; void hs; }
}
export class CylinderGeometry extends GeometryStub {
  constructor(rt = 1, rb = 1, h = 1, rs = 8) { super(); void rt; void rb; void h; void rs; }
}
export class ConeGeometry extends GeometryStub {
  constructor(r = 1, h = 1, rs = 8) { super(); void r; void h; void rs; }
}
export class TorusGeometry extends GeometryStub {
  constructor(r = 1, t = 0.4, rs = 8, ts = 8) { super(); void r; void t; void rs; void ts; }
}
export class IcosahedronGeometry extends GeometryStub {
  constructor(r = 1) { super(); void r; }
}

// ---------------------------------------------------------------- materials

export class Material {
  transparent = false;
  opacity = 1;
  depthWrite = true;
  depthTest = true;
  side: string = FrontSide;
  blending = NormalBlending;
  map: Texture | null = null;
  color = new Color(0xffffff);
  needsUpdate = false;
  visible = true;
  vertexColors = false;
  alphaTest = 0;
  toneMapped = true;
  constructor(params: any = {}) {
    Object.assign(this, params);
    // three.js accepts a hex number or a string where a `Color` is expected;
    // normalise that here so `.setHex()` works either way.
    for (const key of ['color', 'emissive', 'specular', 'groundColor', 'skyColor']) {
      const v = (params as any)[key];
      if (typeof v === 'number' || typeof v === 'string') (this as any)[key] = new Color(v);
    }
  }
  dispose(): void { /* nothing to free */ }
  copy(m: Material): this { Object.assign(this, m); return this; }
  clone(): Material { return new Material().copy(this); }
}

export class MeshLambertMaterial extends Material {}
export class MeshBasicMaterial extends Material {}
export class MeshStandardMaterial extends Material {}
export class MeshPhongMaterial extends Material {}
export class SpriteMaterial extends Material { rotation = 0; }

export class ShaderMaterial extends Material {
  uniforms: Record<string, any> = {};
  vertexShader = '';
  fragmentShader = '';
  constructor(params: any = {}) {
    super(params);
    this.uniforms = params.uniforms || {};
    this.vertexShader = params.vertexShader || '';
    this.fragmentShader = params.fragmentShader || '';
  }
}

// ---------------------------------------------------------------- textures

export class Texture {
  image: any = null;
  wrapS = RepeatWrapping;
  wrapT = RepeatWrapping;
  magFilter = LinearFilter;
  minFilter = LinearFilter;
  generateMipmaps = true;
  anisotropy = 1;
  colorSpace = SRGBColorSpace;
  flipY = true;
  needsUpdate = false;
  constructor(image: any = null) { this.image = image; }
  dispose(): void { /* nothing to free */ }
  clone(): Texture { return new Texture(this.image).copy(this); }
  copy(t: Texture): this { this.wrapS = t.wrapS; this.wrapT = t.wrapT; this.magFilter = t.magFilter; this.minFilter = t.minFilter; return this; }
}

export class CanvasTexture extends Texture {
  constructor(canvas: any) { super(canvas); }
}

// ---------------------------------------------------------------- objects

export class Object3D {
  position = new Vector3();
  rotation = new Euler();
  quaternion = new Quaternion();
  scale = new Vector3(1, 1, 1);
  up = new Vector3(0, 1, 0);
  children: Object3D[] = [];
  parent: Object3D | null = null;
  visible = true;
  userData: Record<string, any> = {};
  matrix = new Matrix4();
  matrixWorld = new Matrix4();
  layers = { set: () => {}, test: () => true, enable: () => {}, mask: 1 };

  add(...objs: Object3D[]): this {
    for (const o of objs) {
      if (o.parent) o.parent.remove(o);
      o.parent = this;
      this.children.push(o);
    }
    return this;
  }
  remove(...objs: Object3D[]): this {
    for (const o of objs) {
      const i = this.children.indexOf(o);
      if (i >= 0) this.children.splice(i, 1);
      o.parent = null;
    }
    return this;
  }
  /** Depth-first walk, including this node. */
  traverse(cb: (o: Object3D) => void): void {
    cb(this);
    for (const c of [...this.children]) c.traverse(cb);
  }
  traverseVisible(cb: (o: Object3D) => void): void {
    if (!this.visible) return;
    cb(this);
    for (const c of [...this.children]) c.traverseVisible(cb);
  }
  lookAt(_x: number, _y: number, _z: number): void { /* no-op */ }
  updateMatrixWorld(_force = false): void {
    this.matrix.compose(this.position, this.quaternion, this.scale);
    this.matrixWorld.copy(this.matrix);
    for (const c of this.children) c.updateMatrixWorld();
  }
  applyQuaternion(q: Quaternion): this { this.quaternion.copy(q); return this; }
  getWorldPosition(target: Vector3): Vector3 { return target.copy(this.position); }
  clone(rec = true): Object3D {
    const o = new Object3D();
    o.copy(this, rec);
    return o;
  }
  copy(src: Object3D, rec = true): this {
    this.position.copy(src.position);
    this.rotation.copy(src.rotation);
    this.quaternion.copy(src.quaternion);
    this.scale.copy(src.scale);
    this.visible = src.visible;
    this.userData = { ...src.userData };
    if (rec) this.children = src.children.map((c) => c.clone(true));
    return this;
  }
}

export class Group extends Object3D {}

export class Scene extends Object3D {
  fog: Fog | null = null;
  background: Color | Texture | null = null;
  /** A colour is accepted as a hex number too. */
  setBackground(v: any): void { this.background = typeof v === 'number' || typeof v === 'string' ? new Color(v) : v; }
  overrideMaterial: Material | null = null;
  environment: Texture | null = null;
}

export class Mesh extends Object3D {
  geometry: BufferGeometry;
  material: Material;
  constructor(geometry: BufferGeometry, material: Material) {
    super();
    this.geometry = geometry;
    this.material = material;
  }
  clone(): Mesh { return new Mesh(this.geometry, this.material).copy(this); }
  dispose(): void { this.geometry.dispose(); }
}

export class Sprite extends Object3D {
  material: Material;
  constructor(material: Material) { super(); this.material = material; }
}

export class Points extends Object3D {
  geometry: BufferGeometry;
  material: Material;
  constructor(geometry: BufferGeometry, material: Material) {
    super();
    this.geometry = geometry;
    this.material = material;
  }
}

export class Light extends Object3D {
  intensity = 1;
  color = new Color(0xffffff);
  constructor(color: number, intensity: number) { super(); this.color = new Color(color); this.intensity = intensity; }
}
export class AmbientLight extends Light {}
export class HemisphereLight extends Light {
  groundColor = new Color(0x000000);
  constructor(sky: number, ground: number, intensity: number) {
    super(sky, intensity);
    this.groundColor = new Color(ground);
  }
}
export class DirectionalLight extends Light {
  target = new Object3D();
  shadow = { mapSize: { width: 1024, height: 1024 }, camera: new Object3D(), bias: 0, normalBias: 0 };
  constructor(color: number, intensity: number) { super(color, intensity); }
}
export class PointLight extends Light {
  distance = 0; decay = 2;
  constructor(color: number, intensity: number, distance = 0, decay = 2) { super(color, intensity); this.distance = distance; this.decay = decay; }
}

export class Camera extends Object3D {
  projectionMatrix = new Matrix4();
  matrixWorldInverse = new Matrix4();
  updateProjectionMatrix(): void {}
  /** Direction the camera is looking, derived from its yaw/pitch rotation. */
  getWorldDirection(target: Vector3): Vector3 {
    const e = this.rotation;
    const cy = Math.cos(e.y), sy = Math.sin(e.y);
    const cx = Math.cos(e.x), sx = Math.sin(e.x);
    target.set(-sy * cx, sx, -cy * cx).normalize();
    return target;
  }
}

export class PerspectiveCamera extends Camera {
  fov = 60; aspect = 1; near = 0.1; far = 1000;
  constructor(fov = 60, aspect = 1, near = 0.1, far = 1000) { super(); this.fov = fov; this.aspect = aspect; this.near = near; this.far = far; }
  updateProjectionMatrix(): void {}
}

export class OrthographicCamera extends Camera {
  left = -1; right = 1; top = 1; bottom = -1; near = 0.1; far = 1000;
  constructor(l = -1, r = 1, t = 1, b = -1, n = 0.1, f = 1000) { super(); this.left = l; this.right = r; this.top = t; this.bottom = b; this.near = n; this.far = f; }
}

export class Raycaster {
  ray = { origin: new Vector3(), direction: new Vector3() };
  set(origin: Vector3, direction: Vector3): void { this.ray.origin.copy(origin); this.ray.direction.copy(direction); }
}

export class GridHelper extends Object3D {
  constructor(size: number, divisions: number, color1: number, color2: number) {
    super(); void size; void divisions; void color1; void color2;
  }
}

export class Clock {
  elapsedTime = 0;
  getDelta(): number { return 0; }
  getElapsedTime(): number { return this.elapsedTime; }
  start(): void {}
}

export class Frustum {
  intersectsObject(_o: Object3D): boolean { return true; }
}

// ---------------------------------------------------------------- renderer

export class WebGLRenderer {
  domElement: any;
  shadowMap = { enabled: false, type: PCFSoftShadowMap, needsUpdate: false };
  outputColorSpace = SRGBColorSpace;
  toneMapping = ACESFilmicToneMapping;
  toneMappingExposure = 1;
  info = { render: { calls: 0, triangles: 0 }, memory: { geometries: 0, textures: 0 } };
  private width = 800;
  private height = 450;
  private pixelRatio = 1;

  constructor(params: any = {}) {
    void params;
    const canvas = (globalThis as any).document?.createElement?.('canvas');
    if (!canvas) throw new Error('WebGLRenderer stub needs a DOM document with createElement');
    canvas.width = 800; canvas.height = 450;
    this.domElement = canvas;
  }

  setSize(w: number, h: number): void { this.width = w; this.height = h; this.domElement.width = w; this.domElement.height = h; }
  setPixelRatio(r: number): void { this.pixelRatio = r; }
  getPixelRatio(): number { return this.pixelRatio; }
  getDrawingBufferSize(): Vector2 { return new Vector2(this.width, this.height); }
  setClearColor(_c: number): void {}
  clear(): void {}
  render(_scene: Scene, _camera: Camera): void {}
  compile(_scene: Scene): void {}
  dispose(): void {}
  getContext(): any { return {}; }
  forceContextLoss(): void {}
  setAnimationLoop(_fn: any): void {}
}

/** Build a stub namespace so `import * as THREE from 'three'` works via alias. */
const THREE = {
  REVISION,
  SRGBColorSpace, LinearSRGBColorSpace, NoColorSpace, FrontSide, BackSide, DoubleSide,
  AdditiveBlending, NormalBlending, LinearFilter, LinearMipmapLinearFilter,
  ACESFilmicToneMapping, PCFSoftShadowMap, ShadowMapType, RepeatWrapping, ClampToEdgeWrapping,
  UnsignedByteType, FloatType,
  Vector2, Vector3, Euler, Quaternion, Matrix4, Color, Fog,
  BufferAttribute, BufferGeometry, BoxGeometry, PlaneGeometry, SphereGeometry,
  CylinderGeometry, ConeGeometry, TorusGeometry, IcosahedronGeometry,
  Material, MeshLambertMaterial, MeshBasicMaterial, MeshStandardMaterial, MeshPhongMaterial,
  SpriteMaterial, ShaderMaterial,
  Texture, CanvasTexture,
  Object3D, Group, Scene, Mesh, Sprite, Points,
  Light, AmbientLight, HemisphereLight, DirectionalLight, PointLight,
  Camera, PerspectiveCamera, OrthographicCamera, Raycaster, GridHelper, Clock, Frustum,
  WebGLRenderer,
};

export default THREE;
export const THREENamespace = THREE;
export { THREE };
