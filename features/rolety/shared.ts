// Rolety mini na wymiar (dzień-noc i tradycyjne Deko/Termo) - dane i czyste
// funkcje wspólne dla konfiguratora, strony produktu i koszyka. Jedna
// implementacja sparametryzowana slugiem: oba produkty mają w CRM ten sam
// układ kroków (montaż / kolor mechanizmu / tkanina / wymiary) i ten sam
// tryb cennika (matryca szerokość × wysokość per kolekcja tkanin), różnią
// się tylko treścią. Profil pobieramy na żywo z tego samego publicznego
// endpointu, do którego pisze panel CRM (jak plisy, features/plisy/shared.ts),
// z pamięcią podręczną 5 min, żeby zmiany właściciela w CRM pojawiały się
// bez wdrożenia, a jedno wejście na stronę nie ciągnęło katalogu kilka razy.
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

export type RoletySlug = "rolety-dzien-noc" | "rolety-tradycyjne";

export const ROLETY_SLUGS: RoletySlug[] = ["rolety-dzien-noc", "rolety-tradycyjne"];

export function isRoletySlug(slug: string | null | undefined): slug is RoletySlug {
  return slug === "rolety-dzien-noc" || slug === "rolety-tradycyjne";
}

/** Zakres produkcji (właściciel, 17.10.2026): szerokość 30-150 cm,
 * wysokość 30-220 cm, 1-50 sztuk. Wymiary poniżej pierwszego progu matrycy
 * (400 / 600 mm) są wyceniane jak pierwsza kolumna / wiersz
 * (resolvePriceBreakpointIndex zaokrągla w górę). */
export const ROLETY_WIDTH_MIN_MM = 300;
export const ROLETY_WIDTH_MAX_MM = 1500;
export const ROLETY_HEIGHT_MIN_MM = 300;
export const ROLETY_HEIGHT_MAX_MM = 2200;
export const ROLETY_QTY_MAX = 50;
/** Paczkomat tylko przy szerokości do 60 cm (rura rolety jest sztywna). */
export const ROLETY_PACZKOMAT_MAX_WIDTH_MM = 600;
export const ROLETY_LEAD_TIME_LABEL = "do 10 dni roboczych";

/** Treść zależna od produktu, której nie ma w CRM: nagłówki stron, meta,
 * cena "od" do pierwszego renderu i danych strukturalnych. Opisy, sekcje,
 * parametry i FAQ przychodzą z CRM (product_groups). */
export type RoletyProductCopy = {
  slug: RoletySlug;
  path: string;
  /** Nazwa w nagłówku konfiguratora i w koszyku ("Wyceń roletę ..."). */
  shortName: string;
  h1: string;
  seoTitle: string;
  seoDescription: string;
  /** Najniższa komórka cennika - pokazywana, zanim profil się wczyta. */
  startingPriceFallback: number;
  sku: string;
  category: string;
};

