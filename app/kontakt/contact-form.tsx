"use client";

import { useRef, useState } from "react";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";

type SubmitState = "idle" | "submitting" | "sent" | "error";

export default function ContactForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("");
  // Honeypot - a real visitor never sees this field (hidden via CSS below),
  // only something that fills in every input on the page does.
  const [website, setWebsite] = useState("");
  const [state, setState] = useState<SubmitState>("idle");
  const [error, setError] = useState("");
  const renderedAtRef = useRef(Date.now());

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setState("submitting");
    try {
      const response = await fetch("https://crm-keika.groovemedia.pl/biuro/api/shop-public/contact_submit.php", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email,
          phone,
          message,
          website,
          form_rendered_at: renderedAtRef.current,
          page_url: window.location.href,
          referrer: document.referrer,
          viewport_width: window.innerWidth,
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!json.ok) {
        throw new Error(json.error || "Nie udało się wysłać zapytania.");
      }
      setState("sent");
      setName("");
      setEmail("");
      setPhone("");
      setMessage("");
    } catch (submitError) {
      setState("error");
      setError(submitError instanceof Error ? submitError.message : "Wystąpił błąd.");
    }
  }

  if (state === "sent") {
    return (
      <div className={styles.successBox}>
        Dziękujemy za zapytanie! Odpowiemy najszybciej jak możemy.
      </div>
    );
  }

  return (
    <form className={styles.formGrid} onSubmit={handleSubmit}>
      {/* Honeypot: real users never see or reach this via keyboard/screen reader. */}
      <label style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }} aria-hidden="true">
        Strona www (nie wypełniaj)
        <input
          type="text"
          tabIndex={-1}
          autoComplete="off"
          value={website}
          onChange={(event) => setWebsite(event.target.value)}
        />
      </label>

      <label className={styles.field}>
        Imię
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label className={styles.field}>
        E-mail
        <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
      </label>
      <label className={styles.field}>
        Telefon (opcjonalnie)
        <input type="tel" value={phone} onChange={(event) => setPhone(event.target.value)} />
      </label>
      <label className={styles.field}>
        Treść zapytania
        <textarea value={message} onChange={(event) => setMessage(event.target.value)} required rows={6} />
      </label>

      {error ? <div className={styles.errorBox}>{error}</div> : null}

      <button type="submit" className={styles.ctaButton} disabled={state === "submitting"}>
        {state === "submitting" ? "Wysyłanie…" : "Wyślij zapytanie"}
      </button>
    </form>
  );
}
