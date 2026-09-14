"use client";

// Interactive hero for the plisy landing.
//
// v1 (2026-09-14) animated only the bottom rail, which sold the product short:
// the whole point of a plisa is that BOTH rails move, so you can cover the
// middle of the sash and leave light above and below. The owner called it out
// the same day ("ruchoma jest tylko dolna belka... nie wiem jakby to zadziałało
// jakby klient mógł ruszać belkami"), so v2 makes both rails draggable and
// keeps a short auto-demo that plays until the visitor touches it.
//
// Why drawn and not photographed: the owner dropped the photo backdrop from the
// configurator's PlisaPreview on 2026-09-09 after three attempts, and only 3
// usable installation photos exist - none a clean frontal hero. Those 3 carry
// the gallery below instead. Drawing it is also the only way to make the rails
// grabbable.
//
// Fidelity rules from the real photos and confirmed product facts:
//   - no side guide rails (this mounting system has none - owner, 2026-09-09)
//   - both rails move; the fabric spans between them
//   - a fixed number of pleats, so they compress as the span shortens
//   - anthracite honeycomb fabric, slim anodised rails
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { HERO_ROOMS, HERO_VIEWS } from "./hero-scenes";

const VB_W = 1000;
const VB_H = 800;
const RAIL_H = 14;
/** Fabric never fully collapses - a real stack still has depth. */
const MIN_SPAN = RAIL_H * 2 + 18;
/** Constant pleat count is what makes the fabric compress instead of being
 * cropped: pleat pitch = span / PLEATS. */
const PLEATS = 44;

/** A handful of fabric tones for the picker. Anthracite first: it is what the
 * owner's own installations use and what the hero opened with. The rest are
 * the tones customers actually order, not a full swatch book - that lives in
 * the configurator. Each is a base plus a lit and a shaded stop for the
 * pleat gradient; plShiftHex would do, but hand-picked stops keep the light
 * fabrics from washing out. */
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
  { id: "left", x: 178, y: 96, w: 312, h: 470 },
  { id: "right", x: 510, y: 96, w: 312, h: 470 },
];

/** Rail positions as a fraction of sash height: `t` is the top rail's top
 * edge, `b` the bottom rail's bottom edge. */
type Pos = { t: number; b: number };

/** The auto-demo. Deliberately opens with a top-down move, because that is the
 * behaviour customers do not expect from a blind. */
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

