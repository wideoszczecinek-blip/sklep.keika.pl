"use client";

/**
 * „Pokaż mi na stronie” (właściciel 27.10.2026: „jak klient nie może czegoś znaleźć, asystent ma
 * ustawić stronę w tej pozycji”). Czat w CRM (narzędzie pokaz_na_stronie, core/lib/chat_bot.php
 * chat_bot_show_places) zwraca kartę z identyfikatorem miejsca; tu jest mapa identyfikator ->
 * strona + co zrobić: przewinąć, rozwinąć krok, podświetlić, ustawić kursor albo otworzyć poradnik.
 * Gdy klient jest na innej stronie, miejsce czeka w sessionStorage (i w ?pokaz=), a okienko czatu
 * (app/components/live-chat.tsx) uruchamia je po wczytaniu nowej strony.
 */

import { ASSISTANT_APPLY_EVENT, applyToConfigurator, type AssistantApply } from "@/lib/assistant";

export const SHOW_QUERY_PARAM = "pokaz";
const PENDING_KEY = "keika_assistant_show";
const HIGHLIGHT_CLASS = "kk-show-hl";

type Place = {
  /** Ścieżka w sklepie; "" = sekcja strony produktu, na której jest klient. */
  path: string;
  /** Przewija/podświetla; false = elementu jeszcze nie ma (ponawiamy po wczytaniu strony). */
  run: () => boolean;
  /** Zamiast run po przejściu na inną stronę: wybór czeka w konfiguratorze (takePendingAssistantApply). */
  apply?: AssistantApply;
};

function visible(el: Element | null | undefined): el is HTMLElement {
  return !!el && (el as HTMLElement).offsetParent !== null;
}

