import { TICK_HZ } from './constants.js';

export function winsNeeded(roundCount) {
  return Math.ceil(roundCount / 2);
}

export function formatClock(ticks) {
  const safe = Math.max(0, ticks | 0);
  const total = Math.ceil(safe / TICK_HZ);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function activeShips(ships) {
  return ships.filter((ship) => ship.active);
}

export function pickRoundWinner(ships) {
  const active = activeShips(ships);
  if (!active.length) return null;
  const ranked = [...active].sort((a, b) => {
    if (b.gold !== a.gold) return b.gold - a.gold;
    if (a.timesSunk !== b.timesSunk) return a.timesSunk - b.timesSunk;
    if (b.sinks !== a.sinks) return b.sinks - a.sinks;
    return a.index - b.index;
  });
  return ranked[0].index;
}

export function pickMatchWinner(ships, roundWins) {
  const active = activeShips(ships);
  if (!active.length) return null;
  const ranked = [...active].sort((a, b) => {
    const winDiff = (roundWins[b.index] || 0) - (roundWins[a.index] || 0);
    if (winDiff !== 0) return winDiff;
    if (b.gold !== a.gold) return b.gold - a.gold;
    return a.index - b.index;
  });
  return ranked[0].index;
}

export function leaderCandidates(ships) {
  const living = ships.filter((ship) => ship.active && !ship.sunk);
  if (!living.length) return [];
  let best = -1;
  for (const ship of living) if (ship.gold > best) best = ship.gold;
  if (best <= 0) return [];
  return living.filter((ship) => ship.gold === best);
}
