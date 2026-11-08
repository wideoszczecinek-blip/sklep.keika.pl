"use client";

// Lejek strony rolet dachowych v2 (9.11.2026, właściciel – w tej kolejności, bez zmian kolejności):
//   1. góra: miniatura + animacja B25 (RoofHeroPhotos)
//   2. opis u góry „zwarty i konkretny”: emocja + co dokładnie dostajesz w zestawie (tekst uzgodniony z ChatGPT)
//   3. „Kupujesz bez ryzyka” – animowane korzyści zamiast ściany tekstu, na pełną szerokość
//   4. przykładowe ceny: slajdy z najczęstszymi oknami, liczone dla anody, DEKO i TERMO – cena standardowa
//      przekreślona, duża cena w promocji, na dole warunek promocji
//   5. „Wyszukaj swoje okno” – wpisz model albo wybierz z listy
//   6. tkaniny jako przymierzalnia (zamiast plansz): prawdziwe próbki na renderze systemu B25
//   7. dalej opinie, galeria, FAQ, instrukcje (sekcje strony produktu)
// W odpowiednich miejscach kierujemy do konfiguratora: na telefonie przycisk przewija do niego, na komputerze
// konfigurator stoi obok – przycisk go podświetla i pokazuje strzałką (nudgeConfigurator w home-client).
import { useEffect, useMemo, useRef, useState } from "react";
import { trackShopStep } from "@/lib/track-step";
import { COMPANY_LEGAL } from "@/lib/company-legal";
import { useBundleDiscountRules } from "@/lib/bundle-discount";
import { QTY_PROMO } from "@/lib/promo";
import { optimizeImageUrl } from "@/lib/image-optim";
import { dzienWysylki } from "@/features/plisy/Premium";
import { DNI_PRODUKCJI, TYPOWE_OKNA } from "@/features/dachowe/lejek-tresci";
import RoofHeroScene, { type RoofHardwareTone } from "./RoofHeroScene";
import { RD_CALLOUT, RD_FABRIC_TYPES } from "./landing-content";
import { calcRoletyDachowePrice, type RoofBlindProfile } from "./shared";
import {
  buildRoofWindowDisplayLabel,
  libraryProducers,
  resolveRoofWindowDimensions,
  searchRoofWindowLibrary,
  type RoofWindowLibraryItem,
} from "./roof-window-library";

