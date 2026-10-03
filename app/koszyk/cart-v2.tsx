"use client";

// Nowy koszyk (test 50/50 od 2026-10-04, lib/cart-design.ts). Sama warstwa
// widoku: stan, walidacja, zamówienie i płatności żyją w app/koszyk/page.tsx
// i są wspólne ze starym koszykiem - tu przychodzą jako props.
//
// Na czym stoi układ (dane sklepu + badania rynku, nie gust):
//  - 65% wchodzących do koszyka nie zaczynało formularza, 61% wychodziło
//    w 30 s -> pierwszy ekran to kwota do zapłaty z dostawą, zaufanie i jedno
//    wyraźne "Zamawiam", a pozycje zajmują po jednej zwartej linii;
//  - liczba pól waży więcej niż liczba kroków (Baymard 2024) -> jedno pole
//    "Imię i nazwisko" zamiast dwóch, uwagi i faktura za linkami;
//  - jedna strona, ale widać tylko następny ruch (Shopify 2023) -> dwa
//    kroki: dane, potem płatność; ukończony krok zwija się do podsumowania;
//  - BLIK pierwszy i od razu otwarty (Stripe 2025: +46% dla polskich
//    klientów; u nas 9 na 10 płatności) -> zaznaczany przy wejściu w krok 2;
//  - kasa bez nawigacji sklepu, przycisk mówi, co się stanie po kliknięciu.
import Link from "next/link";
import { Component, useEffect, useRef, useState, type Dispatch, type FocusEvent, type ReactNode, type SetStateAction } from "react";
import { formatPln, type CartLineItem } from "@/lib/cart";
import CartWindowThumb, { resolveCartWindowThumb } from "@/app/components/cart-window-thumb";
import PaymentTrustTicker from "@/app/components/payment-trust-ticker";
import PlisaPreview from "@/features/plisy/PlisaPreview";
import PlisaDachowaPreview from "@/features/plisy-dachowe/PlisaDachowaPreview";
import PaczkomatPicker from "@/app/components/paczkomat-picker";
import InstallmentOffer from "@/app/components/installment-offer";
import type { PaczkomatPoint } from "../api/paczkomaty/route";
import { ALLEGRO_RATING_SNAPSHOTS } from "@/lib/landing-snapshot";

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

function ItemThumb({ item }: { item: CartLineItem }) {
  if (resolveCartWindowThumb(item)) {
    return (
      <div className="cv2-item-thumb">
        <CartWindowThumb item={item} label={`${item.productLabel} na oknie, w wybranych kolorach`} />
      </div>
    );
  }
  if (item.productSlug === "plisy" && item.fabricColor) {
    return (
      <div className="cv2-item-thumb is-plisa">
        <PlisaPreview fabricColor={item.fabricColor} hardwareColor={item.hardwareColor || ""} />
      </div>
    );
  }
  if (item.productSlug === "plisy-dachowe" && item.fabricColor) {
    return (
      <div className="cv2-item-thumb is-plisa">
        <PlisaDachowaPreview fabricColor={item.fabricColor} hardwareColor={item.hardwareColor || ""} />
      </div>
    );
  }
  return <div className="cv2-item-thumb" style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined} />;
}

const IconLock = (
  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <rect x="4.5" y="10.5" width="15" height="10" rx="2.2" stroke="currentColor" strokeWidth="1.8" />
    <path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
  </svg>
);

