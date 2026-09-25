"use client";

// The roof plisa itself, tinted live from the chosen fabric/hardware
// colours: two side guide rails running the whole height, BOTH bars
// movable (that is the point of a roof plisa - owner, 2026-09-25), the
// pleated stack between them and open glass above and below, so the
// picture says the same thing as the hero animation (PdHeroScene). Same
// gradient recipe as features/plisy/PlisaPreview.tsx so the two products'
// previews read as one family.
import { plNormalizeHexColor, plShiftHex } from "@/features/plisy/shared";

export default function PlisaDachowaPreview({
  fabricColor,
  hardwareColor,
  fabricLabel,
  hardwareLabel,
}: {
  fabricColor: string;
  hardwareColor: string;
  fabricLabel?: string;
  hardwareLabel?: string;
}) {
  const fabric = plNormalizeHexColor(fabricColor, "#D8DEE3");
  const hardware = plNormalizeHexColor(hardwareColor, "#C9CBCC");

  const foldLight = plShiftHex(fabric, 26);
  const foldDark = plShiftHex(fabric, -30);

  const railLight = plShiftHex(hardware, 30);
  const railMid = hardware;
  const railDark = plShiftHex(hardware, -34);
  const railEdge = plShiftHex(hardware, -58);

  // Geometry (viewBox 300 x 300): rails 14 wide. Górna belka stoi kawałek
  // od góry, dolna kawałek od dołu - widać, że obie jeżdżą w prowadnicach.
  const RAIL = 14;
  const TOP_Y = 34;
  const TOP_H = 16;
  const FABRIC_Y = TOP_Y + TOP_H;
  const BOTTOM_Y = 214;
  const BOTTOM_H = 20;

  return (
    <svg
      viewBox="0 0 300 300"
      preserveAspectRatio="none"
      className="plisa-preview-svg pd-preview-svg"
      role="img"
      aria-label={`Podgląd plisy dachowej w prowadnicach, obie belki ruchome: tkanina ${fabricLabel || "--"}, osprzęt ${hardwareLabel || "--"}`}
    >
      <defs>
        <linearGradient id="pdFold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={foldDark} />
          <stop offset="18%" stopColor={fabric} />
          <stop offset="46%" stopColor={foldLight} />
          <stop offset="72%" stopColor={fabric} />
          <stop offset="100%" stopColor={foldDark} />
        </linearGradient>
        <pattern id="pdPleats" patternUnits="userSpaceOnUse" x="0" y="0" width="9" height="10">
          <rect x="0" y="0" width="9" height="10" fill="url(#pdFold)" />
        </pattern>
        <linearGradient id="pdDepth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.22" />
          <stop offset="16%" stopColor="#000000" stopOpacity="0.05" />
          <stop offset="72%" stopColor="#FFFFFF" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id="pdSideLight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.18" />
          <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.14" />
        </linearGradient>
        <linearGradient id="pdRail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={railLight} />
          <stop offset="34%" stopColor={railMid} />
          <stop offset="76%" stopColor={railDark} />
          <stop offset="100%" stopColor={railEdge} />
        </linearGradient>
        <linearGradient id="pdRailSide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={railLight} />
          <stop offset="38%" stopColor={railMid} />
          <stop offset="80%" stopColor={railDark} />
          <stop offset="100%" stopColor={railEdge} />
        </linearGradient>
        {/* Open pane under the blind: sky-lit glass with a soft reflection. */}
        <linearGradient id="pdGlass" x1="0" y1="0" x2="0.4" y2="1">
          <stop offset="0%" stopColor="#DCE9F3" />
          <stop offset="55%" stopColor="#C6D9E8" />
          <stop offset="100%" stopColor="#B3CADB" />
        </linearGradient>
        <linearGradient id="pdGlassShine" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* glass behind everything */}
      <rect x={RAIL} y="0" width={300 - RAIL * 2} height="300" fill="url(#pdGlass)" />
      <rect x={RAIL} y="0" width={300 - RAIL * 2} height="300" fill="url(#pdGlassShine)" />

      {/* fabric stack between the two bars */}
      <rect x={RAIL} y={FABRIC_Y} width={300 - RAIL * 2} height={BOTTOM_Y - FABRIC_Y} fill={fabric} />
      <rect x={RAIL} y={FABRIC_Y} width={300 - RAIL * 2} height={BOTTOM_Y - FABRIC_Y} fill="url(#pdPleats)" />
      <rect x={RAIL} y={FABRIC_Y} width={300 - RAIL * 2} height={BOTTOM_Y - FABRIC_Y} fill="url(#pdDepth)" />
      <rect x={RAIL} y={FABRIC_Y} width={300 - RAIL * 2} height={BOTTOM_Y - FABRIC_Y} fill="url(#pdSideLight)" />

      {/* górna belka - ruchoma, z uchwytem od góry */}
      <rect x={RAIL} y={TOP_Y} width={300 - RAIL * 2} height={TOP_H} fill="url(#pdRail)" />
      <rect x={RAIL} y={TOP_Y} width={300 - RAIL * 2} height="2.5" fill={railLight} opacity="0.85" />
      <rect x={RAIL} y={TOP_Y + TOP_H - 2} width={300 - RAIL * 2} height="2" fill={railEdge} opacity="0.55" />
      <rect x="136" y={TOP_Y - 7} width="28" height="8" rx="4" fill={railEdge} opacity="0.5" />
      <rect x="138" y={TOP_Y - 6} width="24" height="4" rx="2" fill={railLight} opacity="0.7" />

      {/* dolna belka - ruchoma, z uchwytem od dołu */}
      <rect x={RAIL} y={BOTTOM_Y} width={300 - RAIL * 2} height={BOTTOM_H} fill="url(#pdRail)" />
      <rect x={RAIL} y={BOTTOM_Y} width={300 - RAIL * 2} height="2" fill={railLight} opacity="0.8" />
      <rect x={RAIL} y={BOTTOM_Y + BOTTOM_H - 2} width={300 - RAIL * 2} height="2" fill={railEdge} opacity="0.6" />
      <rect x="138" y={BOTTOM_Y + BOTTOM_H - 1} width="24" height="8" rx="4" fill={railEdge} opacity="0.55" />
      <rect x="140" y={BOTTOM_Y + BOTTOM_H} width="20" height="4" rx="2" fill={railLight} opacity="0.7" />

      {/* side guide rails, full height */}
      <rect x="0" y="0" width={RAIL} height="300" fill="url(#pdRailSide)" />
      <rect x={300 - RAIL} y="0" width={RAIL} height="300" fill="url(#pdRailSide)" />
      <rect x={RAIL - 2} y="0" width="2" height="300" fill={railEdge} opacity="0.5" />
      <rect x={300 - RAIL} y="0" width="2" height="300" fill={railLight} opacity="0.5" />
    </svg>
  );
}
