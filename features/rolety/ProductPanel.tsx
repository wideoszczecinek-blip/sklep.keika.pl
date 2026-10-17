"use client";

// Panel produktu rodziny rolet w widoku produktu (home-client). Rolety mini
// idą prosto do konfiguratora. Żaluzje (właściciel, 17.10.2026: "najpierw
// klient dostaje duże bloki produktów, później wybiera szerokość lameli i
// dopiero konfigurator") przechodzą przez trzy ekrany: rodzaj żaluzji ->
// szerokość lameli -> wariant (gdy jest kilka) -> konfigurator z wybranym
// modelem. Deep-linki: ?model=<id grupy> otwiera konfigurator, ?kategoria=<slug>
// otwiera wybór szerokości. Adres jest aktualizowany (replaceState), więc
// odświeżenie strony wraca w to samo miejsce.
import { useEffect, useMemo, useState } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { trackShopStep } from "@/lib/track-step";
import RoletyConfiguratorPanel from "./ConfiguratorPanel";
import {
  buildZaluzjeTree,
  fetchRoletyProfile,
  zaluzjeVariantNote,
  type ConfiguratorInitialValues,
  type ConfiguratorResult,
  type RoletyProfile,
  type RoletySlug,
  type ZaluzjeCategory,
  type ZaluzjeVariant,
  type ZaluzjeWidth,
} from "./shared";

type ZoomPreview = { title: string; urls: string[]; index: number };

type Props = {
  slug: RoletySlug;
  initialValues?: ConfiguratorInitialValues;
  submitLabel: string;
  onSubmit: (result: ConfiguratorResult) => void;
  onZoom?: (preview: ZoomPreview) => void;
};

function formatZl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

function modelCountLabel(count: number): string {
  if (count === 1) return "1 model";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} modele`;
  return `${count} modeli`;
}

function colorCountLabel(count: number): string {
  if (count === 1) return "1 kolor";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} kolory`;
  return `${count} kolorów`;
}

function readUrlParam(name: string): string {
  try {
    if (typeof window === "undefined") return "";
    return (new URL(window.location.href).searchParams.get(name) || "").trim().toLowerCase();
  } catch {
    return "";
  }
}

