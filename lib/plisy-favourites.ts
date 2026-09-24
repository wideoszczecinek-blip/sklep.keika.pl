"use client";

// Ulubione tkaniny plis (właściciel, 2026-09-24): klient zaznacza serduszka
// przy tkaninach w sekcji „Którą kolekcję tkanin wybrać" na landingu, a w
// konfiguratorze dostaje je z powrotem jako skrót - bez przeklikiwania 150
// próbników jeszcze raz. Trzymane tylko w przeglądarce (localStorage), więc
// nie wymaga konta ani zapytania do CRM; przeżywa zamknięcie karty.
import { useSyncExternalStore } from "react";

const STORAGE_KEY = "keika_plisy_fav_v1";
const CHANGED_EVENT = "keika-plisy-fav-changed";
const EMPTY: string[] = [];

let cache: string[] | null = null;

function readStorage(): string[] {
  if (cache) return cache;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    cache = Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string") : [];
  } catch {
    // tryb prywatny / zablokowane dane - ulubione są wygodą, nic od nich nie zależy
    cache = [];
  }
  return cache;
}

function subscribe(onChange: () => void): () => void {
  const handler = () => {
    cache = null;
    onChange();
  };
  window.addEventListener(CHANGED_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    window.removeEventListener(CHANGED_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function togglePlisyFavourite(swatchId: string): void {
  const id = String(swatchId || "").trim();
  if (!id) return;
  const current = readStorage();
  const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
  cache = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(CHANGED_EVENT));
}

/** Lista id ulubionych tkanin + pomocnicze. Na serwerze zawsze pusta, żeby
 * pierwszy render zgadzał się z HTML-em z CDN. */
export function usePlisyFavourites(): {
  ids: string[];
  isFavourite: (swatchId: string) => boolean;
  toggle: (swatchId: string) => void;
} {
  const ids = useSyncExternalStore(subscribe, readStorage, () => EMPTY);
  return {
    ids,
    isFavourite: (swatchId: string) => ids.includes(swatchId),
    toggle: togglePlisyFavourite,
  };
}
