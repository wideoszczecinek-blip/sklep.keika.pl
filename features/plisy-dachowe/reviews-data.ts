// PLACEHOLDER reviews for the plisy-dachowe landing (2026-09-19), the same
// arrangement as rolety dachowe and plisy ("daj oceny analogicznie").
//
// THESE ARE NOT REAL CUSTOMER REVIEWS. ~200 generated sample entries so the
// section can be judged and filled in by the owner. While
// PD_REVIEWS_ARE_PLACEHOLDERS is true the section carries a banner saying
// so - a visitor must never mistake them for verified purchases.
//
// PD_SHOW_PLACEHOLDER_REVIEWS: the product is outside LIVE_PRODUCT_SLUGS
// (review only via /?produkt=plisy-dachowe), so the samples are visible for
// now. Flip it to false before go-live exactly as plisy did - the tab then
// shows KEIKA's company reviews (Reviews.tsx).
//
// The generator is deterministic (seeded), identical on server and client.

export const PD_REVIEWS_ARE_PLACEHOLDERS = true;
export const PD_SHOW_PLACEHOLDER_REVIEWS = true;

export type PdReviewCollection = "Klasyczne" | "Reflex" | "Blackout" | "DUO" | "DUO TERMO";

export type PdReview = {
  date: string;
  maskedLogin: string;
  body: string;
  pros?: string;
  cons?: string;
  stars: 3 | 4 | 5;
  collection: PdReviewCollection;
};

export const PD_REVIEW_COLLECTIONS: PdReviewCollection[] = ["Klasyczne", "Reflex", "Blackout", "DUO", "DUO TERMO"];

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const MONTHS = ["stycznia", "lutego", "marca", "kwietnia", "maja", "czerwca", "lipca", "sierpnia", "września", "października", "listopada", "grudnia"];
const LOGIN_LETTERS = "abcdefghijklmnoprstuwz";

const WINDOWS = [
  "Velux GGL MK04",
  "Velux GGU MK06",
  "Velux GZL PK08",
  "Velux 308 (M08)",
  "Fakro FTP-V U3 78x118",
  "Fakro FTS U2 78x140",
  "Fakro PTP 94x118",
  "Roto R79 K 74x118",
  "Roto R45 65x118",
  "OKPOL ISO I22 78x140",
  "OKPOL PVC 66x118",
  "Dakstra M8A",
  "Optilight 78x118",
  "RoofLITE+ 78x98",
];

const OPENERS = [
  "Zamówiłam plisę do sypialni na poddaszu.",
  "Kupiłem na dwa okna dachowe w pokoju dziecka.",
  "Pierwsza plisa z prowadnicami w domu, wcześniej była zwykła roletka na haczykach.",
  "Plisa do okna w kuchni na poddaszu.",
  "Zamawiałem na próbę jedną sztukę do gabinetu.",
  "Wymieniliśmy stare roletki z marketu na trzech oknach dachowych.",
  "Cztery plisy na poddasze użytkowe, okna od południa.",
  "Plisa do łazienki na poddaszu, małe okno.",
  "Zamówienie na okna w sypialni i pokoju gościnnym.",
  "Kupiłam do pokoju nastolatka, okno pod skosem.",
  "Plisa do domku letniskowego, okno w salonie.",
  "Dwie sztuki do biura na poddaszu.",
];

const WINDOW_LINES = [
  "Mam okno {WINDOW}, było na liście i wymiar dobrał się sam.",
  "Wybrałem z biblioteki {WINDOW}, pasuje idealnie.",
  "Okno {WINDOW}, zdjęcie tabliczki rozpoznało model od razu.",
  "Plisa do {WINDOW} — dopasowana co do milimetra, nic nie musiałem mierzyć.",
  "Do okna {WINDOW} siadła jak fabryczna.",
];

const BODY_BY_COLLECTION: Record<PdReviewCollection, string[]> = {
  Klasyczne: [
    "Tkanina ładnie rozprasza światło, w pokoju jest jasno, ale słońce już nie razi.",
    "Kolor zgodny ze zdjęciem w konfiguratorze, plisa równo napięta między belkami.",
    "Do salonu w sam raz — nie zaciemnia, tylko tłumi ostre światło.",
    "Delikatny odcień, ładnie wygląda na sosnowym oknie.",
  ],
  Reflex: [
    "Srebrna powłoka od strony szyby faktycznie odbija słońce, na poddaszu jest chłodniej.",
    "Południowe okno przestało grzać pokój jak piekarnik, a światła nadal jest dużo.",
    "Od pokoju zwykła jasna tkanina, od szyby lustrzana — dokładnie jak w opisie.",
  ],
  Blackout: [
    "Zaciemnia bardzo dobrze, dziecko śpi w dzień bez problemu.",
    "Podgumowana tkanina nie przepuszcza światła, rano w sypialni ciemno.",
    "Blackout robi robotę, prowadnice zamykają boki — prześwit tylko przy belkach.",
  ],
  DUO: [
    "Plaster miodu wygląda elegancko, bez sznurków przez tkaninę, żadnych punkcików światła.",
    "Miękkie, rozproszone światło, w jadalni bardzo przyjemnie.",
    "Tkanina podwójna, sztywniejsza niż zwykła, równo chodzi w prowadnicach.",
  ],
  "DUO TERMO": [
    "Latem na poddaszu jest wyraźnie chłodniej, a rano ciemno jak w nocy.",
    "Plaster miodu z powłoką termiczną — najlepsza rzecz, jaką kupiliśmy na poddasze.",
    "Zimą mniej ciągnie od okna, latem nie grzeje. Zaciemnia całkowicie.",
  ],
};

