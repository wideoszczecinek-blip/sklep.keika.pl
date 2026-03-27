"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import ThemeToggle from "@/app/components/theme-toggle";

type ProductItem = {
  name?: string;
  slug?: string;
  subtitle?: string;
  description?: string;
  price_from?: string;
  badge?: string;
  image_url?: string;
  gallery_urls?: string[];
  title?: string;
  mockup_template_id?: string;
  fabric_library_ids?: string[];
  default_scene_id?: string;
  default_mount_variant_id?: string;
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
  fabric_libraries?: FabricLibrary[];
  mockup_templates?: MockupTemplate[];
};

type FabricLibrarySwatch = {
  id?: string;
  code?: string;
  label?: string;
  color?: string;
  price_delta?: number;
  source_image_url?: string;
  preview_image_url?: string;
  texture_image_url?: string;
  ai_status?: string;
  ai_note?: string;
};

type FabricLibraryGroup = {
  id?: string;
  label?: string;
  note?: string;
  swatches?: FabricLibrarySwatch[];
};

type FabricLibrary = {
  id?: string;
  label?: string;
  note?: string;
  product_slugs?: string[];
  groups?: FabricLibraryGroup[];
};

type MockupMountVariant = {
  id?: string;
  label?: string;
  note?: string;
  preview_url?: string;
  base_image_url?: string;
  fabric_mask_url?: string;
  hardware_mask_url?: string;
  overlay_image_url?: string;
  displacement_map_url?: string;
};

type MockupScene = {
  id?: string;
  label?: string;
  note?: string;
  background_url?: string;
  preview_url?: string;
};

type MockupHardwareFinish = {
  id?: string;
  label?: string;
  type?: string;
  color?: string;
  image_url?: string;
  texture_url?: string;
  note?: string;
};

