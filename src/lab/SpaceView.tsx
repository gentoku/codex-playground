import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import {
  AU,
  accelerations,
  length,
  mul,
  osculatingPath,
  relativeElements,
  type V3,
  type World,
} from "../physics/nbody";
export type VisualOptions = {
  trails: boolean;
  velocity: boolean;
  gravity: boolean;
  plane: boolean;
  conic: boolean;
  grid: boolean;
  labels: boolean;
};
type Props = {
  world: World;
  trails: Map<string, V3[]>;
  selected: string;
  primary: string;
  scale: number;
  mode: "2d" | "3d";
  follow: boolean;
  options: VisualOptions;
  resetKey: number;
  onSelect: (id: string) => void;
};
const tv = (v: V3, scale: number) =>
  new THREE.Vector3(v.x / scale, v.y / scale, v.z / scale);
export default function SpaceView(props: Props) {
  const host = useRef<HTMLDivElement>(null),
    latest = useRef(props);
  latest.current = props;
  const [failure, setFailure] = useState("");
  const controlsApi = useRef<{ zoom: (f: number) => void } | null>(null);
  useEffect(() => {
    const element = host.current!;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    } catch {
      setFailure(
        "WebGL 2を開始できません。ブラウザのハードウェアアクセラレーションを有効にするか、「地球周回ラボ」の2D Canvas表示をお使いください。",
      );
      return;
    }
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setClearColor("#080d17");
    renderer.domElement.setAttribute(
      "aria-label",
      "相互重力の3D表示。ドラッグで回転、右ドラッグで移動、ホイールでズーム。天体をクリックして選択",
    );
    element.appendChild(renderer.domElement);
    const compass = document.createElement("canvas");
    compass.width = 160;
    compass.height = 160;
    compass.className = "space-compass";
    compass.setAttribute("aria-label", "現在のカメラから見たXYZ軸の方向");
    element.appendChild(compass);
    const compassCtx = compass.getContext("2d")!;
    const scene = new THREE.Scene(),
      camera = new THREE.PerspectiveCamera(42, 1, 0.00001, 100000);
    camera.up.set(0, props.mode === "2d" ? 1 : 0, props.mode === "2d" ? 0 : 1);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.12;
    controls.minDistance = 0.001;
    controls.maxDistance = 20000;
    const worldGroup = new THREE.Group();
    scene.add(worldGroup);
    scene.add(new THREE.AmbientLight("#aec1db", 2.2));
    const light = new THREE.DirectionalLight("#fff5dc", 2.5);
    light.position.set(-2, -3, 5);
    scene.add(light);
    const grid = new THREE.GridHelper(12, 24, "#304051", "#172333");
    grid.rotation.x = Math.PI / 2;
    grid.scale.setScalar(0.35);
    scene.add(grid);
    const starsGeo = new THREE.BufferGeometry(),
      positions = [];
    for (let i = 0; i < 1800; i++) {
      const z = 2 * ((i * 0.61803398875) % 1) - 1,
        a = i * 2.3999632,
        r = 90;
      positions.push(
        r * Math.sqrt(1 - z * z) * Math.cos(a),
        r * Math.sqrt(1 - z * z) * Math.sin(a),
        r * z,
      );
    }
    starsGeo.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(positions, 3),
    );
    const starMat = new THREE.PointsMaterial({
      color: "#9fb5d0",
      size: 0.35,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.55,
    });
    const stars = new THREE.Points(starsGeo, starMat);
    scene.add(stars);
    const meshMap = new Map<
      string,
      {
        mesh: THREE.Mesh;
        ring: THREE.Mesh;
        trail: THREE.Line;
        reference: THREE.Line;
        label: HTMLButtonElement;
        velocity: THREE.ArrowHelper;
        gravity: THREE.ArrowHelper;
      }
    >();
    const sphere = new THREE.SphereGeometry(1, 24, 16),
      ringGeo = new THREE.RingGeometry(1.5, 1.6, 48);
    const conicGeo = new THREE.BufferGeometry();
    const conicMat = new THREE.LineDashedMaterial({
      color: "#b6a7ed",
      dashSize: 0.024,
      gapSize: 0.018,
      transparent: true,
      opacity: 0.65,
    });
    const conic = new THREE.Line(conicGeo, conicMat);
    worldGroup.add(conic);
    const planeGeo = new THREE.CircleGeometry(1, 80),
      planeMat = new THREE.MeshBasicMaterial({
        color: "#7789d7",
        transparent: true,
        opacity: 0.045,
        side: THREE.DoubleSide,
        depthWrite: false,
      });
    const plane = new THREE.Mesh(planeGeo, planeMat);
    worldGroup.add(plane);
    let frame = 0,
      disposed = false,
      previousFollow: THREE.Vector3 | null = null;
    const resetCamera = () => {
      camera.position.set(
        0,
        props.mode === "2d" ? 0 : -1.55,
        props.mode === "2d" ? 2.8 : 2,
      );
      controls.target.set(0, 0, 0);
      controls.enableRotate = props.mode === "3d";
      controls.mouseButtons.LEFT =
        props.mode === "2d" ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE;
      controls.update();
      previousFollow = null;
    };
    resetCamera();
    controlsApi.current = {
      zoom: (f) => {
        camera.position
          .sub(controls.target)
          .multiplyScalar(f)
          .add(controls.target);
        controls.update();
      },
    };
    const observer = new ResizeObserver(() => {
      const { width, height } = element.getBoundingClientRect();
      camera.aspect = width / Math.max(1, height);
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    });
    observer.observe(element);
    const raycaster = new THREE.Raycaster();
    let down = { x: 0, y: 0 };
    const pointerDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const pointerUp = (e: PointerEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return;
      const b = renderer.domElement.getBoundingClientRect();
      raycaster.setFromCamera(
        new THREE.Vector2(
          ((e.clientX - b.left) / b.width) * 2 - 1,
          (-(e.clientY - b.top) / b.height) * 2 + 1,
        ),
        camera,
      );
      const hit = raycaster.intersectObjects(
        [...meshMap.values()].map((x) => x.mesh),
      )[0];
      if (hit) latest.current.onSelect(hit.object.userData.id);
    };
    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    const remove = (id: string) => {
      const m = meshMap.get(id)!;
      worldGroup.remove(
        m.mesh,
        m.ring,
        m.trail,
        m.reference,
        m.velocity,
        m.gravity,
      );
      (m.mesh.material as THREE.Material).dispose();
      (m.ring.material as THREE.Material).dispose();
      m.trail.geometry.dispose();
      (m.trail.material as THREE.Material).dispose();
      m.reference.geometry.dispose();
      (m.reference.material as THREE.Material).dispose();
      m.velocity.dispose();
      m.gravity.dispose();
      m.label.remove();
      meshMap.delete(id);
    };
    const render = () => {
      if (disposed) return;
      const p = latest.current,
        scale = p.scale;
      const ids = new Set(p.world.bodies.map((b) => b.id));
      for (const id of meshMap.keys()) if (!ids.has(id)) remove(id);
      const selected = p.world.bodies.find((b) => b.id === p.selected),
        primary = p.world.bodies.find((b) => b.id === p.primary);
      if (p.follow && selected) {
        const target = tv(selected.r, scale);
        if (previousFollow)
          camera.position.add(target.clone().sub(previousFollow));
        else camera.position.add(target.clone().sub(controls.target));
        controls.target.copy(target);
        previousFollow = target.clone();
      } else previousFollow = null;
      controls.update();
      grid.visible = p.options.grid;
      // Scale glyphs in screen space. Physical radii remain unscaled in dynamics.
      const acc = p.options.gravity ? accelerations(p.world.bodies) : [];
      p.world.bodies.forEach((b, index) => {
        let m = meshMap.get(b.id);
        if (!m) {
          const mesh = new THREE.Mesh(
            sphere,
            new THREE.MeshStandardMaterial({
              color: b.color,
              roughness: 0.8,
              emissive: b.color,
              emissiveIntensity: b.mass > 1e29 ? 0.65 : 0.06,
            }),
          );
          mesh.userData.id = b.id;
          const ring = new THREE.Mesh(
            ringGeo,
            new THREE.MeshBasicMaterial({
              color: "#8de5d0",
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.85,
              depthTest: false,
            }),
          );
          const trail = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({
              color: b.color,
              transparent: true,
              opacity: 0.65,
            }),
          );
          const reference = new THREE.Line(
            new THREE.BufferGeometry(),
            new THREE.LineBasicMaterial({
              color: b.color,
              transparent: true,
              opacity: 0.15,
            }),
          );
          const velocity = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(),
            0.1,
            "#f2c87f",
            0.025,
            0.012,
          );
          const gravity = new THREE.ArrowHelper(
            new THREE.Vector3(0, 1, 0),
            new THREE.Vector3(),
            0.1,
            "#b8a5ed",
            0.025,
            0.012,
          );
          const label = document.createElement("button");
          label.className = "body-label";
          label.textContent = b.name;
          label.setAttribute("aria-label", `表示天体 ${b.name} を選択`);
          label.onclick = () => latest.current.onSelect(b.id);
          element.appendChild(label);
          m = { mesh, ring, trail, reference, label, velocity, gravity };
          meshMap.set(b.id, m);
          worldGroup.add(mesh, ring, trail, reference, velocity, gravity);
        }
        const position = tv(b.r, scale);
        m.mesh.position.copy(position);
        const distance = camera.position.distanceTo(position),
          glyph = Math.max(
            b.radius / scale,
            distance * (b.mass > 1e29 ? 0.013 : 0.0055),
          );
        m.mesh.scale.setScalar(glyph);
        (m.mesh.material as THREE.MeshStandardMaterial).color.set(b.color);
        m.ring.position.copy(position);
        m.ring.scale.setScalar(glyph);
        m.ring.quaternion.copy(camera.quaternion);
        m.ring.visible = b.id === p.selected;
        m.trail.visible = p.options.trails;
        if (p.options.trails) {
          const pts = p.trails.get(b.id) || [];
          if (
            m.trail.userData.path !== pts ||
            m.trail.userData.points !== pts.length ||
            m.trail.userData.time !== p.world.time
          ) {
            m.trail.geometry.dispose();
            m.trail.geometry = new THREE.BufferGeometry().setFromPoints(
              pts.map((v) => tv(v, scale)),
            );
            m.trail.userData.path = pts;
            m.trail.userData.points = pts.length;
            m.trail.userData.time = p.world.time;
          }
        }
        m.reference.visible =
          p.options.conic &&
          !!primary &&
          b.id !== primary.id &&
          b.id !== p.selected &&
          primary.mass >
            p.world.bodies
              .filter((x) => x.id !== primary.id)
              .reduce((sum, x) => sum + x.mass, 0) *
              10;
        if (
          m.reference.visible &&
          (m.reference.userData.world !== p.world ||
            m.reference.userData.primary !== primary!.id)
        ) {
          m.reference.geometry.dispose();
          m.reference.geometry = new THREE.BufferGeometry().setFromPoints(
            osculatingPath(b, primary!).map((v) => tv(v, scale)),
          );
          m.reference.userData.world = p.world;
          m.reference.userData.primary = primary!.id;
        }
        const arrow = (helper: THREE.ArrowHelper, v: V3, enabled: boolean) => {
          helper.visible = enabled && length(v) > 0;
          if (helper.visible) {
            helper.position.copy(position);
            helper.setDirection(tv(mul(v, 1 / length(v)), 1));
            const size = distance * 0.075;
            helper.setLength(size, size * 0.22, size * 0.1);
          }
        };
        arrow(m.velocity, b.v, p.options.velocity);
        arrow(m.gravity, acc[index] || { x: 0, y: 0, z: 0 }, p.options.gravity);
      });
      // Prioritize the selected body; place other labels without covering one another.
      const occupied: { x: number; y: number; w: number; h: number }[] = [];
      const labelOrder = [...p.world.bodies].sort((a, b) =>
        a.id === p.selected ? -1 : b.id === p.selected ? 1 : b.mass - a.mass,
      );
      labelOrder.forEach((b) => {
        const m = meshMap.get(b.id)!;
        const projected = tv(b.r, scale).project(camera),
          visible =
            projected.z >= -1 &&
            projected.z <= 1 &&
            Math.abs(projected.x) < 1 &&
            Math.abs(projected.y) < 1;
        m.label.style.display = "none";
        m.label.classList.toggle("active", b.id === p.selected);
        if (!p.options.labels || !visible) return;
        const px = ((projected.x + 1) * element.clientWidth) / 2,
          py = ((-projected.y + 1) * element.clientHeight) / 2,
          w = Math.max(40, b.name.length * 11 + 14);
        for (const [dx, dy] of [
          [12, -8],
          [12, 14],
          [-w - 12, -8],
          [-w - 12, 14],
        ]) {
          const q = { x: px + dx, y: py + dy, w, h: 18 };
          if (
            q.x < 0 ||
            q.x + w > element.clientWidth ||
            q.y < 30 ||
            q.y + 18 > element.clientHeight - 25
          )
            continue;
          if (
            occupied.some(
              (o) =>
                q.x < o.x + o.w + 4 &&
                q.x + q.w + 4 > o.x &&
                q.y < o.y + o.h + 3 &&
                q.y + q.h + 3 > o.y,
            )
          )
            continue;
          occupied.push(q);
          m.label.style.left = `${q.x}px`;
          m.label.style.top = `${q.y + 9}px`;
          m.label.style.display = "block";
          break;
        }
      });
      conic.visible =
        p.options.conic && !!selected && !!primary && selected !== primary;
      plane.visible =
        p.options.plane && !!selected && !!primary && selected !== primary;
      if (selected && primary && selected !== primary) {
        if (conic.visible) {
          conic.geometry.dispose();
          conic.geometry = new THREE.BufferGeometry().setFromPoints(
            osculatingPath(selected, primary).map((v) => tv(v, scale)),
          );
          conic.computeLineDistances();
        }
        if (plane.visible) {
          const o = relativeElements(selected, primary);
          if (o && !o.radial) {
            plane.position.copy(tv(primary.r, scale));
            plane.quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 0, 1),
              tv(o.normal, 1),
            );
            plane.scale.setScalar(
              Math.min(10, Math.max(o.radius * 1.3, o.a || 0) / scale),
            );
          } else plane.visible = false;
        }
      }
      compassCtx.clearRect(0, 0, 160, 160);
      const inverse = camera.quaternion.clone().invert();
      [
        [new THREE.Vector3(1, 0, 0), "#e0a68c", "X"],
        [new THREE.Vector3(0, 1, 0), "#8bceac", "Y"],
        [new THREE.Vector3(0, 0, 1), "#8baedb", "Z"],
      ].forEach(([axis, color, label]) => {
        const d = (axis as THREE.Vector3).clone().applyQuaternion(inverse);
        compassCtx.strokeStyle = color as string;
        compassCtx.fillStyle = color as string;
        compassCtx.lineWidth = 2;
        compassCtx.beginPath();
        compassCtx.moveTo(68, 88);
        compassCtx.lineTo(68 + d.x * 40, 88 - d.y * 40);
        compassCtx.stroke();
        compassCtx.font = "15px monospace";
        compassCtx.fillText(label as string, 63 + d.x * 55, 93 - d.y * 55);
      });
      renderer.render(scene, camera);
      frame = requestAnimationFrame(render);
    };
    render();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      controls.dispose();
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      for (const id of [...meshMap.keys()]) remove(id);
      sphere.dispose();
      ringGeo.dispose();
      conic.geometry.dispose();
      conicMat.dispose();
      planeGeo.dispose();
      planeMat.dispose();
      starsGeo.dispose();
      starMat.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      compass.remove();
      controlsApi.current = null;
    };
  }, [props.mode, props.resetKey, props.scale]);
  return (
    <div className="space-shell">
      <div className="space-canvas" ref={host} />
      {failure && (
        <div className="webgl-failure" role="alert">
          {failure}
        </div>
      )}
      <div className="space-badge">
        <i />
        {props.mode === "3d" ? "3D INERTIAL SPACE" : "2D · XY PROJECTION"}
        <span>初期重心の慣性系</span>
      </div>
      <div className="space-scale">
        1 GRID ={" "}
        {props.scale * 0.175 >= AU * 0.01
          ? `${((props.scale * 0.175) / AU).toPrecision(3)} AU`
          : `${((props.scale * 0.175) / 1000).toPrecision(3)} km`}
      </div>
      <div className="space-tools">
        <button
          aria-label="探索室ズームイン"
          onClick={() => controlsApi.current?.zoom(0.75)}
        >
          ＋
        </button>
        <button
          aria-label="探索室ズームアウト"
          onClick={() => controlsApi.current?.zoom(1.3)}
        >
          −
        </button>
      </div>
      <div className="space-caption">
        {props.mode === "3d"
          ? "ドラッグ：回転 · 右ドラッグ：移動"
          : "ドラッグ：移動"}{" "}
        · スクロール：ズーム · 天体クリック：選択
      </div>
    </div>
  );
}
