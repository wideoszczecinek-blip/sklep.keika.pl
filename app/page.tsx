import type { Metadata } from "next";
import Home from "./home-client";
import { formatPricePl, getPricedCatalog } from "@/lib/agent-catalog";
import { JsonLdScripts, organizationJsonLd, websiteJsonLd } from "@/lib/structured-data";

const SITE = "https://sklep.keika.pl";

export const metadata: Metadata = {
  title: "KEIKA | Rolety, moskitiery i markizy na wymiar",
  description:
    "Sklep producenta KEIKA: moskitiery ramkowe, rolety i plisy na wymiar z wyceną online w 30 sekund. 5 lat gwarancji, darmowa dostawa od 79 zł.",
  alternates: { canonical: SITE + "/" },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName: "KEIKA",
    url: SITE + "/",
    title: "KEIKA | Rolety, moskitiery i markizy na wymiar",
    description: "Osłony okienne na wymiar od producenta z wyceną online. 5 lat gwarancji, darmowa dostawa od 79 zł.",
  },
};

// Sklep jako organizacja + lista produktów z cenami „od” (25.10.2026) - żeby
// wyszukiwarki i agenci AI od strony głównej trafiali na strony produktów.
export const revalidate = 3600;

// The homepage stays a static shell (client-side product switching via
// ?produkt=... still works for every product); the live product has its own
// statically rendered route - see app/moskitiery-ramkowe/page.tsx and the
// redirect in next.config.ts.
export default async function Page() {
  const catalog = await getPricedCatalog();
  const itemList = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: "Produkty sklepu KEIKA na wymiar",
    itemListElement: catalog.map((product, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: product.url,
      name: `${product.name} - od ${formatPricePl(product.priceFrom)} zł`,
    })),
  };
  return (
    <>
      <JsonLdScripts data={[organizationJsonLd(), websiteJsonLd(), itemList]} />
      <Home />
    </>
  );
}
