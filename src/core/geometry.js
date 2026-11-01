export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function angNorm(angle) {
  const turn = Math.PI * 2;
  let a = angle % turn;
  if (a > Math.PI) a -= turn;
  if (a < -Math.PI) a += turn;
  return a;
}

export function circlesOverlap(a, b, ra, rb) {
  const r = ra + rb;
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy <= r * r;
}

export function circleHitsRect(c, r, rect) {
  const nx = clamp(c.x, rect.x, rect.x + rect.w);
  const ny = clamp(c.y, rect.y, rect.y + rect.h);
  const dx = c.x - nx;
  const dy = c.y - ny;
  return dx * dx + dy * dy < r * r;
}
