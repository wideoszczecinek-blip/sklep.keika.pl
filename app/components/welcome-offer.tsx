"use client";

// Oferta powitalna Black Weeks −25 % (właściciel 11.11.2026, test 7 dni) -
// logika i pamięć urządzenia: lib/welcome-offer.ts, CRM: shop_welcome_offer.php.
//
// Właściciel 11.11 (druga wersja): „GRATULACJE – właśnie uruchomiliśmy Ci
// specjalny rabat −25 % na całe zakupy, automatycznie w koszyku, 24 godziny”,
// ze zdjęciem i z Black Weeks w typowej czarno-białej szacie. Rabat uruchamia
// się sam w chwili pokazania panelu (bez klikania „Odbieram”); 24 h liczy się
// od tej chwili. Telefon to ~97 % ruchu: panel od dołu, zamyka się jednym
// ruchem, potem zostaje plakietka z odliczaniem z lewej u dołu.
import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PERSONAL_CODE_EVENT, getPersonalCode } from "@/lib/personal-code";
import {
  WELCOME_EVENT,
  claimWelcome,
  formatRemaining,
  getActiveWelcomeCode,
  isOknowoHost,
  isWelcomeCode,
  loadWelcomeSettings,
  readWelcomeState,
  sendWelcomeEmail,
  trackWelcome,
  writeWelcomeState,
  type WelcomeSettings,
} from "@/lib/welcome-offer";
import "./welcome-offer.css";

