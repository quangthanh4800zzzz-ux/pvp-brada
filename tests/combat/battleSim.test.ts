import { describe, expect, it } from 'vitest';
import { BattleSim } from '../../client/src/combat/BattleSim.js';
import { loadStandins } from './helpers.js';
import { makeIntent } from '../../client/src/systems/InputSystem.js';

const { map, profileA, profileB } = loadStandins();

describe('frame windows', () => {
  it('light attack follows 4/3/8 frame data', () => {
    const light = profileA.attacks.find((a) => a.id === 'light');
    expect(light?.frames).toEqual({ startup: 4, active: 3, recovery: 8 });
  });

  it('heavy has startup 15 and cannot start in the air', () => {
    const heavy = profileA.attacks.find((a) => a.id === 'heavy');
    expect(heavy?.frames.startup).toBe(15);
    expect(heavy?.requiresGrounded).toBe(true);
  });
});

describe('hit detection', () => {
  it('light attack connects when in range', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    walkTogether(sim, 450);
    const startHp = sim.getFighter(2).hp;
    startAttack(sim, 1, 'light');
    for (let i = 0; i < 20; i++) step(sim);
    expect(sim.getFighter(2).hp).toBeLessThan(startHp);
  });

  it('does not hit when out of range', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    startAttack(sim, 1, 'light');
    for (let i = 0; i < 20; i++) step(sim);
    expect(sim.getFighter(2).hp).toBe(sim.getFighter(2).maxHp);
  });

  it('applies hitstop so combat freezes on impact', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    teleportAdjacent(sim);
    startAttack(sim, 1, 'light');
    let seen = 0;
    for (let i = 0; i < 12; i++) {
      step(sim);
      seen = Math.max(seen, sim.hitstop);
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('light attack only lands during active frames', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    teleportAdjacent(sim);
    startAttack(sim, 1, 'light');
    let landedActive = false;
    for (let i = 0; i < 12; i++) {
      const events = step(sim);
      const attackFrame = sim.getFighter(1).stateFrame;
      if (events.some((event) => event.type === 'hit')) {
        expect(attackFrame).toBeGreaterThanOrEqual(4);
        landedActive = true;
      }
    }
    expect(landedActive).toBe(true);
  });
});

describe('guard', () => {
  it('blocked attack deals chip damage only', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    teleportAdjacent(sim);
    const defender = sim.getFighter(2);
    defender.setState('guard');
    for (let i = 0; i < 12; i++) stepWithGuard(sim);
    startAttack(sim, 1, 'light');
    for (let i = 0; i < 24; i++) stepWithGuard(sim);
    const chip = defender.maxHp - defender.hp;
    expect(chip).toBeGreaterThan(0);
    expect(chip).toBeLessThan(profileA.attacks.find((a) => a.id === 'light')?.damage ?? 0);
  });

  it('guard facing away does not block', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    teleportAdjacent(sim);
    const defender = sim.getFighter(2);
    defender.isBlocking = true;
    defender.guard = 'high';
    defender.setState('guard');
    defender.facing = sim.getFighter(1).facing;
    startAttack(sim, 1, 'light');
    for (let i = 0; i < 24; i++) step(sim);
    const lightDamage = profileA.attacks.find((a) => a.id === 'light')?.damage ?? 0;
    expect(defender.hp).toBeLessThanOrEqual(defender.maxHp - lightDamage);
  });

  it('perfect guard takes no damage and punishes', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    teleportAdjacent(sim);
    const defender = sim.getFighter(2);
    for (let i = 0; i < 2; i++) stepWithGuard(sim);
    startAttack(sim, 1, 'light');
    let sawPerfect = false;
    for (let i = 0; i < 10; i++) {
      for (const event of stepWithGuard(sim)) {
        if (event.type === 'hit' && event.perfect) sawPerfect = true;
      }
    }
    expect(sawPerfect).toBe(true);
    expect(defender.hp).toBe(defender.maxHp);
  });

  it('sustained block depletes meter and causes guard break stun', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    teleportAdjacent(sim);
    const defender = sim.getFighter(2);
    const attacker = sim.getFighter(1);
    attacker.energy = 100;
    let broke = false;
    for (let round = 0; round < 40 && !broke; round++) {
      teleportAdjacent(sim);
      defender.setState('guard');
      for (let i = 0; i < 12; i++) stepWithGuard(sim);
      startAttack(sim, 1, 'medium');
      for (let i = 0; i < 70; i++) {
        stepWithGuard(sim);
        if (sim.events.some((event) => event.type === 'action' && event.action === 'guardBreak')) {
          broke = true;
          break;
        }
      }
    }
    expect(broke).toBe(true);
    expect(defender.hp).toBeLessThan(defender.maxHp);
  });
});

