import { dead, sign } from '@shared/math.js';
import { DEFAULT_AIR_DRAG, DEFAULT_GRAVITY, DEFAULT_GROUND_FRICTION } from '@shared/constants/game.js';
import { NO_MODIFIER, RigidBody, type EnvModifier, type Mover } from './RigidBody.js';

export interface WorldBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Solid extends Rect {
  id: string;
}

export interface StepEvents {
  landedOneWay: boolean;
  wallTouch: -1 | 0 | 1;
}

/**
 * Deterministic, axis-separated AABB physics.
 * Order of operations per step is fixed so the same input sequence always
 * produces the same result: movers -> modifiers -> gravity -> X resolve -> 
 * Y resolve (with one-way landing) -> friction/drag -> bounds.
 */
export class PhysicsWorld {
  solids: Solid[] = [];
  oneWayPlatforms: (Solid & { id: string })[] = [];
  movers: Mover[] = [];
  zones: { region: { x: number; y: number; width: number; height: number }; modifier: EnvModifier; id: string }[] = [];
  bounds: WorldBounds = { left: -1e6, right: 1e6, top: -1e6, bottom: 1e6 };
  gravity = DEFAULT_GRAVITY;
  time = 0;

  addSolid(solid: Solid): void {
    this.solids.push(solid);
  }

  addOneWay(platform: Solid & { id: string }): void {
    this.oneWayPlatforms.push(platform);
  }

  addMover(mover: Mover): void {
    this.movers.push(mover);
  }

  addZone(id: string, region: { x: number; y: number; width: number; height: number }, modifier: Partial<EnvModifier>): void {
    this.zones.push({ id, region, modifier: { ...NO_MODIFIER, ...modifier } });
  }

