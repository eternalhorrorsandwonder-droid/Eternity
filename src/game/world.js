import * as THREE from "three";
import {
  REGIONS,
  REGION_SIZE,
  regionAt,
  regionCenter,
  worldPosition,
} from "../data/world.js";
import {
  makeTree,
  makeRock,
  makeCottage,
  makeStall,
  makeShrine,
  makeNode,
  makeLoreStone,
  makeLamp,
  makeHumanoid,
  makeCreature,
  makeLandmark,
  makeSignalBeacon,
  makeSupplyCache,
  makeArchive,
  makeProject,
  makeTideAnchor,
} from "./models.js";
import { makeDetailedBuilding } from "./assets.js";
import { creatureMaxHealth, isBossType } from "../data/encounters.js";
import { createTideCycle } from "../core/tides.js";
import { CHARGE_DISTANCE, CHARGE_HIT_RADIUS } from "../core/charge.js";
import { cancelUnseenAttack } from "../core/encounter-state.js";

const tideFillGeometry = new THREE.CircleGeometry(1,48);
tideFillGeometry.rotateX(-Math.PI/2);
const tideRimGeometry = new THREE.RingGeometry(.84,1,48);
tideRimGeometry.rotateX(-Math.PI/2);

const chargeCapGeometry = new THREE.CircleGeometry(1,32);
chargeCapGeometry.rotateX(-Math.PI/2);
const aimGeometry = new THREE.BoxGeometry(1, .025, 1);
const aimMaterial = new THREE.MeshBasicMaterial({color:0xff8c76,transparent:true,opacity:.43,depthWrite:false});
const chargeMaterial = new THREE.MeshBasicMaterial({color:0xb94032,transparent:true,opacity:.62,depthWrite:false,side:THREE.DoubleSide});

