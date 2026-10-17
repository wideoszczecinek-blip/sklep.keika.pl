// Rolety mini na wymiar (dzień-noc i tradycyjne Deko/Termo) oraz żaluzje
// poziome - dane i czyste funkcje wspólne dla konfiguratora, strony produktu
// i koszyka. Jedna implementacja sparametryzowana slugiem: wszystkie trzy
// produkty mają w CRM ten sam układ kroków (montaż / [kolor mechanizmu] /
// tkanina lub model / wymiary) i ten sam tryb cennika (matryca szerokość ×
// wysokość per grupa), różnią się treścią i kilkoma regułami zebranymi w
// ROLETY_COPY. Profil pobieramy na żywo z tego samego publicznego endpointu,
// do którego pisze panel CRM (jak plisy, features/plisy/shared.ts), z pamięcią
// podręczną 5 min, żeby zmiany właściciela w CRM pojawiały się bez wdrożenia,
// a jedno wejście na stronę nie ciągnęło katalogu kilka razy.
import {
  applyPriceDeltas,
  resolvePriceBreakpointIndex,
  type FabricGroup,
  type FabricSwatch,
  type HardwareOption,
  type MountOption,
  type PriceDeltaType,
  type PriceTable,
} from "@/features/plisy/shared";

export type { FabricGroup, FabricSwatch, HardwareOption, MountOption, PriceTable };

const CONFIGURATOR_PUBLIC_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop/configurator_public.php";

export type RoletySlug = "rolety-dzien-noc" | "rolety-tradycyjne" | "zaluzje";

export const ROLETY_SLUGS: RoletySlug[] = ["rolety-dzien-noc", "rolety-tradycyjne", "zaluzje"];

export function isRoletySlug(slug: string | null | undefined): slug is RoletySlug {
  return slug === "rolety-dzien-noc" || slug === "rolety-tradycyjne" || slug === "zaluzje";
}

export const ROLETY_QTY_MAX = 50;

export type ChainSide = "lewa" | "prawa";
export const CHAIN_SIDES: Array<{ id: ChainSide; label: string }> = [
  { id: "lewa", label: "Lewa" },
  { id: "prawa", label: "Prawa" },
];

/** Treść i reguły zależne od produktu, których nie ma w CRM: nagłówki stron,
 * meta, cena "od" do pierwszego renderu, zakres produkcji, termin, paczkomat,
 * nazwy kroków. Opisy, sekcje, parametry i FAQ przychodzą z CRM. */
export type RoletyProductCopy = {
  slug: RoletySlug;
  path: string;
  /** Biernik do nagłówka konfiguratora ("Wyceń roletę ..."). */
  shortName: string;
  h1: string;
  seoTitle: string;
  seoDescription: string;
  /** Najniższa komórka cennika - pokazywana, zanim profil się wczyta. */
  startingPriceFallback: number;
  sku: string;
  category: string;
  /** Zdjęcie do metadanych i JSON-LD (gallery_urls[0] w CRM). */
  seoImage: string;
  ctaLabel: string;
  similarLabel: string;
  newLabel: string;
  widthMinMm: number;
  widthMaxMm: number;
  heightMinMm: number;
  heightMaxMm: number;
  widthDefaultMm: number;
  heightDefaultMm: number;
  leadTimeDays: number;
  leadTimeLabel: string;
  /** null = paczkomat niedostępny (tylko kurier). */
  paczkomatMaxWidthMm: number | null;
  /** Krok 4: "Wybierz kolekcję tkaniny" / "Wybierz model żaluzji". */
  groupStepTitle: string;
  colorStepTitle: string;
  groupUnit: "kolekcja" | "model";
  /** Kafelek grupy ze zdjęciem produktu (żaluzje) zamiast tła z próbek. */
  groupCardPhoto: boolean;
  /** Krok sterowania: tytuł, podpowiedź, słowo w etykiecie koszyka. */
  controlStepTitle: string;
  controlStepHint: string;
  controlLabelWord: string;
  /** Komunikat, gdy komórka cennika = 0 (wymiar poza modelem). */
  unavailableMessage: string;
  instructionSteps: Array<{ title: string; body: string }>;
};

