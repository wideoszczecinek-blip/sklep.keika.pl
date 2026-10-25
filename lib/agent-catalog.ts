// Katalog produktów dla wyszukiwarek i agentów zakupowych AI (ChatGPT,
// Perplexity, Gemini / Google AI Mode, Copilot) - 25.10.2026, polecenie
// właściciela: „agenci AI od zakupów mają łatwo znaleźć nasze produkty”.
//
// Jedno źródło prawdy dla: danych strukturalnych schema.org na stronach
// produktów (lib/structured-data.ts), /llms.txt, plików produktowych
// /feeds/google-merchant.xml i /feeds/products.json oraz sitemap.xml.
// Same fakty, które klient widzi na stronach (landing-content.ts,
// shared.ts, koszyk) - nic tu nie jest wymyślone. Cena „od” = ta sama
// liczba, którą pokazuje sklep: cena bazowa z cennika × „Korekta ceny (%)”
// z CRM (Sklep WWW → Produkty), czytana na serwerze co godzinę.
//
// Marki okien (VELUX, FAKRO, ROTO) wyłącznie jako przeznaczenie („do okien
// dachowych VELUX, FAKRO, ROTO”), nigdy jako nazwa naszego produktu -
// wezwanie VELUX z 20.10.2026, patrz zasady właściciela.

import { PLISY_FAQ, PLISY_LEAD_TIME_LABEL, PLISY_STARTING_PRICE_FALLBACK } from "@/features/plisy/landing-content";
import { RD_FAQ, RD_STARTING_PRICE_FALLBACK } from "@/features/rolety-dachowe/landing-content";
import { PD_FAQ } from "@/features/plisy-dachowe/landing-content";
import {
  MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM,
  MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO,
  MOSKITIERY_RAMKOWE_PRICE_PER_MB_STANDARD,
  OVERSIZE_MAX_WIDTH_MM,
  OVERSIZE_TECHNICAL_LIMIT_MM,
} from "@/features/moskitiery-ramkowe/shared";
import {
  PLISY_HEIGHT_MAX_MM,
  PLISY_HEIGHT_MIN_MM,
  PLISY_WIDTH_MAX_MM,
  PLISY_WIDTH_MIN_MM,
} from "@/features/plisy/shared";

export const SHOP_URL = "https://sklep.keika.pl";
export const COMPANY_SITE_URL = "https://keika.pl";
const CRM_HOMEPAGE_PUBLIC = "https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public";

/** Te same liczby, które liczy koszyk (app/koszyk/page.tsx). */
export const SHOP_POLICY = {
  freeShippingThreshold: 79,
  shippingFee: 12.9,
  codSurcharge: 14.9,
  returnDays: 30,
  warrantyYears: 5,
  expressFee: 19.9,
  phone: "+48 790 215 251",
  email: "biuro@keika.pl",
  legalName: "KEIKA Renata Kisiel",
  vatId: "6731828521",
  street: "ul. Kościuszki 21",
  postalCode: "78-400",
  city: "Szczecinek",
  region: "zachodniopomorskie",
  showroomHours: "pon.–pt. 10:00–17:00",
  phoneHours: "codziennie 9:00–20:00",
  regulaminUrl: SHOP_URL + "/regulamin",
  contactUrl: SHOP_URL + "/kontakt",
} as const;

export type CatalogFaq = { question: string; answer: string };

export type CatalogProduct = {
  slug: string;
  /** Slugi „Korekty ceny (%)” w CRM - ta sama kolejność co w home-client. */
  adjustmentSlugs: string[];
  name: string;
  shortName: string;
  path: string;
  category: string;
  /** Google product taxonomy (pl-PL), ID + ścieżka. */
  googleCategoryId: number;
  googleCategory: string;
  productType: string;
  description: string;
  /** Dla kogo / jakie zapytania - podsumowanie dla agentów. */
  bestFor: string;
  image: string;
  extraImages: string[];
  basePrice: number;
  priceUnit?: string;
  /** Cena „od” - opis słowny, z jakiego wymiaru wynika. */
  priceNote: string;
  sizes: string;
  leadTime: string;
  handlingDays: [number, number];
  freeShippingAlways: boolean;
  mounting: string;
  measuring: string;
  options: string[];
  faq: CatalogFaq[];
  sku: string;
  mpn: string;
};

