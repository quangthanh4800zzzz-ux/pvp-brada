import { clamp } from '@shared/math.js';
import { COMBO, GUARD, ROUND } from '@shared/constants/game.js';
import { aabbIntersects, type AABB, type AttackDef, type CharacterProfile, type Intent, type MapDefinition } from '@shared/types/index.js';
import { PhysicsWorld } from '../physics/PhysicsWorld.js';
import { FIGHTER_HEIGHT, FIGHTER_WIDTH, FighterSim } from './FighterSim.js';

export type CombatEvent =
  | { type: 'hit'; attacker: number; defender: number; attackId: string; damage: number; blocked: boolean; perfect: boolean; hitstop: number }
  | { type: 'ko'; fighter: number }
  | { type: 'roundEnd'; winner: number | null }
  | { type: 'combo'; attacker: number; hits: number; damage: number }
  | { type: 'action'; fighter: number; action: string; attackId?: string };

export interface ComboTracker {
  hits: number;
  damage: number;
  timer: number;
}

export interface HitSample {
  fighter: number;
  box: AABB;
  kind: 'hit' | 'hurt';
}

/**
 * Headless, deterministic battle simulation. One `step()` equals one 60Hz tick.
 * Hit detection, guard resolution, combo scaling and round flow all live here,
 * so the exact same classes can be re-used by dedicated-server simulation.
 */
export class BattleSim {
  readonly fighters: [FighterSim, FighterSim];
  readonly physics: PhysicsWorld;
  events: CombatEvent[] = [];
  combo: Record<number, ComboTracker> = { 1: resetCombo(), 2: resetCombo() };
  hitstop = 0;
  roundTime = ROUND.durationSeconds;
  roundOver = false;
  winner: number | null = null;
  roundsWon: Record<number, number> = { 1: 0, 2: 0 };
  facingLocked = false;
  trainingMode = false;
  trainingInfiniteHp = false;
  debugSpawns: HitSample[] = [];

  constructor(mapDefinition: MapDefinition, profiles: [CharacterProfile, CharacterProfile]) {
    this.mapDefinition = mapDefinition;
    this.physics = new PhysicsWorld();
    this.physics.setBounds(mapDefinition.bounds.width, mapDefinition.bounds.height);
    for (const solid of mapDefinition.solids) {
      const entry = { id: `s${this.physics.solids.length}`, x: solid.x, y: solid.y, width: solid.width, height: solid.height };
      if (solid.oneWay) this.physics.addOneWay(entry);
      else this.physics.addSolid(entry);
    }
    for (const mover of mapDefinition.movers) {
      this.physics.addMover({
        id: mover.id,
        aabb: { x: mover.x, y: mover.y, width: mover.width, height: mover.height },
        axis: mover.axis,
        origin: mover.axis === 'x' ? mover.x : mover.y,
        distance: mover.distance,
        periodMs: mover.periodMs,
        phase: mover.phase,
        dx: 0,
        dy: 0
      });
    }
    for (const zone of mapDefinition.zones) {
      this.physics.addZone(zone.id, zone.region, {
        gravityMultiplier: zone.gravityMultiplier ?? 1,
        frictionMultiplier: zone.frictionMultiplier ?? 1,
        movementMultiplier: zone.movementMultiplier ?? 1,
        horizontalForce: zone.horizontalForce ?? 0,
        verticalForce: zone.verticalForce ?? 0
      });
    }

    this.fighters = [
      new FighterSim({ profile: profiles[0], team: 1, side: 1, spawnX: mapDefinition.spawn1.x, spawnY: mapDefinition.spawn1.y }),
      new FighterSim({ profile: profiles[1], team: 2, side: 2, spawnX: mapDefinition.spawn2.x, spawnY: mapDefinition.spawn2.y })
    ];
  }

  private mapDefinition: MapDefinition;

  step(intents: [Intent, Intent]): CombatEvent[] {
    this.events = [];
    if (this.hitstop > 0) {
      this.hitstop--;
      for (const fighter of this.fighters) tickState(fighter);
      return this.events;
    }

    this.tickRoundClock();

    for (let i = 0; i < 2; i++) {
      const fighter = this.fighters[i] as FighterSim;
      const intent = intents[i] as Intent;
      if (!this.roundOver) this.processIntent(fighter, intent);
      tickState(fighter);
    }

    this.physics.step(1000 / 60, this.fighters.map((f) => f.body));
    this.trackLanding();

    this.updateFacing();
    this.resolveMelee();
    this.tickCombos();
    return this.events;
  }

