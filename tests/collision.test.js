import assert from 'node:assert/strict';
import test from 'node:test';
import { ROCKS, SHIP_RADIUS } from '../src/core/constants.js';
import { circleHitsRect, dist } from '../src/core/geometry.js';
import { step } from '../src/core/game.js';
import { idleInputs, quietGame } from './helpers.js';

test('ships stay inside the arena', () => {
  const game = quietGame();
  const ship = game.ships[0];
  ship.x = 4;
  ship.y = 4;
  ship.vx = -300;
  ship.vy = -300;
  step(game, idleInputs());
  assert.ok(ship.x >= SHIP_RADIUS);
  assert.ok(ship.y >= SHIP_RADIUS);
  assert.ok(ship.vx >= 0);
  assert.ok(ship.vy >= 0);
});

test('a ship is pushed out of a rock', () => {
  const game = quietGame();
  const rock = ROCKS[0];
  const ship = game.ships[0];
  ship.x = rock.x + rock.w / 2;
  ship.y = rock.y + rock.h / 2;
  ship.vx = 0;
  ship.vy = 0;
  assert.equal(circleHitsRect(ship, SHIP_RADIUS, rock), true);
  step(game, idleInputs());
  assert.equal(circleHitsRect(ship, SHIP_RADIUS, rock), false);
});

test('overlapping ships separate', () => {
  const game = quietGame();
  const a = game.ships[0];
  const b = game.ships[1];
  a.x = 220;
  a.y = 250;
  b.x = 230;
  b.y = 250;
  a.vx = b.vx = 0;
  a.vy = b.vy = 0;
  step(game, idleInputs());
  assert.ok(dist(a, b) >= SHIP_RADIUS * 2 - 0.01);
});

test('cannonballs break on rocks and damage ships', () => {
  const game = quietGame();
  const rock = ROCKS[0];
  game.balls.push({
    x: rock.x + 10,
    y: rock.y + 10,
    vx: 0,
    vy: 0,
    life: 10,
    grace: 0,
    owner: 0,
    damage: 10,
    radius: 5,
  });
  const ship = game.ships[1];
  ship.x = 220;
  ship.y = 250;
  ship.hull = 80;
  game.balls.push({
    x: ship.x,
    y: ship.y,
    vx: 0,
    vy: 0,
    life: 10,
    grace: 0,
    owner: 0,
    damage: 28,
    radius: 5,
  });
  step(game, idleInputs());
  assert.equal(game.balls.length, 0);
  assert.ok(ship.hull < 80);
  assert.ok(game.events.some((event) => event.type === 'hit' && event.rock));
  assert.ok(game.events.some((event) => event.type === 'hit' && event.player === 1));
});

test('a broadside throws three shots to port and does not hit the shooter during grace', () => {
  const game = quietGame();
  const ship = game.ships[0];
  ship.x = 400;
  ship.y = 260;
  ship.heading = 0;
  ship.vx = 0;
  ship.vy = 0;
  const hull = ship.hull;
  const inputs = idleInputs();
  inputs[0].fireLeft = true;
  step(game, inputs);
  assert.equal(game.balls.length, 3);
  for (const ball of game.balls) assert.ok(ball.vy < 0);
  assert.equal(ship.hull, hull);
});
