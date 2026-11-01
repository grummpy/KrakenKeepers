import assert from 'node:assert/strict';
import test from 'node:test';
import { ROUND_TICKS, SHIP_HULL } from '../src/core/constants.js';
import { createMatch, step } from '../src/core/game.js';
import { digest, idleInputs, run } from './helpers.js';

test('the same seed and the same inputs play the same game', () => {
  const options = {
    seed: 99,
    skipCountdown: true,
    roundCount: 3,
    slots: ['human', 'human', 'human', 'human'],
  };
  const left = createMatch(options);
  const right = createMatch(options);
  const inputs = idleInputs();
  inputs[0] = { thrust: 1, turn: 0.25, fireLeft: true, fireRight: false };
  inputs[2] = { thrust: 1, turn: -0.4, fireLeft: false, fireRight: true };
  run(left, 400, inputs);
  run(right, 400, inputs);
  assert.equal(digest(left), digest(right));

  const other = createMatch({ ...options, seed: 100 });
  assert.notEqual(
    left.pickups.filter((pickup) => pickup.kind === 'chest').map((pickup) => pickup.x).join(','),
    other.pickups.filter((pickup) => pickup.kind === 'chest').map((pickup) => pickup.x).join(','),
  );
});

test('four bots can finish a three-minute round without falling apart', () => {
  const game = createMatch({
    seed: 1234,
    skipCountdown: true,
    roundCount: 1,
    slots: ['bot', 'bot', 'bot', 'bot'],
  });
  for (let i = 0; i < ROUND_TICKS; i++) step(game);
  assert.equal(game.phase, 'matchEnd');
  assert.ok(game.matchWinner >= 0 && game.matchWinner <= 3);
  assert.equal(game.roundWins[game.matchWinner] >= 1, true);
  for (const ship of game.ships) {
    assert.equal(ship.active, true);
    assert.ok(Number.isFinite(ship.x) && Number.isFinite(ship.y));
    assert.ok(ship.gold >= 0);
    assert.ok(ship.hull >= 0 && ship.hull <= SHIP_HULL);
  }
  for (const pickup of game.pickups) {
    assert.ok(Number.isFinite(pickup.x) && Number.isFinite(pickup.y));
    assert.ok(pickup.value >= 0);
  }
});
