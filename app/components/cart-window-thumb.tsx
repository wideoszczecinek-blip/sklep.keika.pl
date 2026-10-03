"use client";

// Miniatura pozycji w koszyku: okno z prawdziwym widokiem za szybą i produktem
// w kolorach, które klient wybrał (właściciel, 2026-10-03: "fajnie, że ma
// kolory zgodne z wyborem, ale lepiej wyglądałaby na jakimś prawdziwym
// oknie"). Zdjęcia widoków są te same, co w wizualizatorze plis
// (features/plisy/visualizer-scenes.ts) - miniatury 320x235, kilkanaście kB.
//
// Rysujemy tylko to, co jest prawdą o produkcie: plisa bez bocznych
// prowadnic, roleta dachowa z prowadnicami i kasetą, moskitiera jako ramka
// z siatką na całym oknie. Gdy nie znamy kolorów (stara pozycja w koszyku),
// komponent oddaje null i koszyk pokazuje dotychczasową miniaturę.
import { useId } from "react";
import { ALLEGRO_MOSKITIERY_HARDWARE, MESH_OPTIONS } from "@/features/moskitiery-ramkowe/shared";
import { plNormalizeHexColor, plShiftHex } from "@/features/plisy/shared";

type ThumbKind = "plisa" | "plisa-dachowa" | "roleta-dachowa" | "moskitiera";

export type CartWindowThumbItem = {
  productSlug: string;
  hardwareLabel?: string;
  meshLabel?: string;
  fabricColor?: string;
  hardwareColor?: string;
};

type Resolved = { kind: ThumbKind; fabric: string; hardware: string };

function norm(value: string | undefined): string {
  return String(value || "").trim().toLowerCase();
}

