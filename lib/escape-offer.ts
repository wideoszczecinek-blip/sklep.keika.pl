/**
 * "Dodatkowe 5% dla wychodzących z koszykiem" - test właściciela od 2026-10-03.
 *
 * Klient, który wychodzi ze sklepu z koszykiem (albo po wyjściu wraca), dostaje
 * dodatkowe 5% ważne 24 godziny. Moskitiery od 150 zł do zapłaty, plisy i
 * produkty dachowe przy każdej kwocie. Decyzję podejmuje CRM
 * (shop-public/escape_offer.php, core/lib/shop_escape_offer.php): losuje grupę
 * (połowa osób to grupa kontrolna - nic nie widzi, ale jest policzona), pilnuje
 * jednej oferty na osobę na 30 dni i terminu. Ten moduł tylko pyta, pamięta
 * odpowiedź i włącza rabat w koszyku.
 *
 * Sam rabat to istniejący "rabat ratunkowy" (lib/rescue.ts): pozycja
 * rabat-ratunek-<kod wyceny> liczona od tej samej podstawy co SEZON20, więc
 * razem wychodzi 25%. Koszyk umie ją liczyć i wysyłać od dawna - tu dochodzi
 * tylko termin (RescueGrant.expiresAtMs) i to, komu i kiedy ją dajemy.
 *
 * Kiedy pytamy (jeden raz - pierwsza decyzja zostaje na 30 dni):
 *  - cart_exit     kursor wyjeżdża poza stronę koszyka (komputer),
 *  - cart_bottom   klient przewinął koszyk do końca i nie tknął formularza
 *                  (telefon; z 71 takich sesji kupowała 1),
 *  - tab_return    powrót do karty po co najmniej 10 minutach,
 *  - return_visit  nowa wizyta z koszykiem starszym niż 30 minut,
 *  - rm_return     powrót z reklamy przypominającej (?wroc=1).
 * Nigdy po rozpoczęciu formularza i nigdy, gdy zamówienie jest już w toku.
 */

import { getSessionToken, getVisitorId } from "@/lib/analytics-context";
import { calcMoskitieryCombinedSavings, readCartItems, type CartLineItem } from "@/lib/cart";
import { PROMO_CODE, isPromoActive, readCachedPromoPreview } from "@/lib/promo";
import { buildRescuePosition, clearRescueGrant, setRescueGrant } from "@/lib/rescue";
import { trackShopStep } from "@/lib/track-step";

const ENDPOINT = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/escape_offer.php";
const STATE_KEY = "keika_escape_offer_v1";
const SESSION_CHECKED_KEY = "keika_escape_session_checked";
const SESSION_SYNCED_KEY = "keika_escape_synced";
/** Lustro ustawień CRM (moskitiery_min_zl, cooldown_days) - tylko po to, żeby
 * nie pytać serwera bez sensu. Rozstrzyga zawsze serwer. */
const MOSKITIERY_MIN_ZL = 150;
const STATE_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ESCAPE_RETURN_MIN_CART_AGE_MS = 30 * 60 * 1000;
export const ESCAPE_TAB_RETURN_MIN_HIDDEN_MS = 10 * 60 * 1000;

export const ESCAPE_OFFER_EVENT = "keika:escape-offer-changed";

export type EscapeTrigger = "cart_exit" | "cart_bottom" | "tab_return" | "return_visit" | "rm_return";

export type EscapeOfferState = {
  arm: "offer" | "control";
  status: "active" | "expired" | "used" | "control";
  percent: number;
  quoteCode: string;
  /** Termin przeliczony na zegar tej przeglądarki (serwer podaje też swój czas). */
  expiresAtMs: number;
  decidedAtMs: number;
  trigger: string;
};

