import type { Metadata } from "next";
import Home from "../home-client";
import { getPricedProduct } from "@/lib/agent-catalog";
import { JsonLdScripts, productPageJsonLd } from "@/lib/structured-data";
import { PLISY_LEAD_TIME_LABEL } from "@/features/plisy/landing-content";

// Statycznie prerenderowana strona plis (wydajność, punkt 6 audytu
// landingu). Wejście z reklam - /?produkt=plisy - przekierowuje tu 308
// (proxy.ts), zachowując wszystkie pozostałe parametry (fbclid, utm_*,
// resume_token). Dokładnie ten sam zabieg, który 2026-09-13 zdjął LCP z
// 9,8 s na moskitierach: HTML z CDN niesie już widok produktu (H1, cena,
// plakietki, szkielet konfiguratora), zamiast zasłony startowej czekającej
// na hydrację całego home-client.
const SITE = "https://sklep.keika.pl";
const URL_PATH = "/plisy";
const SLUG = "plisy";
const TITLE = "Plisy okienne na wymiar od producenta - 150 tkanin | KEIKA";
const DESCRIPTION =
  "Plisy okienne na wymiar prosto od producenta: regulacja z góry i z dołu, montaż bez wiercenia lub przykręcany do listwy, 150 tkanin w 5 kolekcjach (od przepuszczających światło po zaciemniające DUO TERMO). Wycena online, realizacja " +
  PLISY_LEAD_TIME_LABEL +
  ", 5 lat gwarancji, 30 dni na zwrot.";
const IMAGE = SITE + "/plisy/produkt-01.jpg";

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
    images: [{ url: IMAGE, alt: "Plisa okienna KEIKA na oknie" }],
  },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, images: [IMAGE] },
};

export default async function PlisyPage() {
  const product = await getPricedProduct(SLUG);
  return (
    <>
      <JsonLdScripts data={productPageJsonLd(product)} />
      <Home initialProductSlug={SLUG} />
    </>
  );
}
