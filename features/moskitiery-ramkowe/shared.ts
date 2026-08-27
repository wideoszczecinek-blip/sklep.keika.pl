// Shared data + pure helpers for the moskitiery-ramkowe configurator, used
// both by the homepage (app/page.tsx, "add to cart") and by the cart's
// "Edytuj pozycję" modal (app/koszyk/page.tsx, via ConfiguratorPanel) - see
// ConfiguratorPanel.tsx for the actual step UI that consumes all this.
import { optimizeImageUrl } from "@/lib/image-optim";

export type HardwareOption = {
  id: string;
  label: string;
  color: string;
  imageUrl: string;
  galleryUrls: string[];
  priceDelta: number;
  previewLayerUrl?: string;
};

export type MeshOption = {
  id: string;
  label: string;
  color: string;
  imageUrl?: string;
  previewLayerUrl?: string;
};

// Real per-color mask/layer images + accent colors, pulled from the actual
// live Allegro-linked configurator (configurator_public?slug=moskitiera on
// the CRM, rendered at konfiguruj.com.pl/moskitiera) rather than invented -
// see [[shop-moskitiery-ramkowe-fixes]] memory for how these were found.
export const MOSKITIERY_PROFILE_DEFAULT_LAYER_URL =
  "https://crm-keika.groovemedia.pl/storage/shop/media/20260317_193725_fd0fe393_Projekt-bez-nazwy-4.png";
export const MOSKITIERY_MESH_LAYER_URL =
  "https://crm-keika.groovemedia.pl/storage/shop/media/20260317_194854_c7f2cfce_Projekt-bez-nazwy-6.png";

export const ALLEGRO_MOSKITIERY_HARDWARE: HardwareOption[] = [
  {
    id: "bialy",
    label: "Biały",
    color: "#F7F7F7",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260317_185025_f0caf59e_1__swatch_512.png",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000347_2dc2ceab_Bialy_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000328_79e6551b_Bialy_2.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000401_566be7d6_Bialy_3.jpg",
    ],
    priceDelta: 0,
    previewLayerUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260317_174505_0c88bf64_ChatGPT-Image-17-mar-2026-17_43_49.png",
  },
  {
    id: "antracyt",
    label: "Antracyt",
    color: "#4B5563",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260317_185043_26e815ba_3__swatch_512.png",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000554_035f1db1_Antracyt_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000546_c5c56ae1_Antracyt_2.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000601_9e1a8ebf_Antracyt_3.jpg",
    ],
    priceDelta: 0,
    previewLayerUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260317_174523_76d983ad_Projekt-bez-nazwy-4.png",
  },
  {
    id: "braz",
    label: "Brąz",
    color: "#442C17",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260519_220109_296c1915_Projekt-bez-nazwy-21.png",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000635_9726bee7_Braz_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000647_361e63b8_Braz_2.jpg",
    ],
    priceDelta: 0,
    previewLayerUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260317_174629_7019c27f_ChatGPT-Image-17-mar-2026-17_45_59.png",
  },
  {
    id: "zloty-dab",
    label: "Złoty dąb",
    color: "#CD823D",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260318_221333_7809c16f_Projekt-bez-nazwy-11__swatch_512.png",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000729_eeabf87c_ZlotyDab_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000722_a4143e5c_ZlotyDab_2.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000736_f064cbb0_ZlotyDab_3.jpg",
    ],
    priceDelta: 0,
  },
  {
    id: "orzech",
    label: "Orzech",
    color: "#926449",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260318_221542_732d672a_Projekt-bez-nazwy-10__swatch_512.png",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000812_2fb228c4_Orzech_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000800_202d5380_Orzech_2.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000822_c2fadbc5_Orzech_3.jpg",
    ],
    priceDelta: 0,
  },
  {
    id: "winchester",
    label: "Winchester",
    color: "#EC985F",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260318_221638_d6c6dfc5_Projekt-bez-nazwy-9__swatch_512.png",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000852_41d51076_Winchester_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000848_017894bf_Winchester_2.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000859_51c6c15c_Winchester_3.jpg",
    ],
    priceDelta: 0,
  },
  {
    id: "mahon",
    label: "Mahoń",
    color: "#934B3E",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260318_221735_40f66eac_Projekt-bez-nazwy-8__swatch_512.png",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000920_fe216be2_Mahon_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000912_440c4496_Mahon_2.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000925_ac038d5b_Mahon_3.jpg",
    ],
    priceDelta: 0,
  },
];

export const MESH_OPTIONS: MeshOption[] = [
  {
    id: "grey",
    label: "Szara (wzmocniona)",
    color: "#B0B0B0",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260317_191851_27ecdb81_ChatGPT-Image-17-mar-2026-19_17_40.png",
  },
  {
    id: "black",
    label: "Czarna (wzmocniona)",
    color: "#454545",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260317_191900_b13b6cfe_ChatGPT-Image-17-mar-2026-19_17_43.png",
  },
];

