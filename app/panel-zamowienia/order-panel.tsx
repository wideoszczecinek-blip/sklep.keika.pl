"use client";

// Panel zamówienia klienta (właściciel 11.11.2026): „pod indywidualnym linkiem klient mógłby zarządzać
// zamówieniem, zobaczyć szczegóły, terminy, złożyć dyspozycje zmian – oczywiście do weryfikacji, złożyć
// reklamację itp. Kolejne zamówienia też widziałby w tym panelu – poprzednie też – swoje rabaty. Tam też
// żeby widział o PRZEWIDYWANYM terminie – ale żeby jednoznacznie nie brzmiał jak deklaracja.”
//
// WERSJA TESTOWA: dane przykładowe (app/panel-zamowienia/przyklad), formularze nic nie wysyłają.
// Po akceptacji: dane z CRM po tokenie z maila (ten sam access_token co /zamowienie/[kod]),
// zmiany -> notatka + zadanie dla biura do weryfikacji, reklamacje -> moduł order_claims.
import "./panel.css";
import Link from "next/link";
import { useState } from "react";

/** price = null: zamówienie lokalne (z pomiaru / biura) - cena tylko za całość, pozycje ze zlecenia produkcyjnego. */
export type PanelItem = { name: string; qty: number; price: number | null; params: [string, string][] };
export type PanelOrder = {
  number: string;
  /** numer tymczasowy ze sklepu; puste przy zamówieniach lokalnych */
  tempCode: string;
  placedAt: string;
  status: string;
  /** indeks bieżącego kroku w `stages` (sklep: 0 złożone, 1 weryfikacja, 2 produkcja, 3 wysyłka, 4 dostarczone) */
  stage: number;
  /** kroki postępu - domyślnie sklepowe z wysyłką; odbiór osobisty / montaż mają swoje */
  stages?: string[];
  eta: { from: string; to: string; productionDays: number; label?: string; note?: string } | null;
  /** skąd pozycje i cena, np. „Zamówienie z pomiaru …” - pokazywane nad pozycjami */
  itemsNote?: string;
  items: PanelItem[];
  /** null = brak rozbicia na pozycje (zamówienie lokalne) */
  subtotal: number | null;
  discounts: [string, number][];
  /** fee = null: bez wiersza dostawy w podsumowaniu (odbiór osobisty, montaż) */
  delivery: { method: string; name: string; address: string; phone: string; fee: number | null };
  payment: { method: string; state: string };
  total: number;
  totalLabel?: string;
  documents: { label: string; note: string }[];
  shipment: { carrier: string; number: string } | null;
  changesOpen: boolean;
  /** odbiór osobisty - zamiast numeru przesyłki informacja o odbiorze */
  pickup?: boolean;
  /** tekst przy reklamacji (zamówienia lokalne: bez „30 dni na zwrot” ze sklepu) */
  claimNote?: string;
};
export type PanelPastOrder = { number: string; date: string; summary: string; total: number; status: string; done: boolean };
export type PanelDiscount = { title: string; code: string; value: string; until: string; note: string };
export type PanelData = { firstName: string; order: PanelOrder; orders: PanelPastOrder[]; discounts: PanelDiscount[]; phone: string };

const zl = (v: number) => `${v.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`;
const STAGES = ["Złożone", "Weryfikacja", "Produkcja", "Wysyłka", "U Ciebie"];

function Section({ id, title, children, aside }: { id: string; title: string; children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <section className="op-card" id={id}>
      <header className="op-card-head">
        <h2>{title}</h2>
        {aside}
      </header>
      {children}
    </section>
  );
}

function TestNote({ text }: { text: string }) {
  return <p className="op-test-sent">✓ {text} <span>(wersja testowa: nic nie zostało wysłane)</span></p>;
}

