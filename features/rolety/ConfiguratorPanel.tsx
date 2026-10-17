"use client";

// Konfigurator rolet mini (dzień-noc i tradycyjne) oraz żaluzji poziomych -
// jedna implementacja sparametryzowana slugiem (reguły i nazwy kroków w
// ROLETY_COPY, shared.ts).
//
// Rolety (właściciel, 17.10.2026): 1) montaż, 2) wymiary i ilość (z
// instrukcją pomiaru pod wybrany montaż), 3) kolor mechanizmu, 4) kolekcja
// tkaniny -> kolor, 5) strona łańcuszka, na końcu karta ceny i "Dodaj do
// koszyka".
//
// Żaluzje: każdy model to osobny produkt (strona /zaluzje/<slug>, katalog
// /zaluzje). Panel dostaje model z zewnątrz (modelSlug ze strony produktu
// albo lockModel + etykieta przy edycji z koszyka) i nie pozwala go zmienić:
// 1) sposób montażu (w świetle szyby / na skrzydło / na ścianę),
// 2) pomiar - klient wpisuje to, co zmierzył, a panel liczy wymiar żaluzji
// (ZALUZJE_MOUNT_RULES w shared.ts; albo "Znam dokładny wymiar żaluzji"),
// 3) kolor lameli, 4) strona sterowania, cena, koszyk. Animacje pomiaru:
// ZaluzjeMeasure.tsx.
//
// Bez pola uwag (zasada właściciela), bez powiększeń na najechanie - tylko
// lupa na kliknięcie. Układ, klasy CSS i akordeony skopiowane z plis
// (features/plisy/ConfiguratorPanel.tsx); dane i cennik z CRM. Komórka
// cennika = 0 oznacza wymiar niedostępny dla danego modelu - komunikat i
// blokada dodania do koszyka.
import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { optimizeImageUrl } from "@/lib/image-optim";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { trackShopStep } from "@/lib/track-step";
import { clearConfiguratorState, reportConfiguratorState } from "@/lib/configurator-state";
import { useBackToClose } from "@/lib/use-back-to-close";
import { buildPlisyHardwareSwatchStyle, formatPriceDeltaBadge } from "@/features/plisy/shared";
import PlisyFabricGallery from "@/features/plisy/FabricGallery";
import PlisyCollectionBackdrop from "@/features/plisy/CollectionBackdrop";
import UnitAskModal from "@/features/plisy/UnitAskModal";
import { ZaluzjeMeasureAnimation, ZaluzjeMeasureModal, ZaluzjeMountThumb } from "./ZaluzjeMeasure";
import ZaluzjaPreview, { ZaluzjaHead, ZaluzjaSpecTable, type ZaluzjaPreviewData, type ZaluzjaRow } from "./ZaluzjaPreview";
import { zaluzjeTapeColor, type ZaluzjaDrawingData } from "./zaluzja-drawing-data";
import ZaluzjeSsSteps from "./ZaluzjeSsSteps";
import ZaluzjeLadderSteps from "./ZaluzjeLadderSteps";
import {
  loadSsOptions,
  ssApplyNoDrill,
  ssBuildSupplierOrder,
  ssCleanLabel,
  ssColorValue,
  ssCustomerSummary,
  ssDefaultSelection,
  ssExtras,
  ssField,
  ssFieldApplies,
  ssNoDrillFromStored,
  ssOption,
  ssSelectionFromStored,
  ssTapeStatus,
  ssTilterLabel,
  ssTilterSide,
  ssLadderDone,
  ssLadderInfo,
  ssTapeResolve,
  SS_TAPE_STANDARD,
  type SsModelOptions,
  type SsSelection,
} from "./ss-options";
import {
  CHAIN_SIDES,
  calcRoletyPrice,
  fetchRoletyProfile,
  findZaluzjeModel,
  zaluzjeBlindSize,
  zaluzjeHandleWarning,
  zaluzjeMeasureNote,
  zaluzjeModelForGroup,
  zaluzjeMountRule,
  zaluzjeSpecIssue,
  zaluzjeSlatWidthMm,
  zaluzjeStackAboveMm,
  zaluzjeStackMm,
  ZALUZJE_WALL_INFO,
  isRoletyCassetteMount,
  joinRoletyMountLabel,
  ROLETY_COPY,
  ROLETY_QTY_MAX,
  roletyGroupSections,
  roletyMatrixCell,
  roletyMeasureHint,
  splitRoletyMountLabel,
  type ChainSide,
  type ConfiguratorInitialValues,
  type ConfiguratorResult,
  type FabricGroup,
  type MountOption,
  type RoletyProfile,
  type RoletySlug,
  type ZaluzjeMountId,
} from "./shared";

type ZoomPreview = { title: string; urls: string[]; index: number };

function formatZl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

