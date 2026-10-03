"use client";

// "Dodatkowe 5% dla wychodzących z koszykiem" (test od 2026-10-03) - to, co
// klient widzi. Zasady, losowanie grupy i termin: lib/escape-offer.ts oraz
// core/lib/shop_escape_offer.php w CRM.
//
// Żadnych okienek w trakcie zakupu: na komputerze okno pojawia się dopiero,
// gdy kursor opuszcza stronę koszyka; na telefonie jest tylko krótka
// informacja nad paskiem "Razem" (bez zasłaniania strony), gdy klient
// przewinął koszyk do końca i nie tknął formularza. Okienka po bezczynności
// i przechwytywanie "wstecz" zostały zdjęte 13.09 i 01.10 - nie wracają.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatPln, readCartItems, type CartLineItem } from "@/lib/cart";
import {
  ESCAPE_OFFER_EVENT,
  ESCAPE_TAB_RETURN_MIN_HIDDEN_MS,
  formatEscapeDeadline,
  getActiveEscapeOffer,
  getEscapeOfferState,
  isReturnVisitWithCart,
  markEscapeOfferUsed,
  registerCartExitGate,
  requestEscapeOffer,
  syncEscapeOfferWithServer,
  type EscapeOfferState,
  type EscapeTrigger,
} from "@/lib/escape-offer";
import { formatPromoRemaining } from "@/lib/promo";
import { trackShopStep } from "@/lib/track-step";

const EXIT_REMINDER_SESSION_KEY = "keika_escape_exit_reminded";
/** Telefon i tablet: "koniec koszyka bez formularza" liczy się jako wyjście
 * tylko tam, gdzie koszyk jest długą, przewijaną stroną. */
const CART_BOTTOM_MAX_WIDTH = 900;

/** Aktywna oferta + czas do końca, odświeżane co 30 s i po każdej zmianie. */
export function useActiveEscapeOffer(): { offer: EscapeOfferState | null; remainingMs: number } {
  const [offer, setOffer] = useState<EscapeOfferState | null>(null);
  const [now, setNow] = useState(0);
  useEffect(() => {
    const sync = () => {
      const next = getActiveEscapeOffer();
      setOffer((current) => (current?.quoteCode === next?.quoteCode && current?.expiresAtMs === next?.expiresAtMs ? current : next));
      setNow(Date.now());
    };
    sync();
    window.addEventListener(ESCAPE_OFFER_EVENT, sync);
    const timer = window.setInterval(sync, 30000);
    return () => {
      window.removeEventListener(ESCAPE_OFFER_EVENT, sync);
      window.clearInterval(timer);
    };
  }, []);
  return { offer, remainingMs: offer ? Math.max(0, offer.expiresAtMs - now) : 0 };
}

export type CartEscapeOffer = {
  offer: EscapeOfferState | null;
  remainingMs: number;
  /** "modal" - okno przy wyjściu (komputer), "note" - informacja nad paskiem "Razem". */
  reveal: "modal" | "note" | null;
  closeReveal: (how: "cta" | "dismiss") => void;
  /** Znacznik końca koszyka - dojście do niego bez tknięcia formularza = wyjście. */
  bottomRef: (node: HTMLElement | null) => void;
};

/** Wyzwalacze oferty w koszyku. Pyta CRM najwyżej raz (pierwsza decyzja
 * zostaje), nigdy po rozpoczęciu formularza ani gdy zamówienie jest w toku. */
