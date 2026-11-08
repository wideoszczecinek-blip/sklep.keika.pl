"use client";

// Ekran oczekiwania na potwierdzenie BLIK (właściciel 8.11.2026, audyt koszyka:
// 5 z 8 osób, które wybrały metodę i nie kupiły, wybrało BLIK - wychodziły do
// banku po kod i nie wracały). Zamiast jednej linijki ze spinnerem: co zrobić,
// ile czasu zostało i że strona sama potwierdzi zamówienie.
import { useEffect, useState } from "react";

const BLIK_CODE_WINDOW_SEC = 120;

function formatPln(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

export default function BlikWaitPanel({ amount, startedAt }: { amount: number | null; startedAt: number }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const left = Math.max(0, BLIK_CODE_WINDOW_SEC - Math.floor((now - startedAt) / 1000));
  const mm = Math.floor(left / 60);
  const ss = String(left % 60).padStart(2, "0");
  return (
    <div className="cart-payment-waiting cart-payment-waiting-bank cart-blik-wait" role="status" aria-live="polite">
      <span className="cart-invoice-nip-spinner" aria-hidden="true" />
      <strong>Potwierdź płatność w aplikacji banku</strong>
      <ol className="cart-blik-wait-steps">
        <li>Otwórz aplikację swojego banku.</li>
        <li>
          Zatwierdź płatność {amount ? <b>{formatPln(amount)}</b> : null} dla <b>KEIKA</b>.
        </li>
        <li>Wróć tutaj. Strona czeka i sama potwierdzi zamówienie.</li>
      </ol>
      <p className="cart-blik-wait-timer">
        {left > 0 ? (
          <>
            Czas na potwierdzenie: <b>{mm}:{ss}</b>
          </>
        ) : (
          "Sprawdzamy jeszcze status płatności…"
        )}
      </p>
      <p>Nie zamykaj tej karty. Jeśli kod wygaśnie, wygenerujesz nowy i spróbujesz ponownie - nic nie zostanie pobrane dwa razy.</p>
    </div>
  );
}
