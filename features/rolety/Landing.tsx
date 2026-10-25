"use client";

// Landing rolet mini (dzień-noc / tradycyjne) i katalogu żaluzji w widoku
// produktu home-client. Treść w całości z CRM (product_groups: podtytuł,
// opis, parametry, atuty, sekcje, wyróżnik, galeria) - tu tylko układ w
// klasach landingu plis (pl-*), cena "od" z żywego cennika i przycisk do
// konfiguratora. Żaluzje: pod podtytułem katalog modeli (catalogSlot).
import type { ReactNode } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { ROLETY_COPY, roletyStartingPrice, type RoletyProfile, type RoletySlug } from "./shared";

export type RoletyLandingContent = {
  subtitle: string;
  description: string;
  specItems: Array<{ label: string; value: string }>;
  featureBullets: Array<{ lead: string; detail?: string }>;
  sections: Array<{ title: string; body: string }>;
  callout: { title: string; body: string } | null;
  gallery: string[];
};

function formatPrice(value: number): string {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function RoletyLanding({
  slug,
  profile,
  landing,
  fallbackGallery,
  productLabel,
  onConfigure,
  onZoom,
  catalogSlot,
  ctaLabel,
}: {
  slug: RoletySlug;
  profile: RoletyProfile | null;
  landing: RoletyLandingContent | null;
  fallbackGallery: string[];
  productLabel: string;
  onConfigure: () => void;
  onZoom: (preview: { title: string; urls: string[]; index: number }) => void;
  /** Żaluzje: katalog modeli zaraz pod podtytułem, przed zdjęciami. */
  catalogSlot?: ReactNode;
  /** Etykieta przycisków CTA (domyślnie z ROLETY_COPY). */
  ctaLabel?: string;
}) {
  const copy = ROLETY_COPY[slug];
  const cta = ctaLabel || copy.ctaLabel;
  const adjustPercent = useProductPriceAdjustment(slug);
  const startingPrice = roletyStartingPrice(profile, slug, adjustPercent);
  const photos = (landing?.gallery?.length ? landing.gallery : fallbackGallery).filter(Boolean).slice(0, 4);
  const description = String(landing?.description || "").trim();
  const paragraphs = description && !/<[a-z][\s\S]*>/i.test(description) ? description.split(/\n{2,}/).map((part) => part.trim()).filter(Boolean) : [];

  return (
    <div className="pl-landing rl-landing">
      <div className="pl-trust-row">
        <span className="pl-price">
          od {formatPrice(startingPrice)} zł
          <span className="pl-price-unit"> / szt.</span>
        </span>
        <span className="pl-chip">Realizacja {copy.leadTimeLabel}</span>
        {/* Nasza produkcja: 5 lat gwarancji i 30 dni na zwrot wyróżnione jak w plisach (właściciel 25.10:
            „to trzeba komunikować”). Żaluzje to dystrybucja - gwarancja producenta, do decyzji właściciela. */}
        <span className={slug === "zaluzje" ? "pl-chip" : "pl-chip pl-chip-promise"}>{slug === "zaluzje" ? "" : "🛡 "}5 lat gwarancji</span>
        <span className={slug === "zaluzje" ? "pl-chip" : "pl-chip pl-chip-promise"}>{slug === "zaluzje" ? "" : "↩ "}30 dni na zwrot</span>
        <span className="pl-chip">Darmowa dostawa od 79 zł</span>
      </div>

      {landing?.subtitle ? <p className="pl-subtitle">{landing.subtitle}</p> : null}

      {catalogSlot}

      {photos.length ? (
        <div className={`rl-photos rl-photos--${Math.min(photos.length, 4)}`}>
          {photos.map((url, index) => (
            <button
              key={url}
              type="button"
              className="rl-photo"
              aria-label={`Powiększ zdjęcie ${index + 1}: ${productLabel}`}
              onClick={() => onZoom({ title: productLabel, urls: photos, index })}
            >
              <img src={optimizeImageUrl(url, 700)} alt={`${productLabel} - zdjęcie ${index + 1}`} loading={index === 0 ? "eager" : "lazy"} />
            </button>
          ))}
        </div>
      ) : null}

      <div className="pl-cta-row">
        <button type="button" className="pl-cta-button" onClick={onConfigure}>
          {cta}
        </button>
      </div>

      {landing?.specItems?.length ? (
        <div className="pl-spec-grid">
          {landing.specItems.map((item) => (
            <div className="pl-spec-item" key={item.label}>
              <div className="pl-spec-item-text">
                <span className="pl-spec-label">{item.label}</span>
                <span className="pl-spec-value">{item.value}</span>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <h2 className="hero-product-section-title">Opis produktu</h2>
      {description ? (
        paragraphs.length ? (
          <div className="pl-description">
            {paragraphs.map((part, index) => (
              <p key={index}>{part}</p>
            ))}
          </div>
        ) : (
          // HTML z edytora w CRM - treść właściciela, nie użytkownika.
          <div className="pl-description" dangerouslySetInnerHTML={{ __html: description }} />
        )
      ) : null}

      {landing?.featureBullets?.length ? (
        <ul className="pl-feature-list">
          {landing.featureBullets.map((bullet) => (
            <li key={bullet.lead}>
              <strong>{bullet.lead}</strong>
              {bullet.detail ? <span> — {bullet.detail}</span> : null}
            </li>
          ))}
        </ul>
      ) : null}

      {landing?.sections?.length ? (
        <div className="pl-benefits">
          {landing.sections.map((section, index) => (
            <div className="pl-benefit" key={`${section.title}-${index}`}>
              <div className="pl-benefit-copy">
                <span className="pl-benefit-index">{String(index + 1).padStart(2, "0")}</span>
                <h3>{section.title}</h3>
                <p>{section.body}</p>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {landing?.callout ? (
        <div className="pl-callout">
          <strong>{landing.callout.title}</strong>
          <p>{landing.callout.body}</p>
          <button type="button" className="pl-inline-cta-button pl-callout-cta" onClick={onConfigure}>
            {cta}
          </button>
        </div>
      ) : null}
    </div>
  );
}
