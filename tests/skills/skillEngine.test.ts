import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { emptyIntent, type CharacterProfile, type Intent, type MapDefinition } from '@shared/types/index.js';
import { BattleSim } from '../../client/src/combat/BattleSim.js';
import { FighterSim } from '../../client/src/combat/FighterSim.js';

const root = resolve(process.cwd(), 'client/public/data');
const map = JSON.parse(readFileSync(resolve(root, 'maps/map_01.json'), 'utf-8')) as MapDefinition;
const fighter1 = JSON.parse(readFileSync(resolve(root, 'characters/fighter_001.json'), 'utf-8')) as CharacterProfile;
const fighter2 = JSON.parse(readFileSync(resolve(root, 'characters/fighter_002.json'), 'utf-8')) as CharacterProfile;

function intents(over: Partial<Intent> = {}): [Intent, Intent] {
  return [{ ...emptyIntent(), ...over }, emptyIntent()];
}

function placeAdjacent(sim: BattleSim): void {
  const [a, b] = sim.fighters;
  b.body.x = a.body.x + a.body.width + 2;
  b.body.y = a.body.y;
  for (let i = 0; i < 120 && !(a.grounded && b.grounded); i++) sim.step(intents());
}

describe('skill engine — projectiles', () => {
  it('spawn a projectile at startup end and it flies toward the opponent', () => {
    const sim = new BattleSim(map, [fighter1, fighter2]);
    sim.fighters[1]!.body.x = sim.fighters[0]!.body.x + 260;

    sim.step(intents({ skillPressed: 1 }));
    expect(sim.projectiles).toHaveLength(0);

    for (let i = 0; i < 6; i++) sim.step(intents());
    expect(sim.projectiles).toHaveLength(1);
    const p = sim.projectiles[0]!;
    expect(p.owner).toBe(1);
    expect(p.skillId).toBe('energyBall');

    const beforeX = p.x;
    sim.step(intents());
    expect(p.x).toBeGreaterThan(beforeX);
  });

  it('projectile damages the opponent on contact', () => {
    const sim = new BattleSim(map, [fighter1, fighter2]);
    sim.fighters[1]!.body.x = sim.fighters[0]!.body.x + 240;
    const defender = sim.fighters[1]!;
    const hpBefore = defender.hp;

    sim.step(intents({ skillPressed: 1 }));
    for (let i = 0; i < 6; i++) sim.step(intents());
    for (let i = 0; i < 90 && sim.projectiles.length > 0; i++) sim.step(intents());

    expect(defender.hp).toBeLessThan(hpBefore);
    expect(sim.projectiles).toHaveLength(0);
  });

  it('projectile is destroyed on lifetime expiry without hitting', () => {
    const sim = new BattleSim(map, [fighter1, fighter2]);
    sim.fighters[1]!.body.x = 800;
    sim.step(intents({ skillPressed: 1 }));
    for (let i = 0; i < 6; i++) sim.step(intents());
    for (let i = 0; i < 120; i++) sim.step(intents());
    expect(sim.projectiles).toHaveLength(0);
    expect(sim.fighters[1]!.hp).toBe(sim.fighters[1]!.maxHp);
  });
});

describe('skill engine — melee strike skills', () => {
  it('rising cut launches the opponent upward and goes on cooldown', () => {
    const sim = new BattleSim(map, [fighter1, fighter2]);
    placeAdjacent(sim);
    const defender = sim.fighters[1]!;

    sim.step(intents({ skillPressed: 2 }));
    const attacker = sim.fighters[0]!;
    expect(attacker.attack?.id).toBe('risingCut');
    for (let i = 0; i < 40; i++) sim.step(intents());

    expect(defender.hp).toBeLessThan(defender.maxHp);
    expect(attacker.onCooldown('risingCut')).toBe(true);
  });

  it('volt dash strike grants invulnerability during the lunge window (fighter_002)', () => {
    const sim = new BattleSim(map, [fighter2, fighter1]);
    placeAdjacent(sim);
    const me = sim.fighters[0]!;

    sim.step(intents({ skillPressed: 1 }));
    expect(me.attack?.id).toBe('voltDash');
    expect(me.invulnFramesLeft).toBeGreaterThan(0);
  });
});

describe('skill engine — ultimate & buffs', () => {
  it('ultimate requires full energy cost', () => {
    const sim = new BattleSim(map, [fighter2, fighter1]);
    placeAdjacent(sim);
    const me = sim.fighters[0]!;
    me.energy = 30;
    sim.step(intents({ ultimatePressed: true }));
    expect(me.attack).toBeNull();

    me.energy = 100;
    sim.step(intents({ ultimatePressed: true }));
    expect(me.attack?.id).toBe('thunderCut');
    expect(me.energy).toBeLessThanOrEqual(1);
  });

  it('overdrive buff increases move speed and attack then expires', () => {
    const sim = new BattleSim(map, [fighter1, fighter2]);
    placeAdjacent(sim);
    const me = sim.fighters[0]!;
    me.energy = me.profile.stats.energy;
    const baseSpeed = me.speed();

    sim.step(intents({ ultimatePressed: true }));
    const startup = me.attack?.frames.startup ?? 0;
    for (let i = 0; i < startup; i++) sim.step(intents());
    expect(me.buffed).toBe(true);
    expect(me.speed()).toBeGreaterThan(baseSpeed);
    expect(me.buffAtk).toBeCloseTo(1.2);

    for (let i = 0; i < 310; i++) sim.step(intents());
    expect(me.buffed).toBe(false);
    expect(me.speed()).toBe(baseSpeed);
  });

  it('clean-hit passive grants a temporary speed boost once per cooldown', () => {
    const sim = new BattleSim(map, [fighter1, fighter2]);
    placeAdjacent(sim);
    const me = sim.fighters[0]!;
    const baseSpeed = me.speed();

    sim.step(intents({ attackPressed: 'light' }));
    for (let i = 0; i < 20; i++) sim.step(intents());
    expect(me.buffed).toBe(true);
    expect(me.speed()).toBeGreaterThan(baseSpeed);
    expect(me.passiveReady('momentum')).toBe(false);
  });
});

describe('fighter_002 roster', () => {
  it('has distinct assassin stats (faster, less defense, 3 skills)', () => {
    const me = new FighterSim({ profile: fighter2, team: 1, side: 1, spawnX: 100, spawnY: 300 });
    const base = new FighterSim({ profile: fighter1, team: 1, side: 1, spawnX: 100, spawnY: 300 });
    expect(me.profile.stats.spd).toBeGreaterThan(base.profile.stats.spd);
    expect(me.profile.stats.def).toBeLessThan(base.profile.stats.def);
    expect(me.skills()).toHaveLength(3);
  });
});
