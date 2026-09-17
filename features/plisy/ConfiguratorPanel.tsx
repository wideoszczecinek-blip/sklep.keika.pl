"use client";

// The plisy (pleated blind) configurator: kolor mechanizmu -> kolekcja
// tkaniny -> kolor tkaniny, then (2026-09-09) a live preview + a repeatable
// wymiary/ilość entry building up a whole SET of positions (same mount/
// hardware/fabric, different window sizes) with a running per-position and
// grand total, flushed to the cart by one final add-to-cart button - see
// handleFinalSubmit. Mirrors features/rolety-dachowe/ConfiguratorPanel.tsx's
// structure for the swatch steps (same accordion steps, same
// scroll-into-view handling, same add-to-cart contract) with two
// differences: no window-model-library step (plisy are sized directly to
// the actual opening, not looked up by window producer/model), and its
// option/price data is fetched live from the CRM (see shared.ts) rather
// than hardcoded - the business owner is expected to keep editing it
// directly in the CRM admin panel, and a live fetch means those edits show
// up without a frontend redeploy.
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { optimizeImageUrl } from "@/lib/image-optim";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { trackShopStep } from "@/lib/track-step";
import { applyPromoToPrice, getPromoRemainingMs, PROMO_CODE, type PromoPreview } from "@/lib/promo";
import { ensurePromoQuoteCode } from "@/lib/promo-save";
import PromoSaveModal from "@/app/components/promo-save-modal";
import PlisaPreview from "./PlisaPreview";
import PlisyMeasureGuide, { measureModeForMount } from "./MeasureGuide";
import PlisyFabricGallery from "./FabricGallery";
import { PlisyCollectionVisual, plisyCollectionKind, plisyCollectionMeta } from "./CollectionVisual";
import {
  applyPriceDeltas,
  buildPlisyHardwareSwatchStyle,
  calcPlisyPrice,
  isPlisyMountNonInvasive,
  joinPlisyMountLabel,
  splitPlisyMountLabel,
  plisyOversizeSurcharge,
  plisySagWarningWidthMm,
  PLISY_BRACKET_COLORS,
  PLISY_OVERSIZE_WIDTH_MM,
  fetchPlisyProfile,
  formatPriceDeltaBadge,
  type ConfiguratorInitialValues,
  type ConfiguratorResult,
  type PlisyProfile,
} from "./shared";

type ZoomPreview = { title: string; urls: string[]; index: number };

// One line of the customer's set: same mount/hardware/fabric (chosen once,
// shared by the whole set) but its own width/height/qty - see the
// "positions" state below for how these get built up before a single final
// add-to-cart flushes all of them at once.
type PlisyPosition = {
  id: string;
  widthMm: number;
  heightMm: number;
  qty: number;
  unitPrice: number;
  totalPrice: number;
  oversizeSurchargeAmount: number;
};

function formatZl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

// Dimensions step (plisy landing analysis 2026-09-17). Half of everyone who
// got as far as picking a fabric colour typed nothing here and left; the
// two live samples of what they DID type were "60" and "120" - centimetres,
// the unit the ad and every competitor speak - rejected by a mm-only field
// whose error quoted a range no plisa is even made in. So: the same cm/mm
// toggle moskitiery-ramkowe has (shared localStorage key, so a customer
// who set mm there keeps mm here), cm by default, a "that looks like cm"
// nudge when mm is on and both numbers are tiny, the SEZON20 price the
// cart will actually charge next to the regular one, and a way out for the
// customer who simply hasn't measured yet (openMeasureLater).
type DimensionUnit = "mm" | "cm";
const DIMENSION_UNIT_STORAGE_KEY = "keika_dimension_unit_v1";

function readStoredUnit(): DimensionUnit {
  try {
    if (typeof window === "undefined") return "cm";
    return window.localStorage.getItem(DIMENSION_UNIT_STORAGE_KEY) === "mm" ? "mm" : "cm";
  } catch {
    return "cm";
  }
}

function mmToInput(mm: number, unit: DimensionUnit): string {
  return unit === "cm" ? String(Math.round(mm) / 10) : String(Math.round(mm));
}

function inputToMm(raw: string, unit: DimensionUnit): number {
  const n = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return unit === "cm" ? Math.round(n * 10) : Math.round(n);
}

// Steps 1-4 survive a remount and a return visit for a week: the customer
// who left to measure (or came back through "Konfiguruj to okno" up top,
// which remounts the panel with the size) finds mount, colours and fabric
// exactly as picked. Never read for a /koszyk edit - that one carries its
// own values.
const DRAFT_STORAGE_KEY = "keika_plisy_draft_v1";
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
type PlisyDraft = {
  mountId?: string;
  bracketColorId?: string;
  hardwareId?: string;
  fabricGroupId?: string;
  fabricId?: string;
  savedAt?: number;
};

function readDraft(): PlisyDraft | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlisyDraft;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > DRAFT_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(draft: PlisyDraft) {
  try {
    window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* private mode / quota - the draft is a convenience, nothing depends on it */
  }
}

