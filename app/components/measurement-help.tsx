"use client";

import { useRef, useState } from "react";
import { openCrispChat } from "@/lib/crisp";
import { trackShopStep } from "@/lib/track-step";

/**
 * "Poproś o pomoc" panel shown under the video in the measurement-instructions
 * modal (opened from the configurator's "Jak zmierzyć?"). Three ways out for a
 * customer who's stuck on measuring - the dimensions step is the single
 * biggest drop-off in the funnel.
 */

type Props = {
  phone: string;
  productSlug?: string;
  /** Called right before Crisp is opened so the host can close its own modal -
   * the chat should own the screen like a normal site chat, not sit behind
   * a dialog. */
  onOpenChat?: () => void;
};

const CONTACT_ENDPOINT = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/contact_submit.php";

function telHref(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, "");
  return `tel:${cleaned}`;
}

export default function MeasurementHelp({ phone, productSlug, onOpenChat }: Props) {
  const [mode, setMode] = useState<"menu" | "form">("menu");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("Potrzebuję pomocy z pomiarem moskitiery.");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const renderedAtRef = useRef(Date.now());

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setState("sending");
    const looksLikeEmail = contact.includes("@");
    try {
      const res = await fetch(CONTACT_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          email: looksLikeEmail ? contact : "",
          phone: looksLikeEmail ? "" : contact,
          message: `${message}${productSlug ? `\n\n[produkt: ${productSlug}]` : ""}`,
          website,
          form_rendered_at: renderedAtRef.current,
          page_url: typeof window !== "undefined" ? window.location.href : "",
          referrer: typeof document !== "undefined" ? document.referrer : "",
          source: "measurement_help",
        }),
      });
      const json = (await res.json().catch(() => ({ ok: false }))) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) throw new Error(json.error || "Nie udało się wysłać zapytania.");
      setState("sent");
      trackShopStep("measurement_help_request", "email_form", { product_slug: productSlug || "" });
    } catch (submitError) {
      setState("error");
      setError(submitError instanceof Error ? submitError.message : "Wystąpił błąd.");
    }
  }

  if (state === "sent") {
    return (
      <div className="measurement-help measurement-help--done">
        <strong>Dziękujemy — odezwiemy się jak najszybciej.</strong>
        <p>Zwykle odpowiadamy w kilka godzin w dni robocze.</p>
      </div>
    );
  }

  return (
    <div className="measurement-help">
      <p className="measurement-help-lead">
        Nie wiesz jak zmierzyć albo masz nietypowe okno? Pomożemy — bez zobowiązań.
      </p>

      {mode === "menu" ? (
        <div className="measurement-help-actions">
          <a
            className="measurement-help-btn"
            href={telHref(phone)}
            onClick={() => trackShopStep("measurement_help_request", "call", { product_slug: productSlug || "" })}
          >
            <span className="measurement-help-btn-title">Zadzwoń i skonsultuj</span>
            <span className="measurement-help-btn-sub">{phone}</span>
          </a>

          <button
            type="button"
            className="measurement-help-btn is-primary"
            onClick={() => {
              trackShopStep("measurement_help_request", "chat", { product_slug: productSlug || "" });
              onOpenChat?.();
              openCrispChat();
            }}
          >
            <span className="measurement-help-btn-title">Napisz na czacie</span>
            <span className="measurement-help-btn-sub">Odpisujemy na żywo — okno chatu schowasz do dymka</span>
          </button>

          <button
            type="button"
            className="measurement-help-btn"
            onClick={() => setMode("form")}
          >
            <span className="measurement-help-btn-title">Wyślij zapytanie</span>
            <span className="measurement-help-btn-sub">Oddzwonimy lub odpiszemy na e-mail</span>
          </button>
        </div>
      ) : (
        <form className="measurement-help-form" onSubmit={submit}>
          <label className="measurement-help-hp" aria-hidden="true">
            Strona www
            <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
          </label>
          <input
            type="text"
            placeholder="Imię"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            type="text"
            inputMode="email"
            placeholder="E-mail lub telefon"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
            required
          />
          <textarea
            rows={3}
            placeholder="W czym możemy pomóc?"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            required
          />
          {error ? <p className="measurement-help-error">{error}</p> : null}
          <div className="measurement-help-form-actions">
            <button type="button" className="measurement-help-back" onClick={() => setMode("menu")}>
              Wróć
            </button>
            <button type="submit" className="measurement-help-submit" disabled={state === "sending"}>
              {state === "sending" ? "Wysyłam…" : "Wyślij"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
