import type { OfertaContent } from "../types";

// Moskitiery do okien dachowych (10.11.2026) - treść na wzór
// keika.pl/oferta/moskitiery/moskitiery-do-okien-dachowych (rolowana, na wnękę)
// i opisu produktu w CRM (ramka aluminiowa na zaczepach). Zdjęcia realizacji
// KEIKA z keika.pl. Bez terminów, cen i obietnic.
export const MOSKITIERY_DACHOWE: OfertaContent = {
  slug: "moskitiery-do-okien-dachowych",
  path: "/moskitiery-do-okien-dachowych",
  group: "moskitiery",
  menuLabel: "Moskitiery do okien dachowych",
  seoTitle: "Moskitiery do okien dachowych na wymiar - rolowane i ramkowe | KEIKA",
  seoDescription:
    "Moskitiery do okien dachowych na wymiar wnęki: rolowane z kasetą i prowadnicami albo na aluminiowej ramie. Do okien Fakro, Velux, Roto, OKPOL i innych. Zapytaj o wycenę.",
  eyebrow: "Moskitiery",
  title: "Moskitiery do okien dachowych",
  lead:
    "Okna dachowe otwierają się obrotowo, więc zwykła moskitiera na skrzydło nie wchodzi w grę. Moskitierę montuje się we wnęce okna - produkujemy ją na wymiar wnęki, do okien każdego producenta.",
  hero: { src: "/oferta/moskitiery-dachowe/m1.jpg", alt: "Moskitiera rolowana we wnęce okna dachowego - realizacja KEIKA" },
  heroChips: ["Na wymiar wnęki", "Fakro, Velux, Roto, OKPOL i inne", "Rolowana lub ramkowa", "Współpracuje z roletą i plisą"],
  productLabel: "Moskitiery do okien dachowych",
  quoteOptions: [
    "Moskitiera rolowana (kaseta + prowadnice)",
    "Moskitiera na aluminiowej ramie",
    "Nie wiem - proszę o doradztwo",
  ],
  variants: {
    title: "Rolowana czy ramkowa?",
    intro: "Obie montuje się we wnęce (ościeżu) okna, więc nie kolidują z roletą ani plisą na skrzydle.",
    items: [
      {
        id: "rolowana",
        name: "Rolowana",
        tagline: "Siatka zwija się do kasety u góry wnęki",
        body: "Siatka zwija się do aluminiowej kasety, a dołem prowadzą ją boczne prowadnice. Jednym ruchem odsłaniasz okno, żeby je otworzyć albo umyć. Zwinięta może zostać na oknie przez cały rok.",
        image: "/oferta/moskitiery-dachowe/m2.jpg",
        imageAlt: "Kaseta moskitiery rolowanej na oknie dachowym",
        bullets: ["Kaseta i prowadnice mocowane na wkręty do wnęki", "Mechanizm sprężynowy nawija siatkę", "Siatkę da się wymienić bez wymiany kasety"],
      },
      {
        id: "ramkowa",
        name: "Na aluminiowej ramie",
        tagline: "Rama dopasowana do skosów wnęki",
        body: "Moskitiera na aluminiowej ramie, dopasowana do skosów wnęki okna dachowego. Siatka z włókna szklanego powlekanego PCV przepuszcza powietrze i zatrzymuje owady.",
        image: "/oferta/moskitiery-dachowe/m3.jpg",
        imageAlt: "Moskitiera we wnęce okna dachowego",
        bullets: ["Montaż na zaczepach sprężynowych", "Siatka z włókna szklanego powlekanego PCV", "Profil w kilku kolorach"],
      },
    ],
  },
  features: [
    { icon: "ruler", title: "Wymiar z wnęki, nie z tabliczki", body: "Mierzy się wnękę okna (szerokość i wysokość ościeża w świetle), więc moskitiera pasuje także do starych okien, których nie ma już w katalogach." },
    { icon: "home", title: "Razem z roletą lub plisą", body: "Roleta i plisa dachowa są na skrzydle, moskitiera we wnęce - systemy ze sobą nie kolidują." },
    { icon: "wind", title: "Przewiew bez owadów", body: "Okna dachowe otwiera się latem na noc - wtedy owady najchętniej lecą do światła. Siatka przepuszcza powietrze, a zatrzymuje owady." },
    { icon: "tools", title: "Prosty montaż", body: "Wersja rolowana mocowana jest na kilka wkrętów w ościeżu - po demontażu zostają tylko małe otwory, łatwe do zaszpachlowania." },
  ],
  gallery: [
    { src: "/oferta/moskitiery-dachowe/m4.jpg", alt: "Moskitiera do okna dachowego - realizacja KEIKA", caption: "Realizacja KEIKA" },
  ],
  specs: {
    title: "Najważniejsze informacje",
    items: [
      { label: "Rodzaje", value: "rolowana (kaseta + prowadnice boczne) albo na aluminiowej ramie" },
      { label: "Okna", value: "Fakro, Velux, Roto, OKPOL i inne - wymiar z wnęki" },
      { label: "Pomiar", value: "wnęka okna (nie skrzydło): szerokość i wysokość ościeża w świetle" },
      { label: "Siatka", value: "włókno szklane powlekane PCV" },
      { label: "Montaż", value: "wersja rolowana na wkręty do wnęki; ramkowa na zaczepach sprężynowych" },
    ],
  },
  faq: [
    { q: "Czy moskitiera przeszkadza w otwieraniu okna dachowego?", a: "Wersja rolowana nie - siatka zwija się do kasety u góry wnęki, więc jednym ruchem odsłaniasz okno." },
    { q: "Jak zmierzyć okno dachowe do moskitiery?", a: "Mierzy się wnękę, a nie skrzydło: szerokość i wysokość ościeża w świetle. To ważna różnica wobec rolet i plis dachowych, które dobiera się po modelu okna." },
    { q: "Czy pasuje do okien każdego producenta?", a: "Tak, bo wymiar bierzemy z wnęki, a nie z tabliczki znamionowej." },
    { q: "Czy zmieści się razem z roletą dachową?", a: "Tak - roleta jest na skrzydle, moskitiera we wnęce, więc nie kolidują ze sobą." },
    { q: "Jak czyścić moskitierę?", a: "Rozwinąć siatkę i przetrzeć wilgotną, miękką ściereczką, prowadnice oczyścić z kurzu. Nie zwijać mokrej siatki." },
  ],
  related: ["moskitiery-plisowane", "moskitiery-drzwiowe", "moskitiery-przesuwne"],
};
