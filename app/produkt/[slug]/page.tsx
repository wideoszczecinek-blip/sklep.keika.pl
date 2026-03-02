"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type ProductItem = {
  name?: string;
  slug?: string;
  subtitle?: string;
  description?: string;
  price_from?: string;
  image_url?: string;
  gallery_urls?: string[];
  title?: string;
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

const fixedInteriorProducts: ProductItem[] = [
  {
    name: "Rolety wolnowiszące mini",
    slug: "rolety-wolnowiszace-mini",
    subtitle: "Rolety naokienne z prowadzeniem żyłkowym.",
    price_from: "od 249 zł",
    image_url:
      "https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Rolety wolnowiszące standard",
    slug: "rolety-wolnowiszace-standard",
    subtitle: "Rolety montowane na ścianie lub do sufitu. Przeznaczone do większych gabarytów.",
    price_from: "od 289 zł",
    image_url:
      "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Rolety w kasecie Best 1",
    slug: "rolety-best-1",
    subtitle: "Rolety w aluminiowej kasecie, z prowadnicami przyszybowymi.",
    price_from: "od 329 zł",
    image_url:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Rolety w kasecie przestrzennej Best 2",
    slug: "rolety-best-2",
    subtitle: "Rolety w aluminiowej kasecie z prowadnicami przestrzennymi.",
    price_from: "od 369 zł",
    image_url:
      "https://images.unsplash.com/photo-1617098474202-0d0d7f60d4f0?auto=format&fit=crop&w=1400&q=80",
  },
];

const fixedDayNightProducts: ProductItem[] = [
  {
    name: "Rolety wolnowiszące mini Dzień-Noc",
    slug: "rolety-mini-dzien-noc",
    subtitle: "Rolety naokienne z prowadzeniem żyłkowym.",
    price_from: "od 269 zł",
    image_url:
      "https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Rolety wolnowiszące standard Dzień - Noc",
    slug: "rolety-standard-dzien-noc",
    subtitle: "Rolety wolnowiszące montowane na ścianie lub do sufitu. Przeznaczone do większych gabarytów.",
    price_from: "od 299 zł",
    image_url:
      "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Rolety w kasecie Best 1 Dzień-Noc",
    slug: "rolety-best-1-dzien-noc",
    subtitle: "Rolety w aluminiowej kasecie, z prowadnicami przyszybowymi.",
    price_from: "od 349 zł",
    image_url:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Rolety w kasecie przestrzennej Best 2 Dzień - Noc",
    slug: "rolety-best-2-dzien-noc",
    subtitle: "Rolety w aluminiowej kasecie z prowadnicami przestrzennymi.",
    price_from: "od 389 zł",
    image_url:
      "https://images.unsplash.com/photo-1617098474202-0d0d7f60d4f0?auto=format&fit=crop&w=1400&q=80",
  },
];

const fixedPlisyProducts: ProductItem[] = [
  {
    name: "Plisy do okien pionowych",
    slug: "plisy-do-okien-pionowych",
    subtitle: "Uniwersalne plisy do standardowych okien pionowych.",
    price_from: "od 299 zł",
    image_url:
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Plisy SLIM do okien typu HS, HST",
    slug: "plisy-slim-hs-hst",
    subtitle: "Dedykowany profil 16 mm do dużych przeszkleń przesuwnych.",
    price_from: "od 369 zł",
    image_url:
      "https://images.unsplash.com/photo-1600566753376-12c8ab7fb75b?auto=format&fit=crop&w=1400&q=80",
  },
];

