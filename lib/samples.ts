"use client";

// Próbki tkanin plis (27.10.2026) - strona /probki i wejście z konfiguratora plis. Logika i ceny po stronie
// CRM (core/lib/shop_samples.php, endpoint /biuro/api/shop-public/samples). Do akceptacji właściciela
// klienci nic nie widzą: działa tylko link testowy ?probki=<klucz> zapamiętany w tej przeglądarce
// (?probki=wylacz kasuje), tak jak test asystenta w lib/assistant.ts.

import { useEffect, useState } from "react";
import { CRM_PUBLIC_BASE } from "@/app/components/payment-methods";

const TEST_STORAGE_KEY = "keika_samples_test_key";
const CACHE_KEY = "keika_samples_catalog_v1";

export type SampleSwatch = {
  id: string;
  code: string;
  label: string;
  color: string;
  thumbnail_url: string;
  image_url: string;
  available: boolean;
};
export type SampleGroup = { id: string; label: string; swatches: SampleSwatch[] };
export type SamplesCatalog = {
  enabled: boolean;
  test?: boolean;
  max?: number;
  prices?: { paczkomat: number; kurier: number };
  ship_days?: number;
  groups?: SampleGroup[];
};

/** Klucz testowy z adresu (zapamiętywany) albo z pamięci przeglądarki. */
export function samplesTestKey(): string {
  if (typeof window === "undefined") return "";
  try {
    const param = new URLSearchParams(window.location.search).get("probki");
    if (param === "wylacz") window.localStorage.removeItem(TEST_STORAGE_KEY);
    else if (param) window.localStorage.setItem(TEST_STORAGE_KEY, param);
    return window.localStorage.getItem(TEST_STORAGE_KEY) || "";
  } catch {
    return "";
  }
}

export async function fetchSamplesCatalog(): Promise<SamplesCatalog> {
  const key = samplesTestKey();
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(CACHE_KEY) || "null") as { at: number; key: string; data: SamplesCatalog } | null;
    if (cached && cached.key === key && Date.now() - cached.at < 2 * 60 * 1000) return cached.data;
  } catch {
    // brak pamięci sesji - pytamy CRM
  }
  const res = await fetch(`${CRM_PUBLIC_BASE}/samples${key ? `?test=${encodeURIComponent(key)}` : ""}`, { cache: "no-store" });
  const data = (await res.json()) as SamplesCatalog & { ok?: boolean };
  const clean: SamplesCatalog = data && data.ok !== false ? data : { enabled: false };
  try {
    window.sessionStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), key, data: clean }));
  } catch {
    // bez pamięci - kolejne wejście zapyta ponownie
  }
  return clean;
}

/** Czy pokazywać wejście „Zamów próbki” (włączone dla klientów albo test w tej przeglądarce). */
export function useSamplesEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    fetchSamplesCatalog()
      .then((c) => {
        if (alive) setEnabled(Boolean(c.enabled));
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}

export type SamplesOrderInput = {
  samples: Array<{ group_id: string; swatch_id: string }>;
  delivery: "paczkomat" | "kurier";
  paczkomat?: { id: string; address: string };
  customer: { name: string; phone: string; email: string };
  shipping: { city: string; postcode: string; address_line_1: string };
  consents: Record<string, unknown>;
  session_token: string;
};

export async function submitSamplesOrder(input: SamplesOrderInput): Promise<{ order_code: string; access_token: string }> {
  const res = await fetch(`${CRM_PUBLIC_BASE}/samples`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "order", test_key: samplesTestKey(), ...input }),
  });
  const json = (await res.json().catch(() => ({ ok: false, error: "Brak odpowiedzi serwera." }))) as {
    ok?: boolean;
    error?: string;
    order_code?: string;
    access_token?: string;
  };
  if (!json.ok || !json.order_code) throw new Error(json.error || "Nie udało się złożyć zamówienia próbek.");
  return { order_code: json.order_code, access_token: json.access_token || "" };
}
