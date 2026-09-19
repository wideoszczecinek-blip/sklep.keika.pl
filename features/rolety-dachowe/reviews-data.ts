// PLACEHOLDER reviews for the rolety-dachowe landing (owner, 2026-09-19:
// "daj oceny analogicznie jak przy plisach").
//
// THESE ARE NOT REAL CUSTOMER REVIEWS. Same arrangement as
// features/plisy/reviews-data.ts: ~200 generated sample entries so the
// section can be judged and filled in by the owner ("ja je pouzupełniam ...
// na moją odpowiedzialność"). While RD_REVIEWS_ARE_PLACEHOLDERS is true the
// section carries a banner saying so - a visitor must never mistake them
// for verified purchases.
//
// RD_SHOW_PLACEHOLDER_REVIEWS: the product is still outside
// LIVE_PRODUCT_SLUGS (review only via /?produkt=rolety-dachowe), so the
// samples are visible for now. Flip it to false before go-live exactly as
// plisy did on its sales launch (a tab headed "Przykładowe opinie" on cold
// ad traffic reads as fake reviews) - the tab then shows the real Allegro
// rating of this roof blind + KEIKA's company reviews (Reviews.tsx).
//
// The generator is deterministic (seeded), so the list is identical on the
// server and the client and does not change between builds.

export const RD_REVIEWS_ARE_PLACEHOLDERS = true;
export const RD_SHOW_PLACEHOLDER_REVIEWS = false;

export type RdReview = {
  date: string;
  maskedLogin: string;
  body: string;
  pros?: string;
  cons?: string;
  stars: 3 | 4 | 5;
  /** Which fabric collection the sample talks about, so the filter can group them. */
  collection: "DEKO" | "TERMO";
};

/* ---- tiny seeded PRNG (mulberry32) so SSR and client agree ---- */
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

/** Real producers/models from the library, so the samples read like roof
 * windows people actually have. */
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
];

/** Sentence pools. Each sample is 2-3 sentences stitched from these, so
 * the 200 read as different people rather than one template. */
const OPENERS = [
  "Zamówiłam roletę do sypialni na poddaszu.",
  "Kupiłem na dwa okna dachowe w pokoju dziecka.",
  "Pierwsza roleta dachowa w domu, wcześniej wisiała zwykła zasłonka na haczykach.",
  "Roleta na okno w kuchni na poddaszu.",
  "Zamawiałem na próbę jedną sztukę do gabinetu.",
  "Wymieniliśmy stare roletki z marketu na trzech oknach.",
  "Cztery rolety na poddasze użytkowe, okna od południa.",
  "Roleta do łazienki na poddaszu, małe okno.",
  "Zamówienie na okna w sypialni i pokoju gościnnym.",
  "Kupiłam do pokoju nastolatka, okno pod skosem.",
  "Roleta do domku letniskowego, okno w salonie.",
  "Dwie sztuki do biura na poddaszu.",
];

const WINDOW_LINES = [
  "Mam okno {WINDOW}, było na liście i wymiar dobrał się sam.",
  "Wybrałem z biblioteki {WINDOW}, pasuje idealnie.",
  "Okno {WINDOW}, zdjęcie tabliczki rozpoznało model od razu.",
  "Roleta do {WINDOW} — dopasowana co do milimetra, nic nie musiałem mierzyć.",
  "Do okna {WINDOW} siadła jak fabryczna.",
];

const BODY_BY_COLLECTION: Record<RdReview["collection"], string[]> = {
  DEKO: [
    "Tkanina ładnie rozprasza światło, w pokoju jest jasno, ale słońce już nie razi.",
    "Kolor zgodny ze zdjęciem w konfiguratorze, materiał gładki i równo napięty.",
    "Do salonu w sam raz — nie zaciemnia, tylko tłumi ostre światło.",
    "Przepuszcza tyle światła, ile trzeba, w dzień nie trzeba włączać lampy.",
    "Delikatny odcień, ładnie wygląda na drewnianym oknie.",
  ],
  TERMO: [
    "Zaciemnia bardzo dobrze, dziecko śpi w dzień bez problemu.",
    "Latem na poddaszu jest wyraźnie chłodniej, srebrna warstwa faktycznie odbija słońce.",
    "Blackout robi robotę — w sypialni rano ciemno jak w nocy.",
    "Południowe okno przestało grzać pokój jak piekarnik.",
    "Od strony pokoju gładka, kolorowa tkanina, od szyby srebrna — dokładnie jak w opisie.",
  ],
};

