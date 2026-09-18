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

import { NON_PRODUCT_POSITION_SLUGS, type CartLineItem } from "@/lib/cart";

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
let rescuePositionSequence = 0;

export function buildRescuePosition(item: {
  /** Id linii koszyka (CartLineItem.id) - unikalny per pozycja. */
  id?: string;
  productSlug: string;
  productLabel: string;
  hardwareLabel: string;
  meshLabel: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  total: number;
  /** rolety-dachowe: the chosen window ("Velux MK04") or "Wymiar własny". */
  modelLabel?: string;
  /** Row labels for products whose "hardware"/"mesh" are not profile/mesh
   * (rolety-dachowe: kaseta / materiał) - the same names /koszyk sends, so
   * a resumed position reads back the same way (extractSpecsFromSummaryRows). */
  labels?: { hardware: string; mesh: string };
}): RescueSavePosition {
  // Row names per product - the same ones /koszyk sends (cartItemFieldLabels),
  // so a quote saved from the promo/save flows reads like one from checkout.
  const defaultLabels =
    item.productSlug === "rolety-dachowe"
      ? { hardware: "Kolor kasety", mesh: "Kolor materiału" }
      : item.productSlug === "plisy"
        ? { hardware: "Kolor mechanizmu", mesh: "Kolekcja i kolor tkaniny" }
        : { hardware: "Kolor profilu", mesh: "Kolor siatki" };
  const hardwareLabelName = item.labels?.hardware || defaultLabels.hardware;
  const meshLabelName = item.labels?.mesh || defaultLabels.mesh;
  const specs = [
    item.hardwareLabel ? `${hardwareLabelName.toLowerCase()} ${item.hardwareLabel}` : "",
    item.meshLabel ? `${meshLabelName.toLowerCase()} ${item.meshLabel}` : "",
    item.modelLabel ? `model okna ${item.modelLabel}` : "",
    item.widthMm && item.heightMm ? `${item.widthMm} × ${item.heightMm} mm` : "",
  ]
    .filter(Boolean)
    .join(", ");
  // Real live bug (2026-09-18): `position-${Date.now()}` nadawało wszystkim
  // pozycjom z jednego zapisu to samo id, a CRM (quote_save.php) traktuje
  // powtórzony id jako tę samą linię wysłaną dwa razy i liczy ją raz -
  // 94 wyceny z zaniżoną kwotą (sama dopłata dłużycowa zamiast koszyka).
  rescuePositionSequence += 1;
  const positionId = (item.id || "").trim()
    ? `position-${item.id}`
    : `position-${Date.now()}-${rescuePositionSequence}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id: positionId,
    product_slug: item.productSlug || "produkt",
    product_label: item.productLabel,
    quantity: item.qty,
    total_amount: item.total.toFixed(2),
    currency: "PLN",
    summary: `${item.productLabel}${specs ? ` — ${specs}` : ""}`,
    summary_rows: [
      item.hardwareLabel ? { label: hardwareLabelName, value: item.hardwareLabel, note: "" } : null,
      item.meshLabel ? { label: meshLabelName, value: item.meshLabel, note: "" } : null,
      item.modelLabel ? { label: "Model okna", value: item.modelLabel, note: "" } : null,
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
  modelLabel: string;
  widthMm: number;
  heightMm: number;
} {
  let hardwareLabel = "";
  let meshLabel = "";
  let modelLabel = "";
  let widthMm = 0;
  let heightMm = 0;
  for (const row of rows) {
    const label = row?.label || "";
    const value = row?.value || "";
    if (label === "Kolor profilu" || label === "Kolor kasety" || label === "Kolor mechanizmu") hardwareLabel = value;
    else if (label === "Kolor siatki" || label === "Kolor materiału" || label === "Kolekcja i kolor tkaniny") meshLabel = value;
    else if (label === "Model okna") modelLabel = value;
    else if (label === "Rozmiar") {
      const match = value.match(/(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)/);
      if (match) {
        widthMm = Number(match[1].replace(",", "."));
        heightMm = Number(match[2].replace(",", "."));
      }
    }
  }
  return { hardwareLabel, meshLabel, modelLabel, widthMm, heightMm };
}

type RawResumeQuote = {
  quote_code: string;
  product_slug?: string;
  rescue_discount_percent?: number;
  promo_deadline_at_ms?: number;
  payload?: { positions?: Array<Record<string, unknown>>; promo_code?: string };
};

export type ResumeState = {
  items: CartLineItem[];
  quoteCode: string;
  /** Raw as the quote carries it - may be empty or the generic "produkt"
   * placeholder (a promo-activation-only quote with no real product chosen
   * yet, see lib/promo-save.ts's ensurePromoQuoteCode()). Callers that need
   * a page to redirect to should fall back to a real slug themselves. */
  productSlug: string;
  rescueDiscountPercent: number;
  /** The site-wide promo code (SEZON20 etc.) that was active on the device
   * that saved this quote, if any - empty string when none was. Caller
   * should activatePromoCode() (lib/promo.ts) with it so the discount
   * carries over to this device too, same as rescueDiscountPercent
   * already does for the rescue grant. */
  promoCode: string;
  /** Only set while the tracked deadline is still in the future - see
   * syncPromoDeadlineFromServer() (lib/promo.ts), which this is meant to
   * feed: carries over the *real* remaining time, never restarts a fresh
   * window on a device that opens the link later. */
  promoDeadlineAtMs: number | null;
};

/** Maps one CRM quote row (whatever shape quote.php returns) into every
 * ready-to-add CartLineItem it carries, plus whatever discounts are still
 * unused on it. Never bails just because there are zero product positions
 * (a promo-activation-only quote, in principle possible and now common via
 * the SEZON20 countdown banner's "Zapisz link" - see /wizyta/[quoteCode] -
 * has nothing to add to the cart, but the promo code itself is still very
 * much worth restoring) - `items` is simply `[]` in that case, callers
 * branch on that themselves. A quote saved from the cart-fallback tier of
 * the save/share widget (lib/share.ts) can carry *several* product
 * positions - this used to pick only the first one via .find() and
 * silently drop the rest, the real cause of "my cart didn't come back"
 * reports; now maps every real position, not just one. */
export function mapQuoteToResumeState(quote: RawResumeQuote): ResumeState {
  const positions = Array.isArray(quote.payload?.positions) ? quote.payload!.positions! : [];
  const productPositions = positions.filter((p) => !NON_PRODUCT_POSITION_SLUGS.has(String(p.product_slug || "")));

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
      modelLabel: specs.modelLabel || undefined,
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
    productSlug: String(quote.product_slug || ""),
    rescueDiscountPercent: Number(quote.rescue_discount_percent) || 0,
    promoCode: String(quote.payload?.promo_code || ""),
    promoDeadlineAtMs: typeof quote.promo_deadline_at_ms === "number" ? quote.promo_deadline_at_ms : null,
  };
}

/** Resolves a resume link (?resume_token=...) the same way mapQuoteToResumeState()
 * describes - see that function's own doc comment. Returns null only on a
 * genuine fetch/lookup failure (bad/expired token), never merely for an
 * empty cart. */
export async function resolveResumeToken(resumeToken: string): Promise<ResumeState | null> {
  try {
    const response = await fetch(`${QUOTE_FETCH_URL}?resume_token=${encodeURIComponent(resumeToken)}`);
    const json = await response.json();
    if (!json.ok || !json.quote) return null;
    return mapQuoteToResumeState(json.quote as RawResumeQuote);
  } catch {
    return null;
  }
}
