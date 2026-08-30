// Shared data + pure helpers for the rolety-dachowe (roof window blind)
// configurator, mirroring features/moskitiery-ramkowe/shared.ts - used both
// by the homepage (app/page.tsx, "add to cart") and by the cart's "Edytuj
// pozycję" modal. See ConfiguratorPanel.tsx for the actual step UI.
//
// All option data (hardware colors, fabric colors, product copy, pricing
// mode/amount) is real, pulled from the live product record the CRM's own
// public configurator API serves for this exact product
// (https://crm-keika.groovemedia.pl/biuro/api/allegro/configurator_public?slug=rolety-dachowe,
// fetched 2026-08-30) - not invented. The 420-model window library in
// roof-windows-data.ts comes from that same CRM's public roof-window
// library endpoint. Real live Allegro listing for this exact product:
// https://allegro.pl/oferta/18845286655 (259,00 zł, matches
// ROLETY_DACHOWE_PRICE below).
import { optimizeImageUrl } from "@/lib/image-optim";
import { ROOF_WINDOW_MODELS, type RoofWindowModel } from "./roof-windows-data";

export type HardwareOption = {
  id: string;
  label: string;
  color: string;
  imageUrl: string;
  galleryUrls: string[];
  priceDelta: number;
  previewLayerUrl?: string;
};

export type FabricOption = {
  id: string;
  label: string;
  subtitle: string;
  color: string;
  imageUrl: string;
};

// Kaseta i prowadnice (hardware/profile) colors - real CRM data, "Wybierz
// kolor kasety i prowadnic" step. Only 2 options for this product (the
// wider "dachowe"/"roletydachowe" siblings also offer a 3rd, "Jasna Sosna" -
// this specific rolety-dachowe product doesn't).
export const ROLETY_DACHOWE_HARDWARE: HardwareOption[] = [
  {
    id: "srebrny",
    label: "Anoda",
    color: "#C7CED6",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260705_093902_e1023f08_osprzet-anoda-200x300.png",
    galleryUrls: ["https://crm-keika.groovemedia.pl/storage/shop/media/20260705_093902_e1023f08_osprzet-anoda-200x300.png"],
    priceDelta: 0,
    previewLayerUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260729_170317_0240b561_anoda-warstwa.png",
  },
  {
    id: "bialy",
    label: "Biały",
    color: "#F4F7F8",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260705_093800_71b8210e_osprzet-bialy-200x300.png",
    galleryUrls: ["https://crm-keika.groovemedia.pl/storage/shop/media/20260705_093800_71b8210e_osprzet-bialy-200x300.png"],
    priceDelta: 0,
    previewLayerUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260729_181502_f32127c8_biały-warstwa.png",
  },
];

