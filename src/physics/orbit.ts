// SI units. WGS 84 GM and IUGG mean Earth radius.
export const MU = 3.986004418e14;
export const R = 6_371_008.8;
export const DT = 1;
export type Vec = { x: number; y: number };
export type State = { r: Vec; v: Vec; t: number; collided: boolean };
export const norm = (v: Vec) => Math.hypot(v.x, v.y);
export const circularSpeed = (r: number) => Math.sqrt(MU / r);
export const escapeSpeed = (r: number) => Math.sqrt(2 * MU / r);
export function initial(altitude: number, speed: number, angle: number): State {
  const a = angle * Math.PI / 180;
  return { r: { x: R + altitude * 1000, y: 0 }, v: { x: speed * 1000 * Math.cos(a), y: speed * 1000 * Math.sin(a) }, t: 0, collided: false };
}
const acceleration = (r: Vec): Vec => { const f = -MU / norm(r) ** 3; return { x: r.x * f, y: r.y * f }; };
export function step(s: State, dt = DT): State {
  if (s.collided) return s;
  const a = acceleration(s.r);
  const r = { x: s.r.x + s.v.x * dt + a.x * dt * dt / 2, y: s.r.y + s.v.y * dt + a.y * dt * dt / 2 };
  // Segment/sphere intersection also catches a crossing whose endpoint exits Earth.
  const d = { x: r.x - s.r.x, y: r.y - s.r.y };
  const A = d.x ** 2 + d.y ** 2, B = 2 * (s.r.x * d.x + s.r.y * d.y), C = norm(s.r) ** 2 - R ** 2;
  const disc = B * B - 4 * A * C;
  const u = A > 0 && disc >= 0 ? (-B - Math.sqrt(disc)) / (2 * A) : Infinity;
  if (norm(s.r) <= R || (u >= 0 && u <= 1)) {
    const f = Math.max(0, Math.min(1, u));
    const p = Number.isFinite(f) ? { x: s.r.x + d.x * f, y: s.r.y + d.y * f } : s.r;
    const n = norm(p);
    return { ...s, r: { x: p.x * R / n, y: p.y * R / n }, t: s.t + (Number.isFinite(f) ? f : 0) * dt, collided: true };
  }
  const b = acceleration(r);
  return { r, v: { x: s.v.x + (a.x + b.x) * dt / 2, y: s.v.y + (a.y + b.y) * dt / 2 }, t: s.t + dt, collided: false };
}
export function elements(s: State) {
  const radius = norm(s.r), speed = norm(s.v);
  const energy = speed ** 2 / 2 - MU / radius;
  const h = s.r.x * s.v.y - s.r.y * s.v.x;
  const dot = s.r.x * s.v.x + s.r.y * s.v.y;
  const evec = { x: ((speed ** 2 - MU / radius) * s.r.x - dot * s.v.x) / MU, y: ((speed ** 2 - MU / radius) * s.r.y - dot * s.v.y) / MU };
  const e = norm(evec), p = h * h / MU;
  const bound = energy < -1e-7;
  const a = bound ? -MU / (2 * energy) : null;
  return { radius, speed, energy, h, e, p, evec, bound, periapsis: p / (1 + e) - R, apoapsis: bound && e < 1 ? p / (1 - e) - R : null, period: a ? 2 * Math.PI * Math.sqrt(a ** 3 / MU) : null };
}
export function prediction(s: State): Vec[][] {
  const o = elements(s);
  if (Math.abs(o.h) < 1) { // Degenerate radial conic.
    const n = norm(s.r), far = o.bound ? MU / -o.energy : R * 80;
    return [[{ x: s.r.x * R / n, y: s.r.y * R / n }, { x: s.r.x * far / n, y: s.r.y * far / n }]];
  }
  const orientation = o.e > 1e-8 ? Math.atan2(o.evec.y, o.evec.x) : Math.atan2(s.r.y, s.r.x);
  const limit = o.e < 1 ? Math.PI : Math.acos(-1 / o.e) - 0.001;
  const paths: Vec[][] = []; let path: Vec[] = [];
  for (let i = 0; i <= 900; i++) {
    const nu = -limit + 2 * limit * i / 900;
    const r = o.p / (1 + o.e * Math.cos(nu));
    if (r < R || r > R * 100) { if (path.length) paths.push(path); path = []; continue; }
    path.push({ x: r * Math.cos(nu + orientation), y: r * Math.sin(nu + orientation) });
  }
  if (path.length) paths.push(path);
  return paths;
}
export const PRESETS = [
  { name: '円軌道', subtitle: '地球をめぐる、絶妙なバランス', altitude: 2000, speed: circularSpeed(R + 2e6) / 1000, angle: 90 },
  { name: '楕円軌道', subtitle: '速さと高度が変わる旅', altitude: 2000, speed: 8.3, angle: 90 },
  { name: '衝突軌道', subtitle: '速度が足りないと、どうなる？', altitude: 2000, speed: 4.5, angle: 90 },
  { name: '脱出軌道', subtitle: '地球の重力を振り切る', altitude: 2000, speed: 10.5, angle: 65 },
];