export type PricedCatalogProduct = CatalogProduct & {
  url: string;
  priceFrom: number;
  adjustmentPercent: number;
};

const MOSK_PER_MB = MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO || MOSKITIERY_RAMKOWE_PRICE_PER_MB_STANDARD;

const MOSKITIERY_FAQ: CatalogFaq[] = [
  {
    question: "Ile kosztuje moskitiera ramkowa na wymiar?",
    answer: `Cena zależy od obwodu ramki: ${pl(MOSK_PER_MB)} zł za każdy rozpoczęty metr bieżący obwodu (2 × szerokość + 2 × wysokość). Przykład: okno 100 × 120 cm to 4,4 m obwodu, czyli 5 mb = ${pl(MOSK_PER_MB * 5)} zł. Dokładną cenę pokazuje wycena online po wpisaniu wymiarów.`,
  },
  {
    question: "Jakie wymiary moskitier ramkowych wykonujecie?",
    answer: `Od ${MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM / 10} cm na każdym boku, do ${OVERSIZE_MAX_WIDTH_MM / 10} cm na dłuższym boku i ${OVERSIZE_TECHNICAL_LIMIT_MM / 10} cm na krótszym. Ramki powyżej 150 cm wysyłamy jako paczkę dłużycową z jednorazową dopłatą 19,90 zł (do 200 cm) albo 29 zł (do 250 cm) za całe zamówienie.`,
  },
  {
    question: "Czy montaż moskitiery uszkadza okno?",
    answer: "Nie - montaż jest bezinwazyjny: ramka zaczepiana jest za ramę okna uchwytami sprężynowymi, bez wiercenia w oknie. Moskitierę można w każdej chwili zdjąć i nie zostaje po niej ślad. Montaż odbywa się od wewnątrz, więc piętro nie ma znaczenia.",
  },
  {
    question: "Czy poradzę sobie ze złożeniem moskitiery?",
    answer: "Tak. Moskitiera przychodzi jako zestaw do samodzielnego złożenia: wszystkie elementy docięte na wymiar i opisane, z zapasem siatki i uszczelki. Złożenie ramki, naciągnięcie siatki i przykręcenie zaczepów zajmuje zwykle do 15 minut.",
  },
  {
    question: "Jak prawidłowo zmierzyć okno?",
    answer: "Zmierz szerokość i wysokość światła okna miarką zwijaną. Przy profilu skośnym lub zaokrąglonym dodaj 2–5 mm. Profil moskitiery ma płetwę, która zakrywa błąd pomiaru do kilku milimetrów.",
  },
  {
    question: "Czy moskitiera pasuje do każdego okna?",
    answer: "Do ponad 90 % okien plastikowych i drewnianych. Nie nadaje się do okien zlicowanych i półzlicowanych (skok zlicowania poniżej 7 mm). W razie wątpliwości wyślij nam zdjęcia okna - podpowiemy.",
  },
  {
    question: "Ile czeka się na moskitierę?",
    answer: `Termin wysyłki wyliczamy z planu produkcji i pokazujemy przed zakupem. Opcja Ekspres (+${pl(SHOP_POLICY.expressFee)} zł): zamówienie złożone do 12:00 w dzień roboczy wysyłamy tego samego dnia.`,
  },
  {
    question: "Jakie kolory ramki i siatki są dostępne?",
    answer: "7 kolorów profili aluminiowych: biały, antracyt, brąz, złoty dąb, orzech, winchester i mahoń. Siatka wzmocniona z włókna szklanego w kolorze szarym albo czarnym.",
  },
];

