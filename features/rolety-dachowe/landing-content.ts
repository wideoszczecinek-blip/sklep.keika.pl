// Built-in landing copy for "Rolety dachowe" (2026-09-18), same role as
// features/plisy/landing-content.ts: rendered as the product's description,
// spec grid, "how it works", fabrics guide, callout and FAQ until the owner
// fills the matching fields in the CRM (Sklep WWW -> Produkty ->
// roleta-dachowa-dekolux), which then take over field by field.
//
// Every fact here comes from the owner's own Allegro offer 18825232620
// (aluminium cassette + side guides + spring mechanism, MULTISTOP brake,
// brush seal on the bottom bar, TERMO 255 g/m² blackout with a silver
// reflective layer, DEKO 175 g/m² translucent, 3 hardware colours, the
// 420-model window library, nameplate photo recognition) and the CRM
// "dachowe" configurator profile (73 fabrics, price matrix 400-2100 x
// 800-2300 mm). Nothing is invented; lead time is what the dispatch banner
// says (the same shipping automat as Allegro, 2 working days of handling).

export type RdSpecItem = { label: string; value: string };
export type RdFeatureBullet = { lead: string; detail?: string };
export type RdFaqEntry = { question: string; answer: string };
export type RdHowItWorksTile = { id: "kaseta" | "prowadnice" | "hamulec" | "montaz"; title: string; body: string };
export type RdFabricTypeRow = {
  /** material-type value in the CRM profile (fabric.materialTypeId) */
  materialTypeId: string;
  name: string;
  tagline: string;
  what: string;
  where: string;
  blackout: boolean;
  thermal: boolean;
  spec: string;
  /** owner's swatch sheet from the offer (public/rolety-dachowe) */
  sheetSrc: string;
  count: number;
};

/** First-paint "od" price - the bundled matrix' cheapest cell (400 x 800,
 * Biały/Anoda + Deko). The live value comes off the fetched profile. */
export const RD_STARTING_PRICE_FALLBACK = 174;

export const RD_H1 = "Rolety do okien dachowych na wymiar";

/** The CRM currently holds this placeholder copy; while it does, the built-in
 * copy wins. Any other CRM text replaces it (the owner edited it). */
export const RD_CRM_PLACEHOLDERS = [
  "Roleta dachowa na wymiar z doborem osprzętu i tkaniny.",
  "Konfigurator rolety dachowej Dekolux z wyborem modelu okna, koloru osprzętu, grupy i kodu tkaniny oraz wyceną przez jednostki zakupowe.",
];

export function isRdPlaceholderCopy(text: string | null | undefined): boolean {
  const normalized = String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  if (!normalized) return true;
  return RD_CRM_PLACEHOLDERS.some((entry) => entry.toLowerCase() === normalized);
}

export const RD_SUBTITLE =
  "Roleta dachowa w aluminiowej kasecie z prowadnicami i mechanizmem sprężynowym, dopasowana do modelu Twojego okna: Velux, Fakro, Roto, OKPOL, Dakstra i inne — ponad 420 modeli w bibliotece. Wybierasz okno, kolor kasety i tkaninę, a cenę widzisz od razu.";

export const RD_PRIMARY_CTA = "Dobierz roletę do swojego okna";

