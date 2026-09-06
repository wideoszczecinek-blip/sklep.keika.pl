"use client";

// The plisy (pleated blind) configurator: kolor mechanizmu -> kolekcja
// tkaniny -> kolor tkaniny -> wymiary -> dynamic price -> submit. Mirrors
// features/rolety-dachowe/ConfiguratorPanel.tsx's structure (same accordion
// steps, same scroll-into-view handling, same add-to-cart contract) with
// two differences: no window-model-library step (plisy are sized directly
// to the actual opening, not looked up by window producer/model), and its
// option/price data is fetched live from the CRM (see shared.ts) rather
// than hardcoded - the business owner is expected to keep editing it
// directly in the CRM admin panel, and a live fetch means those edits show
// up without a frontend redeploy.
import { useEffect, useMemo, useRef, useState } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import { trackShopStep } from "@/lib/track-step";
import {
  buildPlisySurfaceStyle,
  calcPlisyPrice,
  fetchPlisyProfile,
  type ConfiguratorInitialValues,
  type ConfiguratorResult,
  type PlisyProfile,
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
  onZoom?: (preview: ZoomPreview) => void;
}) {
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

  const [selectedMountId, setSelectedMountId] = useState(initialValues?.mountId || "");
  const [stepZeroChosen, setStepZeroChosen] = useState(Boolean(initialValues?.mountId));
  const [stepZeroCollapsed, setStepZeroCollapsed] = useState(Boolean(initialValues?.mountId));

  const [selectedHardwareId, setSelectedHardwareId] = useState(initialValues?.hardwareId || "");
  const [stepOneChosen, setStepOneChosen] = useState(Boolean(initialValues?.hardwareId));
  const [stepOneCollapsed, setStepOneCollapsed] = useState(Boolean(initialValues?.hardwareId));

  const [selectedFabricGroupId, setSelectedFabricGroupId] = useState(initialValues?.fabricGroupId || "");
  const [stepTwoCollapsed, setStepTwoCollapsed] = useState(Boolean(initialValues?.fabricGroupId));

  const [selectedFabricId, setSelectedFabricId] = useState(initialValues?.fabricId || "");
  const [stepThreeCollapsed, setStepThreeCollapsed] = useState(Boolean(initialValues?.fabricId));

  const [width, setWidth] = useState(initialValues?.widthMm ? String(initialValues.widthMm) : "");
  const [height, setHeight] = useState(initialValues?.heightMm ? String(initialValues.heightMm) : "");
  const [quantity, setQuantity] = useState(initialValues?.qty ? String(initialValues.qty) : "1");
  const [internalZoomPreview, setInternalZoomPreview] = useState<ZoomPreview | null>(null);

  const stepOneRef = useRef<HTMLButtonElement | null>(null);
  const stepTwoRef = useRef<HTMLButtonElement | null>(null);
  const stepThreeRef = useRef<HTMLButtonElement | null>(null);
  const stepFourRef = useRef<HTMLParagraphElement | null>(null);

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

  const selectedMount = useMemo(
    () => profile?.mountOptions.find((option) => option.id === selectedMountId) || null,
    [profile, selectedMountId],
  );
  const selectedHardware = useMemo(
    () => profile?.hardware.find((option) => option.id === selectedHardwareId) || null,
    [profile, selectedHardwareId],
  );
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

  // Switching collection invalidates whatever color was picked under the
  // previous one - same rule as rolety-dachowe's material-type/fabric pair.
  useEffect(() => {
    if (selectedFabric && selectedFabricGroup && !swatchesForGroup.some((swatch) => swatch.id === selectedFabric.id)) {
      setSelectedFabricId("");
      setStepThreeCollapsed(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedFabricGroupId]);

  const widthNum = Number(width) || 0;
  const heightNum = Number(height) || 0;
  const dimensionsValid = profile
    ? widthNum >= profile.widthMinMm &&
      widthNum <= profile.widthMaxMm &&
      heightNum >= profile.heightMinMm &&
      heightNum <= profile.heightMaxMm
    : false;
  const quantityNum = Math.max(1, Number(quantity) || 1);

  const matrixUnitPrice =
    profile && dimensionsValid && selectedHardwareId && selectedFabricGroupId
      ? calcPlisyPrice(profile, widthNum, heightNum, selectedHardwareId, selectedFabricGroupId)
      : null;
  // Mount type's "Dopłata (zł)" is a flat per-unit surcharge on top of the
  // size/hardware/fabric matrix price - shown as a "+X zł" badge on the
  // swatch itself (step 1), so it has to actually land in the charged
  // price or that badge would be advertising a cost nobody pays.
  const unitPrice = matrixUnitPrice !== null ? matrixUnitPrice + (selectedMount?.priceDelta || 0) : null;
  const totalPrice = unitPrice !== null ? Math.round(unitPrice * quantityNum * 100) / 100 : null;

  function handleSubmit() {
    if (!dimensionsValid || unitPrice === null || totalPrice === null) return;
    onSubmit({
      mountId: selectedMount?.id || "",
      mountLabel: selectedMount?.label || "",
      hardwareId: selectedHardware?.id || "",
      hardwareLabel: selectedHardware?.label || "",
      fabricGroupId: selectedFabricGroup?.id || "",
      fabricGroupLabel: selectedFabricGroup?.label || "",
      fabricId: selectedFabric?.id || "",
      fabricLabel: selectedFabric?.label || "",
      widthMm: widthNum,
      heightMm: heightNum,
      qty: quantityNum,
      unitPrice,
      totalPrice,
    });
  }

  if (loadState === "loading") {
    return (
      <>
        <header>
          <strong>Stwórz swoją plisę</strong>
        </header>
        <p className="hero-product-config-hint">Wczytuję konfigurator…</p>
      </>
    );
  }

  if (loadState === "error" || !profile) {
    return (
      <>
        <header>
          <strong>Stwórz swoją plisę</strong>
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
        <strong>Stwórz swoją plisę</strong>
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
              Wybierz rodzaj montażu
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
                    {option.priceDelta > 0 ? (
                      <span className="hardware-price-badge">
                        +{option.priceDelta.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
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
                style={buildPlisySurfaceStyle(selectedHardware.imageUrl, selectedHardware.color)}
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
                        scrollStepIntoView(stepTwoRef.current);
                      }, 380);
                    }}
                  >
                    <span className="hardware-card-image" style={buildPlisySurfaceStyle(option.imageUrl, option.color)} />
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

      {stepOneChosen ? (
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
                  {fabricGroupChosen ? "✓" : "3"}
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
            <div className="hero-product-step-body">
              <div className="hero-product-mesh-grid hero-product-mesh-grid--visual">
                {profile.fabricGroups.map((group) => {
                  const isActive = group.id === selectedFabricGroupId;
                  return (
                    <button
                      key={group.id}
                      type="button"
                      className={`hero-product-mesh-option hero-product-mesh-option--visual ${isActive ? "is-active" : ""}`}
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
                      <span
                        className="hero-product-mesh-option-image"
                        style={
                          group.imageUrl
                            ? { backgroundImage: `url(${optimizeImageUrl(group.imageUrl, 160)})` }
                            : { background: group.swatches[0]?.color || "#E2E8F0" }
                        }
                      />
                      <strong>{group.label}</strong>
                    </button>
                  );
                })}
              </div>
              {selectedFabricGroup?.note ? <p className="hero-product-config-hint">{selectedFabricGroup.note}</p> : null}
            </div>
          </section>

          {fabricGroupChosen ? (
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
                      {fabricChosen ? "✓" : "4"}
                    </span>
                    Wybierz kolor tkaniny
                  </span>
                  <span className="hero-product-step-head-meta">
                    {selectedFabric && stepThreeCollapsed ? (
                      <span
                        className="hero-product-step-head-swatch"
                        style={buildPlisySurfaceStyle(selectedFabric.thumbnailUrl, selectedFabric.color)}
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
                    {swatchesForGroup.map((swatch) => {
                      const isActive = swatch.id === selectedFabricId;
                      return (
                        <button
                          key={swatch.id}
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
                            style={buildPlisySurfaceStyle(swatch.thumbnailUrl, swatch.color)}
                          />
                          <strong>{swatch.label}</strong>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </section>

              {fabricChosen ? (
                <>
                  <p ref={stepFourRef} className="hero-product-config-step-title hero-product-config-step-title--muted">
                    <span className={`hero-product-step-check ${dimensionsValid ? "" : "is-muted"}`} aria-hidden="true">
                      {dimensionsValid ? "✓" : "5"}
                    </span>
                    Podaj wymiary
                  </p>
                  <p className="hero-product-config-hint">Zmierz szerokość i wysokość otworu okiennego w milimetrach.</p>
                  <div className="hero-product-dimensions-grid">
                    <label>
                      Szerokość (mm)
                      <input
                        type="number"
                        inputMode="numeric"
                        min={profile.widthMinMm}
                        max={profile.widthMaxMm}
                        placeholder={`np. ${profile.widthDefaultMm}`}
                        value={width}
                        onChange={(event) => setWidth(event.target.value)}
                      />
                    </label>
                    <label>
                      Wysokość (mm)
                      <input
                        type="number"
                        inputMode="numeric"
                        min={profile.heightMinMm}
                        max={profile.heightMaxMm}
                        placeholder={`np. ${profile.heightDefaultMm}`}
                        value={height}
                        onChange={(event) => setHeight(event.target.value)}
                      />
                    </label>
                  </div>
                  {(width || height) && !dimensionsValid ? (
                    <p className="hero-product-dimensions-error">
                      Wymiar musi mieścić się w zakresie {profile.widthMinMm}–{profile.widthMaxMm} mm.
                    </p>
                  ) : null}
                </>
              ) : null}

              {dimensionsValid ? (
                <div className="hero-product-mini-summary is-revealed">
                  <h3>Plisa</h3>
                  <div className="hero-product-mini-summary-body">
                    <div
                      className="mosk-preview-stage"
                      role="img"
                      aria-label={`Podgląd: mechanizm ${selectedHardware?.label || "--"}, tkanina ${selectedFabric?.label || "--"}`}
                    >
                      {selectedFabric?.thumbnailUrl ? (
                        <div
                          className="mosk-preview-overlay"
                          style={{
                            backgroundImage: `url(${optimizeImageUrl(selectedFabric.thumbnailUrl, 500)})`,
                            opacity: 0.85,
                          }}
                        />
                      ) : null}
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
                      <div>
                        <dt>Wymiary</dt>
                        <dd>{widthNum} × {heightNum} mm</dd>
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
        <p className="hero-product-config-hint">Wybierz kolor mechanizmu, aby przejść do kolejnego kroku.</p>
      )}
        </>
      ) : (
        <p className="hero-product-config-hint">Wybierz rodzaj montażu, aby przejść do kolejnego kroku.</p>
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
