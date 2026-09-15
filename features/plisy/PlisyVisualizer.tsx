"use client";

// Interactive plisa visualizer for the plisy landing: a real room photo, a
// real view painted into the glass, and a drawn plisa on each sash whose two
// rails the visitor can drag. Lives BELOW the description now, as an extra -
// the owner (2026-09-15): "cały ten wizualizator daj niżej - na samej górze
// nadal będzie musiało być zdjęcie... wizualizator będzie opcją dodatkową i
// na desktopie na pewno jest za duży". The photo slideshow that took its
// place at the top is PlisyHeroPhotos.tsx.
//
// Everything that can be a photo is a photo (see visualizer-scenes.ts for
// why). Only the plisa is drawn, because that is what has to move.
//
// Fidelity rules from the owner's own installation photos and confirmed
// product facts:
//   - no side guide rails (this mounting system has none - owner, 2026-09-09)
//   - both rails move; the fabric spans between them
//   - a fixed number of pleats, so they compress as the span shortens
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { ROOMS, VIEWS, VB_H, VB_W, type Rect, type RoomDef, type SashDef } from "./visualizer-scenes";

/** Pleat count per sash. Real pleats are ~20 mm; on a ~1.3 m sash that is
 * ~60, but at this render size 40 reads as fabric while 60 reads as noise. */
const PLEATS = 40;

/** A handful of fabric tones. Anthracite first - it is what the owner's own
 * installations use. The full swatch book lives in the configurator; this
 * is about seeing a light fabric in a light room and a dark one in a dark
 * room. Hand-picked lit/shade stops rather than plShiftHex, because the
 * light fabrics washed out with a computed spread. */
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

type Pos = { t: number; b: number };

/** Short demo per room: the first sash makes one top-down move and comes
 * back, then stops. Enough to show the top rail moves - the thing nobody
 * expects from a blind - without looping forever next to real photos. */
const DEMO_STEP_MS = 1900;
const DEMO_HOLD_MS = 700;

