"use client";

import { useEffect, useMemo, useRef, useState } from "react";

type Collection = {
  title: string;
  subtitle: string;
  bullets: string[];
  image: string;
};

type HeroMedia = {
  type: "image" | "video";
  url: string;
  label?: string;
};

type HomepageConfig = {
  branding?: {
    site_title?: string;
    header_cta_text?: string;
    home_title?: string;
    home_subtitle?: string;
    contact_phone?: string;
    contact_email?: string;
    logo_url?: string;
  };
  hero_media?: HeroMedia[];
  menu_groups?: Array<{
    title?: string;
    image_url?: string;
    items?: string[];
  }>;
  price_cards?: Array<{
    title?: string;
    price_from?: string;
    note?: string;
  }>;
};

const fallbackHeroSlides = [
  "https://images.unsplash.com/photo-1616047006789-b7af3f061b46?auto=format&fit=crop&w=2200&q=80",
  "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=2200&q=80",
  "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=2200&q=80",
  "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=2200&q=80",
];

const collections: Collection[] = [
  {
    title: "Osłony wewnętrzne",
    subtitle: "Komfort i estetyka w każdym pomieszczeniu",
    bullets: [
      "Rolety tradycyjne i dzień noc",
      "Plisy i żaluzje",
      "Rolety rzymskie i dachowe",
    ],
    image:
      "https://images.unsplash.com/photo-1616628182509-6f11d7f2376d?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "Osłony zewnętrzne",
    subtitle: "Prywatność i termika na poziomie premium",
    bullets: [
      "Rolety zewnętrzne",
      "Żaluzje fasadowe",
      "Screeny i systemy smart",
    ],
    image:
      "https://images.unsplash.com/photo-1613545325278-f24b0cae1224?auto=format&fit=crop&w=1600&q=80",
  },
  {
    title: "Taras",
    subtitle: "Cień i klimat wypoczynku przez cały sezon",
    bullets: ["Markizy", "Zadaszenia", "Shuttersy"],
    image:
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1600&q=80",
  },
];

const processSteps = [
  {
    title: "1. Wybór stylu",
    text: "Wybierasz typ osłony i klimat wnętrza. Od razu widzisz realne inspiracje.",
  },
  {
    title: "2. Konfiguracja",
    text: "Podajesz wymiary i dodatki. System liczy cenę w czasie rzeczywistym.",
  },
  {
    title: "3. Produkcja i montaż",
    text: "Wykonujemy osłony pod wymiar i dostarczamy gotowe rozwiązanie.",
  },
];

const trustMetrics = [
  { value: "4.9/5", label: "ocena obsługi" },
  { value: "48h", label: "na wycenę custom" },
  { value: "10 lat", label: "gwarancji" },
  { value: "100%", label: "na wymiar" },
];

function absolutizeUrl(rawUrl: string, fallbackOrigin: string): string {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    if (value.startsWith("//")) return `https:${value}`;
    if (/^https?:\/\//i.test(value)) return value;
    const base = fallbackOrigin || "https://crm-keika.groovemedia.pl";
    return new URL(value, base).toString();
  } catch {
    return value;
  }
}

