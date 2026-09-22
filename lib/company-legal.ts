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

// Stała lista bez Przelewy24 - metody P24 (przelew online / raty / PayPo)
// dokleja paymentMethodsLabel() wg flag z CRM (site.checkout.p24_*), żeby
// stopka nigdy nie obiecywała rat/PayPo, których konto P24 jeszcze nie ma.
export const PAYMENT_METHODS_LABEL = "BLIK, karta płatnicza (Visa, Mastercard), Revolut Pay, przelew tradycyjny, płatność za pobraniem";
export const PAYMENT_OPERATORS_LABEL = "Stripe oraz Przelewy24 (PayPro S.A.)";

export function paymentMethodsLabel(flags?: {
  p24_transfer_enabled?: boolean;
  p24_installments_enabled?: boolean;
  p24_paypo_enabled?: boolean;
} | null): string {
  const p24: string[] = [];
  if (flags?.p24_transfer_enabled) p24.push("przelew online");
  if (flags?.p24_installments_enabled) p24.push("raty");
  if (flags?.p24_paypo_enabled) p24.push("PayPo");
  const base = "BLIK, karta płatnicza (Visa, Mastercard), Revolut Pay";
  const tail = "przelew tradycyjny, płatność za pobraniem";
  return p24.length ? `${base}, ${p24.join(", ")} (Przelewy24), ${tail}` : `${base}, ${tail}`;
}

export function paymentOperatorsLabel(flags?: { p24_enabled?: boolean } | null): string {
  return flags?.p24_enabled ? PAYMENT_OPERATORS_LABEL : "Stripe";
}
export const DELIVERY_METHODS_LABEL = "kurier, Paczkomat InPost, odbiór osobisty w Szczecinku";
