import type { OfertaContent } from "../types";

// Shuttersy (10.11.2026, właściciel: „wszystkie produkty na stronie głównej
// muszą być dostępne”) - treść na wzór keika.pl/oferta/taras/shutters,
// zdjęcia realizacji KEIKA z tej strony. Bez terminów, cen i obietnic.
export const SHUTTERSY: OfertaContent = {
  slug: "shuttersy",
  path: "/shuttersy",
  group: "taras",
  menuLabel: "Shuttersy",
  seoTitle: "Shuttersy na wymiar - panele z lamelami na taras, elewację i do okien | KEIKA",
  seoDescription:
    "Shuttersy na wymiar: przesuwne i uchylne panele z lamelami z drewna, stali lub aluminium. Na taras, elewację i jako okiennice wewnętrzne. Zapytaj o wycenę.",
  eyebrow: "Taras",
  title: "Shuttersy na wymiar",
  lead:
    "Panele z lamelami - przesuwne albo uchylne - na taras, elewację i do okien. Regulują światło i dają prywatność, nie zasłaniając całkowicie widoku. Produkujemy je na wymiar otworu.",
  hero: { src: "/oferta/shuttersy/s1.jpg", alt: "Drewniane shuttersy z lamelami na tarasie - realizacja KEIKA" },
  heroChips: ["Przesuwne lub uchylne", "Lamele stałe lub ruchome", "Drewno, stal albo aluminium", "Na taras, elewację i do wnętrz"],
  productLabel: "Shuttersy",
  quoteOptions: [
    "Shuttersy przesuwne (taras, elewacja)",
    "Shuttersy uchylne (okiennice)",
    "Okiennice wewnętrzne",
    "Nie wiem - proszę o doradztwo",
  ],
  variants: {
    title: "Przesuwne czy uchylne?",
    intro: "Oba rodzaje robimy na wymiar otworu. Różnią się sposobem otwierania i miejscem montażu.",
    items: [
      {
        id: "przesuwne",
        name: "Przesuwne",
        tagline: "Panele w prowadnicach wzdłuż ściany",
        body: "Panele jeżdżą w prowadnicach i zasłaniają cały otwór albo tylko jego fragment. Przy szerokich przeszkleniach kilka paneli zachodzi na siebie po przesunięciu. Sprawdzają się na tarasach, loggiach i elewacjach.",
        image: "/oferta/shuttersy/s2.jpg",
        imageAlt: "Przesuwne panele shutters na tarasie",
        bullets: ["Prowadnice mocowane do ściany, słupów albo sufitu zadaszenia", "Można je łączyć z zadaszeniem tarasu", "Zasłaniają bok tarasu i nisko padające słońce"],
      },
      {
        id: "uchylne",
        name: "Uchylne (okiennice)",
        tagline: "Otwierane jak skrzydła okiennic",
        body: "Skrzydła otwierają się na zawiasach, jak klasyczne okiennice - lepiej pasują do okien. Do wnętrz jako okiennice wewnętrzne, w stylu śródziemnomorskim i kolonialnym.",
        image: "/oferta/shuttersy/s3.jpg",
        imageAlt: "Shuttersy z lamelami przy oknie",
        bullets: ["Na zewnątrz i do wnętrz", "Zaczepy przytrzymujące skrzydło w pozycji otwartej", "Możliwe zamki i zaczepy (to nie jest zabezpieczenie antywłamaniowe)"],
      },
    ],
  },
  features: [
    { icon: "sun", title: "Światło i cień", body: "Zacieniają okno od zewnątrz, zanim słońce dotrze do szyby. Ruchome lamele pozwalają regulować kąt padania światła bez odsuwania panelu." },
    { icon: "eye", title: "Prywatność bez zasłaniania widoku", body: "Przy zamkniętych lamelach z zewnątrz nie widać wnętrza, a światło nadal dociera do pomieszczenia." },
    { icon: "palette", title: "Drewno, stal, aluminium", body: "Drewno naturalne olejowane, bejcowane albo lakierowane na kolor; lamele stalowe lub aluminiowe malowane na kolor RAL albo w strukturze drewna." },
    { icon: "ruler", title: "Na wymiar otworu", body: "Każdy panel powstaje pod konkretny otwór - także nietypowy." },
  ],
  gallery: [
    { src: "/oferta/shuttersy/s4.jpg", alt: "Shuttersy - realizacja KEIKA, zdjęcie 4", caption: "Panele z lamelami" },
    { src: "/oferta/shuttersy/s5.jpg", alt: "Shuttersy - realizacja KEIKA, zdjęcie 5", caption: "Realizacja KEIKA" },
    { src: "/oferta/shuttersy/s6.jpg", alt: "Shuttersy - realizacja KEIKA, zdjęcie 6", caption: "Realizacja KEIKA" },
  ],
  specs: {
    title: "Najważniejsze informacje",
    items: [
      { label: "Rodzaje", value: "przesuwne w prowadnicach, uchylne (okiennice), okiennice wewnętrzne" },
      { label: "Lamele", value: "stałe lub ruchome (regulacja kąta)" },
      { label: "Materiał", value: "drewno; lamele stalowe lub aluminiowe" },
      { label: "Wykończenie", value: "drewno olejowane, bejcowane lub lakierowane; metal malowany na kolor RAL albo w strukturze drewna (np. złoty dąb, orzech, winchester)" },
      { label: "Mocowanie", value: "ściana, słupy, sufit zadaszenia; okiennice na zawiasach" },
      { label: "Pielęgnacja", value: "drewno na zewnątrz wymaga co kilka lat odświeżenia powłoki olejem lub lakierem" },
    ],
  },
  faq: [
    { q: "Co to są shuttersy?", a: "Panele z lamelami - przesuwne lub uchylne. Montuje się je na tarasie, elewacji albo w oknie jako okiennice. Regulują światło i dają prywatność, nie zasłaniając całkowicie widoku." },
    { q: "Czy lamele są ruchome?", a: "Mogą być stałe albo ruchome. Ruchome pozwalają regulować kąt padania światła bez odsuwania panelu." },
    { q: "Czy panele można zamontować na istniejącym tarasie?", a: "Tak. Kluczowe są punkty mocowania prowadnic: ściana, słupy albo sufit zadaszenia. Opisz je w zapytaniu albo dołącz zdjęcie w odpowiedzi na naszą wiadomość." },
    { q: "Czy drewno na zewnątrz wymaga konserwacji?", a: "Tak, jak każde drewno na elewacji - co kilka lat warto odświeżyć powłokę olejem lub lakierem, zależnie od wykończenia. Lamele stalowe i aluminiowe malowane proszkowo tego nie wymagają." },
    { q: "Czy shuttersy hałasują przy wietrze?", a: "Panele prowadzone w szynach są stabilne. Przy wersjach uchylnych stosuje się zaczepy przytrzymujące skrzydło w pozycji otwartej." },
    { q: "Ile kosztują shuttersy?", a: "Cena zależy od wymiaru paneli, materiału i tego, czy lamele są ruchome. Wyślij formularz z orientacyjnymi wymiarami - przygotujemy wycenę." },
  ],
  related: ["zadaszenia", "markizy", "screeny"],
};
