"use client";

// Landing blocks for rolety dachowe that live between the description and
// the configurator (same role as features/plisy/CollectionsPicker.tsx +
// CollectionVisual.tsx): "Jak działa system" tiles, the DEKO / TERMO
// fabrics guide priced for the window chosen up top, the three hardware
// finishes and the window-library teaser. Content: landing-content.ts;
// option data and prices: the live CRM profile.
import { useMemo, useState } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import { applyPromoToPrice, type PromoPreview } from "@/lib/promo";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { trackShopStep } from "@/lib/track-step";
import { RD_FABRIC_TYPES, RD_HOW_IT_WORKS, type RdHowItWorksTile } from "./landing-content";
import { libraryProducers, type RoofWindowLibraryItem } from "./roof-window-library";
import { calcRoletyDachowePrice, type RoofBlindProfile } from "./shared";

function zl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

function TileIcon({ id }: { id: RdHowItWorksTile["id"] }) {
  const common = { width: 40, height: 40, viewBox: "0 0 40 40", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };
  switch (id) {
    case "kaseta":
      return (
        <svg {...common}>
          <rect x="5" y="8" width="30" height="9" rx="3" />
          <path d="M9 17v15M31 17v15M9 32h22" />
          <path d="M12 21h16M12 25h16" opacity="0.5" />
        </svg>
      );
    case "prowadnice":
      return (
        <svg {...common}>
          <path d="M8 6v28M32 6v28" />
          <path d="M11 6h18v20H11z" opacity="0.5" />
          <path d="M11 26h18" />
        </svg>
      );
    case "hamulec":
      return (
        <svg {...common}>
          <path d="M8 8h24" />
          <path d="M8 20h24" strokeWidth="3" />
          <path d="M20 22v10M16 32h8" />
          <path d="M14 12l2 3M26 12l-2 3" opacity="0.6" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <path d="M6 30L20 8l14 22" />
          <path d="M14 30V18h12v12" opacity="0.6" />
          <circle cx="20" cy="24" r="1.6" fill="currentColor" stroke="none" />
        </svg>
      );
  }
}

