import type { MetadataRoute } from "next";
import { INFO_LANDINGS_ENABLED } from "@/lib/info-landings";
import { OFERTA_LANDINGS } from "@/features/oferta/registry";

const SITE = "https://sklep.keika.pl";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE + "/moskitiery-ramkowe", lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: SITE + "/plisy", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: SITE + "/rolety-dzien-noc", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: SITE + "/rolety-tradycyjne", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: SITE + "/?produkt=rolety-dachowe", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: SITE + "/?produkt=plisy-dachowe", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
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
  ];
}
