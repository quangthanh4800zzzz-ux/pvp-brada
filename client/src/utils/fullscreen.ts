import type Phaser from 'phaser';

export function toggleFullscreen(): void {
  if (typeof document === 'undefined') return;
  if (document.fullscreenElement) {
    void document.exitFullscreen().catch(() => undefined);
    return;
  }
  void document.documentElement.requestFullscreen().catch(() => undefined);
}

export function wireFullscreenToggle(scene: Phaser.Scene): void {
  scene.input.keyboard?.on('keydown-F', () => toggleFullscreen());
}
