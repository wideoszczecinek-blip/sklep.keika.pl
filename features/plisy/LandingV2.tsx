"use client";

// Landing plis v2 (2026-10-11) - klocki pierwszego ekranu i dolnego paska,
// wzięte z najlepiej sprzedających stron (Allegro nr 1 Stelge, Karnix,
// Dekoria, Blinds2go): zdjęcie zanim cokolwiek, ocena z liczbą opinii pod
// tytułem, oferta jako jedna karta (cena, co w cenie, kiedy, jak zapłacić,
// przycisk), jeden stały przycisk pod kciukiem zamiast czterech zakładek.
// Reszta landingu (wycena, kolekcje, opinie, instrukcje, FAQ) to istniejące
// komponenty w nowej kolejności - patrz app/home-client.tsx, gałąź plisy.
import { useEffect, useState } from "react";
import { crmGetJson } from "@/lib/crm-get";
import { PROMO_CODE, QTY_PROMO } from "@/lib/promo";
import { useBundleDiscountRules } from "@/lib/bundle-discount";
import { trackShopStep } from "@/lib/track-step";
import { CRM_PUBLIC_BASE } from "@/app/components/payment-methods";
import { PLISY_HERO_PHOTOS } from "./gallery";
import { PremiumPerks } from "./Premium";

const HERO_ALT = [
  "Biała plisa okienna KEIKA zamontowana w oknie, tkanina opuszczona od góry",
  "Plisa okienna KEIKA w antracytowej tkaninie na oknie dwuskrzydłowym - zdjęcie z montażu u klienta",
  "Plisy okienne KEIKA w sali konferencyjnej - szare tkaniny, regulacja od góry",
];
// 700 to szerokość z listy dozwolonych w optymalizatorze (ta sama co kafelki
// w PlisyHeroPhotos) - na telefonie z DPR 3 wystarcza do 390 px kadru.
const heroSrc = (src: string) => `/_next/image?url=${encodeURIComponent(src)}&w=700&q=75`;

