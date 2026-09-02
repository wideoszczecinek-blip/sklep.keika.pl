"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
// Light/dark toggle disabled for now (only one product live) - bring back
// once the whole shop is ready, see header-actions below.
// import ThemeToggle from "@/app/components/theme-toggle";
import { optimizeImageUrl } from "@/lib/image-optim";
import { MOSKITIERY_RAMKOWE_ALLEGRO_REVIEWS } from "./moskitiery-ramkowe-reviews-data";
import {
  type CartLineItem,
  type CartSummary,
  addCartItem,
  calcCartOversizeSurcharge,
  formatPln,
  readCartItems,
  summarizeCartItems,
} from "@/lib/cart";
import InfoModal from "./components/info-modal";

// The header mini-cart badge/total should show what the customer will
// actually pay, same as the cart page's own "Razem" row - which means
// including the one-time oversize-shipment surcharge on top of the item
// subtotal summarizeCartItems() gives on its own (see calcCartOversizeSurcharge).
function cartSummaryWithSurcharge(items: CartLineItem[]): CartSummary {
  const base = summarizeCartItems(items);
  return { ...base, total: base.total + calcCartOversizeSurcharge(items) };
}
import ConfiguratorPanel from "@/features/moskitiery-ramkowe/ConfiguratorPanel";
import {
  ALLEGRO_MOSKITIERY_HARDWARE,
  MESH_OPTIONS,
  MOSKITIERY_MESH_LAYER_URL,
  MOSKITIERY_PROFILE_DEFAULT_LAYER_URL,
  MOSKITIERY_RAMKOWE_PRICE_ON_PROMO,
  MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO,
  MOSKITIERY_RAMKOWE_PRICE_PER_MB_STANDARD,
  OVERSIZE_SURCHARGE_THRESHOLD_MM,
  OVERSIZE_TECHNICAL_LIMIT_MM,
  buildMoskLayerSurfaceStyle,
  moskBilledMeters,
  moskOversizeSurchargeForDimension,
  moskPerimeterMeters,
  type ConfiguratorResult,
  type HardwareOption,
  type MeshOption,
} from "@/features/moskitiery-ramkowe/shared";
import RoletyDachoweConfiguratorPanel from "@/features/rolety-dachowe/ConfiguratorPanel";
import {
  ROLETY_DACHOWE_STARTING_PRICE,
  type ConfiguratorResult as RoletyDachoweConfiguratorResult,
} from "@/features/rolety-dachowe/shared";

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

type HeroCarouselSlide = {
  eyebrow: string;
  title: string;
  subtitle: string;
};

type TopLink = {
  label: string;
  url: string;
};

// Maps a top-menu link's URL to the CRM legal-page slug it should open as a
// modal instead of navigating to. Anything not recognized here (external
// links, or a URL a CRM editor sets to something else entirely) still
// navigates normally.
const TOP_LINK_INFO_SLUGS: Record<string, string> = {
  "/regulamin": "regulamin",
  "/o-nas": "o-nas",
  "/kontakt": "kontakt",
  "/bezpieczenstwo": "bezpieczenstwo",
};

function resolveInfoSlug(url: string): string | null {
  const clean = url.split("?")[0].split("#")[0];
  if (TOP_LINK_INFO_SLUGS[clean]) return TOP_LINK_INFO_SLUGS[clean];
  const legalMatch = clean.match(/^\/legal\/([a-z0-9-]+)$/i);
  return legalMatch ? legalMatch[1] : null;
}

type ProductTabKey = "opis" | "galeria" | "opinie" | "instrukcje" | "faq";

type ProductInstructionStep = {
  title: string;
  body: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
};

type AllegroOfferRating = {
  averageScore: number;
  totalResponses: number;
  scoreDistribution: Array<{ stars: number; count: number }>;
};

type ProductLandingSection = {
  title: string;
  body: string;
};

type ProductFeatureBullet = {
  lead: string;
  detail?: string;
};

type ProductSpecItem = {
  label: string;
  value: string;
};

// Curated, non-redundant sales copy for moskitiery-ramkowe, written from the
// real Allegro listing content (profile material, mesh, mounting, color
// options) rather than the CRM's generic landing_sections, which repeated
// the same 2-3 facts across their 5 entries. Keep this grounded in real
// product facts only — do not add claims that aren't true for this product.
const MOSKITIERY_RAMKOWE_FEATURE_BULLETS: ProductFeatureBullet[] = [
  {
    lead: "Sztywny profil aluminiowy",
    detail: "nie odkształca się i utrzymuje równy naciąg siatki przez wiele sezonów",
  },
  {
    lead: "Docięte na wymiar",
    detail: "profile, siatka i uszczelka są przygotowane i opisane, gotowe do złożenia",
  },
  {
    lead: "Otwory pod zaczepy nawiercone wcześniej",
    detail: "właściwa średnica i rozstaw — nic nie trzeba dodatkowo mierzyć",
  },
  {
    lead: "Wzmocniona siatka z powlekanego włókna szklanego",
    detail: "skutecznie blokuje owady, nie ogranicza przy tym cyrkulacji powietrza",
  },
  {
    lead: "7 kolorów profilu w tej samej cenie",
    detail: "biały, antracyt, brąz, złoty dąb, orzech, winchester, mahoń",
  },
  {
    lead: "Siatka w kolorze szarym lub czarnym",
    detail: "do wyboru niezależnie od koloru profilu",
  },
  {
    lead: "Bezinwazyjne zaczepy sprężynowe",
    detail: "montaż bez wiercenia, bez ostrych krawędzi i bez mierzenia grubości ramy",
  },
];

const MOSKITIERY_RAMKOWE_SPEC_ITEMS: ProductSpecItem[] = [
  { label: "Rama", value: "Aluminium, 7 kolorów" },
  { label: "Siatka", value: "Wzmocniona, 2 kolory" },
  { label: "Montaż", value: "Bez wiercenia, zaczepy sprężynowe" },
  { label: "Złożenie", value: "Samodzielne, kilka–kilkanaście minut" },
];

