// Dane strukturalne schema.org dla stron sklepu (25.10.2026) - czytają je
// Google (wyniki z ceną, AI Mode, Merchant listings), Bing/Copilot, ChatGPT
// i Perplexity. Wszystko liczone z lib/agent-catalog.ts, więc cena,
// dostawa i zwroty są tymi samymi liczbami, które widzi klient.
//
// Bez aggregateRating: oceny produktów pochodzą z Allegro, a Google zabrania
// oznaczania w danych strukturalnych opinii zebranych na innej stronie -
// ocena zostaje widoczna na stronie, tylko nie w znacznikach.

import {
  COMPANY_SITE_URL,
  SHOP_POLICY,
  SHOP_URL,
  resolveFaq,
  shippingFor,
  type PricedCatalogProduct,
} from "@/lib/agent-catalog";

export const ORGANIZATION_ID = SHOP_URL + "/#organization";

type JsonLd = Record<string, unknown>;

function postalAddress(): JsonLd {
  return {
    "@type": "PostalAddress",
    streetAddress: SHOP_POLICY.street,
    postalCode: SHOP_POLICY.postalCode,
    addressLocality: SHOP_POLICY.city,
    addressRegion: SHOP_POLICY.region,
    addressCountry: "PL",
  };
}

export function returnPolicyJsonLd(): JsonLd {
  return {
    "@type": "MerchantReturnPolicy",
    applicableCountry: "PL",
    returnPolicyCategory: "https://schema.org/MerchantReturnFiniteReturnWindow",
    merchantReturnDays: SHOP_POLICY.returnDays,
    returnMethod: "https://schema.org/ReturnByMail",
    url: SHOP_POLICY.regulaminUrl,
  };
}

function shippingDetailsJsonLd(product: PricedCatalogProduct): JsonLd {
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: shippingFor(product).toFixed(2), currency: "PLN" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "PL" },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: { "@type": "QuantitativeValue", minValue: product.handlingDays[0], maxValue: product.handlingDays[1], unitCode: "DAY" },
      transitTime: { "@type": "QuantitativeValue", minValue: 1, maxValue: 2, unitCode: "DAY" },
    },
  };
}

/** Sklep jako organizacja - na każdej stronie produktu i na głównej. */
export function organizationJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": ["OnlineStore", "Organization"],
    "@id": ORGANIZATION_ID,
    name: "KEIKA",
    legalName: SHOP_POLICY.legalName,
    url: SHOP_URL,
    logo: SHOP_URL + "/favicon.ico",
    description:
      "Producent osłon okiennych na wymiar ze Szczecinka: moskitiery ramkowe, plisy okienne, rolety i plisy do okien dachowych. Sprzedaż online w całej Polsce z wyceną od razu, 5 lat gwarancji, 30 dni na zwrot.",
    vatID: "PL" + SHOP_POLICY.vatId,
    telephone: SHOP_POLICY.phone,
    email: SHOP_POLICY.email,
    address: postalAddress(),
    areaServed: { "@type": "Country", name: "Polska" },
    sameAs: [COMPANY_SITE_URL],
    contactPoint: {
      "@type": "ContactPoint",
      contactType: "customer service",
      telephone: SHOP_POLICY.phone,
      email: SHOP_POLICY.email,
      availableLanguage: "pl",
    },
    hasMerchantReturnPolicy: returnPolicyJsonLd(),
  };
}

export function websiteJsonLd(): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": SHOP_URL + "/#website",
    name: "Sklep KEIKA",
    url: SHOP_URL,
    inLanguage: "pl-PL",
    publisher: { "@id": ORGANIZATION_ID },
  };
}

export function productJsonLd(product: PricedCatalogProduct): JsonLd {
  const images = [product.image, ...product.extraImages];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": product.url + "#product",
    name: product.name,
    description: product.description,
    image: images,
    brand: { "@type": "Brand", name: "KEIKA" },
    manufacturer: { "@id": ORGANIZATION_ID },
    sku: product.sku,
    mpn: product.mpn,
    category: product.category,
    url: product.url,
    additionalProperty: [
      { "@type": "PropertyValue", name: "Wymiary", value: product.sizes },
      { "@type": "PropertyValue", name: "Montaż", value: product.mounting },
      { "@type": "PropertyValue", name: "Pomiar", value: product.measuring },
      { "@type": "PropertyValue", name: "Czas realizacji", value: product.leadTime },
      { "@type": "PropertyValue", name: "Gwarancja", value: `${SHOP_POLICY.warrantyYears} lat` },
      ...product.options.map((option) => ({ "@type": "PropertyValue", name: "Opcje", value: option })),
    ],
    offers: {
      "@type": "Offer",
      url: product.url,
      priceCurrency: "PLN",
      price: product.priceFrom.toFixed(2),
      // Cena „od” produktu szytego na wymiar - dokładna zależy od wymiaru.
      priceSpecification: {
        "@type": "UnitPriceSpecification",
        price: product.priceFrom.toFixed(2),
        priceCurrency: "PLN",
        valueAddedTaxIncluded: true,
        ...(product.priceUnit ? { referenceQuantity: { "@type": "QuantitativeValue", value: 1, unitCode: "MTR", unitText: product.priceUnit } } : {}),
        description: "Cena od: " + product.priceNote,
      },
      availability: "https://schema.org/InStock",
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": ORGANIZATION_ID },
      shippingDetails: shippingDetailsJsonLd(product),
      hasMerchantReturnPolicy: returnPolicyJsonLd(),
    },
  };
}

export function breadcrumbJsonLd(product: PricedCatalogProduct): JsonLd {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Sklep KEIKA", item: SHOP_URL + "/" },
      { "@type": "ListItem", position: 2, name: product.shortName, item: product.url },
    ],
  };
}

export function faqJsonLd(product: PricedCatalogProduct): JsonLd | null {
  const entries = resolveFaq(product);
  if (!entries.length) return null;
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: entries.map((entry) => ({
      "@type": "Question",
      name: entry.question,
      acceptedAnswer: { "@type": "Answer", text: entry.answer },
    })),
  };
}

/** Komplet dla strony produktu: Product, okruszki, FAQ, organizacja. */
export function productPageJsonLd(product: PricedCatalogProduct): JsonLd[] {
  return [productJsonLd(product), breadcrumbJsonLd(product), faqJsonLd(product), organizationJsonLd()].filter(
    (entry): entry is JsonLd => entry !== null,
  );
}

/** <script type="application/ld+json"> - tylko JSON z katalogu, „<” zabezpieczone. */
export function JsonLdScripts({ data }: { data: JsonLd[] }) {
  return (
    <>
      {data.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry).replace(/</g, "\\u003c") }}
        />
      ))}
    </>
  );
}
