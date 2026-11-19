export type AttackKind =
  | 'light'
  | 'medium'
  | 'heavy'
  | 'air'
  | 'dashAttack'
  | 'skill'
  | 'ultimate';

export type GuardHeight = 'high' | 'low' | 'mid';

export interface FrameWindow {
  startup: number;
  active: number;
  recovery: number;
}

export interface HitboxWindow {
  startFrame: number;
  endFrame: number;
  box: { offsetX: number; offsetY: number; width: number; height: number };
  damageMultiplier: number;
}

export interface AttackDef {
  id: string;
  kind: AttackKind;
  name: string;
  damage: number;
  energyCost: number;
  cooldown: number;
  frames: FrameWindow;
  hitboxWindows: HitboxWindow[];
  guardHeight: GuardHeight;
  hitstun: number;
  blockstun: number;
  knockbackX: number;
  knockbackY: number;
  hitstop: 'light' | 'medium' | 'heavy' | 'ultimate';
  comboScaling?: number;
  cancelWindowStart?: number;
  cancelWindowEnd?: number;
  invulnFrames?: [number, number];
  armorFrames?: [number, number];
  canBeBlocked: boolean;
  airOk: boolean;
  requiresGrounded: boolean;
  forwardLunge?: number;
  animation: string;
}

export interface PassiveDef {
  id: string;
  name: string;
  description: string;
  trigger: string;
  coeff: number;
  cooldown: number;
  stacking: boolean;
}

export interface CharacterStats {
  hp: number;
  energy: number;
  atk: number;
  def: number;
  spd: number;
  jump: number;
  range: number;
}

export interface CharacterProfile {
  id: string;
  name: string;
  archetype: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  stats: CharacterStats;
  attacks: AttackDef[];
  passives: PassiveDef[];
  spriteSheet: string;
}

export type ActionStateId =
  | 'idle'
  | 'walk'
  | 'run'
  | 'jumpRise'
  | 'jumpFall'
  | 'landing'
  | 'dash'
  | 'attack'
  | 'guard'
  | 'hitstun'
  | 'blockstun'
  | 'knockdown'
  | 'getup'
  | 'victory'
  | 'defeat';

export interface ActionState {
  id: ActionStateId;
  frame: number;
  attack?: AttackDef;
}
