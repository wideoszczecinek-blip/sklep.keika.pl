// Rolety tradycyjne w 4 systemach (właściciel, 7.11.2026) - każdy system to
// osobny produkt (opis, galeria, cennik w CRM) z WŁASNYM pomiarem. Wymiary nie
// przechodzą między systemami (decyzja 25.10: inny pomiar = ryzyko złego
// rozmiaru). Klient wpisuje to, co zmierzył, co do milimetra; wymiar rolety
// (cena i produkcja) liczymy tu - bez zaokrągleń.
//
// Słowa właściciela (7.11):
// - MINI: zwykła na ramę okna, bez kasety i prowadnic; prowadzenie żyłkowe
//   +19,90 zł; osprzęt biały/brązowy; pomiar: wysokość skrzydła, szerokość z
//   listwami przyszybowymi.
// - kaseta z prowadnicą płaską (REKOMENDOWANA): materiał pracuje przy szybie;
//   pomiar: szerokość z listwami + szerokość szyby od połowy uszczelki do
//   połowy uszczelki + wysokość z listwami.
// - kaseta z prowadnicą przestrzenną (korytko): szerokość = od kreseczki do
//   kreseczki + 2 × miejsce od kreseczki do klamki (rozstaw prowadnic po
//   zewnętrznej stronie); wysokość = skrzydło, z nawiewnikiem od nawiewnika
//   z 1 cm przerwy do dołu skrzydła.
// - wolnowisząca standard: na ścianę bez kasety i prowadnic; szerokość wnęki
//   + 5 cm z każdej strony, wysokość wnęki + 10 cm na powieszenie nad wnęką;
//   możliwy montaż do sufitu.

export type RoletySystemSlug = "rolety-mini" | "rolety-kaseta-plaska" | "rolety-kaseta-przestrzenna" | "rolety-wolnowiszace";

export const ROLETY_SYSTEM_SLUGS: RoletySystemSlug[] = ["rolety-kaseta-plaska", "rolety-mini", "rolety-kaseta-przestrzenna", "rolety-wolnowiszace"];

export function isRoletySystemSlug(slug: string | null | undefined): slug is RoletySystemSlug {
  return slug === "rolety-mini" || slug === "rolety-kaseta-plaska" || slug === "rolety-kaseta-przestrzenna" || slug === "rolety-wolnowiszace";
}

export type MeasureFieldKey = "a" | "b" | "c";

export type MeasureField = {
  key: MeasureFieldKey;
  label: string;
  /** Krótko: od czego do czego mierzysz. */
  hint: string;
  minMm: number;
  maxMm: number;
};

export type MeasureInput = { a: number; b: number; c: number; vent: boolean; mountId: string };

export type SystemSize = {
  widthMm: number;
  heightMm: number;
  /** Notatka do produkcji: co klient zmierzył i jak policzyliśmy wymiar rolety. */
  note: string;
  /** Jedno zdanie dla klienta pod polami. */
  explain: string;
};

export type RoletySystemCopy = {
  slug: RoletySystemSlug;
  /** „Roleta w kasecie z prowadnicą płaską” - H1 i koszyk. */
  name: string;
  short: string;
  recommended: boolean;
  /** Jedno zdanie na kafelek strony zbiorczej. */
  lead: string;
  pros: string[];
  /** Czego klient potrzebuje zmierzyć - krótko, na kafelek. */
  measureShort: string;
  /** Pola pomiaru (kolejność = kolejność wpisywania). */
  fields: (mountId: string) => MeasureField[];
  /** Pytanie o nawiewnik (przestrzenna). */
  askVent: boolean;
  steps: (mountId: string) => string[];
  size: (input: MeasureInput) => SystemSize;
  /** Ograniczenia wymiaru rolety (zgodne z cennikiem w CRM). */
  widthMinMm: number;
  widthMaxMm: number;
  heightMinMm: number;
  heightMaxMm: number;
};

const cm = (mm: number) => (mm / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 });

