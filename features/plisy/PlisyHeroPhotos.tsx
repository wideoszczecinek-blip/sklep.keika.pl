"use client";

// Top-of-landing hero for plisy: the rendered studio presentation
// (PlisyHeroScene) plus the owner's real installation photos.
//
// Owner (2026-09-16): "na desktopie po chwili tej animacji pomniejsz ją
// trochę i przesuń w lewy górny róg, a w prawym dolnym pokaż kilka zdjęć
// produktowych" - and the worry behind it: too much animation that isn't
// the physical product 1:1 can hurt conversion. So the presentation plays
// full-size for a few seconds, then docks into the top-left corner (still
// animating) and three real photos slide into the remaining L-shape.
// Clicking a photo opens it large; clicking the docked presentation brings
// it back to full size for a while.
//
// Phones have no room for a mosaic inside the hero box: the presentation
// stays full-size and the same three photos sit in a strip right under it,
// visible without scrolling. Reduced motion: docked from the start.
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { PLISY_REAL_PHOTOS } from "./gallery";
import PlisyHeroScene from "./PlisyHeroScene";

const INTRO_MS = 7000; // full-size presentation before docking
const REOPEN_MS = 9000; // how long a click keeps it full-size again

// Tiles are ~250 px wide; the originals are 1600 px. Local paths go through
// Next's optimizer as-is (no host allow-list needed); 700 is an allow-listed width.
const tileSrc = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=700&q=75`;

const PHOTO_ALT = [
  "Plisa okienna KEIKA w antracytowej tkaninie na oknie dwuskrzydłowym - zdjęcie z montażu u klienta",
  "Plisy KEIKA na drzwiach balkonowych, tkanina antracytowa - zdjęcie z montażu u klienta",
  "Plisa KEIKA na drzwiach balkonowych w pokoju młodzieżowym - zdjęcie z montażu u klienta",
];

export default function PlisyHeroPhotos() {
  const photos = PLISY_REAL_PHOTOS;
  const [docked, setDocked] = useState(false);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const reduced = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    () => false,
  );
  const desktop = useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia("(min-width: 761px)");
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia("(min-width: 761px)").matches,
    () => true,
  );

  // Intro, then dock (desktop only - phones keep the presentation full).
  // Runs once; a re-opened presentation is re-docked by the effect below.
  useEffect(() => {
    if (!desktop) return;
    const id = window.setTimeout(() => setDocked(true), reduced ? 0 : INTRO_MS);
    return () => window.clearTimeout(id);
  }, [desktop, reduced]);

  // A click on the docked presentation re-opens it; it docks again on its own.
  const [reopenedAt, setReopenedAt] = useState<number | null>(null);
  useEffect(() => {
    if (reopenedAt === null) return;
    const id = window.setTimeout(() => {
      setDocked(true);
      setReopenedAt(null);
    }, REOPEN_MS);
    return () => window.clearTimeout(id);
  }, [reopenedAt]);

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

  const tile = (i: number, extraClass: string) => (
    <button
      key={photos[i]}
      type="button"
      className={`plisy-hero-tile ${extraClass}`}
      onClick={() => setLightbox(i)}
      aria-label={`Powiększ: ${PHOTO_ALT[i] || "zdjęcie z montażu"}`}
    >
      <img src={tileSrc(photos[i])} alt={PHOTO_ALT[i] || ""} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
      <span className="plisy-hero-tile-zoom" aria-hidden="true">
        🔍
      </span>
    </button>
  );

  return (
    <>
      <div className={`plisy-hero-photos ${isDocked ? "is-docked" : ""} ${reduced ? "is-instant" : ""}`} role="region" aria-label="Plisy KEIKA - prezentacja i zdjęcia z montaży">
        <div
          className="plisy-hero-stage"
          onClick={() => {
            if (!isDocked) return;
            setDocked(false);
            setReopenedAt(Date.now());
          }}
          role={isDocked ? "button" : undefined}
          tabIndex={isDocked ? 0 : undefined}
          title={isDocked ? "Powiększ prezentację" : undefined}
          onKeyDown={(event) => {
            if (isDocked && (event.key === "Enter" || event.key === " ")) {
              event.preventDefault();
              setDocked(false);
              setReopenedAt(Date.now());
            }
          }}
        >
          <PlisyHeroScene active />
          {isDocked ? (
            <span className="plisy-hero-stage-hint" aria-hidden="true">
              ⤢
            </span>
          ) : null}
        </div>

        {/* desktop mosaic: portrait on the right, two under the presentation */}
        <div className="plisy-hero-tiles" aria-hidden={!isDocked}>
          {photos[1] ? tile(1, "plisy-hero-tile--right") : null}
          {photos[0] ? tile(0, "plisy-hero-tile--bottom-wide") : null}
          {photos[2] ? tile(2, "plisy-hero-tile--bottom-square") : null}
          <span className="plisy-hero-tiles-badge">📷 Zdjęcia z montaży u klientów</span>
        </div>
      </div>

      {/* phones: the same photos in a strip under the presentation */}
      <div className="plisy-hero-strip" aria-label="Zdjęcia z montaży u klientów">
        {photos.map((_, i) => tile(i, "plisy-hero-tile--strip"))}
      </div>

      {lightbox !== null && typeof document !== "undefined"
        ? createPortal(
            <div className="instruction-modal plisy-hero-lightbox" role="dialog" aria-modal="true" aria-label="Zdjęcie z montażu" onClick={() => setLightbox(null)}>
              <div className="plisy-hero-lightbox-shell" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="instruction-modal-close" aria-label="Zamknij" onClick={() => setLightbox(null)}>
                  ×
                </button>
                <button type="button" className="plisy-fg-arrow plisy-fg-arrow--prev" aria-label="Poprzednie zdjęcie" onClick={() => setLightbox((lightbox - 1 + photos.length) % photos.length)}>
                  ‹
                </button>
                <img src={photos[lightbox]} alt={PHOTO_ALT[lightbox] || ""} />
                <button type="button" className="plisy-fg-arrow plisy-fg-arrow--next" aria-label="Następne zdjęcie" onClick={() => setLightbox((lightbox + 1) % photos.length)}>
                  ›
                </button>
                <p className="plisy-hero-lightbox-caption">
                  Zdjęcie z montażu u klienta · {lightbox + 1} / {photos.length}
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
