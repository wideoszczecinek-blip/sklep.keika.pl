"use client";

// Animacja rolety dachowej (v3, 9.11.2026 – właściciel: „animacja nie oddająca produktu to dno… przyjrzyj się
// systemowi B25 szeroki – inaczej w sieci Dekolux – postaraj się, aby ta animacja oddawała produkt jak najbardziej”).
//
// v2 (18.09) rysowała tylko tkaninę na zdjęciu okna z wygenerowaną cienką białą kasetą i wąskimi prowadnicami –
// tak nie wygląda nasz produkt. Teraz cały system B25 szeroki jest rysowany w kodzie na zdjęciu samego okna
// (/rolety-dachowe/hero/attic-window.jpg, z jego cienkiej kasety i prowadnic nic nie zostaje – rysunek je zakrywa),
// wg rysunku złożeniowego i zdjęć producenta systemu:
//   • kaseta z aluminiową maskownicą: wypukłe lico, przetłoczenie i dolna warga, spod której wychodzi tkanina;
//   • szerokie (ok. 5 cm) płaskie prowadnice aluminiowe na skrzydle, połączone z kasetą ukośnymi narożnikami
//     jak rama obrazu, z zaokrągloną krawędzią wewnętrzną i plastikowymi zaślepkami na dole;
//   • belka dolna: profil aluminiowy ze szczotką uszczelniającą i dwoma uchwytami, końce chowają się w prowadnicach
//     (hamulec MULTISTOP – roleta staje na dowolnej wysokości);
//   • tkaniny DEKO (przepuszczają światło – na tkaninie widać poświatę okna) i TERMO (blackout), splot tkaniny.
// Kolor osprzętu: anoda (srebrny), jak na miniaturze produktu. Elementy stałe (kaseta, prowadnice, cienie) rysują
// się raz do bufora w 2× rozdzielczości zdjęcia; co klatkę rysuje się tylko tkanina i belka. Współrzędne w pikselach
// zdjęcia bazowego (1344×768), okno widziane od dołu – prowadnice zbiegają się ku dołowi.
import { useEffect, useRef, useSyncExternalStore } from "react";

export const RD_HERO_BASE_SRC = "/rolety-dachowe/hero/attic-window.jpg";
const IMG_W = 1344;
const IMG_H = 768;
const FS = 2; // rozdzielczość bufora elementów stałych

// Skrzydło okna na zdjęciu (zmierzone): wewnętrzna krawędź drewna skrzydła po lewej i prawej, od górnej listwy
// skrzydła (y 92) do dolnej (y 640).
const SASH = { y0: 92, y1: 640, l0: 472, l1: 510, r0: 902, r1: 846 };
const CAS_TOP = 89; // górna krawędź kasety
const CAS_BOT = 137; // dolna warga kasety – stąd wychodzi tkanina
const GUIDE_BOT = 645; // koniec prowadnic (z zaślepką)
const BAR_H = 15;
const BAR_TOP_MIN = CAS_BOT - 1; // roleta zwinięta – belka tuż pod wargą kasety
const BAR_TOP_MAX = 609; // roleta zamknięta – belka na dolnej listwie skrzydła
const LOOP_MS = 26000;

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ty = (y: number) => (y - SASH.y0) / (SASH.y1 - SASH.y0);
/** Zewnętrzna krawędź lewej / prawej prowadnicy na wysokości y. */
const lo = (y: number) => lerp(SASH.l0, SASH.l1, ty(y));
const ro = (y: number) => lerp(SASH.r0, SASH.r1, ty(y));
/** Szerokość prowadnicy (ok. 5 cm) na wysokości y – perspektywa. */
const gw = (y: number) => lerp(31, 25.5, ty(y));
/** Wewnętrzna krawędź prowadnic – granica tkaniny. */
const li = (y: number) => lo(y) + gw(y);
const ri = (y: number) => ro(y) - gw(y);

type Fabric = { id: string; color: string; kind: "deko" | "termo"; pattern?: CanvasPattern | null };
const FABRICS: Fabric[] = [
  { id: "deko-bez", color: "#d6cab2", kind: "deko" },
  { id: "termo-grafit", color: "#4a4e54", kind: "termo" },
  { id: "deko-szalwia", color: "#a5af97", kind: "deko" },
  { id: "termo-granat", color: "#2d394e", kind: "termo" },
];

// [czas ms, położenie belki: 0 = schowana pod kasetą, 1 = roleta zamknięta]
type Key = [number, number];
const KEYS: Key[] = [
  [0, 0],
  [2200, 0],
  [6600, 0.56],
  [8600, 0.56],
  [12600, 1.0],
  [14800, 1.0],
  [18600, 0.32],
  [20200, 0.32],
  [23600, 0],
  [26000, 0],
];
// Zmiana tkaniny, gdy roleta stoi (albo jest zwinięta).
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
  const n = FABRICS.length;
  return { from: (idx - 1 + n) % n, to: idx % n, blend: idx === 0 ? 1 : blend };
}