export const ROLETY_SYSTEMS: Record<RoletySystemSlug, RoletySystemCopy> = {
  "rolety-kaseta-plaska": {
    slug: "rolety-kaseta-plaska",
    name: "Roleta w kasecie z prowadnicą płaską",
    short: "Kaseta z prowadnicą płaską",
    recommended: true,
    lead: "Tkanina pracuje przy samej szybie, płaskie prowadnice trzymają ją po bokach. Pełne zaciemnienie bez szczelin.",
    pros: ["Najlepsze zaciemnienie", "Okno otwierasz z roletą", "6 kolorów kasety"],
    measureShort: "3 pomiary: szerokość z listwami, szerokość szyby, wysokość z listwami",
    fields: () => [
      { key: "a", label: "Szerokość z listwami przyszybowymi", hint: "od kreseczki do kreseczki - szyba razem z listwami", minMm: 300, maxMm: 1500 },
      { key: "b", label: "Szerokość szyby", hint: "od połowy uszczelki do połowy uszczelki", minMm: 200, maxMm: 1480 },
      { key: "c", label: "Wysokość z listwami przyszybowymi", hint: "od kreseczki u góry do kreseczki u dołu", minMm: 400, maxMm: 2000 },
    ],
    askVent: false,
    steps: () => [
      "Szerokość z listwami: zmierz od kreseczki do kreseczki - od linii, w której listwa przyszybowa styka się z ramą skrzydła, po jednej i drugiej stronie.",
      "Szerokość szyby: od połowy lewej uszczelki do połowy prawej uszczelki.",
      "Wysokość z listwami: od górnej do dolnej kreseczki - szyba razem z listwami.",
      "Wpisz wszystkie trzy wymiary co do milimetra. Kasetę, prowadnice i tkaninę dopasujemy do nich sami.",
    ],
    size: ({ a, b, c }) => ({
      widthMm: a,
      heightMm: c,
      note: `kaseta płaska: szerokość z listwami ${cm(a)} cm, szyba (połowa uszczelki) ${cm(b)} cm, wysokość z listwami ${cm(c)} cm`,
      explain: `Roleta ${cm(a)} × ${cm(c)} cm (szerokość i wysokość z listwami). Szerokość szyby ${cm(b)} cm wykorzystamy do szerokości tkaniny i prowadnic.`,
    }),
    widthMinMm: 300,
    widthMaxMm: 1500,
    heightMinMm: 400,
    heightMaxMm: 2000,
  },
  "rolety-mini": {
    slug: "rolety-mini",
    name: "Roleta MINI na skrzydło",
    short: "MINI na skrzydło",
    recommended: false,
    lead: "Najprostsza i najtańsza: bez kasety i prowadnic, wisi na skrzydle przy szybie. Opcjonalnie z prowadzeniem żyłkowym.",
    pros: ["Najniższa cena", "Montaż w kilka minut", "Żyłka przy uchylaniu +19,90 zł"],
    measureShort: "2 pomiary: szerokość z listwami, wysokość skrzydła",
    fields: () => [
      { key: "a", label: "Szerokość z listwami przyszybowymi", hint: "od kreseczki do kreseczki - szyba razem z listwami", minMm: 300, maxMm: 1500 },
      { key: "c", label: "Wysokość skrzydła", hint: "całe skrzydło - od górnej do dolnej krawędzi ramy", minMm: 400, maxMm: 2200 },
    ],
    askVent: false,
    steps: () => [
      "Szerokość: od kreseczki do kreseczki - szyba razem z listwami przyszybowymi.",
      "Wysokość: całe skrzydło, od górnej do dolnej krawędzi ramy skrzydła.",
      "Wpisz oba wymiary co do milimetra - roletę dopasujemy do nich sami.",
    ],
    size: ({ a, c }) => ({
      widthMm: a,
      heightMm: c,
      note: `MINI: szerokość z listwami ${cm(a)} cm, wysokość skrzydła ${cm(c)} cm`,
      explain: `Roleta ${cm(a)} × ${cm(c)} cm - dokładnie według Twojego pomiaru.`,
    }),
    widthMinMm: 300,
    widthMaxMm: 1500,
    heightMinMm: 400,
    heightMaxMm: 2200,
  },
  "rolety-kaseta-przestrzenna": {
    slug: "rolety-kaseta-przestrzenna",
    name: "Roleta w kasecie z prowadnicą przestrzenną",
    short: "Kaseta z prowadnicą przestrzenną",
    recommended: false,
    lead: "Prowadnice w kształcie korytka na ramie skrzydła. Dla okien z zaokrąglonymi lub wysokimi listwami.",
    pros: ["Pasuje do nietypowych listew", "Bez szczelin po bokach", "6 kolorów kasety"],
    measureShort: "Szerokość między kreseczkami + miejsce do klamki, wysokość skrzydła",
    fields: () => [
      { key: "a", label: "Szerokość od kreseczki do kreseczki", hint: "szyba razem z listwami przyszybowymi", minMm: 250, maxMm: 1450 },
      { key: "b", label: "Miejsce od kreseczki do klamki", hint: "od kreseczki po stronie klamki do krawędzi klamki", minMm: 0, maxMm: 120 },
      { key: "c", label: "Wysokość", hint: "całe skrzydło (przy nawiewniku: od jego dołu do dołu skrzydła)", minMm: 400, maxMm: 2010 },
    ],
    askVent: true,
    steps: () => [
      "Szerokość: zmierz od kreseczki do kreseczki (linia, gdzie listwa przyszybowa styka się z ramą).",
      "Sprawdź, ile miejsca jest od kreseczki do klamki. Tyle samo dodamy po drugiej stronie - tak powstaje rozstaw prowadnic po ich zewnętrznej stronie.",
      "Wysokość: całe skrzydło, od górnej do dolnej krawędzi ramy. Jeśli na górze jest nawiewnik - mierz od dołu nawiewnika do dołu skrzydła; zostawimy 1 cm przerwy pod nawiewnikiem.",
    ],
    size: ({ a, b, c, vent }) => {
      const widthMm = a + 2 * b;
      const heightMm = vent ? Math.max(0, c - 10) : c;
      return {
        widthMm,
        heightMm,
        note: `kaseta przestrzenna: kreseczka-kreseczka ${cm(a)} cm + 2 × do klamki ${cm(b)} cm = rozstaw prowadnic ${cm(widthMm)} cm; wysokość ${vent ? `od nawiewnika ${cm(c)} cm − 1 cm przerwy` : `skrzydła ${cm(c)} cm`} → ${cm(heightMm)} cm`,
        explain: `Roleta ${cm(widthMm)} × ${cm(heightMm)} cm: ${cm(a)} cm + 2 × ${cm(b)} cm do klamki${vent ? ", wysokość pomniejszona o 1 cm przerwy pod nawiewnikiem" : ""}.`,
      };
    },
    widthMinMm: 300,
    widthMaxMm: 1500,
    heightMinMm: 400,
    heightMaxMm: 2000,
  },
  "rolety-wolnowiszace": {
    slug: "rolety-wolnowiszace",
    name: "Roleta wolnowisząca na ścianę",
    short: "Wolnowisząca na ścianę",
    recommended: false,
    lead: "Duża roleta nad wnęką: zasłania całe okno z zapasem, nie dotyka okna. Na ścianę albo do sufitu.",
    pros: ["Do dużych okien i drzwi", "Pasuje do każdego okna", "Do 200 cm szerokości"],
    measureShort: "Szerokość i wysokość wnęki - zapasy doliczymy",
    fields: (mountId) => [
      { key: "a", label: "Szerokość wnęki", hint: "od ściany do ściany we wnęce okiennej", minMm: 300, maxMm: 1900 },
      mountId === "do-sufitu"
        ? { key: "c", label: "Wysokość od sufitu do dołu wnęki", hint: "od sufitu do dolnej krawędzi wnęki (parapetu)", minMm: 500, maxMm: 2500 }
        : { key: "c", label: "Wysokość wnęki", hint: "od górnej krawędzi wnęki do parapetu", minMm: 400, maxMm: 2400 },
    ],
    askVent: false,
    steps: (mountId) => [
      "Zmierz szerokość wnęki okiennej od ściany do ściany. Doliczymy po 5 cm z każdej strony, żeby roleta zachodziła na ścianę.",
      mountId === "do-sufitu"
        ? "Zmierz wysokość od sufitu do dolnej krawędzi wnęki (parapetu) - roleta będzie miała dokładnie tyle."
        : "Zmierz wysokość wnęki od górnej krawędzi do parapetu. Doliczymy 10 cm na powieszenie rolety nad wnęką.",
      "Wpisz wymiary co do milimetra - gotowy wymiar rolety pokażemy od razu.",
    ],
    size: ({ a, c, mountId }) => {
      const ceiling = mountId === "do-sufitu";
      const widthMm = a + 100;
      const heightMm = ceiling ? c : c + 100;
      return {
        widthMm,
        heightMm,
        note: ceiling
          ? `wolnowisząca do sufitu: wnęka ${cm(a)} cm + 2 × 5 cm = ${cm(widthMm)} cm; wysokość od sufitu do dołu wnęki ${cm(c)} cm`
          : `wolnowisząca na ścianę: wnęka ${cm(a)} × ${cm(c)} cm → roleta ${cm(widthMm)} × ${cm(heightMm)} cm (+5 cm z boków, +10 cm nad wnęką)`,
        explain: ceiling
          ? `Roleta ${cm(widthMm)} × ${cm(heightMm)} cm: wnęka + 5 cm z każdej strony, wysokość od sufitu do dołu wnęki.`
          : `Roleta ${cm(widthMm)} × ${cm(heightMm)} cm: wnęka + 5 cm z każdej strony i + 10 cm na powieszenie nad wnęką.`,
      };
    },
    widthMinMm: 400,
    widthMaxMm: 2000,
    heightMinMm: 500,
    heightMaxMm: 2500,
  },
};

