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
    slug?: string;
    image_url?: string;
    icon_url?: string;
    items?: Array<
      | string
      | {
          label?: string;
          title?: string;
          icon_url?: string;
          icon?: string;
          link_url?: string;
          url?: string;
        }
    >;
  }>;
  price_cards?: Array<{
    title?: string;
    price_from?: string;
    note?: string;
  }>;
};

type HeroMenuItem = {
  label: string;
  iconUrl: string;
  linkUrl: string;
};

type HeroMenuGroup = {
  slug: string;
  title: string;
  imageUrl: string;
  iconUrl: string;
  items: HeroMenuItem[];
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
  {
    title: "Moskitiery",
    subtitle: "Skuteczna ochrona przed owadami, bez utraty światła",
    bullets: [
      "Moskitiery ramkowe",
      "Do okien dachowych",
      "Drzwiowe, przesuwne i plisowane",
    ],
    image:
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80",
  },
];

function svgIconData(iconMarkup: string): string {
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'>${iconMarkup}</svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

const iconInside = svgIconData(
  "<rect x='8' y='10' width='48' height='44' rx='10' fill='#102336'/>" +
    "<rect x='16' y='18' width='32' height='4' rx='2' fill='#7CECE7'/>" +
    "<rect x='16' y='28' width='32' height='4' rx='2' fill='#A7E7FF'/>" +
    "<rect x='16' y='38' width='32' height='4' rx='2' fill='#D5F3FF'/>"
);

const iconOutside = svgIconData(
  "<rect x='8' y='8' width='48' height='48' rx='10' fill='#0D2238'/>" +
    "<rect x='16' y='16' width='32' height='28' rx='4' fill='#88DFF0'/>" +
    "<rect x='16' y='46' width='32' height='6' rx='3' fill='#355C7A'/>"
);

const iconTerrace = svgIconData(
  "<rect x='8' y='8' width='48' height='48' rx='10' fill='#102439'/>" +
    "<path d='M14 28h36l-6-12H20z' fill='#FFD18A'/>" +
    "<rect x='18' y='28' width='4' height='20' rx='2' fill='#9CDDF0'/>" +
    "<rect x='42' y='28' width='4' height='20' rx='2' fill='#9CDDF0'/>"
);

const iconMosquito = svgIconData(
  "<rect x='8' y='8' width='48' height='48' rx='10' fill='#102236'/>" +
    "<rect x='16' y='16' width='32' height='32' rx='7' fill='#D8F4FF'/>" +
    "<path d='M22 24h20M22 32h20M22 40h20' stroke='#4E6D89' stroke-width='3' stroke-linecap='round'/>"
);

const defaultHeroMenuGroups: HeroMenuGroup[] = [
  {
    slug: "oslony-wewnetrzne",
    title: "Osłony wewnętrzne",
    imageUrl:
      "https://images.unsplash.com/photo-1616628182509-6f11d7f2376d?auto=format&fit=crop&w=1600&q=80",
    iconUrl: iconInside,
    items: [
      { label: "Rolety tradycyjne", iconUrl: iconInside, linkUrl: "#kolekcje" },
      { label: "Rolety dzień - noc", iconUrl: iconInside, linkUrl: "#kolekcje" },
      { label: "Plisy", iconUrl: iconInside, linkUrl: "#kolekcje" },
      { label: "Żaluzje", iconUrl: iconInside, linkUrl: "#kolekcje" },
      { label: "Rolety rzymskie", iconUrl: iconInside, linkUrl: "#kolekcje" },
      { label: "Verticale", iconUrl: iconInside, linkUrl: "#kolekcje" },
    ],
  },
  {
    slug: "oslony-zewnetrzne",
    title: "Osłony zewnętrzne",
    imageUrl:
      "https://images.unsplash.com/photo-1613545325278-f24b0cae1224?auto=format&fit=crop&w=1600&q=80",
    iconUrl: iconOutside,
    items: [
      { label: "Rolety zewnętrzne", iconUrl: iconOutside, linkUrl: "#kolekcje" },
      { label: "Żaluzje fasadowe", iconUrl: iconOutside, linkUrl: "#kolekcje" },
      { label: "Screen System", iconUrl: iconOutside, linkUrl: "#kolekcje" },
    ],
  },
  {
    slug: "taras",
    title: "Tarasowe",
    imageUrl:
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1600&q=80",
    iconUrl: iconTerrace,
    items: [
      { label: "Markizy", iconUrl: iconTerrace, linkUrl: "#kolekcje" },
      { label: "Zadaszenia", iconUrl: iconTerrace, linkUrl: "#kolekcje" },
      { label: "Shuttersy", iconUrl: iconTerrace, linkUrl: "#kolekcje" },
    ],
  },
  {
    slug: "moskitiery",
    title: "Moskitiery",
    imageUrl:
      "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=80",
    iconUrl: iconMosquito,
    items: [
      { label: "Moskitiery ramkowe", iconUrl: iconMosquito, linkUrl: "#kolekcje" },
      { label: "Moskitiery do okien dachowych", iconUrl: iconMosquito, linkUrl: "#kolekcje" },
      { label: "Moskitiery drzwiowe", iconUrl: iconMosquito, linkUrl: "#kolekcje" },
      { label: "Przesuwne", iconUrl: iconMosquito, linkUrl: "#kolekcje" },
      { label: "Plisowane", iconUrl: iconMosquito, linkUrl: "#kolekcje" },
    ],
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
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const defaultConfigEndpoint = "https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public";
  const configEndpoint = process.env.NEXT_PUBLIC_CRM_SHOP_CONFIG_URL || defaultConfigEndpoint;
  const configHashRef = useRef("");
  const heroMenuRef = useRef<HTMLElement | null>(null);

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

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const root = heroMenuRef.current;
      const target = event.target as Node | null;
      if (!root || !target) return;
      if (!root.contains(target)) {
        setOpenMenuIndex(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

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

  useEffect(() => {
    if (activeHeroSlide >= heroMedia.length) {
      setActiveHeroSlide(0);
    }
  }, [activeHeroSlide, heroMedia.length]);

  useEffect(() => {
    if (heroMedia.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setActiveHeroSlide((prev) => (prev + 1) % heroMedia.length);
    }, 5600);
    return () => window.clearInterval(intervalId);
  }, [heroMedia.length]);

  const dynamicCollections = useMemo(() => {
    if (!Array.isArray(config?.menu_groups) || config.menu_groups.length === 0) {
      return collections;
    }
    return config.menu_groups.map((group, idx) => {
      const fallback = collections[idx % collections.length];
      const parsedItems = Array.isArray(group?.items)
        ? group.items
            .map((entry) => {
              if (typeof entry === "string") return entry.trim();
              if (!entry || typeof entry !== "object") return "";
              return String(entry.label || entry.title || "").trim();
            })
            .filter(Boolean)
        : [];
      return {
        title: group?.title || fallback.title,
        subtitle: fallback.subtitle,
        bullets: parsedItems.length ? parsedItems.slice(0, 6) : fallback.bullets,
        image: absolutizeUrl(group?.image_url || "", endpointOrigin) || fallback.image,
      };
    });
  }, [config, endpointOrigin]);

  const heroMenuGroups = useMemo(() => {
    if (!Array.isArray(config?.menu_groups) || config.menu_groups.length === 0) {
      return defaultHeroMenuGroups;
    }

    const parsedGroups = config.menu_groups.map((group, idx) => {
      const fallback = defaultHeroMenuGroups[idx] || defaultHeroMenuGroups[0];
      const iconUrl = absolutizeUrl(group?.icon_url || "", endpointOrigin) || fallback.iconUrl;
      const imageUrl = absolutizeUrl(group?.image_url || "", endpointOrigin) || fallback.imageUrl;
      const rawItems = Array.isArray(group?.items) ? group.items : [];
      const hasObjectItems = rawItems.some((entry) => entry && typeof entry === "object");

      const items: HeroMenuItem[] = hasObjectItems
        ? rawItems
            .map((entry, itemIdx) => {
              const fallbackItem = fallback.items[itemIdx] || fallback.items[0];
              if (!entry || typeof entry !== "object") return null;
              const label = String(entry.label || entry.title || "").trim();
              if (!label) return null;
              return {
                label,
                iconUrl: absolutizeUrl(String(entry.icon_url || entry.icon || "").trim(), endpointOrigin) || fallbackItem.iconUrl || iconUrl,
                linkUrl: String(entry.link_url || entry.url || "#kolekcje").trim() || "#kolekcje",
              };
            })
            .filter((item): item is HeroMenuItem => Boolean(item))
        : [];

      return {
        slug: String(group?.slug || fallback.slug || `sekcja-${idx + 1}`),
        title: String(group?.title || fallback.title),
        imageUrl,
        iconUrl,
        items: items.length ? items : fallback.items,
      };
    });

    const withRequiredSections = [...parsedGroups];
    defaultHeroMenuGroups.forEach((required) => {
      const exists = withRequiredSections.some((entry) => {
        const slug = String(entry.slug || "").toLowerCase();
        const title = String(entry.title || "").toLowerCase();
        return slug === required.slug || title === required.title.toLowerCase();
      });
      if (!exists) withRequiredSections.push(required);
    });

    return withRequiredSections;
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
                  className={`hero-slide video-slide ${index === activeHeroSlide ? "is-active" : ""}`}
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
                  className={`hero-slide ${index === activeHeroSlide ? "is-active" : ""}`}
                  style={{
                    backgroundImage: `url(${media.url})`,
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

            <aside
              className="hero-menu-glass"
              id="wycena"
              aria-label="Główne kategorie produktów"
              ref={heroMenuRef}
            >
              {heroMenuGroups.map((item, index) => (
                <article
                  key={item.title}
                  className={`hero-menu-card ${openMenuIndex === index ? "is-open" : ""}`}
                >
                  <div
                    className="hero-menu-card-bg"
                    style={{
                      backgroundImage: `linear-gradient(180deg, rgba(7, 14, 26, 0.16), rgba(7, 14, 26, 0.68)), url(${item.imageUrl})`,
                    }}
                    aria-hidden="true"
                  />
                  <button
                    type="button"
                    className="hero-menu-card-head"
                    aria-expanded={openMenuIndex === index ? "true" : "false"}
                    onClick={() => setOpenMenuIndex((prev) => (prev === index ? null : index))}
                  >
                    <span className="hero-menu-card-head-main">
                      <img
                        src={item.iconUrl}
                        alt=""
                        className="hero-menu-category-icon"
                        loading="lazy"
                      />
                      <h3>{item.title}</h3>
                    </span>
                    <span className="hero-menu-chevron" aria-hidden="true">▾</span>
                  </button>
                  <ul className={`hero-menu-card-list ${openMenuIndex === index ? "is-open" : ""}`}>
                    {item.items.map((subItem) => (
                      <li key={`${item.title}-${subItem.label}`}>
                        <a href={subItem.linkUrl}>
                          <img
                            src={subItem.iconUrl}
                            alt=""
                            className="hero-menu-subitem-icon"
                            loading="lazy"
                          />
                          <span>{subItem.label}</span>
                        </a>
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
            <h2>Główne strefy oferty</h2>
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
