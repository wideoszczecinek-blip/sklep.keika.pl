"use client";

// Karuzela zdjęć na górze strony moskitier ramkowych (właściciel, 2026-10-03:
// "na mobile zdjęcie produktu jest za nisko - mam pierwszy akapit, pod spodem
// od razu szybka wycena, brakuje pomiędzy nimi zdjęcia głównego albo
// karuzeli"). Wcześniej pierwsze zdjęcie produktu było dopiero pod opisem,
// prawie dwa ekrany niżej.
//
// Kolejność ułożona pod pytania z pierwszej sekundy: jak wygląda w oknie,
// jakie są kolory, z bliska, i jak wygląda u ludzi (zdjęcia klientów, bez
// studia i retuszu). Przewijanie palcem z podglądem następnego zdjęcia
// z boku, kropki pod spodem; stuknięcie otwiera zdjęcie w pełnym rozmiarze.
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { optimizeImageUrl } from "@/lib/image-optim";
import { trackShopStep } from "@/lib/track-step";

const BASE = "https://crm-keika.groovemedia.pl/storage/shop/media/moskitiery-ramkowe-galeria/";

type Slide = { src: string; alt: string; tag?: string; fit?: "contain" };

const SLIDES: Slide[] = [
  {
    src: "https://crm-keika.groovemedia.pl/storage/shop/media/20260327_214156_d5ad04b7_moskitiera-okienna.jpg",
    alt: "Biała moskitiera ramkowa KEIKA założona na okno",
  },
  {
    src: `${BASE}moskitiera-okienna-allegro-miniaturka.jpg`,
    alt: "Moskitiera ramkowa w kolorach białym, antracytowym i drewnopodobnych",
    tag: "7 kolorów ramy",
    fit: "contain",
  },
  {
    src: `${BASE}klienci/moskitiera-klient-18.jpg`,
    alt: "Moskitiera ramkowa w oknie u klienta, widok na ogród",
    tag: "Zdjęcie od klienta",
  },
  {
    src: `${BASE}moskitiera-okienna-50.jpg`,
    alt: "Moskitiery ramkowe we wszystkich kolorach profili ustawione obok siebie",
    tag: "Kolory profili",
  },
  {
    src: `${BASE}moskitiera-okienna-16.jpg`,
    alt: "Moskitiera ramkowa w kolorze złoty dąb",
  },
  {
    src: `${BASE}klienci/moskitiera-klient-08.jpg`,
    alt: "Moskitiera w kolorze drewna na oknie u klienta",
    tag: "Zdjęcie od klienta",
  },
  {
    src: `${BASE}moskitiera-okienna-13.jpg`,
    alt: "Zbliżenie narożnika ramy i wzmocnionej siatki",
    tag: "Z bliska",
  },
  {
    src: `${BASE}klienci/moskitiera-klient-01.jpg`,
    alt: "Narożnik moskitiery na drewnopodobnym oknie u klienta",
    tag: "Zdjęcie od klienta",
  },
];

export default function MoskitieryHeroPhotos() {
  const trackRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const swipedRef = useRef(false);

  // Która klatka jest teraz na środku - liczone z pozycji przewinięcia.
  const onScroll = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const slide = el.firstElementChild as HTMLElement | null;
    if (!slide) return;
    const step = slide.offsetWidth + parseFloat(getComputedStyle(el).columnGap || "0");
    const index = Math.max(0, Math.min(SLIDES.length - 1, Math.round(el.scrollLeft / Math.max(1, step))));
    setActive(index);
    if (index > 0 && !swipedRef.current) {
      swipedRef.current = true;
      trackShopStep("hero_photos_swipe", "moskitiery-ramkowe");
    }
  }, []);

  const goTo = (index: number) => {
    const el = trackRef.current;
    const slide = el?.children[index] as HTMLElement | undefined;
    if (!el || !slide) return;
    el.scrollTo({ left: slide.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };

  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
      if (event.key === "ArrowRight") setLightbox((i) => (i === null ? null : (i + 1) % SLIDES.length));
      if (event.key === "ArrowLeft") setLightbox((i) => (i === null ? null : (i - 1 + SLIDES.length) % SLIDES.length));
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // sąsiednie zdjęcia z wyprzedzeniem, żeby "dalej" nie czekało
    for (const offset of [1, -1]) {
      const next = new Image();
      next.decoding = "async";
      next.src = optimizeImageUrl(SLIDES[(lightbox + offset + SLIDES.length) % SLIDES.length].src, 1800);
    }
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [lightbox]);

  return (
    <>
      <div className="mosk-hero-photos" role="region" aria-roledescription="karuzela" aria-label="Zdjęcia moskitiery ramkowej">
        <div className="mosk-hero-track" ref={trackRef} onScroll={onScroll}>
          {SLIDES.map((slide, index) => (
            <button
              key={slide.src}
              type="button"
              className={`mosk-hero-slide${slide.fit === "contain" ? " is-contain" : ""}`}
              onClick={() => {
                setLightbox(index);
                trackShopStep("hero_photos_open", String(index + 1), { product: "moskitiery-ramkowe" });
              }}
              aria-label={`Powiększ zdjęcie ${index + 1} z ${SLIDES.length}: ${slide.alt}`}
            >
              <img
                src={optimizeImageUrl(slide.src, 900)}
                alt={slide.alt}
                loading={index === 0 ? "eager" : "lazy"}
                fetchPriority={index === 0 ? "high" : "auto"}
                decoding="async"
                draggable={false}
              />
              {slide.tag ? <span className="mosk-hero-tag">{slide.tag}</span> : null}
            </button>
          ))}
        </div>
        <span className="mosk-hero-count" aria-hidden="true">
          {active + 1} / {SLIDES.length}
        </span>
        <div className="mosk-hero-dots" role="tablist" aria-label="Wybierz zdjęcie">
          {SLIDES.map((slide, index) => (
            <button
              key={slide.src}
              type="button"
              role="tab"
              aria-selected={index === active}
              aria-label={`Zdjęcie ${index + 1}`}
              className={`mosk-hero-dot${index === active ? " is-active" : ""}`}
              onClick={() => goTo(index)}
            />
          ))}
        </div>
      </div>

      {lightbox !== null && typeof document !== "undefined"
        ? createPortal(
            <div className="instruction-modal plisy-hero-lightbox" role="dialog" aria-modal="true" aria-label="Zdjęcie moskitiery" onClick={() => setLightbox(null)}>
              <div className="plisy-hero-lightbox-shell" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="instruction-modal-close" aria-label="Zamknij" onClick={() => setLightbox(null)}>
                  ×
                </button>
                <button
                  type="button"
                  className="plisy-fg-arrow plisy-fg-arrow--prev"
                  aria-label="Poprzednie zdjęcie"
                  onClick={() => setLightbox((lightbox - 1 + SLIDES.length) % SLIDES.length)}
                >
                  ‹
                </button>
                <img src={optimizeImageUrl(SLIDES[lightbox].src, 1800)} alt={SLIDES[lightbox].alt} />
                <button
                  type="button"
                  className="plisy-fg-arrow plisy-fg-arrow--next"
                  aria-label="Następne zdjęcie"
                  onClick={() => setLightbox((lightbox + 1) % SLIDES.length)}
                >
                  ›
                </button>
                <p className="plisy-hero-lightbox-caption">
                  {SLIDES[lightbox].tag ? `${SLIDES[lightbox].tag} · ` : ""}
                  {lightbox + 1} / {SLIDES.length}
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
