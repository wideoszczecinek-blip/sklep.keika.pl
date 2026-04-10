"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import MoskitieryFlowEntry from "@/features/moskitiery/MoskitieryFlowEntry";
import type { LandingPayload, LegalPayload, ProductPayload, SitePayload } from "@/lib/shop-public";
import styles from "./moskitiery-v2.module.css";

type LandingClientProps = {
  site: SitePayload;
  landing: LandingPayload;
  product: ProductPayload;
  legalPages: Record<string, LegalPayload>;
};

function HtmlBlock({ html }: { html: string }) {
  return <div className={styles.copyHtml} dangerouslySetInnerHTML={{ __html: html }} />;
}

const CRM_BASE =
  process.env.NEXT_PUBLIC_CRM_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://crm-keika.groovemedia.pl";

async function trackStorefrontEvent(payload: {
  event_name: string;
  event_label?: string;
  page_slug?: string;
  quote_code?: string;
  order_code?: string;
  session_token?: string;
  device_type?: string;
  referrer?: string;
  meta?: Record<string, boolean | number | string | null>;
}) {
  await fetch(`${CRM_BASE}/biuro/api/shop-public/analytics_event`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}

const measurementSteps = [
  {
    step: "01",
    title: "Sprawdzasz produkt",
    text: "Najpierw pokazujemy prawdziwe zdjęcia i detale, żeby klient dokładnie wiedział, co kupuje.",
  },
  {
    step: "02",
    title: "Mierzysz tylko to, co potrzebne",
    text: "Pomiar jest opisany prostym językiem i ograniczony do danych potrzebnych do wykonania moskitiery.",
  },
  {
    step: "03",
    title: "Konfigurujesz i zapisujesz wycenę",
    text: "Na końcu klient widzi cenę, zapisuje własny kod wyceny i może płynnie przejść do zamówienia.",
  },
];

export default function MoskitieryLandingClient({
  site,
  landing,
  product,
  legalPages,
}: LandingClientProps) {
  const gallery = useMemo(() => {
    const media: string[] = [];
    if (landing.hero.media_url) {
      media.push(landing.hero.media_url);
    }
    for (const item of product.gallery_urls || []) {
      if (item && !media.includes(item)) {
        media.push(item);
      }
    }
    if (!media.length && product.image_url) {
      media.push(product.image_url);
    }
    return media;
  }, [landing.hero.media_url, product.gallery_urls, product.image_url]);

  const productStorySection =
    landing.sections.find((section) => section.id === "product_story") || null;
  const socialProofSection =
    landing.sections.find((section) => section.id === "social_proof") || null;
  const measurementSection =
    landing.sections.find((section) => section.id === "measurement") || null;
  const configuratorSection =
    landing.sections.find((section) => section.id === "configurator") || null;
  const extraSections = landing.sections.filter(
    (section) =>
      !["product_story", "social_proof", "measurement", "configurator"].includes(section.id),
  );

  const heroMetrics = useMemo(
    () => [
      {
        label: "Cena startowa",
        value: product.price_from || "wycena online",
        note: "cena końcowa zależy od wymiaru i wybranych opcji",
      },
      {
        label: "Wsparcie",
        value: site.contact_phone || "pomoc na żywo",
        note: site.contact_hours || "pomożemy przed pomiarem",
      },
      {
        label: "Proces",
        value: "3 proste kroki",
        note: "produkt, pomiar, konfiguracja",
      },
    ],
    [product.price_from, site.contact_hours, site.contact_phone],
  );

  const reassuranceCards = useMemo(
    () => [
      {
        title: "Realny produkt",
        text: "Pokazujemy prawdziwe zdjęcia i detale, zanim klient przejdzie do konfiguracji.",
      },
      {
        title: "Cena przed zakupem",
        text: "W konfiguratorze od razu widać wycenę. Bez czekania na kontakt i bez zgadywania kosztu.",
      },
      {
        title: "Powrót do wyceny",
        text: "Konfigurację można zapisać i wrócić do niej później po własnym kodzie.",
      },
    ],
    [],
  );

  const productFeatures = useMemo(
    () => [
      {
        title: "Aluminiowa, estetyczna rama",
        text: "Sztywna konstrukcja wygląda jak część okna, a nie przypadkowy dodatek na sezon.",
      },
      {
        title: "Bezpieczny proces dla klienta z reklamy",
        text: "Najpierw klient rozumie produkt i pomiar, a dopiero potem wchodzi w konfigurator.",
      },
      {
        title: "Zakup prosty jak na marketplace",
        text: "Zostawiamy łatwość procesu, ale bez ograniczeń treściowych i wizerunkowych portalu.",
      },
    ],
    [],
  );

  const journeyHighlights = useMemo(
    () => [
      landing.trust_badges[0] || "Na wymiar",
      landing.trust_badges[1] || "Realne zdjęcia produktu",
      landing.trust_badges[2] || "Szybka wycena online",
    ],
    [landing.trust_badges],
  );

  const [activeSlide, setActiveSlide] = useState(0);
  const [openModal, setOpenModal] = useState<string | null>(null);

  useEffect(() => {
    void trackStorefrontEvent({
      event_name: "view_landing",
      event_label: "landing_moskitiery",
      page_slug: landing.slug,
      device_type: window.innerWidth < 768 ? "mobile" : "desktop",
      referrer: document.referrer || "",
      meta: {
        product_slug: landing.product_slug,
      },
    }).catch(() => null);
  }, [landing.product_slug, landing.slug]);

  function openInfoModal(key: string) {
    setOpenModal(key);
    void trackStorefrontEvent({
      event_name: "open_modal",
      event_label: key,
      page_slug: landing.slug,
    }).catch(() => null);
  }

  function handleConfiguratorClick(source: string) {
    void trackStorefrontEvent({
      event_name: "start_configurator",
      event_label: source,
      page_slug: landing.slug,
      meta: {
        product_slug: landing.product_slug,
      },
    }).catch(() => null);
  }

  function changeSlide(step: number) {
    if (!gallery.length) {
      return;
    }
    setActiveSlide((current) => (current + step + gallery.length) % gallery.length);
  }

  const safeIndex = gallery.length ? activeSlide % gallery.length : 0;
  const currentImage = gallery[safeIndex] || product.image_url || "";

  const modalContent =
    openModal === "o-nas"
      ? { title: site.about_title, body_html: site.about_body_html }
      : openModal === "kontakt"
        ? { title: site.contact_title, body_html: site.contact_body_html }
        : openModal
          ? legalPages[openModal]
          : null;

  return (
    <div className={styles.page}>
      <div className={styles.pageNoise} aria-hidden="true" />
      <div className={styles.pageGlowA} aria-hidden="true" />
      <div className={styles.pageGlowB} aria-hidden="true" />

      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            {site.logo_url ? (
              <Image src={site.logo_url} alt={site.site_title} width={42} height={42} />
            ) : null}
            <div className={styles.brandCopy}>
              <span className={styles.brandName}>{site.site_title}</span>
              <span className={styles.brandTag}>moskitiery na wymiar</span>
            </div>
          </div>

          <nav className={styles.topActions} aria-label="Informacje">
            <button type="button" className={styles.topButton} onClick={() => openInfoModal("o-nas")}>
              O nas
            </button>
            <button type="button" className={styles.topButton} onClick={() => openInfoModal("kontakt")}>
              Kontakt
            </button>
            <button type="button" className={styles.topButton} onClick={() => openInfoModal("regulamin")}>
              Regulamin
            </button>
            <Link
              href="#konfigurator"
              className={styles.ctaButton}
              onClick={() => handleConfiguratorClick("topbar")}
            >
              {landing.hero.cta_label || "Przejdź do konfiguratora"}
            </Link>
          </nav>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.heroEyebrowRow}>
              <span className={styles.eyebrow}>{landing.hero.eyebrow}</span>
              <span className={styles.signalDot} />
              <span className={styles.heroHint}>landing nastawiony na decyzję zakupową</span>
            </div>

            <h1 className={styles.heroTitle}>{landing.hero.title}</h1>
            <p className={styles.heroSubtitle}>{landing.hero.subtitle}</p>

            <div className={styles.badgeRow}>
              {landing.trust_badges.map((badge) => (
                <span key={badge} className={styles.badge}>
                  {badge}
                </span>
              ))}
            </div>

            <div className={styles.heroActions}>
              <Link
                href="#konfigurator"
                className={styles.ctaButton}
                onClick={() => handleConfiguratorClick("hero")}
              >
                {landing.hero.cta_label || "Przejdź do konfiguratora"}
              </Link>
              <button type="button" className={styles.ghostButton} onClick={() => openInfoModal("kontakt")}>
                Pomoc przed pomiarem
              </button>
            </div>

            <div className={styles.heroMetrics}>
              {heroMetrics.map((item) => (
                <article key={item.label} className={styles.metricCard}>
                  <span className={styles.metricLabel}>{item.label}</span>
                  <strong className={styles.metricValue}>{item.value}</strong>
                  <span className={styles.metricNote}>{item.note}</span>
                </article>
              ))}
            </div>
          </div>

          <div className={styles.heroMedia}>
            <div className={styles.mainFrame}>
              <button
                type="button"
                className={`${styles.galleryNav} ${styles.galleryNavLeft}`}
                aria-label="Poprzednie zdjęcie"
                onClick={() => changeSlide(-1)}
              >
                ‹
              </button>

              <div className={styles.mainFrameInner}>
                {landing.hero.media_kind === "video" && currentImage.endsWith(".mp4") ? (
                  <video src={currentImage} autoPlay muted loop playsInline className={styles.mainMedia} />
                ) : currentImage ? (
                  <Image
                    src={currentImage}
                    alt={product.name}
                    fill
                    priority
                    sizes="(max-width: 1024px) 100vw, 40vw"
                    className={styles.mainMedia}
                  />
                ) : null}
              </div>

              <button
                type="button"
                className={`${styles.galleryNav} ${styles.galleryNavRight}`}
                aria-label="Następne zdjęcie"
                onClick={() => changeSlide(1)}
              >
                ›
              </button>

              <div className={styles.floatingCard}>
                <span className={styles.floatingLabel}>Prawdziwy produkt</span>
                <strong>{product.name}</strong>
                <p>{product.subtitle || "Na wymiar, z czytelnym procesem pomiaru i szybką wyceną online."}</p>
              </div>
            </div>

            <div className={styles.galleryRail}>
              <div className={styles.galleryCounter}>
                {String(safeIndex + 1).padStart(2, "0")} / {String(Math.max(gallery.length, 1)).padStart(2, "0")}
              </div>
              <div className={styles.galleryDots}>
                {gallery.map((image, index) => (
                  <button
                    key={`${image}-${index}`}
                    type="button"
                    className={`${styles.galleryDot} ${index === safeIndex ? styles.galleryDotActive : ""}`}
                    onClick={() => setActiveSlide(index)}
                    aria-label={`Pokaż zdjęcie ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className={styles.trustStrip}>
          {reassuranceCards.map((card, index) => (
            <article key={card.title} className={styles.trustCard}>
              <span className={styles.trustIndex}>{String(index + 1).padStart(2, "0")}</span>
              <div>
                <h2>{card.title}</h2>
                <p>{card.text}</p>
              </div>
            </article>
          ))}
        </section>

        <section id="produkt" className={`${styles.section} ${styles.spotlightSection}`}>
          <div className={styles.spotlightVisual}>
            <div className={styles.spotlightMainCard}>
              {product.image_url ? (
                <Image
                  src={product.image_url}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 48vw"
                  className={styles.spotlightImage}
                />
              ) : null}
            </div>
            <div className={styles.spotlightAccentCard}>
              <span>{journeyHighlights[0]}</span>
              <strong>{product.price_from || "Wycena online"}</strong>
              <p>zobacz produkt, zmierz w kilku krokach i zapisz własną konfigurację</p>
            </div>
          </div>

          <div className={styles.spotlightCopy}>
            <span className={styles.sectionLabel}>
              {productStorySection?.label || "Produkt"}
            </span>
            <h2 className={styles.sectionTitle}>
              {productStorySection?.title || product.name}
            </h2>
            {productStorySection?.body_html ? (
              <HtmlBlock html={productStorySection.body_html} />
            ) : (
              <p className={styles.sectionIntro}>{product.subtitle || product.description}</p>
            )}

            <div className={styles.featureList}>
              {productFeatures.map((feature, index) => (
                <article key={feature.title} className={styles.featureCard}>
                  <span className={styles.featureIndex}>{String(index + 1).padStart(2, "0")}</span>
                  <div>
                    <h3>{feature.title}</h3>
                    <p>{feature.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.storySection}`}>
          <div className={styles.storyCopy}>
            <span className={styles.sectionLabel}>
              {socialProofSection?.label || "Zaufanie"}
            </span>
            <h2 className={styles.sectionTitle}>
              {socialProofSection?.title || "Co uspokaja klienta przed zakupem"}
            </h2>
            {socialProofSection?.body_html ? (
              <HtmlBlock html={socialProofSection.body_html} />
            ) : (
              <p className={styles.sectionIntro}>
                Klient z reklamy potrzebuje mniej obietnic, a więcej poczucia, że proces jest prosty, konkretny i bezpieczny.
              </p>
            )}

            <div className={styles.storyActions}>
              <button type="button" className={styles.ghostButton} onClick={() => openInfoModal("kontakt")}>
                Zapytaj o dopasowanie
              </button>
              <Link href="/legal/dostawa-i-platnosc" className={styles.lookupLink}>
                Dostawa i płatność
              </Link>
            </div>
          </div>

          <div className={styles.storyMedia}>
            <div className={styles.proofGrid}>
              {journeyHighlights.map((item) => (
                <article key={item} className={styles.proofCard}>
                  <span className={styles.proofValue}>{item}</span>
                  <p>
                    Treść, zdjęcia i konfigurator są poukładane tak, żeby klient wiedział, co robić dalej bez zbędnego chaosu.
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className={`${styles.section} ${styles.storySection}`}>
          <div className={styles.storyCopy}>
            <span className={styles.sectionLabel}>
              {measurementSection?.label || "Pomiar"}
            </span>
            <h2 className={styles.sectionTitle}>
              {measurementSection?.title || "Pomiar w kilku prostych krokach"}
            </h2>
            {measurementSection?.body_html ? (
              <HtmlBlock html={measurementSection.body_html} />
            ) : (
              <p className={styles.sectionIntro}>
                Zanim klient przejdzie do konfiguratora, dostaje prostą instrukcję i jasny sygnał, jakie dane będą potrzebne.
              </p>
            )}

            <div className={styles.storyActions}>
              <Link
                href="#konfigurator"
                className={styles.ctaButton}
                onClick={() => handleConfiguratorClick("measurement")}
              >
                Zacznij konfigurację
              </Link>
              <button type="button" className={styles.ghostButton} onClick={() => openInfoModal("kontakt")}>
                Chcę pomocy z pomiarem
              </button>
            </div>
          </div>

          <div className={styles.storyMedia}>
            <div className={styles.processStack}>
              {measurementSteps.map((step) => (
                <article key={step.step} className={styles.processCard}>
                  <span className={styles.processStep}>{step.step}</span>
                  <div>
                    <h3>{step.title}</h3>
                    <p>{step.text}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        {extraSections.map((section, index) => {
          const sectionImage = gallery[(index + 1) % Math.max(gallery.length, 1)] || product.image_url;

          return (
            <section
              key={section.id}
              className={`${styles.section} ${styles.storySection} ${index % 2 === 1 ? styles.storySectionAlt : ""}`}
            >
              <div className={styles.storyCopy}>
                <span className={styles.sectionLabel}>{section.label}</span>
                <h2 className={styles.sectionTitle}>{section.title}</h2>
                <HtmlBlock html={section.body_html} />
              </div>

              <div className={styles.storyMedia}>
                <div className={styles.storyImageStage}>
                  {sectionImage ? (
                    <Image
                      src={sectionImage}
                      alt={`${product.name} ${section.title}`}
                      fill
                      sizes="(max-width: 1024px) 100vw, 40vw"
                      className={styles.storyImage}
                    />
                  ) : null}
                </div>
              </div>
            </section>
          );
        })}

        <section className={`${styles.section} ${styles.faqSection}`}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>FAQ</span>
            <h2 className={styles.sectionTitle}>Najczęstsze pytania przed zamówieniem</h2>
            <p className={styles.sectionIntro}>
              To miejsce ma redukować ostatnie obiekcje i zostawiać klienta już tylko z decyzją o wejściu do konfiguratora.
            </p>
          </div>

          <div className={styles.faqList}>
            {landing.faq.map((entry, index) => (
              <details key={entry.question} className={styles.faqItem} open={index === 0}>
                <summary className={styles.faqQuestion}>{entry.question}</summary>
                <div className={styles.faqAnswer}>
                  <p>{entry.answer}</p>
                </div>
              </details>
            ))}
          </div>
        </section>

        <section id="konfigurator" className={`${styles.section} ${styles.configSection}`}>
          <div className={styles.configWrap}>
            <div className={styles.configLead}>
              <span className={styles.sectionLabel}>
                {configuratorSection?.label || "Konfigurator"}
              </span>
              <h2 className={styles.sectionTitle}>
                {configuratorSection?.title || "Skonfiguruj własną moskitierę i zapisz wycenę"}
              </h2>
              {configuratorSection?.body_html ? (
                <HtmlBlock html={configuratorSection.body_html} />
              ) : (
                <p className={styles.sectionIntro}>
                  Tutaj klient przechodzi do konkretnych wymiarów i opcji, już po zobaczeniu produktu i zrozumieniu procesu.
                </p>
              )}

              <div className={styles.configPoints}>
                <div className={styles.noticeBox}>
                  Wycena zapisuje się do CRM i możesz wrócić do niej później po własnym kodzie.
                </div>
                <div className={styles.noticeBox}>
                  {site.contact_phone || site.contact_email ? (
                    <>
                      Pomoc przed pomiarem:
                      {" "}
                      {site.contact_phone ? <strong>{site.contact_phone}</strong> : null}
                      {site.contact_phone && site.contact_email ? " / " : null}
                      {site.contact_email ? <strong>{site.contact_email}</strong> : null}
                    </>
                  ) : (
                    <>Jeśli nie jesteś pewny pomiaru, zapisz wycenę i wróć do niej później.</>
                  )}
                </div>
              </div>
            </div>

            <div className={styles.configMount}>
              <MoskitieryFlowEntry initialProductSlug={landing.product_slug} entryPath="/moskitiery" />
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <button type="button" className={styles.footerLink} onClick={() => openInfoModal("o-nas")}>
            O nas
          </button>
          <button type="button" className={styles.footerLink} onClick={() => openInfoModal("kontakt")}>
            Kontakt
          </button>
          <button type="button" className={styles.footerLink} onClick={() => openInfoModal("regulamin")}>
            Regulamin
          </button>
          <Link href="/legal/prywatnosc" className={styles.footerLink}>
            Prywatność
          </Link>
          <Link href="/legal/cookies" className={styles.footerLink}>
            Cookies
          </Link>
        </footer>
      </div>

      <div className={styles.stickyBar}>
        <div>
          <strong>{product.name}</strong>
          <span>{product.price_from || "Skonfiguruj i sprawdź cenę"}</span>
        </div>
        <Link
          href="#konfigurator"
          className={styles.ctaButton}
          onClick={() => handleConfiguratorClick("sticky_bar")}
        >
          Konfigurator
        </Link>
      </div>

      {modalContent ? (
        <div className={styles.modalBackdrop} onClick={() => setOpenModal(null)}>
          <div className={styles.modalCard} onClick={(event) => event.stopPropagation()}>
            <div className={styles.modalHead}>
              <h2>{modalContent.title}</h2>
              <button type="button" className={styles.closeButton} onClick={() => setOpenModal(null)}>
                ×
              </button>
            </div>
            <div
              className={styles.legalHtml}
              dangerouslySetInnerHTML={{ __html: modalContent.body_html || "<p>Treść zostanie uzupełniona w CRM.</p>" }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
