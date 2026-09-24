// Raty Przelewy24 - wyliczenie oferty ratalnej pokazywanej przy każdej
// kwocie (koszyk, podsumowanie wyceny w konfiguratorze).
//
// Właściciel, 2026-09-24: "nie oferujemy rat 0% w chwili obecnej, więc zrób
// cenę jednorazową i pod spodem »lub x zł × Y rat«, domyślnie rozbite na 10
// rat z opcją zmiany". Rata liczona jest wzorem annuitetowym - tak samo
// liczy ją bank - z rocznego oprocentowania (RRSO) oferty ratalnej.
//
// UWAGA: RRSO to jedyna liczba, której nie da się pobrać z API Przelewy24
// (tam jest tylko informacja, że metoda "Raty" jest włączona). Domyślna
// wartość poniżej jest ostrożnym szacunkiem rynkowym; sklep bierze ją z
// ustawień CRM (checkout.p24_installments_apr_percent), gdy tylko właściciel
// wpisze tam realną stawkę ze swojej umowy. Dlatego w interfejsie rata jest
// zawsze podpisana jako orientacyjna, a wiążącą podaje bank we wniosku.
export const DEFAULT_INSTALLMENTS_APR_PERCENT = 19.9;

/** Liczby rat do wyboru; 10 jest domyślne (właściciel, 2026-09-24). */
export const INSTALLMENT_COUNTS = [3, 6, 10, 12, 20] as const;
export const DEFAULT_INSTALLMENT_COUNT = 10;

/** Poniżej tej kwoty banki nie rozkładają zakupu na raty. */
export const INSTALLMENTS_MIN_AMOUNT = 100;

/** Rata annuitetowa: stała miesięczna kwota przy danym oprocentowaniu. */
export function monthlyInstallment(amount: number, count: number, aprPercent = DEFAULT_INSTALLMENTS_APR_PERCENT): number {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(count) || count <= 0) return 0;
  const monthlyRate = Math.max(0, aprPercent) / 100 / 12;
  const raw = monthlyRate <= 0 ? amount / count : (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -count));
  return Math.round(raw * 100) / 100;
}

/** Całkowity koszt zakupu w ratach (do informacji obok raty). */
export function installmentsTotal(amount: number, count: number, aprPercent = DEFAULT_INSTALLMENTS_APR_PERCENT): number {
  return Math.round(monthlyInstallment(amount, count, aprPercent) * count * 100) / 100;
}

export function installmentsAvailable(amount: number): boolean {
  return Number.isFinite(amount) && amount >= INSTALLMENTS_MIN_AMOUNT;
}
