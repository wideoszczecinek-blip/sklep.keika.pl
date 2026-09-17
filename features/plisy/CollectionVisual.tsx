"use client";

// Fabric-collection picture for the configurator's "Wybierz kolekcję
// tkanin" step (owner, 2026-09-17: the CRM's collection photos are all
// near-white fabric close-ups - "wyglądają wszystkie tak samo i nic nie
// wnoszą"). Each collection gets a small window illustration that shows
// what the fabric DOES: how much light gets through, whether it reflects
// heat, whether it's the honeycomb (DUO) build. Drawn inline so there is
// nothing to photograph, and so the five stay visibly different from each
// other at 64 px.
import type { FabricGroup } from "./shared";

export type PlisyCollectionKind = "sheer" | "reflex" | "blackout" | "duo" | "duo-blackout";

/** Maps a CRM fabric-group id/label onto one of the five illustrations.
 * Ids today: clasic, reflex, blackout, duo, duo-blackout - matched loosely
 * so a renamed group in the CRM still gets a sensible picture. */
export function plisyCollectionKind(group: Pick<FabricGroup, "id" | "label">): PlisyCollectionKind {
  const key = `${group.id} ${group.label}`.toLowerCase();
  const duo = /duo|plaster|honey/.test(key);
  const dark = /blackout|zaciem|podgum|termo|thermo/.test(key);
  if (duo && dark) return "duo-blackout";
  if (duo) return "duo";
  if (dark) return "blackout";
  if (/reflex|refleks/.test(key)) return "reflex";
  return "sheer";
}

const KIND_META: Record<PlisyCollectionKind, { light: string; badges: string[] }> = {
  sheer: { light: "Rozprasza światło, nie zaciemnia", badges: ["Przepuszcza światło"] },
  reflex: { light: "Rozprasza światło, odbija ciepło słońca", badges: ["Przepuszcza światło", "Termo"] },
  blackout: { light: "Zaciemnia — podgumowany rdzeń blokuje światło", badges: ["Zaciemnia"] },
  duo: { light: "Plaster miodu bez otworów pod sznurki — żadnych punktów światła", badges: ["Przepuszcza światło", "Termo"] },
  "duo-blackout": { light: "Plaster miodu z powłoką termiczną — całkowite zaciemnienie", badges: ["Zaciemnia", "Termo"] },
};

export function plisyCollectionMeta(kind: PlisyCollectionKind) {
  return KIND_META[kind];
}

/** Pleats: horizontal bands across the window, alternating a lighter and a
 * darker tone so the folds read as folds. */
function Pleats({ x, y, w, h, light, dark, rows = 7 }: { x: number; y: number; w: number; h: number; light: string; dark: string; rows?: number }) {
  const step = h / rows;
  return (
    <g>
      {Array.from({ length: rows }).map((_, index) => (
        <rect key={index} x={x} y={y + index * step} width={w} height={step + 0.4} fill={index % 2 === 0 ? light : dark} />
      ))}
    </g>
  );
}

/** Honeycomb cells drawn along the left edge, as the DUO fabric shows in
 * profile. */
function Honeycomb({ x, y, h, stroke }: { x: number; y: number; h: number; stroke: string }) {
  const cell = 6;
  const count = Math.floor(h / cell);
  return (
    <g fill="none" stroke={stroke} strokeWidth={1.1}>
      {Array.from({ length: count }).map((_, index) => {
        const cy = y + cell / 2 + index * cell;
        const r = cell / 2 - 0.4;
        const points = Array.from({ length: 6 }).map((__, k) => {
          const angle = (Math.PI / 3) * k + Math.PI / 6;
          return `${(x + r * Math.cos(angle)).toFixed(2)},${(cy + r * Math.sin(angle)).toFixed(2)}`;
        });
        return <polygon key={index} points={points.join(" ")} />;
      })}
    </g>
  );
}