export function useCartEscapeOffer(options: {
  items: CartLineItem[];
  hydrated: boolean;
  /** Żadne pole kontaktowe ani adresowe nie ma treści. */
  contactUntouched: boolean;
  hasOrderDraft: boolean;
  orderConfirmed: boolean;
  /** W koszyku jest kod inny niż promocja sezonowa - nie dokładamy do niego. */
  foreignCode: boolean;
}): CartEscapeOffer {
  const { offer, remainingMs } = useActiveEscapeOffer();
  const [reveal, setReveal] = useState<{ mode: "modal" | "note"; trigger: EscapeTrigger } | null>(null);
  const optionsRef = useRef(options);
  useEffect(() => {
    optionsRef.current = options;
  });

  const canAsk = useCallback(() => {
    const current = optionsRef.current;
    return (
      current.hydrated &&
      current.items.length > 0 &&
      current.contactUntouched &&
      !current.hasOrderDraft &&
      !current.orderConfirmed &&
      !current.foreignCode
    );
  }, []);

  const show = useCallback((mode: "modal" | "note", trigger: EscapeTrigger, state: EscapeOfferState, fresh: boolean) => {
    setReveal({ mode, trigger });
    trackShopStep("escape_offer_shown", trigger, { mode, fresh, percent: state.percent }, state.quoteCode);
  }, []);

  /** Pyta o ofertę i - jeśli ta osoba ją dostała właśnie teraz - pokazuje ją. */
  const ask = useCallback(
    (trigger: EscapeTrigger, mode: "modal" | "note"): Promise<boolean> => {
      if (!canAsk()) return Promise.resolve(false);
      const hadDecision = getEscapeOfferState() !== null;
      return requestEscapeOffer(trigger, optionsRef.current.items).then((state) => {
        if (!state || state.arm !== "offer" || state.status !== "active" || Date.now() >= state.expiresAtMs) return false;
        // Oferta przyznana wcześniej jest już widoczna w podsumowaniu - drugi
        // raz przypominamy tylko po powrocie do sklepu.
        if (hadDecision && trigger !== "return_visit" && trigger !== "rm_return" && trigger !== "tab_return") return true;
        if (!canAsk()) return true;
        show(mode, trigger, state, !hadDecision);
        return true;
      });
    },
    [canAsk, show],
  );

  // Wyjście kursorem poza stronę (komputer). Ten sam sygnał obsługuje okno
  // "koszyk na e-mail" (lib/cart-email-nudge.ts) - pyta przez bramkę, czy
  // wyjście wzięła już ta oferta; grupa kontrolna dostaje je bez zmian.
  const exitCacheRef = useRef<{ at: number; promise: Promise<boolean> } | null>(null);
  const handleExit = useCallback((): Promise<boolean> => {
    const cached = exitCacheRef.current;
    if (cached && Date.now() - cached.at < 2000) return cached.promise;
    const promise = (async () => {
      if (!canAsk()) return false;
      const active = getActiveEscapeOffer();
      if (active) {
        // Ma ważną ofertę: jedno przypomnienie przy wyjściu na wizytę.
        let reminded = false;
        try {
          reminded = window.sessionStorage.getItem(EXIT_REMINDER_SESSION_KEY) === "1";
          window.sessionStorage.setItem(EXIT_REMINDER_SESSION_KEY, "1");
        } catch {
          reminded = true;
        }
        if (!reminded) show("modal", "cart_exit", active, false);
        return true;
      }
      const handled = await ask("cart_exit", "modal");
      if (handled) {
        try {
          window.sessionStorage.setItem(EXIT_REMINDER_SESSION_KEY, "1");
        } catch {
          // nic
        }
      }
      return handled;
    })().catch(() => false);
    exitCacheRef.current = { at: Date.now(), promise };
    return promise;
  }, [ask, canAsk, show]);

  useEffect(() => {
    registerCartExitGate(handleExit);
    const onMouseOut = (event: MouseEvent) => {
      if (event.relatedTarget || event.clientY > 8) return;
      void handleExit();
    };
    document.addEventListener("mouseout", onMouseOut);
    return () => {
      registerCartExitGate(null);
      document.removeEventListener("mouseout", onMouseOut);
    };
  }, [handleExit]);

  // Wejście do koszyka: sprawdzenie zapamiętanej oferty w CRM, a przy nowej
  // wizycie z koszykiem sprzed ponad 30 minut - pytanie o ofertę.
  const enteredRef = useRef(false);
  useEffect(() => {
    if (!options.hydrated || enteredRef.current) return;
    enteredRef.current = true;
    void syncEscapeOfferWithServer();
    if (!isReturnVisitWithCart(options.items)) return;
    let viaRemarketing = false;
    try {
      viaRemarketing = Boolean(new URLSearchParams(window.location.search).get("wroc"));
    } catch {
      // nic
    }
    void ask(viaRemarketing ? "rm_return" : "return_visit", "note");
  }, [options.hydrated, options.items, ask]);

  // Powrót do karty po dłuższej nieobecności.
  useEffect(() => {
    let hiddenAt = 0;
    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt >= ESCAPE_TAB_RETURN_MIN_HIDDEN_MS) void ask("tab_return", "note");
      hiddenAt = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [ask]);

  // Koniec koszyka bez tknięcia formularza (telefon, tablet).
  const observerRef = useRef<IntersectionObserver | null>(null);
  const bottomRef = useCallback(
    (node: HTMLElement | null) => {
      observerRef.current?.disconnect();
      observerRef.current = null;
      if (!node || typeof IntersectionObserver === "undefined") return;
      const observer = new IntersectionObserver(
        (entries) => {
          if (!entries.some((entry) => entry.isIntersecting)) return;
          if (window.innerWidth > CART_BOTTOM_MAX_WIDTH) return;
          void ask("cart_bottom", "note");
        },
        // Górna krawędź "okna" obserwatora sięga daleko ponad ekran: znacznik ma
        // 1 px, więc przy szybkim przewinięciu potrafi przeskoczyć z "pod
        // ekranem" od razu "nad ekran" i zwykłe przecięcie nigdy by nie zaszło.
        { threshold: 0, rootMargin: "200000px 0px -10% 0px" },
      );
      observer.observe(node);
      observerRef.current = observer;
    },
    [ask],
  );

  // Zamówienie złożone - rabat jest jednorazowy.
  useEffect(() => {
    if (options.orderConfirmed) markEscapeOfferUsed();
  }, [options.orderConfirmed]);

  const revealRef = useRef(reveal);
  useEffect(() => {
    revealRef.current = reveal;
  });
  const closeReveal = useCallback((how: "cta" | "dismiss") => {
    const current = revealRef.current;
    if (current) trackShopStep(how === "cta" ? "escape_offer_click" : "escape_offer_dismiss", current.trigger, { mode: current.mode });
    setReveal(null);
  }, []);

  return { offer, remainingMs, reveal: offer && reveal ? reveal.mode : null, closeReveal, bottomRef };
}

