// Strony wariantów z katalogu Google (30.10.2026): /rolety-dachowe/okno/…,
// /plisy-dachowe/okno/…, /plisy/wymiar/…, /moskitiery-ramkowe/wymiar/….
// To ta sama strona produktu (Home) - konfigurator sam odczytuje model albo
// wymiar z adresu (lib/merchant-variants.ts readUrlPrefill) - ale z własnym
// tytułem, adresem kanonicznym i ceną wariantu w danych strukturalnych,
// bo Google porównuje cenę z katalogu właśnie z nimi.
import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import Home from "@/app/home-client";
import { formatPricePl } from "@/lib/agent-catalog";
import { getMerchantCatalog, type MerchantVariant } from "@/lib/merchant-feed";
import { parseRoofWindowPathKey, parseSizeKey, sizeKey } from "@/lib/merchant-variants";
import { JsonLdScripts, breadcrumbJsonLd, organizationJsonLd, productJsonLd } from "@/lib/structured-data";

type VariantKind = "okno" | "wymiar";
type Params = { params: Promise<{ key: string }> };

/** Wariant z adresu. Brak wariantów danego produktu = CRM nie odpowiedział:
 * błąd zamiast 404, żeby ISR zostawił poprzednią dobrą wersję strony. */
async function resolveVariant(productSlug: string, kind: VariantKind, rawKey: string): Promise<{ variant: MerchantVariant | null; canonicalPath: string }> {
  const { variants } = await getMerchantCatalog();
  const own = variants.filter((variant) => variant.base.slug === productSlug);
  if (!own.length) throw new Error(`Brak wariantów ${productSlug} (CRM nie odpowiedział)`);
  const key = decodeURIComponent(rawKey || "").trim().toLowerCase();
  if (kind === "okno") {
    const parsed = parseRoofWindowPathKey(key);
    if (!parsed) return { variant: null, canonicalPath: "" };
    const prefix = productSlug === "rolety-dachowe" ? `RD-${parsed.libraryId}-${parsed.material === "termo" ? "TERMO" : "DEKO"}` : `PD-${parsed.libraryId}`;
    const variant = own.find((entry) => entry.id === prefix) || null;
    return { variant, canonicalPath: variant?.path || "" };
  }
  const size = parseSizeKey(key);
  if (!size) return { variant: null, canonicalPath: "" };
  const path = `/${productSlug}/wymiar/${sizeKey(size.widthMm / 10, size.heightMm / 10)}`;
  const variant = own.find((entry) => entry.path === path) || null;
  return { variant, canonicalPath: variant?.path || "" };
}

function variantJsonLd(variant: MerchantVariant) {
  const product = {
    ...variant.base,
    name: variant.shortTitle,
    description: variant.description,
    url: variant.url,
    priceFrom: variant.price,
    priceUnit: undefined,
    priceNote: variant.priceNote,
    sku: variant.id,
    mpn: "KEIKA-" + variant.id,
  };
  const productLd = productJsonLd(product) as { offers: { priceSpecification: { description: string } } } & Record<string, unknown>;
  // Cena wariantu jest dokładna (nie „od”) - dokładnie ta z szybkiej wyceny.
  productLd.offers.priceSpecification.description = "Cena: " + variant.priceNote;
  const breadcrumb = breadcrumbJsonLd(variant.base) as { itemListElement: unknown[] } & Record<string, unknown>;
  breadcrumb.itemListElement = [
    ...breadcrumb.itemListElement,
    { "@type": "ListItem", position: 3, name: variant.shortTitle, item: variant.url },
  ];
  return [productLd, breadcrumb, organizationJsonLd()];
}

export function variantPage(productSlug: string, kind: VariantKind) {
  async function generateMetadata({ params }: Params): Promise<Metadata> {
    const { key } = await params;
    const { variant } = await resolveVariant(productSlug, kind, key);
    if (!variant) return { title: "Sklep KEIKA", robots: { index: false } };
    const title = `${variant.shortTitle} | KEIKA`;
    const description = `${variant.description} Cena ${formatPricePl(variant.price)} zł.`.slice(0, 300);
    return {
      title,
      description,
      alternates: { canonical: variant.url },
      openGraph: {
        type: "website",
        locale: "pl_PL",
        siteName: "KEIKA",
        url: variant.url,
        title,
        description,
        images: [{ url: variant.base.image, alt: variant.shortTitle }],
      },
      twitter: { card: "summary_large_image", title, description, images: [variant.base.image] },
    };
  }

  async function Page({ params }: Params) {
    const { key } = await params;
    const { variant, canonicalPath } = await resolveVariant(productSlug, kind, key);
    if (!variant) notFound();
    // /rolety-dachowe/okno/304 -> /rolety-dachowe/okno/304-velux-304 (jeden adres na wariant).
    if (canonicalPath && `/${productSlug}/${kind}/${decodeURIComponent(key).trim().toLowerCase()}` !== canonicalPath) permanentRedirect(canonicalPath);
    return (
      <>
        <JsonLdScripts data={variantJsonLd(variant)} />
        <Home initialProductSlug={productSlug} />
      </>
    );
  }

  return { generateMetadata, Page };
}

