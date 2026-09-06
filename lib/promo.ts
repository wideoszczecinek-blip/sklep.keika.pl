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

const PROMO_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 dni

// "Kup w ciągu 24h albo rabat przepada" - a *separate*, shorter marketing
// deadline layered on top of the 30-day activation cookie above (which just
// means "the code still auto-applies on this device" - it was never meant
// to create urgency, and real order data confirms it doesn't need to: every
// genuinely paid SEZON20 order converted within 17 minutes of first visit).
// This is the number shown in the countdown banner and enforced server-side
// too - see PROMO_DEADLINE_WINDOW_HOURS' twin, shop_promo_deadline_window_
// hours() in core/lib/shop_promo_deadline.php on the CRM side. Keep the two
// in sync; a mismatch would mean the banner and the actual charge disagree,
// exactly the class of bug this whole feature exists to avoid.
export const PROMO_DEADLINE_WINDOW_HOURS = 24;
const PROMO_ACTIVATED_AT_STORAGE_KEY = "keika_shop_active_promo_activated_at";

// A customer opening the shop from a Facebook link lands in Facebook's own
// in-app browser (a locked-down WebView) - reported live: activating the
// promo there never carried through to /koszyk's prices. That WebView (and
// others like it - in-app browsers from other apps, some privacy-hardened
// mobile browsers) can silently partition or refuse localStorage entirely,
// which was this module's *only* persistence - it fails with no error, so
// nothing here ever surfaced it. Cookies are the same mechanism the site's
// own session/login already depends on everywhere, so they survive far more
// reliably - now the primary store, with localStorage kept only as a same-
// tick read for isPromoActive() (belt and suspenders, not load-bearing).
function readPromoCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )keika_shop_active_promo_code=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function writePromoCookie(code: string): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${ACTIVE_PROMO_STORAGE_KEY}=${encodeURIComponent(code)}; path=/; max-age=${PROMO_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

function readPromoActivatedAtCookie(): number | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )keika_shop_active_promo_activated_at=([^;]*)/);
  if (!match) return null;
  const ms = Number(decodeURIComponent(match[1]));
  return Number.isFinite(ms) && ms > 0 ? ms : null;
}

function writePromoActivatedAtCookie(ms: number): void {
  if (typeof document === "undefined") return;
  document.cookie =
    `${PROMO_ACTIVATED_AT_STORAGE_KEY}=${ms}; path=/; max-age=${PROMO_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

/** Epoch ms this device first activated the code, or null if never tracked
 * (older activation from before this feature shipped, or the code was never
 * activated via the countdown-bearing banners at all - e.g. typed straight
 * into the cart's own "Kod rabatowy" field, which never calls
 * activatePromoCode()). Cookie first, localStorage as the same belt-and-
 * suspenders fallback isPromoActive() already uses. */
export function getPromoActivatedAt(): number | null {
  const cookieVal = readPromoActivatedAtCookie();
  if (cookieVal !== null) return cookieVal;
  try {
    const raw = window.localStorage.getItem(PROMO_ACTIVATED_AT_STORAGE_KEY);
    const ms = raw ? Number(raw) : NaN;
    return Number.isFinite(ms) && ms > 0 ? ms : null;
  } catch {
    return null;
  }
}

/** null when there's nothing to count down (never activated via a
 * countdown-bearing banner) - callers should hide the countdown UI
 * entirely in that case, not show a confusing "0:00". */
export function getPromoDeadlineAtMs(): number | null {
  const activatedAt = getPromoActivatedAt();
  if (activatedAt === null) return null;
  return activatedAt + PROMO_DEADLINE_WINDOW_HOURS * 60 * 60 * 1000;
}

export function getPromoRemainingMs(): number {
  const deadline = getPromoDeadlineAtMs();
  if (deadline === null) return 0;
  return Math.max(0, deadline - Date.now());
}

/** false (not expired) when there's no deadline tracked at all - this is
 * "not applicable", never "definitely still fine", so callers gating the
 * *discount itself* must still go through the real check
 * (discount_code_check.php / quote_save.php's server-side enforcement),
 * this is only for the countdown UI. */
export function isPromoDeadlineExpired(): boolean {
  const deadline = getPromoDeadlineAtMs();
  if (deadline === null) return false;
  return Date.now() >= deadline;
}

/** Overwrites the tracked deadline with a real, server-confirmed one - used
 * when resuming a saved link on a *different* device (quote.php's
 * promo_deadline_at_ms is authoritative there, see resolveResumeToken() in
 * lib/rescue.ts), never to invent a fresh 24h window on this device. Only
 * moves the deadline *earlier/equal* to whatever's already tracked here -
 * never later, so re-opening an old link can't extend an already-running
 * countdown past what the server actually enforces. */
export function syncPromoDeadlineFromServer(deadlineAtMs: number): void {
  if (!Number.isFinite(deadlineAtMs) || deadlineAtMs <= Date.now()) return;
  const activatedAtMs = deadlineAtMs - PROMO_DEADLINE_WINDOW_HOURS * 60 * 60 * 1000;
  const current = getPromoActivatedAt();
  if (current !== null && current <= activatedAtMs) return;
  writePromoActivatedAtCookie(activatedAtMs);
  try {
    window.localStorage.setItem(PROMO_ACTIVATED_AT_STORAGE_KEY, String(activatedAtMs));
  } catch {
    // localStorage niedostępny - cookie powyżej i tak przenosi synchronizację.
  }
}

export type PromoPreview = {
  code: string;
  type: "percent" | "amount";
  value: number;
  amount: number;
};

export function isPromoActive(code: string = PROMO_CODE): boolean {
  if (readPromoCookie() === code) return true;
  try {
    return window.localStorage.getItem(ACTIVE_PROMO_STORAGE_KEY) === code;
  } catch {
    return false;
  }
}

/** Persists the activation (cookie first - see readPromoCookie() above for
 * why) and notifies every other mounted component on this page in the same
 * tick - storage alone only fires a `storage` event in OTHER tabs/windows,
 * never the tab that made the write. */
export function activatePromoCode(code: string = PROMO_CODE): void {
  writePromoCookie(code);
  try {
    window.localStorage.setItem(ACTIVE_PROMO_STORAGE_KEY, code);
  } catch {
    // localStorage niedostępny - cookie powyżej i tak przenosi aktywację.
  }
  // Only stamp a fresh 24h countdown if one isn't already running - this
  // can in principle fire more than once for the same activation (a
  // re-render, a customer clicking an "aktywny" banner again), and must
  // never push the deadline further out each time. A genuinely new
  // activation (cookie expired/cleared, then reactivated) correctly starts
  // a new window since getPromoActivatedAt() then returns null.
  if (getPromoActivatedAt() === null) {
    const now = Date.now();
    writePromoActivatedAtCookie(now);
    try {
      window.localStorage.setItem(PROMO_ACTIVATED_AT_STORAGE_KEY, String(now));
    } catch {
      // jak wyżej
    }
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
