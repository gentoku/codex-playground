import { useState, type FormEvent } from "react";
import { AU, type Body, type V3 } from "../physics/nbody";
export default function BodyEditor({
  body,
  onApply,
  onDelete,
  onImpulse,
}: {
  body: Body;
  onApply: (b: Body) => void;
  onDelete: () => void;
  onImpulse: (dv: V3) => void;
}) {
  const [unit, setUnit] = useState<"au" | "km">("au"),
    [dv, setDv] = useState({ x: "0", y: "0.1", z: "0" });
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget),
      n = (name: string) => Number(data.get(name));
    const scale = unit === "au" ? AU : 1000;
    onApply({
      ...body,
      name: String(data.get("name")).trim(),
      mass: n("mass"),
      radius: n("radius") * 1000,
      color: String(data.get("color")),
      r: { x: n("rx") * scale, y: n("ry") * scale, z: n("rz") * scale },
      v: { x: n("vx") * 1000, y: n("vy") * 1000, z: n("vz") * 1000 },
    });
  };
  return (
    <div className="body-editor">
      <p className="small-note">
        変更・Δvの適用時は一時停止し、保存量の比較基準を更新します。
      </p>
      <form onSubmit={submit} key={`${body.id}-${unit}`}>
        <div className="editor-name">
          <label>
            名前
            <input
              name="name"
              aria-label="天体名"
              defaultValue={body.name}
              required
              maxLength={40}
            />
          </label>
          <label>
            色
            <input
              type="color"
              name="color"
              aria-label="天体の色"
              defaultValue={body.color}
            />
          </label>
        </div>
        <div className="editor-pair">
          <label>
            質量 <small>kg</small>
            <input
              aria-label="質量 kg"
              name="mass"
              type="number"
              min="0"
              max="1e35"
              step="any"
              required
              defaultValue={body.mass}
            />
          </label>
          <label>
            物理半径 <small>km</small>
            <input
              aria-label="物理半径 km"
              name="radius"
              type="number"
              min="0.00001"
              max="1e9"
              step="any"
              required
              defaultValue={body.radius / 1000}
            />
          </label>
        </div>
        <div className="editor-subtitle">
          位置{" "}
          <select
            aria-label="位置の単位"
            value={unit}
            onChange={(e) => setUnit(e.target.value as "au" | "km")}
          >
            <option value="au">AU</option>
            <option value="km">km</option>
          </select>
        </div>
        <div className="xyz-row">
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={axis}>
              {axis.toUpperCase()}
              <input
                name={`r${axis}`}
                aria-label={`位置 ${axis}`}
                type="number"
                step="any"
                required
                defaultValue={Number(
                  (body.r[axis] / (unit === "au" ? AU : 1000)).toPrecision(12),
                )}
              />
            </label>
          ))}
        </div>
        <div className="editor-subtitle">
          速度 <small>km/s · 慣性座標成分</small>
        </div>
        <div className="xyz-row">
          {(["x", "y", "z"] as const).map((axis) => (
            <label key={axis}>
              {axis.toUpperCase()}
              <input
                name={`v${axis}`}
                aria-label={`速度 ${axis}`}
                type="number"
                step="any"
                required
                defaultValue={Number((body.v[axis] / 1000).toPrecision(12))}
              />
            </label>
          ))}
        </div>
        <div className="editor-buttons">
          <button type="submit" className="lab-primary">
            変更を適用
          </button>
          <button type="button" className="lab-danger" onClick={onDelete}>
            天体を削除
          </button>
        </div>
      </form>
      <div className="editor-subtitle">
        瞬間噴射 Δv <small>km/s</small>
      </div>
      <div className="xyz-row">
        {(["x", "y", "z"] as const).map((axis) => (
          <label key={axis}>
            Δv {axis.toUpperCase()}
            <input
              aria-label={`探索室 Δv ${axis}`}
              type="number"
              min="-100000"
              max="100000"
              step="any"
              value={dv[axis]}
              onChange={(e) => setDv({ ...dv, [axis]: e.target.value })}
            />
          </label>
        ))}
      </div>
      <button
        className="lab-button wide"
        onClick={() => {
          const values = Object.values(dv).map(Number);
          if (
            Object.values(dv).some((v) => !v.trim()) ||
            values.some((v) => !Number.isFinite(v) || Math.abs(v) > 100000)
          )
            return;
          onImpulse({
            x: Number(dv.x) * 1000,
            y: Number(dv.y) * 1000,
            z: Number(dv.z) * 1000,
          });
        }}
      >
        選択天体に Δv を適用
      </button>
    </div>
  );
}
