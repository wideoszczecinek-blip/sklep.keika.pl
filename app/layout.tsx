import type { Metadata } from "next";
import "./globals.css";
import LastPageTracker from "./components/last-page-tracker";
import ConsentBanner from "./components/consent-banner";
import SiteAnalytics from "./components/site-analytics";

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
      </body>
    </html>
  );
}