function ChangeForm({ order }: { order: PanelOrder }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  if (!order.changesOpen) {
    return <p className="op-muted">Zamówienie jest już w drodze, więc zmian nie da się wprowadzić. Zadzwoń, jeśli coś jest nie tak.</p>;
  }
  if (sent) return <TestNote text="Zgłoszenie zmiany przyjęte. Sprawdzimy je i potwierdzimy telefonicznie albo mailem." />;
  return (
    <>
      <p className="op-muted">
        Pomyłka w wymiarze, kolorze albo adresie? Opisz, co zmienić. Zmiana nie wchodzi automatycznie: sprawdzimy ją i potwierdzimy. Gdy
        produkcja danej pozycji już ruszyła, części zmian nie da się zrobić - wtedy zadzwonimy z propozycją.
      </p>
      {!open ? (
        <button type="button" className="op-btn" onClick={() => setOpen(true)}>
          Zgłoś zmianę
        </button>
      ) : (
        <form
          className="op-form"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <label>
            Czego dotyczy zmiana
            <select defaultValue="wymiar">
              <option value="wymiar">Wymiar</option>
              <option value="kolor">Kolor / tkanina / siatka</option>
              <option value="ilosc">Ilość</option>
              <option value="adres">Adres lub sposób dostawy</option>
              <option value="faktura">Dane do faktury</option>
              <option value="inne">Coś innego</option>
            </select>
          </label>
          <label>
            Pozycja
            <select defaultValue="0">
              {order.items.map((it, i) => (
                <option key={i} value={i}>
                  {it.name} - {it.params[0]?.[1] || ""}
                </option>
              ))}
              <option value="all">Całe zamówienie</option>
            </select>
          </label>
          <label>
            Co zmienić
            <textarea rows={3} placeholder="Np. szerokość 640 mm zamiast 620 mm" required />
          </label>
          <div className="op-form-actions">
            <button type="submit" className="op-btn">
              Wyślij do sprawdzenia
            </button>
            <button type="button" className="op-btn op-btn--ghost" onClick={() => setOpen(false)}>
              Anuluj
            </button>
          </div>
        </form>
      )}
    </>
  );
}

function ClaimForm({ order }: { order: PanelOrder }) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  if (sent) return <TestNote text="Reklamacja przyjęta. Dostaniesz maila z numerem zgłoszenia, a status zobaczysz tutaj." />;
  return (
    <>
      <p className="op-muted">
        {order.claimNote ||
          "Coś przyszło uszkodzone albo nie pasuje? Dodaj zdjęcia i krótki opis. Masz 5 lat gwarancji i 30 dni na zwrot. Uszkodzoną paczkę najlepiej sfotografować przed rozpakowaniem."}
      </p>
      {!open ? (
        <button type="button" className="op-btn op-btn--ghost" onClick={() => setOpen(true)}>
          Zgłoś reklamację
        </button>
      ) : (
        <form
          className="op-form"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <fieldset>
            <legend>Których pozycji dotyczy</legend>
            {order.items.map((it, i) => (
              <label key={i} className="op-check">
                <input type="checkbox" defaultChecked={i === 0} /> {it.name}, {it.params[0]?.[1] || ""}
              </label>
            ))}
          </fieldset>
          <label>
            Co się stało
            <textarea rows={3} placeholder="Np. pęknięty narożnik ramy, siatka odchodzi od ramki" required />
          </label>
          <label>
            Zdjęcia (do 6)
            <input type="file" accept="image/*" multiple />
          </label>
          <div className="op-form-actions">
            <button type="submit" className="op-btn">
              Wyślij reklamację
            </button>
            <button type="button" className="op-btn op-btn--ghost" onClick={() => setOpen(false)}>
              Anuluj
            </button>
          </div>
        </form>
      )}
    </>
  );
}

