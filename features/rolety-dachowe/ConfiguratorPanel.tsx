"use client";

// The rolety-dachowe (roof window blind) configurator, rebuilt 2026-09-18 as
// a port of the Allegro configurator (konfiguruj.com.pl/dachowa) into the
// shop's own panel: kaseta/prowadnice colour -> rodzaj materiału (Deko /
// Termo) -> kolor materiału -> model okna (library search with highlighted
// matches, nameplate PHOTO recognition through the CRM's Gemini reader, or
// the manual "Nie ma mojego okna" form) -> opcje (handles on the bottom bar)
// -> price -> add to cart. No free-text fields (owner, 2026-09-19). Options and price tables are the LIVE CRM
// "dachowe" profile (features/rolety-dachowe/shared.ts), the window library
// is the live CRM library (roof-window-library.ts); both degrade to bundled
// snapshots. Same accordion/scroll/tracking/cart contract as the plisy and
// moskitiery panels.
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import PromoSaveModal from "@/app/components/promo-save-modal";
import SaveShareWidget from "@/app/components/save-share-widget";
import { optimizeImageUrl } from "@/lib/image-optim";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { buildRescuePosition, hasSeenRescueModal, isRescueDismissedForGood, markRescueDismissedForGood, markRescueModalShown } from "@/lib/rescue";
import { trackShopStep } from "@/lib/track-step";
import { clearConfiguratorState, reportConfiguratorState } from "@/lib/configurator-state";
import { activatePromoCode, applyPromoToPrice, getPromoRemainingMs, isPromoActive, type PromoPreview } from "@/lib/promo";
import { ensurePromoQuoteCode, hasSavedPromoLink } from "@/lib/promo-save";
import RoofWindowSearchSelector from "./RoofWindowSearchSelector";
import MissingModelForm from "./MissingModelForm";
import RoofBlindPreview from "./RoofBlindPreview";
import {
  calcRoletyDachowePrice,
  fetchRoofBlindProfile,
  roofBlindProfileFallbackReason,
  roofBlindSizeLimits,
  type ConfiguratorInitialValues,
  type ConfiguratorResult,
  type MissingModelRequest,
  type RoofBlindProfile,
} from "./shared";
import {
  classifyNameplateResult,
  fetchRoofWindowLibrary,
  libraryProducerNames,
  recognizeRoofWindowNameplate,
  resolveRoofWindowDimensions,
  searchRoofWindowLibrary,
  uploadNameplatePhoto,
  buildRoofWindowDisplayLabel,
  type RoofWindowLibraryItem,
  type RoofWindowNameplateOutcome,
} from "./roof-window-library";

type ZoomPreview = { title: string; urls: string[]; index: number };

const PRODUCT_SLUG = "rolety-dachowe";
const PRODUCT_LABEL = "Rolety dachowe";
const MANUAL_MODEL_LABEL = "Wymiar własny";
const MAX_RECOGNITIONS_PER_SESSION = 5;

// Steps 1-3 (and the last window) survive a remount and a return visit for a
// week - the customer who left to photograph the nameplate finds the colours
// as picked. Never read for a /koszyk edit (it carries its own values).
const DRAFT_STORAGE_KEY = "keika_rd_draft_v1";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
type RdDraft = {
  hardwareId?: string;
  materialTypeId?: string;
  fabricId?: string;
  windowLibraryId?: number;
  savedAt?: number;
};
function readDraft(): RdDraft | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RdDraft;
    if (!parsed || typeof parsed !== "object" || !parsed.savedAt || Date.now() - parsed.savedAt > DRAFT_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}
function writeDraft(draft: RdDraft) {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* private mode / quota */
  }
}

function formatZl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

type WindowChoice =
  | { kind: "library"; item: RoofWindowLibraryItem; attachmentId: string }
  | { kind: "manual"; request: MissingModelRequest };

