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
import type { ZaluzjaDetailGroup, ZaluzjaDrawingData } from "./zaluzja-drawing-data";
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
import type { SsExtraLine, SsSupplierOrder } from "./ss-options";
import ZALUZJE_SPECS_JSON from "./ss-options/_specs.json";

export const CONFIGURATOR_PUBLIC_URL = "https://crm-keika.groovemedia.pl/biuro/api/shop/configurator_public.php";

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
      "Roleta dzień-noc mini produkowana na wymiar: tkaniny Bahama w 3 kolekcjach, montaż na skrzydle bez wiercenia, wkręcany lub w kasecie z prowadnicami, 5 kolorów mechanizmu, łańcuszek po wybranej stronie. Wycena online, realizacja do 10 dni roboczych, 5 lat gwarancji, 30 dni na zwrot.",
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
    const response = await fetch(`${CONFIGURATOR_PUBLIC_URL}?slug=${encodeURIComponent(slug)}`, { cache: "no-store" });
    return roletyProfileFromCatalogJson(await response.json(), slug);
  } catch {
    return null;
  }
}

/** Profil z odpowiedzi configurator_public.php - czysta funkcja, używana też
 * po stronie serwera (strony modeli żaluzji: metadane, generateStaticParams). */
/** Żaluzje: etykieta koloru z CRM bywa tekstem z formularza dostawcy
 * ("White matt PRF ----[met 25/cl-2501]- (+80%|+109.16 zł)", "Pine **ograniczona
 * dostępność ..."). Klient widzi samą nazwę (+ dopisek o dostępności), kod
 * trafia do pola code, ceny dostawcy znikają. Rolety bez zmian. */
function cleanSwatchText(slug: RoletySlug, label: string, code: string): { label: string; code: string } {
  if (slug !== "zaluzje") return { label, code };
  let text = String(label || "").replace(/\s*\(\s*\+[^)]*\)/g, "");
  let nextCode = String(code || "");
  const bracket = text.match(/-{2,}\s*\[([^\]]+)\]\s*-*/);
  if (bracket) {
    if (!nextCode || /^ss-\d/.test(nextCode)) nextCode = bracket[1].trim();
    text = text.replace(bracket[0], " ");
  }
  text = text.replace(/\s*\*\*\s*/g, " (").replace(/\(([^)]*)$/, "($1)");
  return { label: text.replace(/\s+/g, " ").trim(), code: /^ss-\d/.test(nextCode) ? "" : nextCode };
}