// Powtarzalny pseudolosowy szum (ten sam rysunek przy każdym wejściu).
function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
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

// ------------------------------------------------------------------ splot tkaniny i włosie szczotki

function makeWeave(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 96;
  c.height = 96;
  const g = c.getContext("2d");
  if (!g) return c;
  const r = rng(7);
  const rows = Array.from({ length: 96 }, () => r() - 0.5);
  const cols = Array.from({ length: 96 }, () => r() - 0.5);
  const img = g.createImageData(96, 96);
  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      // nitki wątku i osnowy + drobne ziarno
      const v = rows[y] * 0.3 + cols[x] * 0.25 + (r() - 0.5) * 0.45 + ((x + y) % 2 === 0 ? 0.04 : -0.04);
      const i = (y * 96 + x) * 4;
      const light = v > 0;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = light ? 255 : 0;
      img.data[i + 3] = Math.min(255, Math.round(Math.abs(v) * 70));
    }
  }
  g.putImageData(img, 0, 0);
  return c;
}

function makeBrush(): HTMLCanvasElement {
  const c = document.createElement("canvas");
  c.width = 64;
  c.height = 8;
  const g = c.getContext("2d");
  if (!g) return c;
  const r = rng(11);
  g.fillStyle = "rgb(92, 95, 100)";
  g.fillRect(0, 0, 64, 8);
  for (let x = 0; x < 64; x += 0.5) {
    const len = 4 + r() * 4;
    g.strokeStyle = r() > 0.5 ? `rgba(170, 172, 176, ${0.35 + r() * 0.4})` : `rgba(40, 42, 46, ${0.3 + r() * 0.4})`;
    g.lineWidth = 0.5;
    g.beginPath();
    g.moveTo(x, 0);
    g.lineTo(x + (r() - 0.5) * 1.2, len);
    g.stroke();
  }
  return c;
}

// ------------------------------------------------------------------ elementy stałe: kaseta, prowadnice, cienie

function guidePath(ctx: CanvasRenderingContext2D, side: "l" | "r") {
  const top = CAS_TOP + 10;
  ctx.beginPath();
  if (side === "l") {
    ctx.moveTo(lo(top), top);
    ctx.lineTo(li(top), top);
    ctx.lineTo(li(GUIDE_BOT), GUIDE_BOT);
    ctx.lineTo(lo(GUIDE_BOT), GUIDE_BOT);
  } else {
    ctx.moveTo(ri(top), top);
    ctx.lineTo(ro(top), top);
    ctx.lineTo(ro(GUIDE_BOT), GUIDE_BOT);
    ctx.lineTo(ri(GUIDE_BOT), GUIDE_BOT);
  }
  ctx.closePath();
}

