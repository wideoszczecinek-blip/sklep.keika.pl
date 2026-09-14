"use client";

// Animated hero for the plisy landing. Replaces the stock white-plisa-in-a-
// white-window .webp that shipped 2026-09-14, which matched neither the real
// product (anthracite honeycomb, seen in the owner's own installation photos
// from 2026-07-03) nor the one thing that actually sells a plisa: that both
// rails move, so the fabric parks anywhere on the sash.
//
// Deliberately drawn, not photographed. The owner dropped the photo backdrop
// from the configurator's PlisaPreview on 2026-09-09 after three attempts, so
// a room photo here would fight that decision; and only 3 usable real
// installation photos exist, none of them a clean frontal hero. Those 3 live
// in the gallery below instead, where their phone-camera honesty is a feature.
//
// Fidelity rules taken from the real photos and confirmed product facts:
//   - no side guide rails (this mounting system has none - owner, 2026-09-09)
//   - slim top AND bottom rail, both of which move
//   - anthracite pleated fabric, pleats compressing into a dense stack
//   - two sashes parked at different heights, because that is the selling point
import { useId } from "react";

/** Anthracite, sampled from the owner's 2026-07-03 installation photos. */
const FABRIC = "#3b4147";
const FABRIC_LIT = "#5a636b";
const FABRIC_SHADE = "#23282d";
/** Anodised aluminium rail, matching the "Anoda (szary)" hardware option. */
const RAIL = "#c3c8cc";
const RAIL_LIT = "#e8ebed";
const RAIL_DARK = "#8d9398";

type SashProps = {
  /** Sash opening in viewBox units. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Animation class driving how far the fabric hangs. */
  animClass: string;
  /** Static fallback drop (0-1) used when motion is reduced. */
  restDrop: number;
  patternId: string;
  railGradId: string;
  shadeId: string;
};

/** One sash: glass, then the plisa hanging from the head rail.
 *
 * The fabric is a full-height rect scaled from its top edge, so the pleat
 * pattern compresses with it - which is what a real plisa does as it stacks.
 * The bottom rail rides the same scale, translated to the fabric's lower edge. */
function Sash({ x, y, width, height, animClass, restDrop, patternId, railGradId, shadeId }: SashProps) {
  const railH = Math.max(7, height * 0.022);

  return (
    <g>
      {/* Fabric + bottom rail, clipped to the sash so nothing spills onto the frame. */}
      <g
        className={`plisy-hero-blind ${animClass}`}
        style={{ ["--pl-rest-drop" as string]: String(restDrop) }}
      >
        <rect
          className="plisy-hero-fabric"
          x={x}
          y={y + railH}
          width={width}
          height={height - railH}
          fill={`url(#${patternId})`}
        />
        <g className="plisy-hero-bottomrail">
          {/* Light spilling past the lower edge onto the glass below. */}
          <rect x={x} y={y + railH * 2} width={width} height={height * 0.12} fill={`url(#${shadeId})`} />
          <rect
            x={x - 2}
            y={y + railH}
            width={width + 4}
            height={railH}
            rx={railH * 0.32}
            fill={`url(#${railGradId})`}
          />
        </g>
      </g>

      {/* Head rail sits above the moving parts - it is the one fixed piece. */}
      <rect
        x={x - 2}
        y={y}
        width={width + 4}
        height={railH}
        rx={railH * 0.32}
        fill={`url(#${railGradId})`}
      />
    </g>
  );
}

