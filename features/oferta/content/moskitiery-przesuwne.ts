import type { OfertaContent } from "../types";

// Moskitiery przesuwne - system przesuwny MOSKITO (prowadnica górna i dolna,
// skrzydło na rolkach, klamka, uszczelki szczotkowe). Zdjęć producenta jest
// mało i są niewielkie - hero wyświetlany w trybie "contain".
export const MOSKITIERY_PRZESUWNE: OfertaContent = {
  slug: "moskitiery-przesuwne",
  path: "/moskitiery-przesuwne",
  group: "moskitiery",
  menuLabel: "Przesuwne",
  seoTitle: "Moskitiery przesuwne na wymiar - na drzwi tarasowe HST i balkony | KEIKA",
  seoDescription:
    "Moskitiera przesuwna na wymiar do drzwi tarasowych, przesuwnych i HST: skrzydło w prowadnicach na rolkach, jedno lub dwa skrzydła, niski próg. Aluminiowe profile w kolorze stolarki. Bezpłatna wycena.",
  eyebrow: "Moskitiery",
  title: "Moskitiery przesuwne na wymiar",
  lead:
    "Kiedy nie ma miejsca na otwierane skrzydło - albo gdy drzwi są szerokie i przesuwne - moskitiera jedzie po prowadnicach jak drzwi tarasowe. Jedno lub dwa skrzydła, cichy bieg na rolkach, bez zawiasów i magnesów na drodze.",
  hero: { src: "/oferta/moskitiery-przesuwne/hero.jpg", alt: "Prowadnica i narożnik moskitiery przesuwnej na drewnianej ramie drzwi", fit: "contain" },
  heroChips: ["Do drzwi przesuwnych i HST", "Jedno lub dwa skrzydła", "Rolki i uszczelki szczotkowe", "Profile w kolorze stolarki"],
  productLabel: "Moskitiery przesuwne",
  quoteOptions: [
    "Przesuwna jednoskrzydłowa",
    "Przesuwna dwuskrzydłowa",
    "Do drzwi HST (podnoszono-przesuwnych)",
    "Nie wiem - proszę o doradztwo",
  ],
  supplier: { name: "MOSKITO", note: "system przesuwny polskiego producenta profili moskitierowych" },
  variants: {
    title: "Jedno skrzydło czy dwa?",
    intro: "Prowadnice górna i dolna są wspólne. Liczbę skrzydeł dobieramy do szerokości przejścia i tego, w którą stronę otwierają się drzwi.",
    items: [
      {
        id: "jedno",
        name: "Jednoskrzydłowa",
        tagline: "Do drzwi balkonowych i tarasowych",
        body: "Jedno skrzydło przesuwa się wzdłuż stałej części drzwi - tak jak skrzydło drzwi tarasowych. Nie zajmuje miejsca ani na zewnątrz, ani w środku, więc nie koliduje z barierką, roletą czy meblami.",
        image: "/oferta/moskitiery-przesuwne/g1.jpg",
        imageAlt: "Dolna prowadnica i narożnik skrzydła moskitiery przesuwnej",
        bullets: ["Skrzydło na rolkach z uszczelkami szczotkowymi", "Klamka z obu stron", "Otwieranie w lewo lub w prawo"],
      },
      {
        id: "dwa",
        name: "Dwuskrzydłowa",
        tagline: "Na szerokie przejścia i drzwi HST",
        body: "Dwa skrzydła na wspólnych prowadnicach, schodzące się na środku. Do drzwi podnoszono-przesuwnych (HST) i szerokich wyjść na taras - każde skrzydło jest lżejsze i lepiej prowadzone.",
        image: "/oferta/moskitiery-przesuwne/g4.jpg",
        imageAlt: "Moskitiera na drzwiach balkonowych w drewnianej ramie",
        bullets: ["Każde skrzydło na własnych rolkach", "Uszczelka na styku skrzydeł", "Możliwe skrzydła o różnej szerokości"],
      },
    ],
  },
  features: [
    { icon: "home", title: "Zero miejsca na otwieranie", body: "Skrzydło przesuwa się wzdłuż drzwi - idealne, gdy na zewnątrz jest barierka, roleta lub mało miejsca." },
    { icon: "wind", title: "Cichy bieg", body: "Rolki w dolnej prowadnicy i uszczelki szczotkowe na obwodzie - skrzydło nie klekocze i nie wpuszcza owadów szczelinami." },
    { icon: "ruler", title: "Pod każdą szerokość", body: "Profile prowadnic w długościach do 4,5 m - zasłonimy także szerokie drzwi tarasowe i HST." },
    { icon: "palette", title: "Profile w kolorze okien", body: "Biały, brąz, antracyt oraz okleiny złoty dąb, orzech, mahoń i winchester - jak w moskitierach okiennych." },
  ],
  gallery: [
    { src: "/oferta/moskitiery-przesuwne/g2.jpg", alt: "Narożnik ciemnej ramy moskitiery z uszczelką szczotkową", caption: "Uszczelka szczotkowa" },
    { src: "/oferta/moskitiery-przesuwne/g3.jpg", alt: "Zbliżenie siatki z włókna szklanego w czarnej ramie", caption: "Siatka z włókna szklanego" },
  ],
  specs: {
    title: "Najważniejsze parametry",
    items: [
      { label: "System", value: "prowadnica górna i dolna z aluminium, skrzydło na rolkach, klamka obustronna, uszczelki szczotkowe" },
      { label: "Skrzydła", value: "jedno lub dwa, z blokadą; szerokość i podział dobierane do drzwi; ramy robimy na wymiar u siebie" },
      { label: "Siatka", value: "włókno szklane, szara lub czarna (wzmocniona); na życzenie aluminiowa odporna na pazury" },
      { label: "Kolory profili", value: "biały, brąz, antracyt, złoty dąb, orzech, mahoń, winchester - jak w moskitierach okiennych" },
      { label: "Montaż", value: "prowadnice do ramy drzwi, ościeża lub do podłogi i nadproża; wymagany pomiar w kilku punktach" },
      { label: "Opcje", value: "przejście dla zwierząt, poprzeczka usztywniająca" },
    ],
  },
  faq: [
    { q: "Czy dolna prowadnica nie będzie przeszkadzać w przejściu?", a: "Prowadnica dolna jest niska i płaska; przy progach bezbarierowych możemy zastosować moskitierę plisowaną z progiem o wysokości kilku milimetrów." },
    { q: "Przesuwna czy plisowana?", a: "Przesuwna ma sztywne skrzydło i jest tańsza; plisowana składa się w harmonijkę i ma najniższy próg - wybierz ją, gdy przejście ma być w pełni wolne i bardzo szerokie." },
    { q: "Czy pasuje do drzwi HST?", a: "Tak, w wersji dwuskrzydłowej - potrzebujemy wymiarów światła ościeża i informacji, po której stronie jest część stała drzwi." },
  ],
  related: ["moskitiery-plisowane", "moskitiery-drzwiowe", "rolety-zewnetrzne"],
  ownerNote: "Producent (moskitosystem.com.pl) ma tylko małe zdjęcia detali (600×400). Do publikacji warto dołożyć 2-3 własne zdjęcia z montażu.",
};
