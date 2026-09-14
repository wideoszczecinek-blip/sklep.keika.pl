"use client";

// Slim, always-visible countdown strip for the SEZON20 promo - replaces the
// first-visit "Rabat -20% aktywny!" modal (audit 2026-09-13: entry modals
// cost 10-20% engagement in most tests, and in 12 days of live data not a
// single visitor used the modal's SMS/e-mail save - 0 of 2 843 promo
// activations). The promo itself, its automatic first-visit activation and
// the 24h deadline are unchanged (see lib/promo.ts, promo-countdown-banner.tsx)
// - this just moves the reminder out of the customer's way and keeps it in
// view while they scroll. Renders a neutral trust line when there's no
// running deadline, so the row (and the header/hero offsets that depend on
// its height) never appears or disappears mid-load.
//
// Layout: ONE line on desktop, TWO stacked lines on a phone. Owner report
// 2026-09-14: at 320-360 px the single line was ellipsised mid-countdown and
// the code name was hidden entirely (the old .promo-top-strip-long was
// display:none there), so the strip read as a bare "-20% ważny jeszcze ..."
// with no idea which code and no visible counter. Both wordings live in the
// markup and CSS picks the fitting one - .promo-top-strip-wide (>=761 px) /
// .promo-top-strip-narrow (<=760 px), see globals.css. Every phone line is
// short enough to survive 320 px at a 1.25x system font scale.
//
// No role="status": the countdown re-renders every 30 s and a live region
// would have a screen reader announce the whole strip over and over. It is
// plain, always-present page furniture, readable on demand.
//
// variant="fixed" (default): pinned to the very top of the viewport, above
// the fixed .hero-header, which .home-root:has(> .promo-top-strip) shifts
// down by --promo-strip-h (globals.css). variant="static": in normal flow,
// for pages with their own simple header (/koszyk).
import PromoCountdownBanner from "./promo-countdown-banner";
import { PROMO_CODE } from "@/lib/promo";

export default function PromoTopStrip({
  productSlug = "moskitiery-ramkowe",
  variant = "fixed",
}: {
  productSlug?: string;
  variant?: "fixed" | "static";
}) {
  return (
    <PromoCountdownBanner code={PROMO_CODE} productSlug={productSlug}>
      {(promo) =>
        !promo && variant === "fixed" ? (
          // Same height, always there on the fixed variant - the header/hero
          // offsets in globals.css depend on it, so mounting it late shifted
          // the whole page (CLS 0.23 measured 2026-09-14). Neutral, true
          // copy until a countdown exists (returning visitor after 24 h).
          <div className="promo-top-strip is-neutral">
            <span className="promo-top-strip-text">
              <span className="promo-top-strip-line">Producent osłon okiennych ze Szczecinka</span>
              <span className="promo-top-strip-line">
                <span className="promo-top-strip-wide">· </span>5 lat gwarancji · darmowa dostawa od 79 zł
              </span>
            </span>
          </div>
        ) : promo ? (
          <div className={`promo-top-strip ${variant === "static" ? "is-static" : ""}`}>
            <span className="promo-top-strip-badge" aria-hidden="true">
              -20%
            </span>
            <span className="promo-top-strip-text">
              <span className="promo-top-strip-line">
                Kod <strong>{PROMO_CODE}</strong>
                <span className="promo-top-strip-wide"> naliczony w koszyku ·</span>
              </span>
              <span className="promo-top-strip-line">
                <span className="promo-top-strip-wide">ważny </span>jeszcze{" "}
                <strong className="promo-top-strip-clock">{promo.remainingText}</strong>
              </span>
            </span>
            <button type="button" className="promo-top-strip-cta" onClick={promo.openModal}>
              <span className="promo-top-strip-wide">Zapisz link</span>
              <span className="promo-top-strip-narrow">Zapisz</span>
            </button>
          </div>
        ) : null
      }
    </PromoCountdownBanner>
  );
}
