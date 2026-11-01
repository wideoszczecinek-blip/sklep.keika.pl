import type { Metadata } from "next";
import PhoneClient from "./phone-client";

// Wizualizator „Twoje okno”: strona otwierana z kodu QR pokazanego na komputerze.
// Zdjęcie z telefonu trafia do sesji komputera (CRM shop_wizualizacje_qr), wynik
// widać na obu urządzeniach. Nie indeksujemy.
export const metadata: Metadata = {
  title: "Zdjęcie okna do wizualizacji plisy | KEIKA",
  description: "Zrób zdjęcie okna telefonem - wizualizacja plisy pojawi się na komputerze.",
  robots: { index: false, follow: false },
};

export default function WizPhonePage() {
  return <PhoneClient />;
}
