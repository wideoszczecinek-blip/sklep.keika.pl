"use client";

// The moskitiery-ramkowe configurator itself (color -> mesh -> dimensions ->
// price -> submit), extracted so it can be dropped in unchanged wherever a
// "1:1 with the product page" instance is needed - the homepage's own
// product panel, and the cart's "Edytuj pozycję" modal. Everything here is
// ported verbatim from the panel that used to live inline in app/page.tsx;
// only the state ownership and the post-submit step (now the caller's job
// via onSubmit) changed.
import { useEffect, useMemo, useRef, useState } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import {
  ALLEGRO_MOSKITIERY_HARDWARE,
  MESH_OPTIONS,
  MOSKITIERY_MESH_LAYER_URL,
  MOSKITIERY_PROFILE_DEFAULT_LAYER_URL,
  MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM,
  MOSKITIERY_RAMKOWE_PRICE_ON_PROMO,
  MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO,
  MOSKITIERY_RAMKOWE_PRICE_PER_MB_STANDARD,
  OVERSIZE_SURCHARGE_THRESHOLD_MM,
  OVERSIZE_TECHNICAL_LIMIT_MM,
  buildMoskLayerSurfaceStyle,
  moskBilledMeters,
  moskOversizeSurchargeForDimension,
  moskPerimeterMeters,
  type ConfiguratorInitialValues,
  type ConfiguratorResult,
} from "./shared";

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
  /** Omit to use a small built-in lightbox; pass this when the host page
   * already has its own shared zoom modal (the homepage does, for the
   * gallery tab too) to funnel clicks into that instead of stacking two. */
  onZoom?: (preview: ZoomPreview) => void;
}) {
  const hardwareOptions = ALLEGRO_MOSKITIERY_HARDWARE;

  const [selectedHardwareId, setSelectedHardwareId] = useState(initialValues?.hardwareId || "");
  const [stepOneChosen, setStepOneChosen] = useState(Boolean(initialValues?.hardwareId));
  const [stepOneCollapsed, setStepOneCollapsed] = useState(Boolean(initialValues?.hardwareId));
  const [stepTwoCollapsed, setStepTwoCollapsed] = useState(Boolean(initialValues?.meshId));
  const [selectedMeshId, setSelectedMeshId] = useState(initialValues?.meshId || "");
  const [dimensionWidth, setDimensionWidth] = useState(initialValues?.widthMm ? String(initialValues.widthMm) : "");
  const [dimensionHeight, setDimensionHeight] = useState(initialValues?.heightMm ? String(initialValues.heightMm) : "");
  const [dimensionQuantity, setDimensionQuantity] = useState(initialValues?.qty ? String(initialValues.qty) : "1");
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [surchargeModal, setSurchargeModal] = useState<{ amount: number } | null>(null);
  const [acceptedSurcharge, setAcceptedSurcharge] = useState<{ width: number; height: number; amount: number } | null>(
    null,
  );
  const [internalZoomPreview, setInternalZoomPreview] = useState<ZoomPreview | null>(null);

  const stepTwoRef = useRef<HTMLButtonElement | null>(null);
  const stepThreeRef = useRef<HTMLParagraphElement | null>(null);

  // Keeps the newly-opened step clear of the fixed .hero-header. Computed
  // and applied by hand (instead of scrollIntoView) because on mobile the
  // real scroll container is .hero-full, not the window/body - scrollIntoView
  // there interacted unpredictably with the still-settling accordion
  // fold/unfold layout shift happening in the same instant.
  const MOBILE_HEADER_CLEARANCE_PX = 96;
  function scrollStepIntoView(target: HTMLElement | null) {
    if (!target) return;

    // Desktop: .hero-product-config-panel is its own independent scrollbox
    // (overflow-y:auto, see its CSS) precisely so this never has to touch
    // .hero-full - the left description column shares only that outer
    // container with the panel, and .hero-full has real overflow on desktop
    // too (the stacked description/gallery/reviews flow), so scrolling it
    // here would drag that column's position along with the step reveal.
    // Detected via computed overflow-y rather than a width breakpoint so
    // this tracks the actual CSS decision - mobile's override resets it
    // back to visible (see that selector's mobile media query), which is
    // how this correctly falls through to the .hero-full path below there.
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
      // Nothing to scroll inside the panel: the step is already as visible
      // as it can be within it, so there's nothing more to do - critically,
      // never fall through to .hero-full here even though it does have
      // scrollable room, or the left column moves again.
      return;
    }

    const container = target.closest(".hero-full") as HTMLElement | null;
    if (!container || container.scrollHeight <= container.clientHeight) {
      // Nothing to scroll at all: fall back to the plain browser API.
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    const containerRect = container.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const delta = targetRect.top - containerRect.top - MOBILE_HEADER_CLEARANCE_PX;
    const nextTop = Math.max(0, Math.min(container.scrollTop + delta, container.scrollHeight - container.clientHeight));
    container.scrollTo({ top: nextTop, behavior: "smooth" });
  }

  function openZoom(preview: ZoomPreview) {
    if (onZoom) onZoom(preview);
    else setInternalZoomPreview(preview);
  }

  const selectedHardwareOption = useMemo(
    () => hardwareOptions.find((option) => option.id === selectedHardwareId) || hardwareOptions[0] || null,
    [hardwareOptions, selectedHardwareId],
  );
  const selectedMesh = useMemo(
    () => MESH_OPTIONS.find((option) => option.id === selectedMeshId) || null,
    [selectedMeshId],
  );
  const meshChosen = Boolean(selectedMeshId);
  const widthNum = Number(dimensionWidth) || 0;
  const heightNum = Number(dimensionHeight) || 0;
  const quantityNum = Math.max(1, Number(dimensionQuantity) || 1);
  // Below MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM isn't a manufacturable frame -
  // flagged separately from "not filled in yet" so there's a clear inline
  // reason once the customer has actually typed something too small.
  const widthBelowMinimum = widthNum > 0 && widthNum < MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM;
  const heightBelowMinimum = heightNum > 0 && heightNum < MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM;
  const belowMinimumDimension = widthBelowMinimum || heightBelowMinimum;
  const hasValidDimensions =
    widthNum >= MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM && heightNum >= MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM;
  const perimeterMeters = hasValidDimensions ? moskPerimeterMeters(widthNum, heightNum) : null;
  const billedMeters = perimeterMeters !== null ? moskBilledMeters(perimeterMeters) : null;
  const dimensionUnitPrice = billedMeters !== null ? billedMeters * MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO : null;
  const dimensionTotalPrice = dimensionUnitPrice !== null ? dimensionUnitPrice * quantityNum : null;

  useEffect(() => {
    if (!hasValidDimensions) {
      setIsCalculatingPrice(false);
      return;
    }
    setIsCalculatingPrice(true);
    const timer = window.setTimeout(() => setIsCalculatingPrice(false), 700);
    return () => window.clearTimeout(timer);
  }, [hasValidDimensions, widthNum, heightNum, quantityNum]);

  const bothDimensionsOverTechnicalLimit =
    widthNum > OVERSIZE_TECHNICAL_LIMIT_MM && heightNum > OVERSIZE_TECHNICAL_LIMIT_MM;
  const requiredSurchargeForCurrentDims = hasValidDimensions
    ? moskOversizeSurchargeForDimension(Math.max(widthNum, heightNum))
    : 0;
  const surchargeSatisfied =
    requiredSurchargeForCurrentDims <= 0 ||
    (acceptedSurcharge !== null && acceptedSurcharge.width === widthNum && acceptedSurcharge.height === heightNum);
  const dimensionsBlocked = bothDimensionsOverTechnicalLimit || requiredSurchargeForCurrentDims < 0 || !surchargeSatisfied;
  const activeSurchargeAmount = surchargeSatisfied && requiredSurchargeForCurrentDims > 0 ? requiredSurchargeForCurrentDims : 0;

  function handleDimensionBlur() {
    if (!hasValidDimensions) return;
    if (widthNum > OVERSIZE_TECHNICAL_LIMIT_MM && heightNum > OVERSIZE_TECHNICAL_LIMIT_MM) {
      return; // shown inline near the inputs, nothing to revert here
    }
    const maxDim = Math.max(widthNum, heightNum);
    const required = moskOversizeSurchargeForDimension(maxDim);
    if (required <= 0) {
      if (acceptedSurcharge) setAcceptedSurcharge(null);
      return;
    }
    if (acceptedSurcharge && acceptedSurcharge.width === widthNum && acceptedSurcharge.height === heightNum) {
      return;
    }
    if (required < 0) {
      return; // inline "za duży wymiar" message handles this case
    }
    setSurchargeModal({ amount: required });
  }

  function handleAcceptSurcharge() {
    if (!surchargeModal) return;
    setAcceptedSurcharge({ width: widthNum, height: heightNum, amount: surchargeModal.amount });
    setSurchargeModal(null);
  }

  function handleDeclineSurcharge() {
    if (widthNum > OVERSIZE_SURCHARGE_THRESHOLD_MM) setDimensionWidth("");
    if (heightNum > OVERSIZE_SURCHARGE_THRESHOLD_MM) setDimensionHeight("");
    setSurchargeModal(null);
  }

  function handleSubmit() {
    if (dimensionUnitPrice === null || dimensionTotalPrice === null) return;
    if (dimensionsBlocked) return;
    onSubmit({
      hardwareId: selectedHardwareOption?.id || "",
      hardwareLabel: selectedHardwareOption?.label || "",
      hardwareImageUrl: selectedHardwareOption?.imageUrl || "",
      meshId: selectedMesh?.id || "",
      meshLabel: selectedMesh?.label || "",
      widthMm: widthNum,
      heightMm: heightNum,
      qty: quantityNum,
      unitPrice: dimensionUnitPrice,
      totalPrice: dimensionTotalPrice,
      oversizeSurchargeAmount: activeSurchargeAmount,
    });
  }

  return (
    <>
      <header>
        <strong>Stwórz swoją moskitierę</strong>
      </header>
      <section className={`hero-product-step-accordion ${stepOneCollapsed ? "is-collapsed" : ""}`}>
        <button
          type="button"
          className="hero-product-step-head"
          onClick={() => setStepOneCollapsed((prev) => !prev)}
          aria-expanded={stepOneCollapsed ? "false" : "true"}
        >
          <span className="hero-product-config-step-title">
            <span className="hero-product-step-check" aria-hidden="true">✓</span>
            Wybierz kolor profili
          </span>
          <span className="hero-product-step-head-meta">
            {selectedHardwareOption && stepOneCollapsed ? (
              <span
                className="hero-product-step-head-swatch"
                style={{ backgroundImage: `url(${optimizeImageUrl(selectedHardwareOption.imageUrl, 64)})` }}
                aria-hidden="true"
              />
            ) : null}
            {selectedHardwareOption ? <strong>{selectedHardwareOption.label}</strong> : null}
            {stepOneCollapsed ? (
              <span className="hero-product-step-head-change">Zmień</span>
            ) : (
              <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
            )}
          </span>
        </button>
        <div className="hero-product-step-body">
          <div className="hardware-grid hardware-grid--visual hero-product-hardware-grid">
            {hardwareOptions.map((option, index) => {
              const isActive = option.id === selectedHardwareId;
              const isLastSolo = hardwareOptions.length % 3 === 1 && index === hardwareOptions.length - 1;
              return (
                <div
                  key={option.id}
                  className={`hardware-card ${isActive ? "is-active" : ""} ${isLastSolo ? "is-last-solo" : ""}`}
                >
                  <button
                    type="button"
                    className="hardware-card-main"
                    onClick={() => {
                      setSelectedHardwareId(option.id);
                      setStepOneCollapsed(true);
                      if (!stepOneChosen) {
                        setStepOneChosen(true);
                      }
                      // Wait for the accordion's own 340ms fold animation to
                      // finish before scrolling, so the two motions don't
                      // fight each other.
                      window.setTimeout(() => {
                        scrollStepIntoView(stepTwoRef.current);
                      }, 380);
                    }}
                  >
                    <span className="hardware-card-image" style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 220)})` }} />
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
                    onClick={() =>
                      openZoom({
                        title: option.label,
                        urls: option.galleryUrls?.length ? option.galleryUrls : [option.imageUrl],
                        index: 0,
                      })
                    }
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
              onClick={() => setStepTwoCollapsed((prev) => !prev)}
              aria-expanded={stepTwoCollapsed ? "false" : "true"}
            >
              <span className="hero-product-config-step-title hero-product-config-step-title--muted">
                <span className={`hero-product-step-check ${meshChosen ? "" : "is-muted"}`} aria-hidden="true">
                  {meshChosen ? "✓" : "2"}
                </span>
                Dobierz kolor siatki
              </span>
              <span className="hero-product-step-head-meta">
                {selectedMesh && stepTwoCollapsed ? (
                  selectedMesh.imageUrl ? (
                    <span
                      className="hero-product-step-head-swatch"
                      style={{ backgroundImage: `url(${optimizeImageUrl(selectedMesh.imageUrl, 64)})` }}
                      aria-hidden="true"
                    />
                  ) : (
                    <span
                      className="hero-product-step-head-swatch is-color-only"
                      style={{ background: selectedMesh.color }}
                      aria-hidden="true"
                    />
                  )
                ) : null}
                {selectedMesh ? <strong>{selectedMesh.label}</strong> : null}
                {stepTwoCollapsed ? (
                  <span className="hero-product-step-head-change">Zmień</span>
                ) : (
                  <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
                )}
              </span>
            </button>
            <div className="hero-product-step-body">
              <div className="hero-product-mesh-grid hero-product-mesh-grid--visual">
                {MESH_OPTIONS.map((option) => {
                  const isActive = option.id === selectedMeshId;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      className={`hero-product-mesh-option hero-product-mesh-option--visual ${isActive ? "is-active" : ""}`}
                      onClick={() => {
                        setSelectedMeshId(option.id);
                        setStepTwoCollapsed(true);
                        window.setTimeout(() => {
                          scrollStepIntoView(stepThreeRef.current);
                        }, 380);
                      }}
                    >
                      {option.imageUrl ? (
                        <span
                          className="hero-product-mesh-option-image"
                          style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 160)})` }}
                        />
                      ) : (
                        <span className="hardware-dot" style={{ background: option.color }} />
                      )}
                      <strong>{option.label}</strong>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
          {meshChosen ? (
            <>
              <p ref={stepThreeRef} className="hero-product-config-step-title hero-product-config-step-title--muted">
                <span className={`hero-product-step-check ${hasValidDimensions ? "" : "is-muted"}`} aria-hidden="true">
                  {hasValidDimensions ? "✓" : "3"}
                </span>
                Podaj wymiary
              </p>
              <div className="hero-product-dimensions-grid">
                <label>
                  Szerokość (mm)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM}
                    max={2300}
                    placeholder="np. 1000"
                    value={dimensionWidth}
                    onChange={(event) => setDimensionWidth(event.target.value)}
                    onBlur={handleDimensionBlur}
                  />
                </label>
                <label>
                  Wysokość (mm)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM}
                    max={2300}
                    placeholder="np. 1200"
                    value={dimensionHeight}
                    onChange={(event) => setDimensionHeight(event.target.value)}
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
                    value={dimensionQuantity}
                    onChange={(event) => setDimensionQuantity(event.target.value)}
                  />
                </label>
              </div>
              {belowMinimumDimension ? (
                <p className="hero-product-dimensions-error">
                  Minimalny wymiar to {MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM} mm (15 cm) na każdym boku.
                </p>
              ) : bothDimensionsOverTechnicalLimit ? (
                <p className="hero-product-dimensions-error">
                  Ten rozmiar przekracza możliwości techniczne produkcji - szerokość i wysokość nie mogą jednocześnie
                  przekraczać 160 cm. Zmniejsz jeden z wymiarów.
                </p>
              ) : requiredSurchargeForCurrentDims < 0 ? (
                <p className="hero-product-dimensions-error">Maksymalny obsługiwany wymiar to 230 cm.</p>
              ) : activeSurchargeAmount > 0 ? (
                <p className="hero-product-dimensions-surcharge-note">
                  Ten rozmiar wiąże się z jednorazową dopłatą{" "}
                  {activeSurchargeAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                  zł za przesyłkę dłużycową (zaakceptowano).
                </p>
              ) : null}
            </>
          ) : null}
          {hasValidDimensions ? (
            <div className="hero-product-mini-summary is-revealed">
              <h3>Moskitiera okienna</h3>
              <div className="hero-product-mini-summary-body">
                <div
                  className="mosk-preview-stage"
                  role="img"
                  aria-label={`Podgląd: profil ${selectedHardwareOption?.label || "--"}, siatka ${selectedMesh?.label || "--"}`}
                >
                  {/* Per the CRM admin panel (allegro_configurator.js /
                      .alcfg-layer-preview*): every step has ONE shared PNG
                      layer, tinted per-option by accent_color, rendered as a
                      masked gradient "surface" plus a second, unmasked,
                      low-opacity, multiply-blended "overlay" pass of the same
                      PNG for texture. No base photo - these two layers per
                      option are the entire preview. */}
                  {selectedHardwareOption ? (
                    <>
                      <div
                        className="mosk-preview-surface"
                        style={buildMoskLayerSurfaceStyle(MOSKITIERY_PROFILE_DEFAULT_LAYER_URL, selectedHardwareOption.color, "solid")}
                      />
                      <div
                        className="mosk-preview-overlay"
                        style={{
                          backgroundImage: `url(${optimizeImageUrl(MOSKITIERY_PROFILE_DEFAULT_LAYER_URL, 500)})`,
                          opacity: 0.42,
                        }}
                      />
                    </>
                  ) : null}
                  {selectedMesh ? (
                    <>
                      <div
                        className="mosk-preview-surface"
                        style={buildMoskLayerSurfaceStyle(MOSKITIERY_MESH_LAYER_URL, selectedMesh.color, "mesh")}
                      />
                      <div
                        className="mosk-preview-overlay"
                        style={{
                          backgroundImage: `url(${optimizeImageUrl(MOSKITIERY_MESH_LAYER_URL, 500)})`,
                          opacity: 0.46,
                        }}
                      />
                    </>
                  ) : null}
                </div>
                <dl>
                  <div>
                    <dt>Kolor profilu</dt>
                    <dd>{selectedHardwareOption?.label || "--"}</dd>
                  </div>
                  <div>
                    <dt>Kolor siatki</dt>
                    <dd>{selectedMesh?.label || "--"}</dd>
                  </div>
                  <div>
                    <dt>Rozmiar</dt>
                    <dd>{hasValidDimensions ? `${widthNum} × ${heightNum} mm` : "--"}</dd>
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
                    <dt>Obwód</dt>
                    <dd>
                      {perimeterMeters !== null
                        ? `${perimeterMeters.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`
                        : "--"}
                    </dd>
                  </div>
                  <div>
                    <dt>Cena za 1 mb</dt>
                    <dd>
                      <span className="price-per-mb-promo">
                        {MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                      </span>
                      {MOSKITIERY_RAMKOWE_PRICE_ON_PROMO ? (
                        <span className="price-per-mb-standard">
                          {MOSKITIERY_RAMKOWE_PRICE_PER_MB_STANDARD.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                        </span>
                      ) : null}
                    </dd>
                  </div>
                </div>
                <div className="hero-product-mini-summary-price-final">
                  <strong className={isCalculatingPrice ? "is-calculating" : ""}>
                    {isCalculatingPrice
                      ? "Obliczam…"
                      : dimensionTotalPrice !== null
                        ? `${dimensionTotalPrice.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                        : "Podaj wymiary"}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                className="hero-product-add-to-cart"
                onClick={handleSubmit}
                disabled={isCalculatingPrice || dimensionTotalPrice === null || dimensionsBlocked}
              >
                {submitLabel}
              </button>
            </div>
          ) : null}
        </>
      ) : (
        <p className="hero-product-config-hint">Wybierz kolor profilu, aby przejść do kolejnego kroku.</p>
      )}

      {surchargeModal ? (
        <div className="surcharge-modal" role="dialog" aria-modal="true" aria-label="Dopłata za przesyłkę dłużycową">
          <div className="surcharge-modal-shell">
            <h3>Przesyłka dłużycowa</h3>
            <p>
              Przy tym rozmiarze zamówienie wymaga jednorazowej dopłaty logistycznej{" "}
              <strong>
                {surchargeModal.amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
              </strong>{" "}
              za przesyłkę dłużycową (dopłata dotyczy całego zamówienia, nie każdej pozycji osobno).
            </p>
            <div className="surcharge-modal-actions">
              <button type="button" className="surcharge-modal-decline" onClick={handleDeclineSurcharge}>
                Zmień wymiar
              </button>
              <button type="button" className="surcharge-modal-accept" onClick={handleAcceptSurcharge}>
                Akceptuję dopłatę
              </button>
            </div>
          </div>
        </div>
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
            {internalZoomPreview.urls.length > 1 ? (
              <button
                type="button"
                className="config-option-preview-nav is-prev"
                aria-label="Poprzednie zdjęcie"
                onClick={() =>
                  setInternalZoomPreview((prev) => {
                    if (!prev) return prev;
                    const nextIndex = (prev.index - 1 + prev.urls.length) % prev.urls.length;
                    return { ...prev, index: nextIndex };
                  })
                }
              >
                ‹
              </button>
            ) : null}
            {internalZoomPreview.urls.length > 1 ? (
              <button
                type="button"
                className="config-option-preview-nav is-next"
                aria-label="Następne zdjęcie"
                onClick={() =>
                  setInternalZoomPreview((prev) => {
                    if (!prev) return prev;
                    const nextIndex = (prev.index + 1) % prev.urls.length;
                    return { ...prev, index: nextIndex };
                  })
                }
              >
                ›
              </button>
            ) : null}
            <img
              src={optimizeImageUrl(internalZoomPreview.urls[internalZoomPreview.index], 1200, 80)}
              alt={internalZoomPreview.title}
              className="config-option-preview-image"
              loading="eager"
            />
            <p>
              {internalZoomPreview.title}
              {internalZoomPreview.urls.length > 1 ? ` • ${internalZoomPreview.index + 1}/${internalZoomPreview.urls.length}` : ""}
            </p>
          </div>
        </div>
      ) : null}
    </>
  );
}
