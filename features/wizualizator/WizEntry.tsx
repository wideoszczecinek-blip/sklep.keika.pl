"use client";

/**
 * Wejście do wizualizatora: przycisk (kilka na stronie) + jeden host okna.
 * Okno (WizModal) ładuje się dopiero po kliknięciu - nie obciąża strony.
 * Widoczność: ?wiz=1 albo los testu A/B z udziałem z CRM (lib/wizualizator/flag.ts).
 */
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { fetchKatalog, wizEvent } from "@/lib/wizualizator/api";
import { WIZ_OPEN_EVENT, openWizualizator, wizArm, wizForced, type WizOpenDetail } from "@/lib/wizualizator/flag";
import { trackShopStep } from "@/lib/track-step";

const WizModal = dynamic(() => import("./WizModal"), { ssr: false });

const AB_LOGGED_KEY = "keika_wiz_ab_logged";

/** Czy pokazać przycisk tej osobie (null = jeszcze nie wiadomo). */
function useWizVisible(): boolean | null {
  const [visible, setVisible] = useState<boolean | null>(null);
  useEffect(() => {
    let cancelled = false;
    if (wizForced()) {
      setVisible(true);
      return;
    }
    void fetchKatalog().then((k) => {
      if (cancelled) return;
      if (!k || !k.wlaczony || k.udzial <= 0) {
        setVisible(false);
        return;
      }
      setVisible(wizArm(k.udzial) !== "bez");
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return visible;
}

let hostCount = 0;

export function WizButton({ zrodlo, variant = "karta", tkanina, listwa }: { zrodlo: string; variant?: "karta" | "link"; tkanina?: string; listwa?: string }) {
  const visible = useWizVisible();
  const [own, setOwn] = useState(false);
  useEffect(() => {
    if (visible) wizEvent("wiz_przycisk", null, { zrodlo });
  }, [visible, zrodlo]);
  if (!visible) return null;
  // Bez hosta na stronie (np. stary landing) przycisk trzyma okno sam.
  const open = () => (hostCount > 0 ? openWizualizator({ zrodlo, tkanina, listwa }) : setOwn(true));
  if (own) {
    return <WizModal zrodlo={zrodlo} startTkanina={tkanina} startListwa={listwa} onClose={() => setOwn(false)} />;
  }
  if (variant === "link") {
    return (
      <button type="button" className="wiz-entry-link" onClick={open}>
        📷 Zobacz tę tkaninę w swoim oknie
      </button>
    );
  }
  return (
    <button type="button" className="wiz-entry-card" onClick={open}>
      <span className="wiz-entry-icon" aria-hidden="true">📷</span>
      <span className="wiz-entry-text">
        <b>Zobacz plisę w swoim oknie</b>
        <small>Zrób zdjęcie okna – w minutę zobaczysz na nim plisę w wybranym kolorze.</small>
      </span>
      <span className="wiz-entry-arrow" aria-hidden="true">›</span>
    </button>
  );
}

/** Jeden na stronę: słucha przycisków i trzyma okno. Loguje grupę testu A/B raz na sesję. */
export function WizHost() {
  const [open, setOpen] = useState<WizOpenDetail | null>(null);
  useEffect(() => {
    const onOpen = (e: Event) => setOpen((e as CustomEvent<WizOpenDetail>).detail || { zrodlo: "?" });
    window.addEventListener(WIZ_OPEN_EVENT, onOpen);
    hostCount += 1;
    const t = (new URLSearchParams(window.location.search).get("wiz_t") || "").toLowerCase();
    if (/^[a-f0-9]{32}$/.test(t)) setOpen({ zrodlo: "link", token: t });
    void fetchKatalog().then((k) => {
      if (!k || k.udzial <= 0) return;
      try {
        if (window.sessionStorage.getItem(AB_LOGGED_KEY)) return;
        window.sessionStorage.setItem(AB_LOGGED_KEY, "1");
      } catch {
        return;
      }
      trackShopStep("wiz_ab", wizArm(k.udzial), { udzial: k.udzial });
    });
    return () => {
      hostCount -= 1;
      window.removeEventListener(WIZ_OPEN_EVENT, onOpen);
    };
  }, []);
  if (!open) return null;
  return <WizModal zrodlo={open.zrodlo} startTkanina={open.tkanina} startListwa={open.listwa} startToken={open.token} onClose={() => setOpen(null)} />;
}
