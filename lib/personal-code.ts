// Kody osobiste klienta (23.10.2026): kod dla powracających WRACAM-XXXXXX
// (−30 % = SEZON20 + 10 %, 14 dni od doręczenia) i bon za opinię KEIKA-XXXXXX.
//
// Droga kodu: link z maila/SMS-a prowadzi na stronę produktu z ?kod=…
// (app/components/personal-code-capture.tsx zapisuje go tutaj), koszyk
// nalicza go sam zamiast SEZON20 (app/koszyk/page.tsx), a pasek u góry
// (app/components/promo-top-strip.tsx) pokazuje termin z odliczaniem.
// Termin, procent i opis przychodzą z CRM (discount_code_check.php:
// expires_at, personal, label) - nic nie jest tu zgadywane.
//
// Zapis: cookie (przeglądarka Facebooka potrafi blokować localStorage -
// patrz lib/promo.ts) + localStorage z pełnymi danymi.

export const PERSONAL_CODE_EVENT = "keika:personal-code";
const COOKIE_KEY = "keika_shop_personal_code";
const STORAGE_KEY = "keika_shop_personal_code_v1";
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

export type PersonalCode = {
  code: string;
  /** Procent rabatu (0, gdy jeszcze niesprawdzony w CRM). */
  percent: number;
  /** Koniec ważności w ms (null = jeszcze nieznany). */
  expiresAtMs: number | null;
  label: string;
  /** true po potwierdzeniu w CRM (kod istnieje, aktywny, niewykorzystany). */
  verified: boolean;
};

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{3,30}$/;

export function normalizePersonalCode(raw: string): string {
  const code = String(raw || "").trim().toUpperCase();
  return CODE_RE.test(code) ? code : "";
}

function readCookie(): string {
  if (typeof document === "undefined") return "";
  const match = document.cookie.match(/(?:^|; )keika_shop_personal_code=([^;]*)/);
  return match ? normalizePersonalCode(decodeURIComponent(match[1])) : "";
}

function writeCookie(code: string): void {
  if (typeof document === "undefined") return;
  document.cookie = `${COOKIE_KEY}=${encodeURIComponent(code)}; path=/; max-age=${code ? COOKIE_MAX_AGE_SECONDS : 0}; SameSite=Lax`;
}

function readStorage(): PersonalCode | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersonalCode>;
    const code = normalizePersonalCode(String(parsed.code || ""));
    if (!code) return null;
    return {
      code,
      percent: Number(parsed.percent) || 0,
      expiresAtMs: typeof parsed.expiresAtMs === "number" && Number.isFinite(parsed.expiresAtMs) ? parsed.expiresAtMs : null,
      label: String(parsed.label || ""),
      verified: Boolean(parsed.verified),
    };
  } catch {
    return null;
  }
}

function emit(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(PERSONAL_CODE_EVENT));
}

/** Zapamiętany kod osobisty (także niesprawdzony); wygasły = null. */
export function getPersonalCode(): PersonalCode | null {
  if (typeof window === "undefined") return null;
  const stored = readStorage();
  const cookieCode = readCookie();
  let current: PersonalCode | null = stored;
  if (!current && cookieCode) {
    current = { code: cookieCode, percent: 0, expiresAtMs: null, label: "", verified: false };
  }
  if (!current) return null;
  if (current.expiresAtMs !== null && current.expiresAtMs <= Date.now()) {
    clearPersonalCode();
    return null;
  }
  return current;
}

/** Kod do automatycznego naliczenia w koszyku (zamiast SEZON20) albo "". */
export function getPendingPersonalCode(): string {
  const current = getPersonalCode();
  return current ? current.code : "";
}

export function savePersonalCode(next: PersonalCode): void {
  if (typeof window === "undefined") return;
  const code = normalizePersonalCode(next.code);
  if (!code) return;
  writeCookie(code);
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...next, code }));
  } catch {
    // cookie powyżej i tak przenosi sam kod
  }
  emit();
}

export function clearPersonalCode(): void {
  if (typeof window === "undefined") return;
  writeCookie("");
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // jw.
  }
  emit();
}

/** Odpowiedź discount_code_check.php - wspólny kształt dla koszyka i paska. */
export type PersonalCodeCheck = {
  code: string;
  value: number;
  type?: "percent" | "amount";
  expires_at?: string | null;
  personal?: boolean;
  label?: string;
};

/** Po udanym sprawdzeniu kodu w CRM: zapamiętaj (gdy osobisty) albo wyczyść
 * (gdy to zwykły kod, np. SEZON20, który klient wpisał zamiast osobistego). */
export function rememberCheckedCode(discount: PersonalCodeCheck): void {
  const code = normalizePersonalCode(discount.code);
  if (!code) return;
  if (!discount.personal) {
    const current = getPersonalCode();
    if (current && current.code === code) clearPersonalCode();
    return;
  }
  const expiresAtMs = discount.expires_at ? Date.parse(discount.expires_at) : NaN;
  savePersonalCode({
    code,
    percent: discount.type === "amount" ? 0 : Number(discount.value) || 0,
    expiresAtMs: Number.isFinite(expiresAtMs) ? expiresAtMs : null,
    label: String(discount.label || ""),
    verified: true,
  });
}

/** Kod z adresu (?kod=…) - zapis i sprawdzenie w CRM (termin, procent). */
export async function capturePersonalCodeFromUrl(): Promise<void> {
  if (typeof window === "undefined") return;
  let code = "";
  try {
    code = normalizePersonalCode(new URL(window.location.href).searchParams.get("kod") || "");
  } catch {
    code = "";
  }
  if (!code) return;
  const current = getPersonalCode();
  if (!current || current.code !== code) {
    savePersonalCode({ code, percent: 0, expiresAtMs: null, label: "", verified: false });
  } else if (current.verified) {
    return;
  }
  await verifyPersonalCode(code);
}

/** Sprawdza kod w CRM (bez koszyka - subtotal 0); nieważny = wyczyszczony. */
export async function verifyPersonalCode(code: string): Promise<PersonalCode | null> {
  try {
    const response = await fetch("https://crm-keika.groovemedia.pl/biuro/api/shop-public/discount_code_check.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code, subtotal: 0 }),
    });
    const json = (await response.json()) as { ok: boolean; discount?: PersonalCodeCheck; error?: string };
    if (!json.ok || !json.discount) {
      // Kod nieważny / zużyty - nie trzymamy go, żeby nie blokował SEZON20.
      const current = getPersonalCode();
      if (current && current.code === code) clearPersonalCode();
      return null;
    }
    rememberCheckedCode(json.discount);
    return getPersonalCode();
  } catch {
    // CRM chwilowo nie odpowiada - zostawiamy kod, koszyk sprawdzi go sam.
    return getPersonalCode();
  }
}

/** "4 dni 6 godz." / "6 godz. 12 min" / "12 min" - do paska. */
export function formatPersonalCodeRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days} ${days === 1 ? "dzień" : "dni"} ${hours} godz.`;
  if (hours > 0) return `${hours} godz. ${minutes} min`;
  return `${minutes} min`;
}

export function formatPersonalCodeDate(ms: number): string {
  const date = new Date(ms);
  return `${date.getDate()}.${String(date.getMonth() + 1).padStart(2, "0")}`;
}
