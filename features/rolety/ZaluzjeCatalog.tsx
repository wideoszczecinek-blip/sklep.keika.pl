"use client";

// Katalog żaluzji na /zaluzje (właściciel, 17.10.2026): w opisowej części
// strony duże bloki rodzajów, po kliknięciu - lista produktów tego rodzaju
// pogrupowana po szerokości lameli. Każdy produkt (model z CRM) prowadzi na
// własną stronę /zaluzje/<slug> z konfiguratorem. Konfiguratora tu nie ma.
// Adres: ?kategoria=<slug> otwiera rodzaj; stare ?model=<id> przekierowuje na
// stronę modelu.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { trackShopStep } from "@/lib/track-step";
import ZaluzjeCategoryGrid, { colorCountLabel, modelCountLabel } from "./ZaluzjeCategoryGrid";
import {
  buildZaluzjeTree,
  findZaluzjeModel,
  zaluzjeModels,
  zaluzjeVariantNote,
  type RoletyProfile,
  type ZaluzjeCategory,
  type ZaluzjeModel,
} from "./shared";

export const ZALUZJE_CATALOG_ID = "zaluzje-katalog";

function formatZl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

function readParam(name: string): string {
  try {
    if (typeof window === "undefined") return "";
    return (new URL(window.location.href).searchParams.get(name) || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

function writeKategoriaParam(value: string) {
  try {
    const url = new URL(window.location.href);
    if (value) url.searchParams.set("kategoria", value);
    else url.searchParams.delete("kategoria");
    url.searchParams.delete("model");
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}

export default function ZaluzjeCatalog({ profile }: { profile: RoletyProfile | null }) {
  const adjustPercent = useProductPriceAdjustment("zaluzje");
  const tree = useMemo(() => (profile ? buildZaluzjeTree(profile, adjustPercent) : []), [profile, adjustPercent]);
  const models = useMemo(() => (profile ? zaluzjeModels(profile, adjustPercent) : []), [profile, adjustPercent]);
  const [activeSlug, setActiveSlug] = useState("");
  const [widthFilter, setWidthFilter] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  // ?kategoria= z adresu (także z linku powrotnego ze strony modelu).
  useEffect(() => {
    const fromUrl = readParam("kategoria");
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fromUrl) setActiveSlug(fromUrl);
  }, []);

  // Stare linki /zaluzje?model=ss-39 -> strona modelu.
  useEffect(() => {
    if (!profile) return;
    const legacy = readParam("model");
    if (!legacy) return;
    const model = findZaluzjeModel(profile, legacy);
    if (!model) {
      writeKategoriaParam(readParam("kategoria"));
      return;
    }
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete("model");
      url.searchParams.delete("kategoria");
      window.location.replace(`/zaluzje/${model.slug}${url.search}${url.hash}`);
    } catch {
      window.location.replace(`/zaluzje/${model.slug}`);
    }
  }, [profile]);

  const active: ZaluzjeCategory | null = tree.find((entry) => entry.slug === activeSlug) || null;
  const activeModels = useMemo(() => models.filter((model) => model.categorySlug === activeSlug), [models, activeSlug]);
  const widths = useMemo(() => Array.from(new Set(activeModels.map((model) => model.widthMm))).sort((a, b) => a - b), [activeModels]);
  const shownWidths = widthFilter && widths.includes(widthFilter) ? [widthFilter] : widths;

  function scrollToList() {
    window.setTimeout(() => {
      const target = listRef.current;
      if (!target) return;
      const container = target.closest<HTMLElement>(".hero-full");
      if (container && container.scrollHeight > container.clientHeight) {
        const delta = target.getBoundingClientRect().top - container.getBoundingClientRect().top - 90;
        container.scrollTo({ top: Math.max(0, container.scrollTop + delta), behavior: "smooth" });
      } else {
        target.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 60);
  }

  function pickCategory(entry: ZaluzjeCategory) {
    trackShopStep("zaluzje_category", entry.category, { models: entry.modelCount, source: "catalog" });
    setActiveSlug(entry.slug);
    setWidthFilter(0);
    writeKategoriaParam(entry.slug);
    scrollToList();
  }

  function cardFor(model: ZaluzjeModel) {
    const note = model.tag ? zaluzjeVariantNote(model.tag) : "";
    return (
      <Link
        key={model.id}
        href={`/zaluzje/${model.slug}`}
        className="zl-product-card"
        onClick={() => trackShopStep("select_model", model.name, { option_id: model.id, source: "catalog" })}
      >
        <span className="zl-product-photo" aria-hidden="true" style={model.imageUrl ? { backgroundImage: `url(${optimizeImageUrl(model.imageUrl, 360)})` } : undefined} />
        <span className="zl-product-body">
          <strong>{model.name}</strong>
          <span className="zl-product-note">{note || (model.maxSizeText ? `Wymiar ${model.maxSizeText}.` : "Wariant podstawowy.")}</span>
          <span className="zl-cat-meta">
            {model.startingPrice !== null ? <span className="zl-price">od {formatZl(model.startingPrice)}</span> : null}
            <span>{colorCountLabel(model.colorCount)}</span>
          </span>
          <span className="zl-product-cta">Wybierz</span>
        </span>
      </Link>
    );
  }

  return (
    <section id={ZALUZJE_CATALOG_ID} className="zl-catalog" aria-label="Katalog żaluzji">
      <h2 className="hero-product-section-title">Wybierz rodzaj żaluzji</h2>
      {!profile ? (
        <p className="hero-product-config-hint">Wczytuję modele żaluzji…</p>
      ) : (
        <ZaluzjeCategoryGrid tree={tree} activeSlug={activeSlug} onPick={pickCategory} />
      )}

      <div ref={listRef} className="zl-products">
        {active ? (
          <>
            <h3 className="zl-products-title">
              {active.category} <small>{modelCountLabel(activeModels.length)}</small>
            </h3>
            {widths.length > 1 ? (
              <div className="zl-chip-row" role="group" aria-label="Szerokość lameli">
                <button type="button" className={`zl-chip ${widthFilter === 0 ? "is-active" : ""}`} aria-pressed={widthFilter === 0} onClick={() => setWidthFilter(0)}>
                  <strong>Wszystkie</strong>
                  <small>{modelCountLabel(activeModels.length)}</small>
                </button>
                {widths.map((width) => (
                  <button
                    key={width}
                    type="button"
                    className={`zl-chip ${widthFilter === width ? "is-active" : ""}`}
                    aria-pressed={widthFilter === width}
                    onClick={() => {
                      trackShopStep("zaluzje_width", `${width} mm`, { category: active.category });
                      setWidthFilter(width);
                    }}
                  >
                    <strong>{width} mm</strong>
                    <small>{modelCountLabel(activeModels.filter((model) => model.widthMm === width).length)}</small>
                  </button>
                ))}
              </div>
            ) : null}
            {shownWidths.map((width) => (
              <div key={width} className="zl-products-group">
                <h4 className="rolety-group-section-title">{width ? `Lamele ${width} mm` : "Pozostałe"}</h4>
                <div className="zl-product-grid">{activeModels.filter((model) => model.widthMm === width).map(cardFor)}</div>
              </div>
            ))}
          </>
        ) : profile ? (
          <p className="hero-product-config-hint">Kliknij rodzaj żaluzji, aby zobaczyć modele i ceny.</p>
        ) : null}
      </div>
    </section>
  );
}
