/**
 * Exit-intent "rescue" modal plumbing - lets a visitor who's about to leave
 * mid-configuration save their progress via e-mail/phone and get a link back
 * (any device), with a one-time +5% discount that stacks additively with
 * any other active promo (SEZON20 etc.) - see core/lib/shop_discount_codes.php's
 * shop_rescue_discount_*() functions on the CRM side for how that +5% gets
 * re-validated and applied server-side. This module only ever carries a
 * *reference* to the granting quote_code, never a trusted amount - the
 * server always recomputes it from scratch, same security posture as the
 * SEZON20 promo code.
 */

import type { CartLineItem } from "@/lib/cart";

const QUOTE_SAVE_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/quote_save.php";
const QUOTE_FETCH_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/quote.php";

const RESCUE_GRANT_STORAGE_KEY = "keika_shop_rescue_discount_grant";
const RESCUE_MODAL_SHOWN_KEY = "keika_shop_rescue_modal_shown";
const RESCUE_DISMISSED_KEY = "keika_shop_rescue_dismissed";

export type RescueGrant = {
  quoteCode: string;
  percent: number;
};

export function getRescueGrant(): RescueGrant | null {
  try {
    const raw = window.localStorage.getItem(RESCUE_GRANT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RescueGrant;
    if (!parsed?.quoteCode || !parsed?.percent) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setRescueGrant(grant: RescueGrant): void {
  try {
    window.localStorage.setItem(RESCUE_GRANT_STORAGE_KEY, JSON.stringify(grant));
  } catch {
    // localStorage niedostępny - rabat ratunkowy widoczny tylko do końca wizyty.
  }
}

export function clearRescueGrant(): void {
  try {
    window.localStorage.removeItem(RESCUE_GRANT_STORAGE_KEY);
  } catch {
    // nic do zrobienia
  }
}

/** Once per browser tab - the modal only ever gets one shot per visit,
 * regardless of which trigger (mouseleave/back-button/inactivity) fires. */
export function hasSeenRescueModal(): boolean {
  try {
    return window.sessionStorage.getItem(RESCUE_MODAL_SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

export function markRescueModalShown(): void {
  try {
    window.sessionStorage.setItem(RESCUE_MODAL_SHOWN_KEY, "1");
  } catch {
    // nic do zrobienia
  }
}

/** Permanent (localStorage, not sessionStorage) - closing the modal without
 * giving contact, or having already given it once, means never asking
 * again on any future visit either. */
export function isRescueDismissedForGood(): boolean {
  try {
    return window.localStorage.getItem(RESCUE_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

export function markRescueDismissedForGood(): void {
  try {
    window.localStorage.setItem(RESCUE_DISMISSED_KEY, "1");
  } catch {
    // nic do zrobienia
  }
}

export type RescueSavePosition = {
  id: string;
  product_slug: string;
  product_label: string;
  quantity: number;
  total_amount: string;
  currency: string;
  summary: string;
  summary_rows: Array<{ label: string; value: string; note: string }>;
};

/** Builds the single-position payload shape the CRM already expects (same
 * as one line of buildQuotePayloadFromCart in app/koszyk/page.tsx) from a
 * not-yet-added-to-cart configurator selection. */
export function buildRescuePosition(item: {
  productSlug: string;
  productLabel: string;
  hardwareLabel: string;
  meshLabel: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  total: number;
}): RescueSavePosition {
  const specs = [
    item.hardwareLabel ? `kolor profilu ${item.hardwareLabel}` : "",
    item.meshLabel ? `kolor siatki ${item.meshLabel}` : "",
    item.widthMm && item.heightMm ? `${item.widthMm} × ${item.heightMm} mm` : "",
  ]
    .filter(Boolean)
    .join(", ");
  return {
    id: `position-${Date.now()}`,
    product_slug: item.productSlug || "produkt",
    product_label: item.productLabel,
    quantity: item.qty,
    total_amount: item.total.toFixed(2),
    currency: "PLN",
    summary: `${item.productLabel}${specs ? ` — ${specs}` : ""}`,
    summary_rows: [
      item.hardwareLabel ? { label: "Kolor profilu", value: item.hardwareLabel, note: "" } : null,
      item.meshLabel ? { label: "Kolor siatki", value: item.meshLabel, note: "" } : null,
      item.widthMm && item.heightMm
        ? { label: "Rozmiar", value: `${item.widthMm} × ${item.heightMm} mm`, note: "" }
        : null,
      { label: "Ilość", value: `${item.qty} szt.`, note: "" },
    ].filter((row): row is { label: string; value: string; note: string } => row !== null),
  };
}

/** Submits the exit-intent modal - creates the quote if there isn't one yet
 * (position given) or attaches to an existing one (quoteCode given), then
 * the CRM sends the resume link by e-mail/SMS. Also hands back the same
 * resume link so the modal can offer it directly too (copy/QR/native
 * share), same "give every channel at once" idea as the plain save/share
 * widget - see lib/share.ts. Never throws - a failure here must never
 * block the page it interrupted. */
export async function saveRescueContact(input: {
  quoteCode?: string;
  position?: RescueSavePosition;
  sessionToken?: string;
  email?: string;
  phone?: string;
  /** Pass PROMO_CODE (lib/promo.ts) whenever isPromoActive() is true at
   * submit time - see the matching param on lib/share.ts's
   * saveQuoteForSharing(), same reasoning: without it, a promo activated on
   * the device that triggered the rescue modal doesn't carry over to
   * whatever device opens the rescue link. */
  promoCode?: string;
}): Promise<{ ok: boolean; error?: string; resumeUrl?: string; quoteCode?: string; discountPercent?: number }> {
  try {
    const body: Record<string, unknown> = {
      rescue_contact: { email: input.email || "", phone: input.phone || "" },
      session_token: input.sessionToken || "",
    };
    if (input.promoCode) {
      body.promo_code = input.promoCode;
    }
    if (input.quoteCode) {
      body.quote_code = input.quoteCode;
    } else if (input.position) {
      body.positions = [input.position];
    } else {
      return { ok: false, error: "Brak danych do zapisania." };
    }
    const response = await fetch(QUOTE_SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as {
      ok: boolean;
      error?: string;
      quote?: {
        quote_code?: string;
        resume_token?: string;
        product_slug?: string;
        rescue_discount_percent?: number;
      };
    };
    if (!json.ok) {
      return { ok: false, error: json.error };
    }
    const quoteCode = String(json.quote?.quote_code || "");
    const resumeToken = String(json.quote?.resume_token || "");
    const productSlug = String(json.quote?.product_slug || "");
    const params = new URLSearchParams({ resume_token: resumeToken });
    if (productSlug) params.set("produkt", productSlug);
    return {
      ok: true,
      resumeUrl: resumeToken ? `https://sklep.keika.pl/?${params.toString()}` : undefined,
      quoteCode: quoteCode || undefined,
      discountPercent: Number(json.quote?.rescue_discount_percent) || 5,
    };
  } catch {
    return { ok: false, error: "Nie udało się zapisać. Spróbuj ponownie." };
  }
}

type SummaryRow = { label?: string; value?: string };

function extractSpecsFromSummaryRows(rows: SummaryRow[]): {
  hardwareLabel: string;
  meshLabel: string;
  widthMm: number;
  heightMm: number;
} {
  let hardwareLabel = "";
  let meshLabel = "";
  let widthMm = 0;
  let heightMm = 0;
  for (const row of rows) {
    const label = row?.label || "";
    const value = row?.value || "";
    if (label === "Kolor profilu" || label === "Kolor kasety") hardwareLabel = value;
    else if (label === "Kolor siatki" || label === "Kolor materiału") meshLabel = value;
    else if (label === "Rozmiar") {
      const match = value.match(/(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)/);
      if (match) {
        widthMm = Number(match[1].replace(",", "."));
        heightMm = Number(match[2].replace(",", "."));
      }
    }
  }
  return { hardwareLabel, meshLabel, widthMm, heightMm };
}

/** Resolves a resume link (?resume_token=...) into every ready-to-add
 * CartLineItem the quote carries, plus whatever rescue discount is still
 * unused on it. Returns null on any failure or if the quote never had a
 * real product position at all (an exit-intent capture with nothing
 * configured yet, in principle possible, has nothing useful to resume
 * into). A quote saved from the cart-fallback tier of the save/share
 * widget (lib/share.ts) can carry *several* product positions - this used
 * to pick only the first one via .find() and silently drop the rest, the
 * real cause of "my cart didn't come back" reports; now maps every real
 * position, not just one. */
export async function resolveResumeToken(resumeToken: string): Promise<{
  items: CartLineItem[];
  quoteCode: string;
  rescueDiscountPercent: number;
  /** The site-wide promo code (SEZON20 etc.) that was active on the device
   * that saved this quote, if any - empty string when none was. Caller
   * should activatePromoCode() (lib/promo.ts) with it so the discount
   * carries over to this device too, same as rescueDiscountPercent
   * already does for the rescue grant. */
  promoCode: string;
} | null> {
  try {
    const response = await fetch(`${QUOTE_FETCH_URL}?resume_token=${encodeURIComponent(resumeToken)}`);
    const json = await response.json();
    if (!json.ok || !json.quote) return null;
    const quote = json.quote as {
      quote_code: string;
      rescue_discount_percent?: number;
      payload?: { positions?: Array<Record<string, unknown>>; promo_code?: string };
    };
    const positions = Array.isArray(quote.payload?.positions) ? quote.payload!.positions! : [];
    const productPositions = positions.filter((p) => {
      const slug = String(p.product_slug || "");
      return slug !== "rabat" && slug !== "rabat-ratunek";
    });
    if (productPositions.length === 0) return null;

    const items: CartLineItem[] = productPositions.map((productPosition, index) => {
      const quantity = Number(productPosition.quantity) || 1;
      const totalAmount = Number(productPosition.total_amount) || 0;
      const specs = extractSpecsFromSummaryRows(
        Array.isArray(productPosition.summary_rows) ? (productPosition.summary_rows as SummaryRow[]) : [],
      );

      return {
        id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2)}`,
        productSlug: String(productPosition.product_slug || "produkt"),
        productLabel: String(productPosition.product_label || "Produkt"),
        hardwareLabel: specs.hardwareLabel,
        meshLabel: specs.meshLabel,
        widthMm: specs.widthMm,
        heightMm: specs.heightMm,
        qty: quantity,
        price: quantity > 0 ? totalAmount / quantity : totalAmount,
        total: totalAmount,
        createdAt: new Date().toISOString(),
      };
    });

    return {
      items,
      quoteCode: String(quote.quote_code || ""),
      rescueDiscountPercent: Number(quote.rescue_discount_percent) || 0,
      promoCode: String(quote.payload?.promo_code || ""),
    };
  } catch {
    return null;
  }
}
