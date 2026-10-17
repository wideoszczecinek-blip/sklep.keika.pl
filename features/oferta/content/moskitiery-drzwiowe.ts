import type { OfertaContent } from "../types";

// Moskitiery drzwiowe - system drzwiowy MOSKITO (moskitosystem.com.pl,
// P.P.H. Moskito, Tarnów). Tylko fakty z katalogu komponentów i formularza
// zamówienia producenta (2026-10-17): profil drzwiowy + poprzeczny +
// uzupełniający, zawias, sprężyna, zamek magnetyczny, klamka, uszczelka,
// siatka; w zamówieniu: kolor RAL, kolor siatki, wysokość poprzeczki,
// kierunek otwierania (z zewnątrz), szerokość i wysokość. Opcje z katalogu:
// przejście dla zwierząt, wypełnienie lexan. Bez wersji dwuskrzydłowej.
export const MOSKITIERY_DRZWIOWE: OfertaContent = {
  slug: "moskitiery-drzwiowe",
  path: "/moskitiery-drzwiowe",
  group: "moskitiery",
  menuLabel: "Moskitiery drzwiowe",
  seoTitle: "Moskitiery drzwiowe na wymiar - aluminiowa rama na zawiasach | KEIKA",
  seoDescription:
    "Moskitiera drzwiowa na wymiar na drzwi balkonowe i tarasowe: aluminiowa rama na zawiasach z zamkiem magnetycznym, poprzeczka na wybranej wysokości, siatka szara lub czarna, profile w kolorach RAL i okleinach drewnopodobnych. Opcja przejścia dla zwierząt i wzmocnionego dołu. Bezpłatna wycena.",
  eyebrow: "Moskitiery",
  title: "Moskitiery drzwiowe na wymiar",
  lead:
    "Wychodzisz na taras, moskitiera domyka się za Tobą, komary zostają na zewnątrz. Aluminiowa rama na zawiasach, zamykana magnesem, z poprzeczką na wysokości, którą sam wybierasz - w kolorze Twoich drzwi.",
  hero: { src: "/oferta/moskitiery-drzwiowe/hero.jpg", alt: "Biała moskitiera drzwiowa z dolnym panelem na drzwiach balkonowych w drewnianej ramie" },
  heroChips: ["Rama aluminiowa na zawiasach", "Zamek magnetyczny", "Poprzeczka na wybranej wysokości", "Kolory RAL i okleiny drewnopodobne"],
  productLabel: "Moskitiery drzwiowe",
  quoteOptions: [
    "Moskitiera drzwiowa na zawiasach (standard)",
    "Z przejściem dla zwierząt",
    "Z wypełnieniem dolnym z lexanu",
    "Nie wiem - proszę o doradztwo",
  ],
  supplier: { name: "MOSKITO", note: "system drzwiowy polskiego producenta profili moskitierowych" },
  variants: {
    title: "Jedna rama, trzy wykończenia",
    intro: "Podstawa jest zawsze ta sama: rama z aluminiowych profili drzwiowych z poprzeczką, siatka, zawiasy i zamek magnetyczny. Do wyboru masz to, co dzieje się w dolnej części ramy.",
    items: [
      {
        id: "standard",
        name: "Standard na zawiasach",
        tagline: "Na drzwi balkonowe i tarasowe",
        body: "Rama z profili drzwiowych i profilu poprzecznego, nitowana w narożnikach, z siatką z włókna szklanego. Zawiasy ze sprężyną domykają skrzydło, magnesy w zamku trzymają je zamknięte, a klamka pozwala otworzyć z obu stron. Kierunek otwierania (lewe / prawe, patrząc z zewnątrz) i wysokość poprzeczki ustalamy przy zamówieniu.",
        image: "/oferta/moskitiery-drzwiowe/g1.jpg",
        imageAlt: "Narożnik ramy moskitiery drzwiowej z zawiasem",
        bullets: ["Zawiasy ze sprężyną, zamek magnetyczny, klamka", "Uszczelka szczotkowa między ramą a ościeżem", "Poprzeczka na wysokości podanej do osi"],
        quoteOption: "Moskitiera drzwiowa na zawiasach (standard)",
      },
      {
        id: "zwierzeta",
        name: "Z przejściem dla zwierząt",
        tagline: "Kot i pies wychodzą sami",
        body: "W dolnym polu ramy, pod poprzeczką, montujemy przejście dla zwierząt z katalogu producenta - klapkę, którą zwierzę samo otwiera. Siatka nad poprzeczką zostaje nienaruszona.",
        image: "/oferta/moskitiery-drzwiowe/g2.jpg",
        imageAlt: "Zamek magnetyczny na profilu moskitiery drzwiowej",
        bullets: ["Klapka w dolnym polu ramy", "Poprzeczka oddziela pole z klapką od siatki", "Dostępna w kolorach profili"],
        quoteOption: "Z przejściem dla zwierząt",
      },
      {
        id: "lexan",
        name: "Z wypełnieniem dolnym z lexanu",
        tagline: "Ochrona siatki przed pazurami i piłką",
        body: "Zamiast siatki w dolnym polu ramy - przezroczysta płyta z lexanu (poliwęglanu). Nie zasłania światła, a wytrzymuje psa, dziecko i piłkę. Dobre rozwiązanie na drzwi tarasowe, przez które przechodzi się wiele razy dziennie.",
        image: "/oferta/moskitiery-drzwiowe/hero.jpg",
        imageAlt: "Moskitiera drzwiowa z dolnym panelem z lexanu",
        bullets: ["Płyta lexan w dolnym polu, siatka w górnym", "Można połączyć z przejściem dla zwierząt", "Montaż jak w wersji standardowej"],
        quoteOption: "Z wypełnieniem dolnym z lexanu",
      },
    ],
  },
  features: [
    { icon: "shield", title: "Sztywna rama", body: "Profile z lakierowanego aluminium łączone narożnikami i nitowane, poprzeczka usztywnia skrzydło - rama nie skręca się przy otwieraniu." },
    { icon: "wind", title: "Powietrze tak, owady nie", body: "Siatka z włókna szklanego powlekanego PVC, szara lub czarna, nie ogranicza przewiewu i wytrzymuje słońce oraz deszcz." },
    { icon: "palette", title: "W kolorze Twoich drzwi", body: "Lakier RAL: biały, antracyt, brązy, czarny, oraz okleiny strukturalne: złoty dąb, orzech, winchester, mahoń, turner oak." },
    { icon: "ruler", title: "Pod Twoje drzwi", body: "Wymiar, kierunek otwierania i wysokość poprzeczki podajesz przy zamówieniu - albo mierzymy je przy pomiarze." },
  ],
  gallery: [
    { src: "/oferta/moskitiery-drzwiowe/g3.jpg", alt: "Zawias moskitiery drzwiowej w białej ramie", caption: "Zawias w białej ramie" },
    { src: "/oferta/moskitiery-drzwiowe/g4.jpg", alt: "Narożnik ciemnej ramy moskitiery z uszczelką szczotkową", caption: "Uszczelka szczotkowa i narożnik" },
    { src: "/oferta/moskitiery-drzwiowe/g5.jpg", alt: "Zbliżenie na siatkę z włókna szklanego w czarnej ramie", caption: "Siatka z włókna szklanego" },
    { src: "/oferta/moskitiery-drzwiowe/g6.jpg", alt: "Ekspozycja ram moskitierowych w showroomie producenta", caption: "Profile systemu MOSKITO" },
  ],
  specs: {
    title: "Najważniejsze parametry",
    items: [
      { label: "Rama", value: "profil drzwiowy, profil poprzeczny i profil uzupełniający z aluminium lakierowanego; narożniki, nitowana" },
      { label: "Otwieranie", value: "zawiasy ze sprężyną, zamek magnetyczny, klamka; kierunek otwierania lewy lub prawy (określany z zewnątrz)" },
      { label: "Poprzeczka", value: "na wysokości podanej przy zamówieniu (do osi profilu)" },
      { label: "Siatka", value: "włókno szklane powlekane PVC, kolor szary (popielaty) lub czarny" },
      { label: "Opcje", value: "przejście dla zwierząt, wypełnienie dolne z lexanu, uszczelka szczotkowa" },
      { label: "Kolory profili", value: "biały RAL 9016 / 9003, antracyt RAL 7016, brąz RAL 8017 / 8003 / 8022 / 8028 / 8001, czarny RAL 9005 / 9004, surowe aluminium; okleiny: złoty dąb, orzech, winchester, mahoń, turner oak" },
      { label: "Wymiary", value: "na wymiar - szerokość i wysokość światła ościeża; do wyceny wystarczą wymiary orientacyjne" },
    ],
  },
  faq: [
    { q: "W którą stronę otwiera się moskitiera drzwiowa?", a: "Na zewnątrz, na zawiasach po lewej albo po prawej stronie - stronę określamy patrząc na drzwi z zewnątrz. Jeśli na zewnątrz nie ma miejsca (barierka, roleta), proponujemy moskitierę przesuwną lub plisowaną." },
    { q: "Po co poprzeczka i na jakiej wysokości?", a: "Poprzeczka usztywnia ramę i dzieli siatkę na dwa pola; w dolnym można zamontować przejście dla zwierząt albo lexan. Zwykle dajemy ją na wysokości poprzeczki drzwi albo klamki - podajesz wymiar do osi profilu." },
    { q: "Czy pies nie zniszczy siatki?", a: "Zamów wypełnienie dolne z lexanu - przezroczyste, odporne na pazury - i przejście dla zwierząt, żeby pies sam wychodził, a siatka w górnym polu została cała." },
    { q: "Jak podać wymiary?", a: "Zmierz szerokość i wysokość światła ościeża drzwi w kilku miejscach i napisz, po której stronie mają być zawiasy. Dokładny pomiar zrobimy przy montażu." },
  ],
  related: ["moskitiery-przesuwne", "moskitiery-plisowane", "rolety-zewnetrzne"],
  ownerNote: "Treść ograniczona do katalogu i formularza zamówienia MOSKITO (profile, zawias + sprężyna, zamek magnetyczny, klamka, uszczelka, poprzeczka, przejście dla zwierząt, lexan, kolory). Usunięto: otwieranie do wewnątrz, wersję dwuskrzydłową, regulację zawiasów, panel w kolorze ramy, montaż na dystansach. Zdjęcia to detale z moskitosystem.com.pl - warto dołożyć realizację na tarasie.",
};
