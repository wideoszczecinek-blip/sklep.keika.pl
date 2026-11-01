"use client";

/**
 * Wizualizator: lista okien (szyb) z wymiarami i wyceną.
 *  - wymiary z etapu G (perspektywa + przedmioty o znanej wielkości) są SZACUNKOWE - wyraźnie oznaczone,
 *    dają cenę orientacyjną z cennika konfiguratora (features/plisy/shared.ts, ten sam algorytm),
 *  - do koszyka dopiero po wpisaniu wymiarów zmierzonych według instrukcji i potwierdzeniu przy każdej szybie,
 *  - najechanie / dotknięcie wiersza podświetla szybę na zdjęciu (onHover).
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

type Row = WycenaSzyba & { szer: string; wys: string };

const zl = (v: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
/** 1 szyba, 2–4 szyby, 5+ szyb (12–14 też „szyb”) */
const odm = (n: number, one: string, few: string, many: string) =>
  n === 1 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many;

export default function WizWycena({ szyby, onHover, onChange, onEvent }: {
  szyby: WycenaSzyba[];
  onHover: (id: string | null) => void;
  onChange: (szyby: WycenaSzyba[]) => void;
  onEvent: (name: string, dane: Record<string, string | number | boolean | null>) => void;
}) {
  const [profile, setProfile] = useState<PlisyProfile | null>(null);
  const [mountId, setMountId] = useState("");
  const [bracketId, setBracketId] = useState("bialy");
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
    void fetchPlisyProfile().then((p) => {
      setProfile(p);
      if (p && !mountId) setMountId(p.mountOptions.find((m) => !isPlisyMountNonInvasive(m.id))?.id || p.mountOptions[0]?.id || "");
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // tkanina / listwy zmieniane na zdjęciu - wiersze idą za nimi
  useEffect(() => {
    setRows((prev) => prev.map((r) => {
      const p = szyby.find((x) => x.id === r.id);
      return p ? { ...r, tkanina: p.tkanina, listwa: p.listwa } : r;
    }));
  }, [szyby]);

  const mount = profile?.mountOptions.find((m) => m.id === mountId) || null;
  const nonInvasive = Boolean(mount && isPlisyMountNonInvasive(mount.id));

  const wpisane = (r: Row) => parseFloat(r.szer.replace(",", ".")) > 0 && parseFloat(r.wys.replace(",", ".")) > 0;

  // cena z wymiarów wpisanych przez klienta; gdy ich nie ma - orientacyjnie z szacunku
  const cena = (r: Row): { unit: number; total: number; split: boolean; widthMm: number; heightMm: number; qty: number } | null => {
    if (!profile) return null;
    const wMm = wpisane(r) ? Math.round(parseFloat(r.szer.replace(",", ".")) * 10) : Math.round((r.szacSzerCm || 0) * 10);
    const hMm = wpisane(r) ? Math.round(parseFloat(r.wys.replace(",", ".")) * 10) : Math.round((r.szacWysCm || 0) * 10);
    if (!wMm || !hMm || wMm < profile.widthMinMm || hMm < profile.heightMinMm || hMm > profile.heightMaxMm || wMm > profile.widthMaxMm * 2) return null;
    const group = profile.fabricGroups.find((g) => g.swatches.some((sw) => sw.id === r.tkanina));
    const fabric = group?.swatches.find((sw) => sw.id === r.tkanina) || null;
    const hw = profile.hardware.find((h) => h.id === r.listwa) || profile.hardware[0];
    if (!group || !hw) return null;
    const split = wMm > profile.widthMaxMm;
    const pieceW = split ? Math.floor(wMm / 2) : wMm;
    const matrix = calcPlisyPrice({ ...profile, priceAdjustmentPercent: profile.priceAdjustmentPercent + adjust }, pieceW, hMm, hw.id, group.id);
    if (matrix === null) return null;
    const unit = applyPriceDeltas(matrix, [mount, hw, fabric]);
    const qty = split ? 2 : 1;
    return { unit, total: Math.round(unit * qty * 100) / 100, split, widthMm: pieceW, heightMm: hMm, qty };
  };

  const aktywne = rows.filter((r) => !r.pomin);
  const ceny = aktywne.map((r) => ({ r, c: cena(r) }));
  const suma = ceny.reduce((a, x) => a + (x.c?.total || 0), 0);
  const sztuk = ceny.reduce((a, x) => a + (x.c?.qty || 0), 0);
  const wszystkieZmierzone = aktywne.length > 0 && aktywne.every((r) => wpisane(r) && r.zmierzone) && ceny.every((x) => x.c);
  const rabat = useMemo(() => {
    const rule = bundle.plisy;
    if (!rule?.tiers?.length || sztuk < 2) return null;
    const tier = [...rule.tiers].sort((a, b) => b.fromQty - a.fromQty).find((t) => sztuk >= t.fromQty);
    return tier ? { percent: tier.percent, label: rule.label || "CAŁY DOM" } : null;
  }, [bundle, sztuk]);

  const update = (id: string, patch: Partial<Row>) => {
    setRows((prev) => {
      const next = prev.map((r) => (r.id === id ? { ...r, ...patch } : r));
      onChange(next.map(({ szer, wys, ...rest }) => ({
        ...rest,
        szerMm: Math.round(parseFloat(szer.replace(",", ".")) * 10) || null,
        wysMm: Math.round(parseFloat(wys.replace(",", ".")) * 10) || null,
      })));
      return next;
    });
  };

  const doKoszyka = () => {
    setBlad("");
    if (!profile || !wszystkieZmierzone) {
      setBlad("Najpierw zmierz każdą szybę według instrukcji, wpisz swoje wymiary w puste pola i zaznacz „Zmierzyłem”.");
      return;
    }
    if (nonInvasive && !bracketId) {
      setBlad("Wybierz kolor uchwytów montażu bezinwazyjnego.");
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
        splitFromWidthMm: c.split ? Math.round(parseFloat(r.szer.replace(",", ".")) * 10) : undefined,
        sagNoticeShown: c.widthMm > sagLimit || undefined,
        sagLimitMm: c.widthMm > sagLimit ? sagLimit : undefined,
      };
      addCartItem(item);
    }
    onEvent("wiz_do_koszyka", { pozycji: ceny.length, sztuk, suma: Math.round(suma) });
    window.location.href = "/koszyk";
  };

  if (!profile) return <p className={s.hint}>Wczytujemy cennik…</p>;

  return (
    <div className={s.wycena}>
      <p className={s.hint}>
        <b>Wymiary „≈” to tylko szacunek ze zdjęcia</b> (perspektywa, klamka, parapet…) – pokazujemy po nich orientacyjną cenę.
        Plisę produkujemy na wymiar, więc <b>zmierz każdą szybę</b> według instrukcji i <b>wpisz własne wymiary w puste pola</b> – bez tego nie da się zamówić.{" "}
        <a href="/plisy/jak-mierzyc" target="_blank" rel="noopener" onClick={() => onEvent("wiz_jak_mierzyc", {})}>Jak mierzyć? →</a>
      </p>
      <div className={s.chips}>
        {profile.mountOptions.map((m) => (
          <button key={m.id} type="button" className={m.id === mountId ? s.chipOn : s.chip} onClick={() => setMountId(m.id)}>
            {isPlisyMountNonInvasive(m.id) ? "Bez wiercenia" : "Przykręcana (standard)"}
          </button>
        ))}
      </div>
      {nonInvasive ? (
        <div className={s.chips}>
          <span className={s.small}>Kolor uchwytów:</span>
          {PLISY_BRACKET_COLORS.map((b) => (
            <button key={b.id} type="button" className={b.id === bracketId ? s.chipOn : s.chip} onClick={() => setBracketId(b.id)}>{b.label}</button>
          ))}
        </div>
      ) : null}
      <p className={s.small}>{nonInvasive ? "Bez wiercenia: mierzysz szerokość skrzydła między uszczelkami i całą wysokość skrzydła." : "Przykręcana: mierzysz szerokość i wysokość samej szyby (światło szyby, między listwami przyszybowymi)."}</p>

      <ol className={s.paneList}>
        {rows.map((r) => {
          const c = r.pomin ? null : cena(r);
          return (
            <li key={r.id} className={`${s.paneRow} ${r.zmierzone ? s.paneOk : ""} ${r.pomin ? s.paneOff : ""}`}
              onMouseEnter={() => onHover(r.id)} onMouseLeave={() => onHover(null)} onFocus={() => onHover(r.id)} onTouchStart={() => onHover(r.id)}>
              <span className={s.paneNr}>{r.nr}</span>
              <div className={s.paneMain}>
                <div className={s.paneDims}>
                  <label>szer. <input inputMode="decimal" value={r.szer} disabled={r.pomin} placeholder={`≈ ${Math.round(r.szacSzerCm || 0)}`}
                    onChange={(e) => update(r.id, { szer: e.target.value, zmierzone: false })} /> cm</label>
                  <span>×</span>
                  <label>wys. <input inputMode="decimal" value={r.wys} disabled={r.pomin} placeholder={`≈ ${Math.round(r.szacWysCm || 0)}`}
                    onChange={(e) => update(r.id, { wys: e.target.value, zmierzone: false })} /> cm</label>
                  {!wpisane(r) ? (
                    <span className={s.badgeEst} title={r.odniesienia.length ? `Szacunek na podstawie: ${r.odniesienia.join(", ")}` : "Szacunek ze zdjęcia"}>
                      ≈ szacunek {Math.round(r.szacSzerCm || 0)} × {Math.round(r.szacWysCm || 0)} cm – wpisz swoje wymiary
                    </span>
                  ) : r.zmierzone ? <span className={s.badgeOk}>✓ zmierzone</span> : <span className={s.badgeEst}>potwierdź pomiar poniżej</span>}
                </div>
                <label className={s.measured}>
                  <input type="checkbox" checked={Boolean(r.zmierzone)} disabled={r.pomin || !wpisane(r)}
                    onChange={(e) => {
                      update(r.id, { zmierzone: e.target.checked });
                      if (e.target.checked) onEvent("wiz_wymiary", { szyba: r.id, szer: r.szer, wys: r.wys, szac_szer: r.szacSzerCm, szac_wys: r.szacWysCm });
                    }} />
                  Zmierzyłem/am tę szybę według instrukcji – wymiary są prawdziwe
                </label>
                {r.odniesienia.length && !r.zmierzone ? <small className={s.small}>Szacunek ze zdjęcia: {r.odniesienia.join(", ")}.</small> : null}
              </div>
              <div className={s.panePrice}>
                {r.pomin ? <small>pominięta</small> : c ? (
                  <>
                    <b>{r.zmierzone ? "" : "ok. "}{zl(c.total)}</b>
                    <small>{r.zmierzone ? "cena z konfiguratora" : wpisane(r) ? "cena dla wpisanych wymiarów" : "cena szacunkowa"}{c.split ? " · 2 plisy (szerokie okno)" : ""}</small>
                  </>
                ) : <small>poza zakresem produkcji – sprawdź wymiar</small>}
                <button type="button" className={s.link} onClick={() => update(r.id, { pomin: !r.pomin })}>{r.pomin ? "Przywróć" : "Nie zamawiam"}</button>
              </div>
            </li>
          );
        })}
      </ol>

      <div className={s.sumBox}>
        <div><span>{aktywne.length} {odm(aktywne.length, "szyba", "szyby", "szyb")} · {sztuk} {odm(sztuk, "plisa", "plisy", "plis")}</span>
          <b>{wszystkieZmierzone ? "" : "ok. "}{zl(suma)}</b></div>
        {rabat ? (
          <p className={s.bundle}>
            Rabat ilościowy: −{rabat.percent} % na całe zamówienie przy {sztuk} szt. (ok. −{zl(Math.round(suma * rabat.percent) / 100)}) – policzy go koszyk.
          </p>
        ) : null}
        {blad ? <p className={s.error}>{blad}</p> : null}
        <button type="button" className={s.primary} onClick={doKoszyka} disabled={!wszystkieZmierzone}>
          {wszystkieZmierzone ? "Dodaj wszystkie do koszyka" : "Zmierz szyby, aby zamówić"}
        </button>
        <p className={s.small}>Cena orientacyjna przy wymiarach szacunkowych; ostateczna liczy się z wymiarów, które wpiszesz. Rabat ilościowy nalicza koszyk.</p>
      </div>
    </div>
  );
}
