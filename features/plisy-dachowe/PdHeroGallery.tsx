"use client";

// Zdjęcia na górze strony plis dachowych (właściciel 22.11: „animacja niekoniecznie wygląda dobrze, możesz ją zastąpić
// zdjęciami”). Ta sama karuzela co na /plisy (PlisyHeroGallery, klasy plv2-*), tylko prawdziwe zdjęcia produktu
// z oferty właściciela (features/plisy-dachowe/gallery.ts) - bez zdjęcia ze znaczkami na obrazie (produkt-01).
import { useEffect, useState } from "react";
import { trackShopStep } from "@/lib/track-step";
import { PD_PRODUCT_SLUG } from "./shared";

const src = (path: string, w = 900) => `/_next/image?url=${encodeURIComponent(path)}&w=${w}&q=75`;

type Slajd = { id: string; zdjecia: string[]; alt: string; para?: boolean };

const SLAJDY: Slajd[] = [
  { id: "poddasze", zdjecia: ["/plisy-dachowe/aranzacja-01.jpg"], alt: "Plisy dachowe KEIKA w dwóch oknach dachowych na poddaszu – zasłonięty środek szyby" },
  {
    id: "dwie",
    zdjecia: ["/plisy-dachowe/produkt-02.jpg", "/plisy-dachowe/produkt-03.jpg"],
    alt: "Plisa dachowa jasna i zaciemniająca – zasłonięta dolna część okna, prowadnice po bokach",
    para: true,
  },
  { id: "detal", zdjecia: ["/plisy-dachowe/detal-02.jpg"], alt: "Plisa dachowa z bliska – belka z uchwytem" },
];

export default function PdHeroGallery() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % SLAJDY.length), 5200);
    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <div className="plv2-gallery pd-gallery" role="region" aria-label="Zdjęcia plis dachowych KEIKA">
      <div className="plv2-photo-stage">
        {SLAJDY.map((s, index) => (
          <figure key={s.id} className={`plv2-slide ${s.para ? "pd-slide-para" : ""} ${index === active ? "is-active" : ""}`} aria-hidden={index !== active}>
            {s.zdjecia.map((z, i) => (
              <img
                key={z}
                src={src(z, s.para ? 640 : 900)}
                alt={i === 0 ? s.alt : ""}
                decoding="async"
                fetchPriority={index === 0 ? "high" : "low"}
              />
            ))}
          </figure>
        ))}
        <div className="plv2-gallery-dots" aria-label="Sterowanie zdjęciami">
          {SLAJDY.map((s, index) => (
            <button
              key={s.id}
              type="button"
              className={index === active ? "is-active" : ""}
              aria-label={`Zdjęcie ${index + 1}`}
              aria-pressed={index === active}
              onClick={() => {
                setPlaying(false);
                setActive(index);
                trackShopStep("hero_gallery_dot", PD_PRODUCT_SLUG, { index });
              }}
            />
          ))}
          <button type="button" className="plv2-gallery-pause" aria-label={playing ? "Wstrzymaj karuzelę" : "Wznów karuzelę"} onClick={() => setPlaying(!playing)}>
            {playing ? "Ⅱ" : "▶"}
          </button>
        </div>
      </div>
    </div>
  );
}
