// Rooms and views for the plisy hero (PlisyHero.tsx).
//
// Views are real photos (Pixabay, Content License: free for commercial use,
// no attribution required - picked by eye 2026-09-15 from ~16 candidates per
// category for "what you'd actually see through a window", cropped to the
// window's 644:470 opening and served from /public/plisy/widoki/).
//
// Rooms are drawn, not photographed: a photo of a room with a drawn window
// pasted in reads as a collage, while a consistent illustration with a real
// photo behind the glass reads as an architect's visualisation. Each room is
// a wall colour, a floor, and two or three furniture silhouettes that say
// "bedroom" or "kid's room" at a glance without competing with the product.
//
// Coordinates are in the hero's 1000x800 viewBox. The window frame sits at
// x 150..850, y 68..580 (sill to y=608) and is drawn by PlisyHero on top of whatever the room
// paints, so rooms only need to fill the margins and the area under the sill.

export type HeroView = { id: string; label: string; src: string };

export const HERO_VIEWS: HeroView[] = [
  { id: "ogrod", label: "Ogród", src: "/plisy/widoki/ogrod.jpg" },
  { id: "miasto", label: "Miasto", src: "/plisy/widoki/miasto.jpg" },
  { id: "las", label: "Las", src: "/plisy/widoki/las.jpg" },
  { id: "gory", label: "Góry", src: "/plisy/widoki/gory.jpg" },
  { id: "morze", label: "Morze", src: "/plisy/widoki/morze.jpg" },
  { id: "zima", label: "Zima", src: "/plisy/widoki/zima.jpg" },
];

export type HeroRoom = {
  id: string;
  label: string;
  wall: string;
  wallDark: string;
  floor: string;
  floorDark: string;
  /** Furniture and decor painted around the window, in viewBox units. */
  paint: (uid: string) => React.ReactNode;
};

/** Sill ends at y=608; the floor starts at y=640, leaving a strip of wall. */
const FLOOR_Y = 640;

