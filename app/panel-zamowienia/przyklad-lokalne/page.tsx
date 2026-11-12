import type { Metadata } from "next";
import Link from "next/link";
import OrderPanel, { type PanelData } from "../order-panel";

// Wersja testowa panelu dla ZAMÓWIENIA LOKALNEGO (właściciel 12.11.2026: „jak to będzie wyglądało dla
// zleceń lokalnych - nie mamy cen rozbitych na produkty, a produkty wnioskujemy ze zlecenia
// produkcyjnego - przykład dla zamówienia 112/11/2026”). Dane przepisane z CRM (zamówienie 9677 +
// order_production_documents 6476, słowniki order_dictionary_items), nazwisko klienta skrócone.
// Kody pól → słowa: KOLOR @1 biały, TYP_TKANINY @1 zwykła, TYP_MONTAZU @1 standardowy (STD),
// SIATKA @1 czarna, TYP_SZEROKOSCI @1 w świetle, TYP_WYSOKOSCI @2 całkowita, STRONA_MONTAZU @1 wewnątrz.
export const metadata: Metadata = {
  title: "Panel zamówienia lokalnego - wersja testowa",
  robots: { index: false, follow: false },
};

const PRZYKLAD: PanelData = {
  firstName: "Konrad",
  phone: "+48 790 215 251",
  order: {
    number: "112/11/2026",
    tempCode: "",
    placedAt: "12.11.2026",
    status: "W produkcji",
    stages: ["Przyjęte", "Produkcja", "Gotowe do odbioru", "Odebrane"],
    stage: 1,
    eta: {
      from: "czw. 3.12",
      to: "czw. 3.12",
      productionDays: 0,
      label: "Przewidywany termin odbioru",
      note: "To termin z planu produkcji ustalony przy przyjęciu zamówienia - orientacyjny, a nie gwarantowany. Jeśli plan się zmieni, zobaczysz to tutaj. Gdy zamówienie będzie gotowe, zadzwonimy albo napiszemy SMS i umówimy odbiór.",
    },
    itemsNote: "Zamówienie z pomiaru u Ciebie - wymiary i wykonanie jak w zleceniu dla produkcji. Cena obejmuje całe zamówienie.",
    items: [
      {
        name: "Plisa",
        qty: 2,
        price: null,
        params: [
          ["Wymiar", "630 × 1850 mm"],
          ["Tkanina", "P-8005 (kolekcja Structure)"],
          ["Rodzaj tkaniny", "pojedyncza"],
          ["Kolor profili", "biały"],
          ["Montaż", "standardowy"],
        ],
      },
      {
        name: "Moskitiera zwijana Velia",
        qty: 1,
        price: null,
        params: [
          ["Wymiar", "850 × 2080 mm"],
          ["Mierzone", "szerokość w świetle, wysokość całkowita"],
          ["Siatka", "czarna"],
          ["Kolor", "biały"],
          ["Montaż", "od wewnątrz"],
        ],
      },
      {
        name: "Moskitiera zwijana Velia",
        qty: 1,
        price: null,
        params: [
          ["Wymiar", "885 × 1240 mm"],
          ["Mierzone", "szerokość w świetle, wysokość całkowita"],
          ["Siatka", "czarna"],
          ["Kolor", "biały"],
          ["Montaż", "od wewnątrz"],
        ],
      },
    ],
    subtotal: null,
    discounts: [],
    delivery: {
      method: "Odbiór osobisty",
      name: "Konrad R.",
      address: "Szczecinek - miejsce i godzinę odbioru potwierdzimy, gdy zamówienie będzie gotowe",
      phone: "111 222 333",
      fee: null,
    },
    payment: { method: "Płatność przy odbiorze", state: "Do zapłaty: 1 400,00 zł" },
    total: 1400,
    totalLabel: "Wartość zamówienia",
    documents: [
      { label: "Potwierdzenie zamówienia", note: "PDF" },
      { label: "Paragon / faktura", note: "przy odbiorze" },
    ],
    shipment: null,
    changesOpen: true,
  },
  orders: [],
  discounts: [],
};

export default function PanelPrzykladLokalnePage() {
  return (
    <div className="cart-page">
      <div className="cart-page-gradient-bg" aria-hidden="true" />
      <header className="cart-page-header">
        <Link href="/" className="cart-page-brand">
          keika
        </Link>
        <h1>Panel zamówienia</h1>
      </header>
      <main className="cart-page-main">
        <OrderPanel data={PRZYKLAD} test />
      </main>
    </div>
  );
}
