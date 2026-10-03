/**
 * Treści stron po zakupie (2026-10-03) - edytowane w CRM: Sklep WWW → Strony,
 * przychodzą z /biuro/api/shop-public/site jako `pages`.
 *
 * Właściciel: "chcę dopieścić strony, które klient widzi po zakupie (...)
 * mocno postawić na komunikację z klientem i jakość obsługi". Dlatego każdy
 * stan zamówienia ma własny nagłówek, tekst i kroki "co dalej", a nie jeden
 * wspólny komunikat.
 *
 * Domyślne poniżej to kopia domyślnych z CRM (_cms.php ->
 * shop_public_v2_post_purchase_defaults) - używane tylko wtedy, gdy CRM nie
 * odpowie, żeby strona po płatności nigdy nie została bez treści.
 */
import type { PublicOrder } from "@/lib/shop-public";

export type PostPurchaseStateKey =
  | "paid_now"
  | "paid"
  | "waiting"
  | "timed_out"
  | "transfer_pending"
  | "cod"
  | "cancelled"
  | "failed"
  | "unpaid";

export type PostPurchaseStep = { label: string; note: string };
export type PostPurchaseState = { title: string; text: string; steps: PostPurchaseStep[] };
export type PostPurchasePages = {
  states: Record<PostPurchaseStateKey, PostPurchaseState>;
  contact: { title: string; text: string };
  my_orders: { title: string; text: string; empty_text: string };
};

const PRODUCTION_STEPS: PostPurchaseStep[] = [
  { label: "Sprawdzamy zamówienie", note: "W ciągu kilku godzin roboczych zerkamy na wymiary i kolory. Jeśli coś budzi wątpliwość, dzwonimy - nie produkujemy w ciemno." },
  { label: "Produkcja", note: "Robimy to pod Twój wymiar, u siebie. Gdy zlecenie trafi na halę, dostaniesz e-mail." },
  { label: "Wysyłka", note: "Po nadaniu paczki wyślemy numer do śledzenia. Paczkę pakujemy tak, żeby profil nie miał prawa się wygiąć." },
];

