import type { Metadata } from "next";
import "./globals.css";
import LastPageTracker from "./components/last-page-tracker";
import ConsentBanner from "./components/consent-banner";
import SiteAnalytics from "./components/site-analytics";
import ChatBubble from "./components/chat-bubble";

export const metadata: Metadata = {
  title: "KEIKA | Rolety i Markizy na Wymiar",
  description:
    "Nowoczesny sklep KEIKA: rolety, markizy i moskitiery na wymiar z ekspresową wyceną.",
  // Weryfikacja domeny w Meta Business (opcjonalnie - alternatywa dla rekordu
  // DNS TXT). Ustaw NEXT_PUBLIC_META_DOMAIN_VERIFICATION w Vercel na wartość
  // z "content" podaną przez Meta.
  ...(process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION
    ? { other: { "facebook-domain-verification": process.env.NEXT_PUBLIC_META_DOMAIN_VERIFICATION } }
    : {}),
};

// Light is the only theme now (definitive, not a per-visitor toggle) - this
// used to pick dark/light per-device (dark forced on mobile, saved choice or
// system preference on desktop), which is exactly what caused a visible
// dark-then-light flash: this blocking script would paint dark first, then
// a later page-level useEffect (post-hydration) flipped it to light. Setting
// the attribute here, unconditionally, is what actually avoids the flash -
// it runs before first paint, no JS-after-hydration round trip needed.
const THEME_INIT_SCRIPT = `
document.documentElement.setAttribute("data-theme", "light");
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        {/* The CRM (crm-keika.groovemedia.pl) is a separate origin that the
            homepage/product views hit on mount for the config, product
            landing content, shipping banner, Allegro rating and the image
            optimizer's source images. Warming the TLS connection here saves
            the DNS + handshake round-trips (~200-400 ms on mobile) off the
            first of those requests, which currently gates the boot overlay. */}
        <link rel="preconnect" href="https://crm-keika.groovemedia.pl" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://crm-keika.groovemedia.pl" />
        {/* Belt-and-suspenders against a phone's own "force dark for web
            content" browser feature (Android Chrome/Samsung Internet) -
            that repaints pages algorithmically based on the OS dark setting,
            independently of the page's own CSS/JS, unless the page declares
            itself light-only. This is static, present in the very first
            bytes of the response - no JS execution/timing involved at all,
            unlike the attribute the script below sets. */}
        <meta name="color-scheme" content="light" />
        <script
          id="theme-init"
          dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }}
        />
      </head>
      <body>
        <LastPageTracker />
        <SiteAnalytics />
        {children}
        <ConsentBanner />
        <ChatBubble />
      </body>
    </html>
  );
}