export default function ConfiguratorPanel({
  initialValues,
  submitLabel,
  onSubmit,
  onAddVariant,
  onZoom,
  promo = null,
}: {
  /** The ACTIVE SEZON20 preview (null while the code isn't switched on):
   * every price in this panel then shows the discounted amount the cart
   * will charge next to the struck regular one. ConfiguratorResult's
   * unitPrice is untouched - the cart applies the code itself. */
  promo?: PromoPreview | null;
  initialValues?: ConfiguratorInitialValues;
  submitLabel: string;
  onSubmit: (result: ConfiguratorResult) => void;
  // Used by handleFinalSubmit for every position in the customer's set
  // except the last one - same mount/hardware/fabric selection, just a
  // different width/height/qty per position. Kept fully separate from
  // onSubmit so only the very last position triggers the parent's "Dodano
  // do koszyka!" takeover screen; the earlier ones add quietly.
  onAddVariant?: (result: ConfiguratorResult) => void;
  onZoom?: (preview: ZoomPreview) => void;
}) {
  // Korekta procentowa ceny produktu z CRM (lib/price-adjustment.ts) - dokłada
  // się do korekty profilu cen sklepu.
  const priceAdjustmentPercent = useProductPriceAdjustment("plisy");
  const [profile, setProfile] = useState<PlisyProfile | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    fetchPlisyProfile().then((result) => {
      if (cancelled) return;
      if (!result || result.hardware.length === 0 || result.fabricGroups.length === 0) {
        setLoadState("error");
        return;
      }
      setProfile(result);
      setLoadState("ready");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // A /koszyk edit arrives with its own choices (ids or labels); a fresh
  // configuration - or one that only brought a size from the "Ile za Twoje
  // okno?" block up top - is seeded from the saved draft, see readDraft().
  const isCartEdit = Boolean(
    initialValues && Object.keys(initialValues).some((key) => key !== "widthMm" && key !== "heightMm" && key !== "qty"),
  );
  const [draftSeed] = useState<PlisyDraft | null>(() => (isCartEdit ? null : readDraft()));
  const seed: PlisyDraft & ConfiguratorInitialValues = { ...(draftSeed ?? {}), ...(initialValues ?? {}) };
  const [selectedMountId, setSelectedMountId] = useState(seed.mountId || "");  // "Jak mierzyć?" as a full modal on top of everything (owner, 2026-09-16:
  // "w modalu zupełnie na wierzchu - duży, żeby nie rozjeżdżał
  // konfiguratora"). Locked to the mounting system chosen in step 1, so the
  // customer sees only the measurement that applies to them. Portaled to
  // <body>: .hero-product-config-panel gets a transform on mobile, which
  // would otherwise trap a position:fixed modal inside it.
  const [measureGuideOpen, setMeasureGuideOpen] = useState(false);
  // Fabric carousel (big photos + "Wybierz tę tkaninę"); null = closed,
  // otherwise the index into the current collection swatches.
  const [fabricGalleryIndex, setFabricGalleryIndex] = useState<number | null>(null);
  useEffect(() => {
    if (!measureGuideOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMeasureGuideOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [measureGuideOpen]);
  const [stepZeroChosen, setStepZeroChosen] = useState(Boolean(seed.mountId));
  const [stepZeroCollapsed, setStepZeroCollapsed] = useState(Boolean(seed.mountId));

  const [selectedHardwareId, setSelectedHardwareId] = useState(seed.hardwareId || "");
  // Bracket colour of the non-invasive mount (owner, 2026-09-16): a
  // required sub-step right after the rail colour, only when "Bezinwazyjny"
  // is the chosen mount. Resolved from the cart label on /koszyk's edit.
  const [selectedBracketId, setSelectedBracketId] = useState(() => {
    if (seed.bracketColorId) return seed.bracketColorId;
    const { bracketLabel } = splitPlisyMountLabel(seed.mountLabel);
    return PLISY_BRACKET_COLORS.find((entry) => entry.label === bracketLabel)?.id || "";
  });
  const [stepBracketCollapsed, setStepBracketCollapsed] = useState(Boolean(selectedBracketId));
  // "Profil może się ugiąć" acknowledgement for wide blinds - reset when
  // the collection changes (different threshold) or the width drops back
  // under it.
  const [sagAccepted, setSagAccepted] = useState(false);
  const [stepOneChosen, setStepOneChosen] = useState(Boolean(seed.hardwareId));
  const [stepOneCollapsed, setStepOneCollapsed] = useState(Boolean(seed.hardwareId));

  const [selectedFabricGroupId, setSelectedFabricGroupId] = useState(seed.fabricGroupId || "");
  const [stepTwoCollapsed, setStepTwoCollapsed] = useState(Boolean(seed.fabricGroupId));

  const [selectedFabricId, setSelectedFabricId] = useState(seed.fabricId || "");
  const [stepThreeCollapsed, setStepThreeCollapsed] = useState(Boolean(seed.fabricId));

  const [dimensionUnit, setDimensionUnit] = useState<DimensionUnit>(readStoredUnit);
  const [width, setWidth] = useState(() => (initialValues?.widthMm ? mmToInput(initialValues.widthMm, readStoredUnit()) : ""));
  const [height, setHeight] = useState(() => (initialValues?.heightMm ? mmToInput(initialValues.heightMm, readStoredUnit()) : ""));
  const [quantity, setQuantity] = useState(initialValues?.qty ? String(initialValues.qty) : "1");
  const lastTrackedDimsRef = useRef("");

  // convert=false adopts the unit for the digits already typed ("60" in a
  // mm field really meant 60 cm) instead of converting them.
  function switchDimensionUnit(next: DimensionUnit, convert = true) {
    if (next === dimensionUnit) return;
    if (convert) {
      const convertValue = (prev: string) => {
        const mm = inputToMm(prev, dimensionUnit);
        return mm > 0 ? mmToInput(mm, next) : prev;
      };
      setWidth(convertValue);
      setHeight(convertValue);
    }
    setDimensionUnit(next);
    try {
      window.localStorage.setItem(DIMENSION_UNIT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    trackShopStep("dimension_unit", "plisy", { unit: next, converted: convert });
  }
  // Wymiary/ilość is its own accordion too (2026-09-09, /koszyk's edit
  // modal) - same "collapsed if already known" rule as every step above,
  // so an existing cart item opens with EVERY choice tucked behind a
  // "Zmień" and the customer clicks whichever one they actually want to
  // change. A fresh configuration (no initialValues) still opens this
  // expanded, unaffected - there's nothing yet to collapse it around.
  // Only a /koszyk edit opens with the size tucked away - a size that came
  // from the quick-price block up top stays open with the price under it.
  const [stepFiveCollapsed, setStepFiveCollapsed] = useState(
    Boolean(isCartEdit && initialValues?.widthMm && initialValues?.heightMm),
  );
  const [internalZoomPreview, setInternalZoomPreview] = useState<ZoomPreview | null>(null);

  // "Nie masz jeszcze wymiarów?" - the save/share modal in its "measure"
  // variant: the same resume link the SEZON20 flows use (the quote code
  // remembers the visit), framed around coming back once the window is
  // measured. The draft above brings steps 1-4 back on return.
  const [measureSave, setMeasureSave] = useState<{ quoteCode: string; shareUrl: string; remainingMs: number } | null>(null);
  const [measureSaveBusy, setMeasureSaveBusy] = useState(false);
  async function openMeasureLater() {
    if (measureSaveBusy) return;
    setMeasureSaveBusy(true);
    trackShopStep("measure_later_open", "plisy", {
      mount: measureModeForMount(selectedMountId),
      fabric: selectedFabricId || "",
    });
    try {
      const state = await ensurePromoQuoteCode("plisy");
      const quoteCode = state?.quoteCode || "";
      setMeasureSave({
        quoteCode,
        shareUrl: quoteCode
          ? `https://sklep.keika.pl/wizyta/${encodeURIComponent(quoteCode)}`
          : "https://sklep.keika.pl/?produkt=plisy",
        remainingMs: getPromoRemainingMs(),
      });
    } finally {
      setMeasureSaveBusy(false);
    }
  }

  // The customer's whole set, built up one size at a time via "+ Dodaj
  // kolejną" below - same mount/hardware/fabric for every position, only
  // width/height/qty differ. Nothing here reaches the cart until the single
  // final add-to-cart button flushes the whole set (see handleFinalSubmit).
  const [positions, setPositions] = useState<PlisyPosition[]>([]);

  useEffect(() => {
    if (isCartEdit) return;
    if (!selectedMountId && !selectedHardwareId && !selectedFabricGroupId && !selectedFabricId) return;
    writeDraft({
      mountId: selectedMountId,
      bracketColorId: selectedBracketId,
      hardwareId: selectedHardwareId,
      fabricGroupId: selectedFabricGroupId,
      fabricId: selectedFabricId,
    });
  }, [isCartEdit, selectedMountId, selectedBracketId, selectedHardwareId, selectedFabricGroupId, selectedFabricId]);

  const stepOneRef = useRef<HTMLButtonElement | null>(null);
  const stepTwoRef = useRef<HTMLButtonElement | null>(null);
  const stepThreeRef = useRef<HTMLButtonElement | null>(null);
  const stepFourRef = useRef<HTMLDivElement | null>(null);

  // Identical containment logic to every other configurator in this shop -
  // see rolety-dachowe/ConfiguratorPanel.tsx's twin function for the full
  // reasoning (desktop stays inside .hero-product-config-panel's own
  // scrollbox; mobile falls through to .hero-full).
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
    trackShopStep("gallery_zoom_open", preview?.title || "plisy", { image_index: preview?.index ?? 0 });
    if (onZoom) onZoom(preview);
    else setInternalZoomPreview(preview);
  }

  // Placeholder/early profiles may ship with no mount options configured yet
  // - skip straight past the step rather than blocking the whole
  // configurator on a field the business owner hasn't filled in.
  useEffect(() => {
    if (profile && profile.mountOptions.length === 0 && !stepZeroChosen) {
      setStepZeroChosen(true);
      setStepZeroCollapsed(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // /koszyk's "Edytuj pozycję" fallback: resolve mount/hardware/fabricGroup
  // ids from the stored LABELS once the live profile loads (see
  // ConfiguratorInitialValues' own doc comment for why plisy needs this and
  // the other two products don't). Collapses each step it resolves, same as
  // if the id had been known from the start. No-ops entirely for a fresh
  // configuration (no *Label given) or once the real id is already known.
  useEffect(() => {
    if (!profile) return;
    if (!selectedMountId && initialValues?.mountLabel) {
      const wanted = splitPlisyMountLabel(initialValues.mountLabel).mountLabel;
      const match = profile.mountOptions.find((option) => option.label === wanted);
      if (match) {
        setSelectedMountId(match.id);
        setStepZeroChosen(true);
        setStepZeroCollapsed(true);
      }
    }
    if (!selectedHardwareId && initialValues?.hardwareLabel) {
      const match = profile.hardware.find((option) => option.label === initialValues.hardwareLabel);
      if (match) {
        setSelectedHardwareId(match.id);
        setStepOneChosen(true);
        setStepOneCollapsed(true);
      }
    }
    if (!selectedFabricGroupId && initialValues?.fabricGroupLabel) {
      const match = profile.fabricGroups.find((group) => group.label === initialValues.fabricGroupLabel);
      if (match) {
        setSelectedFabricGroupId(match.id);
        setStepTwoCollapsed(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const selectedMount = useMemo(
    () => profile?.mountOptions.find((option) => option.id === selectedMountId) || null,
    [profile, selectedMountId],
  );
  const selectedHardware = useMemo(
    () => profile?.hardware.find((option) => option.id === selectedHardwareId) || null,
    [profile, selectedHardwareId],
  );
  const bracketRequired = isPlisyMountNonInvasive(selectedMount?.id || selectedMount?.label);
  const selectedBracket = bracketRequired ? PLISY_BRACKET_COLORS.find((entry) => entry.id === selectedBracketId) || null : null;
  const bracketChosen = !bracketRequired || Boolean(selectedBracket);
  const stepBracketRef = useRef<HTMLButtonElement | null>(null);
  // Later step numbers shift by one while the bracket sub-step is showing.
  const stepShift = bracketRequired ? 1 : 0;
  const selectedFabricGroup = useMemo(
    () => profile?.fabricGroups.find((group) => group.id === selectedFabricGroupId) || null,
    [profile, selectedFabricGroupId],
  );
  const fabricGroupChosen = Boolean(selectedFabricGroupId);

  const swatchesForGroup = selectedFabricGroup?.swatches || [];
  const selectedFabric = useMemo(
    () => swatchesForGroup.find((swatch) => swatch.id === selectedFabricId) || null,
    [swatchesForGroup, selectedFabricId],
  );
  const fabricChosen = Boolean(selectedFabricId);

  // Second pass of the /koszyk label-resolution above: the fabric (swatch)
  // id lives inside whichever group that effect resolved, so it can only be
  // looked up once swatchesForGroup itself reflects that group - one render
  // later than the effect above.
  useEffect(() => {
    if (!selectedFabricId && initialValues?.fabricLabel && swatchesForGroup.length > 0) {
      const match = swatchesForGroup.find((swatch) => swatch.label === initialValues.fabricLabel);
      if (match) {
        setSelectedFabricId(match.id);
        setStepThreeCollapsed(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swatchesForGroup]);

  // Switching collection invalidates whatever color was picked under the
  // previous one - same rule as rolety-dachowe's material-type/fabric pair.
  useEffect(() => {
    if (selectedFabric && selectedFabricGroup && !swatchesForGroup.some((swatch) => swatch.id === selectedFabric.id)) {
      setSelectedFabricId("");
      setStepThreeCollapsed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFabricGroupId]);

  const widthNum = inputToMm(width, dimensionUnit);
  const heightNum = inputToMm(height, dimensionUnit);
  const dimensionsValid = profile
    ? widthNum >= profile.widthMinMm &&
      widthNum <= profile.widthMaxMm &&
      heightNum >= profile.heightMinMm &&
      heightNum <= profile.heightMaxMm
    : false;
  const quantityNum = Math.max(1, Number(quantity) || 1);
  const sagLimitMm = plisySagWarningWidthMm(selectedFabricGroupId);
  const sagWarning = dimensionsValid && widthNum > sagLimitMm;
  const sagBlocked = sagWarning && !sagAccepted;
  const oversizeSurcharge = dimensionsValid ? plisyOversizeSurcharge(widthNum) : 0;
  // "60 x 120" typed while mm is on: both numbers under half the smallest
  // plisa - centimetres, almost certainly. Offer the switch instead of a
  // range nobody reads.
  const looksLikeCm =
    dimensionUnit === "mm" &&
    !dimensionsValid &&
    widthNum > 0 &&
    heightNum > 0 &&
    (profile ? widthNum < profile.widthMinMm / 2 && heightNum < profile.heightMinMm / 2 : false);
  const formatRange = (minMm: number, maxMm: number) =>
    dimensionUnit === "cm" ? `${minMm / 10}–${maxMm / 10} cm` : `${minMm}–${maxMm} mm`;

  // Fired on blur, once per distinct pair - the first analytics signal
  // this step ever had for "typed something but it didn't validate".
  function handleDimensionBlur() {
    if (!profile || widthNum <= 0 || heightNum <= 0) return;
    const key = `${widthNum}x${heightNum}:${dimensionsValid ? 1 : 0}`;
    if (key === lastTrackedDimsRef.current) return;
    lastTrackedDimsRef.current = key;
    if (dimensionsValid) {
      trackShopStep("enter_dimensions", "plisy", {
        width_mm: widthNum,
        height_mm: heightNum,
        qty: quantityNum,
        unit: dimensionUnit,
      });
    } else {
      trackShopStep("dimensions_invalid", "plisy", {
        width_mm: widthNum,
        height_mm: heightNum,
        unit: dimensionUnit,
        looks_like_cm: looksLikeCm,
      });
    }
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSagAccepted(false);
  }, [selectedFabricGroupId]);

  const matrixUnitPrice =
    profile && dimensionsValid && selectedHardwareId && selectedFabricGroupId
      ? calcPlisyPrice(
          { ...profile, priceAdjustmentPercent: profile.priceAdjustmentPercent + priceAdjustmentPercent },
          widthNum,
          heightNum,
          selectedHardwareId,
          selectedFabricGroupId,
        )
      : null;
  // Every step's "Dopłata / rabat" (montaż, kolor osprzętu, kolor tkaniny)
  // lands in the charged price now, not just mount's - each is a badge on
  // its own swatch, so it has to actually be applied or the badge would be
  // advertising a cost nobody pays. Order is fixed by the business owner:
  // matrix price first, then every flat-zł delta added, then every percent
  // delta combined into one multiplier applied last - see
  // applyPriceDeltas() in shared.ts.
  const unitPrice =
    matrixUnitPrice !== null ? applyPriceDeltas(matrixUnitPrice, [selectedMount, selectedHardware, selectedFabric]) : null;
  const totalPrice = unitPrice !== null ? Math.round(unitPrice * quantityNum * 100) / 100 : null;

  // Regular price struck, SEZON20 price next to it - only while the code is
  // actually active (promo prop), so this never promises what the cart
  // won't do. Before this the panel said 147,60 and the cart 118,08 for
  // the same blind, and the ad had said 131.
  function renderPrice(amount: number) {
    const discounted = promo ? applyPromoToPrice(amount, promo) : null;
    if (discounted === null || discounted >= amount) return formatZl(amount);
    return (
      <span className="plisy-price-promo">
        <s>{formatZl(amount)}</s>
        {formatZl(discounted)}
        <small>z kodem {PROMO_CODE}</small>
      </span>
    );
  }

  // Adds the currently-filled-in width/height/qty as one more position on
  // the set, then clears the fields so the next size can go straight in.
  // Nothing is sent to the parent/cart yet - see handleFinalSubmit.
  // While a saved position is being edited (editingPositionId, owner
  // 2026-09-17: "każdą zapisaną pozycję muszę móc edytować") the same
  // button saves the fields back into THAT row instead of appending.
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);
  const currentPosition = (): PlisyPosition | null =>
    dimensionsValid && unitPrice !== null && totalPrice !== null
      ? {
          id: editingPositionId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          widthMm: widthNum,
          heightMm: heightNum,
          qty: quantityNum,
          unitPrice,
          totalPrice,
          oversizeSurchargeAmount: oversizeSurcharge,
        }
      : null;

  function clearPositionForm() {
    setWidth("");
    setHeight("");
    setQuantity("1");
    setSagAccepted(false);
    setEditingPositionId(null);
  }

  function handleAddPosition() {
    const next = currentPosition();
    if (!next || sagBlocked) return;
    if (editingPositionId) {
      setPositions((prev) => prev.map((position) => (position.id === editingPositionId ? next : position)));
      trackShopStep("edit_position_save", "plisy", { width_mm: next.widthMm, height_mm: next.heightMm, qty: next.qty });
    } else {
      setPositions((prev) => [...prev, next]);
    }
    clearPositionForm();
  }

  function handleRemovePosition(id: string) {
    setPositions((prev) => prev.filter((position) => position.id !== id));
    if (editingPositionId === id) clearPositionForm();
  }

  // Pulls a saved row back into the fields (in whichever unit is on) and
  // opens the size step on it; "+ Dodaj kolejną" becomes "Zapisz zmiany".
  function handleEditPosition(position: PlisyPosition) {
    setEditingPositionId(position.id);
    setWidth(mmToInput(position.widthMm, dimensionUnit));
    setHeight(mmToInput(position.heightMm, dimensionUnit));
    setQuantity(String(position.qty));
    setSagAccepted(true);
    setStepFiveCollapsed(false);
    trackShopStep("edit_position_open", "plisy", { width_mm: position.widthMm, height_mm: position.heightMm, qty: position.qty });
    window.setTimeout(() => {
      positionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }
  const positionFormRef = useRef<HTMLDivElement | null>(null);

  const positionsGrandTotal = useMemo(
    () => positions.reduce((sum, position) => sum + position.totalPrice, 0),
    [positions],
  );

  // A customer who only ever wants one size never has to touch "+ Dodaj
  // kolejną" at all - the button is enabled off the currently-filled-in
  // form too, and a valid one still sitting in the fields gets folded into
  // the set right before it's sent, so nothing typed-but-not-yet-added is
  // silently dropped.
  const canFinalSubmit = bracketChosen && !sagBlocked && (positions.length > 0 || (dimensionsValid && totalPrice !== null));

  function handleFinalSubmit() {
    if (!canFinalSubmit) return;
    // A row mid-edit goes in with the edited values when they validate,
    // and as it was saved when they don't - never twice, never dropped.
    const pending = currentPosition();
    const finalPositions = editingPositionId
      ? positions.map((position) => (position.id === editingPositionId && pending ? pending : position))
      : pending
        ? [...positions, pending]
        : [...positions];
    if (finalPositions.length === 0) return;

    const base = {
      mountId: selectedMount?.id || "",
      mountLabel: joinPlisyMountLabel(selectedMount?.label || "", selectedBracket?.label),
      bracketColorId: selectedBracket?.id || "",
      bracketColorLabel: selectedBracket?.label || "",
      hardwareId: selectedHardware?.id || "",
      hardwareLabel: selectedHardware?.label || "",
      fabricGroupId: selectedFabricGroup?.id || "",
      fabricGroupLabel: selectedFabricGroup?.label || "",
      fabricId: selectedFabric?.id || "",
      fabricLabel: selectedFabric?.label || "",
      fabricColor: selectedFabric?.color || "",
      hardwareColor: selectedHardware?.color || "",
    };

    // Every earlier position goes in quietly (onAddVariant); only the last
    // one goes through onSubmit, so the parent's "Dodano do koszyka!"
    // takeover fires exactly once, after the whole set is in the cart.
    finalPositions.forEach((position, index) => {
      const result: ConfiguratorResult = {
        ...base,
        widthMm: position.widthMm,
        heightMm: position.heightMm,
        qty: position.qty,
        unitPrice: position.unitPrice,
        totalPrice: position.totalPrice,
        oversizeSurchargeAmount: position.oversizeSurchargeAmount,
      };
      if (index < finalPositions.length - 1 && onAddVariant) {
        onAddVariant(result);
      } else {
        onSubmit(result);
      }
    });
  }

  if (loadState === "loading") {
    return (
      <>
        <header>
          <strong>Wyceń plisę do swojego okna</strong>
        </header>
        <p className="hero-product-config-hint">Wczytuję konfigurator…</p>
      </>
    );
  }

  if (loadState === "error" || !profile) {
    return (
      <>
        <header>
          <strong>Wyceń plisę do swojego okna</strong>
        </header>
        <p className="hero-product-config-hint">
          Nie udało się wczytać konfiguratora. Odśwież stronę lub spróbuj ponownie za chwilę.
        </p>
      </>
    );
  }

  return (
    <>
      <header>
        <strong>Wyceń plisę do swojego okna</strong>
      </header>

      {profile.mountOptions.length > 0 ? (
        <section className={`hero-product-step-accordion hero-product-step-accordion--mount ${stepZeroCollapsed ? "is-collapsed" : ""}`}>
          <button
            type="button"
            className="hero-product-step-head"
            onClick={() => {
              trackShopStep("configurator_step_toggle", "mount_type", { collapsed_after: !stepZeroCollapsed });
              setStepZeroCollapsed((prev) => !prev);
            }}
            aria-expanded={stepZeroCollapsed ? "false" : "true"}
          >
            <span className="hero-product-config-step-title">
              <span className="hero-product-step-check" aria-hidden="true">✓</span>
              Wybierz sposób montażu
            </span>
            <span className="hero-product-step-head-meta">
              {selectedMount ? <strong>{selectedMount.label}</strong> : null}
              {stepZeroCollapsed ? (
                <span className="hero-product-step-head-change">Zmień</span>
              ) : (
                <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
              )}
            </span>
          </button>
          <div className="hero-product-step-body">
            <div className="hardware-grid hardware-grid--visual hero-product-hardware-grid hero-product-mount-grid">
              {profile.mountOptions.map((option) => {
                const isActive = option.id === selectedMountId;
                return (
                  <div key={option.id} className={`hardware-card ${isActive ? "is-active" : ""}`}>
                    <button
                      type="button"
                      className="hardware-card-main"
                      onClick={() => {
                        trackShopStep("select_mount_type", option.label, { option_id: option.id });
                        setSelectedMountId(option.id);
                        setStepZeroCollapsed(true);
                        if (!stepZeroChosen) setStepZeroChosen(true);
                        if (!isPlisyMountNonInvasive(option.id) && !isPlisyMountNonInvasive(option.label)) {
                          setSelectedBracketId("");
                        } else {
                          setStepBracketCollapsed(false);
                        }
                        window.setTimeout(() => {
                          scrollStepIntoView(stepOneRef.current);
                        }, 380);
                      }}
                    >
                      <span
                        className="hardware-card-image"
                        style={
                          option.imageUrl
                            ? {
                                // 360, not 320 - must be one of next.config's
                                // allow-listed imageSizes or the optimizer
                                // 400s (INVALID_IMAGE_OPTIMIZE_REQUEST),
                                // which silently renders as no background at
                                // all - exactly the bug this fix addresses,
                                // so getting this specific number right
                                // matters (verified live, not just built).
                                // No backgroundSize/backgroundPosition override
                                // here - .hero-product-hardware-grid
                                // .hardware-card-image's own CSS already sets
                                // a square box + background-size: contain, so
                                // the whole photo stays visible instead of
                                // getting cropped by "cover".
                                backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 360)})`,
                              }
                            : { backgroundImage: "linear-gradient(135deg, #E2E8F0 0%, #C8D0DA 100%)" }
                        }
                      />
                      <span className="hardware-card-footer">
                        <strong>{option.label}</strong>
                      </span>
                    </button>
                    {/* Both badges live as siblings of .hardware-card-main,
                        not inside it, deliberately - the button gets a
                        translateY transform on :hover/:focus-within, and a
                        transform on any ancestor becomes the new containing
                        block for position:absolute descendants, which made
                        these visibly jump a few px on hover when they used
                        to be nested inside it. Same fix approach as
                        .config-option-zoom below, which never had this bug
                        for the same reason. */}
                    {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                    {formatPriceDeltaBadge(option.priceDelta, option.priceDeltaType) ? (
                      <span className="hardware-price-badge">
                        {formatPriceDeltaBadge(option.priceDelta, option.priceDeltaType)}
                      </span>
                    ) : null}
                    {option.imageUrl ? (
                      <button
                        type="button"
                        className="config-option-zoom"
                        aria-label={`Powiększ: ${option.label}`}
                        onClick={() => openZoom({ title: option.label, urls: [option.imageUrl], index: 0 })}
                      >
                        🔍
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {selectedMount?.note ? <p className="hero-product-config-hint">{selectedMount.note}</p> : null}
          </div>
        </section>
      ) : null}

      {stepZeroChosen ? (
        <>
      <section className={`hero-product-step-accordion hero-product-step-accordion--hardware-color ${stepOneCollapsed ? "is-collapsed" : ""}`}>
        <button
          type="button"
          ref={stepOneRef}
          className="hero-product-step-head"
          onClick={() => {
            trackShopStep("configurator_step_toggle", "hardware_color", { collapsed_after: !stepOneCollapsed });
            setStepOneCollapsed((prev) => !prev);
          }}
          aria-expanded={stepOneCollapsed ? "false" : "true"}
        >
          <span className="hero-product-config-step-title hero-product-config-step-title--muted">
            <span className={`hero-product-step-check ${selectedHardware ? "" : "is-muted"}`} aria-hidden="true">
              {selectedHardware ? "✓" : "2"}
            </span>
            Wybierz kolor mechanizmu
          </span>
          <span className="hero-product-step-head-meta">
            {selectedHardware && stepOneCollapsed ? (
              <span
                className="hero-product-step-head-swatch"
                style={buildPlisyHardwareSwatchStyle(selectedHardware.imageUrl, selectedHardware.color)}
                aria-hidden="true"
              />
            ) : null}
            {selectedHardware ? <strong>{selectedHardware.label}</strong> : null}
            {stepOneCollapsed ? (
              <span className="hero-product-step-head-change">Zmień</span>
            ) : (
              <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
            )}
          </span>
        </button>
        <div className="hero-product-step-body">
          <div className="hardware-grid hardware-grid--visual hero-product-hardware-grid hero-product-hardware-color-grid">
            {profile.hardware.map((option, index) => {
              const isActive = option.id === selectedHardwareId;
              const isLastSolo = profile.hardware.length % 3 === 1 && index === profile.hardware.length - 1;
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
                      window.setTimeout(() => {
                        scrollStepIntoView(bracketRequired && !selectedBracketId ? stepBracketRef.current : stepTwoRef.current);
                      }, 380);
                    }}
                  >
                    <span
                      className="hardware-card-image"
                      style={buildPlisyHardwareSwatchStyle(option.imageUrl, option.color)}
                    />
                    {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                    <span className="hardware-card-footer">
                      <span className="hardware-dot" style={{ background: option.color }} />
                      <strong>{option.label}</strong>
                    </span>
                  </button>
                  {option.imageUrl ? (
                    <button
                      type="button"
                      className="config-option-zoom"
                      aria-label={`Powiększ: ${option.label}`}
                      onClick={() => openZoom({ title: option.label, urls: [option.imageUrl], index: 0 })}
                    >
                      🔍
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {stepOneChosen && bracketRequired ? (
        <section className={`hero-product-step-accordion hero-product-step-accordion--bracket ${stepBracketCollapsed ? "is-collapsed" : ""}`}>
          <button
            type="button"
            ref={stepBracketRef}
            className="hero-product-step-head"
            onClick={() => {
              trackShopStep("configurator_step_toggle", "bracket_color", { collapsed_after: !stepBracketCollapsed });
              setStepBracketCollapsed((prev) => !prev);
            }}
            aria-expanded={stepBracketCollapsed ? "false" : "true"}
          >
            <span className="hero-product-config-step-title hero-product-config-step-title--muted">
              <span className={`hero-product-step-check ${selectedBracket ? "" : "is-muted"}`} aria-hidden="true">
                {selectedBracket ? "✓" : "3"}
              </span>
              Wybierz kolor uchwytów bezinwazyjnych
            </span>
            <span className="hero-product-step-head-meta">
              {selectedBracket && stepBracketCollapsed ? (
                <span className="hero-product-step-head-swatch" style={{ background: selectedBracket.color }} aria-hidden="true" />
              ) : null}
              {selectedBracket ? <strong>{selectedBracket.label}</strong> : null}
              {stepBracketCollapsed ? (
                <span className="hero-product-step-head-change">Zmień</span>
              ) : (
                <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
              )}
            </span>
          </button>
          <div className="hero-product-step-body">
            <p className="hero-product-config-hint">Uchwyty zakładane na skrzydło są widoczne od strony pokoju — dobierz kolor do okna.</p>
            <div className="plisy-bracket-grid">
              {PLISY_BRACKET_COLORS.map((entry) => {
                const isActive = entry.id === selectedBracketId;
                return (
                  <button
                    key={entry.id}
                    type="button"
                    className={`plisy-bracket-option ${isActive ? "is-active" : ""}`}
                    onClick={() => {
                      trackShopStep("select_bracket_color", entry.label, { option_id: entry.id });
                      setSelectedBracketId(entry.id);
                      setStepBracketCollapsed(true);
                      window.setTimeout(() => {
                        scrollStepIntoView(stepTwoRef.current);
                      }, 380);
                    }}
                  >
                    <span className="plisy-bracket-dot" style={{ background: entry.color }} aria-hidden="true" />
                    <strong>{entry.label}</strong>
                    {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        </section>
      ) : null}

      {stepOneChosen && !bracketChosen ? (
        <p className="hero-product-config-hint">Wybierz kolor uchwytów, aby przejść do kolejnego kroku.</p>
      ) : null}

      {stepOneChosen && bracketChosen ? (
        <>
          <section className={`hero-product-step-accordion ${stepTwoCollapsed ? "is-collapsed" : ""}`}>
            <button
              type="button"
              ref={stepTwoRef}
              className="hero-product-step-head"
              onClick={() => {
                trackShopStep("configurator_step_toggle", "fabric_group", { collapsed_after: !stepTwoCollapsed });
                setStepTwoCollapsed((prev) => !prev);
              }}
              aria-expanded={stepTwoCollapsed ? "false" : "true"}
            >
              <span className="hero-product-config-step-title hero-product-config-step-title--muted">
                <span className={`hero-product-step-check ${fabricGroupChosen ? "" : "is-muted"}`} aria-hidden="true">
                  {fabricGroupChosen ? "✓" : String(3 + stepShift)}
                </span>
                Wybierz kolekcję tkaniny
              </span>
              <span className="hero-product-step-head-meta">
                {selectedFabricGroup ? <strong>{selectedFabricGroup.label}</strong> : null}
                {stepTwoCollapsed ? (
                  <span className="hero-product-step-head-change">Zmień</span>
                ) : (
                  <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
                )}
              </span>
            </button>
            <div
              className="hero-product-step-body"
              style={stepTwoCollapsed ? undefined : { maxHeight: "none", overflow: "visible" }}
            >
              {/* Owner, 2026-09-17: the CRM's collection photos are all
                  near-white close-ups, indistinguishable at card size. Each
                  card now shows what the fabric DOES (light / blackout /
                  reflex / honeycomb - CollectionVisual.tsx), one line of
                  plain words, and a strip of that collection's real colours. */}
              <div className="plisy-coll-grid">
                {profile.fabricGroups.map((group) => {
                  const isActive = group.id === selectedFabricGroupId;
                  const kind = plisyCollectionKind(group);
                  const meta = plisyCollectionMeta(kind);
                  const mosaic = group.swatches.filter((swatch) => swatch.thumbnailUrl || swatch.imageUrl).slice(0, 6);
                  const extra = group.swatches.length - mosaic.length;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={`hero-product-mesh-option plisy-coll-card ${isActive ? "is-active" : ""}`}
                      title={group.note || group.label}
                      onClick={() => {
                        trackShopStep("select_fabric_group", group.label, { option_id: group.id });
                        setSelectedFabricGroupId(group.id);
                        setStepTwoCollapsed(true);
                        window.setTimeout(() => {
                          scrollStepIntoView(stepThreeRef.current);
                        }, 380);
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
                              <span key={badge} className={`plisy-coll-card-badge ${badge === "Zaciemnia" ? "is-dark" : badge === "Termo" ? "is-thermo" : ""}`}>
                                {badge}
                              </span>
                            ))}
                          </span>
                        </span>
                        <span className="plisy-coll-card-note">{meta.light}</span>
                        {mosaic.length ? (
                          <span className="plisy-coll-card-mosaic" aria-label={`${group.swatches.length} kolorów w kolekcji`}>
                            {mosaic.map((swatch) => (
                              <img key={swatch.id} src={optimizeImageUrl(swatch.thumbnailUrl || swatch.imageUrl, 96)} alt="" loading="lazy" />
                            ))}
                            <em>{extra > 0 ? `+${extra}` : `${group.swatches.length} kol.`}</em>
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
                <button
                  type="button"
                  ref={stepThreeRef}
                  className="hero-product-step-head"
                  onClick={() => {
                    trackShopStep("configurator_step_toggle", "fabric_color", { collapsed_after: !stepThreeCollapsed });
                    setStepThreeCollapsed((prev) => !prev);
                  }}
                  aria-expanded={stepThreeCollapsed ? "false" : "true"}
                >
                  <span className="hero-product-config-step-title hero-product-config-step-title--muted">
                    <span className={`hero-product-step-check ${fabricChosen ? "" : "is-muted"}`} aria-hidden="true">
                      {fabricChosen ? "✓" : String(4 + stepShift)}
                    </span>
                    Wybierz kolor tkaniny
                  </span>
                  <span className="hero-product-step-head-meta">
                    {selectedFabric && stepThreeCollapsed ? (
                      <span
                        className="hero-product-step-head-swatch"
                        style={buildPlisyHardwareSwatchStyle(selectedFabric.thumbnailUrl, selectedFabric.color)}
                        aria-hidden="true"
                      />
                    ) : null}
                    {selectedFabric ? <strong>{selectedFabric.label}</strong> : null}
                    {stepThreeCollapsed ? (
                      <span className="hero-product-step-head-change">Zmień</span>
                    ) : (
                      <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
                    )}
                  </span>
                </button>
                <div className="hero-product-step-body">
                  {swatchesForGroup.length ? (
                    <div className="plisy-fabric-tools">
                      <button
                        type="button"
                        className="plisy-fabric-gallery-cta"
                        onClick={() => {
                          const at = Math.max(0, swatchesForGroup.findIndex((swatch) => swatch.id === selectedFabricId));
                          setFabricGalleryIndex(at);
                          trackShopStep("fabric_gallery_open", selectedFabricGroup?.label || "", { source: "cta" });
                        }}
                      >
                        🔍 Zobacz duże zdjęcia tkanin
                      </button>
                    </div>
                  ) : null}
                  <div className="hero-product-mesh-grid hero-product-mesh-grid--visual">
                    {swatchesForGroup.map((swatch, swatchIndex) => {
                      const isActive = swatch.id === selectedFabricId;
                      return (
                        <div key={swatch.id} className="plisy-swatch-cell">
                          <button
                            type="button"
                            className={`hero-product-mesh-option hero-product-mesh-option--visual ${isActive ? "is-active" : ""}`}
                            title={swatch.label}
                            onClick={() => {
                              trackShopStep("select_fabric_color", swatch.label, { option_id: swatch.id });
                              setSelectedFabricId(swatch.id);
                              setStepThreeCollapsed(true);
                              window.setTimeout(() => {
                                scrollStepIntoView(stepFourRef.current);
                              }, 380);
                            }}
                          >
                            <span
                              className="hero-product-mesh-option-image"
                              style={buildPlisyHardwareSwatchStyle(swatch.thumbnailUrl, swatch.color)}
                            />
                            <strong>{swatch.label}</strong>
                          </button>
                          <button
                            type="button"
                            className="plisy-swatch-zoom"
                            aria-label={`Powiększ ${swatch.label}`}
                            title="Powiększ"
                            onClick={(event) => {
                              event.stopPropagation();
                              setFabricGalleryIndex(swatchIndex);
                              trackShopStep("fabric_gallery_open", swatch.label, { source: "swatch", option_id: swatch.id });
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
                        trackShopStep("select_fabric_color", swatch.label, { option_id: swatch.id, source: "gallery" });
                        setSelectedFabricId(swatch.id);
                        setFabricGalleryIndex(null);
                        setStepThreeCollapsed(true);
                        window.setTimeout(() => {
                          scrollStepIntoView(stepFourRef.current);
                        }, 380);
                      }}
                    />
                  ) : null}
                </div>
              </section>

              {fabricChosen ? (
                <div ref={stepFourRef} className="hero-product-mini-summary is-revealed">
                  <h3>Plisa</h3>
                  <div className="hero-product-mini-summary-body">
                    {/* Just the plisa itself (tinted live from the chosen
                        colours) on a plain soft gradient backdrop - dropped
                        the room/window stock photo (2026-09-09): kept
                        fighting to get one exact photo's framing right for
                        no real payoff over just showing the blind clearly. */}
                    <div className="plisa-preview-stage">
                      <PlisaPreview
                        fabricColor={selectedFabric?.color || ""}
                        hardwareColor={selectedHardware?.color || ""}
                        fabricLabel={selectedFabric?.label}
                        hardwareLabel={selectedHardware?.label}
                      />
                    </div>
                    <dl>
                      {selectedMount ? (
                        <div>
                          <dt>Rodzaj montażu</dt>
                          <dd>{selectedMount.label}</dd>
                        </div>
                      ) : null}
                      <div>
                        <dt>Kolor mechanizmu</dt>
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
                    </dl>
                  </div>

                  {/* Wymiary + ilość budują tu KOLEJNE POZYCJE zestawu (ten
                      sam montaż/mechanizm/tkanina, inny rozmiar okna) -
                      "+ Dodaj kolejną" odkłada bieżący wpis na listę poniżej
                      i czyści pola pod następny rozmiar. Nic nie trafia do
                      koszyka, dopóki nie padnie jedno finalne CTA na samym
                      dole (patrz handleFinalSubmit). Własny akordeon (jak
                      kroki 1-4 powyżej) - w /koszyk "Edytuj pozycję" startuje
                      zwinięty, pokazując bieżący wymiar/ilość jako
                      podsumowanie; przy świeżej konfiguracji (brak
                      initialValues) zostaje rozwinięty jak dotychczas. */}
                  <section
                    className={`hero-product-step-accordion hero-product-step-accordion--dimensions ${stepFiveCollapsed ? "is-collapsed" : ""}`}
                  >
                    <button
                      type="button"
                      className="hero-product-step-head"
                      onClick={() => {
                        trackShopStep("configurator_step_toggle", "dimensions", { collapsed_after: !stepFiveCollapsed });
                        setStepFiveCollapsed((prev) => !prev);
                      }}
                      aria-expanded={stepFiveCollapsed ? "false" : "true"}
                    >
                      <span className="hero-product-config-step-title hero-product-config-step-title--muted">
                        <span className={`hero-product-step-check ${dimensionsValid ? "" : "is-muted"}`} aria-hidden="true">
                          {dimensionsValid ? "✓" : String(5 + stepShift)}
                        </span>
                        Wymiary i ilość
                      </span>
                      <span className="hero-product-step-head-meta">
                        {dimensionsValid ? (
                          <strong>
                            {widthNum} × {heightNum} mm · {quantityNum} szt.
                          </strong>
                        ) : null}
                        {stepFiveCollapsed ? (
                          <span className="hero-product-step-head-change">Zmień</span>
                        ) : (
                          <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
                        )}
                      </span>
                    </button>
                    <div className="hero-product-step-body">
                      <div className={`plisy-position-form ${editingPositionId ? "is-editing" : ""}`} ref={positionFormRef}>
                        {editingPositionId ? (
                          <p className="plisy-position-editing">
                            Edytujesz pozycję {positions.findIndex((position) => position.id === editingPositionId) + 1} z zestawu.
                            <button type="button" onClick={clearPositionForm}>
                              Anuluj
                            </button>
                          </p>
                        ) : null}
                        <p className="hero-product-config-hint">
                          {measureModeForMount(selectedMountId) === "bezinwazyjny"
                            ? "Montaż bezinwazyjny: szerokość od kreseczki do kreseczki (szyba razem z listwami), wysokość całego skrzydła."
                            : "Montaż STANDARD: szerokość i wysokość od połowy uszczelki do połowy uszczelki, nic nie odejmuj."}{" "}
                          Podaj w {dimensionUnit === "cm" ? "centymetrach" : "milimetrach"} i ilość sztuk w tym rozmiarze.{" "}
                          <button
                            type="button"
                            className="plisy-measure-link"
                            onClick={() => {
                              setMeasureGuideOpen(true);
                              trackShopStep("configurator_measure_guide", "open", { mount: measureModeForMount(selectedMountId) });
                            }}
                          >
                            📐 Jak mierzyć?
                          </button>
                        </p>
                        <div className="plisy-dimensions-tools">
                          <div className="hero-product-unit-toggle" role="group" aria-label="Jednostka wymiarów">
                            <button
                              type="button"
                              className={dimensionUnit === "cm" ? "is-active" : ""}
                              aria-pressed={dimensionUnit === "cm"}
                              onClick={() => switchDimensionUnit("cm")}
                            >
                              cm
                            </button>
                            <button
                              type="button"
                              className={dimensionUnit === "mm" ? "is-active" : ""}
                              aria-pressed={dimensionUnit === "mm"}
                              onClick={() => switchDimensionUnit("mm")}
                            >
                              mm
                            </button>
                          </div>
                          <button type="button" className="plisy-measure-later" onClick={openMeasureLater} disabled={measureSaveBusy}>
                            <strong>Nie masz wymiarów?</strong>
                            <span>Zapisz lub udostępnij link do tej konfiguracji i dokończ w dowolnym momencie</span>
                          </button>
                        </div>
                        {measureGuideOpen && typeof document !== "undefined"
                          ? createPortal(
                              <div
                                className="instruction-modal instruction-modal--measure"
                                role="dialog"
                                aria-modal="true"
                                aria-label="Jak mierzyć plisę"
                                onClick={() => setMeasureGuideOpen(false)}
                              >
                                <div className="instruction-modal-shell instruction-modal-shell--measure" onClick={(event) => event.stopPropagation()}>
                                  <button type="button" className="instruction-modal-close" aria-label="Zamknij instrukcję" onClick={() => setMeasureGuideOpen(false)}>
                                    ×
                                  </button>
                                  <h3>Jak zmierzyć okno pod plisę</h3>
                                  <PlisyMeasureGuide fixedMode={measureModeForMount(selectedMountId)} startDelayMs={700} unit={dimensionUnit} />
                                </div>
                              </div>,
                              document.body,
                            )
                          : null}
                        {measureSave ? (
                          <PromoSaveModal
                            variant="measure"
                            quoteCode={measureSave.quoteCode}
                            shareUrl={measureSave.shareUrl}
                            remainingMs={measureSave.remainingMs}
                            onClose={() => setMeasureSave(null)}
                          />
                        ) : null}
                        <div className="hero-product-dimensions-grid">
                          <label>
                            Szerokość ({dimensionUnit})
                            <input
                              type="number"
                              inputMode={dimensionUnit === "cm" ? "decimal" : "numeric"}
                              step={dimensionUnit === "cm" ? 0.1 : 1}
                              min={dimensionUnit === "cm" ? profile.widthMinMm / 10 : profile.widthMinMm}
                              max={dimensionUnit === "cm" ? profile.widthMaxMm / 10 : profile.widthMaxMm}
                              placeholder={`np. ${mmToInput(profile.widthDefaultMm, dimensionUnit)}`}
                              value={width}
                              onChange={(event) => setWidth(event.target.value)}
                              onBlur={handleDimensionBlur}
                            />
                          </label>
                          <label>
                            Wysokość ({dimensionUnit})
                            <input
                              type="number"
                              inputMode={dimensionUnit === "cm" ? "decimal" : "numeric"}
                              step={dimensionUnit === "cm" ? 0.1 : 1}
                              min={dimensionUnit === "cm" ? profile.heightMinMm / 10 : profile.heightMinMm}
                              max={dimensionUnit === "cm" ? profile.heightMaxMm / 10 : profile.heightMaxMm}
                              placeholder={`np. ${mmToInput(profile.heightDefaultMm, dimensionUnit)}`}
                              value={height}
                              onChange={(event) => setHeight(event.target.value)}
                              onBlur={handleDimensionBlur}
                            />
                          </label>
                          <label>
                            Ilość
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={20}
                              value={quantity}
                              onChange={(event) => setQuantity(event.target.value)}
                            />
                          </label>
                        </div>
                        {(width || height) && !dimensionsValid ? (
                          <div className="hero-product-dimensions-error">
                            {looksLikeCm ? (
                              <p className="plisy-dimensions-hint">
                                {widthNum} × {heightNum} mm to tylko {widthNum / 10} × {heightNum / 10} cm — mniej niż najmniejsza plisa.
                                Wygląda na centymetry.
                                <button type="button" onClick={() => switchDimensionUnit("cm", false)}>
                                  Tak, to centymetry
                                </button>
                              </p>
                            ) : (
                              <p>
                                Szerokość {formatRange(profile.widthMinMm, profile.widthMaxMm)}, wysokość{" "}
                                {formatRange(profile.heightMinMm, profile.heightMaxMm)}.
                                {dimensionUnit === "mm" ? " Masz wymiar w centymetrach? Przełącz jednostkę powyżej." : ""}
                              </p>
                            )}
                          </div>
                        ) : null}
                        {sagWarning ? (
                          <div className={`plisy-sag-notice ${sagAccepted ? "is-accepted" : ""}`} role="note">
                            <p>
                              <strong>Szerokość powyżej {sagLimitMm / 10} cm.</strong> Przy tej szerokości profil aluminiowy może się
                              lekko ugiąć pod ciężarem tkaniny (grawitacja). To naturalne zjawisko — nie wpływa na działanie plisy, jedynie na jej
                              estetykę.
                            </p>
                            {sagAccepted ? (
                              <span className="plisy-sag-accepted">✓ Zaakceptowano</span>
                            ) : (
                              <button
                                type="button"
                                className="plisy-sag-accept"
                                onClick={() => {
                                  trackShopStep("accept_sag_notice", String(widthNum), { limit_mm: sagLimitMm });
                                  setSagAccepted(true);
                                }}
                              >
                                Akceptuję
                              </button>
                            )}
                          </div>
                        ) : null}
                        {oversizeSurcharge > 0 ? (
                          <p className="plisy-oversize-note">
                            Szerokość powyżej {PLISY_OVERSIZE_WIDTH_MM / 10} cm: dopłata za przesyłkę dłużycową{" "}
                            <strong>+{formatZl(oversizeSurcharge)}</strong> (jednorazowo dla całego zamówienia, doliczana w koszyku).
                          </p>
                        ) : null}
                        <div className="plisy-position-form-footer">
                          <span className="plisy-position-price">{totalPrice !== null ? renderPrice(totalPrice) : "--"}</span>
                          <button
                            type="button"
                            className="plisy-position-add"
                            onClick={handleAddPosition}
                            disabled={!dimensionsValid || totalPrice === null || sagBlocked}
                          >
                            {editingPositionId ? "Zapisz zmiany" : "+ Dodaj kolejną"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  {positions.length > 0 ? (
                    <div className="plisy-positions-list">
                      <h4>Twój zestaw</h4>
                      {positions.map((position, index) => (
                        <div key={position.id} className={`plisy-positions-row ${position.id === editingPositionId ? "is-editing" : ""}`}>
                          <span className="plisy-positions-row-label">
                            {index + 1}. {position.widthMm / 10} × {position.heightMm / 10} cm, {position.qty} szt.
                          </span>
                          <span className="plisy-positions-row-price">{renderPrice(position.totalPrice)}</span>
                          <button
                            type="button"
                            className="plisy-positions-row-edit"
                            onClick={() => handleEditPosition(position)}
                            aria-label={`Edytuj pozycję ${index + 1}`}
                          >
                            Edytuj
                          </button>
                          <button
                            type="button"
                            className="plisy-positions-row-remove"
                            onClick={() => handleRemovePosition(position.id)}
                            aria-label={`Usuń pozycję ${index + 1}`}
                          >
                            ×
                          </button>
                        </div>
                      ))}
                      <div className="plisy-positions-total">
                        <span>Razem za cały zestaw</span>
                        <strong>{renderPrice(positionsGrandTotal)}</strong>
                      </div>
                    </div>
                  ) : null}

                  <button
                    type="button"
                    className="hero-product-add-to-cart"
                    onClick={handleFinalSubmit}
                    disabled={!canFinalSubmit}
                  >
                    {submitLabel}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      {!stepOneChosen ? (
        <p className="hero-product-config-hint">Wybierz kolor mechanizmu, aby przejść do kolejnego kroku.</p>
      ) : null}
        </>
      ) : (
        <p className="hero-product-config-hint">Wybierz sposób montażu, aby przejść do kolejnego kroku.</p>
      )}

      {!onZoom && internalZoomPreview ? (
        <div
          className="config-option-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label={internalZoomPreview.title}
          onClick={() => setInternalZoomPreview(null)}
        >
          <div className="config-option-preview-shell" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="config-option-preview-close"
              onClick={() => setInternalZoomPreview(null)}
              aria-label="Zamknij podgląd"
            >
              ×
            </button>
            <img
              src={optimizeImageUrl(internalZoomPreview.urls[internalZoomPreview.index], 1200, 80)}
              alt={internalZoomPreview.title}
              className="config-option-preview-image"
              loading="eager"
            />
            <p>{internalZoomPreview.title}</p>
          </div>
        </div>
      ) : null}
    </>
  );
}
