"use client";

/**
 * Automatyczny konsultant czatu Crisp (właściciel, 2026-10-22).
 *
 * Przeglądarka klienta jest tu „rękami”: łapie wiadomość wysłaną w czacie,
 * pyta CRM o odpowiedź (core/lib/chat_bot.php - wiedza, ceny, status
 * zamówienia, decyzja „potrzebny człowiek”) i pokazuje ją w okienku czatu.
 * Gdy sprawa wymaga człowieka, CRM wysyła właścicielowi mail i powiadomienie,
 * a tutaj liczymy czas oczekiwania (domyślnie 4 min): jeśli w tym czasie
 * konsultant odpisze w Crispie - bot milknie; jeśli nie - CRM pisze klientowi,
 * że się skontaktujemy (i prosi o telefon/e-mail, gdy go nie ma).
 *
 * Ten sam plik jest w sklepie (lib/chat-bot.ts) i na keika.pl
 * (src/lib/chat-bot.ts) - zdarzenia Crispa podaje wywołujący, bo w sklepie
 * muszą iść przez lib/crisp-events.ts (Crisp trzyma jedną funkcję na zdarzenie).
 *
 * Dostarczanie odpowiedzi (2026-10-22, wieczór): CRM mówi w każdej odpowiedzi,
 * kto pokazuje tekst klientowi - pole `delivery`:
 *   "crisp_api" - CRM wysłał odpowiedź do rozmowy przez REST API Crispa jako
 *                 operator „Asystent KEIKA” (widać ją w panelu Crispa, dochodzi
 *                 też po zamknięciu karty) - przeglądarka NIE pokazuje jej sama,
 *   "local"     - brak tokenu albo błąd API - pokazujemy lokalnie (message:show,
 *                 tylko u klienta). Sprawdzane przy KAŻDEJ odpowiedzi, bo przy
 *                 błędzie API pojedyncza odpowiedź może wrócić jako "local".
 */

const API = "https://crm-keika.groovemedia.pl/views/biuro/api/shop-public/chat_bot.php";
const CONFIG_CACHE_KEY = "keika_chat_bot_cfg";
const HUMAN_KEY = "keika_chat_bot_human_at";
const HUMAN_QUIET_MS = 30 * 60 * 1000;
/** Klient często pisze w kilku wiadomościach - czekamy chwilę i wysyłamy razem. */
const DEBOUNCE_MS = 1500;
/** Podpis operatora, pod którym CRM wysyła odpowiedzi bota przez API Crispa
 * (CRM podaje go w GET i w każdej odpowiedzi jako `bot_nickname`). */
let botNickname = "Asystent KEIKA";

type CrispApi = unknown[] & { get?: (key: string) => unknown };
type CrispWindow = Window & { $crisp?: CrispApi };
type On = (event: string, listener: (...args: unknown[]) => void) => void;

type BotResponse = {
  ok?: boolean;
  enabled?: boolean;
  reply?: string | null;
  status?: string;
  wait_ms?: number;
  human_active?: boolean;
  contact_email?: string;
  contact_phone?: string;
  /** Kto pokazuje odpowiedź klientowi: CRM przez API Crispa albo przeglądarka. */
  delivery?: "crisp_api" | "local";
  /** action=human: tekst był echem naszej własnej odpowiedzi, nie człowiekiem. */
  own_reply?: boolean;
  /** Podpis bota w Crispie - z konfiguracji CRM. */
  bot_nickname?: string;
};

function rememberNickname(data: { bot_nickname?: unknown } | null | undefined): void {
  if (data && typeof data.bot_nickname === "string" && data.bot_nickname.trim()) botNickname = data.bot_nickname.trim();
}

export type ChatBotOptions = {
  site: "sklep" | "www";
  on: On;
  /** Krótki opis tego, co klient ogląda (strona, produkt, koszyk). */
  context: () => string;
  /** Bot wyłączony albo CRM nieosiągalny - wywołujący włącza stary automat. */
  onUnavailable?: () => void;
};

let armed = false;
let sessionId = "";
let pending: string[] = [];
let debounceTimer: number | undefined;
let waitTimer: number | undefined;
let chain: Promise<unknown> = Promise.resolve();
/** Teksty, które bot sam pokazał - Crisp potrafi je odbić jako "message:received". */
const shownByBot = new Set<string>();
let opts: ChatBotOptions | null = null;

function crisp(): CrispApi | undefined {
  return (window as CrispWindow).$crisp;
}

function crispGet(key: string): string {
  const c = crisp();
  try {
    if (c && typeof c.get === "function") {
      const value = c.get(key);
      return typeof value === "string" ? value : "";
    }
  } catch {
    // Crisp jeszcze się nie załadował
  }
  return "";
}

function currentSessionId(): string {
  return sessionId || crispGet("session:identifier");
}

function humanRecently(): boolean {
  try {
    const at = Number(window.sessionStorage.getItem(HUMAN_KEY) || 0);
    return at > 0 && Date.now() - at < HUMAN_QUIET_MS;
  } catch {
    return false;
  }
}

function markHuman(): void {
  try {
    window.sessionStorage.setItem(HUMAN_KEY, String(Date.now()));
  } catch {
    // jw.
  }
}

async function post(body: Record<string, unknown>): Promise<BotResponse | null> {
  const id = currentSessionId();
  if (!id || !opts) return null;
  try {
    const res = await fetch(API, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: id,
        site: opts.site,
        page_url: window.location.href.split("#")[0].slice(0, 480),
        ...body,
      }),
    });
    if (!res.ok) return null;
    return (await res.json()) as BotResponse;
  } catch {
    return null;
  }
}

