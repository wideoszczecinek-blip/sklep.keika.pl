"use client";

/**
 * Animacja na ekranie startowym wizualizatora (właściciel 1.11: „pokaż animację, jak ze zdjęcia robimy
 * wizualizację i jak belki się ruszają”). Prawdziwy renderer (lib/wizualizator/renderer.ts) na zdjęciu
 * demonstracyjnym (Unsplash, licencja pozwala na użycie komercyjne), rogi szyb z wyniku naszego silnika.
 * Pętla ~11 s: zdjęcie → skan AI i obrysy szyb → plisa zjeżdża → belki w ruchu (łapka) → zmiana tkaniny.
 */
import { useEffect, useRef, useState } from "react";
import { type Pt, apply, paneToImage } from "@/lib/wizualizator/homografia";
import { WizRenderer, hexToRgb, type PaneRender } from "@/lib/wizualizator/renderer";
import { fetchKatalog } from "@/lib/wizualizator/api";
import s from "./WizModal.module.css";

const DEMO_W = 1200;
const DEMO_H = 801;
const PANES: { rogi: Pt[]; wMm: number; hMm: number }[] = [
  { rogi: [[143, 102.2], [395.6, 141.8], [388.1, 682.1], [158, 717.9]], wMm: 550, hMm: 1100 },
  { rogi: [[485.8, 150.3], [752.6, 181.3], [762.4, 622.1], [484, 667.3]], wMm: 650, hMm: 1100 },
];
const TKANINY = ["pp153", "pp166", "pp158"];
const ETAPY = ["Zdjęcie", "Kolory", "Podgląd", "Wycena"];
const LOOP = 11000;

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2);
const seg = (t: number, a: number, b: number) => Math.min(1, Math.max(0, (t - a) / (b - a)));

