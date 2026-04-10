import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { fetchLegalPage, fetchSiteContent } from "@/lib/shop-public";
import styles from "@/app/moskitiery/moskitiery-v2.module.css";

type LegalPageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: LegalPageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const [{ site }, { page }] = await Promise.all([
      fetchSiteContent(),
      fetchLegalPage(slug),
    ]);
    return {
      title: `${page.title} | ${site.site_title}`,
      alternates: {
        canonical: `${site.primary_domain || "https://sklep.keika.pl"}/legal/${slug}`,
      },
    };
  } catch {
    return {
      title: "Informacje | KEIKA",
    };
  }
}

export default async function LegalPage({ params }: LegalPageProps) {
  const { slug } = await params;
  try {
    const [{ site }, { page }] = await Promise.all([
      fetchSiteContent(),
      fetchLegalPage(slug),
    ]);

    return (
      <main className={styles.page}>
        <div className={styles.shell}>
          <article className={styles.legalCard}>
            <h1>{page.title}</h1>
            <p className={styles.sectionIntro}>{site.site_title}</p>
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

