import type { Metadata } from "next";
import Home from "../home-client";
import { PLISY_LEAD_TIME_LABEL, PLISY_STARTING_PRICE_FALLBACK } from "@/features/plisy/landing-content";

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

function buildJsonLd() {
  // lowPrice = najniższa realna cena plisy (ta sama liczba, co "od ... zł"
  // na stronie, gdy cennik z CRM jeszcze się nie wczytał). Bez highPrice -
  // górna granica zależy od kolekcji i wymiaru, a zmyślona liczba w danych
  // strukturalnych byłaby gorsza niż jej brak.
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Plisy okienne na wymiar",
    description: DESCRIPTION,
    image: [IMAGE],
    brand: { "@type": "Brand", name: "KEIKA" },
    sku: "plisa-okienna-na-wymiar",
    category: "Plisy okienne",
    url: SITE + URL_PATH,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "PLN",
      lowPrice: PLISY_STARTING_PRICE_FALLBACK.toFixed(2),
      offerCount: 1,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      url: SITE + URL_PATH,
      seller: { "@type": "Organization", name: "KEIKA" },
    },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "KEIKA", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Plisy okienne na wymiar", item: SITE + URL_PATH },
    ],
  };
  return [product, breadcrumbs];
}

export default function PlisyPage() {
  const jsonLd = buildJsonLd();
  return (
    <>
      {jsonLd.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          // Tylko JSON - nic pochodzącego od użytkownika tu nie trafia.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
      <Home initialProductSlug={SLUG} />
    </>
  );
}
