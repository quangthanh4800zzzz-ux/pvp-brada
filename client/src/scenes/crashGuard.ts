import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@shared/constants/game.js';

export const showFatalPanel = (scene: Phaser.Scene, error: Error): void => {
  scene.add
    .rectangle(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2, INTERNAL_WIDTH, INTERNAL_HEIGHT, 0x2b0d12, 0.94)
    .setDepth(1200);
  scene.add
    .text(INTERNAL_WIDTH / 2, INTERNAL_HEIGHT / 2 - 20, `RUNTIME ERROR\n${error.message}\n\nESC: menu`, {
      fontFamily: 'monospace',
      fontSize: '18px',
      color: '#ff8a8a',
      align: 'center',
      wordWrap: { width: 840 }
    })
    .setOrigin(0.5)
    .setDepth(1201);
};

export const runGuarded = (scene: Phaser.Scene, run: () => void): void => {
  try {
    run();
  } catch (error) {
    console.error('[PRA] scene error:', (error as Error).stack ?? (error as Error).message);
    showFatalPanel(scene, error as Error);
  }
};
