"use client";

// Plisa visualizer for the plisy landing: a drawn two-sash window with a real
// photo behind the glass and a plisa on each sash whose two rails the visitor
// can drag. Sits below the description as an extra; the top of the landing
// is the real-photo slideshow (PlisyHeroPhotos.tsx).
//
// Trimmed hard on 2026-09-15 evening, owner's words: "odpuść wnętrze, daj
// tylko jeden randomowy widok za oknem, bez opcji zmiany, wybierz tylko
// opcję tkaniny ale z wyraźnym podkreśleniem że to tylko wizualizacja a nie
// wybrany wzór". So: no room, no view picker, one random view, and the
// fabric row carries a disclaimer that these are approximate tones, not
// collection patterns - the pattern is chosen in the configurator.
//
// Fidelity rules from the owner's own installation photos and confirmed
// product facts:
//   - no side guide rails (this mounting system has none - owner, 2026-09-09)
//   - both rails move; the fabric spans between them
//   - a fixed number of pleats, so they compress as the span shortens
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { VIEWS } from "./visualizer-scenes";

const VB_W = 1000;
const VB_H = 800;
const RAIL_H = 14;
/** Fabric never fully collapses - a real stack still has depth. */
const MIN_SPAN = RAIL_H * 2 + 18;
/** Constant pleat count is what makes the fabric compress instead of being
 * cropped: pleat pitch = span / PLEATS. Real pleats are ~20 mm. */
const PLEATS = 44;

/** Approximate tones only. Anthracite first - it is what the owner's own
 * installations use. Hand-picked lit/shade stops rather than a computed
 * spread, because the light fabrics washed out with plShiftHex. */
const FABRICS = [
  { id: "antracyt", label: "Antracyt", base: "#3b4147", lit: "#4e565d", shade: "#20252a", edge: "#2b3035" },
  { id: "grafit", label: "Grafit", base: "#5b6168", lit: "#737a82", shade: "#3d4248", edge: "#4a5057" },
  { id: "bez", label: "Beż", base: "#d5c6ad", lit: "#e8dcc6", shade: "#b6a58a", edge: "#c8b89c" },
  { id: "biel", label: "Biel", base: "#eef0f1", lit: "#fbfcfc", shade: "#cfd4d8", edge: "#e2e5e8" },
  { id: "granat", label: "Granat", base: "#2e3d5c", lit: "#42547a", shade: "#1c2740", edge: "#26334e" },
  { id: "oliwka", label: "Oliwka", base: "#7c8460", lit: "#98a07a", shade: "#5c6345", edge: "#6e7554" },
] as const;

const RAIL = "#c3c8cc";
const RAIL_LIT = "#eef1f2";
const RAIL_DARK = "#868c91";

type Sash = { id: string; x: number; y: number; w: number; h: number };

const SASHES: Sash[] = [
  { id: "left", x: 108, y: 112, w: 372, h: 576 },
  { id: "right", x: 520, y: 112, w: 372, h: 576 },
];

type Pos = { t: number; b: number };

/** Auto-demo, played once until the visitor touches a rail. Opens with a
 * top-down move, because that is what nobody expects from a blind. */
const DEMO: Record<string, Pos[]> = {
  left: [
    { t: 0, b: 0.58 },
    { t: 0, b: 0.92 },
    { t: 0.34, b: 0.92 },
    { t: 0.34, b: 0.66 },
    { t: 0, b: 0.58 },
  ],
  right: [
    { t: 0, b: 0.36 },
    { t: 0.22, b: 0.78 },
    { t: 0.5, b: 1 },
    { t: 0.08, b: 0.52 },
    { t: 0, b: 0.36 },
  ],
};

const STEP_MS = 2200;
const HOLD_MS = 900;

