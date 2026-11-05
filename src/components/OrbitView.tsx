import { useEffect, useRef, useState } from 'react';
import { R, norm, prediction, type State, type Vec } from '../physics/orbit';
type Props = { state: State; trail: Vec[]; showPrediction: boolean; showTrail: boolean; showVector: boolean; editable: boolean; onVelocity: (speed: number, angle: number) => void };
export default function OrbitView(p: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [camera, setCamera] = useState({ zoom: 1, x: 0, y: 0 });
  const drag = useRef<{ mode: 'pan' | 'velocity'; x: number; y: number } | null>(null);
  const transform = useRef({ scale: 1, cx: 0, cy: 0 });
  useEffect(() => {
    const c = canvas.current!;
    const draw = () => {
      const { width: w, height: h } = c.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1; c.width = w * dpr; c.height = h * dpr;
      const ctx = c.getContext('2d')!; ctx.scale(dpr, dpr);
      const scale = Math.min(w, h) / (R * 5.2) * camera.zoom;
      const cx = w / 2 + camera.x, cy = h / 2 + camera.y;
      transform.current = { scale, cx, cy };
      const point = (v: Vec) => ({ x: cx + v.x * scale, y: cy - v.y * scale });
      ctx.fillStyle = '#090f1b'; ctx.fillRect(0, 0, w, h);
      // Deterministic star field.
      for (let i = 0; i < 100; i++) { ctx.fillStyle = `rgba(170,195,226,${0.12 + (i % 4) * 0.07})`; ctx.fillRect((i * 173.31) % w, (i * 97.73) % h, 1, 1); }
      const grid = R * scale;
      ctx.strokeStyle = '#162131'; ctx.lineWidth = 0.6;
      if (grid > 12) { for (let x = cx % grid; x < w; x += grid) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); } for (let y = cy % grid; y < h; y += grid) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); } }
      const line = (path: Vec[], color: string, dashed = false) => { ctx.beginPath(); ctx.strokeStyle = color; ctx.lineWidth = 1.5; ctx.setLineDash(dashed ? [5, 6] : []); path.forEach((v, i) => { const q = point(v); i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); }); ctx.stroke(); ctx.setLineDash([]); };
      if (p.showPrediction) prediction(p.state).forEach(path => line(path, '#7285b0', true));
      if (p.showTrail) line(p.trail, '#48dec0');
      const er = R * scale;
      const glow = ctx.createRadialGradient(cx, cy, er * .9, cx, cy, er * 1.16); glow.addColorStop(0, '#318bd633'); glow.addColorStop(1, '#318bd600'); ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(cx, cy, er * 1.16, 0, Math.PI * 2); ctx.fill();
      const earth = ctx.createRadialGradient(cx - er * .4, cy - er * .5, 0, cx + er * .3, cy + er * .3, er * 1.5); earth.addColorStop(0, '#328bab'); earth.addColorStop(.5, '#155274'); earth.addColorStop(1, '#071a30'); ctx.fillStyle = earth; ctx.beginPath(); ctx.arc(cx, cy, er, 0, Math.PI * 2); ctx.fill();
      ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, er, 0, Math.PI * 2); ctx.clip(); ctx.strokeStyle = '#79c8ce28'; ctx.lineWidth = 1;
      for (let k = -2; k <= 2; k++) { ctx.beginPath(); ctx.ellipse(cx, cy, er * Math.cos(k * .4), er, .25, 0, Math.PI * 2); ctx.stroke(); ctx.beginPath(); ctx.ellipse(cx, cy + k * er * .32, er, er * .16, .1, 0, Math.PI * 2); ctx.stroke(); }
      ctx.restore(); ctx.strokeStyle = '#65c5e26b'; ctx.beginPath(); ctx.arc(cx, cy, er, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#a1c6d4'; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText('E A R T H', cx, cy - 2); ctx.fillStyle = '#6b97ad'; ctx.fillText('6,371 km', cx, cy + 15);
      const sat = point(p.state.r);
      if (p.showVector && !p.state.collided) {
        const end = { x: sat.x + p.state.v.x / 100, y: sat.y - p.state.v.y / 100 };
        ctx.strokeStyle = '#f8bf68'; ctx.fillStyle = '#f8bf68'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(sat.x, sat.y); ctx.lineTo(end.x, end.y); ctx.stroke();
        const a = Math.atan2(end.y - sat.y, end.x - sat.x); ctx.beginPath(); ctx.moveTo(end.x, end.y); ctx.lineTo(end.x - 10 * Math.cos(a - .4), end.y - 10 * Math.sin(a - .4)); ctx.lineTo(end.x - 10 * Math.cos(a + .4), end.y - 10 * Math.sin(a + .4)); ctx.fill();
      }
      ctx.shadowColor = '#58ecd1'; ctx.shadowBlur = 15; ctx.fillStyle = p.state.collided ? '#ff8a80' : '#67f1d3'; ctx.beginPath(); ctx.arc(sat.x, sat.y, 5, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.textAlign = 'left'; ctx.font = '10px monospace'; ctx.fillStyle = '#b9d0de'; ctx.fillText('SAT–01', sat.x + 13, sat.y + 3);
      ctx.fillStyle = '#62768b'; ctx.fillText(`${(R / 1000).toFixed(0)} km / grid`, 20, h - 24);
    };
    draw(); const observer = new ResizeObserver(draw); observer.observe(c); return () => observer.disconnect();
  }, [p, camera]);
  const local = (e: React.PointerEvent) => { const b = e.currentTarget.getBoundingClientRect(); return { x: e.clientX - b.left, y: e.clientY - b.top }; };
  return <div className="viewport"><canvas ref={canvas} aria-label="地球と人工衛星の軌道。衛星付近からドラッグして速度を設定、背景をドラッグして移動" onWheel={e => setCamera(c => ({ ...c, zoom: Math.max(.08, Math.min(12, c.zoom * Math.exp(-e.deltaY * .001))) }))} onPointerDown={e => { const q = local(e), t = transform.current; const sx = t.cx + p.state.r.x * t.scale, sy = t.cy - p.state.r.y * t.scale; const ex = sx + p.state.v.x / 100, ey = sy - p.state.v.y / 100; const hit = Math.hypot(q.x - sx, q.y - sy) < 24 || Math.hypot(q.x - ex, q.y - ey) < 24; drag.current = { mode: p.editable && hit ? 'velocity' : 'pan', ...q }; e.currentTarget.setPointerCapture(e.pointerId); }} onPointerMove={e => { if (!drag.current) return; const q = local(e); if (drag.current.mode === 'pan') { const dx = q.x - drag.current.x, dy = q.y - drag.current.y; setCamera(c => ({ ...c, x: c.x + dx, y: c.y + dy })); } else { const t = transform.current, dx = q.x - (t.cx + p.state.r.x * t.scale), dy = -(q.y - (t.cy - p.state.r.y * t.scale)); p.onVelocity(Math.min(16, Math.hypot(dx, dy) / 10), (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360); } drag.current = { ...drag.current, ...q }; }} onPointerUp={() => drag.current = null} onPointerCancel={() => drag.current = null}/><div className="view-label"><span className="live-dot"/> GEOCENTRIC VIEW <span>2D · SI MODEL</span></div><div className="camera-controls"><button aria-label="ズームイン" onClick={() => setCamera(c => ({ ...c, zoom: Math.min(12, c.zoom * 1.3) }))}>＋</button><button aria-label="ズームアウト" onClick={() => setCamera(c => ({ ...c, zoom: Math.max(.08, c.zoom / 1.3) }))}>−</button><button onClick={() => setCamera({ zoom: 1, x: 0, y: 0 })}>中心へ</button></div><div className="view-hint">{p.editable ? '衛星・矢印をドラッグして初速度を設定' : '初速度の編集はリセット後に可能'} <span>· スクロールでズーム · 背景ドラッグで移動</span></div></div>;
}
