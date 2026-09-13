import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Koszyk | KEIKA",
  robots: { index: false, follow: false },
};

export default function KoszykLayout({ children }: { children: React.ReactNode }) {
  return children;
}