export const POST_PURCHASE_DEFAULTS: PostPurchasePages = {
  states: {
    paid_now: {
      title: "Dziękujemy, płatność doszła",
      text: "Potwierdzenie jest już w Twojej skrzynce. Zamówienie idzie do realizacji - o każdym kolejnym kroku damy znać e-mailem.",
      steps: PRODUCTION_STEPS,
    },
    paid: {
      title: "Zamówienie opłacone",
      text: "Status: {{status}}. Wszystko, co wiemy o Twoim zamówieniu, masz poniżej - tę stronę możesz otwierać, ile razy chcesz.",
      steps: PRODUCTION_STEPS,
    },
    waiting: { title: "Sprawdzamy płatność…", text: "Zwykle trwa to kilka sekund. Nie zamykaj tej strony.", steps: [] },
    timed_out: {
      title: "Nie mamy jeszcze potwierdzenia z banku",
      text: "Jeśli zatwierdziłeś płatność, zaksięgujemy ją sami, gdy bank ją potwierdzi, i wyślemy e-mail. Nie płać drugi raz. Jeśli niczego nie zatwierdziłeś, wybierz metodę poniżej.",
      steps: [],
    },
    transfer_pending: {
      title: "Czekamy na Twój przelew",
      text: "Dane do przelewu masz poniżej. W tytule wpisz numer zamówienia - wtedy wpłata przypisze się od razu. Po zaksięgowaniu przekazujemy zamówienie do produkcji i piszemy do Ciebie.",
      steps: [
        { label: "Przelew", note: "Księgowanie trwa zwykle do 2 dni roboczych. Gdy wpłata dotrze, dostaniesz e-mail." },
        { label: "Produkcja", note: "Robimy to pod Twój wymiar, u siebie. Gdy zlecenie trafi na halę, dostaniesz e-mail." },
        { label: "Wysyłka", note: "Po nadaniu paczki wyślemy numer do śledzenia." },
      ],
    },
    cod: {
      title: "Zamówienie przyjęte, zapłacisz kurierowi",
      text: "Kurier pobierze {{amount}} przy dostawie - gotówką albo kartą. Nic nie musisz teraz robić.",
      steps: PRODUCTION_STEPS,
    },
    cancelled: {
      title: "Zamówienie anulowane",
      text: "To zamówienie zostało anulowane. Jeśli to pomyłka, zadzwoń - przywrócimy je w minutę.",
      steps: [],
    },
    failed: {
      title: "Płatność nie przeszła",
      text: "Nic nie zostało pobrane. Zamówienie jest zapisane, a cena się nie zmieniła - spróbuj jeszcze raz tą samą albo inną metodą. Jeśli bank odrzuca płatność, zadzwoń do nas, znajdziemy sposób.",
      steps: [],
    },
    unpaid: {
      title: "Zostało tylko opłacić zamówienie",
      text: "Wszystko jest zapisane. Po opłaceniu przekazujemy zamówienie do produkcji.",
      steps: [],
    },
  },
  contact: {
    title: "Masz pytanie? Jesteśmy tu",
    text: "Zadzwoń albo napisz - odpowiada człowiek, który zna Twoje zamówienie. Przy telefonie podaj numer zamówienia, od razu je znajdziemy.",
  },
  my_orders: {
    title: "Moje zamówienia",
    text: "Tu widzisz każde swoje zamówienie: na jakim jest etapie, kiedy wyjdzie i gdzie jest paczka.",
    empty_text: "Nie mamy jeszcze zamówienia pod tym numerem telefonu. Jeśli zamawiałeś, sprawdź, czy to ten sam numer, który podałeś w koszyku - albo zadzwoń, znajdziemy je.",
  },
};

/** Scala odpowiedź CRM z domyślnymi - brakujące pole nigdy nie zostawia
 * pustego nagłówka. */
export function normalizePostPurchasePages(raw: unknown): PostPurchasePages {
  const src = raw && typeof raw === "object" ? (raw as Partial<PostPurchasePages>) : {};
  const states = { ...POST_PURCHASE_DEFAULTS.states };
  const rawStates = src.states && typeof src.states === "object" ? (src.states as Record<string, Partial<PostPurchaseState>>) : {};
  (Object.keys(states) as PostPurchaseStateKey[]).forEach((key) => {
    const s = rawStates[key];
    if (!s) return;
    states[key] = {
      title: typeof s.title === "string" && s.title.trim() ? s.title : states[key].title,
      text: typeof s.text === "string" && s.text.trim() ? s.text : states[key].text,
      steps: Array.isArray(s.steps)
        ? s.steps
            .filter((st): st is PostPurchaseStep => Boolean(st) && typeof st.label === "string" && st.label.trim() !== "")
            .map((st) => ({ label: st.label, note: typeof st.note === "string" ? st.note : "" }))
        : states[key].steps,
    };
  });
  const pick = (value: unknown, fallback: string) => (typeof value === "string" && value.trim() ? value : fallback);
  return {
    states,
    contact: {
      title: pick(src.contact?.title, POST_PURCHASE_DEFAULTS.contact.title),
      text: pick(src.contact?.text, POST_PURCHASE_DEFAULTS.contact.text),
    },
    my_orders: {
      title: pick(src.my_orders?.title, POST_PURCHASE_DEFAULTS.my_orders.title),
      text: pick(src.my_orders?.text, POST_PURCHASE_DEFAULTS.my_orders.text),
      empty_text: pick(src.my_orders?.empty_text, POST_PURCHASE_DEFAULTS.my_orders.empty_text),
    },
  };
}

