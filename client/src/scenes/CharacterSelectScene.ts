import Phaser from 'phaser';
import type { CharacterProfile } from '@shared/types/index.js';
import { PRA_DATA_KEY, type LoadedData } from '../core/DataLoader.js';
import { runGuarded } from './crashGuard.js';
import { settings } from '../gameConfig.js';
import { keyLabel } from '../utils/keyLabel.js';
import { wireFullscreenToggle } from '../utils/fullscreen.js';
import { INTERNAL_WIDTH } from '@shared/constants/game.js';
import type { Action } from '@shared/types/input.js';

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
    this.add.rectangle(0, 0, INTERNAL_WIDTH, 44, 0x101527).setOrigin(0);
    this.add.rectangle(0, 40, INTERNAL_WIDTH, 3, 0x00b8d9).setOrigin(0);
    this.heading = this.add
      .text(INTERNAL_WIDTH / 2, 22, 'P1: CHỌN NHÂN VẬT', { fontFamily: 'monospace', fontSize: '20px', color: '#9de1ff' })
      .setOrigin(0.5);

    this.roster.forEach((profile, index) => {
      const x = 60 + index * 150;
      const box = this.add.rectangle(x, 60, 130, 156, 0x1b2036).setOrigin(0).setStrokeStyle(2, 0x2a3352);
      const portrait = this.add.sprite(x + 65, 200, `${profile.id}.idle`, 0).setOrigin(0.5, 1).setScale(2.4);
      if (this.anims.exists(`${profile.id}.idle`)) portrait.play(`${profile.id}.idle`, true);
      const name = this.add
        .text(x + 65, 208, profile.name, { fontFamily: 'monospace', fontSize: '13px', color: '#c7cdf0' })
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
      const y = 250 + i * 20;
      this.add.text(24, y, row.label, { fontFamily: 'monospace', fontSize: '13px', color: '#8a8fb0' });
      this.add.rectangle(84, y + 6, 180, 9, 0x141a2c).setOrigin(0, 0.5);
      this.statBars.push(this.add.rectangle(86, y + 6, 14, 5, 0x2ec4b6).setOrigin(0, 0.5));
    });

    this.skillsText = this.add.text(24, 396, '', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#c7cdf0',
      wordWrap: { width: 390 },
      lineSpacing: 3
    });

    this.add.rectangle(450, 60, 494, 300, 0x101527).setOrigin(0);
    this.preview = this.add.sprite(690, 346, `${this.roster[0]!.id}.idle`, 0).setOrigin(0.5, 1).setScale(4.8);
    this.confirmText = this.add.text(640, 92, '', {
      fontFamily: 'monospace',
      fontSize: '15px',
      color: '#ffd166',
      wordWrap: { width: 290 },
      lineSpacing: 4
    });

    const kb = this.input.keyboard;
    kb?.on('keydown-LEFT', () => this.move(-1));
    kb?.on('keydown-A', () => this.move(-1));
    kb?.on('keydown-RIGHT', () => this.move(1));
    kb?.on('keydown-D', () => this.move(1));
    kb?.on('keydown-ENTER', () => this.confirm());
    kb?.on('keydown-ESC', () => this.scene.start('MainMenu'));
    wireFullscreenToggle(this);
    this.add
      .text(INTERNAL_WIDTH / 2, 512, '← → / A D: chọn · ENTER / click: xác nhận · F: toàn màn hình · ESC: menu', {
        fontFamily: 'monospace',
        fontSize: '15px',
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
      bar.setSize(Math.max(8, Math.round((value / row.max) * 176)), 5);
      bar.setFillStyle(value >= row.max * 0.75 ? 0x2ec4b6 : value >= row.max * 0.45 ? 0xffd166 : 0xc2547a);
    });

    const skills = (profile.skills ?? [])
      .map(
        (s) =>
          (s.slot === 5 ? `[ULT ${this.skillKeys('ultimate', 5)}]` : `[S${s.slot} ${this.skillKeys(`skill${s.slot}` as Action, s.slot)}]`) +
          ` ${s.name} — ${s.energyCost} EN, ${s.cooldown}f CD`
      )
      .join('\n');
    const passive = profile.passives[0];
    if (this.skillsText) {
      this.skillsText.setText(
        [
          '',
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

  private skillKeys(action: Action, slot: number): string {
    const input = settings.data.input;
    const bindings = input.p1;
    const alt = input.altP1;
    const primary = bindings[action];
    const alternate = alt[action];
    const labels = [keyLabel(primary)];
    if (alternate && alternate !== primary) labels.push(keyLabel(alternate));
    return labels.join('/');
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

