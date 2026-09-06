"use client";

import { useState } from "react";

const RESCUE_WINDOW_HOURS = 12;

type RescueSubmitResult = {
  ok: boolean;
  error?: string;
  resumeUrl?: string;
  quoteCode?: string;
  discountPercent?: number;
};

type RescueModalProps = {
  productLabel: string;
  priceLine: string;
  /** Raw total (zł) so the modal can show a concrete "zaoszczędzisz X zł"
   * amount, not just the percentage - money is the persuasive part, not
   * the abstract "-5%". 0/undefined just hides that line. */
  totalAmount?: number;
  /** Any OTHER active discount already reducing totalAmount (the SEZON20
   * code, currently the only one) - on a small cart the rescue's own 5%
   * alone is just a few złoty and doesn't read as compelling, so when this
   * is set the modal instead leads with the *combined* percent/amount
   * across every active discount ("zaoszczędzisz w sumie X zł (25%) dzięki
   * wszystkim rabatom"), keeping the rescue badge itself showing only its
   * own increment. */
  otherDiscountPercent?: number;
  /** Persists the contact (however the caller's own quote-saving pipeline
   * works - the shop's app/page.tsx and the Allegro-configurator-derived
   * MoskitieryFlow save quotes through two different endpoints/payload
   * shapes, so this modal stays agnostic to that). */
  onSubmit: (contact: { email?: string; phone?: string }) => Promise<RescueSubmitResult>;
  onClose: () => void;
};

function looksLikeEmail(value: string): boolean {
  return /.+@.+\..+/.test(value);
}

function looksLikePhone(value: string): boolean {
  return value.replace(/\D/g, "").length >= 9;
}

