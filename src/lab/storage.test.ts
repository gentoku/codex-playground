import { describe, expect, it } from "vitest";
import { snapshot, validateExperiment } from "./storage";
import { EXPERIMENTS } from "../physics/presets";
const saved = () =>
  snapshot(
    "テスト実験",
    EXPERIMENTS[0].world,
    EXPERIMENTS[0].scale,
    1800,
    86400,
  );
describe("versioned experiment files", () => {
  it("roundtrips all presets without changing physical state", () => {
    for (const p of EXPERIMENTS) {
      const s = snapshot(p.name, p.world, p.scale, p.step, p.rate);
      expect(validateExperiment(JSON.parse(JSON.stringify(s)))).toEqual(s);
    }
  });
  it("copies state and strips unknown data", () => {
    const s = saved();
    const parsed = validateExperiment({ ...s, unknown: "ignored" });
    expect(parsed).not.toHaveProperty("unknown");
    parsed.world.bodies[0].r.x = 1;
    expect(s.world.bodies[0].r.x).not.toBe(1);
  });
  it("rejects malformed, unsupported or oversized body collections", () => {
    for (const s of [
      null,
      {},
      { ...saved(), version: 2 },
      {
        ...saved(),
        world: { time: 0, bodies: Array(25).fill(saved().world.bodies[0]) },
      },
    ])
      expect(() => validateExperiment(s)).toThrow();
  });
  it("rejects nonfinite values, negative masses, duplicate IDs and unsafe labels", () => {
    for (const alter of [
      (s: ReturnType<typeof saved>) => {
        s.world.bodies[0].mass = -1;
      },
      (s: ReturnType<typeof saved>) => {
        s.world.bodies[0].r.x = Infinity;
      },
      (s: ReturnType<typeof saved>) => {
        s.world.bodies[0].v.z = NaN;
      },
      (s: ReturnType<typeof saved>) => {
        s.world.bodies[1].id = s.world.bodies[0].id;
      },
      (s: ReturnType<typeof saved>) => {
        s.world.bodies[0].color = "url(evil)";
      },
      (s: ReturnType<typeof saved>) => {
        s.world.bodies[0].radius = 0;
      },
      (s: ReturnType<typeof saved>) => {
        s.name = " ";
      },
    ]) {
      const s = saved();
      alter(s);
      expect(() => validateExperiment(s)).toThrow();
    }
  });
  it("allows a massless probe and arbitrary finite 3D velocity", () => {
    const s = saved();
    s.world.bodies[1].mass = 0;
    s.world.bodies[1].v.z = -10000;
    expect(validateExperiment(s).world.bodies[1].v.z).toBe(-10000);
  });
});
