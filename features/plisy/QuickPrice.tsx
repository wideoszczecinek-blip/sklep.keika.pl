"use client";
import { NumericDone, numericEntryKey } from "@/app/components/numeric-entry";

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
import { useBundleDiscountRules } from "@/lib/bundle-discount";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { trackShopStep } from "@/lib/track-step";
import { PLISY_COLLECTIONS } from "./landing-content";
import UnitAskModal from "./UnitAskModal";
import {
  isPlisyMountNonInvasive,
  plisyMountNazwa,
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
  onMountFilm,
  onSaveLater,
  onWpisane,
  groupId = "",
  onGroupChange,
}: {
  /** v2 (właściciel 3.11: „konieczne jest wybranie przez klienta materiału ZANIM zobaczy cenę … cena na końcu”):
   * po wymiarach klient wybiera kolekcję tkaniny, dopiero potem widzi cenę - dla tej kolekcji. */
  groupId?: string;
  onGroupChange?: (groupId: string) => void;
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
  /** Film montażu (animacja 3D) - tylko przy montażu przykręcanym, bo pokazuje wkręty w listwę. */
  onMountFilm?: () => void;
  onSaveLater?: () => void;
  /** v2 (pierwszy ekran, 3.11): klient wpisał oba wymiary - pasek na dole pokazuje wtedy cenę jego okna. */
  onWpisane?: () => void;
}) {
  const priceAdjustmentPercent = useProductPriceAdjustment("plisy");
  const bundleRule = useBundleDiscountRules().plisy;
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
  // Wymiar co do milimetra (właściciel 28.10.2026, zam. 373/10: klient wpisał 935 mm, a do koszyka
  // poszło 940 - pola w cm przyjmowały tylko całe centymetry). Centymetry mogą mieć jedno miejsce po
  // przecinku (93,5 cm = 935 mm); nigdzie nie zaokrąglamy do pełnych cm.
  const widthCm = widthMm / 10;
  const heightCm = heightMm / 10;
  const cmText = (cm: number) => String(Math.round(cm * 10) / 10).replace(".", ",");

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

  // najpierw materiał, potem cena (3.11) - tylko w v2 z wyborem kolekcji
  const wyborTkaniny = isV2 && Boolean(onGroupChange);
  const kolekcja = PLISY_COLLECTIONS.find((c) => c.groupId === groupId) || null;
  const regular = useMemo(() => {
    if (!profile || !inRange) return null;
    const gid = (wyborTkaniny ? groupId : "") || PLISY_COLLECTIONS[0]?.groupId || profile.fabricGroups[0]?.id || "";
    return plisyQuickPrice(profile, widthMm, heightMm, priceAdjustmentPercent, selectedMount, gid);
  }, [profile, inRange, widthMm, heightMm, priceAdjustmentPercent, selectedMount, wyborTkaniny, groupId]);
  const withPromo = regular !== null ? applyPromoToPrice(regular, promo) : null;

  // Pola liczbowe obok suwaków (właściciel, 2026-09-24): kto zna wymiar,
  // wpisuje go od razu zamiast celować suwakiem. Tekst trzymany lokalnie,
  // żeby dało się skasować pole i wpisać liczbę od nowa; do strony idzie
  // dopiero wartość mieszcząca się w zakresie produkcji.
  // v2 (pierwszy ekran, 3.11): pola puste z podpowiedzią, cena dopiero po wpisaniu obu wymiarów albo „Oblicz cenę”.
  const [pokaz, setPokaz] = useState(!isV2);
  const ruszoneRef = useRef(!isV2);
  const poleWRef = useRef<HTMLInputElement | null>(null);
  const poleHRef = useRef<HTMLInputElement | null>(null);
  const [widthText, setWidthText] = useState(isV2 ? "" : cmText(widthCm));
  const [heightText, setHeightText] = useState(isV2 ? "" : cmText(heightCm));
  useEffect(() => {
    if (!ruszoneRef.current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setWidthText((current) => (Number(current.replace(",", ".")) === widthCm ? current : cmText(widthCm)));
  }, [widthCm]);
  useEffect(() => {
    if (!ruszoneRef.current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHeightText((current) => (Number(current.replace(",", ".")) === heightCm ? current : cmText(heightCm)));
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
    if (value > max && fits(value / 10)) guess = { axis, raw: value, cm: Math.round(value) / 10, unit: "mm" };
    else if (value < min && value < 10 && fits(value * 100)) guess = { axis, raw: value, cm: Math.round(value * 1000) / 10, unit: "m" };
    else if (value < min && fits(value * 10)) guess = { axis, raw: value, cm: Math.round(value * 100) / 10, unit: "x10" };
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
      if (g.axis === "w") { w = Math.round(g.cm * 10); setWidthText(cmText(g.cm)); }
      else { h = Math.round(g.cm * 10); setHeightText(cmText(g.cm)); }
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
  const wZakresie = (raw: string, axis: "w" | "h") => {
    const v = Number(String(raw).replace(",", "."));
    return Number.isFinite(v) && v >= (axis === "w" ? minW : minH) && v <= (axis === "w" ? maxW : maxH);
  };
  function pokazCene(zrodlo: string) {
    if (pokaz) return;
    setPokaz(true);
    trackShopStep("quick_price_shown", "plisy", { zrodlo });
    onWpisane?.();
  }
  function typeSize(raw: string, axis: "w" | "h") {
    ruszoneRef.current = true;
    if (axis === "w") setWidthText(raw);
    else setHeightText(raw);
    if (isV2 && wZakresie(raw, axis) && wZakresie(axis === "w" ? heightText : widthText, axis === "w" ? "h" : "w")) pokazCene("wpisanie");
    // Pytanie o jednostkę dopiero po wyjściu z pola (commitSize) - w trakcie
    // pisania "1200" przechodzi przez "1" i "12", które też są poza zakresem.
    setUnitGuess((list) => list.filter((x) => x.axis !== axis));
    const value = Number(String(raw).replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) return;
    const min = axis === "w" ? minW : minH;
    const max = axis === "w" ? maxW : maxH;
    if (value < min || value > max) return;
    const mm = Math.round(value * 10);
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
      if (axis === "w") setWidthText(cmText(widthCm));
      else setHeightText(cmText(heightCm));
      return;
    }
    const nextMm = Math.round(clamp(value, min, max) * 10);
    if (axis === "w") {
      setWidthText(cmText(nextMm / 10));
      onSizeChange(nextMm, heightMm);
    } else {
      setHeightText(cmText(nextMm / 10));
      onSizeChange(widthMm, nextMm);
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

  const oblicz = () => {
    if (!wZakresie(widthText, "w")) {
      poleWRef.current?.focus();
      return;
    }
    if (!wZakresie(heightText, "h")) {
      poleHRef.current?.focus();
      return;
    }
    commitSize("w");
    commitSize("h");
    pokazCene("przycisk");
  };

  const numberField = (axis: "w" | "h") => (
    <input
      ref={axis === "w" ? poleWRef : poleHRef}
      placeholder={isV2 ? (axis === "w" ? "np. 60" : "np. 140") : undefined}
      enterKeyHint={axis === "w" ? "next" : "done"}
      onKeyDown={(event) => {
        if (event.key !== "Enter" || event.nativeEvent.isComposing) return;
        numericEntryKey(event);
        if (isV2 && axis === "h") oblicz();
      }}
      data-numeric-field=""
      type="text" data-dim-input="" autoComplete="off"
      inputMode="decimal"
      min={axis === "w" ? minW : minH}
      max={axis === "w" ? maxW : maxH}
      step={0.1}
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
          ? `${axisLabel(g)} ${fmt(g.raw)} mm = ${fmt(g.cm)} cm`
          : g.unit === "m"
            ? `${axisLabel(g)} ${fmt(g.raw)} m = ${fmt(g.cm)} cm`
            : `${axisLabel(g)} ${fmt(g.cm)} cm zamiast ${fmt(g.raw)} cm`,
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
      <div className={`pl-quick pl-quick--v2 ${pokaz ? "is-cena" : ""}`} role="group" aria-label="Sprawdź cenę swojej plisy">
        <div className="pl-quick-head">
          <span className="pl-quick-title">Sprawdź cenę swojej plisy</span>
          <span className="pl-quick-size">wymiary okna w cm</span>
        </div>
        <div className="pl-quick-fields" data-numeric-entry="">
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
          <NumericDone />
        </div>
        {unitGuessNotice}
        {!pokaz ? (
          <>
            <button type="button" className="pl-quick-cta pl-quick-cta--v2" onClick={oblicz}>
              Oblicz cenę mojej plisy
            </button>
            <span className="pl-quick-note pl-quick-bez">Bez rejestracji i bez zobowiązań</span>
            {onMeasureGuide ? (
              <button type="button" className="pl-quick-measure" onClick={onMeasureGuide}>
                <span aria-hidden="true">📐</span> Jak zmierzyć okno? Animacja, 2 minuty
              </button>
            ) : null}
          </>
        ) : (
          <>
        {wyborTkaniny ? (
          <div className="pl-quick-comparison">
            <div className="pl-quick-comparison-head"><strong>Porównaj tkaniny</strong><span>Orientacyjnie · {cmText(widthCm)} × {cmText(heightCm)} cm</span></div>
            <div className="pl-quick-comparison-list" role="radiogroup" aria-label="Wybierz rodzaj tkaniny">
              {PLISY_COLLECTIONS.map((c) => {
                const amount = profile && inRange ? plisyQuickPrice(profile, widthMm, heightMm, priceAdjustmentPercent, selectedMount, c.groupId) : null;
                const tier = bundleRule?.wholeOrder ? bundleRule.tiers[bundleRule.tiers.length - 1] : null;
                const names: Record<string, string> = { clasic: "Dekoracyjna", reflex: "Dekoracyjna Reflex", blackout: "Blackout", duo: "DUO plaster miodu", "duo-blackout": "DUO Termo" };
                return <div className="pl-quick-comparison-row" key={c.groupId}>
                  <button type="button" role="radio" aria-checked={groupId === c.groupId} className={`pl-quick-comparison-choice ${groupId === c.groupId ? "is-active" : ""}`} onClick={() => {
                    trackShopStep("quick_price_tkanina", "plisy", { group: c.groupId, width_mm: widthMm, height_mm: heightMm });
                    onGroupChange?.(c.groupId); onWpisane?.();
                  }}>
                    <span className="pl-quick-comparison-name">{names[c.groupId] || c.name}</span>
                    <span className="pl-quick-comparison-price">{amount === null ? "Wycena w konfiguratorze" : <>{tier ? <><strong>{zl(Math.round(amount * (100 - tier.percent)) / 100)}</strong><small>przy {tier.fromQty}+ szt.</small><s>{zl(amount)}</s></> : <strong>{zl(amount)}</strong>}</>}</span>
                  </button>
                  <details className="pl-quick-comparison-info"><summary aria-label={`Informacje: ${names[c.groupId] || c.name}`}>i</summary><p>{c.what}</p></details>
                </div>;
              })}
            </div>
            {bundleRule?.wholeOrder && bundleRule.tiers.length ? <p className="pl-quick-comparison-note">Cena promocyjna przy {bundleRule.tiers[bundleRule.tiers.length - 1].fromQty} lub więcej produktach objętych promocją CAŁY DOM. Cena przekreślona dotyczy zakupu bez rabatu. Ostateczna cena zależy od konfiguracji i zawartości koszyka.</p> : <p className="pl-quick-comparison-note">Cena orientacyjna dla montażu przykręcanego. Ostateczna cena zależy od konfiguracji.</p>}
            {split ? <p className="pl-quick-comparison-note">Szerokie okno wyceniamy jako dwie plisy — podana cena obejmuje obie.</p> : null}
            <button type="button" className="pl-quick-cta pl-quick-cta--v2" disabled={!inRange} onClick={configure}>Wybierz szczegóły i skonfiguruj →</button>
            {onMeasureGuide ? <button type="button" className="pl-quick-measure" onClick={onMeasureGuide}>Jak zmierzyć okno? →</button> : null}
          </div>
        ) : (
          <>
        <div className="pl-quick-priceline" aria-live="polite">
          <span className="pl-quick-priceline-label">
            Twoja plisa {cmText(widthCm)} × {cmText(heightCm)} cm · {kolekcja ? kolekcja.name : "Klasyczne"}
            {selectedMount ? ` · ${isPlisyMountNonInvasive(selectedMount.id) || isPlisyMountNonInvasive(selectedMount.label) ? "bez wiercenia" : "przykręcana"}` : ""}
          </span>
          {regular === null ? (
            <span className="pl-quick-na">{profile ? "Ten wymiar wyceni konfigurator" : "Liczymy cenę…"}</span>
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
                  <strong>{plisyMountNazwa(option)}</strong>
                  <small>{nonInvasive ? "uchwyty na skrzydło, bez śladów" : "wkręty do listwy, najpewniejszy"}</small>
                </button>
              );
            })}
          </div>
        ) : null}
        {onMountFilm && selectedMount && !(isPlisyMountNonInvasive(selectedMount.id) || isPlisyMountNonInvasive(selectedMount.label)) ? (
          <button type="button" className="pl-quick-measure" onClick={onMountFilm}>
            <span aria-hidden="true">▶</span> Zobacz montaż (film, 15 s)
          </button>
        ) : null}
        {split ? (
          <span className="pl-quick-split">Okno {cmText(widthCm)} cm zrobimy z 2 plis po {cmText(pieceWidthMm / 10)} cm — cena za obie.</span>
        ) : null}
        <button type="button" className="pl-quick-cta pl-quick-cta--v2" disabled={!inRange} onClick={configure}>
          {kolekcja ? "Wybierz kolor tkaniny →" : "Wybierz tkaninę i kolor →"}
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
        {onMeasureGuide ? (
          <button type="button" className="pl-quick-measure" onClick={onMeasureGuide}>
            <span aria-hidden="true">📐</span> Jak zmierzyć okno? Animacja, 2 minuty
          </button>
        ) : null}
          </>
        )}
          </>
        )}
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
              {cmText(widthCm)} × {cmText(heightCm)} cm
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
            {cmText(widthCm)} × {cmText(heightCm)} cm
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
            onChange={(event) => onSizeChange(Math.round(Number(event.target.value) * 10), heightMm)}
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
            onChange={(event) => onSizeChange(widthMm, Math.round(Number(event.target.value) * 10))}
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
            <span className="pl-quick-split">Okno {cmText(widthCm)} cm zrobimy z 2 plis po {cmText(pieceWidthMm / 10)} cm — cena za obie.</span>
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
