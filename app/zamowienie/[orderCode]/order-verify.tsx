"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import InstallmentOffer from "@/app/components/installment-offer";
import { useSearchParams } from "next/navigation";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";
import type { PublicOrder } from "@/lib/shop-public";
import { clearCart } from "@/lib/cart";
import { trackShopStep } from "@/lib/track-step";
import type { CheckoutContact } from "@/app/components/stripe-payment-step";
import StripeMethodStep, { type CreatedIntent, type StripeMethod } from "@/app/components/stripe-method-step";
import {
  P24BankPicker,
  PaymentMethodTiles,
  buildPaymentTiles,
  usePaymentSettings,
  type P24Kind,
  type PaymentKind,
} from "@/app/components/payment-methods";

const STRIPE_PUBLISHABLE_KEY = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").trim();
const STRIPE_KINDS: PaymentKind[] = ["blik", "card", "wallets"];


// Rodzaje P24 i wszystkie pozostałe metody biorą się teraz z tego samego
// źródła co koszyk (app/components/payment-methods.tsx) - właściciel,
// 2026-09-22: „w linku do ponowienia płatności też ujednolić metody”.
const P24_KIND_TO_CRM: Record<P24Kind, string> = {
  p24_transfer: "transfer",
  p24_installments: "installments",
  p24_paypo: "paypo",
};
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

  const [retryLoading, setRetryLoading] = useState(false);
  // Wybrany kafelek płatności (jak w koszyku) + bank dla przelewu online.
  const [paymentKind, setPaymentKind] = useState<PaymentKind | null>(null);
  const [p24BankId, setP24BankId] = useState(0);
  const [transferSwitched, setTransferSwitched] = useState(false);
  const { transferSettings, p24Settings, p24Banks } = usePaymentSettings();
  const [retryError, setRetryError] = useState("");
  const [justPaid, setJustPaid] = useState(false);
  // Przelewy24: po powrocie (?p24=1) odpytujemy CRM, aż wpłata zostanie
  // potwierdzona (powiadomienie P24 -> CRM bywa kilka sekund po powrocie).
  const p24Return = searchParams.get("p24") === "1";
  const [p24Polling, setP24Polling] = useState(false);
  const [p24Timeout, setP24Timeout] = useState(false);
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

  async function handleStartP24(kind: P24Kind) {
    if (!order) return;
    setRetryLoading(true);
    setRetryError("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/p24-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(accessToken ? { access_token: accessToken } : { verifier }),
          method_kind: P24_KIND_TO_CRM[kind],
          ...(kind === "p24_transfer" && p24BankId ? { method_id: p24BankId } : {}),
          regulation_accept: true,
        }),
      });
      const json = (await res.json()) as { ok?: boolean; redirect_url?: string; error?: string };
      if (!res.ok || !json.ok || !json.redirect_url) {
        throw new Error(json.error || "Nie udało się uruchomić płatności Przelewy24.");
      }
      trackShopStep("p24_retry", kind, { order_code: orderCode, bank_id: p24BankId });
      window.location.assign(json.redirect_url);
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Wystąpił błąd.");
      setRetryLoading(false);
    }
  }

  // Przelew tradycyjny ze strony zamówienia: CRM przestawia płatność i
  // wysyła dane do przelewu, my odświeżamy zamówienie (pokaże się karta z
  // numerem konta i tytułem).
  async function handleSwitchTransfer() {
    if (!order) return;
    setRetryLoading(true);
    setRetryError("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/transfer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accessToken ? { access_token: accessToken } : { verifier }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Nie udało się przełączyć płatności na przelew.");
      }
      trackShopStep("transfer_retry", "switched", { order_code: orderCode });
      setTransferSwitched(true);
      await lookupOrder(verifier);
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Wystąpił błąd.");
    } finally {
      setRetryLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void lookupOrder(verifier);
  }

  // Intencja powstaje dopiero przy kliknięciu "Zapłać" w StripeMethodStep -
  // wybranie kafelka niczego jeszcze nie tworzy (żadnych porzuconych
  // PaymentIntentów przy przeglądaniu metod).
  async function createRetryIntent(method: StripeMethod): Promise<CreatedIntent | null> {
    if (!order) return null;
    setRetryError("");
    const response = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/retry-payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(accessToken ? { access_token: accessToken } : { verifier }),
        stripe_method: method,
      }),
    });
    const json = (await response.json()) as { ok: boolean; client_secret?: string; error?: string };
    if (!response.ok || !json.ok || !json.client_secret) {
      throw new Error(json.error || "Nie udało się rozpocząć płatności.");
    }
    trackShopStep("payment_retry", method, { order_code: orderCode });
    return { clientSecret: json.client_secret, orderCode };
  }

  if (order) {
    // Jeden warunek dla wszystkich metod: zamówienie nieopłacone, nie za
    // pobraniem i nie w trakcie sprawdzania powrotu z P24. Dostawca pierwszej,
    // nieudanej próby nie ogranicza już wyboru - klient może zapłacić czymkolwiek.
    const canPayNow =
      !justPaid &&
      !p24Polling &&
      order.payment_status !== "paid" &&
      order.payment_provider !== "cod" &&
      order.payment_status !== "cod_pending" &&
      Boolean(order.amount_total);
    const amountGrosze = Math.max(0, Math.round(Number((order.amount_total || "0").replace(",", ".")) * 100));
    const paymentTiles = buildPaymentTiles({
      stripeAvailable: STRIPE_PUBLISHABLE_KEY !== "",
      p24Settings,
      transferEnabled: transferSettings.enabled,
      // Ta sama rata co w koszyku - kafelek "Raty" pokazuje konkret.
      amount: Number((order.amount_total || "0").replace(",", ".")) || 0,
      // Przelew tradycyjny tylko dopóki zamówienie nie jest już przelewem.
      allowTransfer: order.payment_provider !== "transfer",
    });
    // Nic nie jest zaznaczone z góry - tak samo jak w koszyku (właściciel,
    // 2026-09-24): klient sam wybiera metodę, a panel z polami otwiera się
    // dopiero wtedy.
    const selectedKind: PaymentKind | null = paymentKind;
    const retryContact: CheckoutContact = {
      name: order.customer_name || "",
      phone: order.customer_phone || "",
      email: order.customer_email || "",
      city: order.shipping_city || "",
      postcode: order.shipping_postcode || "",
      address1: order.shipping_address_line_1 || "",
    };
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
        ) : transferSwitched && order.payment_provider === "transfer" ? (
          <div className={styles.successBox}>
            Zmieniliśmy płatność na przelew tradycyjny. Dane do przelewu masz powyżej i wysłaliśmy je też e-mailem.
          </div>
        ) : canPayNow ? (
          <div className={styles.paymentShell}>
            <p className={styles.sectionIntro}>
              Płatność za to zamówienie nie została jeszcze zakończona. Wybierz sposób płatności - niczego nie
              musisz wypełniać od nowa.
            </p>
            <InstallmentOffer amount={Number((order.amount_total || "0").replace(",", ".")) || 0} />
            <PaymentMethodTiles
              tiles={paymentTiles}
              selected={selectedKind}
              onSelect={(kind) => {
                setPaymentKind(kind);
                setRetryError("");
                trackShopStep("payment_retry_kind", kind, { order_code: orderCode });
              }}
              disabled={retryLoading}
              name="order-payment-kind"
            />
            {selectedKind === "p24_transfer" ? (
              <P24BankPicker
                banks={p24Banks}
                selectedId={p24BankId}
                onSelect={(bank) => setP24BankId(bank.id)}
              />
            ) : null}
            {retryError ? <div className={styles.errorBox}>{retryError}</div> : null}
            {selectedKind && STRIPE_KINDS.includes(selectedKind) ? (
              <StripeMethodStep
                key={selectedKind}
                publishableKey={STRIPE_PUBLISHABLE_KEY}
                method={selectedKind as StripeMethod}
                amountGrosze={amountGrosze}
                contact={retryContact}
                termsAccepted
                disabledReason=""
                createIntent={() => createRetryIntent(selectedKind as StripeMethod)}
                submitLabel="Zapłać"
                onPaid={() => {
                  setJustPaid(true);
                  clearCart();
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
              />
            ) : selectedKind === "transfer" ? (
              <>
                <p className={styles.sectionIntro}>
                  Dane do przelewu pokażemy tutaj i wyślemy e-mailem. Zamówienie trafi do realizacji po
                  zaksięgowaniu wpłaty.
                </p>
                <button type="button" className={styles.ctaButton} onClick={handleSwitchTransfer} disabled={retryLoading}>
                  {retryLoading ? "Przygotowujemy…" : "Wybieram przelew tradycyjny"}
                </button>
              </>
            ) : (
              <button
                type="button"
                className={styles.ctaButton}
                onClick={() => void handleStartP24(selectedKind as P24Kind)}
                disabled={retryLoading || (selectedKind === "p24_transfer" && p24Banks.length > 0 && !p24BankId)}
              >
                {retryLoading
                  ? "Przekierowujemy…"
                  : selectedKind === "p24_transfer" && p24Banks.length > 0 && !p24BankId
                    ? "Wybierz swój bank"
                    : selectedKind === "p24_paypo" || selectedKind === "p24_installments"
                      ? // Raty i PayPo kończą się wnioskiem u finansującego,
                        // nie zapłatą - tak samo jak w koszyku.
                        "Przechodzę do wniosku"
                      : "Przejdź do płatności"}
              </button>
            )}
          </div>
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
