import { clamp } from '@shared/math.js';
import type { AttackDef, BuffDef, CharacterProfile, Facing, SkillDef } from '@shared/types/index.js';
import { RigidBody } from '../physics/RigidBody.js';

export const FIGHTER_WIDTH = 16;
export const FIGHTER_HEIGHT = 34;

export type GuardDirection = 'none' | 'high' | 'low';

export interface FighterOptions {
  profile: CharacterProfile;
  team: number;
  side: 1 | 2;
  spawnX: number;
  spawnY: number;
}

/**
 * Pure simulation fighter: action state, resources, frame-data timing.
 * No rendering dependency — driven entirely by BattleSim.
 */
export class FighterSim {
  readonly profile: CharacterProfile;
  readonly team: number;
  readonly side: 1 | 2;

  readonly body: RigidBody;

  hp: number;
  maxHp: number;
  energy: number;
  guardMeter: number;

  state: string = 'idle';
  stateFrame = 0;
  attack: AttackDef | null = null;
  attackTotalFrames = 0;
  attackHasHit = false;
  attackStartedInAir = false;
  invulnFramesLeft = 0;
  armorFramesLeft = 0;
  stunFramesLeft = 0;

  guard: GuardDirection = 'none';
  perfectGuardFrames = 0;
  pendingGuardRelease = false;
  isBlocking = false;

  dashCooldown = 0;
  airJumpsLeft = 1;
  landingLag = 0;
  lastAttackId: string | null = null;
  comboSpentCancel = false;

  cooldowns: Map<string, number> = new Map();
  passiveCooldowns: Map<string, number> = new Map();

  buffTicks = 0;
  buffSpeed = 1;
  buffAtk = 1;
  buffId: string | null = null;

  constructor(private readonly opts: FighterOptions) {
    this.profile = opts.profile;
    this.team = opts.team;
    this.side = opts.side;
    this.hp = opts.profile.stats.hp;
    this.maxHp = opts.profile.stats.hp;
    this.energy = Math.round(opts.profile.stats.energy * 0.5);
    this.guardMeter = 100;
    this.body = new RigidBody(opts.spawnX, opts.spawnY, FIGHTER_WIDTH, FIGHTER_HEIGHT);
    this.facing = opts.side === 1 ? 1 : -1;
  }

  get facing(): Facing {
    return this.body.facing;
  }

  set facing(value: Facing) {
    this.body.facing = value;
  }

  get grounded(): boolean {
    return this.body.grounded;
  }

  get stateLocked(): boolean {
    return ['attack', 'hitstun', 'blockstun', 'knockdown', 'getup', 'landing'].includes(this.state);
  }

  get canAct(): boolean {
    return ['idle', 'walk', 'run', 'guard', 'jumpRise', 'jumpFall'].includes(this.state);
  }

  maxWidth(): number {
    return this.body.width;
  }

  speed(): number {
    return 120 * (this.profile.stats.spd / 100) * this.buffSpeed;
  }

  atkFactor(): number {
    return (this.profile.stats.atk / 100) * this.buffAtk;
  }

  skills(): SkillDef[] {
    return this.profile.skills ?? [];
  }

  skillBySlot(slot: number): SkillDef | undefined {
    return this.skills().find((s) => s.slot === slot);
  }

  applyBuff(id: string, def: BuffDef): void {
    this.buffId = id;
    this.buffTicks = def.durationFrames;
    this.buffSpeed = def.speedMultiplier ?? 1;
    this.buffAtk = def.atkMultiplier ?? 1;
  }

  clearBuff(): void {
    this.buffId = null;
    this.buffTicks = 0;
    this.buffSpeed = 1;
    this.buffAtk = 1;
  }

  get buffed(): boolean {
    return this.buffTicks > 0;
  }

  jumpVelocity(): number {
    return -(430 * (this.profile.stats.jump / 100));
  }

  attackById(id: string): AttackDef | undefined {
    return this.profile.attacks.find((attack) => attack.id === id);
  }

  basicAttack(kind: 'light' | 'medium' | 'heavy', grounded: boolean): AttackDef | undefined {
    if (!grounded) return this.attackById(kind === 'light' ? 'air_light' : skillOrAir(kind));
    return this.attackById(kind);
  }

  onCooldown(id: string): boolean {
    return (this.cooldowns.get(id) ?? 0) > 0;
  }

  passiveReady(id: string): boolean {
    return !((this.passiveCooldowns.get(id) ?? 0) > 0);
  }

  tickCooldowns(): void {
    for (const [key, frames] of this.cooldowns) {
      if (frames > 0) this.cooldowns.set(key, frames - 1);
    }
    for (const [key, frames] of this.passiveCooldowns) {
      if (frames > 0) this.passiveCooldowns.set(key, frames - 1);
    }
    if (this.dashCooldown > 0) this.dashCooldown--;
    if (this.invulnFramesLeft > 0) this.invulnFramesLeft--;
    if (this.armorFramesLeft > 0) this.armorFramesLeft--;
    if (this.perfectGuardFrames > 0) {
      this.perfectGuardFrames--;
      if (this.perfectGuardFrames === 0) this.isBlocking = true;
    }
    if (this.buffTicks > 0) {
      this.buffTicks--;
      if (this.buffTicks === 0) this.clearBuff();
    }
    if (!this.isBlocking && ['idle', 'walk', 'run'].includes(this.state)) {
      this.guardMeter = clamp(this.guardMeter + 0.35, 0, 100);
    }
  }

  regenEnergy(frames: number): void {
    const max = this.profile.stats.energy;
    this.energy = clamp(this.energy + frames * 0.1, 0, max);
  }

  setState(state: string): void {
    this.state = state;
    this.stateFrame = 0;
  }

  resetForRound(x: number, y: number, facing: Facing): void {
    this.hp = this.maxHp;
    this.energy = Math.round(this.profile.stats.energy * 0.5);
    this.guardMeter = 100;
    this.cooldowns.clear();
    this.passiveCooldowns.clear();
    this.body.x = x;
    this.body.y = y;
    this.body.vx = 0;
    this.body.vy = 0;
    this.facing = facing;
    this.attack = null;
    this.clearBuff();
    this.isBlocking = false;
    this.guard = 'none';
    this.perfectGuardFrames = 0;
    this.invulnFramesLeft = 0;
    this.stunFramesLeft = 0;
    this.dashCooldown = 0;
    this.landingLag = 0;
    this.airJumpsLeft = 1;
    this.setState('idle');
  }
}

function skillOrAir(kind: string): string {
  return kind === 'medium' || kind === 'heavy' ? 'air_light' : 'air_light';
}
