import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Home from "../../home-client";
import { findZaluzjeModel } from "@/features/rolety/shared";
import { fetchZaluzjeProfileServer } from "@/features/rolety/zaluzje-server";
import {
  isZaluzjeRodzajSlug,
  ZALUZJE_RODZAJ_SLUGS,
  ZALUZJE_RODZAJE,
  zaluzjeRodzajGallery,
  zaluzjeRodzajOfGroup,
  zaluzjeRodzajSummaries,
} from "@/features/rolety/zaluzje-rodzaje";

// Strona jednego rodzaju żaluzji (właściciel, 7.11.2026): /zaluzje/aluminiowe,
// /zaluzje/drewniane, /zaluzje/bambusowe, /zaluzje/pcv - każdy rodzaj lameli
// to osobny produkt z własnym opisem, galerią i FAQ; grubość lameli i wersja
// to warianty w konfiguratorze. Dawne strony modeli (/zaluzje/<model>, do
// 7.11) przekierowują 308 na rodzaj z wybranym modelem (?model=ss-NN).
// Do akceptacji właściciela widoczne tylko w podglądzie (proxy.ts).
const SITE = "https://sklep.keika.pl";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { params: Promise<{ model: string }> };

export async function generateStaticParams(): Promise<Array<{ model: string }>> {
  return ZALUZJE_RODZAJ_SLUGS.map((slug) => ({ model: slug }));
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { model: slug } = await params;
  if (!isZaluzjeRodzajSlug(slug)) return { title: "Żaluzje na wymiar | KEIKA" };
  const copy = ZALUZJE_RODZAJE[slug];
  const url = `${SITE}/zaluzje/${slug}`;
  const image = zaluzjeRodzajGallery(slug)[0];
  return {
    title: copy.seoTitle,
    description: copy.seoDescription,
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "pl_PL", siteName: "KEIKA", url, title: copy.seoTitle, description: copy.seoDescription, images: [{ url: image, alt: copy.name }] },
    twitter: { card: "summary_large_image", title: copy.seoTitle, description: copy.seoDescription, images: [image] },
  };
}

export default async function ZaluzjeRodzajPage({ params }: Params) {
  const { model: slug } = await params;
  if (!isZaluzjeRodzajSlug(slug)) {
    // Dawny adres modelu -> rodzaj z tym modelem.
    const profile = await fetchZaluzjeProfileServer();
    const model = profile ? findZaluzjeModel(profile, slug) : null;
    const rodzaj = model ? zaluzjeRodzajOfGroup(model.group) : null;
    if (model && rodzaj) permanentRedirect(`/zaluzje/${rodzaj}?model=${model.id}`);
    if (profile) notFound();
    permanentRedirect("/zaluzje");
  }

  const copy = ZALUZJE_RODZAJE[slug];
  const profile = await fetchZaluzjeProfileServer();
  const summary = zaluzjeRodzajSummaries(profile).find((entry) => entry.slug === slug) || null;
  const url = `${SITE}/zaluzje/${slug}`;
  const jsonLd = [
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: copy.h1,
      description: copy.seoDescription,
      image: zaluzjeRodzajGallery(slug).slice(0, 4),
      brand: { "@type": "Brand", name: "KEIKA" },
      sku: `zaluzje-${slug}`,
      category: "Żaluzje poziome",
      url,
      ...(summary?.lowPrice
        ? {
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "PLN",
              lowPrice: summary.lowPrice.toFixed(2),
              offerCount: summary.modelCount,
              availability: "https://schema.org/InStock",
              itemCondition: "https://schema.org/NewCondition",
              url,
              seller: { "@type": "Organization", name: "KEIKA" },
            },
          }
        : {}),
    },
    {
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: "KEIKA", item: `${SITE}/` },
        { "@type": "ListItem", position: 2, name: "Żaluzje", item: `${SITE}/zaluzje` },
        { "@type": "ListItem", position: 3, name: copy.name, item: url },
      ],
    },
    {
      "@context": "https://schema.org",
      "@type": "FAQPage",
      mainEntity: copy.faq.map((entry) => ({ "@type": "Question", name: entry.question, acceptedAnswer: { "@type": "Answer", text: entry.answer } })),
    },
  ];

  return (
    <>
      {jsonLd.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          // Tylko JSON z naszych stałych i danych CRM - nic od użytkownika.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
      <Home initialProductSlug="zaluzje" zaluzjeRodzaj={slug} />
    </>
  );
}
