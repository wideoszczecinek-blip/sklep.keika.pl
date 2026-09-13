"use client";

// Slim, always-visible countdown strip for the SEZON20 promo - replaces the
// first-visit "Rabat -20% aktywny!" modal (audit 2026-09-13: entry modals
// cost 10-20% engagement in most tests, and in 12 days of live data not a
// single visitor used the modal's SMS/e-mail save - 0 of 2 843 promo
// activations). The promo itself, its automatic first-visit activation and
// the 24h deadline are unchanged (see lib/promo.ts, promo-countdown-banner.tsx)
// - this just moves the reminder out of the customer's way and keeps it in
// view while they scroll. Renders nothing when there's no running deadline.
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
        promo ? (
          <div className={`promo-top-strip ${variant === "static" ? "is-static" : ""}`} role="status">
            <span className="promo-top-strip-badge" aria-hidden="true">
              -20%
            </span>
            <span className="promo-top-strip-text">
              <span className="promo-top-strip-long">
                Kod <strong>{PROMO_CODE}</strong> naliczony w koszyku
                <span className="promo-top-strip-sep"> · </span>
              </span>
              ważny jeszcze <strong>{promo.remainingText}</strong>
            </span>
            <button type="button" className="promo-top-strip-cta" onClick={promo.openModal}>
              Zapisz link
            </button>
          </div>
        ) : null
      }
    </PromoCountdownBanner>
  );
}