export default function Home() {
  const [config, setConfig] = useState<HomepageConfig | null>(null);
  const defaultConfigEndpoint = "https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public";
  const configEndpoint = process.env.NEXT_PUBLIC_CRM_SHOP_CONFIG_URL || defaultConfigEndpoint;
  const configHashRef = useRef("");

  useEffect(() => {
    let mounted = true;
    let intervalId: number | null = null;
    const fetchConfig = (endpoint: string) =>
      fetch(`${endpoint}?_ts=${Date.now()}`, { cache: "no-store" }).then((res) => res.json());

    const applyConfig = (nextConfig: HomepageConfig) => {
      const nextHash = JSON.stringify(nextConfig);
      if (nextHash === configHashRef.current) return;
      configHashRef.current = nextHash;
      if (!mounted) return;
      setConfig(nextConfig);
    };

    const pullConfig = () =>
      fetchConfig(configEndpoint)
        .then((json) => {
          if (!json?.ok || typeof json.config !== "object") return;
          applyConfig(json.config as HomepageConfig);
        })
        .catch(() => {
          if (configEndpoint === defaultConfigEndpoint) return;
          fetchConfig(defaultConfigEndpoint)
            .then((json) => {
              if (!json?.ok || typeof json.config !== "object") return;
              applyConfig(json.config as HomepageConfig);
            })
            .catch(() => {
              // Fallback zostaje z kodu.
            });
        });

    void pullConfig();
    intervalId = window.setInterval(() => {
      void pullConfig();
    }, 10000);

    const handleFocus = () => {
      void pullConfig();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      mounted = false;
      if (intervalId !== null) window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [configEndpoint, defaultConfigEndpoint]);

  const branding = config?.branding || {};
  const endpointOrigin = useMemo(() => {
    try {
      return new URL(configEndpoint).origin;
    } catch {
      return "https://crm-keika.groovemedia.pl";
    }
  }, [configEndpoint]);

  const siteTitle = branding.site_title || "KEIKA";
  const logoUrl = absolutizeUrl(branding.logo_url || "", endpointOrigin);
  const headerCtaText = branding.header_cta_text || "Darmowa wycena";
  const homeTitle =
    branding.home_title || "Strona główna z efektem premium i mocnym nastawieniem na konwersję";
  const homeSubtitle =
    branding.home_subtitle ||
    "Pełna szerokość, dynamiczne tło i czytelna ścieżka decyzji. Najpierw wybierasz kierunek, potem przechodzisz do konfiguratora.";
  const contactPhone = branding.contact_phone || "+48 123 456 789";
  const contactEmail = branding.contact_email || "kontakt@keika.pl";

  const heroMedia = useMemo(() => {
    if (Array.isArray(config?.hero_media) && config!.hero_media!.length > 0) {
      return config!.hero_media!
        .map((item) => ({
          type: item?.type === "video" ? "video" : "image",
          url: absolutizeUrl(String(item?.url || "").trim(), endpointOrigin),
          label: String(item?.label || "").trim(),
        }))
        .filter((item) => item.url !== "");
    }
    return fallbackHeroSlides.map((url) => ({ type: "image" as const, url, label: "" }));
  }, [config, endpointOrigin]);

  const dynamicCollections = useMemo(() => {
    if (!Array.isArray(config?.menu_groups) || config.menu_groups.length === 0) {
      return collections;
    }
    return config.menu_groups.map((group, idx) => {
      const fallback = collections[idx % collections.length];
      return {
        title: group?.title || fallback.title,
        subtitle: fallback.subtitle,
        bullets:
          Array.isArray(group?.items) && group!.items!.length
            ? group!.items!.slice(0, 6)
            : fallback.bullets,
        image: absolutizeUrl(group?.image_url || "", endpointOrigin) || fallback.image,
      };
    });
  }, [config, endpointOrigin]);

  return (
    <div className="home-root">
      <header className="hero-header">
        <a className="brand" href="/" aria-label="KEIKA strona główna">
          {logoUrl ? (
            <img src={logoUrl} alt={siteTitle} className="brand-logo" />
          ) : (
            siteTitle
          )}
        </a>
        <div className="header-actions">
          <a className="phone" href={`tel:${contactPhone.replace(/\s+/g, "")}`}>
            {contactPhone}
          </a>
          <a className="header-cta" href="#wycena">
            {headerCtaText}
          </a>
        </div>
      </header>

      <main>
        <section className="hero-full" id="start">
          <div className="hero-slides" aria-hidden="true">
            {heroMedia.map((media, index) =>
              media.type === "video" ? (
                <div
                  key={`${media.url}-${index}`}
                  className="hero-slide video-slide"
                  style={{ animationDelay: `${index * 5}s` }}
                >
                  <video
                    src={media.url}
                    autoPlay
                    muted
                    loop
                    playsInline
                    preload="metadata"
                  />
                </div>
              ) : (
                <div
                  key={`${media.url}-${index}`}
                  className="hero-slide"
                  style={{
                    backgroundImage: `url(${media.url})`,
                    animationDelay: `${index * 5}s`,
                  }}
                />
              ),
            )}
          </div>

          <div className="hero-dim" aria-hidden="true" />
          <div className="hero-grain" aria-hidden="true" />

          <div className="hero-inner">
            <div className="hero-copy">
              <p className="eyebrow">Nowoczesne osłony dla nowoczesnych domów</p>
              <h1>
                {homeTitle}
              </h1>
              <p>{homeSubtitle}</p>
              <div className="hero-buttons">
                <a className="btn-primary" href="#wycena">
                  Rozpocznij konfigurację
                </a>
                <a className="btn-secondary" href="#kolekcje">
                  Zobacz kolekcje
                </a>
              </div>
            </div>

            <aside className="hero-menu-glass" id="wycena" aria-label="Główne kategorie produktów">
              {dynamicCollections.slice(0, 3).map((item) => (
                <article key={item.title} className="hero-menu-card">
                  <div
                    className="hero-menu-card-bg"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(7, 14, 26, 0.15), rgba(7, 14, 26, 0.65)), url(${item.image})`,
                    }}
                    aria-hidden="true"
                  />
                  <div className="hero-menu-card-head">
                    <h3>{item.title}</h3>
                    <span>Najedź, aby rozwinąć</span>
                  </div>
                  <ul className="hero-menu-card-list">
                    {item.bullets.map((bullet) => (
                      <li key={bullet}>
                        <a href="#kolekcje">{bullet}</a>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </aside>
          </div>
        </section>

        <section className="metrics-strip" aria-label="Najważniejsze metryki">
          {trustMetrics.map((item) => (
            <article key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
            </article>
          ))}
        </section>

        <section className="collections" id="kolekcje">
          <div className="section-head">
            <h2>Trzy główne strefy oferty</h2>
            <p>
              Bez rozpraszaczy. Jedna strona główna, jasny wybór i szybkie
              przejście do produktu.
            </p>
          </div>

          <div className="collection-grid">
            {dynamicCollections.map((item) => (
              <article key={item.title} className="collection-card">
                <div
                  className="collection-media"
                  style={{
                    backgroundImage: `linear-gradient(180deg, rgba(8, 13, 24, 0.08), rgba(8, 13, 24, 0.55)), url(${item.image})`,
                  }}
                />
                <div className="collection-body">
                  <h3>{item.title}</h3>
                  <p>{item.subtitle}</p>
                  <ul>
                    {item.bullets.map((bullet) => (
                      <li key={bullet}>{bullet}</li>
                    ))}
                  </ul>
                  <a href="#wycena">Przejdź do wyceny</a>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="process-band">
          <div className="section-head section-head-light">
            <h2>Proces zakupowy bez chaosu</h2>
          </div>
          <div className="process-grid">
            {processSteps.map((item) => (
              <article key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.text}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="final-band" id="kontakt">
          <div>
            <p>Kontakt bez formularzowego męczenia</p>
            <h2>Powiedz, co chcesz osłonić. My dobierzemy cały system.</h2>
          </div>
          <div className="final-actions">
            <a href={`tel:${contactPhone.replace(/\s+/g, "")}`}>Zadzwoń teraz</a>
            <a href={`mailto:${contactEmail}`}>Napisz do nas</a>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <p>© {new Date().getFullYear()} KEIKA. Wszystkie prawa zastrzeżone.</p>
      </footer>

      <div className="mobile-fixed-cta">
        <a href="#wycena">Skonfiguruj i wyceń</a>
      </div>
    </div>
  );
}
