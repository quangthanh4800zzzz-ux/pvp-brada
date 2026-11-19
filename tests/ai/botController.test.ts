import { describe, expect, it } from 'vitest';
import { BattleSim } from '../../client/src/combat/BattleSim.js';
import { makeIntent } from '../../client/src/systems/InputSystem.js';
import { BotController, DIFFICULTY_PROFILES } from '../../client/src/ai/BotController.js';
import { loadStandins } from '../combat/helpers.js';
import type { Intent } from '@shared/types/input.js';

const { map, profileA, profileB } = loadStandins();

const drive = (sim: BattleSim, ticks: number, bot: BotController): void => {
  for (let i = 0; i < ticks; i++) {
    sim.step([makeIntent({}), bot.think()]);
  }
};

const distance = (sim: BattleSim): number =>
  Math.abs(sim.getFighter(2).body.centerX - sim.getFighter(1).body.centerX);

describe('bot difficulty profiles', () => {
  it('reaction time strictly decreases with difficulty', () => {
    const levels = ['beginner', 'easy', 'normal', 'hard', 'expert'] as const;
    for (let i = 1; i < levels.length; i++) {
      expect(DIFFICULTY_PROFILES[levels[i] as never].reactTicks).toBeLessThan(
        DIFFICULTY_PROFILES[levels[i - 1] as never].reactTicks
      );
    }
  });
});

describe('bot behavior (normal difficulty)', () => {
  it('approaches the opponent from full map distance', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    const bot = new BotController(sim, 1, 'normal', 42);
    const initial = distance(sim);
    let minDist = initial;
    for (let i = 0; i < 300; i++) {
      sim.step([makeIntent({}), bot.think()]);
      minDist = Math.min(minDist, distance(sim));
    }
    expect(minDist).toBeLessThan(initial * 0.5);
  });

  it('lands hits on a passive opponent', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    const bot = new BotController(sim, 1, 'normal', 7);
    drive(sim, 900, bot);
    expect(sim.getFighter(1).hp).toBeLessThan(sim.getFighter(1).maxHp);
  });

  it('is deterministic for the same seed', () => {
    const runA: Intent[] = [];
    const runB: Intent[] = [];
    for (const run of [runA, runB]) {
      const sim = new BattleSim(map, [profileA, profileB]);
      const bot = new BotController(sim, 1, 'hard', 1234);
      for (let i = 0; i < 100; i++) run.push(bot.think());
    }
    expect(JSON.stringify(runA)).toBe(JSON.stringify(runB));
  });
});
