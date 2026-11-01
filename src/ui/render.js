import {
  ARENA_H,
  ARENA_W,
  CREWS,
  KRAKEN_RADIUS,
  ROCKS,
  SHIP_HULL,
} from '../core/constants.js';
import { BINDING_FIELDS, keyLabel } from '../core/input.js';
import { formatClock, leaderCandidates } from '../core/rules.js';

const UI = '"Trebuchet MS", Verdana, sans-serif';
const DISPLAY = 'Georgia, Palatino, serif';

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function fillText(ctx, value, x, y, font, color, align = 'left', baseline = 'middle') {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
  ctx.fillText(value, x + 2, y + 3);
  ctx.fillStyle = color;
  ctx.fillText(value, x, y);
}

function drawCover(ctx, image, w, h) {
  if (!image || !image.complete || !image.naturalWidth) {
    const wash = ctx.createLinearGradient(0, 0, 0, h);
    wash.addColorStop(0, '#12324a');
    wash.addColorStop(1, '#071820');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, w, h);
    return;
  }
  const scale = Math.max(w / image.naturalWidth, h / image.naturalHeight);
  const dw = image.naturalWidth * scale;
  const dh = image.naturalHeight * scale;
  ctx.drawImage(image, (w - dw) / 2, (h - dh) / 2, dw, dh);
}

function cameraFor(w, h, shake) {
  const scale = Math.min((w - 16) / ARENA_W, (h - 16) / ARENA_H);
  return {
    scale,
    ox: (w - ARENA_W * scale) / 2 + shake.x,
    oy: (h - ARENA_H * scale) / 2 + shake.y,
  };
}

function drawSea(ctx, time) {
  const gradient = ctx.createLinearGradient(0, 0, 0, ARENA_H);
  gradient.addColorStop(0, '#0a3144');
  gradient.addColorStop(0.45, '#0e5870');
  gradient.addColorStop(1, '#083246');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, ARENA_W, ARENA_H);
  ctx.save();
  ctx.globalAlpha = 0.28;
  for (let i = 0; i < 9; i++) {
    ctx.beginPath();
    const y = 70 + i * 95;
    for (let x = 0; x <= ARENA_W; x += 24) {
      const wave = Math.sin(x * 0.02 + time * 0.0015 + i) * 7;
      if (x === 0) ctx.moveTo(x, y + wave);
      else ctx.lineTo(x, y + wave);
    }
    ctx.strokeStyle = i % 2 ? '#d7f4ff' : '#9be7ff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();
}

