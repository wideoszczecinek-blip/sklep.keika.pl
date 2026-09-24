"use client";

// Wspólny stan oferty ratalnej: czy raty są włączone na koncie P24, jaką
// stopą liczymy ratę i na ile rat klient chce ją rozbić. Współdzielony,
// żeby wybór "20×" zrobiony na kafelku metody płatności był ten sam, który
// widać w karcie "Rozłóż na raty" w podsumowaniu (właściciel, 2026-09-24).
import { useEffect, useState, useSyncExternalStore } from "react";
import { crmGetJson } from "@/lib/crm-get";
import { DEFAULT_INSTALLMENTS_APR_PERCENT, DEFAULT_INSTALLMENT_COUNT } from "@/lib/installments";

const CRM_SITE_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/site";
const COUNT_KEY = "keika_installment_count_v1";
const COUNT_EVENT = "keika-installment-count";

let countCache: number | null = null;

function readCount(): number {
  if (countCache !== null) return countCache;
  try {
    const raw = window.sessionStorage.getItem(COUNT_KEY);
    const parsed = Number(raw);
    countCache = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_INSTALLMENT_COUNT;
  } catch {
    countCache = DEFAULT_INSTALLMENT_COUNT;
  }
  return countCache;
}

function subscribe(onChange: () => void): () => void {
  const handler = () => {
    countCache = null;
    onChange();
  };
  window.addEventListener(COUNT_EVENT, handler);
  return () => window.removeEventListener(COUNT_EVENT, handler);
}

export function setInstallmentCount(count: number): void {
  countCache = count;
  try {
    window.sessionStorage.setItem(COUNT_KEY, String(count));
  } catch {
    /* tryb prywatny - wybór po prostu nie przeżyje odświeżenia */
  }
  window.dispatchEvent(new Event(COUNT_EVENT));
}

/** Liczba rat wspólna dla kafelka płatności i karty w podsumowaniu. */
export function useInstallmentCount(): [number, (count: number) => void] {
  const count = useSyncExternalStore(subscribe, readCount, () => DEFAULT_INSTALLMENT_COUNT);
  return [count, setInstallmentCount];
}

/** Ustawienia rat z CRM: czy w ogóle pokazywać i jaką stopą liczyć. */
export function useInstallmentSettings(): { enabled: boolean; apr: number; paypoEnabled: boolean } {
  const [enabled, setEnabled] = useState(false);
  const [paypoEnabled, setPaypoEnabled] = useState(false);
  const [apr, setApr] = useState(DEFAULT_INSTALLMENTS_APR_PERCENT);

  useEffect(() => {
    let cancelled = false;
    crmGetJson<{ checkout?: Record<string, unknown> }>(CRM_SITE_URL)
      .then((json) => {
        const checkout = json?.checkout && typeof json.checkout === "object" ? json.checkout : null;
        if (cancelled || !checkout) return;
        setEnabled(checkout.p24_enabled === true && checkout.p24_installments_enabled === true);
        setPaypoEnabled(checkout.p24_enabled === true && checkout.p24_paypo_enabled === true);
        const crmApr = Number(checkout.p24_installments_apr_percent);
        if (Number.isFinite(crmApr) && crmApr > 0) setApr(crmApr);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  return { enabled, apr, paypoEnabled };
}