type MockupTemplate = {
  id?: string;
  label?: string;
  note?: string;
  product_slugs?: string[];
  default_scene_id?: string;
  default_mount_variant_id?: string;
  mount_variants?: MockupMountVariant[];
  scenes?: MockupScene[];
  hardware_finishes?: MockupHardwareFinish[];
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

function resolveProductFabricLibraries(config: PublicConfig | null, product: ProductItem | null): FabricLibrary[] {
  if (!product) return [];
  const libraries = Array.isArray(config?.fabric_libraries) ? config.fabric_libraries : [];
  const explicitIds = Array.isArray(product.fabric_library_ids)
    ? product.fabric_library_ids.map((entry) => String(entry || "").trim()).filter(Boolean)
    : [];
  const productSlug = String(product.slug || "").trim();

  if (explicitIds.length > 0) {
    const explicitLibraries = libraries.filter((entry) => explicitIds.includes(String(entry.id || "").trim()));
    if (explicitLibraries.length > 0) return explicitLibraries;
  }

  return libraries.filter((entry) => {
    const productSlugs = Array.isArray(entry.product_slugs) ? entry.product_slugs : [];
    return productSlugs.includes(productSlug);
  });
}

function resolveMockupTemplate(config: PublicConfig | null, product: ProductItem | null): MockupTemplate | null {
  if (!product) return null;
  const templates = Array.isArray(config?.mockup_templates) ? config.mockup_templates : [];
  const explicitId = String(product.mockup_template_id || "").trim();
  const productSlug = String(product.slug || "").trim();

  if (explicitId) {
    const direct = templates.find((entry) => String(entry.id || "").trim() === explicitId);
    if (direct) return direct;
  }

  return templates.find((entry) => {
    const productSlugs = Array.isArray(entry.product_slugs) ? entry.product_slugs : [];
    return productSlugs.includes(productSlug);
  }) || null;
}

function collectLibrarySwatches(libraries: FabricLibrary[]): FabricLibraryGroup[] {
  const result: FabricLibraryGroup[] = [];
  for (const library of libraries) {
    const groups = Array.isArray(library.groups) ? library.groups : [];
    for (const group of groups) {
      result.push({
        id: String(group.id || "").trim(),
        label: String(group.label || group.id || "").trim(),
        note: String(group.note || "").trim(),
        swatches: (Array.isArray(group.swatches) ? group.swatches : [])
          .map((swatch) => ({
            ...swatch,
            id: String(swatch.id || swatch.code || "").trim(),
            code: String(swatch.code || "").trim(),
            label: String(swatch.label || swatch.code || swatch.id || "").trim(),
            color: String(swatch.color || "").trim(),
            source_image_url: String(swatch.source_image_url || "").trim(),
            preview_image_url: String(swatch.preview_image_url || swatch.texture_image_url || "").trim(),
            texture_image_url: String(swatch.texture_image_url || swatch.preview_image_url || "").trim(),
            ai_status: String(swatch.ai_status || "").trim(),
            ai_note: String(swatch.ai_note || "").trim(),
          }))
          .filter((swatch) => swatch.ai_status !== "rejected")
          .sort((a, b) => {
            const score = (status?: string) => {
              if (status === "approved") return 0;
              if (status === "ready") return 1;
              if (status === "manual") return 2;
              return 3;
            };
            return score(a.ai_status) - score(b.ai_status);
          })
          .filter((swatch) => swatch.id || swatch.code || swatch.label),
      });
    }
  }
  return result;
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
  const galleryImages = (Array.isArray(foundProduct?.gallery_urls) ? foundProduct.gallery_urls : [])
    .map((entry) => absolutizeUrl(entry || "", endpointOrigin))
    .filter(Boolean);
  const galleryTiles = galleryImages.length > 0 ? galleryImages : (productImage ? [productImage] : []);
  const productBadge = String(foundProduct?.badge || "").trim();
  const productLead =
    foundProduct?.description ||
    foundProduct?.subtitle ||
    "Nowoczesny produkt na wymiar. Dobierz parametry, tkaninę i opcje montażu.";
  const hasDedicatedConfigurator =
    slug === "rolety-best-1" || slug.startsWith("moskitiery");
  const configuratorHref = slug.startsWith("moskitiery") ? "/moskitiery" : hasDedicatedConfigurator ? `/konfigurator/${slug}` : "#konfigurator";
  const linkedFabricLibraries = useMemo(() => resolveProductFabricLibraries(config, foundProduct), [config, foundProduct]);
  const linkedMockupTemplate = useMemo(() => resolveMockupTemplate(config, foundProduct), [config, foundProduct]);
  const fabricGroups = useMemo(() => collectLibrarySwatches(linkedFabricLibraries), [linkedFabricLibraries]);
  const availableScenes = useMemo(
    () => (Array.isArray(linkedMockupTemplate?.scenes) ? linkedMockupTemplate.scenes : []),
    [linkedMockupTemplate],
  );
  const availableMountVariants = useMemo(
    () => (Array.isArray(linkedMockupTemplate?.mount_variants) ? linkedMockupTemplate.mount_variants : []),
    [linkedMockupTemplate],
  );
  const availableHardwareFinishes = useMemo(
    () => (Array.isArray(linkedMockupTemplate?.hardware_finishes) ? linkedMockupTemplate.hardware_finishes : []),
    [linkedMockupTemplate],
  );
  const [selectedSceneId, setSelectedSceneId] = useState("");
  const [selectedMountVariantId, setSelectedMountVariantId] = useState("");
  const [selectedHardwareFinishId, setSelectedHardwareFinishId] = useState("");
  const [selectedFabricGroupId, setSelectedFabricGroupId] = useState("");
  const [selectedFabricId, setSelectedFabricId] = useState("");

  useEffect(() => {
    const fallbackSceneId = String(foundProduct?.default_scene_id || linkedMockupTemplate?.default_scene_id || availableScenes[0]?.id || "").trim();
    const fallbackMountId = String(foundProduct?.default_mount_variant_id || linkedMockupTemplate?.default_mount_variant_id || availableMountVariants[0]?.id || "").trim();
    const fallbackFinishId = String(availableHardwareFinishes[0]?.id || "").trim();
    const fallbackGroup = fabricGroups[0] || null;
    const fallbackFabric = Array.isArray(fallbackGroup?.swatches) ? fallbackGroup.swatches[0] : null;

    setSelectedSceneId(fallbackSceneId);
    setSelectedMountVariantId(fallbackMountId);
    setSelectedHardwareFinishId(fallbackFinishId);
    setSelectedFabricGroupId(String(fallbackGroup?.id || "").trim());
    setSelectedFabricId(String(fallbackFabric?.id || fallbackFabric?.code || "").trim());
  }, [slug, foundProduct?.default_scene_id, foundProduct?.default_mount_variant_id, linkedMockupTemplate, availableScenes, availableMountVariants, availableHardwareFinishes, fabricGroups]);

  const activeScene =
    availableScenes.find((entry) => String(entry.id || "").trim() === selectedSceneId) ||
    availableScenes[0] ||
    null;
  const activeMountVariant =
    availableMountVariants.find((entry) => String(entry.id || "").trim() === selectedMountVariantId) ||
    availableMountVariants[0] ||
    null;
  const activeHardwareFinish =
    availableHardwareFinishes.find((entry) => String(entry.id || "").trim() === selectedHardwareFinishId) ||
    availableHardwareFinishes[0] ||
    null;
  const activeFabricGroup =
    fabricGroups.find((entry) => String(entry.id || "").trim() === selectedFabricGroupId) ||
    fabricGroups[0] ||
    null;
  const activeFabric =
    (Array.isArray(activeFabricGroup?.swatches) ? activeFabricGroup.swatches : []).find(
      (entry) => String(entry.id || entry.code || "").trim() === selectedFabricId,
    ) ||
    (Array.isArray(activeFabricGroup?.swatches) ? activeFabricGroup.swatches[0] : null) ||
    null;
  const hasInteractiveMockup = Boolean(linkedMockupTemplate && (availableScenes.length || availableMountVariants.length || availableHardwareFinishes.length || fabricGroups.length));

  function renderPreviewWindow() {
    const sceneImage = absolutizeUrl(activeScene?.background_url || bg || productImage, endpointOrigin);
    const baseImage = absolutizeUrl(activeMountVariant?.base_image_url || productImage, endpointOrigin);
    const fabricMask = absolutizeUrl(activeMountVariant?.fabric_mask_url || "", endpointOrigin);
    const hardwareMask = absolutizeUrl(activeMountVariant?.hardware_mask_url || "", endpointOrigin);
    const overlayImage = absolutizeUrl(activeMountVariant?.overlay_image_url || "", endpointOrigin);
    const fabricTexture = activeFabric?.texture_image_url
      ? absolutizeUrl(activeFabric.texture_image_url, endpointOrigin)
      : activeFabric?.preview_image_url
        ? absolutizeUrl(activeFabric.preview_image_url, endpointOrigin)
        : "";
    const hardwareTexture = absolutizeUrl(activeHardwareFinish?.texture_url || activeHardwareFinish?.image_url || "", endpointOrigin);
    const hardwareColor = activeHardwareFinish?.color || "#3e434b";

    const fabricStyle =
      fabricMask
        ? {
            backgroundColor: activeFabric?.color || "#9cadc2",
            backgroundImage: fabricTexture ? `url(${fabricTexture})` : undefined,
            backgroundSize: fabricTexture ? "cover" : undefined,
            backgroundPosition: "center",
            WebkitMaskImage: `url(${fabricMask})`,
            maskImage: `url(${fabricMask})`,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }
        : undefined;

    const hardwareStyle =
      hardwareMask
        ? {
            background: hardwareTexture ? undefined : `linear-gradient(180deg, ${hardwareColor}, rgba(18, 28, 43, 0.92))`,
            backgroundColor: hardwareTexture ? hardwareColor : undefined,
            backgroundImage: hardwareTexture ? `url(${hardwareTexture})` : undefined,
            backgroundSize: hardwareTexture ? "cover" : undefined,
            backgroundPosition: "center",
            WebkitMaskImage: `url(${hardwareMask})`,
            maskImage: `url(${hardwareMask})`,
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }
        : undefined;

    return (
      <div className="config-preview-window">
        <span className="config-preview-scene" style={sceneImage ? { backgroundImage: `url(${sceneImage})` } : undefined} />
        <span className="config-preview-base" style={baseImage ? { backgroundImage: `url(${baseImage})` } : undefined} />

        {hardwareMask ? (
          <span className="config-preview-hardware-mask" style={hardwareStyle} />
        ) : (
          <>
            <span className="config-preview-cassette" style={{ background: `linear-gradient(180deg, ${hardwareColor}, rgba(18, 28, 43, 0.92))` }} />
            <span className="config-preview-guide is-left" style={{ background: hardwareColor }} />
            <span className="config-preview-guide is-right" style={{ background: hardwareColor }} />
          </>
        )}

        {fabricMask ? (
          <span className="config-preview-fabric-mask" style={fabricStyle} />
        ) : (
          <span
            className="config-preview-fabric"
            style={{
              background: activeFabric?.color || "#9cadc2",
              backgroundImage: fabricTexture ? `url(${fabricTexture})` : undefined,
              backgroundSize: "cover",
              backgroundPosition: "center",
            }}
          />
        )}

        {overlayImage ? <span className="config-preview-overlay-image" style={{ backgroundImage: `url(${overlayImage})` }} /> : null}
      </div>
    );
  }

  return (
    <div className="catalog-root" style={{ backgroundImage: bg ? `url(${bg})` : undefined }}>
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
          <ThemeToggle />
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
            <div className="product-preview-card catalog-card">
              <div
                className={`config-preview-mockup product-preview-mockup ${hasInteractiveMockup ? "is-dynamic" : ""}`}
                style={!hasInteractiveMockup && productImage ? { backgroundImage: `url(${productImage})` } : undefined}
              >
                {hasInteractiveMockup ? renderPreviewWindow() : null}
              </div>
              <div className="product-preview-meta">
                <div>
                  <strong>Mockup</strong>
                  <small>{linkedMockupTemplate?.label || "Podstawowy widok produktu"}</small>
                </div>
                <div>
                  <strong>Sceneria</strong>
                  <small>{activeScene?.label || "Domyślna"}</small>
                </div>
                <div>
                  <strong>Montaż</strong>
                  <small>{activeMountVariant?.label || "Standardowy"}</small>
                </div>
              </div>
            </div>
            <article className="product-info-card">
              <p>{foundGroup.title || "Kategoria"}</p>
              {productBadge ? <span className="catalog-product-badge">{productBadge}</span> : null}
              <h1>{foundProduct.name || "Produkt"}</h1>
              <h2>{foundProduct.price_from || "Cena po konfiguracji"}</h2>
              <p>{productLead}</p>
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
              <article className="catalog-card">
                <h3>Dobierz wygląd</h3>
                <div className="product-options-grid">
                  {availableScenes.length > 0 ? (
                    <div className="product-option-block">
                      <strong>Sceneria</strong>
                      <div className="product-chip-list">
                        {availableScenes.map((scene) => {
                          const isActive = String(scene.id || "").trim() === String(activeScene?.id || "").trim();
                          const image = absolutizeUrl(scene.preview_url || scene.background_url || "", endpointOrigin);
                          return (
                            <button
                              key={scene.id || scene.label}
                              type="button"
                              className={`product-chip-card ${isActive ? "is-active" : ""}`}
                              onClick={() => setSelectedSceneId(String(scene.id || "").trim())}
                            >
                              <span className="product-chip-card-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
                              <span>
                                <strong>{scene.label || scene.id}</strong>
                                <small>{scene.note || "Podgląd wnętrza"}</small>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {availableMountVariants.length > 0 ? (
                    <div className="product-option-block">
                      <strong>Montaż</strong>
                      <div className="product-chip-list">
                        {availableMountVariants.map((variant) => {
                          const isActive = String(variant.id || "").trim() === String(activeMountVariant?.id || "").trim();
                          const image = absolutizeUrl(variant.preview_url || variant.base_image_url || "", endpointOrigin);
                          return (
                            <button
                              key={variant.id || variant.label}
                              type="button"
                              className={`product-chip-card ${isActive ? "is-active" : ""}`}
                              onClick={() => setSelectedMountVariantId(String(variant.id || "").trim())}
                            >
                              <span className="product-chip-card-image" style={image ? { backgroundImage: `url(${image})` } : undefined} />
                              <span>
                                <strong>{variant.label || variant.id}</strong>
                                <small>{variant.note || "Wariant montażu"}</small>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {availableHardwareFinishes.length > 0 ? (
                    <div className="product-option-block">
                      <strong>Kolor osprzętu</strong>
                      <div className="product-swatch-list">
                        {availableHardwareFinishes.map((finish) => {
                          const isActive = String(finish.id || "").trim() === String(activeHardwareFinish?.id || "").trim();
                          const image = absolutizeUrl(finish.image_url || finish.texture_url || "", endpointOrigin);
                          return (
                            <button
                              key={finish.id || finish.label}
                              type="button"
                              className={`product-swatch-card ${isActive ? "is-active" : ""}`}
                              onClick={() => setSelectedHardwareFinishId(String(finish.id || "").trim())}
                            >
                              <span
                                className="product-swatch-card-image"
                                style={image ? { backgroundImage: `url(${image})` } : { backgroundColor: finish.color || "#7d8794" }}
                              />
                              <span>
                                <strong>{finish.label || finish.id}</strong>
                                <small>{finish.note || "Wykończenie osprzętu"}</small>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  {fabricGroups.length > 0 ? (
                    <div className="product-option-block">
                      <strong>Tkaniny</strong>
                      <div className="product-fabric-groups">
                        {fabricGroups.map((group) => (
                          <button
                            key={group.id || group.label}
                            type="button"
                            className={`product-chip ${String(group.id || "").trim() === String(activeFabricGroup?.id || "").trim() ? "is-active" : ""}`}
                            onClick={() => {
                              setSelectedFabricGroupId(String(group.id || "").trim());
                              const firstSwatch = Array.isArray(group.swatches) ? group.swatches[0] : null;
                              setSelectedFabricId(String(firstSwatch?.id || firstSwatch?.code || "").trim());
                            }}
                          >
                            {group.label || group.id}
                          </button>
                        ))}
                      </div>
                      <div className="product-swatch-list">
                        {(Array.isArray(activeFabricGroup?.swatches) ? activeFabricGroup.swatches : []).map((swatch) => {
                          const swatchId = String(swatch.id || swatch.code || "").trim();
                          const isActive = swatchId === String(activeFabric?.id || activeFabric?.code || "").trim();
                          const image = absolutizeUrl(swatch.preview_image_url || swatch.texture_image_url || swatch.source_image_url || "", endpointOrigin);
                          return (
                            <button
                              key={swatchId}
                              type="button"
                              className={`product-swatch-card ${isActive ? "is-active" : ""}`}
                              onClick={() => setSelectedFabricId(swatchId)}
                            >
                              <span
                                className="product-swatch-card-image"
                                style={image ? { backgroundImage: `url(${image})` } : { backgroundColor: swatch.color || "#c5ceda" }}
                              />
                              <span>
                                <strong>{swatch.label || swatch.code || swatch.id}</strong>
                                <small>{swatch.ai_note || activeFabricGroup?.note || "Biblioteka tkanin z CRM"}</small>
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </div>
              </article>
              <article id="galeria" className="catalog-card">
                <h3>Galeria</h3>
                <div className="catalog-product-gallery-grid">
                  {galleryTiles.map((image, index) => (
                    <div
                      key={`${image}-${index}`}
                      className="catalog-product-gallery-tile"
                      style={{ backgroundImage: `url(${image})` }}
                    />
                  ))}
                  {galleryTiles.length === 0 ? (
                    <div className="catalog-product-gallery-tile catalog-product-gallery-tile--empty">
                      Dodaj zdjęcia w panelu CRM, aby zbudować galerię produktu.
                    </div>
                  ) : null}
                </div>
              </article>
              <article id="opis" className="catalog-card">
                <h3>Opis</h3>
                <p>{foundProduct.description || foundProduct.subtitle || "Opis produktu uzupełnisz w panelu CRM."}</p>
                {linkedFabricLibraries.length > 0 ? (
                  <p><strong>Powiązane biblioteki tkanin:</strong> {linkedFabricLibraries.map((library) => library.label || library.id).join(", ")}</p>
                ) : null}
              </article>
              <article id="konfigurator" className="catalog-card">
                <h3>Konfigurator</h3>
                {hasDedicatedConfigurator ? (
                  <>
                    <p>Skonfiguruj produkt krok po kroku: wybierz wariant, parametry i pozycje wymiarowe.</p>
                    <p><Link href={configuratorHref}>Przejdź do konfiguratora {foundProduct.name || "produktu"}</Link></p>
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
