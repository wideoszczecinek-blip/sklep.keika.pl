"use client";

// Hero animation for rolety dachowe (v2, 2026-09-18 - the owner on v1: "w
// ogóle nie przypomina rolety"). Instead of drawing the blind by hand, the
// scene is built from photoreal frames of the SAME attic window rendered
// with gemini-2.5-flash-image from one reference plate:
//   /rolety-dachowe/hero/attic-window.jpg  - blind rolled up: white cassette
//                                             at the top, side guides, clear
//                                             glass (the base <img>)
//   /rolety-dachowe/hero/fabric-*.jpg      - blind fully closed in four real
//                                             fabrics (DEKO beige, TERMO
//                                             graphite, TERMO navy, DEKO
//                                             sage), cropped to the pane
// The frames are pixel-aligned (mean difference outside the pane ≈ 2/255),
// so unrolling is a wipe: the closed frame is clipped to the fabric area
// between the cassette and the current bottom-bar position, drawn over the
// open plate, with a shaded aluminium bottom bar (handle, brush seal) and
// its shadow on the glass at the wipe edge. Fabric colours cross-fade while
// the blind rests - the MULTISTOP brake holds it at any height, which is the
// one thing this product is about. Everything is drawn in the base plate's
// pixel space (1344x768) at device pixel ratio, so it stays sharp at any
// size; a gentle 3D turn of the whole plate reads as a showroom presentation.
import { useEffect, useRef, useSyncExternalStore } from "react";

export const RD_HERO_BASE_SRC = "/rolety-dachowe/hero/attic-window.jpg";
const IMG_W = 1344;
const IMG_H = 768;

// The closed-fabric crops cover this rectangle of the base plate.
const CROP = { x: 440, y: 60, w: 500, h: 600 };
const FABRIC_FRAMES = [
  { id: "deko-beige", src: "/rolety-dachowe/hero/fabric-beige.jpg" },
  { id: "termo-graphite", src: "/rolety-dachowe/hero/fabric-graphite.jpg" },
  { id: "termo-navy", src: "/rolety-dachowe/hero/fabric-navy.jpg" },
  { id: "deko-sage", src: "/rolety-dachowe/hero/fabric-sage.jpg" },
];

// Fabric area between the side guides, measured on the frames (base-plate
// pixels): top edge right under the cassette, bottom edge where the closed
// blind's bottom bar rests on the sash. The window is seen from below, so
// the quad narrows towards the bottom.
const FABRIC = { top: 131, bottom: 622, xlTop: 489, xrTop: 884, xlBottom: 525, xrBottom: 833 };
const BAR_H = 14;
const LOOP_MS = 26000;

// [time ms, bottom bar position: 0 = tucked under the cassette, 1 = fully closed]
type Key = [number, number];
const KEYS: Key[] = [
  [0, 0.03],
  [2200, 0.03],
  [6600, 0.56],
  [8600, 0.56],
  [12600, 1.0],
  [14800, 1.0],
  [18600, 0.32],
  [20200, 0.32],
  [23600, 0.03],
  [26000, 0.03],
];
// Fabric changes happen while the blind rests (or is rolled up, invisibly).
const FABRIC_TIMES = [7300, 13400, 19100, 24600];
const FADE_MS = 1300;

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

/** Which fabric frame shows at time t, and the next one blended in (0..1). */
function fabricAt(t: number): { from: number; to: number; blend: number } {
  let idx = 0;
  let blend = 0;
  for (let i = 0; i < FABRIC_TIMES.length; i++) {
    if (t >= FABRIC_TIMES[i]) {
      idx = i + 1;
      const into = t - FABRIC_TIMES[i];
      blend = into < FADE_MS ? easeInOut(into / FADE_MS) : 1;
    }
  }
  const n = FABRIC_FRAMES.length;
  return { from: (idx - 1 + n) % n, to: idx % n, blend: idx === 0 ? 1 : blend };
}

