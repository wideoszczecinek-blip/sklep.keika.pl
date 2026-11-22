"use client";

// Strona plis dachowych, wersja definitywna 22.11.2026 (właściciel: „na tej samej zasadzie opracuj z GPT landing plis
// dachowych – dogłębna analiza, wnioski i zmiany”). Wzór: /plisy z 22.11 (features/plisy/PierwszyEkran.tsx).
// Dane 1.10–22.11: z reklam Meta tylko 14 % w ogóle działa na stronie, 3 % koszyk; ruch świadomy (ze strony głównej)
// 76 % / 18 %. Allegro: 90 % sprzedanych plis dachowych to zaciemniające/termiczne – stąd korzyść poddasza na górze
// (sypialnia, poranne słońce, upał), nie konstrukcja. Cena dopiero po wyborze tkaniny (zasada właściciela 3.11).
// Teksty uzgodnione z ChatGPT (czat „Audyt plis dachowych”, 22.11). Fakty tylko z landing-content.ts i company-legal.ts.
import { trackShopStep } from "@/lib/track-step";
import { COMPANY_LEGAL } from "@/lib/company-legal";
import { dzienWysylki } from "@/features/plisy/Premium";
import { LejekOcena } from "@/features/plisy/PierwszyEkran";
import LiveConfiguring from "@/app/components/live-configuring";
import { DNI_PRODUKCJI } from "@/features/dachowe/lejek-tresci";
import { PD_PRODUCT_SLUG } from "./shared";

export const PD_LEAD = "Zaciemnij sypialnię przed porannym słońcem, a latem ogranicz nagrzewanie poddasza.";
export const PD_WYBOR =
  "Plisę przesuwasz od góry i od dołu, a boczne prowadnice trzymają ją przy szybie, nawet przy uchylonym oknie. Dobierzemy ją po modelu okna, zwykle bez mierzenia.";
export const PD_CTA = "Dobierz plisę i sprawdź cenę";

/** Pierwszy ekran pod H1: korzyść, jak działa, licznik, ocena, jeden przycisk do wyceny, trzy fakty. */
export function PdPierwszyEkran({ onCena, onJakDziala, onOpinie }: { onCena: () => void; onJakDziala: () => void; onOpinie: () => void }) {
  return (
    <div className="pe-gora pe-gora--v3 pd-gora">
      <p className="pe-lead">{PD_LEAD}</p>
      <p className="pe-wybor">{PD_WYBOR}</p>
      <LiveConfiguring />
      <LejekOcena onOpinie={onOpinie} />
      <div className="pe-cta">
        <button
          type="button"
          className="pm-btn pe-cta-btn"
          onClick={() => {
            trackShopStep("hero_cta", PD_PRODUCT_SLUG, { cel: "wycena" });
            onCena();
          }}
        >
          {PD_CTA}
        </button>
        <p className="pe-cta-pod">
          <span>Dostawa 0 zł</span>
          <span aria-hidden="true">·</span>
          <button
            type="button"
            className="pe-cta-link"
            onClick={() => {
              trackShopStep("hero_cta", PD_PRODUCT_SLUG, { cel: "jak_dziala" });
              onJakDziala();
            }}
          >
            Zobacz, jak działa ↓
          </button>
        </p>
      </div>
      <ul className="pe-fakty" aria-label="Bezpieczny zakup">
        <li>Jakość poparta 5-letnią gwarancją</li>
        <li>
          <a href={COMPANY_LEGAL.phoneHref} className="pe-fakty-tel" onClick={() => trackShopStep("call_click", PD_PRODUCT_SLUG, { source: "hero_fakt" })}>
            Pomoc telefoniczna 8–21, codziennie
          </a>
        </li>
        <li>30 dni na zwrot, także na wymiar</li>
      </ul>
    </div>
  );
}

