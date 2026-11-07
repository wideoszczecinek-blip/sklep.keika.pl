"use client";

// Konfigurator rolet tradycyjnych w 4 systemach (właściciel, 7.11.2026):
// MINI, kaseta z prowadnicą płaską, kaseta z prowadnicą przestrzenną,
// wolnowisząca. Kolejność „materiał przed ceną” (właściciel 3.11):
// 1) tkanina (Deko / Termo), 2) kolor tkaniny, 3) kolor osprzętu / kasety,
// 4) opcja systemu (MINI: prowadzenie żyłkowe; wolnowisząca: ściana / sufit),
// 5) pomiar - pola i rysunek właściwe dla systemu (systemy.ts), wymiar rolety
// liczony co do milimetra, 6) strona łańcuszka, na końcu cena i koszyk.
// Profil (tkaniny, kolory, opcje, cennik) z CRM - jak pozostałe rolety.
// Bez pola uwag i bez powiększeń na najechanie (zasady właściciela).
import { useEffect, useMemo, useRef, useState } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { trackShopStep } from "@/lib/track-step";
import RoletySystemDrawing from "./RoletySystemDrawing";
import { ROLETY_SYSTEMS, type MeasureFieldKey, type RoletySystemSlug } from "./systemy";
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

const UNIT_KEY = "keika_rolety_unit";

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

