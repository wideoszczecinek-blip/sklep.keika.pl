"use client";

// Mądry asystent - dymki „we właściwej chwili” (właściciel, 24.10.2026; projekt i uwagi:
// https://claude.ai/artifact/NA8C3t2VVQXN1oQA4jhn6Z). Zastępuje prosty chat-nudge.tsx
// u klientów z grupy A (test właściciela ?asystent=<klucz> albo pilot, lib/assistant.ts).
//
// Zasada: sygnał -> bariera -> jedno krótkie pytanie z dwoma przyciskami odpowiedzi.
// O tym, KIEDY się odezwać, decydują reguły tutaj (zero kosztów AI); AI odpowiada dopiero,
// gdy klient kliknie albo napisze w czacie.
//
// Takt (Agencja AI, ocena pilota 30.10.2026 - zlecenia 211-217):
//  - najwyżej 1 dymek na 2 minuty i 2 na wizytę, znika sam po 15 s; „×” = cisza do końca wizyty,
//  - nigdy przy otwartym czacie, w trakcie pisania (także z otwartą klawiaturą telefonu), przy
//    otwartym oknie (koszyk na e-mail, zapis wyceny...), w koszyku i kasie, ani gdy klient czyta
//    opis albo opinie,
//  - treści w formie Pan/Pani albo bezosobowej (zasada właściciela z 23.10.2026),
//  - żadnych obietnic płatności (raty, PayPo) ani rabatu na pojedynczą sztukę; dymki save_offer
//    i price_hesitate wyłączone 31.10.2026 (0 zamówień po dymku, odciągały od koszyka),
//  - przekazanie do człowieka zostaje jak było.
// Grupa B pilota: te same reguły liczą „ciche pokazy” (assistant_nudge / action=ghost) bez
// żadnego dymka - także bez starego chat-nudge (czysta kontrola).

import { useEffect, useRef, useState } from "react";
import {
  CART_ADDED_EVENT,
  applyToConfigurator,
  resolveAssistantArm,
  setAssistantSpeaking,
  type AssistantArm,
} from "@/lib/assistant";
import { getBundleDiscountRules } from "@/lib/bundle-discount";
import { NON_PRODUCT_POSITION_SLUGS, readCartItems } from "@/lib/cart";
import { openLiveChat } from "@/lib/live-chat";
import { QTY_PROMO } from "@/lib/promo";
import { SHOP_STEP_EVENT, trackShopStep, type ShopStepDetail } from "@/lib/track-step";
import ChatNudge from "./chat-nudge";

type MomentId = "dims_idle" | "dims_invalid" | "color_indecision" | "mount_hesitate" | "more_windows" | "roof_plate" | "return_cart" | "quiz";

type Button = { label: string; primary?: boolean; run: () => void };
type Nudge = { id: MomentId; title: string; text: string; buttons: Button[] };

const GAP_MS = 120_000;
const MAX_PER_VISIT = 2;
const AUTO_HIDE_MS = 15_000;
const SESSION_KEY = "keika_assistant_nudges_v1";
/** Pasek „koszyk na e-mail” (lib/cart-email-nudge.ts) zapisuje tu moment pokazania. */
const CART_EMAIL_SHOWN_KEY = "keika_cart_email_offer_shown";
const PRODUCT_PAGES = new Set(["plisy", "moskitiery-ramkowe", "rolety-dachowe", "plisy-dachowe"]);
// Tylko ruchy klienta - bez zdarzeń samej strony (configurator_ready, draft_restored, load_failed).
const CONFIGURATOR_STEP =
  /^(select_|enter_dimensions|dimensions_invalid|configurator_(step_toggle|jump_to_dims|measure_guide)|quick_price_|dimension_unit|accept_sag|surcharge_|edit_position|add_position|set_quantity|mount_change|window_search|fabric_gallery_open|fabric_group_info|measure_later_open)/;

