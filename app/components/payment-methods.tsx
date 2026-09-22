"use client";

import React, { useEffect, useState } from "react";
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

  useEffect(() => {
    fetch(`${CRM_PUBLIC_BASE}/site`)
      .then((response) => response.json())
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

  return { transferSettings, p24Settings, p24Banks };
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
  hint: string;
  logo: React.ReactNode;
  wide?: boolean;
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

/** Kolejność kafelków jest wspólna dla koszyka i ponowienia płatności. */
export function buildPaymentTiles(options: {
  stripeAvailable: boolean;
  p24Settings: P24Settings;
  transferEnabled: boolean;
  /** Ponowienie płatności: przelew tradycyjny ma sens tylko zanim zamówienie
   * trafi do realizacji (CRM odrzuci zmianę przyjętego zamówienia). */
  allowTransfer?: boolean;
}): PaymentTile[] {
  const { stripeAvailable, p24Settings, transferEnabled, allowTransfer = true } = options;
  const tiles: PaymentTile[] = [];
  if (stripeAvailable) {
    tiles.push({ kind: "blik", title: "BLIK", hint: "Wpisz 6-cyfrowy kod BLIK", logo: LOGO_BLIK });
  }
  if (p24KindAvailable(p24Settings, "p24_transfer")) {
    tiles.push({ kind: "p24_transfer", title: "Przelew online", hint: "Wybierz swój bank", logo: LOGO_P24 });
  }
  if (stripeAvailable) {
    tiles.push({ kind: "card", title: "Karta płatnicza", hint: "Visa, Mastercard", logo: LOGO_CARD });
  }
  if (p24KindAvailable(p24Settings, "p24_paypo")) {
    tiles.push({ kind: "p24_paypo", title: "PayPo", hint: "Kup teraz, zapłać później", logo: LOGO_PAYPO });
  }
  if (p24KindAvailable(p24Settings, "p24_installments")) {
    tiles.push({
      kind: "p24_installments",
      title: "Raty",
      hint: "Raty Przelewy24 - decyzja online",
      logo: LOGO_P24,
    });
  }
  if (stripeAvailable) {
    tiles.push({
      kind: "wallets",
      title: "Google Pay / Apple Pay",
      hint: "Jednym dotknięciem - kartą zapisaną w telefonie",
      wide: true,
      logo: LOGO_WALLETS,
    });
  }
  if (transferEnabled && allowTransfer) {
    tiles.push({
      kind: "transfer",
      title: "Przelew tradycyjny",
      hint: "Dane do przelewu dostaniesz od razu; realizacja po zaksięgowaniu",
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
  selected: PaymentKind;
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
              <small>{tile.hint}</small>
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
