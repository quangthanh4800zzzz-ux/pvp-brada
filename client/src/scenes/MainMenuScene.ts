import Phaser from 'phaser';
import { runGuarded } from './crashGuard.js';
import { wireFullscreenToggle } from '../utils/fullscreen.js';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@shared/constants/game.js';

const MENU_ITEMS = [
  { label: 'VS BATTLE', sceneKey: 'CharacterSelect', mode: 'battle' },
  { label: 'VS AI', sceneKey: 'CharacterSelect', mode: 'vsai' },
  { label: 'COMBAT LAB', sceneKey: 'CharacterSelect', mode: 'training' },
  { label: 'SETTINGS', sceneKey: 'Settings', mode: '' },
  { label: 'ONLINE ARENA', sceneKey: '', mode: '' },
  { label: 'CHARACTER COLLECTION', sceneKey: '', mode: '' }
] as const;

export class MainMenuScene extends Phaser.Scene {
  private selected = 0;
  private rows: { label: string; text: Phaser.GameObjects.Text }[] = [];
  private comingSoon: Phaser.GameObjects.Text | null = null;

  constructor() {
    super('MainMenu');
  }

  create(): void {
    runGuarded(this, () => this.buildMenu());
  }

  private buildMenu(): void {
    this.selected = 0;
    this.rows = [];
    this.comingSoon = null;
    this.cameras.main.setBackgroundColor('#141024');
    for (let y = 0; y < 34; y++) {
      for (let x = 0; x < 60; x++) {
        if ((x * 7 + y * 13) % 31 === 0) {
          this.add.rectangle(x * 16, y * 16, 3, 3, 0x2a2344).setOrigin(0);
        }
      }
    }
    this.add.rectangle(0, 0, INTERNAL_WIDTH, 160, 0x0b0e14).setOrigin(0).setAlpha(0.9);
    this.add.rectangle(0, 0, INTERNAL_WIDTH, 3, 0x00b8d9).setOrigin(0);

    const title = this.add.text(INTERNAL_WIDTH / 2, 46, 'PIXEL RIFT ARENA', {
      fontFamily: 'monospace',
      fontSize: '50px',
      color: '#9de1ff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, alpha: { from: 1, to: 0.75 }, duration: 900, yoyo: true, repeat: -1 });
    this.add.text(INTERNAL_WIDTH / 2, 100, 'v0.3 — Phase 3: 2 fighters · skills · ultimate · passive · alt hotkeys', { fontFamily: 'monospace', fontSize: '16px', color: '#6a6f8a' }).setOrigin(0.5);

    MENU_ITEMS.forEach((item, index) => {
      const text = this.add.text(330, 210 + index * 50, item.label, {
        fontFamily: 'monospace',
        fontSize: '26px',
        color: '#c7cdf0'
      });
      text.setInteractive({ useHandCursor: true });
      text.on('pointerover', () => {
        this.selected = index;
        this.refresh();
      });
      text.on('pointerdown', () => {
        this.selected = index;
        this.refresh();
        this.select(item);
      });
      this.rows.push({ label: item.label, text });
    });

    this.add.text(INTERNAL_WIDTH / 2, 450, '↑ ↓ / W S: chọn · ENTER: xác nhận · F: toàn màn hình', { fontFamily: 'monospace', fontSize: '15px', color: '#8a8fb0' }).setOrigin(0.5);
    this.add.text(INTERNAL_WIDTH / 2, 482, 'P1: A/D·Space·J guard·U/I/O attack·Shift dash — Skill: 1-4 HOẶC K L ; [quote] — ULT: H/P — P2: Arrows·Numpad 7-9/0', {
      fontFamily: 'monospace',
      fontSize: '13px',
      color: '#55597a'
    }).setOrigin(0.5);
    this.add.text(INTERNAL_WIDTH / 2, 510, 'Động một mình (VS AI/COMBAT LAB): dùng cả WASD và Arrows · ESC trong trận: về menu', { fontFamily: 'monospace', fontSize: '13px', color: '#55597a' }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-UP', () => this.move(-1));
    this.input.keyboard?.on('keydown-W', () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard?.on('keydown-S', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.select(MENU_ITEMS[this.selected] ?? MENU_ITEMS[0]));
    wireFullscreenToggle(this);
    this.refresh();
  }

  private move(delta: number): void {
    this.selected = Phaser.Math.Wrap(this.selected + delta, 0, MENU_ITEMS.length - 1);
    this.refresh();
  }

  private refresh(): void {
    this.rows.forEach((row, index) => {
      row.text.setColor(index === this.selected ? '#ffffff' : '#6d74a3');
      row.text.setScale(index === this.selected ? 1.08 : 1);
      row.text.setText(index === this.selected ? `> ${row.label}` : row.label);
    });
    const item = MENU_ITEMS[this.selected] ?? MENU_ITEMS[0];
    if (!item.sceneKey) {
      this.comingSoon?.destroy();
      this.comingSoon = this.add.text(700, 210 + this.selected * 50, 'planned (see roadmap)', {
        fontFamily: 'monospace',
        fontSize: '13px',
        color: '#c25f5f'
      });
    } else {
      this.comingSoon?.destroy();
      this.comingSoon = null;
    }
  }

  private select(item: (typeof MENU_ITEMS)[number]): void {
    if (item.sceneKey) this.scene.start(item.sceneKey, { mode: item.mode });
  }
}
