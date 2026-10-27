/**
 * DOM, Web Audio and storage shims for the headless runtime test.
 *
 * The game is a browser program; to run it under Node we need the parts it
 * touches to exist with the right shape. This is not a DOM implementation —
 * query selectors return nothing, CSS is ignored, layout is zero — it is a
 * surface that lets the game's own logic run so a crash in the loop is
 * visible here instead of in a browser console.
 */

// ---------------------------------------------------------------- elements

class ClassList {
  private set = new Set<string>();
  constructor(private el: Element) {}
  add(...c: string[]): void { c.forEach((x) => this.set.add(x)); }
  remove(...c: string[]): void { c.forEach((x) => this.set.delete(x)); }
  toggle(c: string, force?: boolean): boolean {
    if (force === undefined) { if (this.set.has(c)) this.set.delete(c); else this.set.add(c); }
    else if (force) this.set.add(c); else this.set.delete(c);
    return this.set.has(c);
  }
  contains(c: string): boolean { return this.set.has(c); }
  get value(): string { return [...this.set].join(' '); }
}

class Element {
  tagName = 'DIV';
  children: Element[] = [];
  parentNode: Element | null = null;
  style: Record<string, any> = {
    setProperty(k: string, v: string) { this[k] = v; },
    getPropertyValue(k: string) { return this[k] || ''; },
    removeProperty(k: string) { delete this[k]; },
  };
  classList = new ClassList(this);
  dataset: Record<string, string> = {};
  attributes: Record<string, string> = {};
  textContent = '';
  innerHTML = '';
  value = '';
  disabled = false;
  checked = false;
  offsetWidth = 800;
  offsetHeight = 450;
  clientWidth = 800;
  clientHeight = 450;
  scrollTop = 0;
  private listeners = new Map<string, ((e: any) => void)[]>();
  private stubs = new Map<string, Element>();
  /** Which selector this dummy was created for. */
  selector = '';
  onclick: any = null;
  onchange: any = null;
  oninput: any = null;

