"use client";

import { useEffect, useState } from "react";
import { CRM_PUBLIC_BASE } from "./payment-methods";
import { trackStorefrontEvent } from "@/lib/shop-public";

// PayPo na stronie produktu (właściciel, 2026-09-23: "już na stronie
// produktu ma być informacja kup teraz zapłać później - użyj oficjalnych
// banerów PayPo"). Baner pochodzi z oficjalnego pakietu Przelewy24/PayPo
// ("PayPo_P24_materialy_graficzne.zip", seria "Zapłać później"), leży w
// public/paypo/ i jest podlinkowany do landing page PayPo - tego wymagają
// materiały PayPo dla banerów z przyciskiem.
//
// Pokazuje się TYLKO wtedy, gdy PayPo jest realnie dostępne: CRM zwraca
// checkout.p24_paypo_enabled = true dopiero, gdy konto Przelewy24 ma
// aktywną metodę PayPo (core/lib/p24.php -> p24_account_capabilities).
// Dzięki temu strona produktu nigdy nie obiecuje metody, której nie ma w
// koszyku.

const PAYPO_LANDING_URL = "https://start.paypo.pl/";

export default function PayPoBadge({
  variant = "strip",
  className = "",
}: {
  /** "strip" - pasek pod przyciskiem w konfiguratorze; "inline" - węższy wariant do kart produktów */
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
      <a
        className="paypo-badge-banner"
        href={PAYPO_LANDING_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          let sessionToken = "";
          try {
            sessionToken = window.sessionStorage.getItem("keika_shop_session_token") || "";
          } catch {
            // sessionStorage niedostępny - zdarzenie i tak poleci
          }
          void trackStorefrontEvent({
            event_name: "paypo_banner_click",
            page_slug: window.location.pathname + window.location.search,
            session_token: sessionToken,
            device_type: window.innerWidth < 768 ? "mobile" : "desktop",
          }).catch(() => null);
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/paypo/paypo-zaplac-pozniej-600x80.svg"
          alt="PayPo – zapłać później"
          width={600}
          height={80}
          loading="lazy"
        />
      </a>
      <p className="paypo-badge-note">
        <strong>Kup teraz, zapłać później.</strong> PayPo wybierzesz przy płatności w koszyku – zamówienie składasz po
        pozytywnej weryfikacji przez PayPo, a produkt robimy od razu. Usługa dla osób fizycznych; szczegóły i regulamin
        na{" "}
        <a href="https://paypo.pl/" target="_blank" rel="noopener noreferrer">
          paypo.pl
        </a>
        .
      </p>
    </aside>
  );
}
