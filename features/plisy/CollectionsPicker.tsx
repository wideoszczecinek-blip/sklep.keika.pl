"use client";

// "Którą kolekcję tkanin wybrać?" - size sliders over one accordion per
// fabric collection.
//
// Third design in one day. The 4-column table (2026-09-14) squashed on
// phones; the chips+panel that replaced it on 2026-09-15 got the owner's
// "te rodzaje tkanin i ich ceny też są nieczytelne - klient musi mieć jasną
// informację czego ta cena dotyczy". So now the size the prices refer to is
// not a footnote but a control the visitor sets themselves:
//
//   - width/height sliders, starting at 40 x 60 cm (owner's numbers), that
//     reprice every collection live off the CRM matrix (calcPlisyPrice -
//     the same function the configurator uses, so the two never disagree)
//   - one <details> accordion per collection, CLOSED by default; the bar
//     carries the name, ☾/thermometer badges, colour count, and both
//     prices (regular struck through, SEZON20 price) for the slider size
//   - inside: what it is and where it fits, a spec sheet built only from
//     facts we hold (no invented grammage), the colour swatches from the
//     CRM, and a CTA into the configurator
//
// Owner's framing (same message): "zrobić jako poglądowe i i tak skierować
// klienta do konfiguratora" - so every price is labelled with the size and
// mounting it assumes, and every accordion ends in the configurator.
import { useMemo, useState } from "react";
import { applyPromoToPrice, PROMO_CODE, type PromoPreview } from "@/lib/promo";
import { optimizeImageUrl } from "@/lib/image-optim";
import {
  PLISY_COLLECTIONS,
  PLISY_EXAMPLE_HEIGHT_MM,
  PLISY_EXAMPLE_WIDTH_MM,
  PLISY_LEAD_TIME_LABEL,
} from "./landing-content";
import { calcPlisyPrice, type PlisyProfile } from "./shared";

