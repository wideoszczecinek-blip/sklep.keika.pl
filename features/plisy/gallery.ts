// Gallery for the plisy landing. Until 2026-09-14 plisy had no gallery at all -
// moskitiery-ramkowe shipped five curated categories, rolety-dachowe two
// photos, plisy zero - so the tab rendered empty.
//
// Three real installation photos, and only those. A first pass also pulled the
// CRM's product imagery in (150 fabric swatches, 10 hardware colours, 3
// mounting diagrams, all already fetched by this landing for the configurator)
// but the owner cut it the same day: swatches belong in the configurator where
// you pick one, not in a gallery you scroll. The owner has more plisy photos
// on disk somewhere; when they surface, they go in PLISY_REAL_PHOTOS below.
//
// The photos: shot by the owner on 2026-07-03, pulled off his phone
// 2026-09-14, resized to 1600 px into /public/plisy/. Three is the honest
// count from that shoot - it also produced two ROOF-window plisy (a different
// product, explicitly out of scope) and one frontal shot of a child's bedroom
// too cluttered to sell anything.

export type PlisyGalleryCategory = {
  id: string;
  label: string;
  note: string;
  photos: string[];
};

/** Real installs, best-first. Anthracite fabric on balcony doors and a
 * window - which is what the product actually looks like in a Polish home. */
export const PLISY_REAL_PHOTOS: string[] = [
  "/plisy/realizacja-02.jpg",
  "/plisy/realizacja-01.jpg",
  "/plisy/realizacja-03.jpg",
];

export function buildPlisyGalleryCategories(): PlisyGalleryCategory[] {
  return [
    {
      id: "realizacje",
      label: "Realizacje",
      note: "Nasze plisy u klientów — zdjęcia z montażu, bez studia i retuszu",
      photos: PLISY_REAL_PHOTOS,
    },
  ];
}
