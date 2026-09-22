"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";
import { formatPhoneInput, isValidPhone, phoneError } from "@/lib/phone";
import {
  P24BankPicker,
  PaymentMethodTiles,
  buildPaymentTiles,
  usePaymentSettings,
  type P24Kind,
  type PaymentKind,
} from "@/app/components/payment-methods";
import { trackShopStep } from "@/lib/track-step";

// Panel klienta "Moje zamówienia".
//
// Logowanie numerem telefonu (właściciel, 2026-09-23):
//   numer -> [hasło]            gdy konto ma już hasło,
//   numer -> [kod SMS] -> hasło gdy to pierwsze logowanie albo reset.
// Token sesji wraca w ciasteczku httpOnly (/api/account), więc tutaj nie ma
// go w ogóle - wystarczy, że kolejne zapytania idą z credentials.

type AccountOrder = {
  order_code: string;
  crm_order_number?: string;
  product_label?: string;
  friendly_status?: string;
  status?: string;
  payment_status?: string;
  payment_provider?: string;
  amount_total?: string | null;
  currency?: string;
  created_at?: string;
  paid_at?: string;
  shipping_city?: string;
  shipping_postcode?: string;
  note_text?: string;
  summary_text?: string;
  access_token?: string;
  can_pay_online?: boolean;
  shipments?: { carrier?: string; tracking_number?: string; tracking_link?: string }[];
  estimated_completion?: string;
};

type Step = "phone" | "password" | "code" | "setPassword" | "panel";

const PAYMENT_LABELS: Record<string, string> = {
  paid: "Opłacone",
  cod_pending: "Za pobraniem",
  transfer_pending: "Czeka na przelew",
  transfer_cancelled: "Anulowane - brak wpłaty",
  requires_payment: "Nieopłacone",
  failed: "Nieudana płatność",
  canceled: "Anulowana",
  pending: "Oczekuje",
};

function formatDate(value?: string): string {
  if (!value) return "";
  const date = new Date(value.replace(" ", "T"));
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("pl-PL", { day: "2-digit", month: "long", year: "numeric" });
}

function formatAmount(order: AccountOrder): string {
  if (!order.amount_total) return "—";
  return `${String(order.amount_total).replace(".", ",")} ${order.currency || "PLN"}`;
}

