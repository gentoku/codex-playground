import { useEffect, useRef, useState } from "react";
import {
  Activity,
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpen,
  Crosshair,
  Download,
  Globe2,
  Layers3,
  Orbit,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Save,
  SlidersHorizontal,
  X,
} from "lucide-react";
import {
  AU,
  DAY,
  G,
  add,
  advance,
  cloneWorld,
  cross,
  invariants,
  length,
  relativeElements,
  sub,
  vec,
  type Body,
  type V3,
  type World,
} from "../physics/nbody";
import { EXPERIMENTS, type Experiment } from "../physics/presets";
import {
  STORAGE_KEY,
  readLibrary,
  snapshot,
  validateExperiment,
  type SavedExperiment,
} from "./storage";
import SpaceView, { type VisualOptions } from "./SpaceView";
import BodyEditor from "./BodyEditor";
const number = (n: number | null, d = 2) =>
  n === null || !Number.isFinite(n)
    ? "—"
    : Math.abs(n) >= 1e7 || (Math.abs(n) > 0 && Math.abs(n) < 0.001)
      ? n.toExponential(2)
      : n.toLocaleString("ja-JP", { maximumFractionDigits: d });
const distance = (n: number | null) =>
  n === null
    ? "—"
    : Math.abs(n) >= AU * 0.01
      ? `${number(n / AU, 4)} AU`
      : `${number(n / 1000, 1)} km`;
const duration = (n: number | null) =>
  n === null
    ? "—"
    : n >= DAY * 365.25
      ? `${number(n / (DAY * 365.25))} 年`
      : n >= DAY
        ? `${number(n / DAY)} 日`
        : `${number(n / 3600)} 時間`;
