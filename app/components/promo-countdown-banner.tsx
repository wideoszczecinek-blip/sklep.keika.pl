"use client";

// "Kup w ciągu 24h albo rabat SEZON20 przepada" - the countdown text + CTA
// live INSIDE each call site's own "aktywny" banner now (app/page.tsx's
// .pl-sezon-banner, features/moskitiery-ramkowe/ConfiguratorPanel.tsx's own
// .hero-product-promo-banner), not as a separate boxed banner underneath -
// live feedback 2026-09-06: two stacked green/blue banners read as
// redundant and buried the actual countdown. This component owns the state
// (countdown tick, quote_code, the modal) and hands it to the caller via a
// render-prop so each caller can slot the text/CTA into its own markup -
// same reasoning SaveShareWidget stays self-contained for, just without
// owning its own box anymore. Passing `null` to children while there's no
// deadline lets each caller fall back to its own default copy.
import { useEffect, useRef, useState } from "react";
import {
  PROMO_ACTIVATED_EVENT,
  activatePromoCode,
  formatPromoRemaining,
  getPromoActivatedAt,
  getPromoDeadlineAtMs,
  isPromoActive,
} from "@/lib/promo";
import { ensurePromoQuoteCode, hasSavedPromoLink } from "@/lib/promo-save";
import PromoSaveModal from "./promo-save-modal";

// Fired right as the first-visit "announcement" modal closes (see
// AUTO_OPEN_DELAY_MS below) - save-share-widget.tsx listens for this and
// shakes the actual header button, so there's exactly one thing telling a
// brand-new visitor where to go save/share, not a second competing prompt
// inside the modal itself.
export const ATTRACT_SAVE_SHARE_EVENT = "keika:attract-save-share";

// Module-level, not per-instance: this component mounts twice on the
// moskitiery-ramkowe product view (app/page.tsx's own banner AND
// ConfiguratorPanel's own banner, same activation, two separate component
// instances) - whichever instance's effect actually performs a fresh
// first-visit activation records it here, so whichever instance ends up
// winning the auto-open race below (see AUTO_OPEN_CLAIM_KEY) still knows to
// show the "announcement" variant instead of the plain "reminder" one.
let freshlyAutoActivatedAtMs: number | null = null;

// Cross-instance claim for the auto-open timer - sessionStorage, checked
// AND written synchronously inside the effect body (not inside the
// setTimeout), so when both banner instances' effects run back-to-back in
// the same commit, the second one sees the claim the first just made and
// never also schedules its own timer for the same activation. Separate
// from AUTO_OPEN_TRACK_KEY (localStorage, written only once the modal
// actually opens) - that one dedupes *across page loads/sessions*, this one
// dedupes *within the same page load* between sibling instances.
const AUTO_OPEN_CLAIM_KEY = "keika_shop_promo_auto_modal_claim";

// Priorytet: konwersje - klient widzi opcje zapisania linku od razu po
// aktywacji, zanim zdąży się rozproszyć, zamiast czekać aż zauważy mały
// przycisk CTA. Tylko raz na aktywację (keika_shop_promo_auto_modal_at
// poniżej), nigdy gdy link już zapisany.
const AUTO_OPEN_DELAY_MS = 1200;
// Exported so a caller that already shows its OWN "you've got the discount,
// save it" prompt for a given activation (the exit-intent modal in
// features/moskitiery-ramkowe/ConfiguratorPanel.tsx, when it activates
// SEZON20 for a visitor who never had) can mark that activation as already
// handled - otherwise this banner's own auto-open below fires 1200ms later
// for the exact same activation, stacking a second, redundant modal on top.
export const AUTO_OPEN_TRACK_KEY = "keika_shop_promo_auto_modal_at";

export type PromoCountdownState = {
  remainingMs: number;
  remainingText: string;
  openModal: () => void;
};