export const RD_DESCRIPTION_HTML =
  "<p><strong>Rolety dachowe KEIKA</strong> to pełny system do okna połaciowego, a nie roletka na haczykach. Tkanina jest stale napięta i prowadzona po bokach w aluminiowych prowadnicach, dolna belka z hamulcem zatrzymuje się w dowolnym miejscu, a aluminiowa kaseta chowa nawinięty materiał. Bez łańcuszka, bez wiszących sznurków, bez ograniczenia do kilku punktów zaczepienia.</p>" +
  "<p><strong>Dopasowana do modelu okna — bez mierzenia.</strong> Wybierz swoje okno z biblioteki ponad 420 modeli (Velux, Fakro, Roto, OKPOL, Dakstra i inne) albo zrób zdjęcie tabliczki znamionowej — odczytamy model automatycznie i dobierzemy właściwy wymiar rolety. Okno spoza listy? Podajesz dwa wymiary, a roletę wykonamy na miarę.</p>" +
  "<p><strong>73 tkaniny w dwóch kolekcjach.</strong> DEKO (54 kolory) miękko rozprasza światło i nie zaciemnia; TERMO (19 kolorów) to tkanina blackout z podgumowaniem i srebrną warstwą refleksyjną od strony szyby — zaciemnia i ogranicza nagrzewanie poddasza. Kaseta, prowadnice i belka w kolorze białym, anodowanym (szary) lub jasnej sosny.</p>" +
  "<p><strong>Kompletna, gotowa do montażu.</strong> W paczce roleta z kasetą, prowadnicami, belką z uchwytem i hamulcem, mechanizm sprężynowy, elementy montażowe i czytelna instrukcja. Montaż do skrzydła okna bez specjalistycznych narzędzi. 5 lat gwarancji, 30 dni na zwrot, darmowa dostawa od 79 zł.</p>";

export const RD_SPEC_ITEMS: RdSpecItem[] = [
  {
    label: "Dopasowana do modelu okna",
    value:
      "Ponad 420 modeli w bibliotece: Velux, Fakro, Roto, OKPOL, Dakstra, Optilight i inne. Wybierasz model, a wymiar rolety dobieramy sami. Nie znasz modelu? Zrób zdjęcie tabliczki znamionowej — odczytamy go automatycznie.",
  },
  {
    label: "Aluminiowa kaseta i prowadnice",
    value:
      "Sztywna, estetyczna zabudowa dopasowana do skrzydła: kaseta, boczne prowadnice i belka z uchwytem — z aluminium, nie z plastiku, który kruszeje na słońcu. 3 kolory: biały, anoda (szary), jasna sosna.",
  },
  {
    label: "Zatrzymanie w dowolnym miejscu",
    value:
      "Mechanizm sprężynowy utrzymuje tkaninę napiętą, a hamulec w belce (system MULTISTOP) pozwala zatrzymać roletę dokładnie tam, gdzie chcesz — nie tylko w kilku punktach.",
  },
  {
    label: "5 lat gwarancji i 30 dni na zwrot",
    value:
      "Rolety produkujemy sami, w Polsce, i dajemy na nie 5 lat gwarancji. Jeżeli produkt nie spełni oczekiwań, masz 30 dni na zwrot.",
  },
];

export const RD_FEATURE_BULLETS: RdFeatureBullet[] = [
  { lead: "Pod model okna, bez mierzenia", detail: "biblioteka ponad 420 modeli — Velux, Fakro, Roto, OKPOL, Dakstra i inne" },
  { lead: "Rozpoznawanie ze zdjęcia", detail: "zrób zdjęcie tabliczki znamionowej na skrzydle, a model okna odczytamy automatycznie" },
  { lead: "73 tkaniny: DEKO i TERMO", detail: "54 kolory rozpraszające światło i 19 tkanin blackout z warstwą termiczną Silver" },
  { lead: "3 kolory osprzętu", detail: "kaseta, prowadnice i belka w kolorze białym, anoda (szary) lub jasna sosna" },
  { lead: "Napięta, prowadzona tkanina", detail: "prowadnice i sprężyna stabilizują materiał na skosie i ograniczają boczne prześwity" },
  { lead: "Dopracowane domknięcie", detail: "uszczelka szczotkowa w dolnej belce ogranicza prześwit przy dolnej krawędzi" },
  { lead: "Kompletna, gotowa do montażu", detail: "kaseta, prowadnice, belka z hamulcem, mechanizm sprężynowy, elementy montażowe i instrukcja w paczce" },
];

