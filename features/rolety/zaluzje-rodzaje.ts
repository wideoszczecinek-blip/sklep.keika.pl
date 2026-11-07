// Żaluzje: 4 rodzaje lameli jako osobne produkty (właściciel, 7.11.2026):
// „żaluzje to jedna pozycja na liście produktów, ale po wejściu klient
// wybiera rodzaj lameli - aluminiowe, PVC, drewniane, bambusowe; rodzaj to
// produkt (własny landing, galeria), a grubość lameli to warianty”.
//
// Modele Sun & Shade (grupy ss-<pid> w profilu CRM `zaluzje`) przypisujemy do
// rodzaju po kategorii z opisu grupy. „Drewnopodobne” bez PCV to lamele
// aluminiowe z nadrukiem drewna (kody wd-met / mt w B2B), więc trafiają do
// aluminiowych. W ramach rodzaju: grubość lameli (wariant) -> wersja (gdy
// przy danej grubości jest więcej niż jeden model, np. Basswood / Abachi).
import type { FabricGroup } from "@/features/plisy/shared";
import { roletyGroupCategory, roletyGroupStartingPrice, zaluzjeSlatWidthMm, type RoletyProfile } from "./shared";

export type ZaluzjeRodzajSlug = "aluminiowe" | "pcv" | "drewniane" | "bambusowe";

export const ZALUZJE_RODZAJ_SLUGS: ZaluzjeRodzajSlug[] = ["aluminiowe", "drewniane", "bambusowe", "pcv"];

export function isZaluzjeRodzajSlug(value: string | null | undefined): value is ZaluzjeRodzajSlug {
  return value === "aluminiowe" || value === "pcv" || value === "drewniane" || value === "bambusowe";
}

/** Modele bez kolorów albo z jednym kolorem „do wyczerpania zapasów” - nie pokazujemy. */
const HIDDEN_GROUPS = new Set(["ss-80", "ss-61", "ss-96"]);

export type ZaluzjeRodzajCopy = {
  slug: ZaluzjeRodzajSlug;
  /** „Żaluzje aluminiowe” - H1, okruszek, koszyk. */
  name: string;
  /** Krótka nazwa do kafelka na stronie zbiorczej. */
  short: string;
  h1: string;
  seoTitle: string;
  seoDescription: string;
  /** Jedno zdanie pod H1 - co to jest i dla kogo. */
  lead: string;
  /** Opis produktu (akapity). */
  description: string[];
  /** Atuty: krótko, konkretnie. */
  bullets: Array<{ lead: string; detail: string }>;
  /** Do jakich pomieszczeń - plakietki. */
  rooms: string[];
  faq: Array<{ question: string; answer: string }>;
  /** Kolejność zdjęć do galerii: pid modelu -> numery zdjęć (ss_prod_<pid>_<n>_1200.jpg). */
  gallery: Array<[number, number]>;
};

const MEASURE_FAQ = {
  question: "Jak zmierzyć okno pod żaluzję?",
  answer:
    "Najpierw wybierasz sposób montażu: w świetle szyby (mierzysz szybę od połowy uszczelki do połowy uszczelki), na skrzydło (szerokość od kreseczki do kreseczki, wysokość całego skrzydła) albo na ścianę nad oknem (mierzysz wnękę). Wpisujesz to, co zmierzysz - wymiar żaluzji wyliczy konfigurator. Wszystko co do milimetra, bez zaokrąglania.",
};
const LEAD_FAQ = {
  question: "Ile czeka się na żaluzję?",
  answer: "Do 15 dni roboczych od zaksięgowania wpłaty. Żaluzja jest wykonywana na Twój wymiar i wysyłana kurierem.",
};
const SIDE_FAQ = {
  question: "Po której stronie będzie sterowanie?",
  answer:
    "Wybierasz w konfiguratorze: przekładnię (obracanie lameli) i sznurek (podnoszenie) po lewej lub prawej stronie - patrząc na okno od środka pokoju.",
};
const NODRILL_FAQ = {
  question: "Czy da się zamontować żaluzję bez wiercenia?",
  answer:
    "Tak, przy montażu na skrzydło okna (w świetle szyby lub na skrzydło) można wybrać mocowania bezinwazyjne - zakładane na skrzydło, bez wkrętów. Przy montażu na ścianę żaluzję przykręcamy klamrami.",
};
const WARRANTY_FAQ = {
  question: "Jaka jest gwarancja?",
  answer:
    "Żaluzje mają gwarancję producenta. Reklamację zgłaszasz bezpośrednio nam - prowadzimy całą sprawę i kontaktujemy się z producentem za Ciebie.",
};

