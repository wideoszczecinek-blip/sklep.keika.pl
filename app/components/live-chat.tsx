"use client";

// Okienko własnego czatu KEIKA (24.10.2026) - zastępuje Crispa, gdy w CRM
// włączono nowy czat (albo w tej przeglądarce wymuszono ?czat=nowy).
// Najpierw odpowiada asystent AI (wyraźnie podpisany), a klient ma zawsze
// widoczny przycisk „Chcę porozmawiać z człowiekiem”. Odpowiedzi doradców
// z CRM przychodzą tu przez odpytywanie co kilka sekund. Logika połączenia:
// lib/live-chat.ts, otwieranie: openCrispChat() w lib/crisp.ts.
//
// Mądry asystent (lib/assistant.ts, test właściciela pod ?asystent=<klucz>, potem pilot):
// wygląd w kolorach strony (klasa lc-v2), zdjęcie pokoju -> 3 tkaniny z uzasadnieniem,
// zdjęcie tabliczki okna dachowego -> model do wyszukiwarki, duże okno na propozycje
// („Pokaż w dużym oknie”) i „Wstaw do konfiguratora” jednym kliknięciem.

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import "./assistant.css";
import { shopChatContext } from "@/lib/crisp";
import { applyToConfigurator, assistantArmSync, resolveAssistantArm } from "@/lib/assistant";
import { CONFIGURATOR_STATE_EVENT, getConfiguratorState } from "@/lib/configurator-state";
import { optimizeImageUrl } from "@/lib/image-optim";
import { trackShopStep } from "@/lib/track-step";
import {
  LIVE_CHAT_OPEN_EVENT,
  liveChatAdvise,
  liveChatHuman,
  liveChatPoll,
  liveChatPresence,
  liveChatSend,
  liveChatSnapshot,
  liveChatStart,
  liveChatTranscribe,
  liveChatUpload,
  saveLiveChatToken,
  type LiveChatCard,
  type LiveChatColorItem,
  type LiveChatMessage,
  type LiveChatOpenOptions,
  type LiveChatPayload,
  type LiveChatPhotoMode,
  type LiveChatState,
} from "@/lib/live-chat";

const POLL_OPEN_MS = 4000;
const POLL_CLOSED_MS = 15000;
const PRESENCE_MS = 20000;
const PRESENCE_NUDGE_EVENT = "keika:lc-presence";
const DEFAULT_GREETING =
  "Dzień dobry! Jestem asystentem KEIKA. Chętnie pomogę dobrać produkt, policzę cenę dla wymiaru albo sprawdzę zamówienie. W każdej chwili można też poprosić o rozmowę z człowiekiem.";
const ROOM_PHOTO_CHIP = "Dobierz kolor do mojego pokoju";

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

// ---- Głos (właściciel 25.10: „coraz więcej osób rozmawia z AI zamiast pisać”) ----
// Rozpoznawanie mowy wbudowane w przeglądarkę (Web Speech API, bez kosztów): Chrome, Edge,
// Safari, Samsung Internet. Gdzie go nie ma (np. przeglądarka Facebooka na Androidzie, Firefox),
// mikrofon nagrywa pytanie, a tekst robi z niego CRM (liveChatTranscribe, ok. 0,1 gr - zgoda
// właściciela 25.10). Odpowiedź na pytanie zadane głosem asystent czyta na głos.
type SpeechAlt = { transcript: string };
type SpeechResultList = ArrayLike<ArrayLike<SpeechAlt> & { isFinal: boolean }>;
type SpeechRec = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: { results: SpeechResultList }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function speechRecognitionCtor(): (new () => SpeechRec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRec; webkitSpeechRecognition?: new () => SpeechRec };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

/** Format nagrania obsługiwany przez przeglądarkę ('' = brak MediaRecorder / mikrofonu). */
function recorderMime(): string {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined" || !navigator.mediaDevices?.getUserMedia) return "";
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return types.find((t) => MediaRecorder.isTypeSupported?.(t)) || "audio/webm";
}

// Nagrywanie: koniec po ciszy (jak rozpoznawanie w przeglądarce), najdłużej 30 s;
// nagrania bez mowy nie wysyłamy (zero kosztu).
const RECORD_MAX_MS = 30_000;
const RECORD_SILENCE_MS = 1600;
const RECORD_NO_SPEECH_MS = 8000;

