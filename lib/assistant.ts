"use client";

/**
 * Mądry asystent sklepu (właściciel, 24.10.2026: „zrób wszystko i uruchom mi
 * pod unikalnym linkiem do testów”). Projekt i uwagi właściciela:
 * https://claude.ai/artifact/NA8C3t2VVQXN1oQA4jhn6Z
 *
 * Kto widzi asystenta:
 *  - ?asystent=<ASSISTANT_TEST_KEY> -> ta przeglądarka zawsze (test właściciela, zapamiętane),
 *  - ?asystent=wylacz              -> kasuje test,
 *  - pilot: CRM (live_chat.php GET -> assistant_pilot = odsetek urządzeń) losuje grupę raz
 *    na urządzenie; grupa A widzi asystenta, grupa B nie, ale jej „ciche pokazy” są liczone
 *    (zdarzenie assistant_nudge_ghost), żeby porównać ten sam moment z dymkiem i bez.
 *
 * Ten moduł to tylko stan i kanały zdarzeń; dymki: app/components/assistant-nudges.tsx,
 * okienko czatu: app/components/live-chat.tsx, konfiguratory meldują stan przez
 * reportConfiguratorState() (lib/configurator-state.ts) i słuchają ASSISTANT_APPLY_EVENT.
 */

import { getConfiguratorState } from "@/lib/configurator-state";
import { LIVE_CHAT_API } from "@/lib/live-chat";

export const ASSISTANT_TEST_KEY = "kk-asystent-7f3a";
const TEST_STORAGE_KEY = "keika_assistant_test";
const ARM_STORAGE_KEY = "keika_assistant_arm";
const PILOT_CACHE_KEY = "keika_assistant_pilot";
export const ASSISTANT_STATE_EVENT = "keika:assistant-state";
/** Asystent/czat -> konfigurator: wstaw tkaninę, mechanizm, montaż, model okna. */
export const ASSISTANT_APPLY_EVENT = "keika:assistant-apply";
/** Koszyk -> asystent: dodano pozycję (lib/cart.ts addCartItem). */
export const CART_ADDED_EVENT = "keika:cart-added";
const PENDING_APPLY_KEY = "keika_assistant_pending_apply";

export type AssistantArm = "A" | "B" | "";

export type AssistantApply = {
  product?: string;
  fabricGroupId?: string;
  fabricId?: string;
  hardwareId?: string;
  /** "nieinwazyjny" | "przykrecany" - plisy */
  mount?: string;
  /** Model okna dachowego do wyszukiwarki (np. "GGL MK06"). */
  windowQuery?: string;
  /** Okno z biblioteki okien dachowych (odczyt tabliczki) - konfigurator wybiera je od razu. */
  windowLibraryId?: number;
  /** Otwórz poradnik pomiaru. */
  measureGuide?: boolean;
  /** Przewiń do wymiarów i ustaw kursor (np. „dodaj kolejne okno”). */
  focusDimensions?: boolean;
};

let pilotPromise: Promise<number> | null = null;
let speaking = false;

/** Dymek asystenta jest na ekranie - inne okienka (koszyk na e-mail, rabat przy wyjściu) czekają. */
export function setAssistantSpeaking(value: boolean): void {
  speaking = value;
}

export function isAssistantSpeaking(): boolean {
  return speaking;
}

function readStorage(key: string): string {
  try {
    return window.localStorage.getItem(key) || "";
  } catch {
    return "";
  }
}

function writeStorage(key: string, value: string | null): void {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    // tryb prywatny - test trwa do przeładowania
  }
}

/** Czy ta przeglądarka jest w teście właściciela (?asystent=<klucz>). */
export function isAssistantTest(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const param = new URLSearchParams(window.location.search).get("asystent");
    if (param === ASSISTANT_TEST_KEY) writeStorage(TEST_STORAGE_KEY, "1");
    if (param === "wylacz") writeStorage(TEST_STORAGE_KEY, null);
  } catch {
    // brak adresu - zostaje zapamiętany stan
  }
  return readStorage(TEST_STORAGE_KEY) === "1";
}

/** Odsetek urządzeń w pilocie (CRM), 0 = pilot wyłączony. */
function fetchPilotPercent(): Promise<number> {
  try {
    const cached = JSON.parse(window.sessionStorage.getItem(PILOT_CACHE_KEY) || "null") as { p?: number; at?: number } | null;
    if (cached && Date.now() - Number(cached.at || 0) < 10 * 60 * 1000) return Promise.resolve(Number(cached.p) || 0);
  } catch {
    // brak pamięci - pytamy CRM
  }
  if (!pilotPromise) {
    pilotPromise = fetch(LIVE_CHAT_API, { method: "GET" })
      .then((res) => res.json() as Promise<{ assistant_pilot?: number }>)
      .then((data) => {
        const p = Math.max(0, Math.min(100, Number(data?.assistant_pilot) || 0));
        try {
          window.sessionStorage.setItem(PILOT_CACHE_KEY, JSON.stringify({ p, at: Date.now() }));
        } catch {
          // nic
        }
        return p;
      })
      .catch(() => 0);
  }
  return pilotPromise;
}

/**
 * Grupa tego urządzenia: "A" (widzi asystenta), "B" (porównawcza, liczona po cichu),
 * "" (poza pilotem). Test właściciela zawsze "A".
 */
export async function resolveAssistantArm(): Promise<AssistantArm> {
  if (typeof window === "undefined") return "";
  if (isAssistantTest()) return "A";
  const percent = await fetchPilotPercent();
  if (percent <= 0) return "";
  const stored = readStorage(ARM_STORAGE_KEY);
  if (stored === "A" || stored === "B") return stored;
  const arm: AssistantArm = Math.random() * 100 < percent ? "A" : "B";
  writeStorage(ARM_STORAGE_KEY, arm);
  return arm;
}

/** Szybkie sprawdzenie bez sieci (wygląd czatu przy pierwszym renderze). */
export function assistantArmSync(): AssistantArm {
  if (typeof window === "undefined") return "";
  if (isAssistantTest()) return "A";
  const stored = readStorage(ARM_STORAGE_KEY);
  return stored === "A" || stored === "B" ? stored : "";
}

/**
 * Wstawia wybór do konfiguratora. Jeśli na tej stronie nie ma konfiguratora danego produktu,
 * wybór czeka w sessionStorage, a klient przechodzi na stronę produktu (konfigurator odbiera
 * go przez takePendingAssistantApply()).
 */
export function applyToConfigurator(apply: AssistantApply, productPath?: string): void {
  if (typeof window === "undefined") return;
  const onProduct = !apply.product || getConfiguratorState()?.product === apply.product;
  if (onProduct || !productPath) {
    window.dispatchEvent(new CustomEvent<AssistantApply>(ASSISTANT_APPLY_EVENT, { detail: apply }));
    return;
  }
  try {
    window.sessionStorage.setItem(PENDING_APPLY_KEY, JSON.stringify({ ...apply, at: Date.now() }));
  } catch {
    // bez pamięci - klient wybierze sam
  }
  window.location.href = productPath;
}

export function takePendingAssistantApply(product: string): AssistantApply | null {
  try {
    const raw = window.sessionStorage.getItem(PENDING_APPLY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AssistantApply & { at?: number };
    if (parsed.product && parsed.product !== product) return null;
    window.sessionStorage.removeItem(PENDING_APPLY_KEY);
    if (Date.now() - Number(parsed.at || 0) > 10 * 60 * 1000) return null;
    return parsed;
  } catch {
    return null;
  }
}
