/**
 * Voluntary "save or share this configuration" feature - a banner the
 * customer can tap any time (not tied to leaving, unlike lib/rescue.ts's
 * exit-intent modal, and deliberately carries no discount of its own, so
 * it can't be combined with the rescue one for a double grant on the same
 * quote). Saves the current draft as a normal quote and hands back a
 * resume link - same underlying endpoint the rescue flow uses
 * (shop_www_quotes_save_public() always returns a resume_token, with or
 * without a rescue_contact in the payload), just without that field.
 */

import type { RescueSavePosition } from "@/lib/rescue";

const QUOTE_SAVE_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/quote_save.php";

export type ShareLink = {
  quoteCode: string;
  resumeToken: string;
  url: string;
};

/** Builds the resume URL the same way the rescue e-mail does - same origin,
 * same query shape (?resume_token=...&produkt=...), so app/page.tsx's
 * existing resume-token consumption effect handles it identically either
 * way. */
export function buildResumeUrl(resumeToken: string, productSlug: string): string {
  const params = new URLSearchParams({ resume_token: resumeToken });
  if (productSlug) params.set("produkt", productSlug);
  return `https://sklep.keika.pl/?${params.toString()}`;
}

/** Saves the current draft/cart (or re-touches an already-saved quote) and
 * returns a ready-to-share resume link. Never throws - a failure here
 * should just disable the share options, not break the page. */
export async function saveQuoteForSharing(input: {
  quoteCode?: string;
  /** The resume token already tied to `quoteCode`, if we have one -
   * ALWAYS pass this when re-touching an existing quote. Without it the
   * CRM has no way to know which token we're currently showing/have
   * already sent out, so it mints a brand new one and orphans that link -
   * see the matching comment on sendShareLink() below, the real cause of
   * "the resume link opens a blank homepage" reports. */
  resumeToken?: string;
  /** Single in-progress draft (not yet added to the cart). */
  position?: RescueSavePosition;
  /** Everything already in the cart - takes priority over `position` when
   * both are given (see save-share-widget.tsx's fallback order: a
   * complete draft first, then the saved cart, then just the plain page
   * URL with no save call at all). */
  positions?: RescueSavePosition[];
  sessionToken?: string;
  productSlug: string;
  /** Pass PROMO_CODE (lib/promo.ts) whenever isPromoActive() is true at
   * save time, so a resume link re-activates the same site-wide promo on
   * whatever device opens it - without this the discount silently doesn't
   * carry over even though the cart/configuration now does. */
  promoCode?: string;
}): Promise<ShareLink | null> {
  try {
    const body: Record<string, unknown> = {
      session_token: input.sessionToken || "",
    };
    if (input.resumeToken) {
      body.resume_token = input.resumeToken;
    }
    if (input.promoCode) {
      body.promo_code = input.promoCode;
    }
    if (input.quoteCode) {
      body.quote_code = input.quoteCode;
    } else if (input.positions && input.positions.length > 0) {
      body.positions = input.positions;
    } else if (input.position) {
      body.positions = [input.position];
    } else {
      return null;
    }
    const response = await fetch(QUOTE_SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as {
      ok: boolean;
      quote?: { quote_code?: string; resume_token?: string };
    };
    const quoteCode = String(json?.quote?.quote_code || "");
    const resumeToken = String(json?.quote?.resume_token || "");
    if (!json.ok || !quoteCode || !resumeToken) return null;
    return {
      quoteCode,
      resumeToken,
      url: buildResumeUrl(resumeToken, input.productSlug),
    };
  } catch {
    return null;
  }
}

/** Sends the given quote's resume link by e-mail or SMS - the widget's
 * "Wyślij" option, deliberately separate from the exit-intent rescue
 * modal's contact capture (lib/rescue.ts's saveRescueContact): no discount
 * involved at all here, just a plain "here's your link" message (see
 * shop_www_quotes_handle_share_send() / the quote_share_link template on
 * the CRM side). Requires an already-saved quote_code - there's nothing
 * to attach the send to otherwise. */
export async function sendShareLink(input: {
  quoteCode: string;
  /** The resume token `saveQuoteForSharing()` already returned for this
   * quoteCode. MUST be forwarded here: this used to be a second, separate
   * POST that never carried it, so the CRM (finding the row by quote_code
   * only) minted a brand new token and silently invalidated whatever link
   * was already shown/copied/QR'd in the modal a moment earlier - the row
   * only ever remembers one resume token at a time. Passing it back keeps
   * this call working on the exact same token instead of rotating it. */
  resumeToken?: string;
  email?: string;
  phone?: string;
}): Promise<{ ok: boolean; error?: string; resumeToken?: string }> {
  if (!input.quoteCode) {
    return { ok: false, error: "Brak zapisanej wyceny do wysłania." };
  }
  try {
    const body: Record<string, unknown> = {
      quote_code: input.quoteCode,
      share_send: { email: input.email || "", phone: input.phone || "" },
    };
    if (input.resumeToken) {
      body.resume_token = input.resumeToken;
    }
    const response = await fetch(QUOTE_SAVE_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = (await response.json()) as {
      ok: boolean;
      error?: string;
      quote?: { resume_token?: string };
    };
    // Defensive: if this call ever does run without a resumeToken (e.g. a
    // future caller forgets to pass one), the CRM still mints a fresh one -
    // hand it back so the caller can refresh its own link state (via
    // buildResumeUrl()) rather than keep showing a now-dead one.
    const freshResumeToken = json.quote?.resume_token ? String(json.quote.resume_token) : undefined;
    return { ok: Boolean(json.ok), error: json.error, resumeToken: freshResumeToken };
  } catch {
    return { ok: false, error: "Nie udało się wysłać. Spróbuj ponownie." };
  }
}