const fixedZaluzjeProducts: ProductItem[] = [
  {
    name: "Żaluzje Aluminiowe 25mm",
    slug: "zaluzje-aluminiowe-25mm",
    subtitle: "Precyzyjna regulacja światła, lekka forma i nowoczesny wygląd.",
    price_from: "od 229 zł",
    image_url:
      "https://images.unsplash.com/photo-1616627561950-9f746e330187?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Żaluzje Aluminiowe 50mm",
    slug: "zaluzje-aluminiowe-50mm",
    subtitle: "Szersza lamela i mocniejszy akcent we wnętrzu.",
    price_from: "od 269 zł",
    image_url:
      "https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Żaluzje drewniane 25mm",
    slug: "zaluzje-drewniane-25mm",
    subtitle: "Naturalne drewno w smukłej lameli 25 mm.",
    price_from: "od 349 zł",
    image_url:
      "https://images.unsplash.com/photo-1617103996702-96ff29b1c467?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Żaluzje drewniane 35mm",
    slug: "zaluzje-drewniane-35mm",
    subtitle: "Uniwersalna szerokość lameli do nowoczesnych wnętrz.",
    price_from: "od 379 zł",
    image_url:
      "https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Żaluzje drewniane 50mm",
    slug: "zaluzje-drewniane-50mm",
    subtitle: "Wyrazisty rytm lameli i mocny efekt premium.",
    price_from: "od 429 zł",
    image_url:
      "https://images.unsplash.com/photo-1617098474202-0d0d7f60d4f0?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Żaluzje drewniane 65mm",
    slug: "zaluzje-drewniane-65mm",
    subtitle: "Szeroka lamela do dużych przeszkleń i tarasowych okien.",
    price_from: "od 479 zł",
    image_url:
      "https://images.unsplash.com/photo-1600047508788-786f6b65df7f?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Żaluzje bambusowe 25mm",
    slug: "zaluzje-bambusowe-25mm",
    subtitle: "Lekki materiał bambusowy i delikatna lamela.",
    price_from: "od 369 zł",
    image_url:
      "https://images.unsplash.com/photo-1616627562072-5f8f66ef10cf?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Żaluzje bambusowe 35mm",
    slug: "zaluzje-bambusowe-35mm",
    subtitle: "Bambusowa lamela o uniwersalnej szerokości 35 mm.",
    price_from: "od 399 zł",
    image_url:
      "https://images.unsplash.com/photo-1616627561943-55d9e9f4f4c5?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Żaluzje bambusowe 50mm",
    slug: "zaluzje-bambusowe-50mm",
    subtitle: "Szersza lamela bambusowa i mocny, naturalny charakter.",
    price_from: "od 449 zł",
    image_url:
      "https://images.unsplash.com/photo-1611048268330-53de574cae3b?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Żaluzje bambusowe 65mm",
    slug: "zaluzje-bambusowe-65mm",
    subtitle: "Bambus 65 mm do dużych i reprezentacyjnych przeszkleń.",
    price_from: "od 499 zł",
    image_url:
      "https://images.unsplash.com/photo-1615874959474-d609969a20ed?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Żaluzje RETRO 50mm",
    slug: "zaluzje-retro-50mm",
    subtitle: "Styl retro i ciepła kolorystyka drewna.",
    price_from: "od 469 zł",
    image_url:
      "https://images.unsplash.com/photo-1600566752355-35792bedcfea?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Plisożaluzja aluminiowa 25mm",
    slug: "plisozaluzja-aluminiowa-25mm",
    subtitle: "Połączenie zaluzji i plis w kompaktowym systemie 25 mm.",
    price_from: "od 329 zł",
    image_url:
      "https://images.unsplash.com/photo-1600047509425-3854b8d7ad85?auto=format&fit=crop&w=1400&q=80",
  },
];

const fixedRomanProducts: ProductItem[] = [
  {
    name: "Rolety rzymskie",
    slug: "rolety-rzymskie",
    subtitle: "Dekoracyjne rolety tekstylne szyte na wymiar, z systemem zwijania kaskadowego.",
    price_from: "od 399 zł",
    image_url:
      "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=1400&q=80",
  },
];

const fixedRoofProducts: ProductItem[] = [
  {
    name: "Rolety dachowe Dekolux",
    slug: "rolety-dachowe-dekolux",
    subtitle: "Rolety z prowadnicami i mechanizmem sprężynowym.",
    price_from: "od 389 zł",
    image_url:
      "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Plisy dachowe",
    slug: "plisy-dachowe",
    subtitle: "Plisa z prowadnicami umożliwiająca zakrycie dowolnej powierzchni okna.",
    price_from: "od 429 zł",
    image_url:
      "https://images.unsplash.com/photo-1616047006789-b7af3f061b46?auto=format&fit=crop&w=1400&q=80",
  },
];

