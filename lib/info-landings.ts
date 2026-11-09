// Informacyjne strony produktowe ("landingi ofertowe") bez konfiguratora:
// rolety rzymskie, żaluzje pionowe (żaluzje poziome od 2026-10-17 to pełny
// produkt - features/rolety/, trasa /zaluzje), rolety
// zewnętrzne, żaluzje fasadowe, markizy, moskitiery drzwiowe / przesuwne /
// plisowane. Zamiast ceny - prośba o wycenę (lead w CRM) albo rozmowa.
//
// Włącznik: od 10.11.2026 WŁĄCZONE domyślnie (właściciel: „wszystkie produkty
// na stronie głównej muszą być dostępne, w nich opis … konfigurator w budowie,
// zapraszamy do formularza wyceny”). NEXT_PUBLIC_INFO_LANDINGS=0 wyłącza awaryjnie.
export const INFO_LANDINGS_ENABLED = process.env.NEXT_PUBLIC_INFO_LANDINGS !== "0";

/** slug (z linku w menu albo z etykiety) -> ścieżka landingu */
// Rolety tradycyjne i dzień-noc mają konfiguratory (features/rolety/) za bramką
// podglądu - od 10.11.2026 klienci widzą pod tymi adresami stronę informacyjną
// (proxy.ts przepisuje na /oferta/<slug>), właściciel w podglądzie konfigurator.
export const INFO_LANDING_ROUTES: Record<string, string> = {
  "rolety-tradycyjne": "/rolety-tradycyjne",
  "rolety-dzien-noc": "/rolety-dzien-noc",
  zadaszenia: "/zadaszenia",
  shuttersy: "/shuttersy",
  "moskitiery-do-okien-dachowych": "/moskitiery-do-okien-dachowych",
  "rolety-rzymskie": "/rolety-rzymskie",
  "zaluzje-pionowe": "/zaluzje-pionowe",
  verticale: "/zaluzje-pionowe",
  screeny: "/screeny",
  "screen-system": "/screeny",
  "rolety-zewnetrzne": "/rolety-zewnetrzne",
  "zaluzje-fasadowe": "/zaluzje-fasadowe",
  markizy: "/markizy",
  "moskitiery-drzwiowe": "/moskitiery-drzwiowe",
  "moskitiery-przesuwne": "/moskitiery-przesuwne",
  przesuwne: "/moskitiery-przesuwne",
  "moskitiery-plisowane": "/moskitiery-plisowane",
  plisowane: "/moskitiery-plisowane",
};

const ROUTE_SET = new Set(Object.values(INFO_LANDING_ROUTES));

function normalizeLabel(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Link landingu dla pozycji menu z CRM (etykieta w grupie) - null, gdy
 * landingi są wyłączone albo etykieta nie ma swojego landingu. Używane w
 * resolveMenuFallbackLink() (app/home-client.tsx) PRZED starymi regułami. */
export function resolveInfoLandingMenuLink(groupSlugRaw: string, labelRaw: string): string | null {
  if (!INFO_LANDINGS_ENABLED) return null;
  const group = String(groupSlugRaw || "").trim().toLowerCase();
  const label = normalizeLabel(labelRaw);
  if (group === "oslony-wewnetrzne") {
    if (/^rolety tradycyjne$/.test(label)) return "/rolety-tradycyjne";
    if (/^rolety dzien ?-? ?noc$/.test(label)) return "/rolety-dzien-noc";
    if (/^(zaluzje pionowe|verticale)$/.test(label)) return "/zaluzje-pionowe";
    if (/^rolety rzymskie$/.test(label)) return "/rolety-rzymskie";
  }
  if (group === "oslony-zewnetrzne") {
    if (/^rolety zewnetrzne$/.test(label)) return "/rolety-zewnetrzne";
    if (/^zaluzje fasadowe$/.test(label)) return "/zaluzje-fasadowe";
    if (/^(screeny|screen system|screen)$/.test(label)) return "/screeny";
  }
  if (group === "taras") {
    if (/^markizy$/.test(label)) return "/markizy";
    if (/^zadaszenia$/.test(label)) return "/zadaszenia";
    if (/^(shuttersy|shutters)$/.test(label)) return "/shuttersy";
  }
  if (group === "moskitiery") {
    if (/^moskitiery do okien dachowych$/.test(label)) return "/moskitiery-do-okien-dachowych";
    if (/^moskitiery drzwiowe$/.test(label)) return "/moskitiery-drzwiowe";
    if (/^(moskitiery )?przesuwne$/.test(label)) return "/moskitiery-przesuwne";
    if (/^(moskitiery )?plisowane$/.test(label)) return "/moskitiery-plisowane";
  }
  return null;
}

/** Ścieżka landingu dla sluga produktu, albo null gdy wyłączone / brak. */
export function infoLandingHref(slug: string): string | null {
  if (!INFO_LANDINGS_ENABLED) return null;
  return INFO_LANDING_ROUTES[String(slug || "").trim().toLowerCase()] || null;
}

/** Czy ten link z menu prowadzi do włączonego landingu informacyjnego. */
export function isInfoLandingHref(href: string): boolean {
  if (!INFO_LANDINGS_ENABLED) return false;
  const path = String(href || "").trim().split(/[?#]/)[0];
  return ROUTE_SET.has(path);
}