export default function AccountPanel() {
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [phoneMasked, setPhoneMasked] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [code, setCode] = useState("");
  const [verificationToken, setVerificationToken] = useState("");
  const [setupToken, setSetupToken] = useState("");
  const [needsTerms, setNeedsTerms] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [isResetFlow, setIsResetFlow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [orders, setOrders] = useState<AccountOrder[]>([]);
  const [payFor, setPayFor] = useState<string>("");
  const [payKind, setPayKind] = useState<PaymentKind>("p24_transfer");
  const [p24BankId, setP24BankId] = useState(0);
  const codeInputRef = useRef<HTMLInputElement | null>(null);
  const passwordInputRef = useRef<HTMLInputElement | null>(null);
  const { p24Settings, p24Banks } = usePaymentSettings();

  // Płatność z panelu idzie przez Przelewy24 (niższa prowizja niż karty) -
  // pokazujemy tylko kafelki P24 włączone w CRM.
  const payTiles = useMemo(
    () => buildPaymentTiles({ stripeAvailable: false, p24Settings, transferEnabled: false }),
    [p24Settings],
  );

  const call = useCallback(async (action: string, payload: Record<string, unknown> = {}) => {
    const response = await fetch("/api/account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, ...payload }),
    });
    const json = (await response.json().catch(() => ({ ok: false, error: "Błąd połączenia." }))) as Record<
      string,
      unknown
    > & { ok?: boolean; error?: string };
    return { status: response.status, json };
  }, []);

  const loadOrders = useCallback(async () => {
    const { json } = await call("orders");
    if (json.ok && Array.isArray(json.orders)) {
      setOrders(json.orders as AccountOrder[]);
      if (typeof json.masked_phone === "string") setPhoneMasked(json.masked_phone);
      setStep("panel");
      return true;
    }
    return false;
  }, [call]);

  // Wracający klient z ważną sesją wchodzi prosto na listę zamówień.
  useEffect(() => {
    void loadOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
    if (step === "password") passwordInputRef.current?.focus();
  }, [step]);

  async function handlePhoneNext() {
    const problem = phoneError(phone);
    if (problem) {
      setError(problem);
      return;
    }
    setBusy(true);
    setError("");
    setInfo("");
    const { json } = await call("start", { phone });
    setBusy(false);
    if (!json.ok) {
      setError(json.error || "Nie udało się sprawdzić numeru.");
      return;
    }
    setPhoneMasked(String(json.masked_phone || ""));
    trackShopStep("account_start", json.has_password ? "password" : "sms");
    if (json.has_password) {
      setStep("password");
      return;
    }
    await sendCode("register");
  }

  async function sendCode(purpose: "register" | "reset") {
    setBusy(true);
    setError("");
    const { json } = await call("code_send", { phone, purpose });
    setBusy(false);
    if (!json.ok) {
      setError(json.error || "Nie udało się wysłać kodu.");
      return;
    }
    setVerificationToken(String(json.verification_token || ""));
    setPhoneMasked(String(json.masked_phone || phoneMasked));
    setIsResetFlow(purpose === "reset");
    setCode("");
    setInfo(`Wysłaliśmy SMS z kodem na ${json.masked_phone || "Twój numer"}. Kod jest ważny 10 minut.`);
    setStep("code");
  }

  async function handleLogin() {
    if (!password) {
      setError("Wpisz hasło.");
      return;
    }
    setBusy(true);
    setError("");
    const { json } = await call("login", { phone, password });
    setBusy(false);
    if (!json.ok) {
      setError(json.error || "Nie udało się zalogować.");
      return;
    }
    setPassword("");
    trackShopStep("account_login", "ok");
    await loadOrders();
  }

  async function handleCodeVerify() {
    const digits = code.replace(/\D+/g, "");
    if (digits.length !== 6) {
      setError("Wpisz 6-cyfrowy kod z SMS-a.");
      return;
    }
    setBusy(true);
    setError("");
    const { json } = await call("code_verify", { phone, verification_token: verificationToken, code: digits });
    setBusy(false);
    if (!json.ok) {
      setError(json.error || "Niepoprawny kod.");
      return;
    }
    setSetupToken(String(json.setup_token || ""));
    setNeedsTerms(json.needs_terms !== false);
    setPassword("");
    setPassword2("");
    setInfo(isResetFlow ? "Kod poprawny - ustaw nowe hasło." : "Kod poprawny - ustaw hasło do swojego konta.");
    setStep("setPassword");
  }

  async function handlePasswordSet() {
    if (password.length < 8) {
      setError("Hasło musi mieć co najmniej 8 znaków.");
      return;
    }
    if (password !== password2) {
      setError("Hasła nie są takie same.");
      return;
    }
    if (needsTerms && !termsAccepted) {
      setError("Zaakceptuj regulamin konta klienta.");
      return;
    }
    setBusy(true);
    setError("");
    const { json } = await call("password_set", {
      phone,
      setup_token: setupToken,
      password,
      terms_accepted: termsAccepted || !needsTerms,
    });
    setBusy(false);
    if (!json.ok) {
      setError(json.error || "Nie udało się ustawić hasła.");
      return;
    }
    setPassword("");
    setPassword2("");
    trackShopStep("account_register", isResetFlow ? "reset" : "new");
    await loadOrders();
  }

  async function handleLogout() {
    await call("logout");
    setOrders([]);
    setStep("phone");
    setPassword("");
    setInfo("Wylogowano.");
  }

  async function handlePayP24(order: AccountOrder) {
    if (!order.access_token) return;
    setBusy(true);
    setError("");
    const kind = (payKind.startsWith("p24_") ? payKind : "p24_transfer") as P24Kind;
    const methodKind = kind === "p24_transfer" ? "transfer" : kind === "p24_paypo" ? "paypo" : "installments";
    try {
      const response = await fetch(`/api/orders/${encodeURIComponent(order.order_code)}/p24-start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          access_token: order.access_token,
          method_kind: methodKind,
          ...(kind === "p24_transfer" && p24BankId ? { method_id: p24BankId } : {}),
          regulation_accept: true,
        }),
      });
      const json = (await response.json()) as { ok?: boolean; redirect_url?: string; error?: string };
      if (!json.ok || !json.redirect_url) {
        throw new Error(json.error || "Nie udało się uruchomić płatności.");
      }
      trackShopStep("account_pay", methodKind, { order_code: order.order_code });
      window.location.assign(json.redirect_url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Nie udało się uruchomić płatności.");
      setBusy(false);
    }
  }

  const phoneValid = isValidPhone(phone);

  if (step === "panel") {
    return (
      <section className={styles.orderCard}>
        <div className={styles.orderMeta}>
          <div>
            Zalogowano jako <strong>{phoneMasked}</strong>
          </div>
          <div>
            <button type="button" className="account-link" onClick={handleLogout}>
              Wyloguj
            </button>
          </div>
        </div>
        <h2>Twoje zamówienia ({orders.length})</h2>
        {error ? <div className={styles.errorBox}>{error}</div> : null}
        {orders.length === 0 ? (
          <p className={styles.sectionIntro}>Nie mamy jeszcze zamówień przypisanych do tego numeru.</p>
        ) : null}

        <div className="account-orders">
          {orders.map((order) => {
            const paid = order.payment_status === "paid" || Boolean(order.paid_at);
            return (
              <article key={order.order_code} className="account-order">
                <header className="account-order-head">
                  <div>
                    <strong>{order.crm_order_number ? `Zamówienie ${order.crm_order_number}` : `Zamówienie ${order.order_code}`}</strong>
                    <small>
                      {formatDate(order.created_at)} · {order.product_label || "Zamówienie"}
                    </small>
                  </div>
                  <span className={`account-order-badge ${paid ? "is-paid" : "is-unpaid"}`}>
                    {PAYMENT_LABELS[order.payment_status || ""] || order.payment_status || "—"}
                  </span>
                </header>

                <dl className="account-order-grid">
                  <div>
                    <dt>Status</dt>
                    <dd>{order.friendly_status || "—"}</dd>
                  </div>
                  <div>
                    <dt>Kwota</dt>
                    <dd>{formatAmount(order)}</dd>
                  </div>
                  {order.estimated_completion ? (
                    <div>
                      <dt>Szacowany termin</dt>
                      <dd>{order.estimated_completion}</dd>
                    </div>
                  ) : null}
                  {order.shipping_city ? (
                    <div>
                      <dt>Dostawa</dt>
                      <dd>
                        {order.shipping_postcode} {order.shipping_city}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {order.summary_text ? <p className="account-order-summary">{order.summary_text}</p> : null}

                {order.shipments?.length ? (
                  <ul className="account-order-shipments">
                    {order.shipments.map((shipment, index) => (
                      <li key={`${shipment.tracking_number}-${index}`}>
                        {shipment.carrier ? `${shipment.carrier} · ` : ""}
                        {shipment.tracking_link ? (
                          <a href={shipment.tracking_link} target="_blank" rel="noopener noreferrer">
                            {shipment.tracking_number} - śledź przesyłkę
                          </a>
                        ) : (
                          shipment.tracking_number
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}

                <div className="account-order-actions">
                  <Link
                    href={`/zamowienie/${encodeURIComponent(order.order_code)}?access_token=${encodeURIComponent(order.access_token || "")}`}
                    className="account-link"
                  >
                    Szczegóły zamówienia
                  </Link>
                  {order.can_pay_online && payTiles.length ? (
                    <button
                      type="button"
                      className={styles.ctaButton}
                      onClick={() => {
                        setPayFor(payFor === order.order_code ? "" : order.order_code);
                        setPayKind(payTiles[0].kind);
                        setError("");
                      }}
                    >
                      {payFor === order.order_code ? "Ukryj płatność" : "Zapłać przez Przelewy24"}
                    </button>
                  ) : null}
                </div>

                {payFor === order.order_code ? (
                  <div className="account-order-pay">
                    <p className={styles.sectionIntro}>
                      Płatność obsługuje Przelewy24. Wybierz sposób, a przeniesiemy Cię prosto do banku.
                    </p>
                    {payTiles.length > 1 ? (
                      <PaymentMethodTiles
                        tiles={payTiles}
                        selected={payKind}
                        onSelect={(kind) => setPayKind(kind)}
                        disabled={busy}
                        name={`pay-kind-${order.order_code}`}
                      />
                    ) : null}
                    {payKind === "p24_transfer" ? (
                      <P24BankPicker banks={p24Banks} selectedId={p24BankId} onSelect={(bank) => setP24BankId(bank.id)} />
                    ) : null}
                    <button
                      type="button"
                      className={styles.ctaButton}
                      disabled={busy || (payKind === "p24_transfer" && p24Banks.length > 0 && !p24BankId)}
                      onClick={() => void handlePayP24(order)}
                    >
                      {busy
                        ? "Przekierowujemy…"
                        : payKind === "p24_transfer" && p24Banks.length > 0 && !p24BankId
                          ? "Wybierz swój bank"
                          : `Zapłać ${formatAmount(order)}`}
                    </button>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>
    );
  }

  return (
    <section className={styles.verifyCard}>
      <h2>Moje zamówienia</h2>
      <p className={styles.sectionIntro}>
        {step === "phone"
          ? "Podaj numer telefonu, na który składałeś zamówienie - resztę podpowiemy."
          : step === "password"
            ? `Numer ${phoneMasked} mamy w systemie. Wpisz hasło do swojego konta.`
            : step === "code"
              ? `Wpisz kod, który wysłaliśmy SMS-em na ${phoneMasked}.`
              : "Ustaw hasło, którym będziesz się logować."}
      </p>

      {info ? <div className={styles.noticeBox}>{info}</div> : null}
      {error ? <div className={styles.errorBox}>{error}</div> : null}

      {step === "phone" ? (
        <form
          className={styles.formGrid}
          onSubmit={(event) => {
            event.preventDefault();
            void handlePhoneNext();
          }}
        >
          <label className={styles.field}>
            Numer telefonu
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              name="phone"
              value={phone}
              placeholder="790 215 251"
              onChange={(event) => {
                setPhone(formatPhoneInput(event.target.value));
                setError("");
              }}
              onBlur={() => {
                const problem = phoneError(phone);
                if (phone && problem) setError(problem);
              }}
              required
            />
            <small>Wpisz numer w dowolnej postaci - z +48, zerem czy spacjami. Rozpoznamy go tak samo.</small>
          </label>
          <button type="submit" className={styles.ctaButton} disabled={busy || !phoneValid}>
            {busy ? "Sprawdzamy…" : "Dalej"}
          </button>
        </form>
      ) : null}

      {step === "password" ? (
        <form
          className={styles.formGrid}
          onSubmit={(event) => {
            event.preventDefault();
            void handleLogin();
          }}
        >
          <label className={styles.field}>
            Hasło
            <input
              ref={passwordInputRef}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              required
            />
          </label>
          <button type="submit" className={styles.ctaButton} disabled={busy}>
            {busy ? "Logujemy…" : "Zaloguj się"}
          </button>
          <div className="account-links">
            <button type="button" className="account-link" onClick={() => void sendCode("reset")} disabled={busy}>
              Nie pamiętam hasła
            </button>
            <button
              type="button"
              className="account-link"
              onClick={() => {
                setStep("phone");
                setError("");
                setInfo("");
              }}
            >
              Zmień numer
            </button>
          </div>
        </form>
      ) : null}

      {step === "code" ? (
        <form
          className={styles.formGrid}
          onSubmit={(event) => {
            event.preventDefault();
            void handleCodeVerify();
          }}
        >
          <label className={styles.field}>
            Kod z SMS-a
            <input
              ref={codeInputRef}
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              placeholder="000000"
              onChange={(event) => {
                setCode(event.target.value.replace(/\D+/g, "").slice(0, 6));
                setError("");
              }}
              required
            />
          </label>
          <button type="submit" className={styles.ctaButton} disabled={busy || code.replace(/\D+/g, "").length !== 6}>
            {busy ? "Sprawdzamy…" : "Dalej"}
          </button>
          <div className="account-links">
            <button
              type="button"
              className="account-link"
              onClick={() => void sendCode(isResetFlow ? "reset" : "register")}
              disabled={busy}
            >
              Wyślij kod ponownie
            </button>
            <button
              type="button"
              className="account-link"
              onClick={() => {
                setStep("phone");
                setError("");
                setInfo("");
              }}
            >
              Zmień numer
            </button>
          </div>
        </form>
      ) : null}

      {step === "setPassword" ? (
        <form
          className={styles.formGrid}
          onSubmit={(event) => {
            event.preventDefault();
            void handlePasswordSet();
          }}
        >
          <label className={styles.field}>
            Nowe hasło
            <input
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value);
                setError("");
              }}
              required
            />
            <small>Minimum 8 znaków.</small>
          </label>
          <label className={styles.field}>
            Powtórz hasło
            <input
              type="password"
              autoComplete="new-password"
              value={password2}
              onChange={(event) => {
                setPassword2(event.target.value);
                setError("");
              }}
              required
            />
          </label>
          {needsTerms ? (
            <label className="account-terms">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => {
                  setTermsAccepted(event.target.checked);
                  setError("");
                }}
              />
              <span>
                Akceptuję{" "}
                <Link href="/regulamin-konta" target="_blank" rel="noopener noreferrer">
                  regulamin konta klienta
                </Link>{" "}
                i{" "}
                <Link href="/legal/prywatnosc" target="_blank" rel="noopener noreferrer">
                  politykę prywatności
                </Link>
                .
              </span>
            </label>
          ) : null}
          <button type="submit" className={styles.ctaButton} disabled={busy}>
            {busy ? "Zapisujemy…" : "Zapisz hasło i zaloguj"}
          </button>
        </form>
      ) : null}
    </section>
  );
}
