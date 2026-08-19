"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

type NipLookupResponse = {
  ok: boolean;
  company?: {
    nip: string;
    name: string;
    street: string;
    post_code: string;
    city: string;
  };
  error?: string;
};

type DeliveryMethod = {
  id: string;
  label: string;
  description: string;
};

// Paczkomat InPost only fits parcels where neither dimension exceeds this -
// otherwise it's not offered at all (mirrors app/page.tsx's own limit).
const PACZKOMAT_MAX_DIMENSION_MM = 640;

// No real per-carrier shipping cost data exists yet, so every method is
// shown free, matching the site's existing blanket "Darmowa dostawa" promise
// rather than inventing price tiers.
const BASE_DELIVERY_METHODS: DeliveryMethod[] = [
  { id: "dpd", label: "Kurier DPD", description: "Dostawa pod wskazany adres" },
  { id: "gls", label: "Kurier GLS", description: "Dostawa pod wskazany adres" },
  { id: "odbior-osobisty", label: "Odbiór osobisty", description: "W siedzibie producenta" },
];

const PACZKOMAT_METHOD: DeliveryMethod = {
  id: "paczkomat",
  label: "Paczkomat InPost",
  description: "Odbiór z wybranego automatu paczkowego",
};

function getAvailableDeliveryMethods(items: CartLineItem[]): DeliveryMethod[] {
  const fitsPaczkomat =
    items.length > 0 &&
    items.every((item) => item.widthMm <= PACZKOMAT_MAX_DIMENSION_MM && item.heightMm <= PACZKOMAT_MAX_DIMENSION_MM);
  return fitsPaczkomat ? [...BASE_DELIVERY_METHODS.slice(0, 2), PACZKOMAT_METHOD, BASE_DELIVERY_METHODS[2]] : BASE_DELIVERY_METHODS;
}

/** One-time oversized-parcel surcharge for the whole order: the highest tier
 * required by any item, charged once - not summed per item. */
