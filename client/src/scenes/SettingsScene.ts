import Phaser from 'phaser';
import { settings } from '../gameConfig.js';
import { runGuarded } from './crashGuard.js';
import { ACTIONS, type Action, type KeyBindings, type PartialBindings } from '@shared/types/input.js';
import { wireFullscreenToggle, toggleFullscreen } from '../utils/fullscreen.js';

const REBINDABLE_CORE: Action[] = [
  'moveLeft',
  'moveRight',
  'up',
  'down',
  'jump',
  'dash',
  'guard',
  'light',
  'medium',
  'heavy',
  'interact'
];

const REBINDABLE_SKILLS: Action[] = ['skill1', 'skill2', 'skill3', 'skill4', 'ultimate'];

/**
 * Functional settings screen: hotkey rebinding (primary + alt skill cluster)
 * with conflict detection, graphics toggles that actually change rendering,
 * layer volumes.
 */
export class SettingsScene extends Phaser.Scene {
  private panelY = 74;
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
    this.add.text(24, 12, 'SETTINGS', { fontFamily: 'monospace', fontSize: '28px', color: '#9de1ff' });

    this.add
      .text(740, 22, 'F: toggle fullscreen', { fontFamily: 'monospace', fontSize: '13px', color: '#8a8fb0' });
    wireFullscreenToggle(this);

    const g = settings.data.graphics;
    this.toggle(24, this.panelY, `Pixel scaling: ${g.pixelScaling} (restart game to apply)`, () => {
      g.pixelScaling = g.pixelScaling === 'nearest' ? 'linear' : 'nearest';
    });
    this.toggle(24, this.panelY + 38, `FPS display: ${g.showFps ? 'on' : 'off'}`, () => {
      g.showFps = !g.showFps;
    });
    this.toggle(24, this.panelY + 76, `Hitbox debug: ${g.showHitboxes ? 'on' : 'off'}`, () => {
      g.showHitboxes = !g.showHitboxes;
    });
    this.toggle(24, this.panelY + 106, `Parallax: ${g.parallax ? 'on' : 'off'}`, () => {
      g.parallax = !g.parallax;
    });
    const shakeLabel = (): string => `Screen shake: ${Math.round(g.screenShake * 100)}%`;
    this.slider(360, this.panelY + 106, shakeLabel, () => {
      g.screenShake = Math.round(((g.screenShake + 0.2) % 1.01) * 100) / 100;
    });

    const audio = settings.data.audio;
    const masterLabel = (): string => `Master volume: ${Math.round(audio.master * 100)}%`;
    const sfxLabel = (): string => `SFX volume: ${Math.round(audio.sfx * 100)}%`;
    const uiLabel = (): string => `UI volume: ${Math.round(audio.ui * 100)}%`;
    this.slider(24, this.panelY + 140, masterLabel, () => {
      audio.master = Math.round(((audio.master + 0.1) % 1.01) * 10) / 10;
    });
    this.slider(360, this.panelY + 140, sfxLabel, () => {
      audio.sfx = Math.round(((audio.sfx + 0.1) % 1.01) * 10) / 10;
    });
    this.slider(660, this.panelY + 140, uiLabel, () => {
      audio.ui = Math.round(((audio.ui + 0.1) % 1.01) * 10) / 10;
    });

    const diff = settings.data.ai;
    this.toggle(24, this.panelY + 174, `Bot difficulty: ${diff.difficulty}`, () => {
      const order = ['beginner', 'easy', 'normal', 'hard', 'expert'] as const;
      const next = order[(order.indexOf(diff.difficulty) + 1) % order.length] as typeof diff.difficulty;
      diff.difficulty = next;
    });

    this.add.text(24, this.panelY + 210, 'HOTKEYS (P1) — click a label, then press a key', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#c7cdf0'
    });
    REBINDABLE_CORE.forEach((action, index) => {
      const x = 24 + (index % 4) * 240;
      const y = this.panelY + 238 + Math.floor(index / 4) * 28;
      this.rebindRow(x, y, action);
    });
    REBINDABLE_SKILLS.forEach((action, index) => {
      this.rebindRow(24 + index * 240, this.panelY + 322, action);
    });

    this.add.text(24, this.panelY + 358, 'ALT SKILL KEYS (P1) — thêm bộ phím cho Skill 1-4 / Ultimate', {
      fontFamily: 'monospace',
      fontSize: '16px',
      color: '#00b8d9'
    });
    REBINDABLE_SKILLS.forEach((action, index) => {
      this.altRebindRow(24 + index * 190, this.panelY + 386, action);
    });

    this.add.text(480, this.panelY + 424, 'R: reset defaults · ESC: back to menu (lưu tự động)', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#55597a'
    }).setOrigin(0.5, 0);

    this.input.keyboard?.on('keydown-ESC', () => {
      settings.save();
      this.scene.start('MainMenu');
    });
    this.input.keyboard?.on('keydown-R', () => {
      settings.resetSection('input');
      settings.resetSection('graphics');
      settings.resetSection('audio');
      settings.resetSection('ai');
      this.scene.restart();
    });
  }

  private toggle(x: number, y: number, label: string, onClick: () => void): void {
    const text = this.add.text(x, y, `[${label}]`, { fontFamily: 'monospace', fontSize: '15px', color: '#c7cdf0' });
    text.setInteractive({ useHandCursor: true });
    text.on('pointerdown', () => {
      onClick();
      settings.save();
      this.scene.restart();
    });
  }

  private slider(x: number, y: number, label: string | (() => string), onClick: () => void): void {
    const read = (): string => (typeof label === 'function' ? label() : label);
    const text = this.add.text(x, y, `(${read()})`, { fontFamily: 'monospace', fontSize: '15px', color: '#8fd0c0' });
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
      fontSize: '14px',
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
  }

  private altRebindRow(x: number, y: number, action: Action): void {
    const alt = settings.data.input.altP1 as PartialBindings;
    const keyText = alt[action] ?? '—';
    const text = this.add.text(x, y, `${actionLabel(action)}: ${keyText}`, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#00d9ff'
    });
    text.setInteractive({ useHandCursor: true });
    text.on('pointerdown', () => {
      text.setText(`${actionLabel(action)}: press key…`);
      const handler = (event: KeyboardEvent): void => {
        this.input.keyboard?.off('keydown', handler);
        event.preventDefault();
        const conflicts = settings.rebindAlt('p1', action, event.code);
        this.setStatus(
          conflicts.length === 0
            ? `alt ${action} -> ${event.code}`
            : `CONFLICT: ${event.code} used by ${(conflicts[0]?.actions.map(actionLabel) ?? []).join(', ')}`
        );
        settings.save();
        this.scene.restart();
      };
      this.input.keyboard?.once('keydown', handler);
      this.input.keyboard?.once('keydown-ESC', () => {
        settings.save();
        this.scene.restart();
      });
    });
  }

  private setStatus(message: string): void {
    if (!this.status) {
      this.status = this.add.text(24, this.panelY + 452, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffd166' });
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