const ROLETY_MEASURE_STEP = {
  title: "Pomiar",
  body: "Montaż na skrzydle i wkręcany: zmierz szerokość i wysokość szyby między uszczelkami i dodaj po 15 mm z każdej strony. Kaseta z prowadnicami: podaj dokładny wymiar szyby. Wpisz wynik w konfiguratorze w milimetrach albo centymetrach.",
};
const ROLETY_MOUNT_STEPS = [
  {
    title: "Montaż bez wiercenia",
    body: "Wieszaki zakładasz na górną krawędź skrzydła okna PCV i dociskasz. Roleta wisi tuż przy szybie, bez śladów na ramie. Demontaż zajmuje chwilę.",
  },
  {
    title: "Montaż wkręcany i kaseta",
    body: "Uchwyty wkręcane mocujesz dwoma wkrętami do ramy okna, ściany lub sufitu. Kasetę z prowadnicami przyklejasz lub przykręcasz do skrzydła. Wkręty i taśma są w komplecie.",
  },
];

const ROLETY_BASE = {
  widthMinMm: 300,
  widthMaxMm: 1500,
  heightMinMm: 300,
  heightMaxMm: 2200,
  widthDefaultMm: 600,
  heightDefaultMm: 1500,
  leadTimeDays: 10,
  leadTimeLabel: "do 10 dni roboczych",
  paczkomatMaxWidthMm: 600,
  groupStepTitle: "Wybierz kolekcję tkaniny",
  colorStepTitle: "Wybierz kolor tkaniny",
  groupUnit: "kolekcja" as const,
  groupCardPhoto: false,
  controlStepTitle: "Strona łańcuszka",
  controlStepHint: "Po której stronie ma być łańcuszek, patrząc na okno od środka pokoju.",
  controlLabelWord: "łańcuszek",
  unavailableMessage: "Ta kolekcja nie jest dostępna w tym wymiarze - wybierz inną kolekcję lub mniejszy wymiar.",
  ctaLabel: "Wyceń swoją roletę",
  similarLabel: "Wyceń podobną roletę",
  newLabel: "Wyceń nową roletę",
  instructionSteps: [ROLETY_MEASURE_STEP, ...ROLETY_MOUNT_STEPS],
};

