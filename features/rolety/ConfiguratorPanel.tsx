"use client";

// Konfigurator rolet mini (dzień-noc i tradycyjne) oraz żaluzji poziomych -
// jedna implementacja sparametryzowana slugiem (reguły i nazwy kroków w
// ROLETY_COPY, shared.ts). Kroki (właściciel, 17.10.2026): 1) montaż,
// 2) wymiary i ilość (z instrukcją pomiaru pod wybrany montaż), 3) kolor
// mechanizmu (pomijany, gdy produkt go nie ma - żaluzje), 4) kolekcja
// tkaniny / model żaluzji -> kolor, 5) strona łańcuszka / sterowania, na końcu
// karta ceny i "Dodaj do koszyka". Bez pola uwag (zasada właściciela), bez
// powiększeń na najechanie - tylko lupa na kliknięcie. Układ, klasy CSS i
// zachowanie akordeonów skopiowane z plis (features/plisy/ConfiguratorPanel.tsx);
// dane i cennik z CRM. Komórka cennika = 0 oznacza wymiar niedostępny dla
// danego modelu - pokazujemy komunikat i blokujemy dodanie do koszyka.
import { useEffect, useMemo, useRef, useState } from "react";
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
import {
  CHAIN_SIDES,
  calcRoletyPrice,
  fetchRoletyProfile,
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
}: {
  slug: RoletySlug;
  initialValues?: ConfiguratorInitialValues;
  submitLabel: string;
  onSubmit: (result: ConfiguratorResult) => void;
  onZoom?: (preview: ZoomPreview) => void;
}) {
  const copy = ROLETY_COPY[slug];
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
  // konfiguracja startuje ze szkicu sprzed maksymalnie tygodnia.
  const isCartEdit = Boolean(
    initialValues && Object.keys(initialValues).some((key) => key !== "widthMm" && key !== "heightMm" && key !== "qty"),
  );
  const [draftSeed] = useState<RoletyDraft | null>(() => (isCartEdit ? null : readDraft(slug)));
  const seed: RoletyDraft & ConfiguratorInitialValues = { ...(draftSeed ?? {}), ...(initialValues ?? {}) };

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
  const [width, setWidth] = useState(() => (initialValues?.widthMm ? mmToInput(initialValues.widthMm, readStoredUnit()) : ""));
  const [height, setHeight] = useState(() => (initialValues?.heightMm ? mmToInput(initialValues.heightMm, readStoredUnit()) : ""));
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
  // pomiaru w kroku 2. Krok zostaje otwarty, żeby klient go zobaczył i mógł
  // zmienić.
  useEffect(() => {
    if (!profile || selectedMountId) return;
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

  const widthNum = inputToMm(width, dimensionUnit);
  const heightNum = inputToMm(height, dimensionUnit);
  const widthInRange = profile ? widthNum >= profile.widthMinMm && widthNum <= profile.widthMaxMm : false;
  const heightInRange = profile ? heightNum >= profile.heightMinMm && heightNum <= profile.heightMaxMm : false;
  const dimensionsValid = widthInRange && heightInRange;
  const quantityNum = Math.min(ROLETY_QTY_MAX, Math.max(1, Math.round(Number(quantity) || 1)));

  const looksLikeCm =
    dimensionUnit === "mm" &&
    !dimensionsValid &&
    widthNum > 0 &&
    heightNum > 0 &&
    (profile ? widthNum < profile.widthMinMm / 2 && heightNum < profile.heightMinMm / 2 : false);
  const timesTenFix = (() => {
    if (!profile || dimensionUnit !== "cm" || dimensionsValid || widthNum <= 0 || heightNum <= 0) return null;
    const fixAxis = (v: number, min: number, max: number) => (v < min ? v * 10 : v > max ? v / 10 : v);
    const fixW = fixAxis(widthNum, profile.widthMinMm, profile.widthMaxMm);
    const fixH = fixAxis(heightNum, profile.heightMinMm, profile.heightMaxMm);
    if (fixW === widthNum && fixH === heightNum) return null;
    const wOk = fixW >= profile.widthMinMm && fixW <= profile.widthMaxMm;
    const hOk = fixH >= profile.heightMinMm && fixH <= profile.heightMaxMm;
    const fromMm = fixW < widthNum || fixH < heightNum;
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
  const unitPrice = unitPriceFor(selectedFabricGroupId);
  const totalPrice = unitPrice !== null ? Math.round(unitPrice * quantityNum * 100) / 100 : null;
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
    if ((widthNum > 0 || heightNum > 0) && hintBefore !== hintAfter) {
      setRemeasureHint(
        slug === "zaluzje"
          ? "Zmieniłeś sposób montażu - sprawdź wymiary według instrukcji powyżej."
          : isRoletyCassetteMount(option.id) || isRoletyCassetteMount(option.label)
            ? "Zmieniłeś montaż na kasetę: podaj dokładny wymiar szyby między uszczelkami, bez dodawania 15 mm."
            : "Zmieniłeś montaż: do wymiaru szyby między uszczelkami dodaj po 15 mm z każdej strony.",
      );
    }
    setStepDimsCollapsed(false);
    window.setTimeout(() => scrollStepIntoView(stepDimsRef.current), 380);
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

  const canSubmit = Boolean(selectedMount && hardwareChosen && selectedFabricGroup && selectedFabric && chainSide && dimensionsValid && unitPrice !== null && !selectedUnavailable);

  // Stan formularza dla analityki "na czym stanął" (lib/configurator-state).
  useEffect(() => {
    const done: string[] = [];
    const missing: string[] = [];
    (selectedMount ? done : missing).push("montaż");
    (dimensionsValid ? done : missing).push("wymiary");
    if (hasHardwareStep) (selectedHardware ? done : missing).push("kolor mechanizmu");
    (selectedFabricGroup ? done : missing).push(copy.groupUnit);
    (selectedFabric ? done : missing).push("kolor");
    (chainSide ? done : missing).push(copy.controlLabelWord);
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
    if (!canSubmit || !selectedMount || !selectedFabricGroup || !selectedFabric || !chainSide || unitPrice === null || totalPrice === null) return;
    onSubmit({
      mountId: selectedMount.id,
      mountLabel: joinRoletyMountLabel(selectedMount.label, chainSide, slug),
      chainSide,
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
      qty: quantityNum,
      unitPrice,
      totalPrice,
    });
  }

  const headerTitle = `Wyceń ${copy.shortName} do swojego okna`;

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
  const groupStepNo = hasHardwareStep ? 4 : 3;
  const controlStepNo = hasHardwareStep ? 5 : 4;
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

  return (
    <>
      <header>
        <strong>{headerTitle}</strong>
      </header>

      {/* KROK 1: sposób montażu */}
      <section className={`hero-product-step-accordion hero-product-step-accordion--mount ${stepMountCollapsed ? "is-collapsed" : ""}`}>
        <button
          type="button"
          className="hero-product-step-head"
          onClick={() => {
            trackShopStep("configurator_step_toggle", "mount_type", { collapsed_after: !stepMountCollapsed, product: slug });
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
            {selectedMount ? <strong>{selectedMount.label}</strong> : null}
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
        </div>
      </section>

      {/* KROK 2: wymiary i ilość */}
      <section className={`hero-product-step-accordion hero-product-step-accordion--dimensions ${stepDimsCollapsed ? "is-collapsed" : ""}`}>
        <button
          type="button"
          className="hero-product-step-head"
          onClick={() => {
            trackShopStep("configurator_step_toggle", "dimensions", { collapsed_after: !stepDimsCollapsed, product: slug });
            setStepDimsCollapsed((prev) => !prev);
          }}
          aria-expanded={stepDimsCollapsed ? "false" : "true"}
        >
          <span className="hero-product-config-step-title hero-product-config-step-title--muted">
            <span className={`hero-product-step-check ${dimensionsValid ? "" : "is-muted"}`} aria-hidden="true">
              {dimensionsValid ? "✓" : "2"}
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
        <div className="hero-product-step-body" style={dimsOpenStyle}>
          <div className="plisy-position-form" ref={stepDimsRef}>
            <p className="hero-product-config-hint">{measureHint}</p>
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
                <input type="number" inputMode="numeric" min={1} max={ROLETY_QTY_MAX} value={quantity} onChange={(event) => setQuantity(event.target.value)} />
              </label>
            </div>
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
                    {widthNum} × {heightNum} mm to tylko {widthNum / 10} × {heightNum / 10} cm — mniej niż najmniejszy produkowany wymiar. Wygląda na centymetry.
                    <button type="button" onClick={() => switchDimensionUnit("cm")}>
                      Tak, to centymetry
                    </button>
                  </p>
                ) : (
                  <p>
                    Szerokość {formatRange(profile.widthMinMm, profile.widthMaxMm)}, wysokość {formatRange(profile.heightMinMm, profile.heightMaxMm)}.
                    {dimensionUnit === "mm" ? " Masz wymiar w centymetrach? Przełącz jednostkę powyżej." : ""}
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </div>
      </section>

      {/* Cena zaraz po wymiarach: "od" przed wyborem grupy, potem dokładna. */}
      {dimensionsValid ? (
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
                <span className="plisy-price-card-perks">W cenie: 5 lat gwarancji i 30 dni na zwrot</span>
              </>
            );
          })()}
        </div>
      ) : null}

      {/* KROK 3: kolor mechanizmu (tylko produkty, które go mają) */}
      {hasHardwareStep ? (
        <section className={`hero-product-step-accordion hero-product-step-accordion--hardware-color ${stepHardwareCollapsed ? "is-collapsed" : ""}`}>
          <button
            type="button"
            ref={stepHardwareRef}
            className="hero-product-step-head"
            onClick={() => {
              trackShopStep("configurator_step_toggle", "hardware_color", { collapsed_after: !stepHardwareCollapsed, product: slug });
              setStepHardwareCollapsed((prev) => !prev);
            }}
            aria-expanded={stepHardwareCollapsed ? "false" : "true"}
          >
            <span className="hero-product-config-step-title hero-product-config-step-title--muted">
              <span className={`hero-product-step-check ${selectedHardware ? "" : "is-muted"}`} aria-hidden="true">
                {selectedHardware ? "✓" : "3"}
              </span>
              Wybierz kolor mechanizmu
            </span>
            <span className="hero-product-step-head-meta">
              {selectedHardware && stepHardwareCollapsed ? (
                <span className="hero-product-step-head-swatch is-color-only" style={{ background: selectedHardware.color }} aria-hidden="true" />
              ) : null}
              {selectedHardware ? <strong>{selectedHardware.label}</strong> : null}
              {stepHardwareCollapsed ? (
                <span className="hero-product-step-head-change">Zmień</span>
              ) : (
                <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
              )}
            </span>
          </button>
          <div className="hero-product-step-body">
            <p className="hero-product-config-hint">Kolor rury, uchwytów i łańcuszka. Wybierz najbliższy ramie okna.</p>
            <div className="plisy-bracket-grid">
              {profile.hardware.map((option) => {
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
      ) : null}

      {hasHardwareStep && !selectedHardwareId ? <p className="hero-product-config-hint">Wybierz kolor mechanizmu, aby przejść do kolejnego kroku.</p> : null}

      {hardwareChosen ? (
        <>
          {/* KROK 3/4: kolekcja tkanin albo model żaluzji */}
          <section className={`hero-product-step-accordion ${stepGroupCollapsed ? "is-collapsed" : ""}`}>
            <button
              type="button"
              ref={stepGroupRef}
              className="hero-product-step-head"
              onClick={() => {
                trackShopStep("configurator_step_toggle", "fabric_group", { collapsed_after: !stepGroupCollapsed, product: slug });
                setStepGroupCollapsed((prev) => !prev);
              }}
              aria-expanded={stepGroupCollapsed ? "false" : "true"}
            >
              <span className="hero-product-config-step-title hero-product-config-step-title--muted">
                <span className={`hero-product-step-check ${selectedFabricGroup ? "" : "is-muted"}`} aria-hidden="true">
                  {selectedFabricGroup ? "✓" : String(groupStepNo)}
                </span>
                {copy.groupStepTitle}
              </span>
              <span className="hero-product-step-head-meta">
                {selectedFabricGroup ? <strong>{selectedFabricGroup.label}</strong> : null}
                {stepGroupCollapsed ? (
                  <span className="hero-product-step-head-change">Zmień</span>
                ) : (
                  <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
                )}
              </span>
            </button>
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
                <div className="plisy-coll-grid">{profile.fabricGroups.map(renderGroupCard)}</div>
              )}
            </div>
          </section>

          {collectionInfoGroup && typeof document !== "undefined"
            ? createPortal(
                <div
                  className="instruction-modal instruction-modal--collection"
                  role="dialog"
                  aria-modal="true"
                  aria-label={collectionInfoGroup.label}
                  onClick={() => setCollectionInfoId("")}
                >
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
            : null}

          {selectedFabricGroup ? (
            <>
              {/* KROK 4b: kolor tkaniny / lameli */}
              <section className={`hero-product-step-accordion hero-product-step-accordion--fabric-color ${stepFabricCollapsed ? "is-collapsed" : ""}`}>
                <button
                  type="button"
                  ref={stepFabricRef}
                  className="hero-product-step-head"
                  onClick={() => {
                    trackShopStep("configurator_step_toggle", "fabric_color", { collapsed_after: !stepFabricCollapsed, product: slug });
                    setStepFabricCollapsed((prev) => !prev);
                  }}
                  aria-expanded={stepFabricCollapsed ? "false" : "true"}
                >
                  <span className="hero-product-config-step-title hero-product-config-step-title--muted">
                    <span className={`hero-product-step-check ${selectedFabric ? "" : "is-muted"}`} aria-hidden="true">
                      {selectedFabric ? "✓" : String(groupStepNo)}
                    </span>
                    {copy.colorStepTitle}
                  </span>
                  <span className="hero-product-step-head-meta">
                    {selectedFabric && stepFabricCollapsed ? (
                      <span
                        className="hero-product-step-head-swatch"
                        style={buildPlisyHardwareSwatchStyle(selectedFabric.thumbnailUrl, selectedFabric.color)}
                        aria-hidden="true"
                      />
                    ) : null}
                    {selectedFabric ? <strong>{selectedFabric.label}</strong> : null}
                    {stepFabricCollapsed ? (
                      <span className="hero-product-step-head-change">Zmień</span>
                    ) : (
                      <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
                    )}
                  </span>
                </button>
                <div className="hero-product-step-body">
                  {gallerySwatches.length ? (
                    <div className="plisy-fabric-tools">
                      <button
                        type="button"
                        className="plisy-fabric-gallery-cta"
                        onClick={() => {
                          const at = Math.max(0, gallerySwatches.findIndex((swatch) => swatch.id === selectedFabricId));
                          setFabricGalleryIndex(at);
                          trackShopStep("fabric_gallery_open", selectedFabricGroup.label, { source: "cta", product: slug });
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
                          <button
                            type="button"
                            className={`hero-product-mesh-option hero-product-mesh-option--visual ${isActive ? "is-active" : ""}`}
                            title={swatch.label}
                            onClick={() => {
                              trackShopStep("select_fabric_color", swatch.label, { option_id: swatch.id, product: slug });
                              setSelectedFabricId(swatch.id);
                              setStepFabricCollapsed(true);
                              window.setTimeout(() => scrollStepIntoView(stepChainRef.current), 380);
                            }}
                          >
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
                      collectionLabel={selectedFabricGroup.label}
                      selectedId={selectedFabricId}
                      onIndexChange={setFabricGalleryIndex}
                      onClose={() => setFabricGalleryIndex(null)}
                      onPick={(swatch) => {
                        trackShopStep("select_fabric_color", swatch.label, { option_id: swatch.id, source: "gallery", product: slug });
                        setSelectedFabricId(swatch.id);
                        setFabricGalleryIndex(null);
                        setStepFabricCollapsed(true);
                        window.setTimeout(() => scrollStepIntoView(stepChainRef.current), 380);
                      }}
                    />
                  ) : null}
                </div>
              </section>

              {selectedFabric ? (
                <>
                  {/* KROK 4/5: strona łańcuszka / sterowania */}
                  <section className={`hero-product-step-accordion hero-product-step-accordion--chain ${stepChainCollapsed ? "is-collapsed" : ""}`}>
                    <button
                      type="button"
                      ref={stepChainRef}
                      className="hero-product-step-head"
                      onClick={() => {
                        trackShopStep("configurator_step_toggle", "chain_side", { collapsed_after: !stepChainCollapsed, product: slug });
                        setStepChainCollapsed((prev) => !prev);
                      }}
                      aria-expanded={stepChainCollapsed ? "false" : "true"}
                    >
                      <span className="hero-product-config-step-title hero-product-config-step-title--muted">
                        <span className={`hero-product-step-check ${chainSide ? "" : "is-muted"}`} aria-hidden="true">
                          {chainSide ? "✓" : String(controlStepNo)}
                        </span>
                        {copy.controlStepTitle}
                      </span>
                      <span className="hero-product-step-head-meta">
                        {chainSide ? <strong>{chainLabel}</strong> : null}
                        {stepChainCollapsed ? (
                          <span className="hero-product-step-head-change">Zmień</span>
                        ) : (
                          <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
                        )}
                      </span>
                    </button>
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

                  {chainSide ? (
                    <div ref={summaryRef} className="hero-product-mini-summary is-revealed">
                      <h3>{profile.productName}</h3>
                      <div className="hero-product-mini-summary-body">
                        <div
                          className="rolety-summary-swatch"
                          aria-hidden="true"
                          style={buildPlisyHardwareSwatchStyle(selectedFabric.thumbnailUrl || selectedFabricGroup.imageUrl, selectedFabric.color)}
                        />
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
                            <dd>{chainLabel || "--"}</dd>
                          </div>
                          {dimensionsValid ? (
                            <div>
                              <dt>Wymiar</dt>
                              <dd>
                                {widthNum} × {heightNum} mm · {quantityNum} szt.
                              </dd>
                            </div>
                          ) : null}
                        </dl>
                      </div>
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
                      {selectedUnavailable ? (
                        <div className="plisy-missing-dims rolety-unavailable-block" role="alert">
                          <span>{copy.unavailableMessage}</span>
                          <button
                            type="button"
                            onClick={() => {
                              setStepGroupCollapsed(false);
                              window.setTimeout(() => scrollStepIntoView(stepGroupRef.current), 80);
                            }}
                          >
                            Zmień {copy.groupUnit === "model" ? "model" : "kolekcję"}
                          </button>
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
                  ) : null}
                </>
              ) : null}
            </>
          ) : null}
        </>
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
    </>
  );
}
