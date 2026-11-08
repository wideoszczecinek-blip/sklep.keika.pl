"use client";

// Góra landingu rolet dachowych (9.11.2026, właściciel: „przywitanie klienta animacja nie oddająca produktu to dno –
// fajny jest efekt ze zmniejszeniem pierwszego ujęcia, ale zamiast animacji niech to będzie miniatura – animacja
// pojawi się jako pierwsza po prawej i kliknięcie w nią ma ją powiększyć – wszystko płynne”).
//   • Desktop: miniatura produktu (to samo zdjęcie co w menu i katalogu) na całym polu 16:9, po chwili płynnie
//     dokuje w lewym górnym rogu, a w kształt L wjeżdżają: animacja systemu B25 (prawy, wysoki kafel – pierwszy)
//     i dwie wizualizacje DEKO / TERMO. Klik w animację: kafel płynnie rozrasta się na całe pole (drugi klik, ✕
//     albo Esc – wraca na miejsce). Klik w miniaturę i wizualizacje: powiększenie zdjęcia.
//   • Telefon: miniatura na pełnej szerokości, pod nią pasek: animacja jako pierwsza, potem wizualizacje. Dotknięcie
//     animacji płynnie podmienia miniaturę na animację (ponowne dotknięcie – z powrotem).
// Układ korzysta z reguł .plisy-hero-* (nic w nich nie jest plisowe) + .rd-hero-* w globals.css.
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { RD_HERO_PHOTOS, RD_HERO_PHOTO_ALT } from "./gallery";
import RoofHeroScene from "./RoofHeroScene";

const INTRO_MS = 3200;

const tileSrc = (src: string, w = 700) => `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=80`;

function useMedia(query: string, fallback: boolean) {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(query).matches,
    () => fallback,
  );
}

