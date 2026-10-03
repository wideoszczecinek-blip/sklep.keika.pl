"use client";

import { useCallback, useEffect, useRef, useState, type FocusEvent } from "react";
import Link from "next/link";
import { saveShopQuote } from "@/features/moskitiery/api";
import {
  type CartLineItem,
  calcCartOversizeSurcharge,
  calcMoskitieryCombinedSavings,
  clearCart,
  formatPln,
  readCartItems,
  removeCartItem,
  summarizeCartItems,
  updateCartItemConfig,
  updateCartItemQty,
  roundMoney,
} from "@/lib/cart";
import ConfiguratorPanel from "@/features/moskitiery-ramkowe/ConfiguratorPanel";
import {
  ALLEGRO_MOSKITIERY_HARDWARE,
  MESH_OPTIONS,
  OVERSIZE_SURCHARGE_THRESHOLD_MM,
} from "@/features/moskitiery-ramkowe/shared";
import RoletyDachoweConfiguratorPanel from "@/features/rolety-dachowe/ConfiguratorPanel";
import PlisyConfiguratorPanel from "@/features/plisy/ConfiguratorPanel";
import PlisyDachoweConfiguratorPanel from "@/features/plisy-dachowe/ConfiguratorPanel";
import PlisaDachowaPreview from "@/features/plisy-dachowe/PlisaDachowaPreview";
import { setProductPriceAdjustmentsFromConfig } from "@/lib/price-adjustment";
import { readMarketingConsent } from "@/lib/marketing-consent";
import PlisaPreview from "@/features/plisy/PlisaPreview";
import { readLastPage } from "../components/last-page-tracker";
import PromoSaveModal from "../components/promo-save-modal";
import { useCartEmailNudge } from "@/lib/cart-email-nudge";
import { captureCheckoutEmail, getCartEmailArm, getCartKeepArm, getTrackedPromoQuoteCode, type CartEmailArm, type CartKeepArm } from "@/lib/promo-save";

// Pusty koszyk (2026-09-26): CTA prowadzi do produktu, który klient ostatnio
// oglądał (keika_last_page), a nie zawsze do moskitier - klient z reklamy
// rolet dachowych czytał tu "Skonfiguruj moskitierę".
const EMPTY_CART_TARGETS: Record<string, { href: string; label: string }> = {
  "moskitiery-ramkowe": { href: "/moskitiery-ramkowe", label: "Skonfiguruj moskitierę" },
  plisy: { href: "/plisy", label: "Skonfiguruj plisę" },
  "rolety-dachowe": { href: "/?produkt=rolety-dachowe", label: "Skonfiguruj roletę dachową" },
  "plisy-dachowe": { href: "/?produkt=plisy-dachowe", label: "Skonfiguruj plisę dachową" },
};
function emptyCartTarget(lastPage: string): { href: string; label: string } {
  try {
    const url = new URL(lastPage || "/", "https://sklep.keika.pl");
    const slug = url.searchParams.get("produkt") || url.pathname.replace(/^\/+/, "").split("/")[0];
    if (slug && EMPTY_CART_TARGETS[slug]) return EMPTY_CART_TARGETS[slug];
  } catch {
    // ignore - fall back below
  }
  return { href: "/", label: "Wybierz produkt" };
}
import PaczkomatPicker from "../components/paczkomat-picker";
import PromoTopStrip from "../components/promo-top-strip";
import type { PaczkomatPoint } from "../api/paczkomaty/route";
import type { CheckoutContact } from "../components/stripe-payment-step";
import StripeMethodStep, { type CreatedIntent, type StripeMethod } from "../components/stripe-method-step";
import { trackStorefrontEvent } from "@/lib/shop-public";
import { isPromoActive, PROMO_CODE } from "@/lib/promo";
import {
  EXPRESS_CHANGED_EVENT,
  EXPRESS_ENABLED,
  EXPRESS_FEE_AMOUNT,
  EXPRESS_LABEL,
  EXPRESS_NOTE_LINE,
  EXPRESS_POSITION_SLUG,
  EXPRESS_SUMMARY,
  fetchDispatchInfo,
  isExpressSelected,
  setExpressSelected,
  type DispatchInfo,
} from "@/lib/express";
import { getRescueGrant, RESCUE_GRANT_EVENT, type RescueGrant } from "@/lib/rescue";
import { formatEscapeDeadline } from "@/lib/escape-offer";
import { EscapeOfferCartReveal, EscapeOfferCountdownChip, useCartEscapeOffer } from "../components/escape-offer";
import { useBackToClose } from "@/lib/use-back-to-close";
import InstallmentOffer from "@/app/components/installment-offer";
import { buildPaymentTiles, resolveProvider, type PaymentRouting, type PaymentProvider } from "@/app/components/payment-methods";
import { PaynowGdprNotice } from "@/app/components/paynow-gdpr";
import InstallmentTileHint from "@/app/components/installment-tile-hint";
import CartTrustBlock from "@/app/components/cart-trust-block";
import PaymentTrustTicker from "@/app/components/payment-trust-ticker";
import CartWindowThumb, { resolveCartWindowThumb } from "@/app/components/cart-window-thumb";
import ExpressWalletCheckout, { type WalletContact } from "@/app/components/express-wallet-checkout";
import { formatPhoneInput, isValidPhone, phoneError } from "@/lib/phone";
import { saveQuoteForSharing, sendShareLink, type ShareLink } from "@/lib/share";
import { cartDesignBucket, getCartDesignArm, markCartV2Crashed, rememberCartV2Share, type CartDesignArm } from "@/lib/cart-design";
import CartV2, { CartV2Boundary } from "./cart-v2";

// Checkout is the single highest-value place to know "co ich zniechęca" -
// every validation error, failed discount code, and failed order/payment
// attempt fires one of these instead of only ever showing an inline
// message the customer sees and staff never do. Fire-and-forget by design
// (never blocks/breaks checkout if analytics itself has a hiccup).
function trackCheckoutIssue(eventName: string, label: string, meta?: Record<string, string | number | boolean | null>) {
  let sessionToken = "";
  try {
    sessionToken = window.sessionStorage.getItem("keika_shop_session_token") || "";
  } catch {
    // sessionStorage niedostępny - event i tak poleci bez grupowania w sesję.
  }
  void trackStorefrontEvent({
    event_name: eventName,
    event_label: label,
    page_slug: "/koszyk",
    session_token: sessionToken,
    device_type: window.innerWidth < 768 ? "mobile" : "desktop",
    meta,
  }).catch(() => null);
}

type OrderCreateResponse = {
  ok: boolean;
  order?: {
    order_code: string;
    amount_total: string | null;
    currency: string;
    access_token?: string;
    transfer?: TransferDetails | null;
  };
  payment_enabled?: boolean;
  payment_provider?: string;
  publishable_key?: string;
  client_secret?: string;
  /** Przelewy24 / PayNow (pbl, card): adres strony płatności, na którą
   * przekierowujemy klienta. */
  redirect_url?: string;
  /** PayNow: rodzaj faktycznie uruchomiony (pbl/blik/card). */
  paynow_kind?: string;
  /** PayNow BLIK: identyfikator płatności do odpytywania paynow-check. */
  payment_id?: string;
  paynow_status?: string;
  error?: string;
};

/** Tyle samo, co bezpiecznik w CRM (cod_sms_start.php). */
const COD_RESEND_WAIT_MS = 60 * 1000;

type CodSmsStartResponse = {
  ok: boolean;
  verification_token?: string;
  error?: string;
  /** Serwer nie wysłał drugiego SMS-a (kod sprzed chwili nadal ważny). */
  notice?: string;
  reused?: boolean;
};

type CodSmsVerifyResponse = {
  ok: boolean;
  verified?: boolean;
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
  /** One-time flat fee shown as a price badge instead of "Gratis". */
  extraFee?: number;
};

// Paczkomat InPost only fits parcels where neither dimension exceeds this -
// otherwise it's not offered at all (mirrors app/page.tsx's own limit).
// Generic default for moskitiery-ramkowe/rolety-dachowe; plisy has its own,
// tighter, width-only rule below (2026-09-09, business owner) - a pleated
// blind packs down flat regardless of the window's height, so only its
// folded width has to fit the locker.
const PACZKOMAT_MAX_DIMENSION_MM = 640;
const PLISY_PACZKOMAT_MAX_WIDTH_MM = 600;

// One shipment for the whole order - if ANY item anywhere in the cart can't
// go by paczkomat, the method is dropped for the whole order, not just that
// item (see getAvailableDeliveryMethods' items.every() below).
function itemFitsPaczkomat(item: CartLineItem): boolean {
  if (item.productSlug === "plisy") return item.widthMm <= PLISY_PACZKOMAT_MAX_WIDTH_MM;
  return item.widthMm <= PACZKOMAT_MAX_DIMENSION_MM && item.heightMm <= PACZKOMAT_MAX_DIMENSION_MM;
}

// Cash-on-delivery is a flat one-time surcharge on top of the order, not a
// per-item fee - the courier collects it once for the whole parcel. It's a
// delivery method choice (a courier variant), not a separate payment step.
const COD_SURCHARGE_AMOUNT = 14.9;
const COD_DELIVERY_METHOD_ID = "pobranie";

// Przelew tradycyjny (właściciel, 2026-09-21): druga opcja obok płatności
// online dla dostaw innych niż pobranie. Zamówienie jest składane od razu
// (jak COD, bez SMS-a), klient dostaje dane do przelewu z unikatowym
// tytułem (= numer zamówienia) na ekranie i e-mailem; produkcja rusza
// dopiero po ręcznym potwierdzeniu wpłaty w CRM (do 2 dni roboczych na
// zaksięgowanie). Dane rachunku przychodzą z CRM (shop-public/site →
// checkout.transfer_*), nigdy nie są tu zaszyte na sztywno.
type TransferDetails = {
  account_holder: string;
  account_number: string;
  bank_name: string;
  holder_address: string;
  title: string;
  amount: string | null;
  currency: string;
  booking_note: string;
  pending: boolean;
};
type TransferSettings = {
  enabled: boolean;
  accountHolder: string;
  accountNumber: string;
  bankName: string;
  holderAddress: string;
};
// Przelewy24 (umowa bezpośrednia, 2026-09-22): przelew online (wybór
// banku), raty i PayPo. Zamówienie jest szkicem jak przy Stripe; klient
// jest przekierowywany na stronę P24, a po powrocie strona statusu
// odpytuje CRM, aż płatność zostanie potwierdzona.
type P24Kind = "p24_transfer" | "p24_installments" | "p24_paypo";
// Kafelki metod płatności w panelu (właściciel 2026-09-22, wzór: strona
// z kafelkami P24): BLIK / karta / Google Pay & Apple Pay przez Stripe (pole
// pojawia się od razu po kliknięciu, zamówienie powstaje przy "Płacę"),
// przelew online przez Przelewy24 (klient wybiera bank u nas i jest
// przenoszony prosto do banku), PayPo / raty gdy konto P24 je ma, na końcu
// przelew tradycyjny.
type PaymentKind = StripeMethod | P24Kind | "transfer";
type P24Bank = { id: number; name: string; img: string };
const STRIPE_PUBLISHABLE_KEY = (process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || "").trim();
// Apple Pay / Google Pay na górze koszyka: do czasu sprawdzenia na telefonie
// właściciela włączane tylko flagą ?express=1 (localStorage). Po potwierdzeniu
// przestawić na true (2026-09-28).
const EXPRESS_WALLETS_DEFAULT = false;
type P24Settings = { enabled: boolean; transfer: boolean; installments: boolean; paypo: boolean };
const P24_KIND_LABELS: Record<P24Kind, { title: string; hint: string; note: string }> = {
  p24_transfer: {
    title: "Przelew online – wybór banku",
    hint: "Przelewy24: logujesz się do swojego banku i zatwierdzasz płatność",
    note: "Przelewy24 – przelew online",
  },
  p24_installments: {
    title: "Raty",
    hint: "Przelewy24: decyzja ratalna online, bez wychodzenia z domu",
    note: "Przelewy24 – raty",
  },
  p24_paypo: {
    title: "PayPo – kup teraz, zapłać później",
    hint: "Odbierz zamówienie, zapłać do 30 dni albo w ratach (PayPo przez Przelewy24)",
    note: "Przelewy24 – PayPo",
  },
};

// Darmowa dostawa od 79 zł liczonych PO wszelkich rabatach (decyzja
// właściciela 2026-09-03 - typowa pojedyncza moskitiera z kodem SEZON20 to
// ~95 zł, więc przy progu 99 zł prawie każde pojedyncze zamówienie płaciło
// za dostawę). Poniżej tej kwoty koszyk dolicza stały koszt wysyłki. Odbiór
// osobisty jest zawsze bez opłaty (nic nie jest fizycznie wysyłane),
// płatność za pobraniem dolicza swoją odrębną dopłatę (COD_SURCHARGE_AMOUNT)
// NIEZALEŻNIE od kosztu samej wysyłki - obie się sumują poniżej progu.
const FREE_SHIPPING_THRESHOLD = 79;
const SHIPPING_FEE_AMOUNT = 12.9;

// Pilotaż (właściciel, 2026-09-24): plisy mają darmową dostawę od pierwszej
// sztuki, bez progu kwotowego - landing plis obiecuje to wprost, więc
// koszyk musi to dotrzymać. Wystarczy jedna plisa w koszyku.
const FREE_SHIPPING_PILOT_SLUGS = new Set(["plisy"]);
function cartHasFreeShippingPilot(items: CartLineItem[]): boolean {
  return items.some((item) => FREE_SHIPPING_PILOT_SLUGS.has(String(item.productSlug || "")));
}

// The customer just picks "Kurier" - which actual carrier (DPD, GLS, ...)
// ships it is our own internal decision made during fulfillment, not
// something we ask them to choose.
const COURIER_METHOD: DeliveryMethod = {
  id: "kurier",
  label: "Kurier",
  description: "Dostawa pod wskazany adres",
};

const PICKUP_METHOD: DeliveryMethod = {
  id: "odbior-osobisty",
  label: "Odbiór osobisty",
  description: "W siedzibie producenta",
};

const PACZKOMAT_METHOD: DeliveryMethod = {
  id: "paczkomat",
  label: "Paczkomat InPost",
  description: "Odbiór z wybranego automatu paczkowego",
};

const COD_DELIVERY_METHOD: DeliveryMethod = {
  id: COD_DELIVERY_METHOD_ID,
  label: "Kurier - płatność za pobraniem",
  description: "Płatność przy odbiorze, gotówką lub kartą",
};

function getAvailableDeliveryMethods(items: CartLineItem[], subtotal: number): DeliveryMethod[] {
  const fitsPaczkomat = items.length > 0 && items.every(itemFitsPaczkomat);
  const shippingFee =
    cartHasFreeShippingPilot(items) || subtotal >= FREE_SHIPPING_THRESHOLD ? undefined : SHIPPING_FEE_AMOUNT;
  const courier: DeliveryMethod = { ...COURIER_METHOD, extraFee: shippingFee };
  const paczkomat: DeliveryMethod = { ...PACZKOMAT_METHOD, extraFee: shippingFee };
  const cod: DeliveryMethod = {
    ...COD_DELIVERY_METHOD,
    extraFee: (shippingFee || 0) + COD_SURCHARGE_AMOUNT,
  };
  const courierMethods = fitsPaczkomat ? [courier, paczkomat] : [courier];
  return [...courierMethods, cod, PICKUP_METHOD];
}

type ExtraCharge = {
  id: string;
  slug: string;
  label: string;
  amount: number;
  summary: string;
};

type AppliedDiscount = {
  code: string;
  type: "percent" | "amount";
  value: number;
  amount: number;
};

type DiscountCheckResponse = {
  ok: boolean;
  discount?: { code: string; type: "percent" | "amount"; value: number; amount: number };
  error?: string;
};

