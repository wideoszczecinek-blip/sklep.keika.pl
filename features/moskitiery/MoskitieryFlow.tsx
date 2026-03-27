"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import {
  fetchShopConfiguratorConfig,
  pingShopPresence,
  resumeShopQuote,
  saveShopQuote,
} from "./api";
import styles from "./moskitiery.module.css";
import type {
  AllegroConfiguratorConfig,
  ChoiceStep,
  DimensionsStep,
  ProductEntry,
  ProductStep,
  QuoteAnalytics,
  QuoteAnalyticsEvent,
  QuoteDraft,
  QuotePosition,
  QuoteSummaryRow,
  SavedQuote,
  StoredQuoteLink,
} from "./types";

const STORAGE_KEY_LAST_QUOTE = "keika-shop:moskitiery:last-quote";
const STORAGE_KEY_SESSION = "keika-shop:moskitiery:session-token";
const PRESENCE_POLL_MS = 45_000;

type DraftDimensions = {
  width: string;
  height: string;
};

type MoskitieryFlowProps = {
  initialQuoteCode?: string;
  initialResumeToken?: string;
  initialProductSlug?: string;
  entryPath?: string;
};

function safeText(value: unknown) {
  return String(value ?? "").trim();
}

function parseMoney(value: string) {
  const parsed = Number.parseFloat(String(value || "").replace(",", "."));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoney(amount: number, currency = "PLN") {
  try {
    return new Intl.NumberFormat("pl-PL", {
      style: "currency",
      currency,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${amount.toFixed(2)} ${currency}`;
  }
}

function formatDateTime(value: string) {
  if (!value) {
    return "—";
  }

  const normalized = value.includes("T") ? value : value.replace(" ", "T");
  const date = new Date(normalized);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("pl-PL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function generateToken(prefix: string) {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`;
}

function normalizeHexColor(value: string, fallback = "#1F2937") {
  const normalized = safeText(value).toUpperCase();
  return /^#[0-9A-F]{6}$/.test(normalized) ? normalized : fallback;
}

function hexToRgb(hex: string) {
  const normalized = normalizeHexColor(hex);
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgba(hex: string, alpha: number) {
  const rgb = hexToRgb(hex);
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}

function buildMaskedPreviewStyle(
  imageUrl: string,
  accentColor: string,
  mode: "solid" | "mesh",
) {
  const normalizedColor = normalizeHexColor(accentColor, "#CBD5E1");
  const gradient =
    mode === "mesh"
      ? `linear-gradient(145deg, ${rgba(normalizedColor, 0.16)} 0%, ${rgba(
          normalizedColor,
          0.9,
        )} 55%, ${rgba(normalizedColor, 0.34)} 100%)`
      : `linear-gradient(145deg, ${rgba(normalizedColor, 0.95)} 0%, ${rgba(
          normalizedColor,
          0.72,
        )} 100%)`;

  return {
    backgroundImage: gradient,
    maskImage: `url(${imageUrl})`,
    maskRepeat: "no-repeat",
    maskPosition: "center",
    maskSize: "contain",
    WebkitMaskImage: `url(${imageUrl})`,
    WebkitMaskRepeat: "no-repeat",
    WebkitMaskPosition: "center",
    WebkitMaskSize: "contain",
  } as const;
}

function formatStepAnswerValue(step: ChoiceStep, selectedValue: string) {
  const option = step.options.find((candidate) => candidate.value === selectedValue);
  return option?.label ?? selectedValue;
}

function calculatePurchaseUnits(product: ProductEntry, width: number, height: number) {
  const pricing = product.pricing_calculation;

  if (pricing.mode !== "perimeter_started_interval") {
    return Math.max(pricing.minimum_units || 1, 1);
  }

  const interval = Math.max(1, pricing.interval_mm || 1);
  const multiplier = Math.max(0.0001, pricing.perimeter_multiplier || 1);
  const base = Math.max(0, width + height) * multiplier;

  return Math.max(pricing.minimum_units || 1, Math.ceil(base / interval));
}

function findPriceBreakpointIndex(breakpoints: number[], value: number) {
  if (!breakpoints.length) {
    return 0;
  }

  const index = breakpoints.findIndex((entry) => value <= entry);
  return index === -1 ? Math.max(0, breakpoints.length - 1) : index;
}

function sumSelectedOptionDeltas(
  product: ProductEntry,
  selectedAnswers: Record<string, string>,
) {
  return product.configurator.steps.reduce((sum, step) => {
    if (step.type !== "choice") {
      return sum;
    }

    const selectedValue = selectedAnswers[step.key];
    if (!selectedValue) {
      return sum;
    }

    const option = step.options.find((candidate) => candidate.value === selectedValue);
    return sum + (option?.price_delta ?? 0);
  }, 0);
}

function resolveDimensionMatrixUnitPrice(
  product: ProductEntry,
  selectedAnswers: Record<string, string>,
  width: number,
  height: number,
) {
  const pricing = product.pricing_calculation;
  if (pricing.mode !== "dimension_price_matrix") {
    return null;
  }

  const tables = Array.isArray(pricing.tables) ? pricing.tables : [];
  if (!tables.length) {
    return null;
  }

  const hardwareValue = pricing.hardware_step_key
    ? safeText(selectedAnswers[pricing.hardware_step_key])
    : "";
  const fabricValue = pricing.fabric_step_key
    ? safeText(selectedAnswers[pricing.fabric_step_key])
    : "";

  const selectedTable =
    tables.find((table) => {
      const hardwareOk =
        !table.hardware_ids.length ||
        (hardwareValue !== "" && table.hardware_ids.includes(hardwareValue));
      const fabricOk =
        !table.fabric_group_ids.length ||
        (fabricValue !== "" && table.fabric_group_ids.includes(fabricValue));
      return hardwareOk && fabricOk;
    }) ?? tables[0];

  if (!selectedTable) {
    return null;
  }

  const rowIndex = findPriceBreakpointIndex(selectedTable.height_breakpoints, height);
  const colIndex = findPriceBreakpointIndex(selectedTable.width_breakpoints, width);
  const row =
    selectedTable.prices[rowIndex] ??
    selectedTable.prices[selectedTable.prices.length - 1] ??
    [];
  const rawValue = row[colIndex] ?? row[row.length - 1];

  return typeof rawValue === "number" && Number.isFinite(rawValue)
    ? rawValue
    : null;
}

function calculatePositionPricing(
  product: ProductEntry,
  selectedAnswers: Record<string, string>,
  width: number,
  height: number,
  quantity: number,
) {
  const safeQuantity = Math.max(1, Number.isFinite(quantity) ? quantity : 1);
  const optionDelta = sumSelectedOptionDeltas(product, selectedAnswers);
  const matrixUnitPrice = resolveDimensionMatrixUnitPrice(
    product,
    selectedAnswers,
    width,
    height,
  );

  if (matrixUnitPrice !== null) {
    const unitPrice = Math.max(0, matrixUnitPrice + optionDelta);
    return {
      purchaseUnits: safeQuantity,
      totalAmountRaw: unitPrice * safeQuantity,
    };
  }

  const purchaseUnitsPerItem = calculatePurchaseUnits(product, width, height);
  const purchaseUnits = purchaseUnitsPerItem * safeQuantity;
  const unitAmount = Math.max(0, parseMoney(product.display_price_amount) + optionDelta);

  return {
    purchaseUnits,
    totalAmountRaw: unitAmount * purchaseUnits,
  };
}

function buildQuoteSummaryRows(
  product: ProductEntry,
  steps: ProductStep[],
  selectedAnswers: Record<string, string>,
  dimensions: DraftDimensions,
  quantity: number,
  purchaseUnits: number,
) {
  const rows: QuoteSummaryRow[] = [];

  steps.forEach((step) => {
    if (step.type === "choice") {
      const value = selectedAnswers[step.key];
      if (value) {
        rows.push({
          label: step.title,
          value: formatStepAnswerValue(step, value),
          note: step.subtitle,
        });
      }
    }
  });

  if (dimensions.width && dimensions.height) {
    rows.push({
      label: "Wymiary",
      value: `${dimensions.width} × ${dimensions.height} mm`,
      note: quantity > 1 ? `${quantity} szt.` : "1 szt.",
    });
  }

  rows.push({
    label: "Jednostki do zakupu",
    value: `${purchaseUnits} ${product.price_unit.label}`,
    note: product.price_unit.description,
  });

  return rows;
}

function buildPositionSummary(rows: QuoteSummaryRow[]) {
  return rows
    .map((row) => {
      const tail = row.note ? ` — ${row.note}` : "";
      return `${row.label}: ${row.value}${tail}`;
    })
    .join("\n");
}

function buildQuotePosition(
  product: ProductEntry,
  selectedAnswers: Record<string, string>,
  dimensions: DraftDimensions,
  quantity: number,
) {
  const width = Number.parseInt(dimensions.width, 10);
  const height = Number.parseInt(dimensions.height, 10);
  const safeWidth = Number.isFinite(width) ? width : 0;
  const safeHeight = Number.isFinite(height) ? height : 0;
  const safeQuantity = Math.max(1, Number.isFinite(quantity) ? quantity : 1);
  const pricing = calculatePositionPricing(
    product,
    selectedAnswers,
    safeWidth,
    safeHeight,
    safeQuantity,
  );
  const purchaseUnits = pricing.purchaseUnits;
  const totalAmountRaw = pricing.totalAmountRaw;
  const rows = buildQuoteSummaryRows(
    product,
    product.configurator.steps,
    selectedAnswers,
    dimensions,
    safeQuantity,
    purchaseUnits,
  );

  const dimensionsStep =
    product.configurator.steps.find(
      (step): step is DimensionsStep => step.type === "dimensions",
    ) ?? null;

  return {
    id: generateToken("position"),
    product_slug: product.slug,
    product_label: product.label,
    quantity: safeQuantity,
    purchase_units: purchaseUnits,
    total_amount: totalAmountRaw > 0 ? totalAmountRaw.toFixed(2) : null,
    currency: product.display_price_currency || "PLN",
    summary: buildPositionSummary(rows),
    summary_rows: rows,
    choice_answers: selectedAnswers,
    dimensions_answers: dimensionsStep
      ? {
          [dimensionsStep.key]: {
            width: String(safeWidth || ""),
            height: String(safeHeight || ""),
          },
        }
      : {},
  } satisfies QuotePosition;
}

function hasDraftData(
  selectedAnswers: Record<string, string>,
  dimensions: DraftDimensions,
  quantity: number,
) {
  return (
    Object.keys(selectedAnswers).length > 0 ||
    safeText(dimensions.width) !== "" ||
    safeText(dimensions.height) !== "" ||
    quantity > 1
  );
}

function buildDraftPayload(
  product: ProductEntry | null,
  selectedAnswers: Record<string, string>,
  dimensions: DraftDimensions,
  quantity: number,
): QuoteDraft | null {
  if (!product || !hasDraftData(selectedAnswers, dimensions, quantity)) {
    return null;
  }

  const dimensionsStep =
    product.configurator.steps.find(
      (step): step is DimensionsStep => step.type === "dimensions",
    ) ?? null;

  const purchaseUnits = buildQuotePosition(product, selectedAnswers, dimensions, quantity)
    .purchase_units;
  const rows = buildQuoteSummaryRows(
    product,
    product.configurator.steps,
    selectedAnswers,
    dimensions,
    quantity,
    purchaseUnits ?? 0,
  );

  return {
    quantity,
    summary_rows: rows,
    choice_answers: selectedAnswers,
    dimensions_answers: dimensionsStep
      ? {
          [dimensionsStep.key]: {
            width: safeText(dimensions.width),
            height: safeText(dimensions.height),
          },
        }
      : {},
  };
}

function getClientContext() {
  if (typeof window === "undefined") {
    return {};
  }

  return {
    viewport_width: window.innerWidth,
    viewport_height: window.innerHeight,
    screen_width: window.screen.width,
    screen_height: window.screen.height,
    is_touch:
      typeof window.matchMedia === "function"
        ? window.matchMedia("(pointer: coarse)").matches
        : false,
    language: navigator.language || "pl-PL",
    platform: navigator.platform || "",
    timezone:
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Europe/Warsaw",
    landing_url: window.location.href,
    referrer: document.referrer || "",
  };
}

function getQuoteLink(
  quote: SavedQuote | null,
  resumeToken: string,
  fallbackProductSlug = "",
  entryPath = "",
) {
  if (typeof window === "undefined" || !quote) {
    return "";
  }

  const productSlug = safeText(quote.product_slug) || safeText(fallbackProductSlug);
  const normalizedEntryPath = safeText(entryPath);
  const url = normalizedEntryPath
    ? new URL(
        normalizedEntryPath.startsWith("/")
          ? normalizedEntryPath
          : `/${normalizedEntryPath}`,
        window.location.origin,
      )
    : new URL(
        `/konfigurator/${encodeURIComponent(productSlug || "moskitiery-ramkowe")}`,
        window.location.origin,
      );

  if (normalizedEntryPath && productSlug) {
    url.searchParams.set("product", productSlug);
  }

  const token = safeText(quote.resume_token ?? resumeToken);
  if (token) {
    url.searchParams.set("resume_token", token);
  } else {
    url.searchParams.set("quote_code", quote.quote_code);
  }

  return url.toString();
}

function getStoredQuoteLink() {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = window.localStorage.getItem(STORAGE_KEY_LAST_QUOTE);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as StoredQuoteLink;
    if (!parsed.quote_code || !parsed.resume_token) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function saveStoredQuoteLink(value: StoredQuoteLink) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY_LAST_QUOTE, JSON.stringify(value));
}

function getOrCreateSessionToken() {
  if (typeof window === "undefined") {
    return generateToken("session");
  }

  const existing = window.localStorage.getItem(STORAGE_KEY_SESSION);
  if (existing) {
    return existing;
  }

  const created = generateToken("session");
  window.localStorage.setItem(STORAGE_KEY_SESSION, created);
  return created;
}

export default function MoskitieryFlow({
  initialQuoteCode = "",
  initialResumeToken = "",
  initialProductSlug = "",
  entryPath = "",
}: MoskitieryFlowProps) {
  const [config, setConfig] = useState<AllegroConfiguratorConfig | null>(null);
  const [selectedProductSlug, setSelectedProductSlug] = useState("");
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [dimensions, setDimensions] = useState<DraftDimensions>({
    width: "",
    height: "",
  });
  const [quantity, setQuantity] = useState(1);
  const [positions, setPositions] = useState<QuotePosition[]>([]);
  const [editingPositionId, setEditingPositionId] = useState("");
  const [quote, setQuote] = useState<SavedQuote | null>(null);
  const [resumeToken, setResumeToken] = useState("");
  const [storedQuoteLink, setStoredQuoteLink] = useState<StoredQuoteLink | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [resumeLoading, setResumeLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [statusMessage, setStatusMessage] = useState("");
  const [sharePanelOpen, setSharePanelOpen] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [onlineCount, setOnlineCount] = useState(0);
  const [activeSlideIndex, setActiveSlideIndex] = useState(0);
  const [interactionCount, setInteractionCount] = useState(0);
  const [clickCount, setClickCount] = useState(0);
  const [isDirty, setIsDirty] = useState(false);

  const sessionTokenRef = useRef("");
  const sessionStartedMsRef = useRef(Date.now());
  const sessionStartedAtRef = useRef(new Date().toISOString());
  const sessionsCountRef = useRef(1);
  const analyticsEventsRef = useRef<QuoteAnalyticsEvent[]>([]);
  const restoreBannerShownRef = useRef(false);
  const initialResumeHandledRef = useRef(false);

  const moskitieryCategory = useMemo(() => {
    if (!config) {
      return null;
    }

    return (
      config.catalog.categories.find((category) => category.slug === "moskitiery") ??
      config.catalog.categories[0] ??
      null
    );
  }, [config]);

  const products = useMemo(() => moskitieryCategory?.products ?? [], [moskitieryCategory]);

  const selectedProduct = useMemo(() => {
    if (!products.length) {
      return null;
    }

    return (
      products.find((product) => product.slug === selectedProductSlug) ??
      products[0] ??
      null
    );
  }, [products, selectedProductSlug]);

  const choiceSteps = useMemo(
    () =>
      (selectedProduct?.configurator.steps.filter(
        (step): step is ChoiceStep => step.type === "choice",
      ) ?? []),
    [selectedProduct],
  );

  const dimensionsStep = useMemo(
    () =>
      selectedProduct?.configurator.steps.find(
        (step): step is DimensionsStep => step.type === "dimensions",
      ) ?? null,
    [selectedProduct],
  );

  const currentUnitPrice = selectedProduct
    ? parseMoney(selectedProduct.display_price_amount)
    : 0;

  const areChoiceStepsComplete = choiceSteps.every(
    (step) => safeText(selectedAnswers[step.key]) !== "",
  );

  const numericWidth = Number.parseInt(dimensions.width, 10);
  const numericHeight = Number.parseInt(dimensions.height, 10);
  const hasDimensions =
    Number.isFinite(numericWidth) &&
    numericWidth > 0 &&
    Number.isFinite(numericHeight) &&
    numericHeight > 0;

  const draftPosition = useMemo(() => {
    if (!selectedProduct || !areChoiceStepsComplete || !hasDimensions) {
      return null;
    }

    return buildQuotePosition(selectedProduct, selectedAnswers, dimensions, quantity);
  }, [
    areChoiceStepsComplete,
    dimensions,
    hasDimensions,
    quantity,
    selectedAnswers,
    selectedProduct,
  ]);

  const totalUnits = useMemo(
    () =>
      positions.reduce(
        (sum, position) => sum + (position.purchase_units ?? 0),
        draftPosition?.purchase_units ?? 0,
      ),
    [draftPosition, positions],
  );

  const totalItems = useMemo(
    () =>
      positions.reduce((sum, position) => sum + position.quantity, draftPosition?.quantity ?? 0),
    [draftPosition, positions],
  );

  const totalAmount = useMemo(() => {
    const savedPositionsAmount = positions.reduce((sum, position) => {
      return sum + parseMoney(position.total_amount ?? "0");
    }, 0);

    return savedPositionsAmount + parseMoney(draftPosition?.total_amount ?? "0");
  }, [draftPosition, positions]);

  const activeSlide =
    config?.homepage.carousel[activeSlideIndex % (config?.homepage.carousel.length || 1)] ??
    null;
  const activeBackground =
    config?.homepage.backgrounds[
      activeSlideIndex % (config?.homepage.backgrounds.length || 1)
    ] ?? null;

  const previewLayers = useMemo(() => {
    if (!selectedProduct) {
      return [];
    }

    return choiceSteps
      .map((step) => {
        const selectedValue = selectedAnswers[step.key];
        if (!selectedValue) {
          return null;
        }

        const selectedOption = step.options.find(
          (option) => option.value === selectedValue,
        );

        if (!selectedOption) {
          return null;
        }

        const layerUrl = safeText(step.preview_layer_url || selectedOption.preview_layer_url);
        if (!layerUrl) {
          return null;
        }

        return {
          id: `${step.id}-${selectedOption.id}`,
          layerUrl,
          accentColor: selectedOption.accent_color || "#CBD5E1",
          mode: step.preview_render_mode,
        };
      })
      .filter(Boolean) as Array<{
      id: string;
      layerUrl: string;
      accentColor: string;
      mode: "solid" | "mesh";
    }>;
  }, [choiceSteps, selectedAnswers, selectedProduct]);

  function appendEvent(
    type: string,
    label: string,
    meta: QuoteAnalyticsEvent["meta"] = {},
  ) {
    const nextEvent: QuoteAnalyticsEvent = {
      type,
      label,
      at: new Date().toISOString(),
      elapsed_ms: Date.now() - sessionStartedMsRef.current,
      meta,
    };

    analyticsEventsRef.current = [...analyticsEventsRef.current.slice(-79), nextEvent];
  }

  function registerInteraction(
    type: string,
    label: string,
    meta: QuoteAnalyticsEvent["meta"] = {},
  ) {
    setInteractionCount((current) => current + 1);
    setIsDirty(true);
    appendEvent(type, label, meta);
  }

  function registerClick(
    type: string,
    label: string,
    meta: QuoteAnalyticsEvent["meta"] = {},
  ) {
    setClickCount((current) => current + 1);
    appendEvent(type, label, meta);
  }

  function resetDraft() {
    setSelectedAnswers({});
    setDimensions({ width: "", height: "" });
    setQuantity(1);
    setEditingPositionId("");
  }

  function hydrateDraftFromPosition(position: QuotePosition) {
    setSelectedAnswers(position.choice_answers ?? {});
    const firstDimensions = Object.values(position.dimensions_answers ?? {})[0] ?? {
      width: "",
      height: "",
    };
    setDimensions({
      width: safeText(firstDimensions.width),
      height: safeText(firstDimensions.height),
    });
    setQuantity(Math.max(1, position.quantity || 1));
    setEditingPositionId(position.id);
  }

  function applySavedQuote(savedQuote: SavedQuote) {
    setQuote(savedQuote);
    setResumeToken(safeText(savedQuote.resume_token));
    setSharePanelOpen(false);
    setShowQr(false);
    setIsDirty(false);

    const nextPositions = savedQuote.payload?.positions ?? [];
    setPositions(nextPositions);

    const nextProductSlug =
      safeText(savedQuote.product_slug) ||
      safeText(nextPositions[0]?.product_slug) ||
      selectedProductSlug;
    if (nextProductSlug) {
      setSelectedProductSlug(nextProductSlug);
    }

    const nextDraft = savedQuote.payload?.draft ?? null;
    if (nextDraft) {
      setSelectedAnswers(nextDraft.choice_answers ?? {});
      const firstDimensions = Object.values(nextDraft.dimensions_answers ?? {})[0] ?? {
        width: "",
        height: "",
      };
      setDimensions({
        width: safeText(firstDimensions.width),
        height: safeText(firstDimensions.height),
      });
      setQuantity(Math.max(1, nextDraft.quantity || 1));
      setEditingPositionId("");
    } else if (nextPositions[0]) {
      hydrateDraftFromPosition(nextPositions[0]);
    } else {
      resetDraft();
    }

    const knownSessions = savedQuote.analytics?.sessions_count ?? 0;
    sessionsCountRef.current = Math.max(1, knownSessions + 1);

    if (savedQuote.resume_token) {
      const storedLink: StoredQuoteLink = {
        quote_code: savedQuote.quote_code,
        resume_token: savedQuote.resume_token,
        product_slug: savedQuote.product_slug,
        product_label: savedQuote.product_label,
        saved_at: new Date().toISOString(),
      };
      saveStoredQuoteLink(storedLink);
      setStoredQuoteLink(storedLink);
    }
  }

  function buildAnalyticsPayload(): QuoteAnalytics {
    const elapsedSeconds = Math.max(
      0,
      Math.round((Date.now() - sessionStartedMsRef.current) / 1000),
    );

    return {
      session_started_at: sessionStartedAtRef.current,
      session_duration_seconds: elapsedSeconds,
      total_duration_seconds: elapsedSeconds,
      interaction_count: interactionCount,
      total_interaction_count: interactionCount,
      click_count: clickCount,
      total_click_count: clickCount,
      sessions_count: sessionsCountRef.current,
      events: analyticsEventsRef.current,
    };
  }

  async function handleResume(params: {
    quoteCode?: string;
    resumeToken?: string;
    fromStorage?: boolean;
  }) {
    const quoteCode = safeText(params.quoteCode);
    const resumeTokenValue = safeText(params.resumeToken);

    if (!quoteCode && !resumeTokenValue) {
      return;
    }

    try {
      setResumeLoading(true);
      setErrorMessage("");
      const response = await resumeShopQuote({
        quoteCode,
        resumeToken: resumeTokenValue,
      });

      if (!response.quote) {
        setStatusMessage("Nie znaleziono zapisanej wyceny do wznowienia.");
        return;
      }

      if (params.fromStorage) {
        registerClick("resume_auto_restore", "Wznowiono ostatnią zapisaną wycenę", {
          source: "local_storage",
        });
      }

      applySavedQuote(response.quote);
      setStatusMessage(`Wznowiono wycenę ${response.quote.quote_code}.`);
    } catch (error) {
      setErrorMessage("Nie udało się wznowić zapisanej wyceny.");
      console.error(error);
    } finally {
      setResumeLoading(false);
    }
  }

  async function handleSaveQuote() {
    if (!selectedProduct || positions.length === 0) {
      setStatusMessage("Dodaj przynajmniej jedną pozycję, zanim zapiszesz wycenę.");
      return;
    }

    try {
      setSaving(true);
      setErrorMessage("");
      setStatusMessage("Zapisuję wycenę do CRM…");

      const payload = {
        quote_code: quote?.quote_code ?? "",
        resume_token: quote?.resume_token ?? resumeToken,
        product_slug: selectedProduct.slug,
        product_label: selectedProduct.label,
        offer_id: selectedProduct.offer_id,
        offer_url: "",
        currency: selectedProduct.display_price_currency || "PLN",
        total_amount: totalAmount > 0 ? totalAmount.toFixed(2) : null,
        items_count: positions.reduce((sum, position) => sum + position.quantity, 0),
        units_count: positions.reduce(
          (sum, position) => sum + (position.purchase_units ?? 0),
          0,
        ),
        position_count: positions.length,
        summary_text: positions.map((position) => position.summary).join("\n\n"),
        positions,
        draft: buildDraftPayload(selectedProduct, selectedAnswers, dimensions, quantity),
        analytics: buildAnalyticsPayload(),
        client_context: getClientContext(),
      };

      const response = await saveShopQuote(payload);
      setClickCount((current) => current + 1);
      appendEvent("save_quote", "Zapisano wycenę w CRM", {
        product_slug: selectedProduct.slug,
        quote_code: response.quote.quote_code,
      });
      applySavedQuote(response.quote);
      setStatusMessage(`Zapisano wycenę ${response.quote.quote_code}.`);
    } catch (error) {
      setErrorMessage("Nie udało się zapisać wyceny.");
      console.error(error);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopyQuoteLink() {
    if (!quote) {
      return;
    }

    const quoteLink = getQuoteLink(
      quote,
      resumeToken,
      selectedProduct?.slug ?? initialProductSlug,
      entryPath,
    );
    if (!quoteLink) {
      return;
    }

    try {
      await navigator.clipboard.writeText(quoteLink);
      registerClick("copy_quote_link", "Skopiowano link do wyceny", {
        quote_code: quote.quote_code,
      });
      setStatusMessage("Link do wyceny został skopiowany.");
    } catch (error) {
      setErrorMessage("Nie udało się skopiować linku.");
      console.error(error);
    }
  }

  async function handleNativeShare() {
    if (!quote) {
      return;
    }

    const quoteLink = getQuoteLink(
      quote,
      resumeToken,
      selectedProduct?.slug ?? initialProductSlug,
      entryPath,
    );
    if (!quoteLink || typeof navigator.share !== "function") {
      return;
    }

    try {
      await navigator.share({
        title: `Wycena ${quote.quote_code}`,
        text: `Wznów konfigurację moskitiery KEIKA pod kodem ${quote.quote_code}.`,
        url: quoteLink,
      });
      registerClick("share_quote_link", "Udostępniono link systemowo", {
        quote_code: quote.quote_code,
      });
      setStatusMessage("Link do wyceny został udostępniony.");
    } catch (error) {
      if ((error as DOMException)?.name !== "AbortError") {
        setErrorMessage("Nie udało się udostępnić linku.");
        console.error(error);
      }
    }
  }

  function handleSaveLocally() {
    if (!quote || !quote.resume_token) {
      return;
    }

    const nextStoredQuote: StoredQuoteLink = {
      quote_code: quote.quote_code,
      resume_token: quote.resume_token,
      product_slug: quote.product_slug,
      product_label: quote.product_label,
      saved_at: new Date().toISOString(),
    };
    saveStoredQuoteLink(nextStoredQuote);
    setStoredQuoteLink(nextStoredQuote);
    setStatusMessage("Wycena została zapisana lokalnie na tym urządzeniu.");
  }

  function openSharePanel() {
    setSharePanelOpen((current) => {
      const next = !current;
      if (next) {
        appendEvent("open_save_share", "Otwarto panel zapisu i udostępniania", {
          quote_code: quote?.quote_code ?? "",
        });
      }
      return next;
    });
  }

  function toggleQr() {
    setShowQr((current) => {
      const next = !current;
      if (next) {
        registerClick("show_quote_qr", "Pokazano kod QR do wyceny", {
          quote_code: quote?.quote_code ?? "",
        });
      }
      return next;
    });
  }

  function updateProduct(nextProduct: ProductEntry) {
    if (selectedProduct?.slug === nextProduct.slug) {
      return;
    }

    const shouldReset =
      positions.length > 0 || hasDraftData(selectedAnswers, dimensions, quantity);

    if (
      shouldReset &&
      typeof window !== "undefined" &&
      !window.confirm(
        "Zmiana produktu wyczyści bieżące pozycje i szkic wyceny. Czy kontynuować?",
      )
    ) {
      return;
    }

    setSelectedProductSlug(nextProduct.slug);
    setPositions([]);
    setQuote(null);
    setResumeToken("");
    setSharePanelOpen(false);
    setShowQr(false);
    resetDraft();
    setStatusMessage(`Wybrano produkt: ${nextProduct.label}.`);
    registerClick("select_product", "Zmieniono aktywny produkt", {
      product_slug: nextProduct.slug,
    });
  }

  function addOrReplacePosition() {
    if (!draftPosition) {
      setStatusMessage("Uzupełnij wybory i wymiary, aby dodać pozycję.");
      return;
    }

    setPositions((current) => {
      if (!editingPositionId) {
        return [...current, draftPosition];
      }

      return current.map((position) =>
        position.id === editingPositionId
          ? { ...draftPosition, id: editingPositionId }
          : position,
      );
    });

    registerClick(
      editingPositionId ? "edit_position" : "add_position",
      editingPositionId
        ? "Zaktualizowano pozycję wyceny"
        : "Dodano pozycję do wyceny",
      {
        product_slug: selectedProduct?.slug ?? "",
      },
    );

    setQuote(null);
    setIsDirty(true);
    setStatusMessage(
      editingPositionId
        ? "Pozycja została zaktualizowana."
        : "Pozycja została dodana do wyceny.",
    );
    resetDraft();
  }

  function removePosition(positionId: string) {
    setPositions((current) => current.filter((position) => position.id !== positionId));
    setQuote(null);
    setIsDirty(true);
    registerClick("remove_position", "Usunięto pozycję z wyceny");
  }

  useEffect(() => {
    let cancelled = false;

    async function loadConfig() {
      try {
        setLoading(true);
        setErrorMessage("");
        const response = await fetchShopConfiguratorConfig();

        if (cancelled) {
          return;
        }

        setConfig(response.config);
        const firstCategory =
          response.config.catalog.categories.find(
            (category) => category.slug === "moskitiery",
          ) ?? response.config.catalog.categories[0];
        const firstProduct = firstCategory?.products[0] ?? null;
        const requestedProductSlug = safeText(initialProductSlug);
        const initialProduct =
          firstCategory?.products.find(
            (product) => product.slug === requestedProductSlug,
          ) ?? firstProduct;
        if (initialProduct) {
          setSelectedProductSlug((current) => current || initialProduct.slug);
        }

        sessionTokenRef.current = getOrCreateSessionToken();
        setStoredQuoteLink(getStoredQuoteLink());
      } catch (error) {
        setErrorMessage("Nie udało się pobrać konfiguracji moskitier.");
        console.error(error);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadConfig();

    return () => {
      cancelled = true;
    };
  }, [initialProductSlug]);

  useEffect(() => {
    if (!config?.homepage.carousel.length) {
      return;
    }

    const currentSlide =
      config.homepage.carousel[
        activeSlideIndex % Math.max(1, config.homepage.carousel.length)
      ];

    const timeout = window.setTimeout(() => {
      setActiveSlideIndex((current) => current + 1);
    }, Math.max(3200, currentSlide.duration_ms || 5000));

    return () => {
      window.clearTimeout(timeout);
    };
  }, [activeSlideIndex, config]);

  useEffect(() => {
    if (!config || initialResumeHandledRef.current) {
      return;
    }

    const queryResumeToken = safeText(initialResumeToken);
    const queryQuoteCode = safeText(initialQuoteCode);
    initialResumeHandledRef.current = true;

    if (queryResumeToken || queryQuoteCode) {
      void handleResume({
        quoteCode: queryQuoteCode,
        resumeToken: queryResumeToken,
      });
    }
    // Pierwsze wznowienie ma być wykonane tylko raz po załadowaniu konfiguracji.
    // Zależymy świadomie od początkowych wartości z serwerowego page.tsx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, initialQuoteCode, initialResumeToken]);

  useEffect(() => {
    if (!storedQuoteLink || restoreBannerShownRef.current) {
      return;
    }

    restoreBannerShownRef.current = true;
    appendEvent("resume_prompt_shown", "Pokazano możliwość wznowienia wyceny", {
      product_slug: storedQuoteLink.product_slug,
    });
  }, [storedQuoteLink]);

  useEffect(() => {
    if (!selectedProduct || !sessionTokenRef.current) {
      return;
    }

    const activeProduct = selectedProduct;
    let cancelled = false;

    async function touchPresence() {
      try {
        const response = await pingShopPresence({
          session_token: sessionTokenRef.current,
          quote_code: quote?.quote_code ?? "",
          resume_token: quote?.resume_token ?? resumeToken,
          product_slug: activeProduct.slug,
          product_label: activeProduct.label,
          interaction_count: interactionCount,
          click_count: clickCount,
          source: "shop-moskitiery",
          client_context: getClientContext(),
        });

        if (!cancelled) {
          setOnlineCount(response.presence.online_count);
        }
      } catch (error) {
        console.error(error);
      }
    }

    void touchPresence();
    const timer = window.setInterval(() => {
      void touchPresence();
    }, PRESENCE_POLL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [
    clickCount,
    interactionCount,
    quote?.quote_code,
    quote?.resume_token,
    resumeToken,
    selectedProduct,
  ]);

  if (loading) {
    return (
      <div className={styles.pageShell}>
        <section className={styles.loadingCard}>
          Ładuję konfigurator…
        </section>
      </div>
    );
  }

  if (errorMessage && !config) {
    return (
      <div className={styles.pageShell}>
        <section className={styles.loadingCard}>{errorMessage}</section>
      </div>
    );
  }

  return (
    <div className={styles.pageShell}>
      <section
        className={styles.hero}
        style={
          activeBackground?.image_url
            ? {
                backgroundImage: `linear-gradient(135deg, rgba(15, 23, 42, 0.88), rgba(15, 118, 110, 0.62)), url(${activeBackground.image_url})`,
              }
            : undefined
        }
      >
        <div className={styles.heroCopy}>
          <span className={styles.heroEyebrow}>Konfigurator moskitier KEIKA</span>
          <h1>Kopia flow konfiguratora Allegro</h1>
          <p>
            Ten wariant działa teraz w tym samym układzie kroków co konfigurator
            Allegro, ale zapisuje wyceny osobno i nie prowadzi jeszcze do zakupu
            online.
          </p>
          {activeSlide ? (
            <div className={styles.heroSlide}>
              <strong>{activeSlide.title}</strong>
              <span>{activeSlide.body}</span>
            </div>
          ) : null}
          <div className={styles.heroMeta}>
            <span>{products.length} warianty moskitier</span>
            <span>{onlineCount} użytkowników online</span>
            <span>kod wyceny i wznowienie konfiguracji</span>
          </div>
        </div>
        <div className={styles.heroPanel}>
          <div className={styles.heroPanelLabel}>Aktywny wariant</div>
          <div className={styles.heroPanelTitle}>
            {selectedProduct?.label ?? "Wybierz produkt"}
          </div>
          <div className={styles.heroPanelPrice}>
            {selectedProduct
              ? `${formatMoney(currentUnitPrice, selectedProduct.display_price_currency)} / ${selectedProduct.price_unit.label}`
              : "—"}
          </div>
          <p className={styles.heroPanelText}>
            {selectedProduct?.configurator.intro ??
              "Wybierz produkt, aby rozpocząć konfigurację."}
          </p>
          <span className={styles.heroPanelNote}>
            Zakup online podepniemy w kolejnym kroku.
          </span>
        </div>
      </section>

      <section className={styles.statusStrip}>
        <div className={styles.statusItem}>
          <span>Status</span>
          <strong>{statusMessage || "Gotowe do konfiguracji."}</strong>
        </div>
        <div className={styles.statusItem}>
          <span>Zmiany</span>
          <strong>{isDirty ? "Masz niezapisane zmiany" : "Wszystko zapisane"}</strong>
        </div>
        <div className={styles.statusItem}>
          <span>Błąd</span>
          <strong>{errorMessage || "Brak"}</strong>
        </div>
      </section>

      {storedQuoteLink && !quote ? (
        <section className={styles.restoreBanner}>
          <div>
            <strong>Wykryto zapisaną wycenę {storedQuoteLink.quote_code}</strong>
            <p>
              Ostatnio zapisano: {storedQuoteLink.product_label} ({formatDateTime(
                storedQuoteLink.saved_at,
              )}).
            </p>
          </div>
          <button
            type="button"
            className={styles.secondaryButton}
            onClick={() =>
              void handleResume({
                quoteCode: storedQuoteLink.quote_code,
                resumeToken: storedQuoteLink.resume_token,
                fromStorage: true,
              })
            }
            disabled={resumeLoading}
          >
            {resumeLoading ? "Wznawiam…" : "Wznów ostatnią wycenę"}
          </button>
        </section>
      ) : null}

      <section className={styles.catalogSection}>
        <div className={styles.sectionHeading}>
          <span>Produkty</span>
          <h2>Wybierz wariant moskitiery</h2>
        </div>
        <div className={styles.productGrid}>
          {products.map((product) => {
            const isActive = selectedProduct?.slug === product.slug;
            return (
              <button
                type="button"
                key={product.id}
                className={`${styles.productCard} ${
                  isActive ? styles.productCardActive : ""
                }`}
                onClick={() => updateProduct(product)}
              >
                <div
                  className={styles.productImage}
                  style={
                    product.image_url
                      ? { backgroundImage: `url(${product.image_url})` }
                      : undefined
                  }
                />
                <div className={styles.productCardBody}>
                  <strong>{product.label}</strong>
                  <span>{formatMoney(parseMoney(product.display_price_amount), product.display_price_currency)} / {product.price_unit.label}</span>
                  <small>{product.configurator.steps.length} kroki konfiguracji</small>
                </div>
              </button>
            );
          })}
        </div>
      </section>

      <section className={styles.workspace}>
        <div className={styles.mainColumn}>
          <section className={styles.measurementsCard}>
            <div className={styles.sectionHeading}>
              <span>Instrukcja pomiaru</span>
              <h2>Prowadzenie użytkownika w konfiguratorze</h2>
            </div>
            {selectedProduct?.configurator.measurement_guide_video_url ? (
              <video
                className={styles.guideVideo}
                controls
                playsInline
                preload="metadata"
                src={selectedProduct.configurator.measurement_guide_video_url}
              />
            ) : null}
            <div className={styles.guideGrid}>
              {selectedProduct?.configurator.measurement_guide_sections.map((section) => (
                <article key={section.id} className={styles.guideCard}>
                  <div
                    className={styles.guideEyebrow}
                    dangerouslySetInnerHTML={{ __html: section.eyebrow }}
                  />
                  <h3 dangerouslySetInnerHTML={{ __html: section.title }} />
                  <div
                    className={styles.richText}
                    dangerouslySetInnerHTML={{ __html: section.body }}
                  />
                </article>
              ))}
            </div>
          </section>

          <section className={styles.configuratorSection}>
            <div className={styles.sectionHeading}>
              <span>Konfigurator</span>
              <h2>Skonfiguruj pozycję do wyceny</h2>
            </div>

            <div className={styles.stepStack}>
              {choiceSteps.map((step) => (
                <article key={step.id} className={styles.stepCard}>
                  <div className={styles.stepHeader}>
                    <div>
                      <span className={styles.stepLabel}>Krok wyboru</span>
                      <h3>{step.title}</h3>
                    </div>
                    {step.subtitle ? <p>{step.subtitle}</p> : null}
                  </div>

                  <div className={styles.optionGrid}>
                    {step.options.map((option) => {
                      const isSelected = selectedAnswers[step.key] === option.value;
                      return (
                        <button
                          type="button"
                          key={option.id}
                          className={`${styles.optionCard} ${
                            isSelected ? styles.optionCardSelected : ""
                          }`}
                          onClick={() => {
                            setSelectedAnswers((current) => ({
                              ...current,
                              [step.key]: option.value,
                            }));
                            registerInteraction("select_option", "Wybrano opcję kroku", {
                              step: step.key,
                              value: option.value,
                            });
                          }}
                        >
                          <div
                            className={styles.optionSwatch}
                            style={
                              option.image_url
                                ? { backgroundImage: `url(${option.image_url})` }
                                : {
                                    background:
                                      `linear-gradient(145deg, ${option.accent_color || "#CBD5E1"} 0%, rgba(255,255,255,0.95) 100%)`,
                                  }
                            }
                          />
                          <div className={styles.optionBody}>
                            <strong>{option.label}</strong>
                            {option.subtitle ? <span>{option.subtitle}</span> : null}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </article>
              ))}

              {dimensionsStep ? (
                <article className={styles.stepCard}>
                  <div className={styles.stepHeader}>
                    <div>
                      <span className={styles.stepLabel}>Wymiary</span>
                      <h3>{dimensionsStep.title}</h3>
                    </div>
                    {dimensionsStep.subtitle ? <p>{dimensionsStep.subtitle}</p> : null}
                  </div>

                  <div className={styles.dimensionGrid}>
                    <label className={styles.field}>
                      <span>{dimensionsStep.width_label}</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        placeholder={dimensionsStep.width_placeholder}
                        value={dimensions.width}
                        onChange={(event) => {
                          setDimensions((current) => ({
                            ...current,
                            width: event.target.value,
                          }));
                          registerInteraction("update_dimension", "Zmieniono szerokość", {
                            step: dimensionsStep.key,
                          });
                        }}
                      />
                      <small>{dimensionsStep.width_unit}</small>
                    </label>

                    <label className={styles.field}>
                      <span>{dimensionsStep.height_label}</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        placeholder={dimensionsStep.height_placeholder}
                        value={dimensions.height}
                        onChange={(event) => {
                          setDimensions((current) => ({
                            ...current,
                            height: event.target.value,
                          }));
                          registerInteraction("update_dimension", "Zmieniono wysokość", {
                            step: dimensionsStep.key,
                          });
                        }}
                      />
                      <small>{dimensionsStep.height_unit}</small>
                    </label>

                    <label className={styles.field}>
                      <span>Ilość sztuk dla tej pozycji</span>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        inputMode="numeric"
                        value={quantity}
                        onChange={(event) => {
                          const nextQuantity = Math.max(
                            1,
                            Number.parseInt(event.target.value || "1", 10) || 1,
                          );
                          setQuantity(nextQuantity);
                          registerInteraction("update_quantity", "Zmieniono ilość sztuk", {
                            quantity: nextQuantity,
                          });
                        }}
                      />
                      <small>Ta liczba skaluje jednostki do zakupu i wycenę.</small>
                    </label>
                  </div>
                </article>
              ) : null}
            </div>
          </section>

          <section className={styles.positionsSection}>
            <div className={styles.sectionHeading}>
              <span>Pozycje wyceny</span>
              <h2>Zbuduj listę pozycji w jednej wycenie</h2>
            </div>

            <div className={styles.positionComposer}>
              <div>
                <strong>
                  {editingPositionId ? "Edytujesz istniejącą pozycję" : "Bieżąca pozycja"}
                </strong>
                <p>
                  Dodajesz kolejne okna jako osobne pozycje, a potem zapisujesz jedną
                  wspólną wycenę.
                </p>
              </div>
              <button
                type="button"
                className={styles.primaryButton}
                onClick={addOrReplacePosition}
                disabled={!draftPosition}
              >
                {editingPositionId ? "Zapisz zmiany pozycji" : "Dodaj pozycję"}
              </button>
            </div>

            {positions.length > 0 ? (
              <div className={styles.positionsList}>
                {positions.map((position, index) => (
                  <article key={position.id} className={styles.positionCard}>
                    <div className={styles.positionTop}>
                      <div>
                        <strong>
                          Pozycja {index + 1}: {position.product_label}
                        </strong>
                        <span>
                          {position.purchase_units ?? 0} {selectedProduct?.price_unit.label ?? "szt."} do zakupu
                        </span>
                      </div>
                      <div className={styles.positionActions}>
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => hydrateDraftFromPosition(position)}
                        >
                          Edytuj
                        </button>
                        <button
                          type="button"
                          className={styles.ghostButton}
                          onClick={() => removePosition(position.id)}
                        >
                          Usuń
                        </button>
                      </div>
                    </div>
                    <div className={styles.summaryRows}>
                      {position.summary_rows.map((row, rowIndex) => (
                        <div key={`${position.id}-${row.label}-${rowIndex}`} className={styles.summaryRow}>
                          <span>{row.label}</span>
                          <strong>{row.value}</strong>
                          {row.note ? <small>{row.note}</small> : null}
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className={styles.emptyState}>
                Dodaj pierwszą pozycję, żeby wygenerować wycenę.
              </div>
            )}
          </section>
        </div>

        <aside className={styles.sideColumn}>
          <section className={styles.previewCard}>
            <div className={styles.sectionHeading}>
              <span>Podgląd</span>
              <h2>Żywa wizualizacja i podsumowanie</h2>
            </div>

            <div className={styles.previewStage}>
              {selectedProduct?.image_url ? (
                <div
                  className={styles.previewBaseImage}
                  style={{ backgroundImage: `url(${selectedProduct.image_url})` }}
                />
              ) : (
                <div className={styles.previewPlaceholder}>
                  Wybierz wariant, aby zobaczyć podgląd.
                </div>
              )}

              {previewLayers.map((layer) => (
                <div
                  key={layer.id}
                  className={`${styles.previewLayer} ${
                    layer.mode === "mesh" ? styles.previewLayerMesh : ""
                  }`}
                  style={buildMaskedPreviewStyle(
                    layer.layerUrl,
                    layer.accentColor,
                    layer.mode,
                  )}
                />
              ))}
            </div>

            <div className={styles.summaryRows}>
              {draftPosition?.summary_rows.map((row, index) => (
                <div key={`${row.label}-${index}`} className={styles.summaryRow}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                  {row.note ? <small>{row.note}</small> : null}
                </div>
              )) ?? (
                <div className={styles.emptyState}>
                  Podgląd wypełni się po wyborze opcji i wpisaniu wymiarów.
                </div>
              )}
            </div>
          </section>

          <section className={styles.quoteCard}>
            <div className={styles.sectionHeading}>
              <span>Podsumowanie</span>
              <h2>Wspólna wycena</h2>
            </div>

            <div className={styles.kpiGrid}>
              <div className={styles.kpi}>
                <span>Pozycje</span>
                  <strong>{positions.length}</strong>
                </div>
                <div className={styles.kpi}>
                  <span>Sztuki</span>
                  <strong>{totalItems}</strong>
                </div>
                <div className={styles.kpi}>
                  <span>Jednostki</span>
                  <strong>{totalUnits}</strong>
                </div>
                <div className={styles.kpi}>
                  <span>Wartość</span>
                <strong>{formatMoney(totalAmount, selectedProduct?.display_price_currency ?? "PLN")}</strong>
              </div>
            </div>

              <button
                type="button"
                className={styles.primaryButton}
                onClick={() => void handleSaveQuote()}
                disabled={saving || positions.length === 0}
              >
              {saving ? "Zapisuję wycenę…" : "Zapisz wycenę"}
            </button>

            {quote ? (
              <div className={styles.quoteResult}>
                <div className={styles.quoteCodeBlock}>
                  <span>Kod wyceny</span>
                  <strong>{quote.quote_code}</strong>
                  <small>
                    Ostatnia aktualizacja: {formatDateTime(quote.updated_at || quote.created_at)}
                  </small>
                </div>

                <div className={styles.quoteStats}>
                  <div>
                    <span>Jednostki do kupienia</span>
                    <strong>{quote.units_count}</strong>
                  </div>
                  <div>
                    <span>Pozycje</span>
                    <strong>{quote.position_count}</strong>
                  </div>
                  <div>
                    <span>Łączna wartość</span>
                    <strong>
                      {quote.total_amount
                        ? formatMoney(parseMoney(quote.total_amount), quote.currency)
                        : "—"}
                    </strong>
                  </div>
                </div>

                <div className={styles.quoteActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={openSharePanel}
                  >
                    {sharePanelOpen ? "Ukryj zapis / udostępnianie" : "Zapisz / udostępnij"}
                  </button>
                  <span className={styles.infoNote}>
                    Zamówienie online podepniemy w kolejnym kroku.
                  </span>
                </div>

                {sharePanelOpen ? (
                  <div className={styles.sharePanel}>
                    <div className={styles.shareLinkBox}>
                      <span>Link do wznowienia</span>
                      <code>
                        {getQuoteLink(
                          quote,
                          resumeToken,
                          selectedProduct?.slug ?? initialProductSlug,
                          entryPath,
                        ) || "Brak linku"}
                      </code>
                    </div>
                    <div className={styles.shareButtons}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={handleSaveLocally}
                      >
                        Zapisz lokalnie
                      </button>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={() => void handleCopyQuoteLink()}
                      >
                        Kopiuj link
                      </button>
                      {typeof navigator !== "undefined" &&
                      typeof navigator.share === "function" ? (
                        <button
                          type="button"
                          className={styles.secondaryButton}
                          onClick={() => void handleNativeShare()}
                        >
                          Udostępnij systemowo
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={toggleQr}
                      >
                        {showQr ? "Ukryj QR" : "Pokaż QR"}
                      </button>
                    </div>

                    {showQr ? (
                      <div className={styles.qrWrap}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(
                            getQuoteLink(
                              quote,
                              resumeToken,
                              selectedProduct?.slug ?? initialProductSlug,
                              entryPath,
                            ),
                          )}`}
                          alt={`QR dla wyceny ${quote.quote_code}`}
                        />
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : (
              <div className={styles.infoNote}>
                Po zapisaniu dostaniesz kod wyceny i link do wznowienia konfiguracji.
              </div>
            )}
          </section>
        </aside>
      </section>
    </div>
  );
}
