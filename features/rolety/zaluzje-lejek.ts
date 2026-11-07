// Teksty lejka stron żaluzji (właściciel 7.11.2026). Merytoryka z danych
// producenta (Sun & Shade: strony zaluzjeonline.pl i B2B - wymiary, grubości,
// liczby kolorów) streszczona własnymi słowami. Komponenty: ZaluzjeLejek.tsx.
// Zasady: żaluzje to dystrybucja - gwarancja producenta (nie „5 lat”), zwrot
// nie dotyczy rzeczy na wymiar, wkrętów nie dodajemy (7.11), nie piszemy
// „produkujemy”. Wymiary i liczby kolorów - stan cennika z CRM.
import type { ZaluzjeRodzajSlug } from "./zaluzje-rodzaje";

export type ZaluzjeLejekCopy = {
  slug: ZaluzjeRodzajSlug;
  eyebrow: string;
  hookTitle: string;
  korzysci: Array<{ icon: string; title: string; text: string }>;
  budowaTitle: string;
  budowa: Array<{ title: string; text: string }>;
  dlaKogoTitle: string;
  dlaKogo: string[];
  nieDla: string[];
  pielegnacja: string;
  /** Typowy model rodzaju (pid S&S) - wysokość pakietu w animacji pomiaru. */
  pomiarPid: number;
};

/** Co dopasujesz w konfiguratorze - wspólne dla wszystkich rodzajów. */
export const ZALUZJE_DOPASUJESZ: Array<{ title: string; text: string }> = [
  { title: "Wymiar co do milimetra", text: "Wpisujesz to, co zmierzysz. Nie ma rozmiarów „prawie pasujących” ani docinania w domu." },
  { title: "Miejsce montażu", text: "W świetle szyby, na skrzydło okna albo na ścianę nad wnęką. Na skrzydle także bez wiercenia." },
  { title: "Kolor lameli", text: "Każdy kolor ze zdjęciem próbki. Wybierasz przy konkretnej grubości lameli." },
  { title: "Drabinka: sznurek albo taśma", text: "Cienki sznurek jest prawie niewidoczny. Ozdobna taśma zasłania otworki w lamelach i daje klasyczny wygląd." },
  { title: "Strona sterowania", text: "Sznurek do podnoszenia i drążek do obracania lameli - po lewej albo po prawej, jak Ci wygodnie." },
  { title: "Dodatki", text: "Prowadzenie boczne (żaluzja nie odchyla się przy uchylonym oknie) i inne opcje dostępne dla danego modelu." },
  { title: "Bezpieczeństwo dzieci", text: "W komplecie uchwyt, na który zwijasz sznurek poza zasięgiem dziecka." },
];

/** Zbicie obiekcji - wyłącznie to, co dziś obowiązuje w sklepie. */
export const ZALUZJE_BEZPIECZNIE: Array<{ icon: string; title: string; text: string }> = [
  { icon: "🏢", title: "Firma od 2015 roku", text: "KEIKA ze Szczecinka - osłony okienne na wymiar. Pełne dane firmy, NIP i telefon są niżej." },
  { icon: "🛡", title: "Gwarancja producenta", text: "Reklamację zgłaszasz nam. Prowadzimy całą sprawę z producentem za Ciebie." },
  { icon: "💳", title: "Bezpieczna płatność", text: "BLIK, karta, szybki przelew lub PayPo - przez operatorów płatności, bez podawania nam danych karty." },
  { icon: "📞", title: "Żywy człowiek", text: "Zadzwoń lub napisz na czacie przed zamówieniem - pomożemy wybrać model i montaż." },
];

