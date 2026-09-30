"use client";

import React, { useEffect, useState } from "react";
import InstallmentTileHint from "./installment-tile-hint";
import { crmGetJson } from "@/lib/crm-get";
import { installmentsAvailable } from "@/lib/installments";
import type { StripeMethod } from "./stripe-method-step";

// Jedno źródło kafelków płatności dla całego sklepu: koszyk (/koszyk) i
// ponowienie płatności (/zamowienie/[kod]). Wcześniej strona zamówienia
// miała własny, uboższy zestaw (Payment Element z kartą/BLIK-iem albo lista
// rodzajów P24 bez wyboru banku), więc klient po nieudanej płatności widział
// coś innego niż w koszyku - właściciel, 2026-09-22: „ujednolić metody
// płatności”.

export type P24Kind = "p24_transfer" | "p24_installments" | "p24_paypo";
export type PaymentKind = StripeMethod | P24Kind | "transfer";
export type P24Bank = { id: number; name: string; img: string };

// Routing operatorów (CRM → Sklep WWW → Płatności, od 2026-09-30): dla
// każdej "logicznej" metody CRM mówi, czy jest włączona i który operator ją
// obsługuje. NIE zastępuje PaymentKind (etykiety/kafelki w koszyku zostają
// identyczne) - to dodatkowa warstwa, która mówi call-siteom (koszyk,
// ponowienie płatności) dokąd wysłać żądanie startu płatności. Metoda
// "blik"/"card"/"wallets" może iść przez stripe ALBO paynow; "p24_transfer"
// (kafelek "Przelew online") może iść przez p24 ALBO paynow mimo nazwy
// kind - nazwa kind zostaje nietknięta (żeby nie robić masowej zmiany), tylko
// faktyczny operator się zmienia.
export type PaymentRoutingMethod = "blik" | "card" | "wallets" | "transfer" | "installments" | "paypo" | "bank_transfer";
export type PaymentProvider = "stripe" | "p24" | "paynow";
export type PaymentRouting = Partial<Record<PaymentRoutingMethod, { enabled: boolean; provider?: PaymentProvider }>>;

/** Operator faktycznie obsługujący daną metodę, z bezpiecznym fallbackiem na
 * "jak dziś" gdy CRM jeszcze nie zwraca routingu (starsza wersja configu) -
 * dzięki temu front nigdy nie wysyła płatności donikąd. */
export function resolveProvider(
  routing: PaymentRouting | undefined,
  method: PaymentRoutingMethod,
  fallback: PaymentProvider,
): PaymentProvider {
  const row = routing?.[method];
  return row?.provider ?? fallback;
}

export type TransferSettings = {
  enabled: boolean;
  accountHolder: string;
  accountNumber: string;
  bankName: string;
  holderAddress: string;
};
export type P24Settings = { enabled: boolean; transfer: boolean; installments: boolean; paypo: boolean };

export const P24_KIND_LABELS: Record<P24Kind, { label: string; note: string }> = {
  p24_transfer: { label: "Przelew online (Przelewy24)", note: "p24_transfer" },
  p24_installments: { label: "Raty (Przelewy24)", note: "p24_installments" },
  p24_paypo: { label: "PayPo - kup teraz, zapłać później", note: "p24_paypo" },
};

export const CRM_PUBLIC_BASE = "https://crm-keika.groovemedia.pl/biuro/api/shop-public";

export const EMPTY_TRANSFER_SETTINGS: TransferSettings = {
  enabled: false,
  accountHolder: "",
  accountNumber: "",
  bankName: "",
  holderAddress: "",
};

