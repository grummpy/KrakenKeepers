import { ARENA_H, ARENA_W, KRAKEN_RADIUS, ROCKS, SHIP_RADIUS } from './constants.js';
import { angNorm, circleHitsRect, clamp, dist } from './geometry.js';

const IDLE = { thrust: 0, turn: 0, fireLeft: false, fireRight: false };

export function botThink(game, index) {
  const me = game.ships[index];
  if (!me || !me.active || me.sunk) return { ...IDLE };

  let tx = me.x + Math.cos(me.heading) * 220;
  let ty = me.y + Math.sin(me.heading) * 220;
  let fleeing = false;

  if (game.kraken.state === 'telegraph') {
    const gap = dist(me, game.kraken);
    if (gap < KRAKEN_RADIUS + 150) {
      fleeing = true;
      const dx = me.x - game.kraken.x;
      const dy = me.y - game.kraken.y;
      const mag = Math.hypot(dx, dy) || 1;
      tx = me.x + (dx / mag) * 320;
      ty = me.y + (dy / mag) * 320;
    }
  }

  if (!fleeing) {
    let best = Infinity;
    for (const pickup of game.pickups) {
      if (!pickup.alive) continue;
      const gap = dist(me, pickup);
      if (gap < best) {
        best = gap;
        tx = pickup.x;
        ty = pickup.y;
      }
    }
  }

  const look = 70;
  const aheadX = me.x + Math.cos(me.heading) * look;
  const aheadY = me.y + Math.sin(me.heading) * look;
  let blocked = aheadX < SHIP_RADIUS || aheadY < SHIP_RADIUS
    || aheadX > ARENA_W - SHIP_RADIUS || aheadY > ARENA_H - SHIP_RADIUS;
  if (!blocked) {
    for (const rock of ROCKS) {
      if (circleHitsRect({ x: aheadX, y: aheadY }, SHIP_RADIUS, rock)) blocked = true;
    }
  }

  const desired = Math.atan2(ty - me.y, tx - me.x);
  let diff = angNorm(desired - me.heading);
  if (blocked) diff = 1;
  const turn = Math.abs(diff) < 0.06 ? 0 : Math.sign(diff);
  const weave = blocked ? 0 : Math.sin((game.tick + index * 17) / 34) * 0.18;
  const thrust = Math.abs(diff) < 1.25 ? 1 : 0.25;

  let fireLeft = false;
  let fireRight = false;
  for (const other of game.ships) {
    if (!other.active || other.sunk || other.index === index) continue;
    const dx = other.x - me.x;
    const dy = other.y - me.y;
    const gap = Math.hypot(dx, dy);
    if (gap > 380 || gap < 1) continue;
    const rel = angNorm(Math.atan2(dy, dx) - me.heading);
    if (rel < -0.35 && rel > -2.55) fireLeft = true;
    if (rel > 0.35 && rel < 2.55) fireRight = true;
  }

  return {
    thrust: blocked ? 0.4 : thrust,
    turn: clamp(turn + weave, -1, 1),
    fireLeft,
    fireRight,
  };
}