export const ZALUZJE_RODZAJE: Record<ZaluzjeRodzajSlug, ZaluzjeRodzajCopy> = {
  aluminiowe: {
    slug: "aluminiowe",
    name: "Żaluzje aluminiowe",
    short: "Aluminiowe",
    h1: "Żaluzje aluminiowe na wymiar",
    seoTitle: "Żaluzje aluminiowe na wymiar - lamele 16, 25, 35 i 50 mm | KEIKA",
    seoDescription:
      "Żaluzje aluminiowe na wymiar: lamele 16, 25, 35 i 50 mm, ponad 150 kolorów, także perforowane i z nadrukiem drewna. Montaż w świetle szyby, na skrzydło lub na ścianę, sterowanie po wybranej stronie. Realizacja do 15 dni roboczych.",
    lead: "Cienkie lamele z aluminium - lekkie, odporne na wilgoć i łatwe w czyszczeniu. Najszerszy wybór kolorów i najwęższe lamele, które mieszczą się na skrzydle okna.",
    description: [
      "Żaluzja aluminiowa to najbardziej uniwersalna osłona okienna: lamele nie chłoną wilgoci, nie odkształcają się od pary i wystarczy je przetrzeć wilgotną ściereczką. Dlatego sprawdzają się w kuchni, łazience i biurze, ale też w sypialni, gdzie liczy się szybkie przyciemnienie.",
      "Grubość lameli wybierasz pod okno: 16 i 25 mm są najsmuklejsze i zostawiają najmniej miejsca między szybą a klamką, 35 mm to złoty środek, a 50 mm daje nowoczesny, „drewniany” rytm lameli na dużych oknach. Do wyboru kolory matowe, metaliczne, perłowe, perforowane (przepuszczają delikatne światło, gdy żaluzja jest zamknięta) oraz lamele z nadrukiem drewna.",
      "Każdą żaluzję wykonujemy na Twój wymiar co do milimetra. Montujesz ją w świetle szyby, na skrzydle albo na ścianie nad oknem - konfigurator pokaże, co zmierzyć.",
    ],
    bullets: [
      { lead: "Odporne na wilgoć", detail: "kuchnia, łazienka, pralnia" },
      { lead: "Lamele 16-50 mm", detail: "od smukłych na skrzydło po szerokie na duże okna" },
      { lead: "Ponad 150 kolorów", detail: "matowe, metaliczne, perłowe, perforowane, z nadrukiem drewna" },
      { lead: "Montaż na 3 sposoby", detail: "w świetle szyby, na skrzydło lub na ścianę" },
    ],
    rooms: ["Kuchnia", "Łazienka", "Biuro", "Sypialnia"],
    faq: [
      MEASURE_FAQ,
      {
        question: "Czym różnią się lamele perforowane?",
        answer:
          "Lamele perforowane (oznaczone w nazwie koloru jako „perforowany”) mają drobne otworki. Gdy żaluzja jest zamknięta, przepuszczają delikatne, rozproszone światło - w pokoju nie robi się całkiem ciemno, a z zewnątrz nadal nie widać wnętrza.",
      },
      {
        question: "Jaką grubość lameli wybrać?",
        answer:
          "Na skrzydło okna najlepiej 16 lub 25 mm - lamele odstają od szyby najmniej. 35 mm to uniwersalny wybór, a 50 mm wygląda najlepiej na dużych oknach i przy montażu na ścianę.",
      },
      NODRILL_FAQ,
      SIDE_FAQ,
      LEAD_FAQ,
      WARRANTY_FAQ,
    ],
    gallery: [
      [58, 0], [59, 3], [12, 8], [11, 3], [50, 2], [58, 5], [59, 4], [12, 3], [50, 0], [98, 0], [65, 0], [60, 3], [11, 1], [138, 0],
    ],
  },
  pcv: {
    slug: "pcv",
    name: "Żaluzje PCV drewnopodobne",
    short: "PCV drewnopodobne",
    h1: "Żaluzje PCV drewnopodobne na wymiar",
    seoTitle: "Żaluzje PCV drewnopodobne na wymiar - lamele 35, 50 i 65 mm | KEIKA",
    seoDescription:
      "Żaluzje z lamelami PCV o wyglądzie drewna, na wymiar: 35, 50 i 65 mm, gładkie i z wyczuwalną strukturą CEDRO. Odporne na wilgoć - do kuchni i łazienki. Realizacja do 15 dni roboczych.",
    lead: "Wygląd drewnianej żaluzji bez obaw o wilgoć. Lamele z PCV nie pęcznieją, nie pękają i nie blakną - tam, gdzie drewno by nie wytrzymało.",
    description: [
      "Żaluzje PCV drewnopodobne (faux wood) mają szerokie lamele, które z odległości wyglądają jak drewno, ale są z tworzywa. Para z kuchni, wilgoć w łazience i mycie na mokro im nie szkodzą, dlatego to najczęstszy wybór do pomieszczeń, w których drewno szybko by się odkształciło.",
      "Do wyboru lamele 35, 50 i 65 mm: gładkie w bielach i kolorach drewna albo w wersji CEDRO z wyczuwalnym rysunkiem słojów. Szersza lamela to mniej szczelin i bardziej „drewniany” efekt.",
      "Każdą żaluzję wykonujemy na Twój wymiar co do milimetra - w świetle szyby, na skrzydło albo na ścianę nad oknem.",
    ],
    bullets: [
      { lead: "Wygląd drewna", detail: "biele i kolory drewna, także ze strukturą CEDRO" },
      { lead: "Nie boi się wilgoci", detail: "kuchnia, łazienka, mycie na mokro" },
      { lead: "Lamele 35-65 mm", detail: "szeroka lamela = mniej szczelin" },
      { lead: "Montaż na 3 sposoby", detail: "w świetle szyby, na skrzydło lub na ścianę" },
    ],
    rooms: ["Łazienka", "Kuchnia", "Salon", "Sypialnia"],
    faq: [
      MEASURE_FAQ,
      {
        question: "Czym różni się PCV od żaluzji drewnianej?",
        answer:
          "Wyglądem są bardzo podobne, ale PCV nie chłonie wilgoci - nie pęcznieje i nie pęka, więc nadaje się do łazienki i kuchni. Lamela PCV jest nieco cięższa od drewnianej, dlatego przy bardzo dużych oknach lepiej sprawdzają się drewno lub aluminium.",
      },
      {
        question: "Co oznacza wersja CEDRO?",
        answer: "To lamele PCV z wyczuwalną strukturą słojów drewna - wyglądają bardziej naturalnie niż gładkie.",
      },
      NODRILL_FAQ,
      SIDE_FAQ,
      LEAD_FAQ,
      WARRANTY_FAQ,
    ],
    gallery: [
      [57, 0], [87, 0], [89, 0], [88, 0], [90, 0], [57, 4], [87, 4], [89, 6], [57, 8], [88, 1], [95, 0], [90, 3], [87, 6], [89, 8],
    ],
  },
  drewniane: {
    slug: "drewniane",
    name: "Żaluzje drewniane",
    short: "Drewniane",
    h1: "Żaluzje drewniane na wymiar",
    seoTitle: "Żaluzje drewniane na wymiar - basswood, abachi, prime wood | KEIKA",
    seoDescription:
      "Żaluzje drewniane na wymiar: lipa basswood, abachi i prime wood, lamele 25, 35, 50 i 65 mm, wersje z ozdobną taśmą. Ciepły, naturalny wygląd do salonu i sypialni. Realizacja do 15 dni roboczych.",
    lead: "Prawdziwe drewno: ciepłe w dotyku, z naturalnym rysunkiem słojów. Żaluzja, która wygląda jak mebel, a nie jak osłona.",
    description: [
      "Żaluzje drewniane robią z okna element wystroju. Lamele z lipy basswood są lekkie i mają równy rysunek, abachi ma wyraźniejszą strukturę i jest jeszcze lżejsze, a prime wood to selekcjonowane drewno w nowoczesnych, przygaszonych kolorach.",
      "Grubość lameli dobierasz do okna: 25 mm na skrzydło, 35 mm uniwersalnie, 50 i 65 mm na duże okna i montaż na ścianę. W wersji RETRO lamele trzyma ozdobna taśma zamiast sznurka - to najbardziej klasyczny, „hotelowy” wygląd.",
      "Drewno nie lubi stałej wilgoci, dlatego do łazienki i nad zlew polecamy żaluzje PCV drewnopodobne albo aluminiowe. Każdą żaluzję wykonujemy na Twój wymiar co do milimetra.",
    ],
    bullets: [
      { lead: "Naturalne drewno", detail: "basswood, abachi i prime wood" },
      { lead: "Lamele 25-65 mm", detail: "także wersje z ozdobną taśmą (RETRO)" },
      { lead: "Ciepły wygląd", detail: "salon, sypialnia, gabinet" },
      { lead: "Montaż na 3 sposoby", detail: "w świetle szyby, na skrzydło lub na ścianę" },
    ],
    rooms: ["Salon", "Sypialnia", "Gabinet", "Jadalnia"],
    faq: [
      MEASURE_FAQ,
      {
        question: "Czy żaluzje drewniane nadają się do łazienki?",
        answer:
          "Nie polecamy - stała wilgoć i para mogą odkształcić drewno. Do łazienki i kuchni wybierz żaluzje PCV drewnopodobne albo aluminiowe.",
      },
      {
        question: "Czym różni się basswood, abachi i prime wood?",
        answer:
          "Basswood (lipa) to klasyka - lekka, z równym rysunkiem słojów i największym wyborem kolorów. Abachi jest jeszcze lżejsze i ma wyraźniejszą strukturę. Prime wood to selekcjonowane drewno w nowoczesnych, przygaszonych odcieniach.",
      },
      {
        question: "Co to jest wersja RETRO?",
        answer:
          "W wersji RETRO lamele trzyma szeroka, ozdobna taśma zamiast cienkiego sznurka. Taśma zasłania otworki w lamelach, więc przy zamkniętej żaluzji jest ciemniej, a całość wygląda bardziej klasycznie.",
      },
      SIDE_FAQ,
      LEAD_FAQ,
      WARRANTY_FAQ,
    ],
    gallery: [
      [39, 0], [38, 0], [66, 0], [114, 0], [81, 0], [118, 0], [82, 0], [126, 0], [39, 3], [38, 4], [109, 0], [125, 0], [114, 4], [81, 4],
    ],
  },
  bambusowe: {
    slug: "bambusowe",
    name: "Żaluzje bambusowe",
    short: "Bambusowe",
    h1: "Żaluzje bambusowe na wymiar",
    seoTitle: "Żaluzje bambusowe na wymiar - lamele 25, 35, 50 i 65 mm | KEIKA",
    seoDescription:
      "Żaluzje bambusowe na wymiar: lamele 25, 35, 50 i 65 mm o naturalnym, nieregularnym rysunku, także z ozdobną taśmą (RETRO). Do wnętrz w stylu naturalnym i skandynawskim. Realizacja do 15 dni roboczych.",
    lead: "Lamele z prasowanego bambusa o naturalnym, nieregularnym rysunku. Lekkość i ciepło naturalnego materiału we wnętrzach w stylu boho, japandi i skandynawskim.",
    description: [
      "Bambus ma charakterystyczny, „żywy” rysunek z delikatnymi kolankami - każda lamela wygląda trochę inaczej, więc żaluzja nie jest płaska wizualnie jak tworzywo. To dobry wybór do salonu, sypialni i pokoju dziennego, gdzie liczy się naturalny klimat.",
      "Do wyboru lamele 25, 35, 50 i 65 mm w kolorach od bieli przez naturalny bambus po wenge i czerń. W wersji RETRO lamele trzyma ozdobna taśma zamiast sznurka.",
      "Każdą żaluzję wykonujemy na Twój wymiar co do milimetra - w świetle szyby, na skrzydło albo na ścianę nad oknem.",
    ],
    bullets: [
      { lead: "Naturalny bambus", detail: "każda lamela z własnym rysunkiem" },
      { lead: "Lamele 25-65 mm", detail: "także wersje z ozdobną taśmą (RETRO)" },
      { lead: "Styl naturalny", detail: "boho, japandi, skandynawski" },
      { lead: "Montaż na 3 sposoby", detail: "w świetle szyby, na skrzydło lub na ścianę" },
    ],
    rooms: ["Salon", "Sypialnia", "Pokój dzienny", "Gabinet"],
    faq: [
      MEASURE_FAQ,
      {
        question: "Czy żaluzje bambusowe nadają się do łazienki?",
        answer:
          "Bambus lepiej znosi wilgoć niż zwykłe drewno, ale stała para mu nie służy. Do łazienki i nad zlew polecamy żaluzje PCV drewnopodobne albo aluminiowe.",
      },
      {
        question: "Co to jest wersja RETRO?",
        answer: "W wersji RETRO lamele trzyma szeroka, ozdobna taśma zamiast sznurka - żaluzja wygląda klasycznie, a przy zamkniętych lamelach jest ciemniej.",
      },
      SIDE_FAQ,
      LEAD_FAQ,
      WARRANTY_FAQ,
    ],
    gallery: [
      [76, 0], [84, 0], [85, 0], [86, 0], [117, 0], [76, 3], [84, 3], [85, 3], [117, 8], [86, 1], [76, 6], [84, 7], [134, 0], [136, 0],
    ],
  },
};

