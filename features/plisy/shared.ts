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
export async function fetchPlisyProfile(): Promise<PlisyProfile | null> {
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

    return {
      productName: product.label || "Plisy",
      // Bounds aren't threaded through configurator_public.php's dimensions
      // step today (only label/placeholder), so a sane generic range is
      // used here - matches the same 200-2300mm range every non-mosquito
      // product in this shop already enforces (see e.g.
      // ROLETY_DACHOWE_MIN/MAX_DIMENSION_MM).
      widthMinMm: 200,
      widthMaxMm: 3000,
      widthDefaultMm: Number(widthField?.width_placeholder?.replace(/\D/g, "")) || 900,
      heightMinMm: 200,
      heightMaxMm: 3000,
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

export type ConfiguratorResult = {
  mountId: string;
  mountLabel: string;
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