// Tkanina Termo (fabric) colors - real CRM data, "Wybierz kolor materiału"
// step, all 19 "Termo" options this product offers (the wider
// "dachowe"/"roletydachowe" siblings also offer 54 lighter "Deko"
// options behind an extra material-type step; this product skips that
// step and goes straight to these 19). Three entries (67/68/69) never had
// a real accent_color set in the CRM (still the placeholder #D8DEE3) -
// left as-is rather than guessing a "more correct" green/red/black, since
// their real swatch photo is what's actually shown. "Term 66" is a CRM
// label typo, corrected here to "Termo 66" for consistency with the rest.
export const ROLETY_DACHOWE_FABRIC: FabricOption[] = [
  { id: "mgrs-51", label: "Termo 51", subtitle: "Czysta biel", color: "#D9D6D1", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_152654_e6ae9ace_MGRS51__swatch_640.webp" },
  { id: "mgrs-52", label: "Termo 52", subtitle: "Piaskowy", color: "#D4C4A9", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_152818_3dd0ea0c_MGRS52__swatch_640.webp" },
  { id: "mgrs-53", label: "Termo 53", subtitle: "Kawa z mlekiem", color: "#C79A70", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_152855_da3c4407_MGRS53__swatch_640.webp" },
  { id: "mgrs-54", label: "Termo 54", subtitle: "Jasny szary", color: "#B2A796", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153118_76bec5fd_MGRS54__swatch_640.webp" },
  { id: "mgrs-55", label: "Termo 55", subtitle: "Seledynowy", color: "#B6B998", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153342_1cfb8df6_MGRS55__swatch_640.webp" },
  { id: "mgrs-56", label: "Termo 56", subtitle: "Jasny piasek", color: "#DED2B9", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153439_a06659e2_MGRS56__swatch_640.webp" },
  { id: "mgrs-57", label: "Termo 57", subtitle: "", color: "#E5CFAB", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153557_7ea6e1de_MGRS57__swatch_640.webp" },
  { id: "mgrs-58", label: "Termo 58", subtitle: "", color: "#E0B57A", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153625_873cc6d7_MGRS58__swatch_640.webp" },
  { id: "mgrs-59", label: "Termo 59", subtitle: "", color: "#E1B461", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153652_fc27e562_MGRS59__swatch_640.webp" },
  { id: "mgrs-60", label: "Termo 60", subtitle: "Pomarańczowy", color: "#E68C3B", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153726_4232667a_MGRS60__swatch_640.webp" },
  { id: "mgrs-61", label: "Termo 61", subtitle: "Antracyt - grafit", color: "#606666", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153812_0366ca34_MGRS61__swatch_640.webp" },
  { id: "mgrs-62", label: "Termo 62", subtitle: "Róż", color: "#D9C3CD", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153842_4cdae736_MGRS62__swatch_640.webp" },
  { id: "mgrs-63", label: "Termo 63", subtitle: "Wzór - beżowy", color: "#CBC8C0", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153926_6f484576_MGRS63__swatch_640.webp" },
  { id: "mgrs-64", label: "Termo 64", subtitle: "Wzór - szary", color: "#B5AFAA", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_153956_22b8d258_MGRS64__swatch_640.webp" },
  { id: "mgrs-65", label: "Termo 65", subtitle: "Granatowy", color: "#23466C", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_154033_6b9fbbdd_MGRS65__swatch_640.webp" },
  { id: "mgrs-66", label: "Termo 66", subtitle: "Brązowy", color: "#735138", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_154114_3f027403_MGRS66__swatch_640.webp" },
  { id: "mgrs-67", label: "Termo 67", subtitle: "Zielony", color: "#D8DEE3", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_154153_51deae28_MGRS67__swatch_640.webp" },
  { id: "mgrs-68", label: "Termo 68", subtitle: "Czerwony", color: "#D8DEE3", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_230536_a6725177_MGRS68__swatch_640.webp" },
  { id: "mgrs-69", label: "Termo 69", subtitle: "Czarny", color: "#D8DEE3", imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260724_230601_b540ca9e_MGRS69__swatch_640.webp" },
];

// Ported byte-for-byte from features/moskitiery-ramkowe/shared.ts (which
// itself ports the CRM admin panel's live swatch preview technique) - same
// masked-gradient-surface + low-opacity-multiply-overlay two-layer render,
// reused here for the hardware/kaseta step's live preview.
function rdNormalizeHexColor(value: string, fallback = "#1F2937"): string {
  const normalized = String(value || "").trim().toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function rdHexToRgb(hex: string) {
  const normalized = rdNormalizeHexColor(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rdRgba(hex: string, alpha: number): string {
  const rgb = rdHexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function rdShiftHex(hex: string, amount: number): string {
  const rgb = rdHexToRgb(hex);
  const clamp = (value: number) => Math.max(0, Math.min(255, Math.round(value + amount)));
  return `#${[clamp(rgb.r), clamp(rgb.g), clamp(rgb.b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")
    .toUpperCase()}`;
}

export function buildRdLayerSurfaceStyle(imageUrl: string, accentColor: string) {
  const normalizedColor = rdNormalizeHexColor(accentColor, "#D8DEE3");
  const gradient = `linear-gradient(135deg, ${normalizedColor} 0%, ${rdShiftHex(normalizedColor, -22)} 100%)`;
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

// Real, current pricing (per business owner's live Allegro listing, offer
// 18845286655): a flat price per unit regardless of window size - this
// product's pricing_calculation.mode is "none" in the CRM (unlike
// moskitiery-ramkowe's per-perimeter-meter math), so there is no dimension
// -> price formula here at all, just this one number times quantity.
export const ROLETY_DACHOWE_PRICE = 259.0;

// Manual "Wymiar A / Wymiar B" fallback range (customer types their own
// measured size instead of picking a library window model) - same
// 200-2300mm range the real configurator enforces for every non-mosquito
// product (MOSQUITO_MIN/MAX_DIMENSION_MM in product-configurator-shell.tsx,
// reused generically there; renamed here since this product has nothing to
// do with mosquito nets).
export const ROLETY_DACHOWE_MIN_DIMENSION_MM = 200;
export const ROLETY_DACHOWE_MAX_DIMENSION_MM = 2300;

export type RoofWindowSelection = {
  /** Set when picked from the library; empty for a manual "Wymiar A/B" entry. */
  producer: string;
  model: string;
  widthMm: number;
  heightMm: number;
  /** False for a library pick whose measurement the CRM flags unverified,
   * or for a manual entry (nothing to verify). */
  certain: boolean;
  isManual: boolean;
};

/** Simple substring search across producer + model + alternate model,
 * matching how the real configurator's own search box works - no fuzzy
 * matching, just case/diacritics-insensitive "contains". */
export function searchRoofWindowModels(query: string, limit = 30): RoofWindowModel[] {
  const normalized = query
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
  if (!normalized) return ROOF_WINDOW_MODELS.slice(0, limit);
  const terms = normalized.split(/\s+/).filter(Boolean);
  return ROOF_WINDOW_MODELS.filter((entry) => {
    const haystack = `${entry.producer} ${entry.model} ${entry.altModel}`
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "");
    return terms.every((term) => haystack.includes(term));
  }).slice(0, limit);
}

export type ConfiguratorInitialValues = {
  hardwareId?: string;
  fabricId?: string;
  widthMm?: number;
  heightMm?: number;
  qty?: number;
};

export type ConfiguratorResult = {
  hardwareId: string;
  hardwareLabel: string;
  hardwareImageUrl: string;
  fabricId: string;
  fabricLabel: string;
  windowProducer: string;
  windowModel: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  unitPrice: number;
  totalPrice: number;
};
