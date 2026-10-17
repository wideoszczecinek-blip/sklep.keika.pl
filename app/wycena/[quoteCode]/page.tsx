import { notFound } from "next/navigation";
import QuoteCheckout from "./quote-checkout";
import { fetchPublicQuote } from "@/lib/shop-public";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";
import { isSupplierSummaryRow } from "@/features/rolety/ss-options";

// Reserved for real, placed quotes/orders (a customer who actually
// configured a product) - the static "Moja wycena" summary below. A link
// meant to send someone back into live shopping (cart restored, product
// page reopened, promo re-activated) is a different concept entirely - see
// app/wizyta/[quoteCode]/page.tsx, which the SEZON20 countdown banner's
// "Zapisz link" and the exit-intent modal both use instead. Live feedback
// 2026-09-06: this route used to be overloaded for that too (a promo-only
// quote has nothing to show here - position_count is always 0), which is
// exactly the confusion /wizyta/ now exists to avoid.
type QuotePageProps = {
  params: Promise<{ quoteCode: string }>;
};

export default async function QuotePage({ params }: QuotePageProps) {
  const { quoteCode } = await params;
  const response = await fetchPublicQuote(quoteCode);

  if (!response.ok || !response.quote) {
    notFound();
  }

  // Sekcja "Zamówienie u dostawcy" i meta.supplier są tylko dla biura - nie
  // trafiają do HTML ani do danych komponentu klienckiego (QuoteCheckout
  // korzysta wyłącznie z quote_code).
  const quote = {
    ...response.quote,
    payload: response.quote.payload
      ? {
          ...response.quote.payload,
          positions: (response.quote.payload.positions || []).map((position) => {
            const { meta: _meta, ...rest } = position as typeof position & { meta?: unknown };
            void _meta;
            return { ...rest, summary_rows: (position.summary_rows || []).filter((row) => !isSupplierSummaryRow(row.label)) };
          }),
        }
      : response.quote.payload,
  };

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
                  {/* Sekcja "Zamówienie u dostawcy" jest tylko dla biura. */}
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

