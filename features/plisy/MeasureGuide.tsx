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

export type MeasureMode = "standard" | "bezinwazyjny";
type Mode = MeasureMode;

/** Maps a CRM mount option id/label to the guide's mode. The CRM ids are
 * "przyszybowy-inwazyjny", "Bezinwazyjny PCV", "bezinwazyjny Sztywny". */
export function measureModeForMount(mountIdOrLabel: string | null | undefined): MeasureMode {
  return /bezinwazyjn/i.test(String(mountIdOrLabel || "")) ? "bezinwazyjny" : "standard";
}

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
  width: { from: number; to: number; mm: number; how: string; a: string; b: string };
  height: { from: number; to: number; mm: number; how: string; a: string; b: string };
  note: string;
};

const MODES: Record<Mode, Spec> = {
  standard: {
    label: "PRZYKRĘCANY DO LISTWY",
    sub: "wkręty w listwę przyszybową, bez wiertarki",
    target: { x: M.x0, y: M.y0 },
    targetName: "połowa uszczelki",
    width: { from: M.x0, to: M.x1, mm: 620, how: "od połowy uszczelki do połowy uszczelki", a: "od połowy uszczelki", b: "do połowy uszczelki" },
    height: { from: M.y0, to: M.y1, mm: 1180, how: "od połowy uszczelki do połowy uszczelki", a: "od połowy uszczelki", b: "do połowy uszczelki" },
    note: "Nic nie odejmuj — połowa uszczelki z każdej strony to dokładnie luz, którego potrzebuje profil, żeby wejść między listwy.",
  },
  bezinwazyjny: {
    label: "BEZINWAZYJNY",
    sub: "uchwyty na skrzydło, bez wiercenia",
    target: { x: K.x0, y: K.y0 },
    targetName: "kreseczka",
    width: { from: K.x0, to: K.x1, mm: 690, how: "od kreseczki do kreseczki — szyba razem z listwami", a: "od kreseczki", b: "do kreseczki" },
    height: { from: SASH.y, to: SASH.y + SASH.h, mm: 1320, how: "całe skrzydło, od góry do dołu ramy", a: "od góry ramy", b: "do dołu ramy" },
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
  k = 1,
}: {
  x: number;
  y: number;
  len: number;
  vertical: boolean;
  reading: number | null;
  opacity: number;
  k?: number;
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
          fontSize="10.5"
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
          <g transform={vertical ? `translate(${CASE_W / 2} ${-CASE_H / 2 - 34 * k}) rotate(-90) scale(${k})` : `translate(${CASE_W / 2} ${-CASE_H / 2 - 34 * k}) scale(${k})`}>
            <rect x={-58} y={-19} width={116} height={38} rx="8" fill="#0e1a2a" />
            <text x={0} y={7} textAnchor="middle" fill="#ffc45c" fontSize="22" fontWeight="900" style={{ fontVariantNumeric: "tabular-nums" }}>
              {reading} mm
            </text>
          </g>
        ) : null}
      </g>
    </g>
  );
}

/* Short "od ... / do ..." tag at one end of the tape. */
function EndLabel({ x, y, text, anchor, opacity, k = 1 }: { x: number; y: number; text: string; anchor: "start" | "end"; opacity: number; k?: number }) {
  if (opacity <= 0.01) return null;
  const w = Math.round((text.length * 9.4 + 26) * k);
  const h = 32 * k;
  const rx = anchor === "start" ? x : x - w;
  return (
    <g opacity={opacity}>
      <rect x={rx} y={y - h / 2} width={w} height={h} rx={8 * k} fill="#ef4444" />
      <text x={rx + w / 2} y={y + 6 * k} textAnchor="middle" fill="#fff" fontSize={16.5 * k} fontWeight="800">
        {text}
      </text>
    </g>
  );
}

/* Notepad in the corner: the readings get written in pencil as they land.
 * wWrite / hWrite are 0..1 writing progress per line. Takes the corner the
 * magnifier vacates after step 1. */
