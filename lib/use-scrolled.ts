"use client";

import { useEffect, useState } from "react";

/** True once the page has scrolled past `threshold` px. Drives .hero-header's
 * compact mode (see .hero-header.is-compact in globals.css) on the product,
 * category and configurator pages: past the threshold the full header
 * (logo, menu label, cart text/price) hides, leaving only the hamburger
 * toggle and a small cart icon pinned in place. */
export function useScrolledPast(threshold = 80): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > threshold);
    }
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [threshold]);

  return scrolled;
}
