"use client";

// The plisa itself (pleated fabric + top/bottom aluminium rail), tinted live
// from the chosen fabric/hardware colours. Deliberately just the product,
// not a room - it's meant to be dropped into a real photo of a window (see
// .plisa-preview-window in ConfiguratorPanel.tsx), which is what the
// business owner actually asked for after the first version drew an
// illustrated window+room around it. No side guide rails: this mounting
// system doesn't have them (confirmed by the business owner 2026-09-09),
// unlike moskitiery-ramkowe's frame, which does.
import { plNormalizeHexColor, plShiftHex } from "./shared";

export default function PlisaPreview({
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

  // One fold = a lit rise into a shaded valley, both derived from the single
  // stored hex rather than a separate light/dark pair per swatch - keeps
  // every one of the ~150 fabrics working with no extra data entry.
  const foldLight = plShiftHex(fabric, 26);
  const foldDark = plShiftHex(fabric, -30);

  const railLight = plShiftHex(hardware, 30);
  const railMid = hardware;
  const railDark = plShiftHex(hardware, -34);
  const railEdge = plShiftHex(hardware, -58);

  return (
    <svg
      viewBox="0 0 300 300"
      preserveAspectRatio="none"
      className="plisa-preview-svg"
      role="img"
      aria-label={`Podgląd plisy: tkanina ${fabricLabel || "--"}, mechanizm ${hardwareLabel || "--"}`}
    >
      <defs>
        <linearGradient id="plisaFold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={foldDark} />
          <stop offset="18%" stopColor={fabric} />
          <stop offset="46%" stopColor={foldLight} />
          <stop offset="72%" stopColor={fabric} />
          <stop offset="100%" stopColor={foldDark} />
        </linearGradient>
        <pattern id="plisaPleats" patternUnits="userSpaceOnUse" x="0" y="0" width="9" height="10">
          <rect x="0" y="0" width="9" height="10" fill="url(#plisaFold)" />
        </pattern>

        {/* Depth across the stack: slightly compressed/darker right under the
            head rail, opening up towards the bottom rail. */}
        <linearGradient id="plisaDepth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.24" />
          <stop offset="16%" stopColor="#000000" stopOpacity="0.05" />
          <stop offset="72%" stopColor="#FFFFFF" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
        </linearGradient>
        {/* Light falls from the left, same as the window it hangs in. */}
        <linearGradient id="plisaSideLight" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.20" />
          <stop offset="40%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.14" />
        </linearGradient>

        {/* Extruded aluminium: bright top edge, body, shaded underside. */}
        <linearGradient id="plisaRail" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={railLight} />
          <stop offset="34%" stopColor={railMid} />
          <stop offset="76%" stopColor={railDark} />
          <stop offset="100%" stopColor={railEdge} />
        </linearGradient>
      </defs>

      {/* head rail */}
      <rect x="0" y="0" width="300" height="24" fill="url(#plisaRail)" />
      <rect x="0" y="0" width="300" height="2.5" fill={railLight} opacity="0.85" />

      {/* fabric stack fills the rest of the opening */}
      <rect x="0" y="24" width="300" height="252" fill={fabric} />
      <rect x="0" y="24" width="300" height="252" fill="url(#plisaPleats)" />
      <rect x="0" y="24" width="300" height="252" fill="url(#plisaDepth)" />
      <rect x="0" y="24" width="300" height="252" fill="url(#plisaSideLight)" />

      {/* bottom rail */}
      <rect x="0" y="276" width="300" height="24" fill="url(#plisaRail)" />
      <rect x="0" y="276" width="300" height="2" fill={railLight} opacity="0.8" />
      <rect x="0" y="298" width="300" height="2" fill={railEdge} opacity="0.6" />
    </svg>
  );
}
