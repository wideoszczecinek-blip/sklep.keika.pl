import { notFound } from "next/navigation";
import QuoteCheckout from "./quote-checkout";
import { fetchPublicQuote } from "@/lib/shop-public";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";

type QuotePageProps = {
  params: Promise<{ quoteCode: string }>;
};

export default async function QuotePage({ params }: QuotePageProps) {
  const { quoteCode } = await params;
  const response = await fetchPublicQuote(quoteCode);

  if (!response.ok || !response.quote) {
    notFound();
  }

  const quote = response.quote;

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <section className={styles.quoteCard}>
          <h2>Moja wycena {quote.quote_code}</h2>
          <div className={styles.quoteMeta}>
            <div>Produkt: <strong>{quote.product_label}</strong></div>
            <div>Pozycji: <strong>{quote.position_count}</strong></div>
            <div>Sztuk: <strong>{quote.items_count}</strong></div>
            <div>Jednostek: <strong>{quote.units_count}</strong></div>
            <div>Wartość: <strong>{quote.total_amount ? `${quote.total_amount} ${quote.currency}` : "do wyliczenia"}</strong></div>
          </div>
          <div className={styles.positions}>
            {(quote.payload?.positions || []).map((position) => (
              <article key={position.id} className={styles.position}>
                <strong>{position.product_label}</strong>
                <div className={styles.summaryRows}>
                  {position.summary_rows.map((row, index) => (
                    <div key={`${position.id}-${index}`} className={styles.summaryRow}>
                      <span>{row.label}</span>
                      <span>
                        <strong>{row.value}</strong>
                        {row.note ? <span className={styles.summaryNote}>{row.note}</span> : null}
                      </span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </section>

        <QuoteCheckout quote={quote} />
      </div>
    </main>
  );
}

