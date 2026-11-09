import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { buildOfertaMetadata, OfertaPage } from "@/features/oferta/page-factory";
import { OFERTA_REWRITE_SLUGS } from "@/features/oferta/registry";

// Strony informacyjne produktów, których publiczny adres zajmuje konfigurator
// za bramką podglądu (rolety tradycyjne, dzień-noc). proxy.ts przepisuje tu
// ruch klientów z /rolety-tradycyjne i /rolety-dzien-noc (10.11.2026);
// kanoniczny adres w metadanych to nadal /<slug>.
export const dynamicParams = false;

export function generateStaticParams() {
  return OFERTA_REWRITE_SLUGS.map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return buildOfertaMetadata(slug);
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!(OFERTA_REWRITE_SLUGS as readonly string[]).includes(slug)) notFound();
  return <OfertaPage slug={slug} />;
}
