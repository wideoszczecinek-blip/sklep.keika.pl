"use client";

// Ikona kolekcji tkanin w kroku "Wybierz kolekcję tkanin".
//
// Historia: najpierw były zdjęcia tkanin z CRM (właściciel, 2026-09-17:
// "wyglądają wszystkie tak samo i nic nie wnoszą"), potem rysunek okna z
// plisą. Właściciel, 2026-09-24: "swatche są chujowe - zrób po prostu jakieś
// ikony, proste, estetyczne i intuicyjne". Stąd ten zestaw: jeden prosty
// piktogram na kolekcję, ta sama siatka 48x48, ta sama grubość kreski,
// dwa kolory znaczeniowe - bursztyn = światło, granat = zaciemnienie,
// pomarańcz = ciepło. Każdy mówi jedno zdanie bez czytania:
//   Klasyczne     - słońce, światło przechodzi przez tkaninę i rozprasza się
//   Reflex        - promień odbija się od tkaniny (odbija ciepło)
//   Podgumowane   - promień zatrzymuje się na tkaninie (zaciemnia)
//   DUO           - plaster miodu (struktura komórkowa)
//   DUO TERMO     - plaster miodu + fale ciepła
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

// UWAGA (właściciel, potwierdzone 2026-09-24): samo DUO "plaster miodu" jest
// dekoracyjne - komórkowa struktura bez powłoki termicznej. Termiczne jest
// dopiero DUO TERMO. Dlatego DUO nie ma już plakietki "Termo" (miało ją
// wcześniej, wbrew opisowi w porównaniu kolekcji na landingu).
const KIND_META: Record<PlisyCollectionKind, { light: string; badges: string[] }> = {
  sheer: { light: "Rozprasza światło, nie zaciemnia", badges: ["Przepuszcza światło"] },
  reflex: { light: "Rozprasza światło, odbija ciepło słońca", badges: ["Przepuszcza światło", "Termo"] },
  blackout: { light: "Zaciemnia — podgumowany rdzeń blokuje światło", badges: ["Zaciemnia"] },
  duo: { light: "Plaster miodu bez otworów pod sznurki — żadnych punktów światła", badges: ["Przepuszcza światło", "Plaster miodu"] },
  "duo-blackout": { light: "Plaster miodu z powłoką termiczną — całkowite zaciemnienie", badges: ["Zaciemnia", "Termo"] },
};

export function plisyCollectionMeta(kind: PlisyCollectionKind) {
  return KIND_META[kind];
}

const INK = "#132843";
const MUTED = "#9db0c6";
const LIGHT = "#f3b546";
const HEAT = "#e0802f";

/** Trzy fałdy tkaniny - wspólny element wszystkich ikon, żeby zestaw czytał
 * się jako jedna rodzina. */
function Pleats({ y = 20, dark = false }: { y?: number; dark?: boolean }) {
  return (
    <g
      stroke={dark ? INK : MUTED}
      strokeWidth={2.4}
      strokeLinecap="round"
      opacity={dark ? 1 : 0.9}
    >
      <line x1={11} y1={y} x2={37} y2={y} />
      <line x1={11} y1={y + 6} x2={37} y2={y + 6} />
      <line x1={11} y1={y + 12} x2={37} y2={y + 12} />
    </g>
  );
}

/** Sześciokąt o płaskiej górze - komórka plastra miodu. */
function Hex({ cx, cy, r, fill, stroke }: { cx: number; cy: number; r: number; fill: string; stroke: string }) {
  const points = Array.from({ length: 6 })
    .map((_, i) => {
      const a = (Math.PI / 3) * i;
      return `${(cx + r * Math.cos(a)).toFixed(1)},${(cy + r * Math.sin(a)).toFixed(1)}`;
    })
    .join(" ");
  return <polygon points={points} fill={fill} stroke={stroke} strokeWidth={2.2} strokeLinejoin="round" />;
}

