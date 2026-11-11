import type { Metadata } from "next";
import Link from "next/link";
import OrderPanel, { type PanelData } from "../order-panel";

// Wersja testowa panelu zamówienia do pokazania właścicielowi (11.11.2026) - przykładowe dane,
// bez połączenia z CRM, formularze nic nie wysyłają. Nie ma do niej linków w sklepie.
export const metadata: Metadata = {
  title: "Panel zamówienia - wersja testowa",
  robots: { index: false, follow: false },
};

const PRZYKLAD: PanelData = {
  firstName: "Anna",
  phone: "+48 790 215 251",
  order: {
    number: "412/11/2026",
    tempCode: "Z7F3A91C2E0",
    placedAt: "11.11.2026, 14:32",
    status: "W produkcji",
    stage: 2,
    eta: { from: "czw. 19.11", to: "pon. 23.11", productionDays: 7 },
    items: [
      {
        name: "Moskitiera ramkowa",
        qty: 2,
        price: 358.8,
        params: [
          ["Wymiar", "620 × 1500 mm"],
          ["Kolor ramki", "biały"],
          ["Siatka", "czarna standard"],
          ["Uchwyty", "Winchester (bez wiercenia)"],
        ],
      },
      {
        name: "Plisa",
        qty: 1,
        price: 289,
        params: [
          ["Wymiar", "780 × 1350 mm"],
          ["Tkanina", "Toskania 1004 beż"],
          ["Montaż", "przyklejany do ramy"],
          ["Profile", "białe"],
        ],
      },
    ],
    subtotal: 647.8,
    discounts: [
      ["CAŁY DOM -10%", 64.78],
      ["Dodatkowy rabat -5%", 29.15],
    ],
    delivery: { method: "Kurier DPD", name: "Anna Kowalska", address: "Młodzieżowa 62, 87-123 Dobrzejewice", phone: "+48 600 100 200", fee: 0 },
    payment: { method: "BLIK", state: "Opłacone 11.11, 14:32" },
    total: 553.87,
    documents: [
      { label: "Potwierdzenie zamówienia", note: "PDF" },
      { label: "Faktura / paragon", note: "po wysyłce" },
    ],
    shipment: null,
    changesOpen: true,
  },
  orders: [
    { number: "188/06/2026", date: "14.06.2026", summary: "Moskitiera ramkowa × 3", total: 412.5, status: "Dostarczone", done: true },
    { number: "Allegro 77/05/2026", date: "02.05.2026", summary: "Siatka na moskitierę 100 cm × 1", total: 17, status: "Dostarczone", done: true },
  ],
  discounts: [
    {
      title: "Kod dla powracających",
      code: "WRACAM-7KQ2",
      value: "-10%",
      until: "ważny do 11.12.2026",
      note: "Na kolejne zamówienie w sklepie, łączy się z CAŁY DOM.",
    },
    {
      title: "CAŁY DOM",
      code: "",
      value: "do -20%",
      until: "stała promocja",
      note: "2 sztuki jednego produktu -10%, 3 i więcej -20%. Liczy się samo w koszyku.",
    },
  ],
};

export default function PanelPrzykladPage() {
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
