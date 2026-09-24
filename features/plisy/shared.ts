// Shared data-fetching + pure helpers for the plisy (pleated blind)
// configurator. Unlike moskitiery-ramkowe/rolety-dachowe (whose real option
// data was pulled once and hardcoded here at build time), plisy's CRM
// profile starts as placeholder content the business owner will keep
// editing directly in the CRM admin ("Sklep WWW (panel)" -> "Konfigurator i
// cenniki siatkowe" -> product_slug "plisy") - so this module fetches it
// live from the same public endpoint the admin panel itself writes to,
// rather than freezing a snapshot that would need a redeploy on every
// content edit. See ConfiguratorPanel.tsx for the step UI that consumes it.
import { optimizeImageUrl } from "@/lib/image-optim";

const CONFIGURATOR_PUBLIC_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop/configurator_public.php";
const PLISY_PRODUCT_SLUG = "plisy";


// Every "Dopłata / rabat" field on a swatch/option in the CRM can be entered
// either as a flat zł amount or as a percent - sign still carries the
// dopłata (positive) vs rabat (negative) meaning either way, only the unit
// changes. See applyPriceDeltas() below for how the two combine.
export type PriceDeltaType = "amount" | "percent";

export type HardwareOption = {
  id: string;
  label: string;
  color: string;
  imageUrl: string;
  priceDelta: number;
  priceDeltaType: PriceDeltaType;
};

export type MountOption = {
  id: string;
  label: string;
  note: string;
  imageUrl: string;
  priceDelta: number;
  priceDeltaType: PriceDeltaType;
};

export type FabricSwatch = {
  id: string;
  code: string;
  label: string;
  color: string;
  imageUrl: string;
  thumbnailUrl: string;
  priceDelta: number;
  priceDeltaType: PriceDeltaType;
};

export type FabricGroup = {
  id: string;
  label: string;
  note: string;
  imageUrl: string;
  swatches: FabricSwatch[];
};

export type PriceTable = {
  id: string;
  name: string;
  hardwareIds: string[];
  fabricGroupIds: string[];
  widthBreakpointsMm: number[];
  heightBreakpointsMm: number[];
  prices: number[][];
};

export type PlisyProfile = {
  productName: string;
  widthMinMm: number;
  widthMaxMm: number;
  widthDefaultMm: number;
  heightMinMm: number;
  heightMaxMm: number;
  heightDefaultMm: number;
  mountOptions: MountOption[];
  hardware: HardwareOption[];
  fabricGroups: FabricGroup[];
  tables: PriceTable[];
  priceAdjustmentPercent: number;
  priceAdjustmentAmount: number;
  startingPrice: number | null;
};

type RawStep = {
  id: string;
  type: string;
  options?: Array<{
    id: string;
    label: string;
    subtitle?: string;
    accent_color?: string;
    image_url?: string;
    price_delta?: number;
    price_delta_type?: string;
  }>;
  groups?: Array<{
    id: string;
    label: string;
    note?: string;
    image_url?: string;
    swatches?: Array<{
      id: string;
      code: string;
      label: string;
      color?: string;
      image_url?: string;
      thumbnail_url?: string;
      price_delta?: number;
      price_delta_type?: string;
    }>;
  }>;
};

type RawProduct = {
  slug: string;
  label: string;
  display_price_amount?: string;
  pricing_calculation: {
    width_field_key: string;
    height_field_key: string;
    default_allegro_profile_id: string;
    allegro_profiles: Array<{ id: string; price_adjustment_percent: number; price_adjustment_amount: number }>;
    tables: Array<{
      id: string;
      name: string;
      hardware_ids: string[];
      fabric_group_ids: string[];
      width_breakpoints: number[];
      height_breakpoints: number[];
      prices: number[][];
    }>;
  };
  configurator: { steps: RawStep[] };
};

function toPriceDeltaType(value: string | undefined): PriceDeltaType {
  return value === "percent" ? "percent" : "amount";
}

/** Fetches the live plisy profile from the CRM's public configurator
 * endpoint. Returns null on any failure or if the profile has no real
 * steps yet (e.g. the placeholder was removed) - callers should show a
 * "przepraszamy, spróbuj ponownie" state rather than a broken configurator.
 * Never throws. */