export const RD_HOW_IT_WORKS: RdHowItWorksTile[] = [
  {
    id: "kaseta",
    title: "Aluminiowa kaseta",
    body: "Nawinięta tkanina chowa się w kasecie montowanej u góry skrzydła. Mechanizm sprężynowy zwija roletę i utrzymuje materiał napięty niezależnie od stopnia zasłonięcia.",
  },
  {
    id: "prowadnice",
    title: "Boczne prowadnice",
    body: "Tkanina jest prowadzona przy skrzydle w aluminiowych prowadnicach — nie odstaje na skosie, nie łopocze przy uchylonym oknie i ogranicza prześwity po bokach.",
  },
  {
    id: "hamulec",
    title: "Belka z hamulcem",
    body: "Uchwyt z hamulcem MULTISTOP zatrzymuje roletę na dowolnej wysokości. Zasłaniasz tyle okna, ile potrzebujesz — bez łańcuszka i bez haczyków.",
  },
  {
    id: "montaz",
    title: "Montaż do skrzydła",
    body: "System montujesz bezpośrednio do skrzydła okna dachowego — roleta porusza się razem z nim. Wkręty i instrukcja w komplecie, bez specjalistycznych narzędzi.",
  },
];

export const RD_FABRIC_TYPES: RdFabricTypeRow[] = [
  {
    materialTypeId: "polprzepuszczalny",
    name: "DEKO",
    tagline: "Miękko rozprasza światło, nie zaciemnia",
    what: "Lekka, gładka tkanina, która ogranicza ostre światło i chroni prywatność, a pokój zostaje naturalnie doświetlony.",
    where: "Salon, kuchnia, gabinet, korytarz — wszędzie tam, gdzie zależy Ci na świetle, nie na ciemności",
    blackout: false,
    thermal: false,
    spec: "100 % poliester · 175 g/m² · grubość 0,32 mm · tkanina gładka, transparentna · 54 kolory",
    sheetSrc: "/rolety-dachowe/tkaniny-deko.jpg",
    count: 54,
  },
  {
    materialTypeId: "termo",
    name: "TERMO",
    tagline: "Zaciemnia i ogranicza nagrzewanie",
    what: "Tkanina blackout z podgumowaniem: nie przepuszcza światła. Od strony szyby srebrna warstwa refleksyjna odbija promienie słoneczne, od strony pokoju gładka, kolorowa powierzchnia.",
    where: "Sypialnia, pokój dziecka, poddasze od południa — mocno nasłonecznione pomieszczenia",
    blackout: true,
    thermal: true,
    spec: "100 % poliester · 255 g/m² · grubość 0,36 mm · podgumowana BLACKOUT · srebrna warstwa refleksyjna · 19 kolorów",
    sheetSrc: "/rolety-dachowe/tkaniny-termo.jpg",
    count: 19,
  },
];

export const RD_CALLOUT = {
  title: "Rolety nie pasują do okien z zaokrągloną listwą",
  body: "Jeżeli łuk listwy przyszybowej jest minimalny (kilka milimetrów), roleta będzie pasować — natomiast przy oknach z typowo okrągłym profilem niestety nie. W razie wątpliwości zrób zdjęcie okna i dołącz je w konfiguratorze, sprawdzimy dobór przed produkcją.",
};

