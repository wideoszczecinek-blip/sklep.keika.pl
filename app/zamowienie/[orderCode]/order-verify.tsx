"use client";

import { useState } from "react";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";
import type { PublicOrder } from "@/lib/shop-public";

export default function OrderVerify({ orderCode }: { orderCode: string }) {
  const [verifier, setVerifier] = useState("");
  const [order, setOrder] = useState<PublicOrder | null>(null);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError("");

    try {
      const response = await fetch(
        `/api/orders/${encodeURIComponent(orderCode)}?verifier=${encodeURIComponent(verifier)}`,
      );
      const json = (await response.json()) as { ok: boolean; order?: PublicOrder; error?: string };
      if (!json.ok || !json.order) {
        throw new Error(json.error || "Nie udało się odczytać zamówienia.");
      }
      setOrder(json.order);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Wystąpił błąd.");
    } finally {
      setIsSubmitting(false);
    }
  }

  if (order) {
    return (
      <section className={styles.orderCard}>
        <h2>Zamówienie {order.order_code}</h2>
        <div className={styles.orderMeta}>
          <div>Status: <strong>{order.status}</strong></div>
          <div>Płatność: <strong>{order.payment_status}</strong></div>
          <div>Kwota: <strong>{order.amount_total ? `${order.amount_total} ${order.currency}` : "—"}</strong></div>
          <div>Produkt: <strong>{order.product_label}</strong></div>
          <div>Adres: <strong>{order.shipping_address_line_1}</strong> {order.shipping_address_line_2}</div>
          <div>Miasto: <strong>{order.shipping_postcode} {order.shipping_city}</strong></div>
        </div>
        {order.note_text ? <div className={styles.noticeBox}>{order.note_text}</div> : null}
        {order.summary_text ? <div className={styles.copyHtml}><p>{order.summary_text}</p></div> : null}
      </section>
    );
  }

  return (
    <section className={styles.verifyCard}>
      <h2>Zweryfikuj dostęp do zamówienia</h2>
      <p className={styles.sectionIntro}>
        Link z e-maila nie wystarcza do podglądu danych. Wpisz telefon albo e-mail podany podczas składania zamówienia.
      </p>
      {error ? <div className={styles.errorBox}>{error}</div> : null}
      <form className={styles.formGrid} onSubmit={handleSubmit}>
        <label className={styles.field}>
          Telefon lub e-mail
          <input value={verifier} onChange={(event) => setVerifier(event.target.value)} required />
        </label>
        <button type="submit" className={styles.ctaButton} disabled={isSubmitting}>
          {isSubmitting ? "Sprawdzamy…" : "Pokaż zamówienie"}
        </button>
      </form>
    </section>
  );
}