  modifierAt(x: number, y: number): EnvModifier {
    for (const zone of this.zones) {
      const r = zone.region;
      if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
        return zone.modifier;
      }
    }
    return NO_MODIFIER;
  }

  setBounds(width: number, height: number): void {
    this.bounds = { left: 0, right: width, top: -2000, bottom: height };
  }

  step(dtMs: number, bodies: RigidBody[]): void {
    const dt = dtMs / 1000;
    this.time += dtMs;
    this.updateMovers(dtMs);
    for (const body of bodies) this.stepBody(body, dt);
  }

  private updateMovers(dtMs: number): void {
    for (const mover of this.movers) {
      const before = mover.axis === 'x' ? mover.aabb.x : mover.aabb.y;
      const angle = ((this.time + mover.phase * mover.periodMs) / mover.periodMs) * Math.PI * 2;
      const offset = Math.sin(angle) * mover.distance;
      if (mover.axis === 'x') {
        mover.aabb.x = mover.origin + offset;
        mover.dx = mover.aabb.x - before;
        mover.dy = 0;
      } else {
        mover.aabb.y = mover.origin + offset;
        mover.dy = mover.aabb.y - before;
        mover.dx = 0;
      }
    }
  }

  private stepBody(body: RigidBody, dt: number): void {
    if (body.dropThroughTimer > 0) body.dropThroughTimer -= Math.max(1, 16.67);

    const env = this.modifierAt(body.centerX, body.bottom - 1);

    if (body.onMover) {
      body.x += body.onMover.dx;
      body.y += body.onMover.dy;
    }

    const gravity = this.gravity * body.gravityMultiplier * env.gravityMultiplier;
    body.vy += gravity * dt;
    if (body.vy > body.maxFallSpeed) body.vy = body.maxFallSpeed;

    body.x += env.horizontalForce * dt;

    body.x += body.vx * dt * body.movementMultiplier * env.movementMultiplier;
    this.resolveHorizontal(body);

    body.y += body.vy * dt;
    if (env.verticalForce !== 0) body.y += env.verticalForce * dt;
    this.resolveVertical(body, env, dt);

    this.applyFrictionAndDrag(body, env, dt);
    this.clampToBounds(body);
  }

  private resolveHorizontal(body: RigidBody): void {
    for (const solid of this.solids) {
      if (!this.overlaps(body, solid)) continue;
      const verticalOverlap =
        Math.min(body.bottom, solid.y + solid.height) - Math.max(body.y, solid.y);
      if (verticalOverlap <= 3) continue;
      if (body.vx > 0 || body.centerX >= solid.x + solid.width / 2) {
        body.x = solid.x - body.width;
      } else {
        body.x = solid.x + solid.width;
      }
      if (body.bounciness > 0) {
        body.vx = -body.vx * body.bounciness;
      } else if (sign(body.vx) !== 0) {
        body.vx = 0;
      }
    }
  }

  private resolveVertical(body: RigidBody, env: EnvModifier, dt: number): void {
    let landed = false;
    let landedOnMover: Mover | null = null;
    const prevBottom = body.bottom - body.vy * dt;
    const prevTop = body.top - body.vy * dt;

    for (const solid of this.solids) {
      if (!this.overlaps(body, solid)) continue;
      if (body.vy >= 0 && prevBottom <= solid.y + 1) {
        body.y = solid.y - body.height;
        if (body.bounciness > 0 && body.vy > 200) {
          body.vy = -body.vy * body.bounciness;
        } else {
          body.vy = 0;
          landed = true;
        }
      } else if (body.vy < 0 && prevTop >= solid.y + solid.height - 1) {
        body.y = solid.y + solid.height;
        body.vy = 0;
      }
    }

    if (body.vy >= 0 && body.dropThroughTimer <= 0) {
      const oneWaySurfaces = [
        ...this.oneWayPlatforms.map((p) => ({ aabb: p, mover: null as Mover | null })),
        ...this.movers.map((m) => ({ aabb: m.aabb, mover: m as Mover | null }))
      ];
      const feet = body.bottom;
      for (const { aabb: platform, mover } of oneWaySurfaces) {
        if (
          body.x + body.width > platform.x &&
          body.x < platform.x + platform.width &&
          feet >= platform.y &&
          feet <= platform.y + Math.max(6, body.vy * 0.02 + 2)
        ) {
          body.y = platform.y - body.height;
          body.vy = 0;
          landed = true;
          if (mover) landedOnMover = mover;
        }
      }
    }

    body.grounded = landed;
    body.onMover = landedOnMover;
  }

  private applyFrictionAndDrag(body: RigidBody, env: EnvModifier, dt: number): void {
    if (body.grounded && dead(body.vx, 0.01) === false) {
      const friction = DEFAULT_GROUND_FRICTION * body.bodyFrictionMultiplier * env.frictionMultiplier;
      const applied = friction * dt;
      if (Math.abs(body.vx) <= applied) body.vx = 0;
      else body.vx -= sign(body.vx) * applied;
    } else if (!body.grounded) {
      const drag = DEFAULT_AIR_DRAG * dt;
      if (Math.abs(body.vx) <= drag) body.vx = body.vx;
      else body.vx -= sign(body.vx) * drag * 0.25;
    }
  }

  private clampToBounds(body: RigidBody): void {
    const { left, right, bottom } = this.bounds;
    if (body.x < left) {
      body.x = left;
      if (body.vx < 0) body.vx = 0;
    } else if (body.x + body.width > right) {
      body.x = right - body.width;
      if (body.vx > 0) body.vx = 0;
    }
    if (body.bottom > bottom) {
      body.y = bottom - body.height;
      body.vy = 0;
      body.grounded = true;
    }
  }

  private overlaps(body: RigidBody, solid: { x: number; y: number; width: number; height: number }): boolean {
    return (
      body.x < solid.x + solid.width &&
      body.x + body.width > solid.x &&
      body.y < solid.y + solid.height &&
      body.y + body.height > solid.y
    );
  }
}
