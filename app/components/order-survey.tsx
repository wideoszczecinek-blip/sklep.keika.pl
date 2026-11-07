"use client";

// Ankieta po zakupie (właściciel 7.11): na stronie podziękowania 2-3 proste
// pytania z odpowiedziami do kliknięcia. Pytania dobiera CRM pod klienta
// (shop-public/survey.php) - nie muszą być u wszystkich te same. Niczego nie
// wymuszamy: można pominąć, a gdy CRM nie ma pytań, nie odpowiada albo klient
// już odpowiedział - komponent nic nie pokazuje.

import { useEffect, useRef, useState } from "react";
import { CRM_PUBLIC_BASE } from "./payment-methods";
import { trackShopStep } from "@/lib/track-step";

const SURVEY_URL = `${CRM_PUBLIC_BASE}/survey.php`;

type SurveyQuestion = { id: string; text: string; options: string[] };
type Status = "loading" | "ready" | "sending" | "sent" | "hidden";

const COUNT_WORDS = ["", "Jedno szybkie pytanie", "Dwa szybkie pytania", "Trzy szybkie pytania", "Cztery szybkie pytania"];

function skipKey(orderCode: string) {
  return `keika_survey_skip_${orderCode}`;
}

function parseQuestions(data: unknown): SurveyQuestion[] {
  if (!data || typeof data !== "object") return [];
  const payload = data as { ok?: unknown; pokaz?: unknown; pytania?: unknown };
  if (payload.ok !== true || payload.pokaz !== true || !Array.isArray(payload.pytania)) return [];
  const out: SurveyQuestion[] = [];
  for (const raw of payload.pytania) {
    if (!raw || typeof raw !== "object") continue;
    const q = raw as { id?: unknown; pytanie?: unknown; typ?: unknown; opcje?: unknown };
    if (q.typ !== undefined && q.typ !== "wybor") continue;
    const id = typeof q.id === "string" || typeof q.id === "number" ? String(q.id) : "";
    const text = typeof q.pytanie === "string" ? q.pytanie.trim() : "";
    const options = Array.isArray(q.opcje) ? q.opcje.filter((o): o is string => typeof o === "string" && o.trim() !== "") : [];
    if (id && text && options.length > 0) out.push({ id, text, options });
  }
  return out;
}

export default function OrderSurvey({ orderCode }: { orderCode: string }) {
  const [status, setStatus] = useState<Status>("loading");
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [error, setError] = useState(false);
  const shownTracked = useRef(false);

  useEffect(() => {
    let cancelled = false;
    try {
      if (window.localStorage.getItem(skipKey(orderCode))) {
        setStatus("hidden");
        return;
      }
    } catch {
      // brak localStorage - po prostu pytamy CRM
    }
    fetch(`${SURVEY_URL}?order=${encodeURIComponent(orderCode)}&sklep=keika`, { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => {
        if (cancelled) return;
        const parsed = parseQuestions(data);
        if (parsed.length === 0) {
          setStatus("hidden");
          return;
        }
        setQuestions(parsed);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("hidden");
      });
    return () => {
      cancelled = true;
    };
  }, [orderCode]);

  useEffect(() => {
    if (status !== "ready" || shownTracked.current) return;
    shownTracked.current = true;
    trackShopStep("survey_shown", orderCode, { order_code: orderCode, questions: questions.length, ids: questions.map((q) => q.id).join(",") });
  }, [status, orderCode, questions]);

  if (status === "loading" || status === "hidden") return null;

  const answeredCount = Object.keys(answers).length;
  const heading = COUNT_WORDS[questions.length] || "Kilka szybkich pytań";

  function pick(questionId: string, option: string) {
    setError(false);
    setAnswers((prev) => {
      const next = { ...prev };
      if (next[questionId] === option) delete next[questionId];
      else next[questionId] = option;
      return next;
    });
  }

  function skip() {
    try {
      window.localStorage.setItem(skipKey(orderCode), "1");
    } catch {
      // nic - schowamy i tak
    }
    trackShopStep("survey_skipped", orderCode, { order_code: orderCode, answered: answeredCount });
    setStatus("hidden");
  }

  async function send() {
    if (answeredCount === 0) return;
    setStatus("sending");
    setError(false);
    try {
      const response = await fetch(SURVEY_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: orderCode, odpowiedzi: answers }),
      });
      const result = await response.json().catch(() => null);
      if (!response.ok || !result || result.ok !== true) throw new Error("Survey not saved");
      trackShopStep("survey_answered", orderCode, { order_code: orderCode, answered: answeredCount, questions: questions.length });
      setStatus("sent");
    } catch {
      setError(true);
      setStatus("ready");
    }
  }

  if (status === "sent") {
    return (
      <section className="order-survey is-sent" aria-label="Ankieta">
        <p role="status">
          <strong>Dziękujemy!</strong> Każda odpowiedź naprawdę nam pomaga.
        </p>
      </section>
    );
  }

  const sending = status === "sending";

  return (
    <section className="order-survey" aria-label="Ankieta">
      <div className="order-survey-head">
        <h2>{heading}</h2>
        <p>Pomogą nam działać lepiej. Wystarczy kliknąć, a jeśli nie masz ochoty - pomiń.</p>
      </div>
      <ol className="order-survey-list">
        {questions.map((question, index) => (
          <li key={question.id}>
            <p className="order-survey-q" id={`order-survey-q-${index}`}>
              {question.text}
            </p>
            <div className="order-survey-options" role="group" aria-labelledby={`order-survey-q-${index}`}>
              {question.options.map((option) => {
                const selected = answers[question.id] === option;
                return (
                  <button
                    key={option}
                    type="button"
                    className={`order-survey-pill${selected ? " is-selected" : ""}`}
                    aria-pressed={selected}
                    disabled={sending}
                    onClick={() => pick(question.id, option)}
                  >
                    {option}
                  </button>
                );
              })}
            </div>
          </li>
        ))}
      </ol>
      {error ? (
        <p className="order-survey-error" role="alert">
          Nie udało się wysłać. Spróbuj jeszcze raz.
        </p>
      ) : null}
      <div className="order-survey-actions">
        <button type="button" className="order-contact-btn" onClick={send} disabled={answeredCount === 0 || sending}>
          {sending ? "Wysyłamy…" : "Wyślij"}
        </button>
        <button type="button" className="order-survey-skip" onClick={skip} disabled={sending}>
          Pomiń
        </button>
      </div>
    </section>
  );
}
