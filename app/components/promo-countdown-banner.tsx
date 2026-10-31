"use client";

// "Kup w ciągu 24h albo rabat SEZON20 przepada" - the countdown text + CTA
// live INSIDE each call site's own "aktywny" banner now (app/page.tsx's
// .pl-sezon-banner, features/moskitiery-ramkowe/ConfiguratorPanel.tsx's own
// .hero-product-promo-banner, app/components/promo-top-strip.tsx), not as a
// separate boxed banner underneath - live feedback 2026-09-06: two stacked
// green/blue banners read as redundant and buried the actual countdown.
// This component owns the state (countdown tick, quote_code, the modal) and
// hands it to the caller via a render-prop so each caller can slot the
// text/CTA into its own markup - same reasoning SaveShareWidget stays
// self-contained for, just without owning its own box anymore. Passing
// `null` to children while there's no deadline lets each caller fall back
// to its own default copy.
//
// Audit 2026-09-13: the automatic first-visit "announcement" modal that
// used to open ~1.2 s after activation is gone. It fired before the visitor
// had read a single line, stacked with the exit-intent modal, and in 12
// days of live data produced zero SMS/e-mail saves. The auto-activation of
// the code itself stays (owner decision 2026-09-08); the always-visible
// countdown strip (promo-top-strip.tsx) took over the "you have a running
// discount" job. The modal is still reachable on purpose via openModal
// (the "Zapisz link" CTAs).
import { useEffect, useState } from "react";
import { calcBundleDiscount, useBundleDiscountRules, type BundleRule } from "@/lib/bundle-discount";
import { calcMoskitieryCombinedSavings, roundMoney, type CartLineItem } from "@/lib/cart";
import {
  PROMO_ACTIVATED_EVENT,
  QTY_PROMO,
  activatePromoCode,
  formatPromoRemaining,
  getPromoActivatedAt,
  getPromoDeadlineAtMs,
  isPromoActive,
} from "@/lib/promo";
import { ensurePromoQuoteCode } from "@/lib/promo-save";
import PromoSaveModal from "./promo-save-modal";

// Still exported: save-share-widget.tsx listens for it. Nothing dispatches
// it any more (the announcement modal that did is gone) - kept so that
// listener needs no change and a future caller can reuse it.
export const ATTRACT_SAVE_SHARE_EVENT = "keika:attract-save-share";

// Kept for ConfiguratorPanel's historical import sites / future reuse - the
// auto-open timer that wrote it no longer exists.
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
  const [quoteCode, setQuoteCode] = useState("");

  // Re-touches the quote (fresh cart snapshot - see ensurePromoQuoteCode()'s
  // own doc comment) right as the save modal is actually about to be shown,
  // not just relying on whatever the mount-time ensure-call above caught -
  // a customer who adds items to cart *between* the banner mounting and
  // clicking "Zapisz link" should still get them back via the saved link.
  function openModal() {
    void ensurePromoQuoteCode(productSlug).then((state) => {
      if (state?.quoteCode) setQuoteCode(state.quoteCode);
    });
    setModalOpen(true);
  }

  // First-time-visitor auto-activation: owner decision 2026-09-08 - every
  // new visitor gets SEZON20 turned on automatically (no "Aktywuj rabat
  // -20%" click required to see it). getPromoActivatedAt() !== null covers
  // BOTH "already active" and "activated before, deadline since lapsed" -
  // either way this is a returning browser, not a first-time visitor, so
  // it's never touched (mirrors activatePromoCode()'s own never-restamp
  // guard).
  useEffect(() => {
    if (getPromoActivatedAt() !== null) return;
    activatePromoCode(code);
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
          variant="reminder"
          onClose={() => setModalOpen(false)}
        />
      ) : null}
    </>
  );
}

function formatTileZl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

