import Phaser from 'phaser';
import { emptyIntent, type Intent } from '@shared/types/input.js';
import { TICK_RATE } from '@shared/constants/game.js';
import { PRA_DATA_KEY, type LoadedData } from '../core/DataLoader.js';
import { FixedTimestepLoop } from '../core/FixedTimestepLoop.js';
import { BattleSim, type CombatEvent } from '../combat/BattleSim.js';
import { FighterAnimator } from '../animation/FighterAnimator.js';
import { FxLayer } from '../ui/FxLayer.js';
import { BattleHud } from '../ui/BattleHud.js';
import { MapRenderer } from './MapRenderer.js';
import { InputSystem, ManualKeySource } from '../systems/InputSystem.js';
import { settings } from '../gameConfig.js';

/**
 * Local battle scene: drives BattleSim (60Hz fixed timestep) from Phaser.
 * P1 + P2 both keyboard. In training mode P2 is a passive dummy.
 */
export class BattleScene extends Phaser.Scene {
  private sim!: BattleSim;
  private animators: FighterAnimator[] = [];
  private mapRenderer!: MapRenderer;
  private fx!: FxLayer;
  private hud!: BattleHud;
  private inputSystem = new InputSystem();
  private source1!: ManualKeySource;
  private source2!: ManualKeySource;
  private training = false;
  private fps = 60;
  private fpsCounter = 0;
  private fpsTimer = 0;
  private resultText: Phaser.GameObjects.Text | null = null;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private frameDataText!: Phaser.GameObjects.Text;
  private roundEndCooldown = 0;
  private loop!: FixedTimestepLoop;
  private crashed = false;

  constructor() {
    super('Battle');
  }

  create(data: { mode?: string }): void {
    this.training = data?.mode === 'training';
    const loaded = this.registry.get(PRA_DATA_KEY) as LoadedData;
    const map = loaded.maps['map_01']!;
    const profile = loaded.characters['fighter_001']!;

    this.sim = new BattleSim(map, [profile, profile]);
    if (this.training) this.sim.trainingMode = true;

    this.cameras.main.setBackgroundColor('#0b0e14');
    this.mapRenderer = new MapRenderer(this, map, this.sim.physics, { parallax: settings.data.graphics.parallax });
    this.mapRenderer.syncMovers(this.sim.physics);

    this.fx = new FxLayer(this);
    this.debugGfx = this.add.graphics().setDepth(900);

    const tints = [0xffffff, 0x9de1ff] as const;
    const starts = [map.spawn1.x, map.spawn2.x] as const;
    this.animators = this.sim.fighters.map((fighter, i) =>
      new FighterAnimator(this, 'fighter_001', fighter, starts[i] as number, fighter.body.bottom, tints[i] as number)
    );

    this.hud = new BattleHud(
      this,
      [`${profile.name} · P1`, this.training ? 'DUMMY' : `${profile.name} · P2`],
      [0x2ec4b6, 0xc2547a]
    );

    this.frameDataText = this.add
      .text(12, 320, '', { fontFamily: 'monospace', fontSize: '8px', color: '#9de1ff' })
      .setScrollFactor(0)
      .setDepth(1001);

    this.cameras.main.setBounds(0, 0, map.bounds.width, map.bounds.height);

    this.source1 = new ManualKeySource();
    this.source2 = new ManualKeySource();
    this.wireKeyboard();
    this.loop = new FixedTimestepLoop({ tickRate: TICK_RATE, update: () => this.stepSim() });
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MainMenu'));
  }

  private stepSim(): void {
    const intent1 = this.inputSystem.poll(settings.data.input.p1, this.source1.snapshot());
    const intent2: Intent = this.training ? emptyIntent() : this.inputSystem.poll(settings.data.input.p2, this.source2.snapshot());
    const events = this.sim.step([intent1, intent2]);
    this.handleEvents(events);
  }

  private wireKeyboard(): void {
    const players: [ManualKeySource, Record<string, string>][] = [
      [this.source1, settings.data.input.p1],
      [this.source2, settings.data.input.p2]
    ];
    for (const [source, bindings] of players) {
      for (const code of Object.values(bindings)) {
        if (!code || code === 'Escape' || code === 'Tab') continue;
        this.input.keyboard?.on(`keydown-${code}`, () => source.press(code));
        this.input.keyboard?.on(`keyup-${code}`, () => source.release(code));
      }
    }
  }

