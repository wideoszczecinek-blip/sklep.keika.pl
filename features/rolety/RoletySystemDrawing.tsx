// Schemat okna z roletą danego systemu i (opcjonalnie) zaznaczonym pomiarem.
// Używany na kafelkach strony /rolety-tradycyjne, na stronie systemu i w
// kroku pomiaru konfiguratora (aktywne pole = podświetlona strzałka).
// Rysunek poglądowy - liczby w konfiguratorze są zawsze z pomiaru klienta.
import type { MeasureFieldKey, RoletySystemSlug } from "./systemy";

const C = {
  wall: "#EEF1F4",
  wallLine: "#C9D1DA",
  frame: "#FFFFFF",
  frameLine: "#9AA6B2",
  bead: "#E6EAEE",
  glass: "#D9ECF7",
  seal: "#3D4752",
  fabric: "rgba(124, 92, 64, 0.55)",
  fabricLine: "#6B4E36",
  hw: "#F8F8F6",
  hwLine: "#7B8794",
  accent: "#E07B00",
  dim: "#1F3A5C",
};

function Arrow({ x1, y1, x2, y2, label, active, labelSide = "top" }: { x1: number; y1: number; x2: number; y2: number; label: string; active: boolean; labelSide?: "top" | "left" | "right" | "bottom" }) {
  const color = active ? C.accent : C.dim;
  const width = active ? 2.2 : 1.2;
  const horizontal = y1 === y2;
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const tx = horizontal ? mx : labelSide === "left" ? x1 - 6 : x1 + 6;
  const ty = horizontal ? (labelSide === "bottom" ? y1 + 13 : y1 - 5) : my + 4;
  const anchor = horizontal ? "middle" : labelSide === "left" ? "end" : "start";
  return (
    <g opacity={active ? 1 : 0.55}>
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={color} strokeWidth={width} markerStart="url(#rs-arrow)" markerEnd="url(#rs-arrow)" />
      <text x={tx} y={ty} fontSize={active ? 11 : 10} fontWeight={800} fill={color} textAnchor={anchor}>
        {label}
      </text>
    </g>
  );
}

