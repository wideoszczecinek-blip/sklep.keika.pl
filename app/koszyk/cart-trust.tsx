"use client";

// Pasek zaufania przy podsumowaniu i płatności (od 2.11 dla wszystkich - test „premium” zakończony).
// Agencja 2.11: od wyłączenia SEZON20 z koszyka do kasy przechodzi 12 % zamiast 31 % - cenę trzeba uzasadnić
// jakością: 5 lat gwarancji · 30 dni na zwrot · dostawa 0 zł · produkcja na wymiar, raty i PayPo, krótko dlaczego warto.
import { useEffect, useState } from "react";
import { crmGetJson } from "@/lib/crm-get";
import { PremiumPerks } from "@/features/plisy/Premium";
import { CRM_PUBLIC_BASE } from "@/app/components/payment-methods";

function useRatyPaypo(): { raty: boolean; paypo: boolean } {
  const [v, setV] = useState({ raty: false, paypo: false });
  useEffect(() => {
    let alive = true;
    crmGetJson<Record<string, unknown>>(`${CRM_PUBLIC_BASE}/site`)
      .then((json) => {
        if (!alive) return;
        const c = (json?.checkout && typeof json.checkout === "object" ? json.checkout : {}) as Record<string, unknown>;
        const routing = (c.payment_routing && typeof c.payment_routing === "object" ? c.payment_routing : {}) as Record<string, { enabled?: boolean }>;
        const p24 = c.p24_enabled === true;
        setV({
          raty: p24 && c.p24_installments_enabled === true,
          paypo: routing.paypo ? routing.paypo.enabled === true : p24 && c.p24_paypo_enabled === true,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return v;
}

export default function CartTrust({ shippingFree }: { shippingFree: boolean }) {
  const { raty, paypo } = useRatyPaypo();
  const platnosc = [raty ? "raty" : "", paypo ? "PayPo – zapłać za 30 dni" : ""].filter(Boolean).join(" albo ");
  return (
    <div className="pm-cart-trust">
      <PremiumPerks shippingFree={shippingFree} />
      <p className="pm-cart-why">
        Produkujemy sami, w Polsce, od 2015 – każde zamówienie robimy na Twój wymiar, dlatego dajemy 5 lat gwarancji.
        {platnosc ? ` Możesz też wybrać ${platnosc}.` : ""}
      </p>
      <p className="pm-cart-why">
        <b>Sprawdź jeszcze raz wymiary w koszyku.</b> Pomyłkę poprawimy bez kosztów, dopóki zamówienie nie weszło do produkcji – napisz albo zadzwoń zaraz po zamówieniu.
      </p>
    </div>
  );
}
