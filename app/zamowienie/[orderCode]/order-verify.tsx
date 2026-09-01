"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";
import type { PublicOrder } from "@/lib/shop-public";
import { clearCart } from "@/lib/cart";
import PaymentStep, { type CheckoutContact } from "@/app/components/stripe-payment-step";

// Payment intents Stripe considers "not final" - a customer can still land
// here and retry from any of these (payment_failed above all: the retry
// e-mail's whole reason to exist).
const RETRYABLE_PAYMENT_STATUSES = new Set(["failed", "requires_payment", "canceled", ""]);

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "Opłacone",
  cod_pending: "Za pobraniem (nieopłacone)",
  requires_payment: "Oczekuje na płatność",
  failed: "Nieudana płatność",
  canceled: "Anulowana",
  pending: "Oczekuje",
};

export default function OrderVerify({ orderCode }: { orderCode: string }) {
  const [verifier, setVerifier] = useState("");
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const accessToken = searchParams.get("access_token") || "";

  const [retryPayment, setRetryPayment] = useState<{
    clientSecret: string;
    publishableKey: string;
    contact: CheckoutContact;
  } | null>(null);
  const [retryLoading, setRetryLoading] = useState(false);
  const [retryError, setRetryError] = useState("");
  const [justPaid, setJustPaid] = useState(false);

  const lookupOrder = useCallback(
    async (verifierValue: string) => {
      setIsSubmitting(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (accessToken) params.set("access_token", accessToken);
        else params.set("verifier", verifierValue);
        const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}?${params.toString()}`);
        const json = (await response.json()) as { ok: boolean; order?: PublicOrder; error?: string };
        if (!json.ok || !json.order) {
          throw new Error(json.error || "Nie udało się odczytać zamówienia.");
        }
        setOrder(json.order);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Wystąpił błąd.");
      } finally {
        setIsSubmitting(false);
      }
    },
    [accessToken, orderCode],
  );

  // A one-click link from the payment_failed e-mail carries its own
  // access_token - skip the phone/email prompt entirely and look the order
  // up straight away.
  useEffect(() => {
    if (accessToken) void lookupOrder("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  // Landing here straight from Stripe's redirect (BLIK, wallets, ... - any
  // method that couldn't confirm inline on /koszyk) is the actual "payment
  // went through" moment for those methods, so the cart only clears now,
  // not back when the order was merely drafted.
  useEffect(() => {
    const redirectStatus = searchParams.get("redirect_status");
    if (searchParams.get("from_payment") === "1" && (redirectStatus === "succeeded" || redirectStatus === "processing")) {
      clearCart();
      // Meta Purchase (przeglądarka) dla metod redirectowych (BLIK/wallets),
      // które nie potwierdzają się inline na /koszyk. event_id = order_code
      // -> deduplikacja z serwerowym Purchase z CRM (który niesie wartość).
      void import("@/lib/tracking")
        .then(({ track }) => {
          track("Purchase", { currency: "PLN", order_id: orderCode }, { eventId: orderCode, skipCapi: true });
        })
        .catch(() => {});
    }
  }, [searchParams, orderCode]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookupOrder(verifier);
  }

  async function handleStartRetry() {
    if (!order) return;
    setRetryLoading(true);
    setRetryError("");
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/retry-payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accessToken ? { access_token: accessToken } : { verifier }),
      });
      const json = (await response.json()) as {
        ok: boolean;
        client_secret?: string;
        publishable_key?: string;
        contact?: CheckoutContact;
        error?: string;
      };
      if (!json.ok || !json.client_secret || !json.publishable_key) {
        throw new Error(json.error || "Nie udało się rozpocząć płatności.");
      }
      setRetryPayment({
        clientSecret: json.client_secret,
        publishableKey: json.publishable_key,
        contact: json.contact || { name: "", phone: "", email: "", city: "", postcode: "", address1: "" },
      });
    } catch (submitError) {
      setRetryError(submitError instanceof Error ? submitError.message : "Wystąpił błąd.");
    } finally {
      setRetryLoading(false);
    }
  }

  if (order) {
    const canRetryPayment =
      order.payment_provider === "stripe" && RETRYABLE_PAYMENT_STATUSES.has(order.payment_status) && !justPaid;
    const paymentLabel = justPaid ? "Opłacone" : PAYMENT_STATUS_LABELS[order.payment_status] || order.payment_status;

    return (
      <section className={styles.orderCard}>
        <h2>
          Zamówienie {order.order_code}
          {order.crm_order_number ? ` (nr ${order.crm_order_number})` : ""}
        </h2>
        {!order.crm_order_number ? (
          <p className={styles.sectionIntro}>
            To numer tymczasowy - po przyjęciu zamówienia do realizacji otrzyma numer docelowy.
          </p>
        ) : null}
        <div className={styles.orderMeta}>
          <div>Status: <strong>{order.friendly_status}</strong></div>
          <div>Płatność: <strong>{paymentLabel}</strong></div>
          <div>Kwota: <strong>{order.amount_total ? `${order.amount_total} ${order.currency}` : "—"}</strong></div>
          <div>Produkt: <strong>{order.product_label}</strong></div>
          {order.customer_name ? <div>Odbiorca: <strong>{order.customer_name}</strong></div> : null}
          <div>Adres: <strong>{order.shipping_address_line_1}</strong> {order.shipping_address_line_2}</div>
          <div>Miasto: <strong>{order.shipping_postcode} {order.shipping_city}</strong></div>
          {order.invoice_required ? (
            <div>Faktura VAT: <strong>{order.invoice_issued ? "wystawiona" : "w przygotowaniu"}</strong></div>
          ) : null}
        </div>

        {order.estimated_completion ? (
          <div className={styles.noticeBox}>
            Szacowany termin realizacji: <strong>{order.estimated_completion}</strong>
            <br />
            <small>To termin orientacyjny, wyznaczony na podstawie aktualnego planu produkcji - może ulec zmianie.</small>
          </div>
        ) : null}

        {order.shipments.length > 0 ? (
          <div className={styles.orderMeta}>
            <h3>Przesyłka</h3>
            {order.shipments.map((shipment, index) => (
              <div key={`${shipment.tracking_number}-${index}`}>
                {shipment.carrier ? `${shipment.carrier} - ` : ""}
                <strong>{shipment.tracking_number}</strong>
                {shipment.tracking_link ? (
                  <>
                    {" "}
                    (
                    <a href={shipment.tracking_link} target="_blank" rel="noopener noreferrer">
                      śledź przesyłkę
                    </a>
                    )
                  </>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}

        {order.note_text ? <div className={styles.noticeBox}>{order.note_text}</div> : null}
        {order.summary_text ? <div className={styles.copyHtml}><p>{order.summary_text}</p></div> : null}

        {justPaid ? (
          <div className={styles.successBox}>Płatność zakończona sukcesem - dziękujemy!</div>
        ) : canRetryPayment ? (
          retryPayment ? (
            <div className={styles.paymentShell}>
              <PaymentStep
                clientSecret={retryPayment.clientSecret}
                publishableKey={retryPayment.publishableKey}
                orderCode={order.order_code}
                contact={retryPayment.contact}
                onPaid={() => setJustPaid(true)}
                termsAccepted
                submitLabel="Zapłać ponownie"
              />
            </div>
          ) : (
            <div className={styles.paymentShell}>
              <p className={styles.sectionIntro}>
                Płatność za to zamówienie nie została jeszcze zakończona. Możesz ją dokończyć bez wypełniania
                niczego od nowa.
              </p>
              {retryError ? <div className={styles.errorBox}>{retryError}</div> : null}
              <button type="button" className={styles.ctaButton} onClick={handleStartRetry} disabled={retryLoading}>
                {retryLoading ? "Wczytujemy…" : "Dokończ płatność"}
              </button>
            </div>
          )
        ) : null}
      </section>
    );
  }

  return (
    <section className={styles.verifyCard}>
      <h2>Zweryfikuj dostęp do zamówienia</h2>
      <p className={styles.sectionIntro}>
        Link z e-maila nie wystarcza do podglądu danych. Wpisz telefon albo e-mail podany podczas składania zamówienia.
      </p>
      {error ? <div className={styles.errorBox}>{error}</div> : null}
      <form className={styles.formGrid} onSubmit={handleSubmit}>
        <label className={styles.field}>
          Telefon lub e-mail
          <input value={verifier} onChange={(event) => setVerifier(event.target.value)} required />
        </label>
        <button type="submit" className={styles.ctaButton} disabled={isSubmitting}>
          {isSubmitting ? "Sprawdzamy…" : "Pokaż zamówienie"}
        </button>
      </form>
    </section>
  );
}
