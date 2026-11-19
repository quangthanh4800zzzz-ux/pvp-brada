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

  create(data: { char1?: string; char2?: string }): void {
    this.scene.start('Battle', { mode: 'training', char1: data.char1, char2: data.char2 });
  }
}
