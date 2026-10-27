/**
 * The player character.
 *
 * A blocky humanoid built from nine axis-aligned boxes parented to pivot
 * groups, so every limb rotates about a real joint. Animation is fully
 * procedural — there are no keyframes and no skeleton — driven by a small set
 * of phase accumulators that the game updates from gameplay state.
 *
 * That keeps the character cheap (one draw call, ~150 triangles) and lets the
 * same rig express idle breathing, a running gait, a tucked jump, an overhead
 * slash, a dash lean and a hurt recoil without a single asset file.
 */

import * as THREE from 'three';

export interface PlayerAnimState {
  /** Current horizontal speed in blocks/second. */
  speed: number;
  /** Normalised direction the player is facing, as an angle in radians. */
  yaw: number;
  grounded: boolean;
  airborne: boolean;
  /** 0..1 progress of the current attack swing. */
  attack: number;
  attacking: boolean;
  /** Hit-flash timer, seconds. */
  hurt: number;
  /** Sprint multiplier. */
  sprint: number;
  /** World time, for idle breathing phase. */
  time: number;
  /** Dash in progress. */
  dashing: number;
  /** Swimming / falling through liquid. */
  inLiquid: number;
}

interface Bone {
  mesh: THREE.Mesh;
  pivot: THREE.Group;
  /** Local rest rotation. */
  rest: THREE.Euler;
}

export class PlayerModel {
  root: THREE.Group;
  private parts: Record<string, Bone> = {};
  sword: THREE.Group;
  shield: THREE.Group;
  /** Attachment point for the held item. */
  handR: THREE.Group;
  handL: THREE.Group;

  /** Rest pose angles, radians, used as the baseline for every animation. */
  private restAngles = {
    headX: 0, headY: 0, headZ: 0,
    torsoX: 0, torsoY: 0, torsoZ: 0,
    armLX: 0, armLY: 0, armLZ: -0.12,
    armRX: 0, armRY: 0, armRZ: 0.14,
    legLX: 0, legLY: 0, legLZ: 0,
    legRX: 0, legRY: 0, legRZ: 0,
  };

