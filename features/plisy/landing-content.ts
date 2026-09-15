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

export const PLISY_SUBTITLE =
  "Zasłaniasz tylko tyle okna, ile chcesz: od góry, od dołu albo sam środek. 150 tkanin w 5 kolekcjach, 10 kolorów profili do wyboru, montaż z wierceniem lub bez.";

export const PLISY_SPEC_ITEMS: PlisySpecItem[] = [
  {
    label: "Na wymiar co do milimetra",
    value: "Wpisujesz szerokość i wysokość, my wykonujemy plisę dokładnie pod Twoje okno. Bez prześwitów po bokach, bez docinania w domu.",
  },
  {
    label: "Od góry i od dołu",
    value:
      "Dwa uchwyty: przesuwasz tkaninę w górę, w dół albo zostawiasz ją w środku okna. Prywatność bez rezygnacji ze światła.",
  },
  {
    label: "Z wierceniem lub bez",
    value:
      "Standardowo uchwyty przykręcane przy szybie. Wolisz nie wiercić? Uchwyty bezinwazyjne na skrzydło od +4,90 zł: zakładasz i zdejmujesz bez śladu.",
  },
  {
    label: "Gwarancja satysfakcji",
    value: "Jeżeli plisa nie spełni Twoich oczekiwań, możesz ją zwrócić w 30 dni, a my oddamy pieniądze. Bez zbędnych pytań.",
  },
];

