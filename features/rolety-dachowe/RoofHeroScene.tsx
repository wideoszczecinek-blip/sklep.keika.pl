"use client";

// Hero animation for rolety dachowe - a rendered product presentation on a
// photoreal attic plate, same idea as features/plisy/PlisyHeroScene.tsx:
// the blind is drawn on a canvas in the base image's own pixel space, so it
// stays razor sharp at any size, and the whole plate turns gently in 3D.
//
// Base plate: /rolety-dachowe/hero/attic-window.jpg - an empty pine roof
// window in a bright attic (generated with gemini-2.5-flash-image from the
// owner's own DEKO arrangement visual, 1344x768). The glass opening is a
// trapezoid measured in that image; everything below is drawn in that
// coordinate system: the aluminium cassette on top, the two side guides,
// the fabric unrolling from the cassette and the bottom bar with its handle
// and brush seal. The fabric stops at any height (the MULTISTOP brake the
// product is about), changes colour while it rests (real DEKO / TERMO
// swatch colours) and the hardware cycles through the three real finishes
// (biały, anoda, jasna sosna).
import { useEffect, useRef, useSyncExternalStore } from "react";

export const RD_HERO_BASE_SRC = "/rolety-dachowe/hero/attic-window.jpg";
const IMG_W = 1344;
const IMG_H = 768;

// Glass opening corners in base-plate pixels (top-left, top-right,
// bottom-right, bottom-left) - the window is seen from below, so the top
// edge is wider than the bottom one.
const PANE = { tl: [480, 96], tr: [905, 96], br: [876, 632], bl: [500, 632] } as const;
const PANE_H = PANE.bl[1] - PANE.tl[1];

const CASSETTE_H = 34;
const RAIL_W = 9;
const BAR_H = 16;
const LOOP_MS = 24000;

type Rgb = [number, number, number];
// Real swatch colours from the CRM profile: DEKO 01, TERMO 61, DEKO 13,
// TERMO 65, DEKO 19 - translucent DEKO shades alternate with opaque TERMO.
const FABRICS: Array<{ rgb: Rgb; termo: boolean }> = [
  { rgb: [218, 204, 165], termo: false },
  { rgb: [96, 102, 102], termo: true },
  { rgb: [190, 202, 182], termo: false },
  { rgb: [35, 70, 108], termo: true },
  { rgb: [128, 165, 192], termo: false },
];
const FABRIC_TIMES = [7000, 12300, 16700, 21200];
// Hardware finishes: biały, anoda, jasna sosna (CRM accent colours).
const HARDWARE: Rgb[] = [
  [244, 247, 248],
  [199, 206, 214],
  [229, 189, 114],
];
const HARDWARE_TIMES = [7000, 16700, 22600];
const FADE_MS = 1400;

// [time, bottom-bar position as a fraction of the pane height]
type Key = [number, number];
const KEYS: Key[] = [
  [0, 0.06],
  [2400, 0.06],
  [6000, 0.62],
  [7400, 0.62],
  [10500, 0.96],
  [12000, 0.96],
  [15000, 0.36],
  [16400, 0.36],
  [19500, 0.74],
  [21000, 0.74],
  [24000, 0.06],
];

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

function barAt(t: number): number {
  let a = KEYS[0];
  let b = KEYS[KEYS.length - 1];
  for (let i = 0; i < KEYS.length - 1; i++) {
    if (t >= KEYS[i][0] && t <= KEYS[i + 1][0]) {
      a = KEYS[i];
      b = KEYS[i + 1];
      break;
    }
  }
  const span = b[0] - a[0];
  const p = span > 0 ? easeInOut(Math.min(1, Math.max(0, (t - a[0]) / span))) : 1;
  return a[1] + (b[1] - a[1]) * p;
}

function cycleAt<T>(palette: T[], times: number[], t: number, mix: (from: T, to: T, k: number) => T): T {
  let idx = 0;
  let blend = 0;
  for (let i = 0; i < times.length; i++) {
    if (t >= times[i]) {
      idx = i + 1;
      const into = t - times[i];
      blend = into < FADE_MS ? easeInOut(into / FADE_MS) : 1;
    }
  }
  if (idx === 0) return palette[0];
  const from = palette[(idx - 1) % palette.length];
  const to = palette[idx % palette.length];
  return mix(from, to, blend);
}

