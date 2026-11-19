import Phaser from 'phaser';
import type { MapDefinition, MapSolid } from '@shared/types/index.js';
import type { PhysicsWorld } from '../physics/PhysicsWorld.js';

const GROUND_TILE = 48;

function shadeColor(color: number, delta: number): number {
  const ch = (shift: number): number => {
    const v = Math.min(255, Math.max(0, ((color >> shift) & 255) + delta));
    return v << shift;
  };
  return ch(16) | ch(8) | ch(0);
}

function lerpColor(a: [number, number, number], b: [number, number, number], t: number): number {
  const inRange = (v: number): number => Math.round(Math.min(255, Math.max(0, v)));
  return (inRange(a[0] + (b[0] - a[0]) * t) << 16) | (inRange(a[1] + (b[1] - a[1]) * t) << 8) | inRange(a[2] + (b[2] - a[2]) * t);
}

/**
 * Renders parallax background, platforms, zones, and moving platforms.
 * Procedural pixel rendering driven by the data-driven visuals config —
 * real art assets drop in behind the same renderer once produced.
 */
export class MapRenderer {
  readonly moverRects = new Map<string, Phaser.GameObjects.Rectangle>();

  private readonly scene: Phaser.Scene;
  private readonly map: MapDefinition;
  private readonly parallax: boolean;
  private readonly rnd: (n: number) => number;

  constructor(
    scene: Phaser.Scene,
    map: MapDefinition,
    physics: PhysicsWorld,
    options: { parallax: boolean }
  ) {
    void physics;
    this.scene = scene;
    this.map = map;
    this.parallax = options.parallax;
    const seed = map.parallaxSeed;
    this.rnd = (n: number): number => {
      const x = Math.sin(n * 12.9898 + seed * 78.233) * 43758.5453;
      return x - Math.floor(x);
    };

    this.drawSky();
    if (this.parallax) this.drawSkyline();
    if (this.parallax && map.visuals?.rain?.enabled) this.drawRain();
    this.drawSolids();
    this.drawMovers();
    this.drawZones();
    this.drawNeonSigns();
    if (this.parallax && map.visuals?.vignette) this.drawVignette();
  }

  syncMovers(physics: PhysicsWorld): void {
    for (const mover of physics.movers) {
      const rect = this.moverRects.get(mover.id);
      if (rect) rect.setPosition(mover.aabb.x, mover.aabb.y);
    }
  }

  private drawSky(): void {
    const c0 = this.map.sky[0] ?? ([0, 0, 0] as [number, number, number]);
    const c1 = this.map.sky[1] ?? c0;
    const c2 = this.map.sky[2] ?? c1;
    for (let y = 0; y < this.map.bounds.height; y += 4) {
      const t = y / this.map.bounds.height;
      const color = t < 0.5 ? lerpColor(c0, c1, t * 2) : lerpColor(c1, c2, (t - 0.5) * 2);
      this.scene.add.rectangle(0, y, this.map.bounds.width, 4, color).setOrigin(0, 0).setDepth(-30);
    }
    for (let i = 0; i < 26; i++) {
      const sx = this.rnd(i * 3 + 1) * this.map.bounds.width;
      const sy = this.rnd(i * 3 + 2) * this.map.bounds.height * 0.5;
      const star = this.scene.add.rectangle(sx, sy, 1, 1, 0xdfe8ff, 0.35 + this.rnd(i) * 0.4).setOrigin(0, 0).setDepth(-29);
      if (this.parallax) {
        star.setScrollFactor(0.05);
        this.scene.tweens.add({
          targets: star,
          alpha: { from: star.alpha, to: 0.08 },
          duration: 1800 + this.rnd(i * 7) * 2600,
          yoyo: true,
          repeat: -1
        });
      }
    }
  }

