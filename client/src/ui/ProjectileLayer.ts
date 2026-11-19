import Phaser from 'phaser';
import type { Projectile } from '../combat/BattleSim.js';

/**
 * Renders sim projectiles with pooled looping sprites (fxp.<name> anims),
 * recycled per id — never re-allocated per tick.
 */
export class ProjectileLayer {
  private view = new Map<number, Phaser.GameObjects.Sprite>();

  constructor(private readonly scene: Phaser.Scene) {}

  sync(projectiles: Projectile[]): void {
    const live = new Set<number>();
    for (const projectile of projectiles) {
      live.add(projectile.id);
      let sprite = this.view.get(projectile.id);
      const key = `fxp.${projectile.fx}`;
      if (!sprite) {
        if (!this.scene.anims.exists(key) || !this.scene.textures.exists(`fx.${projectile.fx}`)) continue;
        sprite = this.scene.add
          .sprite(projectile.x + projectile.width / 2, projectile.y + projectile.height / 2, `fx.${projectile.fx}`, 0)
          .setDepth(60);
        sprite.play(key, true);
        this.view.set(projectile.id, sprite);
      }
      sprite.setPosition(Math.round(projectile.x + projectile.width / 2), Math.round(projectile.y + projectile.height / 2));
      sprite.setFlipX(projectile.vx < 0);
    }
    for (const [id, sprite] of this.view) {
      if (!live.has(id)) {
        sprite.destroy();
        this.view.delete(id);
      }
    }
  }

  destroyAll(): void {
    for (const sprite of this.view.values()) sprite.destroy();
    this.view.clear();
  }
}
