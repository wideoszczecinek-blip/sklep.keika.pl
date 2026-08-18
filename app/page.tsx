"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import ThemeToggle from "@/app/components/theme-toggle";
import { optimizeImageUrl } from "@/lib/image-optim";

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
  product_configurators?: Array<{
    product_slug?: string;
    enabled?: boolean;
    hardware_swatches?: Array<{
      id?: string;
      label?: string;
      color?: string;
      image_url?: string;
      price_delta?: number;
    }>;
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

type ProductTabKey = "opis" | "galeria" | "opinie" | "instrukcje";

type ProductInstructionStep = {
  title: string;
  body: string;
};

type SelectedProductView = {
  groupIndex: number;
  groupSlug: string;
  groupTitle: string;
  label: string;
  linkUrl: string;
  iconUrl: string;
  imageUrl: string;
  description: string;
  reviews: string[];
  gallery: string[];
  shareSlug: string;
};

function productDescription(label: string): string {
  const normalized = normalizeMenuLabel(label);
  if (normalized.includes("moskitier")) {
    return "Moskitiery na wymiar z naciskiem na prosty pomiar, szybką realizację i estetyczny montaż bez zbędnych komplikacji.";
  }
  if (normalized.includes("zaluzj")) {
    return "Nowoczesne żaluzje dopasowane do wnętrza, z naciskiem na precyzję wykonania i wygodną codzienną regulację światła.";
  }
  if (normalized.includes("plis")) {
    return "Plisy szyte pod Twoje okno, z płynnym sterowaniem i bardzo elastycznym dopasowaniem do różnych typów okien.";
  }
  if (normalized.includes("rolet")) {
    return "Rolety wykonywane na wymiar z czytelnym procesem zamówienia: wybór wariantu, pomiar i szybka wycena.";
  }
  return "Produkt konfigurowany pod wymiar z prostym procesem zamówienia i wsparciem na etapie pomiaru.";
}

const GENERIC_INSTRUCTION_STEPS: ProductInstructionStep[] = [
  {
    title: "Pomiar",
    body: "Zmierz dokładnie wymiary otworu montażowego. Wpisz je w konfiguratorze — resztę wyliczymy automatycznie.",
  },
  {
    title: "Montaż",
    body: "Wszystkie potrzebne elementy montażowe dostajesz w komplecie, wraz z instrukcją krok po kroku.",
  },
  {
    title: "Wsparcie",
    body: "Masz pytania podczas montażu? Napisz lub zadzwoń — pomożemy dobrać właściwy wariant i podpowiemy jak zamontować produkt.",
  },
];

const MOSKITIERY_RAMKOWE_INSTRUCTION_STEPS: ProductInstructionStep[] = [
  {
    title: "1. Sprężynowe zaczepy bez wiercenia",
    body: "Montaż odbywa się bezinwazyjnie, na zaczepach sprężynowych — bez wiercenia i bez uszkadzania ramy okna. Zaczepy mocujesz w kilku punktach na obwodzie ramy.",
  },
  {
    title: "2. Szybkie złożenie w domu",
    body: "Moskitierę otrzymujesz przygotowaną do samodzielnego złożenia. Wystarczy kilka-kilkanaście minut, śrubokręt krzyżakowy i nożyk do odcięcia zapasu siatki.",
  },
  {
    title: "3. Osadzenie w oknie",
    body: "Złożoną ramkę wystarczy wsunąć w zaczepy sprężynowe i docisnąć na całym obwodzie — moskitiera stabilnie trzyma naciąg siatki przez wiele sezonów.",
  },
  {
    title: "4. Sezonowy demontaż",
    body: "Na zimę moskitierę można łatwo zdemontować (odciskając zaczepy) i schować, a wiosną zamontować z powrotem w tych samych punktach.",
  },
];

function productInstructionSteps(label: string): ProductInstructionStep[] {
  const normalized = normalizeMenuLabel(label);
  if (normalized.includes("moskitier")) {
    return MOSKITIERY_RAMKOWE_INSTRUCTION_STEPS;
  }
  return GENERIC_INSTRUCTION_STEPS;
}

function slugFromLink(linkUrl: string, label: string): string {
  const raw = String(linkUrl || "").trim();
  if (raw.startsWith("/produkt/")) {
    return raw.replace(/^\/produkt\//, "").split(/[?#]/)[0] || normalizeMenuLabel(label).replace(/\s+/g, "-");
  }
  if (raw.startsWith("/kategoria/")) {
    return raw.replace(/^\/kategoria\//, "").split(/[?#]/)[0] || normalizeMenuLabel(label).replace(/\s+/g, "-");
  }
  return normalizeMenuLabel(label).replace(/\s+/g, "-");
}

type HardwareOption = {
  id: string;
  label: string;
  color: string;
  imageUrl: string;
  galleryUrls: string[];
  priceDelta: number;
};

type MeshOption = {
  id: string;
  label: string;
  color: string;
};

const DEFAULT_HARDWARE_COLORS: Array<{ id: string; label: string; color: string }> = [
  { id: "bialy", label: "Biały", color: "#EAECEF" },
  { id: "antracyt", label: "Antracyt", color: "#4A4F58" },
  { id: "braz", label: "Brąz", color: "#6F4B38" },
  { id: "zloty-dab", label: "Złoty dąb", color: "#B77B3E" },
  { id: "orzech", label: "Orzech", color: "#7A4F34" },
  { id: "winchester", label: "Winchester", color: "#B16D3D" },
  { id: "mahon", label: "Mahoń", color: "#6A2F27" },
];

const ALLEGRO_MOSKITIERY_HARDWARE: HardwareOption[] = [
  {
    id: "bialy",
    label: "Biały",
    color: "#f0f1f3",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000347_2dc2ceab_Bialy_1.jpg",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000347_2dc2ceab_Bialy_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000328_79e6551b_Bialy_2.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000401_566be7d6_Bialy_3.jpg",
    ],
    priceDelta: 0,
  },
  {
    id: "antracyt",
    label: "Antracyt",
    color: "#4a4f58",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000554_035f1db1_Antracyt_1.jpg",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000554_035f1db1_Antracyt_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000546_c5c56ae1_Antracyt_2.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000601_9e1a8ebf_Antracyt_3.jpg",
    ],
    priceDelta: 0,
  },
  {
    id: "braz",
    label: "Brąz",
    color: "#6f4b38",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000635_9726bee7_Braz_1.jpg",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000635_9726bee7_Braz_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000647_361e63b8_Braz_2.jpg",
    ],
    priceDelta: 0,
  },
  {
    id: "zloty-dab",
    label: "Złoty dąb",
    color: "#b77b3e",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000729_eeabf87c_ZlotyDab_1.jpg",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000729_eeabf87c_ZlotyDab_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000722_a4143e5c_ZlotyDab_2.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000736_f064cbb0_ZlotyDab_3.jpg",
    ],
    priceDelta: 0,
  },
  {
    id: "orzech",
    label: "Orzech",
    color: "#7a4f34",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000812_2fb228c4_Orzech_1.jpg",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000812_2fb228c4_Orzech_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000800_202d5380_Orzech_2.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000822_c2fadbc5_Orzech_3.jpg",
    ],
    priceDelta: 0,
  },
  {
    id: "winchester",
    label: "Winchester",
    color: "#b16d3d",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000852_41d51076_Winchester_1.jpg",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000852_41d51076_Winchester_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000848_017894bf_Winchester_2.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000859_51c6c15c_Winchester_3.jpg",
    ],
    priceDelta: 0,
  },
  {
    id: "mahon",
    label: "Mahoń",
    color: "#6a2f27",
    imageUrl: "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000920_fe216be2_Mahon_1.jpg",
    galleryUrls: [
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000920_fe216be2_Mahon_1.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000912_440c4496_Mahon_2.jpg",
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260325_000925_ac038d5b_Mahon_3.jpg",
    ],
    priceDelta: 0,
  },
];

