"use client";

// Rysunek żaluzji z wyborów klienta (właściciel, 18.10.2026: "kodem narysuj
// wybory - posklejaj i daj, jak to będzie wyglądało"). Czyste SVG w
// milimetrach: proporcje = wymiar żaluzji, lamele w kolorze (próbka z CRM
// jako wzór), drabinka sznurkowa albo taśmy, belka z maskownicą i boczkami,
// przekładnia/pokrętło i hamulec po wybranych stronach, prowadzenie boczne,
// tło wg montażu (wnęka w ścianie albo okno) i linie wymiarowe. Przełącznik
// "opuszczona / podniesiona" (pakiet wg _specs.json). Ten sam komponent
// (compact) w "Dodano do koszyka" i w koszyku. Dane są zwykłym obiektem, więc
// zapisują się razem z pozycją koszyka.
import { useId, useState } from "react";
import type { ZaluzjaDetailGroup, ZaluzjaDrawingData } from "./zaluzja-drawing-data";

export type { ZaluzjaDrawingData, ZaluzjaDetailGroup } from "./zaluzja-drawing-data";

const cmText = (mm: number) => (mm / 10).toLocaleString("pl-PL", { maximumFractionDigits: 1 });

function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || "").trim());
  if (!m) return amount < 0 ? "rgba(0,0,0,0.35)" : "rgba(255,255,255,0.4)";
  const num = parseInt(m[1], 16);
  const ch = (shift: number) => {
    const c = (num >> shift) & 255;
    const v = amount < 0 ? c * (1 + amount) : c + (255 - c) * amount;
    return Math.max(0, Math.min(255, Math.round(v)));
  };
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

