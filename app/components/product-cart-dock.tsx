"use client";

// Stały pasek koszyka na stronie produktu (właściciel, 2026-10-01).
//
// Analiza 16-30.09: 88 z 308 sesji, które dodały produkt do koszyka, nigdy
// nie otworzyły koszyka. Po dodaniu pokazuje się okienko z trzema
// przyciskami; kto je zamknął albo wybrał "Wyceń nową", tracił ścieżkę -
// na stronie produktu nie było żadnego stałego "masz pozycję w koszyku".
// Licznik w nagłówku jest mały i w rogu.
//
// Widoczny, gdy koszyk ma pozycje i nie ma otwartego okienka "Dodano do
// koszyka" (to ma własny przycisk). Telefon: pełna szerokość przy dolnej
// krawędzi, w tym samym stylu co pasek "Razem" w koszyku - klient widzi
// ten sam element po obu stronach. Komputer/tablet: zwarta karta w prawym
// dolnym rogu, nad paskiem sekcji produktu.
import { useEffect, useRef, type CSSProperties } from "react";
import { formatPln } from "@/lib/cart";
import { trackShopStep } from "@/lib/track-step";

function positionsLabel(count: number): string {
  if (count === 1) return "pozycja";
  const last = count % 10;
  const lastTwo = count % 100;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? "pozycje" : "pozycji";
}

export default function ProductCartDock({
  visible,
  count,
  total,
  productSlug,
  inAppBottomInset = 0,
}: {
  visible: boolean;
  count: number;
  /** Kwota, którą klient zobaczy w koszyku (po aktywnym rabacie). */
  total: number;
  productSlug: string;
  /** Dolny pasek przeglądarki w aplikacji Facebooka/Instagrama zasłania
   * spód okna - ten sam odstęp, którego używa pasek sekcji produktu. */
  inAppBottomInset?: number;
}) {
  const shownRef = useRef(false);
  useEffect(() => {
    if (!visible || shownRef.current) return;
    shownRef.current = true;
    trackShopStep("cart_dock_shown", productSlug, { items: count, total });
  }, [visible, productSlug, count, total]);

  const style = { "--dock-inapp-inset": `${Math.max(0, inAppBottomInset)}px` } as CSSProperties;

  return (
    <div className={`product-cart-dock ${visible ? "is-visible" : ""}`} style={style} aria-hidden={visible ? undefined : true}>
      <a
        href="/koszyk"
        className="product-cart-dock-link"
        tabIndex={visible ? undefined : -1}
        aria-label={`Przejdź do koszyka: ${count} ${positionsLabel(count)}, ${formatPln(total)}`}
        onClick={() => trackShopStep("cart_dock_click", productSlug, { items: count, total })}
      >
        <span className="product-cart-dock-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path
              d="M3 4h2l1.6 9.6a2 2 0 0 0 2 1.65h8.2a2 2 0 0 0 1.96-1.6L20 8H6"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="9" cy="19.5" r="1.4" fill="currentColor" />
            <circle cx="17" cy="19.5" r="1.4" fill="currentColor" />
          </svg>
          <span className="product-cart-dock-badge">{count}</span>
        </span>
        <span className="product-cart-dock-copy">
          <small>
            W koszyku {count} {positionsLabel(count)}
          </small>
          <strong>{formatPln(total)}</strong>
        </span>
        <span className="product-cart-dock-cta">
          Przejdź do koszyka
          <span aria-hidden="true" className="product-cart-dock-arrow">
            →
          </span>
        </span>
      </a>
    </div>
  );
}
