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

/** Owner's product photo set from D:\KEIKA\Grafika\PRODUKTY\Plisy\Produktowe
 * na strone (2026-09-16): office installs (grey top-down plisy in a
 * conference room and two offices, white plisy on an office glass wall)
 * and one bright product shot of a white plisa. The roof-window photo in
 * that folder was left out - different product. */
export const PLISY_PRODUCT_PHOTOS: string[] = ["/plisy/produkt-01.jpg"];
export const PLISY_OFFICE_PHOTOS: string[] = [
  "/plisy/realizacja-05.jpg",
  "/plisy/realizacja-04.jpg",
  "/plisy/realizacja-06.jpg",
  "/plisy/realizacja-07.jpg",
];

/** Detail crops cut from the 4000 px originals of the three home installs
 * (honeycomb structure + top rail with handle, both blinds on the balcony
 * door, pleat edge from the side) plus two close-ups from the owner's set
 * (16 mm pleat fabric, non-invasive bracket). Real product, 1:1. */
export const PLISY_DETAIL_PHOTOS: string[] = [
  "/plisy/detal-01.jpg",
  "/plisy/detal-04.jpg",
  "/plisy/detal-05.jpg",
  "/plisy/detal-02.jpg",
  "/plisy/detal-03.jpg",
];

/** The three tiles of the hero mosaic (PlisyHeroPhotos): the bright white
 * product shot, the conference room, the owner's two-sash window with both
 * blinds - product, scale, function. */
export const PLISY_HERO_PHOTOS: string[] = ["/plisy/produkt-01.jpg", "/plisy/realizacja-05.jpg", "/plisy/realizacja-02.jpg"];

/** Everything, in the order the CRM gallery reel shows it. */
export const PLISY_ALL_PHOTOS: string[] = [
  ...PLISY_PRODUCT_PHOTOS,
  "/plisy/realizacja-02.jpg",
  ...PLISY_OFFICE_PHOTOS,
  "/plisy/realizacja-01.jpg",
  "/plisy/realizacja-03.jpg",
  ...PLISY_DETAIL_PHOTOS,
];

export function buildPlisyGalleryCategories(): PlisyGalleryCategory[] {
  return [
    {
      id: "produkt",
      label: "Produkt",
      note: "Plisa okienna KEIKA",
      photos: PLISY_PRODUCT_PHOTOS,
    },
    {
      id: "realizacje",
      label: "Domy",
      note: "Nasze plisy u klientów — zdjęcia z montażu, bez studia i retuszu",
      photos: PLISY_REAL_PHOTOS,
    },
    {
      id: "biura",
      label: "Biura",
      note: "Plisy w salach konferencyjnych i biurach — regulacja od góry ogranicza odblaski na monitorach",
      photos: PLISY_OFFICE_PHOTOS,
    },
    {
      id: "detale",
      label: "Z bliska",
      note: "Struktura plastra miodu, belka z uchwytem, krawędź fałd — zbliżenia z tych samych montaży",
      photos: PLISY_DETAIL_PHOTOS,
    },
  ];
}
