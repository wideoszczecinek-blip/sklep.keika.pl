"use client";

// Podgląd plisy w konfiguratorze (i miniatura w koszyku), barwiony na żywo kolorem tkaniny i osprzętu.
//
// 8.11 (właściciel: „podgląd w konfiguratorze jest tragiczny - weź za przykład kształt profilu i oddaj go jak
// najdokładniej; brakuje sznurków - dla zwykłych klasycznie, dla DUO niewidoczne na materiale”). Narysowane od nowa
// wg zdjęć z katalogu (lico profilu: zaokrąglona góra, wąski rowek wzdłuż, zaokrąglony spód, zaślepki z wycięciem
// na linkę) i zdjęcia prawdziwej plisy (linka przechodzi przez otwór przy każdej fałdzie - widać kawałek linki
// i ciemne oczko). DUO (plaster miodu): linki idą wewnątrz komórek, więc na tkaninie ich nie ma - za to na
// brzegach widać przekrój komórek. Linki prowadzące od uchwytów w rogach okna do belek są w obu rodzajach.
// Bez zdjęcia pokoju (właściciel 9.09: zostaje sam produkt na spokojnym tle), szyba tylko jako jasne tło.
import { useId } from "react";
import { plNormalizeHexColor, plShiftHex } from "./shared";