export const ROLETY_COPY: Record<RoletySlug, RoletyProductCopy> = {
  "rolety-dzien-noc": {
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
  },
  "rolety-tradycyjne": {
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

    return {
      slug,
      productName: product.label || ROLETY_COPY[slug].h1,
      widthMinMm: ROLETY_WIDTH_MIN_MM,
      widthMaxMm: ROLETY_WIDTH_MAX_MM,
      widthDefaultMm: Number(dimensionsStep?.width_placeholder?.replace(/\D/g, "")) || 600,
      heightMinMm: ROLETY_HEIGHT_MIN_MM,
      heightMaxMm: ROLETY_HEIGHT_MAX_MM,
      heightDefaultMm: Number(dimensionsStep?.height_placeholder?.replace(/\D/g, "")) || 1500,
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

/** Tabela cen dla kolekcji tkanin: dokładne dopasowanie po fabric_group_ids,
 * tabela bez listy kolekcji jest zapasem dla wszystkich. */
export function findRoletyPricingTable(tables: PriceTable[], fabricGroupId: string): PriceTable | null {
  return (
    tables.find((table) => table.fabricGroupIds.includes(fabricGroupId)) ||
    tables.find((table) => table.fabricGroupIds.length === 0) ||
    null
  );
}

/** Sama komórka matrycy (brutto, zł) z korektą profilu cen z CRM i dodatkową
 * korektą procentową produktu (lib/price-adjustment.ts). null = brak
 * cennika dla tej kolekcji albo wymiar bez wiersza/kolumny. */
export function roletyMatrixPrice(
  profile: RoletyProfile,
  fabricGroupId: string,
  widthMm: number,
  heightMm: number,
  extraAdjustPercent = 0,
): number | null {
  const table = findRoletyPricingTable(profile.tables, fabricGroupId);
  if (!table) return null;
  const widthIndex = resolvePriceBreakpointIndex(widthMm, table.widthBreakpointsMm);
  const heightIndex = resolvePriceBreakpointIndex(heightMm, table.heightBreakpointsMm);
  if (widthIndex === null || heightIndex === null) return null;
  const cell = table.prices[heightIndex]?.[widthIndex];
  if (typeof cell !== "number" || !Number.isFinite(cell) || cell <= 0) return null;
  const percent = profile.priceAdjustmentPercent + extraAdjustPercent;
  return roundMoney(Math.max(0, cell * (1 + percent / 100) + profile.priceAdjustmentAmount));
}

/** Cena jednej rolety: komórka matrycy kolekcji + dopłata montażu (kaseta
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

/** Najniższa cena w całym cenniku (bez dopłat) - uczciwe "od X zł". */
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

export type ChainSide = "lewa" | "prawa";
export const CHAIN_SIDES: Array<{ id: ChainSide; label: string; note: string }> = [
  { id: "lewa", label: "Lewa", note: "łańcuszek po lewej stronie, patrząc od pokoju" },
  { id: "prawa", label: "Prawa", note: "łańcuszek po prawej stronie, patrząc od pokoju" },
];

/** Etykieta montażu w koszyku i w CRM: "W kasecie z prowadnicami · łańcuszek: prawa".
 * Rozdzielana z powrotem przy "Edytuj pozycję" (splitRoletyMountLabel). */
export const ROLETY_CHAIN_LABEL_SEP = " · łańcuszek: ";
export function joinRoletyMountLabel(mountLabel: string, chainSide: ChainSide | ""): string {
  return chainSide ? `${mountLabel}${ROLETY_CHAIN_LABEL_SEP}${chainSide}` : mountLabel;
}
export function splitRoletyMountLabel(label: string | undefined): { mountLabel: string; chainSide: ChainSide | "" } {
  const raw = String(label || "");
  const at = raw.indexOf(ROLETY_CHAIN_LABEL_SEP);
  if (at < 0) return { mountLabel: raw, chainSide: "" };
  const side = raw.slice(at + ROLETY_CHAIN_LABEL_SEP.length).trim().toLowerCase();
  return { mountLabel: raw.slice(0, at), chainSide: side === "lewa" || side === "prawa" ? side : "" };
}

/** Jak mierzyć przy danym montażu (właściciel, 17.10.2026): na skrzydle i
 * wkręcany = szyba między uszczelkami + 15 mm z każdej strony; kaseta =
 * dokładny wymiar szyby, resztę dobieramy do kasety. */
export function isRoletyCassetteMount(mountIdOrLabel: string | null | undefined): boolean {
  return /kaset/i.test(String(mountIdOrLabel || ""));
}
export function roletyMeasureHint(mount: { id?: string; label?: string } | null | undefined): string {
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
  /** Pełna etykieta do koszyka: montaż + strona łańcuszka. */
  mountLabel: string;
  chainSide: ChainSide;
  hardwareId: string;
  hardwareLabel: string;
  fabricGroupId: string;
  fabricGroupLabel: string;
  fabricId: string;
  fabricLabel: string;
  fabricColor: string;
  hardwareColor: string;
  /** Miniatura tkaniny do koszyka. */
  fabricThumbnailUrl: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  unitPrice: number;
  totalPrice: number;
};

/** Kroki instrukcji (zakładka "Instrukcje") - zastępują generyczne teksty o
 * "otworze montażowym", które nie pasują do rolety na skrzydle. */
export const ROLETY_INSTRUCTION_STEPS: Array<{ title: string; body: string }> = [
  {
    title: "Pomiar",
    body: "Montaż na skrzydle i wkręcany: zmierz szerokość i wysokość szyby między uszczelkami i dodaj po 15 mm z każdej strony. Kaseta z prowadnicami: podaj dokładny wymiar szyby. Wpisz wynik w konfiguratorze w milimetrach albo centymetrach.",
  },
  {
    title: "Montaż bez wiercenia",
    body: "Wieszaki zakładasz na górną krawędź skrzydła okna PCV i dociskasz. Roleta wisi tuż przy szybie, bez śladów na ramie. Demontaż zajmuje chwilę.",
  },
  {
    title: "Montaż wkręcany i kaseta",
    body: "Uchwyty wkręcane mocujesz dwoma wkrętami do ramy okna, ściany lub sufitu. Kasetę z prowadnicami przyklejasz lub przykręcasz do skrzydła. Wkręty i taśma są w komplecie.",
  },
];
