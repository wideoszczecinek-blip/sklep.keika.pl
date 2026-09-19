// Built-in landing copy for "Plisy dachowe" (2026-09-19), same role as
// features/rolety-dachowe/landing-content.ts: rendered as the product's
// description, spec grid, "how it works", callout and FAQ. There is no CRM
// catalog record for this slug yet, so this copy is the page; once the
// owner adds one (Sklep WWW -> Produkty -> plisy-dachowe) its fields take
// over one by one like on the other landings.
//
// Facts come from the owner's old shop page (keika.groovemedia.pl, product
// 1540 "Plisa dachowa"): two aluminium rails joined by the fabric, each
// settable anywhere; aluminium side guides that keep the fabric flat on
// the slope and close the side gaps; made to measure for every roof-window
// brand; four hardware finishes; measurement "od rantu listwy przyszybowej
// do rantu po drugiej stronie" for both dimensions; montage with a PZ1
// screwdriver in 10-15 minutes; deeply impregnated polyester fabrics; a
// Polish product. Fabrics/collections are the shop's window-plisa ones
// (the same live CRM profile). Warranty/return/delivery as elsewhere in
// the shop. Nothing is invented.

export type PdSpecItem = { label: string; value: string };
export type PdFeatureBullet = { lead: string; detail?: string };
export type PdFaqEntry = { question: string; answer: string };
export type PdHowItWorksTile = { id: "belki" | "prowadnice" | "model" | "montaz"; title: string; body: string };

export const PD_H1 = "Plisy do okien dachowych na wymiar";

export const PD_SUBTITLE =
  "Plisa z aluminiowymi prowadnicami, dopasowana do modelu Twojego okna dachowego: Velux, Fakro, Roto, OKPOL, Dakstra i inne — ponad 420 modeli w bibliotece. Te same 150 tkanin co w plisach okiennych, cztery kolory osprzętu, cena od razu.";

export const PD_PRIMARY_CTA = "Dobierz plisę do swojego okna";

export const PD_DESCRIPTION_HTML =
  "<p><strong>Plisy dachowe KEIKA</strong> to plisa zaprojektowana pod okno połaciowe: dwie aluminiowe belki połączone tkaniną pracują w bocznych prowadnicach, więc materiał zostaje w płaszczyźnie okna niezależnie od kąta nachylenia i nie wybrzusza się pod własnym ciężarem. Każdą belkę ustawisz w dowolnym miejscu — zasłonisz całe okno, tylko górę, tylko dół albo pas na środku.</p>" +
  "<p><strong>Dopasowana do modelu okna — bez mierzenia.</strong> Wybierz swoje okno z biblioteki ponad 420 modeli (Velux, Fakro, Roto, OKPOL, Dakstra i inne) albo zrób zdjęcie tabliczki znamionowej — model odczytamy automatycznie i dobierzemy wymiar plisy. Okna spoza listy? Podajesz dwa wymiary, a plisę wykonamy na miarę.</p>" +
  "<p><strong>Te same tkaniny, co w plisach okiennych.</strong> Pięć kolekcji — Klasyczne, Reflex, Podgumowane (blackout), DUO plaster miodu i DUO TERMO — razem ok. 150 kolorów, od lekkich, rozpraszających światło po całkowicie zaciemniające z powłoką termiczną. Osprzęt (belki i prowadnice) w kolorze białym, anoda, brąz lub sosna.</p>" +
  "<p><strong>Kompletna, gotowa do montażu.</strong> W paczce plisa z belkami i prowadnicami, elementy montażowe i obrazkowa instrukcja. Montaż do skrzydła okna wkrętarką lub śrubokrętem PZ1, zwykle 10–15 minut. 5 lat gwarancji, 30 dni na zwrot, darmowa dostawa od 79 zł.</p>";

