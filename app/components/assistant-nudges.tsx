"use client";

// Mądry asystent - dymki „we właściwej chwili” (właściciel, 24.10.2026; projekt i uwagi:
// https://claude.ai/artifact/NA8C3t2VVQXN1oQA4jhn6Z). Zastępuje prosty chat-nudge.tsx
// u klientów z grupy A (test właściciela ?asystent=<klucz> albo pilot, lib/assistant.ts).
//
// Zasada: sygnał -> bariera -> jedno krótkie pytanie z dwoma przyciskami odpowiedzi.
// O tym, KIEDY się odezwać, decydują reguły tutaj (zero kosztów AI); AI odpowiada dopiero,
// gdy klient kliknie albo napisze w czacie.
//
// Takt (żeby nie było natrętnie):
//  - najwyżej 1 dymek na 2 minuty i 3 na wizytę; „×” = cisza do końca wizyty,
//  - nigdy przy otwartym czacie, w trakcie pisania, przy otwartym oknie (rabat przy wyjściu,
//    koszyk na e-mail, zapis wyceny...) ani w koszyku i kasie,
//  - asystent nie wymyśla rabatów (tylko istniejący rabat za zapis oferty), nie promuje Ekspresu,
//    przekazanie do człowieka zostaje jak było.
// Grupa B pilota: te same reguły liczą „ciche pokazy” (assistant_nudge / action=ghost) bez dymka.

import { useEffect, useRef, useState } from "react";
import {
  CART_ADDED_EVENT,
  applyToConfigurator,
  resolveAssistantArm,
  setAssistantSpeaking,
  type AssistantArm,
} from "@/lib/assistant";
import { NON_PRODUCT_POSITION_SLUGS, clearCart, readCartItems, writeCartItems, type CartLineItem } from "@/lib/cart";
import { CONFIGURATOR_STATE_EVENT, getConfiguratorState, type ConfiguratorProgress } from "@/lib/configurator-state";
import { crmGetJson } from "@/lib/crm-get";
import { openLiveChat } from "@/lib/live-chat";
import { isPromoActive, PROMO_CODE } from "@/lib/promo";
import { buildRescuePosition, getRescueGrant, saveRescueContact, setRescueGrant } from "@/lib/rescue";
import { getSessionToken } from "@/lib/analytics-context";
import { SHOP_STEP_EVENT, trackShopStep, type ShopStepDetail } from "@/lib/track-step";
import ChatNudge from "./chat-nudge";
import { CRM_PUBLIC_BASE } from "./payment-methods";

type MomentId =
  | "dims_idle"
  | "dims_invalid"
  | "color_indecision"
  | "price_hesitate"
  | "mount_hesitate"
  | "save_offer"
  | "more_windows"
  | "roof_plate"
  | "return_cart"
  | "quiz";

type Button = { label: string; primary?: boolean; run: () => void | "keep" };
type Nudge = { id: MomentId; title: string; text: string; buttons: Button[] };

const GAP_MS = 120_000;
const MAX_PER_VISIT = 3;
const AUTO_HIDE_MS = 25_000;
const SESSION_KEY = "keika_assistant_nudges_v1";
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

