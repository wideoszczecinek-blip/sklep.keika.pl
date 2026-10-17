import Link from "next/link";
import { HOMEPAGE_CONFIG_SNAPSHOT } from "@/lib/landing-snapshot";
import type { OfertaContent, OfertaStep } from "./types";
import { OFERTA_BY_SLUG, OFERTA_GROUP_LABELS } from "./registry";
import { FeatureIcon } from "./icons";
import QuoteForm from "./QuoteForm";
import { ChatCta, OfertaHeader, StickyBar, VariantPick } from "./LandingCtas";
import styles from "./oferta.module.css";

const DEFAULT_STEPS: OfertaStep[] = [
  { title: "Napisz, czego potrzebujesz", body: "Wypełnij krótki formularz albo zadzwoń. Wystarczą orientacyjne wymiary i zdjęcie okna lub tarasu." },
  { title: "Dobieramy system i wyceniamy", body: "Oddzwaniamy, doradzamy wariant i tkaninę, podajemy cenę z montażem - bez zobowiązań." },
  { title: "Pomiar u Ciebie", body: "W zasięgu dojazdu mierzymy sami. Dalej - wysyłamy prostą instrukcję pomiaru i wyceniamy z wysyłką." },
  { title: "Produkcja i montaż", body: "Robimy na wymiar, montujemy lub wysyłamy. Termin podajemy przy wycenie i potwierdzamy po pomiarze." },
];

type Branding = { site_title?: string; contact_phone?: string; logo_url?: string };
type TopLink = { label?: string; url?: string };

function snapshotBranding(): { branding: Branding; topLinks: TopLink[] } {
  const raw = HOMEPAGE_CONFIG_SNAPSHOT as { branding?: Branding; top_links?: TopLink[] };
  return { branding: raw.branding || {}, topLinks: Array.isArray(raw.top_links) ? raw.top_links : [] };
}

