import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { InputKind, RunState } from "./HomePage";

/* ------------------------------------------------------------------ */
/* API contract (what your backend should return)                      */
/*                                                                     */
/* POST /api/closest-pair  body: { points: [[x, y], ...] }             */
/* POST /api/multiply      body: { x: "123...", y: "456..." }          */
/* Both return { result, steps, time_ms? } as typed below.             */
/* ------------------------------------------------------------------ */

type Pt = [number, number];

type CPStep =
  | { type: "split"; depth: number; line_x: number; left: Pt[]; right: Pt[] }
  | { type: "base"; depth: number; points: Pt[] }
  | { type: "strip"; depth: number; line_x: number; delta: number; points: Pt[] }
  | { type: "compare"; a: Pt; b: Pt; dist: number; new_best: boolean };

interface CPResponse {
  result: { distance: number; pair: [Pt, Pt] };
  steps: CPStep[];
  time_ms?: number;
}

type KStep =
  | { type: "split"; depth: number; x: string; y: string; a: string; b: string; c: string; d: string; m: number }
  | { type: "base"; depth: number; x: string; y: string; result: string }
  | { type: "subcall"; depth: number; name: string; x: string; y: string }
  | { type: "combine"; depth: number; x: string; y: string; ac: string; bd: string; mid: string; result: string };

interface KResponse {
  result: string;
  steps: KStep[];
  time_ms?: number;
}

/* ------------------------------ styles ----------------------------- */

const C = {
  bg: "#f5f6f7",
  surface: "#ffffff",
  bar: "#e4e6e8",
  line: "#dcdfe2",
  ink: "#2b2f33",
  muted: "#6b7279",
  blue: "#2f80d0",
  blueDark: "#2569ab",
  blueTint: "#eef5fc",
  green: "#3b9a3e",
  greenDark: "#2f7d32",
  red: "#b3141b",
  redDark: "#8f1016",
  orange: "#e08a00",
  grey: "#b9bfc5",
};

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: C.bg,
    color: C.ink,
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    lineHeight: 1.5,
    boxSizing: "border-box",
  },
  bar: {
    background: C.bar,
    textAlign: "center",
    padding: "14px 16px",
    fontWeight: 600,
    fontSize: 15,
    borderBottom: `1px solid ${C.line}`,
  },
  body: {
    flex: 1,
    width: "100%",
    maxWidth: 1180,
    margin: "0 auto",
    padding: 24,
    boxSizing: "border-box",
  },
  tabs: { display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" },
  fileLine: { color: C.muted, fontSize: 14, margin: "0 0 16px" },
  cols: { display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" },
  main: { flex: "1 1 520px", minWidth: 0 },
  side: { flex: "0 0 280px", minWidth: 240, display: "flex", flexDirection: "column", gap: 16 },
  card: {
    background: C.surface,
    border: `1px solid ${C.line}`,
    borderRadius: 8,
    padding: 18,
  },
  cardTitle: {
    margin: "0 0 10px",
    padding: "0 0 8px",
    fontSize: 15,
    fontWeight: 600,
    borderBottom: `1px solid ${C.line}`,
  },
  h2: { fontSize: 20, margin: "0 0 14px" },
  legend: { display: "flex", flexWrap: "wrap", gap: 16, fontSize: 13, color: C.muted, marginTop: 10 },
  dot: { display: "inline-block", width: 9, height: 9, borderRadius: "50%", marginRight: 6 },
  desc: { fontSize: 15, minHeight: 46, margin: 0, wordBreak: "break-all" },
  kv: { display: "grid", gridTemplateColumns: "auto 1fr", gap: "6px 12px", fontSize: 14, margin: 0 },
  kvKey: { color: C.muted },
  kvVal: { wordBreak: "break-all", fontFamily: "Consolas, Menlo, monospace", fontSize: 13 },
  trace: {
    maxHeight: 300,
    overflowY: "auto",
    marginTop: 16,
    border: `1px solid ${C.line}`,
    borderRadius: 8,
    background: C.surface,
  },
  traceRow: { padding: "6px 12px", fontSize: 13, borderLeft: "3px solid transparent", wordBreak: "break-all" },
  controls: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    padding: "14px 24px",
    background: C.surface,
    borderTop: `1px solid ${C.line}`,
  },
  grow: { flex: 1 },
  select: {
    font: "inherit",
    fontSize: 13,
    padding: "6px 8px",
    border: "1px solid #b9bfc5",
    borderRadius: 6,
    background: C.surface,
    color: C.ink,
  },
  notice: { textAlign: "center", padding: "60px 20px", color: C.muted },
  error: { color: C.red, fontWeight: 600 },
};

