// Identyfikatory produktów katalogowych (Z02, 28.10.2026) - jedno źródło dla
// plików produktowych (/feeds/google-merchant.xml -> g:id,
// /feeds/products.json -> id; oba czytają CATALOG z lib/agent-catalog.ts,
// który bierze sku stąd) i zdarzeń Meta (content_ids w ViewContent,
// AddToCart, InitiateCheckout, QuickPrice). Dzięki temu Meta dopasowuje
// zdarzenia do pozycji katalogu (reklamy dynamiczne / remarketing produktu).
//
// Czysty moduł bez zależności - importowany i po stronie serwera (feedy),
// i w przeglądarce (lib/tracking.ts, lib/cart.ts).

export const CATALOG_SKU_BY_SLUG = {
  "moskitiery-ramkowe": "moskitiera-ramkowa-na-wymiar",
  plisy: "plisa-okienna-na-wymiar",
  "rolety-dachowe": "roleta-do-okna-dachowego-na-wymiar",
  "plisy-dachowe": "plisa-do-okna-dachowego-na-wymiar",
} as const;

export type CatalogSlug = keyof typeof CATALOG_SKU_BY_SLUG;

// Slugi, pod którymi ten sam produkt występuje w CRM (np. „Korekta ceny”
// rolet dachowych) - ten sam sku co produkt główny.
const SLUG_ALIASES: Record<string, CatalogSlug> = {
  "roleta-dachowa-dekolux": "rolety-dachowe",
};

/** sku z feedów dla sluga produktu sklepu. Produkty spoza feedów (np.
 * żaluzje) nie mają pozycji w katalogu - zwracamy sam slug, żeby zdarzenie
 * nadal niosło stabilny identyfikator. */
export function skuForSlug(slug: string): string {
  const key = String(slug || "").trim();
  if (!key) return "";
  const resolved = (Object.prototype.hasOwnProperty.call(CATALOG_SKU_BY_SLUG, key) ? key : SLUG_ALIASES[key]) as
    | CatalogSlug
    | undefined;
  return resolved ? CATALOG_SKU_BY_SLUG[resolved] : key;
}
