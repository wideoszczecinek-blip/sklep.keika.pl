"use client";

// Galeria w lejku plis (właściciel 2.11: „na stronie plis brakuje mi jeszcze galerii - wyselekcjonowanych i dobrze
// przygotowanych obrazów, najlepiej prawdziwych”). Stara galeria stała na samym dole (po FAQ) i ruch z reklam do niej
// nie dochodził - ta stoi w kolejności właściciela: wizualizator → galeria → film → konfigurator.
// Karuzela jak dawna galeria (właściciel 2.11: „na zasadzie karuzeli”): jedno duże zdjęcie, strzałki, przesuwanie
// palcem, miniatury pod spodem, powiększenie po kliknięciu.
// Tylko prawdziwe zdjęcia: montaże w domach i biurach + zdjęcia produktu z aparatu (sesja 5–6.09.2026).
// Pliki: public/plisy/galeria/*.webp, przygotowane skryptem (kadr, ciemne zdjęcia pod światło rozjaśnione
// lokalnym kontrastem, kolory tkanin bez zmian).
import { useEffect, useRef, useState } from "react";
import { trackShopStep } from "@/lib/track-step";

type Zdjecie = { src: string; opis: string; grupa: "dom" | "biuro" | "detal" };

const ZDJECIA: Zdjecie[] = [
  { src: "dom-okno-gora-dol", grupa: "dom", opis: "Okno dwuskrzydłowe: jedna plisa opuszczona z góry, druga podniesiona od dołu" },
  { src: "dom-okno-biala", grupa: "dom", opis: "Biała plisa zasłania dół okna, górą wpada światło" },
  { src: "dom-balkon-antracyt", grupa: "dom", opis: "Drzwi balkonowe z antracytowymi plisami na obu skrzydłach" },
  { src: "biuro-sala", grupa: "biuro", opis: "Sala konferencyjna: plisy w trzech rzędach okien" },
  { src: "dom-balkon-szara", grupa: "dom", opis: "Szara plisa na drzwiach balkonowych" },
  { src: "detal-profile-kolory", grupa: "detal", opis: "Profile w 10 kolorach, w tym 4 drewnopodobne – tu pięć z nich" },
  { src: "biuro-okna", grupa: "biuro", opis: "Biuro: plisy w górnych i środkowych skrzydłach okien" },
  { src: "detal-dwie-tkaniny", grupa: "detal", opis: "Z bliska: fałdy tkaniny i górny profil z uchwytem" },
  { src: "biuro-sciana-biala", grupa: "biuro", opis: "Białe plisy na przeszklonej ścianie biura" },
  { src: "detal-plaster-miodu", grupa: "detal", opis: "Tkanina o strukturze plastra miodu" },
  { src: "detal-uchwyt", grupa: "detal", opis: "Dolny uchwyt sznurków – plisa zostaje przy skrzydle, gdy otwierasz okno" },
  { src: "detal-falda", grupa: "detal", opis: "Krawędź fałd z boku – równe, sztywne plisowanie" },
];

const GRUPY: { id: "wszystkie" | Zdjecie["grupa"]; label: string }[] = [
  { id: "wszystkie", label: "Wszystkie" },
  { id: "dom", label: "W domach" },
  { id: "biuro", label: "W biurach" },
  { id: "detal", label: "Z bliska" },
];

const pelne = (src: string) => `/plisy/galeria/${src}.webp`;
// 1080 / 128 - szerokości z listy optymalizatora (slajd ok. 700 px na komputerze, 390 px przy DPR 2–3 na telefonie)
const slajd = (src: string) => `/_next/image?url=${encodeURIComponent(pelne(src))}&w=1080&q=75`;
const miniatura = (src: string) => `/_next/image?url=${encodeURIComponent(pelne(src))}&w=128&q=70`;