  private trackLanding(): void {
    for (const fighter of this.fighters) {
      if (fighter.body.grounded && ['jumpRise', 'jumpFall'].includes(fighter.state)) {
        fighter.setState('landing');
        if (fighter.attack && fighter.attack.requiresGrounded) fighter.attack = null;
        fighter.airJumpsLeft = 1;
      }
    }
  }

  private tickRoundClock(): void {
    if (this.trainingMode || this.roundOver) return;
    this.roundTime -= 1 / 60;
    if (this.roundTime <= 0) {
      this.roundTime = 0;
      const [a, b] = this.fighters;
      const winner = a.hp === b.hp ? null : a.hp > b.hp ? 1 : 2;
      this.finishRound(winner);
    }
  }

  private finishRound(winner: number | null): void {
    this.roundOver = true;
    this.winner = winner;
    if (winner !== null) this.roundsWon[winner] = (this.roundsWon[winner] ?? 0) + 1;
    this.events.push({ type: 'roundEnd', winner });
    for (const fighter of this.fighters) {
      fighter.setState(fighter.side === winner ? 'victory' : winner === null ? 'idle' : 'defeat');
    }
  }

  nextRound(): void {
    this.roundOver = false;
    this.winner = null;
    this.roundTime = ROUND.durationSeconds;
    this.fighters[0]?.resetForRound(this.mapDefinition.spawn1.x, this.mapDefinition.spawn1.y, 1);
    this.fighters[1]?.resetForRound(this.mapDefinition.spawn2.x, this.mapDefinition.spawn2.y, -1);
    this.combo = { 1: resetCombo(), 2: resetCombo() };
  }

  getFighter(side: number): FighterSim {
    return (side === 1 ? this.fighters[0] : this.fighters[1]) as FighterSim;
  }

  private updateFacing(): void {
    const [a, b] = this.fighters;
    if (!['attack', 'hitstun'].includes(a.state)) a.facing = (b.body.centerX >= a.body.centerX ? 1 : -1) as 1 | -1;
    if (!['attack', 'hitstun'].includes(b.state)) b.facing = (a.body.centerX >= b.body.centerX ? 1 : -1) as 1 | -1;
  }

  private processIntent(fighter: FighterSim, intent: Intent): void {
    const body = fighter.body;
    if (['hitstun', 'blockstun', 'knockdown', 'getup'].includes(fighter.state)) return;

    if (fighter.state === 'attack' && fighter.attack) {
      this.processAttackMovement(fighter);
      this.maybeCancel(fighter, intent);
      return;
    }

    const wantsGuard = intent.guardHeld && fighter.grounded;
    if (wantsGuard && !fighter.isBlocking) {
      fighter.guard = intent.down ? 'low' : 'high';
      fighter.isBlocking = true;
      fighter.perfectGuardFrames = GUARD.perfectWindowFrames;
      fighter.setState('guard');
      body.vx = 0;
      this.events.push({ type: 'action', fighter: fighter.side, action: 'guard' });
      return;
    }
    if (!wantsGuard && fighter.isBlocking) {
      fighter.isBlocking = false;
      fighter.guard = 'none';
      if (fighter.state === 'guard') fighter.setState('idle');
    }
    if (fighter.isBlocking) {
      fighter.guard = intent.down ? 'low' : 'high';
      body.vx = 0;
      return;
    }

    if (intent.attackPressed) {
      const attack = fighter.basicAttack(intent.attackPressed, fighter.grounded);
      if (attack && this.canStartAttack(fighter, attack)) {
        this.startAttack(fighter, attack);
        return;
      }
    }

    if (fighter.state === 'dash') {
      if (intent.attackPressed) {
        const dashAttack = fighter.attackById('dash_attack');
        if (dashAttack && this.canStartAttack(fighter, dashAttack)) {
          this.startAttack(fighter, dashAttack);
          return;
        }
      }
      if (fighter.stateFrame > 12) fighter.setState('idle');
      return;
    }

    if (intent.dashPressed && fighter.dashCooldown === 0) {
      const dir = (intent.moveX !== 0 ? intent.moveX : fighter.facing) as -1 | 1;
      fighter.setState('dash');
      body.vx = dir * fighter.speed() * 3.2;
      fighter.dashCooldown = 26;
      this.events.push({ type: 'action', fighter: fighter.side, action: 'dash' });
      return;
    }

    if (intent.jumpPressed) {
      if (fighter.grounded && intent.down && this.canDropThrough(body)) {
        body.dropThroughTimer = 250;
        body.vy = 120;
      } else if (fighter.grounded || fighter.airJumpsLeft > 0) {
        if (!fighter.grounded) fighter.airJumpsLeft--;
        body.vy = fighter.jumpVelocity();
        body.vx = intent.moveX * fighter.speed();
        this.events.push({ type: 'action', fighter: fighter.side, action: 'jump' });
      }
    }

    const moveSpeed = fighter.speed();
    if (intent.moveX !== 0) {
      body.vx = intent.moveX * moveSpeed;
      if (fighter.state === 'idle') fighter.setState('walk');
      else if (fighter.state === 'walk' && Math.abs(intent.moveX) > 0.99) fighter.setState('run');
    } else if (fighter.grounded && ['walk', 'run'].includes(fighter.state)) {
      fighter.setState('idle');
    }
  }

