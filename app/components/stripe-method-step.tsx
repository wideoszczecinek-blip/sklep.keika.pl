"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Elements, ExpressCheckoutElement, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { PaymentIntentResult, StripeElementsOptions, StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { trackStorefrontEvent } from "@/lib/shop-public";
import type { CheckoutContact } from "./stripe-payment-step";
import {
  BLIK_APPROVAL_SECONDS,
  POLL_TIMEOUT_MESSAGE,
  pollPaymentIntentUntilSettled,
  rejectionMessage,
} from "./payment-poll";

// Jedna metoda Stripe na raz - "po kliknięciu BLIK po prostu pojawia się
// pole BLIK" (właściciel, 2026-09-22). Tryb odroczony (deferred intent):
// Elements dostaje tylko kwotę/walutę/typ metody i renderuje pole od razu,
// bez zamówienia i bez PaymentIntent; zamówienie + PaymentIntent powstają
// dopiero po kliknięciu "Płacę" (createIntent), po czym confirmPayment
// potwierdza z tym samym elementem. Dzięki temu dane zamówienia nie są
// blokowane, zanim klient faktycznie płaci (patrz audyt 2026-09-13 -
// szkice z uciętymi adresami), a zmiana kwoty (rabat, ilość) to tylko
// elements.update({amount}).
//
// BLIK: Stripe nie pozwala na Payment Element z samym BLIK-iem w trybie
// odroczonym ("No valid payment method types for this configuration"), więc
// pole na 6-cyfrowy kod jest nasze, a płatność potwierdza
// stripe.confirmBlikPayment(clientSecret, {payment_method_options: {blik:
// {code}}}) - bez iframe, kod widać od razu, zamówienie powstaje przy "Płacę".
//
// "wallets" = Google Pay / Apple Pay przez ExpressCheckoutElement (typ
// "card" po stronie Stripe); wymaga zarejestrowanej domeny sklepu w Stripe
// (payment method domains) - bez tego przyciski się nie pojawią i
// pokazujemy podpowiedź, żeby wybrać kartę lub BLIK.

export type StripeMethod = "blik" | "card" | "wallets";

export type CreatedIntent = { clientSecret: string; orderCode: string };

function trackPaymentIssue(label: string, orderCode: string, message: string) {
  let sessionToken = "";
  try {
    sessionToken = window.sessionStorage.getItem("keika_shop_session_token") || "";
  } catch {
    // sessionStorage niedostępny - event i tak poleci bez grupowania w sesję.
  }
  void trackStorefrontEvent({
    event_name: "payment_failed_client",
    event_label: label,
    order_code: orderCode,
    session_token: sessionToken,
    device_type: window.innerWidth < 768 ? "mobile" : "desktop",
    meta: { message: message.slice(0, 300) },
  }).catch(() => null);
}

function trackPaymentChoice(eventName: string, label: string, orderCode: string) {
  let sessionToken = "";
  try {
    sessionToken = window.sessionStorage.getItem("keika_shop_session_token") || "";
  } catch {
    // jw.
  }
  void trackStorefrontEvent({
    event_name: eventName,
    event_label: label,
    order_code: orderCode,
    page_slug: window.location.pathname,
    session_token: sessionToken,
    device_type: window.innerWidth < 768 ? "mobile" : "desktop",
  }).catch(() => null);
}

const STRIPE_APPEARANCE_LIGHT = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#d9600a",
    colorBackground: "#ffffff",
    colorText: "#16314e",
    colorTextSecondary: "rgba(19, 40, 67, 0.6)",
    colorTextPlaceholder: "rgba(19, 40, 67, 0.35)",
    colorDanger: "#c4432c",
    fontFamily: '"Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Label": { color: "rgba(19, 40, 67, 0.72)", fontSize: "0.82rem", fontWeight: "600" },
    ".Input": { border: "1px solid #e2e6ec", backgroundColor: "#ffffff", boxShadow: "none" },
    ".Input:focus": { border: "1px solid #d9600a", boxShadow: "0 0 0 1px rgba(217, 96, 10, 0.35)" },
  },
};

