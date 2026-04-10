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

export default function MoskitieryLandingClient({
  site,
  landing,
  product,
  legalPages,
}: LandingClientProps) {
  const gallery = useMemo(() => {
    const media = [];
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

  const currentImage = gallery[activeSlide] || product.image_url || "";

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
      <div className={styles.shell}>
        <header className={styles.topbar}>
          <div className={styles.brand}>
            {site.logo_url ? (
              <Image
                src={site.logo_url}
                alt={site.site_title}
                width={36}
                height={36}
              />
            ) : null}
            <span>{site.site_title}</span>
          </div>
          <div className={styles.topActions}>
            <button
              type="button"
              className={styles.topButton}
              onClick={() => {
                setOpenModal("o-nas");
                void trackStorefrontEvent({
                  event_name: "open_modal",
                  event_label: "o_nas",
                  page_slug: landing.slug,
                }).catch(() => null);
              }}
            >
              O nas
            </button>
            <button
              type="button"
              className={styles.topButton}
              onClick={() => {
                setOpenModal("kontakt");
                void trackStorefrontEvent({
                  event_name: "open_modal",
                  event_label: "kontakt",
                  page_slug: landing.slug,
                }).catch(() => null);
              }}
            >
              Kontakt
            </button>
            <button
              type="button"
              className={styles.topButton}
              onClick={() => setOpenModal("regulamin")}
            >
              Regulamin
            </button>
            <Link href="#konfigurator" className={styles.ctaButton}>
              {landing.hero.cta_label || "Przejdź do konfiguratora"}
            </Link>
          </div>
        </header>

        <section className={styles.hero}>
          <div className={styles.heroCopy}>
            <div className={styles.eyebrow}>{landing.hero.eyebrow}</div>
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
              <Link href="#konfigurator" className={styles.ctaButton}>
                {landing.hero.cta_label || "Przejdź do konfiguratora"}
              </Link>
              <Link href={`/konfigurator/${encodeURIComponent(landing.product_slug)}`} className={styles.ghostButton}>
                Otwórz sam konfigurator
              </Link>
            </div>
          </div>
          <div className={styles.heroMedia}>
            <div className={styles.galleryStage}>
              {landing.hero.media_kind === "video" && currentImage.endsWith(".mp4") ? (
                <video src={currentImage} autoPlay muted loop playsInline />
              ) : currentImage ? (
                <Image
                  src={currentImage}
                  alt={product.name}
                  fill
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  priority
                />
              ) : null}
            </div>
            <div className={styles.galleryThumbs}>
              {gallery.map((image, index) => (
                <button
                  key={`${image}-${index}`}
                  type="button"
                  className={`${styles.galleryThumb} ${index === activeSlide ? styles.galleryThumbActive : ""}`}
                  onClick={() => setActiveSlide(index)}
                >
                  <Image
                    src={image}
                    alt={`${product.name} ${index + 1}`}
                    width={92}
                    height={84}
                  />
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>Realny produkt</span>
            <h2 className={styles.sectionTitle}>{product.name}</h2>
            <p className={styles.sectionIntro}>
              {product.subtitle || product.description}
            </p>
          </div>
          <div className={styles.productGrid}>
            <div className={styles.productCard}>
              <div className={styles.galleryStage}>
                {product.image_url ? (
                  <Image
                    src={product.image_url}
                    alt={product.name}
                    fill
                    sizes="(max-width: 1024px) 100vw, 60vw"
                  />
                ) : null}
              </div>
            </div>
            <div className={styles.copyCard}>
              <h3>Dlaczego ten wariant jest najczęściej wybierany</h3>
              <HtmlBlock html={product.description || "<p>Opis produktu wkrótce pojawi się tutaj.</p>"} />
              {product.price_from ? (
                <div className={styles.noticeBox}>
                  Cena startowa: <strong>{product.price_from}</strong>
                </div>
              ) : null}
              <Link href="#konfigurator" className={styles.ctaButton}>
                Przejdź do pomiaru i konfiguracji
              </Link>
            </div>
          </div>
        </section>

        {landing.sections.map((section) => (
          <section key={section.id} className={styles.section}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>{section.label}</span>
              <h2 className={styles.sectionTitle}>{section.title}</h2>
            </div>
            <div className={styles.copyGrid}>
              <div className={styles.copyCard}>
                <HtmlBlock html={section.body_html} />
              </div>
              <div className={styles.copyCard}>
                <h3>Pomocne linki</h3>
                <Link href={`/legal/regulamin`} className={styles.lookupLink}>
                  Regulamin sklepu
                </Link>
                <Link href={`/legal/dostawa-i-platnosc`} className={styles.lookupLink}>
                  Dostawa i płatność
                </Link>
                <Link href={`/kontakt`} className={styles.lookupLink}>
                  Kontakt
                </Link>
                <Link href={`/o-nas`} className={styles.lookupLink}>
                  O nas
                </Link>
              </div>
            </div>
          </section>
        ))}

        <section className={styles.section}>
          <div className={styles.sectionHeader}>
            <span className={styles.sectionLabel}>FAQ</span>
            <h2 className={styles.sectionTitle}>Najczęstsze pytania przed zamówieniem</h2>
          </div>
          <div className={styles.faqList}>
            {landing.faq.map((entry) => (
              <article key={entry.question} className={styles.faqItem}>
                <h3 className={styles.faqQuestion}>{entry.question}</h3>
                <div className={styles.faqAnswer}>
                  <p>{entry.answer}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="konfigurator" className={styles.section}>
          <div className={styles.configWrap}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>Konfigurator</span>
              <h2 className={styles.sectionTitle}>Teraz wpisz pomiar i zapisz wycenę</h2>
              <p className={styles.sectionIntro}>
                Najpierw klient widzi produkt i sposób zamówienia, a dopiero tutaj przechodzi do pomiaru, konfiguracji i wyceny.
              </p>
            </div>
            <div className={styles.configIntro}>
              <div className={styles.noticeBox}>
                {site.contact_phone || site.contact_email ? (
                  <>
                    Jeśli potrzebujesz pomocy przed pomiarem, skontaktuj się z nami:
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
            <div className={styles.configMount}>
              <MoskitieryFlowEntry initialProductSlug={landing.product_slug} entryPath="/moskitiery" />
            </div>
          </div>
        </section>

        <footer className={styles.footer}>
          <button type="button" className={styles.footerLink} onClick={() => setOpenModal("o-nas")}>
            O nas
          </button>
          <button type="button" className={styles.footerLink} onClick={() => setOpenModal("kontakt")}>
            Kontakt
          </button>
          <button type="button" className={styles.footerLink} onClick={() => setOpenModal("regulamin")}>
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
        <Link href="#konfigurator" className={styles.ctaButton}>
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
            <div className={styles.legalHtml} dangerouslySetInnerHTML={{ __html: modalContent.body_html || "<p>Treść zostanie uzupełniona w CRM.</p>" }} />
          </div>
        </div>
      ) : null}
    </div>
  );
}
