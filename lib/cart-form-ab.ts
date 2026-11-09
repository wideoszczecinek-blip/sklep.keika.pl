/**
 * Test „dane od razu” (właściciel 9.11.2026: „ok - ale test 50:50”).
 *
 * Audyt koszyka 3–9.11: 208 osób w koszyku, tylko 42 wybrały dostawę (20 %) -
 * do wyboru dostawy pola danych są ukryte, a 80 % odpada na pierwszym ekranie.
 * Grupa „od_razu”: kurier jest zaznaczony z góry (klient może go zmienić),
 * więc formularz danych jest widoczny od wejścia. Grupa „wybor”: jak dotąd -
 * nic nie jest zaznaczone (zasada z 24.09).
 *
 * Grupa wynika z visitor_id (ten sam los przy każdej wizycie), z własną solą -
 * niezależnie od innych testów koszyka. Wyłącznik bez wdrożenia: CRM
 * (shop-public/site -> checkout.cart_form_open_share, 0-100; kv
 * shop_cart_form_ab {share}). 0 = wszyscy jak dotąd.
 * Podgląd: /koszyk?dane=od_razu albo ?dane=wybor (zostaje na urządzeniu), ?dane=los zdejmuje.
 */
import { getVisitorId } from "@/lib/analytics-context";

export type CartFormArm = "wybor" | "od_razu";

const ARM_KEY = "keika_cart_form_arm";
const FORCED_KEY = "keika_cart_form_forced";
const SHARE_KEY = "keika_cart_form_share";
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

/** Zapamiętuje udział grupy „od_razu” podany przez CRM (0-100). */
export function rememberCartFormShare(share: unknown): number {
  const value = typeof share === "number" && Number.isFinite(share) ? Math.min(100, Math.max(0, share)) : DEFAULT_SHARE;
  try {
    window.localStorage.setItem(SHARE_KEY, String(value));
  } catch {
    // brak localStorage - zostaje wartość domyślna
  }
  return value;
}

/** Los tej osoby (0-99) - stały dla visitor_id. */
export function cartFormBucket(): number {
  return hashToPercent(`koszyk-dane|${getVisitorId() || "anon"}`);
}

export function getCartFormArm(): { arm: CartFormArm; forced: boolean } {
  if (typeof window === "undefined") return { arm: "wybor", forced: false };
  try {
    const param = new URLSearchParams(window.location.search).get("dane");
    if (param === "od_razu" || param === "wybor") {
      window.localStorage.setItem(ARM_KEY, param);
      window.localStorage.setItem(FORCED_KEY, "1");
      return { arm: param, forced: true };
    }
    if (param === "los") {
      window.localStorage.removeItem(ARM_KEY);
      window.localStorage.removeItem(FORCED_KEY);
    }
    const stored = window.localStorage.getItem(ARM_KEY);
    if (window.localStorage.getItem(FORCED_KEY) === "1" && (stored === "od_razu" || stored === "wybor")) {
      return { arm: stored, forced: true };
    }
    return { arm: cartFormBucket() < readShare() ? "od_razu" : "wybor", forced: false };
  } catch {
    return { arm: "wybor", forced: false };
  }
}
