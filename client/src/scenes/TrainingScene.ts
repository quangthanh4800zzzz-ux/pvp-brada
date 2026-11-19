import Phaser from 'phaser';
import { BattleScene } from './BattleScene.js';

/**
 * Combat Lab entry: battle scene in training mode — passive dummy,
 * frame-data overlay, auto-reset instead of rounds.
 */
export class TrainingScene extends Phaser.Scene {
  constructor() {
    super('Training');
  }

  create(): void {
    this.scene.start('Battle', { mode: 'training' });
  }
}
