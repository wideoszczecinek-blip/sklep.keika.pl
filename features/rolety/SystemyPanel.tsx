"use client";

// Konfigurator rolet tradycyjnych w 4 systemach (właściciel, 7.11.2026):
// MINI, kaseta z prowadnicą płaską, kaseta z prowadnicą przestrzenną,
// wolnowisząca. Kolejność (właściciel 7.11 wieczór): 1) kolor osprzętu,
// 2) rodzaj tkaniny (Deko / Termo - karty ze sceną okna), 3) kolor tkaniny,
// 4) opcja systemu (MINI: prowadzenie żyłkowe; wolnowisząca: ściana / sufit),
// 5) listwa przyszybowa - TYLKO kaseta z prowadnicą płaską, z instrukcją,
// 6) okna: wymiary + strona sterowania osobno dla każdego okna, „Dodaj
// kolejne okno” jak w plisach; na końcu cena i koszyk (materiał przed ceną).
// Pomiar co do milimetra, wymiar rolety liczy systemy.ts. Profil (tkaniny,
// kolory, opcje, cennik) z CRM. Bez pola uwag i bez powiększeń na najechanie.
import { useEffect, useRef, useState } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { trackShopStep } from "@/lib/track-step";
import RoletySystemDrawing from "./RoletySystemDrawing";
import { FabricTypeCards, HardwareTiles, ListwaGuide, ListwaPicker } from "./RoletyWybor";
import {
  LISTWA_OPTIONS,
  ROLETY_SYSTEMS,
  splitListwaLabel,
  systemAsksListwa,
  withListwaLabel,
  type ListwaType,
  type MeasureFieldKey,
  type RoletySystemSlug,
  type SystemSize,
} from "./systemy";
import {
  CHAIN_SIDES,
  calcRoletyPrice,
  fetchRoletyProfile,
  joinRoletyMountLabel,
  ROLETY_COPY,
  ROLETY_QTY_MAX,
  roletyMatrixCell,
  splitRoletyMountLabel,
  type ChainSide,
  type ConfiguratorInitialValues,
  type ConfiguratorResult,
  type RoletyProfile,
} from "./shared";

type Unit = "cm" | "mm";
type ZoomPreview = { title: string; urls: string[]; index: number };
type Values = Record<MeasureFieldKey, string>;
/** Jedno okno zestawu - to, co klient zmierzył (mm), nawiewnik, strona i ilość. */
type Position = { id: string; mm: Record<MeasureFieldKey, number>; vent: boolean; chainSide: ChainSide; qty: number };

const UNIT_KEY = "keika_rolety_unit";
const EMPTY_VALUES: Values = { a: "", b: "", c: "" };

function formatZl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

function readUnit(): Unit {
  try {
    return window.localStorage.getItem(UNIT_KEY) === "mm" ? "mm" : "cm";
  } catch {
    return "cm";
  }
}

function toMm(raw: string, unit: Unit): number {
  const value = Number(String(raw || "").replace(",", ".").replace(/[^\d.]/g, ""));
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(unit === "cm" ? value * 10 : value);
}

function fromMm(mm: number, unit: Unit): string {
  if (!mm) return "";
  return unit === "cm" ? String(mm / 10).replace(".", ",") : String(mm);
}

function cm(mm: number): string {
  return (mm / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 });
}

function oknaLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (count === 1) return "1 okno";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} okna`;
  return `${count} okien`;
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export default function SystemyPanel({
  slug,
  initialValues,
  submitLabel,
  onSubmit,
  onAddVariant,
  onZoom,
}: {
  slug: RoletySystemSlug;
  initialValues?: ConfiguratorInitialValues;
  submitLabel: string;
  onSubmit: (result: ConfiguratorResult) => void;
  /** Wszystkie okna zestawu poza ostatnim - dodawane po cichu (jak plisy). */
  onAddVariant?: (result: ConfiguratorResult) => void;
  onZoom?: (preview: ZoomPreview) => void;
}) {
  const system = ROLETY_SYSTEMS[slug];
  const copy = ROLETY_COPY[slug];
  const cassette = slug === "rolety-kaseta-plaska" || slug === "rolety-kaseta-przestrzenna";
  const asksListwa = systemAsksListwa(slug);
  const adjustPercent = useProductPriceAdjustment(slug);
  const [profile, setProfile] = useState<RoletyProfile | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "ready" | "error">("loading");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoadState("loading");
    fetchRoletyProfile(slug).then((result) => {
      if (cancelled) return;
      if (!result || result.fabricGroups.length === 0 || result.tables.length === 0) {
        setLoadState("error");
        trackShopStep("configurator_load_failed", slug, {});
        return;
      }
      setProfile(result);
      setLoadState("ready");
      trackShopStep("configurator_ready", slug, {});
    });
    return () => {
      cancelled = true;
    };
  }, [slug, reloadKey]);

  const initialMount = splitRoletyMountLabel(initialValues?.mountLabel);
  const initialListwa = splitListwaLabel(initialMount.mountLabel);
  const [hardwareId, setHardwareId] = useState(initialValues?.hardwareId || "");
  const [groupId, setGroupId] = useState(initialValues?.fabricGroupId || "");
  const [fabricId, setFabricId] = useState(initialValues?.fabricId || "");
  const [mountId, setMountId] = useState(initialValues?.mountId || "");
  const [listwa, setListwa] = useState<ListwaType | "">(initialListwa.listwa);
  const [unit, setUnit] = useState<Unit>("cm");
  const [values, setValues] = useState<Values>(EMPTY_VALUES);
  const [vent, setVent] = useState<"" | "tak" | "nie">(initialValues?.hasVent ? "tak" : "");
  const [chainSide, setChainSide] = useState<ChainSide | "">(initialValues?.chainSide || initialMount.chainSide);
  const [qty, setQty] = useState(String(initialValues?.qty || 1));
  const [positions, setPositions] = useState<Position[]>([]);
  const [activeField, setActiveField] = useState<MeasureFieldKey | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [justAdded, setJustAdded] = useState(0);
  const fabricRef = useRef<HTMLDivElement | null>(null);
  const colorRef = useRef<HTMLDivElement | null>(null);
  const optionRef = useRef<HTMLDivElement | null>(null);
  const listwaRef = useRef<HTMLDivElement | null>(null);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => setUnit(readUnit()), []);

  // Po wczytaniu profilu: etykiety z pozycji koszyka / „Wyceń podobną” -> id;
  // jedyna opcja montażu (kasety) wybrana od razu.
  useEffect(() => {
    if (!profile) return;
    if (!groupId && initialValues?.fabricGroupLabel) {
      const group = profile.fabricGroups.find((entry) => entry.label === initialValues.fabricGroupLabel);
      if (group) {
        setGroupId(group.id);
        const swatch = group.swatches.find((entry) => entry.label === initialValues.fabricLabel);
        if (swatch) setFabricId(swatch.id);
      }
    }
    if (!hardwareId && initialValues?.hardwareLabel) {
      const option = profile.hardware.find((entry) => entry.label === initialValues.hardwareLabel);
      if (option) setHardwareId(option.id);
    }
    if (!mountId) {
      const wanted = initialListwa.mountLabel.trim().toLowerCase();
      const option = profile.mountOptions.find((entry) => entry.label.trim().toLowerCase() === wanted) || (profile.mountOptions.length === 1 ? profile.mountOptions[0] : null);
      if (option) setMountId(option.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const hardware = profile?.hardware.find((entry) => entry.id === hardwareId) || null;
  const group = profile?.fabricGroups.find((entry) => entry.id === groupId) || null;
  const fabric = group?.swatches.find((entry) => entry.id === fabricId) || null;
  const mount = profile?.mountOptions.find((entry) => entry.id === mountId) || null;
  const mountStep = (profile?.mountOptions.length || 0) > 1;
  const listwaOk = !asksListwa || Boolean(listwa);
  const configOk = Boolean(hardware && group && fabric && mount && listwaOk);

  const fields = system.fields(mountId);

  /** Wymiar rolety i ewentualny problem dla jednego okna. */
  function evaluate(mm: Record<MeasureFieldKey, number>, hasVent: boolean): { size: SystemSize | null; issue: string } {
    const size = system.size({ ...mm, vent: hasVent, mountId });
    const issue =
      size.widthMm < system.widthMinMm
        ? `Roleta wyjdzie węższa niż ${cm(system.widthMinMm)} cm - tak wąskiej nie produkujemy.`
        : size.widthMm > system.widthMaxMm
          ? `Roleta wyjdzie szersza niż ${cm(system.widthMaxMm)} cm - w tym systemie to maksimum. Zadzwoń, doradzimy inne rozwiązanie.`
          : size.heightMm < system.heightMinMm
            ? `Roleta wyjdzie niższa niż ${cm(system.heightMinMm)} cm.`
            : size.heightMm > system.heightMaxMm
              ? `Roleta wyjdzie wyższa niż ${cm(system.heightMaxMm)} cm - w tym systemie to maksimum.`
              : "";
    return { size, issue };
  }

  function priceFor(size: SystemSize | null): number | null {
    if (!profile || !group || !size) return null;
    const cell = roletyMatrixCell(profile, group.id, size.widthMm, size.heightMm);
    if (cell?.status !== "ok") return null;
    return calcRoletyPrice(profile, mountId, group.id, size.widthMm, size.heightMm, { hardwareId, fabricId, extraAdjustPercent: adjustPercent });
  }

  // --- okno w edycji (szkic) ---
  const draftMm: Record<MeasureFieldKey, number> = { a: toMm(values.a, unit), b: toMm(values.b, unit), c: toMm(values.c, unit) };
  const fieldIssues = fields
    .map((field) => {
      const mm = draftMm[field.key];
      if (!values[field.key]) return null;
      if (mm < field.minMm) return `${field.label}: najmniej ${cm(field.minMm)} cm.`;
      if (mm > field.maxMm) return `${field.label}: najwyżej ${cm(field.maxMm)} cm.`;
      return null;
    })
    .filter((issue): issue is string => Boolean(issue));
  const allFilled = fields.every((field) => values[field.key] && (draftMm[field.key] > 0 || field.minMm === 0)) && (!system.askVent || Boolean(vent));
  const draftEval = allFilled && !fieldIssues.length ? evaluate(draftMm, vent === "tak") : { size: null, issue: "" };
  const draftSize = draftEval.size;
  const draftSizeOk = Boolean(draftSize && !draftEval.issue);
  const draftUnit = draftSizeOk ? priceFor(draftSize) : null;
  const draftUnavailable = draftSizeOk && draftUnit === null;
  const qtyNum = Math.min(ROLETY_QTY_MAX, Math.max(1, Math.round(Number(qty) || 1)));
  const draftReady = Boolean(configOk && draftSizeOk && chainSide && draftUnit !== null);

  const lastDims = useRef("");
  useEffect(() => {
    if (!draftSize || !draftSizeOk) return;
    const key = `${draftSize.widthMm}x${draftSize.heightMm}`;
    if (lastDims.current === key) return;
    lastDims.current = key;
    trackShopStep("set_dimensions", key, { product: slug, width_mm: draftSize.widthMm, height_mm: draftSize.heightMm });
  }, [draftSize, draftSizeOk, slug]);

  // --- zestaw: zapisane okna + szkic, jeśli kompletny ---
  const draftPosition: Position | null = draftReady && chainSide ? { id: "draft", mm: draftMm, vent: vent === "tak", chainSide, qty: qtyNum } : null;
  const finalPositions = draftPosition ? [...positions, draftPosition] : positions;
  const priced = finalPositions.map((position) => {
    const { size } = evaluate(position.mm, position.vent);
    const unitPrice = priceFor(size);
    return { position, size, unitPrice };
  });
  const setOk = priced.length > 0 && priced.every((row) => row.size && row.unitPrice !== null);
  const total = Math.round(priced.reduce((sum, row) => sum + (row.unitPrice || 0) * row.position.qty, 0) * 100) / 100;
  const totalQty = finalPositions.reduce((sum, position) => sum + position.qty, 0);
  // Szkic zaczęty, ale niekompletny przy zapisanych oknach - nie gubimy go po cichu.
  const draftBlocks = positions.length > 0 && !draftPosition && fields.some((field) => values[field.key]);

  function scrollTo(ref: React.RefObject<HTMLElement | null>) {
    window.setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
  }

  function setUnitAndKeep(next: Unit) {
    if (next === unit) return;
    setValues((prev) => ({ a: fromMm(toMm(prev.a, unit), next), b: fromMm(toMm(prev.b, unit), next), c: fromMm(toMm(prev.c, unit), next) }));
    setUnit(next);
    try {
      window.localStorage.setItem(UNIT_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function resetDraft() {
    setValues(EMPTY_VALUES);
    setVent("");
    setChainSide("");
    setQty("1");
    setActiveField(null);
  }

  function addAnother() {
    if (!draftPosition) return;
    trackShopStep("add_position", slug, { product: slug, positions: positions.length + 1 });
    setPositions((prev) => [...prev, { ...draftPosition, id: newId() }]);
    resetDraft();
    setJustAdded((n) => n + 1);
    scrollTo(measureRef);
    window.setTimeout(() => firstInputRef.current?.focus({ preventScroll: true }), 450);
  }

  function editPosition(id: string) {
    const position = positions.find((entry) => entry.id === id);
    if (!position) return;
    setPositions((prev) => prev.filter((entry) => entry.id !== id));
    setValues({ a: fromMm(position.mm.a, unit), b: fromMm(position.mm.b, unit), c: fromMm(position.mm.c, unit) });
    setVent(system.askVent ? (position.vent ? "tak" : "nie") : "");
    setChainSide(position.chainSide);
    setQty(String(position.qty));
    scrollTo(measureRef);
  }

  function submit() {
    if (!setOk || draftBlocks || !group || !fabric || !hardware || !mount || !listwaOk) return;
    const mountWithListwa = withListwaLabel(mount.label, asksListwa ? listwa : "");
    const listwaNote = asksListwa && listwa ? `; listwa przyszybowa: ${LISTWA_OPTIONS.find((o) => o.id === listwa)?.short}` : "";
    trackShopStep("add_to_cart", slug, { product: slug, value: total, qty: totalQty, positions: priced.length });
    priced.forEach(({ position, size, unitPrice }, index) => {
      if (!size || unitPrice === null) return;
      const result: ConfiguratorResult = {
        productLabel: system.name,
        mountId: mount.id,
        mountLabel: joinRoletyMountLabel(mountWithListwa, position.chainSide, slug),
        chainSide: position.chainSide,
        hardwareId: hardware.id,
        hardwareLabel: hardware.label,
        fabricGroupId: group.id,
        fabricGroupLabel: group.label,
        fabricId: fabric.id,
        fabricLabel: fabric.code && !fabric.label.includes(fabric.code) ? `${fabric.label} (${fabric.code})` : fabric.label,
        fabricColor: fabric.color,
        hardwareColor: hardware.color,
        fabricThumbnailUrl: fabric.thumbnailUrl || fabric.imageUrl,
        widthMm: size.widthMm,
        heightMm: size.heightMm,
        measuredWidthMm: position.mm.a,
        measuredHeightMm: position.mm.c,
        measureNote: `${size.note}${listwaNote}`,
        supplier: null,
        extras: [],
        extrasNote: "",
        optionsNote: "",
        hasVent: position.vent,
        stackMm: 0,
        spaceAboveMm: 0,
        previewImageUrl: "",
        qty: position.qty,
        unitPrice,
        totalPrice: Math.round(unitPrice * position.qty * 100) / 100,
      };
      if (index < priced.length - 1 && onAddVariant) onAddVariant(result);
      else onSubmit(result);
    });
  }

  if (loadState === "loading") {
    return (
      <>
        <header>
          <strong>Wyceń: {system.name}</strong>
        </header>
        <p className="hero-product-config-hint">Wczytuję tkaniny i cennik…</p>
      </>
    );
  }
  if (loadState === "error" || !profile) {
    return (
      <>
        <header>
          <strong>Wyceń: {system.name}</strong>
        </header>
        <p className="hero-product-config-hint">Nie udało się wczytać konfiguratora.</p>
        <button type="button" className="plisy-position-add" onClick={() => setReloadKey((key) => key + 1)}>
          Spróbuj ponownie
        </button>
      </>
    );
  }

  const swatches = group ? (showAll ? group.swatches : group.swatches.slice(0, 24)) : [];
  let n = 0;
  const NO = {
    hw: ++n,
    fabric: ++n,
    color: ++n,
    mount: mountStep ? ++n : 0,
    listwa: asksListwa ? ++n : 0,
    measure: ++n,
  };
  const hwTitle = cassette ? "kasety i prowadnic" : "osprzętu";
  const windowNo = positions.length + 1;

  return (
    <div className="rs-panel">
      <header>
        <strong>Wyceń: {system.name}</strong>
      </header>

      {/* 1. Kolor osprzętu */}
      <section className="rs-step">
        <h3 className="rs-step-title">
          <span className={`rs-step-no ${hardware ? "is-done" : ""}`}>{hardware ? "✓" : NO.hw}</span>
          {hardware ? `Kolor ${hwTitle}` : `Wybierz kolor ${hwTitle}`}
          {hardware ? <em>{hardware.label}</em> : null}
        </h3>
        <HardwareTiles
          options={profile.hardware}
          activeId={hardwareId}
          cassette={cassette}
          onPick={(option) => {
            trackShopStep("select_hardware_color", option.label, { option_id: option.id, product: slug });
            setHardwareId(option.id);
            if (!group) scrollTo(fabricRef);
          }}
        />
        <p className="hero-product-config-hint">
          {cassette ? "Dobierz do koloru okien - kaseta, prowadnice i listwa dolna są w jednym kolorze." : "Dobierz do koloru okien - w tym kolorze są mechanizm i listwa dolna."}
        </p>
      </section>

      {/* 2. Rodzaj tkaniny */}
      {hardware ? (
        <section className="rs-step" ref={fabricRef}>
          <h3 className="rs-step-title">
            <span className={`rs-step-no ${group ? "is-done" : ""}`}>{group ? "✓" : NO.fabric}</span>
            {group ? "Rodzaj tkaniny" : "Wybierz rodzaj tkaniny"}
            {group ? <em>{group.label}</em> : null}
          </h3>
          <FabricTypeCards
            groups={profile.fabricGroups}
            activeId={groupId}
            selectedSwatch={fabric}
            hardwareColor={hardware.color}
            cassette={cassette}
            onPick={(entry) => {
              trackShopStep("select_fabric_group", entry.label, { option_id: entry.id, product: slug });
              if (entry.id !== groupId) {
                setFabricId("");
                setShowAll(false);
              }
              setGroupId(entry.id);
              scrollTo(colorRef);
            }}
          />
        </section>
      ) : null}

      {/* 3. Kolor tkaniny */}
      {hardware && group ? (
        <section className="rs-step" ref={colorRef}>
          <h3 className="rs-step-title">
            <span className={`rs-step-no ${fabric ? "is-done" : ""}`}>{fabric ? "✓" : NO.color}</span>
            {fabric ? "Kolor tkaniny" : "Wybierz kolor tkaniny"}
            {fabric ? <em>{fabric.label}</em> : null}
          </h3>
          <div className="rs-swatch-grid">
            {swatches.map((swatch) => {
              const active = swatch.id === fabricId;
              return (
                <div key={swatch.id} className={`rs-swatch ${active ? "is-active" : ""}`}>
                  <button
                    type="button"
                    className="rs-swatch-pick"
                    aria-pressed={active}
                    aria-label={swatch.label}
                    onClick={() => {
                      trackShopStep("select_fabric_color", swatch.label, { option_id: swatch.id, product: slug });
                      setFabricId(swatch.id);
                      if (!fabric) scrollTo(mountStep ? optionRef : asksListwa ? listwaRef : measureRef);
                    }}
                  >
                    <span
                      className="rs-swatch-img"
                      style={{ backgroundColor: swatch.color, backgroundImage: swatch.thumbnailUrl ? `url(${optimizeImageUrl(swatch.thumbnailUrl, 220)})` : undefined }}
                    />
                    <small>{swatch.label}</small>
                  </button>
                  {swatch.imageUrl && onZoom ? (
                    <button
                      type="button"
                      className="rs-swatch-zoom"
                      aria-label={`Powiększ: ${swatch.label}`}
                      onClick={() => onZoom({ title: `${group.label} - ${swatch.label}`, urls: [swatch.imageUrl], index: 0 })}
                    >
                      🔍
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
          {group.swatches.length > 24 && !showAll ? (
            <button type="button" className="rs-more" onClick={() => setShowAll(true)}>
              Pokaż wszystkie kolory ({group.swatches.length})
            </button>
          ) : null}
        </section>
      ) : null}

      {/* 4. Opcja systemu */}
      {fabric && mountStep ? (
        <section className="rs-step" ref={optionRef}>
          <h3 className="rs-step-title">
            <span className={`rs-step-no ${mount ? "is-done" : ""}`}>{mount ? "✓" : NO.mount}</span>
            {slug === "rolety-wolnowiszace" ? "Gdzie montujesz?" : "Prowadzenie tkaniny"}
            {mount ? <em>{mount.label}</em> : null}
          </h3>
          <div className="rs-option-grid">
            {profile.mountOptions.map((option) => {
              const active = option.id === mountId;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`rs-option ${active ? "is-active" : ""}`}
                  aria-pressed={active}
                  onClick={() => {
                    trackShopStep("select_mount_type", option.label, { option_id: option.id, product: slug });
                    if (option.id !== mountId && slug === "rolety-wolnowiszace") {
                      // Inna wysokość do zmierzenia (wnęka / od sufitu) - zapisane okna liczone były inaczej.
                      setValues((prev) => ({ ...prev, c: "" }));
                      setPositions([]);
                    }
                    setMountId(option.id);
                    if (!mount) scrollTo(asksListwa ? listwaRef : measureRef);
                  }}
                >
                  <strong>{option.label}</strong>
                  <small>{option.note}</small>
                  {option.priceDelta > 0 && option.priceDeltaType === "amount" ? <span className="rs-option-delta">+{formatZl(option.priceDelta)}</span> : null}
                </button>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* 5. Listwa przyszybowa (tylko kaseta z prowadnicą płaską) */}
      {fabric && mount && asksListwa ? (
        <section className="rs-step" ref={listwaRef}>
          <h3 className="rs-step-title">
            <span className={`rs-step-no ${listwa ? "is-done" : ""}`}>{listwa ? "✓" : NO.listwa}</span>
            {listwa ? "Listwa przyszybowa" : "Jaką masz listwę przyszybową?"}
            {listwa ? <em>{LISTWA_OPTIONS.find((o) => o.id === listwa)?.label}</em> : null}
          </h3>
          <p className="hero-product-config-hint">Płaska prowadnica leży na listwie przyszybowej, dlatego mocowanie dobieramy do jej kształtu.</p>
          <ListwaPicker
            value={listwa}
            onPick={(value) => {
              trackShopStep("select_glazing_bead", value, { product: slug });
              const first = !listwa;
              setListwa(value);
              if (first) scrollTo(measureRef);
            }}
          />
          <ListwaGuide open={!listwa} />
        </section>
      ) : null}

      {/* 6. Okna: wymiary + strona sterowania */}
      {configOk ? (
        <section className="rs-step" ref={measureRef}>
          <h3 className="rs-step-title">
            <span className={`rs-step-no ${setOk && !draftBlocks ? "is-done" : ""}`}>{setOk && !draftBlocks ? "✓" : NO.measure}</span>
            {positions.length ? `Wymiary - okno ${windowNo}` : "Wymiary i strona sterowania"}
          </h3>
          {positions.length === 0 ? (
            <ol className="rs-measure-steps">
              {system.steps(mountId).map((text, index) => (
                <li key={index}>{text}</li>
              ))}
            </ol>
          ) : null}

          {positions.length ? (
            <div className="rs-set" key={justAdded}>
              <h4>Twoje okna ({positions.length})</h4>
              {positions.map((position, index) => {
                const { size } = evaluate(position.mm, position.vent);
                const unitPrice = priceFor(size);
                return (
                  <div key={position.id} className="rs-set-row">
                    <span className="rs-set-label">
                      <b>Okno {index + 1}</b> roleta {size ? `${cm(size.widthMm)} × ${cm(size.heightMm)} cm` : "-"} · łańcuszek {position.chainSide} · {position.qty} szt.
                    </span>
                    <span className="rs-set-price">{unitPrice !== null ? formatZl(unitPrice * position.qty) : "-"}</span>
                    <button type="button" className="rs-set-edit" onClick={() => editPosition(position.id)} aria-label={`Popraw okno ${index + 1}`}>
                      Popraw
                    </button>
                    <button
                      type="button"
                      className="plisy-positions-row-remove"
                      aria-label={`Usuń okno ${index + 1}`}
                      onClick={() => setPositions((prev) => prev.filter((entry) => entry.id !== position.id))}
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div className="rs-window">
            <div className="rs-window-head">
              <strong>Okno {windowNo}</strong>
              <div className="rs-unit" role="group" aria-label="Jednostka">
                {(["cm", "mm"] as Unit[]).map((option) => (
                  <button key={option} type="button" className={unit === option ? "is-active" : ""} aria-pressed={unit === option} onClick={() => setUnitAndKeep(option)}>
                    {option}
                  </button>
                ))}
              </div>
            </div>
            <div className="rs-measure">
              <div className="rs-measure-drawing">
                <RoletySystemDrawing system={slug} active={activeField} vent={vent === "tak"} mountId={mountId} />
              </div>
              <div className="rs-measure-inputs">
                <div className="rs-fields">
                  {fields.map((field, index) => (
                    <label key={field.key} className={`rs-field ${activeField === field.key ? "is-active" : ""}`}>
                      <span className="rs-field-label">
                        <b>{field.key.toUpperCase()}</b> {field.label} ({unit})
                      </span>
                      <input
                        ref={index === 0 ? firstInputRef : undefined}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={values[field.key]}
                        placeholder={unit === "cm" ? "np. 78,5" : "np. 785"}
                        onFocus={() => setActiveField(field.key)}
                        onBlur={() => setActiveField((prev) => (prev === field.key ? null : prev))}
                        onChange={(event) => {
                          const raw = event.target.value.replace(/[^\d.,]/g, "");
                          setValues((prev) => ({ ...prev, [field.key]: raw }));
                        }}
                      />
                      <small>{field.hint}</small>
                    </label>
                  ))}
                </div>
                {system.askVent ? (
                  <div className="rs-vent">
                    <span>Czy na górze skrzydła jest nawiewnik (kratka wentylacyjna)?</span>
                    <div className="rs-chip-row">
                      {(["nie", "tak"] as const).map((option) => (
                        <button key={option} type="button" className={`rs-chip ${vent === option ? "is-active" : ""}`} aria-pressed={vent === option} onClick={() => setVent(option)}>
                          {option === "tak" ? "Tak - mierzę od nawiewnika" : "Nie"}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
            {fieldIssues.length ? <p className="rs-issue">{fieldIssues.join(" ")}</p> : null}
            {draftEval.issue ? <p className="rs-issue">{draftEval.issue}</p> : null}
            {draftSize && draftSizeOk ? <p className="rs-size">{draftSize.explain}</p> : null}
            {draftUnavailable ? <p className="rs-issue">{copy.unavailableMessage}</p> : null}
            {unit === "cm" && Object.values(values).some((value) => Number(value.replace(",", ".")) >= 300) ? (
              <p className="rs-issue">Wpisujesz w centymetrach - sprawdź, czy nie chodziło o milimetry (przełącznik „mm” wyżej).</p>
            ) : null}

            <div className="rs-window-row">
              <div className="rs-side">
                <span className="rs-field-label">Strona sterowania (łańcuszek)</span>
                <div className="rs-chip-row">
                  {CHAIN_SIDES.map((side) => (
                    <button
                      key={side.id}
                      type="button"
                      className={`rs-chip ${chainSide === side.id ? "is-active" : ""}`}
                      aria-pressed={chainSide === side.id}
                      onClick={() => {
                        trackShopStep("select_chain_side", side.id, { product: slug });
                        setChainSide(side.id);
                      }}
                    >
                      {side.label}
                    </button>
                  ))}
                </div>
                <small>Patrząc na okno od środka pokoju.</small>
              </div>
              <label className="rs-field rs-field--qty">
                <span className="rs-field-label">Ilość sztuk</span>
                <input type="number" min={1} max={ROLETY_QTY_MAX} inputMode="numeric" value={qty} onChange={(event) => setQty(event.target.value)} />
              </label>
            </div>

            <div className="rs-window-foot">
              <span className="rs-window-price">
                {draftReady && draftUnit !== null ? (
                  <>
                    Okno {windowNo}: <strong>{formatZl(draftUnit * qtyNum)}</strong>
                  </>
                ) : draftSizeOk && !chainSide ? (
                  "Wybierz stronę łańcuszka"
                ) : (
                  "Wpisz wymiary okna"
                )}
              </span>
              <button type="button" className="plisy-position-add" disabled={!draftReady} onClick={addAnother}>
                + Dodaj kolejne okno
              </button>
            </div>
          </div>

          {/* Podsumowanie zestawu */}
          {setOk && group && fabric && hardware ? (
            <div className="rs-price">
              <div className="rs-price-row">
                <span>{priced.length > 1 ? `Razem (${oknaLabel(priced.length)}, ${totalQty} szt.)` : totalQty > 1 ? `Razem (${totalQty} szt.)` : "Cena"}</span>
                <strong>{formatZl(total)}</strong>
              </div>
              {priced.length > 1 || totalQty > 1 ? (
                <ul className="rs-price-lines">
                  {priced.map(({ position, size, unitPrice }, index) => (
                    <li key={position.id}>
                      <span>
                        Okno {index + 1}: {size ? `${cm(size.widthMm)} × ${cm(size.heightMm)} cm` : ""} · {position.chainSide} · {position.qty} × {unitPrice !== null ? formatZl(unitPrice) : "-"}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : null}
              <ul className="rs-price-spec">
                <li>
                  {group.label}: {fabric.label}
                </li>
                <li>
                  {mount?.label} · {hardware.label}
                  {asksListwa && listwa ? ` · listwa ${LISTWA_OPTIONS.find((o) => o.id === listwa)?.short}` : ""}
                </li>
              </ul>
              <p className="rs-price-perks">W cenie: 5 lat gwarancji i 30 dni na zwrot · realizacja {copy.leadTimeLabel}</p>
              {draftBlocks ? <p className="rs-issue">Okno {windowNo} jest niedokończone - uzupełnij wymiary i stronę łańcuszka albo wyczyść pola.</p> : null}
              <button type="button" className="rs-submit" onClick={submit} disabled={draftBlocks}>
                {priced.length > 1 ? `${submitLabel} (${oknaLabel(priced.length)})` : submitLabel}
              </button>
              {draftBlocks ? (
                <button type="button" className="rs-more" onClick={resetDraft}>
                  Wyczyść okno {windowNo}
                </button>
              ) : null}
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
