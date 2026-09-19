"use client";

// Hero animation for plisy dachowe (2026-09-19, owner: "brakuje mi animacji
// tak jak przy innych produktach"). Same technique as the roof-blind hero
// (features/rolety-dachowe/RoofHeroScene.tsx): photoreal frames of ONE attic
// roof window rendered with gemini-2.5-flash-image from the same reference
// plate the roller-blind hero uses -
//   /rolety-dachowe/hero/attic-window.jpg - the shared reference plate:
//                                           white head box at the top, side
//                                           guides, bottom rail tucked under
//                                           it, clear glass (= plisa raised)
//   /plisy-dachowe/hero/fabric-*.jpg     - plisa fully lowered in four
//                                          fabrics, cropped to the pane
// Lowering is a wipe of the lowered frame clipped to the fabric quad down to
// the bottom rail, with a shaded aluminium bottom rail + handle drawn at
// the wipe edge and a few tighter folds right above it (the pleats bunch up
// under the rail as a real plisa does). Fabrics cross-fade while the blind
// rests - each rail stops anywhere, which is the point of the product.
import { useEffect, useRef, useSyncExternalStore } from "react";

export const PD_HERO_BASE_SRC = "/rolety-dachowe/hero/attic-window.jpg";
const IMG_W = 1344;
const IMG_H = 768;

// The lowered-fabric crops cover this rectangle of the base plate.
const CROP = { x: 440, y: 60, w: 500, h: 600 };
const FABRIC_FRAMES = [
  { id: "klasyczne-beige", src: "/plisy-dachowe/hero/fabric-beige.jpg" },
  { id: "reflex-grey", src: "/plisy-dachowe/hero/fabric-grey.jpg" },
  { id: "blackout-graphite", src: "/plisy-dachowe/hero/fabric-graphite.jpg" },
  { id: "klasyczne-sage", src: "/plisy-dachowe/hero/fabric-sage.jpg" },
];

// Fabric area between the side guides (base-plate pixels): top edge right
// under the compressed pleat stack, bottom edge where the lowered blind's
// bottom rail rests on the sash. Seen from below, the quad narrows towards
// the bottom.
const FABRIC = { top: 131, bottom: 622, xlTop: 489, xrTop: 884, xlBottom: 525, xrBottom: 833 };
const BAR_H = 13;
const LOOP_MS = 26000;

type Key = [number, number];
const KEYS: Key[] = [
  [0, 0.02],
  [2200, 0.02],
  [6600, 0.58],
  [8600, 0.58],
  [12600, 1.0],
  [14800, 1.0],
  [18600, 0.34],
  [20200, 0.34],
  [23600, 0.02],
  [26000, 0.02],
];
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

  // --- fabric: the lowered frame(s) wiped down to the bottom rail -----------
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
    // The pleats bunch up right above the rail: three tighter folds, each a
    // lit ridge over a shaded valley, fading into the regular pitch above.
    const stack = Math.min(22, Math.max(0, (edge.y - FABRIC.top) * 0.9));
    for (let i = 0; i < 3; i++) {
      const fold = 7;
      const y1 = edge.y - stack + i * fold;
      if (y1 < FABRIC.top + 2) continue;
      const g = ctx.createLinearGradient(0, y1, 0, y1 + fold);
      g.addColorStop(0, "rgba(255,255,255,0.16)");
      g.addColorStop(0.45, "rgba(0,0,0,0)");
      g.addColorStop(1, "rgba(0,0,0,0.22)");
      ctx.fillStyle = g;
      ctx.fillRect(edge.xl - 2, y1, edge.xr - edge.xl + 4, fold);
    }
    const under = ctx.createLinearGradient(0, edge.y - 6, 0, edge.y);
    under.addColorStop(0, "rgba(0,0,0,0)");
    under.addColorStop(1, "rgba(0,0,0,0.26)");
    ctx.fillStyle = under;
    ctx.fillRect(edge.xl - 2, edge.y - 6, edge.xr - edge.xl + 4, 6);
    ctx.restore();
  }

  // --- rail shadow on the glass below the rail -------------------------------
  if (v < 0.995) {
    ctx.save();
    paneClip(ctx);
    ctx.clip();
    const g = ctx.createLinearGradient(0, edge.y + BAR_H - 1, 0, edge.y + BAR_H + 14);
    g.addColorStop(0, "rgba(20, 28, 40, 0.28)");
    g.addColorStop(1, "rgba(20, 28, 40, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(edge.xl - 2, edge.y + BAR_H - 1, edge.xr - edge.xl + 4, 16);
    ctx.restore();
  }

  // --- aluminium bottom rail with the pull handle ------------------------------
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
  // the handle: a small centred grip below the rail's face
  const cx = barX + barW / 2;
  const hg = ctx.createLinearGradient(0, barY + 2, 0, barY + BAR_H + 4);
  hg.addColorStop(0, "#e9edf1");
  hg.addColorStop(1, "#b9c0c8");
  ctx.fillStyle = hg;
  roundRectPath(ctx, cx - 9, barY + 3, 18, BAR_H + 1, 3);
  ctx.fill();
  ctx.fillStyle = "rgba(0, 0, 0, 0.16)";
  ctx.fillRect(cx - 6, barY + BAR_H / 2, 12, 1.2);
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

export default function PdHeroScene({ active = true }: { active?: boolean }) {
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

    // Static frame (reduced motion / paused): plisa halfway down in beige.
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
    <div className="plisy-hero-scene rd-hero-scene pd-hero-scene" role="img" aria-label="Animacja: plisa dachowa KEIKA w aluminiowych prowadnicach opuszcza się i zatrzymuje w dowolnym miejscu; różne kolekcje tkanin">
      <div className="plisy-hero-scene-plate" ref={plateRef}>
        <img className="plisy-hero-scene-base" src={PD_HERO_BASE_SRC} alt="" aria-hidden="true" fetchPriority="high" decoding="async" />
        <canvas className="plisy-hero-scene-canvas" ref={canvasRef} aria-hidden="true" />
      </div>
    </div>
  );
}
