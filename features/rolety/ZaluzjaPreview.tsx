"use client";

// Kafelek podglądu żaluzji (właściciel, 17.10.2026: "po stworzonej pozycji
// podglądu żaluzji nie widzę"): zdjęcie modelu z CRM z nałożoną próbką
// wybranego koloru lameli w rogu i lista: model, kolor, wymiar, montaż,
// drabinka/taśma, sterowanie, pakiet. Ten sam komponent w podsumowaniu
// konfiguratora, w komunikacie "Dodano do koszyka" i w koszyku (v1/v2).
import { optimizeImageUrl } from "@/lib/image-optim";
import { buildPlisyHardwareSwatchStyle } from "@/features/plisy/shared";

export type ZaluzjaPreviewData = {
  photoUrl: string;
  swatchUrl: string;
  swatchColor: string;
  swatchLabel: string;
  lines: Array<{ label: string; value: string }>;
};

export default function ZaluzjaPreview({ data, compact = false }: { data: ZaluzjaPreviewData; compact?: boolean }) {
  return (
    <div className={`zl-preview ${compact ? "is-compact" : ""}`}>
      <div className="zl-preview-visual" aria-hidden="true">
        {data.photoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={optimizeImageUrl(data.photoUrl, compact ? 220 : 500)} alt="" loading={compact ? "lazy" : "eager"} />
        ) : (
          <span className="zl-preview-photo-empty" />
        )}
        <span className="zl-preview-swatch" style={buildPlisyHardwareSwatchStyle(data.swatchUrl, data.swatchColor)} title={data.swatchLabel} />
      </div>
      {!compact && data.lines.length ? (
        <dl className="zl-preview-lines">
          {data.lines.map((line) => (
            <div key={line.label}>
              <dt>{line.label}</dt>
              <dd>{line.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

/** Nagłówek pozycji żaluzji w jednej linii (właściciel, 18.10.2026: "miniaturkę
 * malutką daj u góry obok nazwy produktu - spójne i niewielkie wszystko"):
 * miniatura zdjęcia modelu z kropką koloru lameli + nazwa i drobny opis. */
export function ZaluzjaHead({
  photoUrl,
  swatchUrl,
  swatchColor,
  swatchLabel,
  title,
  sub,
  onZoom,
}: {
  photoUrl: string;
  swatchUrl: string;
  swatchColor: string;
  swatchLabel: string;
  title: string;
  sub: string;
  onZoom?: () => void;
}) {
  const thumb = (
    <span className="zl-head-thumb" aria-hidden={onZoom ? undefined : "true"}>
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={optimizeImageUrl(photoUrl, 128)} alt="" loading="lazy" />
      ) : (
        <span className="zl-preview-photo-empty" />
      )}
      <span className="zl-head-swatch" style={buildPlisyHardwareSwatchStyle(swatchUrl, swatchColor)} title={swatchLabel} />
    </span>
  );
  return (
    <div className="zl-head">
      {onZoom && photoUrl ? (
        <button type="button" className="zl-head-zoom" onClick={onZoom} aria-label="Powiększ zdjęcie modelu">
          {thumb}
        </button>
      ) : (
        thumb
      )}
      <span className="zl-head-text">
        <strong>{title}</strong>
        {sub ? <small>{sub}</small> : null}
      </span>
    </div>
  );
}

export type ZaluzjaRow = { label: string; value: string };

/** Zwarta tabela "etykieta: wartość" na całą szerokość + krótkie wiersze ceny. */
export function ZaluzjaSpecTable({ rows, priceRows = [], className = "" }: { rows: ZaluzjaRow[]; priceRows?: ZaluzjaRow[]; className?: string }) {
  return (
    <dl className={`zl-table ${className}`}>
      {rows.map((row, index) => (
        <div key={`r${index}`}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
      {priceRows.map((row, index) => (
        <div key={`p${index}`} className={`is-price ${index === 0 ? "is-price-first" : ""}`}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
