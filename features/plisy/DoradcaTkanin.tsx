"use client";

// Doradca tkanin na stronie plis (właściciel 3.11: „podpowiadamy - jakie tkaniny - sekcja w której można zobaczyć
// tkaniny, interaktywna ścieżka, mała ankieta, aby klientowi doradzić; pokazać kolor z filtrem na kolor albo
// przeznaczenie - można zapisać daną tkaninę w konfiguratorze”).
// Dwa pytania (pokój → ile światła) ustawiają filtr przeznaczenia, kolor filtruje dalej. Tkaniny z katalogu
// wizualizatora (150 szt., kolekcja, kolor hex, miniatura). „Wybierz w konfiguratorze” = to samo zdarzenie co
// „Zamów tę plisę” w wizualizatorze (kolekcja + tkanina w krokach konfiguratora, szkic w localStorage).
import { useEffect, useMemo, useState } from "react";
import { trackShopStep } from "@/lib/track-step";
import { fetchKatalog, type WizKatalog, type WizTkanina } from "@/lib/wizualizator/api";
import { WIZ_PICK_EVENT, openWizualizator, type WizPickDetail } from "@/lib/wizualizator/flag";
import { useWizVisible } from "@/features/wizualizator/WizEntry";

type Swiatlo = "zaciemnienie" | "rozproszone" | "slonce";
type Kolor = "wszystkie" | "biale" | "beze" | "szare" | "ciemne" | "kolorowe";

const POKOJE: { id: string; nazwa: string; swiatlo: Swiatlo }[] = [
  { id: "sypialnia", nazwa: "Sypialnia", swiatlo: "zaciemnienie" },
  { id: "salon", nazwa: "Salon, jadalnia", swiatlo: "rozproszone" },
  { id: "dziecko", nazwa: "Pokój dziecka", swiatlo: "zaciemnienie" },
  { id: "biuro", nazwa: "Biuro, gabinet", swiatlo: "rozproszone" },
  { id: "kuchnia", nazwa: "Kuchnia, łazienka", swiatlo: "rozproszone" },
  { id: "poludnie", nazwa: "Poddasze, okno od południa", swiatlo: "slonce" },
];

const SWIATLO: { id: Swiatlo; nazwa: string; kolekcje: string[]; czemu: string }[] = [
  { id: "zaciemnienie", nazwa: "Pełne zaciemnienie", kolekcje: ["blackout", "duo-blackout"], czemu: "Podgumowany rdzeń albo podwójny plaster miodu blokuje światło – śpisz dłużej, także latem o świcie." },
  { id: "rozproszone", nazwa: "Jasno, ale bez wglądu", kolekcje: ["clasic", "duo"], czemu: "Tkaniny półprzepuszczalne rozpraszają światło i chronią prywatność – w pokoju dalej jest jasno." },
  { id: "slonce", nazwa: "Mniej słońca i ciepła", kolekcje: ["reflex"], czemu: "Powłoka refleksyjna od strony szyby odbija słońce – latem pokój mniej się nagrzewa." },
];

const KOLORY: { id: Kolor; nazwa: string; probka: string }[] = [
  { id: "wszystkie", nazwa: "Wszystkie kolory", probka: "conic-gradient(#f5f4f0, #d9bfa0, #8a8f96, #2f3338, #6b8f71, #f5f4f0)" },
  { id: "biale", nazwa: "Białe i kremowe", probka: "#f3efe6" },
  { id: "beze", nazwa: "Beże i brązy", probka: "#c9a882" },
  { id: "szare", nazwa: "Szarości", probka: "#9aa0a6" },
  { id: "ciemne", nazwa: "Ciemne", probka: "#33373c" },
  { id: "kolorowe", nazwa: "Kolorowe", probka: "#6f8fa8" },
];

