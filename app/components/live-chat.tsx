"use client";

// Okienko własnego czatu KEIKA (24.10.2026) - zastępuje Crispa, gdy w CRM
// włączono nowy czat (albo w tej przeglądarce wymuszono ?czat=nowy).
// Najpierw odpowiada asystent AI (wyraźnie podpisany), a klient ma zawsze
// widoczny przycisk „Chcę porozmawiać z człowiekiem”. Odpowiedzi doradców
// z CRM przychodzą tu przez odpytywanie co kilka sekund. Logika połączenia:
// lib/live-chat.ts, otwieranie: openCrispChat() w lib/crisp.ts.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { shopChatContext } from "@/lib/crisp";
import {
  LIVE_CHAT_OPEN_EVENT,
  liveChatHuman,
  liveChatPoll,
  liveChatSend,
  liveChatStart,
  liveChatUpload,
  saveLiveChatToken,
  type LiveChatMessage,
  type LiveChatPayload,
  type LiveChatState,
} from "@/lib/live-chat";

const POLL_OPEN_MS = 4000;
const POLL_CLOSED_MS = 15000;
const DEFAULT_GREETING =
  "Dzień dobry! Jestem asystentem KEIKA. Chętnie pomogę dobrać produkt, policzę cenę dla wymiaru albo sprawdzę zamówienie. W każdej chwili można też poprosić o rozmowę z człowiekiem.";

