import Phaser from 'phaser';
import type { CombatEvent } from '../combat/BattleSim.js';

/**
 * Spawns pooled one-shot pixel effects (hit spark) reacting to combat events.
 * Sprites are recycled, never re-allocated per hit.
 */
export class FxLayer {
  private pool: Phaser.GameObjects.Sprite[] = [];

  constructor(
    private scene: Phaser.Scene,
    private readonly onSpawn?: (object: Phaser.GameObjects.GameObject) => void
  ) {}

  handle(events: CombatEvent[], sims: { x: number; y: number }[]): void {
    for (const event of events) {
      if (event.type === 'hit' && !event.blocked) {
        const defender = sims[event.defender - 1];
        if (defender) this.spawn('fx.hitSpark', defender.x, defender.y);
      }
    }
  }

  spawn(key: string, x: number, y: number): Phaser.GameObjects.Sprite {
    const sprite = this.pool.pop() ?? this.createSprite(x, y, key);
    sprite.setPosition(x, y);
    sprite.setOrigin(0.5, 0.5);
    sprite.setVisible(true).setActive(true).setDepth(50);
    sprite.play(key, true);
    sprite.once('animationcomplete', () => this.recycle(sprite));
    return sprite;
  }

  private createSprite(x: number, y: number, key: string): Phaser.GameObjects.Sprite {
    const sprite = this.scene.add.sprite(x, y, key, 0);
    this.onSpawn?.(sprite);
    return sprite;
  }

  recycle(sprite: Phaser.GameObjects.Sprite): void {
    sprite.setVisible(false).setActive(false);
    this.pool.push(sprite);
  }
}
