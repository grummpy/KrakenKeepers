import assert from 'node:assert/strict';
import test from 'node:test';
import { RESPAWN_TICKS, SHIP_HULL, SPAWNS } from '../src/core/constants.js';
import { step } from '../src/core/game.js';
import { idleInputs, quietGame, run } from './helpers.js';

function arm(ship, x, y) {
  ship.x = x;
  ship.y = y;
  ship.vx = 0;
  ship.vy = 0;
  ship.invuln = 0;
  ship.sunk = false;
}

test('a hit sinks a ship, drops half its gold, and that ship comes back after 3 seconds', () => {
  const game = quietGame();
  const victim = game.ships[0];
  const hunter = game.ships[1];
  arm(victim, 400, 220);
  arm(hunter, 200, 700);
  victim.gold = 100;
  victim.hull = 30;
  const wreckX = victim.x;
  const wreckY = victim.y;
  game.balls.push({
    x: victim.x,
    y: victim.y,
    vx: 0,
    vy: 0,
    life: 8,
    grace: 0,
    owner: hunter.index,
    damage: 100,
    radius: 6,
  });
  step(game, idleInputs());

  assert.equal(victim.sunk, true);
  assert.equal(victim.hull, 0);
  assert.equal(victim.gold, 50);
  assert.equal(victim.timesSunk, 1);
  assert.equal(hunter.sinks, 1);
  assert.equal(victim.respawnIn, RESPAWN_TICKS);
  const coins = game.pickups.filter((pickup) => pickup.kind === 'coin');
  const dropped = coins.reduce((sum, coin) => sum + coin.value, 0);
  assert.equal(dropped, 50);
  assert.ok(game.events.some((event) => event.type === 'sink' && event.player === 0));

  run(game, 10, idleInputs());
  assert.equal(victim.x, wreckX);
  assert.equal(victim.y, wreckY);
  assert.equal(victim.sunk, true);

  run(game, 169, idleInputs());
  assert.equal(victim.sunk, true);
  step(game, idleInputs());
  assert.equal(victim.sunk, false);
  assert.equal(victim.hull, SHIP_HULL);
  assert.equal(victim.gold, 50);
  assert.equal(victim.x, SPAWNS[0].x);
  assert.equal(victim.y, SPAWNS[0].y);
  assert.ok(victim.invuln > 0);

  game.balls.push({
    x: victim.x,
    y: victim.y,
    vx: 0,
    vy: 0,
    life: 4,
    grace: 0,
    owner: 1,
    damage: 40,
    radius: 6,
  });
  step(game, idleInputs());
  assert.equal(victim.hull, SHIP_HULL);
  assert.equal(victim.sunk, false);
});

test('a port broadside can eliminate a ship sitting off the beam', () => {
  const game = quietGame();
  const shooter = game.ships[0];
  const target = game.ships[1];
  arm(shooter, 480, 260);
  arm(target, 480, 180);
  shooter.heading = 0;
  target.hull = 20;
  target.gold = 20;
  const inputs = idleInputs();
  inputs[0].fireLeft = true;
  step(game, inputs);
  run(game, 20, idleInputs());
  assert.equal(target.sunk, true);
  assert.equal(target.gold, 10);
  assert.equal(shooter.sinks, 1);
});
