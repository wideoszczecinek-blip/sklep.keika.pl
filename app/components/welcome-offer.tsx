"use client";

// Oferta powitalna Black Weeks −25 % (właściciel 11.11.2026, test 7 dni) -
// logika i pamięć urządzenia: lib/welcome-offer.ts, CRM: shop_welcome_offer.php.
//
// Telefon to ~97 % ruchu, więc panel wysuwa się od dołu (nie pełny ekran) i
// zamyka jednym ruchem. Po zamknięciu albo odebraniu zostaje mała plakietka
// z lewej u dołu: przed odebraniem „−25 % czeka”, po odebraniu odliczanie.
// E-mail jest nieobowiązkowy i pojawia się dopiero po odebraniu rabatu.
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

/** Strony, na których panel sam się nie otwiera (płatność, status zamówienia, regulaminy). */
const QUIET_PATHS = [/^\/zamowienie/, /^\/wycena/, /^\/p\//, /^\/legal/, /^\/regulamin/, /^\/panel/, /^\/koszyk/];
/** Strony, na których nie ma nawet plakietki. */
const HIDDEN_PATHS = [/^\/zamowienie/, /^\/wycena/, /^\/p\//];
/** Po zamknięciu panel nie wraca sam przez tyle czasu (plakietka zostaje). */
const DISMISS_QUIET_MS = 12 * 60 * 60 * 1000;
const AUTO_OPEN_DELAY_MS = 2500;

type View = "offer" | "claimed";

export default function WelcomeOffer() {
  const pathname = usePathname() || "/";
  const [settings, setSettings] = useState<WelcomeSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("offer");
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
      setState(readWelcomeState());
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
  // Odebrany wcześniej, ale wygasły albo wykorzystany - oferty już nie ma (jedna na gościa).
  const spent = claimedBefore && !active;
  const available = Boolean(settings?.active) && !otherCode && !spent;

  useEffect(() => {
    if (!active && !open) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [active, open]);

  // Pierwsze wejście: panel sam po 2,5 s (poza stronami płatności i koszykiem).
  useEffect(() => {
    if (autoTriedRef.current || !available || hidden || quiet || active || claimedBefore) return;
    const dismissedAt = state.dismissedAt || 0;
    if (dismissedAt && Date.now() - dismissedAt < DISMISS_QUIET_MS) return;
    autoTriedRef.current = true;
    const t = window.setTimeout(() => {
      setView("offer");
      setOpen(true);
      writeWelcomeState({ shownAt: Date.now() });
      trackWelcome("welcome_shown", "auto", { page: pathname });
    }, AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(t);
  }, [available, hidden, quiet, active, claimedBefore, state.dismissedAt, pathname]);

  const close = useCallback(() => {
    setOpen(false);
    if (!active) {
      writeWelcomeState({ dismissedAt: Date.now() });
      trackWelcome("welcome_dismiss", view, { page: pathname });
    }
  }, [active, view, pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, close]);

  const claim = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    setError("");
    const res = await claimWelcome();
    setBusy(false);
    if (!res.ok || !res.code) {
      setError(res.error || "Nie udało się. Spróbuj ponownie.");
      trackWelcome("welcome_claim_error", res.error || "", { page: pathname });
      return;
    }
    if (res.expired || res.used) {
      setError(res.used ? "Ten rabat został już wykorzystany w zamówieniu." : "Twój rabat powitalny już wygasł.");
      return;
    }
    const exp = res.expiresAt ? Date.parse(res.expiresAt) : NaN;
    setCode(res.code);
    setExpiresAtMs(Number.isFinite(exp) ? exp : null);
    setView("claimed");
    setEmailState(res.email ? "sent" : "idle");
    trackWelcome("welcome_claim", res.code, { page: pathname, new: res.ok });
    // W koszyku kod osobisty nalicza się przy wejściu - odświeżamy, żeby od razu było widać cenę.
    if (pathname.startsWith("/koszyk")) window.setTimeout(() => window.location.reload(), 900);
  }, [busy, pathname]);

  const submitEmail = useCallback(async () => {
    if (emailState === "sending") return;
    setEmailError("");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())) {
      setEmailError("Wpisz poprawny adres e-mail.");
      return;
    }
    if (!consent) {
      setEmailError("Zaznacz zgodę - bez niej nie możemy wysłać kodu ani przypomnień.");
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
    setView(active ? "claimed" : "offer");
    if (active && state.emailGiven) setEmailState("sent");
    setOpen(true);
    trackWelcome("welcome_shown", active ? "pill_active" : "pill", { page: pathname });
  };

  if (!settings || hidden) return null;
  if (!available && !active) return null;

  const pct = settings.percent || 25;
  const remaining = expiresAtMs ? Math.max(0, expiresAtMs - now) : 0;
  const deadline = expiresAtMs
    ? new Date(expiresAtMs).toLocaleString("pl-PL", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })
    : "";

  return (
    <>
      {/* W koszyku rabat widać w podsumowaniu (wiersz kodu), a plakietka zasłaniała pole kodu. */}
      {!open && !(active && pathname.startsWith("/koszyk")) ? (
        <button type="button" className={`wo-pill${active ? " is-active" : ""}`} onClick={openFromPill} aria-label={active ? `Twój rabat −${pct}% - pozostały czas ${formatRemaining(remaining)}` : `Odbierz rabat −${pct}%`}>
          <span className="wo-pill-badge">−{pct}%</span>
          <span className="wo-pill-text">{active ? <><span className="wo-pill-small">Twój rabat</span><strong className="wo-pill-clock">{formatRemaining(remaining)}</strong></> : <>czeka na Ciebie</>}</span>
        </button>
      ) : null}
      {open ? (
        <div className="wo-backdrop" role="presentation" onClick={close}>
          <div className="wo-sheet" role="dialog" aria-modal="true" aria-labelledby="wo-title" onClick={(e) => e.stopPropagation()}>
            <button type="button" className="wo-close" onClick={close} aria-label="Zamknij">×</button>
            <div className="wo-hero">
              <span className="wo-kicker">Black Weeks KEIKA</span>
              {view === "offer" ? (
                <>
                  <h2 id="wo-title" className="wo-title">Mamy dla Ciebie dobrą wiadomość</h2>
                  <div className="wo-big">−{pct}<span>%</span></div>
                  <p className="wo-sub">na całe zamówienie, już od 1 sztuki</p>
                </>
              ) : (
                <>
                  <h2 id="wo-title" className="wo-title">Rabat −{pct}% jest Twój</h2>
                  <div className="wo-clock" aria-live="off">{formatRemaining(remaining)}</div>
                  <p className="wo-sub">ważny do {deadline}</p>
                </>
              )}
            </div>
            {view === "offer" ? (
              <div className="wo-body">
                <ul className="wo-points">
                  <li>Plisy, moskitiery i rolety produkujemy na Twój wymiar</li>
                  <li>5 lat gwarancji · 30 dni na zwrot</li>
                  <li>Rabat naliczy się sam w koszyku - bez wpisywania kodu</li>
                </ul>
                <button type="button" className="wo-cta" onClick={claim} disabled={busy}>
                  {busy ? "Chwileczkę…" : `Odbieram −${pct}%`}
                </button>
                {error ? <p className="wo-error" role="alert">{error}</p> : null}
                <p className="wo-fine">Masz {settings.hours} godziny od odebrania. Rabat jest jednorazowy, obejmuje całe zamówienie w sklep.keika.pl, zastępuje promocję CAŁY DOM i nie łączy się z innymi kodami.</p>
              </div>
            ) : (
              <div className="wo-body">
                <p className="wo-ok">✓ Gotowe - rabat naliczy się sam w koszyku na tym urządzeniu.</p>
                {emailState === "sent" ? (
                  <p className="wo-ok wo-ok--mail">✓ Kod jest w Twojej skrzynce. Przypomnimy o nim 10 godzin i godzinę przed końcem.</p>
                ) : (
                  <form
                    className="wo-mail"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submitEmail();
                    }}
                  >
                    <label className="wo-mail-label" htmlFor="wo-email">Chcesz przypomnienie? <span>(nieobowiązkowo)</span></label>
                    <p className="wo-mail-hint">Wyślemy kod na e-mail - zadziała też na innym urządzeniu - i przypomnimy 10 h i godzinę przed końcem.</p>
                    <div className="wo-mail-row">
                      <input id="wo-email" type="email" inputMode="email" autoComplete="email" placeholder="Twój e-mail" value={email} onChange={(e) => setEmail(e.target.value)} />
                      <button type="submit" disabled={emailState === "sending"}>{emailState === "sending" ? "…" : "Wyślij"}</button>
                    </div>
                    <label className="wo-consent">
                      <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                      <span>{settings.consentText || "Zgadzam się na e-maile z kodem, przypomnieniami i ofertami KEIKA. Zgodę mogę wycofać w każdej chwili."}</span>
                    </label>
                    {emailError ? <p className="wo-error" role="alert">{emailError}</p> : null}
                  </form>
                )}
                <button type="button" className="wo-cta wo-cta--ghost" onClick={() => setOpen(false)}>
                  Wybieram produkty →
                </button>
                <p className="wo-fine">Twój kod: <strong>{code}</strong> · jednorazowy · zastępuje promocję CAŁY DOM, nie łączy się z innymi kodami.</p>
              </div>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