/** Kupujesz bez ryzyka - krótko, szczegóły po rozwinięciu (wzór LejekBezpiecznie z /plisy). */
export function PdBezpiecznie({ onPomiar }: { onPomiar: () => void }) {
  const c = COMPANY_LEGAL;
  const d = dzienWysylki(new Date(), DNI_PRODUKCJI[PD_PRODUCT_SLUG]);
  const kiedy = ["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"][d.getDay()];
  const punkty: { id: string; tytul: string; tresc: React.ReactNode }[] = [
    {
      id: "dobor",
      tytul: "Dobierzemy plisę po modelu okna",
      tresc: (
        <>
          Wpisz symbol z tabliczki znamionowej (otwórz skrzydło – jest na jego górnej lub bocznej krawędzi) albo wgraj jej zdjęcie, a wymiar plisy dobierzemy sami.
          Zdjęcie zostaje przy zamówieniu, więc dobór sprawdzimy jeszcze raz przed produkcją.{" "}
          <button type="button" className="pm-link" onClick={onPomiar}>Gdzie jest tabliczka i jak zmierzyć okno spoza listy →</button>
        </>
      ),
    },
    {
      id: "pomylka",
      tytul: "Pomyłka przy wyborze okna? Poprawimy bez kosztów",
      tresc: "Napisz zaraz po zamówieniu – zanim plisa trafi do produkcji, zmienimy model albo wymiar bez kosztów.",
    },
    {
      id: "zwrot",
      tytul: "30 dni na zwrot – także plisy na wymiar",
      tresc: "Rzeczy robionych na wymiar zwykle nie da się oddać. U nas tak: odsyłasz w 30 dni bez podania przyczyny, oddajemy pieniądze.",
    },
    { id: "gwarancja", tytul: "5 lat gwarancji", tresc: `Produkujemy sami, w Polsce, od ${c.producingSince} roku – dlatego ręczymy za każdą plisę przez 5 lat.` },
    {
      id: "firma",
      tytul: "Prawdziwa firma, bezpieczne płatności",
      tresc: (
        <>
          {c.legalName}, {c.street}, {c.postalCode} {c.city}, NIP {c.nip}. Płacisz przez Przelewy24, PayNow lub Stripe – BLIK, kartą, w ratach, PayPo albo przy odbiorze.{" "}
          <a href={c.phoneHref} className="pm-link" onClick={() => trackShopStep("call_click", PD_PRODUCT_SLUG, { source: "bezpieczny_zakup" })}>{c.phone}</a>
        </>
      ),
    },
    {
      id: "wysylka",
      tytul: `Wyślemy najpóźniej ${kiedy}, ${d.toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}`,
      tresc: `${DNI_PRODUKCJI[PD_PRODUCT_SLUG]} dni roboczych produkcji u nas w Polsce, potem kurier w 24 h. Dostawa 0 zł.`,
    },
  ];
  return (
    <section className="pm-section" aria-labelledby="pd-bezp-t">
      <p className="pm-eyebrow">Bezpieczny zakup</p>
      <h2 id="pd-bezp-t" className="pm-title">Kupujesz bez ryzyka</h2>
      <div className="pe-bezp">
        {punkty.map((p) => (
          <details key={p.id} onToggle={(e) => e.currentTarget.open && trackShopStep("bezpieczny_zakup_open", PD_PRODUCT_SLUG, { punkt: p.id })}>
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

/** Montaż - widoczny tekst zamiast zwiniętej zakładki (GPT 22.11: jawnie, że prowadnice się przykręca). */
export function PdMontaz({ onInstrukcja }: { onInstrukcja: () => void }) {
  return (
    <section className="pm-section" aria-labelledby="pd-montaz-t">
      <p className="pm-eyebrow">Montaż</p>
      <h2 id="pd-montaz-t" className="pm-title">Zamontujesz samodzielnie w 10–15 minut</h2>
      <p className="pm-lead">
        Przykręcasz prowadnice do skrzydła okna i wsuwasz w nie belki plisy. Wkręty i obrazkową instrukcję dostajesz w paczce – wystarczy wkrętarka albo
        śrubokręt PZ1. Plisa otwiera się razem z oknem.
      </p>
      <button
        type="button"
        className="pm-link"
        onClick={() => {
          trackShopStep("lejek_montaz_instrukcja", PD_PRODUCT_SLUG, {});
          onInstrukcja();
        }}
      >
        Instrukcja montażu i pomiaru okna spoza listy →
      </button>
    </section>
  );
}

/** Końcowy przycisk - wraca do wyceny. */
export function PdKoniec({ onCena }: { onCena: () => void }) {
  return (
    <div className="pe-koniec">
      <p>Znasz model swojego okna? Wybierz tkaninę i zobacz cenę – bez rejestracji i bez zobowiązań.</p>
      <button
        type="button"
        className="pm-btn"
        onClick={() => {
          trackShopStep("lejek_koniec_cena", PD_PRODUCT_SLUG, {});
          onCena();
        }}
      >
        {PD_CTA}
      </button>
    </div>
  );
}
