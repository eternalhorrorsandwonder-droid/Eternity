/**
 * Voxel collision.
 *
 * The world is a flat `Uint8Array` of tile ids (air = 0). Tile *flags* live in
 * a static lookup table indexed by tile id, so the hot path is a single array
 * read plus a table lookup. That keeps the tile palette at 255 entries while
 * staying branch-cheap for the mesher.
 *
 * Movement is done per-axis (Y, then X, then Z). That ordering is what makes
 * walking up stairs, corner-sliding and landing on ledges feel right without
 * any swept-volume math.
 */

export const AIR = 0;

/** Flags a tile can carry. */
export const FLAG_OPAQUE = 1;
export const FLAG_TRANSPARENT = 2;
export const FLAG_WATER = 4;
export const FLAG_LAVA = 8;
export const FLAG_CLIMABLE = 16;

export class VoxelGrid {
  /** Tile ids are dense but exceed 255, so the grid is 16-bit. */
  tiles: Uint16Array;
  readonly sx: number;
  readonly sy: number;
  readonly sz: number;
  readonly size: number;

  constructor(sx: number, sy: number, sz: number) {
    this.sx = sx; this.sy = sy; this.sz = sz;
    this.size = sx * sy * sz;
    this.tiles = new Uint16Array(this.size);
  }

  static index(x: number, y: number, z: number, sx: number, sz: number): number {
    return ((y * sz) | 0) * sx + (x | 0);
  }

  inBounds(x: number, y: number, z: number): boolean {
    return x >= 0 && y >= 0 && z >= 0 && x < this.sx && y < this.sy && z < this.sz;
  }

  get(x: number, y: number, z: number): number {
    if (x < 0 || y < 0 || z < 0 || x >= this.sx || y >= this.sy || z >= this.sz) return AIR;
    return this.tiles[VoxelGrid.index(x, y, z, this.sx, this.sz)];
  }

  set(x: number, y: number, z: number, tile: number): void {
    if (!this.inBounds(x, y, z)) return;
    this.tiles[VoxelGrid.index(x, y, z, this.sx, this.sz)] = tile & 0xff;
  }

  /** Fill a column up to a height. */
  fillColumn(x: number, z: number, top: number, tile: number): void {
    for (let y = 0; y <= top; y++) this.set(x, y, z, tile);
  }
}

/**
 * Static flag table. Indexed by tile id. Set by the tile registry after all
 * tiles are registered (the engine calls `Tiles.initFlags()`).
 */
export const TILE_FLAGS: Uint8Array = new Uint8Array(1024);

export function tileFlags(tile: number): number {
  return tile === AIR ? 0 : TILE_FLAGS[tile] | 0;
}

export function isSolidTile(tile: number): boolean {
  return tile !== AIR;
}

export function isOpaque(tile: number): boolean {
  return (TILE_FLAGS[tile] & FLAG_OPAQUE) !== 0;
}

export function isTransparentTile(tile: number): boolean {
  return (TILE_FLAGS[tile] & FLAG_TRANSPARENT) !== 0;
}

export function isLiquid(tile: number, flag: number): boolean {
  return (TILE_FLAGS[tile] & flag) !== 0;
}

export interface AABB {
  minX: number; minY: number; minZ: number;
  maxX: number; maxY: number; maxZ: number;
}

export function boxFrom(x: number, y: number, z: number, hw: number, hh: number, hd: number): AABB {
  return {
    minX: x - hw, maxX: x + hw,
    minY: y - hh, maxY: y + hh,
    minZ: z - hd, maxZ: z + hd,
  };
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return a.minX < b.maxX && a.maxX > b.minX &&
    a.minY < b.maxY && a.maxY > b.minY &&
    a.minZ < b.maxZ && a.maxZ > b.minZ;
}

export interface MoveResult { hitX: boolean; hitY: boolean; hitZ: boolean; }

/**
 * Move an AABB through the grid, axis by axis.
 * Returns which axes collided plus the normal/tile of the first hit so the
 * caller can emit footstep / head-bonk / land feedback.
 */
/** Anything that can answer "what tile is at this voxel". */
export interface TileReader {
  get(x: number, y: number, z: number): number;
}

