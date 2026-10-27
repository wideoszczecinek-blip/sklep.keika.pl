"use client";

// Zamawianie próbek tkanin plis (27.10.2026). Klient wybiera do 5 próbek z tych, które mamy na stanie
// (CRM → Sklep WWW → Próbki tkanin), płaci tylko za dostawę - paczkomat albo kurier - i trafia na stronę
// zamówienia, gdzie płaci dowolną metodą (te same kafelki co przy ponowieniu płatności). Cenę dostawy,
// dostępność i limit liczy serwer (core/lib/shop_samples.php).

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { PaczkomatPoint } from "@/app/api/paczkomaty/route";
import { getSessionToken } from "@/lib/analytics-context";
import { openLiveChat } from "@/lib/live-chat";
import { readMarketingConsent } from "@/lib/marketing-consent";
import { fetchSamplesCatalog, submitSamplesOrder, type SampleGroup, type SampleSwatch, type SamplesCatalog } from "@/lib/samples";
import { trackShopStep } from "@/lib/track-step";
import styles from "./probki.module.css";

const PaczkomatPicker = dynamic(() => import("@/app/components/paczkomat-picker"), { ssr: false });

type Picked = { groupId: string; groupLabel: string; swatch: SampleSwatch };

const zl = (v: number) => v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " zł";
const colorName = (s: SampleSwatch) => s.label.replace(s.code, "").replace(/[()]/g, "").trim() || s.label;

