import type { Metadata } from "next";

// /produkt/* is an internal-preview template (only reachable by direct URL
// - every navigation entry point goes through the homepage product view).
// Keep it out of the index; the live product's canonical page is
// /moskitiery-ramkowe.
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const canonical = slug === "moskitiery-ramkowe" ? "https://sklep.keika.pl/moskitiery-ramkowe" : undefined;
  return {
    robots: { index: false, follow: true },
    ...(canonical ? { alternates: { canonical } } : {}),
  };
}

export default function ProduktLayout({ children }: { children: React.ReactNode }) {
  return children;
}
