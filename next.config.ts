import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
