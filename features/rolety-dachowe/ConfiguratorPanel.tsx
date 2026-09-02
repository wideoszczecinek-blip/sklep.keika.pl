"use client";

// The rolety-dachowe (roof window blind) configurator: kaseta/prowadnice
// color -> rodzaj materiału (Termo/Półprzepuszczalny) -> kolor materiału ->
// model okna (library search or manual "Wymiar A/Wymiar B") -> dynamic
// price (real price-matrix lookup, see shared.ts) -> submit. Mirrors
// features/moskitiery-ramkowe/ConfiguratorPanel.tsx's structure (same
// accordion steps, same scroll-into-view handling, same add-to-cart
// contract) but with this product's own real step content and pricing.
import { useEffect, useMemo, useRef, useState } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import { trackShopStep } from "@/lib/track-step";
import {
  ROLETY_DACHOWE_FABRIC,
  ROLETY_DACHOWE_HARDWARE,
  ROLETY_DACHOWE_MATERIAL_TYPES,
  ROLETY_DACHOWE_MAX_DIMENSION_MM,
  ROLETY_DACHOWE_MIN_DIMENSION_MM,
  buildRdLayerSurfaceStyle,
  calcRoletyDachowePrice,
  searchRoofWindowModels,
  type ConfiguratorInitialValues,
  type ConfiguratorResult,
} from "./shared";
import type { RoofWindowModel } from "./roof-windows-data";

type ZoomPreview = { title: string; urls: string[]; index: number };

