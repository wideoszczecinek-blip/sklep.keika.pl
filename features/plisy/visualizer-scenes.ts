// Views behind the window in the plisy visualizer (PlisyVisualizer.tsx).
//
// Five, picked to one brief from the owner (2026-09-15): "ładnych,
// konwertujących - takich że klient chciałby mieć taki widok - ale też nie
// przesadzony". So: a lawn with a fence, a lake jetty, a meadow with a
// track, old-town rooftops, a snowed-in garden. No sea terraces, no alpine
// panoramas - those read as a holiday, not a home. All seen FROM a home
// (earlier "road through a forest" / "city street" picks were rejected for
// perspective).
//
// Real photos, Pixabay Content License (commercial use, no attribution).
// Full size 1200x882 = the window opening's 784:576; thumbs 320x235.

export type View = { id: string; label: string; src: string; thumb: string };

export const VIEWS: View[] = [
  { id: "ogrod", label: "Ogród", src: "/plisy/widoki/ogrod.jpg", thumb: "/plisy/widoki/ogrod-thumb.jpg" },
  { id: "jezioro", label: "Jezioro", src: "/plisy/widoki/jezioro.jpg", thumb: "/plisy/widoki/jezioro-thumb.jpg" },
  { id: "laka", label: "Łąka", src: "/plisy/widoki/laka.jpg", thumb: "/plisy/widoki/laka-thumb.jpg" },
  { id: "miasto", label: "Stare miasto", src: "/plisy/widoki/miasto.jpg", thumb: "/plisy/widoki/miasto-thumb.jpg" },
  { id: "zima", label: "Zima", src: "/plisy/widoki/zima.jpg", thumb: "/plisy/widoki/zima-thumb.jpg" },
];
