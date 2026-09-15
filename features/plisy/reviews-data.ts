// PLACEHOLDER reviews for the plisy landing.
//
// THESE ARE NOT REAL CUSTOMER REVIEWS. The owner asked for ~200 sample
// entries on 2026-09-16 to see the section laid out before the product has
// any reviews of its own ("na ten moment aby zobaczyć jak to wygląda, ja je
// pouzupełniam ... na moją odpowiedzialność, chodzi o dokończenie landingu").
//
// Because the shop is live, every entry generated here is rendered with a
// visible "Przykładowa opinia" badge and the section carries a banner saying
// the reviews are examples - a visitor must not be able to mistake them for
// verified purchases. Contrast app/moskitiery-ramkowe-reviews-data.ts, which
// is 100% real Allegro reviews and must stay that way.
//
// To replace with real ones: set PLISY_REVIEWS_ARE_PLACEHOLDERS to false and
// put the real entries in PLISY_REVIEWS (same shape). The badge and banner
// disappear with the flag; nothing else in the UI changes.
//
// The generator is deterministic (seeded), so the list is identical on the
// server and the client and does not change between builds.

export const PLISY_REVIEWS_ARE_PLACEHOLDERS = true;

export type PlisyReview = {
  date: string;
  maskedLogin: string;
  body: string;
  pros?: string;
  cons?: string;
  stars: 3 | 4 | 5;
  /** Which collection the sample talks about, so the filter can group them. */
  collection: "Klasyczne" | "Reflex" | "Podgumowane" | "DUO plaster miodu" | "DUO TERMO";
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

const COLLECTIONS: PlisyReview["collection"][] = ["Klasyczne", "Reflex", "Podgumowane", "DUO plaster miodu", "DUO TERMO"];

/** Sentence pools. Each sample is 2-3 sentences stitched from these, so
 * the 200 read as different people rather than one template. */
const OPENERS = [
  "Zamówiłam plisy do sypialni i kuchni.",
  "Pierwsze plisy w domu, wcześniej mieliśmy rolety.",
  "Kupiłem na trzy okna w salonie.",
  "Plisa na drzwi balkonowe, wymiar nietypowy.",
  "Zamawiałem na próbę jedną sztukę do pokoju dziecka.",
  "Wymieniliśmy stare żaluzje na plisy w całym mieszkaniu.",
  "Plisy do biura, sześć okien od południa.",
  "Zamówienie na poddasze, okna pionowe pod skosem.",
  "Kupiłam do kuchni, okno nad zlewem.",
  "Plisa do łazienki, małe okno 45 cm.",
  "Trzy sztuki do pokoju młodzieżowego.",
  "Zamawiałem do domku letniskowego.",
];

const BODY_BY_COLLECTION: Record<PlisyReview["collection"], string[]> = {
  Klasyczne: [
    "Tkanina ładnie rozprasza światło, w dzień nikt nie zagląda, a w pokoju jest jasno.",
    "Kolor zgodny ze zdjęciem w konfiguratorze, materiał gładki i sztywny.",
    "Przepuszcza tyle światła, ile trzeba, nie robi ciemno.",
    "Do salonu w sam raz — lekka, nie przytłacza okna.",
  ],
  Reflex: [
    "Na oknie od południa różnica w nagrzewaniu jest wyraźna, latem pokój jest chłodniejszy.",
    "Powłoka od strony szyby faktycznie odbija słońce, w upał czuć różnicę.",
    "Brałem właśnie przez tę powłokę refleksyjną i nie żałuję.",
    "Zachodnie okno przestało grzać jak piekarnik po południu.",
  ],
  Podgumowane: [
    "Zaciemnia bardzo dobrze, dziecko śpi w dzień bez problemu.",
    "Blackout robi robotę — w sypialni rano ciemno jak w nocy.",
    "Tkanina grubsza niż w klasycznych, dobrze trzyma fałdy.",
    "Do pokoju z telewizorem idealna, żadnych odblasków.",
  ],
  "DUO plaster miodu": [
    "Plaster miodu wygląda bardzo elegancko, bez dziurek po sznurkach.",
    "Zimą przy oknie jest wyraźnie cieplej, izolacja działa.",
    "Podwójna tkanina daje ładny, miękki efekt światła.",
    "Nie ma tych punkcików światła jak w zwykłych plisach.",
  ],
  "DUO TERMO": [
    "Pełne zaciemnienie i do tego termo — na poddaszu latem to konieczność.",
    "Sypialnia od słonecznej strony, wreszcie da się spać do dziewiątej.",
    "Najdroższa opcja, ale na poddaszu zwraca się w komforcie.",
    "Zaciemnia w stu procentach i trzyma ciepło zimą.",
  ],
};

const MECHANISM = [
  "Obie listwy chodzą płynnie, można zostawić plisę w środku okna.",
  "Sterowanie od dołu i od góry to coś, czego w roletach brakowało.",
  "Zatrzymuje się dokładnie tam, gdzie się ją puści.",
  "Uchwyty wygodne, listwa nie opada sama.",
  "Po dwóch miesiącach mechanizm dalej bez luzów.",
];

const MOUNT = [
  "Montaż bezinwazyjny na skrzydło, bez wiercenia, trzyma pewnie.",
  "Przykręcałem standardowo przy szybie, kwadrans na okno.",
  "Uchwyty na skrzydło PCV założyłam sama, bez pomocy.",
  "Montaż prosty, instrukcja wystarczyła.",
  "Wszystko w komplecie, wkręty też.",
];

const SERVICE = [
  "Dostawa po siedmiu dniach roboczych, kurier na drugi dzień.",
  "Wymiar co do milimetra, nic nie prześwituje po bokach.",
  "Konfigurator prosty, wycena od razu widoczna.",
  "Paczka dobrze zabezpieczona, listwy w osobnych kartonach.",
  "Kod rabatowy zadziałał w koszyku bez problemu.",
  "Odpowiedź na pytanie o wymiar przyszła tego samego dnia.",
];

const CLOSERS_5 = ["Polecam.", "Zdecydowanie polecam.", "Będę zamawiać kolejne.", "Warto.", "Jestem bardzo zadowolona.", "Pełna satysfakcja."];
const CLOSERS_4 = ["Polecam.", "Ogólnie dobrze.", "Jestem zadowolony.", "Spełnia oczekiwania."];
const CLOSERS_3 = ["Da radę.", "Poprawnie, bez fajerwerków.", "Spełnia swoją rolę."];

const CAVEATS_4 = [
  "Jedyny minus: czas realizacji mógłby być krótszy.",
  "Kolor minimalnie jaśniejszy niż na ekranie telefonu.",
  "Instrukcja montażu mogłaby mieć więcej zdjęć.",
  "Pudełko lekko wgniecione, plisa cała.",
];
const CAVEATS_3 = [
  "Czekałam dwa tygodnie, trochę długo.",
  "Odcień inny, niż się spodziewałam po zdjęciu.",
  "Górna listwa przy dużej szerokości lekko się ugina.",
  "Brakowało jednego wkrętu w komplecie, dosłali.",
];

const PROS = [
  "Płynne sterowanie, dopasowanie",
  "Jakość tkaniny, montaż bez wiercenia",
  "Zaciemnienie, wymiar na milimetr",
  "Wygląd, prosty montaż",
  "Izolacja, brak otworów w tkaninie",
  "Szybka wycena, dostawa",
  "Sztywna tkanina, listwy nie opadają",
];

function pick<T>(r: () => number, arr: readonly T[]): T {
  return arr[Math.floor(r() * arr.length)];
}

function buildReviews(count: number): PlisyReview[] {
  const r = rng(20260916);
  const out: PlisyReview[] = [];
  // Dates walk backwards from mid-September 2026 to early 2026.
  let dayCursor = new Date(2026, 8, 14).getTime();

  for (let i = 0; i < count; i++) {
    // Rating mix: ~62% five, ~30% four, ~8% three - a plausible spread for a
    // made-to-measure product, not a wall of fives.
    const roll = r();
    const stars: 3 | 4 | 5 = roll < 0.62 ? 5 : roll < 0.92 ? 4 : 3;
    const collection = pick(r, COLLECTIONS);

    const parts: string[] = [pick(r, OPENERS), pick(r, BODY_BY_COLLECTION[collection])];
    const extra = r();
    if (extra < 0.45) parts.push(pick(r, MECHANISM));
    else if (extra < 0.75) parts.push(pick(r, MOUNT));
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
      cons: withCons ? (stars === 4 ? "Czas realizacji" : "Odcień, czas realizacji") : withPros && stars === 5 ? "Brak" : undefined,
      stars,
      collection,
    });
  }
  return out;
}

export const PLISY_REVIEWS: PlisyReview[] = buildReviews(200);