export default function RoletySystemDrawing({
  system,
  active = null,
  showMeasures = true,
  vent = false,
  mountId = "",
  className = "",
}: {
  system: RoletySystemSlug;
  active?: MeasureFieldKey | null;
  showMeasures?: boolean;
  vent?: boolean;
  mountId?: string;
  className?: string;
}) {
  const wallMount = system === "rolety-wolnowiszace";
  // Okno: rama 40..200 × 40..280, skrzydło 50..190 × 50..270, listwy (kreseczka) 62..178 × 62..258,
  // szyba widoczna 68..172 × 68..252, połowa uszczelki 70 / 170.
  const sash = { x1: 50, y1: 50, x2: 190, y2: 270 };
  const bead = { x1: 62, y1: vent && system === "rolety-kaseta-przestrzenna" ? 72 : 62, x2: 178, y2: 258 };
  const glass = { x1: 68, y1: bead.y1 + 6, x2: 172, y2: 252 };
  const seal = { x1: 70, x2: 170 };
  const ventBox = vent && system === "rolety-kaseta-przestrzenna";
  const handle = { x: 182, y: 150 };
  const isA = active === "a";
  const isB = active === "b";
  const isC = active === "c";

  // Wolnowisząca: ściana z wnęką 50..190 × 70..270, roleta szersza o 5 cm (≈10 px) i wyższa o 10 cm.
  if (wallMount) {
    const ceiling = mountId === "do-sufitu";
    const recess = { x1: 62, y1: 80, x2: 178, y2: 262 };
    const blind = { x1: 50, y1: ceiling ? 22 : 58, x2: 190, y2: 262 };
    return (
      <svg viewBox="0 0 240 300" className={`rs-drawing ${className}`} role="img" aria-label="Schemat rolety wolnowiszącej na ścianie">
        <defs>
          <marker id="rs-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
          </marker>
        </defs>
        <rect x="0" y="0" width="240" height="300" fill={C.wall} />
        {ceiling ? <rect x="0" y="0" width="240" height="18" fill="#DCE2E8" /> : null}
        <rect x={recess.x1} y={recess.y1} width={recess.x2 - recess.x1} height={recess.y2 - recess.y1} fill="#E2E7EC" stroke={C.wallLine} />
        <rect x={recess.x1 + 8} y={recess.y1 + 8} width={recess.x2 - recess.x1 - 16} height={recess.y2 - recess.y1 - 16} fill={C.frame} stroke={C.frameLine} />
        <rect x={recess.x1 + 16} y={recess.y1 + 16} width={recess.x2 - recess.x1 - 32} height={recess.y2 - recess.y1 - 32} fill={C.glass} />
        <rect x={recess.x1 - 4} y={recess.y2} width={recess.x2 - recess.x1 + 8} height="8" fill="#CBD2D9" />
        {/* roleta */}
        <rect x={blind.x1} y={blind.y1} width={blind.x2 - blind.x1} height="9" rx="4" fill={C.hw} stroke={C.hwLine} />
        <rect x={blind.x1 + 2} y={blind.y1 + 9} width={blind.x2 - blind.x1 - 4} height={(recess.y1 + recess.y2) / 2 - blind.y1 - 9} fill={C.fabric} stroke={C.fabricLine} strokeWidth="0.8" />
        <rect x={blind.x1 + 2} y={(recess.y1 + recess.y2) / 2} width={blind.x2 - blind.x1 - 4} height="4" fill={C.hwLine} />
        <line x1={blind.x2 - 8} y1={blind.y1 + 9} x2={blind.x2 - 8} y2={blind.y1 + 120} stroke={C.hwLine} strokeWidth="1.2" strokeDasharray="1.5 1.5" />
        {showMeasures ? (
          <>
            <Arrow x1={recess.x1} y1={290} x2={recess.x2} y2={290} label="A" active={isA} labelSide="top" />
            {ceiling ? (
              <Arrow x1={226} y1={18} x2={226} y2={recess.y2} label="C" active={isC} labelSide="left" />
            ) : (
              <Arrow x1={226} y1={recess.y1} x2={226} y2={recess.y2} label="C" active={isC} labelSide="left" />
            )}
            <text x={blind.x1 - 2} y={blind.y1 - 4} fontSize="8.5" fill={C.dim} fontWeight="700">
              +5 cm
            </text>
            <text x={blind.x2 - 26} y={blind.y1 - 4} fontSize="8.5" fill={C.dim} fontWeight="700">
              +5 cm
            </text>
            {!ceiling ? (
              <text x="120" y={recess.y1 - 4} fontSize="8.5" fill={C.dim} fontWeight="700" textAnchor="middle">
                +10 cm
              </text>
            ) : null}
          </>
        ) : null}
      </svg>
    );
  }

  const cassette = system === "rolety-kaseta-plaska" ? { x1: bead.x1, x2: bead.x2, y: bead.y1 - 2 } : system === "rolety-kaseta-przestrzenna" ? { x1: sash.x1 + 2, x2: sash.x2 - 2, y: (ventBox ? 62 : sash.y1) + 2 } : null;
  const fabricX1 = system === "rolety-kaseta-przestrzenna" ? sash.x1 + 10 : bead.x1 + 3;
  const fabricX2 = system === "rolety-kaseta-przestrzenna" ? sash.x2 - 10 : bead.x2 - 3;
  const fabricTop = cassette ? cassette.y + 12 : bead.y1 + 8;
  const fabricBottom = 150;

  return (
    <svg viewBox="0 0 240 300" className={`rs-drawing ${className}`} role="img" aria-label="Schemat okna z roletą">
      <defs>
        <marker id="rs-arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M0,0 L10,5 L0,10 z" fill="context-stroke" />
        </marker>
      </defs>
      <rect x="0" y="0" width="240" height="300" fill={C.wall} />
      {/* rama i skrzydło */}
      <rect x="40" y="40" width="160" height="240" fill={C.frame} stroke={C.frameLine} />
      <rect x={sash.x1} y={sash.y1} width={sash.x2 - sash.x1} height={sash.y2 - sash.y1} fill={C.frame} stroke={C.frameLine} />
      {ventBox ? <rect x={sash.x1 + 10} y={sash.y1 + 2} width={sash.x2 - sash.x1 - 20} height="8" fill="#C9D1DA" stroke={C.frameLine} /> : null}
      {/* listwy przyszybowe (kreseczka = ich zewnętrzna krawędź) */}
      <rect x={bead.x1} y={bead.y1} width={bead.x2 - bead.x1} height={bead.y2 - bead.y1} fill={C.bead} stroke={C.frameLine} />
      <rect x={glass.x1} y={glass.y1} width={glass.x2 - glass.x1} height={glass.y2 - glass.y1} fill={C.glass} stroke={C.seal} strokeWidth="2.4" />
      {/* klamka */}
      <rect x={handle.x} y={handle.y - 3} width="6" height="30" rx="3" fill="#B8C1CA" stroke={C.frameLine} />
      {/* roleta */}
      {cassette ? <rect x={cassette.x1} y={cassette.y} width={cassette.x2 - cassette.x1} height="12" rx="3" fill={C.hw} stroke={C.hwLine} /> : <rect x={bead.x1} y={bead.y1 + 2} width={bead.x2 - bead.x1} height="6" rx="3" fill={C.hw} stroke={C.hwLine} />}
      <rect x={fabricX1} y={fabricTop} width={fabricX2 - fabricX1} height={fabricBottom - fabricTop} fill={C.fabric} stroke={C.fabricLine} strokeWidth="0.8" />
      <rect x={fabricX1} y={fabricBottom} width={fabricX2 - fabricX1} height="4" fill={C.hwLine} />
      {system === "rolety-kaseta-plaska" ? (
        <>
          <rect x={bead.x1 + 1} y={fabricTop} width="4" height={bead.y2 - fabricTop - 2} fill={C.hw} stroke={C.hwLine} strokeWidth="0.8" />
          <rect x={bead.x2 - 5} y={fabricTop} width="4" height={bead.y2 - fabricTop - 2} fill={C.hw} stroke={C.hwLine} strokeWidth="0.8" />
        </>
      ) : null}
      {system === "rolety-kaseta-przestrzenna" ? (
        <>
          <rect x={sash.x1 + 2} y={fabricTop} width="8" height={sash.y2 - fabricTop - 4} fill={C.hw} stroke={C.hwLine} strokeWidth="0.8" />
          <rect x={sash.x2 - 10} y={fabricTop} width="8" height={sash.y2 - fabricTop - 4} fill={C.hw} stroke={C.hwLine} strokeWidth="0.8" />
        </>
      ) : null}
      {system === "rolety-mini" ? <line x1={bead.x2 - 6} y1={bead.y1 + 8} x2={bead.x2 - 6} y2={bead.y1 + 110} stroke={C.hwLine} strokeWidth="1.2" strokeDasharray="1.5 1.5" /> : null}

      {showMeasures ? (
        <>
          {/* A: od kreseczki do kreseczki */}
          <Arrow x1={bead.x1} y1={24} x2={bead.x2} y2={24} label="A" active={isA} />
          <line x1={bead.x1} y1={28} x2={bead.x1} y2={bead.y1} stroke={isA ? C.accent : C.dim} strokeWidth="0.8" strokeDasharray="2 2" opacity={isA ? 1 : 0.4} />
          <line x1={bead.x2} y1={28} x2={bead.x2} y2={bead.y1} stroke={isA ? C.accent : C.dim} strokeWidth="0.8" strokeDasharray="2 2" opacity={isA ? 1 : 0.4} />
          {system === "rolety-kaseta-plaska" ? <Arrow x1={seal.x1} y1={200} x2={seal.x2} y2={200} label="B" active={isB} /> : null}
          {system === "rolety-kaseta-przestrzenna" ? <Arrow x1={bead.x2} y1={192} x2={handle.x} y2={192} label="B" active={isB} labelSide="bottom" /> : null}
          {/* C: wysokość */}
          {system === "rolety-mini" ? (
            <Arrow x1={20} y1={sash.y1} x2={20} y2={sash.y2} label="C" active={isC} labelSide="right" />
          ) : system === "rolety-kaseta-przestrzenna" ? (
            <Arrow x1={20} y1={ventBox ? sash.y1 + 10 : sash.y1} x2={20} y2={sash.y2} label="C" active={isC} labelSide="right" />
          ) : (
            <Arrow x1={20} y1={bead.y1} x2={20} y2={bead.y2} label="C" active={isC} labelSide="right" />
          )}
        </>
      ) : null}
    </svg>
  );
}
