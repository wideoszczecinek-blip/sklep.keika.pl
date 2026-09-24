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
import PlisaPreview from "@/features/plisy/PlisaPreview";
import { readLastPage } from "../components/last-page-tracker";
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
import { getRescueGrant, type RescueGrant } from "@/lib/rescue";
import { saveQuoteForSharing, sendShareLink, type ShareLink } from "@/lib/share";

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
  /** Przelewy24: adres strony płatności, na którą przekierowujemy klienta. */
  redirect_url?: string;
  error?: string;
};

type CodSmsStartResponse = {
  ok: boolean;
  verification_token?: string;
  error?: string;
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
  description: "Płacisz kurierowi gotówką lub kartą przy odbiorze",
};

function getAvailableDeliveryMethods(items: CartLineItem[], subtotal: number): DeliveryMethod[] {
  const fitsPaczkomat = items.length > 0 && items.every(itemFitsPaczkomat);
  const shippingFee = subtotal >= FREE_SHIPPING_THRESHOLD ? undefined : SHIPPING_FEE_AMOUNT;
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
function CartFieldStatus({ valid, children }: { valid: boolean; children: React.ReactNode }) {
  return (
    <div className={`cart-field ${valid ? "is-valid" : "is-pending"}`}>
      <span className="cart-field-input-wrap">
        {children}
        {valid ? (
          <span className="cart-field-check" aria-hidden="true">
            ✓
          </span>
        ) : null}
      </span>
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
    ? Math.max(0, (itemsSubtotal - combinedSavings) * (rescueGrant.percent / 100))
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
  // Where the customer actually was right before opening the cart (product +
  // step + query string) - "/" until we know better, filled in on mount.
  const [backHref, setBackHref] = useState("/");
  const [deliveryMethod, setDeliveryMethod] = useState(COURIER_METHOD.id);
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
  useEffect(() => {
    if (!expressEligible && expressSelected) {
      setExpressSelected(false);
      setExpressSelectedState(false);
    }
  }, [expressEligible, expressSelected]);
  const expressFee = expressEligible && expressSelected ? EXPRESS_FEE_AMOUNT : 0;
  const [selectedPaczkomat, setSelectedPaczkomat] = useState<PaczkomatPoint | null>(null);
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
  const [nipLookupLoading, setNipLookupLoading] = useState(false);
  const [nipLookupError, setNipLookupError] = useState("");
  const lastLookedUpNip = useRef("");

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

  // "Edytuj pozycję" - the same <ConfiguratorPanel> the product page uses,
  // seeded with this item's current config. moskitiery-ramkowe and plisy
  // items get the button (see item.productSlug check below); rolety-dachowe
  // has a ready modal branch too but isn't exposed yet.
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Required consent checkbox - gates every "Zamawiam" CTA regardless of
  // payment method. Single link/document: "Regulamin sklepu i płatności"
  // (shop terms and payment terms live together, not as two documents).
  const [termsAccepted, setTermsAccepted] = useState(false);
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
      cart_positions: items.length,
      products: Array.from(new Set(items.map((item) => item.productSlug))).join(","),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated]);
  function handleCheckoutFieldBlur(event: FocusEvent<HTMLDivElement>) {
    const target = event.target as HTMLElement | null;
    if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLTextAreaElement)) return;
    if (target instanceof HTMLInputElement && (target.type === "radio" || target.type === "checkbox")) return;
    if (target.value.trim() === "") return;
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
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  // Rescue discount (exit-intent modal on the homepage, see lib/rescue.ts) -
  // read once on mount; stacks additively alongside appliedDiscount above,
  // never replaces it (business decision: during SEZON20, a rescued
  // customer gets -25% total, not just -20% or just -5%).
  const [rescueGrant, setRescueGrantState] = useState<RescueGrant | null>(null);
  useEffect(() => {
    setRescueGrantState(getRescueGrant());
  }, []);
  const combinedDiscountPercent =
    (appliedDiscount?.type === "percent" ? appliedDiscount.value : 0) + (rescueGrant?.percent || 0);
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
  const [onlinePaymentKind, setOnlinePaymentKind] = useState<PaymentKind>("blik");
  // Siatka banków dla "Przelew online" (Przelewy24) - lista z CRM
  // (shop-public/p24_banks, logotypy z CDN P24), pobierana raz.
  const [p24Banks, setP24Banks] = useState<P24Bank[]>([]);
  const [p24BankId, setP24BankId] = useState<number>(0);
  const [p24Settings, setP24Settings] = useState<P24Settings>({ enabled: true, transfer: true, installments: false, paypo: false });
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
  const rescueAmount = rescueGrant
    ? Math.max(0, (summary.total - combinedSavings) * (rescueGrant.percent / 100))
    : 0;
  const orderSurcharge = calcCartOversizeSurcharge(items);
  const availableDeliveryMethods = getAvailableDeliveryMethods(items, summary.total);
  // Odbiór osobisty nigdy nie ma kosztu wysyłki - nic nie jest wysyłane.
  const shippingFee =
    deliveryMethod === PICKUP_METHOD.id || summary.total >= FREE_SHIPPING_THRESHOLD ? 0 : SHIPPING_FEE_AMOUNT;
  const amountToFreeShipping = Math.max(0, FREE_SHIPPING_THRESHOLD - summary.total);

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

  // Payment method is no longer a separate choice - cash-on-delivery is one
  // of the delivery methods on the left, so it's derived straight from that.
  const p24KindAvailable = (kind: P24Kind) =>
    p24Settings.enabled &&
    ((kind === "p24_transfer" && p24Settings.transfer) ||
      (kind === "p24_installments" && p24Settings.installments) ||
      (kind === "p24_paypo" && p24Settings.paypo));
  const paymentMethod: "online" | "cod" | "transfer" | "p24" =
    deliveryMethod === COD_DELIVERY_METHOD_ID
      ? "cod"
      : onlinePaymentKind === "transfer" && transferSettings.enabled
        ? "transfer"
        : onlinePaymentKind.startsWith("p24_") && p24KindAvailable(onlinePaymentKind as P24Kind)
          ? "p24"
          : "online";
  const p24Kind: P24Kind = onlinePaymentKind.startsWith("p24_") ? (onlinePaymentKind as P24Kind) : "p24_transfer";
  const stripeMethod: StripeMethod =
    onlinePaymentKind === "card" || onlinePaymentKind === "wallets" ? onlinePaymentKind : "blik";

  const editingItem = editingItemId ? items.find((item) => item.id === editingItemId) || null : null;

  const requiresAddress = deliveryMethod !== "odbior-osobisty";
  // E-mail is mandatory (not just "phone or e-mail" any more) - it's what
  // gets pre-filled into the Stripe payment form and used for the receipt.
  const emailValid = /\S+@\S+\.\S+/.test(form.email.trim());
  const contactReady =
    form.firstName.trim() !== "" && form.lastName.trim() !== "" && form.phone.trim() !== "" && emailValid;
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
  const phoneFieldValid = form.phone.trim() !== "";
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
  const address1FieldValid = form.address1.trim().length >= 5 && /\d/.test(form.address1);
  const nipFieldValid = invoice.nip.trim().length === 10;
  const companyNameFieldValid = invoice.companyName.trim() !== "";
  const invoiceStreetFieldValid = invoice.street.trim() !== "";
  const invoicePostcodeFieldValid = /^\d{2}-?\d{3}$/.test(invoice.postcode.trim());
  const invoiceCityFieldValid = invoice.city.trim() !== "";
  const addressReady =
    !requiresAddress || (cityFieldValid && address1FieldValid && postcodeFieldValid && !address1Focused);
  const paczkomatReady = deliveryMethod !== PACZKOMAT_METHOD.id || selectedPaczkomat !== null;
  const invoiceReady =
    !wantsInvoice ||
    (nipFieldValid && companyNameFieldValid && invoiceStreetFieldValid && invoicePostcodeFieldValid && invoiceCityFieldValid);
  // The payment section itself is always rendered (see JSX below) - this
  // just controls whether it's locked/greyed out or interactive.
  const deliveryDataReady = contactReady && addressReady && paczkomatReady && invoiceReady && items.length > 0;
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
    const snapshot = JSON.stringify({ items, deliveryMethod, appliedDiscount, expressSelected });
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
  }, [items, deliveryMethod, appliedDiscount, expressSelected, paymentConfirmed]);

  async function sendCodSms() {
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
          phone: form.phone,
          name: form.firstName,
          amount: codTotal.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        }),
      });
      const json = (await response.json()) as CodSmsStartResponse;
      if (!json.ok || !json.verification_token) {
        throw new Error(json.error || "Nie udało się wysłać kodu SMS.");
      }
      setCodSms({ status: "sent", token: json.verification_token, code: "", error: "" });
      trackCheckoutIssue("checkout_cod_sms_sent", "cod");
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

  const submitOrder = useCallback(async (opts?: { stripeMethod?: StripeMethod; p24MethodId?: number }): Promise<CreatedIntent | null> => {
    if (submittedRef.current) return null;
    submittedRef.current = true;
    draftSnapshotRef.current = JSON.stringify({ items, deliveryMethod, appliedDiscount, expressSelected });
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
      };
      const quoteResponse = await saveShopQuote(quotePayload);
      const quoteCode = quoteResponse.quote.quote_code;
      lastQuoteCodeRef.current = quoteCode;

      const deliveryLabel =
        [COURIER_METHOD, PACZKOMAT_METHOD, COD_DELIVERY_METHOD, PICKUP_METHOD].find(
          (method) => method.id === deliveryMethod,
        )?.label || "";
      const paczkomatLine =
        deliveryMethod === PACZKOMAT_METHOD.id && selectedPaczkomat
          ? `Paczkomat: ${selectedPaczkomat.id} - ${selectedPaczkomat.address}`
          : "";
      const paymentLabel =
        paymentMethod === "cod"
          ? "Za pobraniem"
          : paymentMethod === "transfer"
            ? "Przelew tradycyjny"
            : paymentMethod === "p24"
              ? P24_KIND_LABELS[p24Kind].note
              : "Online (Stripe)";
      const noteWithDelivery = [
        // First line on purpose - production reads the note top-down.
        expressEligible && expressSelected ? EXPRESS_NOTE_LINE : "",
        `Metoda dostawy: ${deliveryLabel}`,
        paczkomatLine,
        `Metoda płatności: ${paymentLabel}`,
        form.note.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");

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
          customer: { name: `${form.firstName} ${form.lastName}`.trim(), phone: form.phone, email: form.email },
          shipping: {
            city: form.city,
            postcode: form.postcode,
            address_line_1: form.address1,
            ...(deliveryMethod === PACZKOMAT_METHOD.id && selectedPaczkomat
              ? {
                  paczkomat_id: selectedPaczkomat.id,
                  paczkomat_address: selectedPaczkomat.address,
                }
              : {}),
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
          payment_provider:
            paymentMethod === "cod" ? "cod" : paymentMethod === "transfer" ? "transfer" : paymentMethod === "p24" ? "p24" : "stripe",
          payment_method:
            paymentMethod === "cod" ? "cod" : paymentMethod === "transfer" ? "transfer" : paymentMethod === "p24" ? p24Kind : "",
          tracking,
          ...(paymentMethod === "cod" ? { cod_sms_verification_token: codSms.token } : {}),
          ...(paymentMethod === "online" ? { stripe_method: opts?.stripeMethod || stripeMethod } : {}),
          ...(paymentMethod === "p24" && opts?.p24MethodId ? { p24_method_id: opts.p24MethodId } : {}),
          ...(paymentMethod === "p24" ? { p24_regulation_accepted: termsAccepted } : {}),
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

      setOrderState({
        orderCode: json.order.order_code,
        amountTotal: json.order.amount_total,
        clientSecret: json.client_secret,
        publishableKey: json.publishable_key,
        paymentEnabled: Boolean(json.payment_enabled && json.client_secret && json.publishable_key),
        paymentProvider:
          json.payment_provider ||
          (paymentMethod === "cod" ? "cod" : paymentMethod === "transfer" ? "transfer" : paymentMethod === "p24" ? "p24" : "stripe"),
        accessToken: json.order.access_token,
        transfer: json.order.transfer || null,
        stripeMethod: opts?.stripeMethod || stripeMethod,
      });
      // Cash-on-delivery has no further payment step - the order is real the
      // moment it's created. Online payment isn't real yet at this point;
      // the cart only clears once StripePaymentStep reports success (or a
      // payment_enabled:false fallback, handled below).
      if (
        paymentMethod === "cod" ||
        paymentMethod === "transfer" ||
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
      trackCheckoutIssue("checkout_error", "order_submit_failed", { message, payment_method: paymentMethod });
      throw submitError instanceof Error ? submitError : new Error(message);
    } finally {
      setIsSubmitting(false);
    }
  }, [
    items,
    deliveryMethod,
    selectedPaczkomat,
    form,
    wantsInvoice,
    invoice,
    paymentMethod,
    p24Kind,
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
  const paymentTiles: { kind: PaymentKind; title: string; hint: string; logo: React.ReactNode; wide?: boolean }[] = [
    ...(stripeAvailable
      ? [
          {
            kind: "blik" as PaymentKind,
            title: "BLIK",
            hint: "Wpisz 6-cyfrowy kod BLIK",
            logo: <span className="cart-pay-logo cart-pay-logo--blik">blik</span>,
          },
        ]
      : []),
    ...(p24KindAvailable("p24_transfer")
      ? [
          {
            kind: "p24_transfer" as PaymentKind,
            title: "Przelew online",
            hint: "Wybierz swój bank",
            logo: (
              <span className="cart-pay-logo cart-pay-logo--p24">
                Przelewy<em>24</em>
              </span>
            ),
          },
        ]
      : []),
    ...(stripeAvailable
      ? [
          {
            kind: "card" as PaymentKind,
            title: "Karta płatnicza",
            hint: "Visa, Mastercard",
            logo: (
              <span className="cart-pay-logo cart-pay-logo--card">
                <span className="cart-pay-visa">VISA</span>
                <span className="cart-pay-mc" aria-hidden="true">
                  <i />
                  <i />
                </span>
              </span>
            ),
          },
        ]
      : []),
    ...(p24KindAvailable("p24_paypo")
      ? [
          {
            kind: "p24_paypo" as PaymentKind,
            title: "PayPo",
            hint: "Kup teraz, zapłać później",
            // Oficjalne logo PayPo (pakiet Przelewy24/PayPo, public/paypo/).
            logo: (
              <span className="cart-pay-logo cart-pay-logo--paypo">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/paypo/paypo-logo.svg" alt="PayPo" width={96} height={28} />
              </span>
            ),
          },
        ]
      : []),
    ...(p24KindAvailable("p24_installments")
      ? [
          {
            kind: "p24_installments" as PaymentKind,
            title: "Raty",
            hint: "Raty Przelewy24 – decyzja online",
            logo: (
              <span className="cart-pay-logo cart-pay-logo--p24">
                Przelewy<em>24</em>
              </span>
            ),
          },
        ]
      : []),
    ...(stripeAvailable
      ? [
          {
            kind: "wallets" as PaymentKind,
            title: "Google Pay / Apple Pay",
            hint: "Jednym dotknięciem – kartą zapisaną w telefonie",
            wide: true,
            logo: (
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
            ),
          },
        ]
      : []),
    ...(transferSettings.enabled
      ? [
          {
            kind: "transfer" as PaymentKind,
            title: "Przelew tradycyjny",
            hint: "Dane do przelewu po złożeniu zamówienia; realizacja po zaksięgowaniu",
            wide: true,
            logo: (
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
            ),
          },
        ]
      : []),
  ];
  // Opcje wybranej metody renderują się pod JEJ kafelkiem - klient widzi pole
  // BLIK-a dokładnie tam, gdzie kliknął, a nie na końcu listy metod.
  const renderMethodPanel = (kind: PaymentKind) => {
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
          {termsCheckbox}
          {error ? <div className="cart-checkout-error">{error}</div> : null}
          <StripeMethodStep
            key={stripeMethod}
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
          {termsCheckbox}
          {error ? <div className="cart-checkout-error">{error}</div> : null}
          {payBlockedReason ? <p className="cart-checkout-intro">{payBlockedReason}</p> : null}
          <button
            type="button"
            className="cart-page-checkout-cta"
            onClick={() => {
              setError("");
              submittedRef.current = false;
              void submitOrder({ p24MethodId: thisKind === "p24_transfer" ? p24BankId : 0 }).catch(() => {});
            }}
            disabled={
              !termsAccepted ||
              isSubmitting ||
              Boolean(payBlockedReason) ||
              (thisKind === "p24_transfer" && p24Banks.length > 0 && !p24BankId)
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
                : thisKind === "p24_paypo"
                  ? "Zamawiam z PayPo – zapłacę później"
                  : "Zamawiam i płacę w ratach"}
          </button>
          <p className="cart-checkout-cta-hint">
            {thisKind === "p24_transfer"
              ? "Przeniesiemy Cię bezpośrednio na stronę logowania wybranego banku (Przelewy24). Po zatwierdzeniu przelewu wrócisz do sklepu z potwierdzeniem."
              : thisKind === "p24_paypo"
                ? "Przeniesiemy Cię do PayPo. Zamówienie przyjmujemy do realizacji po pozytywnej weryfikacji przez PayPo – za zakupy zapłacisz PayPo później (do 30 dni lub w ratach), bez dodatkowych opłat z naszej strony."
                : `Przeniesiemy Cię na bezpieczną stronę Przelewy24 (${P24_KIND_LABELS[thisKind].title.toLowerCase()}). Po zaksięgowaniu wpłaty wrócisz do sklepu z potwierdzeniem.`}
          </p>
        </>
      );
    }

    // przelew tradycyjny
    return (
      <>
        {termsCheckbox}
        {error ? <div className="cart-checkout-error">{error}</div> : null}
        {payBlockedReason ? <p className="cart-checkout-intro">{payBlockedReason}</p> : null}
        <button
          type="button"
          className="cart-page-checkout-cta"
          onClick={() => {
            setError("");
            submittedRef.current = false;
            void submitOrder().catch(() => {});
          }}
          disabled={!termsAccepted || isSubmitting || Boolean(payBlockedReason)}
        >
          {isSubmitting ? "Zapisujemy zamówienie…" : "Zamawiam i płacę przelewem"}
        </button>
        <p className="cart-checkout-cta-hint">
          Po kliknięciu pokażemy dane do przelewu z unikatowym tytułem i wyślemy je na Twój e-mail. Zamówienie ruszy do
          realizacji po zaksięgowaniu wpłaty – zwykle do 2 dni roboczych.
        </p>
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
  const checkoutContact: CheckoutContact = {
    name: `${form.firstName} ${form.lastName}`.trim(),
    phone: form.phone,
    email: form.email,
    city: form.city,
    postcode: form.postcode,
    address1: form.address1,
  };
  const termsCheckbox =
    !paymentConfirmed && items.length > 0 ? (
      <label className="cart-terms-checkbox">
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
          Przeczytałem i akceptuję{" "}
          <button type="button" className="cart-terms-link" onClick={() => setLegalModalOpen(true)}>
            regulamin sklepu i płatności
          </button>
          {paymentMethod === "p24" ? (
            <>
              {" "}
              oraz{" "}
              <a className="cart-terms-link" href="https://www.przelewy24.pl/regulamin" target="_blank" rel="noopener noreferrer">
                regulamin Przelewy24
              </a>{" "}
              (PayPro S.A.)
            </>
          ) : null}
          .
        </span>
      </label>
    ) : null;
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

  return (
    <div className="cart-page">
      <div className="cart-page-gradient-bg" aria-hidden="true" />
      <PromoTopStrip productSlug={cartPromoSlug} variant="static" />
      <header className="cart-page-header">
        <Link href="/" className="cart-page-brand">
          keika
        </Link>
        <h1>Koszyk</h1>
        <Link href={backHref} className="cart-page-back">
          ← Wróć do konfiguratora
        </Link>
      </header>

      <main className="cart-page-main">
        {!hydrated ? null : orderConfirmed && orderState ? (
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
            <Link href="/moskitiery-ramkowe" className="cart-page-empty-cta">
              Skonfiguruj moskitierę
            </Link>
          </div>
        ) : (
          <>
            {items.length > 0 ? (
              <ul className="cart-page-items">
                {items.map((item) => (
                  <li key={item.id} className="cart-page-item">
                    {item.productSlug === "plisy" && item.fabricColor ? (
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
                      <span className="cart-page-item-specs">
                        {[
                          item.mountLabel ? `Rodzaj montażu: ${item.mountLabel}` : "",
                          item.hardwareLabel ? `${cartItemFieldLabels(item.productSlug).hardware}: ${item.hardwareLabel}` : "",
                          item.meshLabel ? `${cartItemFieldLabels(item.productSlug).mesh}: ${item.meshLabel}` : "",
                          item.modelLabel ? `Model okna: ${item.modelLabel}` : "",
                          item.widthMm && item.heightMm ? `${item.widthMm} × ${item.heightMm} mm` : "",
                          item.productSlug === "rolety-dachowe" && item.bracketCount === 2 ? "2 uchwyty" : "",
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
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
            ) : (
              <p className="cart-page-order-note">Koszyk opróżniony po złożeniu zamówienia poniżej.</p>
            )}

            {items.length > 0 ? (
              <button type="button" className="cart-save-share-banner" onClick={openCartShareModal}>
                <span className="cart-save-share-banner-icon" aria-hidden="true">
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
                <span className="cart-save-share-banner-copy">
                  <strong>Zapisz / udostępnij link do wyceny z rabatami na później</strong>
                  <small>Nic nie tracisz - wrócisz do tego koszyka w każdej chwili, na dowolnym urządzeniu.</small>
                </span>
              </button>
            ) : null}

            <div className="cart-checkout-layout">
              <div className="cart-checkout-left" onBlurCapture={handleCheckoutFieldBlur}>
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
                            {dispatchInfo
                              ? `Wysyłka ${dispatchInfo.standardLabel} - zgodnie z planem produkcji`
                              : "Wysyłka zgodnie z planem produkcji (zwykle 3 dni robocze)"}
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
                            Wysyłka {dispatchInfo ? dispatchInfo.expressLabel : "tego samego dnia roboczego"} (zamówienie do{" "}
                            {dispatchInfo?.cutoffLabel || "12:00"} w dzień roboczy = wysyłka tego samego dnia)
                          </small>
                        </span>
                        <span className="cart-delivery-option-price">+{formatPln(EXPRESS_FEE_AMOUNT)}</span>
                      </label>
                    </div>
                  </section>
                ) : null}

                <section className="cart-delivery-card">
                  <h2>Metody dostawy</h2>
                  <div className="cart-delivery-options">
                    {availableDeliveryMethods.map((method) => {
                      const isPaczkomat = method.id === PACZKOMAT_METHOD.id;
                      const isActive = deliveryMethod === method.id;
                      return (
                        <div key={method.id} className="cart-delivery-option-group">
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
                          {isPaczkomat ? (
                            <div className={`cart-paczkomat-accordion ${isActive ? "is-open" : ""}`}>
                              <div className="cart-paczkomat-accordion-inner">
                                {isActive ? (
                                  <PaczkomatPicker
                                    value={selectedPaczkomat}
                                    onChange={(point) => {
                                      setSelectedPaczkomat(point);
                                      if (point) trackCheckoutIssue("checkout_paczkomat", point.id, { address: point.address });
                                    }}
                                  />
                                ) : null}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>

                {/* Moved here (was inside "Adres wysyłki" below) - real
                    feedback 2026-09-07: showing it right under the delivery
                    method, before the address fields, matches how customers
                    actually decide ("chcę fakturę" is a yes/no up front, not
                    something they think about mid-address-form) and gives
                    the NIP auto-fill (see lookupNip()) a completion moment
                    of its own to trigger the address-section auto-scroll
                    below. */}
                <section className="cart-checkout-form-card cart-invoice-card">
                  <fieldset className="cart-checkout-form" disabled={dataLocked}>
                    <label className="cart-invoice-checkbox">
                      <input
                        type="checkbox"
                        checked={wantsInvoice}
                        onChange={(event) => {
                          setWantsInvoice(event.target.checked);
                          trackCheckoutIssue("checkout_invoice", event.target.checked ? "on" : "off");
                        }}
                      />
                      Chcę otrzymać fakturę
                    </label>

                    {wantsInvoice ? (
                      <div className="cart-invoice-fields">
                        <label className="cart-invoice-nip-field">
                          NIP
                          <div className="cart-invoice-nip-row">
                            {/* Checkmark deliberately suppressed while the spinner is
                                showing - both render at the same corner spot. */}
                            <CartFieldStatus valid={nipFieldValid && !nipLookupLoading}>
                              <input
                                inputMode="numeric"
                                placeholder="np. 1234567890"
                                value={invoice.nip}
                                onChange={(event) => {
                                  const digits = event.target.value.replace(/\D/g, "").slice(0, 10);
                                  setInvoice((current) => ({ ...current, nip: digits }));
                                  setNipLookupError("");
                                  // Fetch the moment the 10th digit lands - no need to
                                  // leave the field first (onBlur below still covers a
                                  // pasted value where the field never gains focus).
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
                          {!nipLookupError && !nipLookupLoading ? (
                            <small className="cart-invoice-nip-hint">
                              Dane firmy uzupełnią się automatycznie po wpisaniu NIP (Biała lista VAT, MF).
                            </small>
                          ) : null}
                        </label>
                        <div className="cart-checkout-form-grid">
                          <label>
                            Nazwa firmy
                            <CartFieldStatus valid={companyNameFieldValid}>
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
                            <CartFieldStatus valid={invoiceStreetFieldValid}>
                              <input
                                value={invoice.street}
                                onChange={(event) => setInvoice((current) => ({ ...current, street: event.target.value }))}
                              />
                            </CartFieldStatus>
                          </label>
                          <label>
                            Kod pocztowy
                            <CartFieldStatus valid={invoicePostcodeFieldValid}>
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
                            <CartFieldStatus valid={invoiceCityFieldValid}>
                              <input
                                value={invoice.city}
                                onChange={(event) => setInvoice((current) => ({ ...current, city: event.target.value }))}
                              />
                            </CartFieldStatus>
                          </label>
                        </div>
                      </div>
                    ) : null}

                    <div className="cart-section-next-wrap">
                      <button
                        type="button"
                        className="cart-section-next-button"
                        disabled={!invoiceReady}
                        onClick={() => {
                          trackCheckoutIssue("checkout_next", "adres");
                          scrollToSection(shippingAddressSectionRef);
                        }}
                        aria-label="Dalej"
                        title="Dalej"
                      >
                        Dalej <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </fieldset>
                </section>

                <section className="cart-checkout-form-card" ref={shippingAddressSectionRef}>
                  <h2>Adres wysyłki</h2>
                  <fieldset className="cart-checkout-form" disabled={dataLocked}>
                    {/* Order + autocomplete (audit 2026-09-13): contact first
                        (the phone's keyboard/autofill can fill e-mail and
                        number in one tap), then name, then street -> post
                        code -> city, which is the order browser autofill
                        profiles are stored in. autoComplete tokens let the
                        whole block fill from one saved address. */}
                    <div className="cart-checkout-form-grid">
                      <label>
                        E-mail
                        <CartFieldStatus valid={emailValid}>
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
                        Telefon
                        <CartFieldStatus valid={phoneFieldValid}>
                          <input
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            value={form.phone}
                            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                            required
                          />
                        </CartFieldStatus>
                      </label>
                      <label>
                        Imię
                        <CartFieldStatus valid={firstNameFieldValid}>
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
                        <CartFieldStatus valid={lastNameFieldValid}>
                          <input
                            autoComplete="family-name"
                            value={form.lastName}
                            onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                            required
                          />
                        </CartFieldStatus>
                      </label>
                      {requiresAddress ? (
                        <>
                          <label>
                            Ulica i numer
                            <CartFieldStatus valid={address1FieldValid}>
                              <input
                                autoComplete="street-address"
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
                            <CartFieldStatus valid={postcodeFieldValid}>
                              <input
                                autoComplete="postal-code"
                                inputMode="numeric"
                                placeholder="00-000"
                                value={form.postcode}
                                onChange={(event) =>
                                  setForm((current) => ({ ...current, postcode: event.target.value }))
                                }
                              />
                            </CartFieldStatus>
                          </label>
                          <label>
                            Miasto
                            <CartFieldStatus valid={cityFieldValid}>
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

                    <label className="cart-checkout-note-field">
                      Dodatkowe informacje
                      <textarea
                        value={form.note}
                        onChange={(event) => setForm((current) => ({ ...current, note: event.target.value }))}
                      />
                    </label>

                    <div className="cart-section-next-wrap">
                      <button
                        type="button"
                        className="cart-section-next-button"
                        disabled={!(contactReady && addressReady && paczkomatReady)}
                        onClick={() => scrollToSection(paymentSectionRef)}
                        aria-label="Dalej"
                        title="Dalej"
                      >
                        Dalej <span aria-hidden="true">→</span>
                      </button>
                    </div>
                  </fieldset>
                </section>
              </div>

              <aside className="cart-checkout-right">
                <section className="cart-payment-card" ref={paymentSectionRef}>
                  <h2>Płatność</h2>
                  {items.length > 0 ? (
                    <>
                      <div className="cart-discount-code">
                        <span className="cart-discount-code-label">Kod rabatowy</span>
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
                        ) : (
                          <div className="cart-discount-code-row">
                            <input
                              type="text"
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
                        <div className="cart-page-summary-row is-muted">
                          <span>Rabat za zapisanie wyceny (-{rescueGrant.percent}%)</span>
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
                      <div className="cart-page-summary-row">
                        <span>Razem</span>
                        <strong>
                          {formatPln(payableTotal)}
                        </strong>
                      </div>

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
                    </>
                  ) : null}

                  {items.length > 0 ? (
                    <button type="button" className="cart-save-share-banner cart-save-share-banner--summary" onClick={openCartShareModal}>
                      <span className="cart-save-share-banner-icon" aria-hidden="true">
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
                      <span className="cart-save-share-banner-copy">
                        <strong>Zapisz / udostępnij link do wyceny z rabatami na później</strong>
                        <small>Nic nie tracisz - wrócisz do tego koszyka w każdej chwili, na dowolnym urządzeniu.</small>
                      </span>
                    </button>
                  ) : null}

                  {paymentMethod === "cod" ? (
                    <p className={`cart-payment-method-badge ${deliveryDataReady ? "" : "is-muted"}`}>
                      Płatność za pobraniem
                    </p>
                  ) : (
                    <>
                      <p className="cart-payment-method-badge">Wybierz sposób płatności</p>
                      {renderPaymentKindChooser()}
                    </>
                  )}

                  {paymentMethod === "cod" ? (
                    <>
                      {termsCheckbox}
                      {error ? <div className="cart-checkout-error">{error}</div> : null}
                      {payBlockedReason ? <p className="cart-checkout-intro">{payBlockedReason}</p> : null}
                      <button
                        type="button"
                        className="cart-page-checkout-cta"
                        onClick={() => {
                          setCodModalOpen(true);
                          void sendCodSms();
                        }}
                        disabled={!termsAccepted || Boolean(payBlockedReason)}
                      >
                        Zamawiam
                      </button>
                    </>
                  ) : null}
                </section>
              </aside>
            </div>
          </>
        )}
      </main>

      {/* Mobile-only sticky total + next step (audit 2026-09-13): on a phone
          the summary sat below eight form fields, so the total and the way
          forward were both off-screen for most of the checkout. */}
      {hydrated && items.length > 0 && !orderConfirmed ? (
        <div className="cart-sticky-bar" role="region" aria-label="Podsumowanie zamówienia">
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
              onClick={() => scrollToSection(deliveryDataReady ? paymentSectionRef : shippingAddressSectionRef)}
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
                setCodModalOpen(false);
                setCodSms({ status: "idle", token: "", code: "", error: "" });
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
                <p>
                  Wpisz kod SMS wysłany na numer <strong>{form.phone}</strong>.
                </p>
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
                <button type="button" className="cart-cod-resend" onClick={() => void sendCodSms()}>
                  Wyślij nowy kod
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
                  widthMm: editingItem.widthMm,
                  heightMm: editingItem.heightMm,
                  qty: editingItem.qty,
                }}
                submitLabel="Zapisz zmiany"
                onSubmit={(result) => {
                  const updated = updateCartItemConfig(editingItem.id, {
                    hardwareLabel: result.hardwareLabel,
                    meshLabel: `${result.fabricGroupLabel} — ${result.fabricLabel}`,
                    mountLabel: result.mountLabel || undefined,
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
