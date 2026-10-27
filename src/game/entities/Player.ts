/**
 * The player.
 *
 * A blocky body in a voxel world, which means the physics is the boring kind:
 * resolve the three axes against the tile grid one at a time, let gravity do
 * the rest, and never trust the decimal. Almost all of the interesting content
 * lives in the state this class owns — level, attributes, inventory, equipment
 * and the four active skills — because saving and loading is the same object
 * either way.
 *
 * Nothing here renders. The scene layer owns the mesh and copies the pose out
 * of `pos` every frame; the model animates from `swing`. That split is what
 * lets the whole game run headless for testing.
 */

import { moveAABB, type TileReader } from '../../engine/core/Collision';
import { RNG } from '../../engine/core/RNG';
import { ITEMS, type ItemDef } from '../data/Items';
import { enchantCount as enchantTotal } from '../systems/Forge';
import { balance } from '../config/Balance';
import { ENCHANT_BY_ID, enchantAppliesTo, enchantCost, fuelSeconds, isFuel, isSmeltable,
  smeltOutput, smeltSeconds, type EnchantStat } from '../systems/Forge';
import { gearDef, type GearSlot } from '../data/Equipment';
import { SKILL_BY_ID, ACTIVE_SKILL_SLOTS } from '../data/Skills';
import { QUESTS, QUEST_BY_ID } from '../data/Quests';
import { ACHIEVEMENT_BY_ID, TITLES } from '../data/Achievements';
import {
  ATTRIBUTE_KEYS, ATTRIBUTE_LABEL, ATTRIBUTE_DESC,
  attributeCost, attributeLevelFor, computeStats, damageMitigation, emptyStats,
  rollAffixes, xpToNext, type Attributes, type StatBlock, type EquippedItem,
} from '../systems/Stats';

export const HOTBAR_SIZE = 9;
export const INVENTORY_SIZE = 64;
export const MAX_LEVEL = 120;
export const MAX_STAMINA = 100;

/** Item stack: id plus count, or null when the slot is empty. */
export interface ItemStack {
  id: number;
  count: number;
  /** Durability consumed so far, for tools and weapons. */
  damage?: number;
  /** Enchantments applied at an enchanting table. */
  enchants?: { id: string; level: number }[];
}

export interface QuestProgress {
  accepted: boolean;
  done: boolean;
  claimed: boolean;
  /** Counters keyed `kind:target`, e.g. `kill:wolf_hound`. */
  counts: Record<string, number>;
}

/** Everything that goes into the save file. */
export interface PlayerState {
  name: string;
  level: number;
  xp: number;
  attributes: Attributes;
  attributePoints: number;
  skillPoints: number;
  skillLevels: Record<string, number>;
  activeSkills: string[];
  health: number;
  mana: number;
  stamina: number;
  hunger: number;
  saturation: number;
  inventory: (ItemStack | null)[];
  equipped: Partial<Record<GearSlot, EquippedItem>>;
  hotbar: number[];
  /** Index into `hotbar` of the selected slot. */
  hotbarIndex: number;
  achievements: string[];
  titles: string[];
  quests: Record<string, QuestProgress>;
  codex: string[];
  /** Free-form counters: blocks mined, deaths, distance walked. */
  stats: Record<string, number>;
  position: [number, number, number];
  yaw: number;
  pitch: number;
  playtime: number;
  worldSeed: number;
  visitedRegions: number[];
  unlockedDungeons: number[];
}

export interface PlayerInput {
  forward: number;
  back: number;
  left: number;
  right: number;
  jump: boolean;
  sprint: boolean;
  sneak: boolean;
  attack: boolean;
  active1: boolean;
  active2: boolean;
  active3: boolean;
  active4: boolean;
  dash: boolean;
  interact: boolean;
}

/** Anything the player can damage. */
export interface HitActor {
  readonly id: string;
  readonly pos: { x: number; y: number; z: number };
  readonly half: { x: number; y: number; z: number };
  readonly alive: boolean;
  takeDamage(amount: number, opts: DamageOptions): void;
}

export interface DamageOptions {
  from?: { x: number; y: number; z: number };
  crit?: boolean;
  knockback?: number;
  type?: string;
  source?: string;
}

/** Cooldowns keyed by skill id, in seconds remaining. */
export type Cooldowns = Record<string, number>;

