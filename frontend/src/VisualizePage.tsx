import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { InputKind, RunState } from "./HomePage";

// Backend address (your FastAPI CORS already allows http://localhost:5173)
const API = "https://algo-visualizer-ef6l.vercel.app/";

/* ------------------------------------------------------------------ */
/* Types that mirror your FastAPI models                               */
/* ------------------------------------------------------------------ */

interface BestPair { i: number; j: number; dist: number }

type CPStep =
  | { type: "divide"; depth: number; description: string; lo: number; hi: number; mid: number; midX: number }
  | { type: "base"; depth: number; description: string; lo: number; hi: number; best: BestPair }
  | { type: "strip"; depth: number; description: string; lo: number; hi: number; midX: number; d: number; strip: number[]; checked: [number, number, number][] }
  | { type: "merge"; depth: number; description: string; lo: number; hi: number; best: BestPair };

interface CPResponse {
  n: number;
  points: { x: number; y: number }[];
  best: BestPair;
  runtime_ms: number;
  brute_force_ms: number | null;
  truncated: boolean;
  steps: CPStep[];
}

interface KStep {
  id: number;
  parent_id: number | null;
  depth: number;
  type: "split" | "base" | "combine";
  x: string;
  y: string;
  m: number | null;
  a: string | null;
  b: string | null;
  c: string | null;
  d: string | null;
  z0: string | null;
  z1: string | null;
  z2: string | null;
  result: string | null;
  description: string;
}

interface KResponse {
  a: string;
  b: string;
  digits_a: number;
  digits_b: number;
  product: string;
  verified: boolean;
  runtime_ms: number;
  builtin_ms: number;
  truncated: boolean;
  steps: KStep[];
}

/* ------------------------------ styles ----------------------------- */
/* Same palette and font as the home page. */

const C = {
  bg: "#f5f6f7", surface: "#ffffff", bar: "#e4e6e8", line: "#dcdfe2",
  ink: "#2b2f33", muted: "#6b7279",
  blue: "#2f80d0", blueDark: "#2569ab", blueTint: "#eef5fc",
  green: "#3b9a3e", greenDark: "#2f7d32",
  red: "#b3141b", redDark: "#8f1016",
  orange: "#e08a00", grey: "#b9bfc5",
};

