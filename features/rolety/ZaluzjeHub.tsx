"use client";

// /zaluzje - jedna pozycja „Żaluzje” na liście produktów (właściciel,
// 7.11.2026). Klient wybiera rodzaj lameli: aluminiowe, drewniane, bambusowe,
// PCV drewnopodobne - każdy rodzaj to osobny produkt /zaluzje/<rodzaj>.
// Bez ceny „od” (materiał przed ceną, właściciel 3.11). Stare ?model=ss-NN
// i ?kategoria=<stara kategoria> przekierowują na właściwy rodzaj.
import Link from "next/link";
import { useEffect, useMemo } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import { trackShopStep } from "@/lib/track-step";
import { colorCountLabel } from "./ZaluzjeCategoryGrid";
import type { RoletyProfile } from "./shared";
import { ZALUZJE_RODZAJE, zaluzjeRodzajOfGroup, zaluzjeRodzajSummaries, type ZaluzjeRodzajSlug } from "./zaluzje-rodzaje";

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

/** Porównanie rodzajów - fakty, bez cen. */
const COMPARE: Array<{ label: string; values: Record<ZaluzjeRodzajSlug, string> }> = [
  { label: "Wilgoć (kuchnia, łazienka)", values: { aluminiowe: "tak", pcv: "tak", drewniane: "nie polecamy", bambusowe: "nie polecamy" } },
  { label: "Wygląd", values: { aluminiowe: "lekki, nowoczesny", pcv: "jak drewno", drewniane: "naturalne drewno", bambusowe: "naturalny bambus" } },
  { label: "Lamele", values: { aluminiowe: "16-50 mm", pcv: "35-65 mm", drewniane: "25-65 mm", bambusowe: "25-65 mm" } },
];

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
      <h2 className="zl-hub-title">Wybierz rodzaj lameli</h2>
      <p className="zl-hub-lead">
        Rodzaj lameli decyduje o wyglądzie i o tym, gdzie żaluzja się sprawdzi. Grubość lameli i kolor wybierzesz na stronie rodzaju.
      </p>
      <div className="zl-hub-grid">
        {summaries.map((entry) => (
          <Link
            key={entry.slug}
            href={`/zaluzje/${entry.slug}`}
            className="zl-hub-card"
            onClick={() => trackShopStep("zaluzje_rodzaj", entry.slug, { source: "hub" })}
          >
            <span className="zl-hub-photo" aria-hidden="true" style={{ backgroundImage: `url(${optimizeImageUrl(entry.imageUrl, 500)})` }} />
            <span className="zl-hub-body">
              <strong>{entry.copy.name}</strong>
              <span className="zl-hub-desc">{entry.copy.lead}</span>
              <span className="zl-hub-meta">
                {entry.widthsMm.length ? <span>Lamele {entry.widthsMm.join(" · ")} mm</span> : null}
                {entry.colorCount ? <span>{colorCountLabel(entry.colorCount)}</span> : null}
              </span>
              <span className="zl-hub-rooms">{entry.copy.rooms.join(" · ")}</span>
              <span className="zl-hub-go">Zobacz {entry.copy.name.replace(/^Żaluzje /, "")} →</span>
            </span>
          </Link>
        ))}
      </div>

      <div className="zl-hub-compare" role="table" aria-label="Porównanie rodzajów żaluzji">
        <div className="zl-hub-compare-row is-head" role="row">
          <span role="columnheader" />
          {summaries.map((entry) => (
            <span key={entry.slug} role="columnheader">
              {ZALUZJE_RODZAJE[entry.slug].short}
            </span>
          ))}
        </div>
        {COMPARE.map((row) => (
          <div className="zl-hub-compare-row" role="row" key={row.label}>
            <span role="rowheader">{row.label}</span>
            {summaries.map((entry) => (
              <span key={entry.slug} role="cell">
                {row.values[entry.slug]}
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
