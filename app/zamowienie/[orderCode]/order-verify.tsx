"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import InstallmentOffer from "@/app/components/installment-offer";
import CartTrustBlock from "@/app/components/cart-trust-block";
import { useSearchParams } from "next/navigation";
import type { PublicOrder } from "@/lib/shop-public";
import { clearCart, formatPln, NON_PRODUCT_POSITION_SLUGS, readCartItems } from "@/lib/cart";
import { crmGetJson } from "@/lib/crm-get";
import { trackShopStep } from "@/lib/track-step";
import type { CheckoutContact } from "@/app/components/stripe-payment-step";
import StripeMethodStep, { type CreatedIntent, type StripeMethod } from "@/app/components/stripe-method-step";
import { PaynowGdprNotice } from "@/app/components/paynow-gdpr";
import {
  CRM_PUBLIC_BASE,
  P24BankPicker,
  buildPaymentTiles,
  usePaymentSettings,
  resolveProvider,
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
const PAYNOW_POLL_ATTEMPTS = 24;
const PAYNOW_POLL_INTERVAL_MS = 3000;


export default function OrderVerify({ orderCode }: { orderCode: string }) {
  const [verifier, setVerifier] = useState("");
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const accessToken = searchParams.get("access_token") || "";

  const [retryLoading, setRetryLoading] = useState(false);
  // Wybrany kafelek płatności (jak w koszyku) + bank dla przelewu online.
  // Nic nie jest zaznaczone z góry, tak samo jak w koszyku (właściciel,
  // 2026-09-24, wrócone 2026-09-30).
  const [paymentKind, setPaymentKind] = useState<PaymentKind | null>(null);
  const [p24BankId, setP24BankId] = useState(0);
  const [transferSwitched, setTransferSwitched] = useState(false);
  const { transferSettings, p24Settings, p24Banks, paynowBanks, paymentRouting } = usePaymentSettings();
  const [retryError, setRetryError] = useState("");
  const [justPaid, setJustPaid] = useState(false);
  // Przelewy24: po powrocie (?p24=1) odpytujemy CRM, aż wpłata zostanie
  // potwierdzona (powiadomienie P24 -> CRM bywa kilka sekund po powrocie).
  const p24Return = searchParams.get("p24") === "1";
  const [p24Polling, setP24Polling] = useState(false);
  const [p24Timeout, setP24Timeout] = useState(false);
  const p24PollStartedRef = useRef(false);
  // PayNow (2026-09-30): siatka banków (przelew online routowany na
  // paynow), kod BLIK (White Label - wpisywany tu, bez przekierowania) i
  // polling po powrocie z przekierowania pbl/card (?paynow=1) - mirror P24.
  const [paynowBankId, setPaynowBankId] = useState(0);
  const [paynowBlikCode, setPaynowBlikCode] = useState("");
  const paynowReturn = searchParams.get("paynow") === "1";
  const [paynowPolling, setPaynowPolling] = useState(false);
  const [paynowTimeout, setPaynowTimeout] = useState(false);
  const paynowPollStartedRef = useRef(false);
  // Guards the redirect-success OpenAI tracking effect below so it can only
  // ever fire once per mount, even if `order`/searchParams re-trigger it
  // (e.g. a re-render after lookupOrder resolves).
  const openAiTrackedRef = useRef(false);
  // Ile pozycji ma jeszcze koszyk na tym urządzeniu - po nieudanej płatności
  // nie jest czyszczony, więc "Zmień zamówienie" może wrócić wprost do niego.
  const [localCartCount, setLocalCartCount] = useState(0);
  const [siteContact, setSiteContact] = useState({ phone: "", email: "", hours: "" });

  useEffect(() => {
    setLocalCartCount(readCartItems().length);
    crmGetJson<{ site?: { contact_phone?: string; contact_email?: string; contact_hours?: string } }>(`${CRM_PUBLIC_BASE}/site`)
      .then((json) => {
        const site = json?.site || {};
        setSiteContact({
          phone: typeof site.contact_phone === "string" ? site.contact_phone : "",
          email: typeof site.contact_email === "string" ? site.contact_email : "",
          hours: typeof site.contact_hours === "string" ? site.contact_hours : "",
        });
      })
      .catch(() => {});
  }, []);

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

  // Powrót z PayNow (pbl/card, po przekierowaniu) - mirror powyższego
  // pollingu P24. BLIK PayNow (bez przekierowania) odpytuje analogicznie,
  // ale startuje od razu po submit w handleStartPaynow, nie stąd.
  useEffect(() => {
    if (!paynowReturn || !order || paynowPollStartedRef.current) return;
    if (order.payment_provider !== "paynow") return;
    if (order.payment_status === "paid") {
      clearCart();
      return;
    }
    paynowPollStartedRef.current = true;
    let cancelled = false;
    let attempt = 0;
    setPaynowPolling(true);
    const tick = async () => {
      if (cancelled) return;
      attempt += 1;
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/paynow-check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accessToken ? { access_token: accessToken } : { verifier }),
        });
        const json = (await res.json()) as { ok?: boolean; paid?: boolean; paynow_status?: string | null };
        // Płatność zakończona niepowodzeniem po stronie PayNow - nie ma na
        // co czekać, od razu pokazujemy możliwość ponowienia.
        const pnStatus = String(json.paynow_status || "").toUpperCase();
        if (!cancelled && json.ok && !json.paid && ["REJECTED", "ERROR", "EXPIRED", "ABANDONED"].includes(pnStatus)) {
          setPaynowPolling(false);
          setRetryError(
            pnStatus === "EXPIRED"
              ? "Czas na dokończenie płatności minął. Wybierz metodę i spróbuj jeszcze raz."
              : "Płatność nie została zrealizowana - nic nie zostało pobrane. Wybierz metodę i spróbuj jeszcze raz.",
          );
          trackShopStep("paynow_return", pnStatus.toLowerCase(), { order_code: orderCode, attempts: attempt });
          return;
        }
        if (!cancelled && json.ok && json.paid) {
          setPaynowPolling(false);
          setJustPaid(true);
          clearCart();
          trackShopStep("paynow_return", "paid", { order_code: orderCode, attempts: attempt });
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
      if (attempt >= PAYNOW_POLL_ATTEMPTS) {
        setPaynowPolling(false);
        setPaynowTimeout(true);
        trackShopStep("paynow_return", "timeout", { order_code: orderCode });
        return;
      }
      window.setTimeout(tick, PAYNOW_POLL_INTERVAL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paynowReturn, order?.order_code, order?.payment_provider, order?.payment_status]);

  // PayNow BLIK: kod wpisany na tej stronie, bez przekierowania - start +
  // poll w jednym (odpowiednik combined create+start w koszyku, tu
  // zamówienie już istnieje więc to tylko "start").
  async function pollPaynowAfterBlikStart() {
    setPaynowPolling(true);
    setPaynowTimeout(false);
    let attempt = 0;
    const tick = async (): Promise<void> => {
      attempt += 1;
      try {
        const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/paynow-check`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(accessToken ? { access_token: accessToken } : { verifier }),
        });
        const json = (await res.json()) as { ok?: boolean; paid?: boolean; paynow_status?: string | null };
        const pnStatus = String(json.paynow_status || "").toUpperCase();
        if (json.ok && !json.paid && ["REJECTED", "ERROR", "EXPIRED", "ABANDONED"].includes(pnStatus)) {
          setPaynowPolling(false);
          setPaynowBlikCode("");
          setRetryError(
            pnStatus === "EXPIRED"
              ? "Czas na potwierdzenie płatności minął. Wygeneruj nowy kod BLIK w aplikacji banku i spróbuj jeszcze raz."
              : "Płatność BLIK nie została potwierdzona w aplikacji banku. Wygeneruj nowy kod i spróbuj jeszcze raz - nic nie zostało pobrane.",
          );
          trackShopStep("paynow_blik_retry", pnStatus.toLowerCase(), { order_code: orderCode, attempts: attempt });
          return;
        }
        if (json.ok && json.paid) {
          setPaynowPolling(false);
          setJustPaid(true);
          clearCart();
          trackShopStep("paynow_blik_retry", "paid", { order_code: orderCode, attempts: attempt });
          void lookupOrder(verifier);
          return;
        }
      } catch {
        /* spróbuj ponownie */
      }
      if (attempt >= PAYNOW_POLL_ATTEMPTS) {
        setPaynowPolling(false);
        setPaynowTimeout(true);
        trackShopStep("paynow_blik_retry", "timeout", { order_code: orderCode });
        return;
      }
      window.setTimeout(() => void tick(), PAYNOW_POLL_INTERVAL_MS);
    };
    void tick();
  }

  async function handleStartPaynow(kind: "pbl" | "blik" | "card" | "paypo") {
    if (!order) return;
    setRetryLoading(true);
    setRetryError("");
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/paynow-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(accessToken ? { access_token: accessToken } : { verifier }),
          method_kind: kind,
          ...(kind === "pbl" && paynowBankId ? { payment_method_id: paynowBankId } : {}),
          ...(kind === "blik" ? { blik_code: paynowBlikCode.replace(/\D+/g, "").slice(0, 6) } : {}),
        }),
      });
      const json = (await res.json()) as { ok?: boolean; redirect_url?: string; kind?: string; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error || "Nie udało się uruchomić płatności PayNow.");
      }
      trackShopStep("paynow_retry", kind, { order_code: orderCode, bank_id: paynowBankId });
      if (json.redirect_url) {
        window.location.assign(json.redirect_url);
        return;
      }
      // BLIK: brak przekierowania - czekamy na zatwierdzenie w aplikacji banku.
      setRetryLoading(false);
      void pollPaynowAfterBlikStart();
    } catch (e) {
      setRetryError(e instanceof Error ? e.message : "Wystąpił błąd.");
      setRetryLoading(false);
    }
  }

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
    const amountTotalNum = Number((order.amount_total || "0").replace(",", ".")) || 0;
    // Jeden warunek dla wszystkich metod: zamówienie nieopłacone, nie za
    // pobraniem i nie w trakcie sprawdzania powrotu z P24/PayNow. Dostawca
    // pierwszej, nieudanej próby nie ogranicza wyboru - klient może zapłacić
    // czymkolwiek.
    const canPayNow =
      !justPaid &&
      !p24Polling &&
      !paynowPolling &&
      order.payment_status !== "paid" &&
      order.payment_provider !== "cod" &&
      order.payment_status !== "cod_pending" &&
      order.status !== "cancelled" &&
      Boolean(order.amount_total);
    const amountGrosze = Math.max(0, Math.round(amountTotalNum * 100));
    const paymentTiles = buildPaymentTiles({
      stripeAvailable: STRIPE_PUBLISHABLE_KEY !== "",
      p24Settings,
      transferEnabled: transferSettings.enabled,
      // Ta sama rata co w koszyku - kafelek "Raty" pokazuje konkret.
      amount: amountTotalNum,
      // Przelew tradycyjny tylko dopóki zamówienie nie jest już przelewem.
      allowTransfer: order.payment_provider !== "transfer",
      routing: paymentRouting,
    });
    const selectedProvider =
      paymentKind === "blik" || paymentKind === "card" || paymentKind === "wallets"
        ? resolveProvider(paymentRouting, paymentKind, "stripe")
        : paymentKind === "p24_transfer"
          ? resolveProvider(paymentRouting, "transfer", "p24")
          : paymentKind === "p24_paypo"
            ? resolveProvider(paymentRouting, "paypo", "p24")
            : "stripe";
    const retryContact: CheckoutContact = {
      name: order.customer_name || "",
      phone: order.customer_phone || "",
      email: order.customer_email || "",
      city: order.shipping_city || "",
      postcode: order.shipping_postcode || "",
      address1: order.shipping_address_line_1 || "",
    };
    const lines = splitOrderLines(order);
    const note = parseOrderNote(order.note_text);
    const isPaid = justPaid || order.payment_status === "paid";
    const isFailed = !isPaid && ["failed", "canceled"].includes(order.payment_status);
    const isTransferPending = !isPaid && order.payment_status === "transfer_pending";
    const isCod = order.payment_provider === "cod" || order.payment_status === "cod_pending";
    const waiting = p24Polling || paynowPolling;
    const timedOut = !isPaid && (p24Timeout || paynowTimeout);
    const freeDelivery = !lines.charges.some((c) => c.slug === "koszt-dostawy") && note.delivery !== "" && !/osobisty/i.test(note.delivery);
    // "Zmień zamówienie": ten sam telefon/komputer ma jeszcze koszyk (nie
    // czyścimy go przed udaną płatnością) - wtedy wprost do /koszyk. Na
    // innym urządzeniu odtwarzamy pozycje z wyceny, ale tylko dla produktów,
    // które przechodzą to bez strat (moskitiery, plisy) - dla reszty zostaje
    // kontakt, żeby nie zgubić np. modelu okna dachowego.
    const restoreSafe = lines.products.length > 0 && lines.products.every((p) => RESTORABLE_SLUGS.has(p.slug));
    const editHref = !canPayNow ? "" : localCartCount > 0 ? "/koszyk" : restoreSafe && order.quote_code ? `/wizyta/${encodeURIComponent(order.quote_code)}?do=koszyk` : "";

    const heroTone = isPaid ? "is-paid" : isFailed || timedOut ? "is-failed" : "";
    const heroTitle = justPaid
      ? "Dziękujemy, płatność doszła"
      : isPaid
        ? "Zamówienie opłacone"
        : waiting
          ? "Sprawdzamy płatność…"
          : timedOut
            ? "Nie mamy jeszcze potwierdzenia z banku"
            : isTransferPending
              ? "Czekamy na Twój przelew"
              : isCod
                ? "Zamówienie przyjęte, zapłacisz kurierowi"
                : order.status === "cancelled"
                  ? "Zamówienie anulowane"
                  : isFailed
                    ? "Płatność nie przeszła"
                    : "Zostało tylko opłacić zamówienie";
    const heroText = justPaid
      ? "Potwierdzenie wysłaliśmy na Twój e-mail. Zamówienie idzie do realizacji - o każdym kolejnym kroku damy znać."
      : isPaid
        ? `Status: ${order.friendly_status}.`
        : waiting
          ? "Zwykle trwa to kilka sekund. Nie zamykaj tej strony."
          : timedOut
            ? "Jeśli płatność została zatwierdzona, zaksięgujemy ją sama, gdy bank ją potwierdzi, i wyślemy e-mail. Nie płać drugi raz - a jeśli nic nie zatwierdziłeś, wybierz metodę poniżej."
            : isTransferPending
              ? "Dane do przelewu masz poniżej. Tytuł przelewu to numer zamówienia - po zaksięgowaniu wpłaty przekażemy je do realizacji."
              : isCod
                ? `Kurier pobierze ${formatPln(amountTotalNum)} przy dostawie.`
                : order.status === "cancelled"
                  ? "To zamówienie zostało anulowane. Jeśli to pomyłka, zadzwoń - pomożemy."
                  : isFailed
                    ? "Zamówienie jest zapisane i cena się nie zmieniła. Spróbuj jeszcze raz - tą samą albo inną metodą."
                    : "Wszystko jest zapisane. Po opłaceniu przekazujemy zamówienie do produkcji.";

    const renderCta = (label: string, onClick: () => void, disabled: boolean, hint?: string) => (
      <>
        {retryError ? <div className="cart-checkout-error">{retryError}</div> : null}
        <button type="button" className="cart-page-checkout-cta" onClick={onClick} disabled={disabled}>
          {label}
        </button>
        {hint ? <p className="cart-checkout-cta-hint">{hint}</p> : null}
      </>
    );

    // Opcje metody otwierają się pod JEJ kafelkiem - jak w koszyku.
    const renderRetryPanel = (kind: PaymentKind) => {
      if (STRIPE_KINDS.includes(kind) && selectedProvider === "stripe") {
        return (
          <>
            {retryError ? <div className="cart-checkout-error">{retryError}</div> : null}
            <StripeMethodStep
              key={kind}
              publishableKey={STRIPE_PUBLISHABLE_KEY}
              method={kind as StripeMethod}
              amountGrosze={amountGrosze}
              contact={retryContact}
              termsAccepted
              disabledReason=""
              createIntent={() => createRetryIntent(kind as StripeMethod)}
              submitLabel={kind === "blik" ? "Płacę BLIK-iem" : `Płacę ${formatPln(amountTotalNum)}`}
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
          </>
        );
      }
      if (kind === "blik" && selectedProvider === "paynow") {
        const digits = paynowBlikCode.replace(/\D+/g, "").slice(0, 6);
        return (
          <>
            <div className="cart-blik-field">
              <label htmlFor="order-paynow-blik-code" className="cart-blik-label">
                Kod BLIK
              </label>
              <div className="cart-blik-row">
                <input
                  id="order-paynow-blik-code"
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={digits}
                  onChange={(event) => setPaynowBlikCode(event.target.value.replace(/\D+/g, "").slice(0, 6))}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && digits.length === 6 && !retryLoading) {
                      event.preventDefault();
                      void handleStartPaynow("blik");
                    }
                  }}
                  disabled={retryLoading}
                  aria-label="6-cyfrowy kod BLIK"
                />
              </div>
            </div>
            <PaynowGdprNotice />
            {renderCta(retryLoading ? "Przetwarzamy…" : "Płacę BLIK-iem", () => void handleStartPaynow("blik"), retryLoading || digits.length !== 6)}
          </>
        );
      }
      if ((kind === "card" || kind === "wallets") && selectedProvider === "paynow") {
        return renderCta(
          retryLoading ? "Przekierowujemy…" : `Płacę ${formatPln(amountTotalNum)}`,
          () => void handleStartPaynow("card"),
          retryLoading,
          "Dane karty podasz na bezpiecznej stronie PayNow, potem wrócisz tutaj.",
        );
      }
      if (kind === "p24_transfer") {
        const viaPaynow = selectedProvider === "paynow";
        const banks = viaPaynow ? paynowBanks : p24Banks;
        const bankId = viaPaynow ? paynowBankId : p24BankId;
        return (
          <>
            <P24BankPicker
              banks={banks}
              selectedId={bankId}
              onSelect={(bank) => (viaPaynow ? setPaynowBankId(bank.id) : setP24BankId(bank.id))}
            />
            {renderCta(
              retryLoading ? "Przekierowujemy do banku…" : banks.length > 0 && !bankId ? "Wybierz swój bank" : "Płacę - przejdź do banku",
              () => void (viaPaynow ? handleStartPaynow("pbl") : handleStartP24("p24_transfer")),
              retryLoading || (banks.length > 0 && !bankId),
              "Zapłacisz na stronie swojego banku i wrócisz tutaj.",
            )}
          </>
        );
      }
      if (kind === "transfer") {
        return renderCta(
          retryLoading ? "Przygotowujemy…" : "Wybieram przelew tradycyjny",
          () => void handleSwitchTransfer(),
          retryLoading,
          "Dane do przelewu pokażemy tutaj i wyślemy e-mailem. Realizacja po zaksięgowaniu wpłaty.",
        );
      }
      if (kind === "p24_paypo") {
        return renderCta(
          retryLoading ? "Przekierowujemy do PayPo…" : "Przechodzę do wniosku online",
          () => void (selectedProvider === "paynow" ? handleStartPaynow("paypo") : handleStartP24("p24_paypo")),
          retryLoading,
          "Wniosek wypełnisz na stronie PayPo. Płacisz w ciągu 30 dni.",
        );
      }
      return renderCta(
        retryLoading ? "Przekierowujemy…" : "Przechodzę do wniosku online",
        () => void handleStartP24(kind as P24Kind),
        retryLoading,
        "Wniosek wypełnisz na stronie Przelewy24. Bank poda ostateczną ratę i RRSO.",
      );
    };

    return (
      <div className="order-page">
        <section className={`order-hero ${heroTone}`}>
          <div className="order-hero-icon" aria-hidden="true">
            {isPaid ? "✓" : isFailed || timedOut ? "!" : waiting ? <span className="order-p24-spinner" /> : "→"}
          </div>
          <div className="order-hero-copy">
            <p className="order-hero-code">
              Zamówienie {order.order_code}
              {order.crm_order_number ? ` · nr ${order.crm_order_number}` : ""}
            </p>
            <h2>{heroTitle}</h2>
            <p>{heroText}</p>
            {canPayNow && (lines.savings > 0 || freeDelivery) ? (
              <div className="order-hero-chips">
                {lines.discounts.map((d) => (
                  <span key={d.label} className="order-hero-chip">
                    {d.label} zachowany{d.amount > 0 ? ` · -${formatPln(d.amount)}` : ""}
                  </span>
                ))}
                {freeDelivery ? <span className="order-hero-chip">Dostawa gratis</span> : null}
              </div>
            ) : null}
          </div>
        </section>

        <section className="cart-basket-card order-items-card">
          <div className="cart-basket-toggle order-items-head">
            <span className="cart-basket-toggle-label">
              Twoje zamówienie
              <em>
                {lines.pieces} {plural(lines.pieces, "produkt", "produkty", "produktów")}
              </em>
            </span>
            {editHref ? (
              <Link href={editHref} className="order-items-edit" onClick={() => trackShopStep("payment_retry_edit", localCartCount > 0 ? "cart" : "restore", { order_code: orderCode })}>
                Zmień zamówienie
              </Link>
            ) : null}
          </div>
          {lines.products.length > 0 ? (
            <ul className="cart-page-items">
              {lines.products.map((item, index) => (
                <li key={`${item.slug}-${index}`} className="cart-page-item order-item">
                  <div className="cart-page-item-info">
                    <strong>{item.label}</strong>
                    {item.specs ? <span className="cart-page-item-specs">{item.specs}</span> : null}
                    {item.qty > 1 && item.total !== null ? (
                      <span className="cart-page-item-unit">{formatPln(item.total / item.qty)} / szt.</span>
                    ) : null}
                  </div>
                  <span className="order-item-qty">{item.qty} szt.</span>
                  <span className="cart-page-item-total">{item.total !== null ? formatPln(item.total) : "—"}</span>
                </li>
              ))}
            </ul>
          ) : order.summary_text ? (
            <p className="order-items-fallback">{order.summary_text}</p>
          ) : null}
          <div className="cart-summary-card-body">
            {lines.productsTotal > 0 && (lines.discounts.length > 0 || lines.charges.length > 0) ? (
              <div className="cart-page-summary-row is-muted">
                <span>Produkty</span>
                <span>{formatPln(lines.productsTotal)}</span>
              </div>
            ) : null}
            {lines.discounts.map((d) => (
              <div key={d.label} className="cart-page-summary-row is-muted">
                <span>{d.label}</span>
                <span>{d.amount > 0 ? `-${formatPln(d.amount)}` : ""}</span>
              </div>
            ))}
            {lines.charges.map((c) => (
              <div key={c.slug} className="cart-page-summary-row is-muted">
                <span>{c.label}</span>
                <span>{formatPln(c.amount)}</span>
              </div>
            ))}
            {freeDelivery ? (
              <div className="cart-page-summary-row is-muted">
                <span>Dostawa</span>
                <span>Gratis</span>
              </div>
            ) : null}
            <div className="total-block">
              <span className="total-block-left">
                <span className="total-block-label">{isPaid ? "Zapłacono" : "Do zapłaty"}</span>
                {lines.savings > 0 ? <span className="total-block-savings">Oszczędzasz {formatPln(lines.savings)}</span> : null}
              </span>
              <span className="total-block-right">
                {lines.savings > 0 ? <s>{formatPln(amountTotalNum + lines.savings)}</s> : null}
                <strong>{formatPln(amountTotalNum)}</strong>
              </span>
            </div>
            {canPayNow ? <InstallmentOffer amount={amountTotalNum} /> : null}
          </div>
        </section>

        <div className={canPayNow || waiting ? "cart-checkout-layout" : "order-status-layout"}>
          <div className="cart-checkout-left">
            {order.transfer && isTransferPending ? (
              <section className="cart-delivery-card order-transfer-card">
                <h2>Dane do przelewu</h2>
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
                    <dd>{order.transfer.amount ? `${order.transfer.amount.replace(".", ",")} ${order.transfer.currency || "PLN"}` : "—"}</dd>
                  </div>
                  <div>
                    <dt>Tytuł przelewu</dt>
                    <dd className="order-transfer-title">{order.transfer.title || order.order_code}</dd>
                  </div>
                </dl>
                <p className="order-transfer-note">
                  Przelew może iść do 2 dni roboczych. Kiedy do nas dotrze, wyślemy e-mail, że zamówienie jest w realizacji.
                </p>
              </section>
            ) : null}

            {order.estimated_completion || order.shipments.length > 0 ? (
              <section className="cart-delivery-card">
                <h2>Realizacja</h2>
                <dl className="order-facts">
                  {order.estimated_completion ? (
                    <div>
                      <dt>Planowany termin</dt>
                      <dd>
                        {order.estimated_completion}
                        <small>Termin orientacyjny według planu produkcji - może się przesunąć.</small>
                      </dd>
                    </div>
                  ) : null}
                  {order.shipments.map((shipment, index) => (
                    <div key={`${shipment.tracking_number}-${index}`}>
                      <dt>Przesyłka{shipment.carrier ? ` · ${shipment.carrier}` : ""}</dt>
                      <dd>
                        {shipment.tracking_link ? (
                          <a href={shipment.tracking_link} target="_blank" rel="noopener noreferrer">
                            {shipment.tracking_number} - śledź przesyłkę
                          </a>
                        ) : (
                          shipment.tracking_number
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ) : null}

            <section className="cart-delivery-card">
              <h2>Dostawa i dane</h2>
              <dl className="order-facts">
                {note.delivery ? (
                  <div>
                    <dt>Dostawa</dt>
                    <dd>
                      {note.delivery}
                      {note.paczkomat ? <small>{note.paczkomat}</small> : null}
                    </dd>
                  </div>
                ) : null}
                {order.customer_name ? (
                  <div>
                    <dt>Odbiorca</dt>
                    <dd>
                      {order.customer_name}
                      {order.customer_phone || order.customer_email ? (
                        <small>{[order.customer_phone, order.customer_email].filter(Boolean).join(" · ")}</small>
                      ) : null}
                    </dd>
                  </div>
                ) : null}
                {order.shipping_address_line_1 && !note.paczkomat ? (
                  <div>
                    <dt>Adres</dt>
                    <dd>
                      {[order.shipping_address_line_1, order.shipping_address_line_2].filter(Boolean).join(", ")}
                      <small>{formatPostcode(order.shipping_postcode)} {order.shipping_city}</small>
                    </dd>
                  </div>
                ) : null}
                {isPaid && order.payment_method_label ? (
                  <div>
                    <dt>Płatność</dt>
                    <dd>{order.payment_method_label}</dd>
                  </div>
                ) : null}
                {order.invoice_required ? (
                  <div>
                    <dt>Faktura VAT</dt>
                    <dd>{order.invoice_issued ? "wystawiona" : "w przygotowaniu"}</dd>
                  </div>
                ) : null}
                {note.remark ? (
                  <div>
                    <dt>Uwagi</dt>
                    <dd>{note.remark}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            {canPayNow ? <CartTrustBlock /> : null}

            <p className="order-help">
              {canPayNow ? "Płatność nie chce przejść? " : "Pytania o zamówienie? "}
              {siteContact.phone ? (
                <>
                  Zadzwoń: <a href={`tel:${siteContact.phone.replace(/\s+/g, "")}`}>{siteContact.phone}</a>
                </>
              ) : null}
              {siteContact.phone && siteContact.email ? " albo napisz: " : null}
              {siteContact.email ? <a href={`mailto:${siteContact.email}`}>{siteContact.email}</a> : null}
              {siteContact.hours ? <span className="order-help-hours"> ({siteContact.hours})</span> : null}
            </p>
          </div>

          {canPayNow || waiting ? (
            <aside className="cart-checkout-right">
              <section className="cart-payment-card">
                <div className="cart-payment-card-head">
                  <h2>Płatność</h2>
                  <span className="cart-payment-due">
                    <span className="cart-payment-due-label">Do zapłaty</span>
                    <strong>{formatPln(amountTotalNum)}</strong>
                  </span>
                </div>
                {waiting ? (
                  <div className="order-p24-waiting">
                    <span className="order-p24-spinner" aria-hidden="true" />
                    <span>Czekamy na potwierdzenie z banku - zwykle kilka sekund.</span>
                  </div>
                ) : null}
                {canPayNow ? (
                  <>
                    <p className="cart-payment-method-badge">Sposób płatności</p>
                    <div className="cart-pay-tiles" role="radiogroup" aria-label="Sposób płatności">
                      {paymentTiles.map((tile) => {
                        const active = paymentKind === tile.kind;
                        return (
                          <div key={tile.kind} className={`cart-pay-tile-group ${active ? "is-active" : ""}`}>
                            <label className={`cart-pay-tile ${active ? "is-active" : ""} ${tile.wide ? "is-wide" : ""}`}>
                              <input
                                type="radio"
                                name="order-payment-kind"
                                value={tile.kind}
                                checked={active}
                                onChange={() => {
                                  setPaymentKind(tile.kind);
                                  setRetryError("");
                                  trackShopStep("payment_retry_kind", tile.kind, { order_code: orderCode });
                                }}
                                disabled={retryLoading}
                              />
                              {tile.logo}
                              <span className="cart-pay-tile-copy">
                                <strong>{tile.title}</strong>
                                {tile.hint ? <small>{tile.hint}</small> : null}
                              </span>
                              <span className="cart-pay-tile-check" aria-hidden="true" />
                            </label>
                            {active ? <div className="cart-pay-tile-panel">{renderRetryPanel(tile.kind)}</div> : null}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </section>
            </aside>
          ) : null}
        </div>

        <Link href="/" className="cart-thankyou-back order-back">
          ← Wróć do sklepu
        </Link>
      </div>
    );
  }

  return (
    <section className="cart-delivery-card order-verify">
      <h2>Sprawdź swoje zamówienie</h2>
      <p>Wpisz numer telefonu albo e-mail, które podałeś przy zamówieniu {orderCode}.</p>
      {error ? <div className="cart-checkout-error">{error}</div> : null}
      <form className="order-verify-form" onSubmit={handleSubmit}>
        <label>
          Telefon lub e-mail
          <input
            value={verifier}
            onChange={(event) => setVerifier(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <button type="submit" className="cart-page-checkout-cta" disabled={isSubmitting}>
          {isSubmitting ? "Sprawdzamy…" : "Pokaż zamówienie"}
        </button>
      </form>
    </section>
  );
}

// ----- pozycje zamówienia z zapisanej wyceny -----

const DISCOUNT_SLUGS = new Set(["rabat", "rabat-ratunek", "oszczednosc-obwod-moskitiery"]);
// Te produkty da się odtworzyć w koszyku z wyceny bez utraty danych
// (lib/rescue.ts -> mapQuoteToResumeState).
const RESTORABLE_SLUGS = new Set(["moskitiery-ramkowe", "plisy"]);

type OrderProductLine = { slug: string; label: string; specs: string; qty: number; total: number | null };
type OrderLines = {
  products: OrderProductLine[];
  discounts: { label: string; amount: number }[];
  charges: { slug: string; label: string; amount: number }[];
  productsTotal: number;
  savings: number;
  pieces: number;
};

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(String(value).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function splitOrderLines(order: PublicOrder): OrderLines {
  const payload = (order.payload || {}) as { quote?: { payload?: { positions?: unknown[] }; positions?: unknown[] } };
  const nested = payload.quote?.payload?.positions;
  const raw = (Array.isArray(nested) && nested.length ? nested : payload.quote?.positions || []) as Array<Record<string, unknown>>;
  const out: OrderLines = { products: [], discounts: [], charges: [], productsTotal: 0, savings: 0, pieces: 0 };
  for (const p of raw) {
    if (!p || typeof p !== "object") continue;
    const slug = String(p.product_slug || "");
    const summary = String(p.summary || "").trim();
    const total = toNumber(p.total_amount);
    if (DISCOUNT_SLUGS.has(slug)) {
      // "Kod rabatowy SEZON20 (-81,90 zł)" -> etykieta + kwota
      const match = summary.match(/^(.*?)\s*\(\s*-?\s*([\d\s]+,\d{2})\s*zł\s*\)\s*$/);
      const amount = match ? Number(match[2].replace(/\s+/g, "").replace(",", ".")) : 0;
      out.discounts.push({ label: match ? match[1] : summary, amount });
      out.savings += amount;
      continue;
    }
    if (NON_PRODUCT_POSITION_SLUGS.has(slug)) {
      if (total && total > 0) out.charges.push({ slug, label: String(p.product_label || summary), amount: total });
      continue;
    }
    const rows = Array.isArray(p.summary_rows) ? (p.summary_rows as Array<{ label?: string; value?: string }>) : [];
    const specs = rows
      .filter((r) => r && r.label && r.value && r.label !== "Ilość")
      .map((r) => (r.label === "Rozmiar" ? String(r.value) : `${r.label}: ${r.value}`))
      .join(" · ");
    const qty = Math.max(1, Number(p.quantity) || 1);
    out.products.push({ slug, label: String(p.product_label || "Produkt"), specs, qty, total });
    out.pieces += qty;
    if (total) out.productsTotal += total;
  }
  return out;
}

/** note_text z koszyka: "Metoda dostawy: …", "Paczkomat: …", "Metoda płatności: …"
 * i ewentualne uwagi klienta - każde w swoim akapicie. */
function parseOrderNote(noteText: string): { delivery: string; paczkomat: string; remark: string } {
  const result = { delivery: "", paczkomat: "", remark: "" };
  const remarks: string[] = [];
  for (const block of String(noteText || "").split(/\n{2,}/)) {
    const text = block.trim();
    if (!text) continue;
    if (/^Metoda dostawy:/i.test(text)) result.delivery = text.replace(/^Metoda dostawy:\s*/i, "");
    else if (/^Paczkomat:/i.test(text)) result.paczkomat = text;
    else if (/^Metoda p[łl]atno[śs]ci:/i.test(text)) continue;
    else remarks.push(text);
  }
  result.remark = remarks.join("\n");
  return result;
}

function formatPostcode(postcode: string): string {
  return String(postcode || "").replace(/^(\d{2})(\d{3})$/, "$1-$2");
}

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}