function show(text: string): void {
  const c = crisp();
  if (!c || !text) return;
  shownByBot.add(text.trim());
  c.push(["do", "message:show", ["text", text]]);
  // Konsultant w Crispie widzi odpowiedź bota jako zdarzenie w rozmowie
  // (wiadomość "message:show" jest tylko u klienta).
  try {
    c.push(["set", "session:event", [[["bot_odpowiedz", { tekst: text.slice(0, 240) }, "blue"]]]]);
  } catch {
    // zdarzenie to tylko podgląd
  }
}

/** Pokazuje odpowiedź bota, chyba że CRM już wysłał ją do rozmowy przez API
 * Crispa (wtedy przyjdzie jako zwykła wiadomość operatora). Tekst zapamiętujemy
 * w obu przypadkach, żeby echo w message:received nie uchodziło za człowieka. */
function deliver(data: BotResponse | null, allowLocal: boolean): void {
  const text = typeof data?.reply === "string" ? data.reply.trim() : "";
  if (!text) return;
  shownByBot.add(text);
  if (data?.delivery === "crisp_api") return;
  if (allowLocal) show(text);
}

function applyState(data: BotResponse | null): void {
  const c = crisp();
  if (!data || !c) return;
  rememberNickname(data);
  if (waitTimer !== undefined) {
    window.clearTimeout(waitTimer);
    waitTimer = undefined;
  }
  if (data.status === "waiting_human" && Number(data.wait_ms) > 0) {
    waitTimer = window.setTimeout(() => {
      waitTimer = undefined;
      chain = chain.then(async () => {
        if (humanRecently()) return;
        const res = await post({ action: "wait_expired" });
        deliver(res, true);
        applyState(res);
      });
    }, Number(data.wait_ms));
  }
  try {
    c.push(["set", "session:data", [[["bot_status", data.status === "waiting_human" ? "CZEKA NA CZŁOWIEKA" : data.status === "need_contact" ? "czeka na kontakt" : data.status === "contact_promised" ? "obiecany kontakt" : data.status === "human" ? "rozmawia konsultant" : "bot odpowiada"]]]]);
    if (data.status === "waiting_human") c.push(["set", "session:segments", [["czeka-na-czlowieka"]]]);
    if (data.contact_email && !crispGet("user:email")) c.push(["set", "user:email", [data.contact_email]]);
    if (data.contact_phone && !crispGet("user:phone")) c.push(["set", "user:phone", [data.contact_phone]]);
  } catch {
    // dane w panelu Crispa to dodatek
  }
}

function flush(): void {
  debounceTimer = undefined;
  const text = pending.join("\n").trim();
  pending = [];
  if (!text || !opts) return;
  const context = opts.context();
  chain = chain.then(async () => {
    const res = await post({
      action: "message",
      text,
      context,
      contact: { email: crispGet("user:email"), phone: crispGet("user:phone"), nickname: crispGet("user:nickname") },
    });
    if (!res) return;
    deliver(res, !humanRecently());
    applyState(res);
  });
}

function onCustomerMessage(message: unknown): void {
  const m = (message || {}) as { type?: string; content?: unknown };
  let text = "";
  if (m.type === "text" && typeof m.content === "string") text = m.content;
  else if (m.type === "file" || m.type === "animation" || m.type === "audio") text = "[Klient wysłał załącznik - zdjęcie lub plik]";
  else if (typeof m.content === "string") text = m.content;
  if (!text.trim()) return;
  pending.push(text.trim());
  if (debounceTimer !== undefined) window.clearTimeout(debounceTimer);
  debounceTimer = window.setTimeout(flush, DEBOUNCE_MS);
}

function onOperatorMessage(message: unknown): void {
  const m = (message || {}) as { content?: unknown; automated?: unknown; user?: { nickname?: unknown } };
  const text = typeof m.content === "string" ? m.content.trim() : "";
  // Odpowiedź bota wysłana przez CRM do Crispa wraca tu jako wiadomość
  // operatora „Asystent KEIKA” - to nie człowiek.
  const nickname = typeof m.user?.nickname === "string" ? m.user.nickname.trim() : "";
  if ((nickname !== "" && nickname === botNickname) || m.automated === true) return;
  // Echo naszej własnej odpowiedzi (pokazanej lokalnie albo przez API) - jw.
  if (text && shownByBot.has(text)) return;
  markHuman();
  if (waitTimer !== undefined) {
    window.clearTimeout(waitTimer);
    waitTimer = undefined;
  }
  chain = chain.then(() => post({ action: "human", text }));
}

export async function armChatBot(options: ChatBotOptions): Promise<void> {
  if (typeof window === "undefined" || armed) return;
  armed = true;
  opts = options;

  let enabled = false;
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(CONFIG_CACHE_KEY) || "null") as { at: number; enabled: boolean } | null;
    if (cached && Date.now() - cached.at < 5 * 60 * 1000) {
      enabled = cached.enabled;
    } else {
      const res = await fetch(API, { method: "GET" });
      const data = (await res.json()) as { enabled?: boolean; bot_nickname?: string };
      enabled = Boolean(data?.enabled);
      rememberNickname(data);
      window.sessionStorage.setItem(CONFIG_CACHE_KEY, JSON.stringify({ at: Date.now(), enabled }));
    }
  } catch {
    enabled = false;
  }
  if (!enabled) {
    options.onUnavailable?.();
    return;
  }

  options.on("session:loaded", (id) => {
    if (typeof id === "string" && id) sessionId = id;
    // Po przeładowaniu strony wracamy do licznika oczekiwania z CRM.
    chain = chain.then(async () => applyState(await post({ action: "state" })));
  });
  options.on("message:sent", onCustomerMessage);
  options.on("message:received", onOperatorMessage);
}
