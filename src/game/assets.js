import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone as cloneSkeleton } from "three/addons/utils/SkeletonUtils.js";

// Small CC0 authored models, kept locally so an installed game works offline.
const library = {};
let loading;
let miraTexture;
const shadowGeometry = new THREE.CircleGeometry(0.68, 24);
shadowGeometry.rotateX(-Math.PI / 2);
const shadowMaterial = new THREE.MeshBasicMaterial({
  color: 0x204b32,
  transparent: true,
  opacity: 0.19,
  depthWrite: false,
});
export function loadArtAssets() {
  if (loading) return loading;
  const loader = new GLTFLoader();
  const files = {
    wayfinder: "wayfinder.glb",
    mage: "mage-npc.glb",
    knight: "knight-npc.glb",
    cottage: "cottage.glb",
    forge: "forge.glb",
  };
  loading = Promise.all(
    Object.entries(files).map(async ([name, file]) => {
      try {
        const url = globalThis.__ETERNITY_EMBEDDED_ASSETS__?.[file] || `/assets/${file}`;
        library[name] = await loader.loadAsync(url);
      } catch (error) {
        console.warn(
          `Could not load optional ${name} model; using the built-in model.`,
          error,
        );
      }
    }),
  );
  return loading;
}
const hiddenEquipment = {
  wayfinder: [
    "1H_Crossbow",
    "2H_Crossbow",
    "Knife",
    "Knife_Offhand",
    "Throwable",
  ],
  mage: ["2H_Staff", "1H_Wand", "Spellbook_open"],
  knight: [
    "1H_Sword_Offhand",
    "Badge_Shield",
    "Rectangle_Shield",
    "Round_Shield",
    "Spike_Shield",
    "1H_Sword",
    "2H_Sword",
    "Knight_Helmet",
  ],
};
export function makeDetailedPerson({ player = false, npcId = "" } = {}) {
  const key = player
    ? "wayfinder"
    : ["mira", "cael", "ves", "iona", "tavi", "rena", "lyra", "isla", "sera", "eda", "ilya", "nia", "iri", "omi", "esme", "leen"].includes(npcId)
      ? "mage"
      : ["bram", "orin", "orla", "kesh", "daro", "teren", "nilo", "tala", "pax"].includes(npcId)
        ? "knight"
        : "wayfinder";
  const asset = library[key];
  if (!asset) return null;
  const root = new THREE.Group(),
    model = cloneSkeleton(asset.scene);
  const shadow = new THREE.Mesh(shadowGeometry, shadowMaterial);
  shadow.position.set(0.15, 0.03, 0.13);
  shadow.scale.set(1, 1, 0.66);
  root.add(shadow, model);
  model.scale.setScalar(key === "mage" ? 0.86 : 1.02);
  for (const name of hiddenEquipment[key]) {
    const item = model.getObjectByName(name);
    if (item) item.visible = false;
  }
  if (npcId === "sera") {
    const hat = model.getObjectByName("Mage_Hat");
    if (hat) hat.visible = false;
  }
  if (npcId === "mira" || npcId === "tavi" || npcId === "nia") {
    const hat = model.getObjectByName("Mage_Hat");
    if (hat) hat.visible = false;
    model.traverse((object) => {
      if (!object.isMesh || !object.material?.map) return;
      const source = object.material.map;
      if (!miraTexture) {
        const image = source.image,
          canvas = document.createElement("canvas");
        canvas.width = image.width;
        canvas.height = image.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        const sx = canvas.width / 8,
          sy = canvas.height / 4;
        // Replace the purple cloth swatches with teal swatches from the same palette.
        ctx.drawImage(image, sx * 2, sy * 2, sx, sy, 0, sy, sx, sy);
        ctx.drawImage(image, sx * 2, sy * 2, sx, sy, sx * 7, sy, sx, sy);
        ctx.drawImage(image, sx * 2, sy * 2, sx, sy, sx, sy, sx, sy);
        ctx.drawImage(image, sx * 2, sy * 2, sx, sy, sx, sy * 2, sx, sy);
        miraTexture = new THREE.CanvasTexture(canvas);
        miraTexture.flipY = source.flipY;
        miraTexture.colorSpace = source.colorSpace;
      }
      object.material = object.material.clone();
      object.material.map = miraTexture;
    });
  }
  // A shared palette and different silhouettes keep neighbours recognisable
  // without shipping a separate texture for every resident.
  const tint = {
    rowan: 0xffe4cc,
    fen: 0xd5e4c8,
    neri: 0xc8e7e3,
    sol: 0xf1e0bd,
    yara: 0xb9ded3,
    mila: 0xffdfc0,
    pip: 0xf3dcad,
    aven: 0xdce5ba,
    kea: 0xc5e0d0,
    mara: 0xf1c99d,
    oren: 0xd3c8b6,
    ben: 0xf1d7a6,
    ren: 0xc8d8e0,
    bao: 0xefd0a3,
    mari: 0xf1d4aa,
  }[npcId];
  if (tint && key === "wayfinder") {
    const variants = new Map();
    model.traverse((object) => {
      if (!object.isMesh || !object.material) return;
      if (!variants.has(object.material)) {
        const variant = object.material.clone();
        variant.color.multiply(new THREE.Color(tint));
        variants.set(object.material, variant);
      }
      object.material = variants.get(object.material);
    });
  }
  if (player && library.knight) {
    const blade = library.knight.scene.getObjectByName("1H_Sword")?.clone(true),
      hand = model.getObjectByName("handslot.r");
    if (blade && hand) {
      blade.visible = true;
      hand.add(blade);
    }
  }
  model.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  const mixer = new THREE.AnimationMixer(model),
    actions = {};
  for (const clip of asset.animations)
    actions[clip.name] = mixer.clipAction(clip);
  root.userData = {
    animated: true,
    mixer,
    actions,
    current: "",
    lastTime: null,
    player,
  };
  return root;
}
export function animateDetailedPerson(root, time, moving, attack, dodge) {
  const data = root.userData;
  let mode;
  if (data.player && attack > 0) mode = "1H_Melee_Attack_Slice_Horizontal";
  else if (data.player && dodge > 0) mode = "Dodge_Forward";
  else if (moving) mode = data.player ? "Running_A" : "Walking_A";
  else mode = "Idle";
  if (!data.actions[mode]) mode = "Idle";
  if (data.current !== mode) {
    const previous = data.actions[data.current],
      next = data.actions[mode];
    if (previous) previous.fadeOut(0.12);
    if (next) {
      next.reset().setEffectiveWeight(1).fadeIn(0.12);
      if (mode.includes("Attack") || mode.includes("Dodge")) {
        next.setLoop(THREE.LoopOnce, 1);
        next.clampWhenFinished = true;
        next.timeScale =
          next.getClip().duration / (mode.includes("Attack") ? 0.32 : 0.27);
      } else {
        next.setLoop(THREE.LoopRepeat, Infinity);
        next.timeScale = data.player ? 1 : 0.7;
      }
      next.play();
    }
    data.current = mode;
  }
  const dt =
    data.lastTime === null
      ? 1 / 60
      : Math.max(0, Math.min(0.1, time - data.lastTime));
  data.lastTime = time;
  data.mixer.update(dt);
}
export function makeDetailedBuilding(kind) {
  const asset = library[kind === "forge" ? "forge" : "cottage"];
  if (!asset) return null;
  const root = asset.scene.clone(true);
  root.scale.setScalar(kind === "forge" ? 3.6 : 4.5);
  root.traverse((object) => {
    if (object.isMesh) {
      object.castShadow = true;
      object.receiveShadow = true;
    }
  });
  return root;
}
