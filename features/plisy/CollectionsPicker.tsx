"use client";

// "Którą kolekcję tkanin wybrać?" - one card per fabric collection, priced
// for a size the visitor can change.
//
// Fourth design of this block in two days; the owner's notes on the third
// (2026-09-15 night): the size sliders were "za duże i zbyt krzyczące", the
// accordions "brzydkie" on phones, and "ceny powinny być po prawej np obok
// nazwy, poniżej właściwości i przycisk pokaż więcej - musi być spójne i
// zachęcające". So:
//
//   - the size lives in ONE quiet line: "Ceny dla plisy 40 × 60 cm · Zmień
//     wymiar". Opening it reveals two compact sliders with number inputs.
//     Closed by default - most visitors just want to compare collections.
//   - each collection is a card, not a bar: name + badges on the left,
//     regular (struck) and promo price on the right, one line of what it
//     is underneath, then "Pokaż więcej" for where it fits, the spec sheet,
//     every swatch in the collection, and the configurator CTA.
//
// Prices come off the live CRM matrix (calcPlisyPrice, the configurator's
// own function) and SEZON20 through applyPromoToPrice - nothing hardcoded.
import { useMemo, useState } from "react";
import { applyPromoToPrice, PROMO_CODE, type PromoPreview } from "@/lib/promo";
import { optimizeImageUrl } from "@/lib/image-optim";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { usePlisyFavourites } from "@/lib/plisy-favourites";
import { PLISY_COLLECTIONS, PLISY_DEFAULT_HEIGHT_MM, PLISY_DEFAULT_WIDTH_MM, PLISY_LEAD_TIME_LABEL } from "./landing-content";
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


function clampInt(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
      <path d="M10.5 1.5a6.5 6.5 0 1 0 4 11.7A5.5 5.5 0 0 1 10.5 1.5z" fill="currentColor" />
    </svg>
  );
}

function DecoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
      <path d="M8 1.5l1.6 4.2 4.4.3-3.4 2.8 1.1 4.3L8 10.7l-3.7 2.4 1.1-4.3L2 6l4.4-.3z" fill="currentColor" />
    </svg>
  );
}

function ThermoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
      <path d="M6.5 2.5a1.5 1.5 0 0 1 3 0v6.3a3 3 0 1 1-3 0z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="11.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

function SizeField({
  label,
  value,
  min,
  max,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (v: number) => void;
}) {
  return (
    <label className="pl-coll-size-field">
      <span>{label}</span>
      <input type="range" min={min} max={max} step={1} value={value} onChange={(e) => onChange(Number(e.target.value))} aria-label={`${label} w centymetrach`} />
      <span className="pl-coll-size-num">
        <input
          type="number"
          inputMode="numeric"
          min={min}
          max={max}
          value={value}
          onChange={(e) => onChange(clampInt(Number(e.target.value), min, max))}
          aria-label={`${label}, wpisz w centymetrach`}
        />
        cm
      </span>
    </label>
  );
}