export class Player {
  state: PlayerState;
  pos = { x: 0, y: 0, z: 0 };
  vel = { x: 0, y: 0, z: 0 };
  yaw = 0;
  pitch = 0;
  onGround = false;
  inWater = false;
  /** Attack swing animation clock, 0 when idle. */
  swing = 0;
  cooldowns: Cooldowns = {};
  /** Active potion effects: id, remaining seconds, amplifier. */
  effects: { id: string; time: number; amplifier: number }[] = [];
  stats: StatBlock = emptyStats();

  constructor(state: PlayerState) {
    this.state = state;
    this.pos = { x: state.position[0], y: state.position[1], z: state.position[2] };
    this.yaw = state.yaw;
    this.pitch = state.pitch;
    this.recompute();
    if (state.health > this.stats.maxHealth) state.health = this.stats.maxHealth;
    if (state.mana > this.stats.maxMana) state.mana = this.stats.maxMana;
    if (state.stamina > MAX_STAMINA) state.stamina = MAX_STAMINA;
    if (state.hunger > 20) state.hunger = 20;
  }

  // ---------------------------------------------------------------- stats

  /** Recompute the derived stat block. Call after any equip or level change. */
  recompute(): void {
    this.stats = computeStats(this.state.level, this.state.attributes, this.state.equipped, this.state.skillLevels);
    this.state.health = Math.min(this.state.health, this.stats.maxHealth);
    this.state.mana = Math.min(this.state.mana, this.stats.maxMana);
  }

  get health(): number { return this.state.health; }
  get mana(): number { return this.state.mana; }
  get xpNeeded(): number { return xpToNext(this.state.level); }
  get skillPoints(): number { return this.state.skillPoints; }
  get skillPointsTotal(): number { return this.state.skillPoints; }

  /** Points already spent raising an attribute from its base of 10. */
  attributeSpent(key: keyof Attributes): number {
    return attributeCost(this.state.attributes[key]);
  }

  // ---------------------------------------------------------------- level

  /** Add experience, leveling up as many times as it allows. */
  gainXp(amount: number): { leveled: number; levels: number[] } {
    if (amount <= 0) return { leveled: 0, levels: [] };
    this.state.xp += amount;
    this.bump('xpGained', amount);
    const levels: number[] = [];
    while (this.state.level < MAX_LEVEL && this.state.xp >= xpToNext(this.state.level)) {
      this.state.xp -= xpToNext(this.state.level);
      this.state.level++;
      levels.push(this.state.level);
      this.state.attributePoints += 3;
      this.state.skillPoints += 1;
      this.bump('levelUps', 1);
    }
    if (this.state.level >= MAX_LEVEL) this.state.xp = 0;
    this.recompute();
    if (levels.length) {
      this.state.health = this.stats.maxHealth;
      this.state.mana = this.stats.maxMana;
    }
    return { leveled: levels.length, levels };
  }

  /** Restore a character to full after death, at the world spawn. */
  respawn(position: [number, number, number]): void {
    this.pos = { x: position[0], y: position[1], z: position[2] };
    this.vel = { x: 0, y: 0, z: 0 };
    this.state.position = position;
    this.recompute();
    this.state.health = this.stats.maxHealth * Math.max(0.25, this.stats.respawnHealth);
    this.state.mana = this.stats.maxMana;
    this.state.stamina = MAX_STAMINA;
    this.state.hunger = 20;
    this.bump('deaths', 1);
  }

  spendAttribute(key: keyof Attributes): boolean {
    if (this.state.attributePoints <= 0) return false;
    if (this.state.attributes[key] >= 320) return false;
    this.state.attributes[key]++;
    this.state.attributePoints--;
    this.recompute();
    return true;
  }

  resetAttributes(): void {
    const spent = ATTRIBUTE_KEYS.reduce((s, k) => s + this.attributeSpent(k), 0);
    this.state.attributePoints += spent;
    for (const k of ATTRIBUTE_KEYS) this.state.attributes[k] = 10;
    this.recompute();
  }

  /** Whether a skill is trained and ready to be spent further. */
  canTrain(skillId: string): boolean {
    const def = SKILL_BY_ID.get(skillId) || null;
    if (!def) return false;
    const current = this.state.skillLevels[skillId] || 0;
    if (current >= def.maxLevel) return false;
    return current === 0 || current >= def.tier;
  }

  spendSkill(skillId: string): boolean {
    if (this.state.skillPoints <= 0) return false;
    if (!this.canTrain(skillId)) return false;
    this.state.skillLevels[skillId] = (this.state.skillLevels[skillId] || 0) + 1;
    this.state.skillPoints--;
    this.recompute();
    return true;
  }

