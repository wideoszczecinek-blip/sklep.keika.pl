// Opcje żaluzji z B2B Sun & Shade (dostawca) - logika wyboru, dopłat i
// zamówienia u dostawcy (właściciel, 17.10.2026: "sprzedajemy ich produkt -
// zamówienie musi pozwolić złożyć u nich zamówienie bez zgadywania").
//
// Dane: features/rolety/ss-options/ss-<pid>.json (po jednym na model, klucz =
// id grupy w CRM). Pole = select formularza S&S id[attr], opcja = wartość v.
//  - role: required (klient wybiera, preselekcja default), optional (Dodatki),
//    fixed (jedna opcja - informacja), hidden (nie pokazujemy, zapisujemy default);
//  - delta = nasza dopłata brutto (zł); costDelta = koszt u dostawcy - NIGDY
//    nie pokazujemy klientowi;
//  - pricing: fixed / perBracket (attr 56: delta dla 2 uchwytów) / perMm
//    (attr 47: delta dla 1000 mm szerokości);
//  - tapeAvailability[kolor lameli][taśma]: 1 = ograniczona gwarancja, 2 = brak.
//
// Reguły zależności wynikające z danych S&S (sprawdzone na 38 modelach):
//  - attr 56 (mocowania bezinwazyjne) obowiązuje tylko przy "Montaż bez
//    wiercenia"; modele bez opcji "brak" w 56 mają w attr 22 opcję
//    "Bezinwazyjne", którą wtedy ustawiamy;
//  - attr 58 (bezinwazyjne prowadzenie boczne - kolor) tylko gdy attr 30 =
//    "Tak - bezinwazyjne"; attr 60 (kolor prowadzenia) gdy attr 30 = inne "Tak";
//  - attr 51 (kolor dzwonków) tylko gdy attr 34 inne niż pierwsza opcja;
//  - minWidthMm (attr 29) - pole od tej szerokości żaluzji.
// Pola, które nie obowiązują, nie są doliczane do ceny; w zamówieniu u
// dostawcy zostaje ich wartość domyślna z dopiskiem "nie dotyczy".

export type SsOption = {
  v: string;
  label: string;
  code: string;
  ssText: string;
  costDelta: number;
  delta: number;
  img: string;
  disabled: boolean;
};

export type SsField = {
  attr: string;
  ssLabel: string;
  title: string;
  role: "required" | "optional" | "fixed" | "hidden";
  order: number;
  default: string;
  pricing: "fixed" | "perBracket" | "perMm";
  minWidthMm: number;
  dependsOn: { attr: string; notValueIndex: number } | null;
  options: SsOption[];
};

export type SsModelOptions = {
  groupId: string;
  pid: number;
  ssTitle: string;
  maxWidthMm: number;
  tapeAvailability: Record<string, Record<string, number>>;
  fields: SsField[];
};

export type SsSelection = Record<string, string>;

export type SsContext = {
  widthMm: number;
  noDrill: boolean;
};

const cache = new Map<string, Promise<SsModelOptions | null>>();

/** Opcje S&S modelu (osobny plik JSON na model - ładowany tylko ten jeden). */
export function loadSsOptions(groupId: string): Promise<SsModelOptions | null> {
  const id = String(groupId || "").trim();
  if (!/^ss-\d+$/.test(id)) return Promise.resolve(null);
  const hit = cache.get(id);
  if (hit) return hit;
  const request = import(`./ss-options/${id}.json`)
    .then((mod) => ((mod as { default?: SsModelOptions }).default || (mod as unknown as SsModelOptions)) as SsModelOptions)
    .catch(() => null);
  cache.set(id, request);
  return request;
}

export const SS_SUPPLIER_NAME = "Sun & Shade";

/** Tekst S&S bez cen zakupu ("białe ----50-001- (+ 24.78 zł)" -> "białe ----50-001-",
 * "(+80%|+109.16 zł)" też znika) - ceny dostawcy nie trafiają nigdzie poza jego panel. */
