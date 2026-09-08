/**
 * Shared cart data layer (localStorage-backed) used by the homepage's
 * embedded configurator (app/page.tsx) and the /koszyk review page.
 *
 * This is the first real writer of this storage key on the site - before
 * this, the header's "Koszyk" badge only ever read (never wrote) a handful
 * of guessed localStorage keys, and #koszyk pointed nowhere. Checkout
 * itself is still single-order/Stripe (see app/api/orders/create) - /koszyk
 * is a real multi-item review/edit list for now, checkout-per-item until
 * a real multi-item order endpoint exists.
 */

export type CartLineItem = {
  id: string;
  productSlug: string;
  productLabel: string;
  hardwareLabel: string;
  meshLabel: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  price: number; // per-unit price
  total: number; // price * qty
  imageUrl?: string;
  createdAt: string;
  /** One-time oversized-parcel surcharge (zł) this item's dimensions require,
   * 0/undefined if none. Charged once per order, not once per item - see
   * app/koszyk/page.tsx. */
  oversizeSurchargeAmount?: number;
  /** rolety-dachowe only: the chosen window model ("Velux MK04") or "Wymiar
   * własny" for a manual entry - undefined for other products. Additive/
   * optional so existing stored items from before this field existed still
   * parse fine. */
  modelLabel?: string;
  /** plisy only: the chosen mounting type ("Bezinwazyjny") - undefined for
   * other products and for plisy items added before this field existed
   * (mount_options may also be empty on the CRM profile, skipping the step
   * entirely). Additive/optional, same convention as modelLabel above. */
  mountLabel?: string;
  /** plisy only: real hex colours of the chosen fabric/hardware, so
   * /koszyk can render the same tinted PlisaPreview thumbnail as the
   * configurator instead of a plain/blank icon. Undefined for other
   * products and for plisy items added before this field existed (falls
   * back to the plain thumb, same convention as imageUrl/mountLabel). */
  fabricColor?: string;
  hardwareColor?: string;
};

export type CartSummary = {
  items: number;
  total: number;
};

export const CART_STORAGE_KEY = "keika_cart";
const CART_LEGACY_STORAGE_KEYS = ["shop_cart", "cart"];

function readCartRows(): unknown[] {
  if (typeof window === "undefined") return [];

  const keys = [CART_STORAGE_KEY, ...CART_LEGACY_STORAGE_KEYS];
  let parsed: unknown = null;
  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      parsed = JSON.parse(raw);
      break;
    } catch {
      // ignore invalid json
    }
  }
  if (!parsed) return [];
  return Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : [];
}

