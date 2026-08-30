"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Elements, PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import { saveShopQuote } from "@/features/moskitiery/api";
import {
  type CartLineItem,
  calcCartOversizeSurcharge,
  clearCart,
  formatPln,
  readCartItems,
  removeCartItem,
  summarizeCartItems,
  updateCartItemConfig,
  updateCartItemQty,
} from "@/lib/cart";
import ConfiguratorPanel from "@/features/moskitiery-ramkowe/ConfiguratorPanel";
import { ALLEGRO_MOSKITIERY_HARDWARE, MESH_OPTIONS } from "@/features/moskitiery-ramkowe/shared";
import RoletyDachoweConfiguratorPanel from "@/features/rolety-dachowe/ConfiguratorPanel";
import { ROLETY_DACHOWE_FABRIC, ROLETY_DACHOWE_HARDWARE } from "@/features/rolety-dachowe/shared";
import { readLastPage } from "../components/last-page-tracker";

type OrderCreateResponse = {
  ok: boolean;
  order?: {
    order_code: string;
    amount_total: string | null;
    currency: string;
  };
  payment_enabled?: boolean;
  payment_provider?: string;
  publishable_key?: string;
  client_secret?: string;
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
const PACZKOMAT_MAX_DIMENSION_MM = 640;

// Cash-on-delivery is a flat one-time surcharge on top of the order, not a
// per-item fee - the courier collects it once for the whole parcel. It's a
// delivery method choice (a courier variant), not a separate payment step.
const COD_SURCHARGE_AMOUNT = 25.9;
const COD_DELIVERY_METHOD_ID = "pobranie";

// No real per-carrier shipping cost data exists yet, so every method is
// shown free (except cash-on-delivery's real surcharge), matching the site's
// existing blanket "Darmowa dostawa" promise rather than inventing price tiers.
//
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
  extraFee: COD_SURCHARGE_AMOUNT,
};

function getAvailableDeliveryMethods(items: CartLineItem[]): DeliveryMethod[] {
  const fitsPaczkomat =
    items.length > 0 &&
    items.every((item) => item.widthMm <= PACZKOMAT_MAX_DIMENSION_MM && item.heightMm <= PACZKOMAT_MAX_DIMENSION_MM);
  const courierMethods = fitsPaczkomat ? [COURIER_METHOD, PACZKOMAT_METHOD] : [COURIER_METHOD];
  return [...courierMethods, COD_DELIVERY_METHOD, PICKUP_METHOD];
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
  return { hardware: "Kolor profilu", mesh: "Kolor siatki" };
}

