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

  const heroSlides = useMemo(() => {
    const configured = Array.isArray(landing.hero.slides)
      ? landing.hero.slides.filter(
          (slide) => slide && (slide.title_html || slide.body_html || slide.media_url),
        )
      : [];

    if (configured.length) {
      return configured.map((slide, index) => ({
        ...slide,
        id: slide.id || `hero-slide-${index + 1}`,
        label: slide.label || `Slajd ${index + 1}`,
      }));
    }

    const fallbackSlides = [
      {
        id: "hero-slide-1",
        label: "Produkt",
        title_html: landing.hero.title || product.name,
        body_html:
          landing.hero.subtitle ||
          product.subtitle ||
          "Pokazujemy realny produkt i prosty proces zamówienia, zanim klient wejdzie do konfiguratora.",
        media_kind: landing.hero.media_kind || "image",
        media_url: landing.hero.media_url || gallery[0] || product.image_url || "",
        media_alt: product.name,
      },
      {
        id: "hero-slide-2",
        label: socialProofSection?.label || "Zaufanie",
        title_html:
          socialProofSection?.title_html || socialProofSection?.title || "Najpierw pewność, potem wycena",
        body_html:
          socialProofSection?.body_html ||
          "<p>Klient potrzebuje szybkiego poczucia bezpieczeństwa, jasnej ceny i prostego przejścia do zakupu.</p>",
        media_kind: "image" as const,
        media_url: gallery[1] || gallery[0] || product.image_url || "",
        media_alt: product.name,
      },
      {
        id: "hero-slide-3",
        label: measurementSection?.label || "Pomiar",
        title_html:
          measurementSection?.title_html || measurementSection?.title || "Pomiar bez technicznego chaosu",
        body_html:
          measurementSection?.body_html ||
          "<p>W kilku krokach pokazujemy, jakie wymiary są potrzebne i dopiero potem przechodzimy do konfiguratora.</p>",
        media_kind: "image" as const,
        media_url: gallery[2] || gallery[0] || product.image_url || "",
        media_alt: product.name,
      },
    ];

    return fallbackSlides.filter((slide) => slide.title_html || slide.body_html || slide.media_url);
  }, [
    gallery,
    landing.hero.media_kind,
    landing.hero.media_url,
    landing.hero.slides,
    landing.hero.subtitle,
    landing.hero.title,
    measurementSection?.body_html,
    measurementSection?.label,
    measurementSection?.title,
    measurementSection?.title_html,
    product.image_url,
    product.name,
    product.subtitle,
    socialProofSection?.body_html,
    socialProofSection?.label,
    socialProofSection?.title,
    socialProofSection?.title_html,
  ]);

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

  useEffect(() => {
    if (heroSlides.length <= 1) {
      return undefined;
    }

    const timer = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % heroSlides.length);
    }, 5600);

    return () => window.clearInterval(timer);
  }, [heroSlides.length]);

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
    if (!heroSlides.length) {
      return;
    }
    setActiveSlide((current) => (current + step + heroSlides.length) % heroSlides.length);
  }

  const safeIndex = heroSlides.length ? activeSlide % heroSlides.length : 0;
  const currentHeroSlide = heroSlides[safeIndex] || null;
  const currentImage = currentHeroSlide?.media_url || landing.hero.media_url || gallery[0] || product.image_url || "";

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

            <div className={styles.heroAccordion}>
              {heroSlides.map((slide, index) => {
                const isActive = index === safeIndex;
                return (
                  <article
                    key={slide.id || `${slide.label}-${index}`}
                    className={`${styles.heroAccordionItem} ${isActive ? styles.heroAccordionItemActive : ""}`}
                  >
                    <button
                      type="button"
                      className={styles.heroAccordionTrigger}
                      onClick={() => setActiveSlide(index)}
                      aria-expanded={isActive}
                    >
                      <span className={styles.heroAccordionIndex}>
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className={styles.heroAccordionLabel}>{slide.label || `Slajd ${index + 1}`}</span>
                    </button>

                    <div className={styles.heroAccordionPanel}>
                      <div className={styles.heroAccordionPanelInner}>
                        <div
                          className={styles.heroTitle}
                          dangerouslySetInnerHTML={{ __html: slide.title_html }}
                        />
                        <div className={styles.heroSubtitle}>
                          <HtmlBlock html={slide.body_html} />
                        </div>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>

            <div className={styles.heroDots}>
              {heroSlides.map((slide, index) => (
                <button
                  key={`${slide.id || slide.label}-${index}`}
                  type="button"
                  className={`${styles.heroDot} ${index === safeIndex ? styles.heroDotActive : ""}`}
                  onClick={() => setActiveSlide(index)}
                  aria-label={`Przejdź do slajdu ${index + 1}`}
                />
              ))}
            </div>

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
                  {currentHeroSlide?.media_kind === "video" && currentImage.endsWith(".mp4") ? (
                    <video src={currentImage} autoPlay muted loop playsInline className={styles.mainMedia} />
                  ) : currentImage ? (
                    <Image
                      src={currentImage}
                      alt={currentHeroSlide?.media_alt || product.name}
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
                {String(safeIndex + 1).padStart(2, "0")} / {String(Math.max(heroSlides.length, 1)).padStart(2, "0")}
              </div>
              <div className={styles.galleryDots}>
                {heroSlides.map((slide, index) => (
                  <button
                    key={`${slide.id || slide.label}-${index}`}
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
            <div
              className={styles.sectionTitle}
              dangerouslySetInnerHTML={{ __html: productStorySection?.title_html || productStorySection?.title || product.name }}
            />
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
            <div
              className={styles.sectionTitle}
              dangerouslySetInnerHTML={{ __html: socialProofSection?.title_html || socialProofSection?.title || "Co uspokaja klienta przed zakupem" }}
            />
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
            <div
              className={styles.sectionTitle}
              dangerouslySetInnerHTML={{ __html: measurementSection?.title_html || measurementSection?.title || "Pomiar w kilku prostych krokach" }}
            />
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
          const sectionImage = section.media_url || gallery[(index + 1) % Math.max(gallery.length, 1)] || product.image_url;

          return (
            <section
              key={section.id}
              className={`${styles.section} ${styles.storySection} ${index % 2 === 1 ? styles.storySectionAlt : ""}`}
            >
              <div className={styles.storyCopy}>
                <span className={styles.sectionLabel}>{section.label}</span>
                <div
                  className={styles.sectionTitle}
                  dangerouslySetInnerHTML={{ __html: section.title_html || section.title }}
                />
                <HtmlBlock html={section.body_html} />
              </div>

              <div className={styles.storyMedia}>
                <div className={styles.storyImageStage}>
                  {sectionImage ? (
                    <Image
                      src={sectionImage}
                      alt={section.media_alt || `${product.name} ${section.title}`}
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
                <summary
                  className={styles.faqQuestion}
                  dangerouslySetInnerHTML={{ __html: entry.question_html || entry.question }}
                />
                <div className={styles.faqAnswer}>
                  <HtmlBlock html={entry.answer_html || `<p>${entry.answer}</p>`} />
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
              <div
                className={styles.sectionTitle}
                dangerouslySetInnerHTML={{ __html: configuratorSection?.title_html || configuratorSection?.title || "Skonfiguruj własną moskitierę i zapisz wycenę" }}
              />
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