const MEDIA = "https://crm-keika.groovemedia.pl/views/biuro/api/shop/media_public.php?path=";

export function zaluzjeRodzajPhotoUrl(pid: number, n: number): string {
  return `${MEDIA}ss_prod_${pid}_${n}_1200.jpg`;
}

export function zaluzjeRodzajGallery(slug: ZaluzjeRodzajSlug): string[] {
  return ZALUZJE_RODZAJE[slug].gallery.map(([pid, n]) => zaluzjeRodzajPhotoUrl(pid, n));
}

/** Rodzaj modelu po kategorii z opisu grupy w CRM. */
export function zaluzjeRodzajOfGroup(group: Pick<FabricGroup, "note" | "label">): ZaluzjeRodzajSlug | null {
  const category = roletyGroupCategory(group).toLowerCase();
  if (/pcv/.test(category)) return "pcv";
  if (/bambus/.test(category)) return "bambusowe";
  if (/aluminiow|drewnopodobne/.test(category)) return "aluminiowe";
  if (/drewnian|prime wood|basswood|abachi/.test(category)) return "drewniane";
  return null;
}

export function zaluzjeGroupVisible(group: FabricGroup): boolean {
  return !HIDDEN_GROUPS.has(group.id) && group.swatches.length > 0;
}

export function zaluzjeRodzajGroups(profile: RoletyProfile, slug: ZaluzjeRodzajSlug): FabricGroup[] {
  return profile.fabricGroups.filter((group) => zaluzjeGroupVisible(group) && zaluzjeRodzajOfGroup(group) === slug);
}