/* ----------------------------- small bits --------------------------- */

function Pill(props: {
  color: string;
  hover: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      type="button"
      disabled={props.disabled}
      onClick={props.onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        font: "inherit",
        fontSize: 14,
        fontWeight: 600,
        color: "#fff",
        border: 0,
        borderRadius: 999,
        padding: "9px 24px",
        cursor: props.disabled ? "not-allowed" : "pointer",
        background: props.disabled ? "#c3c8cc" : hover ? props.hover : props.color,
        transition: "background 0.15s",
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
      style={{
        font: "inherit",
        fontSize: 14,
        fontWeight: 600,
        padding: "8px 18px",
        borderRadius: 999,
        cursor: "pointer",
        border: `1px solid ${props.active ? C.blue : C.line}`,
        background: props.active ? C.blue : C.surface,
        color: props.active ? "#fff" : C.ink,
      }}
    >
      {props.children}
    </button>
  );
}

function Dot({ color, children }: { color: string; children: ReactNode }) {
  return (
    <span>
      <i style={{ ...S.dot, background: color }} />
      {children}
    </span>
  );
}

/* ------------------------------ hooks ------------------------------- */

function useTrace<T>(url: string, payload: unknown, enabled: boolean) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    setLoading(true);
    setError("");
    fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`The server returned ${r.status}.`);
        return r.json();
      })
      .then((d: T) => !cancelled && setData(d))
      .catch((e: Error) => !cancelled && setError(e.message || "Could not reach the server."))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled]);

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
    index,
    playing,
    speed,
    setSpeed,
    setIndex: (i: number) => setIndex(Math.min(Math.max(i, 0), last)),
    toggle: () => {
      if (index >= last) setIndex(0);
      setPlaying((p) => !p);
    },
    next: () => {
      setPlaying(false);
      setIndex((p) => Math.min(p + 1, last));
    },
    prev: () => {
      setPlaying(false);
      setIndex((p) => Math.max(p - 1, 0));
    },
    end: () => {
      setPlaying(false);
      setIndex(last);
    },
    atStart: index <= 0,
    atEnd: index >= last,
  };
}

type Player = ReturnType<typeof usePlayer>;

/* ----------------------- shared layout pieces ----------------------- */

function Controls({ p, onHome }: { p: Player; onHome: () => void }) {
  return (
    <div style={S.controls}>
      <Pill color={C.red} hover={C.redDark} onClick={onHome}>
        Back to home
      </Pill>
      <Pill color={C.blue} hover={C.blueDark} disabled={p.atStart} onClick={p.prev}>
        Previous
      </Pill>
      <Pill color={C.blue} hover={C.blueDark} onClick={p.toggle}>
        {p.playing ? "Pause" : p.atEnd ? "Replay" : "Play"}
      </Pill>
      <Pill color={C.blue} hover={C.blueDark} disabled={p.atEnd} onClick={p.next}>
        Next
      </Pill>
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
      <Pill color={C.green} hover={C.greenDark} disabled={p.atEnd} onClick={p.end}>
        Skip to end
      </Pill>
    </div>
  );
}

function SidePanel(props: {
  p: Player;
  total: number;
  description: string;
  summary: [string, string][];
  details?: [string, string][];
}) {
  const { p, total } = props;
  return (
    <aside style={S.side}>
      <div style={S.card}>
        <h3 style={S.cardTitle}>Progress</h3>
        <div style={{ fontSize: 28, fontWeight: 300, marginBottom: 6 }}>
          {total === 0 ? 0 : p.index + 1}
          <span style={{ fontSize: 14, color: C.muted }}> of {total} steps</span>
        </div>
        <input
          type="range"
          min={0}
          max={Math.max(total - 1, 0)}
          value={p.index}
          onChange={(e) => p.setIndex(Number(e.target.value))}
          style={{ width: "100%" }}
          aria-label="Step"
        />
      </div>
      <div style={S.card}>
        <h3 style={S.cardTitle}>What is happening</h3>
        <p style={S.desc}>{props.description}</p>
        {props.details && (
          <dl style={{ ...S.kv, marginTop: 12 }}>
            {props.details.map(([k, v]) => (
              <Fragment2 key={k} k={k} v={v} />
            ))}
          </dl>
        )}
      </div>
      <div style={S.card}>
        <h3 style={S.cardTitle}>Result</h3>
        <dl style={S.kv}>
          {props.summary.map(([k, v]) => (
            <Fragment2 key={k} k={k} v={v} />
          ))}
        </dl>
      </div>
    </aside>
  );
}