// Jedno zapytanie na stronę zamiast jednego na komponent: profil ciągnie
// CAŁY katalog konfiguratorów z CRM (~170 kB), a proszą o niego i szybka
// wycena na landingu, i panel konfiguratora. Na dławionym telefonie to były
// dwa razy po ~1 s na łączu, które w tym momencie jest zapchane (pomiar
// 2026-09-24). TTL, żeby zmiany właściciela w CRM nadal pojawiały się bez
// wdrożenia - tylko nie kilka razy w ciągu jednego wejścia.
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
let profileCache: { at: number; value: PlisyProfile | null } | null = null;
let profileInFlight: Promise<PlisyProfile | null> | null = null;

export async function fetchPlisyProfile(): Promise<PlisyProfile | null> {
  if (profileCache && Date.now() - profileCache.at < PROFILE_CACHE_TTL_MS) return profileCache.value;
  if (profileInFlight) return profileInFlight;
  profileInFlight = fetchPlisyProfileUncached()
    .then((value) => {
      // Nieudanej odpowiedzi nie zapamiętujemy - kolejne wejście ma prawo
      // spróbować jeszcze raz.
      if (value) profileCache = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      profileInFlight = null;
    });
  return profileInFlight;
}

async function fetchPlisyProfileUncached(): Promise<PlisyProfile | null> {
  try {
    const response = await fetch(CONFIGURATOR_PUBLIC_URL, { cache: "no-store" });
    const json = (await response.json()) as {
      ok: boolean;
      config?: { catalog?: { categories?: Array<{ products?: RawProduct[] }> } };
    };
    if (!json.ok || !json.config) return null;
    const categories = json.config.catalog?.categories || [];
    const product = categories.flatMap((category) => category.products || []).find((entry) => entry.slug === PLISY_PRODUCT_SLUG);
    if (!product) return null;

    const steps = product.configurator?.steps || [];
    const mountStep = steps.find((step) => step.type === "choice" && step.id === "step-mount");
    const hardwareStep = steps.find((step) => step.type === "choice" && step.id === "step-hardware");
    const fabricStep = steps.find((step) => step.type === "fabric");
    const dimensionsStep = steps.find((step) => step.type === "dimensions") as
      | (RawStep & {
          width_placeholder?: string;
          height_placeholder?: string;
        })
      | undefined;

    const mountOptions: MountOption[] = (mountStep?.options || []).map((option) => ({
      id: option.id,
      label: option.label,
      note: option.subtitle || "",
      imageUrl: option.image_url || "",
      priceDelta: Number(option.price_delta) || 0,
      priceDeltaType: toPriceDeltaType(option.price_delta_type),
    }));

    const hardware: HardwareOption[] = (hardwareStep?.options || []).map((option) => ({
      id: option.id,
      label: option.label,
      color: option.accent_color || "#E2E8F0",
      imageUrl: option.image_url || "",
      priceDelta: Number(option.price_delta) || 0,
      priceDeltaType: toPriceDeltaType(option.price_delta_type),
    }));

    const fabricGroups: FabricGroup[] = (fabricStep?.groups || []).map((group) => ({
      id: group.id,
      label: group.label,
      note: group.note || "",
      imageUrl: group.image_url || "",
      swatches: (group.swatches || []).map((swatch) => ({
        id: swatch.id,
        code: swatch.code,
        label: swatch.label,
        color: swatch.color || "#E2E8F0",
        imageUrl: swatch.image_url || "",
        thumbnailUrl: swatch.thumbnail_url || swatch.image_url || "",
        priceDelta: Number(swatch.price_delta) || 0,
        priceDeltaType: toPriceDeltaType(swatch.price_delta_type),
      })),
    }));

    const tables: PriceTable[] = (product.pricing_calculation?.tables || []).map((table) => ({
      id: table.id,
      name: table.name,
      hardwareIds: table.hardware_ids || [],
      fabricGroupIds: table.fabric_group_ids || [],
      widthBreakpointsMm: table.width_breakpoints || [],
      heightBreakpointsMm: table.height_breakpoints || [],
      prices: table.prices || [],
    }));

    const allegroProfiles = product.pricing_calculation?.allegro_profiles || [];
    const defaultProfile =
      allegroProfiles.find((entry) => entry.id === product.pricing_calculation?.default_allegro_profile_id) || allegroProfiles[0];

    const widthField = dimensionsStep as unknown as {
      width_placeholder?: string;
      height_placeholder?: string;
    };

    const startingPrice = product.display_price_amount ? Number(product.display_price_amount) : null;

    // Real bounds come off the price matrix itself: the smallest and largest
    // breakpoint any table knows (400-2100 x 600-2300 mm today). The old
    // generic 200-3000 mm range let a 25 cm or 250 cm plisa pass validation
    // with no price row behind it, and told a customer who typed "60" (cm,
    // as the ad says) only "zakres 200-3000 mm" - plisy landing analysis
    // 2026-09-17. Generic fallback kept only for an empty matrix.
    // Owner's production limits (2026-09-17): 20-150 cm wide, 20-230 cm
    // high. Sizes under the matrix's first breakpoint price as that first
    // column (resolvePriceBreakpointIndex rounds up), so a 20 cm plisa
    // costs the same as a 40 cm one - the CRM accepts 200-3000 mm.
    return {
      productName: product.label || "Plisy",
      widthMinMm: PLISY_WIDTH_MIN_MM,
      widthMaxMm: PLISY_WIDTH_MAX_MM,
      widthDefaultMm: Number(widthField?.width_placeholder?.replace(/\D/g, "")) || 900,
      heightMinMm: PLISY_HEIGHT_MIN_MM,
      heightMaxMm: PLISY_HEIGHT_MAX_MM,
      heightDefaultMm: Number(widthField?.height_placeholder?.replace(/\D/g, "")) || 1200,
      mountOptions,
      hardware,
      fabricGroups,
      tables,
      priceAdjustmentPercent: Number(defaultProfile?.price_adjustment_percent) || 0,
      priceAdjustmentAmount: Number(defaultProfile?.price_adjustment_amount) || 0,
      startingPrice: Number.isFinite(startingPrice) ? startingPrice : null,
    };
  } catch {
    return null;
  }
}