export default function PlisyCollectionsPicker({
  profile,
  promo,
  onQuote,
  onZoom,
  widthCm: widthCmProp,
  heightCm: heightCmProp,
  onSizeChange,
  priceMultiplier = 1,
  adjustmentSlug = "plisy",
  title,
  lead,
  sizeLabelPrefix,
  mountSuffix,
  ctaLabel,
}: {
  profile: PlisyProfile | null;
  promo: PromoPreview | null;
  onQuote: () => void;
  /** Opens the page's lightbox on a swatch. */
  onZoom?: (title: string, urls: string[], index: number) => void;
  /** Two-way sync with the "Ile za Twoje okno?" sliders further up
   * (owner, 2026-09-17): when the page owns the size, the window set up
   * there prices every collection here, and dragging these sliders moves
   * those. Without the props this block keeps its own local size. */
  widthCm?: number;
  heightCm?: number;
  onSizeChange?: (widthCm: number, heightCm: number) => void;
  /** Plisy dachowe (2026-09-19) reuse this block: the same five collections
   * priced x1,25, with this product's own CRM Korekta and its own copy. */
  priceMultiplier?: number;
  adjustmentSlug?: string;
  title?: string;
  lead?: string;
  sizeLabelPrefix?: string;
  /** "" hides the ", montaż przykręcany" suffix (no mount step on roof plisy). */
  mountSuffix?: string;
  ctaLabel?: (collectionName: string) => string;
}) {
  // Production limits (20-150 x 20-230 cm) - the same bounds the quick
  // price up top and the configurator use.
  const minW = (profile ? profile.widthMinMm : PLISY_WIDTH_MIN_MM) / 10;
  const minH = (profile ? profile.heightMinMm : PLISY_HEIGHT_MIN_MM) / 10;
  const maxW = (profile ? profile.widthMaxMm : PLISY_WIDTH_MAX_MM) / 10;
  const maxH = (profile ? profile.heightMaxMm : PLISY_HEIGHT_MAX_MM) / 10;

  // Starts on the ad's 60 x 120 cm window (2026-09-17), not the 40 x 60
  // minimum - see PLISY_DEFAULT_*_MM. The sliders still go down to the
  // smallest sash.
  const [internalWidthCm, setInternalWidthCm] = useState(PLISY_DEFAULT_WIDTH_MM / 10);
  const [internalHeightCm, setInternalHeightCm] = useState(PLISY_DEFAULT_HEIGHT_MM / 10);
  const widthCm = widthCmProp ?? internalWidthCm;
  const heightCm = heightCmProp ?? internalHeightCm;
  const setWidthCm = (value: number) => {
    setInternalWidthCm(value);
    onSizeChange?.(value, heightCm);
  };
  const setHeightCm = (value: number) => {
    setInternalHeightCm(value);
    onSizeChange?.(widthCm, value);
  };

  // The same per-product percent correction from the CRM the configurator
  // itself applies (ConfiguratorPanel.tsx, useProductPriceAdjustment) -
  // without it this block quoted the raw matrix (77 zł) while the
  // configurator, a screen later, said 69,30 zł for the same size. One
  // number for one window, everywhere on the page.
  const { isFavourite, toggle: toggleFavourite } = usePlisyFavourites();
  const priceAdjustmentPercent = useProductPriceAdjustment(adjustmentSlug);

  const rows = useMemo(
    () =>
      PLISY_COLLECTIONS.map((row) => {
        const group = profile?.fabricGroups.find((entry) => entry.id === row.groupId);
        const regularBase =
          profile && group
            ? calcPlisyPrice(
                { ...profile, priceAdjustmentPercent: profile.priceAdjustmentPercent + priceAdjustmentPercent },
                widthCm * 10,
                heightCm * 10,
                profile.hardware[0]?.id || "",
                row.groupId,
              )
            : null;
        const regular = regularBase !== null ? Math.round(regularBase * priceMultiplier * 100) / 100 : null;
        const withPromo = regular !== null ? applyPromoToPrice(regular, promo) : null;
        const swatches = (group?.swatches || []).filter((s) => s.thumbnailUrl || s.imageUrl);
        return { ...row, regular, withPromo, swatches };
      }),
    [profile, promo, widthCm, heightCm, priceAdjustmentPercent, priceMultiplier],
  );

  const sizeLabel = `${widthCm} × ${heightCm} cm`;

  return (
    <div className="pl-coll">
      <h3 className="pl-coll-title">{title || "Którą kolekcję tkanin wybrać?"}</h3>
      <p className="pl-coll-lead">
        {lead ||
          "Pięć kolekcji, od lekkich po zaciemniające. Ceny poglądowe — dokładną cenę z montażem, kolorem profilu i kilkoma sztukami policzy konfigurator."}
      </p>

      <details className="pl-mini-acc pl-coll-sizeacc">
        <summary>
          <span>
            {sizeLabelPrefix || "Ceny dla plisy"} <strong>{sizeLabel}</strong>
            {mountSuffix ?? ", montaż przykręcany"}
            {promo ? (
              <>
                {" "}
                · z kodem <strong>{PROMO_CODE}</strong>
              </>
            ) : null}
          </span>
          <span className="pl-mini-acc-action">Zmień wymiar</span>
        </summary>
        <div className="pl-coll-size">
          <SizeField label="Szerokość" value={widthCm} min={minW} max={maxW} onChange={setWidthCm} />
          <SizeField label="Wysokość" value={heightCm} min={minH} max={maxH} onChange={setHeightCm} />
          <p className="pl-coll-size-note">
            Zakres {minW}–{maxW} × {minH}–{maxH} cm. Wymiar poglądowy — w konfiguratorze wpiszesz dokładny.
          </p>
        </div>
      </details>

      <div className="pl-coll-list">
        {rows.map((row) => (
          <article key={row.groupId} className="pl-coll-card">
            <div className="pl-coll-card-head">
              <div className="pl-coll-card-title">
                <strong>{row.name}</strong>
                <span className="pl-coll-card-meta">
                  {row.blackout ? (
                    <span className="pl-coll-badge pl-coll-badge--dark" title="Tkanina zaciemniająca">
                      <MoonIcon /> Zaciemnia
                    </span>
                  ) : null}
                  {row.thermal ? (
                    <span className="pl-coll-badge pl-coll-badge--thermo" title="Ogranicza nagrzewanie / straty ciepła">
                      <ThermoIcon /> Termo
                    </span>
                  ) : null}
                  {row.decorative ? (
                    <span className="pl-coll-badge pl-coll-badge--deco" title="Tkanina dekoracyjna - rozprasza światło, nie zaciemnia, bez powłoki termicznej">
                      <DecoIcon /> Dekoracyjna
                    </span>
                  ) : null}
                  {row.swatches.length ? <span className="pl-coll-count">{row.swatches.length} kolorów</span> : null}
                </span>
              </div>

              <div className="pl-coll-card-price" aria-label={`Cena dla ${sizeLabel}`}>
                {row.regular === null ? (
                  <span className="pl-coll-card-na">wyceń w konfiguratorze</span>
                ) : row.withPromo !== null ? (
                  <>
                    <span className="pl-coll-card-amounts">
                      <s>{zl(row.regular)}</s>
                      <strong>{zl(row.withPromo)}</strong>
                    </span>
                    <small>z kodem {PROMO_CODE}</small>
                  </>
                ) : (
                  <span className="pl-coll-card-amounts">
                    <strong>{zl(row.regular)}</strong>
                  </span>
                )}
              </div>
            </div>

            <p className="pl-coll-card-what">{row.what}</p>

            <details className="pl-mini-acc pl-coll-more">
              <summary>
                <span className="pl-coll-more-open">Pokaż więcej</span>
                <span className="pl-coll-more-close">Zwiń</span>
              </summary>
              <div className="pl-coll-body">
                <p className="pl-coll-where">
                  <strong>Gdzie pasuje:</strong> {row.where}
                </p>

                <dl className="pl-coll-spec">
                  <div>
                    <dt>Światło</dt>
                    <dd>{row.lightNote}</dd>
                  </div>
                  <div>
                    <dt>Termika</dt>
                    <dd>{row.thermalNote}</dd>
                  </div>
                  <div>
                    <dt>Kolory</dt>
                    <dd>{row.swatches.length ? `${row.swatches.length} w kolekcji` : "—"}</dd>
                  </div>
                  <div>
                    <dt>Realizacja</dt>
                    <dd>{PLISY_LEAD_TIME_LABEL} + kurier 24 h</dd>
                  </div>
                </dl>

                {row.swatches.length ? (
                  <div className="pl-coll-swatches" role="list" aria-label={`Kolory kolekcji ${row.name}`}>
                    {row.swatches.map((swatch, index) => {
                      const label = swatch.label ? `${swatch.label}${swatch.code ? ` (${swatch.code})` : ""}` : swatch.code;
                      const fav = isFavourite(swatch.id);
                      return (
                        <div key={swatch.id} role="listitem" className="pl-coll-swatch-cell">
                          <button
                            type="button"
                            className="pl-coll-swatch"
                            title={label}
                            aria-label={`Powiększ ${label}`}
                            onClick={() =>
                              onZoom?.(
                                `${row.name} — ${label}`,
                                row.swatches.map((s) => s.imageUrl || s.thumbnailUrl),
                                index,
                              )
                            }
                          >
                            <img src={optimizeImageUrl(swatch.thumbnailUrl || swatch.imageUrl, 160)} alt="" loading="lazy" />
                            <span>{swatch.code || swatch.label}</span>
                          </button>
                          {/* Serduszko zapamiętuje tkaninę w przeglądarce -
                              w konfiguratorze wraca jako skrót "Twoje ulubione"
                              (lib/plisy-favourites.ts). */}
                          <button
                            type="button"
                            className={`pl-coll-swatch-fav ${fav ? "is-on" : ""}`}
                            aria-pressed={fav}
                            aria-label={fav ? `Usuń ${label} z ulubionych` : `Dodaj ${label} do ulubionych`}
                            title={fav ? "W ulubionych" : "Dodaj do ulubionych"}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFavourite(swatch.id);
                            }}
                          >
                            ♥
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : null}

                <button type="button" className="pl-inline-cta-button pl-coll-cta" onClick={onQuote}>
                  {ctaLabel ? ctaLabel(row.name) : `Wyceń plisę ${row.name} w konfiguratorze`}
                </button>
              </div>
            </details>
          </article>
        ))}
      </div>
    </div>
  );
}
