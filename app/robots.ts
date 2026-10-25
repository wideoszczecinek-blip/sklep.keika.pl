import type { MetadataRoute } from "next";

// /robots.txt and /sitemap.xml both 404'd before the 2026-09-13 audit.
//
// 25.10.2026 (gotowość na agentów zakupowych AI): boty wyszukiwarek AI i
// agentów zakupowych są wpuszczone wprost, każdy z tymi samymi wyłączeniami
// co reszta (koszyk, wyceny, zamówienia, API). Nazwana grupa w robots.txt
// zastępuje dla danego bota grupę "*", dlatego lista wyłączeń jest powtórzona.
const PRIVATE_PATHS = [
  "/api/",
  "/koszyk",
  "/wizyta/",
  "/wycena/",
  "/zamowienie/",
  "/moje-zamowienia",
  "/konfigurator/",
  "/produkt/",
];

const AI_AND_SEARCH_BOTS = [
  "OAI-SearchBot",
  "ChatGPT-User",
  "GPTBot",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Googlebot",
  "Bingbot",
  "ClaudeBot",
  "Claude-SearchBot",
  "Claude-User",
  "Applebot",
  "Applebot-Extended",
  "Amazonbot",
  "DuckAssistBot",
  "meta-externalagent",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: AI_AND_SEARCH_BOTS, allow: "/", disallow: PRIVATE_PATHS },
      { userAgent: "*", allow: "/", disallow: PRIVATE_PATHS },
    ],
    sitemap: "https://sklep.keika.pl/sitemap.xml",
  };
}
