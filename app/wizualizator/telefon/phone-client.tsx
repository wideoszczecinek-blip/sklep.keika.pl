"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

const WizModal = dynamic(() => import("@/features/wizualizator/WizModal"), { ssr: false });

export default function PhoneClient() {
  const [kod, setKod] = useState<string | null>(null);
  useEffect(() => {
    const k = (new URLSearchParams(window.location.search).get("k") || "").replace(/[^a-z0-9]/gi, "").slice(0, 12);
    setKod(k);
  }, []);
  if (kod === null) return null;
  if (!kod) {
    return (
      <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
        <h1>Brak kodu</h1>
        <p>Zeskanuj kod QR z ekranu komputera jeszcze raz.</p>
        <a href="/plisy">Przejdź do plis</a>
      </main>
    );
  }
  return <WizModal zrodlo="qr-telefon" qrKod={kod} onClose={() => (window.location.href = "/plisy")} />;
}
