"use client";

// Top-of-landing hero for plisy. Slide 0 is the rendered studio
// presentation (PlisyHeroScene: photoreal empty window plate + pleated
// fabric drawn with real concertina physics, gentle 3D turn, colour
// changes). The owner's three real installation photos follow as further
// slides.
//
// The presentation is the product's main image, so the slideshow rests on
// it: it only auto-advances while the visitor is looking at the photos, and
// comes back to the presentation after the last one. Photos are a mix of
// portrait and landscape; each is shown whole over a blurred, darkened copy
// of itself.
import { useEffect, useState, useSyncExternalStore } from "react";
import { PLISY_REAL_PHOTOS } from "./gallery";
import PlisyHeroScene from "./PlisyHeroScene";

const INTERVAL_MS = 4200;

export default function PlisyHeroPhotos() {
  const photos = PLISY_REAL_PHOTOS;
  // 0 = presentation, 1..n = photos
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const slideCount = photos.length + 1;

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
    if (paused || reduced || index === 0) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % slideCount), INTERVAL_MS);
    return () => window.clearInterval(id);
  }, [paused, reduced, index, slideCount]);

  return (
    <div
      className="plisy-hero-photos"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onTouchStart={() => setPaused(true)}
      onTouchEnd={() => setPaused(false)}
      role="region"
      aria-roledescription="pokaz"
      aria-label="Plisy KEIKA - prezentacja i zdjęcia z montaży"
    >
      <div className={`plisy-hero-slide plisy-hero-slide--scene ${index === 0 ? "is-active" : ""}`} aria-hidden={index !== 0}>
        <PlisyHeroScene active={index === 0} />
      </div>

      {photos.map((src, i) => {
        const slide = i + 1;
        return (
          <div key={src} className={`plisy-hero-slide ${slide === index ? "is-active" : ""}`} aria-hidden={slide !== index}>
            <img className="plisy-hero-slide-bg" src={src} alt="" aria-hidden="true" loading="lazy" />
            <img
              className="plisy-hero-slide-img"
              src={src}
              alt={`Plisa okienna KEIKA w antracytowej tkaninie, zdjęcie z montażu ${i + 1} z ${photos.length}`}
              loading="lazy"
            />
          </div>
        );
      })}

      <div className="plisy-hero-dots" role="tablist" aria-label="Wybierz slajd">
        {Array.from({ length: slideCount }, (_, i) => (
          <button
            key={i}
            type="button"
            role="tab"
            aria-selected={i === index}
            aria-label={i === 0 ? "Animacja produktu" : `Zdjęcie z montażu ${i}`}
            className={`plisy-hero-dot ${i === 0 ? "plisy-hero-dot--scene" : ""} ${i === index ? "is-active" : ""}`}
            onClick={() => {
              setIndex(i);
              setPaused(true);
            }}
          >
            {i === 0 ? "▶" : null}
          </button>
        ))}
      </div>
    </div>
  );
}
