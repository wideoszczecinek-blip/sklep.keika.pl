import type { OfertaContent } from "../types";

// Moskitiery drzwiowe - spójne z opisem i FAQ na keika.pl (keika-www:
// scripts/seed-content-v3.ts, scripts/faq/moskitiery.ts) oraz katalogiem
// systemu drzwiowego MOSKITO (moskitosystem.com.pl): rama ze wzmocnionego
// profilu aluminiowego z poprzeczką i listwą kopnięciową, zawiasy, magnesy
// domykające, uchwyt, uszczelka szczotkowa; otwieranie na zewnątrz; montaż na
// wkręty do ramy drzwi lub futryny; jedno- lub dwuskrzydłowa. Kolory profili
// jak w moskitierach ramkowych w sklepie (7). Siatka jak w sklepie: szara lub
// czarna wzmocniona; opcja aluminiowa.
export const MOSKITIERY_DRZWIOWE: OfertaContent = {
  slug: "moskitiery-drzwiowe",
  path: "/moskitiery-drzwiowe",
  group: "moskitiery",
  menuLabel: "Moskitiery drzwiowe",
  seoTitle: "Moskitiery drzwiowe na wymiar - na zawiasach, z magnesami | KEIKA",
  seoDescription:
    "Moskitiera drzwiowa na wymiar na drzwi balkonowe i tarasowe: wzmocniona rama aluminiowa z poprzeczką i listwą kopnięciową, zawiasy, magnesy domykające, uchwyt. Jedno- lub dwuskrzydłowa, 7 kolorów profili, siatka szara lub czarna. Bezpłatna wycena.",
  eyebrow: "Moskitiery",
  title: "Moskitiery drzwiowe na wymiar",
  lead:
    "Otwierasz jak drzwi, a magnesy zamykają za Tobą - wychodzisz na taras z rękami pełnymi talerzy i nie martwisz się o komary. Wzmocniona rama aluminiowa z poprzeczką i listwą kopnięciową, na wymiar Twoich drzwi balkonowych lub tarasowych, w kolorze stolarki.",
  hero: { src: "/oferta/moskitiery-drzwiowe/hero.jpg", alt: "Biała moskitiera drzwiowa z dolnym panelem na drzwiach balkonowych w drewnianej ramie" },
  heroChips: ["Zawiasy i magnesy domykające", "Poprzeczka i listwa kopnięciowa", "Jedno- lub dwuskrzydłowa", "7 kolorów profili"],
  productLabel: "Moskitiery drzwiowe",
  quoteOptions: [
    "Moskitiera drzwiowa jednoskrzydłowa",
    "Moskitiera drzwiowa dwuskrzydłowa",
    "Z przejściem dla zwierząt",
    "Nie wiem - proszę o doradztwo",
  ],
  supplier: { name: "MOSKITO", note: "profile systemu drzwiowego polskiego producenta; ramy robimy na wymiar u siebie" },
  variants: {
    title: "Jedno skrzydło, dwa albo z przejściem dla zwierząt",
    intro: "Rama jest zawsze ta sama: wzmocniony profil aluminiowy, poprzeczka usztywniająca, listwa kopnięciowa na dole, uszczelka szczotkowa na obwodzie, zawiasy, uchwyt i magnesy domykające.",
    items: [
      {
        id: "jedno",
        name: "Jednoskrzydłowa",
        tagline: "Standard na drzwi balkonowe i tarasowe",
        body: "Skrzydło na zawiasach otwiera się na zewnątrz, więc nie koliduje z drzwiami balkonowymi otwieranymi do środka. Po puszczeniu magnesy na krawędzi domykają je same. Stronę zawiasów ustalamy przy pomiarze - pod Twoje przyzwyczajenia i miejsce obok drzwi.",
        image: "/oferta/moskitiery-drzwiowe/g1.jpg",
        imageAlt: "Narożnik ramy moskitiery drzwiowej z zawiasem",
        bullets: ["Zawiasy z regulacją, magnesy domykające, uchwyt", "Poprzeczka usztywniająca i listwa kopnięciowa", "Dolna krawędź nad podłożem - bez progu"],
        quoteOption: "Moskitiera drzwiowa jednoskrzydłowa",
      },
      {
        id: "dwa",
        name: "Dwuskrzydłowa",
        tagline: "Na drzwi dwuskrzydłowe i szersze otwory",
        body: "Dwa skrzydła na zawiasach, z magnesami domykającymi na styku. Rozwiązanie na drzwi dwuskrzydłowe i szersze wyjścia, gdzie jedno skrzydło byłoby za ciężkie. Przy drzwiach przesuwnych HST i PSK polecamy jednak moskitierę przesuwną albo plisowaną.",
        image: "/oferta/moskitiery-drzwiowe/g2.jpg",
        imageAlt: "Zamek magnetyczny na profilu moskitiery drzwiowej",
        bullets: ["Magnesy na styku skrzydeł", "Każde skrzydło na własnych zawiasach", "Montaż do ramy drzwi lub futryny"],
        quoteOption: "Moskitiera drzwiowa dwuskrzydłowa",
      },
      {
        id: "zwierzeta",
        name: "Z przejściem dla zwierząt",
        tagline: "Kot i pies wychodzą sami",
        body: "W dolnym polu ramy, pod poprzeczką, montujemy klapkę dla zwierząt z katalogu producenta profili. Listwa kopnięciowa i poprzeczka przejmują uderzenia łapą, a siatka w górnym polu zostaje nienaruszona. Przy zwierzętach polecamy też siatkę wzmocnioną odporną na pazury.",
        image: "/oferta/moskitiery-drzwiowe/hero.jpg",
        imageAlt: "Moskitiera drzwiowa ze wzmocnionym dolnym polem ramy",
        bullets: ["Klapka w dolnym polu ramy", "Siatka wzmocniona lub aluminiowa na życzenie", "W kolorze profili"],
        quoteOption: "Z przejściem dla zwierząt",
      },
    ],
  },
  features: [
    { icon: "shield", title: "Wzmocniona rama", body: "Poprzeczka i listwa kopnięciowa na dole - rama wytrzymuje dzieci, psy i codzienne wychodzenie na taras bez wykrzywiania." },
    { icon: "tools", title: "Samodomykanie", body: "Magnesy na krawędzi skrzydła zamykają moskitierę za Tobą. Zawiasy i siłę domykania regulujemy przy montażu i w serwisie po sezonie." },
    { icon: "wind", title: "Powietrze tak, owady nie", body: "Siatka z włókna szklanego, szara lub czarna, nie ogranicza przewiewu. Przy zwierzętach - wersja wzmocniona albo aluminiowa." },
    { icon: "palette", title: "W kolorze Twoich drzwi", body: "Biały, brąz, antracyt oraz okleiny złoty dąb, orzech, mahoń i winchester - jak w moskitierach okiennych." },
  ],
  gallery: [
    { src: "/oferta/moskitiery-drzwiowe/g3.jpg", alt: "Zawias moskitiery drzwiowej w białej ramie", caption: "Zawias w białej ramie" },
    { src: "/oferta/moskitiery-drzwiowe/g4.jpg", alt: "Narożnik ciemnej ramy moskitiery z uszczelką szczotkową", caption: "Uszczelka szczotkowa i narożnik" },
    { src: "/oferta/moskitiery-drzwiowe/g5.jpg", alt: "Zbliżenie na siatkę z włókna szklanego w czarnej ramie", caption: "Siatka z włókna szklanego" },
    { src: "/oferta/moskitiery-drzwiowe/g6.jpg", alt: "Ekspozycja ram moskitierowych w showroomie producenta profili", caption: "Profile systemu MOSKITO" },
  ],
  specs: {
    title: "Najważniejsze parametry",
    items: [
      { label: "Rama", value: "wzmocniony profil aluminiowy z poprzeczką usztywniającą i dolną listwą kopnięciową, narożniki, uszczelka szczotkowa na obwodzie" },
      { label: "Otwieranie", value: "na zawiasach, na zewnątrz; magnesy domykające, uchwyt; strona zawiasów do wyboru" },
      { label: "Wersje", value: "jednoskrzydłowa, dwuskrzydłowa (magnesy na styku skrzydeł), z przejściem dla zwierząt" },
      { label: "Siatka", value: "włókno szklane, szara lub czarna (wzmocniona); na życzenie aluminiowa odporna na pazury" },
      { label: "Kolory profili", value: "biały, brąz, antracyt, złoty dąb, orzech, mahoń, winchester" },
      { label: "Montaż", value: "na wkręty do ramy drzwi lub futryny, ok. 30 minut; mierzymy światło ościeżnicy od zewnątrz i miejsce na zawiasy" },
      { label: "Realizacja", value: "ramy robimy na wymiar u siebie - termin podajemy przy wycenie" },
    ],
  },
  faq: [
    { q: "W którą stronę otwiera się skrzydło?", a: "Standardowo na zewnątrz, żeby nie kolidowało z drzwiami balkonowymi otwieranymi do środka. Stronę zawiasów ustalamy przy pomiarze." },
    { q: "Czy pasuje do drzwi z roletą zewnętrzną?", a: "Zwykle tak - mocujemy ją do ramy drzwi lub futryny, a roleta pracuje w swoich prowadnicach. Liczy się odstęp między prowadnicą rolety a ramą; przy ciasnych ościeżach proponujemy moskitierę plisowaną albo przesuwną." },
    { q: "Czy skrzydło wytrzyma dzieci i psa?", a: "Tak - ramę wzmacniamy poprzeczką, a na dole montujemy listwę kopnięciową, która przejmuje uderzenia łapą i kopnięcia. Przy zwierzętach polecamy siatkę wzmocnioną." },
    { q: "Czy jest próg, o który można się potknąć?", a: "Nie - dolna krawędź skrzydła zostaje nad podłożem. Jeśli zależy Ci na całkowicie płaskim przejściu na bardzo szerokich drzwiach, rozważ moskitierę plisowaną." },
    { q: "Jak zmierzyć drzwi?", a: "Szerokość i wysokość światła ościeżnicy od zewnątrz oraz miejsce na zawiasy. Do wyceny wystarczą wymiary orientacyjne, dokładny pomiar zrobimy przy montażu." },
    { q: "Czy da się ją zdjąć na zimę?", a: "Tak, skrzydło zdejmuje się z zawiasów. Nie jest to konieczne, ale wiele osób tak robi, żeby zimą nie zawadzało przy drzwiach." },
    { q: "Co wybrać do szerokich drzwi tarasowych?", a: "Przy drzwiach przesuwnych HST i PSK lepsza będzie moskitiera przesuwna albo plisowana - skrzydło na zawiasach przy dużych szerokościach staje się ciężkie i niewygodne." },
  ],
  related: ["moskitiery-przesuwne", "moskitiery-plisowane", "rolety-zewnetrzne"],
  ownerNote: "Treść ujednolicona z opisem i FAQ moskitier drzwiowych na keika.pl (poprzeczka, listwa kopnięciowa, magnesy, zawiasy, otwieranie na zewnątrz, 1 lub 2 skrzydła, 7 kolorów jak w ramkowych). Zdjęcia to detale z moskitosystem.com.pl - warto dołożyć realizację na tarasie.",
};
