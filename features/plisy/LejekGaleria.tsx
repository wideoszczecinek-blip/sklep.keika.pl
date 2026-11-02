"use client";

// Galeria w lejku plis (właściciel 2.11: „na stronie plis brakuje mi jeszcze galerii - wyselekcjonowanych i dobrze
// przygotowanych obrazów, najlepiej prawdziwych”). Stara galeria stała na samym dole (po FAQ) i ruch z reklam do niej
// nie dochodził - ta stoi w kolejności właściciela: wizualizator → galeria → film → konfigurator.
// Tylko prawdziwe zdjęcia: montaże w domach i biurach + zdjęcia produktu z aparatu (sesja 5–6.09.2026).
// Pliki: public/plisy/galeria/*.webp, przygotowane skryptem (kadr, ciemne zdjęcia pod światło rozjaśnione
// lokalnym kontrastem, kolory tkanin bez zmian).
import { useState } from "react";
import { trackShopStep } from "@/lib/track-step";

type Zdjecie = { src: string; opis: string; grupa: "dom" | "biuro" | "detal"; duze?: boolean };

const ZDJECIA: Zdjecie[] = [
  { src: "dom-okno-gora-dol", grupa: "dom", duze: true, opis: "Okno dwuskrzydłowe: jedna plisa opuszczona z góry, druga podniesiona od dołu" },
  { src: "dom-okno-biala", grupa: "dom", opis: "Biała plisa zasłania dół okna, górą wpada światło" },
  { src: "dom-balkon-antracyt", grupa: "dom", opis: "Drzwi balkonowe z antracytowymi plisami na obu skrzydłach" },
  { src: "biuro-sala", grupa: "biuro", duze: true, opis: "Sala konferencyjna: plisy w trzech rzędach okien" },
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
// 640 to szerokość z listy optymalizatora (kafel ok. 320 px na telefonie przy DPR 2)
const kafel = (src: string) => `/_next/image?url=${encodeURIComponent(pelne(src))}&w=640&q=75`;

export function LejekGaleria({ onZoom }: { onZoom: (title: string, urls: string[], index: number) => void }) {
  const [grupa, setGrupa] = useState<(typeof GRUPY)[number]["id"]>("wszystkie");
  const widoczne = grupa === "wszystkie" ? ZDJECIA : ZDJECIA.filter((z) => z.grupa === grupa);
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
              trackShopStep("lejek_galeria_grupa", "plisy", { grupa: g.id });
            }}
          >
            {g.label}
          </button>
        ))}
      </div>
      <div className="lj-galeria-siatka">
        {widoczne.map((z, i) => (
          <button
            key={z.src}
            type="button"
            className={`lj-galeria-kafel${z.duze && grupa === "wszystkie" ? " is-duze" : ""}`}
            onClick={() => {
              trackShopStep("lejek_galeria_zdjecie", "plisy", { zdjecie: z.src });
              onZoom("Plisy KEIKA – prawdziwe zdjęcia", widoczne.map((x) => pelne(x.src)), i);
            }}
            aria-label={`Powiększ: ${z.opis}`}
          >
            <img src={kafel(z.src)} alt={z.opis} loading="lazy" decoding="async" />
            <span>{z.opis}</span>
          </button>
        ))}
      </div>
    </section>
  );
}
