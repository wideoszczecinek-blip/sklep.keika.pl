"use client";

// Podpis kafelka "Raty" w wyborze płatności: konkretna rata miesięczna
// zamiast ogólnika "decyzja online" (właściciel, 2026-09-24: "przy ratach
// pokaż miesięczną ratę, np. 10× x zł"). Liczba rat jest wspólna z kartą
// "Rozłóż na raty" w podsumowaniu - zmiana tutaj przelicza obie.
import InstallmentCountPicker from "./installment-count-picker";
import { installmentsAvailable, monthlyInstallment } from "@/lib/installments";
import { useInstallmentCount, useInstallmentSettings } from "@/lib/installment-settings";

function zl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

export default function InstallmentTileHint({ amount }: { amount: number }) {
  const { apr } = useInstallmentSettings();
  const [count] = useInstallmentCount();

  if (!installmentsAvailable(amount)) {
    return <>Raty Przelewy24 – decyzja online</>;
  }
  return (
    <span className="cart-pay-tile-instalments">
      <span className="cart-pay-tile-lead">
        {count}× <strong>{zl(monthlyInstallment(amount, count, apr))}</strong>
      </span>
      <InstallmentCountPicker />
    </span>
  );
}
