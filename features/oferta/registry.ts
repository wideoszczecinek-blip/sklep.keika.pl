import type { OfertaContent } from "./types";
import { ROLETY_TRADYCYJNE } from "./content/rolety-tradycyjne";
import { ROLETY_DZIEN_NOC } from "./content/rolety-dzien-noc";
import { ROLETY_RZYMSKIE } from "./content/rolety-rzymskie";
import { ZALUZJE_PIONOWE } from "./content/zaluzje-pionowe";
import { SCREENY } from "./content/screeny";
import { ROLETY_ZEWNETRZNE } from "./content/rolety-zewnetrzne";
import { ZALUZJE_FASADOWE } from "./content/zaluzje-fasadowe";
import { MARKIZY } from "./content/markizy";
import { ZADASZENIA } from "./content/zadaszenia";
import { SHUTTERSY } from "./content/shuttersy";
import { MOSKITIERY_DACHOWE } from "./content/moskitiery-dachowe";
import { MOSKITIERY_DRZWIOWE } from "./content/moskitiery-drzwiowe";
import { MOSKITIERY_PRZESUWNE } from "./content/moskitiery-przesuwne";
import { MOSKITIERY_PLISOWANE } from "./content/moskitiery-plisowane";

/** Kolejność = kolejność w menu sklepu (grupami).
 * 10.11.2026 (właściciel: „wszystkie produkty na stronie głównej muszą być
 * dostępne”): rolety tradycyjne i dzień-noc wracają jako strony informacyjne
 * dla klientów - ich konfiguratory (features/rolety/) widzi tylko podgląd
 * właściciela (proxy.ts przepisuje publiczny ruch na /oferta/<slug>).
 * Dodane: zadaszenia, shuttersy, moskitiery do okien dachowych. */
export const OFERTA_LANDINGS: OfertaContent[] = [
  ROLETY_TRADYCYJNE,
  ROLETY_DZIEN_NOC,
  ROLETY_RZYMSKIE,
  ZALUZJE_PIONOWE,
  ROLETY_ZEWNETRZNE,
  ZALUZJE_FASADOWE,
  SCREENY,
  MARKIZY,
  ZADASZENIA,
  SHUTTERSY,
  MOSKITIERY_DACHOWE,
  MOSKITIERY_DRZWIOWE,
  MOSKITIERY_PRZESUWNE,
  MOSKITIERY_PLISOWANE,
];

export const OFERTA_BY_SLUG: Record<string, OfertaContent> = Object.fromEntries(
  OFERTA_LANDINGS.map((entry) => [entry.slug, entry]),
);

/** Strony informacyjne, których adres zajmuje konfigurator za bramką podglądu -
 * dla klientów renderowane pod /oferta/<slug> (rewrite w proxy.ts). */
export const OFERTA_REWRITE_SLUGS = ["rolety-tradycyjne", "rolety-dzien-noc"] as const;

export const OFERTA_GROUP_LABELS: Record<OfertaContent["group"], string> = {
  wewnetrzne: "Osłony wewnętrzne",
  zewnetrzne: "Osłony zewnętrzne",
  taras: "Taras i balkon",
  moskitiery: "Moskitiery",
};