/* Global CSS: keyframes, hover effects and transitions only (colors come from the palette above). */
const CSS = `
@keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: none; } }
@keyframes fadeSwap { from { opacity: 0; transform: translateX(-10px); } to { opacity: 1; transform: none; } }
@keyframes popIn { 0% { opacity: 0; transform: scale(0); } 60% { opacity: 1; transform: scale(1.7); } 100% { opacity: 1; transform: scale(1); } }
@keyframes slideIn { from { opacity: 0; transform: translateX(-20px); } to { opacity: 1; transform: none; } }
@keyframes dashFlow { to { stroke-dashoffset: -20; } }
@keyframes drawLine { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
@keyframes ringPulse { 0% { transform: scale(.8); opacity: 1; } 100% { transform: scale(2.2); opacity: 0; } }
@keyframes stripGlow { 0%, 100% { opacity: .12; } 50% { opacity: .24; } }
@keyframes playPulse { 0% { box-shadow: 0 0 0 0 rgba(47,128,208,.5); } 100% { box-shadow: 0 0 0 14px rgba(47,128,208,0); } }
@keyframes spin { to { transform: rotate(360deg); } }
@keyframes dotBeat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.35); } }
@keyframes shine { from { background-position: -200% 0; } to { background-position: 200% 0; } }
@keyframes floaty { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }

.dc-card { animation: fadeUp .5s cubic-bezier(.2,.8,.2,1) both; transition: transform .25s ease, box-shadow .25s ease, border-color .25s ease; }
.dc-card:hover { transform: translateY(-3px); box-shadow: 0 10px 24px rgba(43,47,51,.10); border-color: #bcd3ee; }
.dc-pill { background: var(--c); transition: transform .18s cubic-bezier(.3,1.6,.5,1), box-shadow .2s ease, background .2s ease; }
.dc-pill:hover:not(:disabled) { background: var(--h); transform: translateY(-2px) scale(1.05); box-shadow: 0 8px 18px rgba(43,47,51,.2); }
.dc-pill:active:not(:disabled) { transform: translateY(0) scale(.94); box-shadow: none; }
.dc-pill:disabled { background: #c3c8cc; }
.dc-pill.pulse { animation: playPulse 1.1s ease-out infinite; }
.dc-tab { transition: transform .2s cubic-bezier(.3,1.6,.5,1), background .25s ease, color .25s ease, border-color .25s ease, box-shadow .25s ease; }
.dc-tab:hover { transform: translateY(-2px) scale(1.04); box-shadow: 0 6px 14px rgba(43,47,51,.12); }
.dc-swap { animation: fadeSwap .35s ease both; }
.dc-pt { transform-box: fill-box; transform-origin: center; animation: popIn .6s cubic-bezier(.2,.8,.2,1) both;
  transition: fill .35s ease, r .35s cubic-bezier(.3,1.6,.5,1), filter .35s ease; }
.dc-pt.hot { filter: drop-shadow(0 0 4px rgba(224,138,0,.85)); }
.dc-flow { animation: dashFlow .8s linear infinite; }
.dc-draw { stroke-dasharray: 1; animation: drawLine .6s ease-out both; filter: drop-shadow(0 0 3px currentColor); }
.dc-ring { transform-box: fill-box; transform-origin: center; animation: ringPulse 1.4s ease-out infinite; }
.dc-strip { animation: stripGlow 1.8s ease-in-out infinite; transition: x .45s ease, width .45s ease; }
.dc-vline { transition: x1 .45s ease, x2 .45s ease; }
.dc-dot { animation: dotBeat 1.6s ease-in-out infinite; }
.dc-row { animation: slideIn .35s ease both; transition: background .3s ease, border-color .3s ease, color .3s ease; }
.dc-prog { height: 6px; border-radius: 999px; background: #e4e6e8; overflow: hidden; margin-bottom: 12px; }
.dc-prog > div { height: 100%; border-radius: 999px; background: #2f80d0; transition: width .4s cubic-bezier(.3,.9,.3,1); }
.dc-spin { width: 34px; height: 34px; margin: 0 auto 14px; border-radius: 50%; border: 4px solid #dcdfe2; border-top-color: #2f80d0; animation: spin .8s linear infinite; }
.dc-float { animation: floaty 3s ease-in-out infinite; }
.dc-skeleton { background: linear-gradient(100deg, transparent 20%, rgba(47,128,208,.12) 50%, transparent 80%); background-size: 200% 100%; animation: shine 1.4s linear infinite; }
input[type=range] { accent-color: #2f80d0; cursor: pointer; }
select { transition: border-color .2s ease, box-shadow .2s ease; }
select:hover, select:focus { border-color: #2f80d0 !important; box-shadow: 0 0 0 3px rgba(47,128,208,.18); outline: none; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation-duration: .001ms !important; animation-iteration-count: 1 !important; transition-duration: .001ms !important; }
}
`;

function GlobalStyles() {
  return <style>{CSS}</style>;
}

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh", display: "flex", flexDirection: "column", background: C.bg, color: C.ink,
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif', lineHeight: 1.5, boxSizing: "border-box",
  },
  bar: { background: C.bar, textAlign: "center", padding: "14px 16px", fontWeight: 600, fontSize: 15, borderBottom: `1px solid ${C.line}` },
  body: { flex: 1, width: "100%", maxWidth: 1180, margin: "0 auto", padding: 24, boxSizing: "border-box" },
  tabs: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  fileLine: { color: C.muted, fontSize: 14, margin: "0 0 16px" },
  cols: { display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" },
  main: { flex: "1 1 520px", minWidth: 0 },
  side: { flex: "0 0 280px", minWidth: 240, display: "flex", flexDirection: "column", gap: 16 },
  card: { background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8, padding: 18 },
  cardTitle: { margin: "0 0 10px", padding: "0 0 8px", fontSize: 15, fontWeight: 600, borderBottom: `1px solid ${C.line}` },
  h2: { fontSize: 20, margin: "0 0 14px" },
  legend: { display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, color: C.muted, marginTop: 10 },
  dot: { display: "inline-block", width: 9, height: 9, borderRadius: "50%", marginRight: 6 },
  desc: { fontSize: 15, minHeight: 46, margin: 0, wordBreak: "break-word" },
  kv: { display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 14, margin: 0 },
  kvKey: { color: C.muted },
  kvVal: { wordBreak: "break-all", fontFamily: "Consolas, Menlo, monospace", fontSize: 13, margin: 0 },
  trace: { maxHeight: 300, overflowY: "auto", marginTop: 16, border: `1px solid ${C.line}`, borderRadius: 8, background: C.surface, scrollBehavior: "smooth" },
  traceRow: { padding: "6px 12px", fontSize: 13, borderLeft: "3px solid transparent", wordBreak: "break-word" },
  controls: {
    display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", padding: "14px 18px",
    background: C.surface, border: `1px solid ${C.line}`, borderRadius: 8, marginTop: 8,
  },
  grow: { flex: 1 },
  select: { font: "inherit", fontSize: 13, padding: "6px 8px", border: "1px solid #b9bfc5", borderRadius: 6, background: C.surface, color: C.ink },
  notice: { textAlign: "center", padding: "60px 20px", color: C.muted },
  warn: { fontSize: 13, color: C.orange, margin: "10px 0 0" },
  error: { color: C.red, fontWeight: 600 },
};

