import { fetchLegalPage, fetchSiteContent } from "@/lib/shop-public";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";

export default async function ContactPage() {
  const [{ site }, { page }] = await Promise.all([
    fetchSiteContent(),
    fetchLegalPage("kontakt"),
  ]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <article className={styles.legalCard}>
          <h1>{page.title}</h1>
          <div className={styles.orderMeta}>
            {site.contact_phone ? <div>Telefon: <strong>{site.contact_phone}</strong></div> : null}
            {site.contact_email ? <div>E-mail: <strong>{site.contact_email}</strong></div> : null}
            {site.contact_hours ? <div>Godziny kontaktu: <strong>{site.contact_hours}</strong></div> : null}
          </div>
          <div
            className={styles.legalHtml}
            dangerouslySetInnerHTML={{ __html: page.body_html || "<p>Treść zostanie uzupełniona w CRM.</p>" }}
          />
        </article>
      </div>
    </main>
  );
}

