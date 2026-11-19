import { describe, expect, it } from 'vitest';
import { InputSystem } from '../../client/src/systems/InputSystem.js';
import {
  DEFAULT_SETTINGS,
  P1_ALT_DEFAULT,
  P2_ALT_DEFAULT,
  SettingsSystem,
  detectConflicts
} from '../../client/src/systems/SettingsSystem.js';
import { memoryStorage } from '../../client/src/systems/SettingsSystem.js';
import { ManualKeySource } from '../../client/src/systems/InputSystem.js';
import type { KeySnapshot } from '../../client/src/systems/InputSystem.js';

const snapOf = (source: ManualKeySource): KeySnapshot => source.snapshot();

describe('settings: alt skill bindings', () => {
  it('seeds alt clusters by default', () => {
    expect(DEFAULT_SETTINGS.input.altP1.skill1).toBe('KeyK');
    expect(DEFAULT_SETTINGS.input.altP2.ultimate).toBe('Backslash');
  });

  it('migrates saved settings that predate alt clusters', () => {
    const storage = memoryStorage();
    const legacy = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)) as { input: Partial<typeof DEFAULT_SETTINGS.input> };
    delete legacy.input.altP1;
    delete legacy.input.altP2;
    storage.setItem('pra.settings.v1', JSON.stringify(legacy));
    const system = new SettingsSystem(storage);
    expect(system.data.input.altP1.skill1).toBe(P1_ALT_DEFAULT.skill1);
    expect(system.data.input.altP2.skill4).toBe(P2_ALT_DEFAULT.skill4);
  });

  it('keeps custom alt keys when prefixing primary-only saves', () => {
    const storage = memoryStorage();
    const data = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    data.input.altP1.skill2 = 'Comma';
    storage.setItem('pra.settings.v1', JSON.stringify(data));
    const system = new SettingsSystem(storage);
    expect(system.data.input.altP1.skill1).toBe(P1_ALT_DEFAULT.skill1);
    expect(system.data.input.altP1.skill2).toBe('Comma');
  });

  it('rebindAlt persists and reports conflicts against primary + alt', () => {
    const system = new SettingsSystem(memoryStorage());
    const ok = system.rebindAlt('p1', 'skill2', 'Comma');
    expect(ok).toHaveLength(0);
    expect(system.data.input.altP1.skill2).toBe('Comma');

    const conflicts = system.rebindAlt('p1', 'skill3', 'Comma');
    expect(conflicts.length).toBeGreaterThan(0);
  });

  it('detectConflicts catches a key shared between primary and alt maps', () => {
    const conflicts = detectConflicts({ ...DEFAULT_SETTINGS.input.p1 }, { ultimate: 'KeyA' });
    expect(conflicts.some((c) => c.key === 'KeyA')).toBe(true);
  });
});

describe('input: alt bindings produce intents', () => {
  const system = new InputSystem();
  const input = DEFAULT_SETTINGS.input;

  it('fires skill from primary or alt key', () => {
    const viaPrimary = system.poll(input.p1, { down: new Set(), consumePressed: new Set(['Digit1']) }, input.altP1);
    expect(viaPrimary.skillPressed).toBe(1);

    const viaAlt = system.poll(input.p1, { down: new Set(), consumePressed: new Set(['KeyK']) }, input.altP1);
    expect(viaAlt.skillPressed).toBe(1);
  });

  it('fires ultimate from alt key', () => {
    const viaAlt = system.poll(input.p1, { down: new Set(), consumePressed: new Set(['KeyP']) }, input.altP1);
    expect(viaAlt.ultimatePressed).toBe(true);
  });

  it('held checks accept alt movement keys', () => {
    const viaAlt = system.poll(
      input.p1,
      { down: new Set(['ArrowLeft']), consumePressed: new Set() },
      { moveLeft: 'ArrowLeft' }
    );
    expect(viaAlt.moveX).toBe(-1);
  });

  it('buffers pause from alt key', () => {
    const source = new ManualKeySource();
    source.press('KeyP');
    const snapshot = snapOf(source);
    system.poll(input.p1, snapshot, { ...input.altP1, pause: input.altP1.ultimate });
    expect(system.consume('pause')).toBe(true);
    system.clear();
  });
});