function formatZl(amount: number): string {
  return amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function deadlineClockLabel(): string {
  const deadline = new Date(Date.now() + RESCUE_WINDOW_HOURS * 60 * 60 * 1000);
  return deadline.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" });
}

export default function RescueModal({
  productLabel,
  priceLine,
  totalAmount,
  otherDiscountPercent,
  onSubmit,
  onClose,
}: RescueModalProps) {
  const [value, setValue] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [error, setError] = useState("");
  const [resumeUrl, setResumeUrl] = useState("");
  const [quoteCode, setQuoteCode] = useState("");
  const [discountPercent, setDiscountPercent] = useState(5);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const [qrVisible, setQrVisible] = useState(false);

  const isEmail = looksLikeEmail(value.trim());
  const isPhone = !isEmail && looksLikePhone(value.trim());
  const isValid = isEmail || isPhone;

  const ownPercent = discountPercent || 5;
  const otherPercent = otherDiscountPercent || 0;
  const combinedPercent = ownPercent + otherPercent;
  const hasAmount = Boolean(totalAmount && totalAmount > 0);
  const ownSavingsZl = hasAmount ? (totalAmount! * ownPercent) / 100 : 0;
  const combinedSavingsZl = hasAmount ? (totalAmount! * combinedPercent) / 100 : 0;
  const deadlineLabel = deadlineClockLabel();

  const savingsLine =
    otherPercent > 0 && hasAmount ? (
      <p className="rescue-modal-savings-strip">
        Zaoszczędzisz w sumie <strong>{formatZl(combinedSavingsZl)} zł</strong> ({combinedPercent}%) dzięki wszystkim
        rabatom.
      </p>
    ) : hasAmount ? (
      <p className="rescue-modal-savings-strip">
        To <strong>{formatZl(ownSavingsZl)} zł</strong> mniej.
      </p>
    ) : null;

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!isValid || isSubmitting) return;
    setIsSubmitting(true);
    setError("");
    const result = await onSubmit({
      email: isEmail ? value.trim() : undefined,
      phone: isPhone ? value.trim() : undefined,
    });
    setIsSubmitting(false);
    if (!result.ok) {
      setError(result.error || "Nie udało się zapisać. Spróbuj ponownie.");
      return;
    }
    if (result.resumeUrl) setResumeUrl(result.resumeUrl);
    if (result.quoteCode) setQuoteCode(result.quoteCode);
    if (result.discountPercent) setDiscountPercent(result.discountPercent);
    setIsDone(true);
  }

  async function handleCopyLink() {
    if (!resumeUrl) return;
    try {
      await navigator.clipboard.writeText(resumeUrl);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      // Clipboard niedostępny - link jest już widoczny do ręcznego skopiowania.
    }
  }

  async function handleCopyCode() {
    if (!quoteCode) return;
    try {
      await navigator.clipboard.writeText(quoteCode);
      setCopyState("copied");
      window.setTimeout(() => setCopyState("idle"), 2200);
    } catch {
      // jak wyżej
    }
  }

  async function handleNativeShare() {
    if (!resumeUrl) return;
    try {
      await navigator.share({
        title: "KEIKA - Twoja konfiguracja",
        text: `Zapisałem konfigurację: ${productLabel}${priceLine}. Dodatkowy rabat -${discountPercent}%, link do wznowienia:`,
        url: resumeUrl,
      });
    } catch {
      // Użytkownik zamknął arkusz udostępniania albo API nie jest wsparte -
      // link jest już widoczny na ekranie jako fallback.
    }
  }

  const canNativeShare = typeof navigator !== "undefined" && typeof navigator.share === "function";

  return (
    <div className="rescue-modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="rescue-modal-shell"
        role="dialog"
        aria-modal="true"
        aria-label="Zapisz swoją wycenę"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="rescue-modal-close" onClick={onClose} aria-label="Zamknij">
          ✕
        </button>

        {isDone ? (
          <div className="rescue-modal-done">
            <span className="rescue-modal-done-check" aria-hidden="true">
              ✓
            </span>
            <h3>Zapisaliśmy Twoją wycenę!</h3>
            <div className="rescue-modal-discount-badge">
              <strong>-{discountPercent}%</strong>
              <span>ważne do {deadlineLabel}</span>
            </div>
            <p>
              Wysłaliśmy link do niej{isEmail ? " na podany e-mail" : " SMS-em na podany numer"}. Wróć w ciągu{" "}
              {RESCUE_WINDOW_HOURS} godzin, żeby dokończyć bez wypełniania niczego od nowa.
            </p>
            {savingsLine}
            <p className="rescue-modal-share-lead">Możesz też zabrać link ze sobą już teraz:</p>
            <div className="rescue-modal-share-options">
              {canNativeShare ? (
                <button type="button" className="rescue-modal-share-option is-primary" onClick={handleNativeShare}>
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
              <button type="button" className="rescue-modal-share-option" onClick={handleCopyLink}>
                <span aria-hidden="true">🔗</span>
                {copyState === "copied" ? "Skopiowano!" : "Kopiuj link"}
              </button>
              <button type="button" className="rescue-modal-share-option" onClick={() => setQrVisible((v) => !v)}>
                <span aria-hidden="true">📷</span>
                Kod QR
              </button>
              {quoteCode ? (
                <button type="button" className="rescue-modal-share-option" onClick={handleCopyCode}>
                  <span aria-hidden="true">🔑</span>
                  Kopiuj kod
                </button>
              ) : null}
            </div>
            {qrVisible && resumeUrl ? (
              <div className="rescue-modal-qr">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(resumeUrl)}`}
                  alt="Kod QR do wznowienia wyceny"
                  width={140}
                  height={140}
                />
              </div>
            ) : null}
            <button type="button" className="rescue-modal-done-cta" onClick={onClose}>
              Zamknij
            </button>
          </div>
        ) : (
          <>
            <div className="rescue-modal-discount-badge">
              <strong>-{ownPercent}%</strong>
              <span>tylko jeśli wrócisz do {deadlineLabel}</span>
            </div>
            <h3>Nie odchodź z pustymi rękami!</h3>
            <p className="rescue-modal-lead">
              Zapisz swoją konfigurację{productLabel ? ` (${productLabel}${priceLine})` : ""} i wróć w ciągu{" "}
              {RESCUE_WINDOW_HOURS} godzin, żeby zachować dodatkowy rabat <strong>-{ownPercent}%</strong>. Bez
              wypełniania niczego od nowa, na dowolnym urządzeniu.
            </p>
            {savingsLine}
            <form className="rescue-modal-form" onSubmit={handleSubmit}>
              <input
                type="text"
                inputMode="email"
                placeholder="Twój e-mail albo numer telefonu"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                autoFocus
              />
              <button type="submit" disabled={!isValid || isSubmitting}>
                {isSubmitting ? "Zapisuję…" : `Zapisz i zachowaj -${ownPercent}%`}
              </button>
            </form>
            {error ? <p className="rescue-modal-error">{error}</p> : null}
            <button type="button" className="rescue-modal-skip" onClick={onClose}>
              Nie, dziękuję
            </button>
          </>
        )}
      </div>
    </div>
  );
}
