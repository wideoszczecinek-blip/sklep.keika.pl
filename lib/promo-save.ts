/**
 * "Kup w ciągu 24h albo rabat przepada" - the promo countdown banner's own
 * save/share flow (app/components/promo-countdown-banner.tsx +
 * app/components/promo-save-modal.tsx). Deliberately separate from
 * lib/rescue.ts (exit-intent, grants an extra +5%) even though both end up
 * calling the same quote_save.php endpoint and sending a similar link - see
 * core/lib/shop_promo_deadline.php's header comment on why they stay
 * distinct concepts. This one grants nothing; it only helps a customer keep
 * the discount they already activated before it expires.
 */
import { PROMO_CODE, getPromoActivatedAt } from "@/lib/promo";
import { readCartItems } from "@/lib/cart";
import { buildRescuePosition } from "@/lib/rescue";

const QUOTE_SAVE_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/quote_save.php";

// Separate from koszyk/page.tsx's own lastQuoteCodeRef (an in-memory ref
// that only exists once the cart page mounts) - this needs to survive a
// customer activating the promo on the homepage/configurator, long before
// they ever open the cart, so it's sessionStorage-backed instead.
const PROMO_QUOTE_CODE_KEY = "keika_shop_promo_quote_code";
const PROMO_RESUME_TOKEN_KEY = "keika_shop_promo_resume_token";
// Tracked alongside the quote_code/resume_token so every later touch on this
// same row (savePromoContact() below) keeps re-sending it - live bug found
// 2026-09-06: without this, the FIRST touch (ensurePromoQuoteCode) correctly
// stamps the real product_slug, but the SECOND touch (savePromoContact, sent
// with no product_slug at all) silently reset it back to the generic
// "produkt" placeholder, because quote_save.php's "don't blank out product
// data on a touch-only save" guard only protects rows that already carry
// real positions - these promo-only rows never do. /wizyta/<code> then had
// no real product to send the customer back to.
const PROMO_PRODUCT_SLUG_KEY = "keika_shop_promo_product_slug";

function getSessionToken(): string {
  try {
    return window.sessionStorage.getItem("keika_shop_session_token") || "";
  } catch {
    return "";
  }
}

function getTracked(): { quoteCode: string; resumeToken: string; productSlug: string } {
  try {
    return {
      quoteCode: window.sessionStorage.getItem(PROMO_QUOTE_CODE_KEY) || "",
      resumeToken: window.sessionStorage.getItem(PROMO_RESUME_TOKEN_KEY) || "",
      productSlug: window.sessionStorage.getItem(PROMO_PRODUCT_SLUG_KEY) || "",
    };
  } catch {
    return { quoteCode: "", resumeToken: "", productSlug: "" };
  }
}

function setTracked(quoteCode: string, resumeToken: string, productSlug: string): void {
  try {
    window.sessionStorage.setItem(PROMO_QUOTE_CODE_KEY, quoteCode);
    window.sessionStorage.setItem(PROMO_RESUME_TOKEN_KEY, resumeToken);
    if (productSlug) window.sessionStorage.setItem(PROMO_PRODUCT_SLUG_KEY, productSlug);
  } catch {
    // sessionStorage niedostępny - kod i tak trafia do wywołującego, po prostu nie przetrwa odświeżenia.
  }
}

/** Exported for app/wizyta/[quoteCode]/visit-resume.tsx: makes THIS device
 * continue saving onto the exact same quote_code a resumed link came from,
 * instead of silently starting a second, unrelated row the moment the
 * countdown banner remounts and calls ensurePromoQuoteCode() again on the
 * destination page. Real bug found live 2026-09-06: "wysłałem sobie link,
 * dodałem coś do koszyka i wszedłem drugi raz - 404 / stara zawartość" -
 * without this, the original saved link's row was never touched again, so
 * it silently stopped reflecting the cart (a customer could reasonably read
 * that as "the link doesn't update", even on the rare cases it didn't
 * outright 404 from unrelated causes).
 *
 * `resumeToken` is deliberately NOT required - quote_save.php's own "known
 * quote_code always finds/reuses the same row, rotating a fresh resume_token
 * into the response either way" behavior (see shop_www_quotes_save_public(),
 * CRM side) means the raw resume_token from the ORIGINAL device is neither
 * recoverable here (only its hash is ever stored) nor actually needed - the
 * very next touch gets and stores a real one. */
