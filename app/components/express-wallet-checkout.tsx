"use client";

// Ekspresowa płatność portfelem (Apple Pay / Google Pay) na górze koszyka
// (właściciel, 2026-09-28). 92% ruchu to telefon, a 65% osób wchodzących do
// koszyka wychodziło, nie zaczynając formularza - portfel podaje adres,
// telefon i e-mail sam, więc klient omija cały formularz.
//
// Przebieg (Stripe Express Checkout Element, intencja odroczona):
//   1. Elements w trybie "payment" z kwotą koszyka; element pokazuje tylko
//      te przyciski, które dane urządzenie faktycznie obsługuje (onReady ->
//      availablePaymentMethods; brak = cały blok znika).
//   2. Klik -> arkusz portfela z prośbą o adres dostawy, telefon i e-mail.
//   3. confirm -> walidacja danych, elements.submit(), utworzenie zamówienia
//      w CRM tą samą ścieżką co "Płacę kartą" (onCreateOrder -> clientSecret),
//      stripe.confirmPayment(...). Sukces = onPaid(orderCode), jak po BLIK-u.
//   4. Błąd po otwarciu arkusza -> event.paymentFailed() (arkusz się zamyka)
//      + komunikat pod przyciskami.
import { useEffect, useMemo, useState } from "react";
import { Elements, ExpressCheckoutElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe, type StripeElementsOptions, type StripeExpressCheckoutElementConfirmEvent } from "@stripe/stripe-js";
import { pollPaymentIntentUntilSettled } from "./payment-poll";
import type { CreatedIntent } from "./stripe-method-step";
import { normalizePhone } from "@/lib/phone";

export type WalletContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  address1: string;
  postcode: string;
  city: string;
};

const APPEARANCE = {
  theme: "stripe" as const,
  variables: {
    colorPrimary: "#d9600a",
    borderRadius: "12px",
    fontFamily: '"Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
  },
};

function splitName(full: string): { firstName: string; lastName: string } {
  const parts = full.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return { firstName: parts[0] || "", lastName: "" };
  return { firstName: parts.slice(0, -1).join(" "), lastName: parts[parts.length - 1] };
}

function formatPostcode(raw: string): string {
  const digits = (raw || "").replace(/\D+/g, "");
  return digits.length === 5 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : (raw || "").trim();
}

/** Dane z arkusza portfela -> kontakt zamówienia; pusty string = powód odmowy. */
function contactFromEvent(event: StripeExpressCheckoutElementConfirmEvent): { contact: WalletContact | null; reason: string } {
  const billing = event.billingDetails;
  const shipping = event.shippingAddress;
  const name = (shipping?.name || billing?.name || "").trim();
  const { firstName, lastName } = splitName(name);
  const email = (billing?.email || "").trim();
  const phone = normalizePhone(billing?.phone || "");
  const addr = shipping?.address || billing?.address;
  const line1 = [addr?.line1 || "", addr?.line2 || ""].map((v) => v.trim()).filter(Boolean).join(" ");
  const postcode = formatPostcode(addr?.postal_code || "");
  const city = (addr?.city || "").trim();
  const country = (addr?.country || "PL").toUpperCase();
  if (!firstName || !lastName) return { contact: null, reason: "Portfel nie podał imienia i nazwiska odbiorcy." };
  if (!/.+@.+\..+/.test(email)) return { contact: null, reason: "Portfel nie podał adresu e-mail." };
  if (!phone) return { contact: null, reason: "Portfel nie podał polskiego numeru telefonu (9 cyfr)." };
  if (country !== "PL") return { contact: null, reason: "Wysyłamy tylko na adresy w Polsce." };
  if (!/^\d{2}-\d{3}$/.test(postcode)) return { contact: null, reason: "Portfel podał nieprawidłowy kod pocztowy." };
  if (!city) return { contact: null, reason: "Portfel nie podał miasta." };
  if (line1.length < 5 || !/\d/.test(line1) || !/\p{L}/u.test(line1)) {
    return { contact: null, reason: "Adres z portfela nie ma ulicy i numeru - uzupełnij dane poniżej." };
  }
  return {
    contact: { firstName, lastName, email, phone: phone.slice(2), address1: line1, postcode, city },
    reason: "",
  };
}

export default function ExpressWalletCheckout({
  publishableKey,
  amountGrosze,
  onCreateOrder,
  onPaid,
  onAvailability,
}: {
  publishableKey: string;
  amountGrosze: number;
  /** Tworzy zamówienie + PaymentIntent dla danych z portfela (koszyk). */
  onCreateOrder: (contact: WalletContact) => Promise<CreatedIntent | null>;
  onPaid: (orderCode: string) => void;
  /** true = urządzenie ma Apple Pay / Google Pay, false = nie ma (blok się chowa). */
  onAvailability?: (available: boolean) => void;
}) {
  const stripePromise = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  const options: StripeElementsOptions = useMemo(
    () => ({
      mode: "payment",
      amount: Math.max(1, Math.round(amountGrosze)),
      currency: "pln",
      paymentMethodTypes: ["card"],
      appearance: APPEARANCE,
      locale: "pl",
    }),
    [amountGrosze],
  );
  return (
    <Elements key={Math.round(amountGrosze)} stripe={stripePromise} options={options}>
      <ExpressWalletInner onCreateOrder={onCreateOrder} onPaid={onPaid} onAvailability={onAvailability} />
    </Elements>
  );
}