  private drawSkyline(): void {
    const layers = this.map.visuals?.skyline ?? [];
    if (layers.length === 0) {
      this.legacySkyline();
      return;
    }
    layers.forEach((layer, li) => {
      const baseDepth = -26 + li * 2;
      for (let i = 0; i < layer.count; i++) {
        const w = 44 + Math.floor(this.rnd(li * 100 + i) * 58);
        const h = layer.heightMin + Math.floor(this.rnd(li * 100 + i + 40) * (layer.heightMax - layer.heightMin));
        const bx = Math.floor(i * (this.map.bounds.width / layer.count) + this.rnd(li * 700 + i) * 46) - 60;
        const by = this.map.bounds.height - 48 - h;

        const parts: Phaser.GameObjects.Rectangle[] = [];
        const rect = (x: number, y: number, rw: number, rh: number, color: number, alpha = 1, depth = baseDepth): void => {
          parts.push(this.scene.add.rectangle(x, y, rw, rh, color, alpha).setOrigin(0, 0).setDepth(depth));
        };
        rect(bx - 2, by - 2, w + 4, h + 4, shadeColor(layer.color, -8));
        rect(bx, by, w, h, layer.color);

        if (this.rnd(li * 900 + i) > 0.55) {
          const antennaH = 8 + Math.floor(this.rnd(li * 950 + i) * 18);
          rect(bx + Math.floor(w / 2), by - antennaH, 2, antennaH, shadeColor(layer.color, -12));
          if (this.rnd(li * 960 + i) > 0.5) {
            const beacon = this.scene.add
              .rectangle(bx + Math.floor(w / 2) - 1, by - antennaH - 3, 2, 2, 0xff5a5a)
              .setOrigin(0, 0)
              .setDepth(baseDepth + 1);
            parts.push(beacon);
            if (this.parallax) {
              beacon.setScrollFactor(layer.scrollFactor);
              this.scene.tweens.add({ targets: beacon, alpha: { from: 1, to: 0.1 }, duration: 1100 + Math.floor(this.rnd(i) * 700), yoyo: true, repeat: -1 });
            }
          }
        }
        if (this.rnd(li * 970 + i) > 0.6) {
          rect(bx + 8, by - 6, Math.floor(w / 3), 6, shadeColor(layer.color, -10), 1, baseDepth + 1);
        }

        for (let wy = 0; wy < Math.floor(h / 14); wy++) {
          for (let wx = 0; wx < Math.floor(w / 12); wx++) {
            if (this.rnd((li + 1) * 1000 + i * 100 + wx * 13 + wy * 7) > 1 - layer.windows.litChance) {
              rect(bx + 6 + wx * 12, by + 8 + wy * 14, 4, 5, layer.windows.color, 0.55 + this.rnd(wx * 31 + wy * 17) * 0.35, baseDepth + 1);
            }
          }
        }
        if (this.parallax) {
          for (const child of parts) child.setScrollFactor(layer.scrollFactor);
        }
      }
    });
  }

  private legacySkyline(): void {
    for (let i = 0; i < 14; i++) {
      const w = 40 + Math.floor(this.rnd(i) * 50);
      const h = 80 + Math.floor(this.rnd(i + 50) * 140);
      const x = i * 70 + this.rnd(i + 20) * 20 - 60;
      const building = this.scene.add.rectangle(x, this.map.bounds.height - 48 - h, w, h, 0x1a2138).setOrigin(0, 0).setDepth(-18);
      building.setScrollFactor(0.5);
    }
  }

  private drawSolids(): void {
    for (const solid of this.map.solids) {
      if (solid.visual === 'ground') this.drawGround(solid);
      else this.drawPlatform(solid);
    }
  }

  private drawGround(solid: MapSolid): void {
    const s = this.scene;
    s.add.rectangle(solid.x, solid.y, solid.width, solid.height, 0x222a38).setOrigin(0, 0).setDepth(10);
    s.add.rectangle(solid.x, solid.y, solid.width, 3, 0x4a5568).setOrigin(0, 0).setDepth(11);
    s.add.rectangle(solid.x, solid.y, solid.width, 1, 0x7fd6e8).setOrigin(0, 0).setDepth(12).setAlpha(0.9);
    for (let x = solid.x; x < solid.x + solid.width; x += GROUND_TILE) {
      s.add.rectangle(x, solid.y + 3, 1, solid.height - 3, 0x1a2130).setOrigin(0, 0).setDepth(11);
      s.add.rectangle(x + 3, solid.y + 6, 1, 1, 0x313d52).setOrigin(0, 0).setDepth(11);
    }
    for (let x = solid.x + 12; x < solid.x + solid.width; x += GROUND_TILE * 2) {
      const spec = s.add.rectangle(x, solid.y + 2, 2, 1, 0x9de1ff).setOrigin(0, 0).setDepth(12).setAlpha(0.5);
      s.tweens.add({ targets: spec, alpha: { from: 0.6, to: 0.15 }, duration: 1500 + (x % 700), yoyo: true, repeat: -1 });
    }
  }

  private drawPlatform(solid: MapSolid): void {
    const s = this.scene;
    s.add.rectangle(solid.x, solid.y, solid.width, solid.height, 0x2e3952).setOrigin(0, 0).setDepth(10);
    s.add.rectangle(solid.x, solid.y, solid.width, 2, 0x5d7093).setOrigin(0, 0).setDepth(12);
    s.add.rectangle(solid.x, solid.y, solid.width, 1, 0x6fe3f5).setOrigin(0, 0).setDepth(13).setAlpha(0.8);
    for (let i = 8; i < solid.width - 4; i += 24) {
      s.add.rectangle(solid.x + i, solid.y + solid.height, 8, 3, 0x1f2739).setOrigin(0, 0).setDepth(9);
    }
    s.add.rectangle(solid.x + solid.width / 2 - 4, solid.y + 2, 8, 2, 0x8a8fa3).setOrigin(0, 0).setDepth(12);
  }

  private drawMovers(): void {
    for (const mover of this.map.movers) {
      const base = this.scene.add.rectangle(mover.x, mover.y, mover.width, mover.height, 0x3f4c68).setOrigin(0, 0).setDepth(20);
      this.scene.add.rectangle(mover.x, mover.y, mover.width, 2, 0xa8c66a).setOrigin(0, 0).setDepth(21);
      this.scene.add.rectangle(mover.x, mover.y, mover.width, 1, 0xd1ed9a).setOrigin(0, 0).setDepth(21);
      this.moverRects.set(mover.id, base);
    }
  }

