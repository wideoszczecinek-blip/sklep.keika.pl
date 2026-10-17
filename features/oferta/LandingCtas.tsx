"use client";

import { useEffect, useState } from "react";
import CatalogHeader from "@/app/components/catalog-header";
import { openCrispChat } from "@/lib/crisp";
import { useScrolledPast } from "@/lib/use-scrolled";
import { trackShopStep } from "@/lib/track-step";
import styles from "./oferta.module.css";
import { VARIANT_EVENT } from "./QuoteForm";

type TopLink = { label?: string; url?: string };

/** Wspólny nagłówek sklepu z trybem zwiniętym po przewinięciu. */
export function OfertaHeader({ logoUrl, siteTitle, topLinks, contactPhone }: { logoUrl: string; siteTitle: string; topLinks: TopLink[]; contactPhone: string }) {
  const compact = useScrolledPast(120);
  return <CatalogHeader logoUrl={logoUrl} siteTitle={siteTitle} topLinks={topLinks} contactPhone={contactPhone} isCompact={compact} />;
}

/** "Zapytaj o ofertę" - otwiera czat z gotowym pytaniem; gdy czat się nie
 * załaduje (blokada skryptów), link prowadzi do formularza. */
export function ChatCta({ productLabel, slug, className, children }: { productLabel: string; slug: string; className?: string; children: React.ReactNode }) {
  return (
    <a
      href="#wycena"
      className={className}
      onClick={(event) => {
        event.preventDefault();
        trackShopStep("quote_chat_open", slug, { product: productLabel });
        openCrispChat(`Dzień dobry, chciałbym zapytać o ofertę: ${productLabel}.`);
      }}
    >
      {children}
    </a>
  );
}

/** Przycisk na karcie wariantu: ustawia wybór w formularzu i przewija. */
export function VariantPick({ option, slug }: { option: string; slug: string }) {
  return (
    <a
      href="#wycena"
      className={styles.btnLight}
      onClick={() => {
        window.dispatchEvent(new CustomEvent(VARIANT_EVENT, { detail: option }));
        trackShopStep("quote_variant_pick", slug, { variant: option });
      }}
    >
      Wyceń ten wariant
    </a>
  );
}

/** Dolny pasek na telefonie: wycena + telefon. Pojawia się po przewinięciu
 * poza hero, żeby nie zasłaniać pierwszych przycisków. */
export function StickyBar({ phone }: { phone: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    function onScroll() {
      setVisible(window.scrollY > 480);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!visible) return null;
  return (
    <div className={styles.stickyBar}>
      <a href="#wycena" className={styles.btnPrimary}>
        Poproś o wycenę
      </a>
      {phone ? (
        <a href={`tel:${phone.replace(/\s+/g, "")}`} className={styles.btnLight}>
          Zadzwoń
        </a>
      ) : null}
    </div>
  );
}