  constructor(materials: {
    skin: THREE.Material; cloth: THREE.Material; pants: THREE.Material;
    boots: THREE.Material; hair: THREE.Material; sword: THREE.Material;
  }) {
    this.root = new THREE.Group();
    const mk = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => {
      const g = new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(g, mat);
      mesh.position.set(x, y, z);
      return mesh;
    };

    // ---- legs ---------------------------------------------------------
    const legGeo = { w: 0.22, h: 0.62, d: 0.24 };
    const legL = this.addBone('legL', new THREE.Group());
    legL.mesh = mk(legGeo.w, legGeo.h, legGeo.d, materials.pants, 0, -legGeo.h / 2, 0);
    legL.pivot.add(legL.mesh);
    const bootL = mk(0.24, 0.12, 0.26, materials.boots, 0, -legGeo.h + 0.04, 0);
    legL.pivot.add(bootL);
    legL.pivot.position.set(0.13, 0.62, 0);

    const legR = this.addBone('legR', new THREE.Group());
    legR.mesh = mk(legGeo.w, legGeo.h, legGeo.d, materials.pants, 0, -legGeo.h / 2, 0);
    legR.pivot.add(legR.mesh);
    const bootR = mk(0.24, 0.12, 0.26, materials.boots, 0, -legGeo.h + 0.04, 0);
    legR.pivot.add(bootR);
    legR.pivot.position.set(-0.13, 0.62, 0);

    // ---- torso --------------------------------------------------------
    const torso = this.addBone('torso', new THREE.Group());
    torso.pivot.position.set(0, 1.0, 0);
    const chest = mk(0.62, 0.72, 0.36, materials.cloth, 0, 0.36, 0);
    torso.pivot.add(chest);
    torso.pivot.add(mk(0.66, 0.42, 0.4, materials.cloth, 0, 0.14, 0));
    const belt = mk(0.64, 0.1, 0.38, materials.pants, 0, 0.02, 0);
    torso.pivot.add(belt);
    this.root.add(torso.pivot);

    // ---- arms --------------------------------------------------------
    const armGeo = { w: 0.18, h: 0.6, d: 0.2 };
    const armL = this.addBone('armL', new THREE.Group());
    armL.pivot.position.set(0.38, 1.32, 0);
    armL.mesh = mk(armGeo.w, armGeo.h, armGeo.d, materials.cloth, 0, -armGeo.h / 2, 0);
    armL.pivot.add(armL.mesh);
    const fistL = mk(0.2, 0.2, 0.2, materials.skin, 0, -armGeo.h, 0);
    armL.pivot.add(fistL);

    const armR = this.addBone('armR', new THREE.Group());
    armR.pivot.position.set(-0.38, 1.32, 0);
    armR.mesh = mk(armGeo.w, armGeo.h, armGeo.d, materials.cloth, 0, -armGeo.h / 2, 0);
    armR.pivot.add(armR.mesh);
    const fistR = mk(0.2, 0.2, 0.2, materials.skin, 0, -armGeo.h, 0);
    armR.pivot.add(fistR);

    this.handR = new THREE.Group();
    this.handR.position.set(0, -armGeo.h - 0.06, 0);
    armR.pivot.add(this.handR);
    this.handL = new THREE.Group();
    this.handL.position.set(0, -armGeo.h - 0.06, 0);
    armL.pivot.add(this.handL);

    // ---- head --------------------------------------------------------
    const head = this.addBone('head', new THREE.Group());
    head.pivot.position.set(0, 1.68, 0);
    const skull = mk(0.42, 0.42, 0.42, materials.skin, 0, 0.21, 0);
    head.pivot.add(skull);
    const hairTop = mk(0.46, 0.22, 0.48, materials.hair, 0, 0.4, 0);
    head.pivot.add(hairTop);
    const hairBack = mk(0.46, 0.32, 0.18, materials.hair, 0, 0.24, -0.2);
    head.pivot.add(hairBack);
    const visor = mk(0.44, 0.1, 0.44, materials.hair, 0, 0.21, 0.02);
    visor.material = new THREE.MeshBasicMaterial({ color: 0x20242e, transparent: true, opacity: 0.55 });
    head.pivot.add(visor);

    // ---- weapon ------------------------------------------------------
    this.sword = new THREE.Group();
    const hilt = mk(0.07, 0.26, 0.07, materials.sword, 0, 0, 0);
    this.sword.add(hilt);
    const guard = mk(0.32, 0.07, 0.09, materials.sword, 0, 0.13, 0);
    this.sword.add(guard);
    const blade = mk(0.06, 1.05, 0.06, materials.sword, 0, 0.7, 0);
    blade.material = new THREE.MeshLambertMaterial({ color: 0xdfe8f5, emissive: 0x223144, emissiveIntensity: 0.5 });
    this.sword.add(blade);
    const gem = mk(0.08, 0.08, 0.08, new THREE.MeshBasicMaterial({ color: 0x66e0ff }), 0, 0.14, 0);
    this.sword.add(gem);
    this.sword.rotation.set(0.35, 0, 0.6);
    this.sword.position.set(0, 0.1, 0);
    this.handR.add(this.sword);

    // ---- shield ------------------------------------------------------
    this.shield = new THREE.Group();
    const sh = mk(0.46, 0.56, 0.07, new THREE.MeshLambertMaterial({ color: 0x6b4a2a }));
    this.shield.add(sh);
    const shRing = mk(0.3, 0.4, 0.09, new THREE.MeshLambertMaterial({ color: 0xc9a24a, emissive: 0x3a2a08 }));
    this.shield.add(shRing);
    this.shield.rotation.set(0.2, 0, 0.1);
    this.handL.add(this.shield);

    this.root.add(legL.pivot, legR.pivot, armL.pivot, armR.pivot, head.pivot);
  }

  private addBone(name: string, pivot: THREE.Group): Bone {
    const bone: Bone = { mesh: null as any, pivot, rest: new THREE.Euler() };
    this.parts[name] = bone;
    return bone;
  }

  /** Smoothly rotate a bone toward a target Euler. */
  private ease(bone: Bone, x: number, y: number, z: number, speed: number, dt: number): void {
    const e = bone.rest;
    const k = 1 - Math.exp(-speed * dt);
    e.x += (x - e.x) * k;
    e.y += (y - e.y) * k;
    e.z += (z - e.z) * k;
    bone.pivot.rotation.copy(e);
  }

