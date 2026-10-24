"use client";

/**
 * Własny czat KEIKA (24.10.2026) zamiast Crispa.
 *
 * Właściciel: klient po pytaniu dostaje odpowiedź AI, ale ma wyraźny przycisk
 * „Chcę porozmawiać z człowiekiem”; rozmowy prowadzimy w CRM (zakładka Czat)
 * i w aplikacji na Androida. Crisp zostaje, dopóki test nie przejdzie.
 *
 * Który czat się otwiera:
 *  - ?czat=nowy  -> zawsze własny czat w tej przeglądarce (test), zapamiętane,
 *  - ?czat=crisp -> kasuje wymuszenie (wraca ustawienie z CRM),
 *  - inaczej decyduje przełącznik w CRM (GET live_chat.php -> mode: own|crisp);
 *    od 24.10.2026 właściciel: „przełącz czat na nasz, wyłącz Crisp” - domyślnie own,
 *    Crisp tylko gdy CRM wprost zwróci crisp (awaryjny powrót z zakładki Czat).
 * Backend: CRM views/biuro/api/shop-public/live_chat.php + core/lib/live_chat.php.
 */

import { getSessionToken, getVisitorId } from "@/lib/analytics-context";

export const LIVE_CHAT_API = "https://crm-keika.groovemedia.pl/views/biuro/api/shop-public/live_chat.php";
const FORCE_KEY = "keika_chat_force";
const MODE_CACHE_KEY = "keika_chat_mode";
const MODE_CACHE_MS = 5 * 60 * 1000;
export const LIVE_CHAT_TOKEN_KEY = "keika_live_chat_token";
export const LIVE_CHAT_OPEN_EVENT = "keika:live-chat-open";

export type ChatMode = "own" | "crisp";

/** Propozycja tkaniny z doradcy kolorów (CRM: core/lib/chat_assistant_vision.php). */
export type LiveChatColorItem = {
  role: string;
  swatchId: string;
  groupId: string;
  groupLabel: string;
  label: string;
  color: string;
  image: string;
  why: string;
};

export type LiveChatCard =
  | {
      type: "colors";
      product: string;
      mood: string;
      items: LiveChatColorItem[];
      hardware?: { id: string; label: string; color: string; why: string } | null;
    }
  | { type: "plate"; brand: string; model: string; query: string; confident: boolean };

export type LiveChatMessage = {
  id: number;
  from: "customer" | "bot" | "staff";
  text: string;
  name?: string;
  image?: string;
  at?: string;
  pending?: boolean;
  card?: LiveChatCard | null;
};

/** Co klient chce zrobić zdjęciem: pokój (kolory), tabliczka okna dachowego, auto = niech AI rozpozna. */
export type LiveChatPhotoMode = "room" | "plate" | "auto";

export type LiveChatOpenOptions = {
  prefill?: string;
  /** Wyślij od razu tę wiadomość (np. odpowiedź z dymka asystenta). */
  send?: string;
  /** Otwórz wybór zdjęcia (musi być wywołane w kliknięciu klienta). */
  photo?: LiveChatPhotoMode;
};

export type LiveChatState = {
  status: string;
  human_active: boolean;
  waiting_human: boolean;
  wait_ms: number;
  has_contact: boolean;
};

export type LiveChatPayload = {
  ok: boolean;
  token?: string;
  messages?: LiveChatMessage[];
  state?: LiveChatState;
  greeting?: string;
  error?: string;
};

let modePromise: Promise<ChatMode> | null = null;

/** Wymuszenie z adresu (?czat=nowy / ?czat=crisp), zapamiętane w przeglądarce. */
function forcedMode(): ChatMode | null {
  try {
    const param = new URLSearchParams(window.location.search).get("czat");
    if (param === "nowy" || param === "own") window.localStorage.setItem(FORCE_KEY, "own");
    if (param === "crisp") window.localStorage.removeItem(FORCE_KEY);
    return window.localStorage.getItem(FORCE_KEY) === "own" ? "own" : null;
  } catch {
    return null;
  }
}

/** Ktoś już rozmawia na nowym czacie - zostaje przy nim, nawet gdy CRM wróci do Crispa. */
function hasLiveConversation(): boolean {
  try {
    return /^live-[a-f0-9]{32}$/.test(window.localStorage.getItem(LIVE_CHAT_TOKEN_KEY) || "");
  } catch {
    return false;
  }
}