export function trackPromoQuote(quoteCode: string, productSlug: string): void {
  setTracked(quoteCode, "", productSlug);
}

export type PromoQuoteState = {
  quoteCode: string;
  deadlineAtMs: number | null;
};

/** Ensures the currently-active promo activation has a real, short
 * quote_code attached to it - called the moment the countdown banner first
 * mounts with an active promo, NOT gated on having configured a product yet
 * (explicit business requirement: every customer who activates the code
 * gets a code, not just the ones who've picked colors/dimensions). Also
 * called again right as the save modal opens (CTA click, auto-open timer,
 * exit-intent) to snapshot the *current* cart into the same row - "co miał
 * w koszyku" (what was in the cart) is exactly what /wizyta/<code>
 * (app/wizyta/[quoteCode]/page.tsx) restores from whatever this call last
 * saved, so a customer who adds items between the banner mounting and
 * actually saving the link still gets them back. Reuses the same row on
 * every call via the tracked resume_token/quote_code (quote_save.php's own
 * "touch"-only handling - see its header comment - means this never wipes a
 * real configuration with an *empty* cart snapshot; a genuinely empty local
 * cart here just omits `positions` entirely rather than sending `[]`, for
 * that same reason). Never mints a second row for the same activation.
 * Never throws.
 *
 * `productSlug` is what /wizyta/<code> sends the customer back to when they
 * open the saved link - pass whichever product page the banner is actually
 * showing on (every current call site is moskitiery-ramkowe). Threaded
 * through every call so a later savePromoContact() touch on the same row
 * doesn't reset it - see PROMO_PRODUCT_SLUG_KEY above. */
// Shared in-flight promise. The countdown banner, the configurator panel
// AND app/page.tsx each call this on mount, so on a product page with an
// active promo 2-3 of them fire within the same tick - each reading an
// empty sessionStorage quote_code and so each POSTing quote_code:"" and
// getting its own brand-new row back. Live evidence 2026-09-06..08:
// ~2 empty shop_www_quotes rows per activation (139 sessions x2, 6 x3),
// ~350 junk rows/day, which also crushed every "wycena -> zamowienie"
// funnel ratio (denominator ~90% empty stubs). Collapsing concurrent
// callers into one request is what actually makes the "never mints a
// second row for the same activation" guarantee below hold.
let ensurePromoQuoteCodeInFlight: Promise<PromoQuoteState | null> | null = null;

export function ensurePromoQuoteCode(productSlug?: string): Promise<PromoQuoteState | null> {
  if (ensurePromoQuoteCodeInFlight) return ensurePromoQuoteCodeInFlight;
  ensurePromoQuoteCodeInFlight = ensurePromoQuoteCodeInner(productSlug).finally(() => {
    ensurePromoQuoteCodeInFlight = null;
  });
  return ensurePromoQuoteCodeInFlight;
}

