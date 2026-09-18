"use client";

// "Ile za Twoje okno?" for rolety dachowe - the analog of
// features/plisy/QuickPrice.tsx, but a roof blind is priced by the WINDOW
// MODEL, not a typed size: one search box over the same library the
// configurator uses (Velux MK04, Fakro 78x118…), a DEKO / TERMO toggle,
// and the price of the cheapest configuration for that window (white
// cassette). "Konfiguruj to okno" hands the chosen window into the
// configurator so it is never searched twice. Below the box: the size path
// for a window that is not in the library ("nie znam modelu"), priced from
// two sliders like plisy.
import { useEffect, useMemo, useRef, useState } from "react";
import { applyPromoToPrice, PROMO_CODE, type PromoPreview } from "@/lib/promo";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { trackShopStep } from "@/lib/track-step";
import {
  buildRoofWindowDisplayLabel,
  resolveRoofWindowDimensions,
  searchRoofWindowLibrary,
  type RoofWindowLibraryItem,
} from "./roof-window-library";
import { calcRoletyDachowePrice, roofBlindSizeLimits, ROLETY_DACHOWE_MIN_DIMENSION_MM, type RoofBlindProfile } from "./shared";

function zl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

export type RoofQuickSelection = { item: RoofWindowLibraryItem | null; widthMm: number; heightMm: number; materialTypeId: string };