const mixRgb = (a: Rgb, b: Rgb, k: number): Rgb => [0, 1, 2].map((c) => a[c] + (b[c] - a[c]) * k) as Rgb;
const rgb = (c: Rgb, k = 1, a = 1) =>
  `rgba(${Math.round(Math.min(255, c[0] * k))}, ${Math.round(Math.min(255, c[1] * k))}, ${Math.round(Math.min(255, c[2] * k))}, ${a})`;

// Point on the (perspective) pane: u across (0 left .. 1 right), v down
// (0 top .. 1 bottom). Edges are straight lines between the measured corners.
function pt(u: number, v: number): [number, number] {
  const xl = PANE.tl[0] + (PANE.bl[0] - PANE.tl[0]) * v;
  const xr = PANE.tr[0] + (PANE.br[0] - PANE.tr[0]) * v;
  return [xl + (xr - xl) * u, PANE.tl[1] + PANE_H * v];
}

// Older WebKit has no CanvasRenderingContext2D.roundRect (it killed the plisy
// hero scene live, 2026-09-17) - a hand-built path costs nothing.
function roundRectPath(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
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

function quad(ctx: CanvasRenderingContext2D, a: [number, number], b: [number, number], c: [number, number], d: [number, number]) {
  ctx.beginPath();
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
  ctx.lineTo(c[0], c[1]);
  ctx.lineTo(d[0], d[1]);
  ctx.closePath();
}

function metalGradient(ctx: CanvasRenderingContext2D, y0: number, y1: number, color: Rgb): CanvasGradient {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0, rgb(color, 1.06));
  g.addColorStop(0.45, rgb(color, 1.0));
  g.addColorStop(1, rgb(color, 0.82));
  return g;
}

