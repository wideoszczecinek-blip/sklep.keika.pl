import type { Metadata } from "next";
import { buildOfertaMetadata, OfertaPage } from "@/features/oferta/page-factory";

// Informacyjny landing produktowy (bez konfiguratora) - treść w
// features/oferta/content/zaluzje-fasadowe.ts, włącznik w lib/info-landings.ts.
const SLUG = "zaluzje-fasadowe";

export function generateMetadata(): Metadata {
  return buildOfertaMetadata(SLUG);
}

export default function Page() {
  return <OfertaPage slug={SLUG} />;
}
