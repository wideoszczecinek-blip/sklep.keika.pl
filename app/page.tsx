"use client";

import { useEffect, useMemo, useRef, useState } from "react";

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
  hero_carousel?: Array<{
    eyebrow?: string;
    title?: string;
    subtitle?: string;
  }>;
  hero_titles?: string[];
  hero_media?: HeroMedia[];
  top_links?: Array<{
    label?: string;
    url?: string;
  }>;
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

type CartSummary = {
  items: number;
  total: number;
};

type HeroCarouselSlide = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

type TopLink = {
  label: string;
  url: string;
};

const fallbackHeroSlides = [
  "https://images.unsplash.com/photo-1616047006789-b7af3f061b46?auto=format&fit=crop&w=2200&q=80",
  "https://images.unsplash.com/photo-1600210492493-0946911123ea?auto=format&fit=crop&w=2200&q=80",
  "https://images.unsplash.com/photo-1600047509807-ba8f99d2cdde?auto=format&fit=crop&w=2200&q=80",
  "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=2200&q=80",
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

function readCartSummary(): CartSummary {
  if (typeof window === "undefined") return { items: 0, total: 0 };

  const keys = ["keika_cart", "shop_cart", "cart"];
  let parsed: unknown = null;
  for (const key of keys) {
    const raw = window.localStorage.getItem(key);
    if (!raw) continue;
    try {
      parsed = JSON.parse(raw);
      break;
    } catch {
      // ignore invalid json
    }
  }

  if (!parsed) return { items: 0, total: 0 };

  const rows = Array.isArray(parsed)
    ? parsed
    : Array.isArray((parsed as { items?: unknown }).items)
      ? (parsed as { items: unknown[] }).items
      : [];

  let items = 0;
  let total = 0;
  for (const row of rows) {
    if (!row || typeof row !== "object") continue;
    const item = row as Record<string, unknown>;
    const qtyRaw = Number(item.qty ?? item.quantity ?? item.count ?? 1);
    const qty = Number.isFinite(qtyRaw) && qtyRaw > 0 ? qtyRaw : 1;

    const explicitTotal = Number(item.total ?? item.line_total ?? item.price_total ?? NaN);
    const unitPrice = Number(item.price ?? item.unit_price ?? item.unitPrice ?? 0);
    const rowTotal = Number.isFinite(explicitTotal) ? explicitTotal : unitPrice * qty;

    items += qty;
    total += Number.isFinite(rowTotal) ? rowTotal : 0;
  }

  return { items: Math.max(0, Math.round(items)), total: Math.max(0, total) };
}

function formatPln(value: number): string {
  return new Intl.NumberFormat("pl-PL", {
    style: "currency",
    currency: "PLN",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function Home() {
  const [config, setConfig] = useState<HomepageConfig | null>(null);
  const [configReady, setConfigReady] = useState(false);
  const [bootPhase, setBootPhase] = useState<"loading" | "reveal" | "ready">("loading");
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [heroSlidesReady, setHeroSlidesReady] = useState(false);
  const [cartSummary, setCartSummary] = useState<CartSummary>({ items: 0, total: 0 });
  const [activeHeadline, setActiveHeadline] = useState(0);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  const defaultConfigEndpoint = "https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public";
  const configEndpoint = process.env.NEXT_PUBLIC_CRM_SHOP_CONFIG_URL || defaultConfigEndpoint;
  const configHashRef = useRef("");
  const heroMenuRef = useRef<HTMLElement | null>(null);
  const topMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let mounted = true;
    let intervalId: number | null = null;
    const readyFallbackTimer = window.setTimeout(() => {
      if (mounted) setConfigReady(true);
    }, 2200);
    const fetchConfig = (endpoint: string) =>
      fetch(`${endpoint}?_ts=${Date.now()}`, { cache: "no-store" }).then((res) => res.json());

    const applyConfig = (nextConfig: HomepageConfig) => {
      const nextHash = JSON.stringify(nextConfig);
      if (nextHash === configHashRef.current) return;
      configHashRef.current = nextHash;
      if (!mounted) return;
      setConfig(nextConfig);
      setConfigReady(true);
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
              if (mounted) setConfigReady(true);
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
      window.clearTimeout(readyFallbackTimer);
      if (intervalId !== null) window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [configEndpoint, defaultConfigEndpoint]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null;
      if (!target) return;

      const heroRoot = heroMenuRef.current;
      if (heroRoot && !heroRoot.contains(target)) {
        setOpenMenuIndex(null);
      }

      const topRoot = topMenuRef.current;
      if (topRoot && !topRoot.contains(target)) {
        setTopMenuOpen(false);
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
  const heroCarousel = useMemo<HeroCarouselSlide[]>(() => {
    const rawSlides = Array.isArray(config?.hero_carousel) ? config.hero_carousel : [];
    const parsedSlides = rawSlides
      .map((slide) => ({
        eyebrow: String(slide?.eyebrow || "").trim(),
        title: String(slide?.title || "").trim(),
        subtitle: String(slide?.subtitle || "").trim(),
      }))
      .filter((slide) => slide.eyebrow || slide.title || slide.subtitle);

    if (parsedSlides.length) return parsedSlides;

    const legacyTitles = Array.isArray(config?.hero_titles)
      ? config.hero_titles.map((entry) => String(entry || "").trim()).filter(Boolean)
      : [];
    if (legacyTitles.length) {
      return legacyTitles.map((title) => ({
        eyebrow: "NOWOCZESNE OSŁONY DLA NOWOCZESNYCH DOMÓW",
        title,
        subtitle: String(branding.home_subtitle || "").trim(),
      }));
    }

    const legacyTitle = String(branding.home_title || "").trim() || "Strona główna z efektem premium i mocnym nastawieniem na konwersję";
    const legacySubtitle =
      String(branding.home_subtitle || "").trim() ||
      "Pełna szerokość, dynamiczne tło i czytelna ścieżka decyzji. Najpierw wybierasz kierunek, potem przechodzisz do konfiguratora.";

    return [
      {
        eyebrow: "NOWOCZESNE OSŁONY DLA NOWOCZESNYCH DOMÓW",
        title: legacyTitle,
        subtitle: legacySubtitle,
      },
    ];
  }, [config?.hero_carousel, config?.hero_titles, branding.home_title, branding.home_subtitle]);

  const fallbackEyebrow = "NOWOCZESNE OSŁONY DLA NOWOCZESNYCH DOMÓW";
  const fallbackTitle = "Strona główna z efektem premium i mocnym nastawieniem na konwersję";
  const fallbackSubtitle =
    "Pełna szerokość, dynamiczne tło i czytelna ścieżka decyzji. Najpierw wybierasz kierunek, potem przechodzisz do konfiguratora.";
  const contactPhone = branding.contact_phone || "+48 123 456 789";
  const topLinks = useMemo<TopLink[]>(() => {
    const source = Array.isArray(config?.top_links) ? config.top_links : [];
    const normalized = source
      .map((entry) => ({
        label: String(entry?.label || "").trim(),
        url: String(entry?.url || "").trim() || "#",
      }))
      .filter((entry) => entry.label !== "");
    if (normalized.length) return normalized;
    return [
      { label: "O nas", url: "/o-nas" },
      { label: "Kontakt", url: "/kontakt" },
      { label: "Bezpieczeństwo", url: "/bezpieczenstwo" },
      { label: "Regulamin", url: "/regulamin" },
    ];
  }, [config?.top_links]);
  const hasCartItems = cartSummary.items > 0;
  const cartQtyLabel = cartSummary.items === 1 ? "1 produkt" : `${cartSummary.items} produktów`;

  useEffect(() => {
    if (activeHeadline >= heroCarousel.length) {
      setActiveHeadline(0);
    }
  }, [activeHeadline, heroCarousel.length]);

  useEffect(() => {
    if (heroCarousel.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setActiveHeadline((prev) => (prev + 1) % heroCarousel.length);
    }, 4200);
    return () => window.clearInterval(intervalId);
  }, [heroCarousel.length]);

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
    let cancelled = false;
    setHeroSlidesReady(false);

    const firstMedia = heroMedia[0];
    if (!firstMedia) {
      setHeroSlidesReady(true);
      return () => {
        cancelled = true;
      };
    }

    const reveal = () => {
      if (cancelled) return;
      window.requestAnimationFrame(() => {
        if (!cancelled) setHeroSlidesReady(true);
      });
    };

    if (firstMedia.type === "video") {
      const fallbackTimer = window.setTimeout(reveal, 900);
      return () => {
        cancelled = true;
        window.clearTimeout(fallbackTimer);
      };
    }

    const probe = new Image();
    probe.decoding = "async";
    probe.onload = reveal;
    probe.onerror = reveal;
    probe.src = firstMedia.url;

    return () => {
      cancelled = true;
      probe.onload = null;
      probe.onerror = null;
    };
  }, [heroMedia]);

  useEffect(() => {
    if (heroMedia.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setActiveHeroSlide((prev) => (prev + 1) % heroMedia.length);
    }, 5600);
    return () => window.clearInterval(intervalId);
  }, [heroMedia.length]);

  useEffect(() => {
    const syncCart = () => setCartSummary(readCartSummary());
    syncCart();
    window.addEventListener("storage", syncCart);
    window.addEventListener("focus", syncCart);
    return () => {
      window.removeEventListener("storage", syncCart);
      window.removeEventListener("focus", syncCart);
    };
  }, []);

  useEffect(() => {
    if (bootPhase !== "loading") return;
    if (!configReady || !heroSlidesReady) return;
    setBootPhase("reveal");
    const timerId = window.setTimeout(() => {
      setBootPhase("ready");
    }, 1280);
    return () => {
      window.clearTimeout(timerId);
    };
  }, [bootPhase, configReady, heroSlidesReady]);

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
    <div className={`home-root ${mobileMenuOpen ? "mobile-menu-open" : ""} boot-${bootPhase}`}>
      <div className={`boot-overlay ${bootPhase === "ready" ? "is-hidden" : ""}`} aria-hidden={bootPhase === "ready" ? "true" : "false"}>
        <div className="boot-overlay-core">
          <span className="boot-spinner" aria-hidden="true" />
          <p>Wczytujemy najlepsze rozwiązania</p>
        </div>
      </div>
      <header className="hero-header">
        <div className="header-left">
          <a className="brand" href="/" aria-label="KEIKA strona główna">
            {logoUrl ? (
              <img src={logoUrl} alt={siteTitle} className="brand-logo" />
            ) : (
              siteTitle
            )}
          </a>
          <div className={`top-links-wrap ${topMenuOpen ? "is-open" : ""}`} ref={topMenuRef}>
            <button
              type="button"
              className="top-links-toggle"
              aria-expanded={topMenuOpen ? "true" : "false"}
              aria-controls="top-links-dropdown"
              onClick={() => setTopMenuOpen((prev) => !prev)}
            >
              <span className="top-links-toggle-label">Menu</span>
              <span className="top-links-toggle-icon" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
            </button>
            <nav id="top-links-dropdown" className="top-links-dropdown" aria-label="Menu dodatkowe">
              {topLinks.map((entry) => (
                <a
                  key={`${entry.label}-${entry.url}`}
                  href={entry.url}
                  onClick={() => setTopMenuOpen(false)}
                >
                  {entry.label}
                </a>
              ))}
            </nav>
          </div>
        </div>
        <div className="header-actions">
          <a className="phone" href={`tel:${contactPhone.replace(/\s+/g, "")}`}>
            {contactPhone}
          </a>
          <a className={`header-cart ${hasCartItems ? "has-items" : "is-empty"}`} href="#koszyk">
            <span className="header-cart-title">Koszyk</span>
            {hasCartItems ? (
              <>
                <strong>{formatPln(cartSummary.total)}</strong>
                <small>{cartQtyLabel}</small>
              </>
            ) : (
              <small>Koszyk pusty</small>
            )}
          </a>
        </div>
      </header>

      <main>
        <section className="hero-full" id="start">
          <div className={`hero-slides ${heroSlidesReady ? "is-ready" : ""}`} aria-hidden="true">
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
              <div className="hero-copy-content">
                <div className="hero-eyebrow-carousel" aria-live="polite">
                  {heroCarousel.map((slide, index) => (
                    <p
                      key={`${slide.eyebrow}-${index}`}
                      className={`eyebrow eyebrow-slide ${index === activeHeadline ? "is-active" : ""}`}
                    >
                      {slide.eyebrow || fallbackEyebrow}
                    </p>
                  ))}
                </div>
                <div className="hero-title-carousel" aria-live="polite">
                  {heroCarousel.map((slide, index) => (
                    <h1
                      key={`${slide.title}-${slide.eyebrow}-${index}`}
                      className={`hero-title-slide ${index === activeHeadline ? "is-active" : ""}`}
                    >
                      {slide.title || fallbackTitle}
                    </h1>
                  ))}
                </div>
                <div className="hero-subtitle-carousel" aria-live="polite">
                  {heroCarousel.map((slide, index) => (
                    <p
                      key={`${slide.subtitle}-${index}`}
                      className={`hero-subtitle-slide ${index === activeHeadline ? "is-active" : ""}`}
                    >
                      {slide.subtitle || fallbackSubtitle}
                    </p>
                  ))}
                </div>
                <div className="hero-title-dots" aria-label="Paginacja tytułów">
                  {heroCarousel.map((_, index) => (
                    <button
                      key={`headline-dot-${index}`}
                      type="button"
                      className={`hero-title-dot ${index === activeHeadline ? "is-active" : ""}`}
                      aria-label={`Pokaż tytuł ${index + 1}`}
                      aria-pressed={index === activeHeadline ? "true" : "false"}
                      onClick={() => setActiveHeadline(index)}
                    />
                  ))}
                </div>
              </div>
              <button
                type="button"
                className="hero-mobile-offer-btn"
                aria-expanded={mobileMenuOpen ? "true" : "false"}
                onClick={() => {
                  setMobileMenuOpen((prev) => {
                    const next = !prev;
                    if (!next) setOpenMenuIndex(null);
                    return next;
                  });
                }}
              >
                {mobileMenuOpen ? "Ukryj ofertę" : "Zobacz ofertę"}
              </button>
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
                        <a
                          href={subItem.linkUrl}
                          onClick={() => {
                            if (window.matchMedia("(max-width: 760px)").matches) {
                              setMobileMenuOpen(false);
                              setOpenMenuIndex(null);
                            }
                          }}
                        >
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
      </main>
    </div>
  );
}