export default function ZaluzjaDrawing({ data, compact = false, label }: { data: ZaluzjaDrawingData; compact?: boolean; label?: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const [raised, setRaised] = useState(false);
  const w = Math.max(200, data.widthMm);
  const h = Math.max(200, data.heightMm);
  const wall = data.mount === "na-sciane";
  const lw = wall && data.lightWidthMm > 0 ? Math.min(data.lightWidthMm, w) : 0;
  const lh = wall && data.lightHeightMm > 0 ? Math.min(data.lightHeightMm, h) : 0;
  const slatColor = /^#?[0-9a-f]{6}$/i.test(data.slatColor) ? (data.slatColor.startsWith("#") ? data.slatColor : `#${data.slatColor}`) : "#c9a77c";
  const tapeColor = /^#?[0-9a-f]{6}$/i.test(data.tapeColor) ? (data.tapeColor.startsWith("#") ? data.tapeColor : `#${data.tapeColor}`) : "#d8d1c6";

  // Zasięg rysunku (tło + miejsce na wymiary).
  const frameOut = wall ? 0 : data.mount === "w-swietle-szyby" ? 110 : 60;
  const sillH = wall ? Math.max(25, h * 0.02) : 0;
  const ext = Math.max(w, h);
  const u = ext / 100; // jednostka grubości linii i tekstu
  const valH = data.valance ? Math.max(data.slatMm * 1.3, 40) : 0;
  const headH = Math.max(25, Math.min(55, data.slatMm * 0.7));
  const sideW = Math.max(20, Math.max(data.widthMm, data.heightMm) * 0.018);
  const leftPad = (wall ? Math.max(0, 0) : frameOut) + (data.guides ? 14 : 0) + (data.valance === "both" || data.valance === "left" ? sideW : 0) + 4 * u;
  const rightPad = (wall ? 0 : frameOut) + (data.guides ? 14 : 0) + (data.valance === "both" || data.valance === "right" ? sideW : 0) + (compact ? 4 * u : 14 * u);
  const topPad = (wall ? 0 : frameOut) + 4 * u;
  const bottomPad = (wall ? sillH : frameOut) + (compact ? 4 * u : wall && lw ? 20 * u : 12 * u);
  const vb = { x: -leftPad, y: -topPad, w: w + leftPad + rightPad, h: h + topPad + bottomPad };

  // Lamele: podziałka jak w żaluzji (ok. 0,85 szerokości lameli), maks. 70 na rysunku.
  const bottomH = Math.max(data.slatMm * 0.5, 18);
  const regionTop = headH;
  const stack = Math.max(headH + bottomH + 10, data.stackMm > 0 ? Math.min(data.stackMm, h * 0.6) : h * 0.15);
  const bottomY = raised ? stack - bottomH : h - bottomH;
  const regionH = Math.max(1, bottomY - regionTop);
  const realCount = Math.max(1, Math.floor((h - headH - bottomH) / (data.slatMm * 0.85)));
  const shown = Math.min(raised ? Math.min(realCount, Math.max(4, Math.floor(regionH / (u * 0.9)))) : realCount, 70);
  const pitch = regionH / shown;
  const slats: number[] = [];
  for (let i = 0; i < shown; i += 1) slats.push(regionTop + i * pitch);
  const slatThick = raised ? Math.max(pitch * 0.85, u * 0.4) : pitch * 0.72;

  // Drabinki co ok. 55 cm.
  const ladderCount = Math.max(2, Math.ceil(w / 550));
  const ladderX = Array.from({ length: ladderCount }, (_, i) => w * (0.09 + (0.82 * i) / (ladderCount - 1)));
  const tapeW = data.slatMm >= 50 ? 38 : 25;
  const ladderBottom = bottomY + bottomH;

  // Sterowanie.
  const sideX = (side: "left" | "right", inset: number) => (side === "left" ? w * 0.035 + inset : w - w * 0.035 - inset);
  const tiltX = sideX(data.tilter, 0);
  const brakeX = sideX(data.brake, data.brake === data.tilter ? Math.max(18, w * 0.03) : 0);
  const crankLen = data.control === "crank" ? Math.min(h * 0.9, Math.max(300, data.crankMm || 750)) : 0;
  const tiltLen = data.control === "crank" ? crankLen : h * 0.55;
  const liftLen = (raised ? stack : 0) + h * (raised ? 0.6 : 0.72);
  const textSize = compact ? 0 : Math.max(3.2 * u, 12);
  // Podpisy przekładni i hamulca - gdy po tej samej stronie i na podobnej wysokości, rozsuń.
  const tiltLabelY = headH + tiltLen + textSize * 2.1;
  let brakeLabelY = headH + liftLen + Math.max(22, u * 2.2) + textSize * 1.3;
  if (data.tilter === data.brake && Math.abs(tiltLabelY - brakeLabelY) < textSize * 1.3) brakeLabelY = tiltLabelY + textSize * 1.3;

  // Próbki kolorów w CRM to zdjęcia gotowej żaluzji na oknie (z widokiem za
  // szybą), więc jako wzór wypełnienia dawałyby obraz okna - lamele i taśmy
  // rysujemy kolorem średnim z cieniowaniem.
  const slatFill = slatColor;
  const tapeFill = /^#?[0-9a-f]{6}$/i.test(data.tapeColor) ? tapeColor : shade(slatColor, -0.12);

  const glass = (x: number, y: number, ww: number, hh: number) => (
    <g>
      <rect x={x} y={y} width={ww} height={hh} fill="#cfe4f5" />
      <path d={`M${x + ww * 0.12} ${y + hh} L${x + ww * 0.55} ${y}`} stroke="#fff" strokeOpacity="0.55" strokeWidth={ww * 0.05} />
    </g>
  );

  return (
    <figure className={`zl-drawing ${compact ? "is-compact" : ""}`}>
      {!compact ? (
        <div className="zl-drawing-toggle" role="group" aria-label="Widok żaluzji">
          <button type="button" className={!raised ? "is-active" : ""} aria-pressed={!raised} onClick={() => setRaised(false)}>
            Opuszczona
          </button>
          <button type="button" className={raised ? "is-active" : ""} aria-pressed={raised} onClick={() => setRaised(true)}>
            Podniesiona
          </button>
        </div>
      ) : null}
      <svg viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`} role="img" aria-label={label || `Rysunek żaluzji ${cmText(w)} × ${cmText(h)} cm`} preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id={`sh${uid}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#fff" stopOpacity="0.35" />
            <stop offset="55%" stopColor="#fff" stopOpacity="0" />
            <stop offset="100%" stopColor="#000" stopOpacity="0.28" />
          </linearGradient>
        </defs>

        {/* tło wg montażu */}
        {wall ? (
          <g>
            <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} fill="#e9e4dc" />
            {lw && lh ? (
              <g>
                <rect x={(w - lw) / 2} y={h - lh} width={lw} height={lh} fill="#dfe4ea" stroke="#9aa4ae" strokeWidth={u * 0.25} />
                <rect x={(w - lw) / 2 + lw * 0.05} y={h - lh + lh * 0.04} width={lw * 0.9} height={lh * 0.92} fill="#f7f9fb" stroke="#b6bec7" strokeWidth={u * 0.2} />
                {glass((w - lw) / 2 + lw * 0.1, h - lh + lh * 0.08, lw * 0.8, lh * 0.84)}
                <rect x={(w - lw) / 2 - 40} y={h} width={lw + 80} height={sillH} fill="#c7ccd2" />
              </g>
            ) : null}
          </g>
        ) : (
          <g>
            <rect x={-frameOut} y={-frameOut} width={w + 2 * frameOut} height={h + 2 * frameOut} fill="#f7f9fb" stroke="#9aa4ae" strokeWidth={u * 0.25} />
            {data.mount === "w-swietle-szyby" ? <rect x={-frameOut * 0.12} y={-frameOut * 0.12} width={w + frameOut * 0.24} height={h + frameOut * 0.24} fill="#59616b" /> : null}
            {glass(data.mount === "w-swietle-szyby" ? 0 : w * 0.06, data.mount === "w-swietle-szyby" ? 0 : h * 0.05, data.mount === "w-swietle-szyby" ? w : w * 0.88, data.mount === "w-swietle-szyby" ? h : h * 0.9)}
          </g>
        )}

        {/* prowadzenie boczne */}
        {data.guides ? (
          <g stroke="#7d8792" strokeWidth={Math.max(3, u * 0.35)}>
            <line x1={-9} x2={-9} y1={headH} y2={h} />
            <line x1={w + 9} x2={w + 9} y1={headH} y2={h} />
          </g>
        ) : null}

        {/* drabinka sznurkowa - za lamelami (tył) */}
        {data.ladder === "cord"
          ? ladderX.map((x) => (
              <g key={`c${x}`} stroke={shade(slatColor, -0.45)} strokeWidth={Math.max(1.2, u * 0.12)} opacity="0.85">
                <line x1={x - 6} x2={x - 6} y1={headH} y2={ladderBottom} />
                <line x1={x + 6} x2={x + 6} y1={headH} y2={ladderBottom} />
              </g>
            ))
          : null}

        {/* lamele */}
        {slats.map((y, i) => (
          <g key={i}>
            <rect x={0} y={y} width={w} height={slatThick} fill={slatFill} />
            <rect x={0} y={y} width={w} height={slatThick} fill={`url(#sh${uid})`} />
          </g>
        ))}
        {/* belka dolna */}
        <rect x={0} y={bottomY} width={w} height={bottomH} fill={slatFill} />
        <rect x={0} y={bottomY} width={w} height={bottomH} fill={`url(#sh${uid})`} />
        <rect x={0} y={bottomY} width={w} height={bottomH} fill="none" stroke={shade(slatColor, -0.35)} strokeWidth={u * 0.12} />

        {/* sznurki drabinki z przodu (przechodzą przez lamele) */}
        {data.ladder === "cord"
          ? ladderX.map((x) => <line key={`f${x}`} x1={x} x2={x} y1={headH} y2={ladderBottom} stroke={shade(slatColor, -0.5)} strokeWidth={Math.max(1, u * 0.1)} opacity="0.7" />)
          : null}
        {/* taśmy */}
        {data.ladder === "tape"
          ? ladderX.map((x) => (
              <g key={`t${x}`}>
                <rect x={x - tapeW / 2} y={headH * 0.6} width={tapeW} height={ladderBottom - headH * 0.6} fill={tapeFill} stroke={shade(tapeColor, -0.3)} strokeWidth={u * 0.08} />
                <rect x={x - tapeW / 2} y={headH * 0.6} width={tapeW * 0.25} height={ladderBottom - headH * 0.6} fill="#fff" opacity="0.18" />
              </g>
            ))
          : null}

        {/* belka górna i maskownica */}
        <rect x={-4} y={0} width={w + 8} height={headH} fill={data.valance ? shade(slatColor, -0.15) : "#d9dde2"} stroke="#8b949e" strokeWidth={u * 0.1} />
        {data.valance ? (
          <g>
            <rect x={-6} y={-valH * 0.1} width={w + 12} height={valH} fill={slatFill} />
            <rect x={-6} y={-valH * 0.1} width={w + 12} height={valH} fill={`url(#sh${uid})`} />
            <rect x={-6} y={-valH * 0.1} width={w + 12} height={valH} fill="none" stroke={shade(slatColor, -0.4)} strokeWidth={u * 0.12} />
            {data.valance === "both" || data.valance === "left" ? (
              <path d={`M${-6} ${-valH * 0.1} L${-6 - sideW} ${valH * 0.05} L${-6 - sideW} ${valH * 0.95} L${-6} ${valH * 0.9} Z`} fill={shade(slatColor, -0.3)} stroke={shade(slatColor, -0.5)} strokeWidth={u * 0.1} />
            ) : null}
            {data.valance === "both" || data.valance === "right" ? (
              <path d={`M${w + 6} ${-valH * 0.1} L${w + 6 + sideW} ${valH * 0.05} L${w + 6 + sideW} ${valH * 0.95} L${w + 6} ${valH * 0.9} Z`} fill={shade(slatColor, -0.3)} stroke={shade(slatColor, -0.5)} strokeWidth={u * 0.1} />
            ) : null}
          </g>
        ) : null}

        {/* przekładnia: pokrętło albo sznurki przechyłu */}
        {data.control === "crank" ? (
          <g>
            <line x1={tiltX} x2={tiltX} y1={headH} y2={headH + crankLen} stroke="#7b8590" strokeWidth={Math.max(6, u * 0.6)} strokeLinecap="round" />
            <rect x={tiltX - Math.max(6, u * 0.6)} y={headH + crankLen - Math.max(10, u)} width={Math.max(12, u * 1.2)} height={Math.max(26, u * 2.6)} rx={Math.max(4, u * 0.4)} fill="#7d8792" />
          </g>
        ) : (
          <g stroke="#6b5a45" strokeWidth={Math.max(1.4, u * 0.14)}>
            <line x1={tiltX - 5} x2={tiltX - 5} y1={headH} y2={headH + tiltLen} />
            <line x1={tiltX + 5} x2={tiltX + 5} y1={headH} y2={headH + tiltLen * 0.96} />
            <circle cx={tiltX - 5} cy={headH + tiltLen} r={Math.max(5, u * 0.55)} fill={shade(slatColor, -0.2)} />
            <circle cx={tiltX + 5} cy={headH + tiltLen * 0.96} r={Math.max(5, u * 0.55)} fill={shade(slatColor, -0.2)} />
          </g>
        )}
        {/* hamulec + sznurek podnoszenia */}
        <g>
          <rect x={brakeX - Math.max(6, u * 0.6)} y={headH * 0.2} width={Math.max(12, u * 1.2)} height={headH * 0.6} rx="3" fill="#4b5563" />
          <line x1={brakeX} x2={brakeX} y1={headH} y2={headH + liftLen} stroke="#6b5a45" strokeWidth={Math.max(1.4, u * 0.14)} />
          <rect x={brakeX - Math.max(5, u * 0.5)} y={headH + liftLen} width={Math.max(10, u)} height={Math.max(22, u * 2.2)} rx={Math.max(4, u * 0.45)} fill={shade(slatColor, -0.2)} stroke="#6b5a45" strokeWidth={u * 0.08} />
        </g>

        {/* napisy i wymiary (pełna wersja) */}
        {!compact ? (
          <g fontFamily="inherit" fontWeight="700" fill="#0e1a2a">
            <text x={tiltX} y={tiltLabelY} fontSize={textSize * 0.8} textAnchor={data.tilter === "left" ? "start" : "end"} paintOrder="stroke" stroke="#fff" strokeWidth={textSize * 0.25}>
              {data.control === "crank" ? `pokrętło${data.crankMm ? ` ${cmText(data.crankMm)} cm` : ""}` : "przekładnia"}
            </text>
            <text x={brakeX} y={brakeLabelY} fontSize={textSize * 0.8} textAnchor={data.brake === "left" ? "start" : "end"} paintOrder="stroke" stroke="#fff" strokeWidth={textSize * 0.25}>
              hamulec
            </text>
            {data.ladder === "tape" && data.tapeLabel && !raised ? (
              <text x={ladderX[Math.floor(ladderX.length / 2)]} y={ladderBottom - textSize * 0.6} fontSize={textSize * 0.75} textAnchor="middle" paintOrder="stroke" stroke="#fff" strokeWidth={textSize * 0.25}>
                {data.tapeLabel}
              </text>
            ) : null}
            {wall && lh ? (
              <g>
                <line x1={-2 * u} x2={w + 2 * u} y1={h - lh} y2={h - lh} stroke="#ef4444" strokeWidth={u * 0.22} strokeDasharray={`${u * 1.2} ${u * 0.8}`} />
                <text x={w / 2} y={raised ? h - lh + textSize * 1.2 : h - lh - textSize * 0.45} fontSize={textSize * 0.8} textAnchor="middle" fill="#b91c1c" paintOrder="stroke" stroke="#fff" strokeWidth={textSize * 0.25}>
                  {raised ? "pakiet schowany nad wnęką" : "od tej linii w górę - pakiet nad wnęką"}
                </text>
              </g>
            ) : null}
            {/* szerokość */}
            {(() => {
              const y = h + (wall ? sillH : frameOut) + 5 * u;
              return (
                <g>
                  <line x1={0} x2={w} y1={y} y2={y} stroke="#0e1a2a" strokeWidth={u * 0.2} />
                  <line x1={0} x2={0} y1={y - 1.5 * u} y2={y + 1.5 * u} stroke="#0e1a2a" strokeWidth={u * 0.2} />
                  <line x1={w} x2={w} y1={y - 1.5 * u} y2={y + 1.5 * u} stroke="#0e1a2a" strokeWidth={u * 0.2} />
                  <text x={w / 2} y={y + textSize * 1.25} fontSize={textSize} textAnchor="middle">
                    {cmText(w)} cm
                  </text>
                  {wall && lw ? (
                    <g>
                      <line x1={(w - lw) / 2} x2={(w + lw) / 2} y1={y + textSize * 2.2} y2={y + textSize * 2.2} stroke="#64748b" strokeWidth={u * 0.18} strokeDasharray={`${u} ${u * 0.6}`} />
                      <text x={w / 2} y={y + textSize * 3.4} fontSize={textSize * 0.85} textAnchor="middle" fill="#475569">
                        światło {cmText(lw)} × {cmText(lh)} cm
                      </text>
                    </g>
                  ) : null}
                </g>
              );
            })()}
            {/* wysokość */}
            {(() => {
              const x = w + (wall ? 0 : frameOut) + (data.guides ? 14 : 0) + (data.valance === "both" || data.valance === "right" ? sideW : 0) + 5 * u;
              return (
                <g>
                  <line x1={x} x2={x} y1={0} y2={h} stroke="#0e1a2a" strokeWidth={u * 0.2} />
                  <line x1={x - 1.5 * u} x2={x + 1.5 * u} y1={0} y2={0} stroke="#0e1a2a" strokeWidth={u * 0.2} />
                  <line x1={x - 1.5 * u} x2={x + 1.5 * u} y1={h} y2={h} stroke="#0e1a2a" strokeWidth={u * 0.2} />
                  <text x={x + textSize * 1.1} y={h / 2} fontSize={textSize} textAnchor="middle" transform={`rotate(-90 ${x + textSize * 1.1} ${h / 2})`}>
                    {cmText(h)} cm
                  </text>
                </g>
              );
            })()}
          </g>
        ) : null}
      </svg>
    </figure>
  );
}

/** Szczegóły pozycji w grupach (podsumowanie konfiguratora, toast, koszyk). */
export function ZaluzjaDetailGroups({ groups, className = "" }: { groups: ZaluzjaDetailGroup[]; className?: string }) {
  return (
    <div className={`zl-details ${className}`}>
      {groups.map((group) => (
        <section key={group.title} className="zl-details-group">
          <h4>{group.title}</h4>
          <dl>
            {group.rows.map((row, index) => (
              <div key={`${row.label}-${index}`} className="zl-details-row">
                <dt className="zl-dt">{row.label}</dt>
                <dd className="zl-dd">{row.value}</dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}