export function ssStripPrices(text: string): string {
  return String(text || "")
    .replace(/\s*\(\s*\+[^)]*\)/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Wiersz wyceny z sekcji "Zamówienie u dostawcy" - tylko dla biura; strony
 * klienta (/wycena, status zamówienia) go pomijają. */
export function isSupplierSummaryRow(label: string | undefined): boolean {
  const text = String(label || "");
  return text.startsWith("Zamówienie u dostawcy") || text.startsWith(`${SS_SUPPLIER_NAME}:`);
}

export function ssField(model: SsModelOptions | null, attr: string): SsField | null {
  return model?.fields.find((field) => field.attr === attr) || null;
}

export function ssOption(field: SsField | null, v: string | undefined): SsOption | null {
  if (!field) return null;
  return field.options.find((option) => option.v === v) || null;
}

/** Opcja "brak / nie" (np. 56: "Brak -", 30: "Nie"). */
export function ssNoneOption(field: SsField | null): SsOption | null {
  if (!field) return null;
  return field.options.find((option) => /^\s*(brak|nie)\b/i.test(option.label)) || null;
}

/** Opcje do pokazania klientowi: bez zablokowanych i bez wycofanych
 * (chyba że akurat wybrana - np. stara pozycja koszyka). */
export function ssVisibleOptions(field: SsField, selectedV?: string): SsOption[] {
  return field.options.filter((option) => option.v === selectedV || (!option.disabled && !/wycofan/i.test(option.label)));
}

/** Etykieta bez dopisków S&S ("**ograniczona dostępność" -> " (ograniczona dostępność)"). */
export function ssCleanLabel(label: string): string {
  return String(label || "")
    .replace(/\s*\*\*\s*/g, " - ")
    .replace(/\s+-\s*$/, "")
    .trim();
}

/** "Przekładnia: prawa - Hamulec: lewa" -> "Przekładnia prawa, hamulec lewy". */
export function ssTilterLabel(label: string): string {
  const match = String(label || "").match(/Przekładnia:\s*(prawa|lewa)\s*-\s*Hamulec:\s*(prawa|lewa)/i);
  if (!match) return label;
  const brake = match[2].toLowerCase() === "prawa" ? "prawy" : "lewy";
  return `Przekładnia ${match[1].toLowerCase()}, hamulec ${brake}`;
}

/** Strona przekładni z opcji attr 16 - do etykiety montażu i pola chainSide. */
export function ssTilterSide(label: string): "lewa" | "prawa" {
  const match = String(label || "").match(/Przekładnia:\s*(prawa|lewa)/i);
  return match && match[1].toLowerCase() === "lewa" ? "lewa" : "prawa";
}

/** Liczba uchwytów (attr 56): do 1000 mm 2, do 1600 3, do 2000 4, powyżej 5. */
export function ssBracketCount(widthMm: number): number {
  if (widthMm <= 1000) return 2;
  if (widthMm <= 1600) return 3;
  if (widthMm <= 2000) return 4;
  return 5;
}

/** Dopłata za opcję przy danej szerokości (zł brutto, w górę do pełnych zł
 * dla dopłat liczonych - jak delta w danych). */
export function ssOptionDelta(field: SsField, option: SsOption | null, widthMm: number): number {
  if (!option || !Number.isFinite(option.delta) || option.delta <= 0) return 0;
  if (field.pricing === "perBracket") return Math.ceil((option.delta / 2) * ssBracketCount(widthMm));
  if (field.pricing === "perMm") return Math.ceil((option.delta * Math.max(0, widthMm)) / 1000);
  return option.delta;
}

/** Wartości domyślne wszystkich pól modelu. */
export function ssDefaultSelection(model: SsModelOptions): SsSelection {
  const out: SsSelection = {};
  for (const field of model.fields) out[field.attr] = field.default;
  // 56 bez "Montażu bez wiercenia" = "brak" (gdy model ma taką opcję).
  const f56 = ssField(model, "56");
  const none56 = ssNoneOption(f56);
  if (f56 && none56) out["56"] = none56.v;
  return out;
}

/** Wybór zapisany w pozycji koszyka -> wybór panelu (tylko znane pola i opcje). */
export function ssSelectionFromStored(model: SsModelOptions, stored: Record<string, string> | undefined): SsSelection {
  const out = ssDefaultSelection(model);
  for (const field of model.fields) {
    const value = stored?.[field.attr];
    if (value && field.options.some((option) => option.v === value)) out[field.attr] = value;
  }
  return out;
}

/** Czy "Montaż bez wiercenia" był wybrany w zapisanym wyborze. */
export function ssNoDrillFromStored(model: SsModelOptions, stored: Record<string, string> | undefined): boolean {
  if (!stored) return false;
  const f56 = ssField(model, "56");
  const f22 = ssField(model, "22");
  const v22 = ssOption(f22, stored["22"]);
  if (v22 && /bezinwazyjn/i.test(v22.label)) return true;
  const none56 = ssNoneOption(f56);
  return Boolean(f56 && none56 && stored["56"] && stored["56"] !== none56.v);
}

/** Czy pole obowiązuje przy obecnym wyborze (reguły w nagłówku pliku). */
export function ssFieldApplies(model: SsModelOptions, field: SsField, selection: SsSelection, ctx: SsContext): boolean {
  if (field.attr === "56") return ctx.noDrill;
  if (field.minWidthMm > 0 && !(ctx.widthMm >= field.minWidthMm)) return false;
  const f30 = ssField(model, "30");
  const opt30 = ssOption(f30, selection["30"]);
  const sideNonInvasive = Boolean(opt30 && /bezinwazyjn/i.test(opt30.label));
  if (field.attr === "58") return sideNonInvasive;
  if (field.attr === "60") {
    if (!f30 || !opt30) return false;
    const index = f30.options.findIndex((option) => option.v === opt30.v);
    if (index === (field.dependsOn?.notValueIndex ?? 0)) return false;
    return !(sideNonInvasive && ssField(model, "58"));
  }
  if (field.dependsOn && field.attr !== "60") {
    const parent = ssField(model, field.dependsOn.attr);
    const index = parent ? parent.options.findIndex((option) => option.v === selection[parent.attr]) : -1;
    if (index === field.dependsOn.notValueIndex) return false;
  }
  if (field.attr === "51") {
    const f34 = ssField(model, "34");
    if (f34 && selection["34"] === f34.options[0]?.v) return false;
  }
  return true;
}

/** Dostępność taśmy dla koloru lameli: 0 ok, 1 ograniczona gwarancja, 2 niedostępna. */
export function ssTapeStatus(model: SsModelOptions | null, colorV: string, tapeV: string): 0 | 1 | 2 {
  const value = model?.tapeAvailability?.[colorV]?.[tapeV];
  return value === 2 ? 2 : value === 1 ? 1 : 0;
}

/** Wartość koloru lameli S&S z id próbki w CRM ("ss-39-264" -> "264"). */
export function ssColorValue(swatchId: string, pid: number): string {
  const match = String(swatchId || "").match(new RegExp(`^ss-${pid}-(.+)$`));
  return match ? match[1] : String(swatchId || "").split("-").pop() || "";
}

export type SsExtraLine = { attr: string; title: string; label: string; amount: number };

/** Dopłaty za wybrane opcje (tylko pola, które obowiązują). */
export function ssExtras(model: SsModelOptions | null, selection: SsSelection, ctx: SsContext): SsExtraLine[] {
  if (!model) return [];
  const out: SsExtraLine[] = [];
  for (const field of model.fields) {
    if (!ssFieldApplies(model, field, selection, ctx)) continue;
    const option = ssOption(field, selection[field.attr]);
    const amount = ssOptionDelta(field, option, ctx.widthMm);
    if (amount > 0 && option) {
      const suffix = field.pricing === "perBracket" ? ` (${ssBracketCount(ctx.widthMm)} uchwyty)` : "";
      out.push({ attr: field.attr, title: field.title, label: `${ssCleanLabel(option.label)}${suffix}`, amount });
    }
  }
  return out;
}

export type SsSupplierLine = { attr: string; ssLabel: string; v: string; ssText: string; applies: boolean };

export type SsSupplierOrder = {
  name: string;
  productId: number;
  ssTitle: string;
  widthMm: number;
  heightMm: number;
  /** id[attr] -> v dla WSZYSTKICH pól formularza + kolor lameli "6". */
  options: Record<string, string>;
  /** Czytelne linie dla biura, w kolejności pól formularza S&S (numer pola). */
  lines: SsSupplierLine[];
};

/** Zamówienie u dostawcy: wszystkie pola modelu (wybrane, domyślne dla
 * ukrytych i nieobowiązujących) + kolor lameli id[6]. */
export function ssBuildSupplierOrder(
  model: SsModelOptions,
  selection: SsSelection,
  ctx: SsContext,
  color: { v: string; ssText: string },
  widthMm: number,
  heightMm: number,
): SsSupplierOrder {
  const options: Record<string, string> = { "6": color.v };
  const lines: SsSupplierLine[] = [{ attr: "6", ssLabel: "Kolor", v: color.v, ssText: ssStripPrices(color.ssText), applies: true }];
  for (const field of model.fields) {
    const applies = ssFieldApplies(model, field, selection, ctx);
    const value = selection[field.attr] || field.default;
    const option = ssOption(field, value) || ssOption(field, field.default);
    options[field.attr] = option?.v || value;
    lines.push({ attr: field.attr, ssLabel: field.ssLabel, v: option?.v || value, ssText: ssStripPrices(option?.ssText || option?.label || ""), applies });
  }
  lines.sort((a, b) => Number(a.attr) - Number(b.attr));
  return { name: SS_SUPPLIER_NAME, productId: model.pid, ssTitle: model.ssTitle, widthMm, heightMm, options, lines };
}

/** Wiersze "Zamówienie u dostawcy" do wyceny (summary_rows) - dla biura. */
export function ssSupplierSummaryRows(order: SsSupplierOrder): Array<{ label: string; value: string; note: string }> {
  const rows = [
    {
      label: `Zamówienie u dostawcy (${order.name})`,
      value: `produkt ${order.ssTitle} [products_id ${order.productId}], ${order.widthMm} × ${order.heightMm} mm`,
      note: "szerokość × długość",
    },
  ];
  for (const line of order.lines) {
    rows.push({
      label: `${order.name}: ${line.ssLabel}`,
      value: `${line.ssText} [id[${line.attr}]=${line.v}]`,
      note: line.applies ? "" : "nie dotyczy - wartość domyślna formularza",
    });
  }
  return rows;
}

/** "Montaż bez wiercenia" włącz / wyłącz: attr 56 na pierwszą widoczną opcję
 * mocowania (albo "brak"), attr 22 na "Bezinwazyjne", gdy model ma taką klamrę
 * (bez niej S&S nie przyjmie mocowań bezinwazyjnych), a po wyłączeniu z
 * powrotem na domyślną zwykłą klamrę. */
export function ssApplyNoDrill(model: SsModelOptions, selection: SsSelection, on: boolean): SsSelection {
  const next = { ...selection };
  const f56 = ssField(model, "56");
  const f22 = ssField(model, "22");
  const none56 = ssNoneOption(f56);
  const bracketNonInvasive = f22?.options.find((option) => /bezinwazyjn/i.test(option.label)) || null;
  if (f56) {
    if (on) {
      const current = ssOption(f56, next["56"]);
      if (!current || current.v === none56?.v) {
        const first = ssVisibleOptions(f56).find((option) => option.v !== none56?.v);
        if (first) next["56"] = first.v;
      }
    } else if (none56) {
      next["56"] = none56.v;
    }
  }
  if (f22 && bracketNonInvasive) {
    if (on) next["22"] = bracketNonInvasive.v;
    else if (next["22"] === bracketNonInvasive.v) {
      const fallback = f22.default !== bracketNonInvasive.v ? f22.default : f22.options.find((option) => option.v !== bracketNonInvasive.v)?.v;
      if (fallback) next["22"] = fallback;
    }
  }
  return next;
}

/** Krótki opis wybranych opcji dla klienta (koszyk): taśma, przekładnia,
 * maskownica, uchwyty, bez wiercenia, dodatki z wartością inną niż "brak". */
export function ssCustomerSummary(model: SsModelOptions, selection: SsSelection, ctx: SsContext): string {
  const parts: string[] = [];
  for (const field of model.fields) {
    if (field.role === "hidden" || field.role === "fixed") continue;
    if (!ssFieldApplies(model, field, selection, ctx)) continue;
    const option = ssOption(field, selection[field.attr]);
    if (!option) continue;
    if (field.role === "optional" && field.attr !== "56" && (option.v === field.default || /^\s*(brak|nie|standard)\b/i.test(option.label))) continue;
    const label = field.attr === "16" ? ssTilterLabel(option.label) : ssCleanLabel(option.label);
    const title = field.attr === "7" ? (/drabinka/i.test(option.label) ? "" : "Taśma: ") : field.attr === "16" ? "" : `${field.title}: `;
    parts.push(`${title}${label}${option.code && field.attr === "7" ? ` (${option.code})` : ""}`);
  }
  return parts.join(" · ");
}
