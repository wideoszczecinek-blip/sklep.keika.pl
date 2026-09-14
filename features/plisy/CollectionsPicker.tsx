"use client";

// "Którą kolekcję tkanin wybrać?" - replaces the 4-column table that shipped
// 2026-09-14. The owner's call (2026-09-15): "zaprojektuj tabelę inaczej -
// szczególnie na mobile - musi być responsywna. Może akordeony albo jakieś
// bloki ze zmienną treścią".
//
// Chips + one detail panel, not an accordion: an accordion hides the prices
// until you open each row, and price comparison is the whole reason this
// block exists. Every chip carries its collection's promo price, so the
// five prices sit side by side on any screen; the panel below shows the one
// collection you tapped, with both prices and a CTA. On phones the chip row
// scrolls sideways instead of wrapping into a wall of buttons.
//
// Both prices are real: the regular one comes off the live CRM price matrix
// (calcPlisyPrice, same as the configurator), the promo one applies the
// SEZON20 discount as discount_code_check.php currently defines it - so a
// change to the code's value in the CRM shows here without a deploy.
import { useState } from "react";
import { applyPromoToPrice, PROMO_CODE, type PromoPreview } from "@/lib/promo";
import {
  PLISY_COLLECTIONS,
  PLISY_EXAMPLE_HEIGHT_MM,
  PLISY_EXAMPLE_WIDTH_MM,
} from "./landing-content";
import { calcPlisyPrice, type PlisyProfile } from "./shared";

function zl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł`;
}

export default function PlisyCollectionsPicker({
  profile,
  promo,
  onQuote,
}: {
  profile: PlisyProfile | null;
  promo: PromoPreview | null;
  onQuote: () => void;
}) {
  const [activeId, setActiveId] = useState(PLISY_COLLECTIONS[0].groupId);

  const rows = PLISY_COLLECTIONS.map((row) => {
    const group = profile?.fabricGroups.find((entry) => entry.id === row.groupId);
    const regular =
      profile && group
        ? calcPlisyPrice(profile, PLISY_EXAMPLE_WIDTH_MM, PLISY_EXAMPLE_HEIGHT_MM, profile.hardware[0]?.id || "", row.groupId)
        : null;
    const withPromo = regular !== null ? applyPromoToPrice(regular, promo) : null;
    return { ...row, colors: group?.swatches.length || 0, regular, withPromo };
  });

  const active = rows.find((row) => row.groupId === activeId) || rows[0];
  const sizeLabel = `${PLISY_EXAMPLE_WIDTH_MM / 10} × ${PLISY_EXAMPLE_HEIGHT_MM / 10} cm`;

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const index = rows.findIndex((row) => row.groupId === activeId);
    const next = e.key === "ArrowRight" ? (index + 1) % rows.length : (index - 1 + rows.length) % rows.length;
    setActiveId(rows[next].groupId);
  };

  return (
    <div className="pl-collections">
      <h3 className="pl-collections-title">Którą kolekcję tkanin wybrać?</h3>
      <p className="pl-collections-lead">
        Ceny dla plisy {sizeLabel} z montażem STANDARD. Dokładną cenę Twojego okna policzy konfigurator.
      </p>

      <div className="pl-coll-chips" role="tablist" aria-label="Kolekcje tkanin" onKeyDown={onKeyDown}>
        {rows.map((row) => {
          const isActive = row.groupId === active.groupId;
          const chipPrice = row.withPromo ?? row.regular;
          return (
            <button
              key={row.groupId}
              type="button"
              role="tab"
              id={`pl-coll-tab-${row.groupId}`}
              aria-selected={isActive}
              aria-controls="pl-coll-panel"
              tabIndex={isActive ? 0 : -1}
              className={`pl-coll-chip ${isActive ? "is-active" : ""}`}
              onClick={() => setActiveId(row.groupId)}
            >
              <span className="pl-coll-chip-name">{row.name}</span>
              {chipPrice !== null ? (
                <span className="pl-coll-chip-price">
                  {zl(chipPrice)}
                  {row.withPromo !== null ? <small> z kodem</small> : null}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="pl-coll-panel" role="tabpanel" id="pl-coll-panel" aria-labelledby={`pl-coll-tab-${active.groupId}`}>
        <div className="pl-coll-panel-head">
          <strong>{active.name}</strong>
          {active.colors ? <span className="pl-collections-count">{active.colors} kolorów</span> : null}
        </div>

        <dl className="pl-coll-facts">
          <div>
            <dt>Co daje</dt>
            <dd>{active.what}</dd>
          </div>
          <div>
            <dt>Gdzie pasuje</dt>
            <dd>{active.where}</dd>
          </div>
        </dl>

        {active.regular !== null ? (
          <div className="pl-coll-prices" aria-label={`Cena plisy ${sizeLabel}`}>
            {active.withPromo !== null ? (
              <>
                <div className="pl-coll-price pl-coll-price--regular">
                  <span>Cena regularna</span>
                  <s>{zl(active.regular)}</s>
                </div>
                <div className="pl-coll-price pl-coll-price--promo">
                  <span>Z kodem {PROMO_CODE}</span>
                  <strong>{zl(active.withPromo)}</strong>
                  <em>oszczędzasz {zl(active.regular - active.withPromo)}</em>
                </div>
              </>
            ) : (
              <div className="pl-coll-price pl-coll-price--promo">
                <span>Plisa {sizeLabel}</span>
                <strong>{zl(active.regular)}</strong>
              </div>
            )}
          </div>
        ) : (
          <p className="pl-collections-note">Cennik ładuje się z konfiguratora…</p>
        )}

        <button type="button" className="pl-inline-cta-button pl-coll-cta" onClick={onQuote}>
          Wyceń plisę {active.name}
        </button>
      </div>
    </div>
  );
}
