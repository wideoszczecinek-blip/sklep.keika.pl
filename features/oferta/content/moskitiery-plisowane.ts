import type { OfertaContent } from "../types";

// Moskitiery plisowane - system BWL Trend (bwltrend.pl). Liczby z karty
// produktu (2026-10-17): kolory profili, siatki, maks. szerokości objęte
// gwarancją, zasada wersji podwójnej, listwy typ 2/3 i próg aluminiowy.
export const MOSKITIERY_PLISOWANE: OfertaContent = {
  slug: "moskitiery-plisowane",
  path: "/moskitiery-plisowane",
  group: "moskitiery",
  menuLabel: "Plisowane",
  seoTitle: "Moskitiery plisowane na wymiar - na drzwi tarasowe, HST, duże przeszklenia | KEIKA",
  seoDescription:
    "Moskitiera plisowana na wymiar: siatka składa się w harmonijkę, płaski próg bez sznurka, szerokości do 1,9 m na skrzydło i wysokości do 2,95 m. Wersja pojedyncza i podwójna, listwa do drzwi HST. Bezpłatna wycena.",
  eyebrow: "Moskitiery",
  title: "Moskitiery plisowane na wymiar",
  lead:
    "Najwygodniejsza moskitiera na duże przeszklenia: siatka składa się w harmonijkę i znika przy framudze, a próg ma kilka milimetrów - przejdziesz z wózkiem, a dziecko się nie potknie. Do drzwi tarasowych, HST i otworów, których nie da się zasłonić skrzydłem na zawiasach.",
  hero: { src: "/oferta/moskitiery-plisowane/hero.jpg", alt: "Moskitiera plisowana zamontowana na drzwiach tarasowych w drewnianej ramie" },
  heroChips: ["Płaski próg bez sznurka", "Do 1,9 m na skrzydło, do 2,95 m wysokości", "Pojedyncza lub podwójna", "Listwa do drzwi HST"],
  productLabel: "Moskitiery plisowane",
  quoteOptions: [
    "Plisowana pojedyncza (jedno skrzydło)",
    "Plisowana podwójna (dwa skrzydła, „kurtyna”)",
    "Do drzwi HST (listwa typ 3)",
    "Nie wiem - proszę o doradztwo",
  ],
  supplier: { name: "BWL Trend", note: "system plisowanych moskitier drzwiowych, produkcja w Polsce" },
  variants: {
    title: "Pojedyncza czy podwójna?",
    intro: "Zasada jest prosta: jeśli otwór jest co najmniej 10 cm wyższy niż szerszy, wystarczy jedno skrzydło. Przy szerokich i niskich otworach robimy dwa skrzydła spotykające się na środku.",
    items: [
      {
        id: "pojedyncza",
        name: "Pojedyncza",
        tagline: "Jedno skrzydło, siatka składa się na bok",
        body: "Profil stały przy jednej framudze, profil chodzący z uchwytem przesuwa się po dolnej prowadnicy i górnej szynie. Siatka plisowana z linkami prowadzącymi trzyma pion na całej wysokości.",
        image: "/oferta/moskitiery-plisowane/g1.jpg",
        imageAlt: "Wizualizacja moskitiery plisowanej z jednym skrzydłem w drzwiach",
        bullets: ["Szerokość do 1900 mm przy wysokości do 2300 mm", "Do 1800 mm przy wysokości 2300–2500 mm", "Do 1500 mm przy wysokości 2500–2950 mm"],
      },
      {
        id: "podwojna",
        name: "Podwójna („kurtyna”)",
        tagline: "Dwa skrzydła na szerokie i niskie otwory",
        body: "Dwa skrzydła, zwykle równe, schodzące się na środku na magnesach - ale części mogą mieć różne szerokości, np. gdy drzwi mają część stałą. Wybieramy ją, gdy otwór nie jest o 10 cm wyższy niż szerszy.",
        image: "/oferta/moskitiery-plisowane/g2.jpg",
        imageAlt: "Montaż górnej szyny moskitiery plisowanej na drewnianej framudze",
        bullets: ["Podział na pół lub asymetryczny", "Każde skrzydło składa się do swojej framugi", "Łączna szerokość ponad 3,5 m"],
      },
    ],
  },
  features: [
    { icon: "home", title: "Próg, o który nikt się nie potknie", body: "Płaski próg bez sznurka - do przejść bezbarierowych; listwa typ 3 ze spadkiem ok. 6% do drzwi podnoszono-przesuwnych HST, próg aluminiowy na nierówne podłoże." },
    { icon: "wind", title: "Lekka i kompaktowa", body: "Złożona siatka ma kilka centymetrów i chowa się przy framudze. Składanie i rozkładanie jedną ręką, także dla dziecka." },
    { icon: "shield", title: "Gwarancja producenta na duże gabaryty", body: "Szerokości do 1,9 m na skrzydło i wysokości do 2,95 m objęte gwarancją - to realne wymiary drzwi tarasowych i HST." },
    { icon: "palette", title: "Profile lakierowane i drewnopodobne", body: "Grafit, biały, brązy, beż, czarny (połysk lub mat), okleiny złoty dąb, Woodec Turner Oak, winchester, orzech; na zamówienie dowolny RAL." },
  ],
  gallery: [
    { src: "/oferta/moskitiery-plisowane/g2.jpg", alt: "Montaż moskitiery plisowanej - mocowanie szyny górnej", caption: "Montaż szyny górnej" },
    { src: "/oferta/moskitiery-plisowane/prowadnica.jpg", alt: "Profil prowadnicy dolnej moskitiery plisowanej z rysunkiem przekroju", caption: "Prowadnica 0146 - 60 × 43 mm" },
    { src: "/oferta/moskitiery-plisowane/profil-staly.jpg", alt: "Profil stały moskitiery plisowanej z przekrojem", caption: "Profil stały 0103 - 56 × 35,6 mm" },
    { src: "/oferta/moskitiery-plisowane/profil-chodzacy.jpg", alt: "Profil chodzący moskitiery plisowanej z przekrojem", caption: "Profil chodzący 0126 - 56 × 35 mm" },
    { src: "/oferta/moskitiery-plisowane/slupek.jpg", alt: "Słupek moskitiery plisowanej z przekrojem", caption: "Słupek 0147 - 43 × 17,5 mm" },
  ],
  specs: {
    title: "Najważniejsze parametry",
    items: [
      { label: "Maks. szerokość objęta gwarancją (na skrzydło)", value: "1900 mm do wys. 2300 mm; 1800 mm przy wys. 2300–2500 mm; 1500 mm przy wys. 2500–2950 mm" },
      { label: "Wersja", value: "pojedyncza, gdy wysokość ≥ szerokość + 10 cm; w pozostałych przypadkach podwójna (kurtyna), podział równy lub asymetryczny" },
      { label: "Listwy dolne", value: "typ 2 - równe podłoże, bez regulacji; typ 3 - do drzwi HST, spadek ok. 6%; próg aluminiowy - podłoże nierówne lub niestabilne" },
      { label: "Siatka", value: "plisowana, odporna na warunki atmosferyczne; kolor szary lub czarny" },
      { label: "Kolory profili", value: "grafit RAL 7016, biały RAL 9016, brąz RAL 8017 i 8014, beż RAL 1019, czarny RAL 9005 (połysk / mat); okleiny złoty dąb, Woodec Turner Oak, winchester, orzech; inne RAL na zamówienie" },
      { label: "Profile", value: "stały 56 × 35,6 mm, chodzący 56 × 35 mm, prowadnica 60 × 43 mm, słupek 43 × 17,5 mm" },
      { label: "Montaż", value: "we wnęce, do okna (wewnątrz wnęki) lub nawierzchniowo; taśma piankowa, kołki, klej montażowy lub wkręty" },
    ],
  },
  faq: [
    { q: "Czy plisowana jest szczelna przy progu?", a: "Tak - siatka biegnie w dolnej prowadnicy, a profil chodzący ma uszczelki. Szczeliny nie ma, mimo że próg jest płaski." },
    { q: "Czy mogę zostawić ją rozłożoną cały czas?", a: "Możesz, ale producent zaleca codzienne złożenie i rozłożenie, żeby plisy zachowały kształt, i unikanie silnych przeciągów przy rozłożonej siatce." },
    { q: "Mam drzwi HST z niskim progiem - zadziała?", a: "Tak, do HST stosujemy listwę typ 3 z lekkim spadkiem, dopasowaną do progu drzwi. Potrzebujemy rzeczywistych wymiarów wnęki w trzech punktach." },
    { q: "Jak mierzyć?", a: "Szerokość i wysokość w co najmniej trzech miejscach, do produkcji przyjmujemy najmniejszy wymiar. Warto sprawdzić pion poziomicą. Najprościej: zrób pomiar orientacyjny do wyceny, dokładny zrobimy przy montażu." },
  ],
  related: ["moskitiery-przesuwne", "moskitiery-drzwiowe", "rolety-zewnetrzne"],
  ownerNote: "Zdjęcia i parametry z bwltrend.pl (karta „Moskitiery drzwiowe”). Hero to zdjęcie realizacji BWL Trend.",
};
