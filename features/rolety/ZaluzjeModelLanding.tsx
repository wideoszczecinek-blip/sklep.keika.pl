"use client";

// Opisowa część strony jednego modelu żaluzji (/zaluzje/<slug>): okruszek z
// linkami do katalogu, zdjęcie, cena "od", plakietki, parametry, opis rodzaju
// i wariantu, podgląd kolorów. Konfigurator z tym modelem stoi obok (na
// telefonie pod spodem). Zmiana modelu = powrót do katalogu.
import Link from "next/link";
import { optimizeImageUrl } from "@/lib/image-optim";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { buildPlisyHardwareSwatchStyle } from "@/features/plisy/shared";
import { colorCountLabel } from "./ZaluzjeCategoryGrid";
import { findZaluzjeModel, ROLETY_COPY, zaluzjeModelDescription, type RoletyProfile } from "./shared";

function formatPrice(value: number): string {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ZaluzjeModelLanding({
  profile,
  modelSlug,
  fallbackName,
  onConfigure,
  onZoom,
}: {
  profile: RoletyProfile | null;
  modelSlug: string;
  fallbackName: string;
  onConfigure: () => void;
  onZoom: (preview: { title: string; urls: string[]; index: number }) => void;
}) {
  const copy = ROLETY_COPY.zaluzje;
  const adjustPercent = useProductPriceAdjustment("zaluzje");
  const model = profile ? findZaluzjeModel(profile, modelSlug, adjustPercent) : null;

  if (!profile) {
    return (
      <div className="pl-landing zl-model-landing">
        <nav className="zl-model-crumb" aria-label="Ścieżka">
          <Link href="/zaluzje">Żaluzje</Link>
          {fallbackName ? <span>{fallbackName.replace(/^Żaluzje\s+/i, "")}</span> : null}
        </nav>
        <p className="hero-product-config-hint">Wczytuję opis modelu…</p>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="pl-landing zl-model-landing">
        <p className="hero-product-config-hint">Nie znaleźliśmy tego modelu żaluzji.</p>
        <Link href="/zaluzje" className="pl-cta-button">
          Zobacz wszystkie żaluzje
        </Link>
      </div>
    );
  }

  const description = zaluzjeModelDescription(model);
  const swatches = model.group.swatches.slice(0, 14);
  const specs: Array<{ label: string; value: string }> = [
    { label: "Rodzaj", value: model.category },
    ...(model.widthMm ? [{ label: "Szerokość lameli", value: `${model.widthMm} mm` }] : []),
    ...(model.tag ? [{ label: "Wariant", value: model.tag }] : []),
    { label: "Kolory lameli", value: colorCountLabel(model.colorCount) },
    ...(model.maxSizeText ? [{ label: "Maks. wymiar", value: model.maxSizeText }] : []),
    { label: "Sterowanie", value: "sznurek i przekładnia, strona do wyboru" },
    { label: "Montaż", value: "klamry do sufitu lub ściany, w cenie" },
    { label: "Realizacja", value: copy.leadTimeLabel },
  ];

  return (
    <div className="pl-landing zl-model-landing">
      <nav className="zl-model-crumb" aria-label="Ścieżka">
        <Link href="/zaluzje">Żaluzje</Link>
        <Link href={`/zaluzje?kategoria=${model.categorySlug}`}>{model.category}</Link>
        <span>{model.shortName}</span>
      </nav>

      <div className="pl-trust-row">
        {model.startingPrice !== null ? (
          <span className="pl-price">
            od {formatPrice(model.startingPrice)} zł
            <span className="pl-price-unit"> / szt.</span>
          </span>
        ) : null}
        <span className="pl-chip">Realizacja {copy.leadTimeLabel}</span>
        <span className="pl-chip">5 lat gwarancji</span>
        <span className="pl-chip">30 dni na zwrot</span>
        <span className="pl-chip">Darmowa dostawa od 79 zł</span>
      </div>

      {model.imageUrl ? (
        <button type="button" className="zl-model-photo" aria-label={`Powiększ zdjęcie: ${model.name}`} onClick={() => onZoom({ title: model.name, urls: [model.imageUrl], index: 0 })}>
          <img src={optimizeImageUrl(model.imageUrl, 900)} alt={model.name} loading="eager" />
        </button>
      ) : null}

      <div className="pl-cta-row">
        <button type="button" className="pl-cta-button" onClick={onConfigure}>
          Wybierz kolor i wymiar
        </button>
      </div>

      <div className="pl-spec-grid">
        {specs.map((item) => (
          <div className="pl-spec-item" key={item.label}>
            <div className="pl-spec-item-text">
              <span className="pl-spec-label">{item.label}</span>
              <span className="pl-spec-value">{item.value}</span>
            </div>
          </div>
        ))}
      </div>

      <h2 className="hero-product-section-title">Opis produktu</h2>
      <div className="pl-description">
        {description.map((part, index) => (
          <p key={index}>{part}</p>
        ))}
      </div>

      {swatches.length ? (
        <>
          <h3 className="zl-model-subtitle">Kolory lameli</h3>
          <div className="zl-model-swatches">
            {swatches.map((swatch) => (
              <button key={swatch.id} type="button" className="zl-model-swatch" title={swatch.label} onClick={onConfigure}>
                <span style={buildPlisyHardwareSwatchStyle(swatch.thumbnailUrl, swatch.color)} aria-hidden="true" />
                <small>{swatch.label}</small>
              </button>
            ))}
            {model.colorCount > swatches.length ? (
              <button type="button" className="zl-model-swatch is-more" onClick={onConfigure}>
                <span aria-hidden="true">+{model.colorCount - swatches.length}</span>
                <small>więcej w konfiguratorze</small>
              </button>
            ) : null}
          </div>
        </>
      ) : null}

      <p className="zl-model-back">
        <Link href={`/zaluzje?kategoria=${model.categorySlug}`}>← Inne modele: {model.category}</Link>
        <Link href="/zaluzje">Wszystkie rodzaje żaluzji</Link>
      </p>
    </div>
  );
}
