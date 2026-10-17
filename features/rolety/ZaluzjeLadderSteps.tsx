"use client";

// Drabinka żaluzji w dwóch krokach (właściciel, 17.10.2026), PRZED ceną:
//  4) Rodzaj drabinki - "Drabinka sznurkowa" albo "Taśma" (pomijany, gdy model
//     nie ma sznurka - RETRO - albo w ogóle nie ma pola 7 - aluminium);
//  5) Kolor drabinki / taśmy - na pierwszym miejscu STANDARD "dobrany do koloru
//     lameli" (preselekcja), potem pozostałe taśmy z dostępnością wg koloru
//     lameli. Sznurek: tylko STANDARD jako informacja (S&S nie oferuje innych).
// Wartość pola 7 w wyborze: "" = nie wybrano, v sznurka (15), v taśmy albo
// "standard". Dopłata taśm procentowa (deltaPercent) od ceny żaluzji.
import { useState } from "react";
import { trackShopStep } from "@/lib/track-step";
import {
  SS_TAPE_STANDARD,
  ssCleanLabel,
  ssLadderInfo,
  ssTapeResolve,
  ssTapeStatus,
  type SsModelOptions,
  type SsOption,
  type SsSelection,
} from "./ss-options";

function OptionImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="zs-opt-img" src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

function pctText(pct: number): string {
  return `+${pct.toLocaleString("pl-PL", { maximumFractionDigits: 1 })} %`;
}

