// Views behind the window in the plisy visualizer (PlisyVisualizer.tsx).
//
// Real photos, Pixabay Content License (commercial use, no attribution).
// Picked for perspective FROM a home - a back garden, the neighbours'
// houses, rooftops from an upper floor - after the owner rejected "a road
// through a forest" and "a street in a city" (2026-09-15): "to musi być
// perspektywa jak z domu lub mieszkania". One is picked at random per page
// load; there is deliberately no picker - the owner cut it the same evening
// ("daj tylko jeden randomowy widok za oknem, bez opcji zmiany").
//
// The room photos that briefly sat behind the window (v4, a few hours) are
// gone too: "odpuść wnętrze". The window is drawn on a plain backdrop again.

export type View = { id: string; src: string };

export const VIEWS: View[] = [
  { id: "ogrod", src: "/plisy/widoki/ogrod.jpg" },
  { id: "podworko", src: "/plisy/widoki/podworko.jpg" },
  { id: "osiedle", src: "/plisy/widoki/osiedle.jpg" },
  { id: "miasto", src: "/plisy/widoki/miasto.jpg" },
  { id: "bloki", src: "/plisy/widoki/bloki.jpg" },
  { id: "zima", src: "/plisy/widoki/zima.jpg" },
];
