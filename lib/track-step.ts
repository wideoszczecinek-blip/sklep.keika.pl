/**
 * Shared, minimal-boilerplate wrapper around trackStorefrontEvent for
 * granular in-page interaction tracking (configurator steps, gallery/zoom
 * opens, accordion toggles, ...) - every call site was re-deriving the same
 * session token / device type / page slug by hand before this existed.
 * Fire-and-forget by design: never awaited, never throws into the caller.
 *
 * 2026-09-17: also broadcasts every step as a DOM CustomEvent
 * (SHOP_STEP_EVENT) so in-page listeners - the chat nudge in
 * app/components/chat-nudge.tsx - can react to "what the customer just did"
 * without every configurator having to know about them. Optional
 * `quoteCode` lands in the analytics row's quote_code column, which is
 * what the CRM's quote list groups on (save/share badges).
 */
export const SHOP_STEP_EVENT = "keika:shop-step";

export type ShopStepDetail = {
  eventName: string;
  label: string;
  meta?: Record<string, string | number | boolean | null>;
};

export function trackShopStep(
  eventName: string,
  label: string,
  meta?: Record<string, string | number | boolean | null>,
  quoteCode?: string,
): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent<ShopStepDetail>(SHOP_STEP_EVENT, { detail: { eventName, label, meta } }));
  } catch {
    // Listeners are a convenience; the analytics call below still goes out.
  }
  let sessionToken = "";
  try {
    sessionToken = window.sessionStorage.getItem("keika_shop_session_token") || "";
  } catch {
    // sessionStorage niedostępny (np. tryb prywatny) - event i tak poleci, bez grupowania w sesję.
  }
  void import("@/lib/shop-public")
    .then(({ trackStorefrontEvent }) =>
      trackStorefrontEvent({
        event_name: eventName,
        event_label: label,
        page_slug: window.location.pathname + window.location.search,
        ...(quoteCode ? { quote_code: quoteCode } : {}),
        session_token: sessionToken,
        device_type: window.innerWidth < 768 ? "mobile" : "desktop",
        meta,
      }),
    )
    .catch(() => {
      // Analytics must never be the reason an interaction fails.
    });
}
