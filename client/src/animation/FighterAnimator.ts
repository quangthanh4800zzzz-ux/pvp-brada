import Phaser from 'phaser';
import type { FighterSim } from '../combat/FighterSim.js';

const STATE_TO_ANIM: Record<string, string> = {
  idle: 'idle',
  walk: 'walk',
  run: 'run',
  jumpRise: 'jump',
  jumpFall: 'fall',
  landing: 'guard',
  dash: 'dash',
  guard: 'guard',
  hitstun: 'hitReaction',
  blockstun: 'guard',
  knockdown: 'knockdown',
  getup: 'getup',
  victory: 'victory',
  defeat: 'defeat'
};

const ATTACK_TO_ANIM: Record<string, string> = {
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
  air_light: 'airAttack',
  dash_attack: 'dashAttack'
};

/**
 * Keeps sprite visuals in lock-step with sim state.
 * Attack animations are frame-locked to sim stateFrame so visuals never
 * desync from hitboxes; locomotion animations run on their own timeline.
 */
export class FighterAnimator {
  readonly sprite: Phaser.GameObjects.Sprite;

  constructor(
    scene: Phaser.Scene,
    charId: string,
    private readonly fighter: FighterSim,
    x: number,
    y: number,
    tint: number
  ) {
    this.sprite = scene.add.sprite(x, y, `${charId}.idle`, 0);
    this.sprite.setOrigin(0.5, 1);
    this.sprite.setTint(tint);
  }

  sync(charId: string): void {
    const fighter = this.fighter;
    const animName =
      fighter.state === 'attack' && fighter.attack
        ? (ATTACK_TO_ANIM[fighter.attack.id] ?? 'light')
        : (STATE_TO_ANIM[fighter.state] ?? 'idle');
    const animKey = `${charId}.${animName}`;

    if (this.sprite.anims.currentAnim?.key !== animKey && this.sprite.scene.anims.exists(animKey)) {
      this.sprite.anims.play(animKey, true);
    }

    if (fighter.state === 'attack' && fighter.attack) {
      const total = this.sprite.anims.getTotalFrames();
      if (total > 0) {
        const progress = Math.min(fighter.stateFrame, total - 1) / Math.max(1, total - 1);
        this.sprite.anims.setProgress(progress);
      }
    }

    this.sprite.setFlipX(fighter.facing === -1);
    this.sprite.setPosition(Math.round(fighter.body.centerX), fighter.body.bottom);
  }
}
