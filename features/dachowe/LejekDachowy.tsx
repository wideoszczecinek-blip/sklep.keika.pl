"use client";

// Strony plis i rolet dachowych jako lejek, wzorem /plisy (właściciel 2.11: „podobnie jak zmieniliśmy stronę plis, teraz
// zmienić stronę plis dachowych i rolet dachowych”; „klient z reklamy, tylko po konfiguratorze i w koszyk, kompletnie
// nie zna produktu”). Kolejność: co to jest → dowód społeczny → kupujesz bez ryzyka (przede wszystkim dobór do modelu
// okna po tabliczce znamionowej) → jakość → ceny typowych okien z CAŁY DOM → pomiar → opinie → FAQ od obiekcji.
// Bez wizualizatora (wersja dachowa jeszcze nie gotowa). Fakty tylko z landing-content.ts obu produktów,
// company-legal.ts i agent-catalog.ts (produkcja: rolety dachowe 5, plisy dachowe 7 dni roboczych). Marki okien
// wyłącznie jako przeznaczenie („do okna VELUX MK06”), nigdy jako nazwa produktu. Ceny z cenników konfiguratora.
import { trackShopStep } from "@/lib/track-step";
import { COMPANY_LEGAL } from "@/lib/company-legal";
import { useBundleDiscountRules } from "@/lib/bundle-discount";
import { QTY_PROMO } from "@/lib/promo";
import { dzienWysylki } from "@/features/plisy/Premium";
import { searchRoofWindowLibrary, resolveRoofWindowDimensions, type RoofWindowLibraryItem } from "@/features/rolety-dachowe/roof-window-library";

export type ProduktDachowy = "plisy-dachowe" | "rolety-dachowe";

const DNI_PRODUKCJI: Record<ProduktDachowy, number> = { "plisy-dachowe": 7, "rolety-dachowe": 5 };
const NAZWA: Record<ProduktDachowy, { jedna: string; biernik: string; dopelniacz: string }> = {
  "plisy-dachowe": { jedna: "plisa", biernik: "plisę", dopelniacz: "plisy" },
  "rolety-dachowe": { jedna: "roleta", biernik: "roletę", dopelniacz: "rolety" },
};

