"use client";

// Top-of-page price for a REAL window (plisy landing analysis 2026-09-17).
//
// 80% of visitors left without ever touching the configurator, which sits
// at the very bottom of an 11-screen page, and "od 69,30 zł" anchored on
// the smallest 40 x 60 sash. This block answers the one question cold Meta
// traffic arrives with - "ile za MOJE okno?" - in two fields, in centimetres
// (the unit the ad speaks, and the one people think in), showing the
// SEZON20 price the cart will actually charge. "Konfiguruj to okno" hands
// the size straight into the configurator (home-client's plisyPrefillDims),
// so the customer never re-types it in millimetres.
//
// Pricing is the configurator's own calcPlisyPrice on the live CRM matrix,
// including the per-product percent correction (useProductPriceAdjustment)
// - the cheapest sensible build: Klasyczne, first hardware colour, STANDARD
// mount. Nothing hardcoded, so the number here can't drift from the number
// the configurator shows a screen later.
import { useMemo, useState } from "react";
import { applyPromoToPrice, PROMO_CODE, type PromoPreview } from "@/lib/promo";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { trackShopStep } from "@/lib/track-step";
import { PLISY_COLLECTIONS, PLISY_DEFAULT_HEIGHT_MM, PLISY_DEFAULT_WIDTH_MM } from "./landing-content";
import { calcPlisyPrice, type PlisyProfile } from "./shared";

function zl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł`;
}

function toMm(raw: string): number {
  const n = Number(String(raw).replace(",", "."));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 10) : 0;
}

export default function PlisyQuickPrice({
  profile,
  promo,
  onConfigure,
}: {
  profile: PlisyProfile | null;
  /** The ACTIVE promo only - null while SEZON20 isn't switched on, so the
   * struck-through/discounted pair never promises a discount the cart
   * won't apply. */
  promo: PromoPreview | null;
  onConfigure: (widthMm: number, heightMm: number) => void;
}) {
  const priceAdjustmentPercent = useProductPriceAdjustment("plisy");
  const [widthCm, setWidthCm] = useState(String(PLISY_DEFAULT_WIDTH_MM / 10));
  const [heightCm, setHeightCm] = useState(String(PLISY_DEFAULT_HEIGHT_MM / 10));

  const widthMm = toMm(widthCm);
  const heightMm = toMm(heightCm);
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

  const rangeLabel = profile
    ? `${profile.widthMinMm / 10}–${profile.widthMaxMm / 10} × ${profile.heightMinMm / 10}–${profile.heightMaxMm / 10} cm`
    : "";

  function trackSize() {
    trackShopStep("quick_price_size", "plisy", { width_mm: widthMm, height_mm: heightMm, in_range: inRange, price: regular ?? 0 });
  }

  return (
    <div className="pl-quick" role="group" aria-label="Szybka wycena plisy dla Twojego okna">
      <p className="pl-quick-title">Ile za Twoje okno?</p>
      <div className="pl-quick-fields">
        <label className="pl-quick-field">
          <span className="pl-quick-field-label">Szerokość</span>
          <span className="pl-quick-field-input">
            <input
              type="number"
              inputMode="decimal"
              step={0.5}
              min={profile ? profile.widthMinMm / 10 : 40}
              max={profile ? profile.widthMaxMm / 10 : 210}
              value={widthCm}
              onChange={(event) => setWidthCm(event.target.value)}
              onBlur={trackSize}
              aria-label="Szerokość okna w centymetrach"
            />
            <span>cm</span>
          </span>
        </label>
        <span className="pl-quick-times" aria-hidden="true">
          ×
        </span>
        <label className="pl-quick-field">
          <span className="pl-quick-field-label">Wysokość</span>
          <span className="pl-quick-field-input">
            <input
              type="number"
              inputMode="decimal"
              step={0.5}
              min={profile ? profile.heightMinMm / 10 : 60}
              max={profile ? profile.heightMaxMm / 10 : 230}
              value={heightCm}
              onChange={(event) => setHeightCm(event.target.value)}
              onBlur={trackSize}
              aria-label="Wysokość okna w centymetrach"
            />
            <span>cm</span>
          </span>
        </label>
      </div>
      <div className="pl-quick-result" aria-live="polite">
        {regular === null ? (
          <span className="pl-quick-na">{profile ? `Podaj wymiar w zakresie ${rangeLabel}` : "Ładuję cennik…"}</span>
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
        <span className="pl-quick-note">Klasyczne, biały profil, montaż STANDARD — inne tkaniny i kolory policzy konfigurator.</span>
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
  );
}