export const PD_SPEC_ITEMS: PdSpecItem[] = [
  {
    label: "Dopasowana do modelu okna",
    value:
      "Ponad 420 modeli w bibliotece: Velux, Fakro, Roto, OKPOL, Dakstra, Optilight i inne. Wybierasz model, a wymiar plisy dobieramy sami. Nie znasz modelu? Zrób zdjęcie tabliczki znamionowej — odczytamy go automatycznie.",
  },
  {
    label: "Aluminiowe prowadnice boczne",
    value:
      "Tkanina pracuje w prowadnicach, więc nie wybrzusza się na skosie i nie odstaje przy uchylonym oknie. Prowadnice zamykają też prześwity po bokach materiału. Osprzęt: aluminium + tworzywo, 4 kolory.",
  },
  {
    label: "Zatrzymanie w dowolnym miejscu",
    value:
      "Dwie belki, każda ustawiana osobno: zasłaniasz całe okno, tylko górę, tylko dół albo pas na środku. Plisa zostaje tam, gdzie ją puścisz.",
  },
  {
    label: "5 lat gwarancji i 30 dni na zwrot",
    value:
      "Plisy produkujemy sami, w Polsce, i dajemy na nie 5 lat gwarancji. Jeżeli produkt nie spełni oczekiwań, masz 30 dni na zwrot.",
  },
];

export const PD_FEATURE_BULLETS: PdFeatureBullet[] = [
  { lead: "Pod model okna, bez mierzenia", detail: "biblioteka ponad 420 modeli — Velux, Fakro, Roto, OKPOL, Dakstra i inne" },
  { lead: "Rozpoznawanie ze zdjęcia", detail: "zrób zdjęcie tabliczki znamionowej na skrzydle, a model okna odczytamy automatycznie" },
  { lead: "150 tkanin w 5 kolekcjach", detail: "Klasyczne, Reflex, Podgumowane (blackout), DUO plaster miodu i DUO TERMO — te same, co w plisach okiennych" },
  { lead: "4 kolory osprzętu", detail: "belki i prowadnice w kolorze białym, anoda (szary), brąz lub sosna" },
  { lead: "Tkanina w płaszczyźnie okna", detail: "prowadnice trzymają materiał na skosie i przy uchylonym skrzydle, bez wybrzuszeń" },
  { lead: "Zasłaniasz dowolny fragment", detail: "górna i dolna belka niezależnie — całe okno, góra, dół albo środek" },
  { lead: "Kompletna, gotowa do montażu", detail: "belki, prowadnice, elementy montażowe i obrazkowa instrukcja w paczce; wystarczy śrubokręt PZ1" },
];

export const PD_HOW_IT_WORKS: PdHowItWorksTile[] = [
  {
    id: "belki",
    title: "Dwie belki, jedna tkanina",
    body: "Górna i dolna belka aluminiowa połączone plisowaną tkaniną. Każdą przesuwasz osobno za uchwyt — plisa zatrzymuje się dokładnie tam, gdzie ją puścisz.",
  },
  {
    id: "prowadnice",
    title: "Boczne prowadnice",
    body: "Belki jeżdżą w aluminiowych prowadnicach przykręconych do skrzydła. Tkanina nie odchyla się od szyby na skosie, nie łopocze przy uchylonym oknie, po bokach nie ma prześwitów.",
  },
  {
    id: "model",
    title: "Pod model okna",
    body: "Wybierasz okno z biblioteki (albo fotografujesz tabliczkę znamionową), a wymiar plisy dobieramy pod skrzydło. Okno spoza listy mierzysz w dwóch punktach.",
  },
  {
    id: "montaz",
    title: "Montaż do skrzydła",
    body: "Prowadnice przykręcasz do ramy skrzydła wkrętami z kompletu — wkrętarka albo śrubokręt PZ1, 10–15 minut. Plisa porusza się razem z oknem.",
  },
];

export const PD_CALLOUT = {
  title: "Uchylone okno? Plisa zostaje w płaszczyźnie",
  body: "Naciąg tkaniny i aluminiowe prowadnice trzymają plisę przy szybie niezależnie od kąta otwarcia i pochylenia okna. Materiał nie wybrzusza się i nie zsuwa — dlatego do okien dachowych nie polecamy plis bez prowadnic.",
};

