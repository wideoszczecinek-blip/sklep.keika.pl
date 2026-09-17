"use client";

// The chat "leans out" on the product pages (owner, 2026-09-17: "czat w
// odpowiednim momencie powinien bardziej się wychylić i spytać, czy może w
// czymś pomóc"). Both landings (moskitiery-ramkowe, plisy) only had the
// small header icon - the floating ChatBubble teaser is deliberately off
// there - so nobody stuck on a step was ever asked.
//
// A speech bubble drops out from under the header chat icon, once per
// session, on the FIRST of these moments:
//   - dimensions_invalid       -> the size didn't validate ("kłopot z wymiarem?")
//   - idle_in_configurator     -> 45 s without any interaction after the
//                                 customer started configuring
//   - idle_on_page             -> 75 s on the page without touching the
//                                 configurator at all
// Never when the chat was already opened this session (lib/crisp.ts sets
// keika_chat_opened) or the bubble was dismissed. It listens to the
// SHOP_STEP_EVENT broadcast from lib/track-step.ts, so the configurators
// themselves know nothing about it. "Napisz" opens Crisp with the question
// already typed in.
import { useEffect, useRef, useState } from "react";
import { openCrispChat } from "@/lib/crisp";
import { SHOP_STEP_EVENT, trackShopStep, type ShopStepDetail } from "@/lib/track-step";

type Trigger = "dimensions_invalid" | "idle_in_configurator" | "idle_on_page";

const DISMISSED_KEY = "keika_chat_nudge_done";
const IDLE_IN_CONFIGURATOR_MS = 45_000;
const IDLE_ON_PAGE_MS = 75_000;
const AUTO_HIDE_MS = 16_000;

const CONFIGURATOR_STEP = /^(select_|enter_dimensions|configurator_|quick_price_|dimension_unit|accept_sag|surcharge_|edit_position|add_to_cart|express_toggled)/;

function productWord(slug: string): string {
  return slug === "plisy" ? "plisy" : "moskitiery";
}

function copyFor(trigger: Trigger, slug: string): { title: string; text: string; prefill: string } {
  const product = productWord(slug);
  if (trigger === "dimensions_invalid") {
    return {
      title: "Kłopot z wymiarem?",
      text: "Napisz, podpowiem jak zmierzyć okno pod " + (slug === "plisy" ? "plisę" : "moskitierę") + ". Odpowiadamy w kilka minut.",
      prefill: `Dzień dobry, mam pytanie o pomiar okna pod ${slug === "plisy" ? "plisę" : "moskitierę"}: `,
    };
  }
  if (trigger === "idle_in_configurator") {
    return {
      title: "Mogę w czymś pomóc?",
      text:
        slug === "plisy"
          ? "Dobór tkaniny, montaż, pomiar — napisz, doradzę na żywo."
          : "Dobór ramki, siatki, pomiar — napisz, doradzę na żywo.",
      prefill: `Dzień dobry, konfiguruję ${product} i mam pytanie: `,
    };
  }
  return {
    title: "Cześć! Masz pytanie?",
    text: `Jeśli coś jest niejasne przy wyborze ${product} — napisz, odpowiadamy w kilka minut.`,
    prefill: `Dzień dobry, mam pytanie o ${product}: `,
  };
}

export default function ChatNudge({ productSlug, active }: { productSlug: string; active: boolean }) {
  const [trigger, setTrigger] = useState<Trigger | null>(null);
  const firedRef = useRef(false);
  const touchedConfiguratorRef = useRef(false);
  const idleTimerRef = useRef<number | null>(null);
  const pageTimerRef = useRef<number | null>(null);

  function alreadyDone(): boolean {
    try {
      return window.sessionStorage.getItem(DISMISSED_KEY) === "1" || window.sessionStorage.getItem("keika_chat_opened") === "1";
    } catch {
      return false;
    }
  }

  function markDone() {
    try {
      window.sessionStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // nic do zrobienia
    }
  }

  useEffect(() => {
    if (!active || firedRef.current || alreadyDone()) return;

    const fire = (next: Trigger) => {
      if (firedRef.current || alreadyDone()) return;
      firedRef.current = true;
      setTrigger(next);
      trackShopStep("chat_nudge_shown", next, { product: productSlug });
    };

    const armIdle = () => {
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      idleTimerRef.current = window.setTimeout(() => fire("idle_in_configurator"), IDLE_IN_CONFIGURATOR_MS);
    };

    const onStep = (event: Event) => {
      const detail = (event as CustomEvent<ShopStepDetail>).detail;
      if (!detail) return;
      if (detail.eventName === "dimensions_invalid" || detail.eventName === "dimensions_over_limit") {
        fire("dimensions_invalid");
        return;
      }
      if (CONFIGURATOR_STEP.test(detail.eventName)) {
        touchedConfiguratorRef.current = true;
        if (pageTimerRef.current) window.clearTimeout(pageTimerRef.current);
        armIdle();
      }
    };
    // Any interaction at all resets the "stuck" clock - the nudge is for
    // someone who stopped, not someone reading.
    const onActivity = () => {
      if (touchedConfiguratorRef.current) armIdle();
    };

    window.addEventListener(SHOP_STEP_EVENT, onStep);
    window.addEventListener("pointerdown", onActivity, { passive: true });
    window.addEventListener("keydown", onActivity);
    window.addEventListener("scroll", onActivity, { passive: true, capture: true });
    pageTimerRef.current = window.setTimeout(() => {
      if (!touchedConfiguratorRef.current) fire("idle_on_page");
    }, IDLE_ON_PAGE_MS);

    return () => {
      window.removeEventListener(SHOP_STEP_EVENT, onStep);
      window.removeEventListener("pointerdown", onActivity);
      window.removeEventListener("keydown", onActivity);
      window.removeEventListener("scroll", onActivity, { capture: true });
      if (idleTimerRef.current) window.clearTimeout(idleTimerRef.current);
      if (pageTimerRef.current) window.clearTimeout(pageTimerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, productSlug]);

  useEffect(() => {
    if (!trigger) return;
    const timer = window.setTimeout(() => {
      setTrigger(null);
      markDone();
    }, AUTO_HIDE_MS);
    return () => window.clearTimeout(timer);
  }, [trigger]);

  if (!trigger || !active) return null;
  const copy = copyFor(trigger, productSlug);

  return (
    <div className="chat-nudge" role="status" aria-live="polite">
      <span className="chat-nudge-arrow" aria-hidden="true" />
      <button
        type="button"
        className="chat-nudge-close"
        aria-label="Zamknij"
        onClick={() => {
          trackShopStep("chat_nudge_dismiss", trigger, { product: productSlug });
          markDone();
          setTrigger(null);
        }}
      >
        ×
      </button>
      <strong>{copy.title}</strong>
      <span>{copy.text}</span>
      <button
        type="button"
        className="chat-nudge-cta"
        onClick={() => {
          trackShopStep("chat_nudge_click", trigger, { product: productSlug });
          markDone();
          setTrigger(null);
          openCrispChat(copy.prefill);
        }}
      >
        Napisz do nas
      </button>
    </div>
  );
}
