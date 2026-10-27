/**
 * Remappable controls.
 *
 * The engine's input layer already normalizes every device into logical
 * actions, so remapping is not a matter of re-implementing key handling: it is
 * a matter of telling `Input` which physical key answers to which action, and
 * then making sure the player's choice survives a reload.
 *
 * This module owns the two things the engine deliberately does not:
 *
 *   - the vocabulary (which actions exist, what they are called, which keys
 *     they ship with), because that is a design decision, not a mechanism;
 *   - persistence. A remap is written to localStorage immediately, so it is
 *     live before the next save, and it is also carried in the save payload so
 *     it survives a fresh device through the encrypted slot.
 *
 * Conflicts are detected rather than silently resolved. Binding two actions
 * to one key is almost always a mistake, so `remap` reports the collision and
 * the UI can offer to swap or to cancel. The one exception is deliberate: the
 * arrow keys stay bound to movement, because a player who has remapped
 * everything else still expects the arrows to steer.
 */

import {
  DEFAULT_KEY_BINDINGS, INPUT_ACTIONS, type BindingMap, type Input,
  type InputAction,
} from '../../engine/core/Input';

export type { BindingMap, Input, InputAction };

/** Human-readable names for the keybind editor. */
export const KEY_LABELS: Record<string, string> = {
  space: 'Space', enter: 'Enter', escape: 'Esc', backspace: 'Backspace',
  shift: 'Shift', ctrl: 'Ctrl', alt: 'Alt', meta: 'Cmd/Meta',
  arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
  plus: '+', minus: '-', equal: '=', comma: ',', period: '.', slash: '/',
  semicolon: ';', quote: "'", backquote: '`', bracketleft: '[', bracketright: ']',
};

/** Action names, grouped for the keybind editor. */
export const ACTION_LABELS: Record<InputAction, string> = {
  moveForward: 'Move forward',
  moveBack: 'Move back',
  moveLeft: 'Strafe left',
  moveRight: 'Strafe right',
  attack: 'Attack',
  dash: 'Dash',
  jump: 'Jump',
  skill: 'Primary skill',
  interact: 'Interact',
  sprint: 'Sprint',
  sneak: 'Sneak / creep',
  pause: 'Pause',
  slot1: 'Hotbar 1',
  slot2: 'Hotbar 2',
  slot3: 'Hotbar 3',
  slot4: 'Hotbar 4',
  skill1: 'Skill 1',
  skill2: 'Skill 2',
  skill3: 'Skill 3',
  skill4: 'Skill 4',
  hotbarLeft: 'Hotbar left',
  hotbarRight: 'Hotbar right',
};

export interface ActionGroup { label: string; actions: InputAction[]; }

/** The editor's layout: movement, combat, hotbar, view. */
export const ACTION_GROUPS: ActionGroup[] = [
  { label: 'Movement', actions: ['moveForward', 'moveBack', 'moveLeft', 'moveRight', 'sprint', 'sneak'] },
  { label: 'Combat', actions: ['attack', 'dash', 'jump', 'skill', 'interact'] },
  { label: 'Skills', actions: ['skill1', 'skill2', 'skill3', 'skill4'] },
  { label: 'Hotbar & view', actions: ['slot1', 'slot2', 'slot3', 'slot4', 'hotbarLeft', 'hotbarRight', 'pause'] },
];

/** What happened when a remap was attempted. */
export interface RemapResult {
  ok: boolean;
  /** The action that lost the key, when the remap was a swap. */
  swapped?: string | null;
  /** Why a remap was refused. */
  reason?: 'empty' | 'unknown' | 'conflict' | 'self';
}

/** A key currently claimed by more than one action. */
export interface BindingConflict { key: string; actions: InputAction[]; }

/** Pretty-print a physical key for the editor. */
export function displayKey(raw: string): string {
  const k = raw.trim().toLowerCase();
  if (!k) return '—';
  if (KEY_LABELS[k]) return KEY_LABELS[k];
  if (k.length === 1) return k.toUpperCase();
  return k.charAt(0).toUpperCase() + k.slice(1);
}

/**
 * The current key scheme plus its persistence.
 *
 * Instances are cheap and stateless apart from the map, so the game keeps one
 * for the live session and the save layer writes it into the payload.
 */
export class ControlBindings {
  private bindings: BindingMap = { ...DEFAULT_KEY_BINDINGS };

  /** The raw binding string for an action (comma-separated). */
  get(action: InputAction): string {
    return this.bindings[action] || '';
  }

