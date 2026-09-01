"use client";

import { useMemo, useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";

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

  async function handlePay() {
    if (!stripe || !elements) return;
    setIsSubmitting(true);
    setError("");
    // "if_required" keeps the customer on this page (and the order only
    // becomes real to them) once the payment has actually gone through -
    // only redirect-based methods (BLIK, wallets, ...) leave the page, in
    // which case /zamowienie/[orderCode] takes over the "paid" handling.
    const result = await stripe.confirmPayment({
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
    if (result.error) {
      setError(result.error.message || "Nie udało się rozpocząć płatności.");
      setIsSubmitting(false);
      return;
    }
    if (result.paymentIntent && (result.paymentIntent.status === "succeeded" || result.paymentIntent.status === "processing")) {
      onPaid();
      return;
    }
    // Async methods (BLIK above all) can come back here with neither
    // result.error nor a succeeded/processing intent - e.g. the customer
    // rejected the BLIK push in their banking app. Stripe's SDK resolves
    // that as a plain non-error result once its own internal polling gives
    // up, not as result.error, so without this the payment box just went
    // quiet with zero feedback ("the window just disappeared").
    setError(
      result.paymentIntent?.status === "requires_payment_method"
        ? "Płatność nie została zatwierdzona (np. odrzucona w aplikacji bankowej). Spróbuj ponownie."
        : "Nie udało się dokończyć płatności. Spróbuj ponownie.",
    );
    setIsSubmitting(false);
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
