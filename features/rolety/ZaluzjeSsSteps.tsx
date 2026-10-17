"use client";

// Kroki konfiguratora żaluzji z opcjami dostawcy Sun & Shade (po kolorze
// lameli): 4) drabinka sznurkowa czy taśma, 5) strona przekładni i hamulca,
// 6) typ maskownicy (+ inne pola wymagane modelu: maskownica i belka,
// maskownica drewniana, kolor drewna, kolor mechanizmu, długość pokrętła),
// 7) uchwyty montażowe + "Montaż bez wiercenia", 8) Dodatki (zwinięte).
// Stan wyboru trzyma ConfiguratorPanel (selection / noDrill), logika i
// dopłaty: ss-options.ts. Dopłata widoczna przy każdej opcji; koszt u
// dostawcy (costDelta) nigdy nie jest pokazywany.
import { useState, type ReactNode } from "react";
import { trackShopStep } from "@/lib/track-step";
import {
  ssBracketCount,
  ssCleanLabel,
  ssField,
  ssFieldApplies,
  ssNoneOption,
  ssOption,
  ssOptionDelta,
  ssTilterLabel,
  ssVisibleOptions,
  type SsField,
  type SsModelOptions,
  type SsOption,
  type SsSelection,
} from "./ss-options";

function formatDelta(amount: number): string {
  return `+${amount.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} zł`;
}

