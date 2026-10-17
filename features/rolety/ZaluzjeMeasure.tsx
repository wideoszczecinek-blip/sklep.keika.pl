"use client";

// Animacje pomiaru i miniatury sposobów montażu żaluzji (właściciel,
// 17.10.2026). Geometria i narzędzia (okno z ramą, listwą, uszczelką i szybą,
// lupa na punkt pomiaru, rozwijana taśma z odczytem) wzięte z instrukcji plis
// (features/plisy/MeasureGuide.tsx), dołożona wnęka ze ścianą i parapetem
// (montaż na ścianę) oraz nawiewnik u góry skrzydła (pomiar wysokości pod
// nawiewnikiem). Jedna oś czasu requestAnimationFrame: 1) lupa na punkt,
// 2) taśma po szerokości, 3) taśma po wysokości, 4) żaluzja tak, jak będzie
// wisieć. prefers-reduced-motion = klatka końcowa. Modal przez createPortal.
import { useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { trackShopStep } from "@/lib/track-step";
import { useBackToClose } from "@/lib/use-back-to-close";
import { ZALUZJE_MOUNT_RULES, ZALUZJE_WALL_INFO, type ZaluzjeMountId } from "./shared";

/* ---- geometria sceny (viewBox 0 0 1000 800), okno od strony pokoju ---- */
const RECESS = { x: 150, y: 60, w: 700, h: 600 }; // wnęka (otwór w ścianie)
const SILL = { x: 110, y: RECESS.y + RECESS.h, w: 780, h: 34 }; // parapet
const SASH = { x: 182, y: 92, w: 636, h: 536 }; // skrzydło (rama skrzydła)
const FRAME = 50;
const BEAD = 22;
const SEAL = 9;
const K = { x0: SASH.x + FRAME, x1: SASH.x + SASH.w - FRAME, y0: SASH.y + FRAME, y1: SASH.y + SASH.h - FRAME }; // kreseczka
const B = { x0: K.x0 + BEAD, x1: K.x1 - BEAD, y0: K.y0 + BEAD, y1: K.y1 - BEAD }; // uszczelka
const G = { x0: B.x0 + SEAL, x1: B.x1 - SEAL, y0: B.y0 + SEAL, y1: B.y1 - SEAL }; // szyba
const M = { x0: B.x0 + SEAL / 2, x1: B.x1 - SEAL / 2, y0: B.y0 + SEAL / 2, y1: B.y1 - SEAL / 2 }; // połowa uszczelki
const VENT = { x: K.x0 + 60, y: SASH.y + 9, w: K.x1 - K.x0 - 120, h: 20 }; // nawiewnik na górze skrzydła
const VENT_BOTTOM = VENT.y + VENT.h + 4;
const LUPA = { cx: 690, cy: 470, r: 120, zoom: 2.8, off: -30 };

type Rect = { x: number; y: number; w: number; h: number };
type Spec = {
  targetName: string;
  target: { x: number; y: number };
  width: { from: number; to: number; mm: number; a: string; b: string };
  height: { from: number; to: number; mm: number; a: string; b: string };
  blind: Rect;
  margins: [string, string];
};

function spec(mountId: ZaluzjeMountId, hasVent: boolean): Spec {
  if (mountId === "w-swietle-szyby") {
    return {
      targetName: "połowa uszczelki",
      target: { x: M.x0, y: M.y0 },
      width: { from: M.x0, to: M.x1, mm: 820, a: "od połowy uszczelki", b: "do połowy uszczelki" },
      height: { from: M.y0, to: M.y1, mm: 1240, a: "od połowy uszczelki", b: "do połowy uszczelki" },
      blind: { x: M.x0, y: M.y0, w: M.x1 - M.x0, h: M.y1 - M.y0 },
      margins: ["0", "0"],
    };
  }
  if (mountId === "na-skrzydlo") {
    const from = hasVent ? VENT_BOTTOM : SASH.y;
    return {
      targetName: "kreseczka",
      target: { x: K.x0, y: K.y0 },
      width: { from: K.x0, to: K.x1, mm: 900, a: "od kreseczki", b: "do kreseczki" },
      height: { from, to: SASH.y + SASH.h, mm: hasVent ? 1360 : 1400, a: hasVent ? "od dołu nawiewnika" : "od góry ramy", b: "do dołu ramy" },
      blind: { x: K.x0, y: from, w: K.x1 - K.x0, h: SASH.y + SASH.h - from },
      margins: ["0", "0"],
    };
  }
  return {
    targetName: "krawędź wnęki",
    target: { x: RECESS.x, y: RECESS.y },
    width: { from: RECESS.x, to: RECESS.x + RECESS.w, mm: 1200, a: "światło: od ściany", b: "do ściany" },
    height: { from: RECESS.y, to: SILL.y, mm: 1500, a: "światło: od góry wnęki", b: "do parapetu" },
    // Żaluzja szersza o 5 cm z każdej strony, u góry miejsce na pakiet nad wnęką.
    blind: { x: RECESS.x - 40, y: RECESS.y - 52, w: RECESS.w + 80, h: RECESS.h + 52 },
    margins: ["+5 cm", "pakiet nad wnęką"],
  };
}

/* ---- oś czasu (ms) ---- */
const T = {
  lupaIn: [300, 800],
  lupaOut: [2400, 2800],
  wHook: [2800, 3200],
  wPull: [3200, 4800],
  hMove: [5400, 5900],
  hPull: [5900, 7500],
  blind: [8100, 9200],
  end: [9200, 10600],
} as const;
const TOTAL = 10600;

function seg(t: number, [a, b]: readonly [number, number]): number {
  if (t <= a) return 0;
  if (t >= b) return 1;
  return (t - a) / (b - a);
}
const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
const easeInOut = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
function pull(x: number): number {
  if (x >= 1) return 1;
  const c1 = 1.4;
  return 1 + (c1 + 1) * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
}

function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      if (typeof window === "undefined" || !window.matchMedia) return () => {};
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false),
    () => false,
  );
}