function zl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 0, maximumFractionDigits: 0 })} zł`;
}

/** Slider ceiling = the largest breakpoint the price matrix knows. Past it
 * calcPlisyPrice returns null and the bar would read "—", so do not let the
 * slider go there. Falls back to a sane range while the profile loads. */
function matrixMax(profile: PlisyProfile | null, axis: "width" | "height"): number {
  if (!profile) return axis === "width" ? 1500 : 2200;
  const all = profile.tables.flatMap((t) => (axis === "width" ? t.widthBreakpointsMm : t.heightBreakpointsMm));
  const max = Math.max(0, ...all);
  return max > 0 ? max : axis === "width" ? 1500 : 2200;
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M10.5 1.5a6.5 6.5 0 1 0 4 11.7A5.5 5.5 0 0 1 10.5 1.5z" fill="currentColor" />
    </svg>
  );
}

function ThermoIcon() {
  return (
    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
      <path d="M6.5 2.5a1.5 1.5 0 0 1 3 0v6.3a3 3 0 1 1-3 0z" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="8" cy="11.5" r="1.4" fill="currentColor" />
    </svg>
  );
}

export default function PlisyCollectionsPicker({
  profile,
  promo,
  onQuote,
  onZoom,
}: {
  profile: PlisyProfile | null;
  promo: PromoPreview | null;
  onQuote: () => void;
  /** Opens the page's lightbox on a swatch. */
  onZoom?: (title: string, urls: string[], index: number) => void;
}) {
  const minW = PLISY_EXAMPLE_WIDTH_MM / 10;
  const minH = PLISY_EXAMPLE_HEIGHT_MM / 10;
  const maxW = Math.max(minW + 10, Math.floor(matrixMax(profile, "width") / 10));
  const maxH = Math.max(minH + 10, Math.floor(matrixMax(profile, "height") / 10));

  const [widthCm, setWidthCm] = useState(minW);
  const [heightCm, setHeightCm] = useState(minH);

  const rows = useMemo(
    () =>
      PLISY_COLLECTIONS.map((row) => {
        const group = profile?.fabricGroups.find((entry) => entry.id === row.groupId);
        const regular =
          profile && group
            ? calcPlisyPrice(profile, widthCm * 10, heightCm * 10, profile.hardware[0]?.id || "", row.groupId)
            : null;
        const withPromo = regular !== null ? applyPromoToPrice(regular, promo) : null;
        const swatches = (group?.swatches || []).filter((s) => s.thumbnailUrl || s.imageUrl);
        return { ...row, group, regular, withPromo, swatches };
      }),
    [profile, promo, widthCm, heightCm],
  );

  const sizeLabel = `${widthCm} × ${heightCm} cm`;
  const rangeLabel = `${minW}–${maxW} cm × ${minH}–${maxH} cm`;

  return (
    <div className="pl-coll">
      <h3 className="pl-coll-title">Którą kolekcję tkanin wybrać?</h3>
      <p className="pl-coll-lead">
        Ustaw wymiar swojego okna, a ceny poniżej przeliczą się dla tego wymiaru. To wycena poglądowa — dokładną cenę,
        z montażem, kolorem mechanizmu i kilkoma sztukami, policzy konfigurator.
      </p>

      <div className="pl-coll-size" role="group" aria-label="Wymiar do wyceny poglądowej">
        <label className="pl-coll-slider">
          <span className="pl-coll-slider-head">
            <span>Szerokość</span>
            <output>{widthCm} cm</output>
          </span>
          <input
            type="range"
            min={minW}
            max={maxW}
            step={1}
            value={widthCm}
            onChange={(e) => setWidthCm(Number(e.target.value))}
            aria-valuetext={`${widthCm} centymetrów`}
          />
        </label>
        <label className="pl-coll-slider">
          <span className="pl-coll-slider-head">
            <span>Wysokość</span>
            <output>{heightCm} cm</output>
          </span>
          <input
            type="range"
            min={minH}
            max={maxH}
            step={1}
            value={heightCm}
            onChange={(e) => setHeightCm(Number(e.target.value))}
            aria-valuetext={`${heightCm} centymetrów`}
          />
        </label>
        <p className="pl-coll-size-note">
          Ceny dla plisy <strong>{sizeLabel}</strong>, montaż STANDARD, 1 sztuka
          {promo ? (
            <>
              {" "}
              — obok cena z kodem <strong>{PROMO_CODE}</strong>
            </>
          ) : null}
          .
        </p>
      </div>

      <div className="pl-coll-list">
        {rows.map((row) => (
          <details key={row.groupId} className="pl-coll-acc">
            <summary className="pl-coll-bar">
              <span className="pl-coll-bar-main">
                <span className="pl-coll-bar-name">{row.name}</span>
                <span className="pl-coll-bar-meta">
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
                  {row.swatches.length ? <span className="pl-coll-count">{row.swatches.length} kolorów</span> : null}
                </span>
              </span>

              <span className="pl-coll-bar-price" aria-label={`Cena dla ${sizeLabel}`}>
                {row.regular === null ? (
                  <span className="pl-coll-bar-na">wyceń w konfiguratorze</span>
                ) : row.withPromo !== null ? (
                  <>
                    <s>{zl(row.regular)}</s>
                    <strong>{zl(row.withPromo)}</strong>
                    <small>z kodem {PROMO_CODE}</small>
                  </>
                ) : (
                  <strong>{zl(row.regular)}</strong>
                )}
              </span>

              <span className="pl-coll-chev" aria-hidden="true" />
            </summary>

            <div className="pl-coll-body">
              <p className="pl-coll-what">{row.what}</p>
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
                  <dt>Wymiary</dt>
                  <dd>{rangeLabel}</dd>
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
                    return (
                      <button
                        key={swatch.id}
                        type="button"
                        role="listitem"
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
                    );
                  })}
                </div>
              ) : null}

              <button type="button" className="pl-inline-cta-button pl-coll-cta" onClick={onQuote}>
                Wyceń plisę {row.name} w konfiguratorze
              </button>
            </div>
          </details>
        ))}
      </div>
    </div>
  );
}
