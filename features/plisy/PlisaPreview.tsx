"use client";

// Layered "what will my plisa actually look like" preview, shown in the
// configurator summary once a full configuration exists.
//
// Deliberately drawn as inline SVG rather than composited from photos: the
// business ask was a room-with-window scene whose FABRIC takes the selected
// fabric colour and whose ALUMINIUM RAILS take the selected hardware colour,
// and there is no photo set in the shop's asset library that could carry
// that (checked 2026-09-08 - the only plisy assets are macro fabric shots
// and rail product shots on white, no room scene, no per-part alpha masks
// like moskitiery-ramkowe's hand-made profile/mesh PNGs). Vector layers give
// exact tinting from the CRM's own hex values, stay crisp at any size, cost
// no extra image requests, and update instantly as the customer switches
// options - which a fixed photo composite could never do for 150 fabrics x
// 10 rail finishes.
//
// Layer order matches the brief: daylight -> pleated fabric -> rails ->
// room/window frame last, so the room genuinely reads as the foreground.
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

  // One fold = a lit rise into a shaded valley. Deriving both from the one
  // stored hex (rather than storing a light/dark pair per swatch) keeps every
  // one of the ~150 fabrics working with no extra data entry.
  const foldLight = plShiftHex(fabric, 26);
  const foldDark = plShiftHex(fabric, -30);
  const fabricEdge = plShiftHex(fabric, -52);

  const railLight = plShiftHex(hardware, 30);
  const railMid = hardware;
  const railDark = plShiftHex(hardware, -34);
  const railEdge = plShiftHex(hardware, -58);

  return (
    <svg
      viewBox="0 0 400 400"
      className="plisa-preview-svg"
      role="img"
      aria-label={`Podgląd plisy: tkanina ${fabricLabel || "--"}, mechanizm ${hardwareLabel || "--"}`}
    >
      <defs>
        {/* Daylight seen through the uncovered part of the glass. */}
        <linearGradient id="plisaSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#DCEBF7" />
          <stop offset="55%" stopColor="#EAF3FA" />
          <stop offset="78%" stopColor="#D8E6D2" />
          <stop offset="100%" stopColor="#BFD3B6" />
        </linearGradient>

        {/* One repeating pleat: lit crest -> shaded valley. */}
        <linearGradient id="plisaFold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={foldDark} />
          <stop offset="18%" stopColor={fabric} />
          <stop offset="46%" stopColor={foldLight} />
          <stop offset="72%" stopColor={fabric} />
          <stop offset="100%" stopColor={foldDark} />
        </linearGradient>
        <pattern id="plisaPleats" patternUnits="userSpaceOnUse" x="0" y="0" width="10" height="11">
          <rect x="0" y="0" width="10" height="11" fill="url(#plisaFold)" />
        </pattern>

        {/* Depth across the stack: slightly compressed/darker right under the
            head rail, opening up towards the bottom rail. */}
        <linearGradient id="plisaDepth" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.22" />
          <stop offset="14%" stopColor="#000000" stopOpacity="0.05" />
          <stop offset="70%" stopColor="#FFFFFF" stopOpacity="0.06" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.16" />
        </linearGradient>
        {/* Light falls from the left of the window. */}
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
        <linearGradient id="plisaGuide" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={railDark} />
          <stop offset="50%" stopColor={railMid} />
          <stop offset="100%" stopColor={railEdge} />
        </linearGradient>

        {/* Wall + PVC window frame (the foreground room). */}
        <linearGradient id="plisaWall" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F3EFEA" />
          <stop offset="100%" stopColor="#E3DDD5" />
        </linearGradient>
        <linearGradient id="plisaFrame" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="100%" stopColor="#E8E8E6" />
        </linearGradient>
        <linearGradient id="plisaSill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FBFBFA" />
          <stop offset="100%" stopColor="#D9D6D0" />
        </linearGradient>

        {/* Everything inside the glass is clipped to the opening so no layer
            can spill onto the frame. */}
        <clipPath id="plisaOpening">
          <rect x="70" y="54" width="260" height="262" rx="3" />
        </clipPath>
      </defs>

      {/* --- room --- */}
      <rect x="0" y="0" width="400" height="400" fill="url(#plisaWall)" />

      {/* --- everything behind the glass --- */}
      <g clipPath="url(#plisaOpening)">
        <rect x="70" y="54" width="260" height="262" fill="url(#plisaSky)" />
        {/* a hint of a garden horizon so it reads as a real window */}
        <ellipse cx="140" cy="300" rx="86" ry="34" fill="#A9C39C" opacity="0.55" />
        <ellipse cx="268" cy="296" rx="70" ry="26" fill="#B6CCA8" opacity="0.5" />

        {/* fabric stack - the plisa itself, lowered about two thirds */}
        <g>
          <rect x="70" y="66" width="260" height="150" fill={fabric} />
          <rect x="70" y="66" width="260" height="150" fill="url(#plisaPleats)" />
          <rect x="70" y="66" width="260" height="150" fill="url(#plisaDepth)" />
          <rect x="70" y="66" width="260" height="150" fill="url(#plisaSideLight)" />
        </g>

        {/* side guide rails (osprzęt) running the height of the opening */}
        <rect x="70" y="54" width="6" height="262" fill="url(#plisaGuide)" opacity="0.9" />
        <rect x="324" y="54" width="6" height="262" fill="url(#plisaGuide)" opacity="0.9" />

        {/* head rail (belka górna) */}
        <rect x="70" y="54" width="260" height="14" rx="2" fill="url(#plisaRail)" />
        <rect x="70" y="54" width="260" height="2" fill={railLight} opacity="0.85" />

        {/* bottom rail (belka dolna) - sits at the fabric's lower edge */}
        <rect x="70" y="214" width="260" height="13" rx="2" fill="url(#plisaRail)" />
        <rect x="70" y="214" width="260" height="1.5" fill={railLight} opacity="0.8" />
        <rect x="70" y="226" width="260" height="1.5" fill={railEdge} opacity="0.55" />
        {/* the shadow the bar casts onto the glass below it */}
        <rect x="70" y="227" width="260" height="9" fill="#0F172A" opacity="0.1" />

        {/* crisp seam where the folded stack meets the bar */}
        <rect x="70" y="212" width="260" height="2" fill={fabricEdge} opacity="0.55" />
      </g>

      {/* --- window frame + sill, drawn last so the room is the foreground --- */}
      <path
        d="M52 36 H348 V332 H52 Z M70 54 V316 H330 V54 Z"
        fill="url(#plisaFrame)"
        fillRule="evenodd"
      />
      <rect x="52" y="36" width="296" height="296" rx="4" fill="none" stroke="#CFCAC3" strokeWidth="1.5" />
      <rect x="70" y="54" width="260" height="262" rx="3" fill="none" stroke="#B9B4AC" strokeWidth="1.5" />
      {/* reveal shadow just inside the frame */}
      <rect x="70" y="54" width="260" height="6" fill="#0F172A" opacity="0.07" />

      {/* sill */}
      <rect x="42" y="332" width="316" height="16" rx="3" fill="url(#plisaSill)" />
      <rect x="42" y="346" width="316" height="4" rx="2" fill="#0F172A" opacity="0.08" />
    </svg>
  );
}