/** Podstawienia {{amount}} / {{status}} / {{phone}} w treściach z CRM. */
export function fillPostPurchaseText(text: string, vars: { amount?: string; status?: string; phone?: string }): string {
  return text
    .replace(/\{\{\s*amount\s*\}\}/g, vars.amount || "")
    .replace(/\{\{\s*status\s*\}\}/g, vars.status || "")
    .replace(/\{\{\s*phone\s*\}\}/g, vars.phone || "");
}

export const POST_PURCHASE_EXAMPLE_CODE = "przyklad";

/** Sztuczne zamówienie do stron przykładowych (/zamowienie/przyklad?stan=…),
 * które właściciel otwiera z CRM, żeby zobaczyć każdy stan bez prawdziwej
 * transakcji. Nigdy nie trafia do CRM - żyje tylko w przeglądarce. */
export function examplePostPurchaseOrder(state: PostPurchaseStateKey): PublicOrder {
  const paid = state === "paid_now" || state === "paid";
  const shipped = state === "paid";
  return {
    order_code: "ZPRZYKLAD01",
    quote_code: "",
    product_slug: "moskitiery-ramkowe",
    product_label: "Moskitiera ramkowa",
    status: state === "cancelled" ? "cancelled" : paid || state === "cod" ? "confirmed" : "draft",
    friendly_status: state === "cancelled" ? "Anulowane" : shipped ? "Wysłane" : paid || state === "cod" ? "W realizacji" : "Otrzymane - oczekuje na weryfikację",
    payment_provider: state === "cod" ? "cod" : state === "transfer_pending" ? "transfer" : "stripe",
    payment_status: paid
      ? "paid"
      : state === "failed"
        ? "failed"
        : state === "transfer_pending"
          ? "transfer_pending"
          : state === "cod"
            ? "cod_pending"
            : "requires_payment",
    amount_total: "119.60",
    currency: "PLN",
    shipping_city: "Szczecinek",
    shipping_postcode: "78-400",
    shipping_address_line_1: "Kościuszki 21",
    shipping_address_line_2: "",
    note_text: "Metoda dostawy: Kurier",
    summary_text: "Moskitiera ramkowa 650 × 1300 mm, biała, siatka szara - 1 szt.",
    payload: {
      quote: {
        positions: [
          {
            product_slug: "moskitiery-ramkowe",
            product_label: "Moskitiera ramkowa",
            summary: "Moskitiera ramkowa 650 × 1300 mm",
            summary_rows: [
              { label: "Rozmiar", value: "650 × 1300 mm" },
              { label: "Kolor ramki", value: "biały" },
              { label: "Siatka", value: "szara" },
            ],
            quantity: 1,
            total_amount: "119.60",
          },
        ],
      },
    },
    created_at: "2026-10-01 10:15:00",
    updated_at: "2026-10-01 10:15:00",
    paid_at: paid ? "2026-10-01 10:16:00" : "",
    access_token: "",
    crm_order_number: paid || state === "cod" ? "123/10/2026" : "",
    estimated_completion: paid && !shipped ? "do 8 października" : "",
    invoice_issued: false,
    invoice_required: false,
    shipments: shipped
      ? [{ carrier: "DPD Kurier", tracking_number: "1052124944988U", tracking_link: "https://tracktrace.dpd.com.pl/parcelDetails?p1=1052124944988U" }]
      : [],
    transfer:
      state === "transfer_pending"
        ? {
            account_holder: "KEIKA",
            account_number: "12 3456 7890 1234 5678 9012 3456",
            bank_name: "Bank przykładowy",
            holder_address: "",
            title: "ZPRZYKLAD01",
            amount: "119.60",
            currency: "PLN",
            booking_note: "Zaksięgowanie przelewu może potrwać do 2 dni roboczych.",
            pending: true,
          }
        : null,
    customer_name: "Anna Kowalska",
    customer_phone: "600 100 200",
    customer_email: "anna@example.com",
    payment_method_label: paid ? "BLIK" : "",
  };
}