/* ----------------------------- small bits --------------------------- */

function Pill(props: { color: string; hover: string; disabled?: boolean; pulse?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={`dc-pill${props.pulse ? " pulse" : ""}`}
      disabled={props.disabled}
      onClick={props.onClick}
      style={{
        font: "inherit", fontSize: 14, fontWeight: 600, color: "#fff", border: 0, borderRadius: 999,
        padding: "9px 24px", cursor: props.disabled ? "not-allowed" : "pointer",
        ...({ "--c": props.color, "--h": props.hover } as CSSProperties),
      }}
    >
      {props.children}
    </button>
  );
}

function Tab(props: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={props.onClick}
      className="dc-tab"
      style={{
        font: "inherit", fontSize: 14, fontWeight: 600, padding: "8px 18px", borderRadius: 999, cursor: "pointer",
        border: `1px solid ${props.active ? C.blue : C.line}`,
        background: props.active ? C.blue : C.surface, color: props.active ? "#fff" : C.ink,
      }}
    >
      {props.children}
    </button>
  );
}

function Dot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span>
      <i className="dc-dot" style={{ ...S.dot, background: color }} />
      {children}
    </span>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt style={S.kvKey}>{k}</dt>
      <dd style={S.kvVal}>{v}</dd>
    </>
  );
}

const num = (n: number) => Number(n.toPrecision(6)).toString();
const ms = (n: number) => `${n < 10 ? n.toFixed(2) : n.toFixed(0)} ms`;
const ptStr = (p: { x: number; y: number }) => `(${num(p.x)}, ${num(p.y)})`;

/* ------------------------------ hooks ------------------------------- */

