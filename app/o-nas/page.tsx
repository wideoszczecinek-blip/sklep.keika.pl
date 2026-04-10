import { fetchLegalPage, fetchSiteContent } from "@/lib/shop-public";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";

export default async function AboutPage() {
  const [{ site }, { page }] = await Promise.all([
    fetchSiteContent(),
    fetchLegalPage("o-nas"),
  ]);

  return (
    <main className={styles.page}>
      <div className={styles.shell}>
        <article className={styles.legalCard}>
          <h1>{page.title}</h1>
          <p className={styles.sectionIntro}>{site.company_name}</p>
          <div
            className={styles.legalHtml}
            dangerouslySetInnerHTML={{ __html: page.body_html || "<p>Treść zostanie uzupełniona w CRM.</p>" }}
          />
        </article>
      </div>
    </main>
  );
}

