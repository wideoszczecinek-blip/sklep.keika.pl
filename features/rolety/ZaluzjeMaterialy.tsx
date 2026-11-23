"use client";

// Wybór materiału żaluzji (właściciel 23.11.2026): „głównym wyborem żaluzji
// jest to, czy mają być aluminiowe, drewniane czy bambusowe … musi być łatwa
// opcja przełączania się między podproduktami, aby klient mógł łatwo
// przeanalizować inne rozwiązanie”. Trzy miejsca:
// - ZaluzjeMaterialSwitch "strip": pod tytułem strony rodzaju,
// - ZaluzjeMaterialSwitch "panel": na górze konfiguratora (po przejściu
//   strona przewija się od razu do konfiguratora),
// - ZaluzjePorownanie: tabela różnic z przejściem do innego materiału.
// Wpisane w konfiguratorze wymiary i montaż przechodzą z klientem
// (zaluzje-switch.ts). PCV drewnopodobne: dodatkowa opcja pod kaflami.
import Link from "next/link";
import { useEffect, useState } from "react";
import { optimizeImageUrl } from "@/lib/image-optim";
import { trackShopStep } from "@/lib/track-step";
import { markZaluzjeJumpToConfigurator, readZaluzjeCarry, ZALUZJE_CARRY_EVENT, zaluzjeCarryHasWindow } from "./zaluzje-switch";
import {
  ZALUZJE_COMPARE,
  ZALUZJE_EXTRA_SLUG,
  ZALUZJE_MAIN_SLUGS,
  ZALUZJE_RODZAJE,
  type ZaluzjeRodzajSlug,
} from "./zaluzje-rodzaje";

export const ZALUZJE_POROWNANIE_ID = "zaluzje-porownanie";

/** Czy klient wpisał już wymiary w tej wizycie (sessionStorage - czytane dopiero po zamontowaniu). */
function useCarryHasWindow(watch: unknown): boolean {
  const [has, setHas] = useState(false);
  useEffect(() => {
    const check = () => setHas(zaluzjeCarryHasWindow(readZaluzjeCarry()));
    check();
    window.addEventListener(ZALUZJE_CARRY_EVENT, check);
    return () => window.removeEventListener(ZALUZJE_CARRY_EVENT, check);
  }, [watch]);
  return has;
}

function trackSwitch(from: ZaluzjeRodzajSlug | null, to: ZaluzjeRodzajSlug, source: string, hasWindow: boolean) {
  trackShopStep("zaluzje_material_switch", to, { from: from || "", source, has_dims: hasWindow });
}