function ExpressWalletInner({
  onCreateOrder,
  onPaid,
  onAvailability,
}: {
  onCreateOrder: (contact: WalletContact) => Promise<CreatedIntent | null>;
  onPaid: (orderCode: string) => void;
  onAvailability?: (available: boolean) => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [available, setAvailable] = useState<boolean | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  // Bezpiecznik: jeśli element Stripe nie zgłosi gotowości w 8 s (błąd
  // integracji, blokada skryptów, brak sieci), blok znika - koszyk nigdy nie
  // może wisieć na "ładowaniu" portfela.
  useEffect(() => {
    if (available !== null) return;
    const id = window.setTimeout(() => {
      setAvailable((current) => (current === null ? false : current));
      onAvailability?.(false);
    }, 8000);
    return () => window.clearTimeout(id);
  }, [available, onAvailability]);

  async function handleConfirm(event: StripeExpressCheckoutElementConfirmEvent) {
    if (!stripe || !elements) {
      event.paymentFailed({ reason: "fail" });
      return;
    }
    setError("");
    const { contact, reason } = contactFromEvent(event);
    if (!contact) {
      setError(reason);
      event.paymentFailed({ reason: "invalid_shipping_address" });
      return;
    }
    setBusy(true);
    try {
      const { error: submitError } = await elements.submit();
      if (submitError) {
        setError(submitError.message || "Nie udało się rozpocząć płatności.");
        event.paymentFailed({ reason: "fail" });
        return;
      }
      let intent: CreatedIntent | null = null;
      try {
        intent = await onCreateOrder(contact);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Nie udało się utworzyć zamówienia.");
        event.paymentFailed({ reason: "fail" });
        return;
      }
      if (!intent) {
        setError("Nie udało się przygotować płatności. Wybierz inną metodę poniżej.");
        event.paymentFailed({ reason: "fail" });
        return;
      }
      const result = await stripe.confirmPayment({
        elements,
        clientSecret: intent.clientSecret,
        confirmParams: {
          return_url: `${window.location.origin}/zamowienie/${encodeURIComponent(intent.orderCode)}?from_payment=1`,
          payment_method_data: {
            billing_details: {
              name: `${contact.firstName} ${contact.lastName}`.trim(),
              email: contact.email,
              phone: `+48${contact.phone}`,
              address: { line1: contact.address1, postal_code: contact.postcode, city: contact.city, country: "PL", state: "" },
            },
          },
        },
        redirect: "if_required",
      });
      if (result.error) {
        setError(result.error.message || "Płatność nie powiodła się. Wybierz inną metodę poniżej.");
        return;
      }
      const pi = result.paymentIntent;
      if (pi && pi.status === "succeeded") {
        onPaid(intent.orderCode);
        return;
      }
      if (pi && (pi.status === "processing" || pi.status === "requires_action")) {
        const outcome = await pollPaymentIntentUntilSettled(stripe, pi.client_secret || intent.clientSecret);
        if (outcome.kind === "succeeded") {
          onPaid(intent.orderCode);
          return;
        }
        setError("Bank nie potwierdził płatności. Wybierz inną metodę poniżej.");
        return;
      }
      setError("Płatność nie została zakończona. Wybierz inną metodę poniżej.");
    } finally {
      setBusy(false);
    }
  }

  if (available === false) return null;

  return (
    <div className={`cart-express ${available ? "is-ready" : "is-loading"}`}>
      <div className="cart-express-head">
        <strong>Zapłać jednym dotknięciem</strong>
        <span>Portfel poda adres i telefon za Ciebie - bez wypełniania formularza.</span>
      </div>
      {/* Adnotacja o regulaminie NAD przyciskami portfela, jak najbliżej CTA
          (właściciel, 2026-09-29). Arkusz portfela nie ma checkboxa, więc
          akceptacja jest kliknięciem w przycisk. */}
      <p className="cart-express-note">
        Płacąc portfelem akceptujesz <a href="/regulamin" target="_blank" rel="noreferrer">regulamin sklepu i płatności</a>. Dostawa
        kurierem, dane odbiorcy z portfela.
      </p>
      <div className={`cart-express-buttons ${busy ? "is-busy" : ""}`}>
        <ExpressCheckoutElement
          options={{
            buttonType: { applePay: "buy", googlePay: "buy" },
            buttonTheme: { applePay: "black", googlePay: "black" },
            buttonHeight: 48,
            layout: { maxColumns: 1, maxRows: 2, overflow: "auto" },
            paymentMethods: { applePay: "always", googlePay: "always", link: "never", amazonPay: "never", paypal: "never", klarna: "never" },
            emailRequired: true,
            phoneNumberRequired: true,
            shippingAddressRequired: true,
            allowedShippingCountries: ["PL"],
            shippingRates: [{ id: "kurier", displayName: "Kurier", amount: 0 }],
          }}
          onReady={({ availablePaymentMethods }) => {
            const ok = Boolean(availablePaymentMethods && (availablePaymentMethods.applePay || availablePaymentMethods.googlePay));
            setAvailable(ok);
            onAvailability?.(ok);
          }}
          onConfirm={(event) => {
            void handleConfirm(event);
          }}
          onLoadError={() => {
            setAvailable(false);
            onAvailability?.(false);
          }}
        />
      </div>
      {error ? <p className="cart-express-error">{error}</p> : null}
      <div className="cart-express-divider">
        <span>albo wypełnij dane poniżej</span>
      </div>
    </div>
  );
}
