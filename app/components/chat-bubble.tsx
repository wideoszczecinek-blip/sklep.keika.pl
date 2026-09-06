"use client";

// Global "premium" chat launcher - Crisp itself stays lazy-loaded (see
// lib/crisp.ts, unchanged: the real widget script only loads on first
// click), but before that there was no visible invitation to chat at all
// anywhere on the site. This is a custom-styled floating button + a
// self-dismissing speech-bubble teaser, present via app/layout.tsx on every
// page EXCEPT: the main product page ("/") - that one has its own
// header-integrated chat icon instead (right before the cart icon, so it
// scales with the header's own compact/full state - see app/page.tsx's
// .header-chat-button); and /koszyk on mobile only, where the floating
// bubble got in the way of the cart's own UI - desktop koszyk keeps it as
// a plain floating button, unchanged, per explicit instruction.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { openCrispChat } from "@/lib/crisp";

const LAUNCHER_DELAY_MS = 5000;
const TEASER_DELAY_MS = LAUNCHER_DELAY_MS + 800;
const TEASER_AUTO_HIDE_MS = 9000;
const TEASER_DISMISSED_KEY = "keika_chat_teaser_dismissed";

export default function ChatBubble() {
  const pathname = usePathname();
  const isProductPage = pathname === "/";
  const isCartPage = pathname === "/koszyk";
  const [isMobile, setIsMobile] = useState(false);
  const [teaserVisible, setTeaserVisible] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);

  const suppressed = isProductPage || (isCartPage && isMobile);

  useEffect(() => {
    if (suppressed) return;
    let dismissedThisSession = false;
    try {
      dismissedThisSession = window.sessionStorage.getItem(TEASER_DISMISSED_KEY) === "1";
    } catch {
      // sessionStorage niedostępny - pokaż tak czy inaczej, nic tu nie zależy od trwałości.
    }
    if (dismissedThisSession) return;

    const showTimer = window.setTimeout(() => setTeaserVisible(true), TEASER_DELAY_MS);
    return () => window.clearTimeout(showTimer);
  }, [suppressed]);

  useEffect(() => {
    if (!teaserVisible) return;
    const hideTimer = window.setTimeout(() => dismissTeaser(), TEASER_AUTO_HIDE_MS);
    return () => window.clearTimeout(hideTimer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teaserVisible]);

  // The launcher itself waits before appearing at all - popping in the
  // instant the page loads read as competing with everything else still
  // settling in, especially on mobile.
  useEffect(() => {
    if (suppressed) return;
    const timer = window.setTimeout(() => setEntered(true), LAUNCHER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [suppressed]);

  if (suppressed) return null;

  function dismissTeaser() {
    setTeaserVisible(false);
    try {
      window.sessionStorage.setItem(TEASER_DISMISSED_KEY, "1");
    } catch {
      // nic do zrobienia
    }
  }

  function handleOpen() {
    dismissTeaser();
    openCrispChat();
  }

  return (
    <div className={`chat-bubble-root ${entered ? "is-entered" : ""}`}>
      {teaserVisible ? (
        <div className="chat-bubble-teaser" role="status">
          <button
            type="button"
            className="chat-bubble-teaser-close"
            aria-label="Zamknij"
            onClick={(event) => {
              event.stopPropagation();
              dismissTeaser();
            }}
          >
            ✕
          </button>
          <button type="button" className="chat-bubble-teaser-text" onClick={handleOpen}>
            <strong>Masz pytania?</strong>
            <span>Jestem tutaj, napisz do mnie 👋</span>
          </button>
        </div>
      ) : null}
      <button
        type="button"
        className="chat-bubble-launcher"
        onClick={handleOpen}
        aria-label="Otwórz czat z konsultantem"
      >
        <span className="chat-bubble-launcher-ping" aria-hidden="true" />
        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="chat-bubble-icon">
          <path
            d="M4 12c0-4.42 3.58-8 8-8s8 3.58 8 8-3.58 8-8 8c-1.1 0-2.15-.22-3.1-.62L4 21l1.4-4.2A7.94 7.94 0 0 1 4 12Z"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx="8.5" cy="12" r="1.1" fill="currentColor" />
          <circle cx="12" cy="12" r="1.1" fill="currentColor" />
          <circle cx="15.5" cy="12" r="1.1" fill="currentColor" />
        </svg>
        <span className="chat-bubble-online-dot" aria-hidden="true" />
      </button>
    </div>
  );
}
