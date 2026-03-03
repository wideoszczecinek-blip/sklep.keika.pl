"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "@/app/components/theme-toggle";

type ProductItem = {
  name?: string;
  title?: string;
  slug?: string;
  subtitle?: string;
  description?: string;
  price_from?: string;
  image_url?: string;
  gallery_urls?: string[];
};

type ProductGroup = {
  title?: string;
  slug?: string;
  background_url?: string;
  description?: string;
  products?: ProductItem[];
};

type ConfigStepId = "hardware" | "fabric" | "dimensions";
type ConfigFieldRole = "width" | "height" | "quantity" | "none";

type ConfigDimensionField = {
  key: string;
  label: string;
  role: ConfigFieldRole;
  default?: number;
  min?: number;
  max?: number;
  step?: number;
};

type ConfigControlSideOption = {
  id: string;
  label: string;
};

type ConfigGlazingOption = {
  id: string;
  label: string;
  note?: string;
  image_url?: string;
};

type ConfigHardwareSwatch = {
  id: string;
  label: string;
  color?: string;
  image_url?: string;
  price_delta?: number;
};

type ConfigFabricSwatch = {
  id: string;
  code?: string;
  label?: string;
  color?: string;
  image_url?: string;
  price_delta?: number;
};

type ConfigFabricGroup = {
  id: string;
  label: string;
  note?: string;
  swatches: ConfigFabricSwatch[];
};

type ConfigPricingTable = {
  id: string;
  name: string;
  hardware_ids: string[];
  fabric_group_ids: string[];
  width_breakpoints: number[];
  height_breakpoints: number[];
  prices: number[][];
};

type ConfigPricingRules = {
  width_field_key?: string;
  height_field_key?: string;
  quantity_field_key?: string;
  tables: ConfigPricingTable[];
};

type ProductConfiguratorProfile = {
  product_slug: string;
  product_name?: string;
  enabled?: boolean;
  step_order: ConfigStepId[];
  dimension_fields: ConfigDimensionField[];
  control_side_options: ConfigControlSideOption[];
  glazing_bead_options: ConfigGlazingOption[];
  hardware_swatches: ConfigHardwareSwatch[];
  fabric_groups: ConfigFabricGroup[];
  pricing_rules: ConfigPricingRules;
};

type PublicConfig = {
  branding?: {
    site_title?: string;
    contact_phone?: string;
    logo_url?: string;
  };
  top_links?: Array<{ label?: string; url?: string }>;
  product_groups?: ProductGroup[];
  product_configurators?: ProductConfiguratorProfile[];
};

type MeasurementPosition = {
  id: number;
  values: Record<string, number>;
  controlSideId: string;
  glazingBeadId: string;
};

type ProductContext = {
  group: ProductGroup | null;
  product: ProductItem;
};

type PriceRowEstimate = {
  id: number;
  width: number;
  height: number;
  quantity: number;
  unitPrice: number;
  rowTotal: number;
};

const DEFAULT_PRODUCT: ProductItem = {
  name: "Rolety w kasecie Best 1",
  slug: "rolety-best-1",
  subtitle: "Rolety w aluminiowej kasecie, z prowadnicami przyszybowymi.",
  description:
    "System Best 1 zapewnia estetyczne prowadzenie tkaniny i stabilną pracę na skrzydle okna. Konfigurator pozwala dobrać osprzęt, tkaninę i wiele pozycji wymiarowych.",
  price_from: "od 329 zł",
  image_url:
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
  gallery_urls: [
    "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=1400&q=80",
    "https://images.unsplash.com/photo-1600047508788-786f6b65df7f?auto=format&fit=crop&w=1400&q=80",
  ],
};

const EDEN_BASE_COLORS = [
  "#f2efe9",
  "#e4ded3",
  "#d1c7b7",
  "#b9ad99",
  "#998b74",
  "#7f6f59",
  "#5e5446",
  "#d9e5ef",
  "#becede",
  "#9cadc2",
];

const MADAGASKAR_BASE_COLORS = [
  "#f4f5f7",
  "#d6dbe3",
  "#b4bbc6",
  "#939ca9",
  "#727c89",
  "#59616d",
  "#434b57",
  "#2f3540",
];

function generateDefaultSwatches(prefix: string, labelPrefix: string, count: number, palette: string[]): ConfigFabricSwatch[] {
  const colorPool = palette.length ? palette : ["#9eb4ca"];
  return Array.from({ length: count }, (_, idx) => {
    const no = idx + 1;
    const code = `${prefix}-${String(no).padStart(2, "0")}`;
    return {
      id: `${prefix.toLowerCase()}-${no}`,
      code,
      label: `${labelPrefix} ${String(no).padStart(2, "0")}`,
      color: colorPool[idx % colorPool.length],
      image_url: "",
      price_delta: 0,
    };
  });
}

