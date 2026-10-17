import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { INFO_LANDINGS_ENABLED } from "@/lib/info-landings";
import { OFERTA_GROUP_LABELS, OFERTA_LANDINGS } from "@/features/oferta/registry";
import { HOMEPAGE_CONFIG_SNAPSHOT } from "@/lib/landing-snapshot";
import { OfertaHeader } from "@/features/oferta/LandingCtas";
import styles from "@/features/oferta/oferta.module.css";

// Przegląd wszystkich informacyjnych landingów produktowych - dla właściciela
// (podgląd przed publikacją) i jako strona zbiorcza oferty po włączeniu.
export const metadata: Metadata = {
  title: "Oferta na wymiar - rolety, żaluzje, markizy, moskitiery | KEIKA",
  description: "Produkty na wymiar z wyceną na zapytanie: rolety tradycyjne, dzień-noc i rzymskie, żaluzje pionowe i fasadowe, rolety zewnętrzne, markizy, moskitiery drzwiowe, przesuwne i plisowane.",
  robots: INFO_LANDINGS_ENABLED ? undefined : { index: false, follow: false },
};

export default function OfertaIndexPage() {
  if (!INFO_LANDINGS_ENABLED) notFound();
  const raw = HOMEPAGE_CONFIG_SNAPSHOT as { branding?: { site_title?: string; contact_phone?: string; logo_url?: string }; top_links?: Array<{ label?: string; url?: string }> };
  const branding = raw.branding || {};
  const groups = Array.from(new Set(OFERTA_LANDINGS.map((entry) => entry.group)));
  const previewNotes = OFERTA_LANDINGS.filter((entry) => entry.ownerNote);

  return (
    <div className={`catalog-root ${styles.root}`} style={{ backgroundImage: "none" }}>
      <OfertaHeader logoUrl={branding.logo_url || ""} siteTitle={branding.site_title || "KEIKA"} topLinks={raw.top_links || []} contactPhone={String(branding.contact_phone || "")} />
      <main>
        <section className={`${styles.section} ${styles.indexHead}`}>
          <div className={styles.sectionHead}>
            <p className={styles.sectionLabel}>Oferta</p>
            <h1 className={styles.sectionTitle}>Produkty na wymiar z wyceną na zapytanie</h1>
            <p className={styles.sectionIntro}>
              Dziesięć stron produktowych bez konfiguratora: opis, warianty, zdjęcia, parametry i formularz „Poproś o wycenę”, który tworzy zgłoszenie w CRM.
            </p>
          </div>
        </section>
        {groups.map((group) => (
          <section key={group} className={styles.section}>
            <div className={styles.sectionHead}>
              <h2 className={styles.sectionTitle}>{OFERTA_GROUP_LABELS[group]}</h2>
            </div>
            <div className={styles.indexGrid}>
              {OFERTA_LANDINGS.filter((entry) => entry.group === group).map((entry) => (
                <Link key={entry.slug} href={entry.path} className={styles.indexCard}>
                  <img src={entry.hero.src} alt={entry.hero.alt} loading="lazy" />
                  <div>
                    <strong>{entry.title}</strong>
                    <span>{entry.heroChips.slice(0, 3).join(" · ")}</span>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
        {previewNotes.length ? (
          <section className={`${styles.section} ${styles.related}`}>
            <div className={styles.sectionHead}>
              <p className={styles.sectionLabel}>Notatki do przeglądu (tylko podgląd lokalny)</p>
              <h2 className={styles.sectionTitle}>Skąd zdjęcia i co warto dołożyć</h2>
            </div>
            {previewNotes.map((entry) => (
              <p key={entry.slug} className={styles.indexNote}>
                <strong>{entry.title}:</strong> {entry.ownerNote}
              </p>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
