import type { OfertaContent } from "../types";

// Zadaszenia tarasów (10.11.2026) - treść na wzór keika.pl/oferta/taras/veranda
// (zadaszenie aluminiowe z dachem ze szkła lub poliwęglanu, system Veranda
// z tkaniną). Zdjęcie: system Veranda (SELT) z keika.pl. Bez terminów, cen i obietnic.
export const ZADASZENIA: OfertaContent = {
  slug: "zadaszenia",
  path: "/zadaszenia",
  group: "taras",
  menuLabel: "Zadaszenia",
  seoTitle: "Zadaszenia tarasów na wymiar - aluminium, szkło, poliwęglan, system Veranda | KEIKA",
  seoDescription:
    "Zadaszenia tarasów na wymiar: konstrukcja aluminiowa mocowana do ściany domu, dach ze szkła lub poliwęglanu, system Veranda z tkaniną. Kolory RAL, możliwe boki ze screenów. Zapytaj o wycenę.",
  eyebrow: "Taras",
  title: "Zadaszenia tarasów na wymiar",
  lead:
    "Aluminiowa konstrukcja przy ścianie domu, która chroni taras od góry - z dachem ze szkła lub poliwęglanu albo w systemie Veranda z naciąganą tkaniną. Projektowana pod konkretny taras.",
  hero: { src: "/oferta/zadaszenia/hero.jpg", alt: "Zadaszenie tarasu z dachem szklanym i tkaniną przeciwsłoneczną na konstrukcji aluminiowej" },
  heroChips: ["Konstrukcja aluminiowa", "Szkło lub poliwęglan", "System Veranda z tkaniną", "Kolory RAL"],
  productLabel: "Zadaszenia tarasów",
  quoteOptions: [
    "Zadaszenie z dachem szklanym",
    "Zadaszenie z dachem z poliwęglanu",
    "System Veranda z tkaniną (markizową lub screen)",
    "Zadaszenie nad wejście / podjazd",
    "Nie wiem - proszę o doradztwo",
  ],
  variants: {
    title: "Jakie zadaszenie?",
    intro: "Konstrukcja jest mocowana jedną stroną do ściany domu, drugą opiera się na słupach. Różni się wypełnieniem dachu.",
    items: [
      {
        id: "szklo",
        name: "Dach ze szkła",
        tagline: "Przejrzysty i elegancki",
        body: "Szkło jest przejrzyste i łatwiejsze w utrzymaniu czystości, ale cięższe. Pod szkłem latem może być gorąco, dlatego często dokłada się na dach tkaninę przeciwsłoneczną albo screeny.",
        quoteOption: "Zadaszenie z dachem szklanym",
        bullets: ["Rynna ukryta w belce czołowej, spusty w słupach", "Możliwe oświetlenie LED w belkach", "Boki można domknąć screenami lub szkłem przesuwnym"],
      },
      {
        id: "poliweglan",
        name: "Dach z poliwęglanu",
        tagline: "Lżejszy, rozprasza światło",
        body: "Poliwęglan jest lżejszy od szkła i lepiej rozprasza światło, przez co pod nim nagrzewa się mniej. Dobry wybór na tarasy od południa.",
        quoteOption: "Zadaszenie z dachem z poliwęglanu",
        bullets: ["Poliwęglan komorowy nagrzewa się mniej niż szkło", "Ta sama konstrukcja aluminiowa i odwodnienie", "Kolor konstrukcji z palety RAL"],
      },
      {
        id: "veranda",
        name: "System Veranda z tkaniną",
        tagline: "Naciągana tkanina markizowa lub screen",
        body: "Konstrukcja z prowadnicami i naciągiem tkaniny pozwala osłonić duże powierzchnie i lepiej znosi podmuchy wiatru niż klasyczna markiza. Tkaninę można zwinąć, gdy chcesz pełnego słońca.",
        image: "/oferta/zadaszenia/hero.jpg",
        imageAlt: "System Veranda - tkanina rozwinięta nad dachem zadaszenia",
        quoteOption: "System Veranda z tkaniną (markizową lub screen)",
        bullets: ["Tkanina markizowa albo screen", "Prowadnice i naciąg tkaniny", "Można łączyć z dachem szklanym"],
      },
    ],
  },
  features: [
    { icon: "home", title: "Taras przez cały sezon", body: "Stały dach nie wymaga zwijania na czas deszczu, a domknięte boki przedłużają korzystanie z tarasu jesienią." },
    { icon: "palette", title: "Kolor pod stolarkę", body: "Konstrukcja aluminiowa lakierowana proszkowo w palecie RAL - najczęściej antracyt, biel albo kolor okien." },
    { icon: "wind", title: "Odwodnienie w konstrukcji", body: "Woda spływa do rynny ukrytej w belce czołowej i rurami w słupach - spadek i odwodnienie ustala się przy projekcie." },
    { icon: "sun", title: "Do rozbudowy", body: "Na dach można dołożyć tkaninę przeciwsłoneczną, z boku screeny albo shuttersy, w belkach oświetlenie LED." },
  ],
  gallery: [],
  specs: {
    title: "Najważniejsze informacje",
    items: [
      { label: "Konstrukcja", value: "aluminium lakierowane proszkowo, mocowanie do ściany domu i na słupach" },
      { label: "Wypełnienie dachu", value: "szkło, poliwęglan albo tkanina (system Veranda)" },
      { label: "Odwodnienie", value: "rynna w belce czołowej, spusty w słupach" },
      { label: "Kolory", value: "paleta RAL" },
      { label: "Dodatki", value: "oświetlenie LED, tkanina przeciwsłoneczna na dach, boki ze screenów, szkła przesuwnego lub paneli" },
      { label: "Pielęgnacja", value: "dach myje się wodą z łagodnym detergentem; raz w sezonie warto oczyścić rynnę i spusty" },
    ],
  },
  faq: [
    { q: "Czym zadaszenie różni się od markizy?", a: "Zadaszenie to stały dach z aluminium z wypełnieniem ze szkła lub poliwęglanu - chroni taras cały rok i nie wymaga zwijania. Markiza to tkanina, którą zwija się na czas deszczu i wiatru." },
    { q: "Szkło czy poliwęglan?", a: "Szkło jest przejrzyste i łatwiej utrzymać je w czystości, ale jest cięższe. Poliwęglan jest lżejszy i lepiej rozprasza światło, więc pod nim jest mniej gorąco." },
    { q: "Czy trzeba pozwolenia na budowę?", a: "Zależy to od powierzchni i przepisów lokalnych - warto sprawdzić to w swojej gminie przed zamówieniem." },
    { q: "Czy zadaszenie da się zamontować na istniejącym tarasie?", a: "Tak, to najczęstszy przypadek. Ważne, żeby podłoże przeniosło obciążenie słupów, a ściana nadawała się do mocowania - opisz je w zapytaniu." },
    { q: "Czy można domknąć boki?", a: "Tak - screenami, szkłem przesuwnym albo panelami (np. shuttersami)." },
    { q: "Ile kosztuje zadaszenie?", a: "Cena zależy od wymiarów, wypełnienia dachu i dodatków. Wyślij formularz z wymiarami tarasu - przygotujemy wycenę." },
  ],
  related: ["markizy", "screeny", "shuttersy"],
};