/** Nazwa wersji w ramach rodzaju i grubości: „Basswood”, „Abachi”, „RETRO - z taśmą”… */
export function zaluzjeVersionName(group: FabricGroup): { name: string; note: string } {
  const label = group.label.toUpperCase();
  const category = roletyGroupCategory(group).toLowerCase();
  const retro = /RETRO/.test(label);
  if (/pcv/.test(category)) {
    if (/CEDRO/.test(label)) return { name: "CEDRO", note: "Lamele ze strukturą słojów drewna, 3-4 kolory drewna." };
    return { name: "Gładkie", note: "Biele i kolory drewna, lamele gładkie lub z delikatną fakturą." };
  }
  if (/aluminiow/.test(category)) {
    if (retro) return { name: "RETRO z taśmą", note: "Lamele 50 mm na ozdobnej taśmie zamiast sznurka." };
    if (/SUNSET/.test(label)) return { name: "SUNSET", note: "Lamele 50 mm na sznurku albo na taśmie - do wyboru." };
    if (/ELEGANCE/.test(label)) return { name: "ELEGANCE", note: "Kolory perłowe i metaliczne: szampan, miedź, kość słoniowa." };
    if (/DESIGN/.test(label)) return { name: "DESIGN", note: "6 kolorów podstawowych: od bieli do czerni." };
    return { name: "Kolory gładkie i metaliczne", note: "Matowe, metaliczne i perforowane kolory lameli." };
  }
  if (/drewnopodobne/.test(category)) return { name: "Z nadrukiem drewna", note: "Lamele aluminiowe w kolorach drewna - klon, sosna, buk." };
  if (/bambus/.test(category)) {
    if (retro) return { name: "RETRO z taśmą", note: "Lamele na ozdobnej taśmie zamiast sznurka." };
    if (/LUX/.test(label)) return { name: "LUX", note: "Lamele bambusowe wyższej klasy, wyselekcjonowane." };
    return { name: "Klasyczne", note: "Lamele bambusowe na sznurku." };
  }
  // drewniane
  if (/abachi/.test(category)) return { name: "Abachi", note: "Drewno abachi - lżejsze, z wyraźniejszą strukturą." };
  if (/prime wood/.test(category)) return { name: "Prime wood", note: "Selekcjonowane drewno w przygaszonych, nowoczesnych kolorach." };
  if (retro) return { name: "Basswood RETRO z taśmą", note: "Lipa basswood na ozdobnej taśmie zamiast sznurka." };
  if (/SELECT/.test(label)) return { name: "Basswood SELECT", note: "Szlachetne kolory drewna: orzech amerykański, palisander, dąb antyczny." };
  if (/LUX/.test(label)) return { name: "Basswood LUX", note: "Lipa basswood wyższej klasy, do szerokości 240 cm." };
  if (/GLOSS/.test(label)) return { name: "Basswood GLOSS", note: "Lamele z połyskiem." };
  return { name: "Basswood", note: "Lipa basswood - klasyka, największy wybór kolorów." };
}

