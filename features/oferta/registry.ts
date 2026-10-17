import type { OfertaContent } from "./types";
import { ROLETY_TRADYCYJNE } from "./content/rolety-tradycyjne";
import { ROLETY_DZIEN_NOC } from "./content/rolety-dzien-noc";
import { ROLETY_RZYMSKIE } from "./content/rolety-rzymskie";
import { ZALUZJE_PIONOWE } from "./content/zaluzje-pionowe";
import { ROLETY_ZEWNETRZNE } from "./content/rolety-zewnetrzne";
import { ZALUZJE_FASADOWE } from "./content/zaluzje-fasadowe";
import { MARKIZY } from "./content/markizy";
import { MOSKITIERY_DRZWIOWE } from "./content/moskitiery-drzwiowe";
import { MOSKITIERY_PRZESUWNE } from "./content/moskitiery-przesuwne";
import { MOSKITIERY_PLISOWANE } from "./content/moskitiery-plisowane";

/** Kolejność = kolejność w menu sklepu (grupami). */
export const OFERTA_LANDINGS: OfertaContent[] = [
  ROLETY_TRADYCYJNE,
  ROLETY_DZIEN_NOC,
  ROLETY_RZYMSKIE,
  ZALUZJE_PIONOWE,
  ROLETY_ZEWNETRZNE,
  ZALUZJE_FASADOWE,
  MARKIZY,
  MOSKITIERY_DRZWIOWE,
  MOSKITIERY_PRZESUWNE,
  MOSKITIERY_PLISOWANE,
];

export const OFERTA_BY_SLUG: Record<string, OfertaContent> = Object.fromEntries(
  OFERTA_LANDINGS.map((entry) => [entry.slug, entry]),
);

export const OFERTA_GROUP_LABELS: Record<OfertaContent["group"], string> = {
  wewnetrzne: "Osłony wewnętrzne",
  zewnetrzne: "Osłony zewnętrzne",
  taras: "Taras i balkon",
  moskitiery: "Moskitiery",
};