function drawGuide(ctx: CanvasRenderingContext2D, side: "l" | "r") {
  // cień prowadnicy na drewnie skrzydła
  ctx.save();
  ctx.shadowColor = "rgba(40, 30, 20, 0.35)";
  ctx.shadowBlur = 7 * FS;
  ctx.shadowOffsetX = (side === "l" ? -1 : 1) * FS;
  ctx.shadowOffsetY = 1.5 * FS;
  guidePath(ctx, side);
  ctx.fillStyle = "#c9ced3";
  ctx.fill();
  ctx.restore();

  ctx.save();
  guidePath(ctx, side);
  ctx.clip();
  // Profil lica w poprzek prowadnicy: krawędź zewnętrzna, szerokie płaskie lico z odblaskiem, zaokrąglona krawędź
  // wewnętrzna, przy której tkanina wchodzi w kanał. Rysowane plasterkami, bo prowadnica jest skośna.
  const stops: [number, string][] =
    side === "l"
      ? [
          [0, "#9ba2a9"],
          [0.07, "#cfd3d7"],
          [0.3, "#e6e9ec"],
          [0.55, "#d9dde1"],
          [0.8, "#c3c8cd"],
          [0.9, "#aeb5bb"],
          [0.96, "#7f868d"],
          [1, "#5d646b"],
        ]
      : [
          [0, "#5d646b"],
          [0.04, "#7f868d"],
          [0.1, "#a9b0b6"],
          [0.22, "#c8cdd1"],
          [0.5, "#d3d7db"],
          [0.74, "#dfe2e5"],
          [0.93, "#c7ccd0"],
          [1, "#949ba2"],
        ];
  for (let y = CAS_TOP; y < GUIDE_BOT + 2; y += 2) {
    const x0 = side === "l" ? lo(y) : ri(y);
    const x1 = side === "l" ? li(y) : ro(y);
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    for (const [o, c] of stops) g.addColorStop(o, c);
    ctx.fillStyle = g;
    ctx.fillRect(x0 - 2, y, x1 - x0 + 4, 2.6);
  }
  // szczotkowane aluminium – drobne rysy wzdłuż profilu
  const r = rng(side === "l" ? 3 : 5);
  ctx.lineWidth = 0.35;
  for (let k = 0; k < 70; k++) {
    const f = r();
    const top = CAS_TOP + 10 + r() * 40;
    const bot = GUIDE_BOT - r() * 40;
    const xa = side === "l" ? lerp(lo(top), li(top), f) : lerp(ri(top), ro(top), f);
    const xb = side === "l" ? lerp(lo(bot), li(bot), f) : lerp(ri(bot), ro(bot), f);
    ctx.strokeStyle = r() > 0.5 ? `rgba(255,255,255,${0.06 + r() * 0.1})` : `rgba(0,0,0,${0.03 + r() * 0.04})`;
    ctx.beginPath();
    ctx.moveTo(xa, top);
    ctx.lineTo(xb, bot);
    ctx.stroke();
  }
  // lekkie zaciemnienie prawej prowadnicy (patrzymy na nią bardziej z boku)
  if (side === "r") {
    ctx.fillStyle = "rgba(30, 40, 52, 0.06)";
    ctx.fillRect(ri(GUIDE_BOT) - 4, CAS_TOP, ro(CAS_TOP) - ri(GUIDE_BOT) + 8, GUIDE_BOT - CAS_TOP);
  }
  // Zaślepka na dole prowadnicy (plastik)
  const capTop = GUIDE_BOT - 9;
  const cx0 = side === "l" ? lo(capTop) : ri(capTop);
  const cx1 = side === "l" ? li(capTop) : ro(capTop);
  const cg = ctx.createLinearGradient(0, capTop, 0, GUIDE_BOT);
  cg.addColorStop(0, "#9aa1a8");
  cg.addColorStop(0.25, "#c5cad0");
  cg.addColorStop(1, "#7a8188");
  ctx.fillStyle = cg;
  ctx.fillRect(cx0 - 3, capTop, cx1 - cx0 + 6, GUIDE_BOT - capTop + 2);
  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.fillRect(cx0 - 3, capTop, cx1 - cx0 + 6, 0.8);
  ctx.restore();

  // wyraźna krawędź wewnętrzna (wejście tkaniny do kanału) i jasna krawędź zewnętrzna
  ctx.save();
  ctx.lineWidth = 0.9;
  ctx.strokeStyle = "rgba(40, 46, 54, 0.55)";
  ctx.beginPath();
  if (side === "l") {
    ctx.moveTo(li(CAS_BOT), CAS_BOT);
    ctx.lineTo(li(GUIDE_BOT), GUIDE_BOT);
  } else {
    ctx.moveTo(ri(CAS_BOT), CAS_BOT);
    ctx.lineTo(ri(GUIDE_BOT), GUIDE_BOT);
  }
  ctx.stroke();
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 0.6;
  ctx.beginPath();
  if (side === "l") {
    ctx.moveTo(lo(CAS_BOT) + 1.2, CAS_BOT);
    ctx.lineTo(lo(GUIDE_BOT) + 1.2, GUIDE_BOT - 10);
  } else {
    ctx.moveTo(ro(CAS_BOT) - 1.2, CAS_BOT);
    ctx.lineTo(ro(GUIDE_BOT) - 1.2, GUIDE_BOT - 10);
  }
  ctx.stroke();
  ctx.restore();
}

function cassettePath(ctx: CanvasRenderingContext2D) {
  const mitreY = CAS_TOP + 12;
  ctx.beginPath();
  ctx.moveTo(lo(CAS_TOP) - 4, CAS_TOP);
  ctx.lineTo(ro(CAS_TOP) + 4, CAS_TOP);
  ctx.lineTo(ro(mitreY) + 3, mitreY);
  ctx.lineTo(ri(CAS_BOT), CAS_BOT);
  ctx.lineTo(li(CAS_BOT), CAS_BOT);
  ctx.lineTo(lo(mitreY) - 3, mitreY);
  ctx.closePath();
}