// Ported byte-for-byte from the CRM admin panel's own live swatch preview
// (assets/js/biuro/allegro_configurator.js: normalizeHexColor/hexToRgb/rgba/
// shiftHex/buildLayerPreviewStyle/renderStepOptionColorPreview, CSS in
// assets/css/biuro/allegro_configurator.css .alcfg-layer-preview*) - per the
// user, this exact two-layer technique (masked gradient "surface" + a
// second unmasked, low-opacity, multiply-blended "overlay" of the same PNG)
// is THE only accepted way to render a color on a layer. No base photo.
function moskNormalizeHexColor(value: string, fallback = "#1F2937"): string {
  const normalized = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function moskHexToRgb(hex: string) {
  const normalized = moskNormalizeHexColor(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function moskRgba(hex: string, alpha: number): string {
  const rgb = moskHexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function moskShiftHex(hex: string, amount: number): string {
  const rgb = moskHexToRgb(hex);
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value + amount)));
  return `#${[clamp(rgb.r), clamp(rgb.g), clamp(rgb.b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function buildMoskLayerSurfaceStyle(imageUrl: string, accentColor: string, mode: "solid" | "mesh") {
  const normalizedColor = moskNormalizeHexColor(accentColor, "#D8DEE3");
  const gradient =
    mode === "mesh"
      ? `linear-gradient(135deg, ${moskRgba(moskShiftHex(normalizedColor, 18), 0.92)} 0%, ${moskRgba(normalizedColor, 0.78)} 58%, ${moskRgba(moskShiftHex(normalizedColor, -16), 0.86)} 100%)`
      : `linear-gradient(135deg, ${normalizedColor} 0%, ${moskShiftHex(normalizedColor, -22)} 100%)`;

  const optimizedUrl = optimizeImageUrl(imageUrl, 500);
  return {
    backgroundImage: gradient,
    maskImage: `url(${optimizedUrl})`,
    maskRepeat: "no-repeat",
    maskPosition: "center",
    maskSize: "contain",
    WebkitMaskImage: `url(${optimizedUrl})`,
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    WebkitMaskSize: "contain",
  } as const;
}

// Real, current pricing for moskitiery-ramkowe (per business owner, not the
// CRM's stale placeholder unit price): billed per running meter of frame
// perimeter, rounded UP to each started meter ("każdy rozpoczęty metr
// bieżący"). Two rates exist - the promotional one is the one actually
// charged; the standard one is only shown crossed out for contrast.
export const MOSKITIERY_RAMKOWE_PRICE_PER_MB_STANDARD = 29.9;
export const MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO = 25.9;

export function moskPerimeterMeters(widthMm: number, heightMm: number): number {
  return (2 * (widthMm + heightMm)) / 1000;
}

export function moskBilledMeters(perimeterMeters: number): number {
  return Math.max(1, Math.ceil(perimeterMeters));
}

// Smallest orderable moskitiera-ramkowa - below this on either side it's not
// a manufacturable frame.
export const MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM = 150;

// Oversize handling for moskitiery-ramkowe dimensions:
// - Neither dimension may exceed OVERSIZE_TECHNICAL_LIMIT_MM at the same
//   time as the other (a hard technical/manufacturing limit, no way around it).
// - Above OVERSIZE_SURCHARGE_THRESHOLD_MM on either dimension, the shipment
//   becomes an oversized ("długościowa") parcel and needs a one-time
//   surcharge for the whole order, tiered by the largest dimension involved.
// - OVERSIZE_SURCHARGE_TIER_2_MAX_MM doubles as the hard per-side maximum -
//   moskOversizeSurchargeForDimension() returns -1 past it (see below).
export const OVERSIZE_TECHNICAL_LIMIT_MM = 1600;
export const OVERSIZE_SURCHARGE_THRESHOLD_MM = 1500;
export const OVERSIZE_SURCHARGE_TIER_1_MAX_MM = 2000;
export const OVERSIZE_SURCHARGE_TIER_2_MAX_MM = 2300;
export const OVERSIZE_SURCHARGE_TIER_1_AMOUNT = 19.9;
export const OVERSIZE_SURCHARGE_TIER_2_AMOUNT = 29;

/** Returns the one-time surcharge (zł) required for a given max dimension,
 * 0 if none needed, or -1 if the dimension is beyond the supported range. */
export function moskOversizeSurchargeForDimension(maxDimMm: number): number {
  if (maxDimMm <= OVERSIZE_SURCHARGE_THRESHOLD_MM) return 0;
  if (maxDimMm <= OVERSIZE_SURCHARGE_TIER_1_MAX_MM) return OVERSIZE_SURCHARGE_TIER_1_AMOUNT;
  if (maxDimMm <= OVERSIZE_SURCHARGE_TIER_2_MAX_MM) return OVERSIZE_SURCHARGE_TIER_2_AMOUNT;
  return -1;
}

export type ConfiguratorInitialValues = {
  hardwareId?: string;
  meshId?: string;
  widthMm?: number;
  heightMm?: number;
  qty?: number;
};

export type ConfiguratorResult = {
  hardwareId: string;
  hardwareLabel: string;
  hardwareImageUrl: string;
  meshId: string;
  meshLabel: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  oversizeSurchargeAmount: number;
};