export default function ConfiguratorPanel({
  initialValues,
  submitLabel,
  onSubmit,
  onZoom,
}: {
  initialValues?: ConfiguratorInitialValues;
  submitLabel: string;
  onSubmit: (result: ConfiguratorResult) => void;
  onZoom?: (preview: ZoomPreview) => void;
}) {
  const [selectedHardwareId, setSelectedHardwareId] = useState(initialValues?.hardwareId || "");
  const [stepOneChosen, setStepOneChosen] = useState(Boolean(initialValues?.hardwareId));
  const [stepOneCollapsed, setStepOneCollapsed] = useState(Boolean(initialValues?.hardwareId));

  const [selectedMaterialTypeId, setSelectedMaterialTypeId] = useState(initialValues?.materialTypeId || "");
  const [stepTwoCollapsed, setStepTwoCollapsed] = useState(Boolean(initialValues?.materialTypeId));

  const [selectedFabricId, setSelectedFabricId] = useState(initialValues?.fabricId || "");
  const [stepThreeCollapsed, setStepThreeCollapsed] = useState(Boolean(initialValues?.fabricId));

  const [windowQuery, setWindowQuery] = useState("");
  const [selectedWindow, setSelectedWindow] = useState<RoofWindowModel | null>(null);
  const [manualMode, setManualMode] = useState(false);
  const [manualWidth, setManualWidth] = useState(initialValues?.widthMm ? String(initialValues.widthMm) : "");
  const [manualHeight, setManualHeight] = useState(initialValues?.heightMm ? String(initialValues.heightMm) : "");
  const [quantity, setQuantity] = useState(initialValues?.qty ? String(initialValues.qty) : "1");
  const [internalZoomPreview, setInternalZoomPreview] = useState<ZoomPreview | null>(null);

  const stepTwoRef = useRef<HTMLButtonElement | null>(null);
  const stepThreeRef = useRef<HTMLButtonElement | null>(null);
  const stepFourRef = useRef<HTMLParagraphElement | null>(null);

  // Same containment logic as moskitiery-ramkowe's ConfiguratorPanel - see
  // that file's identical function for the full reasoning (desktop: stay
  // inside .hero-product-config-panel's own scrollbox and never touch
  // .hero-full, which the left description column also scrolls in; mobile:
  // that panel has no scrollbox of its own, so this falls through to
  // .hero-full as before).
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
    trackShopStep("gallery_zoom_open", preview?.title || "rolety-dachowe", { image_index: preview?.index ?? 0 });
    if (onZoom) onZoom(preview);
    else setInternalZoomPreview(preview);
  }

  const selectedHardware = useMemo(
    () => ROLETY_DACHOWE_HARDWARE.find((option) => option.id === selectedHardwareId) || null,
    [selectedHardwareId],
  );
  const selectedMaterialType = useMemo(
    () => ROLETY_DACHOWE_MATERIAL_TYPES.find((option) => option.id === selectedMaterialTypeId) || null,
    [selectedMaterialTypeId],
  );
  const materialChosen = Boolean(selectedMaterialTypeId);

  const fabricOptionsForMaterial = useMemo(
    () => ROLETY_DACHOWE_FABRIC.filter((option) => option.materialTypeId === selectedMaterialTypeId),
    [selectedMaterialTypeId],
  );
  const selectedFabric = useMemo(
    () => ROLETY_DACHOWE_FABRIC.find((option) => option.id === selectedFabricId) || null,
    [selectedFabricId],
  );
  const fabricChosen = Boolean(selectedFabricId);

  // Switching material type invalidates whatever fabric color was picked
  // under the previous one (the two families don't share ids).
  useEffect(() => {
    if (selectedFabric && selectedFabric.materialTypeId !== selectedMaterialTypeId) {
      setSelectedFabricId("");
      setStepThreeCollapsed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMaterialTypeId]);

  const searchResults = useMemo(
    () => (windowQuery.trim() ? searchRoofWindowModels(windowQuery, 8) : []),
    [windowQuery],
  );

  const manualWidthNum = Number(manualWidth) || 0;
  const manualHeightNum = Number(manualHeight) || 0;
  const manualValid =
    manualWidthNum >= ROLETY_DACHOWE_MIN_DIMENSION_MM &&
    manualWidthNum <= ROLETY_DACHOWE_MAX_DIMENSION_MM &&
    manualHeightNum >= ROLETY_DACHOWE_MIN_DIMENSION_MM &&
    manualHeightNum <= ROLETY_DACHOWE_MAX_DIMENSION_MM;

  const hasWindowInfo = manualMode ? manualValid : Boolean(selectedWindow);
  const resolvedWidthMm = manualMode ? manualWidthNum : selectedWindow?.blindWidthMm || 0;
  const resolvedHeightMm = manualMode ? manualHeightNum : selectedWindow?.blindHeightMm || 0;

  const quantityNum = Math.max(1, Number(quantity) || 1);

  // Real dynamic price: matrix lookup (breakpoint ceiling rule) x the
  // price-adjustment percent/amount, exactly as the real "dachowe"
  // configurator computes it - see calcRoletyDachowePrice in shared.ts.
  const unitPrice =
    hasWindowInfo && selectedHardwareId && selectedMaterialTypeId
      ? calcRoletyDachowePrice(resolvedWidthMm, resolvedHeightMm, selectedHardwareId, selectedMaterialTypeId)
      : null;
  const totalPrice = unitPrice !== null ? Math.round(unitPrice * quantityNum * 100) / 100 : null;

  function handleSubmit() {
    if (!hasWindowInfo || unitPrice === null || totalPrice === null) return;
    onSubmit({
      hardwareId: selectedHardware?.id || "",
      hardwareLabel: selectedHardware?.label || "",
      hardwareImageUrl: selectedHardware?.imageUrl || "",
      materialTypeId: selectedMaterialType?.id || "",
      materialTypeLabel: selectedMaterialType?.label || "",
      fabricId: selectedFabric?.id || "",
      fabricLabel: selectedFabric?.label || "",
      windowProducer: manualMode ? "" : selectedWindow?.producer || "",
      windowModel: manualMode ? "Wymiar własny" : selectedWindow?.model || "",
      widthMm: resolvedWidthMm,
      heightMm: resolvedHeightMm,
      qty: quantityNum,
      unitPrice,
      totalPrice,
    });
  }

  return (
    <>
      <header>
        <strong>Stwórz swoją roletę dachową</strong>
      </header>

      <section className={`hero-product-step-accordion ${stepOneCollapsed ? "is-collapsed" : ""}`}>
        <button
          type="button"
          className="hero-product-step-head"
          onClick={() => {
            trackShopStep("configurator_step_toggle", "hardware_color", { collapsed_after: !stepOneCollapsed });
            setStepOneCollapsed((prev) => !prev);
          }}
          aria-expanded={stepOneCollapsed ? "false" : "true"}
        >
          <span className="hero-product-config-step-title">
            <span className="hero-product-step-check" aria-hidden="true">✓</span>
            Wybierz kolor kasety i prowadnic
          </span>
          <span className="hero-product-step-head-meta">
            {selectedHardware && stepOneCollapsed ? (
              <span
                className="hero-product-step-head-swatch"
                style={{ backgroundImage: `url(${optimizeImageUrl(selectedHardware.imageUrl, 64)})` }}
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
          <div className="hardware-grid hardware-grid--visual hero-product-hardware-grid">
            {ROLETY_DACHOWE_HARDWARE.map((option, index) => {
              const isActive = option.id === selectedHardwareId;
              const isLastSolo = ROLETY_DACHOWE_HARDWARE.length % 3 === 1 && index === ROLETY_DACHOWE_HARDWARE.length - 1;
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
                        scrollStepIntoView(stepTwoRef.current);
                      }, 380);
                    }}
                  >
                    <span
                      className="hardware-card-image"
                      style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 220)})` }}
                    />
                    {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                    <span className="hardware-card-footer">
                      <span className="hardware-dot" style={{ background: option.color }} />
                      <strong>{option.label}</strong>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="config-option-zoom"
                    aria-label={`Powiększ: ${option.label}`}
                    onClick={() => openZoom({ title: option.label, urls: option.galleryUrls, index: 0 })}
                  >
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
            <button
              type="button"
              ref={stepTwoRef}
              className="hero-product-step-head"
              onClick={() => {
                trackShopStep("configurator_step_toggle", "material_type", { collapsed_after: !stepTwoCollapsed });
                setStepTwoCollapsed((prev) => !prev);
              }}
              aria-expanded={stepTwoCollapsed ? "false" : "true"}
            >
              <span className="hero-product-config-step-title hero-product-config-step-title--muted">
                <span className={`hero-product-step-check ${materialChosen ? "" : "is-muted"}`} aria-hidden="true">
                  {materialChosen ? "✓" : "2"}
                </span>
                Wybierz rodzaj materiału
              </span>
              <span className="hero-product-step-head-meta">
                {selectedMaterialType ? <strong>{selectedMaterialType.label}</strong> : null}
                {stepTwoCollapsed ? (
                  <span className="hero-product-step-head-change">Zmień</span>
                ) : (
                  <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
                )}
              </span>
            </button>
            <div className="hero-product-step-body">
              <div className="hero-product-mesh-grid hero-product-mesh-grid--visual">
                {ROLETY_DACHOWE_MATERIAL_TYPES.map((option) => {
                  const isActive = option.id === selectedMaterialTypeId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`hero-product-mesh-option hero-product-mesh-option--visual ${isActive ? "is-active" : ""}`}
                      title={option.subtitle}
                      onClick={() => {
                        trackShopStep("select_material_type", option.label, { option_id: option.id });
                        setSelectedMaterialTypeId(option.id);
                        setStepTwoCollapsed(true);
                        window.setTimeout(() => {
                          scrollStepIntoView(stepThreeRef.current);
                        }, 380);
                      }}
                    >
                      <span
                        className="hero-product-mesh-option-image"
                        style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 160)})` }}
                      />
                      <strong>{option.label}</strong>
                    </button>
                  );
                })}
              </div>
              {selectedMaterialType?.subtitle ? (
                <p className="hero-product-config-hint">{selectedMaterialType.subtitle}</p>
              ) : null}
            </div>
          </section>

          {materialChosen ? (
            <>
              <section className={`hero-product-step-accordion ${stepThreeCollapsed ? "is-collapsed" : ""}`}>
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
                      {fabricChosen ? "✓" : "3"}
                    </span>
                    Wybierz kolor materiału
                  </span>
                  <span className="hero-product-step-head-meta">
                    {selectedFabric && stepThreeCollapsed ? (
                      <span
                        className="hero-product-step-head-swatch"
                        style={{ backgroundImage: `url(${optimizeImageUrl(selectedFabric.imageUrl, 64)})` }}
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
                  <div className="hero-product-mesh-grid hero-product-mesh-grid--visual">
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
                            window.setTimeout(() => {
                              scrollStepIntoView(stepFourRef.current);
                            }, 380);
                          }}
                        >
                          <span
                            className="hero-product-mesh-option-image"
                            style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 160)})` }}
                          />
                          <strong>{option.label}</strong>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {fabricChosen ? (
                <>
                  <p ref={stepFourRef} className="hero-product-config-step-title hero-product-config-step-title--muted">
                    <span className={`hero-product-step-check ${hasWindowInfo ? "" : "is-muted"}`} aria-hidden="true">
                      {hasWindowInfo ? "✓" : "4"}
                    </span>
                    Wybierz model okna
                  </p>
                  <p className="hero-product-config-hint">Wyszukaj producenta i model okna dachowego w bibliotece.</p>

                  {!manualMode ? (
                    <>
                      <div className="hero-product-dimensions-grid" style={{ gridTemplateColumns: "1fr" }}>
                        <label>
                          Producent i model okna
                          <input
                            type="text"
                            placeholder="np. Velux MK04, Fakro 78x118…"
                            value={windowQuery}
                            onChange={(event) => {
                              setWindowQuery(event.target.value);
                              setSelectedWindow(null);
                            }}
                          />
                        </label>
                      </div>
                      {searchResults.length > 0 && !selectedWindow ? (
                        <ul className="rd-window-results">
                          {searchResults.map((entry, index) => (
                            <li key={`${entry.producer}-${entry.model}-${index}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  trackShopStep("select_window_model", `${entry.producer} ${entry.model}`, {
                                    certain: entry.certain,
                                  });
                                  setSelectedWindow(entry);
                                  setWindowQuery(`${entry.producer} ${entry.model}`);
                                }}
                              >
                                <strong>{entry.producer} {entry.model}</strong>
                                <span>
                                  rozmiar rolety {entry.blindWidthMm} × {entry.blindHeightMm} mm
                                  {!entry.certain ? " · wymiar orientacyjny" : ""}
                                </span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                      {selectedWindow ? (
                        <p className="hero-product-dimensions-surcharge-note">
                          Wybrano: <strong>{selectedWindow.producer} {selectedWindow.model}</strong> — rozmiar rolety{" "}
                          {selectedWindow.blindWidthMm} × {selectedWindow.blindHeightMm} mm
                          {!selectedWindow.certain ? " (wymiar orientacyjny — możliwa niewielka korekta pomiaru)" : ""}.
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className="hero-product-reviews-load-more-btn"
                        onClick={() => {
                          // Real friction signal: they couldn't find their
                          // window in the library and fell back to manual
                          // entry - worth knowing which searches trigger this.
                          trackShopStep("window_model_not_found", windowQuery || "(puste zapytanie)");
                          setManualMode(true);
                          setSelectedWindow(null);
                        }}
                      >
                        Żaden z tych, wypełnię ręcznie
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="hero-product-config-hint">Podaj dane swojego okna</p>
                      <div className="hero-product-dimensions-grid">
                        <label>
                          Wymiar A (mm)
                          <input
                            type="number"
                            inputMode="numeric"
                            min={ROLETY_DACHOWE_MIN_DIMENSION_MM}
                            max={ROLETY_DACHOWE_MAX_DIMENSION_MM}
                            placeholder="Podaj wymiar w mm"
                            value={manualWidth}
                            onChange={(event) => setManualWidth(event.target.value)}
                          />
                        </label>
                        <label>
                          Wymiar B (mm)
                          <input
                            type="number"
                            inputMode="numeric"
                            min={ROLETY_DACHOWE_MIN_DIMENSION_MM}
                            max={ROLETY_DACHOWE_MAX_DIMENSION_MM}
                            placeholder="Podaj wymiar w mm"
                            value={manualHeight}
                            onChange={(event) => setManualHeight(event.target.value)}
                          />
                        </label>
                      </div>
                      {(manualWidth || manualHeight) && !manualValid ? (
                        <p className="hero-product-dimensions-error">
                          Wymiar musi mieścić się w zakresie {ROLETY_DACHOWE_MIN_DIMENSION_MM}–{ROLETY_DACHOWE_MAX_DIMENSION_MM} mm.
                        </p>
                      ) : null}
                      <button
                        type="button"
                        className="hero-product-reviews-load-more-btn"
                        onClick={() => {
                          setManualMode(false);
                          setManualWidth("");
                          setManualHeight("");
                        }}
                      >
                        Wróć do wyszukiwarki modeli
                      </button>
                    </>
                  )}
                </>
              ) : null}

              {hasWindowInfo ? (
                <div className="hero-product-mini-summary is-revealed">
                  <h3>Roleta dachowa</h3>
                  <div className="hero-product-mini-summary-body">
                    <div
                      className="mosk-preview-stage"
                      role="img"
                      aria-label={`Podgląd: kaseta ${selectedHardware?.label || "--"}, tkanina ${selectedFabric?.label || "--"}`}
                    >
                      {selectedHardware?.previewLayerUrl ? (
                        <>
                          <div
                            className="mosk-preview-surface"
                            style={buildRdLayerSurfaceStyle(selectedHardware.previewLayerUrl, selectedHardware.color)}
                          />
                          <div
                            className="mosk-preview-overlay"
                            style={{
                              backgroundImage: `url(${optimizeImageUrl(selectedHardware.previewLayerUrl, 500)})`,
                              opacity: 0.42,
                            }}
                          />
                        </>
                      ) : null}
                    </div>
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
                        <dd>{manualMode ? "Wymiar własny" : `${selectedWindow?.producer} ${selectedWindow?.model}`}</dd>
                      </div>
                      <div>
                        <dt>Rozmiar rolety</dt>
                        <dd>{resolvedWidthMm} × {resolvedHeightMm} mm</dd>
                      </div>
                      <div>
                        <dt>Ilość</dt>
                        <dd>{quantityNum} szt.</dd>
                      </div>
                    </dl>
                  </div>
                  <div className="hero-product-mini-summary-price">
                    <div className="hero-product-mini-summary-price-details">
                      <div>
                        <dt>Ilość</dt>
                        <dd>
                          <input
                            type="number"
                            inputMode="numeric"
                            min={1}
                            max={20}
                            value={quantity}
                            onChange={(event) => setQuantity(event.target.value)}
                            className="rd-qty-input"
                          />
                        </dd>
                      </div>
                      <div>
                        <dt>Cena za 1 szt.</dt>
                        <dd>
                          {unitPrice !== null
                            ? `${unitPrice.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                            : "--"}
                        </dd>
                      </div>
                    </div>
                    <div className="hero-product-mini-summary-price-final">
                      <strong>
                        {totalPrice !== null
                          ? `${totalPrice.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                          : "Cena niedostępna dla tej kombinacji"}
                      </strong>
                    </div>
                  </div>
                  <button type="button" className="hero-product-add-to-cart" onClick={handleSubmit} disabled={totalPrice === null}>
                    {submitLabel}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}
        </>
      ) : (
        <p className="hero-product-config-hint">Wybierz kolor kasety, aby przejść do kolejnego kroku.</p>
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