export default function OrderPanel({ data, test }: { data: PanelData; test?: boolean }) {
  const { order } = data;
  const stages = order.stages ?? STAGES;
  const [copied, setCopied] = useState("");
  const tel = `tel:${data.phone.replace(/[^\d+]/g, "")}`;

  return (
    <div className="op">
      {test ? (
        <div className="op-test-banner">
          <strong>Wersja testowa panelu</strong> - przykładowe dane, przyciski niczego nie wysyłają.
        </div>
      ) : null}

      <div className="op-hero">
        <p className="op-hello">Cześć{data.firstName ? `, ${data.firstName}` : ""}!</p>
        <h1>
          Zamówienie <span>{order.number}</span>
        </h1>
        <p className="op-hero-meta">
          złożone {order.placedAt}
          {order.tempCode ? ` · numer tymczasowy ${order.tempCode}` : ""}
        </p>
        <span className="op-status">{order.status}</span>

        <ol className="op-steps" aria-label="Postęp zamówienia" style={{ gridTemplateColumns: `repeat(${stages.length}, 1fr)` }}>
          {stages.map((label, i) => (
            <li key={label} className={i < order.stage ? "is-done" : i === order.stage ? "is-now" : ""}>
              <i aria-hidden="true">{i < order.stage ? "✓" : i + 1}</i>
              <span>{label}</span>
            </li>
          ))}
        </ol>

        {order.eta ? (
          <div className="op-eta">
            <div className="op-eta-label">{order.eta.label || "Przewidywana dostawa"}</div>
            <div className="op-eta-range">
              {order.eta.from === order.eta.to ? order.eta.from : `${order.eta.from} – ${order.eta.to}`}
            </div>
            <p>
              {order.eta.note ||
                `To nasze przewidywanie na podstawie dzisiejszego planu produkcji (do ${order.eta.productionDays} dni roboczych na wymiar + kurier), a nie gwarantowany termin. Jeśli plan się zmieni, zobaczysz to tutaj. Pewną informację dostaniesz w dniu nadania paczki - z numerem przesyłki.`}
            </p>
          </div>
        ) : null}

        <nav className="op-jump" aria-label="Na skróty">
          <a href="#zamowienie">Pozycje</a>
          <a href="#zmiany">Zmiana</a>
          <a href="#reklamacja">Reklamacja</a>
          <a href="#moje-zamowienia">Moje zamówienia</a>
          {data.discounts.length ? <a href="#rabaty">Rabaty</a> : null}
        </nav>
      </div>

      <Section id="zamowienie" title="Co zamówiono" aside={<span className="op-count">{order.items.reduce((s, it) => s + it.qty, 0)} szt.</span>}>
        {order.itemsNote ? <p className="op-muted">{order.itemsNote}</p> : null}
        <ul className="op-items">
          {order.items.map((it, i) => (
            <li key={i} className="op-item">
              <div className="op-item-top">
                <strong>{it.name}</strong>
                <span className="op-qty">{it.qty} szt.</span>
                {it.price !== null ? <b>{zl(it.price)}</b> : null}
              </div>
              <dl>
                {it.params.map(([l, v]) => (
                  <div key={l}>
                    <dt>{l}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
        <dl className="op-sum">
          {order.subtotal !== null ? (
            <div>
              <dt>Wartość produktów</dt>
              <dd>{zl(order.subtotal)}</dd>
            </div>
          ) : null}
          {order.discounts.map(([l, v]) => (
            <div key={l} className="is-saving">
              <dt>{l}</dt>
              <dd>-{zl(v)}</dd>
            </div>
          ))}
          {order.delivery.fee !== null ? (
            <div>
              <dt>{order.delivery.method}</dt>
              <dd>{order.delivery.fee > 0 ? zl(order.delivery.fee) : "gratis"}</dd>
            </div>
          ) : null}
          <div className="is-total">
            <dt>{order.totalLabel || "Razem"}</dt>
            <dd>{zl(order.total)}</dd>
          </div>
        </dl>
      </Section>

      <div className="op-grid">
        <Section id="dostawa" title="Dostawa">
          <p className="op-lines">
            <strong>{order.delivery.method}</strong>
            <br />
            {order.delivery.name}
            <br />
            {order.delivery.address}
            <br />
            {order.delivery.phone}
          </p>
          {order.shipment ? (
            <p className="op-lines">
              Przesyłka {order.shipment.carrier}: <strong>{order.shipment.number}</strong>
            </p>
          ) : order.pickup ? (
            <p className="op-muted">Gdy zamówienie będzie gotowe do odbioru, zadzwonimy albo napiszemy SMS.</p>
          ) : (
            <p className="op-muted">Numer przesyłki pojawi się tutaj i w mailu, gdy nadamy paczkę.</p>
          )}
        </Section>
        <Section id="platnosc" title="Płatność i dokumenty">
          <p className="op-lines">
            <strong>{order.payment.method}</strong>
            <br />
            {order.payment.state}
          </p>
          <ul className="op-docs">
            {order.documents.map((d) => (
              <li key={d.label}>
                <span aria-hidden="true">📄</span> {d.label} <small>{d.note}</small>
              </li>
            ))}
          </ul>
        </Section>
      </div>

      <Section id="zmiany" title="Chcesz coś zmienić?">
        <ChangeForm order={order} />
      </Section>

      <Section id="reklamacja" title="Reklamacja lub zwrot">
        <ClaimForm order={order} />
      </Section>

      <Section id="moje-zamowienia" title="Moje zamówienia">
        <p className="op-muted">Wszystkie zamówienia z tym numerem telefonu i adresem e-mail - ze sklepu, z Allegro i telefoniczne.</p>
        <ul className="op-orders">
          <li className="is-current">
            <div>
              <strong>{order.number}</strong> <small>{order.placedAt}</small>
              <span>
                {Object.entries(order.items.reduce<Record<string, number>>((acc, it) => ({ ...acc, [it.name]: (acc[it.name] || 0) + it.qty }), {}))
                  .map(([name, qty]) => `${name} × ${qty}`)
                  .join(", ")}
              </span>
            </div>
            <div className="op-orders-right">
              <b>{zl(order.total)}</b>
              <em>{order.status}</em>
            </div>
          </li>
          {!data.orders.length ? (
            <li className="op-orders-empty">To Twoje pierwsze zamówienie u nas - kolejne pojawią się tutaj.</li>
          ) : null}
          {data.orders.map((o) => (
            <li key={o.number} className={o.done ? "is-done" : ""}>
              <div>
                <strong>{o.number}</strong> <small>{o.date}</small>
                <span>{o.summary}</span>
              </div>
              <div className="op-orders-right">
                <b>{zl(o.total)}</b>
                <em>{o.status}</em>
              </div>
            </li>
          ))}
        </ul>
      </Section>

      {data.discounts.length ? (
      <Section id="rabaty" title="Twoje rabaty">
        <ul className="op-discounts">
          {data.discounts.map((d) => (
            <li key={d.code || d.title}>
              <div className="op-discount-value">{d.value}</div>
              <div className="op-discount-body">
                <strong>{d.title}</strong>
                <span>{d.note}</span>
                <small>{d.until}</small>
              </div>
              {d.code ? (
                <button
                  type="button"
                  className="op-code"
                  onClick={() => {
                    try {
                      void navigator.clipboard.writeText(d.code);
                    } catch {
                      // bez schowka - kod i tak widać
                    }
                    setCopied(d.code);
                  }}
                >
                  {copied === d.code ? "Skopiowano" : d.code}
                </button>
              ) : null}
            </li>
          ))}
        </ul>
        <Link href="/" className="op-btn op-btn--ghost op-shop-link">
          Zamów kolejne osłony
        </Link>
      </Section>
      ) : null}

      <section className="op-contact">
        <strong>Masz pytanie?</strong>
        <span>Odpowiadamy codziennie 8:00-21:00. Podaj numer {order.number}.</span>
        <div>
          <a className="op-btn" href={tel}>
            Zadzwoń {data.phone}
          </a>
          <a className="op-btn op-btn--ghost" href="mailto:biuro@keika.pl">
            Napisz
          </a>
        </div>
      </section>
    </div>
  );
}