export default function SystemyPanel({
  slug,
  initialValues,
  submitLabel,
  onSubmit,
  onZoom,
}: {
  slug: RoletySystemSlug;
  initialValues?: ConfiguratorInitialValues;
  submitLabel: string;
  onSubmit: (result: ConfiguratorResult) => void;
  onZoom?: (preview: ZoomPreview) => void;
}) {
  const system = ROLETY_SYSTEMS[slug];
  const copy = ROLETY_COPY[slug];
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

  const [groupId, setGroupId] = useState(initialValues?.fabricGroupId || "");
  const [fabricId, setFabricId] = useState(initialValues?.fabricId || "");
  const [hardwareId, setHardwareId] = useState(initialValues?.hardwareId || "");
  const [mountId, setMountId] = useState(initialValues?.mountId || "");
  const [chainSide, setChainSide] = useState<ChainSide | "">(initialValues?.chainSide || splitRoletyMountLabel(initialValues?.mountLabel).chainSide);
  const [unit, setUnit] = useState<Unit>("cm");
  const [values, setValues] = useState<Record<MeasureFieldKey, string>>({ a: "", b: "", c: "" });
  const [vent, setVent] = useState<"" | "tak" | "nie">(initialValues?.hasVent ? "tak" : "");
  const [qty, setQty] = useState(String(initialValues?.qty || 1));
  const [activeField, setActiveField] = useState<MeasureFieldKey | null>(null);
  const [showAll, setShowAll] = useState(false);
  const measureRef = useRef<HTMLDivElement | null>(null);
  const colorRef = useRef<HTMLDivElement | null>(null);
  const hwRef = useRef<HTMLDivElement | null>(null);
  const chainRef = useRef<HTMLDivElement | null>(null);

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
      const wanted = splitRoletyMountLabel(initialValues?.mountLabel).mountLabel.trim().toLowerCase();
      const option = profile.mountOptions.find((entry) => entry.label.trim().toLowerCase() === wanted) || (profile.mountOptions.length === 1 ? profile.mountOptions[0] : null);
      if (option) setMountId(option.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile]);

  const group = profile?.fabricGroups.find((entry) => entry.id === groupId) || null;
  const fabric = group?.swatches.find((entry) => entry.id === fabricId) || null;
  const hardware = profile?.hardware.find((entry) => entry.id === hardwareId) || null;
  const mount = profile?.mountOptions.find((entry) => entry.id === mountId) || null;
  const mountStep = (profile?.mountOptions.length || 0) > 1;

  const fields = system.fields(mountId);
  const input = {
    a: toMm(values.a, unit),
    b: toMm(values.b, unit),
    c: toMm(values.c, unit),
    vent: vent === "tak",
    mountId,
  };
  const fieldIssues = fields
    .map((field) => {
      const mm = input[field.key];
      if (!values[field.key]) return null;
      if (mm < field.minMm) return `${field.label}: najmniej ${cm(field.minMm)} cm.`;
      if (mm > field.maxMm) return `${field.label}: najwyżej ${cm(field.maxMm)} cm.`;
      return null;
    })
    .filter((issue): issue is string => Boolean(issue));
  const allFilled = fields.every((field) => values[field.key] && (input[field.key] > 0 || field.minMm === 0)) && (!system.askVent || Boolean(vent));
  const size = allFilled && !fieldIssues.length ? system.size(input) : null;
  const sizeIssue = size
    ? size.widthMm < system.widthMinMm
      ? `Roleta wyjdzie węższa niż ${cm(system.widthMinMm)} cm - tak wąskiej nie produkujemy.`
      : size.widthMm > system.widthMaxMm
        ? `Roleta wyjdzie szersza niż ${cm(system.widthMaxMm)} cm - w tym systemie to maksimum. Zadzwoń, doradzimy inne rozwiązanie.`
        : size.heightMm < system.heightMinMm
          ? `Roleta wyjdzie niższa niż ${cm(system.heightMinMm)} cm.`
          : size.heightMm > system.heightMaxMm
            ? `Roleta wyjdzie wyższa niż ${cm(system.heightMaxMm)} cm - w tym systemie to maksimum.`
            : ""
    : "";
  const sizeOk = Boolean(size && !sizeIssue);
  const qtyNum = Math.min(ROLETY_QTY_MAX, Math.max(1, Math.round(Number(qty) || 1)));

  const cell = profile && group && size && sizeOk ? roletyMatrixCell(profile, group.id, size.widthMm, size.heightMm) : null;
  const unitPrice =
    profile && group && size && sizeOk && cell?.status === "ok"
      ? calcRoletyPrice(profile, mountId, group.id, size.widthMm, size.heightMm, { hardwareId, fabricId, extraAdjustPercent: adjustPercent })
      : null;
  const ready = Boolean(group && fabric && hardware && mount && sizeOk && chainSide && unitPrice !== null);

  const lastDims = useRef("");
  useEffect(() => {
    if (!size || !sizeOk) return;
    const key = `${size.widthMm}x${size.heightMm}`;
    if (lastDims.current === key) return;
    lastDims.current = key;
    trackShopStep("set_dimensions", key, { product: slug, width_mm: size.widthMm, height_mm: size.heightMm });
  }, [size, sizeOk, slug]);

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    window.setTimeout(() => ref.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
  }

  function setUnitAndKeep(next: Unit) {
    if (next === unit) return;
    setValues((prev) => ({
      a: fromMm(toMm(prev.a, unit), next),
      b: fromMm(toMm(prev.b, unit), next),
      c: fromMm(toMm(prev.c, unit), next),
    }));
    setUnit(next);
    try {
      window.localStorage.setItem(UNIT_KEY, next);
    } catch {
      /* ignore */
    }
  }

  function submit() {
    if (!ready || !group || !fabric || !hardware || !mount || !size || unitPrice === null || !chainSide) return;
    const total = Math.round(unitPrice * qtyNum * 100) / 100;
    trackShopStep("add_to_cart", slug, { product: slug, value: total, qty: qtyNum });
    onSubmit({
      productLabel: system.name,
      mountId: mount.id,
      mountLabel: joinRoletyMountLabel(mount.label, chainSide, slug),
      chainSide,
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
      measuredWidthMm: input.a,
      measuredHeightMm: input.c,
      measureNote: size.note,
      supplier: null,
      extras: [],
      extrasNote: "",
      optionsNote: "",
      hasVent: input.vent,
      stackMm: 0,
      spaceAboveMm: 0,
      previewImageUrl: "",
      qty: qtyNum,
      unitPrice,
      totalPrice: total,
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
  const NO = { fabric: 1, color: 2, hw: 3, mount: 4, measure: mountStep ? 5 : 4, chain: mountStep ? 6 : 5 };

  return (
    <div className="rs-panel">
      <header>
        <strong>Wyceń: {system.name}</strong>
      </header>

      {/* 1. Tkanina */}
      <section className="rs-step">
        <h3 className="rs-step-title">
          <span className={`rs-step-no ${group ? "is-done" : ""}`}>{group ? "✓" : NO.fabric}</span>
          {group ? "Tkanina" : "Wybierz tkaninę"}
          {group ? <em>{group.label}</em> : null}
        </h3>
        <div className="rs-fabric-grid">
          {profile.fabricGroups.map((entry) => {
            const active = entry.id === groupId;
            return (
              <button
                key={entry.id}
                type="button"
                className={`rs-fabric-card ${active ? "is-active" : ""}`}
                aria-pressed={active}
                onClick={() => {
                  trackShopStep("select_fabric_group", entry.label, { option_id: entry.id, product: slug });
                  if (entry.id !== groupId) setFabricId("");
                  setGroupId(entry.id);
                  scrollTo(colorRef);
                }}
              >
                <span className="rs-fabric-tiles" aria-hidden="true">
                  {entry.swatches.slice(0, 6).map((swatch) => (
                    <span key={swatch.id} style={{ backgroundColor: swatch.color, backgroundImage: swatch.thumbnailUrl ? `url(${optimizeImageUrl(swatch.thumbnailUrl, 96)})` : undefined }} />
                  ))}
                </span>
                <strong>{entry.label}</strong>
                <small>{entry.note}</small>
                <span className="rs-fabric-count">{entry.swatches.length} kolorów</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 2. Kolor tkaniny */}
      {group ? (
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
                      scrollTo(hwRef);
                    }}
                  >
                    <span
                      className="rs-swatch-img"
                      style={{ backgroundColor: swatch.color, backgroundImage: swatch.thumbnailUrl ? `url(${optimizeImageUrl(swatch.thumbnailUrl, 160)})` : undefined }}
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

      {/* 3. Kolor osprzętu / kasety */}
      {fabric ? (
        <section className="rs-step" ref={hwRef}>
          <h3 className="rs-step-title">
            <span className={`rs-step-no ${hardware ? "is-done" : ""}`}>{hardware ? "✓" : NO.hw}</span>
            {slug === "rolety-kaseta-plaska" || slug === "rolety-kaseta-przestrzenna" ? "Kolor kasety i prowadnic" : "Kolor osprzętu"}
            {hardware ? <em>{hardware.label}</em> : null}
          </h3>
          <div className="rs-chip-row">
            {profile.hardware.map((option) => {
              const active = option.id === hardwareId;
              return (
                <button
                  key={option.id}
                  type="button"
                  className={`rs-chip ${active ? "is-active" : ""}`}
                  aria-pressed={active}
                  onClick={() => {
                    trackShopStep("select_hardware_color", option.label, { option_id: option.id, product: slug });
                    setHardwareId(option.id);
                    scrollTo(mountStep ? chainRef : measureRef);
                  }}
                >
                  <span className="rs-chip-dot" style={{ backgroundColor: option.color }} aria-hidden="true" />
                  {option.label}
                  {option.priceDelta > 0 && option.priceDeltaType === "amount" ? <small className="rs-chip-delta">+{Math.round(option.priceDelta)} zł</small> : null}
                </button>
              );
            })}
          </div>
          {slug === "rolety-kaseta-plaska" || slug === "rolety-kaseta-przestrzenna" ? (
            <p className="hero-product-config-hint">Dobierz do koloru okien - kaseta i prowadnice są w tym samym kolorze.</p>
          ) : null}
        </section>
      ) : null}

      {/* 4. Opcja systemu */}
      {hardware && mountStep ? (
        <section className="rs-step" ref={chainRef}>
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
                    if (option.id !== mountId && slug === "rolety-wolnowiszace") setValues((prev) => ({ ...prev, c: "" }));
                    setMountId(option.id);
                    scrollTo(measureRef);
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

      {/* 5. Pomiar */}
      {hardware && mount ? (
        <section className="rs-step" ref={measureRef}>
          <h3 className="rs-step-title">
            <span className={`rs-step-no ${sizeOk ? "is-done" : ""}`}>{sizeOk ? "✓" : NO.measure}</span>
            {sizeOk ? "Pomiar" : "Zmierz okno"}
            {size && sizeOk ? <em>roleta {cm(size.widthMm)} × {cm(size.heightMm)} cm</em> : null}
          </h3>
          <ol className="rs-measure-steps">
            {system.steps(mountId).map((text, index) => (
              <li key={index}>{text}</li>
            ))}
          </ol>
          <div className="rs-measure">
            <div className="rs-measure-drawing">
              <RoletySystemDrawing system={slug} active={activeField} vent={vent === "tak"} mountId={mountId} />
            </div>
            <div className="rs-measure-inputs">
          <div className="rs-unit" role="group" aria-label="Jednostka">
            {(["cm", "mm"] as Unit[]).map((option) => (
              <button key={option} type="button" className={unit === option ? "is-active" : ""} aria-pressed={unit === option} onClick={() => setUnitAndKeep(option)}>
                {option}
              </button>
            ))}
          </div>
          <div className="rs-fields">
            {fields.map((field) => (
              <label key={field.key} className={`rs-field ${activeField === field.key ? "is-active" : ""}`}>
                <span className="rs-field-label">
                  <b>{field.key.toUpperCase()}</b> {field.label} ({unit})
                </span>
                <input
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
          <label className="rs-field rs-field--qty">
            <span className="rs-field-label">Ilość sztuk</span>
            <input type="number" min={1} max={ROLETY_QTY_MAX} inputMode="numeric" value={qty} onChange={(event) => setQty(event.target.value)} />
          </label>
          {fieldIssues.length ? <p className="rs-issue">{fieldIssues.join(" ")}</p> : null}
          {sizeIssue ? <p className="rs-issue">{sizeIssue}</p> : null}
          {size && sizeOk ? <p className="rs-size">{size.explain}</p> : null}
          {unit === "cm" && Object.values(values).some((value) => Number(value.replace(",", ".")) >= 300) ? (
            <p className="rs-issue">Wpisujesz w centymetrach - sprawdź, czy nie chodziło o milimetry (przełącznik „mm” wyżej).</p>
          ) : null}
        </section>
      ) : null}

      {/* 6. Łańcuszek */}
      {sizeOk ? (
        <section className="rs-step">
          <h3 className="rs-step-title">
            <span className={`rs-step-no ${chainSide ? "is-done" : ""}`}>{chainSide ? "✓" : NO.chain}</span>
            Strona łańcuszka
            {chainSide ? <em>{chainSide}</em> : null}
          </h3>
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
          <p className="hero-product-config-hint">Patrząc na okno od środka pokoju.</p>
        </section>
      ) : null}

      {/* Cena */}
      {sizeOk && cell && cell.status !== "ok" ? <p className="rs-issue">{copy.unavailableMessage}</p> : null}
      {ready && unitPrice !== null && group && fabric && hardware && size ? (
        <div className="rs-price">
          <div className="rs-price-row">
            <span>Cena za sztukę</span>
            <strong>{formatZl(unitPrice)}</strong>
          </div>
          {qtyNum > 1 ? (
            <div className="rs-price-row">
              <span>Razem ({qtyNum} szt.)</span>
              <strong>{formatZl(Math.round(unitPrice * qtyNum * 100) / 100)}</strong>
            </div>
          ) : null}
          <ul className="rs-price-spec">
            <li>
              {group.label}: {fabric.label}
            </li>
            <li>
              {mount?.label} · {hardware.label} · łańcuszek {chainSide}
            </li>
            <li>
              Roleta {cm(size.widthMm)} × {cm(size.heightMm)} cm
            </li>
          </ul>
          <p className="rs-price-perks">W cenie: 5 lat gwarancji i 30 dni na zwrot · realizacja {copy.leadTimeLabel}</p>
          <button type="button" className="rs-submit" onClick={submit}>
            {submitLabel}
          </button>
        </div>
      ) : sizeOk && !chainSide ? (
        <p className="hero-product-config-hint">Wybierz stronę łańcuszka - pokażemy cenę.</p>
      ) : null}
    </div>
  );
}
