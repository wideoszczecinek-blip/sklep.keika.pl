// Polecenie kontrahenta (program partnerski B2B, właściciel 25.11.2026).
//
// Kontrahent poleca sklep linkiem https://polecam.keika.pl/<skrót> (tam serwer CRM
// zapisuje wejście, ustawia ciasteczko keika_partner na .keika.pl i przenosi tutaj
// z ?ref=<skrót>&rz=link|qr) albo kodem wpisanym w koszyku (kod = skrót).
// Klient z polecenia dostaje DODATKOWY rabat (domyślnie 3 %) liczony na samym końcu,
// po CAŁY DOM, kodzie i dodatkowych 5 % - koszyk pokazuje go jako „Rabat z polecenia”
// i wysyła w wycenie pozycję "rabat-polecenie" (app/koszyk/page.tsx). Ta pozycja jest
// też nośnikiem przypisania zamówienia do kontrahenta. Kwotę wiążąco liczy CRM
// (partner_referral_reapply_to_quote_input w partner/inc/lib/partner_program.php).
//
// Zapis: localStorage (pełne dane po sprawdzeniu w CRM) + ciasteczko (przeglądarka
// Facebooka potrafi blokować localStorage). Okno polecenia: 30 dni od ostatniego
// wejścia z linku albo wpisania kodu. Kod wygrywa z linkiem.

import { isOknowoHost } from "@/lib/welcome-offer";

export const PARTNER_REF_EVENT = "keika:partner-ref";
const STORAGE_KEY = "keika_partner_ref_v1";
const COOKIE_KEY = "keika_partner";
const WINDOW_MS = 30 * 24 * 60 * 60 * 1000;
const CHECK_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/partner_ref.php";

export type PartnerRefSource = "link" | "qr" | "kod";

export type PartnerRef = {
  /** Skrót kontrahenta (małe litery) - trafia do id pozycji wyceny. */
  slug: string;
  /** Kod do wpisania w koszyku (skrót wielkimi literami). */
  code: string;
  /** Nazwa firmy pokazywana klientowi. */
  name: string;
  /** Procent dodatkowego rabatu dla klienta. */
  percent: number;
  source: PartnerRefSource;
  expiresAtMs: number;
};

/** Dane kontrahenta z CRM (partner_ref.php, discount_code_check.php). */
export type PartnerRefCheck = { slug: string; code: string; name: string; percent: number };

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,28})[a-z0-9]$/;

export function normalizePartnerSlug(raw: string): string {
  const slug = String(raw || "").trim().toLowerCase();
  return SLUG_RE.test(slug) && !slug.includes("--") ? slug : "";
}

function normalizeSource(raw: string): PartnerRefSource {
  return raw === "qr" || raw === "kod" ? raw : "link";
}

function readCookie(): { slug: string; source: PartnerRefSource } | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )keika_partner=([^;]*)/);
  if (!match) return null;
  const [slugRaw, sourceRaw = ""] = decodeURIComponent(match[1]).split(".");
  const slug = normalizePartnerSlug(slugRaw);
  return slug ? { slug, source: normalizeSource(sourceRaw) } : null;
}

function writeCookie(slug: string, source: PartnerRefSource): void {
  if (typeof document === "undefined") return;
  const domain = window.location.hostname.endsWith(".keika.pl") ? "; domain=.keika.pl" : "";
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  const value = slug ? encodeURIComponent(`${slug}.${source}`) : "";
  document.cookie = `${COOKIE_KEY}=${value}; path=/; max-age=${slug ? Math.round(WINDOW_MS / 1000) : 0}; SameSite=Lax${domain}${secure}`;
}

function emit(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PARTNER_REF_EVENT));
}

