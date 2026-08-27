import type { Metadata } from "next";
import "./globals.css";
import LastPageTracker from "./components/last-page-tracker";

export const metadata: Metadata = {
  title: "KEIKA | Rolety i Markizy na Wymiar",
  description:
    "Nowoczesny sklep KEIKA: rolety, markizy i moskitiery na wymiar z ekspresową wyceną.",
};

const THEME_INIT_SCRIPT = `
(() => {
  const KEY = "keika-theme";
  const DARK = "dark";
  const LIGHT = "light";
  const MOBILE_QUERY = "(max-width: 760px)";
  function apply() {
    try {
      const isMobile =
        typeof window.matchMedia === "function" && window.matchMedia(MOBILE_QUERY).matches;
      if (isMobile) {
        // The mobile visual system (glass cards over photos, hero overlays,
        // spec chips, ...) is built dark-first and hasn't had a full
        // light-theme pass - forcing dark here avoids the low-contrast
        // "light text on a light photo" look on phones regardless of the
        // device's own light/dark setting. Desktop keeps respecting the
        // saved choice / system preference below.
        document.documentElement.setAttribute("data-theme", DARK);
        return;
      }
      const saved = window.localStorage.getItem(KEY);
      const hasSaved = saved === DARK || saved === LIGHT;
      const prefersDark =
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches;
      const nextTheme = hasSaved ? saved : (prefersDark ? DARK : LIGHT);
      document.documentElement.setAttribute("data-theme", nextTheme);
    } catch {
      document.documentElement.setAttribute("data-theme", DARK);
    }
  }
  apply();
  if (typeof window.matchMedia === "function") {
    try {
      window.matchMedia(MOBILE_QUERY).addEventListener("change", apply);
    } catch {
      // older Safari - no live re-check on resize/rotate, initial apply() still ran
    }
  }
})();
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
        {children}
      </body>
    </html>
  );
}
