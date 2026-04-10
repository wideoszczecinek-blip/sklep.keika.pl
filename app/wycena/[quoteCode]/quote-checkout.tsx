"use client";

import { useState } from "react";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";

type SavedQuote = import("@/features/moskitiery/types").SavedQuote;

type OrderCreateResponse = {
  ok: boolean;
  order?: {
    order_code: string;
    amount_total: string | null;
    currency: string;
  };
  payment_enabled?: boolean;
  publishable_key?: string;
  client_secret?: string;
  error?: string;
};

function PaymentStep({
  clientSecret,
  publishableKey,
  orderCode,
}: {
  clientSecret: string;
  publishableKey: string;
  orderCode: string;
}) {
  const stripePromise = loadStripe(publishableKey);

  return (
    <Elements stripe={stripePromise} options={{ clientSecret }}>
      <StripePaymentStep orderCode={orderCode} />
    </Elements>
  );
}

function StripePaymentStep({ orderCode }: { orderCode: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handlePay() {
    if (!stripe || !elements) {
      return;
    }

    setIsSubmitting(true);
    setError("");

    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/zamowienie/${encodeURIComponent(orderCode)}?from_payment=1`,
      },
    });

    if (result.error) {
      setError(result.error.message || "Nie udało się rozpocząć płatności.");
      setIsSubmitting(false);
      return;
    }
  }

  return (
    <div className={styles.paymentShell}>
      <PaymentElement />
      {error ? <div className={styles.errorBox}>{error}</div> : null}
      <button type="button" className={styles.ctaButton} onClick={handlePay} disabled={isSubmitting}>
        {isSubmitting ? "Przetwarzamy…" : "Zapłać i potwierdź zamówienie"}
      </button>
    </div>
  );
}

export default function QuoteCheckout({ quote }: { quote: SavedQuote }) {
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    postcode: "",
    address1: "",
    address2: "",
    note: "",
  });
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderState, setOrderState] = useState<{
    orderCode: string;
    clientSecret?: string;
    publishableKey?: string;
    paymentEnabled: boolean;
  } | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_code: quote.quote_code,
          customer: {
            name: form.name,
            phone: form.phone,
            email: form.email,
          },
          shipping: {
            city: form.city,
            postcode: form.postcode,
            address_line_1: form.address1,
            address_line_2: form.address2,
          },
          note_text: form.note,
        }),
      });
      const json = (await response.json()) as OrderCreateResponse;
      if (!json.ok || !json.order) {
        throw new Error(json.error || "Nie udało się utworzyć zamówienia.");
      }

      setOrderState({
        orderCode: json.order.order_code,
        clientSecret: json.client_secret,
        publishableKey: json.publishable_key,
        paymentEnabled: Boolean(json.payment_enabled && json.client_secret && json.publishable_key),
      });
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Wystąpił błąd.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (orderState) {
    return (
      <div className={styles.quoteCard}>
        <h2>Zamówienie utworzone</h2>
        <div className={styles.orderMeta}>
          <div>Numer zamówienia: <strong>{orderState.orderCode}</strong></div>
          <div>Wgląd do zamówienia będzie wymagał telefonu albo e-maila wpisanego poniżej.</div>
        </div>
        {orderState.paymentEnabled && orderState.clientSecret && orderState.publishableKey ? (
          <PaymentStep
            clientSecret={orderState.clientSecret}
            publishableKey={orderState.publishableKey}
            orderCode={orderState.orderCode}
          />
        ) : (
          <div className={styles.noticeBox}>
            Stripe nie jest jeszcze skonfigurowany w tym środowisku. Draft zamówienia zapisaliśmy w CRM pod numerem
            {" "}
            <strong>{orderState.orderCode}</strong>.
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.quoteCard}>
      <h2>Przejdź do zamówienia</h2>
      <p className={styles.sectionIntro}>
        Dane zamówienia zapisują się w CRM, a płatność jest obsługiwana przez Stripe. Po utworzeniu zamówienia link z e-maila nadal będzie wymagał telefonu albo e-maila do wglądu w szczegóły.
      </p>
      {error ? <div className={styles.errorBox}>{error}</div> : null}
      <form className={styles.formGrid} onSubmit={handleSubmit}>
        <div className={styles.formGridTwo}>
          <label className={styles.field}>
            Imię i nazwisko
            <input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          </label>
          <label className={styles.field}>
            Telefon
            <input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          </label>
          <label className={styles.field}>
            E-mail
            <input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          </label>
          <label className={styles.field}>
            Miasto
            <input value={form.city} onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))} />
          </label>
          <label className={styles.field}>
            Kod pocztowy
            <input value={form.postcode} onChange={(event) => setForm((current) => ({ ...current, postcode: event.target.value }))} />
          </label>
          <label className={styles.field}>
            Adres
            <input value={form.address1} onChange={(event) => setForm((current) => ({ ...current, address1: event.target.value }))} />
          </label>
        </div>
        <label className={styles.field}>
          Dodatkowe informacje
          <textarea value={form.note} onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))} />
        </label>
        <button type="submit" className={styles.ctaButton} disabled={isSubmitting}>
          {isSubmitting ? "Tworzymy zamówienie…" : "Utwórz zamówienie i przejdź do płatności"}
        </button>
      </form>
    </div>
  );
}

