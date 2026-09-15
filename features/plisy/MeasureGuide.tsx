"use client";

// Animated measuring tutorial for plisy - the "Pomiar" instruction step and
// the configurator's "Jak mierzyć?" popup share it.
//
// v2 (2026-09-16). v1 drew everything at once - two dimension lines, a
// magnifier and four labels on screen together - and the owner's verdict
// was "trochę nasrane ... myślałem że te miarki weźmiesz jakoś płynnie
// rozwijane ... zajebista animacja jak mierzyć - instrukcja wręcz". So this
// is a tutorial, one thing at a time:
//
//   1. find the point   - magnifier on the corner, then it gets out of the way
//   2. width            - a real tape: hook lands on the first point, the
//                         case is pulled to the other point, the blade
//                         unrolls with cm ticks, the reading counts up
//   3. height           - same tape, turned down the sash
//   4. type it in       - both readings, in mm, as you'd type them
//
// A step strip under the stage names the current step. Everything is one
// requestAnimationFrame timeline (positions derived from elapsed time), so
// captions, tape, reading and magnifier can't drift apart. Restart =
// rerun the timeline. prefers-reduced-motion = final frame.
//
// Two mounting systems, two measurements (owner, 2026-09-16):
//   STANDARD (wkręcany przy szybie): width and height from the middle of
//   one seal to the middle of the opposite seal. No deduction.
//   BEZINWAZYJNY (uchwyty na skrzydło): width from the bead/frame line
//   ("kreseczka") to the same line opposite = glass + both beads; height of
//   the whole sash.
import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";

type Mode = "standard" | "bezinwazyjny";

/* Front-view geometry, viewBox 1000 x 800. */
const SASH = { x: 110, y: 40, w: 780, h: 640 };
const FRAME = 64;
const BEAD = 26;
const SEAL = 10;
const K = { x0: SASH.x + FRAME, x1: SASH.x + SASH.w - FRAME, y0: SASH.y + FRAME, y1: SASH.y + SASH.h - FRAME };
const B = { x0: K.x0 + BEAD, x1: K.x1 - BEAD, y0: K.y0 + BEAD, y1: K.y1 - BEAD };
const G = { x0: B.x0 + SEAL, x1: B.x1 - SEAL, y0: B.y0 + SEAL, y1: B.y1 - SEAL };
const M = { x0: B.x0 + SEAL / 2, x1: B.x1 - SEAL / 2, y0: B.y0 + SEAL / 2, y1: B.y1 - SEAL / 2 };

/* Where the tape runs: across the glass at a third of the height, down the
 * glass a third of the way in - so the two never overlap. */
const TAPE_W_Y = 300;
const TAPE_H_X = 300;

const LUPA = { cx: 690, cy: 500, r: 140, zoom: 2.8, off: -34 };

type Spec = {
  label: string;
  sub: string;
  target: { x: number; y: number };
  targetName: string;
  width: { from: number; to: number; mm: number; how: string };
  height: { from: number; to: number; mm: number; how: string };
  note: string;
};

const MODES: Record<Mode, Spec> = {
  standard: {
    label: "STANDARD",
    sub: "wkręcany przy szybie",
    target: { x: M.x0, y: M.y0 },
    targetName: "połowa uszczelki",
    width: { from: M.x0, to: M.x1, mm: 620, how: "od połowy uszczelki do połowy uszczelki" },
    height: { from: M.y0, to: M.y1, mm: 1180, how: "od połowy uszczelki do połowy uszczelki" },
    note: "Nic nie odejmuj — połowa uszczelki z każdej strony to dokładnie luz, którego potrzebuje profil, żeby wejść między listwy.",
  },
  bezinwazyjny: {
    label: "BEZINWAZYJNY",
    sub: "uchwyty na skrzydło",
    target: { x: K.x0, y: K.y0 },
    targetName: "kreseczka",
    width: { from: K.x0, to: K.x1, mm: 690, how: "od kreseczki do kreseczki — szyba razem z listwami" },
    height: { from: SASH.y, to: SASH.y + SASH.h, mm: 1320, how: "całe skrzydło, od góry do dołu ramy" },
    note: "Kreseczka to cienka linia, w której listwa przyszybowa łączy się z ramą skrzydła. Nic nie odejmuj; zostaw 5 mm od klamki.",
  },
};