const PAD = { x: 662, y: 462, w: 226, h: 176 };
const HAND = '"Segoe Print", "Bradley Hand", "Comic Sans MS", "Chalkboard", cursive';

function Notepad({ opacity, wWrite, hWrite, wmm, hmm, clipId, k = 1 }: { opacity: number; wWrite: number; hWrite: number; wmm: number; hmm: number; clipId: string; k?: number }) {
  if (opacity <= 0.01) return null;
  const textW = 184;
  const w1 = textW * wWrite;
  const w2 = textW * hWrite;
  const writing = (wWrite > 0 && wWrite < 1) || (hWrite > 0 && hWrite < 1);
  const penX = PAD.x + 24 + (hWrite > 0 ? w2 : w1);
  const penY = PAD.y + (hWrite > 0 ? 122 : 88);
  return (
    <g opacity={opacity} transform={`translate(${PAD.x + PAD.w} ${PAD.y + PAD.h}) scale(${k}) translate(${-(PAD.x + PAD.w)} ${-(PAD.y + PAD.h)}) rotate(-4 ${PAD.x + PAD.w / 2} ${PAD.y + PAD.h / 2})`}>
      <rect x={PAD.x + 4} y={PAD.y + 6} width={PAD.w} height={PAD.h} rx="6" fill="#000" opacity="0.18" />
      <rect x={PAD.x} y={PAD.y} width={PAD.w} height={PAD.h} rx="6" fill="#fff8dc" stroke="#d9c58a" strokeWidth="1.5" />
      {[0, 1, 2, 3, 4, 5, 6].map((i) => (
        <g key={i}>
          <circle cx={PAD.x + 24 + i * 30} cy={PAD.y + 8} r="5" fill="none" stroke="#6b7280" strokeWidth="2" />
          <rect x={PAD.x + 21 + i * 30} y={PAD.y - 6} width="6" height="14" rx="3" fill="#9ca3af" />
        </g>
      ))}
      {[62, 96, 130, 164].map((dy) => (
        <line key={dy} x1={PAD.x + 14} y1={PAD.y + dy} x2={PAD.x + PAD.w - 14} y2={PAD.y + dy} stroke="#e5d9b6" strokeWidth="1" />
      ))}
      <text x={PAD.x + 20} y={PAD.y + 44} fill="#374151" fontSize="19" fontWeight="700" style={{ fontFamily: HAND }}>
        Okno — salon
      </text>
      <clipPath id={`${clipId}w`}>
        <rect x={PAD.x + 16} y={PAD.y + 64} width={w1} height={36} />
      </clipPath>
      <clipPath id={`${clipId}h`}>
        <rect x={PAD.x + 16} y={PAD.y + 98} width={w2} height={36} />
      </clipPath>
      <text x={PAD.x + 22} y={PAD.y + 90} fill="#1f2937" fontSize="23" fontWeight="700" style={{ fontFamily: HAND }} clipPath={`url(#${clipId}w)`}>
        szer. {wmm} mm
      </text>
      <text x={PAD.x + 22} y={PAD.y + 124} fill="#1f2937" fontSize="23" fontWeight="700" style={{ fontFamily: HAND }} clipPath={`url(#${clipId}h)`}>
        wys. {hmm} mm
      </text>
      {writing ? (
        <g transform={`translate(${penX} ${penY}) rotate(-38)`}>
          <rect x="0" y="-5" width="70" height="10" rx="2" fill="#fbbf24" stroke="#92400e" strokeWidth="1" />
          <rect x="58" y="-5" width="12" height="10" rx="2" fill="#f87171" />
          <path d="M0 -5 L-12 0 L0 5 z" fill="#f5d0a9" stroke="#92400e" strokeWidth="1" />
          <path d="M-12 0 L-7 -2 L-7 2 z" fill="#1f2937" />
        </g>
      ) : null}
    </g>
  );
}

