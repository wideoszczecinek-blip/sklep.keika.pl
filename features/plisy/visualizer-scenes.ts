// Rooms and views for the plisy visualizer (PlisyVisualizer.tsx).
//
// v1 of this (2026-09-15, morning) drew the rooms in SVG. The owner's verdict
// the same day: "sam pokój jest zbyt rysunkowy - zbyt prosty - nie podoba mi
// się". Fair - a flat illustration next to a real photo behind the glass
// looked like a placeholder. So v2 is photos all the way down: a real room,
// a real view through the glass, and only the plisa itself drawn - which is
// the one thing that has to be drawn, because the rails are draggable.
//
// All photos: Pixabay, Content License (commercial use, no attribution).
// Rooms were picked from ~24 candidates per category for one property: a
// window seen roughly head-on, so a flat overlay sits on it without
// perspective work. Views were picked for perspective FROM a home - a back
// garden, the neighbours' houses, rooftops from an upper floor - after the
// owner rejected v1's "road through a forest" and "street in a city": "okno
// wychodzące na drogę w lesie - nie, to musi być perspektywa jak z domu".
//
// Coordinates below are in the SOURCE photo's pixels (1280 wide), read off
// a 50 px grid overlay, so they can be checked against the original. Each
// room was then cropped 4:3 around its window (`crop`) and exported at
// 1200x900 to /public/plisy/pokoje/; toViewBox() maps source px -> the
// 1200x900 viewBox the SVG overlay uses.

export const VB_W = 1200;
export const VB_H = 900;

export type Rect = { x: number; y: number; w: number; h: number };

export type View = { id: string; label: string; src: string };

export const VIEWS: View[] = [
  { id: "ogrod", label: "Ogród", src: "/plisy/widoki/ogrod.jpg" },
  { id: "podworko", label: "Podwórko", src: "/plisy/widoki/podworko.jpg" },
  { id: "osiedle", label: "Osiedle", src: "/plisy/widoki/osiedle.jpg" },
  { id: "miasto", label: "Stare miasto", src: "/plisy/widoki/miasto.jpg" },
  { id: "bloki", label: "Bloki", src: "/plisy/widoki/bloki.jpg" },
  { id: "zima", label: "Zima", src: "/plisy/widoki/zima.jpg" },
];

export type SashDef = {
  id: string;
  /** The sash opening the plisa is mounted in. Fabric covers all of it. */
  rect: Rect;
  /** Glass areas inside the sash that get the view painted in. Omitted =
   * the whole sash is glass. Listing panes keeps the photo's own muntins. */
  panes?: Rect[];
  /** Muntin bars drawn over the view when the photo's own are too thin to
   * hit reliably with pane gaps (the salon's black grid). */
  bars?: { color: string; rects: Rect[] };
  /** Where the rails rest before the visitor touches anything. */
  rest: { t: number; b: number };
};

export type RoomDef = {
  id: string;
  label: string;
  src: string;
  /** 4:3 crop applied to the source photo on export. */
  crop: Rect;
  sashes: SashDef[];
  /** Things in the photo that sit IN FRONT of the window (a plant on the
   * sill, a utensil pot on the worktop). The original photo is painted back
   * over the plisa inside these, so the object stays in front. */
  occluders?: Rect[];
};

