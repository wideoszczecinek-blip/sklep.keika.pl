"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";
import type { PublicOrder } from "@/lib/shop-public";
import { clearCart } from "@/lib/cart";
import { trackShopStep } from "@/lib/track-step";
import PaymentStep, { type CheckoutContact } from "@/app/components/stripe-payment-step";

// Payment intents Stripe considers "not final" - a customer can still land
// here and retry from any of these (payment_failed above all: the retry
// e-mail's whole reason to exist).
const RETRYABLE_PAYMENT_STATUSES = new Set(["failed", "requires_payment", "canceled", ""]);

// Przelewy24 (umowa bezpośrednia): rodzaje ponownej płatności ze strony
// statusu; CRM (payment_p24_start) sam wybiera kanał/metodę P24.
const P24_RETRY_KINDS: { kind: string; label: string; flag: "p24_transfer_enabled" | "p24_installments_enabled" | "p24_paypo_enabled" }[] = [
  { kind: "transfer", label: "Przelew online (wybór banku)", flag: "p24_transfer_enabled" },
  { kind: "installments", label: "Raty", flag: "p24_installments_enabled" },
  { kind: "paypo", label: "PayPo – kup teraz, zapłać później", flag: "p24_paypo_enabled" },
];
const P24_POLL_ATTEMPTS = 24;
const P24_POLL_INTERVAL_MS = 3000;

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  paid: "Opłacone",
  cod_pending: "Za pobraniem (nieopłacone)",
  transfer_pending: "Przelew tradycyjny – oczekujemy na wpłatę",
  transfer_cancelled: "Anulowane – brak wpłaty",
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
  // Przelewy24: po powrocie (?p24=1) odpytujemy CRM, aż wpłata zostanie
  // potwierdzona (powiadomienie P24 -> CRM bywa kilka sekund po powrocie).
  const p24Return = searchParams.get("p24") === "1";
  const [p24Polling, setP24Polling] = useState(false);
  const [p24Timeout, setP24Timeout] = useState(false);
  const [p24Kind, setP24Kind] = useState("transfer");
  const [p24Flags, setP24Flags] = useState<Record<string, boolean> | null>(null);
  const p24PollStartedRef = useRef(false);
  // Guards the redirect-success OpenAI tracking effect below so it can only
  // ever fire once per mount, even if `order`/searchParams re-trigger it
  // (e.g. a re-render after lookupOrder resolves).
  const openAiTrackedRef = useRef(false);

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
        trackShopStep("order_lookup", "ok", { order_code: orderCode, via: accessToken ? "link" : "verifier" });
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "Wystąpił błąd.");
        trackShopStep("order_lookup", "failed", { order_code: orderCode, message: (submitError instanceof Error ? submitError.message : "błąd").slice(0, 200) });
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
      // Meta Purchase leci WYŁĄCZNIE serwerowo z CRM (Conversions API,
      // event_id = order_code) - przeglądarkowy fbq('Purchase') został
      // usunięty 2026-09-03: Meta nie deduplikowała go z serwerowym (dublował
      // konwersje, a zestaw optymalizuje pod Zakup), a i tak ~97% ruchu to
      // przeglądarka w aplikacji FB, gdzie fbq bywa blokowany.
    }
  }, [searchParams, orderCode]);

  // OpenAI Ads "order_created" - dodane 2026-09-19, nie ma (jeszcze) własnego
  // server-side Conversions API jak Meta, więc leci stąd, z przeglądarki.
  // Celowo TYLKO na "succeeded" (nie "processing" powyżej - BLIK bywa jeszcze
  // odrzucone w aplikacji bankowej, patrz [[blik-processing-premature-success-bug]])
  // i TYLKO gdy `order` jest już wczytane (potrzebne do amount/currency) - stąd
  // osobny efekt zamiast dopisania do tego powyżej, który odpala się od razu
  // z samych searchParams. openAiTrackedRef pilnuje, żeby to nie odpaliło się
  // ponownie przy zwykłym powrocie na tę stronę z e-maila, gdzie order.payment_status
  // może już i tak pokazywać "paid" ze starej, wcześniejszej płatności.
  useEffect(() => {
    if (openAiTrackedRef.current || !order) return;
    const redirectStatus = searchParams.get("redirect_status");
    if (searchParams.get("from_payment") !== "1" || redirectStatus !== "succeeded") return;
    if (!order.amount_total) return;
    openAiTrackedRef.current = true;
    void import("@/lib/tracking").then(({ trackOpenAiOrderCreated }) => {
      trackOpenAiOrderCreated({
        orderCode: order.order_code,
        amountZl: Number(order.amount_total),
        currency: order.currency,
        items: [{ id: order.product_slug, name: order.product_label, quantity: 1 }],
      });
    });
  }, [order, searchParams]);

  // Które rodzaje P24 są włączone (CRM -> Sklep WWW -> checkout) - do
  // przycisku "Dokończ płatność"; gdy nie da się pobrać, pokazujemy wszystkie.
  useEffect(() => {
    if (!order || order.payment_provider !== "p24" || order.payment_status === "paid") return;
    fetch("https://crm-keika.groovemedia.pl/biuro/api/shop-public/site", { cache: "no-store" })
      .then((r) => r.json())
      .then((json) => {
        const c = json?.checkout && typeof json.checkout === "object" ? json.checkout : {};
        setP24Flags({
          p24_transfer_enabled: c.p24_transfer_enabled === true,
          p24_installments_enabled: c.p24_installments_enabled === true,
          p24_paypo_enabled: c.p24_paypo_enabled === true,
        });
      })
      .catch(() => setP24Flags(null));
  }, [order]);

  // Powrót z Przelewy24: odpytuj p24-check (CRM sprawdza w P24 i księguje),
  // maks. ~72 s; sukces = koszyk wyczyszczony + zielony box jak po Stripe.
  useEffect(() => {
    if (!p24Return || !order || p24PollStartedRef.current) return;
    if (order.payment_provider !== "p24") return;
    if (order.payment_status === "paid") {
      clearCart();
      return;
    }
    p24PollStartedRef.current = true;
    let cancelled = false;
    let attempt = 0;
    setP24Polling(true);
    const tick = async () => {
      if (cancelled) return;
      attempt += 1;
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/p24-check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accessToken ? { access_token: accessToken } : { verifier }),
        });
        const json = (await res.json()) as { ok?: boolean; paid?: boolean };
        if (!cancelled && json.ok && json.paid) {
          setP24Polling(false);
          setJustPaid(true);
          clearCart();
          trackShopStep("p24_return", "paid", { order_code: orderCode, attempts: attempt });
          if (order.amount_total) {
            void import("@/lib/tracking").then(({ trackOpenAiOrderCreated }) => {
              trackOpenAiOrderCreated({
                orderCode: order.order_code,
                amountZl: Number(order.amount_total),
                currency: order.currency,
                items: [{ id: order.product_slug, name: order.product_label, quantity: 1 }],
              });
            });
          }
          void lookupOrder(verifier);
          return;
        }
      } catch {
        /* spróbuj ponownie */
      }
      if (cancelled) return;
      if (attempt >= P24_POLL_ATTEMPTS) {
        setP24Polling(false);
        setP24Timeout(true);
        trackShopStep("p24_return", "timeout", { order_code: orderCode });
        return;
      }
      window.setTimeout(tick, P24_POLL_INTERVAL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p24Return, order?.order_code, order?.payment_provider, order?.payment_status]);

  const p24Kinds = P24_RETRY_KINDS.filter((k) => !p24Flags || p24Flags[k.flag]);
  const p24EffectiveKind = p24Kinds.length === 1 ? p24Kinds[0].kind : p24Kind;

  async function handleStartP24() {
    if (!order) return;
    setRetryLoading(true);
    setRetryError("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/p24-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...(accessToken ? { access_token: accessToken } : { verifier }), method_kind: p24EffectiveKind }),
      });
      const json = (await res.json()) as { ok?: boolean; redirect_url?: string; error?: string };
      if (!res.ok || !json.ok || !json.redirect_url) {
        throw new Error(json.error || "Nie udało się uruchomić płatności Przelewy24.");
      }
      trackShopStep("p24_retry", p24EffectiveKind, { order_code: orderCode });
      window.location.assign(json.redirect_url);
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Wystąpił błąd.");
      setRetryLoading(false);
    }
  }

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
    const canRetryP24 =
      order.payment_provider === "p24" &&
      RETRYABLE_PAYMENT_STATUSES.has(order.payment_status) &&
      !justPaid &&
      !p24Polling;
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

        {order.transfer && order.payment_status === "transfer_pending" ? (
          <div className="order-transfer-card">
            <h3>Dane do przelewu</h3>
            <dl className="order-transfer-grid">
              <div>
                <dt>Odbiorca</dt>
                <dd>
                  {order.transfer.account_holder}
                  {order.transfer.holder_address ? <small>{order.transfer.holder_address}</small> : null}
                </dd>
              </div>
              <div>
                <dt>Numer konta</dt>
                <dd className="order-transfer-iban">
                  {order.transfer.account_number}
                  {order.transfer.bank_name ? <small>{order.transfer.bank_name}</small> : null}
                </dd>
              </div>
              <div>
                <dt>Kwota</dt>
                <dd>
                  {order.transfer.amount ? `${order.transfer.amount.replace(".", ",")} ${order.transfer.currency || "PLN"}` : "—"}
                </dd>
              </div>
              <div>
                <dt>Tytuł przelewu</dt>
                <dd className="order-transfer-title">{order.transfer.title || order.order_code}</dd>
              </div>
            </dl>
            <p className="order-transfer-note">
              Zaksięgowanie przelewu może potrwać <strong>do 2 dni roboczych</strong>. Gdy wpłata do nas dotrze,
              poinformujemy Cię e-mailem, że zamówienie zostało przekazane do realizacji. Te same dane wysłaliśmy
              na Twój adres e-mail.
            </p>
          </div>
        ) : null}

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

        {p24Polling ? (
          <div className="order-p24-waiting">
            <span className="order-p24-spinner" aria-hidden="true" />
            <span>
              Czekamy na potwierdzenie płatności z Przelewy24… Zwykle trwa to kilka sekund. Nie zamykaj tej strony.
            </span>
          </div>
        ) : null}
        {p24Timeout && !justPaid && order.payment_status !== "paid" ? (
          <div className={styles.noticeBox}>
            Nie dostaliśmy jeszcze potwierdzenia z Przelewy24. Jeśli płatność została wykonana, zaksięgujemy ją
            automatycznie, gdy tylko dotrze potwierdzenie – dostaniesz wtedy e-mail. Jeśli płatność nie doszła do
            skutku, możesz ją ponowić poniżej.
          </div>
        ) : null}

        {justPaid ? (
          <div className={styles.successBox}>Płatność zakończona sukcesem - dziękujemy!</div>
        ) : canRetryP24 ? (
          <div className={styles.paymentShell}>
            <p className={styles.sectionIntro}>
              Płatność za to zamówienie nie została jeszcze zakończona. Możesz ją dokończyć przez Przelewy24 bez
              wypełniania niczego od nowa.
            </p>
            {p24Kinds.length > 1 ? (
              <div className="order-p24-kinds" role="radiogroup" aria-label="Sposób płatności Przelewy24">
                {p24Kinds.map((k) => (
                  <label key={k.kind} className={`order-p24-kind ${p24Kind === k.kind ? "is-active" : ""}`}>
                    <input
                      type="radio"
                      name="p24-kind"
                      value={k.kind}
                      checked={p24Kind === k.kind}
                      onChange={() => setP24Kind(k.kind)}
                    />
                    {k.label}
                  </label>
                ))}
              </div>
            ) : null}
            {retryError ? <div className={styles.errorBox}>{retryError}</div> : null}
            <button type="button" className={styles.ctaButton} onClick={handleStartP24} disabled={retryLoading}>
              {retryLoading ? "Przekierowujemy…" : "Dokończ płatność przez Przelewy24"}
            </button>
          </div>
        ) : canRetryPayment ? (
          retryPayment ? (
            <div className={styles.paymentShell}>
              <PaymentStep
                clientSecret={retryPayment.clientSecret}
                publishableKey={retryPayment.publishableKey}
                orderCode={order.order_code}
                contact={retryPayment.contact}
                onPaid={() => {
                  setJustPaid(true);
                  if (order.amount_total) {
                    void import("@/lib/tracking").then(({ trackOpenAiOrderCreated }) => {
                      trackOpenAiOrderCreated({
                        orderCode: order.order_code,
                        amountZl: Number(order.amount_total),
                        currency: order.currency,
                        items: [{ id: order.product_slug, name: order.product_label, quantity: 1 }],
                      });
                    });
                  }
                }}
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
