import type { Metadata } from "next";
import Home from "../home-client";
import { getPricedProduct } from "@/lib/agent-catalog";
import { JsonLdScripts, productPageJsonLd } from "@/lib/structured-data";

// Canonical, statically prerendered product page (audit 2026-09-13). The
// former /?produkt=moskitiery-ramkowe entry point 308-redirects here (see
// next.config.ts) with every other query param (fbclid, utm_*, resume_token)
// carried over. Rendering Home with initialProductSlug means the HTML the
// CDN serves already contains the product view - H1, price, trust chips,
// configurator skeleton - instead of a boot overlay.

const SITE = "https://sklep.keika.pl";
const URL_PATH = "/moskitiery-ramkowe";
const SLUG = "moskitiery-ramkowe";
const TITLE = "Moskitiery ramkowe na wymiar od producenta - 5 lat gwarancji | KEIKA";
const DESCRIPTION =
  "Moskitiera ramkowa na wymiar: aluminiowa rama, wzmocniona siatka, 7 kolorów profili, montaż bez wiercenia. Wycena online w 30 sekund, 5 lat gwarancji, darmowa dostawa od 79 zł, wysyłka z produkcji w Szczecinku.";
const IMAGE =
  "https://crm-keika.groovemedia.pl/storage/shop/media/moskitiery-ramkowe-galeria/moskitiera-okienna-allegro-miniaturka.jpg";

// Dane strukturalne (Product, FAQ, okruszki, sklep) z lib/agent-catalog.ts -
// cena „od” z korektą ceny z CRM, odświeżana co godzinę (25.10.2026).
export const revalidate = 3600;

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE + URL_PATH },
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName: "KEIKA",
    url: SITE + URL_PATH,
    title: TITLE,
    description: DESCRIPTION,
    images: [{ url: IMAGE, alt: "Moskitiera ramkowa KEIKA na oknie" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [IMAGE] },
};

export default async function MoskitieryRamkowePage() {
  const product = await getPricedProduct(SLUG);
  return (
    <>
      <JsonLdScripts data={productPageJsonLd(product)} />
      <Home initialProductSlug={SLUG} />
    </>
  );
}
