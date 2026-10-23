"use client";

// Łapie kod osobisty z adresu (?kod=WRACAM-XXXXXX - link z maila/SMS-a
// dla powracających klientów, 23.10.2026) na KAŻDEJ stronie sklepu i
// zapisuje go (lib/personal-code.ts). Dalej: koszyk nalicza go sam zamiast
// SEZON20, pasek u góry pokazuje termin. Nic nie renderuje.
import { useEffect } from "react";
import { capturePersonalCodeFromUrl } from "@/lib/personal-code";

export default function PersonalCodeCapture() {
  useEffect(() => {
    void capturePersonalCodeFromUrl();
  }, []);
  return null;
}