export function RoofHowItWorks() {
  return (
    <section className="rd-how" aria-label="Jak działa roleta dachowa">
      <h2 className="hero-product-section-title">Jak działa nasza roleta dachowa</h2>
      <p className="rd-how-lead">Pełny system do okna połaciowego — nie roletka na haczykach. Cztery elementy, które robią różnicę na skosie.</p>
      <div className="rd-how-grid">
        {RD_HOW_IT_WORKS.map((tile) => (
          <article key={tile.id} className="rd-how-tile">
            <span className="rd-how-icon">
              <TileIcon id={tile.id} />
            </span>
            <h3>{tile.title}</h3>
            <p>{tile.body}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

export function RoofFabricsGuide({
  profile,
  promo,
  widthMm,
  heightMm,
  sizeLabel,
  activeMaterialTypeId,
  onPick,
  onZoom,
}: {
  profile: RoofBlindProfile | null;
  promo: PromoPreview | null;
  /** The window priced up top (quick price) - both fabrics are priced for it. */
  widthMm: number;
  heightMm: number;
  sizeLabel: string;
  activeMaterialTypeId: string;
  onPick: (materialTypeId: string) => void;
  onZoom: (title: string, urls: string[], index: number) => void;
}) {
  const adjustBySlug = useProductPriceAdjustment("rolety-dachowe");
  const adjustByCrmSlug = useProductPriceAdjustment("roleta-dachowa-dekolux");
  const priceAdjustmentPercent = adjustBySlug || adjustByCrmSlug;
  const hardwareId = profile?.hardware[0]?.id || "bialy";
  const [openSheet, setOpenSheet] = useState<string | null>(null);

  const rows = useMemo(
    () =>
      RD_FABRIC_TYPES.map((row) => {
        const swatches = (profile?.fabrics || []).filter((fabric) => fabric.materialTypeId === row.materialTypeId);
        const price = profile && widthMm && heightMm ? calcRoletyDachowePrice(profile.tables, widthMm, heightMm, hardwareId, row.materialTypeId, priceAdjustmentPercent) : null;
        return { row, swatches, price, promoPrice: price !== null ? applyPromoToPrice(price, promo) : null };
      }),
    [profile, widthMm, heightMm, hardwareId, priceAdjustmentPercent, promo],
  );

  return (
    <section className="rd-fabrics" aria-label="Tkaniny DEKO i TERMO">
      <h2 className="hero-product-section-title">Którą tkaninę wybrać: DEKO czy TERMO?</h2>
      <p className="rd-how-lead">
        Dwie kolekcje, 73 kolory. Ceny poniżej dla okna {sizeLabel ? <strong>{sizeLabel}</strong> : "wybranego wyżej"} z białą kasetą — kolor tkaniny i osprzętu wybierzesz w konfiguratorze.
      </p>
      <div className="rd-fabrics-grid">
        {rows.map(({ row, swatches, price, promoPrice }) => {
          const isActive = activeMaterialTypeId === row.materialTypeId;
          return (
            <article key={row.materialTypeId} className={`rd-fabric-card ${isActive ? "is-active" : ""}`}>
              <button type="button" className="rd-fabric-sheet" onClick={() => onZoom(`Tkaniny ${row.name}`, [row.sheetSrc], 0)} aria-label={`Powiększ wzornik ${row.name}`}>
                <img src={optimizeImageUrl(row.sheetSrc, 900)} alt={`Wzornik tkanin ${row.name} — ${row.count} kolorów`} loading="lazy" />
                <span className="plisy-hero-tile-zoom" aria-hidden="true">
                  🔍
                </span>
              </button>
              <div className="rd-fabric-body">
                <div className="rd-fabric-head">
                  <h3>{row.name}</h3>
                  <span className="rd-fabric-badges">
                    {row.blackout ? <span className="pl-coll-badge pl-coll-badge--blackout">☾ zaciemnia</span> : <span className="pl-coll-badge pl-coll-badge--deco">☀ przepuszcza światło</span>}
                    {row.thermal ? <span className="pl-coll-badge pl-coll-badge--thermal">🌡 odbija słońce</span> : null}
                  </span>
                </div>
                <p className="rd-fabric-tagline">{row.tagline}</p>
                <p>{row.what}</p>
                <p className="rd-fabric-where">
                  <strong>Gdzie:</strong> {row.where}
                </p>
                {swatches.length ? (
                  <div className="rd-fabric-swatches" aria-label={`Kolory ${row.name}`}>
                    {swatches.slice(0, 14).map((fabric) => (
                      <span key={fabric.id} className="rd-fabric-swatch" title={fabric.label} style={{ backgroundImage: `url(${optimizeImageUrl(fabric.imageUrl, 64)})`, backgroundColor: fabric.color }} />
                    ))}
                    {swatches.length > 14 ? <span className="rd-fabric-swatch-more">+{swatches.length - 14}</span> : null}
                  </div>
                ) : null}
                <button type="button" className="rd-link rd-fabric-spec-toggle" onClick={() => setOpenSheet(openSheet === row.materialTypeId ? null : row.materialTypeId)} aria-expanded={openSheet === row.materialTypeId}>
                  Dane techniczne {openSheet === row.materialTypeId ? "▴" : "▾"}
                </button>
                {openSheet === row.materialTypeId ? <p className="rd-fabric-spec">{row.spec}</p> : null}
                <div className="rd-fabric-foot">
                  <span className="rd-fabric-price">
                    {price === null ? (
                      <small>cenę pokaże konfigurator</small>
                    ) : promoPrice !== null && promoPrice < price ? (
                      <>
                        <s>{zl(price)}</s> <strong>{zl(promoPrice)}</strong>
                      </>
                    ) : (
                      <strong>{zl(price)}</strong>
                    )}
                  </span>
                  <button
                    type="button"
                    className="pl-inline-cta-button"
                    onClick={() => {
                      trackShopStep("fabric_type_pick", row.name, { material: row.materialTypeId, price: price ?? 0 });
                      onPick(row.materialTypeId);
                    }}
                  >
                    Wybieram {row.name}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

export function RoofHardwareStrip({ profile, onZoom }: { profile: RoofBlindProfile | null; onZoom: (title: string, urls: string[], index: number) => void }) {
  const hardware = profile?.hardware || [];
  if (!hardware.length) return null;
  return (
    <section className="rd-hardware" aria-label="Kolory kasety i prowadnic">
      <h2 className="hero-product-section-title">3 kolory kasety i prowadnic</h2>
      <p className="rd-how-lead">Kaseta, boczne prowadnice i dolna belka zawsze w jednym kolorze — dobierz do ramy okna.</p>
      <div className="rd-hardware-grid">
        {hardware.map((option) => (
          <button key={option.id} type="button" className="rd-hardware-card" onClick={() => onZoom(option.label, option.galleryUrls.length ? option.galleryUrls : [option.imageUrl], 0)}>
            <span className="rd-hardware-image" style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 360)})` }} />
            <span className="rd-hardware-label">
              <span className="hardware-dot" style={{ background: option.color }} />
              <strong>{option.label}</strong>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function RoofLibraryTeaser({ library, onSearch }: { library: RoofWindowLibraryItem[]; onSearch: (query: string) => void }) {
  const producers = useMemo(() => libraryProducers(library), [library]);
  const [query, setQuery] = useState("");
  const top = producers.slice(0, 6);
  return (
    <section className="rd-library" aria-label="Biblioteka modeli okien">
      <div className="rd-library-head">
        <h2 className="hero-product-section-title">{library.length ? `${library.length} modeli okien w bibliotece` : "Biblioteka modeli okien"}</h2>
        <p className="rd-how-lead">
          {top.length ? top.map((entry) => entry.name).join(" · ") : "Velux · Fakro · Roto · OKPOL · Dakstra · Optilight"} — wybierasz model, a wymiar rolety dobieramy sami. Nie ma Twojego okna? Podajesz dwa wymiary.
        </p>
      </div>
      <form
        className="rd-library-search"
        onSubmit={(event) => {
          event.preventDefault();
          if (!query.trim()) return;
          trackShopStep("library_teaser_search", query.trim().slice(0, 60));
          onSearch(query.trim());
        }}
      >
        <label className="rd-search-field">
          <span className="sr-only">Wyszukaj model okna</span>
          <input type="text" className="rd-search-input" inputMode="search" autoComplete="off" placeholder="Sprawdź, czy mamy Twoje okno — np. Roto R79, Velux GGL M06" value={query} onChange={(event) => setQuery(event.target.value)} />
        </label>
        <button type="submit" className="pl-inline-cta-button">
          Szukaj w konfiguratorze
        </button>
      </form>
      {producers.length ? (
        <ul className="rd-library-brands">
          {producers.slice(0, 8).map((entry) => (
            <li key={entry.name}>
              <strong>{entry.name}</strong> <span>{entry.count} {entry.count === 1 ? "model" : entry.count < 5 ? "modele" : "modeli"}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