  private canDropThrough(body: { x: number; width: number; bottom: number }): boolean {
    return this.physics.oneWayPlatforms.some(
      (p) => body.bottom >= p.y - 2 && body.bottom <= p.y + 4 && body.x + body.width > p.x && body.x < p.x + p.width
    );
  }

  private maybeCancel(fighter: FighterSim, intent: Intent): void {
    if (!fighter.attack) return;
    const { startup, active } = fighter.attack.frames;
    const cancelFrame = startup + active - 2;
    if (fighter.stateFrame < cancelFrame) return;

    if (intent.attackPressed) {
      const next = fighter.basicAttack(intent.attackPressed, fighter.grounded);
      if (next && next.id !== fighter.attack.id) {
        this.startAttack(fighter, next);
        this.events.push({ type: 'action', fighter: fighter.side, action: 'cancel', attackId: next.id });
      }
    } else if (intent.dashPressed && fighter.dashCooldown === 0) {
      fighter.setState('dash');
      fighter.attack = null;
      fighter.body.vx = fighter.facing * fighter.speed() * 3.2;
      fighter.dashCooldown = 26;
    } else if (intent.guardHeld && fighter.grounded) {
      fighter.setState('guard');
      fighter.isBlocking = true;
      fighter.guard = intent.down ? 'low' : 'high';
      fighter.perfectGuardFrames = GUARD.perfectWindowFrames;
      fighter.attack = null;
    }
  }

  private processAttackMovement(fighter: FighterSim): void {
    if (!fighter.attack) return;
    const lunge = fighter.attack.forwardLunge;
    if (lunge && fighter.stateFrame === fighter.attack.frames.startup) {
      fighter.body.vx = fighter.facing * lunge;
    }
  }

  canStartAttack(fighter: FighterSim, attack: AttackDef): boolean {
    return !fighter.onCooldown(attack.id) && attack.energyCost <= fighter.energy && (!attack.requiresGrounded || fighter.grounded) && fighter.canAct;
  }

  startAttack(fighter: FighterSim, attack: AttackDef): void {
    fighter.attack = attack;
    fighter.attackTotalFrames = attack.frames.startup + attack.frames.active + attack.frames.recovery;
    fighter.attackHasHit = false;
    fighter.attackStartedInAir = !fighter.grounded;
    fighter.setState('attack');
    fighter.energy = clamp(fighter.energy - attack.energyCost, 0, fighter.profile.stats.energy);
    fighter.cooldowns.set(attack.id, attack.cooldown || 1);
    if (attack.invulnFrames) fighter.invulnFramesLeft = attack.invulnFrames[1] - attack.invulnFrames[0];
    else fighter.invulnFramesLeft = 0;
    if (attack.armorFrames) fighter.armorFramesLeft = attack.armorFrames[1] - attack.armorFrames[0];
    else fighter.armorFramesLeft = 0;
    this.events.push({ type: 'action', fighter: fighter.side, action: 'attack', attackId: attack.id });
  }

