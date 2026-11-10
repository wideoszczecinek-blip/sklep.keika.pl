"use client";

// Koszyk 10.11.2026 (właściciel): karuzela CAŁY DOM / raty / PayPo pod podsumowaniem, logotypy przewoźników
// przy metodach dostawy, przesuwające się logotypy banków na kafelku „Przelew online” i wybór banku
// (najpopularniejsze na wierzchu, reszta pod „Pokaż wszystkie banki” z wyszukiwarką).
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LinkProduktu } from "@/lib/cart-product-links";
import { installmentsAvailable, monthlyInstallment } from "@/lib/installments";
import { useInstallmentCount, useInstallmentSettings } from "@/lib/installment-settings";
import { useRatyPaypo } from "./cart-trust";

// ------------------------------------------------------------------ karuzela pod podsumowaniem

type Slajd = { key: string; node: ReactNode };

function ratyWord(count: number): string {
  const last = count % 10;
  const lastTwo = count % 100;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? "raty" : "rat";
}

const ZL = (v: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function CartPromoCarousel({
  amount,
  bundleText,
  produkty = [],
  onPick,
}: {
  amount: number;
  /** Tekst podpowiedzi CAŁY DOM (bundleDiscountHintText) albo pusty, gdy brak podpowiedzi. */
  bundleText: string;
  produkty?: LinkProduktu[];
  /** Klik w slajd rat / PayPo: wybór tej metody w sekcji Płatność. */
  onPick?: (kind: "p24_installments" | "p24_paypo") => void;
}) {
  const options = useRatyPaypo();
  // ta sama liczba rat i oprocentowanie co na kafelku „Raty” w sekcji Płatność
  const { apr } = useInstallmentSettings();
  const [liczbaRat] = useInstallmentCount();
  const raty = options.raty && installmentsAvailable(amount);
  const paypo = options.paypo;
  const [wybor, setWybor] = useState(false);
  const [aktywny, setAktywny] = useState(0);
  const [pauza, setPauza] = useState(false);
  const tor = useRef<HTMLDivElement | null>(null);

  const slajdy: Slajd[] = [];
  if (bundleText) {
    const discount = /-(\d+(?:[,.]\d+)?)\s*%/.exec(bundleText)?.[1];
    const dodaj = /^Dodaj jeszcze/i.test(bundleText) && produkty.length > 0;
    const tresc = (
      <>
        <span className="cpc-bundle-art" aria-hidden="true">
          {discount ? <b>−{discount}%</b> : <b>%</b>}
        </span>
        <span className="cpc-copy">
          <em className="cpc-eyebrow cpc-eyebrow--gold">CAŁY DOM</em>
          <span className="cpc-text">{bundleText}</span>
        </span>
        {dodaj ? (
          <span className="cpc-go">
            {produkty.length === 1 ? "Dodaj" : "Wybierz"} <i aria-hidden="true">→</i>
          </span>
        ) : null}
      </>
    );
    slajdy.push({
      key: "bundle",
      node: !dodaj ? (
        <div className="cpc-slide cpc-slide--bundle">{tresc}</div>
      ) : produkty.length === 1 ? (
        <Link href={produkty[0].href} className="cpc-slide cpc-slide--bundle is-link">
          {tresc}
        </Link>
      ) : (
        <button
          type="button"
          className="cpc-slide cpc-slide--bundle is-link"
          aria-expanded={wybor}
          onClick={() => {
            setWybor((v) => !v);
            setPauza(true);
          }}
        >
          {tresc}
        </button>
      ),
    });
  }
  if (raty) {
    const count = liczbaRat;
    const monthly = monthlyInstallment(amount, count, apr);
    slajdy.push({
      key: "raty",
      node: (
        <button type="button" className="cpc-slide cpc-slide--raty is-link" onClick={() => onPick?.("p24_installments")}>
          <span className="cpc-copy">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cpc-logo" src="/checkout/przelewy24.svg" alt="Przelewy24" width={84} height={24} />
            <strong className="cpc-title">Urządź wnętrze. Zapłać w ratach.</strong>
            <span className="cpc-text">
              od <b>{ZL(monthly)} zł/mies.</b> · {count} {ratyWord(count)}
            </span>
          </span>
        </button>
      ),
    });
  }
  if (paypo) {
    slajdy.push({
      key: "paypo",
      node: (
        <button type="button" className="cpc-slide cpc-slide--paypo is-link" onClick={() => onPick?.("p24_paypo")}>
          <span className="cpc-copy">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="cpc-logo" src="/paypo/paypo-logo.svg" alt="PayPo" width={84} height={24} />
            <strong className="cpc-title">Zamów dziś. Zapłać do 30 dni.</strong>
            <span className="cpc-text">Wybierz PayPo przy płatności – bez dodatkowych kosztów</span>
          </span>
        </button>
      ),
    });
  }
  const ile = slajdy.length;
  const klucze = slajdy.map((s) => s.key).join("|");

  // aktywny slajd z przewinięcia (palec / myszka)
  useEffect(() => {
    const el = tor.current;
    if (!el) return;
    const naPrzewiniecie = () => {
      const i = Math.round(el.scrollLeft / Math.max(1, el.clientWidth));
      setAktywny(Math.max(0, Math.min(ile - 1, i)));
    };
    el.addEventListener("scroll", naPrzewiniecie, { passive: true });
    return () => el.removeEventListener("scroll", naPrzewiniecie);
  }, [ile, klucze]);

  // samo przewijanie co 5 s, tylko gdy karuzela jest na ekranie i klient jej nie dotyka
  const [naEkranie, setNaEkranie] = useState(false);
  useEffect(() => {
    const el = tor.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([w]) => setNaEkranie(w.isIntersecting), { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [ile]);
  useEffect(() => {
    if (ile < 2 || pauza || !naEkranie) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = window.setTimeout(() => {
      const el = tor.current;
      if (!el) return;
      const nast = (aktywny + 1) % ile;
      el.scrollTo({ left: nast * el.clientWidth, behavior: "smooth" });
    }, 5000);
    return () => window.clearTimeout(t);
  }, [aktywny, ile, pauza, naEkranie]);

  if (!ile) return null;
  return (
    <section
      className="cpc"
      aria-roledescription="karuzela"
      aria-label="Promocje i wygodne płatności"
      onPointerDown={() => setPauza(true)}
      onMouseEnter={() => setPauza(true)}
      onMouseLeave={() => !wybor && setPauza(false)}
      onFocusCapture={() => setPauza(true)}
    >
      <div className="cpc-track" ref={tor}>
        {slajdy.map((s, i) => (
          <div key={s.key} className="cpc-cell" role="group" aria-roledescription="slajd" aria-label={`${i + 1} z ${ile}`}>
            {s.node}
          </div>
        ))}
      </div>
      {ile > 1 ? (
        <div className="cpc-dots" role="tablist" aria-label="Wybierz slajd">
          {slajdy.map((s, i) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={i === aktywny}
              aria-label={`Slajd ${i + 1}`}
              className={i === aktywny ? "is-on" : ""}
              onClick={() => {
                setPauza(true);
                const el = tor.current;
                if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
              }}
            />
          ))}
        </div>
      ) : null}
      {wybor && produkty.length > 1 ? (
        <div className="checkout-bundle-choice" role="group" aria-label="Który produkt chcesz skonfigurować?">
          <p>Który produkt chcesz skonfigurować?</p>
          {produkty.map((p) => (
            <Link key={p.slug} href={p.href}>
              {p.label} <i aria-hidden="true">→</i>
            </Link>
          ))}
        </div>
      ) : null}
    </section>
  );
}

// ------------------------------------------------------------------ banki

export type Bank = { id: number; name: string; img: string };

// Kolejność wg popularności bankowości internetowej w Polsce (liczba klientów cyfrowych) - na wierzchu
// pierwsze 8; dopasowanie po nazwie, bo PayNow i Przelewy24 nazywają banki różnie.
const POPULARNE: RegExp[] = [
  /pko(?!.*inteligo)/i,
  /mbank/i,
  /\bing\b/i,
  /pekao/i,
  /erste|santander/i,
  /millennium/i,
  /alior/i,
  /bnp/i,
  /credit agricole|^ca /i,
  /inteligo/i,
  /velo/i,
  /citi/i,
  /nest/i,
  /spółdziel|spoldziel/i,
  /plus bank/i,
  /boś|ochrony środowiska/i,
  /pocztow/i,
  /stefczyk/i,
  /bank nowy|bfg/i,
  /toyota/i,
  /volkswagen/i,
];

function rangaBanku(name: string): number {
  const i = POPULARNE.findIndex((re) => re.test(name));
  return i === -1 ? POPULARNE.length : i;
}

export function sortujBanki(banks: Bank[]): Bank[] {
  return [...banks].sort((a, b) => rangaBanku(a.name) - rangaBanku(b.name) || a.name.localeCompare(b.name, "pl"));
}

/** Krótka nazwa do podpisu i wyszukiwarki („Płać z ING” → „ING”). */
function krotkaNazwa(name: string): string {
  return name
    .replace(/^(płacę|płać|placę|plac)\s+z\s+/i, "")
    .replace(/\s+(PBL|przelew online)$/i, "")
    .trim();
}

/** Logotypy banków przesuwające się na kafelku „Przelew online” (zamknięty akordeon). */
export function BankMarquee({ banks }: { banks: Bank[] }) {
  const lista = useMemo(() => sortujBanki(banks).filter((b) => b.img), [banks]);
  if (lista.length < 3) return <>Wybierz swój bank</>;
  const rzad = (ukryty: boolean) => (
    <span className="cpb-marquee-row" aria-hidden={ukryty || undefined}>
      {lista.map((b) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={b.id} src={b.img} alt={ukryty ? "" : krotkaNazwa(b.name)} loading="lazy" width={44} height={18} />
      ))}
    </span>
  );
  return (
    <span className="cpb-marquee" aria-label={`Wybierz swój bank: ${lista.map((b) => krotkaNazwa(b.name)).join(", ")}`} style={{ ["--cpb-n" as string]: lista.length }}>
      <span className="cpb-marquee-track">
        {rzad(false)}
        {rzad(true)}
      </span>
    </span>
  );
}

const NA_WIERZCHU = 8;

/** Wybór banku: 8 najpopularniejszych, reszta pod przyciskiem, wyszukiwarka przy rozwiniętej liście. */
export function BankPicker({
  banks,
  value,
  onChange,
  name,
}: {
  banks: Bank[];
  value: number;
  onChange: (bank: Bank) => void;
  name: string;
}) {
  const lista = useMemo(() => sortujBanki(banks), [banks]);
  const [wszystkie, setWszystkie] = useState(false);
  const [szukaj, setSzukaj] = useState("");
  if (!lista.length) {
    return (
      <div className="cart-payment-waiting">
        <span className="cart-invoice-nip-spinner" aria-hidden="true" />
        Wczytujemy listę banków…
      </div>
    );
  }
  const fraza = szukaj.trim().toLowerCase();
  let widoczne = wszystkie ? lista : lista.slice(0, NA_WIERZCHU);
  // wybrany bank spoza pierwszej ósemki zostaje widoczny po zwinięciu
  if (!wszystkie && value && !widoczne.some((b) => b.id === value)) {
    const wybrany = lista.find((b) => b.id === value);
    if (wybrany) widoczne = [...widoczne.slice(0, NA_WIERZCHU - 1), wybrany];
  }
  if (wszystkie && fraza) widoczne = lista.filter((b) => b.name.toLowerCase().includes(fraza));
  const reszta = lista.length - NA_WIERZCHU;
  return (
    <div className="cpb-picker">
      {wszystkie && lista.length > NA_WIERZCHU ? (
        <label className="cpb-search">
          <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="m16 16 4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <input
            type="search"
            value={szukaj}
            onChange={(e) => setSzukaj(e.target.value)}
            placeholder="Szukaj banku"
            aria-label="Szukaj banku"
            autoComplete="off"
          />
        </label>
      ) : null}
      <div className="cart-p24-banks cpb-grid" role="radiogroup" aria-label="Wybierz swój bank">
        {widoczne.map((bank) => (
          <label key={bank.id} className={`cart-p24-bank ${value === bank.id ? "is-active" : ""}`} title={bank.name}>
            <input type="radio" name={name} value={bank.id} checked={value === bank.id} onChange={() => onChange(bank)} />
            {bank.img ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={bank.img} alt={bank.name} loading="lazy" />
            ) : (
              <span className="cart-p24-bank-name">{krotkaNazwa(bank.name)}</span>
            )}
          </label>
        ))}
        {wszystkie && fraza && !widoczne.length ? <p className="cpb-empty">Nie ma takiego banku na liście – wybierz kartę albo BLIK.</p> : null}
      </div>
      {reszta > 0 ? (
        <button
          type="button"
          className="cpb-more"
          aria-expanded={wszystkie}
          onClick={() => {
            setWszystkie((v) => !v);
            setSzukaj("");
          }}
        >
          {wszystkie ? "Pokaż mniej" : `Pokaż wszystkie banki (+${reszta})`}
        </button>
      ) : null}
    </div>
  );
}

