/**
 * Rabat ratunkowy za zapis (właściciel 2.11.2026: „ok – możesz wdrożyć”).
 *
 * Po zamianie SEZON20 na CAŁY DOM koszyki z 1 sztuką kończyły się zamówieniem
 * w 4,9 % (przed 28.10: 19 %). Zamiast stałego rabatu od 1 sztuki - marka
 * premium - okienko tylko przy próbie WYJŚCIA z koszyka albo kasy, gdy w
 * koszyku jest dokładnie 1 sztuka:
 *  - komputer: kursor wyjeżdża ku górze okna,
 *  - telefon: przycisk wstecz, przełączenie karty, ok. 50 s bezczynności,
 * najwyżej raz na urządzenie na 7 dni. Za e-mail + osobną, dobrowolną zgodę
 * marketingową CRM wydaje kod RATUJ-XXXXXX (−10 %, 24 h, 1 użycie, przypisany
 * do e-maila) i wysyła go mailem; koszyk nalicza go od razu (kod osobisty,
 * lib/personal-code.ts - pasek u góry pokazuje termin).
 *
 * Rozstrzyga CRM (shop-public/rescue_signup.php, core/lib/shop_rescue_signup.php):
 * ustawienie admin_automations.shop_rescue_discount, procent wg liczby sztuk
 * (tiers {"1": 10, "2": 0} - 0 = nie dotyczy). Rabaty się nie sumują: przy 2+
 * sztukach kod przestaje działać i liczy się CAŁY DOM. Ten moduł tylko pyta,
 * pamięta urządzenie i liczy, czy okienko wolno pokazać.
 *
 * Testy: wejście z ?internal_preview=1 oznacza urządzenie jako wewnętrzne -
 * zdarzenia mają meta internal: true, kod idzie jako testowy, kafel w CRM ich
 * nie liczy.
 */

import type { CartLineItem } from "@/lib/cart";
import { savePersonalCode } from "@/lib/personal-code";
import { trackShopStep } from "@/lib/track-step";

const ENDPOINT = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/rescue_signup.php";
const SETTINGS_KEY = "keika_rescue_signup_settings";
const DEVICE_KEY = "keika_rescue_signup_v1";
const DEVICE_COOKIE = "keika_rescue_shown";
const INTERNAL_KEY = "keika_internal_traffic";
const SETTINGS_TTL_MS = 10 * 60 * 1000;

export const RESCUE_SIGNUP_CODE_PREFIX = "RATUJ-";

export type RescueSignupSettings = {
  enabled: boolean;
  tiers: Record<string, number>;
  hours: number;
  cooldownDays: number;
  idleSeconds: number;
  consentText: string;
};

export type RescueSignupResult = {
  ok: boolean;
  code?: string;
  percent?: number;
  expiresAt?: string;
  expiresLabel?: string;
  error?: string;
};

let settingsCache: RescueSignupSettings | null = null;
let settingsInFlight: Promise<RescueSignupSettings | null> | null = null;
/** Moment, w którym okienko wzięło wyjście - inne okienka wyjścia (5 % dla
 * wychodzących, koszyk na e-mail) w tej samej chwili milczą. */
let claimedAt = 0;

function isOknowoHost(): boolean {
  try {
    return /oknowo/i.test(window.location.hostname);
  } catch {
    return false;
  }
}

export function isInternalTraffic(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (new URLSearchParams(window.location.search).get("internal_preview") === "1") {
      window.localStorage.setItem(INTERNAL_KEY, "1");
      return true;
    }
    return window.localStorage.getItem(INTERNAL_KEY) === "1";
  } catch {
    return false;
  }
}

function parseSettings(raw: unknown): RescueSignupSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const tiers: Record<string, number> = {};
  if (r.tiers && typeof r.tiers === "object") {
    for (const [units, pct] of Object.entries(r.tiers as Record<string, unknown>)) tiers[units] = Number(pct) || 0;
  }
  return {
    enabled: r.enabled === true,
    tiers,
    hours: Number(r.hours) || 24,
    cooldownDays: Number(r.cooldown_days ?? r.cooldownDays) || 7,
    idleSeconds: Number(r.idle_seconds ?? r.idleSeconds) || 50,
    consentText: String(r.consent_text ?? r.consentText ?? ""),
  };
}

/** Ustawienia z CRM (pamiętane 10 min w karcie). */
export function loadRescueSignupSettings(): Promise<RescueSignupSettings | null> {
  if (typeof window === "undefined" || isOknowoHost()) return Promise.resolve(null);
  if (settingsCache) return Promise.resolve(settingsCache);
  try {
    const raw = window.sessionStorage.getItem(SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { at: number; s: unknown };
      if (Date.now() - parsed.at < SETTINGS_TTL_MS) {
        settingsCache = parseSettings(parsed.s);
        if (settingsCache) return Promise.resolve(settingsCache);
      }
    }
  } catch {
    // brak sessionStorage - pytamy CRM
  }
  if (settingsInFlight) return settingsInFlight;
  settingsInFlight = fetch(ENDPOINT, { cache: "no-store" })
    .then((response) => response.json())
    .then((json) => {
      const parsed = json?.ok ? parseSettings(json) : null;
      settingsCache = parsed;
      try {
        if (json?.ok) window.sessionStorage.setItem(SETTINGS_KEY, JSON.stringify({ at: Date.now(), s: json }));
      } catch {
        // nic
      }
      return parsed;
    })
    .catch(() => null)
    .finally(() => {
      settingsInFlight = null;
    });
  return settingsInFlight;
}