  appendChild<T extends Element>(child: T): T {
    if (child.parentNode) child.parentNode.removeChild(child);
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  removeChild<T extends Element>(child: T): T {
    const i = this.children.indexOf(child);
    if (i >= 0) this.children.splice(i, 1);
    child.parentNode = null;
    return child;
  }
  remove(): void { if (this.parentNode) this.parentNode.removeChild(this); }
  insertBefore<T extends Element>(child: T, _ref: Element | null): T { return this.appendChild(child); }
  /** Variadic append, which the UI shell uses to lay out its layers. */
  append(...children: Element[]): void { children.forEach((c) => this.appendChild(c)); }
  addEventListener(type: string, cb: (e: any) => void): void {
    const list = this.listeners.get(type) || [];
    list.push(cb);
    this.listeners.set(type, list);
  }
  removeEventListener(type: string, cb: (e: any) => void): void {
    const list = this.listeners.get(type) || [];
    const i = list.indexOf(cb);
    if (i >= 0) list.splice(i, 1);
  }
  dispatch(type: string, event: any = {}): void {
    const list = [...(this.listeners.get(type) || [])];
    for (const cb of list) cb(event);
  }
  /**
   * Selectors are not implemented, but the UI reads dozens of elements by
   * attribute. Return a stable dummy per selector so the code paths that
   * assume an element exists can still execute; layout-dependent behaviour
   * is out of scope for a headless run.
   */
  querySelector(sel: string): Element | null {
    if (!this.stubs.has(sel)) { const e = new Element(); e.selector = sel; this.stubs.set(sel, e); }
    return this.stubs.get(sel)!;
  }
  querySelectorAll(_sel: string): Element[] { return []; }
  setAttribute(k: string, v: string): void { this.attributes[k] = v; if (k === 'class') this.classList.add(v); }
  getAttribute(k: string): string | null { return this.attributes[k] ?? null; }
  removeAttribute(k: string): void { delete this.attributes[k]; }
  hasAttribute(k: string): boolean { return k in this.attributes; }
  closest(_sel: string): Element | null { return null; }
  getBoundingClientRect(): { x: number; y: number; width: number; height: number; top: number; left: number; right: number; bottom: number } {
    return { x: 0, y: 0, width: this.offsetWidth, height: this.offsetHeight, top: 0, left: 0, right: this.offsetWidth, bottom: this.offsetHeight };
  }
  focus(): void {}
  blur(): void {}
  click(): void { this.dispatch('click', {}); }
  getContext(_kind: string): any { return CTX; }
  toDataURL(): string { return 'data:,'; }
  get clientX(): number { return 0; }
}

class CanvasElement extends Element {
  tagName = 'CANVAS';
  width = 300;
  height = 150;
}

// ---------------------------------------------------------------- 2d context

class ImageDataStub {
  constructor(public width: number, public height: number, public data: Uint8ClampedArray) {}
}

class Ctx2D {
  canvas: CanvasElement;
  fillStyle = '#000';
  strokeStyle = '#000';
  globalAlpha = 1;
  globalCompositeOperation = 'source-over';
  lineWidth = 1;
  lineCap = 'butt';
  lineJoin = 'miter';
  font = '10px sans-serif';
  textAlign = 'start';
  textBaseline = 'alphabetic';
  shadowColor = 'transparent';
  shadowBlur = 0;
  shadowOffsetX = 0;
  shadowOffsetY = 0;
  imageSmoothingEnabled = true;
  filter = 'none';
  constructor(canvas: CanvasElement) { this.canvas = canvas; }
  createImageData(w: number, h: number) { return new ImageDataStub(w, h, new Uint8ClampedArray(Math.max(1, w * h * 4))); }
  getImageData(w: number, h: number) { return this.createImageData(w, h); }
  putImageData(_img: ImageDataStub, _x: number, _y: number) {}
  drawImage(..._a: any[]) {}
  fillRect(..._a: any[]) {}
  strokeRect(..._a: any[]) {}
  clearRect(..._a: any[]) {}
  beginPath() {} closePath() {} moveTo() {} lineTo() {} arc() {} arcTo() {} ellipse() {}
  rect() {} fill() {} stroke() {} clip() {}
  quadraticCurveTo() {} bezierCurveTo() {}
  save() {} restore() {} translate() {} rotate() {} scale() {} setTransform() {} transform() {} resetTransform() {}
  createLinearGradient() { return { addColorStop() {} }; }
  createRadialGradient() { return { addColorStop() {} }; }
  createPattern() { return null; }
  measureText() { return { width: 0 }; }
  fillText() {} strokeText() {}
  setLineDash() {} getLineDash() { return []; }
  getTransform() { return { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 }; }
}

const CTX = new Ctx2D(new CanvasElement());

// ---------------------------------------------------------------- document

const bodyEl = new Element();
bodyEl.tagName = 'BODY';
const htmlEl = new Element();
htmlEl.tagName = 'HTML';
htmlEl.style.display = 'block';
htmlEl.requestFullscreen = function (): Promise<void> {
  documentObj.fullscreenElement = htmlEl;
  return Promise.resolve();
};
htmlEl.exitFullscreen = function (): Promise<void> {
  documentObj.fullscreenElement = null;
  return Promise.resolve();
};

const documentListeners = new Map<string, ((e: any) => void)[]>();

const documentObj = {
  createElement(tag: string): Element {
    if (tag === 'canvas') return new CanvasElement();
    const el = new Element();
    el.tagName = tag.toUpperCase();
    return el;
  },
  createElementNS(_ns: string, tag: string): Element { return this.createElement(tag); },
  createTextNode(text: string): Element { const el = new Element(); el.textContent = text; return el; },
  getElementById(_id: string): Element | null { return null; },
  querySelector(_sel: string): Element | null { return null; },
  querySelectorAll(_sel: string): Element[] { return []; },
  addEventListener(type: string, cb: (e: any) => void) {
    const list = documentListeners.get(type) || [];
    list.push(cb);
    documentListeners.set(type, list);
  },
  removeEventListener() {},
  body: bodyEl,
  documentElement: htmlEl,
  head: new Element(),
  activeElement: bodyEl,
  fullscreenElement: null as Element | null,
  fullscreenEnabled: true,
  requestFullscreen(): Promise<void> { documentObj.fullscreenElement = htmlEl; return Promise.resolve(); },
  exitFullscreen(): Promise<void> { documentObj.fullscreenElement = null; return Promise.resolve(); },
  addEventListenerFullscreenChange(_cb: any) {},
  cookie: '',
  hidden: false,
  visibilityState: 'visible',
  readyState: 'complete',
};

// ---------------------------------------------------------------- window

class StorageShim {
  private map = new Map<string, string>();
  get length(): number { return this.map.size; }
  getItem(k: string): string | null { return this.map.has(k) ? this.map.get(k)! : null; }
  setItem(k: string, v: string): void { this.map.set(k, String(v)); }
  removeItem(k: string): void { this.map.delete(k); }
  clear(): void { this.map.clear(); }
  key(i: number): string | undefined { return [...this.map.keys()][i]; }
}

/** Every rAF callback the game registers is captured here. */
const rafQueue: { cb: (t: number) => void; id: number }[] = [];
let nextRafId = 1;

class AudioParamStub {
  value = 0;
  defaultValue = 0;
  minValue = -3.4e38;
  maxValue = 3.4e38;
  cancelScheduledValues(): this { return this; }
  setValueAtTime(_t: number, v: number): this { this.value = v; return this; }
  linearRampToValueAtTime(_t: number, v: number): this { this.value = v; return this; }
  exponentialRampToValueAtTime(_t: number, v: number): this { this.value = v; return this; }
  setTargetAtTime(_t: number, v: number, _s: number): this { this.value = v; return this; }
  setValueCurveAtTime(_t: number, _v: number[]): this { return this; }
  exponentialRampToValueAtTimeAtTime(): this { return this; }
}

class NodeStub {
  /**
   * A Web Audio node. Nodes expose dozens of AudioParams (threshold, knee,
   * ratio, attack, release, pan, positionX, ...) and the game touches a
   * different subset in each path, so unknown properties lazily become an
   * AudioParam rather than throwing.
   */
  [Symbol.hasInstance] = true;
  connect(_dst: any): any { return _dst; }
  disconnect(): void {}
  start(_t = 0): void {}
  stop(_t = 0): void {}
  constructor(public ctx: any, public kind: string) {
    const self = this;
    return new Proxy(this, {
      get(target: any, key: string | symbol) {
        if (key in target) return target[key];
        target[key] = new AudioParamStub();
        return target[key];
      },
      set(target: any, key: string | symbol, value: any) {
        target[key] = value;
        return true;
      },
    }) as any;
  }
  getFloatFrequencyData(_a: Float32Array) {}
  getByteFrequencyData(_a: Uint8Array) {}
  getFloatTimeData(_a: Float32Array) {}
  getByteTimeData(_a: Uint8Array) {}
}

class AudioContextStub {
  sampleRate = 44100;
  currentTime = 0;
  state = 'running';
  destination = new NodeStub(this, 'destination');
  listener = { position: new Vector3ish(), setOrientation() {}, setPosition() {} };
  private nodes: NodeStub[] = [];
  resume(): Promise<void> { this.state = 'running'; return Promise.resolve(); }
  suspend(): Promise<void> { this.state = 'suspended'; return Promise.resolve(); }
  close(): Promise<void> { this.state = 'closed'; return Promise.resolve(); }
  decodeAudioData(): Promise<any> { return Promise.resolve({ getChannelData: () => new Float32Array(1024), duration: 1 }); }
  createBuffer(channels: number, length: number, rate: number) {
    const data: any[] = [];
    for (let c = 0; c < channels; c++) data.push(new Float32Array(length));
    return { numberOfChannels: channels, length, sampleRate: rate, duration: length / rate, getChannelData: (i: number) => data[i] || new Float32Array(length), copyToChannel() {} };
  }
  createBufferSource() { return this.track(new NodeStub(this, 'AudioBufferSourceNode')); }
  createOscillator() { return this.track(new NodeStub(this, 'OscillatorNode')); }
  createGain() { return this.track(new NodeStub(this, 'GainNode')); }
  createBiquadFilter() { return this.track(new NodeStub(this, 'BiquadFilterNode')); }
  createDynamicsCompressor() { return this.track(new NodeStub(this, 'DynamicsCompressorNode')); }
  createStereoPanner() { return this.track(new NodeStub(this, 'StereoPannerNode')); }
  createPanner() { return this.track(new NodeStub(this, 'PannerNode')); }
  createWaveShaper() { return this.track(new NodeStub(this, 'WaveShaperNode')); }
  createDelay() { return this.track(new NodeStub(this, 'DelayNode')); }
  createConvolver() { return this.track(new NodeStub(this, 'ConvolverNode')); }
  createAnalyser() { return this.track(new NodeStub(this, 'AnalyserNode')); }
  createPeriodicWave() { return {}; }
  createWaveData() { return { length: 0, getFloat32Array: () => new Float32Array(0) }; }
  private track(n: NodeStub): NodeStub { this.nodes.push(n); return n; }
  get nodeCount(): number { return this.nodes.length; }
}

class Vector3ish {
  x = 0; y = 0; z = 0;
  set(x: number, y: number, z: number) { this.x = x; this.y = y; this.z = z; return this; }
  copy(v: Vector3ish) { this.x = v.x; this.y = v.y; this.z = v.z; return this; }
}

const windowObj = {
  innerWidth: 1280,
  innerHeight: 720,
  devicePixelRatio: 1,
  screen: { width: 1920, height: 1080, availWidth: 1920, availHeight: 1040 },
  location: { href: 'http://localhost/', origin: 'http://localhost', pathname: '/' },
  history: { pushState() {}, replaceState() {}, back() {} },
  localStorage: new StorageShim(),
  sessionStorage: new StorageShim(),
  navigator: { userAgent: 'node', language: 'en', platform: 'linux', maxTouchPoints: 0, vibrate() {} },
  performance: { now: () => Date.now() },
  addEventListener(type: string, cb: (e: any) => void) {
    const list = windowListeners.get(type) || [];
    list.push(cb);
    windowListeners.set(type, list);
  },
  removeEventListener(type: string, cb: (e: any) => void) {
    const list = windowListeners.get(type) || [];
    const i = list.indexOf(cb);
    if (i >= 0) list.splice(i, 1);
  },
  dispatch(type: string, event: any = {}): void {
    for (const cb of [...(windowListeners.get(type) || [])]) cb(event);
  },
  requestAnimationFrame(cb: (t: number) => void): number {
    const id = nextRafId++;
    rafQueue.push({ cb, id });
    return id;
  },
  cancelAnimationFrame(id: number): void {
    const i = rafQueue.findIndex((r) => r.id === id);
    if (i >= 0) rafQueue.splice(i, 1);
  },
  matchMedia(query: string) { return { matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }; },
  scrollTo() {},
  alert() {},
  confirm() { return true; },
  prompt() { return null; },
  open() { return null; },
  close() {},
  AudioContext: AudioContextStub,
  webkitAudioContext: AudioContextStub,
  PointerEvent: class PointerEvent {},
  MouseEvent: class MouseEvent { constructor(public type: string, public init: any = {}) {} },
  KeyboardEvent: class KeyboardEvent {
    constructor(public type: string, public init: any = {}) {}
    get key() { return this.init.key || ''; }
    get code() { return this.init.code || ''; }
    get repeat() { return !!this.init.repeat; }
  },
  TouchEvent: class TouchEvent {},
  Event: class Event { constructor(public type: string) {} },
  CustomEvent: class CustomEvent { constructor(public type: string, public init: any = {}) {} },
  ResizeObserver: class ResizeObserver {
    observe() {} unobserve() {} disconnect() {}
  },
  IntersectionObserver: class IntersectionObserver {
    observe() {} unobserve() {} disconnect() {}
  },
  MutationObserver: class MutationObserver {
    observe() {} disconnect() {} takeRecords() { return []; }
  },
  Image: class Image { src = ''; onload: any = null; },
  URL: { createObjectURL: () => 'blob:x', revokeObjectURL() {} },
};

const windowListeners = new Map<string, ((e: any) => void)[]>();

// ---------------------------------------------------------------- install

/** Some Node globals (navigator, performance) are getter-only; replace them. */
function defineGlobal(name: string, value: any): void {
  Object.defineProperty(globalThis, name, { value, configurable: true, writable: true });
}

(globalThis as any).document = documentObj;
(globalThis as any).window = windowObj;
defineGlobal('navigator', windowObj.navigator);
defineGlobal('location', windowObj.location);
(globalThis as any).localStorage = windowObj.localStorage;
(globalThis as any).sessionStorage = windowObj.sessionStorage;
defineGlobal('screen', windowObj.screen);
defineGlobal('performance', windowObj.performance);
(globalThis as any).AudioContext = AudioContextStub;
(globalThis as any).webkitAudioContext = AudioContextStub;
(globalThis as any).ResizeObserver = windowObj.ResizeObserver;
(globalThis as any).requestAnimationFrame = (cb: (t: number) => void) => windowObj.requestAnimationFrame(cb);
(globalThis as any).cancelAnimationFrame = (id: number) => windowObj.cancelAnimationFrame(id);
(globalThis as any).matchMedia = windowObj.matchMedia.bind(windowObj);
(globalThis as any).Element = Element;
(globalThis as any).HTMLElement = Element;
(globalThis as any).HTMLCanvasElement = CanvasElement;
(globalThis as any).ImageData = ImageDataStub;
(globalThis as any).KeyboardEvent = windowObj.KeyboardEvent;
(globalThis as any).PointerEvent = windowObj.PointerEvent;
(globalThis as any).MouseEvent = windowObj.MouseEvent;
(globalThis as any).Event = windowObj.Event;
(globalThis as any).CustomEvent = windowObj.CustomEvent;

/** Run one queued animation frame and return how many were pending. */
export function pumpRaf(now: number): number {
  const queue = rafQueue.splice(0, rafQueue.length);
  for (const { cb } of queue) cb(now);
  return queue.length;
}

export function hasRaf(): boolean { return rafQueue.length > 0; }
export function clearRaf(): void { rafQueue.length = 0; }
export { Element, CanvasElement, windowObj, documentObj, AudioContextStub, StorageShim };
export {};
