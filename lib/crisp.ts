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

/** Co klient ogląda i ile ma w koszyku - kontekst dla automatycznego konsultanta. */
export function shopChatContext(): string {
  try {
    const path = window.location.pathname.replace(/^\/+|\/+$/g, "") || "strona główna";
    const raw = window.localStorage.getItem("keika_cart");
    const items = raw ? ((JSON.parse(raw) as { items?: Array<{ total?: number; productLabel?: string; label?: string }> }).items || []) : [];
    const total = items.reduce((sum, item) => sum + (Number(item.total) || 0), 0);
    const labels = items.map((item) => item.productLabel || item.label || "").filter(Boolean).slice(0, 5).join(", ");
    return `Klient jest na stronie: ${path}. Koszyk: ${items.length ? `${items.length} poz. (${labels || "produkty"}) za ${total.toFixed(2)} zł` : "pusty"}.`;
  } catch {
    return "";
  }
}

/** `prefill` (2026-09-17, chat nudge): a message dropped into the composer
 * so the customer only has to hit send - "Dzień dobry, mam pytanie o
 * pomiar plisy". Never sent on its own. */
export function openCrispChat(prefill?: string): void {
  if (typeof window === "undefined") return;
  // Otwarcie czatu to sygnał "ma pytanie / utknął" - do analityki CRM.
  void import("@/lib/track-step").then(({ trackShopStep }) => trackShopStep("chat_opened", prefill ? "z podpowiedzią" : "ręcznie")).catch(() => null);
  try {
    window.sessionStorage.setItem("keika_chat_opened", "1");
  } catch {
    // nic do zrobienia
  }
  // Własny czat KEIKA (24.10.2026, lib/live-chat.ts): gdy włączony w CRM albo
  // wymuszony ?czat=nowy, otwiera się nasze okienko; inaczej jak dotąd Crisp.
  void import("@/lib/live-chat")
    .then(({ resolveChatMode, openLiveChat }) =>
      resolveChatMode().then((mode) => (mode === "own" ? openLiveChat(prefill) : openCrispWidget(prefill))),
    )
    // Nie udało się wczytać modułu czatu - i tak nasze okienko (26.10.2026: Crisp ma się nie pokazywać).
    .catch(() => window.dispatchEvent(new CustomEvent("keika:live-chat-open", { detail: { prefill: prefill || "" } })));
}

function openCrispWidget(prefill?: string): void {
  const w = window as unknown as { $crisp?: unknown[]; CRISP_WEBSITE_ID?: string };

  w.$crisp = w.$crisp || [];
  w.CRISP_WEBSITE_ID = CRISP_WEBSITE_ID;

  // Queued before l.js loads -> Crisp replays these the moment it's ready.
  // On a second click $crisp is already the live API and this runs instantly.
  w.$crisp.push(["do", "chat:show"]);
  w.$crisp.push(["do", "chat:open"]);
  if (prefill) {
    w.$crisp.push(["set", "message:text", [prefill]]);
  }

  // Automatyczny konsultant (lib/chat-bot.ts, 2026-10-22) odpowiada sam
  // i przekazuje trudne sprawy człowiekowi. Gdy jest wyłączony w CRM albo
  // CRM nie odpowiada - wraca stary automat na długie oczekiwanie
  // (lib/chat-follow-up.ts: komunikaty po 1 i 3 minutach).
  const armFollowUp = () =>
    void import("@/lib/chat-follow-up").then(({ armChatFollowUp }) => armChatFollowUp()).catch(() => null);
  void Promise.all([import("@/lib/chat-bot"), import("@/lib/crisp-events")])
    .then(([{ armChatBot }, { onCrispEvent }]) =>
      armChatBot({ site: "sklep", on: onCrispEvent, context: shopChatContext, onUnavailable: armFollowUp }),
    )
    .catch(armFollowUp);
  // Powiązanie rozmowy z odwiedzającym w CRM (lib/chat-identity.ts):
  // identyfikator sesji Crispa leci do analityki, a do samej rozmowy
  // dokładamy kontekst klienta.
  void import("@/lib/chat-identity").then(({ armChatIdentity }) => armChatIdentity()).catch(() => null);

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
