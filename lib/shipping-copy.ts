// Jedno źródło zasad darmowej dostawy dla koszyka i tekstów na stronach.
// Koszyk (app/koszyk/page.tsx) liczy dostawę z tych samych stałych, więc
// obietnica na landingu zawsze zgadza się z kwotą w koszyku (Z01, 2026-10-28).

/** Próg darmowej dostawy w zł (po rabatach). */
export const FREE_SHIPPING_THRESHOLD = 79;

/** Koszt wysyłki poniżej progu, w zł. */
export const SHIPPING_FEE_AMOUNT = 12.9;

// Pilotaż (właściciel, 2026-09-24): plisy mają darmową dostawę od pierwszej
// sztuki, bez progu kwotowego. Wystarczy jedna plisa w koszyku.
export const FREE_SHIPPING_PILOT_SLUGS: ReadonlySet<string> = new Set(["plisy"]);

/** Czy produkt ma darmową dostawę już od 1 sztuki (pilotaż). */
export function hasFreeShippingFromOne(productSlug: string | null | undefined): boolean {
  return FREE_SHIPPING_PILOT_SLUGS.has(String(productSlug || ""));
}

/** Krótki tekst o darmowej dostawie dla danego produktu. */
export function freeShippingLabel(productSlug: string | null | undefined): string {
  return hasFreeShippingFromOne(productSlug)
    ? "Darmowa dostawa od 1 sztuki"
    : `Darmowa dostawa od ${FREE_SHIPPING_THRESHOLD} zł`;
}
