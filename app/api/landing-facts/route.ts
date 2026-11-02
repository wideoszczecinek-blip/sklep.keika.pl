import { NextResponse } from "next/server";

import { DNI_PRODUKCJI, OPIS, SEKCJE_LEJKA, TYPOWE_OKNA, type ProduktDachowy } from "@/features/dachowe/lejek-tresci";
import { PD_ALL_PHOTOS } from "@/features/plisy-dachowe/gallery";
import { PD_DESCRIPTION_HTML, PD_FAQ } from "@/features/plisy-dachowe/landing-content";
import { PLISY_ALL_PHOTOS } from "@/features/plisy/gallery";
import { PLISY_DESCRIPTION_HTML, PLISY_FAQ } from "@/features/plisy/landing-content";
import { RD_ALL_PHOTOS } from "@/features/rolety-dachowe/gallery";
import { RD_DESCRIPTION_HTML, RD_FAQ } from "@/features/rolety-dachowe/landing-content";

// Treści wbudowane w kod sklepu - dla Agencji AI w CRM (marketing_team_shop_content).
// Strony plis, plis dachowych i rolet dachowych pokazują własne FAQ, galerię
// i opis, gdy pole w CRM jest puste (albo ma za mało zdjęć). Agencja czytała
// tylko konfigurację z CRM i dwa razy (13.10 oraz 31.10 - zlecenia 279, 280)
// uznała te strony za puste. Klucze = slug produktu w CRM.
export const revalidate = 3600;

const FACTS: Record<string, { faq: Array<{ question: string; answer: string }>; gallery: string[]; description: string }> = {
  plisy: { faq: PLISY_FAQ, gallery: PLISY_ALL_PHOTOS, description: PLISY_DESCRIPTION_HTML },
  "plisy-dachowe": { faq: PD_FAQ, gallery: PD_ALL_PHOTOS, description: PD_DESCRIPTION_HTML },
  "roleta-dachowa-dekolux": { faq: RD_FAQ, gallery: RD_ALL_PHOTOS, description: RD_DESCRIPTION_HTML },
};

// Strony dachowe od 2.11 to lejek (features/dachowe) - wypunktowania i sekcje są w kodzie, nie w CRM (AGN-915/916).
const LEJEK: Record<string, ProduktDachowy> = { "plisy-dachowe": "plisy-dachowe", "roleta-dachowa-dekolux": "rolety-dachowe" };

function lejek(produkt: ProduktDachowy) {
  const o = OPIS[produkt];
  return {
    wypunktowania_wbudowane: o.cechy.map(([b, s]) => `${b} – ${s.replace("{modeli}", "ponad 420")}`),
    sekcje_wbudowane: [...SEKCJE_LEJKA],
    opis_sprzedazowy: `${o.lead} ${o.tekst}`,
    ceny_typowych_okien: {
      okna: TYPOWE_OKNA.map(([, okno]) => okno),
      zrodlo: "liczone na żywo w przeglądarce z cennika konfiguratora (najtańsza konfiguracja), sekcja ukryta, gdy wycenią się mniej niż 3 okna",
    },
    dni_produkcji: DNI_PRODUKCJI[produkt],
  };
}

export function GET() {
  const produkty: Record<string, unknown> = {};
  for (const [slug, facts] of Object.entries(FACTS)) {
    produkty[slug] = {
      faq_wbudowane: facts.faq,
      zdjecia_wbudowane: facts.gallery.length,
      opis_wbudowany: facts.description,
      ...(LEJEK[slug] ? lejek(LEJEK[slug]) : {}),
    };
  }
  return NextResponse.json({
    ok: true,
    zasady:
      "FAQ z CRM zastępuje wbudowane, gdy ma choć jedno pytanie. Galeria z CRM zastępuje wbudowaną, gdy ma co najmniej tyle zdjęć. Opis z CRM zastępuje wbudowany, gdy nie jest pusty (wyjątek: techniczne opisy konfiguratora).",
    produkty,
  });
}
