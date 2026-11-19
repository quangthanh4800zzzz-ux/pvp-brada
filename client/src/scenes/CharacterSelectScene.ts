import Phaser from 'phaser';
import type { CharacterProfile } from '@shared/types/index.js';
import { PRA_DATA_KEY, type LoadedData } from '../core/DataLoader.js';
import { runGuarded } from './crashGuard.js';

type SelectMode = 'battle' | 'vsai' | 'training';

const STAT_ROWS: { label: string; key: 'hp' | 'atk' | 'def' | 'spd' | 'jump' | 'range'; max: number }[] = [
  { label: 'HP', key: 'hp', max: 1200 },
  { label: 'ATK', key: 'atk', max: 130 },
  { label: 'DEF', key: 'def', max: 130 },
  { label: 'SPD', key: 'spd', max: 140 },
  { label: 'JUMP', key: 'jump', max: 140 },
  { label: 'RANGE', key: 'range', max: 120 }
];

/**
 * Character Select: roster grid, animated preview, stats bars, skill/passive
 * preview. Confirms into Battle with { mode, char1, char2 }.
 */
export class CharacterSelectScene extends Phaser.Scene {
  private mode: SelectMode = 'battle';
  private roster: CharacterProfile[] = [];
  private cursor = 0;
  private picking: 1 | 2 = 1;
  private char1: string | null = null;
  private cardBoxes: Phaser.GameObjects.Rectangle[] = [];
  private nameTexts: Phaser.GameObjects.Text[] = [];
  private statBars: Phaser.GameObjects.Rectangle[] = [];
  private skillsText: Phaser.GameObjects.Text | null = null;
  private heading: Phaser.GameObjects.Text | null = null;
  private confirmText: Phaser.GameObjects.Text | null = null;
  private preview: Phaser.GameObjects.Sprite | null = null;

  constructor() {
    super('CharacterSelect');
  }

  create(data: { mode?: string }): void {
    runGuarded(this, () => this.build(data ?? {}));
  }

