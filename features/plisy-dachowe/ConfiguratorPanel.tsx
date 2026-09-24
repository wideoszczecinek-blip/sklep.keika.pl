"use client";

// The plisy-dachowe (roof-window pleated blind) configurator, 2026-09-19:
// kolor osprzętu (the old shop's four finishes) -> kolekcja tkaniny ->
// kolor tkaniny (the window-plisa steps, same live CRM profile and swatch
// UI as features/plisy/ConfiguratorPanel.tsx) -> model okna (the roof-blind
// step: library search with highlighted matches, nameplate PHOTO
// recognition through the CRM's Gemini reader, or the manual "Nie ma
// mojego okna" form - features/rolety-dachowe/) -> price (window
// plisa x 1,25, shared.ts) -> add to cart. Same accordion/scroll/tracking/
// cart contract as the other panels; draft in localStorage for a week.
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
import PlisyFabricGallery from "@/features/plisy/FabricGallery";
import { PlisyCollectionVisual, plisyCollectionKind, plisyCollectionMeta, plisyColorCountLabel } from "@/features/plisy/CollectionVisual";
import { buildPlisyHardwareSwatchStyle, fetchPlisyProfile, formatPriceDeltaBadge, type FabricSwatch, type PlisyProfile } from "@/features/plisy/shared";
import RoofWindowSearchSelector from "@/features/rolety-dachowe/RoofWindowSearchSelector";
import MissingModelForm from "@/features/rolety-dachowe/MissingModelForm";
import { fetchRoofBlindProfile, type RoofBlindProfile } from "@/features/rolety-dachowe/shared";
import {
  buildRoofWindowDisplayLabel,
  classifyNameplateResult,
  fetchRoofWindowLibrary,
  libraryProducerNames,
  recognizeRoofWindowNameplate,
  resolveRoofWindowDimensions,
  searchRoofWindowLibrary,
  uploadNameplatePhoto,
  type RoofWindowLibraryItem,
  type RoofWindowNameplateOutcome,
} from "@/features/rolety-dachowe/roof-window-library";
import PlisaDachowaPreview from "./PlisaDachowaPreview";
import {
  calcPlisyDachowePrice,
  PD_HARDWARE,
  PD_HARDWARE_SHEET_URL,
  PD_PRODUCT_LABEL,
  PD_PRODUCT_SLUG,
  pdCheapestPriceForSize,
  pdHardwareById,
  pdHardwareByLabel,
  pdHardwarePriceDelta,
  pdOversizeSurcharge,
  pdSizeLimits,
  type ConfiguratorInitialValues,
  type ConfiguratorResult,
  type MissingModelRequest,
} from "./shared";

type ZoomPreview = { title: string; urls: string[]; index: number };

const MANUAL_MODEL_LABEL = "Wymiar własny";
const MAX_RECOGNITIONS_PER_SESSION = 5;

const DRAFT_STORAGE_KEY = "keika_pd_draft_v1";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
type PdDraft = {
  hardwareId?: string;
  fabricGroupId?: string;
  fabricId?: string;
  windowLibraryId?: number;
  savedAt?: number;
};
function readDraft(): PdDraft | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PdDraft;
    if (!parsed || typeof parsed !== "object" || !parsed.savedAt || Date.now() - parsed.savedAt > DRAFT_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}
