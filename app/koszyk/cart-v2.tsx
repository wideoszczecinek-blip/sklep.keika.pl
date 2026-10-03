"use client";

// Nowy koszyk (test 50/50, lib/cart-design.ts) - DRUGA wersja, 2026-10-04.
// Pierwsza (dwie karty "dane" i "płatność" na jednej stronie) była zbyt
// podobna do starego koszyka (właściciel: "koszyki praktycznie się nie
// różnią, chodziło o totalnie zmienioną koncepcję").
//
// Koncepcja: kasa jak aplikacja. Zamiast długiej strony z formularzem -
// cztery ekrany, każdy z jedną decyzją i jednym przyciskiem na dole:
//   0 Zamówienie  duża wizualizacja produktu, cena z dostawą, powody
//   1 Dostawa     kafle do stuknięcia (nic do wpisania)
//   2 Dane        jedyny ekran z klawiaturą
//   3 Płatność    BLIK otwarty z góry, reszta jednym stuknięciem
// Stan, walidacja, zamówienie i płatności żyją w app/koszyk/page.tsx i są
// wspólne ze starym koszykiem - tu przychodzą jako props.
//
// Skąd to się bierze (dane sklepu + badania, nie gust):
//  - 61% wychodzących z koszyka znikało w 30 s, 65% nie zaczynało
//    formularza -> pierwszy ekran nie pokazuje ani jednego pola, tylko
//    produkt, kwotę i "Zamawiam";
//  - pierwsza decyzja to stuknięcie, nie pisanie (dostawa), a pasek postępu
//    pokazuje wtedy już połowę drogi;
//  - pola ważą więcej niż kroki (Baymard 2024): jedno "Imię i nazwisko",
//    uwagi i faktura za linkami, autouzupełnianie na jednym ekranie;
//  - BLIK pierwszy i otwarty (Stripe 2025: +46% dla polskich klientów,
//    u nas 9 na 10 płatności);
//  - opinie o sklepie i płatność przy odbiorze to dla Polaków główne
//    sygnały wiarygodności nieznanego sklepu (Gemius 2025: 43% i 24-31%) ->
//    obie rzeczy są na pierwszym ekranie.
import Link from "next/link";
import { Component, useCallback, useEffect, useRef, useState, type Dispatch, type FocusEvent, type ReactNode, type SetStateAction } from "react";
import { formatPln, type CartLineItem } from "@/lib/cart";
import CartWindowThumb, { resolveCartWindowThumb } from "@/app/components/cart-window-thumb";
import PaymentTrustTicker from "@/app/components/payment-trust-ticker";
import PlisaPreview from "@/features/plisy/PlisaPreview";
import PlisaDachowaPreview from "@/features/plisy-dachowe/PlisaDachowaPreview";
import PaczkomatPicker from "@/app/components/paczkomat-picker";
import InstallmentOffer from "@/app/components/installment-offer";
import type { PaczkomatPoint } from "../api/paczkomaty/route";
import { ALLEGRO_RATING_SNAPSHOTS } from "@/lib/landing-snapshot";
import { MOSKITIERY_RAMKOWE_ALLEGRO_REVIEWS } from "@/app/moskitiery-ramkowe-reviews-data";
import { PROMO_CODE, formatPromoRemaining, getPromoRemainingMs } from "@/lib/promo";

type FormState = {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  city: string;
  postcode: string;
  address1: string;
  note: string;
};
type BuyerState = { name: string; email: string; phone: string; street: string; postcode: string; city: string };
type InvoiceState = { nip: string; companyName: string; street: string; postcode: string; city: string };
type DeliveryOption = { id: string; label: string; description: string; extraFee?: number };
type AppliedDiscount = { code: string; type: "percent" | "amount"; value: number; amount: number };

export type CartV2Props = {
  items: CartLineItem[];
  backHref: string;
  dataLocked: boolean;
  track: (eventName: string, label: string, meta?: Record<string, string | number | boolean | null>) => void;
  // pozycje
  itemFieldLabels: (slug: string) => { hardware: string; mesh: string };
  combinedDiscountPercent: number;
  onQty: (id: string, qty: number) => void;
  onRemove: (id: string) => void;
  onEdit: (id: string) => void;
  oversizeThresholdMm: number;
  // kwoty
  itemsCount: number;
  itemsTotal: number;
  combinedSavings: number;
  appliedDiscount: AppliedDiscount | null;
  rescueRow: { label: string; amount: number } | null;
  shippingFee: number;
  expressFee: number;
  orderSurcharge: number;
  codSurcharge: number;
  payableTotal: number;
  totalSavings: number;
  isPickup: boolean;
  amountToFreeShipping: number;
  // kod rabatowy
  discountOpen: boolean;
  setDiscountOpen: (open: boolean) => void;
  discountCodeInput: string;
  setDiscountCodeInput: (value: string) => void;
  discountChecking: boolean;
  discountError: string;
  clearDiscountError: () => void;
  checkDiscountCode: () => void;
  removeDiscountCode: () => void;
  // termin
  expressEligible: boolean;
  expressSelected: boolean;
  chooseExpress: (on: boolean) => void;
  expressFeeAmount: number;
  dispatchStandardLabel: string;
  dispatchExpressLabel: string;
  dispatchCutoffLabel: string;
  plisyLeadTime: boolean;
  // dostawa i dane
  deliveryMethods: DeliveryOption[];
  deliveryMethod: string;
  chooseDelivery: (method: DeliveryOption) => void;
  paczkomatMethodId: string;
  pickupMethodId: string;
  selectedPaczkomat: PaczkomatPoint | null;
  choosePaczkomat: (point: PaczkomatPoint | null) => void;
  form: FormState;
  setForm: Dispatch<SetStateAction<FormState>>;
  onPostcode: (raw: string) => void;
  onPhone: (raw: string) => void;
  setAddress1Focused: (focused: boolean) => void;
  onFieldBlur: (event: FocusEvent<HTMLDivElement>) => void;
  valid: {
    email: boolean;
    phone: boolean;
    firstName: boolean;
    lastName: boolean;
    address1: boolean;
    postcode: boolean;
    city: boolean;
    buyerName: boolean;
    buyerEmail: boolean;
    nip: boolean;
    companyName: boolean;
    invoiceStreet: boolean;
    invoicePostcode: boolean;
    invoiceCity: boolean;
  };
  fieldError: (key: string) => string | undefined;
  requiresAddress: boolean;
  contactUntouched: boolean;
  deliveryDataReady: boolean;
  jumpToFirstProblem: () => void;
  noteOpen: boolean;
  setNoteOpen: (open: boolean) => void;
  buyerDifferent: boolean;
  setBuyerDifferent: (on: boolean) => void;
  buyer: BuyerState;
  setBuyer: Dispatch<SetStateAction<BuyerState>>;
  wantsInvoice: boolean;
  setWantsInvoice: (on: boolean) => void;
  invoice: InvoiceState;
  setInvoice: Dispatch<SetStateAction<InvoiceState>>;
  onNip: (digits: string) => void;
  nipLookupLoading: boolean;
  nipLookupError: string;
  // płatność
  isCod: boolean;
  paymentChooser: () => ReactNode;
  hasBlikTile: boolean;
  onlinePaymentKind: string;
  preselectPaymentKind: (kind: "blik") => void;
  codBlock: ReactNode;
  transferReady: boolean;
  submitTransfer: () => void;
  isSubmitting: boolean;
  hasOrderDraft: boolean;
  // pozostałe
  escapeBottomRef: (node: HTMLElement | null) => void;
  escapeChip: ReactNode;
  hasEscapeOffer: boolean;
  contactPhone: string;
};