/** Okno przy wyjściu z koszyka (komputer) i informacja nad paskiem "Razem"
 * (telefon). Kwoty przychodzą z koszyka - to te same liczby, które klient
 * widzi w podsumowaniu. */
export function EscapeOfferCartReveal({
  controller,
  payable,
  payableWithoutOffer,
}: {
  controller: CartEscapeOffer;
  payable: number;
  payableWithoutOffer: number;
}) {
  const { offer, reveal, closeReveal } = controller;
  if (!offer || !reveal) return null;
  const deadline = formatEscapeDeadline(offer.expiresAtMs);
  const saved = Math.max(0, payableWithoutOffer - payable);

  if (reveal === "note") {
    return (
      <div className="escape-offer-note" role="status">
        <span className="escape-offer-note-badge">-{offer.percent}%</span>
        <span className="escape-offer-note-copy">
          <strong>Dodatkowe {offer.percent}% rabatu jest już w koszyku.</strong> Zamów najpóźniej {deadline}
          {saved > 0 ? (
            <>
              {" "}
              i zapłać <strong>{formatPln(payable)}</strong> zamiast {formatPln(payableWithoutOffer)}
            </>
          ) : null}
          .
        </span>
        <button type="button" className="escape-offer-note-close" aria-label="Zamknij" onClick={() => closeReveal("dismiss")}>
          ✕
        </button>
      </div>
    );
  }

  return (
    <div className="rescue-modal-overlay" role="presentation" onClick={() => closeReveal("dismiss")}>
      <div
        className="rescue-modal-shell escape-offer-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Dodatkowy rabat na ten koszyk"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="rescue-modal-close" onClick={() => closeReveal("dismiss")} aria-label="Zamknij">
          ✕
        </button>
        <div className="rescue-modal-discount-badge">
          <strong>-{offer.percent}%</strong>
          <span>
            dodatkowo
            <br />
            na ten koszyk
          </span>
        </div>
        <h3>Zamów najpóźniej {deadline} i zapłać mniej</h3>
        {saved > 0 ? (
          <div className="rescue-modal-savings-strip">
            Do zapłaty <strong>{formatPln(payable)}</strong> zamiast {formatPln(payableWithoutOffer)}.
          </div>
        ) : null}
        <p className="rescue-modal-lead">
          Rabat jest już doliczony w koszyku. Jest jednorazowy i przestaje działać {deadline.replace(" do ", " o ")}.
        </p>
        <button type="button" className="escape-offer-modal-cta" onClick={() => closeReveal("cta")}>
          Wracam do koszyka
        </button>
      </div>
    </div>
  );
}