export const ROLETY_COPY: Record<RoletySlug, RoletyProductCopy> = {
  "rolety-dzien-noc": {
    ...ROLETY_BASE,
    slug: "rolety-dzien-noc",
    path: "/rolety-dzien-noc",
    shortName: "roletę dzień-noc",
    h1: "Rolety dzień-noc mini na wymiar",
    seoTitle: "Rolety dzień-noc mini na wymiar - tkaniny Bahama w 3 kolekcjach | KEIKA",
    seoDescription:
      "Roleta dzień-noc mini szyta na wymiar: tkaniny Bahama w 3 kolekcjach, montaż na skrzydle bez wiercenia, wkręcany lub w kasecie z prowadnicami, 5 kolorów mechanizmu, łańcuszek po wybranej stronie. Wycena online, realizacja do 10 dni roboczych, 5 lat gwarancji, 30 dni na zwrot.",
    startingPriceFallback: 76.9,
    sku: "roleta-dzien-noc-mini-na-wymiar",
    category: "Rolety dzień-noc",
    seoImage: "https://crm-keika.groovemedia.pl/storage/shop/media/bamar_sys_b1dn_1200.jpg",
  },
  "rolety-tradycyjne": {
    ...ROLETY_BASE,
    slug: "rolety-tradycyjne",
    path: "/rolety-tradycyjne",
    shortName: "roletę",
    h1: "Rolety mini na wymiar - Deko i Termo",
    seoTitle: "Rolety mini na wymiar - tkaniny Deko i Termo | KEIKA",
    seoDescription:
      "Roleta mini na wymiar z tkaniną Deko (półprzepuszczalna, 54 kolory) lub Termo (zaciemniająca, 19 kolorów). Montaż na skrzydle bez wiercenia, wkręcany lub w kasecie z prowadnicami, 5 kolorów mechanizmu. Wycena online, realizacja do 10 dni roboczych, 5 lat gwarancji, 30 dni na zwrot.",
    startingPriceFallback: 72.9,
    sku: "roleta-mini-na-wymiar",
    category: "Rolety tradycyjne",
    seoImage: "https://crm-keika.groovemedia.pl/storage/shop/media/bamar_sys_b1minilux_1200.jpg",
  },
  zaluzje: {
    slug: "zaluzje",
    path: "/zaluzje",
    shortName: "żaluzję",
    h1: "Żaluzje poziome na wymiar",
    seoTitle: "Żaluzje poziome na wymiar - drewniane, bambusowe, aluminiowe | KEIKA",
    seoDescription:
      "Żaluzje poziome na wymiar w 38 modelach: drewniane basswood i abachi, bambusowe, prime wood, drewnopodobne PCV i aluminiowe, lamele 16-65 mm, kilkaset kolorów. Sterowanie sznurkiem z przekładnią po wybranej stronie, klamry w cenie. Wycena online, realizacja do 15 dni roboczych, 5 lat gwarancji, 30 dni na zwrot.",
    startingPriceFallback: 177.9,
    sku: "zaluzja-pozioma-na-wymiar",
    category: "Żaluzje poziome",
    seoImage: "https://crm-keika.groovemedia.pl/storage/shop/media/ss_prod_51_0_1200.jpg",
    ctaLabel: "Wyceń swoją żaluzję",
    similarLabel: "Wyceń podobną żaluzję",
    newLabel: "Wyceń nową żaluzję",
    widthMinMm: 400,
    widthMaxMm: 2400,
    heightMinMm: 300,
    heightMaxMm: 2400,
    widthDefaultMm: 800,
    heightDefaultMm: 1400,
    leadTimeDays: 15,
    leadTimeLabel: "do 15 dni roboczych",
    paczkomatMaxWidthMm: null,
    groupStepTitle: "Wybierz model żaluzji",
    colorStepTitle: "Wybierz kolor lameli",
    groupUnit: "model",
    groupCardPhoto: true,
    controlStepTitle: "Strona sterowania",
    controlStepHint: "Sznurek i przekładnia: lewa / prawa - patrząc na okno od środka pokoju.",
    controlLabelWord: "sterowanie",
    unavailableMessage: "Ten model nie jest dostępny w tym wymiarze - wybierz inny model lub mniejszy wymiar.",
    instructionSteps: [
      {
        title: "Pomiar",
        body: "Montaż we wnęce: zmierz szerokość wnęki i odejmij 2 cm, zmierz wysokość wnęki i odejmij 1 cm. Montaż na ścianie nad oknem: szerokość okna plus 10 cm, wysokość według potrzeby. Wpisz wynik w konfiguratorze.",
      },
      {
        title: "Montaż",
        body: "Klamry przykręcasz do sufitu wnęki albo do ściany nad oknem, potem wpinasz w nie górną belkę żaluzji. Klamry i wkręty są w komplecie.",
      },
      {
        title: "Sterowanie",
        body: "Sznurek podnosi i opuszcza żaluzję, przekładnia obraca lamele. Stronę sterowania wybierasz w konfiguratorze.",
      },
    ],
  },
};

export type RoletyProfile = {
  slug: RoletySlug;
  productName: string;
  widthMinMm: number;
  widthMaxMm: number;
  widthDefaultMm: number;
  heightMinMm: number;
  heightMaxMm: number;
  heightDefaultMm: number;
  mountOptions: MountOption[];
  hardware: HardwareOption[];
  fabricGroups: FabricGroup[];
  tables: PriceTable[];
  priceAdjustmentPercent: number;
  priceAdjustmentAmount: number;
  startingPrice: number | null;
};

type RawStep = {
  id: string;
  type: string;
  width_placeholder?: string;
  height_placeholder?: string;
  options?: Array<{
    id: string;
    label: string;
    subtitle?: string;
    accent_color?: string;
    image_url?: string;
    price_delta?: number;
    price_delta_type?: string;
  }>;
  groups?: Array<{
    id: string;
    label: string;
    note?: string;
    image_url?: string;
    swatches?: Array<{
      id: string;
      code: string;
      label: string;
      color?: string;
      image_url?: string;
      thumbnail_url?: string;
      price_delta?: number;
      price_delta_type?: string;
    }>;
  }>;
};