function Sun({ cx = 15, cy = 11 }: { cx?: number; cy?: number }) {
  return (
    <g>
      <circle cx={cx} cy={cy} r={4.2} fill={LIGHT} />
      <g stroke={LIGHT} strokeWidth={1.8} strokeLinecap="round">
        <line x1={cx} y1={cy - 7.5} x2={cx} y2={cy - 6} />
        <line x1={cx + 5.3} y1={cy - 5.3} x2={cx + 6.4} y2={cy - 6.4} />
        <line x1={cx + 7.5} y1={cy} x2={cx + 6} y2={cy} />
      </g>
    </g>
  );
}

export function PlisyCollectionVisual({ kind }: { kind: PlisyCollectionKind }) {
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true" focusable="false">
      {kind === "sheer" ? (
        <>
          <Sun />
          <Pleats />
          {/* światło przechodzi niżej - trzy krótkie promienie pod tkaniną */}
          <g stroke={LIGHT} strokeWidth={2.2} strokeLinecap="round">
            <line x1={15} y1={38} x2={15} y2={42} />
            <line x1={24} y1={38} x2={24} y2={43.5} />
            <line x1={33} y1={38} x2={33} y2={42} />
          </g>
        </>
      ) : null}

      {kind === "reflex" ? (
        <>
          <Sun cx={12} cy={9} />
          <Pleats />
          {/* promień pada i odbija się w górę - bez światła pod spodem */}
          <g stroke={HEAT} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" fill="none">
            <path d="M18 13 L25 19" />
            <path d="M25 19 L33 12" />
            <path d="M33 12 L29.5 12.6 M33 12 L32.6 15.6" />
          </g>
        </>
      ) : null}

      {kind === "blackout" ? (
        <>
          <Sun cx={12} cy={9} />
          {/* pełna, ciemna tkanina - promień się na niej kończy */}
          <rect x={10} y={18} width={28} height={16} rx={3} fill={INK} />
          <g stroke="#41536b" strokeWidth={1.6} strokeLinecap="round">
            <line x1={13} y1={24} x2={35} y2={24} />
            <line x1={13} y1={29} x2={35} y2={29} />
          </g>
          <path d="M18 13 L23 17.4" stroke={HEAT} strokeWidth={2.2} strokeLinecap="round" />
          <g stroke={INK} strokeWidth={2.2} strokeLinecap="round" opacity={0.35}>
            <line x1={15} y1={40} x2={33} y2={40} />
          </g>
        </>
      ) : null}

      {kind === "duo" || kind === "duo-blackout" ? (
        <>
          {/* plaster miodu: dwie komórki u góry, jedna pod nimi */}
          <Hex cx={16.5} cy={17} r={7} fill={kind === "duo-blackout" ? INK : "none"} stroke={kind === "duo-blackout" ? INK : MUTED} />
          <Hex cx={31.5} cy={17} r={7} fill={kind === "duo-blackout" ? INK : "none"} stroke={kind === "duo-blackout" ? INK : MUTED} />
          <Hex cx={24} cy={29.5} r={7} fill={kind === "duo-blackout" ? INK : "none"} stroke={kind === "duo-blackout" ? INK : MUTED} />
          {kind === "duo" ? (
            <g stroke={LIGHT} strokeWidth={2.2} strokeLinecap="round">
              <line x1={18} y1={40} x2={18} y2={43.5} />
              <line x1={24} y1={41} x2={24} y2={45} />
              <line x1={30} y1={40} x2={30} y2={43.5} />
            </g>
          ) : (
            /* fale ciepła zamiast światła - to jest wersja termiczna */
            <g stroke={HEAT} strokeWidth={2.2} strokeLinecap="round" fill="none">
              <path d="M16 41.5 q4 -3.5 8 0 q4 3.5 8 0" />
              <path d="M16 45.5 q4 -3.5 8 0 q4 3.5 8 0" opacity={0.55} />
            </g>
          )}
        </>
      ) : null}
    </svg>
  );
}

/** "25 kolorów" / "2 kolory" / "1 kolor" - polska odmiana dla licznika pod
 * nazwą kolekcji (zastąpił rządek nieczytelnych miniatur tkanin). */
export function plisyColorCountLabel(count: number): string {
  if (count === 1) return "1 kolor";
  const last = count % 10;
  const lastTwo = count % 100;
  if (last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14)) return `${count} kolory`;
  return `${count} kolorów`;
}
