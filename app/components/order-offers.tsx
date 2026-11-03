"use client";

import { useState } from "react";
import { CRM_PUBLIC_BASE } from "./payment-methods";

export default function OrderOffers({ orderCode, accessToken, verifier }: { orderCode: string; accessToken?: string; verifier?: string }) {
  const [status, setStatus] = useState<"ready" | "sending" | "saved" | "hidden" | "error">("ready");
  if ((!accessToken && !verifier) || status === "hidden") return null;

  async function accept() {
    setStatus("sending");
    try {
      const response = await fetch(`${CRM_PUBLIC_BASE}/order_marketing_consent.php`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_code: orderCode, access_token: accessToken, verifier, accepted: true }),
      });
      const result = await response.json();
      if (!response.ok || result.ok !== true) throw new Error("Consent was not saved");
      setStatus("saved");
    } catch {
      setStatus("error");
    }
  }

  return (
    <section className="checkout-order-offers" aria-label="Oferty po zamówieniu">
      {status === "saved" ? <p role="status"><strong>Dziękujemy!</strong> Zapisaliśmy Twoją zgodę na oferty e-mailem.</p> : <>
        <h2>Zostańmy w kontakcie</h2>
        <p>Chcesz dostawać od KEIKA e-maile z promocjami i kodami rabatowymi na kolejne zamówienia? Zgodę możesz wycofać w każdej chwili.</p>
        <div>
          <button type="button" onClick={accept} disabled={status === "sending"}>{status === "sending" ? "Zapisujemy…" : "Tak, chcę otrzymywać oferty"}</button>
          <button type="button" onClick={() => setStatus("hidden")} disabled={status === "sending"}>Nie, dziękuję</button>
        </div>
        {status === "error" ? <p role="alert">Nie udało się zapisać zgody. Spróbuj ponownie.</p> : null}
      </>}
    </section>
  );
}
