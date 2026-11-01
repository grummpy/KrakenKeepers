import { botThink } from './bot.js';
import {
  ARENA_H,
  ARENA_W,
  BALL_DAMAGE,
  BALL_GRACE_TICKS,
  BALL_LIFE_TICKS,
  BALL_RADIUS,
  BALL_SPEED,
  BANNER_TICKS,
  BROADSIDE_SPACING,
  CANNON_COOLDOWN_TICKS,
  CHEST_COUNT,
  CHEST_GOLD,
  CHEST_RESPAWN_TICKS,
  COIN_VALUE,
  COUNTDOWN_TICKS,
  CREWS,
  INVULN_TICKS,
  KRAKEN_DAMAGE,
  KRAKEN_FIRST_TICKS,
  KRAKEN_INTERVAL_TICKS,
  KRAKEN_KNOCKBACK,
  KRAKEN_RADIUS,
  KRAKEN_RETRY_TICKS,
  KRAKEN_TELEGRAPH_TICKS,
  PATCH_HEAL,
  PICKUP_RADIUS,
  POWER_MAX,
  POWER_SPAWN_TICKS,
  POWER_TICKS,
  POWER_TYPES,
  RESPAWN_TICKS,
  ROCKS,
  ROUND_CHOICES,
  ROUND_TICKS,
  SHIP_HULL,
  SHIP_RADIUS,
  SPAWN_INVULN_TICKS,
  SPAWNS,
} from './constants.js';
import { circlesOverlap, clamp, circleHitsRect } from './geometry.js';
import { IDLE_INPUT } from './input.js';
import { clampShipToArena, integrateShip, pushCircleOutOfRect, separateShips } from './physics.js';
import { createRng } from './rng.js';
import { leaderCandidates, pickMatchWinner, pickRoundWinner, winsNeeded } from './rules.js';

export { CREWS, ROCKS, SPAWNS, SHIP_RADIUS, ROUND_TICKS, ROUND_CHOICES };
export { formatClock, pickMatchWinner, pickRoundWinner, winsNeeded, leaderCandidates } from './rules.js';

function blankKraken() {
  return {
    state: 'idle',
    timer: KRAKEN_FIRST_TICKS,
    x: ARENA_W / 2,
    y: ARENA_H / 2,
    target: -1,
  };
}

function createShip(index, kind) {
  const spawn = SPAWNS[index];
  return {
    index,
    kind,
    active: kind !== 'off',
    x: spawn.x,
    y: spawn.y,
    heading: spawn.heading,
    vx: 0,
    vy: 0,
    hull: SHIP_HULL,
    gold: 0,
    sunk: false,
    respawnIn: 0,
    invuln: SPAWN_INVULN_TICKS,
    cdLeft: 0,
    cdRight: 0,
    power: null,
    powerTime: 0,
    timesSunk: 0,
    sinks: 0,
  };
}

function clearPoint(x, y, pad) {
  if (x < pad || y < pad || x > ARENA_W - pad || y > ARENA_H - pad) return false;
  for (const rock of ROCKS) {
    if (circleHitsRect({ x, y }, pad, rock)) return false;
  }
  for (const spawn of SPAWNS) {
    if (Math.hypot(spawn.x - x, spawn.y - y) < 130) return false;
  }
  return true;
}

function randomPoint(game, pad) {
  for (let i = 0; i < 60; i++) {
    const x = game.rng.next() * ARENA_W;
    const y = game.rng.next() * ARENA_H;
    if (clearPoint(x, y, pad)) return { x, y };
  }
  return { x: ARENA_W / 2, y: 70 };
}

function spawnChests(game) {
  for (let i = 0; i < CHEST_COUNT; i++) {
    const pos = randomPoint(game, 36);
    game.pickups.push({
      kind: 'chest',
      type: null,
      x: pos.x,
      y: pos.y,
      radius: PICKUP_RADIUS,
      value: CHEST_GOLD,
      alive: true,
      respawnIn: 0,
    });
  }
}