export default function ZaluzjeLadderSteps({
  model,
  selection,
  onChange,
  colorV,
  colorLabel,
  basePrice,
  firstStepNo,
}: {
  model: SsModelOptions;
  selection: SsSelection;
  onChange: (v: string) => void;
  colorV: string;
  colorLabel: string;
  /** Cena żaluzji (komórka × dopłata koloru lameli) - do kwot dopłat procentowych. */
  basePrice: number | null;
  firstStepNo: number;
}) {
  const info = ssLadderInfo(model, colorV);
  const [kindCollapsed, setKindCollapsed] = useState(false);
  const [colorCollapsed, setColorCollapsed] = useState(false);
  if (!info.hasField) return null;
  const value = selection["7"] || "";
  const resolved = ssTapeResolve(model, selection, colorV);
  const kind = resolved.kind;
  const formatZl = (amount: number) => `${amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
  const amountFor = (pct: number) => (basePrice !== null && pct > 0 ? Math.round(basePrice * pct) / 100 : null);
  let stepNo = firstStepNo;

  function head(no: number, title: string, done: boolean, meta: string, collapsed: boolean, toggle: () => void) {
    return (
      <button type="button" className="hero-product-step-head" onClick={toggle} aria-expanded={collapsed ? "false" : "true"}>
        <span className="hero-product-config-step-title hero-product-config-step-title--muted">
          <span className={`hero-product-step-check ${done ? "" : "is-muted"}`} aria-hidden="true">
            {done ? "✓" : String(no)}
          </span>
          {title}
        </span>
        <span className="hero-product-step-head-meta">
          {meta ? <strong>{meta}</strong> : null}
          {collapsed ? <span className="hero-product-step-head-change">Zmień</span> : <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>}
        </span>
      </button>
    );
  }

  const tapePctRange = info.tapePctRange;
  const tapePctNote =
    tapePctRange.max > 0
      ? tapePctRange.min === tapePctRange.max
        ? `Dopłata ${pctText(tapePctRange.max)} do ceny żaluzji${amountFor(tapePctRange.max) !== null ? ` (ok. ${formatZl(amountFor(tapePctRange.max)!)} przy tym wymiarze)` : ""}.`
        : `Dopłata od ${tapePctRange.min > 0 ? pctText(tapePctRange.min).replace("+", "") : "0 %"} do ${pctText(tapePctRange.max).replace("+", "")} ceny żaluzji, zależnie od koloru taśmy${amountFor(tapePctRange.max) !== null ? ` (maks. ${formatZl(amountFor(tapePctRange.max)!)} przy tym wymiarze)` : ""}.`
      : "Bez dopłaty.";

  const sections = [];

  // 4) Rodzaj drabinki
  if (info.cordOption && info.tapeOptions.length) {
    const no = stepNo++;
    sections.push(
      <section key="kind" className={`hero-product-step-accordion zs-step zs-ladder-kind ${kindCollapsed && kind ? "is-collapsed" : ""}`}>
        {head(no, "Rodzaj drabinki", Boolean(kind), kind === "cord" ? "Drabinka sznurkowa" : kind === "tape" ? "Taśma" : "", kindCollapsed && Boolean(kind), () => setKindCollapsed((prev) => !prev))}
        <div className="hero-product-step-body" style={kindCollapsed && kind ? undefined : { maxHeight: "none", overflow: "visible" }}>
          <div className="zs-grid zs-grid--kinds">
            <button
              type="button"
              className={`zs-opt zs-kind ${kind === "cord" ? "is-active" : ""}`}
              aria-pressed={kind === "cord"}
              onClick={() => {
                trackShopStep("zaluzje_ladder_kind", "sznurek", {});
                onChange(info.cordOption!.v);
                setKindCollapsed(true);
              }}
            >
              <OptionImage src={info.cordOption.img} alt="Drabinka sznurkowa" />
              <span className="zs-opt-text">
                <strong>Drabinka sznurkowa</strong>
                <span className="zs-opt-note">Cienkie sznurki między lamelami. Bez dopłaty.</span>
              </span>
              {kind === "cord" ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
            </button>
            <button
              type="button"
              className={`zs-opt zs-kind ${kind === "tape" ? "is-active" : ""}`}
              aria-pressed={kind === "tape"}
              onClick={() => {
                trackShopStep("zaluzje_ladder_kind", "tasma", {});
                if (kind !== "tape") onChange(SS_TAPE_STANDARD);
                setKindCollapsed(true);
              }}
            >
              <OptionImage src={info.tapeOptions[0]?.img || ""} alt="Taśma" />
              <span className="zs-opt-text">
                <strong>Taśma</strong>
                <span className="zs-opt-note">Szeroka tasiemka z tkaniny - efekt dekoracyjny.</span>
                <span className="zs-opt-note">{tapePctNote}</span>
                <span className="zs-opt-note">Pakiet po podniesieniu jest z taśmą ok. 12 % wyższy.</span>
              </span>
              {tapePctRange.max > 0 ? <span className="zs-opt-delta">{tapePctRange.min === tapePctRange.max ? pctText(tapePctRange.max) : `do ${pctText(tapePctRange.max)}`}</span> : null}
              {kind === "tape" ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
            </button>
          </div>
        </div>
      </section>,
    );
  }

  // 5) Kolor drabinki / taśmy
  if (kind) {
    const no = stepNo++;
    const isCord = kind === "cord";
    const standardActive = !isCord && value === SS_TAPE_STANDARD;
    const meta = isCord ? "STANDARD" : standardActive ? "STANDARD" : ssCleanLabel(resolved.option?.label || "");
    const standardPct = resolved.standard ? resolved.pct : info.standardPct;
    sections.push(
      <section key="color" className={`hero-product-step-accordion zs-step zs-ladder-color ${colorCollapsed ? "is-collapsed" : ""}`}>
        {head(no, isCord ? "Kolor drabinki" : "Kolor taśmy", true, meta, colorCollapsed, () => setColorCollapsed((prev) => !prev))}
        <div className="hero-product-step-body" style={colorCollapsed ? undefined : { maxHeight: "none", overflow: "visible" }}>
          {isCord ? (
            <div className="zs-standard-card is-active is-info">
              <strong>STANDARD - dobrany do koloru lameli</strong>
              <span>Sznurek w kolorze dobranym do lameli {colorLabel ? `(${colorLabel})` : ""}. Innych kolorów sznurka dostawca nie oferuje.</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                className={`zs-standard-card ${standardActive ? "is-active" : ""}`}
                aria-pressed={standardActive}
                onClick={() => {
                  trackShopStep("zaluzje_tape_color", "standard", {});
                  onChange(SS_TAPE_STANDARD);
                }}
              >
                <strong>STANDARD - dobrany do koloru lameli</strong>
                <span>
                  {info.bestMatch
                    ? `${ssCleanLabel(info.bestMatch.label)}${info.bestMatch.code ? ` (${info.bestMatch.code})` : ""} - polecana do koloru ${colorLabel}.`
                    : `Biuro dobierze taśmę do koloru lameli ${colorLabel}.`}
                </span>
                {standardPct > 0 ? (
                  <span className="zs-opt-delta">
                    {pctText(standardPct)}
                    {amountFor(standardPct) !== null ? ` · ${formatZl(amountFor(standardPct)!)}` : ""}
                    {!info.bestMatch ? " (cena maks., biuro dobierze taśmę)" : ""}
                  </span>
                ) : null}
                {standardActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
              </button>
              <p className="zs-subtitle">albo wybierz kolor taśmy:</p>
              <div className="zs-grid zs-grid--tapes">
                {info.tapeOptions.map((option: SsOption) => {
                  const status = colorV ? ssTapeStatus(model, colorV, option.v) : 0;
                  const isActive = value === option.v;
                  const pct = option.deltaPercent || 0;
                  return (
                    <button
                      key={option.v}
                      type="button"
                      className={`zs-opt ${isActive ? "is-active" : ""} ${status === 2 && !isActive ? "is-disabled" : ""}`}
                      aria-pressed={isActive}
                      disabled={status === 2 && !isActive}
                      onClick={() => {
                        trackShopStep("zaluzje_tape_color", option.label, { v: option.v });
                        onChange(option.v);
                      }}
                    >
                      <OptionImage src={option.img} alt={option.label} />
                      <span className="zs-opt-text">
                        <strong>{ssCleanLabel(option.label)}</strong>
                        {option.code ? <small>{option.code}</small> : null}
                      </span>
                      {pct > 0 ? (
                        <span className="zs-opt-delta">
                          {pctText(pct)}
                          {amountFor(pct) !== null ? ` · ${formatZl(amountFor(pct)!)}` : ""}
                        </span>
                      ) : null}
                      {status === 2 ? <span className="zs-opt-flag is-off">niedostępna do tego koloru</span> : status === 1 ? <span className="zs-opt-flag">ograniczona gwarancja</span> : null}
                      {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                    </button>
                  );
                })}
              </div>
              {resolved.option && ssTapeStatus(model, colorV, resolved.option.v) === 1 ? (
                <p className="zl-handle-warning" role="note">
                  Ta taśma przy wybranym kolorze lameli ma ograniczoną gwarancję - jest ryzyko przebarwienia lamel.
                </p>
              ) : null}
            </>
          )}
        </div>
      </section>,
    );
  }

  return <div className="zs-steps zs-ladder">{sections}</div>;
}
