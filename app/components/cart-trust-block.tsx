"use client";

// Blok zaufania nad formularzem w koszyku (właściciel, 2026-09-28): przy
// produkcie na wymiar największy strach to "a jak źle zmierzę", a 65% osób
// wchodzących do koszyka wychodziło, nie zaczynając formularza. Same fakty,
// które i tak są na stronie: ocena sprzedawcy z Allegro (snapshot jak na
// landingu moskitier), 5 lat gwarancji, producent od 2015, telefon. Do tego
// prawdziwy licznik osób w sklepie (CRM: shop-public/online_count, ta sama
// definicja co "osoby online" na dashboardzie) - pokazywany od 2 osób,
// żeby "1 osoba konfiguruje teraz" nie brzmiało pusto.
import { useEffect, useState } from "react";
import { CRM_PUBLIC_BASE } from "@/app/components/payment-methods";
import { crmGetJson } from "@/lib/crm-get";
import { ALLEGRO_RATING_SNAPSHOTS } from "@/lib/landing-snapshot";

const PHONE_DISPLAY = "+48 790 215 251";
const PHONE_HREF = "tel:+48790215251";
const ONLINE_MIN_TO_SHOW = 2;
const ONLINE_REFRESH_MS = 60_000;

function plural(n: number, one: string, few: string, many: string): string {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return few;
  return many;
}

export default function CartTrustBlock({ onCall }: { onCall?: () => void }) {
  const rating = ALLEGRO_RATING_SNAPSHOTS["moskitiery-ramkowe"];
  const [online, setOnline] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      crmGetJson<{ ok?: boolean; online?: number }>(`${CRM_PUBLIC_BASE}/online_count`)
        .then((json) => {
          if (cancelled) return;
          const value = json && json.ok && typeof json.online === "number" ? json.online : null;
          setOnline(value);
        })
        .catch(() => {
          if (!cancelled) setOnline(null);
        });
    };
    load();
    const id = window.setInterval(load, ONLINE_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const score = rating && rating.averageScore > 0 ? rating.averageScore.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
  const responses = rating && rating.totalResponses > 0 ? rating.totalResponses.toLocaleString("pl-PL") : "";
  const showOnline = online !== null && online >= ONLINE_MIN_TO_SHOW;

  return (
    <section className="cart-trust" aria-label="Dlaczego warto zamówić">
      <ul className="cart-trust-list">
        {score ? (
          <li>
            <span className="cart-trust-icon" aria-hidden="true">
              ★
            </span>
            <span>
              <strong>{score}/5</strong> {responses ? `· ${responses} opinii kupujących na Allegro` : "ocena kupujących na Allegro"}
            </span>
          </li>
        ) : null}
        <li>
          <span className="cart-trust-icon" aria-hidden="true">
            ✓
          </span>
          <span>
            <strong>5 lat gwarancji</strong> · producent osłon okiennych na wymiar od 2015 roku
          </span>
        </li>
        <li>
          <span className="cart-trust-icon" aria-hidden="true">
            ☎
          </span>
          <span>
            Nie jesteś pewien wymiaru? Zadzwoń, sprawdzimy przed produkcją:{" "}
            <a href={PHONE_HREF} className="cart-trust-phone" onClick={onCall}>
              {PHONE_DISPLAY}
            </a>
          </span>
        </li>
        {showOnline ? (
          <li className="cart-trust-live">
            <span className="cart-trust-dot" aria-hidden="true" />
            <span>
              <strong>{online}</strong> {plural(online as number, "osoba konfiguruje", "osoby konfigurują", "osób konfiguruje")} teraz
            </span>
          </li>
        ) : null}
      </ul>
    </section>
  );
}
