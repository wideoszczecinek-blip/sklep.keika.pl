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

/** Progi (28.10.2026, „CAŁY DOM"): sztuka o numerze k (1 = najdroższa)
 * dostaje procent ostatniego progu z fromQty <= k, np. [{2,10},{3,20}] =
 * druga sztuka -10 %, trzecia i każda kolejna -20 %. fromQty/percent to
 * pierwszy próg (zgodność ze starym kształtem). */
export type BundleTier = { fromQty: number; percent: number };
/** `group` (28.10.2026, właściciel: „rabat na całe zamówienie, produkty można
 * łączyć"): produkty z tą samą grupą liczą się razem - plisa + moskitiera to
 * jedno zamówienie z dwiema sztukami. Pusta grupa = produkt liczy się osobno. */
/** `wholeOrder` (28.10.2026, właściciel: „rabat na całą wartość koszyka - 2
 * produkty = -10 % na zamówienie, 3 i więcej = -20 %, 1 sztuka nic"): próg
 * wybrany po LICZBIE sztuk w puli obejmuje wszystkie sztuki, także najdroższą. */
export type BundleRule = { fromQty: number; percent: number; tiers: BundleTier[]; group: string; wholeOrder: boolean; label: string };
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
  const raw = (
    config as {
      bundle_discounts?: Record<
        string,
        { from_qty?: unknown; percent?: unknown; label?: unknown; enabled?: unknown; tiers?: unknown; group?: unknown; whole_order?: unknown }
      >;
    } | null
  )?.bundle_discounts;
  const next: BundleRules = {};
  if (raw && typeof raw === "object") {
    for (const [slug, rule] of Object.entries(raw)) {
      if (!rule || typeof rule !== "object") continue;
      if (rule.enabled !== undefined && Number(rule.enabled) !== 1) continue;
      const tiers: BundleTier[] = [];
      if (Array.isArray(rule.tiers)) {
        for (const t of rule.tiers as Array<{ from_qty?: unknown; percent?: unknown }>) {
          const tf = Math.round(Number(t?.from_qty) || 0);
          const tp = Number(t?.percent) || 0;
          if (tf < 2 || tf > 20 || tp < 1 || tp > 90) continue;
          tiers.push({ fromQty: tf, percent: tp });
        }
      }
      if (!tiers.length) {
        const fromQty = Math.max(2, Math.min(20, Math.round(Number(rule.from_qty) || 0)));
        const percent = Math.max(1, Math.min(90, Number(rule.percent) || 0));
        if (!Number.isFinite(fromQty) || !Number.isFinite(percent) || fromQty < 2 || percent <= 0) continue;
        tiers.push({ fromQty, percent });
      }
      tiers.sort((a, b) => a.fromQty - b.fromQty);
      const fromQty = tiers[0].fromQty;
      const percent = tiers[0].percent;
      const label = String(rule.label || "").trim() || `${fromQty}. i każda kolejna sztuka -${formatPercent(percent)} %`;
      const group = String(rule.group || "").trim();
      const wholeOrder = Number(rule.whole_order) === 1;
      next[String(slug).trim().toLowerCase()] = { fromQty, percent, tiers, group, wholeOrder, label };
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
  hint: { slug: string; missing: number; percent: number; fromQty: number; wholeOrder: boolean } | null;
};

/** Ten sam algorytm co shop_bundle_discount_compute() w CRM. `perimeterSavings`
 * = „wspólne rozliczenie obwodu" moskitier (lib/cart.ts
 * calcMoskitieryCombinedSavings) - rabat na całe zamówienie liczy się od ceny
 * PO tej korekcie, tak jak liczył się SEZON20. */
export function calcBundleDiscount(items: CartLineItem[], rulesMap: BundleRules = rules, perimeterSavings = 0): BundleDiscount {
  const out: BundleDiscount = { savings: 0, discountedBase: 0, units: 0, lines: [], hint: null };
  const slugs = Object.keys(rulesMap);
  if (!slugs.length) return out;
  // Klucz puli: grupa (sztuki różnych produktów razem) albo sam slug - ten
  // sam podział co w shop_bundle_discount_compute() w CRM.
  const poolKey = (slug: string) => (rulesMap[slug].group ? `grupa:${rulesMap[slug].group}` : slug);
  const unitPrices: Record<string, number[]> = {};
  const poolRule: Record<string, BundleRule> = {};
  const poolHasMosk: Record<string, boolean> = {};
  for (const item of items) {
    const slug = String(item.productSlug || "");
    if (!rulesMap[slug]) continue;
    const qty = Math.max(1, Math.round(item.qty || 1));
    const unit = qty > 0 ? (Number(item.total) || 0) / qty : 0;
    if (unit <= 0) continue;
    const key = poolKey(slug);
    poolRule[key] = poolRule[key] || rulesMap[slug];
    if (slug === "moskitiery-ramkowe") poolHasMosk[key] = true;
    const list = unitPrices[key] || (unitPrices[key] = []);
    for (let i = 0; i < qty; i += 1) list.push(unit);
  }
  for (const slug of Object.keys(unitPrices)) {
    const rule = poolRule[slug];
    const prices = (unitPrices[slug] || []).slice().sort((a, b) => a - b);
    const n = prices.length;
    // Podpowiedź: najbliższy próg, którego koszyk jeszcze nie osiągnął
    // (1 szt. -> „dodaj 1, -10 %"; 2 szt. -> „dodaj 1, -20 %").
    const nextTier = rule.tiers.find((t) => t.fromQty > n);
    if (n > 0 && nextTier && !out.hint) {
      out.hint = { slug, missing: nextTier.fromQty - n, percent: nextTier.percent, fromQty: nextTier.fromQty, wholeOrder: rule.wholeOrder };
    }
    if (rule.wholeOrder) {
      let pct = 0;
      for (const t of rule.tiers) if (n >= t.fromQty) pct = t.percent;
      if (pct <= 0) continue;
      const base = Math.max(0, prices.reduce((sum, price) => sum + price, 0) - (poolHasMosk[slug] ? perimeterSavings : 0));
      const savings = roundMoney((base * pct) / 100);
      if (savings < 0.01) continue;
      out.savings = roundMoney(out.savings + savings);
      out.discountedBase = roundMoney(out.discountedBase + base);
      out.units += n;
      out.lines.push({ slug, units: n, percent: pct, fromQty: rule.fromQty, savings, label: rule.label });
      continue;
    }
    // Najdroższa sztuka ma numer 1 i pełną cenę; tańsze dostają próg wg
    // numeru - ten sam algorytm co shop_bundle_discount_compute() w CRM.
    let base = 0;
    let savings = 0;
    let discounted = 0;
    let maxPercent = 0;
    prices.forEach((price, i) => {
      const rank = n - i;
      let pct = 0;
      for (const t of rule.tiers) if (rank >= t.fromQty) pct = t.percent;
      if (pct <= 0) return;
      base += price;
      savings += (price * pct) / 100;
      discounted += 1;
      if (pct > maxPercent) maxPercent = pct;
    });
    savings = roundMoney(savings);
    if (discounted <= 0 || savings < 0.01) continue;
    out.savings = roundMoney(out.savings + savings);
    out.discountedBase = roundMoney(out.discountedBase + base);
    out.units += discounted;
    out.lines.push({ slug, units: discounted, percent: maxPercent, fromQty: rule.fromQty, savings, label: rule.label });
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
  const { missing, percent, fromQty, wholeOrder } = bundle.hint;
  const noun = missing === 1 ? "sztukę" : missing < 5 ? "sztuki" : "sztuk";
  if (wholeOrder) return `Dodaj jeszcze ${missing} ${noun} - całe zamówienie będzie miało -${formatPercent(percent)} %.`;
  const ordinal = fromQty === 2 ? "druga" : fromQty === 3 ? "trzecia" : `${fromQty}.`;
  return `Dodaj jeszcze ${missing} ${noun} - ${ordinal} sztuka ma -${formatPercent(percent)} %.`;
}
