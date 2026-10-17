import type { Metadata } from "next";
import Home from "@/app/home-client";
import { ROLETY_COPY, type RoletySlug } from "./shared";

// Statyczne strony produktu rolet (/rolety-dzien-noc, /rolety-tradycyjne) -
// ten sam zabieg co app/plisy/page.tsx: HTML z CDN niesie już widok
// produktu (H1, cena "od", szkielet konfiguratora), a /?produkt=<slug>
// przekierowuje tu 308 (proxy.ts) z zachowaniem fbclid/utm.
const SITE = "https://sklep.keika.pl";

/** Zdjęcie do metadanych i danych strukturalnych - główne zdjęcie produktu
 * z CRM (gallery_urls[0]); adresy stałe, bo metadata liczy się na serwerze. */
const IMAGE_BY_SLUG: Record<RoletySlug, string> = {
  "rolety-dzien-noc": "https://crm-keika.groovemedia.pl/storage/shop/media/bamar_sys_b1dn_1200.jpg",
  "rolety-tradycyjne": "https://crm-keika.groovemedia.pl/storage/shop/media/bamar_sys_b1minilux_1200.jpg",
};

export function buildRoletyMetadata(slug: RoletySlug): Metadata {
  const copy = ROLETY_COPY[slug];
  const url = SITE + copy.path;
  const image = IMAGE_BY_SLUG[slug];
  return {
    title: copy.seoTitle,
    description: copy.seoDescription,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "pl_PL",
      siteName: "KEIKA",
      url,
      title: copy.seoTitle,
      description: copy.seoDescription,
      images: [{ url: image, alt: copy.h1 }],
    },
    twitter: { card: "summary_large_image", title: copy.seoTitle, description: copy.seoDescription, images: [image] },
  };
}

function buildJsonLd(slug: RoletySlug) {
  const copy = ROLETY_COPY[slug];
  const url = SITE + copy.path;
  // lowPrice = najniższa komórka cennika w CRM (76,90 / 72,90 zł); bez
  // highPrice - górna granica zależy od kolekcji, wymiaru i montażu.
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: copy.h1,
    description: copy.seoDescription,
    image: [IMAGE_BY_SLUG[slug]],
    brand: { "@type": "Brand", name: "KEIKA" },
    sku: copy.sku,
    category: copy.category,
    url,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "PLN",
      lowPrice: copy.startingPriceFallback.toFixed(2),
      offerCount: 1,
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      url,
      seller: { "@type": "Organization", name: "KEIKA" },
    },
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "KEIKA", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: copy.h1, item: url },
    ],
  };
  return [product, breadcrumbs];
}

export function RoletyProductPage({ slug }: { slug: RoletySlug }) {
  const jsonLd = buildJsonLd(slug);
  return (
    <>
      {jsonLd.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          // Tylko JSON z naszych stałych - nic od użytkownika tu nie trafia.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
      <Home initialProductSlug={slug} />
    </>
  );
}