function useTrace<T>(path: string, text: string, enabled: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(`${API}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    })
      .then(async (r) => {
        if (!r.ok) {
          let msg = `The server returned ${r.status}.`;
          try {
            const j = await r.json();
            if (j.detail) msg = String(j.detail);
          } catch {
            /* keep the default message */
          }
          throw new Error(msg);
        }
        return r.json();
      })
      .then((d: T) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message || "Could not reach the server."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [path, text, enabled]);

  return { data, error, loading };
}

function usePlayer(total: number) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(300);

  useEffect(() => {
    setIndex(0);
    setPlaying(false);
  }, [total]);

  useEffect(() => {
    if (!playing) return;
    const t = setInterval(() => {
      setIndex((p) => {
        if (p >= total - 1) {
          setPlaying(false);
          return p;
        }
        return p + 1;
      });
    }, speed);
    return () => clearInterval(t);
  }, [playing, speed, total]);

  const last = Math.max(total - 1, 0);
  return {
    index, playing, speed, setSpeed,
    setIndex: (i: number) => setIndex(Math.min(Math.max(i, 0), last)),
    toggle: () => {
      if (index >= last) setIndex(0);
      setPlaying((p) => !p);
    },
    next: () => { setPlaying(false); setIndex((p) => Math.min(p + 1, last)); },
    prev: () => { setPlaying(false); setIndex((p) => Math.max(p - 1, 0)); },
    end: () => { setPlaying(false); setIndex(last); },
    atStart: index <= 0,
    atEnd: index >= last,
  };
}

type Player = ReturnType<typeof usePlayer>;

/* ----------------------- shared layout pieces ----------------------- */

function Controls({ p, onHome }: { p: Player; onHome: () => void }) {
  return (
    <div className="dc-card" style={{ ...S.controls, animationDelay: "0.3s" }}>
      <Pill color={C.red} hover={C.redDark} onClick={onHome}>Back to home</Pill>
      <Pill color={C.blue} hover={C.blueDark} disabled={p.atStart} onClick={p.prev}>Previous</Pill>
      <Pill color={C.blue} hover={C.blueDark} pulse={p.playing} onClick={p.toggle}>
        {p.playing ? "Pause" : p.atEnd ? "Replay" : "Play"}
      </Pill>
      <Pill color={C.blue} hover={C.blueDark} disabled={p.atEnd} onClick={p.next}>Next</Pill>
      <label style={{ fontSize: 13, color: C.muted }}>
        Speed{" "}
        <select style={S.select} value={p.speed} onChange={(e) => p.setSpeed(Number(e.target.value))}>
          <option value={900}>Slow</option>
          <option value={300}>Normal</option>
          <option value={80}>Fast</option>
          <option value={20}>Very fast</option>
        </select>
      </label>
      <span style={S.grow} />
      <Pill color={C.green} hover={C.greenDark} disabled={p.atEnd} onClick={p.end}>Skip to end</Pill>
    </div>
  );
}

function SidePanel(props: {
  p: Player;
  total: number;
  description: string;
  details?: [string, string][];
  summary: [string, string][];
}) {
  const { p, total } = props;
  const pct = total <= 1 ? (total === 1 ? 100 : 0) : (p.index / (total - 1)) * 100;
  return (
    <aside style={S.side}>
      <div className="dc-card" style={{ ...S.card, animationDelay: "0.05s" }}>
        <h3 style={S.cardTitle}>Progress</h3>
        <div style={{ fontSize: 28, fontWeight: 300, marginBottom: 6 }}>
          {total === 0 ? 0 : p.index + 1}
          <span style={{ fontSize: 14, color: C.muted }}> of {total} steps</span>
        </div>
        <div className="dc-prog"><div style={{ width: `${pct}%` }} /></div>
        <input
          type="range" min={0} max={Math.max(total - 1, 0)} value={p.index}
          onChange={(e) => p.setIndex(Number(e.target.value))}
          style={{ width: "100%" }} aria-label="Step"
        />
      </div>
      <div className="dc-card" style={{ ...S.card, animationDelay: "0.15s" }}>
        <h3 style={S.cardTitle}>What is happening</h3>
        <p key={p.index} className="dc-swap" style={S.desc}>{props.description}</p>
        {props.details && props.details.length > 0 && (
          <dl key={`d${p.index}`} className="dc-swap" style={{ ...S.kv, marginTop: 12 }}>
            {props.details.map(([k, v]) => <Row key={k} k={k} v={v} />)}
          </dl>
        )}
      </div>
      <div className="dc-card" style={{ ...S.card, animationDelay: "0.25s" }}>
        <h3 style={S.cardTitle}>Result</h3>
        <dl style={S.kv}>
          {props.summary.map(([k, v]) => <Row key={k} k={k} v={v} />)}
        </dl>
      </div>
    </aside>
  );
}

function StatusCard({ loading, error }: { loading: boolean; error: string }) {
  return (
    <div className="dc-card" style={{ ...S.card, ...S.notice }}>
      {loading ? (
        <>
          <div className="dc-spin" />
          <span className="dc-skeleton" style={{ padding: "4px 12px", borderRadius: 6 }}>Running the algorithm on the server…</span>
        </>
      ) : (
        <span style={S.error}>{error}</span>
      )}
    </div>
  );
}

function MismatchNotice({ what, onHome }: { what: string; onHome: () => void }) {
  return (
    <div className="dc-card" style={{ ...S.card, ...S.notice }}>
      <p className="dc-float" style={{ marginTop: 0 }}>The file you uploaded contains {what}, so this algorithm can’t run on it.</p>
      <Pill color={C.blue} hover={C.blueDark} onClick={onHome}>Upload a different file</Pill>
    </div>
  );
}

/* ------------------------- closest pair view ------------------------ */

type Range = [number, number] | null;

interface CPView {
  left: Range;
  right: Range;
  focus: Range;
  strip: Set<number>;
  lineX: number | null;
  delta: number | null;
  checked: [number, number, number][];
  best: BestPair | null;
}

const inRange = (i: number, r: Range) => r !== null && i >= r[0] && i <= r[1];

function ClosestPairView({ text, onHome, enabled }: { text: string; onHome: () => void; enabled: boolean }) {
  const { data, error, loading } = useTrace<CPResponse>("/api/closest-pair", text, enabled);
  const steps = data?.steps ?? [];
  const p = usePlayer(steps.length);

  const view = useMemo<CPView>(() => {
    const v: CPView = { left: null, right: null, focus: null, strip: new Set(), lineX: null, delta: null, checked: [], best: null };
    for (let i = 0; i <= p.index && i < steps.length; i++) {
      const s = steps[i];
      if (s.type === "divide") {
        // NOTE: assumes lo..hi are inclusive indices into the sorted points.
        v.left = [s.lo, s.mid];
        v.right = [s.mid + 1, s.hi];
        v.focus = null;
        v.strip = new Set();
        v.lineX = s.midX;
        v.delta = null;
        v.checked = [];
        v.best = null;
      } else if (s.type === "base" || s.type === "merge") {
        v.left = null;
        v.right = null;
        v.focus = [s.lo, s.hi];
        v.strip = new Set();
        v.lineX = null;
        v.delta = null;
        v.checked = [];
        v.best = s.best;
      } else {
        v.left = null;
        v.right = null;
        v.focus = [s.lo, s.hi];
        v.strip = new Set(s.strip);
        v.lineX = s.midX;
        v.delta = s.d;
        v.checked = s.checked;
      }
    }
    return v;
  }, [steps, p.index]);

  if (!enabled) return <MismatchNotice what="two integers" onHome={onHome} />;
  if (loading || error || !data) return <StatusCard loading={loading} error={error} />;

  const pts = data.points;
  const W = 700, H = 440, pad = 30;
  const xs = pts.map((q) => q.x), ys = pts.map((q) => q.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (W - 2 * pad);
  const sy = (y: number) => H - pad - ((y - minY) / (maxY - minY || 1)) * (H - 2 * pad);
  const r = pts.length > 300 ? 2.5 : 3.8;

  const colorOf = (i: number) => {
    if (view.strip.has(i)) return C.orange;
    if (inRange(i, view.left) || inRange(i, view.focus)) return C.blue;
    if (inRange(i, view.right)) return C.green;
    return C.grey;
  };

  const hasStrip = view.lineX !== null && view.delta !== null;
  const stripL = hasStrip ? Math.max(sx(view.lineX! - view.delta!), 0) : 0;
  const stripR = hasStrip ? Math.min(sx(view.lineX! + view.delta!), W) : 0;
  const lastChecked = view.checked.length ? view.checked[view.checked.length - 1] : null;
  const step = steps[p.index];
  const popDelay = (i: number) => `${Math.min(i * 6, 700)}ms`;

  return (
    <div style={S.cols}>
      <div style={S.main}>
        <h2 className="dc-swap" style={S.h2}>Closest pair of points</h2>
        <div className="dc-card" style={S.card}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Points and the current step of the algorithm">
            <rect x={0} y={0} width={W} height={H} fill="#fafbfb" />
            {hasStrip && (
              <rect className="dc-strip" x={stripL} y={0} width={Math.max(stripR - stripL, 0)} height={H} fill={C.orange} />
            )}
            {view.lineX !== null && (
              <line
                className="dc-flow dc-vline"
                x1={sx(view.lineX)} x2={sx(view.lineX)} y1={0} y2={H}
                stroke={C.ink} strokeDasharray="6 4" strokeWidth={1.5}
              />
            )}
            {view.checked.map(([i, j], k) => {
              const isLast = k === view.checked.length - 1;
              return (
                <line
                  key={k}
                  className={isLast ? "dc-draw" : undefined}
                  pathLength={isLast ? 1 : undefined}
                  x1={sx(pts[i].x)} y1={sy(pts[i].y)} x2={sx(pts[j].x)} y2={sy(pts[j].y)}
                  stroke={C.orange} strokeWidth={isLast ? 2.5 : 1} opacity={isLast ? 1 : 0.5}
                  style={{ color: C.orange, transition: "opacity .3s ease, stroke-width .3s ease" }}
                />
              );
            })}
            {view.best && (
              <line
                key={`bl${view.best.i}-${view.best.j}`}
                className="dc-draw"
                pathLength={1}
                x1={sx(pts[view.best.i].x)} y1={sy(pts[view.best.i].y)}
                x2={sx(pts[view.best.j].x)} y2={sy(pts[view.best.j].y)}
                stroke={C.red} strokeWidth={3} strokeLinecap="round"
                style={{ color: C.red }}
              />
            )}
            {pts.map((q, i) => {
              const hot = view.strip.has(i);
              return (
                <circle
                  key={i}
                  className={`dc-pt${hot ? " hot" : ""}`}
                  cx={sx(q.x)} cy={sy(q.y)} r={hot ? r * 1.5 : r}
                  fill={colorOf(i)}
                  style={{ animationDelay: popDelay(i) }}
                />
              );
            })}
            {view.best && [view.best.i, view.best.j].map((i) => (
              <g key={`b${i}-${view.best!.i}-${view.best!.j}`}>
                <circle cx={sx(pts[i].x)} cy={sy(pts[i].y)} r={r + 3} fill="none" stroke={C.red} strokeWidth={2} />
                <circle className="dc-ring" cx={sx(pts[i].x)} cy={sy(pts[i].y)} r={r + 3} fill="none" stroke={C.red} strokeWidth={2} />
              </g>
            ))}
          </svg>
          <div style={S.legend}>
            <Dot color={C.blue}>Left half / current range</Dot>
            <Dot color={C.green}>Right half</Dot>
            <Dot color={C.orange}>Strip near the line</Dot>
            <Dot color={C.red}>Best pair in range</Dot>
            <Dot color={C.grey}>Not in focus</Dot>
          </div>
          {data.truncated && (
            <p style={S.warn}>The server stopped recording steps early for this large input. The result is still complete.</p>
          )}
        </div>
      </div>
      <SidePanel
        p={p}
        total={steps.length}
        description={step?.description ?? ""}
        details={[
          ...(step ? ([["Depth", String(step.depth)]] as [string, string][]) : []),
          ...(view.best ? ([["Best in range", num(view.best.dist)]] as [string, string][]) : []),
          ...(lastChecked ? ([["Last checked", num(lastChecked[2])]] as [string, string][]) : []),
        ]}
        summary={[
          ["Closest distance", num(data.best.dist)],
          ["Pair", `${ptStr(pts[data.best.i])} and ${ptStr(pts[data.best.j])}`],
          ["Points", String(data.n)],
          ["Runtime", ms(data.runtime_ms)],
          ["Brute force", data.brute_force_ms === null ? "skipped (too large)" : ms(data.brute_force_ms)],
        ]}
      />
      <div style={{ flexBasis: "100%" }}><Controls p={p} onHome={onHome} /></div>
    </div>
  );
}

/* ------------------------- multiplication view ---------------------- */

function detailsK(s: KStep | undefined): [string, string][] {
  if (!s) return [];
  const out: [string, string][] = [["Depth", String(s.depth)]];
  if (s.type === "split") {
    if (s.a !== null && s.b !== null) out.push(["x = a | b", `${s.a} | ${s.b}`]);
    if (s.c !== null && s.d !== null) out.push(["y = c | d", `${s.c} | ${s.d}`]);
    if (s.m !== null) out.push(["m", String(s.m)]);
  } else if (s.type === "combine") {
    if (s.z0 !== null) out.push(["z0", s.z0]);
    if (s.z1 !== null) out.push(["z1", s.z1]);
    if (s.z2 !== null) out.push(["z2", s.z2]);
    if (s.result !== null) out.push(["result", s.result]);
  } else if (s.result !== null) {
    out.push(["result", s.result]);
  }
  return out;
}

function MultiplyView({ text, onHome, enabled }: { text: string; onHome: () => void; enabled: boolean }) {
  const { data, error, loading } = useTrace<KResponse>("/api/multiply", text, enabled);
  const steps = data?.steps ?? [];
  const p = usePlayer(steps.length);
  const traceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = traceRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
  }, [p.index]);

  if (!enabled) return <MismatchNotice what="points" onHome={onHome} />;
  if (loading || error || !data) return <StatusCard loading={loading} error={error} />;

  const from = Math.max(0, p.index - 79);
  const shown = steps.slice(from, p.index + 1);
  const rowColor = (t: KStep["type"]) => (t === "split" ? C.blue : t === "combine" ? C.green : C.orange);
  const step = steps[p.index];

  return (
    <div style={S.cols}>
      <div style={S.main}>
        <h2 className="dc-swap" style={S.h2}>Integer multiplication (Karatsuba)</h2>
        <div className="dc-card" style={S.card}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Multiplying</div>
          <div style={S.kvVal}>{data.a}</div>
          <div style={{ margin: "4px 0", color: C.muted }}>×</div>
          <div style={S.kvVal}>{data.b}</div>
        </div>
        <div style={S.legend}>
          <Dot color={C.blue}>Split</Dot>
          <Dot color={C.orange}>Base case</Dot>
          <Dot color={C.green}>Combine</Dot>
        </div>
        <div style={S.trace} ref={traceRef} aria-label="Recursion trace">
          {from > 0 && <div style={{ ...S.traceRow, color: C.muted }}>… {from} earlier steps hidden</div>}
          {shown.map((s, i) => {
            const current = from + i === p.index;
            return (
              <div
                key={s.id}
                className="dc-row"
                style={{
                  ...S.traceRow,
                  paddingLeft: 12 + s.depth * 18,
                  borderLeftColor: current ? C.blue : "transparent",
                  background: current ? C.blueTint : "transparent",
                  fontWeight: current ? 600 : 400,
                  color: current ? C.ink : rowColor(s.type),
                }}
              >
                {s.description}
              </div>
            );
          })}
        </div>
        {data.truncated && (
          <p style={S.warn}>The server stopped recording steps early for this large input. The product is still complete.</p>
        )}
      </div>
      <SidePanel
        p={p}
        total={steps.length}
        description={step?.description ?? ""}
        details={detailsK(step)}
        summary={[
          ["Product", data.product],
          ["Digits", `${data.digits_a} × ${data.digits_b}`],
          ["Verified", data.verified ? "Yes, matches Python’s a × b" : "No, does not match"],
          ["Karatsuba", ms(data.runtime_ms)],
          ["Built-in", ms(data.builtin_ms)],
        ]}
      />
      <div style={{ flexBasis: "100%" }}><Controls p={p} onHome={onHome} /></div>
    </div>
  );
}

/* ------------------------------- page ------------------------------- */

export default function VisualizePage() {
  const navigate = useNavigate();
  const state = useLocation().state as RunState | null;
  const [tab, setTab] = useState<InputKind>(state?.kind ?? "closest-pair");
  const home = () => navigate("/");

  if (!state) {
    return (
      <div style={S.page}>
        <GlobalStyles />
        <header style={S.bar}>Divide and Conquer Visualizer</header>
        <div style={{ ...S.body, ...S.notice }}>
          <p className="dc-float">No input file yet. Choose one on the home page first.</p>
          <Pill color={C.blue} hover={C.blueDark} onClick={home}>Go to home page</Pill>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <GlobalStyles />
      <header style={S.bar}>Divide and Conquer Visualizer</header>
      <main style={S.body}>
        <div style={S.tabs}>
          <Tab active={tab === "closest-pair"} onClick={() => setTab("closest-pair")}>Closest pair</Tab>
          <Tab active={tab === "multiplication"} onClick={() => setTab("multiplication")}>Integer multiplication</Tab>
        </div>
        <p style={S.fileLine}>File: {state.fileName}</p>

        {tab === "closest-pair" ? (
          <ClosestPairView key="cp" text={state.content} onHome={home} enabled={state.kind === "closest-pair"} />
        ) : (
          <MultiplyView key="mul" text={state.content} onHome={home} enabled={state.kind === "multiplication"} />
        )}
      </main>
    </div>
  );
}