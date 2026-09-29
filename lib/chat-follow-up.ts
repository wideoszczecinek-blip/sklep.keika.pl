"use client";

/**
 * Automat na długie oczekiwanie w czacie (właściciel, 2026-09-29).
 *
 * Klient pisze na czacie i czeka. Jeśli przez 3 minuty nikt nie odpisze,
 * pokazujemy mu w oknie czatu dwie wiadomości: prośbę o kontakt i uczciwą
 * informację, że czas oczekiwania jest dziś dłuższy. Dzięki temu rozmowa nie
 * kończy się ciszą - nawet jeśli klient zamknie stronę, zostaje namiar, pod
 * który biuro odpisze.
 *
 * Liczy się od OSTATNIEJ wiadomości klienta; każda odpowiedź konsultanta
 * kasuje odliczanie. Komunikat pokazujemy raz na sesję przeglądarki, żeby nie
 * wracał przy każdej kolejnej wiadomości.
 */

const NO_REPLY_MS = 3 * 60 * 1000;
const SHOWN_KEY = "keika_chat_wait_prompt";

const WAIT_MESSAGES = [
  "Ups, trwa to trochę dłużej — zostaw namiary do siebie, a odpowiemy najszybciej, jak to możliwe. Wystarczy adres e-mail albo numer telefonu.",
  "Twój czat nadal czeka na konsultanta, ale w tej chwili czas oczekiwania jest wydłużony.",
];

type CrispWindow = Window & { $crisp?: unknown[] };

let armed = false;
let timer: number | null = null;

function alreadyShown(): boolean {
  try {
    return window.sessionStorage.getItem(SHOWN_KEY) === "1";
  } catch {
    return false;
  }
}

function markShown(): void {
  try {
    window.sessionStorage.setItem(SHOWN_KEY, "1");
  } catch {
    // sessionStorage zablokowany - trudno, w najgorszym razie komunikat
    // pokaże się drugi raz w tej samej sesji.
  }
}

function clearTimer(): void {
  if (timer !== null) {
    window.clearTimeout(timer);
    timer = null;
  }
}

function showWaitMessages(): void {
  const w = window as CrispWindow;
  if (!w.$crisp) return;
  markShown();
  // "message:show" wstawia wiadomość do okna czatu tak, jakby napisał ją
  // konsultant - klient widzi ją od razu, bez czekania na kogokolwiek.
  for (const text of WAIT_MESSAGES) {
    w.$crisp.push(["do", "message:show", ["text", text]]);
  }
  void import("@/lib/track-step")
    .then(({ trackShopStep }) => trackShopStep("chat_wait_prompt", "3min"))
    .catch(() => null);
}

function startTimer(): void {
  clearTimer();
  if (alreadyShown()) return;
  timer = window.setTimeout(() => {
    timer = null;
    if (!alreadyShown()) showWaitMessages();
  }, NO_REPLY_MS);
}

/** Podpina automat pod czat. Wywoływane przy otwarciu czatu - Crisp odtwarza
 * zakolejkowane "on" po załadowaniu widgetu, więc kolejność nie ma znaczenia. */
export function armChatFollowUp(): void {
  if (typeof window === "undefined" || armed) return;
  armed = true;
  const w = window as CrispWindow;
  w.$crisp = w.$crisp || [];
  // Klient napisał - zaczynamy odliczać.
  w.$crisp.push(["on", "message:sent", startTimer]);
  // Ktokolwiek odpisał (konsultant albo bot) - odliczanie kasujemy.
  w.$crisp.push(["on", "message:received", clearTimer]);
  // Zamknięcie okna nie przerywa odliczania: klient może wrócić, a jeśli nie,
  // i tak lepiej, żeby po powrocie zastał prośbę o kontakt.
}

/** Tylko do testów: ile czasu czeka automat. */
export const CHAT_NO_REPLY_MS = NO_REPLY_MS;
