/**
 * Third-person orbit camera.
 *
 * The camera orbits the player's head on a yaw/pitch spherical rig, clamped so
 * it can never dip below the ground or flip over the top. A voxel ray-march
 * pulls the camera in when it would sit inside a wall, which is what stops the
 * player from clipping through a mountain and losing the world.
 *
 * Both input styles drive the same rig: drag on the right half of the screen
 * (touch), mouse drag, or arrow keys / Q-E for keyboard-only players.
 */

import * as THREE from 'three';
import { VoxelGrid } from '../core/Collision';

export class CameraRig {
  target = new THREE.Vector3(0, 1.4, 0);
  /** Desired offset behind the player, before collision correction. */
  desired = new THREE.Vector3(0, 3.2, 6.2);
  position = new THREE.Vector3(0, 4, 8);

  yaw = 0;
  pitch = 0.34;
  distance = 7.5;
  minDistance = 3.2;
  maxDistance = 16;
  minPitch = -0.25;
  maxPitch = 1.15;

  sensitivity = 0.0026;
  smooth = 9;
  collision = true;

  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private element: HTMLElement | null = null;

  /** True while the pointer is dragging the camera. */
  get isDragging(): boolean { return this.dragging; }

  attach(el: HTMLElement): void {
    this.element = el;
    el.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    el.addEventListener('wheel', this.onWheel, { passive: false });
  }

  detach(): void {
    if (this.element) {
      this.element.removeEventListener('pointerdown', this.onDown);
      this.element.removeEventListener('wheel', this.onWheel);
    }
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
  }

  private onDown = (e: PointerEvent): void => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.pointerType === 'touch' && e.clientX < window.innerWidth * 0.55) return;
    this.dragging = true;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
  };

  private onMove = (e: PointerEvent): void => {
    if (!this.dragging) return;
    const dx = e.clientX - this.lastX;
    const dy = e.clientY - this.lastY;
    this.lastX = e.clientX;
    this.lastY = e.clientY;
    this.yaw -= dx * this.sensitivity;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch + dy * this.sensitivity));
  };

  private onUp = (): void => { this.dragging = false; };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance + Math.sign(e.deltaY) * 0.9));
  };

  /** Feed the raw input deltas in (used when pointer events are handled elsewhere). */
  applyLook(dx: number, dy: number): void {
    this.yaw -= dx * this.sensitivity * 40;
    this.pitch = Math.max(this.minPitch, Math.min(this.maxPitch, this.pitch + dy * this.sensitivity * 40));
  }

  /** Set the orbit yaw to match a world-space facing angle (radians). */
  lookAtDirection(angle: number): void {
    // Keep the camera behind the player: yaw = facing + PI.
    this.yaw = angle + Math.PI;
  }

  update(dt: number, grid: VoxelGrid | null): void {
    // 1. Recompute the desired offset from the orbit angles.
    this.recomputeDesired();

    // 2. Pull the camera in if a wall is in the way.
    if (grid && this.collision) {
      const dir = new THREE.Vector3().subVectors(this.desired, this.target);
      const dist = dir.length();
      if (dist > 0.001) {
        dir.divideScalar(dist);
        const hit = raycastVoxel(grid, this.target, dir, dist);
        if (hit > 0.05 && hit < dist) {
          const safe = Math.max(0.5, hit - 0.5);
          this.desired.copy(this.target).addScaledVector(dir, safe);
        }
      }
    }

    // 3. Smooth toward the corrected position so the camera never snaps.
    const k = Math.min(1, this.smooth * dt);
    this.position.lerp(this.desired, k);
  }

  /** Recompute the desired offset from the orbit angles (call before update). */
  recomputeDesired(): void {
    const cp = Math.cos(this.pitch);
    this.desired.set(
      this.target.x - Math.sin(this.yaw) * cp * this.distance,
      this.target.y + Math.sin(this.pitch) * this.distance + 0.9,
      this.target.z - Math.cos(this.yaw) * cp * this.distance
    );
  }

  snapToPlayer(px: number, py: number, pz: number, facing: number): void {
    this.target.set(px, py + 1.35, pz);
    this.yaw = facing + Math.PI;
    this.recomputeDesired();
    this.position.copy(this.desired);
  }
}

/**
 * Voxel ray march (Amanatides & Woo style, simplified).
 * Returns the distance travelled before the first solid voxel, or `maxDist`.
 */
export function raycastVoxel(
  grid: VoxelGrid,
  from: THREE.Vector3,
  dir: THREE.Vector3,
  maxDist: number
): number {
  const sx = grid.sx, sy = grid.sy, sz = grid.sz;
  let x = Math.floor(from.x), y = Math.floor(from.y), z = Math.floor(from.z);

  const stepX = dir.x >= 0 ? 1 : -1;
  const stepY = dir.y >= 0 ? 1 : -1;
  const stepZ = dir.z >= 0 ? 1 : -1;

  const tDeltaX = dir.x !== 0 ? Math.abs(1 / dir.x) : Infinity;
  const tDeltaY = dir.y !== 0 ? Math.abs(1 / dir.y) : Infinity;
  const tDeltaZ = dir.z !== 0 ? Math.abs(1 / dir.z) : Infinity;

  let tMaxX = dir.x !== 0 ? ((stepX > 0 ? x + 1 - from.x : x - from.x) / dir.x) : Infinity;
  let tMaxY = dir.y !== 0 ? ((stepY > 0 ? y + 1 - from.y : y - from.y) / dir.y) : Infinity;
  let tMaxZ = dir.z !== 0 ? ((stepZ > 0 ? z + 1 - from.z : z - from.z) / dir.z) : Infinity;

  let t = 0;
  const eps = 1e-4;
  while (t < maxDist) {
    if (tMaxX < tMaxY && tMaxX < tMaxZ) {
      x += stepX; t = tMaxX; tMaxX += tDeltaX;
    } else if (tMaxY < tMaxZ) {
      y += stepY; t = tMaxY; tMaxY += tDeltaY;
    } else {
      z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ;
    }
    if (x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz) return maxDist;
    if (grid.tiles[((y * sz) | 0) * sx + (x | 0)] !== 0) return Math.max(0, t - eps);
  }
  return maxDist;
}