const MESH_OPTIONS: MeshOption[] = [
  { id: "grey", label: "Szara (wzmocniona)", color: "#8b9099" },
  { id: "black", label: "Czarna (wzmocniona)", color: "#2f343d" },
];

function productSlugFromSelected(product: SelectedProductView | null): string {
  if (!product) return "";
  const raw = String(product.linkUrl || "").trim();
  if (!raw) return String(product.shareSlug || "").trim();
  if (raw.startsWith("/produkt/")) {
    return raw.replace(/^\/produkt\//, "").split(/[?#]/)[0] || String(product.shareSlug || "").trim();
  }
  return String(product.shareSlug || "").trim();
}

function hardwareOptionsForProduct(
  product: SelectedProductView | null,
  config: HomepageConfig | null,
  endpointOrigin: string,
): HardwareOption[] {
  if (!product) return [];
  const normalizedSlug = normalizeMenuLabel(productSlugFromSelected(product));
  if (normalizedSlug === "moskitiery-ramkowe") {
    return ALLEGRO_MOSKITIERY_HARDWARE;
  }
  const productSlug = productSlugFromSelected(product);
  const configurators = Array.isArray(config?.product_configurators) ? config.product_configurators : [];
  const profile = configurators.find((entry) => {
    if (!entry || entry.enabled === false) return false;
    return String(entry.product_slug || "").trim() === productSlug;
  });
  const swatches = Array.isArray(profile?.hardware_swatches) ? profile!.hardware_swatches! : [];
  const fromProfile = swatches
    .map((entry) => {
      const id = String(entry.id || "").trim();
      if (!id) return null;
      return {
        id,
        label: String(entry.label || id).trim(),
        color: String(entry.color || "#8ea0b7").trim() || "#8ea0b7",
        imageUrl: absolutizeUrl(String(entry.image_url || "").trim(), endpointOrigin),
        galleryUrls: [] as string[],
        priceDelta: Number.isFinite(Number(entry.price_delta)) ? Number(entry.price_delta) : 0,
      } satisfies HardwareOption;
    })
    .filter((entry): entry is HardwareOption => Boolean(entry));

  if (fromProfile.length > 0) {
    const fallbackImage = product.imageUrl || fallbackHeroSlides[0];
    return fromProfile.map((entry, index) => ({
      ...entry,
      imageUrl:
        entry.imageUrl ||
        product.gallery[index % Math.max(1, product.gallery.length)] ||
        fallbackImage,
      galleryUrls: [
        entry.imageUrl ||
          product.gallery[index % Math.max(1, product.gallery.length)] ||
          fallbackImage,
      ].filter(Boolean),
    }));
  }

  const fallbackImage = product.imageUrl || fallbackHeroSlides[0];
  const images = product.gallery.length ? product.gallery : [fallbackImage];
  return DEFAULT_HARDWARE_COLORS.map((entry, index) => ({
    id: entry.id,
    label: entry.label,
    color: entry.color,
    imageUrl: images[index % images.length] || fallbackImage,
    galleryUrls: [images[index % images.length] || fallbackImage].filter(Boolean),
    priceDelta: 0,
  }));
}

function normalizeMenuLabel(raw: string): string {
  return String(raw || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function resolveMenuFallbackLink(groupSlugRaw: string, labelRaw: string): string {
  const groupSlug = String(groupSlugRaw || "").trim().toLowerCase();
  const label = normalizeMenuLabel(labelRaw);

  if (groupSlug === "oslony-wewnetrzne" && /^rolety dzien ?-? noc$/.test(label)) {
    return "/kategoria/rolety-dzien-noc";
  }

  if (groupSlug === "oslony-wewnetrzne" && /^rolety tradycyjne$/.test(label)) {
    return "/kategoria/oslony-wewnetrzne";
  }

  if (groupSlug === "oslony-wewnetrzne" && /^plisy$/.test(label)) {
    return "/kategoria/plisy";
  }

  if (groupSlug === "oslony-wewnetrzne" && /^zaluzje$/.test(label)) {
    return "/kategoria/zaluzje";
  }

  if (groupSlug === "oslony-wewnetrzne" && /^rolety rzymskie$/.test(label)) {
    return "/produkt/rolety-rzymskie";
  }

  if (groupSlug === "oslony-wewnetrzne" && /^rolety do okien dachowych$/.test(label)) {
    return "/kategoria/rolety-do-okien-dachowych";
  }

  if (groupSlug === "oslony-zewnetrzne" && /^rolety zewnetrzne$/.test(label)) {
    return "/kategoria/rolety-zewnetrzne";
  }

  if (groupSlug === "moskitiery" && /^moskitiery ramkowe$/.test(label)) {
    return "/produkt/moskitiery-ramkowe";
  }

  if (groupSlug === "moskitiery" && /^moskitiery do okien dachowych$/.test(label)) {
    return "/produkt/moskitiery-do-okien-dachowych";
  }

  if (groupSlug === "moskitiery" && /^moskitiery drzwiowe$/.test(label)) {
    return "/produkt/moskitiery-drzwiowe";
  }

  if (groupSlug === "moskitiery" && /^przesuwne$/.test(label)) {
    return "/produkt/moskitiery-przesuwne";
  }

  if (groupSlug === "moskitiery" && /^plisowane$/.test(label)) {
    return "/produkt/moskitiery-plisowane";
  }

  return `/kategoria/${groupSlug}`;
}

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
      { label: "Rolety tradycyjne", iconUrl: iconInside, linkUrl: "/kategoria/oslony-wewnetrzne" },
      { label: "Rolety dzień - noc", iconUrl: iconInside, linkUrl: "/kategoria/rolety-dzien-noc" },
      { label: "Plisy", iconUrl: iconInside, linkUrl: "/kategoria/plisy" },
      { label: "Żaluzje", iconUrl: iconInside, linkUrl: "/kategoria/zaluzje" },
      { label: "Rolety rzymskie", iconUrl: iconInside, linkUrl: "/produkt/rolety-rzymskie" },
      { label: "Rolety do okien dachowych", iconUrl: iconInside, linkUrl: "/kategoria/rolety-do-okien-dachowych" },
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
      { label: "Rolety zewnętrzne", iconUrl: iconOutside, linkUrl: "/kategoria/rolety-zewnetrzne" },
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
      { label: "Moskitiery ramkowe", iconUrl: iconMosquito, linkUrl: "/produkt/moskitiery-ramkowe" },
      { label: "Moskitiery do okien dachowych", iconUrl: iconMosquito, linkUrl: "/produkt/moskitiery-do-okien-dachowych" },
      { label: "Moskitiery drzwiowe", iconUrl: iconMosquito, linkUrl: "/produkt/moskitiery-drzwiowe" },
      { label: "Przesuwne", iconUrl: iconMosquito, linkUrl: "/produkt/moskitiery-przesuwne" },
      { label: "Plisowane", iconUrl: iconMosquito, linkUrl: "/produkt/moskitiery-plisowane" },
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
  const [selectedProduct, setSelectedProduct] = useState<SelectedProductView | null>(null);
  const [displayedProduct, setDisplayedProduct] = useState<SelectedProductView | null>(null);
  const [isProductView, setIsProductView] = useState(false);
  const [activeProductTab, setActiveProductTab] = useState<ProductTabKey>("opis");
  const [activeProductGallerySlide, setActiveProductGallerySlide] = useState(0);
  const [selectedHardwareId, setSelectedHardwareId] = useState("");
  const [stepOneChosen, setStepOneChosen] = useState(false);
  const [stepOneCollapsed, setStepOneCollapsed] = useState(false);
  const [selectedMeshId, setSelectedMeshId] = useState("");
  const [zoomPreview, setZoomPreview] = useState<{ title: string; urls: string[]; index: number } | null>(null);
  const stepTwoRef = useRef<HTMLParagraphElement | null>(null);
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
    if (bootPhase !== "ready") return;
    setActiveHeadline(0);
  }, [bootPhase]);

  useEffect(() => {
    if (bootPhase !== "ready") return;
    if (displayedProduct) return;
    if (heroCarousel.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setActiveHeadline((prev) => (prev + 1) % heroCarousel.length);
    }, 8400);
    return () => window.clearInterval(intervalId);
  }, [bootPhase, displayedProduct, heroCarousel.length]);

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

  const firstHeroImageUrl = useMemo(() => {
    const firstImage = heroMedia.find((item) => item.type === "image" && item.url);
    if (firstImage?.url) return firstImage.url;
    return fallbackHeroSlides[0];
  }, [heroMedia]);

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
  }, [bootPhase, configReady, heroSlidesReady]);

  useEffect(() => {
    if (bootPhase !== "loading") return;
    const hardTimeout = window.setTimeout(() => {
      setBootPhase("reveal");
    }, 3400);

    return () => {
      window.clearTimeout(hardTimeout);
    };
  }, [bootPhase]);

  useEffect(() => {
    if (bootPhase !== "reveal") return;
    const readyTimer = window.setTimeout(() => {
      setBootPhase("ready");
    }, 2100);

    return () => {
      window.clearTimeout(readyTimer);
    };
  }, [bootPhase]);

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
              const rawLink = String(entry.link_url || entry.url || "").trim();
              const categoryLink = resolveMenuFallbackLink(
                String(group?.slug || fallback.slug || "").trim(),
                label
              );
              return {
                label,
                iconUrl: absolutizeUrl(String(entry.icon_url || entry.icon || "").trim(), endpointOrigin) || fallbackItem.iconUrl || iconUrl,
                linkUrl: rawLink && !rawLink.startsWith("#") ? rawLink : categoryLink,
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

  function activateProductView(
    group: HeroMenuGroup,
    groupIndex: number,
    subItem: HeroMenuItem,
    options?: { updateUrl?: boolean },
  ) {
    const heroImages = heroMedia
      .filter((entry) => entry.type === "image" && entry.url)
      .map((entry) => entry.url);
    const gallery = [group.imageUrl, ...heroImages].filter((url, index, array) => url && array.indexOf(url) === index).slice(0, 8);
    const shareSlug = slugFromLink(subItem.linkUrl, subItem.label);
    const nextProduct: SelectedProductView = {
      groupIndex,
      groupSlug: group.slug,
      groupTitle: group.title,
      label: subItem.label,
      linkUrl: subItem.linkUrl,
      iconUrl: subItem.iconUrl || group.iconUrl,
      imageUrl: group.imageUrl,
      description: productDescription(subItem.label),
      reviews: [
        "Bardzo prosty proces zamówienia i świetne dopasowanie do okna.",
        "Na żywo wygląda dokładnie tak, jak na zdjęciach. Montaż bez problemu.",
        "Największy plus: szybka wycena i czytelne kroki konfiguracji.",
      ],
      gallery: gallery.length ? gallery : fallbackHeroSlides.slice(0, 4),
      shareSlug,
    };
    setSelectedProduct(nextProduct);
    setDisplayedProduct(nextProduct);
    window.requestAnimationFrame(() => {
      setIsProductView(true);
    });
    setActiveProductTab("opis");
    setActiveProductGallerySlide(0);
    setOpenMenuIndex(null);
    setMobileMenuOpen(false);
    if (options?.updateUrl !== false && typeof window !== "undefined") {
      const nextUrl = new URL(window.location.href);
      nextUrl.searchParams.set("produkt", shareSlug);
      window.history.pushState({ product: shareSlug }, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }
  }

  useEffect(() => {
    setActiveProductGallerySlide(0);
  }, [displayedProduct?.label]);

  useEffect(() => {
    if (selectedProduct) return;
    if (!displayedProduct) return;
    const timer = window.setTimeout(() => {
      setDisplayedProduct(null);
      setActiveProductTab("opis");
      setActiveProductGallerySlide(0);
      setSelectedHardwareId("");
    }, 340);
    return () => window.clearTimeout(timer);
  }, [displayedProduct, selectedProduct]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const activateFromUrl = () => {
      const current = new URL(window.location.href);
      const slug = (current.searchParams.get("produkt") || "").trim().toLowerCase();
      if (!slug) {
        setIsProductView(false);
        setSelectedProduct(null);
        return;
      }
      for (let groupIndex = 0; groupIndex < heroMenuGroups.length; groupIndex += 1) {
        const group = heroMenuGroups[groupIndex];
        for (const subItem of group.items) {
          const candidate = slugFromLink(subItem.linkUrl, subItem.label).toLowerCase();
          if (candidate === slug) {
            activateProductView(group, groupIndex, subItem, { updateUrl: false });
            return;
          }
        }
      }
    };

    activateFromUrl();
    const onPopState = () => activateFromUrl();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [heroMenuGroups]);

  const hardwareOptions = useMemo(
    () => hardwareOptionsForProduct(displayedProduct, config, endpointOrigin),
    [config, displayedProduct, endpointOrigin],
  );
  const selectedHardwareOption = useMemo(
    () => hardwareOptions.find((option) => option.id === selectedHardwareId) || hardwareOptions[0] || null,
    [hardwareOptions, selectedHardwareId],
  );

  useEffect(() => {
    if (!hardwareOptions.length) {
      setSelectedHardwareId("");
      setStepOneChosen(false);
      setStepOneCollapsed(false);
      setSelectedMeshId("");
      return;
    }
    if (selectedHardwareId && !hardwareOptions.some((option) => option.id === selectedHardwareId)) {
      setSelectedHardwareId("");
      setStepOneChosen(false);
      setStepOneCollapsed(false);
      setSelectedMeshId("");
    }
  }, [hardwareOptions, selectedHardwareId]);
  const selectedMesh = useMemo(
    () => MESH_OPTIONS.find((option) => option.id === selectedMeshId) || null,
    [selectedMeshId],
  );

  return (
    <div
      className={`home-root ${mobileMenuOpen ? "mobile-menu-open" : ""} boot-${bootPhase} ${displayedProduct ? "product-focus-active" : ""}`}
    >
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
              <img src={optimizeImageUrl(logoUrl, 240)} alt={siteTitle} className="brand-logo" />
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
          <ThemeToggle />
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
          <div
            className={`hero-slides ${heroSlidesReady ? "is-ready" : ""}`}
            aria-hidden="true"
            style={{ backgroundImage: `url(${optimizeImageUrl(firstHeroImageUrl, 2000, 70)})`, backgroundSize: "cover", backgroundPosition: "center" }}
          >
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
                    backgroundImage: `url(${optimizeImageUrl(media.url, 2000, 70)})`,
                  }}
                />
              ),
            )}
          </div>

          <div className="hero-dim" aria-hidden="true" />
          <div className="hero-grain" aria-hidden="true" />

          <div className={`hero-inner ${displayedProduct ? "product-mode" : ""}`}>
            <div className="hero-copy">
              <div className="hero-copy-content">
                <section className={`hero-home-content ${isProductView ? "is-hidden" : ""}`} aria-hidden={isProductView ? "true" : "false"}>
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
                </section>
                <section
                  className={`hero-product-panel ${isProductView ? "is-visible" : ""}`}
                  aria-live="polite"
                  aria-hidden={!displayedProduct || !isProductView ? "true" : "false"}
                >
                  <p className="hero-product-group">{displayedProduct?.groupTitle || ""}</p>
                  <h1>{displayedProduct?.label || ""}</h1>
                    <div className="hero-product-content">
                      {activeProductTab === "opis" && displayedProduct ? (
                        <p>{displayedProduct.description}</p>
                      ) : null}
                      {activeProductTab === "galeria" && displayedProduct ? (
                        <div className="hero-product-gallery">
                          <div className="hero-product-gallery-main">
                            <img
                              src={optimizeImageUrl(
                                displayedProduct.gallery[
                                  ((activeProductGallerySlide % displayedProduct.gallery.length) + displayedProduct.gallery.length) %
                                    displayedProduct.gallery.length
                                ],
                                900,
                              )}
                              alt={displayedProduct.label}
                              loading="eager"
                            />
                          </div>
                          <div className="hero-product-gallery-thumbs">
                            {displayedProduct.gallery.map((url, index) => (
                              <button
                                key={`${url}-${index}`}
                                type="button"
                                className={index === activeProductGallerySlide ? "is-active" : ""}
                                onClick={() => setActiveProductGallerySlide(index)}
                                aria-label={`Pokaż zdjęcie ${index + 1}`}
                              >
                                <img src={optimizeImageUrl(url, 160)} alt="" loading="lazy" />
                              </button>
                            ))}
                          </div>
                        </div>
                      ) : null}
                      {activeProductTab === "opinie" && displayedProduct ? (
                        <ul className="hero-product-reviews">
                          {displayedProduct.reviews.map((review) => (
                            <li key={review}>{review}</li>
                          ))}
                        </ul>
                      ) : null}
                      {activeProductTab === "instrukcje" && displayedProduct ? (
                        <ul className="hero-product-instructions">
                          {productInstructionSteps(displayedProduct.label).map((step) => (
                            <li key={step.title}>
                              <strong>{step.title}</strong>
                              <p>{step.body}</p>
                            </li>
                          ))}
                        </ul>
                      ) : null}
                    </div>
                  </section>
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
              className={`hero-menu-glass ${isProductView ? "is-hidden" : ""}`}
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
                      backgroundImage: `url(${optimizeImageUrl(item.imageUrl, 700)})`,
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
                        src={optimizeImageUrl(item.iconUrl, 80)}
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
                          onClick={(event) => {
                            if (
                              event.metaKey ||
                              event.ctrlKey ||
                              event.shiftKey ||
                              event.altKey
                            ) {
                              return;
                            }
                            event.preventDefault();
                            activateProductView(item, index, subItem);
                            if (window.matchMedia("(max-width: 760px)").matches) {
                              setMobileMenuOpen(false);
                              setOpenMenuIndex(null);
                            }
                          }}
                        >
                          <img
                            src={optimizeImageUrl(subItem.iconUrl, 64)}
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
            {displayedProduct ? (
              <aside
                className={`hero-product-config-panel ${isProductView ? "is-visible" : ""}`}
                aria-label="Konfigurator produktu"
              >
                <header>
                  <strong>Stwórz swoją moskitierę</strong>
                </header>
                <section className={`hero-product-step-accordion ${stepOneCollapsed ? "is-collapsed" : ""}`}>
                  <button
                    type="button"
                    className="hero-product-step-head"
                    onClick={() => setStepOneCollapsed((prev) => !prev)}
                    aria-expanded={stepOneCollapsed ? "false" : "true"}
                  >
                    <span className="hero-product-config-step-title">
                      <span className="hero-product-step-check" aria-hidden="true">✓</span>
                      Wybierz kolor profili
                    </span>
                    <span className="hero-product-step-head-meta">
                      {selectedHardwareOption ? <strong>{selectedHardwareOption.label}</strong> : null}
                      <span className="hero-product-step-head-chevron" aria-hidden="true">
                        {stepOneCollapsed ? "▾" : "▴"}
                      </span>
                    </span>
                  </button>
                  <div className="hero-product-step-body">
                    <div className="hardware-grid hardware-grid--visual hero-product-hardware-grid">
                      {hardwareOptions.map((option, index) => {
                        const isActive = option.id === selectedHardwareId;
                        const isLastSolo = hardwareOptions.length % 3 === 1 && index === hardwareOptions.length - 1;
                        return (
                          <div
                            key={option.id}
                            className={`hardware-card ${isActive ? "is-active" : ""} ${isLastSolo ? "is-last-solo" : ""}`}
                          >
                            <button
                              type="button"
                              className="hardware-card-main"
                              onClick={() => {
                                setSelectedHardwareId(option.id);
                                setStepOneCollapsed(true);
                                if (!stepOneChosen) {
                                  setStepOneChosen(true);
                                  window.setTimeout(() => {
                                    stepTwoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                                  }, 120);
                                }
                              }}
                            >
                              <span className="hardware-card-image" style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 220)})` }} />
                              {isActive ? <span className="hardware-selected-badge" aria-hidden="true">✓</span> : null}
                              <span className="hardware-card-footer">
                                <span className="hardware-dot" style={{ background: option.color }} />
                                <strong>{option.label}</strong>
                              </span>
                            </button>
                            <button
                              type="button"
                              className="config-option-zoom"
                              aria-label={`Powiększ: ${option.label}`}
                              onClick={() =>
                                setZoomPreview({
                                  title: option.label,
                                  urls: option.galleryUrls?.length ? option.galleryUrls : [option.imageUrl],
                                  index: 0,
                                })
                              }
                            >
                              🔍
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
                {stepOneChosen ? (
                  <>
                    <p ref={stepTwoRef} className="hero-product-config-step-title hero-product-config-step-title--muted">
                      <span className="hero-product-step-check is-muted" aria-hidden="true">2</span>
                      Dobierz kolor siatki
                    </p>
                    <div className="hero-product-mesh-grid">
                      {MESH_OPTIONS.map((option) => {
                        const isActive = option.id === selectedMeshId;
                        return (
                          <button
                            key={option.id}
                            type="button"
                            className={`hero-product-mesh-option ${isActive ? "is-active" : ""}`}
                            onClick={() => setSelectedMeshId(option.id)}
                          >
                            <span className="hardware-dot" style={{ background: option.color }} />
                            <strong>{option.label}</strong>
                          </button>
                        );
                      })}
                    </div>
                    <div className="hero-product-mini-summary">
                      <h3>Moskitiera okienna</h3>
                      <div className="hero-product-mini-summary-preview">
                        <img
                          src={optimizeImageUrl(selectedHardwareOption?.imageUrl || displayedProduct.imageUrl, 360)}
                          alt={selectedHardwareOption?.label || displayedProduct.label}
                          loading="lazy"
                        />
                      </div>
                      <dl>
                        <div>
                          <dt>Kolor profilu</dt>
                          <dd>{selectedHardwareOption?.label || "--"}</dd>
                        </div>
                        <div>
                          <dt>Kolor siatki</dt>
                          <dd>{selectedMesh?.label || "--"}</dd>
                        </div>
                        <div>
                          <dt>Rozmiar</dt>
                          <dd>--</dd>
                        </div>
                      </dl>
                      <div className="hero-product-mini-summary-price">
                        <p>Kalkulacja ceny</p>
                        <strong>17,90 zł</strong>
                      </div>
                    </div>
                  </>
                ) : (
                  <p className="hero-product-config-hint">Wybierz kolor profilu, aby przejść do kolejnego kroku.</p>
                )}
                {stepOneChosen ? (
                  <a href={displayedProduct.linkUrl}>Przejdź do konfiguratora</a>
                ) : null}
              </aside>
            ) : null}
            {displayedProduct ? (
              <button
                type="button"
                className={`hero-product-menu-toggle ${isProductView ? "is-visible" : ""}`}
                onClick={() => {
                  setIsProductView(false);
                  setSelectedProduct(null);
                  setOpenMenuIndex(displayedProduct.groupIndex);
                  if (typeof window !== "undefined") {
                    const nextUrl = new URL(window.location.href);
                    nextUrl.searchParams.delete("produkt");
                    window.history.pushState({}, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
                  }
                }}
                aria-label={`Pokaż listę produktów, obecnie: ${displayedProduct.label}`}
              >
                <span className="hero-product-menu-toggle-icon" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </span>
                <span className="hero-product-menu-toggle-text">
                  <small>Produkty</small>
                  <strong>{displayedProduct.label}</strong>
                </span>
              </button>
            ) : null}
          </div>
          {displayedProduct ? (
            <nav className={`hero-product-bottom-tabs ${isProductView ? "is-visible" : ""}`} aria-label="Sekcje produktu">
              <button
                type="button"
                className={activeProductTab === "opis" ? "is-active" : ""}
                onClick={() => setActiveProductTab("opis")}
              >
                Opis produktu
              </button>
              <button
                type="button"
                className={activeProductTab === "galeria" ? "is-active" : ""}
                onClick={() => setActiveProductTab("galeria")}
              >
                Galeria zdjęć
              </button>
              <button
                type="button"
                className={activeProductTab === "opinie" ? "is-active" : ""}
                onClick={() => setActiveProductTab("opinie")}
              >
                Opinie
              </button>
              <button
                type="button"
                className={activeProductTab === "instrukcje" ? "is-active" : ""}
                onClick={() => setActiveProductTab("instrukcje")}
              >
                Instrukcje
              </button>
            </nav>
          ) : null}
        </section>
      </main>
      {zoomPreview ? (
        <div
          className="config-option-preview-modal"
          role="dialog"
          aria-modal="true"
          aria-label={zoomPreview.title}
          onClick={() => setZoomPreview(null)}
        >
          <div className="config-option-preview-shell" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="config-option-preview-close"
              onClick={() => setZoomPreview(null)}
              aria-label="Zamknij podgląd"
            >
              ×
            </button>
            {zoomPreview.urls.length > 1 ? (
              <button
                type="button"
                className="config-option-preview-nav is-prev"
                aria-label="Poprzednie zdjęcie"
                onClick={() =>
                  setZoomPreview((prev) => {
                    if (!prev) return prev;
                    const nextIndex = (prev.index - 1 + prev.urls.length) % prev.urls.length;
                    return { ...prev, index: nextIndex };
                  })
                }
              >
                ‹
              </button>
            ) : null}
            {zoomPreview.urls.length > 1 ? (
              <button
                type="button"
                className="config-option-preview-nav is-next"
                aria-label="Następne zdjęcie"
                onClick={() =>
                  setZoomPreview((prev) => {
                    if (!prev) return prev;
                    const nextIndex = (prev.index + 1) % prev.urls.length;
                    return { ...prev, index: nextIndex };
                  })
                }
              >
                ›
              </button>
            ) : null}
            <img
              src={optimizeImageUrl(zoomPreview.urls[zoomPreview.index], 1200, 80)}
              alt={zoomPreview.title}
              className="config-option-preview-image"
              loading="eager"
            />
            <p>
              {zoomPreview.title}
              {zoomPreview.urls.length > 1 ? ` • ${zoomPreview.index + 1}/${zoomPreview.urls.length}` : ""}
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