export default function PlisyMeasureGuide({
  fixedMode,
  initialMode,
  startDelayMs = 900,
  unit = "mm",
}: {
  /** Unit the configurator's fields currently take (cm/mm toggle,
   * 2026-09-17) - step 4 reads "Wpisz w cm" when that's what the field
   * wants, so the guide never tells someone to type mm into a cm field. */
  unit?: "mm" | "cm";
  /** Lock to one mounting system (the configurator already knows which one
   * the customer picked) - hides the mode switch. */
  fixedMode?: MeasureMode;
  /** Wariant, od którego zaczyna przełącznik, gdy nic nie jest zablokowane -
   * link wysłany z konfiguratora niesie montaż w adresie (?montaz=...), więc
   * strona instrukcji otwiera się na tym, co klient wybrał. */
  initialMode?: MeasureMode;
  /** Pause after the guide scrolls/opens into view before the tape moves,
   * so the eye finds the window first (owner, 2026-09-16). */
  startDelayMs?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ID = { clip: `plmgClip${uid}`, shadow: `plmgShadow${uid}`, sheen: `plmgSheen${uid}`, pad: `plmgPad${uid}` };

  const [pickedMode, setPickedMode] = useState<Mode>(initialMode ?? "standard");
  const mode: Mode = fixedMode ?? pickedMode;
  const [run, setRun] = useState(0);
  const [t, setT] = useState(0);
  const m = MODES[mode];

  // The timeline waits until the stage is actually on screen: inside a
  // closed <details> or below the fold nothing plays, so the visitor never
  // opens the step to find the tape already parked at the end.
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [armed, setArmed] = useState(false);

  // Phone-sized stage: the SVG lands at ~45% of its viewBox, so labels drawn
  // for desktop shrink to ~7 px. Below 560 px everything the eye has to read
  // (end labels, reading, notepad, magnifier) is drawn 1.5x bigger, and the
  // two width labels are staggered above/below the tape so they fit.
  const [narrow, setNarrow] = useState(false);
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width || 0;
      setNarrow(w > 0 && w < 560);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const k = narrow ? 1.5 : 1;
  // On a phone the height tape runs down the right half of the glass and its
  // labels sit to the LEFT of it - the notepad owns the bottom-right corner.
  const hx = narrow ? 560 : TAPE_H_X;
  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      const id = window.setTimeout(() => setArmed(true), 0);
      return () => window.clearTimeout(id);
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.4)) {
          setArmed(true);
          io.disconnect();
        }
      },
      { threshold: [0.4] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

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
    if (!armed) return;
    if (reduced) {
      const id = window.setTimeout(() => setT(TOTAL), 0);
      return () => window.clearTimeout(id);
    }
    let start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const e = Math.min(TOTAL, now - start);
      setT(e);
      if (e < TOTAL) rafRef.current = requestAnimationFrame(tick);
    };
    // A replay is deliberate, so it starts almost at once; the first play
    // after opening waits for the eye.
    const reset = window.setTimeout(() => setT(0), 0);
    const delay = window.setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick);
    }, run > 0 ? 250 : startDelayMs);
    return () => {
      window.clearTimeout(reset);
      window.clearTimeout(delay);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [armed, mode, run, reduced, startDelayMs]);

  /* ---- derive the frame from t ---- */
  const sashO = armed ? easeOut(seg(t, T.sash)) : 1;
  const lupaS = easeOut(seg(t, T.lupaIn)) * (1 - easeInOut(seg(t, T.lupaOut)));

  const wLen = m.width.to - m.width.from;
  const hLen = m.height.to - m.height.from;

  const wO = easeOut(seg(t, T.wHook)) * (1 - easeInOut(seg(t, T.hMove)));
  const wP = pull(seg(t, T.wPull));
  const wBlade = wLen * wP;
  const wReading = t >= T.wPull[0] ? Math.round(m.width.mm * Math.min(1, wP)) : null;
  const wWrite = easeInOut(seg(t, T.wSettle));

  const hO = easeOut(seg(t, T.hMove));
  const hP = pull(seg(t, T.hPull));
  const hBlade = hLen * hP;
  const hReading = t >= T.hPull[0] ? Math.round(m.height.mm * Math.min(1, hP)) : null;
  const hWrite = easeInOut(seg(t, T.hSettle));
  const padO = easeOut(seg(t, [T.lupaOut[1], T.lupaOut[1] + 400] as const));


  const stepIndex = STEPS.reduce((acc, s, i) => (t >= s.from ? i : acc), 0);
  const caption =
    stepIndex === 0
      ? `Znajdź punkt pomiaru: ${m.targetName}`
      : stepIndex === 1
        ? `Szerokość: ${m.width.how}`
        : stepIndex === 2
          ? `Wysokość: ${m.height.how}`
          : "Przepisz wymiary z notatnika do konfiguratora — w milimetrach";

  // Magnifier maths.
  const z = LUPA.zoom;
  // Narrow: the target sits further up-left inside the circle so the whole
  // frame -> bead -> seal -> glass run fits (the lens is 1.25x there).
  const off = narrow ? -62 : LUPA.off;
  const TX = LUPA.cx + off;
  const TY = LUPA.cy + off;
  const lx = (x: number) => TX + (x - m.target.x) * z;
  const ly = (y: number) => TY + (y - m.target.y) * z;

  const showW = t >= T.wHook[0] && t < T.hMove[1];
  const showH = t >= T.hMove[0];

  return (
    <div className="plmg">
      {fixedMode ? (
        <p className="plmg-fixed">
          Montaż <strong>{m.label}</strong> — {m.sub}
        </p>
      ) : (
        <div className="plmg-modes" role="tablist" aria-label="Sposób montażu">
          {(Object.keys(MODES) as Mode[]).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={mode === key}
              className={`plmg-mode ${mode === key ? "is-active" : ""}`}
              onClick={() => {
                setPickedMode(key);
                setRun((r) => r + 1);
              }}
            >
              <strong>{MODES[key].label}</strong>
              <span>{MODES[key].sub}</span>
            </button>
          ))}
        </div>
      )}

      <div className="plmg-stage" ref={stageRef}>
        <svg viewBox="70 20 860 756" className="plmg-svg" role="img" aria-label={`Pomiar plisy, montaż ${m.label}: szerokość ${m.width.how}, wysokość ${m.height.how}`}>
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
            <rect x={K.x0} y={K.y0} width={K.x1 - K.x0} height={K.y1 - K.y0} fill="#f7f9fb" stroke="#8a95a0" strokeWidth="2.2" />
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
                  <line x1={hx - 30} y1={m.height.from} x2={hx + 30} y2={m.height.from} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5 4" />
                  <line x1={hx - 30} y1={m.height.to} x2={hx + 30} y2={m.height.to} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5 4" />
                </>
              )}
            </g>
          ) : null}

          {/* "od ... / do ..." at both ends of the current tape */}
          {showW ? (
            <>
              <EndLabel x={m.width.from} y={narrow ? TAPE_W_Y - 46 : TAPE_W_Y + 38} text={m.width.a} anchor="start" opacity={wO} k={k} />
              <EndLabel x={m.width.to} y={narrow ? TAPE_W_Y + 46 : TAPE_W_Y + 38} text={m.width.b} anchor="end" opacity={wO * easeOut(seg(wP, [0.85, 1] as const))} k={k} />
            </>
          ) : null}
          {showH ? (
            <>
              <EndLabel x={narrow ? hx - 40 : hx + 40} y={m.height.from + 4} text={m.height.a} anchor={narrow ? "end" : "start"} opacity={hO} k={k} />
              <EndLabel x={narrow ? hx - 40 : hx + 40} y={m.height.to - 4} text={m.height.b} anchor={narrow ? "end" : "start"} opacity={hO * easeOut(seg(hP, [0.85, 1] as const))} k={k} />
            </>
          ) : null}

          {/* notepad takes the corner the magnifier leaves */}
          <Notepad opacity={padO} wWrite={wWrite} hWrite={hWrite} wmm={m.width.mm} hmm={m.height.mm} clipId={ID.pad} k={narrow ? 1.3 : 1} />

          {/* the tape: width, then height */}
          {showW ? <Tape x={m.width.from} y={TAPE_W_Y} len={wBlade} vertical={false} reading={wReading} opacity={wO} k={k} /> : null}
          {showH ? <Tape x={hx} y={m.height.from} len={hBlade} vertical reading={hReading} opacity={hO} k={k} /> : null}

          {/* magnifier - step 1 only, then it leaves */}
          {lupaS > 0.01 ? (
            <g opacity={lupaS}>
              {/* Corner marker + leader stay in scene coordinates - only the
                  magnifier itself scales (on narrow screens 1.25x), otherwise
                  the marker gets pushed off the sash. */}
              {(() => {
                const sc = (0.6 + 0.4 * lupaS) * (narrow ? 1.25 : 1);
                const edge = LUPA.r * sc * 0.72;
                return (
                  <>
                    <line x1={m.target.x} y1={m.target.y} x2={LUPA.cx - edge} y2={LUPA.cy - edge} stroke="#0e1a2a" strokeWidth={narrow ? 3.5 : 2.5} strokeDasharray="6 5" />
                    <circle cx={m.target.x} cy={m.target.y} r={narrow ? 13 : 9} fill="none" stroke="#ef4444" strokeWidth={narrow ? 4 : 3} />
                  </>
                );
              })()}
            <g transform={`translate(${LUPA.cx} ${LUPA.cy}) scale(${(0.6 + 0.4 * lupaS) * (narrow ? 1.25 : 1)}) translate(${-LUPA.cx} ${-LUPA.cy})`}>
              <circle cx={LUPA.cx} cy={LUPA.cy} r={LUPA.r + 6} fill="#0e1a2a" filter={`url(#${ID.shadow})`} />
              <g clipPath={`url(#${ID.clip})`}>
                <rect x={lx(SASH.x - 400)} y={ly(SASH.y - 400)} width={2000} height={2000} fill="#f7f9fb" />
                <rect x={lx(K.x0)} y={ly(K.y0)} width={2000} height={2000} fill="#f7f9fb" stroke="#8a95a0" strokeWidth={2.2 * z} />
                <rect x={lx(B.x0)} y={ly(B.y0)} width={2000} height={2000} fill="#2b3138" />
                <rect x={lx(G.x0)} y={ly(G.y0)} width={2000} height={2000} fill="#cfe4f5" />
                <text x={lx(SASH.x + FRAME / 2)} y={LUPA.cy + 40} textAnchor="middle" fill="#334155" fontSize="15" fontWeight="700" transform={`rotate(-90 ${lx(SASH.x + FRAME / 2)} ${LUPA.cy + 40})`}>
                  RAMA
                </text>
                <text x={lx(K.x0 + BEAD / 2)} y={LUPA.cy + 46} textAnchor="middle" fill="#334155" fontSize="14" fontWeight="700" transform={`rotate(-90 ${lx(K.x0 + BEAD / 2)} ${LUPA.cy + 46})`}>
                  LISTWA
                </text>
                <text x={lx(B.x0 + SEAL / 2)} y={LUPA.cy + 40} textAnchor="middle" fill="#f8fafc" fontSize="13" fontWeight="700" transform={`rotate(-90 ${lx(B.x0 + SEAL / 2)} ${LUPA.cy + 40})`}>
                  USZCZELKA
                </text>
                <text x={lx(G.x0) + 32} y={LUPA.cy + 100} textAnchor="middle" fill="#1e3a5f" fontSize="15" fontWeight="800">
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
              <rect x={LUPA.cx - 140} y={LUPA.cy + LUPA.r - 6} width="280" height="38" rx="9" fill="#ef4444" />
              <text x={LUPA.cx} y={LUPA.cy + LUPA.r + 20} textAnchor="middle" fill="#fff" fontSize="17" fontWeight="800">
                MIERZ TU: {m.targetName.toUpperCase()}
              </text>
            </g>
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
              <span className="plmg-step-label">{s.id === 4 ? `Wpisz w ${unit}` : s.label}</span>
            </li>
          ))}
        </ol>
        <p className="plmg-caption">{caption}</p>
      </div>

      <p className="plmg-note">{m.note}</p>
    </div>
  );
}
