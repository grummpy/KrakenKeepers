import assert from 'node:assert/strict';
import test from 'node:test';
import {
  BALL_DAMAGE,
  CANNON_COOLDOWN_TICKS,
  DT,
  KRAKEN_DAMAGE,
  KRAKEN_RETRY_TICKS,
  PATCH_HEAL,
  SHIP_HULL,
} from '../src/core/constants.js';
import { step } from '../src/core/game.js';
import { integrateShip } from '../src/core/physics.js';
import { idleInputs, quietGame } from './helpers.js';

function place(ship, x, y) {
  ship.x = x;
  ship.y = y;
  ship.vx = 0;
  ship.vy = 0;
  ship.invuln = 0;
}

test('powder, wind, and patch each change the ship that picks them up', () => {
  const powder = quietGame({ seed: 11 });
  const ship = powder.ships[0];
  place(ship, 480, 260);
  powder.pickups.push({
    kind: 'power', type: 'powder', x: ship.x, y: ship.y, radius: 16, value: 0, alive: true,
  });
  step(powder, idleInputs());
  assert.equal(ship.power, 'powder');
  assert.ok(ship.powerTime > 0);
  const inputs = idleInputs();
  inputs[0].fireLeft = true;
  step(powder, inputs);
  assert.equal(ship.cdLeft, CANNON_COOLDOWN_TICKS / 2);

  const plain = { x: 0, y: 0, heading: 0, vx: 0, vy: 0, power: null, powerTime: 0 };
  const gust = { x: 0, y: 0, heading: 0, vx: 0, vy: 0, power: 'wind', powerTime: 500 };
  for (let i = 0; i < 90; i++) {
    integrateShip(plain, { thrust: 1, turn: 0 }, DT);
    integrateShip(gust, { thrust: 1, turn: 0 }, DT);
  }
  assert.ok(gust.x > plain.x);

  const healed = quietGame({ seed: 12 });
  const patient = healed.ships[0];
  place(patient, 480, 260);
  patient.hull = 40;
  healed.pickups.push({
    kind: 'power', type: 'patch', x: patient.x, y: patient.y, radius: 16, value: 0, alive: true,
  });
  step(healed, idleInputs());
  assert.equal(patient.hull, 40 + PATCH_HEAL);
  assert.equal(patient.power, 'patch');
  healed.balls.push({
    x: patient.x, y: patient.y, vx: 0, vy: 0, life: 5, grace: 0, owner: 1, damage: BALL_DAMAGE, radius: 5,
  });
  step(healed, idleInputs());
  assert.equal(patient.hull, 40 + PATCH_HEAL - BALL_DAMAGE / 2);
  assert.ok(patient.hull <= SHIP_HULL);
});

test('the kraken telegraphs the gold leader and only then slams', () => {
  const game = quietGame({ seed: 9 });
  const leader = game.ships[0];
  const bystander = game.ships[1];
  place(leader, 480, 260);
  place(bystander, 180, 700);
  leader.gold = 80;
  bystander.gold = 10;
  leader.hull = 100;
  bystander.hull = 100;
  game.kraken.state = 'idle';
  game.kraken.timer = 1;
  step(game, idleInputs());
  assert.equal(game.kraken.state, 'telegraph');
  assert.equal(game.kraken.target, 0);
  assert.ok(Math.hypot(game.kraken.x - 480, game.kraken.y - 260) < 1);
  const markX = game.kraken.x;
  leader.x = 600;
  game.kraken.timer = 8;
  step(game, idleInputs());
  assert.equal(game.kraken.state, 'telegraph');
  assert.equal(game.kraken.x, markX);
  assert.equal(leader.hull, 100);

  game.kraken.timer = 1;
  leader.x = markX;
  leader.y = game.kraken.y;
  step(game, idleInputs());
  assert.equal(game.kraken.state, 'idle');
  assert.equal(leader.hull, 100 - KRAKEN_DAMAGE);
  assert.equal(bystander.hull, 100);
  assert.ok(game.events.some((event) => event.type === 'kraken'));
});

test('with no gold on the water the kraken waits', () => {
  const game = quietGame();
  for (const ship of game.ships) ship.gold = 0;
  game.kraken.state = 'idle';
  game.kraken.timer = 1;
  step(game, idleInputs());
  assert.equal(game.kraken.state, 'idle');
  assert.equal(game.kraken.timer, KRAKEN_RETRY_TICKS);
  assert.equal(game.ships[0].hull, 100);
});
