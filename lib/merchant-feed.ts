// Warianty katalogu Google Merchant Center z cenami (30.10.2026) - serwer.
// Używają go /feeds/google-merchant.xml i strony wariantów
// (/rolety-dachowe/okno/..., /plisy-dachowe/okno/..., /plisy/wymiar/...,
// /moskitiery-ramkowe/wymiar/...).
//
// Cena wariantu = dokładnie to, co pokazuje szybka wycena na stronie po
// wejściu z linku (Google odrzuca produkt, gdy cena na stronie docelowej
// różni się od ceny w katalogu). Te same funkcje i dane co konfiguratory:
//  - rolety dachowe: RoofQuickPrice - pierwszy kolor osprzętu, DEKO albo
//    TERMO, cena z macierzy dla wymiaru rolety z biblioteki okien,
//    × „Korekta ceny (%)” (rolety-dachowe / roleta-dachowa-dekolux);
//  - plisy dachowe: PdQuickPrice - pdCheapestPriceForSize w kolekcji
//    Klasyczne, × korekta plisy-dachowe;
//  - plisy okienne: plisyQuickPrice (landing v2) - Klasyczne, pierwszy
//    kolor listew, montaż STANDARD, × korekta plisy;
//  - moskitiery ramkowe: rozpoczęte mb obwodu × stawka za mb z korektą.
// Promocja CAŁY DOM dotyczy 2+ sztuk, więc cena 1 sztuki jej nie zawiera.
import { SHOP_URL, fetchPriceAdjustments, getPricedCatalog, type PricedCatalogProduct } from "@/lib/agent-catalog";
import {
  MOSKITIERY_FEED_SIZES_CM,
  PLISY_FEED_SIZES_CM,
  roofWindowPathKey,
  roofWindowTitleLabel,
  sizeKey,
  type RoofMaterialKey,
} from "@/lib/merchant-variants";
import { MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO, moskBilledMeters, moskPerimeterMeters } from "@/features/moskitiery-ramkowe/shared";
import { fetchPlisyProfileWith, plisyQuickPrice, type PlisyProfile } from "@/features/plisy/shared";
import { pdCheapestPriceForSize, pdSizeLimits, PD_MIN_DIMENSION_MM } from "@/features/plisy-dachowe/shared";
import {
  calcRoletyDachowePrice,
  parseRoofBlindProfile,
  roofBlindSizeLimits,
  ROLETY_DACHOWE_MIN_DIMENSION_MM,
  ROOF_BLIND_PROFILE_URL,
  ROOF_BLIND_SOURCE_SLUG,
  type RawProduct,
  type RoofBlindProfile,
} from "@/features/rolety-dachowe/shared";
import {
  normalizeRoofWindowLibraryItem,
  resolveRoofWindowDimensions,
  ROOF_WINDOW_LIBRARY_ENDPOINT,
  type RoofWindowLibraryItem,
} from "@/features/rolety-dachowe/roof-window-library";

const REVALIDATE_SECONDS = 3600;

