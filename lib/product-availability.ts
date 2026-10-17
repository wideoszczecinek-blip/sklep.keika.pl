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
// 2026-09-19 (owner: "możesz podpiąć te dwa produkty już w menu"): rolety
// dachowe and plisy dachowe joined the live set.
import { infoLandingHref } from "@/lib/info-landings";

// 2026-10-17: rolety mini (dzień-noc i tradycyjne Deko/Termo) z własnym
// konfiguratorem (features/rolety/) - zastąpiły informacyjne landingi.
export const LIVE_PRODUCT_SLUGS = new Set<string>([
  "moskitiery-ramkowe",
  "plisy",
  "rolety-dachowe",
  "plisy-dachowe",
  // "rolety-dzien-noc" i "rolety-tradycyjne" - podgląd tylko dla właściciela (proxy.ts), do akceptacji poza LIVE
]);

/** Catalog placeholders that stand for a live landing under another slug
 * (the CRM record for roof blinds is still "roleta-dachowa-dekolux"). */
const LIVE_PRODUCT_SLUG_ALIASES: Record<string, string> = {
  "rolety-dachowe-dekolux": "rolety-dachowe",
  "roleta-dachowa-dekolux": "rolety-dachowe",
};

export function resolveLiveProductSlug(slug: string): string {
  const normalized = String(slug || "").trim().toLowerCase();
  return LIVE_PRODUCT_SLUG_ALIASES[normalized] || normalized;
}

export function isProductSlugLive(slug: string): boolean {
  // Informacyjne landingi (lib/info-landings.ts) liczą się jako dostępne
  // tylko gdy włączone - na produkcji bez NEXT_PUBLIC_INFO_LANDINGS nic się
  // nie zmienia.
  if (infoLandingHref(slug)) return true;
  return LIVE_PRODUCT_SLUGS.has(resolveLiveProductSlug(slug));
}

export const PRODUCT_LOCKED_MESSAGE = "Strona produktu w budowie.";