export function scrollToZaluzjePorownanie() {
  const target = document.getElementById(ZALUZJE_POROWNANIE_ID);
  if (!target) return;
  const container = target.closest<HTMLElement>(".hero-full");
  if (container && container.scrollHeight > container.clientHeight) {
    const delta = target.getBoundingClientRect().top - container.getBoundingClientRect().top - 96;
    container.scrollTo({ top: Math.max(0, container.scrollTop + delta), behavior: "smooth" });
  } else {
    target.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/**
 * Przełącznik materiału. "strip" - kafle ze zdjęciem pod tytułem strony;
 * "panel" - zwarty wybór na górze konfiguratora.
 */
export function ZaluzjeMaterialSwitch({ current, variant }: { current: ZaluzjeRodzajSlug; variant: "strip" | "panel" }) {
  const hasWindow = useCarryHasWindow(current);
  const extra = ZALUZJE_RODZAJE[ZALUZJE_EXTRA_SLUG];
  const extraActive = current === ZALUZJE_EXTRA_SLUG;
  const panel = variant === "panel";

  return (
    <nav className={`zl-mat zl-mat--${variant}`} aria-label="Materiał lameli">
      <div className="zl-mat-head">
        <span className="zl-mat-label">{panel ? "Materiał lameli" : "Wybierz materiał lameli"}</span>
        {!panel ? (
          <button
            type="button"
            className="zl-mat-compare"
            onClick={() => {
              trackShopStep("zaluzje_porownanie_open", current, { source: "strip" });
              scrollToZaluzjePorownanie();
            }}
          >
            Porównaj materiały ↓
          </button>
        ) : null}
      </div>
      <div className="zl-mat-row">
        {ZALUZJE_MAIN_SLUGS.map((slug) => {
          const copy = ZALUZJE_RODZAJE[slug];
          const body = (
            <>
              <span className="zl-mat-photo" aria-hidden="true" style={{ backgroundImage: `url(${optimizeImageUrl(copy.cover, panel ? 160 : 360)})` }} />
              <span className="zl-mat-text">
                <strong>{copy.short}</strong>
                {!panel ? <small>{copy.tileNote}</small> : null}
              </span>
              {slug === current ? (
                <span className="zl-mat-check" aria-hidden="true">
                  ✓
                </span>
              ) : null}
            </>
          );
          if (slug === current) {
            return (
              <span key={slug} className="zl-mat-tile is-active" aria-current="page">
                {body}
              </span>
            );
          }
          return (
            <Link
              key={slug}
              href={`/zaluzje/${slug}`}
              className="zl-mat-tile"
              aria-label={`${copy.name}${hasWindow ? " - z Twoimi wymiarami" : ""}`}
              onClick={() => {
                trackSwitch(current, slug, variant, hasWindow);
                if (panel) markZaluzjeJumpToConfigurator(slug);
              }}
            >
              {body}
            </Link>
          );
        })}
      </div>
      {extraActive ? (
        <span className="zl-mat-extra is-active" aria-current="page">
          <span aria-hidden="true">✓</span> Oglądasz: <strong>{extra.name}</strong> - {extra.tileNote}
        </span>
      ) : (
        <Link
          href={`/zaluzje/${ZALUZJE_EXTRA_SLUG}`}
          className="zl-mat-extra"
          onClick={() => {
            trackSwitch(current, ZALUZJE_EXTRA_SLUG, variant, hasWindow);
            if (panel) markZaluzjeJumpToConfigurator(ZALUZJE_EXTRA_SLUG);
          }}
        >
          Wygląd drewna do łazienki lub kuchni? <strong>{extra.name} →</strong>
        </Link>
      )}
      {hasWindow ? (
        <p className="zl-mat-carry">
          <span aria-hidden="true">↔</span> Twoje wymiary i montaż przejdą na inny materiał - porównasz cenę dla tego samego okna.
        </p>
      ) : panel ? (
        <p className="zl-mat-carry">Materiał zmienisz w każdej chwili - wpisane wymiary przejdą z Tobą.</p>
      ) : null}
    </nav>
  );
}

/** Strona zbiorcza /zaluzje: trzy duże kafle materiałów + PCV jako dodatkowa opcja. */
export function ZaluzjeMaterialCards({
  summaries,
}: {
  summaries: Array<{ slug: ZaluzjeRodzajSlug; widthsMm: number[]; colorCount: number }>;
}) {
  const bySlug = new Map(summaries.map((entry) => [entry.slug, entry]));
  const extra = ZALUZJE_RODZAJE[ZALUZJE_EXTRA_SLUG];
  const extraSummary = bySlug.get(ZALUZJE_EXTRA_SLUG);
  return (
    <>
      <div className="zl-hub-grid zl-hub-grid--3">
        {ZALUZJE_MAIN_SLUGS.map((slug) => {
          const copy = ZALUZJE_RODZAJE[slug];
          const summary = bySlug.get(slug);
          return (
            <Link
              key={slug}
              href={`/zaluzje/${slug}`}
              className="zl-hub-card"
              onClick={() => trackShopStep("zaluzje_rodzaj", slug, { source: "hub" })}
            >
              <span className="zl-hub-photo" aria-hidden="true" style={{ backgroundImage: `url(${optimizeImageUrl(copy.cover, 640)})` }} />
              <span className="zl-hub-body">
                <strong>{copy.name}</strong>
                <span className="zl-hub-desc">{copy.lead}</span>
                <span className="zl-hub-meta">
                  {summary?.widthsMm.length ? <span>Lamele {summary.widthsMm.join(" · ")} mm</span> : null}
                  {summary?.colorCount ? <span>{colorCountText(summary.colorCount)}</span> : null}
                </span>
                <span className="zl-hub-rooms">{copy.rooms.join(" · ")}</span>
                <span className="zl-hub-go">Zobacz {copy.short.toLowerCase()} →</span>
              </span>
            </Link>
          );
        })}
      </div>
      <Link
        href={`/zaluzje/${ZALUZJE_EXTRA_SLUG}`}
        className="zl-hub-extra"
        onClick={() => trackShopStep("zaluzje_rodzaj", ZALUZJE_EXTRA_SLUG, { source: "hub_extra" })}
      >
        <span className="zl-hub-extra-photo" aria-hidden="true" style={{ backgroundImage: `url(${optimizeImageUrl(extra.cover, 200)})` }} />
        <span className="zl-hub-extra-body">
          <small>Do łazienki i kuchni</small>
          <strong>{extra.name}</strong>
          <span>
            Wygląd drewna, a nie chłoną wody{extraSummary?.widthsMm.length ? ` · lamele ${extraSummary.widthsMm.join(" · ")} mm` : ""}
          </span>
        </span>
        <span className="zl-hub-extra-go" aria-hidden="true">
          →
        </span>
      </Link>
    </>
  );
}

function colorCountText(count: number): string {
  if (count === 1) return "1 kolor";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} kolory`;
  return `${count} kolorów`;
}

/**
 * Porównanie materiałów: kolumna bieżącego materiału podświetlona, nagłówki
 * pozostałych prowadzą na ich strony (z wymiarami z konfiguratora).
 */
export function ZaluzjePorownanie({ current }: { current: ZaluzjeRodzajSlug | null }) {
  const hasWindow = useCarryHasWindow(current);
  const columns: ZaluzjeRodzajSlug[] = current === ZALUZJE_EXTRA_SLUG ? [ZALUZJE_EXTRA_SLUG, ...ZALUZJE_MAIN_SLUGS] : ZALUZJE_MAIN_SLUGS;
  const style = { "--zl-cmp-cols": columns.length } as React.CSSProperties;
  return (
    <section id={ZALUZJE_POROWNANIE_ID} className="zlf-section zl-cmp-section" aria-labelledby="zl-cmp-title">
      <p className="zlf-eyebrow">Porównaj materiały</p>
      <h2 id="zl-cmp-title" className="zlf-title">
        Aluminium, drewno czy bambus?
      </h2>
      <p className="zlf-lead">
        {current
          ? hasWindow
            ? "Kliknij inny materiał - Twoje wymiary i montaż przejdą z Tobą, więc od razu porównasz cenę dla tego samego okna."
            : "Kliknij inny materiał, żeby zobaczyć jego zdjęcia, kolory i cenę. Wymiary wpisane w konfiguratorze przejdą z Tobą."
          : "Najważniejsze różnice w jednym miejscu. Grubość lameli i kolor wybierzesz w konfiguratorze na stronie materiału."}
      </p>
      <div className="zl-cmp" role="table" aria-label="Porównanie materiałów żaluzji" style={style}>
        <div className="zl-cmp-row is-head" role="row">
          <span role="columnheader" className="zl-cmp-corner" />
          {columns.map((slug) => {
            const copy = ZALUZJE_RODZAJE[slug];
            const inner = (
              <>
                <span className="zl-cmp-photo" aria-hidden="true" style={{ backgroundImage: `url(${optimizeImageUrl(copy.cover, 200)})` }} />
                <strong>{copy.short}</strong>
                <small>{slug === current ? "Oglądasz" : "Zobacz →"}</small>
              </>
            );
            return (
              <span key={slug} role="columnheader" className={slug === current ? "is-current" : ""}>
                {slug === current ? (
                  <span className="zl-cmp-head">{inner}</span>
                ) : (
                  <Link
                    href={`/zaluzje/${slug}`}
                    className="zl-cmp-head"
                    onClick={() => {
                      if (current) trackSwitch(current, slug, "porownanie", hasWindow);
                      else trackShopStep("zaluzje_rodzaj", slug, { source: "hub_porownanie" });
                    }}
                  >
                    {inner}
                  </Link>
                )}
              </span>
            );
          })}
        </div>
        {ZALUZJE_COMPARE.map((row) => (
          <div className="zl-cmp-row" role="row" key={row.label}>
            <span role="rowheader">{row.label}</span>
            {columns.map((slug) => (
              <span key={slug} role="cell" className={slug === current ? "is-current" : ""}>
                {row.values[slug]}
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
