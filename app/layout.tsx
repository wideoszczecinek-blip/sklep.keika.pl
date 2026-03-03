import type { Metadata } from "next";
import "./globals.css";

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
  try {
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
      <body>{children}</body>
    </html>
  );
}
