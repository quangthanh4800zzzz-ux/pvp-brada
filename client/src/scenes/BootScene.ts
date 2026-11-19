import Phaser from 'phaser';
import { loadGameData, PRA_DATA_KEY, type LoadedData } from '../core/DataLoader.js';
import { validateManifest } from '../animation/manifest.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  async preload(): Promise<void> {
    try {
      const data = await loadGameData();
      const errors = Object.entries(data.manifests).flatMap(([charId, manifest]) =>
        validateManifest(manifest, data.characters[charId]?.attacks ?? []).map((err) => `${charId}:${err.code}:${err.detail}`)
      );
      if (errors.length > 0) throw new Error(`animation validation failed: ${errors.join(', ')}`);
      this.queueTextures(data);
      this.registry.set(PRA_DATA_KEY, data);
    } catch (error) {
      this.registry.set('pra-boot-error', (error as Error).message);
    }
  }

  private queueTextures(data: LoadedData): void {
    for (const [charId, manifest] of Object.entries(data.manifests)) {
      for (const [animName, meta] of Object.entries(manifest.animations)) {
        const key = `${charId}.${animName}`;
        this.load.spritesheet(key, meta.file, { frameWidth: meta.frameWidth, frameHeight: meta.frameHeight });
      }
    }
    for (const [name, meta] of Object.entries(data.manifests['fighter_001']?.effects ?? {})) {
      this.load.spritesheet(`fx.${name}`, meta.file, { frameWidth: 48, frameHeight: 48 });
    }
  }

  create(): void {
    const error = this.registry.get('pra-boot-error') as string | undefined;
    if (error) {
      this.cameras.main.setBackgroundColor('#200a0a');
      this.add.text(20, 20, `DATA ERROR: ${error}`, {
        color: '#ff9999',
        fontFamily: 'monospace',
        fontSize: '11px',
        wordWrap: { width: 600 }
      });
      return;
    }
    this.createAnimations();
    this.scene.start('MainMenu');
  }

  private createAnimations(): void {
    const data = this.registry.get(PRA_DATA_KEY) as LoadedData;
    for (const [charId, manifest] of Object.entries(data.manifests)) {
      for (const [animName, meta] of Object.entries(manifest.animations)) {
        const key = `${charId}.${animName}`;
        if (this.anims.exists(key)) continue;
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(key, { start: 0, end: meta.frameCount - 1 }),
          frameRate: meta.fps,
          repeat: meta.loop ? -1 : 0
        });
      }
    }
    for (const [name, meta] of Object.entries(data.manifests['fighter_001']?.effects ?? {})) {
      const key = `fx.${name}`;
      if (this.anims.exists(key)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: meta.frameCount - 1 }),
        frameRate: meta.fps,
        repeat: 0
      });
    }
  }
}
