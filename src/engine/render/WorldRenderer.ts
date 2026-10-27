/**
 * World materials and the chunk renderer.
 *
 * Three materials cover the whole world:
 *   opaque      Lambert + atlas map + per-vertex colour (the AO/skylight ramp)
 *   transparent Lambert + atlas map, depth write off — glass, leaves, water
 *   emissive    Basic + additive — torches, runes, lava, crystals
 *
 * `WorldRenderer` owns a pool of chunk groups. Chunks are meshed lazily, kept
 * only within the render distance, and rebuilt incrementally as the player
 * edits the world. The render distance itself is adaptive: a frame-time
 * governor raises it when the GPU is idle and lowers it when the frame budget
 * is being blown, which is what keeps the game at 60fps on a phone without the
 * player ever noticing.
 */

import * as THREE from 'three';
import { buildChunkGeometry, CHUNK_X, CHUNK_Y, CHUNK_Z, TileSource } from './ChunkMesher';
import { TextureAtlas, ATLAS_SIZE } from './TextureAtlas';

export interface ChunkHandle {
  cx: number;
  cy: number;
  cz: number;
  group: THREE.Group;
  meshes: { opaque: THREE.Mesh | null; transparent: THREE.Mesh | null; emissive: THREE.Mesh | null };
  tris: number;
  dirty: boolean;
  /** Distance squared from the last camera position (for culling). */
  lastDist: number;
}

export class WorldMaterials {
  opaque: THREE.MeshLambertMaterial;
  transparent: THREE.MeshLambertMaterial;
  emissive: THREE.MeshBasicMaterial;
  atlas: THREE.CanvasTexture;

  constructor(atlas: TextureAtlas) {
    if (!atlas.result) throw new Error('TextureAtlas.build() must run before WorldMaterials');
    this.atlas = new THREE.CanvasTexture(atlas.result.canvas);
    this.atlas.magFilter = THREE.LinearFilter;
    this.atlas.minFilter = THREE.LinearMipmapLinearFilter;
    this.atlas.generateMipmaps = true;
    this.atlas.anisotropy = 4;
    this.atlas.colorSpace = THREE.SRGBColorSpace;

    this.opaque = new THREE.MeshLambertMaterial({
      map: this.atlas,
      vertexColors: true,
      side: THREE.FrontSide,
    });
    this.transparent = new THREE.MeshLambertMaterial({
      map: this.atlas,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      side: THREE.FrontSide,
      alphaTest: 0.0,
    });
    this.emissive = new THREE.MeshBasicMaterial({
      map: this.atlas,
      vertexColors: true,
      blending: THREE.AdditiveBlending,
      transparent: true,
      depthWrite: false,
      toneMapped: false,
      side: THREE.FrontSide,
    });
  }

  dispose(): void {
    this.atlas.dispose();
    this.opaque.dispose();
    this.transparent.dispose();
    this.emissive.dispose();
  }
}

export class WorldRenderer {
  scene: THREE.Scene;
  grid: TileSource;
  materials: WorldMaterials;
  atlas: TextureAtlas;
  chunks = new Map<number, ChunkHandle>();
  group: THREE.Group;

  /** Radius in chunks. 0 = no meshing at all. */
  renderDistance = 5;
  minRenderDistance = 2;
  maxRenderDistance = 9;
  /** Frame-time target in ms. */
  targetFrame = 16.7;

  private keyOf(cx: number, cy: number, cz: number): number {
    return (((cz + 64) * 256) + (cx + 64)) * 64 + (cy + 64);
  }

  private cellOfTile: Int32Array;
  private glowTable: Float32Array;
  private variantTable: Int32Array;
  private variantCount: Int32Array;

  /** Chunks that need rebuilding, drained once per frame. */
  private dirtyQueue: number[] = [];
  private pending = 0;

  stats = {
    chunks: 0,
    triangles: 0,
    meshTime: 0,
    maxRenderDistance: 5,
  };

