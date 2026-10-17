"use client";

// Animacje pomiaru i miniatury sposobów montażu żaluzji (właściciel,
// 17.10.2026: "zrób opisy i animacje pomiaru dla tych opcji"). Rysunek okna
// od strony pokoju: wnęka, parapet, rama, skrzydło, szyba z uszczelką,
// klamka. Animacja: podświetlenie krawędzi, które się mierzy -> taśma po
// szerokości -> taśma po wysokości -> nakładka żaluzji tak, jak będzie wisieć.
// Bez bibliotek: SVG + requestAnimationFrame; przy prefers-reduced-motion
// pokazujemy od razu stan końcowy. Modal przez createPortal (panel ma
// transform na telefonie - jak features/plisy/MeasureGuide).
import { useEffect, useId, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { trackShopStep } from "@/lib/track-step";
import { useBackToClose } from "@/lib/use-back-to-close";
import { ZALUZJE_MOUNT_RULES, type ZaluzjeMountId } from "./shared";

type Rect = { x: number; y: number; w: number; h: number };

// Układ rysunku (viewBox 0 0 320 250).
const RECESS: Rect = { x: 60, y: 30, w: 200, h: 170 };
const FRAME: Rect = { x: 68, y: 38, w: 184, h: 158 };
const SASH: Rect = { x: 80, y: 50, w: 160, h: 134 };
const GLASS: Rect = { x: 94, y: 64, w: 132, h: 106 };

/** Co klient mierzy (podświetlone krawędzie) i gdzie wisi żaluzja. */
const GEOMETRY: Record<ZaluzjeMountId, { target: Rect; blind: Rect; extra: string[] }> = {
  "w-swietle-szyby": { target: GLASS, blind: { x: 90, y: 60, w: 140, h: 114 }, extra: ["+1 cm", "+1 cm"] },
  "na-skrzydlo": { target: SASH, blind: { x: 82, y: 50, w: 156, h: 134 }, extra: ["−0,5 cm", "−0,5 cm"] },
  "na-sciane": { target: RECESS, blind: { x: 48, y: 18, w: 224, h: 182 }, extra: ["+5 cm", "+5 cm"] },
};

export const ZALUZJE_MOUNT_ORDER: ZaluzjeMountId[] = ["w-swietle-szyby", "na-skrzydlo", "na-sciane"];

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function subscribeReducedMotion(onChange: () => void) {
  if (typeof window === "undefined" || !window.matchMedia) return () => {};
  const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}
function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribeReducedMotion,
    () => (typeof window !== "undefined" && window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false),
    () => false,
  );
}

/** Okno od strony pokoju - wspólne dla miniatur i animacji. */
function WindowDrawing() {
  // Unikalny gradient na rysunek - na stronie jest kilka SVG jednocześnie.
  const glassId = `zl-glass-${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  return (
    <g>
      <rect x="0" y="0" width="320" height="250" fill="#eef1f4" />
      {/* wnęka (glif) i parapet */}
      <rect x={RECESS.x} y={RECESS.y} width={RECESS.w} height={RECESS.h} fill="#dde3ea" />
      <polygon points={`${RECESS.x},${RECESS.y} ${FRAME.x},${FRAME.y} ${FRAME.x},${FRAME.y + FRAME.h} ${RECESS.x},${RECESS.y + RECESS.h}`} fill="#d2d9e1" />
      <polygon points={`${RECESS.x},${RECESS.y} ${RECESS.x + RECESS.w},${RECESS.y} ${FRAME.x + FRAME.w},${FRAME.y} ${FRAME.x},${FRAME.y}`} fill="#cdd5de" />
      <rect x="48" y="200" width="224" height="11" rx="2" fill="#c7cfd8" />
      {/* rama okna, skrzydło, szyba z uszczelką, klamka */}
      <rect x={FRAME.x} y={FRAME.y} width={FRAME.w} height={FRAME.h} fill="#ffffff" stroke="#bcc6d0" strokeWidth="1.5" />
      <rect x={SASH.x} y={SASH.y} width={SASH.w} height={SASH.h} rx="2" fill="#fafbfc" stroke="#9fabb8" strokeWidth="1.5" />
      <defs>
        <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#a9d2f0" />
          <stop offset="0.55" stopColor="#d6ebfa" />
          <stop offset="1" stopColor="#93c3e8" />
        </linearGradient>
      </defs>
      <rect x={GLASS.x} y={GLASS.y} width={GLASS.w} height={GLASS.h} fill={`url(#${glassId})`} stroke="#3a4148" strokeWidth="2.2" />
      {/* odblask na szybie */}
      <line x1={GLASS.x + 18} y1={GLASS.y + GLASS.h - 14} x2={GLASS.x + 58} y2={GLASS.y + 14} stroke="#ffffff" strokeWidth="6" opacity="0.55" strokeLinecap="round" />
      <line x1={GLASS.x + 40} y1={GLASS.y + GLASS.h - 10} x2={GLASS.x + 70} y2={GLASS.y + 38} stroke="#ffffff" strokeWidth="3" opacity="0.45" strokeLinecap="round" />
      <rect x={SASH.x + SASH.w - 12} y="106" width="5" height="22" rx="2.5" fill="#8b96a2" />
    </g>
  );
}

