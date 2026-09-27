"use client";

// The countdown banner's "Zapisz / wyślij link" mini-modal - see
// app/components/promo-countdown-banner.tsx for the banner itself and
// lib/promo-save.ts for the save/send calls. Three options: Udostępnij
// (native share/copy, no contact info collected at all), SMS, E-mail - the
// latter two require picking one of two consent tiers before they'll send
// anything, per explicit business requirement (never send without an
// explicit, specific choice about what the contact info is for).
import { useEffect, useState } from "react";
import { trackShopStep } from "@/lib/track-step";
import { createPortal } from "react-dom";
import { formatPromoFrozenUntil, formatPromoRemaining } from "@/lib/promo";
import { freezeCartToEmail, savePromoContact, type PromoConsent } from "@/lib/promo-save";

type Channel = "sms" | "email";

function looksLikeEmail(value: string): boolean {
  return /.+@.+\..+/.test(value);
}

function looksLikePhone(value: string): boolean {
  return value.replace(/\D/g, "").length >= 9;
}

export default function PromoSaveModal({
  quoteCode,
  shareUrl,
  remainingMs,
  variant = "reminder",
  onClose,
  onSent,
  productSlug,
}: {
  /** Empty while ensurePromoQuoteCode() (called by the banner right when it
   * mounts) hasn't resolved yet - SMS/e-mail submit stays disabled until
   * it's real, "Udostępnij"/"Kopiuj link" still work off shareUrl alone. */
  quoteCode: string;
  shareUrl: string;
  /** Undefined/0 hides the urgency chip entirely - callers that don't track
   * a live countdown (or whose deadline already lapsed) just get the plain
   * save/share copy below it, never a broken "0 min" chip. */
  remainingMs?: number;
  /** "reminder" (default): the code was already active, customer just never
   * saved/shared it - straight into the save/share options.
   * "activated": the exit-intent modal turned SEZON20 on FOR the customer
   * (they'd never activated it at all) - shows one extra intro screen
   * framing that ("włączyliśmy go za Ciebie") before the same options, with
   * a "Zostań na stronie" way out for someone who doesn't want to save/
   * share right now but still keeps the just-activated discount.
   * "announcement": promo-countdown-banner.tsx's own first-visit
   * auto-activation (every new visitor gets the code turned on
   * automatically, not just exit-intent) - a single self-contained screen,
   * no share options inside the modal at all. It deliberately points at the
   * header save/share button instead ("korzystając z przycisku u góry") -
   * that button itself shakes right as this modal closes (see
   * ATTRACT_SAVE_SHARE_EVENT below) so there's exactly one, unambiguous
   * place to go save/share from, never two competing flows.
   * "measure": opened from the plisy configurator's dimensions step
   * (2026-09-17) for the customer who has picked everything but can't type
   * a size yet because the window isn't measured - half of everyone who
   * reached that step just went quiet and left. Same save/share options,
   * copy framed around "come back once you've measured", never around the
   * discount. */
  variant?: "reminder" | "activated" | "announcement" | "measure" | "cart";
  onClose: () => void;
  /** "cart" (2026-09-26, "Wyślij koszyk na e-mail, cena zamrożona na 7 dni"):
   * called right after a successful send so the caller can close the offer
   * as "sent" rather than "dismissed". E-mail required, phone optional,
   * no share/copy options - see lib/promo-save.ts freezeCartToEmail(). */
  onSent?: () => void;
  productSlug?: string;
}) {
  const [introDismissed, setIntroDismissed] = useState(variant !== "activated");
  const [channel, setChannel] = useState<Channel | null>(null);
  const [value, setValue] = useState("");
  const [consent, setConsent] = useState<PromoConsent | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  // "cart" variant only.
  const [cartPhone, setCartPhone] = useState("");
  const [cartRemind, setCartRemind] = useState(true);
  const [cartMarketing, setCartMarketing] = useState(false);
  const [frozenUntilMs, setFrozenUntilMs] = useState<number | null>(null);

  // Escape closes (audit 2026-09-13) - the overlay click already did, the
  // keyboard didn't.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // Every save/share action is logged against the quote (2026-09-17). Until
  // now only the SMS/e-mail submit reached the CRM; "Kopiuj link" and the
  // system share sheet - the two things people actually tap on a phone -
  // left no trace, so the quote list's 💾/🔗 badges stayed empty for every
  // customer of the current landing pages and the owner concluded nobody
  // saves anything. 25 resume links were opened in the 14 days before this.
  useEffect(() => {
    trackShopStep("open_save_share", variant, { quote_code: quoteCode || null }, quoteCode || undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleCopyLink() {
    trackShopStep("copy_quote_link", variant, { quote_code: quoteCode || null }, quoteCode || undefined);
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      // Clipboard niedostępny - link jest już widoczny do ręcznego skopiowania.
    }
  }

  async function handleNativeShare() {
    try {
      await navigator.share({
        title: "KEIKA - Twój rabat",
        text: "Zapisałem link do sklepu z aktywnym rabatem:",
        url: shareUrl,
      });
      trackShopStep("share_quote_link", variant, { quote_code: quoteCode || null }, quoteCode || undefined);
    } catch {
      // Użytkownik zamknął arkusz udostępniania albo API nie jest wsparte -
      // link jest już widoczny na ekranie jako fallback.
    }
  }

  function openChannel(next: Channel) {
    setChannel(next);
    setValue("");
    setConsent(null);
    setStatus("idle");
    setError("");
  }

  const trimmedValue = value.trim();
  const valueValid = channel === "email" ? looksLikeEmail(trimmedValue) : looksLikePhone(trimmedValue);
  const canSubmit = Boolean(quoteCode) && valueValid && consent !== null && status !== "sending";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canSubmit || !channel || !consent) return;
    setStatus("sending");
    setError("");
    const result = await savePromoContact({
      quoteCode,
      email: channel === "email" ? trimmedValue : undefined,
      phone: channel === "sms" ? trimmedValue : undefined,
      consent,
    });
    if (!result.ok) {
      setStatus("error");
      setError(result.error || "Nie udało się zapisać. Spróbuj ponownie.");
      return;
    }
    trackShopStep("send_quote_link", channel, { quote_code: quoteCode || null, consent }, quoteCode || undefined);
    setStatus("sent");
  }

  const cartEmailValid = looksLikeEmail(trimmedValue);
  const cartPhoneValid = cartPhone.trim() === "" || looksLikePhone(cartPhone.trim());
  const canCartSubmit = cartEmailValid && cartPhoneValid && status !== "sending";

  async function handleCartSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!canCartSubmit) return;
    setStatus("sending");
    setError("");
    const result = await freezeCartToEmail({
      email: trimmedValue,
      phone: cartPhone.trim() || undefined,
      consent: cartMarketing ? "marketing" : "one_time",
      remind: cartRemind,
      productSlug,
    });
    if (!result.ok) {
      setStatus("error");
      setError(result.error || "Nie udało się zapisać. Spróbuj ponownie.");
      return;
    }
    setFrozenUntilMs(result.frozenUntilMs);
    trackShopStep("cart_email_sent", cartPhone.trim() ? "email_sms" : "email", {
      remind: cartRemind,
      marketing: cartMarketing,
    });
    setStatus("sent");
    onSent?.();
  }

  const modal = (
    <div className="promo-save-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="promo-save-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-label="Zapisz link do rabatu"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="promo-save-modal-close" onClick={onClose} aria-label="Zamknij">
          ✕
        </button>

        {variant !== "announcement" && introDismissed && typeof remainingMs === "number" && remainingMs > 0 ? (
          <div className="promo-save-modal-urgency">
            <span aria-hidden="true">⏳</span> Rabat wygasa za <strong>{formatPromoRemaining(remainingMs)}</strong>
          </div>
        ) : null}

        {variant === "cart" ? (
          status === "sent" ? (
            <div className="promo-save-modal-done">
              <span className="promo-save-modal-done-check" aria-hidden="true">✓</span>
              <h3>Koszyk wysłany</h3>
              <p>
                Sprawdź skrzynkę e-mail.{" "}
                {frozenUntilMs ? (
                  <>
                    Twoja cena jest zamrożona do <strong>{formatPromoFrozenUntil(frozenUntilMs)}</strong> - nawet jeśli
                    promocja wygaśnie wcześniej.
                  </>
                ) : (
                  <>Link zaprowadzi Cię prosto do koszyka, z tą samą ceną.</>
                )}
              </p>
              <button type="button" className="promo-save-modal-done-cta" onClick={onClose}>
                Zamknij
              </button>
            </div>
          ) : (
            <form className="promo-save-modal-form cart-email-form" onSubmit={handleCartSubmit}>
              <h3>Wyślij koszyk na e-mail</h3>
              <p className="promo-save-modal-lead">
                Zapiszemy Twój koszyk i <strong>zamrozimy dzisiejszą cenę na 7 dni</strong>. Nawet jeśli promocja
                wygaśnie, Twoja cena zostanie. Wrócisz jednym kliknięciem, także z innego urządzenia.
              </p>
              <input
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="Twój e-mail"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoFocus
                required
              />
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                placeholder="Telefon (opcjonalnie - wyślemy też SMS z linkiem)"
                value={cartPhone}
                onChange={(event) => setCartPhone(event.target.value)}
              />
              <fieldset className="promo-save-modal-consent">
                <label className="promo-save-modal-consent-option">
                  <input type="checkbox" checked={cartRemind} onChange={(event) => setCartRemind(event.target.checked)} />
                  <span>Przypomnijcie mi o tym koszyku, zanim cena się odmrozi.</span>
                </label>
                <label className="promo-save-modal-consent-option">
                  <input type="checkbox" checked={cartMarketing} onChange={(event) => setCartMarketing(event.target.checked)} />
                  <span>Chcę też dostawać informacje o promocjach KEIKA.</span>
                </label>
              </fieldset>
              <button type="submit" disabled={!canCartSubmit}>
                {status === "sending" ? "Wysyłam…" : "Wyślij koszyk i zamroź cenę"}
              </button>
              <button type="button" className="promo-save-modal-back cart-email-form-skip" onClick={onClose}>
                Nie, dziękuję
              </button>
              {error ? <p className="promo-save-modal-error">{error}</p> : null}
            </form>
          )
        ) : variant === "announcement" ? (
          <div className="promo-announce">
            <span className="promo-announce-badge" aria-hidden="true">🎉</span>
            <h3>Rabat -20% aktywny!</h3>
            <ul className="promo-announce-points">
              <li>
                <span aria-hidden="true">⏱️</span>
                {typeof remainingMs === "number" && remainingMs > 0 ? (
                  <>
                    Ważny jeszcze <strong>{formatPromoRemaining(remainingMs)}</strong> - nie przegap!
                  </>
                ) : (
                  <>Nie przegap!</>
                )}
              </li>
              <li>
                <span aria-hidden="true">🔗</span>
                Udostępnij ofertę przyciskiem obok koszyka, u góry strony.
              </li>
            </ul>
            <button type="button" className="promo-save-option is-primary promo-announce-cta" onClick={onClose}>
              Rozumiem
            </button>
          </div>
        ) : !introDismissed ? (
          <>
            <h3>Zaczekaj - nie skorzystałeś jeszcze z rabatu</h3>
            <p className="promo-save-modal-lead">
              Włączyliśmy go za Ciebie - wszystkie ceny w sklepie są teraz niższe o 20%.
              {typeof remainingMs === "number" && remainingMs > 0
                ? ` Skorzystaj z rabatu w ciągu ${formatPromoRemaining(remainingMs)}.`
                : " Skorzystaj z rabatu, zanim wygaśnie."}
            </p>
            <div className="promo-save-modal-options">
              <button type="button" className="promo-save-option is-primary" onClick={onClose}>
                <span aria-hidden="true">👍</span>
                Zostań na stronie
              </button>
              <button type="button" className="promo-save-option" onClick={() => setIntroDismissed(true)}>
                <span aria-hidden="true">🔗</span>
                Zapisz / udostępnij
              </button>
            </div>
          </>
        ) : status === "sent" ? (
          <div className="promo-save-modal-done">
            <span className="promo-save-modal-done-check" aria-hidden="true">✓</span>
            <h3>Wysłaliśmy link!</h3>
            <p>
              Sprawdź {channel === "email" ? "skrzynkę e-mail" : "SMS-y"} - link zaprowadzi Cię z powrotem tutaj
              {variant === "measure" ? ", do instrukcji pomiaru i Twojej konfiguracji" : ""}, z rabatem wciąż naliczonym.
            </p>
            <button type="button" className="promo-save-modal-done-cta" onClick={onClose}>
              Zamknij
            </button>
          </div>
        ) : channel === null ? (
          <>
            {variant === "measure" ? (
              <>
                <h3>Dokończ, kiedy zmierzysz okno</h3>
                <p className="promo-save-modal-lead">
                  Zapisz lub udostępnij link do tej konfiguracji - montaż, kolor i tkanina zostaną zapamiętane, a rabat
                  SEZON20 będzie czekał. Wrócisz jednym kliknięciem, także z innego telefonu.
                </p>
              </>
            ) : (
              <>
                <h3>Zabierz swój rabat -20% ze sobą</h3>
                <p className="promo-save-modal-lead">
                  Zapisz link i wróć do zakupów kiedy zechcesz - rabat będzie na Ciebie czekał.
                </p>
              </>
            )}
            <div className="promo-save-modal-options">
              {canNativeShare ? (
                <button type="button" className="promo-save-option is-primary" onClick={handleNativeShare}>
                  <span aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none" width="1.15em" height="1.15em">
                      <path
                        d="M14 3h7v7M21 3 10 14M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </span>
                  Udostępnij
                </button>
              ) : null}
              <button type="button" className="promo-save-option" onClick={handleCopyLink}>
                <span aria-hidden="true">🔗</span>
                {copyState === "copied" ? "Skopiowano!" : "Kopiuj link"}
              </button>
              <button type="button" className="promo-save-option" onClick={() => openChannel("sms")}>
                <span aria-hidden="true">💬</span>
                SMS
              </button>
              <button type="button" className="promo-save-option" onClick={() => openChannel("email")}>
                <span aria-hidden="true">✉️</span>
                E-mail
              </button>
            </div>
            <div className="promo-save-modal-linkbox">
              <code>{shareUrl}</code>
            </div>
          </>
        ) : (
          <form className="promo-save-modal-form" onSubmit={handleSubmit}>
            <button type="button" className="promo-save-modal-back" onClick={() => setChannel(null)}>
              ← Wróć
            </button>
            <h3>{channel === "email" ? "Wyślij na e-mail" : "Wyślij SMS-em"}</h3>
            <input
              type="text"
              inputMode={channel === "email" ? "email" : "tel"}
              placeholder={channel === "email" ? "Twój e-mail" : "Twój numer telefonu"}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              autoFocus
            />
            <fieldset className="promo-save-modal-consent">
              <label className="promo-save-modal-consent-option" title="Otrzymasz tylko link i przypomnienie o wygasającym rabacie - nic więcej.">
                <input
                  type="radio"
                  name="promo_save_consent"
                  checked={consent === "one_time"}
                  onChange={() => setConsent("one_time")}
                />
                <span>Wyrażam zgodę na jednorazowe użycie danych do obsługi tej promocji.</span>
              </label>
              <label className="promo-save-modal-consent-option" title="Zachowamy Twoje dane kontaktowe, aby poinformować Cię o najlepszych naszych promocjach.">
                <input
                  type="radio"
                  name="promo_save_consent"
                  checked={consent === "marketing"}
                  onChange={() => setConsent("marketing")}
                />
                <span>Wyrażam zgodę na zachowanie danych kontaktowych, aby nie przegapić najlepszych ofert i promocji.</span>
              </label>
            </fieldset>
            <button type="submit" disabled={!canSubmit}>
              {status === "sending" ? "Wysyłam…" : "Wyślij link"}
            </button>
            {error ? <p className="promo-save-modal-error">{error}</p> : null}
          </form>
        )}
      </div>
    </div>
  );

  return typeof document !== "undefined" ? createPortal(modal, document.body) : null;
}
