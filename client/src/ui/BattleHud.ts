import Phaser from 'phaser';
import type { BattleSim } from '../combat/BattleSim.js';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH } from '@shared/constants/game.js';
import { settings } from '../gameConfig.js';
import { keyLabel } from '../utils/keyLabel.js';

const UI_W = INTERNAL_WIDTH;
const UI_H = INTERNAL_HEIGHT;
const SIDE_WIDTH = 330;
const SLOT_W = 62;
const SLOT_H = 30;
const SLOT_STEP = SLOT_W + 6;
const SLOT_COUNT = 5;

interface SideHud {
  hpFill: Phaser.GameObjects.Rectangle;
  hpGhost: Phaser.GameObjects.Rectangle;
  energyFill: Phaser.GameObjects.Rectangle;
  guardFill: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
  slots: {
    box: Phaser.GameObjects.Rectangle;
    keyText: Phaser.GameObjects.Text;
    slotText: Phaser.GameObjects.Text;
  }[];
}

const SLOT_COLORS = ['0x2a3352', '0x2a3352', '0x2a3352', '0x2a3352', '0x4a2a52'];

export class BattleHud {
  readonly uiObjects: Phaser.GameObjects.GameObject[] = [];
  private readonly sides: [SideHud, SideHud];
  private readonly comboTexts: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly fpsText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, names: [string, string], colors: [number, number]) {
    const input = settings.data.input;
    this.sides = [
      this.buildSide(scene, 18, names[0], colors[0], false, input.p1, input.altP1),
      this.buildSide(scene, UI_W - 18, names[1], colors[1], true, input.p2, input.altP2)
    ];

    this.timerText = scene.add
      .text(UI_W / 2, 40, '99', { fontFamily: 'monospace', fontSize: '30px', color: '#ffffff' })
      .setOrigin(0.5);

    this.comboTexts = [
      scene.add.text(18, 118, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ffd166' }),
      scene.add.text(UI_W - 18, 118, '', { fontFamily: 'monospace', fontSize: '20px', color: '#ffd166' }).setOrigin(1, 0)
    ];

    this.fpsText = scene.add
      .text(UI_W - 18, UI_H - 18, '', { fontFamily: 'monospace', fontSize: '12px', color: '#7ee787' })
      .setOrigin(1, 1);

    for (const side of this.sides) {
      this.setScrollFactor([side.hpFill, side.hpGhost, side.energyFill, side.guardFill, side.name, side.hpText]);
      for (const slot of side.slots) {
        this.setScrollFactor([slot.box, slot.keyText, slot.slotText]);
      }
    }
    this.setScrollFactor([this.timerText, ...this.comboTexts, this.fpsText]);
  }

  private setScrollFactor(items: ReadonlyArray<Phaser.GameObjects.Shape | Phaser.GameObjects.Text>): void {
    for (const item of items) {
      item.setScrollFactor(0).setDepth(1000);
      this.uiObjects.push(item);
    }
  }

  private buildSide(
    scene: Phaser.Scene,
    edge: number,
    name: string,
    color: number,
    fromRight: boolean,
    bindings: Record<string, string>,
    alt: Record<string, string | undefined>
  ): SideHud {
    const x = fromRight ? edge - SIDE_WIDTH : edge;
    const bg = scene.add.rectangle(x, 14, SIDE_WIDTH, 26, 0x0b0e14, 0.85).setOrigin(0, 0);
    const hpGhost = scene.add.rectangle(x + 2, 16, SIDE_WIDTH - 4, 22, 0x7a1f2b).setOrigin(0, 0);
    const hpFill = scene.add.rectangle(x + 2, 16, SIDE_WIDTH - 4, 22, color).setOrigin(0, 0);
    void bg;
    const energyFill = scene.add.rectangle(x, 44, SIDE_WIDTH, 6, 0x00d9ff).setOrigin(0, 0);
    const guardFill = scene.add.rectangle(x, 52, SIDE_WIDTH, 4, 0xa7f070).setOrigin(0, 0);
    const label = scene.add
      .text(fromRight ? edge - 4 : edge, 60, name, { fontFamily: 'monospace', fontSize: '13px', color: '#c7cdf0' })
      .setOrigin(fromRight ? 1 : 0, 0);
    const hpText = scene.add
      .text(fromRight ? edge - 30 : edge + SIDE_WIDTH - 30, 18, '', {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ffffff'
      })
      .setOrigin(fromRight ? 1 : 0, 0);

    const slots: SideHud['slots'] = [];
    for (let i = 0; i < SLOT_COUNT; i++) {
      const slotX = fromRight ? edge - SLOT_W - i * SLOT_STEP : edge + i * SLOT_STEP;
      const box = scene.add
        .rectangle(slotX, 76, SLOT_W, SLOT_H, Number(SLOT_COLORS[i]), 0.55)
        .setOrigin(0, 0)
        .setStrokeStyle(1, 0x3a4568);
      const keyText = scene.add
        .text(slotX + SLOT_W / 2, 84, '', {
          fontFamily: 'monospace',
          fontSize: '14px',
          color: '#e8ecff'
        })
        .setOrigin(0.5, 0);
      const slotText = scene.add
        .text(slotX + SLOT_W / 2, 97, '', { fontFamily: 'monospace', fontSize: '8px', color: '#8a8fb0' })
        .setOrigin(0.5, 0);
      this.uiObjects.push(box, keyText, slotText);
      slots.push({ box, keyText, slotText });
    }

    for (let slot = 1; slot <= SLOT_COUNT; slot++) {
      const action = slot === 5 ? 'ultimate' : (`skill${slot}` as 'skill1' | 'skill2' | 'skill3' | 'skill4');
      const alternate = alt[action];
      const label = alternate && alternate !== bindings[action]
        ? `${keyLabel(bindings[action])}/${keyLabel(alternate)}`
        : keyLabel(bindings[action]);
      const entry = slots[slot - 1]!;
      entry.keyText.setText(label);
      entry.slotText.setText(slot === 5 ? 'ULT' : `S${slot}`);
    }

    return { hpFill, hpGhost: hpGhost, energyFill, guardFill, name: label, hpText, slots };
  }

  sync(sim: BattleSim, fps: number): void {
    const bindingsByPlayer = [settings.data.input.p1, settings.data.input.p2];
    const altsByPlayer = [settings.data.input.altP1, settings.data.input.altP2];
    sim.fighters.forEach((fighter, index) => {
      const side = this.sides[index] as SideHud;
      const fromRight = index === 1;
      const ratio = fighter.hp / fighter.maxHp;
      const targetWidth = (SIDE_WIDTH - 4) * ratio;
      side.hpFill.width = Phaser.Math.Linear(side.hpFill.width, targetWidth, 0.35);
      if (fromRight) side.hpFill.x = UI_W - 18 - 2 - targetWidth;
      else side.hpFill.x = 20;
      side.hpGhost.width = Phaser.Math.Linear(side.hpGhost.width, targetWidth, 0.12);
      if (fromRight) side.hpGhost.x = UI_W - 20 - side.hpGhost.width;
      else side.hpGhost.x = 20;
      side.energyFill.width = SIDE_WIDTH * (fighter.energy / fighter.profile.stats.energy);
      side.guardFill.width = SIDE_WIDTH * (fighter.guardMeter / 100);
      side.hpText.setText(`${Math.ceil(fighter.hp)}`);

      const bindings = bindingsByPlayer[index] as Record<string, string>;
      const alt = altsByPlayer[index] as Record<string, string | undefined>;
      for (let slot = 1; slot <= SLOT_COUNT; slot++) {
        const entry = side.slots[slot - 1]!;
        const skill = fighter.skillBySlot(slot);
        if (!skill) {
          entry.box.setVisible(false);
          entry.keyText.setVisible(false);
          entry.slotText.setVisible(false);
          continue;
        }
        entry.box.setVisible(true);
        entry.keyText.setVisible(true);
        entry.slotText.setVisible(true);
        const action = slot === 5 ? 'ultimate' : (`skill${slot}` as 'skill1' | 'skill2' | 'skill3' | 'skill4');
        const alternate = alt[action];
        const label = alternate && alternate !== bindings[action]
          ? `${keyLabel(bindings[action])}/${keyLabel(alternate)}`
          : keyLabel(bindings[action]);
        entry.keyText.setText(label);
        const cooldown = fighter.cooldowns.get(skill.id) ?? 0;
        const ready = cooldown <= 0 && fighter.energy >= skill.energyCost;
        entry.box.setFillStyle(Number(SLOT_COLORS[slot - 1]), ready ? 0.55 : 0.18);
        entry.keyText.setColor(ready ? '#e8ecff' : '#6d74a3');
        entry.slotText.setText(
          slot === 5 ? `ULT` : cooldown > 0 ? `${cooldown}` : `S${slot}·${skill.energyCost}EN`
        );
      }
    });
    this.timerText.setText(String(Math.max(0, Math.ceil(sim.roundTime))).padStart(2, '0'));
    for (const side of [1, 2] as const) {
      const combo = sim.combo[side];
      const text = this.comboTexts[side - 1];
      if (!combo || !text) continue;
      text.setText(combo.hits > 1 ? `${combo.hits} hits · ${Math.round(combo.damage)}` : '');
    }
    this.fpsText.setText(fps < 0 ? '' : `${Math.round(fps)} fps`);
  }
}