/** Mała miniatura do karty montażu: gdzie wisi żaluzja (opuszcza się w pętli). */
export function ZaluzjeMountThumb({ mountId }: { mountId: ZaluzjeMountId }) {
  const blind = GEOMETRY[mountId].blind;
  return (
    <svg className="zl-mount-thumb" viewBox="36 8 248 212" aria-hidden="true" focusable="false">
      <WindowDrawing />
      <g className="zl-mt-blind" style={{ transformOrigin: `${blind.x}px ${blind.y}px` }}>
        <rect x={blind.x} y={blind.y} width={blind.w} height={blind.h} fill="#c9a77c" opacity="0.92" />
        {Array.from({ length: Math.floor(blind.h / 9) }, (_, index) => (
          <line key={index} x1={blind.x} x2={blind.x + blind.w} y1={blind.y + 9 * (index + 1)} y2={blind.y + 9 * (index + 1)} stroke="#a8875e" strokeWidth="1.4" />
        ))}
      </g>
      <rect x={blind.x - 2} y={blind.y - 6} width={blind.w + 4} height="7" rx="2" fill="#6b5a45" />
    </svg>
  );
}

const DURATION_MS = 7600;

/** Animacja pomiaru dla jednego sposobu montażu. compact = wersja nad polami. */
export function ZaluzjeMeasureAnimation({ mountId, compact = false }: { mountId: ZaluzjeMountId; compact?: boolean }) {
  const reduced = useReducedMotion();
  const [progress, setProgress] = useState(0);
  // Ograniczony ruch: od razu stan końcowy (obie taśmy i żaluzja).
  const t = reduced ? 1 : progress;

  useEffect(() => {
    if (reduced) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) % (DURATION_MS + 1400);
      setProgress(Math.min(1, elapsed / DURATION_MS));
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [reduced, mountId]);

  const rule = ZALUZJE_MOUNT_RULES[mountId];
  const { target, blind, extra } = GEOMETRY[mountId];
  const highlight = clamp01(t / 0.1);
  const wProg = clamp01((t - 0.1) / 0.3);
  const hProg = clamp01((t - 0.42) / 0.28);
  const bProg = clamp01((t - 0.74) / 0.2);
  const tapeFade = bProg > 0 ? 1 - bProg * 0.75 : 1;
  const activeStep = t < 0.42 ? 0 : t < 0.74 ? 1 : 2;

  // Taśma po szerokości - wewnątrz, przy górnej krawędzi mierzonego elementu.
  const tapeY = target.y + 9;
  const tapeW = target.w * wProg;
  // Taśma po wysokości - przy lewej krawędzi.
  const tapeX = target.x + 9;
  const tapeH = target.h * hProg;
  const blindH = blind.h * bProg;

  return (
    <figure className={`zl-measure-anim ${compact ? "is-compact" : ""}`}>
      <svg viewBox="0 0 320 250" role="img" aria-label={`Pomiar: ${rule.measureWhat}`}>
        <WindowDrawing />
        {/* podświetlenie krawędzi, które się mierzy */}
        <rect
          x={target.x}
          y={target.y}
          width={target.w}
          height={target.h}
          fill="none"
          stroke="#f59e0b"
          strokeWidth="3.2"
          strokeDasharray="7 4"
          opacity={highlight * (bProg > 0 ? 0.55 : 1)}
        />
        {/* taśma - szerokość */}
        {wProg > 0 ? (
          <g opacity={tapeFade}>
            <rect x={target.x - 10} y={tapeY - 7} width="14" height="14" rx="3" fill="#2f3a46" />
            <rect x={target.x} y={tapeY - 3.5} width={tapeW} height="7" fill="#ffd23f" stroke="#d4a500" strokeWidth="0.8" />
            {Array.from({ length: Math.floor(tapeW / 8) }, (_, index) => (
              <line key={index} x1={target.x + 8 * (index + 1)} x2={target.x + 8 * (index + 1)} y1={tapeY - 3.5} y2={tapeY + (index % 5 === 4 ? 2.5 : 0)} stroke="#6b5600" strokeWidth="0.7" />
            ))}
            {wProg >= 1 ? (
              <text x={target.x + target.w / 2} y={tapeY + 17} textAnchor="middle" className="zl-anim-label">
                {rule.widthLabel.toLowerCase()}
              </text>
            ) : null}
          </g>
        ) : null}
        {/* taśma - wysokość */}
        {hProg > 0 ? (
          <g opacity={tapeFade}>
            <rect x={tapeX - 3.5} y={target.y} width="7" height={tapeH} fill="#ffd23f" stroke="#d4a500" strokeWidth="0.8" />
            {Array.from({ length: Math.floor(tapeH / 8) }, (_, index) => (
              <line key={index} y1={target.y + 8 * (index + 1)} y2={target.y + 8 * (index + 1)} x1={tapeX - 3.5} x2={tapeX + (index % 5 === 4 ? 2.5 : 0)} stroke="#6b5600" strokeWidth="0.7" />
            ))}
            {hProg >= 1 ? (
              <text x={tapeX + 12} y={target.y + target.h / 2} className="zl-anim-label">
                {rule.heightLabel.toLowerCase()}
              </text>
            ) : null}
          </g>
        ) : null}
        {/* żaluzja - jak będzie wisieć */}
        {bProg > 0 ? (
          <g>
            <rect x={blind.x - 2} y={blind.y - 7} width={blind.w + 4} height="8" rx="2" fill="#5d4c39" />
            <rect x={blind.x} y={blind.y} width={blind.w} height={blindH} fill="#c9a77c" opacity="0.93" />
            {Array.from({ length: Math.floor(blindH / 8) }, (_, index) => (
              <line key={index} x1={blind.x} x2={blind.x + blind.w} y1={blind.y + 8 * (index + 1)} y2={blind.y + 8 * (index + 1)} stroke="#a8875e" strokeWidth="1.3" />
            ))}
            {bProg >= 1 ? (
              <>
                <text x={blind.x - 4} y={blind.y + blind.h / 2} textAnchor="end" className="zl-anim-label is-extra">
                  {extra[0]}
                </text>
                <text x={blind.x + blind.w + 4} y={blind.y + blind.h / 2} className="zl-anim-label is-extra">
                  {extra[1]}
                </text>
              </>
            ) : null}
          </g>
        ) : null}
      </svg>
      {compact ? (
        <figcaption className="zl-measure-anim-caption">Mierzysz {rule.measureWhat}.</figcaption>
      ) : (
        <ol className="zl-measure-steps">
          {rule.steps.map((step, index) => (
            <li key={index} className={index === activeStep ? "is-active" : ""}>
              {step}
            </li>
          ))}
        </ol>
      )}
    </figure>
  );
}

/** Modal "Jak zmierzyć?" z zakładkami trzech sposobów montażu. */
export function ZaluzjeMeasureModal({
  mountId,
  onClose,
  onPick,
}: {
  mountId: ZaluzjeMountId;
  onClose: () => void;
  onPick?: (mountId: ZaluzjeMountId) => void;
}) {
  const [active, setActive] = useState<ZaluzjeMountId>(mountId);
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
        <ZaluzjeMeasureAnimation key={active} mountId={active} />
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
