/**
 * Zgoda na marketing (oferty e-mailem/SMS-em) - od 2026-09-28 pytamy o nią
 * RAZ, w pasku o ciasteczkach, a nie w checkoucie.
 *
 * Dlaczego: checkout przez jeden dzień miał akordeon "Akceptuję regulaminy i
 * zgody" z wymaganym regulaminem i dwiema opcjonalnymi zgodami - konwersja
 * mocno spadła (właściciel, 2026-09-28). W koszyku został sam regulamin, a
 * pytanie o marketing przeniosło się tam, gdzie klient i tak klika zgodę:
 * do paska cookies. Wynik dopinamy do zamówienia, więc CRM dalej wie, kto
 * zgodził się na oferty.
 */

const KEY = "keika-marketing-consent";
const VERSION = 1;

export type MarketingConsent = {
  /** Zgoda na oferty e-mailem i SMS-em (jedno pytanie, oba kanały). */
  accepted: boolean;
  /** Kiedy klient podjął decyzję (ISO) - do dowodu zgody. */
  decidedAt: string;
  /** Gdzie padło pytanie - dziś zawsze pasek cookies. */
  source: string;
  version: number;
};

export function readMarketingConsent(): MarketingConsent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MarketingConsent;
    return parsed && typeof parsed.accepted === "boolean" ? parsed : null;
  } catch {
    return null;
  }
}

export function saveMarketingConsent(accepted: boolean, source = "cookie_bar"): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      KEY,
      JSON.stringify({ accepted, decidedAt: new Date().toISOString(), source, version: VERSION } satisfies MarketingConsent),
    );
  } catch {
    // localStorage zablokowany - zgoda po prostu nie przejdzie do zamówienia.
  }
}