function resetShip(ship) {
  const spawn = SPAWNS[ship.index];
  ship.x = spawn.x;
  ship.y = spawn.y;
  ship.heading = spawn.heading;
  ship.vx = 0;
  ship.vy = 0;
  ship.hull = SHIP_HULL;
  ship.gold = 0;
  ship.sunk = false;
  ship.respawnIn = 0;
  ship.invuln = SPAWN_INVULN_TICKS;
  ship.cdLeft = 0;
  ship.cdRight = 0;
  ship.power = null;
  ship.powerTime = 0;
  ship.timesSunk = 0;
  ship.sinks = 0;
}

function resetArena(game) {
  game.balls = [];
  game.pickups = [];
  game.kraken = blankKraken();
  game.powerTimer = POWER_SPAWN_TICKS;
  game.roundTicksLeft = ROUND_TICKS;
  for (const ship of game.ships) resetShip(ship);
  spawnChests(game);
}

export function createMatch(options = {}) {
  const slots = options.slots ? options.slots.slice() : ['human', 'human', 'human', 'human'];
  if (slots.length !== 4) throw new Error('Kraken Keepers requires exactly 4 player slots');
  for (const slot of slots) {
    if (slot !== 'human' && slot !== 'bot' && slot !== 'off') {
      throw new Error(`Invalid slot kind: ${slot}`);
    }
  }
  const roundCount = options.roundCount ?? 3;
  if (!ROUND_CHOICES.includes(roundCount)) {
    throw new Error('roundCount must be 1, 3, or 5');
  }
  const game = {
    seed: options.seed ?? 1,
    rng: createRng(options.seed ?? 1),
    roundCount,
    round: 1,
    roundWins: [0, 0, 0, 0],
    roundWinner: null,
    matchWinner: null,
    phase: 'countdown',
    countdownTicks: COUNTDOWN_TICKS,
    bannerTicks: 0,
    roundTicksLeft: ROUND_TICKS,
    tick: 0,
    ships: slots.map((kind, index) => createShip(index, kind)),
    balls: [],
    pickups: [],
    kraken: blankKraken(),
    powerTimer: POWER_SPAWN_TICKS,
    events: [],
  };
  spawnChests(game);
  if (options.skipCountdown) {
    game.phase = 'playing';
    game.countdownTicks = 0;
  }
  return game;
}

function normalizeInput(input) {
  if (!input) return IDLE_INPUT;
  return {
    thrust: input.thrust || 0,
    turn: input.turn || 0,
    fireLeft: !!input.fireLeft,
    fireRight: !!input.fireRight,
  };
}

function scatterCoins(game, x, y, amount) {
  let left = amount;
  let guard = 0;
  while (left > 0 && guard < 40) {
    guard += 1;
    const value = Math.min(COIN_VALUE, left);
    const angle = game.rng.next() * Math.PI * 2;
    const radius = 20 + game.rng.next() * 42;
    game.pickups.push({
      kind: 'coin',
      type: null,
      x: clamp(x + Math.cos(angle) * radius, 28, ARENA_W - 28),
      y: clamp(y + Math.sin(angle) * radius, 28, ARENA_H - 28),
      radius: 10,
      value,
      alive: true,
    });
    left -= value;
  }
}

function sinkShip(game, ship, sourceIndex) {
  ship.sunk = true;
  ship.hull = 0;
  ship.respawnIn = RESPAWN_TICKS;
  ship.vx = 0;
  ship.vy = 0;
  ship.power = null;
  ship.powerTime = 0;
  ship.timesSunk += 1;
  const drop = Math.floor(ship.gold / 2);
  ship.gold -= drop;
  if (drop > 0) scatterCoins(game, ship.x, ship.y, drop);
  if (sourceIndex != null && sourceIndex !== ship.index) {
    const attacker = game.ships[sourceIndex];
    if (attacker?.active) attacker.sinks += 1;
  }
  game.events.push({
    type: 'sink',
    x: ship.x,
    y: ship.y,
    player: ship.index,
    source: sourceIndex ?? null,
  });
}