export function zlPlain(value: number): string {
  return `${value.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
}

/** "433 opinie" / "1 opinia" / "25 opinii" - liczebnik po polsku. */
export function opinieLabel(total: number): string {
  const n = Math.abs(total) % 100;
  const last = n % 10;
  if (total === 1) return "1 opinia";
  if (last >= 2 && last <= 4 && !(n >= 12 && n <= 14)) return `${total.toLocaleString("pl-PL")} opinie`;
  return `${total.toLocaleString("pl-PL")} opinii`;
}

/** PayPo widoczne tylko, gdy koszyk naprawdę je oferuje (ta sama reguła co
 * w pasku promocji i przy przycisku zakupu): routing metody albo flagi P24. */
export function usePaypoEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);
  useEffect(() => {
    let alive = true;
    crmGetJson<Record<string, unknown>>(`${CRM_PUBLIC_BASE}/site`)
      .then((json) => {
        if (!alive) return;
        const checkout = (json?.checkout && typeof json.checkout === "object" ? json.checkout : {}) as Record<string, unknown>;
        const routing = (checkout.payment_routing && typeof checkout.payment_routing === "object" ? checkout.payment_routing : {}) as Record<string, { enabled?: boolean }>;
        const viaRouting = routing.paypo ? routing.paypo.enabled === true : null;
        const viaP24 = checkout.p24_enabled === true && checkout.p24_paypo_enabled === true;
        setEnabled(viaRouting ?? viaP24);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return enabled;
}

const HERO_BENEFITS = [
  ["5 lat gwarancji", "M12 22s7-3 7-10V5l-7-3-7 3v7c0 7 7 10 7 10Z M9 12l2 2 4-4"],
  ["30 dni na zwrot", "M12 21S3 16 3 9a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 7-9 12-9 12Z M9 12l2 2 4-4"],
  ["Produkt polski", "M4 22V3h16v12H4 M4 9h16"],
  ["Aluminiowa belka", "M3 8h18v8H3z M7 8v8 M17 8v8"],
  ["Grube tkaniny", "m3 8 9-5 9 5-9 5-9-5Z M3 12l9 5 9-5 M3 16l9 5 9-5"],
] as const;

export function PlisyHeroGallery() {
  const photos = PLISY_HERO_PHOTOS;
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const benefitGroups = [HERO_BENEFITS.slice(0, 2), HERO_BENEFITS.slice(2, 4), HERO_BENEFITS.slice(4)];

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!playing || preference.matches) return;
    const timer = window.setInterval(() => setActive((index) => (index + 1) % photos.length), 5200);
    return () => window.clearInterval(timer);
  }, [photos.length, playing]);

  return (
    <div className="plv2-gallery" role="region" aria-label="Zdjęcia i zalety plis KEIKA">
      <div className="plv2-photo-stage">
        {photos.map((src, index) => (
          <figure key={src} className={`plv2-slide ${index === active ? "is-active" : ""}`} aria-hidden={index !== active}>
            <img src={heroSrc(src)} alt={HERO_ALT[index] || "Plisa KEIKA na oknie"} decoding="async" fetchPriority={index === 0 ? "high" : "low"} />
          </figure>
        ))}
        <ul className="plv2-photo-benefits" key={active}>
          {(benefitGroups[active] || benefitGroups[0]).map(([label, path]) => (
            <li key={label}>
              <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>
              {label}
            </li>
          ))}
        </ul>

        <div className="plv2-gallery-dots" aria-label="Sterowanie zdjęciami">
          {photos.map((src, index) => (
            <button key={src} type="button" className={index === active ? "is-active" : ""} aria-label={`Zdjęcie ${index + 1}`} aria-pressed={index === active} onClick={() => {
              setPlaying(false);
              setActive(index);
              trackShopStep("hero_gallery_dot", "plisy", { index });
            }} />
          ))}
          <button type="button" className="plv2-gallery-pause" aria-label={playing ? "Wstrzymaj karuzelę" : "Wznów karuzelę"} onClick={() => setPlaying(!playing)}>{playing ? "Ⅱ" : "▶"}</button>
        </div>
      </div>

    </div>
  );
}

export function PlisyProofLine({ average, total, onClick }: { average: number; total: number; onClick?: () => void }) {
  if (!total) return null;
  const rounded = Math.round(average * 10) / 10;
  return (
    <button type="button" className="plv2-proof" onClick={onClick}>
      <span className="plv2-proof-stars" aria-hidden="true">
        {[1, 2, 3, 4, 5].map((s) => (
          <span key={s} className={s <= Math.round(average) ? "is-filled" : ""}>
            ★
          </span>
        ))}
      </span>
      <strong>{rounded.toLocaleString("pl-PL", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}</strong>
      <span className="plv2-proof-sep">·</span>
      <span>{opinieLabel(total)} klientów</span>
    </button>
  );
}

/** Karta oferty: cena dla przykładowego okna, co w cenie, kiedy, jak
 * zapłacić, dwa przyciski. Wzorzec: oferta Allegro / strona Dekorii. */
export function PlisyOfferCard({
  regular,
  withPromo,
  promoRemainingText,
  widthCm,
  heightCm,
  leadTime,
  paypoEnabled,
  phone,
  onQuote,
}: {
  regular: number | null;
  withPromo: number | null;
  /** "23 godz. 10 min" gdy SEZON20 trwa, null gdy nie ma odliczania. */
  promoRemainingText: string | null;
  widthCm: number;
  heightCm: number;
  leadTime: string;
  paypoEnabled: boolean;
  phone: string;
  onQuote: () => void;
}) {
  const discounted = regular !== null && withPromo !== null && withPromo < regular;
  const phoneHref = `tel:${phone.replace(/[^\d+]/g, "")}`;
  return (
    <div className="plv2-offer" aria-label="Oferta">
      <div className="plv2-offer-price">
        {regular === null ? (
          <b className="plv2-offer-loading">Ładujemy cennik…</b>
        ) : (
          <>
            <b>{zlPlain(discounted ? (withPromo as number) : regular)}</b>
            {discounted ? <s>{zlPlain(regular)}</s> : null}
            {discounted ? (
              <span className="plv2-offer-code">
                -20% z kodem {PROMO_CODE}
                {promoRemainingText ? ` · jeszcze ${promoRemainingText}` : ""}
              </span>
            ) : (
              // Landing v2 nie ma paska u góry ani linii nad tytułem, więc
              // promocja ilościowa „CAŁY DOM" (28.10.2026) jest tylko tu, przy
              // cenie. Gałąź wyżej (kod) zostaje na wypadek powrotu SEZON20.
              <span className="plv2-offer-code">
                <strong>{QTY_PROMO.name}</strong>: {QTY_PROMO.short} · {QTY_PROMO.mix} ·{" "}
                <a href={QTY_PROMO.rulesHref}>zasady</a>
              </span>
            )}
          </>
        )}
      </div>
      {/* Obietnica z reklam „jakość” widoczna od razu pod ceną (właściciel 16.10, #87). */}
      {/* gwarancja i zwrot stoją wyżej („Kupujesz bez ryzyka”), w karcie tylko linia zaufania pod przyciskiem */}
      <div className="plv2-offer-badge" hidden>
        <span>🛡 5 lat gwarancji</span>
        <span>↩ 30 dni na zwrot</span>
        <span>🇵🇱 polska produkcja</span>
      </div>
      <div className="plv2-offer-size">
        plisa {String(widthCm).replace(".", ",")} × {String(heightCm).replace(".", ",")} cm, kolekcja Klasyczne · cena rośnie z wymiarem
      </div>
      <ul className="plv2-offer-lines">
        <li>
          <i aria-hidden="true">🚚</i>Dostawa gratis już od 1 sztuki
        </li>
        <li>
          <i aria-hidden="true">🏭</i>Produkcja {leadTime}, u nas w Polsce
        </li>
        <li>
          <i aria-hidden="true">↩</i>30 dni na zwrot, także plisy na wymiar
        </li>
        <li>
          <i aria-hidden="true">💳</i>BLIK, karta, {paypoEnabled ? "PayPo (zapłać za 30 dni), " : ""}za pobraniem
        </li>
      </ul>
      {/* Na komputerze (≥1101px) oba przyciski w jednym rzędzie - patrz CSS. */}
      <div className="plv2-offer-actions">
        <button
          type="button"
          className="plv2-btn"
          onClick={() => {
            trackShopStep("offer_cta", "plisy", { price: withPromo ?? regular ?? 0 });
            onQuote();
          }}
        >
          Wyceń swoje okno
        </button>
        <a
          className="plv2-btn plv2-btn--sec"
          href={phoneHref}
          onClick={() => trackShopStep("call_click", "plisy", { source: "offer_card" })}
        >
          <span aria-hidden="true">📞</span> Zadzwoń: {phone}
        </a>
      </div>
      <PremiumPerks />
    </div>
  );
}

/** "Dlaczego KEIKA" - cztery rzeczy zamiast siatki parametrów, w tym telefon
 * (jedyny kanał, którego liderzy używają, a my nie mieliśmy). */
export function PlisyWhyGrid({ phone }: { phone: string }) {
  const phoneHref = `tel:${phone.replace(/[^\d+]/g, "")}`;
  return (
    <div className="plv2-why" aria-label="Dlaczego KEIKA">
      <h2 className="hero-product-section-title">Dlaczego KEIKA</h2>
      <div className="plv2-why-grid">
        <div>
          <span aria-hidden="true">🏭</span>Produkujemy sami od 2015
        </div>
        <div>
          <span aria-hidden="true">🛡</span>5 lat gwarancji
        </div>
        <div>
          <span aria-hidden="true">↩</span>30 dni na zwrot, też na wymiar
        </div>
        <a href={phoneHref} onClick={() => trackShopStep("call_click", "plisy", { source: "why_grid" })}>
          <span aria-hidden="true">📞</span>Zadzwoń: {phone}
        </a>
      </div>
    </div>
  );
}

/** Stały dolny pasek: wymiar i cena z wyceny + jeden przycisk, który
 * przenosi do wyboru tkaniny (konfigurator z wpisanymi wymiarami i
 * montażem). Zastępuje cztery zakładki nawigacji. */
export function PlisyStickyBar({
  visible,
  widthCm,
  heightCm,
  price,
  promoApplied = false,
  bottomInset,
  onClick,
  wpisane = true,
  onSprawdz,
}: {
  visible: boolean;
  /** 3.11: dopóki klient nie wpisał wymiarów, pasek nie pokazuje cudzej ceny - „Sprawdź cenę” przewija do pól. */
  wpisane?: boolean;
  onSprawdz?: () => void;
  widthCm: number;
  heightCm: number;
  price: number | null;
  /** Cena liczona z kodem rabatowym - tylko wtedy dopisek „z kodem …” (AGN-673:
   * po wyłączeniu SEZON20 pasek dalej go pokazywał). */
  promoApplied?: boolean;
  bottomInset: number;
  onClick: () => void;
}) {
  // AGN-716 (2.11): cena w pasku = 1 szt. z cennika, a CAŁY DOM osobną
  // linią (progi z CRM, zapas QTY_PROMO.tiers) - jak w pasku u góry i kaflach.
  const bundleRules = useBundleDiscountRules();
  const promoTiers = (bundleRules.plisy?.tiers?.length ? bundleRules.plisy.tiers : QTY_PROMO.tiers)
    .map((tier) => ({ fromQty: tier.fromQty, percent: tier.percent }))
    .sort((a, b) => a.fromQty - b.fromQty);
  const promoLine = promoTiers.length
    ? `${QTY_PROMO.name}: ${promoTiers
        .map((tier, index) =>
          index === promoTiers.length - 1
            ? `${tier.fromQty}+ -${tier.percent} %`
            : `${tier.fromQty} ${tier.fromQty <= 4 ? "produkty" : "produktów"} -${tier.percent} %`,
        )
        .join(", ")}`
    : "";
  return (
    <div
      className={`plv2-bar ${visible ? "is-visible" : ""}`}
      style={bottomInset > 0 ? { paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${bottomInset}px + 0.55rem)` } : undefined}
      aria-hidden={visible ? "false" : "true"}
    >
      <div className="plv2-bar-info">
        <b>{!wpisane ? "Ile za Twoje okno?" : price !== null ? zlPlain(price) : "Twoje okno"}</b>
        {wpisane ? (
          <small>
            {String(widthCm).replace(".", ",")} × {String(heightCm).replace(".", ",")} cm{price !== null && promoApplied ? ` · z kodem ${PROMO_CODE}` : ""}
          </small>
        ) : null}
        {promoLine && !promoApplied ? <small className="plv2-bar-promo">{promoLine}</small> : null}
      </div>
      <button
        type="button"
        className="plv2-btn plv2-bar-btn"
        tabIndex={visible ? 0 : -1}
        onClick={() => {
          trackShopStep("sticky_bar_click", "plisy", { price: wpisane ? price ?? 0 : 0, wpisane });
          if (!wpisane && onSprawdz) onSprawdz();
          else onClick();
        }}
      >
        {wpisane ? "Wybierz tkaninę →" : "Sprawdź cenę"}
      </button>
    </div>
  );
}