const SOURCE_ROOMS: RoomDef[] = [
  {
    id: "salon",
    label: "Salon",
    src: "/plisy/pokoje/salon.jpg",
    crop: { x: 336, y: 130, w: 720, h: 540 },
    // Black-framed fixed window between grey curtains; the sash stops short
    // of the frame edge so the curtains keep overlapping it.
    sashes: [
      {
        id: "okno",
        rect: { x: 560, y: 266, w: 272, h: 250 },
        bars: {
          color: "#1f2225",
          rects: [
            { x: 641, y: 266, w: 8, h: 250 },
            { x: 745, y: 266, w: 8, h: 250 },
            { x: 560, y: 329, w: 272, h: 7 },
            { x: 560, y: 414, w: 272, h: 7 },
          ],
        },
        rest: { t: 0.3, b: 0.78 },
      },
    ],
  },
  {
    id: "sypialnia",
    label: "Sypialnia",
    src: "/plisy/pokoje/sypialnia.jpg",
    crop: { x: 123, y: 45, w: 760, h: 570 },
    // Two sashes, each with a meeting rail. Stops at y=440 where the blue
    // sofa's back starts.
    sashes: [
      {
        id: "lewe",
        rect: { x: 355, y: 175, w: 142, h: 265 },
        panes: [
          { x: 355, y: 175, w: 142, h: 153 },
          { x: 355, y: 334, w: 142, h: 106 },
        ],
        rest: { t: 0, b: 0.55 },
      },
      {
        id: "prawe",
        rect: { x: 503, y: 175, w: 142, h: 265 },
        panes: [
          { x: 503, y: 175, w: 142, h: 153 },
          { x: 503, y: 334, w: 142, h: 106 },
        ],
        rest: { t: 0.3, b: 0.9 },
      },
    ],
  },
  {
    id: "kuchnia",
    label: "Kuchnia",
    src: "/plisy/pokoje/kuchnia.jpg",
    crop: { x: 95, y: 0, w: 800, h: 600 },
    // Transom over two casements. The utensil pot on the worktop overlaps
    // the right casement's bottom corner - painted back on top.
    sashes: [
      { id: "gora", rect: { x: 355, y: 50, w: 280, h: 130 }, rest: { t: 0, b: 0.5 } },
      { id: "lewe", rect: { x: 355, y: 205, w: 140, h: 273 }, rest: { t: 0.25, b: 0.75 } },
      { id: "prawe", rect: { x: 505, y: 205, w: 130, h: 273 }, rest: { t: 0.25, b: 0.75 } },
    ],
    occluders: [{ x: 576, y: 372, w: 78, h: 118 }],
  },
  {
    id: "dzieciecy",
    label: "Pokój dziecięcy",
    src: "/plisy/pokoje/dzieciecy.jpg",
    crop: { x: 485, y: 215, w: 680, h: 510 },
    // Single pane under a raised roman blind (reads as a pelmet). Plant pots
    // on both ends of the sill sit in front of the glass.
    sashes: [{ id: "okno", rect: { x: 704, y: 404, w: 242, h: 136 }, rest: { t: 0, b: 0.62 } }],
    occluders: [
      { x: 700, y: 486, w: 54, h: 62 },
      { x: 836, y: 478, w: 112, h: 72 },
    ],
  },
  {
    id: "chlopiec",
    label: "Pokój chłopca",
    src: "/plisy/pokoje/chlopiec.jpg",
    crop: { x: 267, y: 15, w: 760, h: 570 },
    // White two-sash window over the daybed; each sash has a meeting rail.
    sashes: [
      {
        id: "lewe",
        rect: { x: 505, y: 155, w: 135, h: 285 },
        panes: [
          { x: 505, y: 155, w: 135, h: 175 },
          { x: 505, y: 342, w: 135, h: 98 },
        ],
        rest: { t: 0, b: 0.6 },
      },
      {
        id: "prawe",
        rect: { x: 655, y: 155, w: 135, h: 285 },
        panes: [
          { x: 655, y: 155, w: 135, h: 175 },
          { x: 655, y: 342, w: 135, h: 98 },
        ],
        rest: { t: 0.35, b: 0.95 },
      },
    ],
  },
  {
    id: "mlodziezowy",
    label: "Pokój młodzieżowy",
    src: "/plisy/pokoje/mlodziezowy.jpg",
    crop: { x: 120, y: 0, w: 760, h: 570 },
    // Sash window left of the desk. The photo's own roller-shade header
    // above y=46 stays and reads as a pelmet.
    sashes: [
      {
        id: "okno",
        rect: { x: 245, y: 48, w: 250, h: 297 },
        panes: [
          { x: 245, y: 48, w: 250, h: 124 },
          { x: 245, y: 186, w: 250, h: 159 },
        ],
        rest: { t: 0.2, b: 0.72 },
      },
    ],
  },
];

function mapRect(r: Rect, crop: Rect): Rect {
  const s = VB_W / crop.w;
  return {
    x: (r.x - crop.x) * s,
    y: (r.y - crop.y) * s,
    w: r.w * s,
    h: r.h * s,
  };
}

/** Rooms with every rect already in 1200x900 viewBox units. */
export const ROOMS: RoomDef[] = SOURCE_ROOMS.map((room) => ({
  ...room,
  sashes: room.sashes.map((sash) => ({
    ...sash,
    rect: mapRect(sash.rect, room.crop),
    panes: sash.panes?.map((pane) => mapRect(pane, room.crop)),
    bars: sash.bars ? { color: sash.bars.color, rects: sash.bars.rects.map((b) => mapRect(b, room.crop)) } : undefined,
  })),
  occluders: room.occluders?.map((o) => mapRect(o, room.crop)),
}));
