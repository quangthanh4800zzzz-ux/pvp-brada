import Phaser from 'phaser';
import type { BattleSim } from '../combat/BattleSim.js';

interface SideHud {
  hpFill: Phaser.GameObjects.Rectangle;
  hpGhost: Phaser.GameObjects.Rectangle;
  energyFill: Phaser.GameObjects.Rectangle;
  guardFill: Phaser.GameObjects.Rectangle;
  name: Phaser.GameObjects.Text;
  hpText: Phaser.GameObjects.Text;
}

export class BattleHud {
  private readonly sides: [SideHud, SideHud];
  private readonly comboTexts: [Phaser.GameObjects.Text, Phaser.GameObjects.Text];
  private readonly timerText: Phaser.GameObjects.Text;
  private readonly fpsText: Phaser.GameObjects.Text;

  constructor(scene: Phaser.Scene, names: [string, string], colors: [number, number]) {
    this.sides = [
      this.buildSide(scene, 12, names[0], colors[0], false),
      this.buildSide(scene, 628, names[1], colors[1], true)
    ];

    this.timerText = scene.add
      .text(320, 26, '99', { fontFamily: 'monospace', fontSize: '20px', color: '#ffffff' })
      .setOrigin(0.5);

    this.comboTexts = [
      scene.add.text(24, 70, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffd166' }),
      scene.add.text(616, 70, '', { fontFamily: 'monospace', fontSize: '14px', color: '#ffd166' }).setOrigin(1, 0)
    ];

    this.fpsText = scene.add
      .text(628, 344, '', { fontFamily: 'monospace', fontSize: '8px', color: '#7ee787' })
      .setOrigin(1, 1);

    for (const side of this.sides) {
      this.setScrollFactor([side.hpFill, side.hpGhost, side.energyFill, side.guardFill, side.name, side.hpText]);
    }
    this.setScrollFactor([this.timerText, ...this.comboTexts, this.fpsText]);
  }

  private setScrollFactor(items: ReadonlyArray<Phaser.GameObjects.Shape | Phaser.GameObjects.Text>): void {
    for (const item of items) item.setScrollFactor(0).setDepth(1000);
  }

  private buildSide(scene: Phaser.Scene, edge: number, name: string, color: number, fromRight: boolean): SideHud {
    const width = 220;
    const x = fromRight ? edge - width : edge;
    const bg = scene.add.rectangle(x, 10, width, 18, 0x0b0e14, 0.85).setOrigin(0, 0);
    const hpGhost = scene.add.rectangle(x + 1, 11, width - 2, 16, 0x7a1f2b).setOrigin(0, 0);
    const hpFill = scene.add.rectangle(x + 1, 11, width - 2, 16, color).setOrigin(0, 0);
    void bg;
    const energyFill = scene.add.rectangle(x, 30, width, 4, 0x00d9ff).setOrigin(0, 0);
    const guardFill = scene.add.rectangle(x, 36, width, 3, 0xa7f070).setOrigin(0, 0);
    const label = scene.add
      .text(fromRight ? edge - 30 : edge + 4, 50, name, { fontFamily: 'monospace', fontSize: '9px', color: '#c7cdf0' })
      .setOrigin(fromRight ? 1 : 0, 0);
    const hpText = scene.add
      .text(fromRight ? edge - 4 : edge + width - 4, 12, '', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#ffffff'
      })
      .setOrigin(fromRight ? 1 : 0, 0);
    return { hpFill, hpGhost: hpGhost, energyFill, guardFill, name: label, hpText };
  }

  sync(sim: BattleSim, fps: number): void {
    sim.fighters.forEach((fighter, index) => {
      const side = this.sides[index] as SideHud;
      const fromRight = index === 1;
      const ratio = fighter.hp / fighter.maxHp;
      const targetWidth = 218 * ratio;
      side.hpFill.width = Phaser.Math.Linear(side.hpFill.width, targetWidth, 0.35);
      if (fromRight) side.hpFill.x = 627 - targetWidth;
      else side.hpFill.x = 13;
      side.hpGhost.width = Phaser.Math.Linear(side.hpGhost.width, targetWidth, 0.12);
      if (fromRight) side.hpGhost.x = 627 - side.hpGhost.width;
      else side.hpGhost.x = 13;
      side.energyFill.width = 220 * (fighter.energy / fighter.profile.stats.energy);
      side.guardFill.width = 220 * (fighter.guardMeter / 100);
      side.hpText.setText(`${Math.ceil(fighter.hp)}`);
    });
    this.timerText.setText(String(Math.max(0, Math.ceil(sim.roundTime))).padStart(2, '0'));
    for (const side of [1, 2] as const) {
      const combo = sim.combo[side];
      const text = this.comboTexts[side - 1];
      if (!combo || !text) continue;
      text.setText(combo.hits > 1 ? `${combo.hits} hits · ${Math.round(combo.damage)}` : '');
    }
    this.fpsText.setText(`${Math.round(fps)} fps`);
  }
}
