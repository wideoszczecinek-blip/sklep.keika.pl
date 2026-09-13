import type { MetadataRoute } from "next";

// /robots.txt and /sitemap.xml both 404'd before the 2026-09-13 audit.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/koszyk",
          "/wizyta/",
          "/wycena/",
          "/zamowienie/",
          "/moje-zamowienia",
          "/konfigurator/",
          "/produkt/",
        ],
      },
    ],
    sitemap: "https://sklep.keika.pl/sitemap.xml",
  };
}