function colorCountLabel(count: number): string {
  if (count === 1) return "1 kolor";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} kolory`;
  return `${count} kolorów`;
}

// Przełącznik mm/cm - ten sam klucz localStorage co plisy i moskitiery, więc
// klient, który raz wybrał jednostkę, ma ją w każdym konfiguratorze.
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

// Szkic wyboru (montaż, kolory, tkanina, strona łańcuszka) na tydzień - dla
// klienta, który wyszedł zmierzyć okno. Kasowany po dodaniu do koszyka
// (lib/cart.ts, CONFIGURATOR_DRAFT_KEYS). Nigdy nie czytany przy edycji z koszyka.
const DRAFT_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const ROLETY_DRAFT_KEYS: Record<RoletySlug, string> = {
  "rolety-dzien-noc": "keika_rolety_dn_draft_v1",
  "rolety-tradycyjne": "keika_rolety_trad_draft_v1",
  zaluzje: "keika_zaluzje_draft_v1",
};
type RoletyDraft = {
  mountId?: string;
  hardwareId?: string;
  fabricGroupId?: string;
  fabricId?: string;
  chainSide?: ChainSide;
  savedAt?: number;
};

function readDraft(slug: RoletySlug): RoletyDraft | null {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(ROLETY_DRAFT_KEYS[slug]);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RoletyDraft;
    if (!parsed || typeof parsed !== "object") return null;
    if (!parsed.savedAt || Date.now() - parsed.savedAt > DRAFT_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeDraft(slug: RoletySlug, draft: RoletyDraft) {
  try {
    window.localStorage.setItem(ROLETY_DRAFT_KEYS[slug], JSON.stringify({ ...draft, savedAt: Date.now() }));
  } catch {
    /* tryb prywatny / brak miejsca - szkic to wygoda, nic od niego nie zależy */
  }
}

export default function RoletyConfiguratorPanel({
  slug,
  initialValues,
  submitLabel,
  onSubmit,
  onZoom,
  modelSlug,
  lockModel = false,
}: {
  slug: RoletySlug;
  initialValues?: ConfiguratorInitialValues;
  submitLabel: string;
  onSubmit: (result: ConfiguratorResult) => void;
  onZoom?: (preview: ZoomPreview) => void;
  /** Żaluzje: slug modelu ze strony produktu (/zaluzje/<slug>) - model na sztywno. */
  modelSlug?: string;
  /** Żaluzje: model z pozycji koszyka (etykieta) na sztywno - edycja w koszyku. */
  lockModel?: boolean;
}) {
  const copy = ROLETY_COPY[slug];
  // Żaluzje: model wybrany wcześniej, kolor jako krok 1, wymiary 2, klamry 3,
  // sterowanie 4. Rolety: montaż 1, wymiary 2, mechanizm 3, kolekcja/kolor 4,
  // łańcuszek 5.
  const modelFirst = slug === "zaluzje";
  const modelLocked = modelFirst && (Boolean(modelSlug) || lockModel);
  const showGroupStep = !modelLocked;
  // Korekta procentowa ceny produktu z CRM (lib/price-adjustment.ts).
  const priceAdjustmentPercent = useProductPriceAdjustment(slug);
  const [profile, setProfile] = useState<RoletyProfile | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    fetchRoletyProfile(slug).then((result) => {
      if (cancelled) return;
      if (!result || result.mountOptions.length === 0 || result.fabricGroups.length === 0 || result.tables.length === 0) {
        setLoadState("error");
        trackShopStep("configurator_load_failed", slug, { ms_since_nav: Math.round(performance.now()) });
        return;
      }
      setProfile(result);
      setLoadState("ready");
      trackShopStep("configurator_ready", slug, { ms_since_nav: Math.round(performance.now()) });
    });
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Edycja z koszyka niesie własne wybory (id albo etykiety); świeża
  // konfiguracja startuje ze szkicu sprzed maksymalnie tygodnia. Przy
  // żaluzjach sam wybór modelu (fabricGroupId z ProductPanel) nie jest edycją.
  const isCartEdit = Boolean(
    initialValues &&
      Object.keys(initialValues).some((key) => key !== "widthMm" && key !== "heightMm" && key !== "qty" && !(modelFirst && key === "fabricGroupId")),
  );
  const [draftSeed] = useState<RoletyDraft | null>(() => (isCartEdit ? null : readDraft(slug)));
  const seed: RoletyDraft & ConfiguratorInitialValues = { ...(draftSeed ?? {}), ...(initialValues ?? {}) };
  // Żaluzje: model i kolor nigdy ze szkicu - model wyznacza strona produktu
  // (albo pozycja koszyka), a kolor ze szkicu mógł dotyczyć innego modelu.
  if (modelFirst && draftSeed) {
    seed.fabricGroupId = initialValues?.fabricGroupId;
    seed.fabricId = initialValues?.fabricId;
  }

  const [selectedMountId, setSelectedMountId] = useState(seed.mountId || "");
  const [stepMountCollapsed, setStepMountCollapsed] = useState(Boolean(seed.mountId));
  const [selectedHardwareId, setSelectedHardwareId] = useState(seed.hardwareId || "");
  const [stepHardwareCollapsed, setStepHardwareCollapsed] = useState(Boolean(seed.hardwareId));
  const [selectedFabricGroupId, setSelectedFabricGroupId] = useState(seed.fabricGroupId || "");
  const [stepGroupCollapsed, setStepGroupCollapsed] = useState(Boolean(seed.fabricGroupId));
  const [selectedFabricId, setSelectedFabricId] = useState(seed.fabricId || "");
  const [stepFabricCollapsed, setStepFabricCollapsed] = useState(Boolean(seed.fabricId));
  const [chainSide, setChainSide] = useState<ChainSide | "">(() => {
    if (seed.chainSide) return seed.chainSide;
    return splitRoletyMountLabel(seed.mountLabel).chainSide;
  });
  const [stepChainCollapsed, setStepChainCollapsed] = useState(Boolean(seed.chainSide || splitRoletyMountLabel(seed.mountLabel).chainSide));

  const [dimensionUnit, setDimensionUnit] = useState<DimensionUnit>(readStoredUnit);
  const [width, setWidth] = useState(() => {
    const mm = initialValues?.measuredWidthMm || initialValues?.widthMm;
    return mm ? mmToInput(mm, readStoredUnit()) : "";
  });
  const [height, setHeight] = useState(() => {
    const mm = initialValues?.measuredHeightMm || initialValues?.heightMm;
    return mm ? mmToInput(mm, readStoredUnit()) : "";
  });
  // Żaluzje: "Znam dokładny wymiar żaluzji" - pola przyjmują wymiar żaluzji
  // bez przeliczeń. Pozycja z koszyka bez zapisanego pomiaru (stara albo
  // wpisana wprost) wraca w tym trybie.
  const [exactBlindSize, setExactBlindSize] = useState(() =>
    Boolean(modelFirst && initialValues?.widthMm && !initialValues?.measuredWidthMm),
  );
  const [measureGuideOpen, setMeasureGuideOpen] = useState(false);
  // Żaluzje, montaż na skrzydło: nawiewnik na górze skrzydła - wysokość mierzy
  // się od jego dołu (żaluzja wisi pod nawiewnikiem).
  const [hasVent, setHasVent] = useState(Boolean(initialValues?.hasVent));
  // Żaluzje, montaż na ścianę: ile miejsca nad wnęką ("full" = co najmniej
  // tyle, ile zajmie pakiet; "less" = mniej, wartość w cm). Klient musi wybrać.
  const [spaceChoice, setSpaceChoice] = useState<"" | "full" | "less">(() =>
    initialValues?.spaceAboveMm !== undefined && initialValues.spaceAboveMm !== null && initialValues.spaceAboveMm >= 0 ? "less" : "",
  );
  const [spaceLessCm, setSpaceLessCm] = useState(() =>
    initialValues?.spaceAboveMm ? String(Math.round(initialValues.spaceAboveMm / 10)) : "",
  );
  const spaceRestoredRef = useRef(false);
  // Żaluzje: opcje dostawcy Sun & Shade dla wybranego modelu (ss-options.ts).
  const [ssModel, setSsModel] = useState<SsModelOptions | null>(null);
  const [ssSelection, setSsSelection] = useState<SsSelection>({});
  const [noDrill, setNoDrill] = useState(false);
  const ssInitFor = useRef("");
  const ssStepsRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!modelFirst || !selectedFabricGroupId) return;
    let cancelled = false;
    void loadSsOptions(selectedFabricGroupId).then((model) => {
      if (cancelled) return;
      setSsModel(model);
      if (model && ssInitFor.current !== model.groupId) {
        // Zapisany wybór (edycja z koszyka / "Wyceń podobną") tylko przy pierwszym modelu.
        const stored = ssInitFor.current ? undefined : initialValues?.supplierOptions;
        ssInitFor.current = model.groupId;
        if (stored) setSsSelection(ssSelectionFromStored(model, stored));
        else {
          const fresh = ssDefaultSelection(model);
          const ladder = ssLadderInfo(model, "");
          // Drabinkę klient wybiera sam (krok 4); bez sznurka (RETRO) od razu taśma STANDARD.
          if (ladder.hasField) fresh["7"] = ladder.cordOption ? "" : SS_TAPE_STANDARD;
          setSsSelection(fresh);
        }
        setNoDrill(stored ? ssNoDrillFromStored(model, stored) : false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelFirst, selectedFabricGroupId]);
  const [quantity, setQuantity] = useState(initialValues?.qty ? String(initialValues.qty) : "1");
  const [stepDimsCollapsed, setStepDimsCollapsed] = useState(Boolean(isCartEdit && initialValues?.widthMm && initialValues?.heightMm));
  const lastTrackedDimsRef = useRef("");
  // Po zmianie montażu na inny sposób pomiaru - informacja przy polach, bez
  // kasowania wpisanych liczb.
  const [remeasureHint, setRemeasureHint] = useState<string | null>(null);

  const [fabricGalleryIndex, setFabricGalleryIndex] = useState<number | null>(null);
  const [collectionInfoId, setCollectionInfoId] = useState("");
  const [internalZoomPreview, setInternalZoomPreview] = useState<ZoomPreview | null>(null);
  const [unitAskOpen, setUnitAskOpen] = useState(false);
  const unitAskSeenRef = useRef<Set<string>>(new Set());

  useBackToClose(fabricGalleryIndex !== null, () => setFabricGalleryIndex(null));
  useBackToClose(Boolean(collectionInfoId), () => setCollectionInfoId(""));
  useBackToClose(Boolean(internalZoomPreview), () => setInternalZoomPreview(null));

  function switchDimensionUnit(next: DimensionUnit) {
    if (next === dimensionUnit) return;
    setDimensionUnit(next);
    try {
      window.localStorage.setItem(DIMENSION_UNIT_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    trackShopStep("dimension_unit", slug, { unit: next, converted: false });
  }

  useEffect(() => {
    if (isCartEdit) return;
    if (!selectedMountId && !selectedHardwareId && !selectedFabricGroupId && !selectedFabricId && !chainSide) return;
    writeDraft(slug, {
      mountId: selectedMountId,
      hardwareId: selectedHardwareId,
      fabricGroupId: selectedFabricGroupId,
      fabricId: selectedFabricId,
      chainSide: chainSide || undefined,
    });
  }, [isCartEdit, slug, selectedMountId, selectedHardwareId, selectedFabricGroupId, selectedFabricId, chainSide]);

  const stepDimsRef = useRef<HTMLDivElement | null>(null);
  const stepHardwareRef = useRef<HTMLButtonElement | null>(null);
  const stepGroupRef = useRef<HTMLButtonElement | null>(null);
  const stepFabricRef = useRef<HTMLButtonElement | null>(null);
  const stepMountRef = useRef<HTMLButtonElement | null>(null);
  const stepChainRef = useRef<HTMLButtonElement | null>(null);
  const summaryRef = useRef<HTMLDivElement | null>(null);

  // Ta sama logika przewijania co w pozostałych konfiguratorach: na
  // komputerze wewnątrz panelu, na telefonie w .hero-full.
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
    trackShopStep("gallery_zoom_open", preview?.title || slug, { image_index: preview?.index ?? 0 });
    if (onZoom) onZoom(preview);
    else setInternalZoomPreview(preview);
  }

  // Montaż domyślny = pierwsza opcja z CRM: od niego zależy instrukcja
  // pomiaru w kroku wymiarów. Krok zostaje otwarty, żeby klient go zobaczył
  // i mógł zmienić.
  // Żaluzje: bez domyślnego montażu - klient zaznacza, jak chce zamontować
  // (właściciel, 17.10.2026). Montaż ze szkicu / starej pozycji koszyka,
  // którego już nie ma w CRM (dawne "Klamry ..."), czyścimy - wybór od nowa.
  useEffect(() => {
    if (!profile) return;
    if (modelFirst) {
      if (selectedMountId && !profile.mountOptions.some((option) => option.id === selectedMountId)) {
        setSelectedMountId("");
        setStepMountCollapsed(false);
      }
      return;
    }
    if (selectedMountId) return;
    const fallback = profile.mountOptions[0];
    if (fallback) setSelectedMountId(fallback.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Edycja z koszyka: id z etykiet, gdy profil już jest.
  useEffect(() => {
    if (!profile) return;
    if (!selectedMountId && initialValues?.mountLabel) {
      const wanted = splitRoletyMountLabel(initialValues.mountLabel).mountLabel.trim().toLowerCase();
      const match = profile.mountOptions.find((option) => option.label.trim().toLowerCase() === wanted);
      if (match) {
        setSelectedMountId(match.id);
        setStepMountCollapsed(true);
      }
    }
    if (!selectedHardwareId && initialValues?.hardwareLabel) {
      const match = profile.hardware.find((option) => option.label === initialValues.hardwareLabel);
      if (match) {
        setSelectedHardwareId(match.id);
        setStepHardwareCollapsed(true);
      }
    }
    if (!selectedFabricGroupId && initialValues?.fabricGroupLabel) {
      const match = profile.fabricGroups.find((group) => group.label === initialValues.fabricGroupLabel);
      if (match) {
        setSelectedFabricGroupId(match.id);
        setStepGroupCollapsed(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  // Żaluzje: model ze strony produktu (slug albo id grupy) - po wczytaniu profilu.
  const modelFromSlug = useMemo(() => (profile && modelSlug ? findZaluzjeModel(profile, modelSlug) : null), [profile, modelSlug]);
  useEffect(() => {
    if (!modelFromSlug || selectedFabricGroupId === modelFromSlug.id) return;
    setSelectedFabricGroupId(modelFromSlug.id);
    setStepGroupCollapsed(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelFromSlug]);

  const selectedModelInfoPid = modelFirst && profile && selectedFabricGroupId ? zaluzjeModelForGroup(profile, selectedFabricGroupId)?.id.replace(/^ss-/, "") || "" : "";

  const hasHardwareStep = Boolean(profile && profile.hardware.length > 0);
  const selectedMount = useMemo(
    () => profile?.mountOptions.find((option) => option.id === selectedMountId) || null,
    [profile, selectedMountId],
  );
  const selectedHardware = useMemo(
    () => profile?.hardware.find((option) => option.id === selectedHardwareId) || null,
    [profile, selectedHardwareId],
  );
  const hardwareChosen = !hasHardwareStep || Boolean(selectedHardware);
  const selectedFabricGroup = useMemo(
    () => profile?.fabricGroups.find((group) => group.id === selectedFabricGroupId) || null,
    [profile, selectedFabricGroupId],
  );
  const swatchesForGroup = useMemo(() => selectedFabricGroup?.swatches || [], [selectedFabricGroup]);
  // Galeria dużych zdjęć tylko z próbek, które mają zdjęcie (część kolorów
  // żaluzji ma sam kafelek z nazwą).
  const gallerySwatches = useMemo(() => swatchesForGroup.filter((swatch) => swatch.imageUrl), [swatchesForGroup]);
  const selectedFabric = useMemo(
    () => swatchesForGroup.find((swatch) => swatch.id === selectedFabricId) || null,
    [swatchesForGroup, selectedFabricId],
  );
  const groupSections = useMemo(() => roletyGroupSections(profile?.fabricGroups || []), [profile]);

  // Druga część dopasowania z koszyka: kolor jest w obrębie grupy, więc da
  // się go znaleźć dopiero render później.
  useEffect(() => {
    if (!selectedFabricId && initialValues?.fabricLabel && swatchesForGroup.length > 0) {
      const match = swatchesForGroup.find((swatch) => swatch.label === initialValues.fabricLabel);
      if (match) {
        setSelectedFabricId(match.id);
        setStepFabricCollapsed(true);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [swatchesForGroup]);

  // Zmiana grupy unieważnia kolor z poprzedniej.
  useEffect(() => {
    if (!selectedFabricId || swatchesForGroup.length === 0) return;
    if (swatchesForGroup.some((swatch) => swatch.id === selectedFabricId)) return;
    setSelectedFabricId("");
    setStepFabricCollapsed(false);
  }, [selectedFabricGroupId, swatchesForGroup, selectedFabricId]);

  // Co klient wpisał (pomiar albo wymiar żaluzji) i wymiar żaluzji, z którego
  // liczymy cenę i który idzie do produkcji (widthNum/heightNum).
  const inputWidthMm = inputToMm(width, dimensionUnit);
  const inputHeightMm = inputToMm(height, dimensionUnit);
  const zaluzjeRule = modelFirst ? zaluzjeMountRule(selectedMountId) : null;
  const measuring = Boolean(zaluzjeRule) && !exactBlindSize;
  // Na ścianę: pakiet nad wnęką liczony dla wysokości całkowitej (shared.ts).
  const wallMode = Boolean(measuring && zaluzjeRule?.stackAbove);
  const wallPid = modelFirst ? (ssModel ? ssModel.pid : selectedModelInfoPid) : "";
  const wallTape = Boolean(modelFirst && ssModel && ssField(ssModel, "7") && ssSelection["7"] && ssSelection["7"] !== "15" && ssSelection["7"] !== "");
  const stackAboveMm = wallMode && wallPid && inputHeightMm > 0 ? zaluzjeStackAboveMm(wallPid, inputHeightMm, wallTape) : 0;
  const spaceLessMm = Math.max(0, Math.round((Number(String(spaceLessCm).replace(",", ".")) || 0) * 10));
  const spaceAboveMm: number | null = !wallMode
    ? null
    : spaceChoice === "full"
      ? stackAboveMm
      : spaceChoice === "less" && String(spaceLessCm).trim() !== ""
        ? Math.min(stackAboveMm, spaceLessMm)
        : null;
  const wallAnswered = !wallMode || (spaceAboveMm !== null && stackAboveMm > 0);
  const blindFromInput = (w: number, h: number) => (measuring ? zaluzjeBlindSize(selectedMountId, w, h, spaceAboveMm ?? 0) : { widthMm: w, heightMm: h });
  const { widthMm: widthNum, heightMm: heightNum } = blindFromInput(inputWidthMm, inputHeightMm);
  const widthInRange = profile ? widthNum >= profile.widthMinMm && widthNum <= profile.widthMaxMm : false;
  const heightInRange = profile ? heightNum >= profile.heightMinMm && heightNum <= profile.heightMaxMm : false;
  const dimensionsValid = widthInRange && heightInRange && wallAnswered;
  // Edycja z koszyka: zapisane miejsce nad wnęką >= pakiet -> "mam co najmniej".
  useEffect(() => {
    if (spaceRestoredRef.current || !wallMode || !stackAboveMm || initialValues?.spaceAboveMm === undefined) return;
    spaceRestoredRef.current = true;
    if ((initialValues.spaceAboveMm || 0) >= stackAboveMm) setSpaceChoice("full");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wallMode, stackAboveMm]);
  const quantityNum = Math.min(ROLETY_QTY_MAX, Math.max(1, Math.round(Number(quantity) || 1)));

  const looksLikeCm =
    dimensionUnit === "mm" &&
    !dimensionsValid &&
    inputWidthMm > 0 &&
    inputHeightMm > 0 &&
    (profile ? inputWidthMm < profile.widthMinMm / 2 && inputHeightMm < profile.heightMinMm / 2 : false);
  // Podpowiedź "×10 / ÷10" liczona na wpisanych liczbach, sprawdzana na
  // wymiarze żaluzji po przeliczeniu.
  const timesTenFix = (() => {
    if (!profile || dimensionUnit !== "cm" || dimensionsValid || inputWidthMm <= 0 || inputHeightMm <= 0) return null;
    const fixAxis = (v: number, min: number, max: number) => (v < min ? v * 10 : v > max ? v / 10 : v);
    const fixW = fixAxis(inputWidthMm, profile.widthMinMm, profile.widthMaxMm);
    const fixH = fixAxis(inputHeightMm, profile.heightMinMm, profile.heightMaxMm);
    if (fixW === inputWidthMm && fixH === inputHeightMm) return null;
    const fixedBlind = blindFromInput(Math.round(fixW), Math.round(fixH));
    const wOk = fixedBlind.widthMm >= profile.widthMinMm && fixedBlind.widthMm <= profile.widthMaxMm;
    const hOk = fixedBlind.heightMm >= profile.heightMinMm && fixedBlind.heightMm <= profile.heightMaxMm;
    const fromMm = fixW < inputWidthMm || fixH < inputHeightMm;
    return wOk && hOk ? { widthMm: Math.round(fixW), heightMm: Math.round(fixH), fromMm } : null;
  })();
  function applyTimesTenFix() {
    if (!timesTenFix) return;
    trackShopStep("dimensions_times_ten_fix", slug, { from_w: widthNum, from_h: heightNum, to_w: timesTenFix.widthMm, to_h: timesTenFix.heightMm });
    setWidth(mmToInput(timesTenFix.widthMm, dimensionUnit));
    setHeight(mmToInput(timesTenFix.heightMm, dimensionUnit));
  }
  const formatRange = (minMm: number, maxMm: number) =>
    dimensionUnit === "cm" ? `${minMm / 10}–${maxMm / 10} cm` : `${minMm}–${maxMm} mm`;

  function handleDimensionBlur() {
    if (!profile || widthNum <= 0 || heightNum <= 0) return;
    const askKey = `${dimensionUnit}:${widthNum}x${heightNum}`;
    if (!dimensionsValid && (timesTenFix || looksLikeCm) && !unitAskSeenRef.current.has(askKey)) {
      unitAskSeenRef.current.add(askKey);
      window.setTimeout(() => setUnitAskOpen(true), 80);
    }
    const key = `${widthNum}x${heightNum}:${dimensionsValid ? 1 : 0}`;
    if (key === lastTrackedDimsRef.current) return;
    lastTrackedDimsRef.current = key;
    if (dimensionsValid) {
      trackShopStep("enter_dimensions", slug, { width_mm: widthNum, height_mm: heightNum, qty: quantityNum, unit: dimensionUnit });
    } else {
      trackShopStep("dimensions_invalid", slug, { width_mm: widthNum, height_mm: heightNum, unit: dimensionUnit, looks_like_cm: looksLikeCm });
    }
  }

  // Cena liczy się od chwili, gdy są wymiary: przed wyborem grupy "od"
  // (najtańsza grupa dla tego wymiaru), potem dokładna.
  function unitPriceFor(fabricGroupId: string): number | null {
    if (!profile || !dimensionsValid || !fabricGroupId) return null;
    return calcRoletyPrice(profile, selectedMountId, fabricGroupId, widthNum, heightNum, {
      hardwareId: selectedHardwareId || undefined,
      fabricId: selectedFabricGroupId === fabricGroupId ? selectedFabricId || undefined : undefined,
      extraAdjustPercent: priceAdjustmentPercent,
    });
  }
  /** Czy grupa jest produkowana w tym wymiarze (komórka cennika > 0). */
  function groupUnavailable(fabricGroupId: string): boolean {
    if (!profile || !dimensionsValid) return false;
    return roletyMatrixCell(profile, fabricGroupId, widthNum, heightNum).status === "unavailable";
  }
  // Żaluzje: cena = żaluzja z cennika + dopłaty za opcje Sun & Shade.
  const ssColorV = modelFirst && ssModel && selectedFabric ? ssColorValue(selectedFabric.id, ssModel.pid) : "";
  const ssCtx = { widthMm: widthNum, noDrill };
  const ssExtraLines = modelFirst ? ssExtras(ssModel, ssSelection, ssCtx) : [];
  const ssExtrasTotal = ssExtraLines.reduce((sum, line) => sum + line.amount, 0);
  const ssTapeBlocked = Boolean(modelFirst && ssModel && ssColorV && ssSelection["7"] && ssTapeStatus(ssModel, ssColorV, ssSelection["7"]) === 2);
  // Zmiana koloru lameli: taśma niedostępna do nowego koloru -> STANDARD
  // (dobrany do nowego koloru; STANDARD przelicza się sam).
  useEffect(() => {
    if (!ssModel || !ssColorV) return;
    const f7 = ssField(ssModel, "7");
    const current = ssSelection["7"];
    if (!f7 || !current || current === SS_TAPE_STANDARD || ssTapeStatus(ssModel, ssColorV, current) !== 2) return;
    setSsSelection((prev) => ({ ...prev, "7": SS_TAPE_STANDARD }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ssModel, ssColorV]);
  // Drabinka: rodzaj + kolor wybrane (cena pojawia się dopiero potem) i
  // dopłata procentowa taśmy od ceny żaluzji (przed dopłatami kwotowymi).
  const ladderDone = !modelFirst || ssLadderDone(ssModel, ssSelection, ssColorV);
  const tapeResolved = modelFirst ? ssTapeResolve(ssModel, ssSelection, ssColorV) : null;
  // Limity modelu u dostawcy (min/maks szerokość i wysokość, maks. m²) i
  // pakiet po podniesieniu (features/rolety/ss-options/_specs.json).
  const ssPid = modelFirst && ssModel ? ssModel.pid : selectedModelInfoPid;
  const specIssue = modelFirst && ssPid && dimensionsValid ? zaluzjeSpecIssue(ssPid, widthNum, heightNum) : "";
  const tapeChosen = Boolean(tapeResolved && tapeResolved.kind === "tape");
  const stackMm = wallMode ? stackAboveMm : modelFirst && ssPid && heightNum > 0 ? zaluzjeStackMm(ssPid, heightNum, tapeChosen) : 0;
  const stackPercent = stackMm && heightNum > 0 ? Math.round((stackMm / heightNum) * 100) : 0;
  const baseUnitPrice = unitPriceFor(selectedFabricGroupId);
  const tapePct = tapeResolved && tapeResolved.kind === "tape" ? tapeResolved.pct : 0;
  const tapeAmount = baseUnitPrice !== null && tapePct > 0 ? Math.round(baseUnitPrice * tapePct) / 100 : 0;
  const tapeExtraLine =
    tapeAmount > 0 && tapeResolved
      ? {
          attr: "7%",
          title: "Taśma",
          label: `${tapeResolved.option ? ssCleanLabel(tapeResolved.option.label) : "STANDARD"} (+${tapePct.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} %${tapeResolved.officePicks ? ", cena maks., biuro dobierze taśmę" : ""})`,
          amount: tapeAmount,
        }
      : null;
  const priceExtraLines = tapeExtraLine ? [tapeExtraLine, ...ssExtraLines] : ssExtraLines;
  const unitPrice =
    baseUnitPrice !== null ? Math.round((baseUnitPrice + (modelFirst ? tapeAmount + ssExtrasTotal : 0)) * 100) / 100 : null;
  // Dane podglądu żaluzji (podsumowanie, "Dodano do koszyka", koszyk).
  const previewData: ZaluzjaPreviewData | null =
    modelFirst && selectedFabricGroup && selectedFabric
      ? {
          photoUrl: selectedFabricGroup.imageUrl || "",
          swatchUrl: selectedFabric.thumbnailUrl || selectedFabric.imageUrl || "",
          swatchColor: selectedFabric.color,
          swatchLabel: selectedFabric.label,
          lines: [
            { label: "Model", value: selectedFabricGroup.label },
            { label: "Kolor lameli", value: selectedFabric.label },
            ...(wallMode && dimensionsValid ? [{ label: "Światło (wnęka)", value: `${(inputWidthMm / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} × ${(inputHeightMm / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} cm` }] : []),
            ...(dimensionsValid ? [{ label: "Wymiar żaluzji", value: `${(widthNum / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} × ${(heightNum / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} cm` }] : []),
            ...(selectedMount ? [{ label: "Montaż", value: selectedMount.label }] : []),
            ...(tapeResolved && tapeResolved.kind
              ? [
                  {
                    label: "Drabinka",
                    value:
                      tapeResolved.kind === "cord"
                        ? "sznurkowa, kolor STANDARD"
                        : tapeResolved.standard
                          ? `taśma STANDARD${tapeResolved.option ? ` (${ssCleanLabel(tapeResolved.option.label)})` : " - biuro dobierze"}`
                          : `taśma ${ssCleanLabel(tapeResolved.option?.label || "")}`,
                  },
                ]
              : []),
            ...(ssModel && ssOption(ssField(ssModel, "16"), ssSelection["16"]) ? [{ label: "Sterowanie", value: ssTilterLabel(ssOption(ssField(ssModel, "16"), ssSelection["16"])!.label) }] : []),
            ...(stackMm ? [{ label: "Pakiet po podniesieniu", value: `ok. ${(stackMm / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 })} cm (${stackPercent} %)` }] : []),
          ],
        }
      : null;
  const totalPrice = unitPrice !== null ? Math.round(unitPrice * quantityNum * 100) / 100 : null;

  // ---- Żaluzje: rysunek z wyborów i szczegóły w grupach (właściciel, 18.10.2026) ----
  const selectedModelInfoName = modelFirst && profile && selectedFabricGroup ? zaluzjeModelForGroup(profile, selectedFabricGroup.id)?.name || "" : "";
  const cmT = (mm: number) => (mm / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 });
  // Dopłata za kolor lameli = cena z kolorem - cena bez koloru.
  const colorlessUnit =
    modelFirst && profile && dimensionsValid && selectedFabricGroupId
      ? calcRoletyPrice(profile, selectedMountId, selectedFabricGroupId, widthNum, heightNum, { hardwareId: selectedHardwareId || undefined, extraAdjustPercent: priceAdjustmentPercent })
      : null;
  const colorDelta = baseUnitPrice !== null && colorlessUnit !== null ? Math.max(0, Math.round((baseUnitPrice - colorlessUnit) * 100) / 100) : 0;
  const colorDeltaPct = selectedFabric && selectedFabric.priceDeltaType === "percent" && selectedFabric.priceDelta > 0 ? selectedFabric.priceDelta : 0;
  const ssOpt = (attr: string) => (ssModel ? ssOption(ssField(ssModel, attr), ssSelection[attr]) : null);
  const ladderInfo = modelFirst && ssModel ? ssLadderInfo(ssModel, ssColorV) : null;
  const tilterLabel = ssOpt("16")?.label || "";
  const tilterMatch = tilterLabel.match(/Przekładnia:\s*(prawa|lewa)\s*-\s*Hamulec:\s*(prawa|lewa)/i);
  const crankOpt = ssOpt("23");
  const crankMm = crankOpt ? (Number(String(crankOpt.label).replace(/[^\d]/g, "")) || 0) * 10 : 0;
  const valanceLabel = ssOpt("26")?.label || "";
  const opt30 = ssOpt("30");
  const zlDrawing: ZaluzjaDrawingData | null =
    modelFirst && ssModel && selectedFabricGroup && selectedFabric && dimensionsValid
      ? {
          widthMm: widthNum,
          heightMm: heightNum,
          slatMm: zaluzjeSlatWidthMm(selectedFabricGroup.label) || zaluzjeSlatWidthMm(ssModel.ssTitle.replace(/(\d+)mm/i, "$1 mm")) || 50,
          slatColor: selectedFabric.color || "",
          slatImg: selectedFabric.thumbnailUrl || selectedFabric.imageUrl || "",
          slatLabel: selectedFabric.label,
          ladder: tapeResolved && tapeResolved.kind === "tape" ? "tape" : "cord",
          tapeColor: tapeResolved && tapeResolved.kind === "tape" && tapeResolved.option ? zaluzjeTapeColor(tapeResolved.option.label) : "",
          tapeImg: tapeResolved && tapeResolved.kind === "tape" && tapeResolved.option ? tapeResolved.option.img : "",
          tapeLabel: tapeResolved && tapeResolved.kind === "tape" && tapeResolved.standard ? "taśma STANDARD" : "",
          valance: !valanceLabel
            ? ssOpt("18") && !/^brak/i.test(ssOpt("18")!.label)
              ? "plain"
              : ""
            : /lewym/i.test(valanceLabel)
              ? "left"
              : /prawym/i.test(valanceLabel)
                ? "right"
                : /boczkami/i.test(valanceLabel)
                  ? "both"
                  : "plain",
          tilter: tilterMatch && tilterMatch[1].toLowerCase() === "lewa" ? "left" : "right",
          brake: tilterMatch && tilterMatch[2].toLowerCase() === "lewa" ? "left" : "right",
          control: crankMm > 0 || /pokrętło/i.test(ssOpt("10")?.label || "") ? "crank" : "cord",
          crankMm,
          guides: Boolean(opt30 && !/^nie/i.test(opt30.label)),
          mount: (zaluzjeRule?.id || "") as ZaluzjaDrawingData["mount"],
          lightWidthMm: wallMode ? inputWidthMm : 0,
          lightHeightMm: wallMode ? inputHeightMm : 0,
          stackMm,
        }
      : null;
  const ATTR_STEER = ["16", "23", "25"];
  const ATTR_MASK = ["26", "18", "50", "19", "22", "56"];
  const ssRows = (attrs: string[]) =>
    ssModel
      ? attrs
          .map((attr) => ssField(ssModel, attr))
          .filter((field): field is NonNullable<typeof field> => Boolean(field) && field!.role !== "hidden" && ssFieldApplies(ssModel, field!, ssSelection, ssCtx))
          .map((field) => {
            const option = ssOption(field, ssSelection[field.attr]);
            if (!option || /^brak/i.test(option.label)) return null;
            return { label: field.title, value: field.attr === "16" ? ssTilterLabel(option.label) : ssCleanLabel(option.label) };
          })
          .filter((row): row is { label: string; value: string } => Boolean(row))
      : [];
  const addonRows = ssModel
    ? ssModel.fields
        .filter((field) => field.role === "optional" && !["7", "56", ...ATTR_STEER, ...ATTR_MASK].includes(field.attr) && ssFieldApplies(ssModel, field, ssSelection, ssCtx))
        .map((field) => {
          const option = ssOption(field, ssSelection[field.attr]);
          if (!option || option.v === field.default || /^(nie|brak|standard)\b/i.test(option.label)) return null;
          return { label: field.title, value: ssCleanLabel(option.label) };
        })
        .filter((row): row is { label: string; value: string } => Boolean(row))
    : [];
  // Jeden wiersz na rzecz; model, kolor i wymiar są w nagłówku (ZaluzjaHead).
  const joinRows = (rows: ZaluzjaRow[]) => rows.map((row) => row.value).join(", ");
  const steerRows = ssRows(ATTR_STEER);
  const maskRows = ssRows(["26", "18", "50", "19"]);
  const mountRows = ssRows(["22", "56"]);
  const zlRows: ZaluzjaRow[] =
    modelFirst && selectedFabricGroup && selectedFabric
      ? [
          ...(selectedMount ? [{ label: "Montaż", value: selectedMount.label }] : []),
          ...(measuring && zaluzjeRule && dimensionsValid
            ? [
                {
                  label: wallMode ? "Światło (wnęka)" : "Pomiar",
                  value: `${wallMode ? "" : `${zaluzjeRule.measureNoun}: `}${cmT(inputWidthMm)} × ${cmT(inputHeightMm)} cm${wallMode && spaceAboveMm !== null ? `, nad wnęką ${cmT(spaceAboveMm)} cm` : ""}${zaluzjeRule.id === "na-skrzydlo" ? (hasVent ? ", nawiewnik: tak" : ", bez nawiewnika") : ""}`,
                },
              ]
            : []),
          ...(ladderInfo && ladderInfo.hasField && tapeResolved && tapeResolved.kind
            ? [
                {
                  label: "Drabinka",
                  value:
                    tapeResolved.kind === "cord"
                      ? "sznurkowa, kolor STANDARD (dobrany do lameli)"
                      : tapeResolved.standard
                        ? `taśma STANDARD - dobrana do koloru lameli${tapeResolved.option ? `: ${ssCleanLabel(tapeResolved.option.label)}` : " (dobierze biuro)"}`
                        : `taśma ${ssCleanLabel(tapeResolved.option?.label || "")}${tapeResolved.option?.code ? ` (${tapeResolved.option.code})` : ""}`,
                },
              ]
            : []),
          ...(steerRows.length ? [{ label: "Sterowanie", value: steerRows.map((row) => (row.label === "Długość pokrętła" ? `pokrętło ${row.value}` : row.label === "Kolor mechanizmu" ? `mechanizm ${row.value.toLowerCase()}` : row.value)).join(", ") }] : []),
          ...(maskRows.length ? [{ label: "Maskownica", value: joinRows(maskRows) }] : []),
          ...(mountRows.length ? [{ label: "Uchwyty", value: mountRows.map((row) => (row.label.startsWith("Mocowania bezinwazyjne") ? `bez wiercenia: ${row.value}` : row.value)).join(", ") }] : []),
          ...(addonRows.length ? [{ label: "Dodatki", value: addonRows.map((row) => `${row.label}: ${row.value}`).join("; ") }] : []),
          ...(stackMm ? [{ label: "Pakiet", value: `ok. ${cmT(stackMm)} cm po podniesieniu (${stackPercent} %)` }] : []),
        ]
      : [];
  const pctT = (pct: number) => `+${pct.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} %`;
  const zlPriceRows: ZaluzjaRow[] =
    modelFirst && baseUnitPrice !== null
      ? [
          { label: "Żaluzja", value: formatZl(colorDelta > 0 && colorlessUnit !== null ? colorlessUnit : baseUnitPrice) },
          ...(colorDelta > 0 ? [{ label: `Kolor lameli${colorDeltaPct ? ` ${pctT(colorDeltaPct)}` : ""}`, value: `+${formatZl(colorDelta)}` }] : []),
          ...(tapeAmount > 0 && tapeResolved
            ? [{ label: `Taśma ${tapeResolved.option && !tapeResolved.standard ? ssCleanLabel(tapeResolved.option.label) : "STANDARD"} ${pctT(tapePct)}${tapeResolved.officePicks ? " (maks.)" : ""}`, value: `+${formatZl(tapeAmount)}` }]
            : []),
          ...ssExtraLines.map((line) => ({ label: `${line.title}: ${line.label}`, value: `+${formatZl(line.amount)}` })),
        ]
      : [];
  const zlSub = selectedFabric ? [selectedFabric.label, dimensionsValid ? `${cmT(widthNum)} × ${cmT(heightNum)} cm` : "", `${quantityNum} szt.`].filter(Boolean).join(" · ") : "";
  const selectedUnavailable = Boolean(selectedFabricGroup) && groupUnavailable(selectedFabricGroupId);
  const cheapest = useMemo(() => {
    if (!profile || !dimensionsValid) return null as { unit: number; groupLabel: string } | null;
    let best: { unit: number; groupLabel: string } | null = null;
    for (const group of profile.fabricGroups) {
      const unit = calcRoletyPrice(profile, selectedMountId, group.id, widthNum, heightNum, { extraAdjustPercent: priceAdjustmentPercent });
      if (unit !== null && (!best || unit < best.unit)) best = { unit, groupLabel: group.label };
    }
    return best;
  }, [profile, dimensionsValid, selectedMountId, widthNum, heightNum, priceAdjustmentPercent]);
  // Do logu ruchu: raz na parę grupa+wymiar, gdy model nie jest dostępny.
  const unavailableTrackedRef = useRef("");
  useEffect(() => {
    if (!selectedUnavailable) return;
    const key = `${selectedFabricGroupId}:${widthNum}x${heightNum}`;
    if (unavailableTrackedRef.current === key) return;
    unavailableTrackedRef.current = key;
    trackShopStep("size_unavailable_for_model", selectedFabricGroup?.label || selectedFabricGroupId, { width_mm: widthNum, height_mm: heightNum, product: slug });
  }, [selectedUnavailable, selectedFabricGroupId, selectedFabricGroup, widthNum, heightNum, slug]);

  const quantityTrackedRef = useRef(quantityNum);
  useEffect(() => {
    if (quantityTrackedRef.current === quantityNum) return;
    quantityTrackedRef.current = quantityNum;
    trackShopStep("set_quantity", slug, { qty: quantityNum });
  }, [quantityNum, slug]);

  function handleMountChange(option: MountOption) {
    if (option.id === selectedMountId) return;
    trackShopStep("select_mount_type", option.label, { option_id: option.id, product: slug });
    const hintBefore = roletyMeasureHint(slug, selectedMount);
    const hintAfter = roletyMeasureHint(slug, option);
    setSelectedMountId(option.id);
    setStepMountCollapsed(true);
    if (modelFirst) {
      // Żaluzje: inny montaż = inny pomiar; wymiar żaluzji przelicza się sam.
      const nextRule = zaluzjeMountRule(option.id);
      if ((inputWidthMm > 0 || inputHeightMm > 0) && !exactBlindSize && selectedMountId && nextRule) {
        setRemeasureHint(`Zmieniłeś sposób montażu - teraz mierzysz ${nextRule.measureWhat}. Sprawdź wpisane wymiary.`);
      }
      setStepDimsCollapsed(false);
      window.setTimeout(() => scrollStepIntoView(stepDimsRef.current), 380);
      return;
    }
    if ((widthNum > 0 || heightNum > 0) && hintBefore !== hintAfter) {
      setRemeasureHint(
        isRoletyCassetteMount(option.id) || isRoletyCassetteMount(option.label)
          ? "Zmieniłeś montaż na kasetę: podaj dokładny wymiar szyby między uszczelkami, bez dodawania 15 mm."
          : "Zmieniłeś montaż: do wymiaru szyby między uszczelkami dodaj po 15 mm z każdej strony.",
      );
    }
    if (modelFirst) {
      window.setTimeout(() => scrollStepIntoView(stepChainRef.current), 380);
    } else {
      setStepDimsCollapsed(false);
      window.setTimeout(() => scrollStepIntoView(stepDimsRef.current), 380);
    }
  }

  function pickFabricGroup(groupId: string) {
    const changed = groupId !== selectedFabricGroupId;
    setSelectedFabricGroupId(groupId);
    setStepGroupCollapsed(true);
    if (changed) {
      setSelectedFabricId("");
      setStepFabricCollapsed(false);
    }
    window.setTimeout(() => scrollStepIntoView(stepFabricRef.current), 380);
  }

  function pickFabric(id: string, source?: string) {
    const swatch = swatchesForGroup.find((entry) => entry.id === id);
    trackShopStep("select_fabric_color", swatch?.label || id, { option_id: id, product: slug, ...(source ? { source } : {}) });
    setSelectedFabricId(id);
    setFabricGalleryIndex(null);
    setStepFabricCollapsed(true);
    window.setTimeout(() => scrollStepIntoView(modelFirst ? ssStepsRef.current : stepChainRef.current), 380);
  }

  const canSubmit = Boolean(
    selectedMount &&
      hardwareChosen &&
      selectedFabricGroup &&
      selectedFabric &&
      (modelFirst ? Boolean(ssModel) && !ssTapeBlocked && !specIssue && ladderDone : Boolean(chainSide)) &&
      dimensionsValid &&
      unitPrice !== null &&
      !selectedUnavailable,
  );

  // Stan formularza dla analityki "na czym stanął" (lib/configurator-state).
  useEffect(() => {
    const done: string[] = [];
    const missing: string[] = [];
    (selectedMount ? done : missing).push("montaż");
    (dimensionsValid ? done : missing).push("wymiary");
    if (hasHardwareStep) (selectedHardware ? done : missing).push("kolor mechanizmu");
    (selectedFabricGroup ? done : missing).push(copy.groupUnit);
    (selectedFabric ? done : missing).push("kolor");
    ((modelFirst ? ssModel : chainSide) ? done : missing).push(copy.controlLabelWord);
    const hasDims = widthNum > 0 || heightNum > 0;
    reportConfiguratorState({
      product: slug,
      done,
      missing,
      blocked_reason: hasDims && !dimensionsValid ? "wymiary poza zakresem" : selectedUnavailable ? "model niedostępny w tym wymiarze" : "",
      cta_enabled: canSubmit,
      price: totalPrice,
      positions: dimensionsValid ? 1 : 0,
      qty: quantityNum,
      width_mm: widthNum,
      height_mm: heightNum,
      unit: dimensionUnit,
    });
  }, [slug, copy.groupUnit, copy.controlLabelWord, hasHardwareStep, selectedMount, dimensionsValid, selectedHardware, selectedFabricGroup, selectedFabric, chainSide, widthNum, heightNum, canSubmit, totalPrice, quantityNum, dimensionUnit, selectedUnavailable]);
  useEffect(() => () => clearConfiguratorState(slug), [slug]);

  function handleSubmit() {
    if (!canSubmit || !selectedMount || !selectedFabricGroup || !selectedFabric || (!modelFirst && !chainSide) || unitPrice === null || totalPrice === null) return;
    const tilter = modelFirst && ssModel ? ssOption(ssField(ssModel, "16"), ssSelection["16"]) : null;
    onSubmit({
      productLabel: modelFirst && profile ? zaluzjeModelForGroup(profile, selectedFabricGroup.id)?.name || "" : "",
      mountId: selectedMount.id,
      mountLabel: tilter
        ? `${selectedMount.label} · sterowanie: ${ssTilterLabel(tilter.label).toLowerCase()}`
        : joinRoletyMountLabel(selectedMount.label, chainSide, slug),
      chainSide: tilter ? ssTilterSide(tilter.label) : (chainSide as ChainSide),
      supplier:
        modelFirst && ssModel
          ? ssBuildSupplierOrder(ssModel, ssSelection, ssCtx, { v: ssColorV, ssText: `${selectedFabric.label.toLowerCase()} --- ${selectedFabric.code}` }, widthNum, heightNum)
          : null,
      extras: priceExtraLines,
      extrasNote: priceExtraLines.map((line) => `${line.title}: ${line.label} +${line.amount} zł`).join("; "),
      optionsNote: modelFirst && ssModel ? ssCustomerSummary(ssModel, ssSelection, ssCtx) : "",
      hardwareId: selectedHardware?.id || "",
      hardwareLabel: selectedHardware?.label || "",
      fabricGroupId: selectedFabricGroup.id,
      fabricGroupLabel: selectedFabricGroup.label,
      fabricId: selectedFabric.id,
      fabricLabel: selectedFabric.label,
      fabricColor: selectedFabric.color,
      hardwareColor: selectedHardware?.color || "",
      fabricThumbnailUrl: selectedFabric.thumbnailUrl || selectedFabric.imageUrl || selectedFabricGroup.imageUrl || "",
      widthMm: widthNum,
      heightMm: heightNum,
      measuredWidthMm: measuring ? inputWidthMm : 0,
      measuredHeightMm: measuring ? inputHeightMm : 0,
      measureNote: modelFirst
        ? zaluzjeMeasureNote(selectedMount.id, measuring ? inputWidthMm : 0, measuring ? inputHeightMm : 0, widthNum, heightNum, {
            hasVent: selectedMount.id === "na-skrzydlo" && hasVent,
            stackMm,
            spaceAboveMm: wallMode ? spaceAboveMm ?? 0 : 0,
          })
        : "",
      hasVent: selectedMount.id === "na-skrzydlo" && hasVent,
      stackMm,
      spaceAboveMm: wallMode ? spaceAboveMm ?? 0 : 0,
      previewImageUrl: selectedFabricGroup.imageUrl || "",
      drawing: modelFirst ? zlDrawing : null,
      detailGroups: modelFirst ? [{ title: "Szczegóły", rows: zlRows }, ...(zlPriceRows.length ? [{ title: "Cena", rows: [...zlPriceRows, { label: "Razem za sztukę", value: formatZl(unitPrice) }] }] : [])] : undefined,
      qty: quantityNum,
      unitPrice,
      totalPrice,
    });
  }

  const headerTitle = `Wyceń ${copy.shortName} do swojego okna`;
  const selectedModelInfo = modelFirst && profile && selectedFabricGroup ? zaluzjeModelForGroup(profile, selectedFabricGroup.id) : null;

  if (loadState === "loading") {
    return (
      <>
        <header>
          <strong>{headerTitle}</strong>
        </header>
        <p className="hero-product-config-hint">Wczytuję konfigurator…</p>
      </>
    );
  }

  if (loadState === "error" || !profile) {
    return (
      <>
        <header>
          <strong>{headerTitle}</strong>
        </header>
        <p className="hero-product-config-hint">Nie udało się wczytać konfiguratora. Odśwież stronę lub spróbuj ponownie za chwilę.</p>
        <button type="button" className="plisy-position-add" onClick={() => window.location.reload()}>
          Spróbuj ponownie
        </button>
      </>
    );
  }

  const collectionInfoGroup = collectionInfoId ? profile.fabricGroups.find((group) => group.id === collectionInfoId) || null : null;
  const sizeSummaryText = dimensionsValid ? `${widthNum / 10} × ${heightNum / 10} cm · ${quantityNum} szt.` : "";
  const measureHint = roletyMeasureHint(slug, selectedMount);
  const dimsOpenStyle = stepDimsCollapsed ? undefined : { maxHeight: "none", overflow: "visible" as const };
  const chainLabel = CHAIN_SIDES.find((entry) => entry.id === chainSide)?.label || "";

  const unitAskModal = unitAskOpen && (timesTenFix || looksLikeCm) ? (
    timesTenFix ? (
      <UnitAskModal
        title={timesTenFix.fromMm ? "Wpisujesz w milimetrach?" : "Czy chodziło o taki wymiar?"}
        detail={`Wpisane ${widthNum / 10} × ${heightNum / 10} cm ${timesTenFix.fromMm ? "to kilka metrów" : "to mniej niż najmniejszy produkowany wymiar"}. Czy chodziło Ci o ${timesTenFix.widthMm / 10} × ${timesTenFix.heightMm / 10} cm?`}
        yesLabel={timesTenFix.fromMm ? "Tak, przelicz na cm" : "Tak, popraw"}
        onYes={() => {
          applyTimesTenFix();
          setUnitAskOpen(false);
        }}
        onNo={() => {
          trackShopStep("dimensions_unit_fix", slug, { place: "configurator", accepted: false });
          setUnitAskOpen(false);
        }}
      />
    ) : (
      <UnitAskModal
        title="Wpisujesz w centymetrach?"
        detail={`${widthNum} × ${heightNum} mm to tylko ${widthNum / 10} × ${heightNum / 10} cm - mniej niż najmniejszy produkowany wymiar.`}
        yesLabel="Tak, to centymetry"
        onYes={() => {
          switchDimensionUnit("cm");
          trackShopStep("dimensions_unit_fix", slug, { place: "configurator", accepted: true, kinds: "cm" });
          setUnitAskOpen(false);
        }}
        onNo={() => {
          trackShopStep("dimensions_unit_fix", slug, { place: "configurator", accepted: false, kinds: "cm" });
          setUnitAskOpen(false);
        }}
      />
    )
  ) : null;

  /** Nagłówek akordeonu kroku: numer/✓, tytuł, wybrana wartość, Zmień/▴. */
  function stepHead(
    key: string,
    stepNo: number,
    title: string,
    done: boolean,
    collapsed: boolean,
    toggle: () => void,
    meta: ReactNode,
    ref?: React.RefObject<HTMLButtonElement | null>,
    muted = true,
  ) {
    return (
      <button
        type="button"
        ref={ref}
        className="hero-product-step-head"
        onClick={() => {
          trackShopStep("configurator_step_toggle", key, { collapsed_after: !collapsed, product: slug });
          toggle();
        }}
        aria-expanded={collapsed ? "false" : "true"}
      >
        <span className={`hero-product-config-step-title ${muted ? "hero-product-config-step-title--muted" : ""}`}>
          <span className={`hero-product-step-check ${done ? "" : "is-muted"}`} aria-hidden="true">
            {done ? "✓" : String(stepNo)}
          </span>
          {title}
        </span>
        <span className="hero-product-step-head-meta">
          {meta}
          {collapsed ? <span className="hero-product-step-head-change">Zmień</span> : <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>}
        </span>
      </button>
    );
  }

  function renderMountSection(stepNo: number) {
    return (
      <section className={`hero-product-step-accordion hero-product-step-accordion--mount ${stepMountCollapsed ? "is-collapsed" : ""}`}>
        {stepHead(
          "mount_type",
          stepNo,
          "Wybierz sposób montażu",
          Boolean(selectedMount),
          stepMountCollapsed,
          () => setStepMountCollapsed((prev) => !prev),
          selectedMount ? <strong>{selectedMount.label}</strong> : null,
          stepMountRef,
          false,
        )}
        <div className="hero-product-step-body">
          {modelFirst ? (
            <div className="zl-mount-pick" role="group" aria-label="Sposób montażu">
              <p className="hero-product-config-hint">Zaznacz, jak chcesz zamontować żaluzję - od tego zależy, co zmierzysz.</p>
              {profile!.mountOptions.map((option) => {
                const isActive = option.id === selectedMountId;
                const rule = zaluzjeMountRule(option.id);
                return (
                  <button
                    key={option.id}
                    type="button"
                    className={`zl-mount-card ${isActive ? "is-active" : ""}`}
                    aria-pressed={isActive}
                    onClick={() => handleMountChange(option)}
                  >
                    {rule ? <ZaluzjeMountThumb mountId={rule.id} /> : null}
                    <span className="zl-mount-card-body">
                      <strong>{option.label}</strong>
                      {option.note ? <span className="zl-mount-card-note">{option.note}</span> : null}
                      {rule ? (
                        <span className="zl-mount-card-pros">
                          {rule.pros.map((text) => (
                            <span key={text} className="is-pro">
                              {text}
                            </span>
                          ))}
                          {rule.cons.map((text) => (
                            <span key={text} className="is-con">
                              {text}
                            </span>
                          ))}
                        </span>
                      ) : null}
                    </span>
                    {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                  </button>
                );
              })}
              <button
                type="button"
                className="plisy-measure-link plisy-measure-link--cta"
                onClick={() => {
                  setMeasureGuideOpen(true);
                  trackShopStep("configurator_measure_guide", "open", { mount: selectedMountId || "", product: slug, source: "mount_step" });
                }}
              >
                📐 Jak zmierzyć? Zobacz wszystkie sposoby
              </button>
            </div>
          ) : (
          <div className="plisy-mount-pick" role="group" aria-label="Sposób montażu">
            <div className="plisy-mount-pick-grid">
              {profile!.mountOptions.map((option) => {
                const isActive = option.id === selectedMountId;
                const delta = formatPriceDeltaBadge(option.priceDelta, option.priceDeltaType);
                return (
                  <div key={option.id} className={`plisy-mount-pick-cell ${isActive ? "is-active" : ""}`}>
                    <button type="button" className={`plisy-mount-pick-option ${isActive ? "is-active" : ""}`} aria-pressed={isActive} onClick={() => handleMountChange(option)}>
                      {option.imageUrl ? (
                        <span className="plisy-mount-pick-thumb" aria-hidden="true" style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 160)})` }} />
                      ) : null}
                      <span className="plisy-mount-pick-text">
                        <strong>{option.label}</strong>
                        <span>{option.note}</span>
                      </span>
                      {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                      {delta ? <span className="plisy-mount-pick-delta">{delta}</span> : null}
                    </button>
                    {option.imageUrl ? (
                      <button type="button" className="config-option-zoom" aria-label={`Powiększ: ${option.label}`} onClick={() => openZoom({ title: option.label, urls: [option.imageUrl], index: 0 })}>
                        🔍
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </div>
          )}
        </div>
      </section>
    );
  }

  function renderDimsSection(stepNo: number) {
    const p = profile!;
    // Żaluzje: bez montażu nie wiadomo, co mierzyć (chyba że klient zna wymiar żaluzji).
    const blockedByMount = modelFirst && !selectedMount && !exactBlindSize;
    const cmText = (mm: number) => (mm / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 });
    const handleWarning = modelFirst && selectedModelInfo ? zaluzjeHandleWarning(selectedMountId, selectedModelInfo.widthMm) : "";
    const widthFieldLabel = measuring && zaluzjeRule ? zaluzjeRule.widthLabel : modelFirst ? "Szerokość żaluzji" : "Szerokość";
    const heightFieldLabel = measuring && zaluzjeRule ? zaluzjeRule.heightLabel : modelFirst ? "Wysokość żaluzji" : "Wysokość";
    return (
      <section className={`hero-product-step-accordion hero-product-step-accordion--dimensions ${stepDimsCollapsed ? "is-collapsed" : ""}`}>
        {stepHead(
          "dimensions",
          stepNo,
          modelFirst ? "Pomiar i wymiary" : "Wymiary i ilość",
          dimensionsValid,
          stepDimsCollapsed,
          () => setStepDimsCollapsed((prev) => !prev),
          sizeSummaryText ? <strong>{sizeSummaryText}</strong> : null,
        )}
        <div className="hero-product-step-body" style={dimsOpenStyle}>
          <div className="plisy-position-form" ref={stepDimsRef}>
            {blockedByMount ? (
              <>
                <p className="hero-product-config-hint">Najpierw wybierz sposób montażu (krok 1) - od niego zależy, co mierzysz.</p>
                <label className="zl-exact-toggle">
                  <input type="checkbox" checked={exactBlindSize} onChange={(event) => setExactBlindSize(event.target.checked)} />
                  Znam dokładny wymiar żaluzji
                </label>
              </>
            ) : (
            <>
            {modelFirst ? (
              <div className="zl-measure-intro">
                {measuring && zaluzjeRule ? (
                  <ZaluzjeMeasureAnimation
                    key={`${zaluzjeRule.id}-${hasVent}`}
                    mountId={zaluzjeRule.id}
                    hasVent={zaluzjeRule.id === "na-skrzydlo" && hasVent}
                    pid={wallPid || undefined}
                    withTape={wallTape}
                    customerStackMm={stackMm}
                    compact
                  />
                ) : null}
                {measuring && zaluzjeRule && zaluzjeRule.id === "na-skrzydlo" ? (
                  <div className="zl-vent">
                    <span className="zl-vent-q">Czy okno ma nawiewnik (kratkę wentylacyjną na górze skrzydła)?</span>
                    <span className="zl-vent-opts" role="group" aria-label="Nawiewnik">
                      <button
                        type="button"
                        className={`zl-chip ${!hasVent ? "is-active" : ""}`}
                        aria-pressed={!hasVent}
                        onClick={() => {
                          setHasVent(false);
                          trackShopStep("zaluzje_vent", "nie", {});
                        }}
                      >
                        <strong>Nie</strong>
                      </button>
                      <button
                        type="button"
                        className={`zl-chip ${hasVent ? "is-active" : ""}`}
                        aria-pressed={hasVent}
                        onClick={() => {
                          setHasVent(true);
                          trackShopStep("zaluzje_vent", "tak", {});
                        }}
                      >
                        <strong>Tak</strong>
                      </button>
                    </span>
                    {hasVent ? (
                      <p className="zl-handle-warning" role="note">
                        Zmierz wysokość od dolnej krawędzi nawiewnika do dołu ramy skrzydła - żaluzja wisi pod nawiewnikiem.
                      </p>
                    ) : null}
                  </div>
                ) : null}
                {wallMode ? (
                  <p className="zl-wall-info" role="note">
                    {ZALUZJE_WALL_INFO}
                  </p>
                ) : (
                  <p className="hero-product-config-hint">
                    {measuring && zaluzjeRule
                      ? `Zmierz ${zaluzjeRule.measureWhat} i wpisz wynik. Wymiar żaluzji policzymy sami.`
                      : "Wpisz gotowy wymiar żaluzji (szerokość × wysokość). Nic nie doliczamy."}
                  </p>
                )}
                <div className="zl-measure-intro-actions">
                  {selectedMount ? (
                    <button
                      type="button"
                      className="plisy-measure-link plisy-measure-link--cta"
                      onClick={() => {
                        setMeasureGuideOpen(true);
                        trackShopStep("configurator_measure_guide", "open", { mount: selectedMountId, product: slug, source: "dims_step" });
                      }}
                    >
                      📐 Jak zmierzyć?
                    </button>
                  ) : null}
                  <label className="zl-exact-toggle">
                    <input
                      type="checkbox"
                      checked={exactBlindSize}
                      onChange={(event) => {
                        setExactBlindSize(event.target.checked);
                        trackShopStep("zaluzje_exact_size", event.target.checked ? "on" : "off", { mount: selectedMountId });
                      }}
                    />
                    Znam dokładny wymiar żaluzji
                  </label>
                </div>
              </div>
            ) : (
              <p className="hero-product-config-hint">{measureHint}</p>
            )}
            <div className="plisy-dimensions-tools">
              <div className="hero-product-unit-toggle" role="group" aria-label="Jednostka wymiarów">
                <button type="button" className={dimensionUnit === "cm" ? "is-active" : ""} aria-pressed={dimensionUnit === "cm"} onClick={() => switchDimensionUnit("cm")}>
                  cm
                </button>
                <button type="button" className={dimensionUnit === "mm" ? "is-active" : ""} aria-pressed={dimensionUnit === "mm"} onClick={() => switchDimensionUnit("mm")}>
                  mm
                </button>
              </div>
            </div>
            <div className="hero-product-dimensions-grid">
              <label>
                {widthFieldLabel} ({dimensionUnit})
                <input
                  type="number"
                  inputMode={dimensionUnit === "cm" ? "decimal" : "numeric"}
                  step={dimensionUnit === "cm" ? 0.1 : 1}
                  min={dimensionUnit === "cm" ? p.widthMinMm / 10 : p.widthMinMm}
                  max={dimensionUnit === "cm" ? p.widthMaxMm / 10 : p.widthMaxMm}
                  placeholder={`np. ${mmToInput(p.widthDefaultMm, dimensionUnit)}`}
                  value={width}
                  onChange={(event) => setWidth(event.target.value)}
                  onBlur={handleDimensionBlur}
                />
              </label>
              <label>
                {heightFieldLabel} ({dimensionUnit})
                <input
                  type="number"
                  inputMode={dimensionUnit === "cm" ? "decimal" : "numeric"}
                  step={dimensionUnit === "cm" ? 0.1 : 1}
                  min={dimensionUnit === "cm" ? p.heightMinMm / 10 : p.heightMinMm}
                  max={dimensionUnit === "cm" ? p.heightMaxMm / 10 : p.heightMaxMm}
                  placeholder={`np. ${mmToInput(p.heightDefaultMm, dimensionUnit)}`}
                  value={height}
                  onChange={(event) => setHeight(event.target.value)}
                  onBlur={handleDimensionBlur}
                />
              </label>
              <label>
                Ilość
                <input type="number" inputMode="numeric" min={1} max={ROLETY_QTY_MAX} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </label>
            </div>
            {wallMode && inputHeightMm > 0 && stackAboveMm > 0 ? (
              <div className="zl-wall-space" aria-live="polite">
                <p className="zl-stack-note">
                  Podniesiony pakiet zajmie <strong>ok. {cmText(stackAboveMm)} cm</strong>. Żeby nie zasłaniał światła, nad wnęką potrzebujesz {cmText(stackAboveMm)} cm wolnej ściany
                  (klamry mieszczą się w tej wysokości).{wallTape ? " Z taśmą pakiet jest nieco wyższy." : ""}
                </p>
                <span className="zl-vent-q">Ile masz miejsca nad wnęką?</span>
                <span className="zl-vent-opts zl-space-opts" role="group" aria-label="Miejsce nad wnęką">
                  <button
                    type="button"
                    className={`zl-chip ${spaceChoice === "full" ? "is-active" : ""}`}
                    aria-pressed={spaceChoice === "full"}
                    onClick={() => {
                      setSpaceChoice("full");
                      trackShopStep("zaluzje_space_above", "full", { stack_mm: stackAboveMm });
                    }}
                  >
                    <strong>Mam co najmniej {cmText(stackAboveMm)} cm</strong>
                  </button>
                  <button
                    type="button"
                    className={`zl-chip ${spaceChoice === "less" ? "is-active" : ""}`}
                    aria-pressed={spaceChoice === "less"}
                    onClick={() => {
                      setSpaceChoice("less");
                      trackShopStep("zaluzje_space_above", "less", { stack_mm: stackAboveMm });
                    }}
                  >
                    <strong>Mam mniej - podaj ile</strong>
                  </button>
                </span>
                {spaceChoice === "less" ? (
                  <label className="zl-space-less">
                    cm nad wnęką (0-{cmText(stackAboveMm)})
                    <input
                      type="number"
                      inputMode="decimal"
                      min={0}
                      max={stackAboveMm / 10}
                      step={0.5}
                      value={spaceLessCm}
                      onChange={(event) => setSpaceLessCm(event.target.value)}
                    />
                  </label>
                ) : null}
                {spaceChoice === "less" && spaceLessCm !== "" && spaceAboveMm !== null && spaceAboveMm < stackAboveMm ? (
                  <p className="zl-handle-warning" role="note">
                    Podniesiony pakiet zasłoni górne ok. {cmText(stackAboveMm - spaceAboveMm)} cm światła.
                  </p>
                ) : null}
                {spaceChoice === "less" && spaceLessMm >= stackAboveMm && spaceLessCm !== "" ? (
                  <p className="hero-product-config-hint">To wystarczy - pakiet zmieści się nad wnęką.</p>
                ) : null}
                {spaceChoice === "" ? <p className="hero-product-config-hint">Wybierz jedną z opcji - od tego zależy wysokość żaluzji.</p> : null}
              </div>
            ) : null}
            {measuring && zaluzjeRule && inputWidthMm > 0 && inputHeightMm > 0 && (!wallMode || (spaceAboveMm !== null && stackAboveMm > 0)) ? (
              <p className={`zl-blind-size ${dimensionsValid ? "" : "is-invalid"}`} aria-live="polite">
                <span>
                  Wymiar żaluzji: <strong>{cmText(widthNum)} × {cmText(heightNum)} cm</strong>
                </span>
                {wallMode && spaceAboveMm !== null ? (
                  <small>
                    światło {cmText(inputWidthMm)} × {cmText(inputHeightMm)} cm, +10 cm szerokości,{" "}
                    {spaceAboveMm >= stackAboveMm ? `+${cmText(stackAboveMm)} cm na pakiet nad wnęką` : `+${cmText(spaceAboveMm)} cm, pakiet częściowo w świetle`}
                  </small>
                ) : (
                  <small>{zaluzjeRule.ruleText}</small>
                )}
              </p>
            ) : null}
            {specIssue ? (
              <p className="rolety-unavailable-note zl-spec-issue" role="alert">
                {specIssue}
              </p>
            ) : null}
            {modelFirst && !wallMode && stackMm && heightNum > 0 && (dimensionsValid || inputHeightMm > 0) ? (
              <p className="zl-stack-note" role="note">
                Pakiet po podniesieniu: <strong>ok. {cmText(stackMm)} cm</strong> ({stackPercent} % wysokości) - tyle żaluzja zasłoni u góry szyby po pełnym podciągnięciu
                {tapeChosen ? " (z taśmą pakiet jest nieco wyższy)" : ""}.
              </p>
            ) : null}
            {handleWarning ? (
              <p className="zl-handle-warning" role="note">
                {handleWarning}
              </p>
            ) : null}
            {remeasureHint ? (
              <p className="plisy-remeasure-hint" role="status">
                {remeasureHint}{" "}
                <button type="button" onClick={() => setRemeasureHint(null)}>
                  Rozumiem
                </button>
              </p>
            ) : null}
            {unitAskModal}
            {(width || height) && !dimensionsValid ? (
              <div className="hero-product-dimensions-error">
                {timesTenFix ? (
                  <p className="plisy-dimensions-hint">
                    {timesTenFix.fromMm ? "Wpisujesz w milimetrach? " : ""}
                    Czy chodziło Ci o {timesTenFix.widthMm / 10} × {timesTenFix.heightMm / 10} cm?
                    <button type="button" onClick={applyTimesTenFix}>
                      {timesTenFix.fromMm ? "Tak, przelicz na cm" : "Tak, popraw"}
                    </button>
                  </p>
                ) : looksLikeCm ? (
                  <p className="plisy-dimensions-hint">
                    {inputWidthMm} × {inputHeightMm} mm to tylko {inputWidthMm / 10} × {inputHeightMm / 10} cm — mniej niż najmniejszy produkowany wymiar. Wygląda na centymetry.
                    <button type="button" onClick={() => switchDimensionUnit("cm")}>
                      Tak, to centymetry
                    </button>
                  </p>
                ) : (
                  <p>
                    {measuring ? `Wymiar żaluzji po przeliczeniu: ${cmText(widthNum)} × ${cmText(heightNum)} cm. Produkujemy: ` : ""}
                    {measuring ? "szerokość" : "Szerokość"} {formatRange(p.widthMinMm, p.widthMaxMm)}, wysokość {formatRange(p.heightMinMm, p.heightMaxMm)}.
                    {dimensionUnit === "mm" ? " Masz wymiar w centymetrach? Przełącz jednostkę powyżej." : ""}
                  </p>
                )}
              </div>
            ) : null}
            </>
            )}
          </div>
        </div>
      </section>
    );
  }

  function renderPriceCard() {
    if (!dimensionsValid) return null;
    return (
      <div className="plisy-price-card" aria-live="polite">
        {(() => {
          if (selectedUnavailable) {
            return <span className="rolety-unavailable-note">{copy.unavailableMessage}</span>;
          }
          const exact = Boolean(selectedFabricGroup) && unitPrice !== null && totalPrice !== null;
          const unitAmount = exact ? unitPrice : cheapest ? cheapest.unit : null;
          if (unitAmount === null) {
            return <span className="plisy-price-card-label">Cenę policzymy po wyborze {copy.groupUnit === "model" ? "modelu" : "kolekcji tkaniny"}.</span>;
          }
          const total = Math.round(unitAmount * quantityNum * 100) / 100;
          return (
            <>
              <span className="plisy-price-card-label">{exact ? "Cena za sztukę" : "Cena za sztukę — od"}</span>
              <span className="plisy-price-card-rows">
                <span className="plisy-price-card-row is-promo">
                  <strong>{formatZl(unitAmount)}</strong>
                </span>
                {quantityNum > 1 ? (
                  <span className="plisy-price-card-row">
                    <em>Razem za {quantityNum} szt.</em>
                    <strong style={{ fontSize: "1.05rem" }}>{formatZl(total)}</strong>
                  </span>
                ) : null}
              </span>
              {!exact && cheapest ? (
                <span className="plisy-price-card-note">
                  {copy.groupUnit === "model" ? "Model" : "Kolekcja"} {cheapest.groupLabel}. Dokładną cenę zobaczysz po wyborze {copy.groupUnit === "model" ? "modelu" : "kolekcji"} i koloru.
                </span>
              ) : null}
              {modelFirst && exact && priceExtraLines.length && baseUnitPrice !== null ? (
                <span className="zs-price-extras">
                  <span>Żaluzja: {formatZl(baseUnitPrice)}</span>
                  {priceExtraLines.map((line) => (
                    <span key={line.attr}>
                      {line.title}: {line.label} +{formatZl(line.amount)}
                    </span>
                  ))}
                </span>
              ) : null}
              <span className="plisy-price-card-perks">W cenie: 5 lat gwarancji i 30 dni na zwrot</span>
            </>
          );
        })()}
      </div>
    );
  }

  function renderHardwareSection(stepNo: number) {
    return (
      <section className={`hero-product-step-accordion hero-product-step-accordion--hardware-color ${stepHardwareCollapsed ? "is-collapsed" : ""}`}>
        {stepHead(
          "hardware_color",
          stepNo,
          "Wybierz kolor mechanizmu",
          Boolean(selectedHardware),
          stepHardwareCollapsed,
          () => setStepHardwareCollapsed((prev) => !prev),
          <>
            {selectedHardware && stepHardwareCollapsed ? <span className="hero-product-step-head-swatch is-color-only" style={{ background: selectedHardware.color }} aria-hidden="true" /> : null}
            {selectedHardware ? <strong>{selectedHardware.label}</strong> : null}
          </>,
          stepHardwareRef,
        )}
        <div className="hero-product-step-body">
          <p className="hero-product-config-hint">Kolor rury, uchwytów i łańcuszka. Wybierz najbliższy ramie okna.</p>
          <div className="plisy-bracket-grid">
            {profile!.hardware.map((option) => {
              const isActive = option.id === selectedHardwareId;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`plisy-bracket-option ${isActive ? "is-active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => {
                    trackShopStep("select_hardware_color", option.label, { option_id: option.id, product: slug });
                    setSelectedHardwareId(option.id);
                    setStepHardwareCollapsed(true);
                    window.setTimeout(() => scrollStepIntoView(stepGroupRef.current), 380);
                  }}
                >
                  <span className="plisy-bracket-dot" style={{ background: option.color }} aria-hidden="true" />
                  <strong>{option.label}</strong>
                  {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  function renderGroupCard(group: FabricGroup) {
    const isActive = group.id === selectedFabricGroupId;
    const unavailable = groupUnavailable(group.id);
    const groupUnit = unavailable ? null : unitPriceFor(group.id);
    return (
      <div key={group.id} className={`plisy-coll-cell ${isActive ? "is-active" : ""} ${unavailable ? "is-unavailable" : ""}`}>
        <button
          type="button"
          className={`hero-product-mesh-option plisy-coll-card ${isActive ? "is-active" : ""}`}
          onClick={() => {
            trackShopStep(copy.groupUnit === "model" ? "select_model" : "select_fabric_group", group.label, { option_id: group.id, product: slug });
            pickFabricGroup(group.id);
          }}
        >
          {copy.groupCardPhoto && group.imageUrl ? (
            <span className="rolety-group-photo" aria-hidden="true" style={{ backgroundImage: `url(${optimizeImageUrl(group.imageUrl, 220)})` }} />
          ) : (
            <PlisyCollectionBackdrop group={group} />
          )}
          <span className="plisy-coll-card-body">
            <span className="plisy-coll-card-head">
              <strong>{group.label}</strong>
            </span>
            {group.note && !copy.groupCardPhoto ? <span className="plisy-coll-card-note">{group.note}</span> : null}
            <span className="plisy-coll-card-meta">
              {group.swatches.length ? <span className="plisy-coll-card-count">{colorCountLabel(group.swatches.length)}</span> : null}
              {unavailable ? (
                <span className="rolety-unavailable-badge">Niedostępny w tym wymiarze</span>
              ) : groupUnit !== null ? (
                <span className="plisy-coll-card-price">
                  {formatZl(groupUnit)}
                  <em>za sztukę</em>
                </span>
              ) : null}
            </span>
          </span>
        </button>
        {group.note ? (
          <button
            type="button"
            className="plisy-coll-card-info"
            aria-label={`Informacje: ${group.label}`}
            title="Szczegóły"
            onClick={(event) => {
              event.stopPropagation();
              trackShopStep("fabric_group_info", group.label, { option_id: group.id, product: slug });
              setCollectionInfoId(group.id);
            }}
          >
            i
          </button>
        ) : null}
      </div>
    );
  }

  function renderGroupSection(stepNo: number) {
    return (
      <section className={`hero-product-step-accordion ${stepGroupCollapsed ? "is-collapsed" : ""}`}>
        {stepHead(
          "fabric_group",
          stepNo,
          copy.groupStepTitle,
          Boolean(selectedFabricGroup),
          stepGroupCollapsed,
          () => setStepGroupCollapsed((prev) => !prev),
          selectedFabricGroup ? <strong>{selectedFabricGroup.label}</strong> : null,
          stepGroupRef,
        )}
        <div className="hero-product-step-body" style={stepGroupCollapsed ? undefined : { maxHeight: "none", overflow: "visible" }}>
          {dimensionsValid ? <p className="hero-product-config-hint">Ceny policzone dla Twojego wymiaru ({sizeSummaryText}).</p> : null}
          {groupSections.length > 1 ? (
            groupSections.map((section) => (
              <div key={section.category || "_"} className="rolety-group-section">
                {section.category ? <h4 className="rolety-group-section-title">{section.category}</h4> : null}
                <div className="plisy-coll-grid">{section.groups.map(renderGroupCard)}</div>
              </div>
            ))
          ) : (
            <div className="plisy-coll-grid">{profile!.fabricGroups.map(renderGroupCard)}</div>
          )}
        </div>
      </section>
    );
  }

  const collectionInfoModal =
    collectionInfoGroup && typeof document !== "undefined"
      ? createPortal(
          <div className="instruction-modal instruction-modal--collection" role="dialog" aria-modal="true" aria-label={collectionInfoGroup.label} onClick={() => setCollectionInfoId("")}>
            <div className="instruction-modal-shell instruction-modal-shell--collection" onClick={(event) => event.stopPropagation()}>
              <button type="button" className="instruction-modal-close" aria-label="Zamknij" onClick={() => setCollectionInfoId("")}>
                ×
              </button>
              {copy.groupCardPhoto && collectionInfoGroup.imageUrl ? (
                <img className="rolety-group-modal-photo" src={optimizeImageUrl(collectionInfoGroup.imageUrl, 700)} alt={collectionInfoGroup.label} loading="lazy" />
              ) : null}
              <div className="plisy-coll-modal-head">
                <div>
                  <h3>{collectionInfoGroup.label}</h3>
                </div>
              </div>
              {collectionInfoGroup.note ? <p>{collectionInfoGroup.note}</p> : null}
              <p className="plisy-coll-modal-count">{colorCountLabel(collectionInfoGroup.swatches.length)} do wyboru.</p>
              <button
                type="button"
                className="plisy-coll-modal-cta"
                onClick={() => {
                  const group = collectionInfoGroup;
                  trackShopStep(copy.groupUnit === "model" ? "select_model" : "select_fabric_group", group.label, { option_id: group.id, source: "info_modal", product: slug });
                  setCollectionInfoId("");
                  pickFabricGroup(group.id);
                }}
              >
                {copy.groupUnit === "model" ? "Wybieram ten model" : "Wybieram tę kolekcję"}
              </button>
            </div>
          </div>,
          document.body,
        )
      : null;

  function renderColorSection(stepNo: number) {
    const group = selectedFabricGroup!;
    return (
      <section className={`hero-product-step-accordion hero-product-step-accordion--fabric-color ${stepFabricCollapsed ? "is-collapsed" : ""}`}>
        {stepHead(
          "fabric_color",
          stepNo,
          copy.colorStepTitle,
          Boolean(selectedFabric),
          stepFabricCollapsed,
          () => setStepFabricCollapsed((prev) => !prev),
          <>
            {selectedFabric && stepFabricCollapsed ? (
              <span className="hero-product-step-head-swatch" style={buildPlisyHardwareSwatchStyle(selectedFabric.thumbnailUrl, selectedFabric.color)} aria-hidden="true" />
            ) : null}
            {selectedFabric ? <strong>{selectedFabric.label}</strong> : null}
          </>,
          stepFabricRef,
          true,
        )}
        <div className="hero-product-step-body">
          {gallerySwatches.length ? (
            <div className="plisy-fabric-tools">
              <button
                type="button"
                className="plisy-fabric-gallery-cta"
                onClick={() => {
                  const at = Math.max(0, gallerySwatches.findIndex((swatch) => swatch.id === selectedFabricId));
                  setFabricGalleryIndex(at);
                  trackShopStep("fabric_gallery_open", group.label, { source: "cta", product: slug });
                }}
              >
                🔍 Zobacz duże zdjęcia
              </button>
            </div>
          ) : null}
          <div className="hero-product-mesh-grid hero-product-mesh-grid--visual">
            {swatchesForGroup.map((swatch) => {
              const isActive = swatch.id === selectedFabricId;
              const galleryAt = gallerySwatches.findIndex((entry) => entry.id === swatch.id);
              return (
                <div key={swatch.id} className="plisy-swatch-cell">
                  <button type="button" className={`hero-product-mesh-option hero-product-mesh-option--visual ${isActive ? "is-active" : ""}`} title={swatch.label} onClick={() => pickFabric(swatch.id)}>
                    {/* Próbka bez zdjęcia (część kolorów żaluzji) = kafelek w kolorze z CRM i nazwą. */}
                    <span className="hero-product-mesh-option-image" style={buildPlisyHardwareSwatchStyle(swatch.thumbnailUrl, swatch.color)} />
                    <strong>{swatch.label}</strong>
                  </button>
                  {galleryAt >= 0 ? (
                    <button
                      type="button"
                      className="plisy-swatch-zoom"
                      aria-label={`Powiększ ${swatch.label}`}
                      title="Powiększ"
                      onClick={(event) => {
                        event.stopPropagation();
                        setFabricGalleryIndex(galleryAt);
                        trackShopStep("fabric_gallery_open", swatch.label, { source: "swatch", option_id: swatch.id, product: slug });
                      }}
                    >
                      🔍
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          {fabricGalleryIndex !== null && gallerySwatches.length ? (
            <PlisyFabricGallery
              swatches={gallerySwatches}
              index={Math.min(fabricGalleryIndex, gallerySwatches.length - 1)}
              collectionLabel={group.label}
              selectedId={selectedFabricId}
              onIndexChange={setFabricGalleryIndex}
              onClose={() => setFabricGalleryIndex(null)}
              onPick={(swatch) => pickFabric(swatch.id, "gallery")}
            />
          ) : null}
        </div>
      </section>
    );
  }

  function renderControlSection(stepNo: number) {
    return (
      <section className={`hero-product-step-accordion hero-product-step-accordion--chain ${stepChainCollapsed ? "is-collapsed" : ""}`}>
        {stepHead(
          "chain_side",
          stepNo,
          copy.controlStepTitle,
          Boolean(chainSide),
          stepChainCollapsed,
          () => setStepChainCollapsed((prev) => !prev),
          chainSide ? <strong>{chainLabel}</strong> : null,
          stepChainRef,
        )}
        <div className="hero-product-step-body">
          <p className="hero-product-config-hint">{copy.controlStepHint}</p>
          <div className="plisy-bracket-grid" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>
            {CHAIN_SIDES.map((entry) => {
              const isActive = entry.id === chainSide;
              return (
                <button
                  key={entry.id}
                  type="button"
                  className={`plisy-bracket-option ${isActive ? "is-active" : ""}`}
                  aria-pressed={isActive}
                  onClick={() => {
                    trackShopStep("select_chain_side", entry.label, { option_id: entry.id, product: slug });
                    setChainSide(entry.id);
                    setStepChainCollapsed(true);
                    window.setTimeout(() => scrollStepIntoView(summaryRef.current), 380);
                  }}
                >
                  <span className="rolety-chain-icon" aria-hidden="true" data-side={entry.id}>
                    {entry.id === "lewa" ? "◧" : "◨"}
                  </span>
                  <strong>{entry.label}</strong>
                  {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                </button>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  function renderSummary() {
    if (!selectedFabricGroup || !selectedFabric || (!modelFirst && !chainSide)) return null;
    const cmTextSummary = (mm: number) => (mm / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 });
    const tilterOption = modelFirst && ssModel ? ssOption(ssField(ssModel, "16"), ssSelection["16"]) : null;
    return (
      <div ref={summaryRef} className={`hero-product-mini-summary is-revealed ${modelFirst ? "zl-summary" : ""}`}>
        {modelFirst ? (
          <div className="zl-summary-body">
            <ZaluzjaHead
              photoUrl={previewData?.photoUrl || ""}
              swatchUrl={previewData?.swatchUrl || ""}
              swatchColor={previewData?.swatchColor || ""}
              swatchLabel={selectedFabric.label}
              title={selectedModelInfoName || selectedFabricGroup.label}
              sub={zlSub}
              onZoom={() => (previewData?.photoUrl ? openZoom({ title: `${selectedModelInfoName || selectedFabricGroup.label} - ${selectedFabric.label}`, urls: [previewData.photoUrl], index: 0 }) : undefined)}
            />
            <ZaluzjaSpecTable rows={zlRows} priceRows={zlPriceRows} />
          </div>
        ) : (
          <h3>{profile!.productName}</h3>
        )}
        {!modelFirst ? (
        <div className="hero-product-mini-summary-body">
          {previewData ? (
            <ZaluzjaPreview data={previewData} compact />
          ) : (
            <div className="rolety-summary-swatch" aria-hidden="true" style={buildPlisyHardwareSwatchStyle(selectedFabric.thumbnailUrl || selectedFabricGroup.imageUrl, selectedFabric.color)} />
          )}
          <dl>
            <div>
              <dt>Montaż</dt>
              <dd>{selectedMount?.label || "--"}</dd>
            </div>
            {hasHardwareStep ? (
              <div>
                <dt>Kolor mechanizmu</dt>
                <dd>{selectedHardware?.label || "--"}</dd>
              </div>
            ) : null}
            <div>
              <dt>{copy.groupUnit === "model" ? "Model i kolor" : "Tkanina"}</dt>
              <dd>
                {selectedFabricGroup.label} — {selectedFabric.label}
              </dd>
            </div>
            <div>
              <dt>{copy.groupUnit === "model" ? "Sterowanie" : "Łańcuszek"}</dt>
              <dd>{tilterOption ? ssTilterLabel(tilterOption.label) : chainLabel || "--"}</dd>
            </div>
            {modelFirst && ssModel ? (
              <div>
                <dt>Opcje</dt>
                <dd>{ssCustomerSummary(ssModel, ssSelection, ssCtx) || "--"}</dd>
              </div>
            ) : null}
            {modelFirst && priceExtraLines.length ? (
              <div>
                <dt>Dopłaty</dt>
                <dd>{priceExtraLines.map((line) => `${line.title === "Taśma" ? "Taśma " : ""}${line.label} +${formatZl(line.amount)}`).join(", ")}</dd>
              </div>
            ) : null}
            {dimensionsValid ? (
              <div>
                <dt>{modelFirst ? "Wymiar żaluzji" : "Wymiar"}</dt>
                <dd>
                  {widthNum} × {heightNum} mm · {quantityNum} szt.
                </dd>
              </div>
            ) : null}
            {modelFirst && measuring && zaluzjeRule && dimensionsValid ? (
              <div>
                <dt>Pomiar</dt>
                <dd>
                  {zaluzjeRule.measureNoun}: {inputWidthMm} × {inputHeightMm} mm
                  {zaluzjeRule.id === "na-skrzydlo" ? (hasVent ? ", nawiewnik: tak (wysokość pod nawiewnikiem)" : ", bez nawiewnika") : ""}
                  {wallMode && spaceAboveMm !== null ? `, nad wnęką ${spaceAboveMm / 10} cm` : ""}
                </dd>
              </div>
            ) : null}
            {modelFirst && stackMm ? (
              <div>
                <dt>Pakiet po podniesieniu</dt>
                <dd>
                  ok. {cmTextSummary(stackMm)} cm ({stackPercent} % wysokości)
                </dd>
              </div>
            ) : null}
          </dl>
        </div>
        ) : null}
        {!dimensionsValid ? (
          <div className="plisy-missing-dims">
            <span>Brakuje wymiarów — bez nich nie policzymy ceny.</span>
            <button
              type="button"
              onClick={() => {
                setStepDimsCollapsed(false);
                trackShopStep("configurator_jump_to_dims", slug, {});
                window.setTimeout(() => scrollStepIntoView(stepDimsRef.current), 80);
              }}
            >
              Wpisz wymiary (krok 2)
            </button>
          </div>
        ) : null}
        {specIssue && !selectedUnavailable ? (
          <div className="plisy-missing-dims rolety-unavailable-block" role="alert">
            <span>{specIssue}</span>
            <button
              type="button"
              onClick={() => {
                setStepDimsCollapsed(false);
                window.setTimeout(() => scrollStepIntoView(stepDimsRef.current), 80);
              }}
            >
              Zmień wymiar
            </button>
          </div>
        ) : null}
        {selectedUnavailable ? (
          <div className="plisy-missing-dims rolety-unavailable-block" role="alert">
            <span>{copy.unavailableMessage}</span>
            <button
              type="button"
              onClick={() => {
                setStepDimsCollapsed(false);
                window.setTimeout(() => scrollStepIntoView(stepDimsRef.current), 80);
              }}
            >
              Zmień wymiar
            </button>
            {modelLocked ? (
              <Link href={selectedModelInfo ? `/zaluzje?kategoria=${selectedModelInfo.categorySlug}` : "/zaluzje"} className="rolety-unavailable-link">
                Wybierz inny model
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setStepGroupCollapsed(false);
                  window.setTimeout(() => scrollStepIntoView(stepGroupRef.current), 80);
                }}
              >
                Zmień {copy.groupUnit === "model" ? "model" : "kolekcję"}
              </button>
            )}
          </div>
        ) : null}
        {unitPrice !== null && totalPrice !== null ? (
          <div className="total-block">
            <span className="total-block-left">
              <span className="total-block-label">Razem</span>
              {quantityNum > 1 ? <span className="total-block-savings">{quantityNum} szt. × {formatZl(unitPrice)}</span> : null}
            </span>
            <span className="total-block-right">
              <strong>{formatZl(totalPrice)}</strong>
            </span>
          </div>
        ) : null}
        <button type="button" className="hero-product-add-to-cart" onClick={handleSubmit} disabled={!canSubmit}>
          {submitLabel}
        </button>
      </div>
    );
  }

  const zoomModal =
    !onZoom && internalZoomPreview ? (
      <div className="config-option-preview-modal" role="dialog" aria-modal="true" aria-label={internalZoomPreview.title} onClick={() => setInternalZoomPreview(null)}>
        <div className="config-option-preview-shell" onClick={(event) => event.stopPropagation()}>
          <button type="button" className="config-option-preview-close" onClick={() => setInternalZoomPreview(null)} aria-label="Zamknij podgląd">
            ×
          </button>
          <img src={optimizeImageUrl(internalZoomPreview.urls[internalZoomPreview.index], 1200, 80)} alt={internalZoomPreview.title} className="config-option-preview-image" loading="eager" />
          <p>{internalZoomPreview.title}</p>
        </div>
      </div>
    ) : null;

  if (modelFirst) {
    // Żaluzje: model na sztywno (strona produktu / edycja z koszyka), kolor ->
    // wymiary -> klamry -> sterowanie. Zmiana modelu tylko przez katalog.
    if (modelSlug && profile && !modelFromSlug) {
      return (
        <>
          <header>
            <strong>{headerTitle}</strong>
          </header>
          <p className="hero-product-config-hint">Nie znaleźliśmy tego modelu żaluzji.</p>
          <Link href="/zaluzje" className="plisy-position-add">
            Zobacz wszystkie żaluzje
          </Link>
        </>
      );
    }
    return (
      <>
        <header>
          <strong>{modelLocked && selectedModelInfo ? `Wyceń: ${selectedModelInfo.name}` : headerTitle}</strong>
        </header>
        {showGroupStep ? renderGroupSection(0) : null}
        {collectionInfoModal}
        {selectedFabricGroup ? (
          <>
            {renderMountSection(1)}
            {renderDimsSection(2)}
            {renderColorSection(3)}
            {selectedFabric && ssModel ? (
              <div ref={ssStepsRef}>
                <ZaluzjeLadderSteps
                  model={ssModel}
                  selection={ssSelection}
                  onChange={(v) => setSsSelection((prev) => ({ ...prev, "7": v }))}
                  colorV={ssColorV}
                  colorLabel={selectedFabric.label}
                  basePrice={baseUnitPrice}
                  firstStepNo={4}
                />
              </div>
            ) : null}
            {/* Cena dopiero po montażu, wymiarach, kolorze i drabince (właściciel, 17.10.2026). */}
            {selectedFabric && ssModel && ladderDone ? renderPriceCard() : null}
            {selectedFabric ? (
              ssModel ? (
                ladderDone ? (
                <div>
                  <ZaluzjeSsSteps
                    model={ssModel}
                    selection={ssSelection}
                    onChange={(attr, v) => setSsSelection((prev) => ({ ...prev, [attr]: v }))}
                    noDrill={noDrill}
                    onNoDrillChange={(on) => {
                      setNoDrill(on);
                      setSsSelection((prev) => ssApplyNoDrill(ssModel, prev, on));
                    }}
                    widthMm={widthNum}
                    mountId={selectedMountId}
                    colorV={ssColorV}
                    firstStepNo={4 + (ssLadderInfo(ssModel, ssColorV).cordOption && ssLadderInfo(ssModel, ssColorV).tapeOptions.length ? 1 : 0) + (ssLadderInfo(ssModel, ssColorV).hasField ? 1 : 0)}
                  />
                </div>
                ) : (
                  <p className="hero-product-config-hint">Wybierz rodzaj drabinki - potem pokażemy cenę i pozostałe opcje.</p>
                )
              ) : (
                <p className="hero-product-config-hint">Wczytuję opcje żaluzji…</p>
              )
            ) : (
              <p className="hero-product-config-hint">Wybierz kolor lameli, aby przejść do kolejnych opcji.</p>
            )}
            {renderSummary()}
          </>
        ) : (
          <p className="hero-product-config-hint">Wybierz model, aby przejść do koloru lameli.</p>
        )}
        {measureGuideOpen ? (
          <ZaluzjeMeasureModal
            mountId={(zaluzjeMountRule(selectedMountId)?.id || "w-swietle-szyby") as ZaluzjeMountId}
            hasVent={hasVent}
            pid={wallPid || undefined}
            withTape={wallTape}
            onClose={() => setMeasureGuideOpen(false)}
            onPick={(id) => {
              const option = profile?.mountOptions.find((entry) => entry.id === id);
              setMeasureGuideOpen(false);
              if (option) handleMountChange(option);
            }}
          />
        ) : null}
        {zoomModal}
      </>
    );
  }

  const groupStepNo = hasHardwareStep ? 4 : 3;
  const controlStepNo = hasHardwareStep ? 5 : 4;
  return (
    <>
      <header>
        <strong>{headerTitle}</strong>
      </header>
      {renderMountSection(1)}
      {renderDimsSection(2)}
      {renderPriceCard()}
      {hasHardwareStep ? renderHardwareSection(3) : null}
      {hasHardwareStep && !selectedHardwareId ? <p className="hero-product-config-hint">Wybierz kolor mechanizmu, aby przejść do kolejnego kroku.</p> : null}
      {hardwareChosen ? (
        <>
          {renderGroupSection(groupStepNo)}
          {collectionInfoModal}
          {selectedFabricGroup ? (
            <>
              {renderColorSection(groupStepNo)}
              {selectedFabric ? (
                <>
                  {renderControlSection(controlStepNo)}
                  {renderSummary()}
                </>
              ) : null}
            </>
          ) : null}
        </>
      ) : null}
      {zoomModal}
    </>
  );
}