function drawCassette(ctx: CanvasRenderingContext2D) {
  ctx.save();
  ctx.shadowColor = "rgba(40, 30, 20, 0.4)";
  ctx.shadowBlur = 8 * FS;
  ctx.shadowOffsetY = 2.5 * FS;
  cassettePath(ctx);
  ctx.fillStyle = "#d3d7db";
  ctx.fill();
  ctx.restore();

  ctx.save();
  cassettePath(ctx);
  ctx.clip();
  // Maskownica kasety widziana od dołu: krawędź przy skrzydle, wypukłe lico z odblaskiem, przetłoczenie, dolna warga.
  const g = ctx.createLinearGradient(0, CAS_TOP, 0, CAS_BOT);
  g.addColorStop(0, "#7d848b");
  g.addColorStop(0.05, "#b9bec4");
  g.addColorStop(0.17, "#f4f6f7");
  g.addColorStop(0.32, "#eceef0");
  g.addColorStop(0.55, "#d9dde0");
  g.addColorStop(0.68, "#c6cbd0");
  g.addColorStop(0.715, "#959ca3");
  g.addColorStop(0.735, "#f1f3f4");
  g.addColorStop(0.85, "#dfe2e5");
  g.addColorStop(0.95, "#bfc5ca");
  g.addColorStop(1, "#80878e");
  ctx.fillStyle = g;
  ctx.fillRect(lo(CAS_TOP) - 6, CAS_TOP - 1, ro(CAS_TOP) - lo(CAS_TOP) + 12, CAS_BOT - CAS_TOP + 2);
  // poprzeczne światło: lico jaśniejsze przy środku okna
  const side = ctx.createLinearGradient(lo(CAS_TOP), 0, ro(CAS_TOP), 0);
  side.addColorStop(0, "rgba(0,0,0,0.07)");
  side.addColorStop(0.45, "rgba(255,255,255,0.06)");
  side.addColorStop(1, "rgba(0,0,0,0.1)");
  ctx.fillStyle = side;
  ctx.fillRect(lo(CAS_TOP) - 6, CAS_TOP - 1, ro(CAS_TOP) - lo(CAS_TOP) + 12, CAS_BOT - CAS_TOP + 2);
  // szczotkowane aluminium – poziome rysy
  const r = rng(9);
  ctx.lineWidth = 0.35;
  for (let k = 0; k < 120; k++) {
    const y = CAS_TOP + 2 + r() * (CAS_BOT - CAS_TOP - 3);
    const x = lo(CAS_TOP) + r() * (ro(CAS_TOP) - lo(CAS_TOP));
    const len = 30 + r() * 160;
    ctx.strokeStyle = r() > 0.45 ? `rgba(255,255,255,${0.1 + r() * 0.2})` : `rgba(0,0,0,${0.03 + r() * 0.05})`;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + len, y);
    ctx.stroke();
  }
  // narożniki (zaślepki kasety): ukośne połączenie z prowadnicą jak w ramie obrazu
  const mitreY = CAS_TOP + 12;
  for (const s of ["l", "r"] as const) {
    const outer = s === "l" ? lo(mitreY) - 3 : ro(mitreY) + 3;
    const inner = s === "l" ? li(CAS_BOT) : ri(CAS_BOT);
    const edge = s === "l" ? lo(CAS_TOP) - 4 : ro(CAS_TOP) + 4;
    ctx.beginPath();
    ctx.moveTo(edge, CAS_TOP);
    ctx.lineTo(edge + (s === "l" ? 14 : -14), CAS_TOP);
    ctx.quadraticCurveTo(inner + (s === "l" ? 4 : -4), CAS_TOP + 26, inner, CAS_BOT);
    ctx.lineTo(outer, mitreY);
    ctx.closePath();
    const cg = ctx.createLinearGradient(edge, CAS_TOP, inner, CAS_BOT);
    cg.addColorStop(0, "rgba(255,255,255,0.18)");
    cg.addColorStop(0.6, "rgba(0,0,0,0.04)");
    cg.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = "rgba(60, 66, 74, 0.35)";
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.moveTo(edge + (s === "l" ? 14 : -14), CAS_TOP);
    ctx.quadraticCurveTo(inner + (s === "l" ? 4 : -4), CAS_TOP + 26, inner, CAS_BOT);
    ctx.stroke();
  }
  ctx.restore();

  // szczelina pod dolną wargą, z której wychodzi tkanina
  ctx.fillStyle = "rgba(25, 28, 33, 0.55)";
  ctx.beginPath();
  ctx.moveTo(li(CAS_BOT), CAS_BOT - 0.6);
  ctx.lineTo(ri(CAS_BOT), CAS_BOT - 0.6);
  ctx.lineTo(ri(CAS_BOT + 1.4), CAS_BOT + 1.4);
  ctx.lineTo(li(CAS_BOT + 1.4), CAS_BOT + 1.4);
  ctx.closePath();
  ctx.fill();
}