const zl2 = (v: number) => `${v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
const modeli = (n: number) => (n >= 420 ? `ponad ${Math.floor(n / 10) * 10}` : "ponad 420");

const Ikona = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const IKONY = {
  tabliczka: "M4 6h16v12H4z M7 10h6 M7 14h10",
  zwrot: "M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4",
  miara: "M3 17l14-14 4 4L7 21H3v-4z M7 13l2 2 M10 10l2 2 M13 7l2 2",
  firma: "M3 21V8l9-5 9 5v13 M9 21v-6h6v6",
  zegar: "M12 7v5l3 2 M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18",
};

// ---------------------------------------------------------------- co to jest

const OPIS: Record<ProduktDachowy, { lead: string; tekst: string; cechy: [string, string][] }> = {
  "plisy-dachowe": {
    lead: "Plisa, która na skosie trzyma się szyby.",
    tekst:
      "Dwie aluminiowe belki pracują w bocznych prowadnicach, więc tkanina zostaje przy szybie przy każdym nachyleniu dachu i przy uchylonym oknie. Każdą belkę ustawiasz osobno – zasłonisz całe okno, samą górę, dół albo pas na środku. Robimy ją pod model Twojego okna dachowego: wystarczy symbol z tabliczki znamionowej.",
    cechy: [
      ["Dobrana do modelu okna", "{modeli} modeli w bibliotece, model odczytamy też ze zdjęcia tabliczki"],
      ["Nie wybrzusza się na skosie", "aluminiowe prowadnice boczne, bez prześwitów po bokach"],
      ["Zasłaniasz dowolny fragment", "górna i dolna belka niezależnie – zostaje tam, gdzie ją puścisz"],
      ["150 tkanin w 5 kolekcjach", "od rozpraszających światło po zaciemniające DUO TERMO z powłoką termiczną"],
      ["3 kolory osprzętu", "biały, anoda (szary) albo sosna – do ramy Twojego okna"],
      ["Montaż w 10–15 minut", "śrubokręt PZ1, wszystkie elementy i instrukcja w paczce"],
    ],
  },
  "rolety-dachowe": {
    lead: "Ciemno w sypialni na poddaszu – albo miękkie światło. W kasecie, nie na haczykach.",
    tekst:
      "Tkanina chowa się w aluminiowej kasecie, jest stale napięta sprężyną i prowadzona w bocznych prowadnicach, a hamulec w belce zatrzymuje ją na dowolnej wysokości. Bez łańcuszka i bez wiszących sznurków. Robimy ją pod model Twojego okna dachowego: wystarczy symbol z tabliczki znamionowej.",
    cechy: [
      ["Dobrana do modelu okna", "{modeli} modeli w bibliotece, model odczytamy też ze zdjęcia tabliczki"],
      ["TERMO: zaciemnia i chroni przed upałem", "blackout ze srebrną warstwą od strony szyby, 19 kolorów"],
      ["DEKO: rozprasza światło", "54 kolory – pokój zostaje jasny, a ostre słońce znika"],
      ["Zatrzymasz ją w dowolnym miejscu", "hamulec MULTISTOP w dolnej belce"],
      ["Aluminium, nie plastik", "kaseta, prowadnice i belka w 3 kolorach: biały, anoda, jasna sosna"],
      ["Komplet do montażu", "wkręty i instrukcja w paczce, montaż do skrzydła bez specjalistycznych narzędzi"],
    ],
  },
};

/** Opis sprzedażowy na górze: co to jest, korzyści i cena przykładowego okna. */
export function DachOpis({ produkt, liczbaModeli, przyklad, onWycen }: {
  produkt: ProduktDachowy;
  liczbaModeli: number;
  przyklad: { okno: string; cena: number } | null;
  onWycen: () => void;
}) {
  const o = OPIS[produkt];
  return (
    <div className="lj-opis dach-opis">
      <p className="lj-opis-lead">{o.lead}</p>
      <p>{o.tekst}</p>
      <ul className="lj-cechy">
        {o.cechy.map(([b, s]) => (
          <li key={b}>
            <b>{b}</b> – {s.replace("{modeli}", modeli(liczbaModeli))}
          </li>
        ))}
      </ul>
      {przyklad ? (
        <p className="lj-cena">
          {przyklad.okno.replace(/^do/, "Do")}: <b>od {zl2(przyklad.cena)}</b>
          <span> · cenę dla swojego okna zobaczysz po wpisaniu modelu</span>
        </p>
      ) : null}
      <button
        type="button"
        className="pm-btn dach-wycen"
        onClick={() => {
          trackShopStep("lejek_dach_wycen", produkt, {});
          onWycen();
        }}
      >
        Sprawdź cenę dla swojego okna
      </button>
    </div>
  );
}

// ---------------------------------------------------------------- kupujesz bez ryzyka

/** Zbicie obiekcji: dobór do modelu okna, zwrot, gwarancja, pomyłka przy wyborze, firma i płatności, termin. */
export function DachBezRyzyka({ produkt, liczbaModeli, onPomiar }: { produkt: ProduktDachowy; liczbaModeli: number; onPomiar: () => void }) {
  const c = COMPANY_LEGAL;
  const n = NAZWA[produkt];
  const dni = DNI_PRODUKCJI[produkt];
  const d = dzienWysylki(new Date(), dni);
  const kiedy = ["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"][d.getDay()];
  return (
    <section className="lj-ryzyko dach-ryzyko" aria-labelledby="dach-ryzyko-t">
      <h2 id="dach-ryzyko-t">Kupujesz bez ryzyka</h2>
      <div className="lj-ryzyko-grid">
        <div className="lj-r is-main">
          <Ikona d={IKONY.tabliczka} />
          <b>Dobierzemy {n.biernik} do Twojego okna – po tabliczce znamionowej</b>
          <span>
            Nie musisz nic mierzyć. Otwórz skrzydło i odczytaj symbol z tabliczki na jego górnej lub bocznej krawędzi, np. VELUX GGL MK06 albo FAKRO FTP-V U3 78×118.
            Wpisz go albo wgraj zdjęcie tabliczki – model odczytamy automatycznie z biblioteki {modeli(liczbaModeli)} okien. Zdjęcie zostaje przy zamówieniu, więc dobór możemy jeszcze raz sprawdzić przed produkcją.
          </span>
          <button type="button" className="pm-link" onClick={onPomiar}>Gdzie jest tabliczka i jak zmierzyć okno spoza listy →</button>
        </div>
        <div className="lj-r">
          <Ikona d={IKONY.zwrot} />
          <b>30 dni na zwrot – także na wymiar</b>
          <span>Odsyłasz w 30 dni bez podania przyczyny, oddajemy pieniądze.</span>
        </div>
        <div className="lj-r">
          <span className="lj-r-pieczec" aria-hidden="true">5</span>
          <b>5 lat gwarancji</b>
          <span>Produkujemy sami, w Polsce, od {c.producingSince} roku – dlatego ręczymy za każdą {n.biernik} przez 5 lat.</span>
        </div>
        <div className="lj-r">
          <Ikona d={IKONY.miara} />
          <b>Pomyłka przy wyborze okna? Poprawimy</b>
          <span>Napisz zaraz po zamówieniu – zanim {n.jedna} trafi do produkcji, zmienimy model albo wymiar bez kosztów.</span>
        </div>
        <div className="lj-r">
          <Ikona d={IKONY.firma} />
          <b>Prawdziwa firma, bezpieczna płatność</b>
          <span>{c.legalName}, {c.street}, {c.postalCode} {c.city}, NIP {c.nip}. Płacisz przez Przelewy24, PayNow lub Stripe – BLIK, kartą, w ratach, PayPo albo przy odbiorze.</span>
          <a href={c.phoneHref} className="pm-link" onClick={() => trackShopStep("call_click", produkt, { source: "bez_ryzyka" })}>{c.phone} · {c.hours}</a>
        </div>
        <div className="lj-r">
          <Ikona d={IKONY.zegar} />
          <b>Wyślemy najpóźniej {kiedy}, {d.toLocaleDateString("pl-PL", { day: "numeric", month: "long" })}</b>
          <span>{dni} dni roboczych produkcji u nas w Polsce, potem kurier w 24 h. Darmowa dostawa od 79 zł.</span>
        </div>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- ceny typowych okien + CAŁY DOM

/** Najczęstsze okna dachowe: [wyszukiwanie w bibliotece, napis „do okna …”]. */
const TYPOWE_OKNA: [string, string][] = [
  ["Velux MK04", "do okna VELUX MK04 (78 × 98 cm)"],
  ["Velux MK06", "do okna VELUX MK06 (78 × 118 cm)"],
  ["Fakro 78x118", "do okna FAKRO 78 × 118 cm"],
  ["Velux MK08", "do okna VELUX MK08 (78 × 140 cm)"],
  ["Velux FK06", "do okna VELUX FK06 (66 × 118 cm)"],
];

export type OknoZCena = { item: RoofWindowLibraryItem; okno: string; cena: number };

/** Typowe okna z ceną z cennika (najtańsza konfiguracja). Pusta lista, gdy biblioteka albo cennik jeszcze się ładują. */
export function typoweOkna(library: RoofWindowLibraryItem[], cena: (widthMm: number, heightMm: number) => number | null): OknoZCena[] {
  if (!library.length) return [];
  const out: OknoZCena[] = [];
  for (const [szukaj, okno] of TYPOWE_OKNA) {
    const item = searchRoofWindowLibrary(library, szukaj)[0]?.item;
    if (!item) continue;
    const { widthMm, heightMm } = resolveRoofWindowDimensions(item);
    const c = widthMm && heightMm ? cena(widthMm, heightMm) : null;
    if (c !== null) out.push({ item, okno, cena: c });
  }
  return out;
}

export function DachCeny({ produkt, okna, onOkno }: { produkt: ProduktDachowy; okna: OknoZCena[]; onOkno: (item: RoofWindowLibraryItem) => void }) {
  const reguly = useBundleDiscountRules();
  const progi = (reguly[produkt]?.tiers?.length ? reguly[produkt].tiers : QTY_PROMO.tiers).map((t) => ({ fromQty: t.fromQty, percent: t.percent }));
  if (okna.length < 3) return null;
  const n = NAZWA[produkt];
  const typowe = okna.find((o) => /MK06/.test(o.okno)) || okna[0];
  const dwa = typowe.cena * 2;
  const trzy = typowe.cena * 3;
  const p2 = progi.find((p) => p.fromQty === 2)?.percent ?? 0;
  const p3 = [...progi].sort((a, b) => b.fromQty - a.fromQty).find((p) => p.fromQty <= 3)?.percent ?? 0;
  const poRabacie = (kwota: number, proc: number) => Math.round(kwota * (1 - proc / 100) * 100) / 100;
  return (
    <section className="pm-section lj-ceny" aria-labelledby="dach-ceny-t">
      <p className="pm-eyebrow">Cena</p>
      <h2 id="dach-ceny-t" className="pm-title">Ile kosztuje {n.jedna} do najczęstszych okien dachowych</h2>
      <p className="pm-lead">
        {produkt === "rolety-dachowe" ? "Tkanina DEKO, biała kaseta" : "Kolekcja Klasyczne, biały osprzęt"} – ceny z konfiguratora. Kliknij okno, żeby od razu wycenić je w konfiguratorze.
      </p>
      <div className="lj-ceny-grid">
        {okna.map((o) => (
          <button
            key={o.okno}
            type="button"
            className="lj-ceny-row"
            onClick={() => {
              trackShopStep("lejek_cena_typowa", produkt, { okno: o.okno });
              onOkno(o.item);
            }}
          >
            <span>
              <b>{o.okno.replace(/^do okna /, "Do okna ")}</b>
            </span>
            <strong>od {zl2(o.cena)}</strong>
          </button>
        ))}
      </div>
      {p2 || p3 ? (
        <div className="lj-dom">
          <p className="lj-dom-t">Promocja CAŁY DOM – rabat na całe zamówienie</p>
          <ul>
            {p2 ? (
              <li>
                <span>2 okna {typowe.okno.replace(/^do okna /, "")}</span>
                <s>{zl2(dwa)}</s>
                <b>{zl2(poRabacie(dwa, p2))}</b>
                <em>−{p2} %</em>
              </li>
            ) : null}
            {p3 ? (
              <li>
                <span>Całe poddasze: 3 takie okna</span>
                <s>{zl2(trzy)}</s>
                <b>{zl2(poRabacie(trzy, p3))}</b>
                <em>−{p3} %</em>
              </li>
            ) : null}
          </ul>
          <small>Rabat liczy się od całego koszyka – możesz łączyć plisy, rolety dachowe i moskitiery. Nalicza go koszyk.</small>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------- pomiar

export function DachPomiar({ produkt, onInstrukcja, onCzat }: { produkt: ProduktDachowy; onInstrukcja: () => void; onCzat: () => void }) {
  const n = NAZWA[produkt];
  const spozaListy =
    produkt === "rolety-dachowe"
      ? "Podajesz dwa wymiary miejsca montażu na skrzydle: A (szerokość) i B (wysokość), mierzone na rancie ramy skrzydła – nie przy samej szybie."
      : "Podajesz szerokość i wysokość, obie mierzone od rantu listwy przyszybowej do rantu po drugiej stronie – nie przy samej szybie.";
  return (
    <section className="pm-section" aria-labelledby="dach-pom-t">
      <p className="pm-eyebrow">Pomiar</p>
      <h2 id="dach-pom-t" className="pm-title">Zwykle nie musisz nic mierzyć</h2>
      <div className="lj-pomiar">
        <div>
          <b>1. Znajdź tabliczkę znamionową</b>
          <span>Otwórz skrzydło okna dachowego – tabliczka jest na jego górnej lub bocznej krawędzi. Jest na niej producent i symbol modelu.</span>
        </div>
        <div>
          <b>2. Wpisz model albo zrób zdjęcie</b>
          <span>Wpisz symbol w wyszukiwarce konfiguratora albo wgraj zdjęcie tabliczki – odczytamy model i dobierzemy wymiar {n.dopelniacz} sami.</span>
        </div>
        <div>
          <b>3. Okno spoza listy?</b>
          <span>{spozaListy} {n.biernik[0].toUpperCase() + n.biernik.slice(1)} wykonamy na miarę, a dobór zweryfikujemy przed produkcją.</span>
        </div>
      </div>
      <div className="lj-akcje">
        <button type="button" className="pm-btn" onClick={onInstrukcja}>Film: jak zmierzyć okno spoza listy</button>
        <button type="button" className="pm-link" onClick={onCzat}>Wyślij nam zdjęcie okna na czacie – pomożemy dobrać →</button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------- FAQ od obiekcji

/** FAQ dachowe: najpierw pytania, które zatrzymują zakup (model okna, okno spoza listy, zwrot, czy pasuje, zaciemnienie, wiercenie, czas). */
export function dachFaqWgObiekcji<T extends { question: string }>(lista: T[]): T[] {
  const kolejnosc = [/skąd wziąć model/i, /ze zdjęcia/i, /nie ma mojego okna/i, /zwrot|gwarancj/i, /do jakich okien/i, /zaciemnia/i, /wiercić|otwieraniu|uchylone/i, /realizacja/i, /ile kosztuje/i];
  const waga = (q: string) => {
    const i = kolejnosc.findIndex((r) => r.test(q));
    return i < 0 ? 100 : i;
  };
  return [...lista].sort((a, b) => waga(a.question) - waga(b.question));
}
