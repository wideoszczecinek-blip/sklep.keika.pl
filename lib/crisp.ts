"use client";

/**
 * Lazy Crisp loader - the widget script is only injected the first time a
 * visitor actually asks for chat (from the "Poproś o pomoc" panel in the
 * measurement-instructions modal), never on every page load.
 */

const CRISP_WEBSITE_ID = "8c31cd03-8650-476a-accf-9d63cde5da9c";

let injected = false;

export function openCrispChat(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as {
    $crisp?: unknown[];
    CRISP_WEBSITE_ID?: string;
  };

  if (!injected) {
    injected = true;
    w.$crisp = w.$crisp || [];
    w.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;
    const s = document.createElement("script");
    s.src = "https://client.crisp.chat/l.js";
    s.async = true;
    document.head.appendChild(s);
  }

  const open = () => {
    try {
      (w.$crisp as unknown[]).push(["do", "chat:show"]);
      (w.$crisp as unknown[]).push(["do", "chat:open"]);
    } catch {
      /* script not ready yet - the retry below covers it */
    }
  };

  open();
  // First call: l.js needs a moment to wire $crisp.push into the real API.
  window.setTimeout(open, 700);
  window.setTimeout(open, 1800);
}
