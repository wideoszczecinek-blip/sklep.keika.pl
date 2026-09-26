import type { Metadata } from "next";
import MeasureGuideClient from "./guide-client";

// Cel linku z "Wyślij instrukcję" (features/plisy/MeasureShare.tsx): sama
// instrukcja pomiaru, statycznie prerenderowana, bez landingu i
// konfiguratora - ktoś otwiera ją z SMS-a stojąc przy oknie.
const SITE = "https://sklep.keika.pl";
const URL_PATH = "/plisy/jak-mierzyc";
const TITLE = "Jak zmierzyć okno pod plisę - instrukcja krok po kroku | KEIKA";
const DESCRIPTION =
  "Animowana instrukcja pomiaru okna pod plisę: montaż przykręcany (od uszczelki do uszczelki) i bezinwazyjny (cała szyba z listwami). Zmierz szerokość i wysokość, wpisz w wycenie.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: SITE + URL_PATH },
  openGraph: {
    type: "article",
    locale: "pl_PL",
    siteName: "KEIKA",
    url: SITE + URL_PATH,
    title: TITLE,
    description: DESCRIPTION,
  },
  twitter: { card: "summary", title: TITLE, description: DESCRIPTION },
};

const HOW_TO_JSON_LD = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: "Jak zmierzyć okno pod plisę",
  description: DESCRIPTION,
  totalTime: "PT2M",
  tool: [{ "@type": "HowToTool", name: "Miarka zwijana" }],
  step: [
    {
      "@type": "HowToStep",
      name: "Znajdź punkt pomiaru",
      text: "Przy montażu przykręcanym mierzysz od środka uszczelki do środka uszczelki po drugiej stronie. Przy bezinwazyjnym - od krawędzi listwy przyszybowej do tej samej krawędzi naprzeciwko.",
    },
    { "@type": "HowToStep", name: "Zmierz szerokość", text: "Przyłóż miarkę poziomo i odczytaj wymiar w milimetrach." },
    { "@type": "HowToStep", name: "Zmierz wysokość", text: "Obróć miarkę pionowo i odczytaj wysokość w tych samych punktach." },
    { "@type": "HowToStep", name: "Wpisz wymiary w wycenie", text: "Oba wymiary wpisujesz w konfiguratorze plisy - cena przelicza się od razu." },
  ],
};

export default function PlisyMeasureGuidePage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(HOW_TO_JSON_LD) }} />
      <MeasureGuideClient />
    </>
  );
}
