"use client";

/**
 * Wizualizator: wycena zestawu i kreator wymiarów (właściciel 1.11: „dodaj zestaw do koszyka – kliknięcie
 * poprosi o potwierdzenie wymiarów każdej szyby w ładny, graficzny i czytelny sposób, podświetlając szybę”).
 *  - etap „wycena”: lista szyb z ceną orientacyjną z wymiarów SZACUNKOWYCH (etap G) - wyraźnie oznaczone,
 *  - kreator: szyba po szybie (podświetlona na zdjęciu przez onHover), rysunek gdzie mierzyć, pola wymiarów
 *    celowo PUSTE (szacunek tylko jako podpowiedź) i potwierdzenie pomiaru - bez tego dalej się nie da,
 *  - podsumowanie: wymiary klienta, ceny z cennika konfiguratora (features/plisy/shared.ts), rabat, koszyk.
 */
import { useEffect, useMemo, useState } from "react";
import {
  PLISY_BRACKET_COLORS, applyPriceDeltas, calcPlisyPrice, fetchPlisyProfile, isPlisyMountNonInvasive, joinPlisyMountLabel,
  plisyMountLabel, plisyOversizeSurcharge, plisySagWarningWidthMm, type PlisyProfile,
} from "@/features/plisy/shared";
import { useProductPriceAdjustment } from "@/lib/price-adjustment";
import { addCartItem, type CartLineItem } from "@/lib/cart";
import { useBundleDiscountRules } from "@/lib/bundle-discount";
import s from "./WizModal.module.css";

export type WycenaSzyba = {
  id: string;
  nr: number;
  tkanina: string;
  listwa: string;
  szacSzerCm: number;
  szacWysCm: number;
  pewnosc: number | null;
  odniesienia: string[];
  /** zapisane w układzie: wymiary wpisane przez klienta i potwierdzenie pomiaru */
  szerMm?: number | null;
  wysMm?: number | null;
  zmierzone?: boolean;
  pomin?: boolean;
};

export type WycenaEtap = "wycena" | "kreator" | "podsumowanie";

type Row = WycenaSzyba & { szer: string; wys: string };
type Cena = { unit: number; total: number; split: boolean; widthMm: number; heightMm: number; qty: number };

