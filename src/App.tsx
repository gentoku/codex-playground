import { lazy, Suspense, useState } from "react";
import { Orbit, Globe2, Telescope } from "lucide-react";
import EarthLab from "./EarthLab";
import "./lab/lab.css";
const UniverseLab = lazy(() => import("./lab/UniverseLab"));
export default function App() {
  const [workspace, setWorkspace] = useState<"universe" | "earth">("universe");
  return (
    <>
      <nav className="workspace-nav" aria-label="実験室の切り替え">
        <a
          className="workspace-brand"
          href="#"
          onClick={(e) => e.preventDefault()}
        >
          <span>
            <Orbit size={24} />
          </span>
          <div>
            Gravity Lab<small>THE INTERACTIVE GRAVITY EXPLORER</small>
          </div>
        </a>
        <div className="workspace-tabs">
          <button
            aria-pressed={workspace === "universe"}
            className={workspace === "universe" ? "active" : ""}
            onClick={() => setWorkspace("universe")}
          >
            <Telescope size={16} /> 宇宙探索室 <small>N-BODY / 3D</small>
          </button>
          <button
            aria-pressed={workspace === "earth"}
            className={workspace === "earth" ? "active" : ""}
            onClick={() => setWorkspace("earth")}
          >
            <Globe2 size={16} /> 地球周回ラボ <small>CLASSIC / 2D</small>
          </button>
        </div>
        <span className="workspace-edition">
          EXPLORER EDITION <i />
        </span>
      </nav>
      {workspace === "universe" ? (
        <Suspense
          fallback={
            <div className="lab-loading">宇宙探索室を準備しています…</div>
          }
        >
          <UniverseLab />
        </Suspense>
      ) : (
        <EarthLab />
      )}
    </>
  );
}
