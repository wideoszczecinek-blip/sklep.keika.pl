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
import { useEffect, useMemo, useRef, useState } from "react";
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
  collapsible = false,
  defaultOpen = false,
}: {
  /** Akordeon: nagłówek "Szybka wycena" z rozmiarem i ceną, suwaki pod
   * spodem. Na landingu plis blok siedzi wysoko, zaraz pod plakietkami,
   * więc domyślnie jest zwinięty - cena i tak jest widoczna w nagłówku. */
  collapsible?: boolean;
  defaultOpen?: boolean;
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

  // Pola liczbowe obok suwaków (właściciel, 2026-09-24): kto zna wymiar,
  // wpisuje go od razu zamiast celować suwakiem. Tekst trzymany lokalnie,
  // żeby dało się skasować pole i wpisać liczbę od nowa; do strony idzie
  // dopiero wartość mieszcząca się w zakresie produkcji.
  const [widthText, setWidthText] = useState(String(widthCm));
  const [heightText, setHeightText] = useState(String(heightCm));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidthText(String(widthCm));
  }, [widthCm]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeightText(String(heightCm));
  }, [heightCm]);
  function typeSize(raw: string, axis: "w" | "h") {
    if (axis === "w") setWidthText(raw);
    else setHeightText(raw);
    const value = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    const min = axis === "w" ? minW : minH;
    const max = axis === "w" ? maxW : maxH;
    if (value < min || value > max) return;
    const mm = Math.round(value) * 10;
    if (axis === "w") onSizeChange(mm, heightMm);
    else onSizeChange(widthMm, mm);
  }
  function commitSize(axis: "w" | "h") {
    const raw = axis === "w" ? widthText : heightText;
    const value = Number(String(raw).replace(",", "."));
    const min = axis === "w" ? minW : minH;
    const max = axis === "w" ? maxW : maxH;
    if (!Number.isFinite(value) || value <= 0) {
      if (axis === "w") setWidthText(String(widthCm));
      else setHeightText(String(heightCm));
      return;
    }
    const next = Math.round(clamp(value, min, max));
    if (axis === "w") {
      setWidthText(String(next));
      onSizeChange(next * 10, heightMm);
    } else {
      setHeightText(String(next));
      onSizeChange(widthMm, next * 10);
    }
  }

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

  const [open, setOpen] = useState(!collapsible || defaultOpen);
  const headPrice =
    regular === null ? null : withPromo !== null && withPromo < regular ? withPromo : regular;

  return (
    <div className={`pl-quick ${collapsible ? "pl-quick--acc" : ""} ${open ? "is-open" : ""}`} role="group" aria-label="Szybka wycena plisy dla Twojego okna">
      {collapsible ? (
        <button
          type="button"
          className="pl-quick-acc-head"
          aria-expanded={open ? "true" : "false"}
          onClick={() => {
            setOpen((prev) => !prev);
            trackShopStep("quick_price_toggle", "plisy", { open: !open });
          }}
        >
          <span className="pl-quick-acc-title">
            <span aria-hidden="true">🧮</span> Szybka wycena
          </span>
          <span className="pl-quick-acc-meta">
            <span className="pl-quick-acc-size">
              {widthCm} × {heightCm} cm
            </span>
            {headPrice !== null ? <strong>{zl(headPrice)}</strong> : null}
            <span className="pl-quick-acc-chevron" aria-hidden="true">
              {open ? "▴" : "▾"}
            </span>
          </span>
        </button>
      ) : (
        <div className="pl-quick-head">
          <span className="pl-quick-title">Ile za Twoje okno?</span>
          <span className="pl-quick-size">
            {widthCm} × {heightCm} cm
          </span>
        </div>
      )}
      <div className="pl-quick-body" hidden={collapsible && !open}>
      <div className="pl-quick-slider">
        <span className="pl-quick-slider-label">Szerokość</span>
        <div className="pl-quick-slider-row">
          <input
            type="range"
            min={minW}
            max={maxW}
            step={1}
            value={clamp(widthCm, minW, maxW)}
            onChange={(event) => onSizeChange(Number(event.target.value) * 10, heightMm)}
            aria-label="Szerokość okna w centymetrach"
          />
          <span className="pl-quick-num">
            <input
              type="number"
              inputMode="numeric"
              min={minW}
              max={maxW}
              step={1}
              value={widthText}
              onChange={(event) => typeSize(event.target.value, "w")}
              onBlur={() => commitSize("w")}
              aria-label="Szerokość okna w centymetrach - wpisz"
            />
            <em>cm</em>
          </span>
        </div>
      </div>
      <div className="pl-quick-slider">
        <span className="pl-quick-slider-label">Wysokość</span>
        <div className="pl-quick-slider-row">
          <input
            type="range"
            min={minH}
            max={maxH}
            step={1}
            value={clamp(heightCm, minH, maxH)}
            onChange={(event) => onSizeChange(widthMm, Number(event.target.value) * 10)}
            aria-label="Wysokość okna w centymetrach"
          />
          <span className="pl-quick-num">
            <input
              type="number"
              inputMode="numeric"
              min={minH}
              max={maxH}
              step={1}
              value={heightText}
              onChange={(event) => typeSize(event.target.value, "h")}
              onBlur={() => commitSize("h")}
              aria-label="Wysokość okna w centymetrach - wpisz"
            />
            <em>cm</em>
          </span>
        </div>
      </div>
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
          <span className="pl-quick-note">
            Kolekcja Klasyczne, biały profil, montaż przykręcany do listwy · inne kolekcje w porównaniu poniżej
          </span>
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
          Przejdź do konfiguratora →
        </button>
        </div>
      </div>
    </div>
  );
}