/** Ustawienia płatności z CRM (te same, którymi steruje biuro w panelu). */
export function usePaymentSettings() {
  const [transferSettings, setTransferSettings] = useState<TransferSettings>(EMPTY_TRANSFER_SETTINGS);
  const [p24Settings, setP24Settings] = useState<P24Settings>({
    enabled: false,
    transfer: false,
    installments: false,
    paypo: false,
  });
  const [p24Banks, setP24Banks] = useState<P24Bank[]>([]);
  const [paynowBanks, setPaynowBanks] = useState<P24Bank[]>([]);
  const [paynowEnabled, setPaynowEnabled] = useState(false);
  const [paymentRouting, setPaymentRouting] = useState<PaymentRouting>({});
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState<string | null>(null);

  useEffect(() => {
    crmGetJson<any>(`${CRM_PUBLIC_BASE}/site`)
      .then((json) => {
        const checkout = json?.checkout && typeof json.checkout === "object" ? json.checkout : null;
        if (!checkout) return;
        const accountNumber =
          typeof checkout.transfer_account_number === "string" ? checkout.transfer_account_number.trim() : "";
        setTransferSettings({
          enabled: checkout.transfer_enabled === true && accountNumber !== "",
          accountHolder: typeof checkout.transfer_account_holder === "string" ? checkout.transfer_account_holder : "",
          accountNumber,
          bankName: typeof checkout.transfer_bank_name === "string" ? checkout.transfer_bank_name : "",
          holderAddress: typeof checkout.transfer_holder_address === "string" ? checkout.transfer_holder_address : "",
        });
        setP24Settings({
          enabled: checkout.p24_enabled === true,
          transfer: checkout.p24_transfer_enabled === true,
          installments: checkout.p24_installments_enabled === true,
          paypo: checkout.p24_paypo_enabled === true,
        });
        setPaynowEnabled(checkout.paynow_enabled === true);
        setPaymentRouting(
          checkout.payment_routing && typeof checkout.payment_routing === "object" ? checkout.payment_routing : {},
        );
        setDefaultPaymentMethod(typeof checkout.default_payment_method === "string" ? checkout.default_payment_method : null);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${CRM_PUBLIC_BASE}/p24_banks`)
      .then((response) => response.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.banks)) {
          setP24Banks(
            json.banks
              .map((bank: Record<string, unknown>) => ({
                id: Number(bank.id) || 0,
                name: typeof bank.name === "string" ? bank.name : "",
                img: typeof bank.img === "string" ? bank.img : "",
              }))
              .filter((bank: P24Bank) => bank.id > 0 && bank.name),
          );
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch(`${CRM_PUBLIC_BASE}/paynow_banks`)
      .then((response) => response.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.banks)) {
          setPaynowBanks(
            json.banks
              .map((bank: Record<string, unknown>) => ({
                id: Number(bank.id) || 0,
                name: typeof bank.name === "string" ? bank.name : "",
                img: typeof bank.img === "string" ? bank.img : "",
              }))
              .filter((bank: P24Bank) => bank.id > 0 && bank.name),
          );
        }
      })
      .catch(() => {});
  }, []);

  return {
    transferSettings,
    p24Settings,
    p24Banks,
    paynowBanks,
    paynowEnabled,
    paymentRouting,
    defaultPaymentMethod,
  };
}

export function p24KindAvailable(settings: P24Settings, kind: P24Kind): boolean {
  if (!settings.enabled) return false;
  if (kind === "p24_transfer") return settings.transfer;
  if (kind === "p24_installments") return settings.installments;
  return settings.paypo;
}

export type PaymentTile = {
  kind: PaymentKind;
  title: string;
  /** JSX, bo PayPo i Raty niosą konkret (kwotę raty, "Zapłać za 30 dni"). */
  hint: React.ReactNode;
  logo: React.ReactNode;
  wide?: boolean;
  /** Operator faktycznie obsługujący ten kafelek (patrz resolveProvider) -
   * tylko dla blik/card/wallets/p24_transfer; brak dla stałych metod
   * (p24_installments/p24_paypo/transfer). */
  provider?: PaymentProvider;
};

const LOGO_BLIK = <span className="cart-pay-logo cart-pay-logo--blik">blik</span>;
const LOGO_P24 = (
  <span className="cart-pay-logo cart-pay-logo--p24">
    Przelewy<em>24</em>
  </span>
);
const LOGO_CARD = (
  <span className="cart-pay-logo cart-pay-logo--card">
    <span className="cart-pay-visa">VISA</span>
    <span className="cart-pay-mc" aria-hidden="true">
      <i />
      <i />
    </span>
  </span>
);
const LOGO_PAYPO = <span className="cart-pay-logo cart-pay-logo--paypo">PayPo</span>;
const LOGO_WALLETS = (
  <span className="cart-pay-logo cart-pay-logo--wallets">
    <span className="cart-pay-gpay">
      <b>G</b> Pay
    </span>
    <span className="cart-pay-applepay">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M16.7 12.6c0-2.4 2-3.5 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.2-.8-1.6 0-3.1.9-4 2.4-1.7 2.9-.4 7.3 1.2 9.7.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.2-.8s1.9.8 3.2.8c1.3 0 2.2-1.2 3-2.4.9-1.4 1.3-2.7 1.3-2.8 0 0-2.6-1-2.6-3.9zM14.3 5.5c.7-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.2 1.8-1 2.9 1.1.1 2.2-.5 2.8-1.3z"
        />
      </svg>
      Pay
    </span>
  </span>
);
const LOGO_BANK = (
  <span className="cart-pay-logo cart-pay-logo--bank" aria-hidden="true">
    <svg viewBox="0 0 24 24">
      <path
        d="M3 10h18M5 10v8M9 10v8M15 10v8M19 10v8M3 18h18M12 3 3 8h18l-9-5z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </span>
);

/** Kolejność kafelków jest wspólna dla koszyka i ponowienia płatności.
 * `routing` (opcjonalny, z CRM) mówi który operator faktycznie obsłuży
 * blik/card/wallets/p24_transfer - kafelki, etykiety i kolejność zostają
 * identyczne niezależnie od operatora (właściciel, 2026-09-30: "po stronie
 * klienta nic nie zmieniamy"), tylko `PaymentTile.provider` się zmienia, żeby
 * call-site wiedział dokąd wysłać żądanie startu płatności. */
export function buildPaymentTiles(options: {
  stripeAvailable: boolean;
  p24Settings: P24Settings;
  transferEnabled: boolean;
  /** Kwota do zapłaty (zł) - pozwala pokazać konkretną ratę na kafelku. */
  amount?: number;
  /** Ponowienie płatności: przelew tradycyjny ma sens tylko zanim zamówienie
   * trafi do realizacji (CRM odrzuci zmianę przyjętego zamówienia). */
  allowTransfer?: boolean;
  routing?: PaymentRouting;
}): PaymentTile[] {
  const { stripeAvailable, p24Settings, transferEnabled, allowTransfer = true, amount = 0, routing } = options;
  const blikRow = routing?.blik;
  const cardRow = routing?.card;
  const walletsRow = routing?.wallets;
  const transferRow = routing?.transfer;
  const paypoRow = routing?.paypo;
  const blikProvider = resolveProvider(routing, "blik", "stripe");
  const cardProvider = resolveProvider(routing, "card", "stripe");
  const walletsProvider = resolveProvider(routing, "wallets", "stripe");
  // CRM nie widzi kluczy Stripe (żyją tutaj) - metoda przez Stripe tylko,
  // gdy sklep faktycznie ma klucz publiczny.
  const stripeOk = (provider: PaymentProvider) => provider !== "stripe" || stripeAvailable;
  const blikEnabled = (blikRow ? blikRow.enabled : stripeAvailable) && stripeOk(blikProvider);
  const cardEnabled = (cardRow ? cardRow.enabled : stripeAvailable) && stripeOk(cardProvider);
  const walletsEnabled = (walletsRow ? walletsRow.enabled : stripeAvailable) && stripeOk(walletsProvider);
  const onlineTransferEnabled = transferRow ? transferRow.enabled : p24KindAvailable(p24Settings, "p24_transfer");
  const paypoEnabled = paypoRow ? paypoRow.enabled : p24KindAvailable(p24Settings, "p24_paypo");
  const transferProvider = resolveProvider(routing, "transfer", "p24");
  const paypoProvider = resolveProvider(routing, "paypo", "p24");

  const tiles: PaymentTile[] = [];
  if (blikEnabled) {
    // Bez podpisu - każdy wie, jak działa BLIK (właściciel, 2026-09-30).
    tiles.push({ kind: "blik", title: "BLIK", hint: "", logo: LOGO_BLIK, provider: blikProvider });
  }
  if (onlineTransferEnabled) {
    tiles.push({
      kind: "p24_transfer",
      title: "Przelew online",
      hint: "Wybierz swój bank",
      logo: LOGO_P24,
      provider: transferProvider,
    });
  }
  if (cardEnabled) {
    tiles.push({ kind: "card", title: "Karta płatnicza", hint: "Visa, Mastercard", logo: LOGO_CARD, provider: cardProvider });
  }
  if (paypoEnabled) {
    tiles.push({
      kind: "p24_paypo",
      title: "PayPo",
      hint: (
        <span className="cart-pay-tile-paypo">
          <span className="cart-pay-tile-lead">Zapłać za 30 dni</span>
          <span className="cart-pay-tile-sub">bez dodatkowych kosztów</span>
        </span>
      ),
      logo: LOGO_PAYPO,
      provider: paypoProvider,
    });
  }
  // Raty pokazujemy dopiero od 100 zł (i do 50 000 zł) - to widełki
  // Przelewy24. Poniżej 100 zł P24 nie ma rat w ofercie, więc klient, który
  // kliknął "Raty", trafiał na listę metod BEZ rat i porzucał płatność
  // (sprawdzone w API P24 dla 95,68 zł, 2026-09-28). amount = 0 znaczy
  // "kwota nieznana" - panel klienta buduje kafelki raz, dla wielu zamówień.
  if (p24KindAvailable(p24Settings, "p24_installments") && (amount <= 0 || installmentsAvailable(amount))) {
    tiles.push({
      kind: "p24_installments",
      title: "Raty",
      hint: amount > 0 ? <InstallmentTileHint amount={amount} /> : "Raty Przelewy24 - decyzja online",
      logo: LOGO_P24,
    });
  }
  if (walletsEnabled) {
    tiles.push({
      kind: "wallets",
      title: "Google Pay / Apple Pay",
      hint: "Kartą zapisaną w telefonie",
      wide: true,
      logo: LOGO_WALLETS,
      provider: walletsProvider,
    });
  }
  if (transferEnabled && allowTransfer) {
    tiles.push({
      kind: "transfer",
      title: "Przelew tradycyjny",
      hint: "Realizacja po zaksięgowaniu wpłaty",
      wide: true,
      logo: LOGO_BANK,
    });
  }
  return tiles;
}

export function PaymentMethodTiles({
  tiles,
  selected,
  onSelect,
  disabled = false,
  name = "payment-kind",
}: {
  tiles: PaymentTile[];
  /** null = jeszcze nic nie wybrano (koszyk i ponowienie startują tak samo). */
  selected: PaymentKind | null;
  onSelect: (kind: PaymentKind) => void;
  disabled?: boolean;
  name?: string;
}) {
  return (
    <div className="cart-pay-tiles" role="radiogroup" aria-label="Sposób płatności">
      {tiles.map((tile) => {
        const active = selected === tile.kind;
        return (
          <label key={tile.kind} className={`cart-pay-tile ${active ? "is-active" : ""} ${tile.wide ? "is-wide" : ""}`}>
            <input
              type="radio"
              name={name}
              value={tile.kind}
              checked={active}
              onChange={() => onSelect(tile.kind)}
              disabled={disabled}
            />
            {tile.logo}
            <span className="cart-pay-tile-copy">
              <strong>{tile.title}</strong>
              {tile.hint ? <small>{tile.hint}</small> : null}
            </span>
            <span className="cart-pay-tile-check" aria-hidden="true" />
          </label>
        );
      })}
    </div>
  );
}

export function P24BankPicker({
  banks,
  selectedId,
  onSelect,
}: {
  banks: P24Bank[];
  selectedId: number;
  onSelect: (bank: P24Bank) => void;
}) {
  return (
    <div className="cart-p24-banks" role="radiogroup" aria-label="Wybierz swój bank">
      {banks.length === 0 ? (
        <div className="cart-payment-waiting">
          <span className="cart-invoice-nip-spinner" aria-hidden="true" />
          Wczytujemy listę banków…
        </div>
      ) : (
        banks.map((bank) => (
          <label
            key={bank.id}
            className={`cart-p24-bank ${selectedId === bank.id ? "is-active" : ""}`}
            title={bank.name}
          >
            <input
              type="radio"
              name="p24-bank"
              value={bank.id}
              checked={selectedId === bank.id}
              onChange={() => onSelect(bank)}
            />
            {bank.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bank.img} alt={bank.name} loading="lazy" />
            ) : (
              <span className="cart-p24-bank-name">{bank.name}</span>
            )}
          </label>
        ))
      )}
    </div>
  );
}