function damageShip(game, ship, amount, sourceIndex) {
  if (!ship.active || ship.sunk || ship.invuln > 0) return false;
  let harm = amount;
  if (ship.power === 'patch' && ship.powerTime > 0) harm *= 0.5;
  ship.hull -= harm;
  if (ship.hull <= 0) sinkShip(game, ship, sourceIndex);
  return true;
}

function respawnShip(ship) {
  const spawn = SPAWNS[ship.index];
  ship.x = spawn.x;
  ship.y = spawn.y;
  ship.heading = spawn.heading;
  ship.vx = 0;
  ship.vy = 0;
  ship.hull = SHIP_HULL;
  ship.sunk = false;
  ship.respawnIn = 0;
  ship.invuln = INVULN_TICKS;
  ship.cdLeft = 0;
  ship.cdRight = 0;
}

function tryFire(game, ship, side) {
  const key = side === 'left' ? 'cdLeft' : 'cdRight';
  if (ship[key] > 0 || ship.sunk) return;
  const fast = ship.power === 'powder' && ship.powerTime > 0;
  ship[key] = fast ? CANNON_COOLDOWN_TICKS / 2 : CANNON_COOLDOWN_TICKS;
  const dir = ship.heading + (side === 'left' ? -Math.PI / 2 : Math.PI / 2);
  const ux = Math.cos(dir);
  const uy = Math.sin(dir);
  const fx = Math.cos(ship.heading);
  const fy = Math.sin(ship.heading);
  for (let i = -1; i <= 1; i++) {
    game.balls.push({
      x: ship.x + fx * i * BROADSIDE_SPACING + ux * (SHIP_RADIUS + 6),
      y: ship.y + fy * i * BROADSIDE_SPACING + uy * (SHIP_RADIUS + 6),
      vx: ux * BALL_SPEED + ship.vx * 0.25,
      vy: uy * BALL_SPEED + ship.vy * 0.25,
      life: BALL_LIFE_TICKS,
      grace: BALL_GRACE_TICKS,
      owner: ship.index,
      damage: BALL_DAMAGE,
      radius: BALL_RADIUS,
    });
  }
  game.events.push({ type: 'fire', x: ship.x, y: ship.y, player: ship.index, side });
}

function resolveCollisions(game) {
  for (let pass = 0; pass < 3; pass++) {
    for (const ship of game.ships) {
      if (!ship.active || ship.sunk) continue;
      for (const rock of ROCKS) pushCircleOutOfRect(ship, SHIP_RADIUS, rock);
      clampShipToArena(ship);
    }
    for (let i = 0; i < game.ships.length; i++) {
      for (let j = i + 1; j < game.ships.length; j++) {
        const a = game.ships[i];
        const b = game.ships[j];
        if (!a.active || !b.active || a.sunk || b.sunk) continue;
        separateShips(a, b, SHIP_RADIUS);
      }
    }
  }
  for (const ship of game.ships) {
    if (ship.active && !ship.sunk) clampShipToArena(ship);
  }
}

function updateShips(game, inputs) {
  const decided = game.ships.map((ship, index) => {
    if (!ship.active || ship.sunk) return null;
    if (ship.kind === 'bot') return botThink(game, index);
    return normalizeInput(inputs[index]);
  });

  game.ships.forEach((ship, index) => {
    if (!ship.active) return;
    if (ship.sunk) {
      ship.respawnIn -= 1;
      if (ship.respawnIn <= 0) respawnShip(ship);
      return;
    }
    if (ship.invuln > 0) ship.invuln -= 1;
    if (ship.cdLeft > 0) ship.cdLeft -= 1;
    if (ship.cdRight > 0) ship.cdRight -= 1;
    const input = decided[index] || IDLE_INPUT;
    if (input.fireLeft) tryFire(game, ship, 'left');
    if (input.fireRight) tryFire(game, ship, 'right');
    integrateShip(ship, input, 1 / 60);
    if (ship.powerTime > 0) {
      ship.powerTime -= 1;
      if (ship.powerTime <= 0) ship.power = null;
    }
  });
  resolveCollisions(game);
}