/** Zdjęcie opcji z CRM; gdy go nie ma (jeszcze nie wgrane) - kafelek bez zdjęcia. */
function OptionImage({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="zs-opt-img" src={src} alt={alt} loading="lazy" onError={() => setFailed(true)} />;
}

const REQUIRED_EXTRA_ATTRS = ["26", "18", "50", "19", "25", "23"];
const ADDON_ORDER = ["30", "60", "58", "57", "29", "47", "48", "34", "51"];

export default function ZaluzjeSsSteps({
  model,
  selection,
  onChange,
  noDrill,
  onNoDrillChange,
  widthMm,
  mountId,
  firstStepNo,
}: {
  model: SsModelOptions;
  selection: SsSelection;
  onChange: (attr: string, v: string) => void;
  noDrill: boolean;
  onNoDrillChange: (on: boolean) => void;
  widthMm: number;
  mountId: string;
  colorV: string;
  firstStepNo: number;
}) {
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const ctx = { widthMm, noDrill };
  const toggle = (key: string) => setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  const pick = (field: SsField, option: SsOption, collapse = true) => {
    trackShopStep("zaluzje_option", `${field.title}: ${option.label}`, { attr: field.attr, v: option.v });
    onChange(field.attr, option.v);
    if (collapse) setCollapsed((prev) => ({ ...prev, [field.attr]: true }));
  };

  let stepNo = firstStepNo;
  const sections: ReactNode[] = [];

  function head(key: string, no: number, title: string, done: boolean, meta: ReactNode) {
    const isCollapsed = Boolean(collapsed[key]);
    return (
      <button type="button" className="hero-product-step-head" onClick={() => toggle(key)} aria-expanded={isCollapsed ? "false" : "true"}>
        <span className="hero-product-config-step-title hero-product-config-step-title--muted">
          <span className={`hero-product-step-check ${done ? "" : "is-muted"}`} aria-hidden="true">
            {done ? "✓" : String(no)}
          </span>
          {title}
        </span>
        <span className="hero-product-step-head-meta">
          {meta}
          {isCollapsed ? <span className="hero-product-step-head-change">Zmień</span> : <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>}
        </span>
      </button>
    );
  }

  function optionCard(field: SsField, option: SsOption, opts: { badge?: ReactNode; disabled?: boolean; label?: string; note?: ReactNode; compact?: boolean } = {}) {
    const isActive = selection[field.attr] === option.v;
    const delta = ssOptionDelta(field, option, widthMm);
    return (
      <button
        key={option.v}
        type="button"
        className={`zs-opt ${opts.compact ? "is-compact" : ""} ${isActive ? "is-active" : ""} ${opts.disabled ? "is-disabled" : ""}`}
        aria-pressed={isActive}
        disabled={opts.disabled}
        onClick={() => pick(field, option)}
      >
        {!opts.compact ? <OptionImage src={option.img} alt={option.label} /> : null}
        <span className="zs-opt-text">
          <strong>{opts.label || ssCleanLabel(option.label)}</strong>
          {option.code ? <small>{option.code}</small> : null}
          {opts.note}
        </span>
        {delta > 0 ? <span className="zs-opt-delta">{formatDelta(delta)}</span> : null}
        {opts.badge}
        {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
      </button>
    );
  }

  function section(key: string, title: string, field: SsField | null, body: ReactNode, metaText?: string) {
    const no = stepNo++;
    const selected = field ? ssOption(field, selection[field.attr]) : null;
    sections.push(
      <section key={key} className={`hero-product-step-accordion zs-step ${collapsed[key] ? "is-collapsed" : ""}`}>
        {head(key, no, title, Boolean(selected) || Boolean(metaText), <strong>{metaText || (selected ? ssCleanLabel(field?.attr === "16" ? ssTilterLabel(selected.label) : selected.label) : "")}</strong>)}
        <div className="hero-product-step-body" style={collapsed[key] ? undefined : { maxHeight: "none", overflow: "visible" }}>
          {body}
        </div>
      </section>,
    );
  }

  // Drabinka (pole 7) jest w ZaluzjeLadderSteps.tsx - przed ceną.
  // Strona przekładni i hamulca (attr 16)
  const f16 = ssField(model, "16");
  if (f16 && f16.role !== "hidden") {
    section(
      "16",
      "Strona przekładni i hamulca",
      f16,
      <>
        <p className="hero-product-config-hint">Patrząc na okno od środka pokoju. Przekładnia obraca lamele, hamulec trzyma sznurek podnoszenia.</p>
        <div className="zs-grid">{ssVisibleOptions(f16, selection["16"]).map((option) => optionCard(f16, option, { label: ssTilterLabel(option.label) }))}</div>
      </>,
    );
  }

  // 6) Typ maskownicy (26) i inne pola wymagane modelu
  for (const attr of REQUIRED_EXTRA_ATTRS) {
    const field = ssField(model, attr);
    if (!field || field.role !== "required" || !ssFieldApplies(model, field, selection, ctx)) continue;
    const options = ssVisibleOptions(field, selection[attr]);
    const compact = options.length > 8;
    section(
      attr,
      field.title,
      field,
      <div className={`zs-grid ${compact ? "zs-grid--compact" : ""}`}>{options.map((option) => optionCard(field, option, { compact }))}</div>,
    );
  }

  // 7) Uchwyty montażowe (22) + montaż bez wiercenia (56)
  const f22 = ssField(model, "22");
  const f56 = ssField(model, "56");
  if (f22) {
    const recommended = mountId === "na-sciane" ? /uniwersaln|ścienn/i : /uniwersaln|sufitow/i;
    const bracketNonInvasive = f22.options.find((option) => /bezinwazyjn/i.test(option.label)) || null;
    const none56 = ssNoneOption(f56);
    const options56 = f56 ? ssVisibleOptions(f56, selection["56"]).filter((option) => option.v !== none56?.v) : [];
    const lock22 = noDrill && Boolean(bracketNonInvasive);
    const metaText = noDrill && f56 ? `Bez wiercenia: ${ssCleanLabel(ssOption(f56, selection["56"])?.label || "")}` : undefined;
    section(
      "22",
      "Uchwyty montażowe",
      f22,
      <>
        {f56 ? (
          <label className="zl-exact-toggle zs-nodrill">
            <input
              type="checkbox"
              checked={noDrill}
              onChange={(event) => {
                trackShopStep("zaluzje_no_drill", event.target.checked ? "on" : "off", {});
                onNoDrillChange(event.target.checked);
              }}
            />
            Montaż bez wiercenia (mocowania bezinwazyjne)
          </label>
        ) : null}
        {noDrill && f56 ? (
          <>
            <p className="zs-subtitle">
              Mocowania bezinwazyjne - {ssBracketCount(widthMm)} szt. przy szerokości {Math.round(widthMm / 10)} cm:
            </p>
            <div className="zs-grid">
              {options56.map((option) => optionCard(f56, option, { note: <span className="zs-opt-note">dla okna bez nawiewnika, jeśli nie podano inaczej</span> }))}
            </div>
          </>
        ) : null}
        {lock22 && bracketNonInvasive ? (
          <p className="hero-product-config-hint">Uchwyty: {ssCleanLabel(bracketNonInvasive.label)} - wymagane przy montażu bez wiercenia.</p>
        ) : (
          <>
            {noDrill && f56 ? <p className="zs-subtitle">Klamry, które dostawca dołącza do żaluzji:</p> : null}
            <div className="zs-grid">
              {ssVisibleOptions(f22, selection["22"])
                .filter((option) => option.v !== bracketNonInvasive?.v)
                .map((option) =>
                  optionCard(f22, option, {
                    badge: recommended.test(option.label) ? <span className="zs-opt-flag is-good">polecane</span> : null,
                  }),
                )}
            </div>
          </>
        )}
      </>,
      metaText,
    );
  }

  // 8) Dodatki (zwinięte)
  const addons = ADDON_ORDER.map((attr) => ssField(model, attr)).filter(
    (field): field is SsField => Boolean(field) && field!.role === "optional" && ssFieldApplies(model, field!, selection, ctx),
  );
  const addonsTotal = addons.reduce((sum, field) => sum + ssOptionDelta(field, ssOption(field, selection[field.attr]), widthMm), 0);

  return (
    <div className="zs-steps">
      {sections}
      {addons.length ? (
        <details className="zs-addons">
          <summary>
            <span>{stepNo}. Dodatki (opcjonalnie)</span>
            {addonsTotal > 0 ? <strong>{formatDelta(addonsTotal)}</strong> : <small>bez dopłat</small>}
          </summary>
          {addons.map((field) => {
            const options = ssVisibleOptions(field, selection[field.attr]);
            const compact = options.length > 8;
            return (
              <div key={field.attr} className="zs-addon">
                <h4>{field.title}</h4>
                {field.pricing === "perMm" ? <p className="zs-opt-note">Dopłata zależy od szerokości żaluzji.</p> : null}
                <div className={`zs-grid ${compact ? "zs-grid--compact" : ""}`}>
                  {options.map((option) => {
                    const isActive = selection[field.attr] === option.v;
                    const delta = ssOptionDelta(field, option, widthMm);
                    return (
                      <button
                        key={option.v}
                        type="button"
                        className={`zs-opt is-compact ${isActive ? "is-active" : ""}`}
                        aria-pressed={isActive}
                        onClick={() => pick(field, option, false)}
                      >
                        <span className="zs-opt-text">
                          <strong>{ssCleanLabel(option.label)}</strong>
                          {option.code ? <small>{option.code}</small> : null}
                        </span>
                        {delta > 0 ? <span className="zs-opt-delta">{formatDelta(delta)}</span> : null}
                        {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </details>
      ) : null}
    </div>
  );
}