function speakText(text: string): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !text.trim()) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text.replace(/https?:\/\/\S+/g, "link w czacie"));
    utterance.lang = "pl-PL";
    const voice = synth.getVoices().find((v) => (v.lang || "").toLowerCase().startsWith("pl"));
    if (voice) utterance.voice = voice;
    utterance.rate = 1.05;
    synth.speak(utterance);
  } catch {
    // brak syntezy mowy - odpowiedź i tak jest na ekranie
  }
}

function stopSpeaking(): void {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    // nic
  }
}

function maxId(list: LiveChatMessage[]): number {
  return list.reduce((m, x) => (!x.pending && x.id > m ? x.id : m), 0);
}

/** Produkt, przy którym klient jest (do doradcy kolorów i karty tabliczki). */
function currentProduct(): string {
  const fromState = getConfiguratorState()?.product;
  if (fromState) return fromState;
  const path = typeof window !== "undefined" ? window.location.pathname : "";
  if (path.startsWith("/plisy")) return "plisy";
  if (path.includes("rolety-dachowe")) return "rolety-dachowe";
  if (path.includes("plisy-dachowe")) return "plisy-dachowe";
  return "";
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
  const [advising, setAdvising] = useState(false);
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [starting, setStarting] = useState(false);
  // Mądry asystent: nowy wygląd i doradca zdjęć tylko w grupie A (test właściciela albo pilot).
  const [v2, setV2] = useState(false);
  // Duże okno: id wiadomości z kartą pokazywaną obok rozmowy (0 = zwykłe okienko).
  const [wideCardId, setWideCardId] = useState(0);
  const [zoom, setZoom] = useState<LiveChatColorItem | null>(null);
  // native = rozpoznawanie w przeglądarce, record = nagranie + tekst z CRM, null = brak mikrofonu.
  const [voiceMode, setVoiceMode] = useState<"native" | "record" | null>(null);
  const voiceOk = voiceMode !== null;
  const [listening, setListening] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const recRef = useRef<SpeechRec | null>(null);
  const recorderRef = useRef<{ stop: (send: boolean) => void } | null>(null);
  const voiceTextRef = useRef("");
  // Ostatnia wiadomość klienta była głosowa -> następną odpowiedź czytamy na głos.
  const speakNextRef = useRef(false);
  const voiceMessageRef = useRef(false);

  const messagesRef = useRef<LiveChatMessage[]>([]);
  const tokenRef = useRef("");
  const openRef = useRef(false);
  const startedRef = useRef(false);
  const photoModeRef = useRef<LiveChatPhotoMode>("auto");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  messagesRef.current = messages;
  tokenRef.current = token;
  openRef.current = open;

  useEffect(() => {
    if (assistantArmSync() === "A") setV2(true);
    void resolveAssistantArm().then((arm) => setV2(arm === "A"));
  }, []);

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
    const reply = [...fresh].reverse().find((m) => m.from !== "customer" && m.text);
    if (reply && speakNextRef.current) {
      speakNextRef.current = false;
      speakText(reply.text);
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

  const sendRef = useRef<(preset?: string) => Promise<void>>(async () => undefined);

  useEffect(() => {
    setVoiceMode(speechRecognitionCtor() ? "native" : recorderMime() ? "record" : null);
    return () => {
      recRef.current?.abort();
      recorderRef.current?.stop(false);
      stopSpeaking();
    };
  }, []);

  // Zamknięte okienko = cisza (nie czytamy dalej i nie słuchamy).
  useEffect(() => {
    if (open) return;
    recRef.current?.abort();
    recorderRef.current?.stop(false);
    stopSpeaking();
  }, [open]);

  /** Pytanie wypowiedziane (z rozpoznawania albo z nagrania) - wysyłamy i czytamy odpowiedź na głos. */
  function sendVoiceText(text: string, mode: "native" | "record") {
    setInput("");
    speakNextRef.current = true;
    voiceMessageRef.current = true;
    trackShopStep("assistant_voice", "sent", { chars: text.length, mode });
    void sendRef.current(text);
  }

  async function startRecording() {
    const mime = recorderMime();
    if (!mime) return;
    stopSpeaking();
    setError("");
    // Odczyt głośności musi powstać jeszcze w kliknięciu klienta - inaczej przeglądarka go wycisza.
    let audioCtx: AudioContext | null = null;
    try {
      const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      audioCtx = Ctx ? new Ctx() : null;
      void audioCtx?.resume().catch(() => undefined);
    } catch {
      audioCtx = null;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      void audioCtx?.close().catch(() => undefined);
      setError("Brak zgody na mikrofon - można ją włączyć w ustawieniach przeglądarki.");
      return;
    }
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType: mime });
    } catch {
      recorder = new MediaRecorder(stream);
    }
    const chunks: Blob[] = [];
    let heardSpeech = false;
    let sendOnStop = true;
    const timers: number[] = [];
    const finish = () => {
      timers.forEach((t) => window.clearInterval(t));
      stream.getTracks().forEach((t) => t.stop());
      void audioCtx?.close().catch(() => undefined);
    };
    recorder.ondataavailable = (ev) => {
      if (ev.data && ev.data.size) chunks.push(ev.data);
    };
    recorder.onstop = () => {
      finish();
      recorderRef.current = null;
      setListening(false);
      if (!sendOnStop) return;
      if (!heardSpeech) {
        setError("Nic nie słychać - proszę spróbować jeszcze raz.");
        return;
      }
      const blob = new Blob(chunks, { type: recorder.mimeType || mime });
      setTranscribing(true);
      void (async () => {
        try {
          if (!tokenRef.current) await ensureStarted();
          if (!tokenRef.current) throw new Error("start");
          const data = await liveChatTranscribe(tokenRef.current, blob);
          if (!data.ok || !data.text) {
            setError(data.error || "Nie udało się rozpoznać nagrania - proszę spróbować jeszcze raz.");
            return;
          }
          sendVoiceText(data.text, "record");
        } catch {
          setError("Nie udało się rozpoznać nagrania - proszę spróbować jeszcze raz albo napisać.");
        } finally {
          setTranscribing(false);
        }
      })();
    };
    const stop = (send: boolean) => {
      sendOnStop = send;
      if (recorder.state !== "inactive") recorder.stop();
      else finish();
    };
    recorderRef.current = { stop };

    // Wykrywanie mowy i ciszy po głośności - bez tego klient musiałby sam klikać „stop”.
    const startedAt = Date.now();
    let lastVoiceAt = startedAt;
    try {
      if (audioCtx && audioCtx.state !== "running") await audioCtx.resume().catch(() => undefined);
      if (audioCtx && audioCtx.state === "running") {
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 1024;
        audioCtx.createMediaStreamSource(stream).connect(analyser);
        const buf = new Float32Array(analyser.fftSize);
        timers.push(
          window.setInterval(() => {
            analyser.getFloatTimeDomainData(buf);
            let sum = 0;
            for (let i = 0; i < buf.length; i++) sum += buf[i] * buf[i];
            const now = Date.now();
            if (Math.sqrt(sum / buf.length) > 0.02) {
              heardSpeech = true;
              lastVoiceAt = now;
            } else if (heardSpeech && now - lastVoiceAt > RECORD_SILENCE_MS) {
              stop(true);
            } else if (!heardSpeech && now - startedAt > RECORD_NO_SPEECH_MS) {
              stop(true);
            }
          }, 100),
        );
      } else {
        heardSpeech = true;
      }
    } catch {
      // bez analizy głośności - koniec przyciskiem albo po 30 s
      heardSpeech = true;
    }
    timers.push(window.setInterval(() => Date.now() - startedAt > RECORD_MAX_MS && stop(true), 500));

    setListening(true);
    trackShopStep("assistant_voice", "start", { mode: "record" });
    recorder.start(250);
  }

  function toggleVoice() {
    if (listening) {
      if (recorderRef.current) recorderRef.current.stop(true);
      else recRef.current?.stop();
      return;
    }
    if (voiceMode === "record") {
      void startRecording();
      return;
    }
    const Ctor = speechRecognitionCtor();
    if (!Ctor) return;
    stopSpeaking();
    const rec = new Ctor();
    rec.lang = "pl-PL";
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    voiceTextRef.current = "";
    rec.onresult = (event) => {
      let text = "";
      for (let i = 0; i < event.results.length; i++) text += event.results[i][0]?.transcript || "";
      voiceTextRef.current = text.trim();
      setInput(voiceTextRef.current);
    };
    let fallback = false;
    rec.onerror = (event) => {
      if (["network", "service-not-allowed", "language-not-supported"].includes(event.error) && recorderMime()) {
        // Przeglądarka ma rozpoznawanie, ale nie działa (np. część WebView, Safari bez Siri) -
        // od teraz nagrywamy i tekst robi CRM.
        fallback = true;
        trackShopStep("assistant_voice", "fallback", { reason: event.error });
      } else if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Brak zgody na mikrofon - można ją włączyć w ustawieniach przeglądarki.");
      } else if (event.error === "no-speech") {
        setError("Nic nie słychać - proszę spróbować jeszcze raz.");
      }
    };
    rec.onend = () => {
      setListening(false);
      recRef.current = null;
      const text = voiceTextRef.current;
      voiceTextRef.current = "";
      if (fallback) {
        // Nagrywanie musi ruszyć z kliknięcia klienta (mikrofon i odczyt głośności).
        setVoiceMode("record");
        setError("Proszę dotknąć mikrofonu jeszcze raz i zadać pytanie.");
        return;
      }
      if (!text) return;
      sendVoiceText(text, "native");
    };
    recRef.current = rec;
    setError("");
    setListening(true);
    trackShopStep("assistant_voice", "start", { mode: "native" });
    try {
      rec.start();
    } catch {
      setListening(false);
      recRef.current = null;
    }
  }

  // Otwieranie z dowolnego przycisku „czat” na stronie (lib/crisp.ts -> openLiveChat)
  // i z dymków asystenta (gotowa wiadomość albo wybór zdjęcia).
  useEffect(() => {
    const onOpen = (ev: Event) => {
      const detail = (ev as CustomEvent<LiveChatOpenOptions>).detail || {};
      setOpen(true);
      if (detail.photo) {
        // Wybór pliku musi zostać otwarty jeszcze w kliknięciu klienta - pole pliku jest zawsze w DOM.
        photoModeRef.current = detail.photo;
        fileRef.current?.click();
      }
      if (detail.prefill) setInput((cur) => cur || detail.prefill || "");
      void ensureStarted().then(() => {
        if (detail.send) void sendRef.current(detail.send);
      });
      if (!detail.photo) window.setTimeout(() => inputRef.current?.focus(), 120);
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

  // Obecność dla zespołu (25.10.2026): co ok. 20 s i od razu przy zmianie (karta w tle, koszyk,
  // konfigurator, otwarcie okienka, pisanie) CRM dostaje, co klient robi. Gdy karta długo nie jest
  // widoczna, CRM kończy rozmowę; zakończona budzi się dopiero, gdy klient napisze.
  const typing = input.trim() !== "";
  const typingRef = useRef(false);
  typingRef.current = typing;
  const closed = !!state?.closed;
  useEffect(() => {
    if (!token || closed) return;
    let last = 0;
    let soonTimer = 0;
    const beat = () => {
      last = Date.now();
      liveChatPresence(tokenRef.current, liveChatSnapshot(openRef.current, typingRef.current))
        .then((d) => {
          if (d.ok && d.state?.closed) setState(d.state);
        })
        .catch(() => undefined);
    };
    const soon = () => {
      window.clearTimeout(soonTimer);
      soonTimer = window.setTimeout(beat, Math.max(0, 2500 - (Date.now() - last)));
    };
    beat();
    const interval = window.setInterval(beat, PRESENCE_MS);
    document.addEventListener("visibilitychange", beat);
    window.addEventListener("keika-cart-updated", soon);
    window.addEventListener(CONFIGURATOR_STATE_EVENT, soon);
    window.addEventListener(PRESENCE_NUDGE_EVENT, soon);
    return () => {
      window.clearInterval(interval);
      window.clearTimeout(soonTimer);
      document.removeEventListener("visibilitychange", beat);
      window.removeEventListener("keika-cart-updated", soon);
      window.removeEventListener(CONFIGURATOR_STATE_EVENT, soon);
      window.removeEventListener(PRESENCE_NUDGE_EVENT, soon);
    };
  }, [token, closed]);
  useEffect(() => {
    window.dispatchEvent(new Event(PRESENCE_NUDGE_EVENT));
  }, [open, typing]);

  // Odpytywanie: często przy otwartym okienku, rzadziej przy zamkniętym, gdy czekamy na człowieka.
  useEffect(() => {
    if (!token) return;
    const waitingForTeam = !!state && (state.waiting_human || state.human_active);
    if (!open && !waitingForTeam) return;
    const timer = window.setInterval(async () => {
      if (sending || advising) return;
      try {
        const data = await liveChatPoll(tokenRef.current, maxId(messagesRef.current));
        const gotReply = apply(data);
        if (gotReply && !openRef.current) setOpen(true); // doradca odpisał - pokazujemy od razu
      } catch {
        // chwilowy brak sieci - następna próba za chwilę
      }
    }, open ? POLL_OPEN_MS : POLL_CLOSED_MS);
    return () => window.clearInterval(timer);
  }, [token, open, state, sending, advising, apply]);

  // Przewijanie na dół przy nowych wiadomościach.
  useEffect(() => {
    const el = listRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending, advising, open, wideCardId]);

  // Nowa karta z propozycjami: na komputerze od razu w dużym oknie (czytelność - właściciel 24.10).
  const lastCardIdRef = useRef(0);
  useEffect(() => {
    const latest = [...messages].reverse().find((m) => m.card && m.card.type === "colors");
    if (!latest || latest.id === lastCardIdRef.current) return;
    lastCardIdRef.current = latest.id;
    // Tylko świeża karta (nie ta z historii po przeładowaniu strony).
    const fresh = Date.now() - Date.parse((latest.at || "").replace(" ", "T")) < 120000;
    if (open && fresh && window.matchMedia("(min-width: 760px)").matches) {
      setWideCardId(latest.id);
    }
  }, [messages, open]);

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
      // „asystent: tak” - bot może wtedy zaproponować zdjęcie pokoju / tabliczki (czat w CRM to obsłuży).
      const voice = voiceMessageRef.current;
      voiceMessageRef.current = false;
      const context = v2
        ? `${shopChatContext()} · asystent: tak${voice ? " · wiadomość podyktowana głosem (możliwe błędy rozpoznania mowy)" : ""}`
        : shopChatContext();
      const data = await liveChatSend(tokenRef.current, text, context, maxId(messagesRef.current));
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
  sendRef.current = send;

  async function askHuman() {
    if (!tokenRef.current) await ensureStarted();
    if (!tokenRef.current) return;
    try {
      const data = await liveChatHuman(tokenRef.current, maxId(messagesRef.current));
      apply(data);
      trackShopStep("chat_opened", "prośba o człowieka");
    } catch {
      setError("Nie udało się przekazać rozmowy. Proszę spróbować jeszcze raz.");
    }
  }

  async function upload(file: File) {
    if (!tokenRef.current) await ensureStarted();
    if (!tokenRef.current) return;
    const mode = photoModeRef.current;
    photoModeRef.current = "auto";
    setUploading(true);
    setError("");
    let uploaded = false;
    try {
      const data = await liveChatUpload(tokenRef.current, file, maxId(messagesRef.current));
      if (!data.ok) throw new Error(data.error || "upload");
      apply(data);
      uploaded = true;
    } catch (e) {
      setError(e instanceof Error && e.message !== "upload" ? e.message : "Nie udało się wysłać zdjęcia.");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
    // Doradca zdjęć tylko w nowym czacie i gdy rozmowy nie prowadzi już człowiek.
    if (!uploaded || !v2 || state?.human_active) return;
    setAdvising(true);
    trackShopStep("assistant_photo", mode, { product: currentProduct() });
    try {
      const data = await liveChatAdvise(tokenRef.current, mode, currentProduct(), maxId(messagesRef.current));
      if (data.ok) apply(data);
      else if (data.error) setError(data.error);
    } catch {
      // zdjęcie i tak doszło - zobaczy je doradca
    } finally {
      setAdvising(false);
    }
  }

  function pickPhoto(mode: LiveChatPhotoMode) {
    photoModeRef.current = mode;
    fileRef.current?.click();
  }

  function applyColor(item: LiveChatColorItem, card: Extract<LiveChatCard, { type: "colors" }>) {
    trackShopStep("assistant_apply", item.label, { swatch: item.swatchId, role: item.role });
    applyToConfigurator(
      { product: "plisy", fabricGroupId: item.groupId, fabricId: item.swatchId, hardwareId: card.hardware?.id || undefined },
      "/plisy",
    );
    setNote(`Wstawione do konfiguratora: ${item.label} (${item.groupLabel})${card.hardware ? `, mechanizm ${card.hardware.label.toLowerCase()}` : ""}.`);
    setWideCardId(0);
    setZoom(null);
    // Na telefonie czat zasłania konfigurator - chowamy go, żeby klient zobaczył wybór.
    if (window.matchMedia("(max-width: 759px)").matches) setOpen(false);
  }

  function applyPlate(card: Extract<LiveChatCard, { type: "plate" }>, product: string, libraryId?: number, label?: string) {
    trackShopStep("assistant_apply", card.query, { product, kind: "plate", library_id: libraryId || 0 });
    applyToConfigurator({ product, windowLibraryId: libraryId || undefined, windowQuery: card.query }, `/produkt/${product}`);
    setNote(libraryId ? `Wybrane okno: ${label || card.query}.` : `Model ${card.query} wpisany do wyszukiwarki okna.`);
    if (window.matchMedia("(max-width: 759px)").matches) setOpen(false);
  }

  const fileInput = (
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
  );

  if (!open) return fileInput;

  const humanActive = !!state?.human_active;
  const waitingHuman = !!state?.waiting_human && !humanActive;
  const staffName = [...messages].reverse().find((m) => m.from === "staff")?.name || "Doradca KEIKA";
  const customerWrote = messages.some((m) => m.from === "customer");
  const mode = humanActive ? "human" : waitingHuman ? "waiting" : "ai";
  const wideMessage = wideCardId ? messages.find((m) => m.id === wideCardId && m.card) : undefined;
  const quickQuestions = v2 ? QUICK_QUESTIONS_V2 : QUICK_QUESTIONS;

  const renderColorCard = (m: LiveChatMessage, card: Extract<LiveChatCard, { type: "colors" }>, big: boolean) => (
    <div className={`lc-card lc-card-colors ${big ? "is-big" : ""}`}>
      <div className={big ? "lc-board-list" : "lc-swatches"}>
        {card.items.map((item) => (
          <div key={item.swatchId} className="lc-sw">
            <button
              type="button"
              className="lc-sw-img"
              style={{ backgroundColor: item.color }}
              onClick={() => setZoom(item)}
              aria-label={`Powiększ próbkę ${item.label}`}
            >
              {item.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={optimizeImageUrl(item.image, big ? 360 : 160, 75)} alt="" loading="lazy" />
              ) : null}
            </button>
            <div className="lc-sw-text">
              <span className="lc-sw-role">{item.role}</span>
              <strong>{item.label}</strong>
              <span className="lc-sw-group">{item.groupLabel}</span>
              {big ? <p>{item.why}</p> : null}
              {big ? (
                <button type="button" className="lc-sw-apply" onClick={() => applyColor(item, card)}>
                  Wstaw do konfiguratora
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>
      {big && card.hardware ? (
        <div className="lc-hw">
          <i style={{ backgroundColor: card.hardware.color }} aria-hidden="true" />
          <span>
            <strong>Mechanizm: {card.hardware.label}</strong> {card.hardware.why}
          </span>
        </div>
      ) : null}
      {!big ? (
        <button type="button" className="lc-card-open" onClick={() => setWideCardId(m.id)}>
          Pokaż propozycje w dużym oknie
        </button>
      ) : (
        <p className="lc-card-note">Kolory na ekranie mogą się nieco różnić od tkaniny. Kliknij próbkę, żeby ją powiększyć.</p>
      )}
    </div>
  );

  const renderPlateCard = (card: Extract<LiveChatCard, { type: "plate" }>) => {
    const product = currentProduct();
    const onRoof = product === "rolety-dachowe" || product === "plisy-dachowe";
    return (
      <div className="lc-card lc-card-plate">
        <span className="lc-sw-role">Odczytane z tabliczki</span>
        <strong>
          {card.brand ? `${card.brand} ` : ""}
          {card.model}
        </strong>
        {card.libraryId ? (
          <>
            {card.label ? <span className="lc-sw-group">Pasujące okno w konfiguratorze: {card.label}</span> : null}
            {onRoof ? (
              <button type="button" className="lc-sw-apply" onClick={() => applyPlate(card, product, card.libraryId, card.label)}>
                Wybierz to okno
              </button>
            ) : (
              <div className="lc-card-actions">
                <button type="button" className="lc-sw-apply" onClick={() => applyPlate(card, "rolety-dachowe", card.libraryId, card.label)}>
                  Roleta do tego okna
                </button>
                <button type="button" className="lc-sw-apply is-ghost" onClick={() => applyPlate(card, "plisy-dachowe", card.libraryId, card.label)}>
                  Plisa do tego okna
                </button>
              </div>
            )}
          </>
        ) : card.candidates?.length ? (
          <>
            <span className="lc-sw-group">Które to okno?</span>
            <div className="lc-card-actions">
              {card.candidates.map((cand) => (
                <button
                  key={cand.id}
                  type="button"
                  className="lc-sw-apply is-ghost"
                  onClick={() => applyPlate(card, onRoof ? product : "rolety-dachowe", cand.id, cand.label)}
                >
                  {cand.label}
                </button>
              ))}
            </div>
          </>
        ) : (
          <button type="button" className="lc-sw-apply" onClick={() => applyPlate(card, onRoof ? product : "rolety-dachowe")}>
            Szukaj tego okna
          </button>
        )}
      </div>
    );
  };

  const conversation = (
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
          {quickQuestions.map((q) => (
            <button
              key={q}
              type="button"
              className="lc-chip"
              disabled={sending || uploading}
              onClick={() => (q === ROOM_PHOTO_CHIP ? pickPhoto("room") : void send(q))}
            >
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
            <div className={`lc-msg lc-msg-${m.from} ${m.pending ? "is-pending" : ""} ${m.card ? "has-card" : ""}`}>
              {m.from !== "customer" ? <div className="lc-msg-who">{m.from === "staff" ? m.name || "Doradca KEIKA" : "Asystent AI KEIKA"}</div> : null}
              {m.image ? (
                <a href={m.image} target="_blank" rel="noopener noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.image} alt="Przesłane zdjęcie" className="lc-msg-img" />
                </a>
              ) : (
                <div className="lc-msg-text">{linkify(m.text)}</div>
              )}
              {m.card?.type === "colors" ? renderColorCard(m, m.card, false) : null}
              {m.card?.type === "plate" ? renderPlateCard(m.card) : null}
              {time || m.pending ? <div className="lc-msg-time">{m.pending ? "wysyłanie…" : time}</div> : null}
            </div>
          </div>
        );
      })}
      {(sending && !humanActive) || advising ? (
        <div className="lc-row lc-row-bot" aria-live="polite">
          <div className="lc-avatar lc-avatar-ai" aria-hidden="true">AI</div>
          <div className={`lc-msg lc-msg-bot ${advising ? "lc-advising" : "lc-typing"}`} aria-label="Asystent pisze">
            {advising ? (
              <>Oglądam zdjęcie…</>
            ) : (
              <>
                <span />
                <span />
                <span />
              </>
            )}
          </div>
        </div>
      ) : null}
      {starting && !messages.length ? <div className="lc-note">Łączenie…</div> : null}
    </div>
  );

  const footer = (
    <div className="lc-foot">
      {!v2 && !humanActive && !waitingHuman ? (
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
          title={v2 ? "Wyślij zdjęcie pokoju (dobiorę kolory), okna albo tabliczki okna dachowego" : "Dodaj zdjęcie (np. okna albo produktu)"}
          disabled={uploading || advising}
          onClick={() => pickPhoto("auto")}
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
        <textarea
          ref={inputRef}
          rows={1}
          value={input}
          placeholder={
            transcribing ? "Rozpoznaję pytanie…" : listening ? "Słucham… proszę mówić" : humanActive ? `Napisz do: ${staffName}…` : v2 ? (voiceOk ? "Napisz, powiedz albo wyślij zdjęcie…" : "Napisz albo wyślij zdjęcie…") : "Napisz wiadomość…"
          }
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
        {v2 && voiceOk && (listening || transcribing || !input.trim()) ? (
          <button
            type="button"
            className={`lc-mic ${listening ? "is-listening" : ""} ${transcribing ? "is-busy" : ""}`}
            onClick={toggleVoice}
            disabled={sending || transcribing}
            aria-label={listening ? "Zakończ mówienie" : "Zadaj pytanie głosem"}
            title={listening ? "Zakończ mówienie" : "Zadaj pytanie głosem"}
          >
            {listening ? (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="7" y="7" width="10" height="10" rx="2" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <rect x="9" y="3.5" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.9" />
                <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
              </svg>
            )}
          </button>
        ) : (
          <button type="submit" className="lc-send" disabled={sending || !input.trim()} aria-label="Wyślij">
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M5 12h13M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </form>
      {v2 && !humanActive && !waitingHuman ? (
        <button type="button" className="lc-human lc-human-link" onClick={() => void askHuman()}>
          Wolę rozmawiać z człowiekiem
        </button>
      ) : null}
      <div className="lc-legal">{humanActive ? "Rozmowa z pracownikiem KEIKA" : "Asystent AI może się pomylić - w razie wątpliwości poproś doradcę"}</div>
    </div>
  );

  return (
    <div
      className={`lc-panel lc-mode-${mode} ${v2 ? "lc-v2" : ""} ${wideMessage ? "lc-wide" : ""}`}
      role="dialog"
      aria-label="Czat z KEIKA"
    >
      {fileInput}
      <div className="lc-head">
        <div className="lc-head-avatar" aria-hidden="true">
          {humanActive ? initials(staffName) : "K"}
          <span className="lc-head-dot" />
        </div>
        <div className="lc-head-text">
          <strong>{humanActive ? staffName : v2 ? "Doradca KEIKA" : "KEIKA · pomoc na czacie"}</strong>
          <span className="lc-head-status">
            {mode === "human" ? (
              <>
                <IconPerson /> Rozmawiasz z doradcą
              </>
            ) : mode === "waiting" ? (
              <>
                <IconClock /> Czekasz na doradcę - odpisze tutaj
              </>
            ) : v2 ? (
              <>
                <IconSpark /> Asystent AI · odpowiada od razu
              </>
            ) : (
              <>
                <IconSpark /> Odpowiada asystent AI · doradca na życzenie
              </>
            )}
          </span>
        </div>
        {wideMessage ? (
          <button type="button" className="lc-shrink" onClick={() => setWideCardId(0)}>
            Zmniejsz
          </button>
        ) : null}
        <button type="button" className="lc-close" aria-label="Zminimalizuj czat" title="Zminimalizuj" onClick={() => setOpen(false)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      <div className="lc-main">
        <div className="lc-talk">
          {conversation}
          {waitingHuman ? (
            <div className="lc-banner">
              <IconClock />
              <span>Przekazaliśmy rozmowę doradcy. Odpowie tutaj, zwykle w kilka minut. Warto zostawić e-mail albo telefon - gdyby nie zdążył, odezwiemy się.</span>
            </div>
          ) : null}
          {note ? (
            <div className="lc-applied" role="status">
              <span>{note}</span>
              <button type="button" onClick={() => setNote("")} aria-label="Zamknij">
                ✕
              </button>
            </div>
          ) : null}
          {error ? <div className="lc-error">{error}</div> : null}
          {footer}
        </div>
        {wideMessage?.card?.type === "colors" ? (
          <aside className="lc-board" aria-label="Propozycje kolorów">
            <div className="lc-board-head">
              <button type="button" className="lc-board-back" onClick={() => setWideCardId(0)}>
                ← Wróć do rozmowy
              </button>
              <strong>Propozycje do tego wnętrza</strong>
              {wideMessage.card.mood ? <p>{wideMessage.card.mood}</p> : null}
            </div>
            {renderColorCard(wideMessage, wideMessage.card, true)}
          </aside>
        ) : null}
      </div>

      {zoom ? (
        <div className="lc-zoom" role="dialog" aria-label={`Próbka ${zoom.label}`} onClick={() => setZoom(null)}>
          <div className="lc-zoom-box" onClick={(e) => e.stopPropagation()}>
            <div className="lc-zoom-img" style={{ backgroundColor: zoom.color }}>
              {zoom.image ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={optimizeImageUrl(zoom.image, 900, 82)} alt={zoom.label} />
              ) : null}
            </div>
            <div className="lc-zoom-text">
              <strong>
                {zoom.label} · {zoom.groupLabel}
              </strong>
              <p>{zoom.why}</p>
              <div className="lc-card-actions">
                {(() => {
                  const card = messages.find((m) => m.card?.type === "colors" && m.card.items.some((i) => i.swatchId === zoom.swatchId))?.card;
                  return card && card.type === "colors" ? (
                    <button type="button" className="lc-sw-apply" onClick={() => applyColor(zoom, card)}>
                      Wstaw do konfiguratora
                    </button>
                  ) : null;
                })()}
                <button type="button" className="lc-sw-apply is-ghost" onClick={() => setZoom(null)}>
                  Zamknij
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const QUICK_QUESTIONS = ["Ile kosztuje plisa na mój wymiar?", "Jak zmierzyć okno?", "Gdzie jest moje zamówienie?", "Ile trwa realizacja?"];
const QUICK_QUESTIONS_V2 = ["Ile kosztuje plisa na mój wymiar?", ROOM_PHOTO_CHIP, "Jak zmierzyć okno?", "Gdzie jest moje zamówienie?"];

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
