"use client";

// "Ile za Twoje okno?" - the price for a REAL window (plisy landing
// analysis 2026-09-17), sitting under the first paragraph of the
// description.
//
// 80% of visitors left without ever touching the configurator, which sits
// at the very bottom of an 11-screen page, and "od 69,30 zł" anchored on
// the smallest 40 x 60 sash. This block answers the one question cold Meta
// traffic arrives with - "ile za MOJE okno?" - with two sliders in
// centimetres (the unit the ad speaks, and the one people think in),
// showing the SEZON20 price the cart will actually charge.
//
// Owner's second pass, same day: sliders instead of typed fields, quieter
// than the first orange-card version, and the size is OWNED by the page
// (widthMm/heightMm + onSizeChange) so the fabric-collection comparison
// further down prices every collection for the same window - and moving
// its own sliders moves these. "Konfiguruj to okno" still hands the size
// into the configurator so it's never typed twice.
//
// Pricing is the configurator's own calcPlisyPrice on the live CRM matrix,
// including the per-product percent correction (useProductPriceAdjustment)
// - the cheapest sensible build: Klasyczne, first hardware colour, STANDARD
// mount. Nothing hardcoded, so the number here can't drift from the number
// the configurator shows a screen later.
//
// variant="v2" (landing v2, 2026-10-11, wzorzec Blinds2go/Karnix): pola do
// wpisania zamiast suwaków (żaden z liderów nie używa suwaków; 93% ruchu to
// telefon), wybór montażu obok wymiarów (od niego zależy, jak mierzyć - i
// jego dopłata wchodzi do ceny), link do animacji pomiaru, przycisk
// "Wybierz tkaninę i kolor" i "zapisz wycenę na później" dla 2/3 wejść bez
// miarki pod ręką. Wersja v1 zostaje nietknięta (powrót jednym przełącznikiem).
import { useEffect, useMemo, useRef, useState } from "react";
import { applyPromoToPrice, PROMO_CODE, type PromoPreview } from "@/lib/promo";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { trackShopStep } from "@/lib/track-step";
import { PLISY_COLLECTIONS } from "./landing-content";
import UnitAskModal from "./UnitAskModal";
import {
  isPlisyMountNonInvasive,
  plisyMountLabel,
  plisyQuickPrice,
  PLISY_HEIGHT_MAX_MM,
  PLISY_HEIGHT_MIN_MM,
  PLISY_WIDTH_MAX_MM,
  PLISY_WIDTH_MIN_MM,
  type MountOption,
  type PlisyProfile,
} from "./shared";

