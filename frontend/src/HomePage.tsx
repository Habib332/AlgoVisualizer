import { useEffect, useRef, useState } from "react";
import type { ChangeEvent, CSSProperties, DragEvent, ReactNode } from "react";
import { useNavigate } from "react-router-dom";

export type InputKind = "closest-pair" | "multiplication";

export interface RunState {
  fileName: string;
  content: string;
  kind: InputKind;
}

const API = "https://algo-visualizer-7ja9.vercel.app";

type SampleKind = "cp" | "mul";

const SAMPLE_GROUPS: { kind: SampleKind; label: string; accent: string; tint: string }[] = [
  { kind: "cp", label: "Closest pair of points", accent: "#3b9a3e", tint: "#e7f3e8" },
  { kind: "mul", label: "Integer multiplication", accent: "#2f80d0", tint: "#e6f0fa" },
];

interface Detected {
  kind: InputKind | null;
  summary: string;
}

/** Closest pair: one "x y" per line. Multiplication: two integers on two lines. */
function detect(text: string): Detected {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return { kind: null, summary: "The file is empty." };

  if (lines.length === 2 && lines.every((l) => /^-?\d+$/.test(l))) {
    return {
      kind: "multiplication",
      summary: `Two integers (${lines[0].length} and ${lines[1].length} digits)`,
    };
  }

  const isPoint = (l: string) => /^-?\d+(\.\d+)?[\s,]+-?\d+(\.\d+)?$/.test(l);
  if (lines.length >= 2 && lines.every(isPoint)) {
    return { kind: "closest-pair", summary: `${lines.length} points` };
  }

  return {
    kind: null,
    summary:
      "Format not recognised. Use one “x y” pair per line, or two integers on two lines.",
  };
}

const ALGORITHMS = [
  {
    key: "closest-pair" as InputKind,
    title: "Closest pair of points",
    complexity: "O(n log n)",
    text: "Split the points by a vertical line, solve each half, then check only the narrow strip around the line for a closer pair that crosses it.",
    format: "Input: one “x y” pair per line",
    accent: "#3b9a3e",
    tint: "#e7f3e8",
    tintInk: "#2f7d32",
  },
  {
    key: "multiplication" as InputKind,
    title: "Integer multiplication (Karatsuba)",
    complexity: "O(n^1.585)",
    text: "Split each number in half and use three recursive multiplications instead of four, then combine the parts into the full product.",
    format: "Input: two integers, one per line",
    accent: "#2f80d0",
    tint: "#e6f0fa",
    tintInk: "#2569ab",
  },
];

const C = {
  bg: "#f5f6f7",
  surface: "#ffffff",
  bar: "#e4e6e8",
  line: "#dcdfe2",
  ink: "#2b2f33",
  muted: "#6b7279",
  blue: "#2f80d0",
  blueDark: "#2569ab",
  green: "#3b9a3e",
  greenDark: "#2f7d32",
  red: "#b3141b",
};

