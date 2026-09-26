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
import { clearConfiguratorState, reportConfiguratorState } from "@/lib/configurator-state";
import { usePlisyFavourites } from "@/lib/plisy-favourites";
import { useBackToClose } from "@/lib/use-back-to-close";
import { applyPromoToPrice, getPromoRemainingMs, PROMO_CODE, type PromoPreview } from "@/lib/promo";
import { ensurePromoQuoteCode } from "@/lib/promo-save";
import PromoSaveModal from "@/app/components/promo-save-modal";
import InstallmentOffer from "@/app/components/installment-offer";
import PlisaPreview from "./PlisaPreview";
import PlisyMeasureGuide, { measureModeForMount } from "./MeasureGuide";
import MeasureShare from "./MeasureShare";
import PlisyFabricGallery from "./FabricGallery";
import { PlisyCollectionVisual, plisyCollectionKind, plisyCollectionMeta, plisyColorCountLabel } from "./CollectionVisual";
import PlisyCollectionBackdrop from "./CollectionBackdrop";
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
  findPlisyMountByLabel,
  plisyMountLabel,
  plisyMountShortNote,
  type FabricGroup,
  type FabricSwatch,
  type MountOption,
  type ConfiguratorInitialValues,
  type ConfiguratorResult,
  type PlisyProfile,
} from "./shared";

type ZoomPreview = { title: string; urls: string[]; index: number };

// One line of the customer's set: same mount/hardware/fabric (chosen once,
// shared by the whole set) but its own width/height/qty - see the
// "positions" state below for how these get built up before a single final
// add-to-cart flushes all of them at once.
// Sam rozmiar - bez ceny. Odkąd wymiary są krokiem 1 (przebudowa
// 2026-09-24), w chwili dodawania pozycji nie znamy jeszcze mechanizmu ani
// kolekcji. Cena każdej pozycji liczy się z bieżącego wyboru
// (priceForSize), dzięki czemu zmiana kolekcji przelicza cały zestaw i przy
// wyborze kolekcji można pokazać cenę TYCH okien.
type PlisyPosition = {
  id: string;
  widthMm: number;
  heightMm: number;
  qty: number;
};

