"use client";

// Duży podgląd próbnika po najechaniu myszą (właściciel, 2026-09-17: "podgląd
// swatch musi być większy i zawsze mieścić się na ekranie"). Jeden komponent
// dla wszystkich konfiguratorów: nasłuchuje delegacyjnie na document i
// rozpoznaje karty opcji po wspólnych klasach (.hardware-card,
// .hero-product-mesh-option) albo po jawnym data-hover-preview="<url>".
// Renderuje się w portalu (position: fixed), więc nie przycina go żaden
// overflow, a pozycję liczy od kursora: gdy kursor jest w dolnej połowie
// ekranu - podgląd NAD kursorem, w górnej - POD; w poziomie domknięty do
// krawędzi. Tylko urządzenia z myszą (hover + pointer: fine).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { optimizeImageUrl } from "@/lib/image-optim";

const PREVIEW_MAX_WIDTH = 420;
const PREVIEW_MARGIN = 10;
const CURSOR_GAP = 18;
const CARD_SELECTOR = "[data-hover-preview], .hardware-card, .hero-product-mesh-option";

type PreviewState = {
  src: string;
  label: string;
  top: number;
  left: number;
  width: number;
  height: number;
  above: boolean;
};

/** Adres zdjęcia opcji: z atrybutu albo z background-image miniatury; gdy to
 *  już /_next/image?url=…, wracamy do źródła, żeby poprosić o większy wariant. */
function resolveCardImage(card: HTMLElement): string {
  const explicit = card.getAttribute("data-hover-preview");
  if (explicit) {
    return explicit;
  }
  const thumb = card.querySelector<HTMLElement>(".hardware-card-image, .hero-product-mesh-option-image");
  if (!thumb) {
    return "";
  }
  const raw = window.getComputedStyle(thumb).backgroundImage;
  const match = raw.match(/url\(["']?(.*?)["']?\)/);
  if (!match || !match[1] || match[1].startsWith("data:")) {
    return "";
  }
  const url = match[1];
  try {
    const parsed = new URL(url, window.location.origin);
    if (parsed.pathname === "/_next/image") {
      return parsed.searchParams.get("url") || "";
    }
    return url;
  } catch {
    return url;
  }
}

function resolveCardLabel(card: HTMLElement): string {
  return (
    card.getAttribute("data-hover-preview-label") ||
    card.getAttribute("aria-label") ||
    card.querySelector("strong")?.textContent?.trim() ||
    ""
  ).replace(/^Powiększ:?\s*/i, "");
}

function computePosition(clientX: number, clientY: number): Pick<PreviewState, "top" | "left" | "width" | "height" | "above"> {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(PREVIEW_MAX_WIDTH, vw - PREVIEW_MARGIN * 2, Math.round(vh * 0.55));
  const height = Math.round(width * 0.86) + 44;
  const above = clientY > vh / 2;
  let top = above ? clientY - CURSOR_GAP - height : clientY + CURSOR_GAP;
  top = Math.max(PREVIEW_MARGIN, Math.min(vh - height - PREVIEW_MARGIN, top));
  let left = clientX - width / 2;
  left = Math.max(PREVIEW_MARGIN, Math.min(vw - width - PREVIEW_MARGIN, left));
  return { top, left, width, height, above };
}

export default function SwatchHoverPreview() {
  const [state, setState] = useState<PreviewState | null>(null);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
      return;
    }
    let activeCard: HTMLElement | null = null;
    let lastPointer = { x: 0, y: 0 };

    const show = (card: HTMLElement, x: number, y: number) => {
      const src = resolveCardImage(card);
      if (!src) {
        activeCard = null;
        setState(null);
        return;
      }
      activeCard = card;
      setState({ src, label: resolveCardLabel(card), ...computePosition(x, y) });
    };
    const hide = () => {
      activeCard = null;
      setState((current) => (current ? null : current));
    };

    const onMove = (event: MouseEvent) => {
      lastPointer = { x: event.clientX, y: event.clientY };
      const target = event.target as HTMLElement | null;
      const card = target?.closest?.(CARD_SELECTOR) as HTMLElement | null;
      if (!card) {
        if (activeCard) {
          hide();
        }
        return;
      }
      if (card !== activeCard) {
        show(card, event.clientX, event.clientY);
        return;
      }
      // Kursor przesuwa się po tej samej karcie - podgląd podąża za nim.
      setState((current) => (current ? { ...current, ...computePosition(event.clientX, event.clientY) } : current));
    };
    const onLeaveWindow = (event: MouseEvent) => {
      if (!event.relatedTarget) {
        hide();
      }
    };
    const onScrollOrResize = () => {
      if (activeCard) {
        // Po przewinięciu karta pod kursorem może być inna - policz od nowa.
        const el = document.elementFromPoint(lastPointer.x, lastPointer.y) as HTMLElement | null;
        const card = el?.closest?.(CARD_SELECTOR) as HTMLElement | null;
        if (card) {
          show(card, lastPointer.x, lastPointer.y);
        } else {
          hide();
        }
      }
    };
    const onPointerDown = () => hide();

    document.addEventListener("mousemove", onMove, { passive: true });
    document.addEventListener("mouseout", onLeaveWindow);
    document.addEventListener("pointerdown", onPointerDown, true);
    window.addEventListener("scroll", onScrollOrResize, { passive: true, capture: true });
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseout", onLeaveWindow);
      document.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, []);

  if (!state || typeof document === "undefined") {
    return null;
  }

  return createPortal(
    <div
      className={`swatch-hover-preview ${state.above ? "is-above" : "is-below"}`}
      style={{ top: state.top, left: state.left, width: state.width }}
      role="presentation"
      aria-hidden="true"
    >
      <div className="swatch-hover-preview-image" style={{ height: state.height - 44 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={optimizeImageUrl(state.src, 750, 80)} alt="" draggable={false} />
      </div>
      {state.label ? <div className="swatch-hover-preview-label">{state.label}</div> : null}
    </div>,
    document.body,
  );
}