  setActiveSkills(ids: string[]): boolean {
    const valid = ids.filter((id) => (this.state.skillLevels[id] || 0) > 0).slice(0, ACTIVE_SKILL_SLOTS);
    if (valid.length !== ids.length || valid.length > ACTIVE_SKILL_SLOTS) return false;
    this.state.activeSkills = valid;
    return true;
  }

  // ---------------------------------------------------------------- inventory

  inventorySlot(i: number): ItemStack | null {
    return this.state.inventory[i] || null;
  }

  addItem(id: number, count = 1): boolean {
    const def = ITEMS[id];
    if (!def) return false;
    let remaining = count;
    const limit = def.stack || 1;
    for (let i = 0; i < INVENTORY_SIZE && remaining > 0; i++) {
      const s = this.state.inventory[i];
      if (s && s.id === id) {
        const room = limit - s.count;
        const take = Math.min(room, remaining);
        if (take > 0) {
          s.count += take;
          remaining -= take;
        }
        continue;
      }
      if (s) continue;
      const take = Math.min(limit, remaining);
      this.state.inventory[i] = { id, count: take, damage: 0 };
      remaining -= take;
    }
    return remaining === 0;
  }

  removeItem(id: number, count = 1): boolean {
    let need = count;
    for (let i = 0; i < INVENTORY_SIZE && need > 0; i++) {
      const s = this.state.inventory[i];
      if (!s || s.id !== id) continue;
      const take = Math.min(s.count, need);
      s.count -= take;
      need -= take;
      if (s.count <= 0) this.state.inventory[i] = null;
    }
    return need === 0;
  }

  countItem(id: number): number {
    return this.state.inventory.reduce((n, s) => n + (s && s.id === id ? s.count : 0), 0);
  }

  hasItem(id: number, count = 1): boolean {
    return this.countItem(id) >= count;
  }

  freeSlots(): number {
    return this.state.inventory.filter((s) => !s || s.count <= 0).length;
  }

  /** The item currently held in the hotbar slot, or null. */
  heldItem(): ItemStack | null {
    const slot = this.state.hotbar[this.state.hotbarIndex];
    return slot === undefined ? null : this.state.inventory[slot];
  }

  heldWeapon(): ItemDef | null {
    const s = this.heldItem();
    return s ? ITEMS[s.id] : null;
  }

  cycleHotbar(delta: number): void {
    this.state.hotbarIndex = (this.state.hotbarIndex + delta + HOTBAR_SIZE) % HOTBAR_SIZE;
  }

  setHotbar(slot: number): void {
    if (slot >= 0 && slot < HOTBAR_SIZE) this.state.hotbarIndex = slot;
  }

  /** Equip a stack from the inventory into a gear slot, refunding the old one. */
  equip(inventoryIndex: number): boolean {
    const stack = this.state.inventory[inventoryIndex];
    if (!stack) return false;
    const gd = gearDef(stack.id);
    if (!gd) return false;
    const slot: GearSlot = gd.slot;
    const old = this.state.equipped[slot];
    this.state.equipped[slot] = {
      id: stack.id,
      affixes: (stack as unknown as EquippedItem).affixes,
      enchants: stack.enchants ? stack.enchants.slice() : undefined,
      upgrades: 0,
      damage: stack.damage || 0,
    };
    this.state.inventory[inventoryIndex] = null;
    if (old) this.addItem(old.id, 1);
    this.recompute();
    return true;
  }

  unequip(slot: GearSlot): boolean {
    const old = this.state.equipped[slot];
    if (!old) return false;
    if (!this.addItem(old.id, 1)) return false;
    delete this.state.equipped[slot];
    this.recompute();
    return true;
  }

  equippedItem(slot: GearSlot): ItemDef | null {
    const eq = this.state.equipped[slot];
    return eq ? ITEMS[eq.id] : null;
  }

  private consumeDurability(): void {
    const idx = this.state.hotbar[this.state.hotbarIndex];
    const held = idx === undefined ? null : this.state.inventory[idx];
    if (!held) return;
    const def = ITEMS[held.id];
    if (!def || !def.durability) return;
    held.damage = (held.damage || 0) + 1;
    if (held.damage >= def.durability) {
      this.state.inventory[idx] = null;
      this.bump('itemsBroken', 1);
    }
  }

  // ---------------------------------------------------------------- combat

  /** Attack: start the swing. Returns false if already swinging or unarmed. */
  attack(): boolean {
    const held = this.heldItem();
    const def = held ? ITEMS[held.id] : null;
    if (!held || !def || def.kind !== 'weapon') return false;
    if (this.swing > 0) return false;
    this.swing = 1;
    this.consumeDurability();
    return true;
  }