export const RD_FAQ: RdFaqEntry[] = [
  {
    question: "Ile kosztuje roleta dachowa na wymiar?",
    answer:
      "Cena zależy od wymiaru okna, rodzaju tkaniny (DEKO lub TERMO) i koloru osprzętu. Najmniejsza roleta w kolekcji DEKO kosztuje {{cena_od}}. Dokładną cenę dla swojego okna zobaczysz w konfiguratorze po wybraniu modelu — bez rejestracji i bez zobowiązań.",
  },
  {
    question: "Skąd wziąć model okna?",
    answer:
      "Z tabliczki znamionowej producenta. Zwykle znajdziesz ją po otwarciu skrzydła okna dachowego, na jego górnej lub bocznej krawędzi — jest tam producent i symbol modelu, np. VELUX GGL MK04 albo FAKRO FTP-V U3 78x118. Wpisz go w wyszukiwarce konfiguratora.",
  },
  {
    question: "Czy mogę rozpoznać model ze zdjęcia?",
    answer:
      "Tak. W konfiguratorze kliknij „Wgraj zdjęcie tabliczki” i zrób zdjęcie tabliczki znamionowej. Automat odczyta producenta i model i podpowie pasujące okno z biblioteki — Ty tylko potwierdzasz. Zdjęcie zostaje przy zamówieniu, więc możemy jeszcze raz sprawdzić dobór przed produkcją.",
  },
  {
    question: "Nie ma mojego okna w bibliotece — co wtedy?",
    answer:
      "Wybierz opcję „Nie ma mojego okna” i podaj producenta, model oraz dwa wymiary: A (szerokość) i B (wysokość) miejsca montażu, mierzone na rancie ramy skrzydła — nie przy samej szybie. Roletę wykonamy na miarę, a przed produkcją zweryfikujemy dobór. Możesz też dołączyć zdjęcie okna.",
  },
  {
    question: "Jak zmierzyć wymiar A i B?",
    answer:
      "Wymiar A to szerokość, wymiar B wysokość miejsca montażu rolety na skrzydle — mierzysz od lewej do prawej i od góry do dołu na rancie ramy, w miejscu, gdzie będzie montowana kaseta i prowadnice, nigdy przy samej szybie. Krótki film z pomiarem zobaczysz w zakładce Instrukcje i w formularzu wymiarów.",
  },
  {
    question: "DEKO czy TERMO — którą tkaninę wybrać?",
    answer:
      "DEKO (54 kolory) rozprasza światło i nie zaciemnia — do pomieszczeń, w których chcesz zachować światło dzienne. TERMO (19 kolorów) to tkanina blackout z podgumowaniem i srebrną warstwą refleksyjną od strony szyby: zaciemnia i ogranicza nagrzewanie — do sypialni, pokoju dziecka i nasłonecznionych poddaszy.",
  },
  {
    question: "Czy roleta TERMO całkowicie zaciemnia?",
    answer:
      "Sama tkanina nie przepuszcza światła. Prowadnice boczne, kaseta i uszczelka szczotkowa w dolnej belce ograniczają prześwity, ale przy każdej rolecie montowanej na skrzydle zostaje kilka milimetrów prześwitu na krawędziach — to cecha systemu, nie wada egzemplarza.",
  },
  {
    question: "Jakie kolory kasety i prowadnic są dostępne?",
    answer:
      "Trzy: biały, anoda (szary, naturalne aluminium) i jasna sosna (drewnopodobny). Kaseta, prowadnice i belka są zawsze w tym samym kolorze. Kolor dobierz do ramy okna — biały do białych okien, sosnę do drewnianych, anodę do szarych i antracytowych.",
  },
  {
    question: "Czym ta roleta różni się od roletki na haczykach?",
    answer:
      "Tkanina jest stale napięta sprężyną i prowadzona w bocznych prowadnicach, a hamulec w belce zatrzymuje ją w dowolnym miejscu. Roletki bez prowadnic blokują materiał na haczykach tylko w kilku pozycjach, odstają na skosie i przepuszczają światło po bokach. Do tego u nas aluminium zamiast plastiku, który na słońcu utlenia się i kruszeje.",
  },
  {
    question: "Czy muszę wiercić w oknie?",
    answer:
      "Roleta jest montowana do skrzydła okna dachowego wkrętami z kompletu — to standardowy, przewidziany przez producentów okien sposób montażu osłon wewnętrznych. Montaż jest prosty i intuicyjny, nie wymaga specjalistycznych narzędzi; instrukcja i film montażowy są w zakładce Instrukcje.",
  },
  {
    question: "Czy roleta przeszkadza w otwieraniu okna?",
    answer:
      "Nie. Roleta jest zamontowana na skrzydle i porusza się razem z nim — możesz uchylać i obracać okno jak dotąd. Klamka zostaje wolna.",
  },
  {
    question: "Do jakich okien pasuje?",
    answer:
      "Do okien dachowych (połaciowych) z prostą listwą przyszybową: Velux, Fakro, Roto, OKPOL, Dakstra, Optilight i innych. Nie pasuje do okien z typowo zaokrągloną listwą — minimalny łuk (kilka milimetrów) nie przeszkadza. Jeśli nie masz pewności, dołącz zdjęcie okna w konfiguratorze.",
  },
  {
    question: "Ile trwa realizacja i wysyłka?",
    answer:
      "Roletę produkujemy pod Twoje okno zaraz po zamówieniu — zwykle wysyłamy w ciągu 2 dni roboczych. Aktualny, gwarantowany termin wysyłki pokazujemy nad konfiguratorem. Darmowa dostawa od 79 zł.",
  },
  {
    question: "Co jest w paczce?",
    answer:
      "Roleta z tkaniną nawiniętą w aluminiowej kasecie, boczne prowadnice, dolna belka z uchwytem i hamulcem oraz uszczelką szczotkową, mechanizm sprężynowy, elementy montażowe i instrukcja. Wszystko przygotowane do montażu.",
  },
  {
    question: "Mam kilka okien dachowych — jak zamówić?",
    answer:
      "Skonfiguruj pierwszą roletę i dodaj ją do koszyka, potem kliknij „Wyceń nową roletę” i wybierz kolejne okno. Każde okno to osobna pozycja w jednym zamówieniu — jedna dostawa, jedna płatność.",
  },
  {
    question: "Jak czyścić tkaninę?",
    answer:
      "Tkaniny DEKO i TERMO wystarczy przetrzeć wilgotną ściereczką; nie prać, nie prasować. Kasetę i prowadnice czyści się jak każde aluminium — miękką szmatką, bez środków ściernych.",
  },
];