/** Porównanie systemów - fakty, bez cen (materiał przed ceną). */
export const ROLETY_SYSTEM_COMPARE: Array<{ label: string; values: Record<RoletySystemSlug, string> }> = [
  { label: "Gdzie wisi", values: { "rolety-kaseta-plaska": "na skrzydle", "rolety-mini": "na skrzydle", "rolety-kaseta-przestrzenna": "na skrzydle", "rolety-wolnowiszace": "na ścianie / suficie" } },
  { label: "Okno uchylisz z roletą", values: { "rolety-kaseta-plaska": "tak", "rolety-mini": "tak", "rolety-kaseta-przestrzenna": "tak", "rolety-wolnowiszace": "nie" } },
  { label: "Szczeliny po bokach", values: { "rolety-kaseta-plaska": "brak", "rolety-mini": "są", "rolety-kaseta-przestrzenna": "brak", "rolety-wolnowiszace": "zapas 5 cm" } },
  { label: "Kolory osprzętu", values: { "rolety-kaseta-plaska": "6", "rolety-mini": "2", "rolety-kaseta-przestrzenna": "6", "rolety-wolnowiszace": "3" } },
];

/** FAQ strony /rolety-tradycyjne (zastępuje stare wpisy rolety mini z CRM - pomiar „+1,5 cm” już nie obowiązuje). */
export const ROLETY_HUB_FAQ: Array<{ question: string; answer: string }> = [
  {
    question: "Który system rolety wybrać?",
    answer:
      "Do większości okien polecamy kasetę z prowadnicą płaską - tkanina pracuje przy szybie i po bokach nie ma szczelin. MINI jest najtańsza i najprostsza. Prowadnica przestrzenna pasuje do okien z zaokrąglonymi lub wysokimi listwami. Wolnowisząca wisi na ścianie nad wnęką - do dużych okien i drzwi balkonowych.",
  },
  {
    question: "Jak zmierzyć okno?",
    answer:
      "Każdy system mierzy się inaczej, dlatego pomiar jest na stronie wybranego systemu: rysunek pokazuje, gdzie przyłożyć miarkę, a konfigurator sam liczy wymiar rolety. Wpisujesz to, co zmierzysz, co do milimetra.",
  },
  {
    question: "Czym różni się Deko od Termo?",
    answer: "Deko przepuszcza rozproszone światło i chroni przed wzrokiem z zewnątrz. Termo nie przepuszcza światła i ma od strony okna powłokę odbijającą ciepło - do sypialni i pokoju dziecka.",
  },
  { question: "Ile czeka się na roletę?", answer: "Produkujemy ją na Twój wymiar i wysyłamy do 10 dni roboczych od zaksięgowania wpłaty." },
  { question: "Jaka jest gwarancja?", answer: "Na rolety z naszej produkcji dajemy 5 lat gwarancji i 30 dni na zwrot." },
];

export const ROLETY_HUB_INSTRUCTIONS: Array<{ title: string; body: string }> = [
  { title: "Wybór systemu", body: "Wybierz system rolety: w kasecie z prowadnicą płaską, MINI, w kasecie z prowadnicą przestrzenną albo wolnowiszącą na ścianę." },
  { title: "Pomiar", body: "Każdy system ma własny pomiar - konfigurator pokazuje go na rysunku i sam liczy wymiar rolety. Mierzysz co do milimetra." },
  { title: "Montaż", body: "Rolety na skrzydło montujesz na oknie i otwierasz razem z nim; wolnowiszącą przykręcasz do ściany lub sufitu. Elementy montażowe są w komplecie." },
];
