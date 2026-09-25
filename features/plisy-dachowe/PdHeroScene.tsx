"use client";

// Hero animation for plisy dachowe (2026-09-19, owner: "brakuje mi animacji
// tak jak przy innych produktach"; przebudowana 2026-09-25, owner: "plisa ma
// obie belki ruchome i ma prowadnice - zrób to dobrze i spójnie z produktem").
//
// Dlatego scena pokazuje PRAWDZIWY mechanizm plisy dachowej, a nie rolety:
//  * dwie aluminiowe belki - górna i dolna - jeżdżą niezależnie,
//  * tkanina żyje zawsze MIĘDZY nimi (stała długość materiału, więc im bliżej
//    siebie belki, tym gęstsze plisowanie - paczka zbiera się pod belką),
//  * po obu stronach szyby biegną prowadnice, w których belki się zatrzymują
//    w dowolnym miejscu - stąd sekwencja: zasłonięte całe okno -> tylko dół
//    -> pas na środku -> pas przesunięty w górę -> plisa złożona pod górną
//    krawędzią.
//
// Technika jak w rolecie dachowej (features/rolety-dachowe/RoofHeroScene.tsx):
// fotorealistyczna płyta bazowa + zdjęcia tkanin rysowane na canvasie.
//   /rolety-dachowe/hero/attic-window.jpg - płyta bazowa: okno połaciowe
//                                           z czystą szybą (= plisa złożona)
//   /plisy-dachowe/hero/fabric-*.jpg      - plisa w czterech tkaninach;
//                                           bierzemy z nich sam materiał
//                                           (SRC poniżej), a prowadnice i
//                                           belki rysujemy, bo muszą się
//                                           ruszać.
import { useEffect, useRef, useSyncExternalStore } from "react";

export const PD_HERO_BASE_SRC = "/rolety-dachowe/hero/attic-window.jpg";
const IMG_W = 1344;
const IMG_H = 768;

const FABRIC_FRAMES = [
  { id: "klasyczne-beige", src: "/plisy-dachowe/hero/fabric-beige.jpg" },
  { id: "reflex-grey", src: "/plisy-dachowe/hero/fabric-grey.jpg" },
  { id: "blackout-graphite", src: "/plisy-dachowe/hero/fabric-graphite.jpg" },
  { id: "klasyczne-sage", src: "/plisy-dachowe/hero/fabric-sage.jpg" },
];

// Czysty materiał w klatce tkaniny (klatka ma 500 x 600 px; sprawdzone na
// wszystkich czterech - rama i prowadnice zaczynają się dopiero poza tym
// prostokątem).
const SRC = { x: 105, y: 110, w: 275, h: 390 };

// Szyba w płycie bazowej. Patrzymy na okno od dołu, więc czworokąt zwęża się
// ku dołowi.
const PANE = { top: 131, bottom: 622, xlTop: 489, xrTop: 884, xlBottom: 525, xrBottom: 833 };
const RAIL_TOP_W = 19;
const RAIL_BOTTOM_W = 15;
const BAR_TOP_H = 11;
const BAR_BOTTOM_H = 14;
/** Złożona paczka plisy - tyle szyby zajmuje sam materiał przy belkach razem. */
const PACK = 0.05;
/** Skrajne pozycje belek: muszą zmieścić się w szybie razem z profilem. */
const TOP_MIN = BAR_TOP_H / (PANE.bottom - PANE.top) + 0.005;
const BOTTOM_MAX = 1 - BAR_BOTTOM_H / (PANE.bottom - PANE.top) - 0.005;

const LOOP_MS = 30000;