  /** Advance the swing clock; returns true the moment hits resolve. */
  updateSwing(dt: number): boolean {
    if (this.swing <= 0) return false;
    this.swing -= dt * 3.2;
    if (this.swing <= 0) {
      this.swing = 0;
      return true;
    }
    return false;
  }

  /** Damage the player deals with the held weapon. */
  attackDamage(): { amount: number; crit: boolean } {
    let amount = this.stats.flatDamage;
    const held = this.heldItem();
    if (held) {
      const def = ITEMS[held.id];
      if (def && def.kind === 'weapon') amount += def.damage || 1;
    }
    amount *= 1 + this.stats.percentDamage;
    const crit = Math.random() < this.stats.critChance;
    if (crit) amount *= 1 + this.stats.critDamage;
    const variance = 0.9 + Math.random() * 0.2;
    return { amount: Math.max(1, Math.round(amount * variance)), crit };
  }

  /** Hit one actor with the current attack. */
  hitActor(target: HitActor, opts: DamageOptions = {}): boolean {
    const { amount, crit } = this.attackDamage();
    target.takeDamage(amount, {
      ...opts,
      crit,
      from: { x: this.pos.x, y: this.pos.y + 1, z: this.pos.z },
      source: 'player',
    });
    this.bump('damageDealt', amount);
    if (this.stats.lifeOnHit > 0) this.heal(this.stats.lifeOnHit);
    this.consumeDurability();
    return true;
  }

  takeDamage(raw: number, opts: DamageOptions = {}): boolean {
    if (Math.random() < this.stats.dodge) return false;
    let amount = damageMitigation(this.stats.armor * (1 + this.stats.percentArmor), this.stats.toughness, raw);
    if (opts.crit) amount *= 1.4;
    amount *= 1 - this.stats.resistance;
    amount = Math.max(1, Math.round(amount));
    this.state.health -= amount;
    this.bump('damageTaken', amount);
    if (this.state.health <= 0 && opts.source !== 'fall') this.bump('deaths', 1);
    if (opts.from) {
      const dx = this.pos.x - opts.from.x;
      const dz = this.pos.z - opts.from.z;
      const len = Math.hypot(dx, dz) || 1;
      const kb = (opts.knockback || 1) * (1 + this.stats.knockback) * 5;
      this.vel.x += (dx / len) * kb;
      this.vel.z += (dz / len) * kb;
      if (!this.onGround) this.vel.y += kb * 0.35;
    }
    return true;
  }

  heal(amount: number): void {
    this.state.health = Math.min(this.stats.maxHealth, this.state.health + amount);
  }

  restoreMana(amount: number): void {
    this.state.mana = Math.min(this.stats.maxMana, this.state.mana + amount);
  }

  /**
   * Consume a potion or food stack from the inventory and apply its effect.
   *
   * A global cooldown gates both kinds. Without it a player can drink a whole
   * hotbar of potions in a single frame, which turns every fight into a race
   * to the bottom of the inventory; the cooldown is tunable so a player who
   * wants it gone can set it to zero.
   */
  consume(inventoryIndex: number): 'potion' | 'food' | null {
    if (this.consumeTimer > 0) return null;
    const stack = this.state.inventory[inventoryIndex];
    if (!stack) return null;
    const def = ITEMS[stack.id];
    if (!def) return null;
    this.consumeTimer = Math.max(0, balance.get('potionCooldown'));
    if (def.kind === 'potion') {
      this.removeItem(stack.id, 1);
      const kind = def.effect || 'health';
      if (kind === 'health') this.heal(Math.max(1, Math.round(this.stats.maxHealth * 0.45)));
      else if (kind === 'mana') this.restoreMana(Math.max(1, Math.round(this.stats.maxMana * 0.5)));
      else if (kind === 'stamina') this.state.stamina = MAX_STAMINA;
      else this.addEffect(kind, (def.duration || 30) * (1 + this.stats.buffDuration), def.amplifier || 0);
      this.bump('potionsUsed', 1);
      return 'potion';
    }
    if (def.kind === 'food') {
      this.removeItem(stack.id, 1);
      this.state.hunger = Math.min(20, (this.state.hunger || 20) + (def.food || 4));
      this.state.saturation = Math.min(10, (this.state.saturation || 2) + (def.saturation || 1));
      if (this.state.hunger >= 18 && this.state.health < this.stats.maxHealth) {
        this.heal(balance.get('hungerHeal'));
      }
      return 'food';
    }
    return null;
  }