const axisList = ["x", "y", "z"] as const;
export default function UniverseLab() {
  const start = EXPERIMENTS[0];
  const [world, setWorld] = useState<World>(() => cloneWorld(start.world)),
    current = useRef(world),
    initial = useRef(cloneWorld(start.world));
  const [experiment, setExperiment] = useState<Experiment>(start),
    [selected, setSelected] = useState("earth"),
    [primaryId, setPrimaryId] = useState("sun");
  const [running, setRunning] = useState(false),
    [rate, setRate] = useState(start.rate),
    [ceiling, setCeiling] = useState(start.step),
    [scale, setScale] = useState(start.scale);
  const [mode, setMode] = useState<"2d" | "3d">("3d"),
    [follow, setFollow] = useState(false),
    [viewKey, setViewKey] = useState(0),
    [editKey, setEditKey] = useState(0);
  const [options, setOptions] = useState<VisualOptions>({
    trails: true,
    velocity: false,
    gravity: false,
    plane: true,
    conic: true,
    grid: true,
    labels: true,
  });
  const [tab, setTab] = useState<"inspect" | "edit" | "library">("inspect"),
    [guide, setGuide] = useState(false),
    [message, setMessage] = useState(""),
    [stop, setStop] = useState(""),
    [limited, setLimited] = useState(false);
  const [library, setLibrary] = useState<SavedExperiment[]>([]),
    [saveName, setSaveName] = useState("私の軌道実験");
  const trails = useRef<Map<string, V3[]>>(new Map()),
    baseline = useRef(invariants(world)),
    angularScale = useRef(
      world.bodies.reduce((s, b) => s + b.mass * length(cross(b.r, b.v)), 0),
    );
  const baselineWorld = (w: World) => {
    baseline.current = invariants(w);
    angularScale.current = w.bodies.reduce(
      (s, b) => s + b.mass * length(cross(b.r, b.v)),
      0,
    );
  };
  const resetTrails = (w: World) => {
    trails.current = new Map(w.bodies.map((b) => [b.id, [{ ...b.r }]]));
  };
  useEffect(() => {
    resetTrails(current.current);
    try {
      setLibrary(readLibrary());
    } catch (e) {
      setMessage(
        `保存領域を利用できません：${(e as Error).message} JSON書き出しは利用できます。`,
      );
    }
  }, []);
  useEffect(() => {
    let frame = 0,
      previous = performance.now(),
      lastRender = 0,
      lastTrail = current.current.time;
    const tick = (now: number) => {
      const wall = Math.min((now - previous) / 1000, 0.08);
      previous = now;
      if (running) {
        const requested = wall * rate,
          result = advance(current.current, requested, ceiling);
        current.current = result.world;
        if (result.stop) {
          setRunning(false);
          setStop(result.stop);
        }
        if (now - lastRender > 50 || result.stop) {
          setWorld(result.world);
          setLimited(result.advanced < requested * 0.98 && !result.stop);
          lastRender = now;
        }
        if (current.current.time - lastTrail >= Math.max(ceiling, rate / 20)) {
          for (const b of current.current.bodies) {
            const path = trails.current.get(b.id) || [];
            path.push({ ...b.r });
            if (path.length > 1800) path.splice(0, path.length - 1800);
            trails.current.set(b.id, path);
          }
          lastTrail = current.current.time;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [running, rate, ceiling]);
  useEffect(() => {
    const visibility = () => {
      if (document.hidden) setRunning(false);
    };
    document.addEventListener("visibilitychange", visibility);
    return () => document.removeEventListener("visibilitychange", visibility);
  }, []);
  useEffect(() => {
    if (!guide) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setGuide(false);
        return;
      }
      if (event.key !== "Tab") return;
      const nodes = [
        ...document.querySelectorAll<HTMLElement>(
          ".guide-dialog button, .guide-dialog a[href]",
        ),
      ];
      const first = nodes[0],
        last = nodes.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", key);
      document.querySelector<HTMLButtonElement>(".guide-open")?.focus();
    };
  }, [guide]);
  const putWorld = (w: World) => {
    setRunning(false);
    setStop("");
    setLimited(false);
    current.current = w;
    setWorld(w);
    resetTrails(w);
    baselineWorld(w);
    setEditKey((k) => k + 1);
  };
  const loadPreset = (p: Experiment) => {
    setExperiment(p);
    putWorld(cloneWorld(p.world));
    initial.current = cloneWorld(p.world);
    setRate(p.rate);
    setCeiling(p.step);
    setScale(p.scale);
    setSelected(
      p.world.bodies.some((b) => b.id === "earth")
        ? "earth"
        : p.world.bodies.at(-1)!.id,
    );
    setPrimaryId(
      p.id === "assist"
        ? "jupiter"
        : [...p.world.bodies].sort((a, b) => b.mass - a.mass)[0].id,
    );
    setFollow(p.id === "assist");
    setViewKey((k) => k + 1);
    setMessage("");
    setTab("inspect");
  };
  const selectedBody =
    world.bodies.find((b) => b.id === selected) || world.bodies[0];
  const primary =
    world.bodies.find((b) => b.id === primaryId && b.id !== selectedBody.id) ||
    [...world.bodies]
      .filter((b) => b.id !== selectedBody.id)
      .sort((a, b) => b.mass - a.mass)[0];
  const orbital = primary ? relativeElements(selectedBody, primary) : null,
    inv = invariants(world),
    base = baseline.current;
  const energyDrift =
    base.energyScale > 0 ? (inv.energy - base.energy) / base.energyScale : null;
  const angularDrift =
    angularScale.current > 0
      ? length(sub(inv.angular, base.angular)) / angularScale.current
      : null;
  const applyBody = (b: Body) => {
    try {
      const next = {
        ...current.current,
        bodies: current.current.bodies.map((old) =>
          old.id === b.id ? b : old,
        ),
      };
      const safe = snapshot("validation", next, scale, ceiling, rate);
      putWorld(safe.world);
      setMessage("天体の変更を適用しました。保存量の比較基準を更新しました。");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const addBody = () => {
    if (current.current.bodies.length >= 24) {
      setMessage("天体は最大24個です。");
      return;
    }
    const anchor = current.current.bodies.find(
      (b) => b.id === selectedBody.id,
    )!;
    const offset = Math.max(anchor.radius * 8, scale * 0.04),
      speed = Math.sqrt((G * anchor.mass) / offset);
    const b: Body = {
      id: crypto.randomUUID(),
      name: "新しい天体",
      mass: 1000,
      radius: 100,
      color: "#86e9ce",
      r: add(anchor.r, vec(offset)),
      v: add(anchor.v, vec(0, speed)),
    };
    putWorld({ ...current.current, bodies: [...current.current.bodies, b] });
    setSelected(b.id);
    setPrimaryId(anchor.id);
    setTab("edit");
    setMessage(
      "選択天体の近くに追加しました。質量・位置・速度を編集できます。",
    );
  };
  const persist = (list: SavedExperiment[]) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
      setLibrary(list);
      return true;
    } catch {
      setMessage(
        "ブラウザへの保存に失敗しました。空き容量やプライベートモードを確認し、JSON書き出しをご利用ください。",
      );
      return false;
    }
  };
  const save = () => {
    try {
      if (library.length >= 12) {
        setMessage("保存は12件までです。不要な実験を削除してください。");
        return;
      }
      const s = snapshot(saveName, current.current, scale, ceiling, rate);
      if (persist([s, ...library]))
        setMessage("この時点の天体状態をブラウザに保存しました。");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const loadSaved = (s: SavedExperiment) => {
    try {
      const valid = validateExperiment(s);
      putWorld(cloneWorld(valid.world));
      initial.current = cloneWorld(valid.world);
      setScale(valid.scale);
      setCeiling(valid.step);
      setRate(valid.rate);
      setSelected(valid.world.bodies.at(-1)!.id);
      setPrimaryId(
        [...valid.world.bodies].sort((a, b) => b.mass - a.mass)[0].id,
      );
      setFollow(true);
      setViewKey((k) => k + 1);
      setExperiment({
        ...EXPERIMENTS[0],
        id: "custom",
        name: valid.name,
        label: "YOUR EXPERIMENT",
        description: "保存した状態から、探索を続けよう。",
        guide:
          "読み込んだ時点を初期状態として再開します。初期条件の出典は元の作成者に確認してください。",
        source:
          "ユーザーが保存・読み込みした状態。元のプリセットから編集されている場合があります。",
      });
      setMessage("実験を読み込みました。");
      setTab("inspect");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const exportJSON = () => {
    try {
      const s = snapshot(saveName, current.current, scale, ceiling, rate),
        url = URL.createObjectURL(
          new Blob([JSON.stringify(s, null, 2)], { type: "application/json" }),
        );
      const link = document.createElement("a");
      link.href = url;
      link.download = "gravity-lab-experiment.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("現在の実験をJSONに書き出しました。");
    } catch (e) {
      setMessage((e as Error).message);
    }
  };
  const chooseBody = (id: string) => {
    setSelected(id);
    setEditKey((k) => k + 1);
  };
  return (
    <div className="universe">
      <section className="lab-intro">
        <div>
          <div className="lab-kicker">
            AN OPEN LABORATORY FOR COSMIC CURIOSITY
          </div>
          <h1>軌道の、その先へ。</h1>
          <p>
            ひとつの重力から、無数の物語へ。宇宙を動かし、しくみを見つけよう。
          </p>
        </div>
        <button
          className="lab-button guide-open"
          onClick={() => setGuide(true)}
        >
          <BookOpen size={16} /> 探索ガイド
        </button>
      </section>
      <div className="preset-strip" aria-label="実験プリセット">
        {EXPERIMENTS.map((p, i) => (
          <button
            key={p.id}
            className={experiment.id === p.id ? "active" : ""}
            onClick={() => loadPreset(p)}
          >
            <span className={`preset-mini mini-${i}`}>
              {["✺", "◉", "☾", "∞", "☄", "≋", "↗"][i]}
            </span>
            <span>
              {p.name}
              <small>
                {
                  [
                    "8 PLANETS",
                    "CLOSE TO THE SUN",
                    "EARTH & MOON",
                    "BINARY STARS",
                    "INCLINED ORBIT",
                    "RESONANCE",
                    "GRAVITY ASSIST",
                  ][i]
                }
              </small>
            </span>
          </button>
        ))}
      </div>
      <div className="lab-layout">
        <div className="lab-main">
          <section className="space-panel">
            <div className="space-toolbar">
              <div className="experiment-heading">
                <i className={running ? "pulse" : ""} />
                <strong>{experiment.name}</strong>
                <span>{world.bodies.length} BODIES</span>
              </div>
              <div className="view-switch">
                <button
                  className={mode === "2d" ? "active" : ""}
                  onClick={() => setMode("2d")}
                >
                  2D
                </button>
                <button
                  className={mode === "3d" ? "active" : ""}
                  onClick={() => setMode("3d")}
                >
                  3D
                </button>
              </div>
              <button
                className={`lab-icon ${follow ? "active" : ""}`}
                title="選択天体を追跡"
                aria-label="選択天体を追跡"
                aria-pressed={follow}
                onClick={() => setFollow(!follow)}
              >
                <Crosshair size={16} />
              </button>
              <button
                className="lab-button compact"
                onClick={() => {
                  setFollow(false);
                  setViewKey((k) => k + 1);
                }}
              >
                重心へ
              </button>
              <button
                className="lab-button compact"
                onClick={() => {
                  setScale(
                    Math.max(
                      1e5,
                      Math.min(
                        1e15,
                        primary
                          ? length(sub(selectedBody.r, primary.r)) * 2
                          : scale,
                      ),
                    ),
                  );
                  setFollow(true);
                  setViewKey((k) => k + 1);
                }}
              >
                選択へ寄る
              </button>
            </div>
            <SpaceView
              world={world}
              trails={trails.current}
              selected={selectedBody.id}
              primary={primary?.id || ""}
              scale={scale}
              mode={mode}
              follow={follow}
              options={options}
              resetKey={viewKey}
              onSelect={chooseBody}
            />
            <div className="lab-transport">
              <button
                className="lab-primary run-button"
                disabled={!!stop}
                onClick={() => {
                  setRunning(!running);
                  if (running) {
                    setWorld(current.current);
                    setEditKey((k) => k + 1);
                  }
                }}
              >
                {running ? <Pause size={16} /> : <Play size={16} />}{" "}
                {running ? "一時停止" : "再生"}
              </button>
              <button
                className="lab-button"
                onClick={() => {
                  putWorld(cloneWorld(initial.current));
                  setMessage("実験の初期状態に戻しました。");
                }}
              >
                <RotateCcw size={15} /> リセット
              </button>
              <div className="lab-clock">
                <small>SIMULATION TIME</small>
                <strong>
                  {number(world.time / DAY, 3)} <span>days</span>
                </strong>
              </div>
              <label className="lab-speed">
                進行速度
                <select
                  aria-label="探索室の進行速度"
                  value={rate}
                  onChange={(e) => setRate(+e.target.value)}
                >
                  {[
                    ...new Set([
                      1,
                      60,
                      3600,
                      DAY * 0.3,
                      DAY,
                      DAY * 3,
                      DAY * 5,
                      DAY * 12,
                      DAY * 20,
                      DAY * 60,
                      rate,
                    ]),
                  ]
                    .sort((a, b) => a - b)
                    .map((v) => (
                      <option key={v} value={v}>
                        {v >= DAY
                          ? `${number(v / DAY)} 日 / 秒`
                          : v >= 3600
                            ? `${number(v / 3600)} 時間 / 秒`
                            : `${v} 秒 / 秒`}
                      </option>
                    ))}
                </select>
              </label>
            </div>
            <div className="visual-toggles">
              {(
                [
                  ["trails", "軌跡"],
                  ["conic", "接触軌道"],
                  ["plane", "軌道面"],
                  ["velocity", "速度"],
                  ["gravity", "重力"],
                  ["grid", "基準面"],
                  ["labels", "名前"],
                ] as const
              ).map(([key, label]) => (
                <label key={key}>
                  <input
                    type="checkbox"
                    checked={options[key]}
                    onChange={(e) =>
                      setOptions({ ...options, [key]: e.target.checked })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </section>
          {stop && (
            <div className="lab-alert" role="alert">
              <Activity size={16} />
              {stop} 編集またはリセットで再開できます。
            </div>
          )}
          {limited && (
            <div className="lab-alert warning">
              計算負荷のため進行速度を制限しています。精度を優先し、時間刻みは拡大していません。
            </div>
          )}
          <section className="lab-diagnostics">
            <div className="diagnostic-title">
              <Activity size={15} /> 保存量モニター{" "}
              <span>INTEGRATOR HEALTH</span>
            </div>
            <div className="diagnostic-grid">
              <div>
                <small>全エネルギー</small>
                <strong>
                  {number(inv.energy)} <span>J</span>
                </strong>
              </div>
              <div>
                <small>エネルギー変動 / 初期 K + |U|</small>
                <strong
                  className={
                    energyDrift !== null && Math.abs(energyDrift) > 1e-3
                      ? "warn-text"
                      : ""
                  }
                >
                  {energyDrift === null ? "—" : energyDrift.toExponential(2)}
                </strong>
              </div>
              <div>
                <small>角運動量変動 / 初期成分量</small>
                <strong>
                  {angularDrift === null ? "—" : angularDrift.toExponential(2)}
                </strong>
              </div>
              <div>
                <small>最大積分刻み</small>
                <strong>
                  {number(ceiling)} <span>s</span>
                </strong>
              </div>
            </div>
            <p>
              速度に応じて積分回数が増えます。近接時は刻みを短縮。天体編集・Δv適用・読み込み時に比較基準を更新。
            </p>
          </section>
          <section className="discovery-card">
            <div className="discovery-icon">
              <Orbit size={24} />
            </div>
            <div>
              <div className="lab-kicker">{experiment.label}</div>
              <h2>{experiment.description}</h2>
              <p>{experiment.guide}</p>
            </div>
          </section>
        </div>
        <aside className="lab-sidebar">
          <section className="lab-card body-list-card">
            <div className="lab-section-heading">
              <Globe2 size={15} /> 天体 <span>{world.bodies.length} / 24</span>
              <button
                className="lab-icon"
                aria-label="天体を追加"
                onClick={addBody}
              >
                <Plus size={17} />
              </button>
            </div>
            <div className="body-list">
              {world.bodies.map((b) => (
                <button
                  className={selectedBody.id === b.id ? "active" : ""}
                  key={b.id}
                  onClick={() => chooseBody(b.id)}
                >
                  <span
                    className="body-dot"
                    style={{
                      background: b.color,
                      boxShadow: `0 0 10px ${b.color}33`,
                    }}
                  />
                  <span>
                    {b.name}
                    <small>{number(b.mass)} kg</small>
                  </span>
                  <span className="body-speed">
                    {number(length(b.v) / 1000, 1)}
                    <small>km/s</small>
                  </span>
                </button>
              ))}
            </div>
          </section>
          <section className="lab-card inspector">
            <div className="inspector-tabs">
              <button
                className={tab === "inspect" ? "active" : ""}
                onClick={() => setTab("inspect")}
              >
                <Activity size={14} /> 測定
              </button>
              <button
                className={tab === "edit" ? "active" : ""}
                onClick={() => {
                  setRunning(false);
                  setWorld(current.current);
                  setEditKey((k) => k + 1);
                  setTab("edit");
                }}
              >
                <SlidersHorizontal size={14} /> 編集
              </button>
              <button
                className={tab === "library" ? "active" : ""}
                onClick={() => setTab("library")}
              >
                <Save size={14} /> 保存
              </button>
            </div>
            {tab === "inspect" && (
              <div className="inspect-content">
                <div className="selected-title">
                  <span
                    className="body-dot"
                    style={{ background: selectedBody.color }}
                  />
                  <h2>{selectedBody.name}</h2>
                  <span>LIVE</span>
                </div>
                <label className="reference-select">
                  軌道要素の基準天体
                  <select
                    aria-label="基準天体"
                    value={primary?.id || ""}
                    disabled={!primary}
                    onChange={(e) => setPrimaryId(e.target.value)}
                  >
                    {!primary && <option value="">基準天体なし</option>}
                    {world.bodies
                      .filter((b) => b.id !== selectedBody.id)
                      .map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name}
                        </option>
                      ))}
                  </select>
                </label>
                <div className="orbit-status">
                  {orbital
                    ? orbital.radial
                      ? "径方向軌道"
                      : !orbital.bound
                        ? "非束縛軌道"
                        : orbital.e < 0.001
                          ? "ほぼ円軌道"
                          : "束縛・楕円軌道"
                    : "軌道要素は未定義"}
                </div>
                <dl className="readouts">
                  {[
                    ["基準天体からの距離", distance(orbital?.radius ?? null)],
                    [
                      "相対速度",
                      orbital ? `${number(orbital.speed / 1000, 3)} km/s` : "—",
                    ],
                    ["近点距離", distance(orbital?.periapsis ?? null)],
                    ["遠点距離", distance(orbital?.apoapsis ?? null)],
                    ["離心率", number(orbital?.e ?? null, 5)],
                    [
                      "軌道傾斜角",
                      orbital?.inclination === null || !orbital
                        ? "—"
                        : `${number(orbital.inclination, 3)} °`,
                    ],
                    ["公転周期", duration(orbital?.period ?? null)],
                  ].map(([k, v]) => (
                    <div key={k}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
                </dl>
                <div className="coordinate-readout">
                  <small>慣性系位置 / AU</small>
                  <div>
                    {axisList.map((a) => (
                      <span key={a}>
                        {a.toUpperCase()}{" "}
                        <b>{number(selectedBody.r[a] / AU, 6)}</b>
                      </span>
                    ))}
                  </div>
                  <small>慣性系速度 / km/s</small>
                  <div>
                    {axisList.map((a) => (
                      <span key={a}>
                        {a.toUpperCase()}{" "}
                        <b>{number(selectedBody.v[a] / 1000, 4)}</b>
                      </span>
                    ))}
                  </div>
                </div>
                <p className="small-note">
                  破線・要素は選択した2天体間の瞬間接触軌道（osculating
                  orbit）。薄い実線は支配的な重力源まわりの他天体の接触軌道。将来の摂動を含みません。距離は中心間、傾斜角はXY面基準。非束縛の遠点・周期は「—」。
                </p>
                <button
                  className="lab-button wide"
                  onClick={() => {
                    setRunning(false);
                    setWorld(current.current);
                    setEditKey((k) => k + 1);
                    setTab("edit");
                  }}
                >
                  この天体を編集 <SlidersHorizontal size={13} />
                </button>
              </div>
            )}
            {tab === "edit" && (
              <BodyEditor
                key={`${selectedBody.id}-${editKey}`}
                body={selectedBody}
                onApply={applyBody}
                onDelete={() => {
                  if (current.current.bodies.length <= 1) {
                    setMessage("最後の1天体は削除できません。");
                    return;
                  }
                  const bodies = current.current.bodies.filter(
                    (b) => b.id !== selectedBody.id,
                  );
                  putWorld({ ...current.current, bodies });
                  setSelected(bodies[0].id);
                  setMessage("天体を削除しました。");
                }}
                onImpulse={(dv) => {
                  const b = current.current.bodies.find(
                    (b) => b.id === selectedBody.id,
                  )!;
                  applyBody({ ...b, v: add(b.v, dv) });
                }}
              />
            )}
            {tab === "library" && (
              <div className="library">
                <p className="small-note">
                  現在の天体状態・経過時間・計算設定を保存します。カメラと過去の軌跡は含みません。
                </p>
                <label className="save-name">
                  実験の名前
                  <input
                    aria-label="実験の名前"
                    value={saveName}
                    maxLength={80}
                    onChange={(e) => setSaveName(e.target.value)}
                  />
                </label>
                <button className="lab-primary wide" onClick={save}>
                  <Save size={14} /> ブラウザに保存
                </button>
                <div className="file-actions">
                  <button className="lab-button" onClick={exportJSON}>
                    <Download size={14} /> JSON書き出し
                  </button>
                  <label className="lab-button import-label">
                    <ArrowUpFromLine size={14} /> 読み込み
                    <input
                      aria-label="実験JSONを読み込む"
                      type="file"
                      accept=".json,application/json"
                      onChange={async (e) => {
                        const f = e.target.files?.[0];
                        e.target.value = "";
                        if (!f) return;
                        try {
                          if (f.size > 256000)
                            throw Error("ファイルは256 KB以下にしてください。");
                          loadSaved(
                            validateExperiment(JSON.parse(await f.text())),
                          );
                        } catch (err) {
                          setMessage(`読み込み失敗：${(err as Error).message}`);
                        }
                      }}
                    />
                  </label>
                </div>
                <h3>
                  保存した実験 <span>{library.length} / 12</span>
                </h3>
                {library.length === 0 ? (
                  <div className="library-empty">
                    <Save size={25} />
                    <p>まだ、白紙の研究ノート。</p>
                    <small>実験を保存して、いつでも続きを。</small>
                  </div>
                ) : (
                  library.map((s) => (
                    <div className="saved-item" key={s.id}>
                      <div>
                        <strong>{s.name}</strong>
                        <small>
                          {s.world.bodies.length}天体 ·{" "}
                          {new Date(s.savedAt).toLocaleDateString("ja-JP")}
                        </small>
                      </div>
                      <button
                        className="lab-icon"
                        aria-label={`${s.name}を読み込む`}
                        onClick={() => loadSaved(s)}
                      >
                        <ArrowDownToLine size={15} />
                      </button>
                      <button
                        className="lab-icon"
                        aria-label={`${s.name}を削除`}
                        onClick={() =>
                          persist(library.filter((x) => x.id !== s.id))
                        }
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))
                )}
                <button
                  className="lab-button wide checkpoint"
                  onClick={() => {
                    initial.current = cloneWorld(current.current);
                    setMessage("現在の状態をリセット先に設定しました。");
                  }}
                >
                  現在をリセット先にする
                </button>
              </div>
            )}
          </section>
          <details className="lab-card accuracy">
            <summary>
              <Layers3 size={14} /> 計算精度とモデル
            </summary>
            <label>
              最大積分刻み（秒）
              <input
                aria-label="最大積分刻み"
                type="number"
                min="0.001"
                max="86400"
                step="any"
                value={ceiling}
                onChange={(e) => {
                  const n = e.target.valueAsNumber;
                  if (Number.isFinite(n) && n >= 0.001 && n <= 86400)
                    setCeiling(n);
                }}
              />
            </label>
            <p>
              ニュートンの相互重力 / 3D Velocity Verlet / 近接時の刻み短縮 /
              球の接触で停止。軟化・大気抵抗・相対論・潮汐は含みません。天体の表示サイズと矢印長は見やすさのため拡大・正規化しています。質量0の天体は重力源になりません。
            </p>
          </details>
        </aside>
      </div>
      <div className="lab-source">
        <span>INITIAL CONDITIONS</span>
        <p>{experiment.source}</p>
        <a
          href="https://ssd.jpl.nasa.gov/planets/approx_pos.html"
          target="_blank"
          rel="noreferrer"
        >
          JPL 軌道要素 ↗
        </a>
      </div>
      <footer className="lab-footer">
        <span>
          GRAVITY LAB <b>EXPLORER EDITION</b>
        </span>
        <span>ローカル計算 · アカウント不要 · あなたのブラウザが実験室</span>
      </footer>
      {message && (
        <div className="lab-toast" role="status">
          <span>{message}</span>
          <button aria-label="通知を閉じる" onClick={() => setMessage("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {guide && (
        <div className="guide-backdrop" onClick={() => setGuide(false)}>
          <section
            className="guide-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="lab-icon guide-close"
              aria-label="ガイドを閉じる"
              autoFocus
              onClick={() => setGuide(false)}
            >
              <X size={20} />
            </button>
            <div className="lab-kicker">A FIELD GUIDE TO GRAVITY</div>
            <h2 id="guide-title">好奇心から、はじめよう。</h2>
            <p>
              正解を入力する必要はありません。ひとつ変えて、動きを見る。それがこの実験室の使い方です。
            </p>
            <ol>
              <li>
                <strong>舞台を選ぶ</strong>
                <p>
                  太陽系、連星、彗星、共鳴。上のプリセットから気になる現象へ。
                </p>
              </li>
              <li>
                <strong>動かして、視点を変える</strong>
                <p>
                  再生し、3Dで回転。天体を選んで「選択へ寄る」と近づけます。2DではXY平面に投影します。
                </p>
              </li>
              <li>
                <strong>ひとつだけ、変える</strong>
                <p>
                  編集タブで速度のZ成分を増やすと、軌道面はどうなるでしょう？
                  Δvで軌道を変え、保存量の変化も比べましょう。
                </p>
              </li>
              <li>
                <strong>気づきを持ち帰る</strong>
                <p>
                  保存タブで実験を保存。JSONなら別のブラウザでも続きを再現できます。プリセット選択やリセットは現在の状態を置き換えるため、先に保存してください。
                </p>
              </li>
            </ol>
            <div className="guide-caution">
              接触軌道の破線は、二体近似での「今の軌道」。N体の未来の道筋ではありません。太陽系の時刻はJ2000基準の近似、その他は教育用の合成条件です。
            </div>
            <button
              className="lab-primary wide"
              onClick={() => setGuide(false)}
            >
              探索をはじめる <Orbit size={16} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
