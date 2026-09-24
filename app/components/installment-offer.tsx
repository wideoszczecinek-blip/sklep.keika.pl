"use client";

// "lub 10 × 15,68 zł" - oferta ratalna Przelewy24 pokazywana wszędzie tam,
// gdzie klient widzi kwotę do zapłaty (koszyk, podsumowanie wyceny w
// konfiguratorze). Właściciel, 2026-09-24: "jak mamy podsumowanie koszyka
// albo podsumowanie wyceny, wszędzie daj przeliczoną ofertę ratalną".
//
// Pokazuje się tylko wtedy, gdy raty są realnie włączone na koncie P24
// (CRM: checkout.p24_enabled + p24_installments_enabled) i kwota sięga progu
// bankowego - inaczej obiecywalibyśmy metodę, której w koszyku nie ma.
import { useEffect, useState } from "react";
import { crmGetJson } from "@/lib/crm-get";
import { CRM_PUBLIC_BASE } from "./payment-methods";
import {
  DEFAULT_INSTALLMENTS_APR_PERCENT,
  DEFAULT_INSTALLMENT_COUNT,
  INSTALLMENT_COUNTS,
  installmentsAvailable,
  installmentsTotal,
  INSTALLMENTS_REPRESENTATIVE_EXAMPLE,
  monthlyInstallment,
} from "@/lib/installments";

/** "3 raty" / "10 rat" - polska odmiana w liscie wyboru. */
function ratyLabel(count: number): string {
  const last = count % 10;
  const lastTwo = count % 100;
  const word = last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? "raty" : "rat";
  return count + " " + word;
}

function zl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

export default function InstallmentOffer({
  amount,
  className = "",
  /** "inline" - jedna linijka bez wyboru liczby rat (np. pod ceną pozycji). */
  variant = "full",
}: {
  amount: number | null;
  className?: string;
  variant?: "full" | "inline";
}) {
  const [enabled, setEnabled] = useState(false);
  const [apr, setApr] = useState(DEFAULT_INSTALLMENTS_APR_PERCENT);
  const [count, setCount] = useState<number>(DEFAULT_INSTALLMENT_COUNT);

  useEffect(() => {
    let cancelled = false;
    crmGetJson<{ checkout?: Record<string, unknown> }>(`${CRM_PUBLIC_BASE}/site`)
      .then((json) => {
        const checkout = json?.checkout && typeof json.checkout === "object" ? json.checkout : null;
        if (cancelled || !checkout) return;
        setEnabled(checkout.p24_enabled === true && checkout.p24_installments_enabled === true);
        // Gdy właściciel wpisze w CRM realną stawkę ze swojej umowy ratalnej,
        // liczymy nią; do tego czasu ostrożny szacunek z lib/installments.ts.
        const crmApr = Number(checkout.p24_installments_apr_percent);
        if (Number.isFinite(crmApr) && crmApr > 0) setApr(crmApr);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const value = typeof amount === "number" ? amount : 0;
  if (!enabled || !installmentsAvailable(value)) return null;
  const monthly = monthlyInstallment(value, count, apr);
  if (monthly <= 0) return null;

  if (variant === "inline") {
    return (
      <span className={`installment-offer installment-offer--inline ${className}`.trim()}>
        lub {DEFAULT_INSTALLMENT_COUNT} × <strong>{zl(monthlyInstallment(value, DEFAULT_INSTALLMENT_COUNT, apr))}</strong>
      </span>
    );
  }

  return (
    <div className={`installment-offer ${className}`.trim()}>
      <div className="installment-offer-row">
        <span className="installment-offer-label">lub w ratach</span>
        <span className="installment-offer-value">
          <select
            aria-label="Liczba rat"
            value={count}
            onChange={(event) => setCount(Number(event.target.value) || DEFAULT_INSTALLMENT_COUNT)}
          >
            {INSTALLMENT_COUNTS.map((option) => (
              <option key={option} value={option}>
                {ratyLabel(option)}
              </option>
            ))}
          </select>
          <span aria-hidden="true">×</span>
          <strong>{zl(monthly)}</strong>
        </span>
      </div>
      <details className="installment-offer-note">
        <summary>
          Rata szacunkowa (Raty Przelewy24): {count} × {zl(monthly)} = {zl(installmentsTotal(value, count, apr))}. Ostateczną
          ofertę i RRSO podaje bank we wniosku.
        </summary>
        <p>{INSTALLMENTS_REPRESENTATIVE_EXAMPLE}</p>
        <p>
          Kredytu udziela organizacja finansująca wybrana w Przelewy24 (m.in. Santander Consumer Bank, Alior Bank,
          Smartney, Inbank). Kwoty od 100 zł do 50 000 zł, od 3 do 60 rat.
        </p>
      </details>
    </div>
  );
}
