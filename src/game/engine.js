import * as THREE from "three";
import { World } from "./world.js";
import { animateHumanoid, makeHumanoid, setShrineActive, setSignalBeaconActive, setSupplyCacheOpen, setArchiveSolved, setProjectState, setTideAnchorActive } from "./models.js";
import {
  REGIONS,
  REGION_BY_ID,
  regionAt,
  worldBounds,
  worldPosition,
} from "../data/world.js";
import { QUESTS } from "../data/quests.js";
import { isBossType } from "../data/encounters.js";
import { recordEvent } from "../core/chronicle.js";
import { rotateArchive, submitArchive, buildProject, projectRewardFactor } from "../core/frontier.js";
import { craftCharm, equipCharm, gearStats } from "../core/gear.js";
import { firstProjectileHit } from "../core/collision.js";
import { firstChargeHit, CHARGE_DISTANCE, CHARGE_SPEED, CHARGE_WINDUP } from "../core/charge.js";
import { cancelUnseenAttack } from "../core/encounter-state.js";
import { findLocalPath } from "../core/pathfinding.js";
import { navigationTarget } from "../core/navigation.js";
import { minimapRegions } from "../core/minimap.js";
import { trackTrail, claimTrail } from "../core/trails.js";
import { craftKit, equipKit, spendKit } from "../core/kit.js";
import { KIT_BY_ID } from "../data/kit.js";
import { observeEnemy, recordEnemyDefeat } from "../core/bestiary.js";
import { createTideCycle, advanceTide, inTideSurge, repairTideAnchor, waterMovementFactor, TIDE_DAMAGE, TIDE_WARNING_SECONDS } from "../core/tides.js";
import { DEFAULT_BINDINGS, keyLabel } from "../core/keybindings.js";
import { INVENTORY_LIMIT, creditInventory, creditStat } from "../core/limits.js";
import {
  acceptQuest,
  addCoins,
  addXp,
  attackPower,
  WAYSTONE_COST,
  completeQuest,
  dashCooldown,
  maxHealth,
  pulseCooldown,
  pulsePower,
  remedyPower,
  questProgress,
  spendTalent,
  unlockAchievements,
  repairBeacon,
  openCache,
  enemyDamage,
} from "../core/state.js";

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

class Particles {
  constructor(scene) {
    this.items = [];
    this.capacity = 300;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.BufferAttribute(
        new Float32Array(this.capacity * 3),
        3,
      ).setUsage(THREE.DynamicDrawUsage),
    );
    geometry.setAttribute(
      "color",
      new THREE.BufferAttribute(
        new Float32Array(this.capacity * 3),
        3,
      ).setUsage(THREE.DynamicDrawUsage),
    );
    const mat = new THREE.PointsMaterial({
      size: 0.2,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true,
    });
    this.points = new THREE.Points(geometry, mat);
    this.points.frustumCulled = false;
    scene.add(this.points);
  }
  burst(x, y, z, color = 0xfbe1a1, count = 14, strength = 1) {
    const c = new THREE.Color(color);
    for (let i = 0; i < count && this.items.length < this.capacity; i++) {
      const a = Math.random() * Math.PI * 2,
        speed = (0.5 + Math.random() * 2) * strength,
        life = 0.35 + Math.random() * 0.65;
      this.items.push({
        x,
        y,
        z,
        vx: Math.cos(a) * speed,
        vy: (0.8 + Math.random() * 2) * strength,
        vz: Math.sin(a) * speed,
        life,
        max: life,
        color: c,
      });
    }
  }
  update(dt) {
    const p = this.points.geometry.attributes.position,
      c = this.points.geometry.attributes.color;
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];
      item.life -= dt;
      if (item.life <= 0) {
        this.items.splice(i, 1);
        continue;
      }
      item.x += item.vx * dt;
      item.y += item.vy * dt;
      item.z += item.vz * dt;
      item.vy -= 3.5 * dt;
    }
    this.items.forEach((item, i) => {
      p.setXYZ(i, item.x, item.y, item.z);
      const f = Math.min(1, item.life * 3);
      c.setXYZ(i, item.color.r * f, item.color.g * f, item.color.b * f);
    });
    p.needsUpdate = true;
    c.needsUpdate = true;
    this.points.geometry.setDrawRange(0, this.items.length);
  }
}

