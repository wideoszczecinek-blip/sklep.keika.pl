import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Plisy went live 2026-09-16: the menu links to /produkt/plisy and old
  // links to the placeholder category page both land on the real landing.
  async redirects() {
    return [
      { source: "/produkt/plisy", destination: "/plisy", permanent: false },
      { source: "/kategoria/plisy", destination: "/plisy", permanent: false },
      // Rolety dachowe + plisy dachowe went live 2026-09-19 (same pattern;
      // the CRM catalog placeholder for roof blinds is "rolety-dachowe-dekolux").
      // Od 25.10.2026 prosto na własne strony /rolety-dachowe i /plisy-dachowe.
      { source: "/produkt/rolety-dachowe", destination: "/rolety-dachowe", permanent: false },
      { source: "/produkt/rolety-dachowe-dekolux", destination: "/rolety-dachowe", permanent: false },
      { source: "/kategoria/rolety-dachowe", destination: "/rolety-dachowe", permanent: false },
      { source: "/produkt/plisy-dachowe", destination: "/plisy-dachowe", permanent: false },
      // Rolety mini (dzień-noc i tradycyjne) żyją od 2026-10-17 na własnych
      // statycznych stronach; menu CRM linkuje do /produkt/<slug>.
      { source: "/produkt/rolety-dzien-noc", destination: "/rolety-dzien-noc", permanent: false },
      { source: "/kategoria/rolety-dzien-noc", destination: "/rolety-dzien-noc", permanent: false },
      { source: "/produkt/rolety-tradycyjne", destination: "/rolety-tradycyjne", permanent: false },
      { source: "/kategoria/rolety-tradycyjne", destination: "/rolety-tradycyjne", permanent: false },
      { source: "/produkt/zaluzje", destination: "/zaluzje", permanent: false },
      // Rolety tradycyjne w 4 systemach (7.11.2026) - własne strony.
      { source: "/produkt/rolety-mini", destination: "/rolety-mini", permanent: false },
      { source: "/produkt/rolety-kaseta-plaska", destination: "/rolety-kaseta-plaska", permanent: false },
      { source: "/produkt/rolety-kaseta-przestrzenna", destination: "/rolety-kaseta-przestrzenna", permanent: false },
      { source: "/produkt/rolety-wolnowiszace", destination: "/rolety-wolnowiszace", permanent: false },
      { source: "/kategoria/zaluzje", destination: "/zaluzje", permanent: false },
      // 10.11.2026: produkty bez konfiguratora mają strony informacyjne z
      // formularzem wyceny (features/oferta) - stare adresy katalogowe tam prowadzą.
      ...[
        ["rolety-rzymskie", "/rolety-rzymskie"],
        ["verticale", "/zaluzje-pionowe"],
        ["zaluzje-pionowe", "/zaluzje-pionowe"],
        ["rolety-zewnetrzne", "/rolety-zewnetrzne"],
        ["zaluzje-fasadowe", "/zaluzje-fasadowe"],
        ["screeny", "/screeny"],
        ["screen-system", "/screeny"],
        ["markizy", "/markizy"],
        ["zadaszenia", "/zadaszenia"],
        ["shuttersy", "/shuttersy"],
        ["moskitiery-do-okien-dachowych", "/moskitiery-do-okien-dachowych"],
        ["moskitiery-drzwiowe", "/moskitiery-drzwiowe"],
        ["moskitiery-przesuwne", "/moskitiery-przesuwne"],
        ["moskitiery-plisowane", "/moskitiery-plisowane"],
      ].flatMap(([slug, destination]) => [
        { source: `/produkt/${slug}`, destination, permanent: false },
        { source: `/kategoria/${slug}`, destination, permanent: false },
      ]),
      // Formularz opinii żyje na stronie firmowej. Ten wpis został z czasu,
      // gdy keika.pl stało jeszcze na starym serwerze i odsyłało tu SMS-y po
      // montażu - zostawiamy go, żeby stare linki nie kończyły się pustą
      // stroną, ale prowadzi już prosto na keika.pl.
      { source: "/opinia", destination: "https://keika.pl/opinia", permanent: false },
    ];
  },
  // /?produkt=moskitiery-ramkowe -> /moskitiery-ramkowe lives in proxy.ts
  // (needs to drop just that one query param, which a static redirect
  // rule can't express).
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "crm-keika.groovemedia.pl",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
    // Next's image optimizer only accepts `w=` values found in one of these
    // two lists. lib/image-optim.ts calls it with fixed widths tuned to each
    // UI element (swatch thumb, gallery tile, full-bleed hero, ...), so those
    // exact widths have to be allow-listed here or the request 400s.
    // imageSizes: small, fixed-size UI elements (icons, swatches, thumbs).
    imageSizes: [16, 32, 48, 64, 80, 96, 128, 160, 220, 240, 256, 360, 384, 500, 700],
    // deviceSizes: larger, viewport-scale imagery (mockup previews, hero/background photos).
    deviceSizes: [640, 750, 828, 900, 1080, 1200, 1800, 1920, 2000, 2048, 3840],
    // Next 16 also allow-lists the `q=` value the same way (defaults to [75]
    // only) - lib/image-optim.ts is called with 70/75/80 across the app
    // (hero/catalog backgrounds, zoom modals), so those need listing too or
    // every one of those requests 400s and the <img> renders broken.
    qualities: [70, 75, 80],
  },
};

export default nextConfig;
