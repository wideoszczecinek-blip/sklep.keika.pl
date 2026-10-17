import type { OfertaContent } from "../types";

// Żaluzje pionowe (verticale) - system VERTICAL i BAHAMA VERTICAL firmy
// BAMAR-POL (bamar.pl). Zdjęcia aranżacyjne: Pexels (licencja wolna).
export const ZALUZJE_PIONOWE: OfertaContent = {
  slug: "zaluzje-pionowe",
  path: "/zaluzje-pionowe",
  group: "wewnetrzne",
  menuLabel: "Żaluzje",
  seoTitle: "Żaluzje pionowe (verticale) na wymiar - biuro i dom | KEIKA",
  seoDescription:
    "Żaluzje pionowe na wymiar: pasy 89 i 127 mm, tkaniny jednolite, dzień-noc i Bahama Vertical z efektem firany. Do dużych przeszkleń, biur, skosów. Montaż do sufitu lub ściany. Bezpłatna wycena.",
  eyebrow: "Osłony wewnętrzne",
  title: "Żaluzje pionowe (verticale) na wymiar",
  lead:
    "Najprostszy sposób na zasłonięcie dużego przeszklenia: pasy obracają się o 180°, a całą żaluzję rozsuwasz na bok jak zasłonę. Do biur, salonów z oknami od podłogi do sufitu i okien skośnych.",
  hero: { src: "/oferta/zaluzje-pionowe/hero.jpg", alt: "Biuro z żaluzjami pionowymi na dużym oknie" },
  heroChips: ["Do przeszkleń od podłogi do sufitu", "Pasy obracane i rozsuwane", "Tkaniny jednolite, dzień-noc, Bahama", "Także na skosy"],
  productLabel: "Żaluzje pionowe (verticale)",
  quoteOptions: [
    "Verticale klasyczne (pasy jednolite)",
    "Verticale dzień-noc",
    "Bahama Vertical (pasy połączone siateczką)",
    "Żaluzja skośna",
    "Nie wiem - proszę o doradztwo",
  ],
  supplier: { name: "BAMAR-POL", note: "system VERTICAL / BAHAMA VERTICAL i tkaniny Bahama" },
  variants: {
    title: "Trzy rodzaje żaluzji pionowych",
    intro: "Szyna, gońce i wieszaki są wspólne - zmienia się tkanina pasów i sposób ich łączenia.",
    items: [
      {
        id: "klasyczne",
        name: "Klasyczne",
        tagline: "Pasy jednolite, biuro i dom",
        body: "Aluminiowa szyna z gońcami, do których na wieszakach zaczepione są pasy tkaniny. Obracasz je łańcuszkiem, rozsuwasz sznurkiem. Szyny można łączyć, więc zasłonisz nawet kilkumetrową ścianę okien.",
        image: "/oferta/zaluzje-pionowe/g4.jpg",
        imageAlt: "Jasne biuro z żaluzjami pionowymi na przeszklonej ścianie",
        bullets: ["Rozsuwanie na jedną stronę, od środka lub do środka", "Tkaniny gładkie, strukturalne, trudnozapalne do obiektów", "Montaż do sufitu na klipy lub do ściany na wieszak kątowy"],
      },
      {
        id: "dzien-noc",
        name: "Dzień-noc",
        tagline: "Kolekcja tkanin do verticali",
        body: "Pasy z tkaniny dzień-noc dopasowanej do żaluzji pionowych: po obróceniu wpuszczają rozproszone światło, po zamknięciu dają prywatność. Nowoczesna alternatywa dla jednolitych pasów.",
        image: "/oferta/zaluzje-pionowe/g1.jpg",
        imageAlt: "Żaluzje pionowe w ciemnym oknie z bukietem kwiatów na parapecie",
        bullets: ["Te same komponenty co w wersji klasycznej", "Pas pełny i przezierny w jednym pasie tkaniny", "Dobra do pokoi dziennych i gabinetów"],
      },
      {
        id: "bahama",
        name: "Bahama Vertical",
        tagline: "Efekt firany, funkcja żaluzji",
        body: "Pełne pasy tkaniny połączone delikatną siateczką tworzą jedną elegancką zasłonę, a mimo to pasy nadal obracają się i przesuwają. Kolekcja Dreamy ma w części przeziernej splot inspirowany bambusem.",
        image: "/oferta/zaluzje-pionowe/bahama.jpg",
        imageAlt: "Wzornik kolorów tkaniny Bahama Vertical Dreamy",
        bullets: ["Pas pełny 12 cm, przezierny 16 cm (Dreamy IX)", "Jasne neutralne odcienie, szarości, czerń", "Do salonów, hoteli, gabinetów"],
      },
    ],
  },
  features: [
    { icon: "ruler", title: "Każda szerokość", body: "Szyny łączymy na długość, a pasy dokładamy w dowolnej liczbie - zasłonisz całą ścianę przeszklenia jedną żaluzją." },
    { icon: "sun", title: "Płynna regulacja światła", body: "Obrót pasów w zakresie 180° pozwala ustawić je pod kątem do słońca, bez odsłaniania wnętrza." },
    { icon: "home", title: "Również na skosy", body: "Żaluzję pionową można wykonać ze skośną szyną - do poddaszy i okien trapezowych." },
    { icon: "tools", title: "Serwis bez wymiany całości", body: "Pojedynczy pas, wieszak czy goniec wymieniamy osobno. Pasy można prać lub zastąpić nowymi po latach." },
  ],
  gallery: [
    { src: "/oferta/zaluzje-pionowe/g2.jpg", alt: "Zbliżenie na pasy żaluzji pionowej pod światło", caption: "Pasy pod kątem do słońca" },
    { src: "/oferta/zaluzje-pionowe/g3.jpg", alt: "Żaluzje pionowe w porannym świetle w pokoju", caption: "Miękkie światło przez pasy" },
    { src: "/oferta/zaluzje-pionowe/g5.jpg", alt: "Zbliżenie na strukturę tkaniny pasów żaluzji pionowej", caption: "Struktura tkaniny" },
    { src: "/oferta/zaluzje-pionowe/system.jpg", alt: "Wizualizacja systemu żaluzji pionowej z szyną i pasami", caption: "System VERTICAL" },
    { src: "/oferta/zaluzje-pionowe/panel.jpg", alt: "Szyna wielotorowa zasłony panelowej Panel Track", caption: "Zasłona panelowa PANEL TRACK - alternatywa dla dużych przeszkleń" },
  ],
  specs: {
    title: "Najważniejsze parametry",
    items: [
      { label: "System", value: "aluminiowa szyna z gońcami, pasy na wieszakach; szyny łączone na większe szerokości" },
      { label: "Sterowanie", value: "łańcuszek (obrót pasów) i sznurek (rozsuwanie); opcjonalnie napęd elektryczny" },
      { label: "Rozsuwanie", value: "na lewo, na prawo, od środka na boki lub do środka" },
      { label: "Montaż", value: "do sufitu (klipy) lub do ściany (wieszak kątowy); wersja skośna na zamówienie" },
      { label: "Tkaniny", value: "jednolite i strukturalne, trudnozapalne, dzień-noc do verticali, Bahama Vertical (pasy łączone siateczką), wysokość belki 280–300 cm" },
      { label: "Bahama Vertical Dreamy IX", value: "pas pełny 12 cm, przezierny 16 cm, 100% poliester, 239 g/m²" },
      { label: "Alternatywa", value: "zasłona panelowa PANEL TRACK - wolnowiszące panele na szynie wielotorowej, do okien i jako przegroda w pomieszczeniu" },
    ],
  },
  faq: [
    { q: "Czy verticale pasują do mieszkania, nie tylko do biura?", a: "Tak - kolekcje Bahama Vertical i dzień-noc wyglądają jak lekka zasłona, a nie biurowa żaluzja. Dobrze pracują przy drzwiach tarasowych, bo odsuwasz je na bok jak firanę." },
    { q: "Jaką szerokość pasa wybrać?", a: "Do większości okien polecamy pas 127 mm (mniej pasów, spokojniejszy wygląd). Pas 89 mm sprawdza się w małych oknach i tam, gdzie zależy Ci na drobniejszym rytmie." },
    { q: "Co z dolnymi obciążnikami i łańcuszkiem łączącym?", a: "Standardowo pasy mają obciążniki i łańcuszek dolny, który trzyma je w równym rytmie. Na życzenie montujemy pasy bez łańcuszka dolnego (np. przy dzieciach)." },
    { q: "Czy żaluzję pionową można zamontować w oknie skośnym?", a: "Tak, wykonujemy żaluzje ze skośną szyną - pasy mają wtedy różne długości i rozsuwają się w stronę wyższego boku." },
  ],
  related: ["rolety-dzien-noc", "rolety-tradycyjne", "rolety-rzymskie"],
  ownerNote: "Zdjęcia aranżacyjne z Pexels (18306897, 13972523, 12082933, 15669913, 19837082, 239854 - licencja Pexels). Szerokości pasów 89/127 mm to standard rynkowy - potwierdzić u BAMAR-POL.",
};
