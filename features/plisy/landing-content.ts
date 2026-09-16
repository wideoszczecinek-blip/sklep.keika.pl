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
  "Plisy okienne na wymiar od polskiego producenta. Regulacja z góry i z dołu, montaż bez wiercenia lub z wierceniem, 150 tkanin i 10 kolorów profili do wyboru. Cenę dla swojego okna sprawdzisz od razu w konfiguratorze.";

/** Primary CTA wording, repeated on the landing (mobile hero button, callout,
 * end-of-section nudges). One promise everywhere: the price, for your
 * window, now. */
export const PLISY_PRIMARY_CTA = "Sprawdź cenę dla swojego okna";

/** Fallback for the CRM "description" field (HTML). */
export const PLISY_DESCRIPTION_HTML =
  "<p><strong>Plisy okienne</strong> to osłony z tkaniny plisowanej, montowane bezpośrednio na skrzydle okna. W odróżnieniu od rolety mają dwie ruchome listwy: tkaninę przesuwasz z góry i z dołu i zasłaniasz tylko tę część okna, którą chcesz. Plisa nie przeszkadza w otwieraniu i uchylaniu okna, nie ma sznurków ani łańcuszków, a złożona zajmuje zaledwie kilka centymetrów.</p>" +
  "<p><strong>Produkujemy plisy sami, w Polsce.</strong> Jesteśmy producentem osłon okiennych. Każdą plisę wykonujemy na indywidualny wymiar, z aluminiowymi profilami w 10 kolorach i tkaninami z 5 kolekcji: od przepuszczających światło, przez termoizolacyjne plastry miodu, po w pełni zaciemniające. Wszystkie tkaniny są antystatyczne i łatwe w czyszczeniu.</p>" +
  "<p><strong>Zamawiasz online w kilka minut.</strong> Wybierasz sposób montażu, kolor profili i tkaninę, wpisujesz wymiary i od razu widzisz cenę. Plisę produkujemy w 5–10 dni roboczych i wysyłamy kurierem w 24 h od wyprodukowania. Darmowa dostawa od 79 zł, 5 lat gwarancji, 30 dni na zwrot.</p>";

export const PLISY_SPEC_ITEMS: PlisySpecItem[] = [
  {
    label: "Na wymiar, co do milimetra",
    value:
      "Każda plisa jest produkowana pod wymiar Twojego okna. Podajesz szerokość i wysokość w milimetrach, my wykonujemy resztę. Pasuje do okien i drzwi balkonowych PCV, drewnianych i aluminiowych.",
  },
  {
    label: "Regulacja z góry i z dołu",
    value:
      "Dwie ruchome listwy pozwalają zasłonić dowolną część okna: górę, dół albo środek. Pełna kontrola światła i prywatności bez rezygnacji z widoku.",
  },
  {
    label: "Montaż bez wiercenia lub z wierceniem",
    value:
      "Uchwyty bezinwazyjne zakładane na skrzydło (bez śladów, łatwy demontaż, w kolorze białym, jasnym lub ciemnym brązie) albo montaż standardowy w listwach przyszybowych. Montaż zajmuje około 15 minut; wkręty, przymiar montażowy i instrukcja są w komplecie.",
  },
  {
    label: "5 lat gwarancji i 30 dni na zwrot",
    value:
      "Plisy produkujemy sami, dlatego dajemy na nie 5 lat gwarancji. Jeżeli produkt nie spełni Twoich oczekiwań, masz 30 dni na zwrot.",
  },
];

