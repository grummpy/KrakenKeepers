export const TICK_HZ = 60;
export const DT = 1 / TICK_HZ;

export const ARENA_W = 1600;
export const ARENA_H = 900;
export const SHIP_RADIUS = 22;

export const SHIP_ACCEL = 280;
export const SHIP_MAX_SPEED = 240;
export const SHIP_REVERSE_MAX = 90;
export const SHIP_DRAG = 0.45;
export const SHIP_LATERAL_DRAG = 1.35;
export const SHIP_TURN_RATE = 2.35;
export const SHIP_HULL = 100;

export const CANNON_COOLDOWN_TICKS = 48;
export const BALL_SPEED = 460;
export const BALL_RADIUS = 5;
export const BALL_DAMAGE = 28;
export const BALL_LIFE_TICKS = 78;
export const BALL_GRACE_TICKS = 8;
export const BROADSIDE_SPACING = 16;

export const ROUND_SECONDS = 180;
export const ROUND_TICKS = ROUND_SECONDS * TICK_HZ;
export const RESPAWN_TICKS = 3 * TICK_HZ;
export const INVULN_TICKS = 90;
export const SPAWN_INVULN_TICKS = 60;

export const CHEST_GOLD = 25;
export const CHEST_COUNT = 5;
export const CHEST_RESPAWN_TICKS = 8 * TICK_HZ;
export const COIN_VALUE = 5;
export const PICKUP_RADIUS = 14;

export const KRAKEN_FIRST_TICKS = 8 * TICK_HZ;
export const KRAKEN_INTERVAL_TICKS = 12 * TICK_HZ;
export const KRAKEN_RETRY_TICKS = 2 * TICK_HZ;
export const KRAKEN_TELEGRAPH_TICKS = 96;
export const KRAKEN_RADIUS = 110;
export const KRAKEN_DAMAGE = 46;
export const KRAKEN_KNOCKBACK = 260;

export const POWER_TICKS = 6 * TICK_HZ;
export const POWER_SPAWN_TICKS = 10 * TICK_HZ;
export const POWER_MAX = 2;
export const PATCH_HEAL = 40;
export const POWER_TYPES = ['powder', 'wind', 'patch'];

export const COUNTDOWN_TICKS = 3 * TICK_HZ;
export const BANNER_TICKS = 150;
export const ROUND_CHOICES = [1, 3, 5];

export const WIND_ACCEL = 1.5;
export const WIND_MAX = 1.35;
export const WIND_TURN = 1.12;

export const SPAWNS = [
  { x: 170, y: 160, heading: 0.55 },
  { x: 1430, y: 160, heading: 2.55 },
  { x: 170, y: 740, heading: -0.55 },
  { x: 1430, y: 740, heading: -2.55 },
];

export const ROCKS = [
  { x: 680, y: 370, w: 240, h: 160 },
  { x: 300, y: 400, w: 130, h: 110 },
  { x: 1160, y: 390, w: 150, h: 120 },
  { x: 760, y: 130, w: 110, h: 80 },
];

export const CREWS = [
  { name: 'Red Raider', short: 'P1', hull: '#8d3a2f', sail: '#e23b3b', trim: '#ffd5cc', flag: '#4c1616' },
  { name: 'Blue Buccaneer', short: 'P2', hull: '#24467a', sail: '#3c7dff', trim: '#d7e6ff', flag: '#12243f' },
  { name: 'Green Privateer', short: 'P3', hull: '#1d6842', sail: '#2fbf71', trim: '#d9ffe8', flag: '#0e3320' },
  { name: 'Gold Corsair', short: 'P4', hull: '#8a5e28', sail: '#f0c14a', trim: '#fff1c4', flag: '#3f2a10' },
];