const MECHANISM = [
  "Roleta zatrzymuje się dokładnie tam, gdzie ją puszczę, bez szukania haczyka.",
  "Prowadnice trzymają tkaninę przy szybie, nic nie odstaje na skosie.",
  "Sprężyna zwija równo, po miesiącu dalej bez luzów.",
  "Belka z hamulcem chodzi płynnie, można zostawić roletę w połowie.",
  "Przy uchylonym oknie tkanina nie łopocze, prowadnice robią różnicę.",
  "Uszczelka na dolnej belce domyka, przy dole prawie nie ma prześwitu.",
];

const MOUNT = [
  "Montaż do skrzydła zajął kwadrans, wkręty i instrukcja w komplecie.",
  "Przykręcałem sam, bez specjalnych narzędzi, film montażowy wystarczył.",
  "Kaseta i prowadnice aluminiowe, sztywne — nie plastik jak w poprzedniej.",
  "Kolor osprzętu jasna sosna pasuje do ramy okna jak fabryczny.",
  "Białe prowadnice na białym oknie prawie niewidoczne.",
  "Wszystko przyszło skręcone, tylko przykręcić do skrzydła.",
];

const SERVICE = [
  "Wysyłka po dwóch dniach, kurier na następny.",
  "Konfigurator prosty, model okna z listy, cena od razu widoczna.",
  "Zdjęcie tabliczki znamionowej rozpoznało model, nie musiałam nic mierzyć.",
  "Paczka dobrze zabezpieczona, kaseta w osobnym kartonie.",
  "Kod rabatowy zadziałał w koszyku bez problemu.",
  "Nie było mojego okna na liście, podałam wymiary — roleta pasuje.",
  "Odpowiedź na pytanie o model okna przyszła tego samego dnia.",
];

const CLOSERS_5 = ["Polecam.", "Zdecydowanie polecam.", "Będę zamawiać na kolejne okna.", "Warto.", "Jestem bardzo zadowolona.", "Pełna satysfakcja."];
const CLOSERS_4 = ["Polecam.", "Ogólnie dobrze.", "Jestem zadowolony.", "Spełnia oczekiwania."];
const CLOSERS_3 = ["Da radę.", "Poprawnie, bez fajerwerków.", "Spełnia swoją rolę."];

const CAVEATS_4 = [
  "Jedyny minus: kolor minimalnie jaśniejszy niż na ekranie telefonu.",
  "Instrukcja montażu mogłaby mieć więcej zdjęć.",
  "Pudełko lekko wgniecione, roleta cała.",
  "Uchwyt na belce mógłby być trochę większy.",
];
const CAVEATS_3 = [
  "Czekałam ponad tydzień, trochę długo.",
  "Odcień inny, niż się spodziewałam po zdjęciu.",
  "Przy dole zostaje kilka milimetrów prześwitu, choć w opisie było to napisane.",
  "Brakowało jednego wkrętu w komplecie, dosłali.",
];

const PROS = [
  "Dopasowanie do modelu okna, montaż",
  "Zaciemnienie, chłodniej latem",
  "Zatrzymanie w dowolnym miejscu",
  "Aluminiowa kaseta, sztywne prowadnice",
  "Wygląd, prosty montaż",
  "Szybka wycena, dostawa",
  "Rozpoznanie okna ze zdjęcia",
  "Napięta tkanina, brak prześwitów po bokach",
];

function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

function buildReviews(count: number): RdReview[] {
  const r = rng(20260919);
  const out: RdReview[] = [];
  // Dates walk backwards from mid-September 2026 to early 2026.
  let dayCursor = new Date(2026, 8, 15).getTime();

  for (let i = 0; i < count; i++) {
    // Rating mix: ~62% five, ~30% four, ~8% three - a plausible spread for a
    // made-to-measure product, not a wall of fives.
    const roll = r();
    const stars: 3 | 4 | 5 = roll < 0.62 ? 5 : roll < 0.92 ? 4 : 3;
    // TERMO sells more on attics - a 55/45 split.
    const collection: RdReview["collection"] = r() < 0.55 ? "TERMO" : "DEKO";

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

export const RD_REVIEWS: RdReview[] = buildReviews(200);