export function moveAABB(
  grid: TileReader,
  pos: { x: number; y: number; z: number },
  half: { x: number; y: number; z: number },
  dx: number, dy: number, dz: number,
  onCollide?: (normal: [number, number, number], tx: number, ty: number, tz: number) => void
): MoveResult {
  let hitX = false, hitY = false, hitZ = false;

  if (dy !== 0) {
    pos.y += dy;
    const minX = Math.floor(pos.x - half.x), maxX = Math.floor(pos.x + half.x);
    const minZ = Math.floor(pos.z - half.z), maxZ = Math.floor(pos.z + half.z);
    if (dy < 0) {
      for (let ty = Math.floor(pos.y - half.y); ty <= Math.floor(pos.y + half.y); ty++) {
        for (let tx = minX; tx <= maxX; tx++) {
          for (let tz = minZ; tz <= maxZ; tz++) {
            if (isSolidTile(grid.get(tx, ty, tz))) {
              pos.y = ty + 1 + half.y;
              hitY = true;
              if (onCollide) onCollide([0, 1, 0], tx, ty, tz);
              return { hitX, hitY, hitZ };
            }
          }
        }
      }
    } else {
      for (let ty = Math.floor(pos.y + half.y); ty >= Math.floor(pos.y - half.y); ty--) {
        for (let tx = minX; tx <= maxX; tx++) {
          for (let tz = minZ; tz <= maxZ; tz++) {
            if (isSolidTile(grid.get(tx, ty, tz))) {
              pos.y = ty - 1 - half.y;
              hitY = true;
              if (onCollide) onCollide([0, -1, 0], tx, ty, tz);
              return { hitX, hitY, hitZ };
            }
          }
        }
      }
    }
  }

  if (dx !== 0) {
    pos.x += dx;
    const minY = Math.floor(pos.y - half.y), maxY = Math.floor(pos.y + half.y);
    const minZ = Math.floor(pos.z - half.z), maxZ = Math.floor(pos.z + half.z);
    if (dx < 0) {
      for (let tx = Math.floor(pos.x - half.x); tx <= Math.floor(pos.x + half.x); tx++) {
        for (let ty = minY; ty <= maxY; ty++) {
          for (let tz = minZ; tz <= maxZ; tz++) {
            if (isSolidTile(grid.get(tx, ty, tz))) {
              pos.x = tx + 1 + half.x;
              hitX = true;
              if (onCollide) onCollide([-1, 0, 0], tx, ty, tz);
              break;
            }
          }
        }
      }
    } else {
      for (let tx = Math.floor(pos.x + half.x); tx >= Math.floor(pos.x - half.x); tx--) {
        for (let ty = minY; ty <= maxY; ty++) {
          for (let tz = minZ; tz <= maxZ; tz++) {
            if (isSolidTile(grid.get(tx, ty, tz))) {
              pos.x = tx - 1 - half.x;
              hitX = true;
              if (onCollide) onCollide([1, 0, 0], tx, ty, tz);
              break;
            }
          }
        }
      }
    }
  }

  if (dz !== 0) {
    pos.z += dz;
    const minX = Math.floor(pos.x - half.x), maxX = Math.floor(pos.x + half.x);
    const minY = Math.floor(pos.y - half.y), maxY = Math.floor(pos.y + half.y);
    if (dz < 0) {
      for (let tz = Math.floor(pos.z - half.z); tz <= Math.floor(pos.z + half.z); tz++) {
        for (let tx = minX; tx <= maxX; tx++) {
          for (let ty = minY; ty <= maxY; ty++) {
            if (isSolidTile(grid.get(tx, ty, tz))) {
              pos.z = tz + 1 + half.z;
              hitZ = true;
              if (onCollide) onCollide([0, 0, -1], tx, ty, tz);
              break;
            }
          }
        }
      }
    } else {
      for (let tz = Math.floor(pos.z + half.z); tz >= Math.floor(pos.z - half.z); tz--) {
        for (let tx = minX; tx <= maxX; tx++) {
          for (let ty = minY; ty <= maxY; ty++) {
            if (isSolidTile(grid.get(tx, ty, tz))) {
              pos.z = tz - 1 - half.z;
              hitZ = true;
              if (onCollide) onCollide([0, 0, 1], tx, ty, tz);
              break;
            }
          }
        }
      }
    }
  }

  return { hitX, hitY, hitZ };
}

/** Height of the solid surface under a point. */
export function surfaceHeight(grid: TileReader, x: number, z: number, maxScan = 192): number {
  const xi = Math.floor(x), zi = Math.floor(z);
  for (let y = maxScan; y >= 0; y--) {
    if (isSolidTile(grid.get(xi, y, zi))) return y;
  }
  return 0;
}