const S: Record<string, CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    flexDirection: "column",
    background: C.bg,
    color: C.ink,
    fontFamily: '"Segoe UI", "Helvetica Neue", Arial, sans-serif',
    lineHeight: 1.55,
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
  main: {
    width: "100%",
    maxWidth: 920,
    margin: "0 auto",
    padding: "48px 24px 32px",
    flex: 1,
    boxSizing: "border-box",
  },
  h1: {
    fontSize: "clamp(28px, 4.5vw, 40px)",
    lineHeight: 1.15,
    fontWeight: 700,
    margin: "0 0 14px",
    maxWidth: "20ch",
  },
  heroText: { fontSize: 17, color: C.muted, maxWidth: "56ch", margin: 0 },
  h2: { fontSize: 20, margin: "0 0 16px" },
  h3: { fontSize: 16, margin: 0 },
  upload: {
    background: C.surface,
    border: `1px solid ${C.line}`,
    borderRadius: 8,
    padding: 28,
    marginTop: 36,
  },
  drop: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 6,
    textAlign: "center",
    padding: "36px 20px",
    border: "2px dashed #b9bfc5",
    borderRadius: 8,
    background: "#fafbfb",
    transition: "border-color 0.15s, background 0.15s",
  },
  dropOver: { borderColor: C.blue, background: "#eef5fc" },
  dropHasFile: { borderStyle: "solid", borderColor: C.line },
  hint: { color: C.muted, fontSize: 14 },
  fileName: { wordBreak: "break-all" },
  ok: { color: C.greenDark, fontWeight: 600, fontSize: 14 },
  bad: { color: C.red, fontWeight: 600, fontSize: 14, maxWidth: "48ch" },
  samples: { marginTop: 24 },
  samplesTitle: { fontSize: 14, color: C.muted, marginBottom: 10 },
  sampleRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
    padding: "10px 0",
    borderTop: `1px solid ${C.line}`,
  },
  sampleLabel: { flex: "0 0 190px", fontSize: 14, fontWeight: 600 },
  chips: { display: "flex", flexWrap: "wrap", gap: 8, flex: 1 },
  chip: {
    font: "inherit",
    fontSize: 13,
    fontWeight: 600,
    padding: "5px 14px",
    borderRadius: 999,
    border: "1px solid",
    cursor: "pointer",
  },
  kindSet: {
    margin: "20px 0 0",
    padding: 0,
    border: 0,
    display: "flex",
    flexWrap: "wrap",
    gap: 10,
  },
  kindLegend: { fontSize: 14, color: C.muted, padding: 0, marginBottom: 8 },
  kindLabel: {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    padding: "8px 14px",
    border: `1px solid ${C.line}`,
    borderRadius: 999,
    fontSize: 14,
    cursor: "pointer",
  },
  actions: { display: "flex", justifyContent: "flex-end", marginTop: 24 },
  section: { marginTop: 48 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 20,
  },
  card: {
    background: C.surface,
    border: `1px solid ${C.line}`,
    borderRadius: 8,
    padding: 22,
  },
  cardHead: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 10,
  },
  pill: {
    flexShrink: 0,
    fontSize: 13,
    fontWeight: 600,
    padding: "3px 10px",
    borderRadius: 999,
  },
  cardText: { margin: "0 0 10px", fontSize: 15 },
  cardFormat: { margin: 0, color: C.muted, fontSize: 13 },
  ol: { margin: 0, paddingLeft: 22, maxWidth: "60ch" },
  li: { marginBottom: 8 },
  foot: {
    display: "flex",
    justifyContent: "center",
    gap: 28,
    padding: 16,
    fontSize: 13,
    color: C.muted,
    borderTop: `1px solid ${C.line}`,
    background: C.surface,
  },
  dot: {
    display: "inline-block",
    width: 9,
    height: 9,
    borderRadius: "50%",
    marginRight: 6,
  },
};

/** Rounded pill button with hover and disabled states (inline styles can't use :hover). */
function PillButton(props: {
  color: string;
  hover: string;
  big?: boolean;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  const [hover, setHover] = useState(false);
  const { color, hover: hoverColor, big, disabled, onClick, children } = props;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        font: "inherit",
        fontSize: 14,
        fontWeight: 600,
        color: "#fff",
        border: 0,
        borderRadius: 999,
        padding: big ? "12px 34px" : "10px 26px",
        marginTop: big ? 0 : 12,
        cursor: disabled ? "not-allowed" : "pointer",
        background: disabled ? "#c3c8cc" : hover ? hoverColor : color,
        transition: "background 0.15s",
      }}
    >
      {children}
    </button>
  );
}

