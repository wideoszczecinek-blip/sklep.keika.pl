// Built-in landing copy for "Plisy" (audit 2026-09-14), same role as the
// MOSKITIERY_RAMKOWE_* constants in app/home-client.tsx: rendered as the
// product's description, spec grid, collections guide, callout and FAQ
// until the owner fills the matching fields in the CRM (Sklep WWW ->
// Produkty i konfiguratory -> plisy), which then take over field by field.
//
// Every fact here is grounded in the CRM configurator profile (5 fabric
// collections with 150 swatches, 10 hardware colours (NOT all the same
// price - owner, 2026-09-15 - so never write "bez dopłaty" about them), 3
// mount types with their surcharges, the 400-2100 x 600-2300 mm price
// matrix) plus the owner's decisions from 2026-09-14: production 5-10
// business days, no fabric samples, SEZON20 applies, Ekspres does not.
// Instructions and reviews are deliberately NOT here - the owner adds them.

export type PlisySpecItem = { label: string; value: string };
export type PlisyFeatureBullet = { lead: string; detail?: string };
export type PlisyFaqEntry = { question: string; answer: string };
export type PlisyCollectionRow = {
  /** fabric group id from the CRM profile - used to price the example */
  groupId: string;
  name: string;
  what: string;
  where: string;
  /** Blocks light (blackout core / thermal coating) - the ☾ badge. */
  blackout: boolean;
  /** Reduces heat gain or loss - the thermometer badge. */
  thermal: boolean;
  /** Spec sheet lines. Only what we actually know about the fabric - no
   * grammage or fire class here because the CRM does not hold them. */
  lightNote: string;
  thermalNote: string;
};

/** Lowest cell of the Classic price table (400 x 600 mm, STANDARD mount).
 * Used only for the server render / first paint; the live value is read
 * from the fetched profile (see plisyStartingPrice below). */
export const PLISY_STARTING_PRICE_FALLBACK = 77;

/** Example size the collections guide prices - a typical living-room
 * casement, matches the configurator's own placeholders (900 x 1200). */
// Where the "Którą kolekcję wybrać" size sliders start. 40 x 60 cm - the
// owner's pick 2026-09-15 evening (the block went 90x120 -> 55x105 -> sliders
// starting at the smallest sensible sash the same day). Also the sliders'
// minimum: the matrix prices smaller, but nobody orders a 20 cm plisa.
export const PLISY_EXAMPLE_WIDTH_MM = 400;
export const PLISY_EXAMPLE_HEIGHT_MM = 600;

export const PLISY_LEAD_TIME_LABEL = "5–10 dni roboczych";

/** The CRM currently holds this placeholder sentence in subtitle,
 * description and the single landing section. While that is the case the
 * built-in copy wins; any other CRM text replaces it (owner edited it). */
export const PLISY_CRM_PLACEHOLDER = "Elastyczne przesłanianie od góry i od dołu.";

