"use client";

// "Ile za Twoje okno?" - the price for a REAL window (plisy landing
// analysis 2026-09-17), sitting under the first paragraph of the
// description.
//
// 80% of visitors left without ever touching the configurator, which sits
// at the very bottom of an 11-screen page, and "od 69,30 zł" anchored on
// the smallest 40 x 60 sash. This block answers the one question cold Meta
// traffic arrives with - "ile za MOJE okno?" - with two sliders in
// centimetres (the unit the ad speaks, and the one people think in),
// showing the SEZON20 price the cart will actually charge.
//
// Owner's second pass, same day: sliders instead of typed fields, quieter
// than the first orange-card version, and the size is OWNED by the page
// (widthMm/heightMm + onSizeChange) so the fabric-collection comparison
// further down prices every collection for the same window - and moving
// its own sliders moves these. "Konfiguruj to okno" still hands the size
// into the configurator so it's never typed twice.
//
// Pricing is the configurator's own calcPlisyPrice on the live CRM matrix,
// including the per-product percent correction (useProductPriceAdjustment)
// - the cheapest sensible build: Klasyczne, first hardware colour, STANDARD
// mount. Nothing hardcoded, so the number here can't drift from the number
// the configurator shows a screen later.
import { useEffect, useMemo, useRef } from "react";
import { applyPromoToPrice, PROMO_CODE, type PromoPreview } from "@/lib/promo";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { trackShopStep } from "@/lib/track-step";
import { PLISY_COLLECTIONS } from "./landing-content";
import {
  calcPlisyPrice,
  PLISY_HEIGHT_MAX_MM,
  PLISY_HEIGHT_MIN_MM,
  PLISY_WIDTH_MAX_MM,
  PLISY_WIDTH_MIN_MM,
  type PlisyProfile,
} from "./shared";

function zl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function PlisyQuickPrice({
  profile,
  promo,
  widthMm,
  heightMm,
  onSizeChange,
  onConfigure,
}: {
  profile: PlisyProfile | null;
  /** The ACTIVE promo only - null while SEZON20 isn't switched on, so the
   * struck-through/discounted pair never promises a discount the cart
   * won't apply. */
  promo: PromoPreview | null;
  widthMm: number;
  heightMm: number;
  onSizeChange: (widthMm: number, heightMm: number) => void;
  onConfigure: (widthMm: number, heightMm: number) => void;
}) {
  const priceAdjustmentPercent = useProductPriceAdjustment("plisy");

  // Slider bounds = the production limits (20-150 x 20-230 cm), the same
  // ones the collection comparison and the configurator enforce.
  const minW = (profile ? profile.widthMinMm : PLISY_WIDTH_MIN_MM) / 10;
  const maxW = (profile ? profile.widthMaxMm : PLISY_WIDTH_MAX_MM) / 10;
  const minH = (profile ? profile.heightMinMm : PLISY_HEIGHT_MIN_MM) / 10;
  const maxH = (profile ? profile.heightMaxMm : PLISY_HEIGHT_MAX_MM) / 10;
  const widthCm = Math.round(widthMm / 10);
  const heightCm = Math.round(heightMm / 10);

  const inRange = profile
    ? widthMm >= profile.widthMinMm &&
      widthMm <= profile.widthMaxMm &&
      heightMm >= profile.heightMinMm &&
      heightMm <= profile.heightMaxMm
    : false;

  const regular = useMemo(() => {
    if (!profile || !inRange) return null;
    const groupId = PLISY_COLLECTIONS[0]?.groupId || profile.fabricGroups[0]?.id || "";
    return calcPlisyPrice(
      { ...profile, priceAdjustmentPercent: profile.priceAdjustmentPercent + priceAdjustmentPercent },
      widthMm,
      heightMm,
      profile.hardware[0]?.id || "",
      groupId,
    );
  }, [profile, inRange, widthMm, heightMm, priceAdjustmentPercent]);
  const withPromo = regular !== null ? applyPromoToPrice(regular, promo) : null;

  // One analytics event per settled size (sliders fire on every pixel).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      trackShopStep("quick_price_size", "plisy", { width_mm: widthMm, height_mm: heightMm, in_range: inRange, price: regular ?? 0 });
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthMm, heightMm]);

  return (
    <div className="pl-quick" role="group" aria-label="Szybka wycena plisy dla Twojego okna">
      <div className="pl-quick-head">
        <span className="pl-quick-title">Ile za Twoje okno?</span>
        <span className="pl-quick-size">
          {widthCm} × {heightCm} cm
        </span>
      </div>
      <label className="pl-quick-slider">
        <span>
          Szerokość <b>{widthCm} cm</b>
        </span>
        <input
          type="range"
          min={minW}
          max={maxW}
          step={1}
          value={clamp(widthCm, minW, maxW)}
          onChange={(event) => onSizeChange(Number(event.target.value) * 10, heightMm)}
          aria-label="Szerokość okna w centymetrach"
        />
      </label>
      <label className="pl-quick-slider">
        <span>
          Wysokość <b>{heightCm} cm</b>
        </span>
        <input
          type="range"
          min={minH}
          max={maxH}
          step={1}
          value={clamp(heightCm, minH, maxH)}
          onChange={(event) => onSizeChange(widthMm, Number(event.target.value) * 10)}
          aria-label="Wysokość okna w centymetrach"
        />
      </label>
      <div className="pl-quick-row">
        <div className="pl-quick-result" aria-live="polite">
          {regular === null ? (
            <span className="pl-quick-na">{profile ? "Ten wymiar wyceni konfigurator" : "Ładuję cennik…"}</span>
          ) : withPromo !== null ? (
            <span className="pl-quick-amounts">
              <s>{zl(regular)}</s>
              <strong>{zl(withPromo)}</strong>
              <small>z kodem {PROMO_CODE}</small>
            </span>
          ) : (
            <span className="pl-quick-amounts">
              <strong>{zl(regular)}</strong>
            </span>
          )}
          <span className="pl-quick-note">Klasyczne, biały profil, montaż STANDARD · inne kolekcje w porównaniu poniżej</span>
        </div>
        <button
          type="button"
          className="pl-quick-cta"
          disabled={!inRange}
          onClick={() => {
            trackShopStep("quick_price_configure", "plisy", { width_mm: widthMm, height_mm: heightMm, price: regular ?? 0 });
            onConfigure(widthMm, heightMm);
          }}
        >
          Konfiguruj to okno →
        </button>
      </div>
    </div>
  );
}
