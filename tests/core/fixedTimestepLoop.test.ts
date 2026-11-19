import { describe, expect, it } from 'vitest';
import { FixedTimestepLoop } from '../../client/src/core/FixedTimestepLoop.js';

describe('FixedTimestepLoop', () => {
  it('runs exactly tickRate ticks per second of simulated time', () => {
    let updates = 0;
    const loop = new FixedTimestepLoop({ tickRate: 60, update: () => updates++ });
    const ticks = loop.advance(1000);
    expect(ticks).toBe(60);
    expect(updates).toBe(60);
  });

  it('preserves leftover accumulator across frames (no time loss)', () => {
    let updates = 0;
    const loop = new FixedTimestepLoop({ tickRate: 60, update: () => updates++ });
    loop.advance(501);
    loop.advance(499);
    expect(updates).toBe(60);
  });

  it('caps catch-up budget to avoid spiral of death', () => {
    let updates = 0;
    const loop = new FixedTimestepLoop({ tickRate: 60, update: () => updates++ });
    const ticks = loop.advance(10_000);
    expect(ticks).toBeLessThan(60 * 5);
    expect(updates).toBe(ticks);
  });

  it('update() never receives variable dt', () => {
    const dts: number[] = [];
    const loop = new FixedTimestepLoop({
      tickRate: 60,
      update: (dt) => dts.push(dt)
    });
    loop.advance(333);
    expect(new Set(dts).size).toBe(1);
  });
});