export const CATALOG: CatalogProduct[] = [
  {
    slug: "moskitiery-ramkowe",
    adjustmentSlugs: ["moskitiery-ramkowe"],
    name: "Moskitiera ramkowa na wymiar",
    shortName: "Moskitiery ramkowe",
    path: "/moskitiery-ramkowe",
    category: "Moskitiery okienne",
    googleCategoryId: 2154,
    googleCategory: "Dom i ogród > Akcesoria do drzwi i okien > Moskitiery okienne",
    productType: "Moskitiery > Moskitiery okienne > Moskitiery ramkowe na wymiar",
    description:
      "Moskitiera ramkowa na wymiar okna: aluminiowa rama, wzmocniona siatka z włókna szklanego (szara lub czarna), 7 kolorów profili, montaż na zaczepy sprężynowe bez wiercenia. Zestaw docięty na wymiar do samodzielnego złożenia (ok. 15 minut). Pasuje do ponad 90 % okien PCV i drewnianych (nie do okien zlicowanych). Wycena online w 30 sekund, 5 lat gwarancji, 30 dni na zwrot.",
    bestFor: "moskitiera na okno na wymiar, moskitiera ramkowa bez wiercenia, moskitiera aluminiowa do okna PCV lub drewnianego",
    image: "https://crm-keika.groovemedia.pl/storage/shop/media/moskitiery-ramkowe-galeria/moskitiera-okienna-allegro-miniaturka.jpg",
    extraImages: [],
    basePrice: MOSK_PER_MB,
    priceUnit: "za metr bieżący obwodu ramki",
    priceNote: `${pl(MOSK_PER_MB)} zł za każdy rozpoczęty metr bieżący obwodu ramki (najmniejsza ramka = 1 mb)`,
    sizes: `od ${MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM / 10} × ${MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM / 10} cm do ${OVERSIZE_MAX_WIDTH_MM / 10} × ${OVERSIZE_TECHNICAL_LIMIT_MM / 10} cm`,
    leadTime: "termin wysyłki z planu produkcji pokazywany przed zakupem; Ekspres: zamówienie do 12:00 wysyłane tego samego dnia roboczego",
    handlingDays: [0, 3],
    freeShippingAlways: false,
    mounting: "na zaczepy sprężynowe, bez wiercenia",
    measuring: "szerokość i wysokość światła okna (przy profilu skośnym +2–5 mm), wycena online z instrukcją pomiaru",
    options: ["7 kolorów profili: biały, antracyt, brąz, złoty dąb, orzech, winchester, mahoń", "siatka wzmocniona szara lub czarna", "opcja Ekspres"],
    faq: MOSKITIERY_FAQ,
    sku: "moskitiera-ramkowa-na-wymiar",
    mpn: "KEIKA-MR",
  },
  {
    slug: "plisy",
    adjustmentSlugs: ["plisy"],
    name: "Plisa okienna na wymiar",
    shortName: "Plisy okienne",
    path: "/plisy",
    category: "Plisy okienne",
    googleCategoryId: 2885,
    googleCategory: "Dom i ogród > Dekoracje > Dekoracje okienne > Rolety i żaluzje",
    productType: "Osłony wewnętrzne > Plisy > Plisy okienne na wymiar",
    description:
      "Plisa okienna na wymiar od producenta: regulacja z góry i z dołu, montaż bez wiercenia (bezinwazyjny) lub przykręcany do listwy, około 150 tkanin w 5 kolekcjach - od przepuszczających światło po zaciemniające DUO TERMO. Darmowa dostawa od 1 sztuki, 5 lat gwarancji, 30 dni na zwrot.",
    bestFor: "plisy na wymiar bez wiercenia, plisa zaciemniająca do sypialni, plisa do okna PCV, plisa dzień-noc (góra-dół)",
    image: SHOP_URL + "/plisy/produkt-01.jpg",
    extraImages: [SHOP_URL + "/plisy/detal-01.jpg"],
    basePrice: PLISY_STARTING_PRICE_FALLBACK,
    priceNote: "najmniejsza plisa 40 × 60 cm w kolekcji Klasyczne",
    sizes: `szerokość ${PLISY_WIDTH_MIN_MM / 10}–${PLISY_WIDTH_MAX_MM / 10} cm, wysokość ${PLISY_HEIGHT_MIN_MM / 10}–${PLISY_HEIGHT_MAX_MM / 10} cm`,
    leadTime: `produkcja ${PLISY_LEAD_TIME_LABEL}`,
    handlingDays: [5, 10],
    freeShippingAlways: true,
    mounting: "bez wiercenia (bezinwazyjny, na listwę przyszybową) albo przykręcany do listwy",
    measuring: "szerokość i wysokość szyby z listwami (montaż bez wiercenia) albo od uszczelki do uszczelki (przykręcany); instrukcja: " + SHOP_URL + "/plisy/jak-mierzyc",
    options: ["5 kolekcji tkanin, ok. 150 kolorów", "10 kolorów profili", "montaż bez wiercenia lub przykręcany"],
    faq: PLISY_FAQ,
    sku: "plisa-okienna-na-wymiar",
    mpn: "KEIKA-PL",
  },
  {
    slug: "rolety-dachowe",
    adjustmentSlugs: ["rolety-dachowe", "roleta-dachowa-dekolux"],
    name: "Roleta do okna dachowego na wymiar",
    shortName: "Rolety do okien dachowych",
    path: "/rolety-dachowe",
    category: "Rolety do okien dachowych",
    googleCategoryId: 2885,
    googleCategory: "Dom i ogród > Dekoracje > Dekoracje okienne > Rolety i żaluzje",
    productType: "Osłony wewnętrzne > Rolety > Rolety do okien dachowych",
    description:
      "Roleta do okna dachowego w aluminiowej kasecie z bocznymi prowadnicami, mechanizmem sprężynowym i hamulcem (zatrzymanie w dowolnym miejscu). Dopasowana do modelu okna - biblioteka ponad 420 modeli okien dachowych VELUX, FAKRO, ROTO, OKPOL, Dakstra i innych, rozpoznawanie modelu ze zdjęcia tabliczki. 73 tkaniny: DEKO (rozpraszające) i TERMO (blackout z warstwą termiczną). 5 lat gwarancji, 30 dni na zwrot.",
    bestFor: "roleta do okna dachowego VELUX, FAKRO lub ROTO dobrana po modelu okna, roleta zaciemniająca na poddasze, roleta termiczna do okna połaciowego",
    image: SHOP_URL + "/rolety-dachowe/produkt-01.jpg",
    extraImages: [SHOP_URL + "/rolety-dachowe/produkt-02.jpg", SHOP_URL + "/rolety-dachowe/aranzacja-termo.jpg"],
    basePrice: RD_STARTING_PRICE_FALLBACK,
    priceNote: "najmniejsza roleta w tkaninie DEKO",
    sizes: "dobierana do modelu okna dachowego (ponad 420 modeli) albo na wymiar okna spoza listy",
    leadTime: "zwykle wysyłka w ciągu 2 dni roboczych; aktualny termin pokazujemy nad konfiguratorem",
    handlingDays: [1, 2],
    freeShippingAlways: false,
    mounting: "do skrzydła okna dachowego wkrętami z kompletu, bez specjalistycznych narzędzi",
    measuring: "bez mierzenia - wybór modelu okna z biblioteki lub zdjęcie tabliczki znamionowej; dla okien spoza listy dwa wymiary A i B",
    options: ["tkaniny DEKO (54 kolory) i TERMO blackout (19 kolorów)", "osprzęt: biały, anoda (szary), jasna sosna"],
    faq: RD_FAQ,
    sku: "roleta-do-okna-dachowego-na-wymiar",
    mpn: "KEIKA-RD",
  },
  {
    slug: "plisy-dachowe",
    adjustmentSlugs: ["plisy-dachowe"],
    name: "Plisa do okna dachowego na wymiar",
    shortName: "Plisy do okien dachowych",
    path: "/plisy-dachowe",
    category: "Plisy do okien dachowych",
    googleCategoryId: 2885,
    googleCategory: "Dom i ogród > Dekoracje > Dekoracje okienne > Rolety i żaluzje",
    productType: "Osłony wewnętrzne > Plisy > Plisy do okien dachowych",
    description:
      "Plisa do okna dachowego z aluminiowymi prowadnicami bocznymi - tkanina zostaje w płaszczyźnie okna przy każdym nachyleniu, obie belki ustawisz w dowolnym miejscu. Dopasowana do modelu okna - biblioteka ponad 420 modeli okien dachowych VELUX, FAKRO, ROTO, OKPOL, Dakstra i innych. Te same ok. 150 tkanin co w plisach okiennych, osprzęt biały, anoda lub sosna. 5 lat gwarancji, 30 dni na zwrot.",
    bestFor: "plisa do okna dachowego VELUX, FAKRO lub ROTO dobrana po modelu okna, plisa zaciemniająca na poddasze, plisa z prowadnicami",
    image: SHOP_URL + "/plisy-dachowe/produkt-01.jpg",
    extraImages: [SHOP_URL + "/plisy-dachowe/produkt-02.jpg", SHOP_URL + "/plisy-dachowe/aranzacja-01.jpg"],
    basePrice: Math.round(PLISY_STARTING_PRICE_FALLBACK * 1.25 * 100) / 100,
    priceNote: "najmniejsza plisa w kolekcji Klasyczne",
    sizes: "dobierana do modelu okna dachowego (ponad 420 modeli) albo na wymiar okna spoza listy",
    leadTime: "zwykle kilka dni roboczych; aktualny termin pokazujemy nad konfiguratorem",
    handlingDays: [2, 10],
    freeShippingAlways: false,
    mounting: "prowadnice przykręcane do skrzydła okna (wkrętarka lub śrubokręt PZ1), ok. 10–15 minut",
    measuring: "bez mierzenia - wybór modelu okna z biblioteki lub zdjęcie tabliczki znamionowej; dla okien spoza listy szerokość i wysokość od rantu do rantu listwy przyszybowej",
    options: ["5 kolekcji tkanin, ok. 150 kolorów", "osprzęt: biały, anoda, sosna"],
    faq: PD_FAQ,
    sku: "plisa-do-okna-dachowego-na-wymiar",
    mpn: "KEIKA-PD",
  },
];

