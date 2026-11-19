export const TICK_RATE = 60;
export const TICK_MS = 1000 / TICK_RATE;
export const MAX_FRAME_DELTA_MS = 250;

export const INTERNAL_WIDTH = 960;
export const INTERNAL_HEIGHT = 540;

export const DEFAULT_GRAVITY = 1600;
export const DEFAULT_GROUND_FRICTION = 1800;
export const DEFAULT_AIR_DRAG = 200;

export const DEFAULT_STATS = {
  hp: 1000,
  energy: 100,
  atk: 100,
  def: 100,
  spd: 100,
  jump: 100,
  range: 100
} as const;

export const COMBO = {
  resetFrames: 30,
  minScaling: 0.2,
  defaultScalingFactor: 0.85,
  hitstunDeteriorationPerHit: 2,
  minHitstun: 8,
  antiInfiniteThreshold: 9,
  knockbackEscalation: 1.12
} as const;

export const GUARD = {
  perfectWindowFrames: 6,
  chipDamageRatio: 0.1,
  maxMeter: 100,
  meterRegenPerFrame: 0.35,
  chipCost: 8,
  breakStunFrames: 45
} as const;

export const ROUND = {
  durationSeconds: 99,
  maxRoundsToWin: 2,
  hitstopFrames: { light: 3, medium: 6, heavy: 9, ultimate: 14 } as Record<string, number>
};
