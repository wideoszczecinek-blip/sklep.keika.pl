"use client";

import { useEffect, useState } from "react";
import { crmGetJson } from "@/lib/crm-get";
import { paymentMethodsLabel, paymentOperatorsLabel } from "@/lib/company-legal";
import type { CheckoutSettings } from "@/lib/shop-public";

type Flags = Pick<CheckoutSettings, "p24_enabled" | "p24_transfer_enabled" | "p24_installments_enabled" | "p24_paypo_enabled">;

// Linia "Płatności: ..." w stopce. Metody Przelewy24 (przelew online / raty
// / PayPo) dokleja wg flag z CRM (site.checkout.p24_*) pobranych w
// przeglądarce - stopka jest w statycznym layoucie, a nie chcemy obiecywać
// rat/PayPo, których konto P24 jeszcze nie oferuje. Do czasu odpowiedzi
// pokazuje metody stałe (Stripe, przelew tradycyjny, pobranie).
export default function SiteFooterPayments({ initial = null }: { initial?: Flags | null }) {
  const [flags, setFlags] = useState<Flags | null>(initial);
  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    crmGetJson<any>("https://crm-keika.groovemedia.pl/biuro/api/shop-public/site")
      .then((json) => {
        const c = json?.checkout && typeof json.checkout === "object" ? json.checkout : null;
        if (!cancelled && c) {
          setFlags({
            p24_enabled: c.p24_enabled === true,
            p24_transfer_enabled: c.p24_transfer_enabled === true,
            p24_installments_enabled: c.p24_installments_enabled === true,
            p24_paypo_enabled: c.p24_paypo_enabled === true,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [initial]);
  return (
    <p>
      Płatności: {paymentMethodsLabel(flags)}. {flags?.p24_enabled ? "Operatorzy płatności" : "Operator płatności"}:{" "}
      {paymentOperatorsLabel(flags)}.
    </p>
  );
}
