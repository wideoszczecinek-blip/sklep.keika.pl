// Shared SEZON20 promo-code plumbing - used by the top-of-page promo banner
// (app/page.tsx), the configurator's own price-adjacent banner
// (features/moskitiery-ramkowe/ConfiguratorPanel.tsx), and checkout
// (app/koszyk/page.tsx, which auto-applies whatever's in localStorage on
// mount). All three read/write the exact same localStorage key so
// activating the code from ANY of them carries through everywhere else -
// the custom event below is what makes that instant rather than only
// visible after a remount/reload, since the top banner and the
// configurator panel are two separately-mounted components on the same
// page with no parent/child relationship to pass state through.
//
// The 20%/"o 20% taniej" wording is just copy - the real discount type/
// value/amount always comes from discount_code_check.php (same endpoint
// /koszyk's own "Kod rabatowy" field uses), never hardcoded here, so a
// change to the code's real value in the CRM is reflected automatically.

export const ACTIVE_PROMO_STORAGE_KEY = "keika_shop_active_promo_code";
export const PROMO_CODE = "SEZON20";
export const PROMO_ACTIVATED_EVENT = "keika:promo-activated";

export type PromoPreview = {
  code: string;
  type: "percent" | "amount";
  value: number;
  amount: number;
};

export function isPromoActive(code: string = PROMO_CODE): boolean {
  try {
    return window.localStorage.getItem(ACTIVE_PROMO_STORAGE_KEY) === code;
  } catch {
    return false;
  }
}

/** Persists the activation and notifies every other mounted component on
 * this page in the same tick - localStorage alone only fires a `storage`
 * event in OTHER tabs/windows, never the tab that made the write. */
export function activatePromoCode(code: string = PROMO_CODE): void {
  try {
    window.localStorage.setItem(ACTIVE_PROMO_STORAGE_KEY, code);
  } catch {
    // localStorage niedostępny - aktywacja widoczna tylko do końca tej wizyty.
  }
  window.dispatchEvent(new CustomEvent(PROMO_ACTIVATED_EVENT, { detail: { code } }));
}

/** Real discount preview for a given subtotal - same endpoint /koszyk's
 * "Kod rabatowy" field already calls. Returns null on any failure/inactive
 * code (error-swallowing by design - a broken promo preview must never
 * block the page it's decorating). */
export async function fetchPromoPreview(subtotal: number, code: string = PROMO_CODE): Promise<PromoPreview | null> {
  if (!Number.isFinite(subtotal) || subtotal <= 0) return null;
  try {
    const response = await fetch("https://crm-keika.groovemedia.pl/biuro/api/shop-public/discount_code_check.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subtotal }),
    });
    const json = (await response.json()) as { ok: boolean; discount?: PromoPreview };
    return json.ok && json.discount ? json.discount : null;
  } catch {
    return null;
  }
}

/** Applies a preview's discount to one price the same way regardless of
 * type - percent scales, amount subtracts flat, both floored at 0. Used to
 * show "przekreślona cena standardowa" style displays anywhere a price
 * appears (top banner's starting price, configurator's line total, ...)
 * without needing a fresh server round-trip for every single price on the
 * page. */
export function applyPromoToPrice(price: number, preview: PromoPreview | null): number | null {
  if (!preview || !Number.isFinite(price) || price <= 0) return null;
  if (preview.type === "percent") {
    return Math.max(0, price * (1 - preview.value / 100));
  }
  return Math.max(0, price - preview.value);
}