// ------------------------------------------------------------------ przewoźnicy

/** Logotyp przy metodzie dostawy. Kurier: InPost albo DPD - przewoźnika wybiera CRM przy nadaniu
 * (najtańsza oferta Apaczki), więc pokazujemy oba. */
export function DeliveryLogo({ method }: { method: string }) {
  if (method === "paczkomat") {
    return (
      <span className="cdl cdl--one" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/checkout/przewoznicy/inpost.svg" alt="" width={60} height={30} />
      </span>
    );
  }
  if (method === "odbior-osobisty") {
    return (
      <span className="cdl cdl--icon" aria-hidden="true">
        <svg viewBox="0 0 32 32" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12 6.5 5h19L28 12" />
          <path d="M4 12c0 2 1.6 3.4 3.5 3.4S11 14 11 12c0 2 1.6 3.4 3.5 3.4h3c1.9 0 3.5-1.4 3.5-3.4 0 2 1.6 3.4 3.5 3.4S28 14 28 12" />
          <path d="M6.5 15.2V27h19V15.2M13 27v-6.5h6V27" />
        </svg>
      </span>
    );
  }
  return (
    <span className="cdl cdl--two" aria-hidden="true">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/checkout/przewoznicy/inpost.svg" alt="" width={46} height={23} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/checkout/przewoznicy/dpd.svg" alt="" width={46} height={20} />
    </span>
  );
}
