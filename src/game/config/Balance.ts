/**
 * Resource and progression tuning, exposed as data.
 *
 * Every number that decides how the game *feels* used to be a literal buried
 * in the middle of `Player.updateResources` or `Spawner.tick`. That is the
 * reason a balance change needed a rebuild: the value is in the code, so the
 * only way to reach it is to edit the code.
 *
 * Here they are all in one place, each with a range, a step and a hint, which
 * is exactly the shape the settings screen needs to build a slider from. The
 * gameplay reads the live values, so moving a slider changes the run without a
 * restart and without a rebuild. The controller also serialises, so a tuned
 * world travels with the save instead of being reset on load.
 *
 * The ranges are deliberately wide enough to be interesting and narrow enough
 * that a slider cannot produce a nonsense value: no hunger drain below zero, no
 * spawn interval above a minute, no autosave faster than ten seconds.
 */

/** Every tunable key. Adding a key means adding it to `BALANCE_DEFS` too. */
export type BalanceKey =
  | 'hungerDrain' | 'hungerHeal' | 'staminaRegen' | 'staminaDrain'
  | 'potionCooldown' | 'manaRegenScale' | 'xpGain' | 'goldGain'
  | 'aggroRange' | 'spawnInterval' | 'autosaveInterval'
  | 'progressFlushMs' | 'discoverRadius' | 'deathPenalty';

export interface BalanceDef {
  key: BalanceKey;
  label: string;
  hint: string;
  min: number;
  max: number;
  step: number;
  /** Decimal places to display. */
  digits: number;
  unit: '%' | 's' | 'ms' | 'chunks' | 'x';
}

/** The full tuning surface, in settings-screen order. */
export const BALANCE_DEFS: BalanceDef[] = [
  { key: 'hungerDrain', label: 'Hunger drain', hint: 'How fast the world eats your food.',
    min: 0, max: 2, step: 0.05, digits: 2, unit: 'x' },
  { key: 'hungerHeal', label: 'Fed healing', hint: 'Health per second while hunger is full.',
    min: 0, max: 5, step: 0.1, digits: 1, unit: '%' },
  { key: 'staminaRegen', label: 'Stamina regen', hint: 'Stamina per second when not sprinting.',
    min: 0.1, max: 3, step: 0.05, digits: 2, unit: 'x' },
  { key: 'staminaDrain', label: 'Sprint drain', hint: 'Stamina per second while sprinting.',
    min: 0, max: 1, step: 0.02, digits: 2, unit: 'x' },
  { key: 'potionCooldown', label: 'Potion cooldown', hint: 'Global pause between potions and food.',
    min: 0, max: 5, step: 0.1, digits: 1, unit: 's' },
  { key: 'manaRegenScale', label: 'Mana regen', hint: 'Multiplier on the intelligence regen rate.',
    min: 0.2, max: 3, step: 0.05, digits: 2, unit: 'x' },
  { key: 'xpGain', label: 'Experience gain', hint: 'Global multiplier on every source of XP.',
    min: 0.25, max: 3, step: 0.05, digits: 2, unit: 'x' },
  { key: 'goldGain', label: 'Coin gain', hint: 'Multiplier on coin drops and quest rewards.',
    min: 0.25, max: 3, step: 0.05, digits: 2, unit: 'x' },
  { key: 'aggroRange', label: 'Enemy aggro range', hint: 'Distance at which a mob notices you.',
    min: 6, max: 48, step: 1, digits: 0, unit: 'chunks' },
  { key: 'spawnInterval', label: 'Spawn interval', hint: 'Seconds between mob pack spawns near you.',
    min: 4, max: 120, step: 1, digits: 0, unit: 's' },
  { key: 'autosaveInterval', label: 'Autosave interval', hint: 'How often the world writes a save.',
    min: 15, max: 300, step: 5, digits: 0, unit: 's' },
  { key: 'progressFlushMs', label: 'Memory write throttle', hint: 'How often world memory is re-serialised.',
    min: 500, max: 10000, step: 250, digits: 0, unit: 'ms' },
  { key: 'discoverRadius', label: 'Discovery radius', hint: 'Chunks marked explored around you each frame.',
    min: 1, max: 6, step: 1, digits: 0, unit: 'chunks' },
  { key: 'deathPenalty', label: 'Death penalty', hint: 'Fraction of coin lost on death. Zero disables it.',
    min: 0, max: 1, step: 0.05, digits: 2, unit: 'x' },
];

/** The shipped values. These reproduce the previous behaviour exactly. */
export const DEFAULT_BALANCE: Record<BalanceKey, number> = {
  hungerDrain: 0.6,
  hungerHeal: 1.5,
  staminaRegen: 1.1,
  staminaDrain: 0.28,
  potionCooldown: 0.6,
  manaRegenScale: 1,
  xpGain: 1,
  goldGain: 1,
  aggroRange: 22,
  spawnInterval: 14,
  autosaveInterval: 60,
  progressFlushMs: 2500,
  discoverRadius: 3,
  deathPenalty: 0.2,
};

export class BalanceController {
  private values: Record<BalanceKey, number> = { ...DEFAULT_BALANCE };

  get(key: BalanceKey): number {
    return this.values[key];
  }

  /** Clamp a candidate into the key's documented range. */
  set(key: BalanceKey, value: number): number {
    const def = BALANCE_DEFS.find((d) => d.key === key);
    const next = def ? Math.min(def.max, Math.max(def.min, value)) : value;
    this.values[key] = next;
    return next;
  }

  /** True when any value differs from the shipped default. */
  isTuned(): boolean {
    for (const def of BALANCE_DEFS) {
      if (Math.abs(this.values[def.key] - DEFAULT_BALANCE[def.key]) > 1e-9) return true;
    }
    return false;
  }

  reset(): void {
    this.values = { ...DEFAULT_BALANCE };
  }

  toJSON(): Record<BalanceKey, number> {
    return { ...this.values };
  }

  /** Merge a serialised profile. Out-of-range values are clamped, unknown
   *  keys are ignored, so a save from a newer build still loads. */
  fromJSON(data: Partial<Record<BalanceKey, number>> | null | undefined): void {
    if (!data || typeof data !== 'object') return;
    for (const def of BALANCE_DEFS) {
      const raw = data[def.key];
      if (typeof raw === 'number' && Number.isFinite(raw)) this.set(def.key, raw);
    }
  }

  /** Render a value for a tooltip or a toast. */
  format(key: BalanceKey): string {
    const def = BALANCE_DEFS.find((d) => d.key === key)!;
    const v = this.values[key];
    return `${v.toFixed(def.digits)}${def.unit === 'x' ? '' : ' ' + def.unit}`;
  }
}

/**
 * The live profile.
 *
 * A module-level instance rather than a constructor argument because the values
 * are read from a dozen places deep in the gameplay code and threading a new
 * parameter through all of them would be a larger change for no benefit: the
 * controller is a pure data holder, and the save layer is the only thing that
 * needs to write it.
 */
export const balance = new BalanceController();
