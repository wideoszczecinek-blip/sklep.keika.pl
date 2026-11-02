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
import { COMPANY_LEGAL } from "@/lib/company-legal";
import { useBundleDiscountRules } from "@/lib/bundle-discount";
import { QTY_PROMO } from "@/lib/promo";

const img = (src: string, w = 700) => `/_next/image?url=${encodeURIComponent(src)}&w=${w}&q=75`;

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
        <span>Każdą plisę robimy sami, w Polsce – dlatego dajemy na nią 5 lat gwarancji. Nie spodoba się? Masz 30 dni na zwrot.</span>
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

// ---------------------------------------------------------------- lejek v2 (właściciel 2.11: „na samej górze, jak klient
// z zimnego ruchu wejdzie, musi zobaczyć, co to, opis, mały social proof, zbicie obiekcji – jak będzie wiedział, gdzie jest
// i że to nie scam, to wtedy widzi premium: 5 lat gwarancji, zwrot, wizualizator, galeria, animacja z ruchem belek
// i konfigurator z wyceną”). Dane sprzedawcy z lib/company-legal.ts (te same co w regulaminie).

/** Co to jest - jedno zdanie dla kogoś, kto pierwszy raz widzi plisę, i cena „od” w jednej linii. */
export function LejekOpis({ cena, szer, wys }: { cena: number | null; szer: number; wys: number }) {
  return (
    <div className="lj-opis">
      {/* właściciel 2.11: „brakuje na samej górze zwykłego opisu produktu” - fakty z landing-content.ts */}
      <p>
        <b>Plisa okienna</b> to osłona z tkaniny plisowanej montowana bezpośrednio na skrzydle okna. Ma dwie ruchome listwy: zasłaniasz górę,
        dół albo środek szyby, a okno otwierasz i uchylasz jak zwykle. Każdą plisę produkujemy na wymiar Twojego okna.
      </p>
      <ul className="lj-cechy">
        <li><b>Na wymiar</b> – szerokość od 20 do 150 cm, wysokość od 20 do 230 cm</li>
        <li><b>Montaż bez wiercenia</b> (uchwyty na skrzydło) albo przykręcany – około 15 minut</li>
        <li><b>150 tkanin w 5 kolekcjach</b> – od dekoracyjnych po zaciemniające i termoizolacyjne</li>
        <li><b>10 kolorów aluminiowych profili</b> – dobierzesz do koloru ramy</li>
        <li><b>Do okien i drzwi balkonowych</b> PCV, drewnianych i aluminiowych</li>
        <li><b>Bez sznurków i łańcuszków</b>, tkaniny antystatyczne – łatwe w czyszczeniu</li>
      </ul>
      {cena !== null ? (
        <p className="lj-cena">
          Okno {String(szer).replace(".", ",")} × {String(wys).replace(".", ",")} cm: <b>{cena.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł</b>
          <span> · cena rośnie z wymiarem</span>
        </p>
      ) : null}
    </div>
  );
}

const IKONY_Z = {
  firma: "M3 21V8l9-5 9 5v13 M9 21v-6h6v6",
  tel: "M5 4h4l2 5-3 2a11 11 0 0 0 5 5l2-3 5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2",
  karta: "M3 6h18v12H3z M3 10h18 M7 15h4",
  zwrot: IKONY.zwrot,
};

/** Bezpieczne zakupy: prawdziwy sprzedawca, telefon, płatność przez operatorów, zwrot - odpowiedź na „czy to nie oszustwo”. */
export function LejekZaufanie() {
  const c = COMPANY_LEGAL;
  return (
    <section className="lj-zauf" aria-label="Bezpieczne zakupy">
      <p className="lj-zauf-t">Bezpieczne zakupy u producenta</p>
      <ul>
        <li><Ikona d={IKONY_Z.firma} /><span><b>{c.legalName}</b> · {c.street}, {c.postalCode} {c.city} · NIP {c.nip} · produkujemy od {c.producingSince}</span></li>
        <li><Ikona d={IKONY_Z.tel} /><span><b><a href={c.phoneHref} onClick={() => trackShopStep("call_click", "plisy", { source: "zaufanie" })}>{c.phone}</a></b> · {c.hours} · czat na stronie</span></li>
        <li><Ikona d={IKONY_Z.karta} /><span>Płacisz przez <b>Przelewy24, PayNow lub Stripe</b> – BLIK, karta, PayPo, raty albo za pobraniem</span></li>
        <li><Ikona d={IKONY_Z.zwrot} /><span><b>30 dni na zwrot</b> bez podania przyczyny – także plis zrobionych na Twój wymiar</span></li>
      </ul>
    </section>
  );
}

/** Premium: pieczęć 5 lat gwarancji i zwrot obok siebie - zaraz po bloku zaufania. */
export function LejekPremium() {
  return (
    <div className="lj-prem">
      <PremiumSeal />
    </div>
  );
}

// ---------------------------------------------------------------- dalsze sekcje lejka (plan 2.11, artefakt „Lejek plis KEIKA”)

/** Polskie dni wolne (stałe + Wielkanoc, Boże Ciało, od 2025 także Wigilia). */
function swieta(rok: number): Set<string> {
  const a = rok % 19, b = Math.floor(rok / 100), c = rok % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mies = Math.floor((h + l - 7 * m + 114) / 31), dzien = ((h + l - 7 * m + 114) % 31) + 1;
  const wlk = new Date(rok, mies - 1, dzien);
  const plus = (n: number) => {
    const x = new Date(wlk);
    x.setDate(x.getDate() + n);
    return `${x.getMonth() + 1}-${x.getDate()}`;
  };
  return new Set(["1-1", "1-6", "5-1", "5-3", "8-15", "11-1", "11-11", "12-24", "12-25", "12-26", plus(1), plus(60)]);
}

/** Dzień wysyłki: produkcja 7 dni roboczych (bez weekendów i świąt) od jutra. */
export function dzienWysylki(od: Date = new Date(), dni = 7): Date {
  const d = new Date(od.getFullYear(), od.getMonth(), od.getDate());
  let n = 0;
  while (n < dni) {
    d.setDate(d.getDate() + 1);
    const wolne = d.getDay() === 0 || d.getDay() === 6 || swieta(d.getFullYear()).has(`${d.getMonth() + 1}-${d.getDate()}`);
    if (!wolne) n++;
  }
  return d;
}

const zl2 = (v: number) => `${v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;

const TYPOWE: [string, number, number][] = [
  ["Okno uchylne w łazience lub kuchni", 50, 110],
  ["Okno pokojowe", 60, 140],
  ["Duże okno", 80, 150],
  ["Drzwi balkonowe", 70, 210],
];

/** Ile kosztują plisy do typowych okien + CAŁY DOM na przykładzie mieszkania - ceny z cennika konfiguratora. */
export function LejekCeny({ cena, onWymiar }: {
  cena: (szerCm: number, wysCm: number) => number | null;
  onWymiar: (szerCm: number, wysCm: number) => void;
}) {
  const reguly = useBundleDiscountRules();
  const progi = (reguly.plisy?.tiers?.length ? reguly.plisy.tiers : QTY_PROMO.tiers).map((t) => ({ fromQty: t.fromQty, percent: t.percent }));
  const wiersze = TYPOWE.map(([nazwa, w, h]) => ({ nazwa, w, h, c: cena(w, h) }));
  if (wiersze.some((x) => x.c === null)) return null;
  const okno = wiersze[1].c as number;
  const balkon = wiersze[3].c as number;
  const dwa = okno * 2;
  const trzy = okno * 2 + balkon;
  const p2 = progi.find((p) => p.fromQty === 2)?.percent ?? 0;
  const p3 = [...progi].sort((a, b) => b.fromQty - a.fromQty).find((p) => p.fromQty <= 3)?.percent ?? 0;
  const poRabacie = (kwota: number, proc: number) => Math.round(kwota * (1 - proc / 100) * 100) / 100;
  return (
    <section className="pm-section lj-ceny" aria-labelledby="lj-ceny-t">
      <p className="pm-eyebrow">Cena</p>
      <h2 id="lj-ceny-t" className="pm-title">Ile kosztują plisy do Twoich okien</h2>
      <p className="pm-lead">Kolekcja Klasyczne, montaż przykręcany – ceny z konfiguratora. Kliknij okno, żeby wpisać jego wymiar.</p>
      <div className="lj-ceny-grid">
        {wiersze.map((x) => (
          <button
            key={x.nazwa}
            type="button"
            className="lj-ceny-row"
            onClick={() => {
              trackShopStep("lejek_cena_typowa", "plisy", { w: x.w, h: x.h });
              onWymiar(x.w, x.h);
            }}
          >
            <span>
              <b>{x.nazwa}</b>
              <small>{x.w} × {x.h} cm</small>
            </span>
            <strong>{zl2(x.c as number)}</strong>
          </button>
        ))}
      </div>
      {p2 || p3 ? (
        <div className="lj-dom">
          <p className="lj-dom-t">Promocja CAŁY DOM – rabat na całe zamówienie</p>
          <ul>
            {p2 ? (
              <li>
                <span>2 okna 60 × 140 cm</span>
                <s>{zl2(dwa)}</s>
                <b>{zl2(poRabacie(dwa, p2))}</b>
                <em>−{p2} %</em>
              </li>
            ) : null}
            {p3 ? (
              <li>
                <span>Mieszkanie: 2 okna i drzwi balkonowe</span>
                <s>{zl2(trzy)}</s>
                <b>{zl2(poRabacie(trzy, p3))}</b>
                <em>−{p3} %</em>
              </li>
            ) : null}
          </ul>
          <small>Ta sama tkanina we wszystkich oknach to ten sam odcień. Rabat nalicza koszyk.</small>
        </div>
      ) : null}
    </section>
  );
}

const POKOJE = [
  { pokoj: "Sypialnia", co: "Podgumowane (Blackout)", czemu: "Zaciemnia – podgumowany rdzeń blokuje światło, także latem o świcie." },
  { pokoj: "Salon i jadalnia", co: "Klasyczne albo DUO plaster miodu", czemu: "Rozprasza światło i chroni prywatność, w pokoju dalej jest jasno." },
  { pokoj: "Okna od południa, poddasze", co: "Reflex albo DUO TERMO", czemu: "Powłoka od strony szyby odbija słońce – mniej nagrzewania latem." },
  { pokoj: "Biuro, pokój dziecka", co: "Klasyczne albo Blackout", czemu: "Mniej odblasków na ekranie, a w pokoju dziecka zaciemnienie na drzemkę." },
];

/** Dobór tkaniny przez pomieszczenie (wzór Stylus) - przed listą 5 kolekcji. */
export function LejekTkaniny({ onKolekcje }: { onKolekcje: () => void }) {
  const wiz = useWizVisible();
  return (
    <section className="pm-section" aria-labelledby="lj-tk-t">
      <p className="pm-eyebrow">Tkanina</p>
      <h2 id="lj-tk-t" className="pm-title">Która tkanina do którego pokoju</h2>
      <div className="lj-pokoje">
        {POKOJE.map((p) => (
          <div key={p.pokoj} className="lj-pokoj">
            <b>{p.pokoj}</b>
            <span className="lj-pokoj-co">{p.co}</span>
            <span>{p.czemu}</span>
          </div>
        ))}
      </div>
      <div className="lj-akcje">
        {wiz ? (
          <button
            type="button"
            className="pm-btn"
            onClick={() => {
              trackShopStep("lejek_tkanina_wiz", "plisy", {});
              openWizualizator({ zrodlo: "lejek-tkaniny" });
            }}
          >
            Zobacz kolor w swoim oknie
          </button>
        ) : null}
        <button type="button" className="pm-link" onClick={onKolekcje}>
          Wszystkie 150 tkanin z cenami →
        </button>
      </div>
    </section>
  );
}

/** Pomiar w 2 minuty + co, jeśli się pomylisz (tylko to, co dziś obowiązuje - FAQ „Co jeśli źle zmierzę?”). */
export function LejekPomiar({ onAnimacja, onCzat }: { onAnimacja: () => void; onCzat: () => void }) {
  return (
    <section className="pm-section" aria-labelledby="lj-pom-t">
      <p className="pm-eyebrow">Pomiar</p>
      <h2 id="lj-pom-t" className="pm-title">Zmierzysz w 2 minuty. A jeśli się pomylisz – pomożemy.</h2>
      <div className="lj-pomiar">
        <div>
          <b>Montaż przykręcany</b>
          <span>Szerokość i wysokość szyby od środka uszczelki do środka uszczelki naprzeciwko. Niczego nie odejmujesz.</span>
        </div>
        <div>
          <b>Montaż bez wiercenia</b>
          <span>Szerokość: szyba razem z obiema listwami przyszybowymi. Wysokość: całe skrzydło okna.</span>
        </div>
      </div>
      <button
        type="button"
        className="pm-btn"
        onClick={() => {
          trackShopStep("lejek_pomiar_animacja", "plisy", {});
          onAnimacja();
        }}
      >
        Zobacz animację pomiaru
      </button>
      <div className="lj-pomylka">
        <b>Pomyliłeś wymiar?</b>
        <span>
          Napisz od razu po zamówieniu – jeśli plisa nie weszła jeszcze do produkcji, poprawimy wymiar bez kosztów. Po montażu chroni Cię 30 dni na
          zwrot.
        </span>
        <button
          type="button"
          className="pm-link"
          onClick={() => {
            trackShopStep("lejek_pomiar_czat", "plisy", {});
            onCzat();
          }}
        >
          Wyślij zdjęcie okna na czacie – podpowiemy wymiar →
        </button>
      </div>
    </section>
  );
}

/** Kiedy dostanę i jak zapłacę. */
export function LejekDostawa({ paypo }: { paypo: boolean }) {
  const d = dzienWysylki();
  const kiedy = ["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"][d.getDay()];
  const dzien = `${kiedy}, ${d.toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}`;
  return (
    <section className="pm-section lj-dost" aria-labelledby="lj-dost-t">
      <p className="pm-eyebrow">Dostawa i płatność</p>
      <h2 id="lj-dost-t" className="pm-title">Zamów dziś – wyślemy najpóźniej {dzien}</h2>
      <ul className="lj-dost-l">
        <li><b>Produkcja 7 dni roboczych</b> u nas w Polsce, potem kurier w 24 h. Darmowa dostawa od 79 zł.</li>
        <li><b>Płatność:</b> BLIK, karta, przelew{paypo ? ", PayPo – zapłać za 30 dni" : ""}, raty albo za pobraniem.</li>
        <li><b>30 dni na zwrot</b> bez podania przyczyny – także plis zrobionych na Twój wymiar.</li>
      </ul>
    </section>
  );
}

/** FAQ w lejku: najpierw pytania, które zatrzymują zakup (zwrot, pomyłka, dopasowanie, wiercenie, czas, kolor, światło). */
export function faqWgObiekcji<T extends { question: string }>(lista: T[]): T[] {
  const kolejnosc = [/zwróc|gwarancj/i, /źle zmierz/i, /do jakich okien|otwieraniu/i, /wiercić/i, /długo czekam/i, /próbki|kolor/i, /światła/i];
  const waga = (q: string) => {
    const i = kolejnosc.findIndex((r) => r.test(q));
    return i < 0 ? 100 : i;
  };
  return [...lista].sort((a, b) => waga(a.question) - waga(b.question));
}