type Key = [number, number];
/** Dolna krawędź górnej belki (tam zaczyna się tkanina). */
const TOP_KEYS: Key[] = [
  [0, TOP_MIN],
  [6000, TOP_MIN],
  [9600, TOP_MIN],
  [12600, TOP_MIN],
  [15400, 0.46],
  [17800, 0.46],
  [20600, 0.4],
  [22600, 0.4],
  [25400, 0.1],
  [27000, 0.1],
  [29400, TOP_MIN],
  [30000, TOP_MIN],
];
/** Górna krawędź dolnej belki (tam tkanina się kończy). */
const BOTTOM_KEYS: Key[] = [
  [0, TOP_MIN + PACK],
  [2400, TOP_MIN + PACK],
  [6600, BOTTOM_MAX],
  [12600, BOTTOM_MAX],
  [15400, BOTTOM_MAX],
  [17800, BOTTOM_MAX],
  [20600, 0.7],
  [22600, 0.7],
  [25400, 0.4],
  [27000, 0.4],
  [29400, TOP_MIN + PACK],
  [30000, TOP_MIN + PACK],
];
// Tkaniny zmieniają się w postojach, gdy plisa stoi w miejscu.
const FABRIC_TIMES = [13200, 18600, 23400, 27600];
const FADE_MS = 1200;

const easeInOut = (p: number) => (p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2);

function trackAt(keys: Key[], t: number): number {
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
  return a[1] + (b[1] - a[1]) * p;
}

