"use client";

// "Koszyk na e-mail" offer timing (2026-09-26). Data-driven rules from 30
// days of quotes (see the owner's approval, 2026-09-26): quotes still alive
// 5 min after creation without reaching the form convert at 2.4%, then 0%;
// re-opened quotes 7% -> 1.7%; customers who started the checkout form
// convert at 43% and must never be interrupted; 43 of 72 sessions that
// reached the cart without the form left within 60 s. So the offer only
// appears at "leaving" moments and never during forward motion.
//
// Randomised 50/50 per device (getCartEmailArm) - the control arm never sees
// it, which is what makes the conversion effect measurable in the CRM.
import { useCallback, useEffect, useRef, useState } from "react";
import { runCartExitGate } from "@/lib/escape-offer";
import { getCartEmailArm, hasCartEmailSaved } from "@/lib/promo-save";
import { trackShopStep } from "@/lib/track-step";

const SHOWN_SESSION_KEY = "keika_cart_email_offer_shown";
const CART_FIRST_ITEM_AT_KEY = "keika_cart_first_item_at";

export type CartEmailTrigger = "cart_idle" | "cart_exit" | "cart_tab_return" | "configurator_idle" | "return_visit" | "rm_return" | "manual";

export function cartEmailOfferEligible(): boolean {
  if (typeof window === "undefined") return false;
  if (getCartEmailArm() !== "show") return false;
  if (hasCartEmailSaved()) return false;
  try {
    if (window.sessionStorage.getItem(SHOWN_SESSION_KEY)) return false;
  } catch {
    // ignore
  }
  return true;
}

function markShown(): void {
  try {
    window.sessionStorage.setItem(SHOWN_SESSION_KEY, String(Date.now()));
  } catch {
    // ignore
  }
}

/** Stamps when the cart first became non-empty in this session, so the
 * configurator rule ("quote older than 5 minutes") has a start point. */
export function noteCartHasItems(hasItems: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (!hasItems) return;
    if (!window.sessionStorage.getItem(CART_FIRST_ITEM_AT_KEY)) {
      window.sessionStorage.setItem(CART_FIRST_ITEM_AT_KEY, String(Date.now()));
    }
  } catch {
    // ignore
  }
}


export function useCartEmailNudge(options: {
  context: "cart" | "configurator";
  /** The offer only makes sense with something to save. */
  hasItems: boolean;
  /** Cart: true once the customer typed into any checkout field - hard stop. */
  formStarted?: boolean;
  /** Master switch (e.g. order already placed, thank-you screen). */
  enabled?: boolean;
}) {
  const { context, hasItems, formStarted = false, enabled = true } = options;
  const [open, setOpen] = useState(false);
  const [trigger, setTrigger] = useState<CartEmailTrigger | null>(null);
  const firedRef = useRef(false);
  const sentRef = useRef(false);

  const fire = useCallback(
    (why: CartEmailTrigger) => {
      if (firedRef.current) return;
      if (!cartEmailOfferEligible()) return;
      firedRef.current = true;
      markShown();
      setTrigger(why);
      setOpen(true);
      trackShopStep("cart_email_offer_shown", why, { context });
    },
    [context],
  );

  /** Explicit click on "Wyślij mi koszyk na e-mail" - the customer asked, so
   * the once-per-session / already-shown guards don't apply (only the arm
   * and "already saved" do). */
  const fireManual = useCallback(() => {
    if (getCartEmailArm() !== "show" || hasCartEmailSaved()) return false;
    firedRef.current = true;
    markShown();
    setTrigger("manual");
    setOpen(true);
    trackShopStep("cart_email_offer_shown", "manual", { context });
    return true;
  }, [context]);

  /** The modal calls this right after a successful send; it stays open on
   * its own success screen ("cena zamrożona do …") until the customer
   * closes it, and that close is then not counted as a dismissal. */
  const markSent = useCallback(() => {
    sentRef.current = true;
  }, []);

  const close = useCallback(
    (reason: "dismiss" | "sent" = "dismiss") => {
      setOpen(false);
      if (reason === "dismiss" && !sentRef.current && trigger) trackShopStep("cart_email_offer_dismiss", trigger, { context });
    },
    [context, trigger],
  );

  useEffect(() => {
    if (!enabled || !hasItems || formStarted || firedRef.current) return;
    if (!cartEmailOfferEligible()) return;
    noteCartHasItems(true);
    // Od 2026-10-01 tylko próba wyjścia ze strony (komputer). Bezczynność i
    // powrót do karty zdjęte (właściciel): od 28.09 okienko wyskakiwało 4×
    // częściej, "Zamknij" stało się najczęstszym kliknięciem w koszyku,
    // a spokojny baner na dole koszyka (tylko dla tych, co nie wpisali
    // danych) robi tę samą robotę bez przerywania.
    // Desktop exit intent: pointer leaving through the top edge (toward the
    // tab bar / address bar) - the classic "I'm about to close this" signal.
    const onMouseOut = (event: MouseEvent) => {
      if (context !== "cart") return;
      if (event.relatedTarget || event.clientY > 8) return;
      // Test "dodatkowe 5% dla wychodzących" (lib/escape-offer.ts): jeśli to
      // wyjście obsłużyła tamta oferta, okno e-mail milczy. Grupa kontrolna
      // i koszyki poza zasadami dostają je jak dotąd.
      void runCartExitGate().then((handled) => {
        if (!handled) fire("cart_exit");
      });
    };
    document.addEventListener("mouseout", onMouseOut);
    return () => {
      document.removeEventListener("mouseout", onMouseOut);
    };
  }, [context, enabled, hasItems, formStarted, fire]);

  return { open, trigger, fire, fireManual, close, markSent };
}