export default function InfoLanding({ content }: { content: OfertaContent }) {
  const { branding, topLinks } = snapshotBranding();
  const phone = String(branding.contact_phone || "").trim();
  const steps = content.steps && content.steps.length ? content.steps : DEFAULT_STEPS;
  const related = content.related.map((slug) => OFERTA_BY_SLUG[slug]).filter(Boolean);

  return (
    <div className={`catalog-root ${styles.root}`} style={{ backgroundImage: "none" }}>
      <OfertaHeader
        logoUrl={branding.logo_url || ""}
        siteTitle={branding.site_title || "KEIKA"}
        topLinks={topLinks}
        contactPhone={phone}
      />

      <main>
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <div>
              <ol className={styles.crumbs} aria-label="Ścieżka">
                <li>
                  <Link href="/">KEIKA</Link>
                </li>
                <li>{OFERTA_GROUP_LABELS[content.group]}</li>
                <li>{content.menuLabel}</li>
              </ol>
              <p className={styles.eyebrow}>{content.eyebrow}</p>
              <h1 className={styles.title}>{content.title}</h1>
              <p className={styles.lead}>{content.lead}</p>
              <ul className={styles.chips}>
                {content.heroChips.map((chip) => (
                  <li key={chip}>{chip}</li>
                ))}
              </ul>
              <div className={styles.actions}>
                <a href="#wycena" className={styles.btnPrimary}>
                  Poproś o wycenę
                </a>
                <ChatCta productLabel={content.productLabel} slug={content.slug} className={styles.btnGhost}>
                  Zapytaj o ofertę na czacie
                </ChatCta>
                {phone ? (
                  <a href={`tel:${phone.replace(/\s+/g, "")}`} className={styles.btnGhost}>
                    Zadzwoń: {phone}
                  </a>
                ) : null}
              </div>
              <p className={styles.heroNote}>Wycena jest bezpłatna i niezobowiązująca. Odpowiadamy zwykle w ciągu jednego dnia roboczego.</p>
            </div>
            <figure className={`${styles.heroMedia} ${content.hero.fit === "contain" ? styles.heroMediaContain : ""}`}>
              <img src={content.hero.src} alt={content.hero.alt} fetchPriority="high" />
              <figcaption className={styles.heroBadge}>Na wymiar · montaż lub wysyłka</figcaption>
            </figure>
          </div>
        </section>

        <section className={styles.section} aria-labelledby="warianty">
          <div className={styles.sectionHead}>
            <p className={styles.sectionLabel}>Warianty</p>
            <h2 id="warianty" className={styles.sectionTitle}>
              {content.variants.title}
            </h2>
            <p className={styles.sectionIntro}>{content.variants.intro}</p>
          </div>
          <div className={styles.variantGrid}>
            {content.variants.items.map((variant, index) => {
              // Opcja w formularzu: jawnie z treści, inaczej po kolejności (ostatnia
      // opcja to zawsze "Nie wiem - proszę o doradztwo", więc jej nie bierzemy).
      const option = variant.quoteOption || (index < content.quoteOptions.length - 1 ? content.quoteOptions[index] : content.quoteOptions[0]);
              return (
                <article key={variant.id} className={styles.variantCard}>
                  {variant.image ? (
                    <div className={styles.variantMedia}>
                      <img src={variant.image} alt={variant.imageAlt || variant.name} loading="lazy" />
                    </div>
                  ) : null}
                  <div className={styles.variantBody}>
                    <p className={styles.variantTag}>{variant.tagline}</p>
                    <h3 className={styles.variantName}>{variant.name}</h3>
                    <p className={styles.variantText}>{variant.body}</p>
                    {variant.bullets?.length ? (
                      <ul className={styles.variantBullets}>
                        {variant.bullets.map((bullet) => (
                          <li key={bullet}>{bullet}</li>
                        ))}
                      </ul>
                    ) : null}
                    <div className={styles.variantCta}>
                      <VariantPick option={option} slug={content.slug} />
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="dlaczego">
          <div className={styles.sectionHead}>
            <p className={styles.sectionLabel}>Dlaczego warto</p>
            <h2 id="dlaczego" className={styles.sectionTitle}>
              Co dostajesz razem z produktem
            </h2>
          </div>
          <div className={styles.featureGrid}>
            {content.features.map((feature) => (
              <article key={feature.title} className={styles.feature}>
                <span className={styles.featureIcon}>
                  <FeatureIcon icon={feature.icon} />
                </span>
                <h3>{feature.title}</h3>
                <p>{feature.body}</p>
              </article>
            ))}
          </div>
        </section>

        {content.gallery.length ? (
          <section className={styles.section} aria-labelledby="galeria">
            <div className={styles.sectionHead}>
              <p className={styles.sectionLabel}>Galeria</p>
              <h2 id="galeria" className={styles.sectionTitle}>
                Jak to wygląda z bliska
              </h2>
            </div>
            <div className={styles.gallery}>
              {content.gallery.map((item) => (
                <figure key={item.src} className={styles.galleryItem}>
                  <img src={item.src} alt={item.alt} loading="lazy" />
                  {item.caption ? <figcaption>{item.caption}</figcaption> : null}
                </figure>
              ))}
            </div>
          </section>
        ) : null}

        <section className={styles.section} aria-labelledby="jak">
          <div className={styles.sectionHead}>
            <p className={styles.sectionLabel}>Jak to działa</p>
            <h2 id="jak" className={styles.sectionTitle}>
              Od zapytania do montażu w czterech krokach
            </h2>
          </div>
          <div className={styles.stepsGrid}>
            {steps.map((step, index) => (
              <article key={step.title} className={styles.step}>
                <span className={styles.stepNo}>{index + 1}</span>
                <h3>{step.title}</h3>
                <p>{step.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className={styles.section} aria-labelledby="parametry">
          <div className={styles.sectionHead}>
            <p className={styles.sectionLabel}>Dane techniczne</p>
            <h2 id="parametry" className={styles.sectionTitle}>
              {content.specs.title}
            </h2>
          </div>
          <table className={styles.specs}>
            <tbody>
              {content.specs.items.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {content.supplier ? (
            <p className={styles.supplier}>
              System i komponenty: <strong>{content.supplier.name}</strong> - {content.supplier.note}. Wykonanie na wymiar i montaż: KEIKA.
            </p>
          ) : null}
        </section>

        <section className={styles.section} aria-labelledby="faq">
          <div className={styles.sectionHead}>
            <p className={styles.sectionLabel}>Pytania i odpowiedzi</p>
            <h2 id="faq" className={styles.sectionTitle}>
              Najczęstsze pytania
            </h2>
          </div>
          <div className={styles.faqList}>
            {content.faq.map((entry) => (
              <details key={entry.q} className={styles.faqItem}>
                <summary>{entry.q}</summary>
                <p>{entry.a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="wycena" className={styles.quote} aria-labelledby="wycena-tytul">
          <div className={styles.quoteCard}>
            <div className={styles.quoteCopy}>
              <h2 id="wycena-tytul">Poproś o wycenę</h2>
              <p>
                Napisz, co chcesz zasłonić, a my dobierzemy system i podamy cenę. Bez konfiguratora, bez zobowiązań - jeden kontakt i wiesz, ile to kosztuje.
              </p>
              <ul className={styles.quoteList}>
                <li>Wycena bezpłatna, zwykle w ciągu jednego dnia roboczego</li>
                <li>Pomiar u Ciebie w zasięgu dojazdu albo prosta instrukcja pomiaru</li>
                <li>Produkt na wymiar, montaż lub wysyłka kurierem</li>
              </ul>
              <div className={styles.quoteAlt}>
                <ChatCta productLabel={content.productLabel} slug={content.slug} className={styles.btnGhost}>
                  Wolisz czat? Napisz do nas
                </ChatCta>
                {phone ? (
                  <a href={`tel:${phone.replace(/\s+/g, "")}`} className={styles.btnGhost}>
                    {phone}
                  </a>
                ) : null}
              </div>
            </div>
            <QuoteForm productLabel={content.productLabel} options={content.quoteOptions} slug={content.slug} />
          </div>
        </section>

        {related.length ? (
          <section className={styles.related} aria-labelledby="podobne">
            <div className={styles.sectionHead}>
              <p className={styles.sectionLabel}>Zobacz też</p>
              <h2 id="podobne" className={styles.sectionTitle}>
                Podobne produkty
              </h2>
            </div>
            <div className={styles.relatedGrid}>
              {related.map((entry) => (
                <Link key={entry.slug} href={entry.path} className={styles.relatedCard}>
                  <img src={entry.hero.src} alt="" loading="lazy" />
                  <span>
                    <strong>{entry.title}</strong>
                    <span>{OFERTA_GROUP_LABELS[entry.group]}</span>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <StickyBar phone={phone} />
    </div>
  );
}
