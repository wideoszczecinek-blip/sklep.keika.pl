"use client";

// Plisa visualizer for the plisy landing: a drawn two-sash window with a real
// photo behind the glass and a plisa on each sash whose two rails the visitor
// can drag. Sits below the description as an extra; the top of the landing
// is the real-photo slideshow (PlisyHeroPhotos.tsx).
//
// Trimmed hard on 2026-09-15 evening ("odpuść wnętrze"): no room photo,
// the window sits on a plain backdrop. Five views to pick from as thumbnails
// (random one on load), and a fabric-tone row that carries a disclaimer:
// these are approximate tones, not collection patterns - the pattern is
// chosen in the configurator.
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

/** Where the rails rest before the demo and after the visitor lets go. */
const REST: Record<string, Pos> = {
  left: { t: 0, b: 0.58 },
  right: { t: 0, b: 0.36 },
};

/** The demo: a hand cursor that visibly grabs a rail and drags it, then
 * does the same with the other rail on the other sash. Owner (2026-09-15):
 * "pokaż animację jak kursor łapka łapie za belkę i przesuwa ją - raz jedną
 * belkę raz drugą, aby klientowi pokazać że może to zrobić". The rails
 * moving on their own (v2-v4) did not read as "you can do this"; a hand
 * doing it does. Starts when the visualizer scrolls into view, plays once.
 *
 * `rail` segments move a rail and keep the hand on it; `move` segments fly
 * the hand between rails; `hold` segments pause with the hand where it is. */
type DemoSeg =
  | { kind: "move"; ms: number; from: { sash: string; rail: "t" | "b" } | null; to: { sash: string; rail: "t" | "b" } }
  | { kind: "hold"; ms: number; grab: boolean }
  | { kind: "rail"; ms: number; sash: string; rail: "t" | "b"; from: number; to: number };

const DEMO: DemoSeg[] = [
  { kind: "move", ms: 900, from: null, to: { sash: "right", rail: "b" } },
  { kind: "hold", ms: 350, grab: true },
  { kind: "rail", ms: 1500, sash: "right", rail: "b", from: 0.36, to: 0.82 },
  { kind: "hold", ms: 400, grab: false },
  { kind: "move", ms: 900, from: { sash: "right", rail: "b" }, to: { sash: "left", rail: "t" } },
  { kind: "hold", ms: 350, grab: true },
  { kind: "rail", ms: 1500, sash: "left", rail: "t", from: 0, to: 0.3 },
  { kind: "hold", ms: 450, grab: false },
];

/** Hand state for one demo frame: where the fingertip is (viewBox units),
 * whether it is closed on a rail, and how opaque (fades in/out). */
type Hand = { x: number; y: number; grab: boolean; opacity: number };