function drawScene(ctx: CanvasRenderingContext2D, t: number, weave: CanvasPattern | null) {
  const v = barAt(t);
  const fabric = cycleAt(FABRICS, FABRIC_TIMES, t, (a, b, k) => ({ rgb: mixRgb(a.rgb, b.rgb, k), termo: k < 0.5 ? a.termo : b.termo }));
  const hardware = cycleAt(HARDWARE, HARDWARE_TIMES, t, mixRgb);
  const isSosna = hardware[0] > 215 && hardware[2] < 150;

  // --- fabric (clipped to the pane) ---------------------------------------
  const top = pt(0, 0);
  const topR = pt(1, 0);
  const botL = pt(0, v);
  const botR = pt(1, v);
  ctx.save();
  quad(ctx, PANE.tl as unknown as [number, number], PANE.tr as unknown as [number, number], PANE.br as unknown as [number, number], PANE.bl as unknown as [number, number]);
  ctx.clip();
  if (v > 0.01) {
    // contact shadow on the glass
    ctx.fillStyle = "rgba(25, 32, 45, 0.16)";
    quad(ctx, [top[0] + 4, top[1] + 4], [topR[0] + 4, topR[1] + 4], [botR[0] + 4, botR[1] + 6], [botL[0] + 4, botL[1] + 6]);
    ctx.fill();
    // fabric body - lit from the upper left, DEKO slightly translucent
    const alpha = fabric.termo ? 1 : 0.9;
    const body = ctx.createLinearGradient(top[0], 0, topR[0], 0);
    body.addColorStop(0, rgb(fabric.rgb, 1.05, alpha));
    body.addColorStop(0.55, rgb(fabric.rgb, 1.0, alpha));
    body.addColorStop(1, rgb(fabric.rgb, 0.9, alpha));
    ctx.fillStyle = body;
    quad(ctx, top, topR, botR, botL);
    ctx.fill();
    // vertical tension shading near the guides
    const edge = ctx.createLinearGradient(top[0], 0, topR[0], 0);
    edge.addColorStop(0, "rgba(0,0,0,0.16)");
    edge.addColorStop(0.05, "rgba(0,0,0,0)");
    edge.addColorStop(0.95, "rgba(0,0,0,0)");
    edge.addColorStop(1, "rgba(0,0,0,0.18)");
    ctx.fillStyle = edge;
    quad(ctx, top, topR, botR, botL);
    ctx.fill();
    // faint horizontal weave + a soft sheen band (TERMO has the smooth face)
    if (weave) {
      ctx.globalAlpha = fabric.termo ? 0.05 : 0.09;
      ctx.fillStyle = weave;
      quad(ctx, top, topR, botR, botL);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
    const sheen = ctx.createLinearGradient(0, top[1], 0, botL[1]);
    sheen.addColorStop(0, "rgba(255,255,255,0.10)");
    sheen.addColorStop(0.35, "rgba(255,255,255,0)");
    sheen.addColorStop(1, "rgba(0,0,0,0.06)");
    ctx.fillStyle = sheen;
    quad(ctx, top, topR, botR, botL);
    ctx.fill();
  }
  ctx.restore();

  // --- side guides ------------------------------------------------------------
  const railTop = PANE.tl[1] + 2;
  for (const side of [0, 1] as const) {
    const a = pt(side, 0);
    const b = pt(side, 1);
    const dir = side === 0 ? 1 : -1;
    ctx.save();
    ctx.shadowColor = "rgba(20, 30, 45, 0.25)";
    ctx.shadowBlur = 4;
    ctx.shadowOffsetX = dir * 1.5;
    const g = ctx.createLinearGradient(a[0], 0, a[0] + dir * RAIL_W, 0);
    g.addColorStop(0, rgb(hardware, 0.8));
    g.addColorStop(0.4, rgb(hardware, 1.04));
    g.addColorStop(1, rgb(hardware, 0.9));
    ctx.fillStyle = g;
    quad(ctx, [a[0] - dir * 2, railTop], [a[0] + dir * RAIL_W, railTop], [b[0] + dir * RAIL_W, b[1]], [b[0] - dir * 2, b[1]]);
    ctx.fill();
    ctx.restore();
  }

  // --- bottom bar with handle and brush seal -----------------------------------
  if (v > 0.01) {
    const bl = pt(-0.01, v);
    const br = pt(1.01, v);
    ctx.save();
    ctx.shadowColor = "rgba(20, 30, 45, 0.35)";
    ctx.shadowBlur = 8;
    ctx.shadowOffsetY = 3;
    ctx.fillStyle = metalGradient(ctx, bl[1] - BAR_H, bl[1] + 2, hardware);
    quad(ctx, [bl[0], bl[1] - BAR_H], [br[0], br[1] - BAR_H], [br[0], br[1] + 2], [bl[0], bl[1] + 2]);
    ctx.fill();
    ctx.restore();
    // brush seal under the bar
    ctx.fillStyle = "rgba(60, 60, 60, 0.55)";
    ctx.fillRect(bl[0] + 2, bl[1] + 2, br[0] - bl[0] - 4, 2.2);
    // handle
    const cx = (bl[0] + br[0]) / 2;
    ctx.fillStyle = rgb(hardware, 0.72);
    roundRectPath(ctx, cx - 16, bl[1] - BAR_H + 4, 32, BAR_H - 6, 3);
    ctx.fill();
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(cx - 12, bl[1] - BAR_H / 2 - 1, 24, 2);
  }

  // --- cassette on top --------------------------------------------------------
  const cl = pt(-0.025, 0);
  const cr = pt(1.025, 0);
  const cy = PANE.tl[1] - 12;
  ctx.save();
  ctx.shadowColor = "rgba(20, 30, 45, 0.35)";
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;
  ctx.fillStyle = metalGradient(ctx, cy - CASSETTE_H, cy + 6, hardware);
  roundRectPath(ctx, cl[0], cy - CASSETTE_H, cr[0] - cl[0], CASSETTE_H + 6, 5);
  ctx.fill();
  ctx.restore();
  if (isSosna) {
    // faint wood grain on the pine finish
    ctx.strokeStyle = "rgba(120, 80, 30, 0.14)";
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const y = cy - CASSETTE_H + 5 + i * 5.2;
      ctx.beginPath();
      ctx.moveTo(cl[0] + 6, y);
      ctx.bezierCurveTo(cl[0] + 150, y + 1.5, cr[0] - 150, y - 1.5, cr[0] - 6, y + 0.5);
      ctx.stroke();
    }
  }
  // the slot the fabric exits from
  ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
  ctx.fillRect(cl[0] + 10, cy + 3, cr[0] - cl[0] - 20, 2.5);
}