  private resolveMelee(): void {
    for (let i = 0; i < 2; i++) {
      const attacker = this.fighters[i] as FighterSim;
      const defender = this.fighters[1 - i] as FighterSim;
      if (attacker.state !== 'attack' || !attacker.attack || attacker.attackHasHit) continue;
      const attack = attacker.attack;
      const activeFrame = attacker.stateFrame - attack.frames.startup;
      if (activeFrame < 0 || activeFrame >= attack.frames.active) continue;
      const window = attack.hitboxWindows.find((w) => attacker.stateFrame >= w.startFrame && attacker.stateFrame <= w.endFrame);
      if (!window) continue;

      const hitbox = this.worldHitbox(attacker, window);
      this.debugSpawns.push({ fighter: attacker.side, box: hitbox, kind: 'hit' });
      this.debugSpawns.push({ fighter: defender.side, box: this.hurtbox(defender), kind: 'hurt' });

      if (!aabbIntersects(hitbox, this.hurtbox(defender))) continue;
      if (defender.invulnFramesLeft > 0) continue;

      const result = this.applyHit(attacker, defender, attack, window.damageMultiplier);
      attacker.attackHasHit = true;
      this.hitstop = ROUND.hitstopFrames[attack.hitstop] ?? 4;
      this.events.push({
        type: 'hit',
        attacker: attacker.side,
        defender: defender.side,
        attackId: attack.id,
        damage: Math.round(result.damage),
        blocked: result.blocked,
        perfect: result.perfect,
        hitstop: this.hitstop
      });
    }
  }

  /** Hitbox in world space, mirrored by facing. */
  worldHitbox(fighter: FighterSim, window: { box: { offsetX: number; offsetY: number; width: number; height: number } }): AABB {
    const body = fighter.body;
    const ox =
      fighter.facing === 1
        ? body.centerX + window.box.offsetX
        : body.centerX - window.box.offsetX - window.box.width;
    return { x: ox, y: body.y + window.box.offsetY, width: window.box.width, height: window.box.height };
  }

  hurtbox(fighter: FighterSim): AABB {
    return { x: fighter.body.x, y: fighter.body.y, width: fighter.body.width, height: FIGHTER_HEIGHT };
  }

  private applyHit(attacker: FighterSim, defender: FighterSim, attack: AttackDef, multiplier: number): { damage: number; blocked: boolean; perfect: boolean } {
    const attackDirection = (attacker.body.centerX < defender.body.centerX ? -1 : 1) as -1 | 1;
    const facingAttack = defender.facing === attackDirection;

    if (defender.isBlocking && facingAttack && attack.canBeBlocked) {
      const perfect = defender.perfectGuardFrames > 0;
      if (perfect) {
        defender.perfectGuardFrames = 0;
        defender.isBlocking = true;
        defender.stunFramesLeft = 0;
        attacker.energy = clamp(attacker.energy - 6, 0, attacker.profile.stats.energy);
        this.punishAttacker(attacker, attack);
        return { damage: 0, blocked: true, perfect: true };
      }
      const guardOk =
        defender.guard === 'low' ? attack.guardHeight !== 'high' : attack.guardHeight !== 'low';
      if (!guardOk) {
        return this.applyDamage(attacker, defender, attack, multiplier);
      }
      const chip = attack.damage * multiplier * GUARD.chipDamageRatio;
      if (!this.trainingInfiniteHp) {
        defender.hp = Math.max(0, defender.hp - Math.round(chip));
      }
      defender.guardMeter -= GUARD.chipCost;
      defender.stunFramesLeft = attack.blockstun;
      defender.setState('blockstun');
      defender.body.vx = attacker.facing * attack.knockbackX * 0.25;
      if (defender.guardMeter <= 0) {
        defender.guardMeter = GUARD.maxMeter * 0.5;
        defender.isBlocking = false;
        defender.setState('hitstun');
        defender.stunFramesLeft = GUARD.breakStunFrames;
        defender.body.vx = attacker.facing * attack.knockbackX * 1.4;
        this.events.push({ type: 'action', fighter: defender.side, action: 'guardBreak' });
      }
      this.resetCombo(attacker);
      defender.energy = clamp(defender.energy + 2, 0, defender.profile.stats.energy);
      return { damage: chip, blocked: true, perfect: false };
    }

    return this.applyDamage(attacker, defender, attack, multiplier);
  }

