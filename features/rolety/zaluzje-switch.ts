// Żaluzje: przechodzenie między materiałami (właściciel 23.11.2026: „musi być
// łatwa opcja przełączania się między podproduktami, aby klient mógł łatwo
// przeanalizować inne rozwiązanie”). Konfigurator strony rodzaju zapisuje tu
// na bieżąco to, co dotyczy OKNA, a nie materiału: montaż, pomiar, grubość
// lameli. Po przejściu na inny materiał (przełącznik, wstecz w przeglądarce)
// konfigurator tego materiału startuje z tymi samymi wymiarami - klient od
// razu wybiera wersję i kolor i porównuje cenę dla tego samego okna.
//
// sessionStorage: tylko ta karta i ta wizyta. Kasowane po dodaniu do koszyka
// (kolejne okno zaczyna się od pustych wymiarów) i nieczytane przy edycji
// pozycji z koszyka.
import type { ZaluzjeRodzajSlug } from "./zaluzje-rodzaje";

const CARRY_KEY = "keika_zaluzje_okno_v1";
const JUMP_KEY = "keika_zaluzje_do_konfiguratora_v1";
const CARRY_TTL_MS = 3 * 60 * 60 * 1000;
const JUMP_TTL_MS = 2 * 60 * 1000;

export type ZaluzjeCarry = {
  /** Strona, na której klient ostatnio konfigurował. */
  rodzaj: ZaluzjeRodzajSlug;
  mountId: string;
  /** To, co klient wpisał (pomiar albo wymiar żaluzji), w mm. */
  inputWidthMm: number;
  inputHeightMm: number;
  exactBlindSize: boolean;
  hasVent: boolean;
  spaceChoice: "" | "full" | "less";
  spaceLessCm: string;
  slatWidthMm: number;
  /** Wersja i kolor bieżącego materiału (inny materiał = inne modele). */
  fabricGroupId: string;
  fabricId: string;
  /**
   * Ostatni wybór na stronie każdego materiału - przy porównywaniu „tam i z
   * powrotem” klient wraca do swojej wersji i koloru, a nie do pustego kroku.
   */
  picks?: Partial<Record<ZaluzjeRodzajSlug, ZaluzjePick>>;
  savedAt: number;
};

export type ZaluzjePick = { slatWidthMm: number; fabricGroupId: string; fabricId: string };

export function readZaluzjeCarry(): ZaluzjeCarry | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.sessionStorage.getItem(CARRY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ZaluzjeCarry;
    if (!parsed || typeof parsed !== "object" || !parsed.savedAt || Date.now() - parsed.savedAt > CARRY_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** Zmiana zapisanego okna - przełączniki odświeżają podpowiedź „wymiary przejdą z Tobą”. */
export const ZALUZJE_CARRY_EVENT = "keika:zaluzje-okno";

function notifyCarryChange() {
  try {
    window.dispatchEvent(new Event(ZALUZJE_CARRY_EVENT));
  } catch {
    /* ignore */
  }
}

export function writeZaluzjeCarry(carry: Omit<ZaluzjeCarry, "savedAt" | "picks">) {
  try {
    const previous = readZaluzjeCarry();
    const picks: Partial<Record<ZaluzjeRodzajSlug, ZaluzjePick>> = { ...(previous?.picks || {}) };
    if (carry.slatWidthMm) {
      picks[carry.rodzaj] = { slatWidthMm: carry.slatWidthMm, fabricGroupId: carry.fabricGroupId, fabricId: carry.fabricId };
    }
    const empty = !carry.mountId && !carry.inputWidthMm && !carry.inputHeightMm && !carry.slatWidthMm && !Object.keys(picks).length;
    if (empty) window.sessionStorage.removeItem(CARRY_KEY);
    else window.sessionStorage.setItem(CARRY_KEY, JSON.stringify({ ...carry, picks, savedAt: Date.now() }));
  } catch {
    /* tryb prywatny - przeniesienie wymiarów to wygoda, nic od niego nie zależy */
  }
  notifyCarryChange();
}

export function clearZaluzjeCarry() {
  try {
    window.sessionStorage.removeItem(CARRY_KEY);
  } catch {
    /* ignore */
  }
  notifyCarryChange();
}

/** Czy w tej wizycie klient wpisał już coś o swoim oknie (wtedy przełącznik obiecuje przeniesienie). */
export function zaluzjeCarryHasWindow(carry: ZaluzjeCarry | null): boolean {
  return Boolean(carry && (carry.inputWidthMm > 0 || carry.inputHeightMm > 0));
}

/** Przełącznik w konfiguratorze: po przejściu na inny materiał przewiń od razu do konfiguratora. */
export function markZaluzjeJumpToConfigurator(target: ZaluzjeRodzajSlug) {
  try {
    window.sessionStorage.setItem(JUMP_KEY, JSON.stringify({ target, at: Date.now() }));
  } catch {
    /* ignore */
  }
}

export function takeZaluzjeJumpToConfigurator(rodzaj: ZaluzjeRodzajSlug): boolean {
  try {
    const raw = window.sessionStorage.getItem(JUMP_KEY);
    if (!raw) return false;
    window.sessionStorage.removeItem(JUMP_KEY);
    const parsed = JSON.parse(raw) as { target?: string; at?: number };
    return parsed?.target === rodzaj && Boolean(parsed.at) && Date.now() - (parsed.at || 0) < JUMP_TTL_MS;
  } catch {
    return false;
  }
}

/** Opis z karty grubości na stronie rodzaju -> wybór tej grubości w konfiguratorze. */
export const ZALUZJE_PICK_WIDTH_EVENT = "keika:zaluzje-grubosc";

export function requestZaluzjeSlatWidth(widthMm: number) {
  try {
    window.dispatchEvent(new CustomEvent(ZALUZJE_PICK_WIDTH_EVENT, { detail: { widthMm } }));
  } catch {
    /* ignore */
  }
}
