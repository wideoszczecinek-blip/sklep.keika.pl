import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { INFO_LANDINGS_ENABLED } from "@/lib/info-landings";
import InfoLanding from "./InfoLanding";
import { OFERTA_BY_SLUG } from "./registry";

const SITE = "https://sklep.keika.pl";

/** Metadane trasy landingu - 404 (puste) gdy landingi wyłączone. */
export function buildOfertaMetadata(slug: string): Metadata {
  const content = OFERTA_BY_SLUG[slug];
  if (!INFO_LANDINGS_ENABLED || !content) return { robots: { index: false, follow: false } };
  const url = SITE + content.path;
  const image = SITE + content.hero.src;
  return {
    title: content.seoTitle,
    description: content.seoDescription,
    alternates: { canonical: url },
    openGraph: {
      type: "website",
      locale: "pl_PL",
      siteName: "KEIKA",
      url,
      title: content.seoTitle,
      description: content.seoDescription,
      images: [{ url: image, alt: content.hero.alt }],
    },
    twitter: { card: "summary_large_image", title: content.seoTitle, description: content.seoDescription, images: [image] },
  };
}

function buildJsonLd(slug: string) {
  const content = OFERTA_BY_SLUG[slug];
  const product = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: content.title,
    description: content.seoDescription,
    image: [SITE + content.hero.src],
    brand: { "@type": "Brand", name: "KEIKA" },
    category: content.menuLabel,
    url: SITE + content.path,
  };
  const breadcrumbs = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "KEIKA", item: SITE + "/" },
      { "@type": "ListItem", position: 2, name: content.title, item: SITE + content.path },
    ],
  };
  const faq = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: content.faq.map((entry) => ({
      "@type": "Question",
      name: entry.q,
      acceptedAnswer: { "@type": "Answer", text: entry.a },
    })),
  };
  return [product, breadcrumbs, faq];
}

export function OfertaPage({ slug }: { slug: string }) {
  const content = OFERTA_BY_SLUG[slug];
  if (!INFO_LANDINGS_ENABLED || !content) notFound();
  const jsonLd = buildJsonLd(slug);
  return (
    <>
      {jsonLd.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          // Tylko stałe treści z plików content/*.ts - nic od użytkownika.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
      <InfoLanding content={content} />
    </>
  );
}
