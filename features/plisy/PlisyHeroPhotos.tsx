"use client";

// Top-of-landing hero for plisy: a slideshow of the owner's real installation
// photos. Took over the top slot from the drawn/interactive hero on
// 2026-09-15 - owner: "na samej górze nadal będzie musiało być zdjęcie lub
// pokaz zdjęć lub film prezentujący produkt". The interactive visualizer
// moved down the page (PlisyVisualizer.tsx).
//
// The three photos are a mix of portrait and landscape. Rather than crop
// them to one box (the plisa is the tallest thing in the portrait shots and
// would be the first to go), each is shown whole over a blurred, darkened
// copy of itself - no bars, nothing cut.
import { useEffect, useState, useSyncExternalStore } from "react";
import { PLISY_REAL_PHOTOS } from "./gallery";

const INTERVAL_MS = 4200;

export default function PlisyHeroPhotos() {
  const photos = PLISY_REAL_PHOTOS;
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

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
    if (paused || reduced || photos.length < 2) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % photos.length), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, reduced, photos.length]);

  return (
    <div
      className="plisy-hero-photos"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      role="region"
      aria-roledescription="pokaz zdjęć"
      aria-label="Plisy KEIKA w domach klientów"
    >
      {photos.map((src, i) => (
        <div key={src} className={`plisy-hero-slide ${i === index ? "is-active" : ""}`} aria-hidden={i !== index}>
          <img className="plisy-hero-slide-bg" src={src} alt="" aria-hidden="true" loading={i === 0 ? "eager" : "lazy"} />
          <img
            className="plisy-hero-slide-img"
            src={src}
            alt={`Plisa okienna KEIKA w antracytowej tkaninie, zdjęcie z montażu ${i + 1} z ${photos.length}`}
            loading={i === 0 ? "eager" : "lazy"}
            fetchPriority={i === 0 ? "high" : undefined}
          />
        </div>
      ))}

      {photos.length > 1 ? (
        <div className="plisy-hero-dots" role="tablist" aria-label="Wybierz zdjęcie">
          {photos.map((src, i) => (
            <button
              key={src}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Zdjęcie ${i + 1}`}
              className={`plisy-hero-dot ${i === index ? "is-active" : ""}`}
              onClick={() => {
                setIndex(i);
                setPaused(true);
              }}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