/** Left/right edge of the fabric at a given vertical position (0 top .. 1 bottom). */
function edgesAt(v: number): { y: number; xl: number; xr: number } {
  return {
    y: FABRIC.top + (FABRIC.bottom - FABRIC.top) * v,
    xl: FABRIC.xlTop + (FABRIC.xlBottom - FABRIC.xlTop) * v,
    xr: FABRIC.xrTop + (FABRIC.xrBottom - FABRIC.xrTop) * v,
  };
}

function fabricClip(ctx: CanvasRenderingContext2D, v: number) {
  const bot = edgesAt(v);
  ctx.beginPath();
  ctx.moveTo(FABRIC.xlTop, FABRIC.top - 2);
  ctx.lineTo(FABRIC.xrTop, FABRIC.top - 2);
  ctx.lineTo(bot.xr, bot.y);
  ctx.lineTo(bot.xl, bot.y);
  ctx.closePath();
}

function paneClip(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  ctx.moveTo(FABRIC.xlTop - 4, FABRIC.top - 2);
  ctx.lineTo(FABRIC.xrTop + 4, FABRIC.top - 2);
  ctx.lineTo(FABRIC.xrBottom + 4, FABRIC.bottom + 12);
  ctx.lineTo(FABRIC.xlBottom - 4, FABRIC.bottom + 12);
  ctx.closePath();
}

// Older WebKit has no roundRect - hand-built path.
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

