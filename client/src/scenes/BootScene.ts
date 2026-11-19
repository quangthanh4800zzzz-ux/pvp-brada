import Phaser from 'phaser';
import { getBootData, PRA_DATA_KEY } from '../core/DataLoader.js';
import type { LoadedData } from '../core/DataLoader.js';

export class BootScene extends Phaser.Scene {
  constructor() {
    super('Boot');
  }

  preload(): void {
    this.queueTextures(getBootData());
    this.registry.set(PRA_DATA_KEY, getBootData());
  }

  private queueTextures(data: LoadedData): void {
    const effects = data.manifests['fighter_001'] ? data.manifests['fighter_001'].effects : {};
    for (const [charId, manifest] of Object.entries(data.manifests)) {
      for (const [animName, meta] of Object.entries(manifest.animations)) {
        this.load.spritesheet(`${charId}.${animName}`, meta.file, {
          frameWidth: meta.frameWidth,
          frameHeight: meta.frameHeight
        });
      }
    }
    for (const [name, meta] of Object.entries(effects)) {
      this.load.spritesheet(`fx.${name}`, meta.file, { frameWidth: 48, frameHeight: 48 });
    }
  }

  create(): void {
    this.createAnimations();
    this.scene.start('MainMenu');
    window.dispatchEvent(new Event('pra-booted'));
  }

  private createAnimations(): void {
    const data = getBootData();
    const effects = data.manifests['fighter_001'] ? data.manifests['fighter_001'].effects : {};
    const missing: string[] = [];
    for (const [charId, manifest] of Object.entries(data.manifests)) {
      for (const [animName, meta] of Object.entries(manifest.animations)) {
        const key = `${charId}.${animName}`;
        if (this.anims.exists(key)) continue;
        if (!this.textures.exists(key)) {
          missing.push(key);
          continue;
        }
        this.anims.create({
          key,
          frames: this.anims.generateFrameNumbers(key, { start: 0, end: meta.frameCount - 1 }),
          frameRate: meta.fps,
          repeat: meta.loop ? -1 : 0
        });
      }
    }
    for (const [name, meta] of Object.entries(effects)) {
      const key = `fx.${name}`;
      if (this.anims.exists(key)) continue;
      if (!this.textures.exists(key)) {
        missing.push(key);
        continue;
      }
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(key, { start: 0, end: meta.frameCount - 1 }),
        frameRate: meta.fps,
        repeat: 0
      });
    }
    if (missing.length > 0) {
      console.warn('[PRA] missing textures (animations skipped):', missing.join(', '));
      window.dispatchEvent(new CustomEvent('pra-asset-warning', { detail: missing }));
    }
  }
}
