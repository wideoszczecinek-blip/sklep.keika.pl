// Warianty produktów dla Google Merchant Center (30.10.2026, zlecenie
// Agencji AI: „sklep ma się pokazywać w Google po modelu okna i po
// wymiarze”). Wspólne dla serwera (katalog /feeds/google-merchant.xml,
// strony wariantów) i przeglądarki (home-client ustawia konfigurator
// z adresu) - bez fetchów i bez window, same czyste funkcje.
//
// Adresy wariantów:
//   /rolety-dachowe/okno/<id>-<producent-model>[-termo]  (id z biblioteki okien CRM)
//   /plisy-dachowe/okno/<id>-<producent-model>
//   /plisy/wymiar/60x120                   (cm)
//   /moskitiery-ramkowe/wymiar/60x120      (cm)
// Te same ustawienia działają też jako parametry na stronie produktu:
//   ?okno=<id>[&tkanina=termo]  albo  ?w=60&h=120  (cm).
//
// Marki okien tylko jako przeznaczenie („do okna dachowego VELUX MK04”),
// nigdy jako nazwa naszego produktu - zasada właściciela po wezwaniu VELUX.
import type { RoofWindowLibraryItem } from "@/features/rolety-dachowe/roof-window-library";

export type RoofMaterialKey = "deko" | "termo";

/** Ustawienie konfiguratora odczytane z adresu strony. */
export type UrlPrefill =
  | { kind: "window"; product: "rolety-dachowe" | "plisy-dachowe"; libraryId: number; material: RoofMaterialKey | "" }
  | { kind: "size"; product: "plisy" | "moskitiery-ramkowe"; widthMm: number; heightMm: number };

// Wymiary (cm) plis okiennych i moskitier ramkowych w katalogu Google.
// Dobór (30.10.2026): zrzuty wycen ze sklepu z 16.09-16.10 (6 446 wycen)
// skupiają się na szerokościach 50-70 i 90 cm oraz wysokościach 110-140 cm;
// typowe skrzydła okien PCV dopełniają siatkę. Okrągłe wymiary, bo tak
// klienci szukają („plisa 60x120”). Wszystkie mieszczą się w produkcji
// i poniżej progu dopłaty za paczkę dłużycową (150 cm).
export const PLISY_FEED_SIZES_CM: Array<[number, number]> = [
  [40, 60], [45, 90], [50, 90], [50, 100], [50, 120], [50, 140],
  [55, 120], [55, 135], [60, 100], [60, 120], [60, 130], [60, 140], [60, 150],
  [65, 120], [65, 135], [70, 100], [70, 120], [70, 140], [75, 135],
  [80, 120], [80, 140], [90, 120], [90, 140], [100, 120], [100, 140],
  [110, 140], [60, 180], [70, 200], [80, 210], [120, 140],
];

export const MOSKITIERY_FEED_SIZES_CM: Array<[number, number]> = [
  [40, 60], [50, 50], [50, 80], [50, 100], [50, 120], [55, 120], [55, 130],
  [60, 60], [60, 80], [60, 100], [60, 120], [60, 140], [60, 150],
  [65, 130], [70, 100], [70, 120], [70, 140], [75, 130], [80, 100],
  [80, 120], [80, 140], [80, 150], [90, 100], [90, 120], [90, 140], [90, 150],
  [100, 120], [100, 140], [100, 150], [110, 140], [120, 120], [120, 150],
];

export function sizeKey(widthCm: number, heightCm: number): string {
  return `${widthCm}x${heightCm}`;
}

/** „60x120” / „60×120” (cm) -> mm. Null poza rozsądnym zakresem. */
export function parseSizeKey(value: string): { widthMm: number; heightMm: number } | null {
  const match = String(value || "").trim().toLowerCase().match(/^(\d{1,3}(?:[.,]\d)?)\s*[x×]\s*(\d{1,3}(?:[.,]\d)?)$/);
  if (!match) return null;
  const widthMm = Math.round(Number(match[1].replace(",", ".")) * 10);
  const heightMm = Math.round(Number(match[2].replace(",", ".")) * 10);
  if (!(widthMm >= 100 && widthMm <= 3000 && heightMm >= 100 && heightMm <= 3000)) return null;
  return { widthMm, heightMm };
}

const PL_CHARS: Record<string, string> = { ą: "a", ć: "c", ę: "e", ł: "l", ń: "n", ó: "o", ś: "s", ź: "z", ż: "z" };

function slugify(value: string): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (char) => PL_CHARS[char] || char)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

