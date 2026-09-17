"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { crmBaseUrl } from "@/lib/shop-public";
import {
  currentDeviceType,
  currentPageSlug,
  getDeviceContext,
  getLandingUrl,
  getSessionToken,
  getVisitorId,
  markSessionStarted,
  parseCampaignParams,
  registerVisit,
} from "@/lib/analytics-context";
import { configuratorStateMeta } from "@/lib/configurator-state";

// Never flood the CRM if something goes into an error loop - the point is
// "did something break here", not a full stack-trace log.
const ERROR_CAP_PER_SESSION = 5;
// Kliknięcia i widoczne sekcje - też z sufitem na jedno wejście na stronę,
// żeby pętla albo bardzo długa sesja nie zalała tabeli.
const CLICK_CAP_PER_PAGE = 250;
const SECTION_CAP_PER_PAGE = 80;
const ANALYTICS_URL = `${crmBaseUrl}/biuro/api/shop-public/analytics_event`;

type Meta = Record<string, string | number | boolean | null>;

/** navigator.sendBeacon (not fetch) - this fires from visibilitychange/
 * unload, where a normal fetch() can get silently cancelled mid-flight as
 * the page goes away. sendBeacon is built for exactly that: queued by the
 * browser and delivered even after the page unloads. */
function sendBeaconEvent(payload: Record<string, unknown>) {
  try {
    const body = JSON.stringify({ visitor_id: getVisitorId(), ...payload });
    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      navigator.sendBeacon(ANALYTICS_URL, body);
    } else {
      void fetch(ANALYTICS_URL, { method: "POST", body, keepalive: true }).catch(() => null);
    }
  } catch {
    // Analytics must never be the reason a page breaks.
  }
}

function emit(eventName: string, label: string, meta?: Meta, extra?: Record<string, unknown>) {
  sendBeaconEvent({
    event_name: eventName,
    event_label: String(label || "").slice(0, 255),
    page_slug: currentPageSlug(),
    session_token: getSessionToken(),
    device_type: currentDeviceType(),
    ...(meta ? { meta } : {}),
    ...(extra || {}),
  });
}

function cleanText(text: string | null | undefined, max = 80): string {
  return String(text || "").replace(/\s+/g, " ").trim().slice(0, max);
}

/** Czytelna nazwa klikniętego elementu: aria-label > tekst > title > alt > href. */
function describeElement(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return cleanText(aria);
  const text = cleanText((el as HTMLElement).innerText || el.textContent || "");
  if (text) return text;
  const title = el.getAttribute("title");
  if (title) return cleanText(title);
  const img = el.querySelector("img[alt]");
  if (img) return cleanText(img.getAttribute("alt"));
  const href = el.getAttribute("href");
  if (href) return cleanText(href, 120);
  return cleanText(el.id ? `#${el.id}` : el.className && typeof el.className === "string" ? `.${el.className.split(/\s+/)[0]}` : el.tagName.toLowerCase());
}

/** W jakiej części strony to było: najbliższy kontener z nagłówkiem. */
function describeContainer(el: Element): string {
  const container = el.closest("[role=dialog], section, aside, header, footer, nav, article, form, main");
  if (!container) return "";
  const heading = container.querySelector("h1, h2, h3");
  const headingText = heading ? cleanText(heading.textContent, 60) : "";
  if (headingText) return headingText;
  if (container.id) return `#${container.id}`;
  const cls = typeof container.className === "string" ? container.className.split(/\s+/)[0] : "";
  return cls ? `.${cls}` : container.tagName.toLowerCase();
}

function fieldName(el: Element): string {
  const aria = el.getAttribute("aria-label");
  if (aria) return cleanText(aria, 40);
  const label = el.closest("label");
  if (label) {
    for (const node of Array.from(label.childNodes)) {
      if (node.nodeType === Node.TEXT_NODE && cleanText(node.textContent)) return cleanText(node.textContent, 40);
    }
  }
  const id = el.getAttribute("id");
  if (id) {
    try {
      const linked = document.querySelector(`label[for="${CSS.escape(id)}"]`);
      if (linked) return cleanText(linked.textContent, 40);
    } catch {
      // brak CSS.escape - pomijamy
    }
  }
  return cleanText(el.getAttribute("placeholder") || el.getAttribute("name") || el.getAttribute("autocomplete") || el.tagName.toLowerCase(), 40);
}

