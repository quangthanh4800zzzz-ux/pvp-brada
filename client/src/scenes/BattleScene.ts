import Phaser from 'phaser';
import { emptyIntent, type Intent } from '@shared/types/input.js';
import { INTERNAL_HEIGHT, INTERNAL_WIDTH, TICK_RATE } from '@shared/constants/game.js';
import { toggleFullscreen, wireFullscreenToggle } from '../utils/fullscreen.js';
import { PRA_DATA_KEY, type LoadedData } from '../core/DataLoader.js';
import { FixedTimestepLoop } from '../core/FixedTimestepLoop.js';
import { BattleSim, type CombatEvent } from '../combat/BattleSim.js';
import { FighterAnimator } from '../animation/FighterAnimator.js';
import { FxLayer } from '../ui/FxLayer.js';
import { ProjectileLayer } from '../ui/ProjectileLayer.js';
import { BattleHud } from '../ui/BattleHud.js';
import { MapRenderer } from './MapRenderer.js';
import { InputSystem, ManualKeySource, BLOCK_DEFAULT } from '../systems/InputSystem.js';
import { BotController } from '../ai/BotController.js';
import { settings } from '../gameConfig.js';

/**
 * Local battle scene: drives BattleSim (60Hz fixed timestep) from Phaser.
 * Modes: battle (P1+P2 keyboard), vsai (P1 keyboard + bot), training (dummy).
 * In solo modes P1 accepts BOTH its own bindings and P2's (WASD + arrows).
 */
export class BattleScene extends Phaser.Scene {
  private sim!: BattleSim;
  private animators: FighterAnimator[] = [];
  private mapRenderer!: MapRenderer;
  private fx!: FxLayer;
  private projectileLayer!: ProjectileLayer;
  private hud!: BattleHud;
  private uiCam!: Phaser.Cameras.Scene2D.Camera;
  private inputSystem = new InputSystem();
  private source1!: ManualKeySource;
  private source2!: ManualKeySource;
  private training = false;
  private vsAi = false;
  private charIds: string[] = ['fighter_001', 'fighter_001'];
  private bot: BotController | null = null;
  private fps = 60;
  private fpsCounter = 0;
  private fpsTimer = 0;
  private resultText: Phaser.GameObjects.Text | null = null;
  private debugGfx!: Phaser.GameObjects.Graphics;
  private frameDataText!: Phaser.GameObjects.Text;
  private roundEndCooldown = 0;
  private readonly codeToSource = new Map<string, ManualKeySource>();
  private loop!: FixedTimestepLoop;
  private crashed = false;
  private readonly keyDown = (event: KeyboardEvent): void => this.handleKey(event, true);
  private readonly keyUp = (event: KeyboardEvent): void => this.handleKey(event, false);

  private readonly ignoreOnUi = (object: Phaser.GameObjects.GameObject): void => {
    if (this.uiCam) this.uiCam.ignore(object);
  };

  constructor() {
    super('Battle');
  }

  create(data: { mode?: string }): void {
    try {
      this.createBattle(data ?? {});
    } catch (error) {
      this.crashed = true;
      this.showFatalError(error as Error);
    }
  }

  private createBattle(data: { mode?: string; char1?: string; char2?: string }): void {
    this.training = data.mode === 'training';
    this.vsAi = data.mode === 'vsai';
    this.input.keyboard?.on('keydown-ESC', () => this.scene.start('MainMenu'));
    const loaded = this.registry.get(PRA_DATA_KEY) as LoadedData;
    const map = loaded.maps['map_01']!;
    const roster = Object.keys(loaded.characters);
    const char1Id = data.char1 && loaded.characters[data.char1] ? data.char1 : (roster[0] ?? 'fighter_001');
    const char2Id = data.char2 && loaded.characters[data.char2] ? data.char2 : (roster[1] ?? char1Id);
    const profile = loaded.characters[char1Id]!;
    const profile2 = loaded.characters[char2Id]!;

    this.sim = new BattleSim(map, [profile, profile2]);
    if (this.training) this.sim.trainingMode = true;

    this.cameras.main.setBackgroundColor('#0b0e14');
    this.cameras.main.setZoom(1.5);
    this.uiCam = this.cameras.add(0, 0, INTERNAL_WIDTH, INTERNAL_HEIGHT, false, 'ui');
    this.input.keyboard?.addCapture('F');
    wireFullscreenToggle(this);
    this.mapRenderer = new MapRenderer(this, map, this.sim.physics, { parallax: settings.data.graphics.parallax });
    this.mapRenderer.syncMovers(this.sim.physics);

    this.fx = new FxLayer(this, this.ignoreOnUi);
    this.projectileLayer = new ProjectileLayer(this, this.ignoreOnUi);
    this.debugGfx = this.add.graphics().setDepth(900);

    const tints = [0xffffff, 0x9de1ff] as const;
    const starts = [map.spawn1.x, map.spawn2.x] as const;
    this.charIds = [char1Id, char2Id];
    this.animators = this.sim.fighters.map((fighter, i) =>
      new FighterAnimator(
        this,
        i === 0 ? char1Id : char2Id,
        fighter,
        starts[i] as number,
        fighter.body.bottom,
        tints[i] as number
      )
    );

    this.uiCam.ignore(this.children.list.slice());

    this.hud = new BattleHud(
      this,
      [`${profile.name} · P1`, this.training ? 'DUMMY' : `${profile2.name} · P2`],
      [0x2ec4b6, 0xc2547a]
    );
    this.cameras.main.ignore(this.hud.uiObjects);

    this.frameDataText = this.add
      .text(18, 506, '', { fontFamily: 'monospace', fontSize: '11px', color: '#9de1ff' })
      .setScrollFactor(0)
      .setDepth(1001);
    this.cameras.main.ignore(this.frameDataText);

    this.cameras.main.setBounds(0, 0, map.bounds.width, map.bounds.height);

    this.source1 = new ManualKeySource();
    this.source2 = new ManualKeySource();
    if (this.vsAi) this.bot = new BotController(this.sim, 1, settings.data.ai.difficulty);
    this.wireKeyboard();
    this.loop = new FixedTimestepLoop({ tickRate: TICK_RATE, update: () => this.stepSim() });
  }