export const PD_FAQ: PdFaqEntry[] = [
  {
    question: "Ile kosztuje plisa dachowa na wymiar?",
    answer:
      "Cena zależy od wymiaru okna, kolekcji tkaniny i koloru osprzętu. Najmniejsza plisa w kolekcji Klasyczne kosztuje {{cena_od}}. Plisa dachowa to plisa okienna w tym samym wymiarze i tkaninie plus 25 % za prowadnice i osprzęt do okna połaciowego. Dokładną cenę dla swojego okna zobaczysz w konfiguratorze po wybraniu modelu.",
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
      "Wybierz opcję „Nie ma mojego okna” i podaj producenta, model oraz dwa wymiary: szerokość i wysokość, mierzone od rantu listwy przyszybowej do rantu po drugiej stronie — ten sam punkt dla obu wymiarów. Plisę wykonamy na miarę, a przed produkcją zweryfikujemy dobór. Możesz też dołączyć zdjęcie okna.",
  },
  {
    question: "Jak zmierzyć okno spoza listy?",
    answer:
      "Potrzebujemy tylko dwóch wymiarów: szerokości i wysokości. Oba mierzysz od rantu (zewnętrznej krawędzi) listwy przyszybowej do rantu po drugiej stronie — nie przy samej szybie. Krótki film z pomiarem zobaczysz w zakładce Instrukcje i w formularzu wymiarów.",
  },
  {
    question: "Którą kolekcję tkanin wybrać?",
    answer:
      "Klasyczne i DUO plaster miodu rozpraszają światło i nie zaciemniają — do salonu i kuchni na poddaszu. Reflex ma powłokę odbijającą słońce od strony szyby — na okna od południa. Podgumowane (blackout) zaciemniają — do sypialni. DUO TERMO to plaster miodu z powłoką termiczną: pełne zaciemnienie i najlepsza izolacja — do sypialni i nasłonecznionych poddaszy.",
  },
  {
    question: "Czy plisa dachowa całkowicie zaciemnia?",
    answer:
      "Tkaniny Podgumowane i DUO TERMO nie przepuszczają światła, a prowadnice boczne zamykają prześwity po bokach. Przy górnej i dolnej belce zostaje kilka milimetrów prześwitu — to cecha każdej plisy montowanej na skrzydle, nie wada egzemplarza.",
  },
  {
    question: "Jakie kolory osprzętu są dostępne?",
    answer:
      "Cztery: biały, anoda (szary, naturalne aluminium), brąz i sosna (drewnopodobny). Belki i prowadnice są zawsze w tym samym kolorze. Dobierz do ramy okna — biały do białych, sosnę do sosnowych okien Velux, Fakro czy Roto, brąz do ciemnego drewna, anodę do szarych i antracytowych.",
  },
  {
    question: "Czy mechanizm wytrzyma uchylone okno?",
    answer:
      "Tak. Naciąg tkaniny i aluminiowe prowadnice trzymają plisę zawsze w płaszczyźnie okna — materiał nie wybrzusza się niezależnie od kąta otwarcia i nachylenia dachu. Klamka zostaje wolna, okno uchylasz i obracasz jak dotąd.",
  },
  {
    question: "Czy muszę wiercić w oknie?",
    answer:
      "Prowadnice przykręcasz do skrzydła okna wkrętami z kompletu — to standardowy sposób montażu osłon do okien dachowych. Wystarczy wkrętarka albo śrubokręt krzyżakowy PZ1; wiertarka nie jest potrzebna. Typowy montaż zajmuje 10–15 minut, obrazkowa instrukcja jest w paczce.",
  },
  {
    question: "Do jakich okien pasuje?",
    answer:
      "Do okien dachowych wszystkich producentów: Velux, Fakro, Roto, OKPOL, RoofLITE+, Optilight, Dakea, Keylite i innych. Wystarczy wybrać model z biblioteki albo podać dwa wymiary — plisę robimy na wymiar.",
  },
  {
    question: "Czym plisa dachowa różni się od plisy okiennej?",
    answer:
      "Mechanizm i tkaniny są te same, różni je osprzęt: plisa dachowa ma aluminiowe prowadnice boczne, w których jeżdżą belki, żeby tkanina trzymała się szyby na skosie. Dlatego kosztuje 25 % więcej niż plisa okienna tego samego wymiaru.",
  },
  {
    question: "Ile trwa realizacja i wysyłka?",
    answer:
      "Plisę produkujemy pod Twoje okno zaraz po zamówieniu — zwykle wysyłamy w ciągu kilku dni roboczych; aktualny termin wysyłki pokazujemy nad konfiguratorem. Darmowa dostawa od 79 zł.",
  },
  {
    question: "Co jest w paczce?",
    answer:
      "Plisa z górną i dolną belką, aluminiowe prowadnice boczne, elementy montażowe (wkręty, uchwyty) i obrazkowa instrukcja montażu. Wszystko przygotowane do montażu na skrzydle.",
  },
  {
    question: "Mam kilka okien dachowych — jak zamówić?",
    answer:
      "Skonfiguruj pierwszą plisę i dodaj ją do koszyka, potem kliknij „Wyceń nową plisę” i wybierz kolejne okno. Każde okno to osobna pozycja w jednym zamówieniu — jedna dostawa, jedna płatność.",
  },
  {
    question: "Jak czyścić tkaninę?",
    answer:
      "Kurz zbierasz odkurzaczem z miękką końcówką albo suchą ściereczką przy złożonej plisie. Plamę przetrzyj lekko wilgotną gąbką — bez moczenia całej tkaniny i bez środków chemicznych. Belki i prowadnice czyści się jak każde aluminium, miękką szmatką.",
  },
];

