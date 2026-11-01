import { createMatch, step } from '../src/core/game.js';

export function quietGame(options = {}) {
  const game = createMatch({
    seed: options.seed ?? 1,
    skipCountdown: true,
    roundCount: options.roundCount ?? 1,
    slots: options.slots ?? ['human', 'human', 'human', 'human'],
  });
  game.roundTicksLeft = 100000;
  game.kraken.timer = 100000;
  game.kraken.state = 'idle';
  game.powerTimer = 100000;
  game.pickups = [];
  for (const ship of game.ships) ship.invuln = 0;
  return game;
}

export function idleInputs() {
  return [0, 1, 2, 3].map(() => ({ thrust: 0, turn: 0, fireLeft: false, fireRight: false }));
}

export function run(game, count, inputs = idleInputs()) {
  for (let i = 0; i < count; i++) step(game, inputs);
  return game;
}

export function digest(game) {
  return JSON.stringify({
    phase: game.phase,
    round: game.round,
    roundTicksLeft: game.roundTicksLeft,
    tick: game.tick,
    roundWins: game.roundWins,
    matchWinner: game.matchWinner,
    ships: game.ships.map((ship) => ({
      x: ship.x,
      y: ship.y,
      heading: ship.heading,
      vx: ship.vx,
      vy: ship.vy,
      hull: ship.hull,
      gold: ship.gold,
      sunk: ship.sunk,
      power: ship.power,
      powerTime: ship.powerTime,
      sinks: ship.sinks,
      timesSunk: ship.timesSunk,
    })),
    balls: game.balls,
    pickups: game.pickups,
    kraken: game.kraken,
  });
}
