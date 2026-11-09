"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./oferta.module.css";
import { trackShopStep } from "@/lib/track-step";
import type { QuoteQuestion } from "./types";

type SubmitState = "idle" | "submitting" | "sent" | "error";
type ReplyBy = "email" | "telefon";

export const VARIANT_EVENT = "oferta:variant";

// Formularz wyceny produktów bez konfiguratora (10.11.2026, właściciel:
// „zwykły formularz kontaktowy, ale będzie można go rozbudować o pytania
// wstępne pod wycenę. Odpowiedź na e-mail albo telefoniczna - klient decyduje”).
// Wysyłka prosto do CRM (shop-public/contact_submit.php, type=wycena): lead
// w Biuro → Leady + mail do biura. Pytania wstępne: `questions` z treści
// produktu albo DEFAULT_QUOTE_QUESTIONS - odpowiedzi idą jako answers [{q, a}].
const CRM_CONTACT_ENDPOINT = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/contact_submit.php";

/** Pytania wstępne dla wszystkich produktów (na razie brak - dopisz tu albo w content/<slug>.ts). */
export const DEFAULT_QUOTE_QUESTIONS: QuoteQuestion[] = [];

type Props = {
  productLabel: string;
  options: string[];
  slug: string;
  questions?: QuoteQuestion[];
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

function phoneDigits(raw: string): string {
  let digits = raw.replace(/\D+/g, "");
  if (digits.startsWith("0048")) digits = digits.slice(4);
  else if (digits.startsWith("48") && digits.length === 11) digits = digits.slice(2);
  return digits;
}

export default function QuoteForm({ productLabel, options, slug, questions }: Props) {
  const allQuestions = [...DEFAULT_QUOTE_QUESTIONS, ...(questions || [])];
  const [name, setName] = useState("");
  const [replyBy, setReplyBy] = useState<ReplyBy>("email");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [variant, setVariant] = useState(options[0] || "");
  const [answers, setAnswers] = useState<Record<string, string>>({});
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

  function validate(): string {
    if (name.trim().length < 2) return "Podaj imię i nazwisko.";
    const digits = phoneDigits(phone);
    if (replyBy === "telefon" && digits.length !== 9) return "Podaj numer telefonu (9 cyfr) - wybrano odpowiedź telefoniczną.";
    if (phone.trim() && digits.length !== 9) return "Numer telefonu wygląda na niepoprawny (9 cyfr).";
    if (replyBy === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Podaj adres e-mail - wybrano odpowiedź e-mailem.";
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Adres e-mail wygląda na niepoprawny.";
    for (const question of allQuestions) {
      if (question.required && !(answers[question.id] || "").trim()) return `Odpowiedz na pytanie: ${question.label}`;
    }
    if (!consent) return "Zaznacz zgodę na kontakt - bez niej nie możemy odpowiedzieć.";
    return "";
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const problem = validate();
    setError(problem);
    if (problem) return;
    setState("submitting");
    try {
      const response = await fetch(CRM_CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "wycena",
          name: name.trim(),
          reply_by: replyBy,
          phone: phone.trim(),
          email: email.trim(),
          products: Array.from(new Set([productLabel, variant].filter(Boolean))),
          answers: allQuestions
            .map((question) => ({ q: question.label, a: (answers[question.id] || "").trim() }))
            .filter((row) => row.a !== ""),
          message: message.trim(),
          consent,
          website,
          form_rendered_at: renderedAtRef.current,
          page_url: window.location.href,
          referrer: document.referrer,
          utm: readUtm(),
          viewport_width: window.innerWidth,
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string; reference?: string };
      if (!response.ok || !json.ok) {
        throw new Error(json.error || "Nie udało się wysłać formularza.");
      }
      setReference(json.reference && json.reference !== "OK" ? json.reference : "");
      setState("sent");
      trackShopStep("quote_request_sent", slug, { variant, reply_by: replyBy, has_phone: phone.trim() !== "", has_email: email.trim() !== "" });
    } catch (submitError) {
      setState("error");
      const text = submitError instanceof Error ? submitError.message : "Wystąpił błąd.";
      setError(`${text} Możesz też zadzwonić albo napisać na biuro@keika.pl.`);
      trackShopStep("quote_request_failed", slug, { message: text.slice(0, 200) });
    }
  }

  if (state === "sent") {
    return (
      <div className={styles.success} role="status">
        <h3>Dziękujemy, formularz wyceny dotarł</h3>
        <p>
          Odpowiemy {replyBy === "email" ? "e-mailem" : "telefonicznie"}, zgodnie z Twoim wyborem.
          {reference ? ` Numer zgłoszenia: ${reference}.` : ""}
        </p>
      </div>
    );
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit} noValidate>
      <label className={styles.honeypot} aria-hidden="true">
        Strona www (nie wypełniaj)
        <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(event) => setWebsite(event.target.value)} />
      </label>

      <label className={styles.field}>
        Imię i nazwisko
        <input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required />
      </label>

      <fieldset className={styles.replyBy}>
        <legend>Jak mamy odpowiedzieć?</legend>
        <div className={styles.replyOptions}>
          {(
            [
              ["email", "E-mailem"],
              ["telefon", "Telefonicznie"],
            ] as Array<[ReplyBy, string]>
          ).map(([value, label]) => (
            <label key={value} className={`${styles.replyOption} ${replyBy === value ? styles.replyOptionActive : ""}`}>
              <input type="radio" name={`reply-by-${slug}`} value={value} checked={replyBy === value} onChange={() => setReplyBy(value)} />
              {label}
            </label>
          ))}
        </div>
      </fieldset>

      <div className={styles.formRow}>
        <label className={styles.field}>
          <span>
            E-mail {replyBy === "email" ? null : <span className={styles.fieldHint}>(opcjonalnie)</span>}
          </span>
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required={replyBy === "email"} />
        </label>
        <label className={styles.field}>
          <span>
            Telefon {replyBy === "telefon" ? null : <span className={styles.fieldHint}>(opcjonalnie)</span>}
          </span>
          <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} autoComplete="tel" inputMode="tel" required={replyBy === "telefon"} />
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

      {allQuestions.map((question) => (
        <label key={question.id} className={styles.field}>
          <span>
            {question.label} {question.hint ? <span className={styles.fieldHint}>({question.hint})</span> : null}
          </span>
          {question.type === "select" ? (
            <select value={answers[question.id] || ""} onChange={(event) => setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))}>
              <option value="">- wybierz -</option>
              {(question.options || []).map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          ) : (
            <input
              type={question.type === "number" ? "number" : "text"}
              inputMode={question.type === "number" ? "numeric" : undefined}
              placeholder={question.placeholder}
              value={answers[question.id] || ""}
              onChange={(event) => setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))}
            />
          )}
        </label>
      ))}

      <label className={styles.field}>
        <span>
          Wymiary, liczba sztuk, uwagi <span className={styles.fieldHint}>(orientacyjnie)</span>
        </span>
        <textarea rows={4} value={message} onChange={(event) => setMessage(event.target.value)} placeholder="np. 3 okna 120 × 140 cm w salonie, drzwi balkonowe 90 × 220 cm, kolor antracyt" />
      </label>

      <label className={styles.consent}>
        <input type="checkbox" checked={consent} onChange={(event) => setConsent(event.target.checked)} />
        <span>Zgadzam się na kontakt w sprawie tego zapytania wybranym sposobem. Dane posłużą tylko do przygotowania wyceny.</span>
      </label>

      {error ? <div className={styles.error}>{error}</div> : null}

      <button type="submit" className={styles.btnPrimary} disabled={state === "submitting"}>
        {state === "submitting" ? "Wysyłanie…" : "Wyślij formularz wyceny"}
      </button>
    </form>
  );
}
