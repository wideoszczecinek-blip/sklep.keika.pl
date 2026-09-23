"use client";

import { useEffect, useState } from "react";
import { CRM_PUBLIC_BASE } from "./payment-methods";

// PayPo na stronie produktu (właściciel, 2026-09-23: "już na stronie
// produktu ma być informacja kup teraz zapłać później - użyj oficjalnych
// banerów PayPo"). Baner pochodzi z oficjalnego pakietu Przelewy24/PayPo
// ("PayPo_P24_materialy_graficzne.zip", seria "Zapłać później"), leży w
// public/paypo/ i jest NIEKLIKALNY (właściciel, 2026-09-23: "te banery PayPo
// zrób nieklikalne - informacja, która metoda dostępna w koszyku wystarczy").
// Dlatego użyta jest grafika "placement" bez przycisku "Sprawdź" - baner z
// przyciskiem sugerowałby klikanie, a materiały PayPo z CTA wymagają
// podlinkowania do ich landing page.
//
// Pokazuje się TYLKO wtedy, gdy PayPo jest realnie dostępne: CRM zwraca
// checkout.p24_paypo_enabled = true dopiero, gdy konto Przelewy24 ma
// aktywną metodę PayPo (core/lib/p24.php -> p24_account_capabilities).
// Dzięki temu strona produktu nigdy nie obiecuje metody, której nie ma w
// koszyku.

// Nota wymagana przez PayPo dla materiałów z hasłem "Zapłać za 30 dni"
// (plik "WAŻNE !!!.txt" w oficjalnym pakiecie Przelewy24/PayPo).
const PAYPO_30_DAYS_NOTE = 'Usługa dla nowych klientów. Szczegóły w Regulaminie usługi „Zapłać za 30 dni” na paypo.pl.';

export default function PayPoBadge({
  variant = "strip",
  className = "",
}: {
  /** "strip" - pasek pod przyciskiem w konfiguratorze; "inline" - wariant do kart.
   * Wariant "top" (nad konfiguratorem) został usunięty 2026-09-23 - właściciel:
   * "w konfiguratorze u góry zabierz, tam źle wygląda"; komunikat o PayPo jest
   * teraz w rotującym pasku SEZON20 (promo-top-strip.tsx). */
  variant?: "strip" | "inline";
  className?: string;
}) {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`${CRM_PUBLIC_BASE}/site`)
      .then((response) => response.json())
      .then((json) => {
        const checkout = json?.checkout && typeof json.checkout === "object" ? json.checkout : null;
        if (!cancelled && checkout) {
          setEnabled(checkout.p24_enabled === true && checkout.p24_paypo_enabled === true);
        }
      })
      .catch(() => {
        /* brak odpowiedzi z CRM = nie obiecujemy PayPo */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!enabled) return null;

  return (
    <aside className={`paypo-badge paypo-badge--${variant} ${className}`.trim()} aria-label="Płatność odroczona PayPo">
      <span className="paypo-badge-banner">
        {/* Grafika bez przycisku CTA i bez linku - to ma być czysta
            informacja, że metoda jest dostępna w koszyku (właściciel,
            2026-09-23: "te banery PayPo zrób nieklikalne"). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/paypo/paypo-placement-765x145.svg"
          alt="PayPo – zapłać później"
          width={765}
          height={145}
          loading="lazy"
        />
      </span>
      <p className="paypo-badge-note">
        <strong>Kup teraz, zapłać nawet 30 dni później</strong> – bez dodatkowych kosztów. PayPo wybierzesz przy
        płatności w koszyku; zamówienie przyjmujemy do realizacji po pozytywnej weryfikacji przez PayPo.{" "}
        {PAYPO_30_DAYS_NOTE}
      </p>
    </aside>
  );
}