function updateBalls(game) {
  const next = [];
  for (const ball of game.balls) {
    ball.life -= 1;
    ball.grace -= 1;
    if (ball.life <= 0) continue;
    ball.x += ball.vx / 60;
    ball.y += ball.vy / 60;
    if (ball.x < -20 || ball.y < -20 || ball.x > ARENA_W + 20 || ball.y > ARENA_H + 20) continue;
    const radius = ball.radius ?? BALL_RADIUS;
    let struck = false;
    for (const rock of ROCKS) {
      if (circleHitsRect(ball, radius, rock)) {
        game.events.push({ type: 'hit', x: ball.x, y: ball.y, rock: true });
        struck = true;
        break;
      }
    }
    if (struck) continue;
    for (const ship of game.ships) {
      if (!ship.active || ship.sunk) continue;
      if (ball.owner === ship.index && ball.grace > 0) continue;
      if (!circlesOverlap(ball, ship, radius, SHIP_RADIUS)) continue;
      damageShip(game, ship, ball.damage ?? BALL_DAMAGE, ball.owner);
      game.events.push({ type: 'hit', x: ball.x, y: ball.y, player: ship.index });
      struck = true;
      break;
    }
    if (!struck) next.push(ball);
  }
  game.balls = next;
}

function updatePickups(game) {
  for (const pickup of game.pickups) {
    if (pickup.kind === 'chest' && !pickup.alive) {
      pickup.respawnIn -= 1;
      if (pickup.respawnIn <= 0) {
        const pos = randomPoint(game, 36);
        pickup.x = pos.x;
        pickup.y = pos.y;
        pickup.alive = true;
      }
    }
  }

  for (const ship of game.ships) {
    if (!ship.active || ship.sunk) continue;
    for (const pickup of game.pickups) {
      if (!pickup.alive) continue;
      if (!circlesOverlap(ship, pickup, SHIP_RADIUS, pickup.radius)) continue;
      if (pickup.kind === 'chest' || pickup.kind === 'coin') {
        ship.gold += pickup.value;
        game.events.push({
          type: 'pickup',
          x: pickup.x,
          y: pickup.y,
          kind: pickup.kind,
          player: ship.index,
          value: pickup.value,
        });
        if (pickup.kind === 'chest') {
          pickup.alive = false;
          pickup.respawnIn = CHEST_RESPAWN_TICKS;
        } else {
          pickup.alive = false;
          pickup.dead = true;
        }
      } else if (pickup.kind === 'power') {
        ship.power = pickup.type;
        ship.powerTime = POWER_TICKS;
        if (pickup.type === 'patch') ship.hull = Math.min(SHIP_HULL, ship.hull + PATCH_HEAL);
        game.events.push({
          type: 'pickup',
          x: pickup.x,
          y: pickup.y,
          kind: 'power',
          type: pickup.type,
          player: ship.index,
        });
        pickup.alive = false;
        pickup.dead = true;
      }
    }
  }
  game.pickups = game.pickups.filter((pickup) => !pickup.dead);
}

function beginTelegraph(game) {
  const kraken = game.kraken;
  const candidates = leaderCandidates(game.ships);
  if (!candidates.length) {
    kraken.state = 'idle';
    kraken.timer = KRAKEN_RETRY_TICKS;
    kraken.target = -1;
    return;
  }
  const ship = candidates.length === 1
    ? candidates[0]
    : candidates[game.rng.int(candidates.length)];
  kraken.state = 'telegraph';
  kraken.timer = KRAKEN_TELEGRAPH_TICKS;
  kraken.target = ship.index;
  kraken.x = ship.x;
  kraken.y = ship.y;
  game.events.push({ type: 'kraken-warn', x: kraken.x, y: kraken.y, player: ship.index });
}