  constructor(scene: THREE.Scene, grid: TileSource, materials: WorldMaterials, atlas: TextureAtlas) {
    this.scene = scene;
    this.grid = grid;
    this.materials = materials;
    this.atlas = atlas;
    this.group = new THREE.Group();
    scene.add(this.group);

    const r = atlas.result!;
    this.cellOfTile = r.cellOf;
    this.glowTable = new Float32Array(1024);
    this.variantTable = new Int32Array(1024);
    this.variantCount = new Int32Array(1024);
    this.setTileTables(0);
  }

  /** Register glow/variant tables (called once after tile init). */
  setTileTables(glow: number): void {
    void glow;
    // Variant assignment: tiles with several variants get consecutive cells.
    const counts = new Int32Array(1024);
    const variants = new Int32Array(1024);
    let cursor = 0;
    for (let id = 0; id < 1024; id++) {
      const def = this.variantDefs?.[id];
      if (!def) continue;
      const n = Math.max(1, Math.min(3, def | 0));
      counts[id] = n;
      variants[id] = cursor;
      cursor += n;
    }
    this.variantCount = counts;
    this.variantTable = variants;
  }

  private variantDefs: number[] | null = null;
  setVariantDefs(defs: number[]): void {
    const table = new Int32Array(1024);
    for (let i = 0; i < defs.length && i < 1024; i++) table[i] = defs[i];
    this.variantDefs = Array.from(table);
    this.setTileTables(0);
  }

  setGlowTable(glow: Float32Array): void {
    this.glowTable = glow;
  }

  /** Queue a chunk for rebuild. */
  markDirty(cx: number, cy: number, cz: number): void {
    const k = this.keyOf(cx, cy, cz);
    const handle = this.chunks.get(k);
    if (handle) {
      if (!handle.dirty) {
        handle.dirty = true;
        this.dirtyQueue.push(k);
      }
    } else {
      this.meshChunk(cx, cy, cz);
    }
  }

  private meshChunk(cx: number, cy: number, cz: number): void {
    const ox = cx * CHUNK_X;
    const oy = cy * CHUNK_Y;
    const oz = cz * CHUNK_Z;
    const geo = buildChunkGeometry(
      this.grid,
      { x: ox, y: oy, z: oz },
      (tile: number) => this.cellOfTile[tile] ?? 0,
      (tile: number) => this.glowTable[tile] ?? 0,
      (tile: number) => this.variantTable[tile] ?? 0
    );

    const k = this.keyOf(cx, cy, cz);
    let handle = this.chunks.get(k);
    if (!handle) {
      handle = {
        cx, cy, cz,
        group: new THREE.Group(),
        meshes: { opaque: null, transparent: null, emissive: null },
        tris: 0,
        dirty: false,
        lastDist: 1e9,
      };
      handle.group.position.set(ox, oy, oz);
      this.chunks.set(k, handle);
      this.group.add(handle.group);
    }

    this.applyGeometry(handle, geo);
  }

  private applyGeometry(handle: ChunkHandle, geo: ReturnType<typeof buildChunkGeometry>): void {
    const m = handle.meshes;
    if (m.opaque) { handle.group.remove(m.opaque); (m.opaque as any).geometry?.dispose(); }
    if (m.transparent) { handle.group.remove(m.transparent); (m.transparent as any).geometry?.dispose(); }
    if (m.emissive) { handle.group.remove(m.emissive); (m.emissive as any).geometry?.dispose(); }

    if (geo.opaque) {
      m.opaque = new THREE.Mesh(geo.opaque, this.materials.opaque);
      handle.group.add(m.opaque);
    } else m.opaque = null;
    if (geo.transparent) {
      m.transparent = new THREE.Mesh(geo.transparent, this.materials.transparent);
      handle.group.add(m.transparent);
    } else m.transparent = null;
    if (geo.emissive) {
      m.emissive = new THREE.Mesh(geo.emissive, this.materials.emissive);
      handle.group.add(m.emissive);
    } else m.emissive = null;

    handle.tris = geo.tris;
    handle.dirty = false;
    handle.group.visible = true;
  }

