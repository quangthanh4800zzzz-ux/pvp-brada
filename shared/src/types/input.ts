export const ACTIONS = [
  'moveLeft',
  'moveRight',
  'up',
  'down',
  'jump',
  'dash',
  'guard',
  'light',
  'medium',
  'heavy',
  'skill1',
  'skill2',
  'skill3',
  'skill4',
  'ultimate',
  'interact',
  'pause',
  'scoreboard',
  'trainingReset'
] as const;

export type Action = (typeof ACTIONS)[number];
export type KeyBindings = Record<Action, string>;
export type PartialBindings = Partial<KeyBindings>;

export interface Intent {
  moveX: -1 | 0 | 1;
  down: boolean;
  jumpPressed: boolean;
  jumpHeld: boolean;
  dashPressed: boolean;
  guardHeld: boolean;
  guardPressed: boolean;
  attackPressed: 'light' | 'medium' | 'heavy' | null;
  skillPressed: number | null;
  ultimatePressed: boolean;
  interactPressed: boolean;
  dropThroughPressed: boolean;
}

export function emptyIntent(): Intent {
  return {
    moveX: 0,
    down: false,
    jumpPressed: false,
    jumpHeld: false,
    dashPressed: false,
    guardHeld: false,
    guardPressed: false,
    attackPressed: null,
    skillPressed: null,
    ultimatePressed: false,
    interactPressed: false,
    dropThroughPressed: false
  };
}
