// Which product slugs are actually reachable through normal site navigation
// right now. Everything else's real page keeps working end to end (direct
// link, e.g. for internal review/testing before launch) - only the click-
// through entry points (header mega menu, the in-page "Produkty" switcher,
// category grid tiles) are intercepted with a "w budowie" notice instead of
// navigating. See app/page.tsx's activateProductView() and
// app/kategoria/[slug]/page.tsx's product card Link for the two places this
// is actually enforced.
//
// To launch a product: add its slug here and redeploy - a deliberate one-
// line change (not a CRM toggle) since "go live" is a rare, high-stakes
// moment worth a conscious code change, unlike routine content edits like
// swatch colors or prices which are meant to be self-service in the CRM.
export const LIVE_PRODUCT_SLUGS = new Set<string>(["moskitiery-ramkowe"]);

export function isProductSlugLive(slug: string): boolean {
  return LIVE_PRODUCT_SLUGS.has(String(slug || "").trim().toLowerCase());
}

export const PRODUCT_LOCKED_MESSAGE = "Strona produktu w budowie.";
