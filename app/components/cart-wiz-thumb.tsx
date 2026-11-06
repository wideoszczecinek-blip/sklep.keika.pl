"use client";

// Miniatura pozycji z wizualizatora (właściciel 7.11): klient widzi w koszyku i w kasie SWOJE okno z plisą,
// a nie ogólny rysunek. Najpierw ostatni widok z renderera, potem zdjęcie z analizy; pliki znikają po 30 dniach,
// wtedy zostaje dotychczasowa miniatura.
import { useState, type ReactNode } from "react";
import { WIZ_API } from "@/lib/wizualizator/api";

const TYPY = ["podglad", "analiza"] as const;

export default function CartWizThumb({ token, label, children }: { token: string; label: string; children: ReactNode }) {
  const [krok, setKrok] = useState(0);
  if (krok >= TYPY.length) return <>{children}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="cart-wiz-thumb"
      src={`${WIZ_API}/obraz.php?t=${token}&typ=${TYPY[krok]}`}
      alt={label}
      loading="lazy"
      decoding="async"
      onError={() => setKrok((k) => k + 1)}
    />
  );
}