// Same masked-gradient-surface swatch preview technique used by every other
// configurator in this shop (moskitiery-ramkowe/shared.ts,
// rolety-dachowe/shared.ts) - ported here rather than imported so this
// feature stays self-contained and safe to delete/replace independently.
export function plNormalizeHexColor(value: string, fallback = "#1F2937"): string {
  const normalized = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function plHexToRgb(hex: string) {
  const normalized = plNormalizeHexColor(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

export function plShiftHex(hex: string, amount: number): string {
  const rgb = plHexToRgb(hex);
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value + amount)));
  return `#${[clamp(rgb.r), clamp(rgb.g), clamp(rgb.b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

/**
 * Every swatch here (hardware color AND fabric color alike) is a real
 * photo of that specific option, not a generic tileable texture - so this
 * shows the photo directly as a background-image, gradient-only fallback
 * when there's no image yet. An earlier version rendered these through a
 * CSS `mask-image` (the photo used as a shape mask over a color gradient)
 * for a "die-cut swatch icon" look, which made real photographic swatches
 * render as an almost-flat, luminance-tinted gradient instead of the
 * actual fabric/texture in the photo (confirmed live 2026-09-08, right
 * after the first batch of real Classic fabric photos went in) - and even
 * disappeared entirely in some browsers for the hardware swatches this
 * function originally covered. Direct background-image has neither
 * problem.
 */
export function buildPlisyHardwareSwatchStyle(imageUrl: string, accentColor: string) {
  const normalizedColor = plNormalizeHexColor(accentColor, "#D8DEE3");
  const fallback = `linear-gradient(135deg, ${normalizedColor} 0%, ${plShiftHex(normalizedColor, -22)} 100%)`;
  if (!imageUrl) {
    return { backgroundImage: fallback } as const;
  }

  return {
    backgroundImage: `url(${optimizeImageUrl(imageUrl, 360)})`,
  } as const;
}

function plRoundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Ceiling lookup: the first breakpoint >= size, clamped to the last one if
 * size exceeds every breakpoint - same rule as every other matrix-priced
 * product in this shop. */
export function resolvePriceBreakpointIndex(size: number, breakpoints: number[]): number | null {
  if (!Number.isFinite(size) || size <= 0 || !breakpoints.length) return null;
  for (let index = 0; index < breakpoints.length; index += 1) {
    if (size <= breakpoints[index]) return index;
  }
  return breakpoints.length - 1;
}

/** Picks the most specific matching table for a given hardware/fabric-group
 * pair: a table with an empty hardware_ids/fabric_group_ids list is a
 * wildcard (matches anything), so an exact match on either axis is
 * preferred over a wildcard on that axis. Placeholder data ships with a
 * single fully-wildcard table (matches every combination) precisely so the
 * mechanism is testable before real per-option tables exist. */
export function findPricingTable(tables: PriceTable[], hardwareId: string, fabricGroupId: string): PriceTable | null {
  const candidates = tables.filter(
    (table) =>
      (table.hardwareIds.length === 0 || table.hardwareIds.includes(hardwareId)) &&
      (table.fabricGroupIds.length === 0 || table.fabricGroupIds.includes(fabricGroupId)),
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => {
    const specificityA = (a.hardwareIds.length > 0 ? 1 : 0) + (a.fabricGroupIds.length > 0 ? 1 : 0);
    const specificityB = (b.hardwareIds.length > 0 ? 1 : 0) + (b.fabricGroupIds.length > 0 ? 1 : 0);
    return specificityB - specificityA;
  });
  return candidates[0];
}

export function calcPlisyPrice(
  profile: PlisyProfile,
  widthMm: number,
  heightMm: number,
  hardwareId: string,
  fabricGroupId: string,
): number | null {
  const table = findPricingTable(profile.tables, hardwareId, fabricGroupId);
  if (!table) return null;
  const widthIndex = resolvePriceBreakpointIndex(widthMm, table.widthBreakpointsMm);
  const heightIndex = resolvePriceBreakpointIndex(heightMm, table.heightBreakpointsMm);
  if (widthIndex === null || heightIndex === null) return null;
  const matrixPrice = table.prices[heightIndex]?.[widthIndex];
  if (typeof matrixPrice !== "number" || !Number.isFinite(matrixPrice) || matrixPrice <= 0) return null;
  return plRoundMoney(
    Math.max(0, matrixPrice * (1 + profile.priceAdjustmentPercent / 100) + profile.priceAdjustmentAmount),
  );
}

type PriceDeltaLike = { priceDelta: number; priceDeltaType: PriceDeltaType } | null | undefined;

/**
 * Applies every selected option's dopłata/rabat to a base price, in the
 * fixed order the business owner asked for: the table price first, then
 * every flat-amount delta added on top (a negative one being a "rabat
 * kwotowy"), and only at the very end every percent delta combined into one
 * multiplier - two "+5%" deltas together mean "+10% of the amount-adjusted
 * price", not one +5% compounding on the other's result.
 */
export function applyPriceDeltas(baseAmount: number, deltas: PriceDeltaLike[]): number {
  let amountSum = 0;
  let percentSum = 0;
  for (const delta of deltas) {
    if (!delta || !Number.isFinite(delta.priceDelta) || delta.priceDelta === 0) continue;
    if (delta.priceDeltaType === "percent") {
      percentSum += delta.priceDelta;
    } else {
      amountSum += delta.priceDelta;
    }
  }
  return plRoundMoney(Math.max(0, (baseAmount + amountSum) * (1 + percentSum / 100)));
}

/** "+X zł" / "-X zł" / "+X%" / "-X%" badge text for a single option's
 * dopłata/rabat, or null when there's nothing worth showing (delta is 0). */
export function formatPriceDeltaBadge(priceDelta: number, priceDeltaType: PriceDeltaType): string | null {
  if (!Number.isFinite(priceDelta) || priceDelta === 0) return null;
  const sign = priceDelta > 0 ? "+" : "-";
  const magnitude = Math.abs(priceDelta);
  if (priceDeltaType === "percent") {
    return `${sign}${magnitude.toLocaleString("pl-PL", { maximumFractionDigits: 2 })}%`;
  }
  return `${sign}${magnitude.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

export type ConfiguratorInitialValues = {
  mountId?: string;
  bracketColorId?: string;
  hardwareId?: string;
  fabricGroupId?: string;
  fabricId?: string;
  widthMm?: number;
  heightMm?: number;
  qty?: number;
  /** /koszyk's "Edytuj pozycję" fallback for when the caller only has the
   * cart item's stored LABELS, not ids (plisy's option data is fetched live
   * from the CRM - unlike moskitiery-ramkowe/rolety-dachowe there's no
   * static label->id lookup table to resolve ids before mount). Matched
   * against the live profile once it loads - see the label-resolution
   * effect in ConfiguratorPanel.tsx. Ignored once the matching *Id above is
   * already given. */
  mountLabel?: string;
  hardwareLabel?: string;
  fabricGroupLabel?: string;
  fabricLabel?: string;
};

/** Owner rules, 2026-09-16:
 *  - width above 150 cm ships as an oversized parcel (same one-time
 *    surcharge tiers as moskitiery ramkowe; the cart charges the highest
 *    tier once per order - see lib/cart.ts cartOversizeSurcharge);
 *  - above 110 cm (single fabrics) / 90 cm (DUO honeycomb) the customer
 *    has to accept that the top rail may sag slightly under the fabric's
 *    weight - cosmetic, not functional;
 *  - the non-invasive mount ("Bezinwazyjny") comes in three bracket
 *    colours chosen in a sub-step right after the rail colour. */
/** Production limits, owner 2026-09-17: "szerokość 20-150 cm, wysokość
 * 20-230 cm". Every size input on the plisy landing (quick price, the
 * collection comparison, the configurator) reads these off the profile. */
export const PLISY_WIDTH_MIN_MM = 200;
export const PLISY_WIDTH_MAX_MM = 1500;
export const PLISY_HEIGHT_MIN_MM = 200;
export const PLISY_HEIGHT_MAX_MM = 2300;
export const PLISY_OVERSIZE_WIDTH_MM = 1500;
export const PLISY_OVERSIZE_TIER_2_MM = 2000;
export const PLISY_OVERSIZE_TIER_1_AMOUNT = 19.9;
export const PLISY_OVERSIZE_TIER_2_AMOUNT = 29;
export function plisyOversizeSurcharge(widthMm: number): number {
  if (!Number.isFinite(widthMm) || widthMm <= PLISY_OVERSIZE_WIDTH_MM) return 0;
  return widthMm <= PLISY_OVERSIZE_TIER_2_MM ? PLISY_OVERSIZE_TIER_1_AMOUNT : PLISY_OVERSIZE_TIER_2_AMOUNT;
}
export const PLISY_SAG_WIDTH_SINGLE_MM = 1100;
export const PLISY_SAG_WIDTH_DUO_MM = 900;
export function plisySagWarningWidthMm(fabricGroupId: string): number {
  return /duo/i.test(String(fabricGroupId || "")) ? PLISY_SAG_WIDTH_DUO_MM : PLISY_SAG_WIDTH_SINGLE_MM;
}
export function isPlisyMountNonInvasive(mountIdOrLabel: string | null | undefined): boolean {
  return /bezinwazyjn/i.test(String(mountIdOrLabel || ""));
}

// Nazwy montażu widoczne dla klienta (audyt landingu plis, P2 #9). W CRM
// opcje nazywają się "STANDARD" i "Bezinwazyjny" - to skrót warsztatowy:
// klientowi nie mówi nic o tym, co się dzieje z jego oknem, a "STANDARD"
// nie pada ani w instrukcji montażu, ani w opisie produktu. Zmieniamy samą
// ETYKIETĘ (konfigurator, koszyk, zlecenie produkcji); id opcji, cennik i
// dane w CRM zostają nietknięte, a findPlisyMountByLabel() rozpoznaje
// jeszcze starą nazwę, żeby "Edytuj pozycję" dla koszyka sprzed zmiany
// dalej trafiało we właściwy montaż.
type MountDisplay = { label: string; short: string; note: string };
const PLISY_MOUNT_DISPLAY: Array<{ match: RegExp; display: MountDisplay }> = [
  {
    match: /bezinwazyjn/i,
    display: {
      label: "Bezinwazyjny (bez wiercenia)",
      short: "Sztywne uchwyty montażowe zaciskane na ramie okna",
      note: "Uchwyty zakładane na krawędź skrzydła — bez wiercenia i bez śladu. Mierzysz inaczej niż przy montażu przykręcanym: szerokość od kreseczki do kreseczki, wysokość całego skrzydła.",
    },
  },
  {
    match: /.*/,
    display: {
      label: "Przykręcany do listwy przyszybowej",
      short: "Klasyczny typ montażu",
      note: "Cztery uchwyty wkręcane w listwy przyszybowe — wkręty wchodzą w PCV, wiertarka nie jest potrzebna. Mierzysz w świetle szyby: od połowy uszczelki do połowy uszczelki.",
    },
  },
];

function plisyMountDisplay(option: { id?: string; label?: string } | null | undefined): MountDisplay | null {
  if (!option) return null;
  const key = `${option.id || ""} ${option.label || ""}`;
  return PLISY_MOUNT_DISPLAY.find((entry) => entry.match.test(key))?.display || null;
}

/** Nazwa montażu pokazywana klientowi i zapisywana w koszyku/zamówieniu. */
export function plisyMountLabel(option: { id?: string; label?: string } | null | undefined): string {
  return plisyMountDisplay(option)?.label || String(option?.label || "");
}

/** Jedna linijka pod nazwą montażu na kafelku wyboru. */
export function plisyMountShortNote(option: { id?: string; label?: string } | null | undefined): string {
  return plisyMountDisplay(option)?.short || "";
}

/** Pełny opis montażu - własny, bo opis z CRM przy STANDARD straszy
 * "wymaga wiercenia w ramie skrzydła", a wkręty wchodzą w listwę
 * przyszybową i wiertarka nie jest potrzebna (instrukcja montażu). */
export function plisyMountNote(option: (MountOption & { note?: string }) | null | undefined): string {
  return plisyMountDisplay(option)?.note || String(option?.note || "");
}

/** Odnajduje montaż po etykiecie zapisanej w koszyku - nowej albo starej. */
export function findPlisyMountByLabel(options: MountOption[], storedLabel: string): MountOption | null {
  const wanted = String(storedLabel || "").trim().toLowerCase();
  if (!wanted) return null;
  return (
    options.find((option) => option.label.trim().toLowerCase() === wanted) ||
    options.find((option) => plisyMountLabel(option).trim().toLowerCase() === wanted) ||
    null
  );
}
export type BracketColor = { id: string; label: string; color: string };
export const PLISY_BRACKET_COLORS: BracketColor[] = [
  { id: "bialy", label: "Biały", color: "#f4f4f1" },
  { id: "jasny-braz", label: "Jasny brąz", color: "#b98b5e" },
  { id: "ciemny-braz", label: "Ciemny brąz", color: "#4a3123" },
];
/** Cart/CRM label: "Bezinwazyjny · uchwyty: Jasny brąz". Split back with
 * splitPlisyMountLabel() when /koszyk re-opens the configurator. */
export const PLISY_BRACKET_LABEL_SEP = " · uchwyty: ";
export function joinPlisyMountLabel(mountLabel: string, bracketLabel: string | undefined): string {
  return bracketLabel ? `${mountLabel}${PLISY_BRACKET_LABEL_SEP}${bracketLabel}` : mountLabel;
}
export function splitPlisyMountLabel(label: string | undefined): { mountLabel: string; bracketLabel: string } {
  const raw = String(label || "");
  const at = raw.indexOf(PLISY_BRACKET_LABEL_SEP);
  return at < 0 ? { mountLabel: raw, bracketLabel: "" } : { mountLabel: raw.slice(0, at), bracketLabel: raw.slice(at + PLISY_BRACKET_LABEL_SEP.length) };
}

export type ConfiguratorResult = {
  mountId: string;
  mountLabel: string;
  /** Non-invasive mount only - the bracket colour sub-step. */
  bracketColorId: string;
  bracketColorLabel: string;
  /** One-time oversized-parcel surcharge this position's width requires
   * (0 for widths up to 150 cm) - the cart charges the highest one once. */
  oversizeSurchargeAmount: number;
  hardwareId: string;
  hardwareLabel: string;
  fabricGroupId: string;
  fabricGroupLabel: string;
  fabricId: string;
  fabricLabel: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  /** Real hex colours of the chosen fabric/hardware - carried through to the
   * cart (see lib/cart.ts's CartLineItem) so /koszyk can render the same
   * tinted PlisaPreview thumbnail as the configurator, instead of a plain/
   * blank icon. */
  fabricColor: string;
  hardwareColor: string;
};
