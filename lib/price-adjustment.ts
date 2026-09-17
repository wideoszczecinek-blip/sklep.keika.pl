// Korekta procentowa ceny per produkt sklepu (właściciel, 2026-09-17: "+10 %
// albo -15 %, żebym mógł manipulować ceną"). Wartość ustawia się w CRM:
// Sklep WWW → Produkty → [produkt] → "Korekta ceny (%)" i przychodzi w
// homepage_public jako product_groups[].products[].price_adjustment_percent.
//
// Mały magazyn poza Reactem + useSyncExternalStore: home-client zasila go
// po każdym wczytaniu konfiguracji, a komponenty cen (moskitiery za mb,
// rolety dachowe z tabeli, plisy z profilu) odczytują go hookiem i
// przeliczają swoje ceny bazowe. Serwer (quote_save.php) liczy stawkę za mb
// z tego, co przyszło z koszyka, więc korekta po stronie klienta jest
// spójna z zapisem wyceny.
import { useSyncExternalStore } from "react";

type AdjustmentMap = Record<string, number>;

let adjustments: AdjustmentMap = {};
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function normalizePriceAdjustmentPercent(value: unknown): number {
  const parsed = typeof value === "number" ? value : Number(String(value ?? "").replace(",", "."));
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(-95, Math.min(500, Math.round(parsed * 100) / 100));
}

/** Zasilenie magazynu z konfiguracji sklepu (product_groups). */
export function setProductPriceAdjustmentsFromConfig(config: unknown): void {
  const next: AdjustmentMap = {};
  const groups = (config as { product_groups?: Array<{ products?: Array<{ slug?: string; price_adjustment_percent?: unknown }> }> } | null)
    ?.product_groups;
  for (const group of Array.isArray(groups) ? groups : []) {
    for (const product of Array.isArray(group?.products) ? group.products : []) {
      const slug = String(product?.slug || "").trim();
      if (!slug) continue;
      const percent = normalizePriceAdjustmentPercent(product?.price_adjustment_percent);
      if (percent !== 0) next[slug] = percent;
    }
  }
  const changed =
    Object.keys(next).length !== Object.keys(adjustments).length ||
    Object.entries(next).some(([slug, percent]) => adjustments[slug] !== percent);
  if (!changed) return;
  adjustments = next;
  listeners.forEach((listener) => listener());
}

export function getProductPriceAdjustment(slug: string): number {
  return adjustments[slug] || 0;
}

/** Korekta (%) produktu; 0 przed wczytaniem konfiguracji i na serwerze. */
export function useProductPriceAdjustment(slug: string): number {
  return useSyncExternalStore(
    subscribe,
    () => adjustments[slug] || 0,
    () => 0,
  );
}

export function applyPriceAdjustment(amount: number, percent: number): number {
  if (!Number.isFinite(amount) || !percent) return amount;
  return Math.round(Math.max(0, amount * (1 + percent / 100)) * 100) / 100;
}
