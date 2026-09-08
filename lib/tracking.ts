"use client";

/**
 * Meta Pixel + Conversions API (CAPI) - jedno miejsce dla całego trackingu sklepu.
 *
 * Zasady:
 *  - Pixel + CAPI ładują się BEZ WARUNKOWO na każdym wejściu (baner zgody
 *    usunięty - patrz initTracking(); decyzja właściciela, by nie tracić
 *    ~połowy ruchu z przeglądarki w aplikacji FB, która nigdy nie klikała
 *    "Akceptuję"). _fbp/_fbc mintowane po naszej stronie (ensureFbp/ensureFbc),
 *    żeby każdy odwiedzający był kwalifikowalny do audiencji remarketingowej.
 *  - Każde zdarzenie ma wspólny `eventId` używany zarówno przez fbq (przeglądarka)
 *    jak i relay do CAPI (serwer CRM) -> Meta deduplikuje Browser + Server.
 *  - `pixel_id` i URL relaya pobierane raz z CRM (/shop-public/tracking_config) -
 *    jedno źródło prawdy, bez zmiennych środowiskowych na froncie.
 *  - Purchase NIE leci stąd do CAPI - serwer CRM wysyła go z potwierdzenia
 *    zamówienia (event_id = order_code). Tu odpalamy tylko przeglądarkowy
 *    Purchase na stronie podziękowania z tym samym event_id.
 */

// Ta sama baza co lib/shop-public.ts, ale bez importu tamtego modułu (ma
// server-only `cache()` w scope) - tracking.ts jest czysto kliencki.
const crmBaseUrl =
  process.env.NEXT_PUBLIC_CRM_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://crm-keika.groovemedia.pl";

const CONSENT_KEY = "keika-consent";
const CONSENT_VERSION = 1;
const ATTRIBUTION_KEY = "keika-attribution";
export const CONSENT_CHANGED_EVENT = "keika-consent-changed";

type ConsentState = { analytics: boolean; ts: number; v: number };

type Attribution = {
  fbclid?: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  utm_term?: string;
  landing_url?: string;
  referrer?: string;
  first_seen?: string;
};

type TrackParams = {
  value?: number;
  currency?: string;
  content_ids?: string[];
  content_name?: string;
  content_type?: string;
  content_category?: string;
  contents?: Array<{ id: string; quantity: number; item_price?: number }>;
  num_items?: number;
  search_string?: string;
  order_id?: string;
};

type TrackOptions = {
  /** Wymuś konkretny event_id (Purchase: musi być = order_code). */
  eventId?: string;
  /** Pomiń relay do CAPI (np. czysto UI-owe zdarzenie). */
  skipCapi?: boolean;
};

declare global {
  interface Window {
    fbq?: ((...args: unknown[]) => void) & { queue?: unknown[]; loaded?: boolean };
    _fbq?: unknown;
  }
}

/* ------------------------------------------------------------------ *
 * Zgoda
 * ------------------------------------------------------------------ */

export function readConsent(): ConsentState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(CONSENT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ConsentState>;
    if (typeof parsed.analytics !== "boolean") return null;
    return { analytics: parsed.analytics, ts: Number(parsed.ts) || 0, v: Number(parsed.v) || 0 };
  } catch {
    return null;
  }
}

export function hasAnalyticsConsent(): boolean {
  return readConsent()?.analytics === true;
}

/** true = wybór już dokonany (baner można schować). */
export function consentDecided(): boolean {
  const c = readConsent();
  return !!c && c.v === CONSENT_VERSION;
}

export function setConsent(analytics: boolean): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      CONSENT_KEY,
      JSON.stringify({ analytics, ts: Date.now(), v: CONSENT_VERSION } satisfies ConsentState),
    );
  } catch {
    /* private mode - zgoda po prostu nie zapamiętana, baner wróci */
  }
  try {
    window.dispatchEvent(new CustomEvent(CONSENT_CHANGED_EVENT, { detail: { analytics } }));
  } catch {
    /* ignore */
  }
  if (analytics) {
    void initTracking();
  }
}

/* ------------------------------------------------------------------ *
 * Atrybucja (first-touch, przeżywa nawigację po SPA)
 * ------------------------------------------------------------------ */

function readAttribution(): Attribution {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ATTRIBUTION_KEY);
    return raw ? (JSON.parse(raw) as Attribution) : {};
  } catch {
    return {};
  }
}