type SessionState = { shown: string[]; lastAt: number; stopped: boolean; returnChecked: boolean };

function readSession(): SessionState {
  try {
    const raw = JSON.parse(window.sessionStorage.getItem(SESSION_KEY) || "null") as Partial<SessionState> | null;
    return { shown: raw?.shown || [], lastAt: Number(raw?.lastAt) || 0, stopped: !!raw?.stopped, returnChecked: !!raw?.returnChecked };
  } catch {
    return { shown: [], lastAt: 0, stopped: false, returnChecked: false };
  }
}

function writeSession(next: SessionState): void {
  try {
    window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(next));
  } catch {
    // tryb prywatny - limity działają do przeładowania
  }
}

/** Klawiatura telefonu zasłania ekran (pole ma fokus albo okno widoczne skurczyło się o ponad 1/4). */
function keyboardOpen(): boolean {
  const active = document.activeElement as HTMLElement | null;
  if (active && (/^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName) || active.isContentEditable)) return true;
  const vv = window.visualViewport;
  return !!vv && vv.height < window.innerHeight * 0.75;
}

/** Coś innego właśnie mówi do klienta (okno rabatu, koszyka na e-mail, poradnik...) albo klient pisze. */
function stageBusy(): boolean {
  if (document.querySelector(".lc-panel")) return true;
  if (keyboardOpen()) return true;
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"], [role="dialog"], [role="alertdialog"]'));
  if (dialogs.some((el) => !el.classList.contains("as-nudge") && el.offsetParent !== null)) return true;
  if (document.querySelector(".cart-email-banner, .escape-offer-modal, .promo-save-modal, .rescue-modal")) return true;
  return false;
}

/** Sekcja zajmuje środek ekranu - klient ją właśnie czyta. */
function sectionInFocus(id: string): boolean {
  const el = document.getElementById(id);
  if (!el || el.offsetParent === null) return false;
  const rect = el.getBoundingClientRect();
  const middle = window.innerHeight / 2;
  return rect.top < middle && rect.bottom > middle;
}

/** Klient czyta opis albo opinie - nie przerywamy (Agencja, zlecenie 216). */
function readingContent(): boolean {
  return sectionInFocus("product-section-opinie") || sectionInFocus("product-section-opis");
}

/** Panel konfiguratora wciąż na ekranie (klient go nie przewinął) - warunek dymka dims_idle. */
function configuratorOnScreen(): boolean {
  const panel = document.querySelector<HTMLElement>(".hero-product-config-panel");
  if (!panel) return false;
  const rect = panel.getBoundingClientRect();
  return rect.bottom > 80 && rect.top < window.innerHeight;
}

/** Czy CRM ma włączony rabat ilościowy (CAŁY DOM) - bez niego nie obiecujemy rabatu za kolejne okno. */
function qtyPromoLive(): boolean {
  return Object.values(getBundleDiscountRules()).some((rule) => rule.wholeOrder && rule.tiers.some((tier) => tier.fromQty >= 2 && tier.percent > 0));
}

/** „Dodaj kolejne okno”: plisy mają własny formularz pozycji, pozostałe - przewinięcie do konfiguratora. */
function focusConfigurator(productSlug: string): void {
  if (productSlug === "plisy") {
    applyToConfigurator({ product: "plisy", focusDimensions: true });
    return;
  }
  const panel = document.querySelector<HTMLElement>(".hero-product-config-panel");
  if (!panel) return;
  panel.scrollIntoView({ behavior: "smooth", block: "start" });
  window.setTimeout(() => panel.querySelector<HTMLInputElement>('input[data-dim-input], input[inputmode="decimal"], input[type="number"], input[type="text"]')?.focus({ preventScroll: true }), 400);
}

