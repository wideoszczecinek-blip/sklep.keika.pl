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