/* ---- timeline (ms) ---- */
const T = {
  sash: [0, 500],
  lupaIn: [500, 1000],
  lupaOut: [2600, 3000],
  wHook: [3000, 3500], // tape appears, hook lands on the first point
  wPull: [3500, 5300], // case pulled across, blade unrolls, reading counts
  wSettle: [5300, 6000],
  hMove: [6000, 6600], // tape relocates to the top point
  hPull: [6600, 8400],
  hSettle: [8400, 9100],
  done: [9100, 10000],
} as const;
const TOTAL = 10000;

const STEPS = [
  { id: 1, label: "Znajdź punkt", from: 0 },
  { id: 2, label: "Szerokość", from: T.wHook[0] },
  { id: 3, label: "Wysokość", from: T.hMove[0] },
  { id: 4, label: "Wpisz w mm", from: T.done[0] },
];

function seg(t: number, [a, b]: readonly [number, number]): number {
  if (t <= a) return 0;
  if (t >= b) return 1;
  return (t - a) / (b - a);
}
function easeOut(x: number): number {
  return 1 - Math.pow(1 - x, 3);
}
function easeInOut(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}
/** A pull that lands with a small overshoot and settles - how a blade stops
 * when the hook catches. */
function pull(x: number): number {
  if (x >= 1) return 1;
  const c1 = 1.4;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

/* ---- tape measure ---- */
const CASE_W = 78;
const CASE_H = 56;
const BLADE_T = 20;

function Tape({
  x,
  y,
  len,
  vertical,
  reading,
  opacity,
}: {
  x: number;
  y: number;
  len: number;
  vertical: boolean;
  reading: number | null;
  opacity: number;
}) {
  const ticks: React.ReactNode[] = [];
  for (let i = 10; i < len; i += 10) {
    const tall = i % 50 === 0;
    ticks.push(<line key={i} x1={i} y1={-BLADE_T / 2 + 1} x2={i} y2={-BLADE_T / 2 + (tall ? 9 : 5)} stroke="#111827" strokeWidth={tall ? 1.4 : 0.9} />);
    if (tall) {
      ticks.push(
        <text
          key={`n${i}`}
          x={i}
          y={BLADE_T / 2 - 3}
          textAnchor="middle"
          fontSize="8.5"
          fontWeight="700"
          fill="#111827"
          transform={vertical ? `rotate(-90 ${i} ${BLADE_T / 2 - 3})` : undefined}
        >
          {i / 10}
        </text>,
      );
    }
  }
  return (
    <g transform={`translate(${x} ${y})${vertical ? " rotate(90)" : ""}`} opacity={opacity}>
      <rect x={0} y={-BLADE_T / 2} width={Math.max(0, len)} height={BLADE_T} fill="#fcd34d" stroke="#b45309" strokeWidth="1" />
      <g>{ticks}</g>
      {/* hook, fixed on the first point */}
      <path d={`M-7 ${-BLADE_T / 2 - 4} h8 v${BLADE_T + 8} h-8 v-5 h3 v${-BLADE_T + 2} h-3 z`} fill="#9ca3af" stroke="#374151" strokeWidth="1" />
      {/* case, pulled to the second point */}
      <g transform={`translate(${len} 0)`}>
        <rect x={0} y={-CASE_H / 2} width={CASE_W} height={CASE_H} rx="12" fill="#facc15" stroke="#a16207" strokeWidth="1.5" />
        <rect x={0} y={-CASE_H / 2} width={CASE_W} height={CASE_H} rx="12" fill="url(#plmgCaseShade)" />
        <path d={`M${CASE_W * 0.42} ${-CASE_H / 2} h${CASE_W * 0.58 - 12} a12 12 0 0 1 12 12 v${CASE_H - 24} a12 12 0 0 1 -12 12 h${-(CASE_W * 0.58 - 12)} z`} fill="#1f2937" opacity="0.92" />
        <rect x={CASE_W * 0.5} y={-6} width={22} height={12} rx="6" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
        <rect x={6} y={CASE_H / 2 - 9} width={22} height={5} rx="2.5" fill="#a16207" opacity="0.6" />
        {reading !== null ? (
          <g transform={vertical ? `translate(${CASE_W / 2} ${-CASE_H / 2 - 34}) rotate(-90)` : `translate(${CASE_W / 2} ${-CASE_H / 2 - 34})`}>
            <rect x={-50} y={-17} width={100} height={34} rx="8" fill="#0e1a2a" />
            <text x={0} y={6} textAnchor="middle" fill="#ffc45c" fontSize="19" fontWeight="900" style={{ fontVariantNumeric: "tabular-nums" }}>
              {reading} mm
            </text>
          </g>
        ) : null}
      </g>
    </g>
  );
}

/* Result chip that stays once a dimension is measured. */
function Chip({ x, y, label, mm, opacity }: { x: number; y: number; label: string; mm: number; opacity: number }) {
  if (opacity <= 0.01) return null;
  return (
    <g opacity={opacity}>
      <rect x={x - 96} y={y - 19} width={192} height={38} rx="9" fill="#0e1a2a" />
      <text x={x - 84} y={y + 6} fill="#ffc45c" fontSize="15" fontWeight="800">
        {label}
      </text>
      <text x={x + 84} y={y + 6} textAnchor="end" fill="#e2ecf8" fontSize="16" fontWeight="900" style={{ fontVariantNumeric: "tabular-nums" }}>
        {mm} mm
      </text>
    </g>
  );
}

export default function PlisyMeasureGuide() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ID = { clip: `plmgClip${uid}`, shadow: `plmgShadow${uid}`, sheen: `plmgSheen${uid}` };

  const [mode, setMode] = useState<Mode>("standard");
  const [run, setRun] = useState(0);
  const [t, setT] = useState(0);
  const m = MODES[mode];

  const reduced = useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const e = Math.min(TOTAL, now - start);
      setT(reduced ? TOTAL : e);
      if (e < TOTAL && !reduced) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [mode, run, reduced]);

  /* ---- derive the frame from t ---- */
  const sashO = easeOut(seg(t, T.sash));
  const lupaS = easeOut(seg(t, T.lupaIn)) * (1 - easeInOut(seg(t, T.lupaOut)));

  const wLen = m.width.to - m.width.from;
  const hLen = m.height.to - m.height.from;

  const wO = easeOut(seg(t, T.wHook)) * (1 - easeInOut(seg(t, T.hMove)));
  const wP = pull(seg(t, T.wPull));
  const wBlade = wLen * wP;
  const wReading = t >= T.wPull[0] ? Math.round(m.width.mm * Math.min(1, wP)) : null;
  const wChipO = easeOut(seg(t, T.wSettle));

  const hO = easeOut(seg(t, T.hMove));
  const hP = pull(seg(t, T.hPull));
  const hBlade = hLen * hP;
  const hReading = t >= T.hPull[0] ? Math.round(m.height.mm * Math.min(1, hP)) : null;
  const hChipO = easeOut(seg(t, T.hSettle));

  const doneO = easeOut(seg(t, T.done));

  const stepIndex = STEPS.reduce((acc, s, i) => (t >= s.from ? i : acc), 0);
  const caption =
    stepIndex === 0
      ? `Znajdź punkt pomiaru: ${m.targetName}`
      : stepIndex === 1
        ? `Szerokość: ${m.width.how}`
        : stepIndex === 2
          ? `Wysokość: ${m.height.how}`
          : "Wpisz oba wymiary w milimetrach w konfiguratorze";

  // Magnifier maths.
  const z = LUPA.zoom;
  const TX = LUPA.cx + LUPA.off;
  const TY = LUPA.cy + LUPA.off;
  const lx = (x: number) => TX + (x - m.target.x) * z;
  const ly = (y: number) => TY + (y - m.target.y) * z;

  const showW = t >= T.wHook[0] && t < T.hMove[1];
  const showH = t >= T.hMove[0];

  return (
    <div className="plmg">
      <div className="plmg-modes" role="tablist" aria-label="Sposób montażu">
        {(Object.keys(MODES) as Mode[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={mode === key}
            className={`plmg-mode ${mode === key ? "is-active" : ""}`}
            onClick={() => {
              setMode(key);
              setRun((r) => r + 1);
            }}
          >
            <strong>{MODES[key].label}</strong>
            <span>{MODES[key].sub}</span>
          </button>
        ))}
      </div>

      <div className="plmg-stage">
        <svg viewBox="0 0 1000 800" className="plmg-svg" role="img" aria-label={`Pomiar plisy, montaż ${m.label}: szerokość ${m.width.how}, wysokość ${m.height.how}`}>
          <defs>
            <clipPath id={ID.clip}>
              <circle cx={LUPA.cx} cy={LUPA.cy} r={LUPA.r} />
            </clipPath>
            <filter id={ID.shadow} x="-15%" y="-15%" width="130%" height="130%">
              <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#0b1a2b" floodOpacity="0.28" />
            </filter>
            <linearGradient id={ID.sheen} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="45%" stopColor="#fff" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id="plmgCaseShade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
              <stop offset="60%" stopColor="#fff" stopOpacity="0" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.18" />
            </linearGradient>
          </defs>

          {/* sash */}
          <g opacity={sashO}>
            <rect x={SASH.x} y={SASH.y} width={SASH.w} height={SASH.h} rx="8" fill="#f7f9fb" stroke="#c9d2db" strokeWidth="2" />
            <rect x={K.x0} y={K.y0} width={K.x1 - K.x0} height={K.y1 - K.y0} fill="#e6ebf0" stroke="#7f8b96" strokeWidth="2.2" />
            <rect x={B.x0} y={B.y0} width={B.x1 - B.x0} height={B.y1 - B.y0} fill="#2b3138" />
            <rect x={G.x0} y={G.y0} width={G.x1 - G.x0} height={G.y1 - G.y0} fill="#cfe4f5" />
            <rect x={G.x0} y={G.y0} width={G.x1 - G.x0} height={G.y1 - G.y0} fill={`url(#${ID.sheen})`} opacity="0.6" />
            <rect x={SASH.x + 18} y={SASH.y + SASH.h / 2 - 40} width="16" height="80" rx="8" fill="#e6ebf0" stroke="#aeb9c4" strokeWidth="1.5" />
          </g>

          {/* the two points of the dimension being measured now */}
          {stepIndex === 1 || stepIndex === 2 ? (
            <g opacity={stepIndex === 1 ? wO : hO}>
              {stepIndex === 1 ? (
                <>
                  <line x1={m.width.from} y1={TAPE_W_Y - 30} x2={m.width.from} y2={TAPE_W_Y + 30} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5 4" />
                  <line x1={m.width.to} y1={TAPE_W_Y - 30} x2={m.width.to} y2={TAPE_W_Y + 30} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5 4" />
                </>
              ) : (
                <>
                  <line x1={TAPE_H_X - 30} y1={m.height.from} x2={TAPE_H_X + 30} y2={m.height.from} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5 4" />
                  <line x1={TAPE_H_X - 30} y1={m.height.to} x2={TAPE_H_X + 30} y2={m.height.to} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5 4" />
                </>
              )}
            </g>
          ) : null}

          {/* result chips stay after each measurement */}
          <Chip x={m.width.from + wLen / 2} y={TAPE_W_Y - 62} label="Szerokość" mm={m.width.mm} opacity={wChipO * (1 - doneO)} />
          <Chip x={TAPE_H_X + 150} y={m.height.from + hLen * 0.6} label="Wysokość" mm={m.height.mm} opacity={hChipO * (1 - doneO)} />

          {/* the tape: width, then height */}
          {showW ? <Tape x={m.width.from} y={TAPE_W_Y} len={wBlade} vertical={false} reading={wReading} opacity={wO} /> : null}
          {showH ? <Tape x={TAPE_H_X} y={m.height.from} len={hBlade} vertical reading={hReading} opacity={hO} /> : null}

          {/* magnifier - step 1 only, then it leaves */}
          {lupaS > 0.01 ? (
            <g opacity={lupaS} transform={`translate(${LUPA.cx} ${LUPA.cy}) scale(${0.6 + 0.4 * lupaS}) translate(${-LUPA.cx} ${-LUPA.cy})`}>
              <line x1={m.target.x} y1={m.target.y} x2={LUPA.cx - LUPA.r * 0.72} y2={LUPA.cy - LUPA.r * 0.72} stroke="#0e1a2a" strokeWidth="2.5" strokeDasharray="6 5" />
              <circle cx={m.target.x} cy={m.target.y} r="9" fill="none" stroke="#ef4444" strokeWidth="3" />
              <circle cx={LUPA.cx} cy={LUPA.cy} r={LUPA.r + 6} fill="#0e1a2a" filter={`url(#${ID.shadow})`} />
              <g clipPath={`url(#${ID.clip})`}>
                <rect x={lx(SASH.x - 400)} y={ly(SASH.y - 400)} width={2000} height={2000} fill="#f7f9fb" />
                <rect x={lx(K.x0)} y={ly(K.y0)} width={2000} height={2000} fill="#e6ebf0" stroke="#7f8b96" strokeWidth={2.2 * z} />
                <rect x={lx(B.x0)} y={ly(B.y0)} width={2000} height={2000} fill="#2b3138" />
                <rect x={lx(G.x0)} y={ly(G.y0)} width={2000} height={2000} fill="#cfe4f5" />
                <text x={lx(SASH.x + FRAME / 2)} y={LUPA.cy + 40} textAnchor="middle" fill="#334155" fontSize="13" fontWeight="700" transform={`rotate(-90 ${lx(SASH.x + FRAME / 2)} ${LUPA.cy + 40})`}>
                  RAMA
                </text>
                <text x={lx(K.x0 + BEAD / 2)} y={LUPA.cy + 46} textAnchor="middle" fill="#334155" fontSize="12" fontWeight="700" transform={`rotate(-90 ${lx(K.x0 + BEAD / 2)} ${LUPA.cy + 46})`}>
                  LISTWA
                </text>
                <text x={lx(B.x0 + SEAL / 2)} y={LUPA.cy + 40} textAnchor="middle" fill="#f8fafc" fontSize="11" fontWeight="700" transform={`rotate(-90 ${lx(B.x0 + SEAL / 2)} ${LUPA.cy + 40})`}>
                  USZCZELKA
                </text>
                <text x={lx(G.x0) + 28} y={LUPA.cy + 100} textAnchor="middle" fill="#1e3a5f" fontSize="13" fontWeight="800">
                  SZYBA
                </text>
                <circle cx={TX} cy={TY} r={18 + 8 * Math.abs(Math.sin(t / 260))} fill="none" stroke="#ef4444" strokeWidth="3" opacity="0.8" />
                <circle cx={TX} cy={TY} r="6" fill="#ef4444" />
                {mode === "standard" ? (
                  <line x1={lx(B.x0)} y1={TY} x2={lx(G.x0)} y2={TY} stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
                ) : (
                  <line x1={TX} y1={TY - 60} x2={TX} y2={TY + 110} stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
                )}
              </g>
              <circle cx={LUPA.cx} cy={LUPA.cy} r={LUPA.r} fill="none" stroke="#0e1a2a" strokeWidth="6" />
              <rect x={LUPA.cx - 118} y={LUPA.cy + LUPA.r - 6} width="236" height="34" rx="8" fill="#ef4444" />
              <text x={LUPA.cx} y={LUPA.cy + LUPA.r + 17} textAnchor="middle" fill="#fff" fontSize="14" fontWeight="800">
                MIERZ TU: {m.targetName.toUpperCase()}
              </text>
            </g>
          ) : null}

          {/* finale */}
          {doneO > 0.01 ? (
            <g opacity={doneO} transform={`translate(0 ${(1 - doneO) * 20})`}>
              <rect x="250" y="330" width="500" height="150" rx="16" fill="#0e1a2a" filter={`url(#${ID.shadow})`} />
              <text x="500" y="372" textAnchor="middle" fill="#e2ecf8" fontSize="17" fontWeight="700">
                Wpisz w konfiguratorze (mm)
              </text>
              <rect x="285" y="392" width="200" height="60" rx="10" fill="rgba(255,255,255,0.06)" stroke="#ffc45c" strokeWidth="1.5" />
              <text x="385" y="415" textAnchor="middle" fill="#ffc45c" fontSize="12" fontWeight="800">
                SZEROKOŚĆ
              </text>
              <text x="385" y="441" textAnchor="middle" fill="#fff" fontSize="24" fontWeight="900">
                {m.width.mm}
              </text>
              <rect x="515" y="392" width="200" height="60" rx="10" fill="rgba(255,255,255,0.06)" stroke="#ffc45c" strokeWidth="1.5" />
              <text x="615" y="415" textAnchor="middle" fill="#ffc45c" fontSize="12" fontWeight="800">
                WYSOKOŚĆ
              </text>
              <text x="615" y="441" textAnchor="middle" fill="#fff" fontSize="24" fontWeight="900">
                {m.height.mm}
              </text>
              <text x="500" y="470" textAnchor="middle" fill="#9fb3c8" fontSize="11.5" fontWeight="600">
                wartości przykładowe — u Ciebie będą inne
              </text>
            </g>
          ) : null}
        </svg>

        <button type="button" className="plmg-replay" onClick={() => setRun((r) => r + 1)} aria-label="Odtwórz animację ponownie">
          ↻ Odtwórz
        </button>
      </div>

      <div className="plmg-steps" aria-live="polite">
        <ol className="plmg-steps-list">
          {STEPS.map((s, i) => (
            <li key={s.id} className={i === stepIndex ? "is-active" : i < stepIndex ? "is-done" : ""}>
              <span className="plmg-step-num">{s.id}</span>
              <span className="plmg-step-label">{s.label}</span>
            </li>
          ))}
        </ol>
        <p className="plmg-caption">{caption}</p>
      </div>

      <p className="plmg-note">{m.note}</p>
    </div>
  );
}
