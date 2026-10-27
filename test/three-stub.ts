// Minimal THREE shim so engine modules can be exercised under Node.
class BufferAttribute {
  constructor(public array: any, public itemSize: number) {}
  get needsUpdate() { return false; }
  set needsUpdate(_v: boolean) {}
  subarray(a: number, b: number) { return this.array.subarray(a, b); }
  count = 0;
}
class BufferGeometry {
  attributes: Record<string, BufferAttribute> = {};
  index: BufferAttribute | null = null;
  drawRange = { start: 0, count: Infinity };
  setAttribute(name: string, a: BufferAttribute) { this.attributes[name] = a; return this; }
  setIndex(a: BufferAttribute) { this.index = a; return this; }
  computeBoundingSphere() {}
  dispose() {}
}
const THREE: any = {
  BufferAttribute, BufferGeometry,
  Vector3: class { constructor(public x = 0, public y = 0, public z = 0) {} },
  Color: class { setHex() {} copy() { return this; } multiplyScalar() { return this; } lerp() { return this; } },
  Euler: class { x = 0; y = 0; z = 0; set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; } copy(e: any) { this.x = e.x; this.y = e.y; this.z = e.z; } },
  Group: class { position: any = { set() {} }; rotation: any = { set() {} }; add() {} remove() {} },
  Mesh: class { constructor(public geometry: any, public material: any) {} },
  BoxGeometry: class { constructor(..._a: any[]) {} },
  SphereGeometry: class { constructor(..._a: any[]) {} },
  PlaneGeometry: class { constructor(..._a: any[]) {} },
  MeshLambertMaterial: class { constructor(o: any) { Object.assign(this, o); } },
  MeshBasicMaterial: class { constructor(o: any) { Object.assign(this, o); } },
  ShaderMaterial: class { constructor(o: any) { Object.assign(this, o); this.uniforms = o.uniforms; } },
  CanvasTexture: class { dispose() {} },
  Points: class { constructor(g: any, m: any) { this.geometry = g; this.material = m; } },
  AdditiveBlending: 2, NormalBlending: 1, FrontSide: 0, BackSide: 1, DoubleSide: 2,
  SRGBColorSpace: 1, LinearFilter: 1, LinearMipmapLinearFilter: 2,
};
(globalThis as any).THREE = THREE;

// --- minimal DOM shim so TextureAtlas.build() can run headless --------------
class ImageDataStub {
  constructor(public width: number, public height: number, public data: Uint8ClampedArray) {}
}
class CtxStub {
  createImageData(w: number, h: number) {
    return new ImageDataStub(w, h, new Uint8ClampedArray(Math.max(1, w * h * 4)));
  }
  putImageData(_img: any, _x: number, _y: number) {}
  getImageData(w: number, h: number) {
    return new ImageDataStub(w, h, new Uint8ClampedArray(Math.max(1, w * h * 4)));
  }
  drawImage() {}
  fillRect() {}
  clearRect() {}
  beginPath() {}
  closePath() {}
  moveTo() {}
  lineTo() {}
  arc() {}
  fill() {}
  stroke() {}
  save() {}
  restore() {}
  translate() {}
  rotate() {}
  scale() {}
  setTransform() {}
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
  measureText() { return { width: 0 }; }
  fillText() {}
  strokeText() {}
}
const atlasCtx = new CtxStub();
(globalThis as any).document = {
  createElement: (_tag: string) => ({
    width: 0,
    height: 0,
    getContext: (_kind: string) => atlasCtx,
    toDataURL: () => 'data:,',
    style: {},
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    appendChild() {},
  }),
  getElementById: () => null,
  querySelector: () => null,
  addEventListener() {},
  body: { appendChild() {} },
  documentElement: { style: {} },
};
(globalThis as any).ImageData = ImageDataStub;
(globalThis as any).window = globalThis;
export {};
