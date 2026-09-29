"use client";

/**
 * Automat na długie oczekiwanie w czacie (właściciel, 2026-09-29; dwa etapy
 * i okno ciszy od 2026-09-30).
 *
 * Klient pisze na czacie i czeka:
 *   po 1 minucie  - uprzedzamy, że dziś czeka się dłużej (sama informacja,
 *                   niczego od niego nie chcemy),
 *   po 3 minutach - prosimy o kontakt, żeby rozmowa nie skończyła się ciszą,
 *                   nawet jeśli klient zamknie stronę.
 *
 * Kiedy automat MILCZY: jeśli konsultant odpowiedział niedawno (do 15 minut
 * wstecz), kolejna wiadomość klienta niczego nie uruchamia - rozmowa toczy
 * się na żywo i bot nie ma się po co wtrącać. Dopiero gdy od odpowiedzi
 * minęło więcej niż 15 minut, traktujemy to jak nowe podejście do tematu i
 * automat rusza od początku.
 *
 * Odpowiedź konsultanta kasuje odliczanie i zeruje oba etapy, więc przy tym
 * nowym podejściu komunikaty mogą pojawić się ponownie. W obrębie jednej fali
 * każdy etap pokazuje się tylko raz.
 */

const WAITING_MS = 60 * 1000;
const CONTACT_MS = 3 * 60 * 1000;
/** Jak świeża musi być odpowiedź konsultanta, żeby automat się nie odzywał. */
const QUIET_AFTER_REPLY_MS = 15 * 60 * 1000;

const STAGE_KEYS = {
  waiting: "keika_chat_wait_notice",
  contact: "keika_chat_wait_prompt",
} as const;
const LAST_REPLY_KEY = "keika_chat_last_reply";

const STAGE_MESSAGES = {
  waiting: "Twój czat nadal czeka na konsultanta, ale w tej chwili czas oczekiwania jest wydłużony.",
  contact:
    "Ups, trwa to trochę dłużej — zostaw namiary do siebie, a odpowiemy najszybciej, jak to możliwe. Wystarczy adres e-mail albo numer telefonu.",
} as const;

type Stage = keyof typeof STAGE_KEYS;
type CrispWindow = Window & { $crisp?: unknown[] };

let armed = false;
const timers: Partial<Record<Stage, number>> = {};

function readFlag(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeFlag(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // sessionStorage zablokowany - automat dalej działa, po prostu nie
    // pamięta stanu między odświeżeniami strony.
  }
}

function dropFlag(key: string): void {
  try {
    window.sessionStorage.removeItem(key);
  } catch {
    // jw.
  }
}

function alreadyShown(stage: Stage): boolean {
  return readFlag(STAGE_KEYS[stage]) === "1";
}

function clearTimers(): void {
  for (const stage of Object.keys(timers) as Stage[]) {
    const id = timers[stage];
    if (id !== undefined) window.clearTimeout(id);
    delete timers[stage];
  }
}

function showStage(stage: Stage): void {
  const w = window as CrispWindow;
  if (!w.$crisp || alreadyShown(stage)) return;
  writeFlag(STAGE_KEYS[stage], "1");
  // "message:show" wstawia wiadomość do okna czatu tak, jakby napisał ją
  // konsultant - klient widzi ją od razu, bez czekania na kogokolwiek.
  w.$crisp.push(["do", "message:show", ["text", STAGE_MESSAGES[stage]]]);
  void import("@/lib/track-step")
    .then(({ trackShopStep }) => trackShopStep("chat_wait_prompt", stage === "waiting" ? "1min" : "3min"))
    .catch(() => null);
}

/** Czy konsultant odpowiedział na tyle niedawno, że automat ma milczeć. */
function replyIsFresh(): boolean {
  const raw = readFlag(LAST_REPLY_KEY);
  if (!raw) return false;
  const at = Number(raw);
  if (!Number.isFinite(at) || at <= 0) return false;
  return Date.now() - at <= QUIET_AFTER_REPLY_MS;
}

function onCustomerMessage(): void {
  clearTimers();
  // Rozmowa na żywo - konsultant odpisał przed chwilą, więc nie wtrącamy się.
  if (replyIsFresh()) return;
  const plan: Array<[Stage, number]> = [
    ["waiting", WAITING_MS],
    ["contact", CONTACT_MS],
  ];
  for (const [stage, delay] of plan) {
    if (alreadyShown(stage)) continue;
    timers[stage] = window.setTimeout(() => {
      delete timers[stage];
      showStage(stage);
    }, delay);
  }
}

function onConsultantReply(): void {
  clearTimers();
  writeFlag(LAST_REPLY_KEY, String(Date.now()));
  // Nowa fala rozmowy zaczyna się z czystym kontem: gdy klient wróci do
  // tematu po dłuższej przerwie, komunikaty mogą pojawić się ponownie.
  dropFlag(STAGE_KEYS.waiting);
  dropFlag(STAGE_KEYS.contact);
}

/** Podpina automat pod czat. Wywoływane przy otwarciu czatu - Crisp odtwarza
 * zakolejkowane "on" po załadowaniu widgetu, więc kolejność nie ma znaczenia. */
export function armChatFollowUp(): void {
  if (typeof window === "undefined" || armed) return;
  armed = true;
  const w = window as CrispWindow;
  w.$crisp = w.$crisp || [];
  w.$crisp.push(["on", "message:sent", onCustomerMessage]);
  w.$crisp.push(["on", "message:received", onConsultantReply]);
  // Zamknięcie okna nie przerywa odliczania: klient może wrócić, a jeśli nie,
  // i tak lepiej, żeby po powrocie zastał prośbę o kontakt.
}

/** Tylko do testów. */
export const CHAT_WAIT_STAGES_MS = { waiting: WAITING_MS, contact: CONTACT_MS, quietAfterReply: QUIET_AFTER_REPLY_MS };