function makeWeave(): CanvasPattern | null {
  if (typeof document === "undefined") return null;
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 64;
  const g = c.getContext("2d");
  if (!g) return null;
  let seed = 11;
  const rnd = () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
  for (let i = 0; i < 700; i++) {
    const v = rnd() < 0.5 ? 0 : 255;
    g.fillStyle = `rgba(${v},${v},${v},${0.3 + rnd() * 0.5})`;
    g.fillRect(rnd() * 64, rnd() * 64, 1, 1);
  }
  for (let y = 0; y < 64; y += 4) {
    g.fillStyle = "rgba(0,0,0,0.35)";
    g.fillRect(0, y, 64, 0.6);
  }
  const ctx = document.createElement("canvas").getContext("2d");
  return ctx ? ctx.createPattern(c, "repeat") : null;
}

export default function RoofHeroScene({ active = true }: { active?: boolean }) {
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
    const plate = plateRef.current;
    if (!canvas || !plate) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const weave = makeWeave();

    let raf: number | null = null;
    let start: number | null = null;
    let width = 0;
    let height = 0;
    let dpr = 1;

    const fit = () => {
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
      const s = Math.max(width / IMG_W, height / IMG_H) * dpr;
      const ox = (width * dpr - IMG_W * s) / 2;
      const oy = (height * dpr - IMG_H * s) / 2;
      ctx.setTransform(s, 0, 0, s, ox, oy);
      drawScene(ctx, t, weave);
      const phase = (t / LOOP_MS) * Math.PI * 2;
      const turn = reduced ? 0 : 5 * Math.sin(phase);
      const tilt = reduced ? 0 : 1.2 * Math.sin(phase * 2 + 1);
      if (!reduced) {
        const k = Math.sin(phase);
        const sweep = ctx.createLinearGradient(0, 0, IMG_W, 0);
        sweep.addColorStop(0, `rgba(0, 0, 0, ${(0.06 * Math.max(0, k)).toFixed(3)})`);
        sweep.addColorStop(0.5, `rgba(255, 255, 255, ${(0.03 * Math.abs(k)).toFixed(3)})`);
        sweep.addColorStop(1, `rgba(0, 0, 0, ${(0.06 * Math.max(0, -k)).toFixed(3)})`);
        ctx.fillStyle = sweep;
        ctx.fillRect(-IMG_W, -IMG_H, IMG_W * 3, IMG_H * 3);
      }
      plate.style.transform = `scale(1.06) rotateY(${turn.toFixed(2)}deg) rotateX(${tilt.toFixed(2)}deg)`;
    };

    const tick = (now: number) => {
      if (start === null) start = now;
      render((now - start) % LOOP_MS);
      raf = requestAnimationFrame(tick);
    };

    fit();
    const ro =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            fit();
            render(start === null ? 6000 : (performance.now() - start) % LOOP_MS);
          })
        : null;
    ro?.observe(plate);

    if (reduced || !active) {
      render(6000);
    } else {
      raf = requestAnimationFrame(tick);
    }
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [reduced, active]);

  return (
    <div
      className="plisy-hero-scene rd-hero-scene"
      role="img"
      aria-label="Animacja: roleta dachowa KEIKA w aluminiowej kasecie z prowadnicami - zatrzymuje się w dowolnym miejscu, tkaniny DEKO i TERMO, trzy kolory osprzętu"
    >
      <div className="plisy-hero-scene-plate" ref={plateRef}>
        <img className="plisy-hero-scene-base" src={RD_HERO_BASE_SRC} alt="" aria-hidden="true" fetchPriority="high" decoding="async" />
        <canvas className="plisy-hero-scene-canvas" ref={canvasRef} aria-hidden="true" />
      </div>
    </div>
  );
}
