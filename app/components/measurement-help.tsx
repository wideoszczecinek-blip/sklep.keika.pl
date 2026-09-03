"use client";

import { useRef, useState } from "react";
import { openCrispChat } from "@/lib/crisp";
import { trackShopStep } from "@/lib/track-step";

/**
 * "Poproś o pomoc" - shown under the video in the measurement-instructions
 * modal (opened from the configurator's "Jak zmierzyć?"). Three plain,
 * full-width CTAs stacked one under the other. The dimensions step is the
 * single biggest drop-off in the funnel.
 */

type Props = {
  phone: string;
  productSlug?: string;
  /** Called right before Crisp opens so the host can close its own modal -
   * the chat should own the screen, not sit behind a dialog. */
  onOpenChat?: () => void;
};

const CONTACT_ENDPOINT = "https://crm-keika.groovemedia.pl/biuro/api/shop-public/contact_submit.php";

export default function MeasurementHelp({ phone, productSlug, onOpenChat }: Props) {
  const [mode, setMode] = useState<"menu" | "form">("menu");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [message, setMessage] = useState("Potrzebuję pomocy z pomiarem moskitiery.");
  const [website, setWebsite] = useState(""); // honeypot
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [error, setError] = useState("");
  const renderedAtRef = useRef(Date.now());
  const slug = productSlug || "";
  const telHref = `tel:${phone.replace(/[^\d+]/g, "")}`;

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
          message: `${message}${slug ? `\n\n[produkt: ${slug}]` : ""}`,
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
      trackShopStep("measurement_help_request", "email_form", { product_slug: slug });
    } catch (submitError) {
      setState("error");
      setError(submitError instanceof Error ? submitError.message : "Wystąpił błąd.");
    }
  }

  if (state === "sent") {
    return (
      <div className="mhelp mhelp-done">
        <strong>Dziękujemy — odezwiemy się jak najszybciej.</strong>
        <p>Zwykle odpowiadamy w kilka godzin w dni robocze.</p>
      </div>
    );
  }

  if (mode === "form") {
    return (
      <form className="mhelp mhelp-form" onSubmit={submit}>
        <p className="mhelp-title">Wyślij zapytanie</p>
        <label className="mhelp-hp" aria-hidden="true">
          Strona www
          <input type="text" tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} />
        </label>
        <input type="text" placeholder="Imię" value={name} onChange={(e) => setName(e.target.value)} required />
        <input
          type="text"
          inputMode="email"
          placeholder="E-mail lub telefon"
          value={contact}
          onChange={(e) => setContact(e.target.value)}
          required
        />
        <textarea rows={3} placeholder="W czym możemy pomóc?" value={message} onChange={(e) => setMessage(e.target.value)} required />
        {error ? <p className="mhelp-error">{error}</p> : null}
        <div className="mhelp-form-row">
          <button type="button" className="mhelp-back" onClick={() => setMode("menu")}>
            Wróć
          </button>
          <button type="submit" className="mhelp-submit" disabled={state === "sending"}>
            {state === "sending" ? "Wysyłam…" : "Wyślij"}
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="mhelp">
      <p className="mhelp-title">Potrzebujesz pomocy z pomiarem?</p>

      <a
        className="mhelp-cta"
        href={telHref}
        onClick={() => trackShopStep("measurement_help_request", "call", { product_slug: slug })}
      >
        Zadzwoń — {phone}
      </a>

      <button
        type="button"
        className="mhelp-cta mhelp-cta-primary"
        onClick={() => {
          trackShopStep("measurement_help_request", "chat", { product_slug: slug });
          onOpenChat?.();
          openCrispChat();
        }}
      >
        Napisz na czacie
      </button>

      <button type="button" className="mhelp-cta" onClick={() => setMode("form")}>
        Wyślij zapytanie e-mailem
      </button>
    </div>
  );
}