  addEffect(id: string, time: number, amplifier: number): void {
    const existing = this.effects.find((e) => e.id === id);
    if (existing) {
      existing.time = Math.max(existing.time, time);
      existing.amplifier = Math.max(existing.amplifier, amplifier);
    } else {
      this.effects.push({ id, time, amplifier });
    }
  }

  tickEffects(dt: number): void {
    for (const e of this.effects) e.time -= dt;
    this.effects = this.effects.filter((e) => e.time > 0);
  }

  hasEffect(id: string): boolean {
    return this.effects.some((e) => e.id === id);
  }

  /** Seconds left before another potion or food can be consumed. */
  consumeTimer = 0;

  /**
   * Furnace fuel reservoir, in seconds.
   *
   * Kept as a running balance rather than a stack of fuel items so that a
   * half-burned piece of coal is still half a piece of coal when the player
   * comes back, and so a fuel item's advertised burn time is the only number
   * the smelting math has to read.
   */
  furnaceFuel = 0;

  /** Add fuel to the reservoir, returning how many seconds it provided. */
  addFuel(id: number, count = 1): number {
    const per = fuelSeconds(id);
    if (per <= 0) return 0;
    this.furnaceFuel += per * count;
    return per * count;
  }

  /** Find a burnable item in the inventory and burn one. */
  private burnFuel(): boolean {
    for (let i = 0; i < this.state.inventory.length; i++) {
      const stack = this.state.inventory[i];
      if (stack && isFuel(stack.id)) {
        this.addFuel(stack.id, 1);
        this.removeItem(stack.id, 1);
        return true;
      }
    }
    return false;
  }

  /**
   * Smelt one item from the inventory at a furnace.
   *
   * Returns what happened so the UI can answer honestly. A smelt needs both a
   * recipe and enough fuel; neither is silently skipped, because a furnace
   * that quietly does nothing is the exact failure this system exists to avoid.
   */
  smelt(inventoryIndex: number): 'smelted' | 'no-fuel' | 'nothing' {
    const stack = this.state.inventory[inventoryIndex];
    if (!stack) return 'nothing';
    const time = smeltSeconds(stack.id);
    if (time <= 0) return 'nothing';
    while (this.furnaceFuel < time && this.burnFuel()) { /* keep burning */ }
    if (this.furnaceFuel < time) return 'no-fuel';
    this.furnaceFuel -= time;
    this.removeItem(stack.id, 1);
    const out = smeltOutput(stack.id);
    if (!this.addItem(out, 1)) {
      this.addItem(stack.id, 1);
      this.furnaceFuel += time;
      return 'nothing';
    }
    this.bump('smelted', 1);
    this.progressQuest('smelt', String(out), 1);
    this.bumpAchievements();
    return 'smelted';
  }

  /** True when the inventory holds something a furnace can burn. */
  hasFuel(): boolean {
    return this.state.inventory.some((stack) => stack && isFuel(stack.id));
  }

  /**
   * Enchant an item at an enchanting table.
   *
   * `power` is the table's level, raised by nearby bookshelves. The enchantment
   * must suit the item's kind and must not already be on it, and the player pays
   * experience levels plus lapis. Both are spent from the same pool the rest of
   * progression uses, which is what keeps enchanting a decision rather than a
   * button you mash.
   */
  enchant(inventoryIndex: number, enchantId: string, power: number, lapis = 1): 'enchanted' | 'no-xp' | 'no-lapis' | 'incompatible' | 'already' | 'nothing' {
    const stack = this.state.inventory[inventoryIndex];
    if (!stack) return 'nothing';
    const def = ENCHANT_BY_ID.get(enchantId);
    if (!def) return 'nothing';
    const itemDef = ITEMS[stack.id];
    if (!itemDef || !enchantAppliesTo(def, itemDef.kind)) return 'incompatible';
    if ((stack.enchants || []).some((e) => e.id === enchantId)) return 'already';

    const level = Math.max(1, Math.min(def.maxLevel, power));
    const cost = enchantCost(enchantId, level);
    if (this.state.xp < cost) return 'no-xp';
    if (this.countItem(1036) < lapis) return 'no-lapis';

    this.removeItem(1036, lapis);
    this.spendXp(cost);
    const enchants = stack.enchants ? stack.enchants.slice() : [];
    enchants.push({ id: enchantId, level });
    stack.enchants = enchants;
    this.bump('enchantsApplied', 1);
    this.progressQuest('enchant', enchantId, 1);
    this.bumpAchievements();
    return 'enchanted';
  }

  /** Experience spent on enchanting, which is the only place it leaves. */
  spendXp(amount: number): boolean {
    if (this.state.xp < amount) return false;
    this.state.xp -= amount;
    return true;
  }

