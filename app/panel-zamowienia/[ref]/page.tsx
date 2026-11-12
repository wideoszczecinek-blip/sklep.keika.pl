import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import LivePanel from "./live-panel";

// Panel zamówienia klienta - indywidualny link z maila / z CRM (przycisk „Skopiuj link do panelu klienta”).
export const metadata: Metadata = {
  title: "Twoje zamówienie - KEIKA",
  robots: { index: false, follow: false },
};

export default async function PanelZamowieniaPage({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return (
    <div className="cart-page">
      <div className="cart-page-gradient-bg" aria-hidden="true" />
      <header className="cart-page-header">
        <Link href="/" className="cart-page-brand">
          keika
        </Link>
        <h1>Twoje zamówienie</h1>
      </header>
      <main className="cart-page-main">
        <Suspense fallback={null}>
          <LivePanel refCode={decodeURIComponent(ref).toUpperCase()} />
        </Suspense>
      </main>
    </div>
  );
}