const fixedExternalRollerProducts: ProductItem[] = [
  {
    name: "Rolety adaptacyjne",
    slug: "rolety-adaptacyjne",
    subtitle: "Klasyczne rolety zewnętrzne montowane na elewacji lub we wnęce okiennej.",
    price_from: "od 899 zł",
    image_url:
      "https://images.unsplash.com/photo-1600566752547-08f6a2e99cf7?auto=format&fit=crop&w=1400&q=80",
  },
  {
    name: "Rolety pod zabudowę",
    slug: "rolety-pod-zabudowe",
    subtitle: "Rolety do zabudowy warstwą elewacji.",
    price_from: "od 1049 zł",
    image_url:
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=80",
  },
];

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

export default function ProductPage({ params }: { params?: { slug?: string } }) {
  const routerParams = useParams<{ slug?: string | string[] }>();
  const routerSlug = Array.isArray(routerParams?.slug)
    ? routerParams.slug[0]
    : routerParams?.slug;
  const propSlug = Array.isArray(params?.slug) ? params?.slug?.[0] : params?.slug;
  const slug = String(routerSlug || propSlug || "").trim();
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

  if (!foundGroup || !foundProduct) {
    const fixedInteriorProduct = fixedInteriorProducts.find((entry) => String(entry.slug || "").trim() === slug) || null;
    const fixedDayNightProduct = fixedDayNightProducts.find((entry) => String(entry.slug || "").trim() === slug) || null;
    const fixedPlisyProduct = fixedPlisyProducts.find((entry) => String(entry.slug || "").trim() === slug) || null;
    const fixedZaluzjeProduct = fixedZaluzjeProducts.find((entry) => String(entry.slug || "").trim() === slug) || null;
    const fixedRomanProduct = fixedRomanProducts.find((entry) => String(entry.slug || "").trim() === slug) || null;
    const fixedRoofProduct = fixedRoofProducts.find((entry) => String(entry.slug || "").trim() === slug) || null;
    const fixedExternalRollerProduct = fixedExternalRollerProducts.find((entry) => String(entry.slug || "").trim() === slug) || null;
    const fixedProduct = fixedInteriorProduct || fixedDayNightProduct || fixedPlisyProduct || fixedZaluzjeProduct || fixedRomanProduct || fixedRoofProduct || fixedExternalRollerProduct;
    if (fixedProduct) {
      const isDayNight = Boolean(fixedDayNightProduct);
      const isPlisy = Boolean(fixedPlisyProduct);
      const isZaluzje = Boolean(fixedZaluzjeProduct);
      const isRoman = Boolean(fixedRomanProduct);
      const isRoof = Boolean(fixedRoofProduct);
      const isExternalRoller = Boolean(fixedExternalRollerProduct);
      foundGroup = {
        title: isDayNight
          ? "Rolety dzień noc"
          : isPlisy
            ? "Plisy"
            : isZaluzje
              ? "Żaluzje"
              : isRoman
                ? "Rolety rzymskie"
                : isRoof
                  ? "Rolety do okien dachowych"
                  : isExternalRoller
                    ? "Rolety zewnętrzne"
                : "Osłony wewnętrzne",
        slug: isDayNight
          ? "rolety-dzien-noc"
          : isPlisy
            ? "plisy"
            : isZaluzje
              ? "zaluzje"
              : isRoman
                ? "oslony-wewnetrzne"
                : isRoof
                  ? "rolety-do-okien-dachowych"
                  : isExternalRoller
                    ? "rolety-zewnetrzne"
                : "oslony-wewnetrzne",
        description: isDayNight
          ? "Systemy dzień-noc do precyzyjnej regulacji światła i prywatności."
          : isPlisy
            ? "Plisy do okien pionowych i systemy SLIM do HS/HST."
            : isZaluzje
              ? "Żaluzje aluminiowe, drewniane, bambusowe oraz serie specjalne."
              : isRoman
                ? "Rolety rzymskie szyte na wymiar, łączące funkcję dekoracyjną i osłonową."
                : isRoof
                  ? "Rolety i plisy dedykowane oknom dachowym."
                  : isExternalRoller
                    ? "Rolety zewnętrzne do montażu elewacyjnego oraz pod zabudowę."
              : "Rolety i żaluzje do wnętrz mieszkalnych i biurowych.",
        background_url:
          isDayNight
            ? "https://images.unsplash.com/photo-1616627562072-5f8f66ef10cf?auto=format&fit=crop&w=2200&q=80"
            : isPlisy
              ? "https://images.unsplash.com/photo-1611048268330-53de574cae3b?auto=format&fit=crop&w=2200&q=80"
              : isZaluzje
                ? "https://images.unsplash.com/photo-1616627561943-55d9e9f4f4c5?auto=format&fit=crop&w=2200&q=80"
                : isRoman
                  ? "https://images.unsplash.com/photo-1616046229478-9901c5536a45?auto=format&fit=crop&w=2200&q=80"
                  : isRoof
                    ? "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2200&q=80"
                    : isExternalRoller
                      ? "https://images.unsplash.com/photo-1613977257592-487ecd136cc3?auto=format&fit=crop&w=2200&q=80"
                : "https://images.unsplash.com/photo-1616486701797-0f33f61038c8?auto=format&fit=crop&w=2200&q=80",
        products: isDayNight
          ? fixedDayNightProducts
          : isPlisy
            ? fixedPlisyProducts
            : isZaluzje
              ? fixedZaluzjeProducts
              : isRoman
                ? fixedRomanProducts
                : isRoof
                  ? fixedRoofProducts
                  : isExternalRoller
                    ? fixedExternalRollerProducts
                : fixedInteriorProducts,
      };
      foundProduct = fixedProduct;
    }
  }

  const bg = absolutizeUrl((foundGroup?.background_url || foundProduct?.image_url || ""), endpointOrigin);
  const productImage = absolutizeUrl(foundProduct?.image_url || "", endpointOrigin);
  const hasDedicatedConfigurator = slug === "rolety-best-1";
  const configuratorHref = hasDedicatedConfigurator ? `/konfigurator/${slug}` : "#konfigurator";

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
              <div className="product-anchor-nav">
                <a href="#galeria">Galeria</a>
                <a href="#opis">Opis</a>
                <a href={configuratorHref}>Konfigurator</a>
              </div>
              <ul>
                <li>Konfiguracja dokładnych wymiarów</li>
                <li>Dobór systemu i sterowania</li>
                <li>Wycena online i realizacja od producenta</li>
              </ul>
              <div className="product-info-actions">
                <a href={configuratorHref}>Skonfiguruj produkt</a>
                <Link href={`/kategoria/${foundGroup.slug || ""}`}>Wróć do kategorii</Link>
              </div>
            </article>
            <section className="product-content-panels">
              <article id="galeria" className="catalog-card">
                <h3>Galeria</h3>
                <p>Tu podpinamy docelową galerię realizacji i zdjęcia detali produktu.</p>
              </article>
              <article id="opis" className="catalog-card">
                <h3>Opis</h3>
                <p>Tu podpinamy pełny opis techniczny, warianty i opcje dodatkowe produktu.</p>
              </article>
              <article id="konfigurator" className="catalog-card">
                <h3>Konfigurator</h3>
                {hasDedicatedConfigurator ? (
                  <>
                    <p>Skonfiguruj roletę krok po kroku: kolor osprzętu, tkanina i pozycje wymiarowe.</p>
                    <p><Link href={configuratorHref}>Przejdź do konfiguratora Best 1</Link></p>
                  </>
                ) : (
                  <p>Konfigurator dla tego produktu będzie uruchamiany w kolejnym etapie.</p>
                )}
              </article>
            </section>
          </section>
        )}
      </main>
    </div>
  );
}
