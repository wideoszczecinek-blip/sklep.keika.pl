"use client";

import { useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import type { PaymentIntentResult } from "@stripe/stripe-js";
import { trackStorefrontEvent } from "@/lib/shop-public";

// Payment failing is the single most direct "co ich zniechęca" signal there
// is - a lost sale at the very last step. Fire-and-forget, never blocks the
// actual error message shown to the customer.
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

// Shared by the real checkout (/koszyk) and the "retry a failed payment"
// flow (/zamowienie/[orderCode]) - both just need a clientSecret/
// publishableKey/orderCode/contact and a callback for when it's actually
// paid. Extracted so bug fixes here (loadStripe memoization, the BLIK
// silent-failure fallback, the billing address shape Stripe now demands)
// only ever need to happen in one place.

// Light theme is now the only theme (see app/layout.tsx) - Stripe Elements
// renders inside its own iframe though, unreachable by page CSS, so it
// needs this separate appearance object rather than picking it up for free.
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
    ".Label": {
      color: "rgba(19, 40, 67, 0.72)",
      fontSize: "0.82rem",
      fontWeight: "600",
    },
    ".Input": {
      border: "1px solid #e2e6ec",
      backgroundColor: "#ffffff",
      boxShadow: "none",
    },
    ".Input:focus": {
      border: "1px solid #d9600a",
      boxShadow: "0 0 0 1px rgba(217, 96, 10, 0.35)",
    },
    ".Tab": {
      border: "1px solid #e2e6ec",
      backgroundColor: "#f6f7f9",
    },
    ".Tab:hover": {
      border: "1px solid #d3d8e0",
    },
    ".Tab--selected": {
      border: "1px solid #d9600a",
      backgroundColor: "rgba(217, 96, 10, 0.08)",
    },
    ".TabLabel": { color: "#16314e" },
    ".TabLabel--selected": { color: "#16314e" },
  },
};

export type CheckoutContact = {
  name: string;
  phone: string;
  email: string;
  city: string;
  postcode: string;
  address1: string;
};

export default function PaymentStep({
  clientSecret,
  publishableKey,
  orderCode,
  contact,
  onPaid,
  termsAccepted,
  submitLabel = "Zamawiam",
}: {
  clientSecret: string;
  publishableKey: string;
  orderCode: string;
  contact: CheckoutContact;
  onPaid: () => void;
  termsAccepted: boolean;
  submitLabel?: string;
}) {
  // loadStripe() must only run once per key - Elements refuses to accept a
  // new `stripe` prop after mount ("Unsupported prop change"), which is
  // exactly what happened here before: this component re-renders (e.g. the
  // parent's isSubmitting/error state changing) called loadStripe() fresh
  // every time, handing Elements a brand new promise on each render.
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE_LIGHT }}>
      <StripePaymentStep
        orderCode={orderCode}
        contact={contact}
        onPaid={onPaid}
        termsAccepted={termsAccepted}
        submitLabel={submitLabel}
      />
    </Elements>
  );
}

