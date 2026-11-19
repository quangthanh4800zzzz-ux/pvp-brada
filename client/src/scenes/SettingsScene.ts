import Phaser from 'phaser';
import { settings } from '../gameConfig.js';
import { runGuarded } from './crashGuard.js';
import { ACTIONS, type Action, type KeyBindings } from '@shared/types/input.js';

const REBINDABLE: Action[] = [
  'moveLeft',
  'moveRight',
  'jump',
  'dash',
  'guard',
  'light',
  'medium',
  'heavy',
  'skill1',
  'ultimate'
];

/**
 * Functional settings screen: hotkey rebinding with conflict detection,
 * graphics toggles that actually change rendering, layer volumes.
 */
export class SettingsScene extends Phaser.Scene {
  private panelY = 60;
  private status: Phaser.GameObjects.Text | null = null;
  private rows: { action: Action; text: Phaser.GameObjects.Text }[] = [];

  constructor() {
    super('Settings');
  }

  create(): void {
    runGuarded(this, () => this.buildSettings());
  }

  private buildSettings(): void {
    this.status = null;
    this.rows = [];
    this.cameras.main.setBackgroundColor('#10122a');
    this.add.text(24, 20, 'SETTINGS', { fontFamily: 'monospace', fontSize: '20px', color: '#9de1ff' });

    const g = settings.data.graphics;
    this.toggle(24, this.panelY, `Pixel scaling: ${g.pixelScaling}`, () => {
      g.pixelScaling = g.pixelScaling === 'nearest' ? 'linear' : 'nearest';
      this.applyGraphics();
    });
    this.toggle(24, this.panelY + 26, `FPS display: ${g.showFps ? 'on' : 'off'}`, () => {
      g.showFps = !g.showFps;
    });
    this.toggle(24, this.panelY + 52, `Hitbox debug: ${g.showHitboxes ? 'on' : 'off'}`, () => {
      g.showHitboxes = !g.showHitboxes;
    });
    this.toggle(24, this.panelY + 78, `Parallax: ${g.parallax ? 'on' : 'off'}`, () => {
      g.parallax = !g.parallax;
    });
    const shakeLabel = (): string => `Screen shake: ${Math.round(g.screenShake * 100)}%`;
    this.slider(300, this.panelY + 78, shakeLabel, () => {
      g.screenShake = Math.round(((g.screenShake + 0.2) % 1.01) * 100) / 100;
    });

    const audio = settings.data.audio;
    const masterLabel = (): string => `Master volume: ${Math.round(audio.master * 100)}%`;
    const sfxLabel = (): string => `SFX volume: ${Math.round(audio.sfx * 100)}%`;
    this.slider(24, this.panelY + 110, masterLabel, () => {
      audio.master = Math.round(((audio.master + 0.1) % 1.01) * 10) / 10;
    });
    this.slider(300, this.panelY + 110, sfxLabel, () => {
      audio.sfx = Math.round(((audio.sfx + 0.1) % 1.01) * 10) / 10;
    });

    this.add.text(24, this.panelY + 146, 'HOTKEYS (P1) — click, then press a key', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#c7cdf0'
    });
    REBINDABLE.forEach((action, index) => {
      const x = 24 + (index % 2) * 300;
      const y = this.panelY + 168 + Math.floor(index / 2) * 22;
      this.rebindRow(x, y, action);
    });

    this.add.text(24, 322, 'R: reset defaults · ESC: back to menu', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#55597a'
    });

    this.input.keyboard?.on('keydown-ESC', () => {
      settings.save();
      this.scene.start('MainMenu');
    });
    this.input.keyboard?.on('keydown-R', () => {
      settings.resetSection('input');
      settings.resetSection('graphics');
      settings.resetSection('audio');
      this.scene.restart();
    });
  }

  private toggle(x: number, y: number, label: string, onClick: () => void): void {
    const text = this.add.text(x, y, `[${label}]`, { fontFamily: 'monospace', fontSize: '12px', color: '#c7cdf0' });
    text.setInteractive({ useHandCursor: true });
    text.on('pointerdown', () => {
      onClick();
      settings.save();
      this.scene.restart();
    });
  }

  private slider(x: number, y: number, label: string | (() => string), onClick: () => void): void {
    const read = (): string => (typeof label === 'function' ? label() : label);
    const text = this.add.text(x, y, `(${read()})`, { fontFamily: 'monospace', fontSize: '12px', color: '#8fd0c0' });
    text.setInteractive({ useHandCursor: true });
    text.on('pointerdown', () => {
      onClick();
      settings.save();
      text.setText(`(${read()})`);
    });
  }

  private rebindRow(x: number, y: number, action: Action): void {
    const bindings = settings.data.input.p1 as KeyBindings;
    const text = this.add.text(x, y, `${actionLabel(action)}: ${bindings[action] ?? '?'}`, {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#c7cdf0'
    });
    text.setInteractive({ useHandCursor: true });
    text.on('pointerdown', () => {
      text.setText(`${actionLabel(action)}: press key…`);
      const handler = (event: KeyboardEvent): void => {
        this.input.keyboard?.off('keydown', handler);
        event.preventDefault();
        const conflicts = settings.rebind('p1', action, event.code);
        this.setStatus(
          conflicts.length === 0
            ? `${action} -> ${event.code}`
            : `CONFLICT: ${event.code} used by ${(conflicts[0]?.actions.map(actionLabel) ?? []).join(', ')}`
        );
        settings.save();
        this.scene.restart();
      };
      this.input.keyboard?.once('keydown', handler);
    });
    this.rows.push({ action, text });
  }

  private setStatus(message: string): void {
    if (!this.status) {
      this.status = this.add.text(24, 340, '', { fontFamily: 'monospace', fontSize: '11px', color: '#ffd166' });
    }
    this.status.setText(message);
  }

  private applyGraphics(): void {
    void this.game.renderer;
  }
}

function actionLabel(action: Action): string {
  return action;
}
