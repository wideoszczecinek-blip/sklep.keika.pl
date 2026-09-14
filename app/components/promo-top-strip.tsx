"use client";

// The top strip: a one-line carousel that rotates the shop's strongest
// selling points, with the live SEZON20 countdown interleaved between them
// so it is on screen half the time.
//
// History: this replaced the first-visit "Rabat -20% aktywny!" modal (audit
// 2026-09-13 - entry modals cost 10-20% engagement in most tests, and in 12
// days of live data not one visitor used that modal's SMS/e-mail save, 0 of
// 2 843 activations). Then it was a static single line, which at 320-360 px
// ellipsised mid-countdown, so it briefly became two stacked lines. Owner
// call 2026-09-14: make it a carousel instead - one short sentence at a
// time, so every message gets the full width and the bar goes back to one
// 34 px line (10 px of vertical space handed back to the product on mobile).
//
// The promo itself, its automatic first-visit activation and the 24 h
// deadline are unchanged (lib/promo.ts, promo-countdown-banner.tsx).
//
// Notes for whoever edits the copy below:
//  - every sentence must fit ONE line at 320 px with a 1.25x system font,
//    so keep them under ~40 characters (the .promo-strip-wide variant may
//    be longer - it only ever renders at >= 761 px);
//  - every claim has to be true and match the rest of the page: the 79 zł
//    free-shipping threshold is FREE_SHIPPING_THRESHOLD in koszyk/page.tsx,
//    the Ekspres cutoff comes from lib/express.ts, and the Ekspres slide
//    only appears while that feature is switched on;
//  - no live region here on purpose: the countdown re-renders every 30 s and
//    the carousel every 4,5 s, so a screen reader would never stop talking.
//    Inactive slides are aria-hidden, the visible one is plain readable text.
import { useEffect, useRef, useState, type ReactNode } from "react";
import PromoCountdownBanner from "./promo-countdown-banner";
import { PROMO_CODE } from "@/lib/promo";
import { EXPRESS_CUTOFF, EXPRESS_ENABLED, formatCutoff } from "@/lib/express";

/** How long each message stays. Long enough to read a short sentence twice
 * without feeling stuck (measured against the 5-6 slide rotation below). */
const ROTATE_MS = 4500;
/** Must match the transition duration in globals.css (.promo-strip-slide). */
const TRANSITION_MS = 520;

type Slide = { key: string; icon: string; content: ReactNode };

const BENEFIT_SLIDES: Slide[] = [
  { key: "dostawa", icon: "🚚", content: <>Darmowa dostawa od 79 zł</> },
  ...(EXPRESS_ENABLED
    ? [
        {
          key: "ekspres",
          icon: "⚡",
          content: (
            <>
              Ekspres: zamów do {formatCutoff(EXPRESS_CUTOFF.hour, EXPRESS_CUTOFF.minute)}, wyślemy dziś
            </>
          ),
        },
      ]
    : []),
  { key: "gwarancja", icon: "🛡️", content: <>5 lat gwarancji</> },
  { key: "producent", icon: "🏭", content: <>Producent ze Szczecinka</> },
  { key: "montaz", icon: "🔧", content: <>Montaż bez wiercenia w oknie</> },
];

/** [promo, benefit, promo, benefit, ...] - the countdown gets every other
 * slot instead of one slot in six, so a customer who looks up at any moment
 * has a ~50% chance of seeing how long the discount still runs. */
function buildSlides(promoSlide: Slide | null): Slide[] {
  if (!promoSlide) return BENEFIT_SLIDES;
  return BENEFIT_SLIDES.flatMap((benefit, index) => [
    { ...promoSlide, key: `${promoSlide.key}-${index}` },
    benefit,
  ]);
}

function StripCarousel({ slides, variant }: { slides: Slide[]; variant: "fixed" | "static" }) {
  const [index, setIndex] = useState(0);
  const [leavingIndex, setLeavingIndex] = useState<number | null>(null);
  const [paused, setPaused] = useState(false);
  const previousIndexRef = useRef(0);

  useEffect(() => {
    if (slides.length < 2 || paused) return;
    const timer = window.setInterval(() => {
      setIndex((current) => (current + 1) % slides.length);
    }, ROTATE_MS);
    return () => window.clearInterval(timer);
  }, [slides.length, paused]);

  // The slide being replaced keeps rendering for one transition so it can
  // animate upward out of the viewport - without it the new message would
  // just pop in over an empty bar.
  useEffect(() => {
    const previous = previousIndexRef.current;
    if (previous === index) return;
    previousIndexRef.current = index;
    setLeavingIndex(previous);
    const timer = window.setTimeout(() => setLeavingIndex(null), TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [index]);

  // A slide count that shrinks (the promo expiring mid-visit) must not leave
  // the index pointing past the end.
  const activeIndex = slides.length > 0 ? index % slides.length : 0;

  return (
    <div
      className={`promo-top-strip ${variant === "static" ? "is-static" : ""}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="promo-strip-viewport">
        {slides.map((slide, slideIndex) => {
          const isActive = slideIndex === activeIndex;
          const isLeaving = slideIndex === leavingIndex && !isActive;
          return (
            <span
              key={slide.key}
              className={`promo-strip-slide ${isActive ? "is-active" : ""} ${isLeaving ? "is-leaving" : ""}`}
              aria-hidden={isActive ? undefined : "true"}
            >
              <span className="promo-strip-slide-icon" aria-hidden="true">
                {slide.icon}
              </span>
              <span className="promo-strip-slide-text">{slide.content}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

export default function PromoTopStrip({
  productSlug = "moskitiery-ramkowe",
  variant = "fixed",
}: {
  productSlug?: string;
  variant?: "fixed" | "static";
}) {
  return (
    <PromoCountdownBanner code={PROMO_CODE} productSlug={productSlug}>
      {(promo) => {
        // The bar renders even with no running countdown (a returning
        // visitor past the 24 h window) - it just rotates the benefits.
        // Keeping the row present at all times is what stops the header and
        // hero from jumping once the promo state resolves (CLS 0,23 -> 0,05,
        // measured 2026-09-14); globals.css offsets them by --promo-strip-h.
        const promoSlide: Slide | null = promo
          ? {
              key: "promo",
              icon: "🔥",
              content: (
                <>
                  <span className="promo-top-strip-badge">-20%</span>
                  <span className="promo-strip-wide">
                    Kod <strong>{PROMO_CODE}</strong> naliczony w koszyku · ważny jeszcze{" "}
                  </span>
                  <span className="promo-strip-narrow">
                    <strong>{PROMO_CODE}</strong> · jeszcze{" "}
                  </span>
                  <strong className="promo-top-strip-clock">{promo.remainingText}</strong>
                </>
              ),
            }
          : null;
        if (!promoSlide && variant === "static") return null;
        return <StripCarousel slides={buildSlides(promoSlide)} variant={variant} />;
      }}
    </PromoCountdownBanner>
  );
}