export class GameEngine {
  constructor(host, ui, state, settings, sound, onSave, onContinuousChange) {
    this.host = host;
    this.ui = ui;
    this.state = state;
    this.settings = settings;
    this.sound = sound;
    this.onSave = onSave;
    this.onContinuousChange = onContinuousChange;
    this.abort = new AbortController();
    this.keys = new Set();
    this.touch = { x: 0, z: 0 };
    this.target = null;
    this.pendingInteract = null;
    this.clickPath = [];
    this.clickGoal = null;
    this.pathTimer = 0;
    this.pathPreviousDistance = null;
    this.pathRetries = 0;
    this.paused = false;
    this.dead = false;
    this.renderOnce = true;
    this.time = 0;
    this.tideRegion = null;
    this.lastFrame = performance.now();
    this.lastHud = 0;
    this.lastLabels = 0;
    this.lastSave = 0;
    this.facing = new THREE.Vector2(0, -1);
    this.velocity = new THREE.Vector2();
    this.dashDirection = new THREE.Vector2();
    this.cooldowns = { attack: 0, dash: 0, pulse: 0, ward: 0, potion: 0, kit: 0 };
    this.kitTimers = { haste: 0, regen: 0 };
    this.attackTimer = 0;
    this.pendingStrike = null;
    this.dodgeTimer = 0;
    this.invulnerable = 0;
    this.wardTimer = 0;
    this.shake = 0;
    this.floaters = [];
    this.effects = [];
    this.projectiles = [];
    this.boltGeometry = new THREE.IcosahedronGeometry(.23, 1);
    this.boltMaterial = new THREE.MeshStandardMaterial({color:0xe5c9ff,emissive:0x9761c8,emissiveIntensity:.8,roughness:.35});
    this.nextFloat = 0;
    this.performanceSample = { elapsed: 0, frames: 0 };
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xb5d5c4);
    this.scene.fog = new THREE.Fog(0xb5d5c4, 52, 115);
    this.renderer = new THREE.WebGLRenderer({
      antialias: settings.quality === "high",
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.03;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    const gl = this.renderer.getContext(),
      debug = gl.getExtension("WEBGL_debug_renderer_info");
    this.softwareRenderer =
      !!debug &&
      /swiftshader|llvmpipe/i.test(
        gl.getParameter(debug.UNMASKED_RENDERER_WEBGL),
      );
    this.renderer.domElement.setAttribute(
      "aria-label",
      "Game world. Move with WASD, attack with J, interact with E.",
    );
    this.host.innerHTML = "";
    this.host.append(this.renderer.domElement);
    this.camera = new THREE.OrthographicCamera(-15, 15, 11, -11, 0.1, 180);
    this.camera.position.set(state.player.x, 17, state.player.z + 21);
    this.camera.lookAt(state.player.x, 0, state.player.z - 2);
    const ambient = new THREE.HemisphereLight(0xf7f6dc, 0x648f72, 1.35);
    this.scene.add(ambient);
    this.sun = new THREE.DirectionalLight(0xffebc7, 1.65);
    this.sun.position.set(-12, 24, 12);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -25,
      right: 25,
      top: 25,
      bottom: -25,
      near: 1,
      far: 70,
    });
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.035;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    this.world = new World(this.scene, state);
    this.world.updateStreaming(state.player.x, state.player.z);
    this.player = makeHumanoid({ player: true, color: 0x3d817b });
    this.player.position.set(state.player.x, 0, state.player.z);
    this.player.rotation.y = Math.PI;
    this.scene.add(this.player);
    this.wardAura = new THREE.Mesh(new THREE.SphereGeometry(1.05, 16, 12), new THREE.MeshBasicMaterial({
      color: 0xb5f5d5, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide,
    }));
    this.wardAura.position.y = 1;this.wardAura.visible = false;this.player.add(this.wardAura);
    this.particles = new Particles(this.scene);
    this.raycaster = new THREE.Raycaster();
    this.mouse = new THREE.Vector2();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.applySettings();
    this.resize();
    this.setupInput();
    if (state.player.hp <= 0) this.respawn(false);
    this.world.cull(this.camera);
    this.renderHud();
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
  applySettings() {
    const coarse = window.matchMedia("(pointer: coarse)").matches;
    const limit = this.settings.quality === "high" ? 1.6 : coarse ? 1 : 1.25;
    this.basePixelRatio =
      Math.min(window.devicePixelRatio || 1, limit) *
      (this.softwareRenderer ? 0.55 : 1);
    this.pixelRatio = this.basePixelRatio;
    this.renderer.setPixelRatio(this.pixelRatio);
    const bindings=this.settings.bindings || DEFAULT_BINDINGS;
    this.renderer.domElement.setAttribute("aria-label",`Game world. Move with WASD, strike with ${keyLabel(bindings.attack)}, interact with ${keyLabel(bindings.interact)}.`);
    this.renderer.shadowMap.enabled = this.settings.quality === "high";
    this.renderer.shadowMap.needsUpdate = true;
    this.resize();
  }
  resize() {
    if (!this.renderer || !this.camera) return;
    const w = this.host.clientWidth || window.innerWidth,
      h = this.host.clientHeight || window.innerHeight,
      aspect = w / h,
      half = 10.5;
    this.camera.left = -half * aspect;
    this.camera.right = half * aspect;
    this.camera.top = half;
    this.camera.bottom = -half;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
  }
  setupInput() {
    const signal = this.abort.signal;
    const stick = this.ui.root.querySelector("#joystick"), knob = stick.querySelector(".joystick-center");
    let pointer = null;
    const resetTouchControl = () => {
      const captured = pointer;
      pointer = null;
      this.touch.x = this.touch.z = 0;
      knob.style.transform = "translate(-50%,-50%)";
      if (captured !== null && stick.hasPointerCapture(captured))
        stick.releasePointerCapture(captured);
    };
    this.resetTouchControl = resetTouchControl;
    window.addEventListener("resize", () => this.resize(), { signal });
    const orientation=window.matchMedia("(pointer: coarse) and (orientation: portrait)");
    this.orientationBlocked=orientation.matches;
    orientation.addEventListener("change", ({matches}) => {
      this.orientationBlocked=matches;
      this.keys.clear();resetTouchControl();this.cancelClickMove();
      this.lastFrame=performance.now();this.renderOnce=true;
    }, { signal });
    window.addEventListener(
      "keydown",
      (e) => {
        if (this.ui.transitioning) { e.preventDefault(); return; }
        if (this.orientationBlocked || e.ctrlKey || e.metaKey || e.altKey) return;
        if (e.code === "Escape") {
          e.preventDefault();
          if (e.repeat) return;
          if (this.ui.overlayType === "gameover") return;
          if (this.ui.overlayType) this.ui.closeOverlay();
          else this.ui.openPause();
          return;
        }
        // Once a modal is open, Tab, Space and arrow keys belong to its
        // native buttons and form controls rather than the game world.
        if (this.paused) return;
        if (
          e.target instanceof HTMLInputElement ||
          e.target instanceof HTMLSelectElement ||
          e.target instanceof HTMLTextAreaElement
        )
          return;
        if (
          [
            "ArrowUp",
            "ArrowDown",
            "ArrowLeft",
            "ArrowRight",
            "Space",
            "Tab",
          ].includes(e.code)
        )
          e.preventDefault();
        this.keys.add(e.code);
        const bindings=this.settings.bindings || DEFAULT_BINDINGS;
        if (e.repeat && e.code !== bindings.attack) return;
        if (e.code === bindings.interact) this.interact();
        else if (e.code === bindings.attack) this.attack();
        else if (e.code === bindings.dodge) this.dash();
        else if (e.code === bindings.potion) this.potion();
        else if (e.code === bindings.pulse) this.pulse();
        else if (e.code === bindings.ward) this.ward();
        else if (e.code === bindings.kit) this.useKit();
        else if (e.code === bindings.map) this.ui.openBoard("map");
        else if (e.code === bindings.journal) this.ui.openBoard("journal");
        else if (e.code === bindings.character) this.ui.openBoard("character");
      },
      { signal },
    );
    window.addEventListener("keyup", (e) => this.keys.delete(e.code), {
      signal,
    });
    window.addEventListener(
      "blur",
      () => {
        this.keys.clear();
        resetTouchControl();
        if (!this.paused && !this.dead) this.ui.openPause();
        this.queueSave();
      },
      { signal },
    );
    document.addEventListener(
      "visibilitychange",
      () => {
        if (document.hidden) {
          resetTouchControl();
          if (!this.paused && !this.dead) this.ui.openPause();
          this.queueSave();
        }
      },
      { signal },
    );
    this.renderer.domElement.addEventListener(
      "pointerdown",
      (event) => this.onWorldPointer(event),
      { signal },
    );
    const update = (event) => {
      const box = stick.getBoundingClientRect(),
        dx = event.clientX - (box.left + box.width / 2),
        dy = event.clientY - (box.top + box.height / 2),
        distance = Math.hypot(dx, dy),
        limit = box.width * 0.34,
        ratio = Math.min(1, distance / limit);
      this.touch.x = distance ? (dx / distance) * ratio : 0;
      this.touch.z = distance ? (dy / distance) * ratio : 0;
      knob.style.transform = `translate(calc(-50% + ${this.touch.x * limit}px),calc(-50% + ${this.touch.z * limit}px))`;
    };
    stick.addEventListener(
      "pointerdown",
      (e) => {
        // Even an ignored second joystick finger must not click a menu if the
        // active finger opens one before both touches have been released.
        if (e.pointerType === "touch") this.ui.blockTouchClick?.(e.pointerId);
        if (this.paused || this.orientationBlocked || pointer !== null) return;
        pointer = e.pointerId;
        stick.setPointerCapture(pointer);
        update(e);
        e.preventDefault();
      },
      { signal },
    );
    stick.addEventListener(
      "pointermove",
      (e) => {
        if (e.pointerId === pointer && !this.paused && !this.orientationBlocked) update(e);
      },
      { signal },
    );
    const release = (e) => {
      if (e.pointerId !== pointer) return;
      resetTouchControl();
    };
    stick.addEventListener("pointerup", release, { signal });
    stick.addEventListener("pointercancel", release, { signal });
    stick.addEventListener("lostpointercapture", release, { signal });
  }
  onWorldPointer(event) {
    if (this.paused || this.orientationBlocked || event.button !== 0) return;
    const rect = this.renderer.domElement.getBoundingClientRect();
    this.mouse.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      (-(event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    this.raycaster.setFromCamera(this.mouse, this.camera);
    const point = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(this.groundPlane, point)) return;
    const enemy = this.world
      .enemies()
      .filter((e) => e.alive)
      .sort(
        (a, b) =>
          Math.hypot(a.x - point.x, a.z - point.z) -
          Math.hypot(b.x - point.x, b.z - point.z),
      )[0];
    if (
      enemy &&
      Math.hypot(enemy.x - point.x, enemy.z - point.z) < 1.7 &&
      dist(enemy, this.state.player) < 3
    ) {
      this.facing
        .set(enemy.x - this.state.player.x, enemy.z - this.state.player.z)
        .normalize();
      this.attack();
      return;
    }
    const item=this.world.nearby(point.x,point.z,1.3);
    const goal=item ? {x:item.x,z:item.z} : {
      x:clamp(point.x,worldBounds.minX,worldBounds.maxX),
      z:clamp(point.z,worldBounds.minZ,worldBounds.maxZ),
    };
    this.beginClickMove(goal,item);
  }
  cancelClickMove() {
    this.target=null;this.pendingInteract=null;this.clickGoal=null;
    this.clickPath=[];this.pathTimer=0;this.pathPreviousDistance=null;this.pathRetries=0;
  }
  clickObstacles(item) {
    const obstacles=this.world.colliders();
    for (const enemy of this.world.enemies()) if (enemy.alive)
      obstacles.push({x:enemy.x,z:enemy.z,r:isBossType(enemy.type) ? .8 : .4});
    for (const npc of this.world.npcs()) if (npc!==item) obstacles.push({x:npc.x,z:npc.z,r:.35});
    return obstacles;
  }
  beginClickMove(goal,item=null,retrying=false) {
    const path=findLocalPath(this.state.player,goal,this.clickObstacles(item),{bounds:worldBounds});
    if (!path?.length) {
      this.cancelClickMove();
      this.ui.toast("No clear path", "Try a closer point or steer around the obstacle.", "info");
      return false;
    }
    if (!retrying) this.pathRetries=0;
    this.clickGoal={...goal};this.pendingInteract=item;this.clickPath=path;
    this.target=this.clickPath.shift();this.pathTimer=0;this.pathPreviousDistance=null;
    return true;
  }
  setPaused(value) {
    this.paused = value;
    this.renderOnce = true;
    this.keys.clear();
    this.resetTouchControl?.();
    this.touch.x = 0;
    this.touch.z = 0;
    this.lastFrame = performance.now();
    if (value) this.cancelClickMove();
  }
  tick(now) {
    const rawDt = Math.max(0, (now - this.lastFrame) / 1000),
      dt = Math.min(0.1, rawDt);
    this.lastFrame = now;
    if (!this.paused && !this.dead && !this.orientationBlocked) {
      this.update(dt);
      this.adjustResolution(rawDt);
    }
    if ((!this.paused && !this.orientationBlocked) || this.renderOnce) {
      this.renderer.render(this.scene, this.camera);
      this.renderOnce = false;
    }
    if (now - this.lastHud > 120) {
      this.renderHud();
      this.drawMinimap();
      this.lastHud = now;
    }
    if (now - this.lastLabels > 80) {
      this.renderLabels();
      this.lastLabels = now;
    }
    this.frame = requestAnimationFrame((t) => this.tick(t));
  }
  adjustResolution(dt) {
    if (this.settings.quality === "high" || dt > 1) return;
    const sample = this.performanceSample;
    sample.elapsed += dt;
    sample.frames++;
    if (sample.elapsed < 3) return;
    const fps = sample.frames / sample.elapsed;
    sample.elapsed = 0;
    sample.frames = 0;
    const minimum = Math.min(this.basePixelRatio, 0.6);
    const next =
      fps < 35
        ? Math.max(minimum, this.pixelRatio * 0.82)
        : fps > 58
          ? Math.min(this.basePixelRatio, this.pixelRatio * 1.1)
          : this.pixelRatio;
    if (Math.abs(next - this.pixelRatio) > 0.02) {
      this.pixelRatio = next;
      this.renderer.setPixelRatio(next);
      this.resize();
    }
  }
  update(dt) {
    this.time += dt;
    creditStat(this.state.stats,"seconds",dt);
    for (const key of Object.keys(this.cooldowns))
      this.cooldowns[key] = Math.max(0, this.cooldowns[key] - dt);
    this.attackTimer = Math.max(0, this.attackTimer - dt);
    if (this.pendingStrike && (this.pendingStrike.delay -= dt) <= 0) {
      const direction = this.pendingStrike.direction;
      this.pendingStrike = null;
      this.resolveStrike(direction);
    }
    this.dodgeTimer = Math.max(0, this.dodgeTimer - dt);
    this.invulnerable = Math.max(0, this.invulnerable - dt);
    this.wardTimer = Math.max(0, this.wardTimer - dt);
    this.wardAura.visible = this.wardTimer > 0;
    this.shake = Math.max(0, this.shake - dt * 2.5);
    const p = this.state.player;
    this.kitTimers.haste = Math.max(0,this.kitTimers.haste-dt);
    if (this.kitTimers.regen > 0) {
      const elapsed=Math.min(dt,this.kitTimers.regen);
      const hp=p.hp;
      p.hp=Math.min(maxHealth(p),p.hp+6*elapsed);
      if (p.hp!==hp) this.onContinuousChange?.();
      this.kitTimers.regen=Math.max(0,this.kitTimers.regen-dt);
    }
    let x =
      (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
      (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0) +
      this.touch.x;
    let z =
      (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0) -
      (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) +
      this.touch.z;
    if (Math.hypot(x, z) > 0.1) {
      if (this.target) this.cancelClickMove();
    } else if (this.target) {
      const pending=this.pendingInteract;
      if (pending && (!pending.model?.visible || (pending.kind === "cache" && this.state.world.openedCaches.includes(pending.region)))) {
        this.cancelClickMove();
      } else if (pending && dist(p,pending) < 2.15) {
        this.cancelClickMove();this.interact(pending);
      } else {
        let dx=this.target.x-p.x,dz=this.target.z-p.z,d=Math.hypot(dx,dz);
        if (d < .38) {
          this.target=this.clickPath.shift() || null;
          this.pathTimer=0;this.pathPreviousDistance=null;
          if (!this.target) {
            this.cancelClickMove();
            if (pending && dist(p,pending)<2.4) this.interact(pending);
            else if (pending) this.ui.toast("Not close enough", "Walk a little closer to interact.", "info");
          } else {dx=this.target.x-p.x;dz=this.target.z-p.z;d=Math.hypot(dx,dz);}
        }
        if (this.target && d>0) {x=dx/d;z=dz/d;}
      }
    }
    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }
    if (length > 0.1 && this.dodgeTimer <= 0) {
      this.facing.set(x, z).normalize();
    }
    const speed =
      this.dodgeTimer > 0
        ? 12
        : 5.3 * (1 + (gearStats(p).speed || 0)) * (this.kitTimers.haste > 0 ? 1.15 : 1) * (this.world.inWater(p.x, p.z) ? waterMovementFactor(this.state,regionAt(p.x,p.z)?.id) : 1);
    const dx = (this.dodgeTimer > 0 ? this.dashDirection.x : x) * speed * dt,
      dz = (this.dodgeTimer > 0 ? this.dashDirection.y : z) * speed * dt;
    const oldX = p.x,
      oldZ = p.z;
    this.movePlayer(dx, dz);
    const moved = Math.hypot(p.x - oldX, p.z - oldZ);
    if (moved>0.001) this.onContinuousChange?.();
    if (this.target && this.dodgeTimer<=0) {
      this.pathTimer+=dt;
      if (this.pathTimer>=.9) {
        const remaining=dist(p,this.target);
        if (this.pathPreviousDistance!==null && remaining>this.pathPreviousDistance-.15) {
          const goal=this.clickGoal,item=this.pendingInteract;
          if (this.pathRetries<2 && goal) {this.pathRetries++;this.beginClickMove(goal,item,true);}
          else {this.cancelClickMove();this.ui.toast("Path blocked", "Try another point or move around the obstruction.", "info");}
        } else {this.pathTimer=0;this.pathPreviousDistance=remaining;}
      }
    }
    creditStat(this.state.stats,"distance",moved);
    this.player.position.set(p.x, 0, p.z);
    this.player.rotation.y = Math.atan2(this.facing.x, this.facing.y);
    animateHumanoid(
      this.player,
      this.time,
      moved > 0.005,
      this.attackTimer / 0.32,
      this.dodgeTimer / 0.27,
    );
    const entered = this.world.updateStreaming(p.x, p.z);
    if (entered) {
      if (!this.state.world.visited.includes(entered.id)) {
        this.state.world.visited.push(entered.id);
        recordEvent(this.state, "discovery", entered.id);
        this.gainXp(15);
        this.ui.announceRegion(entered);
        this.checkAchievements();
        this.queueSave();
      }
    }
    this.world.updateAmbient(dt, this.time);
    this.updateTides(dt);
    this.updateEnemies(dt);
    this.updateProjectiles(dt);
    for (const npc of this.world.npcs())
      if (dist(npc, p) < 26) {
        if (dist(npc, p) < 4)
          npc.model.rotation.y = Math.atan2(p.x - npc.x, p.z - npc.z);
        animateHumanoid(npc.model, this.time, false, 0, 0);
      }
    this.particles.update(dt);
    this.updateEffects(dt);
    this.floaters = this.floaters.filter((f) => (f.life -= dt) > 0);
    const t = 1 - Math.exp(-dt * 6),
      shake = this.settings.reducedMotion ? 0 : this.shake;
    const sx = (Math.random() - 0.5) * shake,
      sz = (Math.random() - 0.5) * shake;
    this.camera.position.x = lerp(this.camera.position.x, p.x + sx, t);
    this.camera.position.z = lerp(this.camera.position.z, p.z + 21 + sz, t);
    this.camera.lookAt(this.camera.position.x, 0, this.camera.position.z - 23);
    this.world.cull(this.camera);
    this.sun.position.set(p.x - 12, 24, p.z + 12);
    this.sun.target.position.set(p.x, 0, p.z);
    this.sun.target.updateMatrixWorld();
    this.lastSave += dt;
    if (this.lastSave >= 15) {
      this.lastSave = 0;
      this.queueSave();
    }
  }
  /** Only the occupied region advances. Re-entering grants a fresh warning. */
  updateTides(dt) {
    const current=this.world.current?.id;
    const changed=current !== this.tideRegion;
    if (changed) this.tideRegion=current;
    for (const record of this.world.records()) {
      const active=record.data.id === current && !this.state.world.tideAnchors.includes(record.data.id);
      for (const surge of record.surges || []) {
        if (!active) {surge.warning.visible=false;continue;}
        if (changed) surge.cycle=createTideCycle(surge.offset);
        const fired=advanceTide(surge.cycle,dt);
        surge.warning.visible=surge.cycle.phase === 'warning';
        if (surge.warning.visible) {
          const progress=1-surge.cycle.remaining/TIDE_WARNING_SECONDS;
          surge.fill.material.opacity=.24+.2*progress;
          surge.rim.material.opacity=.82+.16*progress;
        }
        if (fired) {
          this.addRing(surge.x,surge.z,0x91e5d5,surge.radius,.45);
          this.particles.burst(surge.x,.25,surge.z,0x9ce8db,14,.8);
          if (inTideSurge(surge,this.state.player)) this.hurt(TIDE_DAMAGE,surge);
        }
      }
    }
  }
  movePlayer(dx, dz) {
    const p = this.state.player,
      obstacles = this.world.colliders();
    for (const e of this.world.enemies())
      if (e.alive)
        obstacles.push({
          x: e.x,
          z: e.z,
          r: isBossType(e.type) ? 0.8 : 0.4,
        });
    for (const n of this.world.npcs())
      obstacles.push({ x: n.x, z: n.z, r: 0.35 });
    // Substeps keep fast dodges from tunnelling through small collision circles.
    const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.22));
    for (let step = 0; step < steps; step++) {
      let nx = clamp(p.x + dx / steps, worldBounds.minX, worldBounds.maxX),
        nz = clamp(p.z + dz / steps, worldBounds.minZ, worldBounds.maxZ);
      for (const c of obstacles) {
        let vx = nx - c.x, vz = nz - c.z;
        const min = 0.32 + c.r, squared=vx*vx+vz*vz;
        if (squared < min*min) {
          let d=Math.sqrt(squared);
          if (d < 0.0001) {
            vx = 1;
            vz = 0;
            d = 1;
          }
          nx = c.x + (vx / d) * min;
          nz = c.z + (vz / d) * min;
        }
      }
      p.x = clamp(nx, worldBounds.minX, worldBounds.maxX);
      p.z = clamp(nz, worldBounds.minZ, worldBounds.maxZ);
    }
  }

  updateEnemies(dt) {
    const p = this.state.player,
      now = Date.now(),
      obstacles = this.world.colliders();
    for (const e of this.world.enemies()) {
      if (dist(e, p) > 32) {
        cancelUnseenAttack(e);
        continue;
      }
      if (!e.alive) {
        if (!isBossType(e.type) && !(this.state.world.respawns[e.id] > now)) {
          delete this.state.world.respawns[e.id];
          e.alive = true;
          e.hp = e.maxHp;
          delete this.state.world.wounded[e.id];
          e.x = e.homeX;
          e.z = e.homeZ;
          e.state = "idle";
          e.model.visible = true;
        }
        continue;
      }
      let aftershockStarted = false;
      e.cooldown = Math.max(0, e.cooldown - dt);
      e.hitFlash = Math.max(0, e.hitFlash - dt);
      e.stateTime += dt;
      const d = dist(e, p), boss = isBossType(e.type),
        aggro = (boss ? 10 : e.type === "caster" ? 12 : e.type === "surger" ? 10 : e.type === "sentinel" ? 9 : 7.5) * (this.state.world.beacons.includes(e.region) ? .75 : 1),
        range = boss ? 2.6 : e.type === "caster" ? 10 : e.type === "surger" ? 6.4 : e.type === "sentinel" ? 4.3 : e.type === "thorn" ? 1.6 : 1.4;
      if (d<15 && observeEnemy(this.state,e.type)) {
        this.ui.toast("Field guide updated", "A new encounter note is in your journal.", "book");
        this.checkAchievements();this.queueSave();
      }
      if (e.state === "stunned") {
        if (e.stateTime >= 1.2) {
          // A harmless flash must not turn an unprovoked Haven creature hostile.
          e.state=e.region === "haven" && !e.aggravated ? "idle" : "chase";
          e.stateTime=0;
        }
      } else if (e.state === "idle") {
        if (d < aggro && (e.region !== "haven" || e.aggravated)) {
          e.state = "chase";
          e.stateTime = 0;
        } else {
          const tx = e.homeX + Math.sin(this.time * 0.45 + e.phase) * 1.1,
            tz = e.homeZ + Math.cos(this.time * 0.38 + e.phase) * 0.8;
          this.moveEnemy(e,(tx-e.x)*dt*.6,(tz-e.z)*dt*.6,obstacles);
        }
      } else if (e.state === "chase") {
        if (d > 14 || Math.hypot(e.x - e.homeX, e.z - e.homeZ) > 16) {
          e.state = "return";
        } else if (d < range + 0.35 && e.cooldown <= 0) {
          e.state = "windup";
          e.stateTime = 0;
          e.pattern++;
          if (e.type === "caster" || e.type === "surger") e.aim = this.directionToPlayer(e);
          e.attackRange =
            boss && e.pattern % 2 === 0
              ? 4.2
              : e.type === "thorn"
                ? 2.05
                : range;
          e.windup =
            boss
              ? e.pattern % 2 === 0
                ? 1.25
                : 1
              : e.type === "caster"
                ? 1.05
              : e.type === "surger" ? CHARGE_WINDUP
              : e.type === "sentinel"
                ? 1.15
                : e.type === "thorn" ? 0.9 : 0.7;
          if (boss && e.hp < e.maxHp * 0.5) e.windup *= 0.8;
        } else if (e.type === "caster" && d < 4 && d > .001) {
          this.moveEnemy(e,-((p.x-e.x)/d)*1.3*dt,-((p.z-e.z)/d)*1.3*dt,obstacles);
        } else if (d > range * 0.82) {
          const speed =
            boss ? 1.65 : e.type === "sentinel" ? 1.75 : e.type === "thorn" ? 2.1 : 2.45;
          this.moveEnemy(
            e,
            ((p.x - e.x) / d) * speed * dt,
            ((p.z - e.z) / d) * speed * dt,
            obstacles,
          );
        }
      } else if (e.state === "return") {
        const dx = e.homeX - e.x,
          dz = e.homeZ - e.z,
          home = Math.hypot(dx, dz);
        if (home < 0.4) {
          e.state = "idle";
          e.hp = e.maxHp;
          e.aggravated = false;
          if (this.state.world.wounded[e.id]) { delete this.state.world.wounded[e.id]; this.queueSave(); }
        } else
          this.moveEnemy(e, (dx / home) * 2.2 * dt, (dz / home) * 2.2 * dt, obstacles);
        if (d < aggro * 0.7) e.state = "chase";
      } else if (e.state === "windup") {
        const wind = e.windup;
        if (e.type === "caster") {
          this.showAim(e,[e.aim],13.5);
        } else if (e.type === "surger") {
          this.showChargeAim(e);
        } else {
          e.model.userData.ring.visible = true;
          // The outer edge matches the actual hit test for the entire warning.
          e.model.userData.ring.scale.setScalar(e.attackRange + 0.32);
          e.model.userData.ring.material.opacity = 0.35 + 0.3 * Math.min(1, e.stateTime / wind);
        }
        if (e.stateTime >= wind) {
          e.model.userData.ring.visible = false;
          this.hideAim(e);
          e.state = "recover";
          e.stateTime = 0;
          e.cooldown = boss || e.type === "sentinel" || e.type === "caster" ? 1.6 : 1.05;
          this.particles.burst(e.x, 0.3, e.z, 0xe7a47e, 10, 0.75);
          if (e.type === "caster") {
            this.spawnBolt(e,e.aim,13.5,10,1);
          } else if (e.type === "surger") {
            e.state="charging";
            e.chargeRemaining=CHARGE_DISTANCE;
            e.cooldown=1.8;
          } else {
            this.addRing(e.x, e.z, 0xe7a47e, e.attackRange, 0.3);
            if (dist(e, p) < e.attackRange + 0.32 && this.invulnerable <= 0)
              this.hurt(enemyDamage(this.state, e), e);
            if (boss && e.hp < e.maxHp * 0.5 && e.pattern % 2 === 0) {
              e.aftershock = 0.65;
              aftershockStarted = true;
              e.aftershockRange = e.attackRange * 0.82;
              if (e.type === "tempest") {
                const aim=this.directionToPlayer(e);
                e.volley=[-.27,0,.27].map(angle=>this.rotateDirection(aim,angle));
                this.showAim(e,e.volley,10);
              }
            }
          }
        }
      } else if (e.state === "charging") {
        const travel=Math.min(e.chargeRemaining,CHARGE_SPEED*dt);
        const intended={x:e.x+e.aim.x*travel,z:e.z+e.aim.z*travel};
        const next={x:clamp(intended.x,worldBounds.minX,worldBounds.maxX),
          z:clamp(intended.z,worldBounds.minZ,worldBounds.maxZ)};
        const atEdge=next.x!==intended.x || next.z!==intended.z;
        const blockers=[...obstacles,
          ...this.world.npcs().map(n=>({x:n.x,z:n.z,r:.35})),
          ...this.world.enemies().filter(other=>other!==e && other.alive)
            .map(other=>({x:other.x,z:other.z,r:isBossType(other.type) ? .8 : .4}))];
        const hit=firstChargeHit(e,next,this.invulnerable>0 ? null : p,blockers);
        const fraction=hit ? Math.max(0,hit.fraction-.001) : 1;
        e.x+=(next.x-e.x)*fraction;e.z+=(next.z-e.z)*fraction;
        e.chargeRemaining-=travel;
        if (hit?.kind === "player") this.hurt(enemyDamage(this.state,e),e);
        if (hit || atEdge || e.chargeRemaining<=.001) {
          e.state="recover";e.stateTime=0;e.chargeRemaining=0;
          this.particles.burst(e.x,.3,e.z,0xa7e9d7,9,.6);
        }
      } else if (e.state === "recover" && e.stateTime > 0.55 && e.aftershock <= 0) {
        e.state = "chase";
        e.stateTime = 0;
      }
      if (e.aftershock > 0) {
        // Do not spend the new warning's time in the frame that created it.
        if (!aftershockStarted) e.aftershock -= dt;
        if (e.type !== "tempest") {
          e.model.userData.ring.visible = true;
          e.model.userData.ring.scale.setScalar(e.aftershockRange + 0.32);
          e.model.userData.ring.material.opacity = 0.48 + 0.17 * (1 - Math.max(0, e.aftershock) / 0.65);
        }
        if (e.aftershock <= 0) {
          e.model.userData.ring.visible = false;
          if (e.type === "tempest") {
            this.hideAim(e);
            for (const direction of e.volley || []) this.spawnBolt(e,direction,10,9,.72);
            this.addRing(e.x,e.z,0xd2b8f0,2.2,.3);
          } else {
            this.addRing(e.x, e.z, 0xffc999, e.aftershockRange, 0.3);
            if (dist(e, p) < e.aftershockRange + 0.32 && this.invulnerable <= 0)
              this.hurt(enemyDamage(this.state, e, .75), e);
          }
        }
      }
      const center = REGION_BY_ID[e.region],
        cx = (center.gx - 2) * 54,
        cz = center.gz * 54;
      e.model.position.set(e.x - cx, 0, e.z - cz);
      e.model.rotation.y = e.type === "surger" && e.aim && (e.state === "windup" || e.state === "charging")
        ? Math.atan2(e.aim.x,e.aim.z) : Math.atan2(p.x - e.x, p.z - e.z);
      e.model.userData.body.position.y =
        Math.sin(this.time * 3 + e.phase) * 0.08 +
        (e.state === "windup" ? -0.08 : 0);
      e.model.userData.body.scale.setScalar(
        e.model.userData.baseScale * (e.hitFlash > 0 ? 1.1 : 1),
      );
    }
  }
  directionToPlayer(enemy) {
    const dx=this.state.player.x-enemy.x,dz=this.state.player.z-enemy.z;
    const length=Math.hypot(dx,dz);
    return length>.001 ? {x:dx/length,z:dz/length} : {x:0,z:1};
  }
  rotateDirection(direction,angle) {
    return {x:direction.x*Math.cos(angle)-direction.z*Math.sin(angle),
      z:direction.x*Math.sin(angle)+direction.z*Math.cos(angle)};
  }
  showAim(enemy,directions,length) {
    const center=REGION_BY_ID[enemy.region];
    const cx=(center.gx-2)*54,cz=center.gz*54;
    directions.forEach((direction,index)=>{
      const warning=enemy.warnings?.[index]; if(!warning) return;
      warning.visible=true;
      warning.scale.set(1.5,1,length);
      warning.position.set(enemy.x-cx+direction.x*length/2,.10,enemy.z-cz+direction.z*length/2);
      warning.rotation.y=Math.atan2(direction.x,direction.z);
    });
  }
  showChargeAim(enemy) {
    const region=REGION_BY_ID[enemy.region], warning=enemy.warnings?.[0];
    if (!warning) return;
    warning.visible=true;
    warning.position.set(enemy.x-(region.gx-2)*54,0,enemy.z-region.gz*54);
    warning.rotation.y=Math.atan2(enemy.aim.x,enemy.aim.z);
  }
  hideAim(enemy) {
    for(const warning of enemy.warnings || []) warning.visible=false;
  }
  spawnBolt(enemy,direction,range,speed,multiplier) {
    if (!direction || this.projectiles.length>=36) return;
    const mesh=new THREE.Mesh(this.boltGeometry,this.boltMaterial);
    const x=enemy.x+direction.x*.75,z=enemy.z+direction.z*.75;
    mesh.position.set(x,.95,z);this.scene.add(mesh);
    this.projectiles.push({mesh,x,z,direction,remaining:Math.max(0,range-.75),speed,radius:.23,damage:enemyDamage(this.state,enemy,multiplier),source:enemy});
  }
  clearProjectiles() {
    for(const bolt of this.projectiles) this.scene.remove(bolt.mesh);
    this.projectiles.length=0;
  }
  updateProjectiles(dt) {
    const colliders=this.world.colliders(),player=this.state.player;
    for(let i=this.projectiles.length-1;i>=0;i--) {
      const bolt=this.projectiles[i], travel=Math.min(bolt.remaining,bolt.speed*dt);
      const next={x:bolt.x+bolt.direction.x*travel,z:bolt.z+bolt.direction.z*travel};
      const hit=firstProjectileHit(bolt,next,bolt.radius,player,colliders);
      if(hit) {
        bolt.x+=(next.x-bolt.x)*hit.fraction;bolt.z+=(next.z-bolt.z)*hit.fraction;
        if(hit.kind==="player") this.hurt(bolt.damage,bolt.source);
        this.particles.burst(bolt.x,.8,bolt.z,0xd3b4ef,7,.45);
      } else {bolt.x=next.x;bolt.z=next.z;}
      bolt.remaining-=travel;
      bolt.mesh.position.set(bolt.x,.95,bolt.z);bolt.mesh.rotation.y+=dt*4;
      if(hit || bolt.remaining<=.001) {this.scene.remove(bolt.mesh);this.projectiles.splice(i,1);}
    }
  }
  moveEnemy(e, dx, dz, obstacles = this.world.colliders()) {
    let nx = e.x + dx,
      nz = e.z + dz;
    for (const c of obstacles) {
      let vx = nx - c.x, vz = nz - c.z;
      const min = c.r + 0.38, squared=vx*vx+vz*vz;
      if (squared < min*min) {
        let d=Math.sqrt(squared);
        if (d < .001) { vx = 1; vz = 0; d = 1; }
        nx = c.x + (vx / d) * min;
        nz = c.z + (vz / d) * min;
      }
    }
    e.x = clamp(nx, worldBounds.minX, worldBounds.maxX);
    e.z = clamp(nz, worldBounds.minZ, worldBounds.maxZ);
  }
  attack() {
    if (
      this.paused ||
      this.dead ||
      this.cooldowns.attack > 0 ||
      this.dodgeTimer > 0
    )
      return;
    this.cooldowns.attack = 0.43;
    this.attackTimer = 0.32;
    this.pendingStrike = { delay: 0.12, direction: this.facing.clone() };
    this.sound.effect("swing");
  }
  resolveStrike(direction) {
    const p = this.state.player;
    let hits = 0;
    for (const e of this.world.enemies()) {
      if (!e.alive) continue;
      const dx = e.x - p.x,
        dz = e.z - p.z,
        d = Math.hypot(dx, dz),
        range = isBossType(e.type) ? 2.9 : 2.4;
      if (
        d < range &&
        (dx * direction.x + dz * direction.y) / Math.max(d, 0.001) > 0.1
      ) {
        this.hitEnemy(e, attackPower(p));
        hits++;
      }
    }
    this.addRing(p.x, p.z, 0xece7ae, 1.9, 0.19, direction);
    if (hits) {
      this.shake = Math.max(this.shake, 0.13);
      this.sound.effect("hit");
    }
  }

  hitEnemy(enemy, damage) {
    if (!enemy.alive) return;
    const amount = Math.max(1, Math.round(damage));
    enemy.hp -= amount;
    enemy.hitFlash = 0.14;
    enemy.aggravated = true;
    if (enemy.hp > 0) {
      this.state.world.wounded[enemy.id] = enemy.hp;
      this.queueSave();
    }
    if (
      isBossType(enemy.type) &&
      enemy.hp > 0 && enemy.hp < enemy.maxHp * 0.5 &&
      !enemy.phaseTwoShown
    ) {
      enemy.phaseTwoShown = true;
      this.ui.toast(
        enemy.type === "warden" ? "The warden stirs" : enemy.type === "tempest" ? "The engine stirs" : "The guardian stirs",
        enemy.type === "tempest" ? "Its wide shockwave now leads into three aimed bolts." : "Its wide shockwave now echoes a second time.",
        "info",
      );
    }
    this.particles.burst(enemy.x, 0.8, enemy.z, 0xffdaa0, 10, 0.8);
    this.floaters.push({
      id: "d" + this.nextFloat++,
      x: enemy.x,
      z: enemy.z,
      y: 1.8,
      text: `${amount}`,
      life: 0.8,
      max: 0.8,
    });
    if (enemy.hp <= 0) this.defeat(enemy);
  }
  defeat(enemy) {
    if (!enemy.alive) return;
    enemy.alive = false;
    enemy.model.visible = false;
    enemy.model.userData.ring.visible = false;
    this.hideAim(enemy);
    delete this.state.world.wounded[enemy.id];
    creditStat(this.state.stats,"defeated",1);
    recordEnemyDefeat(this.state,enemy.type);
    if (enemy.type === "sentinel") creditStat(this.state.stats,"sentinels",1);
    if (enemy.type === "caster") creditStat(this.state.stats,"casters",1);
    const boss = isBossType(enemy.type);
    if (boss) { this.state.world.flags[enemy.type] = true; recordEvent(this.state, "boss", enemy.type); }
    else this.state.world.respawns[enemy.id] = Date.now() + 180000;
    const echoes = enemy.type === "tempest" ? 10 : enemy.type === "warden" ? 8 : boss ? 6 : 1,
      coins = Math.round((enemy.type === "tempest" ? 120 : enemy.type === "warden" ? 90 : boss ? 55 : 4 + enemy.level * 2) * projectRewardFactor(this.state,enemy.region));
    creditInventory(this.state.player,"echoes",echoes);
    creditStat(this.state.stats,"echoes",echoes);
    addCoins(this.state, coins);
    this.gainXp(Math.round((enemy.type === "tempest" ? 240 : enemy.type === "warden" ? 180 : boss ? 100 : 13 + enemy.level * 4)*projectRewardFactor(this.state,enemy.region)));
    this.particles.burst(enemy.x, 0.8, enemy.z, 0xb9f5d0, 24, 1.1);
    this.sound.effect("pickup");
    this.ui.toast(
      boss ? (enemy.type === "tempest" ? "The engine is quiet" : enemy.type === "warden" ? "The warden is quiet" : "The guardian is quiet") : "Light returned",
      `+${echoes} echo${echoes === 1 ? "" : "es"}  ·  +${coins} gold`,
      "star",
    );
    this.checkAchievements();
    this.queueSave();
  }
  dash() {
    if (this.paused || this.dead || this.cooldowns.dash > 0) return;
    this.cooldowns.dash = dashCooldown(this.state.player);
    this.pendingStrike = null;
    this.attackTimer = 0;
    this.dodgeTimer = 0.27;
    this.invulnerable = 0.38;
    const dx =
      (this.keys.has("KeyD") || this.keys.has("ArrowRight") ? 1 : 0) -
      (this.keys.has("KeyA") || this.keys.has("ArrowLeft") ? 1 : 0) +
      this.touch.x;
    const dz =
      (this.keys.has("KeyS") || this.keys.has("ArrowDown") ? 1 : 0) -
      (this.keys.has("KeyW") || this.keys.has("ArrowUp") ? 1 : 0) +
      this.touch.z;
    this.dashDirection.set(dx, dz);
    if (this.dashDirection.lengthSq() < 0.01)
      this.dashDirection.copy(this.facing);
    else {
      this.dashDirection.normalize();
      this.facing.copy(this.dashDirection);
    }
    this.cancelClickMove();
    this.sound.effect("dash");
    this.particles.burst(
      this.state.player.x,
      0.2,
      this.state.player.z,
      0xd4ecc1,
      9,
      0.55,
    );
  }
  pulse() {
    if (this.paused || this.dead) return;
    if (!this.state.player.skills.pulse) {
      this.ui.toast(
        "Light Pulse is sleeping",
        "Help Mira to awaken this power.",
        "pulse",
      );
      return;
    }
    if (this.cooldowns.pulse > 0) return;
    this.cooldowns.pulse = pulseCooldown(this.state.player);
    const p = this.state.player;
    for (const e of this.world.enemies())
      if (e.alive && dist(e, p) < 4.2) this.hitEnemy(e, pulsePower(p));
    this.addRing(p.x, p.z, 0xc9f8cf, 4.2, 0.45);
    this.particles.burst(p.x, 0.8, p.z, 0xd9ffe1, 28, 1.5);
    this.sound.effect("shrine");
    this.shake = 0.2;
  }
  ward() {
    if (this.paused || this.dead) return;
    if (!this.state.player.skills.ward) {
      this.ui.toast("Ward is sleeping", "Help Tavi at Lanternbridge to learn it.", "shield");
      return;
    }
    if (this.cooldowns.ward > 0) return;
    this.cooldowns.ward = 12;
    this.wardTimer = 3;
    this.wardAura.visible = true;
    const p = this.state.player;
    this.addRing(p.x, p.z, 0xaeeecb, 2, .35);
    this.particles.burst(p.x, 1, p.z, 0xbef8d3, 18, .7);
    this.sound.effect("heal");
  }
  useKit() {
    if (this.paused || this.dead || this.orientationBlocked || this.cooldowns.kit > 0) return;
    const p=this.state.player,id=p.kit.selected,item=KIT_BY_ID[id];
    if (!item || p.kit.supplies[id]<1 || this.state.world.trails.claimed.length<item.unlock) {
      this.ui.toast("Your kit is empty", "Craft a preparation at a restored waystone.", "info");
      return;
    }
    let targets=[];
    if (id === "flash") {
      targets=this.world.enemies().filter(e=>e.alive && !isBossType(e.type) && dist(e,p)<3.6);
      if (!targets.length) {this.ui.toast("No creature nearby", "Dawnflash interrupts nearby non-boss creatures.", "info");return;}
    }
    if (id === "tonic" && this.kitTimers.haste>0) {this.ui.toast("Tonic already active", "The effects cannot be stacked.", "info");return;}
    if (id === "draught" && (this.kitTimers.regen>0 || p.hp>=maxHealth(p))) {
      this.ui.toast("Save your draught", "Use it when vitality is missing and no draught is active.", "info");return;
    }
    if (!spendKit(this.state,id)) return;
    this.cooldowns.kit=item.cooldown;
    if (id === "flash") {
      for (const enemy of targets) {
        // A flash interrupts, but does not turn an unprovoked Haven creature hostile.
        enemy.state="stunned";enemy.stateTime=0;enemy.aftershock=0;
        enemy.model.userData.ring.visible=false;this.hideAim(enemy);
        this.floaters.push({id:"d"+this.nextFloat++,x:enemy.x,z:enemy.z,y:1.8,text:"STUN",life:1.2,max:1.2});
      }
      this.addRing(p.x,p.z,0xffe6a0,3.6,.4);this.particles.burst(p.x,.8,p.z,0xffe9a5,25,1.1);
      this.ui.toast("Dawnflash", `${targets.length} creature${targets.length===1 ? "" : "s"} interrupted.`, "sun");
    } else if (id === "tonic") {
      this.kitTimers.haste=10;this.particles.burst(p.x,.8,p.z,0xc8f1a1,18,.6);
      this.ui.toast("Trail tonic", "Movement speed increased for 10 seconds.", "leaf");
    } else if (id === "draught") {
      this.kitTimers.regen=6;this.particles.burst(p.x,.8,p.z,0xa6e4c1,18,.6);
      this.ui.toast("Moss draught", "Restoring vitality; a hit will interrupt it.", "potion");
    }
    this.sound.effect("heal");this.queueSave();
  }
  potion() {
    if (this.paused || this.dead || this.cooldowns.potion > 0) return;
    const p = this.state.player;
    if (p.hp >= maxHealth(p)) {
      this.ui.toast(
        "Feeling your best",
        "Save that remedy for when you need it.",
        "heart",
      );
      return;
    }
    if (p.potions < 1) {
      this.ui.toast(
        "No remedies left",
        "Rowan can brew one from sunpetals.",
        "potion",
      );
      return;
    }
    p.potions--;
    p.hp = Math.min(maxHealth(p), p.hp + remedyPower(p));
    this.cooldowns.potion = 1;
    this.particles.burst(p.x, 1, p.z, 0xa9f4c7, 20, 0.8);
    this.sound.effect("heal");
    this.queueSave();
  }
  hurt(amount, enemy) {
    if (this.dead || this.invulnerable > 0) return;
    const p = this.state.player;
    if (this.wardTimer > 0) {
      amount = Math.max(1, Math.ceil(amount * .35));
      this.wardTimer = 0;
      this.wardAura.visible = false;
      this.ui.toast("The ward holds", "The next blow was softened.", "shield");
    }
    amount = Math.max(1,Math.round(amount * (gearStats(p).damageFactor ?? 1)));
    p.hp = Math.max(0, p.hp - amount);
    this.onContinuousChange?.();
    if (this.kitTimers.regen > 0) {
      this.kitTimers.regen=0;
      this.ui.toast("Draught interrupted", "Find a safe moment to recover.", "info");
    }
    this.invulnerable = 0.6;
    this.shake = 0.35;
    this.sound.effect("hurt");
    this.particles.burst(p.x, 1, p.z, 0xffb894, 12, 0.8);
    this.floaters.push({
      id: "d" + this.nextFloat++,
      x: p.x,
      z: p.z,
      y: 2,
      text: `−${Math.round(amount)}`,
      life: 0.8,
      max: 0.8,
    });
    const d = dist(p, enemy) || 1;
    this.movePlayer(((p.x - enemy.x) / d) * 0.5, ((p.z - enemy.z) / d) * 0.5);
    if (p.hp <= 0) {
      this.dead = true;
      this.pendingStrike = null;
      this.attackTimer = this.dodgeTimer = this.wardTimer = 0;
      this.wardAura.visible = false;
      const lost = Math.floor(p.coins * 0.1);
      p.coins -= lost;
      creditStat(this.state.stats,"falls",1);
      recordEvent(this.state, "fall", p.lastShrine);
      this.ui.showGameOver(lost);
      this.queueSave();
    }
  }
  interact(target = null) {
    if (this.paused || this.dead) return;
    const p = this.state.player,
      thing = target || this.world.nearby(p.x, p.z);
    if (!thing || !thing.model?.visible || dist(p, thing) > 2.4) {
      this.ui.toast(
        "Nothing quite close enough",
        "Walk up to a person, flower, stone, or waystone.",
        "info",
      );
      return;
    }
    if (thing.kind === "npc") {
      thing.model.rotation.y = Math.atan2(p.x - thing.x, p.z - thing.z);
      this.ui.showDialogue(thing);
      return;
    }
    if (thing.kind === "node") {
      if (!thing.model.visible) return;
      if (p[thing.type] >= INVENTORY_LIMIT) {
        this.ui.toast("Your pack is full", "Use some materials before gathering more.", "info");
        return;
      }
      thing.model.visible = false;
      this.state.world.respawns[thing.id] = Date.now() + 120000;
      if (thing.type === "bloom") {
        creditInventory(p,"bloom",1);
        creditStat(this.state.stats,"blooms",1);
      } else {
        creditInventory(p,"ore",1);
        creditStat(this.state.stats,"ore",1);
      }
      this.gainXp(4);
      this.particles.burst(
        thing.x,
        0.5,
        thing.z,
        thing.type === "bloom" ? 0xffdd86 : 0xa4e6d4,
        14,
        0.6,
      );
      this.sound.effect("pickup");
      this.ui.toast(
        thing.type === "bloom" ? "Sunpetal gathered" : "Vale ore gathered",
        `+1 ${thing.type === "bloom" ? "sunpetal" : "ore"} · it will grow back in time.`,
        thing.type === "bloom" ? "leaf" : "gem",
      );
      this.checkAchievements();
      this.queueSave();
      return;
    }
    if (thing.kind === "archive") { this.ui.openArchive(thing); return; }
    if (thing.kind === "project") { this.ui.openProject(thing); return; }
    if (thing.kind === "anchor") {
      const result=repairTideAnchor(this.state,thing.region);
      if (!result.ok) {
        const cost=REGION_BY_ID[thing.region].anchor.cost;
        this.ui.toast(result.reason === 'already' ? 'Tide anchor steady' : 'Materials needed',
          result.reason === 'already' ? 'The local surges remain calm and water is easier to cross.' :
            `This anchor needs ${cost.ore} ore and ${cost.echoes} echoes.`, 'info');
        return;
      }
      setTideAnchorActive(thing.model,true);
      const record=this.world.regions.get(thing.region);
      for (const surge of record?.surges || []) surge.warning.visible=false;
      this.gainXp(60);
      this.particles.burst(thing.x,1.7,thing.z,0xa3efdf,32,1.1);
      this.addRing(thing.x,thing.z,0xb8f3dc,3.8,.6);
      this.sound.effect('shrine');
      this.ui.toast('Tide anchor restored','Local surges are calm; water slows you less.','star');
      this.checkAchievements();this.queueSave();return;
    }
    if (thing.kind === "beacon") {
      const result = repairBeacon(this.state, thing.region);
      if (!result.ok) {
        this.ui.toast(result.reason === "already" ? "Signal steady" : "Materials needed",
          result.reason === "already" ? "This beacon is already calming nearby Hush." : "A beacon needs 2 echoes and 2 ore.", "info");
        return;
      }
      setSignalBeaconActive(thing.model, true);
      this.gainXp(45);
      this.particles.burst(thing.x, 2, thing.z, 0xc6ffda, 30, 1.2);
      this.sound.effect("shrine");
      this.ui.toast("Beacon restored", "Nearby Hush notice you less and strike more gently.", "star");
      this.checkAchievements();this.queueSave();return;
    }
    if (thing.kind === "cache") {
      const result = openCache(this.state, thing.region);
      if (!result.ok) return;
      setSupplyCacheOpen(thing.model, true);
      const labels = {coins:"gold",echoes:"echoes",ore:"ore",bloom:"sunpetals",potions:"remedies"};
      const text = Object.entries(result.reward).filter(([,value])=>value).map(([key,value])=>`+${value} ${labels[key]}`).join(" · ");
      this.gainXp(20);
      this.particles.burst(thing.x,.7,thing.z,0xffdfa0,20,.8);
      this.sound.effect("pickup");this.ui.toast("A courier's cache",text,"book");
      this.checkAchievements();this.queueSave();return;
    }
    if (thing.kind === "lore") {
      const region = REGION_BY_ID[thing.region];
      if (!this.state.world.lore.includes(thing.region)) {
        this.state.world.lore.push(thing.region);
        recordEvent(this.state, "memory", thing.region);
        this.gainXp(18);
        this.checkAchievements();
        this.queueSave();
      }
      this.ui.showMemory(region);
      return;
    }
    if (thing.kind === "shrine") {
      const active = this.state.world.activated.includes(thing.region);
      if (!active) {
        if (p.echoes < WAYSTONE_COST) {
          this.ui.toast(
            "The waystone is sleeping",
            `You need ${WAYSTONE_COST} echoes to restore it. You have ${p.echoes}.`,
            "gem",
          );
          return;
        }
        p.echoes -= WAYSTONE_COST;
        this.state.world.activated.push(thing.region);
        recordEvent(this.state, "waystone", thing.region);
        setShrineActive(thing.model, true);
        this.gainXp(30);
        this.particles.burst(thing.x, 1.5, thing.z, 0xe2ffcf, 40, 1.5);
        this.addRing(thing.x, thing.z, 0xe5f9c1, 4, 0.7);
        this.sound.effect("shrine");
        this.ui.toast(
          "A light in the world",
          `${REGION_BY_ID[thing.region].name} waystone restored.`,
          "star",
        );
        this.checkAchievements();
      } else
        this.ui.toast(
          "A moment of rest",
          "Vitality restored. Open the atlas to travel.",
          "heart",
        );
      p.lastShrine = thing.region;
      p.hp = maxHealth(p);
      this.queueSave();
    }
  }
  cycleArchiveDial(item,index) {
    const result=rotateArchive(this.state,item.region,index);
    if(result.ok) this.queueSave();
    return result;
  }
  alignArchive(item) {
    const result=submitArchive(this.state,item.region);
    this.queueSave(); // Failed attempts are persistent too.
    if(!result.ok) return result;
    this.gainXp(result.reward.xp);
    setArchiveSolved(item.model,true);
    this.particles.burst(item.x,1.5,item.z,0xc8f3ca,28,1.3);
    this.sound.effect("shrine");this.checkAchievements();
    this.ui.toast("Archive aligned",`${result.reward.xp} XP · ${result.reward.coins} gold · A new fragment remembered`);
    return result;
  }
  restoreProject(item,choice) {
    const result=buildProject(this.state,item.region,choice);
    if(!result.ok) return result;
    setProjectState(item.model,choice);
    this.particles.burst(item.x,1,item.z,choice==="shelter"?0xc3efd3:0xffd293,25,1);
    this.sound.effect("shrine");this.checkAchievements();this.queueSave();
    this.ui.toast("A place restored",choice==="shelter"?"A shelter softens local enemy damage by 15%.":"A watch raises local enemy XP and gold by 25%.");
    return result;
  }
  craftCharm(id) {
    if (!this.canTravel()) return {ok:false,reason:"waystone"};
    const result=craftCharm(this.state,id);
    if(result.ok) {this.sound.effect("level");this.queueSave();this.checkAchievements();}
    return result;
  }
  equipCharm(id) {
    if (!this.canTravel()) return false;
    const ok=equipCharm(this.state,id);
    if(ok) {
      this.state.player.hp=Math.min(this.state.player.hp,maxHealth(this.state.player));
      this.sound.effect("pickup");this.queueSave();
    }
    return ok;
  }
  canTravel() {
    const p = this.state.player;
    return this.world
      .records()
      .some(
        (r) =>
          this.state.world.activated.includes(r.data.id) &&
          dist(p, r.shrine) < 3.2,
      );
  }
  travel(id) {
    if (!this.state.world.activated.includes(id) || !this.canTravel()) {
      this.ui.toast(
        "A waystone is needed",
        "Stand near a restored waystone to travel.",
        "compass",
      );
      return false;
    }
    const r = REGION_BY_ID[id];
    if (!r) return false;
    const pos = worldPosition(r, r.shrine.x, r.shrine.z + 2);
    this.clearProjectiles();
    this.state.player.x = pos.x;
    this.state.player.z = pos.z;
    this.state.player.lastShrine = id;
    this.player.position.set(pos.x, 0, pos.z);
    this.camera.position.x = pos.x;
    this.camera.position.z = pos.z + 21;
    this.world.updateStreaming(pos.x, pos.z);
    this.cancelClickMove();
    this.particles.burst(pos.x, 1, pos.z, 0xd9f8d0, 30, 1.2);
    this.sound.effect("shrine");
    this.ui.toast("Welcome back", `Arrived at ${r.name}.`, "compass");
    this.queueSave();
    return true;
  }
  acceptQuest(id) {
    if (acceptQuest(this.state, id)) {
      this.ui.toast("New request", QUESTS[id].name, "flag");
      this.queueSave();
    }
  }
  completeQuest(id) {
    const result = completeQuest(this.state, id);
    if (!result) return;
    this.levelFeedback(result.levels);
    this.ui.toast(
      "Request complete",
      `${QUESTS[id].name} · +${result.reward.xp} XP`,
      "check",
    );
    if (result.reward.skill)
      this.ui.toast(
        "A new power",
        result.reward.skill === "ward" ? `Ward unlocked. Press ${keyLabel((this.settings.bindings || DEFAULT_BINDINGS).ward)} to use it.` : `Light Pulse unlocked. Press ${keyLabel((this.settings.bindings || DEFAULT_BINDINGS).pulse)} to use it.`,
        result.reward.skill === "ward" ? "shield" : "pulse",
      );
    this.checkAchievements();
    this.queueSave();
    return true;
  }
  trackQuest(id) {
    if (this.state.world.quests[id] === "active") {
      this.state.activeQuest = id;
      this.state.world.trails.active = null;
      this.state.world.pinnedRegion = null;
      this.queueSave();
      return true;
    }
    return false;
  }
  pinRegion(id) {
    if (id !== null && (!Object.hasOwn(REGION_BY_ID,id) || !this.state.world.visited.includes(id))) return false;
    this.state.world.pinnedRegion = id;
    this.queueSave();
    return true;
  }
  trackRoute(id) {
    if (!trackTrail(this.state,id)) return false;
    if (id !== null) this.state.world.pinnedRegion = null;
    this.queueSave();
    return true;
  }
  claimRoute(id) {
    if (!this.canTravel()) return {ok:false,reason:"waystone"};
    const result=claimTrail(this.state,id);
    if (!result.ok) return {ok:false,reason:"incomplete"};
    this.gainXp(result.reward.xp || 0);
    recordEvent(this.state,"trail",id);
    this.checkAchievements();this.queueSave();
    return result;
  }
  craftPreparation(id) {
    if (!this.canTravel()) return {ok:false,reason:"waystone"};
    const result=craftKit(this.state,id);
    if (result.ok) {this.sound.effect("level");this.queueSave();}
    return result;
  }
  equipPreparation(id) {
    if (!this.canTravel() || !equipKit(this.state,id)) return false;
    this.queueSave();return true;
  }
  talent(type) {
    if (spendTalent(this.state, type)) {
      this.sound.effect("level");
      this.ui.toast(
        "Power point spent",
        "Your light grows a little stronger.",
        "star",
      );
      this.queueSave();
    }
  }
  forge() {
    const p = this.state.player,
      rank = p.weapon,
      cost = 25 + rank * 20,
      ore = 3 + rank * 2;
    if (rank >= 5) return;
    if (p.coins < cost || p.ore < ore) {
      this.ui.toast(
        "More materials needed",
        `Requires ${cost} gold and ${ore} ore.`,
        "info",
      );
      return;
    }
    p.coins -= cost;
    p.ore -= ore;
    p.weapon++;
    this.sound.effect("level");
    this.queueSave();
    return true;
  }
  brew() {
    const p = this.state.player;
    if (p.bloom < 3) {
      this.ui.toast(
        "More sunpetals needed",
        "Bring Rowan 3 sunpetals to brew a remedy.",
        "leaf",
      );
      return;
    }
    if (p.potions >= INVENTORY_LIMIT) {
      this.ui.toast("Your pack is full", "Use a remedy before brewing another.", "info");
      return;
    }
    p.bloom -= 3;
    creditInventory(p,"potions",1);
    this.sound.effect("pickup");
    this.queueSave();
    return true;
  }
  gainXp(amount) {
    const levels = addXp(this.state, amount);
    this.levelFeedback(levels);
  }
  levelFeedback(levels) {
    for (const level of levels) {
      this.sound.effect("level");
      this.particles.burst(
        this.state.player.x,
        1,
        this.state.player.z,
        0xffe7a4,
        35,
        1.2,
      );
      this.ui.toast(
        "A little stronger",
        `Level ${level} reached · +1 power point.`,
        "star",
      );
    }
  }
  checkAchievements() {
    for (const a of unlockAchievements(this.state))
      this.ui.toast("Achievement unlocked", a.name, "crown");
  }
  respawn(announce = true) {
    const p = this.state.player,
      r = REGION_BY_ID[p.lastShrine] || REGION_BY_ID.haven,
      pos = worldPosition(r, r.shrine.x, r.shrine.z + 2.5);
    p.x = pos.x;
    p.z = pos.z;
    p.hp = maxHealth(p);
    this.dead = false;
    this.clearProjectiles();
    this.pendingStrike = null;
    this.attackTimer = this.dodgeTimer = this.wardTimer = 0;
    this.kitTimers.haste = this.kitTimers.regen = 0;
    this.wardAura.visible = false;
    this.cancelClickMove();
    this.keys.clear();
    this.invulnerable = 1.2;
    this.world.updateStreaming(p.x, p.z);
    this.player.position.set(p.x, 0, p.z);
    this.camera.position.x = p.x;
    this.camera.position.z = p.z + 21;
    if (announce) {
      this.particles.burst(p.x, 1, p.z, 0xe8ffd8, 28, 1);
      this.ui.toast("Welcome back", "Your light is still here.", "heart");
      this.queueSave();
    }
  }
  addRing(x, z, color, radius, duration, direction = null) {
    const mesh = new THREE.Mesh(
      new THREE.RingGeometry(
        0.85,
        1,
        48,
        1,
        direction ? -Math.PI * 0.45 : 0,
        direction ? Math.PI * 0.9 : Math.PI * 2,
      ),
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.75,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    mesh.rotation.x = -Math.PI / 2;
    if (direction) mesh.rotation.y = Math.atan2(-direction.y, direction.x);
    mesh.position.set(x, 0.08, z);
    this.scene.add(mesh);
    this.effects.push({ mesh, radius, duration, life: duration });
  }
  updateEffects(dt) {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      e.life -= dt;
      const t = 1 - e.life / e.duration;
      e.mesh.scale.setScalar(0.35 + t * e.radius);
      e.mesh.material.opacity = Math.max(0, (1 - t) * 0.7);
      if (e.life <= 0) {
        this.scene.remove(e.mesh);
        e.mesh.geometry.dispose();
        e.mesh.material.dispose();
        this.effects.splice(i, 1);
      }
    }
  }
  project(x, y, z) {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    return {
      x: (v.x * 0.5 + 0.5) * this.host.clientWidth,
      y: (-v.y * 0.5 + 0.5) * this.host.clientHeight,
      visible: v.z < 1 && v.x > -1.1 && v.x < 1.1 && v.y > -1.1 && v.y < 1.1,
    };
  }
  renderLabels() {
    if (!this.ui.playing) return;
    const p = this.state.player,
      items = [];
    for (const n of this.world.npcs())
      if (dist(n, p) < 13) {
        const point = this.project(n.x, 2.65, n.z);
        if (point.visible) {
          const q = QUESTS[n.data.quest],
            status = this.state.world.quests[q.id],
            ready = status === "active" && questProgress(this.state, q).ready;
          items.push({
            id: "npc" + n.id,
            ...point,
            html: `<span class="label-marker">${!status ? "!" : ready ? "?" : "✦"}</span>${n.data.name}<span class="label-role">${n.data.title}</span>`,
          });
        }
      }
    for (const e of this.world.enemies())
      if (e.alive && dist(e, p) < 9) {
        const point = this.project(e.x, isBossType(e.type) ? 2.2 : 1.8, e.z);
        if (point.visible)
          items.push({
            id: e.id,
            ...point,
            className: "enemy-label",
            html: `<div class="enemy-health"><span style="width:${Math.max(0, (e.hp / e.maxHp) * 100)}%"></span></div>${e.type === "tempest" ? "TEMPEST ENGINE" : e.type === "caster" ? "SHARDCASTER" : e.type === "warden" ? "STORM WARDEN" : e.type === "guardian" ? "CROWN GUARDIAN" : e.type === "sentinel" ? "SENTINEL" : e.type === "surger" ? "TIDE-RUNNER" : e.type === "thorn" ? "THORNLING" : "HUSHLING"} · ${e.level}`,
          });
      }
    for (const f of this.floaters) {
      const point = this.project(f.x, f.y + (1 - f.life / f.max) * 0.9, f.z);
      if (point.visible)
        items.push({
          id: f.id,
          ...point,
          className: "thing-label",
          html: `<strong>${f.text}</strong>`,
        });
    }
    this.ui.setLabels(items);
  }
  drawMinimap() {
    const canvas = this.ui.root.querySelector("#minimap");
    if (!canvas) return;
    const ctx = canvas.getContext("2d"),
      p = this.state.player,
      size = 160,
      scale = 3.4;
    ctx.clearRect(0, 0, size, size);
    ctx.save();
    ctx.beginPath();
    ctx.arc(80, 80, 80, 0, Math.PI * 2);
    ctx.clip();
    ctx.fillStyle = "#91b694";
    ctx.fillRect(0, 0, size, size);
    // Avoid drawing every tree and road in the entire world into a clipped
    // 160px canvas. Only regions intersecting the minimap can affect it.
    for (const r of minimapRegions(REGIONS, p, size, scale)) {
      const c = { x: (r.gx - 2) * 54, z: r.gz * 54 },
        left = 80 + (c.x - 27 - p.x) * scale,
        top = 80 + (c.z - 27 - p.z) * scale;
      ctx.fillStyle = r.accent;
      ctx.fillRect(left, top, 54 * scale, 54 * scale);
      ctx.strokeStyle = "rgba(244,235,190,.65)";
      ctx.lineWidth = 7;
      ctx.beginPath();
      if (r.roads?.length) {
        for (const road of r.roads) road.points.forEach(([x,z],index)=>{
          const mx=80+(c.x+x-p.x)*scale,mz=80+(c.z+z-p.z)*scale;
          if(index===0) ctx.moveTo(mx,mz); else ctx.lineTo(mx,mz);
        });
      } else {
        ctx.moveTo(left, 80 + (c.z - p.z) * scale);
        ctx.lineTo(left + 54 * scale, 80 + (c.z - p.z) * scale);
        ctx.moveTo(80 + (c.x - p.x) * scale, top);
        ctx.lineTo(80 + (c.x - p.x) * scale, top + 54 * scale);
      }
      ctx.stroke();
      for (const water of r.water || []) {
        ctx.fillStyle = "#7dbeb3";
        ctx.beginPath();
        ctx.ellipse(
          80 + (c.x + water.x - p.x) * scale,
          80 + (c.z + water.z - p.z) * scale,
          water.rx * scale,
          water.rz * scale,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      for (const [x, z] of r.trees) {
        ctx.fillStyle = "rgba(70,124,85,.55)";
        ctx.beginPath();
        ctx.arc(
          80 + (c.x + x - p.x) * scale,
          80 + (c.z + z - p.z) * scale,
          2.6,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
      const sx = 80 + (c.x + r.shrine.x - p.x) * scale,
        sy = 80 + (c.z + r.shrine.z - p.z) * scale;
      ctx.fillStyle = this.state.world.activated.includes(r.id)
        ? "#fff0a8"
        : "#7b8c77";
      ctx.beginPath();
      ctx.arc(sx, sy, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const n of this.world.npcs()) {
      ctx.fillStyle = "#fff5d4";
      ctx.beginPath();
      ctx.arc(
        80 + (n.x - p.x) * scale,
        80 + (n.z - p.z) * scale,
        2.8,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
    for (const e of this.world.enemies())
      if (e.alive) {
        ctx.fillStyle = "#d88f77";
        ctx.beginPath();
        ctx.arc(
          80 + (e.x - p.x) * scale,
          80 + (e.z - p.z) * scale,
          2.2,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    // Gold diamond is the tracked destination; clamp distant goals to the rim.
    if (this.currentGuide) {
      const dx=(this.currentGuide.x-p.x)*scale, dz=(this.currentGuide.z-p.z)*scale;
      const length=Math.hypot(dx,dz), factor=length>66 ? 66/length : 1;
      const x=80+dx*factor, y=80+dz*factor;
      ctx.fillStyle="#ffd473";ctx.strokeStyle="#284a39";ctx.lineWidth=1.5;
      ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x+5,y);ctx.lineTo(x,y+5);ctx.lineTo(x-5,y);ctx.closePath();ctx.fill();ctx.stroke();
    }
    ctx.translate(80, 80);
    ctx.rotate(Math.atan2(this.facing.x, -this.facing.y));
    ctx.fillStyle = "#fff9df";
    ctx.strokeStyle = "#44644e";
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, -7);
    ctx.lineTo(5, 5);
    ctx.lineTo(0, 3);
    ctx.lineTo(-5, 5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }
  renderHud() {
    const region =
      regionAt(this.state.player.x, this.state.player.z) || REGION_BY_ID.haven;
    this.currentGuide = this.settings.guidance === false ? null : navigationTarget(this.state);
    this.ui.renderHUD(
      this.state,
      region,
      this.world.nearby(this.state.player.x, this.state.player.z),
      this.cooldowns,
      this.currentGuide,
      this.kitTimers,
    );
  }
  queueSave() {
    this.onSave?.();
  }
  destroy() {
    cancelAnimationFrame(this.frame);
    this.resetTouchControl?.();
    this.abort.abort();
    this.wardAura.geometry.dispose();
    this.wardAura.material.dispose();
    this.clearProjectiles();
    this.boltGeometry.dispose();this.boltMaterial.dispose();
    this.scene.remove(this.particles.points);
    this.particles.points.geometry.dispose();this.particles.points.material.dispose();
    for (const effect of this.effects) {
      this.scene.remove(effect.mesh);effect.mesh.geometry.dispose();effect.mesh.material.dispose();
    }
    this.effects.length=0;
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.host.innerHTML = "";
    this.ui.setLabels([]);
  }
}
