"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type ProductItem = {
  name?: string;
  slug?: string;
  subtitle?: string;
  price_from?: string;
  image_url?: string;
};

type ProductGroup = {
  title?: string;
  slug?: string;
  background_url?: string;
  description?: string;
  products?: ProductItem[];
};

type PublicConfig = {
  branding?: {
    site_title?: string;
    contact_phone?: string;
    logo_url?: string;
  };
  top_links?: Array<{ label?: string; url?: string }>;
  product_groups?: ProductGroup[];
};

function absolutizeUrl(rawUrl: string, fallbackOrigin: string): string {
  const value = String(rawUrl || "").trim();
  if (!value) return "";
  try {
    if (value.startsWith("//")) return `https:${value}`;
    if (/^https?:\/\//i.test(value)) return value;
    return new URL(value, fallbackOrigin).toString();
  } catch {
    return value;
  }
}

export default function ProductPage({ params }: { params: { slug: string } }) {
  const slug = String(params.slug || "").trim();
  const [config, setConfig] = useState<PublicConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const configEndpoint = process.env.NEXT_PUBLIC_CRM_SHOP_CONFIG_URL || "https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public";
  const endpointOrigin = useMemo(() => {
    try {
      return new URL(configEndpoint).origin;
    } catch {
      return "https://crm-keika.groovemedia.pl";
    }
  }, [configEndpoint]);

  useEffect(() => {
    let mounted = true;
    fetch(`${configEndpoint}?_ts=${Date.now()}`, { cache: "no-store" })
      .then((res) => res.json())
      .then((json) => {
        if (!mounted) return;
        if (json?.ok && typeof json.config === "object") {
          setConfig(json.config as PublicConfig);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [configEndpoint]);

  const branding = config?.branding || {};
  const logoUrl = absolutizeUrl(branding.logo_url || "", endpointOrigin);
  const topLinks = Array.isArray(config?.top_links) ? config.top_links : [];
  const contactPhone = branding.contact_phone || "+48 123 456 789";
  const groups = Array.isArray(config?.product_groups) ? config.product_groups : [];

  let foundGroup: ProductGroup | null = null;
  let foundProduct: ProductItem | null = null;
  for (const group of groups) {
    const products = Array.isArray(group.products) ? group.products : [];
    const match = products.find((entry) => String(entry.slug || "").trim() === slug);
    if (match) {
      foundGroup = group;
      foundProduct = match;
      break;
    }
  }

  const bg = absolutizeUrl((foundGroup?.background_url || foundProduct?.image_url || ""), endpointOrigin);
  const productImage = absolutizeUrl(foundProduct?.image_url || "", endpointOrigin);

  return (
    <div className="catalog-root" style={{ backgroundImage: bg ? `linear-gradient(120deg, rgba(4,12,22,.9), rgba(7,16,30,.74)), url(${bg})` : undefined }}>
      <header className="hero-header">
        <div className="header-left">
          <Link className="brand" href="/" aria-label="KEIKA strona główna">
            {logoUrl ? <img src={logoUrl} alt={branding.site_title || "KEIKA"} className="brand-logo" /> : (branding.site_title || "KEIKA")}
          </Link>
          <div className="top-links-wrap">
            <button type="button" className="top-links-toggle" aria-expanded="false">
              <span className="top-links-toggle-label">Menu</span>
              <span className="top-links-toggle-icon" aria-hidden="true"><span /><span /><span /></span>
            </button>
            <nav className="top-links-dropdown" aria-label="Menu dodatkowe">
              {topLinks.map((entry) => (
                <a key={`${entry.label}-${entry.url}`} href={entry.url || "#"}>{entry.label || "Link"}</a>
              ))}
            </nav>
          </div>
        </div>
        <div className="header-actions">
          <a className="phone" href={`tel:${contactPhone.replace(/\s+/g, "")}`}>{contactPhone}</a>
          <a className="header-cart has-items" href="#koszyk">
            <span className="header-cart-title">Koszyk</span>
            <small>Przejdź do koszyka</small>
          </a>
        </div>
      </header>

      <main className="catalog-main">
        {loading ? (
          <section className="catalog-card">Wczytywanie produktu…</section>
        ) : !foundGroup || !foundProduct ? (
          <section className="catalog-card">
            <h1>Nie znaleziono produktu</h1>
            <p>Produkt nie jest jeszcze skonfigurowany w panelu administracyjnym.</p>
            <Link href="/">Wróć na stronę główną</Link>
          </section>
        ) : (
          <section className="product-layout">
            <div className="product-hero-image" style={productImage ? { backgroundImage: `url(${productImage})` } : undefined} />
            <article className="product-info-card">
              <p>{foundGroup.title || "Kategoria"}</p>
              <h1>{foundProduct.name || "Produkt"}</h1>
              <h2>{foundProduct.price_from || "Cena po konfiguracji"}</h2>
              <p>{foundProduct.subtitle || "Nowoczesny produkt na wymiar. Dobierz parametry, tkaninę i opcje montażu."}</p>
              <ul>
                <li>Konfiguracja dokładnych wymiarów</li>
                <li>Dobór systemu i sterowania</li>
                <li>Wycena online i realizacja od producenta</li>
              </ul>
              <div className="product-info-actions">
                <a href="#konfigurator">Skonfiguruj produkt</a>
                <Link href={`/kategoria/${foundGroup.slug || ""}`}>Wróć do kategorii</Link>
              </div>
            </article>
          </section>
        )}
      </main>
    </div>
  );
}

