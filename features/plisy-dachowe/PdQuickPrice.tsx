"use client";

// "Ile za Twoje okno?" for plisy dachowe - the roof-blind quick price
// (features/rolety-dachowe/RoofQuickPrice.tsx) with the fabric COLLECTION
// as the second axis instead of DEKO/TERMO: one search box over the window
// library (Velux MK04, Fakro 78x118…), five collection chips, and the price
// of the cheapest configuration for that window (white finish, no fabric
// dopłata). "Konfiguruj to okno" hands window + collection into the
// configurator. Below the box: the size path for a window that is not in
// the library ("nie znam modelu").
import { useEffect, useMemo, useRef, useState } from "react";
import { applyPromoToPrice, PROMO_CODE, type PromoPreview } from "@/lib/promo";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { trackShopStep } from "@/lib/track-step";
import type { PlisyProfile } from "@/features/plisy/shared";
import { buildRoofWindowDisplayLabel, resolveRoofWindowDimensions, searchRoofWindowLibrary, type RoofWindowLibraryItem } from "@/features/rolety-dachowe/roof-window-library";
import { PD_MIN_DIMENSION_MM, PD_PRODUCT_SLUG, pdCheapestPriceForSize, pdSizeLimits } from "./shared";

function zl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

/** Short chip labels for the five CRM collections. */
export function pdCollectionShortLabel(group: { id: string; label: string }): string {
  if (/duo-blackout|duo.*termo/i.test(group.id) || /termo/i.test(group.label)) return "DUO TERMO";
  if (/^duo/i.test(group.id) || /plaster/i.test(group.label)) return "DUO";
  if (/blackout|podgum/i.test(group.id + group.label)) return "Blackout";
  if (/reflex/i.test(group.id + group.label)) return "Reflex";
  if (/clas|klas/i.test(group.id + group.label)) return "Klasyczne";
  return group.label;
}

export type PdQuickSelection = { item: RoofWindowLibraryItem | null; widthMm: number; heightMm: number; fabricGroupId: string };

export default function PdQuickPrice({
  profile,
  library,
  promo,
  fabricGroupId,
  onFabricGroupChange,
  onSelectionChange,
  onConfigure,
}: {
  profile: PlisyProfile | null;
  library: RoofWindowLibraryItem[];
  promo: PromoPreview | null;
  fabricGroupId: string;
  onFabricGroupChange: (fabricGroupId: string) => void;
  onSelectionChange?: (selection: PdQuickSelection) => void;
  onConfigure: (selection: PdQuickSelection) => void;
}) {
  const priceAdjustmentPercent = useProductPriceAdjustment(PD_PRODUCT_SLUG);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<RoofWindowLibraryItem | null>(null);
  const [manual, setManual] = useState(false);
  const limits = pdSizeLimits(profile);
  const [widthMm, setWidthMm] = useState(780);
  const [heightMm, setHeightMm] = useState(1180);

  const results = useMemo(() => (query.trim() && !picked ? searchRoofWindowLibrary(library, query).slice(0, 6) : []), [library, query, picked]);
  const groups = profile?.fabricGroups || [];
  const activeGroup = groups.find((group) => group.id === fabricGroupId) || groups[0] || null;

  const dims = manual ? { widthMm, heightMm } : picked ? resolveRoofWindowDimensions(picked) : { widthMm: 0, heightMm: 0 };
  const inRange = dims.widthMm >= PD_MIN_DIMENSION_MM && dims.widthMm <= limits.maxWidthMm && dims.heightMm >= PD_MIN_DIMENSION_MM && dims.heightMm <= limits.maxHeightMm;
  const regular = useMemo(() => {
    if (!profile || !activeGroup || !inRange) return null;
    return pdCheapestPriceForSize(profile, dims.widthMm, dims.heightMm, priceAdjustmentPercent, activeGroup.id);
  }, [profile, activeGroup, inRange, dims.widthMm, dims.heightMm, priceAdjustmentPercent]);
  const withPromo = regular !== null ? applyPromoToPrice(regular, promo) : null;

  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (!dims.widthMm) return;
    const timer = window.setTimeout(() => {
      trackShopStep("quick_price_size", PD_PRODUCT_SLUG, {
        width_mm: dims.widthMm,
        height_mm: dims.heightMm,
        window: picked ? buildRoofWindowDisplayLabel(picked) : "manual",
        collection: activeGroup?.id || "",
        price: regular ?? 0,
      });
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dims.widthMm, dims.heightMm, picked, activeGroup?.id]);

  const hasAnswer = manual || Boolean(picked);
  useEffect(() => {
    if (!onSelectionChange) return;
    onSelectionChange({ item: manual ? null : picked, widthMm: hasAnswer ? dims.widthMm : 0, heightMm: hasAnswer ? dims.heightMm : 0, fabricGroupId: activeGroup?.id || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [manual, picked, dims.widthMm, dims.heightMm, hasAnswer]);

  return (
    <div className="pl-quick rd-quick pd-quick" role="group" aria-label="Szybka wycena plisy dachowej dla Twojego okna">
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
                        trackShopStep("quick_price_window", buildRoofWindowDisplayLabel(item), { library_id: item.id, product: PD_PRODUCT_SLUG });
                      }}
                    >
                      <strong>{buildRoofWindowDisplayLabel(item)}</strong>
                      {itemDims.widthMm ? (
                        <span>
                          plisa {itemDims.widthMm} × {itemDims.heightMm} mm
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
              Szerokość <b>{dims.widthMm} mm</b>
            </span>
            <input type="range" min={400} max={limits.maxWidthMm} step={10} value={widthMm} onChange={(event) => setWidthMm(Number(event.target.value))} aria-label="Szerokość okna w milimetrach" />
          </label>
          <label className="pl-quick-slider">
            <span>
              Wysokość <b>{dims.heightMm} mm</b>
            </span>
            <input type="range" min={400} max={limits.maxHeightMm} step={10} value={heightMm} onChange={(event) => setHeightMm(Number(event.target.value))} aria-label="Wysokość okna w milimetrach" />
          </label>
          <button type="button" className="rd-link rd-quick-manual" onClick={() => setManual(false)}>
            ← Wolę wybrać model okna
          </button>
        </div>
      )}

      {groups.length > 1 ? (
        <div className="rd-quick-materials pd-quick-collections" role="radiogroup" aria-label="Kolekcja tkaniny">
          {groups.map((group) => (
            <button key={group.id} type="button" role="radio" aria-checked={activeGroup?.id === group.id} className={`rd-unit ${activeGroup?.id === group.id ? "is-active" : ""}`} onClick={() => onFabricGroupChange(group.id)}>
              {pdCollectionShortLabel(group)}
            </button>
          ))}
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
            {activeGroup ? `kolekcja ${activeGroup.label}, osprzęt biały` : "osprzęt biały"} · kolor tkaniny i osprzętu wybierzesz w konfiguratorze
          </span>
        </div>
        <button
          type="button"
          className="pl-quick-cta"
          disabled={!hasAnswer || !inRange}
          onClick={() => {
            trackShopStep("quick_price_configure", PD_PRODUCT_SLUG, {
              window: picked && !manual ? buildRoofWindowDisplayLabel(picked) : "manual",
              width_mm: dims.widthMm,
              height_mm: dims.heightMm,
              price: regular ?? 0,
            });
            onConfigure({ item: manual ? null : picked, widthMm: dims.widthMm, heightMm: dims.heightMm, fabricGroupId: activeGroup?.id || "" });
          }}
        >
          Konfiguruj to okno →
        </button>
      </div>
    </div>
  );
}