/** Cienie rzucane przez kasetę i prowadnice na tkaninę i szybę. */
function drawInnerShadows(ctx: CanvasRenderingContext2D) {
  const sh = ctx.createLinearGradient(0, CAS_BOT, 0, CAS_BOT + 12);
  sh.addColorStop(0, "rgba(15, 22, 32, 0.32)");
  sh.addColorStop(1, "rgba(15, 22, 32, 0)");
  ctx.fillStyle = sh;
  ctx.fillRect(li(CAS_BOT), CAS_BOT, ri(CAS_BOT) - li(CAS_BOT), 12);
  // Cień wzdłuż skośnej krawędzi prowadnicy: pochylony układ współrzędnych, w którym krawędź jest pionowa –
  // jeden gradient na całą długość, bez prążków.
  const h = GUIDE_BOT - CAS_BOT;
  const sl = (li(GUIDE_BOT) - li(CAS_BOT)) / h;
  ctx.save();
  ctx.transform(1, 0, sl, 1, -sl * CAS_BOT, 0);
  const gl = ctx.createLinearGradient(li(CAS_BOT), 0, li(CAS_BOT) + 9, 0);
  gl.addColorStop(0, "rgba(15, 22, 32, 0.3)");
  gl.addColorStop(1, "rgba(15, 22, 32, 0)");
  ctx.fillStyle = gl;
  ctx.fillRect(li(CAS_BOT), CAS_BOT, 9, h);
  ctx.restore();
  const sr = (ri(GUIDE_BOT) - ri(CAS_BOT)) / h;
  ctx.save();
  ctx.transform(1, 0, sr, 1, -sr * CAS_BOT, 0);
  const gr = ctx.createLinearGradient(ri(CAS_BOT), 0, ri(CAS_BOT) - 7, 0);
  gr.addColorStop(0, "rgba(15, 22, 32, 0.22)");
  gr.addColorStop(1, "rgba(15, 22, 32, 0)");
  ctx.fillStyle = gr;
  ctx.fillRect(ri(CAS_BOT) - 7, CAS_BOT, 7, h);
  ctx.restore();
}

/** Kolor osprzętu (id z konfiguratora): srebrny = anoda, bialy, sosna (jasna sosna). */
export type RoofHardwareTone = "srebrny" | "bialy" | "sosna";

function blankLayer(): [HTMLCanvasElement, CanvasRenderingContext2D | null] {
  const c = document.createElement("canvas");
  c.width = IMG_W * FS;
  c.height = IMG_H * FS;
  return [c, c.getContext("2d")];
}

/** Kaseta i prowadnice w danym kolorze osprzętu: rysunek anody przebarwiony (biały – rozjaśnienie, sosna –
 * ciepły odcień), cienie na tkaninie i szybie zostają bez zmian. */
function renderStatic(tone: RoofHardwareTone = "srebrny"): HTMLCanvasElement {
  const [frame, f] = blankLayer();
  if (f) {
    f.scale(FS, FS);
    drawGuide(f, "l");
    drawGuide(f, "r");
    drawCassette(f);
    if (tone !== "srebrny") {
      const [tinted, t] = blankLayer();
      if (t) {
        t.drawImage(frame, 0, 0);
        t.globalCompositeOperation = tone === "bialy" ? "screen" : "multiply";
        t.fillStyle = tone === "bialy" ? "#8f9499" : "#e6bf7d";
        t.fillRect(0, 0, tinted.width, tinted.height);
        t.globalCompositeOperation = "destination-in";
        t.drawImage(frame, 0, 0);
        f.setTransform(1, 0, 0, 1, 0, 0);
        f.clearRect(0, 0, frame.width, frame.height);
        f.drawImage(tinted, 0, 0);
      }
    }
  }
  const [out, o] = blankLayer();
  if (o) {
    o.save();
    o.scale(FS, FS);
    drawInnerShadows(o);
    o.restore();
    o.drawImage(frame, 0, 0);
  }
  return out;
}

// ------------------------------------------------------------------ co klatkę: tkanina i belka

type Assets = { frame: HTMLCanvasElement; weave: CanvasPattern | null; brush: CanvasPattern | null };

/** Tkanina do przymierzalni (RoofFabricRoom): kolor z CRM i zdjęcie próbki jako faktura. */
export type SceneFabric = { color: string; kind: "deko" | "termo"; imageUrl?: string };

function fabricClip(ctx: CanvasRenderingContext2D, bottom: number) {
  const top = CAS_BOT - 2;
  ctx.beginPath();
  ctx.moveTo(li(top) - 2, top);
  ctx.lineTo(ri(top) + 2, top);
  ctx.lineTo(ri(bottom) + 2, bottom);
  ctx.lineTo(li(bottom) - 2, bottom);
  ctx.closePath();
}

