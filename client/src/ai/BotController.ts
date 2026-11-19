import { emptyIntent, type Intent } from '@shared/types/input.js';
import type { BattleSim } from '../combat/BattleSim.js';
import type { FighterSim } from '../combat/FighterSim.js';

export type BotDifficulty = 'beginner' | 'easy' | 'normal' | 'hard' | 'expert';

interface DifficultyProfile {
  reactTicks: number;
  mistakeChance: number;
  guardChance: number;
  aggression: number;
  idleChance: number;
}

export const DIFFICULTY_PROFILES: Record<BotDifficulty, DifficultyProfile> = {
  beginner: { reactTicks: 14, mistakeChance: 0.42, guardChance: 0.18, aggression: 0.5, idleChance: 0.22 },
  easy: { reactTicks: 10, mistakeChance: 0.28, guardChance: 0.32, aggression: 0.65, idleChance: 0.14 },
  normal: { reactTicks: 7, mistakeChance: 0.16, guardChance: 0.5, aggression: 0.78, idleChance: 0.08 },
  hard: { reactTicks: 4, mistakeChance: 0.08, guardChance: 0.68, aggression: 0.9, idleChance: 0.04 },
  expert: { reactTicks: 2, mistakeChance: 0.03, guardChance: 0.82, aggression: 0.95, idleChance: 0.02 }
};

type BotState = 'idle' | 'approach' | 'retreat' | 'attack' | 'guard' | 'jumpIn';

export const mulberry32 = (seed: number): (() => number) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

/**
 * Headless FSM bot: Idle / Approach / Retreat / Attack / Guard / JumpIn.
 * Produces Intent per sim tick exactly like a keyboard source would —
 * the deterministic core never knows a bot is playing. Seeds make behavior
 * reproducible for tests; the scene passes a fresh seed for variety.
 */
export class BotController {
  private readonly sim: BattleSim;
  private readonly side: number;
  private readonly profile: DifficultyProfile;
  private readonly rng: () => number;
  private state: BotState = 'idle';
  private stateTicks = 0;
  private guardTicks = 0;
  private reactTimer = 0;
  private dashCooldown = 0;
  private nextAttackIn = 0;

  constructor(sim: BattleSim, side: number, difficulty: BotDifficulty = 'normal', seed = Date.now() % 2147483647) {
    this.sim = sim;
    this.side = side;
    this.profile = DIFFICULTY_PROFILES[difficulty];
    this.rng = mulberry32(seed);
    this.nextAttackIn = Math.floor(this.rng() * 30);
  }

  think(): Intent {
    const me = this.sim.getFighter(this.side === 0 ? 1 : 2);
    const opp = this.sim.getFighter(this.side === 0 ? 2 : 1);
    this.stateTicks++;

    const dx = opp.body.centerX - me.body.centerX;
    const absDx = Math.abs(dx);
    const dirToward = dx >= 0 ? 1 : -1;
    const reach = BotController.reach(me);

    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.reactTimer > 0) this.reactTimer--;
    if (this.nextAttackIn > 0) this.nextAttackIn--;
    if (this.guardTicks > 0) this.guardTicks--;

    if (this.rng() < this.profile.mistakeChance && this.state !== 'attack' && this.state !== 'guard') {
      this.state = this.rng() < 0.5 ? 'idle' : 'retreat';
      this.stateTicks = 0;
    }

    const incoming = opp.state === 'attack' && absDx < reach + 42;
    if (incoming && this.reactTimer <= 0 && this.rng() < this.profile.guardChance) {
      this.guardTicks = 22 + Math.floor(this.rng() * 14);
      this.reactTimer = this.profile.reactTicks;
      this.state = 'guard';
    }

    const intent = emptyIntent();
    switch (this.state) {
      case 'guard': {
        if (this.guardTicks <= 0 || opp.state !== 'attack') this.state = 'approach';
        else intent.guardHeld = true;
        break;
      }
      case 'attack': {
        if (me.state === 'idle' || me.state === 'walk' || me.state === 'run') this.state = 'approach';
        break;
      }
      default: {
        const canAct = me.state === 'idle' || me.state === 'walk' || me.state === 'run';
        if (canAct && absDx <= reach && this.nextAttackIn <= 0 && this.rng() < this.profile.aggression) {
          const roll = this.rng();
          intent.attackPressed = roll < 0.5 ? 'light' : roll < 0.85 ? 'medium' : 'heavy';
          this.nextAttackIn = Math.floor(18 + this.rng() * (60 * (1 - this.profile.aggression)));
          this.state = 'attack';
        } else if (canAct && absDx > reach * 1.4) {
          this.state = 'approach';
        }
      }
    }

    if (this.state === 'approach') {
      intent.moveX = dirToward as 1 | -1;
      if (absDx > 220 && this.dashCooldown <= 0 && this.rng() < 0.06 * (1 + this.profile.aggression)) {
        this.dashCooldown = 90;
        intent.dashPressed = true;
      }
      if (opp.body.centerY < me.body.centerY - 40 && this.rng() < 0.12) {
        intent.jumpPressed = true;
        intent.jumpHeld = true;
      }
      if (this.rng() < this.profile.idleChance) {
        intent.moveX = 0;
        this.state = 'idle';
        this.stateTicks = 0;
      }
    } else if (this.state === 'retreat') {
      intent.moveX = -dirToward as 1 | -1;
      if (this.rng() < 0.1) {
        this.state = 'approach';
        this.stateTicks = 0;
      }
    } else if (this.state === 'idle') {
      intent.moveX = 0;
      if (this.stateTicks > 12) {
        this.state = 'approach';
        this.stateTicks = 0;
      }
    }

    return intent;
  }

  static reach(fighter: FighterSim): number {
    let max = 52;
    for (const attack of fighter.profile.attacks) {
      for (const window of attack.hitboxWindows) {
        max = Math.max(max, window.box.offsetX + window.box.width);
      }
    }
    return max;
  }
}
