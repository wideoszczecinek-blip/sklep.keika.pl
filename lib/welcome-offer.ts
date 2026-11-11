/**
 * Oferta powitalna Black Weeks −25 % (właściciel 11.11.2026; od 11.11 wieczorem
 * na stałe dla całego ruchu, bez testu; jeden rabat na gościa, 24 h).
 *
 * Każdy gość sklep.keika.pl (nie Oknowo) widzi panel „−25 % na całe
 * zamówienie, od 1 sztuki, ważne 24 h”. Pokazanie panelu prosi CRM o osobisty
 * kod BW25-XXXXXX (shop-public/welcome_offer.php, core/lib/shop_welcome_offer.php)
 * i zapisuje go jako kod osobisty (lib/personal-code.ts): koszyk nalicza go
 * sam, pasek u góry pokazuje odliczanie, konfiguratory - przekreśloną cenę.
 * E-mail jest nieobowiązkowy: po jego podaniu CRM wysyła kod od razu oraz
 * przypomnienia 10 h i 1 h przed końcem.
 *
 * Panel znika, gdy gość ma już inny kod osobisty (WRACAM-, bon za opinię),
 * jest w trakcie zamówienia albo oferta w CRM nie jest aktywna.
 */

import { getSessionToken, getVisitorId } from "@/lib/analytics-context";
import { getPersonalCode, savePersonalCode, type PersonalCode } from "@/lib/personal-code";
import { isInternalTraffic } from "@/lib/rescue-signup";
import { trackShopStep } from "@/lib/track-step";
import type { PromoPreview } from "@/lib/promo";

const ENDPOINT = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/welcome_offer.php";
const SETTINGS_KEY = "keika_welcome_offer_settings";
const SETTINGS_TTL_MS = 5 * 60 * 1000;
const STATE_KEY = "keika_welcome_offer_v1";

export const WELCOME_CODE_PREFIX = "BW25-";
export const WELCOME_EVENT = "keika:welcome-offer";

export type WelcomeSettings = {
  active: boolean;
  percent: number;
  hours: number;
  consentText: string;
};

export type WelcomeClaim = {
  ok: boolean;
  code?: string;
  percent?: number;
  expiresAt?: string;
  expiresLabel?: string;
  expired?: boolean;
  used?: boolean;
  email?: boolean;
  error?: string;
};

/** Pamięć urządzenia: kiedy panel pokazano / zamknięto, czy kod odebrany, czy e-mail podany. */
export type WelcomeDeviceState = {
  shownAt?: number;
  dismissedAt?: number;
  claimedCode?: string;
  expiresAtMs?: number;
  emailGiven?: boolean;
};

export function isOknowoHost(): boolean {
  try {
    return /oknowo/i.test(window.location.hostname);
  } catch {
    return false;
  }
}

export function isWelcomeCode(code: string | null | undefined): boolean {
  return String(code || "").toUpperCase().startsWith(WELCOME_CODE_PREFIX);
}

let settingsCache: WelcomeSettings | null = null;
let settingsInFlight: Promise<WelcomeSettings | null> | null = null;

function parseSettings(raw: unknown): WelcomeSettings | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    active: r.active === true,
    percent: Number(r.percent) || 25,
    hours: Number(r.hours) || 24,
    consentText: String(r.consent_text ?? ""),
  };
}

export function loadWelcomeSettings(): Promise<WelcomeSettings | null> {
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

export function readWelcomeState(): WelcomeDeviceState {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    return raw ? (JSON.parse(raw) as WelcomeDeviceState) : {};
  } catch {
    return {};
  }
}

export function writeWelcomeState(patch: Partial<WelcomeDeviceState>): WelcomeDeviceState {
  const next = { ...readWelcomeState(), ...patch };
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(next));
  } catch {
    // tryb prywatny - panel może pokazać się jeszcze raz, kod i tak jest w cookie (personal-code)
  }
  try {
    window.dispatchEvent(new CustomEvent(WELCOME_EVENT));
  } catch {
    // nic
  }
  return next;
}

/** Aktywny kod powitalny tego urządzenia (zweryfikowany, niewygasły) albo null. */
export function getActiveWelcomeCode(): PersonalCode | null {
  const personal = getPersonalCode();
  if (!personal || !isWelcomeCode(personal.code)) return null;
  if (!personal.expiresAtMs || personal.expiresAtMs <= Date.now()) return null;
  return personal;
}

/** Podgląd rabatu dla konfiguratorów (ten sam kształt co dawny SEZON20). */
export function welcomePromoPreview(): PromoPreview | null {
  const active = getActiveWelcomeCode();
  if (!active) return null;
  return { code: active.code, type: "percent", value: active.percent || 25, amount: 0 };
}

export function trackWelcome(eventName: string, label: string, meta: Record<string, string | number | boolean | null> = {}): void {
  trackShopStep(eventName, label, { ...meta, ...(isInternalTraffic() ? { internal: true } : {}) });
}

async function post(body: Record<string, unknown>): Promise<WelcomeClaim> {
  try {
    const response = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...body,
        visitor_id: getVisitorId(),
        session_token: getSessionToken(),
        page: window.location.pathname,
        internal: isInternalTraffic(),
      }),
    });
    const json = (await response.json()) as Record<string, unknown>;
    if (!json?.ok) return { ok: false, error: String(json?.error || "Nie udało się. Spróbuj ponownie.") };
    return {
      ok: true,
      code: json.code ? String(json.code) : undefined,
      percent: Number(json.percent) || undefined,
      expiresAt: json.expires_at ? String(json.expires_at) : undefined,
      expiresLabel: json.expires_label ? String(json.expires_label) : undefined,
      expired: json.expired === true,
      used: json.used === true,
      email: json.email === true,
    };
  } catch {
    return { ok: false, error: "Brak połączenia. Spróbuj ponownie za chwilę." };
  }
}

/** Klik „Odbieram”: kod z CRM → kod osobisty sklepu (koszyk, pasek, konfiguratory). */
export async function claimWelcome(): Promise<WelcomeClaim> {
  const res = await post({ action: "claim" });
  if (!res.ok || !res.code) return res;
  const expiresAtMs = res.expiresAt ? Date.parse(res.expiresAt) : NaN;
  writeWelcomeState({ claimedCode: res.code, expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : undefined, emailGiven: res.email === true });
  if (!res.expired && !res.used && Number.isFinite(expiresAtMs)) {
    savePersonalCode({
      code: res.code,
      percent: res.percent || 25,
      expiresAtMs,
      label: `Twój rabat Black Weeks −${res.percent || 25}% na całe zamówienie`,
      verified: true,
    });
  }
  return res;
}

export async function sendWelcomeEmail(code: string, email: string, consent: boolean, consentText: string): Promise<WelcomeClaim> {
  const res = await post({ action: "email", code, email, consent, consent_text: consentText });
  if (res.ok) writeWelcomeState({ emailGiven: true });
  return res;
}

export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}
