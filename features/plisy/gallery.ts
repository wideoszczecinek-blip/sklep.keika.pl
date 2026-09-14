// Gallery for the plisy landing. Until now plisy had no gallery at all -
// moskitiery-ramkowe shipped five curated categories, rolety-dachowe two
// photos, plisy zero - so the tab rendered empty.
//
// Two sources, both real, neither invented:
//
//  1. Three installation photos the owner shot on 2026-07-03, pulled off his
//     phone 2026-09-14 and resized to 1600 px into /public/plisy/. Three is
//     the honest count: the same shoot also produced two ROOF-window plisy
//     (a different product, explicitly out of scope here) and one frontal
//     shot of a child's bedroom too cluttered to sell anything.
//
//  2. The product imagery already sitting on the CRM and already fetched by
//     this landing for the configurator - 150 fabric swatches across five
//     collections, 10 hardware colours, 3 mounting types. Read live off
//     PlisyProfile rather than hardcoded, so adding a fabric in the CRM adds
//     it here with no deploy.
import type { PlisyProfile } from "./shared";

export type PlisyGalleryCategory = {
  id: string;
  label: string;
  note: string;
  photos: string[];
};

/** Real installs, best-first. Anthracite fabric on balcony doors and a
 * window - which is what the product actually looks like in a Polish home,
 * and nothing like the white-on-white stock hero this replaced. */
export const PLISY_REAL_PHOTOS: string[] = [
  "/plisy/realizacja-02.jpg",
  "/plisy/realizacja-01.jpg",
  "/plisy/realizacja-03.jpg",
];

/** How many swatches per collection reach the gallery. The configurator shows
 * all of them; the gallery is a taster, and a 150-photo reel is not one. */
const SWATCHES_PER_COLLECTION = 8;

/** Spread a collection's swatches across its whole range instead of taking
 * the first N, so the sample shows light-to-dark rather than eight nearly
 * identical creams off the top of the list. */
function spread<T>(items: T[], count: number): T[] {
  if (items.length <= count) return items;
  const step = items.length / count;
  return Array.from({ length: count }, (_, i) => items[Math.floor(i * step)]);
}

export function buildPlisyGalleryCategories(profile: PlisyProfile | null): PlisyGalleryCategory[] {
  const categories: PlisyGalleryCategory[] = [
    {
      id: "realizacje",
      label: "Realizacje",
      note: "Nasze plisy u klientów — zdjęcia z montażu, bez studia i retuszu",
      photos: PLISY_REAL_PHOTOS,
    },
  ];

  if (!profile) return categories;

  const fabrics = profile.fabricGroups
    .flatMap((group) =>
      spread(
        group.swatches.map((swatch) => swatch.thumbnailUrl || swatch.imageUrl).filter(Boolean),
        SWATCHES_PER_COLLECTION,
      ),
    )
    .filter(Boolean);
  if (fabrics.length) {
    const names = profile.fabricGroups.map((group) => group.label).join(", ");
    categories.push({
      id: "tkaniny",
      label: "Tkaniny",
      note: `Przekrój przez kolekcje: ${names}. Pełną paletę wybierzesz w konfiguratorze`,
      photos: fabrics,
    });
  }

  const hardware = profile.hardware.map((option) => option.imageUrl).filter(Boolean);
  if (hardware.length) {
    categories.push({
      id: "mechanizm",
      label: "Kolory mechanizmu",
      note: "Listwy i profile — dobierz do stolarki okiennej",
      photos: hardware,
    });
  }

  const mounts = profile.mountOptions.map((option) => option.imageUrl).filter(Boolean);
  if (mounts.length) {
    categories.push({
      id: "montaz",
      label: "Montaż",
      note: "Wersja wkręcana i dwie bezinwazyjne — do PCV i do metalu, bez wiercenia",
      photos: mounts,
    });
  }

  return categories;
}