function scrollTo(el: HTMLElement, offset = 96): void {
  // Strony produktów przewijają własny kontener (.hero-full), nie okno.
  const container = el.closest<HTMLElement>(".hero-full");
  if (container && container.scrollHeight > container.clientHeight) {
    const delta = el.getBoundingClientRect().top - container.getBoundingClientRect().top - offset;
    container.scrollTo({ top: Math.max(0, container.scrollTop + delta), behavior: "smooth" });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

let highlightTimer = 0;

/** Pomarańczowa, pulsująca ramka wokół miejsca na kilka sekund. */
export function highlightElement(el: HTMLElement, ms = 5000): void {
  document.querySelectorAll("." + HIGHLIGHT_CLASS).forEach((node) => node.classList.remove(HIGHLIGHT_CLASS));
  el.classList.add(HIGHLIGHT_CLASS);
  window.clearTimeout(highlightTimer);
  highlightTimer = window.setTimeout(() => el.classList.remove(HIGHLIGHT_CLASS), ms);
}

function reveal(el: HTMLElement | null | undefined, focusSelector?: string): boolean {
  if (!visible(el)) return false;
  scrollTo(el);
  highlightElement(el);
  if (focusSelector) {
    window.setTimeout(() => el.querySelector<HTMLInputElement>(focusSelector)?.focus({ preventScroll: true }), 600);
  }
  return true;
}

/** Krok konfiguratora po fragmencie tytułu („wymiary”, „tkaniny”…); zwinięty krok rozwija. */
function configuratorStep(titlePart: string): HTMLElement | null {
  const title = [...document.querySelectorAll<HTMLElement>(".hero-product-config-panel .hero-product-config-step-title")].find(
    (el) => visible(el) && (el.textContent || "").toLowerCase().includes(titlePart),
  );
  if (!title) return null;
  const step = title.closest<HTMLElement>(".hero-product-step-accordion") || title.parentElement?.parentElement || null;
  if (step?.classList.contains("is-collapsed")) step.querySelector<HTMLElement>(".hero-product-step-head")?.click();
  return step;
}

function dispatchApply(detail: AssistantApply): boolean {
  window.dispatchEvent(new CustomEvent<AssistantApply>(ASSISTANT_APPLY_EVENT, { detail }));
  return true;
}

function productSection(id: string): boolean {
  return reveal(document.getElementById(`product-section-${id}`));
}

function modelSearch(): boolean {
  return (
    reveal(document.querySelector<HTMLElement>(".rd-search-field"), "input") ||
    reveal(document.querySelector<HTMLElement>(".hero-product-config-panel"), "input")
  );
}

const PLACES: Record<string, Place> = {
  plisy_wymiary: {
    path: "/plisy",
    run: () => {
      // Telefon: sekcja „Wyceń swoje okno” pod ceną; komputer: krok „Wymiary i ilość” w konfiguratorze.
      const quick = document.querySelector<HTMLElement>(".pl-quick--v2");
      if (visible(quick)) return reveal(quick, "input");
      return reveal(configuratorStep("wymiary"), "input[data-dim-input], input");
    },
  },
  plisy_montaz: {
    path: "/plisy",
    run: () => {
      const quick = document.querySelector<HTMLElement>(".pl-quick--v2 .pl-quick-mounts");
      if (visible(quick)) return reveal(quick);
      return reveal(configuratorStep("montażu"));
    },
  },
  plisy_mechanizm: { path: "/plisy", run: () => reveal(configuratorStep("mechanizmu")) },
  plisy_tkaniny: { path: "/plisy", run: () => reveal(configuratorStep("tkaniny")) },
  plisy_kolekcje: { path: "/plisy", run: () => reveal(document.querySelector<HTMLElement>(".pl-coll")) },
  plisy_jak_mierzyc: {
    path: "/plisy",
    apply: { product: "plisy", measureGuide: true },
    run: () => dispatchApply({ product: "plisy", measureGuide: true }),
  },
  moskitiery_wymiary: {
    path: "/moskitiery-ramkowe",
    run: () => {
      const quick = document.querySelector<HTMLElement>(".pl-quick--acc");
      if (visible(quick)) {
        if (!quick.classList.contains("is-open")) quick.querySelector<HTMLElement>(".pl-quick-acc-head")?.click();
        return reveal(quick, "input");
      }
      return reveal(configuratorStep("wymiar"), "input[data-dim-input], input");
    },
  },
  moskitiery_konfigurator: { path: "/moskitiery-ramkowe", run: () => reveal(document.querySelector<HTMLElement>(".hero-product-config-panel")) },
  moskitiery_jak_mierzyc: {
    path: "/moskitiery-ramkowe",
    apply: { product: "moskitiery-ramkowe", measureGuide: true },
    run: () => dispatchApply({ product: "moskitiery-ramkowe", measureGuide: true }),
  },
  dachowe_rolety_model: { path: "/?produkt=rolety-dachowe", run: modelSearch },
  dachowe_plisy_model: { path: "/?produkt=plisy-dachowe", run: modelSearch },
  galeria: { path: "", run: () => productSection("galeria") },
  opinie: { path: "", run: () => productSection("opinie") },
  faq: { path: "", run: () => productSection("faq") },
  instrukcje: { path: "", run: () => productSection("instrukcje") },
  koszyk: { path: "/koszyk", run: () => true },
  moje_zamowienia: { path: "/moje-zamowienia", run: () => true },
};

function samePage(path: string): boolean {
  if (path === "") return !!document.getElementById("product-section-opinie");
  const target = new URL(path, window.location.origin);
  const here = window.location;
  const norm = (p: string) => p.replace(/\/+$/, "") || "/";
  if (norm(here.pathname) !== norm(target.pathname)) return false;
  const product = target.searchParams.get("produkt");
  return !product || new URLSearchParams(here.search).get("produkt") === product;
}

/** Ponawia run() przez kilka sekund - po przejściu na nową stronę elementy pojawiają się z opóźnieniem. */
export function runShowPlace(place: string, tries = 25): void {
  const entry = PLACES[place];
  if (!entry) return;
  let attempt = 0;
  const tick = () => {
    if (entry.run()) return;
    if (++attempt < tries) window.setTimeout(tick, 400);
  };
  tick();
}

/**
 * Pokazuje miejsce: na tej samej stronie od razu, inaczej przechodzi na właściwą stronę
 * (miejsce czeka w sessionStorage i w ?pokaz=). Zwraca, co się stało.
 */
export function showOnPage(place: string): "shown" | "navigating" | "unknown" {
  if (typeof window === "undefined") return "unknown";
  const entry = PLACES[place];
  if (!entry) return "unknown";
  if (samePage(entry.path)) {
    runShowPlace(place);
    return "shown";
  }
  const path = entry.path || "/plisy";
  if (entry.apply) {
    applyToConfigurator(entry.apply, path);
    return "navigating";
  }
  try {
    window.sessionStorage.setItem(PENDING_KEY, JSON.stringify({ place, at: Date.now() }));
  } catch {
    // bez pamięci zostaje parametr w adresie
  }
  const url = new URL(path, window.location.origin);
  url.searchParams.set(SHOW_QUERY_PARAM, place);
  window.location.href = url.toString();
  return "navigating";
}

/** Miejsce czekające po przejściu na tę stronę (z ?pokaz= albo sessionStorage); zdejmuje parametr z adresu. */
export function takePendingShow(): string | null {
  if (typeof window === "undefined") return null;
  let place = "";
  try {
    const url = new URL(window.location.href);
    const fromQuery = url.searchParams.get(SHOW_QUERY_PARAM) || "";
    if (fromQuery) {
      place = fromQuery;
      url.searchParams.delete(SHOW_QUERY_PARAM);
      window.history.replaceState(window.history.state, "", url.toString());
    }
  } catch {
    // zły adres - sprawdzamy pamięć
  }
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    if (raw) {
      window.sessionStorage.removeItem(PENDING_KEY);
      const parsed = JSON.parse(raw) as { place?: string; at?: number };
      if (!place && parsed.place && Date.now() - Number(parsed.at || 0) < 10 * 60 * 1000) place = parsed.place;
    }
  } catch {
    // nic
  }
  return place && PLACES[place] ? place : null;
}
