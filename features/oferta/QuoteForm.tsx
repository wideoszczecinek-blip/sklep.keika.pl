"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./oferta.module.css";
import { trackShopStep } from "@/lib/track-step";

type SubmitState = "idle" | "submitting" | "sent" | "error";

export const VARIANT_EVENT = "oferta:variant";

type Props = {
  productLabel: string;
  options: string[];
  slug: string;
};

function readUtm(): Record<string, string> {
  const out: Record<string, string> = {};
  try {
    const params = new URLSearchParams(window.location.search);
    params.forEach((value, key) => {
      if (/^utm_[a-z]+$/.test(key) && value.trim()) out[key] = value.trim().slice(0, 120);
    });
  } catch {
    // brak window / URLSearchParams - bez utm
  }
  return out;
}

export default function QuoteForm({ productLabel, options, slug }: Props) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [variant, setVariant] = useState(options[0] || "");
  const [message, setMessage] = useState("");
  const [consent, setConsent] = useState(false);
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");
  const [reference, setReference] = useState("");
  const renderedAtRef = useRef(Date.now());

  // Przycisk "Wyceń ten wariant" na karcie wariantu ustawia wybór w
  // formularzu i przewija do niego (LandingCtas.tsx wysyła to zdarzenie).
  useEffect(() => {
    function onVariant(event: Event) {
      const detail = (event as CustomEvent<string>).detail;
      if (detail && options.includes(detail)) setVariant(detail);
    }
    window.addEventListener(VARIANT_EVENT, onVariant);
    return () => window.removeEventListener(VARIANT_EVENT, onVariant);
  }, [options]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (!consent) {
      setError("Zaznacz zgodę na kontakt - bez tego nie możemy oddzwonić.");
      return;
    }
    setState("submitting");
    try {
      const response = await fetch("/api/wycena", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone,
          email,
          city,
          variant,
          message,
          consent,
          website,
          product: productLabel,
          slug,
          form_rendered_at: renderedAtRef.current,
          page_url: window.location.href,
          referrer: document.referrer,
          utm: readUtm(),
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string; reference?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Nie udało się wysłać zapytania.");
      }
      setReference(json.reference || "");
      setState("sent");
      trackShopStep("quote_request_sent", slug, { variant, has_email: email.trim() !== "" });
    } catch (submitError) {
      setState("error");
      const text = submitError instanceof Error ? submitError.message : "Wystąpił błąd.";
      setError(text);
      trackShopStep("quote_request_failed", slug, { message: text.slice(0, 200) });
    }
  }

  if (state === "sent") {
    return (
      <div className={styles.success} role="status">
        <h3>Dziękujemy, mamy Twoje zapytanie</h3>
        <p>
          Oddzwonimy lub napiszemy najszybciej jak możemy, zwykle w ciągu jednego dnia roboczego.
          {reference ? ` Numer zgłoszenia: ${reference}.` : ""}
        </p>
        <p>Jeśli masz zdjęcie okna lub tarasu, wyślij je w odpowiedzi na nasz e-mail - wycena będzie dokładniejsza.</p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.honeypot} aria-hidden="true">
        Strona www (nie wypełniaj)
        <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </label>

      <div className={styles.formRow}>
        <label className={styles.field}>
          Imię i nazwisko
          <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
        </label>
        <label className={styles.field}>
          Telefon
          <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" required />
        </label>
      </div>

      <div className={styles.formRow}>
        <label className={styles.field}>
          E-mail <span className={styles.fieldHint}>(opcjonalnie, na wycenę pisemną)</span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
        </label>
        <label className={styles.field}>
          Miejscowość <span className={styles.fieldHint}>(sprawdzimy, czy dojeżdżamy z pomiarem)</span>
          <input value={city} onChange={(event) => setCity(event.target.value)} autoComplete="address-level2" />
        </label>
      </div>

      <label className={styles.field}>
        Co wycenić
        <select value={variant} onChange={(event) => setVariant(event.target.value)}>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        Wymiary, liczba okien, uwagi <span className={styles.fieldHint}>(orientacyjnie - dokładny pomiar zrobimy my)</span>
        <textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="np. 3 okna 120 × 140 cm w salonie, drzwi balkonowe 90 × 220 cm, kolor antracyt" />
      </label>

      <label className={styles.consent}>
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>
          Zgadzam się na kontakt telefoniczny lub e-mailowy w sprawie tego zapytania. Dane posłużą tylko do przygotowania wyceny.
        </span>
      </label>

      {error ? <div className={styles.error}>{error}</div> : null}

      <button type="submit" className={styles.btnPrimary} disabled={state === "submitting"}>
        {state === "submitting" ? "Wysyłanie…" : "Poproś o wycenę"}
      </button>
    </form>
  );
}
