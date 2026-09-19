// Shared data + pure helpers for the plisy-dachowe (roof-window pleated
// blind) configurator - used by the landing (app/home-client.tsx), the panel
// (ConfiguratorPanel.tsx) and the cart's "Edytuj pozycję" modal.
//
// Owner, 2026-09-19: "ze starej strony potrzebujesz tylko swatchy osprzętu -
// tkaniny takie same jak przy plisach okiennych. Cena liczona tak samo ale
// dla okien dachowych przemnażana *1,25. Wymiary analogicznie do rolet
// dachowych - biblioteka okien i cały mechanizm." So:
//  - fabrics + price tables = the LIVE plisy profile (features/plisy/shared.ts,
//    fetchPlisyProfile) - the owner keeps editing them in one place;
//  - hardware = the four roof-plisa finishes of the old WordPress shop
//    (Biały / Anoda / Brąz / Sosna, their "H" guide-rail swatches copied to
//    public/plisy-dachowe/). Their dopłata follows the plisy profile's option
//    of the same id (anoda +9 %, sosna +18 % today) - "cena liczona tak samo";
//  - price = plisy price (matrix x Korekta, + dopłaty osprzętu/tkaniny)
//    x 1,25, rounded to grosze;
//  - the window step (library / nameplate photo / missing-model form) is
//    the rolety-dachowe one (features/rolety-dachowe/roof-window-library.ts).
import {
  applyPriceDeltas,
  calcPlisyPrice,
  plisyOversizeSurcharge,
  type FabricSwatch,
  type PlisyProfile,
  type PriceDeltaType,
} from "@/features/plisy/shared";
import type { MissingModelRequest } from "@/features/rolety-dachowe/shared";

export type { MissingModelRequest };

export const PD_PRODUCT_SLUG = "plisy-dachowe";
export const PD_PRODUCT_LABEL = "Plisy dachowe";
/** Roof-window plisa = window plisa price + 25 % (owner, 2026-09-19). */
export const PD_PRICE_MULTIPLIER = 1.25;
/** Manual "Wymiar A / B" floor; the ceiling is the plisy price matrix. */
export const PD_MIN_DIMENSION_MM = 200;

export type PdHardwareOption = {
  id: string;
  label: string;
  /** Accent colour for the preview + dots. */
  color: string;
  /** Guide-rail swatch (old shop's "H" render), public/plisy-dachowe/. */
  imageUrl: string;
  /** Plisy-profile hardware id whose dopłata this finish inherits. */
  plisyHardwareId: string;
  note: string;
};

// The old shop's four finishes (WAPF form "Kolor osprzętu": Biały, Anoda
// (szary), Brąz, Sosna (drewnopodobny)). Colours sampled from the swatches.
export const PD_HARDWARE: PdHardwareOption[] = [
  { id: "bialy", label: "Biały", color: "#F2F3F1", imageUrl: "/plisy-dachowe/osprzet-bialy.jpg", plisyHardwareId: "bialy", note: "do białych okien PVC i lakierowanych" },
  { id: "anoda", label: "Anoda (szary)", color: "#C6CACE", imageUrl: "/plisy-dachowe/osprzet-anoda.jpg", plisyHardwareId: "anoda", note: "naturalne aluminium, do szarych i antracytowych ram" },
  { id: "braz", label: "Brąz", color: "#4A3128", imageUrl: "/plisy-dachowe/osprzet-braz.jpg", plisyHardwareId: "braz", note: "do ciemnych okien drewnianych i brązowych PVC" },
  { id: "sosna", label: "Sosna", color: "#D9B26A", imageUrl: "/plisy-dachowe/osprzet-sosna.jpg", plisyHardwareId: "sosna", note: "drewnopodobny, do sosnowych okien Velux / Fakro / Roto" },
];

/** The infographic from the old shop showing all four finishes on real
 * window frames - the hardware step's zoom and the landing strip. */
export const PD_HARDWARE_SHEET_URL = "/plisy-dachowe/osprzet-kolory.jpg";

export function pdHardwareById(id: string): PdHardwareOption | null {
  return PD_HARDWARE.find((option) => option.id === id) || null;
}

export function pdHardwareByLabel(label: string | undefined): PdHardwareOption | null {
  const wanted = String(label || "").trim().toLowerCase();
  if (!wanted) return null;
  return PD_HARDWARE.find((option) => option.label.toLowerCase() === wanted || option.id === wanted) || null;
}

type PriceDelta = { priceDelta: number; priceDeltaType: PriceDeltaType };

/** The dopłata the plisy profile attaches to the same finish (by id) - the
 * roof plisa is "priced the same", surcharges included. Zero when the
 * profile has no such option. */
export function pdHardwarePriceDelta(profile: PlisyProfile | null, option: PdHardwareOption | null): PriceDelta {
  if (!profile || !option) return { priceDelta: 0, priceDeltaType: "amount" };
  const hit = profile.hardware.find((entry) => entry.id === option.plisyHardwareId);
  return hit ? { priceDelta: hit.priceDelta, priceDeltaType: hit.priceDeltaType } : { priceDelta: 0, priceDeltaType: "amount" };
}

function pdRoundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Price of one roof plisa: the window-plisa price for the same size,
 * collection, finish and fabric (matrix cell x profile adjustment x the
 * shop's "Korekta ceny (%)" of THIS product, then every dopłata/rabat
 * exactly as features/plisy/ConfiguratorPanel.tsx applies them) times
 * PD_PRICE_MULTIPLIER. Null when the size falls outside the matrix. */