// Small suggestive icons for moskitiery-ramkowe's own 4 spec labels only
// (keyed by the exact label text) - not a generic per-product icon system,
// since an arbitrary CRM-entered label has no reliable icon to infer. Any
// other product's spec grid (including a CRM-edited moskitiery-ramkowe one
// with different labels) simply renders without an icon.
function moskitieryRamkoweSpecIcon(label: string): React.ReactNode | null {
  const common = { viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;
  switch (label) {
    case "Rama":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.7" />
          <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.7" />
        </svg>
      );
    case "Siatka":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="2.5" stroke="currentColor" strokeWidth="1.7" />
          <line x1="9" y1="3" x2="9" y2="21" stroke="currentColor" strokeWidth="1.3" />
          <line x1="15" y1="3" x2="15" y2="21" stroke="currentColor" strokeWidth="1.3" />
          <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1.3" />
          <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1.3" />
        </svg>
      );
    case "Montaż":
      return (
        <svg {...common}>
          <path
            d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.24-3.24a6 6 0 0 1-7.93 7.93l-6.9 6.9a2.03 2.03 0 0 1-2.87-2.87l6.9-6.9a6 6 0 0 1 7.93-7.93L14.7 6.3z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "Złożenie":
      return (
        <svg {...common}>
          <rect x="3" y="3" width="18" height="18" rx="3" stroke="currentColor" strokeWidth="1.7" />
          <path d="M7 12.5l3 3 7-7.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    default:
      return null;
  }
}

// Real product photos, hosted on the CRM media store. Used for the
// moskitiery-ramkowe "Galeria zdjęć" tab instead of the generic
// hero-carousel fallback gallery. Order matches what a buyer expects to see
// first: the real Allegro listing thumbnail, then the one real "installed
// on an actual window" shot we have, then the own-photoshoot studio set.
const MOSKITIERY_RAMKOWE_GALLERY_PHOTOS: string[] = [
  "https://crm-keika.groovemedia.pl/storage/shop/media/moskitiery-ramkowe-galeria/moskitiera-okienna-allegro-miniaturka.jpg",
  "https://crm-keika.groovemedia.pl/storage/shop/media/20260327_214156_d5ad04b7_moskitiera-okienna.jpg",
  ...Array.from(
    { length: 57 },
    (_, index) =>
      `https://crm-keika.groovemedia.pl/storage/shop/media/moskitiery-ramkowe-galeria/moskitiera-okienna-${String(
        index + 1,
      ).padStart(2, "0")}.jpg`,
  ),
];

// rolety-dachowe (roof window blinds) - real content pulled from the same
// live CRM product record features/rolety-dachowe/shared.ts's options come
// from (configurator_public?slug=rolety-dachowe, fetched 2026-08-30), not
// invented. Only 2 real photos exist for this product (its Allegro
// catalog thumbnail and the "wybierz model okna" helper illustration) -
// deliberately not padded out with stock/placeholder photos.
const ROLETY_DACHOWE_GALLERY_PHOTOS: string[] = [
  "https://crm-keika.groovemedia.pl/storage/shop/media/20260327_214003_14dc8ed5_KONFIGURATOR-2.png",
  "https://crm-keika.groovemedia.pl/storage/shop/media/20260809_002723_40b6e7e0_A-7.webp",
];

const ROLETY_DACHOWE_FEATURE_BULLETS: ProductFeatureBullet[] = [
  {
    lead: "73 kolory tkaniny — Termo i Półprzepuszczalna Deko",
    detail: "Termo nie przepuszcza światła i dzięki powłoce termicznej na zewnątrz skutecznie zmniejsza nagrzewanie się pomieszczenia; Deko subtelnie rozprasza światło",
  },
  {
    lead: "3 kolory kasety i prowadnic",
    detail: "Anoda (srebrny), Biały i Jasna Sosna",
  },
  {
    lead: "Ponad 400 modeli okien w bibliotece",
    detail: "Velux, Fakro, Roto, OKPOL i inne — wybierz swój model, a rozmiar rolety dobierzemy automatycznie",
  },
  {
    lead: "Cena dobierana automatycznie z cennika",
    detail: `zależnie od koloru, materiału i rozmiaru — od ${ROLETY_DACHOWE_STARTING_PRICE.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł za sztukę`,
  },
  {
    lead: "Nie znalazłeś swojego modelu?",
    detail: "podaj własny wymiar (Wymiar A / Wymiar B) — roletę wykonamy na miarę",
  },
];

const ROLETY_DACHOWE_SPEC_ITEMS: ProductSpecItem[] = [
  { label: "Kaseta i prowadnice", value: "3 kolory: Anoda, Biały, Jasna Sosna" },
  { label: "Tkanina", value: "Termo (19) i Deko (54), 73 kolory łącznie" },
  { label: "Dopasowanie", value: "Pod model okna dachowego (biblioteka 400+ modeli)" },
  { label: "Cena", value: `od ${ROLETY_DACHOWE_STARTING_PRICE.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł / szt., zależnie od wymiaru` },
];

// Verbatim from the same CRM record's measurement_guide_sections - real
// instructions specific to this product, not the generic fallback.
const ROLETY_DACHOWE_INSTRUCTION_STEPS: ProductInstructionStep[] = [
  {
    title: "1. Zmierz szerokość",
    body: "Zmierz wymiar poziomy miejsca montażu od lewej do prawej krawędzi. Wpisz wynik w milimetrach. Pomiaru dokonaj dokładnie w widocznym - zaznaczonym miejscu - nie przy samej szybie tylko na rancie ramy, w miejscu gdzie będzie montowana roleta.",
  },
  {
    title: "2. Zmierz wysokość",
    body: "Zmierz wymiar pionowy od górnej do dolnej krawędzi miejsca montażu. Również wpisz wynik w milimetrach. Pomiaru również nie dokonuj przy szybie tylko w miejscach zaznaczonych - na rancie ramy.",
  },
  {
    title: "3. Albo po prostu wybierz model okna",
    body: "Zamiast ręcznego pomiaru możesz wyszukać swój model okna (Velux, Fakro, Roto, OKPOL i inne) w bibliotece ponad 400 modeli — rozmiar rolety dobierzemy automatycznie.",
  },
  {
    title: "4. Ważne: zaokrąglone listwy",
    body: "Te rolety nie będą kompatybilne z zaokrąglonymi listwami (jeżeli łuk jest minimalny - kilka milimetrów - roleta będzie pasować, natomiast przy oknach z typowo okrągłym profilem niestety nie).",
  },
];

type ProductCallout = {
  title: string;
  body: string;
};

type ProductFaqEntry = {
  question: string;
  answer: string;
};

type ProductReview = {
  author: string;
  stars: number;
  text: string;
  date: string;
};

type ProductLandingContent = {
  subtitle: string;
  description: string;
  priceFrom: string;
  badge: string;
  gallery: string[];
  sections: ProductLandingSection[];
  // CRM-editable description-tab content (Sklep WWW -> Produkty i
  // konfiguratory -> [produkt]). Empty arrays/fields mean "not set in CRM
  // yet" - the moskitiery-ramkowe/rolety-dachowe branches fall back to their
  // own built-in copy in that case; FAQ has no built-in fallback, it simply
  // doesn't render until the CRM has at least one entry.
  specItems: ProductSpecItem[];
  featureBullets: ProductFeatureBullet[];
  callout: ProductCallout | null;
  instructionSteps: ProductInstructionStep[];
  reviews: ProductReview[];
  faq: ProductFaqEntry[];
};

// Product slugs that have a real, live Allegro rating wired up (see
// allegro_offer_rating_public.php in the CRM). Everything else falls back to
// the generic placeholder review list further down.
const PRODUCT_SLUGS_WITH_ALLEGRO_RATING = new Set(["moskitiery-ramkowe"]);
const REVIEWS_PAGE_SIZE = 5;

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
  if (normalized.includes("rolet") && normalized.includes("dachow")) {
    return "Rolety dachowe dobierane pod model okna z biblioteki ponad 400 modeli — albo na własny wymiar, jeśli Twojego modelu nie ma na liście.";
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

// Instruction videos ship with zero native controls (no seek bar, no
// play/pause, nothing to click by accident) - fullscreen is the one
// interaction still offered, wired up by hand since removing the native
// controls bar also removes its built-in fullscreen button.
function requestInstructionVideoFullscreen(video: HTMLVideoElement | null): void {
  if (!video) return;
  const anyVideo = video as HTMLVideoElement & {
    webkitEnterFullscreen?: () => void;
    webkitRequestFullscreen?: () => void;
  };
  if (typeof anyVideo.webkitEnterFullscreen === "function") {
    // iOS Safari: only the video element itself can go fullscreen.
    anyVideo.webkitEnterFullscreen();
    return;
  }
  if (typeof video.requestFullscreen === "function") {
    video.requestFullscreen().catch(() => {});
    return;
  }
  if (typeof anyVideo.webkitRequestFullscreen === "function") {
    anyVideo.webkitRequestFullscreen();
  }
}

function productInstructionSteps(label: string): ProductInstructionStep[] {
  const normalized = normalizeMenuLabel(label);
  if (normalized.includes("moskitier")) {
    return MOSKITIERY_RAMKOWE_INSTRUCTION_STEPS;
  }
  if (normalized.includes("rolet") && normalized.includes("dachow")) {
    return ROLETY_DACHOWE_INSTRUCTION_STEPS;
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

// HardwareOption/MeshOption, ALLEGRO_MOSKITIERY_HARDWARE, MESH_OPTIONS, the
// layer-preview color helpers, moskitiery-ramkowe pricing and oversize
// constants/helpers now live in features/moskitiery-ramkowe/shared.ts
// (imported above) - shared with ConfiguratorPanel so the homepage and the
// cart's "Edytuj pozycję" modal use the exact same data and math, not two
// copies that can drift apart.

const DEFAULT_HARDWARE_COLORS: Array<{ id: string; label: string; color: string }> = [
  { id: "bialy", label: "Biały", color: "#EAECEF" },
  { id: "antracyt", label: "Antracyt", color: "#4A4F58" },
  { id: "braz", label: "Brąz", color: "#6F4B38" },
  { id: "zloty-dab", label: "Złoty dąb", color: "#B77B3E" },
  { id: "orzech", label: "Orzech", color: "#7A4F34" },
  { id: "winchester", label: "Winchester", color: "#B16D3D" },
  { id: "mahon", label: "Mahoń", color: "#6A2F27" },
];

// Paczkomat InPost only fits parcels where neither dimension exceeds this -
// used on /koszyk to decide whether to offer it at all.
const PACZKOMAT_MAX_DIMENSION_MM = 640;

// Business decision, not a data bug: 1-2 star counts are hidden entirely
// (zeroed), and the 3/4-star counts are trimmed by a fixed amount, before
// anything is shown or averaged - see displayRating above and the
// distribution bars render below, both of which call this.
function adjustedReviewCount(stars: number, count: number): number {
  if (stars <= 2) return 0;
  if (stars === 4) return Math.max(0, count - 5);
  if (stars === 3) return Math.max(0, count - 2);
  return count;
}

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

// Product gallery ("Galeria zdjęć"): a true circular coverflow, not a
// native horizontal scroller - scrolling from the last photo back to the
// first via native scroll-into-view would visibly rewind across every photo
// in between (jarring for the 59-photo moskitiery-ramkowe gallery
// especially). Instead this computes each rendered item's *signed shortest*
// distance from the active index around the loop (galleryCircularOffset)
// and only renders a small window of items near the active one
// (galleryVisibleIndices), each positioned/scaled purely by that offset via
// a CSS transform with its own transition - so index 0 sitting right next
// to the last index is just one short step in either direction, animated
// exactly like any other neighboring step, never a long rewind.
function galleryCircularOffset(index: number, active: number, total: number): number {
  if (total <= 0) return 0;
  let diff = (index - active) % total;
  if (diff > total / 2) diff -= total;
  if (diff < -total / 2) diff += total;
  return diff;
}

function galleryVisibleIndices(active: number, total: number, radius: number): number[] {
  if (total <= 0) return [];
  const count = Math.min(total, radius * 2 + 1);
  const half = Math.floor(count / 2);
  const indices: number[] = [];
  for (let offset = -half; offset <= count - half - 1; offset += 1) {
    indices.push(((active + offset) % total + total) % total);
  }
  return indices;
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
    return "/produkt/rolety-dachowe";
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
      { label: "Rolety do okien dachowych", iconUrl: iconInside, linkUrl: "/produkt/rolety-dachowe" },
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

/** Renders children through a portal to document.body on mobile, in place
 * otherwise. Needed for the "Dodano do koszyka!" overlay: it lives inside
 * .hero-product-config-panel, an ancestor that gets `transform` during its
 * own fade-in/out animation - which makes it the containing block for any
 * `position: fixed` descendant (a CSS rule, not a bug), so the overlay was
 * centering itself within that panel's box instead of the real viewport.
 * Portaling out to <body> escapes that entirely. Desktop deliberately stays
 * in place, inside the section - a full-viewport modal there read as an
 * unrelated popup (dead center, dimmed backdrop) instead of a confirmation
 * belonging to the configurator; its real (and only) bug was width, fixed
 * separately below in .hero-product-added-toast-overlay .hero-product-mini-summary-body.
 * useLayoutEffect (not useEffect) so the mobile check lands before paint -
 * this only ever mounts client-side (after "Dodaj do koszyka"), never
 * during SSR. */
function MobileOverlayPortal({ children }: { children: React.ReactNode }) {
  const [isMobile, setIsMobile] = useState(false);
  useLayoutEffect(() => {
    const mql = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener("change", update);
    return () => mql.removeEventListener("change", update);
  }, []);
  if (!isMobile) return <>{children}</>;
  return createPortal(children, document.body);
}

export default function Home() {
  const [config, setConfig] = useState<HomepageConfig | null>(null);
  const [configReady, setConfigReady] = useState(false);
  const [bootPhase, setBootPhase] = useState<"loading" | "reveal" | "ready">("loading");
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const menuCardRefs = useRef<Array<HTMLElement | null>>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [heroSlidesReady, setHeroSlidesReady] = useState(false);
  const [cartSummary, setCartSummary] = useState<CartSummary>({ items: 0, total: 0 });
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [cartDisplayTotal, setCartDisplayTotal] = useState(0);
  const [cartIsBumping, setCartIsBumping] = useState(false);
  const [cartIsFlashing, setCartIsFlashing] = useState(false);
  const [cartTooltipOpen, setCartTooltipOpen] = useState(false);
  const [addToCartToast, setAddToCartToast] = useState<{ productSlug: string; productLabel: string } | null>(null);
  // moskitiery-ramkowe now uses the shared <ConfiguratorPanel> (see
  // features/moskitiery-ramkowe/) - it owns its own step state internally,
  // so a fresh one is mounted by bumping this key (e.g. "wyceń nową"), and
  // ramkoweLastResult lets "wyceń podobną" re-seed it with the same
  // hardware/mesh but blank dimensions.
  const [ramkoweConfigKey, setRamkoweConfigKey] = useState(0);
  const [ramkoweLastResult, setRamkoweLastResult] = useState<ConfiguratorResult | null>(null);
  // Same pattern as ramkoweConfigKey/ramkoweLastResult above, for
  // rolety-dachowe's own <ConfiguratorPanel> (features/rolety-dachowe/).
  const [rdConfigKey, setRdConfigKey] = useState(0);
  const [rdLastResult, setRdLastResult] = useState<RoletyDachoweConfiguratorResult | null>(null);
  const cartCountUpFrameRef = useRef<number | null>(null);
  const [activeHeadline, setActiveHeadline] = useState(0);
  const [topMenuOpen, setTopMenuOpen] = useState(false);
  // The "Produkty / <current product>" pill in the header, shown while on a
  // product page. Used to just navigate straight back to the homepage grid
  // (isProductView=false) - jarring, since it looked like it should just
  // open a small menu in place. Now it opens a compact flyout with the same
  // categories/products as the homepage grid; picking one switches products
  // directly via activateProductView without ever leaving product view.
  const [productMenuOpen, setProductMenuOpen] = useState(false);
  // Menu links for a known CRM legal page (regulamin, o-nas, kontakt,
  // bezpieczenstwo, ...) open in place as a modal instead of navigating away.
  const [infoModalSlug, setInfoModalSlug] = useState<string | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<SelectedProductView | null>(null);
  const [displayedProduct, setDisplayedProduct] = useState<SelectedProductView | null>(null);
  const [isProductView, setIsProductView] = useState(false);
  // Opis/Galeria/Opinie/Instrukcje are one continuous stacked page now, not
  // a tab-switcher - activeProductTab still exists, just repurposed to drive
  // which nav pill is highlighted (via the scroll-spy effect below) instead
  // of which content is rendered.
  const [activeProductTab, setActiveProductTab] = useState<ProductTabKey>("opis");
  const opisSectionRef = useRef<HTMLElement | null>(null);
  const galeriaSectionRef = useRef<HTMLElement | null>(null);
  const opinieSectionRef = useRef<HTMLElement | null>(null);
  const instrukcjeSectionRef = useRef<HTMLElement | null>(null);
  const faqSectionRef = useRef<HTMLElement | null>(null);
  const productSectionRefs = useMemo<Record<ProductTabKey, React.RefObject<HTMLElement | null>>>(
    () => ({
      opis: opisSectionRef,
      galeria: galeriaSectionRef,
      opinie: opinieSectionRef,
      faq: faqSectionRef,
      instrukcje: instrukcjeSectionRef,
    }),
    [],
  );

  // Mobile: .hero-full scrolls internally, so a plain scrollIntoView isn't
  // reliable (same reasoning as the configurator's own step transitions and
  // the "Konfiguruj" shortcut). Desktop: .hero-full scrolls too now that the
  // four sections are stacked instead of tab-switched, same computation
  // works for both.
  function scrollToProductSection(key: ProductTabKey) {
    const target = productSectionRefs[key]?.current;
    if (!target) return;
    const container = target.closest<HTMLElement>(".hero-full");
    if (container && container.scrollHeight > container.clientHeight) {
      const containerRect = container.getBoundingClientRect();
      const targetRect = target.getBoundingClientRect();
      const delta = targetRect.top - containerRect.top - 96;
      const nextTop = Math.max(
        0,
        Math.min(container.scrollTop + delta, container.scrollHeight - container.clientHeight),
      );
      container.scrollTo({ top: nextTop, behavior: "smooth" });
    } else {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  // Scroll-spy: highlights whichever section's top has most recently
  // crossed the "just under the header" line as the active nav pill.
  useEffect(() => {
    if (!isProductView) return;
    const container = opisSectionRef.current?.closest<HTMLElement>(".hero-full");
    const sections: Array<[ProductTabKey, HTMLElement | null]> = [
      ["opis", opisSectionRef.current],
      ["galeria", galeriaSectionRef.current],
      ["opinie", opinieSectionRef.current],
      ["faq", faqSectionRef.current],
      ["instrukcje", instrukcjeSectionRef.current],
    ];
    const validSections = sections.filter((entry): entry is [ProductTabKey, HTMLElement] => Boolean(entry[1]));
    if (!validSections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible.length === 0) return;
        const key = validSections.find(([, el]) => el === visible[0].target)?.[0];
        if (key) setActiveProductTab(key);
      },
      {
        root: container ?? null,
        // A band starting just under the fixed header, ending well before
        // the bottom - a section counts as "active" once its top has
        // crossed into that band, not merely because any sliver is visible.
        rootMargin: "-110px 0px -70% 0px",
        threshold: 0,
      },
    );
    validSections.forEach(([, el]) => observer.observe(el));
    return () => observer.disconnect();
  }, [isProductView, displayedProduct]);

  // Light theme is now applied unconditionally in app/layout.tsx's blocking
  // head script (before first paint, no flash) - no longer needed here.
  const [activeProductGallerySlide, setActiveProductGallerySlide] = useState(0);
  // Swipe-to-navigate for the gallery coverflow (see galleryCircularOffset/
  // galleryVisibleIndices below) - it's no longer a native horizontal
  // scroller (that's what made the true circular loop possible: a scroll
  // container can't jump from the last photo to the first without visibly
  // rewinding through everything between), so touch/drag has to be handled
  // by hand instead of coming for free with overflow-x:auto. Plain refs,
  // not state - this only needs to be read on pointerup, never drives a
  // render while dragging.
  const gallerySwipeStartXRef = useRef<number | null>(null);
  const gallerySwipeSuppressClickRef = useRef(false);
  const [selectedHardwareId, setSelectedHardwareId] = useState("");
  const [stepOneChosen, setStepOneChosen] = useState(false);
  const [stepOneCollapsed, setStepOneCollapsed] = useState(false);
  const [stepTwoCollapsed, setStepTwoCollapsed] = useState(false);
  const [selectedMeshId, setSelectedMeshId] = useState("");
  const [zoomPreview, setZoomPreview] = useState<{ title: string; urls: string[]; index: number } | null>(null);
  const [allegroRating, setAllegroRating] = useState<AllegroOfferRating | null>(null);
  const [allegroRatingLoading, setAllegroRatingLoading] = useState(false);
  // Average/total shown to customers exclude 1-2 star ratings by design (the
  // distribution rows for 1-2 stars are still shown, but zeroed out - see
  // the "opinie" tab render below), and the 3/4-star counts are trimmed by a
  // fixed amount too (business decision). Recomputed from the real
  // distribution, not just re-labeled - see adjustedReviewCount below, used
  // identically here and in the distribution bars render.
  const displayRating = useMemo(() => {
    if (!allegroRating) return null;
    const kept = allegroRating.scoreDistribution
      .filter((entry) => entry.stars >= 3)
      .map((entry) => ({ stars: entry.stars, count: adjustedReviewCount(entry.stars, entry.count) }));
    const total = kept.reduce((sum, entry) => sum + entry.count, 0);
    const weightedSum = kept.reduce((sum, entry) => sum + entry.stars * entry.count, 0);
    return {
      averageScore: total > 0 ? weightedSum / total : allegroRating.averageScore,
      totalResponses: total,
    };
  }, [allegroRating]);
  const [visibleReviewCount, setVisibleReviewCount] = useState(REVIEWS_PAGE_SIZE);
  const [reviewStarFilter, setReviewStarFilter] = useState<number | null>(null);
  const [productLanding, setProductLanding] = useState<ProductLandingContent | null>(null);
  // Standalone modal for a single instruction step - same content as the
  // inline accordion in the Instrukcje section, but addressable from
  // anywhere on the site via a URL hash (#instrukcja-1, #instrukcja-2, ...)
  // so other parts of the page/site can link straight to one specific step
  // without needing to know about this component's internals.
  const [instructionModalIndex, setInstructionModalIndex] = useState<number | null>(null);
  // Instruction videos autoplay the instant their accordion row opens (and
  // pause + rewind the instant it closes) instead of relying on the
  // <video autoplay> heuristic, which only fires once on mount and doesn't
  // reliably re-trigger as a <details> element is toggled shut/open. One
  // ref per step, keyed by index.
  const instructionVideoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const instructionModalVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeInstructionSteps = useMemo<ProductInstructionStep[]>(() => {
    if (productLanding?.instructionSteps?.length) return productLanding.instructionSteps;
    if (!displayedProduct) return [];
    return productInstructionSteps(displayedProduct.label);
  }, [productLanding, displayedProduct]);

  // Deep-link support: any link anywhere (this page or elsewhere on the
  // site) pointing at #instrukcja-N opens that instruction step (1-indexed)
  // straight into the standalone modal, without needing to wire up a click
  // handler at the link's own location.
  useEffect(() => {
    const applyHash = () => {
      const match = /^#instrukcja-(\d+)$/.exec(window.location.hash);
      if (!match) return;
      const index = Number(match[1]) - 1;
      if (index >= 0 && index < activeInstructionSteps.length) {
        setInstructionModalIndex(index);
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [activeInstructionSteps]);
  const [dimensionWidth, setDimensionWidth] = useState("");
  const [dimensionHeight, setDimensionHeight] = useState("");
  const [dimensionQuantity, setDimensionQuantity] = useState("1");
  const [isCalculatingPrice, setIsCalculatingPrice] = useState(false);
  const [surchargeModal, setSurchargeModal] = useState<{ amount: number } | null>(null);
  const [acceptedSurcharge, setAcceptedSurcharge] = useState<{ width: number; height: number; amount: number } | null>(
    null,
  );
  const stepTwoRef = useRef<HTMLButtonElement | null>(null);
  const stepThreeRef = useRef<HTMLParagraphElement | null>(null);

  useEffect(() => {
    setDimensionWidth("");
    setDimensionHeight("");
    setDimensionQuantity("1");
    setAddToCartToast(null);
    setRamkoweLastResult(null);
    setRamkoweConfigKey((key) => key + 1);
  }, [displayedProduct]);

  // Meta ViewContent - gdy klient wchodzi w widok konkretnego produktu.
  // Homepage jest SPA (widok produktu to stan + pushState, nie route), więc
  // to jest właściwy moment na ViewContent zamiast PageView per-URL.
  const viewContentSlug = productSlugFromSelected(displayedProduct);
  useEffect(() => {
    if (!isProductView || !viewContentSlug) return;
    void import("@/lib/tracking")
      .then(({ track }) => {
        track("ViewContent", {
          content_ids: [viewContentSlug],
          content_name: displayedProduct?.label || viewContentSlug,
          content_type: "product",
        });
      })
      .catch(() => {});
  }, [isProductView, viewContentSlug, displayedProduct?.label]);

  useEffect(() => {
    const slug = productSlugFromSelected(displayedProduct);
    if (!slug) {
      setProductLanding(null);
      return;
    }
    let cancelled = false;
    fetch(
      `https://crm-keika.groovemedia.pl/biuro/api/shop-public/product?slug=${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        const product = data?.ok ? data.product : null;
        if (!product) {
          setProductLanding(null);
          return;
        }
        const sections = Array.isArray(product.landing_sections)
          ? product.landing_sections
              .map((entry: { title?: string; body?: string }) => ({
                title: String(entry?.title || "").trim(),
                body: String(entry?.body || "").trim(),
              }))
              .filter((entry: ProductLandingSection) => entry.title || entry.body)
          : [];
        const specItems: ProductSpecItem[] = Array.isArray(product.spec_items)
          ? product.spec_items
              .map((entry: { label?: string; value?: string }) => ({
                label: String(entry?.label || "").trim(),
                value: String(entry?.value || "").trim(),
              }))
              .filter((entry: ProductSpecItem) => entry.label || entry.value)
          : [];
        const featureBullets: ProductFeatureBullet[] = Array.isArray(product.feature_bullets)
          ? product.feature_bullets
              .map((entry: { lead?: string; detail?: string }) => ({
                lead: String(entry?.lead || "").trim(),
                detail: String(entry?.detail || "").trim(),
              }))
              .filter((entry: ProductFeatureBullet) => entry.lead || entry.detail)
          : [];
        const calloutRaw = product.callout;
        const callout: ProductCallout | null =
          calloutRaw && (String(calloutRaw.title || "").trim() || String(calloutRaw.body || "").trim())
            ? { title: String(calloutRaw.title || "").trim(), body: String(calloutRaw.body || "").trim() }
            : null;
        const instructionSteps: ProductInstructionStep[] = Array.isArray(product.instruction_steps)
          ? product.instruction_steps
              .map((entry: { title?: string; body?: string; media_url?: string; media_type?: string }) => ({
                title: String(entry?.title || "").trim(),
                body: String(entry?.body || "").trim(),
                mediaUrl: String(entry?.media_url || "").trim(),
                mediaType: entry?.media_type === "video" ? ("video" as const) : ("image" as const),
              }))
              .filter((entry: ProductInstructionStep) => entry.title || entry.body || entry.mediaUrl)
          : [];
        const reviews: ProductReview[] = Array.isArray(product.reviews)
          ? product.reviews
              .map((entry: { author?: string; stars?: number; text?: string; date?: string }) => ({
                author: String(entry?.author || "").trim(),
                stars: Math.min(5, Math.max(1, Number(entry?.stars) || 5)),
                text: String(entry?.text || "").trim(),
                date: String(entry?.date || "").trim(),
              }))
              .filter((entry: ProductReview) => entry.text)
          : [];
        const faq: ProductFaqEntry[] = Array.isArray(product.faq)
          ? product.faq
              .map((entry: { question?: string; answer?: string }) => ({
                question: String(entry?.question || "").trim(),
                answer: String(entry?.answer || "").trim(),
              }))
              .filter((entry: ProductFaqEntry) => entry.question && entry.answer)
          : [];
        setProductLanding({
          subtitle: String(product.subtitle || "").trim(),
          description: String(product.description || "").trim(),
          priceFrom: String(product.price_from || "").trim(),
          badge: String(product.badge || "").trim(),
          gallery: Array.isArray(product.gallery_urls)
            ? product.gallery_urls.filter((url: unknown): url is string => typeof url === "string" && url.trim() !== "")
            : [],
          sections,
          specItems,
          featureBullets,
          callout,
          instructionSteps,
          reviews,
          faq,
        });
      })
      .catch(() => {
        if (!cancelled) setProductLanding(null);
      });
    return () => {
      cancelled = true;
    };
  }, [displayedProduct]);

  useEffect(() => {
    const slug = productSlugFromSelected(displayedProduct);
    setVisibleReviewCount(REVIEWS_PAGE_SIZE);
    if (!slug || !PRODUCT_SLUGS_WITH_ALLEGRO_RATING.has(slug)) {
      setAllegroRating(null);
      return;
    }
    let cancelled = false;
    setAllegroRatingLoading(true);
    fetch(
      `https://crm-keika.groovemedia.pl/biuro/api/shop/allegro_offer_rating_public.php?slug=${encodeURIComponent(slug)}`,
      { cache: "no-store" },
    )
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.ok && data.rating) {
          setAllegroRating({
            averageScore: Number(data.rating.average_score) || 0,
            totalResponses: Number(data.rating.total_responses) || 0,
            scoreDistribution: Array.isArray(data.rating.score_distribution)
              ? data.rating.score_distribution.map((entry: { stars: number; count: number }) => ({
                  stars: Number(entry.stars) || 0,
                  count: Number(entry.count) || 0,
                }))
              : [],
          });
        } else {
          setAllegroRating(null);
        }
      })
      .catch(() => {
        if (!cancelled) setAllegroRating(null);
      })
      .finally(() => {
        if (!cancelled) setAllegroRatingLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [displayedProduct]);

  const defaultConfigEndpoint = "https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public";
  const configEndpoint = process.env.NEXT_PUBLIC_CRM_SHOP_CONFIG_URL || defaultConfigEndpoint;
  const configHashRef = useRef("");
  const heroMenuRef = useRef<HTMLElement | null>(null);
  const topMenuRef = useRef<HTMLDivElement | null>(null);
  const productMenuFlyoutRef = useRef<HTMLDivElement | null>(null);

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

      const productMenuRoot = productMenuFlyoutRef.current;
      if (productMenuRoot && !productMenuRoot.contains(target)) {
        setProductMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, []);

  // Mobile: .hero-menu-glass is a bottom-anchored floating panel with its
  // own capped height + internal scroll (see the mobile media query), not a
  // full-screen sheet - opening a category's accordion list can land it
  // mostly below that panel's own visible area with no way to tell without
  // scrolling first. Bring the just-opened card's head to the top of the
  // panel automatically, same idea as the product-section scroll-spy above.
  //
  // The list reveals itself via a CSS max-height transition (see
  // .hero-menu-card-list.is-open, 0.58s), so the panel's true scrollHeight
  // only grows gradually, frame by frame, as that plays out - waiting for
  // it to finish before scrolling once (an earlier version of this effect)
  // made the list visibly pop open first and only jump into place after a
  // pause. Instead, re-measure and nudge scrollTop every animation frame
  // for the same duration, so the compensating scroll grows in lockstep
  // with the content instead of trailing behind it.
  useEffect(() => {
    if (openMenuIndex === null) return;
    const card = menuCardRefs.current[openMenuIndex];
    const container = heroMenuRef.current;
    if (!card || !container) return;

    let rafId = 0;
    const start = performance.now();
    const tick = () => {
      if (container.scrollHeight > container.clientHeight) {
        const containerRect = container.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const delta = cardRect.top - containerRect.top;
        const nextTop = Math.max(
          0,
          Math.min(container.scrollTop + delta, container.scrollHeight - container.clientHeight),
        );
        container.scrollTop = nextTop;
      }
      if (performance.now() - start < 650) {
        rafId = requestAnimationFrame(tick);
      }
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [openMenuIndex]);

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
    const syncCart = () => {
      const items = readCartItems();
      setCartItems(items);
      setCartSummary(cartSummaryWithSurcharge(items));
    };
    syncCart();
    window.addEventListener("storage", syncCart);
    window.addEventListener("focus", syncCart);
    window.addEventListener("keika-cart-updated", syncCart);
    return () => {
      window.removeEventListener("storage", syncCart);
      window.removeEventListener("focus", syncCart);
      window.removeEventListener("keika-cart-updated", syncCart);
    };
  }, []);

  // Animate the header cart total counting up to its new value whenever it
  // increases (adding an item), then a brief green "flash" once it lands.
  useEffect(() => {
    if (cartCountUpFrameRef.current) {
      window.cancelAnimationFrame(cartCountUpFrameRef.current);
      cartCountUpFrameRef.current = null;
    }
    const target = cartSummary.total;
    if (target <= cartDisplayTotal) {
      setCartDisplayTotal(target);
      return;
    }
    const start = cartDisplayTotal;
    const startedAt = performance.now();
    const duration = 650;
    const step = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setCartDisplayTotal(start + (target - start) * eased);
      if (progress < 1) {
        cartCountUpFrameRef.current = window.requestAnimationFrame(step);
      } else {
        setCartDisplayTotal(target);
        setCartIsFlashing(true);
        window.setTimeout(() => setCartIsFlashing(false), 700);
      }
    };
    cartCountUpFrameRef.current = window.requestAnimationFrame(step);
    return () => {
      if (cartCountUpFrameRef.current) window.cancelAnimationFrame(cartCountUpFrameRef.current);
    };
    // Only re-run when the real total changes - cartDisplayTotal itself is
    // the thing being animated, not a dependency to react to.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSummary.total]);

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
    // On mobile .hero-full scrolls internally (the configurator has far more
    // content than one screen) - without this, opening a product while
    // already scrolled down in it (or in the previous product) would land
    // the customer mid-page instead of at the top of the new panel.
    document.querySelector(".hero-full")?.scrollTo({ top: 0, behavior: "auto" });
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
  const meshChosen = Boolean(selectedMeshId);
  const widthNum = Number(dimensionWidth) || 0;
  const heightNum = Number(dimensionHeight) || 0;
  const quantityNum = Math.max(1, Number(dimensionQuantity) || 1);
  const hasValidDimensions = widthNum > 0 && heightNum > 0;
  const perimeterMeters = hasValidDimensions ? moskPerimeterMeters(widthNum, heightNum) : null;
  const billedMeters = perimeterMeters !== null ? moskBilledMeters(perimeterMeters) : null;
  const dimensionUnitPrice = billedMeters !== null ? billedMeters * MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO : null;
  const dimensionTotalPrice = dimensionUnitPrice !== null ? dimensionUnitPrice * quantityNum : null;

  useEffect(() => {
    if (!hasValidDimensions) {
      setIsCalculatingPrice(false);
      return;
    }
    setIsCalculatingPrice(true);
    const timer = window.setTimeout(() => setIsCalculatingPrice(false), 700);
    return () => window.clearTimeout(timer);
    // Re-runs (and re-shows "Obliczam...") whenever the actual inputs to the
    // calculation change, not on every render.
  }, [hasValidDimensions, widthNum, heightNum, quantityNum]);

  const bothDimensionsOverTechnicalLimit =
    widthNum > OVERSIZE_TECHNICAL_LIMIT_MM && heightNum > OVERSIZE_TECHNICAL_LIMIT_MM;
  const requiredSurchargeForCurrentDims = hasValidDimensions
    ? moskOversizeSurchargeForDimension(Math.max(widthNum, heightNum))
    : 0;
  const surchargeSatisfied =
    requiredSurchargeForCurrentDims <= 0 ||
    (acceptedSurcharge !== null && acceptedSurcharge.width === widthNum && acceptedSurcharge.height === heightNum);
  const dimensionsBlocked = bothDimensionsOverTechnicalLimit || requiredSurchargeForCurrentDims < 0 || !surchargeSatisfied;
  const activeSurchargeAmount = surchargeSatisfied && requiredSurchargeForCurrentDims > 0 ? requiredSurchargeForCurrentDims : 0;

  function handleDimensionBlur() {
    if (!hasValidDimensions) return;
    if (widthNum > OVERSIZE_TECHNICAL_LIMIT_MM && heightNum > OVERSIZE_TECHNICAL_LIMIT_MM) {
      return; // shown inline near the inputs, nothing to revert here
    }
    const maxDim = Math.max(widthNum, heightNum);
    const required = moskOversizeSurchargeForDimension(maxDim);
    if (required <= 0) {
      if (acceptedSurcharge) setAcceptedSurcharge(null);
      return;
    }
    if (acceptedSurcharge && acceptedSurcharge.width === widthNum && acceptedSurcharge.height === heightNum) {
      return;
    }
    if (required < 0) {
      return; // inline "za duży wymiar" message handles this case
    }
    setSurchargeModal({ amount: required });
  }

  function handleAcceptSurcharge() {
    if (!surchargeModal) return;
    setAcceptedSurcharge({ width: widthNum, height: heightNum, amount: surchargeModal.amount });
    setSurchargeModal(null);
  }

  function handleDeclineSurcharge() {
    if (widthNum > OVERSIZE_SURCHARGE_THRESHOLD_MM) setDimensionWidth("");
    if (heightNum > OVERSIZE_SURCHARGE_THRESHOLD_MM) setDimensionHeight("");
    setSurchargeModal(null);
  }

  function handleAddToCart() {
    if (!displayedProduct || dimensionUnitPrice === null || dimensionTotalPrice === null) return;
    if (dimensionsBlocked) return;
    const slug = productSlugFromSelected(displayedProduct);
    const item: CartLineItem = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      productSlug: slug,
      productLabel: displayedProduct.label,
      hardwareLabel: selectedHardwareOption?.label || "",
      meshLabel: selectedMesh?.label || "",
      widthMm: widthNum,
      heightMm: heightNum,
      qty: quantityNum,
      price: dimensionUnitPrice,
      total: dimensionTotalPrice,
      imageUrl: selectedHardwareOption?.imageUrl,
      createdAt: new Date().toISOString(),
      oversizeSurchargeAmount: activeSurchargeAmount,
    };
    const items = addCartItem(item);
    setCartItems(items);
    setCartSummary(cartSummaryWithSurcharge(items));
    setCartIsBumping(true);
    window.setTimeout(() => setCartIsBumping(false), 500);
    setAddToCartToast({ productSlug: slug, productLabel: displayedProduct.label });
  }

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
              {topLinks.map((entry) => {
                const infoSlug = resolveInfoSlug(entry.url);
                return infoSlug ? (
                  <button
                    key={`${entry.label}-${entry.url}`}
                    type="button"
                    className="top-link-button"
                    onClick={() => {
                      setTopMenuOpen(false);
                      setInfoModalSlug(infoSlug);
                    }}
                  >
                    {entry.label}
                  </button>
                ) : (
                  <a
                    key={`${entry.label}-${entry.url}`}
                    href={entry.url}
                    onClick={() => setTopMenuOpen(false)}
                  >
                    {entry.label}
                  </a>
                );
              })}
            </nav>
          </div>
        </div>
        <div className="header-actions">
          {displayedProduct ? (
            <div
              className={`hero-product-menu-flyout-wrap ${productMenuOpen ? "is-open" : ""}`}
              ref={productMenuFlyoutRef}
            >
              <button
                type="button"
                className={`hero-product-menu-toggle ${isProductView ? "is-visible" : ""}`}
                onClick={() => setProductMenuOpen((prev) => !prev)}
                aria-expanded={productMenuOpen ? "true" : "false"}
                aria-controls="hero-product-menu-flyout"
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
              <div id="hero-product-menu-flyout" className="hero-product-menu-flyout" aria-label="Wybierz produkt">
                {heroMenuGroups.map((group, groupIndex) => (
                  <div key={group.title} className="hero-product-menu-flyout-group">
                    <p className="hero-product-menu-flyout-group-title">{group.title}</p>
                    <ul>
                      {group.items.map((subItem) => (
                        <li key={`${group.title}-${subItem.label}`}>
                          <a
                            href={subItem.linkUrl}
                            className={subItem.label === displayedProduct.label ? "is-current" : ""}
                            onClick={(event) => {
                              if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
                                return;
                              }
                              event.preventDefault();
                              setProductMenuOpen(false);
                              if (subItem.label === displayedProduct.label) return;
                              activateProductView(group, groupIndex, subItem);
                            }}
                          >
                            <img
                              src={optimizeImageUrl(subItem.iconUrl, 64)}
                              alt=""
                              className="hero-product-menu-flyout-icon"
                              loading="lazy"
                            />
                            {subItem.label}
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
          {/* Light/dark toggle disabled for now (only one product live) -
              bring back once the whole shop is ready. */}
          {/* <ThemeToggle /> */}
          <a className="phone" href={`tel:${contactPhone.replace(/\s+/g, "")}`}>
            {contactPhone}
          </a>
          <div
            className="header-cart-wrap"
            onMouseEnter={() => setCartTooltipOpen(true)}
            onMouseLeave={() => setCartTooltipOpen(false)}
          >
            <a
              className={`header-cart ${hasCartItems ? "has-items" : "is-empty"} ${cartIsBumping ? "is-bumping" : ""}`}
              href="/koszyk"
              aria-label={hasCartItems ? `Koszyk: ${cartQtyLabel}, ${formatPln(cartSummary.total)}` : "Koszyk jest pusty"}
            >
              <span className="header-cart-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M3 4h2l1.6 9.6a2 2 0 0 0 2 1.65h8.2a2 2 0 0 0 1.96-1.6L20 8H6"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <circle cx="9" cy="19.5" r="1.4" fill="currentColor" />
                  <circle cx="17" cy="19.5" r="1.4" fill="currentColor" />
                </svg>
                {hasCartItems ? <span className="header-cart-badge">{cartSummary.items}</span> : null}
              </span>
              {hasCartItems ? (
                <span className="header-cart-copy">
                  <strong className={cartIsFlashing ? "is-flashing" : ""}>{formatPln(cartDisplayTotal)}</strong>
                  <small>{cartQtyLabel}</small>
                </span>
              ) : (
                <span className="header-cart-copy">
                  <small>Koszyk</small>
                </span>
              )}
            </a>
            {cartTooltipOpen && hasCartItems ? (
              <div className="header-cart-tooltip" role="tooltip">
                <ul>
                  {cartItems.slice(-4).reverse().map((item) => (
                    <li key={item.id}>
                      <span>
                        {item.productLabel}
                        {item.widthMm && item.heightMm ? ` ${item.widthMm}×${item.heightMm} mm` : ""}
                        {item.qty > 1 ? ` × ${item.qty}` : ""}
                      </span>
                      <strong>{formatPln(item.total)}</strong>
                    </li>
                  ))}
                  {cartItems.length > 4 ? <li className="header-cart-tooltip-more">i {cartItems.length - 4} więcej…</li> : null}
                </ul>
                <div className="header-cart-tooltip-total">
                  <span>Razem</span>
                  <strong>{formatPln(cartSummary.total)}</strong>
                </div>
                <a href="/koszyk" className="header-cart-tooltip-cta">
                  Przejdź do koszyka
                </a>
              </div>
            ) : null}
          </div>
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
          {/* Product-view-only alternative background, tried in place of the
              photo/video hero-slides above (hidden via CSS in product view -
              see .home-root.product-focus-active .hero-slides/.hero-dim/
              .hero-grain in globals.css - not removed, so this is a one-line
              flip back if it doesn't work out). Pure CSS, no state. */}
          <div className="hero-product-gradient-bg" aria-hidden="true" />

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
                      <section id="product-section-opis" ref={opisSectionRef} className="hero-product-section">
                      {displayedProduct ? (
                        productSlugFromSelected(displayedProduct) === "moskitiery-ramkowe" ? (
                          <div className="pl-landing">
                            <div className="pl-trust-row">
                              <span className="pl-price">
                                <span className="price-per-mb-promo">
                                  {MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO.toLocaleString("pl-PL", {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2,
                                  })}{" "}
                                  zł
                                </span>
                                <span className="pl-price-unit"> / mb</span>
                                {MOSKITIERY_RAMKOWE_PRICE_ON_PROMO ? (
                                  <span className="price-per-mb-standard">
                                    {MOSKITIERY_RAMKOWE_PRICE_PER_MB_STANDARD.toLocaleString("pl-PL", {
                                      minimumFractionDigits: 2,
                                      maximumFractionDigits: 2,
                                    })}{" "}
                                    zł
                                  </span>
                                ) : null}
                              </span>
                              {allegroRating && displayRating ? (
                                <span className="pl-chip pl-chip-rating">
                                  ★ {displayRating.averageScore.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  <span className="pl-chip-muted"> · {displayRating.totalResponses} opinii</span>
                                </span>
                              ) : null}
                              <span className="pl-chip">5 lat gwarancji</span>
                              <span className="pl-chip">Darmowa dostawa od 99 zł</span>
                            </div>

                            <p className="pl-subtitle">
                              {productLanding?.subtitle || "Na wymiar, bez wiercenia, mocna rama aluminiowa i wzmocniona siatka."}
                            </p>

                            <video
                              className="pl-hero-banner"
                              src="/moskitiery-ramkowe-baner.mp4"
                              muted
                              loop
                              playsInline
                              preload="auto"
                              ref={(el) => {
                                // 0.4s delayed start instead of autoPlay firing
                                // the instant it mounts - dataset flag guards
                                // against arming a second timer if this ref
                                // callback ever re-runs for the same element.
                                if (!el || el.dataset.delayedPlayArmed === "1") return;
                                el.dataset.delayedPlayArmed = "1";
                                window.setTimeout(() => {
                                  el.play().catch(() => {});
                                }, 400);
                              }}
                            />

                            <div className="pl-spec-grid">
                              {(productLanding?.specItems?.length ? productLanding.specItems : MOSKITIERY_RAMKOWE_SPEC_ITEMS).map(
                                (item) => {
                                  const icon = moskitieryRamkoweSpecIcon(item.label);
                                  return (
                                    <div className="pl-spec-item" key={item.label}>
                                      {icon ? (
                                        <span className="pl-spec-icon">{icon}</span>
                                      ) : null}
                                      <div className="pl-spec-item-text">
                                        <span className="pl-spec-label">{item.label}</span>
                                        <span className="pl-spec-value">{item.value}</span>
                                      </div>
                                    </div>
                                  );
                                },
                              )}
                            </div>

                            <h2 className="hero-product-section-title">Opis produktu</h2>
                            {productLanding?.description ? (
                              <div
                                className="pl-description"
                                dangerouslySetInnerHTML={{ __html: productLanding.description }}
                              />
                            ) : null}

                            <ul className="pl-feature-list">
                              {(productLanding?.featureBullets?.length
                                ? productLanding.featureBullets
                                : MOSKITIERY_RAMKOWE_FEATURE_BULLETS
                              ).map((bullet) => (
                                <li key={bullet.lead}>
                                  <strong>{bullet.lead}</strong>
                                  {bullet.detail ? <span> — {bullet.detail}</span> : null}
                                </li>
                              ))}
                            </ul>

                            <div className="pl-callout">
                              <strong>{productLanding?.callout?.title || "Produkt do samodzielnego złożenia"}</strong>
                              <p>
                                {productLanding?.callout?.body ||
                                  "Składasz ramkę, naciągasz siatkę i przykręcasz zaczepy — wszystko masz w komplecie, razem z instrukcją. Zwykle zajmuje to kilka–kilkanaście minut."}
                              </p>
                            </div>
                          </div>
                        ) : productSlugFromSelected(displayedProduct) === "rolety-dachowe" ? (
                          <div className="pl-landing">
                            <div className="pl-trust-row">
                              <span className="pl-price">
                                od {ROLETY_DACHOWE_STARTING_PRICE.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                                <span className="pl-price-unit"> / szt.</span>
                              </span>
                              <span className="pl-chip">400+ modeli okien</span>
                              <span className="pl-chip">Darmowa dostawa od 99 zł</span>
                            </div>

                            <p className="pl-subtitle">
                              Roleta dachowa dobierana pod Twój model okna — albo na własny wymiar.
                            </p>

                            <div
                              className="pl-hero-photo"
                              style={{ backgroundImage: `url(${optimizeImageUrl(ROLETY_DACHOWE_GALLERY_PHOTOS[0], 700)})` }}
                            />

                            <div className="pl-spec-grid">
                              {(productLanding?.specItems?.length ? productLanding.specItems : ROLETY_DACHOWE_SPEC_ITEMS).map(
                                (item) => (
                                  <div className="pl-spec-item" key={item.label}>
                                    <div className="pl-spec-item-text">
                                      <span className="pl-spec-label">{item.label}</span>
                                      <span className="pl-spec-value">{item.value}</span>
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>

                            <h2 className="hero-product-section-title">Opis produktu</h2>
                            {productLanding?.description ? (
                              <div
                                className="pl-description"
                                dangerouslySetInnerHTML={{ __html: productLanding.description }}
                              />
                            ) : null}

                            <ul className="pl-feature-list">
                              {(productLanding?.featureBullets?.length
                                ? productLanding.featureBullets
                                : ROLETY_DACHOWE_FEATURE_BULLETS
                              ).map((bullet) => (
                                <li key={bullet.lead}>
                                  <strong>{bullet.lead}</strong>
                                  {bullet.detail ? <span> — {bullet.detail}</span> : null}
                                </li>
                              ))}
                            </ul>

                            <div className="pl-callout">
                              <strong>{productLanding?.callout?.title || "Rolety nie pasują do okien z zaokrągloną listwą"}</strong>
                              <p>
                                {productLanding?.callout?.body ||
                                  "Jeżeli łuk jest minimalny (kilka milimetrów), roleta będzie pasować — natomiast przy oknach z typowo okrągłym profilem niestety nie."}
                              </p>
                            </div>
                          </div>
                        ) : productLanding && productLanding.sections.length > 0 ? (
                          <div className="pl-landing">
                            <h2 className="hero-product-section-title">Opis produktu</h2>
                            <div className="pl-trust-row">
                              {productLanding.priceFrom ? <span className="pl-price">{productLanding.priceFrom}</span> : null}
                              <span className="pl-chip">5 lat gwarancji</span>
                              <span className="pl-chip">Darmowa dostawa od 99 zł</span>
                            </div>
                            {productLanding.subtitle ? <p className="pl-subtitle">{productLanding.subtitle}</p> : null}
                            <div className="pl-benefits">
                              {productLanding.sections.map((section, index) => (
                                <div className="pl-benefit" key={`${section.title}-${index}`}>
                                  <div className="pl-benefit-copy">
                                    <span className="pl-benefit-index">{String(index + 1).padStart(2, "0")}</span>
                                    <h3>{section.title}</h3>
                                    <p>{section.body}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                            <div className="pl-cta-row">
                              <a href={displayedProduct.linkUrl} className="pl-cta-button">
                                Skonfiguruj i zobacz cenę
                              </a>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h2 className="hero-product-section-title">Opis produktu</h2>
                            <p>{displayedProduct.description}</p>
                          </>
                        )
                      ) : null}
                      </section>
                      <section id="product-section-galeria" ref={galeriaSectionRef} className="hero-product-section">
                      <h2 className="hero-product-section-title">Galeria zdjęć</h2>
                      {displayedProduct ? (() => {
                        // CRM-managed gallery (Sklep WWW -> Produkty i
                        // konfiguratory) becomes authoritative once the admin
                        // has curated it up to at least the size of the
                        // built-in real-photo set - a smaller CRM gallery
                        // (e.g. the handful of URLs saved earlier for other
                        // purposes, before this field was editable here) is
                        // treated as "not yet caught up" rather than swapping
                        // the live gallery down to fewer real photos.
                        const builtinGallery =
                          productSlugFromSelected(displayedProduct) === "moskitiery-ramkowe"
                            ? MOSKITIERY_RAMKOWE_GALLERY_PHOTOS
                            : productSlugFromSelected(displayedProduct) === "rolety-dachowe"
                              ? ROLETY_DACHOWE_GALLERY_PHOTOS
                              : displayedProduct.gallery;
                        const galleryPhotos =
                          productLanding?.gallery?.length && productLanding.gallery.length >= builtinGallery.length
                            ? productLanding.gallery
                            : builtinGallery;
                        const total = galleryPhotos.length;
                        const goToSlide = (index: number) => {
                          setActiveProductGallerySlide(((index % total) + total) % total);
                        };
                        const openZoom = (index: number) => {
                          setZoomPreview({ title: displayedProduct.label, urls: galleryPhotos, index });
                        };
                        const GALLERY_SWIPE_THRESHOLD_PX = 40;
                        // Both pointer AND touch listeners, deliberately -
                        // touchend was found to fire reliably while the
                        // matching pointerup sometimes doesn't (verified via
                        // Puppeteer's touch simulation; not worth trusting
                        // pointerup alone on a real device either given
                        // that). handleGallerySwipeEndX is shared between
                        // both so there's exactly one place computing the
                        // actual navigation, and startXRef being cleared by
                        // whichever handler runs first makes the other one
                        // (if it also fires for the same gesture) a no-op.
                        const handleGallerySwipeStartX = (clientX: number) => {
                          gallerySwipeStartXRef.current = clientX;
                        };
                        const handleGallerySwipeEndX = (clientX: number) => {
                          const startX = gallerySwipeStartXRef.current;
                          gallerySwipeStartXRef.current = null;
                          if (startX === null) return;
                          const deltaX = clientX - startX;
                          if (Math.abs(deltaX) < GALLERY_SWIPE_THRESHOLD_PX) return;
                          // A real swipe happened - the click that follows
                          // (pointerup/touchend both still produce one) would
                          // otherwise also open the zoom lightbox or
                          // double-navigate right after the swipe.
                          gallerySwipeSuppressClickRef.current = true;
                          goToSlide(activeProductGallerySlide + (deltaX < 0 ? 1 : -1));
                        };
                        const handleGallerySwipeCancel = () => {
                          gallerySwipeStartXRef.current = null;
                        };
                        const handleGalleryPointerDown = (event: React.PointerEvent<HTMLDivElement>) =>
                          handleGallerySwipeStartX(event.clientX);
                        const handleGalleryPointerUp = (event: React.PointerEvent<HTMLDivElement>) =>
                          handleGallerySwipeEndX(event.clientX);
                        const handleGalleryTouchStart = (event: React.TouchEvent<HTMLDivElement>) => {
                          const x = event.touches[0]?.clientX;
                          if (x !== undefined) handleGallerySwipeStartX(x);
                        };
                        const handleGalleryTouchEnd = (event: React.TouchEvent<HTMLDivElement>) => {
                          const x = event.changedTouches[0]?.clientX;
                          if (x !== undefined) handleGallerySwipeEndX(x);
                        };
                        const handleGalleryItemClick = (onActivate: () => void) => () => {
                          if (gallerySwipeSuppressClickRef.current) {
                            gallerySwipeSuppressClickRef.current = false;
                            return;
                          }
                          onActivate();
                        };
                        // Coverflow scale/spacing per step away from the active
                        // photo - the visible one is meaningfully bigger, each
                        // neighbor further out shrinks more.
                        const mainScaleForDistance = (distance: number) =>
                          distance === 0 ? 1 : distance === 1 ? 0.72 : distance === 2 ? 0.55 : 0.42;
                        const mainIndices = galleryVisibleIndices(activeProductGallerySlide, total, 3);
                        const thumbIndices = galleryVisibleIndices(activeProductGallerySlide, total, 5);
                        return (
                          <div className="hero-product-gallery">
                            <div className="hero-product-gallery-row-wrap">
                              <button
                                type="button"
                                className="hero-product-gallery-nav is-prev"
                                onClick={() => goToSlide(activeProductGallerySlide - 1)}
                                aria-label="Poprzednie zdjęcie"
                              >
                                ‹
                              </button>
                              <div
                                className="hero-product-gallery-row"
                                onPointerDown={handleGalleryPointerDown}
                                onPointerUp={handleGalleryPointerUp}
                                onPointerCancel={handleGallerySwipeCancel}
                                onPointerLeave={handleGallerySwipeCancel}
                                onTouchStart={handleGalleryTouchStart}
                                onTouchEnd={handleGalleryTouchEnd}
                                onTouchCancel={handleGallerySwipeCancel}
                              >
                                {mainIndices.map((index) => {
                                  const distance = galleryCircularOffset(index, activeProductGallerySlide, total);
                                  const isActive = distance === 0;
                                  return (
                                    <button
                                      key={`gallery-${index}`}
                                      type="button"
                                      className={`hero-product-gallery-row-item ${isActive ? "is-active" : ""}`}
                                      style={{
                                        transform: `translate(-50%, -50%) translateX(${distance * 58}%) scale(${mainScaleForDistance(Math.abs(distance))})`,
                                        zIndex: 100 - Math.abs(distance),
                                        opacity: Math.abs(distance) > 3 ? 0 : 1,
                                        pointerEvents: Math.abs(distance) > 3 ? "none" : "auto",
                                      }}
                                      onClick={handleGalleryItemClick(() => (isActive ? openZoom(index) : goToSlide(index)))}
                                      aria-label={
                                        isActive
                                          ? `Powiększ zdjęcie ${index + 1} z ${total}`
                                          : `Pokaż zdjęcie ${index + 1} z ${total}`
                                      }
                                    >
                                      <img
                                        src={optimizeImageUrl(galleryPhotos[index], 500)}
                                        alt={displayedProduct.label}
                                        loading={isActive ? "eager" : "lazy"}
                                      />
                                    </button>
                                  );
                                })}
                              </div>
                              <button
                                type="button"
                                className="hero-product-gallery-nav is-next"
                                onClick={() => goToSlide(activeProductGallerySlide + 1)}
                                aria-label="Następne zdjęcie"
                              >
                                ›
                              </button>
                            </div>
                            <div className="hero-product-gallery-thumbs-wrap">
                              <button
                                type="button"
                                className="hero-product-gallery-nav hero-product-gallery-nav--small is-prev"
                                onClick={() => goToSlide(activeProductGallerySlide - 1)}
                                aria-label="Poprzednia miniatura"
                              >
                                ‹
                              </button>
                              <div className="hero-product-gallery-thumbs">
                                {thumbIndices.map((index) => (
                                  <button
                                    key={`thumb-${index}`}
                                    type="button"
                                    className={index === activeProductGallerySlide ? "is-active" : ""}
                                    onClick={() => goToSlide(index)}
                                    aria-label={`Pokaż zdjęcie ${index + 1} z ${total}`}
                                  >
                                    <img src={optimizeImageUrl(galleryPhotos[index], 160)} alt="" loading="lazy" />
                                  </button>
                                ))}
                              </div>
                              <button
                                type="button"
                                className="hero-product-gallery-nav hero-product-gallery-nav--small is-next"
                                onClick={() => goToSlide(activeProductGallerySlide + 1)}
                                aria-label="Następna miniatura"
                              >
                                ›
                              </button>
                            </div>
                          </div>
                        );
                      })() : null}
                      </section>
                      <section id="product-section-opinie" ref={opinieSectionRef} className="hero-product-section">
                      <h2 className="hero-product-section-title">Opinie</h2>
                      {displayedProduct ? (
                        productSlugFromSelected(displayedProduct) === "moskitiery-ramkowe" ? (() => {
                          // Only reviews estimated at 3+ stars are ever kept in this
                          // list to begin with (see moskitiery-ramkowe-reviews-data.ts).
                          const qualifyingReviews = MOSKITIERY_RAMKOWE_ALLEGRO_REVIEWS.filter(
                            (review) => review.estimatedStars >= 3,
                          );
                          const filteredReviews = reviewStarFilter
                            ? qualifyingReviews.filter((review) => review.estimatedStars === reviewStarFilter)
                            : qualifyingReviews;
                          const visibleReviews = filteredReviews.slice(0, visibleReviewCount);
                          const hasMoreReviews = visibleReviews.length < filteredReviews.length;
                          return (
                          <div className="hero-product-allegro-reviews">
                            {allegroRating && displayRating ? (
                              <div className="allegro-rating-summary">
                                <div className="allegro-rating-score">
                                  <strong>{displayRating.averageScore.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                                  <span className="allegro-rating-stars" aria-hidden="true">
                                    {[1, 2, 3, 4, 5].map((star) => (
                                      <span
                                        key={star}
                                        className={`allegro-star ${star <= Math.round(displayRating.averageScore) ? "is-filled" : ""}`}
                                      >
                                        ★
                                      </span>
                                    ))}
                                  </span>
                                  <span className="allegro-rating-count">
                                    {displayRating.totalResponses.toLocaleString("pl-PL")} ocen klientów
                                  </span>
                                </div>
                                <div className="allegro-rating-distribution">
                                  {allegroRating.scoreDistribution.map((entry) => {
                                    // 1-2 star rows are shown zeroed out, and 3/4-star counts
                                    // trimmed, on purpose (business decision, not a data bug) -
                                    // see adjustedReviewCount. The average/total above are
                                    // recomputed from these same adjusted counts, not the raw ones.
                                    const displayCount = adjustedReviewCount(entry.stars, entry.count);
                                    const pct = displayRating.totalResponses > 0
                                      ? Math.round((displayCount / displayRating.totalResponses) * 100)
                                      : 0;
                                    const isActiveFilter = reviewStarFilter === entry.stars;
                                    return (
                                      <button
                                        type="button"
                                        key={entry.stars}
                                        className={`allegro-rating-bar-row ${isActiveFilter ? "is-active-filter" : ""}`}
                                        onClick={() => {
                                          setReviewStarFilter((prev) => (prev === entry.stars ? null : entry.stars));
                                          setVisibleReviewCount(REVIEWS_PAGE_SIZE);
                                        }}
                                        aria-pressed={isActiveFilter}
                                        aria-label={`Pokaż wyróżnione opinie z oceną ${entry.stars} gwiazdek`}
                                      >
                                        <span>{entry.stars}★</span>
                                        <span className="allegro-rating-bar-track">
                                          <span className="allegro-rating-bar-fill" style={{ width: `${pct}%` }} />
                                        </span>
                                        <span className="allegro-rating-bar-count">{displayCount}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : allegroRatingLoading ? (
                              <p className="allegro-rating-loading">Wczytujemy ocenę…</p>
                            ) : null}

                            {reviewStarFilter ? (
                              <div className="hero-product-reviews-filter-bar">
                                <span>Wyróżnione opinie z oceną (szac.): {reviewStarFilter}★</span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setReviewStarFilter(null);
                                    setVisibleReviewCount(REVIEWS_PAGE_SIZE);
                                  }}
                                >
                                  Wyczyść filtr
                                </button>
                              </div>
                            ) : null}

                            {visibleReviews.length === 0 ? (
                              <p className="hero-product-reviews-empty">
                                Nie wyróżniliśmy żadnej opinii z szacowaną oceną {reviewStarFilter}★ — to nie
                                znaczy, że takich ocen nie było (patrz rozkład powyżej), po prostu nie wybraliśmy
                                do tej listy żadnej z takim tonem treści.
                              </p>
                            ) : (
                              <ul className="hero-product-reviews">
                                {visibleReviews.map((review, index) => (
                                  <li key={`${review.date}-${review.maskedLogin}-${index}`}>
                                    <div className="allegro-review-meta">
                                      <strong>{review.maskedLogin}</strong>
                                      <span>{review.date}</span>
                                      <span
                                        className="allegro-review-estimated-stars"
                                        title="Ocena szacowana na podstawie tonu treści opinii — nie jest to realna ocena gwiazdkowa pobrana z platformy (ta nie jest dostępna dla pojedynczych opinii)."
                                      >
                                        {"★".repeat(review.estimatedStars)}
                                        {"☆".repeat(5 - review.estimatedStars)}
                                        <em> (szac.)</em>
                                      </span>
                                      {review.hasPhotos ? <span className="allegro-review-photo-tag">📷 zdjęcia klienta</span> : null}
                                    </div>
                                    <p>{review.body}</p>
                                    {review.pros || review.cons ? (
                                      <div className="allegro-review-tags">
                                        {review.pros ? (
                                          <p className="allegro-review-tag allegro-review-tag-pros">
                                            <strong>Zalety:</strong> {review.pros}
                                          </p>
                                        ) : null}
                                        {review.cons ? (
                                          <p className="allegro-review-tag allegro-review-tag-cons">
                                            <strong>Wady:</strong> {review.cons}
                                          </p>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </li>
                                ))}
                              </ul>
                            )}
                            {hasMoreReviews ? (
                              <div className="hero-product-reviews-load-more">
                                <button
                                  type="button"
                                  className="hero-product-reviews-load-more-btn"
                                  onClick={() => setVisibleReviewCount((prev) => prev + REVIEWS_PAGE_SIZE)}
                                >
                                  Pokaż więcej
                                </button>
                              </div>
                            ) : null}
                            {productLanding?.reviews?.length ? (
                              <ul className="hero-product-crm-reviews">
                                {productLanding.reviews.map((review, index) => (
                                  <li key={`${review.author}-${index}`}>
                                    <div className="hero-product-crm-review-head">
                                      <span className="allegro-rating-stars" aria-hidden="true">
                                        {[1, 2, 3, 4, 5].map((star) => (
                                          <span key={star} className={`allegro-star ${star <= review.stars ? "is-filled" : ""}`}>
                                            ★
                                          </span>
                                        ))}
                                      </span>
                                      {review.author ? <strong>{review.author}</strong> : null}
                                      {review.date ? <span className="hero-product-crm-review-date">{review.date}</span> : null}
                                    </div>
                                    <p>{review.text}</p>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                          );
                        })() : (
                          <ul className="hero-product-reviews">
                            {displayedProduct.reviews.map((review) => (
                              <li key={review}>{review}</li>
                            ))}
                          </ul>
                        )
                      ) : null}
                      </section>
                      <section id="product-section-faq" ref={faqSectionRef} className="hero-product-section">
                        <h2 className="hero-product-section-title">FAQ - Pytania i Odpowiedzi</h2>
                        {productLanding?.faq?.length ? (
                          <div className="hero-product-faq">
                            {productLanding.faq.map((entry, index) => (
                              <details key={`${entry.question}-${index}`} className="hero-product-faq-item">
                                <summary>{entry.question}</summary>
                                <p>{entry.answer}</p>
                              </details>
                            ))}
                          </div>
                        ) : (
                          <p className="hero-product-faq-empty">Wkrótce dodamy tu odpowiedzi na najczęstsze pytania.</p>
                        )}
                      </section>
                      <section id="product-section-instrukcje" ref={instrukcjeSectionRef} className="hero-product-section">
                      <h2 className="hero-product-section-title">Instrukcje</h2>
                      {displayedProduct ? (
                        <div className="hero-product-instructions">
                          {activeInstructionSteps.map((step, index) => (
                            <details
                              key={`${step.title}-${index}`}
                              className="hero-product-instruction-item"
                              onToggle={(event) => {
                                const video = instructionVideoRefs.current[index];
                                if (!video) return;
                                if (event.currentTarget.open) {
                                  video.currentTime = 0;
                                  video.play().catch(() => {});
                                } else {
                                  video.pause();
                                }
                              }}
                            >
                              <summary>{step.title}</summary>
                              {step.mediaUrl ? (
                                <div className="hero-product-instruction-media">
                                  {step.mediaType === "video" ? (
                                    <>
                                      <video
                                        ref={(el) => {
                                          instructionVideoRefs.current[index] = el;
                                        }}
                                        src={step.mediaUrl}
                                        muted
                                        loop
                                        playsInline
                                        preload="metadata"
                                      />
                                      <button
                                        type="button"
                                        className="hero-product-instruction-media-fullscreen"
                                        aria-label="Pełny ekran"
                                        onClick={() => requestInstructionVideoFullscreen(instructionVideoRefs.current[index])}
                                      >
                                        <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                          <path
                                            d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </button>
                                    </>
                                  ) : (
                                    <img src={optimizeImageUrl(step.mediaUrl, 900)} alt={step.title} loading="lazy" />
                                  )}
                                </div>
                              ) : null}
                              <div className="hero-product-instruction-body" dangerouslySetInnerHTML={{ __html: step.body }} />
                            </details>
                          ))}
                        </div>
                      ) : null}
                      </section>
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
                  ref={(el) => {
                    menuCardRefs.current[index] = el;
                  }}
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
                {productSlugFromSelected(displayedProduct) === "moskitiery-ramkowe" ? (
                  addToCartToast ? (
                    <MobileOverlayPortal>
                    <div className="hero-product-mini-summary hero-product-added-toast-overlay is-revealed">
                      <div className="hero-product-mini-summary-body">
                        <div className="hero-product-added-toast">
                          <span className="hero-product-added-toast-icon" aria-hidden="true">✓</span>
                          <p>
                            <strong>Dodano do koszyka!</strong> {addToCartToast.productLabel}
                          </p>
                          <div className="hero-product-added-toast-actions">
                            <button
                              type="button"
                              onClick={() => {
                                setAddToCartToast(null);
                                setRamkoweConfigKey((key) => key + 1);
                              }}
                            >
                              Wyceń podobną moskitierę
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAddToCartToast(null);
                                setRamkoweLastResult(null);
                                setRamkoweConfigKey((key) => key + 1);
                              }}
                            >
                              Wyceń nową moskitierę
                            </button>
                            <a href="/koszyk" className="is-primary">
                              Przejdź do koszyka
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                    </MobileOverlayPortal>
                  ) : (
                    <ConfiguratorPanel
                      key={ramkoweConfigKey}
                      initialValues={
                        ramkoweLastResult
                          ? { hardwareId: ramkoweLastResult.hardwareId, meshId: ramkoweLastResult.meshId }
                          : undefined
                      }
                      submitLabel="Dodaj do koszyka"
                      onZoom={(preview) => setZoomPreview(preview)}
                      onSubmit={(result) => {
                        setRamkoweLastResult(result);
                        const item: CartLineItem = {
                          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                          productSlug: "moskitiery-ramkowe",
                          productLabel: displayedProduct.label,
                          hardwareLabel: result.hardwareLabel,
                          meshLabel: result.meshLabel,
                          widthMm: result.widthMm,
                          heightMm: result.heightMm,
                          qty: result.qty,
                          price: result.unitPrice,
                          total: result.totalPrice,
                          imageUrl: result.hardwareImageUrl,
                          createdAt: new Date().toISOString(),
                          oversizeSurchargeAmount: result.oversizeSurchargeAmount,
                        };
                        const items = addCartItem(item);
                        setCartItems(items);
                        setCartSummary(cartSummaryWithSurcharge(items));
                        setCartIsBumping(true);
                        window.setTimeout(() => setCartIsBumping(false), 500);
                        setAddToCartToast({ productSlug: "moskitiery-ramkowe", productLabel: displayedProduct.label });
                      }}
                    />
                  )
                ) : productSlugFromSelected(displayedProduct) === "rolety-dachowe" ? (
                  addToCartToast ? (
                    <MobileOverlayPortal>
                    <div className="hero-product-mini-summary hero-product-added-toast-overlay is-revealed">
                      <div className="hero-product-mini-summary-body">
                        <div className="hero-product-added-toast">
                          <span className="hero-product-added-toast-icon" aria-hidden="true">✓</span>
                          <p>
                            <strong>Dodano do koszyka!</strong> {addToCartToast.productLabel}
                          </p>
                          <div className="hero-product-added-toast-actions">
                            <button
                              type="button"
                              onClick={() => {
                                setAddToCartToast(null);
                                setRdConfigKey((key) => key + 1);
                              }}
                            >
                              Wyceń podobną roletę
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAddToCartToast(null);
                                setRdLastResult(null);
                                setRdConfigKey((key) => key + 1);
                              }}
                            >
                              Wyceń nową roletę
                            </button>
                            <a href="/koszyk" className="is-primary">
                              Przejdź do koszyka
                            </a>
                          </div>
                        </div>
                      </div>
                    </div>
                    </MobileOverlayPortal>
                  ) : (
                    <RoletyDachoweConfiguratorPanel
                      key={rdConfigKey}
                      initialValues={
                        rdLastResult
                          ? {
                              hardwareId: rdLastResult.hardwareId,
                              materialTypeId: rdLastResult.materialTypeId,
                              fabricId: rdLastResult.fabricId,
                            }
                          : undefined
                      }
                      submitLabel="Dodaj do koszyka"
                      onZoom={(preview) => setZoomPreview(preview)}
                      onSubmit={(result) => {
                        setRdLastResult(result);
                        const item: CartLineItem = {
                          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                          productSlug: "rolety-dachowe",
                          productLabel: displayedProduct.label,
                          hardwareLabel: result.hardwareLabel,
                          meshLabel: result.fabricLabel,
                          modelLabel: result.windowProducer ? `${result.windowProducer} ${result.windowModel}` : result.windowModel,
                          widthMm: result.widthMm,
                          heightMm: result.heightMm,
                          qty: result.qty,
                          price: result.unitPrice,
                          total: result.totalPrice,
                          imageUrl: result.hardwareImageUrl,
                          createdAt: new Date().toISOString(),
                        };
                        const items = addCartItem(item);
                        setCartItems(items);
                        setCartSummary(cartSummaryWithSurcharge(items));
                        setCartIsBumping(true);
                        window.setTimeout(() => setCartIsBumping(false), 500);
                        setAddToCartToast({ productSlug: "rolety-dachowe", productLabel: displayedProduct.label });
                      }}
                    />
                  )
                ) : (
                  <>
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
                      {selectedHardwareOption && stepOneCollapsed ? (
                        <span
                          className="hero-product-step-head-swatch"
                          style={{ backgroundImage: `url(${optimizeImageUrl(selectedHardwareOption.imageUrl, 64)})` }}
                          aria-hidden="true"
                        />
                      ) : null}
                      {selectedHardwareOption ? <strong>{selectedHardwareOption.label}</strong> : null}
                      {stepOneCollapsed ? (
                        <span className="hero-product-step-head-change">Zmień</span>
                      ) : (
                        <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
                      )}
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
                                }
                                // Wait for the accordion's own 340ms fold
                                // animation to finish before scrolling, so
                                // the two motions don't fight each other.
                                window.setTimeout(() => {
                                  stepTwoRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                                }, 380);
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
                    <section className={`hero-product-step-accordion ${stepTwoCollapsed ? "is-collapsed" : ""}`}>
                      <button
                        type="button"
                        ref={stepTwoRef}
                        className="hero-product-step-head"
                        onClick={() => setStepTwoCollapsed((prev) => !prev)}
                        aria-expanded={stepTwoCollapsed ? "false" : "true"}
                      >
                        <span className="hero-product-config-step-title hero-product-config-step-title--muted">
                          <span className={`hero-product-step-check ${meshChosen ? "" : "is-muted"}`} aria-hidden="true">
                            {meshChosen ? "✓" : "2"}
                          </span>
                          Dobierz kolor siatki
                        </span>
                        <span className="hero-product-step-head-meta">
                          {selectedMesh && stepTwoCollapsed ? (
                            selectedMesh.imageUrl ? (
                              <span
                                className="hero-product-step-head-swatch"
                                style={{ backgroundImage: `url(${optimizeImageUrl(selectedMesh.imageUrl, 64)})` }}
                                aria-hidden="true"
                              />
                            ) : (
                              <span
                                className="hero-product-step-head-swatch is-color-only"
                                style={{ background: selectedMesh.color }}
                                aria-hidden="true"
                              />
                            )
                          ) : null}
                          {selectedMesh ? <strong>{selectedMesh.label}</strong> : null}
                          {stepTwoCollapsed ? (
                            <span className="hero-product-step-head-change">Zmień</span>
                          ) : (
                            <span className="hero-product-step-head-chevron" aria-hidden="true">▴</span>
                          )}
                        </span>
                      </button>
                      <div className="hero-product-step-body">
                        <div className="hero-product-mesh-grid hero-product-mesh-grid--visual">
                          {MESH_OPTIONS.map((option) => {
                            const isActive = option.id === selectedMeshId;
                            return (
                              <button
                                key={option.id}
                                type="button"
                                className={`hero-product-mesh-option hero-product-mesh-option--visual ${isActive ? "is-active" : ""}`}
                                onClick={() => {
                                  setSelectedMeshId(option.id);
                                  setStepTwoCollapsed(true);
                                  window.setTimeout(() => {
                                    stepThreeRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                                  }, 380);
                                }}
                              >
                                {option.imageUrl ? (
                                  <span
                                    className="hero-product-mesh-option-image"
                                    style={{ backgroundImage: `url(${optimizeImageUrl(option.imageUrl, 160)})` }}
                                  />
                                ) : (
                                  <span className="hardware-dot" style={{ background: option.color }} />
                                )}
                                <strong>{option.label}</strong>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    </section>
                    {meshChosen ? (
                      <>
                        <p ref={stepThreeRef} className="hero-product-config-step-title hero-product-config-step-title--muted">
                          <span className={`hero-product-step-check ${hasValidDimensions ? "" : "is-muted"}`} aria-hidden="true">
                            {hasValidDimensions ? "✓" : "3"}
                          </span>
                          Podaj wymiary
                        </p>
                        <div className="hero-product-dimensions-grid">
                          <label>
                            Szerokość (mm)
                            <input
                              type="number"
                              inputMode="numeric"
                              min={300}
                              max={2300}
                              placeholder="np. 1000"
                              value={dimensionWidth}
                              onChange={(event) => setDimensionWidth(event.target.value)}
                              onBlur={handleDimensionBlur}
                            />
                          </label>
                          <label>
                            Wysokość (mm)
                            <input
                              type="number"
                              inputMode="numeric"
                              min={300}
                              max={2300}
                              placeholder="np. 1200"
                              value={dimensionHeight}
                              onChange={(event) => setDimensionHeight(event.target.value)}
                              onBlur={handleDimensionBlur}
                            />
                          </label>
                          <label>
                            Ilość
                            <input
                              type="number"
                              inputMode="numeric"
                              min={1}
                              max={20}
                              value={dimensionQuantity}
                              onChange={(event) => setDimensionQuantity(event.target.value)}
                            />
                          </label>
                        </div>
                        {bothDimensionsOverTechnicalLimit ? (
                          <p className="hero-product-dimensions-error">
                            Ten rozmiar przekracza możliwości techniczne produkcji - szerokość i wysokość nie mogą
                            jednocześnie przekraczać 160 cm. Zmniejsz jeden z wymiarów.
                          </p>
                        ) : requiredSurchargeForCurrentDims < 0 ? (
                          <p className="hero-product-dimensions-error">
                            Maksymalny obsługiwany wymiar to 230 cm.
                          </p>
                        ) : activeSurchargeAmount > 0 ? (
                          <p className="hero-product-dimensions-surcharge-note">
                            Ten rozmiar wiąże się z jednorazową dopłatą {activeSurchargeAmount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                            za przesyłkę dłużycową (zaakceptowano).
                          </p>
                        ) : null}
                      </>
                    ) : null}
                    {hasValidDimensions ? (
                    <div className="hero-product-mini-summary is-revealed">
                      <h3>Moskitiera okienna</h3>
                      <div className="hero-product-mini-summary-body">
                        <div
                          className="mosk-preview-stage"
                          role="img"
                          aria-label={`Podgląd: profil ${selectedHardwareOption?.label || "--"}, siatka ${selectedMesh?.label || "--"}`}
                        >
                          {/* Per the CRM admin panel (allegro_configurator.js /
                              .alcfg-layer-preview*): every step has ONE shared PNG
                              layer, tinted per-option by accent_color, rendered as
                              a masked gradient "surface" plus a second, unmasked,
                              low-opacity, multiply-blended "overlay" pass of the
                              same PNG for texture. No base photo - these two
                              layers per option are the entire preview. */}
                          {selectedHardwareOption ? (
                            <>
                              <div
                                className="mosk-preview-surface"
                                style={buildMoskLayerSurfaceStyle(
                                  MOSKITIERY_PROFILE_DEFAULT_LAYER_URL,
                                  selectedHardwareOption.color,
                                  "solid",
                                )}
                              />
                              <div
                                className="mosk-preview-overlay"
                                style={{
                                  backgroundImage: `url(${optimizeImageUrl(MOSKITIERY_PROFILE_DEFAULT_LAYER_URL, 500)})`,
                                  opacity: 0.42,
                                }}
                              />
                            </>
                          ) : null}
                          {selectedMesh ? (
                            <>
                              <div
                                className="mosk-preview-surface"
                                style={buildMoskLayerSurfaceStyle(
                                  MOSKITIERY_MESH_LAYER_URL,
                                  selectedMesh.color,
                                  "mesh",
                                )}
                              />
                              <div
                                className="mosk-preview-overlay"
                                style={{
                                  backgroundImage: `url(${optimizeImageUrl(MOSKITIERY_MESH_LAYER_URL, 500)})`,
                                  opacity: 0.46,
                                }}
                              />
                            </>
                          ) : null}
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
                            <dd>{hasValidDimensions ? `${widthNum} × ${heightNum} mm` : "--"}</dd>
                          </div>
                          <div>
                            <dt>Ilość</dt>
                            <dd>{quantityNum} szt.</dd>
                          </div>
                        </dl>
                      </div>
                      {addToCartToast ? (
                        <div className="hero-product-added-toast">
                          <span className="hero-product-added-toast-icon" aria-hidden="true">✓</span>
                          <p>
                            <strong>Dodano do koszyka!</strong> {addToCartToast.productLabel}
                          </p>
                          <div className="hero-product-added-toast-actions">
                            <button
                              type="button"
                              onClick={() => {
                                setAddToCartToast(null);
                                setDimensionWidth("");
                                setDimensionHeight("");
                                setDimensionQuantity("1");
                              }}
                            >
                              Wyceń podobną moskitierę
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAddToCartToast(null);
                                setSelectedHardwareId("");
                                setSelectedMeshId("");
                                setDimensionWidth("");
                                setDimensionHeight("");
                                setDimensionQuantity("1");
                                setStepOneChosen(false);
                                setStepOneCollapsed(false);
                                setStepTwoCollapsed(false);
                              }}
                            >
                              Wyceń nową moskitierę
                            </button>
                            <a href="/koszyk" className="is-primary">
                              Przejdź do koszyka
                            </a>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="hero-product-mini-summary-price">
                            <div className="hero-product-mini-summary-price-details">
                              <div>
                                <dt>Obwód</dt>
                                <dd>
                                  {perimeterMeters !== null
                                    ? `${perimeterMeters.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} m`
                                    : "--"}
                                </dd>
                              </div>
                              <div>
                                <dt>Cena za 1 mb</dt>
                                <dd>
                                  <span className="price-per-mb-promo">
                                    {MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                                  </span>
                                  {MOSKITIERY_RAMKOWE_PRICE_ON_PROMO ? (
                                    <span className="price-per-mb-standard">
                                      {MOSKITIERY_RAMKOWE_PRICE_PER_MB_STANDARD.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                                    </span>
                                  ) : null}
                                </dd>
                              </div>
                            </div>
                            <div className="hero-product-mini-summary-price-final">
                              <strong className={isCalculatingPrice ? "is-calculating" : ""}>
                                {isCalculatingPrice
                                  ? "Obliczam…"
                                  : dimensionTotalPrice !== null
                                    ? `${dimensionTotalPrice.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł`
                                    : "Podaj wymiary"}
                              </strong>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="hero-product-add-to-cart"
                            onClick={handleAddToCart}
                            disabled={isCalculatingPrice || dimensionTotalPrice === null || dimensionsBlocked}
                          >
                            Dodaj do koszyka
                          </button>
                        </>
                      )}
                    </div>
                    ) : null}
                  </>
                ) : (
                  <p className="hero-product-config-hint">Wybierz kolor profilu, aby przejść do kolejnego kroku.</p>
                )}
                  </>
                )}
              </aside>
            ) : null}
          </div>
          {displayedProduct ? (
            <nav className={`hero-product-bottom-tabs ${isProductView ? "is-visible" : ""}`} aria-label="Sekcje produktu">
              <button
                type="button"
                className="hero-product-bottom-tabs-configure"
                onClick={() => {
                  // Mobile only: .hero-full scrolls internally, so plain
                  // scrollIntoView on the target isn't reliable here - same
                  // manual computation as the configurator's own step
                  // transitions (see ConfiguratorPanel.scrollStepIntoView).
                  const target = document.querySelector<HTMLElement>(".hero-product-config-panel");
                  const container = target?.closest<HTMLElement>(".hero-full");
                  if (target && container && container.scrollHeight > container.clientHeight) {
                    const containerRect = container.getBoundingClientRect();
                    const targetRect = target.getBoundingClientRect();
                    const delta = targetRect.top - containerRect.top - 96;
                    const nextTop = Math.max(
                      0,
                      Math.min(container.scrollTop + delta, container.scrollHeight - container.clientHeight),
                    );
                    container.scrollTo({ top: nextTop, behavior: "smooth" });
                  } else {
                    target?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }
                }}
              >
                Konfiguruj
              </button>
              <div className="hero-product-bottom-tabs-scroll">
                <button
                  type="button"
                  className={activeProductTab === "opis" ? "is-active" : ""}
                  onClick={() => scrollToProductSection("opis")}
                >
                  Opis produktu
                </button>
                <button
                  type="button"
                  className={activeProductTab === "galeria" ? "is-active" : ""}
                  onClick={() => scrollToProductSection("galeria")}
                >
                  Galeria zdjęć
                </button>
                <button
                  type="button"
                  className={activeProductTab === "opinie" ? "is-active" : ""}
                  onClick={() => scrollToProductSection("opinie")}
                >
                  Opinie
                </button>
                <button
                  type="button"
                  className={activeProductTab === "faq" ? "is-active" : ""}
                  onClick={() => scrollToProductSection("faq")}
                >
                  FAQ
                </button>
                <button
                  type="button"
                  className={activeProductTab === "instrukcje" ? "is-active" : ""}
                  onClick={() => scrollToProductSection("instrukcje")}
                >
                  Instrukcje
                </button>
              </div>
            </nav>
          ) : null}
        </section>
      </main>
      {surchargeModal ? (
        <div className="surcharge-modal" role="dialog" aria-modal="true" aria-label="Dopłata za przesyłkę dłużycową">
          <div className="surcharge-modal-shell">
            <h3>Przesyłka dłużycowa</h3>
            <p>
              Przy tym rozmiarze zamówienie wymaga jednorazowej dopłaty logistycznej{" "}
              <strong>
                {surchargeModal.amount.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
              </strong>{" "}
              za przesyłkę dłużycową (dopłata dotyczy całego zamówienia, nie każdej pozycji osobno).
            </p>
            <div className="surcharge-modal-actions">
              <button type="button" className="surcharge-modal-decline" onClick={handleDeclineSurcharge}>
                Zmień wymiar
              </button>
              <button type="button" className="surcharge-modal-accept" onClick={handleAcceptSurcharge}>
                Akceptuję dopłatę
              </button>
            </div>
          </div>
        </div>
      ) : null}
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
            <div className="config-option-preview-media">
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
                src={optimizeImageUrl(zoomPreview.urls[zoomPreview.index], 1800, 80)}
                alt={zoomPreview.title}
                className="config-option-preview-image"
                loading="eager"
              />
            </div>
            <p>
              {zoomPreview.title}
              {zoomPreview.urls.length > 1 ? ` • ${zoomPreview.index + 1}/${zoomPreview.urls.length}` : ""}
            </p>
            {zoomPreview.urls.length > 1 ? (
              <div className="config-option-preview-thumbs">
                {zoomPreview.urls.map((url, index) => (
                  <button
                    key={`${url}-${index}`}
                    type="button"
                    className={index === zoomPreview.index ? "is-active" : ""}
                    onClick={() => setZoomPreview((prev) => (prev ? { ...prev, index } : prev))}
                    aria-label={`Pokaż zdjęcie ${index + 1} z ${zoomPreview.urls.length}`}
                  >
                    <img src={optimizeImageUrl(url, 160)} alt="" loading="lazy" />
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {instructionModalIndex !== null && activeInstructionSteps[instructionModalIndex] ? (
        <div
          className="instruction-modal"
          role="dialog"
          aria-modal="true"
          aria-label={activeInstructionSteps[instructionModalIndex].title}
          onClick={() => {
            setInstructionModalIndex(null);
            if (/^#instrukcja-\d+$/.test(window.location.hash)) {
              history.replaceState(null, "", window.location.pathname + window.location.search);
            }
          }}
        >
          <div className="instruction-modal-shell" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              className="instruction-modal-close"
              aria-label="Zamknij instrukcję"
              onClick={() => {
                setInstructionModalIndex(null);
                if (/^#instrukcja-\d+$/.test(window.location.hash)) {
                  history.replaceState(null, "", window.location.pathname + window.location.search);
                }
              }}
            >
              ×
            </button>
            {activeInstructionSteps.length > 1 ? (
              <button
                type="button"
                className="instruction-modal-nav is-prev"
                aria-label="Poprzedni krok"
                onClick={() =>
                  setInstructionModalIndex((prev) =>
                    prev === null ? prev : (prev - 1 + activeInstructionSteps.length) % activeInstructionSteps.length,
                  )
                }
              >
                ‹
              </button>
            ) : null}
            {activeInstructionSteps.length > 1 ? (
              <button
                type="button"
                className="instruction-modal-nav is-next"
                aria-label="Następny krok"
                onClick={() =>
                  setInstructionModalIndex((prev) => (prev === null ? prev : (prev + 1) % activeInstructionSteps.length))
                }
              >
                ›
              </button>
            ) : null}
            <h3>{activeInstructionSteps[instructionModalIndex].title}</h3>
            {activeInstructionSteps[instructionModalIndex].mediaUrl ? (
              <div className="instruction-modal-media">
                {activeInstructionSteps[instructionModalIndex].mediaType === "video" ? (
                  <>
                    <video
                      key={instructionModalIndex}
                      ref={(el) => {
                        instructionModalVideoRef.current = el;
                      }}
                      src={activeInstructionSteps[instructionModalIndex].mediaUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      preload="metadata"
                    />
                    <button
                      type="button"
                      className="hero-product-instruction-media-fullscreen"
                      aria-label="Pełny ekran"
                      onClick={() => requestInstructionVideoFullscreen(instructionModalVideoRef.current)}
                    >
                      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path
                          d="M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </button>
                  </>
                ) : (
                  <img
                    src={optimizeImageUrl(activeInstructionSteps[instructionModalIndex].mediaUrl || "", 1200, 80)}
                    alt={activeInstructionSteps[instructionModalIndex].title}
                  />
                )}
              </div>
            ) : null}
            <div
              className="hero-product-instruction-body"
              dangerouslySetInnerHTML={{ __html: activeInstructionSteps[instructionModalIndex].body }}
            />
          </div>
        </div>
      ) : null}

      {infoModalSlug ? <InfoModal slug={infoModalSlug} onClose={() => setInfoModalSlug(null)} /> : null}
    </div>
  );
}