function Plant({ x, y, scale = 1, pot = "#d9a36b", leaf = "#4f8b4a" }: { x: number; y: number; scale?: number; pot?: string; leaf?: string }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${scale})`}>
      <path d="M-18 0 h36 l-4 34 h-28 z" fill={pot} />
      <path d="M0 0 c-30 -20 -34 -60 -8 -74 c6 20 8 40 8 74 z" fill={leaf} />
      <path d="M0 0 c30 -18 36 -56 12 -70 c-8 18 -12 40 -12 70 z" fill="#5f9c58" />
      <path d="M0 0 c-8 -30 -2 -60 14 -82 c2 28 -2 56 -14 82 z" fill="#3f7a3b" />
    </g>
  );
}

function Frame({ x, y, w, h, tone = "#d9d2c5" }: { x: number; y: number; w: number; h: number; tone?: string }) {
  return (
    <g>
      <rect x={x} y={y} width={w} height={h} rx="3" fill="#2f3237" />
      <rect x={x + 6} y={y + 6} width={w - 12} height={h - 12} fill={tone} />
    </g>
  );
}

export const HERO_ROOMS: HeroRoom[] = [
  {
    id: "salon",
    label: "Salon",
    wall: "#eae4da",
    wallDark: "#d8d0c3",
    floor: "#b98c62",
    floorDark: "#9c7350",
    paint: () => (
      <g>
        {/* Sofa under the window */}
        <rect x="230" y="626" width="540" height="150" rx="18" fill="#6f7f8f" />
        <rect x="250" y="600" width="500" height="46" rx="14" fill="#7d8d9d" />
        <rect x="290" y="616" width="90" height="30" rx="10" fill="#c9a56a" />
        <rect x="400" y="616" width="90" height="30" rx="10" fill="#e6e0d3" />
        <rect x="610" y="616" width="90" height="30" rx="10" fill="#c9a56a" />
        <rect x="212" y="640" width="24" height="120" rx="8" fill="#5f6f7f" />
        <rect x="764" y="640" width="24" height="120" rx="8" fill="#5f6f7f" />
        {/* Floor lamp left, plant right, picture top-right */}
        <rect x="76" y="470" width="6" height="290" fill="#2f3237" />
        <path d="M46 470 h66 l-10 -48 h-46 z" fill="#f0e6d2" stroke="#d8ccb4" strokeWidth="2" />
        <Plant x={930} y={FLOOR_Y + 100} scale={1.4} />
        <Frame x={900} y={120} w={70} h={96} tone="#c9b9a2" />
      </g>
    ),
  },
  {
    id: "sypialnia",
    label: "Sypialnia",
    wall: "#dfe3e8",
    wallDark: "#c9cfd6",
    floor: "#a68a70",
    floorDark: "#8b7159",
    paint: () => (
      <g>
        {/* Bed under the window, seen from the foot end */}
        <rect x="200" y="606" width="600" height="60" rx="14" fill="#5b6470" />
        <rect x="216" y="646" width="568" height="150" rx="12" fill="#f2efe9" />
        <rect x="216" y="700" width="568" height="100" rx="12" fill="#a9b7c6" />
        <rect x="250" y="654" width="200" height="40" rx="12" fill="#ffffff" />
        <rect x="550" y="654" width="200" height="40" rx="12" fill="#ffffff" />
        {/* Nightstands + lamps either side */}
        <rect x="30" y="560" width="96" height="80" rx="6" fill="#8b7159" />
        <rect x="874" y="560" width="96" height="80" rx="6" fill="#8b7159" />
        <rect x="74" y="496" width="8" height="64" fill="#2f3237" />
        <path d="M44 500 h68 l-8 -38 h-52 z" fill="#f4e9d1" />
        <rect x="918" y="496" width="8" height="64" fill="#2f3237" />
        <path d="M888 500 h68 l-8 -38 h-52 z" fill="#f4e9d1" />
      </g>
    ),
  },
  {
    id: "kuchnia",
    label: "Kuchnia",
    wall: "#eef0ee",
    wallDark: "#dadedb",
    floor: "#c5c9cc",
    floorDark: "#a9aeb2",
    paint: () => (
      <g>
        {/* Worktop under the sill, sink centred under the window */}
        <rect x="0" y="622" width="1000" height="24" fill="#dcdad4" />
        <rect x="0" y="646" width="1000" height="154" fill="#3d4650" />
        {[0, 1, 2, 3, 4].map((i) => (
          <rect key={i} x={20 + i * 196} y="660" width="180" height="120" rx="4" fill="#4a545f" />
        ))}
        <rect x="380" y="616" width="240" height="14" rx="5" fill="#b8bec4" />
        <path d="M500 616 v-40 h26 v8 h-18 v32 z" fill="#8f979e" />
        {/* Wall cabinets either side of the window */}
        <rect x="0" y="60" width="120" height="330" fill="#f7f7f4" stroke="#d3d5d2" strokeWidth="2" />
        <rect x="880" y="60" width="120" height="330" fill="#f7f7f4" stroke="#d3d5d2" strokeWidth="2" />
        <rect x="100" y="210" width="5" height="30" rx="2" fill="#8f979e" />
        <rect x="895" y="210" width="5" height="30" rx="2" fill="#8f979e" />
        {/* Herbs on the sill */}
        <Plant x={200} y={604} scale={0.42} pot="#c9c2b6" leaf="#5b9d50" />
        <Plant x={790} y={604} scale={0.38} pot="#c9c2b6" leaf="#6aa85a" />
      </g>
    ),
  },
  {
    id: "dzieciecy",
    label: "Pokój dziecięcy",
    wall: "#f6e7d7",
    wallDark: "#ecd5bf",
    floor: "#d9b28c",
    floorDark: "#c19a76",
    paint: () => (
      <g>
        {/* Bunting along the top edge */}
        {[10, 60, 110, 890, 940].map((x, i) => (
          <path key={x} d={`M${x} 30 l18 34 l18 -34 z`} fill={["#f28c8c", "#f5c46b", "#8cc9f2", "#a8d98a", "#f28c8c"][i]} />
        ))}
        <path d="M0 30 q60 26 146 0 M854 30 q60 26 146 0" fill="none" stroke="#c9b9a5" strokeWidth="2" />
        {/* Toy box + blocks under the window */}
        <rect x="260" y="640" width="200" height="120" rx="12" fill="#f0a5a5" />
        <rect x="276" y="622" width="168" height="26" rx="8" fill="#e78b8b" />
        <rect x="520" y="716" width="54" height="54" rx="8" fill="#8cc9f2" />
        <rect x="580" y="716" width="54" height="54" rx="8" fill="#f5c46b" />
        <rect x="550" y="660" width="54" height="54" rx="8" fill="#a8d98a" />
        {/* Teddy left, rocking horse right */}
        <circle cx="70" cy="690" r="48" fill="#c99a6a" />
        <circle cx="70" cy="622" r="34" fill="#c99a6a" />
        <circle cx="48" cy="596" r="12" fill="#c99a6a" />
        <circle cx="92" cy="596" r="12" fill="#c99a6a" />
        <circle cx="60" cy="618" r="3.5" fill="#3b2f2a" />
        <circle cx="80" cy="618" r="3.5" fill="#3b2f2a" />
        <ellipse cx="70" cy="632" rx="8" ry="4.5" fill="#3b2f2a" />
        <path d="M850 700 q75 -40 150 0" fill="none" stroke="#a97c50" strokeWidth="8" strokeLinecap="round" />
        <rect x="880" y="610" width="90" height="60" rx="14" fill="#c99a6a" />
        <rect x="946" y="580" width="40" height="56" rx="12" fill="#c99a6a" />
        <rect x="892" y="666" width="12" height="36" fill="#a97c50" />
        <rect x="946" y="666" width="12" height="36" fill="#a97c50" />
      </g>
    ),
  },
  {
    id: "chlopiec",
    label: "Pokój chłopca",
    wall: "#dfe8f0",
    wallDark: "#c8d6e2",
    floor: "#9db4c8",
    floorDark: "#7f98ad",
    paint: () => (
      <g>
        {/* Desk under the window with a monitor */}
        <rect x="220" y="700" width="560" height="14" rx="4" fill="#f4f1ea" />
        <rect x="236" y="714" width="12" height="86" fill="#5a6b7a" />
        <rect x="752" y="714" width="12" height="86" fill="#5a6b7a" />
        <rect x="430" y="612" width="140" height="80" rx="6" fill="#1f2a36" />
        <rect x="436" y="618" width="128" height="68" rx="3" fill="#3a7bd5" />
        <rect x="490" y="692" width="20" height="8" fill="#5a6b7a" />
        <rect x="600" y="704" width="80" height="6" rx="3" fill="#2f3237" />
        {/* Shelf with books top-left, basketball bottom-right */}
        <rect x="0" y="230" width="130" height="8" fill="#5a6b7a" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect key={i} x={8 + i * 20} y={186 - (i % 2) * 8} width="16" height={44 + (i % 2) * 8} rx="2" fill={["#e05d5d", "#4a90d9", "#f2b134", "#6bbf6b", "#8e6bd9", "#e08a3c"][i]} />
        ))}
        <circle cx="920" cy="720" r="44" fill="#e0782f" />
        <path d="M876 720 q44 -26 88 0 M920 676 v88 M886 692 q34 28 68 0" fill="none" stroke="#3b2a1e" strokeWidth="3" />
      </g>
    ),
  },
  {
    id: "mlodziezowy",
    label: "Pokój młodzieżowy",
    wall: "#e8e4ee",
    wallDark: "#d4cddd",
    floor: "#7d7d85",
    floorDark: "#65656c",
    paint: () => (
      <g>
        {/* LED strip glow above the window */}
        <rect x="150" y="40" width="700" height="4" rx="2" fill="#a86bff" />
        <rect x="150" y="30" width="700" height="24" rx="12" fill="#a86bff" opacity="0.22" />
        {/* Poster left, bean bag under the window, guitar right */}
        <Frame x={20} y={150} w={90} h={126} tone="#2c2c34" />
        <rect x="36" y="180" width="58" height="58" rx="29" fill="#ff6b6b" />
        <ellipse cx="500" cy="720" rx="150" ry="62" fill="#4c4c58" />
        <ellipse cx="490" cy="680" rx="110" ry="48" fill="#5a5a68" />
        <g transform="translate(930 690) rotate(-10)">
          <rect x="-5" y="-190" width="10" height="170" fill="#3b2a1e" />
          <ellipse cx="0" cy="34" rx="42" ry="50" fill="#c46a3a" />
          <ellipse cx="0" cy="-18" rx="32" ry="34" fill="#c46a3a" />
          <circle cx="0" cy="16" r="12" fill="#2b1b12" />
        </g>
        {/* Headphones on the sill */}
        <path d="M300 604 a28 28 0 0 1 56 0" fill="none" stroke="#2c2c34" strokeWidth="6" />
        <rect x="292" y="600" width="14" height="18" rx="5" fill="#2c2c34" />
        <rect x="350" y="600" width="14" height="18" rx="5" fill="#2c2c34" />
      </g>
    ),
  },
];