describe('combo system', () => {
  it('scales damage across combo hits', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    const attacker = sim.getFighter(1);
    const defender = sim.getFighter(2);
    const attack = profileA.attacks.find((a) => a.id === 'light');
    sim.startAttack(attacker, attack);
    const first = sim.computeDamage(attacker, defender, attack, 1);
    sim.combo[1].hits = 3;
    const fourth = sim.computeDamage(attacker, defender, attack, 1);
    expect(fourth).toBeLessThan(first);
    expect(fourth / first).toBeCloseTo(Math.pow(0.88, 3), 2);
  });

  it('damage scaling never drops below floor', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    const attacker = sim.getFighter(1);
    const defender = sim.getFighter(2);
    const attack = profileA.attacks.find((a) => a.id === 'light');
    sim.combo[1].hits = 50;
    const damage = sim.computeDamage(attacker, defender, attack, 1);
    expect(damage).toBeGreaterThan(0);
    expect(damage / (attack?.damage ?? 1)).toBeGreaterThanOrEqual(0.2);
  });

  it('combo counter increments and expires', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    teleportAdjacent(sim);
    startAttack(sim, 1, 'light');
    for (let i = 0; i < 10; i++) step(sim);
    expect(sim.combo[1].hits).toBe(1);
    for (let i = 0; i < 40; i++) step(sim);
    expect(sim.combo[1].hits).toBe(0);
  });
});

describe('resources', () => {
  it('cooldown prevents immediate reuse', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    const attacker = sim.getFighter(1);
    const attack = profileA.attacks.find((a) => a.id === 'medium');
    sim.startAttack(attacker, attack);
    expect(attacker.onCooldown(attack?.id ?? '')).toBe(true);
    expect(sim.canStartAttack(attacker, attack)).toBe(false);
  });

  it('energy cost gates heavy and regenerates on hit', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    const attacker = sim.getFighter(1);
    const heavy = profileA.attacks.find((a) => a.id === 'heavy');
    attacker.energy = 2;
    expect(sim.canStartAttack(attacker, heavy)).toBe(false);
    attacker.energy = 100;
    teleportAdjacent(sim);
    startAttack(sim, 1, 'heavy');
    expect(attacker.energy).toBeLessThan(100);
    const before = attacker.energy;
    for (let i = 0; i < 40; i++) step(sim);
    expect(attacker.energy).toBeGreaterThan(before);
  });
});

describe('knockback and round flow', () => {
  it('heavy launcher knocks defender airborne', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    teleportAdjacent(sim);
    startAttack(sim, 1, 'heavy');
    for (let i = 0; i < 26; i++) step(sim);
    expect(sim.getFighter(2).body.grounded).toBe(false);
  });

  it('KO ends the round and awards the winner', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    teleportAdjacent(sim);
    sim.getFighter(2).hp = 20;
    startAttack(sim, 1, 'light');
    for (let i = 0; i < 24; i++) step(sim);
    expect(sim.roundOver).toBe(true);
    expect(sim.winner).toBe(1);
    expect(sim.roundsWon[1]).toBe(1);
  });
});

describe('movement', () => {
  it('walks toward the opponent', () => {
    const sim = new BattleSim(map, [profileA, profileB]);
    walkTogether(sim, 40);
    expect(sim.getFighter(1).body.x).toBeGreaterThan(210);
  });
});

function walkTogether(sim: BattleSim, frames = 60): void {
  for (let i = 0; i < frames; i++) {
    const d1 = sim.getFighter(1).body.centerX < sim.getFighter(2).body.centerX ? 1 : -1;
    sim.step([makeIntent({ moveX: d1 as 1 | -1 }), makeIntent({})]);
  }
}

function teleportAdjacent(sim: BattleSim, gap = 12): void {
  const a = sim.getFighter(1);
  const b = sim.getFighter(2);
  b.body.x = a.body.right + gap;
  b.body.y = a.body.y;
  a.facing = 1;
  b.facing = -1;
}

function startAttack(sim: BattleSim, side: number, id: string): void {
  const attacker = sim.getFighter(side);
  const attack = attacker.attackById(id);
  if (!attack) throw new Error(`missing attack ${id}`);
  sim.startAttack(attacker, attack);
}

function step(sim: BattleSim): ReturnType<BattleSim['step']> {
  return sim.step([makeIntent({}), makeIntent({})]);
}

function stepWithGuard(sim: BattleSim): ReturnType<BattleSim['step']> {
  return sim.step([makeIntent({}), makeIntent({ guardHeld: true })]);
}