export type ZaluzjeRodzajWidth = { widthMm: number; groups: FabricGroup[]; colorCount: number };

/** Grubości lameli (warianty) rodzaju z modelami, rosnąco. */
export function zaluzjeRodzajWidths(profile: RoletyProfile, slug: ZaluzjeRodzajSlug): ZaluzjeRodzajWidth[] {
  const out: ZaluzjeRodzajWidth[] = [];
  for (const group of zaluzjeRodzajGroups(profile, slug)) {
    const widthMm = zaluzjeSlatWidthMm(group.label);
    let entry = out.find((item) => item.widthMm === widthMm);
    if (!entry) {
      entry = { widthMm, groups: [], colorCount: 0 };
      out.push(entry);
    }
    entry.groups.push(group);
    entry.colorCount += group.swatches.length;
  }
  return out.sort((a, b) => a.widthMm - b.widthMm);
}

export type ZaluzjeRodzajSummary = {
  slug: ZaluzjeRodzajSlug;
  copy: ZaluzjeRodzajCopy;
  widthsMm: number[];
  colorCount: number;
  modelCount: number;
  imageUrl: string;
  /** Najniższa cena w cenniku rodzaju - tylko do danych strukturalnych, nie na ekran. */
  lowPrice: number | null;
};

export function zaluzjeRodzajSummaries(profile: RoletyProfile | null): ZaluzjeRodzajSummary[] {
  return ZALUZJE_RODZAJ_SLUGS.map((slug) => {
    const copy = ZALUZJE_RODZAJE[slug];
    const widths = profile ? zaluzjeRodzajWidths(profile, slug) : [];
    let lowPrice: number | null = null;
    if (profile) {
      for (const width of widths) {
        for (const group of width.groups) {
          const price = roletyGroupStartingPrice(profile, group.id);
          if (price !== null && (lowPrice === null || price < lowPrice)) lowPrice = price;
        }
      }
    }
    const [pid, n] = copy.gallery[0];
    return {
      slug,
      copy,
      widthsMm: widths.map((width) => width.widthMm),
      colorCount: widths.reduce((sum, width) => sum + width.colorCount, 0),
      modelCount: widths.reduce((sum, width) => sum + width.groups.length, 0),
      imageUrl: zaluzjeRodzajPhotoUrl(pid, n),
      lowPrice,
    };
  });
}

/** FAQ strony zbiorczej /zaluzje (zastępuje stare wpisy z CRM, w których pomiar był sprzeczny z konfiguratorem). */
export const ZALUZJE_HUB_FAQ: Array<{ question: string; answer: string }> = [
  {
    question: "Które żaluzje do łazienki i kuchni?",
    answer: "Aluminiowe albo PCV drewnopodobne - nie chłoną wilgoci i można je myć na mokro. Drewniane i bambusowe polecamy do salonu, sypialni i gabinetu.",
  },
  MEASURE_FAQ,
  {
    question: "Jaką grubość lameli wybrać?",
    answer: "Na skrzydło okna najlepiej 16-25 mm - lamele najmniej odstają od szyby. 35 mm to wybór uniwersalny, a 50-65 mm wygląda najlepiej na dużych oknach i przy montażu na ścianę.",
  },
  NODRILL_FAQ,
  SIDE_FAQ,
  LEAD_FAQ,
  WARRANTY_FAQ,
];
