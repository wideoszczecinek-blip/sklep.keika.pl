"use client";

// Full-screen fabric carousel for the plisy configurator's fabric step.
// Owner (2026-09-16): "przy wyborze swatchy konkretnych tkanin daj lupkę
// albo ogólne CTA do oglądania dużych zdjęć (galeria typu karuzela, ale
// każde zdjęcie z opcją 'wybierz')". So: one big photo at a time, the
// collection's other swatches as a strip underneath, arrows / swipe /
// keyboard to move, and a "Wybierz tę tkaninę" button that picks the
// swatch in the configurator and closes.
//
// Portaled to <body> for the same reason as the measuring modal: the
// configurator panel gets a transform on mobile and would trap a fixed
// overlay inside itself.
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { optimizeImageUrl } from "@/lib/image-optim";
import type { FabricSwatch } from "./shared";

export default function PlisyFabricGallery({
  swatches,
  index,
  collectionLabel,
  selectedId,
  onIndexChange,
  onPick,
  onClose,
}: {
  swatches: FabricSwatch[];
  index: number;
  collectionLabel: string;
  selectedId: string;
  onIndexChange: (index: number) => void;
  onPick: (swatch: FabricSwatch) => void;
  onClose: () => void;
}) {
  const total = swatches.length;
  const current = swatches[Math.min(Math.max(0, index), Math.max(0, total - 1))];
  const stripRef = useRef<HTMLDivElement | null>(null);
  const touchStartX = useRef<number | null>(null);
  const [loaded, setLoaded] = useState(false);

  const go = (delta: number) => {
    if (!total) return;
    onIndexChange((index + delta + total) % total);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") go(1);
      if (event.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [index, total]);

  // Keep the active thumbnail in view as the visitor moves.
  useEffect(() => {
    const strip = stripRef.current;
    const active = strip?.querySelector<HTMLElement>(".plisy-fg-thumb.is-active");
    active?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [index]);

  if (!current || typeof document === "undefined") return null;

  const label = current.label || current.code;
  const code = current.code && current.label !== current.code ? current.code : "";
  const isSelected = current.id === selectedId;

  return createPortal(
    <div className="instruction-modal plisy-fg" role="dialog" aria-modal="true" aria-label={`Tkaniny ${collectionLabel}`} onClick={onClose}>
      <div className="plisy-fg-shell" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="instruction-modal-close plisy-fg-close" aria-label="Zamknij galerię" onClick={onClose}>
          ×
        </button>

        <div className="plisy-fg-head">
          <span className="plisy-fg-collection">{collectionLabel}</span>
          <span className="plisy-fg-counter">
            {index + 1} / {total}
          </span>
        </div>

        <div
          className="plisy-fg-stage"
          onTouchStart={(event) => {
            touchStartX.current = event.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(event) => {
            const start = touchStartX.current;
            touchStartX.current = null;
            if (start === null) return;
            const dx = (event.changedTouches[0]?.clientX ?? start) - start;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
          }}
        >
          <button type="button" className="plisy-fg-arrow plisy-fg-arrow--prev" aria-label="Poprzednia tkanina" onClick={() => go(-1)}>
            ‹
          </button>
          <img
            key={current.id}
            className={`plisy-fg-img ${loaded ? "is-loaded" : ""}`}
            src={optimizeImageUrl(current.imageUrl || current.thumbnailUrl, 1200, 80)}
            alt={`Tkanina ${label}${code ? ` (${code})` : ""}`}
            onLoad={() => setLoaded(true)}
          />
          <button type="button" className="plisy-fg-arrow plisy-fg-arrow--next" aria-label="Następna tkanina" onClick={() => go(1)}>
            ›
          </button>
        </div>

        <div className="plisy-fg-caption">
          <strong>{label}</strong>
          {code ? <span>{code}</span> : null}
        </div>

        <div className="plisy-fg-actions">
          <button type="button" className={`plisy-fg-pick ${isSelected ? "is-selected" : ""}`} onClick={() => onPick(current)}>
            {isSelected ? "✓ Wybrana — zamknij" : "Wybierz tę tkaninę"}
          </button>
        </div>

        <div className="plisy-fg-strip" ref={stripRef} role="list" aria-label="Wszystkie tkaniny w kolekcji">
          {swatches.map((swatch, i) => (
            <button
              key={swatch.id}
              type="button"
              role="listitem"
              className={`plisy-fg-thumb ${i === index ? "is-active" : ""} ${swatch.id === selectedId ? "is-selected" : ""}`}
              title={swatch.label || swatch.code}
              aria-label={`Pokaż ${swatch.label || swatch.code}`}
              onClick={() => onIndexChange(i)}
            >
              <img src={optimizeImageUrl(swatch.thumbnailUrl || swatch.imageUrl, 160)} alt="" loading="lazy" />
            </button>
          ))}
        </div>
      </div>
    </div>,
    document.body,
  );
}
