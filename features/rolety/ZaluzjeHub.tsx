"use client";

// /zaluzje - jedna pozycja „Żaluzje” na liście produktów (właściciel,
// 7.11.2026). 23.11.2026 (właściciel): głównym wyborem jest materiał -
// aluminiowe, drewniane albo bambusowe (każdy to osobny produkt
// /zaluzje/<rodzaj>); PCV drewnopodobne jako dodatkowa opcja do łazienki i
// kuchni. Bez ceny „od” (materiał przed ceną, właściciel 3.11). Stare
// ?model=ss-NN i ?kategoria=<stara kategoria> przekierowują na właściwy rodzaj.
import { useEffect, useMemo } from "react";
import { ROLETY_COPY, type RoletyProfile } from "./shared";
import { zaluzjeRodzajOfGroup, zaluzjeRodzajSummaries, type ZaluzjeRodzajSlug } from "./zaluzje-rodzaje";
import { ZaluzjeBezpiecznie, ZaluzjePomiar } from "./ZaluzjeLejek";
import { ZaluzjeMaterialCards, ZaluzjePorownanie } from "./ZaluzjeMaterialy";

export const ZALUZJE_CATALOG_ID = "zaluzje-katalog";

const LEGACY_CATEGORY: Record<string, ZaluzjeRodzajSlug> = {
  "drewniane-basswood": "drewniane",
  "drewniane-abachi": "drewniane",
  "prime-wood": "drewniane",
  bambusowe: "bambusowe",
  "drewnopodobne-pcv": "pcv",
  aluminiowe: "aluminiowe",
  drewnopodobne: "aluminiowe",
};

/** Jak wybrać w 3 krokach - pytania, które klient i tak sobie zadaje. */
const HOWTO: Array<{ title: string; text: string }> = [
  {
    title: "Gdzie jest okno?",
    text: "Kuchnia, łazienka, pralnia - aluminium, bo nie chłonie wody (wygląd drewna da tam PCV drewnopodobne). Salon, sypialnia, gabinet - każdy materiał, a drewno i bambus dodadzą wnętrzu ciepła.",
  },
  {
    title: "Jaki masz styl?",
    text: "Nowocześnie i minimalistycznie - aluminium. Klasycznie i przytulnie - drewno, także z ozdobną taśmą. Boho, japandi, skandynawsko - bambus.",
  },
  {
    title: "Gdzie zawiśnie?",
    text: "Na skrzydle okna wybierz cieńszą lamelę (16-35 mm) - mniej odstaje od szyby i nie zahacza o klamkę. Na ścianę nad wnęką i na duże okna - lamele 50-65 mm. Grubość wybierasz w konfiguratorze.",
  },
];

function scrollToCards() {
  const target = document.getElementById(ZALUZJE_CATALOG_ID);
  if (!target) return;
  const container = target.closest<HTMLElement>(".hero-full");
  if (container && container.scrollHeight > container.clientHeight) {
    const delta = target.getBoundingClientRect().top - container.getBoundingClientRect().top - 96;
    container.scrollTo({ top: Math.max(0, container.scrollTop + delta), behavior: "smooth" });
    return;
  }
  try {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch {
    /* ignore */
  }
}

export default function ZaluzjeHub({ profile }: { profile: RoletyProfile | null }) {
  const summaries = useMemo(() => zaluzjeRodzajSummaries(profile), [profile]);

  // Dawne linki katalogu (?model=ss-39, ?kategoria=drewniane-basswood).
  useEffect(() => {
    try {
      const url = new URL(window.location.href);
      const kategoria = (url.searchParams.get("kategoria") || "").toLowerCase();
      const model = (url.searchParams.get("model") || "").toLowerCase();
      if (model && profile) {
        const group = profile.fabricGroups.find((entry) => entry.id.toLowerCase() === model);
        const rodzaj = group ? zaluzjeRodzajOfGroup(group) : null;
        if (rodzaj) window.location.replace(`/zaluzje/${rodzaj}?model=${group!.id}`);
        return;
      }
      if (kategoria && LEGACY_CATEGORY[kategoria]) window.location.replace(`/zaluzje/${LEGACY_CATEGORY[kategoria]}`);
    } catch {
      /* ignore */
    }
  }, [profile]);

  return (
    <div id={ZALUZJE_CATALOG_ID} className="zl-hub">
      <h2 className="zl-hub-title">Wybierz materiał lameli</h2>
      <p className="zl-hub-lead">
        Materiał decyduje o wyglądzie i o tym, gdzie żaluzja się sprawdzi. Grubość lameli i kolor wybierzesz w konfiguratorze.
      </p>
      <ZaluzjeMaterialCards summaries={summaries} />
      <div className="pl-trust-row zl-hub-trust">
        <span className="pl-chip">Na wymiar co do milimetra</span>
        <span className="pl-chip">Realizacja {ROLETY_COPY.zaluzje.leadTimeLabel}</span>
        <span className="pl-chip">Darmowa dostawa od 79 zł</span>
      </div>

      <ZaluzjePorownanie current={null} />

      <section className="zlf-section" aria-labelledby="zlf-howto">
        <p className="zlf-eyebrow">Jak wybrać</p>
        <h2 id="zlf-howto" className="zlf-title">
          Trzy pytania i wiesz, którą żaluzję wybrać
        </h2>
        <ol className="zlf-howto">
          {HOWTO.map((step) => (
            <li key={step.title}>
              <strong>{step.title}</strong>
              {step.text}
            </li>
          ))}
        </ol>
        <p className="zlf-lead zlf-why">
          Dlaczego żaluzja, a nie roleta? Lamele obracasz o dowolny kąt: wpuszczasz rozproszone światło i nadal nikt nie zajrzy do środka. Żaluzja jest
          też trwalsza i łatwiej ją utrzymać w czystości.
        </p>
      </section>

      <ZaluzjeBezpiecznie />
      <ZaluzjePomiar onConfigure={scrollToCards} ctaLabel="Wybierz materiał lameli" />
    </div>
  );
}