function slam(game) {
  const kraken = game.kraken;
  game.events.push({ type: 'kraken', x: kraken.x, y: kraken.y, player: kraken.target });
  for (const ship of game.ships) {
    if (!ship.active || ship.sunk) continue;
    const dx = ship.x - kraken.x;
    const dy = ship.y - kraken.y;
    const gap = Math.hypot(dx, dy) || 1;
    if (gap > KRAKEN_RADIUS + SHIP_RADIUS) continue;
    damageShip(game, ship, KRAKEN_DAMAGE, null);
    if (!ship.sunk) {
      ship.vx += (dx / gap) * KRAKEN_KNOCKBACK;
      ship.vy += (dy / gap) * KRAKEN_KNOCKBACK;
    }
  }
  kraken.state = 'idle';
  kraken.timer = KRAKEN_INTERVAL_TICKS;
  kraken.target = -1;
}

function updateKraken(game) {
  const kraken = game.kraken;
  if (kraken.state === 'idle') {
    kraken.timer -= 1;
    if (kraken.timer <= 0) beginTelegraph(game);
    return;
  }
  if (kraken.state === 'telegraph') {
    kraken.timer -= 1;
    if (kraken.timer <= 0) slam(game);
  }
}

function updatePowerSpawns(game) {
  game.powerTimer -= 1;
  if (game.powerTimer > 0) return;
  game.powerTimer = POWER_SPAWN_TICKS;
  const alive = game.pickups.filter((pickup) => pickup.alive && pickup.kind === 'power').length;
  if (alive >= POWER_MAX) return;
  const type = POWER_TYPES[game.rng.int(POWER_TYPES.length)];
  const pos = randomPoint(game, 36);
  game.pickups.push({
    kind: 'power',
    type,
    x: pos.x,
    y: pos.y,
    radius: PICKUP_RADIUS,
    value: 0,
    alive: true,
  });
  game.events.push({ type: 'spawn', kind: 'power', power: type, x: pos.x, y: pos.y });
}

function endRound(game) {
  const winner = pickRoundWinner(game.ships);
  game.roundWinner = winner;
  if (winner != null) game.roundWins[winner] += 1;
  const needed = winsNeeded(game.roundCount);
  const best = Math.max(...game.ships.filter((ship) => ship.active).map((ship) => game.roundWins[ship.index]));
  if (best >= needed || game.round >= game.roundCount) {
    game.phase = 'matchEnd';
    game.matchWinner = pickMatchWinner(game.ships, game.roundWins);
    game.events.push({ type: 'match', winner: game.matchWinner });
    return;
  }
  game.phase = 'roundEnd';
  game.bannerTicks = BANNER_TICKS;
  game.events.push({ type: 'round', winner });
}

function openNextRound(game) {
  game.round += 1;
  resetArena(game);
  game.phase = 'countdown';
  game.countdownTicks = COUNTDOWN_TICKS;
  game.events.push({ type: 'countdown', value: 3 });
}

function tickCountdown(game) {
  const before = Math.ceil(game.countdownTicks / 60);
  game.countdownTicks -= 1;
  const after = Math.ceil(game.countdownTicks / 60);
  if (game.countdownTicks <= 0) {
    game.phase = 'playing';
    game.countdownTicks = 0;
    game.events.push({ type: 'countdown', value: 0 });
    return;
  }
  if (before !== after) game.events.push({ type: 'countdown', value: after });
}

export function step(game, inputs) {
  game.events = [];
  if (game.phase === 'matchEnd') return game;
  if (game.phase === 'roundEnd') {
    game.bannerTicks -= 1;
    if (game.bannerTicks <= 0) openNextRound(game);
    return game;
  }
  if (game.phase === 'countdown') {
    tickCountdown(game);
    return game;
  }

  game.tick += 1;
  game.roundTicksLeft -= 1;
  updateShips(game, inputs || []);
  updateBalls(game);
  updatePickups(game);
  updateKraken(game);
  updatePowerSpawns(game);
  if (game.phase === 'playing' && game.roundTicksLeft <= 0) endRound(game);
  return game;
}

export function skipBanner(game) {
  if (game.phase === 'roundEnd') game.bannerTicks = 1;
}