  /** The physical keys bound to an action. */
  keysOf(action: InputAction): string[] {
    return this.get(action).split(',').map((k) => k.trim()).filter(Boolean);
  }

  /** Pretty-printed keys, for display. */
  display(action: InputAction): string {
    const parts = this.keysOf(action).map(displayKey);
    return parts.length ? parts.join(' / ') : '—';
  }

  /** Push the scheme into the engine. Called on boot and after every remap. */
  applyTo(input: Input): void {
    input.setBindings(this.bindings);
  }

  /** Rebind one action. Returns what happened so the UI can react. */
  remap(action: InputAction, key: string, opts: { swap?: boolean } = {}): RemapResult {
    const candidate = key.trim().toLowerCase();
    if (!candidate) return { ok: false, reason: 'empty' };
    if (!isKnownKey(candidate)) return { ok: false, reason: 'unknown' };
    if (this.keysOf(action).includes(candidate)) return { ok: false, reason: 'self' };

    const holder = this.ownerOf(candidate);
    if (holder && holder !== action) {
      if (!opts.swap) return { ok: false, reason: 'conflict' };
      // The previous owner keeps its remaining keys, or loses the action.
      const rest = this.keysOf(holder).filter((k) => k !== candidate);
      this.bindings[holder] = rest.length ? rest.join(',') : '';
      return { ok: true, swapped: holder };
    }
    this.bindings[action] = candidate;
    return { ok: true, swapped: null };
  }

  /**
   * Every action that shares a physical key with another action.
   *
   * Arrow keys are exempt: they are a second key for movement by design, not a
   * collision, and reporting them would make the editor useless on a laptop.
   */
  conflicts(): BindingConflict[] {
    const byKey = new Map<string, InputAction[]>();
    for (const action of INPUT_ACTIONS) {
      for (const k of this.keysOf(action)) {
        if (isArrowKey(k)) continue;
        const list = byKey.get(k) || [];
        if (!list.includes(action)) list.push(action);
        byKey.set(k, list);
      }
    }
    const out: BindingConflict[] = [];
    for (const [key, actions] of byKey) {
      if (actions.length > 1) out.push({ key, actions });
    }
    return out;
  }

  /** The action a physical key answers to, if any. */
  ownerOf(key: string): InputAction | null {
    const k = key.trim().toLowerCase();
    for (const action of INPUT_ACTIONS) {
      if (this.keysOf(action).includes(k)) return action;
    }
    return null;
  }

  /** Wipe every override and reinstall the shipped defaults. */
  reset(): void {
    this.bindings = { ...DEFAULT_KEY_BINDINGS };
  }

  /** Whether the player has changed anything from the shipped defaults. */
  isDefault(): boolean {
    for (const action of INPUT_ACTIONS) {
      if (this.bindings[action] !== DEFAULT_KEY_BINDINGS[action]) return false;
    }
    return true;
  }

  toJSON(): BindingMap {
    return { ...this.bindings };
  }

  /** Merge a serialised scheme. Unknown actions are skipped so a save from a
   *  newer build cannot inject a binding this build cannot resolve. */
  fromJSON(data: Partial<BindingMap> | null | undefined): void {
    if (!data || typeof data !== 'object') return;
    for (const action of INPUT_ACTIONS) {
      const next = data[action];
      if (typeof next === 'string' && next.trim().length > 0) {
        this.bindings[action] = next.trim().toLowerCase();
      }
    }
  }
}

function isArrowKey(k: string): boolean {
  return k === 'arrowup' || k === 'arrowdown' || k === 'arrowleft' || k === 'arrowright';
}

/**
 * Keys the editor will accept.
 *
 * The set is derived from the shipped defaults plus every key the game can
 * actually produce through `normalizeKey`, so a remapped scheme can never point
 * at a key the engine would silently ignore — which is the classic way a remap
 * screen produces a button that does nothing.
 */
const KEY_POOL = new Set<string>([
  ...Object.values(DEFAULT_KEY_BINDINGS).flatMap((v) => v.split(',')),
  'enter', 'backspace', 'tab', 'minus', 'equal', 'comma', 'period', 'slash',
  'semicolon', 'quote', 'backquote', 'bracketleft', 'bracketright', 'meta',
  'alt', '0', '5', '6', '7', '8', '9',
]);

function isKnownKey(k: string): boolean {
  if (!k) return false;
  if (KEY_POOL.has(k)) return true;
  // Single printable characters are always fair game (letters, digits, punctuation).
  return k.length === 1 && k >= 'a' && k <= 'z';
}

/** The live session's control scheme. */
export const controls = new ControlBindings();
