/**
 * Test banera terminu dostawy w koszyku (właściciel 10.11.2026: „sprawdzimy, czy on
 * przypadkiem nam nie zmniejsza konwersji, czyli połowa ruchu ma go nie widzieć”).
 *
 * Grupa „baner”: w koszyku widzi baner „wyprodukujemy w ciągu maksymalnie X dni,
 * będzie u Ciebie najpóźniej …” (CartDostawaBaner). Grupa „bez”: koszyk bez banera -
 * o czasie dostawy dowiaduje się jak dotąd z landingu. Obie grupy po zakupie widzą
 * przewidywany termin dostawy na stronie zamówienia (app/zamowienie/[orderCode]).
 *
 * Grupa wynika z visitor_id (ten sam los przy każdej wizycie), z własną solą -
 * niezależnie od innych testów koszyka. Zdarzenie cart_eta_ab (shop_www_analytics_events)
 * przy pierwszym wejściu do koszyka z produktami; wynik = zamówienia po visitor_id.
 * Wyłącznik bez wdrożenia: CRM (shop-public/site -> checkout.cart_eta_banner_share,
 * 0-100 = udział grupy „baner”; kv shop_cart_eta_ab {share}). 100 = wszyscy widzą baner,
 * 0 = nikt. Podgląd: /koszyk?termin=baner albo ?termin=bez (zostaje na urządzeniu),
 * ?termin=los zdejmuje.
 */
import { getVisitorId } from "@/lib/analytics-context";

export type CartEtaArm = "baner" | "bez";

const ARM_KEY = "keika_cart_eta_arm";
const FORCED_KEY = "keika_cart_eta_forced";
const SHARE_KEY = "keika_cart_eta_share";
const DEFAULT_SHARE = 50;

function hashToPercent(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
}

function readShare(): number {
  try {
    const raw = window.localStorage.getItem(SHARE_KEY);
    if (raw === null) return DEFAULT_SHARE;
    const value = Number(raw);
    return Number.isFinite(value) ? Math.min(100, Math.max(0, value)) : DEFAULT_SHARE;
  } catch {
    return DEFAULT_SHARE;
  }
}

/** Zapamiętuje udział grupy „baner” podany przez CRM (0-100). */
export function rememberCartEtaShare(share: unknown): number {
  const value = typeof share === "number" && Number.isFinite(share) ? Math.min(100, Math.max(0, share)) : DEFAULT_SHARE;
  try {
    window.localStorage.setItem(SHARE_KEY, String(value));
  } catch {
    // brak localStorage - zostaje wartość domyślna
  }
  return value;
}

/** Los tej osoby (0-99) - stały dla visitor_id. */
export function cartEtaBucket(): number {
  return hashToPercent(`koszyk-termin|${getVisitorId() || "anon"}`);
}

export function getCartEtaArm(): { arm: CartEtaArm; forced: boolean } {
  if (typeof window === "undefined") return { arm: "bez", forced: false };
  try {
    const param = new URLSearchParams(window.location.search).get("termin");
    if (param === "baner" || param === "bez") {
      window.localStorage.setItem(ARM_KEY, param);
      window.localStorage.setItem(FORCED_KEY, "1");
      return { arm: param, forced: true };
    }
    if (param === "los") {
      window.localStorage.removeItem(ARM_KEY);
      window.localStorage.removeItem(FORCED_KEY);
    }
    const stored = window.localStorage.getItem(ARM_KEY);
    if (window.localStorage.getItem(FORCED_KEY) === "1" && (stored === "baner" || stored === "bez")) {
      return { arm: stored, forced: true };
    }
    return { arm: cartEtaBucket() < readShare() ? "baner" : "bez", forced: false };
  } catch {
    return { arm: "bez", forced: false };
  }
}