function drawFabric(ctx: CanvasRenderingContext2D, f: Fabric, alpha: number, bottom: number, a: Assets) {
  const x0 = li(CAS_BOT) - 4;
  const x1 = ri(CAS_BOT) + 4;
  const w = x1 - x0;
  const h = bottom - CAS_BOT + 4;
  ctx.globalAlpha = alpha;
  ctx.fillStyle = f.color;
  ctx.fillRect(x0, CAS_BOT - 4, w, h);
  if (f.pattern) {
    // prawdziwe zdjęcie próbki tkaniny z konfiguratora
    ctx.fillStyle = f.pattern;
    ctx.fillRect(x0, CAS_BOT - 4, w, h);
  } else if (a.weave) {
    ctx.globalAlpha = alpha * (f.kind === "deko" ? 0.32 : 0.24);
    ctx.fillStyle = a.weave;
    ctx.fillRect(x0, CAS_BOT - 4, w, h);
  }
  if (f.kind === "deko") {
    // DEKO przepuszcza światło: poświata okna przez tkaninę, najjaśniej na środku szyby
    ctx.globalAlpha = alpha;
    const cx = (x0 + x1) / 2;
    const glow = ctx.createRadialGradient(cx + 10, 300, 20, cx, 330, 330);
    glow.addColorStop(0, "rgba(255, 252, 240, 0.30)");
    glow.addColorStop(0.6, "rgba(255, 250, 235, 0.12)");
    glow.addColorStop(1, "rgba(255, 250, 235, 0)");
    ctx.fillStyle = glow;
    ctx.fillRect(x0, CAS_BOT - 4, w, h);
  } else {
    // TERMO nie przepuszcza światła: tylko delikatny połysk splotu i ciemniejsze brzegi
    ctx.globalAlpha = alpha;
    const sheen = ctx.createLinearGradient(x0, CAS_BOT, x1, bottom);
    sheen.addColorStop(0, "rgba(255,255,255,0.03)");
    sheen.addColorStop(0.45, "rgba(255,255,255,0.08)");
    sheen.addColorStop(1, "rgba(0,0,0,0.12)");
    ctx.fillStyle = sheen;
    ctx.fillRect(x0, CAS_BOT - 4, w, h);
  }
  ctx.globalAlpha = 1;
}