const MECHANISM = [
  "Obie belki zatrzymują się dokładnie tam, gdzie je puszczę.",
  "Prowadnice trzymają tkaninę przy szybie, nic nie odstaje na skosie.",
  "Przy uchylonym oknie plisa nie wybrzusza się, prowadnice robią różnicę.",
  "Można zasłonić tylko dół albo tylko górę okna — bardzo wygodne.",
  "Po dwóch miesiącach naciąg dalej równy, sznurki bez luzów.",
];

const MOUNT = [
  "Montaż do skrzydła zajął kwadrans, wkręty i instrukcja w komplecie.",
  "Przykręcałem sam śrubokrętem PZ1, obrazkowa instrukcja wystarczyła.",
  "Prowadnice aluminiowe, sztywne — nie plastik jak w poprzedniej roletce.",
  "Kolor osprzętu sosna pasuje do ramy okna jak fabryczny.",
  "Białe prowadnice na białym oknie prawie niewidoczne.",
  "Anoda na szarym oknie wygląda jak jeden komplet.",
];

const SERVICE = [
  "Wysyłka po kilku dniach, kurier na następny.",
  "Konfigurator prosty, model okna z listy, cena od razu widoczna.",
  "Zdjęcie tabliczki znamionowej rozpoznało model, nie musiałam nic mierzyć.",
  "Paczka dobrze zabezpieczona, prowadnice w osobnej tubie.",
  "Kod rabatowy zadziałał w koszyku bez problemu.",
  "Nie było mojego okna na liście, podałam wymiary — plisa pasuje.",
  "Odpowiedź na pytanie o model okna przyszła tego samego dnia.",
];

const CLOSERS_5 = ["Polecam.", "Zdecydowanie polecam.", "Będę zamawiać na kolejne okna.", "Warto.", "Jestem bardzo zadowolona.", "Pełna satysfakcja."];
const CLOSERS_4 = ["Polecam.", "Ogólnie dobrze.", "Jestem zadowolony.", "Spełnia oczekiwania."];
const CLOSERS_3 = ["Da radę.", "Poprawnie, bez fajerwerków.", "Spełnia swoją rolę."];

const CAVEATS_4 = [
  "Jedyny minus: kolor minimalnie jaśniejszy niż na ekranie telefonu.",
  "Instrukcja montażu mogłaby mieć więcej zdjęć.",
  "Pudełko lekko wgniecione, plisa cała.",
  "Uchwyt na belce mógłby być trochę większy.",
];
const CAVEATS_3 = [
  "Czekałam ponad tydzień, trochę długo.",
  "Odcień inny, niż się spodziewałam po zdjęciu.",
  "Przy belkach zostaje kilka milimetrów prześwitu, choć w opisie było to napisane.",
  "Brakowało jednego wkrętu w komplecie, dosłali.",
];

const PROS = [
  "Dopasowanie do modelu okna, montaż",
  "Zaciemnienie, chłodniej latem",
  "Zasłonięcie dowolnej części okna",
  "Aluminiowe prowadnice, sztywne belki",
  "Wygląd, prosty montaż",
  "Szybka wycena, dostawa",
  "Rozpoznanie okna ze zdjęcia",
  "Napięta tkanina, brak prześwitów po bokach",
];

function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

function buildReviews(count: number): PdReview[] {
  const r = rng(20260919);
  const out: PdReview[] = [];
  let dayCursor = new Date(2026, 8, 16).getTime();

  for (let i = 0; i < count; i++) {
    const roll = r();
    const stars: 3 | 4 | 5 = roll < 0.62 ? 5 : roll < 0.92 ? 4 : 3;
    // Blackout and DUO TERMO sell most on attics.
    const c = r();
    const collection: PdReviewCollection = c < 0.2 ? "Klasyczne" : c < 0.35 ? "Reflex" : c < 0.62 ? "Blackout" : c < 0.74 ? "DUO" : "DUO TERMO";

    const parts: string[] = [pick(r, OPENERS)];
    if (r() < 0.6) parts.push(pick(r, WINDOW_LINES).replace("{WINDOW}", pick(r, WINDOWS)));
    parts.push(pick(r, BODY_BY_COLLECTION[collection]));
    const extra = r();
    if (extra < 0.4) parts.push(pick(r, MECHANISM));
    else if (extra < 0.72) parts.push(pick(r, MOUNT));
    else parts.push(pick(r, SERVICE));
    if (stars === 4) parts.push(pick(r, CAVEATS_4));
    if (stars === 3) parts.push(pick(r, CAVEATS_3));
    parts.push(stars === 5 ? pick(r, CLOSERS_5) : stars === 4 ? pick(r, CLOSERS_4) : pick(r, CLOSERS_3));

    dayCursor -= (1 + Math.floor(r() * 2)) * 86400000;
    const d = new Date(dayCursor);
    const date = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;

    const first = LOGIN_LETTERS[Math.floor(r() * LOGIN_LETTERS.length)];
    const last = Math.floor(r() * 10);
    const maskedLogin = `${first}...${last}`;

    const withPros = r() < 0.55;
    const withCons = stars < 5 && r() < 0.5;

    out.push({
      date,
      maskedLogin,
      body: parts.join(" "),
      pros: withPros ? pick(r, PROS) : undefined,
      cons: withCons ? (stars === 4 ? "Odcień na ekranie" : "Odcień, czas realizacji") : withPros && stars === 5 ? "Brak" : undefined,
      stars,
      collection,
    });
  }
  return out;
}

export const PD_REVIEWS: PdReview[] = buildReviews(200);
