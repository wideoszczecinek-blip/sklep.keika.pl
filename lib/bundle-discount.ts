// Rabat pakietowy (właściciel, decyzja #36 z 14.10.2026: „automatyczny rabat
// -30 % na 3. i każdą kolejną plisę w koszyku"). Reguły per produkt ustawia
// CRM (admin_automations.shop_bundle_discounts) i podaje w homepage_public
// jako config.bundle_discounts = { plisy: { from_qty, percent, label } } -
// tylko włączone. Sklep liczy z nich PODGLĄD w koszyku; rozliczenie wiążące
// robi CRM tym samym algorytmem (core/lib/shop_discount_codes.php,
// shop_bundle_discount_compute): najtańsze sztuki ponad (from_qty - 1)
// dostają -percent %, a te sztuki nie wchodzą do podstawy kodu rabatowego ani
// rabatu ratunkowego (pełna marża na pierwszych sztukach, bez kumulowania).
import { useSyncExternalStore } from "react";
import { roundMoney, type CartLineItem } from "@/lib/cart";

export type BundleRule = { fromQty: number; percent: number; label: string };
export type BundleRules = Record<string, BundleRule>;

const EMPTY: BundleRules = {};
let rules: BundleRules = EMPTY;
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function formatPercent(percent: number): string {
  return Number.isInteger(percent) ? String(percent) : percent.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
}

/** Zasilenie z konfiguracji sklepu (homepage_public → config.bundle_discounts). */
export function setBundleDiscountsFromConfig(config: unknown): void {
  const raw = (config as { bundle_discounts?: Record<string, { from_qty?: unknown; percent?: unknown; label?: unknown; enabled?: unknown }> } | null)
    ?.bundle_discounts;
  const next: BundleRules = {};
  if (raw && typeof raw === "object") {
    for (const [slug, rule] of Object.entries(raw)) {
      if (!rule || typeof rule !== "object") continue;
      if (rule.enabled !== undefined && Number(rule.enabled) !== 1) continue;
      const fromQty = Math.max(2, Math.min(20, Math.round(Number(rule.from_qty) || 0)));
      const percent = Math.max(1, Math.min(90, Number(rule.percent) || 0));
      if (!Number.isFinite(fromQty) || !Number.isFinite(percent) || fromQty < 2 || percent <= 0) continue;
      const label = String(rule.label || "").trim() || `${fromQty}. i każda kolejna sztuka -${formatPercent(percent)} %`;
      next[String(slug).trim().toLowerCase()] = { fromQty, percent, label };
    }
  }
  if (JSON.stringify(next) === JSON.stringify(rules)) return;
  rules = Object.keys(next).length ? next : EMPTY;
  listeners.forEach((listener) => listener());
}

export function getBundleDiscountRules(): BundleRules {
  return rules;
}

/** Reguły w komponencie - przeliczenie koszyka, gdy konfiguracja dojdzie. */
export function useBundleDiscountRules(): BundleRules {
  return useSyncExternalStore(
    subscribe,
    () => rules,
    () => EMPTY,
  );
}

export type BundleDiscountLine = { slug: string; units: number; percent: number; fromQty: number; savings: number; label: string };
export type BundleDiscount = {
  savings: number;
  /** Pełna cena sztuk objętych rabatem - nie wchodzi do podstawy kodu rabatowego. */
  discountedBase: number;
  units: number;
  lines: BundleDiscountLine[];
  /** Podpowiedź „dodaj jeszcze N” dla produktu z regułą, którego jest za mało. */
  hint: { slug: string; missing: number; percent: number; fromQty: number } | null;
};

/** Ten sam algorytm co shop_bundle_discount_compute() w CRM. */
export function calcBundleDiscount(items: CartLineItem[], rulesMap: BundleRules = rules): BundleDiscount {
  const out: BundleDiscount = { savings: 0, discountedBase: 0, units: 0, lines: [], hint: null };
  const slugs = Object.keys(rulesMap);
  if (!slugs.length) return out;
  const unitPrices: Record<string, number[]> = {};
  for (const item of items) {
    const slug = String(item.productSlug || "");
    if (!rulesMap[slug]) continue;
    const qty = Math.max(1, Math.round(item.qty || 1));
    const unit = qty > 0 ? (Number(item.total) || 0) / qty : 0;
    if (unit <= 0) continue;
    const list = unitPrices[slug] || (unitPrices[slug] = []);
    for (let i = 0; i < qty; i += 1) list.push(unit);
  }
  for (const slug of slugs) {
    const rule = rulesMap[slug];
    const prices = (unitPrices[slug] || []).slice().sort((a, b) => a - b);
    const n = prices.length;
    const discounted = n - (rule.fromQty - 1);
    if (n > 0 && discounted <= 0 && !out.hint) {
      out.hint = { slug, missing: rule.fromQty - n, percent: rule.percent, fromQty: rule.fromQty };
    }
    if (discounted <= 0) continue;
    const base = prices.slice(0, discounted).reduce((sum, price) => sum + price, 0);
    const savings = roundMoney((base * rule.percent) / 100);
    if (savings < 0.01) continue;
    out.savings = roundMoney(out.savings + savings);
    out.discountedBase = roundMoney(out.discountedBase + base);
    out.units += discounted;
    out.lines.push({ slug, units: discounted, percent: rule.percent, fromQty: rule.fromQty, savings, label: rule.label });
  }
  return out;
}

/** Opis pozycji „rabat-pakiet” - identyczny jak shop_bundle_discount_summary() w CRM. */
export function bundleDiscountSummary(bundle: BundleDiscount): string {
  const parts = bundle.lines.map((line) => `${line.label}: ${line.units} szt.`);
  return `Rabat pakietowy (${parts.join("; ")}) (-${bundle.savings.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł)`;
}

export function bundleDiscountHintText(bundle: BundleDiscount): string {
  if (!bundle.hint) return "";
  const { missing, percent, fromQty } = bundle.hint;
  const noun = missing === 1 ? "sztukę" : missing < 5 ? "sztuki" : "sztuk";
  return `Dodaj jeszcze ${missing} ${noun} - ${fromQty}. i każda kolejna sztuka ma -${formatPercent(percent)} %.`;
}