function drawBar(ctx: CanvasRenderingContext2D, top: number, a: Assets) {
  const yb = top + BAR_H;
  const xl = li(top) - 6;
  const xr = ri(top) + 6;
  // cień belki na szybie pod nią
  if (top < BAR_TOP_MAX - 0.5) {
    const sg = ctx.createLinearGradient(0, yb + 3, 0, yb + 22);
    sg.addColorStop(0, "rgba(20, 28, 40, 0.28)");
    sg.addColorStop(1, "rgba(20, 28, 40, 0)");
    ctx.fillStyle = sg;
    ctx.fillRect(li(yb), yb + 3, ri(yb) - li(yb), 19);
  }
  // szczotka uszczelniająca pod belką
  if (a.brush) {
    ctx.save();
    ctx.translate(0, yb - 0.5);
    ctx.fillStyle = a.brush;
    ctx.fillRect(xl + 4, 0, xr - xl - 8, 3.6);
    ctx.restore();
  }
  // profil belki: górna krawędź z odblaskiem, lico, spód
  ctx.save();
  ctx.shadowColor = "rgba(15, 20, 30, 0.35)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 1.5;
  const g = ctx.createLinearGradient(0, top, 0, yb);
  g.addColorStop(0, "#9da4ab");
  g.addColorStop(0.08, "#f7f8f9");
  g.addColorStop(0.3, "#e8ebee");
  g.addColorStop(0.62, "#d0d5da");
  g.addColorStop(0.82, "#b3bac1");
  g.addColorStop(0.9, "#8b9299");
  g.addColorStop(1, "#6f767d");
  ctx.fillStyle = g;
  roundRectPath(ctx, xl, top, xr - xl, BAR_H, 2);
  ctx.fill();
  ctx.restore();
  // rowek na lico belki
  ctx.fillStyle = "rgba(0,0,0,0.12)";
  ctx.fillRect(xl + 2, top + BAR_H * 0.66, xr - xl - 4, 0.7);
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  ctx.fillRect(xl + 2, top + BAR_H * 0.66 + 0.7, xr - xl - 4, 0.5);
  // dwa uchwyty (szare tworzywo) – za nie ściąga się roletę
  for (const f of [0.3, 0.7]) {
    const cx = lerp(li(top), ri(top), f);
    const hw = 17;
    const hy = top + 3;
    const hh = BAR_H + 4;
    ctx.save();
    ctx.shadowColor = "rgba(15, 20, 30, 0.4)";
    ctx.shadowBlur = 3;
    ctx.shadowOffsetY = 1.5;
    const hg = ctx.createLinearGradient(0, hy, 0, hy + hh);
    hg.addColorStop(0, "#d9dde1");
    hg.addColorStop(0.45, "#c0c6cc");
    hg.addColorStop(1, "#8e959c");
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.moveTo(cx - hw, hy);
    ctx.lineTo(cx + hw, hy);
    ctx.lineTo(cx + hw - 3, hy + hh);
    ctx.lineTo(cx - hw + 3, hy + hh);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.fillRect(cx - hw + 1, hy + 0.5, hw * 2 - 2, 0.8);
    ctx.fillStyle = "rgba(0,0,0,0.18)";
    ctx.fillRect(cx - hw + 5, hy + hh - 5, hw * 2 - 10, 0.9);
    // wkręt
    ctx.fillStyle = "rgba(80, 86, 92, 0.7)";
    ctx.beginPath();
    ctx.arc(cx + hw - 6, hy + hh * 0.42, 1.1, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawScene(ctx: CanvasRenderingContext2D, v: number, from: Fabric, to: Fabric, blend: number, a: Assets) {
  const top = lerp(BAR_TOP_MIN, BAR_TOP_MAX, v);
  const fabricBottom = top + 4;

  if (fabricBottom > CAS_BOT) {
    ctx.save();
    fabricClip(ctx, fabricBottom);
    ctx.clip();
    if (blend < 1) drawFabric(ctx, from, 1, fabricBottom, a);
    if (blend > 0) drawFabric(ctx, to, blend < 1 ? blend : 1, fabricBottom, a);
    // tkanina wchodzi w zacisk belki – cień tuż nad belką
    const eg = ctx.createLinearGradient(0, top - 8, 0, top + 1);
    eg.addColorStop(0, "rgba(0,0,0,0)");
    eg.addColorStop(1, "rgba(0,0,0,0.2)");
    ctx.fillStyle = eg;
    ctx.fillRect(li(top) - 2, top - 8, ri(top) - li(top) + 4, 9);
    ctx.restore();
  }
  drawBar(ctx, top, a);
  ctx.drawImage(a.frame, 0, 0, IMG_W, IMG_H);
}

// Przymierzalnia: roleta zjeżdża przy wejściu i po każdej zmianie tkaniny (krótko podjeżdża i wraca).
const SHOW_DOWN = 0.86;
const SHOW_INTRO_MS = 1800;
const SHOW_SWAP_MS = 1100;

/**
 * Render systemu B25 szeroki.
 * mode "loop" – pętla na górze strony (roleta jeździ, tkaniny się zmieniają);
 * mode "show" – przymierzalnia tkanin: pokazuje wybraną tkaninę (fabric) i kolor osprzętu (hardware).
 */
export default function RoofHeroScene({
  active = true,
  mode = "loop",
  fabric,
  hardware = "srebrny",
}: {
  active?: boolean;
  mode?: "loop" | "show";
  fabric?: SceneFabric | null;
  hardware?: RoofHardwareTone;
}) {
  const plateRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  // Stan przymierzalni czytany w pętli rysowania (bez przebudowy płótna przy każdej zmianie).
  const showRef = useRef<{ cur: Fabric; prev: Fabric; swapAt: number; hw: RoofHardwareTone; dirty: boolean }>({
    cur: FABRICS[0],
    prev: FABRICS[0],
    swapAt: -1e9,
    hw: hardware,
    dirty: true,
  });
  const patternsRef = useRef<Map<string, CanvasPattern | null>>(new Map());
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const firstFabricRef = useRef(true);

  const reduced = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );

  // zmiana tkaniny w przymierzalni
  const fabricKey = fabric ? `${fabric.imageUrl || ""}|${fabric.color}|${fabric.kind}` : "";
  useEffect(() => {
    if (mode !== "show" || !fabric) return;
    const s = showRef.current;
    const url = fabric.imageUrl || "";
    const next: Fabric = { id: fabricKey, color: fabric.color, kind: fabric.kind, pattern: url ? patternsRef.current.get(url) || null : null };
    if (s.cur.id === next.id) return;
    if (firstFabricRef.current) {
      // pierwsza tkanina: bez podjazdu, roleta po prostu zjeżdża w niej
      firstFabricRef.current = false;
      s.prev = next;
      s.cur = next;
    } else {
      s.prev = s.cur;
      s.cur = next;
      s.swapAt = performance.now();
    }
    s.dirty = true;
    if (url && !patternsRef.current.has(url)) {
      const img = new Image();
      img.decoding = "async";
      img.onload = () => {
        const ctx = ctxRef.current;
        const p = ctx ? ctx.createPattern(img, "repeat") : null;
        try {
          // próbka 300×200 px to kilkanaście cm tkaniny – na oknie drobniej
          p?.setTransform(new DOMMatrix().scale(0.42));
        } catch {
          /* bez skalowania */
        }
        patternsRef.current.set(url, p);
        const st = showRef.current;
        if (st.cur.id === next.id) st.cur = { ...st.cur, pattern: p };
        if (st.prev.id === next.id) st.prev = { ...st.prev, pattern: p };
        st.dirty = true;
      };
      img.src = url;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fabricKey, mode]);

  useEffect(() => {
    showRef.current.hw = hardware;
    showRef.current.dirty = true;
  }, [hardware]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const plate = plateRef.current;
    if (!canvas || !plate) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctxRef.current = ctx;

    const weaveCanvas = makeWeave();
    const brushCanvas = makeBrush();
    const weave = ctx.createPattern(weaveCanvas, "repeat");
    const brush = ctx.createPattern(brushCanvas, "repeat");
    // splot drobniejszy niż piksel zdjęcia – tkanina z bliska, nie gruba mata
    try {
      weave?.setTransform(new DOMMatrix().scale(0.45));
      brush?.setTransform(new DOMMatrix().scale(0.5));
    } catch {
      /* starsze przeglądarki bez setTransform – splot zostaje w skali 1:1 */
    }
    const frames = new Map<RoofHardwareTone, HTMLCanvasElement>();
    const frameFor = (tone: RoofHardwareTone) => {
      let fr = frames.get(tone);
      if (!fr) {
        fr = renderStatic(tone);
        frames.set(tone, fr);
      }
      return fr;
    };
    const assets: Assets = { frame: frameFor(mode === "show" ? showRef.current.hw : "srebrny"), weave, brush };

    let raf: number | null = null;
    let start: number | null = null;
    let width = 0;
    let height = 0;
    let dpr = 1;
    let visible = true;

    const fit = () => {
      dpr = Math.min(3, window.devicePixelRatio || 1);
      width = Math.max(1, plate.clientWidth);
      height = Math.max(1, plate.clientHeight);
      canvas.width = Math.round(width * dpr);
      canvas.height = Math.round(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
    };

    const paint = (v: number, from: Fabric, to: Fabric, blend: number, phase: number) => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // piksele zdjęcia -> płótno (zdjęcie ma object-fit: cover)
      const s = Math.max(width / IMG_W, height / IMG_H) * dpr;
      const ox = (width * dpr - IMG_W * s) / 2;
      const oy = (height * dpr - IMG_H * s) / 2;
      ctx.setTransform(s, 0, 0, s, ox, oy);
      ctx.imageSmoothingQuality = "high";
      drawScene(ctx, v, from, to, blend, assets);
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

    const renderLoop = (t: number) => {
      const fab = fabricAt(t);
      paint(barAt(t), FABRICS[fab.from], FABRICS[fab.to], fab.blend, (t / LOOP_MS) * Math.PI * 2);
    };

    const renderShow = (now: number) => {
      const st = showRef.current;
      assets.frame = frameFor(st.hw);
      const since = start === null ? 1e9 : now - start;
      let v = reduced ? SHOW_DOWN : SHOW_DOWN * easeInOut(Math.min(1, since / SHOW_INTRO_MS));
      const sw = now - st.swapAt;
      let blend = 1;
      if (sw >= 0 && sw < SHOW_SWAP_MS && !reduced) {
        // podjazd w górę i powrót, tkanina zmienia się w połowie drogi
        const p = sw / SHOW_SWAP_MS;
        v = Math.min(v, SHOW_DOWN - 0.32 * Math.sin(Math.PI * p));
        blend = easeInOut(Math.min(1, Math.max(0, (p - 0.2) / 0.5)));
      }
      paint(v, st.prev, st.cur, blend, (now / (LOOP_MS * 1.6)) * Math.PI * 2);
      st.dirty = false;
    };

    // Klatka stała (ograniczony ruch / pauza): roleta do połowy, beż DEKO.
    const staticT = 7000;
    const currentT = () => (start === null ? staticT : (performance.now() - start) % LOOP_MS);

    const tick = (now: number) => {
      if (start === null) start = now;
      if (mode === "show") renderShow(now);
      else renderLoop((now - start) % LOOP_MS);
      raf = visible ? requestAnimationFrame(tick) : null;
    };
    const run = () => {
      if (raf === null && visible && active && !reduced) raf = requestAnimationFrame(tick);
    };
    const still = () => {
      if (mode === "show") renderShow(performance.now());
      else renderLoop(currentT());
    };

    fit();
    const ro2 =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(() => {
            fit();
            still();
          })
        : null;
    ro2?.observe(plate);
    // poza ekranem nie rysujemy (dwie sceny na stronie: góra i przymierzalnia)
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver((entries) => {
            visible = entries.some((e) => e.isIntersecting);
            if (visible) run();
          })
        : null;
    io?.observe(plate);
    // przymierzalnia bez animacji: przerysuj po zmianie tkaniny / osprzętu
    const poll =
      mode === "show" && (reduced || !active)
        ? window.setInterval(() => {
            if (showRef.current.dirty) still();
          }, 200)
        : null;

    if (reduced || !active) still();
    else run();
    return () => {
      if (raf !== null) cancelAnimationFrame(raf);
      raf = null;
      if (poll !== null) window.clearInterval(poll);
      ro2?.disconnect();
      io?.disconnect();
    };
  }, [reduced, active, mode]);

  return (
    <div
      className="plisy-hero-scene rd-hero-scene"
      role="img"
      aria-label={
        mode === "show"
          ? "Podgląd: roleta dachowa KEIKA w wybranej tkaninie i kolorze osprzętu"
          : "Animacja: roleta dachowa KEIKA w systemie z szerokimi aluminiowymi prowadnicami i kasetą rozwija się i zatrzymuje w dowolnym miejscu; tkaniny DEKO i TERMO"
      }
    >
      <div className="plisy-hero-scene-plate" ref={plateRef}>
        <img className="plisy-hero-scene-base" src={RD_HERO_BASE_SRC} alt="" aria-hidden="true" decoding="async" />
        <canvas className="plisy-hero-scene-canvas" ref={canvasRef} aria-hidden="true" />
      </div>
    </div>
  );
}
