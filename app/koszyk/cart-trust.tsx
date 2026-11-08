"use client";

// Pasek zaufania przy podsumowaniu i płatności (od 2.11 dla wszystkich - test „premium” zakończony).
// Agencja 2.11: od wyłączenia SEZON20 z koszyka do kasy przechodzi 12 % zamiast 31 % - cenę trzeba uzasadnić
// jakością: 5 lat gwarancji · 30 dni na zwrot · dostawa 0 zł · produkcja na wymiar, raty i PayPo, krótko dlaczego warto.
import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import type { LinkProduktu } from "@/lib/cart-product-links";
import { crmGetJson } from "@/lib/crm-get";
import InstallmentOffer from "@/app/components/installment-offer";
import { installmentsAvailable, monthlyInstallment, pickFriendlyInstallmentCount } from "@/lib/installments";
import { PremiumPerks } from "@/features/plisy/Premium";
import { CRM_PUBLIC_BASE } from "@/app/components/payment-methods";

function useRatyPaypo(): { raty: boolean; paypo: boolean } {
  const [v, setV] = useState({ raty: false, paypo: false });
  useEffect(() => {
    let alive = true;
    crmGetJson<Record<string, unknown>>(`${CRM_PUBLIC_BASE}/site`)
      .then((json) => {
        if (!alive) return;
        const c = (json?.checkout && typeof json.checkout === "object" ? json.checkout : {}) as Record<string, unknown>;
        const routing = (c.payment_routing && typeof c.payment_routing === "object" ? c.payment_routing : {}) as Record<string, { enabled?: boolean }>;
        const p24 = c.p24_enabled === true;
        setV({
          raty: p24 && c.p24_installments_enabled === true,
          paypo: routing.paypo ? routing.paypo.enabled === true : p24 && c.p24_paypo_enabled === true,
        });
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return v;
}

/** Płynne rozsunięcie elementu, który pojawia się dopiero po dociągnięciu danych
 * (raty i PayPo z /site, reguły CAŁY DOM z konfiguracji sklepu, komunikaty przy
 * kodzie). Zamiast skoku treści: wysokość rozwija się od zera, reszta koszyka
 * zjeżdża płynnie (właściciel 9.11.2026). Po animacji zdejmujemy overflow, żeby
 * nie przycinać cieni i podpowiedzi. */
export function Reveal({ children, className = "" }: { children: ReactNode; className?: string }) {
  const [settled, setSettled] = useState(false);
  return (
    <div
      className={`cart-reveal${settled ? " is-settled" : ""}${className ? ` ${className}` : ""}`}
      onAnimationEnd={(e) => {
        if (e.target === e.currentTarget) setSettled(true);
      }}
    >
      <div className="cart-reveal-inner">{children}</div>
    </div>
  );
}

export default function CartTrust({ shippingFree }: { shippingFree: boolean }) {
  return <div className="pm-cart-trust"><PremiumPerks shippingFree={shippingFree} /></div>;
}

export function CartFinance({ amount }: { amount: number }) {
  const options = useRatyPaypo();
  const raty = options.raty && installmentsAvailable(amount);
  const paypo = options.paypo;
  const [choice, setChoice] = useState<"raty" | "paypo">("raty");
  if (!raty && !paypo) return null;
  const active = raty && paypo ? choice : raty ? "raty" : "paypo";
  return (
    <Reveal>
    <section className="checkout-finance" aria-label="Elastyczne płatności">
      <div className="checkout-finance-card" key={active}>
        <img className="checkout-finance-logo" src={active === "raty" ? "/checkout/przelewy24.svg" : "/paypo/paypo-logo.svg"} alt={active === "raty" ? "Przelewy24" : "PayPo"} width={106} height={30} />
        <div className="checkout-finance-copy">
          <strong>{active === "raty" ? "Urządź wnętrze. Zapłać w ratach." : "Zamów dziś. Zapłać do 30 dni."}</strong>
          {active === "raty" ? <InstallmentOffer amount={amount} variant="compact" /> : <p>Wybierz PayPo przy płatności. Decyzję otrzymasz online.</p>}
        </div>
      </div>
      {raty && paypo ? <div className="checkout-finance-switch" aria-label="Karty płatności">
        <button type="button" aria-pressed={active === "raty"} onClick={() => setChoice("raty")}>Raty</button>
        <button type="button" aria-pressed={active === "paypo"} onClick={() => setChoice("paypo")}>PayPo</button>
      </div> : null}
    </section>
    </Reveal>
  );
}

/** Próg, od którego rata pojawia się na samej górze koszyka (właściciel 8.11.2026,
 * audyt: koszyki ≥ 1000 zł to 41 % utkniętych w koszyku i tylko 21 % kupujących). */
export const FINANCE_TOP_THRESHOLD = 1000;

function ratyWord(count: number): string {
  const last = count % 10;
  const lastTwo = count % 100;
  return last >= 2 && last <= 4 && !(lastTwo >= 12 && lastTwo <= 14) ? "raty" : "rat";
}

/** Krótka linia „od X zł/mies.” nad listą pozycji przy dużym koszyku - raty i PayPo
 * są dalej w karcie podsumowania, ale tam klient z dużą sumą często nie dochodzi. */
export function CartFinanceTop({ amount }: { amount: number }) {
  const options = useRatyPaypo();
  if (!Number.isFinite(amount) || amount < FINANCE_TOP_THRESHOLD) return null;
  const raty = options.raty && installmentsAvailable(amount);
  const paypo = options.paypo;
  if (!raty && !paypo) return null;
  const count = raty ? pickFriendlyInstallmentCount(amount, undefined, 40, 120) : 0;
  const monthly = raty ? monthlyInstallment(amount, count) : 0;
  return (
    <Reveal>
    <aside className="checkout-finance-top" aria-label="Płatność w ratach">
      <span className="checkout-finance-top-mark" aria-hidden="true">
        %
      </span>
      <span className="checkout-finance-top-copy">
        {raty ? (
          <>
            Rozłóż na raty: <strong>od {monthly.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł/mies.</strong>{" "}
            <small>({count} {ratyWord(count)}, Przelewy24)</small>
          </>
        ) : null}
        {raty && paypo ? " · " : null}
        {paypo ? (
          <>
            <strong>PayPo:</strong> zamów dziś, zapłać do 30 dni
          </>
        ) : null}
      </span>
    </aside>
    </Reveal>
  );
}

// Baner CAŁY DOM (właściciel 8.11): „Dodaj jeszcze 1 sztukę” prowadzi do produktu z koszyka; gdy w koszyku są różne
// produkty, po kliknięciu pytamy, który klient chce skonfigurować.
export function BundleBanner({ text, produkty = [] }: { text: string; produkty?: LinkProduktu[] }) {
  const [wybor, setWybor] = useState(false);
  const discount = /-(\d+(?:[,.]\d+)?)\s*%/.exec(text)?.[1];
  const dodaj = /^Dodaj jeszcze/i.test(text) && produkty.length > 0;
  const tresc = (
    <>
      <div className="checkout-bundle-art" aria-hidden="true">
        {discount ? <b>−{discount}%</b> : <svg viewBox="0 0 32 32" width="35" height="35" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 15 16 4l13 11M7 13v14h18V13M13 27v-8h6v8" /></svg>}
      </div>
      <div className="checkout-bundle-copy">
        <strong>CAŁY DOM</strong>
        <span>{text}</span>
        {dodaj ? (
          <em className="checkout-bundle-go">
            {produkty.length === 1 ? `Dodaj: ${produkty[0].label.toLowerCase()}` : "Wybierz produkt"} <i aria-hidden="true">→</i>
          </em>
        ) : null}
      </div>
    </>
  );
  if (!dodaj) {
    return (
      <Reveal>
        <aside className="checkout-bundle-banner" aria-label="Promocja Cały Dom">
          {tresc}
        </aside>
      </Reveal>
    );
  }
  if (produkty.length === 1) {
    return (
      <Reveal>
        <Link href={produkty[0].href} className="checkout-bundle-banner is-link">
          {tresc}
        </Link>
      </Reveal>
    );
  }
  return (
    <Reveal>
    <div className="checkout-bundle-wrap">
      <button type="button" className="checkout-bundle-banner is-link" aria-expanded={wybor} onClick={() => setWybor((v) => !v)}>
        {tresc}
      </button>
      {wybor ? (
        <div className="checkout-bundle-choice" role="group" aria-label="Który produkt chcesz skonfigurować?">
          <p>Który produkt chcesz skonfigurować?</p>
          {produkty.map((p) => (
            <Link key={p.slug} href={p.href}>
              {p.label} <i aria-hidden="true">→</i>
            </Link>
          ))}
        </div>
      ) : null}
    </div>
    </Reveal>
  );
}