/** IntersectionObserver nie patrzy na opacity/visibility - ukryte sekcje
 * produktowe na stronie głównej (renderowane, ale niewidoczne) nie mogą
 * liczyć się jako "zobaczył". */
function isReallyVisible(el: Element): boolean {
  let node: Element | null = el;
  let depth = 0;
  while (node && node !== document.body && depth < 12) {
    if (node.getAttribute("aria-hidden") === "true" || (node as HTMLElement).hidden) return false;
    const cs = getComputedStyle(node);
    if (cs.visibility === "hidden" || cs.display === "none" || Number(cs.opacity) === 0) return false;
    node = node.parentElement;
    depth += 1;
  }
  const rect = el.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return false;
  // Zasłonięte przez inny element (np. sekcje produktu pod tłem strony
  // głównej): sprawdzamy, co jest na wierzchu w środku elementu.
  const cx = Math.min(window.innerWidth - 1, Math.max(0, rect.left + rect.width / 2));
  const cy = Math.min(window.innerHeight - 1, Math.max(0, rect.top + rect.height / 2));
  const top = document.elementFromPoint(cx, cy);
  if (!top) return false;
  if (el.contains(top) || top.contains(el)) return true;
  // Pasek zgody / nakładki fixed na wierzchu nie znaczą, że sekcja jest ukryta.
  const topCs = getComputedStyle(top);
  return topCs.position === "fixed" || Boolean(top.closest(".consent-bar, [role=dialog]"));
}

function isExternalLink(href: string): boolean {
  try {
    const url = new URL(href, window.location.href);
    return url.origin !== window.location.origin;
  } catch {
    return false;
  }
}

/** Mounted once in the root layout. Zbiera "w tle" wszystko, czego nie
 * śledzą konfiguratory same z siebie: start sesji ze źródłem wejścia,
 * każdą podstronę, każde kliknięcie, otwarte okna modalne, przewinięcie,
 * które sekcje zobaczył, rozwinięte pytania FAQ, wypełnione pola (nazwy),
 * czas aktywny, błędy JS i moment wyjścia ze stanem konfiguratora - tak,
 * żeby po fakcie dało się odpowiedzieć "gdzie uciekają i co poprawić". */
