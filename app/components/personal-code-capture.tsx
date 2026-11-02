"use client";

// Łapie kod osobisty z adresu (?kod=WRACAM-XXXXXX - link z maila/SMS-a
// dla powracających klientów, 23.10.2026) na KAŻDEJ stronie sklepu i
// zapisuje go (lib/personal-code.ts). Dalej: koszyk nalicza go sam zamiast
// SEZON20, pasek u góry pokazuje termin. Nic nie renderuje.
import { useEffect } from "react";
import { capturePersonalCodeFromUrl } from "@/lib/personal-code";
import { isInternalTraffic } from "@/lib/rescue-signup";

export default function PersonalCodeCapture() {
  useEffect(() => {
    void capturePersonalCodeFromUrl();
    // ?internal_preview=1 na dowolnej stronie oznacza urządzenie jako testowe (rabat ratunkowy - lib/rescue-signup.ts).
    isInternalTraffic();
  }, []);
  return null;
}