function calcOrderSurcharge(items: CartLineItem[]): number {
  return items.reduce((max, item) => Math.max(max, item.oversizeSurchargeAmount || 0), 0);
}

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

  // One-time oversized-parcel surcharge for the whole order, as its own
  // quote position so it's transparent in the CRM and included in the total
  // actually charged - not folded invisibly into one item's price.
  const orderSurcharge = calcOrderSurcharge(items);
  if (orderSurcharge > 0) {
    positions.push({
      id: "position-oversize-surcharge",
      product_slug: "doplata-przesylka-dlugosciowa",
      product_label: "Dopłata za przesyłkę długościową",
      quantity: 1,
      purchase_units: null,
      total_amount: orderSurcharge.toFixed(2),
      currency: "PLN",
      summary: "Dopłata za przesyłkę długościową (jednorazowo dla całego zamówienia)",
      summary_rows: [],
    });
  }

  const totalAmount = items.reduce((sum, item) => sum + item.total, 0) + orderSurcharge;

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
  const [deliveryMethod, setDeliveryMethod] = useState(BASE_DELIVERY_METHODS[0].id);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    city: "",
    postcode: "",
    address1: "",
    note: "",
  });
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const [invoice, setInvoice] = useState({
    nip: "",
    companyName: "",
    street: "",
    postcode: "",
    city: "",
  });
  const [nipLookupLoading, setNipLookupLoading] = useState(false);
  const [nipLookupError, setNipLookupError] = useState("");
  const lastLookedUpNip = useRef("");

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittedRef = useRef(false);
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
  const orderSurcharge = calcOrderSurcharge(items);
  const availableDeliveryMethods = getAvailableDeliveryMethods(items);

  useEffect(() => {
    if (!availableDeliveryMethods.some((method) => method.id === deliveryMethod)) {
      setDeliveryMethod(availableDeliveryMethods[0].id);
    }
    // Only re-check when the set of available methods actually changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDeliveryMethods.map((m) => m.id).join(",")]);

  function handleQtyChange(id: string, nextQty: number) {
    setItems(updateCartItemQty(id, nextQty));
  }

  function handleRemove(id: string) {
    setItems(removeCartItem(id));
  }

  // NIP -> company name/address autofill (Ministry of Finance whitelist API,
  // public, no key needed - see nip_lookup_public.php).
  async function lookupNip(nipDigits: string) {
    if (nipDigits.length !== 10 || lastLookedUpNip.current === nipDigits) return;
    lastLookedUpNip.current = nipDigits;
    setNipLookupLoading(true);
    setNipLookupError("");
    try {
      const response = await fetch(
        `https://crm-keika.groovemedia.pl/biuro/api/shop-public/nip_lookup_public.php?nip=${nipDigits}`,
        { cache: "no-store" },
      );
      const json = (await response.json()) as NipLookupResponse;
      if (!json.ok || !json.company) {
        setNipLookupError(json.error || "Nie znaleziono firmy dla podanego NIP.");
        return;
      }
      setInvoice((current) => ({
        ...current,
        companyName: json.company!.name || current.companyName,
        street: json.company!.street || current.street,
        postcode: json.company!.post_code || current.postcode,
        city: json.company!.city || current.city,
      }));
    } catch {
      setNipLookupError("Nie udało się połączyć z rejestrem NIP.");
    } finally {
      setNipLookupLoading(false);
    }
  }

  const requiresAddress = deliveryMethod !== "odbior-osobisty";
  const contactReady = form.name.trim() !== "" && (form.phone.trim() !== "" || form.email.trim() !== "");
  const addressReady = !requiresAddress || (form.city.trim() !== "" && form.address1.trim() !== "");
  const invoiceReady = !wantsInvoice || (invoice.nip.trim().length === 10 && invoice.companyName.trim() !== "");
  const checkoutReady = contactReady && addressReady && invoiceReady && items.length > 0;

  const submitOrder = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    setError("");
    setIsSubmitting(true);
    try {
      const quotePayload = buildQuotePayloadFromCart(items);
      const quoteResponse = await saveShopQuote(quotePayload);
      const quoteCode = quoteResponse.quote.quote_code;

      const deliveryLabel =
        [...BASE_DELIVERY_METHODS, PACZKOMAT_METHOD].find((method) => method.id === deliveryMethod)?.label || "";
      const noteWithDelivery = [`Metoda dostawy: ${deliveryLabel}`, form.note.trim()].filter(Boolean).join("\n\n");

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
          },
          invoice: wantsInvoice
            ? {
                nip: invoice.nip,
                company_name: invoice.companyName,
                street: invoice.street,
                postcode: invoice.postcode,
                city: invoice.city,
              }
            : null,
          note_text: noteWithDelivery,
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
      submittedRef.current = false;
      setError(submitError instanceof Error ? submitError.message : "Wystąpił błąd.");
    } finally {
      setIsSubmitting(false);
    }
  }, [items, deliveryMethod, form, wantsInvoice, invoice]);

  // No "przejdź do płatności" button - the payment panel opens on its own
  // once the required fields are filled in, after a short pause in typing.
  useEffect(() => {
    if (orderState || isSubmitting || !checkoutReady) return;
    const timer = window.setTimeout(() => {
      void submitOrder();
    }, 900);
    return () => window.clearTimeout(timer);
  }, [checkoutReady, orderState, isSubmitting, submitOrder]);

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
        {!hydrated ? null : items.length === 0 && !orderState ? (
          <div className="cart-page-empty">
            <p>Twój koszyk jest jeszcze pusty.</p>
            <Link href="/?produkt=moskitiery-ramkowe" className="cart-page-empty-cta">
              Skonfiguruj moskitierę
            </Link>
          </div>
        ) : (
          <>
            {items.length > 0 ? (
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
            ) : (
              <p className="cart-page-order-note">Koszyk opróżniony po złożeniu zamówienia poniżej.</p>
            )}

            <div className="cart-checkout-layout">
              <div className="cart-checkout-left">
                <section className="cart-delivery-card">
                  <h2>Metody dostawy</h2>
                  <div className="cart-delivery-options">
                    {availableDeliveryMethods.map((method) => (
                      <label
                        key={method.id}
                        className={`cart-delivery-option ${deliveryMethod === method.id ? "is-active" : ""}`}
                      >
                        <input
                          type="radio"
                          name="delivery-method"
                          value={method.id}
                          checked={deliveryMethod === method.id}
                          onChange={() => setDeliveryMethod(method.id)}
                          disabled={!!orderState}
                        />
                        <span className="cart-delivery-option-copy">
                          <strong>{method.label}</strong>
                          <small>{method.description}</small>
                        </span>
                        <span className="cart-delivery-option-price">Gratis</span>
                      </label>
                    ))}
                  </div>
                  {!availableDeliveryMethods.some((method) => method.id === "paczkomat") ? (
                    <p className="cart-delivery-note">
                      Paczkomat InPost jest dostępny tylko dla zamówień, w których żaden z wymiarów pozycji nie
                      przekracza 64 cm.
                    </p>
                  ) : null}
                </section>

                <section className="cart-checkout-form-card">
                  <h2>Adres wysyłki</h2>
                  <fieldset className="cart-checkout-form" disabled={!!orderState}>
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
                      {requiresAddress ? (
                        <>
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
                              onChange={(event) =>
                                setForm((current) => ({ ...current, postcode: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            Ulica i numer
                            <input
                              value={form.address1}
                              onChange={(event) =>
                                setForm((current) => ({ ...current, address1: event.target.value }))
                              }
                            />
                          </label>
                        </>
                      ) : null}
                    </div>

                    <label className="cart-invoice-checkbox">
                      <input
                        type="checkbox"
                        checked={wantsInvoice}
                        onChange={(event) => setWantsInvoice(event.target.checked)}
                      />
                      Chcę otrzymać fakturę
                    </label>

                    {wantsInvoice ? (
                      <div className="cart-invoice-fields">
                        <label className="cart-invoice-nip-field">
                          NIP
                          <div className="cart-invoice-nip-row">
                            <input
                              inputMode="numeric"
                              placeholder="np. 1234567890"
                              value={invoice.nip}
                              onChange={(event) => {
                                const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
                                setInvoice((current) => ({ ...current, nip: digits }));
                                setNipLookupError("");
                              }}
                              onBlur={() => {
                                if (invoice.nip.length === 10) void lookupNip(invoice.nip);
                              }}
                            />
                            {nipLookupLoading ? <span className="cart-invoice-nip-spinner" aria-hidden="true" /> : null}
                          </div>
                          {nipLookupError ? <small className="cart-invoice-nip-error">{nipLookupError}</small> : null}
                          {!nipLookupError && !nipLookupLoading ? (
                            <small className="cart-invoice-nip-hint">
                              Dane firmy uzupełnią się automatycznie po wpisaniu NIP (Biała lista VAT, MF).
                            </small>
                          ) : null}
                        </label>
                        <div className="cart-checkout-form-grid">
                          <label>
                            Nazwa firmy
                            <input
                              value={invoice.companyName}
                              onChange={(event) =>
                                setInvoice((current) => ({ ...current, companyName: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            Ulica i numer
                            <input
                              value={invoice.street}
                              onChange={(event) => setInvoice((current) => ({ ...current, street: event.target.value }))}
                            />
                          </label>
                          <label>
                            Kod pocztowy
                            <input
                              value={invoice.postcode}
                              onChange={(event) =>
                                setInvoice((current) => ({ ...current, postcode: event.target.value }))
                              }
                            />
                          </label>
                          <label>
                            Miasto
                            <input
                              value={invoice.city}
                              onChange={(event) => setInvoice((current) => ({ ...current, city: event.target.value }))}
                            />
                          </label>
                        </div>
                      </div>
                    ) : null}

                    <label className="cart-checkout-note-field">
                      Dodatkowe informacje
                      <textarea
                        value={form.note}
                        onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                      />
                    </label>
                  </fieldset>
                </section>
              </div>

              <aside className="cart-checkout-right">
                <section className="cart-payment-card">
                  <h2>Płatność</h2>
                  {items.length > 0 ? (
                    <>
                      <div className="cart-page-summary-row is-muted">
                        <span>
                          {summary.items} {summary.items === 1 ? "produkt" : "produktów"}
                        </span>
                        <span>{formatPln(summary.total)}</span>
                      </div>
                      {orderSurcharge > 0 ? (
                        <div className="cart-page-summary-row is-muted">
                          <span>Dopłata za przesyłkę długościową</span>
                          <span>{formatPln(orderSurcharge)}</span>
                        </div>
                      ) : null}
                      <div className="cart-page-summary-row">
                        <span>Razem</span>
                        <strong>{formatPln(summary.total + orderSurcharge)}</strong>
                      </div>
                    </>
                  ) : null}

                  {orderState ? (
                    <>
                      <p className="cart-page-order-note">
                        Zamówienie <strong>{orderState.orderCode}</strong> utworzone. Wgląd do zamówienia będzie
                        wymagał telefonu albo e-maila podanego w formularzu.
                      </p>
                      {orderState.paymentEnabled && orderState.clientSecret && orderState.publishableKey ? (
                        <PaymentStep
                          clientSecret={orderState.clientSecret}
                          publishableKey={orderState.publishableKey}
                          orderCode={orderState.orderCode}
                        />
                      ) : (
                        <div className="cart-page-checkout-note">
                          Płatność online nie jest jeszcze skonfigurowana w tym środowisku. Zamówienie zapisaliśmy
                          pod numerem <strong>{orderState.orderCode}</strong> - skontaktujemy się, aby dokończyć
                          płatność.
                        </div>
                      )}
                    </>
                  ) : (
                    <>
                      {error ? <div className="cart-checkout-error">{error}</div> : null}
                      {isSubmitting ? (
                        <div className="cart-payment-waiting">
                          <span className="cart-invoice-nip-spinner" aria-hidden="true" />
                          Przygotowujemy płatność…
                        </div>
                      ) : (
                        <p className="cart-checkout-intro">
                          {checkoutReady
                            ? "Płatność otworzy się za chwilę…"
                            : "Uzupełnij dane po lewej (imię i nazwisko, kontakt, adres), aby przejść do płatności."}
                        </p>
                      )}
                    </>
                  )}
                </section>
              </aside>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
