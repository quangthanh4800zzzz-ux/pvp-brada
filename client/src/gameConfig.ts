import Phaser from 'phaser';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@shared/constants/game.js';
import { SettingsSystem } from './systems/SettingsSystem.js';

export const settings = new SettingsSystem();

export function createGame(parent: HTMLElement): Phaser.Game {
  const scaleMode = Phaser.Scale.RESIZE;
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    width: INTERNAL_WIDTH,
    height: INTERNAL_HEIGHT,
    pixelArt: settings.data.graphics.pixelScaling === 'nearest',
    roundPixels: true,
    scale: {
      mode: scaleMode,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    backgroundColor: '#0b0e14',
    scene: []
  });
}
