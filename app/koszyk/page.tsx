"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  type CartLineItem,
  formatPln,
  readCartItems,
  removeCartItem,
  summarizeCartItems,
  updateCartItemQty,
} from "@/lib/cart";

export default function CartPage() {
  const [items, setItems] = useState<CartLineItem[]>([]);
  const [hydrated, setHydrated] = useState(false);

  const sync = useCallback(() => {
    setItems(readCartItems());
    setHydrated(true);
  }, []);

  useEffect(() => {
    sync();
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    window.addEventListener("keika-cart-updated", sync);
    return () => {
      window.removeEventListener("storage", sync);
      window.removeEventListener("focus", sync);
      window.removeEventListener("keika-cart-updated", sync);
    };
  }, [sync]);

  const summary = summarizeCartItems(items);

  function handleQtyChange(id: string, nextQty: number) {
    setItems(updateCartItemQty(id, nextQty));
  }

  function handleRemove(id: string) {
    setItems(removeCartItem(id));
  }

  return (
    <div className="cart-page">
      <header className="cart-page-header">
        <Link href="/" className="cart-page-brand">
          keika
        </Link>
        <h1>Koszyk</h1>
        <Link href="/" className="cart-page-back">
          ← Wróć do konfiguratora
        </Link>
      </header>

      <main className="cart-page-main">
        {!hydrated ? null : items.length === 0 ? (
          <div className="cart-page-empty">
            <p>Twój koszyk jest jeszcze pusty.</p>
            <Link href="/?produkt=moskitiery-ramkowe" className="cart-page-empty-cta">
              Skonfiguruj moskitierę
            </Link>
          </div>
        ) : (
          <>
            <ul className="cart-page-items">
              {items.map((item) => (
                <li key={item.id} className="cart-page-item">
                  <div
                    className="cart-page-item-thumb"
                    style={item.imageUrl ? { backgroundImage: `url(${item.imageUrl})` } : undefined}
                  />
                  <div className="cart-page-item-info">
                    <strong>{item.productLabel}</strong>
                    <span className="cart-page-item-specs">
                      {item.hardwareLabel ? `Profil: ${item.hardwareLabel}` : null}
                      {item.meshLabel ? ` · Siatka: ${item.meshLabel}` : null}
                      {item.widthMm && item.heightMm ? ` · ${item.widthMm} × ${item.heightMm} mm` : null}
                    </span>
                    <span className="cart-page-item-unit">{formatPln(item.price)} / szt.</span>
                  </div>
                  <div className="cart-page-item-qty">
                    <button
                      type="button"
                      onClick={() => handleQtyChange(item.id, item.qty - 1)}
                      disabled={item.qty <= 1}
                      aria-label="Zmniejsz ilość"
                    >
                      −
                    </button>
                    <span>{item.qty}</span>
                    <button
                      type="button"
                      onClick={() => handleQtyChange(item.id, item.qty + 1)}
                      aria-label="Zwiększ ilość"
                    >
                      +
                    </button>
                  </div>
                  <div className="cart-page-item-total">{formatPln(item.total)}</div>
                  <button
                    type="button"
                    className="cart-page-item-remove"
                    onClick={() => handleRemove(item.id)}
                    aria-label="Usuń pozycję"
                  >
                    Usuń
                  </button>
                </li>
              ))}
            </ul>

            <aside className="cart-page-summary">
              <div className="cart-page-summary-row">
                <span>{summary.items} {summary.items === 1 ? "produkt" : "produktów"}</span>
                <strong>{formatPln(summary.total)}</strong>
              </div>
              <button type="button" className="cart-page-checkout-cta" disabled>
                Przejdź do płatności
              </button>
              <p className="cart-page-checkout-note">
                Płatność online za kilka pozycji na raz jeszcze dopracowujemy. Zadzwoń do nas, a dokończymy
                zamówienie razem: <a href="tel:+48790215251">+48 790 215 251</a>.
              </p>
            </aside>
          </>
        )}
      </main>
    </div>
  );
}