  update(_time: number, delta: number): void {
    this.fpsTimer += delta;
    this.fpsCounter++;
    if (this.fpsTimer >= 500) {
      this.fps = (this.fpsCounter * 1000) / this.fpsTimer;
      this.fpsCounter = 0;
      this.fpsTimer = 0;
    }

    if (!this.crashed) {
      try {
        this.loop.advance(delta);
      } catch (error) {
        this.crashed = true;
        this.showFatalError(error as Error);
      }
    }

    this.sim.fighters.forEach((fighter, i) => this.animators[i]?.sync('fighter_001'));
    this.mapRenderer.syncMovers(this.sim.physics);
    this.cameraWork();
    this.hud.sync(this.sim, settings.data.graphics.showFps ? this.fps : -1);
    this.frameDataText.setText(this.frameDataLine(this.training));
    this.drawDebug();

    if (this.roundEndCooldown > 0) {
      this.roundEndCooldown--;
      if (this.roundEndCooldown === 0) this.restartRound();
    }
  }

  private showFatalError(error: Error): void {
    this.resultText?.destroy();
    this.resultText = this.add
      .text(320, 150, `RUNTIME ERROR\n${error.message}\n\nESC: menu`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#ff8a8a',
        align: 'center',
        wordWrap: { width: 500 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1200);
  }

  private frameDataLine(training: boolean): string {
    if (!training) return 'ESC: menu';
    const a = this.sim.fighters[0];
    const attack = a.attack;
    const attackInfo = attack
      ? `${attack.id} frame ${a.stateFrame}/${a.attackTotalFrames} ${attack.frames.startup}/${attack.frames.active}/${attack.frames.recovery}`
      : 'no attack';
    return (
      `state=${a.state} frame=${a.stateFrame} ${attackInfo} | ` +
      `pos=${Math.round(a.body.x)},${Math.round(a.body.y)} vel=${Math.round(a.body.vx)},${Math.round(a.body.vy)} | ` +
      `hp=${Math.round(a.hp)} en=${Math.round(a.energy)} cd=${a.dashCooldown} | ESC menu`
    );
  }

  private handleEvents(events: CombatEvent[]): void {
    for (const event of events) {
      if (event.type === 'roundEnd') {
        this.roundEndCooldown = 150;
        this.resultText?.destroy();
        this.resultText = this.add
          .text(320, 160, event.winner === null ? 'DRAW' : `ROUND WIN: P${event.winner}`, {
            fontFamily: 'monospace',
            fontSize: '20px',
            color: '#ffd166'
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(1100);
      }
      if (event.type === 'hit') {
        const shake = settings.data.graphics.screenShake;
        if (shake > 0 && !event.blocked) {
          const strength = 0.001 * event.hitstop * shake * (event.attackId === 'heavy' ? 2 : 1);
          this.cameras.main.shake(80, strength);
        }
      }
    }
    this.fx.handle(
      events,
      this.sim.fighters.map((fighter) => ({ x: fighter.body.centerX, y: fighter.body.bottom - 16 }))
    );
  }

  private cameraWork(): void {
    const [a, b] = this.sim.fighters;
    const focusX = (a.body.centerX + b.body.centerX) / 2;
    const focusY = Math.min(a.body.centerY, b.body.centerY) - 40;
    const cam = this.cameras.main;
    const targetY = Math.max(180, Math.min(240, focusY));
    cam.centerOn(
      Phaser.Math.Linear(cam.midPoint.x, focusX, 0.12),
      Phaser.Math.Linear(cam.midPoint.y, targetY, 0.08)
    );
  }

  private drawDebug(): void {
    this.debugGfx.clear();
    if (!settings.data.graphics.showHitboxes) {
      this.sim.debugSpawns = [];
      return;
    }
    for (const sample of this.sim.debugSpawns.slice(-30)) {
      this.debugGfx.fillStyle(sample.kind === 'hit' ? 0xff3333 : 0x33aaff, 0.4);
      this.debugGfx.fillRect(sample.box.x, sample.box.y, sample.box.width, sample.box.height);
    }
    this.sim.debugSpawns = [];
  }

  private restartRound(): void {
    this.resultText?.destroy();
    this.resultText = null;
    this.sim.nextRound();
  }
}
