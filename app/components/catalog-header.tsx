"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { optimizeImageUrl } from "@/lib/image-optim";

type TopLink = { label?: string; url?: string };

type CatalogHeaderProps = {
  logoUrl: string;
  siteTitle: string;
  topLinks: TopLink[];
  contactPhone: string;
  isCompact: boolean;
};

/** Shared <header class="hero-header"> for produkt/[slug], kategoria/[slug]
 * and konfigurator/[slug] - these three had triplicated, incomplete markup
 * (hamburger button with no onClick/open state, cart link pointing at the
 * dead anchor #koszyk instead of /koszyk, no real item count) that had
 * silently never been wired up to anything. One real, working header now,
 * matching the pattern app/page.tsx's own header already uses. */
export default function CatalogHeader({ logoUrl, siteTitle, topLinks, contactPhone, isCompact }: CatalogHeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [cartCount, setCartCount] = useState(0);
  const menuWrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function syncCart() {
      try {
        const { readCartSummary } = await import("@/lib/cart");
        if (!cancelled) setCartCount(readCartSummary().items);
      } catch {
        // Koszyk niedostępny w tym kontekście - licznik zostaje na 0.
      }
    }
    void syncCart();
    window.addEventListener("keika-cart-updated", syncCart);
    return () => {
      cancelled = true;
      window.removeEventListener("keika-cart-updated", syncCart);
    };
  }, []);

  useEffect(() => {
    if (!menuOpen) return;
    function handleOutsideClick(event: MouseEvent) {
      if (menuWrapRef.current && !menuWrapRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("click", handleOutsideClick);
    return () => document.removeEventListener("click", handleOutsideClick);
  }, [menuOpen]);

  return (
    <header className={`hero-header${isCompact ? " is-compact" : ""}`}>
      <div className="header-left">
        <Link className="brand" href="/" aria-label="KEIKA strona główna">
          {logoUrl ? <img src={optimizeImageUrl(logoUrl, 240)} alt={siteTitle || "KEIKA"} className="brand-logo" /> : siteTitle || "KEIKA"}
        </Link>
        <div className={`top-links-wrap ${menuOpen ? "is-open" : ""}`} ref={menuWrapRef}>
          <button
            type="button"
            className="top-links-toggle"
            aria-expanded={menuOpen ? "true" : "false"}
            aria-controls="catalog-top-links-dropdown"
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="top-links-toggle-label">Menu</span>
            <span className="top-links-toggle-icon" aria-hidden="true">
              <span />
              <span />
              <span />
            </span>
          </button>
          <nav id="catalog-top-links-dropdown" className="top-links-dropdown" aria-label="Menu dodatkowe">
            {topLinks.map((entry) => (
              <a key={`${entry.label}-${entry.url}`} href={entry.url || "#"} onClick={() => setMenuOpen(false)}>
                {entry.label || "Link"}
              </a>
            ))}
          </nav>
        </div>
      </div>
      <div className="header-actions">
        {/* Light theme only now, no per-visitor toggle. */}
        {contactPhone ? (
          <a className="phone" href={`tel:${contactPhone.replace(/\s+/g, "")}`}>
            {contactPhone}
          </a>
        ) : null}
        <a className={`header-cart ${cartCount > 0 ? "has-items" : "is-empty"}`} href="/koszyk" aria-label={cartCount > 0 ? `Koszyk: ${cartCount} szt.` : "Koszyk jest pusty"}>
          <span className="header-cart-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
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
            {cartCount > 0 ? <span className="header-cart-badge">{cartCount}</span> : null}
          </span>
          <span className="header-cart-copy">
            <strong>Koszyk</strong>
            <small>{cartCount > 0 ? `${cartCount} szt.` : "Przejdź do koszyka"}</small>
          </span>
        </a>
      </div>
    </header>
  );
}
