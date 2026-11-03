"use client";

// Strona plis, wersja 3.11 (właściciel: „przeanalizuj propozycję GPT – obecnie jest słabo”, „ma być jeden, bez testów
// i porządny”; plan Agencji 3.11). Cel: więcej osób wpisuje wymiary (ruch z Meta: ok. 2 min na stronie, wymiary
// wpisuje 3,7 %). Pierwszy ekran: korzyść, jedno zdanie, cena „od” z cennika, 4 znaczki, od razu pola wymiarów
// (QuickPrice v2) i ocena. Niżej krótko: Dlaczego KEIKA, bezpieczny zakup w jasnej formie, końcowy przycisk.
// Fakty tylko z landing-content.ts, company-legal.ts i CRM (opinie, zamówienia 2026, ustawienia płatności).
import { useEffect, useState } from "react";
import { trackShopStep } from "@/lib/track-step";
import { crmGetJson } from "@/lib/crm-get";
import { COMPANY_LEGAL, paymentOperatorsLabel, type PaymentFlags } from "@/lib/company-legal";
import { CRM_PUBLIC_BASE } from "@/app/components/payment-methods";
import { useCompanyRating } from "./Reviews";
import { opinieLabel } from "./LandingV2";
import { dzienWysylki } from "./Premium";

