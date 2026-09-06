"use client";

// Shared version of the helper that used to live only inline in app/page.tsx
// (see its own "Dodano do koszyka!" overlay) - needed here too because the
// exact same containment problem hits any position:fixed element mounted
// from inside <ConfiguratorPanel>: on mobile, .hero-product-config-panel
// (an ancestor) gets a CSS `transform` during its own fade-in/out
// animation, which makes it the containing block for fixed descendants (a
// CSS rule, not a bug) - so a fixed banner/modal that should sit relative
// to the real viewport instead renders relative to that panel, often miles
// off-screen. Portaling straight to <body> escapes that entirely. Desktop
// never has this problem (no such transform there), so this only actually
// portals below 760px - in place otherwise, unchanged.
import { useLayoutEffect, useState } from "react";
import { createPortal } from "react-dom";

export default function MobileOverlayPortal({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  useLayoutEffect(() => {
    const mql = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  if (!isMobile) return <>{children}</>;
  return createPortal(children, document.body);
}