export function isPlisyPlaceholderCopy(text: string | null | undefined): boolean {
  const normalized = String(text || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
  return !normalized || normalized === PLISY_CRM_PLACEHOLDER.toLowerCase();
}

/** Landing H1. The nav label stays the short "Plisy"; the page itself says
 * what it sells - cold Meta traffic lands here without context (copy
 * rewrite 2026-09-16, competitor audit: Karnix, Rolmajster, Sunroll,
 * mojaplisa). The CRM "title" field overrides this when the owner changes
 * it from the default "Plisy". */
export const PLISY_H1 = "Plisy okienne na wymiar";

export const PLISY_SUBTITLE =
  "Zasłaniasz tyle okna, ile chcesz — od góry, od dołu albo sam środek. Produkujemy na Twój wymiar w Szczecinku, zakładasz w 15 minut, także bez wiercenia. Cena dla Twojego okna w 10 sekund, bez maila i telefonu.";

/** Primary CTA wording, repeated on the landing (mobile hero button, callout,
 * end-of-section nudges). One promise everywhere: the price, for your
 * window, now. */
export const PLISY_PRIMARY_CTA = "Sprawdź cenę dla swojego okna";

/** Fallback for the CRM "description" field (HTML). */
export const PLISY_DESCRIPTION_HTML =
  "<p><strong>Plisa to najbardziej elastyczna osłona okienna.</strong> Zamiast jednej rolety, która zasłania tylko od góry, masz dwie ruchome belki: opuszczasz górną i patrzysz w niebo, podnosisz dolną i nikt nie zagląda Ci do salonu. Tkanina złożona w harmonijkę chowa się w skrzydle okna — bez rury, bez łańcuszka — a przy uchylaniu i otwieraniu jedzie razem z oknem.</p>" +
  "<p><strong>Jesteśmy producentem, nie pośrednikiem.</strong> Każdą plisę robimy na wymiar w naszym zakładzie w Szczecinku. Wpisujesz szerokość i wysokość w milimetrach, wybierasz tkaninę ze 150 wzorów, kolor profili i sposób montażu — z wierceniem albo na uchwytach bez wiercenia. Cenę widzisz od razu. Po 5–10 dniach roboczych plisa jest u Ciebie, a montaż zajmuje kwadrans z wkrętakiem.</p>" +
  "<p>Najmniejsza plisa kosztuje 77 zł, a z kodem SEZON20 o 20% mniej. Masz 30 dni na zwrot i 5 lat gwarancji — jeśli coś Ci nie pasuje, odsyłasz i dostajesz pieniądze.</p>";

export const PLISY_SPEC_ITEMS: PlisySpecItem[] = [
  {
    label: "Na wymiar co do milimetra",
    value:
      "Wpisujesz szerokość i wysokość, resztą zajmujemy się my. Plisa wchodzi między listwy przyszybowe jak część okna — bez prześwitów po bokach, bez docinania w domu.",
  },
  {
    label: "Od góry, od dołu albo sam środek",
    value:
      "Dwie belki, zero sznurków z boku. Rano opuszczasz górną i wpuszczasz światło, wieczorem zasłaniasz całość. Sąsiad z naprzeciwka przestaje być tematem.",
  },
  {
    label: "Montaż w 15 minut — z wierceniem lub bez",
    value:
      "STANDARD: cztery wkręty w listwie przyszybowej, nic nie odstaje. Bezinwazyjny (od +4,90 zł): uchwyty na skrzydło, bez śladu — do mieszkania na wynajem i okien na gwarancji.",
  },
  {
    label: "Zero ryzyka: 30 dni na zwrot, 5 lat gwarancji",
    value:
      "Jeżeli plisa nie spełni oczekiwań, odsyłasz ją w 30 dni i oddajemy pieniądze. Źle zmierzysz? Napisz zaraz po zamówieniu — przed produkcją poprawiamy wymiar bezpłatnie.",
  },
];

export const PLISY_FEATURE_BULLETS: PlisyFeatureBullet[] = [
  {
    lead: "150 tkanin w 5 kolekcjach",
    detail: "od lekkich, rozpraszających światło, po pełny blackout i termoizolacyjny plaster miodu — każda z kodem producenta, więc dokupisz identyczną",
  },
  {
    lead: "10 kolorów profili",
    detail: "biel, brąz, anoda, antracyt, oliwka, czarny mat i cztery drewnopodobne — dopasujesz do każdej stolarki",
  },
  {
    lead: "Sterowanie od góry i od dołu",
    detail: "tkanina zatrzymuje się w dowolnym miejscu okna; żadnych sznurków ani łańcuszków zwisających z boku",
  },
  {
    lead: "Trzy sposoby montażu",
    detail: "STANDARD wkręcany przy szybie, bezinwazyjny PCV lub METAL na skrzydło — te dwa bez wiercenia i bez śladu",
  },
  {
    lead: "Nie blokuje uchylania ani otwierania",
    detail: "plisa jedzie razem ze skrzydłem, klamka zostaje wolna",
  },
  {
    lead: "Okna od 40 do 210 cm szerokości i do 230 cm wysokości",
    detail: "pokoje, kuchnie, łazienki, drzwi balkonowe — każdy wymiar w tym zakresie robimy na zamówienie",
  },
  {
    lead: "Wszystko w komplecie",
    detail: "uchwyty, wkręty i instrukcja w paczce; potrzebujesz tylko wkrętaka i kwadransa",
  },
];

export const PLISY_COLLECTIONS: PlisyCollectionRow[] = [
  {
    groupId: "clasic",
    name: "Klasyczne",
    what: "Półprzepuszczalna: rozprasza światło i chroni prywatność w dzień",
    where: "Salon, kuchnia, biuro, pokój dziecięcy",
    blackout: false,
    thermal: false,
    lightNote: "Półprzepuszczalna — rozprasza światło, nie zaciemnia",
    thermalNote: "Bez powłoki termicznej",
  },
  {
    groupId: "reflex",
    name: "Reflex",
    what: "Jak Klasyczne, plus zewnętrzna powłoka refleksyjna odbijająca słońce: mniej nagrzewania latem",
    where: "Okna południowe i zachodnie, poddasza",
    blackout: false,
    thermal: true,
    lightNote: "Półprzepuszczalna — rozprasza światło, nie zaciemnia",
    thermalNote: "Powłoka refleksyjna od strony szyby — odbija słońce, mniej nagrzewania",
  },
  {
    groupId: "blackout",
    name: "Podgumowane (Blackout)",
    what: "Zaciemniająca tkanina z podgumowanym rdzeniem: blokuje światło",
    where: "Sypialnia, pokój dziecka, pokój z telewizorem",
    blackout: true,
    thermal: false,
    lightNote: "Zaciemniająca — podgumowany rdzeń blokuje światło",
    thermalNote: "Bez powłoki termicznej",
  },
  {
    groupId: "duo",
    name: "DUO plaster miodu",
    what: "Podwójna tkanina o strukturze plastra miodu, bez otworów pod sznurki: żadnych punktów światła, izolacja termiczna",
    where: "Sypialnia, gabinet, okna z przeciągiem",
    blackout: false,
    thermal: true,
    lightNote: "Półprzepuszczalna — bez otworów pod sznurki, żadnych punktów światła",
    thermalNote: "Komora powietrzna plastra miodu — izoluje zimą i latem",
  },
  {
    groupId: "duo-blackout",
    name: "DUO TERMO",
    what: "Plaster miodu z wewnętrzną powłoką termiczną: całkowite zaciemnienie i najlepsza termoizolacja",
    where: "Sypialnia od słonecznej strony, poddasze",
    blackout: true,
    thermal: true,
    lightNote: "Zaciemniająca — całkowite zaciemnienie",
    thermalNote: "Plaster miodu + wewnętrzna powłoka termiczna — najlepsza termoizolacja w ofercie",
  },
];

export const PLISY_CALLOUT = {
  title: `Producent ze Szczecinka: realizacja ${PLISY_LEAD_TIME_LABEL}, kurier w 24 h`,
  body:
    "Plisę robimy u siebie, na Twój wymiar — bez pośredników i bez czekania na wycenę mailem. Po wyprodukowaniu paczka wychodzi kurierem w 24 h; od 79 zł dostawa jest darmowa. Kilka okien? Dodasz kolejne wymiary do jednego zamówienia i zapłacisz za jedną przesyłkę.",
};

// FAQ, rewritten 2026-09-16 against what the market answers (Karnix,
// Sun-Systems, Rolmajster, Karpol, Minirolety, Nasze Domowe Pielesze - all
// fetched that day) and reordered along the buying path: what it is -> does
// it fit my window -> mounting -> measuring -> fabric -> ordering -> after.
// Every number here is ours (matrix range, surcharges, lead time, warranty),
// not theirs; where a competitor's caveat applies to us too (flush sashes,
// wooden frames, measuring each window) it is included in our own words.
export const PLISY_FAQ: PlisyFaqEntry[] = [
  {
    question: "Ile kosztuje plisa na wymiar?",
    answer:
      "Najmniejsza plisa (40 × 60 cm, kolekcja Klasyczne, montaż STANDARD) kosztuje 77 zł. Cena rośnie z wymiarem i zależy od kolekcji tkaniny — dokładną kwotę dla swojego okna zobaczysz w konfiguratorze po wpisaniu szerokości i wysokości, bez rejestracji i bez podawania telefonu. Kod SEZON20 obniża ją o 20 %. Orientacyjne ceny dla wybranego wymiaru pokazuje też sekcja „Którą kolekcję tkanin wybrać?”.",
  },
  {
    question: "Czym plisa różni się od rolety?",
    answer:
      "Roleta zasłania okno tylko od góry w dół. Plisa ma dwie ruchome listwy: zasłonisz dolną część okna, górną albo sam środek — widzisz niebo, sąsiad nie widzi Ciebie. Tkanina jest złożona w harmonijkę, nie nawija się na rurę, więc plisa jest cieńsza, lżejsza i schowana w skrzydle okna.",
  },
  {
    question: "Do jakich okien pasuje plisa?",
    answer:
      "Do okien i drzwi balkonowych PCV, drewnianych i aluminiowych, w każdym kształcie prostokątnym. Do okien drewnianych i aluminiowych polecamy montaż STANDARD (wkręcany przy szybie) — uchwyty bezinwazyjne projektowane są pod skrzydła PCV. Do okien dachowych mamy osobny produkt: rolety dachowe, dobierane pod model okna.",
  },
  {
    question: "Jakie wymiary plis wykonujecie?",
    answer:
      "Szerokość od 40 do 210 cm, wysokość od 60 do 230 cm — to obejmuje okna, drzwi balkonowe i większość witryn. Wymiar podajesz w milimetrach, produkujemy co do milimetra. Okno spoza tego zakresu? Napisz, sprawdzimy, czy da się je zasłonić dwiema plisami.",
  },
  {
    question: "Czy muszę wiercić w oknie?",
    answer:
      "Nie musisz. Montaż bezinwazyjny PCV (+4,90 zł) lub METAL (+19,90 zł) to uchwyty zakładane na krawędź skrzydła — bez wiercenia i bez śladu, zdejmiesz je w każdej chwili. Idealne do wynajmowanego mieszkania i okien na gwarancji. Montaż STANDARD to cztery wkręty w listwach przyszybowych: nic nie odstaje, plisa wygląda jak część okna.",
  },
  {
    question: "Bezinwazyjny PCV czy METAL — który wybrać?",
    answer:
      "Oba zakłada się tak samo, bez wiercenia. PCV wystarcza do typowych okien. METAL to stalowe, sztywniejsze zaczepy — polecamy je do szerokich i wysokich plis, drzwi balkonowych i cięższych tkanin DUO. Jeśli Twoje skrzydło licuje z ramą albo odstaje od niej tylko o kilka milimetrów, napisz do nas przed zamówieniem — sprawdzimy, który uchwyt się zmieści.",
  },
  {
    question: "Jak zmierzyć okno?",
    answer:
      "Zależy od montażu, dlatego najpierw wybierz sposób. STANDARD: szerokość i wysokość od połowy uszczelki do połowy uszczelki — nic nie odejmuj. Bezinwazyjny: szerokość od kreseczki do kreseczki (linii, w której listwa przyszybowa łączy się z ramą), wysokość całego skrzydła. Animowany przewodnik jest w zakładce Instrukcje; w konfiguratorze otworzysz go przyciskiem „Jak mierzyć?”.",
  },
  {
    question: "Mam kilka takich samych okien — mogę zmierzyć jedno?",
    answer:
      "Lepiej nie. Okna z jednej serii potrafią różnić się o 2–5 mm, a przy montażu STANDARD profil musi wejść między listwy. Zmierz każde skrzydło osobno i wpisz każde jako osobną pozycję — w konfiguratorze robisz to jednym kliknięciem „Dodaj kolejną”.",
  },
  {
    question: "Czy plisa przeszkadza w otwieraniu i uchylaniu okna?",
    answer:
      "Nie. Plisa jest przymocowana do skrzydła i porusza się razem z nim, także przy uchylaniu. Klamka zostaje wolna — przy montażu bezinwazyjnym zachowaj tylko 5 mm odstępu profilu od klamki.",
  },
  {
    question: "Która tkanina do sypialni?",
    answer:
      "Podgumowane (Blackout) albo DUO TERMO. Blackout blokuje światło podgumowanym rdzeniem. DUO TERMO to plaster miodu z powłoką termiczną: pełne zaciemnienie, bez otworów pod sznurki (więc bez punktowych prześwitów) i najlepsza izolacja w ofercie. Przy każdej osłonie montowanej w skrzydle zostaje kilka milimetrów prześwitu na krawędziach — to cecha plis i rolet, nie wada egzemplarza.",
  },
  {
    question: "Która tkanina do salonu, a która do kuchni i łazienki?",
    answer:
      "Do salonu Klasyczne lub DUO plaster miodu: rozpraszają światło, chronią prywatność w dzień, nie zaciemniają. Do kuchni i łazienki Klasyczne lub Reflex — gładki poliester, który wystarczy przetrzeć wilgotną ściereczką. Wszystkie tkaniny mają powłokę antystatyczną, więc kurz osiada wolniej.",
  },
  {
    question: "Czy plisa chroni przed nagrzewaniem latem i zimnem od okna zimą?",
    answer:
      "Tak, w różnym stopniu. Reflex ma od strony szyby powłokę odbijającą słońce — do okien południowych i zachodnich. DUO plaster miodu i DUO TERMO zamykają między dwiema warstwami tkaniny poduszkę powietrzną: latem ogranicza nagrzewanie, zimą ucieczkę ciepła przez szybę. Klasyczne i Podgumowane nie mają właściwości termicznych.",
  },
  {
    question: "Ile światła przepuszcza plisa?",
    answer:
      "Klasyczne, Reflex i DUO plaster miodu są półprzepuszczalne: w dzień w pokoju jest jasno, ale nie widać, co dzieje się w środku. Podgumowane i DUO TERMO są zaciemniające. Kolor ma znaczenie w obu grupach — ciemna tkanina półprzepuszczalna przepuści wyraźnie mniej światła niż jasna.",
  },
  {
    question: "Jak dobrać kolor tkaniny i profili?",
    answer:
      "Tkanina: 150 kolorów w 5 kolekcjach; jasne optycznie powiększają pokój, ciemne wyglądają elegancko, ale przy tkaninach półprzepuszczalnych zabierają więcej światła. Profile: 10 kolorów — biel, brąz, anoda, antracyt, oliwka, czarny mat i cztery drewnopodobne — dobierasz do stolarki. Część kolorów profili jest z dopłatą; konfigurator pokaże cenę od razu po wyborze.",
  },
  {
    question: "Jak długo czekam na plisę?",
    answer: `Każda plisa powstaje na Twój wymiar w naszym zakładzie w Szczecinku. Realizacja to ${PLISY_LEAD_TIME_LABEL}, potem kurier dostarcza paczkę w 24 h. Darmowa dostawa od 79 zł.`,
  },
  {
    question: "Czy mogę zamówić próbki tkanin?",
    answer:
      "Obecnie nie wysyłamy próbek. Zdjęcia tkanin w konfiguratorze robimy z realnych próbników, a każdy kolor ma kod producenta (np. PP 151) — jeśli masz już plisę z tym kodem, dostaniesz identyczną. Pamiętaj, że ekran telefonu może lekko zmienić odcień.",
  },
  {
    question: "Co jeśli źle zmierzę?",
    answer:
      "Najszybciej: napisz do nas od razu po złożeniu zamówienia — jeśli plisa nie weszła jeszcze do produkcji, poprawimy wymiar bez żadnych kosztów. A gdyby pomyłka wyszła dopiero po montażu, chroni Cię 30-dniowy zwrot. Żeby do tego nie doszło, zmierz dwa razy, a przy wątpliwości wyślij nam zdjęcie okna na czacie — odpowiemy, który montaż i jaki wymiar wybrać.",
  },
  {
    question: "Czy mogę zamówić plisy do kilku okien w jednym zamówieniu?",
    answer:
      "Tak. Po wpisaniu wymiaru kliknij „Dodaj kolejną”, wpisz następny wymiar — każde okno może mieć inną tkaninę i inny montaż. Wszystko trafia do jednego koszyka, jedna dostawa, a powyżej 79 zł darmowa.",
  },
  {
    question: "Jak czyścić plisę?",
    answer:
      "Kurz: odkurzacz z miękką końcówką albo sucha ściereczka, przy złożonej plisie. Plamę: lekko wilgotna gąbka, bez detergentów i bez moczenia całej tkaniny. Nie prać, nie prasować — tkanina straciłaby fałdy.",
  },
  {
    question: "Co się zużywa i czy mogę to naprawić sam?",
    answer:
      "Profile są aluminiowe, tkanina nie ma części ruchomych. Jedyne, co z czasem może się poluzować, to napięcie sznurków — regulujesz je samodzielnie supełkiem pod górną listwą, bez narzędzi. Uchwyty bezinwazyjne można zdjąć i założyć ponownie, na przykład do mycia okna.",
  },
  {
    question: "Czy kod SEZON20 działa na plisy?",
    answer:
      "Tak. SEZON20 obniża cenę plis o 20 %. Aktywuj go na tej stronie albo wpisz w koszyku — rabat zobaczysz w podsumowaniu zamówienia.",
  },
  {
    question: "Jaka jest gwarancja i czy mogę zwrócić plisę?",
    answer:
      "5 lat gwarancji na plisę, tak jak na wszystkie produkty KEIKA — profile są aluminiowe, mechanizm nie ma elementów, które się wycierają. Do tego 30 dni na zwrot bez podania przyczyny: jeśli plisa nie spełni oczekiwań, odsyłasz ją, a my oddajemy pieniądze.",
  },
];
