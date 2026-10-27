/**
 * Unified input.
 *
 * One abstraction over keyboard, mouse and touch so the game logic never has
 * to know which device it is running on. Everything the gameplay reads from is
 * a normalized value in [-1,1] (axes) or a boolean/edge flag (buttons).
 *
 * Touch gets a full virtual gamepad: a floating left thumbstick for movement
 * and a right-hand action cluster (attack / dash / jump / skill / interact)
 * that is remappable and auto-hides when not needed.
 */

export interface Vec2 { x: number; y: number; }

/**
 * The logical actions the game reads.
 *
 * These names are the contract between the input layer and the game: the game
 * asks for `attack`, never for `j`, so a player can remap the keys without the
 * gameplay code knowing. A binding value may be a comma-separated list when an
 * action legitimately has two physical keys (arrow keys stay bound to movement
 * even after a remap, the way Escape stays bound to pause).
 */
export const INPUT_ACTIONS = [
  'moveForward', 'moveBack', 'moveLeft', 'moveRight',
  'attack', 'dash', 'jump', 'skill', 'interact', 'sprint', 'sneak',
  'pause', 'slot1', 'slot2', 'slot3', 'slot4',
  'skill1', 'skill2', 'skill3', 'skill4',
  'hotbarLeft', 'hotbarRight',
] as const;

export type InputAction = (typeof INPUT_ACTIONS)[number];

export type BindingMap = Record<InputAction, string>;

/**
 * Default key map.
 *
 * `e` is interact and was previously also held for skill 2, which meant every
 * door you opened also fired your second ability. The two are separated here
 * (skill 2 moved to `r`, skill 4 to `g`) so the remap editor has a clean
 * starting point instead of a latent conflict.
 */
export const DEFAULT_KEY_BINDINGS: BindingMap = {
  moveForward: 'w,arrowup',
  moveBack: 's,arrowdown',
  moveLeft: 'a,arrowleft',
  moveRight: 'd,arrowright',
  attack: 'j',
  dash: 'k',
  jump: 'space',
  skill: 'i',
  interact: 'e',
  sprint: 'shift',
  sneak: 'ctrl',
  pause: 'escape,p',
  slot1: '1',
  slot2: '2',
  slot3: '3',
  slot4: '4',
  skill1: 'q',
  skill2: 'r',
  skill3: 'f',
  skill4: 'g',
  hotbarLeft: '[',
  hotbarRight: ']',
};

export class Input {
  /** Physical key (or comma-separated keys) currently bound to each action. */
  bindings: BindingMap = { ...DEFAULT_KEY_BINDINGS };

  readonly keys = new Set<string>();
  readonly pressed = new Set<string>();   // edge-triggered this frame
  readonly released = new Set<string>(); // edge-triggered this frame
  private justPressed = new Set<string>();
  private justReleased = new Set<string>();

  mouse = { x: 0, y: 0, down: false, pressed: false, wheel: 0 };
  touch = { active: false, count: 0 };

  // ---- logical axes ------------------------------------------------------
  moveX = 0;   // -1 left .. +1 right
  moveY = 0;   // -1 forward .. +1 backward
  lookDX = 0;
  lookDY = 0;
  aimX = 0;
  aimY = 0;

  // ---- logical buttons (edge triggered) ---------------------------------
  btnAttack = false;
  btnDash = false;
  btnJump = false;
  btnSkill = false;
  btnInteract = false;
  btnSprint = false;
  btnSneak = false;
  btnPause = false;
  btnSlot1 = false; btnSlot2 = false; btnSlot3 = false; btnSlot4 = false;
  btnSkill1 = false; btnSkill2 = false; btnSkill3 = false; btnSkill4 = false;
  btnSprint2 = false; btnHotbarLeft = false; btnHotbarRight = false;

  private touchState = {
    stick: { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0 },
    buttons: new Map<string, { id: number; ox: number; oy: number; x: number; y: number; r: number; pressed: boolean }>(),
    dragging: false,
  };

  /** True when a pointer is currently touching the canvas. */
  get pointerDown(): boolean {
    return this.mouse.down || this.touchState.stick.active || this.touchState.buttons.size > 0;
  }

  /** True on touch-capable devices (used to size UI and pick control scheme). */
  isTouch = false;
  isMobile = false;

  private el: HTMLElement | null = null;
  private canvas: HTMLElement | null = null;
  private pointerId = 1;
  private attached = false;

