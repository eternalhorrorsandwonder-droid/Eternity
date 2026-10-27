/**
 * Enemies.
 *
 * One class, a small state machine on top, and a `kind` switch for the way each
 * creature moves. A charger telegraphs before it runs; a flyer holds altitude
 * and dives; an ambush predator waits in the dark; a summoner banks on its
 * minions outliving you. None of that is cosmetic — the tell is the thing the
 * player learns to read, so the same enemy type behaves the same way whether
 * you meet one in a dungeon or on a windswept ridge.
 *
 * Every enemy implements `HitActor`, so the player's attack code is written
 * once against an interface rather than against a concrete class.
 */

import * as THREE from 'three';
import { AABB, aabbOverlap, moveAABB, type TileReader } from '../../engine/core/Collision';
import { RNG } from '../../engine/core/RNG';
import { resolveEnemy, type EnemyDef } from '../data/Enemies';
import { ITEMS } from '../data/Items';
import { xpForTier } from '../systems/Stats';
import type { DamageOptions, HitActor } from './Player';

/** What an enemy needs in order to damage something. */
export interface DamageTaker {
  pos: { x: number; y: number; z: number };
  takeDamage(amount: number, opts: DamageOptions): boolean;
  addEffect?(id: string, time: number, amplifier: number): void;
  alive?: boolean;
}

/** A delayed, targeted effect an enemy can queue. */
interface RangedAttack { x: number; y: number; z: number; time: number; venom?: boolean; }
interface Explosion { time: number; radius: number; }

const KNOCKBACK_BASE = 6;

export interface EnemySpawn {
  id: string;
  x: number;
  y: number;
  z: number;
}

export class Enemy implements HitActor {
  readonly def: EnemyDef;
  readonly id: string;
  /** Unique instance id, so two of the same creature can be told apart. */
  readonly uid: string;
  pos = { x: 0, y: 0, z: 0 };
  vel = { x: 0, y: 0, z: 0 };
  /** Half extents of the collision box. */
  half = { x: 0.4, y: 0.9, z: 0.4 };
  hp: number;
  maxHp: number;
  alive = true;
  /** Current behaviour state. */
  state: 'idle' | 'chase' | 'attack' | 'hurt' | 'stagger' | 'flee' | 'dead' = 'idle';
  /** AI timers, reused per state. */
  timer = 0;
  /** Time since the last attack resolved. */
  attackCd = 0;
  /** Telegraph counter for chargers and pouncers. */
  tell = 0;
  /** Vertical bob for flyers, also drives the idle hover. */
  bob = 0;
  /** Last damage taken, for the flash effect. */
  lastDamage = 0;
  /** Level the enemy was spawned at; drives scaling. */
  level = 1;
  /** Dungeon or region this enemy belongs to, for music and scoring. */
  zone = '';
  /** Boss flag, which unlocks the arena behaviours. */
  readonly boss: boolean;
  /** Whether this enemy counts toward quest kill objectives. */
  questKillable = true;
  /** Whether this creature counts toward kill counters at all. */
  counted = true;
  /** Whether the enemy is currently grounded. */
  onGround = false;
  /** Player's rare-find bonus, applied when this enemy rolls drops. */
  rareFind = 0;
  /** Mesh material, created by the scene when the mesh is built. */
  mat: THREE.MeshStandardMaterial | null = null;
  /** Cached mesh, so the scene can re-skin it. */
  mesh: THREE.Object3D | null = null;

  private rangedHit: RangedAttack | null = null;
  private explosion: Explosion | null = null;
  private minions: Enemy[] = [];
  private home: { x: number; y: number; z: number };
  private rng: RNG;
  private staggerUntil = 0;

  constructor(def: EnemyDef, spawn: EnemySpawn, level: number, zone = '', rngSeed?: number) {
    this.def = def;
    this.id = def.id;
    this.uid = `${def.id}#${(rngSeed ?? Math.floor(Math.random() * 1e9)).toString(36)}`;
    this.pos = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.home = { x: spawn.x, y: spawn.y, z: spawn.z };
    this.rng = new RNG(rngSeed ?? Math.floor(Math.random() * 0xffffffff));
    this.level = level;
    this.zone = zone;
    this.boss = def.kind === 'boss' || def.tier >= 10;
    this.scale();
    this.half = { x: Math.max(0.28, def.size * 0.45), y: Math.max(0.5, def.size), z: Math.max(0.28, def.size * 0.45) };
  }