/** Instruction tab, same three-part layout as rolety dachowe (owner,
 * 2026-09-19): ONE measurement instruction with the owner's film (the same
 * "od rantu do rantu" measurement the old plisa dachowa page linked to -
 * re-encoded 720p local file shared with the roof blind), the montage and
 * extra notes. */
export const PD_MEASUREMENT_VIDEO_URL = "/rolety-dachowe/pomiar-wymiar.mp4";

export const PD_INSTRUCTION_STEPS = [
  {
    title: "1. Pomiar okna spoza biblioteki (szerokość i wysokość)",
    body:
      "<p><strong>Okno z biblioteki nie wymaga pomiaru</strong> — po wybraniu modelu (albo zdjęciu tabliczki znamionowej) wymiar plisy dobieramy sami. Mierz tylko okno, którego nie ma na liście.</p>" +
      "<p><strong>Szerokość (wymiar A):</strong> zmierz od rantu listwy przyszybowej do rantu po drugiej stronie — na zewnętrznej krawędzi listwy, nie przy samej szybie.</p>" +
      "<p><strong>Wysokość (wymiar B):</strong> ten sam punkt pomiaru — od rantu górnej listwy do rantu dolnej. Oba wyniki wpisz w milimetrach; plisę wykonamy dokładnie pod te wymiary, a dobór sprawdzimy przed produkcją.</p>",
    mediaUrl: PD_MEASUREMENT_VIDEO_URL,
    mediaType: "video" as const,
  },
  {
    title: "2. Montaż plisy na skrzydle — 10–15 minut",
    body:
      "<p>W paczce jest komplet: plisa z belkami, prowadnice, wkręty i obrazkowa instrukcja. Potrzebujesz tylko wkrętarki albo śrubokrętu krzyżakowego <strong>PZ1</strong>.</p>" +
      "<ul>" +
      "<li>Przyłóż prowadnice do ramy skrzydła przy listwie przyszybowej i przykręć je wkrętami z kompletu — górny koniec przy górnej listwie, dolny przy dolnej.</li>" +
      "<li>Wsuń belki plisy w prowadnice i przesuń kilka razy górę i dół, żeby sprawdzić naciąg.</li>" +
      "<li>Jeśli tkanina jest za luźna albo za sztywna, napięcie regulujesz supełkiem sznurka pod belką.</li>" +
      "</ul>" +
      "<p>Masz pytanie w trakcie montażu? Zadzwoń lub napisz — podpowiemy krok po kroku.</p>",
  },
  {
    title: "3. Uwagi dodatkowe: okna spoza biblioteki",
    body:
      "<p>Przy oknie spoza listy prawdopodobieństwo niedopasowania jest znikome, jeżeli oba wymiary zmierzysz w tym samym punkcie — na rancie listwy przyszybowej. W razie wątpliwości dołącz zdjęcie okna w konfiguratorze: sprawdzimy dobór przed produkcją. Plisa produkowana jest na wymiar pod Twoje okno, dlatego przed wysyłką weryfikujemy każdy nietypowy model.</p>",
  },
];