const zl = (v: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
const zlKr = (v: number) => Math.round(v).toLocaleString("pl-PL") + " zł";
/** 1 szyba, 2–4 szyby, 5+ szyb (12–14 też „szyb”) */
const odm = (n: number, one: string, few: string, many: string) =>
  n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;
const liczba = (t: string) => parseFloat(t.replace(",", "."));

function cenaPlisy(profile: PlisyProfile, adjust: number, mountId: string, tkanina: string, listwa: string, wMm: number, hMm: number): Cena | null {
  if (!wMm || !hMm || wMm < profile.widthMinMm || hMm < profile.heightMinMm || hMm > profile.heightMaxMm || wMm > profile.widthMaxMm * 2) return null;
  const group = profile.fabricGroups.find((g) => g.swatches.some((sw) => sw.id === tkanina));
  const fabric = group?.swatches.find((sw) => sw.id === tkanina) || null;
  const hw = profile.hardware.find((h) => h.id === listwa) || profile.hardware[0];
  const mount = profile.mountOptions.find((m) => m.id === mountId) || null;
  if (!group || !hw) return null;
  const split = wMm > profile.widthMaxMm;
  const pieceW = split ? Math.floor(wMm / 2) : wMm;
  const matrix = calcPlisyPrice({ ...profile, priceAdjustmentPercent: profile.priceAdjustmentPercent + adjust }, pieceW, hMm, hw.id, group.id);
  if (matrix === null) return null;
  const unit = applyPriceDeltas(matrix, [mount, hw, fabric]);
  const qty = split ? 2 : 1;
  return { unit, total: Math.round(unit * qty * 100) / 100, split, widthMm: pieceW, heightMm: hMm, qty };
}

function mountDla(profile: PlisyProfile | null, montaz: "standard" | "bezinwazyjny"): string {
  if (!profile) return "";
  const m = profile.mountOptions.find((o) => isPlisyMountNonInvasive(o.id) === (montaz === "bezinwazyjny"));
  return m?.id || profile.mountOptions[0]?.id || "";
}

/** Cena zestawu do przycisku w modalu: wymiary klienta, a gdy ich nie ma - szacunkowe. */
export function useCenaZestawu(szyby: WycenaSzyba[], montaz: "standard" | "bezinwazyjny"): { suma: number; sztuk: number; szacunkowa: boolean } | null {
  const [profile, setProfile] = useState<PlisyProfile | null>(null);
  const adjust = useProductPriceAdjustment("plisy");
  useEffect(() => {
    void fetchPlisyProfile().then(setProfile);
  }, []);
  return useMemo(() => {
    if (!profile) return null;
    const mountId = mountDla(profile, montaz);
    let suma = 0;
    let sztuk = 0;
    let szacunkowa = false;
    for (const p of szyby) {
      if (p.pomin) continue;
      const wlasne = Boolean(p.szerMm && p.wysMm && p.zmierzone);
      if (!wlasne) szacunkowa = true;
      const c = cenaPlisy(profile, adjust, mountId, p.tkanina, p.listwa, wlasne ? p.szerMm || 0 : p.szacSzerCm * 10, wlasne ? p.wysMm || 0 : p.szacWysCm * 10);
      suma += c?.total || 0;
      sztuk += c?.qty || 0;
    }
    return { suma, sztuk, szacunkowa };
  }, [profile, adjust, szyby, montaz]);
}

/** Rysunek: gdzie mierzyć (szkło między listwami przyszybowymi albo skrzydło przy montażu bez wiercenia). */
function RysunekPomiaru({ bez }: { bez: boolean }) {
  return (
    <svg className={s.krokRys} viewBox="0 0 160 180" aria-hidden="true">
      <rect x="8" y="6" width="144" height="168" rx="6" fill="#f1f5f9" stroke="#94a3b8" strokeWidth="3" />
      <rect x="20" y="18" width="120" height="144" rx="3" fill={bez ? "#e2e8f0" : "#dbeafe"} stroke="#64748b" strokeWidth="2" />
      <rect x="28" y="26" width="104" height="128" fill="#bfdbfe" />
      {bez ? (
        <>
          <line x1="20" y1="12" x2="140" y2="12" stroke="#0f766e" strokeWidth="2.5" markerStart="url(#gs)" markerEnd="url(#gk)" />
          <line x1="14" y1="18" x2="14" y2="162" stroke="#0f766e" strokeWidth="2.5" markerStart="url(#gs)" markerEnd="url(#gk)" />
        </>
      ) : (
        <>
          <line x1="28" y1="90" x2="132" y2="90" stroke="#0f766e" strokeWidth="2.5" markerStart="url(#gs)" markerEnd="url(#gk)" />
          <line x1="80" y1="26" x2="80" y2="154" stroke="#0f766e" strokeWidth="2.5" markerStart="url(#gs)" markerEnd="url(#gk)" />
        </>
      )}
      <defs>
        <marker id="gk" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z" fill="#0f766e" /></marker>
        <marker id="gs" viewBox="0 0 10 10" refX="1" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M10 0L0 5L10 10z" fill="#0f766e" /></marker>
      </defs>
      <text x="80" y={bez ? 9 : 86} textAnchor="middle" fontSize="11" fontWeight="700" fill="#0f766e">szerokość</text>
      <text x={bez ? 22 : 86} y="70" fontSize="11" fontWeight="700" fill="#0f766e" transform={bez ? undefined : undefined}>wysokość</text>
    </svg>
  );
}

export default function WizWycena({ szyby, etap, montaz, pokoj, onEtap, onHover, onChange, onEvent, onDodano }: {
  szyby: WycenaSzyba[];
  etap: WycenaEtap;
  montaz: "standard" | "bezinwazyjny";
  /** nazwa pokoju (trafia do pozycji koszyka, żeby klient i produkcja wiedzieli, które okno) */
  pokoj: string;
  onDodano: (info: { sztuk: number; suma: number }) => void;
  onEtap: (e: WycenaEtap) => void;
  onHover: (id: string | null) => void;
  onChange: (szyby: WycenaSzyba[]) => void;
  onEvent: (name: string, dane: Record<string, string | number | boolean | null>) => void;
}) {
  const [profile, setProfile] = useState<PlisyProfile | null>(null);
  const [bracketId, setBracketId] = useState("bialy");
  const [krok, setKrok] = useState(0);
  const [rows, setRows] = useState<Row[]>(() => szyby.map((p) => ({
    ...p,
    // pola celowo PUSTE (właściciel 1.11): szacunku nie da się „zaakceptować” jednym kliknięciem -
    // klient musi sam wpisać wymiary, które zmierzył; szacunek służy tylko do orientacyjnej ceny
    szer: p.szerMm ? String(Math.round(p.szerMm / 10)) : "",
    wys: p.wysMm ? String(Math.round(p.wysMm / 10)) : "",
  })));
  const [blad, setBlad] = useState("");
  const adjust = useProductPriceAdjustment("plisy");
  const bundle = useBundleDiscountRules();

  useEffect(() => {
    void fetchPlisyProfile().then(setProfile);
  }, []);

  // tkanina / listwy zmieniane na zdjęciu - wiersze idą za nimi
  useEffect(() => {
    setRows((prev) => prev.map((r) => {
      const p = szyby.find((x) => x.id === r.id);
      return p ? { ...r, tkanina: p.tkanina, listwa: p.listwa } : r;
    }));
  }, [szyby]);

  const mountId = mountDla(profile, montaz);
  const mount = profile?.mountOptions.find((m) => m.id === mountId) || null;
  const nonInvasive = montaz === "bezinwazyjny";
  const wpisane = (r: Row) => liczba(r.szer) > 0 && liczba(r.wys) > 0;
  const cena = (r: Row, wlasne: boolean): Cena | null => {
    if (!profile) return null;
    const wMm = wlasne ? Math.round(liczba(r.szer) * 10) : Math.round((r.szacSzerCm || 0) * 10);
    const hMm = wlasne ? Math.round(liczba(r.wys) * 10) : Math.round((r.szacWysCm || 0) * 10);
    return cenaPlisy(profile, adjust, mountId, r.tkanina, r.listwa, wMm, hMm);
  };

  const aktywne = rows.filter((r) => !r.pomin);
  const gotowa = (r: Row) => wpisane(r) && Boolean(r.zmierzone) && cena(r, true) !== null;
  const wszystkieGotowe = aktywne.length > 0 && aktywne.every(gotowa);
  const ceny = aktywne.map((r) => ({ r, c: cena(r, gotowa(r)) }));
  const suma = ceny.reduce((a, x) => a + (x.c?.total || 0), 0);
  const sztuk = ceny.reduce((a, x) => a + (x.c?.qty || 0), 0);
  const rabat = useMemo(() => {
    const rule = bundle.plisy;
    if (!rule?.tiers?.length || sztuk < 2) return null;
    const tier = [...rule.tiers].sort((a, b) => b.fromQty - a.fromQty).find((t) => sztuk >= t.fromQty);
    return tier ? { percent: tier.percent, label: rule.label || "CAŁY DOM" } : null;
  }, [bundle, sztuk]);

  // kreator: bieżąca szyba podświetlona na zdjęciu
  const biezaca = etap === "kreator" ? rows[Math.min(krok, rows.length - 1)] : null;
  useEffect(() => {
    onHover(biezaca ? biezaca.id : null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etap, krok]);
  useEffect(() => () => onHover(null), [onHover]);

  // stan rodzica aktualizowany obok (nie w środku setRows - React nie pozwala zmieniać innego komponentu w trakcie renderu)
  const update = (id: string, patch: Partial<Row>) => {
    const next = rows.map((r) => (r.id === id ? { ...r, ...patch } : r));
    setRows(next);
    onChange(next.map(({ szer, wys, ...rest }) => ({
      ...rest,
      szerMm: Math.round(liczba(szer) * 10) || null,
      wysMm: Math.round(liczba(wys) * 10) || null,
    })));
  };

  const start = () => {
    setBlad("");
    // od pierwszej szyby, której klient jeszcze nie potwierdził
    const i = rows.findIndex((r) => !r.pomin && !gotowa(r));
    setKrok(i < 0 ? 0 : i);
    onEtap(i < 0 ? "podsumowanie" : "kreator");
    onEvent("wiz_kreator_start", { szyb: aktywne.length });
  };

  const dalej = () => {
    if (!biezaca) return;
    if (!biezaca.pomin) {
      if (!wpisane(biezaca)) return setBlad("Wpisz szerokość i wysokość, które zmierzyłeś/aś.");
      if (!cena(biezaca, true)) return setBlad(`Tego wymiaru nie produkujemy (szerokość ${profile?.widthMinMm ? profile.widthMinMm / 10 : 20}–${profile ? (profile.widthMaxMm * 2) / 10 : 300} cm, wysokość do ${profile ? profile.heightMaxMm / 10 : 250} cm) – sprawdź pomiar.`);
      if (!biezaca.zmierzone) return setBlad("Zaznacz, że wymiary są zmierzone według rysunku.");
      onEvent("wiz_wymiary", { szyba: biezaca.id, szer: biezaca.szer, wys: biezaca.wys, szac_szer: biezaca.szacSzerCm, szac_wys: biezaca.szacWysCm });
    }
    setBlad("");
    const nast = rows.findIndex((r, i) => i > krok && !r.pomin);
    if (nast < 0) {
      onEtap("podsumowanie");
    } else {
      setKrok(nast);
    }
  };

  const doKoszyka = () => {
    setBlad("");
    if (!profile || !wszystkieGotowe) {
      start();
      return;
    }
    const bracket = nonInvasive ? PLISY_BRACKET_COLORS.find((b) => b.id === bracketId) : undefined;
    for (const { r, c } of ceny) {
      if (!c) continue;
      const group = profile.fabricGroups.find((g) => g.swatches.some((sw) => sw.id === r.tkanina));
      const fabric = group?.swatches.find((sw) => sw.id === r.tkanina);
      const hw = profile.hardware.find((h) => h.id === r.listwa) || profile.hardware[0];
      const sagLimit = plisySagWarningWidthMm(group?.id || "");
      const item: CartLineItem = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        productSlug: "plisy",
        productLabel: profile.productName || "Plisy",
        hardwareLabel: hw?.label || "",
        meshLabel: `${group?.label || ""} — ${fabric?.label || ""}`,
        mountLabel: joinPlisyMountLabel(plisyMountLabel(mount), bracket?.label) || undefined,
        fabricColor: fabric?.color || undefined,
        hardwareColor: hw?.color || undefined,
        widthMm: c.widthMm,
        heightMm: c.heightMm,
        qty: c.qty,
        price: c.unit,
        total: c.total,
        createdAt: new Date().toISOString(),
        oversizeSurchargeAmount: plisyOversizeSurcharge(c.widthMm) || undefined,
        splitFromWidthMm: c.split ? Math.round(liczba(r.szer) * 10) : undefined,
        sagNoticeShown: c.widthMm > sagLimit || undefined,
        sagLimitMm: c.widthMm > sagLimit ? sagLimit : undefined,
        optionsNote: `${pokoj ? `${pokoj} · ` : ""}szyba ${r.nr} (z wizualizacji, wymiary klienta)`,
      };
      addCartItem(item);
    }
    onEvent("wiz_do_koszyka", { pozycji: ceny.length, sztuk, suma: Math.round(suma), pokoj });
    onDodano({ sztuk, suma });
  };

  if (!profile) return <p className={s.hint}>Wczytujemy cennik…</p>;

  // ------------------------------------------------------------ kreator: szyba po szybie
  if (etap === "kreator" && biezaca) {
    const nrAkt = aktywne.findIndex((r) => r.id === biezaca.id) + 1;
    const cWl = wpisane(biezaca) ? cena(biezaca, true) : null;
    return (
      <div className={s.kreator}>
        <div className={s.krokTop}>
          <span className={s.krokNr}>{biezaca.nr}</span>
          <p><b>Szyba {nrAkt} z {aktywne.length}</b><small>Podświetliliśmy ją na zdjęciu.</small></p>
        </div>
        <div className={s.krokPasek}>{aktywne.map((r) => <i key={r.id} className={gotowa(r) ? s.krokOk : r.id === biezaca.id ? s.krokTeraz : ""} />)}</div>
        <div className={s.krokBody}>
          <RysunekPomiaru bez={nonInvasive} />
          <div className={s.krokOpis}>
            <b>{nonInvasive ? "Zmierz skrzydło" : "Zmierz samą szybę"}</b>
            <small>{nonInvasive
              ? "Montaż bez wiercenia: szerokość skrzydła między uszczelkami i całą wysokość skrzydła."
              : "Montaż przykręcany: szerokość i wysokość szkła między listwami przyszybowymi (tam, gdzie szkło styka się z ramką)."}</small>
            <a href="/plisy/jak-mierzyc" target="_blank" rel="noopener" onClick={() => onEvent("wiz_jak_mierzyc", {})}>Jak mierzyć? Zobacz animację →</a>
          </div>
        </div>
        <div className={s.krokPola}>
          <label>Szerokość
            <span><input inputMode="decimal" autoFocus value={biezaca.szer} placeholder={`≈ ${Math.round(biezaca.szacSzerCm || 0)}`}
              onChange={(e) => { setBlad(""); update(biezaca.id, { szer: e.target.value, zmierzone: false }); }} /> cm</span>
          </label>
          <label>Wysokość
            <span><input inputMode="decimal" value={biezaca.wys} placeholder={`≈ ${Math.round(biezaca.szacWysCm || 0)}`}
              onChange={(e) => { setBlad(""); update(biezaca.id, { wys: e.target.value, zmierzone: false }); }} /> cm</span>
          </label>
        </div>
        <p className={s.krokSzac}>Szacunek ze zdjęcia: ok. {Math.round(biezaca.szacSzerCm || 0)} × {Math.round(biezaca.szacWysCm || 0)} cm – tylko podpowiedź, plisę produkujemy z Twoich wymiarów.</p>
        <label className={s.measured}>
          <input type="checkbox" checked={Boolean(biezaca.zmierzone)} disabled={!wpisane(biezaca)}
            onChange={(e) => { setBlad(""); update(biezaca.id, { zmierzone: e.target.checked }); }} />
          Zmierzyłem/am tę szybę według rysunku – wymiary są prawdziwe
        </label>
        {cWl ? <p className={s.krokCena}>Ta plisa: <b>{zl(cWl.total)}</b>{cWl.split ? " (2 plisy – szerokie okno)" : ""}</p> : null}
        {blad ? <p className={s.error}>{blad}</p> : null}
        <div className={s.krokAkcje}>
          <button type="button" className={s.link} onClick={() => { update(biezaca.id, { pomin: true }); setBlad(""); const n = rows.findIndex((r, i) => i > krok && !r.pomin); if (n < 0) onEtap("podsumowanie"); else setKrok(n); }}>
            Tej szyby nie zamawiam
          </button>
          <span />
          <button type="button" className={s.secondary} onClick={() => { const p = [...rows.keys()].reverse().find((i) => i < krok && !rows[i].pomin); if (p === undefined) onEtap("wycena"); else setKrok(p); }}>Wstecz</button>
          <button type="button" className={s.primary} onClick={dalej}>{rows.findIndex((r, i) => i > krok && !r.pomin) < 0 ? "Podsumowanie →" : "Następna szyba →"}</button>
        </div>
      </div>
    );
  }

  // ------------------------------------------------------------ wycena / podsumowanie
  const podsumowanie = etap === "podsumowanie";
  return (
    <div className={s.wycena}>
      {podsumowanie ? (
        <p className={s.hint}><b>Twój zestaw</b> – sprawdź wymiary jeszcze raz. Plisę produkujemy dokładnie na te wymiary.</p>
      ) : (
        <p className={s.hint}>
          <b>Ceny orientacyjne</b> z wymiarów odczytanych ze zdjęcia. Zamówisz po wpisaniu własnych wymiarów – przeprowadzimy Cię szyba po szybie.
        </p>
      )}
      <ol className={s.paneList}>
        {rows.map((r) => {
          const ok = gotowa(r);
          const c = r.pomin ? null : cena(r, ok);
          return (
            <li key={r.id} className={`${s.paneRow} ${ok ? s.paneOk : ""} ${r.pomin ? s.paneOff : ""}`}
              onMouseEnter={() => onHover(r.id)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(r.id)} onTouchStart={() => onHover(r.id)}>
              <span className={s.paneNr}>{r.nr}</span>
              <div className={s.paneMain}>
                {r.pomin ? <b>Nie zamawiasz</b> : ok ? <b>{r.szer} × {r.wys} cm <span className={s.badgeOk}>✓ zmierzone</span></b>
                  : <b>≈ {Math.round(r.szacSzerCm || 0)} × {Math.round(r.szacWysCm || 0)} cm <span className={s.badgeEst}>szacunek</span></b>}
              </div>
              <div className={s.panePrice}>
                {r.pomin ? null : c ? <><b>{ok ? "" : "ok. "}{zl(c.total)}</b>{c.split ? <small>2 plisy (szerokie okno)</small> : null}</> : <small>sprawdź wymiar</small>}
                <button type="button" className={s.link} onClick={() => {
                  if (r.pomin) update(r.id, { pomin: false });
                  setKrok(rows.indexOf(r));
                  onEtap("kreator");
                }}>{r.pomin ? "Przywróć" : ok ? "Popraw" : "Wpisz wymiary"}</button>
              </div>
            </li>
          );
        })}
      </ol>

      {nonInvasive && podsumowanie ? (
        <div className={s.chips}>
          <span className={s.small}>Kolor uchwytów bez wiercenia:</span>
          {PLISY_BRACKET_COLORS.map((b) => (
            <button key={b.id} type="button" className={b.id === bracketId ? s.chipOn : s.chip} onClick={() => setBracketId(b.id)}>{b.label}</button>
          ))}
        </div>
      ) : null}

      <div className={s.sumBox}>
        <div><span>{aktywne.length} {odm(aktywne.length, "szyba", "szyby", "szyb")} · {sztuk} {odm(sztuk, "plisa", "plisy", "plis")}</span>
          <b>{wszystkieGotowe ? "" : "ok. "}{zl(suma)}</b></div>
        {rabat ? (
          <p className={s.bundle}>
            {rabat.label}: −{rabat.percent} % na całe zamówienie przy {sztuk} szt. – w koszyku ok. <b>{zlKr(suma * (1 - rabat.percent / 100))}</b>.
          </p>
        ) : null}
        {blad ? <p className={s.error}>{blad}</p> : null}
        {wszystkieGotowe ? (
          <button type="button" className={s.ctaBig} onClick={doKoszyka}>Dodaj zestaw do koszyka</button>
        ) : (
          <button type="button" className={s.ctaBig} onClick={start}>Wpisz wymiary i zamów zestaw →</button>
        )}
        <p className={s.small}>{wszystkieGotowe ? "Rabat ilościowy nalicza koszyk. 30 dni na zwrot, 5 lat gwarancji." : "Bez wpisania własnych wymiarów nie da się zamówić – szacunek ze zdjęcia może się różnić o kilka centymetrów."}</p>
      </div>
    </div>
  );
}