export default function AssistantNudges({ productSlug, active }: { productSlug: string; active: boolean }) {
  const [arm, setArm] = useState<AssistantArm>("");
  const [nudge, setNudge] = useState<Nudge | null>(null);

  const armRef = useRef<AssistantArm>("");
  const nudgeRef = useRef<Nudge | null>(null);
  const pageStartRef = useRef(Date.now());
  const lastActivityRef = useRef(Date.now());
  const touchedRef = useRef(false);
  const dimsEnteredRef = useRef(false);
  const invalidAtRef = useRef(0);
  const colorPicksRef = useRef<number[]>([]);
  const mountChangesRef = useRef(0);
  const addedAtRef = useRef(0);
  const roofZeroAtRef = useRef(0);
  const maxScrollRef = useRef(0);
  const pendingRef = useRef<MomentId | null>(null);
  const firedThisPageRef = useRef<Set<string>>(new Set());

  armRef.current = arm;
  nudgeRef.current = nudge;

  useEffect(() => {
    void resolveAssistantArm().then(setArm);
  }, []);

  // Zmiana produktu = nowa strona: liczniki chwil od zera (limity wizyty zostają w sessionStorage).
  useEffect(() => {
    pageStartRef.current = Date.now();
    touchedRef.current = false;
    dimsEnteredRef.current = false;
    invalidAtRef.current = 0;
    colorPicksRef.current = [];
    mountChangesRef.current = 0;
    roofZeroAtRef.current = 0;
    maxScrollRef.current = 0;
    firedThisPageRef.current = new Set();
  }, [productSlug]);

  // ---- sygnały ----
  useEffect(() => {
    if (!arm) return;
    const onActivity = () => {
      lastActivityRef.current = Date.now();
    };
    // Na telefonie przewija się wewnętrzny .hero-full, nie dokument - stąd nasłuch w fazie capture
    // i głębokość liczona z elementu, który faktycznie się przewinął.
    const onScroll = (event: Event) => {
      lastActivityRef.current = Date.now();
      const target = event.target;
      let depth = 0;
      if (target instanceof Element) {
        depth = (target.scrollTop + target.clientHeight) / Math.max(1, target.scrollHeight);
      } else {
        const doc = document.documentElement;
        depth = (window.scrollY + window.innerHeight) / Math.max(1, doc.scrollHeight);
      }
      if (depth > maxScrollRef.current) maxScrollRef.current = depth;
    };
    const onStep = (event: Event) => {
      const detail = (event as CustomEvent<ShopStepDetail>).detail;
      if (!detail) return;
      const name = detail.eventName;
      lastActivityRef.current = Date.now();
      if (CONFIGURATOR_STEP.test(name)) touchedRef.current = true;
      if (name === "enter_dimensions") dimsEnteredRef.current = true;
      if (name === "dimensions_invalid" || name === "dimensions_over_limit") invalidAtRef.current = Date.now();
      if (name === "select_fabric_color" && detail.meta?.source !== "assistant") {
        const now = Date.now();
        colorPicksRef.current = [...colorPicksRef.current.filter((t) => now - t < 90_000), now];
      }
      if (name === "select_mount_type") mountChangesRef.current += 1;
      if (name === "mount_change_cancel") mountChangesRef.current += 2;
      if (name === "window_search_query" && Number(detail.meta?.results) === 0) roofZeroAtRef.current = Date.now();
    };
    const onCartAdded = (event: Event) => {
      const detail = (event as CustomEvent<{ productSlug?: string; qty?: number; count?: number }>).detail || {};
      addedAtRef.current = Date.now();
      if (detail.count === 1 && Number(detail.qty) === 1) pendingRef.current = "more_windows";
    };
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onScroll, { passive: true, capture: true });
    window.addEventListener(SHOP_STEP_EVENT, onStep);
    window.addEventListener(CART_ADDED_EVENT, onCartAdded);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onScroll, { capture: true });
      window.removeEventListener(SHOP_STEP_EVENT, onStep);
      window.removeEventListener(CART_ADDED_EVENT, onCartAdded);
    };
  }, [arm]);

  // ---- decyzja co 2 s ----
  useEffect(() => {
    if (!arm) return;
    const timer = window.setInterval(() => {
      if (nudgeRef.current || document.visibilityState !== "visible") return;
      if (/^\/(koszyk|zamowienie|moje-zamowienia|wizyta)/.test(window.location.pathname)) return;
      const session = readSession();
      if (session.stopped || session.shown.length >= MAX_PER_VISIT) return;
      if (Date.now() - session.lastAt < GAP_MS) return;
      if (stageBusy() || readingContent()) return;
      const candidate = pickMoment(session);
      if (!candidate) return;
      firedThisPageRef.current.add(candidate.id);
      writeSession({ ...session, shown: [...session.shown, candidate.id], lastAt: Date.now() });
      if (armRef.current === "B") {
        trackShopStep("assistant_nudge", candidate.id, { arm: "B", action: "ghost", product: productSlug });
        return;
      }
      trackShopStep("assistant_nudge", candidate.id, { arm: "A", action: "shown", product: productSlug });
      setNudge(candidate);
    }, 2000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arm, productSlug, active]);

  useEffect(() => {
    setAssistantSpeaking(!!nudge);
    if (!nudge) return;
    const timer = window.setTimeout(() => {
      trackShopStep("assistant_nudge", nudge.id, { arm: "A", action: "later", product: productSlug });
      setNudge(null);
    }, AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nudge]);

  function pickMoment(session: SessionState): Nudge | null {
    const now = Date.now();
    const seen = (id: MomentId) => session.shown.includes(id) || firedThisPageRef.current.has(id);
    const idleMs = now - lastActivityRef.current;
    const pageMs = now - pageStartRef.current;
    const onProduct = active && PRODUCT_PAGES.has(productSlug);
    const flat = productSlug === "plisy" || productSlug === "moskitiery-ramkowe";
    const notAdded = !addedAtRef.current;

    // Powrót z koszykiem - raz na wizytę, zaraz po wejściu; nie dubluje paska „koszyk na e-mail”.
    if (!session.returnChecked) {
      writeSession({ ...session, returnChecked: true });
      session.returnChecked = true;
      const items = readCartItems().filter((item) => !NON_PRODUCT_POSITION_SLUGS.has(item.productSlug));
      let firstItemAt = 0;
      let cartEmailShown = false;
      try {
        firstItemAt = Number(window.sessionStorage.getItem("keika_cart_first_item_at")) || 0;
        cartEmailShown = !!window.sessionStorage.getItem(CART_EMAIL_SHOWN_KEY);
      } catch {
        firstItemAt = 0;
      }
      const isNewVisit = !document.referrer || !document.referrer.includes(window.location.host);
      if (items.length && isNewVisit && !cartEmailShown && (!firstItemAt || now - firstItemAt > 30 * 60 * 1000) && !seen("return_cart")) {
        return {
          id: "return_cart",
          title: "Witamy ponownie",
          text: "Zestawienie czeka w koszyku.",
          buttons: [
            { label: "Zobacz koszyk", primary: true, run: () => void (window.location.href = "/koszyk") },
            { label: "Później", run: () => undefined },
          ],
        };
      }
    }

    // Kolejne okno - 1,5 s po pierwszym dodaniu 1 szt. do koszyka, raz na wizytę, tylko gdy CRM
    // naprawdę liczy rabat ilościowy. Rabat nie dotyczy 1 szt., więc mówimy o 2 i 3 oknach.
    if (pendingRef.current === "more_windows" && now - addedAtRef.current > 1500) {
      pendingRef.current = null;
      if (!seen("more_windows") && qtyPromoLive()) {
        return {
          id: "more_windows",
          title: "Ma Pan/Pani więcej okien?",
          text: `${QTY_PROMO.name}: do -20 % na całe zakupy – 2 produkty -10 %, 3 i więcej -20 %. Mogą być różne, np. plisa i moskitiera.`,
          buttons: [
            { label: "Dodaj kolejne okno", primary: true, run: () => focusConfigurator(productSlug) },
            { label: "Tylko to jedno", run: () => undefined },
          ],
        };
      }
    }

    if (!onProduct) return null;

    // Okno dachowe, którego wyszukiwarka nie znalazła -> zdjęcie tabliczki.
    if (roofZeroAtRef.current && now - roofZeroAtRef.current > 2500 && idleMs > 2500 && !seen("roof_plate")) {
      return {
        id: "roof_plate",
        title: "Nie ma Pana/Pani okna?",
        text: "Proszę zrobić zdjęcie tabliczki na ramie okna, a odczytam model.",
        buttons: [
          { label: "Wyślę zdjęcie tabliczki", primary: true, run: () => openLiveChat("", { photo: "plate" }) },
          { label: "Podam wymiary", run: () => openLiveChat("", { send: "Nie znalazłem modelu okna w wyszukiwarce - mogę podać wymiary." }) },
        ],
      };
    }

    // Kłopot z wymiarem.
    if (flat && invalidAtRef.current && now - invalidAtRef.current > 3000 && idleMs > 2500 && !seen("dims_invalid")) {
      const plisy = productSlug === "plisy";
      return {
        id: "dims_invalid",
        title: plisy ? "Mierzy Pan/Pani szybę czy całe okno?" : "Kłopot z wymiarem?",
        text: "Pokażę, gdzie przyłożyć miarkę.",
        buttons: [
          {
            label: "Pokaż, jak mierzyć",
            primary: true,
            run: () =>
              plisy ? applyToConfigurator({ product: "plisy", measureGuide: true }) : openLiveChat("", { send: "Jak zmierzyć okno pod moskitierę ramkową?" }),
          },
          { label: "Wyślę zdjęcie okna", run: () => openLiveChat("Na zdjęciu moje okno - ", { photo: "auto" }) },
        ],
      };
    }

    // Skakanie po kolorach bez decyzji -> doradca kolorów ze zdjęcia.
    if (productSlug === "plisy" && colorPicksRef.current.length >= 5 && idleMs > 4000 && notAdded && !seen("color_indecision")) {
      colorPicksRef.current = [];
      return {
        id: "color_indecision",
        title: "Trudno wybrać kolor?",
        text: "Proszę wysłać zdjęcie pokoju, a dobiorę 3 tkaniny, które tam pasują.",
        buttons: [
          { label: "Wyślę zdjęcie pokoju", primary: true, run: () => openLiveChat("", { photo: "room" }) },
          { label: "Pomóż mi wybrać", run: () => openLiveChat("", { send: "Pomóż mi dobrać kolor plisy do pokoju." }) },
        ],
      };
    }

    // Wahanie przy montażu (plisy).
    if (productSlug === "plisy" && mountChangesRef.current >= 2 && idleMs > 3000 && !seen("mount_hesitate")) {
      return {
        id: "mount_hesitate",
        title: "Wynajmuje Pan/Pani lub nie chce wiercić?",
        text: "Montaż bezinwazyjny zaciska się na ramie okna. Jeśli można wiercić, wystarczy przykręcany.",
        buttons: [
          { label: "Wynajmuję", primary: true, run: () => applyToConfigurator({ product: "plisy", mount: "nieinwazyjny" }) },
          { label: "Mogę wiercić", run: () => applyToConfigurator({ product: "plisy", mount: "przykrecany" }) },
        ],
      };
    }

    // Nic nie dotknął w konfiguratorze, 35 s na stronie, 10 s bez ruchu, konfigurator wciąż na ekranie.
    if (flat && !touchedRef.current && !dimsEnteredRef.current && pageMs > 35_000 && idleMs > 10_000 && configuratorOnScreen() && !seen("dims_idle")) {
      const plisy = productSlug === "plisy";
      return {
        id: "dims_idle",
        title: "Pomóc z pomiarem?",
        text: "Wystarczą dwa wymiary okna, a cena pojawi się od razu.",
        buttons: [
          {
            label: "Jak zmierzyć?",
            primary: true,
            run: () =>
              plisy ? applyToConfigurator({ product: "plisy", measureGuide: true }) : openLiveChat("", { send: "Jak zmierzyć okno pod moskitierę ramkową?" }),
          },
          { label: "Mam wymiary", run: () => openLiveChat("Szerokość × wysokość okna: ") },
        ],
      };
    }

    // Przewinął ponad połowę strony, nie dotyka konfiguratora -> 3 pytania (nie w trakcie czytania opisu/opinii).
    if (flat && !touchedRef.current && maxScrollRef.current > 0.5 && pageMs > 40_000 && idleMs > 5000 && !seen("quiz")) {
      const plisy = productSlug === "plisy";
      return {
        id: "quiz",
        title: "Nie wie Pan/Pani, co wybrać?",
        text: "Trzy pytania, a podpowiem, co pasuje do okna.",
        buttons: [
          {
            label: "Zacznijmy",
            primary: true,
            run: () => openLiveChat("", { send: plisy ? "Pomóż mi wybrać plisę - zadaj mi 3 pytania." : "Pomóż mi wybrać moskitierę - zadaj mi 3 pytania." }),
          },
          { label: "Tylko oglądam", run: () => undefined },
        ],
      };
    }
    return null;
  }

  function dismiss() {
    if (!nudge) return;
    trackShopStep("assistant_nudge", nudge.id, { arm: "A", action: "dismiss", product: productSlug });
    writeSession({ ...readSession(), stopped: true });
    setNudge(null);
  }

  if (!nudge || arm !== "A") return null;

  return (
    <div className="as-nudge" role="status" aria-live="polite">
      <span className="as-nudge-arrow" aria-hidden="true" />
      <button type="button" className="as-nudge-close" aria-label="Nie pokazuj więcej podpowiedzi" onClick={dismiss}>
        ×
      </button>
      <div className="as-nudge-top">
        <span className="as-nudge-avatar" aria-hidden="true">
          K
        </span>
        <div>
          <strong>{nudge.title}</strong>
          <span>{nudge.text}</span>
        </div>
      </div>
      <div className="as-nudge-actions">
        {nudge.buttons.map((button) => (
          <button
            key={button.label}
            type="button"
            className={button.primary ? "is-primary" : ""}
            onClick={() => {
              trackShopStep("assistant_nudge", nudge.id, { arm: "A", action: "click", button: button.label, product: productSlug });
              button.run();
              setNudge(null);
            }}
          >
            {button.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/**
 * Miejsce dymka pod ikoną czatu w nagłówku: grupa A - mądry asystent, grupa B - żadnych dymków
 * (tylko ciche liczenie momentów asystenta; czysta kontrola od 31.10.2026), poza pilotem - stary
 * dymek czatu.
 */
export function HeaderChatNudge({ productSlug, active }: { productSlug: string; active: boolean }) {
  const [arm, setArm] = useState<AssistantArm | "pending">("pending");
  useEffect(() => {
    void resolveAssistantArm().then(setArm);
  }, []);
  if (arm === "pending") return null;
  return (
    <>
      {arm === "" ? <ChatNudge productSlug={productSlug} active={active} /> : null}
      {arm ? <AssistantNudges productSlug={productSlug} active={active} /> : null}
    </>
  );
}

/** Napis przy ikonie czatu (grupa A): „Pomogę dobrać” - sama okrągła ikonka ginęła obok koszyka. */
export function HeaderChatLabel() {
  const [show, setShow] = useState(false);
  useEffect(() => {
    void resolveAssistantArm().then((arm) => setShow(arm === "A"));
  }, []);
  return show ? <span className="header-chat-label">Pomogę dobrać</span> : null;
}
