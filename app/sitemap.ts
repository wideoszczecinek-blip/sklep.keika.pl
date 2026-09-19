import type { MetadataRoute } from "next";

const SITE = "https://sklep.keika.pl";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: SITE + "/moskitiery-ramkowe", lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: SITE + "/?produkt=plisy", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: SITE + "/?produkt=rolety-dachowe", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: SITE + "/?produkt=plisy-dachowe", lastModified: now, changeFrequency: "weekly", priority: 0.9 },
    { url: SITE + "/", lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: SITE + "/kontakt", lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: SITE + "/o-nas", lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: SITE + "/regulamin", lastModified: now, changeFrequency: "yearly", priority: 0.2 },
  ];
}