function readState(): EscapeOfferState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STATE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EscapeOfferState;
    if (!parsed || (parsed.arm !== "offer" && parsed.arm !== "control")) return null;
    if (!parsed.decidedAtMs || Date.now() - parsed.decidedAtMs > STATE_TTL_MS) {
      window.localStorage.removeItem(STATE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function writeState(state: EscapeOfferState): void {
  try {
    window.localStorage.setItem(STATE_KEY, JSON.stringify(state));
  } catch {
    // brak localStorage - oferta żyje tylko w tej karcie (rabat i tak sprawdza CRM)
  }
  try {
    window.dispatchEvent(new Event(ESCAPE_OFFER_EVENT));
  } catch {
    // nic
  }
}

/** Decyzja zapamiętana na tym urządzeniu (dowolna grupa) albo null. */
export function getEscapeOfferState(): EscapeOfferState | null {
  return readState();
}

/** Oferta, z której klient może teraz skorzystać - albo null. Przy okazji
 * zamyka ofertę, której termin właśnie minął (jedno zdarzenie do analityki). */
export function getActiveEscapeOffer(): EscapeOfferState | null {
  const state = readState();
  if (!state || state.arm !== "offer" || state.status !== "active") return null;
  if (Date.now() >= state.expiresAtMs) {
    writeState({ ...state, status: "expired" });
    clearRescueGrant();
    trackShopStep("escape_offer_expired", state.trigger, { percent: state.percent }, state.quoteCode);
    return null;
  }
  return state;
}

/** Wartość koszyka tak, jak widzi ją klient: produkty po korekcie obwodu i
 * po promocji sezonowej, bez dostawy i dopłat. */
export function escapeCartValue(items: CartLineItem[]): number {
  const subtotal = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
  const base = Math.max(0, subtotal - calcMoskitieryCombinedSavings(items));
  const preview = isPromoActive() ? readCachedPromoPreview() : null;
  if (preview?.type === "percent") return Math.max(0, base * (1 - preview.value / 100));
  return base;
}

/** Wstępne sito po stronie sklepu (te same zasady co w CRM). */
export function isCartEligibleForEscapeOffer(items: CartLineItem[]): boolean {
  if (!items.length) return false;
  if (items.some((item) => item.productSlug && item.productSlug !== "moskitiery-ramkowe")) return true;
  return escapeCartValue(items) >= MOSKITIERY_MIN_ZL;
}

type ServerOffer = {
  arm?: string;
  status?: string;
  percent?: number;
  quote_code?: string;
  expires_at_ms?: number;
  server_now_ms?: number;
  cart_value?: number;
  fresh?: boolean;
};

function deviceLabel(): string {
  const width = window.innerWidth;
  return width < 768 ? "mobile" : width < 1100 ? "tablet" : "desktop";
}

async function callServer(body: Record<string, unknown>): Promise<ServerOffer | null> {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json()) as { ok?: boolean; offer?: ServerOffer };
  return json.ok && json.offer ? json.offer : null;
}

function applyServerOffer(offer: ServerOffer, trigger: string, previous: EscapeOfferState | null): EscapeOfferState | null {
  if (offer.arm !== "offer" && offer.arm !== "control") return null;
  const serverNow = Number(offer.server_now_ms) || Date.now();
  const skewMs = serverNow - Date.now();
  const status =
    offer.arm === "control"
      ? "control"
      : offer.status === "active" || offer.status === "expired" || offer.status === "used"
        ? offer.status
        : "expired";
  const state: EscapeOfferState = {
    arm: offer.arm,
    status,
    percent: Number(offer.percent) || 0,
    quoteCode: String(offer.quote_code || ""),
    expiresAtMs: (Number(offer.expires_at_ms) || 0) - skewMs,
    decidedAtMs: previous?.decidedAtMs || Date.now(),
    trigger: previous?.trigger || trigger,
  };
  if (state.arm === "offer" && state.status === "active" && state.quoteCode && state.percent > 0 && Date.now() < state.expiresAtMs) {
    setRescueGrant({ quoteCode: state.quoteCode, percent: state.percent, expiresAtMs: state.expiresAtMs, kind: "escape" });
  } else if (state.arm === "offer") {
    clearRescueGrant();
  }
  writeState(state);
  return state;
}

let inFlight: Promise<EscapeOfferState | null> | null = null;
let lastAskAt = 0;

/**
 * Pyta CRM o ofertę w chwili "wyjścia". Zwraca zapamiętaną decyzję, jeśli już
 * zapadła (drugi raz nie pytamy), albo null, gdy koszyk się nie kwalifikuje
 * lub coś poszło nie tak - błąd tutaj nigdy nie może zepsuć koszyka.
 */
export function requestEscapeOffer(trigger: EscapeTrigger, items: CartLineItem[] = readCartItems()): Promise<EscapeOfferState | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  const existing = readState();
  if (existing) return Promise.resolve(existing);
  if (!isCartEligibleForEscapeOffer(items)) return Promise.resolve(null);
  if (inFlight) return inFlight;
  if (Date.now() - lastAskAt < 20000) return Promise.resolve(null);
  lastAskAt = Date.now();

  inFlight = (async () => {
    try {
      const offer = await callServer({
        mode: "request",
        visitor_id: getVisitorId(),
        session_token: getSessionToken(),
        trigger,
        device: deviceLabel(),
        promo_code: isPromoActive() ? PROMO_CODE : "",
        positions: items.map((item) =>
          buildRescuePosition({
            id: item.id,
            productSlug: item.productSlug,
            productLabel: item.productLabel,
            hardwareLabel: item.hardwareLabel,
            meshLabel: item.meshLabel,
            widthMm: item.widthMm,
            heightMm: item.heightMm,
            qty: item.qty,
            total: item.total,
            modelLabel: item.modelLabel,
          }),
        ),
      });
      if (!offer) return null;
      const state = applyServerOffer(offer, trigger, null);
      if (state) {
        trackShopStep(
          "escape_offer",
          state.arm,
          { trigger, status: state.status, percent: state.percent, cart_value: Number(offer.cart_value) || escapeCartValue(items) },
          state.quoteCode || undefined,
        );
      }
      return state;
    } catch {
      return null;
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

/** Raz na wizytę sprawdza w CRM, czy zapamiętana oferta nadal obowiązuje
 * (wykorzystana w innej karcie, termin wg zegara serwera). */
export async function syncEscapeOfferWithServer(): Promise<void> {
  if (typeof window === "undefined") return;
  const state = readState();
  if (!state || state.arm !== "offer" || state.status !== "active") return;
  try {
    if (window.sessionStorage.getItem(SESSION_SYNCED_KEY)) return;
    window.sessionStorage.setItem(SESSION_SYNCED_KEY, "1");
  } catch {
    return;
  }
  try {
    const offer = await callServer({ mode: "status", visitor_id: getVisitorId(), session_token: getSessionToken() });
    if (offer && (offer.arm === "offer" || offer.arm === "control")) applyServerOffer(offer, state.trigger, state);
  } catch {
    // bez odpowiedzi zostaje stan lokalny - rabat i tak sprawdzi CRM przy zamówieniu
  }
}

/** Po złożeniu zamówienia: rabat jest jednorazowy, kolejny koszyk go nie ma. */
export function markEscapeOfferUsed(): void {
  const state = readState();
  if (!state || state.arm !== "offer" || state.status !== "active") return;
  writeState({ ...state, status: "used" });
  clearRescueGrant();
}

/** true tylko przy pierwszym sprawdzeniu w tej karcie i tylko gdy koszyk
 * powstał wcześniej niż 30 minut temu - czyli klient wyszedł i wrócił. */
export function isReturnVisitWithCart(items: CartLineItem[]): boolean {
  if (typeof window === "undefined") return false;
  try {
    if (window.sessionStorage.getItem(SESSION_CHECKED_KEY)) return false;
    window.sessionStorage.setItem(SESSION_CHECKED_KEY, "1");
  } catch {
    return false;
  }
  if (!items.length) return false;
  const oldest = items.reduce((min, item) => {
    const ts = Date.parse(item.createdAt);
    return Number.isFinite(ts) ? Math.min(min, ts) : min;
  }, Date.now());
  return Date.now() - oldest >= ESCAPE_RETURN_MIN_CART_AGE_MS;
}

// Wyjście kursorem poza stronę koszyka obsługują dwa mechanizmy: ta oferta
// i okno "koszyk na e-mail" (lib/cart-email-nudge.ts). Bramka ustala
// kolejność bez wiązania obu modułów ze sobą: koszyk rejestruje tu swoją
// obsługę, a okno e-mail pyta, czy wyjście zostało już obsłużone.
let cartExitGate: (() => Promise<boolean>) | null = null;

export function registerCartExitGate(gate: (() => Promise<boolean>) | null): void {
  cartExitGate = gate;
}

/** true = wyjście wzięła oferta 5% (okno "koszyk na e-mail" wtedy milczy).
 * Grupa kontrolna i koszyki poza zasadami dostają false - dla nich wszystko
 * działa jak przed testem. */
export function runCartExitGate(): Promise<boolean> {
  if (!cartExitGate) return Promise.resolve(false);
  try {
    return cartExitGate().catch(() => false);
  } catch {
    return Promise.resolve(false);
  }
}

const pad2 = (value: number) => String(value).padStart(2, "0");

/** "dziś do 22:15" / "jutro do 14:35" / "5.10 do 14:35". */
export function formatEscapeDeadline(expiresAtMs: number): string {
  const deadline = new Date(expiresAtMs);
  const time = `${deadline.getHours()}:${pad2(deadline.getMinutes())}`;
  const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startOfDay(deadline) - startOfDay(new Date())) / 86400000);
  if (days <= 0) return `dziś do ${time}`;
  if (days === 1) return `jutro do ${time}`;
  return `${deadline.getDate()}.${pad2(deadline.getMonth() + 1)} do ${time}`;
}