export const ZALUZJE_LEJEK: Record<ZaluzjeRodzajSlug, ZaluzjeLejekCopy> = {
  aluminiowe: {
    slug: "aluminiowe",
    pomiarPid: 12,
    eyebrow: "Dlaczego aluminium",
    hookTitle: "Pełna kontrola nad światłem w każdym pomieszczeniu - także tam, gdzie jest wilgoć",
    korzysci: [
      { icon: "💧", title: "Nie chłonie wody", text: "Aluminium nie pęcznieje od pary - dobry wybór do kuchni i łazienki z wentylacją." },
      { icon: "☀", title: "Światło pod kontrolą", text: "Obrót lameli o kilka stopni i masz rozproszony dzień, pełny widok albo prywatność." },
      { icon: "📏", title: "Najsmuklejsza na skrzydle", text: "Lamele 16 i 25 mm odstają od szyby najmniej - okno uchylisz razem z żaluzją." },
      { icon: "🎨", title: "Największy wybór kolorów", text: "Matowe, metaliczne, aksamitne, perforowane i w kolorach drewna. Kolor nie płowieje od słońca." },
    ],
    budowaTitle: "Z czego jest zrobiona żaluzja aluminiowa",
    budowa: [
      { title: "Lamele", text: "Cienka, lekka taśma aluminiowa w trwałym kolorze, odporna na zarysowania. Najlżejsza ze wszystkich żaluzji - okno 50 × 100 cm to ok. 0,7 kg." },
      { title: "Grubości", text: "16, 25, 35 i 50 mm. Im węższa lamela, tym smuklejsza żaluzja; szeroka 50 mm daje nowoczesny rytm na dużych oknach." },
      { title: "Wersje 50 mm", text: "SUNSET (sznurek albo taśma), ELEGANCE (kolory perłowe i metaliczne), DESIGN (6 kolorów od bieli do czerni), RETRO (na ozdobnej taśmie)." },
      { title: "Drewnopodobne", text: "Lamele aluminiowe z rysunkiem słojów drewna - wygląd drewna z odpornością aluminium." },
      { title: "Po podniesieniu", text: "Pakiet lameli jest najmniejszy ze wszystkich żaluzji: przy lameli 16 mm ok. 5,5 cm na każdy metr wysokości." },
      { title: "Sterowanie", text: "Sznurek podnosi i opuszcza żaluzję, drążek obraca lamele. Stronę wybierasz w konfiguratorze." },
      { title: "Wymiary", text: "Do 240 cm szerokości i 240 cm wysokości (lamela 16 mm do 200 cm szerokości)." },
    ],
    dlaKogoTitle: "Wybierz aluminiową, jeśli…",
    dlaKogo: [
      "zasłaniasz okno w kuchni, łazience albo pralni",
      "chcesz żaluzję na skrzydle, która nie przeszkadza w uchylaniu okna",
      "lubisz nowoczesne, minimalistyczne wnętrza",
      "szukasz konkretnego koloru - aluminium ma ich najwięcej",
    ],
    nieDla: [
      "Na oknie w pełnym słońcu aluminium się nagrzewa - do mocno nasłonecznionego pokoju rozważ drewno abachi.",
      "Chcesz ciepła prawdziwego drewna? Zobacz żaluzje drewniane albo bambusowe.",
    ],
    pielegnacja: "Odkurz miotełką albo przetrzyj wilgotną ściereczką przy zamkniętych lamelach. Tłuste osady z kuchni zmyjesz łagodnym płynem. Bez środków ściernych.",
  },
  drewniane: {
    slug: "drewniane",
    pomiarPid: 39,
    eyebrow: "Dlaczego drewno",
    hookTitle: "Okno, które wygląda jak dobrze dobrany mebel",
    korzysci: [
      { icon: "🌳", title: "Prawdziwe drewno", text: "Lipa (basswood) i afrykańskie abachi - z naturalnym rysunkiem słojów, ciepłe w dotyku." },
      { icon: "☀", title: "Mniej nagrzany pokój", text: "Drewno słabo przewodzi ciepło - abachi szczególnie, dlatego polecamy je do okien od południa." },
      { icon: "🛋", title: "Element wystroju", text: "Pasuje do drewnianych podłóg i mebli. Wersja RETRO z ozdobną taśmą wygląda szczególnie klasycznie." },
      { icon: "📐", title: "Duże okna", text: "Lamele 50 i 65 mm na szerokość do 240 cm - także na balkonowe i tarasowe okna." },
    ],
    budowaTitle: "Z czego jest zrobiona żaluzja drewniana",
    budowa: [
      { title: "Drewno", text: "Basswood (lipa) - klasyka z równym rysunkiem i największym wyborem kolorów. Abachi - drewno z Afryki, lżejsze od lipy i słabiej się nagrzewa. Prime wood - lamele szczotkowane, z wyczuwalną fakturą i rustykalnym charakterem." },
      { title: "Grubości", text: "25, 35, 50 i 65 mm. Na skrzydło 25-35 mm, na ścianę i duże okna 50-65 mm." },
      { title: "Wersje", text: "Basswood, LUX, SELECT (lipa z wyraźnym rysunkiem słojów: orzech, palisander, dąb antyczny), RETRO (ozdobny mechanizm w brązie lub srebrze i taśma), Abachi, Prime wood." },
      { title: "Po podniesieniu", text: "Pakiet lameli zajmuje ok. 16-18 cm na każdy metr wysokości żaluzji - przy montażu na ścianę schowa się nad wnęką." },
      { title: "Drabinka", text: "Sznurek albo ozdobna taśma w kolorze dobranym do lameli." },
      { title: "Sterowanie", text: "Sznurek podnosi i opuszcza żaluzję, drążek obraca lamele. Stronę wybierasz w konfiguratorze." },
      { title: "Wymiary", text: "Do 240 cm szerokości i 240 cm wysokości (basswood 25 mm do 180 cm szerokości)." },
    ],
    dlaKogoTitle: "Wybierz drewnianą, jeśli…",
    dlaKogo: [
      "urządzasz salon, sypialnię, gabinet albo jadalnię",
      "chcesz naturalnego materiału zamiast tworzywa",
      "masz okno od południa i chcesz, żeby pokój mniej się nagrzewał (abachi)",
      "masz duże okno i szukasz osłony, która „robi” wnętrze",
    ],
    nieDla: ["Okno w łazience albo nad zlewem? Wilgoć i wahania temperatury szkodzą drewnu - wybierz PCV drewnopodobne albo aluminium."],
    pielegnacja: "Odkurzaj miotełką, suchą ściereczką albo miękką końcówką odkurzacza przy zamkniętych lamelach. Drewna nie myj na mokro - plamę zetrzesz lekko wilgotną chusteczką.",
  },
  bambusowe: {
    slug: "bambusowe",
    pomiarPid: 76,
    eyebrow: "Dlaczego bambus",
    hookTitle: "Naturalny materiał, który ożywia wnętrze",
    korzysci: [
      { icon: "🎋", title: "Żywy rysunek", text: "Bambus ma charakterystyczne kolanka - każda lamela wygląda trochę inaczej." },
      { icon: "🌿", title: "Naturalny klimat", text: "Pasuje do wnętrz boho, japandi i skandynawskich, do roślin i lnu." },
      { icon: "☀", title: "Światło pod kontrolą", text: "Lamele obracasz jak w każdej żaluzji: od rozproszonego dnia po przyciemnienie." },
      { icon: "📐", title: "Lamele 25-65 mm", text: "Smukłe na skrzydło albo szerokie na duże okna, także na ozdobnej taśmie (RETRO)." },
    ],
    budowaTitle: "Z czego jest zrobiona żaluzja bambusowa",
    budowa: [
      { title: "Lamele", text: "Bambus - szybko odnawialny surowiec. Lamela jest cienka (ok. 2 mm), twarda i matowa, z nieregularnym, „żywym” rysunkiem." },
      { title: "Grubości", text: "25, 35, 50 i 65 mm." },
      { title: "Wersje", text: "Klasyczna na sznurku, LUX (wyselekcjonowane lamele 25 mm), RETRO na ozdobnej taśmie (50 i 65 mm)." },
      { title: "Kolory", text: "Od bieli i perłowej bieli, przez klon, dąb i taupe, po wenge, antracyt i czerń." },
      { title: "Po podniesieniu", text: "Pakiet lameli zajmuje ok. 15 cm na każdy metr wysokości żaluzji." },
      { title: "Sterowanie", text: "Sznurek podnosi i opuszcza żaluzję, drążek obraca lamele. Stronę wybierasz w konfiguratorze." },
      { title: "Wymiary", text: "Do 240 cm szerokości i 240 cm wysokości (lamela 25 mm do 180 cm szerokości)." },
    ],
    dlaKogoTitle: "Wybierz bambusową, jeśli…",
    dlaKogo: [
      "urządzasz salon, sypialnię albo pokój dzienny w naturalnym stylu",
      "chcesz, żeby osłona była ozdobą, a nie tylko zasłaniała okno",
      "lubisz materiały z wyczuwalną fakturą",
      "cenisz materiały odnawialne",
    ],
    nieDla: ["Do łazienki i nad zlew lepsze będą żaluzje PCV drewnopodobne albo aluminiowe - stała para nie służy materiałom naturalnym."],
    pielegnacja: "Odkurzaj miotełką lub miękką ściereczką przy zamkniętych lamelach. Plamę zetrzyj wilgotną chusteczką bez detergentów - detergent może odbarwić bambus.",
  },
  pcv: {
    slug: "pcv",
    pomiarPid: 57,
    eyebrow: "Dlaczego PCV drewnopodobne",
    hookTitle: "Wygląd drewna tam, gdzie drewno by nie wytrzymało",
    korzysci: [
      { icon: "💧", title: "Odporna na wilgoć", text: "PCV nie chłonie wody ani tłuszczu i nie wypacza się od pary - do kuchni i łazienki." },
      { icon: "🌳", title: "Wygląda jak drewno", text: "Szerokie lamele w bielach i kolorach drewna, także ze strukturą słojów (CEDRO)." },
      { icon: "🧽", title: "Najłatwiejsza w myciu", text: "Ściereczka z łagodnym płynem, a przy dużym brudzie zdejmiesz ją i umyjesz w letniej wodzie." },
      { icon: "📐", title: "Lamele 35-65 mm", text: "Szeroka lamela to mniej szczelin i bardziej „drewniany” efekt." },
    ],
    budowaTitle: "Z czego jest zrobiona żaluzja PCV drewnopodobna",
    budowa: [
      { title: "Lamele", text: "Tworzywo PCV o wyglądzie drewna (faux wood) - gładkie albo z wyczuwalnym rysunkiem słojów (CEDRO)." },
      { title: "Grubości", text: "35, 50 i 65 mm." },
      { title: "Kolory", text: "Biele gładkie i z fakturą, perła, szarości, jesion, wiśnia, mahoń, sekwoja." },
      { title: "Na tle innych", text: "Nagrzewa się mniej niż aluminium i nie płowieje jak naturalne drewno. Jest cięższa od drewna, dlatego ma mniejszą maksymalną powierzchnię." },
      { title: "Sterowanie", text: "Sznurek podnosi i opuszcza żaluzję, drążek obraca lamele. Stronę wybierasz w konfiguratorze." },
      { title: "Wymiary", text: "Do 240 cm szerokości i 240 cm wysokości." },
    ],
    dlaKogoTitle: "Wybierz PCV drewnopodobną, jeśli…",
    dlaKogo: [
      "chcesz wyglądu drewna w łazience, kuchni albo pralni",
      "masz dzieci lub zwierzęta i wolisz osłonę, którą łatwo umyć",
      "szukasz szerokich lameli w bieli - klasyka do jasnych wnętrz",
    ],
    nieDla: ["Lamela PCV jest cięższa od drewnianej - na bardzo duże okna rozważ drewno albo aluminium."],
    pielegnacja: "Myj ściereczką z mikrofibry z odrobiną łagodnego płynu, przy zamkniętych lamelach, potem osusz. Bez środków ściernych.",
  },
};
