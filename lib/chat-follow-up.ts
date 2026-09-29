"use client";

/**
 * Automat na długie oczekiwanie w czacie (właściciel, 2026-09-29, dwa etapy
 * od 2026-09-30).
 *
 * Klient pisze na czacie i czeka:
 *   po 1 minucie  - uprzedzamy, że dziś czeka się dłużej (sama informacja,
 *                   niczego od niego nie chcemy),
 *   po 3 minutach - prosimy o kontakt, żeby rozmowa nie skończyła się ciszą,
 *                   nawet jeśli klient zamknie stronę.
 *
 * Odliczanie liczy się od OSTATNIEJ wiadomości klienta; każda odpowiedź
 * konsultanta kasuje oba etapy. Każdy komunikat pokazujemy raz na sesję
 * przeglądarki, żeby nie wracał przy kolejnych wiadomościach.
 */

const WAITING_MS = 60 * 1000;
const CONTACT_MS = 3 * 60 * 1000;

const STAGE_KEYS = {
  waiting: "keika_chat_wait_notice",
  contact: "keika_chat_wait_prompt",
} as const;

const STAGE_MESSAGES = {
  waiting: "Twój czat nadal czeka na konsultanta, ale w tej chwili czas oczekiwania jest wydłużony.",
  contact:
    "Ups, trwa to trochę dłużej — zostaw namiary do siebie, a odpowiemy najszybciej, jak to możliwe. Wystarczy adres e-mail albo numer telefonu.",
} as const;

type Stage = keyof typeof STAGE_KEYS;
type CrispWindow = Window & { $crisp?: unknown[] };

let armed = false;
const timers: Partial<Record<Stage, number>> = {};

function alreadyShown(stage: Stage): boolean {
  try {
    return window.sessionStorage.getItem(STAGE_KEYS[stage]) === "1";
  } catch {
    return false;
  }
}

function markShown(stage: Stage): void {
  try {
    window.sessionStorage.setItem(STAGE_KEYS[stage], "1");
  } catch {
    // sessionStorage zablokowany - w najgorszym razie komunikat pokaże się
    // drugi raz w tej samej sesji.
  }
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
  markShown(stage);
  // "message:show" wstawia wiadomość do okna czatu tak, jakby napisał ją
  // konsultant - klient widzi ją od razu, bez czekania na kogokolwiek.
  w.$crisp.push(["do", "message:show", ["text", STAGE_MESSAGES[stage]]]);
  void import("@/lib/track-step")
    .then(({ trackShopStep }) => trackShopStep("chat_wait_prompt", stage === "waiting" ? "1min" : "3min"))
    .catch(() => null);
}

function startTimers(): void {
  clearTimers();
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

/** Podpina automat pod czat. Wywoływane przy otwarciu czatu - Crisp odtwarza
 * zakolejkowane "on" po załadowaniu widgetu, więc kolejność nie ma znaczenia. */
export function armChatFollowUp(): void {
  if (typeof window === "undefined" || armed) return;
  armed = true;
  const w = window as CrispWindow;
  w.$crisp = w.$crisp || [];
  // Klient napisał - zaczynamy odliczać oba etapy.
  w.$crisp.push(["on", "message:sent", startTimers]);
  // Ktokolwiek odpisał (konsultant albo bot) - odliczanie kasujemy.
  w.$crisp.push(["on", "message:received", clearTimers]);
  // Zamknięcie okna nie przerywa odliczania: klient może wrócić, a jeśli nie,
  // i tak lepiej, żeby po powrocie zastał prośbę o kontakt.
}

/** Tylko do testów. */
export const CHAT_WAIT_STAGES_MS = { waiting: WAITING_MS, contact: CONTACT_MS };