  /** Recompute health from the spawned level. */
  private scale(): void {
    const k = 1 + (this.level - 1) * 0.13;
    this.maxHp = Math.round(this.def.health * k * (this.boss ? 1 : 0.9));
    this.hp = this.maxHp;
    this.attackCd = 0;
  }

  // ---------------------------------------------------------------- HitActor

  takeDamage(amount: number, opts: DamageOptions = {}): void {
    if (!this.alive) return;
    this.hp -= amount;
    this.lastDamage = amount;
    if (this.hp <= 0) {
      this.die(opts);
      return;
    }
    this.state = 'hurt';
    this.timer = 0;
    if (opts.from) {
      const dx = this.pos.x - opts.from.x;
      const dz = this.pos.z - opts.from.z;
      const len = Math.hypot(dx, dz) || 1;
      const kb = (opts.knockback || 1) * KNOCKBACK_BASE;
      this.vel.x += (dx / len) * kb;
      this.vel.z += (dz / len) * kb;
      if (opts.crit) this.vel.y = Math.max(this.vel.y, 3.5);
    }
  }

  /** A heavy blow stuns instead of just pushing. */
  stagger(duration = 0.35): void {
    this.state = 'stagger';
    this.staggerUntil = duration;
    this.vel.x *= 0.3;
    this.vel.z *= 0.3;
  }

  private die(opts: DamageOptions): void {
    this.alive = false;
    this.state = 'dead';
    for (const m of this.minions) m.die({});
    this.minions = [];
  }

  // ---------------------------------------------------------------- AI

  /**
   * Run one frame of behaviour. `player` is null when nothing is nearby, in
   * which case the enemy idles or patrols.
   */
  update(dt: number, grid: TileReader, player: DamageTaker | null): void {
    if (!this.alive) return;
    this.attackCd = Math.max(0, this.attackCd - dt);
    this.timer -= dt;
    this.staggerUntil -= dt;
    this.bob += dt;
    this.tickEffects(dt, player);

    const dist = player ? Math.hypot(
      this.pos.x - player.pos.x, this.pos.y - player.pos.y, this.pos.z - player.pos.z,
    ) : Infinity;

    if (dist < 34 && player) this.target = player.pos;
    else if (dist >= 34) this.target = null;

    if (this.staggerUntil > 0) {
      this.vel.x *= 0.85;
      this.vel.z *= 0.85;
      this.physics(dt, grid);
      return;
    }

    switch (this.state) {
      case 'idle': this.idle(dt, dist); break;
      case 'chase': this.chase(dt, grid, player, dist); break;
      case 'attack': this.attack(dt, grid, player, dist); break;
      case 'hurt': this.hurt(dist); break;
      case 'flee': this.flee(dt, dist); break;
      default: break;
    }
    this.physics(dt, grid);
  }

  private target: { x: number; y: number; z: number } | null = null;

  /** The point the enemy is steering toward, if any. */
  get aggroTarget(): { x: number; y: number; z: number } | null { return this.target; }

  private idle(dt: number, dist: number): void {
    if (dist < 26) {
      this.state = 'chase';
      return;
    }
    // Slow wander, biased toward the spawn so the world never empties out.
    if (this.timer <= 0) {
      this.timer = 1.5 + this.rng.nextFloat() * 2;
      this.vel.x = (this.rng.nextFloat() - 0.5) * 0.8;
      this.vel.z = (this.rng.nextFloat() - 0.5) * 0.8;
    }
  }

  private hurt(dist: number): void {
    if (this.timer <= 0) {
      this.state = dist < 40 ? 'chase' : 'idle';
    }
  }

  private flee(dt: number, dist: number): void {
    if (dist > 22) {
      this.state = 'idle';
      return;
    }
    const dx = this.pos.x - (this.target?.x || this.pos.x);
    const dz = this.pos.z - (this.target?.z || this.pos.z);
    const len = Math.hypot(dx, dz) || 1;
    this.vel.x = (dx / len) * this.def.speed * 0.9;
    this.vel.z = (dz / len) * this.def.speed * 0.9;
  }