  private get soloControl(): boolean {
    return this.training || this.vsAi;
  }

  private stepSim(): void {
    const intent1 = this.inputSystem.poll(
      settings.data.input.p1,
      this.source1.snapshot(),
      settings.data.input.altP1
    );
    const intent2: Intent = this.training
      ? emptyIntent()
      : this.vsAi && this.bot
        ? this.bot.think()
        : this.inputSystem.poll(
            settings.data.input.p2,
            this.source2.snapshot(),
            this.soloControl ? settings.data.input.altP1 : settings.data.input.altP2
          );
    const events = this.sim.step([intent1, intent2]);
    this.handleEvents(events);
  }

  private handleKey(event: KeyboardEvent, down: boolean): void {
    if (down && BLOCK_DEFAULT.has(event.code)) event.preventDefault();
    const actionSource = this.codeToSource.get(event.code);
    if (actionSource) {
      if (down) actionSource.press(event.code);
      else actionSource.release(event.code);
    }
  }

  private wireKeyboard(): void {
    const players: [ManualKeySource, Record<string, string> | Record<string, string | undefined>][] = [
      [this.source1, settings.data.input.p1],
      [this.source1, settings.data.input.altP1],
      [this.soloControl ? this.source1 : this.source2, settings.data.input.p2],
      [this.soloControl ? this.source1 : this.source2, settings.data.input.altP2]
    ];
    for (const [source, bindings] of players) {
      for (const code of Object.values(bindings)) {
        if (!code || code === 'Escape' || code === 'Tab') continue;
        this.codeToSource.set(code, source);
      }
    }
    window.addEventListener('keydown', this.keyDown);
    window.addEventListener('keyup', this.keyUp);
    this.events.once('shutdown', () => this.unwireKeyboard());
    this.events.once('destroy', () => this.unwireKeyboard());
  }

  private unwireKeyboard(): void {
    window.removeEventListener('keydown', this.keyDown);
    window.removeEventListener('keyup', this.keyUp);
  }

  update(_time: number, delta: number): void {
    if (this.crashed) return;
    try {
      this.updateBattle(_time, delta);
    } catch (error) {
      this.crashed = true;
      this.showFatalError(error as Error);
    }
  }

  private updateBattle(_time: number, delta: number): void {
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

    this.sim.fighters.forEach((fighter, i) => this.animators[i]?.sync(this.charIds[i] ?? 'fighter_001'));
    this.projectileLayer.sync(this.sim.projectiles);
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
      .text(INTERNAL_WIDTH / 2, 230, `RUNTIME ERROR\n${error.message}\n\nESC: menu`, {
        fontFamily: 'monospace',
        fontSize: '14px',
        color: '#ff8a8a',
        align: 'center',
        wordWrap: { width: 720 }
      })
      .setOrigin(0.5)
      .setScrollFactor(0)
      .setDepth(1200);
    this.cameras.main.ignore(this.resultText);
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
          .text(INTERNAL_WIDTH / 2, 240, event.winner === null ? 'DRAW' : `ROUND WIN: P${event.winner}`, {
            fontFamily: 'monospace',
            fontSize: '30px',
            color: '#ffd166'
          })
          .setOrigin(0.5)
          .setScrollFactor(0)
          .setDepth(1100);
        this.cameras.main.ignore(this.resultText);
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