/** Wąski pasek nad kwotą w mobilnym pasku "Razem": ile czasu zostało. */
export function EscapeOfferCountdownChip({ controller }: { controller: CartEscapeOffer }) {
  const { offer, remainingMs } = controller;
  if (!offer || remainingMs <= 0) return null;
  return (
    <div className="escape-offer-chip">
      Dodatkowe -{offer.percent}% jeszcze przez <strong>{formatPromoRemaining(remainingMs)}</strong>
    </div>
  );
}

/** Strony produktów: klient wrócił do sklepu z koszykiem sprzed ponad pół
 * godziny (albo z reklamy przypominającej). Jedna karta pod nagłówkiem, bez
 * zasłaniania strony; zamknięta nie wraca w tej wizycie. */
export function EscapeOfferReturnBar({ onVisible }: { onVisible?: () => void }) {
  const { offer } = useActiveEscapeOffer();
  const [open, setOpen] = useState(false);
  const onVisibleRef = useRef(onVisible);
  useEffect(() => {
    onVisibleRef.current = onVisible;
  });
  useEffect(() => {
    const items = readCartItems();
    if (!isReturnVisitWithCart(items)) return;
    let cancelled = false;
    let viaRemarketing = false;
    try {
      viaRemarketing = Boolean(new URLSearchParams(window.location.search).get("wroc"));
    } catch {
      // nic
    }
    const trigger: EscapeTrigger = viaRemarketing ? "rm_return" : "return_visit";
    const hadDecision = getEscapeOfferState() !== null;
    void requestEscapeOffer(trigger, items).then((state) => {
      if (cancelled || !state || state.arm !== "offer" || state.status !== "active" || Date.now() >= state.expiresAtMs) return;
      setOpen(true);
      onVisibleRef.current?.();
      trackShopStep("escape_offer_shown", trigger, { mode: "bar", fresh: !hadDecision, percent: state.percent }, state.quoteCode);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!open || !offer) return null;
  return (
    <div className="escape-offer-bar" role="status">
      <span className="escape-offer-note-badge">-{offer.percent}%</span>
      <span className="escape-offer-bar-copy">
        <strong>Masz dodatkowe {offer.percent}% rabatu na swój koszyk.</strong> Zamów najpóźniej {formatEscapeDeadline(offer.expiresAtMs)}.
      </span>
      <Link
        href="/koszyk"
        className="escape-offer-bar-cta"
        onClick={() => trackShopStep("escape_offer_click", "return_bar", { mode: "bar" }, offer.quoteCode)}
      >
        Do koszyka
      </Link>
      <button
        type="button"
        className="escape-offer-note-close"
        aria-label="Zamknij"
        onClick={() => {
          trackShopStep("escape_offer_dismiss", "return_bar", { mode: "bar" }, offer.quoteCode);
          setOpen(false);
        }}
      >
        ✕
      </button>
    </div>
  );
}