/** "1 pozycja" / "2 pozycje" / "5 pozycji" - nagłówek zwiniętego kroku 1. */
function pozycjeLabel(count: number): string {
  if (count === 1) return "1 pozycja";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} pozycje`;
  return `${count} pozycji`;
}

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
        trackShopStep("configurator_load_failed", "plisy", { ms_since_nav: Math.round(performance.now()) });
        return;
      }
      setProfile(result);
      setLoadState("ready");
      trackShopStep("configurator_ready", "plisy", { ms_since_nav: Math.round(performance.now()) });
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
  // A returning visitor whose steps 1-4 came back from the 7-day draft
  // (2026-09-18): the one signal we had none of - how many people come back
  // and how many of those finish. Once per mount.
  useEffect(() => {
    if (!draftSeed || !draftSeed.savedAt) return;
    const ageHours = Math.round((Date.now() - draftSeed.savedAt) / 36e5);
    if (ageHours < 1) return; // same-session remount (e.g. quick-price -> configurator), not a return
    trackShopStep("draft_restored", "plisy", { age_h: ageHours, mount: draftSeed.mountId || "", fabric: draftSeed.fabricId || "" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
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
  // Zmiana sposobu montażu po wpisaniu wymiarów = wymiary są do wyrzucenia,
  // bo bezinwazyjny mierzy się zupełnie inaczej niż przykręcany (właściciel,
  // 2026-09-24: "jak klient zmieni na bezinwazyjny to potrzebujemy INNYCH
  // wymiarów (!)"). Dopóki klient tego nie rozstrzygnie, nic nie trafi do
  // koszyka.
  const [mountNotice, setMountNotice] = useState<{ previousMountId: string; previousLabel: string } | null>(null);
  // Krok 1 (montaż) startuje rozwinięty przy świeżej konfiguracji - montaż
  // przykręcany jest wybrany domyślnie, ale klient ma go widzieć. Edycja z
  // koszyka otwiera wszystko zwinięte.
  const [stepMountCollapsed, setStepMountCollapsed] = useState(Boolean(isCartEdit));
  // Opis kolekcji przeniesiony z kafelka do modalu (właściciel, 2026-09-24:
  // "za dużo treści pod swatchami").
  const [collectionInfoId, setCollectionInfoId] = useState("");
  // Edytowana pozycja zestawu (null = wpisywana nowa). Deklarowana tu,
  // wysoko, bo effectivePositions poniżej jej potrzebuje.
  const [editingPositionId, setEditingPositionId] = useState<string | null>(null);

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

  // Przełącznik NIE przelicza wpisanych liczb (właściciel, 2026-09-24):
  // kto wpisał 55, myśląc o centymetrach, po przełączeniu na cm ma mieć 55
  // cm, a nie 5,5 cm. Jednostka zmienia się pod wpisaną wartością - to samo
  // robi podpowiedź "Tak, to centymetry" przy podejrzanie małych liczbach.
  function switchDimensionUnit(next: DimensionUnit) {
    if (next === dimensionUnit) return;
    setDimensionUnit(next);
    try {
      window.localStorage.setItem(DIMENSION_UNIT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    trackShopStep("dimension_unit", "plisy", { unit: next, converted: false });
  }
  // Wymiary/ilość is its own accordion too (2026-09-09, /koszyk's edit
  // modal) - same "collapsed if already known" rule as every step above,
  // so an existing cart item opens with EVERY choice tucked behind a
  // "Zmień" and the customer clicks whichever one they actually want to
  // change. A fresh configuration (no initialValues) still opens this
  // expanded, unaffected - there's nothing yet to collapse it around.
  // Only a /koszyk edit opens with the size tucked away - a size that came
  // from the quick-price block up top stays open with the price under it.
  const [stepDimsCollapsed, setStepDimsCollapsed] = useState(
    Boolean(isCartEdit && initialValues?.widthMm && initialValues?.heightMm),
  );
  // Ulubione tkaniny z landingu (serduszka przy próbnikach) - w kroku koloru
  // tkaniny wracają jako skrót, także gdy pochodzą z innej kolekcji.
  const { isFavourite: isFavouriteSwatch, toggle: toggleFavouriteSwatch, ids: favouriteIds } = usePlisyFavourites();
  const [internalZoomPreview, setInternalZoomPreview] = useState<ZoomPreview | null>(null);

  // "Nie masz jeszcze wymiarów?" - the save/share modal in its "measure"
  // variant: the same resume link the SEZON20 flows use (the quote code
  // remembers the visit), framed around coming back once the window is
  // measured. The draft above brings steps 1-4 back on return.
  const [measureSave, setMeasureSave] = useState<{ quoteCode: string; shareUrl: string; remainingMs: number } | null>(null);
  const [measureSaveBusy, setMeasureSaveBusy] = useState(false);

  // "Wstecz" zamyka wierzchni modal (instrukcja pomiaru, galeria tkanin,
  // opis kolekcji, powiększenie, zapis wyceny), nie cofa strony.
  useBackToClose(measureGuideOpen, () => setMeasureGuideOpen(false));
  useBackToClose(fabricGalleryIndex !== null, () => setFabricGalleryIndex(null));
  useBackToClose(Boolean(collectionInfoId), () => setCollectionInfoId(""));
  useBackToClose(Boolean(internalZoomPreview), () => setInternalZoomPreview(null));
  useBackToClose(Boolean(measureSave), () => setMeasureSave(null));
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

  // Montaż przykręcany do listwy (w CRM: "STANDARD") jest domyślny. Wymiary
  // są krokiem 1, a to montaż decyduje, JAK klient mierzy okno - bez
  // domyślnego montażu krok 1 nie miałby instrukcji pomiaru. Klient może go
  // zmienić w tym samym kroku; wtedy prosimy o nowy pomiar (mountNotice).
  useEffect(() => {
    if (!profile || selectedMountId) return;
    const standard = profile.mountOptions.find(
      (option) => !isPlisyMountNonInvasive(option.id) && !isPlisyMountNonInvasive(option.label),
    );
    const fallback = standard || profile.mountOptions[0];
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (fallback) setSelectedMountId(fallback.id);
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
      const match = findPlisyMountByLabel(profile.mountOptions, wanted);
      if (match) setSelectedMountId(match.id);
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
  const fabricChosen = Boolean(selectedFabric);

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

  // Zmiana kolekcji unieważnia kolor wybrany w poprzedniej. Sprawdzamy
  // SAMO ID w próbnikach nowej kolekcji - wcześniej warunek opierał się na
  // rozwiązanym obiekcie, który po przełączeniu jest już null, więc nigdy
  // nie wchodził i zostawało id z poprzedniej kolekcji.
  useEffect(() => {
    if (!selectedFabricId) return;
    if (swatchesForGroup.length === 0) return; // profil/kolekcja jeszcze się nie wczytały
    if (swatchesForGroup.some((swatch) => swatch.id === selectedFabricId)) return;
    setSelectedFabricId("");
    setStepThreeCollapsed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFabricGroupId, swatchesForGroup, selectedFabricId]);

  const widthNum = inputToMm(width, dimensionUnit);
  const heightNum = inputToMm(height, dimensionUnit);
  const dimensionsValid = profile
    ? widthNum >= profile.widthMinMm &&
      widthNum <= profile.widthMaxMm &&
      heightNum >= profile.heightMinMm &&
      heightNum <= profile.heightMaxMm
    : false;
  const quantityNum = Math.max(1, Number(quantity) || 1);

  // Pozycje, które faktycznie pójdą do koszyka: zapisane rozmiary + ten
  // właśnie wpisywany (o ile poprawny). Edytowana pozycja podmienia samą
  // siebie, nigdy się nie dubluje - ta sama reguła co w handleFinalSubmit.
  // Dzięki temu klient z jednym oknem nigdy nie musi klikać "+ Dodaj
  // kolejną", a ceny przy kolekcjach dotyczą całego zestawu.
  const typedPosition: PlisyPosition | null = dimensionsValid
    ? { id: editingPositionId || "__typed", widthMm: widthNum, heightMm: heightNum, qty: quantityNum }
    : null;
  const effectivePositions: PlisyPosition[] = editingPositionId
    ? positions.map((position) => (position.id === editingPositionId && typedPosition ? typedPosition : position))
    : typedPosition
      ? [...positions, typedPosition]
      : positions;
  const hasSizes = effectivePositions.length > 0;
  // Ugięcie profilu i dopłata dłużycowa dotyczą NAJSZERSZEGO okna zestawu,
  // nie tylko tego wpisywanego teraz - inaczej klient, który dodał 140 cm, a
  // potem wybrał DUO (niższy próg), nie zobaczyłby ostrzeżenia.
  const widestMm = effectivePositions.reduce((max, position) => Math.max(max, position.widthMm), 0);
  const sagLimitMm = plisySagWarningWidthMm(selectedFabricGroupId);
  const sagWarning = widestMm > sagLimitMm;
  const sagBlocked = sagWarning && !sagAccepted;
  const oversizeSurcharge = plisyOversizeSurcharge(widestMm);
  const remeasureRequired = Boolean(mountNotice);
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

  function priceForSize(
    widthMm: number,
    heightMm: number,
    qty: number,
    fabricGroupId: string,
    fabric: FabricSwatch | null,
  ): { unit: number; total: number } | null {
    if (!profile || !selectedHardwareId || !fabricGroupId) return null;
    const matrix = calcPlisyPrice(
      { ...profile, priceAdjustmentPercent: profile.priceAdjustmentPercent + priceAdjustmentPercent },
      widthMm,
      heightMm,
      selectedHardwareId,
      fabricGroupId,
    );
    if (matrix === null) return null;
    const unit = applyPriceDeltas(matrix, [selectedMount, selectedHardware, fabric]);
    return { unit, total: Math.round(unit * Math.max(1, qty) * 100) / 100 };
  }

  /** Cena całego zestawu w danej kolekcji - null, gdy choć jednej pozycji
   * nie da się wycenić (brak wiersza w matrycy). Tym liczone są ceny
   * pokazywane już przy kafelkach kolekcji. */
  function priceForSet(list: PlisyPosition[], fabricGroupId: string, fabric: FabricSwatch | null): number | null {
    if (list.length === 0) return null;
    let sum = 0;
    for (const position of list) {
      const price = priceForSize(position.widthMm, position.heightMm, position.qty, fabricGroupId, fabric);
      if (!price) return null;
      sum += price.total;
    }
    return Math.round(sum * 100) / 100;
  }

  const collectionInfoGroup: FabricGroup | null = collectionInfoId
    ? profile?.fabricGroups.find((group) => group.id === collectionInfoId) || null
    : null;
  const favouriteSwatches = useMemo(() => {
    if (!profile || favouriteIds.length === 0) return [] as Array<{ group: FabricGroup; swatch: FabricSwatch }>;
    const out: Array<{ group: FabricGroup; swatch: FabricSwatch }> = [];
    for (const group of profile.fabricGroups) {
      for (const swatch of group.swatches) {
        if (favouriteIds.includes(swatch.id)) out.push({ group, swatch });
      }
    }
    return out;
  }, [profile, favouriteIds]);

  const typedPrice = dimensionsValid
    ? priceForSize(widthNum, heightNum, quantityNum, selectedFabricGroupId, selectedFabric)
    : null;
  const setGrandTotal = priceForSet(effectivePositions, selectedFabricGroupId, selectedFabric);
  // Every step's "Dopłata / rabat" (montaż, kolor osprzętu, kolor tkaniny)
  // lands in the charged price now, not just mount's - each is a badge on
  // its own swatch, so it has to actually be applied or the badge would be
  // advertising a cost nobody pays. Order is fixed by the business owner:
  // matrix price first, then every flat-zł delta added, then every percent
  // delta combined into one multiplier applied last - see
  // applyPriceDeltas() in shared.ts.
  const unitPrice = typedPrice ? typedPrice.unit : null;
  const totalPrice = typedPrice ? typedPrice.total : null;

  // Zmiana ilości (poza pierwszym renderem) - do logu ruchu.
  const quantityTrackedRef = useRef(quantityNum);
  useEffect(() => {
    if (quantityTrackedRef.current === quantityNum) return;
    quantityTrackedRef.current = quantityNum;
    trackShopStep("set_quantity", "plisy", { qty: quantityNum });
  }, [quantityNum]);


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
  const currentPosition = (): PlisyPosition | null =>
    dimensionsValid
      ? {
          id: editingPositionId || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          widthMm: widthNum,
          heightMm: heightNum,
          qty: quantityNum,
        }
      : null;

  /** Wybór kolekcji tkanin. Kolor tkaniny z poprzedniej kolekcji przestaje
   * obowiązywać, więc kasujemy go od razu (nie czekając na efekt), zwijamy
   * krok kolekcji i otwieramy ten, który teraz jest do uzupełnienia. */
  function pickFabricGroup(groupId: string) {
    const changed = groupId !== selectedFabricGroupId;
    setSelectedFabricGroupId(groupId);
    setStepTwoCollapsed(true);
    if (changed) {
      setSelectedFabricId("");
      setStepThreeCollapsed(false);
    }
    window.setTimeout(() => {
      scrollStepIntoView(stepThreeRef.current);
    }, 380);
  }

  /** Klient zmienia sposób montażu. Jeśli ma już wymiary, to są wymiary do
   * innego montażu - prosimy o nowy pomiar zamiast po cichu przeliczać coś,
   * czego przeliczyć się nie da (bezinwazyjny: szerokość od kreseczki do
   * kreseczki i cała wysokość skrzydła; przykręcany: światło szyby). */
  function handleMountChange(option: MountOption) {
    if (option.id === selectedMountId) return;
    const previous = selectedMount;
    trackShopStep("select_mount_type", option.label, { option_id: option.id });
    setSelectedMountId(option.id);
    if (isPlisyMountNonInvasive(option.id) || isPlisyMountNonInvasive(option.label)) {
      setStepBracketCollapsed(false);
    } else {
      setSelectedBracketId("");
    }
    if (hasSizes || widthNum > 0 || heightNum > 0) {
      setMountNotice({ previousMountId: previous?.id || "", previousLabel: plisyMountLabel(previous) });
      setStepMountCollapsed(false);
      setStepDimsCollapsed(false);
      trackShopStep("mount_change_remeasure", option.label, { positions: positions.length });
    }
  }

  /** "Wpiszę nowe wymiary" - czyści cały zestaw, bo każdy zapisany rozmiar
   * był mierzony pod poprzedni montaż. */
  function acceptRemeasure() {
    trackShopStep("mount_change_remeasure", "clear", { positions: positions.length });
    setPositions([]);
    setWidth("");
    setHeight("");
    setQuantity("1");
    setSagAccepted(false);
    setEditingPositionId(null);
    setMountNotice(null);
  }

  /** "Zostaw poprzedni montaż" - wymiary zostają takie, jakie były. */
  function cancelMountChange() {
    if (!mountNotice) return;
    trackShopStep("mount_change_remeasure", "revert", { positions: positions.length });
    setSelectedMountId(mountNotice.previousMountId);
    if (!isPlisyMountNonInvasive(mountNotice.previousMountId)) setSelectedBracketId("");
    setMountNotice(null);
  }

  function clearPositionForm() {
    setWidth("");
    setHeight("");
    setQuantity("1");
    setSagAccepted(false);
    setEditingPositionId(null);
  }

  function handleAddPosition() {
    const next = currentPosition();
    if (!next || sagBlocked || remeasureRequired) return;
    if (editingPositionId) {
      setPositions((prev) => prev.map((position) => (position.id === editingPositionId ? next : position)));
      trackShopStep("edit_position_save", "plisy", { width_mm: next.widthMm, height_mm: next.heightMm, qty: next.qty });
    } else {
      setPositions((prev) => [...prev, next]);
      trackShopStep("add_position", "plisy", { width_mm: next.widthMm, height_mm: next.heightMm, qty: next.qty, positions: positions.length + 1 });
    }
    clearPositionForm();
  }

  function handleRemovePosition(id: string) {
    trackShopStep("remove_position", "plisy", { positions: Math.max(0, positions.length - 1) });
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
    setStepDimsCollapsed(false);
    trackShopStep("edit_position_open", "plisy", { width_mm: position.widthMm, height_mm: position.heightMm, qty: position.qty });
    window.setTimeout(() => {
      positionFormRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 120);
  }
  const positionFormRef = useRef<HTMLDivElement | null>(null);

  const positionsGrandTotal = priceForSet(positions, selectedFabricGroupId, selectedFabric);

  // A customer who only ever wants one size never has to touch "+ Dodaj
  // kolejną" at all - the button is enabled off the currently-filled-in
  // form too, and a valid one still sitting in the fields gets folded into
  // the set right before it's sent, so nothing typed-but-not-yet-added is
  // silently dropped.
  const canFinalSubmit =
    bracketChosen && fabricChosen && !sagBlocked && !remeasureRequired && hasSizes && setGrandTotal !== null;

  // Stan formularza dla analityki "na czym stanął" (lib/configurator-state):
  // heartbeat i page_exit niosą, które kroki gotowe, czego brakuje i czy
  // "Dodaj do koszyka" było aktywne.
  useEffect(() => {
    const done: string[] = [];
    const missing: string[] = [];
    (hasSizes ? done : missing).push("wymiary");
    (selectedMount ? done : missing).push("montaż");
    (selectedHardware ? done : missing).push("kolor profili");
    if (bracketRequired) (selectedBracket ? done : missing).push("kolor uchwytów");
    (selectedFabricGroup ? done : missing).push("kolekcja");
    (selectedFabric ? done : missing).push("tkanina");
    const hasDims = widthNum > 0 || heightNum > 0;
    const blockedReason = remeasureRequired
      ? "zmiana montażu - potrzebny nowy pomiar"
      : sagBlocked
        ? "ugięcie profilu niezaakceptowane"
        : hasDims && !dimensionsValid && positions.length === 0
          ? "wymiary poza zakresem"
          : "";
    reportConfiguratorState({
      product: "plisy",
      done,
      missing,
      blocked_reason: blockedReason,
      cta_enabled: canFinalSubmit,
      price: setGrandTotal,
      positions: effectivePositions.length,
      qty: quantityNum,
      width_mm: widthNum,
      height_mm: heightNum,
      unit: dimensionUnit,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMount, bracketRequired, selectedBracket, selectedHardware, selectedFabricGroup, selectedFabric, hasSizes, effectivePositions.length, widthNum, heightNum, sagBlocked, remeasureRequired, canFinalSubmit, setGrandTotal, quantityNum, dimensionUnit]);
  useEffect(() => () => clearConfiguratorState("plisy"), []);

  function handleFinalSubmit() {
    if (!canFinalSubmit) return;
    // A row mid-edit goes in with the edited values when they validate,
    // and as it was saved when they don't - never twice, never dropped.
    const finalPositions = effectivePositions;
    if (finalPositions.length === 0) return;

    const base = {
      mountId: selectedMount?.id || "",
      mountLabel: joinPlisyMountLabel(plisyMountLabel(selectedMount), selectedBracket?.label),
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
      const price = priceForSize(position.widthMm, position.heightMm, position.qty, selectedFabricGroupId, selectedFabric);
      if (!price) return;
      const result: ConfiguratorResult = {
        ...base,
        widthMm: position.widthMm,
        heightMm: position.heightMm,
        qty: position.qty,
        unitPrice: price.unit,
        totalPrice: price.total,
        oversizeSurchargeAmount: plisyOversizeSurcharge(position.widthMm),
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

  // Kolejność kroków (właściciel, 2026-09-24, po obejrzeniu przebudowy):
  // wracamy do sprawdzonej ścieżki - najpierw SPOSÓB MONTAŻU, potem kolor
  // mechanizmu, uchwyty przy bezinwazyjnym, tkanina i WYMIARY NA KOŃCU.
  // Z przebudowy zostaje to, co się obroniło: montaż przykręcany wybrany
  // domyślnie, blokada przy zmianie montażu (bo wymiary mierzy się wtedy
  // inaczej), ceny przy kolekcjach, gdy wymiary są już znane (np. z szybkiej
  // wyceny na landingu), i cena liczona z bieżącego wyboru zamiast zapisanej
  // w pozycji.
  const measureMode = measureModeForMount(selectedMountId);
  const sizeSummaryText = !hasSizes
    ? ""
    : effectivePositions.length === 1
      ? `${effectivePositions[0].widthMm / 10} × ${effectivePositions[0].heightMm / 10} cm · ${effectivePositions[0].qty} szt.`
      : `${pozycjeLabel(effectivePositions.length)} · ${effectivePositions.reduce((sum, position) => sum + position.qty, 0)} szt.`;
  // Kwota, którą klient faktycznie zapłaci (po SEZON20, jeśli aktywny) i
  // ile na tym oszczędza - do bloku "Do zapłaty" i do oferty ratalnej.
  const payableGrandTotal =
    setGrandTotal !== null && promo ? applyPromoToPrice(setGrandTotal, promo) ?? setGrandTotal : setGrandTotal;
  const promoSavings =
    setGrandTotal !== null && payableGrandTotal !== null
      ? Math.round((setGrandTotal - payableGrandTotal) * 100) / 100
      : 0;
  const priceScopeLabel =
    effectivePositions.length === 1 && effectivePositions[0].qty === 1 ? "za Twoje okno" : "za Twój zestaw";

  return (
    <>
      <header>
        <strong>Wyceń plisę do swojego okna</strong>
      </header>

      {/* KROK 1: sposób montażu */}
      {profile.mountOptions.length > 0 ? (
        <section className={`hero-product-step-accordion hero-product-step-accordion--mount ${stepMountCollapsed ? "is-collapsed" : ""}`}>
          <button
            type="button"
            className="hero-product-step-head"
            onClick={() => {
              trackShopStep("configurator_step_toggle", "mount_type", { collapsed_after: !stepMountCollapsed });
              setStepMountCollapsed((prev) => !prev);
            }}
            aria-expanded={stepMountCollapsed ? "false" : "true"}
          >
            <span className="hero-product-config-step-title">
              <span className={`hero-product-step-check ${selectedMount ? "" : "is-muted"}`} aria-hidden="true">
                {selectedMount ? "✓" : "1"}
              </span>
              Wybierz sposób montażu
            </span>
            <span className="hero-product-step-head-meta">
              {selectedMount ? <strong>{plisyMountLabel(selectedMount)}</strong> : null}
              {stepMountCollapsed ? (
                <span className="hero-product-step-head-change">Zmień</span>
              ) : (
                <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
              )}
            </span>
          </button>
          <div className="hero-product-step-body">
            <div className="plisy-mount-pick" role="group" aria-label="Sposób montażu">
              <div className="plisy-mount-pick-grid">
                {profile.mountOptions.map((option) => {
                  const isActive = option.id === selectedMountId;
                  const delta = formatPriceDeltaBadge(option.priceDelta, option.priceDeltaType);
                  return (
                    <div key={option.id} className={`plisy-mount-pick-cell ${isActive ? "is-active" : ""}`}>
                      <button
                        type="button"
                        className={`plisy-mount-pick-option ${isActive ? "is-active" : ""}`}
                        aria-pressed={isActive}
                        onClick={() => handleMountChange(option)}
                      >
                        <span
                          className="plisy-mount-pick-thumb"
                          aria-hidden="true"
                          style={
                            option.imageUrl
                              ? { backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 160)})` }
                              : { backgroundImage: "linear-gradient(135deg, #E2E8F0 0%, #C8D0DA 100%)" }
                          }
                        />
                        <span className="plisy-mount-pick-text">
                          <strong>{plisyMountLabel(option)}</strong>
                          <span>{plisyMountShortNote(option)}</span>
                        </span>
                        {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                        {/* Dopłata przy dolnej krawędzi kafelka, nie u góry:
                            u góry wisiała nad kafelkiem i nie było wiadomo,
                            czego dotyczy (właściciel, 2026-09-24). */}
                        {delta ? <span className="plisy-mount-pick-delta">{delta}</span> : null}
                      </button>
                      {option.imageUrl ? (
                        <button
                          type="button"
                          className="config-option-zoom"
                          aria-label={`Powiększ: ${plisyMountLabel(option)}`}
                          onClick={() => openZoom({ title: plisyMountLabel(option), urls: [option.imageUrl], index: 0 })}
                        >
                          🔍
                        </button>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>

            {mountNotice ? (
              <div className="plisy-remeasure-notice" role="alert">
                <strong>Inny montaż = inny pomiar</strong>
                <p>
                  {measureMode === "bezinwazyjny"
                    ? "Przy montażu bezinwazyjnym plisa zasłania szybę razem z listwami: szerokość mierzysz od kreseczki do kreseczki, a wysokość to całe skrzydło."
                    : "Przy montażu przykręcanym plisa siedzi między listwami przyszybowymi: mierzysz w świetle szyby, od połowy uszczelki do połowy uszczelki."}{" "}
                  Wymiary, które już podałeś, były mierzone pod poprzedni montaż („{mountNotice.previousLabel}”) — tutaj nie zagrają.
                </p>
                <div className="plisy-remeasure-actions">
                  <button type="button" className="plisy-remeasure-accept" onClick={acceptRemeasure}>
                    Wpiszę nowe wymiary
                  </button>
                  <button type="button" className="plisy-remeasure-cancel" onClick={cancelMountChange}>
                    Zostaw montaż: {mountNotice.previousLabel}
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {/* KROK 2: kolor mechanizmu */}
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

      {/* KROK 3: kolor uchwytów - tylko montaż bezinwazyjny */}
      {selectedHardwareId && bracketRequired ? (
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

      {selectedHardwareId && !bracketChosen ? (
        <p className="hero-product-config-hint">Wybierz kolor uchwytów, aby przejść do kolejnego kroku.</p>
      ) : null}

      {selectedHardwareId && bracketChosen ? (
        <>
          {/* KROK 4: kolekcja tkanin */}
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
              {/* Kafelek mówi tylko to, co potrzebne do wyboru: nazwa,
                  plakietki, ile kolorów i - gdy wymiary są już znane - cena.
                  Cały opis kolekcji siedzi pod ikoną "i" (właściciel,
                  2026-09-24: "za dużo treści pod swatchami"). */}
              {hasSizes ? (
                <p className="hero-product-config-hint">Ceny policzone dla Twoich wymiarów ({sizeSummaryText}).</p>
              ) : null}
              <div className="plisy-coll-grid">
                {profile.fabricGroups.map((group) => {
                  const isActive = group.id === selectedFabricGroupId;
                  const kind = plisyCollectionKind(group);
                  const meta = plisyCollectionMeta(kind);
                  const groupTotal = priceForSet(effectivePositions, group.id, null);
                  return (
                    <div key={group.id} className={`plisy-coll-cell ${isActive ? "is-active" : ""}`}>
                      <button
                        type="button"
                        className={`hero-product-mesh-option plisy-coll-card ${isActive ? "is-active" : ""}`}
                        onClick={() => {
                          trackShopStep("select_fabric_group", group.label, { option_id: group.id });
                          pickFabricGroup(group.id);
                        }}
                      >
                        {/* Tło kafelka: cztery zdjęcia tkanin z TEJ kolekcji,
                            przenikające się płynnie (właściciel, 2026-09-24).
                            Ikona zostaje na wierzchu, a warstwa przyciemniająca
                            trzyma czytelność nazwy i plakietek. */}
                        <PlisyCollectionBackdrop group={group} />
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
                          <span className="plisy-coll-card-meta">
                            {group.swatches.length ? (
                              <span className="plisy-coll-card-count">{plisyColorCountLabel(group.swatches.length)}</span>
                            ) : null}
                            {groupTotal !== null ? (
                              <span className="plisy-coll-card-price">
                                {renderPrice(groupTotal)}
                                <em>{priceScopeLabel}</em>
                              </span>
                            ) : null}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="plisy-coll-card-info"
                        aria-label={`Informacje o kolekcji ${group.label}`}
                        title="Co to za kolekcja?"
                        onClick={(event) => {
                          event.stopPropagation();
                          trackShopStep("fabric_group_info", group.label, { option_id: group.id });
                          setCollectionInfoId(group.id);
                        }}
                      >
                        i
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          {collectionInfoGroup && typeof document !== "undefined"
            ? createPortal(
                <div
                  className="instruction-modal instruction-modal--collection"
                  role="dialog"
                  aria-modal="true"
                  aria-label={`Kolekcja ${collectionInfoGroup.label}`}
                  onClick={() => setCollectionInfoId("")}
                >
                  <div className="instruction-modal-shell instruction-modal-shell--collection" onClick={(event) => event.stopPropagation()}>
                    <button type="button" className="instruction-modal-close" aria-label="Zamknij" onClick={() => setCollectionInfoId("")}>
                      ×
                    </button>
                    <div className="plisy-coll-modal-head">
                      <span className="plisy-coll-card-visual">
                        <PlisyCollectionVisual kind={plisyCollectionKind(collectionInfoGroup)} />
                      </span>
                      <div>
                        <h3>{collectionInfoGroup.label}</h3>
                        <span className="plisy-coll-card-badges">
                          {plisyCollectionMeta(plisyCollectionKind(collectionInfoGroup)).badges.map((badge) => (
                            <span key={badge} className={`plisy-coll-card-badge ${badge === "Zaciemnia" ? "is-dark" : badge === "Termo" ? "is-thermo" : badge === "Plaster miodu" ? "is-structure" : ""}`}>
                              {badge}
                            </span>
                          ))}
                        </span>
                      </div>
                    </div>
                    <p>{plisyCollectionMeta(plisyCollectionKind(collectionInfoGroup)).light}</p>
                    {collectionInfoGroup.note ? <p>{collectionInfoGroup.note}</p> : null}
                    <p className="plisy-coll-modal-count">
                      {plisyColorCountLabel(collectionInfoGroup.swatches.length)} do wyboru w tej kolekcji.
                    </p>
                    <button
                      type="button"
                      className="plisy-coll-modal-cta"
                      onClick={() => {
                        const group = collectionInfoGroup;
                        trackShopStep("select_fabric_group", group.label, { option_id: group.id, source: "info_modal" });
                        setCollectionInfoId("");
                        pickFabricGroup(group.id);
                      }}
                    >
                      Wybieram tę kolekcję
                    </button>
                  </div>
                </div>,
                document.body,
              )
            : null}

          {fabricGroupChosen ? (
            <>
              {/* KROK 5: kolor tkaniny */}
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
                  {/* Ulubione tkaniny zaznaczone na landingu ("Którą kolekcję
                      tkanin wybrać") - tu wracają jako skrót, także wtedy, gdy
                      pochodzą z innej kolekcji (wybór przełącza kolekcję). */}
                  {favouriteSwatches.length ? (
                    <div className="plisy-fav-strip">
                      <span className="plisy-fav-strip-label">★ Twoje ulubione</span>
                      <div className="plisy-fav-strip-items">
                        {favouriteSwatches.map((entry) => (
                          <button
                            key={entry.swatch.id}
                            type="button"
                            className={`plisy-fav-chip ${entry.swatch.id === selectedFabricId ? "is-active" : ""}`}
                            title={`${entry.swatch.label} · ${entry.group.label}`}
                            onClick={() => {
                              trackShopStep("select_fabric_color", entry.swatch.label, { option_id: entry.swatch.id, source: "favourites" });
                              if (entry.group.id !== selectedFabricGroupId) setSelectedFabricGroupId(entry.group.id);
                              setSelectedFabricId(entry.swatch.id);
                              setStepThreeCollapsed(true);
                              setStepTwoCollapsed(true);
                              window.setTimeout(() => {
                                scrollStepIntoView(stepFourRef.current);
                              }, 380);
                            }}
                          >
                            <span
                              className="plisy-fav-chip-swatch"
                              style={buildPlisyHardwareSwatchStyle(entry.swatch.thumbnailUrl, entry.swatch.color)}
                              aria-hidden="true"
                            />
                            <span>{entry.swatch.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
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
                            className={`plisy-swatch-fav ${isFavouriteSwatch(swatch.id) ? "is-on" : ""}`}
                            aria-label={isFavouriteSwatch(swatch.id) ? `Usuń ${swatch.label} z ulubionych` : `Dodaj ${swatch.label} do ulubionych`}
                            aria-pressed={isFavouriteSwatch(swatch.id)}
                            title={isFavouriteSwatch(swatch.id) ? "W ulubionych" : "Dodaj do ulubionych"}
                            onClick={(event) => {
                              event.stopPropagation();
                              toggleFavouriteSwatch(swatch.id);
                              trackShopStep("fabric_favourite", swatch.label, {
                                option_id: swatch.id,
                                on: !isFavouriteSwatch(swatch.id),
                                source: "configurator",
                              });
                            }}
                          >
                            ♥
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

              {/* Podgląd + KROK 6: wymiary i ilość (na końcu) */}
              {fabricChosen ? (
                <div ref={stepFourRef} className="hero-product-mini-summary is-revealed">
                  <h3>Plisa</h3>
                  <div className="hero-product-mini-summary-body">
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
                          <dd>{plisyMountLabel(selectedMount)}</dd>
                        </div>
                      ) : null}
                      {selectedBracket ? (
                        <div>
                          <dt>Kolor uchwytów</dt>
                          <dd>{selectedBracket.label}</dd>
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

                  <section
                    className={`hero-product-step-accordion hero-product-step-accordion--dimensions ${stepDimsCollapsed ? "is-collapsed" : ""}`}
                  >
                    <button
                      type="button"
                      className="hero-product-step-head"
                      onClick={() => {
                        trackShopStep("configurator_step_toggle", "dimensions", { collapsed_after: !stepDimsCollapsed });
                        setStepDimsCollapsed((prev) => !prev);
                      }}
                      aria-expanded={stepDimsCollapsed ? "false" : "true"}
                    >
                      <span className="hero-product-config-step-title hero-product-config-step-title--muted">
                        <span className={`hero-product-step-check ${hasSizes ? "" : "is-muted"}`} aria-hidden="true">
                          {hasSizes ? "✓" : String(5 + stepShift)}
                        </span>
                        Wymiary i ilość
                      </span>
                      <span className="hero-product-step-head-meta">
                        {sizeSummaryText ? <strong>{sizeSummaryText}</strong> : null}
                        {stepDimsCollapsed ? (
                          <span className="hero-product-step-head-change">Zmień</span>
                        ) : (
                          <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
                        )}
                      </span>
                    </button>
                    <div
                      className="hero-product-step-body"
                      style={stepDimsCollapsed ? undefined : { maxHeight: "none", overflow: "visible" }}
                    >
                      <div className={`plisy-position-form ${editingPositionId ? "is-editing" : ""}`} ref={positionFormRef}>
                        {editingPositionId ? (
                          <p className="plisy-position-editing">
                            Edytujesz pozycję {positions.findIndex((position) => position.id === editingPositionId) + 1} z zestawu.
                            <button type="button" onClick={clearPositionForm}>
                              Anuluj
                            </button>
                          </p>
                        ) : null}
                        {/* Bez ściany tekstu: same pola i przycisk do
                            instrukcji w modalu (właściciel, 2026-09-24). */}
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
                          <button
                            type="button"
                            className="plisy-measure-link plisy-measure-link--cta"
                            onClick={() => {
                              setMeasureGuideOpen(true);
                              trackShopStep("configurator_measure_guide", "open", { mount: measureMode });
                            }}
                          >
                            📐 Jak mierzyć?
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
                                  <PlisyMeasureGuide fixedMode={measureMode} startDelayMs={700} unit={dimensionUnit} />
                                  {/* Okno bywa w drugim pokoju albo mierzy
                                      ktoś inny - stąd wysyłka samej
                                      instrukcji (właściciel, 2026-09-26). */}
                                  <MeasureShare mode={measureMode} source="configurator" />
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
                                <button type="button" onClick={() => switchDimensionUnit("cm")}>
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
                        {/* Po wpisaniu wymiarów baner nie ma już po co
                            straszyć - klient je ma (właściciel, 2026-09-24). */}
                        {!hasSizes ? (
                          <button type="button" className="plisy-measure-later" onClick={openMeasureLater} disabled={measureSaveBusy}>
                            <strong>Nie masz jeszcze wymiarów?</strong>
                            <span>Wyślij sobie link i dokończ później →</span>
                          </button>
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
                                  trackShopStep("accept_sag_notice", String(widestMm), { limit_mm: sagLimitMm });
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
                            disabled={!dimensionsValid || sagBlocked || remeasureRequired}
                          >
                            {editingPositionId ? "Zapisz zmiany" : "+ Dodaj kolejne okno"}
                          </button>
                        </div>
                      </div>
                    </div>
                  </section>

                  {positions.length > 0 ? (
                    <div className="plisy-positions-list">
                      <h4>Twój zestaw</h4>
                      {positions.map((position, index) => {
                        const rowPrice = priceForSize(position.widthMm, position.heightMm, position.qty, selectedFabricGroupId, selectedFabric);
                        return (
                          <div key={position.id} className={`plisy-positions-row ${position.id === editingPositionId ? "is-editing" : ""}`}>
                            <span className="plisy-positions-row-label">
                              {index + 1}. {position.widthMm / 10} × {position.heightMm / 10} cm, {position.qty} szt.
                            </span>
                            <span className="plisy-positions-row-price">{rowPrice ? renderPrice(rowPrice.total) : "—"}</span>
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
                        );
                      })}
                      {setGrandTotal !== null ? (
                        <div className="plisy-positions-total">
                          <span>Razem za cały zestaw</span>
                          <strong>{renderPrice(setGrandTotal)}</strong>
                        </div>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Kwota do zapłaty jako blok, nie szary wiersz: przekreślona
                      cena sprzed rabatu i zielona plakietka oszczędności
                      (właściciel, 2026-09-24). Ta sama oprawa co w koszyku. */}
                  {setGrandTotal !== null ? (
                    <div className="total-block">
                      <span className="total-block-left">
                        <span className="total-block-label">Razem</span>
                        {promoSavings > 0 ? (
                          <span className="total-block-savings">Oszczędzasz {formatZl(promoSavings)}</span>
                        ) : null}
                      </span>
                      <span className="total-block-right">
                        {promoSavings > 0 ? <s>{formatZl(setGrandTotal)}</s> : null}
                        <strong>{formatZl(payableGrandTotal ?? setGrandTotal)}</strong>
                      </span>
                    </div>
                  ) : null}

                  {/* Ile to wyjdzie w ratach - liczone od kwoty, którą
                      klient faktycznie zapłaci (właściciel, 2026-09-24). */}
                  <InstallmentOffer amount={payableGrandTotal} variant="compact" />

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
      {!selectedHardwareId ? (
        <p className="hero-product-config-hint">Wybierz kolor mechanizmu, aby przejść do kolejnego kroku.</p>
      ) : null}

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
