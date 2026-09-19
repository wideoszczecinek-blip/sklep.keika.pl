"use client";

// Top-of-landing hero for plisy dachowe: the owner's attic photo (two roof
// windows with plisas) as the stage plus three product visuals - the same
// intro -> dock -> mosaic behaviour as features/rolety-dachowe/
// RoofHeroPhotos.tsx (full-size stage for a few seconds, then it docks
// top-left and the tiles slide into the remaining L-shape; phones keep the
// stage full with a strip of the tiles under it). Reuses the .plisy-hero-*
// layout rules. Photo-led on purpose: real product photos, no rendered
// animation to argue with.
import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { PD_HERO_PHOTO_ALT, PD_HERO_PHOTOS, PD_HERO_STAGE_PHOTO } from "./gallery";

const INTRO_MS = 6000;
const REOPEN_MS = 8000;

const tileSrc = (src: string, w = 700) => `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;

export default function PdHeroPhotos() {
  const photos = PD_HERO_PHOTOS;
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

  // Lightbox indexes: 0..n-1 = tiles, n = the stage photo.
  const all = [...photos, PD_HERO_STAGE_PHOTO];
  const alts = [...PD_HERO_PHOTO_ALT, "Dwa okna dachowe z plisami KEIKA na poddaszu"];
  useEffect(() => {
    if (lightbox === null) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setLightbox(null);
      if (event.key === "ArrowRight") setLightbox((i) => (i === null ? null : (i + 1) % all.length));
      if (event.key === "ArrowLeft") setLightbox((i) => (i === null ? null : (i - 1 + all.length) % all.length));
    };
    window.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [lightbox, all.length]);

  const isDocked = desktop && docked;

  const tile = (i: number, extraClass: string) => (
    <button key={photos[i]} type="button" className={`plisy-hero-tile ${extraClass}`} onClick={() => setLightbox(i)} aria-label={`Powiększ: ${PD_HERO_PHOTO_ALT[i] || "zdjęcie produktu"}`}>
      <img src={tileSrc(photos[i])} alt={PD_HERO_PHOTO_ALT[i] || ""} loading={i === 0 ? "eager" : "lazy"} decoding="async" />
      <span className="plisy-hero-tile-zoom" aria-hidden="true">
        🔍
      </span>
    </button>
  );

  return (
    <>
      <div className={`plisy-hero-photos rd-hero-photos pd-hero-photos ${isDocked ? "is-docked" : ""} ${reduced ? "is-instant" : ""}`} role="region" aria-label="Plisy dachowe KEIKA - zdjęcia produktu">
        <div
          className="plisy-hero-stage pd-hero-stage"
          onClick={() => {
            if (!isDocked) {
              setLightbox(photos.length);
              return;
            }
            setDocked(false);
            setReopenedAt(Date.now());
          }}
          role="button"
          tabIndex={0}
          title={isDocked ? "Powiększ zdjęcie" : "Powiększ"}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              if (!isDocked) {
                setLightbox(photos.length);
                return;
              }
              setDocked(false);
              setReopenedAt(Date.now());
            }
          }}
        >
          <img className="pd-hero-stage-img" src={tileSrc(PD_HERO_STAGE_PHOTO, 1200)} alt="Dwa okna dachowe z plisami KEIKA na poddaszu" loading="eager" decoding="async" />
          <span className="pd-hero-stage-caption">Plisy dachowe KEIKA · zdjęcie z realizacji</span>
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
          <span className="plisy-hero-tiles-badge">🪟 Zdjęcia produktu</span>
        </div>
      </div>

      <div className="plisy-hero-strip" aria-label="Zdjęcia produktu">
        {photos.map((_, i) => tile(i, "plisy-hero-tile--strip"))}
      </div>

      {lightbox !== null && typeof document !== "undefined"
        ? createPortal(
            <div className="instruction-modal plisy-hero-lightbox" role="dialog" aria-modal="true" aria-label="Zdjęcie produktu" onClick={() => setLightbox(null)}>
              <div className="plisy-hero-lightbox-shell" onClick={(event) => event.stopPropagation()}>
                <button type="button" className="instruction-modal-close" aria-label="Zamknij" onClick={() => setLightbox(null)}>
                  ×
                </button>
                <button type="button" className="plisy-fg-arrow plisy-fg-arrow--prev" aria-label="Poprzednie zdjęcie" onClick={() => setLightbox((lightbox - 1 + all.length) % all.length)}>
                  ‹
                </button>
                <img src={all[lightbox]} alt={alts[lightbox] || ""} />
                <button type="button" className="plisy-fg-arrow plisy-fg-arrow--next" aria-label="Następne zdjęcie" onClick={() => setLightbox((lightbox + 1) % all.length)}>
                  ›
                </button>
                <p className="plisy-hero-lightbox-caption">
                  {alts[lightbox]} · {lightbox + 1} / {all.length}
                </p>
              </div>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
