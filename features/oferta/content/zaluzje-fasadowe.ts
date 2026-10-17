import type { OfertaContent } from "../types";

// Żaluzje fasadowe ALUPROF SkyFlow: adaptacyjne SZF/A, podtynkowe BOX
// (Basic / Edge / Compact), lamele C-80 i Z-90. Liczby z aluprof.com.
export const ZALUZJE_FASADOWE: OfertaContent = {
  slug: "zaluzje-fasadowe",
  path: "/zaluzje-fasadowe",
  group: "zewnetrzne",
  menuLabel: "Żaluzje fasadowe",
  seoTitle: "Żaluzje fasadowe ALUPROF SkyFlow na wymiar - lamele C-80 i Z-90 | KEIKA",
  seoDescription:
    "Zewnętrzne żaluzje fasadowe na wymiar: lamele C-80 (obrót 0–180°) i Z-90 (pełniejsze zaciemnienie), wersja adaptacyjna na elewację i podtynkowa. Do 4,5 m szerokości, napęd elektryczny, czujniki wiatru i słońca. Wycena z pomiarem.",
  eyebrow: "Osłony zewnętrzne",
  title: "Żaluzje fasadowe na wymiar",
  lead:
    "Światło tak, upał nie. Aluminiowe lamele przed szybą obracasz pod kątem do słońca - wnętrze zostaje jasne, ale się nie nagrzewa, a z zewnątrz nikt nie zagląda. Rozwiązanie z nowoczesnych biurowców, dziś coraz częściej w domach z dużymi przeszkleniami.",
  hero: { src: "/oferta/zaluzje-fasadowe/hero.jpg", alt: "Nowoczesny dom z żaluzjami fasadowymi na dużych przeszkleniach" },
  heroChips: ["Lamele C-80 i Z-90", "Do 4,5 m szerokości", "Adaptacyjne lub podtynkowe", "Czujniki wiatru i słońca"],
  productLabel: "Żaluzje fasadowe",
  quoteOptions: [
    "Adaptacyjne SZF/A (na elewację lub we wnęce)",
    "Podtynkowe BOX (dom w budowie)",
    "Nie wiem - proszę o doradztwo",
  ],
  supplier: { name: "ALUPROF", note: "system żaluzji fasadowych SkyFlow" },
  variants: {
    title: "Wersja adaptacyjna czy podtynkowa?",
    intro: "Obie pracują na tych samych lamelach i napędach. Różnica to kaseta: widoczna na elewacji albo ukryta pod tynkiem.",
    items: [
      {
        id: "szfa",
        name: "SkyFlow SZF/A - adaptacyjna",
        tagline: "Na elewację lub we wnękę, do domu, który już stoi",
        body: "Kaseta z blachy aluminiowej 1,2 mm (na życzenie 2,0 mm) w czterech wariantach zabudowy. Prowadnice aluminiowe z uszczelkami wygłuszającymi albo linkowe. Pojedyncza żaluzja do 4500 × 4000 mm.",
        image: "/oferta/zaluzje-fasadowe/szf.jpg",
        imageAlt: "Żaluzja fasadowa SkyFlow SZF/A z kasetą na elewacji",
        bullets: ["Prowadnice aluminiowe: do 4,5 × 4,0 m (18 m²)", "Prowadnice linkowe: do 3,0 × 4,0 m lub 4,0 × 2,5 m", "Prowadnica podwójna do dzielenia żaluzji"],
      },
      {
        id: "box",
        name: "SkyFlow BOX - podtynkowa",
        tagline: "Niewidoczna kaseta, dom w budowie",
        body: "Kaseta w formie boxu, którego czoło tynkuje się razem z elewacją - po wykończeniu widać tylko lamele. Boxy typu 2 i 4 mają dodatkowe docieplenie nadproża, a wersje 1 i 2 pokrywę rewizyjną.",
        image: "/oferta/zaluzje-fasadowe/box.jpg",
        imageAlt: "Żaluzja podtynkowa SkyFlow BOX w przekroju z lamelami C-80",
        bullets: ["Do 4,5 m szerokości i 3,0 m wysokości", "Zatrzaskowe prowadnice PT02_Z / PT03_Z", "Warianty Basic, Edge i Compact"],
      },
    ],
  },
  features: [
    { icon: "sun", title: "Jasno, ale chłodno", body: "Lamele zatrzymują promienie przed szybą i kierują światło w głąb pomieszczenia. Latem oznacza to kilka stopni mniej bez klimatyzacji." },
    { icon: "eye", title: "Prywatność bez zasłaniania", body: "Ustawione pod kątem lamele odcinają widok z zewnątrz, a Ty nadal widzisz ogród." },
    { icon: "wind", title: "Lamele C i Z", body: "C-80 obraca się w zakresie 0–180° i jest sztywna na wiatr. Z-90 obraca się 0–90°, ma uszczelkę wygłuszającą i daje pełniejsze zaciemnienie." },
    { icon: "clock", title: "Pełna automatyka", body: "Silnik, pilot, czujnik wiatru chroniący żaluzję, czujnik słońca ustawiający lamele - i sterowanie z telefonu." },
  ],
  gallery: [
    { src: "/oferta/zaluzje-fasadowe/g1.jpg", alt: "Dom z pergolą i żaluzjami fasadowymi na oknach tarasowych", caption: "Żaluzje fasadowe i pergola" },
    { src: "/oferta/zaluzje-fasadowe/g2.jpg", alt: "Willa z basenem i żaluzjami fasadowymi na piętrze", caption: "Lamele na piętrze i parterze" },
    { src: "/oferta/zaluzje-fasadowe/g3.jpg", alt: "Przekrój boxu podtynkowego z lamelami C-80 i prowadnicą", caption: "Box podtynkowy C-80" },
    { src: "/oferta/zaluzje-fasadowe/schemat.jpg", alt: "Rysunek techniczny lameli C-80 i maksymalnych wymiarów żaluzji", caption: "Lamela C-80 - 80,4 mm" },
  ],
  specs: {
    title: "Najważniejsze parametry",
    items: [
      { label: "Lamele", value: "C-80 (obrót 0–180°, zawinięte krawędzie, sztywne na wiatr), Z-90 (obrót 0–90°, uszczelka wygłuszająca, pełniejsze zaciemnienie), także C-50" },
      { label: "Maks. wymiary - SZF/A", value: "prowadnice aluminiowe 4500 × 4000 mm (18 m²); linkowe 3000 × 4000 mm lub 4000 × 2500 mm (12 m²)" },
      { label: "Maks. wymiary - BOX", value: "4,5 m szerokości × 3,0 m wysokości" },
      { label: "Kaseta", value: "blacha aluminiowa 1,2 mm (opcja 2,0 mm), 4 warianty zabudowy; box podtynkowy typ 1–5" },
      { label: "Napęd", value: "elektryczny (Somfy, Elero, Geiger), pilot lub przełącznik, czujniki wiatru / słońca / deszczu, integracja z domem inteligentnym" },
      { label: "Kolory", value: "RAL 9016 ultra biały, 7016 antracyt, 9006 srebrny, 9007 szare aluminium, 9005 czarny, 7035 / 7038 / 7048 szarości, 1015 kość słoniowa, VSR 780 miedziany brąz" },
    ],
  },
  faq: [
    { q: "Żaluzje fasadowe czy rolety zewnętrzne?", a: "Rolety zamykają okno szczelnie (ciemność, cisza, bezpieczeństwo). Żaluzje regulują światło stopniowo i wyglądają lżej na nowoczesnej elewacji - to wybór do dużych przeszkleń, gdzie nie chcesz rezygnować ze światła dziennego." },
    { q: "Czy wiatr nie uszkodzi lameli?", a: "Żaluzja ma czujnik wiatru, który automatycznie ją podnosi po przekroczeniu bezpiecznej prędkości. Lamele C-80 mają zawinięte krawędzie dla sztywności, a prowadnice aluminiowe uszczelki tłumiące stukanie." },
    { q: "Czy montaż jest możliwy w domu, który już stoi?", a: "Tak - wersja adaptacyjna SZF/A montuje się na elewacji lub we wnęce okiennej. Podtynkowy BOX wymaga zaplanowania przed tynkowaniem." },
    { q: "Czy mogę sterować wszystkimi żaluzjami naraz?", a: "Tak, centralka lub aplikacja steruje grupami żaluzji, a czujnik słońca sam ustawia lamele w ciągu dnia." },
  ],
  related: ["rolety-zewnetrzne", "markizy", "moskitiery-przesuwne"],
  ownerNote: "Zdjęcia: wizualizacje aluprof.com (skyflow_06/09/15), renderingi kaset. Brak zdjęć z realizacji KEIKA.",
};