type RawProduct = {
  slug: string;
  label: string;
  display_price_amount?: string;
  pricing_calculation?: {
    default_allegro_profile_id?: string;
    allegro_profiles?: Array<{ id: string; price_adjustment_percent: number; price_adjustment_amount: number }>;
    tables?: Array<{
      id: string;
      name: string;
      hardware_ids?: string[];
      fabric_group_ids?: string[];
      width_breakpoints?: number[];
      height_breakpoints?: number[];
      prices?: number[][];
    }>;
  };
  configurator?: { steps?: RawStep[] };
};

function toPriceDeltaType(value: string | undefined): PriceDeltaType {
  return value === "percent" ? "percent" : "amount";
}

const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;
const profileCache: Partial<Record<RoletySlug, { at: number; value: RoletyProfile }>> = {};
const profileInFlight: Partial<Record<RoletySlug, Promise<RoletyProfile | null>>> = {};

/** Profil produktu z CRM. null przy błędzie sieci albo gdy w CRM nie ma
 * jeszcze kroków - strona pokazuje wtedy prośbę o odświeżenie zamiast
 * pustego konfiguratora. Nigdy nie rzuca. */
export async function fetchRoletyProfile(slug: RoletySlug): Promise<RoletyProfile | null> {
  const cached = profileCache[slug];
  if (cached && Date.now() - cached.at < PROFILE_CACHE_TTL_MS) return cached.value;
  const inFlight = profileInFlight[slug];
  if (inFlight) return inFlight;
  const request = fetchRoletyProfileUncached(slug)
    .then((value) => {
      // Nieudanej odpowiedzi nie zapamiętujemy - kolejne wejście próbuje jeszcze raz.
      if (value) profileCache[slug] = { at: Date.now(), value };
      return value;
    })
    .finally(() => {
      delete profileInFlight[slug];
    });
  profileInFlight[slug] = request;
  return request;
}