const HAND_HIDDEN: Hand = { x: 0, y: 0, grab: false, opacity: 0 };

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

  const randomIndex = useSyncExternalStore(noop, () => CLIENT_VIEW_INDEX, () => 0);
  const [pickedViewId, setPickedViewId] = useState<string | null>(null);
  const view = VIEWS.find((v) => v.id === pickedViewId) || VIEWS[randomIndex] || VIEWS[0];

  const [fabricId, setFabricId] = useState<(typeof FABRICS)[number]["id"]>(FABRICS[0].id);
  const fabric = FABRICS.find((f) => f.id === fabricId) || FABRICS[0];

  const [pos, setPos] = useState<Record<string, Pos>>({ left: { ...REST.left }, right: { ...REST.right } });
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

  const [hand, setHand] = useState<Hand>(HAND_HIDDEN);
  /** Set once the block has been on screen - the demo waits for that. */
  const [inView, setInView] = useState(false);
  const stageRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.55)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: [0.55] },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  /** Fingertip position for a rail's grip tab. */
  const railPoint = useCallback(
    (sashId: string, rail: "t" | "b", p: Pos) => {
      const sash = SASHES.find((s) => s.id === sashId) || SASHES[0];
      const y = rail === "t" ? sash.y + p.t * sash.h - 1 : sash.y + p.b * sash.h + 1;
      return { x: sash.x + sash.w / 2, y };
    },
    [],
  );

  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (!inView || touched || reduced) return;
    const total = DEMO.reduce((sum, s) => sum + s.ms, 0);
    let start: number | null = null;
    // Positions evolve across segments; keep the running copy here so a
    // "move" segment knows where the previous "rail" segment left things.
    const live: Record<string, Pos> = { left: { ...REST.left }, right: { ...REST.right } };

    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;

      if (elapsed >= total) {
        setHand(HAND_HIDDEN);
        return;
      }

      let acc = 0;
      let grab = false;
      let point = { x: 0, y: 0 };
      let opacity = 1;

      for (const seg of DEMO) {
        if (elapsed >= acc + seg.ms) {
          // Segment finished - commit its end state and carry on.
          if (seg.kind === "rail") live[seg.sash] = { ...live[seg.sash], [seg.rail]: seg.to };
          acc += seg.ms;
          continue;
        }
        const p = easeInOut(clamp((elapsed - acc) / seg.ms, 0, 1));
        if (seg.kind === "move") {
          const to = railPoint(seg.to.sash, seg.to.rail, live[seg.to.sash]);
          const from = seg.from ? railPoint(seg.from.sash, seg.from.rail, live[seg.from.sash]) : { x: to.x + 140, y: to.y + 150 };
          point = { x: from.x + (to.x - from.x) * p, y: from.y + (to.y - from.y) * p };
          if (!seg.from) opacity = clamp((elapsed - acc) / 300, 0, 1);
          grab = false;
        } else if (seg.kind === "hold") {
          const last = lastRailBefore(seg);
          point = last ? railPoint(last.sash, last.rail, live[last.sash]) : point;
          grab = seg.grab;
        } else {
          const value = seg.from + (seg.to - seg.from) * p;
          live[seg.sash] = { ...live[seg.sash], [seg.rail]: value };
          point = railPoint(seg.sash, seg.rail, live[seg.sash]);
          grab = true;
        }
        break;
      }

      // Fade out over the final hold.
      const tail = DEMO[DEMO.length - 1];
      if (elapsed > total - tail.ms) opacity = Math.min(opacity, clamp((total - elapsed) / tail.ms, 0, 1));

      setPos({ left: { ...live.left }, right: { ...live.right } });
      setHand({ x: point.x, y: point.y, grab, opacity });
      rafRef.current = requestAnimationFrame(tick);
    };

    /** The rail a hold segment refers to = the nearest rail/move segment before it. */
    function lastRailBefore(seg: DemoSeg): { sash: string; rail: "t" | "b" } | null {
      const idx = DEMO.indexOf(seg);
      for (let i = idx - 1; i >= 0; i--) {
        const s = DEMO[i];
        if (s.kind === "rail") return { sash: s.sash, rail: s.rail };
        if (s.kind === "move") return s.to;
      }
      return null;
    }

    const delay = window.setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick);
    }, 500);
    return () => {
      window.clearTimeout(delay);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      setHand(HAND_HIDDEN);
    };
  }, [inView, touched, reduced, railPoint]);

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
      <div className="plisy-viz-stage" ref={stageRef}>
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

          {/* Demo hand. Drawn last so it sits over everything. The path is a
              pointing hand with its fingertip at (0,0); "grab" curls it by
              scaling down and tilting, which reads as a squeeze at this size. */}
          {hand.opacity > 0 ? (
            <g
              className="plisy-viz-hand"
              transform={`translate(${hand.x} ${hand.y}) ${hand.grab ? "scale(0.86) rotate(-8)" : "scale(1)"}`}
              opacity={hand.opacity}
              aria-hidden="true"
              pointerEvents="none"
            >
              <g transform="translate(-12 -2)">
                <path
                  d="M12 2c0-1.1-.9-2-2-2S8 .9 8 2v16.6l-3.3-4.4c-.7-.9-2-1.1-2.8-.4-.9.7-1.1 1.9-.4 2.8l6.2 8.3C9 27.1 11.1 28.2 13.4 28.2h5.9c3.3 0 6-2.7 6-6v-9.7c0-1.1-.9-2-2-2s-2 .9-2 2v.5c0-1.1-.9-2-2-2s-2 .9-2 2V12c0-1.1-.9-2-2-2s-2 .9-2 2v-1.7z"
                  transform="scale(1.9)"
                  fill="#ffffff"
                  stroke="#2b3440"
                  strokeWidth="1.1"
                  strokeLinejoin="round"
                  style={{ filter: "drop-shadow(0 3px 4px rgba(0,0,0,0.35))" }}
                />
              </g>
              {hand.grab ? <circle cx="0" cy="0" r="16" fill="#f59e0b" opacity="0.28" /> : null}
            </g>
          ) : null}
        </svg>

        {!touched ? (
          <p className="plisy-viz-hint" aria-hidden="true">
            ↕ Przeciągnij listwy
          </p>
        ) : null}
      </div>

      <div className="plisy-viz-picks">
        <details className="pl-mini-acc plisy-viz-acc">
          <summary>
            <span>Zmień widok za oknem</span>
            <span className="pl-mini-acc-hint">{view.label}</span>
          </summary>
          <div className="plisy-viz-thumbs" role="group" aria-label="Widok za oknem">
            {VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`plisy-viz-thumb ${v.id === view.id ? "is-active" : ""}`}
                aria-pressed={v.id === view.id}
                aria-label={v.label}
                title={v.label}
                onClick={() => setPickedViewId(v.id)}
              >
                <img src={v.thumb} alt="" loading="lazy" width="320" height="235" />
                <span>{v.label}</span>
              </button>
            ))}
          </div>
        </details>

        <details className="pl-mini-acc plisy-viz-acc">
          <summary>
            <span>Zmień odcień materiału</span>
            <span className="pl-mini-acc-hint">{fabric.label}</span>
          </summary>
          <div className="plisy-viz-acc-body">
            <div className="plisy-viz-pick-row" role="group" aria-label="Odcień tkaniny w wizualizacji">
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
            <p className="plisy-viz-disclaimer">
              <strong>To tylko wizualizacja.</strong> Odcienie są przybliżone i nie odpowiadają konkretnym wzorom z
              kolekcji — wzór tkaniny wybierzesz w konfiguratorze.
            </p>
          </div>
        </details>
      </div>
    </div>
  );
}
