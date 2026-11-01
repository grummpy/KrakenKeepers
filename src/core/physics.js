import {
  ARENA_H,
  ARENA_W,
  SHIP_ACCEL,
  SHIP_DRAG,
  SHIP_LATERAL_DRAG,
  SHIP_MAX_SPEED,
  SHIP_RADIUS,
  SHIP_REVERSE_MAX,
  SHIP_TURN_RATE,
  WIND_ACCEL,
  WIND_MAX,
  WIND_TURN,
} from './constants.js';
import { circleHitsRect, clamp } from './geometry.js';

export function windActive(ship) {
  return ship.power === 'wind' && ship.powerTime > 0;
}

export function integrateShip(ship, input, dt) {
  const wind = windActive(ship);
  const turnRate = SHIP_TURN_RATE * (wind ? WIND_TURN : 1);
  const thrust = clamp(input.thrust || 0, -1, 1);
  const turn = clamp(input.turn || 0, -1, 1);
  ship.heading += turn * turnRate * dt;

  const fx = Math.cos(ship.heading);
  const fy = Math.sin(ship.heading);
  const accel = SHIP_ACCEL * (wind ? WIND_ACCEL : 1);
  ship.vx += fx * thrust * accel * dt;
  ship.vy += fy * thrust * accel * dt;

  let forward = ship.vx * fx + ship.vy * fy;
  let lx = ship.vx - forward * fx;
  let ly = ship.vy - forward * fy;
  forward *= Math.exp(-SHIP_DRAG * dt);
  const lateralKeep = Math.exp(-SHIP_LATERAL_DRAG * dt);
  lx *= lateralKeep;
  ly *= lateralKeep;

  const maxForward = SHIP_MAX_SPEED * (wind ? WIND_MAX : 1);
  if (forward > maxForward) forward = maxForward;
  if (forward < -SHIP_REVERSE_MAX) forward = -SHIP_REVERSE_MAX;

  ship.vx = forward * fx + lx;
  ship.vy = forward * fy + ly;
  ship.x += ship.vx * dt;
  ship.y += ship.vy * dt;
}

export function clampShipToArena(ship, radius = SHIP_RADIUS) {
  let hit = false;
  if (ship.x < radius) {
    ship.x = radius;
    if (ship.vx < 0) ship.vx = 0;
    hit = true;
  } else if (ship.x > ARENA_W - radius) {
    ship.x = ARENA_W - radius;
    if (ship.vx > 0) ship.vx = 0;
    hit = true;
  }
  if (ship.y < radius) {
    ship.y = radius;
    if (ship.vy < 0) ship.vy = 0;
    hit = true;
  } else if (ship.y > ARENA_H - radius) {
    ship.y = ARENA_H - radius;
    if (ship.vy > 0) ship.vy = 0;
    hit = true;
  }
  return hit;
}

export function pushCircleOutOfRect(body, radius, rect) {
  if (!circleHitsRect(body, radius, rect)) return false;
  const cx = clamp(body.x, rect.x, rect.x + rect.w);
  const cy = clamp(body.y, rect.y, rect.y + rect.h);
  let dx = body.x - cx;
  let dy = body.y - cy;
  const d2 = dx * dx + dy * dy;
  if (d2 === 0) {
    const left = body.x - rect.x;
    const right = rect.x + rect.w - body.x;
    const top = body.y - rect.y;
    const bottom = rect.y + rect.h - body.y;
    const min = Math.min(left, right, top, bottom);
    if (min === left) {
      body.x = rect.x - radius;
      body.vx = Math.min(body.vx || 0, 0);
    } else if (min === right) {
      body.x = rect.x + rect.w + radius;
      body.vx = Math.max(body.vx || 0, 0);
    } else if (min === top) {
      body.y = rect.y - radius;
      body.vy = Math.min(body.vy || 0, 0);
    } else {
      body.y = rect.y + rect.h + radius;
      body.vy = Math.max(body.vy || 0, 0);
    }
    return true;
  }
  const d = Math.sqrt(d2);
  const pen = radius - d;
  dx /= d;
  dy /= d;
  body.x += dx * pen;
  body.y += dy * pen;
  const vn = (body.vx || 0) * dx + (body.vy || 0) * dy;
  if (vn < 0) {
    body.vx -= vn * dx;
    body.vy -= vn * dy;
  }
  return true;
}

export function separateShips(a, b, radius) {
  let dx = b.x - a.x;
  let dy = b.y - a.y;
  let d = Math.hypot(dx, dy);
  const min = radius * 2;
  if (d >= min) return false;
  if (d === 0) {
    dx = 1;
    dy = 0;
    d = 1;
  }
  const pen = (min - d) / 2;
  const nx = dx / d;
  const ny = dy / d;
  a.x -= nx * pen;
  a.y -= ny * pen;
  b.x += nx * pen;
  b.y += ny * pen;
  const rel = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny;
  if (rel > 0) {
    const push = rel * 0.5;
    a.vx -= nx * push;
    a.vy -= ny * push;
    b.vx += nx * push;
    b.vy += ny * push;
  }
  return true;
}