async function fetchRoletyProfileUncached(slug: RoletySlug): Promise<RoletyProfile | null> {
  try {
    const response = await fetch(CONFIGURATOR_PUBLIC_URL, { cache: "no-store" });
    const json = (await response.json()) as {
      ok: boolean;
      config?: { catalog?: { categories?: Array<{ products?: RawProduct[] }> } };
    };
    if (!json.ok || !json.config) return null;
    const categories = json.config.catalog?.categories || [];
    const product = categories.flatMap((category) => category.products || []).find((entry) => entry.slug === slug);
    if (!product) return null;

    const steps = product.configurator?.steps || [];
    const mountStep = steps.find((step) => step.type === "choice" && step.id === "step-mount");
    const hardwareStep = steps.find((step) => step.type === "choice" && step.id === "step-hardware");
    const fabricStep = steps.find((step) => step.type === "fabric");
    const dimensionsStep = steps.find((step) => step.type === "dimensions");

    const mountOptions: MountOption[] = (mountStep?.options || []).map((option) => ({
      id: option.id,
      label: option.label,
      note: option.subtitle || "",
      imageUrl: option.image_url || "",
      priceDelta: Number(option.price_delta) || 0,
      priceDeltaType: toPriceDeltaType(option.price_delta_type),
    }));

    const hardware: HardwareOption[] = (hardwareStep?.options || []).map((option) => ({
      id: option.id,
      label: option.label,
      color: option.accent_color || "#E2E8F0",
      imageUrl: option.image_url || "",
      priceDelta: Number(option.price_delta) || 0,
      priceDeltaType: toPriceDeltaType(option.price_delta_type),
    }));

    const fabricGroups: FabricGroup[] = (fabricStep?.groups || []).map((group) => ({
      id: group.id,
      label: group.label,
      note: group.note || "",
      imageUrl: group.image_url || "",
      swatches: (group.swatches || []).map((swatch) => ({
        id: swatch.id,
        code: swatch.code,
        label: swatch.label,
        color: swatch.color || "#E2E8F0",
        imageUrl: swatch.image_url || "",
        thumbnailUrl: swatch.thumbnail_url || swatch.image_url || "",
        priceDelta: Number(swatch.price_delta) || 0,
        priceDeltaType: toPriceDeltaType(swatch.price_delta_type),
      })),
    }));

    const tables: PriceTable[] = (product.pricing_calculation?.tables || []).map((table) => ({
      id: table.id,
      name: table.name,
      hardwareIds: table.hardware_ids || [],
      fabricGroupIds: table.fabric_group_ids || [],
      widthBreakpointsMm: table.width_breakpoints || [],
      heightBreakpointsMm: table.height_breakpoints || [],
      prices: table.prices || [],
    }));

    const allegroProfiles = product.pricing_calculation?.allegro_profiles || [];
    const defaultProfile =
      allegroProfiles.find((entry) => entry.id === product.pricing_calculation?.default_allegro_profile_id) || allegroProfiles[0];

    const startingPrice = product.display_price_amount ? Number(product.display_price_amount) : null;
    const copy = ROLETY_COPY[slug];

    return {
      slug,
      productName: product.label || copy.h1,
      widthMinMm: copy.widthMinMm,
      widthMaxMm: copy.widthMaxMm,
      widthDefaultMm: Number(dimensionsStep?.width_placeholder?.replace(/\D/g, "")) || copy.widthDefaultMm,
      heightMinMm: copy.heightMinMm,
      heightMaxMm: copy.heightMaxMm,
      heightDefaultMm: Number(dimensionsStep?.height_placeholder?.replace(/\D/g, "")) || copy.heightDefaultMm,
      mountOptions,
      hardware,
      fabricGroups,
      tables,
      priceAdjustmentPercent: Number(defaultProfile?.price_adjustment_percent) || 0,
      priceAdjustmentAmount: Number(defaultProfile?.price_adjustment_amount) || 0,
      startingPrice: Number.isFinite(startingPrice) ? startingPrice : null,
    };
  } catch {
    return null;
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Tabela cen dla grupy (kolekcji / modelu): dokładne dopasowanie po
 * fabric_group_ids, tabela bez listy grup jest zapasem dla wszystkich. */
export function findRoletyPricingTable(tables: PriceTable[], fabricGroupId: string): PriceTable | null {
  return (
    tables.find((table) => table.fabricGroupIds.includes(fabricGroupId)) ||
    tables.find((table) => table.fabricGroupIds.length === 0) ||
    null
  );
}

export type RoletyCell = { status: "ok"; price: number } | { status: "unavailable" } | { status: "none" };

/** Komórka matrycy dla grupy i wymiaru. "unavailable" = komórka 0 (model nie
 * jest produkowany w tym wymiarze - żaluzje), "none" = brak tabeli / wiersza. */
export function roletyMatrixCell(profile: RoletyProfile, fabricGroupId: string, widthMm: number, heightMm: number): RoletyCell {
  const table = findRoletyPricingTable(profile.tables, fabricGroupId);
  if (!table) return { status: "none" };
  const widthIndex = resolvePriceBreakpointIndex(widthMm, table.widthBreakpointsMm);
  const heightIndex = resolvePriceBreakpointIndex(heightMm, table.heightBreakpointsMm);
  if (widthIndex === null || heightIndex === null) return { status: "none" };
  const cell = table.prices[heightIndex]?.[widthIndex];
  if (typeof cell !== "number" || !Number.isFinite(cell)) return { status: "none" };
  if (cell <= 0) return { status: "unavailable" };
  return { status: "ok", price: cell };
}

/** Sama komórka matrycy (brutto, zł) z korektą profilu cen z CRM i dodatkową
 * korektą procentową produktu (lib/price-adjustment.ts). null = brak
 * cennika dla tej grupy, wymiar bez wiersza/kolumny albo komórka 0. */
export function roletyMatrixPrice(
  profile: RoletyProfile,
  fabricGroupId: string,
  widthMm: number,
  heightMm: number,
  extraAdjustPercent = 0,
): number | null {
  const cell = roletyMatrixCell(profile, fabricGroupId, widthMm, heightMm);
  if (cell.status !== "ok") return null;
  const percent = profile.priceAdjustmentPercent + extraAdjustPercent;
  return roundMoney(Math.max(0, cell.price * (1 + percent / 100) + profile.priceAdjustmentAmount));
}

/** Cena jednej sztuki: komórka matrycy grupy + dopłata montażu (kaseta
 * +59 zł) + ewentualne dopłaty koloru mechanizmu i tkaniny (dziś 0), w
 * kolejności ustalonej dla plis: kwoty, potem procenty (applyPriceDeltas). */
export function calcRoletyPrice(
  profile: RoletyProfile,
  mountId: string,
  fabricGroupId: string,
  widthMm: number,
  heightMm: number,
  options: { hardwareId?: string; fabricId?: string; extraAdjustPercent?: number } = {},
): number | null {
  const base = roletyMatrixPrice(profile, fabricGroupId, widthMm, heightMm, options.extraAdjustPercent || 0);
  if (base === null) return null;
  const mount = profile.mountOptions.find((option) => option.id === mountId) || null;
  const hardware = options.hardwareId ? profile.hardware.find((option) => option.id === options.hardwareId) || null : null;
  const group = profile.fabricGroups.find((entry) => entry.id === fabricGroupId);
  const fabric = options.fabricId ? group?.swatches.find((swatch) => swatch.id === options.fabricId) || null : null;
  return applyPriceDeltas(base, [mount, hardware, fabric]);
}

/** Najniższa cena w całym cenniku (bez dopłat, bez komórek 0) - uczciwe "od X zł". */
export function roletyStartingPrice(profile: RoletyProfile | null, slug: RoletySlug, extraAdjustPercent = 0): number {
  if (!profile) return ROLETY_COPY[slug].startingPriceFallback;
  let min = Number.POSITIVE_INFINITY;
  for (const table of profile.tables) {
    for (const row of table.prices) {
      for (const cell of row) {
        if (typeof cell === "number" && Number.isFinite(cell) && cell > 0 && cell < min) min = cell;
      }
    }
  }
  if (!Number.isFinite(min)) return ROLETY_COPY[slug].startingPriceFallback;
  const percent = profile.priceAdjustmentPercent + extraAdjustPercent;
  return roundMoney(Math.max(0, min * (1 + percent / 100) + profile.priceAdjustmentAmount));
}

/** Kategoria grupy (żaluzje: "Drewniane basswood", "Bambusowe"...) = pierwsze
 * zdanie z opisu w CRM. Rolety mają po 2-3 kolekcje - bez kategorii. */
export function roletyGroupCategory(group: Pick<FabricGroup, "note">): string {
  const first = String(group.note || "").split(/\.\s|\.$/)[0].trim();
  return first && first.length <= 40 && !/kolor/i.test(first) ? first : "";
}

/** Grupy pogrupowane po kategorii, w kolejności pierwszego wystąpienia. */
export function roletyGroupSections(groups: FabricGroup[]): Array<{ category: string; groups: FabricGroup[] }> {
  const sections: Array<{ category: string; groups: FabricGroup[] }> = [];
  for (const group of groups) {
    const category = roletyGroupCategory(group);
    let section = sections.find((entry) => entry.category === category);
    if (!section) {
      section = { category, groups: [] };
      sections.push(section);
    }
    section.groups.push(group);
  }
  return sections;
}

/** Etykieta montażu w koszyku i w CRM: "W kasecie z prowadnicami · łańcuszek: prawa"
 * albo "Klamry uniwersalne · sterowanie: lewa". Rozdzielana z powrotem przy
 * "Edytuj pozycję" (splitRoletyMountLabel). */
export function joinRoletyMountLabel(mountLabel: string, chainSide: ChainSide | "", slug: RoletySlug): string {
  return chainSide ? `${mountLabel} · ${ROLETY_COPY[slug].controlLabelWord}: ${chainSide}` : mountLabel;
}
export function splitRoletyMountLabel(label: string | undefined): { mountLabel: string; chainSide: ChainSide | "" } {
  const raw = String(label || "");
  const match = raw.match(/^(.*?) · (?:łańcuszek|sterowanie): (lewa|prawa)\s*$/i);
  if (!match) return { mountLabel: raw, chainSide: "" };
  return { mountLabel: match[1], chainSide: match[2].toLowerCase() as ChainSide };
}

/** Termin realizacji dla koszyka z kilkoma produktami tej rodziny - najdłuższy. */
export function roletyCartLeadTimeLabel(slugs: string[]): string {
  let best: RoletyProductCopy | null = null;
  for (const slug of slugs) {
    if (!isRoletySlug(slug)) continue;
    const copy = ROLETY_COPY[slug];
    if (!best || copy.leadTimeDays > best.leadTimeDays) best = copy;
  }
  return best ? best.leadTimeLabel : ROLETY_BASE.leadTimeLabel;
}

/** Paczkomat: rolety do 60 cm szerokości (sztywna rura), żaluzje nigdy. */
export function roletyFitsPaczkomat(slug: RoletySlug, widthMm: number): boolean {
  const limit = ROLETY_COPY[slug].paczkomatMaxWidthMm;
  return limit !== null && widthMm <= limit;
}

/** Jak mierzyć przy danym montażu. Rolety (właściciel, 17.10.2026): na
 * skrzydle i wkręcany = szyba między uszczelkami + 15 mm z każdej strony,
 * kaseta = dokładny wymiar szyby. Żaluzje: we wnęce szerokość minus 2 cm i
 * wysokość minus 1 cm, na ścianie szerokość okna plus 10 cm. */
export function isRoletyCassetteMount(mountIdOrLabel: string | null | undefined): boolean {
  return /kaset/i.test(String(mountIdOrLabel || ""));
}
const ZALUZJE_HINT_RECESS = "Montaż we wnęce: zmierz szerokość wnęki i odejmij 2 cm, zmierz wysokość wnęki i odejmij 1 cm.";
const ZALUZJE_HINT_WALL = "Montaż na ścianie nad oknem: podaj szerokość okna plus 10 cm i wysokość, jaką ma mieć żaluzja.";
export function roletyMeasureHint(slug: RoletySlug, mount: { id?: string; label?: string } | null | undefined): string {
  if (slug === "zaluzje") {
    const key = `${mount?.id || ""} ${mount?.label || ""}`;
    if (/sufit/i.test(key) && !/uniwersaln/i.test(key)) return ZALUZJE_HINT_RECESS;
    if (/scienn|ścienn/i.test(key)) return ZALUZJE_HINT_WALL;
    return `${ZALUZJE_HINT_RECESS} ${ZALUZJE_HINT_WALL}`;
  }
  if (!mount) return "Zmierz szerokość i wysokość szyby między uszczelkami.";
  if (isRoletyCassetteMount(mount.id) || isRoletyCassetteMount(mount.label)) {
    return "Kaseta z prowadnicami: podaj dokładną szerokość i wysokość szyby między uszczelkami. Kasetę i prowadnice dopasujemy do tego wymiaru.";
  }
  return "Zmierz szerokość i wysokość szyby między uszczelkami i dodaj po 15 mm z każdej strony (razem +30 mm do szerokości i +30 mm do wysokości). Tak policzony wymiar wpisz poniżej.";
}

export type ConfiguratorInitialValues = {
  mountId?: string;
  hardwareId?: string;
  fabricGroupId?: string;
  fabricId?: string;
  chainSide?: ChainSide;
  widthMm?: number;
  heightMm?: number;
  qty?: number;
  /** Edycja z koszyka: pozycja ma tylko etykiety, id dobieramy po
   * wczytaniu profilu (jak w plisach). */
  mountLabel?: string;
  hardwareLabel?: string;
  fabricGroupLabel?: string;
  fabricLabel?: string;
};

export type ConfiguratorResult = {
  mountId: string;
  /** Pełna etykieta do koszyka: montaż + strona łańcuszka / sterowania. */
  mountLabel: string;
  chainSide: ChainSide;
  /** Puste, gdy produkt nie ma kroku koloru mechanizmu (żaluzje). */
  hardwareId: string;
  hardwareLabel: string;
  fabricGroupId: string;
  fabricGroupLabel: string;
  fabricId: string;
  fabricLabel: string;
  fabricColor: string;
  hardwareColor: string;
  /** Miniatura do koszyka: próbka albo zdjęcie modelu. */
  fabricThumbnailUrl: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  unitPrice: number;
  totalPrice: number;
};
