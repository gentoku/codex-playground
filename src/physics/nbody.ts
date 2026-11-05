/** Newtonian point-mass gravity. All state is SI, right-handed 3D coordinates. */
export const G = 6.6743e-11; // CODATA 2018, m³ kg⁻¹ s⁻²
export const AU = 149_597_870_700; // IAU 2012, exact
export const DAY = 86400;
export type V3 = { x: number; y: number; z: number };
export type Body = {
  id: string;
  name: string;
  mass: number;
  radius: number;
  color: string;
  r: V3;
  v: V3;
};
export type World = { bodies: Body[]; time: number };
export type Integration = {
  world: World;
  advanced: number;
  steps: number;
  stop: string | null;
};
export const vec = (x = 0, y = 0, z = 0): V3 => ({ x, y, z });
export const add = (a: V3, b: V3): V3 => vec(a.x + b.x, a.y + b.y, a.z + b.z);
export const sub = (a: V3, b: V3): V3 => vec(a.x - b.x, a.y - b.y, a.z - b.z);
export const mul = (a: V3, s: number): V3 => vec(a.x * s, a.y * s, a.z * s);
export const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
export const cross = (a: V3, b: V3): V3 =>
  vec(a.y * b.z - a.z * b.y, a.z * b.x - a.x * b.z, a.x * b.y - a.y * b.x);