  constructor(windowObj: Window = window) {
    this.isTouch =
      ('ontouchstart' in windowObj) ||
      navigator.maxTouchPoints > 0 ||
      (windowObj.matchMedia?.('(pointer: coarse)').matches ?? false);
    this.isMobile =
      this.isTouch ||
      /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent) ||
      Math.min(windowObj.screen.width, windowObj.screen.height) < 700;
  }

  attach(canvas: HTMLElement): void {
    this.canvas = canvas;
    if (this.attached) return;
    this.attached = true;
    const w = window;

    w.addEventListener('keydown', this.onKeyDown, { passive: false });
    w.addEventListener('keyup', this.onKeyUp, { passive: false });
    w.addEventListener('blur', this.onBlur);
    w.addEventListener('mousedown', this.onMouseDown);
    w.addEventListener('mouseup', this.onMouseUp);
    w.addEventListener('mousemove', this.onMouseMove);
    w.addEventListener('wheel', this.onWheel, { passive: true });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    canvas.addEventListener('touchend', this.onTouchEnd, { passive: false });
    canvas.addEventListener('touchcancel', this.onTouchEnd, { passive: false });
    canvas.addEventListener('pointerdown', this.onPointerDown);
    canvas.addEventListener('pointermove', this.onPointerMove);
    canvas.addEventListener('pointerup', this.onPointerUp);
  }

  detach(): void {
    const w = window;
    w.removeEventListener('keydown', this.onKeyDown);
    w.removeEventListener('keyup', this.onKeyUp);
    w.removeEventListener('blur', this.onBlur);
    w.removeEventListener('mousedown', this.onMouseDown);
    w.removeEventListener('mouseup', this.onMouseUp);
    w.removeEventListener('mousemove', this.onMouseMove);
    w.removeEventListener('wheel', this.onWheel);
    if (this.canvas) {
      this.canvas.removeEventListener('touchstart', this.onTouchStart);
      this.canvas.removeEventListener('touchmove', this.onTouchMove);
      this.canvas.removeEventListener('touchend', this.onTouchEnd);
      this.canvas.removeEventListener('touchcancel', this.onTouchEnd);
      this.canvas.removeEventListener('pointerdown', this.onPointerDown);
      this.canvas.removeEventListener('pointermove', this.onPointerMove);
      this.canvas.removeEventListener('pointerup', this.onPointerUp);
    }
    this.attached = false;
  }

  // ------------------------------------------------------------------ keys
  private onKeyDown = (e: KeyboardEvent): void => {
    const k = this.normalizeKey(e.key);
    if (!this.keys.has(k)) this.justPressed.add(k);
    this.keys.add(k);
    if (isGameKey(k)) e.preventDefault();
    this.recomputeAxes();
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    const k = this.normalizeKey(e.key);
    this.keys.delete(k);
    this.justReleased.add(k);
    if (isGameKey(k)) e.preventDefault();
    this.recomputeAxes();
  };

  private onBlur = (): void => {
    // Release everything so a backgrounded tab can't leave the player stuck.
    this.keys.clear();
    this.mouse.down = false;
    this.justReleased.add('*');
    this.moveX = 0;
    this.moveY = 0;
    this.btnAttack = false;
    this.btnDash = false;
    this.btnJump = false;
    this.btnInteract = false;
    this.btnSprint = false;
  };

  private normalizeKey(k: string): string {
    const lower = k.length === 1 ? k.toLowerCase() : k;
    if (lower === ' ' || lower === 'Spacebar') return 'space';
    if (lower === 'arrowup') return 'arrowup';
    if (lower === 'arrowdown') return 'arrowdown';
    if (lower === 'arrowleft') return 'arrowleft';
    if (lower === 'arrowright') return 'arrowright';
    if (lower === 'escape') return 'escape';
    if (lower === 'enter') return 'enter';
    return lower;
  }

  key(k: string): boolean { return this.keys.has(k); }
  keyPressed(k: string): boolean { return this.justPressed.has(k); }
  anyKeyPressed(): boolean { return this.justPressed.size > 0; }

  // ----------------------------------------------------------------- mouse
  private onMouseDown = (e: MouseEvent): void => {
    this.mouse.down = true;
    this.mouse.pressed = true;
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
  };
  private onMouseUp = (e: MouseEvent): void => {
    this.mouse.down = false;
    this.mouse.x = e.clientX;
    this.mouse.y = e.clientY;
    this.recomputeAxes();
  };
  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas?.getBoundingClientRect();
    this.mouse.x = e.clientX - (rect ? rect.left : 0);
    this.mouse.y = e.clientY - (rect ? rect.top : 0);
    this.lookDX += (e.movementX || 0);
    this.lookDY += (e.movementY || 0);
  };
  private onWheel = (e: WheelEvent): void => { this.mouse.wheel += e.deltaY; };

  private onPointerDown = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return; // handled separately
    this.touch.active = true;
    this.touch.count++;
  };
  private onPointerMove = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return;
    this.touch.count = Math.max(this.touch.count, 1);
  };
  private onPointerUp = (e: PointerEvent): void => {
    if (e.pointerType === 'mouse') return;
    this.touch.active = false;
  };

  // ----------------------------------------------------------------- touch
  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    this.touch.active = true;
    this.touch.count = e.touches.length;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const x = t.clientX, y = t.clientY;
      // Left half of the screen = movement stick (unless a button is there).
      if (x < window.innerWidth * 0.55) {
        if (!this.touchState.stick.active) {
          this.touchState.stick.active = true;
          this.touchState.stick.id = t.identifier;
          this.touchState.stick.ox = x;
          this.touchState.stick.oy = y;
          this.touchState.stick.x = 0;
          this.touchState.stick.y = 0;
        }
      } else {
        this.hitTestButton(x, y, t.identifier);
      }
    }
    this.recomputeAxes();
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    this.touch.count = e.touches.length;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      const x = t.clientX, y = t.clientY;
      if (this.touchState.stick.active && t.identifier === this.touchState.stick.id) {
        const dx = x - this.touchState.stick.ox;
        const dy = y - this.touchState.stick.oy;
        const mag = Math.hypot(dx, dy);
        const radius = 54;
        if (mag > radius) {
          this.touchState.stick.x = dx / mag;
          this.touchState.stick.y = dy / mag;
        } else {
          this.touchState.stick.x = dx / radius;
          this.touchState.stick.y = dy / radius;
        }
      }
      for (const [, b] of this.touchState.buttons) {
        if (b.id === t.identifier) {
          const d = Math.hypot(x - b.ox, y - b.oy);
          b.pressed = d < b.r * 1.4;
          b.x = x - b.ox;
          b.y = y - b.oy;
        }
      }
    }
    this.recomputeAxes();
  };

  private onTouchEnd = (e: TouchEvent): void => {
    e.preventDefault();
    this.touch.count = Math.max(0, e.touches.length);
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (this.touchState.stick.id === t.identifier) {
        this.touchState.stick.active = false;
        this.touchState.stick.id = -1;
        this.touchState.stick.x = 0;
        this.touchState.stick.y = 0;
      }
      for (const [, b] of this.touchState.buttons) {
        if (b.id === t.identifier) { b.pressed = false; b.x = 0; b.y = 0; }
      }
    }
    this.recomputeAxes();
  };

  /** Register a circular touch button. */
  registerTouchButton(id: string, ox: number, oy: number, r = 40): void {
    this.touchState.buttons.set(id, { id: -1, ox, oy, x: 0, y: 0, r, pressed: false });
  }

  private hitTestButton(x: number, y: number, id: number): void {
    for (const [key, b] of this.touchState.buttons) {
      if (b.id !== -1) continue;
      if (Math.hypot(x - b.ox, y - b.oy) <= b.r * 1.4) {
        b.id = id; b.pressed = true; b.x = 0; b.y = 0;
        return;
      }
    }
  }

  /** Recompute logical axes and buttons from keyboard, mouse and touch. */
  recomputeAxes(): void {
    // Movement stick.
    const s = this.touchState.stick;
    if (this.isTouch) {
      this.moveX = s.active ? s.x : 0;
      this.moveY = s.active ? s.y : 0;
    }
    // Keyboard overrides stick when used. The keys come from the binding
    // table, so a remapped control scheme is honoured here without the
    // gameplay code ever knowing the physical key changed.
    let kx = 0, ky = 0;
    if (this.held('moveLeft')) kx -= 1;
    if (this.held('moveRight')) kx += 1;
    if (this.held('moveForward')) ky -= 1;
    if (this.held('moveBack')) ky += 1;
    if (kx !== 0 || ky !== 0) {
      this.moveX = kx;
      this.moveY = ky;
    }
    const mag = Math.hypot(this.moveX, this.moveY);
    if (mag > 1) { this.moveX /= mag; this.moveY /= mag; }

    // Buttons. Each one reads through the binding table; the touch cluster is
    // OR'd in so a phone player gets the same action from a virtual button.
    this.btnAttack = this.actionPressed('attack') || this.held('attack') || this.btn(this.touchState.buttons.get('attack'));
    this.btnDash = this.actionPressed('dash') || this.btn(this.touchState.buttons.get('dash'));
    this.btnJump = this.actionPressed('jump') || this.btn(this.touchState.buttons.get('jump'));
    this.btnSkill = this.actionPressed('skill') || this.btn(this.touchState.buttons.get('skill'));
    this.btnInteract = this.actionPressed('interact') || this.btn(this.touchState.buttons.get('interact'));
    this.btnSprint = this.held('sprint') || this.btn(this.touchState.buttons.get('sprint'));
    this.btnSneak = this.held('sneak');
    this.btnPause = this.actionPressed('pause');
    this.btnSlot1 = this.actionPressed('slot1');
    this.btnSlot2 = this.actionPressed('slot2');
    this.btnSlot3 = this.actionPressed('slot3');
    this.btnSlot4 = this.actionPressed('slot4');
    this.btnSkill1 = this.held('skill1') || this.btn(this.touchState.buttons.get('skill1'));
    this.btnSkill2 = this.held('skill2') || this.btn(this.touchState.buttons.get('skill2'));
    this.btnSkill3 = this.held('skill3') || this.btn(this.touchState.buttons.get('skill3'));
    this.btnSkill4 = this.held('skill4') || this.btn(this.touchState.buttons.get('skill4'));
    this.btnSprint2 = this.btn(this.touchState.buttons.get('sprint'));
    this.btnHotbarLeft = this.actionPressed('hotbarLeft') || this.btn(this.touchState.buttons.get('hotbarL'));
    this.btnHotbarRight = this.actionPressed('hotbarRight') || this.btn(this.touchState.buttons.get('hotbarR'));
  }

  // ------------------------------------------------------------ bindings

  /** The physical keys bound to an action, split on commas. */
  keysFor(action: InputAction): string[] {
    const raw = this.bindings[action] || '';
    return raw.split(',').map((k) => k.trim()).filter((k) => k.length > 0);
  }

  /** True while any key bound to this action is held. */
  held(action: InputAction): boolean {
    for (const k of this.keysFor(action)) if (this.key(k)) return true;
    return false;
  }

  /** True on the frame a key bound to this action went down. */
  actionPressed(action: InputAction): boolean {
    for (const k of this.keysFor(action)) if (this.keyPressed(k)) return true;
    return false;
  }

  /** The reverse map: physical key -> action, for the remap editor. */
  actionForKey(k: string): InputAction | null {
    for (const action of INPUT_ACTIONS) {
      if (this.keysFor(action).includes(k)) return action;
    }
    return null;
  }

  /**
   * Merge in a partial remap.
   *
   * An empty string is a legitimate value: it is what a swapped-away action
   * looks like, and dropping it here would leave the engine pressing a key the
   * player has already reassigned. Unknown actions are skipped so a save from
   * a newer build cannot push a binding this build cannot resolve.
   */
  setBindings(patch: Partial<BindingMap>): void {
    for (const action of INPUT_ACTIONS) {
      if (!(action in patch)) continue;
      const next = patch[action];
      if (typeof next !== 'string') continue;
      this.bindings[action] = next.trim();
    }
  }

  /** Wipe every override back to the shipped defaults. */
  resetBindings(): void {
    this.bindings = { ...DEFAULT_KEY_BINDINGS };
  }

  /** Serialise the current scheme for the save file. */
  bindingsJSON(): BindingMap {
    return { ...this.bindings };
  }

  /** Apply a serialised scheme. */
  loadBindings(data: Partial<BindingMap> | null | undefined): void {
    if (!data || typeof data !== 'object') return;
    this.setBindings(data as Partial<BindingMap>);
  }

  private btn(b: { pressed: boolean } | undefined): boolean {
    return !!b && b.pressed;
  }

  /** Call at the END of every frame to clear edge state. */
  endFrame(): void {
    this.justPressed.clear();
    this.justReleased.clear();
    this.mouse.pressed = false;
    this.mouse.wheel = 0;
    this.lookDX *= 0.6;
    this.lookDY *= 0.6;
    this.pressed.clear();
    this.released.clear();
    for (const k of this.justPressed) this.pressed.add(k);
    for (const k of this.justReleased) this.released.add(k);
  }
}

function isGameKey(k: string): boolean {
  return ['space', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k);
}

/** Human-readable key map used by the settings screen. */
export const KEY_LABELS: Record<string, string> = {
  w: 'W', a: 'A', s: 'S', d: 'D', space: 'SPACE', j: 'J — Attack',
  k: 'K — Dash', l: 'L — Jump', i: 'I — Skill', e: 'E — Interact',
  shift: 'SHIFT — Sprint', escape: 'ESC — Pause', m: 'M — Music',
  f: 'F — Fullscreen', r: 'R — Restart', 1: '1 — Skill 1', 2: '2 — Skill 2', 3: '3 — Skill 3',
  arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
};
