"use client";
import { NumericDone, numericEntryKey } from "@/app/components/numeric-entry";

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
import { openLiveChat } from "@/lib/live-chat";
import { installmentsAvailable, monthlyInstallment } from "@/lib/installments";
import { useInstallmentCount, useInstallmentSettings } from "@/lib/installment-settings";
import { inputToMm, looksLikeCm, mmToInput, readStoredUnit, storeUnit, timesTenFix, type DimensionUnit } from "@/features/plisy/wymiary";
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
export function useCenaZestawu(szyby: WycenaSzyba[], montaz: "standard" | "bezinwazyjny"): { suma: number; poRabacie: number; sztuk: number; szacunkowa: boolean } | null {
  const [profile, setProfile] = useState<PlisyProfile | null>(null);
  const adjust = useProductPriceAdjustment("plisy");
  const bundle = useBundleDiscountRules();
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
    const tier = [...(bundle.plisy?.tiers || [])].sort((a, b) => b.fromQty - a.fromQty).find((t) => sztuk >= t.fromQty);
    return { suma, poRabacie: tier ? Math.round(suma * (1 - tier.percent / 100) * 100) / 100 : suma, sztuk, szacunkowa };
  }, [profile, adjust, szyby, montaz, bundle]);
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

export default function WizWycena({ szyby, etap, montaz, pokoj, wizToken, onEtap, onHover, onChange, onEvent, onDodano, onBezMiarki }: {
  /** token wizualizacji - trafia do pozycji koszyka i zamówienia */
  wizToken: string;
  szyby: WycenaSzyba[];
  etap: WycenaEtap;
  montaz: "standard" | "bezinwazyjny";
  /** nazwa pokoju (trafia do pozycji koszyka, żeby klient i produkcja wiedzieli, które okno) */
  pokoj: string;
  onDodano: (info: { sztuk: number; suma: number }) => void;
  /** „Nie masz teraz miarki?” - zapis wizualizacji na e-mail i powrót później */
  onBezMiarki: () => void;
  onEtap: (e: WycenaEtap) => void;
  onHover: (id: string | null) => void;
  onChange: (szyby: WycenaSzyba[]) => void;
  onEvent: (name: string, dane: Record<string, string | number | boolean | null>) => void;
}) {
  const [profile, setProfile] = useState<PlisyProfile | null>(null);
  const [bracketId, setBracketId] = useState("bialy");
  const [krok, setKrok] = useState(0);
  // cm/mm jak w konfiguratorze plis (właściciel 1.11) - ta sama zapamiętana jednostka i te same przeliczenia
  const [unit, setUnit] = useState<DimensionUnit>(readStoredUnit);
  const [rows, setRows] = useState<Row[]>(() => {
    const u = readStoredUnit();
    return szyby.map((p) => ({
      ...p,
      // pola celowo PUSTE (właściciel 1.11): szacunku nie da się „zaakceptować” jednym kliknięciem -
      // klient musi sam wpisać wymiary, które zmierzył; szacunek służy tylko do orientacyjnej ceny
      szer: p.szerMm ? mmToInput(p.szerMm, u) : "",
      wys: p.wysMm ? mmToInput(p.wysMm, u) : "",
    }));
  });
  // mini-okno: wpisane wymiary = szacunek ze zdjęcia → „na pewno zmierzyłeś/aś?”
  const [czyZmierzone, setCzyZmierzone] = useState(false);
  const [blad, setBlad] = useState("");
  const adjust = useProductPriceAdjustment("plisy");
  const bundle = useBundleDiscountRules();
  const raty = useInstallmentSettings();
  const [ileRat] = useInstallmentCount();

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
  const wMmOf = (r: Row) => inputToMm(r.szer, unit);
  const hMmOf = (r: Row) => inputToMm(r.wys, unit);
  const wpisane = (r: Row) => wMmOf(r) > 0 && hMmOf(r) > 0;
  const cena = (r: Row, wlasne: boolean): Cena | null => {
    if (!profile) return null;
    const wMm = wlasne ? wMmOf(r) : Math.round((r.szacSzerCm || 0) * 10);
    const hMm = wlasne ? hMmOf(r) : Math.round((r.szacWysCm || 0) * 10);
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
    return tier ? { percent: tier.percent, label: (rule.label || "CAŁY DOM").split(":")[0].trim() } : null; // sama nazwa, bez progów w nawiasie
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
      szerMm: inputToMm(szer, unit) || null,
      wysMm: inputToMm(wys, unit) || null,
    })));
  };
  // przełącznik NIE przelicza wpisanych liczb - jak w konfiguratorze (kto wpisał 55, myśląc o cm, ma mieć 55 cm)
  const zmienJednostke = (u: DimensionUnit) => {
    if (u === unit) return;
    setUnit(u);
    storeUnit(u);
    onEvent("wiz_jednostka", { unit: u });
  };
  const jedn = unit === "cm" ? "cm" : "mm";
  const wJedn = (mm: number) => (unit === "cm" ? String(Math.round(mm) / 10).replace(".", ",") : String(Math.round(mm)));

  const start = () => {
    setBlad("");
    // od pierwszej szyby, której klient jeszcze nie potwierdził
    const i = rows.findIndex((r) => !r.pomin && !gotowa(r));
    setKrok(i < 0 ? 0 : i);
    onEtap(i < 0 ? "podsumowanie" : "kreator");
    onEvent("wiz_kreator_start", { szyb: aktywne.length });
  };

  const dalej = (potwierdzone = false) => {
    if (!biezaca) return;
    if (!biezaca.pomin) {
      if (!wpisane(biezaca)) return setBlad("Wpisz szerokość i wysokość, które zmierzyłeś/aś.");
      if (!cena(biezaca, true)) {
        const p = profile;
        return setBlad(p ? `Tego wymiaru nie produkujemy: szerokość ${wJedn(p.widthMinMm)}–${wJedn(p.widthMaxMm * 2)} ${jedn}, wysokość ${wJedn(p.heightMinMm)}–${wJedn(p.heightMaxMm)} ${jedn} – sprawdź pomiar.` : "Sprawdź pomiar.");
      }
      // właściciel 1.11: zgody nie wymagamy, gdy wymiary różnią się od szacunku; gdy są takie same (±1 cm) - pytamy
      const takieSame = Math.abs(wMmOf(biezaca) - (biezaca.szacSzerCm || 0) * 10) <= 10 && Math.abs(hMmOf(biezaca) - (biezaca.szacWysCm || 0) * 10) <= 10;
      if (takieSame && !potwierdzone) {
        setCzyZmierzone(true);
        return;
      }
      update(biezaca.id, { zmierzone: true });
      if (takieSame) onEvent("wiz_wymiar_potwierdzony", { szyba: biezaca.id, szer_mm: wMmOf(biezaca), wys_mm: hMmOf(biezaca) });
      onEvent("wiz_wymiary", { szyba: biezaca.id, szer_mm: wMmOf(biezaca), wys_mm: hMmOf(biezaca), szac_szer: biezaca.szacSzerCm, szac_wys: biezaca.szacWysCm, unit });
    }
    setBlad("");
    setCzyZmierzone(false);
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
        splitFromWidthMm: c.split ? wMmOf(r) : undefined,
        sagNoticeShown: c.widthMm > sagLimit || undefined,
        sagLimitMm: c.widthMm > sagLimit ? sagLimit : undefined,
        wizToken,
        optionsNote: `Z Twojego okna · ${pokoj ? `${pokoj} · ` : ""}szyba ${r.nr} (wymiary klienta)`,
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
        <div className={s.chips}>
          <button type="button" className={unit === "cm" ? s.chipOn : s.chip} onClick={() => zmienJednostke("cm")}>cm</button>
          <button type="button" className={unit === "mm" ? s.chipOn : s.chip} onClick={() => zmienJednostke("mm")}>mm</button>
        </div>
        <div className={s.krokPola} data-numeric-entry="">
          <label>Szerokość
            <span><input type="text" inputMode="decimal" data-numeric-field="" enterKeyHint="next" onKeyDown={numericEntryKey} autoComplete="off" value={biezaca.szer} placeholder={`≈ ${wJedn((biezaca.szacSzerCm || 0) * 10)}`}
              onChange={(e) => { setBlad(""); setCzyZmierzone(false); update(biezaca.id, { szer: e.target.value, zmierzone: false }); }} /> {jedn}</span>
          </label>
          <label>Wysokość
            <span><input type="text" inputMode="decimal" data-numeric-field="" enterKeyHint="done" onKeyDown={numericEntryKey} autoComplete="off" value={biezaca.wys} placeholder={`≈ ${wJedn((biezaca.szacWysCm || 0) * 10)}`}
              onChange={(e) => { setBlad(""); setCzyZmierzone(false); update(biezaca.id, { wys: e.target.value, zmierzone: false }); }} /> {jedn}</span>
          </label>
          <NumericDone />
        </div>
        {(() => {
          // „15 × 120” w cm albo „1200 × 1500” w cm (to mm), „60 × 120” w mm (to cm) - jak w konfiguratorze
          const w = wMmOf(biezaca);
          const h = hMmOf(biezaca);
          if (!w || !h || cena(biezaca, true)) return null;
          const fix = timesTenFix(w, h, unit, profile);
          if (fix) {
            return (
              <p className={s.krokJedn}>
                {fix.fromMm ? "Wpisujesz w milimetrach? " : ""}Czy chodziło Ci o {wJedn(fix.widthMm)} × {wJedn(fix.heightMm)} {jedn}?{" "}
                <button type="button" className={s.link} onClick={() => { onEvent("wiz_jednostka_poprawka", { z_w: w, z_h: h, na_w: fix.widthMm, na_h: fix.heightMm }); update(biezaca.id, { szer: mmToInput(fix.widthMm, unit), wys: mmToInput(fix.heightMm, unit), zmierzone: false }); }}>
                  {fix.fromMm ? "Tak, przelicz na cm" : "Tak, popraw"}
                </button>
              </p>
            );
          }
          if (looksLikeCm(w, h, unit, profile)) {
            return (
              <p className={s.krokJedn}>
                {biezaca.szer} × {biezaca.wys} mm to tylko {w / 10} × {h / 10} cm. To centymetry?{" "}
                <button type="button" className={s.link} onClick={() => zmienJednostke("cm")}>Tak, to centymetry</button>
              </p>
            );
          }
          return null;
        })()}
        <p className={s.krokSzac}>Na oko ok. {wJedn((biezaca.szacSzerCm || 0) * 10)} × {wJedn((biezaca.szacWysCm || 0) * 10)} {jedn} – nie zamawiaj po tym. Zmierz miarką, to 2 minuty.</p>
        <p className={s.krokPomoc}>
          <button type="button" className={s.link} onClick={onBezMiarki}>Nie masz teraz miarki? Wyślij sobie tę wizualizację na e-mail i dokończ później</button>
          <button type="button" className={s.link} onClick={() => { onEvent("wiz_czat", { krok: "wymiary" }); openLiveChat("Mam pytanie o pomiar plisy (wizualizacja)"); }}>Masz pytanie o pomiar? Napisz na czacie</button>
        </p>
        {cWl ? <p className={s.krokCena}>Ta plisa: <b>{zl(cWl.total)}</b>{cWl.split ? " (2 plisy – szerokie okno)" : ""}</p> : null}
        {blad ? <p className={s.error}>{blad}</p> : null}
        <div className={s.krokAkcje}>
          <button type="button" className={s.link} onClick={() => { update(biezaca.id, { pomin: true }); setBlad(""); const n = rows.findIndex((r, i) => i > krok && !r.pomin); if (n < 0) onEtap("podsumowanie"); else setKrok(n); }}>
            Tej szyby nie zamawiam
          </button>
          <span />
          <button type="button" className={s.secondary} onClick={() => { const p = [...rows.keys()].reverse().find((i) => i < krok && !rows[i].pomin); if (p === undefined) onEtap("wycena"); else setKrok(p); }}>Wstecz</button>
          <button type="button" className={s.primary} onClick={() => dalej()}>{rows.findIndex((r, i) => i > krok && !r.pomin) < 0 ? "Podsumowanie →" : "Następna szyba →"}</button>
        </div>
        {czyZmierzone ? (
          <div className={s.krokPytanie} role="alertdialog" aria-label="Czy na pewno zmierzone?">
            <div>
              <b>Na pewno zmierzyłeś/aś szybę miarką?</b>
              <small>Wpisane wymiary są takie same jak nasz szacunek ze zdjęcia (≈ {wJedn((biezaca.szacSzerCm || 0) * 10)} × {wJedn((biezaca.szacWysCm || 0) * 10)} {jedn}). Plisę produkujemy dokładnie na ten wymiar.</small>
              <div className={s.krokPytanieAkcje}>
                <button type="button" className={s.secondary} onClick={() => setCzyZmierzone(false)}>Poprawię wymiary</button>
                <button type="button" className={s.primary} onClick={() => dalej(true)}>Tak, zmierzyłem/am</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // ------------------------------------------------------------ wycena / podsumowanie
  // (właściciel 1.11: „ta sekcja już sprzedaje” - wymiary rzucają się w oczy, cena jak w sklepie, promocja, wysyłka, PayPo, raty, CTA)
  const podsumowanie = etap === "podsumowanie";
  const poRabacie = rabat ? Math.round(suma * (1 - rabat.percent / 100) * 100) / 100 : suma;
  const rata = raty.enabled && installmentsAvailable(poRabacie) ? monthlyInstallment(poRabacie, ileRat, raty.apr) : 0;
  return (
    <div className={s.wycena}>
      {!wszystkieGotowe ? (
        <div className={s.miarka}>
          <span aria-hidden="true">📏</span>
          <p><b>Ceny orientacyjne – wymiary odczytane ze zdjęcia.</b> Przed zamówieniem zmierz okno: 2 minuty, przeprowadzimy Cię szyba po szybie.</p>
          <button type="button" className={s.ctaBig} onClick={start}>📏 Wpisz dokładne wymiary</button>
        </div>
      ) : (
        <p className={s.hint}><b>✓ Wymiary potwierdzone</b> – plisy wyprodukujemy dokładnie na te wymiary.</p>
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
                {r.pomin ? <b>Nie zamawiasz</b> : ok ? <b>{wJedn(wMmOf(r))} × {wJedn(hMmOf(r))} {jedn} <span className={s.badgeOk}>✓ zmierzone</span></b>
                  : <b>≈ {Math.round(r.szacSzerCm || 0)} × {Math.round(r.szacWysCm || 0)} cm <span className={s.badgeSzac}>szacunek – zmierz</span></b>}
                {r.pomin ? null : c ? <small>{ok ? "" : "ok. "}{zl(c.total)}{c.split ? " · 2 plisy (szerokie okno)" : ""}</small> : <small>sprawdź wymiar</small>}
              </div>
              <button type="button" className={ok || r.pomin ? s.pigulkaJasna : s.pigulka} onClick={() => {
                if (r.pomin) update(r.id, { pomin: false });
                setKrok(rows.indexOf(r));
                onEtap("kreator");
              }}>{r.pomin ? "Przywróć" : ok ? "Popraw" : "📏 Wpisz wymiary"}</button>
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

      <div className={s.cenaBox}>
        <span className={s.small}>{aktywne.length} {odm(aktywne.length, "szyba", "szyby", "szyb")} · {sztuk} {odm(sztuk, "plisa", "plisy", "plis")}{wszystkieGotowe ? "" : " · cena orientacyjna"}</span>
        <div className={s.cenaRzad}>
          {rabat ? <s>{zl(suma)}</s> : null}
          <b>{wszystkieGotowe ? "" : "ok. "}{zl(poRabacie)}</b>
        </div>
        {rabat ? (
          <>
            <span className={s.oszczedzasz}>Oszczędzasz {zl(suma - poRabacie)}</span>
            <span className={s.promoLinia}>{sztuk} {odm(sztuk, "plisa", "plisy", "plis")} = −{rabat.percent} % na całe zamówienie ({rabat.label})</span>
          </>
        ) : null}
      </div>
      <ul className={s.zaufanie}>
        <li>🚚 Wysyłka 0 zł</li>
        {raty.paypoEnabled ? <li>💳 PayPo – zapłać za 30 dni</li> : null}
        {rata > 0 ? <li>Raty od {zl(rata)}/mies.</li> : null}
        <li>🛡️ 5 lat gwarancji · ↩️ 30 dni na zwrot</li>
      </ul>
      {blad ? <p className={s.error}>{blad}</p> : null}
      {/* CTA zawsze widoczne - przyklejone do dołu karty */}
      <div className={s.ctaDol}>
        {wszystkieGotowe ? (
          <button type="button" className={s.ctaBig} onClick={doKoszyka}>
            Dodaj {sztuk === 1 ? "plisę" : `wszystkie ${sztuk} ${odm(sztuk, "plisę", "plisy", "plis")}`} do koszyka · {zlKr(poRabacie)}
            <small>wymiary potwierdzone ✓ · rabat nalicza koszyk</small>
          </button>
        ) : (
          <button type="button" className={s.ctaBig} onClick={start}>
            Dodaj do koszyka · ok. {zlKr(poRabacie)}
            <small>najpierw potwierdzisz wymiary – 2 min</small>
          </button>
        )}
      </div>
    </div>
  );
}