export default function PlisyHero() {
  // useId keeps the SVG defs unique if this ever renders twice on one page.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const pattern = `plisyHeroPleats${uid}`;
  const fold = `plisyHeroFold${uid}`;
  const railGrad = `plisyHeroRail${uid}`;
  const glass = `plisyHeroGlass${uid}`;
  const blur = `plisyHeroBlur${uid}`;
  const shade = `plisyHeroShade${uid}`;
  const sheen = `plisyHeroSheen${uid}`;
  const clipL = `plisyHeroClipL${uid}`;
  const clipR = `plisyHeroClipR${uid}`;

  // Sash openings (viewBox 1000x800).
  const L = { x: 108, y: 112, width: 372, height: 576 };
  const R = { x: 520, y: 112, width: 372, height: 576 };

  return (
    <div className="plisy-hero">
      <svg
        viewBox="0 0 1000 800"
        className="plisy-hero-svg"
        role="img"
        aria-label="Plisa okienna KEIKA w antracytowej tkaninie, zamontowana w dwuskrzydłowym oknie. Obie plisy zatrzymane na różnej wysokości."
      >
        <defs>
          {/* One pleat: a crisp crease at the top, a lit rise, then the valley
              falling away below. The hard stop at 52% is the fold line itself -
              without it the fabric reads as a flat dark block rather than
              stacked pleats. */}
          <linearGradient id={fold} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={FABRIC_SHADE} />
            <stop offset="14%" stopColor={FABRIC} />
            <stop offset="44%" stopColor={FABRIC_LIT} />
            <stop offset="52%" stopColor="#6c757e" />
            <stop offset="53%" stopColor={FABRIC_SHADE} />
            <stop offset="70%" stopColor={FABRIC} />
            <stop offset="100%" stopColor="#1b1f23" />
          </linearGradient>
          <pattern id={pattern} patternUnits="userSpaceOnUse" width="24" height="17">
            <rect width="24" height="17" fill={`url(#${fold})`} />
          </pattern>

          {/* Blurred foliage silhouettes - enough to read as "outside" without
              pretending to be a photograph. */}
          <filter id={blur} x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="14" />
          </filter>

          {/* Light falling into the room past the blind's lower edge. */}
          <linearGradient id={shade} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#000000" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#000000" stopOpacity="0" />
          </linearGradient>

          <linearGradient id={railGrad} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={RAIL_LIT} />
            <stop offset="45%" stopColor={RAIL} />
            <stop offset="100%" stopColor={RAIL_DARK} />
          </linearGradient>

          {/* Daylight outside: bright sky dropping to a hazy treeline. */}
          <linearGradient id={glass} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#a8cfec" />
            <stop offset="38%" stopColor="#d6e8f5" />
            <stop offset="55%" stopColor="#e8f0e4" />
            <stop offset="100%" stopColor="#b9cfa6" />
          </linearGradient>

          {/* Diagonal sheen on the pane, so the glass reads as glass. */}
          <linearGradient id={sheen} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="42%" stopColor="#ffffff" stopOpacity="0.08" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>

          <clipPath id={clipL}>
            <rect x={L.x} y={L.y} width={L.width} height={L.height} />
          </clipPath>
          <clipPath id={clipR}>
            <rect x={R.x} y={R.y} width={R.width} height={R.height} />
          </clipPath>
        </defs>

        {/* Wall + reveal */}
        <rect x="0" y="0" width="1000" height="800" fill="none" />

        {/* White PVC frame */}
        <rect x="60" y="64" width="880" height="672" rx="10" fill="#f4f7fa" />
        <rect x="60" y="64" width="880" height="672" rx="10" fill="none" stroke="#d3dae1" strokeWidth="2" />
        {/* Sash rebates */}
        <rect x={L.x - 20} y={L.y - 20} width={L.width + 40} height={L.height + 40} rx="6" fill="#fbfdfe" stroke="#d9e0e6" strokeWidth="2" />
        <rect x={R.x - 20} y={R.y - 20} width={R.width + 40} height={R.height + 40} rx="6" fill="#fbfdfe" stroke="#d9e0e6" strokeWidth="2" />

        {/* Glass: sky, then blurred greenery, then a sheen over the top. */}
        {[L, R].map((s, i) => (
          <g key={i} clipPath={`url(#${i === 0 ? clipL : clipR})`}>
            <rect x={s.x} y={s.y} width={s.width} height={s.height} fill={`url(#${glass})`} />
            <g filter={`url(#${blur})`} opacity="0.4">
              <ellipse cx={s.x + s.width * 0.24} cy={s.y + s.height * 0.88} rx={s.width * 0.42} ry={s.height * 0.13} fill="#7ea165" />
              <ellipse cx={s.x + s.width * 0.76} cy={s.y + s.height * 0.84} rx={s.width * 0.36} ry={s.height * 0.14} fill="#6d9257" />
              <ellipse cx={s.x + s.width * 0.5} cy={s.y + s.height * 0.99} rx={s.width * 0.62} ry={s.height * 0.1} fill="#5f8550" />
            </g>
            <rect x={s.x} y={s.y} width={s.width} height={s.height} fill={`url(#${sheen})`} />
          </g>
        ))}

        {/* Blinds, each clipped to its own sash. Different rest heights and
            animation phases: the whole point is that they park independently. */}
        <g clipPath={`url(#${clipL})`}>
          <Sash {...L} animClass="plisy-hero-blind--a" restDrop={0.62} patternId={pattern} railGradId={railGrad} shadeId={shade} />
        </g>
        <g clipPath={`url(#${clipR})`}>
          <Sash {...R} animClass="plisy-hero-blind--b" restDrop={0.38} patternId={pattern} railGradId={railGrad} shadeId={shade} />
        </g>

        {/* Handle on the right sash, as in the real photos */}
        <rect x="498" y="386" width="14" height="58" rx="7" fill="#e3e8ec" stroke="#c6ced5" strokeWidth="1.5" />
      </svg>
    </div>
  );
}