const DEFAULT_CONFIGURATOR_PROFILE: ProductConfiguratorProfile = {
  product_slug: "rolety-best-1",
  product_name: "Rolety BEST 1",
  enabled: true,
  step_order: ["hardware", "fabric", "dimensions"],
  dimension_fields: [
    { key: "width_mm", label: "Szerokość (mm)", role: "width", default: 820, min: 100, max: 4000, step: 1 },
    { key: "height_mm", label: "Wysokość (mm)", role: "height", default: 1220, min: 100, max: 4000, step: 1 },
    { key: "quantity", label: "Ilość", role: "quantity", default: 1, min: 1, max: 100, step: 1 },
  ],
  control_side_options: [
    { id: "right", label: "Prawa" },
    { id: "left", label: "Lewa" },
  ],
  glazing_bead_options: [
    {
      id: "flat",
      label: "Listwa płaska",
      note: "Do prostych listew przyszybowych z płaskim profilem.",
      image_url:
        "https://images.unsplash.com/photo-1616627561943-55d9e9f4f4c5?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "round",
      label: "Listwa zaokrąglona",
      note: "Do listew z łukiem/zaokrągleniem przy szybie.",
      image_url:
        "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=900&q=80",
    },
    {
      id: "angled",
      label: "Listwa skośna",
      note: "Do listew o wyraźnym skosie i głębszym osadzeniu szyby.",
      image_url:
        "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=900&q=80",
    },
  ],
  hardware_swatches: [
    { id: "anthracite", label: "Antracyt mat", color: "#3e434b", image_url: "", price_delta: 0 },
    { id: "white", label: "Biały satyna", color: "#f3f5f7", image_url: "", price_delta: 0 },
    { id: "black", label: "Czarny soft", color: "#1d2128", image_url: "", price_delta: 0 },
    { id: "golden-oak", label: "Złoty dąb", color: "#a77543", image_url: "", price_delta: 0 },
    { id: "walnut", label: "Orzech", color: "#6c4630", image_url: "", price_delta: 0 },
    { id: "silver", label: "Srebrny szczotkowany", color: "#aeb6c2", image_url: "", price_delta: 0 },
  ],
  fabric_groups: [
    {
      id: "eden",
      label: "EDEN",
      note: "Kolekcja ok. 50 kolorów.",
      swatches: generateDefaultSwatches("ED", "EDEN", 50, EDEN_BASE_COLORS),
    },
    {
      id: "madagaskar-silver",
      label: "Madagaskar Silver",
      note: "Kolekcja ok. 20 kolorów.",
      swatches: generateDefaultSwatches("MS", "Madagaskar Silver", 20, MADAGASKAR_BASE_COLORS),
    },
  ],
  pricing_rules: {
    width_field_key: "width_mm",
    height_field_key: "height_mm",
    quantity_field_key: "quantity",
    tables: [
      {
        id: "best1-default",
        name: "Tabela bazowa",
        hardware_ids: [],
        fabric_group_ids: [],
        width_breakpoints: [600, 800, 1000, 1200, 1400],
        height_breakpoints: [1000, 1200, 1400, 1600, 1800],
        prices: [
          [249, 269, 289, 309, 329],
          [269, 289, 309, 329, 349],
          [289, 309, 329, 349, 369],
          [309, 329, 349, 369, 389],
          [329, 349, 369, 389, 409],
        ],
      },
      {
        id: "best1-eden-anthracite",
        name: "EDEN + antracyt",
        hardware_ids: ["anthracite"],
        fabric_group_ids: ["eden"],
        width_breakpoints: [600, 800, 1000, 1200, 1400],
        height_breakpoints: [1000, 1200, 1400, 1600, 1800],
        prices: [
          [269, 289, 309, 329, 349],
          [289, 309, 329, 349, 369],
          [309, 329, 349, 369, 389],
          [329, 349, 369, 389, 409],
          [349, 369, 389, 409, 429],
        ],
      },
    ],
  },
};

function toNumber(value: unknown, fallback = 0): number {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return numeric;
}

function absolutizeUrl(rawUrl: string, fallbackOrigin: string): string {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    if (value.startsWith("//")) return `https:${value}`;
    if (/^https?:\/\//i.test(value)) return value;
    return new URL(value, fallbackOrigin).toString();
  } catch {
    return value;
  }
}

function parseNumericInput(value: string): number {
  const normalized = String(value || "").replace(",", ".");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, parsed);
}

function parseBasePrice(rawPrice: string | undefined): number {
  const source = String(rawPrice || "");
  const match = source.match(/\d+[\d\s,.]*/);
  if (!match) return 0;
  const numeric = Number(match[0].replace(/\s+/g, "").replace(",", "."));
  return Number.isFinite(numeric) ? Math.max(0, numeric) : 0;
}

function findProductContext(config: PublicConfig | null, slug: string): ProductContext {
  const targetSlug = String(slug || "").trim();
  const groups = Array.isArray(config?.product_groups) ? config.product_groups : [];

  for (const group of groups) {
    const products = Array.isArray(group.products) ? group.products : [];
    const match = products.find((entry) => String(entry.slug || "").trim() === targetSlug);
    if (match) {
      return { group, product: match };
    }
  }

  const fallbackGroup = groups[0] || null;
  return {
    group: fallbackGroup,
    product: DEFAULT_PRODUCT,
  };
}

function ensureConfiguratorProfile(config: PublicConfig | null, slug: string): ProductConfiguratorProfile | null {
  const targetSlug = String(slug || "").trim();
  const profiles = Array.isArray(config?.product_configurators) ? config.product_configurators : [];

  const configured = profiles.find(
    (entry) =>
      entry &&
      entry.enabled !== false &&
      String(entry.product_slug || "").trim() === targetSlug,
  );
  if (configured) {
    return configured;
  }

  if (targetSlug === DEFAULT_CONFIGURATOR_PROFILE.product_slug) {
    return DEFAULT_CONFIGURATOR_PROFILE;
  }

  return null;
}

function sanitizeStepOrder(stepOrder: ConfigStepId[] | undefined): ConfigStepId[] {
  const allowed: ConfigStepId[] = ["hardware", "fabric", "dimensions"];
  const result = (Array.isArray(stepOrder) ? stepOrder : []).filter((entry) => allowed.includes(entry));
  return result.length ? result : [...allowed];
}

function getStepTitle(stepId: ConfigStepId): string {
  if (stepId === "hardware") return "Kolor osprzętu";
  if (stepId === "fabric") return "Tkanina";
  return "Wymiary i sterowanie";
}

function getFieldByRole(fields: ConfigDimensionField[], role: "width" | "height" | "quantity"): ConfigDimensionField | null {
  return fields.find((entry) => entry.role === role) || null;
}

function normalizeFieldValue(field: ConfigDimensionField | null, rawValue: number): number {
  let nextValue = Number.isFinite(rawValue) ? rawValue : 0;
  const min = field ? toNumber(field.min, 0) : 0;
  const max = field ? toNumber(field.max, 0) : 0;
  const step = field ? Math.max(0.0001, toNumber(field.step, 1)) : 1;

  if (nextValue < min) nextValue = min;
  if (max > 0 && nextValue > max) nextValue = max;

  if (step >= 1) {
    nextValue = Math.round(nextValue);
  } else {
    const precision = step >= 0.1 ? 1 : step >= 0.01 ? 2 : 3;
    nextValue = Number(nextValue.toFixed(precision));
  }

  return Math.max(0, nextValue);
}