export function PlisyCollectionVisual({ kind }: { kind: PlisyCollectionKind }) {
  const dark = kind === "blackout" || kind === "duo-blackout";
  const frame = { x: 10, y: 8, w: 52, h: 56 };
  const inner = { x: frame.x + 3, y: frame.y + 3, w: frame.w - 6, h: frame.h - 6 };
  const bg = dark ? "#1d2633" : "#fff6dc";
  const pleatLight = dark ? "#3a4656" : "#fffaf0";
  const pleatDark = dark ? "#2a3442" : "#f2e3bf";
  return (
    <svg viewBox="0 0 72 72" width="64" height="64" aria-hidden="true" focusable="false">
      {/* room / light behind the window */}
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={5} fill={bg} />
      {!dark ? (
        <g>
          <circle cx={inner.x + inner.w - 8} cy={inner.y + 9} r={7} fill="#ffcf5a" opacity={0.95} />
          {[0, 1, 2].map((index) => (
            <line
              key={index}
              x1={inner.x + inner.w - 8 - 12 - index * 5}
              y1={inner.y + 9 + index * 6}
              x2={inner.x + inner.w - 8 - 4 - index * 5}
              y2={inner.y + 9 + index * 6}
              stroke="#ffcf5a"
              strokeWidth={1.4}
              strokeLinecap="round"
              opacity={0.8}
            />
          ))}
        </g>
      ) : (
        <g>
          <circle cx={inner.x + inner.w - 8} cy={inner.y + 8} r={5} fill="#c9d3e3" opacity={0.9} />
          <circle cx={inner.x + inner.w - 6} cy={inner.y + 7} r={4.2} fill={bg} />
        </g>
      )}
      {/* the pleated fabric, drawn from the top rail down to ~70% */}
      <Pleats x={inner.x} y={inner.y + 6} w={inner.w} h={inner.h * 0.68} light={pleatLight} dark={pleatDark} />
      {(kind === "duo" || kind === "duo-blackout") ? (
        <Honeycomb x={inner.x + 4} y={inner.y + 6} h={inner.h * 0.68} stroke={dark ? "#8aa0bf" : "#c7a35a"} />
      ) : null}
      {/* light bleeding through the fabric onto the sill: none for blackout */}
      {!dark ? <rect x={inner.x} y={inner.y + 6 + inner.h * 0.68} width={inner.w} height={inner.h * 0.32 - 6} fill="#ffe9ad" opacity={0.75} /> : null}
      {/* rails */}
      <rect x={inner.x - 1} y={inner.y + 3} width={inner.w + 2} height={3.5} rx={1.2} fill={dark ? "#9fb0c6" : "#b9c5d4"} />
      <rect x={inner.x - 1} y={inner.y + 6 + inner.h * 0.68 - 1} width={inner.w + 2} height={3.5} rx={1.2} fill={dark ? "#9fb0c6" : "#b9c5d4"} />
      {/* window frame */}
      <rect x={frame.x} y={frame.y} width={frame.w} height={frame.h} rx={5} fill="none" stroke={dark ? "#6f7f95" : "#a9b6c6"} strokeWidth={2.2} />
      {/* reflex: a heat arrow bouncing off the outside */}
      {kind === "reflex" ? (
        <g stroke="#e0802f" strokeWidth={2} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d={`M ${frame.x - 7} ${frame.y + 30} l 5 -8 l 5 8`} />
          <path d={`M ${frame.x - 7} ${frame.y + 30} l 5 8 l 5 -8`} opacity={0.55} />
        </g>
      ) : null}
      {/* thermo: a small thermometer badge for the insulating builds */}
      {kind === "duo" || kind === "duo-blackout" ? (
        <g>
          <circle cx={frame.x + frame.w - 2} cy={frame.y + frame.h - 2} r={8} fill="#fff" stroke="#e0802f" strokeWidth={1.5} />
          <rect x={frame.x + frame.w - 3.5} y={frame.y + frame.h - 8} width={3} height={8} rx={1.5} fill="#e0802f" />
          <circle cx={frame.x + frame.w - 2} cy={frame.y + frame.h + 1.5} r={2.6} fill="#e0802f" />
        </g>
      ) : null}
    </svg>
  );
}