function hashString(text) {
  let h = 2166136261;
  for (const c of text) {
    h ^= c.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function randomFor(seed) {
  let n = seed >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

let grassTexture, pathTexture;
function getGroundTexture() {
  if (grassTexture) return grassTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d"),
    rand = randomFor(117);
  ctx.fillStyle = "#f3f1d9";
  ctx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 2800; i++) {
    const x = rand() * 512,
      y = rand() * 512,
      r = 1 + rand() * 7;
    ctx.fillStyle =
      rand() > 0.5 ? "rgba(99,127,78,0.075)" : "rgba(255,255,224,0.12)";
    ctx.beginPath();
    ctx.ellipse(x, y, r, r * (0.3 + rand() * 0.5), rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  grassTexture = new THREE.CanvasTexture(canvas);
  grassTexture.wrapS = grassTexture.wrapT = THREE.RepeatWrapping;
  grassTexture.repeat.set(4, 4);
  grassTexture.colorSpace = THREE.SRGBColorSpace;
  return grassTexture;
}
function getPathTexture() {
  if (pathTexture) return pathTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d"),
    rand = randomFor(927);
  ctx.fillStyle = "#e7dfbf";
  ctx.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 700; i++) {
    const x = rand() * 256,
      y = rand() * 256,
      r = 1 + rand() * 4;
    ctx.fillStyle =
      rand() > 0.5 ? "rgba(146,124,89,.11)" : "rgba(255,251,219,.25)";
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.5, r * 0.65, rand() * 3, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < 70; i++) {
    const x = rand() * 256,
      y = rand() * 256,
      w = 3 + rand() * 7,
      h = 2 + rand() * 4;
    ctx.fillStyle = "rgba(152,137,108,.16)";
    ctx.beginPath();
    ctx.ellipse(x, y, w, h, rand(), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(255,255,238,.20)";
    ctx.fillRect(x - w * 0.4, y - h * 0.7, w * 0.8, 1);
  }
  pathTexture = new THREE.CanvasTexture(canvas);
  pathTexture.colorSpace = THREE.SRGBColorSpace;
  pathTexture.wrapS = pathTexture.wrapT = THREE.RepeatWrapping;
  return pathTexture;
}
function ground(region) {
  const geom = new THREE.PlaneGeometry(
    REGION_SIZE + 0.04,
    REGION_SIZE + 0.04,
    18,
    18,
  );
  geom.rotateX(-Math.PI / 2);
  const position = geom.attributes.position,
    colors = [],
    base = new THREE.Color(region.color),
    rand = randomFor(hashString(region.id));
  for (let i = 0; i < position.count; i++) {
    const c = base.clone().multiplyScalar(0.94 + rand() * 0.12);
    colors.push(c.r, c.g, c.b);
  }
  geom.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({
      map: getGroundTexture(),
      vertexColors: true,
      roughness: 1,
    }),
  );
  mesh.receiveShadow = true;
  return mesh;
}
function ribbon(points, width, color = 0xd9c997, y = 0.025) {
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(p[0], y, p[1])),
  );
  const positions = [],
    uvs = [],
    indices = [],
    samples = 58;
  for (let i = 0; i <= samples; i++) {
    const t = i / samples,
      p = curve.getPoint(t),
      tangent = curve.getTangent(t),
      side = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();
    const w = width * (1 + 0.09 * Math.sin(t * 16));
    positions.push(
      p.x + side.x * w,
      y,
      p.z + side.z * w,
      p.x - side.x * w,
      y,
      p.z - side.z * w,
    );
    uvs.push(0, t * 13, 1, t * 13);
    if (i < samples) {
      const n = i * 2;
      indices.push(n, n + 1, n + 2, n + 1, n + 3, n + 2);
    }
  }
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geom.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({
      color,
      map: getPathTexture(),
      roughness: 1,
      side: THREE.DoubleSide,
    }),
  );
  mesh.receiveShadow = true;
  return mesh;
}
function addRoads(group, region) {
  if (region.roads?.length) {
    for (const road of region.roads) group.add(ribbon(road.points,road.width,0xd8c49a));
    return;
  }
  const bias = ((hashString(region.id) % 5) - 2) * 0.65;
  const pathColor =
    region.id === "redstone"
      ? 0xd8bc90
      : region.id === "crown"
        ? 0xc8c7a9
        : 0xdacda0;
  group.add(
    ribbon(
      [
        [-27, 0],
        [-17, 1 + bias],
        [-7, -0.7],
        [0, 0],
        [9, 0.8 - bias],
        [18, -0.5],
        [27, 0],
      ],
      1.65,
      pathColor,
    ),
  );
  group.add(
    ribbon(
      [
        [0, -27],
        [0.5, -18],
        [bias, -9],
        [0, 0],
        [-0.8, 9],
        [0.4, 18],
        [0, 27],
      ],
      1.4,
      pathColor,
      0.026,
    ),
  );
}
function addWater(group, water) {
  const ripples = [];
  const geom = new THREE.CircleGeometry(1, 48);
  geom.rotateX(-Math.PI / 2);
  const mesh = new THREE.Mesh(
    geom,
    new THREE.MeshStandardMaterial({
      color: 0x76c7bf,
      roughness: 0.33,
      metalness: 0.08,
      transparent: true,
      opacity: 0.9,
    }),
  );
  mesh.position.set(water.x, 0.055, water.z);
  mesh.scale.set(water.rx, 1, water.rz);
  mesh.receiveShadow = true;
  group.add(mesh);
  const edge = new THREE.Mesh(
    new THREE.RingGeometry(0.94, 1.06, 48),
    new THREE.MeshBasicMaterial({
      color: 0xd4e8bd,
      transparent: true,
      opacity: 0.4,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  edge.rotation.x = -Math.PI / 2;
  edge.position.set(water.x, 0.06, water.z);
  edge.scale.set(water.rx, water.rz, 1);
  group.add(edge);
  for (let i = 0; i < 4; i++) {
    const ripple = new THREE.Mesh(
      new THREE.RingGeometry(0.2, 0.22, 24),
      new THREE.MeshBasicMaterial({
        color: 0xf4f6d8,
        transparent: true,
        opacity: 0.45,
        side: THREE.DoubleSide,
      }),
    );
    ripple.rotation.x = -Math.PI / 2;
    ripple.position.set(
      water.x + (i - 1.5) * water.rx * 0.35,
      0.07,
      water.z + (i % 2 ? 0.35 : -0.35) * water.rz,
    );
    ripple.scale.y = 0.5;
    group.add(ripple);
    ripples.push(ripple);
  }
  return ripples;
}
function addGroundCover(group, region) {
  const rand = randomFor(hashString(region.id) + 73),
    count = region.id === "haven" ? 1100 : 1350;
  const bladeGeometry = new THREE.BufferGeometry();
  bladeGeometry.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        -0.13, 0, 0, 0, 0.5, 0, 0.13, 0, 0, 0, 0, -0.13, 0, 0.42, 0, 0, 0, 0.13,
        -0.14, 0, -0.12, -0.08, 0.32, -0.08, -0.02, 0, 0,
      ],
      3,
    ),
  );
  bladeGeometry.computeVertexNormals();
  const grass = new THREE.InstancedMesh(
    bladeGeometry,
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 1,
      side: THREE.DoubleSide,
    }),
    count,
  );
  const flowerGeometry = new THREE.CircleGeometry(0.09, 5);
  flowerGeometry.rotateX(-Math.PI / 2);
  const flower = new THREE.InstancedMesh(
    flowerGeometry,
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 }),
    Math.floor(count * 0.46),
  );
  const dummy = new THREE.Object3D(),
    c = new THREE.Color();
  let n = 0,
    f = 0,
    attempts = 0;
  const clearings = [region.npc,region.extraNpc,region.shrine,region.lore,region.archive,region.project,region.beacon,region.cache,region.anchor,
    ...region.nodes.map(([,x,z])=>({x,z}))].filter(Boolean);
  const blocked = (x,z) => clearings.some(p=>Math.hypot(x-p.x,z-p.z)<1.6) ||
    (region.surges || []).some(p=>Math.hypot(x-p.x,z-p.z)<p.radius+.3) ||
    (region.water || []).some(w=>((x-w.x)/w.rx)**2+((z-w.z)/w.rz)**2<1.05);
  const colors =
    region.tree === "gold"
      ? [0xe7d68d, 0xf1e4ac, 0xf9f0c6]
      : [0xf6edcc, 0xe6d582, 0xf6b8a0];
  while (n < count && attempts++ < count * 5) {
    const x = (rand() - 0.5) * REGION_SIZE,
      z = (rand() - 0.5) * REGION_SIZE;
    if (
      Math.abs(x) < 2.6 ||
      Math.abs(z) < 2.5 ||
      blocked(x,z) ||
      (region.id === "haven" && Math.hypot(x, z - 4) < 7)
    )
      continue;
    const s = 0.6 + rand() * 0.9;
    dummy.position.set(x, 0.035, z);
    dummy.rotation.set(
      (rand() - 0.5) * 0.25,
      rand() * 6.28,
      (rand() - 0.5) * 0.25,
    );
    dummy.scale.set(s, s, s);
    dummy.updateMatrix();
    grass.setMatrixAt(n, dummy.matrix);
    c.setHex(rand() > 0.5 ? 0x769f63 : 0x5f925c);
    c.multiplyScalar(0.9 + rand() * 0.25);
    grass.setColorAt(n, c);
    n++;
    if (f < flower.count && rand() > 0.4) {
      dummy.position.set(x + 0.12, 0.32 * s, z + 0.1);
      dummy.scale.setScalar(0.7 + rand() * 0.6);
      dummy.updateMatrix();
      flower.setMatrixAt(f, dummy.matrix);
      flower.setColorAt(
        f,
        c.setHex(colors[Math.floor(rand() * colors.length)]),
      );
      f++;
    }
  }
  grass.count = n;
  flower.count = f;
  grass.instanceMatrix.needsUpdate = true;
  flower.instanceMatrix.needsUpdate = true;
  grass.computeBoundingSphere();
  flower.computeBoundingSphere();
  group.add(grass, flower);
  // Low shrubs are instanced, keeping lush scenery inexpensive even on mobile.
  const shrubs = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(1, 0),
    new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1 }),
    110,
  );
  let b = 0;
  for (let i = 0; i < 300 && b < 110; i++) {
    const x = (rand() - 0.5) * REGION_SIZE,
      z = (rand() - 0.5) * REGION_SIZE;
    if (
      Math.abs(x) < 4 ||
      Math.abs(z) < 4 ||
      blocked(x,z) ||
      (region.id === "haven" && Math.hypot(x, z - 4) < 8)
    )
      continue;
    const scale = 0.2 + rand() * 0.38;
    dummy.position.set(x, scale * 0.5, z);
    dummy.rotation.set(0, rand() * 6, 0);
    dummy.scale.set(scale * 1.4, scale * 0.7, scale);
    dummy.updateMatrix();
    shrubs.setMatrixAt(b, dummy.matrix);
    c.setHex(
      region.tree === "gold"
        ? 0x9cb165
        : region.tree === "teal"
          ? 0x6f9e83
          : 0x79a46a,
    );
    c.multiplyScalar(0.85 + rand() * 0.3);
    shrubs.setColorAt(b, c);
    b++;
  }
  shrubs.count = b;
  shrubs.instanceMatrix.needsUpdate = true;
  shrubs.computeBoundingSphere();
  group.add(shrubs);
}
function addGroundShadows(group, region) {
  const sources = [
    ...region.trees.map(([x, z, scale]) => [x, z, 1.5 * scale]),
    ...region.rocks.map(([x, z, scale]) => [x, z, 0.9 * scale]),
    ...(region.buildings || []).map(([kind, x, z, scale]) => [
      x,
      z,
      (kind === "tree" ? 2.1 : 2.6) * scale,
    ]),
  ];
  const geom = new THREE.CircleGeometry(1, 20);
  geom.rotateX(-Math.PI / 2);
  const shadows = new THREE.InstancedMesh(
      geom,
      new THREE.MeshBasicMaterial({
        color: 0x345f43,
        transparent: true,
        opacity: 0.14,
        depthWrite: false,
      }),
      sources.length,
    ),
    dummy = new THREE.Object3D();
  sources.forEach(([x, z, r], i) => {
    dummy.position.set(x + 0.3, 0.017, z + 0.25);
    dummy.scale.set(r, 1, r * 0.7);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    shadows.setMatrixAt(i, dummy.matrix);
  });
  shadows.instanceMatrix.needsUpdate = true;
  shadows.computeBoundingSphere();
  group.add(shadows);
}
/** Small decorative columns are skipped when they would intersect authored landmarks. */
export function ruinPlacements(region) {
  if (!region.ruins) return [];
  const authored=[
    ...region.trees.map(([x,z,scale])=>({x,z,r:.53*scale})),
    ...region.rocks.map(([x,z,scale])=>({x,z,r:.7*scale})),
    ...(region.buildings || []).map(([type,x,z,scale])=>({x,z,r:type === "cottage" ? 1.8 : type === "forge" ? 2.1 : .85*scale})),
    ...(region.landmarks || []).filter(([type])=>["observatory","crystals","anvil","windvane","stonecircle"].includes(type)).map(([type,x,z,scale])=>
      ({x,z,r:(type === "observatory" ? 1.6 : type === "stonecircle" ? 2 : type === "crystals" ? 1 : .5)*scale})),
    ...[region.npc,region.extraNpc,region.shrine,region.lore,region.archive,region.project,region.beacon,region.cache,region.anchor,
      ...region.nodes.map(([,x,z])=>({x,z}))].filter(Boolean).map(item=>({x:item.x,z:item.z,r:.5})),
  ];
  return [[-12,-13,2.9],[12,-13,2.2],[-13,15,1.7],[13,15,2.6]]
    .filter(([x,z])=>authored.every(item=>Math.hypot(x-item.x,z-item.z)>item.r+.6));
}
function addRuins(group, region) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0xc4c7ad,
    roughness: 0.95,
  });
  for (const [x, z, h] of ruinPlacements(region)) {
    const column = new THREE.Mesh(
      new THREE.CylinderGeometry(0.38, 0.48, h, 9),
      mat,
    );
    column.position.set(x, h / 2, z);
    column.castShadow = true;
    column.receiveShadow = true;
    group.add(column);
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.56, 0.44, 0.2, 9),
      mat,
    );
    cap.position.set(x, h + 0.1, z);
    group.add(cap);
  }
}