  private chase(
    dt: number,
    grid: TileReader,
    player: DamageTaker | null,
    dist: number,
  ): void {
    if (!player) {
      this.state = 'idle';
      return;
    }
    const speed = this.def.speed * (this.boss ? 0.85 : 1) * (this.hp < this.maxHp * 0.3 ? 0.75 : 1);

    switch (this.def.kind) {
      case 'flyer':
        this.chaseFlyer(dt, player, dist, speed);
        return;
      case 'charger':
        this.chaseCharger(dt, player, dist, speed);
        return;
      case 'ranged':
      case 'caster':
        this.chaseRanged(dt, player, dist, speed);
        return;
      case 'summoner':
        this.chaseSummoner(dt, player, dist, speed);
        return;
      case 'bruiser':
        this.chaseBruiser(dt, player, dist, speed);
        return;
      case 'ambush':
        this.chaseAmbush(dt, player, dist, speed);
        return;
      default:
        this.chaseMelee(dt, player, dist, speed);
    }
  }

  private chaseFlyer(dt: number, player: DamageTaker, dist: number, speed: number): void {
    const desiredY = player.pos.y + 2.2;
    this.vel.y += (desiredY - this.pos.y) * 2.6 * dt;
    this.vel.y = Math.max(-6, Math.min(6, this.vel.y));
    if (dist < 3.2 && this.attackCd <= 0) {
      this.state = 'attack';
      return;
    }
    this.aimAt(player.pos, speed, dt);
  }

  private chaseCharger(dt: number, player: DamageTaker, dist: number, speed: number): void {
    if (this.tell > 0) {
      this.tell -= dt;
      this.vel.x *= 0.7;
      this.vel.z *= 0.7;
      return;
    }
    if (dist > 2.4) this.aimAt(player.pos, speed * 1.6, dt);
    else {
      this.vel.x *= 0.6;
      this.vel.z *= 0.6;
    }
    if (dist < 3.6 && this.attackCd <= 0) {
      this.state = 'attack';
      return;
    }
    if (dist < 14 && this.timer <= 0) {
      this.tell = 0.75;
      this.timer = 2.4;
    }
  }

  private chaseRanged(dt: number, player: DamageTaker, dist: number, speed: number): void {
    const ideal = this.def.kind === 'caster' ? 11 : 9;
    const dx = this.pos.x - player.pos.x;
    const dz = this.pos.z - player.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    if (dist > ideal + 2) {
      this.vel.x = (dx / len) * speed * 0.8;
      this.vel.z = (dz / len) * speed * 0.8;
    } else if (dist < ideal - 2) {
      this.vel.x = -(dx / len) * speed * 0.9;
      this.vel.z = -(dz / len) * speed * 0.9;
    } else {
      this.vel.x *= 0.7;
      this.vel.z *= 0.7;
    }
    if (dist < 16 && this.attackCd <= 0) this.state = 'attack';
  }

  private chaseSummoner(dt: number, player: DamageTaker, dist: number, speed: number): void {
    // Keeps its distance and banks on minions doing the work.
    if (dist > 12) this.aimAt(player.pos, speed, dt);
    else {
      this.vel.x = (this.pos.x - player.pos.x) * 0.6;
      this.vel.z = (this.pos.z - player.pos.z) * 0.6;
    }
    if (this.attackCd <= 0 && dist < 18) {
      if (this.minions.length < 4) this.spawnMinions(2);
      this.state = 'attack';
    }
  }

  private chaseBruiser(dt: number, player: DamageTaker, dist: number, speed: number): void {
    if (dist > 2.6) this.aimAt(player.pos, speed * 0.85, dt);
    else {
      this.vel.x *= 0.6;
      this.vel.z *= 0.6;
    }
    if (dist < 4 && this.attackCd <= 0) this.state = 'attack';
  }

  private chaseAmbush(dt: number, player: DamageTaker, dist: number, speed: number): void {
    if (dist > 2.2) this.aimAt(player.pos, speed, dt);
    else {
      this.vel.x *= 0.6;
      this.vel.z *= 0.6;
    }
    if (dist < 3.4 && this.attackCd <= 0) this.state = 'attack';
  }

  private chaseMelee(dt: number, player: DamageTaker, dist: number, speed: number): void {
    if (dist < 2.6) {
      this.vel.x *= 0.6;
      this.vel.z *= 0.6;
    } else {
      this.aimAt(player.pos, speed, dt);
    }
    if (dist < 3.4 && this.attackCd <= 0) this.state = 'attack';
  }

  private aimAt(target: { x: number; y: number; z: number }, speed: number, dt: number): void {
    const dx = target.x - this.pos.x;
    const dz = target.z - this.pos.z;
    const len = Math.hypot(dx, dz) || 1;
    this.vel.x += ((dx / len) * speed - this.vel.x) * Math.min(1, 4 * dt);
    this.vel.z += ((dz / len) * speed - this.vel.z) * Math.min(1, 4 * dt);
  }