export default function WizDemo() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [etap, setEtap] = useState(0);
  const [scan, setScan] = useState<{ y: number; obrys: number } | null>(null);
  const [lapka, setLapka] = useState<{ x: number; y: number; on: boolean } | null>(null);
  const [gotowe, setGotowe] = useState(false);

  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    let r: WizRenderer;
    try {
      r = new WizRenderer(c);
    } catch {
      return;
    }
    let raf = 0;
    let visible = true;
    let stop = false;
    const fabrics: { id: string; color: [number, number, number]; tr: number }[] = [];
    const io = new IntersectionObserver((e) => { visible = e[0]?.isIntersecting ?? true; }, { threshold: 0.1 });
    io.observe(c);

    void (async () => {
      const img = new Image();
      img.src = "/wizualizator-demo.jpg";
      await img.decode().catch(() => null);
      if (stop) return;
      r.setPhoto(img);
      const k = await fetchKatalog();
      for (const id of TKANINY) {
        const t = k?.tkaniny.find((x) => x.id === id);
        fabrics.push({ id, color: hexToRgb(t?.kolor || "#DDD6C8"), tr: t?.transmisja ?? 0.3 });
        if (t) {
          const ti = new Image();
          ti.crossOrigin = "anonymous";
          ti.onload = () => r.addFabric(id, ti);
          ti.src = t.tekstura;
        }
      }
      setGotowe(true);
      const t0 = performance.now();
      const frame = (now: number) => {
        if (stop) return;
        raf = requestAnimationFrame(frame);
        if (!visible) return;
        const t = (now - t0) % LOOP;
        const e = t < 3800 ? 0 : t < 7200 ? 1 : t < 9700 ? 2 : 3;
        setEtap((p) => (p === e ? p : e));
        // skan i obrysy szyb
        setScan(t >= 1200 && t < 3000 ? { y: seg(t, 1200, 2600), obrys: seg(t, 1500, 2800) } : null);
        // plisa: zjeżdża (2,8–3,8 s), potem belki w ruchu (3,8–7,2 s), potem kolory
        // każda szyba pracuje niezależnie: lewa - górna belka schodzi (plisa „od góry”), prawa - dolna belka jeździ
        let dol = 0.06;
        let gora = 0;
        let dolL = 0.06;
        let goraL = 0;
        if (t >= 2800) {
          dol = 0.06 + 0.64 * ease(seg(t, 2800, 3800));
          dolL = 0.06 + 0.86 * ease(seg(t, 2900, 3900));
        }
        if (t >= 3800 && t < 7200) {
          const u = seg(t, 3800, 7200);
          dol = 0.7 + 0.25 * Math.sin(u * Math.PI * 2) * (1 - u * 0.2);
          gora = 0.22 * Math.sin(u * Math.PI) ** 2;
          goraL = 0.42 * Math.sin(u * Math.PI * 1.5) ** 2;
          dolL = 0.92 - 0.12 * Math.sin(u * Math.PI * 2 + 1.2) ** 2;
        }
        if (t >= 7200) {
          dol = 0.7;
          goraL = 0.3;
          dolL = 0.92;
        }
        const fi = t < 7200 ? 0 : Math.min(TKANINY.length - 1, Math.floor((t - 7200) / 1100));
        const f = fabrics[fi] || { id: "", color: [0.86, 0.84, 0.78] as [number, number, number], tr: 0.3 };
        const panes: PaneRender[] = t < 2800 ? [] : PANES.map((p, i) => ({
          id: "d" + i, corners: p.rogi, top: i === 1 ? gora : goraL, bottom: i === 1 ? dol : dolL,
          fabric: { id: f.id, color: f.color, transmission: f.tr, texture: null, honeycomb: false },
          rail: [0.94, 0.94, 0.93], railId: "bialy", bracket: [0.95, 0.95, 0.94], mount: "standard", widthMm: p.wMm, heightMm: p.hMm,
          back: 1, front: 0.62 + 0.25 * i, pitch: 0, selected: false,
        }));
        r.render(panes, { tint: [1.06, 0.99, 0.93], split: 1e9, outline: false });
        // łapka przy dolnej belce prawej szyby
        if (t >= 3800 && t < 7200 && wrapRef.current) {
          const H = paneToImage(PANES[1].rogi);
          const rect = c.getBoundingClientRect();
          const wr = wrapRef.current.getBoundingClientRect();
          if (H) {
            const [x, y] = apply(H, [0.55, dol]);
            setLapka({ x: rect.left - wr.left + (x / DEMO_W) * rect.width, y: rect.top - wr.top + (y / DEMO_H) * rect.height, on: true });
          }
        } else {
          setLapka((p) => (p ? null : p));
        }
      };
      raf = requestAnimationFrame(frame);
    })();
    return () => {
      stop = true;
      cancelAnimationFrame(raf);
      io.disconnect();
      r.dispose();
    };
  }, []);

  return (
    <div className={s.demo} ref={wrapRef} aria-label="Animacja: ze zdjęcia okna powstaje wizualizacja plisy">
      <canvas ref={canvasRef} className={s.demoCanvas} width={DEMO_W} height={DEMO_H} />
      {scan ? (
        <>
          <div className={s.demoScan} style={{ top: `${scan.y * 100}%` }} />
          <svg className={s.demoSvg} viewBox={`0 0 ${DEMO_W} ${DEMO_H}`} preserveAspectRatio="none" aria-hidden="true">
            {PANES.map((p, i) => (
              <polygon key={i} points={p.rogi.map((q) => q.join(",")).join(" ")} pathLength={100}
                style={{ strokeDasharray: 100, strokeDashoffset: 100 - scan.obrys * 100 }} />
            ))}
          </svg>
        </>
      ) : null}
      {lapka ? <span className={s.demoHand} style={{ left: lapka.x, top: lapka.y }} aria-hidden="true">👆</span> : null}
      <div className={s.demoSteps}>
        {ETAPY.map((n, i) => (
          <span key={n} className={i === etap ? s.demoStepOn : s.demoStep}>{i + 1}. {n}</span>
        ))}
      </div>
      {!gotowe ? <div className={s.loading}>…</div> : null}
      <span className={s.demoBadge}>{etap === 3 ? "Wymiary ze zdjęcia dają orientacyjną cenę" : "Wizualizacja poglądowa"}</span>
    </div>
  );
}
