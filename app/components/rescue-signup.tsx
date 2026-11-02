"use client";

// Rabat ratunkowy za zapis (2.11.2026) - okienko przy próbie wyjścia z koszyka
// z 1 sztuką i licznik kodu w koszyku. Zasady, ustawienia z CRM i pamięć
// urządzenia: lib/rescue-signup.ts.
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatPln, type CartLineItem } from "@/lib/cart";
import { PERSONAL_CODE_EVENT, getPersonalCode } from "@/lib/personal-code";
import {
  bundlePercentFor,
  cartUnits,
  formatRescueClock,
  isRescueSignupCode,
  loadRescueSignupSettings,
  markRescueShown,
  registerRescueEligibility,
  rescueCodeUnits,
  rescueOwnsCart,
  rescuePercentForUnits,
  rescueShownRecently,
  submitRescueSignup,
  trackRescue,
  type RescueSignupSettings,
} from "@/lib/rescue-signup";

/** Telefon i tablet: wstecz, przełączenie karty i bezczynność liczą się jako wyjście. */
function isTouchLayout(): boolean {
  try {
    return window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 900;
  } catch {
    return window.innerWidth <= 900;
  }
}

type Trigger = "cart_exit" | "back" | "tab_switch" | "idle";

export function RescueSignup(props: {
  items: CartLineItem[];
  hydrated: boolean;
  /** Zamówienie w toku albo złożone - okienko już nie startuje. */
  orderInProgress: boolean;
  orderConfirmed: boolean;
  /** Kod naliczony w koszyku (null = brak). */
  appliedCode: string | null;
  /** Kwota, od której liczy się kod (produkty po korektach) - do „taniej o X zł”. */
  discountBase: number;
  /** Progi CAŁY DOM (reguła na całe zamówienie) - kod zastępuje ten rabat, nie dokłada się do niego. */
  bundleTiers: Array<{ fromQty: number; percent: number }>;
  onApplyCode: (code: string) => void;
}) {
  const { items, hydrated, orderInProgress, orderConfirmed, appliedCode, discountBase, bundleTiers, onApplyCode } = props;
  const [settings, setSettings] = useState<RescueSignupSettings | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [consent, setConsent] = useState(false);
  const [status, setStatus] = useState<"idle" | "sending" | "done">("idle");
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{ code: string; percent: number; expiresLabel: string } | null>(null);
  const units = cartUnits(items);
  const percent = rescuePercentForUnits(settings, units);

  const stateRef = useRef(props);
  useEffect(() => {
    stateRef.current = props;
  });

  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    void loadRescueSignupSettings().then((s) => {
      if (!cancelled) setSettings(s);
    });
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  const eligible = useCallback((): boolean => {
    const p = stateRef.current;
    if (!p.hydrated || !settings || p.orderInProgress || p.orderConfirmed || p.appliedCode) return false;
    if (!rescueOwnsCart(p.items) || rescueShownRecently(settings)) return false;
    // Klient ma już inny kod osobisty (WRACAM-, bon za opinię) - nie dokładamy.
    if (getPersonalCode()) return false;
    return true;
  }, [settings]);

  const openedRef = useRef(false);
  useEffect(() => {
    registerRescueEligibility(() => !openedRef.current && eligible());
    return () => registerRescueEligibility(null);
  }, [eligible]);

  const tryOpen = useCallback(
    (trigger: Trigger): boolean => {
      if (openedRef.current || !eligible()) return false;
      openedRef.current = true;
      markRescueShown(settings);
      setOpen(true);
      const p = stateRef.current;
      trackRescue("rescue_shown", trigger, { units: cartUnits(p.items), percent: rescuePercentForUnits(settings, cartUnits(p.items)), product: p.items[0]?.productSlug || "" });
      return true;
    },
    [eligible, settings],
  );

  // Komputer: kursor wyjeżdża ku górze okna (pasek kart / adresu).
  useEffect(() => {
    if (!settings) return;
    const onMouseOut = (event: MouseEvent) => {
      if (event.relatedTarget || event.clientY > 8) return;
      tryOpen("cart_exit");
    };
    document.addEventListener("mouseout", onMouseOut);
    return () => document.removeEventListener("mouseout", onMouseOut);
  }, [settings, tryOpen]);

  // Telefon: przycisk wstecz. Jeden dodatkowy wpis w historii - pierwsze
  // „wstecz” pokazuje okienko, kolejne wychodzi normalnie. Gdy oferta już nie
  // pasuje (2 sztuki, kod, zamówienie), „wstecz” cofa od razu, jak zwykle.
  const trapRef = useRef(false);
  useEffect(() => {
    if (!settings || trapRef.current || !isTouchLayout() || !eligible()) return;
    try {
      window.history.pushState({ ...(window.history.state || {}), rescueTrap: true }, "");
      trapRef.current = true;
    } catch {
      // brak history API - zostają pozostałe sygnały wyjścia
    }
  }, [settings, eligible]);
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      if (!trapRef.current) return;
      if ((event.state as { rescueTrap?: boolean } | null)?.rescueTrap) return;
      trapRef.current = false;
      if (!tryOpen("back")) window.history.back();
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [tryOpen]);

  // Telefon: przełączenie karty / aplikacji i powrót.
  useEffect(() => {
    if (!settings) return;
    let hiddenAt = 0;
    const onVisibility = () => {
      if (!isTouchLayout()) return;
      if (document.visibilityState === "hidden") {
        hiddenAt = Date.now();
        return;
      }
      if (hiddenAt && Date.now() - hiddenAt >= 3000) tryOpen("tab_switch");
      hiddenAt = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [settings, tryOpen]);

  // Telefon: ok. 50 s bez dotknięcia, przewinięcia i pisania.
  useEffect(() => {
    if (!settings || !isTouchLayout()) return;
    let timer = 0;
    const arm = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => {
        if (document.visibilityState === "visible") tryOpen("idle");
      }, settings.idleSeconds * 1000);
    };
    const events = ["touchstart", "pointerdown", "scroll", "keydown", "input"] as const;
    events.forEach((name) => window.addEventListener(name, arm, { passive: true, capture: true }));
    arm();
    return () => {
      window.clearTimeout(timer);
      events.forEach((name) => window.removeEventListener(name, arm, { capture: true }));
    };
  }, [settings, tryOpen]);

  function close(how: "dismiss" | "done") {
    setOpen(false);
    if (how === "dismiss" && status !== "done") trackRescue("rescue_dismiss", "close", { units });
  }
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current("dismiss");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!/.+@.+\..+/.test(value)) {
      setError("Podaj adres e-mail - tam wyślemy kod.");
      return;
    }
    if (!consent) {
      setError("Kod wysyłamy po zaznaczeniu zgody na newsletter.");
      return;
    }
    setError("");
    setStatus("sending");
    const result = await submitRescueSignup({ email: value, consent, units, consentText: settings?.consentText || "" });
    if (!result.ok || !result.code) {
      setStatus("idle");
      setError(result.error || "Nie udało się wysłać kodu.");
      return;
    }
    setIssued({ code: result.code, percent: result.percent || percent, expiresLabel: result.expiresLabel || "" });
    setStatus("done");
    trackRescue("rescue_signup", result.code, { units, percent: result.percent || percent });
    onApplyCode(result.code);
  }

  // Pomiar: kod naliczony w koszyku (od razu albo z linku w mailu) i zamówienie z kodem.
  useEffect(() => {
    if (!isRescueSignupCode(appliedCode)) return;
    const key = `keika_rescue_applied_${appliedCode}`;
    try {
      if (window.localStorage.getItem(key)) return;
      window.localStorage.setItem(key, "1");
    } catch {
      // bez pamięci - zdarzenie może pójść drugi raz, kafel liczy osoby
    }
    trackRescue("rescue_code_applied", String(appliedCode), { units });
  }, [appliedCode, units]);
  const orderTrackedRef = useRef(false);
  useEffect(() => {
    if (!orderConfirmed || orderTrackedRef.current || !isRescueSignupCode(appliedCode)) return;
    orderTrackedRef.current = true;
    trackRescue("rescue_order", String(appliedCode), { units });
  }, [orderConfirmed, appliedCode, units]);

  // Klient zmienił liczbę sztuk (np. dołożył trzecią - kod odpadł, liczy się
  // CAŁY DOM) i wrócił do liczby, przy której kod działa - kod z zapisu wraca sam.
  const prevUnitsRef = useRef(units);
  useEffect(() => {
    const prev = prevUnitsRef.current;
    prevUnitsRef.current = units;
    if (!settings || appliedCode || units === prev || percent <= 0 || orderInProgress) return;
    const personal = getPersonalCode();
    if (personal && isRescueSignupCode(personal.code)) onApplyCode(personal.code);
  }, [units, percent, appliedCode, settings, orderInProgress, onApplyCode]);

  // Licznik 24 h w koszyku, gdy kod z zapisu jest naliczony.
  const [expiresAtMs, setExpiresAtMs] = useState<number | null>(null);
  useEffect(() => {
    const sync = () => {
      const personal = getPersonalCode();
      setExpiresAtMs(personal && isRescueSignupCode(personal.code) ? personal.expiresAtMs : null);
    };
    sync();
    window.addEventListener(PERSONAL_CODE_EVENT, sync);
    return () => window.removeEventListener(PERSONAL_CODE_EVENT, sync);
  }, []);
  const [now, setNow] = useState(0);
  const showCountdown = isRescueSignupCode(appliedCode) && expiresAtMs !== null && !orderConfirmed;
  useEffect(() => {
    if (!showCountdown) return;
    const tick = () => setNow(Date.now());
    const first = window.setTimeout(tick, 0);
    const timer = window.setInterval(tick, 1000);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(timer);
    };
  }, [showCountdown]);

  // Rabaty się nie sumują: przy 2 sztukach kod zastępuje CAŁY DOM, więc klient
  // zyskuje tylko różnicę (np. −15 % zamiast −10 % = dodatkowe 5 %).
  const bundleNow = bundlePercentFor(bundleTiers, units);
  const saving = percent > bundleNow ? Math.round(discountBase * (percent - bundleNow)) / 100 : 0;
  const hours = settings?.hours || 24;
  const codeUnits = rescueCodeUnits(settings);
  const maxCodeUnits = codeUnits.length ? codeUnits[codeUnits.length - 1] : 1;
  const bundleAfter = bundlePercentFor(bundleTiers, maxCodeUnits + 1);
  const unitsWord = (n: number) => `${n} ${n === 1 ? "sztuki" : "sztuk"}`;
  const afterText = bundleAfter > 0 ? ` Przy ${maxCodeUnits + 1} i więcej sztukach liczy się CAŁY DOM −${bundleAfter} %.` : "";
  let fineText: string;
  if (bundleNow > 0) {
    fineText = `Kod jednorazowy, ważny ${hours} h, na zamówienie ${unitsWord(units)}. Zastępuje rabat CAŁY DOM −${bundleNow} % (rabaty się nie sumują).${afterText}`;
  } else if (codeUnits.length > 1) {
    const variants = codeUnits.map((n) => {
      const pct = rescuePercentForUnits(settings, n);
      const bp = bundlePercentFor(bundleTiers, n);
      return `${unitsWord(n)} (−${pct} %${bp > 0 ? ` zamiast CAŁY DOM −${bp} %` : ""})`;
    });
    fineText = `Kod jednorazowy, ważny ${hours} h, na zamówienie ${variants.join(" albo ")}. Rabaty się nie sumują.${afterText}`;
  } else {
    fineText = `Kod jednorazowy, ważny ${hours} h, na zamówienie ${unitsWord(units)}. Nie łączy się z innymi rabatami.${afterText}`;
  }

  return (
    <>
      {showCountdown && expiresAtMs !== null && now > 0 && expiresAtMs > now ? (
        <div className="ratuj-countdown" role="status">
          <span className="ratuj-countdown-badge">−{Math.round(percent || issued?.percent || 10)}%</span>
          <span className="ratuj-countdown-text ratuj-countdown-wide">
            Kod <strong>{appliedCode}</strong> naliczony · ważny jeszcze
          </span>
          <span className="ratuj-countdown-text ratuj-countdown-narrow">Twój kod ważny jeszcze</span>
          <strong className="ratuj-countdown-clock">{formatRescueClock(expiresAtMs - now)}</strong>
        </div>
      ) : null}
      {open ? (
        <div className="ratuj-overlay" role="presentation" onClick={() => close("dismiss")}>
          <div className="ratuj-modal" role="dialog" aria-modal="true" aria-labelledby="ratuj-title" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="ratuj-close" onClick={() => close("dismiss")} aria-label="Zamknij">
              ×
            </button>
            {status === "done" && issued ? (
              <div className="ratuj-done">
                <span className="ratuj-done-check" aria-hidden="true">✓</span>
                <h2 id="ratuj-title">Gotowe - rabat naliczony</h2>
                <p>
                  Kod <strong className="ratuj-code">{issued.code}</strong> jest już w koszyku. Wysłaliśmy go też na {email.trim()}.
                </p>
                <p className="ratuj-done-deadline">Ważny do {issued.expiresLabel || "jutra"} · jednorazowy</p>
                <button type="button" className="ratuj-cta" onClick={() => close("done")}>
                  Wracam do koszyka
                </button>
              </div>
            ) : (
              <form onSubmit={submit} noValidate>
                <p className="ratuj-eyebrow">Zanim wyjdziesz</p>
                <h2 id="ratuj-title">
                  {bundleNow > 0 ? `−${Math.round(percent)}% zamiast −${bundleNow}% na to zamówienie` : `−${Math.round(percent)}% na to zamówienie`}
                </h2>
                <p className="ratuj-lead">
                  Zapisz się do newslettera KEIKA - kod wyślemy na e-mail i od razu naliczymy w koszyku.
                  {saving > 0 ? (
                    <>
                      {" "}
                      {bundleNow > 0 ? "Zaoszczędzisz dodatkowo " : "Zaoszczędzisz "}
                      <strong>{formatPln(saving)}</strong>.
                    </>
                  ) : null}
                </p>
                <label className="ratuj-field">
                  <span>Twój e-mail</span>
                  <input
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    placeholder="np. anna@gmail.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                  />
                </label>
                <label className="ratuj-consent">
                  <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
                  <span>{settings?.consentText || "Zgadzam się na otrzymywanie od KEIKA Renata Kisiel informacji handlowych i ofert e-mailem. Zgodę mogę wycofać w każdej chwili linkiem w wiadomości."}</span>
                </label>
                {error ? <p className="ratuj-error" role="alert">{error}</p> : null}
                <button type="submit" className="ratuj-cta" disabled={status === "sending"}>
                  {status === "sending" ? "Wysyłam kod…" : `Odbieram kod −${Math.round(percent)}%`}
                </button>
                <button type="button" className="ratuj-skip" onClick={() => close("dismiss")}>
                  Nie, dziękuję
                </button>
                <p className="ratuj-fine">{fineText}</p>
                <p className="ratuj-fine">
                  Administratorem danych jest KEIKA Renata Kisiel. Adres wykorzystamy do wysłania kodu, a na podstawie zgody - do wysyłki informacji handlowych.
                  Szczegóły w <Link href="/legal/prywatnosc">polityce prywatności</Link>.
                </p>
                <p className="ratuj-trust">Produkujemy na Twój wymiar · 5 lat gwarancji · 30 dni na zwrot</p>
              </form>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