function easeInOut(x: number): number {
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

/** Rail thickness scales with the sash so a small window does not get a rail
 * as thick as a big one's - but never so thin it cannot be grabbed. */
function railHeight(sash: Rect): number {
  return clamp(sash.h * 0.04, 7, 16);
}

function minSpan(sash: Rect): number {
  return (railHeight(sash) * 2 + 14) / sash.h;
}

function restPositions(room: RoomDef): Record<string, Pos> {
  return Object.fromEntries(room.sashes.map((s) => [s.id, s.rest]));
}

function demoFrames(room: RoomDef): Pos[] {
  const rest = room.sashes[0].rest;
  const down = clamp(rest.t + 0.3, 0, rest.b - 0.15);
  return [rest, { t: down, b: rest.b }, { t: down, b: clamp(rest.b + 0.12, 0, 1) }, rest];
}

export default function PlisyVisualizer() {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const svgRef = useRef<SVGSVGElement | null>(null);

  const [roomId, setRoomId] = useState(ROOMS[0].id);
  const [viewId, setViewId] = useState(VIEWS[0].id);
  const [fabricId, setFabricId] = useState<(typeof FABRICS)[number]["id"]>(FABRICS[0].id);
  const room = ROOMS.find((r) => r.id === roomId) || ROOMS[0];
  const view = VIEWS.find((v) => v.id === viewId) || VIEWS[0];
  const fabric = FABRICS.find((f) => f.id === fabricId) || FABRICS[0];

  const [pos, setPos] = useState<Record<string, Pos>>(() => restPositions(ROOMS[0]));
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

  const pickRoom = (id: string) => {
    const next = ROOMS.find((r) => r.id === id) || ROOMS[0];
    setRoomId(next.id);
    setPos(restPositions(next));
  };

  // One demo pass per room switch, on the first sash only.
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (touched || reduced) return;
    const frames = demoFrames(room);
    const sashId = room.sashes[0].id;
    const cycle = DEMO_STEP_MS + DEMO_HOLD_MS;
    const total = (frames.length - 1) * cycle;
    let start: number | null = null;

    const tick = (now: number) => {
      if (start === null) start = now;
      const elapsed = now - start;
      if (elapsed >= total) {
        setPos((prev) => ({ ...prev, [sashId]: frames[frames.length - 1] }));
        return;
      }
      const leg = Math.floor(elapsed / cycle);
      const within = elapsed - leg * cycle;
      const p = easeInOut(clamp(within / DEMO_STEP_MS, 0, 1));
      const from = frames[leg];
      const to = frames[leg + 1];
      setPos((prev) => ({
        ...prev,
        [sashId]: { t: from.t + (to.t - from.t) * p, b: from.b + (to.b - from.b) * p },
      }));
      rafRef.current = requestAnimationFrame(tick);
    };

    const delay = window.setTimeout(() => {
      rafRef.current = requestAnimationFrame(tick);
    }, 700);
    return () => {
      window.clearTimeout(delay);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [room, touched, reduced]);

  /** Pointer y -> fraction of the sash. The SVG's CSS aspect-ratio matches
   * its viewBox, so there is no letterboxing and the mapping is a ratio. */
  const yToFraction = useCallback((clientY: number, sash: Rect) => {
    const rect = svgRef.current?.getBoundingClientRect();
    if (!rect || rect.height === 0) return 0;
    const vbY = ((clientY - rect.top) / rect.height) * VB_H;
    return (vbY - sash.y) / sash.h;
  }, []);

  const dragRef = useRef<{ sash: SashDef; rail: "t" | "b" } | null>(null);

  const onPointerDown = (e: React.PointerEvent, sash: SashDef, rail: "t" | "b") => {
    e.preventDefault();
    (e.currentTarget as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { sash, rail };
    setTouched(true);
  };

  const moveRail = (sash: SashDef, rail: "t" | "b", value: number) => {
    const gap = minSpan(sash.rect);
    setPos((prev) => {
      const cur = prev[sash.id] || sash.rest;
      if (rail === "t") return { ...prev, [sash.id]: { ...cur, t: clamp(value, 0, cur.b - gap) } };
      return { ...prev, [sash.id]: { ...cur, b: clamp(value, cur.t + gap, 1) } };
    });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const drag = dragRef.current;
    if (!drag) return;
    moveRail(drag.sash, drag.rail, yToFraction(e.clientY, drag.sash.rect));
  };

  const endDrag = () => {
    dragRef.current = null;
  };

  const onKeyDown = (e: React.KeyboardEvent, sash: SashDef, rail: "t" | "b") => {
    if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
    e.preventDefault();
    setTouched(true);
    const cur = pos[sash.id] || sash.rest;
    const delta = (e.key === "ArrowUp" ? -1 : 1) * 0.04;
    moveRail(sash, rail, (rail === "t" ? cur.t : cur.b) + delta);
  };

  // One view image across the whole window, so a two-sash window shows one
  // continuous scene rather than the same house twice. Each sash then clips
  // its glass out of it.
  const win = room.sashes.reduce(
    (acc, s) => ({
      x0: Math.min(acc.x0, s.rect.x),
      y0: Math.min(acc.y0, s.rect.y),
      x1: Math.max(acc.x1, s.rect.x + s.rect.w),
      y1: Math.max(acc.y1, s.rect.y + s.rect.h),
    }),
    { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity },
  );

  const ids = {
    fold: `plvFold${uid}`,
    round: `plvRound${uid}`,
    rail: `plvRail${uid}`,
    cap: `plvCap${uid}`,
    castBottom: `plvCastB${uid}`,
    castTop: `plvCastT${uid}`,
    occluder: `plvOcc${uid}`,
  };

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
            <linearGradient id={ids.castBottom} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#000" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </linearGradient>
            <linearGradient id={ids.castTop} x1="0" y1="1" x2="0" y2="0">
              <stop offset="0%" stopColor="#000" stopOpacity="0.2" />
              <stop offset="100%" stopColor="#000" stopOpacity="0" />
            </linearGradient>
            {room.occluders?.length ? (
              <clipPath id={ids.occluder}>
                {room.occluders.map((o, i) => (
                  <rect key={i} x={o.x} y={o.y} width={o.w} height={o.h} />
                ))}
              </clipPath>
            ) : null}
          </defs>

          {/* The room. Everything else is painted over it. */}
          <image href={room.src} x="0" y="0" width={VB_W} height={VB_H} preserveAspectRatio="xMidYMid slice" />

          {room.sashes.map((sash) => {
            const r = sash.rect;
            const p = pos[sash.id] || sash.rest;
            const railH = railHeight(r);
            const topY = r.y + p.t * r.h;
            const botY = r.y + p.b * r.h;
            const fabricTop = topY + railH;
            const fabricH = Math.max(0, botY - railH - fabricTop);
            const pitch = Math.max(2, fabricH / PLEATS);
            const patternId = `plvPleats${uid}${sash.id}`;
            const clipSash = `plvClipS${uid}${sash.id}`;
            const clipGlass = `plvClipG${uid}${sash.id}`;
            const panes = sash.panes || [r];

            return (
              <g key={sash.id}>
                <defs>
                  <pattern id={patternId} patternUnits="userSpaceOnUse" x={r.x} y={fabricTop} width={r.w} height={pitch}>
                    <rect width={r.w} height={pitch} fill={`url(#${ids.fold})`} />
                  </pattern>
                  <clipPath id={clipSash}>
                    <rect x={r.x} y={r.y} width={r.w} height={r.h} />
                  </clipPath>
                  <clipPath id={clipGlass}>
                    {panes.map((pane, i) => (
                      <rect key={i} x={pane.x} y={pane.y} width={pane.w} height={pane.h} />
                    ))}
                  </clipPath>
                </defs>

                {/* The view, through the glass only - muntins stay the photo's own. */}
                <g clipPath={`url(#${clipGlass})`}>
                  <image
                    key={view.id}
                    href={view.src}
                    x={win.x0}
                    y={win.y0}
                    width={win.x1 - win.x0}
                    height={win.y1 - win.y0}
                    preserveAspectRatio="xMidYMid slice"
                  />
                  {sash.bars?.rects.map((b, i) => (
                    <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} fill={sash.bars!.color} />
                  ))}
                  {/* Light spill on the glass past each rail */}
                  <rect x={r.x} y={botY} width={r.w} height={r.h * 0.12} fill={`url(#${ids.castBottom})`} />
                  <rect x={r.x} y={Math.max(r.y, topY - r.h * 0.08)} width={r.w} height={Math.min(r.h * 0.08, topY - r.y)} fill={`url(#${ids.castTop})`} />
                </g>

                {/* The plisa, clipped to the sash. */}
                <g clipPath={`url(#${clipSash})`}>
                  {fabricH > 0 ? (
                    <>
                      <rect x={r.x} y={fabricTop} width={r.w} height={fabricH} fill={`url(#${patternId})`} />
                      <rect x={r.x} y={fabricTop} width={r.w} height={fabricH} fill={`url(#${ids.round})`} />
                    </>
                  ) : null}

                  {(["t", "b"] as const).map((rail) => {
                    const railY = rail === "t" ? topY : botY - railH;
                    const cap = Math.min(9, r.w * 0.04);
                    const grip = Math.min(34, r.w * 0.16);
                    return (
                      <g
                        key={rail}
                        className="plisy-viz-rail"
                        role="slider"
                        tabIndex={0}
                        aria-label={`${rail === "t" ? "Górna" : "Dolna"} listwa, ${room.label.toLowerCase()}`}
                        aria-orientation="vertical"
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round((rail === "t" ? p.t : p.b) * 100)}
                        onPointerDown={(e) => onPointerDown(e, sash, rail)}
                        onKeyDown={(e) => onKeyDown(e, sash, rail)}
                      >
                        {/* Fat invisible hit area; the rail itself is too thin to grab. */}
                        <rect x={r.x - 4} y={railY - 16} width={r.w + 8} height={railH + 32} fill="transparent" />
                        <rect x={r.x - 2} y={railY} width={r.w + 4} height={railH} rx={railH * 0.3} fill={`url(#${ids.rail})`} />
                        <rect x={r.x - 2} y={railY} width={cap} height={railH} rx="3" fill={`url(#${ids.cap})`} />
                        <rect x={r.x + r.w + 2 - cap} y={railY} width={cap} height={railH} rx="3" fill={`url(#${ids.cap})`} />
                        <rect
                          x={r.x + r.w / 2 - grip / 2}
                          y={rail === "t" ? railY - 4 : railY + railH - 4}
                          width={grip}
                          height="8"
                          rx="4"
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

          {/* Objects in front of the window, painted back on top. */}
          {room.occluders?.length ? (
            <image href={room.src} x="0" y="0" width={VB_W} height={VB_H} preserveAspectRatio="xMidYMid slice" clipPath={`url(#${ids.occluder})`} />
          ) : null}
        </svg>

        {!touched ? (
          <p className="plisy-viz-hint" aria-hidden="true">
            ↕ Przeciągnij listwy
          </p>
        ) : null}
      </div>

      <div className="plisy-viz-picks">
        <div className="plisy-viz-pick" role="group" aria-label="Pomieszczenie">
          <span className="plisy-viz-pick-label">Pomieszczenie</span>
          <div className="plisy-viz-pick-row">
            {ROOMS.map((r) => (
              <button key={r.id} type="button" className={`plisy-viz-pill ${r.id === roomId ? "is-active" : ""}`} aria-pressed={r.id === roomId} onClick={() => pickRoom(r.id)}>
                {r.label}
              </button>
            ))}
          </div>
        </div>
        <div className="plisy-viz-pick" role="group" aria-label="Widok za oknem">
          <span className="plisy-viz-pick-label">Za oknem</span>
          <div className="plisy-viz-pick-row">
            {VIEWS.map((v) => (
              <button key={v.id} type="button" className={`plisy-viz-pill ${v.id === viewId ? "is-active" : ""}`} aria-pressed={v.id === viewId} onClick={() => setViewId(v.id)}>
                {v.label}
              </button>
            ))}
          </div>
        </div>
        <div className="plisy-viz-pick" role="group" aria-label="Kolor tkaniny">
          <span className="plisy-viz-pick-label">Tkanina</span>
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
      </div>
    </div>
  );
}
