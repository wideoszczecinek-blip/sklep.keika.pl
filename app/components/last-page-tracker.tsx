"use client";

import { useEffect } from "react";

const STORAGE_KEY = "keika_last_page";
const EXCLUDED_PREFIXES = ["/koszyk"];

function currentUrl(): string {
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

function shouldTrack(pathname: string): boolean {
  return !EXCLUDED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function recordCurrentPage() {
  if (typeof window === "undefined") return;
  if (!shouldTrack(window.location.pathname)) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, currentUrl());
  } catch {
    // storage unavailable (private mode etc.) - the cart's back link just
    // falls back to the homepage in that case.
  }
}

// The product configurator (app/page.tsx) updates its own URL - which
// product/step is showing - via raw window.history.pushState, not
// next/navigation, so usePathname()/useSearchParams() won't reliably notice
// those changes. Patching pushState/replaceState once here (whatever they
// currently point to - Next's own App Router patches them too, and Link
// clicks flow through that) covers every way the URL can change: Link
// clicks, router.push, the configurator's manual pushState, and back/forward.
let patched = false;
function ensureHistoryPatched() {
  if (patched || typeof window === "undefined") return;
  patched = true;
  const originalPushState = window.history.pushState.bind(window.history);
  const originalReplaceState = window.history.replaceState.bind(window.history);
  window.history.pushState = ((...args: Parameters<typeof window.history.pushState>) => {
    originalPushState(...args);
    recordCurrentPage();
  }) as typeof window.history.pushState;
  window.history.replaceState = ((...args: Parameters<typeof window.history.replaceState>) => {
    originalReplaceState(...args);
    recordCurrentPage();
  }) as typeof window.history.replaceState;
  window.addEventListener("popstate", recordCurrentPage);
}

/** Mounted once in the root layout. Remembers the last non-cart page the
 * customer was on (product + step + query string included), so the cart's
 * "Wróć do konfiguratora" link can send them back to exactly where they
 * left off instead of always the homepage. */
export default function LastPageTracker() {
  useEffect(() => {
    ensureHistoryPatched();
    recordCurrentPage();
  }, []);

  return null;
}

export function readLastPage(): string {
  if (typeof window === "undefined") return "/";
  try {
    const stored = window.sessionStorage.getItem(STORAGE_KEY);
    if (stored && stored.startsWith("/") && shouldTrack(new URL(stored, window.location.origin).pathname)) {
      return stored;
    }
  } catch {
    // ignore - fall back below
  }
  return "/";
}
