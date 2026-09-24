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
      { source: "/produkt/rolety-dachowe", destination: "/?produkt=rolety-dachowe", permanent: false },
      { source: "/produkt/rolety-dachowe-dekolux", destination: "/?produkt=rolety-dachowe", permanent: false },
      { source: "/kategoria/rolety-dachowe", destination: "/?produkt=rolety-dachowe", permanent: false },
      { source: "/produkt/plisy-dachowe", destination: "/?produkt=plisy-dachowe", permanent: false },
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
