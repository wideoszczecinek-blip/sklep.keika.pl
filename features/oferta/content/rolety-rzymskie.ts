import type { OfertaContent } from "../types";

// Rolety rzymskie - systemy i tkaniny BAMAR-POL (bamar.pl): klasyczne rzymskie
// z tkanin dekoracyjnych/blackout oraz rzymskie dzień-noc (kolekcje Bahama:
// Bergamo, Milano I/II, Palermo, Napoli, Bologna, Venezia, Roma, Genova;
// szerokość tkaniny 275 cm). Zdjęcia aranżacyjne: Pexels (licencja wolna),
// zdjęcia tkanin: katalogi BAMAR-POL.
export const ROLETY_RZYMSKIE: OfertaContent = {
  slug: "rolety-rzymskie",
  path: "/rolety-rzymskie",
  group: "wewnetrzne",
  menuLabel: "Rolety rzymskie",
  seoTitle: "Rolety rzymskie na wymiar - klasyczne i dzień-noc | KEIKA",
  seoDescription:
    "Rolety rzymskie szyte na wymiar: klasyczne z tkanin dekoracyjnych i zaciemniających oraz rzymskie dzień-noc z pasami przeziernymi. Montaż do ściany, sufitu, we wnęce lub na ramie okna. Bezpłatna wycena.",
  eyebrow: "Osłony wewnętrzne",
  title: "Rolety rzymskie na wymiar",
  lead:
    "Miękkość zasłony i wygoda rolety. Rzymska składa się w równe poziome fałdy, więc wygląda jak element aranżacji, a nie technika na oknie. Szyjemy ją z tkanin dekoracyjnych, zaciemniających oraz w wersji dzień-noc.",
  hero: { src: "/oferta/rolety-rzymskie/hero.jpg", alt: "Beżowa roleta rzymska w jasnym salonie z fotelem" },
  heroChips: ["Klasyczne i dzień-noc", "Tkaniny dekoracyjne i blackout", "Na ścianę, sufit, we wnękę lub na ramę", "Szyte na wymiar"],
  productLabel: "Rolety rzymskie",
  quoteOptions: [
    "Rzymska klasyczna (tkanina dekoracyjna)",
    "Rzymska zaciemniająca (blackout)",
    "Rzymska dzień-noc",
    "Nie wiem - proszę o doradztwo",
  ],
  supplier: { name: "BAMAR-POL", note: "systemy i kolekcje tkanin rzymskich (Bahama)" },
  variants: {
    title: "Trzy odsłony rolety rzymskiej",
    intro: "Mechanizm jest ten sam - łańcuszek z hamulcem i listwa montażowa. Różni je tkanina, a więc ilość światła, jaką wpuszczą.",
    items: [
      {
        id: "klasyczna",
        name: "Klasyczna",
        tagline: "Tkaniny gładkie, lniane, wzorzyste",
        body: "Fałdy układają się dzięki wszytym listewkom, a tkanina do wyboru z kolekcji dekoracyjnych: od półprzeziernych lnów po gęste splotem materiały strukturalne. Najczęściej wybierana do salonu i jadalni.",
        image: "/oferta/rolety-rzymskie/g1.jpg",
        imageAlt: "Biała roleta rzymska w oknie kuchennym z ziołami na parapecie",
        bullets: ["Podszewka opcjonalna - zwiększa trwałość i ogranicza blaknięcie", "Szerokość pojedynczej rolety do ok. 270 cm (zależnie od tkaniny)", "Możliwe łączenie kilku rolet na jednej ścianie"],
      },
      {
        id: "blackout",
        name: "Zaciemniająca",
        tagline: "Tkanina blackout, sypialnia i pokój dziecka",
        body: "Tkanina nie przepuszcza światła, a przy montażu we wnęce lub z zakładem na ścianę daje mrok wystarczający do spania w dzień. Wygląda jak klasyczna rzymska - zaciemnienie jest w splocie, nie w folii.",
        image: "/oferta/rolety-rzymskie/dn.jpg",
        imageAlt: "Szara roleta rzymska rozwinięta na oknie, widok z przodu",
        bullets: ["Kolekcje jednolite i drewnopodobne", "Opcja tkaniny trudnozapalnej do obiektów", "Montaż z zakładem 5–8 cm na ścianę przy pełnym zaciemnieniu"],
      },
      {
        id: "dzien-noc",
        name: "Dzień-noc",
        tagline: "Szerokie pasy, czarna siateczka",
        body: "Tkanina rzymska dzień-noc ma szerokie pasy pełne i przezierne - po zsunięciu wnętrze jest zasłonięte, po przesunięciu wpada miękkie, rozproszone światło. Czarna siatka w pasach przeziernych daje nowoczesny, graficzny efekt.",
        image: "/oferta/rolety-rzymskie/g2.jpg",
        imageAlt: "Tkanina rzymska dzień-noc Bahama z szerokimi pasami",
        bullets: ["Kolekcje Bahama Bergamo, Milano, Palermo, Napoli, Bologna, Venezia, Roma, Genova", "Szerokość tkaniny 275 cm", "Wybrane kolory z atestem trudnopalności"],
      },
    ],
  },
  features: [
    { icon: "palette", title: "Wygląd zasłony, obsługa rolety", body: "Fałdy układają się równo za każdym razem, bo listewki trzymają kształt. Nie trzeba niczego poprawiać ręką." },
    { icon: "ruler", title: "Pod wymiar wnęki lub ściany", body: "Mierzymy wnękę albo planujemy zakład na ścianę - w zależności od tego, czy ma być lekko, czy ciemno." },
    { icon: "sun", title: "Od lnu po blackout", body: "Ta sama forma, różna tkanina: ażurowa do kuchni, gęsta do salonu, zaciemniająca do sypialni." },
    { icon: "tools", title: "Łatwe pranie", body: "Tkaninę zdejmuje się z listwy montażowej na rzep, a listewki wysuwa z tuneli. Większość materiałów można prać delikatnie." },
  ],
  gallery: [
    { src: "/oferta/rolety-rzymskie/g3.jpg", alt: "Zbliżenie na splot tkaniny rzymskiej dzień-noc w odcieniach beżu", caption: "Tkanina Bahama Bergamo" },
    { src: "/oferta/rolety-rzymskie/g4.jpg", alt: "Grafitowa roleta rzymska dzień-noc, widok z przodu", caption: "Rzymska dzień-noc w grafitowym odcieniu" },
    { src: "/oferta/rolety-rzymskie/g5.jpg", alt: "Tkanina Milano z wzorem kół w odcieniu beżowym", caption: "Kolekcja Milano - wzór „bąbelki”" },
    { src: "/oferta/rolety-rzymskie/g6.jpg", alt: "Tkanina Milano z wzorem kół w odcieniu szarym", caption: "Kolekcja Milano - szarość" },
    { src: "/oferta/rolety-rzymskie/g7.jpg", alt: "Zbliżenie na tkaniny rzymskie w kilku kolorach", caption: "Próbki tkanin" },
    { src: "/oferta/rolety-rzymskie/g8.jpg", alt: "Roleta rzymska dzień-noc w jasnej tkaninie, widok produktu", caption: "Rzymska dzień-noc na listwie montażowej" },
  ],
  specs: {
    title: "Najważniejsze parametry",
    items: [
      { label: "Rodzaje", value: "klasyczna, zaciemniająca (blackout), dzień-noc" },
      { label: "Sterowanie", value: "łańcuszek z hamulcem (zatrzymanie w dowolnym położeniu); opcjonalnie silnik przy dużych oknach" },
      { label: "Montaż", value: "do ściany, do sufitu, we wnęce okiennej lub na ramie okna (wieszaki bezinwazyjne przy lekkich tkaninach)" },
      { label: "Tkaniny rzymskie dzień-noc", value: "kolekcje Bahama (Bergamo i Bergamo FR, Milano I i II, Palermo, Napoli, Bologna, Venezia, Roma, Genova), szerokość 275 cm" },
      { label: "Tkaniny klasyczne", value: "dekoracyjne, gładkie, lniane, blackout; podszewka na życzenie" },
      { label: "Szerokość pojedynczej rolety", value: "do szerokości belki tkaniny (ok. 270 cm); szersze okna - zestaw kilku rolet" },
    ],
  },
  faq: [
    { q: "Rzymska czy zwykła roleta - co wybrać do salonu?", a: "Jeśli zależy Ci na miękkim, „tekstylnym” wyglądzie okna i masz miejsce nad oknem na złożony pakiet (ok. 15–25 cm), rzymska będzie wyglądać lepiej. Zwykła roleta jest dyskretniejsza i tańsza." },
    { q: "Ile miejsca zajmuje złożona roleta rzymska?", a: "Pakiet złożonych fałd ma zwykle 15–25 cm wysokości, zależnie od wysokości rolety i gęstości fałd. Przy montażu do sufitu lub wysoko nad oknem pakiet nie zasłania szyby." },
    { q: "Czy rzymska dzień-noc działa jak zwykła dzień-noc?", a: "Tak - pasy przesuwają się względem siebie łańcuszkiem. Różnica to szerokie pasy i fakt, że tkanina ta może być użyta także jako zwykła roleta dzień-noc, bez fałd." },
    { q: "Czy mogę przysłać własną tkaninę?", a: "Napisz do nas - w większości przypadków tak, o ile tkanina nadaje się do rolety (gramatura, stabilność wymiarowa). Ocenimy ją po zdjęciu lub próbce." },
  ],
  related: ["rolety-dzien-noc", "rolety-tradycyjne", "zaluzje-pionowe"],
  ownerNote: "Zdjęcia aranżacyjne z Pexels (id 279640, 34058722 - licencja Pexels, bez podpisu). Tkaniny z katalogów Bergamo/Milano BAMAR-POL. Warto zastąpić własnymi realizacjami.",
};
