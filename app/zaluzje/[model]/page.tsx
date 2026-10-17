import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Home from "../../home-client";
import { findZaluzjeModel, zaluzjeModelDescription, zaluzjeModels } from "@/features/rolety/shared";
import { fetchZaluzjeProfileServer } from "@/features/rolety/zaluzje-server";

// Strona jednego modelu żaluzji (właściciel, 17.10.2026: "każda opcja to
// produkt - klient wybiera wariant w katalogu, a dopiero potem przechodzi do
// strony z konfiguratorem"). Po lewej opis modelu, po prawej konfigurator z
// tym modelem na sztywno. Katalog wszystkich modeli: /zaluzje. Do akceptacji
// właściciela widoczna tylko w podglądzie (proxy.ts, prefiks /zaluzje/).
const SITE = "https://sklep.keika.pl";

export const revalidate = 3600;
export const dynamicParams = true;

type Params = { params: Promise<{ model: string }> };

export async function generateStaticParams(): Promise<Array<{ model: string }>> {
  const profile = await fetchZaluzjeProfileServer();
  return profile ? zaluzjeModels(profile).map((model) => ({ model: model.slug })) : [];
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { model: modelSlug } = await params;
  const profile = await fetchZaluzjeProfileServer();
  const model = profile ? findZaluzjeModel(profile, modelSlug) : null;
  if (!model) return { title: "Żaluzje poziome na wymiar | KEIKA" };
  const url = `${SITE}/zaluzje/${model.slug}`;
  const title = `${model.name} na wymiar | KEIKA`;
  const description = `${model.name} na wymiar. ${zaluzjeModelDescription(model).join(" ")} Realizacja do 15 dni roboczych, 5 lat gwarancji, 30 dni na zwrot.`;
  const images = model.imageUrl ? [{ url: model.imageUrl, alt: model.name }] : [];
  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { type: "website", locale: "pl_PL", siteName: "KEIKA", url, title, description, images },
    twitter: { card: "summary_large_image", title, description, images: model.imageUrl ? [model.imageUrl] : [] },
  };
}

export default async function ZaluzjeModelPage({ params }: Params) {
  const { model: modelSlug } = await params;
  const profile = await fetchZaluzjeProfileServer();
  const model = profile ? findZaluzjeModel(profile, modelSlug) : null;
  // CRM odpowiedział, a takiego modelu nie ma - 404. Gdy CRM nie odpowiedział,
  // renderujemy stronę i model rozpozna już przeglądarka.
  if (profile && !model) notFound();
  // Adres z id grupy (ss-39) -> adres z nazwą modelu.
  if (model && model.slug !== modelSlug) permanentRedirect(`/zaluzje/${model.slug}`);

  const jsonLd = model
    ? [
        {
          "@context": "https://schema.org",
          "@type": "Product",
          name: model.name,
          description: zaluzjeModelDescription(model).join(" "),
          image: model.imageUrl ? [model.imageUrl] : [],
          brand: { "@type": "Brand", name: "KEIKA" },
          sku: `zaluzja-${model.slug}`,
          category: "Żaluzje poziome",
          url: `${SITE}/zaluzje/${model.slug}`,
          ...(model.startingPrice !== null
            ? {
                offers: {
                  "@type": "AggregateOffer",
                  priceCurrency: "PLN",
                  lowPrice: model.startingPrice.toFixed(2),
                  offerCount: 1,
                  availability: "https://schema.org/InStock",
                  itemCondition: "https://schema.org/NewCondition",
                  url: `${SITE}/zaluzje/${model.slug}`,
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
            { "@type": "ListItem", position: 3, name: model.name, item: `${SITE}/zaluzje/${model.slug}` },
          ],
        },
      ]
    : [];

  return (
    <>
      {jsonLd.map((entry, index) => (
        <script
          key={index}
          type="application/ld+json"
          // Tylko JSON z danych CRM i naszych stałych - nic od użytkownika.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(entry) }}
        />
      ))}
      <Home initialProductSlug="zaluzje" zaluzjeModel={{ slug: model?.slug || modelSlug, name: model?.name || "" }} />
    </>
  );
}
