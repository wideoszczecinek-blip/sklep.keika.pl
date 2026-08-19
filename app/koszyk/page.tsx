"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import Link from "next/link";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { saveShopQuote } from "@/features/moskitiery/api";
import {
  type CartLineItem,
  clearCart,
  formatPln,
  readCartItems,
  removeCartItem,
  summarizeCartItems,
  updateCartItemQty,
} from "@/lib/cart";

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

// Real checkout, reusing the exact quote -> order -> Stripe pipeline the
// saved-quote flow already uses (see app/wycena/[quoteCode]/quote-checkout.tsx):
// the cart's line items become one quote's "positions" (that field already
// supports multiple items), quote_save.php returns a quote_code, then
// /api/orders/create + Stripe work exactly as they do there.
function buildQuotePayloadFromCart(items: CartLineItem[]) {
  const positions = items.map((item, index) => {
    const specs = [
      item.hardwareLabel ? `profil ${item.hardwareLabel}` : "",
      item.meshLabel ? `siatka ${item.meshLabel}` : "",
      item.widthMm && item.heightMm ? `${item.widthMm} × ${item.heightMm} mm` : "",
    ]
      .filter(Boolean)
      .join(", ");
    return {
      id: item.id || `position-${index + 1}`,
      product_slug: item.productSlug || "produkt",
      product_label: item.productLabel,
      quantity: item.qty,
      purchase_units: null,
      total_amount: item.total.toFixed(2),
      currency: "PLN",
      summary: `${item.productLabel}${specs ? ` — ${specs}` : ""}`,
      summary_rows: [
        item.hardwareLabel ? { label: "Kolor profilu", value: item.hardwareLabel, note: "" } : null,
        item.meshLabel ? { label: "Kolor siatki", value: item.meshLabel, note: "" } : null,
        item.widthMm && item.heightMm
          ? { label: "Rozmiar", value: `${item.widthMm} × ${item.heightMm} mm`, note: "" }
          : null,
        { label: "Ilość", value: `${item.qty} szt.`, note: "" },
      ].filter(Boolean),
    };
  });

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0);

  return {
    quote_code: "",
    resume_token: "",
    product_slug: items[0]?.productSlug || "koszyk",
    product_label: items.length === 1 ? items[0].productLabel : `Koszyk (${items.length} pozycji)`,
    offer_id: "",
    offer_url: "",
    currency: "PLN",
    total_amount: totalAmount > 0 ? totalAmount.toFixed(2) : null,
    items_count: items.reduce((sum, item) => sum + item.qty, 0),
    units_count: 0,
    position_count: positions.length,
    summary_text: positions.map((position) => position.summary).join("\n\n"),
    positions,
  };
}

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
    if (!stripe || !elements) return;
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
    }
  }

  return (
    <div className="cart-checkout-payment">
      <PaymentElement />
      {error ? <div className="cart-checkout-error">{error}</div> : null}
      <button type="button" className="cart-page-checkout-cta" onClick={handlePay} disabled={isSubmitting}>
        {isSubmitting ? "Przetwarzamy…" : "Zapłać i potwierdź zamówienie"}
      </button>
    </div>
  );
}