function createPosition(profile: ProductConfiguratorProfile, id: number, source?: MeasurementPosition): MeasurementPosition {
  const fields = Array.isArray(profile.dimension_fields) ? profile.dimension_fields : [];
  const values: Record<string, number> = {};
  for (const field of fields) {
    const sourceValue = source?.values?.[field.key];
    const fallbackValue = toNumber(field.default, toNumber(field.min, 0));
    values[field.key] = normalizeFieldValue(field, toNumber(sourceValue, fallbackValue));
  }

  const controlFallback = profile.control_side_options?.[0]?.id || "";
  const glazingFallback = profile.glazing_bead_options?.[0]?.id || "";

  return {
    id,
    values,
    controlSideId: source?.controlSideId || controlFallback,
    glazingBeadId: source?.glazingBeadId || glazingFallback,
  };
}

function getBreakpointIndex(breakpoints: number[], value: number): number {
  const points = breakpoints.filter((point) => Number.isFinite(point) && point > 0);
  if (!points.length) return -1;
  for (let idx = 0; idx < points.length; idx += 1) {
    if (value <= points[idx]) return idx;
  }
  return points.length - 1;
}

function getGridPrice(table: ConfigPricingTable, width: number, height: number): number {
  const colIndex = getBreakpointIndex(table.width_breakpoints || [], width);
  const rowIndex = getBreakpointIndex(table.height_breakpoints || [], height);
  if (colIndex < 0 || rowIndex < 0) return 0;

  const row = Array.isArray(table.prices?.[rowIndex])
    ? table.prices[rowIndex]
    : Array.isArray(table.prices?.[table.prices.length - 1])
      ? table.prices[table.prices.length - 1]
      : [];

  const directValue = row[colIndex];
  if (Number.isFinite(directValue)) return toNumber(directValue, 0);

  const fallbackValue = row[row.length - 1];
  if (Number.isFinite(fallbackValue)) return toNumber(fallbackValue, 0);

  return 0;
}

function scorePricingTable(table: ConfigPricingTable): number {
  const hardwareScore = Array.isArray(table.hardware_ids) && table.hardware_ids.length > 0 ? 2 : 0;
  const fabricScore = Array.isArray(table.fabric_group_ids) && table.fabric_group_ids.length > 0 ? 1 : 0;
  return hardwareScore + fabricScore;
}

function pickPricingTable(
  tables: ConfigPricingTable[],
  selectedHardwareId: string,
  selectedFabricGroupId: string,
): ConfigPricingTable | null {
  if (!Array.isArray(tables) || tables.length === 0) return null;

  const exactMatches = tables.filter((table) => {
    const hardwareFilter = Array.isArray(table.hardware_ids) ? table.hardware_ids.filter(Boolean) : [];
    const fabricFilter = Array.isArray(table.fabric_group_ids) ? table.fabric_group_ids.filter(Boolean) : [];

    if (hardwareFilter.length > 0 && !hardwareFilter.includes(selectedHardwareId)) return false;
    if (fabricFilter.length > 0 && !fabricFilter.includes(selectedFabricGroupId)) return false;
    return true;
  });

  const candidates = exactMatches.length > 0 ? exactMatches : tables;
  return [...candidates].sort((a, b) => scorePricingTable(b) - scorePricingTable(a))[0] || null;
}

function resolveDimensionKey(profile: ProductConfiguratorProfile, explicit: string | undefined, role: "width" | "height" | "quantity"): string {
  const direct = String(explicit || "").trim();
  if (direct) return direct;
  const byRole = getFieldByRole(profile.dimension_fields || [], role);
  return byRole?.key || "";
}