function buildQuotePayloadFromCart(
  items: CartLineItem[],
  extraCharges: ExtraCharge[] = [],
  discount: AppliedDiscount | null = null,
) {
  const positions = items.map((item, index) => {
    const fieldLabels = cartItemFieldLabels(item.productSlug);
    const specs = [
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
        item.hardwareLabel ? { label: fieldLabels.hardware, value: item.hardwareLabel, note: "" } : null,
        item.meshLabel ? { label: fieldLabels.mesh, value: item.meshLabel, note: "" } : null,
        item.modelLabel ? { label: "Model okna", value: item.modelLabel, note: "" } : null,
        item.widthMm && item.heightMm
          ? { label: "Rozmiar", value: `${item.widthMm} × ${item.heightMm} mm`, note: "" }
          : null,
        { label: "Ilość", value: `${item.qty} szt.`, note: "" },
      ].filter(Boolean),
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

  const extraTotal = extraCharges.reduce((sum, extra) => sum + (extra.amount > 0 ? extra.amount : 0), 0);
  const discountTotal = discount && discount.amount > 0 ? discount.amount : 0;
  const totalAmount = items.reduce((sum, item) => sum + item.total, 0) + extraTotal - discountTotal;

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
const STRIPE_APPEARANCE = {
  theme: "night" as const,
  variables: {
    colorPrimary: "#6fe3bf",
    colorBackground: "rgba(240, 248, 255, 0.06)",
    colorText: "#f2f7ff",
    colorTextSecondary: "rgba(240, 248, 255, 0.6)",
    colorTextPlaceholder: "rgba(240, 248, 255, 0.35)",
    colorDanger: "#ff8f7a",
    fontFamily: '"Nunito Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    borderRadius: "10px",
    spacingUnit: "4px",
  },
  rules: {
    ".Label": {
      color: "rgba(240, 248, 255, 0.72)",
      fontSize: "0.82rem",
      fontWeight: "600",
    },
    ".Input": {
      border: "1px solid rgba(229, 241, 255, 0.2)",
      backgroundColor: "rgba(240, 248, 255, 0.06)",
      boxShadow: "none",
    },
    ".Input:focus": {
      border: "1px solid rgba(111, 227, 191, 0.7)",
      boxShadow: "0 0 0 1px rgba(111, 227, 191, 0.35)",
    },
    ".Tab": {
      border: "1px solid rgba(229, 241, 255, 0.18)",
      backgroundColor: "rgba(240, 248, 255, 0.04)",
    },
    ".Tab:hover": {
      border: "1px solid rgba(229, 241, 255, 0.36)",
    },
    ".Tab--selected": {
      border: "1px solid rgba(111, 227, 191, 0.7)",
      backgroundColor: "rgba(44, 157, 130, 0.14)",
    },
    ".TabLabel": { color: "#f2f7ff" },
    ".TabLabel--selected": { color: "#f2f7ff" },
  },
};

type CheckoutContact = {
  name: string;
  phone: string;
  email: string;
  city: string;
  postcode: string;
  address1: string;
};

function PaymentStep({
  clientSecret,
  publishableKey,
  orderCode,
  contact,
  onPaid,
  termsAccepted,
}: {
  clientSecret: string;
  publishableKey: string;
  orderCode: string;
  contact: CheckoutContact;
  onPaid: () => void;
  termsAccepted: boolean;
}) {
  const stripePromise = loadStripe(publishableKey);
  return (
    <Elements stripe={stripePromise} options={{ clientSecret, appearance: STRIPE_APPEARANCE }}>
      <StripePaymentStep orderCode={orderCode} contact={contact} onPaid={onPaid} termsAccepted={termsAccepted} />
    </Elements>
  );
}

function StripePaymentStep({
  orderCode,
  contact,
  onPaid,
  termsAccepted,
}: {
  orderCode: string;
  contact: CheckoutContact;
  onPaid: () => void;
  termsAccepted: boolean;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  // Stripe takes a few seconds to determine which methods (BLIK, Przelewy24,
  // Revolut, ...) are actually eligible before painting them in - without
  // this, that gap looked like "only a card field, nothing else" and some
  // customers ordered before the rest had a chance to appear.
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(true);

  async function handlePay() {
    if (!stripe || !elements) return;
    setIsSubmitting(true);
    setError("");
    // "if_required" keeps the customer on this page (and the order only
    // becomes real to them) once the payment has actually gone through -
    // only redirect-based methods (BLIK, wallets, ...) leave the page, in
    // which case /zamowienie/[orderCode] takes over the "paid" handling.
    const result = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/zamowienie/${encodeURIComponent(orderCode)}?from_payment=1`,
        // The billing address field is hidden below (we already collect the
        // shipping address in our own form) - Stripe still needs it though,
        // so it's supplied here explicitly rather than left for the hidden
        // UI to (not) fill in.
        payment_method_data: {
          billing_details: {
            name: contact.name || undefined,
            email: contact.email || undefined,
            phone: contact.phone || undefined,
            address: {
              city: contact.city || undefined,
              postal_code: contact.postcode || undefined,
              line1: contact.address1 || undefined,
              country: "PL",
            },
          },
        },
      },
      redirect: "if_required",
    });
    if (result.error) {
      setError(result.error.message || "Nie udało się rozpocząć płatności.");
      setIsSubmitting(false);
      return;
    }
    if (result.paymentIntent && (result.paymentIntent.status === "succeeded" || result.paymentIntent.status === "processing")) {
      onPaid();
      return;
    }
    setIsSubmitting(false);
  }

  return (
    <div className="cart-checkout-payment">
      {paymentMethodsLoading ? (
        <div className="cart-payment-waiting">
          <span className="cart-invoice-nip-spinner" aria-hidden="true" />
          Wczytujemy dostępne metody płatności…
        </div>
      ) : null}
      <div className={paymentMethodsLoading ? "cart-payment-element-loading" : undefined}>
        <PaymentElement
          onReady={() => setPaymentMethodsLoading(false)}
          options={{
            defaultValues: {
              billingDetails: {
                name: contact.name || undefined,
                email: contact.email || undefined,
                phone: contact.phone || undefined,
                address: {
                  city: contact.city || undefined,
                  postal_code: contact.postcode || undefined,
                  line1: contact.address1 || undefined,
                  country: "PL",
                },
              },
            },
            // We already collect the shipping address in our own form above -
            // no need to ask for it again inside the Stripe form (applies to
            // BLIK and every other method here, not just cards).
            fields: {
              billingDetails: { address: "never" },
            },
          }}
        />
      </div>
      {error ? <div className="cart-checkout-error">{error}</div> : null}
      <button
        type="button"
        className="cart-page-checkout-cta"
        onClick={handlePay}
        disabled={isSubmitting || !termsAccepted || paymentMethodsLoading}
      >
        {isSubmitting ? "Przetwarzamy…" : "Zamawiam"}
      </button>
    </div>
  );
}

export default function CartPage() {
  const [items, setItems] = useState<CartLineItem[]>([]);
  const [hydrated, setHydrated] = useState(false);
  // Where the customer actually was right before opening the cart (product +
  // step + query string) - "/" until we know better, filled in on mount.
  const [backHref, setBackHref] = useState("/");
  const [deliveryMethod, setDeliveryMethod] = useState(COURIER_METHOD.id);
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
  // seeded with this item's current config; only moskitiery-ramkowe items
  // have one (it's the only product wired to that configurator so far).
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  // Required consent checkbox - gates every "Zamawiam" CTA regardless of
  // payment method. Single link/document: "Regulamin sklepu i płatności"
  // (shop terms and payment terms live together, not as two documents).
  const [termsAccepted, setTermsAccepted] = useState(false);

  // Discount code (see core/lib/shop_discount_codes.php on the CRM side).
  // "Sprawdź" just previews the discount for display - it's re-validated
  // server-side from scratch when the order actually gets placed (see
  // buildQuotePayloadFromCart/submitOrder below), so a stale or tampered
  // client-side amount here can never reduce what's actually charged.
  const [discountCodeInput, setDiscountCodeInput] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState<AppliedDiscount | null>(null);
  const [discountChecking, setDiscountChecking] = useState(false);
  const [discountError, setDiscountError] = useState("");

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
  } | null>(null);
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
  const orderSurcharge = calcCartOversizeSurcharge(items);
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

  // Payment method is no longer a separate choice - cash-on-delivery is one
  // of the delivery methods on the left, so it's derived straight from that.
  const paymentMethod: "online" | "cod" = deliveryMethod === COD_DELIVERY_METHOD_ID ? "cod" : "online";

  const editingItem = editingItemId ? items.find((item) => item.id === editingItemId) || null : null;

  const requiresAddress = deliveryMethod !== "odbior-osobisty";
  // E-mail is mandatory (not just "phone or e-mail" any more) - it's what
  // gets pre-filled into the Stripe payment form and used for the receipt.
  const emailValid = /\S+@\S+\.\S+/.test(form.email.trim());
  const contactReady =
    form.firstName.trim() !== "" && form.lastName.trim() !== "" && form.phone.trim() !== "" && emailValid;
  const addressReady = !requiresAddress || (form.city.trim() !== "" && form.address1.trim() !== "");
  const invoiceReady = !wantsInvoice || (invoice.nip.trim().length === 10 && invoice.companyName.trim() !== "");
  // Per-field "is this one correctly filled in?" booleans, purely for the
  // subtle-accent/green-checkmark feedback on each input (see
  // CartFieldStatus) - deliberately mirror the readiness checks above
  // rather than inventing stricter rules a field doesn't actually need to
  // pass to submit.
  const firstNameFieldValid = form.firstName.trim() !== "";
  const lastNameFieldValid = form.lastName.trim() !== "";
  const phoneFieldValid = form.phone.trim() !== "";
  const cityFieldValid = form.city.trim() !== "";
  const postcodeFieldValid = /^\d{2}-?\d{3}$/.test(form.postcode.trim());
  const address1FieldValid = form.address1.trim() !== "";
  const nipFieldValid = invoice.nip.trim().length === 10;
  const companyNameFieldValid = invoice.companyName.trim() !== "";
  const invoiceStreetFieldValid = invoice.street.trim() !== "";
  const invoicePostcodeFieldValid = /^\d{2}-?\d{3}$/.test(invoice.postcode.trim());
  const invoiceCityFieldValid = invoice.city.trim() !== "";
  // The payment section itself is always rendered (see JSX below) - this
  // just controls whether it's locked/greyed out or interactive.
  const deliveryDataReady = contactReady && addressReady && invoiceReady && items.length > 0;
  const paymentReady = paymentMethod === "online" || codSms.status === "verified";
  const checkoutReady = deliveryDataReady && paymentReady;
  // Delivery/address data stays editable even once a draft order (and its
  // Stripe payment form) already exists - a typo fix shouldn't require
  // starting over. It only locks once the order is genuinely final: paid
  // online, or cash-on-delivery (which has no further payment step at all).
  const dataLocked = paymentConfirmed || (orderState !== null && orderState.paymentProvider === "cod");

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
  const draftSnapshotRef = useRef("");
  const orderStateRef = useRef(orderState);
  useEffect(() => {
    orderStateRef.current = orderState;
  }, [orderState]);
  useEffect(() => {
    const snapshot = JSON.stringify({ form, wantsInvoice, invoice, deliveryMethod, items });
    const current = orderStateRef.current;
    if (
      current &&
      current.paymentProvider !== "cod" &&
      !paymentConfirmed &&
      draftSnapshotRef.current &&
      draftSnapshotRef.current !== snapshot
    ) {
      setOrderState(null);
      setError("");
      submittedRef.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, wantsInvoice, invoice, deliveryMethod, items, paymentConfirmed]);

  async function sendCodSms() {
    setCodSms({ status: "sending", token: "", code: "", error: "" });
    try {
      // Same total the "Razem" row shows once cash-on-delivery is picked -
      // included in the SMS text so the customer sees the exact amount
      // they're committing to accept on delivery, not just the code.
      const codTotal = Math.max(
        0,
        summary.total - (appliedDiscount?.amount || 0) + orderSurcharge + COD_SURCHARGE_AMOUNT,
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
    } catch (smsError) {
      setCodSms({
        status: "error",
        token: "",
        code: "",
        error: smsError instanceof Error ? smsError.message : "Nie udało się wysłać kodu SMS.",
      });
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
    } catch (smsError) {
      setCodSms((current) => ({
        ...current,
        status: "sent",
        error: smsError instanceof Error ? smsError.message : "Niepoprawny kod SMS.",
      }));
    }
  }

  async function checkDiscountCode() {
    const code = discountCodeInput.trim();
    if (!code) return;
    setDiscountChecking(true);
    setDiscountError("");
    try {
      const response = await fetch("https://crm-keika.groovemedia.pl/biuro/api/shop-public/discount_code_check.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, subtotal: summary.total }),
      });
      const json = (await response.json()) as DiscountCheckResponse;
      if (!json.ok || !json.discount) {
        throw new Error(json.error || "Nieprawidłowy kod rabatowy.");
      }
      setAppliedDiscount(json.discount);
      setDiscountCodeInput(json.discount.code);
    } catch (checkError) {
      setAppliedDiscount(null);
      setDiscountError(checkError instanceof Error ? checkError.message : "Nie udało się sprawdzić kodu.");
    } finally {
      setDiscountChecking(false);
    }
  }

  function removeDiscountCode() {
    setAppliedDiscount(null);
    setDiscountCodeInput("");
    setDiscountError("");
  }

  const submitOrder = useCallback(async () => {
    if (submittedRef.current) return;
    submittedRef.current = true;
    draftSnapshotRef.current = JSON.stringify({ form, wantsInvoice, invoice, deliveryMethod, items });
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
          id: "position-cod-fee",
          slug: "doplata-platnosc-za-pobraniem",
          label: "Dopłata za płatność za pobraniem",
          amount: paymentMethod === "cod" ? COD_SURCHARGE_AMOUNT : 0,
          summary: "Dopłata za płatność za pobraniem",
        },
      ];
      const quotePayload = buildQuotePayloadFromCart(items, extraCharges, appliedDiscount);
      const quoteResponse = await saveShopQuote(quotePayload);
      const quoteCode = quoteResponse.quote.quote_code;

      const deliveryLabel =
        [COURIER_METHOD, PACZKOMAT_METHOD, COD_DELIVERY_METHOD, PICKUP_METHOD].find(
          (method) => method.id === deliveryMethod,
        )?.label || "";
      const paymentLabel = paymentMethod === "cod" ? "Za pobraniem" : "Online (Stripe)";
      const noteWithDelivery = [
        `Metoda dostawy: ${deliveryLabel}`,
        `Metoda płatności: ${paymentLabel}`,
        form.note.trim(),
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await fetch("/api/orders/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          quote_code: quoteCode,
          customer: { name: `${form.firstName} ${form.lastName}`.trim(), phone: form.phone, email: form.email },
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
          payment_provider: paymentMethod === "cod" ? "cod" : "stripe",
          payment_method: paymentMethod === "cod" ? "cod" : "",
          ...(paymentMethod === "cod" ? { cod_sms_verification_token: codSms.token } : {}),
        }),
      });
      const json = (await response.json()) as OrderCreateResponse;
      if (!json.ok || !json.order) {
        throw new Error(json.error || "Nie udało się utworzyć zamówienia.");
      }

      setOrderState({
        orderCode: json.order.order_code,
        amountTotal: json.order.amount_total,
        clientSecret: json.client_secret,
        publishableKey: json.publishable_key,
        paymentEnabled: Boolean(json.payment_enabled && json.client_secret && json.publishable_key),
        paymentProvider: json.payment_provider || (paymentMethod === "cod" ? "cod" : "stripe"),
      });
      // Cash-on-delivery has no further payment step - the order is real the
      // moment it's created. Online payment isn't real yet at this point;
      // the cart only clears once StripePaymentStep reports success (or a
      // payment_enabled:false fallback, handled below).
      if (paymentMethod === "cod" || !Boolean(json.payment_enabled && json.client_secret && json.publishable_key)) {
        clearCart();
        setItems([]);
      }
    } catch (submitError) {
      submittedRef.current = false;
      setError(submitError instanceof Error ? submitError.message : "Wystąpił błąd.");
    } finally {
      setIsSubmitting(false);
    }
  }, [items, deliveryMethod, form, wantsInvoice, invoice, paymentMethod, codSms.token, orderSurcharge, appliedDiscount]);

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
  useEffect(() => {
    if (orderState || isSubmitting || !checkoutReady) return;
    if (paymentMethod === "cod") {
      void submitOrder();
      return;
    }
    const timer = window.setTimeout(() => {
      void submitOrder();
    }, 900);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutReady, orderState, paymentMethod, submitOrder]);

  return (
    <div className="cart-page">
      <div className="cart-page-gradient-bg" aria-hidden="true" />
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
                        {item.hardwareLabel ? `${cartItemFieldLabels(item.productSlug).hardware}: ${item.hardwareLabel}` : null}
                        {item.meshLabel ? ` · ${cartItemFieldLabels(item.productSlug).mesh}: ${item.meshLabel}` : null}
                        {item.modelLabel ? ` · Model okna: ${item.modelLabel}` : null}
                        {item.widthMm && item.heightMm ? ` · ${item.widthMm} × ${item.heightMm} mm` : null}
                      </span>
                      <span className="cart-page-item-unit">{formatPln(item.price)} / szt.</span>
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
                    <div className="cart-page-item-total">{formatPln(item.total)}</div>
                    <button
                      type="button"
                      className="cart-page-item-remove"
                      onClick={() => handleRemove(item.id)}
                      disabled={dataLocked}
                      aria-label="Usuń pozycję"
                    >
                      Usuń
                    </button>
                    {item.productSlug === "moskitiery-ramkowe" ? (
                      <button
                        type="button"
                        className="cart-page-item-edit"
                        onClick={() => setEditingItemId(item.id)}
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
                    ))}
                  </div>
                </section>

                <section className="cart-checkout-form-card">
                  <h2>Adres wysyłki</h2>
                  <fieldset className="cart-checkout-form" disabled={dataLocked}>
                    <div className="cart-checkout-form-grid">
                      <label>
                        Imię
                        <CartFieldStatus valid={firstNameFieldValid}>
                          <input
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
                            value={form.lastName}
                            onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                            required
                          />
                        </CartFieldStatus>
                      </label>
                      <label>
                        Telefon
                        <CartFieldStatus valid={phoneFieldValid}>
                          <input
                            value={form.phone}
                            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                            required
                          />
                        </CartFieldStatus>
                      </label>
                      <label>
                        E-mail
                        <CartFieldStatus valid={emailValid}>
                          <input
                            type="email"
                            value={form.email}
                            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                            required
                          />
                        </CartFieldStatus>
                      </label>
                      {requiresAddress ? (
                        <>
                          <label>
                            Miasto
                            <CartFieldStatus valid={cityFieldValid}>
                              <input
                                value={form.city}
                                onChange={(event) => setForm((current) => ({ ...current, city: event.target.value }))}
                              />
                            </CartFieldStatus>
                          </label>
                          <label>
                            Kod pocztowy
                            <CartFieldStatus valid={postcodeFieldValid}>
                              <input
                                value={form.postcode}
                                onChange={(event) =>
                                  setForm((current) => ({ ...current, postcode: event.target.value }))
                                }
                              />
                            </CartFieldStatus>
                          </label>
                          <label>
                            Ulica i numer
                            <CartFieldStatus valid={address1FieldValid}>
                              <input
                                value={form.address1}
                                onChange={(event) =>
                                  setForm((current) => ({ ...current, address1: event.target.value }))
                                }
                              />
                            </CartFieldStatus>
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
                              onClick={checkDiscountCode}
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
                      {appliedDiscount ? (
                        <div className="cart-page-summary-row is-muted">
                          <span>Kod rabatowy {appliedDiscount.code}</span>
                          <span>-{formatPln(appliedDiscount.amount)}</span>
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
                          {formatPln(
                            Math.max(
                              0,
                              summary.total -
                                (appliedDiscount?.amount || 0) +
                                orderSurcharge +
                                (paymentMethod === "cod" ? COD_SURCHARGE_AMOUNT : 0),
                            ),
                          )}
                        </strong>
                      </div>
                    </>
                  ) : null}

                  {/* The payment method itself is no longer a choice made
                      here - it follows straight from the delivery method
                      picked on the left (cash-on-delivery is one of those
                      options now). This badge just reflects that. */}
                  {!orderState ? (
                    <p className={`cart-payment-method-badge ${deliveryDataReady ? "" : "is-muted"}`}>
                      {paymentMethod === "cod" ? "Płatność za pobraniem" : "Płatność online"}
                    </p>
                  ) : null}

                  {!dataLocked && items.length > 0 ? (
                    <label className="cart-terms-checkbox">
                      <input
                        type="checkbox"
                        checked={termsAccepted}
                        onChange={(event) => setTermsAccepted(event.target.checked)}
                        required
                      />
                      <span>
                        Przeczytałem i akceptuję{" "}
                        <button type="button" className="cart-terms-link" onClick={() => setLegalModalOpen(true)}>
                          regulamin sklepu i płatności
                        </button>
                        .
                      </span>
                    </label>
                  ) : null}

                  {orderState ? (
                    <>
                      {orderState.paymentProvider === "cod" ? (
                        <>
                          <p className="cart-page-order-note">
                            Zamówienie <strong>{orderState.orderCode}</strong> utworzone. Wgląd do zamówienia będzie
                            wymagał telefonu albo e-maila podanego w formularzu.
                          </p>
                          <div className="cart-page-checkout-note">
                            Zamówienie przyjęte z płatnością za pobraniem. Kurier odbierze{" "}
                            <strong>
                              {orderState.amountTotal ? formatPln(Number(orderState.amountTotal)) : "kwotę zamówienia"}
                            </strong>{" "}
                            przy dostawie.
                          </div>
                        </>
                      ) : paymentConfirmed ? (
                        <>
                          <p className="cart-page-order-note">
                            Płatność zakończona sukcesem - dziękujemy! Zamówienie <strong>{orderState.orderCode}</strong>{" "}
                            jest potwierdzone. Wgląd do zamówienia będzie wymagał telefonu albo e-maila podanego w
                            formularzu.
                          </p>
                        </>
                      ) : orderState.paymentEnabled && orderState.clientSecret && orderState.publishableKey ? (
                        <>
                          <PaymentStep
                            clientSecret={orderState.clientSecret}
                            publishableKey={orderState.publishableKey}
                            orderCode={orderState.orderCode}
                            contact={{
                              name: `${form.firstName} ${form.lastName}`.trim(),
                              phone: form.phone,
                              email: form.email,
                              city: form.city,
                              postcode: form.postcode,
                              address1: form.address1,
                            }}
                            termsAccepted={termsAccepted}
                            onPaid={() => {
                              clearCart();
                              setItems([]);
                              setPaymentConfirmed(true);
                            }}
                          />
                        </>
                      ) : (
                        <div className="cart-page-checkout-note">
                          Płatność online nie jest jeszcze skonfigurowana w tym środowisku. Zamówienie zapisaliśmy
                          pod numerem <strong>{orderState.orderCode}</strong> - skontaktujemy się, aby dokończyć
                          płatność.
                        </div>
                      )}
                    </>
                  ) : !deliveryDataReady ? (
                    <p className="cart-checkout-intro">
                      {/* Desktop: the form really is the left column here.
                          Mobile stacks everything in one column, so the
                          form sits above this instead - CSS swaps which
                          span shows per the same breakpoint the layout
                          itself switches at. */}
                      <span className="cart-checkout-intro-desktop">Uzupełnij dane po lewej</span>
                      <span className="cart-checkout-intro-mobile">Uzupełnij dane powyżej</span>{" "}
                      (imię i nazwisko, kontakt, adres), aby przejść do płatności.
                    </p>
                  ) : paymentMethod === "online" ? (
                    <>
                      {error ? (
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
                      ) : isSubmitting ? (
                        <div className="cart-payment-waiting">
                          <span className="cart-invoice-nip-spinner" aria-hidden="true" />
                          Przygotowujemy płatność…
                        </div>
                      ) : (
                        <p className="cart-checkout-intro">Płatność otworzy się za chwilę…</p>
                      )}
                    </>
                  ) : (
                    <>
                      {error ? <div className="cart-checkout-error">{error}</div> : null}
                      <button
                        type="button"
                        className="cart-page-checkout-cta"
                        onClick={() => {
                          setCodModalOpen(true);
                          void sendCodSms();
                        }}
                        disabled={!termsAccepted}
                      >
                        Zamawiam
                      </button>
                    </>
                  )}
                </section>
              </aside>
            </div>
          </>
        )}
      </main>

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
                  hardwareId: ROLETY_DACHOWE_HARDWARE.find((option) => option.label === editingItem.hardwareLabel)?.id,
                  materialTypeId: ROLETY_DACHOWE_FABRIC.find((option) => option.label === editingItem.meshLabel)?.materialTypeId,
                  fabricId: ROLETY_DACHOWE_FABRIC.find((option) => option.label === editingItem.meshLabel)?.id,
                  widthMm: editingItem.widthMm,
                  heightMm: editingItem.heightMm,
                  qty: editingItem.qty,
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