export function LejekGaleria({ onZoom }: { onZoom: (title: string, urls: string[], index: number) => void }) {
  const [grupa, setGrupa] = useState<(typeof GRUPY)[number]["id"]>("wszystkie");
  const [aktywne, setAktywne] = useState(0);
  const tasmaRef = useRef<HTMLDivElement | null>(null);
  const miniRef = useRef<HTMLDivElement | null>(null);
  const widoczne = grupa === "wszystkie" ? ZDJECIA : ZDJECIA.filter((z) => z.grupa === grupa);
  const nr = Math.min(aktywne, widoczne.length - 1);

  // numer slajdu z przewinięcia - palec, strzałki i miniatury przewijają tę samą taśmę
  useEffect(() => {
    const el = tasmaRef.current;
    if (!el) return;
    let klatka = 0;
    const onScroll = () => {
      if (klatka) return;
      klatka = window.requestAnimationFrame(() => {
        klatka = 0;
        setAktywne(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (klatka) window.cancelAnimationFrame(klatka);
    };
  }, []);

  // aktywna miniatura na środku paska (przewija tylko pasek, nie stronę)
  useEffect(() => {
    const pasek = miniRef.current;
    const mini = pasek?.children[nr] as HTMLElement | undefined;
    if (pasek && mini) pasek.scrollTo({ left: mini.offsetLeft - (pasek.clientWidth - mini.clientWidth) / 2, behavior: "smooth" });
  }, [nr]);

  const idzDo = (i: number, zrodlo: string) => {
    const el = tasmaRef.current;
    if (!el) return;
    const n = (i + widoczne.length) % widoczne.length;
    el.scrollTo({ left: n * el.clientWidth, behavior: "smooth" });
    trackShopStep("lejek_galeria_przewin", "plisy", { zrodlo, zdjecie: widoczne[n].src });
  };

  return (
    <section className="pm-section lj-galeria" aria-labelledby="lj-gal-t">
      <p className="pm-eyebrow">Galeria</p>
      <h2 id="lj-gal-t" className="pm-title">Prawdziwe plisy KEIKA w prawdziwych oknach</h2>
      <p className="lj-galeria-lead">Zdjęcia z montaży w domach i biurach oraz nasz produkt z bliska – bez grafiki komputerowej i bez AI.</p>
      <div className="lj-galeria-grupy" role="tablist" aria-label="Rodzaj zdjęć">
        {GRUPY.map((g) => (
          <button
            key={g.id}
            type="button"
            role="tab"
            aria-selected={grupa === g.id}
            className={grupa === g.id ? "is-active" : ""}
            onClick={() => {
              setGrupa(g.id);
              setAktywne(0);
              tasmaRef.current?.scrollTo({ left: 0 });
              trackShopStep("lejek_galeria_grupa", "plisy", { grupa: g.id });
            }}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="lj-karuzela" role="region" aria-roledescription="karuzela" aria-label="Zdjęcia plis KEIKA">
        <div className="lj-karuzela-tasma" ref={tasmaRef}>
          {widoczne.map((z, i) => (
            <button
              key={z.src}
              type="button"
              className="lj-karuzela-slajd"
              aria-label={`Powiększ zdjęcie ${i + 1} z ${widoczne.length}: ${z.opis}`}
              onClick={() => {
                trackShopStep("lejek_galeria_zdjecie", "plisy", { zdjecie: z.src });
                onZoom("Plisy KEIKA – prawdziwe zdjęcia", widoczne.map((x) => pelne(x.src)), i);
              }}
            >
              {/* rozmyte tło z tego samego zdjęcia - pionowe i poziome kadry widać w całości, bez ucinania */}
              <img className="lj-karuzela-tlo" src={slajd(z.src)} alt="" aria-hidden="true" loading="lazy" decoding="async" />
              <img className="lj-karuzela-foto" src={slajd(z.src)} alt={z.opis} loading="lazy" decoding="async" />
            </button>
          ))}
        </div>
        {widoczne.length > 1 ? (
          <>
            <button type="button" className="lj-karuzela-strzalka is-lewo" aria-label="Poprzednie zdjęcie" onClick={() => idzDo(nr - 1, "strzalka")}>
              ‹
            </button>
            <button type="button" className="lj-karuzela-strzalka is-prawo" aria-label="Następne zdjęcie" onClick={() => idzDo(nr + 1, "strzalka")}>
              ›
            </button>
          </>
        ) : null}
        <span className="lj-karuzela-licznik">
          {nr + 1} / {widoczne.length}
        </span>
      </div>
      <p className="lj-karuzela-opis">{widoczne[nr]?.opis}</p>
      <div className="lj-karuzela-mini" ref={miniRef} aria-label="Wybierz zdjęcie">
        {widoczne.map((z, i) => (
          <button
            key={z.src}
            type="button"
            className={i === nr ? "is-active" : ""}
            aria-label={`Zdjęcie ${i + 1}: ${z.opis}`}
            aria-current={i === nr ? "true" : undefined}
            onClick={() => idzDo(i, "miniatura")}
          >
            <img src={miniatura(z.src)} alt="" loading="lazy" decoding="async" />
          </button>
        ))}
      </div>
    </section>
  );
}
