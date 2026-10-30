import { variantPage } from "@/lib/variant-page";

// Wariant z katalogu Google Merchant Center (30.10.2026) - wymiar w cm, np. 60x120.
// Strona produktu z ustawionym wymiarem i ceną wariantu - patrz lib/variant-page.tsx.
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams(): Array<{ key: string }> {
  return [];
}

const page = variantPage("plisy", "wymiar");
export const generateMetadata = page.generateMetadata;
export default page.Page;
