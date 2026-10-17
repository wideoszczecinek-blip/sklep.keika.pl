import type { OfertaContent } from "../types";

// Moskitiery drzwiowe - system drzwiowy MOSKITO (moskitosystem.com.pl,
// P.P.H. Moskito, Tarnów): rama aluminiowa, zawiasy samodomykające, zamek
// magnetyczny, opcje: wypełnienie lexan, przejście dla zwierząt, poprzeczka.
export const MOSKITIERY_DRZWIOWE: OfertaContent = {
  slug: "moskitiery-drzwiowe",
  path: "/moskitiery-drzwiowe",
  group: "moskitiery",
  menuLabel: "Moskitiery drzwiowe",
  seoTitle: "Moskitiery drzwiowe na wymiar - otwierane, samodomykające | KEIKA",
  seoDescription:
    "Moskitiera drzwiowa na wymiar na drzwi balkonowe i tarasowe: aluminiowa rama, zawiasy samodomykające, zamek magnetyczny, opcja przejścia dla zwierząt i wzmocnionego dolnego panelu. 12 kolorów profili. Bezpłatna wycena.",
  eyebrow: "Moskitiery",
  title: "Moskitiery drzwiowe na wymiar",
  lead:
    "Wychodzisz na taras, drzwi same się domykają, komary zostają na zewnątrz. Moskitiera drzwiowa na zawiasach z aluminiową ramą - robimy ją na wymiar Twoich drzwi balkonowych, w kolorze stolarki, z przejściem dla psa lub kota, jeśli trzeba.",
  hero: { src: "/oferta/moskitiery-drzwiowe/hero.jpg", alt: "Biała moskitiera drzwiowa z dolnym panelem na drzwiach balkonowych w drewnianej ramie" },
  heroChips: ["Zawiasy samodomykające", "Zamek magnetyczny", "Przejście dla zwierząt", "12 kolorów profili"],
  productLabel: "Moskitiery drzwiowe",
  quoteOptions: [
    "Moskitiera drzwiowa pojedyncza",
    "Moskitiera drzwiowa podwójna (dwa skrzydła)",
    "Z przejściem dla zwierząt",
    "Z dolnym panelem (lexan)",
    "Nie wiem - proszę o doradztwo",
  ],
  supplier: { name: "MOSKITO", note: "system drzwiowy polskiego producenta profili moskitierowych" },
  variants: {
    title: "Dopasuj moskitierę do swoich drzwi",
    intro: "Baza jest ta sama: sztywna rama z aluminium lakierowanego, siatka z włókna szklanego i zawiasy ze sprężyną. Dalej wybierasz, jak ma pracować.",
    items: [
      {
        id: "pojedyncza",
        name: "Pojedyncza na zawiasach",
        tagline: "Standard na drzwi balkonowe",
        body: "Rama otwiera się na zewnątrz lub do wewnątrz (według ustaleń przy pomiarze), zawiasy ze sprężyną domykają ją same, a magnes trzyma zamkniętą. Na ramie uchwyt do otwierania z obu stron.",
        image: "/oferta/moskitiery-drzwiowe/g1.jpg",
        imageAlt: "Narożnik ramy moskitiery drzwiowej z zawiasem sprężynowym",
        bullets: ["Zawiasy samodomykające z regulacją siły", "Zamek magnetyczny wpuszczany w profil", "Uszczelka szczotkowa po obwodzie"],
      },
      {
        id: "podwojna",
        name: "Podwójna (dwa skrzydła)",
        tagline: "Na szerokie drzwi tarasowe",
        body: "Dwa skrzydła spotykające się na środku na magnesach. Rozwiązanie na drzwi dwuskrzydłowe i szerokie przejścia, gdzie jedno skrzydło byłoby zbyt ciężkie lub kolidowało z barierką.",
        image: "/oferta/moskitiery-drzwiowe/g2.jpg",
        imageAlt: "Zamek magnetyczny na profilu moskitiery drzwiowej",
        bullets: ["Zamek magnetyczny między skrzydłami", "Każde skrzydło na własnych zawiasach", "Możliwe skrzydła o różnej szerokości"],
      },
      {
        id: "zwierzeta",
        name: "Z przejściem dla zwierząt lub panelem",
        tagline: "Pies, kot i dzieci",
        body: "W dolnej części ramy montujemy klapkę dla zwierząt (przejście z klapką wahadłową) albo wypełnienie z przezroczystej płyty lexan, które chroni siatkę przed pazurami i piłką. Można dodać poprzeczkę usztywniającą.",
        image: "/oferta/moskitiery-drzwiowe/hero.jpg",
        imageAlt: "Moskitiera drzwiowa z dolnym panelem z lexanu",
        bullets: ["Klapka dla zwierząt z lekkim magnesem", "Dolny panel z lexanu lub płyty w kolorze ramy", "Poprzeczka na wysokości klamki"],
      },
    ],
  },
  features: [
    { icon: "shield", title: "Rama, która nie klekocze", body: "Profile z aluminium lakierowanego, łączone narożnikami i nitowane. Zawias i zamek są wpuszczone w profil, nie dokręcone z boku." },
    { icon: "wind", title: "Powietrze tak, owady nie", body: "Siatka z włókna szklanego powlekanego PVC nie ogranicza przewiewu, a wytrzymuje słońce i deszcz. Na życzenie siatka aluminiowa lub stalowa." },
    { icon: "palette", title: "W kolorze Twoich drzwi", body: "Biały, antracyt, brązy, czarny i okleiny strukturalne: złoty dąb, orzech, winchester, mahoń, turner oak." },
    { icon: "tools", title: "Montaż do ramy lub ościeża", body: "Mocujemy do ramy drzwi, do ościeża lub do ściany na dystansach - zależnie od tego, gdzie jest miejsce na skrzydło." },
  ],
  gallery: [
    { src: "/oferta/moskitiery-drzwiowe/g3.jpg", alt: "Zawias moskitiery drzwiowej w białej ramie", caption: "Zawias sprężynowy" },
    { src: "/oferta/moskitiery-drzwiowe/g4.jpg", alt: "Narożnik ciemnej ramy moskitiery z uszczelką szczotkową", caption: "Uszczelka szczotkowa i narożnik" },
    { src: "/oferta/moskitiery-drzwiowe/g5.jpg", alt: "Zbliżenie na siatkę z włókna szklanego w czarnej ramie", caption: "Siatka z włókna szklanego" },
    { src: "/oferta/moskitiery-drzwiowe/g6.jpg", alt: "Ekspozycja ram moskitierowych w showroomie producenta", caption: "Profile systemu MOSKITO" },
  ],
  specs: {
    title: "Najważniejsze parametry",
    items: [
      { label: "Rama", value: "profil drzwiowy z aluminium lakierowanego, narożniki, nitowana; poprzeczka opcjonalna" },
      { label: "Otwieranie", value: "zawiasy ze sprężyną (samodomykanie), zamek magnetyczny z magnesami wpuszczanymi; uchwyt obustronny" },
      { label: "Siatka", value: "włókno szklane powlekane PVC (szara lub czarna); opcja: aluminiowa, stalowa" },
      { label: "Opcje", value: "przejście dla zwierząt, wypełnienie dolne z lexanu, dwa skrzydła, poprzeczka" },
      { label: "Kolory profili", value: "biały RAL 9016, antracyt RAL 7016, brąz RAL 8017 / 8003 / 8022 / 8028, czarny RAL 9005 / 9004, surowe aluminium oraz okleiny: złoty dąb, orzech, winchester, mahoń, turner oak" },
      { label: "Montaż", value: "do ramy drzwi, ościeża lub ściany; otwieranie na zewnątrz lub do wewnątrz" },
    ],
  },
  faq: [
    { q: "Czy moskitiera drzwiowa będzie kolidować z roletą zewnętrzną lub barierką?", a: "Sprawdzamy to przy pomiarze: jeśli na zewnątrz brakuje miejsca, skrzydło otwieramy do wewnątrz albo proponujemy moskitierę przesuwną lub plisowaną." },
    { q: "Czy pies nie zniszczy siatki?", a: "Do domu ze zwierzętami polecamy dolny panel z lexanu (przezroczysty, odporny na pazury) i klapkę dla zwierząt - wtedy pies sam wychodzi, a siatka zostaje cała." },
    { q: "Jak podać wymiary?", a: "Zmierz szerokość i wysokość światła ościeża drzwi (w kilku miejscach) i napisz, ile masz miejsca obok drzwi na otwarte skrzydło. Resztę dobierzemy my." },
    { q: "Czy moskitierę zdejmuje się na zimę?", a: "Nie trzeba - rama i siatka są odporne na mróz. Jeśli wolisz zdjąć, odkręca się tylko zawiasy." },
  ],
  related: ["moskitiery-przesuwne", "moskitiery-plisowane", "rolety-zewnetrzne"],
  ownerNote: "Zdjęcia z moskitosystem.com.pl są głównie detalami (zawias, zamek, narożnik). Brak zdjęcia realizacji na tarasie - warto dołożyć własne.",
};