/** Zapamiętane i sprawdzone polecenie; po terminie albo w Oknowo - null. */
export function getPartnerRef(): PartnerRef | null {
  if (typeof window === "undefined" || isOknowoHost()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PartnerRef>;
    const slug = normalizePartnerSlug(String(parsed.slug || ""));
    const percent = Number(parsed.percent);
    const expiresAtMs = Number(parsed.expiresAtMs);
    if (!slug || !Number.isFinite(percent) || percent < 0 || percent > 15 || !Number.isFinite(expiresAtMs)) return null;
    if (expiresAtMs <= Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      slug,
      code: String(parsed.code || slug.toUpperCase()),
      name: String(parsed.name || ""),
      percent,
      source: normalizeSource(String(parsed.source || "")),
      expiresAtMs,
    };
  } catch {
    return null;
  }
}

function store(check: PartnerRefCheck, source: PartnerRefSource, expiresAtMs: number): PartnerRef | null {
  const slug = normalizePartnerSlug(check.slug);
  if (!slug) return null;
  const ref: PartnerRef = {
    slug,
    code: String(check.code || slug.toUpperCase()),
    name: String(check.name || ""),
    percent: Math.max(0, Math.min(15, Number(check.percent) || 0)),
    source,
    expiresAtMs,
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ref));
  } catch {
    // localStorage zablokowany - zostaje ciasteczko, koszyk sprawdzi je przy wejściu.
  }
  writeCookie(slug, source);
  emit();
  return ref;
}

export function clearPartnerRef(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // nic
  }
  writeCookie("", "link");
  emit();
}

async function check(slug: string): Promise<PartnerRefCheck | null | "error"> {
  try {
    const response = await fetch(`${CHECK_URL}?ref=${encodeURIComponent(slug)}`, { cache: "no-store" });
    if (response.status >= 500) return "error";
    const json = (await response.json()) as { ok: boolean; partner?: PartnerRefCheck | null };
    return json.ok && json.partner ? json.partner : null;
  } catch {
    return "error";
  }
}

/** Kod polecenia wpisany w koszyku i potwierdzony przez CRM (discount_code_check.php). */
export function applyPartnerRefFromCode(partner: PartnerRefCheck): PartnerRef | null {
  if (typeof window === "undefined" || isOknowoHost()) return null;
  return store(partner, "kod", Date.now() + WINDOW_MS);
}

let captureStarted = false;

/**
 * Wołane raz na każdej stronie sklepu (app/components/partner-ref-capture.tsx):
 * łapie ?ref=<skrót> z adresu albo ciasteczko z polecam.keika.pl, sprawdza skrót w CRM
 * i zapisuje polecenie. Zapisane polecenie odświeża (kontrahent mógł zostać wyłączony,
 * procent zmieniony). Błąd sieci niczego nie kasuje.
 */
export async function capturePartnerRef(): Promise<void> {
  if (typeof window === "undefined" || captureStarted || isOknowoHost()) return;
  captureStarted = true;

  let fromUrl: { slug: string; source: PartnerRefSource } | null = null;
  try {
    const params = new URL(window.location.href).searchParams;
    const slug = normalizePartnerSlug(params.get("ref") || "");
    if (slug) fromUrl = { slug, source: normalizeSource(params.get("rz") || "") };
  } catch {
    fromUrl = null;
  }
  const stored = getPartnerRef();
  const fromCookie = readCookie();

  // Kod wpisany przez klienta wygrywa z późniejszym linkiem innego kontrahenta.
  const keepStoredCode = Boolean(stored && stored.source === "kod" && fromUrl && fromUrl.slug !== stored.slug);
  const candidate = fromUrl && !keepStoredCode ? fromUrl : !stored ? fromCookie : null;

  if (candidate) {
    const result = await check(candidate.slug);
    if (result === "error") return;
    if (result) {
      store(result, candidate.source, Date.now() + WINDOW_MS);
    } else if (stored && stored.slug === candidate.slug) {
      clearPartnerRef();
    }
    return;
  }

  if (stored) {
    const result = await check(stored.slug);
    if (result === "error") return;
    if (!result) {
      clearPartnerRef();
    } else if (result.percent !== stored.percent || result.name !== stored.name) {
      store(result, stored.source, stored.expiresAtMs);
    }
  }
}

/** „3” / „2,5” - procent do etykiet. */
export function formatPartnerPercent(percent: number): string {
  return percent.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
}
