"use client";

// Hero animation for plisy - a rendered product presentation, not a video.
//
// Owner's brief (2026-09-16): the window turns gently like a studio
// presentation, the two blinds move independently up/down and change
// colour. The AI video attempts (Veo) failed the mechanics - the fabric
// slid around as a rigid block and blurred - so the fabric is rendered
// here with real concertina physics: a fixed number of pleats between two
// rails, the pleats fold tighter as the rails come together and fan open
// as they part, the fold shading steepens with compression.
//
// Base plate: /plisy/hero/studio-window.jpg - a photoreal studio shot of an
// empty white double-sash window (drawn by gemini-2.5-flash-image from the
// owner's real installation photo). The glass rectangles are measured in
// that image's pixel space (1344x768) and everything below is drawn in the
// same coordinate system, scaled to the canvas at device pixel ratio, so it
// stays razor sharp on every screen. The gentle turn is a CSS 3D rotation of
// the whole plate.
import { useEffect, useRef, useSyncExternalStore } from "react";

export const PLISY_HERO_BASE_SRC = "/plisy/hero/studio-window.jpg";
const IMG_W = 1344;
const IMG_H = 768;

// Glass openings (inside the glazing bead) in base-plate pixels.
const PANES = [
  { x: 342, y: 118, w: 275, h: 511 },
  { x: 721, y: 118, w: 271, h: 511 },
];

const PLEATS = 26; // pleat count per blind; ~20 mm pitch when fully open
const RAIL_H = 9;
const LOOP_MS = 26000;

type Rgb = [number, number, number];
// Real collection shades (Klasyczne / Termiczne) - pleasant on a white frame.
const PALETTE_LEFT: Rgb[] = [
  [214, 199, 178], // beż
  [240, 238, 232], // biały
  [160, 176, 160], // szałwia
  [206, 178, 176], // pudrowy róż
];
const PALETTE_RIGHT: Rgb[] = [
  [86, 90, 96], // grafit
  [38, 52, 84], // granat
  [190, 124, 96], // terakota
  [188, 190, 192], // popiel
];

// Keyframes: [time in ms, top rail fraction, bottom rail fraction] of the
// pane height (0 = top edge of glass, 1 = bottom edge). Fabric hangs
// between the two rails. Holds are written as repeated values.
type Key = [number, number, number];
const KEYS_LEFT: Key[] = [
  [0, 0, 0.55],
  [3200, 0, 0.55],
  [6200, 0, 0.22], // folds up under the top rail
  [7600, 0, 0.22],
  [11000, 0.32, 0.72], // both rails down: privacy band in the middle
  [12600, 0.32, 0.72],
  [16000, 0.32, 1.0], // bottom rail all the way down
  [17400, 0.32, 1.0],
  [20600, 0, 1.0], // fully closed
  [22000, 0, 1.0],
  [26000, 0, 0.55], // back to start (loop)
];
const KEYS_RIGHT: Key[] = [
  [0, 0.45, 1.0],
  [1600, 0.45, 1.0],
  [4800, 0.78, 1.0], // folds down onto the bottom rail
  [6400, 0.78, 1.0],
  [9800, 0.12, 1.0], // rises almost fully
  [11200, 0.12, 1.0],
  [14600, 0.25, 0.62], // both rails: band in the middle
  [16200, 0.25, 0.62],
  [19400, 0, 0.62], // top rail up
  [20800, 0, 0.62],
  [24200, 0.45, 1.0], // back to start
  [26000, 0.45, 1.0],
];
// Colour changes happen while the blind rests, so the eye reads them as a
// "different fabric" rather than a glitch.
const COLOR_TIMES_LEFT = [7000, 12000, 17000, 21500];
const COLOR_TIMES_RIGHT = [5600, 10500, 15400, 20100];
const COLOR_FADE_MS = 1400;

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

function railsAt(keys: Key[], t: number): [number, number] {
  let a = keys[0];
  let b = keys[keys.length - 1];
  for (let i = 0; i < keys.length - 1; i++) {
    if (t >= keys[i][0] && t <= keys[i + 1][0]) {
      a = keys[i];
      b = keys[i + 1];
      break;
    }
  }
  const span = b[0] - a[0];
  const p = span > 0 ? easeInOut(Math.min(1, Math.max(0, (t - a[0]) / span))) : 1;
  return [a[1] + (b[1] - a[1]) * p, a[2] + (b[2] - a[2]) * p];
}

function colorAt(palette: Rgb[], times: number[], t: number): Rgb {
  // index of the last colour change before t, blended with the next during the fade
  let idx = 0;
  let blend = 0;
  for (let i = 0; i < times.length; i++) {
    if (t >= times[i]) {
      idx = i + 1;
      const into = t - times[i];
      blend = into < COLOR_FADE_MS ? easeInOut(into / COLOR_FADE_MS) : 1;
    }
  }
  const from = palette[(idx - 1 + palette.length) % palette.length];
  const to = palette[idx % palette.length];
  if (idx === 0) return palette[0];
  return [0, 1, 2].map((c) => from[c] + (to[c] - from[c]) * blend) as Rgb;
}