function StripePaymentStep({
  orderCode,
  contact,
  onPaid,
  termsAccepted,
  submitLabel,
}: {
  orderCode: string;
  contact: CheckoutContact;
  onPaid: () => void;
  termsAccepted: boolean;
  submitLabel: string;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Stripe takes a few seconds to determine which methods (BLIK, Przelewy24,
  // Revolut, ...) are actually eligible before painting them in - without
  // this, that gap looked like "only a card field, nothing else" and some
  // customers ordered before the rest had a chance to appear.
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);
  // BLIK (and any other async method) needs the customer to approve a push
  // in their banking app *after* confirmPayment() already resolved - real
  // customer report: they typed the BLIK code, the shop said "zamówienie
  // złożone" immediately, and no bank confirmation ever came. Root cause -
  // confirmPayment() resolving with status "processing" (code accepted,
  // approval still pending, can take up to ~2 min) was treated as if it
  // were "succeeded" and called onPaid() right away, so the customer never
  // knew they still had to open their bank app. This state distinguishes
  // that "still waiting" moment from real success.
  const [isWaitingBankConfirmation, setIsWaitingBankConfirmation] = useState(false);

  async function pollUntilSettled(clientSecret: string, orderCode: string) {
    const POLL_INTERVAL_MS = 3000;
    const MAX_ATTEMPTS = 40; // ~2 minuty - BLIK w aplikacji bankowej wygasa w tym czasie
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
      if (!stripe) break;
      let status: string | undefined;
      try {
        const { paymentIntent } = await stripe.retrievePaymentIntent(clientSecret);
        status = paymentIntent?.status;
      } catch {
        continue; // przejściowy błąd sieci - próbujemy dalej, nie przerywamy czekania
      }
      if (status === "succeeded") {
        setIsWaitingBankConfirmation(false);
        onPaid();
        return;
      }
      if (status && status !== "processing") {
        // requires_payment_method (odrzucone/wygasłe w aplikacji bankowej), canceled, ...
        setIsWaitingBankConfirmation(false);
        const message = "Płatność nie została potwierdzona w aplikacji bankowej (upłynął czas albo została odrzucona). Spróbuj ponownie.";
        setError(message);
        setIsSubmitting(false);
        trackPaymentIssue(status, orderCode, message);
        return;
      }
    }
    // Limit czasu minął, a intencja wciąż "processing" - nie zgadujemy dalej.
    setIsWaitingBankConfirmation(false);
    const message =
      "Nie otrzymaliśmy jeszcze potwierdzenia z banku. Jeśli zatwierdziłeś/aś płatność w aplikacji, zamówienie i tak zostanie opłacone - w innym przypadku spróbuj ponownie.";
    setError(message);
    setIsSubmitting(false);
    trackPaymentIssue("processing_timeout", orderCode, message);
  }

  async function handlePay() {
    if (!stripe || !elements) return;

    // The PaymentElement can be gone even though the button looks enabled:
    // on the FB in-app browser (the bulk of our traffic) the Stripe iframe
    // sometimes tears itself down after onReady fired - backgrounded tab,
    // memory pressure, a re-init when the parent handed <Elements> a fresh
    // clientSecret. confirmPayment() then throws synchronously
    // ("elements should have a mounted Payment Element"), which - because
    // this handler is a bare async onClick - surfaced only as an
    // unhandledrejection and a dead, silent pay button. Real lost carts in
    // the session logs. Check the element is actually mounted first and
    // recover cleanly (re-show the loader; onReady re-enables the button
    // once Stripe remounts it).
    if (!elements.getElement("payment")) {
      setError("Formularz płatności jeszcze się wczytuje. Poczekaj chwilę i spróbuj ponownie.");
      setPaymentMethodsLoading(true);
      trackPaymentIssue("payment_element_not_mounted", orderCode, "confirmPayment wywołane zanim element się zamontował");
      return;
    }

    setIsSubmitting(true);
    setError("");
    // "if_required" keeps the customer on this page (and the order only
    // becomes real to them) once the payment has actually gone through -
    // only redirect-based methods (BLIK, wallets, ...) leave the page, in
    // which case /zamowienie/[orderCode] takes over the "paid" handling.
    let result: PaymentIntentResult;
    try {
      result = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/zamowienie/${encodeURIComponent(orderCode)}?from_payment=1`,
          // The billing address field is hidden below (we already collect the
          // shipping address in our own form) - Stripe still needs it though,
          // so it's supplied here explicitly rather than left for the hidden
          // UI to (not) fill in.
          payment_method_data: {
            billing_details: {
              name: contact.name || undefined,
              email: contact.email || undefined,
              phone: contact.phone || undefined,
              // Opting out of the address fields in the PaymentElement below
              // (fields.billingDetails.address: "never") means Stripe won't
              // collect this itself and expects the *complete* address shape
              // handed to confirmPayment instead - state included, even
              // though Poland doesn't use one, or confirmPayment throws
              // ("did not pass ...address.state") instead of just treating a
              // missing key as blank.
              address: {
                city: contact.city || undefined,
                postal_code: contact.postcode || undefined,
                line1: contact.address1 || undefined,
                state: "",
                country: "PL",
              },
            },
          },
        },
        redirect: "if_required",
      });
    } catch (err) {
      // Any synchronous throw from Stripe.js (stale element, bad option
      // shape, iframe not reachable in the in-app browser) - turn it into a
      // visible, tracked, retryable error instead of a silent
      // unhandledrejection.
      const message = "Nie udało się uruchomić płatności. Odśwież stronę i spróbuj ponownie.";
      setError(message);
      setIsSubmitting(false);
      trackPaymentIssue("confirm_payment_threw", orderCode, err instanceof Error ? err.message : String(err));
      return;
    }
    if (result.error) {
      const message = result.error.message || "Nie udało się rozpocząć płatności.";
      setError(message);
      setIsSubmitting(false);
      trackPaymentIssue(result.error.code || "stripe_error", orderCode, message);
      return;
    }
    if (result.paymentIntent && result.paymentIntent.status === "succeeded") {
      onPaid();
      return;
    }
    if (result.paymentIntent && result.paymentIntent.status === "processing") {
      // Not done yet - BLIK (and similar) still needs the customer to open
      // their banking app and approve. Showing success here is exactly the
      // bug that was reported: the shop said "zamówienie złożone" before
      // the customer had even seen the bank prompt. Poll until it's genuinely
      // resolved instead of guessing.
      setIsWaitingBankConfirmation(true);
      void pollUntilSettled(result.paymentIntent.client_secret || "", orderCode);
      return;
    }
    // Async methods (BLIK above all) can come back here with neither
    // result.error nor a succeeded/processing intent - e.g. the customer
    // rejected the BLIK push in their banking app. Stripe's SDK resolves
    // that as a plain non-error result once its own internal polling gives
    // up, not as result.error, so without this the payment box just went
    // quiet with zero feedback ("the window just disappeared").
    const rejectedMessage =
      result.paymentIntent?.status === "requires_payment_method"
        ? "Płatność nie została zatwierdzona (np. odrzucona w aplikacji bankowej). Spróbuj ponownie."
        : "Nie udało się dokończyć płatności. Spróbuj ponownie.";
    setError(rejectedMessage);
    setIsSubmitting(false);
    trackPaymentIssue(result.paymentIntent?.status || "unknown_status", orderCode, rejectedMessage);
  }

  if (isWaitingBankConfirmation) {
    return (
      <div className="cart-checkout-payment">
        <div className="cart-payment-waiting cart-payment-waiting-bank">
          <span className="cart-invoice-nip-spinner" aria-hidden="true" />
          <strong>Potwierdź płatność w aplikacji bankowej</strong>
          <p>
            Kod BLIK został przyjęty - otwórz teraz aplikację swojego banku i zatwierdź płatność. To może potrwać do
            dwóch minut, nie zamykaj tej strony.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="cart-checkout-payment">
      {paymentMethodsLoading ? (
        <div className="cart-payment-waiting">
          <span className="cart-invoice-nip-spinner" aria-hidden="true" />
          Wczytujemy dostępne metody płatności…
        </div>
      ) : null}
      <div className={paymentMethodsLoading ? "cart-payment-element-loading" : undefined}>
        <PaymentElement
          onReady={() => setPaymentMethodsLoading(false)}
          options={{
            defaultValues: {
              billingDetails: {
                name: contact.name || undefined,
                email: contact.email || undefined,
                phone: contact.phone || undefined,
                address: {
                  city: contact.city || undefined,
                  postal_code: contact.postcode || undefined,
                  line1: contact.address1 || undefined,
                  country: "PL",
                },
              },
            },
            // We already collect the shipping address in our own form above -
            // no need to ask for it again inside the Stripe form (applies to
            // BLIK and every other method here, not just cards).
            fields: {
              billingDetails: { address: "never" },
            },
          }}
        />
      </div>
      {error ? <div className="cart-checkout-error">{error}</div> : null}
      <button
        type="button"
        className="cart-page-checkout-cta"
        onClick={handlePay}
        disabled={isSubmitting || !termsAccepted || paymentMethodsLoading}
      >
        {isSubmitting ? "Przetwarzamy…" : submitLabel}
      </button>
    </div>
  );
}