/* ---- taśma miernicza (jak w plisach) ---- */
const CASE_W = 72;
const CASE_H = 52;
const BLADE_T = 18;

function Tape({ x, y, len, vertical, reading, opacity, k = 1 }: { x: number; y: number; len: number; vertical: boolean; reading: number | null; opacity: number; k?: number }) {
  const ticks: ReactNode[] = [];
  for (let i = 10; i < len; i += 10) {
    const tall = i % 50 === 0;
    ticks.push(<line key={i} x1={i} y1={-BLADE_T / 2 + 1} x2={i} y2={-BLADE_T / 2 + (tall ? 8 : 4)} stroke="#111827" strokeWidth={tall ? 1.3 : 0.8} />);
  }
  return (
    <g transform={`translate(${x} ${y})${vertical ? " rotate(90)" : ""}`} opacity={opacity}>
      <rect x={0} y={-BLADE_T / 2} width={Math.max(0, len)} height={BLADE_T} fill="#fcd34d" stroke="#b45309" strokeWidth="1" />
      <g>{ticks}</g>
      <path d={`M-7 ${-BLADE_T / 2 - 4} h8 v${BLADE_T + 8} h-8 v-5 h3 v${-BLADE_T + 2} h-3 z`} fill="#9ca3af" stroke="#374151" strokeWidth="1" />
      <g transform={`translate(${len} 0)`}>
        <rect x={0} y={-CASE_H / 2} width={CASE_W} height={CASE_H} rx="11" fill="#facc15" stroke="#a16207" strokeWidth="1.5" />
        <path d={`M${CASE_W * 0.42} ${-CASE_H / 2} h${CASE_W * 0.58 - 11} a11 11 0 0 1 11 11 v${CASE_H - 22} a11 11 0 0 1 -11 11 h${-(CASE_W * 0.58 - 11)} z`} fill="#1f2937" opacity="0.92" />
        <rect x={CASE_W * 0.5} y={-6} width={20} height={12} rx="6" fill="#ef4444" stroke="#7f1d1d" strokeWidth="1" />
        {reading !== null ? (
          <g transform={vertical ? `translate(${CASE_W / 2} ${-CASE_H / 2 - 32 * k}) rotate(-90) scale(${k})` : `translate(${CASE_W / 2} ${-CASE_H / 2 - 32 * k}) scale(${k})`}>
            <rect x={-54} y={-18} width={108} height={36} rx="8" fill="#0e1a2a" />
            <text x={0} y={7} textAnchor="middle" fill="#ffc45c" fontSize="21" fontWeight="900" style={{ fontVariantNumeric: "tabular-nums" }}>
              {reading} mm
            </text>
          </g>
        ) : null}
      </g>
    </g>
  );
}