export function roletyProfileFromCatalogJson(raw: unknown, slug: RoletySlug): RoletyProfile | null {
  try {
    const json = raw as {
      ok: boolean;
      config?: { catalog?: { categories?: Array<{ products?: RawProduct[] }> } };
    };
    if (!json || !json.ok || !json.config) return null;
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
      swatches: (group.swatches || [])
        .filter((swatch) => slug !== "zaluzje" || !/\*\*\s*(wycofan|brak na stanie)/i.test(swatch.label))
        .map((swatch) => ({
        id: swatch.id,
        ...cleanSwatchText(slug, swatch.label, swatch.code),
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
  // "… · łańcuszek: lewa", "… · sterowanie: prawa" albo (żaluzje S&S)
  // "… · sterowanie: przekładnia lewa, hamulec prawy".
  const match = raw.match(/^(.*?) · (?:łańcuszek|sterowanie): (.+?)\s*$/i);
  if (!match) return { mountLabel: raw, chainSide: "" };
  const side = match[2].toLowerCase().match(/^(?:przekładnia\s+)?(lewa|prawa)\b/);
  return { mountLabel: match[1], chainSide: side ? (side[1] as ChainSide) : "" };
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
  /** Żaluzje: to, co klient zmierzył (szyba / skrzydło / wnęka); brak =
   * wymiar żaluzji podany wprost. */
  measuredWidthMm?: number;
  measuredHeightMm?: number;
  /** Żaluzje: zapisany wybór opcji Sun & Shade (id[attr] -> v) - edycja z koszyka. */
  supplierOptions?: Record<string, string>;
  /** Żaluzje, montaż na skrzydło: okno ma nawiewnik (wysokość pod nawiewnikiem). */
  hasVent?: boolean;
  /** Żaluzje, montaż na ścianę: ile miejsca nad wnęką klient zadeklarował (mm). */
  spaceAboveMm?: number;
  qty?: number;
  /** Edycja z koszyka: pozycja ma tylko etykiety, id dobieramy po
   * wczytaniu profilu (jak w plisach). */
  mountLabel?: string;
  hardwareLabel?: string;
  fabricGroupLabel?: string;
  fabricLabel?: string;
};

export type ConfiguratorResult = {
  /** Nazwa produktu do koszyka (żaluzje: nazwa modelu); puste = nazwa z menu. */
  productLabel: string;
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
  /** Wymiar wyrobu (żaluzje: wymiar żaluzji po przeliczeniu pomiaru). */
  widthMm: number;
  heightMm: number;
  /** Żaluzje: zmierzony wymiar (0 = klient podał wymiar żaluzji wprost). */
  measuredWidthMm: number;
  measuredHeightMm: number;
  /** Żaluzje: notatka produkcyjna "pomiar: szybę ... → żaluzja ...". */
  measureNote: string;
  /** Żaluzje: zamówienie u dostawcy (Sun & Shade) - wszystkie pola formularza. */
  supplier: SsSupplierOrder | null;
  /** Żaluzje: dopłaty za opcje (wliczone w unitPrice) i ich opis. */
  extras: SsExtraLine[];
  extrasNote: string;
  /** Żaluzje: krótki opis wybranych opcji dla klienta (koszyk). */
  optionsNote: string;
  /** Żaluzje: nawiewnik (montaż na skrzydło) i pakiet po podniesieniu (mm). */
  hasVent: boolean;
  stackMm: number;
  /** Żaluzje, na ścianę: miejsce nad wnęką (mm) wliczone w wysokość; 0 = nie dotyczy. */
  spaceAboveMm: number;
  /** Żaluzje: zdjęcie modelu do podglądu pozycji. */
  previewImageUrl: string;
  /** Żaluzje: rysunek z wyborów klienta i szczegóły w grupach (podsumowanie, toast, koszyk). */
  drawing?: ZaluzjaDrawingData | null;
  detailGroups?: ZaluzjaDetailGroup[];
  qty: number;
  unitPrice: number;
  totalPrice: number;
};

// ---------------------------------------------------------------------------
// Żaluzje: przepływ "rodzaj -> szerokość lameli -> wariant -> konfigurator"
// (właściciel, 17.10.2026: "najpierw duże bloki produktów, później szerokość,
// dopiero konfigurator"). Kategoria = pierwsze zdanie opisu grupy w CRM,
// szerokość = "NN mm" z nazwy grupy, wariant = reszta nazwy (RETRO, LUX...).
// ---------------------------------------------------------------------------

/** Slug kategorii do adresu (?kategoria=drewniane-basswood). */
export function zaluzjeCategorySlug(category: string): string {
  return String(category || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Krótki, rzeczowy opis kategorii żaluzji (materiał, wnętrza, cecha). */
export const ZALUZJE_CATEGORY_COPY: Record<string, string> = {
  "drewniane-basswood":
    "Lekkie drewno lipowe o równym rysunku słojów, lakierowane lub bejcowane. Do salonu, sypialni i gabinetu; nie zalecane do łazienki.",
  "drewniane-abachi": "Afrykańskie drewno abachi, lżejsze od basswood, o wyraźniejszej strukturze. Do dużych okien, gdzie liczy się mniejsza waga.",
  bambusowe: "Lamele z prasowanego bambusa o naturalnym, nieregularnym rysunku. Do wnętrz w stylu naturalnym i skandynawskim.",
  "prime-wood": "Lamele drewniane z selekcjonowanego surowca, stabilne i proste. Do dużych przeszkleń i wnętrz nowoczesnych.",
  "drewnopodobne-pcv": "Lamele z PCV z fakturą drewna, odporne na wilgoć i łatwe w czyszczeniu. Do kuchni i łazienki.",
  aluminiowe: "Cienkie lamele aluminiowe 16-50 mm, najwięcej kolorów, odporne na wilgoć. Do biura, kuchni i łazienki.",
  drewnopodobne: "Lamele z tworzywa w kolorach drewna, lżejsze i tańsze od drewnianych. Do pomieszczeń wilgotnych.",
};

export function zaluzjeCategoryDescription(category: string): string {
  return ZALUZJE_CATEGORY_COPY[zaluzjeCategorySlug(category)] || "";
}

/** Szerokość lameli z nazwy grupy ("Drewniane basswood 50 mm RETRO" -> 50). 0 = brak. */
export function zaluzjeSlatWidthMm(label: string): number {
  const match = String(label || "").match(/(\d+)\s*mm/i);
  return match ? Number(match[1]) : 0;
}

/** Nazwa wariantu bez kategorii i szerokości ("Drewniane basswood 50 mm RETRO" -> "RETRO"),
 * pusta dla wariantu podstawowego. */
export function zaluzjeVariantTag(label: string, category: string): string {
  let rest = String(label || "");
  rest = rest.replace(new RegExp(category.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), " ");
  rest = rest.replace(/\b(drewniane|bambusowe|aluminiowe|drewnopodobne|prime wood|pcv|abachi|basswood)\b/gi, " ");
  rest = rest.replace(/\d+\s*mm/i, " ");
  return rest.replace(/\s+/g, " ").trim();
}

/** Ostrożny opis różnic wariantów - tylko to, co wynika z nazwy. */
export function zaluzjeVariantNote(tag: string): string {
  const key = tag.toUpperCase();
  if (!key) return "Wariant podstawowy.";
  if (/RETRO/.test(key)) return "Z ozdobną taśmą (drabinką) zamiast sznurka między lamelami.";
  if (/LUX/.test(key)) return "Lamele lakierowane wyższej klasy.";
  if (/SELECT/.test(key)) return "Selekcjonowane drewno o równym rysunku.";
  if (/GLOSS/.test(key)) return "Lamele z połyskiem.";
  if (/CEDRO/.test(key)) return "Lamele z wyczuwalną strukturą drewna.";
  if (/EXPRESS/.test(key)) return "Wariant w szybszej realizacji.";
  if (/STARZONE/.test(key)) return "Wykończenie postarzane.";
  if (/SUNSET|ELEGANCE|DESIGN/.test(key)) return "Osobna paleta kolorów lameli.";
  return "";
}

/** Najniższa niezerowa cena w tabeli grupy (z korektami) - "od X zł" dla modelu. */
export function roletyGroupStartingPrice(profile: RoletyProfile, fabricGroupId: string, extraAdjustPercent = 0): number | null {
  const table = findRoletyPricingTable(profile.tables, fabricGroupId);
  if (!table) return null;
  let min = Number.POSITIVE_INFINITY;
  for (const row of table.prices) {
    for (const cell of row) {
      if (typeof cell === "number" && Number.isFinite(cell) && cell > 0 && cell < min) min = cell;
    }
  }
  if (!Number.isFinite(min)) return null;
  const percent = profile.priceAdjustmentPercent + extraAdjustPercent;
  return roundMoney(Math.max(0, min * (1 + percent / 100) + profile.priceAdjustmentAmount));
}

export type ZaluzjeVariant = { group: FabricGroup; widthMm: number; tag: string; startingPrice: number | null };
export type ZaluzjeWidth = { widthMm: number; variants: ZaluzjeVariant[] };
export type ZaluzjeCategory = {
  category: string;
  slug: string;
  imageUrl: string;
  description: string;
  startingPrice: number | null;
  modelCount: number;
  colorCount: number;
  widths: ZaluzjeWidth[];
};

/** Drzewo kategoria -> szerokość lameli -> warianty, w kolejności profilu. */
export function buildZaluzjeTree(profile: RoletyProfile, extraAdjustPercent = 0): ZaluzjeCategory[] {
  const out: ZaluzjeCategory[] = [];
  for (const section of roletyGroupSections(profile.fabricGroups)) {
    const category = section.category || "Inne";
    const widths: ZaluzjeWidth[] = [];
    let min: number | null = null;
    let colorCount = 0;
    for (const group of section.groups) {
      const widthMm = zaluzjeSlatWidthMm(group.label);
      const startingPrice = roletyGroupStartingPrice(profile, group.id, extraAdjustPercent);
      if (startingPrice !== null && (min === null || startingPrice < min)) min = startingPrice;
      colorCount += group.swatches.length;
      let width = widths.find((entry) => entry.widthMm === widthMm);
      if (!width) {
        width = { widthMm, variants: [] };
        widths.push(width);
      }
      width.variants.push({ group, widthMm, tag: zaluzjeVariantTag(group.label, category), startingPrice });
    }
    widths.sort((a, b) => a.widthMm - b.widthMm);
    out.push({
      category,
      slug: zaluzjeCategorySlug(category),
      imageUrl: section.groups[0]?.imageUrl || "",
      description: zaluzjeCategoryDescription(category),
      startingPrice: min,
      modelCount: section.groups.length,
      colorCount,
      widths,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Żaluzje: każdy model (grupa ss-<pid> w CRM) to osobny produkt ze stroną
// /zaluzje/<slug> (właściciel, 17.10.2026: "te różne opcje żaluzji nie mają
// być w konfiguratorze - to są produkty"). Slug i nazwa liczone z etykiety i
// kategorii grupy, np. "Bambusowe 50 mm RETRO" -> "bambusowe-50-mm-retro",
// "Żaluzje bambusowe 50 mm RETRO". Strona przyjmuje też id grupy (ss-39).
// ---------------------------------------------------------------------------

/** Przymiotnik rodzaju do nazwy produktu ("Żaluzje bambusowe ..."). */
const ZALUZJE_CATEGORY_ADJ: Record<string, string> = {
  "drewniane-basswood": "drewniane basswood",
  "drewniane-abachi": "drewniane abachi",
  bambusowe: "bambusowe",
  "prime-wood": "Prime wood",
  "drewnopodobne-pcv": "drewnopodobne PCV",
  aluminiowe: "aluminiowe",
  drewnopodobne: "drewnopodobne",
};

export type ZaluzjeModel = {
  id: string;
  slug: string;
  /** "Żaluzje bambusowe 50 mm RETRO" - nazwa produktu (H1, koszyk). */
  name: string;
  /** "50 mm RETRO" - do okruszka i kart w katalogu. */
  shortName: string;
  category: string;
  categorySlug: string;
  widthMm: number;
  tag: string;
  note: string;
  /** "do 180 × 240 cm" albo "" gdy opis w CRM nie podaje. */
  maxSizeText: string;
  imageUrl: string;
  colorCount: number;
  startingPrice: number | null;
  group: FabricGroup;
};

function slugifyPl(text: string): string {
  return String(text || "")
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function zaluzjeModelBase(group: FabricGroup): { category: string; categorySlug: string; widthMm: number; tag: string; adj: string } {
  const category = roletyGroupCategory(group) || "Żaluzje";
  const categorySlug = zaluzjeCategorySlug(category);
  const widthMm = zaluzjeSlatWidthMm(group.label);
  const tag = zaluzjeVariantTag(group.label, category);
  const adj = ZALUZJE_CATEGORY_ADJ[categorySlug] || category.charAt(0).toLowerCase() + category.slice(1);
  return { category, categorySlug, widthMm, tag, adj };
}

/** Wszystkie modele żaluzji z profilu, w kolejności CRM, z unikalnymi slugami. */
export function zaluzjeModels(profile: RoletyProfile, extraAdjustPercent = 0): ZaluzjeModel[] {
  const used = new Set<string>();
  return profile.fabricGroups.map((group) => {
    const { category, categorySlug, widthMm, tag, adj } = zaluzjeModelBase(group);
    const shortName = [widthMm ? `${widthMm} mm` : "", tag].filter(Boolean).join(" ");
    let slug = slugifyPl([adj, shortName].filter(Boolean).join(" ")) || slugifyPl(group.id);
    if (used.has(slug)) slug = `${slug}-${slugifyPl(group.id)}`;
    used.add(slug);
    const size = String(group.note || "").match(/Szeroko\S*\s+do\s+(\d+)\s*cm,\s*wysoko\S*\s+do\s+(\d+)\s*cm/i);
    return {
      id: group.id,
      slug,
      name: `Żaluzje ${adj}${shortName ? ` ${shortName}` : ""}`,
      shortName: shortName || group.label,
      category,
      categorySlug,
      widthMm,
      tag,
      note: group.note,
      maxSizeText: size ? `do ${size[1]} × ${size[2]} cm` : "",
      imageUrl: group.imageUrl,
      colorCount: group.swatches.length,
      startingPrice: roletyGroupStartingPrice(profile, group.id, extraAdjustPercent),
      group,
    };
  });
}

/** Model po slugu strony albo po id grupy (stare linki ?model=ss-39). */
export function findZaluzjeModel(profile: RoletyProfile, slugOrId: string, extraAdjustPercent = 0): ZaluzjeModel | null {
  const wanted = String(slugOrId || "").trim().toLowerCase();
  if (!wanted) return null;
  const models = zaluzjeModels(profile, extraAdjustPercent);
  return models.find((model) => model.slug === wanted) || models.find((model) => model.id.toLowerCase() === wanted) || null;
}

/** Model dla grupy (nazwa produktu w koszyku po wyborze w konfiguratorze). */
export function zaluzjeModelForGroup(profile: RoletyProfile, groupId: string): ZaluzjeModel | null {
  return zaluzjeModels(profile).find((model) => model.id === groupId) || null;
}

/** Opis modelu na stronie produktu: rodzaj + wariant + kolory + wymiar. */
export function zaluzjeModelDescription(model: ZaluzjeModel): string[] {
  const out: string[] = [];
  const categoryText = zaluzjeCategoryDescription(model.category);
  if (categoryText) out.push(categoryText);
  const variant = model.tag ? zaluzjeVariantNote(model.tag) : "";
  if (variant) out.push(`Wariant ${model.tag}: ${variant.charAt(0).toLowerCase()}${variant.slice(1)}`);
  const facts = [
    model.widthMm ? `Lamele ${model.widthMm} mm` : "",
    model.colorCount ? `${model.colorCount} kolorów lameli` : "",
    model.maxSizeText ? `wymiar ${model.maxSizeText}` : "",
  ].filter(Boolean);
  if (facts.length) out.push(`${facts.join(", ")}.`);
  out.push("Sterowanie sznurkiem z przekładnią po wybranej stronie, klamry montażowe w cenie.");
  return out;
}

// ---------------------------------------------------------------------------
// Żaluzje: sposób montażu, pomiar i przeliczenie na wymiar żaluzji
// (właściciel, 17.10.2026: "w świetle szyby, na skrzydło albo na ścianę -
// klient zaznacza, jak chce zamontować"). Klient wpisuje to, co zmierzył,
// konfigurator liczy wymiar żaluzji (cena i produkcja = wymiar żaluzji).
// WSZYSTKIE NADDATKI W JEDNYM MIEJSCU - do potwierdzenia przez właściciela.
// Klucz = id opcji montażu w CRM (step-mount).
// ---------------------------------------------------------------------------

export type ZaluzjeMountId = "w-swietle-szyby" | "na-skrzydlo" | "na-sciane";

export type ZaluzjeMountRule = {
  id: ZaluzjeMountId;
  /** Co mierzy klient - nagłówek pól i podpis animacji ("Zmierz ..."). */
  measureWhat: string;
  /** To samo w mianowniku - podsumowanie i notatka produkcyjna. */
  measureNoun: string;
  widthLabel: string;
  heightLabel: string;
  /** Wymiar żaluzji = zmierzony + naddatek (mm, może być ujemny). */
  addWidthMm: number;
  addHeightMm: number;
  /** Jedno zdanie: jak liczymy wymiar żaluzji. */
  ruleText: string;
  pros: string[];
  cons: string[];
  /** Montaż na skrzydle - lamele odstają od szyby, uwaga na klamkę. */
  onSash: boolean;
  /** Na ścianę: zmierzony wymiar to ŚWIATŁO żaluzji; wysokość żaluzji =
   * światło + miejsce na podniesiony pakiet nad wnęką (zaluzjeStackAboveMm). */
  stackAbove?: boolean;
  /** Kroki instrukcji pomiaru (modal "Jak zmierzyć?"). */
  steps: string[];
};

/** Stały blok informacyjny dla montażu na ścianę (krok pomiaru i modal). */
export const ZALUZJE_WALL_INFO =
  "Mierzysz wnękę okienną. Jej wymiar to światło żaluzji - tyle będzie zasłonięte. Do szerokości dodamy po 5 cm z każdej strony (żaluzja = światło + 10 cm). Wysokość policzymy tak, żeby podniesiony pakiet lameli schował się nad wnęką.";

export const ZALUZJE_MOUNT_RULES: Record<ZaluzjeMountId, ZaluzjeMountRule> = {
  // Jak plisy w montażu przykręcanym (STANDARD): od połowy uszczelki do połowy
  // uszczelki, żaluzja = zmierzony wymiar (właściciel, 17.10.2026).
  "w-swietle-szyby": {
    id: "w-swietle-szyby",
    measureWhat: "szybę od połowy uszczelki do połowy uszczelki",
    measureNoun: "szyba (połowa uszczelki)",
    widthLabel: "Szerokość szyby",
    heightLabel: "Wysokość szyby",
    addWidthMm: 0,
    addHeightMm: 0,
    ruleText: "Żaluzja = zmierzony wymiar. Nic nie dodajemy ani nie odejmujemy.",
    pros: ["Okno otwiera się i uchyla razem z żaluzją", "Nie zabiera miejsca na parapecie"],
    cons: ["Lamele 35-65 mm odstają od szyby o ok. 4-7 cm - sprawdź klamkę"],
    onSash: true,
    steps: [
      "Zmierz szerokość od połowy uszczelki do połowy uszczelki po drugiej stronie.",
      "Zmierz wysokość tak samo: od połowy górnej do połowy dolnej uszczelki.",
      "Wpisz oba wymiary. Żaluzja będzie dokładnie taka - nic nie dodajemy.",
    ],
  },
  // Jak plisy bezinwazyjne: szerokość od kreseczki do kreseczki (szyba razem z
  // listwami), wysokość całego skrzydła; z nawiewnikiem - od jego dołu.
  "na-skrzydlo": {
    id: "na-skrzydlo",
    measureWhat: "skrzydło: szerokość od kreseczki do kreseczki, wysokość całej ramy",
    measureNoun: "skrzydło (kreseczka / cała rama)",
    widthLabel: "Szerokość (kreseczka-kreseczka)",
    heightLabel: "Wysokość skrzydła",
    addWidthMm: 0,
    addHeightMm: 0,
    ruleText: "Żaluzja = zmierzony wymiar. Szerokość od kreseczki do kreseczki, wysokość całego skrzydła - bez odejmowania.",
    pros: ["Okno otwiera się i uchyla razem z żaluzją", "Zakrywa też ramę skrzydła - mniej szczelin światła"],
    cons: ["Lamele odstają od skrzydła - sprawdź klamkę"],
    onSash: true,
    steps: [
      "Szerokość: od kreseczki do kreseczki - cienkiej linii, w której listwa przyszybowa łączy się z ramą skrzydła (szyba razem z listwami).",
      "Wysokość: całe skrzydło, od górnej do dolnej krawędzi ramy skrzydła.",
      "Wpisz oba wymiary. Żaluzja będzie dokładnie taka - nic nie odejmujemy.",
    ],
  },
  // Wnęka = światło żaluzji (właściciel, 17.10.2026): szerokość + 10 cm,
  // wysokość = światło + miejsce na pakiet nad wnęką (stackAbove).
  "na-sciane": {
    id: "na-sciane",
    measureWhat: "wnękę okienną - jej wymiar to światło żaluzji",
    measureNoun: "wnęka (światło)",
    widthLabel: "Szerokość światła (wnęki)",
    heightLabel: "Wysokość światła (wnęki)",
    addWidthMm: 100,
    addHeightMm: 0,
    stackAbove: true,
    ruleText: "Żaluzja = światło + 10 cm szerokości (po 5 cm z każdej strony); wysokość = światło + miejsce na podniesiony pakiet nad wnęką.",
    pros: ["Najlepsze zaciemnienie - zasłania całe okno", "Nie dotyka okna"],
    cons: ["Przed otwarciem okna trzeba podciągnąć żaluzję"],
    onSash: false,
    steps: [
      "Zmierz szerokość wnęki okiennej od ściany do ściany - to światło żaluzji.",
      "Zmierz wysokość wnęki od górnej krawędzi do parapetu - to światło w pionie.",
      "Wpisz oba wymiary i podaj, ile masz miejsca nad wnęką. Doliczymy po 5 cm z każdej strony i wysokość pakietu nad wnęką.",
    ],
  },
};

export function zaluzjeMountRule(mountId: string | null | undefined): ZaluzjeMountRule | null {
  return (ZALUZJE_MOUNT_RULES as Record<string, ZaluzjeMountRule>)[String(mountId || "")] || null;
}

/** Wymiar żaluzji z tego, co klient zmierzył przy danym montażu. */
export function zaluzjeBlindSize(mountId: string, measuredWidthMm: number, measuredHeightMm: number, spaceAboveMm = 0): { widthMm: number; heightMm: number } {
  const rule = zaluzjeMountRule(mountId);
  if (!rule) return { widthMm: measuredWidthMm, heightMm: measuredHeightMm };
  return {
    widthMm: measuredWidthMm > 0 ? measuredWidthMm + rule.addWidthMm : 0,
    heightMm: measuredHeightMm > 0 ? measuredHeightMm + (rule.stackAbove ? Math.max(0, spaceAboveMm) : rule.addHeightMm) : 0,
  };
}

/** Odległość lameli od szyby przy montażu na skrzydle (mm) - ostrzeżenie o klamce. */
export const ZALUZJE_SLAT_OFFSET_MM: Record<number, number> = { 35: 40, 50: 55, 65: 70 };

export function zaluzjeHandleWarning(mountId: string, slatWidthMm: number): string {
  const rule = zaluzjeMountRule(mountId);
  const offset = ZALUZJE_SLAT_OFFSET_MM[slatWidthMm];
  if (!rule || !rule.onSash || !offset) return "";
  const cm = (offset / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 });
  return `Lamele ${slatWidthMm} mm odstają od szyby o ok. ${cm} cm - sprawdź, czy klamka nie będzie przeszkadzać.`;
}

/** Notatka produkcyjna do pozycji koszyka / wyceny. */
export function zaluzjeMeasureNote(
  mountId: string,
  measuredWidthMm: number,
  measuredHeightMm: number,
  blindWidthMm: number,
  blindHeightMm: number,
  extra: { hasVent?: boolean; stackMm?: number; spaceAboveMm?: number } = {},
): string {
  const rule = zaluzjeMountRule(mountId);
  const cm = (mm: number) => (mm / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 });
  const parts: string[] = [];
  if (!rule || !measuredWidthMm || !measuredHeightMm) parts.push(`wymiar żaluzji podany przez klienta ${cm(blindWidthMm)} × ${cm(blindHeightMm)} cm`);
  else if (rule.stackAbove) {
    // Na ścianę: światło, miejsce nad wnęką, pakiet, wymiar żaluzji.
    const space = Math.max(0, extra.spaceAboveMm || 0);
    const stack = extra.stackMm || 0;
    if (stack && space < stack) {
      parts.push(`wnęka (światło) ${cm(measuredWidthMm)} × ${cm(measuredHeightMm)} cm; nad wnęką tylko ${cm(space)} cm → żaluzja ${cm(blindWidthMm)} × ${cm(blindHeightMm)} cm, pakiet zasłoni ok. ${cm(stack - space)} cm światła`);
    } else {
      parts.push(`wnęka (światło) ${cm(measuredWidthMm)} × ${cm(measuredHeightMm)} cm; nad wnęką ${cm(space)} cm; pakiet ok. ${cm(stack || space)} cm → żaluzja ${cm(blindWidthMm)} × ${cm(blindHeightMm)} cm`);
    }
    return parts.join("; ");
  } else parts.push(`${rule.measureNoun} ${cm(measuredWidthMm)} × ${cm(measuredHeightMm)} cm → żaluzja ${cm(blindWidthMm)} × ${cm(blindHeightMm)} cm`);
  if (mountId === "na-skrzydlo") parts.push(extra.hasVent ? "nawiewnik: tak, wysokość pod nawiewnikiem" : "nawiewnik: nie");
  if (extra.stackMm && blindHeightMm > 0) parts.push(`pakiet po podniesieniu ok. ${cm(extra.stackMm)} cm (${Math.round((extra.stackMm / blindHeightMm) * 100)} %)`);
  return parts.join("; ");
}

// ---------------------------------------------------------------------------
// Dane techniczne modeli z panelu Sun & Shade (features/rolety/ss-options/
// _specs.json, klucz = pid): wysokość pakietu po podniesieniu i limity
// wymiarów / powierzchni przy sterowaniu ręcznym.
// ---------------------------------------------------------------------------

export type ZaluzjeSpec = {
  slatsPercentage: number;
  headrailMm: number;
  widthMinMm: number | null;
  widthMaxMm: number | null;
  heightMinMm: number | null;
  heightMaxMm: number | null;
  maxAreaM2: number | null;
};

export function zaluzjeSpec(pid: number | string): ZaluzjeSpec | null {
  const raw = (ZALUZJE_SPECS_JSON as Record<string, unknown>)[String(pid)];
  if (!raw || typeof raw !== "object") return null;
  const row = raw as Record<string, unknown>;
  const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
  return {
    slatsPercentage: num(row.slatsPercentage) ?? 0,
    headrailMm: num(row.headrailMm) ?? 0,
    widthMinMm: num(row.widthMinMm),
    widthMaxMm: num(row.widthMaxMm),
    heightMinMm: num(row.heightMinMm),
    heightMaxMm: num(row.heightMaxMm),
    maxAreaM2: num(row.maxAreaM2),
  };
}

/** Pakiet po podniesieniu (mm) = wysokość × procent lameli × (taśma ? 1,12 : 1) + belka górna.
 * Dla basswood 50 mm i 1000 mm: 172 mm, z taśmą 182 mm. 0 = brak danych. */
export function zaluzjeStackMm(pid: number | string, blindHeightMm: number, withTape: boolean): number {
  const spec = zaluzjeSpec(pid);
  if (!spec || !spec.slatsPercentage || blindHeightMm <= 0) return 0;
  return Math.round(blindHeightMm * spec.slatsPercentage * (withTape ? 1.12 : 1) + spec.headrailMm);
}

/** Na ścianę: pakiet dla WYSOKOŚCI CAŁKOWITEJ (światło + pakiet), nie dla
 * samego światła - 4 iteracje H = światło + stack(H) (zbiega się przy
 * procencie ≤ 0,13), wynik zaokrąglony w górę do pełnego cm. 0 = brak danych. */
export function zaluzjeStackAboveMm(pid: number | string, lightHeightMm: number, withTape: boolean): number {
  const spec = zaluzjeSpec(pid);
  if (!spec || !spec.slatsPercentage || lightHeightMm <= 0) return 0;
  let total = lightHeightMm;
  let stack = 0;
  for (let i = 0; i < 4; i += 1) {
    stack = zaluzjeStackMm(pid, total, withTape);
    total = lightHeightMm + stack;
  }
  return Math.ceil(stack / 10) * 10;
}

/** Wymiar żaluzji poza limitami modelu u dostawcy - komunikat albo "". */
export function zaluzjeSpecIssue(pid: number | string, widthMm: number, heightMm: number): string {
  const spec = zaluzjeSpec(pid);
  if (!spec || widthMm <= 0 || heightMm <= 0) return "";
  const cm = (mm: number) => (mm / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 });
  if (spec.widthMinMm && widthMm < spec.widthMinMm) return `Ten model ma minimalną szerokość ${cm(spec.widthMinMm)} cm.`;
  if (spec.widthMaxMm && widthMm > spec.widthMaxMm) return `Ten model ma maksymalną szerokość ${cm(spec.widthMaxMm)} cm.`;
  if (spec.heightMinMm && heightMm < spec.heightMinMm) return `Ten model ma minimalną wysokość ${cm(spec.heightMinMm)} cm.`;
  if (spec.heightMaxMm && heightMm > spec.heightMaxMm) return `Ten model ma maksymalną wysokość ${cm(spec.heightMaxMm)} cm.`;
  if (spec.maxAreaM2 && (widthMm * heightMm) / 1e6 > spec.maxAreaM2 + 1e-9) {
    return `Ten model ma maks. ${spec.maxAreaM2.toLocaleString("pl-PL")} m² przy sterowaniu ręcznym (wpisany wymiar to ${((widthMm * heightMm) / 1e6).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} m²).`;
  }
  return "";
}