export default function PromoCountdownBanner({
  code,
  productSlug,
  children,
}: {
  code: string;
  /** Which product page /wycena/<code> should send the customer back to -
   * see ensurePromoQuoteCode()'s own doc comment (lib/promo-save.ts). */
  productSlug: string;
  /** null while there's no active/tracked deadline - render your own
   * fallback copy (e.g. the plain "Widzisz ceny z rabatem" line) then. */
  children: (state: PromoCountdownState | null) => React.ReactNode;
}) {
  const [deadlineAtMs, setDeadlineAtMs] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalVariant, setModalVariant] = useState<"reminder" | "announcement">("reminder");
  const [quoteCode, setQuoteCode] = useState("");
  const autoOpenArmedRef = useRef(false);

  // Re-touches the quote (fresh cart snapshot - see ensurePromoQuoteCode()'s
  // own doc comment) right as the save modal is actually about to be shown,
  // not just relying on whatever the mount-time ensure-call above caught -
  // a customer who adds items to cart *between* the banner mounting and
  // clicking "Zapisz link" should still get them back via the saved link.
  function openModal(variant: "reminder" | "announcement" = "reminder") {
    void ensurePromoQuoteCode(productSlug).then((state) => {
      if (state?.quoteCode) setQuoteCode(state.quoteCode);
    });
    setModalVariant(variant);
    setModalOpen(true);
  }

  // First-time-visitor auto-activation: owner decision 2026-09-08 - every
  // new visitor gets SEZON20 turned on automatically (no more "Aktywuj
  // rabat -20%" click required to see it), announced via the auto-open
  // modal below. getPromoActivatedAt() !== null covers BOTH "already
  // active" and "activated before, deadline since lapsed" - either way this
  // is a returning browser, not a first-time visitor, so it's never
  // touched (mirrors activatePromoCode()'s own never-restamp guard).
  useEffect(() => {
    if (getPromoActivatedAt() !== null) return;
    activatePromoCode(code);
    freshlyAutoActivatedAtMs = getPromoActivatedAt();
  }, [code]);

  useEffect(() => {
    function sync() {
      setDeadlineAtMs(isPromoActive(code) ? getPromoDeadlineAtMs() : null);
    }
    sync();
    window.addEventListener(PROMO_ACTIVATED_EVENT, sync);
    return () => window.removeEventListener(PROMO_ACTIVATED_EVENT, sync);
  }, [code]);

  // Ensure a real, short quote_code exists for this activation - not gated
  // on the customer configuring a product yet (every activation gets one).
  useEffect(() => {
    if (deadlineAtMs === null) return;
    let cancelled = false;
    void ensurePromoQuoteCode(productSlug).then((state) => {
      if (!cancelled && state?.quoteCode) setQuoteCode(state.quoteCode);
    });
    return () => {
      cancelled = true;
    };
  }, [deadlineAtMs, productSlug]);

  useEffect(() => {
    if (deadlineAtMs === null) {
      setRemainingMs(0);
      return;
    }
    function tick() {
      setRemainingMs(Math.max(0, (deadlineAtMs as number) - Date.now()));
    }
    tick();
    const interval = window.setInterval(tick, 30000);
    return () => window.clearInterval(interval);
  }, [deadlineAtMs]);

  useEffect(() => {
    if (deadlineAtMs === null || autoOpenArmedRef.current) return;
    if (hasSavedPromoLink()) return;
    const activatedAt = getPromoActivatedAt();
    if (activatedAt === null) return;
    let alreadyShownFor = "";
    try {
      alreadyShownFor = window.localStorage.getItem(AUTO_OPEN_TRACK_KEY) || "";
    } catch {
      // localStorage niedostępny - auto-otwarcie po prostu może się powtórzyć, nic więcej się nie stanie.
    }
    if (alreadyShownFor === String(activatedAt)) return;
    // Claim this activation synchronously (sessionStorage, not inside the
    // timeout below) - on the product view, app/page.tsx's own banner and
    // ConfiguratorPanel's own banner both mount this component for the same
    // activation; their effects run back-to-back in the same commit, so
    // whichever runs second sees the claim the first just made and skips
    // scheduling a second, redundant timer/modal for it.
    let alreadyClaimedBy = "";
    try {
      alreadyClaimedBy = window.sessionStorage.getItem(AUTO_OPEN_CLAIM_KEY) || "";
    } catch {
      // sessionStorage niedostępny - w najgorszym razie oba banery zaplanują otwarcie, jak dawniej.
    }
    if (alreadyClaimedBy === String(activatedAt)) {
      autoOpenArmedRef.current = true;
      return;
    }
    try {
      window.sessionStorage.setItem(AUTO_OPEN_CLAIM_KEY, String(activatedAt));
    } catch {
      // jak wyżej
    }
    autoOpenArmedRef.current = true;
    const variant = activatedAt === freshlyAutoActivatedAtMs ? "announcement" : "reminder";
    const timer = window.setTimeout(() => {
      try {
        window.localStorage.setItem(AUTO_OPEN_TRACK_KEY, String(activatedAt));
      } catch {
        // jak wyżej
      }
      openModal(variant);
    }, AUTO_OPEN_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [deadlineAtMs]);

  if (deadlineAtMs === null || remainingMs <= 0) return <>{children(null)}</>;

  // /wizyta/ (not /wycena/) - resumes the whole visit (cart, discounts,
  // right product page) on whichever device opens it, see that route's own
  // top comment for why it's a separate concept from the quote summary.
  const shareUrl = quoteCode ? `https://sklep.keika.pl/wizyta/${encodeURIComponent(quoteCode)}` : "https://sklep.keika.pl/";

  return (
    <>
      {children({ remainingMs, remainingText: formatPromoRemaining(remainingMs), openModal })}
      {modalOpen ? (
        <PromoSaveModal
          quoteCode={quoteCode}
          shareUrl={shareUrl}
          remainingMs={remainingMs}
          variant={modalVariant}
          onClose={() => {
            setModalOpen(false);
            if (modalVariant === "announcement") {
              try {
                window.dispatchEvent(new CustomEvent(ATTRACT_SAVE_SHARE_EVENT));
              } catch {
                // CustomEvent niedostępny (bardzo stara przeglądarka) - przycisk po prostu nie "zatrzęsie się", nic więcej.
              }
            }
          }}
        />
      ) : null}
    </>
  );
}
