import Phaser from 'phaser';
import type { MapDefinition } from '@shared/types/index.js';
import type { PhysicsWorld } from '../physics/PhysicsWorld.js';

/**
 * Renders parallax background, platforms, zones, and moving platforms.
 * Everything is procedural pixel shapes driven by MapDefinition data —
 * real art assets drop in behind the same renderer once produced.
 */
export class MapRenderer {
  readonly moverRects = new Map<string, Phaser.GameObjects.Rectangle>();

  constructor(
    scene: Phaser.Scene,
    map: MapDefinition,
    physics: PhysicsWorld,
    options: { parallax: boolean }
  ) {
    void physics;
    this.drawSky(scene, map);
    if (options.parallax) this.drawParallax(scene, map);
    this.drawZones(scene, map);

    for (const solid of map.solids) {
      const color = solid.visual === 'ground' ? 0x2c3444 : 0x3d4a63;
      const edge = solid.visual === 'ground' ? 0x51617c : 0x5d7093;
      scene.add.rectangle(solid.x, solid.y, solid.width, solid.height, color).setOrigin(0, 0).setDepth(10);
      scene.add.rectangle(solid.x, solid.y, solid.width, 2, edge).setOrigin(0, 0).setDepth(20);
    }

    for (const mover of map.movers) {
      const base = scene.add.rectangle(mover.x, mover.y, mover.width, mover.height, 0x8ac926).setOrigin(0, 0).setDepth(20);
      scene.add.rectangle(mover.x, mover.y, mover.width, 2, 0xd1ed9a).setOrigin(0, 0).setDepth(21);
      this.moverRects.set(mover.id, base);
    }
  }

  syncMovers(physics: PhysicsWorld): void {
    for (const mover of physics.movers) {
      const rect = this.moverRects.get(mover.id);
      if (rect) rect.setPosition(mover.aabb.x, mover.aabb.y);
    }
  }

  private drawSky(scene: Phaser.Scene, map: MapDefinition): void {
    const c0 = map.sky[0] ?? ([0, 0, 0] as [number, number, number]);
    const c1 = map.sky[1] ?? c0;
    const c2 = map.sky[2] ?? c1;
    for (let y = 0; y < map.bounds.height; y += 8) {
      const t = y / map.bounds.height;
      const color = t < 0.5 ? lerpColor(c0, c1, t * 2) : lerpColor(c1, c2, (t - 0.5) * 2);
      scene.add.rectangle(0, y, map.bounds.width, 8, color).setOrigin(0, 0).setDepth(-20);
    }
  }

  private drawParallax(scene: Phaser.Scene, map: MapDefinition): void {
    const rnd = (n: number): number => {
      const x = Math.sin(n * 12.9898 + map.parallaxSeed * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };
    for (let i = 0; i < 14; i++) {
      const w = 40 + Math.floor(rnd(i) * 50);
      const h = 80 + Math.floor(rnd(i + 50) * 140);
      const x = i * 70 + rnd(i + 20) * 20;
      const building = scene.add
        .rectangle(x - 120, map.bounds.height - 48 - h, w, h, 0x1a2138)
        .setOrigin(0, 0)
        .setDepth(-18);
      building.setScrollFactor(0.5);
      for (let wy = 0; wy < Math.floor(h / 14); wy++) {
        for (let wx = 0; wx < Math.floor(w / 12); wx++) {
          if (rnd(i * 100 + wx * 13 + wy * 7) > 0.62) {
            const win = scene.add
              .rectangle(x - 120 + 6 + wx * 12, map.bounds.height - 48 - h + 8 + wy * 14, 4, 5, 0xffca3a, 0.7)
              .setOrigin(0, 0)
              .setDepth(-17);
            win.setScrollFactor(0.5);
          }
        }
      }
    }
  }

  private drawZones(scene: Phaser.Scene, map: MapDefinition): void {
    for (const zone of map.zones) {
      const region = zone.region;
      if ((zone.flags ?? []).includes('wet')) {
        scene.add.rectangle(region.x, region.y, region.width, region.height, 0x2b6f8f, 0.45).setOrigin(0, 0).setDepth(5);
      }
      if ((zone.flags ?? []).includes('wind')) {
        for (let i = 0; i < 7; i++) {
          const streak = scene.add
            .rectangle(region.x + i * 30, region.y + ((i * 37) % region.height), 18, 1, 0x9de1ff, 0.2)
            .setOrigin(0, 0)
            .setDepth(5);
          scene.tweens.add({
            targets: streak,
            x: region.x + region.width - 30,
            duration: 2600 + i * 240,
            repeat: -1,
            yoyo: true
          });
        }
      }
    }
  }
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): number {
  const inRange = (v: number): number => Math.round(Math.min(255, Math.max(0, v)));
  return (inRange(a[0] + (b[0] - a[0]) * t) << 16) | (inRange(a[1] + (b[1] - a[1]) * t) << 8) | inRange(a[2] + (b[2] - a[2]) * t);
}