function EndLabel({ x, y, text, anchor, opacity, k = 1 }: { x: number; y: number; text: string; anchor: "start" | "end"; opacity: number; k?: number }) {
  if (opacity <= 0.01) return null;
  const w = Math.round((text.length * 9.2 + 24) * k);
  const h = 30 * k;
  const rx = anchor === "start" ? x : x - w;
  return (
    <g opacity={opacity}>
      <rect x={rx} y={y - h / 2} width={w} height={h} rx={8 * k} fill="#ef4444" />
      <text x={rx + w / 2} y={y + 5.5 * k} textAnchor="middle" fill="#fff" fontSize={15.5 * k} fontWeight="800">
        {text}
      </text>
    </g>
  );
}

/** Scena: ściana z wnęką i parapetem, skrzydło z ramą, listwą, uszczelką,
 * szybą i klamką; opcjonalnie nawiewnik u góry skrzydła. */
function Scene({ hasVent, sheenId }: { hasVent: boolean; sheenId: string }) {
  return (
    <g>
      <rect x="0" y="0" width="1000" height="800" fill="#eef1f4" />
      {/* wnęka: ościeża jako skosy, w głębi rama okna */}
      <rect x={RECESS.x} y={RECESS.y} width={RECESS.w} height={RECESS.h} fill="#dfe5ec" />
      <polygon points={`${RECESS.x},${RECESS.y} ${SASH.x},${SASH.y} ${SASH.x},${SASH.y + SASH.h} ${RECESS.x},${RECESS.y + RECESS.h}`} fill="#d1d9e2" />
      <polygon points={`${RECESS.x + RECESS.w},${RECESS.y} ${SASH.x + SASH.w},${SASH.y} ${SASH.x + SASH.w},${SASH.y + SASH.h} ${RECESS.x + RECESS.w},${RECESS.y + RECESS.h}`} fill="#d1d9e2" />
      <polygon points={`${RECESS.x},${RECESS.y} ${RECESS.x + RECESS.w},${RECESS.y} ${SASH.x + SASH.w},${SASH.y} ${SASH.x},${SASH.y}`} fill="#c9d2dc" />
      <rect x={SILL.x} y={SILL.y} width={SILL.w} height={SILL.h} rx="3" fill="#c4ccd5" />
      <rect x={SILL.x} y={SILL.y} width={SILL.w} height="6" fill="#dfe5ec" />
      {/* skrzydło */}
      <rect x={SASH.x} y={SASH.y} width={SASH.w} height={SASH.h} rx="6" fill="#f7f9fb" stroke="#c9d2db" strokeWidth="2" />
      <rect x={K.x0} y={K.y0} width={K.x1 - K.x0} height={K.y1 - K.y0} fill="#f7f9fb" stroke="#8a95a0" strokeWidth="2.2" />
      <rect x={B.x0} y={B.y0} width={B.x1 - B.x0} height={B.y1 - B.y0} fill="#2b3138" />
      <rect x={G.x0} y={G.y0} width={G.x1 - G.x0} height={G.y1 - G.y0} fill="#cfe4f5" />
      <rect x={G.x0} y={G.y0} width={G.x1 - G.x0} height={G.y1 - G.y0} fill={`url(#${sheenId})`} opacity="0.6" />
      {/* klamka */}
      <rect x={SASH.x + SASH.w - FRAME + 10} y={SASH.y + SASH.h / 2 - 36} width="14" height="72" rx="7" fill="#e6ebf0" stroke="#aeb9c4" strokeWidth="1.5" />
      {hasVent ? (
        <g>
          <rect x={VENT.x} y={VENT.y} width={VENT.w} height={VENT.h} rx="4" fill="#ffffff" stroke="#8a95a0" strokeWidth="1.5" />
          {Array.from({ length: 14 }, (_, i) => (
            <line key={i} x1={VENT.x + 14 + i * ((VENT.w - 28) / 13)} y1={VENT.y + 4} x2={VENT.x + 14 + i * ((VENT.w - 28) / 13)} y2={VENT.y + VENT.h - 4} stroke="#8a95a0" strokeWidth="1.5" />
          ))}
          <text x={VENT.x + VENT.w + 8} y={VENT.y + 15} fontSize="13" fontWeight="800" fill="#334155">
            nawiewnik
          </text>
        </g>
      ) : null}
    </g>
  );
}