export const PLISY_FEATURE_BULLETS: PlisyFeatureBullet[] = [
  {
    lead: "Plisy na wymiar",
    detail: "produkowane pod wymiar Twojego okna: szerokość od 40 do 210 cm, wysokość od 60 do 230 cm",
  },
  {
    lead: "Regulacja z góry i z dołu",
    detail: "dowolny przesuw tkaniny na oknie, bez sznurków i łańcuszków",
  },
  {
    lead: "Montaż bezinwazyjny",
    detail: "uchwyty zakładane na skrzydło okna, bez wiercenia, z możliwością demontażu bez śladu; w kolorze białym, jasnym lub ciemnym brązie",
  },
  {
    lead: "150 tkanin w 5 kolekcjach",
    detail: "Klasyczne, Reflex, Blackout, DUO plaster miodu i DUO TERMO: od przepuszczających światło po w pełni zaciemniające",
  },
  {
    lead: "10 kolorów profili",
    detail: "biel, brąz, anoda, antracyt, oliwka, czarny mat, sosna, winchester, złoty dąb, orzech",
  },
  {
    lead: "Tkaniny antystatyczne",
    detail: "nie przyciągają kurzu, do czyszczenia wystarczy wilgotna ściereczka",
  },
  {
    lead: "Nie przeszkadza w otwieraniu okna",
    detail: "plisa porusza się razem ze skrzydłem, klamka pozostaje wolna",
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
  title: "Polski producent: plisy wykonujemy sami, we własnym zakładzie",
  body: `Nie sprowadzamy gotowych plis, produkujemy je na Twój wymiar. Realizacja ${PLISY_LEAD_TIME_LABEL}, wysyłka kurierem w 24 h od wyprodukowania, darmowa dostawa od 79 zł. Zamawiając plisy do kilku okien, dodajesz kolejne wymiary do jednego zamówienia.`,
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
      "Cena zależy od wymiaru, kolekcji tkaniny i sposobu montażu. Najmniejsza plisa 40 × 60 cm w kolekcji Klasyczne kosztuje 77 zł. Dokładną cenę dla swojego okna sprawdzisz w konfiguratorze po wpisaniu wymiarów, bez rejestracji. Kod SEZON20 obniża cenę o 20 %.",
  },
  {
    question: "Czym plisa różni się od rolety?",
    answer:
      "Roleta zasłania okno tylko od góry w dół. Plisa ma dwie ruchome listwy: zasłonisz dolną część okna, górną albo sam środek — widzisz niebo, sąsiad nie widzi Ciebie. Tkanina jest złożona w harmonijkę, nie nawija się na rurę, więc plisa jest cieńsza, lżejsza i schowana w skrzydle okna.",
  },
  {
    question: "Do jakich okien pasuje plisa?",
    answer:
      "Do okien i drzwi balkonowych PCV, drewnianych i aluminiowych, w każdym kształcie prostokątnym. Do okien drewnianych i aluminiowych polecamy montaż STANDARD (wkręcany przy szybie) — uchwyty bezinwazyjne projektowane są pod skrzydła z PCV. Do okien dachowych mamy osobny produkt: rolety dachowe, dobierane pod model okna.",
  },
  {
    question: "Jakie wymiary plis wykonujecie?",
    answer:
      "Szerokość od 40 do 210 cm, wysokość od 60 do 230 cm — to obejmuje okna, drzwi balkonowe i większość witryn. Wymiar podajesz w milimetrach, produkujemy co do milimetra. Okno spoza tego zakresu? Napisz, sprawdzimy, czy da się je zasłonić dwiema plisami.",
  },
  {
    question: "Czy muszę wiercić w oknie?",
    answer:
      "Nie musisz. Montaż bezinwazyjny (+29,90 zł) to uchwyty zakładane na krawędź skrzydła — bez wiercenia i bez śladu, zdejmiesz je w każdej chwili. Idealne do wynajmowanego mieszkania i okien na gwarancji. Uchwyty wybierasz w kolorze białym, jasnym brązie lub ciemnym brązie. Montaż STANDARD to cztery wkręty w listwach przyszybowych: nic nie odstaje, plisa wygląda jak część okna. W obu wariantach w paczce są wkręty, specjalny przymiar montażowy i czytelna instrukcja.",
  },
  {
    question: "Ile uchwytów do przesuwania ma plisa?",
    answer:
      "Plisy do 100 cm szerokości mają jeden uchwyt na środku każdej listwy. Plisy szersze niż 100 cm dostają po dwa uchwyty na listwę, żeby szeroka belka szła równo — ciągniesz za oba naraz. Przy szerokościach powyżej 110 cm (tkaniny pojedyncze) i 90 cm (plaster miodu DUO) profil aluminiowy może się lekko ugiąć pod ciężarem tkaniny — to naturalne, nie wpływa na działanie plisy, tylko na jej wygląd; konfigurator poprosi Cię o potwierdzenie.",
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
    question: "Czy szeroka plisa kosztuje więcej w dostawie?",
    answer:
      "Plisy o szerokości powyżej 150 cm wysyłamy jako przesyłkę dłużycową — kurier dolicza za nią jednorazowo 19,90 zł (do 200 cm) lub 29 zł (powyżej 200 cm) za całe zamówienie, niezależnie od liczby plis. Konfigurator pokaże tę dopłatę od razu po wpisaniu szerokości, a koszyk doliczy ją raz.",
  },
  {
    question: "Jak długo czekam na plisę?",
    answer: `Każdą plisę produkujemy na Twój wymiar we własnym zakładzie w Polsce. Realizacja to ${PLISY_LEAD_TIME_LABEL}, potem kurier dostarcza paczkę w 24 h. Darmowa dostawa od 79 zł.`,
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