function zl(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export default function PlisyQuickPrice({
  profile,
  promo,
  widthMm,
  heightMm,
  onSizeChange,
  onConfigure,
  collapsible = false,
  defaultOpen = false,
  variant = "v1",
  mountId = "",
  onMountChange,
  onMeasureGuide,
  onSaveLater,
}: {
  /** Akordeon: nagłówek "Szybka wycena" z rozmiarem i ceną, suwaki pod
   * spodem. Na landingu plis blok siedzi wysoko, zaraz pod plakietkami,
   * więc domyślnie jest zwinięty - cena i tak jest widoczna w nagłówku. */
  collapsible?: boolean;
  defaultOpen?: boolean;
  profile: PlisyProfile | null;
  /** The ACTIVE promo only - null while SEZON20 isn't switched on, so the
   * struck-through/discounted pair never promises a discount the cart
   * won't apply. */
  promo: PromoPreview | null;
  widthMm: number;
  heightMm: number;
  onSizeChange: (widthMm: number, heightMm: number) => void;
  /** v2 przekazuje też wybrany montaż (id z profilu), v1 - pusty string. */
  onConfigure: (widthMm: number, heightMm: number, mountId: string) => void;
  variant?: "v1" | "v2";
  /** v2: wybrany montaż (id opcji z profilu); pusty = pierwsza opcja. */
  mountId?: string;
  onMountChange?: (mountId: string) => void;
  onMeasureGuide?: () => void;
  onSaveLater?: () => void;
}) {
  const priceAdjustmentPercent = useProductPriceAdjustment("plisy");
  const isV2 = variant === "v2";

  // Slider bounds = the production limits (20-150 x 20-230 cm), the same
  // ones the collection comparison and the configurator enforce.
  const minW = (profile ? profile.widthMinMm : PLISY_WIDTH_MIN_MM) / 10;
  // Do dwóch szerokości plisy: szersze okno dzielimy na 2 plisy (właściciel,
  // 2026-10-01) - konfigurator robi to samo z tą samą łączną szerokością.
  const singleMaxW = (profile ? profile.widthMaxMm : PLISY_WIDTH_MAX_MM) / 10;
  const maxW = singleMaxW * 2;
  const minH = (profile ? profile.heightMinMm : PLISY_HEIGHT_MIN_MM) / 10;
  const maxH = (profile ? profile.heightMaxMm : PLISY_HEIGHT_MAX_MM) / 10;
  const widthCm = Math.round(widthMm / 10);
  const heightCm = Math.round(heightMm / 10);

  const inRange = profile
    ? widthMm >= profile.widthMinMm &&
      widthMm <= profile.widthMaxMm * 2 &&
      heightMm >= profile.heightMinMm &&
      heightMm <= profile.heightMaxMm
    : false;
  const split = profile ? widthMm > profile.widthMaxMm : false;
  const pieceWidthMm = split ? Math.floor(widthMm / 2) : widthMm;

  const mountOptions: MountOption[] = isV2 && profile ? profile.mountOptions : [];
  const selectedMount: MountOption | null = isV2
    ? mountOptions.find((option) => option.id === mountId) || mountOptions[0] || null
    : null;

  const regular = useMemo(() => {
    if (!profile || !inRange) return null;
    const groupId = PLISY_COLLECTIONS[0]?.groupId || profile.fabricGroups[0]?.id || "";
    return plisyQuickPrice(profile, widthMm, heightMm, priceAdjustmentPercent, selectedMount, groupId);
  }, [profile, inRange, widthMm, heightMm, priceAdjustmentPercent, selectedMount]);
  const withPromo = regular !== null ? applyPromoToPrice(regular, promo) : null;

  // Pola liczbowe obok suwaków (właściciel, 2026-09-24): kto zna wymiar,
  // wpisuje go od razu zamiast celować suwakiem. Tekst trzymany lokalnie,
  // żeby dało się skasować pole i wpisać liczbę od nowa; do strony idzie
  // dopiero wartość mieszcząca się w zakresie produkcji.
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
  // Pomyłka jednostek (właściciel, 2026-10-15: "wyczuć, że klient wpisuje
  // milimetry zamiast centymetrów i odwrotnie, i zapytać"). Pola są w cm;
  // liczba spoza zakresu, która po przeliczeniu z mm (÷10) albo z metrów
  // (×100) mieści się w produkcji, to prawie na pewno inna jednostka -
  // pytamy, zamiast po cichu ucinać do maksimum (tak było do dziś: 1200
  // stawało się 300 cm bez słowa).
  type UnitGuess = { axis: "w" | "h"; raw: number; cm: number; unit: "mm" | "m" | "x10" };
  const [unitGuess, setUnitGuess] = useState<UnitGuess[]>([]);
  const dismissedGuessRef = useRef<Set<string>>(new Set());
  function guessUnit(raw: string, axis: "w" | "h"): UnitGuess | null {
    const value = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return null;
    const min = axis === "w" ? minW : minH;
    const max = axis === "w" ? maxW : maxH;
    if (value >= min && value <= max) return null;
    const fits = (cm: number) => cm >= min && cm <= max;
    let guess: UnitGuess | null = null;
    if (value > max && fits(value / 10)) guess = { axis, raw: value, cm: Math.round(value / 10), unit: "mm" };
    else if (value < min && value < 10 && fits(value * 100)) guess = { axis, raw: value, cm: Math.round(value * 100), unit: "m" };
    else if (value < min && fits(value * 10)) guess = { axis, raw: value, cm: Math.round(value * 10), unit: "x10" };
    if (guess && dismissedGuessRef.current.has(`${axis}:${value}`)) return null;
    return guess;
  }
  function refreshGuess(axis: "w" | "h", raw: string) {
    const g = guessUnit(raw, axis);
    setUnitGuess((list) => {
      const rest = list.filter((x) => x.axis !== axis);
      return g ? [...rest, g].sort((a) => (a.axis === "w" ? -1 : 1)) : rest;
    });
    return g;
  }
  function acceptGuess() {
    let w = widthMm;
    let h = heightMm;
    for (const g of unitGuess) {
      if (g.axis === "w") { w = g.cm * 10; setWidthText(String(g.cm)); }
      else { h = g.cm * 10; setHeightText(String(g.cm)); }
    }
    trackShopStep("dimensions_unit_fix", "plisy", { place: "quick_price", accepted: true, kinds: unitGuess.map((g) => g.unit).join(","), to_w: w, to_h: h });
    setUnitGuess([]);
    onSizeChange(w, h);
  }
  function rejectGuess() {
    for (const g of unitGuess) dismissedGuessRef.current.add(`${g.axis}:${g.raw}`);
    trackShopStep("dimensions_unit_fix", "plisy", { place: "quick_price", accepted: false, kinds: unitGuess.map((g) => g.unit).join(",") });
    const pending = unitGuess;
    setUnitGuess([]);
    // "Nie, to centymetry" - wtedy zwykła ścieżka: dociągamy do zakresu.
    for (const g of pending) commitSize(g.axis, String(g.raw), true);
  }
  function typeSize(raw: string, axis: "w" | "h") {
    if (axis === "w") setWidthText(raw);
    else setHeightText(raw);
    // Pytanie o jednostkę dopiero po wyjściu z pola (commitSize) - w trakcie
    // pisania "1200" przechodzi przez "1" i "12", które też są poza zakresem.
    setUnitGuess((list) => list.filter((x) => x.axis !== axis));
    const value = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    const min = axis === "w" ? minW : minH;
    const max = axis === "w" ? maxW : maxH;
    if (value < min || value > max) return;
    const mm = Math.round(value) * 10;
    if (axis === "w") onSizeChange(mm, heightMm);
    else onSizeChange(widthMm, mm);
  }
  function commitSize(axis: "w" | "h", rawOverride?: string, force = false) {
    const raw = rawOverride ?? (axis === "w" ? widthText : heightText);
    // Czekamy na odpowiedź "mm czy cm?" - nie ucinamy liczby pod spodem.
    if (!force && guessUnit(raw, axis)) {
      refreshGuess(axis, raw);
      return;
    }
    const value = Number(String(raw).replace(",", "."));
    const min = axis === "w" ? minW : minH;
    const max = axis === "w" ? maxW : maxH;
    if (!Number.isFinite(value) || value <= 0) {
      if (axis === "w") setWidthText(String(widthCm));
      else setHeightText(String(heightCm));
      return;
    }
    const next = Math.round(clamp(value, min, max));
    if (axis === "w") {
      setWidthText(String(next));
      onSizeChange(next * 10, heightMm);
    } else {
      setHeightText(String(next));
      onSizeChange(widthMm, next * 10);
    }
  }

  // One analytics event per settled size (sliders fire on every pixel).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    const timer = window.setTimeout(() => {
      trackShopStep("quick_price_size", "plisy", { width_mm: widthMm, height_mm: heightMm, in_range: inRange, price: regular ?? 0 });
    }, 700);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [widthMm, heightMm]);

  const [open, setOpen] = useState(!collapsible || defaultOpen);
  const headPrice =
    regular === null ? null : withPromo !== null && withPromo < regular ? withPromo : regular;

  const configure = () => {
    trackShopStep("quick_price_configure", "plisy", { width_mm: widthMm, height_mm: heightMm, price: regular ?? 0, mount: selectedMount?.id || "" });
    onConfigure(widthMm, heightMm, selectedMount?.id || "");
  };

  const numberField = (axis: "w" | "h") => (
    <input
      type="text" data-dim-input="" autoComplete="off"
      inputMode="numeric"
      min={axis === "w" ? minW : minH}
      max={axis === "w" ? maxW : maxH}
      step={1}
      value={axis === "w" ? widthText : heightText}
      onChange={(event) => typeSize(event.target.value, axis)}
      onBlur={() => commitSize(axis)}
      aria-label={axis === "w" ? "Szerokość okna w centymetrach - wpisz" : "Wysokość okna w centymetrach - wpisz"}
    />
  );

  const unitGuessNotice = unitGuess.length ? (() => {
    const unit = unitGuess[0].unit;
    const axisLabel = (g: UnitGuess) => (g.axis === "w" ? "szerokość" : "wysokość");
    const fmt = (n: number) => String(n).replace(".", ",");
    const question =
      unit === "mm"
        ? "Wpisujesz w milimetrach?"
        : unit === "m"
          ? "Wpisujesz w metrach?"
          : "Czy chodziło o taki wymiar?";
    const detail = unitGuess
      .map((g) =>
        g.unit === "mm"
          ? `${axisLabel(g)} ${fmt(g.raw)} mm = ${g.cm} cm`
          : g.unit === "m"
            ? `${axisLabel(g)} ${fmt(g.raw)} m = ${g.cm} cm`
            : `${axisLabel(g)} ${g.cm} cm zamiast ${fmt(g.raw)} cm`,
      )
      .join(", ");
    return (
      <UnitAskModal
        title={question}
        detail={`Wymiary wpisujemy w centymetrach: ${detail}.`}
        yesLabel={unit === "x10" ? "Tak, popraw" : "Tak, przelicz na cm"}
        onYes={acceptGuess}
        onNo={rejectGuess}
      />
    );
  })() : null;

  if (isV2) {
    return (
      <div className="pl-quick pl-quick--v2" role="group" aria-label="Wyceń swoje okno">
        <div className="pl-quick-head">
          <span className="pl-quick-title">Wyceń swoje okno</span>
          <span className="pl-quick-size">wpisz wymiary w cm</span>
        </div>
        <div className="pl-quick-fields">
          <label className="pl-quick-field">
            <span>Szerokość</span>
            <span className="pl-quick-num">
              {numberField("w")}
              <em>cm</em>
            </span>
          </label>
          <label className="pl-quick-field">
            <span>Wysokość</span>
            <span className="pl-quick-num">
              {numberField("h")}
              <em>cm</em>
            </span>
          </label>
        </div>
        {unitGuessNotice}
        {mountOptions.length ? (
          <div className="pl-quick-mounts" role="radiogroup" aria-label="Sposób montażu">
            {mountOptions.map((option) => {
              const isActive = selectedMount?.id === option.id;
              const nonInvasive = isPlisyMountNonInvasive(option.id) || isPlisyMountNonInvasive(option.label);
              return (
                <button
                  key={option.id}
                  type="button"
                  role="radio"
                  aria-checked={isActive ? "true" : "false"}
                  className={`pl-quick-mount ${isActive ? "is-active" : ""}`}
                  onClick={() => {
                    if (isActive) return;
                    trackShopStep("quick_price_mount", "plisy", { option_id: option.id });
                    onMountChange?.(option.id);
                  }}
                >
                  {option.imageUrl ? <img src={option.imageUrl} alt="" loading="lazy" decoding="async" /> : null}
                  <strong>{plisyMountLabel(option)}</strong>
                  <small>{nonInvasive ? "uchwyty na skrzydło, bez śladów" : "wkręty do listwy, najpewniejszy"}</small>
                </button>
              );
            })}
          </div>
        ) : null}
        {onMeasureGuide ? (
          <button type="button" className="pl-quick-measure" onClick={onMeasureGuide}>
            <span aria-hidden="true">📐</span> Jak zmierzyć okno? Animacja, 2 minuty
          </button>
        ) : null}
        <div className="pl-quick-priceline" aria-live="polite">
          <span className="pl-quick-priceline-label">
            {widthCm} × {heightCm} cm · Klasyczne
            {selectedMount ? ` · ${isPlisyMountNonInvasive(selectedMount.id) || isPlisyMountNonInvasive(selectedMount.label) ? "bezinwazyjny" : "przykręcany"}` : ""}
          </span>
          {regular === null ? (
            <span className="pl-quick-na">{profile ? "Ten wymiar wyceni konfigurator" : "Ładuję cennik…"}</span>
          ) : withPromo !== null && withPromo < regular ? (
            <span className="pl-quick-amounts">
              <strong>{zl(withPromo)}</strong>
              <s>{zl(regular)}</s>
              <small>z kodem {PROMO_CODE}</small>
            </span>
          ) : (
            <span className="pl-quick-amounts">
              <strong>{zl(regular)}</strong>
            </span>
          )}
        </div>
        {split ? (
          <span className="pl-quick-split">Okno {widthCm} cm zrobimy z 2 plis po {pieceWidthMm / 10} cm — cena za obie.</span>
        ) : null}
        <button type="button" className="pl-quick-cta pl-quick-cta--v2" disabled={!inRange} onClick={configure}>
          Wybierz tkaninę i kolor →
        </button>
        <span className="pl-quick-note">W cenie 5 lat gwarancji i 30 dni na zwrot. 150 tkanin i 10 kolorów listew wybierzesz w następnym kroku.</span>
        {onSaveLater ? (
          <button
            type="button"
            className="pl-quick-later"
            onClick={() => {
              trackShopStep("quick_price_save_later", "plisy", { width_mm: widthMm, height_mm: heightMm });
              onSaveLater();
            }}
          >
            Nie masz miarki pod ręką? Zapisz wycenę na później
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`pl-quick ${collapsible ? "pl-quick--acc" : ""} ${open ? "is-open" : ""}`} role="group" aria-label="Szybka wycena plisy dla Twojego okna">
      {collapsible ? (
        <button
          type="button"
          className="pl-quick-acc-head"
          aria-expanded={open ? "true" : "false"}
          onClick={() => {
            setOpen((prev) => !prev);
            trackShopStep("quick_price_toggle", "plisy", { open: !open });
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
      ) : (
        <div className="pl-quick-head">
          <span className="pl-quick-title">Ile za Twoje okno?</span>
          <span className="pl-quick-size">
            {widthCm} × {heightCm} cm
          </span>
        </div>
      )}
      <div className="pl-quick-body" hidden={collapsible && !open}>
      <div className="pl-quick-slider">
        <span className="pl-quick-slider-label">Szerokość</span>
        <div className="pl-quick-slider-row">
          <input
            type="range"
            min={minW}
            max={maxW}
            step={1}
            value={clamp(widthCm, minW, maxW)}
            onChange={(event) => onSizeChange(Number(event.target.value) * 10, heightMm)}
            aria-label="Szerokość okna w centymetrach"
          />
          <span className="pl-quick-num">
            {numberField("w")}
            <em>cm</em>
          </span>
        </div>
      </div>
      <div className="pl-quick-slider">
        <span className="pl-quick-slider-label">Wysokość</span>
        <div className="pl-quick-slider-row">
          <input
            type="range"
            min={minH}
            max={maxH}
            step={1}
            value={clamp(heightCm, minH, maxH)}
            onChange={(event) => onSizeChange(widthMm, Number(event.target.value) * 10)}
            aria-label="Wysokość okna w centymetrach"
          />
          <span className="pl-quick-num">
            {numberField("h")}
            <em>cm</em>
          </span>
        </div>
      </div>
      {unitGuessNotice}
      <div className="pl-quick-row">
        <div className="pl-quick-result" aria-live="polite">
          {regular === null ? (
            <span className="pl-quick-na">{profile ? "Ten wymiar wyceni konfigurator" : "Ładuję cennik…"}</span>
          ) : withPromo !== null ? (
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
          {split ? (
            <span className="pl-quick-split">Okno {widthCm} cm zrobimy z 2 plis po {pieceWidthMm / 10} cm — cena za obie.</span>
          ) : null}
          <span className="pl-quick-note">
            Kolekcja Klasyczne, biały profil, montaż przykręcany do listwy · w cenie 5 lat gwarancji i 30 dni na zwrot
          </span>
        </div>
        <button type="button" className="pl-quick-cta" disabled={!inRange} onClick={configure}>
          Przejdź do konfiguratora →
        </button>
        </div>
      </div>
    </div>
  );
}
