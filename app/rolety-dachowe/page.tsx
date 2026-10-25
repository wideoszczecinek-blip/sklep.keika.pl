import type { Metadata } from "next";
import Home from "../home-client";
import { formatPricePl, getPricedProduct } from "@/lib/agent-catalog";
import { JsonLdScripts, productPageJsonLd } from "@/lib/structured-data";

// Statycznie prerenderowana strona rolet dachowych (25.10.2026, gotowość na
// agentów zakupowych AI). Do dziś produkt żył tylko pod /?produkt=rolety-dachowe,
// czyli bot dostawał HTML strony głównej z kanonicznym "/" - zero treści o
// roletach. Wejście z reklam /?produkt=rolety-dachowe przekierowuje tu 308
// (proxy.ts) z zachowaniem fbclid, utm_*, resume_token - ten sam zabieg co
// moskitiery (13.09) i plisy (24.09). Cena w danych strukturalnych odświeża
// się co godzinę z korekty ceny w CRM.
export const revalidate = 3600;

const SLUG = "rolety-dachowe";
const TITLE = "Rolety do okien dachowych na wymiar - pod model okna | KEIKA";
const DESCRIPTION =
  "Roleta do okna dachowego w aluminiowej kasecie z prowadnicami i hamulcem, dobrana do modelu Twojego okna (VELUX, FAKRO, ROTO, OKPOL i inne - ponad 420 modeli). 73 tkaniny DEKO i TERMO blackout. Wysyłka zwykle w 2 dni robocze, 5 lat gwarancji, 30 dni na zwrot.";

export async function generateMetadata(): Promise<Metadata> {
  const product = await getPricedProduct(SLUG);
  const description = DESCRIPTION + ` Cena od ${formatPricePl(product.priceFrom)} zł.`;
  return {
    title: TITLE,
    description,
    alternates: { canonical: product.url },
    openGraph: {
      type: "website",
      locale: "pl_PL",
      siteName: "KEIKA",
      url: product.url,
      title: TITLE,
      description,
      images: [{ url: product.image, alt: "Roleta KEIKA w oknie dachowym" }],
    },
    twitter: { card: "summary_large_image", title: TITLE, description, images: [product.image] },
  };
}

export default async function RoletyDachowePage() {
  const product = await getPricedProduct(SLUG);
  return (
    <>
      <JsonLdScripts data={productPageJsonLd(product)} />
      <Home initialProductSlug={SLUG} />
    </>
  );
}
