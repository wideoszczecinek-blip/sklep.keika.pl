/**
 * Shared, minimal-boilerplate wrapper around trackStorefrontEvent for
 * granular in-page interaction tracking (configurator steps, gallery/zoom
 * opens, accordion toggles, ...) - every call site was re-deriving the same
 * session token / device type / page slug by hand before this existed.
 * Fire-and-forget by design: never awaited, never throws into the caller.
 */
export function trackShopStep(
  eventName: string,
  label: string,
  meta?: Record<string, string | number | boolean | null>,
): void {
  if (typeof window === "undefined") return;
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
        session_token: sessionToken,
        device_type: window.innerWidth < 768 ? "mobile" : "desktop",
        meta,
      }),
    )
    .catch(() => {
      // Analytics must never be the reason an interaction fails.
    });
}
