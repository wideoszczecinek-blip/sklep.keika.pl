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

function formatPrice(value: string): string {
  const clean = String(value || "").trim();
  return clean || "Cena po konfiguracji";
}

export default function CategoryPage({ params }: { params: { slug: string } }) {
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
  const group = groups.find((entry) => String(entry.slug || "").trim() === slug);
  const bg = absolutizeUrl(group?.background_url || "", endpointOrigin);
  const products = Array.isArray(group?.products) ? group.products : [];

  return (
    <div className="catalog-root" style={{ backgroundImage: bg ? `linear-gradient(120deg, rgba(4,12,22,.88), rgba(7,16,30,.72)), url(${bg})` : undefined }}>
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
          <section className="catalog-card">Wczytywanie kategorii…</section>
        ) : !group ? (
          <section className="catalog-card">
            <h1>Nie znaleziono kategorii</h1>
            <p>Ta kategoria nie jest jeszcze skonfigurowana w panelu administracyjnym.</p>
            <Link href="/">Wróć na stronę główną</Link>
          </section>
        ) : (
          <>
            <section className="catalog-head">
              <p>Kategoria</p>
              <h1>{group.title || "Produkty"}</h1>
              <p>{group.description || "Wybierz produkt i przejdź do szczegółów."}</p>
            </section>
            <section className="catalog-grid">
              {products.map((product) => {
                const productSlug = String(product.slug || "").trim();
                const image = absolutizeUrl(product.image_url || "", endpointOrigin);
                return (
                  <article key={`${group.slug}-${productSlug || product.name}`} className="catalog-product-card">
                    <div className="catalog-product-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
                    <div className="catalog-product-body">
                      <h2>{product.name || "Produkt"}</h2>
                      <p>{product.subtitle || "Konfiguracja i szybka wycena."}</p>
                      <div className="catalog-product-row">
                        <strong>{formatPrice(product.price_from || "")}</strong>
                        <Link href={productSlug ? `/produkt/${productSlug}` : "#"}>Szczegóły</Link>
                      </div>
                    </div>
                  </article>
                );
              })}
            </section>
          </>
        )}
      </main>
    </div>
  );
}