export default function SiteAnalytics() {
  // Deliberately just the path, not search params: app/page.tsx switches
  // products via raw history.pushState, which useSearchParams() won't
  // reliably pick up anyway - the pushState hook below covers that.
  const pathname = usePathname();
  const errorCountRef = useRef(0);
  const pageEnteredAtRef = useRef(Date.now());
  const sessionTokenRef = useRef("");
  const pageStatsRef = useRef({
    clicks: 0,
    lastClick: "",
    lastSection: "",
    maxScrollPct: 0,
    activeSeconds: 0,
    sections: 0,
    milestones: new Set<number>(),
    lastInputAt: Date.now(),
    hiddenAt: 0,
    perfSent: false,
  });

  function pageExitMeta(reason: string): Meta {
    const stats = pageStatsRef.current;
    return {
      seconds_on_page: Math.round((Date.now() - pageEnteredAtRef.current) / 1000),
      active_seconds: stats.activeSeconds,
      max_scroll_pct: stats.maxScrollPct,
      clicks: stats.clicks,
      last_click: stats.lastClick,
      last_section: stats.lastSection,
      reason,
      ...configuratorStateMeta(),
    };
  }

  function resetPageStats() {
    const stats = pageStatsRef.current;
    stats.clicks = 0;
    stats.lastClick = "";
    stats.lastSection = "";
    stats.maxScrollPct = 0;
    stats.activeSeconds = 0;
    stats.sections = 0;
    stats.milestones = new Set<number>();
    stats.perfSent = false;
  }

  // --- start sesji + błędy JS (raz na montaż) ---
  useEffect(() => {
    sessionTokenRef.current = getSessionToken();

    if (markSessionStarted()) {
      const visit = registerVisit();
      const landing = getLandingUrl();
      emit("session_start", visit.returning ? "returning" : "new", {
        landing_url: landing,
        referrer: (document.referrer || "").slice(0, 500),
        ...parseCampaignParams(landing),
        visit_count: visit.visitCount,
        first_seen_days_ago: visit.firstSeenDaysAgo,
        ...getDeviceContext(),
      }, { referrer: (document.referrer || "").slice(0, 500) });
    }

    function reportError(message: string, source: string, extra?: Record<string, string>) {
      if (errorCountRef.current >= ERROR_CAP_PER_SESSION) return;
      errorCountRef.current += 1;
      emit("js_error", source, { message: String(message).slice(0, 500), ...extra });
    }

    function onError(event: ErrorEvent) {
      // Facebook/Instagram's in-app browser injects its own logger
      // (iabjs://navigation_performance_logger_android) whose "Java object
      // is gone" failures were ~90% of everything recorded here (613 of the
      // 615 sessions with a js_error, audit 2026-09-13) - not our code, and
      // they burned the per-session cap before a real error could land.
      // "Script error." is the browser's cross-origin placeholder for a
      // third-party script failure - equally unactionable.
      const filename = event.filename || "";
      const message = event.message || "";
      if (filename.startsWith("iabjs://") || /Error invoking postMessage/i.test(message) || message === "Script error.") {
        return;
      }
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

  // --- page_view: zmiana trasy Next + pushState/replaceState/popstate
  // (strona główna przełącza produkty przez pushState) ---
  useEffect(() => {
    let lastUrl = "";
    let lastReferrer = (document.referrer || "").slice(0, 500);
    const view = (source: string) => {
      const url = window.location.href;
      if (url === lastUrl) return;
      const previous = lastUrl;
      lastUrl = url;
      let product = "";
      try {
        product = new URL(url).searchParams.get("produkt") || "";
      } catch {
        // pomijamy
      }
      emit("page_view", cleanText(document.title, 120), {
        page_url: url.slice(0, 600),
        previous_url: (previous || lastReferrer).slice(0, 600),
        product_slug: product,
        source,
        viewport_w: window.innerWidth,
        viewport_h: window.innerHeight,
      });
      lastReferrer = previous;
    };
    // Tytuł strony ustawia się chwilę po nawigacji - lekkie opóźnienie
    // daje właściwy tytuł i realne parametry adresu.
    const scheduleView = (source: string) => window.setTimeout(() => view(source), 150);
    scheduleView("load");

    const history = window.history;
    const originalPush = history.pushState;
    const originalReplace = history.replaceState;
    history.pushState = function pushStateTracked(...args: Parameters<History["pushState"]>) {
      const result = originalPush.apply(this, args);
      scheduleView("pushState");
      return result;
    };
    history.replaceState = function replaceStateTracked(...args: Parameters<History["replaceState"]>) {
      const result = originalReplace.apply(this, args);
      scheduleView("replaceState");
      return result;
    };
    const onPop = () => scheduleView("popstate");
    window.addEventListener("popstate", onPop);
    return () => {
      history.pushState = originalPush;
      history.replaceState = originalReplace;
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  // --- kliknięcia (każde), rage click, linki wychodzące, FAQ, pola, selecty ---
  useEffect(() => {
    const clickTimes = new WeakMap<Element, number[]>();
    const rageReported = new WeakMap<Element, number>();
    let lastClickKey = "";
    let lastClickAt = 0;
    const fieldsSeen = new Set<string>();

    function onClick(event: MouseEvent) {
      const stats = pageStatsRef.current;
      stats.lastInputAt = Date.now();
      const rawTarget = event.target as Element | null;
      if (!rawTarget || !(rawTarget instanceof Element)) return;
      const el = rawTarget.closest("a, button, [role=button], summary, label, input, select, textarea, [data-track]") || rawTarget;

      // Rage click: 3+ kliknięcia w ten sam element w 1,5 s - frustracja
      // (nieaktywny przycisk, coś się nie otwiera).
      const now = Date.now();
      const times = (clickTimes.get(el) || []).filter((t) => now - t < 1500);
      times.push(now);
      clickTimes.set(el, times);
      if (times.length >= 3 && now - (rageReported.get(el) || 0) > 5000) {
        rageReported.set(el, now);
        emit("rage_click", describeElement(el), { tag: el.tagName.toLowerCase(), section: describeContainer(el), count: times.length });
      }

      if (stats.clicks >= CLICK_CAP_PER_PAGE) return;
      // Kliknięcia w "puste" miejsca (tekst, tło) też się liczą - to dead
      // clicks; dla dużych kontenerów nie czytamy całego tekstu, tylko tag.
      const isInteractive = el !== rawTarget || /^(a|button|summary|label|input|select|textarea)$/i.test(rawTarget.tagName) || rawTarget.getAttribute("role") === "button";
      const label = isInteractive || (el.textContent || "").length <= 200
        ? describeElement(el)
        : cleanText(el.id ? `#${el.id}` : typeof el.className === "string" && el.className ? `.${el.className.split(/s+/)[0]}` : el.tagName.toLowerCase());
      const tag = el.tagName.toLowerCase();
      const key = `${tag}|${label}`;
      if (key === lastClickKey && now - lastClickAt < 300) return;
      lastClickKey = key;
      lastClickAt = now;
      stats.clicks += 1;
      stats.lastClick = label;
      const meta: Meta = {
        tag,
        section: describeContainer(el),
        interactive: isInteractive,
      };
      if (el instanceof HTMLInputElement && (el.type === "radio" || el.type === "checkbox")) {
        meta.checked = el.checked;
        meta.input_type = el.type;
      }
      if (el instanceof HTMLButtonElement && el.disabled) {
        meta.disabled = true;
      }
      const href = el.getAttribute("href");
      if (href) {
        meta.href = href.slice(0, 200);
        if (/^(tel:|mailto:|sms:)/i.test(href) || isExternalLink(href)) {
          emit("outbound_click", href.slice(0, 200), { text: label, section: meta.section });
        }
      }
      emit("click", label, meta);
    }

    // <details> (FAQ, "Pokaż więcej"): zdarzenie toggle nie bąbelkuje -
    // nasłuch w fazie capture.
    function onToggle(event: Event) {
      const details = event.target as HTMLDetailsElement | null;
      if (!details || details.tagName !== "DETAILS") return;
      const summary = details.querySelector("summary");
      emit("accordion_toggle", cleanText(summary?.textContent, 120), { open: details.open, section: describeContainer(details) });
    }

    // Pola poza checkoutem (checkout ma własne checkout_field): nazwa pola
    // i czy zostało wypełnione, nigdy wartość.
    function onBlur(event: FocusEvent) {
      const el = event.target as Element | null;
      if (!el || !(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return;
      if (el instanceof HTMLInputElement && ["radio", "checkbox", "hidden", "submit", "button"].includes(el.type)) return;
      if (el.closest(".cart-checkout-left")) return;
      // Pola niewidoczne (honeypot antyspamowy, ukryte inputy) - nie są
      // ruchem klienta.
      if (el.offsetParent === null || el.getAttribute("aria-hidden") === "true" || el.tabIndex === -1) return;
      const name = fieldName(el);
      const filled = String(el.value || "").trim() !== "";
      const key = `${name}|${filled ? 1 : 0}`;
      if (fieldsSeen.has(key)) return;
      fieldsSeen.add(key);
      emit("field_blur", name, {
        filled,
        length: String(el.value || "").length,
        input_type: el instanceof HTMLInputElement ? el.type : el.tagName.toLowerCase(),
        section: describeContainer(el),
      });
    }

    function onChange(event: Event) {
      const el = event.target as Element | null;
      if (!(el instanceof HTMLSelectElement)) return;
      const option = el.options[el.selectedIndex];
      emit("select_change", fieldName(el), { value: cleanText(option?.text, 60), section: describeContainer(el) });
    }

    function onInput() {
      pageStatsRef.current.lastInputAt = Date.now();
    }

    document.addEventListener("click", onClick, true);
    document.addEventListener("toggle", onToggle, true);
    document.addEventListener("blur", onBlur, true);
    document.addEventListener("change", onChange, true);
    document.addEventListener("keydown", onInput, true);
    document.addEventListener("touchstart", onInput, { capture: true, passive: true });
    document.addEventListener("mousemove", onInput, { capture: true, passive: true });
    return () => {
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("blur", onBlur, true);
      document.removeEventListener("change", onChange, true);
      document.removeEventListener("keydown", onInput, true);
      document.removeEventListener("touchstart", onInput, true);
      document.removeEventListener("mousemove", onInput, true);
    };
  }, []);

  // --- okna modalne: kiedy się pojawiają i na jak długo ---
  useEffect(() => {
    const open = new Map<Element, { label: string; at: number }>();
    const SELECTOR = "[role=dialog], [aria-modal=true], .hero-product-added-toast, .rescue-modal, .promo-save-modal";
    let scheduled = 0;
    function scan() {
      scheduled = 0;
      const present = new Set<Element>();
      document.querySelectorAll(SELECTOR).forEach((el) => {
        present.add(el);
        if (open.has(el)) return;
        const heading = el.querySelector("h1, h2, h3, strong");
        const label = cleanText(el.getAttribute("aria-label") || heading?.textContent || el.className, 120) || "modal";
        open.set(el, { label, at: Date.now() });
        emit("modal_open", label);
      });
      open.forEach((info, el) => {
        if (present.has(el) && el.isConnected) return;
        open.delete(el);
        emit("modal_close", info.label, { seconds_open: Math.round((Date.now() - info.at) / 1000) });
      });
    }
    const observer = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = window.setTimeout(scan, 120);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scan();
    return () => {
      observer.disconnect();
      if (scheduled) window.clearTimeout(scheduled);
    };
  }, []);

  // --- które sekcje / nagłówki zobaczył ---
  useEffect(() => {
    const seen = new Set<string>();
    const io = new IntersectionObserver(
      (entries) => {
        const stats = pageStatsRef.current;
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          if (!isReallyVisible(el)) continue;
          const label = cleanText(el.tagName.startsWith("H") ? el.textContent : el.id || el.getAttribute("aria-label") || el.querySelector("h1, h2, h3")?.textContent || "", 100);
          if (!label || seen.has(label) || stats.sections >= SECTION_CAP_PER_PAGE) continue;
          seen.add(label);
          stats.sections += 1;
          stats.lastSection = label;
          emit("section_view", label, { tag: el.tagName.toLowerCase(), seconds_since_enter: Math.round((Date.now() - pageEnteredAtRef.current) / 1000) });
        }
      },
      { threshold: 0.5 },
    );
    const observed = new WeakSet<Element>();
    let scheduled = 0;
    function attach() {
      scheduled = 0;
      document.querySelectorAll("main h2, main h3, main section[id], main [data-track-section], h1").forEach((el) => {
        if (observed.has(el)) return;
        // Sekcja z własnym nagłówkiem: liczy się nagłówek, nie duplikat po id.
        if (el.tagName === "SECTION" && el.querySelector("h1, h2, h3")) return;
        observed.add(el);
        io.observe(el);
      });
    }
    const mo = new MutationObserver(() => {
      if (scheduled) return;
      scheduled = window.setTimeout(attach, 800);
    });
    mo.observe(document.body, { childList: true, subtree: true });
    attach();
    return () => {
      io.disconnect();
      mo.disconnect();
      if (scheduled) window.clearTimeout(scheduled);
    };
    // Nowa strona = nowy zestaw sekcji.
  }, [pathname]);

  // --- głębokość przewinięcia (okno i wewnętrzne kontenery, np. .hero-full) ---
  useEffect(() => {
    let throttled = 0;
    function measure(target: EventTarget | null) {
      const stats = pageStatsRef.current;
      let scrollTop = 0;
      let clientHeight = 0;
      let scrollHeight = 0;
      if (target instanceof HTMLElement && target !== document.documentElement && target !== document.body) {
        scrollTop = target.scrollTop;
        clientHeight = target.clientHeight;
        scrollHeight = target.scrollHeight;
      } else {
        const root = document.scrollingElement || document.documentElement;
        scrollTop = root.scrollTop;
        clientHeight = window.innerHeight;
        scrollHeight = root.scrollHeight;
      }
      if (scrollHeight <= clientHeight + 40) return;
      const pct = Math.min(100, Math.round(((scrollTop + clientHeight) / scrollHeight) * 100));
      if (pct <= stats.maxScrollPct) return;
      stats.maxScrollPct = pct;
      for (const milestone of [25, 50, 75, 100]) {
        if (pct >= milestone && !stats.milestones.has(milestone)) {
          stats.milestones.add(milestone);
          emit("scroll_depth", String(milestone), { seconds_since_enter: Math.round((Date.now() - pageEnteredAtRef.current) / 1000) });
        }
      }
    }
    function onScroll(event: Event) {
      pageStatsRef.current.lastInputAt = Date.now();
      if (throttled) return;
      const target = event.target === document ? null : event.target;
      throttled = window.setTimeout(() => {
        throttled = 0;
        measure(target);
      }, 250);
    }
    document.addEventListener("scroll", onScroll, { capture: true, passive: true });
    return () => {
      document.removeEventListener("scroll", onScroll, true);
      if (throttled) window.clearTimeout(throttled);
    };
  }, []);

  // --- czas aktywny: tylko gdy karta widoczna i był ruch w ostatnich 30 s ---
  useEffect(() => {
    const interval = window.setInterval(() => {
      const stats = pageStatsRef.current;
      if (document.visibilityState !== "visible") return;
      if (Date.now() - stats.lastInputAt > 30000) return;
      stats.activeSeconds += 5;
    }, 5000);
    return () => window.clearInterval(interval);
  }, []);

  // --- wydajność: jak długo ładowała się strona (spinner = ucieczki) ---
  useEffect(() => {
    let lcp = 0;
    let observer: PerformanceObserver | null = null;
    try {
      observer = new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          lcp = Math.round(entry.startTime);
        }
      });
      observer.observe({ type: "largest-contentful-paint", buffered: true });
    } catch {
      observer = null;
    }
    const timer = window.setTimeout(() => {
      const stats = pageStatsRef.current;
      if (stats.perfSent) return;
      stats.perfSent = true;
      const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
      emit("page_perf", nav?.type || "navigate", {
        ttfb_ms: nav ? Math.round(nav.responseStart) : null,
        dcl_ms: nav ? Math.round(nav.domContentLoadedEventEnd) : null,
        load_ms: nav ? Math.round(nav.loadEventEnd) : null,
        lcp_ms: lcp || null,
        transfer_kb: nav ? Math.round((nav.transferSize || 0) / 1024) : null,
      });
      observer?.disconnect();
    }, 6000);
    return () => {
      window.clearTimeout(timer);
      observer?.disconnect();
    };
  }, []);

  // Resets the "time on this page" clock on every route change, and fires
  // one exit beacon for the page being left (covers SPA navigation, not
  // just closing the tab).
  useEffect(() => {
    const enteredAt = Date.now();
    pageEnteredAtRef.current = enteredAt;
    resetPageStats();
    const pageAtMount = currentPageSlug();
    return () => {
      sendBeaconEvent({
        event_name: "page_exit",
        page_slug: pageAtMount,
        session_token: sessionTokenRef.current,
        device_type: currentDeviceType(),
        meta: pageExitMeta("navigation"),
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  // Closing the tab / backgrounding (mobile especially) never unmounts
  // React - visibilitychange is the reliable signal for "actually leaving"
  // that the effect cleanup above can't catch on its own. Powrót do karty
  // też zapisujemy (page_return) - "wrócił po X sekundach".
  useEffect(() => {
    function onVisibilityChange() {
      const stats = pageStatsRef.current;
      if (document.visibilityState === "hidden") {
        stats.hiddenAt = Date.now();
        emit("page_exit", "", pageExitMeta("hidden"));
        return;
      }
      if (document.visibilityState === "visible" && stats.hiddenAt) {
        const hiddenSeconds = Math.round((Date.now() - stats.hiddenAt) / 1000);
        stats.hiddenAt = 0;
        stats.lastInputAt = Date.now();
        emit("page_return", "", { hidden_seconds: hiddenSeconds });
      }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The CRM's "ilość osób online" counts anyone with an event in the last
  // 2 minutes - without this, that only ever caught someone mid-click,
  // undercounting anyone just reading a page. A heartbeat while the tab is
  // actually visible (not backgrounded/minimized) keeps a real visitor
  // "online" the whole time they're genuinely looking at the site.
  useEffect(() => {
    function beat() {
      if (document.visibilityState !== "visible") return;
      const stats = pageStatsRef.current;
      emit("heartbeat", "", {
        active_seconds: stats.activeSeconds,
        max_scroll_pct: stats.maxScrollPct,
        clicks: stats.clicks,
        ...configuratorStateMeta(),
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