export function cartUnits(items: CartLineItem[]): number {
  return items.reduce((sum, item) => sum + Math.max(1, Math.floor(Number(item.qty) || 1)), 0);
}

export function rescuePercentForUnits(settings: RescueSignupSettings | null, units: number): number {
  if (!settings || !settings.enabled) return 0;
  return Math.max(0, Number(settings.tiers[String(units)]) || 0);
}

/** Liczby sztuk, przy których kod działa (procent > 0), rosnąco - np. [1, 2]. */
export function rescueCodeUnits(settings: RescueSignupSettings | null): number[] {
  if (!settings) return [];
  return Object.keys(settings.tiers)
    .map(Number)
    .filter((n) => n >= 1 && rescuePercentForUnits(settings, n) > 0)
    .sort((a, b) => a - b);
}

/** Procent CAŁY DOM (reguła na całe zamówienie) przy danej liczbie sztuk; 0 = brak rabatu. */
export function bundlePercentFor(tiers: Array<{ fromQty: number; percent: number }>, units: number): number {
  let pct = 0;
  for (const t of tiers) if (units >= t.fromQty) pct = t.percent;
  return pct;
}

function readDeviceShownAt(): number {
  let at = 0;
  try {
    const raw = window.localStorage.getItem(DEVICE_KEY);
    if (raw) at = Number(JSON.parse(raw)?.shownAt) || 0;
  } catch {
    // FB in-app potrafi blokować localStorage - zostaje cookie
  }
  if (!at) {
    const match = document.cookie.match(/(?:^|; )keika_rescue_shown=(\d+)/);
    if (match) at = Number(match[1]) || 0;
  }
  return at;
}

/** Okienko było już na tym urządzeniu w ciągu ostatnich N dni. */
export function rescueShownRecently(settings: RescueSignupSettings | null): boolean {
  if (typeof window === "undefined") return true;
  const at = readDeviceShownAt();
  const days = settings?.cooldownDays ?? 7;
  return at > 0 && Date.now() - at < days * 24 * 60 * 60 * 1000;
}

export function markRescueShown(settings: RescueSignupSettings | null): void {
  claimedAt = Date.now();
  const now = Date.now();
  try {
    window.localStorage.setItem(DEVICE_KEY, JSON.stringify({ shownAt: now }));
  } catch {
    // cookie niżej
  }
  const days = settings?.cooldownDays ?? 7;
  document.cookie = `${DEVICE_COOKIE}=${now}; path=/; max-age=${days * 24 * 60 * 60}; SameSite=Lax`;
}

/** Koszyk należy do tej oferty (1 szt., oferta włączona) - „dodatkowe 5 %”
 * dla wychodzących wtedy nie startuje, żeby nie było dwóch rabatów naraz. */
export function rescueOwnsCart(items: CartLineItem[]): boolean {
  if (typeof window === "undefined" || isOknowoHost() || items.length === 0) return false;
  return rescuePercentForUnits(settingsCache, cartUnits(items)) > 0;
}

let eligibilityProbe: (() => boolean) | null = null;

/** Okienko w koszyku (app/components/rescue-signup.tsx) zgłasza, czy pokazałoby się teraz. */
export function registerRescueEligibility(probe: (() => boolean) | null): void {
  eligibilityProbe = probe;
}

/** To wyjście bierze okienko za zapis (pokaże się teraz albo właśnie się pokazało). */
export function rescueClaimsExit(): boolean {
  if (Date.now() - claimedAt < 3000) return true;
  try {
    return eligibilityProbe ? eligibilityProbe() : false;
  } catch {
    return false;
  }
}

export async function submitRescueSignup(input: { email: string; consent: boolean; units: number; consentText: string }): Promise<RescueSignupResult> {
  let sessionToken = "";
  try {
    sessionToken = window.sessionStorage.getItem("keika_shop_session_token") || "";
  } catch {
    // nic
  }
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: input.email,
        consent: input.consent,
        consent_text: input.consentText,
        units: input.units,
        session_token: sessionToken,
        page: window.location.pathname,
        internal: isInternalTraffic(),
      }),
    });
    const json = await response.json();
    if (!json?.ok || !json.code) return { ok: false, error: String(json?.error || "Nie udało się wysłać kodu. Spróbuj ponownie.") };
    const expiresAtMs = Date.parse(String(json.expires_at || ""));
    savePersonalCode({
      code: String(json.code),
      percent: Number(json.percent) || 0,
      expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : null,
      label: `Twój kod −${Math.round(Number(json.percent) || 0)}% na to zamówienie`,
      verified: true,
    });
    return { ok: true, code: String(json.code), percent: Number(json.percent) || 0, expiresAt: String(json.expires_at || ""), expiresLabel: String(json.expires_label || "") };
  } catch {
    return { ok: false, error: "Brak połączenia. Spróbuj ponownie za chwilę." };
  }
}

export function isRescueSignupCode(code: string | null | undefined): boolean {
  return String(code || "").toUpperCase().startsWith(RESCUE_SIGNUP_CODE_PREFIX);
}

/** Zdarzenie z oznaczeniem testu wewnętrznego (kafel w CRM pomija internal). */
export function trackRescue(eventName: string, label: string, meta: Record<string, string | number | boolean | null> = {}): void {
  trackShopStep(eventName, label, isInternalTraffic() ? { ...meta, internal: true } : meta);
}

/** "23:59:41" */
export function formatRescueClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