const STEP_NAMES = ["zamowienie", "dostawa", "dane", "platnosc"] as const;
const STEP_LABELS = ["Zamówienie", "Dostawa", "Dane", "Płatność"];

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

/** Pole formularza: te same klasy stanu i atrybut data-checkout-field co
 * w starym koszyku - po nich page.tsx przewija do pola i je podświetla. */
function Field({
  label,
  hint,
  fieldKey,
  valid,
  error,
  wide,
  children,
}: {
  label: string;
  hint?: string;
  fieldKey?: string;
  valid?: boolean;
  error?: string;
  wide?: boolean;
  children: ReactNode;
}) {
  return (
    <label className={`cv2-field${wide ? " is-wide" : ""}`}>
      {label}
      {hint ? <span className="cv2-field-hint">{hint}</span> : null}
      <div className={`cart-field ${valid ? "is-valid" : error ? "is-invalid" : "is-pending"}`} data-checkout-field={fieldKey || undefined}>
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
    </label>
  );
}

function ItemVisual({ item, className }: { item: CartLineItem; className: string }) {
  if (resolveCartWindowThumb(item)) {
    return (
      <div className={className}>
        <CartWindowThumb item={item} label={`${item.productLabel} na oknie, w wybranych kolorach`} />
      </div>
    );
  }
  if (item.productSlug === "plisy" && item.fabricColor) {
    return (
      <div className={`${className} is-plisa`}>
        <PlisaPreview fabricColor={item.fabricColor} hardwareColor={item.hardwareColor || ""} />
      </div>
    );
  }
  if (item.productSlug === "plisy-dachowe" && item.fabricColor) {
    return (
      <div className={`${className} is-plisa`}>
        <PlisaDachowaPreview fabricColor={item.fabricColor} hardwareColor={item.hardwareColor || ""} />
      </div>
    );
  }
  return <div className={`${className} is-photo`} style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined} />;
}

const svg = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {path}
  </svg>
);
const ICON = {
  lock: svg(
    <>
      <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" />
      <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" />
    </>,
  ),
  back: svg(<path d="M14.5 5.5 8 12l6.5 6.5" />),
  truck: svg(
    <>
      <path d="M2.5 6.5h11v9h-11zM13.5 9.5h4l3 3.2v2.8h-7z" />
      <circle cx="7" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </>,
  ),
  cash: svg(
    <>
      <rect x="2.5" y="6.5" width="19" height="11" rx="2" />
      <circle cx="12" cy="12" r="2.6" />
      <path d="M6 9.5v5M18 9.5v5" />
    </>,
  ),
  box: svg(
    <>
      <path d="M4 7.5 12 3.5l8 4v9l-8 4-8-4z" />
      <path d="M4 7.5l8 4 8-4M12 11.5v9" />
    </>,
  ),
  shop: svg(
    <>
      <path d="M4 10v9.5h16V10M3 6.5l1.5-3h15l1.5 3c0 1.9-1.3 3.5-3 3.5s-3-1.6-3-3.5c0 1.9-1.3 3.5-3 3.5S9 8.400 9 6.5C9 8.4 7.700 10 6 10S3 8.400 3 6.500z" />
      <path d="M10 19.500v-5h4v5" />
    </>,
  ),
  shield: svg(
    <>
      <path d="M12 3.200 5 6v5.500c0 4.200 2.900 7.700 7 9.300 4.100-1.600 7-5.100 7-9.300V6z" />
      <path d="m9 12 2.200 2.200L15 10.400" />
    </>,
  ),
  undo: svg(
    <>
      <path d="M8 5.500 4 9.500l4 4" />
      <path d="M4 9.500h10a5.500 5.500 0 0 1 0 11h-3" />
    </>,
  ),
  wallet: svg(
    <>
      <rect x="3" y="6" width="18" height="13" rx="2.500" />
      <path d="M16 12.500h2M3 10h18" />
    </>,
  ),
  bolt: svg(<path d="M13 2.500 5 13.500h6l-1 8 8-11h-6z" />),
};

function deliveryIcon(id: string, paczkomatId: string, pickupId: string): ReactNode {
  if (id === paczkomatId) return ICON.box;
  if (id === pickupId) return ICON.shop;
  if (id === "pobranie") return ICON.cash;
  return ICON.truck;
}

