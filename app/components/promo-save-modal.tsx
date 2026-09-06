"use client";

// The countdown banner's "Zapisz / wyślij link" mini-modal - see
// app/components/promo-countdown-banner.tsx for the banner itself and
// lib/promo-save.ts for the save/send calls. Three options: Udostępnij
// (native share/copy, no contact info collected at all), SMS, E-mail - the
// latter two require picking one of two consent tiers before they'll send
// anything, per explicit business requirement (never send without an
// explicit, specific choice about what the contact info is for).
import { useState } from "react";
import { createPortal } from "react-dom";
import { savePromoContact, type PromoConsent } from "@/lib/promo-save";

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
  onClose,
}: {
  /** Empty while ensurePromoQuoteCode() (called by the banner right when it
   * mounts) hasn't resolved yet - SMS/e-mail submit stays disabled until
   * it's real, "Udostępnij"/"Kopiuj link" still work off shareUrl alone. */
  quoteCode: string;
  shareUrl: string;
  onClose: () => void;
}) {
  const [channel, setChannel] = useState<Channel | null>(null);
  const [value, setValue] = useState("");
  const [consent, setConsent] = useState<PromoConsent | null>(null);
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  async function handleCopyLink() {
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
    setStatus("sent");
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

        {status === "sent" ? (
          <div className="promo-save-modal-done">
            <span className="promo-save-modal-done-check" aria-hidden="true">✓</span>
            <h3>Wysłaliśmy link!</h3>
            <p>Sprawdź {channel === "email" ? "skrzynkę e-mail" : "SMS-y"} - link zaprowadzi Cię z powrotem tutaj.</p>
            <button type="button" className="promo-save-modal-done-cta" onClick={onClose}>
              Zamknij
            </button>
          </div>
        ) : channel === null ? (
          <>
            <h3>Zapisz swój rabat</h3>
            <p className="promo-save-modal-lead">Wybierz, jak chcesz zabrać link ze sobą:</p>
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