function Fragment2({ k, v }: { k: string; v: string }) {
  return (
    <>
      <dt style={S.kvKey}>{k}</dt>
      <dd style={{ ...S.kvVal, margin: 0 }}>{v}</dd>
    </>
  );
}

function StatusCard({ loading, error }: { loading: boolean; error: string }) {
  return (
    <div style={{ ...S.card, ...S.notice }}>
      {loading ? "Running the algorithm on the server…" : <span style={S.error}>{error}</span>}
    </div>
  );
}

const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(3));
const ptStr = (p: Pt) => `(${fmt(p[0])}, ${fmt(p[1])})`;
const key = (p: Pt) => `${p[0]},${p[1]}`;

/* ------------------------- closest pair view ------------------------ */

function describeCP(s: CPStep | undefined): string {
  if (!s) return "";
  switch (s.type) {
    case "split":
      return `Divide: split ${s.left.length + s.right.length} points at x = ${fmt(s.line_x)} into ${s.left.length} on the left and ${s.right.length} on the right.`;
    case "base":
      return `Base case: only ${s.points.length} points left, so every pair is checked directly.`;
    case "strip":
      return `Combine: check the ${s.points.length} points within ${fmt(s.delta)} of the dividing line for a closer pair that crosses it.`;
    case "compare":
      return `Compare ${ptStr(s.a)} and ${ptStr(s.b)}: distance ${fmt(s.dist)}. ${s.new_best ? "This is the new best pair." : "Not better than the current best."}`;
  }
}

interface CPView {
  lineX: number | null;
  left: Set<string>;
  right: Set<string>;
  base: Set<string>;
  strip: Set<string>;
  delta: number | null;
  cmp: [Pt, Pt] | null;
  best: [Pt, Pt] | null;
  bestDist: number | null;
}

