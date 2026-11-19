export interface Vec2 {
  x: number;
  y: number;
}

export interface AABB {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Facing = 1 | -1;

export function aabbIntersects(a: AABB, b: AABB): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

export function aabbCenter(a: AABB): Vec2 {
  return { x: a.x + a.width / 2, y: a.y + a.height / 2 };
}

export function aabbOverlapArea(a: AABB, b: AABB): number {
  const ow = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
  const oh = Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y);
  return ow > 0 && oh > 0 ? ow * oh : 0;
}
