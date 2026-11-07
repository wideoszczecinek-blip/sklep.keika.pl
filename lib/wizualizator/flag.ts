/**
 * Kto widzi przycisk „Zobacz plisę w swoim oknie”.
 *  - ?wiz=1 w adresie → zawsze (zapamiętane na urządzeniu; ?wiz=0 zdejmuje),
 *  - test A/B: udział z CRM (Sklep WWW → Wizualizator, domyślnie 0 do odbioru E2),
 *    los stały dla visitor_id (FNV-1a, własna sól - niezależny od testu koszyka).
 * Otwieranie: jedno okno na stronę, wołane zdarzeniem (kilka przycisków, jeden modal).
 */
import { getVisitorId } from "@/lib/analytics-context";
import type { WizProdukt } from "@/lib/wizualizator/api";

const FORCE_KEY = "keika_wiz_force";
export const WIZ_OPEN_EVENT = "keika:wiz-open";
/** Konfigurator plis słucha tego zdarzenia: „Zamów tę plisę” ustawia tkaninę i listwy. */
export const WIZ_PICK_EVENT = "keika:wiz-wybor";

export type WizOpenDetail = { zrodlo: string; tkanina?: string; listwa?: string; token?: string; produkt?: WizProdukt };
export type WizPosition = { hardwareId: string; fabricGroupId: string; fabricId: string; room?: string };
export type WizPickDetail = { hardwareId?: string; fabricGroupId?: string; fabricId?: string; requireDimensions?: boolean; positions?: WizPosition[] };

function hashToPercent(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) % 100;
}

/** Domena produkcyjna: bez polecenia właściciela (udział w CRM > 0) klienci nie widzą wizualizatora - ?wiz=1 tu nie działa. */
const PROD_HOSTS = ["sklep.keika.pl", "www.sklep.keika.pl"];
export function wizIsProdHost(): boolean {
  return typeof window !== "undefined" && PROD_HOSTS.includes(window.location.hostname);
}

/** true/false wymuszone adresem lub wcześniej zapamiętane; null = decyduje test. */
export function wizForced(): boolean | null {
  if (typeof window === "undefined" || wizIsProdHost()) return null;
  try {
    const q = new URLSearchParams(window.location.search).get("wiz");
    if (q === "1") window.localStorage.setItem(FORCE_KEY, "1");
    if (q === "0") window.localStorage.removeItem(FORCE_KEY);
    return window.localStorage.getItem(FORCE_KEY) === "1" ? true : null;
  } catch {
    return null;
  }
}

export function wizBucket(): number {
  return hashToPercent(`wizualizator|${getVisitorId() || "anon"}`);
}

/**
 * Wejście z reklamy wizualizatora (Agencja 1.11): /plisy?wiz=start otwiera narzędzie od razu i zawsze pokazuje
 * przycisk temu urządzeniu - ruch z reklamy NIE trafia do 10 % grupy kontrolnej (kontrola = tylko ruch organiczny).
 * Działa także na produkcji, ale tylko gdy wizualizator jest uruchomiony (udział w CRM > 0).
 */
const REKLAMA_KEY = "keika_wiz_reklama";
export function wizFromAd(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("wiz") === "start") window.localStorage.setItem(REKLAMA_KEY, "1");
    return window.localStorage.getItem(REKLAMA_KEY) === "1";
  } catch {
    return new URLSearchParams(window.location.search).get("wiz") === "start";
  }
}

/**
 * Okna dachowe, wersja testowa (właściciel 7.11): przycisk na /plisy-dachowe i /rolety-dachowe widzi tylko urządzenie,
 * które weszło z ?wiz=dach (zapamiętane; ?wiz=0 zdejmuje) - albo los testu, gdy udział dachowych w CRM > 0. Działa też na produkcji.
 */
const DACH_KEY = "keika_wiz_dach";
export function wizDachTest(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const q = new URLSearchParams(window.location.search).get("wiz");
    if (q === "dach") window.localStorage.setItem(DACH_KEY, "1");
    if (q === "0") window.localStorage.removeItem(DACH_KEY);
    return window.localStorage.getItem(DACH_KEY) === "1";
  } catch {
    return new URLSearchParams(window.location.search).get("wiz") === "dach";
  }
}

/** Grupa testu dla zdarzeń: „wiz” (widzi przycisk) / „bez” / „wymuszone” / „reklama” (wejście z reklamy, poza testem). */
export function wizArm(share: number): "wiz" | "bez" | "wymuszone" | "reklama" {
  if (wizForced()) return "wymuszone";
  if (wizFromAd()) return "reklama";
  return wizBucket() < share ? "wiz" : "bez";
}

export function openWizualizator(detail: WizOpenDetail): void {
  window.dispatchEvent(new CustomEvent<WizOpenDetail>(WIZ_OPEN_EVENT, { detail }));
}
