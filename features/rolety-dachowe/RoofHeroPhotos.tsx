"use client";

// Top-of-landing hero for rolety dachowe: the rendered presentation
// (RoofHeroScene) plus the owner's product/arrangement visuals - the same
// intro -> dock -> mosaic behaviour as features/plisy/PlisyHeroPhotos.tsx
// (full-size presentation for a few seconds, then it docks top-left and
// three visuals slide into the remaining L-shape; phones keep the
// presentation full with a strip of the same visuals under it). Reuses the
// .plisy-hero-* layout rules - nothing in them is plisy-specific.
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { RD_HERO_PHOTOS, RD_HERO_PHOTO_ALT } from "./gallery";
import RoofHeroScene from "./RoofHeroScene";

const INTRO_MS = 7000;
const REOPEN_MS = 9000;

const tileSrc = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=700&q=75`;

export default function RoofHeroPhotos() {
  const photos = RD_HERO_PHOTOS;
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

  useEffect(() => {
    if (!desktop) return;
    const id = window.setTimeout(() => setDocked(true), reduced ? 0 : INTRO_MS);
    return () => window.clearTimeout(id);
  }, [desktop, reduced]);

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
    <button key={photos[i]} type="button" className={`plisy-hero-tile ${extraClass}`} onClick={() => setLightbox(i)} aria-label={`Powiększ: ${RD_HERO_PHOTO_ALT[i] || "zdjęcie produktu"}`}>
      <img src={tileSrc(photos[i])} alt={RD_HERO_PHOTO_ALT[i] || ""} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
      <span className="plisy-hero-tile-zoom" aria-hidden="true">
        🔍
      </span>
    </button>
  );

  return (
    <>
      <div className={`plisy-hero-photos rd-hero-photos ${isDocked ? "is-docked" : ""} ${reduced ? "is-instant" : ""}`} role="region" aria-label="Rolety dachowe KEIKA - prezentacja i wizualizacje">
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
          <RoofHeroScene active />
          {isDocked ? (
            <span className="plisy-hero-stage-hint" aria-hidden="true">
              ⤢
            </span>
          ) : null}
        </div>

        <div className="plisy-hero-tiles" aria-hidden={!isDocked}>
          {photos[0] ? tile(0, "plisy-hero-tile--right") : null}
          {photos[1] ? tile(1, "plisy-hero-tile--bottom-wide") : null}
          {photos[2] ? tile(2, "plisy-hero-tile--bottom-square") : null}
          <span className="plisy-hero-tiles-badge">🪟 Produkt i wizualizacje</span>
        </div>
      </div>

      <div className="plisy-hero-strip" aria-label="Produkt i wizualizacje">
        {photos.map((_, i) => tile(i, "plisy-hero-tile--strip"))}
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
                  {lightbox === 0 ? "Render produktu" : "Wizualizacja"} · {lightbox + 1} / {photos.length}
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