export default function HomePage() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState("");
  const [content, setContent] = useState("");
  const [detected, setDetected] = useState<Detected | null>(null);
  const [kind, setKind] = useState<InputKind | null>(null);
  const [dragging, setDragging] = useState(false);
  const [samples, setSamples] = useState<Record<SampleKind, string[]>>({ cp: [], mul: [] });
  const [sampleError, setSampleError] = useState(false);
  const [selected, setSelected] = useState("");

  // GET /api/files/cp and /api/files/mul -> list of file names (cp_01.txt ...)
  useEffect(() => {
    Promise.all(
      SAMPLE_GROUPS.map((g) =>
        fetch(`${API}/api/files/${g.kind}`).then((r) => {
          if (!r.ok) throw new Error();
          return r.json() as Promise<string[]>;
        })
      )
    )
      .then(([cp, mul]) => setSamples({ cp, mul }))
      .catch(() => setSampleError(true));
  }, []);

  const load = (name: string, text: string) => {
    const d = detect(text);
    setFileName(name);
    setContent(text);
    setDetected(d);
    setKind(d.kind);
  };

  const readFile = async (file: File | undefined) => {
    if (!file) return;
    setSelected("");
    load(file.name, await file.text());
  };

  const onPick = (e: ChangeEvent<HTMLInputElement>) => readFile(e.target.files?.[0]);

  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragging(false);
    readFile(e.dataTransfer.files?.[0]);
  };

  // GET /api/files/:kind/:name -> plain text of that sample
  const pickSample = async (kind: SampleKind, name: string) => {
    const res = await fetch(`${API}/api/files/${kind}/${name}`);
    if (!res.ok) return;
    setSelected(`${kind}/${name}`);
    load(name, await res.text());
  };

  const run = () => {
    if (!kind) return;
    const state: RunState = { fileName, content, kind };
    navigate("/visualize", { state });
  };

  return (
    <div style={S.page}>
      <header style={S.bar}>Divide and Conquer Visualizer</header>

      <main style={S.main}>
        <section>
          <h1 style={S.h1}>See how divide and conquer actually works</h1>
          <p style={S.heroText}>
            Upload an input file and watch two classic algorithms solve it step
            by step: every split, every comparison, every merge.
          </p>
        </section>

        <section style={S.upload} aria-labelledby="upload-h">
          <h2 id="upload-h" style={S.h2}>Choose an input file</h2>

          <div
            style={{
              ...S.drop,
              ...(fileName ? S.dropHasFile : {}),
              ...(dragging ? S.dropOver : {}),
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
          >
            <input
              ref={inputRef}
              type="file"
              accept=".txt,text/plain"
              onChange={onPick}
              hidden
            />
            {fileName ? (
              <>
                <strong style={S.fileName}>{fileName}</strong>
                <span style={detected?.kind ? S.ok : S.bad}>{detected?.summary}</span>
              </>
            ) : (
              <>
                <strong>Drop a .txt file here</strong>
                <span style={S.hint}>or pick one from your computer</span>
              </>
            )}
            <PillButton
              color={C.blue}
              hover={C.blueDark}
              onClick={() => inputRef.current?.click()}
            >
              {fileName ? "Choose a different file" : "Browse files"}
            </PillButton>
          </div>

          <div style={S.samples}>
            <div style={S.samplesTitle}>Or choose one of the sample files</div>
            {sampleError && (
              <p style={S.bad}>
                Couldn’t load the samples. Check that the backend is running on {API}.
              </p>
            )}
            {!sampleError &&
              SAMPLE_GROUPS.map((g) => (
                <div key={g.kind} style={S.sampleRow}>
                  <span style={S.sampleLabel}>{g.label}</span>
                  <div style={S.chips}>
                    {samples[g.kind].map((name) => {
                      const id = `${g.kind}/${name}`;
                      const on = selected === id;
                      const n = name.match(/\d+/);
                      return (
                        <button
                          key={id}
                          type="button"
                          title={name}
                          aria-pressed={on}
                          onClick={() => pickSample(g.kind, name)}
                          style={{
                            ...S.chip,
                            borderColor: g.accent,
                            background: on ? g.accent : g.tint,
                            color: on ? "#fff" : g.accent,
                          }}
                        >
                          Sample {n ? Number(n[0]) : name}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
          </div>

          {detected?.kind && (
            <fieldset style={S.kindSet}>
              <legend style={S.kindLegend}>Algorithm to run</legend>
              {ALGORITHMS.map((a) => {
                const available = detected.kind === a.key;
                return (
                  <label
                    key={a.key}
                    style={{
                      ...S.kindLabel,
                      opacity: available ? 1 : 0.5,
                      cursor: available ? "pointer" : "not-allowed",
                      ...(kind === a.key
                        ? { borderColor: C.blue, background: "#eef5fc" }
                        : {}),
                    }}
                  >
                    <input
                      type="radio"
                      name="kind"
                      checked={kind === a.key}
                      onChange={() => setKind(a.key)}
                      disabled={!available}
                    />
                    {a.title}
                  </label>
                );
              })}
            </fieldset>
          )}

          <div style={S.actions}>
            <PillButton
              big
              color={C.green}
              hover={C.greenDark}
              disabled={!kind}
              onClick={run}
            >
              Run and visualize
            </PillButton>
          </div>
        </section>

        <section style={S.section} aria-labelledby="algos-h">
          <h2 id="algos-h" style={S.h2}>The two algorithms</h2>
          <div style={S.grid}>
            {ALGORITHMS.map((a) => (
              <article key={a.key} style={S.card}>
                <div style={S.cardHead}>
                  <h3 style={S.h3}>{a.title}</h3>
                  <span style={{ ...S.pill, background: a.tint, color: a.tintInk }}>
                    {a.complexity}
                  </span>
                </div>
                <p style={S.cardText}>{a.text}</p>
                <p style={S.cardFormat}>{a.format}</p>
              </article>
            ))}
          </div>
        </section>

        <section style={S.section} aria-labelledby="how-h">
          <h2 id="how-h" style={S.h2}>How it works</h2>
          <ol style={S.ol}>
            <li style={S.li}>Upload a file, or pick one of the samples.</li>
            <li style={S.li}>The backend runs the algorithm and records each step.</li>
            <li style={S.li}>
              The next page plays the steps back. Use Play, Previous and Next to
              move through them.
            </li>
          </ol>
        </section>
      </main>

      <footer style={S.foot}>
        <span>
          <i style={{ ...S.dot, background: C.green }} />
          Closest pair
        </span>
        <span>
          <i style={{ ...S.dot, background: C.blue }} />
          Multiplication
        </span>
      </footer>
    </div>
  );
}