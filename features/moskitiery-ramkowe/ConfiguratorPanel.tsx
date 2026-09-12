"use client";

// The moskitiery-ramkowe configurator itself (color -> mesh -> dimensions ->
// price -> submit), extracted so it can be dropped in unchanged wherever a
// "1:1 with the product page" instance is needed - the homepage's own
// product panel, and the cart's "Edytuj pozycję" modal. Everything here is
// ported verbatim from the panel that used to live inline in app/page.tsx;
// only the state ownership and the post-submit step (now the caller's job
// via onSubmit) changed.
import { useEffect, useMemo, useRef, useState } from "react";
import PromoCountdownBanner, { AUTO_OPEN_TRACK_KEY } from "@/app/components/promo-countdown-banner";
import PromoSaveModal from "@/app/components/promo-save-modal";
import SaveShareWidget from "@/app/components/save-share-widget";
import { optimizeImageUrl } from "@/lib/image-optim";
import {
  buildRescuePosition,
  hasSeenRescueModal,
  isRescueDismissedForGood,
  markRescueDismissedForGood,
  markRescueModalShown,
} from "@/lib/rescue";
import { trackShopStep } from "@/lib/track-step";
import {
  PROMO_ACTIVATED_EVENT,
  PROMO_CODE,
  activatePromoCode,
  applyPromoToPrice,
  fetchPromoPreview,
  getPromoActivatedAt,
  getPromoRemainingMs,
  isPromoActive,
  type PromoPreview,
} from "@/lib/promo";
import { ensurePromoQuoteCode, hasSavedPromoLink } from "@/lib/promo-save";
import {
  ALLEGRO_MOSKITIERY_HARDWARE,
  MESH_OPTIONS,
  MIN_WORTHWHILE_LEFTOVER_SAVINGS_ZL,
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
  moskLeftoverCapacity,
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
  onOpenInstructions,
  enableRescueModal,
  enableSaveShareBanner,
}: {
  initialValues?: ConfiguratorInitialValues;
  submitLabel: string;
  onSubmit: (result: ConfiguratorResult) => void;
  /** Omit to use a small built-in lightbox; pass this when the host page
   * already has its own shared zoom modal (the homepage does, for the
   * gallery tab too) to funnel clicks into that instead of stacking two. */
  onZoom?: (preview: ZoomPreview) => void;
  /** Opens the host page's own measurement-instructions popup (the homepage
   * already has one - see instructionModalIndex in app/page.tsx) from the
   * "podaj wymiary" step. Omit to hide the link entirely - the cart's
   * "Edytuj pozycję" modal has no such popup of its own to open, and
   * duplicating one there wasn't asked for. */
  onOpenInstructions?: () => void;
  /** Exit-intent modal built around the SEZON20 discount (activate it for a
   * visitor who never did, or remind one who did but never saved/shared the
   * link) - only the real product-page instance wants this; the cart's
   * "Edytuj pozycję" modal edits an item that's already in the cart, so
   * there's nothing to rescue there. Default off. */
  enableRescueModal?: boolean;
  /** Proactive "save or share this configuration" banner (see
   * app/components/save-share-widget.tsx) - separate from the exit-intent
   * modal above (voluntary, no discount of its own, can show every visit),
   * same default-off reasoning for the cart's edit modal. */
  enableSaveShareBanner?: boolean;
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
  // "i" tooltip next to the leftover-savings banner - see its own render
  // site below for what it explains.
  const [leftoverInfoOpen, setLeftoverInfoOpen] = useState(false);

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
    trackShopStep("gallery_zoom_open", preview?.title || "moskitiery-ramkowe", { image_index: preview?.index ?? 0 });
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

  // Exit-intent modal - a visitor about to leave gets one chance (per
  // browser, ever) to keep the SEZON20 discount instead of losing it. No
  // longer a standalone +5% "rabat za zapisanie" independent of SEZON20 -
  // that stacked on top of a customer's real promo state regardless of it,
  // which is exactly what we're moving away from now that SEZON20 carries
  // its own real 24h deadline (see lib/promo.ts): the exit-intent is now
  // entirely about *that* deadline, three cases, never more than one modal:
  //   1. SEZON20 active AND already saved/shared (hasSavedPromoLink()) -
  //      nothing left to remind them about, stays silent.
  //   2. SEZON20 active but never saved - "zaraz stracisz rabat" with the
  //      real remaining time (PromoSaveModal variant="reminder", unchanged
  //      from before).
  //   3. SEZON20 never activated at all - activate it for them right here,
  //      then show PromoSaveModal variant="activated" ("włączyliśmy je za
  //      Ciebie"), with a "Zostań na stronie" way out for someone who isn't
  //      ready to save/share but still keeps the just-activated discount.
  // Desktop (mouseleave/blur below) and mobile (back-button/25s-timeout)
  // triggers are now both gated on enableRescueModal alone - unlike the old
  // +5% path, none of the three cases above need a real in-progress
  // configuration to make sense.
  const [promoExitModalOpen, setPromoExitModalOpen] = useState(false);
  const [promoExitAutoActivated, setPromoExitAutoActivated] = useState(false);
  const [promoExitQuoteCode, setPromoExitQuoteCode] = useState("");
  const [promoExitRemainingMs, setPromoExitRemainingMs] = useState(0);

  function openRescueModalOnce() {
    if (hasSeenRescueModal() || isRescueDismissedForGood()) return;

    const wasPromoActive = isPromoActive();
    if (wasPromoActive && hasSavedPromoLink()) {
      // Case 1: already has the discount and already saved/shared it.
      markRescueModalShown();
      return;
    }

    markRescueModalShown();
    if (!wasPromoActive) {
      // Case 3: turn it on for them now - the modal below frames this as
      // "we did it for you" instead of "you're about to lose it".
      activatePromoCode();
      // PromoCountdownBanner listens for this same activation and auto-opens
      // its OWN save/share modal ~1.2s later (see AUTO_OPEN_TRACK_KEY there)
      // - without marking it done here too, that fires right on top of the
      // modal this effect is about to open, stacking two save/share prompts
      // for the exact same activation.
      const activatedAt = getPromoActivatedAt();
      if (activatedAt !== null) {
        try {
          window.localStorage.setItem(AUTO_OPEN_TRACK_KEY, String(activatedAt));
        } catch {
          // localStorage niedostępny - baner i tak nie ma jak wtedy nic zapisać ani otworzyć drugi raz.
        }
      }
    }
    setPromoExitAutoActivated(!wasPromoActive);
    // Snapshot at the moment the exit-intent fires - this modal is a brief
    // interstitial, doesn't need to keep ticking live like the banner's own.
    setPromoExitRemainingMs(getPromoRemainingMs());
    void ensurePromoQuoteCode("moskitiery-ramkowe").then((state) => {
      if (state?.quoteCode) setPromoExitQuoteCode(state.quoteCode);
    });
    setPromoExitModalOpen(true);
  }

  function closePromoExitModal() {
    markRescueDismissedForGood();
    setPromoExitModalOpen(false);
  }

  // Desktop: cursor leaving toward the browser chrome (tabs/back/close
  // button), or the window simply losing focus (alt-tab, clicking the
  // taskbar, closing via the OS). `mouseleave` on <html> (not `mouseout` +
  // a clientY<=0 check on document, which this used to be) fires exactly
  // once when the pointer genuinely leaves the page - no dependency on
  // catching one specific bubbled event at one specific pixel, which real
  // browsers don't guarantee (fast mouse movement can skip straight from a
  // positive Y to "outside" without ever firing an event exactly at the
  // boundary - a real, documented limitation of the naive clientY check,
  // confirmed live: a real mouse-to-the-X-button close never triggered it,
  // even though a synthetic dispatchEvent test of the same code did).
  // `blur` is a second, independent signal for everything mouseleave can't
  // see (closing via taskbar/Alt+F4, switching windows without the cursor
  // visibly leaving first).
  useEffect(() => {
    if (!enableRescueModal) return;
    function handleLeaveSignal() {
      openRescueModalOnce();
    }
    document.documentElement.addEventListener("mouseleave", handleLeaveSignal);
    window.addEventListener("blur", handleLeaveSignal);
    return () => {
      document.documentElement.removeEventListener("mouseleave", handleLeaveSignal);
      window.removeEventListener("blur", handleLeaveSignal);
    };
  }, [enableRescueModal]);

  // Mobile: intercept the first back-button press instead of navigating
  // away - a dummy history entry is pushed unconditionally (see the block
  // comment above openRescueModalOnce() for why this no longer needs real
  // configuration progress), so the very next "back" lands on it (popstate)
  // rather than leaving the site.
  useEffect(() => {
    if (!enableRescueModal || hasSeenRescueModal() || isRescueDismissedForGood()) return;
    window.history.pushState({ rescueGuard: true }, "");
    function handlePopState() {
      openRescueModalOnce();
    }
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [enableRescueModal]);

  // Universal fallback: catches tab-close/app-switch on mobile, which
  // neither of the above can see - ~25s of no further interaction at all.
  // Still reset by configuration changes (deps below) so it never fires
  // mid-interaction, purely to avoid an awkwardly-timed popup.
  useEffect(() => {
    if (!enableRescueModal) return;
    const timer = window.setTimeout(() => openRescueModalOnce(), 25000);
    return () => window.clearTimeout(timer);
  }, [enableRescueModal, widthNum, heightNum, selectedHardwareId, selectedMeshId, quantityNum]);

  // Seasonal SEZON20 banner near the price - real discount math still comes
  // from the code, not a hardcoded "20%" here (see lib/promo.ts). Activating
  // it anywhere on the page (this panel's own banner, or the top-of-page
  // one in app/page.tsx) shows up here instantly via PROMO_ACTIVATED_EVENT,
  // not just after a remount - the two are separately-mounted siblings with
  // no parent/child relationship to pass state through otherwise. Once
  // activated, it's remembered (localStorage) so it's already applied by
  // the time the customer reaches checkout - koszyk/page.tsx reads the same
  // key on mount.
  const [promoPreview, setPromoPreview] = useState<PromoPreview | null>(null);
  const [promoActive, setPromoActive] = useState(false);

  useEffect(() => {
    setPromoActive(isPromoActive());
    const handleActivated = () => setPromoActive(isPromoActive());
    window.addEventListener(PROMO_ACTIVATED_EVENT, handleActivated);
    return () => window.removeEventListener(PROMO_ACTIVATED_EVENT, handleActivated);
  }, []);

  useEffect(() => {
    if (dimensionTotalPrice === null || dimensionTotalPrice <= 0) {
      setPromoPreview(null);
      return;
    }
    let cancelled = false;
    fetchPromoPreview(dimensionTotalPrice).then((preview) => {
      if (!cancelled) setPromoPreview(preview);
    });
    return () => {
      cancelled = true;
    };
  }, [dimensionTotalPrice]);

  function activatePromo() {
    if (!promoPreview) return;
    setPromoActive(true);
    activatePromoCode();
    trackShopStep("promo_code_activated", PROMO_CODE, { amount: promoPreview.amount });
  }

  const promoDiscountedTotal =
    promoActive && dimensionTotalPrice !== null ? applyPromoToPrice(dimensionTotalPrice, promoPreview) : null;

  // "Zapas" upsell nudge - same mechanism as the Allegro configurator's own
  // savings messaging (see moskLeftoverCapacity()'s doc comment). Uses
  // whatever per-mb rate is actually in effect right now (SEZON20-adjusted
  // when active) so the zł figure shown matches what a second item would
  // really cost. Gated on MIN_WORTHWHILE_LEFTOVER_SAVINGS_ZL, not "does a
  // whole extra frame fit" - owner's call 2026-09-08: billing is per
  // started meter regardless of size (a 501 cm perimeter still bills 6 m),
  // so even a partial leftover genuinely reduces what a second, smaller
  // frame would cost - the only real question is whether the zł figure is
  // big enough to be worth mentioning.
  const effectivePricePerMb =
    promoActive && promoPreview
      ? applyPromoToPrice(MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO, promoPreview) ?? MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO
      : MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO;
  const leftoverCapacity =
    perimeterMeters !== null && billedMeters !== null
      ? moskLeftoverCapacity(perimeterMeters, billedMeters, effectivePricePerMb)
      : null;
  const showLeftoverHint =
    leftoverCapacity !== null && leftoverCapacity.leftoverValue >= MIN_WORTHWHILE_LEFTOVER_SAVINGS_ZL;

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
    trackShopStep("enter_dimensions", "moskitiery-ramkowe", { width_mm: widthNum, height_mm: heightNum, qty: quantityNum });
    if (widthNum > OVERSIZE_TECHNICAL_LIMIT_MM && heightNum > OVERSIZE_TECHNICAL_LIMIT_MM) {
      trackShopStep("dimensions_over_limit", "moskitiery-ramkowe", { width_mm: widthNum, height_mm: heightNum });
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
    trackShopStep("surcharge_accepted", "moskitiery-ramkowe", { amount: surchargeModal.amount, width_mm: widthNum, height_mm: heightNum });
    setAcceptedSurcharge({ width: widthNum, height: heightNum, amount: surchargeModal.amount });
    setSurchargeModal(null);
  }

  function handleDeclineSurcharge() {
    // A real "co ich zniechęca" moment - shown a price they weren't
    // expecting, they backed out of the oversized dimensions instead of
    // paying the surcharge.
    trackShopStep("surcharge_declined", "moskitiery-ramkowe", { amount: surchargeModal?.amount ?? 0, width_mm: widthNum, height_mm: heightNum });
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
        <strong>Wyceń swoją moskitierę</strong>
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
                      trackShopStep("select_hardware_color", option.label, { option_id: option.id });
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
              onClick={() => {
                trackShopStep("configurator_step_toggle", "mesh_color", { collapsed_after: !stepTwoCollapsed });
                setStepTwoCollapsed((prev) => !prev);
              }}
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
                        trackShopStep("select_mesh_color", option.label, { option_id: option.id });
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
              {onOpenInstructions ? (
                <button
                  type="button"
                  className="hero-product-dimensions-help-cta"
                  onClick={(event) => {
                    event.preventDefault();
                    trackShopStep("open_modal", "measurement_instructions", { product_slug: "moskitiery-ramkowe" });
                    onOpenInstructions();
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z" stroke="currentColor" strokeWidth="2" />
                    <path d="M12 17v-5M12 8h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  <span>
                    <strong>Nie wiesz jak zmierzyć?</strong>
                    Zobacz krótką instrukcję — i poproś nas o pomoc, jeśli okno jest nietypowe
                  </span>
                  <span className="hero-product-dimensions-help-cta-arrow" aria-hidden="true">›</span>
                </button>
              ) : null}
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
                      {promoActive && promoPreview ? (
                        <>
                          <span className="price-per-mb-standard">
                            {MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                          </span>
                          <span className="price-per-mb-promo pl-price-sezon-active">
                            {applyPromoToPrice(MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO, promoPreview)!.toLocaleString(
                              "pl-PL",
                              { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                            )}{" "}
                            zł
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="price-per-mb-promo">
                            {MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                          </span>
                          {MOSKITIERY_RAMKOWE_PRICE_ON_PROMO ? (
                            <span className="price-per-mb-standard">
                              {MOSKITIERY_RAMKOWE_PRICE_PER_MB_STANDARD.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                            </span>
                          ) : null}
                        </>
                      )}
                    </dd>
                  </div>
                </div>
                <div className="hero-product-mini-summary-price-final">
                  {promoDiscountedTotal !== null && !isCalculatingPrice ? (
                    <span className="price-final-original">
                      {dimensionTotalPrice!.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                    </span>
                  ) : null}
                  <strong className={isCalculatingPrice ? "is-calculating" : ""}>
                    {isCalculatingPrice
                      ? "Obliczam…"
                      : promoDiscountedTotal !== null
                        ? `${promoDiscountedTotal.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                        : dimensionTotalPrice !== null
                          ? `${dimensionTotalPrice.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                          : "Podaj wymiary"}
                  </strong>
                </div>
              </div>
              {showLeftoverHint ? (
                <div className="leftover-savings-banner">
                  <span className="leftover-savings-banner-icon" aria-hidden="true">
                    🧵
                  </span>
                  <p className="leftover-savings-banner-text">
                    Skonfiguruj kolejną moskitierę i zaoszczędź{" "}
                    <strong>
                      {leftoverCapacity!.leftoverValue.toLocaleString("pl-PL", {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}{" "}
                      zł
                    </strong>
                    , wykorzystując pozostały obwód (
                    {leftoverCapacity!.leftoverMeters.toLocaleString("pl-PL", {
                      minimumFractionDigits: 2,
                      maximumFractionDigits: 2,
                    })}{" "}
                    m).
                  </p>
                  <button
                    type="button"
                    className="leftover-savings-info-button"
                    onClick={() => {
                      trackShopStep("open_modal", "leftover_savings_info", { product_slug: "moskitiery-ramkowe" });
                      setLeftoverInfoOpen(true);
                    }}
                    aria-label="Zobacz, jak liczymy oszczędność"
                    title="Zobacz, jak liczymy oszczędność"
                  >
                    i
                  </button>
                </div>
              ) : null}
              {leftoverInfoOpen && leftoverCapacity ? (
                <div
                  className="leftover-savings-info-modal"
                  role="dialog"
                  aria-modal="true"
                  aria-label="Jak liczymy oszczędność"
                  onClick={() => setLeftoverInfoOpen(false)}
                >
                  <div className="leftover-savings-info-modal-shell" onClick={(event) => event.stopPropagation()}>
                    <button
                      type="button"
                      className="leftover-savings-info-modal-close"
                      onClick={() => setLeftoverInfoOpen(false)}
                      aria-label="Zamknij"
                    >
                      ✕
                    </button>
                    <h3>Skąd bierze się oszczędność?</h3>
                    <p>
                      Moskitiery rozliczamy za każdy <strong>rozpoczęty metr bieżący</strong> obwodu. Przy obwodzie{" "}
                      {(perimeterMeters ?? 0).toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}{" "}
                      m płacisz za pełne <strong>{billedMeters} m</strong> - zostaje Ci{" "}
                      <strong>
                        {leftoverCapacity.leftoverMeters.toLocaleString("pl-PL", {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2,
                        })}{" "}
                        m
                      </strong>{" "}
                      już opłaconego obwodu.
                    </p>
                    <p>
                      Skonfiguruj kolejną moskitierę i wykorzystaj niewykorzystany obwód - koszyk automatycznie
                      policzy wspólne rozliczenie obwodu wszystkich moskitier w zamówieniu i naliczy realną zniżkę
                      przy podsumowaniu.
                    </p>
                    <button
                      type="button"
                      className="leftover-savings-info-modal-cta"
                      onClick={() => setLeftoverInfoOpen(false)}
                    >
                      Rozumiem
                    </button>
                  </div>
                </div>
              ) : null}
              {promoPreview ? (
                <PromoCountdownBanner code={PROMO_CODE} productSlug="moskitiery-ramkowe">
                  {(promo) => (
                    <div className={`hero-product-promo-banner ${promoActive ? "is-active" : ""}`}>
                      {promoActive ? (
                        <>
                          <span className="hero-product-promo-banner-text">
                            {promo ? (
                              <>
                                ✓ Kod <strong>{PROMO_CODE}</strong> aktywny - ważny jeszcze <strong>{promo.remainingText}</strong>.
                              </>
                            ) : (
                              <>
                                ✓ Kod <strong>{PROMO_CODE}</strong> aktywny - rabat naliczy się automatycznie w koszyku.
                              </>
                            )}
                          </span>
                          {promo ? (
                            <button type="button" className="hero-product-promo-banner-cta" onClick={promo.openModal}>
                              Zapisz link
                            </button>
                          ) : null}
                        </>
                      ) : (
                        <>
                          <span className="hero-product-promo-banner-text">
                            🔥 <strong>-20%</strong> z kodem <strong>{PROMO_CODE}</strong>
                          </span>
                          <button type="button" className="hero-product-promo-banner-cta" onClick={activatePromo}>
                            Aktywuj rabat
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </PromoCountdownBanner>
              ) : null}
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

      {promoExitModalOpen ? (
        // PromoSaveModal self-portals straight to document.body (same as
        // save-share-widget.tsx's own modal) - no MobileOverlayPortal needed.
        <PromoSaveModal
          quoteCode={promoExitQuoteCode}
          remainingMs={promoExitRemainingMs}
          variant={promoExitAutoActivated ? "activated" : "reminder"}
          shareUrl={
            promoExitQuoteCode
              ? `https://sklep.keika.pl/wizyta/${encodeURIComponent(promoExitQuoteCode)}`
              : "https://sklep.keika.pl/"
          }
          onClose={closePromoExitModal}
        />
      ) : null}

      {enableSaveShareBanner ? (
        <SaveShareWidget
          headerSlotId="header-save-share-slot"
          productSlug="moskitiery-ramkowe"
          productLabel="Moskitiery ramkowe"
          priceLine={
            dimensionTotalPrice !== null
              ? `, ${dimensionTotalPrice.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
              : ""
          }
          buildPosition={() =>
            selectedHardwareOption && selectedMesh && dimensionTotalPrice !== null
              ? buildRescuePosition({
                  productSlug: "moskitiery-ramkowe",
                  productLabel: "Moskitiery ramkowe",
                  hardwareLabel: selectedHardwareOption.label || "",
                  meshLabel: selectedMesh.label || "",
                  widthMm: widthNum,
                  heightMm: heightNum,
                  qty: quantityNum,
                  total: dimensionTotalPrice,
                })
              : null
          }
        />
      ) : null}
    </>
  );
}