function ClosestPairView({ points, onHome, enabled }: { points: Pt[]; onHome: () => void; enabled: boolean }) {
  const { data, error, loading } = useTrace<CPResponse>("/api/closest-pair", { points }, enabled);
  const steps = data?.steps ?? [];
  const p = usePlayer(steps.length);

  const view = useMemo<CPView>(() => {
    const v: CPView = {
      lineX: null, left: new Set(), right: new Set(), base: new Set(), strip: new Set(),
      delta: null, cmp: null, best: null, bestDist: null,
    };
    for (let i = 0; i <= p.index && i < steps.length; i++) {
      const s = steps[i];
      if (s.type === "split") {
        v.lineX = s.line_x;
        v.left = new Set(s.left.map(key));
        v.right = new Set(s.right.map(key));
        v.base = new Set();
        v.strip = new Set();
        v.delta = null;
        v.cmp = null;
      } else if (s.type === "base") {
        v.base = new Set(s.points.map(key));
        v.left = new Set();
        v.right = new Set();
        v.strip = new Set();
        v.lineX = null;
        v.delta = null;
      } else if (s.type === "strip") {
        v.lineX = s.line_x;
        v.delta = s.delta;
        v.strip = new Set(s.points.map(key));
      } else {
        v.cmp = [s.a, s.b];
        if (s.new_best) {
          v.best = [s.a, s.b];
          v.bestDist = s.dist;
        }
      }
    }
    return v;
  }, [steps, p.index]);

  if (!enabled) return <MismatchNotice what="two integers" onHome={onHome} />;
  if (loading || error || !data) return <StatusCard loading={loading} error={error} />;

  const W = 700, H = 440, pad = 30;
  const xs = points.map((q) => q[0]);
  const ys = points.map((q) => q[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (W - 2 * pad);
  const sy = (y: number) => H - pad - ((y - minY) / (maxY - minY || 1)) * (H - 2 * pad);
  const r = points.length > 300 ? 2.5 : 3.8;

  const colorOf = (q: Pt) => {
    const k = key(q);
    if (view.strip.has(k)) return C.orange;
    if (view.left.has(k) || view.base.has(k)) return C.blue;
    if (view.right.has(k)) return C.green;
    return C.grey;
  };

  const stripL = view.lineX !== null && view.delta !== null ? sx(view.lineX - view.delta) : 0;
  const stripR = view.lineX !== null && view.delta !== null ? sx(view.lineX + view.delta) : 0;

  return (
    <div style={S.cols}>
      <div style={S.main}>
        <h2 style={S.h2}>Closest pair of points</h2>
        <div style={S.card}>
          <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }} role="img" aria-label="Points and the current step of the algorithm">
            <rect x={0} y={0} width={W} height={H} fill="#fafbfb" />
            {view.lineX !== null && view.delta !== null && (
              <rect x={Math.max(stripL, 0)} y={0} width={Math.max(Math.min(stripR, W) - Math.max(stripL, 0), 0)} height={H} fill={C.orange} opacity={0.12} />
            )}
            {view.lineX !== null && (
              <line x1={sx(view.lineX)} x2={sx(view.lineX)} y1={0} y2={H} stroke={C.ink} strokeDasharray="6 4" strokeWidth={1.5} />
            )}
            {view.best && (
              <line x1={sx(view.best[0][0])} y1={sy(view.best[0][1])} x2={sx(view.best[1][0])} y2={sy(view.best[1][1])} stroke={C.red} strokeWidth={3} />
            )}
            {view.cmp && (
              <line x1={sx(view.cmp[0][0])} y1={sy(view.cmp[0][1])} x2={sx(view.cmp[1][0])} y2={sy(view.cmp[1][1])} stroke={C.orange} strokeWidth={2} strokeDasharray="4 3" />
            )}
            {points.map((q, i) => (
              <circle key={i} cx={sx(q[0])} cy={sy(q[1])} r={r} fill={colorOf(q)} />
            ))}
            {view.best && view.best.map((q, i) => (
              <circle key={`b${i}`} cx={sx(q[0])} cy={sy(q[1])} r={r + 3} fill="none" stroke={C.red} strokeWidth={2} />
            ))}
          </svg>
          <div style={S.legend}>
            <Dot color={C.blue}>Left half</Dot>
            <Dot color={C.green}>Right half</Dot>
            <Dot color={C.orange}>Strip near the line</Dot>
            <Dot color={C.red}>Best pair so far</Dot>
            <Dot color={C.grey}>Not in focus</Dot>
          </div>
        </div>
      </div>
      <SidePanel
        p={p}
        total={steps.length}
        description={describeCP(steps[p.index])}
        details={view.bestDist !== null ? [["Best so far", fmt(view.bestDist)]] : undefined}
        summary={[
          ["Closest distance", fmt(data.result.distance)],
          ["Pair", `${ptStr(data.result.pair[0])} and ${ptStr(data.result.pair[1])}`],
          ["Points", String(points.length)],
          ...(data.time_ms !== undefined ? ([["Server time", `${data.time_ms} ms`]] as [string, string][]) : []),
        ]}
      />
      <div style={{ flexBasis: "100%" }}>
        <Controls p={p} onHome={onHome} />
      </div>
    </div>
  );
}

/* ------------------------- multiplication view ---------------------- */

function describeK(s: KStep | undefined): string {
  if (!s) return "";
  switch (s.type) {
    case "split":
      return `Divide: split ${s.x} and ${s.y} at ${s.m} digits into a, b and c, d.`;
    case "base":
      return `Base case: ${s.x} × ${s.y} is small enough to multiply directly = ${s.result}.`;
    case "subcall":
      return `Recursive call for ${s.name}: ${s.x} × ${s.y}.`;
    case "combine":
      return `Combine: put ac, bd and the middle term together to get ${s.x} × ${s.y} = ${s.result}.`;
  }
}

function detailsK(s: KStep | undefined): [string, string][] | undefined {
  if (!s) return undefined;
  if (s.type === "split")
    return [["x", `${s.a} | ${s.b}`], ["y", `${s.c} | ${s.d}`], ["m", String(s.m)]];
  if (s.type === "combine")
    return [["ac", s.ac], ["bd", s.bd], ["middle", s.mid]];
  if (s.type === "subcall") return [["depth", String(s.depth)]];
  return [["depth", String(s.depth)]];
}

