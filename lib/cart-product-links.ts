// Linki z koszyka do stron produktów (właściciel 8.11):
// - baner CAŁY DOM „Dodaj jeszcze 1 sztukę” prowadzi do produktu, który jest w koszyku (a gdy są różne - pyta który),
// - przycisk „Wróć do strony produktu” prowadzi na ostatnią stronę produktu, na której klient był.
// Gdy ostatnio oglądana strona to strona tego samego produktu, wracamy dokładnie tam (z krokiem i parametrami).

const NAZWY: Record<string, string> = {
  plisy: "Plisy",
  "plisy-dachowe": "Plisy dachowe",
  "rolety-dachowe": "Rolety dachowe",
  "moskitiery-ramkowe": "Moskitiery ramkowe",
  "moskitiery-drzwiowe": "Moskitiery drzwiowe",
  "moskitiery-plisowane": "Moskitiery plisowane",
  "moskitiery-przesuwne": "Moskitiery przesuwne",
  moskitiery: "Moskitiery",
  "rolety-dzien-noc": "Rolety dzień-noc",
  "rolety-kaseta-plaska": "Rolety w kasecie płaskiej",
  "rolety-kaseta-przestrzenna": "Rolety w kasecie przestrzennej",
  "rolety-mini": "Rolety mini",
  "rolety-rzymskie": "Rolety rzymskie",
  "rolety-tradycyjne": "Rolety tradycyjne",
  "rolety-wolnowiszace": "Rolety wolnowiszące",
  "rolety-zewnetrzne": "Rolety zewnętrzne",
  zaluzje: "Żaluzje",
  "zaluzje-fasadowe": "Żaluzje fasadowe",
  "zaluzje-pionowe": "Żaluzje pionowe",
  markizy: "Markizy",
  screeny: "Screeny",
};

/** Produkt, którego dotyczy adres (/plisy…, /?produkt=plisy…), albo "". */
export function slugZAdresu(adres: string): string {
  try {
    const url = new URL(adres || "/", "https://sklep.keika.pl");
    const slug = url.searchParams.get("produkt") || url.pathname.replace(/^\/+/, "").split("/")[0];
    return NAZWY[slug] ? slug : "";
  } catch {
    return "";
  }
}

/** Strona produktu: ostatnio oglądana, jeśli to ten sam produkt, inaczej jego strona główna. */
export function stronaProduktu(slug: string, ostatnia: string): string {
  if (slug && slugZAdresu(ostatnia) === slug) return ostatnia;
  if (NAZWY[slug]) return `/${slug}`;
  return ostatnia || "/";
}

export type LinkProduktu = { slug: string; href: string; label: string };

/** Różne produkty w koszyku (po kolei, bez powtórzeń) z linkami do ich stron. */
export function produktyWKoszyku(items: { productSlug: string; productLabel: string }[], ostatnia: string): LinkProduktu[] {
  const out: LinkProduktu[] = [];
  for (const it of items) {
    if (!it.productSlug || out.some((p) => p.slug === it.productSlug)) continue;
    out.push({ slug: it.productSlug, href: stronaProduktu(it.productSlug, ostatnia), label: NAZWY[it.productSlug] || it.productLabel || "Produkt" });
  }
  return out;
}

/** Podpis przycisku powrotu: „Wróć do: Plisy” albo „Wróć do sklepu”, gdy ostatnia strona nie była produktem. */
export function powrotEtykieta(ostatnia: string): string {
  const slug = slugZAdresu(ostatnia);
  return slug ? `Wróć do: ${NAZWY[slug]}` : "Wróć do sklepu";
}

/** Przycisk powrotu: ostatnia strona produktu; gdy ostatnia strona nie była produktem - produkt dodany do koszyka jako ostatni. */
export function powrot(ostatnia: string, items: { productSlug: string }[]): { href: string; label: string } {
  if (slugZAdresu(ostatnia)) return { href: ostatnia, label: powrotEtykieta(ostatnia) };
  const slug = items.length ? items[items.length - 1].productSlug : "";
  if (NAZWY[slug]) return { href: `/${slug}`, label: `Wróć do: ${NAZWY[slug]}` };
  return { href: ostatnia || "/", label: "Wróć do sklepu" };
}

/** Karta produktu dla pozycji koszyka (właściciel 9.11: „pozycje zamówienia muszą być linkami, które otwierają kartę produktu”). */
export function kartaProduktu(slug: string): string | null {
  return slug && NAZWY[slug] ? `/${slug}` : null;
}