function pl(value: number): string {
  return value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPricePl(value: number): string {
  return pl(value);
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** „Korekta ceny (%)” z CRM per slug. Pusta mapa, gdy CRM nie odpowiada -
 * wtedy cena bazowa (taka sama, jaką sklep pokazuje do wczytania cennika). */
export async function fetchPriceAdjustments(): Promise<Record<string, number>> {
  try {
    const response = await fetch(CRM_HOMEPAGE_PUBLIC, { next: { revalidate: 3600 }, signal: AbortSignal.timeout(8000) });
    if (!response.ok) return {};
    const json = (await response.json()) as { config?: unknown };
    const config = (json?.config ?? json) as { product_groups?: Array<{ products?: Array<{ slug?: string; price_adjustment_percent?: unknown }> }> };
    const out: Record<string, number> = {};
    for (const group of Array.isArray(config?.product_groups) ? config.product_groups : []) {
      for (const product of Array.isArray(group?.products) ? group.products : []) {
        const slug = String(product?.slug || "").trim();
        const percent = Number(String(product?.price_adjustment_percent ?? "").replace(",", "."));
        if (slug && Number.isFinite(percent) && percent !== 0) out[slug] = Math.max(-95, Math.min(500, percent));
      }
    }
    return out;
  } catch {
    return {};
  }
}

function priceProduct(product: CatalogProduct, adjustments: Record<string, number>): PricedCatalogProduct {
  // Jak home-client: pierwsza niezerowa korekta z listy slugów.
  const adjustmentPercent = product.adjustmentSlugs.map((slug) => adjustments[slug] || 0).find((value) => value !== 0) || 0;
  const priceFrom = adjustmentPercent ? roundMoney(Math.max(0, product.basePrice * (1 + adjustmentPercent / 100))) : product.basePrice;
  return { ...product, url: SHOP_URL + product.path, priceFrom, adjustmentPercent };
}

export async function getPricedCatalog(): Promise<PricedCatalogProduct[]> {
  const adjustments = await fetchPriceAdjustments();
  return CATALOG.map((product) => priceProduct(product, adjustments));
}

export async function getPricedProduct(slug: string): Promise<PricedCatalogProduct> {
  const product = CATALOG.find((entry) => entry.slug === slug);
  if (!product) throw new Error("Unknown catalog product: " + slug);
  return priceProduct(product, await fetchPriceAdjustments());
}

/** FAQ z landingów ma znacznik {{cena_od}} - podstawiamy realną cenę. */
export function resolveFaq(product: PricedCatalogProduct): CatalogFaq[] {
  const price = pl(product.priceFrom) + " zł";
  return product.faq.map((entry) => ({ question: entry.question, answer: entry.answer.replace(/\{\{\s*cena_od\s*\}\}/g, price) }));
}

export function shippingFor(product: PricedCatalogProduct): number {
  if (product.freeShippingAlways || product.priceFrom >= SHOP_POLICY.freeShippingThreshold) return 0;
  return SHOP_POLICY.shippingFee;
}