export default function CartV2(props: CartV2Props) {
  const p = props;
  const [step, setStepRaw] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [paczkomatHint, setPaczkomatHint] = useState(false);
  const screenRef = useRef<HTMLDivElement | null>(null);

  // Systemowe "wstecz" cofa o ekran, zamiast wyrzucać z koszyka.
  const stepRef = useRef(0);
  const goTo = useCallback(
    (next: number, how: "push" | "replace" | "pop" = "push") => {
      const target = Math.max(0, Math.min(3, next));
      if (how === "push" && target > stepRef.current) {
        try {
          window.history.pushState({ cv2Step: target }, "");
        } catch {
          // brak history API - kroki działają bez "wstecz"
        }
      }
      stepRef.current = target;
      setStepRaw(target);
      setSummaryOpen(false);
      window.requestAnimationFrame(() => window.scrollTo({ top: 0 }));
    },
    [],
  );
  useEffect(() => {
    const onPop = (event: PopStateEvent) => {
      const state = event.state as { cv2Step?: number } | null;
      const target = typeof state?.cv2Step === "number" ? state.cv2Step : 0;
      if (target < stepRef.current) goTo(target, "pop");
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [goTo]);
  const goBack = () => {
    if (stepRef.current <= 0) return;
    try {
      const state = window.history.state as { cv2Step?: number } | null;
      if (typeof state?.cv2Step === "number") {
        window.history.back();
        return;
      }
    } catch {
      // niżej zwykłe cofnięcie
    }
    goTo(stepRef.current - 1, "pop");
  };

  // Powrót z bramki płatności albo zapamiętany formularz: od razu płatność.
  const initialRef = useRef(false);
  useEffect(() => {
    if (initialRef.current) return;
    initialRef.current = true;
    if (p.deliveryDataReady && !p.contactUntouched) goTo(3, "replace");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Dane przestały być kompletne (np. zmiana dostawy) - wracamy na ekran danych.
  useEffect(() => {
    if (step === 3 && !p.deliveryDataReady) goTo(2, "pop");
  }, [step, p.deliveryDataReady, goTo]);

  // BLIK zaznaczony przy wejściu w płatność (bez zdarzenia "wybrał metodę" -
  // to nasz wybór, nie klienta).
  const blikPreselectedRef = useRef(false);
  useEffect(() => {
    if (step !== 3 || blikPreselectedRef.current) return;
    blikPreselectedRef.current = true;
    if (!p.isCod && p.onlinePaymentKind === "" && p.hasBlikTile && !p.hasOrderDraft) p.preselectPaymentKind("blik");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  const isPaczkomat = p.deliveryMethod === p.paczkomatMethodId;
  const advance = () => {
    if (step === 0) {
      p.track("cart_v2_start", "zamawiam", {});
      p.track("cart_v2_step", STEP_NAMES[1], {});
      goTo(1);
      return;
    }
    if (step === 1) {
      if (isPaczkomat && !p.selectedPaczkomat) {
        setPaczkomatHint(true);
        document.querySelector(".cv2-paczkomat")?.scrollIntoView({ behavior: "smooth", block: "center" });
        return;
      }
      p.track("cart_v2_step", STEP_NAMES[2], {});
      goTo(2);
      window.setTimeout(() => {
        const input = screenRef.current?.querySelector<HTMLInputElement>(".cv2-form input");
        if (input && !input.value) input.focus({ preventScroll: true });
      }, 420);
      return;
    }
    if (step === 2) {
      if (!p.deliveryDataReady) {
        p.jumpToFirstProblem();
        return;
      }
      p.track("checkout_next", "platnosc", { design: "v2" });
      p.track("cart_v2_step", STEP_NAMES[3], {});
      goTo(3);
    }
  };

  const fullName = `${p.form.firstName}${p.form.lastName ? ` ${p.form.lastName}` : ""}`;
  const [nameDraft, setNameDraft] = useState<string | null>(null);
  const setFullName = (raw: string) => {
    setNameDraft(raw);
    const parts = raw.replace(/\s+/g, " ").trimStart().split(" ");
    const first = parts.shift() || "";
    p.setForm((current) => ({ ...current, firstName: first, lastName: parts.join(" ").trim() }));
  };
  const nameError = p.fieldError("firstName") ? "Podaj imię i nazwisko." : p.fieldError("lastName");

  const rating = ALLEGRO_RATING_SNAPSHOTS["moskitiery-ramkowe"];
  const score = rating && rating.averageScore > 0 ? rating.averageScore.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  const responses = rating && rating.totalResponses > 0 ? rating.totalResponses.toLocaleString("pl-PL") : "";

  // Jedna prawdziwa, krótka opinia (lista z landingu moskitier) - tylko gdy
  // w koszyku są moskitiery, bo to opinie o nich.
  const [review, setReview] = useState<{ body: string; who: string } | null>(null);
  const hasMoskitiery = p.items.some((item) => item.productSlug === "moskitiery-ramkowe");
  useEffect(() => {
    if (!hasMoskitiery) {
      setReview(null);
      return;
    }
    const pool = MOSKITIERY_RAMKOWE_ALLEGRO_REVIEWS.filter((entry) => entry.estimatedStars === 5 && entry.body.length >= 40 && entry.body.length <= 150);
    if (!pool.length) return;
    const pick = pool[new Date().getDate() % pool.length];
    setReview({ body: pick.body, who: `${pick.maskedLogin}, ${pick.date}` });
  }, [hasMoskitiery]);

  // Ile jeszcze działa cena z rabatem sezonowym (ten sam termin co pasek promocji).
  const [promoLeft, setPromoLeft] = useState("");
  const promoApplied = p.appliedDiscount?.code === PROMO_CODE;
  useEffect(() => {
    if (!promoApplied) {
      setPromoLeft("");
      return;
    }
    const tick = () => {
      const ms = getPromoRemainingMs();
      setPromoLeft(ms > 0 ? formatPromoRemaining(ms) : "");
    };
    tick();
    const id = window.setInterval(tick, 30000);
    return () => window.clearInterval(id);
  }, [promoApplied]);

  const activeDelivery = p.deliveryMethods.find((method) => method.id === p.deliveryMethod) || null;
  const phoneHref = p.contactPhone ? `tel:${p.contactPhone.replace(/\s+/g, "")}` : "";
  const single = p.items.length === 1 ? p.items[0] : null;
  const heroTitle = single
    ? `${single.qty > 1 ? `${single.qty} × ` : ""}${single.productLabel}`
    : `${p.itemsCount} ${plural(p.itemsCount, "produkt", "produkty", "produktów")} na wymiar`;
  const heroSub = single && single.widthMm && single.heightMm ? `${single.widthMm / 10} × ${single.heightMm / 10} cm · ${[single.hardwareLabel, single.meshLabel].filter(Boolean).join(" · ")}` : "";
  const discountPercent = p.appliedDiscount?.type === "percent" ? p.appliedDiscount.value : 0;

  const totalsRows = (
    <>
      {p.combinedSavings > 0 ? (
        <div className="cv2-row">
          <span>Wspólne rozliczenie obwodu moskitier</span>
          <span className="is-minus">-{formatPln(p.combinedSavings)}</span>
        </div>
      ) : null}
      {p.appliedDiscount ? (
        <div className="cv2-row">
          <span>
            Rabat {p.appliedDiscount.code}
            {discountPercent ? ` -${discountPercent.toLocaleString("pl-PL")}%` : ""}
            {step === 0 ? (
              <button type="button" className="cv2-link" onClick={p.removeDiscountCode}>
                usuń
              </button>
            ) : null}
          </span>
          <span className="is-minus">-{formatPln(p.appliedDiscount.amount)}</span>
        </div>
      ) : null}
      {p.rescueRow ? (
        <div className="cv2-row">
          <span>{p.rescueRow.label}</span>
          <span className="is-minus">-{formatPln(p.rescueRow.amount)}</span>
        </div>
      ) : null}
      {!p.isPickup ? (
        <div className="cv2-row">
          <span>Dostawa</span>
          <span className={p.shippingFee > 0 ? "" : "is-minus"}>{p.shippingFee > 0 ? formatPln(p.shippingFee) : "0 zł"}</span>
        </div>
      ) : null}
      {p.expressFee > 0 ? (
        <div className="cv2-row">
          <span>Ekspres - priorytet produkcji</span>
          <span>{formatPln(p.expressFee)}</span>
        </div>
      ) : null}
      {p.orderSurcharge > 0 ? (
        <div className="cv2-row">
          <span>Dopłata za przesyłkę dłużycową</span>
          <span>{formatPln(p.orderSurcharge)}</span>
        </div>
      ) : null}
      {p.isCod ? (
        <div className="cv2-row">
          <span>Dopłata za płatność za pobraniem</span>
          <span>{formatPln(p.codSurcharge)}</span>
        </div>
      ) : null}
    </>
  );

  const itemsList = (
    <ul className="cv2-items">
      {p.items.map((item) => {
        const labels = p.itemFieldLabels(item.productSlug);
        const open = Boolean(detailsOpen[item.id]);
        const size = item.widthMm && item.heightMm ? `${item.widthMm / 10} × ${item.heightMm / 10} cm` : "";
        const unit = p.combinedDiscountPercent > 0 ? item.price * (1 - p.combinedDiscountPercent / 100) : item.price;
        const line = p.combinedDiscountPercent > 0 ? item.total * (1 - p.combinedDiscountPercent / 100) : item.total;
        return (
          <li key={item.id} className="cv2-item">
            <ItemVisual item={item} className="cv2-item-thumb" />
            <div className="cv2-item-main">
              <strong>
                {item.productLabel}
                {size ? <em> {size}</em> : null}
              </strong>
              <span className="cv2-item-sub">{[item.hardwareLabel, item.meshLabel].filter(Boolean).join(" · ")}</span>
              <span className="cv2-item-unit">
                {p.combinedDiscountPercent > 0 ? <s>{formatPln(item.price)}</s> : null} {formatPln(unit)} / szt.
              </span>
            </div>
            <div className="cv2-item-side">
              <span className="cv2-item-total">{formatPln(line)}</span>
              <div className="cv2-qty">
                <button type="button" onClick={() => p.onQty(item.id, item.qty - 1)} disabled={item.qty <= 1 || p.dataLocked} aria-label="Zmniejsz ilość">
                  −
                </button>
                <span>{item.qty}</span>
                <button type="button" onClick={() => p.onQty(item.id, item.qty + 1)} disabled={p.dataLocked} aria-label="Zwiększ ilość">
                  +
                </button>
              </div>
            </div>
            <div className="cv2-item-actions">
              <button type="button" onClick={() => setDetailsOpen((current) => ({ ...current, [item.id]: !open }))} aria-expanded={open}>
                {open ? "Zwiń szczegóły" : "Szczegóły"}
              </button>
              <button type="button" onClick={() => p.onEdit(item.id)} disabled={p.dataLocked}>
                Edytuj pozycję
              </button>
              <button type="button" className="is-remove" onClick={() => p.onRemove(item.id)} disabled={p.dataLocked} aria-label="Usuń pozycję">
                Usuń
              </button>
            </div>
            {open ? (
              <dl className="cv2-item-specs">
                {item.widthMm && item.heightMm ? (
                  <div>
                    <dt>Wymiar</dt>
                    <dd>
                      {item.splitFromWidthMm
                        ? `okno ${item.splitFromWidthMm} × ${item.heightMm} mm → 2 plisy po ${item.widthMm} mm`
                        : `${item.widthMm} × ${item.heightMm} mm`}
                    </dd>
                  </div>
                ) : null}
                {item.mountLabel ? (
                  <div>
                    <dt>Rodzaj montażu</dt>
                    <dd>{item.mountLabel}</dd>
                  </div>
                ) : null}
                {item.hardwareLabel ? (
                  <div>
                    <dt>{labels.hardware}</dt>
                    <dd>{item.hardwareLabel}</dd>
                  </div>
                ) : null}
                {item.meshLabel ? (
                  <div>
                    <dt>{labels.mesh}</dt>
                    <dd>{item.meshLabel}</dd>
                  </div>
                ) : null}
                {item.modelLabel ? (
                  <div>
                    <dt>Model okna</dt>
                    <dd>{item.modelLabel}</dd>
                  </div>
                ) : null}
                {item.productSlug === "rolety-dachowe" && item.bracketCount === 2 ? (
                  <div>
                    <dt>Uchwyty</dt>
                    <dd>2 szt.</dd>
                  </div>
                ) : null}
              </dl>
            ) : null}
            {item.productSlug === "plisy" && item.sagNoticeShown ? (
              <span className="cv2-item-note" role="note">
                Szerokość powyżej {(item.sagLimitMm || 1100) / 10} cm: profil aluminiowy może się lekko ugiąć pod ciężarem tkaniny. To naturalne — nie wpływa
                na działanie plisy, jedynie na estetykę.
              </span>
            ) : null}
            {item.oversizeSurchargeAmount ? (
              <span className="cv2-item-note">
                + {formatPln(item.oversizeSurchargeAmount)} dopłaty za przesyłkę dłużycową (rozmiar przekracza {p.oversizeThresholdMm} mm)
              </span>
            ) : null}
          </li>
        );
      })}
    </ul>
  );

  // ===== Ekran 0: zamówienie =====
  const screenOrder = (
    <>
      <section className="cv2-hero">
        <div className={`cv2-hero-visuals${p.items.length > 1 ? " is-multi" : ""}`}>
          {p.items.slice(0, 3).map((item) => (
            <ItemVisual key={item.id} item={item} className="cv2-hero-visual" />
          ))}
          {p.items.length > 3 ? <span className="cv2-hero-more">+{p.items.length - 3}</span> : null}
        </div>
        <p className="cv2-hero-eyebrow">Twoje zamówienie</p>
        <h1>{heroTitle}</h1>
        {heroSub ? <p className="cv2-hero-sub">{heroSub}</p> : null}
        <div className="cv2-hero-price">
          {p.totalSavings > 0 ? <s>{formatPln(p.payableTotal + p.totalSavings)}</s> : null}
          <strong>{formatPln(p.payableTotal)}</strong>
        </div>
        <div className="cv2-hero-chips">
          {p.totalSavings > 0 ? <span className="is-save">oszczędzasz {formatPln(p.totalSavings)}</span> : null}
          {!p.isPickup && p.shippingFee === 0 ? <span>dostawa 0 zł</span> : null}
          <span>cena końcowa</span>
        </div>
        {promoLeft ? (
          <p className="cv2-hero-timer">
            Cena z rabatem -{discountPercent.toLocaleString("pl-PL")}% jeszcze przez <b>{promoLeft}</b>
          </p>
        ) : null}
      </section>

      <ul className="cv2-reasons">
        <li>
          <span className="cv2-reason-icon">{ICON.wallet}</span>
          <span>
            <b>Płacisz, jak wolisz</b>
            BLIK, karta, PayPo za 30 dni albo gotówką przy odbiorze
          </span>
        </li>
        <li>
          <span className="cv2-reason-icon">{ICON.undo}</span>
          <span>
            <b>30 dni na zwrot</b>
            odsyłasz, jeśli coś nie zagra
          </span>
        </li>
        <li>
          <span className="cv2-reason-icon">{ICON.shield}</span>
          <span>
            <b>5 lat gwarancji</b>
            producent od 2015 roku
          </span>
        </li>
      </ul>

      {score ? (
        <section className="cv2-proof">
          <div className="cv2-proof-score">
            <strong>{score}</strong>
            <span aria-hidden="true">★★★★★</span>
            <small>{responses ? `${responses} opinii kupujących` : "ocena kupujących"}</small>
          </div>
          {review ? (
            <blockquote>
              „{review.body}”<cite>{review.who}</cite>
            </blockquote>
          ) : null}
        </section>
      ) : null}

      <section className="cv2-card">
        <div className="cv2-card-head">
          <h2>W zamówieniu</h2>
          <span>
            {p.itemsCount} {plural(p.itemsCount, "sztuka", "sztuki", "sztuk")}
          </span>
        </div>
        {itemsList}
        {!p.dataLocked ? (
          <Link href={p.backHref} className="cv2-add-more">
            + Dodaj kolejną pozycję
          </Link>
        ) : null}
        <div className="cv2-totals">
          {totalsRows}
          <div className="cv2-row is-total">
            <span>Do zapłaty</span>
            <span>{formatPln(p.payableTotal)}</span>
          </div>
          {p.shippingFee > 0 && p.amountToFreeShipping > 0 ? (
            <p className="cv2-free-ship">
              Brakuje <strong>{formatPln(p.amountToFreeShipping)}</strong> do darmowej dostawy.
            </p>
          ) : null}
        </div>
        <div className="cv2-code">
          {p.appliedDiscount ? null : !p.discountOpen && !p.discountError ? (
            <button type="button" className="cv2-link" onClick={() => p.setDiscountOpen(true)}>
              Masz kod rabatowy?
            </button>
          ) : (
            <div className="cv2-code-row">
              <input
                type="text"
                autoFocus
                value={p.discountCodeInput}
                onChange={(event) => {
                  p.setDiscountCodeInput(event.target.value);
                  if (p.discountError) p.clearDiscountError();
                }}
                placeholder="Kod rabatowy"
                disabled={p.discountChecking}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    p.checkDiscountCode();
                  }
                }}
              />
              <button type="button" onClick={p.checkDiscountCode} disabled={p.discountChecking || !p.discountCodeInput.trim()}>
                {p.discountChecking ? "Sprawdzam…" : "Zastosuj"}
              </button>
            </div>
          )}
          {p.discountError ? <p className="cv2-code-error">{p.discountError}</p> : null}
        </div>
        <InstallmentOffer amount={p.payableTotal} />
      </section>
      <div ref={p.escapeBottomRef} className="escape-offer-sentinel" aria-hidden="true" />
    </>
  );

  // ===== Ekran 1: dostawa =====
  const screenDelivery = (
    <>
      <h1 className="cv2-q">Jak dostarczyć zamówienie?</h1>
      <div className="cv2-tiles" role="radiogroup" aria-label="Sposób dostawy">
        {p.deliveryMethods.map((method) => {
          const active = p.deliveryMethod === method.id;
          return (
            <label key={method.id} className={`cv2-tile${active ? " is-active" : ""}`}>
              <input type="radio" name="delivery-method" value={method.id} checked={active} onChange={() => p.chooseDelivery(method)} disabled={p.dataLocked} />
              <span className="cv2-tile-icon">{deliveryIcon(method.id, p.paczkomatMethodId, p.pickupMethodId)}</span>
              <span className="cv2-tile-copy">
                <strong>{method.label}</strong>
                <small>{method.description}</small>
              </span>
              <span className={`cv2-tile-price${method.extraFee ? "" : " is-free"}`}>{method.extraFee ? `+${formatPln(method.extraFee)}` : "0 zł"}</span>
            </label>
          );
        })}
      </div>
      {isPaczkomat ? (
        <div data-checkout-field="paczkomat" className="cv2-paczkomat">
          {paczkomatHint && !p.selectedPaczkomat ? <p className="cv2-inline-error">Wybierz paczkomat.</p> : null}
          <PaczkomatPicker value={p.selectedPaczkomat} onChange={p.choosePaczkomat} />
        </div>
      ) : null}

      {p.expressEligible ? (
        <>
          <h2 className="cv2-q2">Kiedy wysłać?</h2>
          <div className="cv2-tiles" role="radiogroup" aria-label="Termin realizacji">
            <label className={`cv2-tile${!p.expressSelected ? " is-active" : ""}`}>
              <input type="radio" name="dispatch-speed" value="standard" checked={!p.expressSelected} onChange={() => p.chooseExpress(false)} disabled={p.dataLocked} />
              <span className="cv2-tile-icon">{ICON.box}</span>
              <span className="cv2-tile-copy">
                <strong>Standard</strong>
                <small>{p.dispatchStandardLabel ? `Wysyłka ${p.dispatchStandardLabel}` : "Wysyłka zwykle w 3 dni robocze"}</small>
              </span>
              <span className="cv2-tile-price is-free">0 zł</span>
            </label>
            <label className={`cv2-tile${p.expressSelected ? " is-active" : ""}`}>
              <input type="radio" name="dispatch-speed" value="express" checked={p.expressSelected} onChange={() => p.chooseExpress(true)} disabled={p.dataLocked} />
              <span className="cv2-tile-icon is-bolt">{ICON.bolt}</span>
              <span className="cv2-tile-copy">
                <strong>Ekspres - priorytet produkcji</strong>
                <small>
                  Wysyłka {p.dispatchExpressLabel || "jutro"}. Do {p.dispatchCutoffLabel || "12:00"} w dzień roboczy wysyłamy tego samego dnia.
                </small>
              </span>
              <span className="cv2-tile-price">+{formatPln(p.expressFeeAmount)}</span>
            </label>
          </div>
        </>
      ) : p.plisyLeadTime ? (
        <p className="cv2-lead-time">Wysyłka w 5–7 dni roboczych.</p>
      ) : null}
    </>
  );

  // ===== Ekran 2: dane =====
  const screenData = (
    <div onBlurCapture={p.onFieldBlur}>
      <h1 className="cv2-q">{p.requiresAddress ? "Dokąd wysłać?" : "Do kogo zamówienie?"}</h1>
      <p className="cv2-q-sub">
        {activeDelivery ? activeDelivery.label : ""}
        {isPaczkomat && p.selectedPaczkomat ? `: ${p.selectedPaczkomat.id}` : ""}
        {!p.dataLocked ? (
          <button type="button" className="cv2-link" onClick={goBack}>
            zmień
          </button>
        ) : null}
      </p>
      <fieldset className="cv2-form" disabled={p.dataLocked}>
        <Field label="E-mail" fieldKey="email" valid={p.valid.email} error={p.fieldError("email")} wide>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            value={p.form.email}
            onChange={(event) => p.setForm((current) => ({ ...current, email: event.target.value }))}
            required
          />
        </Field>
        <Field label="Telefon" hint="+48" fieldKey="phone" valid={p.valid.phone} error={p.fieldError("phone")} wide>
          <input type="tel" inputMode="tel" autoComplete="tel-national" value={p.form.phone} onChange={(event) => p.onPhone(event.target.value)} required />
        </Field>
        <label className="cv2-field is-wide">
          Imię i nazwisko
          <div className={`cart-field ${p.valid.firstName && p.valid.lastName ? "is-valid" : nameError ? "is-invalid" : "is-pending"}`} data-checkout-field="firstName">
            <span data-checkout-field="lastName" className="cv2-name-wrap">
              <span className="cart-field-input-wrap">
                <input
                  autoComplete="name"
                  autoCorrect="off"
                  spellCheck={false}
                  value={nameDraft ?? fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  onBlur={() => setNameDraft(null)}
                  required
                />
                {p.valid.firstName && p.valid.lastName ? (
                  <span className="cart-field-check" aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </span>
            </span>
            {nameError ? (
              <span className="cart-field-error" role="alert">
                {nameError}
              </span>
            ) : null}
          </div>
        </label>
        {p.requiresAddress ? (
          <>
            <Field label="Ulica i numer" fieldKey="address1" valid={p.valid.address1} error={p.fieldError("address1")} wide>
              <input
                autoComplete="street-address"
                autoCorrect="off"
                spellCheck={false}
                value={p.form.address1}
                onChange={(event) => p.setForm((current) => ({ ...current, address1: event.target.value }))}
                onFocus={() => p.setAddress1Focused(true)}
                onBlur={() => p.setAddress1Focused(false)}
              />
            </Field>
            <Field label="Kod pocztowy" fieldKey="postcode" valid={p.valid.postcode} error={p.fieldError("postcode")}>
              <input autoComplete="postal-code" inputMode="numeric" placeholder="00-000" value={p.form.postcode} onChange={(event) => p.onPostcode(event.target.value)} />
            </Field>
            <Field label="Miasto" fieldKey="city" valid={p.valid.city} error={p.fieldError("city")}>
              <input autoComplete="address-level2" autoCorrect="off" value={p.form.city} onChange={(event) => p.setForm((current) => ({ ...current, city: event.target.value }))} />
            </Field>
          </>
        ) : null}
      </fieldset>

      <div className="cv2-extras">
        {p.noteOpen || p.form.note.trim() !== "" ? (
          <label className="cv2-field is-wide">
            Dodatkowe informacje
            <textarea autoFocus={p.noteOpen} value={p.form.note} onChange={(event) => p.setForm((current) => ({ ...current, note: event.target.value }))} disabled={p.dataLocked} />
          </label>
        ) : (
          <button type="button" className="cv2-link" onClick={() => p.setNoteOpen(true)} disabled={p.dataLocked}>
            + Dodaj uwagi do zamówienia
          </button>
        )}
        <label className="cv2-check">
          <input type="checkbox" checked={p.buyerDifferent} onChange={(event) => p.setBuyerDifferent(event.target.checked)} disabled={p.dataLocked} />
          <span>Inne dane kupującego / chcę fakturę</span>
        </label>
      </div>

      {p.buyerDifferent ? (
        <fieldset className="cv2-form cv2-buyer" disabled={p.dataLocked}>
          <button
            type="button"
            className="cv2-link is-wide"
            onClick={() =>
              p.setBuyer((current) => ({
                ...current,
                name: fullName.trim() || current.name,
                email: p.form.email || current.email,
                phone: p.form.phone || current.phone,
                street: p.form.address1 || current.street,
                postcode: p.form.postcode || current.postcode,
                city: p.form.city || current.city,
              }))
            }
          >
            Skopiuj dane z dostawy
          </button>
          <Field label="Imię i nazwisko / firma" fieldKey="buyerName" valid={p.valid.buyerName} error={p.fieldError("buyerName")} wide>
            <input value={p.buyer.name} onChange={(event) => p.setBuyer((current) => ({ ...current, name: event.target.value }))} />
          </Field>
          <Field label="E-mail" fieldKey="buyerEmail" valid={p.valid.buyerEmail} error={p.fieldError("buyerEmail")}>
            <input type="email" inputMode="email" value={p.buyer.email} onChange={(event) => p.setBuyer((current) => ({ ...current, email: event.target.value }))} />
          </Field>
          <Field label="Telefon">
            <input type="tel" inputMode="tel" value={p.buyer.phone} onChange={(event) => p.setBuyer((current) => ({ ...current, phone: event.target.value }))} />
          </Field>
          <Field label="Ulica i numer" wide>
            <input value={p.buyer.street} onChange={(event) => p.setBuyer((current) => ({ ...current, street: event.target.value }))} />
          </Field>
          <Field label="Kod pocztowy">
            <input inputMode="numeric" placeholder="00-000" value={p.buyer.postcode} onChange={(event) => p.setBuyer((current) => ({ ...current, postcode: event.target.value }))} />
          </Field>
          <Field label="Miasto">
            <input value={p.buyer.city} onChange={(event) => p.setBuyer((current) => ({ ...current, city: event.target.value }))} />
          </Field>
          <label className="cv2-check is-wide">
            <input type="checkbox" checked={p.wantsInvoice} onChange={(event) => p.setWantsInvoice(event.target.checked)} />
            <span>Chcę fakturę</span>
          </label>
          {p.wantsInvoice ? (
            <div className="cart-invoice-fields cv2-invoice is-wide">
              <Field label="NIP" fieldKey="nip" valid={p.valid.nip && !p.nipLookupLoading} error={p.fieldError("nip") || p.nipLookupError || undefined} wide>
                <input inputMode="numeric" value={p.invoice.nip} onChange={(event) => p.onNip(event.target.value.replace(/\D/g, "").slice(0, 10))} />
              </Field>
              <Field label="Nazwa firmy" fieldKey="companyName" valid={p.valid.companyName} error={p.fieldError("companyName")} wide>
                <input value={p.invoice.companyName} onChange={(event) => p.setInvoice((current) => ({ ...current, companyName: event.target.value }))} />
              </Field>
              <Field label="Ulica i numer" fieldKey="invoiceStreet" valid={p.valid.invoiceStreet} error={p.fieldError("invoiceStreet")} wide>
                <input value={p.invoice.street} onChange={(event) => p.setInvoice((current) => ({ ...current, street: event.target.value }))} />
              </Field>
              <Field label="Kod pocztowy" fieldKey="invoicePostcode" valid={p.valid.invoicePostcode} error={p.fieldError("invoicePostcode")}>
                <input value={p.invoice.postcode} onChange={(event) => p.setInvoice((current) => ({ ...current, postcode: event.target.value }))} />
              </Field>
              <Field label="Miasto" fieldKey="invoiceCity" valid={p.valid.invoiceCity} error={p.fieldError("invoiceCity")}>
                <input value={p.invoice.city} onChange={(event) => p.setInvoice((current) => ({ ...current, city: event.target.value }))} />
              </Field>
            </div>
          ) : null}
        </fieldset>
      ) : null}
    </div>
  );

  // ===== Ekran 3: płatność =====
  const screenPay = (
    <>
      <h1 className="cv2-q">{p.isCod ? "Potwierdź zamówienie" : "Jak płacisz?"}</h1>
      <div className="cv2-recap">
        <p>
          <strong>{fullName}</strong>
          {p.form.phone ? ` · ${p.form.phone}` : ""}
          <br />
          {activeDelivery ? activeDelivery.label : ""}
          {isPaczkomat && p.selectedPaczkomat ? `: ${p.selectedPaczkomat.id}` : ""}
          {p.requiresAddress ? `: ${p.form.address1}, ${p.form.postcode} ${p.form.city}` : ""}
        </p>
        {!p.dataLocked ? (
          <button type="button" className="cv2-link" onClick={goBack}>
            Zmień
          </button>
        ) : null}
      </div>
      <div className="cv2-pay">
        <p className="cv2-pay-due">
          Do zapłaty <strong>{formatPln(p.payableTotal)}</strong>
        </p>
        {/* Pasek zaufania pod kwotą (właściciel, 2026-10-03) - ten sam co
            w starym koszyku, żeby obie grupy testu go miały. */}
        <PaymentTrustTicker />
        {p.isCod ? p.codBlock : p.paymentChooser()}
      </div>
    </>
  );

  const barLabel = step === 0 ? "Zamawiam" : step === 1 ? "Dalej" : step === 2 ? "Dalej: płatność" : "";

  return (
    <div className={`cv2 cv2--step${step}${p.hasEscapeOffer ? " has-escape-offer" : ""}`}>
      <header className="cv2-top">
        {step > 0 ? (
          <button type="button" className="cv2-back" onClick={goBack} aria-label="Wróć do poprzedniego kroku">
            {ICON.back}
          </button>
        ) : (
          <Link href={p.backHref} className="cv2-back" aria-label="Wróć do sklepu">
            {ICON.back}
          </Link>
        )}
        <Link href="/" className="cv2-brand">
          keika
        </Link>
        <span className="cv2-top-secure">{ICON.lock} bezpieczne zamówienie</span>
      </header>
      <ol className="cv2-progress" aria-label="Kroki zamówienia">
        {STEP_LABELS.map((label, index) => (
          <li key={label} className={index < step ? "is-done" : index === step ? "is-now" : ""} aria-current={index === step ? "step" : undefined}>
            <i />
            <span>{label}</span>
          </li>
        ))}
      </ol>

      {step > 0 ? (
        <div className="cv2-mini">
          <button type="button" className="cv2-mini-toggle" onClick={() => setSummaryOpen((open) => !open)} aria-expanded={summaryOpen}>
            <span className="cv2-mini-thumbs">
              {p.items.slice(0, 3).map((item) => (
                <ItemVisual key={item.id} item={item} className="cv2-mini-thumb" />
              ))}
            </span>
            <span className="cv2-mini-copy">
              {p.itemsCount} {plural(p.itemsCount, "sztuka", "sztuki", "sztuk")} · <strong>{formatPln(p.payableTotal)}</strong>
            </span>
            <span className="cv2-mini-chevron" aria-hidden="true">
              {summaryOpen ? "▴" : "▾"}
            </span>
          </button>
          {summaryOpen ? (
            <div className="cv2-mini-body">
              {p.items.map((item) => (
                <div key={item.id} className="cv2-row">
                  <span>
                    {item.qty} × {item.productLabel}
                    {item.widthMm && item.heightMm ? ` ${item.widthMm / 10} × ${item.heightMm / 10} cm` : ""}
                  </span>
                  <span>{formatPln(item.total)}</span>
                </div>
              ))}
              {totalsRows}
              <div className="cv2-row is-total">
                <span>Do zapłaty</span>
                <span>{formatPln(p.payableTotal)}</span>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="cv2-screen" key={step} ref={screenRef}>
        {step === 0 ? screenOrder : step === 1 ? screenDelivery : step === 2 ? screenData : screenPay}
      </div>

      <p className="cv2-foot">
        {phoneHref ? (
          <>
            Pytania? Zadzwoń:{" "}
            <a href={phoneHref} onClick={() => p.track("cart_v2_phone", STEP_NAMES[step], {})}>
              {p.contactPhone}
            </a>
            <br />
          </>
        ) : null}
        Sprzedawca: KEIKA Renata Kisiel, ul. Kościuszki 21, 78-400 Szczecinek. <Link href="/regulamin">Regulamin</Link> ·{" "}
        <Link href="/legal/prywatnosc">Polityka prywatności</Link>
      </p>

      {/* Na ekranie płatności przycisk "Płacę" jest w panelu metody - pasek
          zasłaniałby go, więc zostaje tylko dla przelewu tradycyjnego. */}
      {step < 3 || p.transferReady ? (
      <div className="cv2-bar" role="region" aria-label="Podsumowanie zamówienia">
        {p.escapeChip}
        <div className="cv2-bar-total">
          <span>Do zapłaty</span>
          <strong>{formatPln(p.payableTotal)}</strong>
        </div>
        {step < 3 ? (
          <button type="button" className="cv2-bar-cta" onClick={advance}>
            {barLabel}
            {step === 0 ? <small>to potrwa minutę</small> : null}
          </button>
        ) : p.transferReady ? (
          <button type="button" className="cv2-bar-cta" disabled={p.isSubmitting} onClick={p.submitTransfer}>
            {p.isSubmitting ? "Zapisujemy…" : "Zamawiam (przelew)"}
          </button>
        ) : null}
      </div>
      ) : null}
    </div>
  );
}

/** Gdyby nowy koszyk się wywrócił, klient dostaje stary - zakup nie może
 * zależeć od testu. */
export class CartV2Boundary extends Component<{ onCrash: (message: string) => void; children: ReactNode }, { crashed: boolean }> {
  state = { crashed: false };
  static getDerivedStateFromError() {
    return { crashed: true };
  }
  componentDidCatch(error: unknown) {
    this.props.onCrash(error instanceof Error ? error.message : String(error));
  }
  render() {
    return this.state.crashed ? null : this.props.children;
  }
}