/** Strony, na których panel sam się nie otwiera (płatność, status zamówienia, regulaminy, koszyk). */
const QUIET_PATHS = [/^\/zamowienie/, /^\/wycena/, /^\/p\//, /^\/legal/, /^\/regulamin/, /^\/panel/, /^\/koszyk/];
/** Strony, na których nie ma nawet plakietki. */
const HIDDEN_PATHS = [/^\/zamowienie/, /^\/wycena/, /^\/p\//];
/** Po zamknięciu bez rabatu panel nie wraca sam przez tyle czasu (plakietka zostaje). */
const DISMISS_QUIET_MS = 12 * 60 * 60 * 1000;
const AUTO_OPEN_DELAY_MS = 2500;
/** Zdjęcie w tle: salon, plisy zamontowane od środka (zasada kreacji 10.11). */
const HERO_PHOTO = "/plisy/hero-salon-inspiracja.webp";

export default function WelcomeOffer() {
  const pathname = usePathname() || "/";
  const [settings, setSettings] = useState<WelcomeSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [code, setCode] = useState("");
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [emailState, setEmailState] = useState<"idle" | "sending" | "sent">("idle");
  const [emailError, setEmailError] = useState("");
  const [otherCode, setOtherCode] = useState(false);
  const [state, setState] = useState(() => (typeof window === "undefined" ? {} : readWelcomeState()));
  const autoTriedRef = useRef(false);

  const hidden = HIDDEN_PATHS.some((re) => re.test(pathname));
  const quiet = QUIET_PATHS.some((re) => re.test(pathname));

  useEffect(() => {
    if (isOknowoHost()) return;
    let cancelled = false;
    void loadWelcomeSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Kod osobisty i pamięć urządzenia - zmieniają się z innych miejsc (koszyk, link ?kod=).
  useEffect(() => {
    const sync = () => {
      const active = getActiveWelcomeCode();
      const personal = getPersonalCode();
      setOtherCode(Boolean(personal && !isWelcomeCode(personal.code)));
      const st = readWelcomeState();
      setState(st);
      if (st.emailGiven) setEmailState("sent");
      if (active) {
        setCode(active.code);
        setExpiresAtMs(active.expiresAtMs);
      }
    };
    sync();
    window.addEventListener(PERSONAL_CODE_EVENT, sync);
    window.addEventListener(WELCOME_EVENT, sync);
    return () => {
      window.removeEventListener(PERSONAL_CODE_EVENT, sync);
      window.removeEventListener(WELCOME_EVENT, sync);
    };
  }, []);

  const active = Boolean(code && expiresAtMs && expiresAtMs > now);
  const claimedBefore = Boolean(state.claimedCode);
  // Uruchomiony wcześniej, ale wygasły albo wykorzystany - rabatu już nie ma (jeden na gościa).
  const spent = claimedBefore && !active;
  const available = Boolean(settings?.active) && !otherCode && !spent;

  useEffect(() => {
    if (!active && !open) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active, open]);

  const claim = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await claimWelcome();
    setBusy(false);
    if (!res.ok || !res.code) {
      setError(res.error || "Nie udało się uruchomić rabatu. Spróbuj ponownie.");
      trackWelcome("welcome_claim_error", res.error || "", { page: pathname });
      return;
    }
    if (res.expired || res.used) {
      setError(res.used ? "Ten rabat został już wykorzystany w zamówieniu." : "Twój rabat już wygasł.");
      return;
    }
    const exp = res.expiresAt ? Date.parse(res.expiresAt) : NaN;
    setCode(res.code);
    setExpiresAtMs(Number.isFinite(exp) ? exp : null);
    if (res.email) setEmailState("sent");
    trackWelcome("welcome_claim", res.code, { page: pathname, new: res.ok, auto: true });
    // W koszyku kod osobisty nalicza się przy wejściu - odświeżamy, żeby od razu było widać cenę.
    if (pathname.startsWith("/koszyk")) window.setTimeout(() => window.location.reload(), 1200);
  }, [busy, pathname]);

  // Pierwsze wejście: panel sam po 2,5 s (poza stronami płatności i koszykiem).
  useEffect(() => {
    if (autoTriedRef.current || !available || hidden || quiet || active || claimedBefore) return;
    const dismissedAt = state.dismissedAt || 0;
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_QUIET_MS) return;
    // Znacznik dopiero przy otwarciu: gdy w ciągu 2,5 s zmieni się adres albo stan (np. przejście na inną
    // stronę, wizualizator), stary licznik jest kasowany i musi wystartować od nowa. Wcześniej znacznik
    // stawiany przed licznikiem blokował panel do końca wizyty (11.11: ok. 25 zaangażowanych gości bez panelu).
    const t = window.setTimeout(() => {
      autoTriedRef.current = true;
      setOpen(true);
      writeWelcomeState({ shownAt: Date.now() });
      trackWelcome("welcome_shown", "auto", { page: pathname });
      // Rabat uruchamia się sam w chwili pokazania panelu (właściciel: „właśnie uruchomiliśmy Ci rabat”).
      void claim();
    }, AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [available, hidden, quiet, active, claimedBefore, state.dismissedAt, pathname, claim]);


  const close = useCallback(() => {
    setOpen(false);
    if (!active) {
      writeWelcomeState({ dismissedAt: Date.now() });
      trackWelcome("welcome_dismiss", error ? "error" : "pending", { page: pathname });
    }
  }, [active, error, pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const submitEmail = useCallback(async () => {
    if (emailState === "sending") return;
    setEmailError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setEmailError("Wpisz poprawny adres e-mail.");
      return;
    }
    if (!consent) {
      setEmailError("Zaznacz zgodę - bez niej nie możemy wysłać rabatu ani przypomnień.");
      return;
    }
    if (!code) {
      setEmailError("Chwileczkę, rabat jeszcze się uruchamia.");
      return;
    }
    setEmailState("sending");
    const res = await sendWelcomeEmail(code, email.trim(), consent, settings?.consentText || "");
    if (!res.ok) {
      setEmailState("idle");
      setEmailError(res.error || "Nie udało się wysłać. Spróbuj ponownie.");
      return;
    }
    setEmailState("sent");
    trackWelcome("welcome_email", code, { page: pathname });
  }, [emailState, email, consent, code, settings, pathname]);

  const openFromPill = () => {
    setOpen(true);
    trackWelcome("welcome_shown", active ? "pill_active" : "pill", { page: pathname });
    if (!active && !busy) void claim();
  };

  if (!settings || hidden) return null;
  if (!available && !active) return null;

  const pct = settings.percent || 25;
  const hours = settings.hours || 24;
  const remaining = expiresAtMs ? Math.max(0, expiresAtMs - now) : 0;
  const deadline = expiresAtMs
    ? new Date(expiresAtMs).toLocaleString("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <>
      {/* W koszyku rabat widać w podsumowaniu (wiersz kodu), a plakietka zasłaniała pole kodu. */}
      {!open && !(active && pathname.startsWith("/koszyk")) ? (
        <button type="button" className={`wo-pill${active ? " is-active" : ""}`} onClick={openFromPill} aria-label={active ? `Twój rabat −${pct}% - pozostały czas ${formatRemaining(remaining)}` : `Rabat −${pct}% czeka`}>
          <span className="wo-pill-badge">−{pct}%</span>
          <span className="wo-pill-text">{active ? <><span className="wo-pill-small">Twój rabat</span><strong className="wo-pill-clock">{formatRemaining(remaining)}</strong></> : <>czeka na Ciebie</>}</span>
        </button>
      ) : null}
      {open ? (
        <div className="wo-backdrop" role="presentation" onClick={close}>
          <div className="wo-sheet" role="dialog" aria-modal="true" aria-labelledby="wo-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="wo-close" onClick={close} aria-label="Zamknij">×</button>
            <div className="wo-hero" style={{ backgroundImage: `linear-gradient(180deg, rgba(0,0,0,.30) 0%, rgba(0,0,0,.55) 45%, rgba(0,0,0,.88) 100%), url(${HERO_PHOTO})` }}>
              <span className="wo-bw" aria-label="Black Weeks">BLACK <b>WEEKS</b></span>
              <h2 id="wo-title" className="wo-title">
                <span className="wo-congrats">🎉 GRATULACJE</span>
                <span className="wo-lead">Właśnie uruchomiliśmy Ci specjalny rabat</span>
              </h2>
              <div className="wo-big">−{pct}<span>%</span></div>
              <p className="wo-sub">na całe zakupy</p>
              <div className={`wo-timer${active ? "" : " is-pending"}`} aria-live="off">
                {active ? <>⏱ zostało <strong>{formatRemaining(remaining)}</strong></> : busy ? <>⏳ uruchamiamy rabat…</> : <>⏱ {hours} godziny na zakupy</>}
              </div>
            </div>
            <div className="wo-body">
              <p className="wo-text">
                <strong>Rabat jest automatycznie przyznany w koszyku.</strong> Wykorzystaj go w ciągu {hours} godzin{deadline ? ` – do ${deadline}` : ""}.
              </p>
              {error ? (
                <div className="wo-error-box" role="alert">
                  <p className="wo-error">{error}</p>
                  <button type="button" className="wo-retry" onClick={() => void claim()} disabled={busy}>{busy ? "Chwileczkę…" : "Spróbuj ponownie"}</button>
                </div>
              ) : null}
              <button type="button" className="wo-cta" onClick={() => setOpen(false)} disabled={!active}>
                {active ? `Kupuję z rabatem −${pct}% →` : busy ? "Uruchamiamy rabat…" : `Rabat −${pct}%`}
              </button>
              {emailState === "sent" ? (
                <p className="wo-ok">✓ Rabat wysłany na e-mail. Dokończysz zakupy na dowolnym urządzeniu - przypomnimy 10 godzin i godzinę przed końcem.</p>
              ) : (
                <form
                  className="wo-mail"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submitEmail();
                  }}
                >
                  <label className="wo-mail-label" htmlFor="wo-email">📩 Wyślij rabat na e-mail i dokończ na dowolnym urządzeniu</label>
                  <div className="wo-mail-row">
                    <input id="wo-email" type="email" inputMode="email" autoComplete="email" placeholder="Twój e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
                    <button type="submit" disabled={emailState === "sending"}>{emailState === "sending" ? "…" : "Wyślij"}</button>
                  </div>
                  <label className="wo-consent">
                    <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                    <span>{settings.consentText || "Zgadzam się na e-maile z rabatem, przypomnieniami i ofertami KEIKA. Zgodę mogę wycofać w każdej chwili."}</span>
                  </label>
                  {emailError ? <p className="wo-error" role="alert">{emailError}</p> : null}
                </form>
              )}
              <p className="wo-fine">
                Rabat przyznany jest na zakup dokonany w ciągu {hours} godzin, przypisywany jest do urządzenia i/lub adresu e-mail. Jednorazowy, obejmuje całe zamówienie w sklep.keika.pl, zastępuje promocję CAŁY DOM i nie łączy się z innymi kodami.
                {code ? <> Twój kod: <strong>{code}</strong>.</> : null}
              </p>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