export default function RoofQuickPrice({
  profile,
  library,
  promo,
  materialTypeId,
  onMaterialChange,
  onSelectionChange,
  onConfigure,
}: {
  profile: RoofBlindProfile | null;
  library: RoofWindowLibraryItem[];
  promo: PromoPreview | null;
  materialTypeId: string;
  onMaterialChange: (materialTypeId: string) => void;
  /** Fires whenever the priced window/size changes (the fabrics guide below
   * prices both collections for the same window). */
  onSelectionChange?: (selection: RoofQuickSelection) => void;
  onConfigure: (selection: RoofQuickSelection) => void;
}) {
  const adjustBySlug = useProductPriceAdjustment("rolety-dachowe");
  const adjustByCrmSlug = useProductPriceAdjustment("roleta-dachowa-dekolux");
  const priceAdjustmentPercent = adjustBySlug || adjustByCrmSlug;
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<RoofWindowLibraryItem | null>(null);
  const [manual, setManual] = useState(false);
  const limits = roofBlindSizeLimits(profile);
  const [widthMm, setWidthMm] = useState(780);
  const [heightMm, setHeightMm] = useState(1180);

  const results = useMemo(() => (query.trim() && !picked ? searchRoofWindowLibrary(library, query).slice(0, 6) : []), [library, query, picked]);
  const materials = profile?.materialTypes || [];
  const activeMaterial = materials.find((option) => option.id === materialTypeId) || materials[0] || null;
  const hardwareId = profile?.hardware[0]?.id || "bialy";

  const dims = manual ? { widthMm, heightMm } : picked ? resolveRoofWindowDimensions(picked) : { widthMm: 0, heightMm: 0 };
  const inRange =
    dims.widthMm >= ROLETY_DACHOWE_MIN_DIMENSION_MM && dims.widthMm <= limits.maxWidthMm && dims.heightMm >= ROLETY_DACHOWE_MIN_DIMENSION_MM && dims.heightMm <= limits.maxHeightMm;
  const regular = useMemo(() => {
    if (!profile || !activeMaterial || !inRange) return null;
    return calcRoletyDachowePrice(profile.tables, dims.widthMm, dims.heightMm, hardwareId, activeMaterial.id, priceAdjustmentPercent);
  }, [profile, activeMaterial, inRange, dims.widthMm, dims.heightMm, hardwareId, priceAdjustmentPercent]);
  const withPromo = regular !== null ? applyPromoToPrice(regular, promo) : null;

  // One analytics event per settled size/window (sliders fire on every pixel).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!dims.widthMm) return;
    const timer = window.setTimeout(() => {
      trackShopStep("quick_price_size", "rolety-dachowe", {
        width_mm: dims.widthMm,
        height_mm: dims.heightMm,
        window: picked ? buildRoofWindowDisplayLabel(picked) : "manual",
        material: activeMaterial?.id || "",
        price: regular ?? 0,
      });
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims.widthMm, dims.heightMm, picked, activeMaterial?.id]);

  const hasAnswer = manual || Boolean(picked);
  useEffect(() => {
    if (!onSelectionChange) return;
    onSelectionChange({ item: manual ? null : picked, widthMm: hasAnswer ? dims.widthMm : 0, heightMm: hasAnswer ? dims.heightMm : 0, materialTypeId: activeMaterial?.id || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, picked, dims.widthMm, dims.heightMm, hasAnswer]);

  return (
    <div className="pl-quick rd-quick" role="group" aria-label="Szybka wycena rolety dachowej dla Twojego okna">
      <div className="pl-quick-head">
        <span className="pl-quick-title">Ile za Twoje okno?</span>
        {hasAnswer && dims.widthMm ? (
          <span className="pl-quick-size">
            {picked && !manual ? buildRoofWindowDisplayLabel(picked) : "wymiar własny"} · {dims.widthMm} × {dims.heightMm} mm
          </span>
        ) : null}
      </div>

      {!manual ? (
        <div className="rd-quick-search">
          <label className="rd-search-field">
            <span className="sr-only">Model okna dachowego</span>
            <input
              type="text"
              inputMode="search"
              autoComplete="off"
              className="rd-search-input"
              placeholder={library.length ? "Wpisz model okna, np. Velux MK04, Fakro 78x118" : "Ładuję bibliotekę okien…"}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                if (picked) setPicked(null);
              }}
            />
            {query ? (
              <button
                type="button"
                className="rd-search-clear"
                aria-label="Wyczyść"
                onClick={() => {
                  setQuery("");
                  setPicked(null);
                }}
              >
                ×
              </button>
            ) : null}
          </label>
          {results.length ? (
            <ul className="rd-quick-results">
              {results.map(({ item }) => {
                const itemDims = resolveRoofWindowDimensions(item);
                return (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => {
                        setPicked(item);
                        setQuery(buildRoofWindowDisplayLabel(item));
                        trackShopStep("quick_price_window", buildRoofWindowDisplayLabel(item), { library_id: item.id });
                      }}
                    >
                      <strong>{buildRoofWindowDisplayLabel(item)}</strong>
                      {itemDims.widthMm ? (
                        <span>
                          roleta {itemDims.widthMm} × {itemDims.heightMm} mm
                        </span>
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : query.trim() && !picked && library.length ? (
            <p className="rd-quick-empty">Nie znaleźliśmy takiego modelu — sprawdź pisownię albo podaj wymiar okna.</p>
          ) : null}
          <button type="button" className="rd-link rd-quick-manual" onClick={() => setManual(true)}>
            Nie znam modelu — podam wymiar okna
          </button>
        </div>
      ) : (
        <div className="rd-quick-manual-box">
          <label className="pl-quick-slider">
            <span>
              Szerokość (wymiar A) <b>{dims.widthMm} mm</b>
            </span>
            <input type="range" min={400} max={limits.maxWidthMm} step={10} value={widthMm} onChange={(event) => setWidthMm(Number(event.target.value))} aria-label="Szerokość okna w milimetrach" />
          </label>
          <label className="pl-quick-slider">
            <span>
              Wysokość (wymiar B) <b>{dims.heightMm} mm</b>
            </span>
            <input type="range" min={400} max={limits.maxHeightMm} step={10} value={heightMm} onChange={(event) => setHeightMm(Number(event.target.value))} aria-label="Wysokość okna w milimetrach" />
          </label>
          <button type="button" className="rd-link rd-quick-manual" onClick={() => setManual(false)}>
            ← Wolę wybrać model okna
          </button>
        </div>
      )}

      {materials.length > 1 ? (
        <div className="rd-quick-materials" role="radiogroup" aria-label="Rodzaj tkaniny">
          {materials.map((option) => {
            const isTermo = /termo/i.test(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role="radio"
                aria-checked={activeMaterial?.id === option.id}
                className={`rd-unit ${activeMaterial?.id === option.id ? "is-active" : ""}`}
                onClick={() => onMaterialChange(option.id)}
              >
                {isTermo ? "TERMO · zaciemnia" : "DEKO · rozprasza światło"}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="pl-quick-row">
        <div className="pl-quick-result" aria-live="polite">
          {!hasAnswer ? (
            <span className="pl-quick-na">Wybierz model okna, a pokażemy cenę</span>
          ) : regular === null ? (
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
            {activeMaterial ? `tkanina ${/termo/i.test(activeMaterial.id) ? "TERMO" : "DEKO"}, kaseta biała` : "kaseta biała"} · kolor tkaniny i osprzętu wybierzesz w konfiguratorze
          </span>
        </div>
        <button
          type="button"
          className="pl-quick-cta"
          disabled={!hasAnswer || !inRange}
          onClick={() => {
            trackShopStep("quick_price_configure", "rolety-dachowe", {
              window: picked && !manual ? buildRoofWindowDisplayLabel(picked) : "manual",
              width_mm: dims.widthMm,
              height_mm: dims.heightMm,
              price: regular ?? 0,
            });
            onConfigure({ item: manual ? null : picked, widthMm: dims.widthMm, heightMm: dims.heightMm, materialTypeId: activeMaterial?.id || "" });
          }}
        >
          Konfiguruj to okno →
        </button>
      </div>
    </div>
  );
}