const rgb = (c: Rgb, k = 1, a = 1) =>
  `rgba(${Math.round(Math.min(255, c[0] * k))}, ${Math.round(Math.min(255, c[1] * k))}, ${Math.round(Math.min(255, c[2] * k))}, ${a})`;

// Older WebKit (Safari < 16) has no CanvasRenderingContext2D.roundRect - it
// threw "e.roundRect is not a function" in live sessions on the plisy
// landing (2026-09-17), killing the hero scene. A hand-built path costs
// nothing and needs no per-frame feature detection.
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}

function drawRail(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  // slim white aluminium profile with a soft shadow below and a small handle
  ctx.save();
  ctx.shadowColor = "rgba(20, 30, 45, 0.28)";
  ctx.shadowBlur = 6;
  ctx.shadowOffsetY = 2;
  const g = ctx.createLinearGradient(0, y, 0, y + RAIL_H);
  g.addColorStop(0, "#ffffff");
  g.addColorStop(0.55, "#f1f3f5");
  g.addColorStop(1, "#d3d7dc");
  ctx.fillStyle = g;
  ctx.beginPath();
  roundRectPath(ctx, x, y, w, RAIL_H, 2);
  ctx.fill();
  ctx.restore();
  ctx.fillStyle = "rgba(120, 128, 138, 0.55)";
  ctx.fillRect(x + w / 2 - 11, y + RAIL_H / 2 - 1.2, 22, 2.4);
}

function drawBlind(ctx: CanvasRenderingContext2D, pane: (typeof PANES)[number], top: number, bottom: number, color: Rgb, weave: CanvasPattern | null) {
  const railTop = pane.y + top * (pane.h - RAIL_H * 2);
  const railBottom = pane.y + bottom * (pane.h - RAIL_H * 2) + RAIL_H;
  const fabricTop = railTop + RAIL_H;
  const fabricH = Math.max(0, railBottom - fabricTop);
  const pitchMax = (pane.h - RAIL_H * 2) / PLEATS;
  const pitch = fabricH / PLEATS;
  const compression = 1 - Math.min(1, pitch / pitchMax); // 0 open .. 1 stacked
  const inset = 2; // fabric sits a hair inside the bead
  const x = pane.x + inset;
  const w = pane.w - inset * 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(pane.x, pane.y, pane.w, pane.h);
  ctx.clip();

  if (fabricH > 0.5) {
    // soft contact shadow of the fabric on the glass (depth)
    ctx.fillStyle = "rgba(30, 40, 55, 0.18)";
    ctx.fillRect(x + 3, fabricTop + 3, w, fabricH);

    // base body of the fabric - light comes from the upper left
    const body = ctx.createLinearGradient(x, 0, x + w, 0);
    body.addColorStop(0, rgb(color, 1.04));
    body.addColorStop(0.5, rgb(color, 1.0));
    body.addColorStop(1, rgb(color, 0.93));
    ctx.fillStyle = body;
    ctx.fillRect(x, fabricTop, w, fabricH);

    // pleats: each pleat = upward face (lit) + downward face (shaded). The
    // steeper the folds (more compression), the stronger the contrast.
    const lit = 1.06 + 0.1 * compression;
    const shade = 0.84 - 0.2 * compression;
    for (let i = 0; i < PLEATS; i++) {
      const y0 = fabricTop + i * pitch;
      const half = pitch / 2;
      const gUp = ctx.createLinearGradient(0, y0, 0, y0 + half);
      gUp.addColorStop(0, rgb(color, lit));
      gUp.addColorStop(1, rgb(color, 1.0));
      ctx.fillStyle = gUp;
      ctx.fillRect(x, y0, w, half + 0.5);
      const gDown = ctx.createLinearGradient(0, y0 + half, 0, y0 + pitch);
      gDown.addColorStop(0, rgb(color, 0.97));
      gDown.addColorStop(1, rgb(color, shade));
      ctx.fillStyle = gDown;
      ctx.fillRect(x, y0 + half, w, half + 0.5);
      // crease line at the fold
      ctx.fillStyle = `rgba(0, 0, 0, ${0.12 + 0.18 * compression})`;
      ctx.fillRect(x, y0 + pitch - 0.6, w, 0.9);
    }

    // fabric weave
    if (weave) {
      ctx.globalAlpha = 0.07;
      ctx.fillStyle = weave;
      ctx.fillRect(x, fabricTop, w, fabricH);
      ctx.globalAlpha = 1;
    }
    // tension cords running through the fabric
    ctx.fillStyle = "rgba(0, 0, 0, 0.09)";
    ctx.fillRect(x + w * 0.22, fabricTop, 1, fabricH);
    ctx.fillRect(x + w * 0.78, fabricTop, 1, fabricH);
    // slight darkening at the very edges (fabric turning away from the light)
    const edge = ctx.createLinearGradient(x, 0, x + w, 0);
    edge.addColorStop(0, "rgba(0,0,0,0.10)");
    edge.addColorStop(0.06, "rgba(0,0,0,0)");
    edge.addColorStop(0.94, "rgba(0,0,0,0)");
    edge.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = edge;
    ctx.fillRect(x, fabricTop, w, fabricH);
  }

  drawRail(ctx, x - 1, railTop, w + 2);
  drawRail(ctx, x - 1, railBottom, w + 2);
  ctx.restore();
}