export default function CartV2(props: CartV2Props) {
  const p = props;
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({});
  // Krok 2 (płatność) otwiera się po "Dalej" albo od razu, gdy dane są już
  // komplet (powrót z bramki, zapamiętany formularz).
  const [step, setStep] = useState<1 | 2>(1);
  const initialStepRef = useRef(false);
  useEffect(() => {
    if (initialStepRef.current) return;
    initialStepRef.current = true;
    if (p.deliveryDataReady) setStep(2);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const dataOpen = step === 1 || !p.deliveryDataReady;
  const payOpen = !dataOpen;
  const dataRef = useRef<HTMLElement | null>(null);
  const payRef = useRef<HTMLElement | null>(null);

  // BLIK zaznaczony przy wejściu w płatność (bez zdarzenia "wybrał metodę" -
  // to nasz wybór, nie klienta).
  const blikPreselectedRef = useRef(false);
  useEffect(() => {
    if (!payOpen || blikPreselectedRef.current) return;
    blikPreselectedRef.current = true;
    if (!p.isCod && p.onlinePaymentKind === "" && p.hasBlikTile && !p.hasOrderDraft) p.preselectPaymentKind("blik");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payOpen]);

  const goToPayment = () => {
    if (!p.deliveryDataReady) {
      p.jumpToFirstProblem();
      return;
    }
    setStep(2);
    p.track("checkout_next", "platnosc", { design: "v2" });
    window.setTimeout(() => payRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 60);
  };
  const startForm = () => {
    setStep(1);
    window.setTimeout(() => {
      dataRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      const input = dataRef.current?.querySelector<HTMLInputElement>(".cv2-form input:not([type=radio]):not([type=checkbox])");
      if (input) window.setTimeout(() => input.focus({ preventScroll: true }), 450);
    }, 30);
    p.track("cart_v2_start", "sticky", {});
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

  const activeDelivery = p.deliveryMethods.find((method) => method.id === p.deliveryMethod) || null;
  const isPaczkomat = p.deliveryMethod === p.paczkomatMethodId;
  const phoneHref = p.contactPhone ? `tel:${p.contactPhone.replace(/\s+/g, "")}` : "";

  const orderCard = (
    <section className="cv2-card cv2-order" aria-label="Twoje zamówienie">
      <div className="cv2-order-head">
        <h1>Twoje zamówienie</h1>
        <span>
          {p.itemsCount} {plural(p.itemsCount, "sztuka", "sztuki", "sztuk")}
        </span>
      </div>
      <ul className="cv2-items">
        {p.items.map((item) => {
          const labels = p.itemFieldLabels(item.productSlug);
          const open = Boolean(detailsOpen[item.id]);
          const size = item.widthMm && item.heightMm ? `${item.widthMm / 10} × ${item.heightMm / 10} cm` : "";
          const unit = p.combinedDiscountPercent > 0 ? item.price * (1 - p.combinedDiscountPercent / 100) : item.price;
          const line = p.combinedDiscountPercent > 0 ? item.total * (1 - p.combinedDiscountPercent / 100) : item.total;
          return (
            <li key={item.id} className="cv2-item">
              <ItemThumb item={item} />
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
                  Szerokość powyżej {(item.sagLimitMm || 1100) / 10} cm: profil aluminiowy może się lekko ugiąć pod ciężarem tkaniny. To naturalne — nie
                  wpływa na działanie plisy, jedynie na estetykę.
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
      {!p.dataLocked ? (
        <Link href={p.backHref} className="cv2-add-more">
          + Dodaj kolejną pozycję
        </Link>
      ) : null}

      <div className="cv2-totals">
        {p.combinedSavings > 0 ? (
          <div className="cv2-row">
            <span>Wspólne rozliczenie obwodu moskitier</span>
            <span>-{formatPln(p.combinedSavings)}</span>
          </div>
        ) : null}
        {p.appliedDiscount ? (
          <div className="cv2-row is-discount">
            <span>
              Rabat {p.appliedDiscount.code}
              {p.appliedDiscount.type === "percent" ? ` -${p.appliedDiscount.value.toLocaleString("pl-PL")}%` : ""}
              <button type="button" className="cv2-link" onClick={p.removeDiscountCode}>
                usuń
              </button>
            </span>
            <span>-{formatPln(p.appliedDiscount.amount)}</span>
          </div>
        ) : null}
        {p.rescueRow ? (
          <div className="cv2-row is-discount">
            <span>{p.rescueRow.label}</span>
            <span>-{formatPln(p.rescueRow.amount)}</span>
          </div>
        ) : null}
        {!p.isPickup ? (
          <div className="cv2-row">
            <span>Dostawa kurierem</span>
            <span className={p.shippingFee > 0 ? "" : "is-free"}>{p.shippingFee > 0 ? formatPln(p.shippingFee) : "0 zł"}</span>
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
        <div className="cv2-total">
          <span className="cv2-total-label">
            Do zapłaty
            <small>z dostawą, bez ukrytych kosztów</small>
          </span>
          <span className="cv2-total-value">
            {p.totalSavings > 0 ? <s>{formatPln(p.payableTotal + p.totalSavings)}</s> : null}
            <strong>{formatPln(p.payableTotal)}</strong>
          </span>
        </div>
        {p.totalSavings > 0 ? <p className="cv2-savings">Oszczędzasz {formatPln(p.totalSavings)}</p> : null}
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
  );

  const trust = (
    <ul className="cv2-trust" aria-label="Dlaczego warto zamówić">
      {score ? (
        <li>
          <b>★ {score}/5</b>
          <span>{responses ? `${responses} opinii kupujących` : "ocena kupujących"}</span>
        </li>
      ) : null}
      <li>
        <b>5 lat gwarancji</b>
        <span>producent od 2015 roku</span>
      </li>
      <li>
        <b>30 dni na zwrot</b>
        <span>odsyłasz, jeśli coś nie zagra</span>
      </li>
    </ul>
  );

  const dataSummary = (
    <div className="cv2-done">
      <p>
        <strong>{fullName}</strong>
        {p.form.phone ? ` · ${p.form.phone}` : ""}
        <br />
        {p.form.email}
        <br />
        {activeDelivery ? activeDelivery.label : ""}
        {isPaczkomat && p.selectedPaczkomat ? `: ${p.selectedPaczkomat.id}` : ""}
        {p.requiresAddress ? `: ${p.form.address1}, ${p.form.postcode} ${p.form.city}` : ""}
      </p>
      {!p.dataLocked ? (
        <button type="button" className="cv2-link" onClick={() => setStep(1)}>
          Zmień
        </button>
      ) : null}
    </div>
  );

  const dataStep = (
    <section className={`cv2-card cv2-step${dataOpen ? " is-open" : " is-done"}`} ref={dataRef}>
      <h2>
        <span className="cv2-step-no">{dataOpen ? "1" : "✓"}</span>
        Dostawa i dane
      </h2>
      {!dataOpen ? (
        dataSummary
      ) : (
        <div onBlurCapture={p.onFieldBlur}>
          <div className="cv2-options" role="radiogroup" aria-label="Sposób dostawy">
            {p.deliveryMethods.map((method) => {
              const active = p.deliveryMethod === method.id;
              return (
                <label key={method.id} className={`cv2-option${active ? " is-active" : ""}`}>
                  <input type="radio" name="delivery-method" value={method.id} checked={active} onChange={() => p.chooseDelivery(method)} disabled={p.dataLocked} />
                  <span className="cv2-option-copy">
                    <strong>{method.label}</strong>
                    <small>{method.description}</small>
                  </span>
                  <span className={`cv2-option-price${method.extraFee ? "" : " is-free"}`}>{method.extraFee ? `+${formatPln(method.extraFee)}` : "0 zł"}</span>
                </label>
              );
            })}
          </div>

          {p.expressEligible ? (
            <div className="cv2-options cv2-dispatch" role="radiogroup" aria-label="Termin realizacji">
              <label className={`cv2-option${!p.expressSelected ? " is-active" : ""}`}>
                <input type="radio" name="dispatch-speed" value="standard" checked={!p.expressSelected} onChange={() => p.chooseExpress(false)} disabled={p.dataLocked} />
                <span className="cv2-option-copy">
                  <strong>Standard</strong>
                  <small>{p.dispatchStandardLabel ? `Wysyłka ${p.dispatchStandardLabel}` : "Wysyłka zwykle w 3 dni robocze"}</small>
                </span>
                <span className="cv2-option-price is-free">0 zł</span>
              </label>
              <label className={`cv2-option${p.expressSelected ? " is-active" : ""}`}>
                <input type="radio" name="dispatch-speed" value="express" checked={p.expressSelected} onChange={() => p.chooseExpress(true)} disabled={p.dataLocked} />
                <span className="cv2-option-copy">
                  <strong>Ekspres - priorytet produkcji</strong>
                  <small>
                    Wysyłka {p.dispatchExpressLabel || "jutro"}. Do {p.dispatchCutoffLabel || "12:00"} w dzień roboczy wysyłamy tego samego dnia.
                  </small>
                </span>
                <span className="cv2-option-price">+{formatPln(p.expressFeeAmount)}</span>
              </label>
            </div>
          ) : p.plisyLeadTime ? (
            <p className="cv2-lead-time">Wysyłka w 5–7 dni roboczych.</p>
          ) : null}

          {isPaczkomat ? (
            <div data-checkout-field="paczkomat" className="cv2-paczkomat">
              <PaczkomatPicker value={p.selectedPaczkomat} onChange={p.choosePaczkomat} />
            </div>
          ) : null}

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

          <button type="button" className="cv2-cta" onClick={goToPayment}>
            Dalej: płatność
          </button>
        </div>
      )}
    </section>
  );

  const payStep = (
    <section className={`cv2-card cv2-step cv2-pay${payOpen ? " is-open" : " is-locked"}`} ref={payRef}>
      <h2>
        <span className="cv2-step-no">2</span>
        Płatność
        <span className="cv2-secure">{IconLock} bezpieczna</span>
      </h2>
      {payOpen ? (
        <>
          <p className="cv2-pay-due">
            Do zapłaty <strong>{formatPln(p.payableTotal)}</strong>
          </p>
          {/* Pasek zaufania pod kwotą (właściciel, 2026-10-03) - ten sam co
              w starym koszyku, żeby obie grupy testu go miały. */}
          <PaymentTrustTicker />
          {p.isCod ? p.codBlock : p.paymentChooser()}
        </>
      ) : (
        <p className="cv2-pay-locked">BLIK, przelew online, karta, PayPo albo płatność przy odbiorze. Wybierzesz po podaniu danych.</p>
      )}
    </section>
  );

  return (
    <div className={`cv2${p.hasEscapeOffer ? " has-escape-offer" : ""}`}>
      <header className="cv2-top">
        <Link href="/" className="cv2-brand">
          keika
        </Link>
        <span className="cv2-top-secure">{IconLock} Bezpieczne zamówienie</span>
        {phoneHref ? (
          <a className="cv2-top-phone" href={phoneHref} onClick={() => p.track("cart_v2_phone", "top", {})}>
            {p.contactPhone}
          </a>
        ) : null}
      </header>

      <div className="cv2-layout">
        <div className="cv2-col-order">
          {orderCard}
          {trust}
        </div>
        <div className="cv2-col-steps">
          {dataStep}
          {payStep}
          <div ref={p.escapeBottomRef} className="escape-offer-sentinel" aria-hidden="true" />
          <p className="cv2-foot">
            Sprzedawca: KEIKA Renata Kisiel, ul. Kościuszki 21, 78-400 Szczecinek.{" "}
            <Link href="/regulamin">Regulamin</Link> · <Link href="/legal/prywatnosc">Polityka prywatności</Link>
          </p>
        </div>
      </div>

      <div className="cv2-bar" role="region" aria-label="Podsumowanie zamówienia">
        {p.escapeChip}
        <div className="cv2-bar-total">
          <span>Do zapłaty</span>
          <strong>{formatPln(p.payableTotal)}</strong>
        </div>
        {!p.deliveryDataReady ? (
          <button type="button" className="cv2-bar-cta" onClick={() => (p.contactUntouched ? startForm() : p.jumpToFirstProblem())}>
            {p.contactUntouched ? "Zamawiam" : "Dalej"}
          </button>
        ) : dataOpen ? (
          <button type="button" className="cv2-bar-cta" onClick={goToPayment}>
            Do płatności
          </button>
        ) : p.transferReady ? (
          <button type="button" className="cv2-bar-cta" disabled={p.isSubmitting} onClick={p.submitTransfer}>
            {p.isSubmitting ? "Zapisujemy…" : "Zamawiam (przelew)"}
          </button>
        ) : (
          <button type="button" className="cv2-bar-cta is-quiet" onClick={() => payRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })}>
            Płatność ↓
          </button>
        )}
      </div>
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