function jasnosc(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

export default function PlisaPreview({
  fabricColor,
  hardwareColor,
  fabricLabel,
  hardwareLabel,
  honeycomb = false,
  widthMm,
}: {
  fabricColor: string;
  hardwareColor: string;
  fabricLabel?: string;
  hardwareLabel?: string;
  /** DUO / plaster miodu - linki niewidoczne na tkaninie */
  honeycomb?: boolean;
  /** szerokość plisy (mm) - przy szerokich dodatkowe linki w środku, jak w produkcji */
  widthMm?: number;
}) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, "");
  const id = (n: string) => `${n}${uid}`;
  const duo = honeycomb || /duo|plaster/i.test(fabricLabel || "");
  const fabric = plNormalizeHexColor(fabricColor, "#D8DEE3");
  const hw = plNormalizeHexColor(hardwareColor, "#C9CBCC");
  const ciemnyOsprzet = jasnosc(hw) < 0.35;

  // profil: jasna krawędź u góry, lico, rowek, wargi rowka, zaokrąglony spód
  const hwHi = plShiftHex(hw, ciemnyOsprzet ? 46 : 26);
  const hwLight = plShiftHex(hw, ciemnyOsprzet ? 22 : 12);
  const hwShade = plShiftHex(hw, -18);
  const hwDark = plShiftHex(hw, -42);
  const hwGroove = plShiftHex(hw, -95);
  const cap = plShiftHex(hw, -10);
  const capDark = plShiftHex(hw, -48);

  // fałdy: górna ścianka łapie światło z pokoju, dolna w cieniu
  const fUp = plShiftHex(fabric, 14);
  const fUpTop = plShiftHex(fabric, -6);
  const fDown = plShiftHex(fabric, -22);
  const fDownDeep = plShiftHex(fabric, -40);
  const fCrest = plShiftHex(fabric, 34);
  const fValley = plShiftHex(fabric, -58);

  // linka: jasna, półmatowa (na zdjęciu biała nitka), przy ciemnej tkaninie widać ją lepiej
  // na jasnej tkaninie biała linka ginie - wtedy odcień ciemniejszy od tkaniny (jak linka w cieniu fałdy)
  const cord = jasnosc(fabric) < 0.3 ? "#D9D6CF" : jasnosc(fabric) > 0.62 ? plShiftHex(fabric, -62) : "#F4F2EE";
  const drewno = /sosn|d[aą]b|orzech|winchester|drewn/i.test(`${hardwareLabel || ""}`);
  const cordGuide = ciemnyOsprzet ? "#5B5E63" : "#B9B4AC";

  // geometria (viewBox 400 × 500 = proporcje sceny 4:5)
  const X0 = 30;
  const X1 = 370;
  const W = X1 - X0;
  const RAIL = 26;
  const TOP = 46; // górna belka
  const FAB_TOP = TOP + RAIL;
  const FAB_BOT = 334; // plisa zasłania ok. 2/3 szyby - widać, że się przesuwa
  const BOT = FAB_BOT; // dolna belka
  const N = duo ? 11 : 16;
  const pitch = (FAB_BOT - FAB_TOP) / N;
  const edgeIn = 5; // fałdy na brzegach: grzbiet wystaje, dolina cofnięta

  // linki przez tkaninę: ~6 % od brzegów, przy szerokich co ok. 60 cm
  const cols: number[] = [X0 + W * 0.065, X1 - W * 0.065];
  const szer = widthMm && widthMm > 0 ? widthMm : 800;
  // uchwyty do przesuwania (właściciel 8.11): do 100 cm jeden na środku każdej listwy, szersze dwa na listwę (FAQ „Ile uchwytów…”)
  const uchwyty = szer > 1000 ? [X0 + W * 0.28, X1 - W * 0.28] : [X0 + W / 2];
  const srodek = Math.max(0, Math.round(szer / 600) - 1);
  for (let i = 1; i <= srodek; i++) cols.push(X0 + W * 0.065 + ((W * 0.87) / (srodek + 1)) * i);

  const pleats = Array.from({ length: N }, (_, i) => {
    const yTop = FAB_TOP + i * pitch; // dolina (zgięcie do szyby) u góry fałdy
    const yCrest = yTop + pitch * 0.48; // grzbiet (zgięcie do pokoju)
    const yBot = yTop + pitch;
    return { i, yTop, yCrest, yBot };
  });

  // uchwyt: tworzywo w kolorze osprzętu nasunięte na lico listwy, z języczkiem na zewnątrz (górna listwa - w górę,
  // dolna - w dół), z rowkami pod palce i cieniem na szybie
  const uchwyt = (cx: number, y: number, dol: boolean) => {
    const w = 34;
    const lip = 11; // ile wystaje poza listwę
    const h = RAIL * 0.65 + lip;
    const yy = dol ? y + RAIL * 0.35 : y - lip; // górna krawędź bryły
    const d = dol
      ? `M${cx - w / 2},${yy} h${w} v${h - 6} q0,6 -6,6 h${-(w - 12)} q-6,0 -6,-6 z`
      : `M${cx - w / 2},${yy + 6} q0,-6 6,-6 h${w - 12} q6,0 6,6 v${h - 6} h${-w} z`;
    const zew = dol ? yy + h : yy; // krawędź języczka
    return (
      <>
        {dol ? <ellipse cx={cx} cy={zew + 3} rx={w * 0.55} ry={3} fill="#0B1A2A" opacity={0.16} /> : null}
        <path d={d} fill={`url(#${id(dol ? "gripB" : "gripT")})`} stroke={capDark} strokeWidth={0.7} />
        {[-6, 0, 6].map((o) => (
          <line key={o} x1={cx + o} x2={cx + o} y1={dol ? zew - lip + 2 : zew + 2} y2={dol ? zew - 2 : zew + lip - 2} stroke={capDark} strokeWidth={1} opacity={0.45} strokeLinecap="round" />
        ))}
      </>
    );
  };

  const rail = (y: number, flip: boolean) => {
    const gid = flip ? id("railB") : id("railT");
    return (
      <g>
        <rect x={X0} y={y} width={W} height={RAIL} rx={4} fill={`url(#${gid})`} />
        {drewno ? <rect x={X0} y={y} width={W} height={RAIL} rx={4} fill={plShiftHex(hw, -70)} opacity={0.42} filter={`url(#${id("grain")})`} /> : null}
        {/* zaślepki: tworzywo w kolorze, odrobinę wyższe od profilu, zaokrąglone, z wycięciem na linkę */}
        {[X0 - 3, X1 - 9].map((cx, k) => (
          <g key={k}>
            <rect x={cx} y={y - 1.5} width={12} height={RAIL + 3} rx={3.5} fill={`url(#${id("cap")})`} />
            <rect x={k === 0 ? cx + 11 : cx - 0.6} y={y} width={1.2} height={RAIL} fill={capDark} opacity={0.45} />
            <rect x={cx + 4.5} y={flip ? y + RAIL - 4 : y + 1} width={3} height={3} rx={1} fill={hwGroove} opacity={0.75} />
          </g>
        ))}
      </g>
    );
  };

  return (
    <svg viewBox="0 0 400 500" preserveAspectRatio="xMidYMid meet" className="plisa-preview-svg" role="img" aria-label={`Podgląd plisy: tkanina ${fabricLabel || "--"}, mechanizm ${hardwareLabel || "--"}${duo ? ", DUO - linki ukryte w komórkach" : ", linki przez tkaninę"}`}>
      <defs>
        <linearGradient id={id("glass")} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F3F7FA" />
          <stop offset="55%" stopColor="#E2EAF0" />
          <stop offset="100%" stopColor="#D3DEE6" />
        </linearGradient>
        <linearGradient id={id("glint")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="50%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
        {/* lico profilu z rowkiem (górna belka: rowek w dolnej części, dolna: odwrotnie) */}
        {[["railT", 0, 1], ["railB", 1, 0]].map(([n, y1, y2]) => (
          <linearGradient key={n as string} id={id(n as string)} x1="0" y1={y1 as number} x2="0" y2={y2 as number}>
            <stop offset="0%" stopColor={hwHi} />
            <stop offset="7%" stopColor={hwLight} />
            <stop offset="16%" stopColor={hw} />
            <stop offset="52%" stopColor={hwShade} />
            <stop offset="56%" stopColor={hwDark} />
            <stop offset="57.5%" stopColor={hwGroove} />
            <stop offset="63%" stopColor={hwGroove} />
            <stop offset="64.5%" stopColor={hwLight} />
            <stop offset="72%" stopColor={hw} />
            <stop offset="90%" stopColor={hwShade} />
            <stop offset="100%" stopColor={hwDark} />
          </linearGradient>
        ))}
        {[["gripT", 0, 1], ["gripB", 1, 0]].map(([n, y1, y2]) => (
          <linearGradient key={n as string} id={id(n as string)} x1="0" y1={y1 as number} x2="0" y2={y2 as number}>
            <stop offset="0%" stopColor={plShiftHex(cap, 22)} />
            <stop offset="45%" stopColor={cap} />
            <stop offset="100%" stopColor={capDark} />
          </linearGradient>
        ))}
        <linearGradient id={id("cap")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={capDark} />
          <stop offset="30%" stopColor={cap} />
          <stop offset="55%" stopColor={plShiftHex(cap, 16)} />
          <stop offset="100%" stopColor={capDark} />
        </linearGradient>
        <linearGradient id={id("up")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fUpTop} />
          <stop offset="70%" stopColor={fUp} />
          <stop offset="100%" stopColor={fCrest} />
        </linearGradient>
        <linearGradient id={id("down")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fUp} />
          <stop offset="35%" stopColor={fDown} />
          <stop offset="100%" stopColor={fDownDeep} />
        </linearGradient>
        {/* głębia: ciaśniej i ciemniej pod górną belką, światło z lewej (od okna) */}
        <linearGradient id={id("depth")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#000000" stopOpacity="0.22" />
          <stop offset="12%" stopColor="#000000" stopOpacity="0.04" />
          <stop offset="80%" stopColor="#FFFFFF" stopOpacity="0.04" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.1" />
        </linearGradient>
        <linearGradient id={id("side")} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.16" />
          <stop offset="45%" stopColor="#FFFFFF" stopOpacity="0" />
          <stop offset="100%" stopColor="#000000" stopOpacity="0.12" />
        </linearGradient>
        <linearGradient id={id("shadowDown")} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0B1A2A" stopOpacity="0.28" />
          <stop offset="100%" stopColor="#0B1A2A" stopOpacity="0" />
        </linearGradient>
        {/* faktura tkaniny: delikatny splot */}
        <filter id={id("weave")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9 0.25" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="linear" slope="0.16" />
          </feComponentTransfer>
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        {/* okleina drewnopodobna: słoje wzdłuż profilu (szum mocno rozciągnięty w poziomie) */}
        <filter id={id("grain")} x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="0.012 0.55" numOctaves="3" seed="3" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  2.6 0 0 0 -1.05" />
          <feComposite in2="SourceGraphic" operator="in" />
        </filter>
        <clipPath id={id("fabClip")}>
          <rect x={X0 - 2} y={FAB_TOP} width={W + 4} height={FAB_BOT - FAB_TOP} />
        </clipPath>
      </defs>

      {/* szyba */}
      <rect x="0" y="0" width="400" height="500" fill={`url(#${id("glass")})`} />
      <polygon points="250,0 300,0 120,500 70,500" fill={`url(#${id("glint")})`} opacity="0.5" />

      {/* uchwyty w rogach i linki prowadzące do belek (w obu rodzajach plis) */}
      {[
        [X0 + 4, 10, TOP + 2],
        [X1 - 4, 10, TOP + 2],
        [X0 + 4, BOT + RAIL - 2, 486],
        [X1 - 4, BOT + RAIL - 2, 486],
      ].map(([x, y1, y2], k) => (
        <line key={k} x1={x} y1={y1} x2={x} y2={y2} stroke={cordGuide} strokeWidth="1.3" strokeLinecap="round" />
      ))}
      {[
        [X0 - 2, 4],
        [X1 - 10, 4],
        [X0 - 2, 480],
        [X1 - 10, 480],
      ].map(([x, y], k) => (
        <g key={k}>
          <rect x={x} y={y} width={12} height={16} rx={2.5} fill="#F7F8F9" stroke="#C9D0D6" strokeWidth="0.8" />
          <circle cx={x + 6} cy={y + 8} r={1.6} fill="#9AA3AB" />
        </g>
      ))}

      {/* cień plisy na szybie */}
      <rect x={X0 + 6} y={FAB_BOT + RAIL} width={W - 12} height={16} fill={`url(#${id("shadowDown")})`} />

      {/* tkanina: fałda po fałdzie, z wystającymi grzbietami na brzegach */}
      <g clipPath={`url(#${id("fabClip")})`}>
        {pleats.map(({ i, yTop, yCrest, yBot }) => (
          <g key={i}>
            <polygon points={`${X0 + edgeIn},${yTop} ${X1 - edgeIn},${yTop} ${X1},${yCrest} ${X0},${yCrest}`} fill={`url(#${id("up")})`} />
            <polygon points={`${X0},${yCrest} ${X1},${yCrest} ${X1 - edgeIn},${yBot} ${X0 + edgeIn},${yBot}`} fill={`url(#${id("down")})`} />
            <line x1={X0 + 1} y1={yCrest} x2={X1 - 1} y2={yCrest} stroke={fCrest} strokeWidth="0.9" opacity="0.9" />
            <line x1={X0 + edgeIn} y1={yBot} x2={X1 - edgeIn} y2={yBot} stroke={fValley} strokeWidth="0.8" opacity="0.55" />
            {duo ? (
              // przekrój komórki plastra miodu na brzegach (DUO): dwie warstwy połączone w „sześciokąt”
              <>
                <path d={`M${X0 + 1},${yCrest} q4,${-pitch * 0.25} 9,${-pitch * 0.42} M${X0 + 1},${yCrest} q4,${pitch * 0.25} 9,${pitch * 0.42}`} stroke={fDownDeep} strokeWidth="0.9" fill="none" opacity="0.7" />
                <path d={`M${X1 - 1},${yCrest} q-4,${-pitch * 0.25} -9,${-pitch * 0.42} M${X1 - 1},${yCrest} q-4,${pitch * 0.25} -9,${pitch * 0.42}`} stroke={fDownDeep} strokeWidth="0.9" fill="none" opacity="0.7" />
              </>
            ) : (
              // linka przez otwór przy fałdzie: kawałek jasnej linki na ściance i ciemne oczko przy zgięciu
              cols.map((cx, k) => (
                <g key={k}>
                  <line x1={cx + 0.5} y1={yTop + pitch * 0.12} x2={cx + 0.5} y2={yCrest - 1.4} stroke="#000000" strokeOpacity="0.18" strokeWidth="1.1" />
                  <line x1={cx} y1={yTop + pitch * 0.1} x2={cx} y2={yCrest - 1.6} stroke={cord} strokeWidth="1.15" strokeLinecap="round" />
                  <ellipse cx={cx - 0.3} cy={yCrest - 1.3} rx="1.55" ry="2.3" fill={fValley} opacity="0.9" />
                </g>
              ))
            )}
          </g>
        ))}
        <rect x={X0 - 2} y={FAB_TOP} width={W + 4} height={FAB_BOT - FAB_TOP} fill="#808080" filter={`url(#${id("weave")})`} style={{ mixBlendMode: "overlay" }} />
        <rect x={X0 - 2} y={FAB_TOP} width={W + 4} height={FAB_BOT - FAB_TOP} fill={`url(#${id("depth")})`} />
        <rect x={X0 - 2} y={FAB_TOP} width={W + 4} height={FAB_BOT - FAB_TOP} fill={`url(#${id("side")})`} />
      </g>

      {/* cień górnej belki na tkaninie */}
      <rect x={X0} y={FAB_TOP} width={W} height={7} fill={`url(#${id("shadowDown")})`} />

      {/* belki */}
      {rail(TOP, false)}
      {rail(BOT, true)}
      {uchwyty.map((x) => (
        <g key={`t${x}`}>{uchwyt(x, TOP, false)}</g>
      ))}
      {uchwyty.map((x) => (
        <g key={`b${x}`}>{uchwyt(x, BOT, true)}</g>
      ))}
    </svg>
  );
}
