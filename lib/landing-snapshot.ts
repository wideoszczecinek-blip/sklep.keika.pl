// Build-time snapshots of the small, slow-changing slices of the CRM's
// shop-public API that the landing page (app/page.tsx) needs for its FIRST
// paint - so it can render real content immediately instead of sitting on
// the boot overlay while a cross-origin fetch to the (flaky, shared-host)
// CRM completes. The live fetches still run on mount and replace these if
// anything differs (app/page.tsx does a hash compare for the config), so a
// stale snapshot self-heals within ~1s of load; it only ever shows for that
// first frame.
//
// homepage.json = the trimmed homepage_public config: branding, hero
// carousel/titles, hero_media, top_links, menu_groups. Deliberately NOT
// product_configurators (67 KB) / product_groups (34 KB) - not first-paint,
// and app/page.tsx already treats them as absent when missing.
//
// Re-capture after the owner changes homepage branding / hero images /
// menu in the CRM admin (rare):
//   curl -s https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public
//   -> keep only {branding,hero_carousel,hero_titles,hero_media,top_links,menu_groups}
// Captured 2026-09-08.

import homepageJson from "./landing-snapshots/homepage.json";
import moskitieryRatingJson from "./landing-snapshots/moskitiery-ramkowe-rating.json";

// The JSON is a partial of app/page.tsx's HomepageConfig - the consumer
// casts it. Everything the snapshot omits, app/page.tsx already guards for
// (Array.isArray(config?.x) ? ... : []), same as when config was null.
export const HOMEPAGE_CONFIG_SNAPSHOT: Record<string, unknown> = homepageJson as Record<string, unknown>;

export type AllegroRatingSnapshot = {
  averageScore: number;
  totalResponses: number;
  scoreDistribution: Array<{ stars: number; count: number }>;
};

// Keyed by product slug - only products whose landing view shows the rating
// chip above the fold need one (currently just moskitiery-ramkowe).
export const ALLEGRO_RATING_SNAPSHOTS: Record<string, AllegroRatingSnapshot> = {
  "moskitiery-ramkowe": moskitieryRatingJson as AllegroRatingSnapshot,
};