function writeDraft(draft: PdDraft) {
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
  promo?: PromoPreview | null;
  enableSaveShareBanner?: boolean;
  enableRescueModal?: boolean;
}) {
  // Korekta procentowa ceny TEGO produktu z CRM (lib/price-adjustment.ts) -
  // niezależna od korekty plis okiennych.
  const priceAdjustmentPercent = useProductPriceAdjustment(PD_PRODUCT_SLUG);

  const [profile, setProfile] = useState<PlisyProfile | null>(null);
  const [roofProfile, setRoofProfile] = useState<RoofBlindProfile | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [library, setLibrary] = useState<RoofWindowLibraryItem[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void fetchPlisyProfile().then((result) => {
      if (cancelled) return;
      if (!result || result.fabricGroups.length === 0 || result.tables.length === 0) {
        setLoadState("error");
        trackShopStep("configurator_load_failed", PD_PRODUCT_SLUG, { ms_since_nav: Math.round(performance.now()) });
        return;
      }
      setProfile(result);
      setLoadState("ready");
      trackShopStep("configurator_ready", PD_PRODUCT_SLUG, { ms_since_nav: Math.round(performance.now()) });
    });
    // Only the "Skąd wziąć model okna" help block is read off the roof-blind
    // profile (cached promise - free once the roof landing fetched it).
    void fetchRoofBlindProfile().then((result) => {
      if (!cancelled) setRoofProfile(result);
    });
    void fetchRoofWindowLibrary().then((result) => {
      if (cancelled) return;
      setLibrary(result.items);
      setLibraryLoading(false);
      if (result.source === "bundled") trackShopStep("window_library_fallback", PD_PRODUCT_SLUG);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const isCartEdit = Boolean(
    initialValues && Object.keys(initialValues).some((key) => !["widthMm", "heightMm", "qty", "windowQuery", "windowLibraryId", "fabricGroupId"].includes(key)),
  );
  const [draftSeed] = useState<PdDraft | null>(() => (isCartEdit ? null : readDraft()));
  const seed = { ...(draftSeed ?? {}), ...(initialValues ?? {}) };

  const [selectedHardwareId, setSelectedHardwareId] = useState(() => seed.hardwareId || pdHardwareByLabel(initialValues?.hardwareLabel)?.id || "");
  const [stepOneChosen, setStepOneChosen] = useState(() => Boolean(seed.hardwareId || pdHardwareByLabel(initialValues?.hardwareLabel)));
  const [stepOneCollapsed, setStepOneCollapsed] = useState(() => Boolean(seed.hardwareId || pdHardwareByLabel(initialValues?.hardwareLabel)));
  const [selectedFabricGroupId, setSelectedFabricGroupId] = useState(seed.fabricGroupId || "");
  const [stepTwoCollapsed, setStepTwoCollapsed] = useState(Boolean(seed.fabricGroupId));
  const [selectedFabricId, setSelectedFabricId] = useState(seed.fabricId || "");
  const [stepThreeCollapsed, setStepThreeCollapsed] = useState(Boolean(seed.fabricId));
  const [labelsResolved, setLabelsResolved] = useState(false);
  const [fabricGalleryIndex, setFabricGalleryIndex] = useState<number | null>(null);

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

  // Quantity (no free-text fields in any configurator - owner, 2026-09-19).
  const [quantity, setQuantity] = useState(initialValues?.qty ? String(initialValues.qty) : "1");
  const [internalZoomPreview, setInternalZoomPreview] = useState<ZoomPreview | null>(null);

  const stepTwoRef = useRef<HTMLButtonElement | null>(null);
  const stepThreeRef = useRef<HTMLButtonElement | null>(null);
  const stepFourRef = useRef<HTMLButtonElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);

  // /koszyk's "Edytuj pozycję" only knows the labels - resolve the fabric
  // group/colour against the live profile once loaded (hardware is static,
  // resolved in the initialisers above).
  useEffect(() => {
    if (!profile || labelsResolved) return;
    setLabelsResolved(true);
    let groupId = selectedFabricGroupId;
    if (!groupId && initialValues?.fabricGroupLabel) {
      const hit = profile.fabricGroups.find((group) => group.label.toLowerCase() === initialValues.fabricGroupLabel!.toLowerCase());
      if (hit) {
        groupId = hit.id;
        setSelectedFabricGroupId(hit.id);
        setStepTwoCollapsed(true);
      }
    }
    if (!selectedFabricId && initialValues?.fabricLabel) {
      const groups = groupId ? profile.fabricGroups.filter((group) => group.id === groupId) : profile.fabricGroups;
      for (const group of groups) {
        const hit = group.swatches.find((swatch) => swatch.label.toLowerCase() === initialValues.fabricLabel!.toLowerCase());
        if (hit) {
          setSelectedFabricId(hit.id);
          setStepThreeCollapsed(true);
          if (!groupId) {
            setSelectedFabricGroupId(group.id);
            setStepTwoCollapsed(true);
          }
          break;
        }
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

  useEffect(() => {
    if (isCartEdit) return;
    if (!selectedHardwareId && !selectedFabricGroupId && !selectedFabricId && !windowChoice) return;
    writeDraft({
      hardwareId: selectedHardwareId,
      fabricGroupId: selectedFabricGroupId,
      fabricId: selectedFabricId,
      windowLibraryId: windowChoice?.kind === "library" && windowChoice.item.id > 0 ? windowChoice.item.id : undefined,
    });
  }, [isCartEdit, selectedHardwareId, selectedFabricGroupId, selectedFabricId, windowChoice]);

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
    trackShopStep("gallery_zoom_open", preview?.title || PD_PRODUCT_SLUG, { image_index: preview?.index ?? 0 });
    if (onZoom) onZoom(preview);
    else setInternalZoomPreview(preview);
  }

  const selectedHardware = useMemo(() => pdHardwareById(selectedHardwareId), [selectedHardwareId]);
  const selectedFabricGroup = useMemo(() => (profile?.fabricGroups || []).find((group) => group.id === selectedFabricGroupId) || null, [profile, selectedFabricGroupId]);
  const fabricGroupChosen = Boolean(selectedFabricGroup);
  const swatchesForGroup: FabricSwatch[] = selectedFabricGroup?.swatches || [];
  const selectedFabric = useMemo(() => swatchesForGroup.find((swatch) => swatch.id === selectedFabricId) || null, [swatchesForGroup, selectedFabricId]);
  const fabricChosen = Boolean(selectedFabric);

  // Switching the collection invalidates a colour picked under the other one.
  useEffect(() => {
    if (selectedFabricId && selectedFabricGroup && !swatchesForGroup.some((swatch) => swatch.id === selectedFabricId)) {
      setSelectedFabricId("");
      setStepThreeCollapsed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFabricGroupId]);

  const searchResults = useMemo(() => (windowQuery.trim() && library.length ? searchRoofWindowLibrary(library, windowQuery) : []), [library, windowQuery]);
  const searchTrackedRef = useRef("");
  useEffect(() => {
    const trimmed = windowQuery.trim();
    if (trimmed.length < 3 || trimmed === searchTrackedRef.current) return;
    const id = window.setTimeout(() => {
      searchTrackedRef.current = trimmed;
      trackShopStep("window_search_query", trimmed.slice(0, 60), { results: searchResults.length, product: PD_PRODUCT_SLUG });
    }, 900);
    return () => window.clearTimeout(id);
  }, [windowQuery, searchResults.length]);

  const limits = pdSizeLimits(profile);
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
    profile && hasWindowInfo && selectedHardware && selectedFabricGroupId && selectedFabric
      ? calcPlisyDachowePrice(profile, resolvedDims.widthMm, resolvedDims.heightMm, selectedHardware, selectedFabricGroupId, selectedFabric, priceAdjustmentPercent)
      : null;
  const totalPrice = unitPrice !== null ? Math.round(unitPrice * quantityNum * 100) / 100 : null;
  const promoUnit = unitPrice !== null ? applyPromoToPrice(unitPrice, promo) : null;
  const promoTotal = totalPrice !== null ? applyPromoToPrice(totalPrice, promo) : null;
  const oversizeSurcharge = hasWindowInfo ? pdOversizeSurcharge(resolvedDims.widthMm) : 0;
  const priceOutOfRange = Boolean(windowChoice && hasWindowInfo && selectedHardware && selectedFabric && profile && unitPrice === null);

  // Per-result "od X zł" in the search list - the cheapest configuration
  // for that window in the collection already chosen (finish/colour too).
  const resolvePriceLabel = useCallback(
    (item: RoofWindowLibraryItem): string | null => {
      if (!profile) return null;
      const dims = resolveRoofWindowDimensions(item);
      if (!dims.widthMm || !dims.heightMm) return null;
      if (selectedHardware && selectedFabricGroupId && selectedFabric) {
        const exact = calcPlisyDachowePrice(profile, dims.widthMm, dims.heightMm, selectedHardware, selectedFabricGroupId, selectedFabric, priceAdjustmentPercent);
        if (exact === null) return null;
        return formatZl(applyPromoToPrice(exact, promo) ?? exact);
      }
      const best = pdCheapestPriceForSize(profile, dims.widthMm, dims.heightMm, priceAdjustmentPercent, selectedFabricGroupId);
      if (best === null) return null;
      return `od ${formatZl(applyPromoToPrice(best, promo) ?? best)}`;
    },
    [profile, selectedHardware, selectedFabricGroupId, selectedFabric, priceAdjustmentPercent, promo],
  );

  const quantityTrackedRef = useRef(quantityNum);
  useEffect(() => {
    if (quantityTrackedRef.current === quantityNum) return;
    quantityTrackedRef.current = quantityNum;
    trackShopStep("set_quantity", PD_PRODUCT_SLUG, { qty: quantityNum });
  }, [quantityNum]);

  useEffect(() => {
    const done: string[] = [];
    const missing: string[] = [];
    (selectedHardwareId ? done : missing).push("kolor osprzętu");
    (selectedFabricGroupId ? done : missing).push("kolekcja tkaniny");
    (selectedFabricId ? done : missing).push("kolor tkaniny");
    (hasWindowInfo ? done : missing).push(windowChoice?.kind === "manual" ? "wymiary" : "model okna");
    const blockedReason = priceOutOfRange
      ? "wymiary poza cennikiem"
      : !windowChoice && windowQuery.trim() !== "" && searchResults.length === 0
        ? "nie znalazł modelu okna"
        : loadState === "loading"
          ? "ładowanie profilu"
          : loadState === "error"
            ? "profil niedostępny"
            : "";
    reportConfiguratorState({
      product: PD_PRODUCT_SLUG,
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
  }, [selectedHardwareId, selectedFabricGroupId, selectedFabricId, hasWindowInfo, windowChoice, windowQuery, searchResults.length, totalPrice, quantityNum, resolvedDims, priceOutOfRange, loadState]);
  useEffect(() => () => clearConfiguratorState(PD_PRODUCT_SLUG), []);

  // ---- window selection helpers -------------------------------------------
  function chooseLibraryWindow(item: RoofWindowLibraryItem, source: string, attachmentId = "") {
    trackShopStep("select_window_model", buildRoofWindowDisplayLabel(item), { certain: item.is_certain, source, library_id: item.id, product: PD_PRODUCT_SLUG });
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
    trackShopStep("nameplate_photo_upload_start", PD_PRODUCT_SLUG, { source: "search", size_kb: Math.round(file.size / 1024) });
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
      trackShopStep("nameplate_photo_result", PD_PRODUCT_SLUG, {
        kind: outcome.kind,
        confidence: result?.aiRead.confidence || "n/a",
        assistant: result === null ? "unavailable" : "ok",
      });
    } catch (error) {
      setNameplateError(error instanceof Error && error.message ? error.message : "Nie udało się wgrać zdjęcia.");
      trackShopStep("nameplate_photo_result", PD_PRODUCT_SLUG, { kind: "upload_failed" });
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
    trackShopStep("window_model_not_found", windowQuery.trim() || "(puste zapytanie)", { source: seedFrom || "search", product: PD_PRODUCT_SLUG });
    setMissingFormSeed(seedRequest);
    setHelpOpen(false);
    setMissingFormOpen(true);
  }

  function handleMissingSubmit(request: MissingModelRequest) {
    trackShopStep("missing_model_submit", `${request.producer} ${request.model}`.trim(), {
      width_mm: request.dimensionAMm,
      height_mm: request.dimensionBMm,
      photos: request.attachmentIds.length,
      product: PD_PRODUCT_SLUG,
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
    void ensurePromoQuoteCode(PD_PRODUCT_SLUG).then((state) => {
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
    if (!hasWindowInfo || unitPrice === null || totalPrice === null || !windowChoice || !selectedHardware || !selectedFabricGroup || !selectedFabric) return null;
    const isManual = windowChoice.kind === "manual";
    return {
      hardwareId: selectedHardware.id,
      hardwareLabel: selectedHardware.label,
      hardwareImageUrl: selectedHardware.imageUrl,
      hardwareColor: selectedHardware.color,
      fabricGroupId: selectedFabricGroup.id,
      fabricGroupLabel: selectedFabricGroup.label,
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
      oversizeSurchargeAmount: oversizeSurcharge,
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
          <strong>Stwórz swoją plisę dachową</strong>
        </header>
        <p className="hero-product-config-hint rd-loading">
          <span className="rd-spinner" aria-hidden="true" /> Ładujemy kolory, tkaniny i cennik…
        </p>
      </>
    );
  }

  if (loadState === "error" || !profile) {
    return (
      <>
        <header>
          <strong>Stwórz swoją plisę dachową</strong>
        </header>
        <p className="hero-product-config-hint">Przepraszamy, nie udało się wczytać tkanin i cennika. Odśwież stronę albo spróbuj za chwilę.</p>
      </>
    );
  }

  return (
    <>
      <header>
        <strong>Stwórz swoją plisę dachową</strong>
      </header>

      <section className={`hero-product-step-accordion ${stepOneCollapsed ? "is-collapsed" : ""}`}>
        {stepHead(
          null,
          stepOneCollapsed,
          () => {
            trackShopStep("configurator_step_toggle", "hardware_color", { collapsed_after: !stepOneCollapsed, product: PD_PRODUCT_SLUG });
            setStepOneCollapsed((prev) => !prev);
          },
          Boolean(selectedHardware),
          "1",
          "Wybierz kolor osprzętu",
          false,
          <>
            {selectedHardware && stepOneCollapsed ? (
              <span className="hero-product-step-head-swatch" style={{ backgroundImage: `url(${optimizeImageUrl(selectedHardware.imageUrl, 64)})` }} aria-hidden="true" />
            ) : null}
            {selectedHardware ? <strong>{selectedHardware.label}</strong> : null}
          </>,
        )}
        <div className="hero-product-step-body">
          <div className="hardware-grid hardware-grid--visual hero-product-hardware-grid pd-hardware-grid">
            {PD_HARDWARE.map((option) => {
              const isActive = option.id === selectedHardwareId;
              const delta = pdHardwarePriceDelta(profile, option);
              const badge = formatPriceDeltaBadge(delta.priceDelta, delta.priceDeltaType);
              return (
                <div key={option.id} className={`hardware-card ${isActive ? "is-active" : ""}`}>
                  <button
                    type="button"
                    className="hardware-card-main"
                    onClick={() => {
                      trackShopStep("select_hardware_color", option.label, { option_id: option.id, product: PD_PRODUCT_SLUG });
                      setSelectedHardwareId(option.id);
                      setStepOneCollapsed(true);
                      if (!stepOneChosen) setStepOneChosen(true);
                      window.setTimeout(() => scrollStepIntoView(stepTwoRef.current), 380);
                    }}
                  >
                    <span className="hardware-card-image pd-hardware-card-image" style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 220)})` }} />
                    {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                    <span className="hardware-card-footer">
                      <span className="hardware-dot" style={{ background: option.color }} />
                      <strong>{option.label}</strong>
                      {badge ? <span className="pd-delta-badge">{badge}</span> : null}
                    </span>
                  </button>
                  <button type="button" className="config-option-zoom" aria-label={`Powiększ: ${option.label}`} onClick={() => openZoom({ title: `Osprzęt ${option.label}`, urls: [option.imageUrl, PD_HARDWARE_SHEET_URL], index: 0 })}>
                    🔍
                  </button>
                </div>
              );
            })}
          </div>
          <p className="hero-product-config-hint">Belki i prowadnice zawsze w jednym kolorze — dobierz do ramy okna.</p>
        </div>
      </section>

      {stepOneChosen ? (
        <>
          <section className={`hero-product-step-accordion ${stepTwoCollapsed ? "is-collapsed" : ""}`}>
            {stepHead(
              stepTwoRef,
              stepTwoCollapsed,
              () => {
                trackShopStep("configurator_step_toggle", "fabric_group", { collapsed_after: !stepTwoCollapsed, product: PD_PRODUCT_SLUG });
                setStepTwoCollapsed((prev) => !prev);
              },
              fabricGroupChosen,
              "2",
              "Wybierz kolekcję tkaniny",
              true,
              selectedFabricGroup ? <strong>{selectedFabricGroup.label}</strong> : null,
            )}
            <div className="hero-product-step-body" style={stepTwoCollapsed ? undefined : { maxHeight: "none", overflow: "visible" }}>
              <div className="plisy-coll-grid">
                {profile.fabricGroups.map((group) => {
                  const isActive = group.id === selectedFabricGroupId;
                  const kind = plisyCollectionKind(group);
                  const meta = plisyCollectionMeta(kind);
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={`hero-product-mesh-option plisy-coll-card ${isActive ? "is-active" : ""}`}
                      title={group.note || group.label}
                      onClick={() => {
                        trackShopStep("select_fabric_group", group.label, { option_id: group.id, product: PD_PRODUCT_SLUG });
                        setSelectedFabricGroupId(group.id);
                        setStepTwoCollapsed(true);
                        window.setTimeout(() => scrollStepIntoView(stepThreeRef.current), 380);
                      }}
                    >
                      <span className="plisy-coll-card-visual">
                        <PlisyCollectionVisual kind={kind} />
                      </span>
                      <span className="plisy-coll-card-body">
                        <span className="plisy-coll-card-head">
                          <strong>{group.label}</strong>
                          <span className="plisy-coll-card-badges">
                            {meta.badges.map((badge) => (
                              <span key={badge} className={`plisy-coll-card-badge ${badge === "Zaciemnia" ? "is-dark" : badge === "Termo" ? "is-thermo" : badge === "Plaster miodu" ? "is-structure" : ""}`}>
                                {badge}
                              </span>
                            ))}
                          </span>
                        </span>
                        <span className="plisy-coll-card-note">{meta.light}</span>
                        {group.swatches.length ? (
                          <span className="plisy-coll-card-count">
                            {plisyColorCountLabel(group.swatches.length)} do wyboru
                          </span>
                        ) : null}
                      </span>
                    </button>
                  );
                })}
              </div>
              {selectedFabricGroup?.note ? <p className="hero-product-config-hint">{selectedFabricGroup.note}</p> : null}
            </div>
          </section>

          {fabricGroupChosen ? (
            <>
              <section className={`hero-product-step-accordion hero-product-step-accordion--fabric-color ${stepThreeCollapsed ? "is-collapsed" : ""}`}>
                {stepHead(
                  stepThreeRef,
                  stepThreeCollapsed,
                  () => {
                    trackShopStep("configurator_step_toggle", "fabric_color", { collapsed_after: !stepThreeCollapsed, product: PD_PRODUCT_SLUG });
                    setStepThreeCollapsed((prev) => !prev);
                  },
                  fabricChosen,
                  "3",
                  "Wybierz kolor tkaniny",
                  true,
                  <>
                    {selectedFabric && stepThreeCollapsed ? (
                      <span className="hero-product-step-head-swatch" style={buildPlisyHardwareSwatchStyle(selectedFabric.thumbnailUrl, selectedFabric.color)} aria-hidden="true" />
                    ) : null}
                    {selectedFabric ? <strong>{selectedFabric.label}</strong> : null}
                  </>,
                )}
                <div className="hero-product-step-body">
                  {swatchesForGroup.length ? (
                    <div className="plisy-fabric-tools">
                      <button
                        type="button"
                        className="plisy-fabric-gallery-cta"
                        onClick={() => {
                          const at = Math.max(0, swatchesForGroup.findIndex((swatch) => swatch.id === selectedFabricId));
                          setFabricGalleryIndex(at);
                          trackShopStep("fabric_gallery_open", selectedFabricGroup?.label || "", { source: "cta", product: PD_PRODUCT_SLUG });
                        }}
                      >
                        🔍 Zobacz duże zdjęcia tkanin
                      </button>
                    </div>
                  ) : null}
                  <div className="hero-product-mesh-grid hero-product-mesh-grid--visual">
                    {swatchesForGroup.map((swatch, swatchIndex) => {
                      const isActive = swatch.id === selectedFabricId;
                      const badge = formatPriceDeltaBadge(swatch.priceDelta, swatch.priceDeltaType);
                      return (
                        <div key={swatch.id} className="plisy-swatch-cell">
                          <button
                            type="button"
                            className={`hero-product-mesh-option hero-product-mesh-option--visual ${isActive ? "is-active" : ""}`}
                            title={swatch.label}
                            onClick={() => {
                              trackShopStep("select_fabric_color", swatch.label, { option_id: swatch.id, product: PD_PRODUCT_SLUG });
                              setSelectedFabricId(swatch.id);
                              setStepThreeCollapsed(true);
                              window.setTimeout(() => scrollStepIntoView(stepFourRef.current), 380);
                            }}
                          >
                            <span className="hero-product-mesh-option-image" style={buildPlisyHardwareSwatchStyle(swatch.thumbnailUrl, swatch.color)} />
                            <strong>{swatch.label}</strong>
                            {badge ? <span className="pd-delta-badge">{badge}</span> : null}
                          </button>
                          <button
                            type="button"
                            className="plisy-swatch-zoom"
                            aria-label={`Powiększ ${swatch.label}`}
                            title="Powiększ"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFabricGalleryIndex(swatchIndex);
                              trackShopStep("fabric_gallery_open", swatch.label, { source: "swatch", option_id: swatch.id, product: PD_PRODUCT_SLUG });
                            }}
                          >
                            🔍
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  {fabricGalleryIndex !== null && swatchesForGroup.length ? (
                    <PlisyFabricGallery
                      swatches={swatchesForGroup}
                      index={Math.min(fabricGalleryIndex, swatchesForGroup.length - 1)}
                      collectionLabel={selectedFabricGroup?.label || "Tkaniny"}
                      selectedId={selectedFabricId}
                      onIndexChange={setFabricGalleryIndex}
                      onClose={() => setFabricGalleryIndex(null)}
                      onPick={(swatch) => {
                        trackShopStep("select_fabric_color", swatch.label, { option_id: swatch.id, source: "gallery", product: PD_PRODUCT_SLUG });
                        setSelectedFabricId(swatch.id);
                        setFabricGalleryIndex(null);
                        setStepThreeCollapsed(true);
                        window.setTimeout(() => scrollStepIntoView(stepFourRef.current), 380);
                      }}
                    />
                  ) : null}
                </div>
              </section>

              {fabricChosen ? (
                <>
                  <section className={`hero-product-step-accordion ${stepFourCollapsed ? "is-collapsed" : ""}`}>
                    {stepHead(
                      stepFourRef,
                      stepFourCollapsed,
                      () => {
                        trackShopStep("configurator_step_toggle", "window_model", { collapsed_after: !stepFourCollapsed, product: PD_PRODUCT_SLUG });
                        setStepFourCollapsed((prev) => !prev);
                      },
                      hasWindowInfo,
                      "4",
                      "Dopasuj plisę do modelu okna",
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
                        modelHelp={roofProfile?.modelHelp || { eyebrow: "", title: "", body: "", imageUrl: "" }}
                        isHelpOpen={helpOpen}
                        onHelpOpenChange={setHelpOpen}
                        onPhotoUpload={(file) => void handlePhotoUpload(file)}
                        isRecognizing={isRecognizing}
                        nameplateOutcome={nameplateOutcome}
                        nameplateError={nameplateError}
                        assistantUnavailable={assistantUnavailable}
                        onNameplateConfirmMatch={() => {
                          if (nameplateOutcome?.kind !== "matched") return;
                          trackShopStep("nameplate_confirm_match", buildRoofWindowDisplayLabel(nameplateOutcome.item), { product: PD_PRODUCT_SLUG });
                          chooseLibraryWindow(nameplateOutcome.item, "nameplate", pendingNameplate?.attachmentId || "");
                        }}
                        onNameplateSelectCandidate={(item) => chooseLibraryWindow(item, "nameplate_candidate", pendingNameplate?.attachmentId || "")}
                        onNameplateRejectMatch={() => {
                          trackShopStep("nameplate_reject_match", PD_PRODUCT_SLUG);
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
                            Okno spoza biblioteki: <strong>{windowModelLabel}</strong> · wymiar {resolvedDims.widthMm} × {resolvedDims.heightMm} mm
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

                </>
              ) : null}

              {hasWindowInfo && !priceOutOfRange ? (
                <div className="hero-product-mini-summary is-revealed" ref={summaryRef}>
                  <h3>Plisa dachowa</h3>
                  <div className="hero-product-mini-summary-body">
                    <div className="plisa-preview-stage pd-preview-stage">
                      <PlisaDachowaPreview fabricColor={selectedFabric?.color || ""} hardwareColor={selectedHardware?.color || ""} fabricLabel={selectedFabric?.label} hardwareLabel={selectedHardware?.label} />
                    </div>
                    <dl>
                      <div>
                        <dt>Kolor osprzętu</dt>
                        <dd>{selectedHardware?.label || "--"}</dd>
                      </div>
                      <div>
                        <dt>Kolekcja tkaniny</dt>
                        <dd>{selectedFabricGroup?.label || "--"}</dd>
                      </div>
                      <div>
                        <dt>Kolor tkaniny</dt>
                        <dd>{selectedFabric?.label || "--"}</dd>
                      </div>
                      <div>
                        <dt>Model okna</dt>
                        <dd>{windowModelLabel}</dd>
                      </div>
                      <div>
                        <dt>Rozmiar plisy</dt>
                        <dd>
                          {resolvedDims.widthMm} × {resolvedDims.heightMm} mm
                          {windowChoice?.kind === "library" && !windowCertain ? <span className="rd-dd-note"> wymiar orientacyjny — potwierdzimy przed produkcją</span> : null}
                        </dd>
                      </div>
                    </dl>
                  </div>
                  {oversizeSurcharge > 0 ? (
                    <p className="plisy-oversize-note">
                      Plisa szersza niż 150 cm jedzie jako przesyłka gabarytowa: <strong>+{formatZl(oversizeSurcharge)}</strong> (jednorazowo dla całego zamówienia, doliczana w koszyku).
                    </p>
                  ) : null}
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
                  <p className="rd-summary-note">Dobór modelu i wymiaru sprawdzamy przed produkcją. Plisa z prowadnicami dopasowana do skrzydła, gotowa do montażu — komplet w paczce.</p>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <p className="hero-product-config-hint">Wybierz kolor osprzętu, aby przejść do kolejnego kroku.</p>
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
            trackShopStep("measure_guide_open", PD_PRODUCT_SLUG, { source: "missing_form" });
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
          shareUrl={promoExitQuoteCode ? `https://sklep.keika.pl/wizyta/${encodeURIComponent(promoExitQuoteCode)}` : `https://sklep.keika.pl/?produkt=${PD_PRODUCT_SLUG}`}
          onClose={() => {
            markRescueDismissedForGood();
            setPromoExitModalOpen(false);
          }}
        />
      ) : null}

      {enableSaveShareBanner ? (
        <SaveShareWidget
          headerSlotId="header-save-share-slot"
          productSlug={PD_PRODUCT_SLUG}
          productLabel={PD_PRODUCT_LABEL}
          priceLine={totalPrice !== null ? `, ${formatZl(totalPrice)}` : ""}
          buildPosition={() =>
            selectedHardware && selectedFabricGroup && selectedFabric && totalPrice !== null && hasWindowInfo
              ? buildRescuePosition({
                  productSlug: PD_PRODUCT_SLUG,
                  productLabel: PD_PRODUCT_LABEL,
                  hardwareLabel: selectedHardware.label,
                  meshLabel: `${selectedFabricGroup.label} — ${selectedFabric.label}`,
                  modelLabel: windowModelLabel,
                  labels: { hardware: "Kolor osprzętu", mesh: "Kolekcja i kolor tkaniny" },
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