async function ensurePromoQuoteCodeInner(productSlug?: string): Promise<PromoQuoteState | null> {
  const activatedAt = getPromoActivatedAt();
  if (activatedAt === null) return null;
  const tracked = getTracked();
  const effectiveSlug = productSlug || tracked.productSlug;
  const cartItems = readCartItems();
  const positions = cartItems.length > 0 ? cartItems.map((item) => buildRescuePosition(item)) : null;
  try {
    const response = await fetch(QUOTE_SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quote_code: tracked.quoteCode,
        resume_token: tracked.resumeToken,
        session_token: getSessionToken(),
        promo_code: PROMO_CODE,
        promo_activated_at_ms: activatedAt,
        ...(effectiveSlug ? { product_slug: effectiveSlug } : {}),
        ...(positions ? { positions } : {}),
      }),
    });
    const json = (await response.json()) as {
      ok: boolean;
      quote?: { quote_code?: string; resume_token?: string; promo_deadline_at_ms?: number };
    };
    if (!json.ok || !json.quote?.quote_code) return null;
    const quoteCode = String(json.quote.quote_code);
    const resumeToken = String(json.quote.resume_token || "");
    setTracked(quoteCode, resumeToken, effectiveSlug);
    return {
      quoteCode,
      deadlineAtMs: typeof json.quote.promo_deadline_at_ms === "number" ? json.quote.promo_deadline_at_ms : null,
    };
  } catch {
    return null;
  }
}

// "Nie pytaj ponownie" for the exit-intent variant specifically - once a
// customer has actually sent themselves the link (any channel), leaving the
// page again should never re-trigger the "zaraz stracisz rabat" exit-intent
// modal a second time in the same browser. Separate from the rescue
// modal's own hasSeenRescueModal()/isRescueDismissedForGood() (lib/
// rescue.ts) - those gate *whichever* modal shows at all; this one
// specifically distinguishes "already saved" from "saw it, dismissed it"
// so a customer who closed the countdown banner without saving can still
// get the exit-intent nudge once.
const PROMO_LINK_SAVED_KEY = "keika_shop_promo_link_saved";

export function hasSavedPromoLink(): boolean {
  try {
    return window.localStorage.getItem(PROMO_LINK_SAVED_KEY) === "1";
  } catch {
    return false;
  }
}

/** Exported for app/wizyta/[quoteCode]/visit-resume.tsx: a device that just
 * resumed a visit *from* a saved link obviously already has a way back to
 * it - marking this here suppresses both the auto-open save modal
 * (promo-countdown-banner.tsx) and the exit-intent "zaraz stracisz rabat"
 * variant (ConfiguratorPanel.tsx) from immediately nagging the same
 * customer again on this device. */
export function markPromoLinkSaved(): void {
  try {
    window.localStorage.setItem(PROMO_LINK_SAVED_KEY, "1");
  } catch {
    // localStorage niedostępny - modal może się pokazać ponownie, nic więcej nie da się zrobić.
  }
}

export type PromoConsent = "one_time" | "marketing";

/** The save modal's SMS/e-mail submit - quoteCode must already exist
 * (ensurePromoQuoteCode() having run first). Never grants a discount -
 * shop_www_quotes_handle_promo_save_contact() (CRM side) only ever sends
 * the plain link + records which consent tier was picked. */
export async function savePromoContact(input: {
  quoteCode: string;
  email?: string;
  phone?: string;
  consent: PromoConsent;
}): Promise<{ ok: boolean; error?: string }> {
  const tracked = getTracked();
  try {
    const response = await fetch(QUOTE_SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        quote_code: input.quoteCode,
        resume_token: tracked.resumeToken,
        session_token: getSessionToken(),
        promo_code: PROMO_CODE,
        promo_activated_at_ms: getPromoActivatedAt() ?? undefined,
        // Re-send on every touch, not just the first (ensurePromoQuoteCode)
        // - see PROMO_PRODUCT_SLUG_KEY's comment above for the live bug this fixes.
        ...(tracked.productSlug ? { product_slug: tracked.productSlug } : {}),
        promo_save_contact: {
          email: input.email || "",
          phone: input.phone || "",
          consent: input.consent,
        },
      }),
    });
    const json = (await response.json()) as { ok: boolean; error?: string };
    if (!json.ok) {
      return { ok: false, error: json.error || "Nie udało się zapisać." };
    }
    markPromoLinkSaved();
    return { ok: true };
  } catch {
    return { ok: false, error: "Nie udało się zapisać. Spróbuj ponownie." };
  }
}
