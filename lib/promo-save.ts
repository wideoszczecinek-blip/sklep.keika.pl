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

const QUOTE_SAVE_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/quote_save.php";

// Separate from koszyk/page.tsx's own lastQuoteCodeRef (an in-memory ref
// that only exists once the cart page mounts) - this needs to survive a
// customer activating the promo on the homepage/configurator, long before
// they ever open the cart, so it's sessionStorage-backed instead.
const PROMO_QUOTE_CODE_KEY = "keika_shop_promo_quote_code";
const PROMO_RESUME_TOKEN_KEY = "keika_shop_promo_resume_token";

function getSessionToken(): string {
  try {
    return window.sessionStorage.getItem("keika_shop_session_token") || "";
  } catch {
    return "";
  }
}

function getTracked(): { quoteCode: string; resumeToken: string } {
  try {
    return {
      quoteCode: window.sessionStorage.getItem(PROMO_QUOTE_CODE_KEY) || "",
      resumeToken: window.sessionStorage.getItem(PROMO_RESUME_TOKEN_KEY) || "",
    };
  } catch {
    return { quoteCode: "", resumeToken: "" };
  }
}

function setTracked(quoteCode: string, resumeToken: string): void {
  try {
    window.sessionStorage.setItem(PROMO_QUOTE_CODE_KEY, quoteCode);
    window.sessionStorage.setItem(PROMO_RESUME_TOKEN_KEY, resumeToken);
  } catch {
    // sessionStorage niedostępny - kod i tak trafia do wywołującego, po prostu nie przetrwa odświeżenia.
  }
}

export type PromoQuoteState = {
  quoteCode: string;
  deadlineAtMs: number | null;
};

/** Ensures the currently-active promo activation has a real, short
 * quote_code attached to it - called the moment the countdown banner first
 * mounts with an active promo, NOT gated on having configured a product yet
 * (explicit business requirement: every customer who activates the code
 * gets a code, not just the ones who've picked colors/dimensions).
 * Reuses the same row on every call via the tracked resume_token/quote_code
 * (quote_save.php's own "touch"-only handling - see its header comment -
 * means this never wipes a real configuration the customer adds later, and
 * never mints a second row for the same activation). Never throws. */
export async function ensurePromoQuoteCode(): Promise<PromoQuoteState | null> {
  const activatedAt = getPromoActivatedAt();
  if (activatedAt === null) return null;
  const tracked = getTracked();
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
      }),
    });
    const json = (await response.json()) as {
      ok: boolean;
      quote?: { quote_code?: string; resume_token?: string; promo_deadline_at_ms?: number };
    };
    if (!json.ok || !json.quote?.quote_code) return null;
    const quoteCode = String(json.quote.quote_code);
    const resumeToken = String(json.quote.resume_token || "");
    setTracked(quoteCode, resumeToken);
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

function markPromoLinkSaved(): void {
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
