/**
 * Test „premium” strony plis (właściciel 2.11: „dopieścić stronę i pokazać klientom, że te plisy to coś więcej –
 * premium look, wizualizacja, 5 lat gwarancji – jakość”; ceny i promocje BEZ zmian). Połowa osób widzi
 * dotychczasową stronę („classic”), połowa wersję premium: pieczęć gwarancji przy cenie, sekcja jakości
 * z detalami, przed/po, cytaty z opinii, spokojniejsze plakietki, pasek zaufania w koszyku i kasie.
 *
 * Grupa z visitor_id (własna sól, niezależna od testu koszyka). Wyłącznik bez wdrożenia: CRM
 * (shop-public/site → checkout.plisy_premium_share 0–100, core/lib/shop_premium_ab.php). 0 = wszyscy classic.
 * Podgląd: ?wyglad=premium albo ?wyglad=klasyczny (zostaje na urządzeniu), ?wyglad=los wraca do losowania.
 * Grupa trafia do analityki zdarzeniem „premium_ab” (raz na sesję) - ocena po 7 dniach.
 */
import { useEffect, useSyncExternalStore } from "react";
import { getVisitorId } from "@/lib/analytics-context";
import { crmGetJson } from "@/lib/crm-get";
import { trackShopStep } from "@/lib/track-step";
import { CRM_PUBLIC_BASE } from "@/app/components/payment-methods";

export type PremiumArm = "classic" | "premium";

const ARM_KEY = "keika_premium_arm";
const FORCED_KEY = "keika_premium_forced";
const SHARE_KEY = "keika_premium_share";
const LOGGED_KEY = "keika_premium_logged";
const DEFAULT_SHARE = 50;
/** Klasa na <html>: CSS wersji premium (spokojniejsze plakietki) działa w całym sklepie bez przekazywania props. */
const HTML_CLASS = "keika-premium";

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

export function getPremiumArm(): { arm: PremiumArm; forced: boolean } {
  if (typeof window === "undefined") return { arm: "classic", forced: false };
  try {
    const param = new URLSearchParams(window.location.search).get("wyglad");
    if (param === "premium" || param === "klasyczny") {
      const arm: PremiumArm = param === "premium" ? "premium" : "classic";
      window.localStorage.setItem(ARM_KEY, arm);
      window.localStorage.setItem(FORCED_KEY, "1");
      return { arm, forced: true };
    }
    if (param === "los") {
      window.localStorage.removeItem(ARM_KEY);
      window.localStorage.removeItem(FORCED_KEY);
    }
    const stored = window.localStorage.getItem(ARM_KEY);
    if (window.localStorage.getItem(FORCED_KEY) === "1" && (stored === "classic" || stored === "premium")) return { arm: stored, forced: true };
    const arm: PremiumArm = hashToPercent(`premium|${getVisitorId() || "anon"}`) < readShare() ? "premium" : "classic";
    return { arm, forced: false };
  } catch {
    return { arm: "classic", forced: false };
  }
}

function applyArm(arm: PremiumArm): void {
  document.documentElement.classList.toggle(HTML_CLASS, arm === "premium");
}

/**
 * Grupa testu premium dla tej osoby. Decyzja od razu z pamięci przeglądarki (bez czekania na sieć),
 * potem udział z CRM - gdy wyłącznik zmieni grupę, strona przełącza się bez przeładowania.
 */
const sluchacze = new Set<() => void>();
const subskrybuj = (cb: () => void) => {
  sluchacze.add(cb);
  return () => {
    sluchacze.delete(cb);
  };
};
const migawka = (): PremiumArm => getPremiumArm().arm;

export function usePremiumLook(): PremiumArm {
  // serwer i pierwszy render: classic (bez rozjazdu hydracji), potem grupa z pamięci przeglądarki
  const arm = useSyncExternalStore(subskrybuj, migawka, () => "classic" as PremiumArm);
  useEffect(() => {
    applyArm(arm);
  }, [arm]);
  useEffect(() => {
    let alive = true;
    const first = getPremiumArm();
    try {
      if (window.sessionStorage.getItem(LOGGED_KEY) !== first.arm) {
        window.sessionStorage.setItem(LOGGED_KEY, first.arm);
        trackShopStep("premium_ab", first.arm, { forced: first.forced, share: readShare() });
      }
    } catch {
      // bez sessionStorage - zdarzenie może pójść kilka razy, raport liczy osoby
    }
    crmGetJson<Record<string, unknown>>(`${CRM_PUBLIC_BASE}/site`)
      .then((json) => {
        const checkout = (json?.checkout && typeof json.checkout === "object" ? json.checkout : {}) as Record<string, unknown>;
        const share = checkout.plisy_premium_share;
        if (!alive || typeof share !== "number" || !Number.isFinite(share)) return;
        try {
          window.localStorage.setItem(SHARE_KEY, String(Math.min(100, Math.max(0, share))));
        } catch {
          // nic
        }
        sluchacze.forEach((cb) => cb());
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return arm;
}
