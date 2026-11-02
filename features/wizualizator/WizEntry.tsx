"use client";

/**
 * Wejście do wizualizatora: przycisk (kilka na stronie) + jeden host okna.
 * Okno (WizModal) ładuje się dopiero po kliknięciu - nie obciąża strony.
 * Widoczność: ?wiz=1 albo los testu A/B z udziałem z CRM (lib/wizualizator/flag.ts).
 */
import dynamic from "next/dynamic";
import { useEffect, useRef, useState } from "react";
import { fetchKatalog, wizEvent } from "@/lib/wizualizator/api";
import { WIZ_OPEN_EVENT, openWizualizator, wizArm, wizForced, wizFromAd, type WizOpenDetail } from "@/lib/wizualizator/flag";
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
/** Etapy animacji banera (sekundy filmu 4,6 s): zdjęcie → plisy we wszystkich oknach → belki → kolory. */
const ETAPY_BANERA: [number, string][] = [[0, "Twoje zdjęcie"], [0.7, "Plisy w każdym oknie"], [1.5, "Przesuwasz belki"], [2.7, "Zmieniasz kolor"]];

/**
 * Animacja banera (właściciel 2.11: „duży salon z otwartą kuchnią, okno tarasowe, okno przy stole, okno w kuchni –
 * zdjęcie, zmiana plis we wszystkich oknach, poruszanie belkami i zmiana koloru, cykl 4–5 s – klient musi wiedzieć,
 * co się dzieje”). Klatki z prawdziwego renderera na wyniku analizy zdjęcia (Unsplash, Clay Banks). Wideo ładuje się
 * dopiero, gdy baner jest na ekranie (preload none + play przy widoczności); do tego czasu lekki plakat (LCP).
 */
function BanerAnimacja({ onClick }: { onClick: () => void }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [etap, setEtap] = useState(0);
  useEffect(() => {
    const v = ref.current;
    if (!v || typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) void v.play().catch(() => {});
      else v.pause();
    }, { threshold: 0.3 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  const czas = () => {
    const t = ref.current?.currentTime || 0;
    let e = 0;
    ETAPY_BANERA.forEach(([od], i) => {
      if (t >= od) e = i;
    });
    if (t >= 4.1) e = 0; // plisy chowają się przed kolejnym obiegiem
    setEtap(e);
  };
  return (
    <>
      <button type="button" className="wiz-baner-foto" onClick={onClick} aria-label="Zobacz plisę na zdjęciu swojego okna – wrzuć zdjęcie">
        <video ref={ref} className="wiz-baner-wideo" poster="/wizualizator-baner-poster.webp" muted loop playsInline preload="none" onTimeUpdate={czas} aria-hidden="true">
          <source src="/wizualizator-baner.webm" type="video/webm" />
          <source src="/wizualizator-baner.mp4" type="video/mp4" />
        </video>
        <span className="wiz-baner-chip">📸 Twoje zdjęcie → plisa w 1 minutę</span>
        <span className="wiz-baner-pg">Wizualizacja poglądowa</span>
      </button>
      <ol className="wiz-baner-etapy" aria-label="Jak działa wizualizacja">
        {ETAPY_BANERA.map(([, nazwa], i) => (
          <li key={nazwa} className={i === etap ? "is-on" : i < etap ? "is-done" : ""}><b>{i + 1}</b>{nazwa}</li>
        ))}
      </ol>
    </>
  );
}

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
  // Baner (właściciel 2.11: „baner zobacz plisę jest mało widoczny i mało zachęcający – nie sprzedamy go tak”):
  // duże zdjęcie prawdziwego okna, na którym plisa „zjeżdża” jak w narzędziu (przed → po w pętli), nagłówek
  // z korzyścią i pomarańczowy przycisk. Całe zdjęcie też otwiera narzędzie.
  const karta = (
    <div className="wiz-baner">
      <BanerAnimacja onClick={open} />
      <div className="wiz-baner-tresc">
        <b>Zobacz plisę na zdjęciu swojego okna</b>
        <small>Wrzuć zdjęcie pokoju – pokażemy plisy we wszystkich oknach. Przesuwasz belki, zmieniasz kolor (150 tkanin). Za darmo, bez rejestracji.</small>
      </div>
      <button type="button" className="wiz-baner-cta" onClick={open}>📸 Wrzuć zdjęcie okna</button>
    </div>
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
    // wejście z reklamy (?wiz=start): od razu okno wizualizatora - gdy narzędzie jest uruchomione (albo ?wiz=1 poza produkcją)
    const zReklamy = new URLSearchParams(window.location.search).get("wiz") === "start";
    if (zReklamy) wizFromAd(); // zapamiętaj wejście z reklamy (poza grupą kontrolną) na kolejne strony
    void fetchKatalog().then((k) => {
      if (zReklamy && !t && (wizForced() || (k && k.wlaczony && k.udzial > 0))) setOpen({ zrodlo: "reklama" });
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