export default function SamplesClient() {
  const [catalog, setCatalog] = useState<SamplesCatalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [groupId, setGroupId] = useState("");
  const [onlyAvailable, setOnlyAvailable] = useState(false);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [info, setInfo] = useState<{ group: string; swatch: SampleSwatch } | null>(null);
  const [notice, setNotice] = useState("");
  const [delivery, setDelivery] = useState<"paczkomat" | "kurier">("paczkomat");
  const [point, setPoint] = useState<PaczkomatPoint | null>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", street: "", postcode: "", city: "" });
  const [terms, setTerms] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchSamplesCatalog()
      .then((c) => {
        setCatalog(c);
        const groups = c.groups || [];
        if (groups[0]) setGroupId(groups[0].id);
        // Wejście z konfiguratora: ?t=<kolekcja>.<tkanina>,… - zaznaczamy te, które mają próbkę.
        const pre = new URLSearchParams(window.location.search).get("t") || "";
        const wanted = pre.split(",").map((x) => x.split(".")).filter((x) => x.length === 2);
        const initial: Picked[] = [];
        for (const [g, s] of wanted) {
          const group = groups.find((x) => x.id === g);
          const sw = group?.swatches.find((x) => x.id === s);
          if (group && sw && sw.available && initial.length < (c.max || 5)) initial.push({ groupId: group.id, groupLabel: group.label, swatch: sw });
          if (group && wanted.length === 1) setGroupId(group.id);
        }
        if (initial.length) setPicked(initial);
        trackShopStep("samples_open", c.enabled ? "enabled" : "disabled", { preselected: initial.length });
      })
      .catch(() => setLoadError("Nie udało się wczytać tkanin. Odśwież stronę za chwilę."));
  }, []);

  const max = catalog?.max || 5;
  const price = delivery === "kurier" ? catalog?.prices?.kurier ?? 13.9 : catalog?.prices?.paczkomat ?? 8.9;
  const group: SampleGroup | undefined = catalog?.groups?.find((g) => g.id === groupId);
  const availableCount = useMemo(() => (catalog?.groups || []).reduce((n, g) => n + g.swatches.filter((s) => s.available).length, 0), [catalog]);
  const isPicked = (g: string, s: string) => picked.some((p) => p.groupId === g && p.swatch.id === s);

  function toggle(g: SampleGroup, s: SampleSwatch) {
    setError("");
    if (!s.available) {
      setInfo({ group: g.label, swatch: s });
      trackShopStep("samples_unavailable_info", `${g.id}.${s.id}`);
      return;
    }
    if (isPicked(g.id, s.id)) {
      setPicked((prev) => prev.filter((p) => !(p.groupId === g.id && p.swatch.id === s.id)));
      setNotice("");
      return;
    }
    if (picked.length >= max) {
      setNotice(`Można wybrać ${max} próbek - odznacz jedną, żeby dodać inną.`);
      return;
    }
    setPicked((prev) => [...prev, { groupId: g.id, groupLabel: g.label, swatch: s }]);
    setNotice("");
    trackShopStep("samples_pick", `${g.id}.${s.id}`, { count: picked.length + 1 });
  }

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!picked.length) return setError("Wybierz przynajmniej jedną próbkę.");
    if (form.name.trim().length < 3) return setError("Podaj imię i nazwisko.");
    if (form.phone.replace(/\D/g, "").length < 9) return setError("Podaj numer telefonu - przyda się kurierowi albo do powiadomienia z paczkomatu.");
    if (!/^\S+@\S+\.\S+$/.test(form.email.trim())) return setError("Podaj poprawny adres e-mail.");
    if (delivery === "paczkomat" && !point) return setError("Wybierz paczkomat na mapie albo wyszukaj go po mieście.");
    if (delivery === "kurier" && (!form.street.trim() || !/^\d{2}-\d{3}$/.test(form.postcode.trim()) || !form.city.trim())) {
      return setError("Podaj adres dostawy: ulicę z numerem, kod pocztowy (00-000) i miejscowość.");
    }
    if (!terms) return setError("Zaakceptuj regulamin sklepu.");

    let shipping = { city: form.city.trim(), postcode: form.postcode.trim(), address_line_1: form.street.trim() };
    if (delivery === "paczkomat" && point) {
      const m = String(point.address || "").match(/^(.*?),?\s*(\d{2}-\d{3})\s+(.*)$/);
      shipping = { address_line_1: m ? m[1].trim() : point.address, postcode: m ? m[2] : "", city: m ? m[3].trim() : "" };
    }
    const marketing = readMarketingConsent();
    setSending(true);
    trackShopStep("samples_submit", delivery, { count: picked.length });
    try {
      const res = await submitSamplesOrder({
        samples: picked.map((p) => ({ group_id: p.groupId, swatch_id: p.swatch.id })),
        delivery,
        paczkomat: delivery === "paczkomat" && point ? { id: point.id, address: point.address } : undefined,
        customer: { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() },
        shipping,
        consents: {
          terms: true,
          marketing_email: marketing?.accepted === true,
          marketing_sms: marketing?.accepted === true,
          marketing_source: marketing?.source || "",
          marketing_decided_at: marketing?.decidedAt || "",
          accepted_at: new Date().toISOString(),
          version: "2026-09-28",
        },
        session_token: getSessionToken(),
      });
      trackShopStep("samples_order_created", res.order_code, { count: picked.length });
      window.location.href = `/zamowienie/${encodeURIComponent(res.order_code)}?access_token=${encodeURIComponent(res.access_token)}`;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Nie udało się złożyć zamówienia.");
      setSending(false);
    }
  }

  if (loadError) {
    return <main className={styles.page}><div className={styles.shell}><p className={styles.empty}>{loadError}</p></div></main>;
  }
  if (!catalog) {
    return <main className={styles.page}><div className={styles.shell}><p className={styles.empty}>Wczytujemy tkaniny…</p></div></main>;
  }
  if (!catalog.enabled) {
    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <section className={styles.card}>
            <h1>Próbki tkanin - już wkrótce</h1>
            <p>Przygotowujemy wysyłkę bezpłatnych próbek. Do tego czasu chętnie pomożemy dobrać kolor na czacie - wystarczy opisać pokój albo przesłać zdjęcie okna.</p>
            <div className={styles.actions}>
              <button type="button" className={styles.primary} onClick={() => openLiveChat("Proszę o pomoc w doborze koloru plisy. ")}>Pomoc w doborze koloru</button>
              <Link href="/plisy" className={styles.secondary}>Wróć do konfiguratora plis</Link>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <header className={styles.hero}>
          {catalog.test ? <span className={styles.testBadge}>Tryb testowy - klienci jeszcze tego nie widzą</span> : null}
          <h1>Bezpłatne próbki tkanin do plis</h1>
          <p>Wybierz do <strong>{max} próbek</strong> i zobacz kolor przy swoim oknie, w prawdziwym świetle. Próbki są gratis - płacisz tylko za dostawę: paczkomat <strong>{zl(catalog.prices?.paczkomat ?? 8.9)}</strong> albo kurier <strong>{zl(catalog.prices?.kurier ?? 13.9)}</strong>. Wysyłamy w ciągu {catalog.ship_days || 2} dni roboczych.</p>
        </header>

        <section className={styles.card}>
          <div className={styles.stepHead}>
            <h2><span className={styles.stepNo}>1</span> Wybierz próbki</h2>
            <span className={styles.counter}>{picked.length}/{max}</span>
          </div>
          <div className={styles.tabs} role="tablist">
            {(catalog.groups || []).map((g) => {
              const n = picked.filter((p) => p.groupId === g.id).length;
              return (
                <button key={g.id} type="button" role="tab" aria-selected={g.id === groupId} className={g.id === groupId ? styles.tabActive : styles.tab} onClick={() => setGroupId(g.id)}>
                  {g.label}{n ? <span className={styles.tabBadge}>{n}</span> : null}
                </button>
              );
            })}
          </div>
          <label className={styles.filter}>
            <input type="checkbox" checked={onlyAvailable} onChange={(e) => setOnlyAvailable(e.target.checked)} /> Pokaż tylko tkaniny z próbką ({availableCount})
          </label>
          {notice ? <p className={styles.notice}>{notice}</p> : null}
          <div className={styles.grid}>
            {(group?.swatches || []).filter((s) => !onlyAvailable || s.available).map((s) => {
              const on = isPicked(group!.id, s.id);
              return (
                <button
                  key={s.id}
                  type="button"
                  className={`${styles.swatch} ${on ? styles.swatchOn : ""} ${s.available ? "" : styles.swatchOrder}`}
                  onClick={() => toggle(group!, s)}
                  aria-pressed={on}
                >
                  <span className={styles.swatchImg} style={{ backgroundColor: s.color || "#ddd", backgroundImage: s.thumbnail_url ? `url("${s.thumbnail_url}")` : undefined }}>
                    {on ? <span className={styles.check}>✓</span> : null}
                  </span>
                  <span className={styles.swatchName}><strong>{s.code}</strong> {colorName(s)}</span>
                  <span className={s.available ? styles.tagSample : styles.tagOrder}>{s.available ? (on ? "Wybrana" : "Próbka gratis") : "Tkanina na zamówienie"}</span>
                </button>
              );
            })}
          </div>
          {group && group.swatches.every((s) => !s.available) ? (
            <p className={styles.soft}>Tkaniny z tej kolekcji sprowadzamy specjalnie pod każde zamówienie, więc nie mamy ich w próbkach. Pomożemy dobrać odcień na czacie - zobacz też kolekcje z próbkami.</p>
          ) : null}
        </section>

        <form className={styles.card} onSubmit={submit} noValidate>
          <div className={styles.stepHead}><h2><span className={styles.stepNo}>2</span> Dostawa i dane</h2></div>
          {picked.length ? (
            <ul className={styles.pickedList}>
              {picked.map((p) => (
                <li key={`${p.groupId}.${p.swatch.id}`}>
                  <span className={styles.pickedDot} style={{ backgroundColor: p.swatch.color || "#ddd", backgroundImage: p.swatch.thumbnail_url ? `url("${p.swatch.thumbnail_url}")` : undefined }} />
                  <span><strong>{p.swatch.code}</strong> {colorName(p.swatch)} <small>· {p.groupLabel}</small></span>
                  <button type="button" aria-label="Usuń próbkę" onClick={() => setPicked((prev) => prev.filter((x) => x !== p))}>×</button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.soft}>Wybierz najpierw próbki powyżej.</p>
          )}

          <div className={styles.deliveryChoice}>
            {(["paczkomat", "kurier"] as const).map((d) => (
              <label key={d} className={delivery === d ? styles.optionOn : styles.option}>
                <input type="radio" name="delivery" checked={delivery === d} onChange={() => setDelivery(d)} />
                <span>{d === "paczkomat" ? "Paczkomat InPost" : "Kurier pod adres"}</span>
                <strong>{zl(d === "kurier" ? catalog.prices?.kurier ?? 13.9 : catalog.prices?.paczkomat ?? 8.9)}</strong>
              </label>
            ))}
          </div>
          {delivery === "paczkomat" ? (
            <div className={styles.picker}><PaczkomatPicker value={point} onChange={setPoint} /></div>
          ) : (
            <div className={styles.fields}>
              <label className={styles.wide}>Ulica i numer<input value={form.street} onChange={set("street")} autoComplete="street-address" /></label>
              <label>Kod pocztowy<input value={form.postcode} onChange={set("postcode")} inputMode="numeric" placeholder="00-000" autoComplete="postal-code" /></label>
              <label>Miejscowość<input value={form.city} onChange={set("city")} autoComplete="address-level2" /></label>
            </div>
          )}
          <div className={styles.fields}>
            <label className={styles.wide}>Imię i nazwisko<input value={form.name} onChange={set("name")} autoComplete="name" /></label>
            <label>Telefon<input value={form.phone} onChange={set("phone")} inputMode="tel" autoComplete="tel" /></label>
            <label>E-mail<input value={form.email} onChange={set("email")} inputMode="email" autoComplete="email" /></label>
          </div>
          <label className={styles.terms}>
            <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} /> Akceptuję <Link href="/regulamin" target="_blank">regulamin sklepu</Link> i politykę prywatności.
          </label>

          <div className={styles.summary}>
            <div><span>Próbki ({picked.length})</span><strong>gratis</strong></div>
            <div><span>Dostawa - {delivery === "kurier" ? "kurier" : "paczkomat"}</span><strong>{zl(price)}</strong></div>
            <div className={styles.total}><span>Do zapłaty</span><strong>{zl(price)}</strong></div>
            <p>Płacisz z góry na następnym kroku: BLIK, kartą, szybkim przelewem albo przelewem tradycyjnym. Próbki są bezpłatne i zostają u Ciebie.</p>
          </div>
          {error ? <p className={styles.error} role="alert">{error}</p> : null}
          <button type="submit" className={styles.primary} disabled={sending || !picked.length}>
            {sending ? "Zapisujemy…" : `Zamawiam próbki - zapłać ${zl(price)}`}
          </button>
        </form>
      </div>

      {info ? (
        <div className={styles.modalBack} onClick={() => setInfo(null)} role="presentation">
          <div className={styles.modal} role="dialog" aria-modal="true" aria-labelledby="sampleInfoTitle" onClick={(e) => e.stopPropagation()}>
            <span className={styles.modalImg} style={{ backgroundColor: info.swatch.color || "#ddd", backgroundImage: info.swatch.image_url || info.swatch.thumbnail_url ? `url("${info.swatch.image_url || info.swatch.thumbnail_url}")` : undefined }} />
            <h3 id="sampleInfoTitle">{info.swatch.code} {colorName(info.swatch)} · {info.group}</h3>
            <p>Tę tkaninę sprowadzamy <strong>specjalnie pod Twoje zamówienie</strong> - dzięki temu mamy w ofercie dużo więcej kolorów, niż zmieściłby magazyn. Dlatego nie wysyłamy jej w próbkach.</p>
            <p>Możesz ją normalnie zamówić w konfiguratorze. Jeśli chcesz mieć pewność co do odcienia, nasz doradca pokaże ją z bliska na zdjęciu albo podpowie najbliższy kolor z próbek.</p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.primary}
                onClick={() => {
                  openLiveChat(`Proszę o zdjęcie z bliska tkaniny ${info.swatch.code} (${info.group}) albo podobny kolor z próbek.`);
                  setInfo(null);
                }}
              >
                Zapytaj doradcę o ten kolor
              </button>
              <button type="button" className={styles.secondary} onClick={() => { setOnlyAvailable(true); setInfo(null); }}>Pokaż tkaniny z próbką</button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