export default function RoofHeroPhotos() {
  const photos = RD_HERO_PHOTOS;
  const [docked, setDocked] = useState(false);
  const [animOpen, setAnimOpen] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const reduced = useMedia("(prefers-reduced-motion: reduce)", false);
  const desktop = useMedia("(min-width: 761px)", true);

  useEffect(() => {
    if (!desktop) return;
    const id = window.setTimeout(() => setDocked(true), reduced ? 0 : INTRO_MS);
    return () => window.clearTimeout(id);
  }, [desktop, reduced]);

  useEffect(() => {
    if (!animOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAnimOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [animOpen]);

  // Sąsiednie zdjęcia z wyprzedzeniem (audyt 2026-10-01).
  useEffect(() => {
    if (lightbox === null || photos.length < 2) return;
    for (const offset of [1, -1]) {
      const next = new Image();
      next.decoding = "async";
      next.src = photos[(lightbox + offset + photos.length) % photos.length];
    }
  }, [lightbox, photos]);
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
      if (event.key === "ArrowRight") setLightbox((i) => (i === null ? null : (i + 1) % photos.length));
      if (event.key === "ArrowLeft") setLightbox((i) => (i === null ? null : (i - 1 + photos.length) % photos.length));
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [lightbox, photos.length]);

  const isDocked = desktop && docked;

  const photoTile = (i: number, extraClass: string) => (
    <button key={photos[i]} type="button" className={`plisy-hero-tile ${extraClass}`} onClick={() => setLightbox(i)} aria-label={`Powiększ: ${RD_HERO_PHOTO_ALT[i] || "zdjęcie produktu"}`}>
      <img src={tileSrc(photos[i])} alt={RD_HERO_PHOTO_ALT[i] || ""} loading="lazy" decoding="async" />
      <span className="plisy-hero-tile-zoom" aria-hidden="true">
        🔍
      </span>
    </button>
  );

  const animLabel = (
    <span className="rd-hero-anim-label" aria-hidden="true">
      <span className="rd-hero-anim-play">▶</span> Zobacz, jak działa
    </span>
  );

  return (
    <>
      <div
        className={`plisy-hero-photos rd-hero-photos ${isDocked ? "is-docked" : ""} ${animOpen ? "is-anim-open" : ""} ${reduced ? "is-instant" : ""}`}
        role="region"
        aria-label="Roleta dachowa KEIKA – zdjęcie produktu, animacja działania i wizualizacje"
      >
        <div
          className="plisy-hero-stage rd-hero-stage"
          onClick={() => {
            if (!desktop && animOpen) {
              setAnimOpen(false);
              return;
            }
            if (isDocked) setLightbox(0);
          }}
          role={isDocked ? "button" : undefined}
          tabIndex={isDocked ? 0 : undefined}
          title={isDocked ? "Powiększ zdjęcie" : undefined}
          onKeyDown={(event) => {
            if (isDocked && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              setLightbox(0);
            }
          }}
        >
          <img className="rd-hero-thumb" src={tileSrc(photos[0], 1200)} alt={RD_HERO_PHOTO_ALT[0] || ""} fetchPriority="high" decoding="async" />
          {/* telefon: animacja nakłada się płynnie na miniaturę */}
          {!desktop ? (
            <div className="rd-hero-stage-anim" aria-hidden={!animOpen}>
              <RoofHeroScene active={animOpen} />
            </div>
          ) : null}
          {isDocked ? (
            <span className="plisy-hero-stage-hint" aria-hidden="true">
              🔍
            </span>
          ) : null}
        </div>

        <div className="plisy-hero-tiles" aria-hidden={!isDocked}>
          {desktop ? (
            <div
              className="plisy-hero-tile plisy-hero-tile--right rd-hero-anim-tile"
              role="button"
              tabIndex={isDocked ? 0 : -1}
              aria-label={animOpen ? "Zmniejsz animację" : "Powiększ animację: jak działa roleta dachowa"}
              aria-expanded={animOpen}
              onClick={() => setAnimOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setAnimOpen((open) => !open);
                }
              }}
            >
              <RoofHeroScene active={isDocked} />
              {animOpen ? (
                <span className="rd-hero-anim-close" aria-hidden="true">
                  ✕
                </span>
              ) : (
                animLabel
              )}
            </div>
          ) : null}
          {photos[1] ? photoTile(1, "plisy-hero-tile--bottom-wide") : null}
          {photos[2] ? photoTile(2, "plisy-hero-tile--bottom-square") : null}
        </div>
      </div>

      <div className="plisy-hero-strip rd-hero-strip" aria-label="Animacja i wizualizacje">
        {!desktop ? (
          <button
            type="button"
            className={`plisy-hero-tile plisy-hero-tile--strip rd-hero-anim-tile ${animOpen ? "is-on" : ""}`}
            aria-pressed={animOpen}
            aria-label={animOpen ? "Wróć do zdjęcia produktu" : "Pokaż animację: jak działa roleta dachowa"}
            onClick={() => setAnimOpen((open) => !open)}
          >
            {animOpen ? (
              <img src={tileSrc(photos[0])} alt="" loading="lazy" decoding="async" />
            ) : (
              <RoofHeroScene active={false} />
            )}
            {animOpen ? (
              <span className="rd-hero-anim-label" aria-hidden="true">
                Zdjęcie
              </span>
            ) : (
              animLabel
            )}
          </button>
        ) : null}
        {photos.slice(1).map((_, k) => photoTile(k + 1, "plisy-hero-tile--strip"))}
      </div>

      {lightbox !== null && typeof document !== "undefined"
        ? createPortal(
            <div className="instruction-modal plisy-hero-lightbox" role="dialog" aria-modal="true" aria-label="Zdjęcie produktu" onClick={() => setLightbox(null)}>
              <div className="plisy-hero-lightbox-shell" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="instruction-modal-close" aria-label="Zamknij" onClick={() => setLightbox(null)}>
                  ×
                </button>
                <button type="button" className="plisy-fg-arrow plisy-fg-arrow--prev" aria-label="Poprzednie zdjęcie" onClick={() => setLightbox((lightbox - 1 + photos.length) % photos.length)}>
                  ‹
                </button>
                <img src={photos[lightbox]} alt={RD_HERO_PHOTO_ALT[lightbox] || ""} />
                <button type="button" className="plisy-fg-arrow plisy-fg-arrow--next" aria-label="Następne zdjęcie" onClick={() => setLightbox((lightbox + 1) % photos.length)}>
                  ›
                </button>
                <p className="plisy-hero-lightbox-caption">
                  {lightbox === 0 ? "Zdjęcie produktu" : "Wizualizacja"} · {lightbox + 1} / {photos.length}
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