function Blind({ rect, progress, label }: { rect: Rect; progress: number; label?: string }) {
  if (progress <= 0) return null;
  const h = rect.h * progress;
  const slats = Math.floor(h / 14);
  return (
    <g>
      <rect x={rect.x - 3} y={rect.y - 10} width={rect.w + 6} height="12" rx="3" fill="#5d4c39" />
      <rect x={rect.x} y={rect.y} width={rect.w} height={h} fill="#c9a77c" opacity="0.82" />
      {Array.from({ length: slats }, (_, i) => (
        <line key={i} x1={rect.x} x2={rect.x + rect.w} y1={rect.y + 14 * (i + 1)} y2={rect.y + 14 * (i + 1)} stroke="#a8875e" strokeWidth="2" />
      ))}
      {label && progress >= 1 ? (
        <text x={rect.x + rect.w / 2} y={rect.y + h / 2} textAnchor="middle" fontSize="20" fontWeight="900" fill="#3b2a16" paintOrder="stroke" stroke="#fff" strokeWidth="5">
          {label}
        </text>
      ) : null}
    </g>
  );
}

/** Mała miniatura do karty montażu: scena + żaluzja opuszczająca się w pętli (CSS). */
export function ZaluzjeMountThumb({ mountId }: { mountId: ZaluzjeMountId }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const s = spec(mountId, false);
  return (
    <svg className="zl-mount-thumb" viewBox="90 40 820 650" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`zlth${uid}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
          <stop offset="100%" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <Scene hasVent={false} sheenId={`zlth${uid}`} />
      <g className="zl-mt-blind" style={{ transformOrigin: `${s.blind.x}px ${s.blind.y}px` }}>
        <Blind rect={s.blind} progress={1} />
      </g>
    </svg>
  );
}

/** Animacja pomiaru dla jednego sposobu montażu. compact = wersja nad polami
 * (bez listy kroków), pełna w modalu. */
export function ZaluzjeMeasureAnimation({ mountId, hasVent = false, compact = false }: { mountId: ZaluzjeMountId; hasVent?: boolean; compact?: boolean }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const ID = { clip: `zlmClip${uid}`, sheen: `zlmSheen${uid}` };
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  const [run, setRun] = useState(0);
  const t = reduced ? TOTAL : progress;
  const rule = ZALUZJE_MOUNT_RULES[mountId];
  const m = spec(mountId, hasVent);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const [narrow, setNarrow] = useState(false);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver((entries) => setNarrow((entries[0]?.contentRect.width || 0) < 520));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = performance.now() + (run > 0 ? 200 : 600);
    const tick = (now: number) => {
      const elapsed = now - start;
      if (elapsed < 0) setProgress(0);
      // Koniec animacji zostaje na ekranie (nakładka żaluzji nie znika); mała
      // wersja też - do ponownego odtworzenia służy przycisk.
      else setProgress(Math.min(TOTAL, elapsed));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [reduced, mountId, hasVent, compact, run]);

  const k = narrow ? 1.45 : 1;
  const lupaS = easeOut(seg(t, T.lupaIn)) * (1 - easeInOut(seg(t, T.lupaOut)));
  const wLen = m.width.to - m.width.from;
  const hLen = m.height.to - m.height.from;
  const wO = easeOut(seg(t, T.wHook)) * (1 - easeInOut(seg(t, T.hMove)));
  const wP = pull(seg(t, T.wPull));
  const wReading = t >= T.wPull[0] ? Math.round(m.width.mm * Math.min(1, wP)) : null;
  const hO = easeOut(seg(t, T.hMove)) * (1 - 0.75 * easeInOut(seg(t, T.blind)));
  const hP = pull(seg(t, T.hPull));
  const hReading = t >= T.hPull[0] ? Math.round(m.height.mm * Math.min(1, hP)) : null;
  const bP = easeInOut(seg(t, T.blind));
  const stepIndex = t < T.wHook[0] ? 0 : t < T.hMove[0] ? 1 : t < T.blind[0] ? 2 : 3;
  const tapeWY = m.height.from + Math.min(hLen * 0.3, 160);
  const tapeHX = m.width.from + Math.min(wLen * 0.28, 170);
  const highlightO = t < T.blind[0] ? 1 : 0.35;

  // lupa
  const z = LUPA.zoom;
  const off = narrow ? -52 : LUPA.off;
  const TX = LUPA.cx + off;
  const TY = LUPA.cy + off;
  const lx = (x: number) => TX + (x - m.target.x) * z;
  const ly = (y: number) => TY + (y - m.target.y) * z;
  const showW = t >= T.wHook[0] && t < T.hMove[1];
  const showH = t >= T.hMove[0];

  const steps = [
    `Znajdź punkt pomiaru: ${m.targetName}.`,
    rule.steps[0],
    hasVent && mountId === "na-skrzydlo" ? "Wysokość: od dolnej krawędzi nawiewnika do dołu ramy skrzydła - żaluzja wisi pod nawiewnikiem." : rule.steps[1],
    rule.steps[2],
  ];

  return (
    <figure className={`zl-measure-anim ${compact ? "is-compact" : ""}`}>
      {mountId === "na-sciane" && !compact ? (
        <p className="zl-wall-info" role="note">
          {ZALUZJE_WALL_INFO}
        </p>
      ) : null}
      <div className="zl-measure-stage" ref={stageRef}>
        <svg viewBox="90 30 820 680" role="img" aria-label={`Pomiar: ${rule.measureWhat}`}>
          <defs>
            <clipPath id={ID.clip}>
              <circle cx={LUPA.cx} cy={LUPA.cy} r={LUPA.r} />
            </clipPath>
            <linearGradient id={ID.sheen} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.5" />
              <stop offset="45%" stopColor="#fff" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
          </defs>
          <Scene hasVent={hasVent} sheenId={ID.sheen} />
          {/* punkty bieżącego wymiaru */}
          {stepIndex === 1 ? (
            <g opacity={wO}>
              <line x1={m.width.from} y1={tapeWY - 28} x2={m.width.from} y2={tapeWY + 28} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5 4" />
              <line x1={m.width.to} y1={tapeWY - 28} x2={m.width.to} y2={tapeWY + 28} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5 4" />
            </g>
          ) : null}
          {stepIndex === 2 ? (
            <g opacity={hO}>
              <line x1={tapeHX - 28} y1={m.height.from} x2={tapeHX + 28} y2={m.height.from} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5 4" />
              <line x1={tapeHX - 28} y1={m.height.to} x2={tapeHX + 28} y2={m.height.to} stroke="#ef4444" strokeWidth="2.5" strokeDasharray="5 4" />
            </g>
          ) : null}
          {showW ? (
            <>
              <EndLabel x={m.width.from} y={narrow ? tapeWY - 44 : tapeWY + 36} text={m.width.a} anchor="start" opacity={wO} k={k} />
              <EndLabel x={m.width.to} y={narrow ? tapeWY + 44 : tapeWY + 36} text={m.width.b} anchor="end" opacity={wO * easeOut(seg(wP, [0.85, 1] as const))} k={k} />
              <Tape x={m.width.from} y={tapeWY} len={wLen * wP} vertical={false} reading={wReading} opacity={wO} k={k} />
            </>
          ) : null}
          {showH ? (
            <>
              <EndLabel x={tapeHX + 40} y={m.height.from + (hasVent && mountId === "na-skrzydlo" ? 26 : 4)} text={m.height.a} anchor="start" opacity={hO} k={k} />
              <EndLabel x={tapeHX + 40} y={m.height.to - 4} text={m.height.b} anchor="start" opacity={hO * easeOut(seg(hP, [0.85, 1] as const))} k={k} />
              <Tape x={tapeHX} y={m.height.from} len={hLen * hP} vertical reading={hReading} opacity={hO} k={k} />
            </>
          ) : null}
          {/* żaluzja - jak będzie wisieć; obrys mierzonego elementu zostaje na wierzchu */}
          <Blind rect={m.blind} progress={bP} label={m.margins[0] !== "0" ? `${m.margins[0]} z każdej strony, ${m.margins[1]}` : "= zmierzony wymiar"} />
          <rect x={m.width.from} y={m.height.from} width={wLen} height={hLen} fill="none" stroke="#f59e0b" strokeWidth="3.5" strokeDasharray="9 6" opacity={highlightO * Math.min(1, t / 400)} />
          {/* lupa na punkt pomiaru (krok 1) */}
          {lupaS > 0.01 ? (
            <g opacity={lupaS}>
              <line x1={m.target.x} y1={m.target.y} x2={LUPA.cx - LUPA.r * 0.72} y2={LUPA.cy - LUPA.r * 0.72} stroke="#0e1a2a" strokeWidth="2.5" strokeDasharray="6 5" />
              <circle cx={m.target.x} cy={m.target.y} r="10" fill="none" stroke="#ef4444" strokeWidth="3" />
              <g transform={`translate(${LUPA.cx} ${LUPA.cy}) scale(${(0.6 + 0.4 * lupaS) * (narrow ? 1.2 : 1)}) translate(${-LUPA.cx} ${-LUPA.cy})`}>
                <circle cx={LUPA.cx} cy={LUPA.cy} r={LUPA.r + 6} fill="#0e1a2a" />
                <g clipPath={`url(#${ID.clip})`}>
                  {mountId === "na-sciane" ? (
                    <>
                      <rect x={lx(RECESS.x - 400)} y={ly(RECESS.y - 400)} width={2000} height={2000} fill="#eef1f4" />
                      <rect x={lx(RECESS.x)} y={ly(RECESS.y)} width={2000} height={2000} fill="#dfe5ec" stroke="#8a95a0" strokeWidth={2 * z} />
                      <text x={lx(RECESS.x) - 40} y={LUPA.cy + 60} textAnchor="middle" fill="#334155" fontSize="15" fontWeight="800" transform={`rotate(-90 ${lx(RECESS.x) - 40} ${LUPA.cy + 60})`}>
                        ŚCIANA
                      </text>
                      <text x={lx(RECESS.x) + 50} y={LUPA.cy + 70} textAnchor="middle" fill="#334155" fontSize="15" fontWeight="800">
                        WNĘKA
                      </text>
                    </>
                  ) : (
                    <>
                      <rect x={lx(SASH.x - 400)} y={ly(SASH.y - 400)} width={2000} height={2000} fill="#f7f9fb" />
                      <rect x={lx(K.x0)} y={ly(K.y0)} width={2000} height={2000} fill="#f7f9fb" stroke="#8a95a0" strokeWidth={2.2 * z} />
                      <rect x={lx(B.x0)} y={ly(B.y0)} width={2000} height={2000} fill="#2b3138" />
                      <rect x={lx(G.x0)} y={ly(G.y0)} width={2000} height={2000} fill="#cfe4f5" />
                      <text x={lx(SASH.x + FRAME / 2)} y={LUPA.cy + 40} textAnchor="middle" fill="#334155" fontSize="14" fontWeight="700" transform={`rotate(-90 ${lx(SASH.x + FRAME / 2)} ${LUPA.cy + 40})`}>
                        RAMA
                      </text>
                      <text x={lx(K.x0 + BEAD / 2)} y={LUPA.cy + 46} textAnchor="middle" fill="#334155" fontSize="13" fontWeight="700" transform={`rotate(-90 ${lx(K.x0 + BEAD / 2)} ${LUPA.cy + 46})`}>
                        LISTWA
                      </text>
                      <text x={lx(B.x0 + SEAL / 2)} y={LUPA.cy + 40} textAnchor="middle" fill="#f8fafc" fontSize="12" fontWeight="700" transform={`rotate(-90 ${lx(B.x0 + SEAL / 2)} ${LUPA.cy + 40})`}>
                        USZCZELKA
                      </text>
                      <text x={lx(G.x0) + 30} y={LUPA.cy + 96} textAnchor="middle" fill="#1e3a5f" fontSize="14" fontWeight="800">
                        SZYBA
                      </text>
                      {mountId === "w-swietle-szyby" ? (
                        <line x1={lx(B.x0)} y1={TY} x2={lx(G.x0)} y2={TY} stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
                      ) : (
                        <line x1={TX} y1={TY - 60} x2={TX} y2={TY + 110} stroke="#ef4444" strokeWidth="2" strokeDasharray="3 3" />
                      )}
                    </>
                  )}
                  <circle cx={TX} cy={TY} r={16 + 7 * Math.abs(Math.sin(t / 260))} fill="none" stroke="#ef4444" strokeWidth="3" opacity="0.8" />
                  <circle cx={TX} cy={TY} r="6" fill="#ef4444" />
                </g>
                <circle cx={LUPA.cx} cy={LUPA.cy} r={LUPA.r} fill="none" stroke="#0e1a2a" strokeWidth="6" />
                <rect x={LUPA.cx - 130} y={LUPA.cy + LUPA.r - 4} width="260" height="34" rx="9" fill="#ef4444" />
                <text x={LUPA.cx} y={LUPA.cy + LUPA.r + 19} textAnchor="middle" fill="#fff" fontSize="15" fontWeight="800">
                  MIERZ TU: {m.targetName.toUpperCase()}
                </text>
              </g>
            </g>
          ) : null}
        </svg>
        {!reduced && t >= TOTAL ? (
          <button type="button" className="zl-replay" onClick={() => setRun((r) => r + 1)} aria-label="Odtwórz animację ponownie">
            ↻ Odtwórz
          </button>
        ) : null}
      </div>
      {compact ? (
        <figcaption className="zl-measure-anim-caption">{steps[Math.min(stepIndex, 3)]}</figcaption>
      ) : (
        <ol className="zl-measure-steps">
          {steps.map((step, index) => (
            <li key={index} className={index === stepIndex ? "is-active" : index < stepIndex ? "is-done" : ""}>
              {step}
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

export const ZALUZJE_MOUNT_ORDER: ZaluzjeMountId[] = ["w-swietle-szyby", "na-skrzydlo", "na-sciane"];

/** Modal "Jak zmierzyć?" z zakładkami trzech sposobów montażu. */
export function ZaluzjeMeasureModal({
  mountId,
  hasVent = false,
  onClose,
  onPick,
}: {
  mountId: ZaluzjeMountId;
  hasVent?: boolean;
  onClose: () => void;
  onPick?: (mountId: ZaluzjeMountId) => void;
}) {
  const [active, setActive] = useState<ZaluzjeMountId>(mountId);
  const [vent, setVent] = useState(hasVent);
  useBackToClose(true, onClose);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [onClose]);
  if (typeof document === "undefined") return null;
  const rule = ZALUZJE_MOUNT_RULES[active];
  return createPortal(
    <div className="instruction-modal instruction-modal--measure zl-measure-modal" role="dialog" aria-modal="true" aria-label="Jak zmierzyć okno pod żaluzję" onClick={onClose}>
      <div className="instruction-modal-shell instruction-modal-shell--measure" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="instruction-modal-close" aria-label="Zamknij instrukcję" onClick={onClose}>
          ×
        </button>
        <h3>Jak zmierzyć okno pod żaluzję</h3>
        <div className="zl-measure-tabs" role="tablist" aria-label="Sposób montażu">
          {ZALUZJE_MOUNT_ORDER.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={id === active}
              className={id === active ? "is-active" : ""}
              onClick={() => {
                setActive(id);
                trackShopStep("measure_guide_tab", id, { product: "zaluzje" });
              }}
            >
              {id === "w-swietle-szyby" ? "W świetle szyby" : id === "na-skrzydlo" ? "Na skrzydło" : "Na ścianę"}
            </button>
          ))}
        </div>
        {active === "na-skrzydlo" ? (
          <label className="zl-exact-toggle zl-vent-toggle">
            <input type="checkbox" checked={vent} onChange={(event) => setVent(event.target.checked)} />
            Okno ma nawiewnik (kratkę wentylacyjną na górze skrzydła)
          </label>
        ) : null}
        <ZaluzjeMeasureAnimation key={`${active}-${vent}`} mountId={active} hasVent={active === "na-skrzydlo" && vent} />
        <p className="zl-measure-rule">{rule.ruleText}</p>
        <div className="zl-measure-actions">
          {onPick && active !== mountId ? (
            <button type="button" className="plisy-coll-modal-cta" onClick={() => onPick(active)}>
              Wybieram ten montaż
            </button>
          ) : null}
          <button type="button" className="zl-measure-close" onClick={onClose}>
            Zamknij
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