const zl = (v: number) => `${v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;

/** Liczba zamówień we wszystkich kanałach w 2026 r. (CRM: 7727 przy 2.11) - zaokrąglona w dół, jak w LejekDowod. */
const ZAMOWIEN_2026 = "ponad 7 000";

/** Korzyść, jedno zdanie, cena „od” (z serwera, bez migania) i 4 znaczki - nad polami wymiarów. */
export function PlisyPierwszyEkran({ cenaOd }: { cenaOd: number | null }) {
  return (
    <div className="pe-gora">
      <p className="pe-naglowek">Prywatność, kiedy chcesz. Światło, kiedy potrzebujesz.</p>
      <p className="pe-zdanie">Zasłonisz dół, górę albo środek szyby – sąsiad nie zajrzy, a w pokoju dalej jest jasno.</p>
      <p className="pe-cena">
        {cenaOd !== null ? (
          <>
            od <b>{zl(cenaOd)}</b> · plisa 50 × 110 cm
          </>
        ) : (
          <span className="pe-cena-szkielet" aria-hidden="true" />
        )}
      </p>
      <ul className="pe-znaczki">
        <li>Montaż bez wiercenia</li>
        <li>5 lat gwarancji</li>
        <li>Dostawa 0 zł</li>
        <li>30 dni na zwrot</li>
      </ul>
    </div>
  );
}

/** Jedna linia oceny pod polami wymiarów. */
export function LejekOcena({ onOpinie }: { onOpinie: () => void }) {
  const rating = useCompanyRating();
  if (!rating) return <p className="pe-ocena pe-ocena--pusta" aria-hidden="true" />;
  const ocena = (Math.round(rating.average * 10) / 10).toLocaleString("pl-PL", { minimumFractionDigits: 1 });
  return (
    <button type="button" className="pe-ocena" onClick={onOpinie}>
      <span className="pm-stars" aria-hidden="true">★★★★★</span> <b>{ocena}</b> · {opinieLabel(rating.total)} · {ZAMOWIEN_2026} zamówień w 2026 r.
    </button>
  );
}

const DLACZEGO: [string, string][] = [
  ["Ty decydujesz o świetle", "zasłaniasz górę, dół albo środek szyby, a okno otwierasz jak dawniej – plisa jedzie razem ze skrzydłem"],
  ["Montaż w ok. 15 minut", "bez wiercenia i bez śladów albo przykręcana do listwy – instrukcja i film w komplecie"],
  ["150 tkanin w 5 kolekcjach", "od delikatnych, przepuszczających światło po pełne zaciemnienie; 10 kolorów listew"],
  [`Produkujemy sami, w Polsce, od ${COMPANY_LEGAL.producingSince}`, "każdą plisę robimy na wymiar Twojego okna, co do milimetra"],
];

export function LejekDlaczego() {
  return (
    <section className="pm-section" aria-labelledby="pe-dlaczego-t">
      <p className="pm-eyebrow">Dlaczego KEIKA</p>
      <h2 id="pe-dlaczego-t" className="pm-title">Plisa, która pasuje do Twojego okna i życia</h2>
      <ul className="pe-dlaczego">
        {DLACZEGO.map(([b, s]) => (
          <li key={b}>
            <b>{b}</b>
            <span>{s}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Operatorzy płatności z ustawień sklepu w CRM - ten sam opis co w stopce. */
function useOperatorzy(): string {
  const [flags, setFlags] = useState<PaymentFlags | null>(null);
  useEffect(() => {
    let alive = true;
    crmGetJson<Record<string, unknown>>(`${CRM_PUBLIC_BASE}/site`)
      .then((json) => {
        const c = (json?.checkout && typeof json.checkout === "object" ? json.checkout : null) as PaymentFlags | null;
        if (alive && c) setFlags(c);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return paymentOperatorsLabel(flags);
}

/** Bezpieczny zakup - jasno i krótko, szczegóły po rozwinięciu (zamiast ciemnego bloku 5 kart). */
export function LejekBezpiecznie({ onPomiar }: { onPomiar: () => void }) {
  const c = COMPANY_LEGAL;
  const operatorzy = useOperatorzy();
  const d = dzienWysylki();
  const kiedy = ["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"][d.getDay()];
  const punkty: { id: string; tytul: string; tresc: React.ReactNode }[] = [
    {
      id: "zwrot",
      tytul: "30 dni na zwrot – także plis na wymiar",
      tresc: "Plis robionych na wymiar zwykle nie da się oddać. U nas tak: odsyłasz w 30 dni bez podania przyczyny, oddajemy pieniądze.",
    },
    { id: "gwarancja", tytul: "5 lat gwarancji", tresc: `Produkujemy sami, od ${c.producingSince} roku – dlatego ręczymy za każdą plisę przez 5 lat.` },
    {
      id: "pomiar",
      tytul: "Pomyłka w pomiarze? Zmienimy wymiar bez kosztów",
      tresc: (
        <>
          Napisz zaraz po zamówieniu – zanim plisa trafi do produkcji, zmienimy wymiar bez kosztów.{" "}
          <button type="button" className="pm-link" onClick={onPomiar}>Jak zmierzyć w 2 minuty →</button>
        </>
      ),
    },
    {
      id: "firma",
      tytul: "Prawdziwa firma, bezpieczne płatności",
      tresc: (
        <>
          {c.legalName}, {c.street}, {c.postalCode} {c.city}, NIP {c.nip}. Płatności obsługują {operatorzy} – BLIK, karta, raty, PayPo, przelew albo przy odbiorze.{" "}
          <a href={c.phoneHref} className="pm-link" onClick={() => trackShopStep("call_click", "plisy", { source: "bezpieczny_zakup" })}>{c.phone} · {c.hours}</a>
        </>
      ),
    },
    {
      id: "wysylka",
      tytul: `Wyślemy najpóźniej ${kiedy}, ${d.toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}`,
      tresc: "7 dni roboczych produkcji u nas w Polsce, potem kurier w 24 h. Dostawa 0 zł.",
    },
  ];
  return (
    <section className="pm-section" aria-labelledby="pe-bezp-t">
      <p className="pm-eyebrow">Bezpieczny zakup</p>
      <h2 id="pe-bezp-t" className="pm-title">Kupujesz bez ryzyka</h2>
      <div className="pe-bezp">
        {punkty.map((p) => (
          <details key={p.id} onToggle={(e) => e.currentTarget.open && trackShopStep("bezpieczny_zakup_open", "plisy", { punkt: p.id })}>
            <summary>
              <span className="pe-bezp-ok" aria-hidden="true">✓</span>
              {p.tytul}
            </summary>
            <p>{p.tresc}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

/** Końcowy przycisk - wraca do pól wymiarów na górze. */
export function LejekKoniec({ onCena }: { onCena: () => void }) {
  return (
    <div className="pe-koniec">
      <p>Znasz już wymiar okna? Cenę zobaczysz od razu – bez rejestracji i bez zobowiązań.</p>
      <button
        type="button"
        className="pm-btn"
        onClick={() => {
          trackShopStep("lejek_koniec_cena", "plisy", {});
          onCena();
        }}
      >
        Sprawdź cenę swojej plisy
      </button>
    </div>
  );
}
