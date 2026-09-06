"use client";

// "Kup w ciągu 24h albo rabat SEZON20 przepada" - shown wherever the promo
// is already displayed as active (see call sites: app/page.tsx's top
// banner, features/moskitiery-ramkowe/ConfiguratorPanel.tsx's own promo
// banner, app/koszyk/page.tsx's applied-discount row). Self-contained by
// design (own isPromoActive()/event listening) so it can be dropped in at
// each of those spots without threading extra props through - matches how
// SaveShareWidget stays self-contained too.
import { useEffect, useState } from "react";
import {
  PROMO_ACTIVATED_EVENT,
  getPromoDeadlineAtMs,
  isPromoActive,
} from "@/lib/promo";
import { ensurePromoQuoteCode } from "@/lib/promo-save";
import PromoSaveModal from "./promo-save-modal";

function formatRemaining(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours} godz. ${minutes} min`;
  return `${minutes} min`;
}

export default function PromoCountdownBanner({ code }: { code: string }) {
  const [deadlineAtMs, setDeadlineAtMs] = useState<number | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);
  const [modalOpen, setModalOpen] = useState(false);
  const [quoteCode, setQuoteCode] = useState("");

  useEffect(() => {
    function sync() {
      setDeadlineAtMs(isPromoActive(code) ? getPromoDeadlineAtMs() : null);
    }
    sync();
    window.addEventListener(PROMO_ACTIVATED_EVENT, sync);
    return () => window.removeEventListener(PROMO_ACTIVATED_EVENT, sync);
  }, [code]);

  // Ensure a real, short quote_code exists for this activation the moment
  // this banner is actually shown - not gated on the customer clicking
  // anything or having configured a product yet (explicit requirement:
  // every customer who activates the code gets one).
  useEffect(() => {
    if (deadlineAtMs === null) return;
    let cancelled = false;
    void ensurePromoQuoteCode().then((state) => {
      if (!cancelled && state?.quoteCode) setQuoteCode(state.quoteCode);
    });
    return () => {
      cancelled = true;
    };
  }, [deadlineAtMs]);

  useEffect(() => {
    if (deadlineAtMs === null) {
      setRemainingMs(0);
      return;
    }
    function tick() {
      setRemainingMs(Math.max(0, (deadlineAtMs as number) - Date.now()));
    }
    tick();
    // Once-a-minute is plenty for a minute-granularity display and keeps
    // this from being the one thing on the page re-rendering every second.
    const interval = window.setInterval(tick, 30000);
    return () => window.clearInterval(interval);
  }, [deadlineAtMs]);

  if (deadlineAtMs === null || remainingMs <= 0) return null;

  const shareUrl = quoteCode ? `https://sklep.keika.pl/wycena/${encodeURIComponent(quoteCode)}` : "https://sklep.keika.pl/";

  return (
    <>
      <div className="promo-countdown-banner" role="status">
        <span className="promo-countdown-banner-text">
          Twój rabat <strong>{code}</strong> ważny jeszcze <strong>{formatRemaining(remainingMs)}</strong>. Zapisz lub
          udostępnij tę stronę, aby wrócić do niej na dowolnym urządzeniu i skorzystać z promocji zanim przepadnie.
        </span>
        <button type="button" className="promo-countdown-banner-cta" onClick={() => setModalOpen(true)}>
          Zapisz / wyślij link
        </button>
      </div>
      {modalOpen ? (
        <PromoSaveModal quoteCode={quoteCode} shareUrl={shareUrl} onClose={() => setModalOpen(false)} />
      ) : null}
    </>
  );
}
