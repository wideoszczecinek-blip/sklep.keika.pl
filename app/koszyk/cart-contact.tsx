"use client";

// Kontakt w koszyku (właściciel 10.11.2026: „w koszyku brakuje kontaktu do nas -
// przycisku zadzwoń i czatu - czat może się wyróżnić po chwili albo podpytać o coś”).
// Karta z dwoma przyciskami + dymek czatu, który raz na wizytę wysuwa się po
// chwili bezczynności (klient zawahał się przy danych albo płatności). Pływający
// przycisk czatu (chat-bubble.tsx) na /koszyk jest wyłączony - ten blok go zastępuje.
import "./cart-contact.css";
import { useEffect, useRef, useState } from "react";
import { openCrispChat } from "@/lib/crisp";
import { trackShopStep } from "@/lib/track-step";

const NUDGE_DONE_KEY = "keika_cart_chat_nudge_done";
const IDLE_MS = 40_000;
const AUTO_HIDE_MS = 30_000;
const PREFILL = "Dzień dobry, mam pytanie do zamówienia w koszyku: ";

function readSession(key: string): string | null {
  try {
    return window.sessionStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeSession(key: string, value: string): void {
  try {
    window.sessionStorage.setItem(key, value);
  } catch {
    // bez sessionStorage dymek może pokazać się jeszcze raz - nic groźnego
  }
}

// Dymek stoi nad dolnymi paskami koszyka (kwota, „dodatkowe -5%”), których
// wysokość zależy od wersji koszyka i stanu - mierzymy w chwili pokazania.
function bottomAboveFixedBars(): number {
  let top = window.innerHeight;
  document.querySelectorAll<HTMLElement>('[class*="sticky"], [class*="bar"], [class*="escape"], [class*="dock"], [class*="cookie"]').forEach((el) => {
    if (window.getComputedStyle(el).position !== "fixed" || el.closest(".cart-chat-nudge")) return;
    const r = el.getBoundingClientRect();
    // Paski przy dolnej krawędzi i wszystko, co stoi w dolnej połowie (np. baner cookies).
    if (r.width < window.innerWidth * 0.6 || r.height <= 0 || r.top < window.innerHeight * 0.45 || r.top >= window.innerHeight) return;
    top = Math.min(top, r.top);
  });
  return Math.max(16, Math.round(window.innerHeight - top + 12));
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M6.6 3.5h2.6l1.4 4-2 1.3a12 12 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6A2.1 2.1 0 0 1 18.4 20 15.4 15.4 0 0 1 4 5.6a2.1 2.1 0 0 1 2.1-2.1Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12c0-4.42 3.58-8 8-8s8 3.58 8 8-3.58 8-8 8c-1.1 0-2.15-.22-3.1-.62L4 21l1.4-4.2A7.94 7.94 0 0 1 4 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8.5" cy="12" r="1" fill="currentColor" />
      <circle cx="12" cy="12" r="1" fill="currentColor" />
      <circle cx="15.5" cy="12" r="1" fill="currentColor" />
    </svg>
  );
}

export default function CartContact({ phone, place }: { phone: string; place: "classic" | "v2" }) {
  const telHref = phone ? `tel:${phone.replace(/[^\d+]/g, "")}` : "";
  const [nudge, setNudge] = useState(false);
  const [bottom, setBottom] = useState<number | null>(null);
  const shownRef = useRef(false);


  // Dymek: raz na wizytę, po 40 s bez kliknięcia, pisania i przewijania; nie,
  // gdy klient już otwierał czat albo zamknął dymek.
  useEffect(() => {
    if (readSession(NUDGE_DONE_KEY) || readSession("keika_chat_opened")) return;
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      if (shownRef.current) return;
      timer = window.setTimeout(() => {
        if (shownRef.current || readSession(NUDGE_DONE_KEY) || readSession("keika_chat_opened")) return;
        if (document.visibilityState !== "visible") {
          arm();
          return;
        }
        shownRef.current = true;
        writeSession(NUDGE_DONE_KEY, "1");
        setBottom(bottomAboveFixedBars());
        setNudge(true);
        trackShopStep("cart_chat_nudge", "shown", { place });
      }, IDLE_MS);
    };
    const events: Array<keyof WindowEventMap> = ["pointerdown", "keydown", "scroll", "input"];
    events.forEach((name) => window.addEventListener(name, arm, { passive: true }));
    document.addEventListener("visibilitychange", arm);
    arm();
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, arm));
      document.removeEventListener("visibilitychange", arm);
    };
  }, [place]);

  useEffect(() => {
    if (!nudge) return;
    const hide = window.setTimeout(() => setNudge(false), AUTO_HIDE_MS);
    return () => window.clearTimeout(hide);
  }, [nudge]);

  const openChat = (source: string) => {
    setNudge(false);
    trackShopStep("cart_contact", "chat", { place, source });
    openCrispChat(PREFILL);
  };

  return (
    <>
      <section className="cart-contact" aria-label="Kontakt ze sklepem">
        <div className="cart-contact-head">
          <strong>Masz pytanie przed zamówieniem?</strong>
          <span>Pomożemy z wymiarem, dostawą albo płatnością.</span>
        </div>
        <div className="cart-contact-actions">
          {telHref ? (
            <a
              className="cart-contact-btn is-call"
              href={telHref}
              onClick={() => trackShopStep("cart_contact", "call", { place })}
            >
              <PhoneIcon />
              <span className="cart-contact-btn-text">
                <span>Zadzwoń</span>
                <small>{phone}</small>
              </span>
            </a>
          ) : null}
          <button
            type="button"
            className={`cart-contact-btn is-chat${nudge ? " is-attention" : ""}`}
            onClick={() => openChat("card")}
          >
            <ChatIcon />
            <span className="cart-contact-btn-text">
              <span>Napisz na czacie</span>
              <small>
                <i className="cart-contact-online" aria-hidden="true" /> odpowiadamy od razu
              </small>
            </span>
          </button>
        </div>
      </section>

      {nudge ? (
        <div
          className="cart-chat-nudge"
          role="dialog"
          aria-label="Pomoc przy zamówieniu"
          style={bottom !== null ? { bottom: `${bottom}px` } : undefined}
        >
          <button
            type="button"
            className="cart-chat-nudge-close"
            aria-label="Zamknij"
            onClick={() => {
              setNudge(false);
              trackShopStep("cart_chat_nudge", "dismiss", { place });
            }}
          >
            ✕
          </button>
          <span className="cart-chat-nudge-avatar" aria-hidden="true">
            <ChatIcon />
            <i className="cart-contact-online" />
          </span>
          <div className="cart-chat-nudge-body">
            <strong>Pomóc dokończyć zamówienie?</strong>
            <p>Wymiar, dostawa, płatność - napisz, odpowiadamy od razu.</p>
            <div className="cart-chat-nudge-actions">
              <button type="button" className="cart-chat-nudge-write" onClick={() => openChat("nudge")}>
                Napisz
              </button>
              {telHref ? (
                <a
                  className="cart-chat-nudge-call"
                  href={telHref}
                  onClick={() => trackShopStep("cart_contact", "call", { place, source: "nudge" })}
                >
                  Zadzwoń
                </a>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