function makeWeave(): CanvasPattern | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (!g) return null;
  // deterministic speckle - the same fabric every frame
  let seed = 7;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 900; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${0.35 + rnd() * 0.5})`;
    g.fillRect(rnd() * 64, rnd() * 64, 1, 1);
  }
  const ctx = document.createElement("canvas").getContext("2d");
  return ctx ? ctx.createPattern(c, "repeat") : null;
}

export default function PlisyHeroScene({ active = true }: { active?: boolean }) {
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const plateRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const reduced = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    const plate = plateRef.current;
    if (!canvas || !wrap || !plate) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const weave = makeWeave();

    let raf: number | null = null;
    let start: number | null = null;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const fit = () => {
      // layout size (clientWidth is unaffected by the 3D transform)
      dpr = Math.min(3, window.devicePixelRatio || 1);
      width = Math.max(1, plate.clientWidth);
      height = Math.max(1, plate.clientHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const render = (t: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // map base-plate pixels -> canvas (the plate is object-fit: cover)
      const s = Math.max(width / IMG_W, height / IMG_H) * dpr;
      const ox = (width * dpr - IMG_W * s) / 2;
      const oy = (height * dpr - IMG_H * s) / 2;
      ctx.setTransform(s, 0, 0, s, ox, oy);
      const [lt, lb] = railsAt(KEYS_LEFT, t);
      const [rt, rb] = railsAt(KEYS_RIGHT, t);
      drawBlind(ctx, PANES[0], lt, lb, colorAt(PALETTE_LEFT, COLOR_TIMES_LEFT, t), weave);
      drawBlind(ctx, PANES[1], rt, rb, colorAt(PALETTE_RIGHT, COLOR_TIMES_RIGHT, t), weave);
      // gentle showroom turn of the whole plate, with a light sweep across
      // it so the eye reads the turn as a change of lighting, not a flat
      // picture being skewed
      const phase = (t / LOOP_MS) * Math.PI * 2;
      const turn = reduced ? 0 : 7 * Math.sin(phase);
      const tilt = reduced ? 0 : 1.4 * Math.sin(phase * 2 + 1);
      if (!reduced) {
        const k = Math.sin(phase); // -1 .. 1
        const sweep = ctx.createLinearGradient(0, 0, IMG_W, 0);
        sweep.addColorStop(0, `rgba(0, 0, 0, ${(0.07 * Math.max(0, k)).toFixed(3)})`);
        sweep.addColorStop(0.5, `rgba(255, 255, 255, ${(0.035 * Math.abs(k)).toFixed(3)})`);
        sweep.addColorStop(1, `rgba(0, 0, 0, ${(0.07 * Math.max(0, -k)).toFixed(3)})`);
        ctx.fillStyle = sweep;
        ctx.fillRect(-IMG_W, -IMG_H, IMG_W * 3, IMG_H * 3);
      }
      plate.style.transform = `scale(1.07) rotateY(${turn.toFixed(2)}deg) rotateX(${tilt.toFixed(2)}deg)`;
    };

    const tick = (now: number) => {
      if (start === null) start = now;
      render((now - start) % LOOP_MS);
      raf = requestAnimationFrame(tick);
    };

    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(() => { fit(); render(start === null ? 0 : (performance.now() - start) % LOOP_MS); }) : null;
    ro?.observe(plate);

    if (reduced || !active) {
      render(0);
    } else {
      raf = requestAnimationFrame(tick);
    }
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [reduced, active]);

  return (
    <div className="plisy-hero-scene" ref={wrapRef} aria-label="Animacja: plisa okienna KEIKA - dwie niezależne belki, dowolne ustawienie od góry i od dołu, różne kolory tkanin" role="img">
      <div className="plisy-hero-scene-plate" ref={plateRef}>
        <img className="plisy-hero-scene-base" src={PLISY_HERO_BASE_SRC} alt="" aria-hidden="true" fetchPriority="high" decoding="async" />
        <canvas className="plisy-hero-scene-canvas" ref={canvasRef} aria-hidden="true" />
      </div>
    </div>
  );
}
