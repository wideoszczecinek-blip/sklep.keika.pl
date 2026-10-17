import type { OfertaContent } from "../types";

// Rolety materiałowe (tradycyjne) - komponenty BESTA (systemy kasetowe UNI
// BESTA II MIKRO / SMALL / KOMBI / FLAT / LUISA / MAXI, wolnowiszące MINI /
// RS / BXL / MGS). Liczby wprost z kart systemów na besta.wroc.pl (2026-10-17).
export const ROLETY_TRADYCYJNE: OfertaContent = {
  slug: "rolety-tradycyjne",
  path: "/rolety-tradycyjne",
  group: "wewnetrzne",
  menuLabel: "Rolety tradycyjne",
  seoTitle: "Rolety materiałowe na wymiar - w kasecie, z prowadnicami i wolnowiszące | KEIKA",
  seoDescription:
    "Rolety tradycyjne na wymiar: w kasecie zwykłej (przyszybowe, bez wiercenia), w kasecie z prowadnicami przestrzennymi i wolnowiszące do dużych przeszkleń. Tkaniny gładkie, dekoracyjne i zaciemniające. Bezpłatna wycena.",
  eyebrow: "Osłony wewnętrzne",
  title: "Rolety materiałowe na wymiar",
  lead:
    "Klasyczna roleta, która po prostu działa: szczelnie, cicho i przez lata. Dobierzemy kasetę do Twoich listew przyszybowych, prowadnice do skrzydła i tkaninę do pomieszczenia - od lekko przepuszczającej światło po pełny blackout.",
  hero: { src: "/oferta/rolety-tradycyjne/hero.jpg", alt: "Roleta wolnowisząca w jasnym wnętrzu, zbliżenie na tkaninę i rurę nawojową" },
  heroChips: ["Kaseta zwykła i przestrzenna", "Montaż bez wiercenia", "Tkaniny gładkie, dekoracyjne, blackout", "Wolnowiszące do 3,2 m"],
  productLabel: "Rolety tradycyjne (materiałowe)",
  quoteOptions: [
    "Roleta w kasecie zwykłej (na skrzydle, bez wiercenia)",
    "Roleta w kasecie z prowadnicami przestrzennymi",
    "Roleta wolnowisząca (do ściany lub sufitu)",
    "Nie wiem - proszę o doradztwo",
  ],
  supplier: { name: "BESTA", note: "polski producent systemów rolet materiałowych" },
  variants: {
    title: "Trzy sposoby montażu - który do Twojego okna?",
    intro: "Każdy z nich robimy na wymiar i w tej samej palecie tkanin. Różnią się tym, gdzie siedzi kaseta i jak prowadzony jest materiał.",
    items: [
      {
        id: "kaseta",
        name: "W kasecie zwykłej",
        tagline: "Na skrzydle okna, bez wiercenia",
        body: "Mała aluminiowa kaseta kryje nawinięty materiał, a płaskie prowadnice przy szybie trzymają tkaninę blisko szkła. Roleta otwiera i uchyla się razem z oknem. Montaż przez przyklejenie lub przykręcenie do listwy przyszybowej - bez ingerencji w ramę.",
        image: "/oferta/rolety-tradycyjne/kaseta.jpg",
        imageAlt: "Roleta w kasecie przyszybowej zamontowana na skrzydle okna",
        bullets: ["Do 160 cm szerokości i 210 cm wysokości", "12 kolorów kasety, w tym okleiny drewnopodobne", "Wersja FLAT do listew powyżej 20 mm - prawie bez kolizji z klamką"],
      },
      {
        id: "przestrzenna",
        name: "W kasecie z prowadnicami przestrzennymi",
        tagline: "Pełne prowadzenie, lepsze zaciemnienie",
        body: "Kaseta siedzi na górze ramy, a materiał biegnie w prowadnicach odsuniętych od szyby - dlatego pasuje też do okien z głębokimi listwami i do drzwi balkonowych. Z tkaniną blackout daje najmocniejsze zaciemnienie wśród rolet naokiennych.",
        image: "/oferta/rolety-tradycyjne/przestrzenna.jpg",
        imageAlt: "Roleta w kasecie z prowadnicami bocznymi, tkanina dekoracyjna",
        bullets: ["Wersja naramowa: przyklejana taśmą albo wieszana na wieszakach", "Opcjonalnie napęd sprężynowy zamiast łańcuszka", "Systemy LUISA i MAXI do większych otworów, także z silnikiem"],
      },
      {
        id: "wolnowiszaca",
        name: "Wolnowisząca",
        tagline: "Do ściany lub sufitu, na duże przeszklenia",
        body: "Materiał nawinięty na rurę z ozdobnymi uchwytami, bez kasety. Zasłania cały otwór okienny lub drzwiowy, więc sprawdza się na tarasach, w salonach z dużymi oknami i w biurach. Obsługa łańcuszkiem albo silnikiem.",
        image: "/oferta/rolety-tradycyjne/g3.jpg",
        imageAlt: "Roleta wolnowisząca w szarej tkaninie na ciemnej ramie okna",
        bullets: ["Szerokość tkaniny od 0,6 do 3,2 m (zależnie od gramatury)", "Wysokość do 4 m w systemach z rurą 34 mm", "Napęd elektryczny z pilotem lub sterowaniem z telefonu"],
      },
    ],
  },
  features: [
    { icon: "ruler", title: "Pod wymiar Twojego okna", body: "Mierzysz raz, resztę liczymy my - szerokość kasety, długość prowadnic i naddatki tkaniny dobieramy do skosu listew w Twoim oknie." },
    { icon: "palette", title: "Tkanina do pomieszczenia", body: "Gładkie i strukturalne do salonu, zaciemniające do sypialni, zmywalne do kuchni i łazienki. Pokażemy próbki przy pomiarze albo wyślemy zdjęcia." },
    { icon: "tools", title: "Montaż bez śladów", body: "Rolety naokienne mocujemy na taśmie lub wieszakach - po demontażu rama wygląda jak nowa. Przy wynajmie to często jedyna opcja." },
    { icon: "clock", title: "Lata cichej pracy", body: "Mechanizmy hamujące i łańcuszkowe są wymienne, a aluminiowe kasety nie żółkną. Serwisujemy to, co sprzedajemy." },
  ],
  gallery: [
    { src: "/oferta/rolety-tradycyjne/g1.jpg", alt: "Zbliżenie na uchwyt rolety wolnowiszącej i tkaninę", caption: "Uchwyt rolety wolnowiszącej" },
    { src: "/oferta/rolety-tradycyjne/g2.jpg", alt: "Roleta wolnowisząca od spodu - belka dociążająca i tkanina", caption: "Listwa dolna i tkanina" },
    { src: "/oferta/rolety-tradycyjne/g4.jpg", alt: "Roleta z napędem łańcuszkowym na białej ramie", caption: "Obsługa łańcuszkiem" },
    { src: "/oferta/rolety-tradycyjne/small.jpg", alt: "Mała kaseta aluminiowa systemu SMALL na skrzydle okna", caption: "Kaseta SMALL - mniejsza, szersze otwarcie skrzydła" },
    { src: "/oferta/rolety-tradycyjne/naramowa.jpg", alt: "Roleta naramowa z kasetą na górze ramy okna", caption: "Wersja naramowa" },
    { src: "/oferta/rolety-tradycyjne/flat.jpg", alt: "Płaska kaseta FLAT na oknie z wysokimi listwami", caption: "Kaseta FLAT" },
    { src: "/oferta/rolety-tradycyjne/przyszybowa.jpg", alt: "Roleta przyszybowa z prowadnicą płaską, widok z boku", caption: "Prowadnica płaska przy szybie" },
  ],
  specs: {
    title: "Najważniejsze parametry",
    items: [
      { label: "Kaseta zwykła (przyszybowa / naramowa)", value: "do 160 × 210 cm, rura ø17 mm, profile aluminiowe lub PCV" },
      { label: "Kaseta SMALL", value: "do 160 × 250 cm, rura ø15 mm, prowadnice płaskie lub przestrzenne, kaseta aluminiowa" },
      { label: "Wolnowisząca MINI (na skrzydle)", value: "do 160 × 250 cm, montaż bezinwazyjny, kolory biały / brąz / dąb" },
      { label: "Wolnowisząca BXL / RS / MGS", value: "tkanina 0,6–3,2 m, rura ø34 mm, łańcuszek lub silnik, montaż do ściany lub sufitu" },
      { label: "Duże otwory (LUISA, MAXI 32/38/47)", value: "kaseta z prowadnicami do ściany lub sufitu, napęd łańcuszkowy, sprężynowy lub elektryczny, możliwe pełne zaciemnienie" },
      { label: "Kolory profili", value: "biały, brąz, anoda, szary oraz okleiny: dąb, jasny dąb, złoty dąb, mahoń, wiśnia, orzech ciemny, dąb bagienny, winchester" },
      { label: "Tkaniny", value: "gładkie, strukturalne, dekoracyjne, zaciemniające (blackout), zmywalne; próbki przy pomiarze" },
      { label: "Sterowanie", value: "łańcuszek (metal lub tworzywo), sprężyna, silnik 230 V lub akumulatorowy z pilotem" },
    ],
  },
  faq: [
    { q: "Czy roleta w kasecie zasłoni całą szybę?", a: "Tak - kaseta zwykła prowadzi tkaninę tuż przy szybie, a prowadnice zakrywają boczne prześwity. Pełną ciemność daje dopiero tkanina blackout w kasecie z prowadnicami przestrzennymi; w kasecie zwykłej zostaje delikatna poświata przy krawędziach." },
    { q: "Czy montaż na taśmie na pewno wytrzyma?", a: "Tak. Używamy taśm piankowych przeznaczonych do profili okiennych; wymagają tylko odtłuszczonej powierzchni. Alternatywą są wieszaki zaczepiane na skrzydle albo wkręty w listwę przyszybową." },
    { q: "Mam okna z klamką blisko szyby - czy kaseta będzie przeszkadzać?", a: "Do takich okien polecamy kasetę FLAT (bardzo płaska, do listew powyżej 20 mm) albo SMALL. Przy pomiarze sprawdzamy kolizję z klamką i uchyłem." },
    { q: "Jak podać wymiary do wyceny?", a: "Do wyceny wystarczy szerokość i wysokość szyby albo całego skrzydła z dokładnością do centymetra i typ montażu. Dokładny pomiar zrobimy my albo wyślemy prostą instrukcję." },
    { q: "Czy możecie dopasować kolor kasety do okien drewnopodobnych?", a: "Tak - profile są dostępne w okleinach m.in. złoty dąb, orzech, winchester, mahoń. Dobieramy pod kolor Twojej stolarki." },
  ],
  related: ["rolety-dzien-noc", "rolety-rzymskie", "zaluzje-pionowe"],
  ownerNote: "Zdjęcia z kart systemów BESTA (besta.wroc.pl). Brak zdjęcia realizacji z prowadnicami przestrzennymi w wysokiej rozdzielczości - warto dołożyć własne.",
};
