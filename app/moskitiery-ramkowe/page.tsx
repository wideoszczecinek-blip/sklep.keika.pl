import type { Metadata } from "next";
import Home from "../home-client";
import { ALLEGRO_RATING_SNAPSHOTS } from "@/lib/landing-snapshot";
import {
  MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO,
  MOSKITIERY_RAMKOWE_PRICE_PER_MB_STANDARD,
} from "@/features/moskitiery-ramkowe/shared";

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

function buildJsonLd() {
  const rating = ALLEGRO_RATING_SNAPSHOTS[SLUG];
  const perMb = MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO || MOSKITIERY_RAMKOWE_PRICE_PER_MB_STANDARD;
  // Real, current per-started-meter list price (SEZON20 is applied at
  // checkout and not asserted here). Smallest orderable frame bills 1 mb,
  // the largest supported (2,5 x 1,6 m) ~9 mb.
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: "Moskitiera ramkowa na wymiar",
    description: DESCRIPTION,
    image: [IMAGE],
    brand: { "@type": "Brand", name: "KEIKA" },
    sku: "moskitiera-ramkowa-na-wymiar",
    category: "Moskitiery okienne",
    url: SITE + URL_PATH,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "PLN",
      lowPrice: perMb.toFixed(2),
      highPrice: (perMb * 9).toFixed(2),
      offerCount: 1,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      url: SITE + URL_PATH,
      seller: { "@type": "Organization", name: "KEIKA" },
    },
    ...(rating && rating.totalResponses > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: rating.averageScore.toFixed(2),
            reviewCount: rating.totalResponses,
            bestRating: 5,
            worstRating: 1,
          },
        }
      : {}),
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "KEIKA", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: "Moskitiery ramkowe na wymiar", item: SITE + URL_PATH },
    ],
  };
  return [product, breadcrumbs];
}

export default function MoskitieryRamkowePage() {
  const jsonLd = buildJsonLd();
  return (
    <>
      {jsonLd.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          // JSON only - nothing user-supplied ends up here.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
      <Home initialProductSlug={SLUG} />
    </>
  );
}