/** Zamienia adresy w tekście na klikalne linki (bez HTML z serwera). */
function linkify(text: string): ReactNode[] {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((part, i) =>
    /^https?:\/\//.test(part) ? (
      <a key={i} href={part} target={part.includes("keika.pl") ? "_self" : "_blank"} rel="noopener noreferrer">
        {part.replace(/^https?:\/\//, "").replace(/\/$/, "")}
      </a>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}

function maxId(list: LiveChatMessage[]): number {
  return list.reduce((m, x) => (!x.pending && x.id > m ? x.id : m), 0);
}

export default function LiveChat() {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [state, setState] = useState<LiveChatState | null>(null);
  const [greeting, setGreeting] = useState(DEFAULT_GREETING);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [starting, setStarting] = useState(false);

  const messagesRef = useRef<LiveChatMessage[]>([]);
  const tokenRef = useRef("");
  const openRef = useRef(false);
  const startedRef = useRef(false);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  messagesRef.current = messages;
  tokenRef.current = token;
  openRef.current = open;

  /** Dokłada nowe wiadomości z serwera; zwraca, czy przyszło coś od AI/doradcy. */
  const apply = useCallback((data: LiveChatPayload, dropPending = false): boolean => {
    if (!data.ok) return false;
    if (data.token && data.token !== tokenRef.current) {
      tokenRef.current = data.token;
      setToken(data.token);
      saveLiveChatToken(data.token);
    }
    if (data.state) setState(data.state);
    if (data.greeting) setGreeting(data.greeting);
    const incoming = data.messages || [];
    const knownIds = new Set(messagesRef.current.filter((m) => !m.pending).map((m) => m.id));
    const fresh = incoming.filter((m) => !knownIds.has(m.id));
    if (fresh.length || dropPending) {
      setMessages((prev) => {
        const seen = new Set(prev.filter((m) => !m.pending).map((m) => m.id));
        const add = fresh.filter((m) => !seen.has(m.id));
        const base = dropPending ? prev.filter((m) => !m.pending) : prev;
        return [...base, ...add].sort((a, b) => (a.pending ? 1 : 0) - (b.pending ? 1 : 0) || a.id - b.id);
      });
    }
    return fresh.some((m) => m.from !== "customer");
  }, []);

  const ensureStarted = useCallback(async () => {
    if (startedRef.current) return;
    startedRef.current = true;
    setStarting(true);
    try {
      const data = await liveChatStart("sklep");
      if (!data.ok) throw new Error(data.error || "start");
      apply(data);
      setError("");
    } catch {
      startedRef.current = false;
      setError("Nie udało się połączyć z czatem. Proszę spróbować za chwilę albo zadzwonić.");
    } finally {
      setStarting(false);
    }
  }, [apply]);

  // Otwieranie z dowolnego przycisku „czat” na stronie (lib/crisp.ts -> openLiveChat).
  useEffect(() => {
    const onOpen = (ev: Event) => {
      const prefill = (ev as CustomEvent<{ prefill?: string }>).detail?.prefill || "";
      setOpen(true);
      if (prefill) setInput((cur) => cur || prefill);
      void ensureStarted();
      window.setTimeout(() => inputRef.current?.focus(), 120);
    };
    window.addEventListener(LIVE_CHAT_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(LIVE_CHAT_OPEN_EVENT, onOpen);
  }, [ensureStarted]);

  // Rozmowa już trwała (np. klient przeszedł na inną stronę) - wznawiamy po cichu,
  // żeby odpowiedź doradcy dotarła także przy zamkniętym okienku.
  useEffect(() => {
    try {
      if (/^live-[a-f0-9]{32}$/.test(window.localStorage.getItem("keika_live_chat_token") || "")) {
        void ensureStarted();
      }
    } catch {
      // brak pamięci przeglądarki - nic do wznowienia
    }
  }, [ensureStarted]);

  // Odpytywanie: często przy otwartym okienku, rzadziej przy zamkniętym, gdy czekamy na człowieka.
  useEffect(() => {
    if (!token) return;
    const waitingForTeam = !!state && (state.waiting_human || state.human_active);
    if (!open && !waitingForTeam) return;
    const timer = window.setInterval(async () => {
      if (sending) return;
      try {
        const data = await liveChatPoll(tokenRef.current, maxId(messagesRef.current));
        const gotReply = apply(data);
        if (gotReply && !openRef.current) setOpen(true); // doradca odpisał - pokazujemy od razu
      } catch {
        // chwilowy brak sieci - następna próba za chwilę
      }
    }, open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    return () => window.clearInterval(timer);
  }, [token, open, state, sending, apply]);

  // Przewijanie na dół przy nowych wiadomościach.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, open]);

  async function send(preset?: string) {
    const text = (preset ?? input).trim();
    if (!text || sending) return;
    if (!tokenRef.current) await ensureStarted();
    if (!tokenRef.current) return;
    if (preset === undefined) {
      setInput("");
      if (inputRef.current) inputRef.current.style.height = "";
    }
    setError("");
    setSending(true);
    const tempId = Date.now();
    setMessages((prev) => [...prev, { id: tempId, from: "customer", text, pending: true }]);
    try {
      const data = await liveChatSend(tokenRef.current, text, shopChatContext(), maxId(messagesRef.current));
      if (!data.ok) throw new Error(data.error || "send");
      apply(data, true);
    } catch {
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInput(text);
      setError("Wiadomość nie doszła. Proszę spróbować jeszcze raz.");
    } finally {
      setSending(false);
    }
  }

  async function askHuman() {
    if (!tokenRef.current) await ensureStarted();
    if (!tokenRef.current) return;
    try {
      const data = await liveChatHuman(tokenRef.current, maxId(messagesRef.current));
      apply(data);
      void import("@/lib/track-step").then(({ trackShopStep }) => trackShopStep("chat_opened", "prośba o człowieka")).catch(() => null);
    } catch {
      setError("Nie udało się przekazać rozmowy. Proszę spróbować jeszcze raz.");
    }
  }

  async function upload(file: File) {
    if (!tokenRef.current) await ensureStarted();
    if (!tokenRef.current) return;
    setUploading(true);
    setError("");
    try {
      const data = await liveChatUpload(tokenRef.current, file, maxId(messagesRef.current));
      if (!data.ok) throw new Error(data.error || "upload");
      apply(data);
    } catch (e) {
      setError(e instanceof Error && e.message !== "upload" ? e.message : "Nie udało się wysłać zdjęcia.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  if (!open) return null;

  const humanActive = !!state?.human_active;
  const waitingHuman = !!state?.waiting_human && !humanActive;
  const staffName = [...messages].reverse().find((m) => m.from === "staff")?.name || "Doradca KEIKA";
  const customerWrote = messages.some((m) => m.from === "customer");
  const mode = humanActive ? "human" : waitingHuman ? "waiting" : "ai";

  return (
    <div className={`lc-panel lc-mode-${mode}`} role="dialog" aria-label="Czat z KEIKA">
      <div className="lc-head">
        <div className="lc-head-avatar" aria-hidden="true">
          {humanActive ? initials(staffName) : "K"}
          <span className="lc-head-dot" />
        </div>
        <div className="lc-head-text">
          <strong>{humanActive ? staffName : "KEIKA · pomoc na czacie"}</strong>
          <span className="lc-head-status">
            {mode === "human" ? (
              <>
                <IconPerson /> Rozmawiasz z doradcą
              </>
            ) : mode === "waiting" ? (
              <>
                <IconClock /> Czekasz na doradcę - odpisze tutaj
              </>
            ) : (
              <>
                <IconSpark /> Asystent AI · doradca na życzenie
              </>
            )}
          </span>
        </div>
        <button type="button" className="lc-close" aria-label="Zminimalizuj czat" title="Zminimalizuj" onClick={() => setOpen(false)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="lc-body" ref={listRef}>
        <div className="lc-row lc-row-bot">
          <div className="lc-avatar lc-avatar-ai" aria-hidden="true">AI</div>
          <div className="lc-msg lc-msg-bot">
            <div className="lc-msg-who">Asystent AI KEIKA</div>
            <div className="lc-msg-text">{greeting}</div>
          </div>
        </div>
        {!customerWrote && !humanActive ? (
          <div className="lc-chips" aria-label="Szybkie pytania">
            {QUICK_QUESTIONS.map((q) => (
              <button key={q} type="button" className="lc-chip" disabled={sending} onClick={() => void send(q)}>
                {q}
              </button>
            ))}
          </div>
        ) : null}
        {messages.map((m) => {
          const time = (m.at || "").slice(11, 16);
          return (
            <div key={`${m.id}-${m.pending ? "p" : "s"}`} className={`lc-row lc-row-${m.from}`}>
              {m.from === "bot" ? (
                <div className="lc-avatar lc-avatar-ai" aria-hidden="true">AI</div>
              ) : m.from === "staff" ? (
                <div className="lc-avatar lc-avatar-staff" aria-hidden="true">{initials(m.name || "Doradca KEIKA")}</div>
              ) : null}
              <div className={`lc-msg lc-msg-${m.from} ${m.pending ? "is-pending" : ""}`}>
                {m.from !== "customer" ? <div className="lc-msg-who">{m.from === "staff" ? m.name || "Doradca KEIKA" : "Asystent AI KEIKA"}</div> : null}
                {m.image ? (
                  <a href={m.image} target="_blank" rel="noopener noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={m.image} alt="Przesłane zdjęcie" className="lc-msg-img" />
                  </a>
                ) : (
                  <div className="lc-msg-text">{linkify(m.text)}</div>
                )}
                {time || m.pending ? <div className="lc-msg-time">{m.pending ? "wysyłanie…" : time}</div> : null}
              </div>
            </div>
          );
        })}
        {sending && !humanActive ? (
          <div className="lc-row lc-row-bot" aria-live="polite">
            <div className="lc-avatar lc-avatar-ai" aria-hidden="true">AI</div>
            <div className="lc-msg lc-msg-bot lc-typing" aria-label="Asystent pisze">
              <span />
              <span />
              <span />
            </div>
          </div>
        ) : null}
        {starting && !messages.length ? <div className="lc-note">Łączenie…</div> : null}
      </div>

      {waitingHuman ? (
        <div className="lc-banner">
          <IconClock />
          <span>Przekazaliśmy rozmowę doradcy. Odpowie tutaj, zwykle w kilka minut. Warto zostawić e-mail albo telefon - gdyby nie zdążył, odezwiemy się.</span>
        </div>
      ) : null}
      {error ? <div className="lc-error">{error}</div> : null}

      <div className="lc-foot">
        {!humanActive && !waitingHuman ? (
          <button type="button" className="lc-human" onClick={() => void askHuman()}>
            <IconPerson /> Chcę porozmawiać z człowiekiem
          </button>
        ) : null}
        <form
          className="lc-compose"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <button
            type="button"
            className="lc-attach"
            aria-label="Dodaj zdjęcie"
            title="Dodaj zdjęcie (np. okna albo produktu)"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            {uploading ? (
              <span className="lc-spinner" aria-hidden="true" />
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  d="M4 8.5A2.5 2.5 0 0 1 6.5 6h1.6l1.3-1.8h5.2L15.9 6h1.6A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5z"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.7"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="12.4" r="3.2" fill="none" stroke="currentColor" strokeWidth="1.7" />
              </svg>
            )}
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
          />
          <textarea
            ref={inputRef}
            rows={1}
            value={input}
            placeholder={humanActive ? `Napisz do: ${staffName}…` : "Napisz wiadomość…"}
            onChange={(e) => {
              setInput(e.target.value);
              const el = e.currentTarget;
              el.style.height = "auto";
              el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
          />
          <button type="submit" className="lc-send" disabled={sending || !input.trim()} aria-label="Wyślij">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </form>
        <div className="lc-legal">{humanActive ? "Rozmowa z pracownikiem KEIKA" : "Asystent AI może się pomylić - w razie wątpliwości poproś doradcę"}</div>
      </div>
    </div>
  );
}

const QUICK_QUESTIONS = ["Ile kosztuje plisa na mój wymiar?", "Jak zmierzyć okno?", "Gdzie jest moje zamówienie?", "Ile trwa realizacja?"];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "K") + (parts[1]?.[0] || "")).toUpperCase();
}

function IconPerson() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="lc-ico">
      <circle cx="12" cy="8" r="3.6" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20c.8-3.6 3.6-5.6 7-5.6s6.2 2 7 5.6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconClock() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="lc-ico">
      <circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7.5V12l3 2" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function IconSpark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="lc-ico">
      <path d="M12 3.5l1.9 5.1 5.1 1.9-5.1 1.9L12 17.5l-1.9-5.1L5 10.5l5.1-1.9z" fill="currentColor" />
    </svg>
  );
}