  /** Total enchantment levels worn, for the character sheet. */
  enchantPower(): number {
    return Object.values(this.state.equipped).reduce((sum, item) => sum + enchantTotal(item), 0);
  }

  /** Seconds of fuel left in the furnace reservoir. */
  get fuelLeft(): number { return this.furnaceFuel; }

  /** Advance cooldowns and passive regeneration. */
  updateResources(dt: number): void {
    // Every rate here is a tunable rather than a literal: the same run can be
    // a slow, careful survival or a fast, generous power trip, chosen from the
    // settings screen rather than from a rebuild.
    this.state.stamina = Math.min(MAX_STAMINA, this.state.stamina + balance.get('staminaRegen') * dt);
    this.state.mana = Math.min(this.stats.maxMana, this.state.mana + this.stats.manaRegen * balance.get('manaRegenScale') * dt);
    if (this.state.hunger > 0) {
      this.state.hunger = Math.max(0, this.state.hunger - dt * balance.get('hungerDrain'));
      if (this.state.saturation > 0) this.state.saturation = Math.max(0, this.state.saturation - dt * balance.get('hungerDrain'));
      else if (this.state.health < this.stats.maxHealth) {
        this.heal(balance.get('hungerHeal') * 0.4 * dt);
      }
    }
    if (this.consumeTimer > 0) this.consumeTimer = Math.max(0, this.consumeTimer - dt);
    this.bump('playtime', dt);
  }

  tickCooldowns(dt: number): void {
    for (const k of Object.keys(this.cooldowns)) {
      this.cooldowns[k] = Math.max(0, this.cooldowns[k] - dt);
    }
  }

  /** Apply a skill's cooldown at its current level. */
  applyCooldown(skillId: string): void {
    const def = SKILL_BY_ID.get(skillId) || null;
    if (!def || def.kind !== 'active') return;
    const lvl = this.state.skillLevels[skillId] || 1;
    const cd = (def.cooldown || 4) * Math.pow(def.cooldownScale || 0.85, lvl - 1);
    this.cooldowns[skillId] = cd * (1 - this.stats.cooldownReduction);
  }

  isReady(skillId: string): boolean {
    return (this.cooldowns[skillId] || 0) <= 0;
  }

  // ---------------------------------------------------------------- physics

