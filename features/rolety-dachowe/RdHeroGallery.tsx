"use client";

// Zdjęcia na górze strony rolet dachowych (23.11.2026, właściciel: „Tak, przebuduj” – pierwszy ekran wzorem plis
// dachowych z 22.11). Ta sama karuzela co na /plisy i /plisy-dachowe (klasy plv2-*, pd-gallery), zamiast mozaiki
// z grafiką ze znaczkami (RoofHeroPhotos zostaje w repo, nieużywana). Wnętrza to wizualizacje z oferty Allegro
// właściciela (gallery.ts), ostatni slajd to prawdziwe zdjęcia produktu.
import { useEffect, useState } from "react";
import { trackShopStep } from "@/lib/track-step";

const src = (path: string, w = 900) => `/_next/image?url=${encodeURIComponent(path)}&w=${w}&q=75`;

type Slajd = { id: string; zdjecie: string; alt: string; contain?: boolean };

const SLAJDY: Slajd[] = [
  { id: "sypialnia", zdjecie: "/rolety-dachowe/wnetrze-02.jpg", alt: "Ciemna roleta dachowa zasłaniająca okno w sypialni na poddaszu – wizualizacja" },
  { id: "salon", zdjecie: "/rolety-dachowe/wnetrze-03.jpg", alt: "Roleta dachowa w oknie pokoju na poddaszu – wizualizacja" },
  { id: "produkt", zdjecie: "/rolety-dachowe/produkt-02.jpg", alt: "Rolety dachowe KEIKA z bliska – kaseta, prowadnice i kolory tkanin", contain: true },
];

export default function RdHeroGallery() {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timer = window.setInterval(() => setActive((i) => (i + 1) % SLAJDY.length), 5200);
    return () => window.clearInterval(timer);
  }, [playing]);

  return (
    <div className="plv2-gallery pd-gallery rd-gallery" role="region" aria-label="Zdjęcia rolet dachowych KEIKA">
      <div className="plv2-photo-stage">
        {SLAJDY.map((s, index) => (
          <figure key={s.id} className={`plv2-slide ${s.contain ? "rd-slide-contain" : ""} ${index === active ? "is-active" : ""}`} aria-hidden={index !== active}>
            <img src={src(s.zdjecie)} alt={s.alt} decoding="async" fetchPriority={index === 0 ? "high" : "low"} />
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
                trackShopStep("hero_gallery_dot", "rolety-dachowe", { index });
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
