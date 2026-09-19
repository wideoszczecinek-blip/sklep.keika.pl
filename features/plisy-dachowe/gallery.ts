// Gallery for the plisy-dachowe landing (2026-09-19). The photos are the
// owner's own plisa dachowa set (Allegro offer photos + the offer's product
// render, resized into /public/plisy-dachowe/): the pine roof window with a
// white/dark plisa, three close-ups of the bottom rail and handle in the
// guides, and the two-window attic. Nothing AI-generated here.

export type PdGalleryCategory = {
  id: string;
  label: string;
  note: string;
  photos: string[];
};

export const PD_PRODUCT_PHOTOS: string[] = ["/plisy-dachowe/produkt-01.jpg", "/plisy-dachowe/okno-01.jpg", "/plisy-dachowe/produkt-02.jpg", "/plisy-dachowe/produkt-03.jpg"];

export const PD_DETAIL_PHOTOS: string[] = ["/plisy-dachowe/detal-01.jpg", "/plisy-dachowe/detal-02.jpg", "/plisy-dachowe/detal-03.jpg"];

export const PD_INTERIOR_PHOTOS: string[] = ["/plisy-dachowe/aranzacja-01.jpg"];

/** Hero: the attic with two roof windows as the stage, then product,
 * window and close-up as the three tiles. */
export const PD_HERO_STAGE_PHOTO = "/plisy-dachowe/aranzacja-01.jpg";
export const PD_HERO_PHOTOS: string[] = ["/plisy-dachowe/okno-01.jpg", "/plisy-dachowe/produkt-01.jpg", "/plisy-dachowe/detal-02.jpg"];

export const PD_HERO_PHOTO_ALT: string[] = [
  "Plisa dachowa KEIKA w sosnowym oknie dachowym - jasna tkanina, osprzęt sosna",
  "Plisa dachowa KEIKA - render produktu w oknie dachowym z prowadnicami",
  "Plisa dachowa z bliska - dolna belka z uchwytem w aluminiowej prowadnicy",
];

export const PD_ALL_PHOTOS: string[] = [...PD_PRODUCT_PHOTOS, ...PD_DETAIL_PHOTOS, ...PD_INTERIOR_PHOTOS];

export function buildPdGalleryCategories(): PdGalleryCategory[] {
  return [
    {
      id: "produkt",
      label: "Produkt",
      note: "Plisa dachowa KEIKA na skrzydle okna dachowego: belki w aluminiowych prowadnicach, osprzęt sosna",
      photos: PD_PRODUCT_PHOTOS,
    },
    {
      id: "detale",
      label: "Z bliska",
      note: "Dolna belka z uchwytem, plisowana tkanina i prowadnica — detale wykonania",
      photos: PD_DETAIL_PHOTOS,
    },
    {
      id: "wnetrza",
      label: "Aranżacje",
      note: "Dwa okna dachowe z plisami na poddaszu",
      photos: PD_INTERIOR_PHOTOS,
    },
  ];
}
