"use client";

// Landing plis v2 (2026-10-11) - klocki pierwszego ekranu i dolnego paska,
// wzięte z najlepiej sprzedających stron (Allegro nr 1 Stelge, Karnix,
// Dekoria, Blinds2go): zdjęcie zanim cokolwiek, ocena z liczbą opinii pod
// tytułem, oferta jako jedna karta (cena, co w cenie, kiedy, jak zapłacić,
// przycisk), jeden stały przycisk pod kciukiem zamiast czterech zakładek.
// Reszta landingu (wycena, kolekcje, opinie, instrukcje, FAQ) to istniejące
// komponenty w nowej kolejności - patrz app/home-client.tsx, gałąź plisy.
import { Fragment, useEffect, useRef, useState } from "react";
import { crmGetJson } from "@/lib/crm-get";
import { PROMO_CODE, QTY_PROMO } from "@/lib/promo";
import { trackShopStep } from "@/lib/track-step";
import { CRM_PUBLIC_BASE } from "@/app/components/payment-methods";
import { PLISY_HERO_PHOTOS } from "./gallery";
import PlisyHeroScene from "./PlisyHeroScene";
import { PlisyFilmSlide } from "./FilmClips";

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

/** Galeria na górze: prawdziwe zdjęcia z montaży do przesuwania + animowana
 * prezentacja jako ostatni kadr (właściciel 2026-09-16 chciał ją zostawić;
 * liderzy otwierają stronę zdjęciem, więc zdjęcie jest pierwsze). */
export function PlisyHeroGallery() {
  const photos = PLISY_HERO_PHOTOS;
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);
  // Drugi slajd = cały film 3D plisy (Agencja AI 30.10.2026: „zdjęcie główne zostaje, film zaraz po nim”).
  const FILM_AT = 1;
  const slidesCount = photos.length + 2;

  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    let frame = 0;
    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(() => {
        frame = 0;
        const index = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
        setActive((prev) => (prev === index ? prev : index));
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      el.removeEventListener("scroll", onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  const goTo = (index: number) => {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: index * el.clientWidth, behavior: "smooth" });
    trackShopStep("hero_gallery_dot", "plisy", { index });
  };

  return (
    <div className="plv2-gallery" role="region" aria-label="Zdjęcia plis KEIKA z montaży">
      <div className="plv2-gallery-scroller" ref={scrollerRef}>
        {photos.map((src, index) => (
          <Fragment key={src}>
            {index === FILM_AT ? <PlisyFilmSlide active={active === FILM_AT} /> : null}
            <figure className="plv2-slide">
              <img src={heroSrc(src)} alt={HERO_ALT[index] || "Plisa KEIKA na oknie"} loading={index === 0 ? "eager" : "lazy"} decoding="async" fetchPriority={index === 0 ? "high" : undefined} />
            </figure>
          </Fragment>
        ))}
        <figure className="plv2-slide plv2-slide--scene" aria-label="Animowana prezentacja plisy">
          <PlisyHeroScene active={active === slidesCount - 1} />
        </figure>
      </div>
      <span className="plv2-gallery-chip">Własna produkcja od 2015</span>
      <div className="plv2-gallery-dots" aria-label="Wybierz zdjęcie">
        {Array.from({ length: slidesCount }, (_, index) => (
          <button
            key={index}
            type="button"
            className={index === active ? "is-active" : ""}
            aria-label={index === FILM_AT ? "Film" : index === slidesCount - 1 ? "Prezentacja" : `Zdjęcie ${index < FILM_AT ? index + 1 : index}`}
            aria-pressed={index === active ? "true" : "false"}
            onClick={() => goTo(index)}
          />
        ))}
      </div>
    </div>
  );
}

/** Wiersz dowodu pod tytułem: ocena firmy i liczba opinii (dane z CRM). */
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
                <strong>{QTY_PROMO.name}</strong>: {QTY_PROMO.short} ·{" "}
                <a href={QTY_PROMO.rulesHref}>zasady</a>
              </span>
            )}
          </>
        )}
      </div>
      {/* Obietnica z reklam „jakość” widoczna od razu pod ceną (właściciel 16.10, #87). */}
      <div className="plv2-offer-badge">
        <span>🛡 5 lat gwarancji</span>
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
  bottomInset,
  onClick,
}: {
  visible: boolean;
  widthCm: number;
  heightCm: number;
  price: number | null;
  bottomInset: number;
  onClick: () => void;
}) {
  return (
    <div
      className={`plv2-bar ${visible ? "is-visible" : ""}`}
      style={bottomInset > 0 ? { paddingBottom: `calc(env(safe-area-inset-bottom, 0px) + ${bottomInset}px + 0.55rem)` } : undefined}
      aria-hidden={visible ? "false" : "true"}
    >
      <div className="plv2-bar-info">
        <b>{price !== null ? zlPlain(price) : "Twoje okno"}</b>
        <small>
          {String(widthCm).replace(".", ",")} × {String(heightCm).replace(".", ",")} cm{price !== null ? ` · z kodem ${PROMO_CODE}` : ""}
        </small>
      </div>
      <button
        type="button"
        className="plv2-btn plv2-bar-btn"
        tabIndex={visible ? 0 : -1}
        onClick={() => {
          trackShopStep("sticky_bar_click", "plisy", { price: price ?? 0 });
          onClick();
        }}
      >
        Wybierz tkaninę →
      </button>
    </div>
  );
}
