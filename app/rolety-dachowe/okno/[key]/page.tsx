import { variantPage } from "@/lib/variant-page";

// Wariant z katalogu Google Merchant Center (30.10.2026) - model okna dachowego.
// Strona produktu z ustawionym modelem i ceną wariantu - patrz lib/variant-page.tsx.
export const revalidate = 3600;
export const dynamicParams = true;

export function generateStaticParams(): Array<{ key: string }> {
  return [];
}

const page = variantPage("rolety-dachowe", "okno");
export const generateMetadata = page.generateMetadata;
export default page.Page;