export function calcPlisyDachowePrice(
  profile: PlisyProfile,
  widthMm: number,
  heightMm: number,
  hardware: PdHardwareOption | null,
  fabricGroupId: string,
  fabric: FabricSwatch | null,
  extraPercent = 0,
): number | null {
  if (!hardware || !fabricGroupId) return null;
  const matrix = calcPlisyPrice(
    { ...profile, priceAdjustmentPercent: profile.priceAdjustmentPercent + (extraPercent || 0) },
    widthMm,
    heightMm,
    hardware.plisyHardwareId,
    fabricGroupId,
  );
  if (matrix === null) return null;
  const withDeltas = applyPriceDeltas(matrix, [pdHardwarePriceDelta(profile, hardware), fabric]);
  return pdRoundMoney(withDeltas * PD_PRICE_MULTIPLIER);
}

/** Cheapest configuration for a size: white finish, the cheapest collection
 * (no fabric dopłata) - the "od X zł" per window in search results and the
 * quick price. */
export function pdCheapestPriceForSize(profile: PlisyProfile | null, widthMm: number, heightMm: number, extraPercent = 0, fabricGroupId = ""): number | null {
  if (!profile || !widthMm || !heightMm) return null;
  const white = PD_HARDWARE[0];
  const groups = fabricGroupId ? profile.fabricGroups.filter((group) => group.id === fabricGroupId) : profile.fabricGroups;
  let best: number | null = null;
  for (const group of groups) {
    const price = calcPlisyDachowePrice(profile, widthMm, heightMm, white, group.id, null, extraPercent);
    if (price !== null && (best === null || price < best)) best = price;
  }
  return best;
}

/** Size limits of the plisy matrix (widest/tallest breakpoint): a manual
 * "Wymiar A/B" outside them cannot be priced. Roof windows never reach the
 * 150 cm width the window plisa is capped at, but the matrix goes to 2100. */
export function pdSizeLimits(profile: PlisyProfile | null): { maxWidthMm: number; maxHeightMm: number } {
  let maxWidthMm = 0;
  let maxHeightMm = 0;
  for (const table of profile?.tables || []) {
    maxWidthMm = Math.max(maxWidthMm, ...table.widthBreakpointsMm);
    maxHeightMm = Math.max(maxHeightMm, ...table.heightBreakpointsMm);
  }
  return { maxWidthMm: maxWidthMm || 2100, maxHeightMm: maxHeightMm || 2300 };
}

/** "od X zł" - the smallest size in the cheapest collection, white finish. */
export function pdStartingPrice(profile: PlisyProfile | null, extraPercent = 0): number {
  if (!profile) return PD_STARTING_PRICE_FALLBACK;
  let best = Number.POSITIVE_INFINITY;
  for (const table of profile.tables) {
    const cell = table.prices[0]?.[0];
    if (typeof cell !== "number" || !Number.isFinite(cell) || cell <= 0) continue;
    const widthMm = table.widthBreakpointsMm[0] || 400;
    const heightMm = table.heightBreakpointsMm[0] || 600;
    for (const groupId of table.fabricGroupIds.length ? table.fabricGroupIds : profile.fabricGroups.map((group) => group.id)) {
      const price = calcPlisyDachowePrice(profile, widthMm, heightMm, PD_HARDWARE[0], groupId, null, extraPercent);
      if (price !== null && price < best) best = price;
    }
  }
  return Number.isFinite(best) ? best : PD_STARTING_PRICE_FALLBACK;
}

/** Server render / first paint: the Classic matrix' 77 zł cell x 1,25. */
export const PD_STARTING_PRICE_FALLBACK = pdRoundMoney(77 * PD_PRICE_MULTIPLIER);

/** Same oversized-parcel rule as window plisy (width > 150 cm). */
export function pdOversizeSurcharge(widthMm: number): number {
  return plisyOversizeSurcharge(widthMm);
}

export type ConfiguratorInitialValues = {
  hardwareId?: string;
  fabricGroupId?: string;
  fabricId?: string;
  /** /koszyk's "Edytuj pozycję" only has the cart item's LABELS - resolved
   * against the live profile once it loads (see ConfiguratorPanel). */
  hardwareLabel?: string;
  fabricGroupLabel?: string;
  fabricLabel?: string;
  /** Library window picked before (cart edit / "Wyceń podobną"). */
  windowLibraryId?: number;
  /** Pre-typed search ("Konfiguruj to okno" from the quick price up top). */
  windowQuery?: string;
  widthMm?: number;
  heightMm?: number;
  qty?: number;
  /** Cart edit of an "okno spoza biblioteki" position - restored 1:1. */
  missingModelRequest?: MissingModelRequest | null;
};

export type ConfiguratorResult = {
  hardwareId: string;
  hardwareLabel: string;
  hardwareImageUrl: string;
  hardwareColor: string;
  fabricGroupId: string;
  fabricGroupLabel: string;
  fabricId: string;
  fabricLabel: string;
  fabricColor: string;
  fabricImageUrl: string;
  windowProducer: string;
  windowModel: string;
  /** Library id of the chosen window (0 for a manual size). */
  windowLibraryId: number;
  /** False when the library flags the measurement as unverified or for a
   * manual "Wymiar A/B" entry - the CRM shows "wymiar orientacyjny". */
  windowCertain: boolean;
  isManual: boolean;
  widthMm: number;
  heightMm: number;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  /** One-time oversized-parcel surcharge (0 up to 150 cm wide). */
  oversizeSurchargeAmount: number;
  /** Attachment id of the nameplate photo the customer uploaded (CRM storage). */
  nameplateAttachmentId: string;
  missingModelRequest: MissingModelRequest | null;
};