function stateAt(t: number): { topV: number; botV: number } {
  const topV = Math.min(Math.max(trackAt(TOP_KEYS, t), TOP_MIN), BOTTOM_MAX - PACK);
  const botV = Math.min(Math.max(trackAt(BOTTOM_KEYS, t), topV + PACK), BOTTOM_MAX);
  return { topV, botV };
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

/** Krawędzie szyby i szerokość prowadnicy na wysokości v (0 = góra szyby). */
function paneAt(v: number): { y: number; xl: number; xr: number; rail: number } {
  return {
    y: PANE.top + (PANE.bottom - PANE.top) * v,
    xl: PANE.xlTop + (PANE.xlBottom - PANE.xlTop) * v,
    xr: PANE.xrTop + (PANE.xrBottom - PANE.xrTop) * v,
    rail: RAIL_TOP_W + (RAIL_BOTTOM_W - RAIL_TOP_W) * v,
  };
}

/** Tkanina chowa się pod wargę prowadnicy, więc jest węższa niż szyba. */
function fabricEdgeAt(v: number): { y: number; xl: number; xr: number } {
  const p = paneAt(v);
  return { y: p.y, xl: p.xl + p.rail * 0.72, xr: p.xr - p.rail * 0.72 };
}

function bandClip(ctx: CanvasRenderingContext2D, topV: number, botV: number) {
  const a = fabricEdgeAt(topV);
  const b = fabricEdgeAt(botV);
  ctx.beginPath();
  ctx.moveTo(a.xl, a.y);
  ctx.lineTo(a.xr, a.y);
  ctx.lineTo(b.xr, b.y);
  ctx.lineTo(b.xl, b.y);
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

/** Aluminiowa belka plisy: profil + uchwyt, którym się ją przesuwa. */
function drawBar(ctx: CanvasRenderingContext2D, v: number, kind: "top" | "bottom") {
  const p = paneAt(v);
  const h = kind === "top" ? BAR_TOP_H : BAR_BOTTOM_H;
  const y = kind === "top" ? p.y - h : p.y;
  const x = p.xl + p.rail * 0.18;
  const w = p.xr - p.rail * 0.18 - x;

  ctx.save();
  ctx.shadowColor = "rgba(15, 20, 30, 0.32)";
  ctx.shadowBlur = 5;
  ctx.shadowOffsetY = kind === "top" ? -1 : 2;
  const metal = ctx.createLinearGradient(0, y, 0, y + h);
  metal.addColorStop(0, "#ffffff");
  metal.addColorStop(0.32, "#f3f6f8");
  metal.addColorStop(0.78, "#dce1e7");
  metal.addColorStop(1, "#c1c8cf");
  ctx.fillStyle = metal;
  roundRectPath(ctx, x, y, w, h, 2.5);
  ctx.fill();
  ctx.restore();

  // uchwyt: przy górnej belce od góry, przy dolnej od dołu - tak się je łapie
  const cx = x + w / 2;
  const gripH = kind === "top" ? 5 : 7;
  const gripY = kind === "top" ? y - gripH + 1 : y + h - 1;
  const grip = ctx.createLinearGradient(0, gripY, 0, gripY + gripH);
  grip.addColorStop(0, kind === "top" ? "#ffffff" : "#e9edf1");
  grip.addColorStop(1, kind === "top" ? "#cdd4da" : "#b7bfc7");
  ctx.fillStyle = grip;
  roundRectPath(ctx, cx - (kind === "top" ? 12 : 10), gripY, kind === "top" ? 24 : 20, gripH, 2.5);
  ctx.fill();
  ctx.fillStyle = "rgba(0, 0, 0, 0.14)";
  ctx.fillRect(cx - 7, y + h / 2, 14, 1.1);
}

/** Prowadnice po obu stronach szyby - w nich belki zatrzymują się w dowolnym
 * miejscu. Rysowane po belkach, bo warga prowadnicy zakrywa ich końce. */
function drawRails(ctx: CanvasRenderingContext2D) {
  const a = paneAt(0);
  const b = paneAt(1);
  const sides: Array<{ x1a: number; x2a: number; x1b: number; x2b: number; flip: boolean }> = [
    { x1a: a.xl, x2a: a.xl + a.rail, x1b: b.xl, x2b: b.xl + b.rail, flip: false },
    { x1a: a.xr - a.rail, x2a: a.xr, x1b: b.xr - b.rail, x2b: b.xr, flip: true },
  ];
  for (const s of sides) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(s.x1a, a.y);
    ctx.lineTo(s.x2a, a.y);
    ctx.lineTo(s.x2b, b.y);
    ctx.lineTo(s.x1b, b.y);
    ctx.closePath();
    const g = ctx.createLinearGradient(s.flip ? s.x2a : s.x1a, 0, s.flip ? s.x1a : s.x2a, 0);
    g.addColorStop(0, "#f8fafb");
    g.addColorStop(0.3, "#e2e7ec");
    g.addColorStop(0.72, "#bcc4cc");
    g.addColorStop(1, "#8e98a2");
    ctx.fillStyle = g;
    ctx.fill();
    ctx.restore();

    // Wewnętrzna krawędź profilu + cień na szybie - bez tego prowadnica ginie
    // na tle jasnego nieba.
    const ix1 = s.flip ? s.x1a : s.x2a;
    const ix2 = s.flip ? s.x1b : s.x2b;
    const dir = s.flip ? -1 : 1;
    ctx.save();
    const shade = ctx.createLinearGradient(ix1, 0, ix1 + dir * 7, 0);
    shade.addColorStop(0, "rgba(18, 26, 38, 0.26)");
    shade.addColorStop(1, "rgba(18, 26, 38, 0)");
    ctx.beginPath();
    ctx.moveTo(ix1, a.y);
    ctx.lineTo(ix1 + dir * 7, a.y);
    ctx.lineTo(ix2 + dir * 7, b.y);
    ctx.lineTo(ix2, b.y);
    ctx.closePath();
    ctx.fillStyle = shade;
    ctx.fill();
    ctx.strokeStyle = "rgba(18, 26, 38, 0.38)";
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(ix1, a.y);
    ctx.lineTo(ix2, b.y);
    ctx.stroke();
    ctx.restore();
  }
}

function drawScene(ctx: CanvasRenderingContext2D, t: number, frames: Array<HTMLImageElement | null>) {
  const { topV, botV } = stateAt(t);
  const fab = fabricAt(t);
  const from = frames[fab.from];
  const to = frames[fab.to];
  const a = fabricEdgeAt(topV);
  const b = fabricEdgeAt(botV);
  const bandH = b.y - a.y;

  // --- tkanina między belkami ------------------------------------------------
  if (bandH > 0.5 && (from || to)) {
    ctx.save();
    bandClip(ctx, topV, botV);
    ctx.clip();
    // Materiał ma stałą długość: cały kawałek ściskamy do wysokości między
    // belkami, więc plisowanie gęstnieje, gdy belki się zbliżają - dokładnie
    // jak w prawdziwej plisie.
    const dx = Math.min(a.xl, b.xl) - 2;
    const dw = Math.max(a.xr, b.xr) + 2 - dx;
    const draw = (img: HTMLImageElement, alpha: number) => {
      ctx.globalAlpha = alpha;
      ctx.drawImage(img, SRC.x, SRC.y, SRC.w, SRC.h, dx, a.y, dw, bandH);
    };
    if (from && (fab.blend < 1 || !to)) draw(from, 1);
    if (to && fab.blend > 0) draw(to, from && fab.blend < 1 ? fab.blend : 1);
    ctx.globalAlpha = 1;

    // Gdy paczka jest mocno ściśnięta, zdjęciowe plisy zlewają się w plamę -
    // dokładamy wtedy własne załamania, żeby dalej było widać harmonijkę.
    const natural = (BOTTOM_MAX - TOP_MIN) * (PANE.bottom - PANE.top);
    const squeeze = bandH / natural;
    if (squeeze < 0.62) {
      const folds = 9;
      const pitch = bandH / folds;
      ctx.globalAlpha = Math.min(0.75, (0.62 - squeeze) * 2.2);
      for (let i = 1; i < folds; i++) {
        const y = a.y + pitch * i;
        const g = ctx.createLinearGradient(0, y - pitch * 0.5, 0, y + pitch * 0.5);
        g.addColorStop(0, "rgba(255,255,255,0.20)");
        g.addColorStop(0.5, "rgba(0,0,0,0.26)");
        g.addColorStop(1, "rgba(255,255,255,0.14)");
        ctx.fillStyle = g;
        ctx.fillRect(dx, y - pitch * 0.5, dw, pitch);
      }
      ctx.globalAlpha = 1;
    }

    // styk tkaniny z belkami: delikatny cień pod górną i nad dolną
    const topShade = ctx.createLinearGradient(0, a.y, 0, a.y + 9);
    topShade.addColorStop(0, "rgba(0,0,0,0.26)");
    topShade.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = topShade;
    ctx.fillRect(dx, a.y, dw, Math.min(9, bandH));
    const botShade = ctx.createLinearGradient(0, b.y - 7, 0, b.y);
    botShade.addColorStop(0, "rgba(0,0,0,0)");
    botShade.addColorStop(1, "rgba(0,0,0,0.24)");
    ctx.fillStyle = botShade;
    ctx.fillRect(dx, b.y - Math.min(7, bandH), dw, Math.min(7, bandH));
    ctx.restore();
  }

  // --- cień rzucany przez dolną belkę na szybę pod spodem --------------------
  if (botV < BOTTOM_MAX - 0.002) {
    ctx.save();
    const p = paneAt(botV);
    ctx.beginPath();
    ctx.moveTo(p.xl, p.y);
    ctx.lineTo(p.xr, p.y);
    ctx.lineTo(p.xr, p.y + 20);
    ctx.lineTo(p.xl, p.y + 20);
    ctx.closePath();
    ctx.clip();
    const g = ctx.createLinearGradient(0, p.y + BAR_BOTTOM_H - 1, 0, p.y + BAR_BOTTOM_H + 14);
    g.addColorStop(0, "rgba(20, 28, 40, 0.26)");
    g.addColorStop(1, "rgba(20, 28, 40, 0)");
    ctx.fillStyle = g;
    ctx.fillRect(p.xl, p.y + BAR_BOTTOM_H - 1, p.xr - p.xl, 16);
    ctx.restore();
  }

  drawBar(ctx, topV, "top");
  drawBar(ctx, botV, "bottom");
  drawRails(ctx);
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
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
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

    // Klatka statyczna (reduced motion / scena nieaktywna): górna belka w
    // połowie okna, dolna na dole - widać obie belki i obie prowadnice.
    const staticT = 17000;
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
      className="plisy-hero-scene rd-hero-scene pd-hero-scene"
      role="img"
      aria-label="Animacja: plisa dachowa KEIKA w bocznych prowadnicach - obie belki jeżdżą niezależnie, więc zasłonisz całe okno, sam dół albo pas na środku; tkaniny zmieniają się w kolejnych kolekcjach"
    >
      <div className="plisy-hero-scene-plate" ref={plateRef}>
        <img className="plisy-hero-scene-base" src={PD_HERO_BASE_SRC} alt="" aria-hidden="true" fetchPriority="high" decoding="async" />
        <canvas className="plisy-hero-scene-canvas" ref={canvasRef} aria-hidden="true" />
      </div>
    </div>
  );
}
