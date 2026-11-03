// Dane rejestrowe sprzedawcy pokazywane w stopce każdej strony sklepu.
// Te same dane stoją w §1 regulaminu (CRM → Sklep WWW → strony formalne).
// Stripe / Przelewy24 wymagają, żeby dane firmy, cennik oraz linki do
// polityki zwrotów i prywatności były publicznie widoczne na stronie -
// bez tego metoda P24 jest oznaczana jako "Ineligible" (2026-09-21).
export const COMPANY_LEGAL = {
  brand: "KEIKA",
  legalName: "KEIKA Renata Kisiel",
  legalForm: "działalność gospodarcza wpisana do CEIDG",
  street: "ul. Kościuszki 21",
  postalCode: "78-400",
  city: "Szczecinek",
  country: "Polska",
  nip: "6731828521",
  regon: "364249690",
  phone: "+48 790 215 251",
  phoneHref: "tel:+48790215251",
  email: "biuro@keika.pl",
  hours: "pon.–sb. 8:00–21:00",
  producingSince: 2015,
} as const;

export const FOOTER_LINKS = [
  { href: "/regulamin", label: "Regulamin sklepu" },
  { href: "/legal/prywatnosc", label: "Polityka prywatności" },
  { href: "/legal/reklamacje", label: "Reklamacje i zwroty" },
  { href: "/legal/dostawa-i-platnosc", label: "Dostawa i płatność" },
  { href: "/legal/cookies", label: "Polityka cookies" },
  { href: "/kontakt", label: "Kontakt" },
  { href: "/o-nas", label: "O nas" },
  { href: "/moje-zamowienia", label: "Moje zamówienia" },
] as const;

// Metody i operatorzy płatności (3.11: stopka mówiła „Operator płatności: Stripe”, a BLIK, przelew online i PayPo
// idą przez PayNow - ujednolicone wg ustawień sklepu w CRM, site.checkout.payment_routing). Do czasu odpowiedzi
// CRM - stan z 3.11.2026 (BLIK, przelew, PayPo: PayNow; karta i portfele: Stripe; raty: Przelewy24).
export const PAYMENT_METHODS_LABEL = "BLIK, karta płatnicza (Visa, Mastercard), Revolut Pay, przelew online, raty, PayPo, przelew tradycyjny, płatność za pobraniem";
export const PAYMENT_OPERATORS_LABEL = "PayNow (mBank), Stripe oraz Przelewy24 (PayPro S.A.)";

export type PaymentFlags = {
  p24_enabled?: boolean;
  p24_transfer_enabled?: boolean;
  p24_installments_enabled?: boolean;
  p24_paypo_enabled?: boolean;
  payment_routing?: Record<string, { enabled?: boolean; provider?: string } | undefined>;
};

const OPERATORZY: [string, string][] = [
  ["paynow", "PayNow (mBank)"],
  ["stripe", "Stripe"],
  ["p24", "Przelewy24 (PayPro S.A.)"],
];

export function paymentMethodsLabel(flags?: PaymentFlags | null): string {
  if (!flags) return PAYMENT_METHODS_LABEL;
  const r = flags.payment_routing || {};
  const base = "BLIK, karta płatnicza (Visa, Mastercard), Revolut Pay";
  const tail = "przelew tradycyjny, płatność za pobraniem";
  const extra: string[] = [];
  if (Object.keys(r).length) {
    if (r.transfer?.enabled) extra.push("przelew online");
    if (r.installments?.enabled) extra.push("raty");
    if (r.paypo?.enabled) extra.push("PayPo");
  } else {
    if (flags.p24_transfer_enabled) extra.push("przelew online");
    if (flags.p24_installments_enabled) extra.push("raty");
    if (flags.p24_paypo_enabled) extra.push("PayPo");
  }
  return [base, ...extra, tail].join(", ");
}

export function paymentOperatorsLabel(flags?: PaymentFlags | null): string {
  if (!flags) return PAYMENT_OPERATORS_LABEL;
  const r = flags.payment_routing || {};
  const uzyte = new Set<string>();
  for (const v of Object.values(r)) if (v?.enabled && v.provider) uzyte.add(v.provider);
  // raty bez wskazanego dostawcy = Przelewy24 (tylko tam są raty); bez routingu - dawna reguła
  if ((r.installments?.enabled && !r.installments.provider && flags.p24_enabled) || (!Object.keys(r).length && flags.p24_enabled)) uzyte.add("p24");
  if (!Object.keys(r).length) uzyte.add("stripe");
  const lista = OPERATORZY.filter(([id]) => uzyte.has(id)).map(([, nazwa]) => nazwa);
  if (!lista.length) return "Stripe";
  return lista.length === 1 ? lista[0] : `${lista.slice(0, -1).join(", ")} oraz ${lista[lista.length - 1]}`;
}
export const DELIVERY_METHODS_LABEL = "kurier, Paczkomat InPost, odbiór osobisty w Szczecinku";