  update(s: PlayerAnimState, dt: number): void {
    const r = this.restAngles;

    // ---- global lean ------------------------------------------------
    const speedAbs = Math.abs(s.speed);
    const moving = speedAbs > 0.05;
    const runSpeed = Math.min(1, speedAbs / 5.5);

    // Breathing / idle bob.
    const breathe = Math.sin(s.time * 2.1) * 0.02;
    const idleBob = Math.sin(s.time * 1.7) * 0.012;

    // ---- legs ------------------------------------------------------
    let stride = 0;
    let lift = 0;
    if (moving && s.grounded) {
      const cadence = 7.4 + runSpeed * 4.2;
      const phase = s.time * cadence;
      stride = Math.sin(phase) * (0.55 + runSpeed * 0.35);
      const prev = Math.sin(phase - Math.PI);
      lift = Math.max(0, Math.sin(phase)) * (0.12 + runSpeed * 0.14);
      void prev;
    }
    this.ease(this.parts.legL, stride * 0.9, 0, 0, 14, dt);
    this.ease(this.parts.legR, -stride * 0.9, 0, 0, 14, dt);

    // Knee bend while running.
    const knee = moving && s.grounded ? Math.abs(stride) * 0.5 : 0;
    this.parts.legL.mesh.rotation.x = -knee;
    this.parts.legR.mesh.rotation.x = -knee;

    if (s.airborne) {
      // Tuck for a jump/fall.
      this.ease(this.parts.legL, -0.5, 0, 0.2, 12, dt);
      this.ease(this.parts.legR, 0.45, 0, -0.18, 12, dt);
      this.parts.legL.mesh.rotation.x = -0.35;
      this.parts.legR.mesh.rotation.x = -0.35;
    }
    if (s.inLiquid > 0) {
      this.ease(this.parts.legL, 0.4, 0, 0, 6, dt);
      this.ease(this.parts.legR, 0.45, 0, 0, 6, dt);
    }
    void lift;

    // ---- torso ----------------------------------------------------
    const lean = moving ? 0.14 + runSpeed * 0.2 : 0;
    const sprintLean = s.dashing > 0 ? 0.55 : 0;
    this.ease(
      this.parts.torso,
      -lean - sprintLean + (s.airborne ? -0.12 : 0) + breathe * 0.5,
      0,
      s.speed !== 0 ? Math.sign(s.speed) * 0.16 : 0,
      10, dt
    );
    this.root.position.y = idleBob + (moving && s.grounded ? Math.abs(Math.sin(s.time * 14)) * 0.02 * runSpeed : 0);

    // ---- arms -----------------------------------------------------
    const armSwing = moving && s.grounded ? Math.sin(s.time * (7.4 + runSpeed * 4.2)) * (0.55 + runSpeed * 0.3) : 0;

    if (s.attacking) {
      // Overhead / slash arc. `attack` runs 0..1.
      const p = s.attack;
      // Wind up 0..0.35, strike 0.35..0.6, recover 0.6..1
      let ang;
      if (p < 0.35) ang = -2.4 * (p / 0.35);
      else if (p < 0.62) {
        const k = (p - 0.35) / 0.27;
        ang = -2.4 + (2.75) * (k * k * (3 - 2 * k));
      } else {
        const k = (p - 0.62) / 0.38;
        ang = 0.35 - 0.35 * k;
      }
      this.ease(this.parts.armR, ang, 0.25, 0.2, 22, dt);
      this.parts.armR.mesh.rotation.x = 0.15;
      this.sword.rotation.set(0.15, 0, 0.9 + Math.sin(p * Math.PI) * 0.3);
    } else {
      this.ease(this.parts.armR, -armSwing * 0.85, 0, 0.14, 14, dt);
      this.parts.armR.mesh.rotation.x = 0;
      this.sword.rotation.set(0.3, 0, 0.6);
    }
    this.ease(this.parts.armL, armSwing * 0.7, 0, -0.12, 14, dt);
    this.parts.armL.mesh.rotation.x = 0;

    // Shield lowers when not moving.
    this.shield.rotation.x = 0.2 + (moving ? 0.0 : 0.1);
    this.shield.rotation.z = 0.1 + (moving ? 0.12 : 0);

    // ---- head -----------------------------------------------------
    this.ease(
      this.parts.head,
      -lean * 0.6,
      s.speed !== 0 ? Math.sign(s.speed) * 0.06 : 0,
      0,
      8, dt
    );

    // ---- hurt flash ----------------------------------------------
    const hurtMat = this.parts.torso.mesh.material as THREE.MeshLambertMaterial;
    if (hurtMat) {
      const flash = Math.max(0, s.hurt);
      const target = new THREE.Color(0xff5a5a);
      const base = new THREE.Color(0x2f6fd0);
      hurtMat.emissive.copy(base).multiplyScalar(0.0);
      if (flash > 0) {
        hurtMat.emissive.copy(target).multiplyScalar(Math.min(0.65, flash * 2.2));
      }
    }

    // ---- facing ---------------------------------------------------
    this.root.rotation.y = s.yaw;
  }

  /** Snap the model to an upright, non-animated pose (used on spawn). */
  reset(): void {
    for (const name in this.parts) {
      this.parts[name].pivot.rotation.set(0, 0, 0);
      this.parts[name].rest.set(0, 0, 0);
      if (this.parts[name].mesh) this.parts[name].mesh.rotation.set(0, 0, 0);
    }
    this.root.position.set(0, 0, 0);
    this.sword.rotation.set(0.35, 0, 0.6);
  }
}
