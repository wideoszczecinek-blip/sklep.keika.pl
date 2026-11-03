"use client";

// Pasek zaufania przy podsumowaniu i płatności (od 2.11 dla wszystkich - test „premium” zakończony).
// Agencja 2.11: od wyłączenia SEZON20 z koszyka do kasy przechodzi 12 % zamiast 31 % - cenę trzeba uzasadnić
// jakością: 5 lat gwarancji · 30 dni na zwrot · dostawa 0 zł · produkcja na wymiar, raty i PayPo, krótko dlaczego warto.
import { useEffect, useState } from "react";
import { crmGetJson } from "@/lib/crm-get";
import InstallmentOffer from "@/app/components/installment-offer";
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
  return <div className="pm-cart-trust"><PremiumPerks shippingFree={shippingFree} /></div>;
}

export function CartFinance({ amount }: { amount: number }) {
  const { raty, paypo } = useRatyPaypo();
  const [choice, setChoice] = useState<"raty" | "paypo">("raty");
  if (!raty && !paypo) return null;
  const active = raty && paypo ? choice : raty ? "raty" : "paypo";
  return (
    <section className="checkout-finance" aria-label="Elastyczne płatności">
      <div className="checkout-finance-card" key={active}>
        <span className="checkout-finance-mark" aria-hidden="true">{active === "raty" ? "%" : "30"}</span>
        <div>
          <strong>{active === "raty" ? "Rozłóż płatność na raty" : "PayPo · zapłać do 30 dni"}</strong>
          {active === "raty" ? <InstallmentOffer amount={amount} /> : <p>Wybierz PayPo przy płatności. Decyzję otrzymasz online.</p>}
        </div>
      </div>
      {raty && paypo ? <div className="checkout-finance-switch" aria-label="Karty płatności">
        <button type="button" aria-pressed={active === "raty"} onClick={() => setChoice("raty")}>Raty</button>
        <button type="button" aria-pressed={active === "paypo"} onClick={() => setChoice("paypo")}>PayPo</button>
      </div> : null}
    </section>
  );
}