export default function ConfiguratorPanel({
  initialValues,
  submitLabel,
  onSubmit,
  onZoom,
  promo = null,
  enableSaveShareBanner = false,
  enableRescueModal = false,
}: {
  initialValues?: ConfiguratorInitialValues;
  submitLabel: string;
  onSubmit: (result: ConfiguratorResult) => void;
  onZoom?: (preview: ZoomPreview) => void;
  /** The ACTIVE SEZON20 preview (null while the code isn't switched on) -
   * every price shows the discounted amount the cart will charge next to
   * the struck regular one. ConfiguratorResult's unitPrice is untouched. */
  promo?: PromoPreview | null;
  enableSaveShareBanner?: boolean;
  enableRescueModal?: boolean;
}) {
  // Korekta procentowa ceny produktu z CRM (lib/price-adjustment.ts) -
  // jedyna sklepowa gałka na ceny z tabeli (właściciel, 2026-09-18).
  const priceAdjustmentBySlug = useProductPriceAdjustment(PRODUCT_SLUG);
  const priceAdjustmentByCrmSlug = useProductPriceAdjustment("roleta-dachowa-dekolux");
  const priceAdjustmentPercent = priceAdjustmentBySlug || priceAdjustmentByCrmSlug;

  const [profile, setProfile] = useState<RoofBlindProfile | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready">("loading");
  const [library, setLibrary] = useState<RoofWindowLibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchRoofBlindProfile().then((result) => {
      if (cancelled) return;
      setProfile(result);
      setLoadState("ready");
      if (result.source === "bundled") {
        trackShopStep("configurator_profile_fallback", PRODUCT_SLUG, { reason: roofBlindProfileFallbackReason() });
      }
      trackShopStep("configurator_ready", PRODUCT_SLUG, { ms_since_nav: Math.round(performance.now()), source: result.source });
    });
    void fetchRoofWindowLibrary().then((result) => {
      if (cancelled) return;
      setLibrary(result.items);
      setLibraryLoading(false);
      if (result.source === "bundled") trackShopStep("window_library_fallback", PRODUCT_SLUG);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isCartEdit = Boolean(
    initialValues && Object.keys(initialValues).some((key) => !["widthMm", "heightMm", "qty", "windowQuery", "windowLibraryId", "materialTypeId"].includes(key)),
  );
  const [draftSeed] = useState<RdDraft | null>(() => (isCartEdit ? null : readDraft()));
  const seed = { ...(draftSeed ?? {}), ...(initialValues ?? {}) };

  const [selectedHardwareId, setSelectedHardwareId] = useState(seed.hardwareId || "");
  const [stepOneChosen, setStepOneChosen] = useState(Boolean(seed.hardwareId));
  const [stepOneCollapsed, setStepOneCollapsed] = useState(Boolean(seed.hardwareId));
  const [selectedMaterialTypeId, setSelectedMaterialTypeId] = useState(seed.materialTypeId || "");
  const [stepTwoCollapsed, setStepTwoCollapsed] = useState(Boolean(seed.materialTypeId));
  const [selectedFabricId, setSelectedFabricId] = useState(seed.fabricId || "");
  const [stepThreeCollapsed, setStepThreeCollapsed] = useState(Boolean(seed.fabricId));
  const [labelsResolved, setLabelsResolved] = useState(false);

  // Step 4 - the window.
  const [windowQuery, setWindowQuery] = useState(initialValues?.windowQuery || "");
  const [windowChoice, setWindowChoice] = useState<WindowChoice | null>(null);
  const [stepFourCollapsed, setStepFourCollapsed] = useState(false);
  const [missingFormOpen, setMissingFormOpen] = useState(false);
  const [missingFormSeed, setMissingFormSeed] = useState<Partial<MissingModelRequest> | undefined>(undefined);
  const [helpOpen, setHelpOpen] = useState(false);
  const [isRecognizing, setIsRecognizing] = useState(false);
  const [nameplateOutcome, setNameplateOutcome] = useState<RoofWindowNameplateOutcome | null>(null);
  const [nameplateError, setNameplateError] = useState("");
  const [assistantUnavailable, setAssistantUnavailable] = useState(false);
  const [pendingNameplate, setPendingNameplate] = useState<{ attachmentId: string; aiProducer: string; aiModel: string; aiConfidence: string } | null>(null);
  const recognitionsRef = useRef(0);

  // Step 5 - extras + quantity.
  const [bracketCount, setBracketCount] = useState<1 | 2>(initialValues?.bracketCount === 2 ? 2 : 1);
  const [quantity, setQuantity] = useState(initialValues?.qty ? String(initialValues.qty) : "1");
  const [internalZoomPreview, setInternalZoomPreview] = useState<ZoomPreview | null>(null);

  const stepTwoRef = useRef<HTMLButtonElement | null>(null);
  const stepThreeRef = useRef<HTMLButtonElement | null>(null);
  const stepFourRef = useRef<HTMLButtonElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);

  // /koszyk's "Edytuj pozycję" (and a resume link) only know the labels -
  // resolve them against the profile once it is loaded. A previously chosen
  // library window comes back by id (or by "Producent Model" label).
  useEffect(() => {
    if (!profile || labelsResolved) return;
    setLabelsResolved(true);
    if (!selectedHardwareId && initialValues?.hardwareLabel) {
      const hit = profile.hardware.find((option) => option.label.toLowerCase() === initialValues.hardwareLabel!.toLowerCase());
      if (hit) {
        setSelectedHardwareId(hit.id);
        setStepOneChosen(true);
        setStepOneCollapsed(true);
      }
    }
    if (!selectedFabricId && initialValues?.fabricLabel) {
      const hit = profile.fabrics.find((option) => option.label.toLowerCase() === initialValues.fabricLabel!.toLowerCase());
      if (hit) {
        setSelectedFabricId(hit.id);
        setStepThreeCollapsed(true);
        if (!selectedMaterialTypeId) {
          setSelectedMaterialTypeId(hit.materialTypeId);
          setStepTwoCollapsed(true);
        }
      }
    } else if (!selectedMaterialTypeId && initialValues?.materialTypeLabel) {
      const hit = profile.materialTypes.find((option) => option.label.toLowerCase() === initialValues.materialTypeLabel!.toLowerCase());
      if (hit) {
        setSelectedMaterialTypeId(hit.id);
        setStepTwoCollapsed(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, labelsResolved]);

  useEffect(() => {
    if (!library.length || windowChoice) return;
    const wantedId = initialValues?.windowLibraryId || (isCartEdit ? 0 : draftSeed?.windowLibraryId || 0);
    if (wantedId) {
      const item = library.find((entry) => entry.id === wantedId);
      if (item) {
        setWindowChoice({ kind: "library", item, attachmentId: "" });
        setWindowQuery(buildRoofWindowDisplayLabel(item));
        setStepFourCollapsed(true);
        return;
      }
    }
    if (isCartEdit && initialValues?.missingModelRequest) {
      setWindowChoice({ kind: "manual", request: initialValues.missingModelRequest });
      setWindowQuery("");
      setStepFourCollapsed(true);
      return;
    }
    if (isCartEdit && initialValues?.widthMm && initialValues?.heightMm && !initialValues.windowLibraryId) {
      // A manual size from before the structured request existed (or a
      // plain "Wymiar własny") - keep the size, the label as the model.
      const label = (initialValues.windowQuery || "").trim();
      setWindowChoice({
        kind: "manual",
        request: { producer: "", model: label && label !== MANUAL_MODEL_LABEL ? label : MANUAL_MODEL_LABEL, dimensionAMm: initialValues.widthMm, dimensionBMm: initialValues.heightMm, attachmentIds: [] },
      });
      setWindowQuery("");
      setStepFourCollapsed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [library]);

  // Draft persistence (steps 1-3 + window), never for a cart edit.
  useEffect(() => {
    if (isCartEdit) return;
    if (!selectedHardwareId && !selectedMaterialTypeId && !selectedFabricId && !windowChoice) return;
    writeDraft({
      hardwareId: selectedHardwareId,
      materialTypeId: selectedMaterialTypeId,
      fabricId: selectedFabricId,
      windowLibraryId: windowChoice?.kind === "library" && windowChoice.item.id > 0 ? windowChoice.item.id : undefined,
    });
  }, [isCartEdit, selectedHardwareId, selectedMaterialTypeId, selectedFabricId, windowChoice]);

  // Same containment logic as the other panels (desktop: stay inside
  // .hero-product-config-panel's own scrollbox; mobile: .hero-full).
  function scrollStepIntoView(target: HTMLElement | null) {
    if (!target) return;
    const panel = target.closest(".hero-product-config-panel") as HTMLElement | null;
    if (panel && getComputedStyle(panel).overflowY === "auto") {
      if (panel.scrollHeight > panel.clientHeight) {
        const panelRect = panel.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        const targetCenter = targetRect.top - panelRect.top + targetRect.height / 2;
        const delta = targetCenter - panel.clientHeight / 2;
        const nextTop = Math.max(0, Math.min(panel.scrollTop + delta, panel.scrollHeight - panel.clientHeight));
        panel.scrollTo({ top: nextTop, behavior: "smooth" });
      }
      return;
    }
    const container = target.closest(".hero-full") as HTMLElement | null;
    if (!container || container.scrollHeight <= container.clientHeight) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const delta = targetRect.top - containerRect.top - 96;
    const nextTop = Math.max(0, Math.min(container.scrollTop + delta, container.scrollHeight - container.clientHeight));
    container.scrollTo({ top: nextTop, behavior: "smooth" });
  }

  function openZoom(preview: ZoomPreview) {
    trackShopStep("gallery_zoom_open", preview?.title || PRODUCT_SLUG, { image_index: preview?.index ?? 0 });
    if (onZoom) onZoom(preview);
    else setInternalZoomPreview(preview);
  }

  const hardwareOptions = profile?.hardware || [];
  const materialOptions = profile?.materialTypes || [];
  const selectedHardware = useMemo(() => hardwareOptions.find((option) => option.id === selectedHardwareId) || null, [hardwareOptions, selectedHardwareId]);
  const selectedMaterialType = useMemo(() => materialOptions.find((option) => option.id === selectedMaterialTypeId) || null, [materialOptions, selectedMaterialTypeId]);
  const materialChosen = Boolean(selectedMaterialTypeId);
  const fabricOptionsForMaterial = useMemo(() => (profile?.fabrics || []).filter((option) => option.materialTypeId === selectedMaterialTypeId), [profile, selectedMaterialTypeId]);
  const selectedFabric = useMemo(() => (profile?.fabrics || []).find((option) => option.id === selectedFabricId) || null, [profile, selectedFabricId]);
  const fabricChosen = Boolean(selectedFabricId);

  // Switching material type invalidates a fabric picked under the other one.
  useEffect(() => {
    if (selectedFabric && selectedFabric.materialTypeId !== selectedMaterialTypeId) {
      setSelectedFabricId("");
      setStepThreeCollapsed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMaterialTypeId]);

  const searchResults = useMemo(() => (windowQuery.trim() && library.length ? searchRoofWindowLibrary(library, windowQuery) : []), [library, windowQuery]);
  const searchTrackedRef = useRef("");
  useEffect(() => {
    const trimmed = windowQuery.trim();
    if (trimmed.length < 3 || trimmed === searchTrackedRef.current) return;
    const id = window.setTimeout(() => {
      searchTrackedRef.current = trimmed;
      trackShopStep("window_search_query", trimmed.slice(0, 60), { results: searchResults.length });
    }, 900);
    return () => window.clearTimeout(id);
  }, [windowQuery, searchResults.length]);

  const limits = roofBlindSizeLimits(profile);
  const resolvedDims = useMemo(() => {
    if (!windowChoice) return { widthMm: 0, heightMm: 0 };
    if (windowChoice.kind === "library") return resolveRoofWindowDimensions(windowChoice.item);
    return { widthMm: windowChoice.request.dimensionAMm, heightMm: windowChoice.request.dimensionBMm };
  }, [windowChoice]);
  const hasWindowInfo = Boolean(windowChoice) && resolvedDims.widthMm > 0 && resolvedDims.heightMm > 0;
  const windowModelLabel = !windowChoice
    ? ""
    : windowChoice.kind === "library"
      ? buildRoofWindowDisplayLabel(windowChoice.item)
      : windowChoice.request.producer && windowChoice.request.model !== MANUAL_MODEL_LABEL
        ? `${windowChoice.request.producer} ${windowChoice.request.model}`.trim()
        : MANUAL_MODEL_LABEL;
  const windowCertain = windowChoice?.kind === "library" ? windowChoice.item.is_certain : false;

  const quantityNum = Math.max(1, Math.min(20, Number(quantity) || 1));
  const unitPrice =
    profile && hasWindowInfo && selectedHardwareId && selectedMaterialTypeId
      ? calcRoletyDachowePrice(profile.tables, resolvedDims.widthMm, resolvedDims.heightMm, selectedHardwareId, selectedMaterialTypeId, priceAdjustmentPercent)
      : null;
  const totalPrice = unitPrice !== null ? Math.round(unitPrice * quantityNum * 100) / 100 : null;
  const promoUnit = unitPrice !== null ? applyPromoToPrice(unitPrice, promo) : null;
  const promoTotal = totalPrice !== null ? applyPromoToPrice(totalPrice, promo) : null;
  const priceOutOfRange = Boolean(windowChoice && hasWindowInfo && selectedHardwareId && selectedMaterialTypeId && profile && unitPrice === null);

  // Per-result "od X zł" in the search list - the cheapest configuration
  // for that window in the material already chosen (hardware too if chosen).
  const resolvePriceLabel = useCallback(
    (item: RoofWindowLibraryItem): string | null => {
      if (!profile) return null;
      const dims = resolveRoofWindowDimensions(item);
      if (!dims.widthMm || !dims.heightMm) return null;
      const hardwareIds = selectedHardwareId ? [selectedHardwareId] : profile.hardware.map((option) => option.id);
      const materialIds = selectedMaterialTypeId ? [selectedMaterialTypeId] : profile.materialTypes.map((option) => option.id);
      let best: number | null = null;
      for (const hardwareId of hardwareIds) {
        for (const materialId of materialIds) {
          const price = calcRoletyDachowePrice(profile.tables, dims.widthMm, dims.heightMm, hardwareId, materialId, priceAdjustmentPercent);
          if (price !== null && (best === null || price < best)) best = price;
        }
      }
      if (best === null) return null;
      const promoPrice = applyPromoToPrice(best, promo);
      return `${selectedHardwareId && selectedMaterialTypeId ? "" : "od "}${formatZl(promoPrice ?? best)}`;
    },
    [profile, selectedHardwareId, selectedMaterialTypeId, priceAdjustmentPercent, promo],
  );

  const quantityTrackedRef = useRef(quantityNum);
  useEffect(() => {
    if (quantityTrackedRef.current === quantityNum) return;
    quantityTrackedRef.current = quantityNum;
    trackShopStep("set_quantity", PRODUCT_SLUG, { qty: quantityNum });
  }, [quantityNum]);

  // Stan formularza dla analityki "na czym stanął" (lib/configurator-state).
  useEffect(() => {
    const done: string[] = [];
    const missing: string[] = [];
    (selectedHardwareId ? done : missing).push("kolor kasety");
    (selectedMaterialTypeId ? done : missing).push("rodzaj materiału");
    (selectedFabricId ? done : missing).push("tkanina");
    (hasWindowInfo ? done : missing).push(windowChoice?.kind === "manual" ? "wymiary" : "model okna");
    const blockedReason = priceOutOfRange
      ? "wymiary poza cennikiem"
      : !windowChoice && windowQuery.trim() !== "" && searchResults.length === 0
        ? "nie znalazł modelu okna"
        : loadState === "loading"
          ? "ładowanie profilu"
          : "";
    reportConfiguratorState({
      product: PRODUCT_SLUG,
      done,
      missing,
      blocked_reason: blockedReason,
      cta_enabled: totalPrice !== null,
      price: totalPrice,
      positions: 0,
      qty: quantityNum,
      width_mm: resolvedDims.widthMm,
      height_mm: resolvedDims.heightMm,
      unit: "mm",
    });
  }, [selectedHardwareId, selectedMaterialTypeId, selectedFabricId, hasWindowInfo, windowChoice, windowQuery, searchResults.length, totalPrice, quantityNum, resolvedDims, priceOutOfRange, loadState]);
  useEffect(() => () => clearConfiguratorState(PRODUCT_SLUG), []);

  // ---- window selection helpers -------------------------------------------
  function chooseLibraryWindow(item: RoofWindowLibraryItem, source: string, attachmentId = "") {
    trackShopStep("select_window_model", buildRoofWindowDisplayLabel(item), { certain: item.is_certain, source, library_id: item.id });
    setWindowChoice({ kind: "library", item, attachmentId });
    setWindowQuery(buildRoofWindowDisplayLabel(item));
    setStepFourCollapsed(true);
    setHelpOpen(false);
    setMissingFormOpen(false);
    setNameplateOutcome(null);
    window.setTimeout(() => scrollStepIntoView(summaryRef.current), 380);
  }

  async function handlePhotoUpload(file: File) {
    if (recognitionsRef.current >= MAX_RECOGNITIONS_PER_SESSION) {
      setNameplateError("Wykorzystano limit rozpoznań na tę sesję — wpisz model ręcznie albo podaj wymiar.");
      setHelpOpen(true);
      return;
    }
    setNameplateError("");
    setNameplateOutcome(null);
    setHelpOpen(true);
    setIsRecognizing(true);
    trackShopStep("nameplate_photo_upload_start", PRODUCT_SLUG, { source: "search", size_kb: Math.round(file.size / 1024) });
    try {
      const uploaded = await uploadNameplatePhoto(file);
      recognitionsRef.current += 1;
      let result = null;
      try {
        result = await recognizeRoofWindowNameplate(uploaded.id);
      } catch {
        result = null;
      }
      if (result === null) setAssistantUnavailable(true);
      const outcome = classifyNameplateResult(result);
      setPendingNameplate({
        attachmentId: uploaded.id,
        aiProducer: result?.aiRead.producer || "",
        aiModel: result?.aiRead.model || "",
        aiConfidence: result?.aiRead.confidence || "",
      });
      setNameplateOutcome(outcome);
      trackShopStep("nameplate_photo_result", PRODUCT_SLUG, {
        kind: outcome.kind,
        confidence: result?.aiRead.confidence || "n/a",
        assistant: result === null ? "unavailable" : "ok",
      });
    } catch (error) {
      setNameplateError(error instanceof Error && error.message ? error.message : "Nie udało się wgrać zdjęcia.");
      trackShopStep("nameplate_photo_result", PRODUCT_SLUG, { kind: "upload_failed" });
    } finally {
      setIsRecognizing(false);
    }
  }

  function openMissingForm(seedFrom?: "nameplate") {
    const seedRequest: Partial<MissingModelRequest> = {};
    if (seedFrom === "nameplate" && pendingNameplate) {
      seedRequest.producer = pendingNameplate.aiProducer;
      seedRequest.model = pendingNameplate.aiModel;
      seedRequest.attachmentIds = pendingNameplate.attachmentId ? [pendingNameplate.attachmentId] : [];
      seedRequest.aiProducer = pendingNameplate.aiProducer;
      seedRequest.aiModel = pendingNameplate.aiModel;
      seedRequest.aiConfidence = pendingNameplate.aiConfidence;
    } else if (windowChoice?.kind === "manual") {
      Object.assign(seedRequest, windowChoice.request);
    } else if (windowQuery.trim() && !windowChoice) {
      seedRequest.model = windowQuery.trim();
    }
    trackShopStep("window_model_not_found", windowQuery.trim() || "(puste zapytanie)", { source: seedFrom || "search" });
    setMissingFormSeed(seedRequest);
    setHelpOpen(false);
    setMissingFormOpen(true);
  }

  function handleMissingSubmit(request: MissingModelRequest) {
    trackShopStep("missing_model_submit", `${request.producer} ${request.model}`.trim(), {
      width_mm: request.dimensionAMm,
      height_mm: request.dimensionBMm,
      photos: request.attachmentIds.length,
    });
    setWindowChoice({ kind: "manual", request });
    setWindowQuery("");
    setMissingFormOpen(false);
    setStepFourCollapsed(true);
    window.setTimeout(() => scrollStepIntoView(summaryRef.current), 380);
  }

  // ---- SEZON20 rescue / save-share (same three-case logic as moskitiery) --
  const [promoExitModalOpen, setPromoExitModalOpen] = useState(false);
  const [promoExitAutoActivated, setPromoExitAutoActivated] = useState(false);
  const [promoExitQuoteCode, setPromoExitQuoteCode] = useState("");
  const [promoExitRemainingMs, setPromoExitRemainingMs] = useState(0);
  function openRescueModalOnce() {
    if (!hasWindowInfo || totalPrice === null) return;
    if (hasSeenRescueModal() || isRescueDismissedForGood()) return;
    const wasPromoActive = isPromoActive();
    if (wasPromoActive && hasSavedPromoLink()) {
      markRescueModalShown();
      return;
    }
    markRescueModalShown();
    if (!wasPromoActive) activatePromoCode();
    setPromoExitAutoActivated(!wasPromoActive);
    setPromoExitRemainingMs(getPromoRemainingMs());
    void ensurePromoQuoteCode(PRODUCT_SLUG).then((state) => {
      if (state?.quoteCode) setPromoExitQuoteCode(state.quoteCode);
    });
    setPromoExitModalOpen(true);
  }
  useEffect(() => {
    if (!enableRescueModal || !hasWindowInfo || totalPrice === null) return;
    const handleLeaveSignal = () => openRescueModalOnce();
    document.documentElement.addEventListener("mouseleave", handleLeaveSignal);
    return () => document.documentElement.removeEventListener("mouseleave", handleLeaveSignal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enableRescueModal, hasWindowInfo, totalPrice]);

  function buildResult(): ConfiguratorResult | null {
    if (!hasWindowInfo || unitPrice === null || totalPrice === null || !windowChoice || !selectedHardware || !selectedMaterialType || !selectedFabric) return null;
    const isManual = windowChoice.kind === "manual";
    return {
      hardwareId: selectedHardware.id,
      hardwareLabel: selectedHardware.label,
      hardwareImageUrl: selectedHardware.imageUrl,
      hardwareColor: selectedHardware.color,
      previewLayerUrl: selectedHardware.previewLayerUrl || "",
      materialTypeId: selectedMaterialType.id,
      materialTypeLabel: selectedMaterialType.label,
      fabricId: selectedFabric.id,
      fabricLabel: selectedFabric.label,
      fabricColor: selectedFabric.color,
      fabricImageUrl: selectedFabric.imageUrl,
      windowProducer: isManual ? windowChoice.request.producer : windowChoice.item.producer_name,
      windowModel: isManual ? windowChoice.request.model || MANUAL_MODEL_LABEL : windowChoice.item.window_model,
      windowLibraryId: !isManual && windowChoice.item.id > 0 ? windowChoice.item.id : 0,
      windowCertain,
      isManual,
      widthMm: resolvedDims.widthMm,
      heightMm: resolvedDims.heightMm,
      qty: quantityNum,
      unitPrice,
      totalPrice,
      bracketCount,
      nameplateAttachmentId: isManual ? windowChoice.request.attachmentIds[0] || "" : windowChoice.attachmentId,
      missingModelRequest: isManual && windowChoice.request.model !== MANUAL_MODEL_LABEL ? windowChoice.request : null,
    };
  }

  function handleSubmit() {
    const result = buildResult();
    if (!result) return;
    onSubmit(result);
  }

  const stepHead = (
    ref: RefObject<HTMLButtonElement | null> | null,
    collapsed: boolean,
    onToggle: () => void,
    done: boolean,
    number: string,
    title: string,
    muted: boolean,
    meta: ReactNode,
  ) => (
    <button type="button" ref={ref ?? undefined} className="hero-product-step-head" onClick={onToggle} aria-expanded={collapsed ? "false" : "true"}>
      <span className={`hero-product-config-step-title ${muted ? "hero-product-config-step-title--muted" : ""}`}>
        <span className={`hero-product-step-check ${done ? "" : "is-muted"}`} aria-hidden="true">
          {done ? "✓" : number}
        </span>
        {title}
      </span>
      <span className="hero-product-step-head-meta">
        {meta}
        {collapsed ? <span className="hero-product-step-head-change">Zmień</span> : <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>}
      </span>
    </button>
  );

  const priceLine = (regular: number, discounted: number | null) =>
    discounted !== null && discounted < regular ? (
      <>
        <span className="rd-price-old">{formatZl(regular)}</span> <span className="rd-price-new">{formatZl(discounted)}</span>
      </>
    ) : (
      formatZl(regular)
    );

  if (loadState === "loading") {
    return (
      <>
        <header>
          <strong>Stwórz swoją roletę dachową</strong>
        </header>
        <p className="hero-product-config-hint rd-loading">
          <span className="rd-spinner" aria-hidden="true" /> Ładujemy kolory, tkaniny i cennik…
        </p>
      </>
    );
  }

  return (
    <>
      <header>
        <strong>Stwórz swoją roletę dachową</strong>
      </header>

      <section className={`hero-product-step-accordion ${stepOneCollapsed ? "is-collapsed" : ""}`}>
        {stepHead(
          null,
          stepOneCollapsed,
          () => {
            trackShopStep("configurator_step_toggle", "hardware_color", { collapsed_after: !stepOneCollapsed });
            setStepOneCollapsed((prev) => !prev);
          },
          Boolean(selectedHardware),
          "1",
          "Wybierz kolor kasety i prowadnic",
          false,
          <>
            {selectedHardware && stepOneCollapsed ? (
              <span className="hero-product-step-head-swatch" style={{ backgroundImage: `url(${optimizeImageUrl(selectedHardware.imageUrl, 64)})` }} aria-hidden="true" />
            ) : null}
            {selectedHardware ? <strong>{selectedHardware.label}</strong> : null}
          </>,
        )}
        <div className="hero-product-step-body">
          <div className="hardware-grid hardware-grid--visual hero-product-hardware-grid">
            {hardwareOptions.map((option, index) => {
              const isActive = option.id === selectedHardwareId;
              const isLastSolo = hardwareOptions.length % 3 === 1 && index === hardwareOptions.length - 1;
              return (
                <div key={option.id} className={`hardware-card ${isActive ? "is-active" : ""} ${isLastSolo ? "is-last-solo" : ""}`}>
                  <button
                    type="button"
                    className="hardware-card-main"
                    onClick={() => {
                      trackShopStep("select_hardware_color", option.label, { option_id: option.id });
                      setSelectedHardwareId(option.id);
                      setStepOneCollapsed(true);
                      if (!stepOneChosen) setStepOneChosen(true);
                      window.setTimeout(() => scrollStepIntoView(stepTwoRef.current), 380);
                    }}
                  >
                    <span className="hardware-card-image" style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 220)})` }} />
                    {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                    <span className="hardware-card-footer">
                      <span className="hardware-dot" style={{ background: option.color }} />
                      <strong>{option.label}</strong>
                    </span>
                  </button>
                  <button type="button" className="config-option-zoom" aria-label={`Powiększ: ${option.label}`} onClick={() => openZoom({ title: option.label, urls: option.galleryUrls, index: 0 })}>
                    🔍
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {stepOneChosen ? (
        <>
          <section className={`hero-product-step-accordion ${stepTwoCollapsed ? "is-collapsed" : ""}`}>
            {stepHead(
              stepTwoRef,
              stepTwoCollapsed,
              () => {
                trackShopStep("configurator_step_toggle", "material_type", { collapsed_after: !stepTwoCollapsed });
                setStepTwoCollapsed((prev) => !prev);
              },
              materialChosen,
              "2",
              "Wybierz rodzaj materiału",
              true,
              selectedMaterialType ? <strong>{selectedMaterialType.label}</strong> : null,
            )}
            <div className="hero-product-step-body">
              <div className="hero-product-mesh-grid hero-product-mesh-grid--visual rd-material-grid">
                {materialOptions.map((option) => {
                  const isActive = option.id === selectedMaterialTypeId;
                  const isTermo = /termo/i.test(option.id) || /termo/i.test(option.label);
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`hero-product-mesh-option hero-product-mesh-option--visual rd-material-option ${isActive ? "is-active" : ""}`}
                      onClick={() => {
                        trackShopStep("select_material_type", option.label, { option_id: option.id });
                        setSelectedMaterialTypeId(option.id);
                        setStepTwoCollapsed(true);
                        window.setTimeout(() => scrollStepIntoView(stepThreeRef.current), 380);
                      }}
                    >
                      <span className="hero-product-mesh-option-image" style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 160)})` }} />
                      <strong>{option.label}</strong>
                      <span className="rd-material-tag">{isTermo ? "zaciemnia · odbija słońce" : "rozprasza światło · nie zaciemnia"}</span>
                    </button>
                  );
                })}
              </div>
              {selectedMaterialType?.subtitle ? <p className="hero-product-config-hint">{selectedMaterialType.subtitle}</p> : null}
            </div>
          </section>

          {materialChosen ? (
            <>
              <section className={`hero-product-step-accordion ${stepThreeCollapsed ? "is-collapsed" : ""}`}>
                {stepHead(
                  stepThreeRef,
                  stepThreeCollapsed,
                  () => {
                    trackShopStep("configurator_step_toggle", "fabric_color", { collapsed_after: !stepThreeCollapsed });
                    setStepThreeCollapsed((prev) => !prev);
                  },
                  fabricChosen,
                  "3",
                  "Wybierz kolor materiału",
                  true,
                  <>
                    {selectedFabric && stepThreeCollapsed ? (
                      <span className="hero-product-step-head-swatch" style={{ backgroundImage: `url(${optimizeImageUrl(selectedFabric.imageUrl, 64)})` }} aria-hidden="true" />
                    ) : null}
                    {selectedFabric ? <strong>{selectedFabric.label}</strong> : null}
                  </>,
                )}
                <div className="hero-product-step-body">
                  <div className="hero-product-mesh-grid hero-product-mesh-grid--visual rd-fabric-grid">
                    {fabricOptionsForMaterial.map((option) => {
                      const isActive = option.id === selectedFabricId;
                      return (
                        <button
                          key={option.id}
                          type="button"
                          className={`hero-product-mesh-option hero-product-mesh-option--visual ${isActive ? "is-active" : ""}`}
                          title={option.subtitle ? `${option.label} — ${option.subtitle}` : option.label}
                          onClick={() => {
                            trackShopStep("select_fabric_color", option.label, { option_id: option.id });
                            setSelectedFabricId(option.id);
                            setStepThreeCollapsed(true);
                            window.setTimeout(() => scrollStepIntoView(stepFourRef.current), 380);
                          }}
                        >
                          <span className="hero-product-mesh-option-image" style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 160)})` }} />
                          <strong>{option.label}</strong>
                          {option.subtitle ? <span className="rd-fabric-sub">{option.subtitle}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {fabricChosen ? (
                <>
                  <section className={`hero-product-step-accordion ${stepFourCollapsed ? "is-collapsed" : ""}`}>
                    {stepHead(
                      stepFourRef,
                      stepFourCollapsed,
                      () => {
                        trackShopStep("configurator_step_toggle", "window_model", { collapsed_after: !stepFourCollapsed });
                        setStepFourCollapsed((prev) => !prev);
                      },
                      hasWindowInfo,
                      "4",
                      "Dopasuj roletę do modelu okna",
                      true,
                      windowChoice ? (
                        <strong>
                          {windowModelLabel}
                          {hasWindowInfo ? ` · ${resolvedDims.widthMm} × ${resolvedDims.heightMm} mm` : ""}
                        </strong>
                      ) : null,
                    )}
                    <div className="hero-product-step-body">
                      <RoofWindowSearchSelector
                        query={windowQuery}
                        results={searchResults}
                        selectedItem={windowChoice?.kind === "library" ? windowChoice.item : null}
                        isLoading={libraryLoading}
                        onQueryChange={(value) => {
                          setWindowQuery(value);
                          if (windowChoice) {
                            setWindowChoice(null);
                            setStepFourCollapsed(false);
                          }
                        }}
                        onSelect={(item) => chooseLibraryWindow(item, "search")}
                        onMissingModelClick={() => openMissingForm()}
                        resolvePriceLabel={resolvePriceLabel}
                        modelHelp={profile?.modelHelp || { eyebrow: "", title: "", body: "", imageUrl: "" }}
                        isHelpOpen={helpOpen}
                        onHelpOpenChange={setHelpOpen}
                        onPhotoUpload={(file) => void handlePhotoUpload(file)}
                        isRecognizing={isRecognizing}
                        nameplateOutcome={nameplateOutcome}
                        nameplateError={nameplateError}
                        assistantUnavailable={assistantUnavailable}
                        onNameplateConfirmMatch={() => {
                          if (nameplateOutcome?.kind !== "matched") return;
                          trackShopStep("nameplate_confirm_match", buildRoofWindowDisplayLabel(nameplateOutcome.item));
                          chooseLibraryWindow(nameplateOutcome.item, "nameplate", pendingNameplate?.attachmentId || "");
                        }}
                        onNameplateSelectCandidate={(item) => chooseLibraryWindow(item, "nameplate_candidate", pendingNameplate?.attachmentId || "")}
                        onNameplateRejectMatch={() => {
                          trackShopStep("nameplate_reject_match", PRODUCT_SLUG);
                          setNameplateOutcome(null);
                        }}
                        onNameplateReportMissing={() => openMissingForm("nameplate")}
                        autoFocus={Boolean(initialValues?.windowQuery)}
                      />
                      {windowChoice?.kind === "manual" ? (
                        <div className="rd-search-selected">
                          <span className="rd-search-selected-check" aria-hidden="true">
                            ✓
                          </span>
                          <span>
                            Okno spoza biblioteki: <strong>{windowModelLabel}</strong> · wymiar A/B {resolvedDims.widthMm} × {resolvedDims.heightMm} mm
                            {windowChoice.request.attachmentIds.length ? ` · zdjęć: ${windowChoice.request.attachmentIds.length}` : ""}
                          </span>
                          <button type="button" className="rd-link" onClick={() => openMissingForm()}>
                            Popraw
                          </button>
                        </div>
                      ) : null}
                      {priceOutOfRange ? (
                        <p className="hero-product-dimensions-error">
                          Ten wymiar wykracza poza nasz cennik (szerokość do {limits.maxWidthMm} mm, wysokość do {limits.maxHeightMm} mm). Napisz do nas z zakładki Kontakt — wycenimy indywidualnie.
                        </p>
                      ) : null}
                    </div>
                  </section>

                  {hasWindowInfo && !priceOutOfRange ? (
                    <section className="hero-product-step-accordion rd-extras">
                      <div className="hero-product-step-head is-static">
                        <span className="hero-product-config-step-title hero-product-config-step-title--muted">
                          <span className="hero-product-step-check is-muted" aria-hidden="true">
                            5
                          </span>
                          Opcje dodatkowe
                        </span>
                      </div>
                      <div className="hero-product-step-body">
                        <div className="rd-extra-row">
                          <div>
                            <strong>Uchwyty na belce dolnej</strong>
                            <p>Dwa uchwyty ułatwiają prowadzenie szerokiej rolety. Bez dopłaty.</p>
                          </div>
                          <div className="rd-unit-toggle" role="radiogroup" aria-label="Liczba uchwytów">
                            {([1, 2] as const).map((count) => (
                              <button
                                key={count}
                                type="button"
                                role="radio"
                                aria-checked={bracketCount === count}
                                className={`rd-unit ${bracketCount === count ? "is-active" : ""}`}
                                onClick={() => {
                                  setBracketCount(count);
                                  trackShopStep("set_bracket_count", PRODUCT_SLUG, { count });
                                }}
                              >
                                {count} {count === 1 ? "uchwyt" : "uchwyty"}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </section>
                  ) : null}
                </>
              ) : null}

              {hasWindowInfo && !priceOutOfRange ? (
                <div className="hero-product-mini-summary is-revealed" ref={summaryRef}>
                  <h3>Roleta dachowa</h3>
                  <div className="hero-product-mini-summary-body">
                    <RoofBlindPreview hardware={selectedHardware} fabric={selectedFabric} className="mosk-preview-stage rd-preview-stage" />
                    <dl>
                      <div>
                        <dt>Kolor kasety</dt>
                        <dd>{selectedHardware?.label || "--"}</dd>
                      </div>
                      <div>
                        <dt>Rodzaj materiału</dt>
                        <dd>{selectedMaterialType?.label || "--"}</dd>
                      </div>
                      <div>
                        <dt>Kolor materiału</dt>
                        <dd>{selectedFabric?.label || "--"}</dd>
                      </div>
                      <div>
                        <dt>Model okna</dt>
                        <dd>{windowModelLabel}</dd>
                      </div>
                      <div>
                        <dt>Rozmiar rolety</dt>
                        <dd>
                          {resolvedDims.widthMm} × {resolvedDims.heightMm} mm
                          {windowChoice?.kind === "library" && !windowCertain ? <span className="rd-dd-note"> wymiar orientacyjny — potwierdzimy przed produkcją</span> : null}
                        </dd>
                      </div>
                      <div>
                        <dt>Uchwyty</dt>
                        <dd>{bracketCount} szt.</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="hero-product-mini-summary-price">
                    <div className="hero-product-mini-summary-price-details">
                      <div>
                        <dt>Ilość</dt>
                        <dd>
                          <input type="number" inputMode="numeric" min={1} max={20} value={quantity} onChange={(event) => setQuantity(event.target.value)} className="rd-qty-input" />
                        </dd>
                      </div>
                      <div>
                        <dt>Cena za 1 szt.</dt>
                        <dd>{unitPrice !== null ? priceLine(unitPrice, promoUnit) : "--"}</dd>
                      </div>
                    </div>
                    <div className="hero-product-mini-summary-price-final">
                      <strong>{totalPrice !== null ? priceLine(totalPrice, promoTotal) : "Cena niedostępna dla tej kombinacji"}</strong>
                      {promo && promoTotal !== null ? <span className="rd-price-promo-note">z kodem {promo.code} w koszyku</span> : null}
                    </div>
                  </div>
                  <button type="button" className="hero-product-add-to-cart" onClick={handleSubmit} disabled={totalPrice === null}>
                    {submitLabel}
                  </button>
                  <p className="rd-summary-note">Dobór modelu i wymiaru sprawdzamy przed produkcją. Roleta dopasowana do skrzydła, gotowa do montażu — komplet w paczce.</p>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <p className="hero-product-config-hint">Wybierz kolor kasety, aby przejść do kolejnego kroku.</p>
      )}

      {missingFormOpen ? (
        <MissingModelForm
          producers={libraryProducerNames(library)}
          initial={missingFormSeed}
          maxWidthMm={limits.maxWidthMm}
          maxHeightMm={limits.maxHeightMm}
          photoEnabled={!assistantUnavailable && recognitionsRef.current < MAX_RECOGNITIONS_PER_SESSION}
          onClose={() => setMissingFormOpen(false)}
          onSubmit={handleMissingSubmit}
          onPickLibraryItem={(item, attachmentId) => chooseLibraryWindow(item, "missing_form_photo", attachmentId)}
          onOpenMeasureGuide={() => {
            trackShopStep("measure_guide_open", PRODUCT_SLUG, { source: "missing_form" });
            window.dispatchEvent(new CustomEvent("keika:rd-open-measure-guide"));
          }}
        />
      ) : null}

      {!onZoom && internalZoomPreview ? (
        <div className="config-option-preview-modal" role="dialog" aria-modal="true" aria-label={internalZoomPreview.title} onClick={() => setInternalZoomPreview(null)}>
          <div className="config-option-preview-shell" onClick={(event) => event.stopPropagation()}>
            <button type="button" className="config-option-preview-close" onClick={() => setInternalZoomPreview(null)} aria-label="Zamknij podgląd">
              ×
            </button>
            <img src={optimizeImageUrl(internalZoomPreview.urls[internalZoomPreview.index], 1200, 80)} alt={internalZoomPreview.title} className="config-option-preview-image" loading="eager" />
            <p>{internalZoomPreview.title}</p>
          </div>
        </div>
      ) : null}

      {promoExitModalOpen ? (
        <PromoSaveModal
          quoteCode={promoExitQuoteCode}
          remainingMs={promoExitRemainingMs}
          variant={promoExitAutoActivated ? "activated" : "reminder"}
          shareUrl={promoExitQuoteCode ? `https://sklep.keika.pl/wizyta/${encodeURIComponent(promoExitQuoteCode)}` : "https://sklep.keika.pl/?produkt=rolety-dachowe"}
          onClose={() => {
            markRescueDismissedForGood();
            setPromoExitModalOpen(false);
          }}
        />
      ) : null}

      {enableSaveShareBanner ? (
        <SaveShareWidget
          headerSlotId="header-save-share-slot"
          productSlug={PRODUCT_SLUG}
          productLabel={PRODUCT_LABEL}
          priceLine={totalPrice !== null ? `, ${formatZl(totalPrice)}` : ""}
          buildPosition={() =>
            selectedHardware && selectedFabric && totalPrice !== null && hasWindowInfo
              ? buildRescuePosition({
                  productSlug: PRODUCT_SLUG,
                  productLabel: PRODUCT_LABEL,
                  hardwareLabel: selectedHardware.label,
                  meshLabel: selectedFabric.label,
                  modelLabel: windowModelLabel,
                  labels: { hardware: "Kolor kasety", mesh: "Kolor materiału" },
                  widthMm: resolvedDims.widthMm,
                  heightMm: resolvedDims.heightMm,
                  qty: quantityNum,
                  total: totalPrice,
                })
              : null
          }
        />
      ) : null}
    </>
  );
}