/** Rodzina koloru z hex tkaniny (jasność, nasycenie, odcień). */
function rodzina(hex: string): Exclude<Kolor, "wszystkie"> {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "szare";
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255;
  const g = ((n >> 8) & 255) / 255;
  const b = (n & 255) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (d) h = max === r ? 60 * (((g - b) / d) % 6) : max === g ? 60 * ((b - r) / d + 2) : 60 * ((r - g) / d + 4);
  if (h < 0) h += 360;
  if (l > 0.86) return "biale";
  if (l < 0.28) return "ciemne";
  if (s < 0.13) return "szare";
  if (h >= 15 && h <= 55) return "beze";
  return "kolorowe";
}

/** „PP 151 (biały)” → „biały”. */
const nazwaKoloru = (t: WizTkanina) => /\(([^)]+)\)/.exec(t.nazwa)?.[1] || t.nazwa;

const NA_START = 12;

export function DoradcaTkanin({ onKolekcje }: { onKolekcje: () => void }) {
  const wiz = useWizVisible();
  const [katalog, setKatalog] = useState<WizKatalog | null>(null);
  const [pokoj, setPokoj] = useState<string>("");
  const [swiatlo, setSwiatlo] = useState<Swiatlo | "">("");
  const [kolor, setKolor] = useState<Kolor>("wszystkie");
  const [wszystkie, setWszystkie] = useState(false);
  const [wybrana, setWybrana] = useState<WizTkanina | null>(null);
  const [zapisana, setZapisana] = useState("");

  useEffect(() => {
    let alive = true;
    fetchKatalog().then((k) => {
      if (alive && k?.tkaniny?.length) setKatalog(k);
    });
    return () => {
      alive = false;
    };
  }, []);

  const kolekcje = useMemo(() => new Map((katalog?.kolekcje || []).map((k) => [k.id, k])), [katalog]);
  const rada = SWIATLO.find((x) => x.id === swiatlo) || null;
  const lista = useMemo(() => {
    const t = katalog?.tkaniny || [];
    return t.filter((x) => (!rada || rada.kolekcje.includes(x.kolekcja)) && (kolor === "wszystkie" || rodzina(x.kolor) === kolor));
  }, [katalog, rada, kolor]);
  const widoczne = wszystkie ? lista : lista.slice(0, NA_START);

  const wybierzPokoj = (id: string) => {
    const p = POKOJE.find((x) => x.id === id);
    setPokoj(id);
    if (p) setSwiatlo(p.swiatlo);
    setWszystkie(false);
    trackShopStep("doradca_tkanin_pokoj", "plisy", { pokoj: id });
  };

  const doKonfiguratora = (t: WizTkanina) => {
    const pick: WizPickDetail = { fabricGroupId: t.kolekcja, fabricId: t.id };
    try {
      const prev = JSON.parse(window.localStorage.getItem("keika_plisy_draft_v1") || "{}");
      window.localStorage.setItem("keika_plisy_draft_v1", JSON.stringify({ ...prev, ...pick, savedAt: Date.now() }));
    } catch {
      /* szkic to wygoda */
    }
    window.dispatchEvent(new CustomEvent<WizPickDetail>(WIZ_PICK_EVENT, { detail: pick }));
    trackShopStep("doradca_tkanin_do_konfiguratora", "plisy", { tkanina: t.id, kolekcja: t.kolekcja, pokoj, swiatlo });
    setZapisana(t.id);
    const panel = document.querySelector(".hero-product-config-panel");
    if (panel) window.setTimeout(() => panel.scrollIntoView({ behavior: "smooth", block: "start" }), 350);
  };

  return (
    <section className="pm-section dt" aria-labelledby="dt-t">
      <p className="pm-eyebrow">Tkanina</p>
      <h2 id="dt-t" className="pm-title">Podpowiemy, która tkanina pasuje do Twojego okna</h2>

      <div className="dt-krok">
        <b><span>1</span> Gdzie zawiśnie plisa?</b>
        <div className="dt-chipy">
          {POKOJE.map((p) => (
            <button key={p.id} type="button" className={pokoj === p.id ? "is-on" : ""} aria-pressed={pokoj === p.id} onClick={() => wybierzPokoj(p.id)}>
              {p.nazwa}
            </button>
          ))}
        </div>
      </div>

      <div className="dt-krok">
        <b><span>2</span> Ile światła chcesz w pokoju?</b>
        <div className="dt-chipy">
          {SWIATLO.map((s) => (
            <button
              key={s.id}
              type="button"
              className={swiatlo === s.id ? "is-on" : ""}
              aria-pressed={swiatlo === s.id}
              onClick={() => {
                setSwiatlo(swiatlo === s.id ? "" : s.id);
                setWszystkie(false);
                trackShopStep("doradca_tkanin_swiatlo", "plisy", { swiatlo: s.id });
              }}
            >
              {s.nazwa}
            </button>
          ))}
        </div>
        {rada ? (
          <p className="dt-rada">
            <b>Polecamy: {rada.kolekcje.map((k) => kolekcje.get(k)?.nazwa || k).join(" albo ")}.</b> {rada.czemu}
          </p>
        ) : null}
      </div>

      <div className="dt-krok">
        <b><span>3</span> Jaki kolor?</b>
        <div className="dt-chipy dt-kolory">
          {KOLORY.map((k) => (
            <button
              key={k.id}
              type="button"
              className={kolor === k.id ? "is-on" : ""}
              aria-pressed={kolor === k.id}
              onClick={() => {
                setKolor(k.id);
                setWszystkie(false);
                trackShopStep("doradca_tkanin_kolor", "plisy", { kolor: k.id });
              }}
            >
              <i style={{ background: k.probka }} aria-hidden="true" />
              {k.nazwa}
            </button>
          ))}
        </div>
      </div>

      {katalog ? (
        <>
          <p className="dt-ile">
            {lista.length ? `${lista.length} ${lista.length === 1 ? "tkanina" : lista.length < 5 ? "tkaniny" : "tkanin"} dla Ciebie – kliknij, żeby zobaczyć z bliska` : "Brak tkanin w tym kolorze – wybierz inny kolor."}
          </p>
          <ul className="dt-siatka">
            {widoczne.map((t) => (
              <li key={t.id}>
                <button type="button" className={wybrana?.id === t.id ? "is-on" : ""} onClick={() => setWybrana(wybrana?.id === t.id ? null : t)} aria-label={`${t.kod} ${nazwaKoloru(t)}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.miniatura} alt="" loading="lazy" style={{ background: t.kolor }} />
                  <span>
                    <b>{nazwaKoloru(t)}</b>
                    <small>{t.kod} · {kolekcje.get(t.kolekcja)?.nazwa || t.kolekcja}</small>
                  </span>
                  {zapisana === t.id ? <em>✓ w konfiguratorze</em> : null}
                </button>
              </li>
            ))}
          </ul>
          {lista.length > NA_START && !wszystkie ? (
            <button type="button" className="pm-link dt-wiecej" onClick={() => setWszystkie(true)}>
              Pokaż wszystkie ({lista.length}) →
            </button>
          ) : null}
        </>
      ) : (
        <p className="dt-ile">Wczytujemy tkaniny…</p>
      )}

      {wybrana ? (
        <div className="dt-wybrana" role="region" aria-label="Wybrana tkanina">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={wybrana.miniatura} alt={`Tkanina ${wybrana.kod}`} style={{ background: wybrana.kolor }} />
          <div>
            <b>{wybrana.kod} – {nazwaKoloru(wybrana)}</b>
            <small>{kolekcje.get(wybrana.kolekcja)?.opis || ""}</small>
            <div className="dt-wybrana-akcje">
              <button type="button" className="pm-btn" onClick={() => doKonfiguratora(wybrana)}>
                {zapisana === wybrana.id ? "✓ Zapisana w konfiguratorze" : "Wybierz w konfiguratorze"}
              </button>
              {wiz ? (
                <button
                  type="button"
                  className="pm-link"
                  onClick={() => {
                    trackShopStep("doradca_tkanin_wiz", "plisy", { tkanina: wybrana.id });
                    openWizualizator({ zrodlo: "doradca-tkanin", tkanina: wybrana.id });
                  }}
                >
                  Zobacz ją w swoim oknie →
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <button type="button" className="pm-link dt-cennik" onClick={onKolekcje}>
        Wszystkie 150 tkanin z cenami w konfiguratorze →
      </button>
    </section>
  );
}
