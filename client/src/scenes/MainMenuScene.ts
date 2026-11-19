import Phaser from 'phaser';
import { runGuarded } from './crashGuard.js';

const MENU_ITEMS = [
  { label: 'VS BATTLE', sceneKey: 'Battle', mode: 'battle' },
  { label: 'COMBAT LAB', sceneKey: 'Training', mode: 'training' },
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
    for (let y = 0; y < 24; y++) {
      for (let x = 0; x < 40; x++) {
        if ((x * 7 + y * 13) % 31 === 0) {
          this.add.rectangle(x * 16, y * 16, 2, 2, 0x2a2344).setOrigin(0);
        }
      }
    }
    this.add.rectangle(0, 0, 640, 110, 0x0b0e14).setOrigin(0).setAlpha(0.9);
    this.add.rectangle(0, 0, 640, 2, 0x00b8d9).setOrigin(0);

    const title = this.add.text(320, 30, 'PIXEL RIFT ARENA', {
      fontFamily: 'monospace',
      fontSize: '34px',
      color: '#9de1ff',
      fontStyle: 'bold'
    }).setOrigin(0.5);
    this.tweens.add({ targets: title, alpha: { from: 1, to: 0.75 }, duration: 900, yoyo: true, repeat: -1 });
    this.add.text(320, 66, 'v0.1 — core build (Phase 1 + 2)', { fontFamily: 'monospace', fontSize: '11px', color: '#6a6f8a' }).setOrigin(0.5);

    MENU_ITEMS.forEach((item, index) => {
      const text = this.add.text(220, 140 + index * 34, item.label, {
        fontFamily: 'monospace',
        fontSize: '18px',
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

    this.add.text(320, 300, '↑ ↓ / W S: chọn · ENTER: xác nhận', { fontFamily: 'monospace', fontSize: '10px', color: '#8a8fb0' }).setOrigin(0.5);
    this.add.text(320, 322, 'P1: A/D·Space·J guard·U/I/O attack·Shift dash — P2: Arrows·Numpad', {
      fontFamily: 'monospace',
      fontSize: '9px',
      color: '#55597a'
    }).setOrigin(0.5);
    this.add.text(320, 344, 'ESC trong trận: về menu', { fontFamily: 'monospace', fontSize: '9px', color: '#55597a' }).setOrigin(0.5);

    this.input.keyboard?.on('keydown-UP', () => this.move(-1));
    this.input.keyboard?.on('keydown-W', () => this.move(-1));
    this.input.keyboard?.on('keydown-DOWN', () => this.move(1));
    this.input.keyboard?.on('keydown-S', () => this.move(1));
    this.input.keyboard?.on('keydown-ENTER', () => this.select(MENU_ITEMS[this.selected] ?? MENU_ITEMS[0]));
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
      this.comingSoon = this.add.text(220 + 260, 140 + this.selected * 34, 'planned (see roadmap)', {
        fontFamily: 'monospace',
        fontSize: '9px',
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