// Zmiana metody = nowy komponent (koszyk montuje go z key={metoda}), więc
// stan pola zaczyna się od zera bez żadnych efektów.
export default function StripeMethodStep({
  publishableKey,
  method,
  amountGrosze,
  contact,
  termsAccepted,
  disabledReason,
  existingClientSecret,
  existingOrderCode,
  createIntent,
  onPaid,
  submitLabel = "Płacę",
  termsSlot,
  blockedHint,
  onBlocked,
}: {
  publishableKey: string;
  method: StripeMethod;
  amountGrosze: number;
  contact: CheckoutContact;
  termsAccepted: boolean;
  /** Checkbox regulaminu renderowany TUŻ NAD przyciskiem płatności danej
   * metody (właściciel, 2026-09-29: "akceptacja regulaminu wszędzie nad CTA,
   * jak najbliżej"). Koszyk podaje swój element; strona ponowienia nic. */
  termsSlot?: ReactNode;
  /** Co pokazać pod zablokowanym przyciskiem zamiast samego disabledReason
   * (koszyk podaje listę "Do zapłaty brakuje: ..."). */
  blockedHint?: ReactNode;
  /** Klik w zablokowany przycisk - koszyk przewija do pierwszego braku. */
  onBlocked?: () => void;
  /** Pusty string = można płacić; inaczej powód (np. brakujące dane), który
   * blokuje przycisk i jest pokazywany pod polem. */
  disabledReason: string;
  /** PaymentIntent z poprzedniej, nieudanej próby (ten sam koszyk) - do
   * ponownego użycia zamiast tworzenia nowego zamówienia. */
  existingClientSecret?: string;
  existingOrderCode?: string;
  createIntent: () => Promise<CreatedIntent | null>;
  onPaid: (orderCode: string) => void;
  submitLabel?: string;
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  const options: StripeElementsOptions = useMemo(
    () => ({
      mode: "payment",
      amount: Math.max(1, Math.round(amountGrosze)),
      currency: "pln",
      paymentMethodTypes: ["card"],
      appearance: STRIPE_APPEARANCE_LIGHT,
      locale: "pl",
    }),
    [amountGrosze, method],
  );
  return (
    <Elements stripe={stripePromise} options={options}>
      <StripeMethodInner
        method={method}
        contact={contact}
        termsAccepted={termsAccepted}
        disabledReason={disabledReason}
        existingClientSecret={existingClientSecret}
        existingOrderCode={existingOrderCode}
        createIntent={createIntent}
        onPaid={onPaid}
        submitLabel={submitLabel}
        termsSlot={termsSlot}
        blockedHint={blockedHint}
        onBlocked={onBlocked}
      />
    </Elements>
  );
}

function StripeMethodInner({
  method,
  contact,
  termsAccepted,
  disabledReason,
  existingClientSecret,
  existingOrderCode,
  createIntent,
  onPaid,
  submitLabel,
  termsSlot,
  blockedHint,
  onBlocked,
}: {
  method: StripeMethod;
  contact: CheckoutContact;
  termsAccepted: boolean;
  disabledReason: string;
  existingClientSecret?: string;
  existingOrderCode?: string;
  createIntent: () => Promise<CreatedIntent | null>;
  onPaid: (orderCode: string) => void;
  submitLabel: string;
  termsSlot?: ReactNode;
  /** Co pokazać pod zablokowanym przyciskiem zamiast samego disabledReason
   * (koszyk podaje listę "Do zapłaty brakuje: ..."). */
  blockedHint?: ReactNode;
  /** Klik w zablokowany przycisk - koszyk przewija do pierwszego braku. */
  onBlocked?: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [elementReady, setElementReady] = useState(false);
  const [walletsAvailable, setWalletsAvailable] = useState<boolean | null>(null);
  const [isWaitingBankConfirmation, setIsWaitingBankConfirmation] = useState(false);
  const [blikCode, setBlikCode] = useState("");
  const [approvalSecondsLeft, setApprovalSecondsLeft] = useState(BLIK_APPROVAL_SECONDS);
  const blikInputRef = useRef<HTMLInputElement | null>(null);

  const billingDetails = {
    name: contact.name || undefined,
    email: contact.email || undefined,
    phone: contact.phone || undefined,
    address: {
      city: contact.city || undefined,
      postal_code: contact.postcode || undefined,
      line1: contact.address1 || undefined,
      state: "",
      country: "PL",
    },
  };

  useEffect(() => {
    if (!isWaitingBankConfirmation) return;
    const id = window.setInterval(() => setApprovalSecondsLeft((left) => (left > 0 ? left - 1 : 0)), 1000);
    return () => window.clearInterval(id);
  }, [isWaitingBankConfirmation]);

  async function pollUntilSettled(clientSecret: string, orderCode: string) {
    if (!stripe) return;
    const outcome = await pollPaymentIntentUntilSettled(stripe, clientSecret);
    setIsWaitingBankConfirmation(false);
    if (outcome.kind === "succeeded") {
      onPaid(orderCode);
      return;
    }
    if (outcome.kind === "rejected") {
      // Wygasły/odrzucony kod nie zadziała po ponownym wysłaniu - czyścimy pole,
      // żeby klient wpisał świeży kod z aplikacji banku.
      setBlikCode("");
      const message = rejectionMessage(outcome.errorCode);
      setError(message);
      setIsSubmitting(false);
      trackPaymentIssue(outcome.errorCode || outcome.status, orderCode, message);
      window.setTimeout(() => blikInputRef.current?.focus(), 50);
      return;
    }
    setError(POLL_TIMEOUT_MESSAGE);
    setIsSubmitting(false);
    trackPaymentIssue("processing_timeout", orderCode, POLL_TIMEOUT_MESSAGE);
  }

  async function confirmWithIntent(intent: CreatedIntent, withBilling: boolean) {
    if (!stripe || !elements) return;
    let result: PaymentIntentResult;
    try {
      result = await stripe.confirmPayment({
        elements,
        clientSecret: intent.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/zamowienie/${encodeURIComponent(intent.orderCode)}?from_payment=1`,
          ...(withBilling ? { payment_method_data: { billing_details: billingDetails } } : {}),
        },
        redirect: "if_required",
      });
    } catch (err) {
      const message = "Nie udało się uruchomić płatności. Odśwież stronę i spróbuj ponownie.";
      setError(message);
      setIsSubmitting(false);
      trackPaymentIssue("confirm_payment_threw", intent.orderCode, err instanceof Error ? err.message : String(err));
      return;
    }
    if (result.error) {
      const message = result.error.message || "Nie udało się rozpocząć płatności.";
      setError(message);
      setIsSubmitting(false);
      trackPaymentIssue(result.error.code || "stripe_error", intent.orderCode, message);
      return;
    }
    if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
      onPaid(intent.orderCode);
      return;
    }
    if (
      result.paymentIntent &&
      (result.paymentIntent.status === "processing" || result.paymentIntent.status === "requires_action")
    ) {
      setIsWaitingBankConfirmation(true);
      void pollUntilSettled(result.paymentIntent.client_secret || intent.clientSecret, intent.orderCode);
      return;
    }
    const rejectedMessage =
      result.paymentIntent?.status === "requires_payment_method"
        ? "Płatność nie została zatwierdzona (np. odrzucona w aplikacji bankowej). Spróbuj ponownie."
        : "Nie udało się dokończyć płatności. Spróbuj ponownie.";
    setError(rejectedMessage);
    setIsSubmitting(false);
    trackPaymentIssue(result.paymentIntent?.status || "unknown_status", intent.orderCode, rejectedMessage);
  }

  async function handlePayBlik() {
    if (!stripe || isSubmitting) return;
    if (disabledReason) {
      if (onBlocked) onBlocked();
      else setError(disabledReason);
      return;
    }
    if (!termsAccepted) {
      setError("Zaznacz akceptację regulaminu poniżej, aby zapłacić.");
      return;
    }
    const code = blikCode.replace(/\D+/g, "");
    if (code.length !== 6) {
      setError("Wpisz 6-cyfrowy kod BLIK z aplikacji swojego banku.");
      blikInputRef.current?.focus();
      return;
    }
    setIsSubmitting(true);
    setError("");
    trackPaymentChoice("checkout_pay_click", "blik", existingOrderCode || "");
    let intent: CreatedIntent | null = null;
    try {
      intent = await resolveIntent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się utworzyć zamówienia.");
      setIsSubmitting(false);
      return;
    }
    if (!intent) {
      setIsSubmitting(false);
      return;
    }
    let result: PaymentIntentResult;
    try {
      result = await stripe.confirmBlikPayment(
        intent.clientSecret,
        {
          payment_method: { blik: {}, billing_details: billingDetails },
          payment_method_options: { blik: { code } },
          return_url: `${window.location.origin}/zamowienie/${encodeURIComponent(intent.orderCode)}?from_payment=1`,
        },
        { handleActions: false },
      );
    } catch (err) {
      const message = "Nie udało się uruchomić płatności BLIK. Odśwież stronę i spróbuj ponownie.";
      setError(message);
      setIsSubmitting(false);
      trackPaymentIssue("confirm_blik_threw", intent.orderCode, err instanceof Error ? err.message : String(err));
      return;
    }
    if (result.error) {
      const message =
        result.error.code === "payment_intent_authentication_failure" || /blik/i.test(result.error.message || "")
          ? result.error.message || "Nieprawidłowy kod BLIK."
          : result.error.message || "Nie udało się rozpocząć płatności BLIK.";
      setError(message);
      setIsSubmitting(false);
      trackPaymentIssue(result.error.code || "blik_error", intent.orderCode, message);
      return;
    }
    if (result.paymentIntent?.status === "succeeded") {
      onPaid(intent.orderCode);
      return;
    }
    // BLIK: kod przyjęty, klient zatwierdza w aplikacji banku - czekamy.
    setApprovalSecondsLeft(BLIK_APPROVAL_SECONDS);
    setIsWaitingBankConfirmation(true);
    void pollUntilSettled(result.paymentIntent?.client_secret || intent.clientSecret, intent.orderCode);
  }

  // Kod BLIK: pole przyjmuje same cyfry, a płatność rusza dopiero po
  // kliknięciu "Płacę" (właściciel, 2026-09-29: automat po 6. cyfrze
  // wprowadzony rano i tego samego dnia wycofany - "wywal ten automat").
  const clipboardSupported =
    typeof navigator !== "undefined" && Boolean(navigator.clipboard && typeof navigator.clipboard.readText === "function");
  function handleBlikInput(raw: string) {
    setBlikCode(raw.replace(/\D+/g, "").slice(0, 6));
    if (error) setError("");
  }
  // Schowek: przeglądarka nie pozwala czytać go bez gestu użytkownika (iOS
  // pokazuje własne "Wklej" po dotknięciu), więc automatycznego wklejania
  // nie da się zrobić - przycisk "Wklej" obok pola wypełnia je jednym
  // dotknięciem, a zapłatę i tak potwierdza klient przyciskiem.
  async function handleBlikPaste() {
    if (!clipboardSupported || isSubmitting) return;
    let text = "";
    try {
      text = await navigator.clipboard.readText();
    } catch {
      blikInputRef.current?.focus();
      return;
    }
    const code = (text || "").replace(/\D+/g, "");
    if (code.length < 6) {
      setError("W schowku nie ma 6-cyfrowego kodu BLIK - wpisz go ręcznie.");
      blikInputRef.current?.focus();
      return;
    }
    handleBlikInput(code.slice(0, 6));
    trackPaymentChoice("blik_paste", "filled", existingOrderCode || "");
  }
  async function resolveIntent(): Promise<CreatedIntent | null> {
    if (existingClientSecret && existingOrderCode) {
      return { clientSecret: existingClientSecret, orderCode: existingOrderCode };
    }
    return createIntent();
  }

  async function handlePay() {
    if (!stripe || !elements || isSubmitting) return;
    if (disabledReason) {
      if (onBlocked) onBlocked();
      else setError(disabledReason);
      return;
    }
    if (!termsAccepted) {
      setError("Zaakceptuj regulamin sklepu, aby zapłacić.");
      return;
    }
    setIsSubmitting(true);
    setError("");
    trackPaymentChoice("checkout_pay_click", method, existingOrderCode || "");
    // elements.submit() waliduje pole (kod BLIK, dane karty) ZANIM
    // utworzymy zamówienie - błędny kod nie zostawia po sobie szkicu.
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || "Sprawdź dane płatności.");
      setIsSubmitting(false);
      return;
    }
    let intent: CreatedIntent | null = null;
    try {
      intent = await resolveIntent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się utworzyć zamówienia.");
      setIsSubmitting(false);
      return;
    }
    if (!intent) {
      setIsSubmitting(false);
      return;
    }
    await confirmWithIntent(intent, true);
  }

  async function handleWalletConfirm(event: StripeExpressCheckoutElementConfirmEvent) {
    if (!stripe || !elements) return;
    setIsSubmitting(true);
    setError("");
    trackPaymentChoice("checkout_pay_click", event.expressPaymentType || "wallet", existingOrderCode || "");
    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message || "Nie udało się rozpocząć płatności.");
      setIsSubmitting(false);
      return;
    }
    let intent: CreatedIntent | null = null;
    try {
      intent = await resolveIntent();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się utworzyć zamówienia.");
      setIsSubmitting(false);
      return;
    }
    if (!intent) {
      setIsSubmitting(false);
      return;
    }
    // Portfel sam podaje billing details - nie nadpisujemy ich naszym adresem.
    await confirmWithIntent(intent, false);
  }

  if (isWaitingBankConfirmation) {
    return (
      <div className="cart-checkout-payment">
        <div className="cart-payment-waiting cart-payment-waiting-bank">
          <span className="cart-invoice-nip-spinner" aria-hidden="true" />
          <strong>Potwierdź płatność w aplikacji bankowej</strong>
          <p>
            Kod BLIK został przyjęty - otwórz teraz aplikację swojego banku i zatwierdź płatność. Masz na to
            {" "}
            {approvalSecondsLeft > 0 ? `${approvalSecondsLeft} s` : "jeszcze chwilę"}. Nie zamykaj tej strony.
          </p>
        </div>
      </div>
    );
  }

  if (method === "blik") {
    const digits = blikCode.replace(/\D+/g, "");
    return (
      <div className="cart-checkout-payment">
        <div className="cart-blik-field">
          <label htmlFor="cart-blik-code" className="cart-blik-label">
            Kod BLIK
          </label>
          <div className="cart-blik-row">
            <input
              id="cart-blik-code"
              ref={blikInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              // Surowe cyfry w value (odstępy robi CSS letter-spacing):
              // formatowanie "123 456" w kontrolowanym polu przestawiało kursor
              // na telefonie przed spacją - dało się wpisać tylko 5 cyfr.
              value={digits}
              onChange={(event) => handleBlikInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void handlePayBlik();
                }
              }}
              disabled={isSubmitting}
              aria-label="6-cyfrowy kod BLIK"
            />
            {clipboardSupported && digits.length === 0 ? (
              <button type="button" className="cart-blik-paste" onClick={() => void handleBlikPaste()} disabled={isSubmitting}>
                Wklej
              </button>
            ) : null}
          </div>
        </div>
        {error ? <div className="cart-checkout-error">{error}</div> : null}
        {termsSlot}
        <button
          type="button"
          className={`cart-page-checkout-cta ${disabledReason ? "is-blocked" : ""}`}
          onClick={() => {
            if (disabledReason) {
              if (onBlocked) onBlocked();
              else setError(disabledReason);
              return;
            }
            void handlePayBlik();
          }}
          disabled={isSubmitting || (!disabledReason && (!termsAccepted || digits.length !== 6))}
        >
          {isSubmitting ? "Przetwarzamy…" : submitLabel}
        </button>
        {disabledReason ? (blockedHint ?? <p className="cart-checkout-cta-hint">{disabledReason}</p>) : null}
      </div>
    );
  }

  if (method === "wallets") {
    return (
      <div className="cart-checkout-payment">
        {walletsAvailable === null ? (
          <div className="cart-payment-waiting">
            <span className="cart-invoice-nip-spinner" aria-hidden="true" />
            Sprawdzamy dostępność Google Pay / Apple Pay…
          </div>
        ) : null}
        {walletsAvailable === false ? null : termsSlot}
        <div className={walletsAvailable === false ? "cart-wallets-hidden" : undefined}>
          <ExpressCheckoutElement
            options={{
              paymentMethods: { applePay: "auto", googlePay: "auto", link: "never", paypal: "never", amazonPay: "never", klarna: "never" },
              buttonHeight: 48,
              buttonTheme: { applePay: "black", googlePay: "black" },
              buttonType: { applePay: "buy", googlePay: "buy" },
              layout: { maxColumns: 1, maxRows: 2, overflow: "auto" },
            }}
            onReady={(event) => {
              const available = event.availablePaymentMethods;
              setWalletsAvailable(Boolean(available && (available.applePay || available.googlePay)));
            }}
            onClick={(event) => {
              if (disabledReason) {
                if (onBlocked) onBlocked();
                else setError(disabledReason);
                return;
              }
              if (!termsAccepted) {
                setError("Zaakceptuj regulamin sklepu, aby zapłacić.");
                return;
              }
              setError("");
              event.resolve();
            }}
            onConfirm={handleWalletConfirm}
          />
        </div>
        {walletsAvailable === false ? (
          <p className="cart-checkout-cta-hint">
            Ta przeglądarka nie obsługuje Google Pay ani Apple Pay. Wybierz BLIK albo kartę.
          </p>
        ) : null}
        {error ? <div className="cart-checkout-error">{error}</div> : null}
        {isSubmitting ? (
          <div className="cart-payment-waiting">
            <span className="cart-invoice-nip-spinner" aria-hidden="true" />
            Przetwarzamy płatność…
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="cart-checkout-payment">
      {!elementReady ? (
        <div className="cart-payment-waiting">
          <span className="cart-invoice-nip-spinner" aria-hidden="true" />
          Wczytujemy formularz karty…
        </div>
      ) : null}
      <div className={!elementReady ? "cart-payment-element-loading" : undefined}>
        <PaymentElement
          onReady={() => setElementReady(true)}
          options={{
            defaultValues: { billingDetails },
            fields: { billingDetails: { address: "never" } },
            wallets: { applePay: "never", googlePay: "never" },
            terms: { card: "never" },
          }}
        />
      </div>
      {error ? <div className="cart-checkout-error">{error}</div> : null}
      {termsSlot}
      <button
        type="button"
        className={`cart-page-checkout-cta ${disabledReason ? "is-blocked" : ""}`}
        onClick={() => {
          if (disabledReason) {
            if (onBlocked) onBlocked();
            else setError(disabledReason);
            return;
          }
          void handlePay();
        }}
        disabled={isSubmitting || (!disabledReason && (!elementReady || !termsAccepted))}
      >
        {isSubmitting ? "Przetwarzamy…" : submitLabel}
      </button>
      {disabledReason ? (blockedHint ?? <p className="cart-checkout-cta-hint">{disabledReason}</p>) : null}
    </div>
  );
}
