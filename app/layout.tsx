import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KEIKA | Rolety i Markizy na Wymiar",
  description:
    "Nowoczesny sklep KEIKA: rolety, markizy i moskitiery na wymiar z ekspresową wyceną.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