function drawScene(ctx: CanvasRenderingContext2D, t: number, frames: Array<HTMLImageElement | null>) {
  const v = barAt(t);
  const fab = fabricAt(t);
  const edge = edgesAt(v);
  const from = frames[fab.from];
  const to = frames[fab.to];

  // --- fabric: the closed frame(s) wiped down to the bar -------------------
  if (v > 0.005 && (from || to)) {
    ctx.save();
    fabricClip(ctx, v);
    ctx.clip();
    const draw = (img: HTMLImageElement, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, 0, 0, CROP.w, CROP.h, CROP.x, CROP.y, CROP.w, CROP.h);
    };
    if (from && (fab.blend < 1 || !to)) draw(from, 1);
    if (to && fab.blend > 0) draw(to, from && fab.blend < 1 ? fab.blend : 1);
    ctx.globalAlpha = 1;
    // the fabric curls slightly under the bar - a soft dark band at the edge
    const g = ctx.createLinearGradient(0, edge.y - 10, 0, edge.y);
    g.addColorStop(0, "rgba(0,0,0,0)");
    g.addColorStop(1, "rgba(0,0,0,0.22)");
    ctx.fillStyle = g;
    ctx.fillRect(edge.xl - 2, edge.y - 10, edge.xr - edge.xl + 4, 10);
    ctx.restore();
  }

  // --- bar shadow on the glass below the bar ---------------------------------
  if (v < 0.995) {
    ctx.save();
    paneClip(ctx);
    ctx.clip();
    const g = ctx.createLinearGradient(0, edge.y + BAR_H - 1, 0, edge.y + BAR_H + 16);
    g.addColorStop(0, "rgba(20, 28, 40, 0.30)");
    g.addColorStop(1, "rgba(20, 28, 40, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(edge.xl - 2, edge.y + BAR_H - 1, edge.xr - edge.xl + 4, 18);
    ctx.restore();
  }

  // --- aluminium bottom bar with handle and brush seal ---------------------------
  const barW = edge.xr - edge.xl + 6;
  const barX = edge.xl - 3;
  const barY = edge.y - 1;
  ctx.save();
  ctx.shadowColor = "rgba(15, 20, 30, 0.35)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = 2;
  const metal = ctx.createLinearGradient(0, barY, 0, barY + BAR_H);
  metal.addColorStop(0, "#ffffff");
  metal.addColorStop(0.35, "#f4f6f8");
  metal.addColorStop(0.8, "#dde2e7");
  metal.addColorStop(1, "#c4cad1");
  ctx.fillStyle = metal;
  roundRectPath(ctx, barX, barY, barW, BAR_H, 2.5);
  ctx.fill();
  ctx.restore();
  // brush seal under the bar
  ctx.fillStyle = "rgba(70, 72, 76, 0.55)";
  ctx.fillRect(barX + 3, barY + BAR_H, barW - 6, 1.8);
  // handle: a small centred grip, slightly recessed
  const cx = barX + barW / 2;
  const hg = ctx.createLinearGradient(0, barY + 3, 0, barY + BAR_H - 3);
  hg.addColorStop(0, "#d3d8dd");
  hg.addColorStop(1, "#b7bec6");
  ctx.fillStyle = hg;
  roundRectPath(ctx, cx - 17, barY + 3, 34, BAR_H - 6, 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
  ctx.fillRect(cx - 12, barY + BAR_H / 2 - 0.6, 24, 1.2);
}

function loadFrames(onReady: () => void): Array<HTMLImageElement | null> {
  const list: Array<HTMLImageElement | null> = FABRIC_FRAMES.map(() => null);
  FABRIC_FRAMES.forEach((frame, index) => {
    const img = new Image();
    img.decoding = "async";
    img.onload = () => {
      list[index] = img;
      onReady();
    };
    img.src = frame.src;
  });
  return list;
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

    let raf: number | null = null;
    let start: number | null = null;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let disposed = false;

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
      // base-plate pixels -> canvas (the plate is object-fit: cover)
      const s = Math.max(width / IMG_W, height / IMG_H) * dpr;
      const ox = (width * dpr - IMG_W * s) / 2;
      const oy = (height * dpr - IMG_H * s) / 2;
      ctx.setTransform(s, 0, 0, s, ox, oy);
      drawScene(ctx, t, frames);
      const phase = (t / LOOP_MS) * Math.PI * 2;
      const turn = reduced ? 0 : 4.5 * Math.sin(phase);
      const tilt = reduced ? 0 : 1.1 * Math.sin(phase * 2 + 1);
      if (!reduced) {
        const k = Math.sin(phase);
        const sweep = ctx.createLinearGradient(0, 0, IMG_W, 0);
        sweep.addColorStop(0, `rgba(0, 0, 0, ${(0.05 * Math.max(0, k)).toFixed(3)})`);
        sweep.addColorStop(0.5, `rgba(255, 255, 255, ${(0.025 * Math.abs(k)).toFixed(3)})`);
        sweep.addColorStop(1, `rgba(0, 0, 0, ${(0.05 * Math.max(0, -k)).toFixed(3)})`);
        ctx.fillStyle = sweep;
        ctx.fillRect(-IMG_W, -IMG_H, IMG_W * 3, IMG_H * 3);
      }
      plate.style.transform = `scale(1.06) rotateY(${turn.toFixed(2)}deg) rotateX(${tilt.toFixed(2)}deg)`;
    };

    // Static frame (reduced motion / paused): blind half down in beige.
    const staticT = 7000;
    const currentT = () => (start === null ? staticT : (performance.now() - start) % LOOP_MS);

    const frames = loadFrames(() => {
      if (!disposed && (reduced || !active)) render(staticT);
    });

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
            render(currentT());
          })
        : null;
    ro?.observe(plate);

    if (reduced || !active) {
      render(staticT);
    } else {
      raf = requestAnimationFrame(tick);
    }
    return () => {
      disposed = true;
      if (raf !== null) cancelAnimationFrame(raf);
      ro?.disconnect();
    };
  }, [reduced, active]);

  return (
    <div
      className="plisy-hero-scene rd-hero-scene"
      role="img"
      aria-label="Animacja: roleta dachowa KEIKA w aluminiowej kasecie z prowadnicami rozwija się i zatrzymuje w dowolnym miejscu; tkaniny DEKO i TERMO"
    >
      <div className="plisy-hero-scene-plate" ref={plateRef}>
        <img className="plisy-hero-scene-base" src={RD_HERO_BASE_SRC} alt="" aria-hidden="true" fetchPriority="high" decoding="async" />
        <canvas className="plisy-hero-scene-canvas" ref={canvasRef} aria-hidden="true" />
      </div>
    </div>
  );
}
