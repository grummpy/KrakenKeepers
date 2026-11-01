import assert from 'node:assert/strict';
import test from 'node:test';
import { DT } from '../src/core/constants.js';
import { integrateShip } from '../src/core/physics.js';

function makeShip(overrides = {}) {
  return {
    x: 400,
    y: 400,
    heading: 0,
    vx: 0,
    vy: 0,
    power: null,
    powerTime: 0,
    ...overrides,
  };
}

function coast(ship, frames, input) {
  for (let i = 0; i < frames; i++) integrateShip(ship, input, DT);
  return ship;
}

test('thrust builds forward speed and the hull keeps moving after the sails drop', () => {
  const ship = coast(makeShip(), 60, { thrust: 1, turn: 0 });
  assert.ok(ship.x > 400);
  assert.ok(ship.vx > 80);
  assert.ok(Math.abs(ship.vy) < 1);
  const peak = ship.vx;
  coast(ship, 60, { thrust: 0, turn: 0 });
  assert.ok(ship.vx < peak);
  assert.ok(ship.vx > 20);
  assert.ok(ship.x > 400);
});

test('turning changes heading without snapping velocity onto the new bow', () => {
  const ship = makeShip({ vx: 200, vy: 0 });
  coast(ship, 20, { thrust: 0, turn: 1 });
  assert.ok(ship.heading > 0.5);
  const speed = Math.hypot(ship.vx, ship.vy);
  const forward = ship.vx * Math.cos(ship.heading) + ship.vy * Math.sin(ship.heading);
  const alignment = Math.abs(forward) / speed;
  assert.ok(alignment < 0.98, `expected sail inertia, alignment was ${alignment}`);
});

test('reverse thrust drives the ship backward', () => {
  const ship = coast(makeShip(), 40, { thrust: -1, turn: 0 });
  assert.ok(ship.vx < -20);
  assert.ok(ship.x < 400);
});
