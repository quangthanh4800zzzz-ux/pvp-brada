import { describe, expect, it } from 'vitest';
import { PhysicsWorld } from '../../client/src/physics/PhysicsWorld.js';
import { RigidBody } from '../../client/src/physics/RigidBody.js';

function makeGround(): PhysicsWorld {
  const world = new PhysicsWorld();
  world.setBounds(960, 360);
  world.addSolid({ id: 'ground', x: 0, y: 312, width: 960, height: 48 });
  return world;
}

describe('PhysicsWorld', () => {
  it('falls under gravity and lands on the ground', () => {
    const world = makeGround();
    const body = new RigidBody(100, 100, 16, 34);
    for (let i = 0; i < 120; i++) world.step(1000 / 60, [body]);
    expect(body.grounded).toBe(true);
    expect(body.bottom).toBeCloseTo(312, 0);
  });

  it('stops horizontally at solid walls', () => {
    const world = makeGround();
    world.addSolid({ id: 'wall', x: 400, y: 240, width: 20, height: 80 });
    const body = new RigidBody(300, 278, 16, 34);
    body.grounded = true;
    body.vx = 400;
    for (let i = 0; i < 60; i++) world.step(1000 / 60, [body]);
    expect(body.right).toBeLessThanOrEqual(400.01);
    expect(body.vx).toBe(0);
  });

  it('lands on one-way platforms only from above', () => {
    const world = makeGround();
    world.addOneWay({ id: 'platform', x: 100, y: 240, width: 120, height: 8 });
    const body = new RigidBody(150, 180, 16, 34);
    for (let i = 0; i < 90; i++) world.step(1000 / 60, [body]);
    expect(body.bottom).toBeCloseTo(240, 0);

    const fromBelow = new RigidBody(150, 250, 16, 34);
    fromBelow.vy = -400;
    for (let i = 0; i < 12; i++) world.step(1000 / 60, [fromBelow]);
    expect(fromBelow.top).toBeLessThan(240);
  });

  it('carries riders with moving platforms', () => {
    const world = makeGround();
    world.addMover({
      id: 'lift',
      aabb: { x: 100, y: 240, width: 80, height: 8 },
      axis: 'x',
      origin: 100,
      distance: 40,
      periodMs: 4000,
      phase: 0,
      dx: 0,
      dy: 0
    });
    const rider = new RigidBody(130, 200, 16, 34);
    for (let i = 0; i < 60; i++) world.step(1000 / 60, [rider]);
    expect(rider.bottom).toBeLessThanOrEqual(241);
    expect(rider.grounded).toBe(true);
    expect(Math.abs(rider.x - 130)).toBeGreaterThan(4);
  });

  it('applies gravity modifiers from zones', () => {
    const world = makeGround();
    world.addZone('lowg', { x: 0, y: 0, width: 960, height: 360 }, { gravityMultiplier: 0.25 });
    const body = new RigidBody(100, 100, 16, 34);
    const normalWorld = makeGround();
    const normalBody = new RigidBody(100, 100, 16, 34);
    for (let i = 0; i < 30; i++) {
      world.step(1000 / 60, [body]);
      normalWorld.step(1000 / 60, [normalBody]);
    }
    expect(body.y).toBeLessThan(normalBody.y);
  });

  it('applies horizontal force from wind zones', () => {
    const world = makeGround();
    world.addSolid({ id: 'bookend', x: 900, y: 200, width: 20, height: 160 });
    world.addZone('wind', { x: 0, y: 100, width: 880, height: 260 }, { horizontalForce: 150 });
    const body = new RigidBody(100, 278, 16, 34);
    body.grounded = true;
    for (let i = 0; i < 60; i++) world.step(1000 / 60, [body]);
    expect(body.x).toBeGreaterThan(120);
  });

  it('respects friction multiplier in slip zones', () => {
    const world = makeGround();
    world.addZone('ice', { x: 200, y: 200, width: 400, height: 120 }, { frictionMultiplier: 0.05 });
    const body = new RigidBody(250, 310, 16, 34);
    body.vx = 200;
    for (let i = 0; i < 60; i++) world.step(1000 / 60, [body]);
    expect(body.x).toBeGreaterThan(300);
  });
});