function writeAttribution(next: Attribution): void {
  try {
    window.localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

/**
 * Wywołać raz przy starcie. Jeśli w URL są parametry kampanii (fbclid / utm_*),
 * zapisuje je jako first-touch (nie nadpisuje istniejących). Zawsze utrwala
 * landing_url + referrer przy pierwszej wizycie.
 */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  const current = readAttribution();
  const params = new URLSearchParams(window.location.search);
  const next: Attribution = { ...current };

  const keys: Array<keyof Attribution> = [
    "fbclid",
    "utm_source",
    "utm_medium",
    "utm_campaign",
    "utm_content",
    "utm_term",
  ];
  let changed = false;
  for (const key of keys) {
    const val = params.get(key);
    if (val && !current[key]) {
      next[key] = val.slice(0, 500);
      changed = true;
    }
  }
  if (!current.first_seen) {
    next.first_seen = new Date().toISOString();
    next.landing_url = window.location.href.slice(0, 900);
    next.referrer = (document.referrer || "").slice(0, 900);
    changed = true;
  }
  if (changed) writeAttribution(next);
}

function getCookie(name: string): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()[\]\\/+^])/g, "\\$1") + "=([^;]*)"));
  return match ? decodeURIComponent(match[1]) : "";
}

// Written on .keika.pl (eTLD+1, same scope Meta's fbevents.js uses) so the
// pixel picks up the SAME id we mint rather than creating a second one.
function setCookie(name: string, value: string, days: number): void {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  const host = window.location.hostname;
  const domain = host.endsWith("keika.pl") ? "; domain=.keika.pl" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; path=/; max-age=${maxAge}${domain}; SameSite=Lax`;
}

/**
 * Guarantee a persistent _fbp browser id. Meta's pixel normally creates it,
 * but on the Facebook in-app browser (the bulk of this shop's traffic)
 * fbevents.js frequently fails to load or run, so ~half of the pixel/CAPI
 * hits used to reach Meta with no _fbp - and Meta will NOT build a website
 * custom audience from those (fbc alone is a click id, not a person). We
 * mint one first, in the exact fb.1.<ts>.<rand> format; if fbevents.js does
 * load later it reads and keeps this cookie rather than replacing it.
 */
function ensureFbp(): string {
  const existing = getCookie("_fbp");
  if (existing) return existing;
  const val = `fb.1.${Date.now()}.${Math.floor(1e12 + Math.random() * 9e12)}`;
  setCookie("_fbp", val, 90);
  return val;
}

/** Persist _fbc from an fbclid (URL or stored first-touch) so later events
 * and the pixel share one value instead of each recomputing its own. */
function ensureFbc(attr: Attribution): string {
  const existing = getCookie("_fbc");
  if (existing) return existing;
  let fbclid = attr.fbclid || "";
  if (!fbclid && typeof window !== "undefined") {
    fbclid = new URLSearchParams(window.location.search).get("fbclid") || "";
  }
  if (!fbclid) return "";
  const val = `fb.1.${Date.now()}.${fbclid}`;
  setCookie("_fbc", val, 90);
  return val;
}

function resolveFbc(attr: Attribution): string {
  return getCookie("_fbc") || ensureFbc(attr);
}

/**
 * Blok do dołączenia w payloadzie tworzenia zamówienia (checkout).
 * Serwer CRM użyje tego do serwerowego Purchase (Meta CAPI).
 */
export function getAttributionPayload(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const attr = readAttribution();
  const out: Record<string, string> = {};
  const fbp = getCookie("_fbp");
  const fbc = resolveFbc(attr);
  if (fbp) out.fbp = fbp;
  if (fbc) out.fbc = fbc;
  if (attr.fbclid) out.fbclid = attr.fbclid;
  for (const k of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term"] as const) {
    if (attr[k]) out[k] = attr[k] as string;
  }
  if (attr.landing_url) out.landing_url = attr.landing_url;
  if (attr.referrer) out.referrer = attr.referrer;
  if (navigator?.userAgent) out.ua = navigator.userAgent;
  return out;
}

/* ------------------------------------------------------------------ *
 * Pixel + CAPI
 * ------------------------------------------------------------------ */

type TrackingConfig = { pixelId: string; capiUrl: string; capiEnabled: boolean };

let config: TrackingConfig | null = null;
let configPromise: Promise<TrackingConfig | null> | null = null;
let pixelInjected = false;
let pageViewSent = false;

async function loadConfig(): Promise<TrackingConfig | null> {
  if (config) return config;
  if (configPromise) return configPromise;
  configPromise = (async () => {
    try {
      const res = await fetch(`${crmBaseUrl}/biuro/api/shop-public/tracking_config`, { cache: "no-store" });
      const json = (await res.json()) as {
        ok?: boolean;
        meta_pixel_id?: string;
        capi_enabled?: boolean;
        capi_event_url?: string;
      };
      if (!json?.ok || !json.meta_pixel_id) return null;
      config = {
        pixelId: String(json.meta_pixel_id),
        capiUrl: String(json.capi_event_url || `${crmBaseUrl}/biuro/api/shop-public/capi_event`),
        capiEnabled: json.capi_enabled !== false,
      };
      return config;
    } catch {
      return null;
    }
  })();
  return configPromise;
}

function injectPixelScript(pixelId: string): void {
  if (pixelInjected || typeof window === "undefined") return;
  pixelInjected = true;

  /* eslint-disable */
  // Standardowy snippet fbevents.js (bez automatycznego PageView - odpalamy go
  // ręcznie z eventID niżej, żeby zdeduplikować z relayem CAPI).
  (function (f: any, b: any, e: string, v: string) {
    if (f.fbq) return;
    const n: any = (f.fbq = function () {
      n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
    });
    if (!f._fbq) f._fbq = n;
    n.push = n;
    n.loaded = true;
    n.version = "2.0";
    n.queue = [];
    const t = b.createElement(e);
    t.async = true;
    t.src = v;
    const s = b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t, s);
  })(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
  /* eslint-enable */

  window.fbq?.("init", pixelId);
}

/**
 * Wywołać raz (z klienckiego komponentu w layoucie). Idempotentne.
 * Ładuje Pixel i wysyła pierwszy PageView tylko gdy jest zgoda.
 */
export async function initTracking(): Promise<void> {
  if (typeof window === "undefined") return;
  captureAttribution();
  // Runs unconditionally now - the cookie-consent gate was removed to stop
  // losing the ~half of visitors (Facebook in-app browser) who never tapped
  // "Akceptuję" and so generated no Meta signal at all, starving the
  // remarketing audiences. _fbp/_fbc are minted here so every visitor is
  // audience-eligible even when fbevents.js itself never runs.
  ensureFbp();
  ensureFbc(readAttribution());

  const cfg = await loadConfig();
  if (!cfg) return;

  injectPixelScript(cfg.pixelId);

  if (!pageViewSent) {
    pageViewSent = true;
    const eventId = newEventId();
    window.fbq?.("track", "PageView", {}, { eventID: eventId });
    void relayToCapi("PageView", {}, eventId, cfg);
  }
}

function newEventId(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  } catch {
    /* ignore */
  }
  return `e-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function relayToCapi(
  eventName: string,
  params: TrackParams,
  eventId: string,
  cfg: TrackingConfig,
): Promise<void> {
  if (!cfg.capiEnabled) return;
  try {
    const attr = readAttribution();
    const body = {
      event_name: eventName,
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      event_source_url: window.location.href,
      fbp: ensureFbp(),
      fbc: resolveFbc(attr),
      fbclid: attr.fbclid || "",
      custom_data: params,
    };
    await fetch(cfg.capiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      keepalive: true,
    });
  } catch {
    /* relay best-effort */
  }
}

/**
 * Główna funkcja trackująca. Odpala fbq + relay do CAPI z tym samym event_id.
 * No-op bez zgody / bez konfiguracji.
 */
export function track(eventName: string, params: TrackParams = {}, opts: TrackOptions = {}): string {
  const eventId = opts.eventId || newEventId();
  if (typeof window === "undefined") return eventId;

  void (async () => {
    const cfg = await loadConfig();
    if (!cfg) return;
    injectPixelScript(cfg.pixelId);
    try {
      window.fbq?.("track", eventName, params, { eventID: eventId });
    } catch {
      /* ignore */
    }
    if (!opts.skipCapi) {
      await relayToCapi(eventName, params, eventId, cfg);
    }
  })();

  return eventId;
}
