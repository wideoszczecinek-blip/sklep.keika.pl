"use client";

// Ostatnie opinie kupujących plisy - karuzela pod opisem na pierwszym ekranie (właściciel 21.11.2026: „dostajemy
// opinie pozytywne w związku z kampanią - publikować jako ostatnie opinie z datą, imieniem, »zakup z dnia«, jako
// karuzela, dość wysoko, żeby pokazać social proof”; jego kolejność strony z 2.11: co to jest, opis, mały dowód
// społeczny, zbicie obiekcji).
//
// Dane: CRM shop-public/latest_reviews.php (pobierane na serwerze w app/plisy/page.tsx, bez migania). Tylko opinie
// zweryfikowane zakupem w sklepie (link z prośby o opinię po doręczeniu), 4–5★, ze zgodą klienta na publikację -
// zasady w CRM core/lib/shop_customer_reviews.php. Mniej niż 3 opinie = sekcji nie ma.
import { useEffect, useRef, useState } from "react";

export type OstatniaOpinia = {
  id: number;
  imie: string;
  miasto: string;
  gwiazdki: number;
  tekst: string;
  zakup_dnia: string | null;
  zakup: string;
  opinia_dnia: string;
};

const MIN_OPINII = 3;
const AUTO_MS = 6500;

function dataPl(iso: string | null): string {
  if (!iso || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return "";
  const [r, m, d] = iso.slice(0, 10).split("-");
  return `${d}.${m}.${r}`;
}

export function OstatnieOpinie({ opinie }: { opinie: OstatniaOpinia[] | null | undefined }) {
  const lista = (opinie || []).filter((o) => o && o.tekst).slice(0, 10);
  const tor = useRef<HTMLDivElement>(null);
  const [aktywna, setAktywna] = useState(0);
  const [reczna, setReczna] = useState(false);
  const [otwarta, setOtwarta] = useState<number | null>(null);

  const przewin = (i: number) => {
    const el = tor.current;
    const karta = el?.children[i] as HTMLElement | undefined;
    if (!el || !karta) return;
    el.scrollTo({ left: karta.offsetLeft - el.offsetLeft, behavior: "smooth" });
  };

  // Sama się przesuwa, dopóki klient jej nie dotknie (wtedy przewija sam) i gdy nie prosi o mniej ruchu.
  useEffect(() => {
    if (reczna || lista.length < MIN_OPINII) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => {
      if (document.hidden) return;
      setAktywna((a) => {
        const n = (a + 1) % lista.length;
        przewin(n);
        return n;
      });
    }, AUTO_MS);
    return () => window.clearInterval(id);
  }, [reczna, lista.length]);

  if (lista.length < MIN_OPINII) return null;

  const naPrzewiniecie = () => {
    const el = tor.current;
    if (!el || !el.children.length) return;
    const szer = (el.children[0] as HTMLElement).offsetWidth || 1;
    setAktywna(Math.max(0, Math.min(lista.length - 1, Math.round(el.scrollLeft / szer))));
  };

  return (
    <section className="oo" aria-label="Ostatnie opinie kupujących plisy">
      <p className="oo-tytul">
        <span className="pm-stars" aria-hidden="true">★★★★★</span> Ostatnie opinie kupujących
      </p>
      <div
        className="oo-tor"
        ref={tor}
        onScroll={naPrzewiniecie}
        onPointerDown={() => setReczna(true)}
        onTouchStart={() => setReczna(true)}
      >
        {lista.map((o, i) => {
          const zakupDnia = dataPl(o.zakup_dnia);
          return (
            <figure
              key={o.id}
              className={`oo-karta${otwarta === i ? " is-open" : ""}`}
              onClick={() => {
                setReczna(true);
                setOtwarta(otwarta === i ? null : i);
              }}
            >
              <div className="oo-gwiazdki" aria-label={`${o.gwiazdki} na 5 gwiazdek`}>
                {"★".repeat(o.gwiazdki)}
                <span className="oo-gwiazdki-puste">{"★".repeat(Math.max(0, 5 - o.gwiazdki))}</span>
              </div>
              <blockquote className="oo-tekst">„{o.tekst}”</blockquote>
              <figcaption className="oo-podpis">
                <b>
                  {o.imie}
                  {o.miasto ? `, ${o.miasto}` : ""}
                </b>
                <span className="oo-zweryfikowany">
                  ✓ Zweryfikowany zakup{zakupDnia ? ` z dnia ${zakupDnia}` : ""}
                </span>
                {o.zakup ? <span className="oo-co">Kupiono: {o.zakup}</span> : null}
              </figcaption>
            </figure>
          );
        })}
      </div>
      <div className="oo-kropki" role="tablist" aria-label="Wybierz opinię">
        {lista.map((o, i) => (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={i === aktywna}
            aria-label={`Opinia ${i + 1} z ${lista.length}`}
            className={`oo-kropka${i === aktywna ? " is-active" : ""}`}
            onClick={() => {
              setReczna(true);
              setAktywna(i);
              przewin(i);
            }}
          />
        ))}
      </div>
    </section>
  );
}
