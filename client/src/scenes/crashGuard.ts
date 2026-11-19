import Phaser from 'phaser';

export const showFatalPanel = (scene: Phaser.Scene, error: Error): void => {
  scene.add.rectangle(320, 180, 640, 360, 0x2b0d12, 0.94).setDepth(1200);
  scene.add
    .text(320, 160, `RUNTIME ERROR\n${error.message}\n\nESC: menu`, {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#ff8a8a',
      align: 'center',
      wordWrap: { width: 560 }
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
