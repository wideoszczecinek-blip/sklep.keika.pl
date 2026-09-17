// Kontekst odwiedzającego dla analityki CRM (właściciel, 2026-09-17: "zbieramy
// naprawdę każdy ruch klienta, żeby później odpowiedzieć, gdzie ludzie
// uciekają"). Trwałe id odwiedzającego (localStorage), token sesji
// (sessionStorage), źródło wejścia (UTM / fbclid / referrer), urządzenie.
// Zero danych osobowych - żadnych wartości pól formularza, tylko środowisko.
// Wszystko owinięte w try/catch: tryb prywatny / zablokowany storage nigdy
// nie może zepsuć strony.

export const SESSION_TOKEN_KEY = "keika_shop_session_token";
const VISITOR_ID_KEY = "keika_visitor_id";
const FIRST_SEEN_KEY = "keika_visitor_first_seen";
const VISIT_COUNT_KEY = "keika_visitor_visits";
const SESSION_STARTED_KEY = "keika_session_started";
const LANDING_KEY = "keika_session_landing";

export function getSessionToken(): string {
  if (typeof window === "undefined") return "";
  try {
    let token = window.sessionStorage.getItem(SESSION_TOKEN_KEY);
    if (!token) {
      token = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_TOKEN_KEY, token);
    }
    return token;
  } catch {
    return "";
  }
}

/** Trwałe (między wizytami) id przeglądarki - dokładniejsze niż hash IP,
 * którym CRM liczył dotąd "która to wizyta". */
export function getVisitorId(): string {
  if (typeof window === "undefined") return "";
  try {
    let id = window.localStorage.getItem(VISITOR_ID_KEY);
    if (!id) {
      const rand = typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID().replace(/-/g, "").slice(0, 24)
        : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
      id = `v_${rand}`;
      window.localStorage.setItem(VISITOR_ID_KEY, id);
    }
    return id;
  } catch {
    return "";
  }
}

/** Liczy wizyty (sesje) tej przeglądarki; zwraca stan po zaliczeniu bieżącej. */
export function registerVisit(): { visitCount: number; firstSeenDaysAgo: number; returning: boolean } {
  if (typeof window === "undefined") return { visitCount: 1, firstSeenDaysAgo: 0, returning: false };
  try {
    const now = Date.now();
    let firstSeen = Number(window.localStorage.getItem(FIRST_SEEN_KEY) || 0);
    if (!firstSeen) {
      firstSeen = now;
      window.localStorage.setItem(FIRST_SEEN_KEY, String(now));
    }
    const count = Math.max(0, Number(window.localStorage.getItem(VISIT_COUNT_KEY) || 0)) + 1;
    window.localStorage.setItem(VISIT_COUNT_KEY, String(count));
    return {
      visitCount: count,
      firstSeenDaysAgo: Math.max(0, Math.round((now - firstSeen) / 86400000)),
      returning: count > 1,
    };
  } catch {
    return { visitCount: 1, firstSeenDaysAgo: 0, returning: false };
  }
}

/** true tylko za pierwszym razem w tej sesji (potem już oznaczone). */
export function markSessionStarted(): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(SESSION_STARTED_KEY)) return false;
    window.sessionStorage.setItem(SESSION_STARTED_KEY, "1");
    window.sessionStorage.setItem(LANDING_KEY, window.location.href.slice(0, 600));
    return true;
  } catch {
    return false;
  }
}

export function getLandingUrl(): string {
  if (typeof window === "undefined") return "";
  try {
    return window.sessionStorage.getItem(LANDING_KEY) || window.location.href.slice(0, 600);
  } catch {
    return window.location.href.slice(0, 600);
  }
}

export type CampaignParams = Record<string, string | boolean>;

/** utm_* + identyfikatory kliknięć reklam (obecność, nie wartość). */
export function parseCampaignParams(href: string): CampaignParams {
  const out: CampaignParams = {};
  try {
    const url = new URL(href);
    for (const key of ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "utm_id", "produkt", "resume_token", "ref"]) {
      const value = url.searchParams.get(key);
      if (value) out[key] = key === "resume_token" ? "present" : value.slice(0, 120);
    }
    for (const key of ["fbclid", "gclid", "ttclid", "msclkid", "wbraid", "gbraid"]) {
      if (url.searchParams.has(key)) out[key] = true;
    }
  } catch {
    // niepoprawny URL - bez parametrów
  }
  return out;
}

function detectInAppBrowser(ua: string): string {
  if (/FBAN|FBAV|FB_IAB|FB4A|FBIOS/i.test(ua)) return "facebook";
  if (/Instagram/i.test(ua)) return "instagram";
  if (/Messenger/i.test(ua)) return "messenger";
  if (/TikTok|musical_ly|Bytedance/i.test(ua)) return "tiktok";
  if (/Line\//i.test(ua)) return "line";
  if (/Snapchat/i.test(ua)) return "snapchat";
  if (/GSA\//i.test(ua)) return "google-app";
  return "";
}

export function getDeviceContext(): Record<string, string | number | boolean | null> {
  if (typeof window === "undefined") return {};
  const nav = navigator as Navigator & {
    connection?: { effectiveType?: string; saveData?: boolean; downlink?: number };
    userAgentData?: { platform?: string; mobile?: boolean };
  };
  const ua = String(nav.userAgent || "").slice(0, 300);
  let tz = "";
  try {
    tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    // brak Intl - pomijamy
  }
  return {
    ua,
    in_app_browser: detectInAppBrowser(ua),
    platform: nav.userAgentData?.platform || nav.platform || "",
    ua_mobile: nav.userAgentData?.mobile ?? null,
    screen_w: window.screen?.width || 0,
    screen_h: window.screen?.height || 0,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    dpr: Math.round((window.devicePixelRatio || 1) * 100) / 100,
    touch: "ontouchstart" in window || (nav.maxTouchPoints || 0) > 0,
    lang: nav.language || "",
    tz,
    connection: nav.connection?.effectiveType || "",
    save_data: Boolean(nav.connection?.saveData),
    cookies_enabled: nav.cookieEnabled,
    webdriver: Boolean((nav as Navigator & { webdriver?: boolean }).webdriver),
  };
}

export function currentDeviceType(): string {
  if (typeof window === "undefined") return "";
  return window.innerWidth < 768 ? "mobile" : "desktop";
}

/** Skrócony page_slug pod kolumnę VARCHAR(120) w CRM - pełny adres idzie
 * w meta.page_url tam, gdzie ma znaczenie (session_start, page_view). */
export function currentPageSlug(): string {
  if (typeof window === "undefined") return "";
  return (window.location.pathname + window.location.search).slice(0, 120);
}
