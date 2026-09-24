"use client";

// "Szybka wycena" na landingu moskitier (właściciel, 2026-09-24) - bliźniak
// bloku z plis (features/plisy/QuickPrice.tsx), tylko prostszy: u moskitier
// cenę definiują WYŁĄCZNIE wymiary, więc wystarczą dwa suwaki.
//
// Liczy dokładnie tym samym kodem co konfigurator (moskPerimeterMeters ->
// moskBilledMeters -> stawka za metr bieżący z korektą produktu), żeby
// kwota tutaj nie mogła się rozejść z kwotą o ekran niżej. Dolicza też
// jednorazową dopłatę dłużycową, bo inaczej przy dużym oknie pokazywalibyśmy
// mniej, niż policzy koszyk.
import { useEffect, useRef, useState } from "react";
import { applyPromoToPrice, PROMO_CODE, type PromoPreview } from "@/lib/promo";
import { trackShopStep } from "@/lib/track-step";
import {
  MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM,
  OVERSIZE_MAX_WIDTH_MM,
  OVERSIZE_SURCHARGE_TIER_2_MAX_MM,
  OVERSIZE_TECHNICAL_LIMIT_MM,
  moskBilledMeters,
  moskOversizeSurchargeForDimension,
  moskPerimeterMeters,
} from "./shared";

