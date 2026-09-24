"use client";

// Karta "Rozłóż na raty" - pokazywana wszędzie tam, gdzie klient widzi kwotę
// do zapłaty (koszyk, podsumowanie wyceny w konfiguratorze). Właściciel,
// 2026-09-24: "jak mamy podsumowanie koszyka albo podsumowanie wyceny,
// wszędzie daj przeliczoną ofertę ratalną" i - po pierwszej wersji - "zrób
// ten banerek ładniej i bardziej zachęcająco".
//
// Dlatego: rata miesięczna jako bohater karty, liczba rat jako pigułki
// (nie lista rozwijana - na telefonie to jeden dotyk zamiast trzech), a cała
// obowiązkowa drobnica prawna schowana pod "Szczegóły".
//
// Pokazuje się tylko wtedy, gdy raty są realnie włączone na koncie P24
// (CRM: checkout.p24_enabled + p24_installments_enabled) i kwota mieści się
// w widełkach banku - inaczej obiecywalibyśmy metodę, której w koszyku nie ma.
import { useState } from "react";
import { useInstallmentCount, useInstallmentSettings } from "@/lib/installment-settings";
import {
  DEFAULT_INSTALLMENT_COUNT,
  INSTALLMENT_COUNTS,
  installmentsAvailable,
  installmentsTotal,
  INSTALLMENTS_REPRESENTATIVE_EXAMPLE,
  monthlyInstallment,
  pickFriendlyInstallmentCount,
} from "@/lib/installments";

/** "3 raty" / "10 rat" - polska odmiana. */
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
  /** "inline" - sama linijka tekstu; "compact" - zajawka w konfiguratorze,
   * która rozwija się dopiero po kliknięciu. */
  variant = "full",
}: {
  amount: number | null;
  className?: string;
  variant?: "full" | "inline" | "compact";
}) {
  const { enabled, apr } = useInstallmentSettings();
  const [count, setCount] = useInstallmentCount();

  const value = typeof amount === "number" ? amount : 0;
  const [open, setOpen] = useState(false);
  if (!enabled || !installmentsAvailable(value)) return null;
  // W zajawce pokazujemy ratę z "ładnego" okresu (20-50 zł), a nie z
  // domyślnych 10 rat - dopiero po rozwinięciu klient wybiera sam.
  const teaserCount = pickFriendlyInstallmentCount(value, apr);
  const activeCount = variant === "compact" && !open ? teaserCount : count;
  const monthly = monthlyInstallment(value, activeCount, apr);
  if (monthly <= 0) return null;

  if (variant === "compact") {
    return (
      <div className={`installment-teaser ${open ? "is-open" : ""} ${className}`.trim()}>
        <button
          type="button"
          className="installment-teaser-head"
          aria-expanded={open ? "true" : "false"}
          onClick={() => {
            if (!open) setCount(teaserCount);
            setOpen((prev: boolean) => !prev);
          }}
        >
          <span className="installment-teaser-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="5" width="18" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
              <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              <circle cx="8.5" cy="14.8" r="1.2" fill="currentColor" />
              <circle cx="12" cy="14.8" r="1.2" fill="currentColor" />
              <circle cx="15.5" cy="14.8" r="1.2" fill="currentColor" />
            </svg>
          </span>
          <span className="installment-teaser-text">
            Ten produkt możesz kupić na raty — już od <strong>{zl(monthly)}</strong> miesięcznie
          </span>
          <span className="installment-teaser-chevron" aria-hidden="true">
            {open ? "▴" : "▾"}
          </span>
        </button>
        {open ? (
          <div className="installment-teaser-body">
            <div className="installment-offer-counts" role="group" aria-label="Liczba rat">
              {INSTALLMENT_COUNTS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={`installment-offer-count ${option === count ? "is-active" : ""}`}
                  aria-pressed={option === count}
                  onClick={() => setCount(option)}
                >
                  {option}×
                </button>
              ))}
            </div>
            <p className="installment-teaser-sum">
              {ratyLabel(count)} × <strong>{zl(monthlyInstallment(value, count, apr))}</strong> ={" "}
              {zl(installmentsTotal(value, count, apr))}
            </p>
            <p className="installment-teaser-note">
              Liczbę rat wybierzesz w koszyku, przy płatności. Ostateczną ofertę i RRSO podaje bank we wniosku.
            </p>
            <details className="installment-offer-note">
              <summary>Przykład reprezentatywny</summary>
              <p>{INSTALLMENTS_REPRESENTATIVE_EXAMPLE}</p>
            </details>
          </div>
        ) : null}
      </div>
    );
  }

  if (variant === "inline") {
    return (
      <span className={`installment-offer-inline ${className}`.trim()}>
        lub {DEFAULT_INSTALLMENT_COUNT} ×{" "}
        <strong>{zl(monthlyInstallment(value, DEFAULT_INSTALLMENT_COUNT, apr))}</strong>
      </span>
    );
  }

  return (
    <div className={`installment-offer ${className}`.trim()}>
      <div className="installment-offer-head">
        <span className="installment-offer-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3" y="5" width="18" height="15" rx="3" stroke="currentColor" strokeWidth="1.8" />
            <path d="M3 10h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <path d="M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
            <circle cx="8.5" cy="14.8" r="1.25" fill="currentColor" />
            <circle cx="12" cy="14.8" r="1.25" fill="currentColor" />
            <circle cx="15.5" cy="14.8" r="1.25" fill="currentColor" />
          </svg>
        </span>
        <span className="installment-offer-title">
          <strong>Rozłóż na raty</strong>
          <small>Przelewy24 · decyzja online</small>
        </span>
        <span className="installment-offer-amount">
          <strong>{zl(monthly)}</strong>
          <em>/ mies.</em>
        </span>
      </div>

      <div className="installment-offer-counts" role="group" aria-label="Liczba rat">
        {INSTALLMENT_COUNTS.map((option) => (
          <button
            key={option}
            type="button"
            className={`installment-offer-count ${option === count ? "is-active" : ""}`}
            aria-pressed={option === count}
            onClick={() => setCount(option)}
          >
            {option}×
          </button>
        ))}
      </div>

      <details className="installment-offer-note">
        <summary>
          {ratyLabel(count)} × {zl(monthly)} = {zl(installmentsTotal(value, count, apr))}. Ostateczną ofertę i RRSO
          podaje bank we wniosku.
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
