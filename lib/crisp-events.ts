"use client";

/**
 * Jeden punkt podpięcia pod zdarzenia Crispa (2026-10-03).
 *
 * Chatbox Crispa trzyma JEDNĄ funkcję na zdarzenie: kolejne
 * `$crisp.push(["on", "message:sent", fn])` po cichu zastępuje poprzednią.
 * Tak padł automat na długie oczekiwanie (lib/chat-follow-up.ts): od 02.10
 * most czat↔CRM (lib/chat-identity.ts) rejestrował te same zdarzenia
 * i nadpisywał jego funkcje - klient czekał bez żadnego komunikatu.
 *
 * Dlatego moduły nie wołają już "on" same, tylko dopisują się tutaj, a do
 * Crispa idzie po jednej funkcji na zdarzenie, która woła wszystkich
 * słuchaczy po kolei. Błąd jednego słuchacza nie zatrzymuje pozostałych.
 */

type Listener = (...args: unknown[]) => void;
type CrispWindow = Window & { $crisp?: unknown[] };

const listeners = new Map<string, Listener[]>();

export function onCrispEvent(event: string, listener: Listener): void {
  if (typeof window === "undefined") return;
  const existing = listeners.get(event);
  if (existing) {
    if (!existing.includes(listener)) existing.push(listener);
    return;
  }
  listeners.set(event, [listener]);
  const w = window as CrispWindow;
  w.$crisp = w.$crisp || [];
  w.$crisp.push([
    "on",
    event,
    (...args: unknown[]) => {
      for (const fn of listeners.get(event) || []) {
        try {
          fn(...args);
        } catch {
          // jeden słuchacz nie może wyłączyć pozostałych
        }
      }
    },
  ]);
}
