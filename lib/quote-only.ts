// Produkty „na wycenę” (10.11.2026): bez konfiguratora, w tym samym układzie
// co plisy i rolety dachowe (widok produktu w app/home-client.tsx - zdjęcia,
// opis, galeria, FAQ z CRM → Sklep WWW: Produkty i konfiguratory), a w miejscu
// konfiguratora komunikat „konfigurator zamówień online w budowie” i formularz
// wyceny (features/oferta/QuotePanel.tsx → lead w CRM).
//
// Właściciel 10.11 wieczór: układ jak plisy / rolety dachowe; treści i zdjęcia
// opracuje produkt po produkcie później (w CRM). Do tego czasu strony widzi
// tylko podgląd właściciela (proxy.ts: IP biura albo ciasteczko z ?podglad=…).

/** slug produktu w CRM -> publiczny adres strony + slug treści w features/oferta/content. */
export const QUOTE_ONLY_PRODUCTS: Record<string, { path: string; contentSlug: string }> = {
  "rolety-rzymskie": { path: "/rolety-rzymskie", contentSlug: "rolety-rzymskie" },
  verticale: { path: "/zaluzje-pionowe", contentSlug: "zaluzje-pionowe" },
  "rolety-zewnetrzne": { path: "/rolety-zewnetrzne", contentSlug: "rolety-zewnetrzne" },
  "zaluzje-fasadowe": { path: "/zaluzje-fasadowe", contentSlug: "zaluzje-fasadowe" },
  "screen-system": { path: "/screeny", contentSlug: "screeny" },
  markizy: { path: "/markizy", contentSlug: "markizy" },
  zadaszenia: { path: "/zadaszenia", contentSlug: "zadaszenia" },
  shuttersy: { path: "/shuttersy", contentSlug: "shuttersy" },
  "moskitiery-do-okien-dachowych": { path: "/moskitiery-do-okien-dachowych", contentSlug: "moskitiery-do-okien-dachowych" },
  "moskitiery-drzwiowe": { path: "/moskitiery-drzwiowe", contentSlug: "moskitiery-drzwiowe" },
  "moskitiery-przesuwne": { path: "/moskitiery-przesuwne", contentSlug: "moskitiery-przesuwne" },
  "moskitiery-plisowane": { path: "/moskitiery-plisowane", contentSlug: "moskitiery-plisowane" },
};

export function isQuoteOnlySlug(slug: string): boolean {
  return Object.prototype.hasOwnProperty.call(QUOTE_ONLY_PRODUCTS, String(slug || "").trim().toLowerCase());
}

/** Slug produktu w CRM dla sluga treści / adresu strony (np. "screeny" -> "screen-system"). */
export function quoteOnlyCrmSlug(contentSlug: string): string {
  const wanted = String(contentSlug || "").trim().toLowerCase();
  const found = Object.entries(QUOTE_ONLY_PRODUCTS).find(([, entry]) => entry.contentSlug === wanted);
  return found ? found[0] : wanted;
}

function normalizeLabel(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Link pozycji menu CRM dla produktu na wycenę - zawsze /produkt/<slug CRM>,
 * bo część pozycji w CRM prowadzi do wspólnej kategorii (/kategoria/taras),
 * a widok produktu potrzebuje własnego sluga. null = to nie produkt na wycenę. */
export function quoteOnlyMenuLink(groupSlugRaw: string, labelRaw: string): string | null {
  const group = String(groupSlugRaw || "").trim().toLowerCase();
  const label = normalizeLabel(labelRaw);
  const map: Array<[string, RegExp, string]> = [
    ["oslony-wewnetrzne", /^rolety rzymskie$/, "rolety-rzymskie"],
    ["oslony-wewnetrzne", /^(verticale|zaluzje pionowe)$/, "verticale"],
    ["oslony-zewnetrzne", /^rolety zewnetrzne$/, "rolety-zewnetrzne"],
    ["oslony-zewnetrzne", /^zaluzje fasadowe$/, "zaluzje-fasadowe"],
    ["oslony-zewnetrzne", /^(screeny|screen system|screen)$/, "screen-system"],
    ["taras", /^markizy$/, "markizy"],
    ["taras", /^zadaszenia$/, "zadaszenia"],
    ["taras", /^(shuttersy|shutters)$/, "shuttersy"],
    ["moskitiery", /^moskitiery do okien dachowych$/, "moskitiery-do-okien-dachowych"],
    ["moskitiery", /^moskitiery drzwiowe$/, "moskitiery-drzwiowe"],
    ["moskitiery", /^(moskitiery )?przesuwne$/, "moskitiery-przesuwne"],
    ["moskitiery", /^(moskitiery )?plisowane$/, "moskitiery-plisowane"],
  ];
  const hit = map.find(([g, re]) => g === group && re.test(label));
  return hit ? `/produkt/${hit[2]}` : null;
}

/** Podgląd właściciela w przeglądarce: proxy.ts ustawia czytelne ciasteczko
 * keika_podglad_ui=1 ruchowi z bramki podglądu (IP biura / ?podglad=…). Wtedy
 * kliknięcie produktu na wycenę w menu otwiera jego stronę zamiast „w budowie”. */
export function previewUiEnabled(): boolean {
  if (typeof document === "undefined") return false;
  return /(?:^|;\s*)keika_podglad_ui=1(?:;|$)/.test(document.cookie || "");
}