/** Producent wielkimi literami, bez powtórzonej marki („Velux VELUX GPL” -> „VELUX GPL”). */
export function roofProducerLabel(item: RoofWindowLibraryItem): string {
  const words = String(item.producer_name || "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return "";
  const brand = words[0].toUpperCase();
  const rest = words.slice(1).filter((word, index) => !(index === 0 && word.toUpperCase() === brand));
  return [brand, ...rest].join(" ");
}

// Kody rozmiarów: VELUX (litera szerokości + 2 cyfry wysokości, też stare
// 304 = M04) i ROTO (5/11 = 54×118). Tylko pewne kody - reszta bez rozmiaru.
const VELUX_WIDTH_CM: Record<string, number> = { C: 55, F: 66, M: 78, P: 94, S: 114, U: 134 };
const VELUX_OLD_WIDTH: Record<string, string> = { "1": "C", "2": "F", "3": "M", "4": "P", "6": "S", "8": "U" };
const VELUX_HEIGHT_CM: Record<string, number> = { "01": 70, "02": 78, "04": 98, "06": 118, "08": 140, "10": 160 };
const ROTO_WIDTH_CM: Record<string, number> = { "5": 54, "6": 65, "7": 74, "9": 94, "11": 114, "13": 134 };
const ROTO_HEIGHT_CM: Record<string, number> = { "7": 78, "9": 98, "11": 118, "14": 140, "16": 160 };

function veluxNominal(code: string): [number, number] | null {
  const clean = code.toUpperCase().replace(/^[A-Z]{3}\s+/, "").trim();
  let match = clean.match(/^([CFMPSU])K?(\d{2})$/);
  if (match && VELUX_WIDTH_CM[match[1]] && VELUX_HEIGHT_CM[match[2]]) return [VELUX_WIDTH_CM[match[1]], VELUX_HEIGHT_CM[match[2]]];
  match = clean.match(/^([123468])(\d{2})$/);
  if (match && VELUX_HEIGHT_CM[match[2]]) return [VELUX_WIDTH_CM[VELUX_OLD_WIDTH[match[1]]], VELUX_HEIGHT_CM[match[2]]];
  return null;
}

/** Nominalny rozmiar okna (cm) - tylko gdy da się go ustalić pewnie. */
export function roofWindowNominalCm(item: RoofWindowLibraryItem): [number, number] | null {
  const producer = String(item.producer_name || "").toLowerCase();
  const model = String(item.window_model || "").trim();
  const inModel = model.match(/(\d{2,3})\s*[x×/]\s*(\d{2,3})/);
  if (producer.startsWith("velux")) return veluxNominal(model) || veluxNominal(String(item.alternate_window_model || ""));
  if (producer.startsWith("roto")) {
    const code = model.match(/^0?(\d{1,2})\/0?(\d{1,2})$/);
    if (code && ROTO_WIDTH_CM[code[1]] && ROTO_HEIGHT_CM[code[2]]) return [ROTO_WIDTH_CM[code[1]], ROTO_HEIGHT_CM[code[2]]];
    return null;
  }
  if (inModel) return [Number(inModel[1]), Number(inModel[2])];
  const w = Number(item.window_width);
  const h = Number(item.window_height);
  if (w >= 30 && w <= 200 && h >= 30 && h <= 200) return [w, h];
  return null;
}

/** „VELUX MK04 78×98”, „FAKRO 78x118”, „ROTO 43H 7/14 74×140”. */
export function roofWindowTitleLabel(item: RoofWindowLibraryItem): string {
  const model = String(item.window_model || "").trim();
  const alt = String(item.alternate_window_model || "").trim();
  const parts = [roofProducerLabel(item), model];
  if (alt && /[a-z]/i.test(alt) && alt.toLowerCase() !== model.toLowerCase()) parts.push(`(${alt})`);
  const nominal = roofWindowNominalCm(item);
  if (nominal && !/\d{2,3}\s*[x×]\s*\d{2,3}/.test(model)) parts.push(`${nominal[0]}×${nominal[1]}`);
  return parts.filter(Boolean).join(" ");
}

/** Segment adresu: „396-dakstra-f6a” (+ „-termo” dla rolety TERMO). */
export function roofWindowPathKey(item: RoofWindowLibraryItem, material: RoofMaterialKey | "" = ""): string {
  const slug = slugify(`${item.producer_name} ${item.window_model}`);
  return `${item.id}${slug ? "-" + slug : ""}${material === "termo" ? "-termo" : ""}`;
}

/** „396-dakstra-f6a-termo” -> { libraryId: 396, material: "termo" }. */
export function parseRoofWindowPathKey(value: string): { libraryId: number; material: RoofMaterialKey | "" } | null {
  const raw = decodeURIComponent(String(value || "")).trim().toLowerCase();
  const match = raw.match(/^(\d{1,7})(?:-[a-z0-9-]*)?$/);
  if (!match) return null;
  const libraryId = Number(match[1]);
  if (!libraryId) return null;
  return { libraryId, material: /-termo$/.test(raw) ? "termo" : "" };
}

function parseMaterialParam(value: string | null): RoofMaterialKey | "" {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "termo") return "termo";
  if (normalized === "deko") return "deko";
  return "";
}

/** Ustawienie konfiguratora z adresu (ścieżka wariantu albo parametry). */
export function readUrlPrefill(productSlug: string, pathname: string, search: string): UrlPrefill | null {
  const params = new URLSearchParams(search || "");
  const segments = String(pathname || "").split("/").filter(Boolean);
  if (productSlug === "rolety-dachowe" || productSlug === "plisy-dachowe") {
    const fromPath = segments[0] === productSlug && segments[1] === "okno" && segments[2] ? parseRoofWindowPathKey(segments[2]) : null;
    const fromQuery = params.get("okno") ? parseRoofWindowPathKey(params.get("okno") || "") : null;
    const hit = fromPath || fromQuery;
    if (!hit) return null;
    const material = parseMaterialParam(params.get("tkanina")) || hit.material;
    return { kind: "window", product: productSlug, libraryId: hit.libraryId, material: productSlug === "rolety-dachowe" ? material : "" };
  }
  if (productSlug === "plisy" || productSlug === "moskitiery-ramkowe") {
    const fromPath = segments[0] === productSlug && segments[1] === "wymiar" && segments[2] ? parseSizeKey(segments[2]) : null;
    const w = params.get("w");
    const h = params.get("h");
    const fromQuery = w && h ? parseSizeKey(`${w}x${h}`) : null;
    const hit = fromPath || fromQuery;
    return hit ? { kind: "size", product: productSlug, ...hit } : null;
  }
  return null;
}