const zl = (v: number) => `${v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
const ANODA = "srebrny";
const MATS = [
  { id: "polprzepuszczalny", name: "DEKO", note: "rozprasza światło" },
  { id: "termo", name: "TERMO", note: "zaciemnia" },
] as const;

/** Najwyższy próg promocji CAŁY DOM dla rolet dachowych (reguły z CRM, zapasowo QTY_PROMO). */
function usePromoTiers() {
  const reguly = useBundleDiscountRules();
  const tiers = (reguly["rolety-dachowe"]?.tiers?.length ? reguly["rolety-dachowe"].tiers : QTY_PROMO.tiers).map((t) => ({ fromQty: t.fromQty, percent: t.percent }));
  const best = [...tiers].sort((a, b) => b.percent - a.percent)[0] || { fromQty: 3, percent: 20 };
  return { tiers, best };
}
const poRabacie = (kwota: number, proc: number) => Math.round(kwota * (1 - proc / 100) * 100) / 100;

function PromoWarunek({ tiers }: { tiers: Array<{ fromQty: number; percent: number }> }) {
  const opis = tiers
    .slice()
    .sort((a, b) => a.fromQty - b.fromQty)
    .map((t, i, arr) => `${t.fromQty}${i === arr.length - 1 ? " i więcej" : ""} szt. −${t.percent} %`)
    .join(", ");
  return (
    <p className="rdl-warunek">
      Cena promocyjna przy zakupie {tiers.length ? Math.max(...tiers.map((t) => t.fromQty)) : 3} lub więcej produktów w promocji CAŁY DOM ({opis}). Produkty mogą być różne – rolety,
      plisy, moskitiery. Rabat nalicza koszyk. Cena standardowa dotyczy zakupu 1 sztuki.
    </p>
  );
}

// ---------------------------------------------------------------- 2. opis u góry

const ZESTAW: Array<{ nazwa: string; korzysc: string; ikona: string }> = [
  { nazwa: "Aluminiowa kaseta", korzysc: "Tkanina chowa się w niej i zawsze jest napięta.", ikona: "M3 6h18v5H3z M5 11v2 M19 11v2" },
  { nazwa: "Szerokie prowadnice", korzysc: "Tkanina nie odstaje, bokami wpada mniej światła.", ikona: "M5 3v18 M9 3v18 M15 3v18 M19 3v18" },
  { nazwa: "Belka z hamulcem MULTISTOP", korzysc: "Zatrzymujesz roletę, gdzie chcesz. Bez sznurków.", ikona: "M3 15h18v3H3z M8 18v2h3v-2 M13 18v2h3v-2 M12 4v8 M9 9l3 3 3-3" },
  { nazwa: "Tkanina DEKO lub TERMO", korzysc: "Jasno i przyjemnie albo ciemno i chłodniej.", ikona: "M5 4h14v14H5z M5 8h14 M5 12h14" },
  { nazwa: "Wkręty i instrukcja", korzysc: "Montujesz sam, bez specjalistycznych narzędzi.", ikona: "M14 4l6 6-9 9H5v-6z M12 6l6 6" },
];

const Ikona = ({ d, size = 22 }: { d: string; size?: number }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

export function RdOpis({
  liczbaModeli,
  przyklad,
  onWycen,
}: {
  liczbaModeli: number;
  przyklad: { okno: string; cena: number } | null;
  onWycen: () => void;
}) {
  const { best } = usePromoTiers();
  return (
    <div className="rdl-opis">
      <h2 className="rdl-lead">Śpij spokojnie. Nawet pod samym dachem.</h2>
      <p className="rdl-sub">
        Rano ciemno, latem chłodniej, a ile światła wpuścić – decydujesz Ty. Roleta dobrana do modelu Twojego okna, <b>bez mierzenia</b>.
      </p>
      <p className="rdl-zestaw-t">Co dostajesz w zestawie</p>
      <ul className="rdl-zestaw">
        {ZESTAW.map((z, i) => (
          <li key={z.nazwa} style={{ animationDelay: `${i * 70}ms` }}>
            <span className="rdl-zestaw-ik">
              <Ikona d={z.ikona} />
            </span>
            <span>
              <b>{z.nazwa}</b>
              <small>{z.korzysc}</small>
            </span>
          </li>
        ))}
      </ul>
      <p className="rdl-osprzet">
        Osprzęt w 3 kolorach:
        <span className="rdl-dot" style={{ background: "#c7ced6" }} /> anoda
        <span className="rdl-dot" style={{ background: "#f4f7f8" }} /> biały
        <span className="rdl-dot" style={{ background: "#e5bd72" }} /> sosna
        <span className="rdl-sep">·</span> ponad {liczbaModeli >= 420 ? Math.floor(liczbaModeli / 10) * 10 : 420} modeli okien VELUX, FAKRO, ROTO, OKPOL i innych
      </p>
      <div className="rdl-opis-cta">
        {przyklad ? (
          <p className="rdl-cena">
            {przyklad.okno.replace(/^do/, "Do")}: <s>{zl(przyklad.cena)}</s> <b>od {zl(poRabacie(przyklad.cena, best.percent))}</b>
            <span> w promocji CAŁY DOM</span>
          </p>
        ) : null}
        <button
          type="button"
          className="pm-btn rdl-btn"
          onClick={() => {
            trackShopStep("lejek_dach_wycen", "rolety-dachowe", { zrodlo: "opis" });
            onWycen();
          }}
        >
          Sprawdź cenę dla swojego okna <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- 3. kupujesz bez ryzyka (animowane kafle)

/** Wchodzi w widok – dodaje klasę is-in (animacje kafli raz, przy pierwszym pokazaniu). */
function useInView<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || inView) return;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [inView]);
  return { ref, inView };
}

const DNI_TYG = ["w niedzielę", "w poniedziałek", "we wtorek", "w środę", "w czwartek", "w piątek", "w sobotę"];

export function RdBezRyzyka({ onPomiar }: { onPomiar: () => void }) {
  const { ref, inView } = useInView<HTMLElement>();
  const c = COMPANY_LEGAL;
  const dni = DNI_PRODUKCJI["rolety-dachowe"];
  // wysyłka po produkcji, kurier 24 h – najpóźniejszy dzień dostawy to kolejny dzień roboczy po wysyłce
  const [dostawa, setDostawa] = useState<Date | null>(null);
  useEffect(() => setDostawa(dzienWysylki(dzienWysylki(new Date(), dni), 1)), [dni]);
  return (
    <section ref={ref} className={`rdl-ryzyko ${inView ? "is-in" : ""}`} aria-labelledby="rdl-ryzyko-t">
      <h2 id="rdl-ryzyko-t">Kupujesz bez ryzyka</h2>
      <div className="rdl-ryzyko-grid">
        <div className="rdl-r rdl-r--gw">
          <span className="rdl-anim" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="48" height="48">
              <path className="rdl-tarcza" d="M24 4l16 6v12c0 10-7 18-16 22C15 40 8 32 8 22V10z" />
              <text className="rdl-piec" x="24" y="30" textAnchor="middle">5</text>
            </svg>
          </span>
          <b>5 lat gwarancji</b>
          <span>Spokój na długie lata.</span>
        </div>
        <div className="rdl-r rdl-r--zwrot">
          <span className="rdl-anim" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="48" height="48">
              <g className="rdl-kolo">
                <path d="M38 24a14 14 0 1 1-4.1-9.9" />
                <path d="M34 8v7h-7" />
              </g>
              <text className="rdl-trzydziesci" x="24" y="28.5" textAnchor="middle">30</text>
            </svg>
          </span>
          <b>30 dni na zwrot</b>
          <span>Także przy rolecie na wymiar.</span>
        </div>
        <button type="button" className="rdl-r rdl-r--tabl" onClick={onPomiar}>
          <span className="rdl-anim" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="48" height="48">
              <rect x="6" y="12" width="36" height="24" rx="3" />
              <path className="rdl-tabl-t" d="M11 20h16 M11 26h22 M11 31h12" />
              <path className="rdl-skan" d="M6 14h36" />
            </svg>
          </span>
          <b>Bez mierzenia okna</b>
          <span>Dobierzemy po modelu lub zdjęciu tabliczki.</span>
        </button>
        <div className="rdl-r rdl-r--auto">
          <span className="rdl-anim" aria-hidden="true">
            <svg viewBox="0 0 48 48" width="48" height="48">
              <g className="rdl-auto">
                <path d="M4 16h24v16H4z M28 22h8l6 6v4H28z" />
                <circle cx="12" cy="34" r="3.5" />
                <circle cx="34" cy="34" r="3.5" />
              </g>
              <path className="rdl-droga" d="M0 41h48" />
            </svg>
          </span>
          <b>{dostawa ? `U Ciebie najpóźniej ${DNI_TYG[dostawa.getDay()]}` : "Szybka realizacja"}</b>
          <span>
            {dostawa ? `${dostawa.toLocaleDateString("pl-PL", { day: "numeric", month: "long" })} · ` : ""}produkcja do {dni} dni roboczych + kurier 24 h
          </span>
        </div>
      </div>
      <p className="rdl-firma">
        {c.legalName} · {c.city}, produkujemy od {c.producingSince} r. · BLIK, karta, raty, PayPo lub za pobraniem ·{" "}
        <a href={c.phoneHref} onClick={() => trackShopStep("call_click", "rolety-dachowe", { source: "bez_ryzyka" })}>
          {c.phone}
        </a>
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- 4. przykładowe ceny – slajdy

type CenaOkna = { item: RoofWindowLibraryItem; okno: string; ceny: Array<{ mat: (typeof MATS)[number]; cena: number }> };

function cenyDlaOkna(profile: RoofBlindProfile, w: number, h: number, adj: number) {
  const out: CenaOkna["ceny"] = [];
  for (const mat of MATS) {
    const cena = calcRoletyDachowePrice(profile.tables, w, h, ANODA, mat.id, adj);
    if (cena !== null) out.push({ mat, cena });
  }
  return out;
}

export function RdCenySlajdy({
  profile,
  library,
  adj,
  onOkno,
  onPierwszyWidok,
}: {
  profile: RoofBlindProfile | null;
  library: RoofWindowLibraryItem[];
  adj: number;
  onOkno: (item: RoofWindowLibraryItem) => void;
  /** Pierwsze pokazanie cen – na komputerze delikatnie podświetlamy konfigurator obok. */
  onPierwszyWidok?: () => void;
}) {
  const { tiers, best } = usePromoTiers();
  const { ref: widokRef, inView } = useInView<HTMLElement>();
  const zgloszone = useRef(false);
  useEffect(() => {
    if (!inView || zgloszone.current) return;
    zgloszone.current = true;
    onPierwszyWidok?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView]);
  const okna = useMemo<CenaOkna[]>(() => {
    if (!profile || !library.length) return [];
    const out: CenaOkna[] = [];
    for (const [szukaj, okno] of TYPOWE_OKNA) {
      const item = searchRoofWindowLibrary(library, szukaj)[0]?.item;
      if (!item) continue;
      const { widthMm, heightMm } = resolveRoofWindowDimensions(item);
      if (!widthMm || !heightMm) continue;
      const ceny = cenyDlaOkna(profile, widthMm, heightMm, adj);
      if (ceny.length) out.push({ item, okno, ceny });
    }
    return out;
  }, [profile, library, adj]);
  const tasma = useRef<HTMLDivElement | null>(null);
  const [nr, setNr] = useState(0);
  useEffect(() => {
    const el = tasma.current;
    if (!el) return;
    const onScroll = () => {
      const kafel = el.firstElementChild as HTMLElement | null;
      if (!kafel) return;
      setNr(Math.round(el.scrollLeft / (kafel.offsetWidth + 12)));
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, [okna.length]);
  const idz = (krok: number) => {
    const el = tasma.current;
    const kafel = el?.firstElementChild as HTMLElement | null;
    if (!el || !kafel) return;
    el.scrollBy({ left: krok * (kafel.offsetWidth + 12), behavior: "smooth" });
  };
  if (okna.length < 2) return null;
  return (
    <section ref={widokRef} className="pm-section rdl-ceny" aria-labelledby="rdl-ceny-t">
      <p className="pm-eyebrow">Cennik</p>
      <h2 id="rdl-ceny-t" className="pm-title">Przykładowe ceny rolet do najczęstszych okien</h2>
      <p className="rdl-ceny-lead">
        To <b>przykładowe ceny</b> – dla osprzętu anoda (srebrny). Dokładną cenę dla swojego okna pokaże konfigurator.
      </p>
      <div className="rdl-slajdy">
        <button type="button" className="rdl-strzalka rdl-strzalka--l" aria-label="Poprzednie okno" onClick={() => idz(-1)} disabled={nr <= 0}>
          ‹
        </button>
        <div className="rdl-tasma" ref={tasma}>
          {okna.map((o) => (
            <article key={o.okno} className="rdl-slajd">
              <h3>{o.okno.replace(/^do okna /, "Do okna ")}</h3>
              {o.ceny.map(({ mat, cena }) => (
                <div key={mat.id} className={`rdl-slajd-cena rdl-slajd-cena--${mat.name.toLowerCase()}`}>
                  <span className="rdl-mat">
                    <b>{mat.name}</b>
                    <small>{mat.note}</small>
                  </span>
                  <span className="rdl-kwoty">
                    <s>{zl(cena)}</s>
                    <strong>{zl(poRabacie(cena, best.percent))}</strong>
                  </span>
                </div>
              ))}
              <button
                type="button"
                className="rdl-slajd-btn"
                onClick={() => {
                  trackShopStep("lejek_cena_typowa", "rolety-dachowe", { okno: o.okno });
                  onOkno(o.item);
                }}
              >
                Wyceń to okno <span aria-hidden="true">→</span>
              </button>
            </article>
          ))}
        </div>
        <button type="button" className="rdl-strzalka rdl-strzalka--p" aria-label="Następne okno" onClick={() => idz(1)} disabled={nr >= okna.length - 1}>
          ›
        </button>
      </div>
      <div className="rdl-kropki" aria-hidden="true">
        {okna.map((o, i) => (
          <span key={o.okno} className={i === nr ? "is-on" : ""} />
        ))}
      </div>
      <PromoWarunek tiers={tiers} />
    </section>
  );
}

// ---------------------------------------------------------------- 5. wyszukaj swoje okno

export function RdSzukajOkna({
  profile,
  library,
  adj,
  onOkno,
  onSpozaListy,
}: {
  profile: RoofBlindProfile | null;
  library: RoofWindowLibraryItem[];
  adj: number;
  onOkno: (item: RoofWindowLibraryItem) => void;
  onSpozaListy: () => void;
}) {
  const { best } = usePromoTiers();
  const [query, setQuery] = useState("");
  const [lista, setLista] = useState(false);
  const [producent, setProducent] = useState<string | null>(null);
  const [wybrane, setWybrane] = useState<RoofWindowLibraryItem | null>(null);
  const wyniki = useMemo(() => (query.trim() && !wybrane ? searchRoofWindowLibrary(library, query).slice(0, 6) : []), [library, query, wybrane]);
  const producenci = useMemo(() => libraryProducers(library).slice(0, 8), [library]);
  const modele = useMemo(
    () =>
      producent
        ? library
            .filter((i) => (i.producer_name.trim().split(/\s+/)[0] || "").toLocaleLowerCase("pl-PL") === producent.toLocaleLowerCase("pl-PL"))
            .sort((a, b) => buildRoofWindowDisplayLabel(a).localeCompare(buildRoofWindowDisplayLabel(b), "pl", { numeric: true }))
        : [],
    [library, producent],
  );
  const ceny = useMemo(() => {
    if (!wybrane || !profile) return [];
    const { widthMm, heightMm } = resolveRoofWindowDimensions(wybrane);
    return widthMm && heightMm ? cenyDlaOkna(profile, widthMm, heightMm, adj) : [];
  }, [wybrane, profile, adj]);
  const wybierz = (item: RoofWindowLibraryItem, zrodlo: string) => {
    setWybrane(item);
    setQuery(buildRoofWindowDisplayLabel(item));
    setLista(false);
    trackShopStep("lejek_szukaj_okna", "rolety-dachowe", { zrodlo, okno: buildRoofWindowDisplayLabel(item) });
  };

  return (
    <section id="dach-wycena" className="pm-section rdl-szukaj" aria-labelledby="rdl-szukaj-t">
      <h2 id="rdl-szukaj-t" className="pm-title">Wyszukaj swoje okno</h2>
      <p className="rdl-szukaj-lead">Wpisz model z tabliczki znamionowej albo wybierz z listy – pokażemy cenę i przeniesiemy wybór do konfiguratora.</p>
      <div className="rdl-szukaj-pole">
        <input
          type="text"
          inputMode="search"
          autoComplete="off"
          className="rdl-input"
          aria-label="Model okna dachowego"
          placeholder={library.length ? "Wpisz model, np. VELUX MK06 albo FAKRO 78x118" : "Ładuję listę okien…"}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setWybrane(null);
          }}
        />
        <button type="button" className={`rdl-lista-btn ${lista ? "is-on" : ""}`} aria-expanded={lista} onClick={() => setLista((v) => !v)}>
          {lista ? "Zamknij listę" : "Wybierz z listy"}
        </button>
        {wyniki.length ? (
          <ul className="rdl-wyniki" role="listbox">
            {wyniki.map((r) => (
              <li key={r.item.id}>
                <button type="button" onClick={() => wybierz(r.item, "wpisz")}>
                  <b>{buildRoofWindowDisplayLabel(r.item)}</b>
                  {r.item.window_width && r.item.window_height ? (
                    <small>
                      {r.item.window_width} × {r.item.window_height} cm
                    </small>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>

      {lista ? (
        <div className="rdl-lista">
          <div className="rdl-producenci" role="tablist" aria-label="Producent okna">
            {producenci.map((p) => (
              <button key={p.name} type="button" role="tab" aria-selected={producent === p.name} className={producent === p.name ? "is-on" : ""} onClick={() => setProducent(p.name)}>
                {p.name.toUpperCase()} <small>{p.count}</small>
              </button>
            ))}
          </div>
          {producent ? (
            <div className="rdl-modele">
              {modele.map((m) => (
                <button key={m.id} type="button" onClick={() => wybierz(m, "lista")}>
                  {buildRoofWindowDisplayLabel(m)}
                </button>
              ))}
            </div>
          ) : (
            <p className="rdl-lista-pusto">Wybierz producenta okna – pokażemy wszystkie jego modele.</p>
          )}
        </div>
      ) : null}

      {wybrane ? (
        <div className="rdl-wybrane">
          <p className="rdl-wybrane-t">
            <b>{buildRoofWindowDisplayLabel(wybrane)}</b> – roleta pasuje do tego okna
          </p>
          <div className="rdl-wybrane-ceny">
            {ceny.map(({ mat, cena }) => (
              <div key={mat.id}>
                <span>
                  <b>{mat.name}</b> <small>{mat.note}</small>
                </span>
                <span className="rdl-kwoty">
                  <s>{zl(cena)}</s>
                  <strong>{zl(poRabacie(cena, best.percent))}</strong>
                </span>
              </div>
            ))}
          </div>
          <button type="button" className="pm-btn rdl-btn" onClick={() => onOkno(wybrane)}>
            Konfiguruj to okno <span aria-hidden="true">→</span>
          </button>
        </div>
      ) : null}

      <p className="rdl-szukaj-dol">
        Nie znasz modelu? W konfiguratorze <b>wgrasz zdjęcie tabliczki</b> – odczytamy go za Ciebie.{" "}
        <button type="button" className="pm-link" onClick={onSpozaListy}>
          Okno spoza listy – podaj wymiary →
        </button>
      </p>
      <p className="rdl-uwaga">
        <b>{RD_CALLOUT.title}.</b> {RD_CALLOUT.body}
      </p>
    </section>
  );
}

// ---------------------------------------------------------------- 6. tkaniny – przymierzalnia

const OSPRZET: Array<{ id: RoofHardwareTone; label: string; color: string }> = [
  { id: "srebrny", label: "Anoda", color: "#c7ced6" },
  { id: "bialy", label: "Biały", color: "#f4f7f8" },
  { id: "sosna", label: "Jasna sosna", color: "#e5bd72" },
];

export function RdTkaniny({
  profile,
  onWybierz,
}: {
  profile: RoofBlindProfile | null;
  onWybierz: (wybor: { materialTypeId: string; fabricId: string; hardwareId: string }) => void;
}) {
  const [mat, setMat] = useState<string>("termo");
  const [hw, setHw] = useState<RoofHardwareTone>("srebrny");
  const tkaniny = useMemo(() => (profile?.fabrics || []).filter((f) => f.materialTypeId === mat), [profile, mat]);
  const [fabricId, setFabricId] = useState<string>("");
  const fabric = tkaniny.find((f) => f.id === fabricId) || tkaniny[0] || null;
  const opis = RD_FABRIC_TYPES.find((r) => r.materialTypeId === mat) || RD_FABRIC_TYPES[0];
  const { ref, inView } = useInView<HTMLElement>();

  return (
    <section ref={ref} className="pm-section rdl-tkaniny" aria-labelledby="rdl-tk-t">
      <p className="pm-eyebrow">Tkaniny</p>
      <h2 id="rdl-tk-t" className="pm-title">Przymierz tkaninę do swojego okna</h2>
      <p className="rdl-tk-lead">Kliknij kolor – roleta zjedzie w nim na oknie. {opis.count === 19 ? "19" : "54"} kolorów {opis.name}, prawdziwe próbki tkanin.</p>
      <div className="rdl-tk">
        <div className="rdl-tk-scena">
          <RoofHeroScene
            mode="show"
            active={inView}
            hardware={hw}
            fabric={fabric ? { color: fabric.color, kind: mat === "termo" ? "termo" : "deko", imageUrl: optimizeImageUrl(fabric.imageUrl, 400) } : null}
          />
          {fabric ? (
            <span className="rdl-tk-etykieta">
              {fabric.label.replace(/^Deko/, "DEKO").replace(/^Termo/, "TERMO")} · osprzęt {OSPRZET.find((o) => o.id === hw)?.label.toLowerCase()}
            </span>
          ) : null}
        </div>
        <div className="rdl-tk-panel">
          <div className="rdl-tk-zakladki" role="tablist" aria-label="Rodzaj tkaniny">
            {RD_FABRIC_TYPES.map((r) => (
              <button
                key={r.materialTypeId}
                type="button"
                role="tab"
                aria-selected={mat === r.materialTypeId}
                className={mat === r.materialTypeId ? "is-on" : ""}
                onClick={() => {
                  setMat(r.materialTypeId);
                  setFabricId("");
                  trackShopStep("lejek_tkanina_rodzaj", "rolety-dachowe", { rodzaj: r.name });
                }}
              >
                <b>{r.name}</b>
                <small>{r.blackout ? "zaciemnia, chroni przed upałem" : "rozprasza światło"}</small>
              </button>
            ))}
          </div>
          <p className="rdl-tk-co">{opis.what}</p>
          <div className="rdl-tk-probki" role="listbox" aria-label={`Kolory ${opis.name}`}>
            {tkaniny.map((f) => (
              <button
                key={f.id}
                type="button"
                role="option"
                aria-selected={fabric?.id === f.id}
                className={fabric?.id === f.id ? "is-on" : ""}
                title={f.label}
                style={{ backgroundColor: f.color, backgroundImage: `url(${optimizeImageUrl(f.imageUrl, 96)})` }}
                onClick={() => {
                  setFabricId(f.id);
                  trackShopStep("lejek_tkanina_kolor", "rolety-dachowe", { tkanina: f.label });
                }}
              >
                <span className="sr-only">{f.label}</span>
              </button>
            ))}
          </div>
          <p className="rdl-tk-osprzet-t">Kolor kasety i prowadnic</p>
          <div className="rdl-tk-osprzet">
            {OSPRZET.map((o) => (
              <button key={o.id} type="button" className={hw === o.id ? "is-on" : ""} aria-pressed={hw === o.id} onClick={() => setHw(o.id)}>
                <span className="rdl-dot" style={{ background: o.color }} /> {o.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="pm-btn rdl-btn"
            disabled={!fabric}
            onClick={() => {
              if (!fabric) return;
              trackShopStep("fabric_type_pick", opis.name, { material: mat, fabric: fabric.label, hardware: hw });
              onWybierz({ materialTypeId: mat, fabricId: fabric.id, hardwareId: hw });
            }}
          >
            Zamawiam w tym kolorze <span aria-hidden="true">→</span>
          </button>
        </div>
      </div>
    </section>
  );
}
