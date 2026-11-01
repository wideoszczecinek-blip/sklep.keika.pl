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

/** Ostatnia wizualizacja klienta (pasek „dokończ wycenę” przy powrocie na /plisy). Zapisuje WizModal. */
export const WIZ_OSTATNIA_KEY = "keika_wiz_ostatnia";
export type WizOstatnia = { token: string; miniatura: string; data: string; szyb: number };

/**
 * Warianty (decyzja Agencji 1.11, lejek „Twoje okno”):
 *  - karta: hero/oferta - 3 klatki (zdjęcie → szyby → plisy) i „Zobacz plisę w swoim oknie 📸”,
 *  - link: w kroku tkaniny konfiguratora („Nie wiesz, która? Zobacz w swoim oknie”),
 *  - cena: jedna linia pod ceną konfiguratora (największa strata w lejku: widzą cenę, nie dodają).
 */
export function WizButton({ zrodlo, variant = "karta", tkanina, listwa, onKonfiguruj }: {
  zrodlo: string; variant?: "karta" | "link" | "cena"; tkanina?: string; listwa?: string;
  /** karta w hero: drugi przycisk „Mam wymiary – konfiguruję” (przewija do konfiguratora) */
  onKonfiguruj?: () => void;
}) {
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
        📷 Nie wiesz, która? Zobacz w swoim oknie
      </button>
    );
  }
  if (variant === "cena") {
    return (
      <button type="button" className="wiz-entry-cena" onClick={open}>
        Nie jesteś pewien koloru? <b>Zobacz tę plisę w swoim oknie →</b>
      </button>
    );
  }
  const karta = (
    <button type="button" className="wiz-entry-card" onClick={open}>
      <span className="wiz-entry-kadry" aria-hidden="true">
        <i style={{ backgroundImage: "url(/wizualizator-kadr-1.jpg)" }} />
        <i style={{ backgroundImage: "url(/wizualizator-kadr-2.jpg)" }} />
        <i style={{ backgroundImage: "url(/wizualizator-kadr-3.jpg)" }} />
      </span>
      <span className="wiz-entry-text">
        <b>Zobacz plisę w swoim oknie 📸</b>
        <small>Wrzuć zdjęcie okna – 30 sekund i widzisz plisę na swojej szybie, w wybranym kolorze.</small>
      </span>
      <span className="wiz-entry-arrow" aria-hidden="true">›</span>
    </button>
  );
  if (!onKonfiguruj) return karta;
  return (
    <div className="wiz-entry-hero">
      {karta}
      <button type="button" className="wiz-entry-konf" onClick={onKonfiguruj}>Mam wymiary – konfiguruję →</button>
    </div>
  );
}

/**
 * Pływający przycisk na stronie plis (telefon i komputer), prawy dół. Chowa się, gdy na ekranie jest
 * konfigurator albo pasek „Dodaj do koszyka” - żeby nie zasłaniał zakupu.
 */
export function WizPlywajacy({ zrodlo }: { zrodlo: string }) {
  const visible = useWizVisible();
  const [schowany, setSchowany] = useState(true);
  useEffect(() => {
    if (!visible) return;
    const sprawdz = () => {
      const pasek = document.querySelector(".plisy-sticky-cta");
      const konf = document.querySelector(".hero-product-config-panel");
      let wKonf = false;
      if (konf) {
        const r = konf.getBoundingClientRect();
        wKonf = r.top < window.innerHeight * 0.8 && r.bottom > window.innerHeight * 0.2;
      }
      setSchowany(Boolean(pasek) || wKonf || window.scrollY < 300);
    };
    sprawdz();
    window.addEventListener("scroll", sprawdz, { passive: true });
    window.addEventListener("resize", sprawdz);
    const t = window.setInterval(sprawdz, 1500);
    return () => {
      window.removeEventListener("scroll", sprawdz);
      window.removeEventListener("resize", sprawdz);
      window.clearInterval(t);
    };
  }, [visible]);
  if (!visible || schowany) return null;
  return (
    <button type="button" className="wiz-entry-fab" onClick={() => openWizualizator({ zrodlo })}>
      <span aria-hidden="true">📷</span> W swoim oknie
    </button>
  );
}

/** Powrót klienta po użyciu narzędzia: pasek u góry /plisy z miniaturą - kliknięcie otwiera wynik. */
export function WizPowrot() {
  const visible = useWizVisible();
  const [o, setO] = useState<WizOstatnia | null>(null);
  const [zamkniety, setZamkniety] = useState(false);
  useEffect(() => {
    if (!visible) return;
    let j: WizOstatnia | null = null;
    try {
      j = JSON.parse(window.localStorage.getItem(WIZ_OSTATNIA_KEY) || "null") as WizOstatnia | null;
    } catch {
      /* brak - nic nie pokazujemy */
    }
    // tylko 30 dni (zdjęcia w CRM są kasowane po 30 dniach)
    if (!j?.token || !/^[a-f0-9]{32}$/.test(j.token) || Date.now() - Date.parse(j.data) >= 29 * 864e5) return;
    const ostatnia = j;
    const t = window.setTimeout(() => setO(ostatnia), 0);
    return () => window.clearTimeout(t);
  }, [visible]);
  if (!visible || !o || zamkniety) return null;
  const data = new Date(o.data).toLocaleDateString("pl-PL", { day: "numeric", month: "long" });
  return (
    <div className="wiz-entry-powrot">
      <button type="button" onClick={() => { wizEvent("wiz_otwarte", o.token, { zrodlo: "powrot" }); openWizualizator({ zrodlo: "powrot", token: o.token }); }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {o.miniatura ? <img src={o.miniatura} alt="" /> : null}
        <span><b>Twoja wizualizacja z {data}</b><small>{o.szyb} {o.szyb === 1 ? "szyba" : o.szyb < 5 ? "szyby" : "szyb"} · dokończ wycenę →</small></span>
      </button>
      <button type="button" className="wiz-entry-powrot-x" aria-label="Ukryj" onClick={() => setZamkniety(true)}>×</button>
    </div>
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
    // link z maila z wizualizacją (?wiz_t=) otwiera wynik także na produkcji - to wizualizacja tego klienta
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