function zl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function MoskitieryQuickPrice({
  pricePerMb,
  promo,
  widthMm,
  heightMm,
  onSizeChange,
  onConfigure,
}: {
  /** Stawka za metr bieżący PO korekcie produktu (tak jak na landingu). */
  pricePerMb: number;
  /** Aktywny SEZON20 albo null - wtedy nie obiecujemy rabatu. */
  promo: PromoPreview | null;
  widthMm: number;
  heightMm: number;
  onSizeChange: (widthMm: number, heightMm: number) => void;
  onConfigure: (widthMm: number, heightMm: number) => void;
}) {
  const minCm = Math.ceil(MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM / 10);
  const maxCm = Math.floor(Math.min(OVERSIZE_MAX_WIDTH_MM, OVERSIZE_SURCHARGE_TIER_2_MAX_MM) / 10);
  const widthCm = Math.round(widthMm / 10);
  const heightCm = Math.round(heightMm / 10);

  const [widthText, setWidthText] = useState(String(widthCm));
  const [heightText, setHeightText] = useState(String(heightCm));
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidthText(String(widthCm));
  }, [widthCm]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeightText(String(heightCm));
  }, [heightCm]);

  function typeSize(raw: string, axis: "w" | "h") {
    if (axis === "w") setWidthText(raw);
    else setHeightText(raw);
    const value = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(value) || value < minCm || value > maxCm) return;
    const mm = Math.round(value) * 10;
    if (axis === "w") onSizeChange(mm, heightMm);
    else onSizeChange(widthMm, mm);
  }
  function commitSize(axis: "w" | "h") {
    const raw = axis === "w" ? widthText : heightText;
    const value = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      if (axis === "w") setWidthText(String(widthCm));
      else setHeightText(String(heightCm));
      return;
    }
    const next = Math.round(clamp(value, minCm, maxCm));
    if (axis === "w") {
      setWidthText(String(next));
      onSizeChange(next * 10, heightMm);
    } else {
      setHeightText(String(next));
      onSizeChange(widthMm, next * 10);
    }
  }

  // Gdy jeden bok już przekracza 160 cm, drugi suwak kończy się na 160 -
  // dzięki temu klient nie ustawi ręcznie rozmiaru, którego nie umiemy
  // zrobić (a nie zabieramy mu możliwości zrobienia jednego długiego boku).
  const widthMaxCm = heightMm > OVERSIZE_TECHNICAL_LIMIT_MM ? Math.floor(OVERSIZE_TECHNICAL_LIMIT_MM / 10) : maxCm;
  const heightMaxCm = widthMm > OVERSIZE_TECHNICAL_LIMIT_MM ? Math.floor(OVERSIZE_TECHNICAL_LIMIT_MM / 10) : maxCm;

  const perimeter = moskPerimeterMeters(widthMm, heightMm);
  const billed = moskBilledMeters(perimeter);
  const base = Math.round(billed * pricePerMb * 100) / 100;
  const surcharge = moskOversizeSurchargeForDimension(Math.max(widthMm, heightMm));
  // Twardy limit produkcji: jeden bok może przekroczyć 160 cm, ale nie oba
  // naraz - takiej ramki po prostu nie zrobimy (ten sam warunek co w
  // konfiguratorze: bothDimensionsOverTechnicalLimit).
  const bothOverTechnicalLimit = widthMm > OVERSIZE_TECHNICAL_LIMIT_MM && heightMm > OVERSIZE_TECHNICAL_LIMIT_MM;
  const inRange =
    widthMm >= MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM &&
    heightMm >= MOSKITIERY_RAMKOWE_MIN_DIMENSION_MM &&
    surcharge >= 0 &&
    !bothOverTechnicalLimit;
  const regular = inRange ? base : null;
  const withPromo = regular !== null ? applyPromoToPrice(regular, promo) : null;
  const headPrice = regular === null ? null : withPromo !== null && withPromo < regular ? withPromo : regular;

  // Jedno zdarzenie na ustalony rozmiar (suwak strzela przy każdym pikselu).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      trackShopStep("quick_price_size", "moskitiery-ramkowe", {
        width_mm: widthMm,
        height_mm: heightMm,
        in_range: inRange,
        price: regular ?? 0,
      });
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthMm, heightMm]);

  const [open, setOpen] = useState(false);

  return (
    <div className={`pl-quick pl-quick--acc ${open ? "is-open" : ""}`} role="group" aria-label="Szybka wycena moskitiery">
      <button
        type="button"
        className="pl-quick-acc-head"
        aria-expanded={open ? "true" : "false"}
        onClick={() => {
          setOpen((prev) => !prev);
          trackShopStep("quick_price_toggle", "moskitiery-ramkowe", { open: !open });
        }}
      >
        <span className="pl-quick-acc-title">
          <span aria-hidden="true">🧮</span> Szybka wycena
        </span>
        <span className="pl-quick-acc-meta">
          <span className="pl-quick-acc-size">
            {widthCm} × {heightCm} cm
          </span>
          {headPrice !== null ? <strong>{zl(headPrice)}</strong> : null}
          <span className="pl-quick-acc-chevron" aria-hidden="true">
            {open ? "▴" : "▾"}
          </span>
        </span>
      </button>
      <div className="pl-quick-body" hidden={!open}>
        <div className="pl-quick-slider">
          <span className="pl-quick-slider-label">Szerokość</span>
          <div className="pl-quick-slider-row">
            <input
              type="range"
              min={minCm}
              max={widthMaxCm}
              step={1}
              value={clamp(widthCm, minCm, widthMaxCm)}
              onChange={(event) => onSizeChange(Number(event.target.value) * 10, heightMm)}
              aria-label="Szerokość moskitiery w centymetrach"
            />
            <span className="pl-quick-num">
              <input
                type="number"
                inputMode="numeric"
                min={minCm}
                max={maxCm}
                step={1}
                value={widthText}
                onChange={(event) => typeSize(event.target.value, "w")}
                onBlur={() => commitSize("w")}
                aria-label="Szerokość w centymetrach - wpisz"
              />
              <em>cm</em>
            </span>
          </div>
        </div>
        <div className="pl-quick-slider">
          <span className="pl-quick-slider-label">Wysokość</span>
          <div className="pl-quick-slider-row">
            <input
              type="range"
              min={minCm}
              max={heightMaxCm}
              step={1}
              value={clamp(heightCm, minCm, heightMaxCm)}
              onChange={(event) => onSizeChange(widthMm, Number(event.target.value) * 10)}
              aria-label="Wysokość moskitiery w centymetrach"
            />
            <span className="pl-quick-num">
              <input
                type="number"
                inputMode="numeric"
                min={minCm}
                max={maxCm}
                step={1}
                value={heightText}
                onChange={(event) => typeSize(event.target.value, "h")}
                onBlur={() => commitSize("h")}
                aria-label="Wysokość w centymetrach - wpisz"
              />
              <em>cm</em>
            </span>
          </div>
        </div>

        <div className="pl-quick-row">
          <div className="pl-quick-result" aria-live="polite">
            {bothOverTechnicalLimit ? (
              <span className="pl-quick-na pl-quick-na--limit">
                Szerokość i wysokość nie mogą jednocześnie przekraczać 160 cm — zmniejsz jeden z wymiarów.
              </span>
            ) : regular === null ? (
              <span className="pl-quick-na">Ten wymiar wyceni konfigurator</span>
            ) : withPromo !== null && withPromo < regular ? (
              <span className="pl-quick-amounts">
                <s>{zl(regular)}</s>
                <strong>{zl(withPromo)}</strong>
                <small>z kodem {PROMO_CODE}</small>
              </span>
            ) : (
              <span className="pl-quick-amounts">
                <strong>{zl(regular)}</strong>
              </span>
            )}
            {bothOverTechnicalLimit ? null : (
              <span className="pl-quick-note">
                Obwód {perimeter.toLocaleString("pl-PL", { maximumFractionDigits: 2 })} m — płacisz za {billed} mb ×{" "}
                {zl(pricePerMb)}
                {surcharge > 0 ? ` · dopłata dłużycowa ${zl(surcharge)} (raz na zamówienie)` : ""}
              </span>
            )}
          </div>
          <button
            type="button"
            className="pl-quick-cta"
            disabled={!inRange}
            onClick={() => {
              trackShopStep("quick_price_configure", "moskitiery-ramkowe", {
                width_mm: widthMm,
                height_mm: heightMm,
                price: regular ?? 0,
              });
              onConfigure(widthMm, heightMm);
            }}
          >
            Przejdź do konfiguratora →
          </button>
        </div>
      </div>
    </div>
  );
}
