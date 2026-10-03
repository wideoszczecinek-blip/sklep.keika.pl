/**
 * Test nowego koszyka (od 2026-10-04): połowa osób widzi dotychczasowy koszyk
 * ("classic"), połowa nowy ("v2", app/koszyk/cart-v2.tsx). Logika zamówienia
 * i płatności jest wspólna - różni się wyłącznie to, co klient widzi.
 *
 * Grupa wynika z visitor_id (ten sam los przy każdej wizycie i na każdej
 * karcie), z własną solą - niezależnie od testu "dodatkowe 5%", który losuje
 * CRM, i od testu banera na dole koszyka.
 *
 * Wyłącznik bez wdrożenia: CRM (shop-public/site -> checkout.cart_v2_share,
 * 0-100). 0 = wszyscy widzą stary koszyk. Ostatnia znana wartość jest
 * pamiętana w przeglądarce, więc decyzja zapada bez czekania na sieć.
 * Podgląd: /koszyk?koszyk=nowy albo ?koszyk=stary (zostaje na urządzeniu).
 */
import { getVisitorId } from "@/lib/analytics-context";

export type CartDesignArm = "classic" | "v2";

const ARM_KEY = "keika_cart_design_arm";
const FORCED_KEY = "keika_cart_design_forced";
const SHARE_KEY = "keika_cart_v2_share";
const CRASH_KEY = "keika_cart_v2_crashed";
const DEFAULT_SHARE = 50;

function hashToPercent(text: string): number {
  // FNV-1a 32-bit - wystarczy do równego podziału, bez zależności.
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

/** Zapamiętuje udział nowego koszyka podany przez CRM (0-100). */
export function rememberCartV2Share(share: unknown): number {
  const value = typeof share === "number" && Number.isFinite(share) ? Math.min(100, Math.max(0, share)) : DEFAULT_SHARE;
  try {
    window.localStorage.setItem(SHARE_KEY, String(value));
  } catch {
    // brak localStorage - zostaje wartość domyślna
  }
  return value;
}

/** Los tej osoby (0-99) - stały dla visitor_id. */
export function cartDesignBucket(): number {
  return hashToPercent(`koszyk-v2|${getVisitorId() || "anon"}`);
}

export function getCartDesignArm(): { arm: CartDesignArm; forced: boolean } {
  if (typeof window === "undefined") return { arm: "classic", forced: false };
  try {
    const param = new URLSearchParams(window.location.search).get("koszyk");
    if (param === "nowy" || param === "stary") {
      const arm: CartDesignArm = param === "nowy" ? "v2" : "classic";
      window.localStorage.setItem(ARM_KEY, arm);
      window.localStorage.setItem(FORCED_KEY, "1");
      if (arm === "v2") window.sessionStorage.removeItem(CRASH_KEY);
      return { arm, forced: true };
    }
    if (param === "los") {
      window.localStorage.removeItem(ARM_KEY);
      window.localStorage.removeItem(FORCED_KEY);
    }
    const forced = window.localStorage.getItem(FORCED_KEY) === "1";
    const stored = window.localStorage.getItem(ARM_KEY);
    if (forced && (stored === "classic" || stored === "v2")) return { arm: stored, forced: true };
    // Nowy koszyk wywrócił się w tej karcie - do końca wizyty stary.
    if (window.sessionStorage.getItem(CRASH_KEY) === "1") return { arm: "classic", forced: false };
    const arm: CartDesignArm = cartDesignBucket() < readShare() ? "v2" : "classic";
    return { arm, forced: false };
  } catch {
    return { arm: "classic", forced: false };
  }
}

export function markCartV2Crashed(): void {
  try {
    window.sessionStorage.setItem(CRASH_KEY, "1");
  } catch {
    // nic
  }
}
