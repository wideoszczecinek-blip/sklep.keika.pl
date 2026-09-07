"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { addCartItem, findEquivalentCartItem, readCartItems } from "@/lib/cart";
import { activatePromoCode, syncPromoDeadlineFromServer } from "@/lib/promo";
import { markPromoLinkSaved, trackPromoQuote } from "@/lib/promo-save";
import { mapQuoteToResumeState, setRescueGrant } from "@/lib/rescue";
import type { SavedQuote } from "@/features/moskitiery/types";

// Only moskitiery-ramkowe is reachable via normal navigation right now
// (lib/product-availability.ts) - a quote saved before any product was
// picked (the SEZON20 banner's own promo-only quotes) carries the generic
// "produkt" placeholder slug instead of a real one, so this is where that
// gets resolved to somewhere the customer can actually land on.
const FALLBACK_PRODUCT_SLUG = "moskitiery-ramkowe";

export default function VisitResume({ quote }: { quote: SavedQuote }) {
  const router = useRouter();

  useEffect(() => {
    const resolved = mapQuoteToResumeState(quote);

    const slug =
      resolved.productSlug && resolved.productSlug !== "produkt" ? resolved.productSlug : FALLBACK_PRODUCT_SLUG;

    // Adopt this same quote_code for every future save this device makes
    // (cart changes, another promo touch, ...) - without this, the SAME
    // saved link a customer already has stops updating the moment they add
    // or change anything, because the countdown banner remounting on the
    // destination page would otherwise silently start a second, unrelated
    // row instead of continuing this one. Must run before router.replace()
    // below mounts that banner.
    if (resolved.quoteCode) {
      trackPromoQuote(resolved.quoteCode, slug);
    }

    if (resolved.items.length > 0) {
      let items = readCartItems();
      for (const item of resolved.items) {
        if (findEquivalentCartItem(items, item)) continue;
        items = addCartItem(item);
      }
      if (resolved.rescueDiscountPercent > 0) {
        setRescueGrant({ quoteCode: resolved.quoteCode, percent: resolved.rescueDiscountPercent });
      }
    }

    if (resolved.promoCode) {
      activatePromoCode(resolved.promoCode);
      if (typeof resolved.promoDeadlineAtMs === "number") {
        syncPromoDeadlineFromServer(resolved.promoDeadlineAtMs);
      }
      // This device just arrived *from* a saved link - showing it another
      // "save your link" prompt immediately would be redundant. Only when
      // there's actually a promo to suppress the nag for.
      markPromoLinkSaved();
    }

    router.replace(`/?produkt=${encodeURIComponent(slug)}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main
      style={{
        minHeight: "60vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        textAlign: "center",
        padding: "2rem",
        color: "var(--ink-soft, #5b6472)",
        fontSize: "0.95rem",
      }}
    >
      Wracamy do miejsca, w którym skończyłeś…
    </main>
  );
}
