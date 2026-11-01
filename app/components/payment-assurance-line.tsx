"use client";

// Jedna stała linia pod paskiem zaufania w sekcji „Płatność” (Analityczka
// strony Agencji AI, 1.11.2026 - zlecenia AGN-438/445/449): 10 sesji
// tygodniowo kończyło wizytę na płatności (PayPo, dwukrotnie otwarty
// regulamin, wyjście po 4 min), a kupujący pisali na czacie częściej (14 %)
// niż odpadający (5 %). Karuzela wyżej pokazuje hasła po kolei - tu
// obietnica jest widoczna cały czas, a „czacie” otwiera czat sklepu.
// Bez kwot rat, bez warunków PayPo, nic nie blokuje przycisku zamówienia.
import { openLiveChat } from "@/lib/live-chat";
import { trackShopStep } from "@/lib/track-step";

export default function PaymentAssuranceLine() {
  return (
    <p className="cart-payment-assurance">
      <strong>5 lat gwarancji · 30 dni na zwrot</strong> bez podania przyczyny. Wątpliwości?{" "}
      <button
        type="button"
        className="cart-payment-assurance-chat"
        onClick={() => {
          trackShopStep("payment_assurance_chat", "koszyk", {});
          openLiveChat("Mam pytanie przed płatnością: ");
        }}
      >
        Odpowiemy na czacie
      </button>
      .
    </p>
  );
}
