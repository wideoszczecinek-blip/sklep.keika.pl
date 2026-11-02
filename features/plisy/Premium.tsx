"use client";

// Wersja „premium” strony plis (test A/B, lib/premium-look.ts; właściciel 2.11: „pokazać klientom, że te plisy
// to coś więcej, że to premium look – dać wizualizację, podkreślić 5 lat gwarancji – jakość”). Treść tylko z faktów,
// które strona już podaje (landing-content.ts): produkujemy sami od 2015, 5 lat gwarancji, 30 dni na zwrot,
// 150 tkanin w 5 kolekcjach (antystatyczne), aluminiowe profile w 10 kolorach, dwie ruchome listwy, sznurki
// prowadzące, montaż bez wiercenia. Ceny i promocje bez zmian. Zdjęcia poniżej pierwszego ekranu - leniwie (LCP).
import { useMemo, useRef, useState } from "react";
import { trackShopStep } from "@/lib/track-step";
import { openWizualizator } from "@/lib/wizualizator/flag";
import { useWizVisible } from "@/features/wizualizator/WizEntry";
import { useCompanyRating, useCompanyReviews } from "./Reviews";
import { opinieLabel } from "./LandingV2";

const img = (src: string, w = 700) => `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;

/** Krótki pasek pod tytułem: gwarancja widoczna nad zgięciem także na komputerze (tam karta ceny jest niżej). */
export function PremiumStrip() {
  return (
    <p className="pm-strip">
      <span className="pm-strip-seal" aria-hidden="true">5</span>
      <b>5 lat gwarancji</b>
      <span className="pm-strip-sep" aria-hidden="true">·</span>
      <span>Produkujemy na wymiar od 2015</span>
    </p>
  );
}

/** Pieczęć gwarancji przy cenie - zamiast drobnych plakietek. */
export function PremiumSeal() {
  return (
    <div className="pm-seal-row">
      <div className="pm-seal" aria-label="5 lat gwarancji">
        <b>5</b>
        <span>lat<br />gwarancji</span>
      </div>
      <div className="pm-seal-text">
        <strong>Produkujemy na wymiar od 2015</strong>
        <span>Każdą plisę robimy sami, w Polsce – dlatego dajemy na nią 5 lat gwarancji.</span>
      </div>
    </div>
  );
}

const Ikona = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IKONY = {
  tarcza: "M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6l7-3z M9 12l2 2 4-4",
  zwrot: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  dostawa: "M3 7h11v9H3z M14 10h4l3 3v3h-7 M7 19a1.5 1.5 0 1 0 0-.1 M17 19a1.5 1.5 0 1 0 0-.1",
  miara: "M3 17l14-14 4 4L7 21H3v-4z M7 13l2 2 M10 10l2 2 M13 7l2 2",
};

/** Linia zaufania pod przyciskiem zakupu (strona i koszyk). */
export function PremiumPerks({ shippingFree = true, className = "" }: { shippingFree?: boolean; className?: string }) {
  return (
    <ul className={`pm-perks ${className}`}>
      <li><Ikona d={IKONY.tarcza} />5 lat gwarancji</li>
      <li><Ikona d={IKONY.zwrot} />30 dni na zwrot</li>
      {shippingFree ? <li><Ikona d={IKONY.dostawa} />dostawa 0 zł</li> : null}
      <li><Ikona d={IKONY.miara} />produkcja na wymiar</li>
    </ul>
  );
}

const MATERIALY = [
  {
    src: "/plisy/detal-04.jpg",
    alt: "Zbliżenie tkaniny plisowanej KEIKA - równe fałdy",
    tytul: "Tkanina",
    tekst: "150 tkanin w 5 kolekcjach – od dekoracyjnych po zaciemniające i termoizolacyjne DUO TERMO. Antystatyczne: nie przyciągają kurzu, czyścisz je wilgotną ściereczką.",
  },
  {
    src: "/plisy/detal-01.jpg",
    alt: "Aluminiowa listwa plisy KEIKA z uchwytem do przesuwania",
    tytul: "Profil aluminiowy",
    tekst: "Smukłe listwy z aluminium w 10 kolorach – od bieli po złoty dąb. Dwie ruchome listwy: zasłaniasz górę, dół albo środek okna.",
  },
  {
    src: "/plisy/detal-05.jpg",
    alt: "Uchwyt montażowy i sznurki prowadzące plisy",
    tytul: "Mechanizm",
    tekst: "Sznurki prowadzące trzymają plisę przy skrzydle – otwierasz i uchylasz okno jak zwykle. Bez łańcuszków, montaż bez wiercenia albo przykręcany.",
  },
];

/** „Jakość, która zostaje na lata” - detale produktu zamiast siatki ikon. */
export function PremiumQuality() {
  return (
    <section className="pm-quality" aria-labelledby="pm-quality-title">
      <p className="pm-eyebrow">Jakość KEIKA</p>
      <h2 id="pm-quality-title" className="pm-title">Plisa, która zostaje z Tobą na lata</h2>
      <p className="pm-lead">
        Nie sprzedajemy gotowców z magazynu. Każdą plisę produkujemy sami, na wymiar Twojego okna – i dlatego możemy dać na nią
        <strong> 5 lat gwarancji</strong>.
      </p>
      <div className="pm-quality-grid">
        {MATERIALY.map((m) => (
          <figure key={m.tytul} className="pm-quality-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img(m.src)} alt={m.alt} loading="lazy" decoding="async" width={700} height={525} />
            <figcaption>
              <b>{m.tytul}</b>
              <span>{m.tekst}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      <PremiumPerks className="pm-perks--center" />
    </section>
  );
}

const PRZED_PO = [
  { przed: "/plisy/przed-po/okno-przed.webp", po: "/plisy/przed-po/okno-po.webp", opis: "Okno w sypialni – plisa w kolorze beżu" },
  { przed: "/plisy/przed-po/wneka-przed.webp", po: "/plisy/przed-po/wneka-po.webp", opis: "Okno we wnęce – plisy zasłaniają tylko górę" },
];

/** Suwak przed/po na jednym zdjęciu (przeciągnij albo kliknij). */
function Porownanie({ przed, po, opis }: { przed: string; po: string; opis: string }) {
  const [x, setX] = useState(50);
  const ref = useRef<HTMLDivElement | null>(null);
  const przesun = (clientX: number) => {
    const r = ref.current?.getBoundingClientRect();
    if (r) setX(Math.min(98, Math.max(2, ((clientX - r.left) / r.width) * 100)));
  };
  return (
    <figure className="pm-ba">
      <div
        ref={ref}
        className="pm-ba-frame"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          przesun(e.clientX);
        }}
        onPointerMove={(e) => {
          if (e.buttons) przesun(e.clientX);
        }}
        role="slider"
        aria-label={`${opis}: przed i po`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(x)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "ArrowLeft") setX((v) => Math.max(2, v - 5));
          if (e.key === "ArrowRight") setX((v) => Math.min(98, v + 5));
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={po} alt={`${opis} – z plisą`} loading="lazy" decoding="async" draggable={false} />
        <div className="pm-ba-przed" style={{ clipPath: `inset(0 ${100 - x}% 0 0)` }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={przed} alt={`${opis} – przed`} loading="lazy" decoding="async" draggable={false} />
        </div>
        <span className="pm-ba-line" style={{ left: `${x}%` }} aria-hidden="true"><i>‹ ›</i></span>
        <span className="pm-ba-tag is-l">przed</span>
        <span className="pm-ba-tag is-r">z plisą</span>
      </div>
      <figcaption>{opis} · wizualizacja poglądowa</figcaption>
    </figure>
  );
}

/** Przed/po na prawdziwych wnętrzach + zaproszenie do wizualizacji własnego okna (gdy narzędzie jest dla tej osoby). */
export function PremiumPrzedPo() {
  const wiz = useWizVisible();
  return (
    <section className="pm-section" aria-labelledby="pm-ba-title">
      <p className="pm-eyebrow">Przed i po</p>
      <h2 id="pm-ba-title" className="pm-title">Zobacz różnicę w prawdziwym wnętrzu</h2>
      <div className="pm-ba-grid">
        {PRZED_PO.map((p) => (
          <Porownanie key={p.po} {...p} />
        ))}
      </div>
      {wiz ? (
        <button
          type="button"
          className="pm-btn"
          onClick={() => {
            trackShopStep("premium_przed_po_wiz", "plisy", {});
            openWizualizator({ zrodlo: "premium-przed-po" });
          }}
        >
          Zobacz plisę na zdjęciu swojego okna
        </button>
      ) : null}
    </section>
  );
}

/** Cytaty na stronę plis: najpierw o plisach, potem o jakości i trwałości, potem o dopasowaniu. */
const punkty = (t: string) =>
  (/plis/i.test(t) ? 6 : 0) + (/(jako|starann|solidn|posłuż|wykonan|estetyczn|pięk)/i.test(t) ? 3 : 0) + (/(idealn|dopasow|na wymiar)/i.test(t) ? 1 : 0);

/** Ocena i trzy krótkie cytaty klientów (bez źródeł - tak jak sekcja Opinie). */
export function PremiumQuotes({ onAll }: { onAll?: () => void }) {
  const rating = useCompanyRating();
  const reviews = useCompanyReviews();
  const cytaty = useMemo(() => {
    const seen = new Set<string>();
    return reviews
      .filter((r) => r.stars === 5 && r.text.length >= 45 && r.text.length <= 320 && !seen.has(r.text) && (seen.add(r.text), true))
      .map((r) => ({ r, p: punkty(r.text) }))
      .sort((a, b) => b.p - a.p)
      .slice(0, 3)
      .map((x) => x.r);
  }, [reviews]);
  if (!rating && !cytaty.length) return null;
  return (
    <section className="pm-section pm-quotes" aria-labelledby="pm-quotes-title">
      <p className="pm-eyebrow">Opinie klientów</p>
      <h2 id="pm-quotes-title" className="pm-title">
        {rating ? (
          <>
            {(Math.round(rating.average * 10) / 10).toLocaleString("pl-PL", { minimumFractionDigits: 1 })} / 5 <span className="pm-stars">★★★★★</span>
          </>
        ) : (
          "Co mówią klienci"
        )}
      </h2>
      {rating ? <p className="pm-lead">{opinieLabel(rating.total)} klientów KEIKA</p> : null}
      <div className="pm-quotes-grid">
        {cytaty.map((r) => (
          <blockquote key={r.id || r.text} className="pm-quote">
            <span className="pm-stars" aria-label="5 na 5">★★★★★</span>
            <p>„{r.text}”</p>
            <footer>{r.author} · {r.date}</footer>
          </blockquote>
        ))}
      </div>
      {onAll ? (
        <button type="button" className="pm-link" onClick={onAll}>
          Wszystkie opinie →
        </button>
      ) : null}
    </section>
  );
}
