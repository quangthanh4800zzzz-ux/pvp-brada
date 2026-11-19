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
  effect?: PassiveEffect;
}

export interface PassiveEffect {
  type: 'speedBoost';
  durationFrames: number;
  multiplier: number;
}

export type SkillKind = 'meleeStrike' | 'projectile' | 'buff';

export interface ProjectileDef {
  speed: number;
  lifetime: number;
  fx?: string;
  gravity?: number;
  width: number;
  height: number;
  offsetY: number;
  damage: number;
  knockbackX: number;
  knockbackY: number;
  hitstun: number;
  blockstun: number;
  hitstop: AttackDef['hitstop'];
  guardHeight: AttackDef['guardHeight'];
  canBeBlocked?: boolean;
}

export interface BuffDef {
  durationFrames: number;
  speedMultiplier?: number;
  atkMultiplier?: number;
}

export interface SkillDef extends Omit<AttackDef, 'kind'> {
  slot: 1 | 2 | 3 | 4 | 5;
  kind: 'skill' | 'ultimate';
  skillKind: SkillKind;
  description: string;
  projectile?: ProjectileDef;
  buff?: BuffDef;
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
  skills?: SkillDef[];
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