/** Kolory do narysowania albo null, gdy nie da się ich ustalić. */
export function resolveCartWindowThumb(item: CartWindowThumbItem): Resolved | null {
  const slug = item.productSlug;
  if (slug === "moskitiery-ramkowe") {
    const hardware = ALLEGRO_MOSKITIERY_HARDWARE.find((h) => norm(h.label) === norm(item.hardwareLabel));
    if (!hardware) return null;
    const mesh = MESH_OPTIONS.find((m) => norm(m.label) === norm(item.meshLabel));
    return { kind: "moskitiera", fabric: mesh?.color || "#B0B0B0", hardware: hardware.color };
  }
  const kind: ThumbKind | null =
    slug === "plisy" ? "plisa" : slug === "plisy-dachowe" ? "plisa-dachowa" : slug === "rolety-dachowe" ? "roleta-dachowa" : null;
  if (!kind || !/^#[0-9a-f]{6}$/i.test(String(item.fabricColor || "").trim())) return null;
  return {
    kind,
    fabric: plNormalizeHexColor(item.fabricColor || "", "#D8DEE3"),
    hardware: plNormalizeHexColor(item.hardwareColor || "", "#C9CBCC"),
  };
}

// Okno w układzie 120x120: rama, w niej szyba.
const GLASS = { x: 23, y: 17, w: 74, h: 76 };

const VIEW_BY_KIND: Record<ThumbKind, string> = {
  plisa: "/plisy/widoki/ogrod-thumb.jpg",
  moskitiera: "/plisy/widoki/laka-thumb.jpg",
  "plisa-dachowa": "/plisy/widoki/miasto-thumb.jpg",
  "roleta-dachowa": "/plisy/widoki/miasto-thumb.jpg",
};

export default function CartWindowThumb({ item, label }: { item: CartWindowThumbItem; label: string }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const resolved = resolveCartWindowThumb(item);
  if (!resolved) return null;
  const { kind, fabric, hardware } = resolved;
  const roof = kind === "plisa-dachowa" || kind === "roleta-dachowa";

  // Okno dachowe ma ramę sosnową, pionowe - białą z PCV.
  const frame = roof ? "#D2A56B" : "#FBFCFD";
  const frameShade = roof ? "#A97C45" : "#CBD3DA";
  const frameLit = roof ? "#E6C08C" : "#FFFFFF";

  const railLit = plShiftHex(hardware, 28);
  const railDark = plShiftHex(hardware, -36);
  const foldLit = plShiftHex(fabric, 24);
  const foldDark = plShiftHex(fabric, -30);

  // Dokąd sięga osłona (dolna krawędź), licząc od góry szyby.
  const coverH = kind === "roleta-dachowa" ? 50 : 46;
  const g = GLASS;

  return (
    <svg viewBox="0 0 120 120" className="cart-window-thumb" role="img" aria-label={label}>
      <defs>
        <linearGradient id={`${uid}wall`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={roof ? "#F4EEE4" : "#F3F0EA"} />
          <stop offset="100%" stopColor={roof ? "#E2D7C6" : "#E3DED5"} />
        </linearGradient>
        <linearGradient id={`${uid}frame`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={frameLit} />
          <stop offset="55%" stopColor={frame} />
          <stop offset="100%" stopColor={frameShade} />
        </linearGradient>
        <linearGradient id={`${uid}rail`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={railLit} />
          <stop offset="45%" stopColor={hardware} />
          <stop offset="100%" stopColor={railDark} />
        </linearGradient>
        <linearGradient id={`${uid}fold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={foldDark} />
          <stop offset="45%" stopColor={foldLit} />
          <stop offset="100%" stopColor={fabric} />
        </linearGradient>
        <pattern id={`${uid}pleats`} patternUnits="userSpaceOnUse" x="0" y={g.y} width="6" height="3.6">
          <rect width="6" height="3.6" fill={`url(#${uid}fold)`} />
        </pattern>
        <linearGradient id={`${uid}cloth`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor={foldLit} />
          <stop offset="60%" stopColor={fabric} />
          <stop offset="100%" stopColor={plShiftHex(fabric, -18)} />
        </linearGradient>
        <pattern id={`${uid}mesh`} patternUnits="userSpaceOnUse" width="2.4" height="2.4">
          <path d="M0 0H2.4M0 0V2.4" stroke={plShiftHex(fabric, -40)} strokeWidth="0.45" />
        </pattern>
        <linearGradient id={`${uid}sheen`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.38" />
          <stop offset="38%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        <linearGradient id={`${uid}drop`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B1622" stopOpacity="0.32" />
          <stop offset="100%" stopColor="#0B1622" stopOpacity="0" />
        </linearGradient>
        <clipPath id={`${uid}glass`}>
          <rect x={g.x} y={g.y} width={g.w} height={g.h} rx="1" />
        </clipPath>
      </defs>

      <rect width="120" height="120" fill={`url(#${uid}wall)`} />

      {/* rama okna */}
      <rect x={g.x - 9} y={g.y - 8} width={g.w + 18} height={g.h + 17} rx="2.5" fill="#0B1622" opacity="0.12" transform="translate(1.2 1.8)" />
      <rect x={g.x - 9} y={g.y - 8} width={g.w + 18} height={g.h + 17} rx="2.5" fill={`url(#${uid}frame)`} stroke={frameShade} strokeWidth="0.6" />
      <rect x={g.x - 1.2} y={g.y - 1.2} width={g.w + 2.4} height={g.h + 2.4} rx="1.4" fill={frameShade} opacity="0.55" />

      {/* widok za szybą */}
      <g clipPath={`url(#${uid}glass)`}>
        <rect x={g.x} y={g.y} width={g.w} height={g.h} fill="#BFD9EC" />
        <image href={VIEW_BY_KIND[kind]} x={g.x} y={g.y} width={g.w} height={g.h} preserveAspectRatio="xMidYMid slice" />

        {kind === "moskitiera" ? (
          <>
            {/* siatka na całym oknie: przyciemnia widok i daje drobną kratkę */}
            <rect x={g.x} y={g.y} width={g.w} height={g.h} fill={fabric} opacity="0.2" />
            <rect x={g.x} y={g.y} width={g.w} height={g.h} fill={`url(#${uid}mesh)`} opacity="0.6" />
          </>
        ) : (
          <>
            {kind === "roleta-dachowa" ? (
              <rect x={g.x} y={g.y} width={g.w} height={coverH} fill={`url(#${uid}cloth)`} />
            ) : (
              <>
                <rect x={g.x} y={g.y} width={g.w} height={coverH} fill={fabric} />
                <rect x={g.x} y={g.y} width={g.w} height={coverH} fill={`url(#${uid}pleats)`} />
              </>
            )}
            {/* cień osłony na szybie pod dolną belką */}
            <rect x={g.x} y={g.y + coverH} width={g.w} height="7" fill={`url(#${uid}drop)`} />
            {/* górna belka / kaseta i dolna belka */}
            <rect x={g.x} y={g.y} width={g.w} height={kind === "roleta-dachowa" ? 6 : 4} fill={`url(#${uid}rail)`} />
            <rect x={g.x} y={g.y + coverH - 3.4} width={g.w} height="3.8" fill={`url(#${uid}rail)`} />
            {kind === "roleta-dachowa" ? (
              <>
                <rect x={g.x} y={g.y} width="2.6" height={g.h} fill={`url(#${uid}rail)`} />
                <rect x={g.x + g.w - 2.6} y={g.y} width="2.6" height={g.h} fill={`url(#${uid}rail)`} />
              </>
            ) : null}
          </>
        )}

        <rect x={g.x} y={g.y} width={g.w} height={g.h} fill={`url(#${uid}sheen)`} />
      </g>

      {kind === "moskitiera" ? (
        // ramka moskitiery leży na ramie okna, tuż przy szybie
        <rect
          x={g.x - 2.2}
          y={g.y - 2.2}
          width={g.w + 4.4}
          height={g.h + 4.4}
          rx="1.6"
          fill="none"
          stroke={hardware}
          strokeWidth="4.2"
        />
      ) : null}
      {kind === "moskitiera" ? (
        <rect x={g.x - 4.3} y={g.y - 4.3} width={g.w + 8.6} height={g.h + 8.6} rx="2.2" fill="none" stroke={railDark} strokeWidth="0.5" opacity="0.7" />
      ) : null}

      {roof ? null : (
        <>
          {/* klamka i parapet - tylko w oknie pionowym */}
          <rect x={g.x + g.w + 3} y={g.y + g.h / 2 - 5} width="2.4" height="10" rx="1.2" fill="#B9C1C8" />
          <rect x="8" y={g.y + g.h + 9} width="104" height="5" rx="1.2" fill="#FFFFFF" stroke="#D5DBE0" strokeWidth="0.5" />
          <rect x="10" y={g.y + g.h + 14} width="100" height="3" fill="#0B1622" opacity="0.08" />
        </>
      )}
    </svg>
  );
}