/** Aktualizacja adresu bez przeładowania i bez wpisu w historii. */
function writeUrlParams(params: Record<string, string | null>) {
  try {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    for (const [key, value] of Object.entries(params)) {
      if (value) url.searchParams.set(key, value);
      else url.searchParams.delete(key);
    }
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`);
  } catch {
    /* ignore */
  }
}

export default function RoletyProductPanel(props: Props) {
  if (props.slug !== "zaluzje") return <RoletyConfiguratorPanel {...props} />;
  return <ZaluzjeFlow {...props} />;
}

type Stage = "category" | "width" | "variant" | "configure";

// Deep-link z adresu (?model=, ?kategoria=) obowiązuje tylko przy pierwszym
// zamontowaniu po wejściu na stronę. Każde kolejne zamontowanie (remount po
// "Wyceń nową żaluzję") ma zaczynać od bloków - inaczej adres zapisany
// replaceState po wyborze modelu otwierałby ten sam model w kółko.
let urlDeepLinkConsumed = false;
function consumeUrlDeepLink(): { model: string; kategoria: string } {
  if (urlDeepLinkConsumed) return { model: "", kategoria: "" };
  urlDeepLinkConsumed = true;
  return { model: readUrlParam("model"), kategoria: readUrlParam("kategoria") };
}

function ZaluzjeFlow({ slug, initialValues, submitLabel, onSubmit, onZoom }: Props) {
  const adjustPercent = useProductPriceAdjustment(slug);
  const [profile, setProfile] = useState<RoletyProfile | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    fetchRoletyProfile(slug).then((result) => {
      if (cancelled) return;
      if (!result || result.fabricGroups.length === 0) {
        setLoadState("error");
        return;
      }
      setProfile(result);
      setLoadState("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [slug, retry]);

  const tree = useMemo(() => (profile ? buildZaluzjeTree(profile, adjustPercent) : []), [profile, adjustPercent]);

  // Punkt startowy: model z "Wyceń podobną" / edycji, albo z adresu (raz).
  const [deepLink] = useState(() => consumeUrlDeepLink());
  const [stage, setStage] = useState<Stage>(() => {
    if (initialValues?.fabricGroupId || initialValues?.fabricGroupLabel || deepLink.model) return "configure";
    if (deepLink.kategoria) return "width";
    return "category";
  });
  const [categorySlug, setCategorySlug] = useState<string>(() => deepLink.kategoria);
  const [widthMm, setWidthMm] = useState<number>(0);
  const [modelId, setModelId] = useState<string>(() => initialValues?.fabricGroupId || deepLink.model);
  // Start od bloków = czysty adres (po "Wyceń nową" zostawał ?model=...).
  useEffect(() => {
    if (stage === "category") writeUrlParams({ model: null, kategoria: null });
    else if (stage === "configure" && modelId) writeUrlParams({ model: modelId, kategoria: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Walidacja deep-linków po wczytaniu profilu: nieznany model / kategoria
  // wracają do bloków.
  useEffect(() => {
    if (!profile || tree.length === 0) return;
    if (stage === "configure" && modelId && !profile.fabricGroups.some((group) => group.id === modelId)) {
      setModelId("");
      setStage("category");
      writeUrlParams({ model: null, kategoria: null });
    }
    if (stage === "width" && categorySlug && !tree.some((entry) => entry.slug === categorySlug)) {
      setCategorySlug("");
      setStage("category");
      writeUrlParams({ kategoria: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, tree]);

  const category: ZaluzjeCategory | null = useMemo(() => tree.find((entry) => entry.slug === categorySlug) || null, [tree, categorySlug]);
  const width: ZaluzjeWidth | null = useMemo(() => category?.widths.find((entry) => entry.widthMm === widthMm) || null, [category, widthMm]);
  const selectedGroup = useMemo(() => profile?.fabricGroups.find((group) => group.id === modelId) || null, [profile, modelId]);
  // Okruszek dla konfiguratora: kategoria › szerokość › wariant.
  const crumb = useMemo(() => {
    if (!selectedGroup) return [] as string[];
    for (const entry of tree) {
      for (const w of entry.widths) {
        const variant = w.variants.find((v) => v.group.id === selectedGroup.id);
        if (variant) {
          const parts = [entry.category, w.widthMm ? `${w.widthMm} mm` : ""];
          if (w.variants.length > 1) parts.push(variant.tag || "podstawowy");
          return parts.filter(Boolean);
        }
      }
    }
    return [selectedGroup.label];
  }, [tree, selectedGroup]);

  function pickCategory(entry: ZaluzjeCategory) {
    trackShopStep("zaluzje_category", entry.category, { models: entry.modelCount });
    setCategorySlug(entry.slug);
    setWidthMm(0);
    writeUrlParams({ kategoria: entry.slug, model: null });
    // Jedna szerokość w kategorii - od razu warianty / model.
    if (entry.widths.length === 1) {
      pickWidth(entry, entry.widths[0]);
      return;
    }
    setStage("width");
  }

  function pickWidth(entry: ZaluzjeCategory, w: ZaluzjeWidth) {
    trackShopStep("zaluzje_width", `${w.widthMm} mm`, { category: entry.category, variants: w.variants.length });
    setWidthMm(w.widthMm);
    if (w.variants.length === 1) {
      pickVariant(w.variants[0]);
      return;
    }
    setStage("variant");
  }

  function pickVariant(variant: ZaluzjeVariant) {
    trackShopStep("select_model", variant.group.label, { option_id: variant.group.id, product: slug });
    setModelId(variant.group.id);
    setStage("configure");
    writeUrlParams({ model: variant.group.id, kategoria: null });
  }

  function backToCategories() {
    trackShopStep("zaluzje_change_model", selectedGroup?.label || "", {});
    setModelId("");
    setWidthMm(0);
    setCategorySlug("");
    setStage("category");
    writeUrlParams({ model: null, kategoria: null });
  }

  if (loadState === "loading") {
    return (
      <>
        <header>
          <strong>Wyceń żaluzję do swojego okna</strong>
        </header>
        <p className="hero-product-config-hint">Wczytuję ofertę…</p>
      </>
    );
  }
  if (loadState === "error" || !profile) {
    return (
      <>
        <header>
          <strong>Wyceń żaluzję do swojego okna</strong>
        </header>
        <p className="hero-product-config-hint">Nie udało się wczytać oferty. Odśwież stronę lub spróbuj ponownie za chwilę.</p>
        <button type="button" className="plisy-position-add" onClick={() => setRetry((n) => n + 1)}>
          Spróbuj ponownie
        </button>
      </>
    );
  }

  if (stage === "configure" && modelId) {
    return (
      <RoletyConfiguratorPanel
        key={modelId}
        slug={slug}
        initialValues={{ ...(initialValues || {}), fabricGroupId: modelId }}
        submitLabel={submitLabel}
        onSubmit={onSubmit}
        onZoom={onZoom}
        breadcrumb={crumb}
        onChangeModel={backToCategories}
      />
    );
  }

  if ((stage === "width" || stage === "variant") && category) {
    const widthsWithModels = category.widths.filter((entry) => entry.widthMm > 0);
    return (
      <>
        <header>
          <strong>Wyceń żaluzję do swojego okna</strong>
        </header>
        <p className="zl-crumb">
          <span>{category.category}</span>
          {stage === "variant" && width ? <span>{width.widthMm} mm</span> : null}
          <button type="button" onClick={backToCategories}>
            zmień rodzaj
          </button>
        </p>
        <h4 className="zl-step-title">Szerokość lameli</h4>
        <div className="zl-chip-row" role="group" aria-label="Szerokość lameli">
          {widthsWithModels.map((entry) => (
            <button
              key={entry.widthMm}
              type="button"
              className={`zl-chip ${entry.widthMm === widthMm ? "is-active" : ""}`}
              aria-pressed={entry.widthMm === widthMm}
              onClick={() => pickWidth(category, entry)}
            >
              <strong>{entry.widthMm} mm</strong>
              <small>{entry.variants.length === 1 ? "1 wariant" : `${entry.variants.length} warianty`}</small>
            </button>
          ))}
        </div>
        {stage === "variant" && width ? (
          <>
            <h4 className="zl-step-title">Wariant</h4>
            <div className="zl-variant-grid">
              {width.variants.map((variant) => (
                <button key={variant.group.id} type="button" className="zl-variant-card" onClick={() => pickVariant(variant)}>
                  <span
                    className="zl-variant-photo"
                    aria-hidden="true"
                    style={variant.group.imageUrl ? { backgroundImage: `url(${optimizeImageUrl(variant.group.imageUrl, 220)})` } : undefined}
                  />
                  <span className="zl-variant-body">
                    <strong>{variant.group.label}</strong>
                    {zaluzjeVariantNote(variant.tag) ? <span className="zl-variant-note">{zaluzjeVariantNote(variant.tag)}</span> : null}
                    <span className="zl-cat-meta">
                      {variant.startingPrice !== null ? <span className="zl-price">od {formatZl(variant.startingPrice)}</span> : null}
                      <span>{colorCountLabel(variant.group.swatches.length)}</span>
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <p className="hero-product-config-hint">Wybierz szerokość lameli, aby przejść do koloru i wymiarów.</p>
        )}
      </>
    );
  }

  return (
    <>
      <header>
        <strong>Wyceń żaluzję do swojego okna</strong>
      </header>
      <p className="zl-intro">Wybierz rodzaj żaluzji. Potem szerokość lameli, kolor i wymiary.</p>
      <div className="zl-cat-grid">
        {tree.map((entry) => (
          <button key={entry.slug} type="button" className="zl-cat-card" onClick={() => pickCategory(entry)}>
            <span
              className="zl-cat-photo"
              aria-hidden="true"
              style={entry.imageUrl ? { backgroundImage: `url(${optimizeImageUrl(entry.imageUrl, 360)})` } : undefined}
            />
            <span className="zl-cat-body">
              <strong>{entry.category}</strong>
              {entry.description ? <span className="zl-cat-desc">{entry.description}</span> : null}
              <span className="zl-cat-meta">
                {entry.startingPrice !== null ? <span className="zl-price">od {formatZl(entry.startingPrice)}</span> : null}
                <span>{modelCountLabel(entry.modelCount)}</span>
                <span>{colorCountLabel(entry.colorCount)}</span>
              </span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