function drawRocks(ctx) {
  for (const rock of ROCKS) {
    ctx.fillStyle = '#e6c48a';
    roundRect(ctx, rock.x - 8, rock.y - 8, rock.w + 16, rock.h + 16, 18);
    ctx.fill();
    ctx.fillStyle = '#6d6258';
    roundRect(ctx, rock.x, rock.y, rock.w, rock.h, 14);
    ctx.fill();
    ctx.fillStyle = '#8b8174';
    ctx.beginPath();
    ctx.ellipse(rock.x + rock.w * 0.35, rock.y + rock.h * 0.4, rock.w * 0.18, rock.h * 0.16, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawChest(ctx, pickup, time) {
  const bob = Math.sin(time * 0.004 + pickup.x) * 3;
  ctx.save();
  ctx.translate(pickup.x, pickup.y + bob);
  ctx.fillStyle = '#f0c14a';
  ctx.fillRect(-11, -8, 22, 16);
  ctx.fillStyle = '#8a5a1d';
  ctx.fillRect(-11, -2, 22, 4);
  ctx.fillStyle = '#fff1c2';
  ctx.fillRect(-2, -4, 4, 8);
  ctx.restore();
}

function drawCoin(ctx, pickup, time) {
  const bob = Math.sin(time * 0.006 + pickup.y) * 2;
  ctx.beginPath();
  ctx.fillStyle = '#ffd15c';
  ctx.arc(pickup.x, pickup.y + bob, 6, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#8a5a12';
  ctx.font = `10px ${UI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('$', pickup.x, pickup.y + bob + 0.5);
}

function drawPower(ctx, pickup, time) {
  const bob = Math.sin(time * 0.005 + pickup.x) * 3;
  ctx.save();
  ctx.translate(pickup.x, pickup.y + bob);
  ctx.lineWidth = 2;
  if (pickup.type === 'powder') {
    ctx.fillStyle = '#ffb020';
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(9, 8);
    ctx.lineTo(-9, 8);
    ctx.closePath();
    ctx.fill();
  } else if (pickup.type === 'wind') {
    ctx.strokeStyle = '#9be7ff';
    ctx.beginPath();
    ctx.arc(0, 0, 9, 0.4, 5.4);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, 4, 0.2, 4.2);
    ctx.stroke();
  } else {
    ctx.strokeStyle = '#8dffb0';
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.stroke();
  }
  ctx.restore();
}

function drawShip(ctx, ship, time, leader, targeted) {
  const crew = CREWS[ship.index];
  const blink = ship.invuln > 0 && Math.floor(time / 80) % 2 === 0;
  ctx.save();
  ctx.translate(ship.x, ship.y);
  if (blink) ctx.globalAlpha = 0.45;
  ctx.rotate(ship.heading);

  if (!ship.sunk && (Math.abs(ship.vx) + Math.abs(ship.vy) > 30)) {
    ctx.strokeStyle = 'rgba(215, 244, 255, 0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-18, 0);
    ctx.lineTo(-34, 6);
    ctx.moveTo(-18, 0);
    ctx.lineTo(-34, -6);
    ctx.stroke();
  }

  if (leader && !ship.sunk) {
    ctx.strokeStyle = '#ffd15c';
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
  }
  if (targeted && !ship.sunk) {
    ctx.strokeStyle = '#c9a6ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(0, 0, 34, 0, Math.PI * 2);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(0, 0, 0, 0.25)';
  ctx.beginPath();
  ctx.ellipse(2, 8, 22, 8, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = ship.sunk ? '#4a403c' : crew.hull;
  ctx.beginPath();
  ctx.moveTo(28, 0);
  ctx.quadraticCurveTo(8, 15, -20, 11);
  ctx.lineTo(-14, 0);
  ctx.lineTo(-20, -11);
  ctx.quadraticCurveTo(8, -15, 28, 0);
  ctx.fill();
  ctx.strokeStyle = crew.trim;
  ctx.lineWidth = 2;
  ctx.stroke();

  if (!ship.sunk) {
    ctx.strokeStyle = '#f2e2c4';
    ctx.beginPath();
    ctx.moveTo(-2, 2);
    ctx.lineTo(-2, -30);
    ctx.stroke();
    ctx.fillStyle = crew.sail;
    ctx.beginPath();
    ctx.moveTo(-2, -2);
    ctx.lineTo(-2, -26);
    ctx.lineTo(16, -2);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = crew.flag;
    ctx.fillRect(-2, -34, 12, 8);
    ctx.fillStyle = '#f4f7fb';
    ctx.fillRect(1, -32, 4, 4);
    if (ship.cdLeft > 40) {
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath();
      ctx.arc(0, -16, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    if (ship.cdRight > 40) {
      ctx.fillStyle = '#ffd27a';
      ctx.beginPath();
      ctx.arc(0, 16, 5, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();

  ctx.font = `bold 13px ${UI}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  const label = ship.sunk ? 'sunk' : `${ship.gold}g`;
  ctx.fillText(label, ship.x + 1, ship.y - 36);
  ctx.fillStyle = ship.sunk ? '#ffb4b4' : '#fff6d0';
  ctx.fillText(label, ship.x, ship.y - 38);
}

function drawBall(ctx, ball) {
  ctx.fillStyle = '#1b1b1b';
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, ball.radius || 5, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255, 220, 160, 0.8)';
  ctx.beginPath();
  ctx.arc(ball.x - ball.vx * 0.02, ball.y - ball.vy * 0.02, 2, 0, Math.PI * 2);
  ctx.fill();
}

function drawKraken(ctx, kraken, time) {
  if (kraken.state !== 'telegraph') return;
  const pulse = 0.55 + Math.sin(time * 0.012) * 0.25;
  ctx.save();
  ctx.strokeStyle = `rgba(180, 120, 255, ${0.45 + pulse * 0.4})`;
  ctx.lineWidth = 4;
  ctx.setLineDash([10, 8]);
  ctx.beginPath();
  ctx.arc(kraken.x, kraken.y, KRAKEN_RADIUS, 0, Math.PI * 2);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = '#6d3ec4';
  ctx.lineWidth = 8;
  ctx.lineCap = 'round';
  for (let i = 0; i < 5; i++) {
    const a = time * 0.001 + i * 1.25;
    const reach = KRAKEN_RADIUS * (0.35 + (i % 3) * 0.12);
    ctx.beginPath();
    ctx.moveTo(kraken.x + Math.cos(a) * (KRAKEN_RADIUS + 30), kraken.y + Math.sin(a) * (KRAKEN_RADIUS + 30));
    ctx.quadraticCurveTo(
      kraken.x + Math.cos(a + 0.6) * reach,
      kraken.y + Math.sin(a + 0.6) * reach,
      kraken.x + Math.cos(a) * 16,
      kraken.y + Math.sin(a) * 16,
    );
    ctx.stroke();
  }
  ctx.restore();
  ctx.font = `bold 16px ${UI}`;
  ctx.textAlign = 'center';
  ctx.fillStyle = '#f0e2ff';
  ctx.fillText('KRAKEN', kraken.x, kraken.y - KRAKEN_RADIUS - 14);
}

function drawPadIcon(ctx, x, y, connected) {
  ctx.save();
  ctx.translate(x, y);
  ctx.strokeStyle = connected ? '#9be7ff' : 'rgba(255,255,255,0.25)';
  ctx.fillStyle = connected ? 'rgba(155, 231, 255, 0.2)' : 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 2;
  roundRect(ctx, -11, -8, 22, 16, 5);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawHud(ctx, game, pads, w, h) {
  const leaders = new Set(leaderCandidates(game.ships).map((ship) => ship.index));
  const plates = game.ships.filter((ship) => ship.active);
  const gap = 10;
  const width = Math.min(280, (w - 40 - gap * Math.max(0, plates.length - 1)) / Math.max(1, plates.length));
  const y = h - 78;
  plates.forEach((ship, i) => {
    const crew = CREWS[ship.index];
    const x = 16 + i * (width + gap);
    ctx.fillStyle = 'rgba(4, 14, 24, 0.72)';
    roundRect(ctx, x, y, width, 58, 10);
    ctx.fill();
    ctx.fillStyle = crew.sail;
    ctx.fillRect(x, y, width, 6);
    ctx.font = `bold 14px ${UI}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#f4f7fb';
    ctx.fillText(crew.name, x + 10, y + 22);
    ctx.font = `13px ${UI}`;
    const pips = game.roundWins[ship.index] || 0;
    const pipText = pips > 0 ? `  ${'●'.repeat(Math.min(5, pips))}` : '';
    ctx.fillStyle = '#ffd15c';
    ctx.fillText(`${ship.gold}g${pipText}`, x + 10, y + 42);
    const hullW = Math.max(36, width * 0.34);
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(x + width - hullW - 34, y + 34, hullW, 8);
    ctx.fillStyle = ship.hull > 40 ? '#8dffb0' : '#ff7a7a';
    ctx.fillRect(x + width - hullW - 34, y + 34, hullW * Math.max(0, ship.hull) / SHIP_HULL, 8);
    drawPadIcon(ctx, x + width - 18, y + 24, !!pads[ship.index]);
    if (ship.kind === 'bot') {
      ctx.font = `10px ${UI}`;
      ctx.fillStyle = '#9be7ff';
      ctx.textAlign = 'right';
      ctx.fillText('BOT', x + width - 32, y + 22);
    }
    if (leaders.has(ship.index)) {
      ctx.font = `10px ${UI}`;
      ctx.fillStyle = '#ffd15c';
      ctx.textAlign = 'right';
      ctx.fillText('LEAD', x + width - 32, y + 42);
    }
  });

  const clock = formatClock(game.roundTicksLeft);
  ctx.font = `bold 28px ${DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const urgent = game.roundTicksLeft < 10 * 60;
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillText(clock, w / 2 + 2, 28);
  ctx.fillStyle = urgent ? '#ff8d8d' : '#f4f7fb';
  ctx.fillText(clock, w / 2, 26);
  ctx.font = `13px ${UI}`;
  ctx.fillStyle = '#d5e6f2';
  ctx.fillText(`Round ${game.round} / ${game.roundCount}`, w / 2, 50);
}

function drawSlam(ctx, slam) {
  const radius = (1 - slam.life) * (KRAKEN_RADIUS + 40);
  ctx.strokeStyle = `rgba(210, 180, 255, ${slam.life})`;
  ctx.lineWidth = 8 * slam.life;
  ctx.beginPath();
  ctx.arc(slam.x, slam.y, radius, 0, Math.PI * 2);
  ctx.stroke();
  ctx.fillStyle = `rgba(90, 40, 140, ${slam.life * 0.25})`;
  ctx.beginPath();
  ctx.arc(slam.x, slam.y, KRAKEN_RADIUS * slam.life, 0, Math.PI * 2);
  ctx.fill();
}

function drawParticles(ctx, particles) {
  for (const particle of particles) {
    ctx.globalAlpha = Math.max(0, particle.life / particle.max);
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

function drawPlay(ctx, view) {
  const { w, h, game } = view;
  ctx.fillStyle = '#041018';
  ctx.fillRect(0, 0, w, h);
  const shakeMag = view.shake || 0;
  const shake = {
    x: (Math.random() - 0.5) * shakeMag,
    y: (Math.random() - 0.5) * shakeMag,
  };
  const cam = cameraFor(w, h, shake);
  ctx.save();
  ctx.translate(cam.ox, cam.oy);
  ctx.scale(cam.scale, cam.scale);
  drawSea(ctx, view.time);
  drawRocks(ctx);
  drawKraken(ctx, game.kraken, view.time);
  for (const slam of view.slams || []) drawSlam(ctx, slam);
  for (const pickup of game.pickups) {
    if (!pickup.alive) continue;
    if (pickup.kind === 'chest') drawChest(ctx, pickup, view.time);
    else if (pickup.kind === 'coin') drawCoin(ctx, pickup, view.time);
    else drawPower(ctx, pickup, view.time);
  }
  for (const ball of game.balls) drawBall(ctx, ball);
  const leaders = new Set(leaderCandidates(game.ships).map((ship) => ship.index));
  for (const ship of game.ships) {
    if (!ship.active) continue;
    drawShip(ctx, ship, view.time, leaders.has(ship.index), game.kraken.target === ship.index && game.kraken.state === 'telegraph');
  }
  drawParticles(ctx, view.particles || []);
  ctx.strokeStyle = 'rgba(215, 244, 255, 0.35)';
  ctx.lineWidth = 6;
  ctx.strokeRect(3, 3, ARENA_W - 6, ARENA_H - 6);
  ctx.restore();

  drawHud(ctx, game, view.pads, w, h);

  if (game.phase === 'countdown') {
    const n = Math.max(1, Math.ceil(game.countdownTicks / 60));
    fillText(ctx, String(n), w / 2, h / 2, `bold 120px ${DISPLAY}`, '#fff6d0', 'center');
  }
  if (game.phase === 'roundEnd') {
    drawBanner(ctx, w, h, game);
  }
  if (game.phase === 'matchEnd') {
    drawMatch(ctx, w, h, game);
  }
  if (view.paused) {
    drawPause(ctx, w, h, view.pauseIndex);
  }
  if (view.muted) {
    fillText(ctx, 'MUTE', w - 24, h - 22, `bold 14px ${UI}`, '#ffb4b4', 'right');
  }
}

function drawBanner(ctx, w, h, game) {
  ctx.fillStyle = 'rgba(4, 10, 18, 0.55)';
  ctx.fillRect(0, 0, w, h);
  const crew = game.roundWinner == null ? null : CREWS[game.roundWinner];
  fillText(ctx, `ROUND ${game.round}`, w / 2, h / 2 - 70, `bold 28px ${UI}`, '#d5e6f2', 'center');
  fillText(
    ctx,
    crew ? `${crew.name} takes the round` : 'The round is a wash',
    w / 2,
    h / 2 - 10,
    `bold 42px ${DISPLAY}`,
    crew ? crew.sail : '#f4f7fb',
    'center',
  );
  const line = game.ships.filter((ship) => ship.active).map((ship) => `${CREWS[ship.index].short} ${ship.gold}g`).join('    ');
  fillText(ctx, line, w / 2, h / 2 + 48, `18px ${UI}`, '#fff6d0', 'center');
  fillText(ctx, 'Enter skips ahead', w / 2, h / 2 + 90, `14px ${UI}`, '#d5e6f2', 'center');
}

function drawMatch(ctx, w, h, game) {
  ctx.fillStyle = 'rgba(4, 10, 18, 0.72)';
  ctx.fillRect(0, 0, w, h);
  const winner = game.matchWinner == null ? null : CREWS[game.matchWinner];
  fillText(ctx, 'MATCH OVER', w / 2, 90, `bold 22px ${UI}`, '#d5e6f2', 'center');
  fillText(ctx, winner ? `${winner.name} keeps the sea` : 'No one keeps the sea', w / 2, 140, `bold 40px ${DISPLAY}`, winner ? winner.sail : '#f4f7fb', 'center');
  const rows = game.ships.filter((ship) => ship.active).slice().sort((a, b) => {
    const wins = (game.roundWins[b.index] || 0) - (game.roundWins[a.index] || 0);
    if (wins) return wins;
    return b.gold - a.gold;
  });
  rows.forEach((ship, i) => {
    const y = 210 + i * 48;
    const crew = CREWS[ship.index];
    ctx.fillStyle = 'rgba(8, 20, 32, 0.8)';
    roundRect(ctx, w / 2 - 220, y - 18, 440, 40, 8);
    ctx.fill();
    ctx.fillStyle = crew.sail;
    ctx.fillRect(w / 2 - 220, y - 18, 8, 40);
    fillText(ctx, `${i + 1}. ${crew.name}`, w / 2 - 190, y, `18px ${UI}`, '#f4f7fb');
    fillText(ctx, `${game.roundWins[ship.index]} rounds · ${ship.gold}g`, w / 2 + 190, y, `16px ${UI}`, '#ffd15c', 'right');
  });
  fillText(ctx, 'Enter rematch     Esc title', w / 2, h - 60, `16px ${UI}`, '#d5e6f2', 'center');
}

function drawPause(ctx, w, h, index) {
  ctx.fillStyle = 'rgba(4, 10, 18, 0.6)';
  ctx.fillRect(0, 0, w, h);
  fillText(ctx, 'PAUSED', w / 2, h / 2 - 110, `bold 42px ${DISPLAY}`, '#fff6d0', 'center');
  ['Resume', 'Options', 'Quit to title'].forEach((label, i) => {
    const y = h / 2 - 30 + i * 48;
    ctx.fillStyle = i === index ? 'rgba(240, 193, 74, 0.2)' : 'rgba(8, 20, 32, 0.8)';
    roundRect(ctx, w / 2 - 140, y - 18, 280, 40, 8);
    ctx.fill();
    fillText(ctx, label, w / 2, y, `18px ${UI}`, i === index ? '#ffd15c' : '#f4f7fb', 'center');
  });
}

function drawTitle(ctx, view) {
  const { w, h } = view;
  drawCover(ctx, view.cover, w, h);
  const shade = ctx.createLinearGradient(0, h * 0.35, 0, h);
  shade.addColorStop(0, 'rgba(4, 12, 20, 0)');
  shade.addColorStop(1, 'rgba(4, 12, 20, 0.88)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, w, h);
  if (view.icon && view.icon.complete && view.icon.naturalWidth) {
    const size = Math.min(96, w * 0.1);
    roundRect(ctx, w / 2 - size / 2, h * 0.16, size, size, 18);
    ctx.save();
    ctx.clip();
    ctx.drawImage(view.icon, w / 2 - size / 2, h * 0.16, size, size);
    ctx.restore();
  }
  fillText(ctx, 'KRAKEN KEEPERS', w / 2, h * 0.42, `bold ${Math.max(42, Math.min(84, w * 0.07))}px ${DISPLAY}`, '#fff6d0', 'center');
  fillText(ctx, 'Pirate ships fight. The kraken hunts the leader.', w / 2, h * 0.52, `20px ${UI}`, '#d5e6f2', 'center');
  const pulse = 0.55 + Math.sin(view.time * 0.005) * 0.45;
  ctx.globalAlpha = 0.45 + pulse * 0.55;
  fillText(ctx, 'Press Start / Enter', w / 2, h * 0.66, `bold 28px ${UI}`, '#ffd15c', 'center');
  ctx.globalAlpha = 1;
  fillText(ctx, 'C controls    O options    M mute', w / 2, h * 0.78, `16px ${UI}`, '#f4f7fb', 'center');
  fillText(ctx, '4 players · one screen · most gold after 3 minutes', w / 2, h * 0.86, `15px ${UI}`, '#d5e6f2', 'center');
  if (view.muted) fillText(ctx, 'MUTE', w - 24, h - 22, `bold 14px ${UI}`, '#ffb4b4', 'right');
}

function slotStatus(slot, fillBots) {
  if (slot === 'human') return 'READY';
  if (slot === 'bot') return 'BOT';
  if (slot === 'off') return 'OFF';
  return fillBots ? 'OPEN · BOT' : 'OPEN';
}

function drawJoin(ctx, view) {
  const { w, h } = view;
  ctx.fillStyle = '#071820';
  ctx.fillRect(0, 0, w, h);
  drawSea(ctx, view.time);
  ctx.fillStyle = 'rgba(4, 12, 20, 0.45)';
  ctx.fillRect(0, 0, w, h);
  fillText(ctx, 'WHO SAILS?', w / 2, 54, `bold 36px ${DISPLAY}`, '#fff6d0', 'center');
  fillText(ctx, 'Action joins. Secondary cycles bot / off. Enter sets sail.', w / 2, 92, `16px ${UI}`, '#d5e6f2', 'center');
  const cardW = Math.min(280, (w - 80) / 2);
  const cardH = Math.min(180, (h - 220) / 2);
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = w / 2 - cardW - 16 + col * (cardW + 32);
    const y = 130 + row * (cardH + 20);
    const crew = CREWS[i];
    const slot = view.slots[i];
    ctx.fillStyle = 'rgba(6, 16, 28, 0.82)';
    roundRect(ctx, x, y, cardW, cardH, 14);
    ctx.fill();
    ctx.fillStyle = crew.sail;
    ctx.fillRect(x, y, cardW, 8);
    fillText(ctx, crew.name, x + 16, y + 36, `bold 20px ${UI}`, '#f4f7fb');
    fillText(ctx, slotStatus(slot, view.fillBots), x + 16, y + 70, `18px ${UI}`, slot === 'human' ? '#8dffb0' : '#ffd15c');
    const binding = view.bindings[i];
    fillText(ctx, `${keyLabel(binding.action)} join   ${keyLabel(binding.secondary)} cycle`, x + 16, y + cardH - 36, `14px ${UI}`, '#d5e6f2');
    drawPadIcon(ctx, x + cardW - 24, y + 36, !!view.pads[i]);
  }
  const bots = view.fillBots ? 'Empty slots fill with bots (B to close them)' : 'Empty slots stay closed (B to fill them with bots)';
  fillText(ctx, bots, w / 2, h - 58, `15px ${UI}`, '#f4f7fb', 'center');
  fillText(ctx, 'Esc title', w / 2, h - 32, `14px ${UI}`, '#d5e6f2', 'center');
  if (view.message) fillText(ctx, view.message, w / 2, h - 84, `bold 16px ${UI}`, '#ffb4b4', 'center');
  if (view.muted) fillText(ctx, 'MUTE', w - 24, 28, `bold 14px ${UI}`, '#ffb4b4', 'right');
}

function drawOptions(ctx, view) {
  const { w, h } = view;
  ctx.fillStyle = '#071820';
  ctx.fillRect(0, 0, w, h);
  fillText(ctx, 'OPTIONS', w / 2, 70, `bold 40px ${DISPLAY}`, '#fff6d0', 'center');
  const rows = [
    `Volume    ${Math.round(view.settings.volume * 100)}%`,
    `Rounds    ${view.settings.roundCount}`,
    `Empty slots    ${view.settings.fillBots ? 'Bots' : 'Closed'}`,
    'Controls',
    'Back',
  ];
  rows.forEach((label, i) => {
    const y = 150 + i * 56;
    ctx.fillStyle = i === view.optionIndex ? 'rgba(240, 193, 74, 0.18)' : 'rgba(8, 20, 32, 0.85)';
    roundRect(ctx, w / 2 - 220, y - 20, 440, 44, 10);
    ctx.fill();
    fillText(ctx, label, w / 2, y, `20px ${UI}`, i === view.optionIndex ? '#ffd15c' : '#f4f7fb', 'center');
  });
  fillText(ctx, 'Left / right changes a value. Enter opens controls. Esc returns.', w / 2, h - 48, `15px ${UI}`, '#d5e6f2', 'center');
  if (view.muted) fillText(ctx, 'MUTE', w - 24, 28, `bold 14px ${UI}`, '#ffb4b4', 'right');
}

function drawControls(ctx, view) {
  const { w, h } = view;
  ctx.fillStyle = '#071820';
  ctx.fillRect(0, 0, w, h);
  fillText(ctx, 'CONTROLS', w / 2, 42, `bold 34px ${DISPLAY}`, '#fff6d0', 'center');
  fillText(ctx, 'A connected gamepad overrides that player. Start pauses. M mutes.', w / 2, 74, `14px ${UI}`, '#d5e6f2', 'center');
  const rowH = Math.min(22, (h - 160) / 24);
  for (let i = 0; i < 24; i++) {
    const player = Math.floor(i / 6);
    const field = BINDING_FIELDS[i % 6];
    const y = 100 + i * rowH;
    if (i === view.controlIndex) {
      ctx.fillStyle = 'rgba(240, 193, 74, 0.18)';
      ctx.fillRect(w / 2 - 280, y - rowH / 2, 560, rowH);
    }
    const crew = CREWS[player];
    ctx.font = `14px ${UI}`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = crew.sail;
    ctx.fillText(i % 6 === 0 ? crew.short : '', w / 2 - 260, y);
    ctx.fillStyle = '#f4f7fb';
    ctx.fillText(field[1], w / 2 - 200, y);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffd15c';
    ctx.fillText(keyLabel(view.bindings[player][field[0]]), w / 2 + 250, y);
  }
  const footer = view.capturing
    ? `Press a new key for ${view.captureLabel}`
    : 'Enter rebinds. Backspace restores defaults. Esc returns.';
  fillText(ctx, footer, w / 2, h - 28, `15px ${UI}`, view.capturing ? '#ffd15c' : '#d5e6f2', 'center');
}

export function render(ctx, view) {
  const { w, h, screen } = view;
  ctx.clearRect(0, 0, w, h);
  if (screen === 'title') drawTitle(ctx, view);
  else if (screen === 'join') drawJoin(ctx, view);
  else if (screen === 'options') drawOptions(ctx, view);
  else if (screen === 'controls') drawControls(ctx, view);
  else drawPlay(ctx, view);
}