  private attack(
    dt: number,
    grid: TileReader,
    player: DamageTaker | null,
    dist: number,
  ): void {
    if (!player) {
      this.state = 'chase';
      return;
    }
    if (dist > 6.5 && this.def.kind !== 'ranged' && this.def.kind !== 'caster') {
      this.state = 'chase';
      return;
    }
    if (this.attackCd > 0) {
      this.vel.x *= 0.6;
      this.vel.z *= 0.6;
      return;
    }
    this.attackCd = this.boss ? 1.5 : 1.1;
    this.timer = 0;
    this.resolveAttack(player, dist);
    void grid;
  }

  /** Deal damage to the player, or queue a ranged effect. */
  private resolveAttack(player: DamageTaker, dist: number): void {
    const def = this.def;
    const dmg = def.damage * (1 + (this.level - 1) * 0.11) * (dist < 2.6 ? 1.2 : 1);
    const ability = def.abilities.length
      ? def.abilities[Math.floor(this.rng.nextFloat() * def.abilities.length)]
      : '';

    if (def.kind === 'ranged' || def.kind === 'caster') {
      this.rangedHit = {
        x: player.pos.x,
        y: player.pos.y + 1,
        z: player.pos.z,
        time: def.kind === 'caster' ? 0.4 : 0.25,
        venom: ability === 'Venom' || ability === 'Curse',
      };
      return;
    }

    if (ability === 'Charge' || ability === 'Pounce') {
      this.vel.x = ((player.pos.x - this.pos.x) / (dist || 1)) * 12;
      this.vel.z = ((player.pos.z - this.pos.z) / (dist || 1)) * 12;
      this.vel.y = 5.5;
    } else if (ability === 'Venom' || ability === 'Poison') {
      player.addEffect?.('poison', 4, 0);
    } else if (ability === 'Web Shot' || ability === 'Snare') {
      this.rangedHit = { x: player.pos.x, y: player.pos.y, z: player.pos.z, time: 0.35, venom: true };
    } else if (ability === 'Swarm' || ability === 'Summon') {
      this.spawnMinions(2);
    } else if (ability === 'Spit' || ability === 'Acid') {
      this.rangedHit = { x: player.pos.x, y: player.pos.y + 0.5, z: player.pos.z, time: 0.3 };
    } else if (ability === 'Explosion' || ability === 'Self Destruct') {
      this.explosion = { time: 0.45, radius: 4 };
    }

    this.dealDamageTo(player, dmg * 0.9);
  }

  /** Damage a target through the same interface the player exposes. */
  private dealDamageTo(target: DamageTaker, amount: number): void {
    target.takeDamage(amount, {
      from: { x: this.pos.x, y: this.pos.y + 0.5, z: this.pos.z },
      source: this.id,
      knockback: 0.6 + (this.def.size - 0.4) * 0.4,
    });
  }

  private spawnMinions(count: number): void {
    for (let i = 0; i < count; i++) {
      const ox = (this.rng.nextFloat() - 0.5) * 4;
      const oz = (this.rng.nextFloat() - 0.5) * 4;
      const minion = new Enemy(this.def, {
        id: this.def.id,
        x: this.pos.x + ox,
        y: this.pos.y,
        z: this.pos.z + oz,
      }, Math.max(1, this.level - 1), this.zone, this.rng.next());
      minion.questKillable = false;
      minion.counted = false;
      this.minions.push(minion);
    }
  }

  /** Minions spawned by this enemy, for the scene to update. */
  get minionList(): Enemy[] {
    return this.minions;
  }

  /** Advance queued effects: ranged shots landing and self-destructs. */
  tickEffects(dt: number, player: DamageTaker | null): void {
    if (this.rangedHit) {
      this.rangedHit.time -= dt;
      if (this.rangedHit.time <= 0) {
        const hit = this.rangedHit;
        this.rangedHit = null;
        if (player) {
          const dx = player.pos.x - hit.x;
          const dz = player.pos.z - hit.z;
          if (Math.hypot(dx, dz) < 2.4) {
            player.takeDamage(this.def.damage * (1 + (this.level - 1) * 0.1), {
              from: { x: this.pos.x, y: this.pos.y, z: this.pos.z },
              source: this.id,
            });
            if (hit.venom) player.addEffect?.('poison', 3, 0);
          }
        }
      }
    }
    if (this.explosion) {
      this.explosion.time -= dt;
      if (this.explosion.time <= 0) {
        const r = this.explosion.radius;
        if (player && Math.hypot(player.pos.x - this.pos.x, player.pos.z - this.pos.z) < r) {
          player.takeDamage(this.def.damage * 1.8, {
            from: { x: this.pos.x, y: this.pos.y, z: this.pos.z },
            source: this.id,
            knockback: 2,
          });
        }
        this.explosion = null;
        this.die({});
      }
    }
  }