export const PLISY_FEATURE_BULLETS: PlisyFeatureBullet[] = [
  {
    lead: "150 tkanin w 5 kolekcjach",
    detail: "od lekkich, rozpraszających światło, po pełny blackout i termoizolacyjny plaster miodu",
  },
  {
    lead: "10 kolorów profili do wyboru",
    detail: "biel, brąz, anoda, antracyt, oliwka, czarny mat, sosna, winchester, złoty dąb, orzech: dobierzesz do każdej stolarki",
  },
  {
    lead: "Sterowanie od góry i od dołu",
    detail: "tkanina zatrzymuje się w dowolnym miejscu okna, bez sznurków i łańcuszków zwisających z boku",
  },
  {
    lead: "Trzy sposoby montażu",
    detail: "standardowy przykręcany przy szybie, bezinwazyjny PCV lub bezinwazyjny metalowy na skrzydło okna",
  },
  {
    lead: "Nie blokuje uchylania ani otwierania",
    detail: "plisa jedzie razem ze skrzydłem, klamka zostaje wolna",
  },
  {
    lead: "Okna od 40 do 210 cm szerokości i do 230 cm wysokości",
    detail: "pokoje, kuchnie, łazienki, drzwi balkonowe",
  },
  {
    lead: "Uchwyty i elementy montażowe w komplecie",
    detail: "montaż zajmuje kilka minut, wystarczy wkrętak",
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
  title: `Produkujemy w Szczecinku, realizacja ${PLISY_LEAD_TIME_LABEL}`,
  body:
    "Każda plisa powstaje na Twój wymiar w naszej produkcji. Po wyprodukowaniu wysyłamy kurierem w 24 h, darmowa dostawa od 79 zł. Kilka okien? W konfiguratorze dodasz kolejne wymiary do jednego zamówienia.",
};

export const PLISY_FAQ: PlisyFaqEntry[] = [
  {
    question: "Czym plisa różni się od zwykłej rolety?",
    answer:
      "Roleta zasłania okno od góry w dół. Plisa ma dwa uchwyty: zasłonisz dolną część okna, górną albo zostawisz tkaninę pośrodku. Widzisz niebo, sąsiad nie widzi Ciebie. Plisa nie ma rury nawojowej, więc jest cieńsza i lżejsza.",
  },
  {
    question: "Czy muszę wiercić w oknie?",
    answer:
      "Nie musisz. Wybierz montaż bezinwazyjny PCV (+4,90 zł) lub METAL (+19,90 zł): uchwyty zakładane na skrzydło okna, bez wiercenia i bez śladów. Idealne do mieszkań wynajmowanych i nowych okien na gwarancji. Montaż STANDARD (uchwyty przykręcane przy szybie) daje najbardziej wbudowany wygląd.",
  },
  {
    question: "Czym różnią się uchwyty bezinwazyjne PCV od metalowych?",
    answer:
      "Oba zakłada się na skrzydło okna bez wiercenia. PCV to najtańszy sposób montażu bez wiercenia. Metalowe są sztywniejsze i trwalsze, polecamy je do szerszych i wyższych plis oraz cięższych tkanin DUO.",
  },
  {
    question: "Jak zmierzyć okno?",
    answer:
      "W milimetrach, w trzech miejscach (góra, środek, dół), i wpisz najmniejszy wynik. Przy montażu STANDARD mierzysz szerokość i wysokość szyby między listwami przyszybowymi. Przy montażu bezinwazyjnym mierzysz szerokość i wysokość całego skrzydła, bo uchwyty zaczepiają się o jego krawędź. Masz wątpliwość? Napisz na czacie, sprawdzimy pomiar przed produkcją.",
  },
  {
    question: "Czy plisa przeszkadza w uchylaniu i otwieraniu okna?",
    answer: "Nie. Plisa jest zamocowana do skrzydła i porusza się razem z nim. Klamka pozostaje wolna.",
  },
  {
    question: "Która tkanina do sypialni?",
    answer:
      "Podgumowane (Blackout) albo DUO TERMO. Blackout blokuje światło, DUO TERMO dodatkowo izoluje termicznie i nie ma otworów pod sznurki, więc nie ma punktowych prześwitów. Przy każdej osłonie wewnętrznej zostaje minimalny prześwit na krawędziach, to cecha wszystkich plis i rolet.",
  },
  {
    question: "Która tkanina do kuchni i łazienki?",
    answer:
      "Klasyczne lub Reflex: gładkie tkaniny poliestrowe, które łatwo przetrzeć wilgotną ściereczką. W jasnych kolorach wnętrze wydaje się większe, ciemne dodają elegancji.",
  },
  {
    question: "Czy plisa chroni przed nagrzewaniem latem?",
    answer:
      "Tak, w różnym stopniu. Reflex ma od strony szyby powłokę odbijającą promienie słoneczne. DUO plaster miodu i DUO TERMO tworzą poduszkę powietrzną między dwiema warstwami tkaniny: latem ogranicza nagrzewanie, zimą ucieczkę ciepła przez szybę.",
  },
  {
    question: "Jak długo czekam na plisę?",
    answer: `Każda plisa jest produkowana na Twój wymiar w naszym zakładzie w Szczecinku. Czas realizacji to ${PLISY_LEAD_TIME_LABEL}, potem kurier dostarcza paczkę w 24 h. Darmowa dostawa od 79 zł.`,
  },
  {
    question: "Czy mogę zamówić próbki tkanin?",
    answer:
      "Obecnie nie wysyłamy próbek. Zdjęcia tkanin w konfiguratorze robimy z realnych próbników, a każdy kolor ma kod producenta tkanin (np. PP 151), więc jeśli masz już plisę z tym kodem, dostaniesz identyczną. Pamiętaj, że ekran telefonu może lekko zmienić odcień.",
  },
  {
    question: "Co jeśli źle zmierzę?",
    answer:
      "Napisz do nas od razu po złożeniu zamówienia. Jeśli plisa nie weszła jeszcze do produkcji, poprawimy wymiar. Sprawdź pomiar w trzech miejscach przed zamówieniem: okna bywają krzywe o kilka milimetrów.",
  },
  {
    question: "Czy mogę zamówić plisy do kilku okien w różnych wymiarach?",
    answer:
      "Tak. W konfiguratorze po wpisaniu wymiaru kliknij „Dodaj kolejną”, wpisz następny wymiar i tak dalej. Wszystkie pozycje trafią do jednego koszyka, a dostawa powyżej 79 zł jest darmowa.",
  },
  {
    question: "Jak czyścić plisę?",
    answer:
      "Odkurzaczem z miękką końcówką lub suchą ściereczką. Miejscowe zabrudzenia delikatnie wilgotną gąbką z łagodnym detergentem. Nie prać, nie prasować.",
  },
  {
    question: "Czy kod SEZON20 działa na plisy?",
    answer:
      "Tak. Kod SEZON20 obniża cenę plis o 20 %. Aktywuj go na tej stronie lub wpisz w koszyku, rabat zobaczysz w podsumowaniu zamówienia.",
  },
  {
    question: "Jaka jest gwarancja?",
    answer: "5 lat gwarancji, tak jak na wszystkie produkty KEIKA. Do tego 30 dni na zwrot bez podania przyczyny.",
  },
];