  private drawZones(): void {
    for (const zone of this.map.zones) {
      const region = zone.region;
      const flags = zone.flags ?? [];
      if (flags.includes('wet')) {
        this.scene.add.rectangle(region.x, region.y, region.width, region.height, 0x2b6f8f, 0.4).setOrigin(0, 0).setDepth(5);
        for (let i = 0; i < 5; i++) {
          const ripple = this.scene.add
            .rectangle(region.x + 10 + i * (region.width / 5), region.y + 6 + (i % 2) * 6, 10, 1, 0xbfeaff, 0.4)
            .setOrigin(0, 0)
            .setDepth(6);
          this.scene.tweens.add({
            targets: ripple,
            scaleX: { from: 0.4, to: 1.4 },
            alpha: { from: 0.5, to: 0 },
            duration: 2200 + i * 380,
            repeat: -1,
            delay: i * 440
          });
        }
      }
      if (this.parallax && flags.includes('wind')) {
        for (let i = 0; i < 9; i++) {
          const streak = this.scene.add
            .rectangle(region.x + i * 24, region.y + ((i * 37) % region.height), 16, 1, 0x9de1ff, 0.18)
            .setOrigin(0, 0)
            .setDepth(5);
          this.scene.tweens.add({
            targets: streak,
            x: region.x + region.width - 20,
            duration: 2400 + i * 210,
            repeat: -1,
            yoyo: true
          });
        }
      }
    }
  }

  private drawNeonSigns(): void {
    for (const [i, neon] of (this.map.visuals?.neonSigns ?? []).entries()) {
      const s = this.scene;
      s.add
        .rectangle(neon.x - 4 + neon.width / 2, neon.y - 4 + neon.height / 2, neon.width + 8, neon.height + 8, neon.color, 0.16)
        .setDepth(7)
        .setScrollFactor(this.parallax ? 0.85 : 1);
      s.add.rectangle(neon.x, neon.y, neon.width, neon.height, 0x141824).setOrigin(0, 0).setDepth(8);
      s.add.rectangle(neon.x + 1, neon.y + 1, neon.width - 2, neon.height - 2, neon.color, 0.85).setOrigin(0, 0).setDepth(8);
      for (let b = 0; b < Math.floor(neon.height / 6); b++) {
        s.add.rectangle(neon.x + 4, neon.y + 4 + b * 6, neon.width - 8, 2, shadeColor(neon.color, 70)).setOrigin(0, 0).setDepth(9);
      }
      if (this.parallax && neon.blinkMs !== undefined) {
        const blink = s.add.rectangle(neon.x + 1, neon.y + 1, neon.width - 2, neon.height - 2, neon.color).setOrigin(0, 0).setDepth(8).setAlpha(0);
        s.time.addEvent({
          delay: 1400 + (i % 2) * neon.blinkMs,
          loop: true,
          callback: () => {
            blink.setAlpha(0.6);
            s.time.delayedCall(90, () => blink.setAlpha(0));
          }
        });
      }
    }
  }

  private drawRain(): void {
    if (!this.scene.textures.exists('pra.rain')) {
      const tex = this.scene.textures.createCanvas('pra.rain', 2, 8);
      if (!tex) return;
      const ctx = tex.getContext();
      ctx.fillStyle = 'rgba(157, 225, 255, 0.55)';
      ctx.fillRect(0, 0, 2, 8);
      tex.refresh();
    }
    const density = this.map.visuals?.rain?.density ?? 60;
    const scroll = this.map.visuals?.rain?.scrollFactor ?? 0.2;
    const emitter = this.scene.add.particles(0, 0, 'pra.rain', {
      x: { min: -40, max: this.map.bounds.width + 40 },
      y: -12,
      lifespan: 900,
      speedY: { min: 280, max: 360 },
      speedX: { min: -90, max: -55 },
      frequency: Math.max(12, 220 - density),
      scaleY: { min: 0.7, max: 1.4 },
      alpha: { start: 0.55, end: 0.2 },
      blendMode: 'SCREEN'
    });
    emitter.setDepth(40);
    emitter.setScrollFactor(scroll);
  }

  private drawVignette(): void {
    if (!this.scene.textures.exists('pra.vignette')) {
      const tex = this.scene.textures.createCanvas('pra.vignette', this.map.bounds.width, this.map.bounds.height);
      if (!tex) return;
      const ctx = tex.getContext();
      const grad = ctx.createRadialGradient(
        this.map.bounds.width / 2,
        this.map.bounds.height / 2,
        this.map.bounds.height * 0.38,
        this.map.bounds.width / 2,
        this.map.bounds.height / 2,
        this.map.bounds.width * 0.62
      );
      grad.addColorStop(0, 'rgba(4, 6, 18, 0)');
      grad.addColorStop(1, 'rgba(4, 6, 18, 0.5)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, this.map.bounds.width, this.map.bounds.height);
      tex.refresh();
    }
    this.scene.add
      .image(this.map.bounds.width / 2, this.map.bounds.height / 2, 'pra.vignette')
      .setScrollFactor(0)
      .setDepth(900);
  }
}