export type MerchantVariant = {
  /** Produkt bazowy z agent-catalog (dostawa, kategorie, zdjęcia). */
  base: PricedCatalogProduct;
  id: string;
  groupId: string;
  title: string;
  /** Krótka nazwa wariantu do tytułu strony i okruszków. */
  shortTitle: string;
  description: string;
  path: string;
  url: string;
  price: number;
  /** g:size - model okna albo wymiar. */
  size: string;
  material: string;
  /** Opis ceny w danych strukturalnych strony wariantu. */
  priceNote: string;
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { next: { revalidate: REVALIDATE_SECONDS }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function fetchRoofProfileServer(): Promise<RoofBlindProfile | null> {
  const json = await fetchJson<{ ok?: boolean; config?: { catalog?: { categories?: Array<{ products?: RawProduct[] }> } } }>(ROOF_BLIND_PROFILE_URL);
  const product = (json?.config?.catalog?.categories || []).flatMap((category) => category.products || []).find((entry) => entry.slug === ROOF_BLIND_SOURCE_SLUG);
  return json?.ok && product ? parseRoofBlindProfile(product) : null;
}

async function fetchRoofLibraryServer(): Promise<RoofWindowLibraryItem[]> {
  const json = await fetchJson<{ ok?: boolean; data?: { items?: unknown[] } }>(ROOF_WINDOW_LIBRARY_ENDPOINT);
  const items = Array.isArray(json?.data?.items) ? json!.data!.items! : [];
  return items.map(normalizeRoofWindowLibraryItem).filter((item): item is RoofWindowLibraryItem => Boolean(item && item.id > 0));
}

/** Ten sam wzór co applyPriceAdjustment z lib/price-adjustment.ts (tamten
 * moduł ma hook Reacta, więc nie wolno go importować na serwerze). */
function applyPriceAdjustment(amount: number, percent: number): number {
  if (!Number.isFinite(amount) || !percent) return amount;
  return Math.round(Math.max(0, amount * (1 + percent / 100)) * 100) / 100;
}

function plnText(value: number): string {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
}

function firstAdjustment(slugs: string[], adjustments: Record<string, number>): number {
  return slugs.map((slug) => adjustments[slug] || 0).find((value) => value !== 0) || 0;
}

/** Okna z biblioteki bez duplikatów (ten sam producent + model). */
function uniqueWindows(library: RoofWindowLibraryItem[]): RoofWindowLibraryItem[] {
  const seen = new Set<string>();
  const out: RoofWindowLibraryItem[] = [];
  const sorted = [...library].sort((a, b) => Number(b.is_certain) - Number(a.is_certain) || a.id - b.id);
  for (const item of sorted) {
    const key = `${item.producer_name} ${item.window_model}`.toLowerCase().replace(/\s+/g, " ").trim();
    if (!item.window_model || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.sort((a, b) => a.producer_name.localeCompare(b.producer_name, "pl") || a.window_model.localeCompare(b.window_model, "pl", { numeric: true }));
}

const RD_MATERIALS: Array<{ key: RoofMaterialKey; materialId: string; label: string; titleLead: string; descLead: string }> = [
  {
    key: "deko",
    materialId: "polprzepuszczalny",
    label: "DEKO półprzepuszczalna",
    titleLead: "Roleta półprzepuszczalna DEKO",
    descLead: "Roleta półprzepuszczalna DEKO (rozprasza światło, 54 kolory)",
  },
  {
    key: "termo",
    materialId: "termo",
    label: "TERMO zaciemniająca",
    titleLead: "Roleta zaciemniająca TERMO",
    descLead: "Roleta zaciemniająca TERMO (blackout z warstwą termiczną od strony szyby, 19 kolorów)",
  },
];

function roofVariants(
  rdBase: PricedCatalogProduct,
  pdBase: PricedCatalogProduct,
  roofProfile: RoofBlindProfile | null,
  plisyProfile: PlisyProfile | null,
  library: RoofWindowLibraryItem[],
  adjustments: Record<string, number>,
): MerchantVariant[] {
  const out: MerchantVariant[] = [];
  const windows = uniqueWindows(library);
  const rdAdjust = firstAdjustment(rdBase.adjustmentSlugs, adjustments);
  const pdAdjust = adjustments["plisy-dachowe"] || 0;
  if (roofProfile) {
    const limits = roofBlindSizeLimits(roofProfile);
    const hardwareId = roofProfile.hardware[0]?.id || "bialy";
    for (const item of windows) {
      const dims = resolveRoofWindowDimensions(item);
      const inRange =
        dims.widthMm >= ROLETY_DACHOWE_MIN_DIMENSION_MM && dims.widthMm <= limits.maxWidthMm && dims.heightMm >= ROLETY_DACHOWE_MIN_DIMENSION_MM && dims.heightMm <= limits.maxHeightMm;
      if (!inRange) continue;
      const label = roofWindowTitleLabel(item);
      for (const material of RD_MATERIALS) {
        if (!roofProfile.materialTypes.some((option) => option.id === material.materialId)) continue;
        const price = calcRoletyDachowePrice(roofProfile.tables, dims.widthMm, dims.heightMm, hardwareId, material.materialId, rdAdjust);
        if (price === null) continue;
        const path = `/rolety-dachowe/okno/${roofWindowPathKey(item, material.key)}`;
        out.push({
          base: rdBase,
          id: `RD-${item.id}-${material.key.toUpperCase()}`,
          groupId: "KEIKA-RD-OKNA",
          title: `${material.titleLead} do okna dachowego ${label} - KEIKA`,
          shortTitle: `${material.titleLead} do okna dachowego ${label}`,
          description: `${material.descLead} do okna dachowego ${label}, wymiar rolety ${dims.widthMm} × ${dims.heightMm} mm. Aluminiowa kaseta z bocznymi prowadnicami, mechanizm sprężynowy z hamulcem - zatrzymasz ją w dowolnym miejscu. Montaż do skrzydła okna wkrętami z kompletu. Produkujemy na zamówienie w Szczecinku, 5 lat gwarancji, 30 dni na zwrot.`,
          path,
          url: SHOP_URL + path,
          price,
          size: label,
          material: material.label,
          priceNote: `okno ${label}, tkanina ${material.label}, osprzęt biały`,
        });
      }
    }
  }
  if (plisyProfile) {
    const limits = pdSizeLimits(plisyProfile);
    const groupId = plisyProfile.fabricGroups[0]?.id || "";
    const groupLabel = plisyProfile.fabricGroups[0]?.label || "Klasyczne";
    for (const item of windows) {
      const dims = resolveRoofWindowDimensions(item);
      const inRange = dims.widthMm >= PD_MIN_DIMENSION_MM && dims.widthMm <= limits.maxWidthMm && dims.heightMm >= PD_MIN_DIMENSION_MM && dims.heightMm <= limits.maxHeightMm;
      if (!inRange || !groupId) continue;
      const price = pdCheapestPriceForSize(plisyProfile, dims.widthMm, dims.heightMm, pdAdjust, groupId);
      if (price === null) continue;
      const label = roofWindowTitleLabel(item);
      const path = `/plisy-dachowe/okno/${roofWindowPathKey(item)}`;
      out.push({
        base: pdBase,
        id: `PD-${item.id}`,
        groupId: "KEIKA-PD-OKNA",
        title: `Plisa do okna dachowego ${label} z prowadnicami - KEIKA`,
        shortTitle: `Plisa do okna dachowego ${label}`,
        description: `Plisa do okna dachowego ${label} z aluminiowymi prowadnicami bocznymi, wymiar plisy ${dims.widthMm} × ${dims.heightMm} mm. Tkanina zostaje w płaszczyźnie okna przy każdym nachyleniu, obie belki ustawisz w dowolnym miejscu. Cena w kolekcji ${groupLabel} z osprzętem białym; do wyboru ok. 150 tkanin w 5 kolekcjach (także zaciemniające i DUO TERMO). Produkujemy na zamówienie w Szczecinku, 5 lat gwarancji, 30 dni na zwrot.`,
        path,
        url: SHOP_URL + path,
        price,
        size: label,
        material: `kolekcja ${groupLabel}`,
        priceNote: `okno ${label}, kolekcja ${groupLabel}, osprzęt biały`,
      });
    }
  }
  return out;
}

function plisyVariants(base: PricedCatalogProduct, profile: PlisyProfile | null, adjustments: Record<string, number>): MerchantVariant[] {
  if (!profile) return [];
  const adjust = adjustments.plisy || 0;
  const mount = profile.mountOptions[0] || null;
  const groupLabel = profile.fabricGroups[0]?.label || "Klasyczne";
  const out: MerchantVariant[] = [];
  for (const [widthCm, heightCm] of PLISY_FEED_SIZES_CM) {
    const price = plisyQuickPrice(profile, widthCm * 10, heightCm * 10, adjust, mount);
    if (price === null) continue;
    const key = sizeKey(widthCm, heightCm);
    const path = `/plisy/wymiar/${key}`;
    out.push({
      base,
      id: `PL-${key}`,
      groupId: "KEIKA-PL-WYMIARY",
      title: `Plisa okienna ${widthCm}×${heightCm} cm, regulacja góra-dół - KEIKA`,
      shortTitle: `Plisa okienna ${widthCm} × ${heightCm} cm`,
      description: `Plisa okienna ${widthCm} × ${heightCm} cm od producenta, regulacja z góry i z dołu. Cena w kolekcji ${groupLabel} z montażem przykręcanym do listwy; do wyboru ok. 150 tkanin w 5 kolekcjach (od przepuszczających światło po zaciemniające DUO TERMO) i montaż bez wiercenia. Wymiar zmienisz w konfiguratorze co do centymetra. Darmowa dostawa, 5 lat gwarancji, 30 dni na zwrot.`,
      path,
      url: SHOP_URL + path,
      price,
      size: `${widthCm}×${heightCm} cm`,
      material: `kolekcja ${groupLabel}`,
      priceNote: `plisa ${widthCm} × ${heightCm} cm, kolekcja ${groupLabel}, montaż ${mount?.label || "STANDARD"}`,
    });
  }
  return out;
}

function moskitieryVariants(base: PricedCatalogProduct, adjustments: Record<string, number>): MerchantVariant[] {
  const perMb = applyPriceAdjustment(MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO, adjustments["moskitiery-ramkowe"] || 0);
  return MOSKITIERY_FEED_SIZES_CM.map(([widthCm, heightCm]) => {
    const billed = moskBilledMeters(moskPerimeterMeters(widthCm * 10, heightCm * 10));
    const price = Math.round(billed * perMb * 100) / 100;
    const key = sizeKey(widthCm, heightCm);
    const path = `/moskitiery-ramkowe/wymiar/${key}`;
    return {
      base,
      id: `MR-${key}`,
      groupId: "KEIKA-MR-WYMIARY",
      title: `Moskitiera ramkowa ${widthCm}×${heightCm} cm do okna, bez wiercenia - KEIKA`,
      shortTitle: `Moskitiera ramkowa ${widthCm} × ${heightCm} cm`,
      description: `Moskitiera ramkowa ${widthCm} × ${heightCm} cm do okna PCV lub drewnianego: aluminiowa rama, wzmocniona siatka z włókna szklanego (szara lub czarna), 7 kolorów profili w tej samej cenie, montaż na zaczepy sprężynowe bez wiercenia. Cena za ${billed} mb obwodu (${plnText(perMb)} za rozpoczęty metr). Wymiar zmienisz w wycenie co do milimetra. 5 lat gwarancji, 30 dni na zwrot.`,
      path,
      url: SHOP_URL + path,
      price,
      size: `${widthCm}×${heightCm} cm`,
      material: "aluminium, siatka z włókna szklanego",
      priceNote: `moskitiera ${widthCm} × ${heightCm} cm (${billed} mb obwodu)`,
    };
  });
}

export type MerchantCatalog = { products: PricedCatalogProduct[]; variants: MerchantVariant[] };

/** Produkty ogólne „na wymiar” + wszystkie warianty z cenami. */
export async function getMerchantCatalog(): Promise<MerchantCatalog> {
  const [products, adjustments, roofProfile, plisyProfile, library] = await Promise.all([
    getPricedCatalog(),
    fetchPriceAdjustments(),
    fetchRoofProfileServer(),
    fetchPlisyProfileWith({ next: { revalidate: REVALIDATE_SECONDS } }),
    fetchRoofLibraryServer(),
  ]);
  const bySlug = (slug: string) => products.find((product) => product.slug === slug)!;
  const variants = [
    ...roofVariants(bySlug("rolety-dachowe"), bySlug("plisy-dachowe"), roofProfile, plisyProfile, library, adjustments),
    ...plisyVariants(bySlug("plisy"), plisyProfile, adjustments),
    ...moskitieryVariants(bySlug("moskitiery-ramkowe"), adjustments),
  ];
  return { products, variants };
}

/** Wariant dla strony /…/okno/… albo /…/wymiar/… (null = brak takiego). */
export async function findMerchantVariant(path: string): Promise<MerchantVariant | null> {
  const { variants } = await getMerchantCatalog();
  return variants.find((variant) => variant.path === path) || null;
}
