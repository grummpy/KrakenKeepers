import assert from 'node:assert/strict';
import test from 'node:test';
import { CHEST_GOLD, ROUND_TICKS } from '../src/core/constants.js';
import { createMatch, step } from '../src/core/game.js';
import { formatClock, pickRoundWinner, winsNeeded } from '../src/core/rules.js';
import { idleInputs, quietGame, run } from './helpers.js';

test('clock, majority, and tie breaks', () => {
  assert.equal(formatClock(ROUND_TICKS), '3:00');
  assert.equal(formatClock(61), '0:02');
  assert.equal(formatClock(60), '0:01');
  assert.equal(formatClock(0), '0:00');
  assert.equal(winsNeeded(1), 1);
  assert.equal(winsNeeded(3), 2);
  assert.equal(winsNeeded(5), 3);

  const ships = [
    { index: 0, active: true, gold: 40, timesSunk: 2, sinks: 1 },
    { index: 1, active: true, gold: 40, timesSunk: 0, sinks: 0 },
    { index: 2, active: false, gold: 999, timesSunk: 0, sinks: 0 },
    { index: 3, active: true, gold: 10, timesSunk: 0, sinks: 4 },
  ];
  assert.equal(pickRoundWinner(ships), 1);
  ships[1].timesSunk = 2;
  ships[1].sinks = 0;
  ships[0].sinks = 3;
  assert.equal(pickRoundWinner(ships), 0);
});

function finishRound(game, golds) {
  game.phase = 'playing';
  game.pickups = [];
  game.balls = [];
  golds.forEach((gold, index) => {
    game.ships[index].gold = gold;
  });
  game.roundTicksLeft = 1;
  step(game, idleInputs());
}

function advanceBanner(game) {
  game.bannerTicks = 1;
  step(game, idleInputs());
  assert.equal(game.phase, 'countdown');
  game.countdownTicks = 1;
  step(game, idleInputs());
  assert.equal(game.phase, 'playing');
}

test('a chest pays gold and a single round match ends on the clock', () => {
  const game = quietGame();
  const ship = game.ships[0];
  game.pickups.push({
    kind: 'chest',
    type: null,
    x: ship.x,
    y: ship.y,
    radius: 14,
    value: CHEST_GOLD,
    alive: true,
    respawnIn: 0,
  });
  step(game, idleInputs());
  assert.equal(ship.gold, CHEST_GOLD);

  const match = createMatch({
    seed: 3,
    skipCountdown: true,
    roundCount: 1,
    slots: ['human', 'human', 'human', 'off'],
  });
  finishRound(match, [12, 4, 0, 80]);
  assert.equal(match.phase, 'matchEnd');
  assert.equal(match.matchWinner, 0);
  assert.equal(match.roundWins[0], 1);
  assert.equal(match.roundWins[3], 0);
});

test('best of three ends early when one crew takes two rounds', () => {
  const game = createMatch({
    seed: 5,
    skipCountdown: true,
    roundCount: 3,
    slots: ['human', 'human', 'bot', 'off'],
  });
  finishRound(game, [20, 5, 0, 0]);
  assert.equal(game.phase, 'roundEnd');
  assert.equal(game.roundWins[0], 1);
  advanceBanner(game);
  assert.equal(game.round, 2);
  assert.equal(game.ships[0].gold, 0);
  finishRound(game, [8, 1, 0, 0]);
  assert.equal(game.phase, 'matchEnd');
  assert.equal(game.matchWinner, 0);
  assert.equal(game.round, 2);
  assert.deepEqual(game.roundWins, [2, 0, 0, 0]);
});

test('a split match plays the deciding round', () => {
  const game = createMatch({
    seed: 6,
    skipCountdown: true,
    roundCount: 3,
    slots: ['human', 'human', 'human', 'human'],
  });
  finishRound(game, [5, 1, 0, 0]);
  advanceBanner(game);
  finishRound(game, [1, 9, 0, 0]);
  assert.equal(game.phase, 'roundEnd');
  advanceBanner(game);
  assert.equal(game.round, 3);
  finishRound(game, [0, 4, 2, 1]);
  assert.equal(game.phase, 'matchEnd');
  assert.equal(game.matchWinner, 1);
  assert.equal(game.roundWins[1], 2);
});

test('the round timer survives a short run and then expires', () => {
  const game = createMatch({ seed: 1, skipCountdown: true, roundCount: 1 });
  run(game, 5);
  assert.equal(game.phase, 'playing');
  assert.equal(game.roundTicksLeft, ROUND_TICKS - 5);
});