export function resolveChatMode(): Promise<ChatMode> {
  if (typeof window === "undefined") return Promise.resolve("crisp");
  const forced = forcedMode();
  if (forced) return Promise.resolve(forced);
  if (hasLiveConversation()) return Promise.resolve("own");
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(MODE_CACHE_KEY) || "null") as { mode?: ChatMode; at?: number } | null;
    if (cached?.mode && Date.now() - Number(cached.at || 0) < MODE_CACHE_MS) return Promise.resolve(cached.mode);
  } catch {
    // brak pamięci podręcznej - pytamy CRM
  }
  if (!modePromise) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 2500);
    modePromise = fetch(LIVE_CHAT_API, { method: "GET", signal: controller.signal })
      .then((res) => res.json() as Promise<{ ok?: boolean; mode?: string }>)
      .then((data) => {
        const mode: ChatMode = data?.mode === "crisp" ? "crisp" : "own";
        try {
          window.sessionStorage.setItem(MODE_CACHE_KEY, JSON.stringify({ mode, at: Date.now() }));
        } catch {
          // nic do zrobienia
        }
        return mode;
      })
      // CRM nie odpowiada - i tak nasz czat (od 24.10 Crisp wyłączony; okienko pokaże błąd połączenia).
      .catch((): ChatMode => "own")
      .finally(() => {
        window.clearTimeout(timer);
        modePromise = null;
      });
  }
  return modePromise;
}

/** Otwiera okienko własnego czatu (app/components/live-chat.tsx słucha zdarzenia). */
export function openLiveChat(prefill?: string, options?: Omit<LiveChatOpenOptions, "prefill">): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<LiveChatOpenOptions>(LIVE_CHAT_OPEN_EVENT, { detail: { prefill: prefill || "", ...(options || {}) } }));
}

export function readLiveChatToken(): string {
  try {
    return window.localStorage.getItem(LIVE_CHAT_TOKEN_KEY) || "";
  } catch {
    return "";
  }
}

export function saveLiveChatToken(token: string): void {
  try {
    window.localStorage.setItem(LIVE_CHAT_TOKEN_KEY, token);
  } catch {
    // tryb prywatny - rozmowa przetrwa tylko do przeładowania
  }
}

async function post(body: Record<string, unknown>): Promise<LiveChatPayload> {
  const res = await fetch(LIVE_CHAT_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({ ok: false, error: "Błąd połączenia." }))) as LiveChatPayload;
  if (!res.ok && data.ok !== false) data.ok = false;
  return data;
}

export function liveChatStart(site: string): Promise<LiveChatPayload> {
  return post({
    action: "start",
    site,
    token: readLiveChatToken(),
    visitor_id: getVisitorId(),
    shop_session: getSessionToken(),
    page_url: window.location.href,
  });
}

export function liveChatSend(token: string, text: string, context: string, after: number): Promise<LiveChatPayload> {
  return post({ action: "send", token, text, context, after, shop_session: getSessionToken(), page_url: window.location.href });
}

export function liveChatPoll(token: string, after: number): Promise<LiveChatPayload> {
  return post({ action: "poll", token, after });
}

export function liveChatHuman(token: string, after: number): Promise<LiveChatPayload> {
  return post({ action: "human", token, after });
}

/** Mądry asystent: AI ogląda ostatnie zdjęcie klienta (pokój -> 3 tkaniny, tabliczka -> model okna). */
export function liveChatAdvise(token: string, kind: LiveChatPhotoMode, product: string, after: number): Promise<LiveChatPayload> {
  return post({ action: "advise", token, kind, product, after, page_url: window.location.href });
}

export async function liveChatUpload(token: string, file: File, after: number): Promise<LiveChatPayload> {
  const form = new FormData();
  form.append("action", "upload");
  form.append("token", token);
  form.append("after", String(after));
  form.append("file", file);
  const res = await fetch(LIVE_CHAT_API, { method: "POST", body: form });
  return (await res.json().catch(() => ({ ok: false, error: "Nie udało się wysłać zdjęcia." }))) as LiveChatPayload;
}