function easeInOut(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Rolled once per page load on the client. Served through
 * useSyncExternalStore with a fixed server snapshot, so SSR and hydration
 * agree on the first view and the random one swaps in right after -
 * no attribute mismatch, no setState-in-effect. */
const CLIENT_VIEW_INDEX = Math.floor(Math.random() * VIEWS.length);
const noop = () => () => {};

export default function PlisyVisualizer() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement | null>(null);

  const viewIndex = useSyncExternalStore(noop, () => CLIENT_VIEW_INDEX, () => 0);
  const view = VIEWS[viewIndex] || VIEWS[0];

  const [fabricId, setFabricId] = useState<(typeof FABRICS)[number]["id"]>(FABRICS[0].id);
  const fabric = FABRICS.find((f) => f.id === fabricId) || FABRICS[0];

  const [pos, setPos] = useState<Record<string, Pos>>({ left: DEMO.left[0], right: DEMO.right[0] });
  /** First real interaction with a rail ends the demo for good. */
  const [touched, setTouched] = useState(false);

  const reduced = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (touched || reduced) return;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const cycle = STEP_MS + HOLD_MS;
      const next: Record<string, Pos> = {};
      let done = true;

      for (const sash of SASHES) {
        const frames = DEMO[sash.id];
        const total = (frames.length - 1) * cycle;
        if (elapsed >= total) {
          next[sash.id] = frames[frames.length - 1];
          continue;
        }
        done = false;
        const leg = Math.floor(elapsed / cycle);
        const within = elapsed - leg * cycle;
        const p = easeInOut(clamp(within / STEP_MS, 0, 1));
        const from = frames[leg];
        const to = frames[leg + 1];
        next[sash.id] = { t: from.t + (to.t - from.t) * p, b: from.b + (to.b - from.b) * p };
      }

      setPos(next);
      if (!done) rafRef.current = requestAnimationFrame(tick);
    };

    const delay = window.setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick);
    }, 600);
    return () => {
      window.clearTimeout(delay);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [touched, reduced]);

  /** Pointer y -> fraction of the sash. The SVG's CSS aspect-ratio matches
   * its viewBox, so there is no letterboxing and the mapping is a ratio. */
  const yToFraction = useCallback((clientY: number, sash: Sash) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return 0;
    const vbY = ((clientY - rect.top) / rect.height) * VB_H;
    return (vbY - sash.y) / sash.h;
  }, []);

  const dragRef = useRef<{ sash: Sash; rail: "t" | "b" } | null>(null);

  const moveRail = (sash: Sash, rail: "t" | "b", value: number) => {
    const gap = MIN_SPAN / sash.h;
    setPos((prev) => {
      const cur = prev[sash.id];
      if (rail === "t") return { ...prev, [sash.id]: { ...cur, t: clamp(value, 0, cur.b - gap) } };
      return { ...prev, [sash.id]: { ...cur, b: clamp(value, cur.t + gap, 1) } };
    });
  };

  const onPointerDown = (e: React.PointerEvent, sash: Sash, rail: "t" | "b") => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { sash, rail };
    setTouched(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    moveRail(drag.sash, drag.rail, yToFraction(e.clientY, drag.sash));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent, sash: Sash, rail: "t" | "b") => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    setTouched(true);
    const cur = pos[sash.id];
    const delta = (e.key === "ArrowUp" ? -1 : 1) * 0.04;
    moveRail(sash, rail, (rail === "t" ? cur.t : cur.b) + delta);
  };

  const ids = {
    fold: `plvFold${uid}`,
    round: `plvRound${uid}`,
    rail: `plvRail${uid}`,
    cap: `plvCap${uid}`,
    sheen: `plvSheen${uid}`,
    castBottom: `plvCastB${uid}`,
    castTop: `plvCastT${uid}`,
    opening: `plvOpening${uid}`,
  };

  const openX = SASHES[0].x;
  const openW = SASHES[1].x + SASHES[1].w - SASHES[0].x;

  return (
    <div className="plisy-viz">
      <div className="plisy-viz-stage">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="plisy-viz-svg"
          onPointerMove={onPointerMove}
          onPointerUp={endDrag}
          onPointerCancel={endDrag}
          onPointerLeave={endDrag}
          role="group"
          aria-label="Wizualizacja plisy: przeciągnij górną lub dolną listwę, aby zasłonić dowolny fragment okna"
        >
          <defs>
            {/* One pleat: crease at the top, lit rise, shaded valley. */}
            <linearGradient id={ids.fold} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={fabric.edge} />
              <stop offset="22%" stopColor={fabric.base} />
              <stop offset="46%" stopColor={fabric.lit} />
              <stop offset="51%" stopColor={fabric.base} />
              <stop offset="52%" stopColor={fabric.shade} />
              <stop offset="78%" stopColor={fabric.edge} />
              <stop offset="100%" stopColor={fabric.shade} />
            </linearGradient>
            <linearGradient id={ids.round} x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#000" stopOpacity="0.22" />
              <stop offset="14%" stopColor="#000" stopOpacity="0.05" />
              <stop offset="46%" stopColor="#fff" stopOpacity="0.035" />
              <stop offset="80%" stopColor="#000" stopOpacity="0.05" />
              <stop offset="100%" stopColor="#000" stopOpacity="0.24" />
            </linearGradient>
            <linearGradient id={ids.rail} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={RAIL_LIT} />
              <stop offset="38%" stopColor={RAIL} />
              <stop offset="100%" stopColor={RAIL_DARK} />
            </linearGradient>
            <linearGradient id={ids.cap} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f6f8f9" />
              <stop offset="100%" stopColor="#9aa1a6" />
            </linearGradient>
            <linearGradient id={ids.sheen} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.4" />
              <stop offset="40%" stopColor="#fff" stopOpacity="0.06" />
              <stop offset="100%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={ids.castBottom} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#000" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={ids.castTop} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#000" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </linearGradient>
            {/* The view fills the whole opening once; each sash clips its
                piece, so both panes show one continuous scene. */}
            <clipPath id={ids.opening}>
              <rect x={openX} y={SASHES[0].y} width={openW} height={SASHES[0].h} />
            </clipPath>
          </defs>

          {/* Frame + sill on the stage's plain backdrop */}
          <rect x="40" y="46" width="920" height="708" rx="12" fill="#000" opacity="0.06" />
          <rect x="60" y="64" width="880" height="672" rx="10" fill="#f6f9fb" stroke="#ccd5dd" strokeWidth="2" />
          <rect x="48" y="736" width="904" height="20" rx="6" fill="#eef3f7" stroke="#ccd5dd" strokeWidth="1.5" />

          {SASHES.map((sash) => {
            const p = pos[sash.id];
            const topY = sash.y + p.t * sash.h;
            const botY = sash.y + p.b * sash.h;
            const fabricTop = topY + RAIL_H;
            const fabricH = Math.max(0, botY - RAIL_H - fabricTop);
            const pitch = Math.max(2.2, fabricH / PLEATS);
            const patternId = `plvPleats${uid}${sash.id}`;
            const clipId = `plvClip${uid}${sash.id}`;

            return (
              <g key={sash.id}>
                <defs>
                  <pattern id={patternId} patternUnits="userSpaceOnUse" x={sash.x} y={fabricTop} width={sash.w} height={pitch}>
                    <rect width={sash.w} height={pitch} fill={`url(#${ids.fold})`} />
                  </pattern>
                  <clipPath id={clipId}>
                    <rect x={sash.x} y={sash.y} width={sash.w} height={sash.h} />
                  </clipPath>
                </defs>

                {/* Sash rebate */}
                <rect x={sash.x - 20} y={sash.y - 20} width={sash.w + 40} height={sash.h + 40} rx="6" fill="#fcfdfe" stroke="#d5dde4" strokeWidth="2" />

                <g clipPath={`url(#${clipId})`}>
                  {/* Sky under the photo covers its load time */}
                  <rect x={sash.x} y={sash.y} width={sash.w} height={sash.h} fill="#cfe3f3" />
                  <image
                    key={view.id}
                    href={view.src}
                    x={openX}
                    y={SASHES[0].y}
                    width={openW}
                    height={SASHES[0].h}
                    preserveAspectRatio="xMidYMid slice"
                    clipPath={`url(#${ids.opening})`}
                  />
                  <rect x={sash.x} y={sash.y} width={sash.w} height={sash.h} fill={`url(#${ids.sheen})`} />

                  {/* Light spill on the glass past each rail */}
                  <rect x={sash.x} y={botY} width={sash.w} height={54} fill={`url(#${ids.castBottom})`} />
                  <rect x={sash.x} y={Math.max(sash.y, topY - 40)} width={sash.w} height={Math.min(40, topY - sash.y)} fill={`url(#${ids.castTop})`} />

                  {/* Fabric */}
                  {fabricH > 0 ? (
                    <>
                      <rect x={sash.x} y={fabricTop} width={sash.w} height={fabricH} fill={`url(#${patternId})`} />
                      <rect x={sash.x} y={fabricTop} width={sash.w} height={fabricH} fill={`url(#${ids.round})`} />
                    </>
                  ) : null}

                  {/* Rails */}
                  {(["t", "b"] as const).map((rail) => {
                    const railY = rail === "t" ? topY : botY - RAIL_H;
                    return (
                      <g
                        key={rail}
                        className="plisy-viz-rail"
                        role="slider"
                        tabIndex={0}
                        aria-label={`${rail === "t" ? "Górna" : "Dolna"} listwa, ${sash.id === "left" ? "lewe" : "prawe"} skrzydło`}
                        aria-orientation="vertical"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round((rail === "t" ? p.t : p.b) * 100)}
                        onPointerDown={(e) => onPointerDown(e, sash, rail)}
                        onKeyDown={(e) => onKeyDown(e, sash, rail)}
                      >
                        {/* Fat invisible hit area; the rail itself is too thin to grab. */}
                        <rect x={sash.x - 4} y={railY - 13} width={sash.w + 8} height={RAIL_H + 26} fill="transparent" />
                        <rect x={sash.x - 3} y={railY} width={sash.w + 6} height={RAIL_H} rx={RAIL_H * 0.3} fill={`url(#${ids.rail})`} />
                        <rect x={sash.x - 3} y={railY} width="9" height={RAIL_H} rx="3" fill={`url(#${ids.cap})`} />
                        <rect x={sash.x + sash.w - 6} y={railY} width="9" height={RAIL_H} rx="3" fill={`url(#${ids.cap})`} />
                        <rect
                          x={sash.x + sash.w / 2 - 17}
                          y={rail === "t" ? railY - 5 : railY + RAIL_H - 4}
                          width="34"
                          height="9"
                          rx="4.5"
                          fill={`url(#${ids.cap})`}
                          stroke="#8f969b"
                          strokeWidth="0.8"
                        />
                      </g>
                    );
                  })}
                </g>
              </g>
            );
          })}

          {/* Handle on the right sash, as in the real photos */}
          <rect x="498" y="386" width="14" height="58" rx="7" fill="#e6ebef" stroke="#c3ccd3" strokeWidth="1.5" />
        </svg>

        {!touched ? (
          <p className="plisy-viz-hint" aria-hidden="true">
            ↕ Przeciągnij listwy
          </p>
        ) : null}
      </div>

      <div className="plisy-viz-picks">
        <div className="plisy-viz-pick" role="group" aria-label="Odcień tkaniny w wizualizacji">
          <span className="plisy-viz-pick-label">Odcień</span>
          <div className="plisy-viz-pick-row">
            {FABRICS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`plisy-viz-swatch ${f.id === fabricId ? "is-active" : ""}`}
                aria-pressed={f.id === fabricId}
                aria-label={f.label}
                title={f.label}
                style={{ background: `linear-gradient(180deg, ${f.lit} 0%, ${f.base} 50%, ${f.shade} 100%)` }}
                onClick={() => setFabricId(f.id)}
              />
            ))}
          </div>
        </div>
        <p className="plisy-viz-disclaimer">
          <strong>To tylko wizualizacja.</strong> Odcienie są przybliżone i nie odpowiadają konkretnym wzorom z kolekcji —
          wzór tkaniny wybierzesz w konfiguratorze.
        </p>
      </div>
    </div>
  );
}
