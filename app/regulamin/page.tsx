import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchLegalPage, fetchSiteContent } from "@/lib/shop-public";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";

export async function generateMetadata(): Promise<Metadata> {
  try {
    const [{ site }, { page }] = await Promise.all([
      fetchSiteContent(),
      fetchLegalPage("regulamin"),
    ]);
    return {
      title: `${page.title} | KEIKA`,
      alternates: {
        canonical: `${site.primary_domain || "https://sklep.keika.pl"}/regulamin`,
      },
    };
  } catch {
    return {
      title: "Regulamin | KEIKA",
    };
  }
}

export default async function TermsShortcutPage() {
  try {
    const [{ site }, { page }] = await Promise.all([
      fetchSiteContent(),
      fetchLegalPage("regulamin"),
    ]);

    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <article className={styles.legalCard}>
            <h1>{page.title}</h1>
            <p className={styles.sectionIntro}>KEIKA – plisy, rolety i moskitiery na wymiar</p>
            <div
              className={styles.legalHtml}
              dangerouslySetInnerHTML={{ __html: page.body_html || "<p>Treść zostanie uzupełniona w CRM.</p>" }}
            />
          </article>
        </div>
      </main>
    );
  } catch {
    notFound();
  }
}
