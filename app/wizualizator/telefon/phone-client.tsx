"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchKatalog } from "@/lib/wizualizator/api";
import { wizIsProdHost } from "@/lib/wizualizator/flag";

const WizModal = dynamic(() => import("@/features/wizualizator/WizModal"), { ssr: false });

export default function PhoneClient() {
  const [kod, setKod] = useState<string | null>(null);
  const [dostepny, setDostepny] = useState<boolean | null>(null);
  useEffect(() => {
    const k = (new URLSearchParams(window.location.search).get("k") || "").replace(/[^a-z0-9]/gi, "").slice(0, 12);
    setKod(k);
    // Na domenie produkcyjnej działa dopiero po uruchomieniu przez właściciela (udział w CRM > 0).
    if (!wizIsProdHost()) {
      setDostepny(true);
      return;
    }
    void fetchKatalog().then((c) => setDostepny(Boolean(c && c.wlaczony && c.udzial > 0)));
  }, []);
  if (kod === null || dostepny === null) return null;
  if (!kod || !dostepny) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>{dostepny ? "Brak kodu" : "Wizualizacja jest w przygotowaniu"}</h1>
        <p>{dostepny ? "Zeskanuj kod QR z ekranu komputera jeszcze raz." : "Ta funkcja będzie dostępna wkrótce."}</p>
        <a href="/plisy">Przejdź do plis</a>
      </main>
    );
  }
  return <WizModal zrodlo="qr-telefon" qrKod={kod} onClose={() => (window.location.href = "/plisy")} />;
}