export const length = (a: V3) => Math.hypot(a.x, a.y, a.z);
export const unit = (a: V3) => (length(a) > 0 ? mul(a, 1 / length(a)) : vec());
export const cloneWorld = (w: World): World => ({
  time: w.time,
  bodies: w.bodies.map((b) => ({ ...b, r: { ...b.r }, v: { ...b.v } })),
});
export function accelerations(bodies: Body[]): V3[] {
  const a = bodies.map(() => vec());
  for (let i = 0; i < bodies.length; i++)
    for (let j = i + 1; j < bodies.length; j++) {
      const d = sub(bodies[j].r, bodies[i].r),
        distance = length(d);
      if (distance === 0) continue; // Contact is intercepted before integration.
      const f = G / distance ** 3;
      a[i] = add(a[i], mul(d, f * bodies[j].mass));
      a[j] = sub(a[j], mul(d, f * bodies[i].mass));
    }
  return a;
}
export function verlet(w: World, dt: number): World {
  const a = accelerations(w.bodies);
  const bodies = w.bodies.map((b, i) => ({
    ...b,
    r: add(b.r, add(mul(b.v, dt), mul(a[i], (dt * dt) / 2))),
  }));
  const next = accelerations(bodies);
  return {
    time: w.time + dt,
    bodies: bodies.map((b, i) => ({
      ...b,
      v: add(b.v, mul(add(a[i], next[i]), dt / 2)),
    })),
  };
}
export function invariants(w: World) {
  let kinetic = 0,
    potential = 0,
    momentum = vec(),
    angular = vec(),
    mass = 0,
    barycenter = vec();
  for (const b of w.bodies) {
    kinetic += (b.mass * dot(b.v, b.v)) / 2;
    momentum = add(momentum, mul(b.v, b.mass));
    angular = add(angular, mul(cross(b.r, b.v), b.mass));
    mass += b.mass;
    barycenter = add(barycenter, mul(b.r, b.mass));
  }
  for (let i = 0; i < w.bodies.length; i++)
    for (let j = i + 1; j < w.bodies.length; j++) {
      const d = length(sub(w.bodies[i].r, w.bodies[j].r));
      if (d > 0) potential -= (G * w.bodies[i].mass * w.bodies[j].mass) / d;
    }
  return {
    energy: kinetic + potential,
    energyScale: kinetic + Math.abs(potential),
    momentum,
    angular,
    mass,
    barycenter: mass > 0 ? mul(barycenter, 1 / mass) : vec(),
  };
}
export function barycentric(w: World): World {
  const m = invariants(w),
    v = m.mass > 0 ? mul(m.momentum, 1 / m.mass) : vec();
  return {
    time: w.time,
    bodies: w.bodies.map((b) => ({
      ...b,
      r: sub(b.r, m.barycenter),
      v: sub(b.v, v),
    })),
  };
}
/** Conservative pairwise timescale limits; render speed never enlarges the allowed step. */
export function safeStep(w: World, ceiling: number): number {
  let dt = ceiling;
  for (let i = 0; i < w.bodies.length; i++)
    for (let j = i + 1; j < w.bodies.length; j++) {
      const a = w.bodies[i],
        b = w.bodies[j],
        d = length(sub(a.r, b.r));
      const speed = length(sub(a.v, b.v)),
        mu = G * (a.mass + b.mass);
      if (mu > 0) dt = Math.min(dt, 0.015 * Math.sqrt(d ** 3 / mu));
      if (speed > 0) dt = Math.min(dt, (0.02 * d) / speed);
    }
  return dt;
}
function contactBetween(before: World, after: World): string | null {
  for (let i = 0; i < before.bodies.length; i++)
    for (let j = i + 1; j < before.bodies.length; j++) {
      const a = before.bodies[i],
        b = before.bodies[j],
        start = sub(a.r, b.r);
      const end = sub(after.bodies[i].r, after.bodies[j].r),
        d = sub(end, start);
      const u =
        dot(d, d) > 0
          ? Math.max(0, Math.min(1, -dot(start, d) / dot(d, d)))
          : 0;
      if (length(add(start, mul(d, u))) <= a.radius + b.radius)
        return `${a.name} と ${b.name} が接触しました。接触直前の状態で停止。`;
    }
  return null;
}
export function advance(
  w: World,
  seconds: number,
  ceiling: number,
  budget = 700,
): Integration {
  let current = w,
    advanced = 0,
    steps = 0;
  const contact = contactBetween(w, w);
  if (contact) return { world: current, advanced, steps, stop: contact };
  while (advanced < seconds && steps < budget) {
    const dt = Math.min(safeStep(current, ceiling), seconds - advanced);
    if (!Number.isFinite(dt) || dt < 1e-6)
      return {
        world: current,
        advanced,
        steps,
        stop: "近接遭遇が計算限界に達しました。位置または速度を調整してください。",
      };
    const next = verlet(current, dt);
    steps++;
    if (
      next.bodies.some(
        (b) =>
          ![b.r.x, b.r.y, b.r.z, b.v.x, b.v.y, b.v.z].every(Number.isFinite),
      )
    )
      return {
        world: current,
        advanced,
        steps,
        stop: "数値が計算範囲を超えたため停止しました。",
      };
    const collision = contactBetween(current, next);
    if (collision) return { world: current, advanced, steps, stop: collision };
    current = next;
    advanced += dt;
  }
  return { world: current, advanced, steps, stop: null };
}
export function relativeElements(body: Body, primary: Body) {
  const r = sub(body.r, primary.r),
    v = sub(body.v, primary.v),
    radius = length(r),
    mu = G * (body.mass + primary.mass);
  if (radius === 0 || mu === 0) return null;
  const h = cross(r, v),
    hn = length(h),
    energy = dot(v, v) / 2 - mu / radius;
  const ev = sub(mul(cross(v, h), 1 / mu), mul(r, 1 / radius)),
    e = length(ev);
  const bound = energy < (-1e-12 * mu) / radius,
    a = bound ? -mu / (2 * energy) : null;
  const normal = unit(h),
    ex = e > 1e-7 ? unit(ev) : unit(r),
    ey = unit(cross(normal, ex));
  return {
    radius,
    speed: length(v),
    energy,
    e,
    a,
    p: (hn * hn) / mu,
    ex,
    ey,
    normal,
    inclination:
      hn > 1e-10
        ? (Math.acos(Math.max(-1, Math.min(1, normal.z))) * 180) / Math.PI
        : null,
    periapsis: (hn * hn) / mu / (1 + e),
    apoapsis: a && e < 1 ? a * (1 + e) : null,
    period: a ? 2 * Math.PI * Math.sqrt(a ** 3 / mu) : null,
    bound,
    radial: hn < 1e-10,
  };
}
/** Instantaneous two-body osculating conic, not an N-body future prediction. */
export function osculatingPath(body: Body, primary: Body): V3[] {
  const o = relativeElements(body, primary);
  if (!o || o.radial) return [];
  const limit = o.e < 1 ? Math.PI : Math.acos(-1 / o.e) - 0.025;
  const points: V3[] = [];
  for (let i = 0; i <= 240; i++) {
    const angle = -limit + (2 * limit * i) / 240,
      r = o.p / (1 + o.e * Math.cos(angle));
    if (r > 0 && r < 100 * Math.max(o.radius, AU))
      points.push(
        add(
          primary.r,
          add(mul(o.ex, r * Math.cos(angle)), mul(o.ey, r * Math.sin(angle))),
        ),
      );
  }
  return points;
}
