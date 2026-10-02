"use client";

/**
 * Powiązanie rozmowy na Crispie z konkretnym odwiedzającym w CRM
 * (właściciel, 2026-10-02: "chcę w tooltipie i w odwiedzających widzieć,
 * z którym klientem czatuję przez Crisp").
 *
 * Most działa w obie strony, bo każda z nich sama w sobie zostawia robotę:
 *
 *   sklep -> CRM:  identyfikator sesji Crispa leci do analityki, więc lista
 *                  "Odwiedzający" i tooltip "osoby online" mogą napisać
 *                  wprost, KTÓRY wiersz to rozmowa, którą właśnie widać
 *                  w panelu Crispa. Dodatkowo meldujemy każdą wiadomość,
 *                  żeby odróżnić "kiedyś otworzył czat" od "pisze TERAZ".
 *
 *   sklep -> Crisp: do rozmowy dokładamy kontekst klienta (co konfiguruje,
 *                  ile ma w koszyku, która to wizyta, token sesji). Dzięki
 *                  temu w samym Crispie od razu widać, z kim się rozmawia,
 *                  bez przeskakiwania do CRM-u.
 *
 * Wszystko jest best-effort: czat nie może się wywrócić przez analitykę.
 */

type CrispWindow = Window & { $crisp?: unknown[] };

let armed = false;
let lastReportedId = "";

function sessionToken(): string {
  try {
    return window.sessionStorage.getItem("keika_shop_session_token") || "";
  } catch {
    return "";
  }
}

function track(event: string, label: string, meta: Record<string, string | number | boolean | null>): void {
  void import("@/lib/track-step")
    .then(({ trackShopStep }) => trackShopStep(event, label, meta))
    .catch(() => null);
}

/** Identyfikator rozmowy do CRM - raz na sesję, przy kolejnych zmianach tylko
 * gdy faktycznie się zmienił. */
function reportSession(crispId: string): void {
  const id = String(crispId || "").trim();
  if (!id || id === lastReportedId) return;
  lastReportedId = id;
  track("chat_session", id.slice(0, 64), { crisp_session_id: id, shop_session: sessionToken() });
}

/** Krótki opis koszyka do panelu Crispa - bez danych osobowych, tylko to,
 * co pomaga obsłudze zrozumieć, o czym rozmawia. */
function cartSummary(): { positions: number; total: number } {
  try {
    const raw = window.localStorage.getItem("keika_cart");
    if (!raw) return { positions: 0, total: 0 };
    const parsed = JSON.parse(raw) as { items?: Array<{ total?: number }> };
    const items = Array.isArray(parsed.items) ? parsed.items : [];
    const total = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    return { positions: items.length, total: Math.round(total * 100) / 100 };
  } catch {
    return { positions: 0, total: 0 };
  }
}

function currentProduct(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("produkt");
    if (fromQuery) return fromQuery;
    const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
    return path || "strona główna";
  } catch {
    return "";
  }
}

/** Kontekst klienta widoczny w panelu Crispa przy rozmowie. */
function pushContext(): void {
  const w = window as CrispWindow;
  if (!w.$crisp) return;
  const cart = cartSummary();
  const token = sessionToken();
  const rows: Array<[string, string]> = [
    ["Ogląda", currentProduct() || "—"],
    ["Koszyk", cart.positions > 0 ? `${cart.positions} poz. · ${cart.total.toFixed(2)} zł` : "pusty"],
  ];
  if (token) {
    rows.push(["Sesja w CRM", token.slice(0, 24)]);
  }
  try {
    w.$crisp.push(["set", "session:data", [rows]]);
  } catch {
    // dane kontekstowe to dodatek - brak nie może przerwać rozmowy
  }
}

/** Podpina most. Wywoływane przy otwarciu czatu, obok armChatFollowUp(). */
export function armChatIdentity(): void {
  if (typeof window === "undefined" || armed) return;
  armed = true;
  const w = window as CrispWindow;
  w.$crisp = w.$crisp || [];

  // Crisp woła to z identyfikatorem sesji - ten sam, który obsługa widzi
  // przy rozmowie w swoim panelu.
  w.$crisp.push([
    "on",
    "session:loaded",
    (id: string) => {
      reportSession(id);
      pushContext();
    },
  ]);

  // "Pisze TERAZ" to coś innego niż "kiedyś kliknął w dymek" - meldujemy
  // każdą wiadomość, żeby CRM mógł pokazać świeżość rozmowy.
  w.$crisp.push([
    "on",
    "message:sent",
    () => {
      track("chat_message", "od klienta", { crisp_session_id: lastReportedId, from: "customer" });
      pushContext();
    },
  ]);
  w.$crisp.push([
    "on",
    "message:received",
    () => {
      track("chat_message", "od nas", { crisp_session_id: lastReportedId, from: "operator" });
    },
  ]);

  // Gdyby zdarzenie session:loaded już przeszło, zanim się podpięliśmy.
  try {
    const live = w.$crisp as unknown as { get?: (key: string) => unknown };
    if (typeof live.get === "function") {
      const id = live.get("session:identifier");
      if (typeof id === "string") {
        reportSession(id);
        pushContext();
      }
    }
  } catch {
    // jw.
  }
}