/** Instruction tab (owner, 2026-09-19: "instrukcje ograniczamy do pomiaru
 * i montażu oraz uwag dodatkowych"): ONE measurement instruction (A and B
 * together, with the owner's film re-encoded to a local 720p file - the
 * 7 MB WordPress original was too slow to start on phones), the
 * installation film and the extra notes (rounded glazing bead). */
export const RD_MEASUREMENT_VIDEO_URL = "/rolety-dachowe/pomiar-wymiar.mp4";
export const RD_INSTALLATION_VIDEO_EMBED_URL = "https://www.youtube-nocookie.com/embed/4STksYhAhyg?rel=0&modestbranding=1&playsinline=1";

export const RD_INSTRUCTION_STEPS = [
  {
    title: "1. Pomiar okna spoza biblioteki (wymiar A i B)",
    body:
      "<p><strong>Okno z biblioteki nie wymaga pomiaru</strong> — po wybraniu modelu (albo zdjęciu tabliczki znamionowej) wymiar rolety dobieramy sami. Mierz tylko okno, którego nie ma na liście.</p>" +
      "<p><strong>Wymiar A (szerokość):</strong> zmierz wymiar poziomy miejsca montażu od lewej do prawej krawędzi. Pomiaru dokonaj dokładnie w zaznaczonym miejscu — nie przy samej szybie, tylko na rancie ramy skrzydła, tam gdzie będzie montowana roleta.</p>" +
      "<p><strong>Wymiar B (wysokość):</strong> zmierz wymiar pionowy od górnej do dolnej krawędzi miejsca montażu — również na rancie ramy, nie przy szybie. Oba wyniki wpisz w milimetrach; roletę wykonamy dokładnie pod te wymiary, a dobór sprawdzimy przed produkcją.</p>",
    mediaUrl: RD_MEASUREMENT_VIDEO_URL,
    mediaType: "video" as const,
  },
  {
    title: "2. Montaż rolety na skrzydle",
    body:
      "<p>Kaseta u góry skrzydła, prowadnice po bokach, belka z hamulcem — wszystko na wkręty z kompletu, bez specjalistycznych narzędzi. Zobacz cały montaż krok po kroku.</p>",
    embedUrl: RD_INSTALLATION_VIDEO_EMBED_URL,
  },
  {
    title: "3. Uwagi dodatkowe: zaokrąglone listwy",
    body:
      "<p>Te rolety nie są kompatybilne z zaokrąglonymi listwami przyszybowymi. Jeżeli łuk jest minimalny (kilka milimetrów), roleta będzie pasować; przy oknach z typowo okrągłym profilem — niestety nie. W razie wątpliwości dołącz zdjęcie okna w konfiguratorze — sprawdzimy dobór przed produkcją.</p>",
  },
];
