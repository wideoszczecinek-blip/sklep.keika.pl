import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Home from "@/app/home-client";
import { INFO_LANDINGS_ENABLED, INFO_LANDINGS_PUBLIC } from "@/lib/info-landings";
import { quoteOnlyCrmSlug } from "@/lib/quote-only";
import { OFERTA_BY_SLUG } from "./registry";

const SITE = "https://sklep.keika.pl";

/** Metadane strony produktu na wycenę. */
export function buildOfertaMetadata(slug: string): Metadata {
  const content = OFERTA_BY_SLUG[slug];
  if (!INFO_LANDINGS_ENABLED || !content) return { robots: { index: false, follow: false } };
  const url = SITE + content.path;
  return {
    // 10.11.2026: strony tylko w podglądzie właściciela - bez indeksowania do czasu publikacji.
    robots: INFO_LANDINGS_PUBLIC ? undefined : { index: false, follow: false },
    title: content.seoTitle,
    description: content.seoDescription,
    alternates: { canonical: url },
  };
}

/** Strona produktu na wycenę - 10.11.2026 (właściciel: „plisy, rolety dachowe - to
 * układ landingów jaki stosujemy”): ten sam widok produktu co plisy i rolety
 * dachowe (home-client: zdjęcia, opis, galeria, FAQ z CRM), w miejscu
 * konfiguratora formularz wyceny (features/oferta/QuotePanel.tsx). */
export function OfertaPage({ slug }: { slug: string }) {
  if (!INFO_LANDINGS_ENABLED || !OFERTA_BY_SLUG[slug]) notFound();
  return <Home initialProductSlug={quoteOnlyCrmSlug(slug)} />;
}