  private build(data: { mode?: string }): void {
    this.mode = (data.mode as SelectMode) || 'battle';
    this.cursor = 0;
    this.picking = 1;
    this.char1 = null;
    this.cardBoxes = [];
    this.nameTexts = [];
    this.statBars = [];

    const loaded = this.registry.get(PRA_DATA_KEY) as LoadedData;
    this.roster = Object.values(loaded.characters);
    if (this.roster.length === 0) throw new Error('empty roster');

    this.cameras.main.setBackgroundColor('#0b0e14');
    this.add.rectangle(0, 0, 640, 30, 0x101527).setOrigin(0);
    this.add.rectangle(0, 28, 640, 2, 0x00b8d9).setOrigin(0);
    this.heading = this.add
      .text(320, 15, 'P1: CHỌN NHÂN VẬT', { fontFamily: 'monospace', fontSize: '14px', color: '#9de1ff' })
      .setOrigin(0.5);

    this.roster.forEach((profile, index) => {
      const x = 40 + index * 96;
      const box = this.add.rectangle(x, 44, 86, 100, 0x1b2036).setOrigin(0).setStrokeStyle(2, 0x2a3352);
      const portrait = this.add.sprite(x + 43, 138, `${profile.id}.idle`, 0).setOrigin(0.5, 1).setScale(1.5);
      if (this.anims.exists(`${profile.id}.idle`)) portrait.play(`${profile.id}.idle`, true);
      const name = this.add
        .text(x + 43, 150, profile.name, { fontFamily: 'monospace', fontSize: '9px', color: '#c7cdf0' })
        .setOrigin(0.5, 0);
      box.setInteractive({ useHandCursor: true });
      box.on('pointerover', () => {
        this.cursor = index;
        this.refresh();
      });
      box.on('pointerdown', () => {
        this.cursor = index;
        this.refresh();
        this.confirm();
      });
      this.cardBoxes.push(box);
      this.nameTexts.push(name);
    });

    STAT_ROWS.forEach((row, i) => {
      const y = 170 + i * 14;
      this.add.text(16, y, row.label, { fontFamily: 'monospace', fontSize: '9px', color: '#8a8fb0' });
      this.add.rectangle(56, y + 4, 120, 6, 0x141a2c).setOrigin(0, 0.5);
      this.statBars.push(this.add.rectangle(57, y + 4, 10, 4, 0x2ec4b6).setOrigin(0, 0.5));
    });

    this.skillsText = this.add.text(16, 258, '', {
      fontFamily: 'monospace',
      fontSize: '8px',
      color: '#c7cdf0',
      wordWrap: { width: 250 },
      lineSpacing: 2
    });

    this.add.rectangle(290, 44, 334, 188, 0x101527).setOrigin(0);
    this.preview = this.add.sprite(335, 225, `${this.roster[0]!.id}.idle`, 0).setOrigin(0.5, 1).setScale(3.2);
    this.confirmText = this.add.text(420, 60, '', {
      fontFamily: 'monospace',
      fontSize: '10px',
      color: '#ffd166',
      wordWrap: { width: 190 },
      lineSpacing: 3
    });

    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.move(-1));
    kb?.on('keydown-A', () => this.move(-1));
    kb?.on('keydown-RIGHT', () => this.move(1));
    kb?.on('keydown-D', () => this.move(1));
    kb?.on('keydown-ENTER', () => this.confirm());
    kb?.on('keydown-ESC', () => this.scene.start('MainMenu'));
    this.add
      .text(320, 340, '← → / A D: chọn · ENTER / click: xác nhận · ESC: menu', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#8a8fb0'
      })
      .setOrigin(0.5);
    this.refresh();
  }

  private move(delta: number): void {
    this.cursor = Phaser.Math.Wrap(this.cursor + delta, 0, this.roster.length - 1);
    this.refresh();
  }

  private refresh(): void {
    const profile = this.roster[this.cursor];
    if (!profile) return;
    this.cardBoxes.forEach((box, index) => {
      const active = index === this.cursor;
      box.setFillStyle(active ? 0x25406a : 0x1b2036);
      box.setStrokeStyle(2, active ? 0x00b8d9 : 0x2a3352);
      this.nameTexts[index]?.setColor(active ? '#ffffff' : '#6d74a3');
    });

    if (this.preview) {
      const key = `${profile.id}.idle`;
      if (this.anims.exists(key) && this.preview.anims.currentAnim?.key !== key) {
        this.preview.play(key, true);
      }
    }

    STAT_ROWS.forEach((row, i) => {
      const bar = this.statBars[i];
      if (!bar) return;
      const value = profile.stats[row.key];
      bar.setSize(Math.max(6, Math.round((value / row.max) * 118)), 4);
      bar.setFillStyle(value >= row.max * 0.75 ? 0x2ec4b6 : value >= row.max * 0.45 ? 0xffd166 : 0xc2547a);
    });

    const skills = (profile.skills ?? [])
      .map((s) => (s.slot === 5 ? '[ULT]' : `[S${s.slot}]`) + ` ${s.name} — ${s.energyCost} EN, ${s.cooldown}f CD`)
      .join('\n');
    const passive = profile.passives[0];
    if (this.skillsText) {
      this.skillsText.setText(
        [
          'SKILLS: S1 S2 S3 S4 · ULT phím H',
          skills || '(chưa có skill)',
          '',
          `PASSIVE — ${passive ? passive.name : 'none'}: ${passive ? passive.description : ''}`
        ].join('\n')
      );
    }

    if (this.heading) {
      this.heading.setText(
        this.mode === 'training'
          ? 'COMBAT LAB — CHỌN FIGHTER'
          : this.picking === 1
            ? 'P1: CHỌN NHÂN VẬT'
            : 'P2: CHỌN NHÂN VẬT (Arrows)'
      );
    }
    if (this.confirmText) {
      const confirmHint =
        this.mode === 'training'
          ? 'ENTER: vào Combat Lab'
          : this.mode === 'vsai'
            ? 'ENTER: đấu bot'
            : this.picking === 1
              ? 'ENTER: sang P2 chọn'
              : 'ENTER: VÀO TRẬN';
      this.confirmText.setText(`${profile.name}\n${profile.archetype} · khó ${profile.difficulty}/5\n\n${confirmHint}\n\nESC: menu`);
    }
  }

  private confirm(): void {
    const chosen = this.roster[this.cursor]?.id;
    if (!chosen) return;
    if (this.mode === 'battle' && this.picking === 1) {
      this.char1 = chosen;
      this.picking = 2;
      this.cursor = 0;
      this.refresh();
      return;
    }
    this.scene.start(this.mode === 'training' ? 'Training' : 'Battle', {
      mode: this.mode,
      char1: this.char1 ?? chosen,
      char2: chosen
    });
  }
}