  /** Move the player one frame against the voxel grid. */
  move(dt: number, input: PlayerInput, grid: TileReader): void {
    const s = this.stats;
    const sprinting = input.sprint && this.state.stamina > 1;
    const base = s.movementSpeed * (this.inWater ? 0.5 : input.sneak ? 0.45 : 1) * (sprinting ? 1.35 : 1);

    const cos = Math.cos(this.yaw), sin = Math.sin(this.yaw);
    const forward = { x: -sin, z: -cos };
    const right = { x: cos, z: -sin };
    let dx = (input.right - input.left) * right.x + (input.forward - input.back) * forward.x;
    let dz = (input.right - input.left) * right.z + (input.forward - input.back) * forward.z;
    const len = Math.hypot(dx, dz);
    if (len > 0) {
      dx /= len; dz /= len;
      const accel = this.onGround ? 62 : 20;
      const target = base * (this.inWater ? 0.6 : 1);
      const k = Math.min(1, accel * dt);
      this.vel.x += (dx * target - this.vel.x) * k;
      this.vel.z += (dz * target - this.vel.z) * k;
    } else {
      const damp = Math.pow(0.002, dt);
      this.vel.x *= damp;
      this.vel.z *= damp;
    }

    // Dash: a burst of speed on the aim vector, on its own cooldown.
    if (input.dash && this.state.stats.dashReady > 0 && (dx || dz || input.forward || input.back)) {
      this.vel.x = (dx || forward.x) * s.movementSpeed * 3.4;
      this.vel.z = (dz || forward.z) * s.movementSpeed * 3.4;
      this.vel.y = 6.5;
      this.state.stats.dashReady = 0;
    }

    const gravity = this.inWater ? -9 : -28;
    this.vel.y += gravity * dt;
    if (this.inWater) this.vel.y = Math.max(this.vel.y, -4.2);
    if (input.jump && this.onGround && !this.inWater) this.vel.y = 8.4;
    else if (input.jump && this.inWater && this.vel.y < 3.6) this.vel.y = 3.6;

    const half = { x: 0.3, y: 0.9, z: 0.3 };
    const step = Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z), 0.45) * dt;
    const sub = Math.min(8, Math.ceil(step / 0.45)) || 1;
    const sdt = dt / sub;
    for (let i = 0; i < sub; i++) {
      moveAABB(grid, this.pos, half, this.vel.x * sdt, 0, 0);
      moveAABB(grid, this.pos, half, 0, this.vel.y * sdt, 0);
      moveAABB(grid, this.pos, half, 0, 0, this.vel.z * sdt);
      if (this.vel.y < 0 && !this.onGround) {
        // Landing is detected by a blocked downward move, so stop the fall here
        // rather than letting it accumulate through the rest of the substeps.
        break;
      }
    }
    if (this.vel.y < 0 && this.onGround) this.vel.y = 0;

    const feet = Math.floor(this.pos.y);
    const tile = grid.get(Math.floor(this.pos.x), feet, Math.floor(this.pos.z));
    this.inWater = tile === 190 || tile === 191 || tile === 194;
    const wasGround = this.onGround;
    this.onGround = this.vel.y <= 0.02;
    if (!wasGround && this.onGround) this.bump('landImpacts', 1);
  }

  /** Called when the player enters a new region. */
  visitRegion(id: number): void {
    if (this.state.visitedRegions.includes(id)) return;
    this.state.visitedRegions.push(id);
    this.bump('regionsVisited', 1);
  }

  bump(key: string, amount: number): void {
    this.state.stats[key] = (this.state.stats[key] || 0) + amount;
    this.bumpAchievements();
  }

  // ---------------------------------------------------------------- quests

  acceptQuest(id: string): boolean {
    const def = QUEST_BY_ID.get(id);
    if (!def || this.state.quests[id]) return false;
    if (this.state.level < def.tier) return false;
    if (!def.prerequisites.every((p) => this.state.quests[p] && this.state.quests[p].done)) return false;
    this.state.quests[id] = { accepted: true, done: false, claimed: false, counts: {} };
    return true;
  }

  /** Progress one of a quest's objectives. */
  progressQuest(kind: string, target: string, amount = 1): void {
    const key = `${kind}:${target}`;
    for (const q of Object.values(this.state.quests)) {
      if (q.claimed) continue;
      q.counts[key] = (q.counts[key] || 0) + amount;
    }
    this.bumpAchievements();
  }

  /** Objectives an accepted quest still needs, for the checklist. */
  questCounters(id: string): { kind: string; target: string; text: string; have: number; need: number; done: boolean }[] {
    const def = QUEST_BY_ID.get(id);
    const q = this.state.quests[id];
    if (!def || !q) return [];
    return def.objectives.map((o) => {
      const have = q.counts[`${o.kind}:${o.target}`] || 0;
      return { ...o, have: Math.min(have, o.count), need: o.count, done: have >= o.count };
    });
  }

  /** Whether every objective of an accepted quest is satisfied. */
  questReadyToClaim(id: string): boolean {
    const q = this.state.quests[id];
    const def = QUEST_BY_ID.get(id);
    if (!q || !def) return false;
    return def.objectives.every((o) => (q.counts[`${o.kind}:${o.target}`] || 0) >= o.count);
  }

  claimQuest(id: string): { xp: number; coins: number; items: [number, number][]; title?: string } | null {
    const q = this.state.quests[id];
    const def = QUEST_BY_ID.get(id);
    if (!q || !def || q.claimed || !this.questReadyToClaim(id)) return null;
    q.claimed = true;
    q.done = true;
    const reward = def.rewards;
    const xp = reward.xp;
    this.gainXp(xp);
    for (const [itemId, count] of reward.items) this.addItem(itemId, count);
    if (reward.skillPoints) this.state.skillPoints += reward.skillPoints;
    if (reward.title && !this.state.titles.includes(reward.title)) this.state.titles.push(reward.title);
    if (def.gatesBoss) this.bump(`bossGates:${def.gatesBoss}`, 1);
    this.bumpAchievements();
    return { xp, coins: reward.coins, items: reward.items, title: reward.title };
  }

  /** Quests a player may still accept. */
  availableQuests(): string[] {
    const out: string[] = [];
    for (const def of QUESTS) {
      if (this.state.quests[def.id]) continue;
      if (this.state.level < def.tier) continue;
      if (!def.prerequisites.every((p) => this.state.quests[p] && this.state.quests[p].done)) continue;
      out.push(def.id);
    }
    return out;
  }

  /** Active quest ids (accepted, not yet claimed). */
  activeQuests(): string[] {
    return Object.keys(this.state.quests).filter((id) => {
      const q = this.state.quests[id];
      return q.accepted && !q.claimed;
    });
  }

  // ---------------------------------------------------------------- achievements

  /** Scan every counter against the achievement table. */
  bumpAchievements(): string[] {
    const fresh: string[] = [];
    for (const def of ACHIEVEMENT_BY_ID.values()) {
      if (this.state.achievements.includes(def.id)) continue;
      const have = this.state.stats[def.check] || 0;
      const need = def.count ?? 1;
      if (have >= need) {
        this.state.achievements.push(def.id);
        for (const t of TITLES) {
          if (t.from !== def.id) continue;
          const name = t.name || t.id;
          if (!this.state.titles.includes(name)) this.state.titles.push(name);
        }
        this.bump('achievements', 1);
        fresh.push(def.id);
      }
    }
    return fresh;
  }

  unlockAchievement(id: string): boolean {
    if (this.state.achievements.includes(id)) return false;
    const def = ACHIEVEMENT_BY_ID.get(id);
    if (!def) return false;
    this.state.achievements.push(id);
    this.bump('achievements', 1);
    for (const t of TITLES) {
      if (t.from !== id) continue;
      const name = t.name || t.id;
      if (!this.state.titles.includes(name)) this.state.titles.push(name);
    }
    return true;
  }

  /** Titles a player is eligible for but has not taken. */
  availableTitles(): { id: string; name: string }[] {
    return TITLES.filter((t) => this.state.titles.includes(t.id)).map((t) => ({ id: t.id, name: t.name }));
  }

  // ---------------------------------------------------------------- save

  snapshot(): PlayerState {
    return {
      ...this.state,
      stats: { ...this.state.stats },
      inventory: this.state.inventory.map((s) => (s ? { ...s } : null)),
      equipped: { ...this.state.equipped },
      quests: Object.fromEntries(
        Object.entries(this.state.quests).map(([k, v]) => [k, { ...v, counts: { ...v.counts } }]),
      ),
      position: [this.pos.x, this.pos.y, this.pos.z],
      yaw: this.yaw,
      pitch: this.pitch,
    };
  }

  restore(state: PlayerState): void {
    this.state = state;
    this.pos = { x: state.position[0], y: state.position[1], z: state.position[2] };
    this.yaw = state.yaw;
    this.pitch = state.pitch;
    this.recompute();
  }

  /** A fresh character at the world spawn. */
  static create(name: string, position: [number, number, number], seed: number): PlayerState {
    const attrs: Attributes = { strength: 10, dexterity: 10, constitution: 12, intelligence: 8, wisdom: 8 };
    const s: PlayerState = {
      name: name || 'Wanderer',
      level: 1,
      xp: 0,
      attributes: attrs,
      attributePoints: 3,
      skillPoints: 0,
      skillLevels: {},
      activeSkills: [],
      health: 20,
      mana: 20,
      stamina: MAX_STAMINA,
      hunger: 20,
      saturation: 5,
      inventory: new Array(INVENTORY_SIZE).fill(null),
      equipped: {},
      hotbar: [0, 1, 2, 3, 4, 5, 6, 7, 8],
      hotbarIndex: 0,
      achievements: [],
      titles: [],
      quests: {},
      codex: [],
      stats: { dashReady: 1, steps: 0 },
      position,
      yaw: Math.PI * 0.25,
      pitch: -0.15,
      playtime: 0,
      worldSeed: seed,
      visitedRegions: [0],
      unlockedDungeons: [],
    };
    // Starter kit: a sword, a bow with arrows, two potions, a shield, planks.
    // Starter kit. Every id here was checked against the item registry rather
    // than trusted: the kit used to hand out a tier-5 Netherite Axe (1014), a
    // Book (1400), Nether Brick Stairs (1500) and a shovel (1015) — a god-tier
    // tool and no bow, no potion and no shield, which broke the first ten
    // minutes and the power curve behind them.
    s.inventory[0] = { id: 1022, count: 1, damage: 0 };   // Wooden Sword
    s.inventory[1] = { id: 1410, count: 1, damage: 0 };   // Bow
    s.inventory[2] = { id: 1415, count: 16, damage: 0 };  // Arrows
    s.inventory[3] = { id: 1302, count: 2, damage: 0 };   // Potions of Healing
    s.inventory[4] = { id: 1028, count: 1, damage: 0 };   // Wooden Shield
    s.inventory[5] = { id: 1004, count: 32, damage: 0 };  // Wooden Planks
    return s;
  }
}

export { ITEMS, rollAffixes, attributeLevelFor, ATTRIBUTE_KEYS, ATTRIBUTE_LABEL, ATTRIBUTE_DESC };
export type { StatBlock, Attributes };