function MultiplyView({ x, y, onHome, enabled }: { x: string; y: string; onHome: () => void; enabled: boolean }) {
  const { data, error, loading } = useTrace<KResponse>("/api/multiply", { x, y }, enabled);
  const steps = data?.steps ?? [];
  const p = usePlayer(steps.length);
  const traceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (traceRef.current) traceRef.current.scrollTop = traceRef.current.scrollHeight;
  }, [p.index]);

  if (!enabled) return <MismatchNotice what="points" onHome={onHome} />;
  if (loading || error || !data) return <StatusCard loading={loading} error={error} />;

  const from = Math.max(0, p.index - 79);
  const shown = steps.slice(from, p.index + 1);
  const rowColor = (t: KStep["type"]) =>
    t === "split" ? C.blue : t === "combine" ? C.green : t === "base" ? C.orange : C.muted;

  return (
    <div style={S.cols}>
      <div style={S.main}>
        <h2 style={S.h2}>Integer multiplication (Karatsuba)</h2>
        <div style={S.card}>
          <div style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Multiplying</div>
          <div style={{ ...S.kvVal, wordBreak: "break-all" }}>{x}</div>
          <div style={{ margin: "4px 0", color: C.muted }}>×</div>
          <div style={{ ...S.kvVal, wordBreak: "break-all" }}>{y}</div>
        </div>
        <div style={S.legend}>
          <Dot color={C.blue}>Split</Dot>
          <Dot color={C.muted}>Recursive call</Dot>
          <Dot color={C.orange}>Base case</Dot>
          <Dot color={C.green}>Combine</Dot>
        </div>
        <div style={S.trace} ref={traceRef} aria-label="Recursion trace">
          {from > 0 && <div style={{ ...S.traceRow, color: C.muted }}>… {from} earlier steps hidden</div>}
          {shown.map((s, i) => {
            const current = from + i === p.index;
            return (
              <div
                key={from + i}
                style={{
                  ...S.traceRow,
                  paddingLeft: 12 + (s.type === "subcall" ? s.depth + 1 : s.depth) * 18,
                  borderLeftColor: current ? C.blue : "transparent",
                  background: current ? C.blueTint : "transparent",
                  fontWeight: current ? 600 : 400,
                  color: current ? C.ink : rowColor(s.type),
                }}
              >
                {describeK(s)}
              </div>
            );
          })}
        </div>
      </div>
      <SidePanel
        p={p}
        total={steps.length}
        description={describeK(steps[p.index])}
        details={detailsK(steps[p.index])}
        summary={[
          ["Product", data.result],
          ["Digits", `${x.length} × ${y.length}`],
          ...(data.time_ms !== undefined ? ([["Server time", `${data.time_ms} ms`]] as [string, string][]) : []),
        ]}
      />
      <div style={{ flexBasis: "100%" }}>
        <Controls p={p} onHome={onHome} />
      </div>
    </div>
  );
}

function MismatchNotice({ what, onHome }: { what: string; onHome: () => void }) {
  return (
    <div style={{ ...S.card, ...S.notice }}>
      <p style={{ marginTop: 0 }}>The file you uploaded contains {what}, so this algorithm can’t run on it.</p>
      <Pill color={C.blue} hover={C.blueDark} onClick={onHome}>
        Upload a different file
      </Pill>
    </div>
  );
}

/* ------------------------------- page ------------------------------- */

function parsePoints(text: string): Pt[] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => l.split(/[\s,]+/).map(Number) as Pt)
    .filter((p) => p.length === 2 && p.every(Number.isFinite));
}

export default function VisualizePage() {
  const navigate = useNavigate();
  const state = useLocation().state as RunState | null;
  const [tab, setTab] = useState<InputKind>(state?.kind ?? "closest-pair");

  const points = useMemo(
    () => (state?.kind === "closest-pair" ? parsePoints(state.content) : []),
    [state]
  );
  const ints = useMemo(
    () =>
      state?.kind === "multiplication"
        ? state.content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
        : ["", ""],
    [state]
  );

  const home = () => navigate("/");

  if (!state) {
    return (
      <div style={S.page}>
        <header style={S.bar}>Divide and Conquer Visualizer</header>
        <div style={{ ...S.body, ...S.notice }}>
          <p>No input file yet. Choose one on the home page first.</p>
          <Pill color={C.blue} hover={C.blueDark} onClick={home}>
            Go to home page
          </Pill>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      <header style={S.bar}>Divide and Conquer Visualizer</header>
      <main style={S.body}>
        <div style={S.tabs}>
          <Tab active={tab === "closest-pair"} onClick={() => setTab("closest-pair")}>
            Closest pair
          </Tab>
          <Tab active={tab === "multiplication"} onClick={() => setTab("multiplication")}>
            Integer multiplication
          </Tab>
        </div>
        <p style={S.fileLine}>File: {state.fileName}</p>

        {tab === "closest-pair" ? (
          <ClosestPairView points={points} onHome={home} enabled={state.kind === "closest-pair"} />
        ) : (
          <MultiplyView x={ints[0]} y={ints[1]} onHome={home} enabled={state.kind === "multiplication"} />
        )}
      </main>
    </div>
  );
}
