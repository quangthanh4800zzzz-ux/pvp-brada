import type { AABB, Facing, Vec2 } from '@shared/types/index.js';

let nextId = 1;

export interface EnvModifier {
  gravityMultiplier: number;
  frictionMultiplier: number;
  movementMultiplier: number;
  horizontalForce: number;
  verticalForce: number;
}

export const NO_MODIFIER: EnvModifier = {
  gravityMultiplier: 1,
  frictionMultiplier: 1,
  movementMultiplier: 1,
  horizontalForce: 0,
  verticalForce: 0
};

export interface Mover {
  id: string;
  aabb: AABB;
  axis: 'x' | 'y';
  origin: number;
  distance: number;
  periodMs: number;
  phase: number;
  dx: number;
  dy: number;
}

export interface DropPlatform extends AABB {
  id: string;
}

export class RigidBody {
  id = nextId++;
  x: number;
  y: number;
  width: number;
  height: number;
  vx = 0;
  vy = 0;
  gravityMultiplier = 1;
  bodyFrictionMultiplier = 1;
  bounciness = 0;
  movementMultiplier = 1;
  facing: Facing = 1;
  grounded = false;
  dropThroughTimer = 0;
  onMover: Mover | null = null;
  maxFallSpeed = 2200;

  constructor(x: number, y: number, width: number, height: number) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  get aabb(): AABB {
    return { x: this.x, y: this.y, width: this.width, height: this.height };
  }

  get centerX(): number {
    return this.x + this.width / 2;
  }

  get centerY(): number {
    return this.y + this.height / 2;
  }

  get bottom(): number {
    return this.y + this.height;
  }

  get left(): number {
    return this.x;
  }

  get right(): number {
    return this.x + this.width;
  }

  get top(): number {
    return this.y;
  }

  nudgeFacing(targetX: number): Facing {
    this.facing = targetX >= this.centerX ? 1 : -1;
    return this.facing;
  }
}

export interface ZoneRegion extends AABB {
  modifier: EnvModifier;
}
