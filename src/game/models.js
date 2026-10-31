import * as THREE from "three";
import {
  makeDetailedPerson,
  animateDetailedPerson,
  makeDetailedBuilding,
} from "./assets.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

const materials = new Map();
const geometries = new Map();
function material(color, options = {}) {
  const key = `${color}:${JSON.stringify(options)}`;
  if (!materials.has(key))
    materials.set(
      key,
      new THREE.MeshStandardMaterial({ color, roughness: 0.83, ...options }),
    );
  return materials.get(key);
}
function geometry(key, factory) {
  if (!geometries.has(key)) geometries.set(key, factory());
  return geometries.get(key);
}
function add(parent, geom, mat, x = 0, y = 0, z = 0, shadows = true) {
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = shadows;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}
const sphere = (r = 1) =>
  geometry(`sphere:${r}`, () => new THREE.SphereGeometry(r, 16, 12));
const ico = (r = 1, detail = 1) =>
  geometry(
    `ico:${r}:${detail}`,
    () => new THREE.IcosahedronGeometry(r, detail),
  );
const box = (x, y, z) =>
  geometry(`box:${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z));
const cylinder = (a, b, h, n = 12) =>
  geometry(
    `cyl:${a}:${b}:${h}:${n}`,
    () => new THREE.CylinderGeometry(a, b, h, n),
  );
const cone = (r, h, n = 10) =>
  geometry(`cone:${r}:${h}:${n}`, () => new THREE.ConeGeometry(r, h, n));
const torus = (r, t) =>
  geometry(`torus:${r}:${t}`, () => new THREE.TorusGeometry(r, t, 8, 32));
const stone = () => material(0x9caa98);
const wood = () => material(0x74583f);
const darkWood = () => material(0x4f3f32);
const gold = () => material(0xd5ab60, { metalness: 0.38, roughness: 0.5 });

export function makeHumanoid({
  color = 0x3d827d,
  player = false,
  accent = 0xc7b58d,
  npcId = "",
} = {}) {
  const detailed = makeDetailedPerson({ player, npcId });
  if (detailed) return detailed;
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skin = material(0xb6805c),
    dark = material(0x382c2a),
    coat = material(color),
    cloth = material(accent),
    boot = material(0x51443b);
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.16, 0.7, 0);
    body.add(leg);
    add(leg, cylinder(0.11, 0.12, 0.46, 10), material(0x545c4f), 0, -0.22, 0);
    add(leg, box(0.23, 0.18, 0.32), boot, 0, -0.48, 0.05);
    legs.push(leg);
  }
  add(body, cylinder(0.24, 0.34, 0.65, 12), coat, 0, 1.02, 0);
  add(body, cylinder(0.31, 0.32, 0.1, 12), darkWood(), 0, 0.79, 0);
  add(body, box(0.12, 0.1, 0.05), gold(), 0, 0.79, 0.32);
  add(body, cylinder(0.18, 0.21, 0.14, 12), cloth, 0, 1.39, 0);
  add(body, sphere(0.285), skin, 0, 1.68, 0);
  const hair = add(body, sphere(0.292), dark, 0, 1.77, -0.03);
  hair.scale.set(1, 0.76, 1);
  for (const side of [-1, 1]) {
    const lock = add(body, sphere(0.12), dark, side * 0.23, 1.68, 0.035);
    lock.scale.set(0.7, 1.5, 1);
    const eye = add(
      body,
      sphere(0.025),
      material(0x292e29),
      side * 0.1,
      1.68,
      0.268,
      false,
    );
    eye.scale.set(0.8, 1, 0.45);
  }
  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.31, 1.25, 0);
    body.add(arm);
    const sleeve = add(
      arm,
      cylinder(0.11, 0.1, 0.4, 10),
      coat,
      side * 0.035,
      -0.19,
      0,
    );
    sleeve.rotation.z = side * 0.15;
    add(arm, sphere(0.095), skin, side * 0.06, -0.43, 0);
    arms.push(arm);
  }
  // A short, layered cloak reads clearly from the overhead camera.
  const capeGeom = new THREE.BufferGeometry();
  capeGeom.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -0.25, 1.32, -0.16, 0.25, 1.32, -0.16, -0.43, 0.48, -0.32, 0.25, 1.32,
        -0.16, 0.43, 0.48, -0.32, -0.43, 0.48, -0.32,
      ],
      3,
    ),
  );
  capeGeom.computeVertexNormals();
  const cape = add(
    body,
    capeGeom,
    material(player ? 0x286f70 : color, { side: THREE.DoubleSide }),
    0,
    0,
    0,
  );
  add(body, box(0.34, 0.4, 0.17), material(0x76543d), 0, 1.05, -0.23);
  add(body, box(0.25, 0.05, 0.19), gold(), 0, 1.16, -0.23);
  if (player) {
    const sword = new THREE.Group();
    sword.position.set(0.07, -0.42, 0.08);
    arms[1].add(sword);
    add(sword, cylinder(0.035, 0.04, 0.22, 8), darkWood(), 0, 0.09, 0);
    add(sword, box(0.24, 0.055, 0.075), gold(), 0, 0.2, 0);
    const blade = add(
      sword,
      box(0.105, 0.61, 0.04),
      material(0xd8e7df, { metalness: 0.55, roughness: 0.35 }),
      0,
      0.52,
      0,
    );
    const tip = add(
      sword,
      cone(0.075, 0.16, 4),
      material(0xd8e7df, { metalness: 0.55, roughness: 0.35 }),
      0,
      0.9,
      0,
    );
    tip.rotation.y = Math.PI / 4;
    sword.rotation.x = -1.0;
  } else {
    add(body, box(0.21, 0.26, 0.09), material(0x94704e), 0.23, 0.84, -0.18);
  }
  root.userData = { body, arms, legs, cape, phase: Math.random() * 5, player };
  return root;
}

export function animateHumanoid(model, time, moving, attack = 0, dodge = 0) {
  if (model.userData.animated) {
    animateDetailedPerson(model, time, moving, attack, dodge);
    return;
  }
  const { body, arms, legs, cape, phase, player } = model.userData;
  if (!body) return;
  const stride = moving ? Math.sin(time * 9 + phase) : 0;
  legs[0].rotation.x = stride * 0.62;
  legs[1].rotation.x = -stride * 0.62;
  arms[0].rotation.x = -stride * 0.4;
  arms[1].rotation.x =
    player && attack > 0
      ? -1.7 * Math.sin((1 - attack) * Math.PI)
      : stride * 0.4;
  arms[1].rotation.z =
    player && attack > 0 ? -1.2 * Math.sin((1 - attack) * Math.PI) : 0;
  body.position.y = moving
    ? Math.abs(stride) * 0.04
    : Math.sin(time * 2 + phase) * 0.018;
  body.rotation.z = dodge > 0 ? Math.sin((1 - dodge) * Math.PI) * 0.45 : 0;
  cape.rotation.x = Math.sin(time * 2.5 + phase) * 0.045 + (moving ? 0.12 : 0);
}

export function makeCreature(type = "wisp", level = 1) {
  const root = new THREE.Group(),
    body = new THREE.Group();
  root.add(body);
  const isGuardian = type === "guardian" || type === "warden" || type === "tempest",
    thorn = type === "thorn",
    sentinel = type === "sentinel",
    caster = type === "caster",
    surger = type === "surger";
  if (isGuardian) body.scale.setScalar(1.45);
  const shell = material(type === "tempest" ? 0x625d77 : type === "warden" ? 0x626786 : isGuardian ? 0x6d7774 : caster ? 0x786887 : surger ? 0x447d80 : sentinel ? 0x7b8790 : thorn ? 0x5c7562 : 0x526a70);
  const dark = material(isGuardian ? 0x35434a : 0x394f54);
  const glow = material(type === "tempest" || caster ? 0xe4c4ff : type === "warden" ? 0xc1d5ff : isGuardian ? 0xf2b762 : surger ? 0x9ff2e1 : sentinel ? 0xeac88d : 0x9cdec5, {
    emissive: type === "tempest" || caster ? 0x9d62c8 : type === "warden" ? 0x7186d0 : isGuardian ? 0xc27529 : surger ? 0x35bda9 : sentinel ? 0xb68b48 : 0x3ca98e,
    emissiveIntensity: 0.55,
    roughness: 0.42,
  });
  const orb = add(body, ico(isGuardian ? 0.73 : 0.49, 2), shell, 0, 0.78, 0);
  orb.scale.set(1, 0.9, 0.9);
  const belly = add(
    body,
    sphere(isGuardian ? 0.36 : 0.25),
    glow,
    0,
    0.78,
    0.39,
  );
  belly.scale.set(1, 0.85, 0.45);
  for (const side of [-1, 1]) {
    const eye = add(
      body,
      sphere(isGuardian ? 0.065 : 0.045),
      material(0xffe2a0, { emissive: 0xe8a840, emissiveIntensity: 0.8 }),
      side * (isGuardian ? 0.17 : 0.12),
      0.91,
      0.43,
      false,
    );
    eye.scale.z = 0.6;
    const arm = add(
      body,
      ico(isGuardian ? 0.3 : 0.18, 1),
      dark,
      side * (isGuardian ? 0.72 : 0.47),
      0.73,
      0,
    );
    arm.scale.set(0.8, 1.45, 0.8);
    const foot = add(
      body,
      sphere(isGuardian ? 0.25 : 0.14),
      dark,
      side * (isGuardian ? 0.38 : 0.25),
      0.2,
      0.04,
    );
    foot.scale.set(1, 0.65, 1.2);
    const horn = add(
      body,
      cone(isGuardian ? 0.17 : 0.1, isGuardian ? 0.5 : 0.3, 7),
      thorn ? material(0x8bab72) : shell,
      side * (isGuardian ? 0.38 : 0.25),
      1.27,
      0,
    );
    horn.rotation.z = -side * 0.45;
  }
  if (thorn || isGuardian) {
    for (let i = 0; i < 5; i++) {
      const angle = (i / 5) * Math.PI * 2;
      const spike = add(
        body,
        cone(isGuardian ? 0.16 : 0.11, isGuardian ? 0.52 : 0.34, 6),
        thorn ? material(0x8fae76) : shell,
        Math.sin(angle) * 0.38,
        1.1,
        Math.cos(angle) * 0.3,
      );
      spike.rotation.z = Math.sin(angle) * 0.45;
    }
  }
  if (sentinel) {
    const crown = add(body, torus(0.24, 0.04), gold(), 0, 1.48, 0);
    crown.rotation.x = Math.PI / 2;
    add(body, cylinder(0.025, 0.04, 0.32, 7), gold(), 0, 1.36, 0);
    add(body, sphere(0.09), glow, 0, 1.62, 0, false);
  }
  if (surger) {
    for (const side of [-1,1]) {
      const fin=add(body,cone(.18,.7,6),glow,side*.48,1.08,-.14,false);
      fin.rotation.z=-side*.9;fin.scale.set(.65,1,.55);
    }
    const crest=add(body,torus(.36,.04),glow,0,1.37,0,false);
    crest.rotation.x=Math.PI/2;
  }
  if (caster || type === "tempest") {
    const halo=add(body,torus(caster ? .43 : .62,.045),glow,0,1.48,0,false);
    halo.rotation.x=Math.PI/2;
    for(const side of [-1,1]) {
      const shard=add(body,geometry("caster-shard",()=>new THREE.OctahedronGeometry(.18,0)),glow,side*.58,1.1,-.1,false);
      shard.scale.y=2.2; shard.rotation.z=side*.32;
    }
  }
  const ring = add(
    root,
    geometry("telegraph", () => new THREE.RingGeometry(0.86, 1, 48)),
    new THREE.MeshBasicMaterial({
      color: 0xff765d,
      transparent: true,
      opacity: 0.62,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
    0,
    0.12, // Above roads and water, so the danger edge remains visible.
    0,
    false,
  );
  ring.rotation.x = -Math.PI / 2;
  ring.visible = false;
  root.userData = {
    body,
    orb,
    ring,
    glow,
    type,
    baseScale: isGuardian ? 1.45 : 1,
    phase: Math.random() * 6,
  };
  return root;
}

let foliageTexture;
const foliageMaterials = new Map();
function foliageMaterial(color) {
  if (!foliageTexture) {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#e1efcf";
    ctx.fillRect(0, 0, 256, 256);
    let seed = 2381;
    const random = () =>
      (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let i = 0; i < 2200; i++) {
      const x = random() * 256,
        y = random() * 256,
        r = 2 + random() * 4;
      ctx.fillStyle =
        random() > 0.5 ? "rgba(36,78,41,.12)" : "rgba(255,255,215,.15)";
      ctx.beginPath();
      ctx.ellipse(x, y, r, r * 0.42, random() * Math.PI, 0, Math.PI * 2);
      ctx.fill();
    }
    foliageTexture = new THREE.CanvasTexture(canvas);
    foliageTexture.colorSpace = THREE.SRGBColorSpace;
    foliageTexture.wrapS = foliageTexture.wrapT = THREE.RepeatWrapping;
    foliageTexture.repeat.set(2, 2);
  }
  if (!foliageMaterials.has(color))
    foliageMaterials.set(
      color,
      new THREE.MeshStandardMaterial({
        color,
        map: foliageTexture,
        roughness: 1,
      }),
    );
  return foliageMaterials.get(color);
}
const leafPalettes = {
  green: [0x639663, 0x7cae70, 0x97bb78],
  gold: [0xb3a94f, 0xced178, 0xe2d58a],
  teal: [0x568b79, 0x74a993, 0x9fc2a1],
  pale: [0x91b0a0, 0xb6cbb0, 0xd4d9b8],
  light: [0xb4ddc6, 0xd2ead8, 0xf1efcd],
};
export function makeTree(kind = "green", scale = 1) {
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  const trunkGeometry = geometry("tree-trunk-merged", () => {
    const parts = [
      cylinder(0.22, 0.44, 2.75, 12).clone().translate(0, 1.37, 0),
    ];
    for (let i = 0; i < 4; i++) {
      const a = (i * Math.PI) / 2,
        part = cylinder(0.11, 0.22, 1.1, 8).clone();
      const matrix = new THREE.Matrix4().compose(
        new THREE.Vector3(Math.sin(a) * 0.38, 0.23, Math.cos(a) * 0.38),
        new THREE.Quaternion().setFromEuler(
          new THREE.Euler(Math.sin(a) * 0.95, 0, Math.cos(a) * 0.95),
        ),
        new THREE.Vector3(1, 1, 1),
      );
      part.applyMatrix4(matrix);
      parts.push(part);
    }
    return mergeGeometries(parts);
  });
  add(root, trunkGeometry, wood());
  const canopy = new THREE.Group();
  canopy.position.y = 2.75;
  root.add(canopy);
  const palette = leafPalettes[kind] || leafPalettes.green;
  const foliageGeometry = geometry(`tree-leaves:${kind}`, () => {
    const clusters = [
      [-0.8, 0.15, 0, 1.1],
      [0.8, 0.15, 0.05, 1.15],
      [0, 0.7, 0, 1.3],
      [-0.15, 0.05, 0.65, 0.95],
      [0.1, 0.2, -0.65, 0.9],
    ];
    const parts = clusters.map(([x, y, z, r], i) => {
      const part = ico(r, 2).clone();
      part.scale(1, 0.8, 1);
      part.translate(x, y, z);
      const color = new THREE.Color(palette[i % palette.length]),
        count = part.attributes.position.count,
        colors = new Float32Array(count * 3);
      for (let n = 0; n < count; n++) {
        colors[n * 3] = color.r;
        colors[n * 3 + 1] = color.g;
        colors[n * 3 + 2] = color.b;
      }
      part.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      return part;
    });
    return mergeGeometries(parts);
  });
  const leavesMat = foliageMaterial(0xffffff);
  leavesMat.vertexColors = true;
  add(canopy, foliageGeometry, leavesMat);
  if (kind === "light") {
    const glints = new THREE.InstancedMesh(
        ico(0.055, 0),
        material(0xffe6a3, { emissive: 0xffc56a, emissiveIntensity: 1 }),
        8,
      ),
      dummy = new THREE.Object3D();
    for (let i = 0; i < 8; i++) {
      const a = (i * Math.PI) / 4;
      dummy.position.set(
        Math.cos(a) * 1.05,
        0.3 + (i % 3) * 0.3,
        Math.sin(a) * 0.8,
      );
      dummy.updateMatrix();
      glints.setMatrixAt(i, dummy.matrix);
    }
    glints.instanceMatrix.needsUpdate = true;
    canopy.add(glints);
  }
  root.userData = { canopy, phase: Math.random() * 4 };
  return root;
}

export function makeRock(scale = 1, tint = 0x9ca88e) {
  const root = new THREE.Group();
  const main = add(root, ico(0.8, 1), material(tint), 0, 0.35, 0);
  main.scale.set(1.25, 0.65, 0.9);
  const moss = add(root, ico(0.43, 1), material(0x8caa7b), -0.3, 0.63, -0.15);
  moss.scale.y = 0.28;
  root.scale.setScalar(scale);
  return root;
}

export function makeCottage(scale = 1) {
  const detailed = makeDetailedBuilding("cottage");
  if (detailed) {
    const root = new THREE.Group();
    root.add(detailed);
    root.scale.setScalar(scale);
    return root;
  }
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  add(root, box(4.0, 2.6, 3.1), material(0xe2d5b5), 0, 1.3, 0);
  add(root, box(4.3, 0.25, 3.4), stone(), 0, 0.13, 0);
  for (const x of [-1.85, 1.85])
    for (const z of [-1.48, 1.48])
      add(root, box(0.15, 2.6, 0.15), darkWood(), x, 1.3, z);
  for (const z of [-1.58, 1.58])
    add(root, box(4.1, 0.16, 0.14), darkWood(), 0, 2.0, z);
  const roof = add(
    root,
    geometry("roof", () => new THREE.ConeGeometry(2.85, 1.65, 4)),
    material(0x758f72),
    0,
    3.4,
    0,
  );
  roof.rotation.y = Math.PI / 4;
  roof.scale.z = 0.79;
  add(root, box(0.58, 1.3, 0.13), darkWood(), 0, 0.7, 1.59);
  add(root, box(0.11, 1.3, 0.16), wood(), 0, 0.7, 1.68);
  for (const x of [-1.25, 1.25]) {
    add(root, box(0.58, 0.6, 0.08), wood(), x, 1.4, 1.6);
    add(
      root,
      box(0.42, 0.44, 0.1),
      material(0xf1c77d, { emissive: 0xad793c, emissiveIntensity: 0.3 }),
      x,
      1.4,
      1.66,
    );
    add(root, box(0.05, 0.48, 0.12), darkWood(), x, 1.4, 1.72);
    add(root, box(0.45, 0.05, 0.12), darkWood(), x, 1.4, 1.72);
  }
  add(root, box(0.5, 1.0, 0.5), stone(), 1.2, 3.4, -0.7);
  add(root, box(4.3, 0.12, 0.2), gold(), 0, 2.8, 1.2);
  return root;
}
export function makeStall() {
  const root = new THREE.Group();
  add(root, box(2.5, 0.2, 1.1), wood(), 0, 1, 0);
  for (const x of [-1, 1])
    for (const z of [-0.4, 0.4])
      add(root, box(0.1, 1.9, 0.1), wood(), x, 0.95, z);
  const awning = add(root, box(2.8, 0.12, 1.5), material(0xd7b978), 0, 1.95, 0);
  awning.rotation.x = 0.1;
  add(root, box(2.7, 0.2, 0.08), material(0x608b7a), 0, 1.87, 0.75);
  add(root, box(0.4, 0.35, 0.35), stone(), -0.55, 1.25, 0);
  add(root, cone(0.22, 0.35, 6), material(0xd6a55e), 0.45, 1.28, 0);
  return root;
}

export function makeShrine(active = false) {
  const root = new THREE.Group();
  add(root, cylinder(1.18, 1.28, 0.2, 20), material(0xa6b1a1), 0, 0.1, 0);
  add(root, cylinder(0.85, 0.98, 0.26, 16), material(0x72877c), 0, 0.31, 0);
  const ring = add(root, torus(0.65, 0.055), gold(), 0, 1.2, 0);
  ring.rotation.y = 0.15;
  add(root, cylinder(0.43, 0.57, 0.8, 12), stone(), 0, 0.77, 0);
  for (let i = 0; i < 4; i++) {
    const a = (i * Math.PI) / 2;
    add(
      root,
      cylinder(0.07, 0.09, 1, 8),
      gold(),
      Math.sin(a) * 0.45,
      1.13,
      Math.cos(a) * 0.45,
    );
  }
  const crystal = add(
    root,
    geometry("crystal", () => new THREE.OctahedronGeometry(0.34, 0)),
    new THREE.MeshStandardMaterial({
      color: active ? 0xb5f4d0 : 0x90a9a1,
      emissive: active ? 0x64c5a7 : 0x263f3a,
      emissiveIntensity: active ? 0.8 : 0.15,
      roughness: 0.24,
      metalness: 0.08,
    }),
    0,
    1.75,
    0,
  );
  crystal.scale.y = 1.5;
  const halo = add(
    root,
    torus(0.48, 0.018),
    new THREE.MeshBasicMaterial({
      color: 0xd5f8cd,
      transparent: true,
      opacity: active ? 0.75 : 0.16,
    }),
    0,
    1.75,
    0,
    false,
  );
  halo.rotation.x = Math.PI / 2;
  root.userData = { crystal, halo, ring, active };
  return root;
}
export function setShrineActive(root, active) {
  root.userData.active = active;
  root.userData.crystal.material.color.setHex(active ? 0xb5f4d0 : 0x90a9a1);
  root.userData.crystal.material.emissive.setHex(active ? 0x64c5a7 : 0x263f3a);
  root.userData.crystal.material.emissiveIntensity = active ? 0.8 : 0.15;
  root.userData.halo.material.opacity = active ? 0.75 : 0.16;
}
export function makeSignalBeacon(active = false) {
  const root = new THREE.Group();
  add(root, cylinder(0.68, 0.8, 0.2, 12), stone(), 0, 0.1, 0);
  add(root, cylinder(0.16, 0.22, 1.8, 10), material(0x566f69), 0, 1, 0);
  add(root, cylinder(0.38, 0.3, 0.18, 12), gold(), 0, 1.92, 0);
  const lamp = add(root, ico(0.31, 1), new THREE.MeshStandardMaterial({
    color: active ? 0xd5f8c5 : 0x74847a, emissive: active ? 0x86d8a6 : 0x283d36,
    emissiveIntensity: active ? .9 : .15, roughness: .3,
  }), 0, 2.22, 0);
  const ring = add(root, torus(0.5, .035), gold(), 0, 2.22, 0, false);
  ring.rotation.x = Math.PI / 2;
  root.userData = { lamp, ring, active };
  return root;
}
export function setSignalBeaconActive(root, active) {
  root.userData.active = active;
  root.userData.lamp.material.color.setHex(active ? 0xd5f8c5 : 0x74847a);
  root.userData.lamp.material.emissive.setHex(active ? 0x86d8a6 : 0x283d36);
  root.userData.lamp.material.emissiveIntensity = active ? .9 : .15;
}
/** A brass tidal gauge: the lens and moving rings visibly change on repair. */
export function makeTideAnchor(active = false) {
  const root=new THREE.Group();
  add(root,cylinder(.72,.86,.22,12),stone(),0,.11,0);
  add(root,cylinder(.18,.24,1.5,10),material(0x536e6b),0,.95,0);
  for (const side of [-1,1]) {
    const fork=add(root,box(.12,1.05,.15),gold(),side*.48,1.75,0);
    fork.rotation.z=-side*.16;
  }
  const lens=add(root,ico(.37,2),new THREE.MeshStandardMaterial({
    color:0x778e8c,emissive:0x1d4543,emissiveIntensity:.15,roughness:.3,metalness:.2,
  }),0,1.85,0);
  const ring=add(root,torus(.57,.045),gold(),0,1.85,0,false);
  ring.rotation.x=Math.PI/2;
  const dial=add(root,torus(.30,.025),gold(),0,1.15,.25,false);
  root.userData={lens,ring,dial,active:false};
  setTideAnchorActive(root,active);
  return root;
}
export function setTideAnchorActive(root,active) {
  root.userData.active=active;
  root.userData.lens.material.color.setHex(active ? 0x98f1dd : 0x778e8c);
  root.userData.lens.material.emissive.setHex(active ? 0x4ccab7 : 0x1d4543);
  root.userData.lens.material.emissiveIntensity=active ? .85 : .15;
  root.userData.dial.rotation.z=active ? -.8 : .8;
}
export function makeSupplyCache(open = false) {
  const root = new THREE.Group();
  add(root, box(1.2,.65,.8), wood(), 0,.37,0);
  add(root, box(1.22,.12,.83), darkWood(), 0,.16,0);
  for (const x of [-.42,.42]) add(root, box(.1,.64,.83), gold(), x,.39,0);
  const hinge = new THREE.Group();
  hinge.position.set(0,.68,-.4);root.add(hinge);
  add(hinge,box(1.24,.28,.83),darkWood(),0,.08,.4);
  add(hinge,box(.13,.3,.84),gold(),-.42,.09,.4);
  add(hinge,box(.13,.3,.84),gold(),.42,.09,.4);
  add(hinge,box(.18,.18,.08),gold(),0,-.02,.82);
  root.userData = { hinge };
  setSupplyCacheOpen(root, open);
  return root;
}
export function setSupplyCacheOpen(root, open) {
  root.userData.hinge.rotation.x = open ? -1.1 : 0;
}
export function makeNode(type) {
  const root = new THREE.Group();
  if (type === "bloom") {
    const stems = new THREE.InstancedMesh(
      cylinder(0.025, 0.025, 0.48, 6),
      material(0x5e905b),
      3,
    );
    const petals = new THREE.InstancedMesh(
      ico(0.11, 0),
      material(0xf4d682),
      18,
    );
    const centers = new THREE.InstancedMesh(
      ico(0.08, 0),
      material(0xe6a547, { emissive: 0xa56624, emissiveIntensity: 0.2 }),
      3,
    );
    const dummy = new THREE.Object3D();
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3,
        x = Math.cos(a) * 0.23,
        z = Math.sin(a) * 0.23;
      dummy.position.set(x, 0.24, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      stems.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, 0.555, z);
      dummy.updateMatrix();
      centers.setMatrixAt(i, dummy.matrix);
      for (let j = 0; j < 6; j++) {
        const b = (j * Math.PI) / 3;
        dummy.position.set(
          x + Math.cos(b) * 0.12,
          0.52,
          z + Math.sin(b) * 0.12,
        );
        dummy.rotation.set(0, -b, 0);
        dummy.scale.set(1, 0.32, 0.6);
        dummy.updateMatrix();
        petals.setMatrixAt(i * 6 + j, dummy.matrix);
      }
    }
    stems.instanceMatrix.needsUpdate =
      petals.instanceMatrix.needsUpdate =
      centers.instanceMatrix.needsUpdate =
        true;
    root.add(stems, petals, centers);
  } else {
    const rock = makeRock(0.75, 0x8c9a8d);
    root.add(rock);
    for (let i = 0; i < 3; i++) {
      const crystal = add(
        root,
        geometry("oreCrystal", () => new THREE.OctahedronGeometry(0.2, 0)),
        material(0x8cd1be, {
          emissive: 0x3b8d77,
          emissiveIntensity: 0.35,
          metalness: 0.25,
        }),
        -0.28 + i * 0.25,
        0.65 + (i % 2) * 0.12,
        0,
      );
      crystal.scale.y = 1.8;
      crystal.rotation.z = (i - 1) * 0.25;
    }
  }
  return root;
}
export function makeLoreStone() {
  const root = new THREE.Group();
  add(root, cylinder(0.72, 0.82, 0.15, 14), stone(), 0, 0.08, 0);
  const slab = add(root, box(0.75, 1.0, 0.27), material(0x94a99b), 0, 0.62, 0);
  slab.rotation.x = -0.12;
  add(root, box(0.54, 0.08, 0.04), gold(), 0, 0.88, 0.17);
  add(root, box(0.4, 0.035, 0.04), material(0xe1d8a8), 0, 0.65, 0.19);
  add(root, box(0.3, 0.035, 0.04), material(0xe1d8a8), 0, 0.52, 0.19);
  return root;
}
export function makeLamp() {
  const root = new THREE.Group();
  add(root, cylinder(0.07, 0.1, 1.55, 8), darkWood(), 0, 0.78, 0);
  add(
    root,
    box(0.34, 0.45, 0.34),
    material(0xf2ce82, { emissive: 0xdb993c, emissiveIntensity: 0.5 }),
    0,
    1.7,
    0,
  );
  add(root, cone(0.32, 0.22, 4), darkWood(), 0, 2.03, 0).rotation.y =
    Math.PI / 4;
  return root;
}

/** Region landmarks are authored props rather than procedurally placed objectives. */
/** An interactive, three-lens archive; solved state changes its light. */
export function makeArchive(solved = false) {
  const root = new THREE.Group();
  add(root,cylinder(1.05,1.2,.22,16),stone(),0,.11,0);
  add(root,cylinder(.72,.9,.75,12),material(0x687a78),0,.58,0);
  add(root,cylinder(.85,.7,.16,12),gold(),0,1.03,0);
  const light = new THREE.MeshStandardMaterial({color:solved?0xd9f5cc:0x928ca4,emissive:solved?0x74b888:0x4e455a,emissiveIntensity:.65,roughness:.35});
  const lens=add(root,geometry("archive-core",()=>new THREE.OctahedronGeometry(.38,1)),light,0,1.52,0,false);
  for (const [x,z] of [[-.55,.35],[0,-.55],[.55,.35]]) {
    const bezel=add(root,torus(.24,.045),gold(),x,1.2,z,false);
    bezel.rotation.x=Math.PI/2;
    add(root,sphere(.11),light,x,1.22,z,false);
  }
  root.userData={lens,light,solved};
  return root;
}
export function setArchiveSolved(root, solved) {
  root.userData.solved=solved;
  root.userData.light.color.setHex(solved?0xd9f5cc:0x928ca4);
  root.userData.light.emissive.setHex(solved?0x74b888:0x4e455a);
}

/** Two permanent restoration silhouettes on a shared footprint. */
export function makeProject(choice = null) {
  const root=new THREE.Group();
  add(root,cylinder(1.05,1.2,.18,12),stone(),0,.09,0);
  add(root,cylinder(.12,.18,1.75,10),wood(),0,.95,0);
  const neutral=add(root,box(.8,.48,.12),material(0xbba889),0,1.65,0);
  const shelter=new THREE.Group(),watch=new THREE.Group();
  root.add(shelter,watch);
  for(const x of [-.7,.7]) add(shelter,cylinder(.08,.08,1.3,8),wood(),x,.75,0);
  const roof=add(shelter,box(1.8,.13,1.2),material(0x8ab49a),0,1.45,0);
  roof.rotation.z=.08;
  add(shelter,box(1.3,.12,.5),wood(),0,.4,0);
  add(watch,cylinder(.09,.13,1.8,8),darkWood(),0,1.8,0);
  const lantern=add(watch,ico(.27,1),material(0xffd992,{emissive:0xe8ad55,emissiveIntensity:.7}),0,2.7,0,false);
  const flag=add(watch,box(.9,.45,.06),material(0xdba962),.45,2.3,0);
  flag.rotation.z=-.08;
  root.userData={neutral,shelter,watch,lantern,choice:null};
  setProjectState(root,choice);
  return root;
}
export function setProjectState(root, choice) {
  root.userData.choice=choice;
  root.userData.neutral.visible=!choice;
  root.userData.shelter.visible=choice==='shelter';
  root.userData.watch.visible=choice==='watch';
}

export function makeLandmark(kind, scale = 1) {
  const root = new THREE.Group();
  root.scale.setScalar(scale);
  if (kind === "mushrooms") {
    const caps = material(0xd99b77),
      stems = material(0xe8d6ae),
      spots = material(0xf8e5bf);
    for (const [x, z, size] of [
      [0, 0, 1],
      [0.65, 0.25, 0.7],
      [-0.6, 0.35, 0.55],
    ]) {
      add(
        root,
        cylinder(0.1 * size, 0.16 * size, 0.75 * size, 10),
        stems,
        x,
        0.37 * size,
        z,
      );
      const cap = add(root, sphere(0.42 * size), caps, x, 0.79 * size, z);
      cap.scale.set(1, 0.42, 1);
      for (let i = 0; i < 4; i++) {
        const a = (i * Math.PI) / 2;
        const spot = add(
          root,
          sphere(0.05 * size),
          spots,
          x + Math.cos(a) * 0.22 * size,
          0.89 * size,
          z + Math.sin(a) * 0.22 * size,
          false,
        );
        spot.scale.y = 0.35;
      }
    }
  } else if (kind === "crystals") {
    const base = makeRock(1.35, 0x859b91);
    root.add(base);
    for (const [x, z, h] of [
      [0, 0, 1.7],
      [0.55, 0.15, 1],
      [-0.45, 0.25, 1.2],
      [0.25, -0.5, 0.8],
      [-0.45, -0.35, 0.7],
    ]) {
      const crystal = add(
        root,
        geometry(
          "landmark-crystal",
          () => new THREE.OctahedronGeometry(0.35, 0),
        ),
        material(0x9addcc, {
          emissive: 0x4ea896,
          emissiveIntensity: 0.42,
          roughness: 0.3,
          metalness: 0.12,
        }),
        x,
        0.4 + h * 0.48,
        z,
      );
      crystal.scale.set(0.8, h, 0.8);
      crystal.rotation.z = x * 0.35;
    }
  } else if (kind === "arch") {
    const masonry = material(0xaebba7);
    for (const x of [-1.2, 1.2]) {
      add(root, box(0.5, 2.5, 0.55), masonry, x, 1.25, 0);
      add(root, box(0.7, 0.2, 0.75), stone(), x, 0.1, 0);
      add(root, box(0.7, 0.2, 0.75), stone(), x, 2.5, 0);
    }
    add(root, box(3, 0.36, 0.65), masonry, 0, 2.72, 0);
    add(root, box(2.4, 0.06, 0.7), gold(), 0, 2.75, 0.04);
    for (let i = 0; i < 5; i++) {
      const leaf = add(
        root,
        ico(0.13, 1),
        material(0x769b73),
        -1.3 + (i % 2) * 0.12,
        0.35 + i * 0.38,
        0.3,
        false,
      );
      leaf.scale.y = 1.3;
    }
  } else if (kind === "windvane") {
    add(root, cylinder(0.12, 0.2, 3.7, 10), darkWood(), 0, 1.85, 0);
    add(root, cylinder(0.25, 0.32, 0.2, 12), stone(), 0, 0.1, 0);
    const pivot = new THREE.Group();
    pivot.position.set(0, 3.35, 0.15);
    root.add(pivot);
    add(pivot, sphere(0.14), gold());
    for (let i = 0; i < 4; i++) {
      const arm = new THREE.Group();
      arm.rotation.z = (i * Math.PI) / 2;
      pivot.add(arm);
      add(arm, box(0.09, 1.15, 0.08), wood(), 0, 0.62, 0);
      const sail = add(
        arm,
        box(0.43, 0.65, 0.035),
        material(0xe8d8a8),
        0.19,
        0.75,
        0,
      );
      sail.rotation.z = -0.12;
    }
    root.userData.animatedPart = pivot;
    root.userData.animation = "windmill";
  } else if (kind === "bridge") {
    const planks = new THREE.InstancedMesh(
        box(0.48, 0.16, 2.1),
        material(0x9a734e),
        30,
      ),
      dummy = new THREE.Object3D();
    for (let i = 0; i < 30; i++) {
      dummy.position.set((i - 14.5) * 0.48, 0.14, 0);
      dummy.updateMatrix();
      planks.setMatrixAt(i, dummy.matrix);
    }
    planks.instanceMatrix.needsUpdate = true;
    root.add(planks);
    for (const z of [-1.05, 1.05]) {
      add(root, box(14.5, 0.13, 0.13), darkWood(), 0, 0.19, z);
      for (let i = 0; i < 7; i++)
        add(
          root,
          cylinder(0.06, 0.07, 0.55, 7),
          wood(),
          (i - 3) * 2.2,
          0.42,
          z,
        );
      add(root, box(14.3, 0.06, 0.06), material(0xc2a270), 0, 0.72, z);
    }
  } else if (kind === "observatory") {
    add(root,cylinder(1.5,1.7,2.3,16),material(0xa8a28f),0,1.15,0);
    add(root,cylinder(1.75,1.75,.18,16),stone(),0,.1,0);
    add(root,cylinder(1.65,1.65,.16,16),gold(),0,2.28,0);
    const dome=add(root,geometry("observatory-dome",()=>new THREE.SphereGeometry(1.5,20,10,0,Math.PI*2,0,Math.PI/2)),material(0x718287),0,2.35,0);
    for(const a of [0,Math.PI/2,Math.PI,Math.PI*1.5]) {
      const pillar=add(root,box(.13,2.1,.13),wood(),Math.sin(a)*1.5,1.15,Math.cos(a)*1.5);
      pillar.rotation.y=-a;
    }
    add(root,box(.7,1.2,.08),darkWood(),0,.75,1.47);
    add(root,box(.9,.12,.12),gold(),0,1.42,1.51);
    const scope=add(root,cylinder(.12,.19,1.6,10),gold(),.7,3.5,0);
    scope.rotation.z=-.7;
  } else if (kind === "stonecircle") {
    add(root,cylinder(1.65,1.85,.18,20),material(0x8f9f93),0,.09,0);
    for(let i=0;i<7;i++) {
      const a=i*Math.PI*2/7, h=.8+(i%3)*.22;
      const marker=add(root,box(.35,h,.35),stone(),Math.sin(a)*1.7,h/2,Math.cos(a)*1.7);
      marker.rotation.y=a;
    }
    const centre=add(root,geometry("circle-core",()=>new THREE.OctahedronGeometry(.26,0)),material(0xc0e5c9,{emissive:0x75b88a,emissiveIntensity:.35}),0,.48,0);
    centre.rotation.y=.3;
  } else if (kind === "terrace") {
    for(let i=0;i<3;i++) {
      const z=(i-1)*1.1;
      add(root,box(4.4,.22,.15),stone(),0,.12,z);
      add(root,box(4.2,.07,.95),material(i===1?0xbca873:0x99a77d),0,.08,z+.52);
    }
  } else if (kind === "garden") {
    const border = material(0x785a3f);
    for (const z of [-1.2, 1.2])
      add(root, box(4, 0.2, 0.14), border, 0, 0.12, z);
    for (const x of [-2, 2]) add(root, box(0.14, 0.2, 2.4), border, x, 0.12, 0);
    add(root, box(3.85, 0.08, 2.2), material(0x8b7653), 0, 0.08, 0);
    const flowers = new THREE.InstancedMesh(
        ico(0.13, 0),
        material(0xe9ce72, { emissive: 0x9f782f, emissiveIntensity: 0.15 }),
        21,
      ),
      dummy = new THREE.Object3D();
    for (let i = 0; i < 21; i++) {
      dummy.position.set(
        ((i % 7) - 3) * 0.47,
        0.26,
        (((i / 7) | 0) - 1) * 0.65,
      );
      dummy.updateMatrix();
      flowers.setMatrixAt(i, dummy.matrix);
    }
    flowers.instanceMatrix.needsUpdate = true;
    root.add(flowers);
  } else if (kind === "anvil") {
    add(root, cylinder(0.65, 0.8, 0.3, 10), stone(), 0, 0.15, 0);
    add(
      root,
      box(1.1, 0.35, 0.7),
      material(0x667d79, { metalness: 0.35 }),
      0,
      0.56,
      0,
    );
    add(
      root,
      box(0.75, 0.25, 0.8),
      material(0x748986, { metalness: 0.35 }),
      0,
      0.86,
      0,
    );
    const horn = add(
      root,
      cone(0.35, 0.7, 4),
      material(0x748986, { metalness: 0.35 }),
      0.65,
      0.84,
      0,
    );
    horn.rotation.z = -Math.PI / 2;
  }
  return root;
}