export function readCartItems(): CartLineItem[] {
  return readCartRows()
    .filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object")
    .map((row) => {
      const qtyRaw = Number(row.qty ?? row.quantity ?? row.count ?? 1);
      const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;
      const price = Number(row.price ?? row.unit_price ?? row.unitPrice ?? 0) || 0;
      const explicitTotal = Number(row.total ?? row.line_total ?? row.price_total ?? NaN);
      const total = Number.isFinite(explicitTotal) ? explicitTotal : price * qty;
      return {
        id: String(row.id ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`),
        productSlug: String(row.productSlug ?? ""),
        productLabel: String(row.productLabel ?? "Produkt"),
        hardwareLabel: String(row.hardwareLabel ?? ""),
        meshLabel: String(row.meshLabel ?? ""),
        widthMm: Number(row.widthMm ?? 0) || 0,
        heightMm: Number(row.heightMm ?? 0) || 0,
        qty,
        price,
        total: Number.isFinite(total) ? total : 0,
        imageUrl: row.imageUrl ? String(row.imageUrl) : undefined,
        createdAt: String(row.createdAt ?? new Date().toISOString()),
        oversizeSurchargeAmount: Number(row.oversizeSurchargeAmount ?? 0) || 0,
        modelLabel: row.modelLabel ? String(row.modelLabel) : undefined,
        mountLabel: row.mountLabel ? String(row.mountLabel) : undefined,
        fabricColor: row.fabricColor ? String(row.fabricColor) : undefined,
        hardwareColor: row.hardwareColor ? String(row.hardwareColor) : undefined,
      } satisfies CartLineItem;
    });
}

export function writeCartItems(items: CartLineItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify({ items }));
  for (const key of CART_LEGACY_STORAGE_KEYS) {
    window.localStorage.removeItem(key);
  }
  window.dispatchEvent(new Event("keika-cart-updated"));
}

/** True when `items` already contains a line functionally identical to
 * `candidate` (same product/specs/qty/price, ignoring the random `id`) -
 * used by the resume flows (?resume_token= on the homepage, /wizyta/<code>)
 * to avoid duplicating a cart line that's already there. Real bug found
 * live 2026-09-06: reopening a saved link on the *same* device/tab that
 * never lost its cart re-added every restored item on top of what was
 * already there, silently doubling the cart. Deliberately NOT used by the
 * real "Dodaj do koszyka" button - two genuinely separate clicks with
 * identical specs are two real order lines (e.g. two matching windows), not
 * a duplicate to collapse. */
export function findEquivalentCartItem(items: CartLineItem[], candidate: CartLineItem): CartLineItem | undefined {
  return items.find(
    (item) =>
      item.productSlug === candidate.productSlug &&
      item.hardwareLabel === candidate.hardwareLabel &&
      item.meshLabel === candidate.meshLabel &&
      item.widthMm === candidate.widthMm &&
      item.heightMm === candidate.heightMm &&
      item.qty === candidate.qty &&
      Math.abs(item.total - candidate.total) < 0.01 &&
      (item.modelLabel || "") === (candidate.modelLabel || "") &&
      (item.mountLabel || "") === (candidate.mountLabel || ""),
  );
}

export function addCartItem(item: CartLineItem): CartLineItem[] {
  const items = [...readCartItems(), item];
  writeCartItems(items);
  // Meta AddToCart - jedyny wspólny punkt dodania pozycji (homepage +
  // "Edytuj pozycję" na /koszyk idzie przez updateCartItemConfig, nie tędy).
  void import("@/lib/tracking")
    .then(({ track }) => {
      track("AddToCart", {
        value: item.total,
        currency: "PLN",
        content_ids: [item.productSlug],
        content_name: item.productLabel,
        content_type: "product",
        contents: [{ id: item.productSlug, quantity: item.qty, item_price: item.price }],
        num_items: item.qty,
      });
    })
    .catch(() => {
      /* tracking never blocks the cart */
    });
  void trackCartEventToCrm("add_to_cart", item.productSlug, item);
  return items;
}

export function clearCart(): void {
  writeCartItems([]);
}

export function removeCartItem(id: string): CartLineItem[] {
  const removed = readCartItems().find((item) => item.id === id);
  const items = readCartItems().filter((item) => item.id !== id);
  writeCartItems(items);
  if (removed) {
    void trackCartEventToCrm("remove_from_cart", removed.productSlug, removed);
  }
  return items;
}

/** Separate from the Meta AddToCart tracking above (which only reaches
 * Meta's own dashboard) - this is the CRM's own visitor-tracking table, so
 * cart abandonment ("do którego miejsca dochodzą") is actually queryable
 * in-house, not just visible as an aggregate ad-platform funnel number. */
function trackCartEventToCrm(eventName: string, productSlug: string, item: CartLineItem): void {
  if (typeof window === "undefined") return;
  let sessionToken = "";
  try {
    sessionToken = window.sessionStorage.getItem("keika_shop_session_token") || "";
  } catch {
    // sessionStorage niedostępny - event i tak poleci bez grupowania w sesję.
  }
  void import("@/lib/shop-public")
    .then(({ trackStorefrontEvent }) =>
      trackStorefrontEvent({
        event_name: eventName,
        event_label: productSlug,
        page_slug: window.location.pathname + window.location.search,
        session_token: sessionToken,
        device_type: window.innerWidth < 768 ? "mobile" : "desktop",
        meta: { product_slug: productSlug, qty: item.qty, total: item.total },
      }),
    )
    .catch(() => {
      /* tracking never blocks the cart */
    });
}

export function updateCartItemQty(id: string, qty: number): CartLineItem[] {
  const safeQty = Math.max(1, Math.round(qty) || 1);
  const items = readCartItems().map((item) =>
    item.id === id ? { ...item, qty: safeQty, total: item.price * safeQty } : item,
  );
  writeCartItems(items);
  return items;
}

/** Replaces a cart item's whole configuration (color/mesh/dimensions/qty/
 * price/...) in place, keeping its id and position - used by /koszyk's
 * "Edytuj pozycję" modal, unlike updateCartItemQty above which only ever
 * touches quantity. */
export function updateCartItemConfig(
  id: string,
  patch: Omit<CartLineItem, "id" | "productSlug" | "productLabel" | "createdAt">,
): CartLineItem[] {
  const items = readCartItems().map((item) => (item.id === id ? { ...item, ...patch } : item));
  writeCartItems(items);
  return items;
}

export function summarizeCartItems(items: CartLineItem[]): CartSummary {
  let count = 0;
  let total = 0;
  for (const item of items) {
    count += item.qty;
    total += item.total;
  }
  return { items: Math.max(0, Math.round(count)), total: Math.max(0, total) };
}

/** One-time oversized-parcel surcharge for the whole cart: the highest tier
 * required by any single item, charged once per order - not summed per item.
 * Mirrors what the cart page's own checkout total already adds on top of
 * the item subtotal (see koszyk/page.tsx's "Razem" row), shared here so
 * every other place that shows a cart total (e.g. the header mini-cart
 * badge) can include it too instead of quietly under-counting. */
export function calcCartOversizeSurcharge(items: CartLineItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.oversizeSurchargeAmount || 0), 0);
}

export function readCartSummary(): CartSummary {
  return summarizeCartItems(readCartItems());
}

/** Real "wspólne rozliczenie obwodu" savings across ALL moskitiery-ramkowe
 * items in the cart - same mechanism as the Allegro configurator's own
 * order pricing (product-configurator-shell.tsx's summarizeCombinedPricing):
 * perimeter billing rounds UP to each started meter, so combining multiple
 * frames' perimeters BEFORE rounding (instead of rounding each standalone)
 * can only ever need the same or fewer whole meters - never more
 * (ceil(a+b) <= ceil(a)+ceil(b) for any non-negative a, b), so this can
 * never increase what a customer pays.
 *
 * This is the CLIENT'S preview of a deduction the CRM computes
 * authoritatively and independently at every quote_save.php call
 * (shop_moskitiery_combined_perimeter_reapply_to_quote_input() - see its
 * own doc comment for why it derives the effective per-mb rate from what
 * was actually sent rather than a hardcoded duplicate of
 * MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO). Deliberately non-compounding with
 * the SEZON20/rescue discounts (same "stack additively off the raw
 * subtotal" treatment those two already give each other) - keeps this
 * fully independent of promo state, so it never needs to know about them.
 *
 * Returns 0 for 0-1 items (nothing to combine) or when nothing was
 * actually saved (e.g. two frames that already fit their own whole meters
 * exactly). widthMm/heightMm intentionally not re-imported from
 * features/moskitiery-ramkowe/shared.ts here - koszyk/page.tsx already
 * inlines other per-product specifics (see cartItemFieldLabels()) rather
 * than importing from feature folders, so this mirrors that precedent. */
export function calcMoskitieryCombinedSavings(items: CartLineItem[]): number {
  const moskItems = items.filter((item) => item.productSlug === "moskitiery-ramkowe");
  // No length<2 gate here on purpose - a SINGLE line with qty>=2 identical
  // frames pools the same way (three 150x150mm frames in one line combine
  // to 2 billed meters, not 3) - the "was anything actually saved" check
  // below (groupedUnits >= standaloneUnits) already correctly returns 0 for
  // a genuine single unit, no separate early exit needed.
  if (moskItems.length === 0) return 0;

  let totalPerimeterMeters = 0;
  let standaloneUnits = 0;
  let standaloneAmount = 0;

  for (const item of moskItems) {
    if (!item.widthMm || !item.heightMm) continue;
    const perimeterMeters = (2 * (item.widthMm + item.heightMm)) / 1000;
    const billedMeters = Math.max(1, Math.ceil(perimeterMeters));
    totalPerimeterMeters += perimeterMeters * item.qty;
    standaloneUnits += billedMeters * item.qty;
    standaloneAmount += item.total;
  }

  if (standaloneUnits <= 0 || standaloneAmount <= 0) return 0;

  const groupedUnits = Math.max(1, Math.ceil(totalPerimeterMeters));
  if (groupedUnits >= standaloneUnits) return 0;

  const impliedPricePerMb = standaloneAmount / standaloneUnits;
  return Math.max(0, standaloneAmount - groupedUnits * impliedPricePerMb);
}

export function formatPln(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}