  // ---------------------------------------------------------------- physics

  /** Advance one frame of movement against the voxel grid. */
  physics(dt: number, grid: TileReader): void {
    const fly = this.def.kind === 'flyer' || this.boss;
    const gravity = fly ? -12 : -28;
    this.vel.y += gravity * dt;
    if (!fly) this.vel.y = Math.max(this.vel.y, -28);

    const half = this.half;
    const step = Math.max(Math.abs(this.vel.x), Math.abs(this.vel.y), Math.abs(this.vel.z), 0.4) * dt;
    const sub = Math.min(6, Math.ceil(step / 0.4)) || 1;
    const sdt = dt / sub;
    for (let i = 0; i < sub; i++) {
      moveAABB(grid, this.pos, half, this.vel.x * sdt, 0, 0);
      moveAABB(grid, this.pos, half, 0, this.vel.y * sdt, 0);
      moveAABB(grid, this.pos, half, 0, 0, this.vel.z * sdt);
      if (this.vel.y < 0 && Math.abs(this.vel.y * sdt) < 0.02) {
        this.vel.y = 0;
        break;
      }
    }
    this.vel.x *= Math.pow(0.25, dt);
    this.vel.z *= Math.pow(0.25, dt);
    if (!fly) {
      // Keep a grounded enemy from drifting off its spawn.
      const dx = this.home.x - this.pos.x;
      const dz = this.home.z - this.pos.z;
      if (Math.hypot(dx, dz) > 32 && this.state === 'idle') {
        this.vel.x += dx * 0.2 * dt;
        this.vel.z += dz * 0.2 * dt;
      }
    }
    this.onGround = this.vel.y === 0;
  }

  // ---------------------------------------------------------------- helpers

  /** Axis-aligned box for spawn checks and projection attacks. */
  box(): AABB {
    return {
      minX: this.pos.x - this.half.x, maxX: this.pos.x + this.half.x,
      minY: this.pos.y - this.half.y, maxY: this.pos.y + this.half.y,
      minZ: this.pos.z - this.half.z, maxZ: this.pos.z + this.half.z,
    };
  }

  /** Whether the player's attack box overlaps this enemy. */
  hits(box: AABB): boolean {
    return aabbOverlap(box, this.box());
  }

  /** Whether the player's aim ray passes close to this enemy. */
  inSightOf(px: number, py: number, pz: number, yaw: number, range: number): boolean {
    const dx = this.pos.x - px;
    const dz = this.pos.z - pz;
    const dist = Math.hypot(dx, dz);
    if (dist > range) return false;
    const angle = Math.atan2(dx, dz);
    let diff = angle - yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return Math.abs(diff) < 0.85;
  }

  /** How much experience this enemy awards. */
  experience(): number {
    return Math.round(xpForTier(this.def.tier) * (1 + (this.level - 1) * 0.08) * (this.boss ? 8 : 1));
  }

  /** Drop table rolls, as `{ id, count }[]`. */
  rolls(): { id: number; count: number }[] {
    const out: { id: number; count: number }[] = [];
    for (const [itemId, chance] of this.def.drops) {
      if (Math.random() < chance * (1 + this.rareFind)) {
        out.push({ id: itemId, count: 1 + Math.floor(Math.random() * Math.max(1, (ITEMS[itemId]?.stack || 1) / 8)) });
      }
    }
    return out;
  }

  /** Whether this creature can appear in the open world. */
  static canSpawnOutdoors(def: EnemyDef): boolean {
    return def.outdoor;
  }

  /** Build an enemy from an alias id, resolving to its canonical definition. */
  static fromId(id: string, spawn: EnemySpawn, level: number, zone = '', rngSeed?: number): Enemy | null {
    const def = resolveEnemy(id);
    if (!def) return null;
    return new Enemy(def, spawn, level, zone, rngSeed);
  }
}