export default function ConfiguratorPage({ params }: { params?: { slug?: string } }) {
  const routerParams = useParams<{ slug?: string | string[] }>();
  const routerSlug = Array.isArray(routerParams?.slug) ? routerParams.slug[0] : routerParams?.slug;
  const propSlug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const slug = String(routerSlug || propSlug || "").trim();

  const configEndpoint =
    process.env.NEXT_PUBLIC_CRM_SHOP_CONFIG_URL || "https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public";

  const endpointOrigin = useMemo(() => {
    try {
      return new URL(configEndpoint).origin;
    } catch {
      return "https://crm-keika.groovemedia.pl";
    }
  }, [configEndpoint]);

  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const [currentStep, setCurrentStep] = useState(0);
  const [selectedHardwareId, setSelectedHardwareId] = useState("");
  const [selectedFabricGroupId, setSelectedFabricGroupId] = useState("");
  const [selectedFabricCode, setSelectedFabricCode] = useState("");
  const [positions, setPositions] = useState<MeasurementPosition[]>([]);
  const [mobileAccordionOpen, setMobileAccordionOpen] = useState(true);
  const [mobilePreviewOpen, setMobilePreviewOpen] = useState(false);
  const [selectionToast, setSelectionToast] = useState("");
  const [zoomImage, setZoomImage] = useState<{ url: string; title: string } | null>(null);
  const [openFieldHelp, setOpenFieldHelp] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    fetch(`${configEndpoint}?_ts=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        if (json?.ok && typeof json.config === "object") {
          setConfig(json.config as PublicConfig);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [configEndpoint]);

  const branding = config?.branding || {};
  const topLinks = Array.isArray(config?.top_links) ? config.top_links : [];
  const logoUrl = absolutizeUrl(branding.logo_url || "", endpointOrigin);
  const contactPhone = branding.contact_phone || "+48 123 456 789";

  const productContext = useMemo(() => findProductContext(config, slug), [config, slug]);
  const foundGroup = productContext.group;
  const product = productContext.product;

  const profile = useMemo(() => ensureConfiguratorProfile(config, slug), [config, slug]);

  const stepOrder = useMemo(() => sanitizeStepOrder(profile?.step_order), [profile?.step_order]);
  const steps = useMemo(
    () =>
      stepOrder.map((id, idx) => ({
        id,
        label: `${idx + 1}. ${getStepTitle(id)}`,
      })),
    [stepOrder],
  );

  useEffect(() => {
    if (!profile) {
      setCurrentStep(0);
      setPositions([]);
      setSelectedHardwareId("");
      setSelectedFabricGroupId("");
      setSelectedFabricCode("");
      return;
    }

    const firstHardware = profile.hardware_swatches?.[0]?.id || "";
    const firstGroup = profile.fabric_groups?.[0] || null;
    const firstSwatchCode = firstGroup?.swatches?.[0]?.code || firstGroup?.swatches?.[0]?.id || "";

    setCurrentStep(0);
    setSelectedHardwareId(firstHardware);
    setSelectedFabricGroupId(firstGroup?.id || "");
    setSelectedFabricCode(firstSwatchCode);
    setPositions([createPosition(profile, 1)]);
  }, [profile]);

  useEffect(() => {
    if (!profile) return;

    const hasHardware = profile.hardware_swatches.some((entry) => entry.id === selectedHardwareId);
    if (!hasHardware) {
      setSelectedHardwareId(profile.hardware_swatches?.[0]?.id || "");
    }

    const activeGroup = profile.fabric_groups.find((entry) => entry.id === selectedFabricGroupId) || profile.fabric_groups[0];
    if (activeGroup && activeGroup.id !== selectedFabricGroupId) {
      setSelectedFabricGroupId(activeGroup.id);
    }

    const swatches = Array.isArray(activeGroup?.swatches) ? activeGroup.swatches : [];
    const hasSwatch = swatches.some((entry) => (entry.code || entry.id) === selectedFabricCode);
    if (!hasSwatch) {
      const fallbackCode = swatches[0]?.code || swatches[0]?.id || "";
      setSelectedFabricCode(fallbackCode);
    }
  }, [profile, selectedHardwareId, selectedFabricGroupId, selectedFabricCode]);

  useEffect(() => {
    if (currentStep >= steps.length && steps.length > 0) {
      setCurrentStep(steps.length - 1);
    }
  }, [currentStep, steps.length]);

  useEffect(() => {
    setOpenFieldHelp(null);
  }, [currentStep]);

  useEffect(() => {
    if (!selectionToast) return;
    const timer = window.setTimeout(() => setSelectionToast(""), 2200);
    return () => window.clearTimeout(timer);
  }, [selectionToast]);

  const productSlug = String(product.slug || slug || DEFAULT_PRODUCT.slug || "rolety-best-1").trim();
  const productName = product.name || product.title || profile?.product_name || DEFAULT_PRODUCT.name || "Produkt";
  const productSubtitle =
    product.subtitle ||
    "Skonfiguruj produkt krok po kroku: wybierz wariant, tkaninę i podaj dokładne wymiary.";
  const productDescription =
    product.description ||
    "Wyliczenie ceny bazuje na tabelach siatkowych skonfigurowanych w panelu administracyjnym.";

  const productImage = absolutizeUrl(
    product.image_url || product.gallery_urls?.[0] || DEFAULT_PRODUCT.image_url || "",
    endpointOrigin,
  );

  const activeStepId = (steps[currentStep]?.id || "hardware") as ConfigStepId;

  const hardwareSwatches = useMemo(
    () => (Array.isArray(profile?.hardware_swatches) ? profile!.hardware_swatches : []),
    [profile],
  );
  const fabricGroups = useMemo(
    () => (Array.isArray(profile?.fabric_groups) ? profile!.fabric_groups : []),
    [profile],
  );
  const glazingOptions = useMemo(
    () => (Array.isArray(profile?.glazing_bead_options) ? profile!.glazing_bead_options : []),
    [profile],
  );
  const controlSideOptions = useMemo(
    () => (Array.isArray(profile?.control_side_options) ? profile!.control_side_options : []),
    [profile],
  );

  const baseDimensionFields = useMemo(
    () => (Array.isArray(profile?.dimension_fields) && profile!.dimension_fields.length ? profile!.dimension_fields : DEFAULT_CONFIGURATOR_PROFILE.dimension_fields),
    [profile],
  );

  const isBest1Configurator = productSlug === "rolety-best-1";

  const dimensionFields = useMemo(() => {
    if (!isBest1Configurator) return baseDimensionFields;

    const widthField = getFieldByRole(baseDimensionFields, "width") || baseDimensionFields[0] || { key: "width_mm", label: "Szerokość", role: "width" as const, default: 900, min: 100, max: 4000, step: 1 };
    const heightField = getFieldByRole(baseDimensionFields, "height") || baseDimensionFields[1] || { key: "height_mm", label: "Wysokość", role: "height" as const, default: 1200, min: 100, max: 4000, step: 1 };

    const glassField =
      baseDimensionFields.find((entry) => {
        const key = String(entry.key || "").toLowerCase();
        const label = String(entry.label || "").toLowerCase();
        return key.includes("glass") || key.includes("szyb") || label.includes("szyb");
      }) ||
      {
        key: "glass_width_mm",
        label: "Szerokość szyby (mm)",
        role: "none" as const,
        default: 700,
        min: 80,
        max: 3900,
        step: 1,
      };

    return [
      { ...widthField, label: "Szerokość całkowita (mm)", role: "width" as const },
      { ...glassField, label: "Szerokość szyby (mm)", role: "none" as const },
      { ...heightField, label: "Wysokość całkowita (mm)", role: "height" as const },
      ...baseDimensionFields.filter((entry) =>
        entry.key !== widthField.key &&
        entry.key !== heightField.key &&
        entry.key !== glassField.key &&
        entry.role !== "quantity",
      ),
      ...baseDimensionFields.filter((entry) => entry.role === "quantity"),
    ];
  }, [baseDimensionFields, isBest1Configurator]);

  const visibleDimensionFields = useMemo(
    () => dimensionFields.filter((entry) => entry.role !== "quantity"),
    [dimensionFields],
  );

  const selectedHardware = useMemo(
    () => hardwareSwatches.find((entry) => entry.id === selectedHardwareId) || hardwareSwatches[0] || null,
    [hardwareSwatches, selectedHardwareId],
  );

  const activeFabricGroup = useMemo(
    () => fabricGroups.find((entry) => entry.id === selectedFabricGroupId) || fabricGroups[0] || null,
    [fabricGroups, selectedFabricGroupId],
  );

  const activeFabric = useMemo(() => {
    if (!activeFabricGroup) return null;
    return (
      activeFabricGroup.swatches.find((entry) => (entry.code || entry.id) === selectedFabricCode) ||
      activeFabricGroup.swatches[0] ||
      null
    );
  }, [activeFabricGroup, selectedFabricCode]);

  const widthFieldKey = profile
    ? resolveDimensionKey(profile, profile.pricing_rules?.width_field_key, "width")
    : "";
  const heightFieldKey = profile
    ? resolveDimensionKey(profile, profile.pricing_rules?.height_field_key, "height")
    : "";
  const quantityFieldKey = profile
    ? resolveDimensionKey(profile, profile.pricing_rules?.quantity_field_key, "quantity")
    : "";

  const activePricingTable = useMemo(() => {
    if (!profile) return null;
    const tables = Array.isArray(profile.pricing_rules?.tables) ? profile.pricing_rules.tables : [];
    return pickPricingTable(tables, selectedHardware?.id || "", activeFabricGroup?.id || "");
  }, [profile, selectedHardware?.id, activeFabricGroup?.id]);

  const fallbackBasePrice = useMemo(() => {
    const parsed = parseBasePrice(product.price_from);
    return parsed > 0 ? parsed : 329;
  }, [product.price_from]);

  const rowEstimates = useMemo<PriceRowEstimate[]>(() => {
    const hardwareDelta = toNumber(selectedHardware?.price_delta, 0);
    const fabricDelta = toNumber(activeFabric?.price_delta, 0);

    return positions.map((position) => {
      const width = Math.max(0, toNumber(position.values[widthFieldKey], 0));
      const height = Math.max(0, toNumber(position.values[heightFieldKey], 0));
      const quantity = Math.max(1, Math.round(toNumber(position.values[quantityFieldKey], 1)));

      let unitBase = 0;
      if (activePricingTable) {
        unitBase = getGridPrice(activePricingTable, width, height);
      }

      if (unitBase <= 0) {
        const squareMeters = (Math.max(1, width) / 1000) * (Math.max(1, height) / 1000);
        unitBase = fallbackBasePrice + squareMeters * 138;
      }

      const unitPrice = Math.max(0, unitBase + hardwareDelta + fabricDelta);
      const rowTotal = unitPrice * quantity;

      return {
        id: position.id,
        width,
        height,
        quantity,
        unitPrice,
        rowTotal,
      };
    });
  }, [
    positions,
    widthFieldKey,
    heightFieldKey,
    quantityFieldKey,
    selectedHardware?.price_delta,
    activeFabric?.price_delta,
    activePricingTable,
    fallbackBasePrice,
  ]);

  const totalItems = rowEstimates.reduce((sum, row) => sum + row.quantity, 0);
  const estimatedPrice = rowEstimates.reduce((sum, row) => sum + row.rowTotal, 0);

  const requiredDimensionKeys = useMemo(
    () => new Set([widthFieldKey, heightFieldKey, quantityFieldKey].filter(Boolean)),
    [widthFieldKey, heightFieldKey, quantityFieldKey],
  );

  const areDimensionsValid = useMemo(() => {
    if (!positions.length) return false;

    return positions.every((position) => {
      for (const field of dimensionFields) {
        const value = toNumber(position.values[field.key], 0);

        if (requiredDimensionKeys.has(field.key) && value <= 0) {
          return false;
        }

        const min = toNumber(field.min, 0);
        const max = toNumber(field.max, 0);
        if (value < min) return false;
        if (max > 0 && value > max) return false;
      }
      return true;
    });
  }, [positions, dimensionFields, requiredDimensionKeys]);

  const canProceed =
    activeStepId === "hardware"
      ? hardwareSwatches.length === 0 || Boolean(selectedHardware)
      : activeStepId === "fabric"
        ? fabricGroups.length === 0 || Boolean(activeFabric)
        : areDimensionsValid;

  function updatePositionValue(positionId: number, fieldKey: string, inputValue: string) {
    const field = dimensionFields.find((entry) => entry.key === fieldKey) || null;
    const parsed = parseNumericInput(inputValue);
    const nextValue = normalizeFieldValue(field, parsed);

    setPositions((prev) =>
      prev.map((entry) => {
        if (entry.id !== positionId) return entry;
        return {
          ...entry,
          values: {
            ...entry.values,
            [fieldKey]: nextValue,
          },
        };
      }),
    );
  }

  function updatePositionControlSide(positionId: number, nextControlSideId: string) {
    setPositions((prev) =>
      prev.map((entry) =>
        entry.id === positionId
          ? {
              ...entry,
              controlSideId: nextControlSideId,
            }
          : entry,
      ),
    );
  }

  function updatePositionGlazing(positionId: number, nextGlazingId: string) {
    setPositions((prev) =>
      prev.map((entry) =>
        entry.id === positionId
          ? {
              ...entry,
              glazingBeadId: nextGlazingId,
            }
          : entry,
      ),
    );
  }

  function addSimilarPosition(id: number) {
    if (!profile) return;
    setPositions((prev) => {
      const source = prev.find((entry) => entry.id === id);
      if (!source) return prev;
      const nextId = Math.max(...prev.map((entry) => entry.id), 0) + 1;
      return [...prev, createPosition(profile, nextId, source)];
    });
  }

  function addEmptyPosition() {
    if (!profile) return;
    setPositions((prev) => {
      const nextId = Math.max(...prev.map((entry) => entry.id), 0) + 1;
      return [...prev, createPosition(profile, nextId)];
    });
  }

  function removePosition(id: number) {
    setPositions((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((entry) => entry.id !== id);
    });
  }

  function goNextStep() {
    if (!canProceed) return;
    setCurrentStep((prev) => Math.min(prev + 1, steps.length - 1));
  }

  function goPrevStep() {
    setCurrentStep((prev) => Math.max(prev - 1, 0));
  }

  const estimatedPriceLabel = estimatedPrice.toLocaleString("pl-PL", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const categoryHref = foundGroup?.slug ? `/kategoria/${foundGroup.slug}` : "/";

  function renderPreviewWindow() {
    const fabricImage = activeFabric?.image_url
      ? absolutizeUrl(activeFabric.image_url, endpointOrigin)
      : "";

    return (
      <div className="config-preview-window">
        <span
          className="config-preview-cassette"
          style={{
            background: `linear-gradient(180deg, ${selectedHardware?.color || "#9ca6b7"}, ${selectedHardware?.color || "#3e434b"})`,
          }}
        />
        <span className="config-preview-guide is-left" style={{ background: selectedHardware?.color || "#3e434b" }} />
        <span className="config-preview-guide is-right" style={{ background: selectedHardware?.color || "#3e434b" }} />
        <span
          className="config-preview-fabric"
          style={{
            background: activeFabric?.color || "#9cadc2",
            backgroundImage: fabricImage ? `url(${fabricImage})` : undefined,
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
      </div>
    );
  }

  function openImageZoom(url: string, title: string) {
    const cleanUrl = String(url || "").trim();
    if (!cleanUrl) return;
    setZoomImage({ url: cleanUrl, title });
  }

  function selectFabricSwatch(swatchCode: string, label: string) {
    setSelectedFabricCode(swatchCode);
    setSelectionToast("Wybrano kolor " + (label || swatchCode));
  }

  function getMeasurementGuide(field: ConfigDimensionField) {
    const key = String(field.key || "").toLowerCase();
    const label = String(field.label || "").toLowerCase();

    if (key.includes("glass") || key.includes("szyb") || label.includes("szyb")) {
      return {
        title: "Szerokość szyby",
        text: "Mierz samą szybę od uszczelki do uszczelki, bez listew przyszybowych.",
        image: "https://images.unsplash.com/photo-1540518614846-7eded433c457?auto=format&fit=crop&w=900&q=80",
      };
    }

    if (key.includes("height") || key.includes("wysok") || label.includes("wysok")) {
      return {
        title: "Wysokość całkowita",
        text: "Mierz całe skrzydło okienne od górnej do dolnej krawędzi.",
        image: "https://images.unsplash.com/photo-1600607687644-aac4c3eac7f4?auto=format&fit=crop&w=900&q=80",
      };
    }

    if (key.includes("width") || key.includes("szer") || label.includes("szer")) {
      return {
        title: "Szerokość całkowita",
        text: "Mierz całe skrzydło okienne od lewej do prawej krawędzi.",
        image: "https://images.unsplash.com/photo-1556911220-bff31c812dba?auto=format&fit=crop&w=900&q=80",
      };
    }

    return null;
  }

  return (    <div
      className="catalog-root configurator-root"
      style={{
        backgroundImage: productImage
          ? `url(${productImage})`
          : undefined,
      }}
    >
      <header className="hero-header">
        <div className="header-left">
          <Link className="brand" href="/" aria-label="KEIKA strona główna">
            {logoUrl ? (
              <img src={logoUrl} alt={branding.site_title || "KEIKA"} className="brand-logo" />
            ) : (
              branding.site_title || "KEIKA"
            )}
          </Link>
          <div className="top-links-wrap">
            <button type="button" className="top-links-toggle" aria-expanded="false">
              <span className="top-links-toggle-label">Menu</span>
              <span className="top-links-toggle-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            <nav className="top-links-dropdown" aria-label="Menu dodatkowe">
              {topLinks.map((entry) => (
                <a key={`${entry.label}-${entry.url}`} href={entry.url || "#"}>
                  {entry.label || "Link"}
                </a>
              ))}
            </nav>
          </div>
        </div>
        <div className="header-actions">
          <ThemeToggle />
          <a className="phone" href={`tel:${contactPhone.replace(/\s+/g, "")}`}>
            {contactPhone}
          </a>
          <a className="header-cart has-items" href="#koszyk">
            <span className="header-cart-title">Koszyk</span>
            <small>Przejdź do koszyka</small>
          </a>
        </div>
      </header>

      <main className="catalog-main">
        {loading ? (
          <section className="catalog-card">Wczytywanie konfiguratora…</section>
        ) : !profile ? (
          <section className="catalog-card">
            <h1>Konfigurator jeszcze niedostępny</h1>
            <p>Ten produkt nie ma jeszcze aktywnego profilu konfiguratora w panelu administracyjnym.</p>
            <p>
              <Link href={`/produkt/${productSlug}`}>Wróć do karty produktu</Link>
            </p>
          </section>
        ) : (
          <>
            <div className={`config-mobile-summary ${mobileAccordionOpen ? "is-open" : "is-collapsed"}`}>
              <button
                type="button"
                className="config-mobile-summary-preview"
                onClick={() => setMobilePreviewOpen(true)}
                aria-label="Powiększ podgląd produktu"
              >
                <div className="config-preview-mockup config-preview-mockup--mini" style={{ backgroundImage: `url(${productImage})` }}>
                  {renderPreviewWindow()}
                </div>
              </button>

              <div className="config-mobile-summary-price">
                <span>Podsumowanie</span>
                <strong>{estimatedPriceLabel} zł</strong>
                <small>{positions.length} poz. • {totalItems} szt.</small>
              </div>

              <button
                type="button"
                className="config-mobile-summary-toggle"
                onClick={() => setMobileAccordionOpen((prev) => !prev)}
                aria-expanded={mobileAccordionOpen}
                aria-label={mobileAccordionOpen ? "Ukryj kroki konfiguracji" : "Pokaż kroki konfiguracji"}
              >
                <span>{mobileAccordionOpen ? "Ukryj" : "Kroki"}</span>
                <span className={`config-mobile-summary-chevron ${mobileAccordionOpen ? "is-open" : ""}`} aria-hidden="true">▾</span>
              </button>
            </div>

            <section className={`configurator-layout ${mobileAccordionOpen ? "is-mobile-open" : "is-mobile-closed"}`}>
              <div className="configurator-main-panel">
                {activeStepId === "hardware" ? (
                  <article className="catalog-card">
                    <h2>Krok {currentStep + 1} z {steps.length}: Kolor kasety i prowadnic</h2>
                    <div className="hardware-grid hardware-grid--visual">
                      {hardwareSwatches.map((option) => {
                        const imageUrl = absolutizeUrl(option.image_url || "", endpointOrigin);
                        const previewImage = imageUrl || productImage;
                        const tileStyle = imageUrl
                          ? { backgroundImage: `url(${imageUrl})` }
                          : {
                              background: `linear-gradient(145deg, ${option.color || "#1e314b"}, rgba(10, 21, 36, 0.9))`,
                            };

                        return (
                          <div key={option.id} className={`hardware-card ${option.id === selectedHardware?.id ? "is-active" : ""}`}>
                            <button
                              type="button"
                              className="hardware-card-main"
                              onClick={() => setSelectedHardwareId(option.id)}
                            >
                              <span className="hardware-card-image" style={tileStyle} />
                              <span className="hardware-card-footer">
                                <span className="hardware-dot" style={{ background: option.color || "#8ea0b7" }} />
                                <strong>{option.label || option.id}</strong>
                              </span>
                              <small>Dopłata: {toNumber(option.price_delta, 0).toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł</small>
                            </button>
                            <button
                              type="button"
                              className="config-option-zoom"
                              aria-label={`Powiększ: ${option.label || option.id}`}
                              onClick={() => openImageZoom(previewImage, option.label || option.id)}
                            >
                              🔍
                            </button>
                          </div>
                        );
                      })}
                    </div>
                    <p className="configurator-field-note">Kaseta i prowadnice to najbardziej widoczny element rolety, więc wybierz kolor dopasowany do ramy okna.</p>
                    <p className="configurator-field-note">Wybrany wariant może automatycznie przełączyć cennik, jeśli taki warunek ustawisz w panelu admina.</p>
                  </article>
                ) : null}

                {activeStepId === "fabric" ? (
                  <article className="catalog-card">
                    <h2>Krok {currentStep + 1} z {steps.length}: Rodzaj i kolor materiału</h2>
                    <div className="fabric-groups">
                      {fabricGroups.map((group) => (
                        <button
                          key={group.id}
                          type="button"
                          className={`fabric-group-tab ${group.id === activeFabricGroup?.id ? "is-active" : ""}`}
                          onClick={() => {
                            const firstCode = group.swatches?.[0]?.code || group.swatches?.[0]?.id || "";
                            setSelectedFabricGroupId(group.id);
                            setSelectedFabricCode(firstCode);
                          }}
                        >
                          {group.label}
                        </button>
                      ))}
                    </div>
                    <div className="fabric-grid fabric-grid--visual">
                      {(activeFabricGroup?.swatches || []).map((swatch) => {
                        const swatchCode = swatch.code || swatch.id;
                        const swatchLabel = swatch.label || swatchCode;
                        const swatchImage = absolutizeUrl(swatch.image_url || "", endpointOrigin);
                        const isChecked = swatchCode === (activeFabric?.code || activeFabric?.id);
                        const zoomPreview = swatchImage || productImage;

                        return (
                          <div key={swatch.id || swatchCode} className={`fabric-swatch fabric-swatch--visual ${isChecked ? "is-active" : ""}`}>
                            <button
                              type="button"
                              className="fabric-swatch-main"
                              onClick={() => selectFabricSwatch(swatchCode, swatchLabel)}
                            >
                              <span
                                className="fabric-swatch-color"
                                style={
                                  swatchImage
                                    ? { backgroundImage: `url(${swatchImage})`, backgroundSize: "cover", backgroundPosition: "center" }
                                    : { background: swatch.color || "#8ea0b7" }
                                }
                              />
                            </button>
                            <div className="fabric-swatch-actions">
                              <label className="fabric-swatch-checkbox">
                                <input
                                  type="checkbox"
                                  checked={isChecked}
                                  onChange={(event) => {
                                    if (event.target.checked) selectFabricSwatch(swatchCode, swatchLabel);
                                  }}
                                />
                                <span>Zaznacz</span>
                              </label>
                              <button
                                type="button"
                                className="config-option-zoom"
                                aria-label={`Powiększ: ${swatchLabel}`}
                                onClick={() => openImageZoom(zoomPreview, swatchLabel)}
                              >
                                🔍
                              </button>
                            </div>
                            <span className="fabric-swatch-code">{swatchCode}</span>
                          </div>
                        );
                      })}
                    </div>
                    <p className="configurator-field-note">Najpierw wybierz grupę materiału, potem konkretny kolor i zaznacz go checkboxem na zdjęciu.</p>
                    <p className="configurator-field-note">Po zaznaczeniu podgląd aktualizuje się od razu, a na dole pojawia się potwierdzenie wyboru.</p>
                  </article>
                ) : null}

                {activeStepId === "dimensions" ? (
                  <article className="catalog-card">
                    <h2>Krok {currentStep + 1} z {steps.length}: Wymiary</h2>
                    <p className="configurator-field-note">Dla systemu Best 1 podaj szerokość całkowitą, szerokość szyby i wysokość całkowitą.</p>

                    <div className="measurements-list">
                      {positions.map((position, idx) => {
                        const selectedBead =
                          glazingOptions.find((entry) => entry.id === position.glazingBeadId) || glazingOptions[0] || null;

                        return (
                          <article key={position.id} className="measurement-card">
                            <header>
                              <strong>Pozycja {idx + 1}</strong>
                              <div className="measurement-actions">
                                <button type="button" onClick={() => addSimilarPosition(position.id)}>
                                  Dodaj podobną
                                </button>
                                <button type="button" onClick={() => removePosition(position.id)}>
                                  Usuń
                                </button>
                              </div>
                            </header>

                            <div className="measurement-grid">
                              {visibleDimensionFields.map((field) => {
                                const value = toNumber(position.values[field.key], toNumber(field.default, 0));
                                const step = toNumber(field.step, 1);
                                const min = toNumber(field.min, 0);
                                const max = toNumber(field.max, 0);
                                const guide = getMeasurementGuide(field);
                                const helpKey = `${position.id}-${field.key}`;
                                const helpOpen = openFieldHelp === helpKey;

                                return (
                                  <label key={`${position.id}-${field.key}`} className="measurement-field">
                                    <span className="measurement-label-row">
                                      <span>{field.label}</span>
                                      {guide ? (
                                        <button
                                          type="button"
                                          className="measurement-help-btn"
                                          aria-label={`Pokaż pomoc: ${field.label}`}
                                          onClick={(event) => {
                                            event.preventDefault();
                                            setOpenFieldHelp((prev) => (prev === helpKey ? null : helpKey));
                                          }}
                                        >
                                          ?
                                        </button>
                                      ) : null}
                                    </span>
                                    <input
                                      type="number"
                                      min={min > 0 ? min : undefined}
                                      max={max > 0 ? max : undefined}
                                      step={step > 0 ? step : 1}
                                      value={value}
                                      onChange={(event) => updatePositionValue(position.id, field.key, event.target.value)}
                                    />
                                    {guide && helpOpen ? (
                                      <div className="measurement-help-popover">
                                        <img src={guide.image} alt={guide.title} />
                                        <div>
                                          <strong>{guide.title}</strong>
                                          <p>{guide.text}</p>
                                        </div>
                                      </div>
                                    ) : null}
                                  </label>
                                );
                              })}

                              {controlSideOptions.length > 0 ? (
                                <label>
                                  Strona sterowania
                                  <select
                                    value={position.controlSideId}
                                    onChange={(event) => updatePositionControlSide(position.id, event.target.value)}
                                  >
                                    {controlSideOptions.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}

                              {glazingOptions.length > 0 ? (
                                <label>
                                  Rodzaj listwy przyszybowej
                                  <select
                                    value={position.glazingBeadId}
                                    onChange={(event) => updatePositionGlazing(position.id, event.target.value)}
                                  >
                                    {glazingOptions.map((option) => (
                                      <option key={option.id} value={option.id}>
                                        {option.label}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : null}

                              {selectedBead ? (
                                <div className="measurement-tooltip">
                                  <img
                                    src={absolutizeUrl(selectedBead.image_url || "", endpointOrigin)}
                                    alt={selectedBead.label}
                                  />
                                  <div>
                                    <strong>{selectedBead.label}</strong>
                                    <p>{selectedBead.note || "Informacja o typie listwy przyszybowej."}</p>
                                  </div>
                                </div>
                              ) : null}
                            </div>
                          </article>
                        );
                      })}
                    </div>

                    <div className="measurement-footer">
                      <button type="button" onClick={addEmptyPosition}>
                        Dodaj nową pozycję
                      </button>
                    </div>
                  </article>
                ) : null}

                <article className="catalog-card">
                  <div className="configurator-nav">
                    {currentStep > 0 ? (
                      <button type="button" className="config-nav-prev" onClick={goPrevStep}>
                        Wstecz
                      </button>
                    ) : <span className="config-nav-spacer" />} 
                    {currentStep < steps.length - 1 ? (
                      <button type="button" className="config-nav-next" onClick={goNextStep} disabled={!canProceed}>
                        Dalej
                      </button>
                    ) : (
                      <button type="button" className="config-nav-next" disabled={!areDimensionsValid}>
                        Dodaj do koszyka (demo)
                      </button>
                    )}
                  </div>
                </article>
              </div>
            <aside className="configurator-preview-panel">
              <article className="catalog-card">
                <h3>Podgląd na żywo</h3>
                <p>
                  Cena liczona jest z tabeli: <strong>{activePricingTable?.name || "fallback"}</strong>.
                </p>

                <div className="config-preview-mockup" style={{ backgroundImage: `url(${productImage})` }}>
                  {renderPreviewWindow()}
                </div>

                <div className="config-summary-grid">
                  <div>
                    <span>Osprzęt</span>
                    <strong>{selectedHardware?.label || "-"}</strong>
                  </div>
                  <div>
                    <span>Tkanina</span>
                    <strong>{activeFabric?.code || activeFabric?.id || "-"}</strong>
                  </div>
                  <div>
                    <span>Ilość pozycji</span>
                    <strong>{positions.length}</strong>
                  </div>
                  <div>
                    <span>Sztuk łącznie</span>
                    <strong>{totalItems}</strong>
                  </div>
                  <div>
                    <span>Wybrany cennik</span>
                    <strong>{activePricingTable?.id || "fallback"}</strong>
                  </div>
                  <div>
                    <span>Cena 1. pozycji</span>
                    <strong>
                      {(rowEstimates[0]?.unitPrice || 0).toLocaleString("pl-PL", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      zł
                    </strong>
                  </div>
                  <div className="config-summary-total">
                    <span>Szacunkowo od</span>
                    <strong>
                      {estimatedPriceLabel}{" "}
                      zł
                    </strong>
                  </div>
                </div>

                <div className="configurator-links">
                  <Link href={`/produkt/${productSlug}`}>Wróć do karty produktu</Link>
                  <Link href={categoryHref}>Wróć do kategorii</Link>
                </div>
              </article>
            </aside>
          </section>

          {mobilePreviewOpen ? (
            <div className="config-mobile-preview-modal" role="dialog" aria-modal="true" aria-label="Powiększony podgląd" onClick={() => setMobilePreviewOpen(false)}>
              <div className="config-mobile-preview-shell" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="config-mobile-preview-close"
                  onClick={() => setMobilePreviewOpen(false)}
                  aria-label="Zamknij podgląd"
                >
                  ×
                </button>
                <div className="config-preview-mockup config-preview-mockup--modal" style={{ backgroundImage: `url(${productImage})` }}>
                  {renderPreviewWindow()}
                </div>
              </div>
            </div>
          ) : null}

          {zoomImage ? (
            <div className="config-option-preview-modal" role="dialog" aria-modal="true" aria-label={zoomImage.title} onClick={() => setZoomImage(null)}>
              <div className="config-option-preview-shell" onClick={(event) => event.stopPropagation()}>
                <button
                  type="button"
                  className="config-option-preview-close"
                  onClick={() => setZoomImage(null)}
                  aria-label="Zamknij podgląd opcji"
                >
                  ×
                </button>
                <img src={zoomImage.url} alt={zoomImage.title} className="config-option-preview-image" />
                <p>{zoomImage.title}</p>
              </div>
            </div>
          ) : null}

          {selectionToast ? (
            <div className="config-selection-toast" role="status" aria-live="polite">
              {selectionToast}
            </div>
          ) : null}
          </>
        )}
      </main>
    </div>
  );
}
