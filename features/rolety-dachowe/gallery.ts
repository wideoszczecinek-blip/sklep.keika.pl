// Gallery for the rolety-dachowe landing (2026-09-18). The photos are the
// owner's own set from the Allegro offer 18825232620 (downloaded through the
// CRM's Allegro API, resized to 1600 px into /public/rolety-dachowe/):
// product renders of the cassette system, the DEKO / TERMO arrangement
// visuals and four attic interiors. The interiors and the two arrangement
// shots are AI-generated visualisations (the offer marks them "AI") - the
// captions say so; the product renders are the real system 1:1.

export type RdGalleryCategory = {
  id: string;
  label: string;
  note: string;
  photos: string[];
};

export const RD_PRODUCT_PHOTOS: string[] = ["/rolety-dachowe/produkt-01.jpg", "/rolety-dachowe/produkt-02.jpg"];

export const RD_ARRANGEMENT_PHOTOS: string[] = ["/rolety-dachowe/aranzacja-deko.jpg", "/rolety-dachowe/aranzacja-termo.jpg"];

export const RD_INTERIOR_PHOTOS: string[] = [
  "/rolety-dachowe/wnetrze-01.jpg",
  "/rolety-dachowe/wnetrze-02.jpg",
  "/rolety-dachowe/wnetrze-03.jpg",
  "/rolety-dachowe/wnetrze-04.jpg",
];

/** Hero mosaic tiles (RoofHeroPhotos): product render, DEKO in a bright
 * room, TERMO in a darkened bedroom - product, light, blackout. */
export const RD_HERO_PHOTOS: string[] = ["/rolety-dachowe/produkt-01.jpg", "/rolety-dachowe/aranzacja-deko.jpg", "/rolety-dachowe/aranzacja-termo.jpg"];

export const RD_HERO_PHOTO_ALT: string[] = [
  "Roleta dachowa KEIKA - aluminiowa kaseta z prowadnicami i tkaniną blackout, render produktu",
  "Roleta dachowa z tkaniną DEKO w jasnym pokoju na poddaszu - wizualizacja",
  "Roleta dachowa z tkaniną TERMO zaciemniająca sypialnię na poddaszu - wizualizacja",
];

export const RD_ALL_PHOTOS: string[] = [...RD_PRODUCT_PHOTOS, ...RD_ARRANGEMENT_PHOTOS, ...RD_INTERIOR_PHOTOS];

export function buildRdGalleryCategories(): RdGalleryCategory[] {
  return [
    {
      id: "produkt",
      label: "Produkt",
      note: "System rolety dachowej KEIKA: aluminiowa kaseta, prowadnice, belka z hamulcem — trzy kolory osprzętu",
      photos: RD_PRODUCT_PHOTOS,
    },
    {
      id: "tkaniny",
      label: "DEKO i TERMO",
      note: "Tkanina DEKO rozprasza światło, TERMO zaciemnia — wizualizacje efektu w pokoju na poddaszu",
      photos: RD_ARRANGEMENT_PHOTOS,
    },
    {
      id: "wnetrza",
      label: "Aranżacje",
      note: "Rolety dachowe na poddaszu: salon, sypialnia, pokój dzienny — wizualizacje aranżacji",
      photos: RD_INTERIOR_PHOTOS,
    },
  ];
}
