"use client";

// Pasek zaufania przy podsumowaniu i płatności (od 2.11 dla wszystkich - test „premium” zakończony).
// Agencja 2.11: od wyłączenia SEZON20 z koszyka do kasy przechodzi 12 % zamiast 31 % - cenę trzeba uzasadnić
// jakością: 5 lat gwarancji · 30 dni na zwrot · dostawa 0 zł · produkcja na wymiar, raty i PayPo, krótko dlaczego warto.
import { useEffect, useState } from "react";
import { crmGetJson } from "@/lib/crm-get";
import InstallmentOffer from "@/app/components/installment-offer";
import { installmentsAvailable } from "@/lib/installments";
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
  const options = useRatyPaypo();
  const raty = options.raty && installmentsAvailable(amount);
  const paypo = options.paypo;
  const [choice, setChoice] = useState<"raty" | "paypo">("raty");
  if (!raty && !paypo) return null;
  const active = raty && paypo ? choice : raty ? "raty" : "paypo";
  return (
    <section className="checkout-finance" aria-label="Elastyczne płatności">
      <div className="checkout-finance-card" key={active}>
        <img className="checkout-finance-logo" src={active === "raty" ? "/checkout/przelewy24.svg" : "/paypo/paypo-logo.svg"} alt={active === "raty" ? "Przelewy24" : "PayPo"} width={106} height={30} />
        <div className="checkout-finance-copy">
          <strong>{active === "raty" ? "Urządź wnętrze. Zapłać w ratach." : "Zamów dziś. Zapłać do 30 dni."}</strong>
          {active === "raty" ? <InstallmentOffer amount={amount} variant="compact" /> : <p>Wybierz PayPo przy płatności. Decyzję otrzymasz online.</p>}
        </div>
      </div>
      {raty && paypo ? <div className="checkout-finance-switch" aria-label="Karty płatności">
        <button type="button" aria-pressed={active === "raty"} onClick={() => setChoice("raty")}>Raty</button>
        <button type="button" aria-pressed={active === "paypo"} onClick={() => setChoice("paypo")}>PayPo</button>
      </div> : null}
    </section>
  );
}

export function BundleBanner({ text }: { text: string }) {
  const discount = /-(\d+(?:[,.]\d+)?)\s*%/.exec(text)?.[1];
  return (
    <aside className="checkout-bundle-banner" aria-label="Promocja Cały Dom">
      <div className="checkout-bundle-art" aria-hidden="true">
        {discount ? <b>−{discount}%</b> : <svg viewBox="0 0 32 32" width="35" height="35" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 15 16 4l13 11M7 13v14h18V13M13 27v-8h6v8" /></svg>}
      </div>
      <div className="checkout-bundle-copy">
        <strong>CAŁY DOM</strong>
        <span>{text}</span>
      </div>
    </aside>
  );
}
