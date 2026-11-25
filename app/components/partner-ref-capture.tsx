"use client";

// Łapie polecenie kontrahenta na KAŻDEJ stronie sklepu: ?ref=<skrót> z linku
// https://polecam.keika.pl/<skrót> albo ciasteczko keika_partner (program
// partnerski B2B, 25.11.2026 - lib/partner-ref.ts). Dalej koszyk sam dolicza
// „Rabat z polecenia”. Nic nie renderuje.
import { useEffect } from "react";
import { capturePartnerRef } from "@/lib/partner-ref";

export default function PartnerRefCapture() {
  useEffect(() => {
    void capturePartnerRef();
  }, []);
  return null;
}
