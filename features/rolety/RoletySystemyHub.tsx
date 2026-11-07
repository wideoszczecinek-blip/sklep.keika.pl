"use client";

// /rolety-tradycyjne - jedna pozycja „Rolety tradycyjne” w menu, a na stronie
// wybór systemu (właściciel, 7.11.2026): kaseta z prowadnicą płaską
// (polecana), MINI, kaseta z prowadnicą przestrzenną, wolnowisząca. Każdy
// system to osobny produkt z własnym pomiarem - przejście między nimi tylko
// tutaj, przed pomiarem (decyzja 25.10). Bez cen (materiał przed ceną).
import Link from "next/link";
import { trackShopStep } from "@/lib/track-step";
import RoletySystemDrawing from "./RoletySystemDrawing";
import { ROLETY_SYSTEM_COMPARE, ROLETY_SYSTEM_SLUGS, ROLETY_SYSTEMS, type RoletySystemSlug } from "./systemy";

export const ROLETY_SYSTEMY_ID = "rolety-systemy";

export function RoletySystemCards({ current = null, compact = false }: { current?: RoletySystemSlug | null; compact?: boolean }) {
  const slugs = ROLETY_SYSTEM_SLUGS.filter((slug) => slug !== current);
  return (
    <div className={`rs-hub-grid ${compact ? "is-compact" : ""}`}>
      {slugs.map((slug) => {
        const system = ROLETY_SYSTEMS[slug];
        return (
          <Link key={slug} href={`/${slug}`} className={`rs-hub-card ${system.recommended ? "is-recommended" : ""}`} onClick={() => trackShopStep("rolety_system", slug, { source: current ? "system_page" : "hub" })}>
            {system.recommended ? <span className="rs-hub-badge">Polecana</span> : null}
            <span className="rs-hub-drawing" aria-hidden="true">
              <RoletySystemDrawing system={slug} showMeasures={false} />
            </span>
            <span className="rs-hub-body">
              <strong>{system.name}</strong>
              {compact ? null : <span className="rs-hub-lead">{system.lead}</span>}
              <span className="rs-hub-pros">
                {system.pros.map((pro) => (
                  <span key={pro}>✓ {pro}</span>
                ))}
              </span>
              {compact ? null : <span className="rs-hub-measure">Pomiar: {system.measureShort}</span>}
              <span className="rs-hub-go">Zobacz →</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}

export default function RoletySystemyHub() {
  return (
    <div id={ROLETY_SYSTEMY_ID} className="rs-hub">
      <h2 className="zl-hub-title">Wybierz system rolety</h2>
      <p className="zl-hub-lead">
        Wszystkie rolety produkujemy na wymiar z tych samych tkanin: Deko (przepuszcza rozproszone światło) albo zaciemniającej Termo. Różnią się tym, jak wiszą na oknie i jak się je mierzy. Nie wiesz, którą wybrać? Większości okien polecamy kasetę z prowadnicą płaską.
      </p>
      <RoletySystemCards />
      <div className="zl-hub-compare" role="table" aria-label="Porównanie systemów rolet">
        <div className="zl-hub-compare-row rs-compare-row is-head" role="row">
          <span role="columnheader" />
          {ROLETY_SYSTEM_SLUGS.map((slug) => (
            <span key={slug} role="columnheader">
              {ROLETY_SYSTEMS[slug].short}
            </span>
          ))}
        </div>
        {ROLETY_SYSTEM_COMPARE.map((row) => (
          <div className="zl-hub-compare-row rs-compare-row" role="row" key={row.label}>
            <span role="rowheader">{row.label}</span>
            {ROLETY_SYSTEM_SLUGS.map((slug) => (
              <span key={slug} role="cell">
                {row.values[slug]}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
