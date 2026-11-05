import { describe, expect, it } from "vitest";
import {
  AU,
  DAY,
  G,
  accelerations,
  add,
  advance,
  barycentric,
  cloneWorld,
  invariants,
  length,
  mul,
  osculatingPath,
  relativeElements,
  safeStep,
  sub,
  vec,
  verlet,
  type Body,
  type World,
} from "./nbody";
import { EXPERIMENTS, fromKepler } from "./presets";
const b = (
  id: string,
  mass: number,
  r = vec(),
  v = vec(),
  radius = 1,
): Body => ({ id, name: id, mass, radius, color: "#aabbcc", r, v });
function circular(): World {
  return barycentric({
    time: 0,
    bodies: [
      b("sun", 2e30),
      b("planet", 6e24, vec(AU), vec(0, Math.sqrt((G * (2e30 + 6e24)) / AU))),
    ],
  });
}
describe("N-body dynamics in SI", () => {
  it("applies equal and opposite pair forces including z", () => {
    const bodies = [
        b("a", 2e20, vec(0, 0, 0)),
        b("b", 5e18, vec(1e7, -2e7, 3e7)),
      ],
      a = accelerations(bodies);
    expect(
      length(add(mul(a[0], bodies[0].mass), mul(a[1], bodies[1].mass))) /
        (length(a[0]) * bodies[0].mass),
    ).toBeLessThan(1e-14);
    expect(a[0].z).toBeGreaterThan(0);
    expect(length(a[0])).toBeCloseTo((G * bodies[1].mass) / 14e14, 12);
  });
  it("a zero mass test particle feels gravity without perturbing the source", () => {
    const a = accelerations([b("source", 1e25), b("test", 0, vec(1e7))]);
    expect(a[0]).toEqual(vec());
    expect(a[1].x).toBeLessThan(0);
  });
  it("barycentric initialization removes bulk position and momentum", () => {
    const w = barycentric({
      time: 0,
      bodies: [
        b("a", 2, vec(20, 5, 2), vec(2, 3, 4)),
        b("b", 3, vec(-5, 2, 8), vec(-3, 2, 1)),
      ],
    });
    const i = invariants(w);
    expect(length(i.barycenter)).toBeLessThan(1e-12);
    expect(length(i.momentum)).toBeLessThan(1e-12);
  });
  it("conserves energy and angular momentum through four orbital periods", () => {
    let w = circular();
    const start = invariants(w),
      period = relativeElements(w.bodies[1], w.bodies[0])!.period!;
    let drift = 0;
    for (let i = 0; i < Math.ceil((4 * period) / 3600); i++) {
      w = verlet(w, 3600);
      if (i % 100 === 0)
        drift = Math.max(
          drift,
          Math.abs((invariants(w).energy - start.energy) / start.energy),
        );
    }
    expect(drift).toBeLessThan(1e-9);
    expect(
      length(sub(invariants(w).angular, start.angular)) / length(start.angular),
    ).toBeLessThan(1e-11);
    expect(length(invariants(w).momentum) / (6e24 * 30000)).toBeLessThan(1e-12);
  });
  it("shows second order trajectory convergence", () => {
    const start = circular(),
      o = relativeElements(start.bodies[1], start.bodies[0])!,
      duration = 7200 * 500,
      theta = duration * Math.sqrt((G * (2e30 + 6e24)) / AU ** 3);
    const target = vec(
      start.bodies[1].r.x * Math.cos(theta),
      start.bodies[1].r.x * Math.sin(theta),
    );
    const errors = [7200, 3600].map((dt) => {
      let w = cloneWorld(start);
      for (let t = 0; t < duration; t += dt) w = verlet(w, dt);
      return length(sub(w.bodies[1].r, target));
    });
    expect(o.e).toBeLessThan(1e-10);
    expect(errors[0] / errors[1]).toBeGreaterThan(3.8);
    expect(errors[0] / errors[1]).toBeLessThan(4.2);
  });
  it("conserves energy for an eccentric inclined orbit", () => {
    const initial = fromKepler(AU, 0.6, 42, 20, 40, 0, G * 2e30);
    let w = barycentric({
      time: 0,
      bodies: [b("s", 2e30), b("p", 6e20, initial.r, initial.v)],
    });
    const base = invariants(w);
    let drift = 0;
    for (let i = 0; i < 40000; i++) {
      w = verlet(w, 900);
      if (i % 50 === 0)
        drift = Math.max(
          drift,
          Math.abs((invariants(w).energy - base.energy) / base.energy),
        );
    }
    expect(drift).toBeLessThan(2e-6);
  });
  it("extracts inclination, apsides and period from known 3D elements", () => {
    const a = 2 * AU,
      e = 0.3;
    const orbit = fromKepler(a, e, 55, 25, 80, 40, G * 2e30);
    const source = b("s", 2e30),
      sat = b("p", 0, orbit.r, orbit.v);
    const o = relativeElements(sat, source)!;
    expect(o.e).toBeCloseTo(e, 12);
    expect(o.inclination).toBeCloseTo(55, 10);
    expect(o.periapsis! / a).toBeCloseTo(1 - e, 12);
    expect(o.apoapsis! / a).toBeCloseTo(1 + e, 12);
    expect(o.period).toBeCloseTo(
      2 * Math.PI * Math.sqrt(a ** 3 / (G * 2e30)),
      4,
    );
    for (const p of osculatingPath(sat, source))
      expect(Number.isFinite(length(p))).toBe(true);
  });
  it("handles unbound and radial trajectories without inventing periods", () => {
    const source = b("s", 2e30),
      sat = b("p", 0, vec(AU), vec(0, 60000, 0));
    const o = relativeElements(sat, source)!;
    expect(o.bound).toBe(false);
    expect(o.period).toBeNull();
    expect(o.apoapsis).toBeNull();
    expect(
      relativeElements(b("r", 0, vec(AU), vec(2000)), source)!.inclination,
    ).toBeNull();
    expect(relativeElements(b("r", 0, vec(AU)), b("zero", 0))).toBeNull();
  });
  it("reduces step size in close encounters and respects work budget", () => {
    const far = circular(),
      near = {
        ...far,
        bodies: [
          far.bodies[0],
          { ...far.bodies[1], r: add(far.bodies[0].r, vec(1e8)) },
        ],
      };
    expect(safeStep(near, 3600)).toBeLessThan(safeStep(far, 3600));
    const result = advance(far, DAY * 100, 3600, 5);
    expect(result.steps).toBe(5);
    expect(result.advanced).toBeLessThan(DAY * 100);
    expect(result.stop).toBeNull();
  });
  it("stops before contact, without merging or tunneling", () => {
    const w = {
      time: 0,
      bodies: [
        b("a", 0, vec(-10), vec(100), 1),
        b("b", 0, vec(10), vec(-100), 1),
      ],
    };
    const result = advance(w, 1, 1, 700);
    expect(result.stop).toContain("接触");
    expect(
      length(sub(result.world.bodies[0].r, result.world.bodies[1].r)),
    ).toBeGreaterThan(2);
    expect(result.world.time).toBeLessThan(0.1);
    expect(w.bodies[0].r.x).toBe(-10);
  });
  it("stops preexisting overlaps and unresolved extreme encounters", () => {
    expect(
      advance(
        {
          time: 0,
          bodies: [b("a", 1, vec(), vec(), 10), b("b", 1, vec(1), vec(), 10)],
        },
        1,
        1,
      ).stop,
    ).toContain("接触");
    expect(
      advance(
        {
          time: 0,
          bodies: [
            b("a", 1e35, vec(), vec(), 0.01),
            b("b", 1, vec(1), vec(), 0.01),
          ],
        },
        1,
        1,
      ).stop,
    ).toContain("計算限界");
  });
  it("preserves inertial straight line motion with one body", () => {
    const r = advance(
      { time: 0, bodies: [b("a", 3, vec(1, 2, 3), vec(4, 5, 6))] },
      10,
      1,
    );
    expect(r.world.bodies[0].r).toEqual(vec(41, 52, 63));
    expect(r.world.time).toBe(10);
  });
  it("conserves energy in a mutually interacting three-body solution", () => {
    const radius = 1e8,
      mass = 1e25,
      omega = Math.sqrt((G * mass) / (Math.sqrt(3) * radius ** 3));
    let w: World = {
      time: 0,
      bodies: [0, 1, 2].map((i) => {
        const angle = (i * 2 * Math.PI) / 3;
        return b(
          String(i),
          mass,
          vec(radius * Math.cos(angle), radius * Math.sin(angle)),
          vec(
            -radius * omega * Math.sin(angle),
            radius * omega * Math.cos(angle),
          ),
        );
      }),
    };
    const start = invariants(w);
    for (let i = 0; i < 10000; i++) w = verlet(w, 10);
    expect(
      Math.abs((invariants(w).energy - start.energy) / start.energy),
    ).toBeLessThan(1e-9);
    expect(
      length(sub(invariants(w).angular, start.angular)) / length(start.angular),
    ).toBeLessThan(1e-11);
  });
  it("keeps frame-sized adaptive advancement within the energy error budget", () => {
    let w = circular();
    const start = invariants(w);
    for (let i = 0; i < 3000; i++) {
      const result = advance(w, DAY * (0.6 + (i % 5) * 0.1), 1800);
      expect(result.stop).toBeNull();
      w = result.world;
    }
    expect(
      Math.abs((invariants(w).energy - start.energy) / start.energy),
    ).toBeLessThan(1e-8);
  });
  it("initializes every preset with finite nonoverlapping states", () => {
    for (const p of EXPERIMENTS) {
      const result = advance(cloneWorld(p.world), p.step * 3, p.step);
      expect(result.stop, p.id).toBeNull();
      expect(
        result.world.bodies.every(
          (b) => Number.isFinite(length(b.r)) && Number.isFinite(length(b.v)),
        ),
      ).toBe(true);
      expect(result.advanced, p.id).toBeGreaterThan(0);
    }
  });
});
