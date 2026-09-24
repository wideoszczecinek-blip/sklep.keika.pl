// Raty Przelewy24 - wyliczenie oferty ratalnej pokazywanej przy każdej
// kwocie (koszyk, podsumowanie wyceny w konfiguratorze).
//
// Właściciel, 2026-09-24: "nie oferujemy rat 0% w chwili obecnej, więc zrób
// cenę jednorazową i pod spodem »lub x zł × Y rat«, domyślnie rozbite na 10
// rat z opcją zmiany".
//
// SKĄD BIORĄ SIĘ LICZBY (sprawdzone 2026-09-24):
// Przelewy24 nie ma własnej tabeli rat - jest pośrednikiem, a kredytu
// udziela wybrana przez klienta organizacja finansująca (Santander Consumer
// Bank, Alior Bank, Smartney, Inbank); przelewy24.pl podaje tylko widełki
// 100-50 000 zł i 3-60 miesięcy, a w centrum pomocy wprost pisze, że koszt
// zależy od oferty instytucji finansującej. Dlatego liczymy ratę
// oprocentowaniem z AKTUALNEGO PRZYKŁADU REPREZENTATYWNEGO Santander
// Consumer Banku dla zakupów w sklepach internetowych (e-raty) - to ten sam
// bank, który stoi za Przelewy24 Raty. Kontrola: wzór annuitetowy poniżej
// odtwarza ratę z tego przykładu (2 600 zł, 11 mies., 10,84% -> 249,35 zł
// wobec 249,37 zł w przykładzie banku), więc liczymy tak samo jak bank.
//
// UWAGA: raty liczy się STOPĄ OPROCENTOWANIA (10,84%), nie RRSO (11,40%) -
// RRSO jest wartością wynikową, podawaną klientowi w przykładzie.
// Gdy właściciel wpisze w CRM stawkę ze swojej umowy
// (checkout.p24_installments_apr_percent), sklep policzy nią.
export const DEFAULT_INSTALLMENTS_APR_PERCENT = 10.84;

/** Przykład reprezentatywny - obowiązkowy, gdy przy reklamie kredytu padają
 * konkretne kwoty. Cytat dosłowny ze strony Santander Consumer Banku
 * (e-raty w sklepie internetowym), stan na 17.08.2026. */
export const INSTALLMENTS_REPRESENTATIVE_EXAMPLE =
  "Przykład reprezentatywny z 17.08.2026 r. dla kredytu na zakup towarów udzielanego przez Santander Consumer Bank S.A.: " +
  "cena towaru 2 600 zł, stała stopa oprocentowania kredytu: 10,84%, całkowity koszt kredytu: 143,03 zł " +
  "(prowizja: 0 zł, odsetki: 143,03 zł), Rzeczywista Roczna Stopa Oprocentowania (RRSO) 11,40%, " +
  "całkowita kwota kredytu (bez kredytowanych kosztów): 2 600 zł, czas obowiązywania umowy: 11 miesięcy, " +
  "całkowita kwota do zapłaty: 2 743,03 zł, wysokość 10 miesięcznych równych rat: 249,37 zł, " +
  "wysokość ostatniej 11. raty korygującej: 249,33 zł.";

/** Liczby rat zgodne z wariantami Przelewy24 Raty (5/10/20/30...);
 * 10 domyślnie (właściciel, 2026-09-24). */
export const INSTALLMENT_COUNTS = [5, 10, 20, 30] as const;
export const DEFAULT_INSTALLMENT_COUNT = 10;

/** Widełki Przelewy24 Raty: od 100 zł do 50 000 zł. */
export const INSTALLMENTS_MIN_AMOUNT = 100;
export const INSTALLMENTS_MAX_AMOUNT = 50000;

/** Rata annuitetowa: stała miesięczna kwota przy danym oprocentowaniu -
 * dokładnie tak liczy ją bank (patrz kontrola w komentarzu wyżej). */
export function monthlyInstallment(amount: number, count: number, aprPercent = DEFAULT_INSTALLMENTS_APR_PERCENT): number {
  if (!Number.isFinite(amount) || amount <= 0 || !Number.isFinite(count) || count <= 0) return 0;
  const monthlyRate = Math.max(0, aprPercent) / 100 / 12;
  const raw = monthlyRate <= 0 ? amount / count : (amount * monthlyRate) / (1 - Math.pow(1 + monthlyRate, -count));
  return Math.round(raw * 100) / 100;
}

/** Całkowita kwota do zapłaty w ratach (do informacji obok raty). */
export function installmentsTotal(amount: number, count: number, aprPercent = DEFAULT_INSTALLMENTS_APR_PERCENT): number {
  return Math.round(monthlyInstallment(amount, count, aprPercent) * count * 100) / 100;
}

/** Liczba rat, przy której rata wygląda sensownie w zajawce na stronie
 * produktu: celujemy w 20-50 zł miesięcznie (właściciel, 2026-09-24).
 * Zasada: najkrótszy okres, który mieści się w widełkach; jeśli żaden nie
 * mieści się od dołu (drogi produkt) - najdłuższy dostępny; jeśli wszystkie
 * raty są niższe niż widełki (tani produkt) - najkrótszy, żeby nie kusić
 * ratą 8 zł rozłożoną na trzy lata. */
export function pickFriendlyInstallmentCount(
  amount: number,
  aprPercent = DEFAULT_INSTALLMENTS_APR_PERCENT,
  minMonthly = 20,
  maxMonthly = 50,
): number {
  const candidates = INSTALLMENT_COUNTS.map((count) => ({ count, monthly: monthlyInstallment(amount, count, aprPercent) }));
  const inRange = candidates.filter((entry) => entry.monthly >= minMonthly && entry.monthly <= maxMonthly);
  if (inRange.length) return inRange[0].count;
  const affordable = candidates.filter((entry) => entry.monthly <= maxMonthly);
  if (affordable.length) return affordable[0].count;
  return candidates[candidates.length - 1].count;
}

export function installmentsAvailable(amount: number): boolean {
  return Number.isFinite(amount) && amount >= INSTALLMENTS_MIN_AMOUNT && amount <= INSTALLMENTS_MAX_AMOUNT;
}