function formatZl(value: number): string {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Coś innego właśnie mówi do klienta (okno rabatu, koszyka na e-mail, poradnik...) albo klient pisze. */
function stageBusy(): boolean {
  if (document.querySelector(".lc-panel")) return true;
  const active = document.activeElement as HTMLElement | null;
  if (active && /^(INPUT|TEXTAREA|SELECT)$/.test(active.tagName)) return true;
  const dialogs = Array.from(document.querySelectorAll<HTMLElement>('[aria-modal="true"], [role="dialog"], [role="alertdialog"]'));
  if (dialogs.some((el) => !el.classList.contains("as-nudge") && el.offsetParent !== null)) return true;
  if (document.querySelector(".cart-email-banner, .escape-offer-modal, .promo-save-modal, .rescue-modal")) return true;
  return false;
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
  window.setTimeout(() => panel.querySelector<HTMLInputElement>('input[inputmode="decimal"], input[type="number"], input[type="text"]')?.focus({ preventScroll: true }), 400);
}

/** Przewija do przycisku „Dodaj do koszyka” i na chwilę go podświetla. */
function highlightAddToCart(): void {
  const button = Array.from(document.querySelectorAll<HTMLButtonElement>("button")).find(
    (el) => /dodaj do koszyka/i.test(el.textContent || "") && el.offsetParent !== null,
  );
  if (!button) return;
  button.scrollIntoView({ behavior: "smooth", block: "center" });
  button.classList.add("as-flash");
  window.setTimeout(() => button.classList.remove("as-flash"), 2400);
}

export default function AssistantNudges({ productSlug, active }: { productSlug: string; active: boolean }) {
  const [arm, setArm] = useState<AssistantArm>("");
  const [nudge, setNudge] = useState<Nudge | null>(null);
  const [form, setForm] = useState<"none" | "email" | "saving" | "saved" | "cleared">("none");
  const [email, setEmail] = useState("");
  const [formMessage, setFormMessage] = useState("");

  const armRef = useRef<AssistantArm>("");
  const nudgeRef = useRef<Nudge | null>(null);
  const pageStartRef = useRef(Date.now());
  const lastActivityRef = useRef(Date.now());
  const touchedRef = useRef(false);
  const dimsEnteredRef = useRef(false);
  const invalidAtRef = useRef(0);
  const colorPicksRef = useRef<number[]>([]);
  const mountChangesRef = useRef(0);
  const priceSeenAtRef = useRef(0);
  const priceRef = useRef(0);
  const addedAtRef = useRef(0);
  const hiddenAtRef = useRef(0);
  const returnedFromTabRef = useRef(0);
  const roofZeroAtRef = useRef(0);
  const maxScrollRef = useRef(0);
  const pendingRef = useRef<MomentId | null>(null);
  const paymentsRef = useRef({ paypo: false, installments: false });
  const firedThisPageRef = useRef<Set<string>>(new Set());
  const clearedCartRef = useRef<CartLineItem[] | null>(null);

  armRef.current = arm;
  nudgeRef.current = nudge;

  useEffect(() => {
    void resolveAssistantArm().then(setArm);
    crmGetJson<{ checkout?: Record<string, unknown> }>(`${CRM_PUBLIC_BASE}/site`)
      .then((json) => {
        const c = json?.checkout || {};
        paymentsRef.current = {
          paypo: c.p24_enabled === true && c.p24_paypo_enabled === true,
          installments: c.p24_enabled === true && c.p24_installments_enabled === true,
        };
      })
      .catch(() => null);
  }, []);

  // Zmiana produktu = nowa strona: liczniki chwil od zera (limity wizyty zostają w sessionStorage).
  useEffect(() => {
    pageStartRef.current = Date.now();
    touchedRef.current = false;
    dimsEnteredRef.current = false;
    invalidAtRef.current = 0;
    colorPicksRef.current = [];
    mountChangesRef.current = 0;
    priceSeenAtRef.current = 0;
    priceRef.current = 0;
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
    const onScroll = () => {
      lastActivityRef.current = Date.now();
      const doc = document.documentElement;
      const depth = (window.scrollY + window.innerHeight) / Math.max(1, doc.scrollHeight);
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
    const onState = (event: Event) => {
      const st = (event as CustomEvent<ConfiguratorProgress>).detail;
      const price = Number(st?.display_price ?? st?.price ?? 0) || 0;
      if (price > 0 && !priceSeenAtRef.current) priceSeenAtRef.current = Date.now();
      priceRef.current = price;
    };
    const onCartAdded = (event: Event) => {
      const detail = (event as CustomEvent<{ productSlug?: string; qty?: number; count?: number }>).detail || {};
      addedAtRef.current = Date.now();
      if (detail.count === 1 && Number(detail.qty) === 1) pendingRef.current = "more_windows";
    };
    const onVisibility = () => {
      if (document.visibilityState === "hidden") hiddenAtRef.current = Date.now();
      else if (hiddenAtRef.current && Date.now() - hiddenAtRef.current >= 10_000) returnedFromTabRef.current = Date.now();
    };
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener(SHOP_STEP_EVENT, onStep);
    window.addEventListener(CONFIGURATOR_STATE_EVENT, onState);
    window.addEventListener(CART_ADDED_EVENT, onCartAdded);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener(SHOP_STEP_EVENT, onStep);
      window.removeEventListener(CONFIGURATOR_STATE_EVENT, onState);
      window.removeEventListener(CART_ADDED_EVENT, onCartAdded);
      document.removeEventListener("visibilitychange", onVisibility);
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
      if (stageBusy()) return;
      const candidate = pickMoment(session);
      if (!candidate) return;
      firedThisPageRef.current.add(candidate.id);
      writeSession({ ...session, shown: [...session.shown, candidate.id], lastAt: Date.now() });
      if (armRef.current === "B") {
        trackShopStep("assistant_nudge", candidate.id, { arm: "B", action: "ghost", product: productSlug });
        return;
      }
      trackShopStep("assistant_nudge", candidate.id, { arm: "A", action: "shown", product: productSlug });
      setForm("none");
      setFormMessage("");
      setNudge(candidate);
    }, 2000);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [arm, productSlug, active]);

  useEffect(() => {
    setAssistantSpeaking(!!nudge);
    if (!nudge || form !== "none") return;
    const timer = window.setTimeout(() => setNudge(null), AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [nudge, form]);

  function pickMoment(session: SessionState): Nudge | null {
    const now = Date.now();
    const seen = (id: MomentId) => session.shown.includes(id) || firedThisPageRef.current.has(id);
    const idleMs = now - lastActivityRef.current;
    const pageMs = now - pageStartRef.current;
    const onProduct = active && PRODUCT_PAGES.has(productSlug);
    const flat = productSlug === "plisy" || productSlug === "moskitiery-ramkowe";
    const st = getConfiguratorState();
    const price = priceRef.current;
    const notAdded = !addedAtRef.current;

    // Powrót z koszykiem - raz na wizytę, zaraz po wejściu.
    if (!session.returnChecked) {
      writeSession({ ...session, returnChecked: true });
      session.returnChecked = true;
      const items = readCartItems().filter((item) => !NON_PRODUCT_POSITION_SLUGS.has(item.productSlug));
      let firstItemAt = 0;
      try {
        firstItemAt = Number(window.sessionStorage.getItem("keika_cart_first_item_at")) || 0;
      } catch {
        firstItemAt = 0;
      }
      const isNewVisit = !document.referrer || !document.referrer.includes(window.location.host);
      if (items.length && isNewVisit && (!firstItemAt || now - firstItemAt > 30 * 60 * 1000) && !seen("return_cart")) {
        return {
          id: "return_cart",
          title: "Witaj ponownie!",
          text: "Twoje zestawienie czeka w koszyku.",
          buttons: [
            { label: "Zobacz koszyk", primary: true, run: () => void (window.location.href = "/koszyk") },
            {
              label: "Zacznij od nowa",
              run: () => {
                clearedCartRef.current = readCartItems();
                clearCart();
                setForm("cleared");
                return "keep";
              },
            },
          ],
        };
      }
    }

    // Kolejne okno - zaraz po pierwszym dodaniu do koszyka, tylko gdy promocja naprawdę trwa.
    if (pendingRef.current === "more_windows" && now - addedAtRef.current > 1500) {
      pendingRef.current = null;
      if (!seen("more_windows") && isPromoActive(PROMO_CODE)) {
        return {
          id: "more_windows",
          title: "Masz więcej okien?",
          text: "Dodaj je teraz, póki trwają promocje.",
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
        title: "Nie ma Twojego okna?",
        text: "Zrób zdjęcie tabliczki na ramie okna, a odczytam model.",
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
        title: plisy ? "Mierzysz szybę czy całe okno?" : "Kłopot z wymiarem?",
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
        text: "Wyślij zdjęcie pokoju, a dobiorę 3 tkaniny, które tam pasują - i powiem dlaczego.",
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
        title: "Wynajmujesz albo nie chcesz wiercić?",
        text: "Bezinwazyjny montaż zaciska się na ramie okna. Jeśli możesz wiercić, przykręcany wystarczy.",
        buttons: [
          { label: "Wynajmuję", primary: true, run: () => applyToConfigurator({ product: "plisy", mount: "nieinwazyjny" }) },
          { label: "Mogę wiercić", run: () => applyToConfigurator({ product: "plisy", mount: "przykrecany" }) },
        ],
      };
    }

    // Waha się z gotową wyceną -> zapis oferty na e-mail za rabat (istniejący rabat za zapis).
    const hasOffer = price > 0 && st && (st.width_mm || 0) > 0 && (st.height_mm || 0) > 0 && !!st.fabric_label;
    const hesitating =
      (returnedFromTabRef.current && now - returnedFromTabRef.current < 60_000) ||
      (priceSeenAtRef.current && now - priceSeenAtRef.current > 45_000 && idleMs > 15_000);
    if (flat && hasOffer && notAdded && hesitating && !getRescueGrant() && !seen("save_offer")) {
      return {
        id: "save_offer",
        title: "Zapisz tę ofertę na e-mail",
        text: "Dostaniesz do niej indywidualny rabat, a link do wyceny przyjdzie w wiadomości.",
        buttons: [
          {
            label: "Zapisz i odbierz rabat",
            primary: true,
            run: () => {
              setForm("email");
              return "keep";
            },
          },
          { label: "Nie teraz", run: () => undefined },
        ],
      };
    }

    // Widział cenę i się waha -> płatność później / raty.
    if (flat && price >= 250 && notAdded && priceSeenAtRef.current && now - priceSeenAtRef.current > 30_000 && idleMs > 10_000 && !seen("price_hesitate")) {
      const { paypo, installments } = paymentsRef.current;
      if (installments && price >= 1000) {
        return {
          id: "price_hesitate",
          title: "Możesz rozłożyć to na raty",
          text: `${formatZl(price)} zł możesz spłacać w ratach - wybierasz je przy płatności.`,
          buttons: [
            { label: "Jak to działa?", primary: true, run: () => openLiveChat("", { send: "Jak działają raty przy zakupie?" }) },
            { label: "Dodaj do koszyka", run: () => highlightAddToCart() },
          ],
        };
      }
      if (paypo) {
        return {
          id: "price_hesitate",
          title: "Zapłać dopiero za 30 dni",
          text: "Z PayPo płacisz po otrzymaniu - wybierasz je przy płatności.",
          buttons: [
            { label: "Jak to działa?", primary: true, run: () => openLiveChat("", { send: "Jak działa płatność PayPo za 30 dni?" }) },
            { label: "Dodaj do koszyka", run: () => highlightAddToCart() },
          ],
        };
      }
    }

    // Nic nie wpisał - wycena w 10 sekund.
    if (flat && !touchedRef.current && !dimsEnteredRef.current && pageMs > 20_000 && idleMs > 8000 && !seen("dims_idle")) {
      const plisy = productSlug === "plisy";
      return {
        id: "dims_idle",
        title: "Masz wymiary okna?",
        text: "Cenę podam w 10 sekund.",
        buttons: [
          { label: "Mam wymiary", primary: true, run: () => openLiveChat("Szerokość × wysokość okna: ") },
          {
            label: "Jak zmierzyć?",
            run: () =>
              plisy ? applyToConfigurator({ product: "plisy", measureGuide: true }) : openLiveChat("", { send: "Jak zmierzyć okno pod moskitierę ramkową?" }),
          },
        ],
      };
    }

    // Czyta opis, nie dotyka konfiguratora -> 3 pytania.
    if (flat && !touchedRef.current && maxScrollRef.current > 0.5 && pageMs > 40_000 && idleMs > 5000 && !seen("quiz")) {
      const plisy = productSlug === "plisy";
      return {
        id: "quiz",
        title: "Nie wiesz, co wybrać?",
        text: "Odpowiedz na 3 pytania, a powiem, co pasuje do Twojego okna.",
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

  function close(action: "dismiss" | "later") {
    if (!nudge) return;
    trackShopStep("assistant_nudge", nudge.id, { arm: "A", action, product: productSlug });
    if (action === "dismiss") writeSession({ ...readSession(), stopped: true });
    setNudge(null);
    setForm("none");
  }

  async function saveOffer() {
    const st = getConfiguratorState();
    const value = email.trim();
    if (!/.+@.+\..+/.test(value)) {
      setFormMessage("Wpisz poprawny adres e-mail.");
      return;
    }
    const price = Number(st?.display_price ?? st?.price ?? 0) || 0;
    if (!st || price <= 0) {
      setFormMessage("Najpierw dokończ wycenę - wtedy zapiszemy ją z rabatem.");
      return;
    }
    setForm("saving");
    setFormMessage("");
    const position = buildRescuePosition({
      productSlug: st.product,
      productLabel: st.product_label || "Produkt na wymiar",
      hardwareLabel: st.hardware_label || "",
      meshLabel: st.fabric_label || "",
      widthMm: st.width_mm,
      heightMm: st.height_mm,
      qty: Math.max(1, st.qty || 1),
      total: price,
    });
    const result = await saveRescueContact({
      position,
      email: value,
      sessionToken: getSessionToken(),
      promoCode: isPromoActive(PROMO_CODE) ? PROMO_CODE : undefined,
    });
    if (!result.ok || !result.quoteCode) {
      setForm("email");
      setFormMessage(result.error || "Nie udało się zapisać. Spróbuj ponownie.");
      return;
    }
    setRescueGrant({ quoteCode: result.quoteCode, percent: result.discountPercent || 5 });
    trackShopStep("assistant_nudge", "save_offer", { arm: "A", action: "saved", product: productSlug, percent: result.discountPercent || 5 });
    setForm("saved");
    setFormMessage(`Zapisane! Rabat ${result.discountPercent || 5}% doliczymy w koszyku, a link do oferty wysłaliśmy na ${value}.`);
  }

  if (!nudge || arm !== "A") return null;

  return (
    <div className="as-nudge" role="status" aria-live="polite">
      <span className="as-nudge-arrow" aria-hidden="true" />
      <button type="button" className="as-nudge-close" aria-label="Nie pokazuj więcej podpowiedzi" onClick={() => close("dismiss")}>
        ×
      </button>
      <div className="as-nudge-top">
        <span className="as-nudge-avatar" aria-hidden="true">
          K
        </span>
        <div>
          <strong>{nudge.title}</strong>
          {form === "none" || form === "email" || form === "saving" ? <span>{nudge.text}</span> : null}
        </div>
      </div>
      {form === "none" ? (
        <div className="as-nudge-actions">
          {nudge.buttons.map((button) => (
            <button
              key={button.label}
              type="button"
              className={button.primary ? "is-primary" : ""}
              onClick={() => {
                trackShopStep("assistant_nudge", nudge.id, { arm: "A", action: "click", button: button.label, product: productSlug });
                const keep = button.run();
                if (keep !== "keep") setNudge(null);
              }}
            >
              {button.label}
            </button>
          ))}
        </div>
      ) : null}
      {form === "email" || form === "saving" ? (
        <form
          className="as-nudge-form"
          onSubmit={(e) => {
            e.preventDefault();
            void saveOffer();
          }}
        >
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Twój e-mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <button type="submit" className="is-primary" disabled={form === "saving"}>
            {form === "saving" ? "Zapisuję…" : "Zapisz"}
          </button>
        </form>
      ) : null}
      {form === "saved" ? (
        <div className="as-nudge-done">
          <span>{formMessage}</span>
          <button type="button" className="is-primary" onClick={() => setNudge(null)}>
            Dziękuję
          </button>
        </div>
      ) : null}
      {form === "cleared" ? (
        <div className="as-nudge-done">
          <span>Koszyk wyczyszczony - możesz zacząć od nowa.</span>
          <div className="as-nudge-actions">
            <button
              type="button"
              onClick={() => {
                if (clearedCartRef.current) writeCartItems(clearedCartRef.current);
                window.location.reload();
              }}
            >
              Cofnij
            </button>
            <button
              type="button"
              className="is-primary"
              onClick={() => {
                setNudge(null);
                window.location.reload();
              }}
            >
              OK
            </button>
          </div>
        </div>
      ) : null}
      {formMessage && form === "email" ? <p className="as-nudge-msg">{formMessage}</p> : null}
      {form === "email" ? (
        <p className="as-nudge-foot">
          <button type="button" onClick={() => close("later")}>
            Nie teraz
          </button>
        </p>
      ) : null}
    </div>
  );
}

/**
 * Miejsce dymka pod ikoną czatu w nagłówku: grupa A - mądry asystent, grupa B - stary dymek
 * czatu + ciche liczenie momentów asystenta, poza pilotem - stary dymek.
 */
export function HeaderChatNudge({ productSlug, active }: { productSlug: string; active: boolean }) {
  const [arm, setArm] = useState<AssistantArm | "pending">("pending");
  useEffect(() => {
    void resolveAssistantArm().then(setArm);
  }, []);
  if (arm === "pending") return null;
  return (
    <>
      {arm !== "A" ? <ChatNudge productSlug={productSlug} active={active} /> : null}
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
