"use client";

// One-line cookie consent bar (audit 2026-09-13). The Meta Pixel and the
// _fbp/_fbc cookies only start after "Akceptuję" (see lib/tracking.ts);
// server-side CAPI events keep flowing either way, just without those
// browser identifiers. Shown until a choice is made, on every page.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { consentDecided, setConsent } from "@/lib/tracking";

export default function ConsentBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(!consentDecided());
  }, []);

  if (!visible) return null;

  function decide(analytics: boolean) {
    setConsent(analytics);
    setVisible(false);
  }

  return (
    <div className={`consent-bar ${pathname === "/koszyk" ? "is-above-cart-bar" : ""}`} role="region" aria-label="Zgoda na pliki cookies">
      <p className="consent-bar-text">
        Używamy plików cookies do statystyk i reklam (Meta), żeby lepiej dopasować oferty. Szczegóły w{" "}
        <Link href="/legal/prywatnosc">polityce prywatności</Link>.
      </p>
      <div className="consent-bar-actions">
        <button type="button" className="consent-bar-secondary" onClick={() => decide(false)}>
          Tylko niezbędne
        </button>
        <button type="button" className="consent-bar-primary" onClick={() => decide(true)}>
          Akceptuję
        </button>
      </div>
    </div>
  );
}