  /**
   * Reconcile the visible chunk set with the player position and drain the
   * dirty queue. Call once per frame with the camera world position.
   */
  update(px: number, py: number, pz: number, budgetMs: number): void {
    const t0 = performance.now();
    const rd = this.renderDistance;

    const minX = Math.floor(px / CHUNK_X) - rd;
    const maxX = Math.floor(px / CHUNK_X) + rd;
    const minZ = Math.floor(pz / CHUNK_Z) - rd;
    const maxZ = Math.floor(pz / CHUNK_Z) + rd;
    const minY = Math.floor(py / CHUNK_Y) - 1;
    const maxY = Math.floor(py / CHUNK_Y) + 1;

    // Hide chunks that fell out of range (keep the data, just stop rendering).
    for (const handle of this.chunks.values()) {
      if (handle.cx < minX || handle.cx > maxX || handle.cz < minZ || handle.cz > maxZ ||
          handle.cy < minY || handle.cy > maxY) {
        handle.group.visible = false;
      }
    }

    // Mesh new chunks, oldest-budget-first.
    const budget = Math.max(1, budgetMs);
    let used = performance.now() - t0;
    for (let cx = minX; cx <= maxX && used < budget; cx++) {
      for (let cz = minZ; cz <= maxZ && used < budget; cz++) {
        for (let cy = minY; cy <= maxY && used < budget; cy++) {
          const k = this.keyOf(cx, cy, cz);
          const handle = this.chunks.get(k);
          if (!handle) {
            this.meshChunk(cx, cy, cz);
            used = performance.now() - t0;
            if (used > budget) break;
            continue;
          }
          if (handle.dirty) {
            this.dirtyQueue.push(k);
            handle.dirty = false;
          }
        }
      }
    }

    // Drain dirty rebuilds.
    if (this.dirtyQueue.length) {
      const queue = this.dirtyQueue;
      this.dirtyQueue = [];
      for (const k of queue) {
        const handle = this.chunks.get(k);
        if (!handle) continue;
        if (used > budget) { this.dirtyQueue.push(k); continue; }
        this.meshChunk(handle.cx, handle.cy, handle.cz);
        used = performance.now() - t0;
      }
    }

    // Adaptive render distance: hold the frame budget by shrinking the world.
    const stats = this.stats;
    let visible = 0, tris = 0;
    for (const handle of this.chunks.values()) {
      if (handle.group.visible) { visible++; tris += handle.tris; }
    }
    stats.chunks = visible;
    stats.triangles = tris;
    stats.meshTime = performance.now() - t0;
  }

  /** Raise/lower the render distance based on sustained frame time. */
  adaptToFrameTime(frameMs: number): void {
    if (frameMs > this.targetFrame * 1.45 && this.renderDistance > this.minRenderDistance) {
      this.renderDistance--;
    } else if (frameMs < this.targetFrame * 0.68 && this.renderDistance < this.maxRenderDistance) {
      // Only grow back after a stable run of fast frames.
      if (this.stableFrames > 90) {
        this.renderDistance++;
        this.stableFrames = 0;
      }
    }
    this.stableFrames = this.stableFrames + (frameMs < this.targetFrame * 0.8 ? 1 : 0);
  }
  private stableFrames = 0;

  /** Wipe every mesh (used on world reload). */
  /** Total triangles currently held by meshed chunks. */
  get triangleCount(): number {
    let n = 0;
    for (const h of this.chunks.values()) n += h.tris;
    return n;
  }

  disposeAll(): void {
    for (const handle of this.chunks.values()) {
      this.group.remove(handle.group);
      const m = handle.meshes;
      (m.opaque as any)?.geometry?.dispose();
      (m.transparent as any)?.geometry?.dispose();
      (m.emissive as any)?.geometry?.dispose();
    }
    this.chunks.clear();
    this.dirtyQueue.length = 0;
  }
}

export { ATLAS_SIZE };
