import type { MetadataRoute } from "next";
import { INFO_LANDINGS_ENABLED } from "@/lib/info-landings";
import { OFERTA_LANDINGS } from "@/features/oferta/registry";
import { getMerchantCatalog } from "@/lib/merchant-feed";

const SITE = "https://sklep.keika.pl";

// Strony wariantów z katalogu Google Merchant (model okna / wymiar) mają
// własny adres kanoniczny i cenę - od 31.10.2026 są też w mapie, żeby
// znalazły je wszystkie wyszukiwarki (Bing przez IndexNow, scripts/indexnow.mjs).
export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  let variantUrls: MetadataRoute.Sitemap = [];
  try {
    const { variants } = await getMerchantCatalog();
    variantUrls = variants.map((variant) => ({ url: variant.url, lastModified: now, changeFrequency: "weekly" as const, priority: 0.5 }));
  } catch {
    // CRM nie odpowiada - mapa bez wariantów, reszta zostaje.
  }
  return [
    { url: SITE + "/moskitiery-ramkowe", lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: SITE + "/plisy", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: SITE + "/rolety-dachowe", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: SITE + "/plisy-dachowe", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: SITE + "/plisy/jak-mierzyc", lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: SITE + "/", lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: SITE + "/kontakt", lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: SITE + "/o-nas", lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: SITE + "/regulamin", lastModified: now, changeFrequency: "yearly", priority: 0.2 },
    ...(INFO_LANDINGS_ENABLED
      ? [
          { url: SITE + "/oferta", lastModified: now, changeFrequency: "monthly" as const, priority: 0.6 },
          ...OFERTA_LANDINGS.map((entry) => ({ url: SITE + entry.path, lastModified: now, changeFrequency: "monthly" as const, priority: 0.7 })),
        ]
      : []),
    ...variantUrls,
  ];
}