/** Zapas, gdy reguły z CRM jeszcze nie doszły (strona bez homepage_public). */
const QTY_PROMO_FALLBACK_RULE: BundleRule = {
  fromQty: QTY_PROMO.tiers[0].fromQty,
  percent: QTY_PROMO.tiers[0].percent,
  tiers: QTY_PROMO.tiers.map((t) => ({ ...t })),
  group: "caly-dom",
  wholeOrder: true,
  label: "",
};

/** Kafle promocji ilościowej „CAŁY DOM" przy cenie konfiguratora (właściciel
 * 31.10.2026: „ceny promocyjne powinny być też eksponowane"): cena za sztukę
 * przy 1 szt. i przy każdym progu. Liczone tym samym calcBundleDiscount() co
 * koszyk (i CRM), z regułą produktu z config.bundle_discounts - produkt bez
 * reguły w CRM nie dostaje kafli. `total` = cena bieżącej konfiguracji,
 * `units` = ile sztuk w niej jest (koszyk liczy rabat od sztuk). Wymiary
 * tylko dla moskitier - koszyk łączy ich obwody przed rabatem. Tu, a nie w
 * osobnym pliku: ten plik kopiuje też sklep Oknowo (npm run sync). */
export function QtyPromoTiers({
  productSlug,
  total,
  units = 1,
  from = false,
  widthMm = 0,
  heightMm = 0,
}: {
  productSlug: string;
  total: number | null;
  units?: number;
  /** Cena „od" (np. najtańsza kolekcja przed wyborem tkaniny). */
  from?: boolean;
  widthMm?: number;
  heightMm?: number;
}) {
  const rules = useBundleDiscountRules();
  const rule = Object.keys(rules).length ? rules[productSlug] : QTY_PROMO_FALLBACK_RULE;
  const count = Math.max(1, Math.round(units || 1));
  if (!rule || !rule.tiers.length || total === null || !Number.isFinite(total) || total <= 0) return null;
  const unit = total / count;
  const priceFor = (qty: number) => {
    const item: CartLineItem = {
      id: "qty-promo",
      productSlug,
      productLabel: "",
      hardwareLabel: "",
      meshLabel: "",
      widthMm,
      heightMm,
      qty,
      price: unit,
      total: unit * qty,
      createdAt: "",
    };
    const perimeter = productSlug === "moskitiery-ramkowe" && widthMm > 0 && heightMm > 0 ? calcMoskitieryCombinedSavings([item]) : 0;
    const bundle = calcBundleDiscount([item], { [productSlug]: rule }, perimeter);
    return roundMoney((unit * qty - perimeter - bundle.savings) / qty);
  };
  const last = rule.tiers[rule.tiers.length - 1];
  const tiles = [
    { key: "1", label: "1 szt.", percent: 0, price: roundMoney(unit) },
    ...rule.tiers.map((t) => ({
      key: String(t.fromQty),
      label: t === last ? `${t.fromQty}+ szt.` : `${t.fromQty} szt.`,
      percent: t.percent,
      price: priceFor(t.fromQty),
    })),
  ];
  const pooled = rule.wholeOrder && rule.group !== "";
  return (
    <div className="qty-promo">
      <div className="qty-promo-head">
        <span className="qty-promo-badge">-{last.percent}%</span>
        <span>
          Promocja <strong>{QTY_PROMO.name}</strong> – im więcej okien, tym taniej
        </span>
      </div>
      <div className="qty-promo-tiles">
        {tiles.map((tile, i) => (
          <span key={tile.key} className={`qty-promo-tile${i === tiles.length - 1 ? " is-best" : ""}`}>
            <span className="qty-promo-tile-label">
              {tile.label}
              {tile.percent > 0 ? <em>-{tile.percent} %</em> : null}
            </span>
            <strong>{formatTileZl(tile.price)}</strong>
            <small>{from ? "od · za szt." : "za szt."}</small>
          </span>
        ))}
      </div>
      <p className="qty-promo-foot">
        {pooled ? "Rabat liczy się od całego koszyka, także przy różnych produktach." : "Rabat naliczy się w koszyku."}{" "}
        <a href={QTY_PROMO.rulesHref}>Zasady</a>
      </p>
    </div>
  );
}
