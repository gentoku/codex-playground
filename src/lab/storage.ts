import { cloneWorld, type World } from "../physics/nbody";
export type SavedExperiment = {
  version: 1;
  id: string;
  name: string;
  savedAt: string;
  scale: number;
  step: number;
  rate: number;
  world: World;
};
export const STORAGE_KEY = "gravity-lab.experiments.v1";
const finite = (n: unknown, min: number, max: number): n is number =>
  typeof n === "number" && Number.isFinite(n) && n >= min && n <= max;
export function validateExperiment(input: unknown): SavedExperiment {
  if (!input || typeof input !== "object")
    throw Error("実験データがオブジェクトではありません。");
  const s = input as SavedExperiment;
  if (
    s.version !== 1 ||
    typeof s.name !== "string" ||
    !s.name.trim() ||
    s.name.length > 80 ||
    typeof s.id !== "string" ||
    s.id.length > 100 ||
    typeof s.savedAt !== "string" ||
    !Number.isFinite(Date.parse(s.savedAt))
  )
    throw Error("ファイルの形式・バージョン・名前が正しくありません。");
  if (
    !finite(s.scale, 1e5, 1e15) ||
    !finite(s.step, 0.001, 86400) ||
    !finite(s.rate, 0.001, 1e9) ||
    !s.world ||
    !finite(s.world.time, 0, 1e15) ||
    !Array.isArray(s.world.bodies) ||
    s.world.bodies.length < 1 ||
    s.world.bodies.length > 24
  )
    throw Error("実験の設定または天体数が範囲外です（1〜24天体）。");
  const ids = new Set<string>();
  for (const b of s.world.bodies) {
    if (
      !b ||
      typeof b.id !== "string" ||
      !b.id ||
      b.id.length > 100 ||
      ids.has(b.id) ||
      typeof b.name !== "string" ||
      !b.name.trim() ||
      b.name.length > 40 ||
      !/^#[0-9a-fA-F]{6}$/.test(b.color) ||
      !finite(b.mass, 0, 1e35) ||
      !finite(b.radius, 0.01, 1e12)
    )
      throw Error("天体の名前・質量・半径・色・IDが不正です。");
    ids.add(b.id);
    for (const key of ["r", "v"] as const)
      if (
        !b[key] ||
        !["x", "y", "z"].every((axis) =>
          finite(
            b[key][axis as "x"],
            -(key === "r" ? 1e16 : 1e8),
            key === "r" ? 1e16 : 1e8,
          ),
        )
      )
        throw Error("位置または速度が計算可能な範囲外です。");
  }
  // Strip unknown fields and prototype data from untrusted imported JSON.
  return {
    version: 1,
    id: s.id,
    name: s.name.trim(),
    savedAt: s.savedAt,
    scale: s.scale,
    step: s.step,
    rate: s.rate,
    world: {
      time: s.world.time,
      bodies: s.world.bodies.map((b) => ({
        id: b.id,
        name: b.name,
        mass: b.mass,
        radius: b.radius,
        color: b.color,
        r: { x: b.r.x, y: b.r.y, z: b.r.z },
        v: { x: b.v.x, y: b.v.y, z: b.v.z },
      })),
    },
  };
}
export function readLibrary(): SavedExperiment[] {
  const data = localStorage.getItem(STORAGE_KEY);
  if (!data) return [];
  const parsed: unknown = JSON.parse(data);
  if (!Array.isArray(parsed) || parsed.length > 12)
    throw Error(
      "保存ライブラリを読み込めません。JSONバックアップから復元してください。",
    );
  return parsed.map(validateExperiment);
}
export const snapshot = (
  name: string,
  world: World,
  scale: number,
  step: number,
  rate: number,
): SavedExperiment =>
  validateExperiment({
    version: 1,
    id: crypto.randomUUID(),
    name,
    savedAt: new Date().toISOString(),
    world: cloneWorld(world),
    scale,
    step,
    rate,
  });
