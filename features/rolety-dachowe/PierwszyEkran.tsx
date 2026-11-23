"use client";

// Pierwszy ekran rolet dachowych, 23.11.2026 (właściciel: „Tak, przebuduj” – wzorem plis dachowych z 22.11).
// Dane 1.10–22.11: 7014 sesji, 86 % z Meta, 91 % telefon, połowa wychodzi na pierwszym ekranie, tylko 7 % szuka
// modelu okna. Dlatego na górze: korzyść (sypialnia, upał – Allegro: 90 % sprzedaży to TERMO/zaciemniające), od razu
// „nie musisz mierzyć – wystarczy model z tabliczki”, jeden przycisk do wyszukiwarki okna, trzy fakty.
// Fakty tylko z landing-content.ts, company-legal.ts i strony plis dachowych.
import { useEffect, useRef } from "react";
import { trackShopStep } from "@/lib/track-step";
import { COMPANY_LEGAL } from "@/lib/company-legal";
import { LejekOcena } from "@/features/plisy/PierwszyEkran";
import LiveConfiguring from "@/app/components/live-configuring";

const SLUG = "rolety-dachowe";

export const RD_LEAD = "Zaciemnij sypialnię na poddaszu, a latem ogranicz nagrzewanie – tkanina TERMO odbija słońce od strony szyby.";
export const RD_WYBOR = "Nie musisz mierzyć: wpisz model z tabliczki znamionowej na skrzydle okna albo wgraj jej zdjęcie – roletę dobierzemy sami.";
export const RD_CTA = "Dobierz roletę i sprawdź cenę";

/** Pierwszy ekran pod H1: korzyść, dobór bez mierzenia, licznik, ocena, jeden przycisk do wyszukiwarki okna, trzy fakty. */
export function RdPierwszyEkran({ onCena, onZestaw, onOpinie }: { onCena: () => void; onZestaw: () => void; onOpinie: () => void }) {
  // Pływający znaczek „Twój rabat” (welcome-offer, fixed 92 px nad dołem) zasłaniał na telefonie ten przycisk -
  // chowamy go, dopóki przycisk jest widoczny (klasa na <body>, reguła w welcome-offer.css).
  const ctaRef = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver((entries) => {
      document.body.classList.toggle("hero-cta-widoczny", entries.some((e) => e.isIntersecting));
    });
    io.observe(el);
    return () => {
      io.disconnect();
      document.body.classList.remove("hero-cta-widoczny");
    };
  }, []);
  return (
    <div className="pe-gora pe-gora--v3 pd-gora rd-gora">
      <p className="pe-lead">{RD_LEAD}</p>
      <p className="pe-wybor">{RD_WYBOR}</p>
      <LiveConfiguring />
      <LejekOcena onOpinie={onOpinie} />
      <div className="pe-cta">
        <button
          ref={ctaRef}
          type="button"
          className="pm-btn pe-cta-btn"
          onClick={() => {
            trackShopStep("hero_cta", SLUG, { cel: "wycena" });
            onCena();
          }}
        >
          {RD_CTA}
        </button>
        <p className="pe-cta-pod">
          <span>Dostawa 0 zł</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            className="pe-cta-link"
            onClick={() => {
              trackShopStep("hero_cta", SLUG, { cel: "zestaw" });
              onZestaw();
            }}
          >
            Zobacz, co dostajesz ↓
          </button>
        </p>
      </div>
      <ul className="pe-fakty" aria-label="Bezpieczny zakup">
        <li>Jakość poparta 5-letnią gwarancją</li>
        <li>
          <a href={COMPANY_LEGAL.phoneHref} className="pe-fakty-tel" onClick={() => trackShopStep("call_click", SLUG, { source: "hero_fakt" })}>
            Pomoc telefoniczna 8–21, codziennie
          </a>
        </li>
        <li>30 dni na zwrot, także na wymiar</li>
      </ul>
    </div>
  );
}
