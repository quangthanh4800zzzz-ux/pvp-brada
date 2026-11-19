export function intersects(ax: number, ay: number, aw: number, ah: number, b: { x: number; y: number; width: number; height: number }): boolean {
  return ax < b.x + b.width && ax + aw > b.x && ay < b.y + b.height && ay + ah > b.y;
}
