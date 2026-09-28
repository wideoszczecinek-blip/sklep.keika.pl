"use client";

// One-line cookie consent bar (audit 2026-09-13). The Meta Pixel and the
// _fbp/_fbc cookies only start after "Akceptuję" (see lib/tracking.ts);
// server-side CAPI events keep flowing either way, just without those
// browser identifiers. Shown until a choice is made, on every page.
//
// Od 2026-09-28 pada tu także pytanie o oferty e-mailem/SMS-em - właściciel:
// "pytanie o zgody marketingowe przenosimy do pytania o ciasteczka -
// strasznie spadła konwersja". W checkoucie został sam regulamin, a decyzja
// stąd (lib/marketing-consent.ts) dopina się do zamówienia. Zaznaczenie jest
// dobrowolne i domyślnie WYŁĄCZONE: "Tylko niezbędne" i "Akceptuję" z pustym
// polem zapisują brak zgody na marketing.
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { consentDecided, setConsent } from "@/lib/tracking";
import { saveMarketingConsent } from "@/lib/marketing-consent";
import { trackShopStep } from "@/lib/track-step";

export default function ConsentBar() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [marketing, setMarketing] = useState(false);

  useEffect(() => {
    setVisible(!consentDecided());
  }, []);

  if (!visible) return null;

  function decide(analytics: boolean) {
    const marketingAccepted = analytics && marketing;
    setConsent(analytics);
    saveMarketingConsent(marketingAccepted);
    trackShopStep("cookie_consent", analytics ? "accepted" : "essential", { marketing: marketingAccepted });
    setVisible(false);
  }

  return (
    <div className={`consent-bar ${pathname === "/koszyk" ? "is-above-cart-bar" : ""}`} role="region" aria-label="Zgoda na pliki cookies">
      <div className="consent-bar-copy">
        <p className="consent-bar-text">
          Używamy plików cookies do statystyk i reklam (Meta), żeby lepiej dopasować oferty. Szczegóły w{" "}
          <Link href="/legal/prywatnosc">polityce prywatności</Link>.
        </p>
        <label className="consent-bar-marketing">
          <input type="checkbox" checked={marketing} onChange={(event) => setMarketing(event.target.checked)} />
          <span>Chcę dostawać oferty i promocje KEIKA e-mailem lub SMS-em (możesz zrezygnować w każdej chwili).</span>
        </label>
      </div>
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