export default function CartPage() {
  const [items, setItems] = useState<CartLineItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
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

  const sync = useCallback(() => {
    setItems(readCartItems());
    setHydrated(true);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("keika-cart-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("keika-cart-updated", sync);
    };
  }, [sync]);

  const summary = summarizeCartItems(items);

  function handleQtyChange(id: string, nextQty: number) {
    setItems(updateCartItemQty(id, nextQty));
  }

  function handleRemove(id: string) {
    setItems(removeCartItem(id));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);
    try {
      const quotePayload = buildQuotePayloadFromCart(items);
      const quoteResponse = await saveShopQuote(quotePayload);
      const quoteCode = quoteResponse.quote.quote_code;

      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_code: quoteCode,
          customer: { name: form.name, phone: form.phone, email: form.email },
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
      clearCart();
      setItems([]);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Wystąpił błąd.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="cart-page">
      <header className="cart-page-header">
        <Link href="/" className="cart-page-brand">
          keika
        </Link>
        <h1>Koszyk</h1>
        <Link href="/" className="cart-page-back">
          ← Wróć do konfiguratora
        </Link>
      </header>

      <main className="cart-page-main">
        {orderState ? (
          <div className="cart-page-order-done">
            <h2>Zamówienie utworzone</h2>
            <p>
              Numer zamówienia: <strong>{orderState.orderCode}</strong>
            </p>
            <p className="cart-page-order-note">
              Wgląd do zamówienia będzie wymagał telefonu albo e-maila podanego w formularzu.
            </p>
            {orderState.paymentEnabled && orderState.clientSecret && orderState.publishableKey ? (
              <PaymentStep
                clientSecret={orderState.clientSecret}
                publishableKey={orderState.publishableKey}
                orderCode={orderState.orderCode}
              />
            ) : (
              <div className="cart-page-checkout-note">
                Płatność online nie jest jeszcze skonfigurowana w tym środowisku. Zamówienie zapisaliśmy pod
                numerem <strong>{orderState.orderCode}</strong> - skontaktujemy się, aby dokończyć płatność.
              </div>
            )}
          </div>
        ) : !hydrated ? null : items.length === 0 ? (
          <div className="cart-page-empty">
            <p>Twój koszyk jest jeszcze pusty.</p>
            <Link href="/?produkt=moskitiery-ramkowe" className="cart-page-empty-cta">
              Skonfiguruj moskitierę
            </Link>
          </div>
        ) : (
          <>
            <ul className="cart-page-items">
              {items.map((item) => (
                <li key={item.id} className="cart-page-item">
                  <div
                    className="cart-page-item-thumb"
                    style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}
                  />
                  <div className="cart-page-item-info">
                    <strong>{item.productLabel}</strong>
                    <span className="cart-page-item-specs">
                      {item.hardwareLabel ? `Profil: ${item.hardwareLabel}` : null}
                      {item.meshLabel ? ` · Siatka: ${item.meshLabel}` : null}
                      {item.widthMm && item.heightMm ? ` · ${item.widthMm} × ${item.heightMm} mm` : null}
                    </span>
                    <span className="cart-page-item-unit">{formatPln(item.price)} / szt.</span>
                  </div>
                  <div className="cart-page-item-qty">
                    <button
                      type="button"
                      onClick={() => handleQtyChange(item.id, item.qty - 1)}
                      disabled={item.qty <= 1}
                      aria-label="Zmniejsz ilość"
                    >
                      −
                    </button>
                    <span>{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => handleQtyChange(item.id, item.qty + 1)}
                      aria-label="Zwiększ ilość"
                    >
                      +
                    </button>
                  </div>
                  <div className="cart-page-item-total">{formatPln(item.total)}</div>
                  <button
                    type="button"
                    className="cart-page-item-remove"
                    onClick={() => handleRemove(item.id)}
                    aria-label="Usuń pozycję"
                  >
                    Usuń
                  </button>
                </li>
              ))}
            </ul>

            <div className="cart-page-checkout-layout">
              <aside className="cart-page-summary">
                <div className="cart-page-summary-row">
                  <span>
                    {summary.items} {summary.items === 1 ? "produkt" : "produktów"}
                  </span>
                  <strong>{formatPln(summary.total)}</strong>
                </div>
              </aside>

              <section className="cart-checkout-form-card">
                <h2>Podsumowanie i zamówienie</h2>
                <p className="cart-checkout-intro">
                  Dane zamówienia zapisują się w CRM, a płatność jest obsługiwana przez Stripe.
                </p>
                {error ? <div className="cart-checkout-error">{error}</div> : null}
                <form className="cart-checkout-form" onSubmit={handleSubmit}>
                  <div className="cart-checkout-form-grid">
                    <label>
                      Imię i nazwisko
                      <input
                        value={form.name}
                        onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                        required
                      />
                    </label>
                    <label>
                      Telefon
                      <input
                        value={form.phone}
                        onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                      />
                    </label>
                    <label>
                      E-mail
                      <input
                        type="email"
                        value={form.email}
                        onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                      />
                    </label>
                    <label>
                      Miasto
                      <input
                        value={form.city}
                        onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                      />
                    </label>
                    <label>
                      Kod pocztowy
                      <input
                        value={form.postcode}
                        onChange={(event) => setForm((current) => ({ ...current, postcode: event.target.value }))}
                      />
                    </label>
                    <label>
                      Adres
                      <input
                        value={form.address1}
                        onChange={(event) => setForm((current) => ({ ...current, address1: event.target.value }))}
                      />
                    </label>
                  </div>
                  <label className="cart-checkout-note-field">
                    Dodatkowe informacje
                    <textarea
                      value={form.note}
                      onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                    />
                  </label>
                  <button type="submit" className="cart-page-checkout-cta" disabled={isSubmitting}>
                    {isSubmitting ? "Tworzymy zamówienie…" : "Utwórz zamówienie i przejdź do płatności"}
                  </button>
                </form>
              </section>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
