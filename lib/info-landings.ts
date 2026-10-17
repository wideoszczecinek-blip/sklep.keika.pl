// Informacyjne strony produktowe ("landingi ofertowe") bez konfiguratora:
// rolety tradycyjne / dzień-noc / rzymskie, żaluzje pionowe, rolety
// zewnętrzne, żaluzje fasadowe, markizy, moskitiery drzwiowe / przesuwne /
// plisowane. Zamiast ceny - prośba o wycenę (lead w CRM) albo rozmowa.
//
// Włącznik: NEXT_PUBLIC_INFO_LANDINGS=1 (lokalnie w .env.local; na Vercelu
// NIEUSTAWIONY, więc strony odpowiadają 404, a menu sklepu nie zmienia się -
// właściciel ogląda je u siebie przed publikacją, 2026-10-17). Publikacja =
// ustawienie tej zmiennej w projekcie Vercel i redeploy; bez zmian w kodzie.
export const INFO_LANDINGS_ENABLED = process.env.NEXT_PUBLIC_INFO_LANDINGS === "1";

/** slug (z linku w menu albo z etykiety) -> ścieżka landingu */
export const INFO_LANDING_ROUTES: Record<string, string> = {
  "rolety-tradycyjne": "/rolety-tradycyjne",
  "oslony-wewnetrzne": "/rolety-tradycyjne",
  "rolety-dzien-noc": "/rolety-dzien-noc",
  "rolety-rzymskie": "/rolety-rzymskie",
  zaluzje: "/zaluzje-pionowe",
  "zaluzje-pionowe": "/zaluzje-pionowe",
  verticale: "/zaluzje-pionowe",
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
    if (/^(zaluzje|zaluzje pionowe|verticale)$/.test(label)) return "/zaluzje-pionowe";
    if (/^rolety rzymskie$/.test(label)) return "/rolety-rzymskie";
  }
  if (group === "oslony-zewnetrzne") {
    if (/^rolety zewnetrzne$/.test(label)) return "/rolety-zewnetrzne";
    if (/^zaluzje fasadowe$/.test(label)) return "/zaluzje-fasadowe";
  }
  if (group === "taras" && /^markizy$/.test(label)) return "/markizy";
  if (group === "moskitiery") {
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