// Real checkout, reusing the exact quote -> order -> Stripe pipeline the
// saved-quote flow already uses (see app/wycena/[quoteCode]/quote-checkout.tsx):
// the cart's line items become one quote's "positions" (that field already
// supports multiple items), quote_save.php returns a quote_code, then
// /api/orders/create + Stripe work exactly as they do there.
// hardwareLabel/meshLabel are generic cart-schema field names shared across
// products (see lib/cart.ts), but what they actually mean depends on which
// product the item is - "siatka" (mesh) means nothing on a roof blind order.
// Centralizes the per-product wording so the quote payload sent to the CRM,
// the cart line summary, and the "Edytuj pozycję" step reuse (below) all
// agree instead of drifting.
// Wraps one checkout input/textarea with fill-state feedback: a soft accent
// while it's still empty or not yet valid, green + a checkmark once it's
// correctly filled in. Purely visual - doesn't touch the field's own value/
// onChange/validation logic, which stays exactly as each call site already
// had it.
function CartFieldStatus({
  valid,
  children,
  fieldKey,
  error,
}: {
  valid: boolean;
  children: React.ReactNode;
  /** Klucz pola (data-checkout-field) - po nim "Brakuje: ..." przewija
   * do pola i je podświetla (właściciel, 2026-09-30). */
  fieldKey?: string;
  /** Komunikat pod polem, gdy jest niepoprawne i klient już je dotknął. */
  error?: string;
}) {
  return (
    <div
      className={`cart-field ${valid ? "is-valid" : error ? "is-invalid" : "is-pending"}`}
      data-checkout-field={fieldKey || undefined}
    >
      <span className="cart-field-input-wrap">
        {children}
        {valid ? (
          <span className="cart-field-check" aria-hidden="true">
            ✓
          </span>
        ) : null}
      </span>
      {error ? (
        <span className="cart-field-error" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

function cartItemFieldLabels(productSlug: string): { hardware: string; mesh: string } {
  if (productSlug === "rolety-dachowe") {
    return { hardware: "Kolor kasety", mesh: "Kolor materiału" };
  }
  if (productSlug === "plisy") {
    return { hardware: "Kolor mechanizmu", mesh: "Kolekcja i kolor tkaniny" };
  }
  if (productSlug === "plisy-dachowe") {
    return { hardware: "Kolor osprzętu", mesh: "Kolekcja i kolor tkaniny" };
  }
  return { hardware: "Kolor profilu", mesh: "Kolor siatki" };
}

/** Parametry pozycji jako osobne pola "etykieta / wartość" zamiast jednego
 * ciągu rozdzielonego kropkami (właściciel, 2026-10-03: "każda pozycja ma
 * swatche ciągiem wymienione - można to zrobić ładniej i czytelniej").
 * Wymiar idzie pierwszy, bo po nim klient rozpoznaje pozycję; przy kolorach
 * stoi kropka w wybranym kolorze, jeśli go znamy. */
function CartItemSpecs({ item }: { item: CartLineItem }) {
  const labels = cartItemFieldLabels(item.productSlug);
  const colors = resolveCartWindowThumb(item);
  const rows: { label: string; value: string; dot?: string }[] = [];
  if (item.widthMm && item.heightMm) {
    rows.push({
      label: "Wymiar",
      value: item.splitFromWidthMm
        ? `okno ${item.splitFromWidthMm} × ${item.heightMm} mm → 2 plisy po ${item.widthMm} mm`
        : `${item.widthMm} × ${item.heightMm} mm`,
    });
  }
  if (item.mountLabel) rows.push({ label: "Rodzaj montażu", value: item.mountLabel });
  if (item.hardwareLabel) rows.push({ label: labels.hardware, value: item.hardwareLabel, dot: colors?.hardware });
  if (item.meshLabel) rows.push({ label: labels.mesh, value: item.meshLabel, dot: colors?.fabric });
  if (item.modelLabel) rows.push({ label: "Model okna", value: item.modelLabel });
  if (item.productSlug === "rolety-dachowe" && item.bracketCount === 2) rows.push({ label: "Uchwyty", value: "2 szt." });
  if (rows.length === 0) return null;
  return (
    <dl className="cart-item-specs">
      {rows.map((row) => (
        <div key={row.label} className={row.label === "Wymiar" ? "is-size" : undefined}>
          <dt>{row.label}</dt>
          <dd>
            {row.dot ? <i className="cart-item-spec-dot" style={{ background: row.dot }} aria-hidden="true" /> : null}
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

function buildQuotePayloadFromCart(
  items: CartLineItem[],
  extraCharges: ExtraCharge[] = [],
  discount: AppliedDiscount | null = null,
  rescueGrant: RescueGrant | null = null,
) {
  const positions = items.map((item, index) => {
    const fieldLabels = cartItemFieldLabels(item.productSlug);
    const specs = [
      item.mountLabel ? `sposób montażu ${item.mountLabel}` : "",
      item.hardwareLabel ? `${fieldLabels.hardware.toLowerCase()} ${item.hardwareLabel}` : "",
      item.meshLabel ? `${fieldLabels.mesh.toLowerCase()} ${item.meshLabel}` : "",
      item.modelLabel ? `model okna ${item.modelLabel}` : "",
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
        item.mountLabel ? { label: "Rodzaj montażu", value: item.mountLabel, note: "" } : null,
        item.hardwareLabel ? { label: fieldLabels.hardware, value: item.hardwareLabel, note: "" } : null,
        item.meshLabel ? { label: fieldLabels.mesh, value: item.meshLabel, note: "" } : null,
        item.modelLabel
          ? {
              label: "Model okna",
              value: item.modelLabel,
              note:
                (item.productSlug === "rolety-dachowe" || item.productSlug === "plisy-dachowe") && item.windowCertain === false && !item.missingModelRequest
                  ? "wymiar orientacyjny — potwierdzić przed produkcją"
                  : "",
            }
          : null,
        item.widthMm && item.heightMm
          ? { label: "Rozmiar", value: `${item.widthMm} × ${item.heightMm} mm`, note: item.missingModelRequest ? "wymiar A/B podany przez klienta" : "" }
          : null,
        item.missingModelRequest
          ? {
              label: "Okno spoza biblioteki",
              value: `${item.missingModelRequest.producer} ${item.missingModelRequest.model}`.trim(),
              note:
                item.missingModelRequest.aiProducer || item.missingModelRequest.aiModel
                  ? `odczyt AI: ${[item.missingModelRequest.aiProducer, item.missingModelRequest.aiModel].filter(Boolean).join(" ")} (${item.missingModelRequest.aiConfidence || "?"})`
                  : "",
            }
          : null,
        item.splitFromWidthMm
          ? {
              label: "Podział okna",
              value: `okno ${item.splitFromWidthMm} mm → 2 plisy po ${item.widthMm} mm`,
              note: "klient podał łączną szerokość, dzielimy na dwie równe plisy",
            }
          : null,
        item.sagNoticeShown
          ? {
              label: "Ugięcie profilu",
              value: "informacja wyświetlona klientowi",
              note: `szerokość ${item.widthMm} mm > ${item.sagLimitMm || "?"} mm; konfigurator i koszyk (bez wymaganej zgody)`,
            }
          : null,
        item.bracketCount ? { label: "Uchwyty na belce dolnej", value: `${item.bracketCount} szt.`, note: "" } : null,
        item.notes ? { label: "Uwagi klienta", value: item.notes, note: "" } : null,
        [item.nameplateAttachmentId, ...(item.missingModelRequest?.attachmentIds || [])].filter((id): id is string => Boolean(id)).filter((id, i, arr) => arr.indexOf(id) === i).length
          ? {
              label: "Zdjęcie od klienta",
              value: `${[item.nameplateAttachmentId, ...(item.missingModelRequest?.attachmentIds || [])].filter((id): id is string => Boolean(id)).filter((id, i, arr) => arr.indexOf(id) === i).length} plik(i)`,
              note: `attachment_id: ${[item.nameplateAttachmentId, ...(item.missingModelRequest?.attachmentIds || [])].filter((id): id is string => Boolean(id)).filter((id, i, arr) => arr.indexOf(id) === i).join(", ")}`,
            }
          : null,
        { label: "Ilość", value: `${item.qty} szt.`, note: "" },
      ].filter((row): row is { label: string; value: string; note: string } => row !== null),
      ...(item.productSlug === "rolety-dachowe" || item.productSlug === "plisy-dachowe"
        ? {
            meta: {
              window_library_id: item.windowLibraryId || 0,
              window_certain: item.windowCertain !== false,
              attachment_ids: [item.nameplateAttachmentId, ...(item.missingModelRequest?.attachmentIds || [])].filter((id): id is string => Boolean(id)).filter((id, i, arr) => arr.indexOf(id) === i),
              missing_model_request: item.missingModelRequest
                ? {
                    producer: item.missingModelRequest.producer,
                    model: item.missingModelRequest.model,
                    dimension_a: item.missingModelRequest.dimensionAMm,
                    dimension_b: item.missingModelRequest.dimensionBMm,
                    attachment_ids: item.missingModelRequest.attachmentIds,
                    ai_producer: item.missingModelRequest.aiProducer || "",
                    ai_model: item.missingModelRequest.aiModel || "",
                    ai_confidence: item.missingModelRequest.aiConfidence || "",
                  }
                : null,
            },
          }
        : {}),
    };
  });

  // One-time surcharges for the whole order (oversized parcel, cash-on-
  // delivery fee, ...), each as its own quote position so they're transparent
  // in the CRM and included in the total actually charged - not folded
  // invisibly into one item's price.
  for (const extra of extraCharges) {
    if (extra.amount <= 0) continue;
    positions.push({
      id: extra.id,
      product_slug: extra.slug,
      product_label: extra.label,
      quantity: 1,
      purchase_units: null,
      total_amount: extra.amount.toFixed(2),
      currency: "PLN",
      summary: extra.summary,
      summary_rows: [],
    });
  }

  // Real "wspólne rozliczenie obwodu" savings (see calcMoskitieryCombinedSavings()'s
  // own doc comment, lib/cart.ts) - deliberately its own position, same
  // trust model as the discount/rescue positions below: this amount is
  // just for immediate client-side display, quote_save.php's own
  // shop_moskitiery_combined_perimeter_reapply_to_quote_input() always
  // recomputes the real amount straight from each moskitiery-ramkowe
  // position's own declared size/quantity before persisting anything (a
  // tampered/stale amount here can't reduce what's actually charged).
  const combinedSavings = calcMoskitieryCombinedSavings(items);
  if (combinedSavings > 0) {
    positions.push({
      id: "position-moskitiery-combined-savings",
      product_slug: "oszczednosc-obwod-moskitiery",
      product_label: "Wspólne rozliczenie obwodu",
      quantity: 1,
      purchase_units: null,
      total_amount: (-combinedSavings).toFixed(2),
      currency: "PLN",
      summary: `Wspólne rozliczenie obwodu moskitier (-${combinedSavings.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł)`,
      summary_rows: [],
    });
  }

  // Discount code position (see core/lib/shop_discount_codes.php on the CRM
  // side): deliberately NOT going through the extraCharges loop above, which
  // only ever adds positive amounts. Its own total_amount here is just for
  // this immediate client-side display - the id ("rabat-<CODE>") is what
  // actually matters, since quote_save.php always re-validates the code and
  // recomputes the real discount amount server-side before persisting
  // anything (a tampered amount here can't reduce what's actually charged).
  if (discount && discount.amount > 0) {
    positions.push({
      id: `rabat-${discount.code}`,
      product_slug: "rabat",
      product_label: "Kod rabatowy",
      quantity: 1,
      purchase_units: null,
      total_amount: (-discount.amount).toFixed(2),
      currency: "PLN",
      summary: `Kod rabatowy ${discount.code} (-${discount.amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł)`,
      summary_rows: [],
    });
  }

  // Rescue discount (exit-intent modal, see lib/rescue.ts) - its own
  // position id/slug ("rabat-ratunek", not "rabat") so it stacks additively
  // alongside a typed/promo code instead of competing for the same slot.
  // This preview amount is display-only, same trust model as the code
  // discount above - quote_save.php re-validates the source quote_code and
  // recomputes the real amount server-side before persisting anything.
  const itemsSubtotal = items.reduce((sum, item) => sum + item.total, 0);
  // Net of combinedSavings - same "% computed off what's left after the
  // real wspólne-rozliczenie-obwodu correction, not the higher
  // pre-correction subtotal" fix as the discount code above (real live bug
  // 2026-09-11).
  const rescueAmount = rescueGrant
    ? roundMoney(Math.max(0, (itemsSubtotal - combinedSavings) * (rescueGrant.percent / 100)))
    : 0;
  if (rescueGrant && rescueAmount > 0) {
    positions.push({
      id: `rabat-ratunek-${rescueGrant.quoteCode}`,
      product_slug: "rabat-ratunek",
      product_label: "Rabat za zapisanie wyceny",
      quantity: 1,
      purchase_units: null,
      total_amount: (-rescueAmount).toFixed(2),
      currency: "PLN",
      summary: `Rabat za zapisanie wyceny (-${rescueGrant.percent}%, -${rescueAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł)`,
      summary_rows: [],
    });
  }

  const extraTotal = extraCharges.reduce((sum, extra) => sum + (extra.amount > 0 ? extra.amount : 0), 0);
  const discountTotal = discount && discount.amount > 0 ? discount.amount : 0;
  const totalAmount = itemsSubtotal - combinedSavings + extraTotal - discountTotal - rescueAmount;

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

// Restyles Stripe's default (light/generic) Elements chrome to match the
// site's own dark, rounded, teal-accented look instead of standing out as an
// obviously bolted-on third-party widget.

export default function CartPage() {
  // Light theme is now applied unconditionally in app/layout.tsx's blocking
  // head script (before first paint, no flash) - no longer needed here.
  const [items, setItems] = useState<CartLineItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Test nowego koszyka (lib/cart-design.ts): null do czasu odczytu grupy,
  // żeby żaden z dwóch wyglądów nie mignął osobie z drugiej grupy.
  const [cartDesign, setCartDesign] = useState<CartDesignArm | null>(null);
  const cartDesignForcedRef = useRef(false);
  const cartDesignTrackedRef = useRef(false);
  useEffect(() => {
    const picked = getCartDesignArm();
    cartDesignForcedRef.current = picked.forced;
    setCartDesign(picked.arm);
  }, []);
  useEffect(() => {
    if (!cartDesign || !hydrated || items.length === 0 || cartDesignTrackedRef.current) return;
    cartDesignTrackedRef.current = true;
    trackCheckoutIssue("cart_design_ab", cartDesign, {
      forced: cartDesignForcedRef.current,
      bucket: cartDesignBucket(),
      product: items[0]?.productSlug || "",
    });
  }, [cartDesign, hydrated, items]);
  // Where the customer actually was right before opening the cart (product +
  // step + query string) - "/" until we know better, filled in on mount.
  const [backHref, setBackHref] = useState("/");
  // Żadna metoda dostawy nie jest wybrana z góry (właściciel, 2026-09-24) -
  // pola danych pojawiają się dopiero po kliknięciu w metodę, tak samo na
  // telefonie i na komputerze.
  const [deliveryMethod, setDeliveryMethod] = useState("");
  // "Ekspres" production priority (see lib/express.ts) - carried over from
  // the landing-page toggle via localStorage, switchable here too.
  const [expressSelected, setExpressSelectedState] = useState(false);
  const [dispatchInfo, setDispatchInfo] = useState<DispatchInfo | null>(null);
  useEffect(() => {
    setExpressSelectedState(isExpressSelected());
    const sync = () => setExpressSelectedState(isExpressSelected());
    window.addEventListener(EXPRESS_CHANGED_EVENT, sync);
    let cancelled = false;
    void fetchDispatchInfo("moskitiery-ramkowe").then((info) => {
      if (!cancelled) setDispatchInfo(info);
    });
    return () => {
      cancelled = true;
      window.removeEventListener(EXPRESS_CHANGED_EVENT, sync);
    };
  }, []);
  function chooseExpress(on: boolean) {
    setExpressSelected(on);
    setExpressSelectedState(on);
    trackCheckoutIssue("express_toggled", on ? "on" : "off", { place: "koszyk" });
  }
  // Ekspres jest priorytetem w kolejce produkcyjnej MOSKITIER - inne
  // produkty (plisy, rolety dachowe...) mają własne, ręcznie ustalane
  // terminy, więc koszyk z czymkolwiek innym w środku nie dostaje tej
  // opcji wcale (właściciel, 2026-09-21). Zapamiętany wcześniej wybór
  // (localStorage, z landingu moskitier) jest wtedy kasowany, żeby dopłata
  // nie doliczyła się po cichu.
  const expressEligible =
    EXPRESS_ENABLED && items.length > 0 && items.every((item) => item.productSlug === "moskitiery-ramkowe");
  // Plisy: stały termin 5-7 dni roboczych (właściciel, 2026-09-28); koszyk
  // z moskitierami i plisami jedzie razem, więc obowiązuje dłuższy termin.
  // Rolety/plisy dachowe mają terminy ustalane ręcznie - bez deklaracji.
  const plisyLeadTime =
    items.length > 0 &&
    items.some((item) => item.productSlug === "plisy") &&
    items.every((item) => item.productSlug === "plisy" || item.productSlug === "moskitiery-ramkowe");
  useEffect(() => {
    if (!expressEligible && expressSelected) {
      setExpressSelected(false);
      setExpressSelectedState(false);
    }
  }, [expressEligible, expressSelected]);
  const expressFee = expressEligible && expressSelected ? EXPRESS_FEE_AMOUNT : 0;
  const [selectedPaczkomat, setSelectedPaczkomat] = useState<PaczkomatPoint | null>(null);
  // Kupujący inny niż odbiorca (właściciel, 2026-09-24): domyślnie to ta
  // sama osoba, więc nikt nie wpisuje niczego dwa razy. Gdy się różnią,
  // dane lecą do zamówienia osobnym blokiem i dodatkowo w notatce, żeby
  // biuro widziało je bez zaglądania w JSON.
  // Lista pozycji startuje zwinięta - klient wie, co zamawia, a w koszyku
  // liczy się kwota i dane (właściciel, 2026-09-24). Rozwija ją kliknięcie
  // w nagłówek karty.
  // Pozycje rozwinięte z góry (właściciel, 2026-09-28): przy zwiniętej liście
  // klient widział tylko "1 pozycja, 95,68 zł" i wracał do konfiguratora
  // sprawdzić wymiar i kolor (47 kliknięć "Wróć" w 14 dni na koszykach, które
  // nie doszły do formularza).
  const [itemsOpen, setItemsOpen] = useState(true);
  const [noteOpen, setNoteOpen] = useState(false);
  const [buyerDifferent, setBuyerDifferent] = useState(false);
  const [buyer, setBuyer] = useState({
    name: "",
    email: "",
    phone: "",
    street: "",
    postcode: "",
    city: "",
  });
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    phone: "",
    email: "",
    city: "",
    postcode: "",
    address1: "",
    note: "",
  });

  // Real live bug 2026-09-11 + a regression of the same class 2026-09-13
  // (see address1FieldValid's and the resync effect's own comments below) -
  // a debounce alone can't fully tell "the customer paused typing" apart
  // from "the customer is done with this field", and guessing wrong twice
  // already shipped incomplete addresses on real paid orders. Tracking
  // whether the cursor is literally still in the street field is a much
  // more direct signal than any timeout: while it's focused, the customer
  // is - by definition - not done with it yet, so neither the first
  // auto-submit nor the resync effect may fire, no matter how long they
  // pause mid-edit.
  const [address1Focused, setAddress1Focused] = useState(false);
  const [wantsInvoice, setWantsInvoice] = useState(false);
  const [invoice, setInvoice] = useState({
    nip: "",
    companyName: "",
    street: "",
    postcode: "",
    city: "",
  });

  // Wpisane dane przeżywają przeładowanie strony i powrót z bramki
  // płatniczej (właściciel, 2026-09-24: "uzupełnione dane mają się
  // przenosić i zapamiętywać w ramach sesji"). sessionStorage, nie local:
  // dane adresowe nie mają zostawać na wspólnym komputerze po zamknięciu
  // przeglądarki.
  const CHECKOUT_DRAFT_KEY = "keika_checkout_draft_v1";
  const checkoutDraftLoadedRef = useRef(false);
  useEffect(() => {
    try {
      const raw = window.sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw) as Record<string, unknown>;
        if (draft.form && typeof draft.form === "object") setForm((current) => ({ ...current, ...(draft.form as object) }));
        if (draft.invoice && typeof draft.invoice === "object")
          setInvoice((current) => ({ ...current, ...(draft.invoice as object) }));
        if (draft.buyer && typeof draft.buyer === "object") setBuyer((current) => ({ ...current, ...(draft.buyer as object) }));
        if (typeof draft.wantsInvoice === "boolean") setWantsInvoice(draft.wantsInvoice);
        if (typeof draft.buyerDifferent === "boolean") setBuyerDifferent(draft.buyerDifferent);
        if (typeof draft.deliveryMethod === "string" && draft.deliveryMethod) setDeliveryMethod(draft.deliveryMethod);
      }
    } catch {
      /* sessionStorage niedostępny - formularz po prostu startuje pusty */
    }
    checkoutDraftLoadedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!checkoutDraftLoadedRef.current) return;
    try {
      window.sessionStorage.setItem(
        CHECKOUT_DRAFT_KEY,
        JSON.stringify({ form, invoice, buyer, wantsInvoice, buyerDifferent, deliveryMethod }),
      );
    } catch {
      /* ignore */
    }
  }, [form, invoice, buyer, wantsInvoice, buyerDifferent, deliveryMethod]);
  const [nipLookupLoading, setNipLookupLoading] = useState(false);
  const [nipLookupError, setNipLookupError] = useState("");
  const lastLookedUpNip = useRef("");

  // Okno kodu (2026-10-03): kiedy wyszedł ostatni kod (odliczanie do
  // "Wyślij nowy kod" - serwer i tak nie wyśle drugiego w ciągu minuty)
  // i poprawa numeru bez zamykania okna. Dane z 02-03.10: SMS dochodził
  // w 4-6 s, a klienci i tak go nie mieli - najpewniej literówka w numerze,
  // której w oknie nie było jak poprawić.
  const [codSentAt, setCodSentAt] = useState(0);
  const [codNow, setCodNow] = useState(0);
  const [codPhoneEdit, setCodPhoneEdit] = useState<string | null>(null);
  useEffect(() => {
    if (!codSentAt) return;
    setCodNow(Date.now());
    const id = window.setInterval(() => {
      const now = Date.now();
      setCodNow(now);
      if (now - codSentAt > COD_RESEND_WAIT_MS) window.clearInterval(id);
    }, 1000);
    return () => window.clearInterval(id);
  }, [codSentAt]);
  const codResendIn = codSentAt ? Math.max(0, Math.ceil((COD_RESEND_WAIT_MS - (codNow - codSentAt)) / 1000)) : 0;
  const [codSms, setCodSms] = useState<{
    status: "idle" | "sending" | "sent" | "verifying" | "verified" | "error";
    token: string;
    code: string;
    error: string;
  }>({ status: "idle", token: "", code: "", error: "" });
  // SMS verification for cash-on-delivery only starts once "Zamawiam" is
  // clicked - it's not shown/sent proactively just because that delivery
  // method is selected.
  const [codModalOpen, setCodModalOpen] = useState(false);
  // Kod SMS poszedł, klient go jeszcze nie potwierdził, a okno jest
  // zamknięte - wtedy pole na kod musi stać przy metodzie płatności.
  const codPendingInline =
    !codModalOpen && codSms.token !== "" && codSms.status !== "verified";

  // "Edytuj pozycję" - the same <ConfiguratorPanel> the product page uses,
  // seeded with this item's current config. moskitiery-ramkowe and plisy
  // items get the button (see item.productSlug check below); rolety-dachowe
  // has a ready modal branch too but isn't exposed yet.
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Required consent checkbox - gates every "Zamawiam" CTA regardless of
  // payment method. Single link/document: "Regulamin sklepu i płatności"
  // (shop terms and payment terms live together, not as two documents).
  const [termsAccepted, setTermsAccepted] = useState(false);
  // O marketing pytamy w pasku ciasteczek, nie w koszyku (właściciel,
  // 2026-09-28: "wracamy do prostego checkoutu ... strasznie spadła
  // konwersja"). Poprzedni akordeon "Akceptuję regulaminy i zgody" z dwiema
  // opcjonalnymi zgodami stał dokładnie tam, gdzie klient ma kliknąć
  // "Zamawiam". Decyzję z paska (lib/marketing-consent.ts) dopinamy do
  // zamówienia, więc CRM dalej wie, komu wolno wysyłać oferty.
  // Które pola formularza klient już wypełnił - dla tooltipa "online w
  // sklepie" w CRM ("uzupełnia: telefon"). Tylko nazwa pola, nigdy wartość;
  // każde pole raz na wejście na stronę.
  const trackedCheckoutFieldsRef = useRef<Set<string>>(new Set());
  // Wejście do koszyka z jego zawartością (kwota, liczba pozycji) - jeden
  // raz na wejście na stronę, gdy koszyk już wczytany.
  const viewCartTrackedRef = useRef(false);
  useEffect(() => {
    if (!hydrated || viewCartTrackedRef.current) return;
    viewCartTrackedRef.current = true;
    const total = Math.round(items.reduce((sum, item) => sum + (Number(item.total) || 0), 0) * 100) / 100;
    trackCheckoutIssue("view_cart", String(items.length), {
      cart_total: total,
      // Bez kwoty do zapłaty: view_cart leci zaraz po hydracji, zanim rabat
      // zostanie policzony - realną kwotę podaje zdarzenie cart_amount
      // sekundę później (właściciel, 2026-09-26).
      cart_positions: items.length,
      products: Array.from(new Set(items.map((item) => item.productSlug))).join(","),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
  // "Koszyk na e-mail" (2026-09-26): the offer fires only at leaving moments
  // (40 s idle / desktop exit intent / tab return) and never once the
  // customer has started the form - see lib/cart-email-nudge.ts.
  const [checkoutFormStarted, setCheckoutFormStarted] = useState(false);
  // Pola, które klient już opuścił - tylko przy nich pokazujemy komunikat
  // błędu (świeży formularz nie może być czerwony). Po dotknięciu
  // zablokowanego przycisku płatności pokazujemy błędy wszędzie.
  const [touchedFields, setTouchedFields] = useState<Set<string>>(() => new Set());
  const [showAllFieldErrors, setShowAllFieldErrors] = useState(false);
  // Baner "Nie decydujesz dzisiaj?" odsłania się płynnie dopiero wtedy, gdy
  // wjedzie w pole widzenia, a klient NIE tknął jeszcze danych kontaktowych
  // (właściciel, 2026-09-29). Na telefonie to znaczy: przewinął cały koszyk
  // i nic nie wpisał. Dane z 14 dni: mobile, przewinięty koszyk bez ani
  // jednego pola - 71 sesji, 1 zamówienie; kto wypełnia dane - 113 sesji,
  // 65 zamówień. Tego drugiego nie wolno zaczepiać.
  const [cartKeepVisible, setCartKeepVisible] = useState(false);
  const cartKeepSeenRef = useRef(false);
  const cartKeepObserverRef = useRef<IntersectionObserver | null>(null);
  const cartKeepMetaRef = useRef<{ arm: string; slug: string }>({ arm: "", slug: "" });
  const cartEmailNudge = useCartEmailNudge({ context: "cart", hasItems: items.length > 0, formStarted: checkoutFormStarted });
  // Which arm this device is in - read after mount so SSR and the first
  // client render agree (the "control" copy), then the real arm takes over.
  const [cartEmailArm, setCartEmailArm] = useState<CartEmailArm>("control");
  // Test banera na dole koszyka: null do czasu odczytu grupy, żeby baner nie
  // mignął osobom z grupy "hidden" (patrz getCartKeepArm).
  const [cartKeepArm, setCartKeepArm] = useState<CartKeepArm | null>(null);
  const cartKeepArmTrackedRef = useRef(false);
  useEffect(() => {
    setCartKeepArm(getCartKeepArm());
  }, []);
  useEffect(() => {
    // Nowy koszyk nie ma tego banera - jego wejścia nie należą do tego testu.
    if (!cartKeepArm || items.length === 0 || cartKeepArmTrackedRef.current || cartDesign !== "classic") return;
    cartKeepArmTrackedRef.current = true;
    trackCheckoutIssue("cart_keep_ab", cartKeepArm, { product: items[0]?.productSlug || "" });
  }, [cartKeepArm, items, cartDesign]);
  useEffect(() => {
    setCartEmailArm(getCartEmailArm());
  }, []);
  function handleCheckoutFieldBlur(event: FocusEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
    if (target instanceof HTMLInputElement && (target.type === "radio" || target.type === "checkbox")) return;
    const touchedKey = target.closest("[data-checkout-field]")?.getAttribute("data-checkout-field") || "";
    if (touchedKey) setTouchedFields((current) => (current.has(touchedKey) ? current : new Set(current).add(touchedKey)));
    if (target.value.trim() === "") return;
    setCheckoutFormStarted(true);
    // Silent capture of a typed e-mail (2026-09-26) - the CRM mails "Twój
    // koszyk" after 1 h only if no order followed; see captureCheckoutEmail().
    if (target instanceof HTMLInputElement && target.type === "email") {
      void captureCheckoutEmail(target.value, items[0]?.productSlug);
    }
    const label = target.closest("label");
    let fieldName = "";
    if (label) {
      for (const node of Array.from(label.childNodes)) {
        if (node.nodeType === Node.TEXT_NODE && node.textContent && node.textContent.trim() !== "") {
          fieldName = node.textContent.trim();
          break;
        }
      }
    }
    if (fieldName === "") fieldName = target.getAttribute("autocomplete") || target.getAttribute("placeholder") || target.name || "pole";
    fieldName = fieldName.replace(/\s+/g, " ").slice(0, 40);
    if (trackedCheckoutFieldsRef.current.has(fieldName)) return;
    trackedCheckoutFieldsRef.current.add(fieldName);
    trackCheckoutIssue("checkout_field", fieldName, { invoice: label ? Boolean(label.closest(".cart-invoice-fields")) : false });
  }

  // Discount code (see core/lib/shop_discount_codes.php on the CRM side).
  // "Sprawdź" just previews the discount for display - it's re-validated
  // server-side from scratch when the order actually gets placed (see
  // buildQuotePayloadFromCart/submitOrder below), so a stale or tampered
  // client-side amount here can never reduce what's actually charged.
  const [discountCodeInput, setDiscountCodeInput] = useState("");
  // Pole kodu schowane za linkiem "Masz kod rabatowy?" - SEZON20 nalicza się
  // sam, więc otwarte pole tylko wydłużało koszyk (2026-09-28).
  const [discountOpen, setDiscountOpen] = useState(false);
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  // Rescue discount (exit-intent modal on the homepage, see lib/rescue.ts) -
  // read once on mount; stacks additively alongside appliedDiscount above,
  // never replaces it (business decision: during SEZON20, a rescued
  // customer gets -25% total, not just -20% or just -5%).
  const [rescueGrant, setRescueGrantState] = useState<RescueGrant | null>(null);
  // Rabat może się zmienić w trakcie wizyty (oferta "dodatkowe 5% dla
  // wychodzących" przyznana przy wyjściu, koniec jej terminu) - stąd nasłuch
  // i odświeżanie co 30 s. Zamówienie już w trakcie płacenia dostaje 15 min
  // zapasu po terminie (CRM ma 20), żeby kwota nie skoczyła klientowi
  // z kodem BLIK w ręku.
  const rescueDraftGraceRef = useRef(false);
  useEffect(() => {
    const syncRescueGrant = () => {
      const next = getRescueGrant({ graceMs: rescueDraftGraceRef.current ? 15 * 60 * 1000 : 0 });
      setRescueGrantState((current) =>
        current?.quoteCode === next?.quoteCode && current?.percent === next?.percent && current?.expiresAtMs === next?.expiresAtMs
          ? current
          : next,
      );
    };
    syncRescueGrant();
    window.addEventListener(RESCUE_GRANT_EVENT, syncRescueGrant);
    const timer = window.setInterval(syncRescueGrant, 30000);
    return () => {
      window.removeEventListener(RESCUE_GRANT_EVENT, syncRescueGrant);
      window.clearInterval(timer);
    };
  }, []);
  const combinedDiscountPercent =
    (appliedDiscount?.type === "percent" ? appliedDiscount.value : 0) + (rescueGrant?.percent || 0);
  // Wchodzi do "odcisku" zamówienia w toku: zmiana rabatu (przyznanie, koniec
  // terminu) to zmiana kwoty, więc szkic zamówienia musi powstać od nowa.
  const rescueSnapshotKey = rescueGrant ? `${rescueGrant.quoteCode}:${rescueGrant.percent}` : "";
  const [discountChecking, setDiscountChecking] = useState(false);
  const [discountError, setDiscountError] = useState("");

  // "Zapisz/udostępnij wycenę" banners (below the item list, below the
  // financial summary) - real feedback 2026-09-09: the cart is exactly the
  // moment a customer might want to come back to this later, and there was
  // no CTA for that here at all (the existing save/share icon only lives in
  // the homepage's own header). One shared modal/state for both banners -
  // whichever is clicked opens the same link. Reuses buildQuotePayloadFromCart
  // (below) for the actual snapshot, so the shared link carries the exact
  // same discounts/surcharges the customer is looking at right now, not a
  // simplified re-derivation of them.
  const [cartShareLink, setCartShareLink] = useState<ShareLink | null>(null);
  const [cartShareModalOpen, setCartShareModalOpen] = useState(false);
  const [cartShareSaving, setCartShareSaving] = useState(false);
  const [cartShareCopyState, setCartShareCopyState] = useState<"idle" | "copied">("idle");
  const [cartShareSendOpen, setCartShareSendOpen] = useState(false);
  const [cartShareSendValue, setCartShareSendValue] = useState("");
  const [cartShareSendStatus, setCartShareSendStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  // Standing "SEZON20" promo preview shown under the total to nudge people
  // who haven't typed a code in yet - fetched read-only (same endpoint the
  // "Sprawdź" button uses) so it silently disappears if the code ever
  // expires or gets deactivated, instead of advertising a dead promo.
  const [sezon20Promo, setSezon20Promo] = useState<{ type: "percent" | "amount"; value: number; amount: number } | null>(
    null,
  );

  const [legalModalOpen, setLegalModalOpen] = useState(false);

  // Systemowe "wstecz" ma zamykać to, co jest otwarte na wierzchu, a nie
  // wyrzucać klienta z koszyka (właściciel, 2026-09-24).
  useBackToClose(cartShareModalOpen, () => setCartShareModalOpen(false));
  useBackToClose(codModalOpen, () => setCodModalOpen(false));
  useBackToClose(legalModalOpen, () => setLegalModalOpen(false));
  useBackToClose(Boolean(editingItemId), () => setEditingItemId(null));
  const [legalContent, setLegalContent] = useState<{ title: string; bodyHtml: string } | null>(null);
  const [legalLoading, setLegalLoading] = useState(false);
  const [legalError, setLegalError] = useState("");

  useEffect(() => {
    if (!legalModalOpen || legalContent || legalLoading) return;
    setLegalLoading(true);
    setLegalError("");
    fetch("https://crm-keika.groovemedia.pl/biuro/api/shop-public/legal?slug=regulamin", { cache: "no-store" })
      .then((response) => response.json())
      .then((json: { ok: boolean; page?: { title: string; body_html: string }; error?: string }) => {
        if (!json.ok || !json.page) throw new Error(json.error || "Nie udało się wczytać regulaminu.");
        setLegalContent({ title: json.page.title, bodyHtml: json.page.body_html || "" });
      })
      .catch((fetchError) => {
        setLegalError(fetchError instanceof Error ? fetchError.message : "Nie udało się wczytać regulaminu.");
      })
      .finally(() => setLegalLoading(false));
  }, [legalModalOpen, legalContent, legalLoading]);

  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittedRef = useRef(false);
  const [orderState, setOrderState] = useState<{
    orderCode: string;
    amountTotal: string | null;
    clientSecret?: string;
    publishableKey?: string;
    paymentEnabled: boolean;
    paymentProvider: string;
    accessToken?: string;
    transfer?: TransferDetails | null;
    /** Metoda Stripe, dla której powstał ten PaymentIntent (blik / card /
     * wallets) - ponowne użycie tylko przy tej samej metodzie. */
    stripeMethod?: StripeMethod;
  } | null>(null);
  // "online" (Stripe: BLIK/karta/P24/Revolut) albo "transfer" (przelew
  // tradycyjny) - wybór w panelu płatności, tylko gdy dostawa nie jest
  // pobraniowa (pobranie samo w sobie jest metodą płatności).
  // Żadna metoda nie jest zaznaczona z góry (właściciel, 2026-09-24, wrócone
  // 2026-09-30 po jednodniowej próbie z domyślnym BLIK-iem): BLIK wybierał
  // się sam i klient od razu widział pole na kod, zanim w ogóle zdecydował,
  // czym płaci. Panel z polami otwiera się dopiero po wybraniu metody -
  // stąd pusty stan początkowy.
  const [onlinePaymentKind, setOnlinePaymentKind] = useState<PaymentKind | "">("");
  // Siatka banków dla "Przelew online" (Przelewy24) - lista z CRM
  // (shop-public/p24_banks, logotypy z CDN P24), pobierana raz.
  const [p24Banks, setP24Banks] = useState<P24Bank[]>([]);
  const [p24BankId, setP24BankId] = useState<number>(0);
  const [p24Settings, setP24Settings] = useState<P24Settings>({ enabled: true, transfer: true, installments: false, paypo: false });
  // PayNow (umowa bezpośrednia, 2026-09-30): który operator obsługuje
  // blik/card/wallets/p24_transfer (routing z CRM, patrz payment-methods.tsx
  // -> resolveProvider) + siatka banków PayNow (dla "Przelew online", gdy
  // routing.transfer.provider === "paynow") + stan kodu BLIK, gdy
  // routing.blik.provider === "paynow" (White Label, wpisywane na naszej
  // stronie, bez przekierowania).
  const [paymentRouting, setPaymentRouting] = useState<PaymentRouting>({});
  const [paynowBanks, setPaynowBanks] = useState<P24Bank[]>([]);
  const [paynowBankId, setPaynowBankId] = useState<number>(0);
  const [paynowBlikCode, setPaynowBlikCode] = useState("");
  const [paynowPolling, setPaynowPolling] = useState(false);
  const [paynowPollTimeout, setPaynowPollTimeout] = useState(false);
  // Domyślnie WŁĄCZONE (do czasu odpowiedzi CRM): gdyby pobranie ustawień
  // z CRM nie doszło do skutku, klient i tak widzi przelew tradycyjny /
  // Przelewy24 - CRM i tak weryfikuje metodę przy tworzeniu zamówienia.
  const [transferSettings, setTransferSettings] = useState<TransferSettings>({
    enabled: true,
    accountHolder: "",
    accountNumber: "",
    bankName: "",
    holderAddress: "",
  });
  // For online payment, picking a delivery method and filling in the address
  // only drafts the order - it isn't real until the card/BLIK/... payment
  // actually goes through, so the cart stays intact until then. Cash-on-
  // delivery has no separate payment step, so it's "paid" the moment the
  // order is created (see submitOrder below).
  const [paymentConfirmed, setPaymentConfirmed] = useState(false);

  const sync = useCallback(() => {
    setItems(readCartItems());
    setHydrated(true);
    setBackHref(readLastPage());
  }, []);

  // Meta InitiateCheckout - raz, gdy klient wejdzie na /koszyk z niepustym
  // koszykiem (to jest moment "rozpoczęcia checkoutu").
  const initiateCheckoutSentRef = useRef(false);
  useEffect(() => {
    if (initiateCheckoutSentRef.current || !hydrated || items.length === 0) return;
    initiateCheckoutSentRef.current = true;
    const value = items.reduce((sum, it) => sum + it.total, 0);
    void import("@/lib/tracking")
      .then(({ track }) => {
        track("InitiateCheckout", {
          value,
          currency: "PLN",
          content_ids: items.map((it) => it.productSlug),
          contents: items.map((it) => ({ id: it.productSlug, quantity: it.qty, item_price: it.price })),
          num_items: items.reduce((sum, it) => sum + it.qty, 0),
        });
      })
      .catch(() => {});
  }, [hydrated, items]);

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
  // Real "wspólne rozliczenie obwodu" savings (see calcMoskitieryCombinedSavings()'s
  // own doc comment) - a preview of what quote_save.php recomputes and
  // enforces authoritatively server-side: a real price correction (not a
  // marketing discount) subtracted from the item subtotal BEFORE SEZON20/
  // the rescue discount, so those two must compute their own % off what's
  // left net of this, not the higher pre-correction subtotal (real live bug
  // 2026-09-11).
  const combinedSavings = calcMoskitieryCombinedSavings(items);
  // Do groszy, tak jak liczy CRM - inaczej "Razem" różniło się o grosz od
  // kwoty zamówienia (lib/cart.ts roundMoney).
  const rescueAmount = rescueGrant
    ? roundMoney(Math.max(0, (summary.total - combinedSavings) * (rescueGrant.percent / 100)))
    : 0;
  const orderSurcharge = calcCartOversizeSurcharge(items);
  const availableDeliveryMethods = getAvailableDeliveryMethods(items, summary.total);
  // Odbiór osobisty nigdy nie ma kosztu wysyłki - nic nie jest wysyłane.
  // Ile klient realnie oszczędza na tym koszyku - suma wszystkich rabatów
  // (kod, wspólne rozliczenie obwodu moskitier, rabat za zapisanie wyceny).
  // Pokazujemy to przy kwocie do zapłaty, bo inaczej rabat ginie w wierszach.
  const totalSavings =
    Math.round((combinedSavings + (appliedDiscount ? appliedDiscount.amount : 0) + rescueAmount) * 100) / 100;
  const freeShippingPilot = cartHasFreeShippingPilot(items);
  const shippingFee =
    deliveryMethod === PICKUP_METHOD.id || freeShippingPilot || summary.total >= FREE_SHIPPING_THRESHOLD
      ? 0
      : SHIPPING_FEE_AMOUNT;
  const amountToFreeShipping = freeShippingPilot ? 0 : Math.max(0, FREE_SHIPPING_THRESHOLD - summary.total);

  useEffect(() => {
    // Kurier zaznaczony z góry (właściciel, 2026-09-28): 65% wchodzących do
    // koszyka nie klikało żadnej metody i nigdy nie widziało pól formularza.
    // Zapamiętany wybór z draftu (restore wyżej) i tak nadpisze ten domyślny.
    if (deliveryMethod === "") {
      const courier = availableDeliveryMethods.find((method) => method.id === COURIER_METHOD.id) || availableDeliveryMethods[0];
      if (courier && items.length > 0) setDeliveryMethod(courier.id);
      return;
    }
    if (!availableDeliveryMethods.some((method) => method.id === deliveryMethod)) {
      setDeliveryMethod(availableDeliveryMethods[0].id);
    }
    // Re-check when the set of available methods changes - and once the cart
    // has loaded from storage (items.length flips 0 -> 1), because the method
    // ids alone stay identical and the default courier would never be set.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [availableDeliveryMethods.map((m) => m.id).join(","), items.length > 0]);

  // Kod pocztowy: myślnik wstawia się sam po dwóch cyfrach, a po pełnym kodzie
  // miasto uzupełnia się z bazy kodów (api.zippopotam.us, bez klucza, CORS).
  // Miasta wpisanego ręcznie nigdy nie nadpisujemy (2026-09-28).
  const cityAutoFilledRef = useRef("");
  function handlePostcodeChange(raw: string) {
    const digits = raw.replace(/\D+/g, "").slice(0, 5);
    const formatted = digits.length > 2 ? `${digits.slice(0, 2)}-${digits.slice(2)}` : digits;
    setForm((current) => ({ ...current, postcode: formatted }));
    if (digits.length !== 5) return;
    const code = formatted;
    void fetch(`https://api.zippopotam.us/pl/${code}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((json: { places?: Array<{ "place name"?: string }> } | null) => {
        const city = (json?.places?.[0]?.["place name"] || "").trim();
        if (!city) return;
        setForm((current) => {
          if (current.postcode !== code) return current;
          if (current.city.trim() !== "" && current.city !== cityAutoFilledRef.current) return current;
          cityAutoFilledRef.current = city;
          return { ...current, city };
        });
        trackCheckoutIssue("checkout_city_autofill", code, { city });
      })
      .catch(() => {});
  }
  // Telefon: prefiks +48 stoi przy etykiecie, więc wpisany "+48"/"0048"
  // znika, a cyfry układają się w grupy po trzy.
  function handlePhoneChange(raw: string) {
    let digits = raw.replace(/\D+/g, "");
    if (digits.startsWith("0048")) digits = digits.slice(4);
    else if (digits.startsWith("48") && digits.length > 9) digits = digits.slice(2);
    setForm((current) => ({ ...current, phone: formatPhoneInput(digits.slice(0, 9)) }));
  }

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

  // Payment method is no longer a separate choice - cash-on-delivery is one
  // of the delivery methods on the left, so it's derived straight from that.
  const p24KindAvailable = (kind: P24Kind) =>
    p24Settings.enabled &&
    ((kind === "p24_transfer" && p24Settings.transfer) ||
      (kind === "p24_installments" && p24Settings.installments) ||
      (kind === "p24_paypo" && p24Settings.paypo));
  // PayNow (2026-09-30): dla blik/card/wallets/p24_transfer/p24_paypo
  // operator może być stripe/p24 (jak dziś) ALBO paynow - sterowane z CRM.
  // installments nie ma wyboru operatora, zostaje zawsze P24 (jedyny
  // dostawca rat w tym sklepie).
  const selectedOnlineProvider: PaymentProvider =
    // BLIK: operator wyłącznie z ustawień CRM. Do 2026-10-02 był tu jeszcze
    // tryb podglądu (?paynow-podglad=1), który na siłę wskazywał PayNow -
    // służył do zrzutu ekranu wymaganego przy aktywacji White Label.
    // Aktywacja jest załatwiona, a tryb okazał się pułapką: wymuszał
    // płatność, która nie mogła się udać, i kończył się błędem 502.
    onlinePaymentKind === "blik"
      ? resolveProvider(paymentRouting, "blik", "stripe")
      : onlinePaymentKind === "card" || onlinePaymentKind === "wallets"
        ? resolveProvider(paymentRouting, onlinePaymentKind, "stripe")
        : onlinePaymentKind === "p24_transfer"
          ? resolveProvider(paymentRouting, "transfer", "p24")
          : onlinePaymentKind === "p24_paypo"
            ? resolveProvider(paymentRouting, "paypo", "p24")
            : "stripe";
  const paymentMethod: "online" | "cod" | "transfer" | "p24" | "paynow" =
    deliveryMethod === COD_DELIVERY_METHOD_ID
      ? "cod"
      : onlinePaymentKind === "transfer" && transferSettings.enabled
        ? "transfer"
        : (onlinePaymentKind === "blik" ||
              onlinePaymentKind === "card" ||
              onlinePaymentKind === "wallets" ||
              onlinePaymentKind === "p24_transfer" ||
              onlinePaymentKind === "p24_paypo") &&
            selectedOnlineProvider === "paynow"
          ? "paynow"
          : onlinePaymentKind.startsWith("p24_") && p24KindAvailable(onlinePaymentKind as P24Kind)
            ? "p24"
            : "online";
  const p24Kind: P24Kind = onlinePaymentKind.startsWith("p24_") ? (onlinePaymentKind as P24Kind) : "p24_transfer";
  const stripeMethod: StripeMethod =
    onlinePaymentKind === "card" || onlinePaymentKind === "wallets" ? onlinePaymentKind : "blik";
  // Rodzaj płatności PayNow (bare kind dla CRM): blik/card/paypo wprost,
  // wszystko inne (p24_transfer routowany na paynow) to "pbl".
  const paynowKind: "pbl" | "blik" | "card" | "paypo" =
    onlinePaymentKind === "blik"
      ? "blik"
      : onlinePaymentKind === "card" || onlinePaymentKind === "wallets"
        ? "card"
        : onlinePaymentKind === "p24_paypo"
          ? "paypo"
          : "pbl";

  const editingItem = editingItemId ? items.find((item) => item.id === editingItemId) || null : null;

  // Paczkomat nie potrzebuje adresu klienta: przesyłka jedzie do punktu, a
  // adres punktu doklejamy do zamówienia przy wysyłce (patrz submitOrder).
  const requiresAddress =
    deliveryMethod !== "" && deliveryMethod !== "odbior-osobisty" && deliveryMethod !== PACZKOMAT_METHOD.id;
  // E-mail is mandatory (not just "phone or e-mail" any more) - it's what
  // gets pre-filled into the Stripe payment form and used for the receipt.
  const emailValid = /\S+@\S+\.\S+/.test(form.email.trim());
  const contactReady =
    form.firstName.trim() !== "" && form.lastName.trim() !== "" && isValidPhone(form.phone) && emailValid;
  // Per-field "is this one correctly filled in?" booleans - used both for
  // the subtle-accent/green-checkmark feedback on each input (see
  // CartFieldStatus) *and*, as of now, for the actual readiness gates right
  // below. postcodeFieldValid/invoiceStreetFieldValid/
  // invoicePostcodeFieldValid/invoiceCityFieldValid used to exist only for
  // the checkmark - addressReady/invoiceReady never checked them, so the
  // auto-submit effect further down (which creates the real order + Stripe
  // PaymentIntent) could fire the moment city+street were filled in, even
  // with an empty/malformed postcode still sitting in the field, or with a
  // company name but no street/postcode/city on an invoice.
  const firstNameFieldValid = form.firstName.trim() !== "";
  const lastNameFieldValid = form.lastName.trim() !== "";
  const phoneFieldValid = isValidPhone(form.phone);
  const cityFieldValid = form.city.trim() !== "";
  const postcodeFieldValid = /^\d{2}-?\d{3}$/.test(form.postcode.trim());
  // Real live bug 2026-09-11: multiple paid orders shipped with a truncated
  // street address ("Krz", "Pl", "S", "Plac", "Zucha", "Reja", ...) - a
  // single non-blank character already satisfied this before, so the
  // auto-submit effect below could fire (after its debounce) with whatever
  // partial text sat in the field the moment the customer paused typing
  // mid-address, and nothing ever re-sends the finished address afterward
  // (see the resync effect further down, added to close that second half of
  // the gap). Requiring a plausible length AND a digit (a Polish street
  // address essentially always has a house/building number) makes a
  // genuinely unfinished fragment fail this check instead of quietly
  // "validating".
  // Wieś bez nazw ulic: tam CAŁY adres to numer domu ("65", "12a", "13/4") i
  // takiego zamówienia nie wolno blokować (zgłoszenie klientki, 2026-09-29 -
  // poprzedniego dnia wymóg litery odciął jej checkout). Miejscowość jest w
  // polu "Miasto", a na etykietę skleja ją CRM (_shipment_order_prefill.php).
  // Wszystko inne musi wyglądać jak prawdziwy adres: długość, cyfra i litera.
  const trimmedAddress1 = form.address1.trim();
  const looksLikeHouseNumberOnly = /^\d+\s*[a-zA-Z]?(\s*[/-]\s*\d+\s*[a-zA-Z]?)?$/.test(trimmedAddress1);
  const address1FieldValid =
    looksLikeHouseNumberOnly ||
    (trimmedAddress1.length >= 5 && /\d/.test(trimmedAddress1) && /\p{L}/u.test(trimmedAddress1));
  const nipFieldValid = invoice.nip.trim().length === 10;
  const companyNameFieldValid = invoice.companyName.trim() !== "";
  const invoiceStreetFieldValid = invoice.street.trim() !== "";
  const invoicePostcodeFieldValid = /^\d{2}-?\d{3}$/.test(invoice.postcode.trim());
  const invoiceCityFieldValid = invoice.city.trim() !== "";
  const addressReady =
    !requiresAddress || (cityFieldValid && address1FieldValid && postcodeFieldValid && !address1Focused);
  const paczkomatReady = deliveryMethod !== PACZKOMAT_METHOD.id || selectedPaczkomat !== null;
  const buyerNameValid = buyer.name.trim().length >= 3;
  const buyerEmailValid = /\S+@\S+\.\S+/.test(buyer.email.trim());
  // Blok kupującego jest dobrowolny, ale jak już ktoś go otworzy, to musi
  // dać nazwę i e-mail - inaczej zamówienie miałoby dwa zestawy danych,
  // z czego jeden pusty.
  const buyerReady = !buyerDifferent || (buyerNameValid && buyerEmailValid);
  const invoiceReady =
    !wantsInvoice ||
    (nipFieldValid && companyNameFieldValid && invoiceStreetFieldValid && invoicePostcodeFieldValid && invoiceCityFieldValid);
  // The payment section itself is always rendered (see JSX below) - this
  // just controls whether it's locked/greyed out or interactive.
  const deliveryDataReady =
    deliveryMethod !== "" && contactReady && addressReady && paczkomatReady && invoiceReady && buyerReady && items.length > 0;
  const paymentReady =
    paymentMethod === "online" || paymentMethod === "transfer" || paymentMethod === "p24" || codSms.status === "verified";
  const checkoutReady = deliveryDataReady && paymentReady;
  // Delivery/address data stays editable even once a draft order (and its
  // Stripe payment form) already exists - a typo fix shouldn't require
  // starting over. It only locks once the order is genuinely final: paid
  // online, or cash-on-delivery (which has no further payment step at all).
  // Audit 2026-09-13: locked the moment a draft order exists, online too -
  // the PaymentIntent's amount and the order's address are fixed to what
  // the draft was created with (see the removed resync effect's post-mortem
  // below). "Zmień dane zamówienia" in the payment panel drops the draft
  // (unmounting its Stripe form first) and unlocks everything again.
  const dataLocked = paymentConfirmed || orderState !== null;
  // What the customer will actually pay right now - the "Razem" row and the
  // mobile sticky bar both read this one value.
  // Pasek na górze koszyka mówi o zawartości koszyka, nie o moskitierach:
  // jeden produkt = jego komunikaty, kilka różnych = wersja neutralna
  // (właściciel/audyt 2026-09-24: przy plisie leciało "gwarancji na
  // moskitiery" i "Ekspres do 12:00", którego dla plis w ogóle nie ma).
  const cartSlugs = Array.from(new Set(items.map((item) => item.productSlug).filter(Boolean)));
  const cartPromoSlug = cartSlugs.length === 1 ? cartSlugs[0] : cartSlugs.length ? "mixed" : "moskitiery-ramkowe";

  const payableTotal = Math.max(
    0,
    summary.total -
      combinedSavings -
      (appliedDiscount?.amount || 0) -
      rescueAmount +
      shippingFee +
      orderSurcharge +
      expressFee +
      (paymentMethod === "cod" ? COD_SURCHARGE_AMOUNT : 0),
  );

  // Kwota do zapłaty zmienia się w koszyku (dostawa, pobranie, ekspres,
  // kod rabatowy), a dashboard CRM pokazuje przy osobie online to, co klient
  // ma przed oczami - więc po każdej zmianie (z sekundą wyciszenia, żeby nie
  // strzelać przy każdym kliknięciu) leci jedno lekkie zdarzenie.
  const lastReportedAmountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    const report = () => {
      if (lastReportedAmountRef.current === payableTotal) return;
      lastReportedAmountRef.current = payableTotal;
      trackCheckoutIssue("cart_amount", String(items.length), {
        cart_total: summary.total,
        cart_total_payable: payableTotal,
        cart_positions: items.length,
        delivery: deliveryMethod || null,
        payment: paymentMethod || null,
      });
    };
    // Pierwszy raport leci OD RAZU, bez wyciszenia. Wyciszenie ma sens
    // dopiero przy kolejnych zmianach (klikanie dostawy/ekspresu), ale na
    // wejściu kosztowało realną wiedzę: z 571 sesji, które weszły do
    // koszyka w 30 dni, 311 nie dożyło tych 1,1 s i CRM nie dostał od nich
    // ani jednej kwoty po rabacie. Zgłoszenie właściciela 2026-10-02:
    // w tooltipie "osoby na stronie" widział kwotę sprzed rabatu - bo
    // view_cart celowo jej nie nosi, a cart_amount nie zdążał polecieć.
    if (lastReportedAmountRef.current === null) {
      report();
      return;
    }
    const timer = window.setTimeout(report, 1100);
    return () => window.clearTimeout(timer);
  }, [hydrated, payableTotal, items.length, summary.total, deliveryMethod, paymentMethod]);

  // Mobile checkout "Dalej" (Next) buttons - real feedback: "Dużo osób nam
  // nie wybiera metody płatności" (lots of people never pick a payment
  // method), because on a phone it's stacked below everything else and easy
  // to just never scroll to. First attempt auto-scrolled reactively the
  // instant each section's fields read as "valid" - live feedback 2026-09-07:
  // that fired after typing just the *first character* into whichever field
  // happened to be the last empty one, because several of these validity
  // checks are deliberately lenient ("non-empty", not "correctly formatted" -
  // e.g. phoneFieldValid) for the inline checkmark UI, never meant to gate an
  // irreversible page jolt. A manual "Dalej" button - enabled once the
  // section really is complete, advancing only on an explicit tap - has none
  // of that footgun and gives the customer control over the timing.
  const shippingAddressSectionRef = useRef<HTMLElement | null>(null);
  const paymentSectionRef = useRef<HTMLElement | null>(null);

  function scrollToSection(ref: React.RefObject<HTMLElement | null>) {
    ref.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  // The moment the order is genuinely final (COD - nothing further to pay,
  // or online payment confirmed) - swap the whole cart/checkout layout for a
  // dedicated thank-you view instead of leaving the (now pointless) delivery
  // method + address form sitting there with just a one-line note appended.
  const orderConfirmed =
    orderState !== null &&
    (orderState.paymentProvider === "cod" || orderState.paymentProvider === "transfer" || paymentConfirmed);
  const orderTrackingLink =
    orderState !== null
      ? `/zamowienie/${encodeURIComponent(orderState.orderCode)}${
          orderState.accessToken ? `?access_token=${encodeURIComponent(orderState.accessToken)}` : ""
        }`
      : "";

  // Switching to/away from the cash-on-delivery delivery method invalidates
  // any in-progress/verified SMS code - start that mini-flow over.
  useEffect(() => {
    setCodSms({ status: "idle", token: "", code: "", error: "" });
  }, [paymentMethod]);

  // Snapshot of the data a draft order/PaymentIntent was actually created
  // with. If the customer edits anything after that (still possible - see
  // dataLocked above), the existing draft no longer matches what they typed,
  // so it's dropped and a fresh one gets created automatically (same debounced
  // auto-submit effect as the first time).
  // Just for the thank-you screen's "masz pytania?" line - same site config
  // the homepage header already shows, fetched directly (this page has never
  // pulled in the shared site-content loader, which is a server-only cache()
  // helper anyway).
  const [siteContact, setSiteContact] = useState<{ phone: string; email: string }>({ phone: "", email: "" });
  // Per-product price correction ("Korekta ceny (%)", lib/price-adjustment.ts)
  // was only ever fed on the homepage - here it stayed at 0, so "Edytuj
  // pozycję" re-priced an item WITHOUT it: the first plisy order
  // (2026-09-17, 462/09/2026) left the cart at 175,49 for a blind the
  // landing sells at 157,94 (-10 %). Same config the homepage pulls.
  useEffect(() => {
    fetch(`https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public?_ts=${Date.now()}`, { cache: "no-store" })
      .then((response) => response.json())
      .then((json) => {
        if (json?.ok && json.config && typeof json.config === "object") setProductPriceAdjustmentsFromConfig(json.config);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    fetch("https://crm-keika.groovemedia.pl/biuro/api/shop-public/site")
      .then((response) => response.json())
      .then((json) => {
        const site = json?.site || json;
        setSiteContact({
          phone: typeof site?.contact_phone === "string" ? site.contact_phone : "",
          email: typeof site?.contact_email === "string" ? site.contact_email : "",
        });
        const checkout = json?.checkout && typeof json.checkout === "object" ? json.checkout : null;
        if (checkout) {
          const accountNumber = typeof checkout.transfer_account_number === "string" ? checkout.transfer_account_number.trim() : "";
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
          setPaymentRouting(
            checkout.payment_routing && typeof checkout.payment_routing === "object" ? checkout.payment_routing : {},
          );
          // Wyłącznik testu nowego koszyka: udział 0 = wszyscy stary koszyk.
          if (typeof checkout.cart_v2_share === "number") {
            const share = rememberCartV2Share(checkout.cart_v2_share);
            if (share === 0 && !cartDesignForcedRef.current) setCartDesign((current) => (current === "v2" ? "classic" : current));
          }
        }
      })
      .catch(() => {});
  }, []);

  // Banki Przelewy24 do siatki "wybierz swój bank".
  useEffect(() => {
    fetch("https://crm-keika.groovemedia.pl/biuro/api/shop-public/p24_banks")
      .then((response) => response.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.banks)) {
          setP24Banks(
            json.banks
              .filter((b: unknown) => b && typeof b === "object")
              .map((b: { id?: unknown; name?: unknown; img?: unknown }) => ({
                id: Number(b.id) || 0,
                name: String(b.name || ""),
                img: String(b.img || ""),
              }))
              .filter((b: P24Bank) => b.id > 0 && b.name),
          );
        }
      })
      .catch(() => {});
  }, []);

  // Banki PayNow do tej samej siatki "wybierz swój bank" - pokazana tylko
  // gdy routing.transfer.provider === "paynow" (patrz renderMethodPanel).
  useEffect(() => {
    fetch("https://crm-keika.groovemedia.pl/biuro/api/shop-public/paynow_banks")
      .then((response) => response.json())
      .then((json) => {
        if (json?.ok && Array.isArray(json.banks)) {
          setPaynowBanks(
            json.banks
              .filter((b: unknown) => b && typeof b === "object")
              .map((b: { id?: unknown; name?: unknown; img?: unknown }) => ({
                id: Number(b.id) || 0,
                name: String(b.name || ""),
                img: String(b.img || ""),
              }))
              .filter((b: P24Bank) => b.id > 0 && b.name),
          );
        }
      })
      .catch(() => {});
  }, []);

  const draftSnapshotRef = useRef("");
  // The quote_code from this checkout session's last successful save, if
  // any - threaded back into buildQuotePayloadFromCart() below so a
  // resubmission (see the reset-effect further down: any edit while a
  // PaymentIntent is already in flight tears it down and re-submits)
  // *updates the same quote row* instead of minting an entirely new,
  // independently-validated one each time. shop_public_orders_create()
  // (CRM side) already reuses the same order_code for exactly this reason
  // ("Reuse a recent still-unpaid draft... instead of stacking a new one")
  // - this brings the quote layer in line with that same intent, so a
  // struggling/retried checkout produces one continuously-revalidated quote
  // instead of several independent ones that could in principle disagree
  // with each other (each is still always re-validated fresh server-side
  // regardless - this only removes the *duplication*, not the validation).
  const lastQuoteCodeRef = useRef("");
  const orderStateRef = useRef(orderState);
  useEffect(() => {
    orderStateRef.current = orderState;
    rescueDraftGraceRef.current = orderState !== null;
  }, [orderState]);
  // Only re-create the order/PaymentIntent when something that actually
  // changes the *charged amount* changes (items, delivery method, an
  // applied discount) - not on every keystroke in the contact/address/
  // invoice fields, which is what this used to do (the snapshot included
  // `form`/`invoice`/`wantsInvoice`). Real customer impact, confirmed live
  // in Stripe: a single ~600 zł order accumulated *six* abandoned
  // PaymentIntents in three minutes, all "Incomplete" with no payment
  // method attached at all - the customer was just fixing a typo in their
  // address/phone while the payment form was already up, and each edit
  // silently threw away the in-progress PaymentIntent and minted a new one
  // underneath them, exactly the kind of churn that makes a checkout feel
  // broken even when the eventual attempt succeeds. The comment on
  // `dataLocked` above already documented the *intended* behaviour ("a typo
  // fix shouldn't require starting over") - this brings the code in line
  // with it instead of contradicting it.
  useEffect(() => {
    const snapshot = JSON.stringify({ items, deliveryMethod, appliedDiscount, expressSelected, rescue: rescueSnapshotKey });
    const current = orderStateRef.current;
    if (
      current &&
      current.paymentProvider !== "cod" &&
      current.paymentProvider !== "transfer" &&
      !paymentConfirmed &&
      draftSnapshotRef.current &&
      draftSnapshotRef.current !== snapshot
    ) {
      setOrderState(null);
      setError("");
      submittedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, deliveryMethod, appliedDiscount, expressSelected, paymentConfirmed, rescueSnapshotKey]);

  async function sendCodSms(phoneOverride?: string) {
    const phone = phoneOverride ?? form.phone;
    setCodSms({ status: "sending", token: "", code: "", error: "" });
    try {
      // Same total the "Razem" row shows once cash-on-delivery is picked -
      // included in the SMS text so the customer sees the exact amount
      // they're committing to accept on delivery, not just the code.
      const codTotal = Math.max(
        0,
        summary.total -
          combinedSavings -
          (appliedDiscount?.amount || 0) -
          rescueAmount +
          shippingFee +
          orderSurcharge +
          expressFee +
          COD_SURCHARGE_AMOUNT,
      );
      const response = await fetch("https://crm-keika.groovemedia.pl/biuro/api/shop-public/cod_sms_start.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          name: form.firstName,
          amount: codTotal.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        }),
      });
      const json = (await response.json()) as CodSmsStartResponse;
      if (!json.ok || !json.verification_token) {
        throw new Error(json.error || "Nie udało się wysłać kodu SMS.");
      }
      setCodSms({ status: "sent", token: json.verification_token, code: "", error: json.notice || "" });
      if (json.reused) {
        // Serwer nie wysłał nowego SMS-a - liczymy to osobno, żeby
        // statystyki nie pokazywały trzech SMS-ów tam, gdzie poszedł jeden.
        trackCheckoutIssue("checkout_cod_sms_reused", "cod");
      } else {
        setCodSentAt(Date.now());
        trackCheckoutIssue("checkout_cod_sms_sent", "cod");
      }
    } catch (smsError) {
      const message = smsError instanceof Error ? smsError.message : "Nie udało się wysłać kodu SMS.";
      setCodSms({ status: "error", token: "", code: "", error: message });
      trackCheckoutIssue("checkout_error", "cod_sms_send_failed", { message });
    }
  }

  async function verifyCodSms() {
    setCodSms((current) => ({ ...current, status: "verifying", error: "" }));
    try {
      const response = await fetch("https://crm-keika.groovemedia.pl/biuro/api/shop-public/cod_sms_verify.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verification_token: codSms.token, phone: form.phone, code: codSms.code }),
      });
      const json = (await response.json()) as CodSmsVerifyResponse;
      if (!json.ok || !json.verified) {
        throw new Error(json.error || "Niepoprawny kod SMS.");
      }
      setCodSms((current) => ({ ...current, status: "verified", error: "" }));
      // Kod wpisany przy metodzie płatności (okno zamknięte) - otwieramy je
      // teraz, bo tylko ono pokazuje "Potwierdzamy zamówienie…" i ewentualny
      // błąd składania. Przy wpisaniu w oknie to i tak nic nie zmienia.
      setCodModalOpen(true);
      trackCheckoutIssue("checkout_cod_verified", "cod");
    } catch (smsError) {
      const message = smsError instanceof Error ? smsError.message : "Niepoprawny kod SMS.";
      setCodSms((current) => ({ ...current, status: "sent", error: message }));
      trackCheckoutIssue("checkout_error", "cod_sms_verify_failed", { message });
    }
  }

  async function checkDiscountCode(codeOverride?: string) {
    const code = (codeOverride ?? discountCodeInput).trim();
    if (!code) return;
    setDiscountChecking(true);
    setDiscountError("");
    try {
      const response = await fetch("https://crm-keika.groovemedia.pl/biuro/api/shop-public/discount_code_check.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Net of the real "wspólne rozliczenie obwodu" price correction
        // (combinedSavings) - that correction isn't a marketing discount,
        // but SEZON20's own % must be computed off what's actually left to
        // discount, not the higher pre-correction subtotal (real live bug
        // 2026-09-11 - see quote_save.php's own fix for the authoritative
        // half of this).
        body: JSON.stringify({ code, subtotal: Math.max(0, summary.total - combinedSavings) }),
      });
      const json = (await response.json()) as DiscountCheckResponse;
      if (!json.ok || !json.discount) {
        throw new Error(json.error || "Nieprawidłowy kod rabatowy.");
      }
      setAppliedDiscount(json.discount);
      setDiscountCodeInput(json.discount.code);
      trackCheckoutIssue("checkout_discount_applied", json.discount.code);
    } catch (checkError) {
      setAppliedDiscount(null);
      setDiscountError(checkError instanceof Error ? checkError.message : "Nie udało się sprawdzić kodu.");
      trackCheckoutIssue("discount_code_invalid", code);
    } finally {
      setDiscountChecking(false);
    }
  }

  // An APPLIED code is re-validated whenever the discountable subtotal
  // changes (2026-09-17): the first plisy order removed one of two blinds
  // after typing SEZON20, the cart kept showing the two-blind 63,90 zł
  // discount (total 126,49) while quote_save.php's own recompute charged
  // the right 35,10 (155,29) - the customer saw one number and got another.
  const appliedDiscountSubtotalRef = useRef<number | null>(null);
  useEffect(() => {
    if (!appliedDiscount) {
      appliedDiscountSubtotalRef.current = null;
      return;
    }
    const subtotal = Math.round(Math.max(0, summary.total - combinedSavings) * 100) / 100;
    if (appliedDiscountSubtotalRef.current === null) {
      appliedDiscountSubtotalRef.current = subtotal;
      return;
    }
    if (Math.abs(appliedDiscountSubtotalRef.current - subtotal) < 0.005) return;
    appliedDiscountSubtotalRef.current = subtotal;
    if (subtotal <= 0) {
      setAppliedDiscount(null);
      return;
    }
    void checkDiscountCode(appliedDiscount.code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedDiscount, summary.total, combinedSavings]);

  // Silent, error-swallowing preview of the standing SEZON20 promo (distinct
  // from checkDiscountCode above, which is user-triggered and surfaces
  // errors) - refetched whenever the subtotal changes since the code's
  // discount amount depends on it, skipped entirely once any code (SEZON20
  // or otherwise) is actually applied.
  useEffect(() => {
    if (appliedDiscount || summary.total <= 0) {
      setSezon20Promo(null);
      return;
    }
    let cancelled = false;
    // Net of combinedSavings - same "SEZON20's % is computed off what's left
    // after the real wspólne-rozliczenie-obwodu correction" fix as
    // checkDiscountCode above.
    fetch("https://crm-keika.groovemedia.pl/biuro/api/shop-public/discount_code_check.php", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: "SEZON20", subtotal: Math.max(0, summary.total - combinedSavings) }),
    })
      .then((response) => response.json())
      .then((json: DiscountCheckResponse) => {
        if (cancelled) return;
        setSezon20Promo(json.ok && json.discount ? json.discount : null);
      })
      .catch(() => {
        if (!cancelled) setSezon20Promo(null);
      });
    return () => {
      cancelled = true;
    };
  }, [appliedDiscount, summary.total, combinedSavings]);

  function applySezon20Promo() {
    setDiscountCodeInput("SEZON20");
    void checkDiscountCode("SEZON20");
  }

  function removeDiscountCode() {
    setAppliedDiscount(null);
    setDiscountCodeInput("");
    setDiscountError("");
  }

  /** Same three surcharge positions submitOrder() below builds, just read
   * here too - kept as its own small builder rather than hoisting
   * submitOrder's own array out, since that one is deliberately built fresh
   * at actual-submit time (this only needs a snapshot for the share link,
   * never anything that has to match to the cent at the exact instant of
   * payment). */
  function buildCurrentExtraCharges(): ExtraCharge[] {
    return [
      {
        id: "position-oversize-surcharge",
        slug: "doplata-przesylka-dlugosciowa",
        label: "Dopłata za przesyłkę dłużycową",
        amount: orderSurcharge,
        summary: "Dopłata za przesyłkę dłużycową (jednorazowo dla całego zamówienia)",
      },
      {
        id: "position-shipping-fee",
        slug: "koszt-dostawy",
        label: "Koszt dostawy",
        amount: shippingFee,
        summary: `Koszt dostawy (poniżej progu darmowej dostawy ${FREE_SHIPPING_THRESHOLD} zł)`,
      },
      {
        id: "position-cod-fee",
        slug: "doplata-platnosc-za-pobraniem",
        label: "Dopłata za płatność za pobraniem",
        amount: paymentMethod === "cod" ? COD_SURCHARGE_AMOUNT : 0,
        summary: "Dopłata za płatność za pobraniem",
      },
      {
        id: "position-express-fee",
        slug: EXPRESS_POSITION_SLUG,
        label: EXPRESS_LABEL,
        amount: expressFee,
        summary: EXPRESS_SUMMARY,
      },
    ];
  }

  /** Always resolves to something shareable - mirrors
   * save-share-widget.tsx's own ensureLink(), just without that component's
   * "in-progress configurator draft" tier (there's no configurator open on
   * this page, only a real cart) - the cart snapshot IS the draft here. */
  async function ensureCartShareLink(): Promise<ShareLink> {
    if (cartShareLink) return cartShareLink;
    if (items.length === 0) {
      const fallback: ShareLink = { quoteCode: "", resumeToken: "", url: window.location.href };
      setCartShareLink(fallback);
      return fallback;
    }

    let sessionToken = "";
    try {
      sessionToken = window.sessionStorage.getItem("keika_shop_session_token") || "";
    } catch {
      // sessionStorage niedostępny - link i tak się utworzy.
    }

    setCartShareSaving(true);
    const payload = buildQuotePayloadFromCart(items, buildCurrentExtraCharges(), appliedDiscount, rescueGrant);
    const result = await saveQuoteForSharing({
      positions: payload.positions,
      sessionToken,
      productSlug: payload.product_slug,
      promoCode: isPromoActive() ? PROMO_CODE : undefined,
    });
    setCartShareSaving(false);

    const resolved: ShareLink = result || { quoteCode: "", resumeToken: "", url: window.location.href };
    setCartShareLink(resolved);
    return resolved;
  }

  function openCartShareModal() {
    setCartShareModalOpen(true);
    setCartShareSendOpen(false);
    setCartShareSendValue("");
    setCartShareSendStatus("idle");
    void ensureCartShareLink();
  }

  async function handleCartShareCopyLink() {
    const result = await ensureCartShareLink();
    try {
      await navigator.clipboard.writeText(result.url);
      setCartShareCopyState("copied");
      window.setTimeout(() => setCartShareCopyState("idle"), 2200);
    } catch {
      // Schowek niedostępny - link jest już widoczny w modalu do ręcznego skopiowania.
    }
  }

  async function handleCartShareNativeShare() {
    const result = await ensureCartShareLink();
    try {
      await navigator.share({
        title: "KEIKA",
        text: "Mój koszyk KEIKA - link do wznowienia:",
        url: result.url,
      });
    } catch {
      // Użytkownik zamknął arkusz udostępniania albo API nie jest wsparte -
      // link jest już widoczny w modalu jako fallback.
    }
  }

  function looksLikeShareEmail(value: string): boolean {
    return /.+@.+\..+/.test(value);
  }
  function looksLikeSharePhone(value: string): boolean {
    return value.replace(/\D/g, "").length >= 9;
  }

  async function handleCartShareSendSubmit(event: React.FormEvent) {
    event.preventDefault();
    const value = cartShareSendValue.trim();
    const isEmail = looksLikeShareEmail(value);
    const isPhone = !isEmail && looksLikeSharePhone(value);
    if (!isEmail && !isPhone) return;
    const result = await ensureCartShareLink();
    if (!result.quoteCode) {
      setCartShareSendStatus("error");
      return;
    }
    setCartShareSendStatus("sending");
    const sendResult = await sendShareLink({
      quoteCode: result.quoteCode,
      resumeToken: result.resumeToken,
      email: isEmail ? value : undefined,
      phone: isPhone ? value : undefined,
    });
    setCartShareSendStatus(sendResult.ok ? "sent" : "error");
  }

  const canNativeShareCart = typeof navigator !== "undefined" && typeof navigator.share === "function";

  // A promo code activated from the configurator's own SEZON20 banner (see
  // ConfiguratorPanel.tsx's ACTIVE_PROMO_STORAGE_KEY) shows up here already
  // applied - the customer doesn't retype anything. Guarded so it only ever
  // auto-applies once per page load, never fights a code the customer
  // already typed/removed by hand in this same session.
  const autoAppliedPromoRef = useRef(false);
  useEffect(() => {
    if (autoAppliedPromoRef.current || appliedDiscount || summary.total <= 0) return;
    // isPromoActive() checks the cookie first, localStorage second - reading
    // localStorage directly here (as this used to) missed the cookie
    // entirely, which is exactly what broke this for a customer arriving
    // from a Facebook link (Facebook's in-app browser can silently
    // partition/block localStorage - see lib/promo.ts).
    const storedCode = isPromoActive(PROMO_CODE) ? PROMO_CODE : "";
    if (!storedCode) return;
    autoAppliedPromoRef.current = true;
    setDiscountCodeInput(storedCode);
    void checkDiscountCode(storedCode);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [summary.total]);

  const submitOrder = useCallback(async (opts?: { stripeMethod?: StripeMethod; p24MethodId?: number; paynowMethodId?: number; paynowBlikCode?: string; wallet?: WalletContact }): Promise<CreatedIntent | null> => {
    if (submittedRef.current) return null;
    submittedRef.current = true;
    // Portfel (Apple Pay / Google Pay, 2026-09-28): dane odbiorcy z arkusza
    // portfela, dostawa kurierem, płatność online, regulamin zaakceptowany
    // kliknięciem w portfel (adnotacja pod przyciskami). Reszta ścieżki -
    // wycena, zamówienie w CRM, PaymentIntent - identyczna jak dla karty.
    const w = opts?.wallet;
    const f = w
      ? { ...form, firstName: w.firstName, lastName: w.lastName, email: w.email, phone: w.phone, address1: w.address1, postcode: w.postcode, city: w.city }
      : form;
    const dm = w ? COURIER_METHOD.id : deliveryMethod;
    const pm = w ? "online" : paymentMethod;
    const ta = w ? true : termsAccepted;
    const bd = w ? false : buyerDifferent;
    const wi = w ? false : wantsInvoice;
    const sp = w ? null : selectedPaczkomat;
    draftSnapshotRef.current = JSON.stringify({ items, deliveryMethod: dm, appliedDiscount, expressSelected, rescue: rescueSnapshotKey });
    setError("");
    setIsSubmitting(true);
    try {
      const extraCharges: ExtraCharge[] = [
        {
          id: "position-oversize-surcharge",
          slug: "doplata-przesylka-dlugosciowa",
          label: "Dopłata za przesyłkę dłużycową",
          amount: orderSurcharge,
          summary: "Dopłata za przesyłkę dłużycową (jednorazowo dla całego zamówienia)",
        },
        {
          id: "position-shipping-fee",
          slug: "koszt-dostawy",
          label: "Koszt dostawy",
          amount: shippingFee,
          summary: `Koszt dostawy (poniżej progu darmowej dostawy ${FREE_SHIPPING_THRESHOLD} zł)`,
        },
        {
          id: "position-cod-fee",
          slug: "doplata-platnosc-za-pobraniem",
          label: "Dopłata za płatność za pobraniem",
          amount: pm === "cod" ? COD_SURCHARGE_AMOUNT : 0,
          summary: "Dopłata za płatność za pobraniem",
        },
        {
          id: "position-express-fee",
          slug: EXPRESS_POSITION_SLUG,
          label: EXPRESS_LABEL,
          amount: expressFee,
          summary: EXPRESS_SUMMARY,
        },
      ];
      let quoteSessionToken = "";
      try {
        quoteSessionToken = window.sessionStorage.getItem("keika_shop_session_token") || "";
      } catch {
        // sessionStorage niedostępny - wycena i tak się zapisze.
      }
      const quotePayload = {
        ...buildQuotePayloadFromCart(items, extraCharges, appliedDiscount, rescueGrant),
        // Reuse this checkout session's own quote_code if we already have
        // one (see lastQuoteCodeRef's doc comment above) - quote_save.php
        // re-validates the discount fresh from these exact positions either
        // way, this just makes it update the same row instead of a new one.
        quote_code: lastQuoteCodeRef.current || "",
        session_token: quoteSessionToken,
        // The configurator-side quote that may carry a frozen 7-day price
        // (2026-09-26) - quote_save.php honours its promo_deadline_at even
        // when this checkout row is a different, fresh quote_code.
        promo_quote_code: getTrackedPromoQuoteCode(),
      };
      const quoteResponse = await saveShopQuote(quotePayload);
      const quoteCode = quoteResponse.quote.quote_code;
      lastQuoteCodeRef.current = quoteCode;

      const deliveryLabel =
        [COURIER_METHOD, PACZKOMAT_METHOD, COD_DELIVERY_METHOD, PICKUP_METHOD].find(
          (method) => method.id === dm,
        )?.label || "";
      const paczkomatLine =
        dm === PACZKOMAT_METHOD.id && sp
          ? `Paczkomat: ${sp.id} - ${sp.address}`
          : "";
      const paymentLabel =
        pm === "cod"
          ? "Za pobraniem"
          : pm === "transfer"
            ? "Przelew tradycyjny"
            : pm === "p24"
              ? P24_KIND_LABELS[p24Kind].note
              : pm === "paynow"
                ? "PayNow – " +
                  (paynowKind === "blik"
                    ? "BLIK"
                    : paynowKind === "card"
                      ? "karta"
                      : paynowKind === "paypo"
                        ? "PayPo"
                        : "przelew online")
                : (opts?.stripeMethod || stripeMethod) === "blik"
                  ? "BLIK (Stripe)"
                  : (opts?.stripeMethod || stripeMethod) === "wallets"
                    ? "Google Pay / Apple Pay (Stripe)"
                    : "Karta płatnicza (Stripe)";
      const noteWithDelivery = [
        // First line on purpose - production reads the note top-down.
        expressEligible && expressSelected ? EXPRESS_NOTE_LINE : "",
        `Metoda dostawy: ${deliveryLabel}`,
        paczkomatLine,
        `Metoda płatności: ${paymentLabel}`,
        f.note.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");

      // Kupujący inny niż odbiorca ląduje też w notatce - biuro widzi to od
      // razu na zamówieniu, bez zaglądania w payload.
      const noteWithBuyer = bd
        ? [
            noteWithDelivery,
            [
              "Kupujący (inny niż odbiorca):",
              buyer.name.trim(),
              [buyer.street.trim(), [buyer.postcode.trim(), buyer.city.trim()].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join(", "),
              [buyer.email.trim(), buyer.phone.trim()].filter(Boolean).join(" · "),
            ]
              .filter(Boolean)
              .join("\n"),
          ]
            .filter(Boolean)
            .join("\n\n")
        : noteWithDelivery;

      // Atrybucja Meta/UTM (fbp, fbc, fbclid, utm_*, landing_url, ua) - serwer
      // CRM użyje jej do serwerowego Purchase w Meta CAPI (event_id = order_code).
      let tracking: Record<string, string> = {};
      try {
        const mod = await import("@/lib/tracking");
        tracking = mod.getAttributionPayload();
      } catch {
        /* tracking never blocks checkout */
      }

      // Site-wide analytics session token (see lib/track-step.ts /
      // site-analytics.tsx) - lets the CRM dashboard's "kto jest teraz na
      // stronie" tooltip match this live browsing session straight to the
      // order it just created (see shop_www_quotes_build_live_online_breakdown()).
      let checkoutSessionToken = "";
      try {
        checkoutSessionToken = window.sessionStorage.getItem("keika_shop_session_token") || "";
      } catch {
        // sessionStorage niedostępny - zamówienie i tak przejdzie, po prostu bez tego dopasowania.
      }

      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_code: quoteCode,
          session_token: checkoutSessionToken,
          customer: { name: `${f.firstName} ${f.lastName}`.trim(), phone: f.phone, email: f.email },
          consents: (() => {
            // Marketing: decyzja z paska ciasteczek (jedno pytanie o oferty
            // e-mailem i SMS-em), razem ze śladem kiedy i gdzie padła.
            const marketing = readMarketingConsent();
            const marketingAccepted = marketing?.accepted === true;
            return {
              terms: ta,
              marketing_email: marketingAccepted,
              marketing_sms: marketingAccepted,
              marketing_source: marketing?.source || "",
              marketing_decided_at: marketing?.decidedAt || "",
              accepted_at: new Date().toISOString(),
              version: "2026-09-28",
            };
          })(),
          shipping: {
            // Paczkomat: adresem wysyłki jest punkt, nie dom klienta - od
            // 2026-09-24 nie prosimy go już o własny adres przy tej metodzie,
            // więc bierzemy adres punktu (kod i miasto wyciągamy z jego
            // opisu, np. "ul. Kwiatowa 1, 78-400 Szczecinek").
            ...(dm === PACZKOMAT_METHOD.id && sp
              ? (() => {
                  const raw = String(sp.address || "");
                  const match = raw.match(/^(.*?),?\s*(\d{2}-\d{3})\s+(.*)$/);
                  return {
                    address_line_1: match ? match[1].trim() : raw,
                    postcode: match ? match[2] : f.postcode,
                    city: match ? match[3].trim() : f.city,
                    paczkomat_id: sp.id,
                    paczkomat_address: raw,
                  };
                })()
              : {
                  city: f.city,
                  postcode: f.postcode,
                  address_line_1: f.address1,
                }),
          },
          buyer: bd
            ? {
                name: buyer.name.trim(),
                email: buyer.email.trim(),
                phone: buyer.phone.trim(),
                street: buyer.street.trim(),
                postcode: buyer.postcode.trim(),
                city: buyer.city.trim(),
              }
            : null,
          invoice: wi
            ? {
                nip: invoice.nip,
                company_name: invoice.companyName,
                street: invoice.street,
                postcode: invoice.postcode,
                city: invoice.city,
              }
            : null,
          note_text: noteWithBuyer,
          payment_provider:
            pm === "cod" ? "cod" : pm === "transfer" ? "transfer" : pm === "p24" ? "p24" : pm === "paynow" ? "paynow" : "stripe",
          payment_method:
            pm === "cod"
              ? "cod"
              : pm === "transfer"
                ? "transfer"
                : pm === "p24"
                  ? p24Kind
                  : pm === "paynow"
                    ? "paynow_" + paynowKind
                    : "",
          tracking,
          ...(pm === "cod" ? { cod_sms_verification_token: codSms.token } : {}),
          ...(pm === "online" ? { stripe_method: opts?.stripeMethod || stripeMethod } : {}),
          ...(pm === "p24" && opts?.p24MethodId ? { p24_method_id: opts.p24MethodId } : {}),
          ...(pm === "p24" ? { p24_regulation_accepted: ta } : {}),
          ...(pm === "paynow" && (opts?.paynowMethodId || paynowBankId)
            ? { paynow_method_id: opts?.paynowMethodId || paynowBankId }
            : {}),
          ...(pm === "paynow" && (opts?.paynowBlikCode || paynowBlikCode)
            ? { paynow_blik_code: opts?.paynowBlikCode || paynowBlikCode }
            : {}),
        }),
      });
      const json = (await response.json()) as OrderCreateResponse;
      if (!json.ok || !json.order) {
        throw new Error(json.error || "Nie udało się utworzyć zamówienia.");
      }

      // Przelewy24: koszyk zostaje (płatność jeszcze nie jest faktem),
      // klient idzie na stronę P24; wraca na /zamowienie/[kod]?p24=1, gdzie
      // strona statusu czeka na potwierdzenie i dopiero wtedy czyści koszyk.
      if (json.payment_provider === "p24" && json.redirect_url) {
        trackCheckoutIssue("checkout_p24_redirect", p24Kind, { order_code: json.order.order_code });
        window.location.assign(json.redirect_url);
        return null;
      }

      // PayNow - przelew online (pbl) / karta: ta sama logika co P24 -
      // przekierowanie, powrót na /zamowienie/[kod]?paynow=1.
      if (json.payment_provider === "paynow" && json.redirect_url) {
        trackCheckoutIssue("checkout_paynow_redirect", json.paynow_kind || paynowKind, {
          order_code: json.order.order_code,
        });
        window.location.assign(json.redirect_url);
        return null;
      }

      // PayNow BLIK (White Label): kod już wysłany razem z zamówieniem, ale
      // płatność NIE jest jeszcze faktem - klient musi ją zatwierdzić w
      // aplikacji banku. Koszyk zostaje, odpytujemy paynow-check w pętli
      // (jak strona statusu robi to dla P24), zamiast czekać na przekierowanie.
      if (json.payment_provider === "paynow" && json.paynow_kind === "blik" && json.payment_id) {
        const orderCode = json.order.order_code;
        const accessToken = json.order.access_token || "";
        setOrderState({
          orderCode,
          amountTotal: json.order.amount_total,
          clientSecret: undefined,
          publishableKey: undefined,
          paymentEnabled: false,
          paymentProvider: "paynow",
          accessToken,
          transfer: null,
          stripeMethod: undefined,
        });
        setPaynowPolling(true);
        setPaynowPollTimeout(false);
        const PAYNOW_POLL_ATTEMPTS = 24;
        const PAYNOW_POLL_INTERVAL_MS = 3000;
        void (async () => {
          for (let attempt = 1; attempt <= PAYNOW_POLL_ATTEMPTS; attempt += 1) {
            await new Promise((resolve) => window.setTimeout(resolve, PAYNOW_POLL_INTERVAL_MS));
            try {
              const checkRes = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/paynow-check`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ access_token: accessToken }),
              });
              const checkJson = (await checkRes.json()) as { ok?: boolean; paid?: boolean; paynow_status?: string | null };
              // Bank odrzucił albo kod wygasł - koniec tej próby, mówimy od
              // razu, zamiast kręcić kółkiem do limitu czasu.
              const pnStatus = String(checkJson.paynow_status || "").toUpperCase();
              if (checkJson.ok && !checkJson.paid && ["REJECTED", "ERROR", "EXPIRED", "ABANDONED"].includes(pnStatus)) {
                setPaynowPolling(false);
                setPaynowBlikCode("");
                submittedRef.current = false;
                setError(
                  pnStatus === "EXPIRED"
                    ? "Czas na potwierdzenie płatności minął. Wygeneruj nowy kod BLIK w aplikacji banku i spróbuj jeszcze raz."
                    : "Płatność BLIK nie została potwierdzona w aplikacji banku. Wygeneruj nowy kod i spróbuj jeszcze raz - nic nie zostało pobrane.",
                );
                trackCheckoutIssue("payment_failed_client", `paynow_blik_${pnStatus.toLowerCase()}`, { order_code: orderCode });
                return;
              }
              if (checkJson.ok && checkJson.paid) {
                setPaynowPolling(false);
                setPaymentConfirmed(true);
                clearCart();
                setItems([]);
                lastQuoteCodeRef.current = "";
                trackCheckoutIssue("checkout_paynow_blik", "paid", { order_code: orderCode, attempts: attempt });
                if (json.order?.amount_total) {
                  void import("@/lib/tracking").then(({ trackOpenAiOrderCreated }) => {
                    trackOpenAiOrderCreated({
                      orderCode,
                      amountZl: Number(json.order!.amount_total),
                      items: items.map((item) => ({ id: item.productSlug, name: item.productLabel, quantity: item.qty })),
                    });
                  });
                }
                return;
              }
            } catch {
              /* spróbuj ponownie */
            }
          }
          setPaynowPolling(false);
          setPaynowPollTimeout(true);
          trackCheckoutIssue("checkout_paynow_blik", "timeout", { order_code: orderCode });
        })();
        return null;
      }

      setOrderState({
        orderCode: json.order.order_code,
        amountTotal: json.order.amount_total,
        clientSecret: json.client_secret,
        publishableKey: json.publishable_key,
        paymentEnabled: Boolean(json.payment_enabled && json.client_secret && json.publishable_key),
        paymentProvider:
          json.payment_provider ||
          (pm === "cod" ? "cod" : pm === "transfer" ? "transfer" : pm === "p24" ? "p24" : "stripe"),
        accessToken: json.order.access_token,
        transfer: json.order.transfer || null,
        stripeMethod: opts?.stripeMethod || stripeMethod,
      });
      // Cash-on-delivery has no further payment step - the order is real the
      // moment it's created. Online payment isn't real yet at this point;
      // the cart only clears once StripePaymentStep reports success (or a
      // payment_enabled:false fallback, handled below).
      if (
        pm === "cod" ||
        pm === "transfer" ||
        !Boolean(json.payment_enabled && json.client_secret && json.publishable_key)
      ) {
        clearCart();
        setItems([]);
        lastQuoteCodeRef.current = "";
        const createdOrder = json.order;
        if (createdOrder.amount_total) {
          void import("@/lib/tracking").then(({ trackOpenAiOrderCreated }) => {
            trackOpenAiOrderCreated({
              orderCode: createdOrder.order_code,
              amountZl: Number(createdOrder.amount_total),
              items: items.map((item) => ({ id: item.productSlug, name: item.productLabel, quantity: item.qty })),
            });
          });
        }
        return null;
      }
      // Stripe (BLIK / karta / portfele): PaymentIntent powstał - element
      // w StripeMethodStep potwierdza go tym clientSecret.
      return json.client_secret ? { clientSecret: json.client_secret, orderCode: json.order.order_code } : null;
    } catch (submitError) {
      submittedRef.current = false;
      const message = submitError instanceof Error ? submitError.message : "Wystąpił błąd.";
      setError(message);
      trackCheckoutIssue("checkout_error", "order_submit_failed", { message, payment_method: pm });
      throw submitError instanceof Error ? submitError : new Error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    items,
    deliveryMethod,
    selectedPaczkomat,
    form,
    buyerDifferent,
    buyer,
    wantsInvoice,
    invoice,
    paymentMethod,
    p24Kind,
    paynowKind,
    paynowBankId,
    paynowBlikCode,
    stripeMethod,
    termsAccepted,
    codSms.token,
    orderSurcharge,
    shippingFee,
    appliedDiscount,
    expressSelected,
    expressFee,
  ]);

  // No "przejdź do płatności" button - for online payment, the payment panel
  // opens on its own once the required fields are filled in, after a short
  // pause in typing; for cash-on-delivery, it fires the instant the SMS code
  // is verified (see the payment method section below).
  //
  // Deliberately NOT watching isSubmitting here: a failed submitOrder() call
  // flips isSubmitting true->false, and if it were a dependency that alone
  // would re-run this effect and immediately retry - with orderState still
  // null and checkoutReady still true, nothing else stops it from retrying
  // forever (this was a real bug: a single failed order-create turned into
  // dozens of rapid-fire retries). isSubmitting is still read inside as a
  // guard against a genuinely concurrent call; it just shouldn't itself
  // trigger a new attempt. A failed attempt now stops and waits for an
  // actual new action (edited data, or the manual "Spróbuj ponownie").
  // Audit 2026-09-13: online payment no longer auto-submits on a typing
  // pause - the draft order + PaymentIntent are created only by the
  // explicit "Zapisz dane i przejdź do płatności" button in the payment
  // panel. Cash-on-delivery keeps firing the instant the SMS code is
  // verified (that verification IS the explicit confirmation there).
  //
  // Deliberately NOT watching isSubmitting here: a failed submitOrder() call
  // flips isSubmitting true->false, and if it were a dependency that alone
  // would re-run this effect and immediately retry forever (real bug once).
  useEffect(() => {
    if (orderState || isSubmitting || !checkoutReady) return;
    if (paymentMethod === "cod") {
      void submitOrder().catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutReady, orderState, paymentMethod, submitOrder]);

  // REMOVED 2026-09-13 - a "resync post-creation edits to the server" effect
  // briefly lived here (added 2026-09-11, tightened with a deliveryDataReady
  // gate later that same day). It called submitOrder() again whenever
  // form/invoice/delivery data changed after the draft order already
  // existed, relying on shop_public_orders_create()'s "reuse a recent
  // still-unpaid draft" path (views/biuro/api/shop-public/_orders.php).
  // That reuse path WIPES payment_intent_id/payment_client_secret and mints
  // a brand new Stripe PaymentIntent on every call - it was built for "the
  // customer abandoned this attempt and is starting a fresh one", not for
  // "still on the same payment page, just fixing a typo in the note field".
  // Real live incident 2026-09-13: two customers reached the Stripe payment
  // step, then edited something else (e.g. a delivery note) while still
  // unpaid - this effect fired, minted a *second* PaymentIntent server-side,
  // but the customer's already-rendered Stripe Elements form paid the
  // *original* one (still perfectly valid on Stripe's side - nothing
  // cancels it). Stripe took real money (confirmed via the Stripe API:
  // pi_3UFAJJJvei1KgDgN0X1Y4ko2 / pi_3UFGOiJvei1KgDgN15twb0H5, both
  // succeeded) that the CRM had no record of at all - shop_www_orders still
  // pointed at the newer, unpaid intent, so payment_stripe_webhook.php's
  // exact-match lookup (`WHERE payment_intent_id = ?`) found nothing, and
  // neither order ever got marked paid, promoted into `orders`, or sent its
  // confirmation e-mail. An incomplete address is a phone call to fix; a
  // successful payment the CRM doesn't know happened is a much worse
  // failure mode - so this whole mechanism is removed rather than patched
  // again. A customer who edits the note/address after reaching the payment
  // step goes back to the pre-2026-09-11 behaviour: the edit stays local
  // until the order is genuinely resubmitted (e.g. the "Spróbuj ponownie"
  // button after a failure) - see [[moskitiery-checkout-orphaned-payment-incident]]
  // before reintroducing anything like this; it needs a way to refresh
  // shipping/customer data WITHOUT ever touching an already-active
  // PaymentIntent, which this endpoint does not offer today.

  // Meta Purchase leci WYŁĄCZNIE serwerowo z CRM (Conversions API, event_id =
  // order_code, z wartością + zahaszowanym e-mailem/telefonem + fbc/fbp).
  // Przeglądarkowy fbq('Purchase') usunięty 2026-09-03: Meta go nie
  // deduplikowała z serwerowym (podwójne liczenie konwersji, a zestaw
  // optymalizuje pod Zakup), a ~97% ruchu to przeglądarka w aplikacji FB,
  // gdzie fbq i tak bywa blokowany. Górny lejek (ViewContent/AddToCart/
  // InitiateCheckout) nadal leci z przeglądarki - tam podwójne liczenie nie
  // psuje optymalizacji pod Zakup.


  // Wybór sposobu płatności - kafelki (patrz PaymentKind). Zmiana metody
  // przy istniejącym PaymentIntent (nieudana próba) porzuca go, tak jak
  // "Zmień dane zamówienia" - nowa metoda dostanie własną intencję.
  const selectPaymentKind = (kind: PaymentKind) => {
    if (orderState && !paymentConfirmed) {
      setOrderState(null);
      setError("");
      submittedRef.current = false;
    }
    setOnlinePaymentKind(kind);
    trackCheckoutIssue("checkout_payment_kind", kind);
  };
  const stripeAvailable = STRIPE_PUBLISHABLE_KEY !== "";
  // Kafelki metod płatności budujemy TYM SAMYM kodem co strona ponowienia
  // płatności z maila (app/components/payment-methods.tsx) - inaczej obie
  // listy się rozjeżdżają, co się już raz stało (właściciel, 2026-09-24).
  const paymentTiles = buildPaymentTiles({
    stripeAvailable,
    p24Settings,
    transferEnabled: transferSettings.enabled,
    amount: payableTotal,
    routing: paymentRouting,
  });
  // Gdy kwota koszyka spadnie poniżej progu rat (klient usunął pozycję),
  // kafelek "Raty" znika - wybór trzeba wyczyścić, żeby nie zostać z
  // zaznaczoną metodą, której już nie widać (2026-09-28).
  useEffect(() => {
    if (!onlinePaymentKind) return;
    if (paymentTiles.some((tile) => tile.kind === onlinePaymentKind)) return;
    setOnlinePaymentKind("");
  }, [paymentTiles, onlinePaymentKind]);
  // Opcje wybranej metody renderują się pod JEJ kafelkiem - klient widzi pole
  // BLIK-a dokładnie tam, gdzie kliknął, a nie na końcu listy metod.
  const renderMethodPanel = (kind: PaymentKind) => {
    // PayNow BLIK (White Label, 2026-09-30): kod 6-cyfrowy wpisywany TU, na
    // naszej stronie (jak dziś przez Stripe) - bez przekierowania. Po kliku
    // "Płacę" zamówienie + płatność powstają razem (jak P24), a potwierdzenie
    // przychodzi przez polling (patrz submitOrder), nie przez powrót z
    // przekierowania.
    if (kind === "blik" && selectedOnlineProvider === "paynow") {
      const digits = paynowBlikCode.replace(/\D+/g, "").slice(0, 6);
      if (paynowPolling) {
        return (
          <div className="cart-payment-waiting">
            <span className="cart-invoice-nip-spinner" aria-hidden="true" />
            Czekamy na potwierdzenie w aplikacji Twojego banku…
          </div>
        );
      }
      return (
        <>
          <div className="cart-blik-field">
            <label htmlFor="cart-paynow-blik-code" className="cart-blik-label">
              Kod BLIK
            </label>
            <div className="cart-blik-row">
              <input
                id="cart-paynow-blik-code"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="000000"
                value={digits}
                onChange={(event) => setPaynowBlikCode(event.target.value.replace(/\D+/g, "").slice(0, 6))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && digits.length === 6 && termsAccepted && !isSubmitting) {
                    event.preventDefault();
                    setError("");
                    submittedRef.current = false;
                    void submitOrder({ paynowBlikCode: digits }).catch(() => {});
                  }
                }}
                disabled={isSubmitting}
                aria-label="6-cyfrowy kod BLIK"
              />
            </div>
          </div>
          <PaynowGdprNotice />
          {paynowPollTimeout ? (
            <div className="cart-checkout-error">
              Nie otrzymaliśmy jeszcze potwierdzenia z banku. Sprawdź aplikację banku - jeśli zatwierdziłeś(-aś)
              płatność, zamówienie i tak zostanie zaksięgowane. Nie płać drugi raz.
            </div>
          ) : null}
          {error ? <div className="cart-checkout-error">{error}</div> : null}
          {termsCheckbox}
          <button
            type="button"
            className={`cart-page-checkout-cta ${payBlockedReason ? "is-blocked" : ""}`}
            onClick={() => {
              if (payBlockedReason) {
                jumpToFirstProblem();
                return;
              }
              setError("");
              submittedRef.current = false;
              void submitOrder({ paynowBlikCode: digits }).catch(() => {});
            }}
            disabled={isSubmitting || (!payBlockedReason && (!termsAccepted || digits.length !== 6))}
          >
            {isSubmitting ? "Przetwarzamy…" : "Płacę BLIK-iem"}
          </button>
          {missingFieldsHint}
        </>
      );
    }

    // PayNow - karta / Google Pay / Apple Pay: PayNow pokazuje własną stronę
    // wyboru metody (bez wcześniejszego wyboru banku), tak jak "karta" u P24
    // nigdy nie istniała - najbliższy istniejący wzorzec to redirect P24.
    if ((kind === "card" || kind === "wallets") && selectedOnlineProvider === "paynow") {
      return (
        <>
          {error ? <div className="cart-checkout-error">{error}</div> : null}
          {termsCheckbox}
          <button
            type="button"
            className={`cart-page-checkout-cta ${payBlockedReason ? "is-blocked" : ""}`}
            onClick={() => {
              if (payBlockedReason) {
                jumpToFirstProblem();
                return;
              }
              setError("");
              submittedRef.current = false;
              void submitOrder().catch(() => {});
            }}
            disabled={isSubmitting || (!payBlockedReason && !termsAccepted)}
          >
            {isSubmitting ? "Przekierowujemy do PayNow…" : "Płacę – przejdź do PayNow"}
          </button>
          {missingFieldsHint}
          <p className="cart-checkout-cta-hint">Dokończysz płatność na stronie PayNow i wrócisz do sklepu.</p>
        </>
      );
    }

    if (kind === "blik" || kind === "card" || kind === "wallets") {
      if (!stripeAvailable) {
        return (
          <div className="cart-page-checkout-note">
            Płatność online nie jest jeszcze skonfigurowana w tym środowisku. Wybierz inną metodę płatności.
          </div>
        );
      }
      return (
        <>
          {orderState && orderState.paymentProvider === "stripe" && !paymentConfirmed ? (
            <button
              type="button"
              className="cart-change-data-link"
              onClick={() => {
                // Porzuca PaymentIntent z poprzedniej próby i odblokowuje
                // formularz (patrz notatki o incydencie 2026-09-13 wyżej).
                setOrderState(null);
                setError("");
                submittedRef.current = false;
                trackCheckoutIssue("checkout_edit_after_draft", "zmien_dane", { payment_method: paymentMethod });
              }}
            >
              ← Zmień dane zamówienia
            </button>
          ) : null}
          {error ? <div className="cart-checkout-error">{error}</div> : null}
          {/* Regulamin renderuje sam krok Stripe, tuż nad "Płacę" (właściciel,
              2026-09-29: "akceptacja regulaminu wszędzie nad CTA, jak najbliżej"). */}
          <StripeMethodStep
            key={stripeMethod}
            termsSlot={termsCheckbox}
            blockedHint={missingFieldsHint}
            onBlocked={jumpToFirstProblem}
            publishableKey={STRIPE_PUBLISHABLE_KEY}
            method={stripeMethod}
            amountGrosze={Math.round(payableTotal * 100)}
            contact={checkoutContact}
            termsAccepted={termsAccepted}
            disabledReason={payBlockedReason}
            existingClientSecret={
              orderState?.paymentProvider === "stripe" && orderState.stripeMethod === stripeMethod
                ? orderState.clientSecret
                : undefined
            }
            existingOrderCode={
              orderState?.paymentProvider === "stripe" && orderState.stripeMethod === stripeMethod
                ? orderState.orderCode
                : undefined
            }
            createIntent={() => submitOrder({ stripeMethod })}
            onPaid={handleStripePaid}
            submitLabel={stripeMethod === "blik" ? "Płacę BLIK-iem" : "Płacę kartą"}
          />
        </>
      );
    }

    // PayPo routowane na PayNow: redirect jak pbl/card u PayNow (PayNow
    // wymaga adresu dostawy, ale to sam uzupełnia CRM z danych zamówienia).
    if (kind === "p24_paypo" && selectedOnlineProvider === "paynow") {
      return (
        <>
          {error ? <div className="cart-checkout-error">{error}</div> : null}
          {termsCheckbox}
          <button
            type="button"
            className={`cart-page-checkout-cta ${payBlockedReason ? "is-blocked" : ""}`}
            onClick={() => {
              if (payBlockedReason) {
                jumpToFirstProblem();
                return;
              }
              setError("");
              submittedRef.current = false;
              void submitOrder().catch(() => {});
            }}
            disabled={isSubmitting || (!payBlockedReason && !termsAccepted)}
          >
            {isSubmitting ? "Przekierowujemy do PayPo…" : "Przechodzę do wniosku online"}
          </button>
          {missingFieldsHint}
          <p className="cart-checkout-cta-hint">Wniosek wypełnisz na stronie PayPo. Realizacja po pozytywnej decyzji.</p>
        </>
      );
    }

    // "Przelew online" routowany na PayNow: ta sama siatka banków co u P24,
    // tylko lista z PayNow (paynowBanks) i osobny wybór (paynowBankId).
    if (kind === "p24_transfer" && selectedOnlineProvider === "paynow") {
      return (
        <>
          <div className="cart-p24-banks" role="radiogroup" aria-label="Wybierz swój bank">
            {paynowBanks.length === 0 ? (
              <div className="cart-payment-waiting">
                <span className="cart-invoice-nip-spinner" aria-hidden="true" />
                Wczytujemy listę banków…
              </div>
            ) : (
              paynowBanks.map((bank) => (
                <label key={bank.id} className={`cart-p24-bank ${paynowBankId === bank.id ? "is-active" : ""}`} title={bank.name}>
                  <input
                    type="radio"
                    name="paynow-bank"
                    value={bank.id}
                    checked={paynowBankId === bank.id}
                    onChange={() => {
                      setPaynowBankId(bank.id);
                      trackCheckoutIssue("checkout_paynow_bank", bank.name, { bank_id: bank.id });
                    }}
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
          {error ? <div className="cart-checkout-error">{error}</div> : null}
          {termsCheckbox}
          <button
            type="button"
            className={`cart-page-checkout-cta ${payBlockedReason ? "is-blocked" : ""}`}
            onClick={() => {
              if (payBlockedReason) {
                jumpToFirstProblem();
                return;
              }
              setError("");
              submittedRef.current = false;
              void submitOrder({ paynowMethodId: paynowBankId }).catch(() => {});
            }}
            disabled={isSubmitting || (!payBlockedReason && (!termsAccepted || (paynowBanks.length > 0 && !paynowBankId)))}
          >
            {isSubmitting ? "Przekierowujemy do PayNow…" : paynowBankId ? "Płacę – przejdź do banku" : "Wybierz bank, aby zapłacić"}
          </button>
          {missingFieldsHint}
          <p className="cart-checkout-cta-hint">Zapłacisz na stronie swojego banku i wrócisz do sklepu.</p>
        </>
      );
    }

    if (kind === "p24_transfer" || kind === "p24_paypo" || kind === "p24_installments") {
      const thisKind = kind as P24Kind;
      return (
        <>
          {thisKind === "p24_transfer" ? (
            <div className="cart-p24-banks" role="radiogroup" aria-label="Wybierz swój bank">
              {p24Banks.length === 0 ? (
                <div className="cart-payment-waiting">
                  <span className="cart-invoice-nip-spinner" aria-hidden="true" />
                  Wczytujemy listę banków…
                </div>
              ) : (
                p24Banks.map((bank) => (
                  <label
                    key={bank.id}
                    className={`cart-p24-bank ${p24BankId === bank.id ? "is-active" : ""}`}
                    title={bank.name}
                  >
                    <input
                      type="radio"
                      name="p24-bank"
                      value={bank.id}
                      checked={p24BankId === bank.id}
                      onChange={() => {
                        setP24BankId(bank.id);
                        trackCheckoutIssue("checkout_p24_bank", bank.name, { bank_id: bank.id });
                      }}
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
          ) : null}
          {thisKind === "p24_installments" ? <InstallmentOffer amount={payableTotal} /> : null}
          {error ? <div className="cart-checkout-error">{error}</div> : null}
          {termsCheckbox}
          <button
            type="button"
            className={`cart-page-checkout-cta ${payBlockedReason ? "is-blocked" : ""}`}
            onClick={() => {
              if (payBlockedReason) {
                jumpToFirstProblem();
                return;
              }
              setError("");
              submittedRef.current = false;
              void submitOrder({ p24MethodId: thisKind === "p24_transfer" ? p24BankId : 0 }).catch(() => {});
            }}
            disabled={
              isSubmitting ||
              (!payBlockedReason && (!termsAccepted || (thisKind === "p24_transfer" && p24Banks.length > 0 && !p24BankId)))
            }
          >
            {isSubmitting
              ? thisKind === "p24_paypo"
                ? "Przekierowujemy do PayPo…"
                : "Przekierowujemy do Przelewy24…"
              : thisKind === "p24_transfer"
                ? p24BankId
                  ? "Płacę – przejdź do banku"
                  : "Wybierz bank, aby zapłacić"
                : // Raty i PayPo kończą się wnioskiem u finansującego, nie
                  // zapłatą - CTA ma mówić dokładnie to (właściciel,
                  // 2026-09-24; brzmienie "online" - 2026-09-30).
                  "Przechodzę do wniosku online"}
          </button>
          {missingFieldsHint}
          <p className="cart-checkout-cta-hint">
            {thisKind === "p24_transfer"
              ? "Zapłacisz na stronie swojego banku i wrócisz do sklepu."
              : thisKind === "p24_paypo"
                ? "Wniosek wypełnisz na stronie PayPo. Realizacja po pozytywnej decyzji."
                : "Wniosek wypełnisz na stronie Przelewy24. Bank poda ostateczną ratę i RRSO."}
          </p>
        </>
      );
    }

    // przelew tradycyjny
    return (
      <>
        {error ? <div className="cart-checkout-error">{error}</div> : null}
        {termsCheckbox}
        <button
          type="button"
          className={`cart-page-checkout-cta ${payBlockedReason ? "is-blocked" : ""}`}
          onClick={() => {
            if (payBlockedReason) {
              jumpToFirstProblem();
              return;
            }
            setError("");
            submittedRef.current = false;
            void submitOrder().catch(() => {});
          }}
          disabled={isSubmitting || (!payBlockedReason && !termsAccepted)}
        >
          {isSubmitting ? "Zapisujemy zamówienie…" : "Zamawiam i płacę przelewem"}
        </button>
        {missingFieldsHint}
        <p className="cart-checkout-cta-hint">Dane do przelewu pokażemy od razu i wyślemy e-mailem. Realizacja po zaksięgowaniu wpłaty.</p>
      </>
    );
  };

  // Budowane leniwie (funkcja, nie const z JSX): panel metody sięga po
  // termsCheckbox / checkoutContact / handleStripePaid, które powstają
  // NIŻEJ w komponencie. Wersja "const = <div>…" wywoływała je przed
  // inicjalizacją i prerender /koszyk padał na Vercelu z
  // "Cannot access 'cq' before initialization".
  const renderPaymentKindChooser = () => (
    <div className="cart-pay-tiles" role="radiogroup" aria-label="Sposób płatności">
      {paymentTiles.map((tile) => {
        const active = onlinePaymentKind === tile.kind;
        return (
          <div key={tile.kind} className={`cart-pay-tile-group ${active ? "is-active" : ""}`}>
            <label className={`cart-pay-tile ${active ? "is-active" : ""} ${tile.wide ? "is-wide" : ""}`}>
              <input
                type="radio"
                name="payment-kind"
                value={tile.kind}
                checked={active}
                onChange={() => selectPaymentKind(tile.kind)}
                disabled={paymentConfirmed}
              />
              {tile.logo}
              <span className="cart-pay-tile-copy">
                <strong>{tile.title}</strong>
                <small>{tile.hint}</small>
              </span>
              <span className="cart-pay-tile-check" aria-hidden="true" />
            </label>
            {active ? <div className="cart-pay-tile-panel">{renderMethodPanel(tile.kind)}</div> : null}
          </div>
        );
      })}
    </div>
  );
  // Dlaczego (jeszcze) nie można zapłacić - pod polem BLIK/karty i przy
  // przyciskach P24 / przelewu tradycyjnego.
  const payBlockedReason = !items.length
    ? "Koszyk jest pusty."
    : !paczkomatReady
      ? "Wybierz paczkomat powyżej, aby zapłacić."
      : !deliveryDataReady
        ? "Uzupełnij dane powyżej (imię i nazwisko, kontakt, adres), aby zapłacić."
        : "";
  // "Nie tknął danych" = żadne z pól kontaktowych/adresowych nie ma treści.
  // Liczymy z wartości formularza, nie z blur - inaczej baner mrugałby jeszcze
  // w trakcie wpisywania pierwszego pola.
  const contactUntouched =
    !checkoutFormStarted &&
    form.email.trim() === "" &&
    form.phone.trim() === "" &&
    form.firstName.trim() === "" &&
    form.lastName.trim() === "" &&
    form.address1.trim() === "" &&
    form.postcode.trim() === "" &&
    form.city.trim() === "";
  // Które pola blokują płatność, w kolejności formularza: klucz
  // (data-checkout-field), krótka nazwa do listy "Do zapłaty brakuje:" i
  // komunikat pod polem. Właściciel, 2026-09-30: "zwracamy, które pole klient
  // ma poprawić, po tapnięciu scroll do pola, pole pulsuje na czerwono" -
  // wcześniej był tylko ogólnik "Uzupełnij dane powyżej", a 9 z 45
  // porzucających doszło do płatności i nigdy nie kliknęło "Płacę".
  const checkoutProblems: Array<{ key: string; chip: string; message: string }> = [];
  if (!emailValid) {
    checkoutProblems.push({ key: "email", chip: "e-mail", message: form.email.trim() === "" ? "Podaj adres e-mail." : "Sprawdź adres e-mail." });
  }
  if (!isValidPhone(form.phone)) {
    checkoutProblems.push({ key: "phone", chip: "telefon", message: phoneError(form.phone) });
  }
  if (!firstNameFieldValid) checkoutProblems.push({ key: "firstName", chip: "imię", message: "Podaj imię." });
  if (!lastNameFieldValid) checkoutProblems.push({ key: "lastName", chip: "nazwisko", message: "Podaj nazwisko." });
  if (requiresAddress) {
    if (!address1FieldValid) {
      const street = form.address1.trim();
      checkoutProblems.push({
        key: "address1",
        chip: street !== "" && !/\d/.test(street) ? "numer domu" : "ulica i numer",
        message:
          street === ""
            ? "Podaj ulicę i numer domu."
            : !/\d/.test(street)
              ? "Dopisz numer domu."
              : !/\p{L}/u.test(street)
                ? "Podaj nazwę ulicy."
                : "Podaj pełny adres: ulica i numer.",
      });
    }
    if (!postcodeFieldValid) checkoutProblems.push({ key: "postcode", chip: "kod pocztowy", message: "Kod pocztowy w formacie 00-000." });
    if (!cityFieldValid) checkoutProblems.push({ key: "city", chip: "miasto", message: "Podaj miasto." });
  }
  if (!paczkomatReady) checkoutProblems.push({ key: "paczkomat", chip: "paczkomat", message: "Wybierz paczkomat." });
  if (buyerDifferent) {
    if (!buyerNameValid) checkoutProblems.push({ key: "buyerName", chip: "kupujący", message: "Podaj imię i nazwisko albo nazwę firmy." });
    if (!buyerEmailValid) checkoutProblems.push({ key: "buyerEmail", chip: "e-mail kupującego", message: "Podaj poprawny adres e-mail." });
  }
  if (wantsInvoice) {
    if (!nipFieldValid) checkoutProblems.push({ key: "nip", chip: "NIP", message: "NIP to 10 cyfr." });
    if (!companyNameFieldValid) checkoutProblems.push({ key: "companyName", chip: "nazwa firmy", message: "Podaj nazwę firmy." });
    if (!invoiceStreetFieldValid) checkoutProblems.push({ key: "invoiceStreet", chip: "adres firmy", message: "Podaj ulicę i numer." });
    if (!invoicePostcodeFieldValid) checkoutProblems.push({ key: "invoicePostcode", chip: "kod firmy", message: "Kod pocztowy w formacie 00-000." });
    if (!invoiceCityFieldValid) checkoutProblems.push({ key: "invoiceCity", chip: "miasto firmy", message: "Podaj miasto." });
  }
  const fieldError = (key: string): string | undefined => {
    if (!touchedFields.has(key) && !showAllFieldErrors) return undefined;
    return checkoutProblems.find((problem) => problem.key === key)?.message;
  };
  const jumpToField = (key: string) => {
    setTouchedFields((current) => (current.has(key) ? current : new Set(current).add(key)));
    const wrap = document.querySelector<HTMLElement>(`[data-checkout-field="${key}"]`);
    if (!wrap) return;
    wrap.scrollIntoView({ behavior: "smooth", block: "center" });
    wrap.classList.remove("is-pulse");
    void wrap.offsetWidth;
    wrap.classList.add("is-pulse");
    window.setTimeout(() => wrap.classList.remove("is-pulse"), 2000);
    const input = wrap.querySelector<HTMLElement>("input, select, textarea");
    if (input) window.setTimeout(() => input.focus({ preventScroll: true }), 450);
    trackCheckoutIssue("checkout_fix_field", key);
  };
  const jumpToFirstProblem = () => {
    setShowAllFieldErrors(true);
    if (checkoutProblems.length) jumpToField(checkoutProblems[0].key);
  };
  // "Dane gotowe, ale nie wybrał płatności" to w CRM osobny etap lejka
  // (właściciel, 2026-10-02) - a dotąd nie było po czym go rozpoznać.
  // Dotarcie do regulaminu brało się za ten moment, co pod-raportowało:
  // kto wypełnił wszystko i stanął, nigdzie nie był widoczny jako taki.
  // Teraz mówimy to wprost, raz na wejście do koszyka: żadne wymagane pole
  // nie zgłasza już problemu.
  const checkoutReadyTrackedRef = useRef(false);
  const checkoutProblemCount = checkoutProblems.length;
  useEffect(() => {
    if (!hydrated || items.length === 0) return;
    if (checkoutProblemCount > 0 || checkoutReadyTrackedRef.current) return;
    checkoutReadyTrackedRef.current = true;
    trackCheckoutIssue("checkout_ready", deliveryMethod || "", {
      cart_positions: items.length,
      payment: paymentMethod || null,
    });
  }, [hydrated, items.length, checkoutProblemCount, deliveryMethod, paymentMethod]);
  // Spokojna forma (właściciel, 2026-09-30: "nie 'do zapłaty brakuje', tylko
  // 'uzupełnij dane dostawy' i lista, nie przyciski - za bardzo krzyczy"):
  // nagłówek + lista pól, każde pole to odnośnik przewijający do niego.
  // Przy nietkniętym formularzu tylko krótki dopisek, bez listy (właściciel,
  // 2026-09-30: "jak żadne pole nie zostało wypełnione, nie pokazuj tych
  // informacji od razu"). Lista pojawia się, gdy klient coś wpisze albo
  // tapnie w zablokowany przycisk płatności.
  const missingFieldsHint = !checkoutProblems.length ? null : contactUntouched && !showAllFieldErrors ? (
    <div className="cart-missing" role="status">
      <span className="cart-missing-label">Uzupełnij dane dostawy</span>
    </div>
  ) : (
    <div className="cart-missing" role="status">
      <span className="cart-missing-label">Uzupełnij dane dostawy:</span>
      <ul className="cart-missing-list">
        {checkoutProblems.map((problem) => (
          <li key={problem.key}>
            <button type="button" className="cart-missing-link" onClick={() => jumpToField(problem.key)}>
              {problem.chip}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
  const checkoutContact: CheckoutContact = {
    name: `${form.firstName} ${form.lastName}`.trim(),
    phone: form.phone,
    email: form.email,
    city: form.city,
    postcode: form.postcode,
    address1: form.address1,
  };
  // Jeden checkbox, jedna linijka - regulamin sklepu i płatności (a przy
  // Przelewy24 także regulamin operatora, bo to jego usługa).
  const termsCheckbox =
    !paymentConfirmed && items.length > 0 ? (
      <label className={`cart-terms-checkbox ${termsAccepted ? "is-accepted" : ""}`}>
        <input
          type="checkbox"
          checked={termsAccepted}
          onChange={(event) => {
            setTermsAccepted(event.target.checked);
            trackCheckoutIssue("checkout_terms", event.target.checked ? "on" : "off");
          }}
          required
        />
        <span>
          Akceptuję{" "}
          <button type="button" className="cart-terms-link" onClick={() => setLegalModalOpen(true)}>
            regulamin sklepu i płatności
          </button>
          {paymentMethod === "p24" ? (
            <>
              {" "}
              oraz{" "}
              <a
                className="cart-terms-link"
                href="https://www.przelewy24.pl/regulamin"
                target="_blank"
                rel="noopener noreferrer"
              >
                regulamin Przelewy24
              </a>
            </>
          ) : null}
          .
        </span>
      </label>
    ) : null;
  useEffect(() => {
    cartKeepMetaRef.current = { arm: cartEmailArm, slug: items[0]?.productSlug || "" };
  }, [cartEmailArm, items]);
  // "Dodatkowe 5% dla wychodzących" (test od 2026-10-03, lib/escape-offer.ts):
  // wyzwalacze i stan oferty. Ma własny znacznik końca koszyka - niezależny
  // od banera "Nie decydujesz dzisiaj?" i jego testu.
  const escapeOffer = useCartEscapeOffer({
    items,
    hydrated,
    contactUntouched,
    hasOrderDraft: orderState !== null,
    orderConfirmed,
    foreignCode: Boolean(appliedDiscount && appliedDiscount.code !== PROMO_CODE),
  });
  // Callback ref, nie useEffect: odpala się dokładnie wtedy, gdy węzeł trafia
  // do DOM (koszyk renderuje się dopiero po hydracji, więc zwykły efekt
  // zastawał pusty ref). Próg 0 + rootMargin -10% = "wjechał w kadr".
  const cartKeepRef = useCallback((node: HTMLElement | null) => {
    cartKeepObserverRef.current?.disconnect();
    cartKeepObserverRef.current = null;
    if (!node || cartKeepSeenRef.current) return;
    if (typeof IntersectionObserver === "undefined") {
      setCartKeepVisible(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting) || cartKeepSeenRef.current) return;
        cartKeepSeenRef.current = true;
        setCartKeepVisible(true);
        trackCheckoutIssue("cart_keep_inview", cartKeepMetaRef.current.arm, { product: cartKeepMetaRef.current.slug });
        observer.disconnect();
        cartKeepObserverRef.current = null;
      },
      { threshold: 0, rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    cartKeepObserverRef.current = observer;
  }, []);

  const handleStripePaid = (paidOrderCode: string) => {
    const current = orderStateRef.current;
    clearCart();
    const amount = current?.amountTotal;
    if (amount) {
      void import("@/lib/tracking").then(({ trackOpenAiOrderCreated }) => {
        trackOpenAiOrderCreated({
          orderCode: paidOrderCode,
          amountZl: Number(amount),
          items: items.map((item) => ({ id: item.productSlug, name: item.productLabel, quantity: item.qty })),
        });
      });
    }
    setItems([]);
    lastQuoteCodeRef.current = "";
    setPaymentConfirmed(true);
  };

  // Ekspres portfelem: ?express=1 zapisuje flagę testową w localStorage,
  // ?express=0 ją zdejmuje. Blok pokazuje się tylko przy kurierze i płatności
  // online, dopóki nie ma jeszcze draftu zamówienia.
  const [expressWalletsOn, setExpressWalletsOn] = useState(EXPRESS_WALLETS_DEFAULT);
  const [expressWalletsAvailable, setExpressWalletsAvailable] = useState<boolean | null>(null);
  useEffect(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get("express") === "1") window.localStorage.setItem("keika_express_wallets", "1");
      if (params.get("express") === "0") window.localStorage.removeItem("keika_express_wallets");
      if (window.localStorage.getItem("keika_express_wallets") === "1") setExpressWalletsOn(true);
    } catch {
      /* localStorage niedostępny - zostaje domyślne */
    }
  }, []);
  const handleWalletPaid = (paidOrderCode: string) => {
    trackCheckoutIssue("checkout_pay_click", "wallet_express", { order_code: paidOrderCode });
    handleStripePaid(paidOrderCode);
  };
  const showExpressWallets =
    expressWalletsOn &&
    STRIPE_PUBLISHABLE_KEY !== "" &&
    items.length > 0 &&
    !orderState &&
    !paymentConfirmed &&
    deliveryMethod === COURIER_METHOD.id &&
    paymentMethod !== "cod" &&
    expressWalletsAvailable !== false;

  // Nowy koszyk zastępuje tylko widok koszyka z formularzem; pusty koszyk,
  // podziękowanie i wszystkie okna (kod SMS, regulamin, edycja) są wspólne.
  const isV2Body = cartDesign === "v2" && items.length > 0 && !(orderConfirmed && orderState);
  const buildV2Props = () => ({
    items,
    backHref,
    dataLocked,
    track: trackCheckoutIssue,
    itemFieldLabels: cartItemFieldLabels,
    combinedDiscountPercent,
    onQty: handleQtyChange,
    onRemove: handleRemove,
    onEdit: (id: string) => {
      setEditingItemId(id);
      trackCheckoutIssue("cart_edit_open", items.find((item) => item.id === id)?.productSlug || "");
    },
    oversizeThresholdMm: OVERSIZE_SURCHARGE_THRESHOLD_MM,
    itemsCount: summary.items,
    itemsTotal: summary.total,
    combinedSavings,
    appliedDiscount,
    rescueRow:
      rescueGrant && rescueAmount > 0
        ? {
            label:
              rescueGrant.kind === "escape" && rescueGrant.expiresAtMs
                ? `Dodatkowy rabat (-${rescueGrant.percent}%), ważny ${formatEscapeDeadline(rescueGrant.expiresAtMs)}`
                : `Rabat za zapisanie wyceny (-${rescueGrant.percent}%)`,
            amount: rescueAmount,
          }
        : null,
    shippingFee,
    expressFee,
    orderSurcharge,
    codSurcharge: COD_SURCHARGE_AMOUNT,
    payableTotal,
    totalSavings,
    isPickup: deliveryMethod === PICKUP_METHOD.id,
    amountToFreeShipping,
    discountOpen,
    setDiscountOpen,
    discountCodeInput,
    setDiscountCodeInput,
    discountChecking,
    discountError,
    clearDiscountError: () => setDiscountError(""),
    checkDiscountCode: () => void checkDiscountCode(),
    removeDiscountCode,
    expressEligible,
    expressSelected,
    chooseExpress,
    expressFeeAmount: EXPRESS_FEE_AMOUNT,
    dispatchStandardLabel: dispatchInfo?.standardLabel || "",
    dispatchExpressLabel: dispatchInfo?.expressLabel || "",
    dispatchCutoffLabel: dispatchInfo?.cutoffLabel || "",
    plisyLeadTime: !expressEligible && plisyLeadTime,
    deliveryMethods: availableDeliveryMethods,
    deliveryMethod,
    chooseDelivery: (method: { id: string; label: string }) => {
      setDeliveryMethod(method.id);
      trackCheckoutIssue("checkout_delivery", method.label, { method_id: method.id });
    },
    paczkomatMethodId: PACZKOMAT_METHOD.id,
    pickupMethodId: PICKUP_METHOD.id,
    selectedPaczkomat,
    choosePaczkomat: (point: PaczkomatPoint | null) => {
      setSelectedPaczkomat(point);
      if (point) trackCheckoutIssue("checkout_paczkomat", point.id, { address: point.address });
    },
    form,
    setForm,
    onPostcode: handlePostcodeChange,
    onPhone: handlePhoneChange,
    setAddress1Focused,
    onFieldBlur: handleCheckoutFieldBlur,
    valid: {
      email: emailValid,
      phone: phoneFieldValid,
      firstName: firstNameFieldValid,
      lastName: lastNameFieldValid,
      address1: address1FieldValid,
      postcode: postcodeFieldValid,
      city: cityFieldValid,
      buyerName: buyerNameValid,
      buyerEmail: buyerEmailValid,
      nip: nipFieldValid,
      companyName: companyNameFieldValid,
      invoiceStreet: invoiceStreetFieldValid,
      invoicePostcode: invoicePostcodeFieldValid,
      invoiceCity: invoiceCityFieldValid,
    },
    fieldError,
    requiresAddress,
    contactUntouched,
    deliveryDataReady,
    jumpToFirstProblem,
    noteOpen,
    setNoteOpen,
    buyerDifferent,
    setBuyerDifferent: (on: boolean) => {
      setBuyerDifferent(on);
      if (!on) setWantsInvoice(false);
      trackCheckoutIssue("checkout_buyer_other", on ? "on" : "off");
    },
    buyer,
    setBuyer,
    wantsInvoice,
    setWantsInvoice: (on: boolean) => {
      setWantsInvoice(on);
      trackCheckoutIssue("checkout_invoice", on ? "on" : "off");
    },
    invoice,
    setInvoice,
    onNip: (digits: string) => {
      setInvoice((current) => ({ ...current, nip: digits }));
      setNipLookupError("");
      if (digits.length === 10) void lookupNip(digits);
    },
    nipLookupLoading,
    nipLookupError,
    isCod: paymentMethod === "cod",
    paymentChooser: renderPaymentKindChooser,
    hasBlikTile: paymentTiles.some((tile) => tile.kind === "blik"),
    onlinePaymentKind,
    preselectPaymentKind: (kind: "blik") => setOnlinePaymentKind(kind),
    codBlock: (
      <>
        {error ? <div className="cart-checkout-error">{error}</div> : null}
        {codPendingInline ? (
          <div className={`cart-cod-pending ${codSms.code ? "" : "is-pulsing"}`}>
            <div className="cart-cod-pending-head">
              <strong>Wpisz kod z SMS-a</strong>
              <span>wysłany na {form.phone}</span>
            </div>
            {codSms.error ? <div className="cart-checkout-error">{codSms.error}</div> : null}
            <div className="cart-cod-pending-row">
              <input
                inputMode="numeric"
                className="cart-cod-pending-input"
                placeholder="123456"
                aria-label="Kod z SMS-a"
                value={codSms.code}
                onChange={(event) =>
                  setCodSms((current) => ({ ...current, code: event.target.value.replace(/\D/g, "").slice(0, 6), error: "" }))
                }
              />
              <button
                type="button"
                className="cart-cod-pending-confirm"
                onClick={() => void verifyCodSms()}
                disabled={codSms.code.length !== 6 || codSms.status === "verifying"}
              >
                {codSms.status === "verifying" ? "Sprawdzamy…" : "Potwierdź"}
              </button>
            </div>
            <button type="button" className="cart-cod-resend" onClick={() => void sendCodSms()} disabled={codResendIn > 0}>
              Wyślij nowy kod
            </button>
          </div>
        ) : null}
        <p className="cart-checkout-cta-hint">Płacisz kurierowi przy odbiorze, gotówką lub kartą. Zamówienie potwierdzasz kodem SMS.</p>
        {termsCheckbox}
        <button
          type="button"
          className={`cart-page-checkout-cta ${payBlockedReason ? "is-blocked" : ""}`}
          onClick={() => {
            if (payBlockedReason) {
              jumpToFirstProblem();
              return;
            }
            setCodModalOpen(true);
            if (!codPendingInline) void sendCodSms();
          }}
          disabled={!payBlockedReason && !termsAccepted}
        >
          {codPendingInline ? "Wpisz kod z SMS-a" : "Zamawiam z obowiązkiem zapłaty"}
        </button>
        {missingFieldsHint}
      </>
    ),
    transferReady: checkoutReady && paymentMethod === "transfer" && termsAccepted,
    submitTransfer: () => {
      setError("");
      submittedRef.current = false;
      void submitOrder().catch(() => {});
    },
    isSubmitting,
    hasOrderDraft: orderState !== null,
    escapeBottomRef: escapeOffer.bottomRef,
    escapeChip: <EscapeOfferCountdownChip controller={escapeOffer} />,
    hasEscapeOffer: Boolean(escapeOffer.offer),
    contactPhone: siteContact.phone,
  });

  return (
    <div className={`cart-page${isV2Body ? " cart-page--v2" : ""}`}>
      <div className="cart-page-gradient-bg" aria-hidden="true" />
      <PromoTopStrip productSlug={cartPromoSlug} variant="static" />
      <EscapeOfferCartReveal controller={escapeOffer} payable={payableTotal} payableWithoutOffer={payableTotal + rescueAmount} />
      {cartEmailNudge.open ? (
        <PromoSaveModal
          variant="cart"
          quoteCode=""
          shareUrl="https://sklep.keika.pl/koszyk"
          productSlug={items[0]?.productSlug}
          onClose={() => cartEmailNudge.close("dismiss")}
          onSent={() => cartEmailNudge.markSent()}
        />
      ) : null}
      {isV2Body ? null : (
      <header className="cart-page-header">
        <Link href="/" className="cart-page-brand">
          keika
        </Link>
        <h1>Koszyk</h1>
      </header>
      )}

      <main className="cart-page-main">
        {!hydrated || cartDesign === null ? null : orderConfirmed && orderState ? (
          <div className="cart-thankyou">
            <div className="cart-thankyou-check" aria-hidden="true">
              ✓
            </div>
            <h1>Dziękujemy za zamówienie!</h1>
            <p className="cart-thankyou-code">
              Numer zamówienia: <strong>{orderState.orderCode}</strong>
            </p>

            <div className="cart-thankyou-note">
              {orderState.paymentProvider === "transfer" ? (
                <p>
                  Zamówienie przyjęte z płatnością przelewem tradycyjnym. Poniżej dane do przelewu – te same
                  wysłaliśmy na Twój adres e-mail.
                </p>
              ) : orderState.paymentProvider === "cod" ? (
                <p>
                  Zamówienie przyjęte z płatnością za pobraniem. Kurier odbierze{" "}
                  <strong>
                    {orderState.amountTotal ? formatPln(Number(orderState.amountTotal)) : "kwotę zamówienia"}
                  </strong>{" "}
                  przy dostawie.
                </p>
              ) : (
                <p>
                  Płatność zakończona sukcesem
                  {orderState.amountTotal ? (
                    <>
                      {" "}
                      - opłacono <strong>{formatPln(Number(orderState.amountTotal))}</strong>
                    </>
                  ) : null}
                  .
                </p>
              )}
            </div>

            {orderState.paymentProvider === "transfer" ? (
              <div className="cart-transfer-card">
                <h2>Dane do przelewu</h2>
                <dl className="cart-transfer-grid">
                  <div>
                    <dt>Odbiorca</dt>
                    <dd>
                      {orderState.transfer?.account_holder || transferSettings.accountHolder}
                      {orderState.transfer?.holder_address || transferSettings.holderAddress ? (
                        <small>{orderState.transfer?.holder_address || transferSettings.holderAddress}</small>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>Numer konta</dt>
                    <dd className="cart-transfer-iban">
                      {orderState.transfer?.account_number || transferSettings.accountNumber}
                      {orderState.transfer?.bank_name || transferSettings.bankName ? (
                        <small>{orderState.transfer?.bank_name || transferSettings.bankName}</small>
                      ) : null}
                    </dd>
                  </div>
                  <div>
                    <dt>Kwota</dt>
                    <dd>{orderState.amountTotal ? formatPln(Number(orderState.amountTotal)) : "—"}</dd>
                  </div>
                  <div>
                    <dt>Tytuł przelewu</dt>
                    <dd className="cart-transfer-title">{orderState.transfer?.title || orderState.orderCode}</dd>
                  </div>
                </dl>
                <p className="cart-transfer-note">
                  <strong>Ważne:</strong> zaksięgowanie przelewu może potrwać <strong>do 2 dni roboczych</strong>.
                  Gdy wpłata do nas dotrze, poinformujemy Cię e-mailem, że zamówienie zostało przekazane do
                  realizacji. Do tego czasu zamówienie czeka w kolejce.
                </p>
              </div>
            ) : null}

            <div className="cart-thankyou-next">
              <h2>Co dalej?</h2>
              {orderState.paymentProvider === "transfer" ? (
                <ul>
                  <li>Dane do przelewu (z tytułem = numer zamówienia) wysłaliśmy też na podany adres e-mail.</li>
                  <li>Po zaksięgowaniu wpłaty dostaniesz e-mail, że zamówienie idzie do realizacji.</li>
                  <li>Status zamówienia możesz sprawdzić w każdej chwili poniżej, bez logowania.</li>
                </ul>
              ) : (
                <ul>
                  <li>Potwierdzenie zamówienia wysłaliśmy na podany adres e-mail.</li>
                  <li>Zamówienie trafiło do realizacji - o kolejnych krokach (i przesyłce) poinformujemy mailowo.</li>
                  <li>Status zamówienia możesz sprawdzić w każdej chwili poniżej, bez logowania.</li>
                </ul>
              )}
            </div>

            <Link href={orderTrackingLink} className="cart-page-checkout-cta cart-thankyou-track">
              Śledź status zamówienia
            </Link>

            {siteContact.phone || siteContact.email ? (
              <div className="cart-thankyou-contact">
                <p>Masz pytania w sprawie zamówienia?</p>
                <p>
                  {siteContact.phone ? (
                    <a href={`tel:${siteContact.phone.replace(/\s+/g, "")}`}>{siteContact.phone}</a>
                  ) : null}
                  {siteContact.phone && siteContact.email ? " · " : null}
                  {siteContact.email ? <a href={`mailto:${siteContact.email}`}>{siteContact.email}</a> : null}
                </p>
              </div>
            ) : null}

            <Link href="/" className="cart-thankyou-back">
              ← Wróć do sklepu
            </Link>
          </div>
        ) : items.length === 0 && !orderState ? (
          <div className="cart-page-empty">
            <p>Twój koszyk jest jeszcze pusty.</p>
            <Link href={emptyCartTarget(backHref).href} className="cart-page-empty-cta">
              {emptyCartTarget(backHref).label}
            </Link>
          </div>
        ) : isV2Body ? (
          <CartV2Boundary
            onCrash={(message) => {
              markCartV2Crashed();
              trackCheckoutIssue("cart_v2_crash", message.slice(0, 120));
              setCartDesign("classic");
            }}
          >
            <CartV2 {...buildV2Props()} />
          </CartV2Boundary>
        ) : (
          <>
            {items.length > 0 ? (
              <section className="cart-basket-card">
                <button
                  type="button"
                  className="cart-basket-toggle"
                  aria-expanded={itemsOpen ? "true" : "false"}
                  onClick={() => setItemsOpen((prev) => !prev)}
                >
                  <span className="cart-basket-toggle-label">
                    Twój koszyk
                    <em>
                      {summary.items} {summary.items === 1 ? "pozycja" : summary.items < 5 ? "pozycje" : "pozycji"}
                    </em>
                  </span>
                  <span className="cart-basket-toggle-meta">
                    <strong>{formatPln(payableTotal)}</strong>
                    <span className="cart-basket-toggle-chevron" aria-hidden="true">
                      {itemsOpen ? "▴" : "▾"}
                    </span>
                  </span>
                </button>
                {itemsOpen ? (
              <ul className="cart-page-items">
                {items.map((item) => (
                  <li key={item.id} className="cart-page-item">
                    {resolveCartWindowThumb(item) ? (
                      // Okno z prawdziwym widokiem i produktem w wybranych
                      // kolorach (app/components/cart-window-thumb.tsx);
                      // gałęzie niżej zostają dla pozycji bez znanych kolorów.
                      <div className="cart-page-item-thumb cart-page-item-thumb--window">
                        <CartWindowThumb item={item} label={`${item.productLabel} na oknie, w wybranych kolorach`} />
                      </div>
                    ) : item.productSlug === "plisy" && item.fabricColor ? (
                      // Same tinted graphic as the configurator's own
                      // preview (features/plisy/PlisaPreview.tsx), just
                      // shrunk to thumbnail size - real fabric/hardware
                      // colours, not a generic icon.
                      <div className="cart-page-item-thumb cart-page-item-thumb--plisa">
                        <PlisaPreview fabricColor={item.fabricColor} hardwareColor={item.hardwareColor || ""} />
                      </div>
                    ) : item.productSlug === "plisy-dachowe" && item.fabricColor ? (
                      <div className="cart-page-item-thumb cart-page-item-thumb--plisa">
                        <PlisaDachowaPreview fabricColor={item.fabricColor} hardwareColor={item.hardwareColor || ""} />
                      </div>
                    ) : (
                      <div
                        className="cart-page-item-thumb"
                        style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}
                      />
                    )}
                    <div className="cart-page-item-info">
                      <strong>{item.productLabel}</strong>
                      <CartItemSpecs item={item} />
                      {item.productSlug === "plisy" && item.sagNoticeShown ? (
                        <span className="cart-page-item-sag" role="note">
                          Szerokość powyżej {(item.sagLimitMm || 1100) / 10} cm: profil aluminiowy może się lekko ugiąć pod ciężarem
                          tkaniny. To naturalne — nie wpływa na działanie plisy, jedynie na estetykę.
                        </span>
                      ) : null}
                      <span className="cart-page-item-unit">
                        {combinedDiscountPercent > 0 ? (
                          <>
                            <span className="cart-page-item-price-original">{formatPln(item.price)}</span>{" "}
                            <span className="cart-page-item-price-discounted">
                              {formatPln(item.price * (1 - combinedDiscountPercent / 100))}
                            </span>
                          </>
                        ) : (
                          formatPln(item.price)
                        )}{" "}
                        / szt.
                      </span>
                      {item.oversizeSurchargeAmount ? (
                        <span className="cart-page-item-surcharge-note">
                          + {formatPln(item.oversizeSurchargeAmount)} dopłaty za przesyłkę dłużycową (rozmiar
                          przekracza {OVERSIZE_SURCHARGE_THRESHOLD_MM} mm)
                        </span>
                      ) : null}
                    </div>
                    <div className="cart-page-item-qty">
                      <button
                        type="button"
                        onClick={() => handleQtyChange(item.id, item.qty - 1)}
                        disabled={item.qty <= 1 || dataLocked}
                        aria-label="Zmniejsz ilość"
                      >
                        −
                      </button>
                      <span>{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => handleQtyChange(item.id, item.qty + 1)}
                        disabled={dataLocked}
                        aria-label="Zwiększ ilość"
                      >
                        +
                      </button>
                    </div>
                    <div className="cart-page-item-total">
                      {combinedDiscountPercent > 0 ? (
                        <>
                          <span className="cart-page-item-price-original">{formatPln(item.total)}</span>
                          <span className="cart-page-item-price-discounted">
                            {formatPln(item.total * (1 - combinedDiscountPercent / 100))}
                          </span>
                        </>
                      ) : (
                        formatPln(item.total)
                      )}
                    </div>
                    <button
                      type="button"
                      className="cart-page-item-remove"
                      onClick={() => handleRemove(item.id)}
                      disabled={dataLocked}
                      aria-label="Usuń pozycję"
                    >
                      Usuń
                    </button>
                    {item.productSlug === "moskitiery-ramkowe" || item.productSlug === "plisy" || item.productSlug === "rolety-dachowe" || item.productSlug === "plisy-dachowe" ? (
                      <button
                        type="button"
                        className="cart-page-item-edit"
                        onClick={() => {
                          setEditingItemId(item.id);
                          trackCheckoutIssue("cart_edit_open", item.productSlug);
                        }}
                        disabled={dataLocked}
                      >
                        Edytuj pozycję
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
                ) : null}
                {!dataLocked ? (
                  <Link href={backHref} className="cart-page-add-more">
                    + Dodaj kolejną pozycję
                  </Link>
                ) : null}
                <div className="cart-summary-card-body">
                  <div className="cart-discount-code">
                    {appliedDiscount || discountOpen || discountError ? (
                      <span className="cart-discount-code-label">Kod rabatowy</span>
                    ) : null}
                    {appliedDiscount ? (
                      <div className="cart-discount-code-applied">
                        <span>
                          <strong>{appliedDiscount.code}</strong>{" "}
                          {appliedDiscount.type === "percent"
                            ? `-${appliedDiscount.value.toLocaleString("pl-PL")}%`
                            : `-${formatPln(appliedDiscount.value)}`}
                        </span>
                        <button type="button" onClick={removeDiscountCode}>
                          Usuń
                        </button>
                      </div>
                    ) : !discountOpen && !discountError ? (
                      <button type="button" className="cart-discount-code-toggle" onClick={() => setDiscountOpen(true)}>
                        Masz kod rabatowy?
                      </button>
                    ) : (
                      <div className="cart-discount-code-row">
                        <input
                          type="text"
                          autoFocus
                          value={discountCodeInput}
                          onChange={(event) => {
                            setDiscountCodeInput(event.target.value);
                            if (discountError) setDiscountError("");
                          }}
                          placeholder="np. LATO2026"
                          disabled={discountChecking}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              checkDiscountCode();
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => checkDiscountCode()}
                          disabled={discountChecking || !discountCodeInput.trim()}
                        >
                          {discountChecking ? "Sprawdzam…" : "Sprawdź"}
                        </button>
                      </div>
                    )}
                    {discountError ? <p className="cart-discount-code-error">{discountError}</p> : null}
                  </div>

                  <div className="cart-page-summary-row is-muted">
                    <span>
                      {summary.items} {summary.items === 1 ? "produkt" : "produktów"}
                    </span>
                    <span>{formatPln(summary.total)}</span>
                  </div>
                  {combinedSavings > 0 ? (
                    <div className="cart-page-summary-row is-muted">
                      <span>Wspólne rozliczenie obwodu moskitier</span>
                      <span>-{formatPln(combinedSavings)}</span>
                    </div>
                  ) : null}
                  {appliedDiscount ? (
                    <div className="cart-page-summary-row is-muted">
                      <span>Kod rabatowy {appliedDiscount.code}</span>
                      <span>-{formatPln(appliedDiscount.amount)}</span>
                    </div>
                  ) : null}
                  {rescueGrant && rescueAmount > 0 ? (
                    <div className={`cart-page-summary-row is-muted${rescueGrant.kind === "escape" ? " is-escape-offer" : ""}`}>
                      <span>
                        {rescueGrant.kind === "escape" && rescueGrant.expiresAtMs
                          ? `Dodatkowy rabat (-${rescueGrant.percent}%), ważny ${formatEscapeDeadline(rescueGrant.expiresAtMs)}`
                          : `Rabat za zapisanie wyceny (-${rescueGrant.percent}%)`}
                      </span>
                      <span>-{formatPln(rescueAmount)}</span>
                    </div>
                  ) : null}
                  {deliveryMethod !== PICKUP_METHOD.id ? (
                    <div className="cart-page-summary-row is-muted">
                      <span>Koszt dostawy</span>
                      <span>{shippingFee > 0 ? formatPln(shippingFee) : "Gratis"}</span>
                    </div>
                  ) : null}
                  {expressFee > 0 ? (
                    <div className="cart-page-summary-row is-muted">
                      <span>Ekspres - priorytet produkcji</span>
                      <span>{formatPln(expressFee)}</span>
                    </div>
                  ) : null}
                  {orderSurcharge > 0 ? (
                    <div className="cart-page-summary-row is-muted">
                      <span>Dopłata za przesyłkę dłużycową</span>
                      <span>{formatPln(orderSurcharge)}</span>
                    </div>
                  ) : null}
                  {paymentMethod === "cod" ? (
                    <div className="cart-page-summary-row is-muted">
                      <span>Dopłata za płatność za pobraniem</span>
                      <span>{formatPln(COD_SURCHARGE_AMOUNT)}</span>
                    </div>
                  ) : null}
                  <div className="total-block">
                    <span className="total-block-left">
                      <span className="total-block-label">Do zapłaty</span>
                      {totalSavings > 0 ? (
                        <span className="total-block-savings">Oszczędzasz {formatPln(totalSavings)}</span>
                      ) : null}
                      {shippingFee === 0 && deliveryMethod !== PICKUP_METHOD.id ? (
                        <span className="total-block-chip">🚚 dostawa gratis</span>
                      ) : null}
                    </span>
                    <span className="total-block-right">
                      {totalSavings > 0 ? <s>{formatPln(payableTotal + totalSavings)}</s> : null}
                      <strong>{formatPln(payableTotal)}</strong>
                    </span>
                  </div>

                  {/* Oferta ratalna przy każdej kwocie - raty są włączone
                      na koncie P24 (właściciel, 2026-09-24). */}
                  <InstallmentOffer amount={payableTotal} />

                  {shippingFee > 0 && amountToFreeShipping > 0 ? (
                    <p className="cart-free-shipping-progress">
                      Brakuje <strong>{formatPln(amountToFreeShipping)}</strong> do <strong>darmowej dostawy</strong>.{" "}
                      <a href="/produkt/moskitiery-ramkowe" className="cart-free-shipping-cta">
                        Wyceń dodatkową moskitierę
                      </a>
                    </p>
                  ) : null}

                  {sezon20Promo ? (
                    <button type="button" className="cart-promo-banner" onClick={applySezon20Promo}>
                      <span className="cart-promo-banner-label">
                        Zamów z kodem rabatowym SEZON20{" "}
                        {sezon20Promo.type === "percent"
                          ? `-${sezon20Promo.value.toLocaleString("pl-PL")}%`
                          : `-${formatPln(sezon20Promo.value)}`}
                      </span>
                      <strong className="cart-promo-banner-price">
                        {formatPln(
                          Math.max(
                            0,
                            summary.total -
                              combinedSavings -
                              sezon20Promo.amount +
                              shippingFee +
                              orderSurcharge +
                              (paymentMethod === "cod" ? COD_SURCHARGE_AMOUNT : 0),
                          ),
                        )}
                      </strong>
                    </button>
                  ) : null}
                </div>
              </section>
            ) : (
              <p className="cart-page-order-note">Koszyk opróżniony po złożeniu zamówienia poniżej.</p>
            )}

            {/* Pozycje i podsumowanie w jednej karcie: lista zwinięta,
                pod nią kwoty już po rabatach (właściciel, 2026-09-24).
                Był tu też przycisk "Zapisz / udostępnij link" - usunięty:
                w koszyku był tylko wygodną furtką do odłożenia zakupu. */}


            <div className="cart-checkout-layout">
              <div className="cart-checkout-left" onBlurCapture={handleCheckoutFieldBlur}>
                {showExpressWallets ? (
                  <ExpressWalletCheckout
                    publishableKey={STRIPE_PUBLISHABLE_KEY}
                    amountGrosze={Math.round(payableTotal * 100)}
                    onCreateOrder={(contact) => submitOrder({ stripeMethod: "wallets", wallet: contact })}
                    onPaid={handleWalletPaid}
                    onAvailability={setExpressWalletsAvailable}
                  />
                ) : null}
                {expressEligible ? (
                  <section className="cart-delivery-card cart-dispatch-card">
                    <h2>Termin realizacji</h2>
                    <div className="cart-delivery-options">
                      <label className={`cart-delivery-option ${!expressSelected ? "is-active" : ""}`}>
                        <input
                          type="radio"
                          name="dispatch-speed"
                          value="standard"
                          checked={!expressSelected}
                          onChange={() => chooseExpress(false)}
                          disabled={dataLocked}
                        />
                        <span className="cart-delivery-option-copy">
                          <strong>Standard</strong>
                          <small>
                            {dispatchInfo ? `Wysyłka ${dispatchInfo.standardLabel}` : "Wysyłka zwykle w 3 dni robocze"}
                          </small>
                        </span>
                        <span className="cart-delivery-option-price">Gratis</span>
                      </label>
                      <label className={`cart-delivery-option cart-delivery-option--express ${expressSelected ? "is-active" : ""}`}>
                        <input
                          type="radio"
                          name="dispatch-speed"
                          value="express"
                          checked={expressSelected}
                          onChange={() => chooseExpress(true)}
                          disabled={dataLocked}
                        />
                        <span className="cart-delivery-option-copy">
                          <strong>⚡ Ekspres - priorytet produkcji</strong>
                          <small>
                            Wysyłka {dispatchInfo ? dispatchInfo.expressLabel : "jutro"}. Do {dispatchInfo?.cutoffLabel || "12:00"} w dzień
                            roboczy wysyłamy tego samego dnia.
                          </small>
                        </span>
                        <span className="cart-delivery-option-price">+{formatPln(EXPRESS_FEE_AMOUNT)}</span>
                      </label>
                    </div>
                  </section>
                ) : null}

                {!expressEligible && plisyLeadTime ? (
                  <section className="cart-delivery-card cart-dispatch-card">
                    <h2>Termin realizacji</h2>
                    <p className="cart-dispatch-static">
                      <strong>Wysyłka w 5–7 dni roboczych.</strong>
                    </p>
                  </section>
                ) : null}

                <CartTrustBlock />

                {/* Dostawa jako akordeon (właściciel, 2026-09-24): wybór
                    metody od razu otwiera pola, których ta metoda wymaga -
                    kurier prosi o adres, paczkomat o dane odbiorcy i punkt,
                    odbiór osobisty tylko o kontakt. Wszystkie pola piszą do
                    tego samego stanu formularza, więc przełączenie metody
                    nie kasuje tego, co klient już wpisał. */}
                <section className="cart-delivery-card cart-delivery-card--accordion" ref={shippingAddressSectionRef}>
                  <h2>Dostawa i dane odbiorcy</h2>
                  <div className="cart-delivery-options">
                    {availableDeliveryMethods.map((method) => {
                      const isPaczkomat = method.id === PACZKOMAT_METHOD.id;
                      const isPickup = method.id === PICKUP_METHOD.id;
                      const isActive = deliveryMethod === method.id;
                      const needsAddress = !isPaczkomat && !isPickup;
                      return (
                        <div key={method.id} className={`cart-delivery-option-group ${isActive ? "is-open" : ""}`}>
                          <label className={`cart-delivery-option ${isActive ? "is-active" : ""}`}>
                            <input
                              type="radio"
                              name="delivery-method"
                              value={method.id}
                              checked={isActive}
                              onChange={() => {
                                setDeliveryMethod(method.id);
                                trackCheckoutIssue("checkout_delivery", method.label, { method_id: method.id });
                              }}
                              disabled={dataLocked}
                            />
                            <span className="cart-delivery-option-copy">
                              <strong>{method.label}</strong>
                              <small>{method.description}</small>
                            </span>
                            <span className="cart-delivery-option-price">
                              {method.extraFee ? `+${formatPln(method.extraFee)}` : "Gratis"}
                            </span>
                          </label>
                          <div className={`cart-delivery-accordion ${isActive ? "is-open" : ""}`}>
                            {isActive ? (
                              <div className="cart-delivery-accordion-inner">
                                {isPaczkomat ? (
                                  <div data-checkout-field="paczkomat">
                                    <PaczkomatPicker
                                      value={selectedPaczkomat}
                                      onChange={(point) => {
                                        setSelectedPaczkomat(point);
                                        if (point) trackCheckoutIssue("checkout_paczkomat", point.id, { address: point.address });
                                      }}
                                    />
                                  </div>
                                ) : null}
                                <fieldset className="cart-checkout-form" disabled={dataLocked}>
                                  <legend className="cart-delivery-fields-legend">
                                    {isPaczkomat
                                      ? "Dane odbiorcy"
                                      : isPickup
                                        ? "Dane do kontaktu"
                                        : "Dane do wysyłki"}
                                  </legend>
                                  {/* Kolejność pod autouzupełnianie przeglądarki
                                      (audyt 2026-09-13): kontakt, potem imię i
                                      nazwisko, potem ulica -> kod -> miasto. */}
                                  <div className="cart-checkout-form-grid">
                                    <label className="is-wide">
                                      E-mail
                                      <CartFieldStatus valid={emailValid} fieldKey="email" error={fieldError("email")}>
                                        <input
                                          type="email"
                                          inputMode="email"
                                          autoComplete="email"
                                          value={form.email}
                                          onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                                          required
                                        />
                                      </CartFieldStatus>
                                    </label>
                                    <label>
                                      Telefon <span className="cart-field-hint">+48</span>
                                      <CartFieldStatus valid={phoneFieldValid} fieldKey="phone" error={fieldError("phone")}>
                                        <input
                                          type="tel"
                                          inputMode="tel"
                                          autoComplete="tel-national"
                                          placeholder="790 215 251"
                                          value={form.phone}
                                          onChange={(event) => handlePhoneChange(event.target.value)}
                                          required
                                        />
                                      </CartFieldStatus>
                                    </label>
                                    <label>
                                      Imię
                                      <CartFieldStatus valid={firstNameFieldValid} fieldKey="firstName" error={fieldError("firstName")}>
                                        <input
                                          autoComplete="given-name"
                                          value={form.firstName}
                                          onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                                          required
                                        />
                                      </CartFieldStatus>
                                    </label>
                                    <label>
                                      Nazwisko
                                      <CartFieldStatus valid={lastNameFieldValid} fieldKey="lastName" error={fieldError("lastName")}>
                                        <input
                                          autoComplete="family-name"
                                          value={form.lastName}
                                          onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                                          required
                                        />
                                      </CartFieldStatus>
                                    </label>
                                    {needsAddress ? (
                                      <>
                                        <label className="is-wide">
                                          Ulica i numer
                                          <CartFieldStatus valid={address1FieldValid} fieldKey="address1" error={fieldError("address1")}>
                                            <input
                                              autoComplete="street-address"
                                              placeholder="np. Kwiatowa 5 — albo sam numer, jeśli wieś bez ulic"
                                              value={form.address1}
                                              onChange={(event) =>
                                                setForm((current) => ({ ...current, address1: event.target.value }))
                                              }
                                              onFocus={() => setAddress1Focused(true)}
                                              onBlur={() => setAddress1Focused(false)}
                                            />
                                          </CartFieldStatus>
                                        </label>
                                        <label>
                                          Kod pocztowy
                                          <CartFieldStatus valid={postcodeFieldValid} fieldKey="postcode" error={fieldError("postcode")}>
                                            <input
                                              autoComplete="postal-code"
                                              inputMode="numeric"
                                              placeholder="00-000"
                                              value={form.postcode}
                                              onChange={(event) => handlePostcodeChange(event.target.value)}
                                            />
                                          </CartFieldStatus>
                                        </label>
                                        <label>
                                          Miasto
                                          <CartFieldStatus valid={cityFieldValid} fieldKey="city" error={fieldError("city")}>
                                            <input
                                              autoComplete="address-level2"
                                              value={form.city}
                                              onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                                            />
                                          </CartFieldStatus>
                                        </label>
                                      </>
                                    ) : null}
                                  </div>
                                </fieldset>
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {noteOpen || form.note.trim() !== "" ? (
                    <label className="cart-checkout-note-field">
                      Dodatkowe informacje
                      <textarea
                        autoFocus={noteOpen}
                        value={form.note}
                        onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                        disabled={dataLocked}
                      />
                    </label>
                  ) : (
                    <button
                      type="button"
                      className="cart-checkout-note-toggle"
                      onClick={() => setNoteOpen(true)}
                      disabled={dataLocked}
                    >
                      + Dodaj uwagi do zamówienia
                    </button>
                  )}
                </section>

                {/* Dane kupującego i faktura w jednym, zwiniętym bloku
                    (właściciel, 2026-09-24): domyślnie kupujący = odbiorca,
                    więc karta to jedna linijka. Pytanie o fakturę siedzi w
                    środku - wychodzi z założenia, że faktura zwykle idzie na
                    inne dane niż paczka; gdy są te same, jest przycisk
                    "Skopiuj dane z dostawy". */}
                <section className="cart-checkout-form-card cart-buyer-card">
                  <fieldset className="cart-checkout-form" disabled={dataLocked}>
                    <label className="cart-toggle-checkbox cart-toggle-checkbox--framed">
                      <input
                        type="checkbox"
                        checked={buyerDifferent}
                        onChange={(event) => {
                          setBuyerDifferent(event.target.checked);
                          // Faktura mieszka w tym akordeonie, więc po jego
                          // zamknięciu nie może zostać włączona w tle.
                          if (!event.target.checked) setWantsInvoice(false);
                          trackCheckoutIssue("checkout_buyer_other", event.target.checked ? "on" : "off");
                        }}
                      />
                      <span>
                        <strong>Inne dane kupującego / chcę fakturę</strong>
                      </span>
                    </label>

                    {buyerDifferent ? (
                      <div className="cart-buyer-fields">
                        <button
                          type="button"
                          className="cart-buyer-copy"
                          onClick={() =>
                            setBuyer((current) => ({
                              ...current,
                              name: `${form.firstName} ${form.lastName}`.trim() || current.name,
                              email: form.email || current.email,
                              phone: form.phone || current.phone,
                              street: form.address1 || current.street,
                              postcode: form.postcode || current.postcode,
                              city: form.city || current.city,
                            }))
                          }
                        >
                          Skopiuj dane z dostawy
                        </button>
                        <div className="cart-checkout-form-grid">
                          <label className="is-wide">
                            Imię i nazwisko / firma
                            <CartFieldStatus valid={buyerNameValid} fieldKey="buyerName" error={fieldError("buyerName")}>
                              <input
                                value={buyer.name}
                                onChange={(event) => setBuyer((current) => ({ ...current, name: event.target.value }))}
                              />
                            </CartFieldStatus>
                          </label>
                          <label>
                            E-mail
                            <CartFieldStatus valid={buyerEmailValid} fieldKey="buyerEmail" error={fieldError("buyerEmail")}>
                              <input
                                type="email"
                                inputMode="email"
                                value={buyer.email}
                                onChange={(event) => setBuyer((current) => ({ ...current, email: event.target.value }))}
                              />
                            </CartFieldStatus>
                          </label>
                          <label>
                            Telefon
                            <input
                              type="tel"
                              inputMode="tel"
                              value={buyer.phone}
                              onChange={(event) => setBuyer((current) => ({ ...current, phone: event.target.value }))}
                            />
                          </label>
                          <label className="is-wide">
                            Ulica i numer
                            <input
                              value={buyer.street}
                              onChange={(event) => setBuyer((current) => ({ ...current, street: event.target.value }))}
                            />
                          </label>
                          <label>
                            Kod pocztowy
                            <input
                              inputMode="numeric"
                              placeholder="00-000"
                              value={buyer.postcode}
                              onChange={(event) => setBuyer((current) => ({ ...current, postcode: event.target.value }))}
                            />
                          </label>
                          <label>
                            Miasto
                            <input
                              value={buyer.city}
                              onChange={(event) => setBuyer((current) => ({ ...current, city: event.target.value }))}
                            />
                          </label>
                        </div>

                        <label className="cart-toggle-checkbox cart-toggle-checkbox--inner">
                          <input
                            type="checkbox"
                            checked={wantsInvoice}
                            onChange={(event) => {
                              setWantsInvoice(event.target.checked);
                              trackCheckoutIssue("checkout_invoice", event.target.checked ? "on" : "off");
                            }}
                          />
                          <span>
                            <strong>Chcę fakturę</strong>
                          </span>
                        </label>

                        {wantsInvoice ? (
                          <div className="cart-invoice-fields">
                            <label className="cart-invoice-nip-field">
                              NIP
                              <div className="cart-invoice-nip-row">
                                <CartFieldStatus valid={nipFieldValid && !nipLookupLoading} fieldKey="nip" error={fieldError("nip")}>
                                  <input
                                    inputMode="numeric"
                                    placeholder="np. 1234567890"
                                    value={invoice.nip}
                                    onChange={(event) => {
                                      const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
                                      setInvoice((current) => ({ ...current, nip: digits }));
                                      setNipLookupError("");
                                      if (digits.length === 10) void lookupNip(digits);
                                    }}
                                    onBlur={() => {
                                      if (invoice.nip.length === 10) void lookupNip(invoice.nip);
                                    }}
                                  />
                                </CartFieldStatus>
                                {nipLookupLoading ? <span className="cart-invoice-nip-spinner" aria-hidden="true" /> : null}
                              </div>
                              {nipLookupError ? <small className="cart-invoice-nip-error">{nipLookupError}</small> : null}
                            </label>
                            <div className="cart-checkout-form-grid">
                              <label>
                                Nazwa firmy
                                <CartFieldStatus valid={companyNameFieldValid} fieldKey="companyName" error={fieldError("companyName")}>
                                  <input
                                    value={invoice.companyName}
                                    onChange={(event) =>
                                      setInvoice((current) => ({ ...current, companyName: event.target.value }))
                                    }
                                  />
                                </CartFieldStatus>
                              </label>
                              <label>
                                Ulica i numer
                                <CartFieldStatus valid={invoiceStreetFieldValid} fieldKey="invoiceStreet" error={fieldError("invoiceStreet")}>
                                  <input
                                    value={invoice.street}
                                    onChange={(event) => setInvoice((current) => ({ ...current, street: event.target.value }))}
                                  />
                                </CartFieldStatus>
                              </label>
                              <label>
                                Kod pocztowy
                                <CartFieldStatus valid={invoicePostcodeFieldValid} fieldKey="invoicePostcode" error={fieldError("invoicePostcode")}>
                                  <input
                                    value={invoice.postcode}
                                    onChange={(event) =>
                                      setInvoice((current) => ({ ...current, postcode: event.target.value }))
                                    }
                                  />
                                </CartFieldStatus>
                              </label>
                              <label>
                                Miasto
                                <CartFieldStatus valid={invoiceCityFieldValid} fieldKey="invoiceCity" error={fieldError("invoiceCity")}>
                                  <input
                                    value={invoice.city}
                                    onChange={(event) => setInvoice((current) => ({ ...current, city: event.target.value }))}
                                  />
                                </CartFieldStatus>
                              </label>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ) : null}

                  </fieldset>
                </section>
              </div>

              <aside className="cart-checkout-right">
                <section className="cart-payment-card" ref={paymentSectionRef}>
                  <div className="cart-payment-card-head">
                    <h2>Płatność</h2>
                    {/* Ta sama kwota, co w podsumowaniu i na pasku na dole -
                        tu bez przekreśleń i oszczędności, żeby przy wyborze
                        metody płatności była jedna liczba (właściciel,
                        2026-09-27). Zawiera już rabat, dostawę i dopłaty,
                        łącznie z pobraniem. */}
                    <span className="cart-payment-due">
                      <span className="cart-payment-due-label">Do zapłaty</span>
                      <strong>{formatPln(payableTotal)}</strong>
                    </span>
                  </div>
                  <PaymentTrustTicker />
                  {paymentMethod === "cod" ? (
                    <p className={`cart-payment-method-badge ${deliveryDataReady ? "" : "is-muted"}`}>
                      Płatność za pobraniem
                    </p>
                  ) : (
                    <>
                      <p className="cart-payment-method-badge">Sposób płatności</p>
                      {renderPaymentKindChooser()}
                    </>
                  )}

                  {paymentMethod === "cod" ? (
                    <>
                      {error ? <div className="cart-checkout-error">{error}</div> : null}
                      {/* Kod SMS czeka na wpisanie, a okno jest zamknięte -
                          pole musi być widoczne TU, przy metodzie płatności,
                          i zwracać na siebie uwagę (właściciel, 2026-10-02).
                          Pulsuje tylko do pierwszego dotknięcia pola, żeby
                          nie migało klientowi pod palcami przy wpisywaniu. */}
                      {codPendingInline ? (
                        <div className={`cart-cod-pending ${codSms.code ? "" : "is-pulsing"}`}>
                          <div className="cart-cod-pending-head">
                            <strong>Wpisz kod z SMS-a</strong>
                            <span>wysłany na {form.phone}</span>
                          </div>
                          {codSms.error ? <div className="cart-checkout-error">{codSms.error}</div> : null}
                          <div className="cart-cod-pending-row">
                            <input
                              inputMode="numeric"
                              className="cart-cod-pending-input"
                              placeholder="123456"
                              aria-label="Kod z SMS-a"
                              value={codSms.code}
                              onChange={(event) =>
                                setCodSms((current) => ({
                                  ...current,
                                  code: event.target.value.replace(/\D/g, "").slice(0, 6),
                                  error: "",
                                }))
                              }
                            />
                            <button
                              type="button"
                              className="cart-cod-pending-confirm"
                              onClick={() => void verifyCodSms()}
                              disabled={codSms.code.length !== 6 || codSms.status === "verifying"}
                            >
                              {codSms.status === "verifying" ? "Sprawdzamy…" : "Potwierdź"}
                            </button>
                          </div>
                          <button type="button" className="cart-cod-resend" onClick={() => void sendCodSms()} disabled={codResendIn > 0}>
                            Wyślij nowy kod
                          </button>
                        </div>
                      ) : null}
                      {termsCheckbox}
                      <button
                        type="button"
                        className={`cart-page-checkout-cta ${payBlockedReason ? "is-blocked" : ""}`}
                        onClick={() => {
                          if (payBlockedReason) {
                            jumpToFirstProblem();
                            return;
                          }
                          setCodModalOpen(true);
                          // Drugi klik w "Zamawiam" z kodem już w drodze nie
                          // wysyła kolejnego SMS-a - otwiera to samo okno.
                          if (!codPendingInline) {
                            void sendCodSms();
                          }
                        }}
                        disabled={!payBlockedReason && !termsAccepted}
                      >
                        {codPendingInline ? "Wpisz kod z SMS-a" : "Zamawiam"}
                      </button>
                      {missingFieldsHint}
                    </>
                  ) : null}
                </section>
              </aside>
            </div>

            {/* Koniec koszyka: dojście tutaj bez tknięcia formularza to chwila
                na ofertę "dodatkowe 5%" (app/components/escape-offer.tsx). */}
            {items.length > 0 && !orderState ? (
              <div ref={escapeOffer.bottomRef} className="escape-offer-sentinel" aria-hidden="true" />
            ) : null}

            {/* Ostatni blok koszyka: dla kogoś, kto przewinął całą stronę i
                niczego nie wypełnił. Celowo TU, a nie nad formularzami -
                wcześniej był wygodną furtką do odłożenia zakupu
                (właściciel, 2026-09-24). Od 2026-09-29 znika w chwili, gdy
                klient tknie dane kontaktowe (jest zdecydowany - konwersja
                58% na telefonie), i odsłania się płynnie dopiero po wejściu
                w pole widzenia. */}
            {items.length > 0 && !orderState && contactUntouched && cartKeepArm === "banner" ? (
              <section ref={cartKeepRef} className={`cart-keep-card ${cartKeepVisible ? "is-visible" : ""}`}>
                <span className="cart-keep-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="none">
                    <path
                      d="M6.5 3.5h11a1 1 0 0 1 1 1v15.2a.8.8 0 0 1-1.22.68L12 17.2l-5.28 3.18A.8.8 0 0 1 5.5 19.7V4.5a1 1 0 0 1 1-1Z"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      strokeLinejoin="round"
                    />
                    <path d="M9 8.5h6M9 11.5h4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                </span>
                <span className="cart-keep-copy">
                  <strong>Nie decydujesz dzisiaj?</strong>
                  {cartEmailArm === "show" ? (
                    <span>
                      Wyślemy Ci ten koszyk na e-mail i <strong>zamrozimy dzisiejszą cenę na 7 dni</strong>.
                    </span>
                  ) : (
                    <span>
                      Wyślij sobie link do tego koszyka —{" "}
                      {appliedDiscount ? (
                        <>
                          wymiary i rabat <strong>{appliedDiscount.code}</strong> zostaną zapisane
                        </>
                      ) : (
                        <>wymiary i wycena zostaną zapisane</>
                      )}
                      .
                    </span>
                  )}
                </span>
                <button
                  type="button"
                  className="cart-keep-cta"
                  onClick={() => {
                    // "show" arm (2026-09-26): the explicit click opens the
                    // e-mail-first freeze offer; control keeps the old share modal.
                    if (cartEmailArm === "show" && cartEmailNudge.fireManual()) return;
                    openCartShareModal();
                  }}
                >
                  {cartEmailArm === "show" ? "Wyślij mi koszyk na e-mail" : "Wyślij mi link do koszyka"}
                </button>
              </section>
            ) : null}
          </>
        )}
      </main>

      {/* Mobile-only sticky total + next step (audit 2026-09-13): on a phone
          the summary sat below eight form fields, so the total and the way
          forward were both off-screen for most of the checkout. */}
      {hydrated && cartDesign !== null && items.length > 0 && !orderConfirmed && !isV2Body ? (
        <div
          className={`cart-sticky-bar${escapeOffer.offer ? " has-escape-offer" : ""}`}
          role="region"
          aria-label="Podsumowanie zamówienia"
        >
          <EscapeOfferCountdownChip controller={escapeOffer} />
          <div className="cart-sticky-bar-total">
            <span>Razem</span>
            <strong>{formatPln(payableTotal)}</strong>
          </div>
          {checkoutReady && paymentMethod === "transfer" && termsAccepted ? (
            <button
              type="button"
              className="cart-sticky-bar-cta"
              disabled={isSubmitting}
              onClick={() => {
                setError("");
                submittedRef.current = false;
                void submitOrder().catch(() => {});
              }}
            >
              {isSubmitting ? "Zapisujemy…" : "Zamawiam (przelew)"}
            </button>
          ) : (
            <button
              type="button"
              className="cart-sticky-bar-cta is-secondary"
              onClick={() => (deliveryDataReady ? scrollToSection(paymentSectionRef) : jumpToFirstProblem())}
            >
              {deliveryDataReady ? "Do płatności ↓" : "Uzupełnij dane ↓"}
            </button>
          )}
        </div>
      ) : null}

      {codModalOpen && !orderState ? (
        <div className="cod-sms-modal-overlay" role="dialog" aria-modal="true" aria-label="Potwierdzenie kodem SMS">
          <div className="cod-sms-modal-shell">
            <button
              type="button"
              className="cod-sms-modal-close"
              aria-label="Zamknij"
              onClick={() => {
                // Zamknięcie okna NIE wyrzuca wysłanego kodu. Właściciel
                // 2026-10-02: "jak go zamknie, to miejsce na kod musi nadal
                // widnieć tam, gdzie metody płatności, i na przykład
                // pulsować". Wcześniej token przepadał i klient z SMS-em
                // w ręku nie miał już gdzie go wpisać - musiał zamawiać od
                // nowa, żeby dostać drugi kod.
                setCodModalOpen(false);
                setCodSms((current) => ({ ...current, error: "" }));
              }}
            >
              ×
            </button>
            <h3>Potwierdź zamówienie kodem SMS</h3>
            {codSms.status === "sending" ? (
              <div className="cart-payment-waiting">
                <span className="cart-invoice-nip-spinner" aria-hidden="true" />
                Wysyłamy kod na numer {form.phone}…
              </div>
            ) : codSms.status === "verified" ? (
              error ? (
                <>
                  <div className="cart-checkout-error">{error}</div>
                  <button
                    type="button"
                    className="cart-page-checkout-cta"
                    onClick={() => {
                      setError("");
                      submittedRef.current = false;
                      void submitOrder();
                    }}
                  >
                    Spróbuj ponownie
                  </button>
                </>
              ) : (
                <div className="cart-payment-waiting">
                  <span className="cart-invoice-nip-spinner" aria-hidden="true" />
                  Potwierdzamy zamówienie…
                </div>
              )
            ) : (
              <>
                {codPhoneEdit === null ? (
                  <p className="cod-sms-phone-line">
                    Wpisz kod SMS wysłany na numer <strong>{form.phone}</strong>.{" "}
                    <button
                      type="button"
                      className="cod-sms-phone-fix"
                      onClick={() => {
                        setCodPhoneEdit(form.phone);
                        trackCheckoutIssue("checkout_cod_phone_fix", "open");
                      }}
                    >
                      Zły numer? Popraw
                    </button>
                  </p>
                ) : (
                  <form
                    className="cod-sms-phone-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      const next = codPhoneEdit.trim();
                      if (next.replace(/\D/g, "").length < 9) return;
                      setForm((current) => ({ ...current, phone: next }));
                      setCodPhoneEdit(null);
                      setCodSentAt(0);
                      trackCheckoutIssue("checkout_cod_phone_fix", next === form.phone ? "same" : "changed");
                      void sendCodSms(next);
                    }}
                  >
                    <label htmlFor="cod-sms-phone-input">Numer telefonu</label>
                    <div className="cod-sms-phone-row">
                      <input
                        id="cod-sms-phone-input"
                        type="tel"
                        inputMode="tel"
                        autoComplete="tel"
                        autoFocus
                        value={codPhoneEdit}
                        onChange={(event) => setCodPhoneEdit(event.target.value)}
                      />
                      <button type="submit" className="cart-page-checkout-cta" disabled={codPhoneEdit.replace(/\D/g, "").length < 9}>
                        Wyślij kod
                      </button>
                    </div>
                    <button type="button" className="cart-cod-resend" onClick={() => setCodPhoneEdit(null)}>
                      Anuluj
                    </button>
                  </form>
                )}
                {codSms.error ? <div className="cart-checkout-error">{codSms.error}</div> : null}
                <input
                  inputMode="numeric"
                  placeholder="123456"
                  autoFocus
                  value={codSms.code}
                  onChange={(event) =>
                    setCodSms((current) => ({
                      ...current,
                      code: event.target.value.replace(/\D/g, "").slice(0, 6),
                    }))
                  }
                />
                <button
                  type="button"
                  className="cart-page-checkout-cta"
                  onClick={() => void verifyCodSms()}
                  disabled={codSms.code.length !== 6 || codSms.status === "verifying"}
                >
                  {codSms.status === "verifying" ? "Sprawdzamy…" : "Potwierdź kod"}
                </button>
                <button type="button" className="cart-cod-resend" onClick={() => void sendCodSms()} disabled={codResendIn > 0}>
                  {codResendIn > 0 ? `Nowy kod możesz wysłać za ${codResendIn} s` : "Wyślij nowy kod"}
                </button>
              </>
            )}
          </div>
        </div>
      ) : null}

      {legalModalOpen ? (
        <div className="legal-modal-overlay" role="dialog" aria-modal="true" aria-label="Regulamin">
          <div className="legal-modal-shell">
            {/* Sticky so it stays reachable no matter how far the (often
                long) regulamin text below has been scrolled. */}
            <div className="legal-modal-topbar">
              <button
                type="button"
                className="legal-modal-close"
                aria-label="Zamknij"
                onClick={() => setLegalModalOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="legal-modal-inner">
              {legalLoading ? (
                <div className="cart-payment-waiting">
                  <span className="cart-invoice-nip-spinner" aria-hidden="true" />
                  Wczytujemy regulamin…
                </div>
              ) : legalError ? (
                <div className="cart-checkout-error">{legalError}</div>
              ) : legalContent ? (
                <>
                  <h3>{legalContent.title}</h3>
                  <div className="legal-modal-body" dangerouslySetInnerHTML={{ __html: legalContent.bodyHtml }} />
                </>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {cartShareModalOpen ? (
        <div className="save-share-modal-overlay" role="presentation" onClick={() => setCartShareModalOpen(false)}>
          <div
            className="save-share-modal-shell"
            role="dialog"
            aria-modal="true"
            aria-label="Zapisz lub udostępnij koszyk"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="save-share-modal-close"
              onClick={() => setCartShareModalOpen(false)}
              aria-label="Zamknij"
            >
              ✕
            </button>
            <h3>Zapisz lub udostępnij</h3>
            <p className="save-share-modal-lead">
              Zapisujemy Twój koszyk razem z aktywnymi rabatami i dopłatami - wróć do niego w każdej chwili, na
              dowolnym urządzeniu, bez wypełniania niczego od nowa.
            </p>

            {cartShareSaving && !cartShareLink ? (
              <div className="save-share-modal-loading">Zapisuję…</div>
            ) : (
              <>
                <div className="save-share-modal-options">
                  {canNativeShareCart ? (
                    <button type="button" className="save-share-option is-primary" onClick={handleCartShareNativeShare}>
                      <span aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none">
                          <path
                            d="M14 3h7v7M21 3 10 14M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h6"
                            stroke="currentColor"
                            strokeWidth="1.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                      Udostępnij
                    </button>
                  ) : null}
                  <button type="button" className="save-share-option" onClick={handleCartShareCopyLink}>
                    <span aria-hidden="true">🔗</span>
                    {cartShareCopyState === "copied" ? "Skopiowano!" : "Kopiuj link"}
                  </button>
                  {cartShareLink?.quoteCode ? (
                    <button type="button" className="save-share-option" onClick={() => setCartShareSendOpen((v) => !v)}>
                      <span aria-hidden="true">✉️</span>
                      Wyślij
                    </button>
                  ) : null}
                </div>
                {cartShareLink?.quoteCode && cartShareSendOpen ? (
                  <form className="save-share-send-form" onSubmit={handleCartShareSendSubmit}>
                    <input
                      type="text"
                      inputMode="email"
                      placeholder="E-mail albo numer telefonu"
                      value={cartShareSendValue}
                      onChange={(event) => {
                        setCartShareSendValue(event.target.value);
                        if (cartShareSendStatus !== "sending") setCartShareSendStatus("idle");
                      }}
                      autoFocus
                    />
                    <button type="submit" disabled={cartShareSendStatus === "sending" || !cartShareSendValue.trim()}>
                      {cartShareSendStatus === "sending" ? "Wysyłam…" : "Wyślij"}
                    </button>
                    {cartShareSendStatus === "sent" ? <p className="save-share-send-status is-ok">Wysłano!</p> : null}
                    {cartShareSendStatus === "error" ? (
                      <p className="save-share-send-status is-error">Nie udało się wysłać. Spróbuj ponownie.</p>
                    ) : null}
                  </form>
                ) : null}
                {cartShareLink ? (
                  <div className="save-share-modal-linkbox">
                    <code>{cartShareLink.url}</code>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      ) : null}

      {editingItem ? (
        <div className="edit-item-modal-overlay" role="dialog" aria-modal="true" aria-label="Edytuj pozycję">
          <div className="hero-product-config-panel is-visible edit-item-modal-panel">
            <button
              type="button"
              className="edit-item-modal-close"
              aria-label="Zamknij"
              onClick={() => setEditingItemId(null)}
            >
              ×
            </button>
            {editingItem.productSlug === "rolety-dachowe" ? (
              <RoletyDachoweConfiguratorPanel
                key={editingItem.id}
                initialValues={{
                  // Options come off the live CRM profile inside the panel -
                  // labels are resolved there (features/rolety-dachowe/shared.ts).
                  hardwareLabel: editingItem.hardwareLabel,
                  fabricLabel: editingItem.meshLabel,
                  windowLibraryId: editingItem.windowLibraryId,
                  windowQuery: editingItem.windowLibraryId ? undefined : editingItem.modelLabel,
                  widthMm: editingItem.widthMm,
                  heightMm: editingItem.heightMm,
                  qty: editingItem.qty,
                  bracketCount: editingItem.bracketCount,
                  missingModelRequest: editingItem.missingModelRequest || null,
                }}
                submitLabel="Zapisz zmiany"
                onSubmit={(result) => {
                  const updated = updateCartItemConfig(editingItem.id, {
                    hardwareLabel: result.hardwareLabel,
                    meshLabel: result.fabricLabel,
                    modelLabel: result.windowProducer ? `${result.windowProducer} ${result.windowModel}` : result.windowModel,
                    widthMm: result.widthMm,
                    heightMm: result.heightMm,
                    qty: result.qty,
                    price: result.unitPrice,
                    total: result.totalPrice,
                    imageUrl: result.hardwareImageUrl,
                    fabricColor: result.fabricColor || undefined,
                    hardwareColor: result.hardwareColor || undefined,
                    windowLibraryId: result.windowLibraryId || undefined,
                    windowCertain: result.windowCertain,
                    bracketCount: result.bracketCount,
                    nameplateAttachmentId: result.nameplateAttachmentId || undefined,
                    missingModelRequest: result.missingModelRequest || undefined,
                  });
                  setItems(updated);
                  setEditingItemId(null);
                }}
              />
            ) : editingItem.productSlug === "plisy-dachowe" ? (
              <PlisyDachoweConfiguratorPanel
                key={editingItem.id}
                initialValues={{
                  // Hardware is static (features/plisy-dachowe/shared.ts), the
                  // fabric collection/colour come off the live plisy profile
                  // inside the panel - labels resolved there. meshLabel is
                  // "<kolekcja> — <kolor>" like plisy.
                  hardwareLabel: editingItem.hardwareLabel,
                  fabricGroupLabel: editingItem.meshLabel.split(" — ")[0],
                  fabricLabel: editingItem.meshLabel.split(" — ")[1],
                  windowLibraryId: editingItem.windowLibraryId,
                  windowQuery: editingItem.windowLibraryId ? undefined : editingItem.modelLabel,
                  widthMm: editingItem.widthMm,
                  heightMm: editingItem.heightMm,
                  qty: editingItem.qty,
                  missingModelRequest: editingItem.missingModelRequest || null,
                }}
                submitLabel="Zapisz zmiany"
                onSubmit={(result) => {
                  const updated = updateCartItemConfig(editingItem.id, {
                    hardwareLabel: result.hardwareLabel,
                    meshLabel: `${result.fabricGroupLabel} — ${result.fabricLabel}`,
                    modelLabel: result.windowProducer ? `${result.windowProducer} ${result.windowModel}` : result.windowModel,
                    widthMm: result.widthMm,
                    heightMm: result.heightMm,
                    qty: result.qty,
                    price: result.unitPrice,
                    total: result.totalPrice,
                    imageUrl: result.hardwareImageUrl,
                    fabricColor: result.fabricColor || undefined,
                    hardwareColor: result.hardwareColor || undefined,
                    oversizeSurchargeAmount: result.oversizeSurchargeAmount || undefined,
                    windowLibraryId: result.windowLibraryId || undefined,
                    windowCertain: result.windowCertain,
                    nameplateAttachmentId: result.nameplateAttachmentId || undefined,
                    missingModelRequest: result.missingModelRequest || undefined,
                  });
                  setItems(updated);
                  setEditingItemId(null);
                }}
              />
            ) : editingItem.productSlug === "plisy" ? (
              <PlisyConfiguratorPanel
                key={editingItem.id}
                initialValues={{
                  // Plisy's option data is fetched live from the CRM inside
                  // the panel itself (see features/plisy/shared.ts), not a
                  // static local constant like the other two products above
                  // - so there's no label->id lookup table available here.
                  // The *Label fields below are ConfiguratorPanel's own
                  // fallback: it resolves them against the live profile once
                  // it loads (see its label-resolution effects), collapsing
                  // each step it manages to match - meshLabel is stored as
                  // "<fabricGroupLabel> — <fabricLabel>" (see app/page.tsx's
                  // addCartItem calls), split back apart here.
                  mountLabel: editingItem.mountLabel,
                  hardwareLabel: editingItem.hardwareLabel,
                  fabricGroupLabel: editingItem.meshLabel.split(" — ")[0],
                  fabricLabel: editingItem.meshLabel.split(" — ")[1],
                  widthMm: editingItem.splitFromWidthMm || editingItem.widthMm,
                  heightMm: editingItem.heightMm,
                  qty: editingItem.splitFromWidthMm ? Math.max(1, Math.round(editingItem.qty / 2)) : editingItem.qty,
                }}
                submitLabel="Zapisz zmiany"
                onSubmit={(result) => {
                  const updated = updateCartItemConfig(editingItem.id, {
                    hardwareLabel: result.hardwareLabel,
                    meshLabel: `${result.fabricGroupLabel} — ${result.fabricLabel}`,
                    mountLabel: result.mountLabel || undefined,
                    splitFromWidthMm: result.splitFromWidthMm || undefined,
                    sagNoticeShown: result.sagNoticeShown || undefined,
                    sagLimitMm: result.sagNoticeShown ? result.sagLimitMm : undefined,
                    fabricColor: result.fabricColor || undefined,
                    hardwareColor: result.hardwareColor || undefined,
                    widthMm: result.widthMm,
                    heightMm: result.heightMm,
                    qty: result.qty,
                    price: result.unitPrice,
                    total: result.totalPrice,
                    oversizeSurchargeAmount: result.oversizeSurchargeAmount || undefined,
                  });
                  setItems(updated);
                  setEditingItemId(null);
                }}
              />
            ) : (
              <ConfiguratorPanel
                key={editingItem.id}
                initialValues={{
                  hardwareId: ALLEGRO_MOSKITIERY_HARDWARE.find((option) => option.label === editingItem.hardwareLabel)?.id,
                  meshId: MESH_OPTIONS.find((option) => option.label === editingItem.meshLabel)?.id,
                  widthMm: editingItem.widthMm,
                  heightMm: editingItem.heightMm,
                  qty: editingItem.qty,
                }}
                submitLabel="Zapisz zmiany"
                onSubmit={(result) => {
                  const updated = updateCartItemConfig(editingItem.id, {
                    hardwareLabel: result.hardwareLabel,
                    meshLabel: result.meshLabel,
                    widthMm: result.widthMm,
                    heightMm: result.heightMm,
                    qty: result.qty,
                    price: result.unitPrice,
                    total: result.totalPrice,
                    imageUrl: result.hardwareImageUrl,
                    oversizeSurchargeAmount: result.oversizeSurchargeAmount,
                  });
                  setItems(updated);
                  setEditingItemId(null);
                }}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
