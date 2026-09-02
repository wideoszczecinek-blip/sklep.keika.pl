"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { crmBaseUrl } from "@/lib/shop-public";

const SESSION_KEY = "keika_shop_session_token";
// Never flood the CRM if something goes into an error loop - the point is
// "did something break here", not a full stack-trace log.
const ERROR_CAP_PER_SESSION = 5;
const ANALYTICS_URL = `${crmBaseUrl}/biuro/api/shop-public/analytics_event`;

function getOrCreateSessionToken(): string {
  try {
    let token = window.sessionStorage.getItem(SESSION_KEY);
    if (!token) {
      token = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      window.sessionStorage.setItem(SESSION_KEY, token);
    }
    return token;
  } catch {
    return "";
  }
}

/** navigator.sendBeacon (not fetch) - this fires from visibilitychange/
 * unload, where a normal fetch() can get silently cancelled mid-flight as
 * the page goes away. sendBeacon is built for exactly that: queued by the
 * browser and delivered even after the page unloads. */
function sendBeaconEvent(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify(payload);
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(ANALYTICS_URL, body);
    } else {
      void fetch(ANALYTICS_URL, { method: "POST", body, keepalive: true }).catch(() => null);
    }
  } catch {
    // Analytics must never be the reason a page breaks.
  }
}

/** Mounted once in the root layout - three things nothing on this site
 * tracked before: real JS errors wherever they happen ("gdzie łapią
 * błędy"), when someone actually leaves a page and how long they were on
 * it ("kiedy opuszczają stronę"), and unhandled promise rejections (a
 * failed fetch/API call nobody awaited the error on - the most common way
 * a checkout step silently does nothing when clicked, "co ich zniechęca"). */
export default function SiteAnalytics() {
  // Deliberately just the path, not search params: app/page.tsx switches
  // products via raw history.pushState (see LastPageTracker's own comment
  // on why), which useSearchParams() won't reliably pick up anyway - and
  // useSearchParams() specifically would force this always-mounted root
  // layout component into requiring a Suspense boundary around the whole
  // app for no real benefit here.
  const pathname = usePathname();
  const errorCountRef = useRef(0);
  const pageEnteredAtRef = useRef(Date.now());
  const sessionTokenRef = useRef("");

  useEffect(() => {
    sessionTokenRef.current = getOrCreateSessionToken();

    function reportError(message: string, source: string, extra?: Record<string, string>) {
      if (errorCountRef.current >= ERROR_CAP_PER_SESSION) return;
      errorCountRef.current += 1;
      sendBeaconEvent({
        event_name: "js_error",
        event_label: source,
        page_slug: window.location.pathname + window.location.search,
        session_token: sessionTokenRef.current,
        device_type: window.innerWidth < 768 ? "mobile" : "desktop",
        meta: { message: String(message).slice(0, 500), ...extra },
      });
    }

    function onError(event: ErrorEvent) {
      reportError(event.message || "unknown error", "window.onerror", {
        filename: event.filename || "",
        line: String(event.lineno || ""),
      });
    }
    function onRejection(event: PromiseRejectionEvent) {
      const reason = event.reason as unknown;
      const message = reason instanceof Error ? reason.message : String(reason);
      reportError(message, "unhandledrejection");
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
    // Attached once - errors can happen on any page, not just the one
    // mounted when this effect first ran.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Resets the "time on this page" clock on every route change, and fires
  // one exit beacon for the page being left (covers SPA navigation, not
  // just closing the tab).
  useEffect(() => {
    const enteredAt = Date.now();
    pageEnteredAtRef.current = enteredAt;
    const pageAtMount = window.location.pathname + window.location.search;
    return () => {
      sendBeaconEvent({
        event_name: "page_exit",
        page_slug: pageAtMount,
        session_token: sessionTokenRef.current,
        device_type: window.innerWidth < 768 ? "mobile" : "desktop",
        meta: { seconds_on_page: Math.round((Date.now() - enteredAt) / 1000) },
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Closing the tab / backgrounding (mobile especially) never unmounts
  // React - visibilitychange is the reliable signal for "actually leaving"
  // that the effect cleanup above can't catch on its own.
  useEffect(() => {
    function onVisibilityChange() {
      if (document.visibilityState !== "hidden") return;
      sendBeaconEvent({
        event_name: "page_exit",
        page_slug: window.location.pathname + window.location.search,
        session_token: sessionTokenRef.current,
        device_type: window.innerWidth < 768 ? "mobile" : "desktop",
        meta: { seconds_on_page: Math.round((Date.now() - pageEnteredAtRef.current) / 1000), reason: "hidden" },
      });
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, []);

  // The CRM's "ilość osób online" counts anyone with an event in the last
  // 2 minutes - without this, that only ever caught someone mid-click,
  // undercounting anyone just reading a page. A heartbeat while the tab is
  // actually visible (not backgrounded/minimized) keeps a real visitor
  // "online" the whole time they're genuinely looking at the site.
  useEffect(() => {
    function beat() {
      if (document.visibilityState !== "visible") return;
      sendBeaconEvent({
        event_name: "heartbeat",
        page_slug: window.location.pathname + window.location.search,
        session_token: sessionTokenRef.current,
        device_type: window.innerWidth < 768 ? "mobile" : "desktop",
      });
    }
    beat();
    const interval = window.setInterval(beat, 45000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);

  return null;
}