export class World {
  constructor(scene, state) {
    this.scene = scene;
    this.state = state;
    this.regions = new Map();
    this.current = null;
    this.visible = new Set();
    this.visibleRecords = [];
    this.visibleEnemies = [];
    this.visibleNpcs = [];
    this.time = 0;
    this.frustum = new THREE.Frustum();
    this.frustumMatrix = new THREE.Matrix4();
  }
  build(region) {
    const center = regionCenter(region),
      group = new THREE.Group();
    group.position.set(center.x, 0, center.z);
    const bounds = new THREE.Box3(
      new THREE.Vector3(
        center.x - REGION_SIZE / 2 - 2,
        -1,
        center.z - REGION_SIZE / 2 - 2,
      ),
      new THREE.Vector3(
        center.x + REGION_SIZE / 2 + 2,
        9,
        center.z + REGION_SIZE / 2 + 2,
      ),
    );
    const record = {
      data: region,
      group,
      bounds,
      colliders: [],
      interactables: [],
      enemies: [],
      npcs: [],
      trees: [],
      landmarks: [],
      waterRipples: [],
      surges: [],
      shrine: null,
    };
    group.add(ground(region));
    addGroundShadows(group, region);
    addRoads(group, region);
    for (const pond of region.water || [])
      record.waterRipples.push(...addWater(group, pond));
    addGroundCover(group, region);
    for (const [x, z, scale] of region.trees) {
      const tree = makeTree(region.tree, scale);
      tree.position.set(x, 0, z);
      group.add(tree);
      record.trees.push(tree);
      record.colliders.push({
        x: center.x + x,
        z: center.z + z,
        r: 0.53 * scale,
      });
    }
    for (const [x, z, scale] of region.rocks) {
      const rock = makeRock(
        scale,
        region.id === "redstone" ? 0xb49b82 : 0x9fac98,
      );
      rock.position.set(x, 0, z);
      group.add(rock);
      record.colliders.push({
        x: center.x + x,
        z: center.z + z,
        r: 0.7 * scale,
      });
    }
    for (const [kind, x, z, scale] of region.buildings || []) {
      const model =
        kind === "cottage"
          ? makeCottage(scale)
          : kind === "forge"
            ? makeDetailedBuilding("forge") || makeStall()
            : kind === "stall"
              ? makeStall()
              : makeTree("light", scale);
      model.position.set(x, 0, z);
      group.add(model);
      if (kind === "tree") record.trees.push(model);
      record.colliders.push({
        x: center.x + x,
        z: center.z + z,
        r:
          kind === "cottage"
            ? 1.8
            : kind === "forge"
              ? 2.1
              : kind === "stall"
                ? 1.25
                : 0.85 * scale,
      });
    }
    for (const [kind, x, z, scale] of region.landmarks || []) {
      const landmark = makeLandmark(kind, scale);
      landmark.position.set(x, 0, z);
      group.add(landmark);
      record.landmarks.push(landmark);
      if (["crystals", "anvil", "windvane", "observatory"].includes(kind))
        record.colliders.push({
          x: center.x + x,
          z: center.z + z,
          r: (kind === "observatory" ? 1.6 : kind === "crystals" ? 1 : 0.5) * scale,
        });
      if (kind === "stonecircle")
        for (let i=0;i<7;i++) {
          const angle=i*Math.PI*2/7;
          record.colliders.push({x:center.x+x+Math.sin(angle)*1.7*scale,z:center.z+z+Math.cos(angle)*1.7*scale,r:.22*scale});
        }
      if (kind === "arch")
        for (const side of [-1, 1])
          record.colliders.push({
            x: center.x + x + side * 1.2 * scale,
            z: center.z + z,
            r: 0.32 * scale,
          });
    }
    if (region.ruins) {
      addRuins(group, region);
      for (const [x,z] of ruinPlacements(region)) record.colliders.push({x:center.x+x,z:center.z+z,r:.48});
    }
    if (region.id === "haven") {
      for (const [x, z] of [
        [-6, 2],
        [6, 2],
        [-7, -9],
        [7, -9],
      ]) {
        const lamp = makeLamp();
        lamp.position.set(x, 0, z);
        group.add(lamp);
        record.colliders.push({x:center.x+x,z:center.z+z,r:.15});
      }
    }
    const addNpc = (data) => {
      if (!data) return;
      const model = makeHumanoid({ color: data.color, npcId: data.id });
      model.position.set(data.x, 0, data.z);
      model.rotation.y = Math.PI * 0.2;
      group.add(model);
      const npc = {
        kind: "npc",
        id: data.id,
        data,
        model,
        x: center.x + data.x,
        z: center.z + data.z,
        homeX: center.x + data.x,
        homeZ: center.z + data.z,
        region: region.id,
        phase: (hashString(data.id) % 100) / 10,
      };
      record.npcs.push(npc);
      record.interactables.push(npc);
    };
    addNpc(region.npc);
    addNpc(region.extraNpc);
    const shrinePos = worldPosition(region, region.shrine.x, region.shrine.z);
    const shrineModel = makeShrine(
      this.state.world.activated.includes(region.id),
    );
    shrineModel.position.set(region.shrine.x, 0, region.shrine.z);
    group.add(shrineModel);
    record.shrine = {
      kind: "shrine",
      id: `shrine:${region.id}`,
      region: region.id,
      model: shrineModel,
      ...shrinePos,
    };
    record.interactables.push(record.shrine);
    record.colliders.push({ x: shrinePos.x, z: shrinePos.z, r: 0.8 });
    const lorePos = worldPosition(region, region.lore.x, region.lore.z);
    const loreModel = makeLoreStone();
    loreModel.position.set(region.lore.x, 0, region.lore.z);
    group.add(loreModel);
    record.interactables.push({
      kind: "lore",
      id: `lore:${region.id}`,
      region: region.id,
      model: loreModel,
      ...lorePos,
    });
    record.colliders.push({x:lorePos.x,z:lorePos.z,r:.55});
    if (region.archive) {
      const pos=worldPosition(region,region.archive.x,region.archive.z);
      const model=makeArchive(!!this.state.world.archives[region.id]?.solved);
      model.position.set(region.archive.x,0,region.archive.z);group.add(model);
      record.archive={kind:"archive",id:`archive:${region.id}`,region:region.id,model,...pos};
      record.interactables.push(record.archive);
      record.colliders.push({x:pos.x,z:pos.z,r:1.05});
    }
    if (region.project) {
      const pos=worldPosition(region,region.project.x,region.project.z);
      const model=makeProject(this.state.world.projects[region.id] || null);
      model.position.set(region.project.x,0,region.project.z);group.add(model);
      record.project={kind:"project",id:`project:${region.id}`,region:region.id,model,...pos};
      record.interactables.push(record.project);
      record.colliders.push({x:pos.x,z:pos.z,r:.55});
    }
    if (region.anchor) {
      const pos=worldPosition(region,region.anchor.x,region.anchor.z);
      const model=makeTideAnchor(this.state.world.tideAnchors.includes(region.id));
      model.position.set(region.anchor.x,0,region.anchor.z);group.add(model);
      record.anchor={kind:'anchor',id:`anchor:${region.id}`,region:region.id,model,...pos};
      record.interactables.push(record.anchor);
      record.colliders.push({x:pos.x,z:pos.z,r:.7});
    }
    for (const [index,surge] of (region.surges || []).entries()) {
      const pos=worldPosition(region,surge.x,surge.z);
      const warning=new THREE.Group();
      const fill=new THREE.Mesh(tideFillGeometry,new THREE.MeshBasicMaterial({
        color:0xd65c46,transparent:true,opacity:.26,side:THREE.DoubleSide,depthWrite:false,
      }));
      const rim=new THREE.Mesh(tideRimGeometry,new THREE.MeshBasicMaterial({
        color:0xaa352a,transparent:true,opacity:.9,side:THREE.DoubleSide,depthWrite:false,
      }));
      fill.position.y=.09;rim.position.y=.10;warning.add(fill,rim);
      warning.position.set(surge.x,0,surge.z);warning.scale.set(surge.radius,1,surge.radius);
      warning.visible=false;group.add(warning);
      record.surges.push({id:`surge:${region.id}:${index}`,...pos,radius:surge.radius,
        offset:surge.offset || 0,warning,fill,rim,cycle:createTideCycle(surge.offset)});
    }
    if (region.beacon) {
      const pos = worldPosition(region, region.beacon.x, region.beacon.z);
      const model = makeSignalBeacon(this.state.world.beacons.includes(region.id));
      model.position.set(region.beacon.x, 0, region.beacon.z);group.add(model);
      record.beacon = {kind:"beacon", id:`beacon:${region.id}`, region:region.id, model, ...pos};
      record.interactables.push(record.beacon);
      record.colliders.push({x:pos.x,z:pos.z,r:.7});
    }
    if (region.cache) {
      const pos = worldPosition(region, region.cache.x, region.cache.z);
      const model = makeSupplyCache(this.state.world.openedCaches.includes(region.id));
      model.position.set(region.cache.x, 0, region.cache.z);group.add(model);
      record.interactables.push({kind:"cache",id:`cache:${region.id}`,region:region.id,model,...pos});
      record.colliders.push({x:pos.x,z:pos.z,r:.5});
    }
    region.nodes.forEach(([type, x, z], index) => {
      const pos = worldPosition(region, x, z),
        id = `node:${region.id}:${index}`,
        model = makeNode(type);
      model.position.set(x, 0, z);
      group.add(model);
      model.visible =
        !this.state.world.respawns[id] ||
        this.state.world.respawns[id] <= Date.now();
      record.interactables.push({
        kind: "node",
        type,
        id,
        region: region.id,
        model,
        ...pos,
      });
      if (type === "ore") record.colliders.push({x:pos.x,z:pos.z,r:.5,model});
    });
    region.enemies.forEach(([type, x, z], index) => {
      const pos = worldPosition(region, x, z),
        id = `enemy:${region.id}:${index}`,
        model = makeCreature(type, region.danger);
      model.position.set(x, 0, z);
      group.add(model);
      const level = Math.max(1, region.danger), maxHp = creatureMaxHealth(type,level);
      const hp = Math.min(maxHp, this.state.world.wounded[id] || maxHp);
      const enemy = {
        id,
        type,
        region: region.id,
        model,
        x: pos.x,
        z: pos.z,
        homeX: pos.x,
        homeZ: pos.z,
        level,
        hp,
        maxHp,
        state: "idle",
        stateTime: 0,
        cooldown: 0.3 + index * 0.2,
        hitFlash: 0,
        phase: index * 1.7 + (hashString(region.id) % 7),
        aggravated: hp < maxHp,
        pattern: 0,
        aftershock: 0,
        alive: !(this.state.world.respawns[id] > Date.now()) &&
          !(isBossType(type) && this.state.world.flags[type]),
      };
      if (type === "surger") {
        // A capsule matches the swept player-center collision, including its ends.
        const warning=new THREE.Group();
        const lane=new THREE.Mesh(aimGeometry,chargeMaterial);
        lane.scale.set(CHARGE_HIT_RADIUS*2,1,CHARGE_DISTANCE);
        lane.position.set(0,.10,CHARGE_DISTANCE/2);warning.add(lane);
        for (const z of [0,CHARGE_DISTANCE]) {
          const cap=new THREE.Mesh(chargeCapGeometry,chargeMaterial);
          cap.scale.set(CHARGE_HIT_RADIUS,1,CHARGE_HIT_RADIUS);
          cap.position.set(0,.101,z);warning.add(cap);
        }
        warning.visible=false;group.add(warning);enemy.warnings=[warning];
      }
      if (type === "caster" || type === "tempest") {
        enemy.warnings=[];
        for(let i=0;i<(type === "tempest" ? 3 : 1);i++) {
          const warning=new THREE.Mesh(aimGeometry,aimMaterial);
          warning.visible=false;group.add(warning);enemy.warnings.push(warning);
        }
      }
      model.visible = enemy.alive;
      record.enemies.push(enemy);
    });
    this.regions.set(region.id, record);
    return record;
  }
  updateStreaming(x, z) {
    const region = regionAt(x, z);
    if (!region || this.current?.id === region.id) return null;
    const wanted = new Set(
      REGIONS.filter(
        (r) =>
          Math.abs(r.gx - region.gx) <= 1 && Math.abs(r.gz - region.gz) <= 1,
      ).map((r) => r.id),
    );
    for (const id of this.visible)
      if (!wanted.has(id)) {
        const r = this.regions.get(id);
        for (const enemy of r.enemies) cancelUnseenAttack(enemy);
        this.scene.remove(r.group);
        this.visible.delete(id);
      }
    for (const id of wanted)
      if (!this.visible.has(id)) {
        const data = REGIONS.find((r) => r.id === id),
          record = this.regions.get(id) || this.build(data);
        this.scene.add(record.group);
        this.visible.add(id);
      }
    this.current = region;
    this.visibleRecords=[...this.visible].map(id=>this.regions.get(id));
    this.visibleEnemies=this.visibleRecords.flatMap(record=>record.enemies);
    this.visibleNpcs=this.visibleRecords.flatMap(record=>record.npcs);
    return region;
  }
  cull(camera) {
    camera.updateMatrixWorld();
    this.frustumMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this.frustum.setFromProjectionMatrix(this.frustumMatrix);
    for (const record of this.records())
      record.group.visible = this.frustum.intersectsBox(record.bounds);
  }
  records() {
    return this.visibleRecords;
  }
  colliders() {
    return this.records().flatMap((r) => r.colliders.filter(c=>!c.model || c.model.visible));
  }
  enemies() {
    return this.visibleEnemies;
  }
  npcs() {
    return this.visibleNpcs;
  }
  nearby(x, z, range = 2.35) {
    let best = null,
      bestDistance = range;
    for (const record of this.records())
      for (const thing of record.interactables) {
        if (!thing.model.visible || (thing.kind === "cache" && this.state.world.openedCaches.includes(thing.region))) continue;
        const d = Math.hypot(thing.x - x, thing.z - z);
        if (d < bestDistance) {
          best = thing;
          bestDistance = d;
        }
      }
    return best;
  }
  inWater(x, z) {
    const region = regionAt(x, z);
    if (!region) return false;
    const center = regionCenter(region);
    const localX = x - center.x,
      localZ = z - center.z;
    const onBridge = (region.landmarks || []).some(
      ([kind, bx, bz, scale]) =>
        kind === "bridge" &&
        Math.abs(localX - bx) < 7.2 * scale &&
        Math.abs(localZ - bz) < 1.05 * scale,
    );
    return (
      !onBridge &&
      (region.water || []).some(
        (p) =>
          ((localX - p.x) / p.rx) ** 2 + ((localZ - p.z) / p.rz) ** 2 < 0.9,
      )
    );
  }
  updateAmbient(dt, time) {
    this.time = time;
    for (const record of this.records()) {
      for (const landmark of record.landmarks)
        if (landmark.userData.animation === "windmill")
          landmark.userData.animatedPart.rotation.z += dt * 0.55;
      record.waterRipples.forEach((ripple, i) => {
        const phase = (time * 0.35 + i * 0.27) % 1,
          scale = 0.6 + phase * 0.9;
        ripple.scale.set(scale, scale * 0.5, 1);
        ripple.material.opacity = (1 - phase) * 0.35;
      });
      for (const tree of record.trees)
        if (tree.userData.canopy)
          tree.userData.canopy.rotation.z =
            Math.sin(time * 0.7 + tree.userData.phase) * 0.025;
      if (record.beacon?.model.userData.active) record.beacon.model.userData.ring.rotation.z += dt * .45;
      if (record.anchor?.model.userData.active) record.anchor.model.userData.ring.rotation.z += dt * .65;
      if (record.archive) {
        const lens=record.archive.model.userData.lens;
        lens.rotation.y+=dt*.45;
        lens.position.y=1.52+Math.sin(time*1.8)*.08;
      }
      if (record.project?.model.userData.choice === "watch")
        record.project.model.userData.lantern.rotation.y+=dt*.8;
      const shrine = record.shrine.model;
      shrine.userData.crystal.rotation.y += dt * 0.45;
      shrine.userData.crystal.position.y = 1.75 + Math.sin(time * 2) * 0.06;
      shrine.userData.halo.rotation.z += dt * 0.3;
      for (const thing of record.interactables) {
        if (
          thing.kind === "node" &&
          !thing.model.visible &&
          !(this.state.world.respawns[thing.id] > Date.now())
        ) {
          thing.model.visible = true;
          delete this.state.world.respawns[thing.id];
        }
      }
    }
  }
}