  private applyDamage(attacker: FighterSim, defender: FighterSim, attack: AttackDef, multiplier: number): { damage: number; blocked: boolean; perfect: boolean } {
    const damage = this.computeDamage(attacker, defender, attack, multiplier);
    if (!this.trainingInfiniteHp) {
      defender.hp = Math.max(0, defender.hp - Math.round(damage));
    }

    const combo = this.comboFor(attacker.side);
    combo.hits += 1;
    combo.damage += damage;
    combo.timer = COMBO.resetFrames;
    this.events.push({ type: 'combo', attacker: attacker.side, hits: combo.hits, damage: Math.round(combo.damage) });

    defender.isBlocking = false;
    defender.guard = 'none';
    defender.perfectGuardFrames = 0;
    defender.stunFramesLeft = Math.max(COMBO.minHitstun, attack.hitstun - combo.hits * COMBO.hitstunDeteriorationPerHit);
    const escalation = combo.hits > COMBO.antiInfiniteThreshold ? COMBO.knockbackEscalation : 1;
    defender.body.vx = attacker.facing * attack.knockbackX * escalation;
    if (attack.knockbackY !== 0) {
      defender.body.vy = attack.knockbackY * (defender.grounded ? 1 : 1.15);
      defender.body.grounded = false;
    }
    defender.setState('hitstun');
    if (defender.hp <= 0) {
      defender.setState('knockdown');
      this.events.push({ type: 'ko', fighter: defender.side });
      if (!this.trainingMode) this.finishRound(defender.side === 1 ? 2 : 1);
    }
    attacker.energy = clamp(attacker.energy + 4, 0, attacker.profile.stats.energy);
    return { damage, blocked: false, perfect: false };
  }

  computeDamage(attacker: FighterSim, defender: FighterSim, attack: AttackDef, multiplier: number): number {
    const combo = this.comboFor(attacker.side);
    const scalingFactor = attack.comboScaling ?? COMBO.defaultScalingFactor;
    const scaling = Math.max(COMBO.minScaling, Math.pow(scalingFactor, combo.hits));
    const atkFactor = attacker.profile.stats.atk / 100;
    const defFactor = 200 / (100 + defender.profile.stats.def);
    return attack.damage * multiplier * scaling * atkFactor * defFactor;
  }

  private punishAttacker(attacker: FighterSim, attack: AttackDef): void {
    if (attacker.state === 'attack') {
      attacker.setState('idle');
      attacker.attack = null;
      attacker.stunFramesLeft = Math.round(attack.frames.recovery * 0.5);
    }
  }

  resetCombo(fighter: FighterSim): void {
    this.combo[fighter.side as 1 | 2] = resetCombo();
  }

  comboFor(side: number): ComboTracker {
    if (side !== 1 && side !== 2) throw new Error(`invalid combo side: ${side}`);
    return this.combo[side] as ComboTracker;
  }

  private tickCombos(): void {
    for (const side of [1, 2] as const) {
      const combo = this.comboFor(side);
      if (combo.timer > 0) {
        combo.timer--;
        if (combo.timer === 0) this.resetCombo(this.getFighter(side));
      }
    }
  }
}

function resetCombo(): ComboTracker {
  return { hits: 0, damage: 0, timer: 0 };
}

function tickState(fighter: FighterSim): void {
  fighter.tickCooldowns();
  fighter.regenEnergy(1);
  if (fighter.state === 'attack' && fighter.attack) {
    const total = fighter.attackTotalFrames;
    if (fighter.stateFrame >= total - 1) {
      const backTo = fighter.attackStartedInAir && !fighter.body.grounded ? 'jumpFall' : 'idle';
      fighter.setState(backTo);
      fighter.attack = null;
    } else {
      fighter.stateFrame++;
    }
  } else if (fighter.state === 'hitstun' || fighter.state === 'blockstun') {
    if (fighter.stunFramesLeft > 0) fighter.stunFramesLeft--;
    if (fighter.stunFramesLeft === 0 && fighter.body.grounded) fighter.setState('idle');
    fighter.stateFrame++;
  } else if (fighter.state === 'knockdown') {
    if (fighter.body.grounded && fighter.body.vy === 0 && fighter.stateFrame > 14) {
      fighter.setState('getup');
    }
    fighter.stateFrame++;
  } else if (fighter.state === 'getup') {
    if (fighter.stateFrame >= 10) fighter.setState('idle');
    else fighter.stateFrame++;
  } else if (fighter.state === 'landing') {
    if (fighter.stateFrame >= 4) fighter.setState('idle');
    else fighter.stateFrame++;
  } else {
    fighter.stateFrame++;
  }
}