export default function PlisyHero() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [pos, setPos] = useState<Record<string, Pos>>({
    left: DEMO.left[0],
    right: DEMO.right[0],
  });
  /** Stops the demo for good on the first real interaction. */
  const [touched, setTouched] = useState(false);
  const [roomId, setRoomId] = useState(HERO_ROOMS[0].id);
  const [viewId, setViewId] = useState(HERO_VIEWS[0].id);
  const [fabricId, setFabricId] = useState<(typeof FABRICS)[number]["id"]>(FABRICS[0].id);
  const room = HERO_ROOMS.find((r) => r.id === roomId) || HERO_ROOMS[0];
  const view = HERO_VIEWS.find((v) => v.id === viewId) || HERO_VIEWS[0];
  const fabric = FABRICS.find((f) => f.id === fabricId) || FABRICS[0];
  // useSyncExternalStore rather than useState+useEffect: setting state
  // synchronously inside an effect triggers a cascading render (and the lint
  // rule that flags it). Server snapshot is false - the demo simply does not
  // start until hydration tells us otherwise.
  const reduced = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  // Auto-demo: interpolate each sash through its own keyframes until touched.
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (touched || reduced) return;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      const cycle = STEP_MS + HOLD_MS;
      const next: Record<string, Pos> = {};

      for (const sash of SASHES) {
        const frames = DEMO[sash.id];
        const legs = frames.length - 1;
        const total = legs * cycle;
        const local = elapsed % total;
        const leg = Math.floor(local / cycle);
        const within = local - leg * cycle;
        const p = easeInOut(clamp(within / STEP_MS, 0, 1));
        const from = frames[leg];
        const to = frames[leg + 1];
        next[sash.id] = {
          t: from.t + (to.t - from.t) * p,
          b: from.b + (to.b - from.b) * p,
        };
      }

      setPos(next);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [touched, reduced]);

  /** Pointer y -> fraction of the given sash's height. The SVG's CSS
   * aspect-ratio matches its viewBox exactly, so there is no letterboxing to
   * correct for and the mapping is a straight ratio. */
  const yToFraction = useCallback((clientY: number, sash: Sash) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return 0;
    const vbY = ((clientY - rect.top) / rect.height) * VB_H;
    return (vbY - sash.y) / sash.h;
  }, []);

  const dragRef = useRef<{ sash: Sash; rail: "t" | "b" } | null>(null);

  const onPointerDown = (e: React.PointerEvent, sash: Sash, rail: "t" | "b") => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { sash, rail };
    setTouched(true);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    const { sash, rail } = drag;
    const raw = yToFraction(e.clientY, sash);
    const minSpan = MIN_SPAN / sash.h;

    setPos((prev) => {
      const cur = prev[sash.id];
      if (rail === "t") {
        return { ...prev, [sash.id]: { ...cur, t: clamp(raw, 0, cur.b - minSpan) } };
      }
      return { ...prev, [sash.id]: { ...cur, b: clamp(raw, cur.t + minSpan, 1) } };
    });
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  /** Keyboard nudging, so the rails are not mouse-only. */
  const onKeyDown = (e: React.KeyboardEvent, sash: Sash, rail: "t" | "b") => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    setTouched(true);
    const delta = (e.key === "ArrowUp" ? -1 : 1) * 0.04;
    const minSpan = MIN_SPAN / sash.h;
    setPos((prev) => {
      const cur = prev[sash.id];
      if (rail === "t") {
        return { ...prev, [sash.id]: { ...cur, t: clamp(cur.t + delta, 0, cur.b - minSpan) } };
      }
      return { ...prev, [sash.id]: { ...cur, b: clamp(cur.b + delta, cur.t + minSpan, 1) } };
    });
  };

  const ids = {
    fold: `plFold${uid}`,
    railGrad: `plRail${uid}`,
    railCap: `plRailCap${uid}`,
    glass: `plGlass${uid}`,
    blur: `plBlur${uid}`,
    sheen: `plSheen${uid}`,
    round: `plRound${uid}`,
    castTop: `plCastTop${uid}`,
    castBottom: `plCastBottom${uid}`,
    opening: `plOpening${uid}`,
    wallGrad: `plWall${uid}`,
    floorGrad: `plFloor${uid}`,
  };

  return (
    <div className="plisy-hero">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        className="plisy-hero-svg"
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerLeave={endDrag}
        role="group"
        aria-label="Podgląd plisy: przeciągnij górną lub dolną listwę, aby zobaczyć, jak plisa zasłania dowolny fragment okna"
      >
        <defs>
          {/* One pleat. The hard edge at 52% is the crease - without it the
              fabric reads as a flat dark block instead of stacked folds. */}
          <linearGradient id={ids.fold} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={fabric.edge} />
            <stop offset="22%" stopColor={fabric.base} />
            <stop offset="46%" stopColor={fabric.lit} />
            <stop offset="51%" stopColor={fabric.base} />
            <stop offset="52%" stopColor={fabric.shade} />
            <stop offset="78%" stopColor={fabric.edge} />
            <stop offset="100%" stopColor={fabric.shade} />
          </linearGradient>

          {/* The view photo fills the whole window opening once; each sash
              clips its own piece of it, so the two panes line up like one
              scene seen through one window. */}
          <clipPath id={ids.opening}>
            <rect x={SASHES[0].x} y={SASHES[0].y} width={SASHES[1].x + SASHES[1].w - SASHES[0].x} height={SASHES[0].h} />
          </clipPath>

          {/* Cross-fabric roundness: pleats bow slightly, so the edges sit in
              shadow and the centre catches the light. */}
          <linearGradient id={ids.round} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#000" stopOpacity="0.22" />
            <stop offset="14%" stopColor="#000" stopOpacity="0.05" />
            <stop offset="46%" stopColor="#fff" stopOpacity="0.035" />
            <stop offset="80%" stopColor="#000" stopOpacity="0.05" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.24" />
          </linearGradient>

          <linearGradient id={ids.railGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RAIL_LIT} />
            <stop offset="38%" stopColor={RAIL} />
            <stop offset="100%" stopColor={RAIL_DARK} />
          </linearGradient>
          <linearGradient id={ids.railCap} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f6f8f9" />
            <stop offset="100%" stopColor="#9aa1a6" />
          </linearGradient>

          {/* Shadow the fabric throws onto the glass, above and below. */}
          <linearGradient id={ids.castBottom} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000" stopOpacity="0.32" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </linearGradient>
          <linearGradient id={ids.castTop} x1="0" y1="1" x2="0" y2="0">
            <stop offset="0%" stopColor="#000" stopOpacity="0.22" />
            <stop offset="100%" stopColor="#000" stopOpacity="0" />
          </linearGradient>

          <linearGradient id={ids.glass} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a4cdec" />
            <stop offset="38%" stopColor="#d7e9f6" />
            <stop offset="55%" stopColor="#e9f1e5" />
            <stop offset="100%" stopColor="#b7cea4" />
          </linearGradient>
          <linearGradient id={ids.sheen} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.46" />
            <stop offset="40%" stopColor="#fff" stopOpacity="0.07" />
            <stop offset="100%" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <filter id={ids.blur} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="16" />
          </filter>
        </defs>

        {/* Room: wall, floor under the sill, then the room's own furniture. */}
        <linearGradient id={ids.wallGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={room.wall} />
          <stop offset="100%" stopColor={room.wallDark} />
        </linearGradient>
        <linearGradient id={ids.floorGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={room.floorDark} />
          <stop offset="100%" stopColor={room.floor} />
        </linearGradient>
        <rect x="0" y="0" width={VB_W} height={VB_H} fill={`url(#${ids.wallGrad})`} />
        <rect x="0" y="640" width={VB_W} height={VB_H - 640} fill={`url(#${ids.floorGrad})`} />
        {room.paint(uid)}
        {/* Reveal: a bevel around the frame, so the wall reads as having depth */}
        <rect x="130" y="52" width="740" height="540" rx="8" fill="#000" opacity="0.08" />
        <rect x="140" y="60" width="720" height="526" rx="8" fill="#fbfcfd" />
        {/* Frame */}
        <rect x="150" y="68" width="700" height="512" rx="10" fill="#f6f9fb" stroke="#ccd5dd" strokeWidth="2" />
        {/* Sill */}
        <rect x="126" y="580" width="748" height="22" rx="5" fill="#eef3f7" stroke="#ccd5dd" strokeWidth="1.5" />
        <rect x="126" y="602" width="748" height="6" fill="#000" opacity="0.12" />

        {SASHES.map((sash) => {
          const p = pos[sash.id];
          const topY = sash.y + p.t * sash.h;
          const botY = sash.y + p.b * sash.h;
          const fabricTop = topY + RAIL_H;
          const fabricH = Math.max(0, botY - RAIL_H - fabricTop);
          const pitch = Math.max(2.2, fabricH / PLEATS);
          const patternId = `plPleats${uid}${sash.id}`;
          const clipId = `plClip${uid}${sash.id}`;

          return (
            <g key={sash.id}>
              <defs>
                {/* Pitch follows the span, so a short blind has tight folds. */}
                <pattern
                  id={patternId}
                  patternUnits="userSpaceOnUse"
                  x={sash.x}
                  y={fabricTop}
                  width={sash.w}
                  height={pitch}
                >
                  <rect width={sash.w} height={pitch} fill={`url(#${ids.fold})`} />
                </pattern>
                <clipPath id={clipId}>
                  <rect x={sash.x} y={sash.y} width={sash.w} height={sash.h} />
                </clipPath>
              </defs>

              {/* Sash rebate */}
              <rect
                x={sash.x - 20}
                y={sash.y - 20}
                width={sash.w + 40}
                height={sash.h + 40}
                rx="6"
                fill="#fcfdfe"
                stroke="#d5dde4"
                strokeWidth="2"
              />

              <g clipPath={`url(#${clipId})`}>
                {/* The view. Sky gradient underneath covers the photo's load time. */}
                <rect x={sash.x} y={sash.y} width={sash.w} height={sash.h} fill={`url(#${ids.glass})`} />
                <image
                  key={view.id}
                  href={view.src}
                  x={SASHES[0].x}
                  y={SASHES[0].y}
                  width={SASHES[1].x + SASHES[1].w - SASHES[0].x}
                  height={SASHES[0].h}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath={`url(#${ids.opening})`}
                />
                <rect x={sash.x} y={sash.y} width={sash.w} height={sash.h} fill={`url(#${ids.sheen})`} />

                {/* Shadow cast onto the glass beyond each rail */}
                <rect x={sash.x} y={botY} width={sash.w} height={54} fill={`url(#${ids.castBottom})`} />
                <rect x={sash.x} y={Math.max(sash.y, topY - 40)} width={sash.w} height={Math.min(40, topY - sash.y)} fill={`url(#${ids.castTop})`} />

                {/* Fabric */}
                {fabricH > 0 ? (
                  <>
                    <rect x={sash.x} y={fabricTop} width={sash.w} height={fabricH} fill={`url(#${patternId})`} />
                    <rect x={sash.x} y={fabricTop} width={sash.w} height={fabricH} fill={`url(#${ids.round})`} />
                  </>
                ) : null}

                {/* Rails. Drawn after the fabric so their shadow line reads. */}
                {(["t", "b"] as const).map((rail) => {
                  const railY = rail === "t" ? topY : botY - RAIL_H;
                  return (
                    <g
                      key={rail}
                      className="plisy-hero-rail"
                      role="slider"
                      tabIndex={0}
                      aria-label={
                        rail === "t"
                          ? `Górna listwa, ${sash.id === "left" ? "lewe" : "prawe"} skrzydło`
                          : `Dolna listwa, ${sash.id === "left" ? "lewe" : "prawe"} skrzydło`
                      }
                      aria-orientation="vertical"
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round((rail === "t" ? p.t : p.b) * 100)}
                      onPointerDown={(e) => onPointerDown(e, sash, rail)}
                      onKeyDown={(e) => onKeyDown(e, sash, rail)}
                    >
                      {/* Fat invisible hit area - 14 px of rail is too thin to grab. */}
                      <rect
                        x={sash.x - 4}
                        y={railY - 13}
                        width={sash.w + 8}
                        height={RAIL_H + 26}
                        fill="transparent"
                      />
                      <rect
                        x={sash.x - 3}
                        y={railY}
                        width={sash.w + 6}
                        height={RAIL_H}
                        rx={RAIL_H * 0.3}
                        fill={`url(#${ids.railGrad})`}
                      />
                      {/* End caps */}
                      <rect x={sash.x - 3} y={railY} width="9" height={RAIL_H} rx="3" fill={`url(#${ids.railCap})`} />
                      <rect x={sash.x + sash.w - 6} y={railY} width="9" height={RAIL_H} rx="3" fill={`url(#${ids.railCap})`} />
                      {/* Grip tab, as on the real hardware - and the drag affordance */}
                      <rect
                        x={sash.x + sash.w / 2 - 17}
                        y={rail === "t" ? railY - 5 : railY + RAIL_H - 4}
                        width="34"
                        height="9"
                        rx="4.5"
                        fill={`url(#${ids.railCap})`}
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
        <rect x="492" y="302" width="14" height="58" rx="7" fill="#e6ebef" stroke="#c3ccd3" strokeWidth="1.5" />
      </svg>

      {!touched ? (
        <p className="plisy-hero-hint" aria-hidden="true">
          ↕ Przeciągnij listwy
        </p>
      ) : null}

      <div className="plisy-hero-picks">
        <div className="plisy-hero-pick" role="group" aria-label="Pomieszczenie">
          <span className="plisy-hero-pick-label">Pomieszczenie</span>
          <div className="plisy-hero-pick-row">
            {HERO_ROOMS.map((r) => (
              <button
                key={r.id}
                type="button"
                className={`plisy-hero-pill ${r.id === roomId ? "is-active" : ""}`}
                aria-pressed={r.id === roomId}
                onClick={() => setRoomId(r.id)}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        <div className="plisy-hero-pick" role="group" aria-label="Widok za oknem">
          <span className="plisy-hero-pick-label">Za oknem</span>
          <div className="plisy-hero-pick-row">
            {HERO_VIEWS.map((v) => (
              <button
                key={v.id}
                type="button"
                className={`plisy-hero-pill ${v.id === viewId ? "is-active" : ""}`}
                aria-pressed={v.id === viewId}
                onClick={() => setViewId(v.id)}
              >
                {v.label}
              </button>
            ))}
          </div>
        </div>

        <div className="plisy-hero-pick" role="group" aria-label="Kolor tkaniny">
          <span className="plisy-hero-pick-label">Tkanina</span>
          <div className="plisy-hero-pick-row">
            {FABRICS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={`plisy-hero-swatch ${f.id === fabricId ? "is-active" : ""}`}
                aria-pressed={f.id === fabricId}
                aria-label={f.label}
                title={f.label}
                style={{ background: `linear-gradient(180deg, ${f.lit} 0%, ${f.base} 50%, ${f.shade} 100%)` }}
                onClick={() => setFabricId(f.id)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
