"use client";

/**
 * Lazy Crisp loader - the widget script is only injected the first time a
 * visitor actually asks for chat (from the "Poproś o pomoc" panel in the
 * measurement-instructions modal), never on every page load. Once loaded it
 * behaves like any normal site chat: an open panel with a built-in
 * minimise-to-bubble control.
 */

const CRISP_WEBSITE_ID = "8c31cd03-8650-476a-accf-9d63cde5da9c";

let injected = false;

export function openCrispChat(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { $crisp?: unknown[]; CRISP_WEBSITE_ID?: string };

  w.$crisp = w.$crisp || [];
  w.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

  // Queued before l.js loads -> Crisp replays these the moment it's ready.
  // On a second click $crisp is already the live API and this runs instantly.
  w.$crisp.push(["do", "chat:show"]);
  w.$crisp.push(["do", "chat:open"]);

  if (!injected) {
    injected = true;
    const s = document.createElement("script");
    s.src = "https://client.crisp.chat/l.js";
    s.async = true;
    document.head.appendChild(s);
  }
}

/** Collapse the chat panel back to just the floating bubble. */
export function hideCrispChat(): void {
  if (typeof window === "undefined") return;
  const w = window as unknown as { $crisp?: unknown[] };
  if (!w.$crisp) return;
  w.$crisp.push(["do", "chat:close"]);
}
