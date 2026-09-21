"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import SiteFooter from "@/app/components/site-footer";
import { COMPANY_LEGAL } from "@/lib/company-legal";
import { createPortal } from "react-dom";
import dynamic from "next/dynamic";

// Header "Produkty" pill/switcher - same "only one product really live"
// reasoning as the theme toggle above. Flip to true once rolety-dachowe (or
// any other product) is ready for customers to switch into from here.
const SHOW_PRODUCT_SWITCHER_MENU = false;
import { optimizeImageUrl } from "@/lib/image-optim";
import { trackStorefrontEvent } from "@/lib/shop-public";
import { trackShopStep } from "@/lib/track-step";
import {
  EXPRESS_CHANGED_EVENT,
  EXPRESS_CUTOFF,
  EXPRESS_ENABLED,
  EXPRESS_FEE_AMOUNT,
  computeExpressDispatch,
  formatCutoff,
  isExpressSelected,
  setExpressSelected,
} from "@/lib/express";
import {
  PROMO_ACTIVATED_EVENT,
  PROMO_CODE,
  activatePromoCode,
  applyPromoToPrice,
  fetchPromoPreview,
  getPromoActivatedAt,
  isPromoActive,
  isPromoDeadlineExpired,
  hasPromoRenewalOnThisDevice,
  syncPromoDeadlineFromServer,
  type PromoPreview,
} from "@/lib/promo";
import { ensurePromoQuoteCode } from "@/lib/promo-save";
import PromoCountdownBanner from "./components/promo-countdown-banner";
import PromoTopStrip from "./components/promo-top-strip";
import {
  applyPriceAdjustment,
  setProductPriceAdjustmentsFromConfig,
  useProductPriceAdjustment,
} from "@/lib/price-adjustment";
import { MOSKITIERY_RAMKOWE_ALLEGRO_REVIEWS } from "./moskitiery-ramkowe-reviews-data";
import {
  type CartLineItem,
  type CartSummary,
  addCartItem,
  calcCartOversizeSurcharge,
  findEquivalentCartItem,
  formatPln,
  readCartItems,
  summarizeCartItems,
} from "@/lib/cart";
import InfoModal from "./components/info-modal";
import MeasurementHelp from "./components/measurement-help";
import { openCrispChat } from "@/lib/crisp";
import ChatNudge from "@/app/components/chat-nudge";
import {
  getRescueGrant,
  resolveResumeToken,
  setRescueGrant,
} from "@/lib/rescue";

// The header mini-cart badge/total should show what the customer will
// actually pay, same as the cart page's own "Razem" row - which means
// including the one-time oversize-shipment surcharge on top of the item
// subtotal summarizeCartItems() gives on its own (see calcCartOversizeSurcharge).
function cartSummaryWithSurcharge(items: CartLineItem[]): CartSummary {
  const base = summarizeCartItems(items);
  return { ...base, total: base.total + calcCartOversizeSurcharge(items) };
}
import {
  ALLEGRO_MOSKITIERY_HARDWARE,
  MESH_OPTIONS,
  MIN_WORTHWHILE_LEFTOVER_SAVINGS_ZL,
  MOSKITIERY_MESH_LAYER_URL,
  MOSKITIERY_PROFILE_DEFAULT_LAYER_URL,
  MOSKITIERY_RAMKOWE_PRICE_ON_PROMO,
  MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO,
  MOSKITIERY_RAMKOWE_PRICE_PER_MB_STANDARD,
  OVERSIZE_MAX_WIDTH_MM,
  OVERSIZE_SURCHARGE_THRESHOLD_MM,
  OVERSIZE_SURCHARGE_TIER_2_MAX_MM,
  OVERSIZE_TECHNICAL_LIMIT_MM,
  buildMoskLayerSurfaceStyle,
  moskBilledMeters,
  moskLeftoverCapacity,
  moskOversizeSurchargeForDimension,
  moskPerimeterMeters,
  type ConfiguratorResult,
  type HardwareOption,
  type MeshOption,
} from "@/features/moskitiery-ramkowe/shared";
import {
  ROLETY_DACHOWE_STARTING_PRICE,
  fetchRoofBlindProfile,
  roofBlindStartingPrice,
  type ConfiguratorResult as RoletyDachoweConfiguratorResult,
  type RoofBlindProfile,
} from "@/features/rolety-dachowe/shared";
import RoofHeroPhotos from "@/features/rolety-dachowe/RoofHeroPhotos";
import RoofQuickPrice from "@/features/rolety-dachowe/RoofQuickPrice";
import { RoofFabricsGuide, RoofHardwareStrip, RoofHowItWorks, RoofLibraryTeaser } from "@/features/rolety-dachowe/RoofLandingBlocks";
import RoofReviews from "@/features/rolety-dachowe/Reviews";
import { RD_ALL_PHOTOS, buildRdGalleryCategories } from "@/features/rolety-dachowe/gallery";
import {
  RD_CALLOUT,
  RD_DESCRIPTION_HTML,
  RD_FAQ,
  RD_FEATURE_BULLETS,
  RD_H1,
  RD_INSTRUCTION_STEPS,
  RD_PRIMARY_CTA,
  RD_SPEC_ITEMS,
  RD_SUBTITLE,
  isRdPlaceholderCopy,
} from "@/features/rolety-dachowe/landing-content";
import { buildRoofWindowDisplayLabel, fetchRoofWindowLibrary, type RoofWindowLibraryItem } from "@/features/rolety-dachowe/roof-window-library";
import type { ConfiguratorResult as PlisyConfiguratorResult } from "@/features/plisy/shared";
import { fetchPlisyProfile, type PlisyProfile } from "@/features/plisy/shared";
import PdHeroPhotos from "@/features/plisy-dachowe/PdHeroPhotos";
import PdQuickPrice from "@/features/plisy-dachowe/PdQuickPrice";
import { PdHardwareStrip, PdHowItWorks } from "@/features/plisy-dachowe/PdLandingBlocks";
import PdReviews from "@/features/plisy-dachowe/Reviews";
import { PD_ALL_PHOTOS, buildPdGalleryCategories } from "@/features/plisy-dachowe/gallery";
import {
  PD_CALLOUT,
  PD_DESCRIPTION_HTML,
  PD_FAQ,
  PD_FEATURE_BULLETS,
  PD_H1,
  PD_INSTRUCTION_STEPS,
  PD_PRIMARY_CTA,
  PD_SPEC_ITEMS,
  PD_SUBTITLE,
} from "@/features/plisy-dachowe/landing-content";
import { PD_PRICE_MULTIPLIER, PD_STARTING_PRICE_FALLBACK, pdStartingPrice, type ConfiguratorResult as PlisyDachoweConfiguratorResult } from "@/features/plisy-dachowe/shared";
import {
  isPlisyPlaceholderCopy,
  PLISY_H1,
  PLISY_DEFAULT_HEIGHT_MM,
  PLISY_DEFAULT_WIDTH_MM,
  PLISY_LEAD_TIME_LABEL,
  PLISY_PRIMARY_CTA,
  PLISY_DESCRIPTION_HTML,
  PLISY_CALLOUT,
  PLISY_FAQ,
  PLISY_FEATURE_BULLETS,
  PLISY_SPEC_ITEMS,
  PLISY_STARTING_PRICE_FALLBACK,
  PLISY_SUBTITLE,
} from "@/features/plisy/landing-content";
import { isProductSlugLive, PRODUCT_LOCKED_MESSAGE } from "@/lib/product-availability";
import { ALLEGRO_RATING_SNAPSHOTS, HOMEPAGE_CONFIG_SNAPSHOT } from "@/lib/landing-snapshot";

// The three product configurators are the heaviest part of this page's
// bundle (each pulls in its own step UI, pricing, rescue/save modals,
// SaveShareWidget, ...) and none of them are needed for the first paint of
// either the homepage grid or a product landing view - the configurator
// panel is a sticky sidebar / below-the-fold section that the boot overlay
// covers until it is ready anyway. Splitting them out with next/dynamic
// keeps that weight off every non-configuring visitor (and off the homepage
// entirely). ssr:false because they are client-only ("use client", browser
// APIs, localStorage) and were never server-rendered here in practice.
// The boot sequence waits for the active product's chunk before lifting the
// overlay (see configuratorChunkReady below), so this never shows an empty
// panel frame.
const ConfiguratorPanel = dynamic(() => import("@/features/moskitiery-ramkowe/ConfiguratorPanel"), {
  ssr: false,
  loading: () => <ConfiguratorPanelSkeleton />,
});
const RoletyDachoweConfiguratorPanel = dynamic(() => import("@/features/rolety-dachowe/ConfiguratorPanel"), {
  ssr: false,
});
const PlisyConfiguratorPanel = dynamic(() => import("@/features/plisy/ConfiguratorPanel"), { ssr: false });
const PlisyDachoweConfiguratorPanel = dynamic(() => import("@/features/plisy-dachowe/ConfiguratorPanel"), { ssr: false });
// Statycznie, nie przez dynamic(): to jest hero, więc ma się pojawić od razu
// razem z resztą sekcji, a nie doładować po hydratacji (LCP).
import PlisyHeroPhotos from "@/features/plisy/PlisyHeroPhotos";
import PlisyVisualizer from "@/features/plisy/PlisyVisualizer";
import PlisyReviews from "@/features/plisy/Reviews";
import PlisyMeasureGuide from "@/features/plisy/MeasureGuide";
import { PLISY_INSTRUCTION_STEPS } from "@/features/plisy/instructions";
import { buildPlisyGalleryCategories } from "@/features/plisy/gallery";
import PlisyCollectionsPicker from "@/features/plisy/CollectionsPicker";
import PlisyQuickPrice from "@/features/plisy/QuickPrice";

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
  product_groups?: Array<{
    products?: Array<{
      slug?: string;
      price_adjustment_percent?: number;
    }>;
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

type ProductTabKey = "opis" | "wizualizacja" | "galeria" | "opinie" | "instrukcje" | "faq";

type ProductInstructionStep = {
  title: string;
  body: string;
  mediaUrl?: string;
  mediaType?: "image" | "video";
  /** An embedded player (YouTube nocookie) instead of a media file - the
   * rolety-dachowe installation film. */
  embedUrl?: string;
  /** A React-rendered guide instead of a media file (features/plisy/MeasureGuide). */
  customMedia?: "plisy-measure";
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

// Faithful copy of the CRM's current shop-public/product spec_items
// (verbatim) - this renders for the split second before the live
// productLanding fetch lands, so wording drift here would show as a
// flicker on the product view. Re-sync if the owner edits them in the CRM.
// (labels intentionally match the CRM's - moskitieryRamkoweSpecIcon has no
// icon for them, exactly like the live render.)
const MOSKITIERY_RAMKOWE_SPEC_ITEMS: ProductSpecItem[] = [
  {
    label: "Na wymiar i pod kolor",
    value: "Moskitiera przygotowana dokładnie pod Twoje okno - szczelna i estetyczna",
  },
  {
    label: "Bez wiercenia",
    value:
      "Ramka zaczepiana jest o profil okna za pomocą bezinwazyjnych zaczepów sprężynowych - zakładasz i ściągasz kiedy chcesz.",
  },
  {
    label: "Na wiele lat",
    value:
      "Sztywny i wytrzymały profil aluminiowy oraz wzmocniona siatka z włókna szklanego, dodatkowo powlekana warstwą PCV to połączenie, które posłuży niezawodnie nawet kilkanaście lat.",
  },
  {
    label: "Gwarancja satysfakcji",
    value:
      "Jeżeli produkt nie spełni Twoich oczekiwań - możesz go zwrócić, a my oddamy Ci pieniądze! Bez zbędnych pytań!",
  },
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

// Real product photos, hosted on the CRM media store, grouped into labelled
// categories (owner call 2026-09-14: "uporządkować galerię ... najpierw te
// najbardziej prezencyjne i techniczne ... wyraźnie zaznaczyć kategorię").
//
// Order of the categories IS the order of the "Wszystkie" reel: the finished
// product first, then the colour range, then the close-ups, then how it
// mounts, and only then the customer photos. The last group is real, taken
// by buyers, and deliberately labelled - those shots sell trust precisely
// because they are not studio-lit, but the customer has to know which is
// which. The 57 studio frames below were sorted by looking at the actual
// images, not by filename.
type GalleryCategory = {
  id: string;
  label: string;
  /** One line under the photo explaining what this group is. */
  note: string;
  photos: string[];
};

const GALLERY_BASE = "https://crm-keika.groovemedia.pl/storage/shop/media/moskitiery-ramkowe-galeria/";

/** Studio frames are numbered moskitiera-okienna-01..57 on the media store. */
function studioPhotos(...numbers: number[]): string[] {
  return numbers.map((n) => `${GALLERY_BASE}moskitiera-okienna-${String(n).padStart(2, "0")}.jpg`);
}

/** 18 photos pulled from this product's Allegro reviews, re-encoded to
 * 1600 px / progressive JPEG and uploaded 2026-09-14. Listed best-first by
 * eye (well-lit, product clearly visible), not by file name. */
function customerPhotos(...numbers: number[]): string[] {
  return numbers.map((n) => `${GALLERY_BASE}klienci/moskitiera-klient-${String(n).padStart(2, "0")}.jpg`);
}

const MOSKITIERY_RAMKOWE_GALLERY_CATEGORIES: GalleryCategory[] = [
  {
    id: "produkt",
    label: "Produkt",
    note: "Zdjęcia studyjne gotowej moskitiery",
    photos: [
      `${GALLERY_BASE}moskitiera-okienna-allegro-miniaturka.jpg`,
      "https://crm-keika.groovemedia.pl/storage/shop/media/20260327_214156_d5ad04b7_moskitiera-okienna.jpg",
      ...studioPhotos(5, 6, 7, 8, 9, 13, 14, 16, 17, 20, 21, 22),
    ],
  },
  {
    id: "kolory",
    label: "Kolory profili",
    note: "7 kolorów ramy - od bieli i antracytu po drewnopodobne",
    photos: studioPhotos(1, 2, 3, 50, 51, 52, 53, 54, 55, 56),
  },
  {
    id: "detale",
    label: "Detale i siatka",
    note: "Zbliżenia narożników, profilu i wzmocnionej siatki",
    photos: studioPhotos(4, 10, 11, 12, 15, 18, 19, 41, 48, 49, 57),
  },
  {
    id: "montaz",
    label: "Montaż i mocowanie",
    note: "Zaczepy sprężynowe i przekroje okna - jak moskitiera trzyma się ramy",
    photos: studioPhotos(23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 42, 43, 44, 45, 46, 47),
  },
  {
    id: "klienci",
    label: "Zdjęcia od klientów",
    note: "Prawdziwe zdjęcia z opinii na Allegro - robione telefonem, bez studia i retuszu",
    photos: customerPhotos(4, 5, 8, 18, 12, 7, 6, 15, 1, 3, 11, 9, 2, 17, 14, 10, 13, 16),
  },
];

/** Flat "Wszystkie" reel, in category order. Also what the CRM-override
 * comparison and the "zdjęcie główne" lookup below use. */
const MOSKITIERY_RAMKOWE_GALLERY_PHOTOS: string[] = MOSKITIERY_RAMKOWE_GALLERY_CATEGORIES.flatMap(
  (category) => category.photos,
);

// rolety-dachowe landing content lives in features/rolety-dachowe/
// landing-content.ts (built-in copy, CRM fields take over field by field)
// and gallery.ts (the owner's photo set from the Allegro offer).
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
  title: string;
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
const PRODUCT_SLUGS_WITH_ALLEGRO_RATING = new Set(["moskitiery-ramkowe", "rolety-dachowe"]);
// Owner, 2026-09-17 ("zdejmijmy trochę tego scrollowania"): three reviews
// and three FAQ entries up front, the rest behind "Pokaż więcej".
const REVIEWS_PAGE_SIZE = 3;
const FAQ_INITIAL_COUNT = 3;

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
    return "Plisy produkowane pod Twoje okno, z płynnym sterowaniem i bardzo elastycznym dopasowaniem do różnych typów okien.";
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
    return RD_INSTRUCTION_STEPS;
  }
  if (normalized.includes("plis") && normalized.includes("dachow")) {
    return PD_INSTRUCTION_STEPS;
  }
  if (/^plis/.test(normalized)) {
    return PLISY_INSTRUCTION_STEPS;
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
// Shows the real Allegro distribution 1:1 (audit 2026-09-13). This used to
// zero out the 1-2 star rows and trim the 3/4-star counts, which turned a
// real 4,77 / 371 into a displayed 4,92 / 349 and claimed "0" one-star
// reviews - a misleading-reviews exposure (Omnibus / UOKiK) with no real
// sales upside, since both numbers read as "almost all fives". Kept as a
// function so neither render site needs touching if the policy changes.
function adjustedReviewCount(_stars: number, count: number): number {
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

// Same CRM-override-aware resolution the "Galeria zdjęć" section below uses
// (see the builtinGallery/galleryPhotos logic there) - kept in sync
// deliberately rather than each picking its own source, so "zdjęcie główne"
// under the description is never a different photo than gallery slide #1.
function resolveMainProductPhoto(
  product: SelectedProductView | null,
  productLanding: ProductLandingContent | null,
): string {
  if (!product) return "";
  const slug = productSlugFromSelected(product);
  const builtinGallery =
    slug === "moskitiery-ramkowe"
      ? MOSKITIERY_RAMKOWE_GALLERY_PHOTOS
      : slug === "rolety-dachowe"
        ? RD_ALL_PHOTOS
        : slug === "plisy-dachowe"
          ? PD_ALL_PHOTOS
          : product.gallery;
  const galleryPhotos =
    productLanding?.gallery?.length && productLanding.gallery.length >= builtinGallery.length
      ? productLanding.gallery
      : builtinGallery;
  return galleryPhotos[0] || "";
}

// End-of-section nudge (after Opinie, after FAQ - see product-section-cta
// below) - product-specific wording where we have it, a plain fallback for
// anything else rather than saying "moskitierę" on a different product.
function productSectionCtaLabel(product: SelectedProductView | null): string {
  const slug = productSlugFromSelected(product);
  if (slug === "moskitiery-ramkowe") return "Wyceń swoją moskitierę";
  if (slug === "rolety-dachowe") return RD_PRIMARY_CTA;
  if (slug === "plisy-dachowe") return PD_PRIMARY_CTA;
  if (slug === "plisy") return PLISY_PRIMARY_CTA;
  return "Skonfiguruj i zobacz cenę";
}

// Small suggestive icons for plisy's 4 built-in spec labels (see
// features/plisy/landing-content.ts) - keyed by exact label like
// moskitieryRamkoweSpecIcon above, so a CRM-renamed item simply has none.
// Spec-tile icons for rolety dachowe (features/rolety-dachowe/landing-content.ts).
function rdSpecIcon(label: string): React.ReactNode | null {
  const common = { viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  const key = label.toLowerCase();
  if (key.includes("model")) {
    return (
      <svg {...common}>
        <path d="M4 18L12 5l8 13" {...stroke} />
        <path d="M8 18v-6h8v6" {...stroke} />
        <circle cx="12" cy="9" r="1.2" fill="currentColor" />
      </svg>
    );
  }
  if (key.includes("kaseta") || key.includes("alumin")) {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="5" rx="1.5" {...stroke} />
        <path d="M6 9v11M18 9v11M6 20h12" {...stroke} />
      </svg>
    );
  }
  if (key.includes("zatrzym") || key.includes("hamul")) {
    return (
      <svg {...common}>
        <path d="M4 5h16" {...stroke} />
        <path d="M4 12h16" {...stroke} strokeWidth="2.6" />
        <path d="M12 13v6M9 19h6" {...stroke} />
      </svg>
    );
  }
  if (key.includes("gwaranc")) {
    return (
      <svg {...common}>
        <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" {...stroke} />
        <path d="M9 12l2 2 4-4" {...stroke} />
      </svg>
    );
  }
  return null;
}

// Built-in FAQ per product (CRM entries take over when the owner fills them).
function builtinFaqForSlug(slug: string): ProductFaqEntry[] {
  if (slug === "plisy") return PLISY_FAQ;
  if (slug === "rolety-dachowe") return RD_FAQ;
  if (slug === "plisy-dachowe") return PD_FAQ;
  return [];
}

function plisySpecIcon(label: string): React.ReactNode | null {
  const common = { viewBox: "0 0 24 24", fill: "none", "aria-hidden": true } as const;
  const stroke = { stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round" } as const;
  switch (label) {
    case "Na wymiar co do milimetra":
      return (
        <svg {...common}>
          <rect x="3" y="8" width="18" height="8" rx="1.5" {...stroke} />
          <path d="M7 8v3M11 8v4M15 8v3M19 8v4" {...stroke} />
        </svg>
      );
    case "Od góry i od dołu":
      return (
        <svg {...common}>
          <rect x="5" y="3" width="14" height="18" rx="1.5" {...stroke} />
          <path d="M8 9h8M8 12h8M8 15h8" {...stroke} />
          <path d="M12 3v3M12 18v3" {...stroke} />
        </svg>
      );
    case "Z wierceniem lub bez":
      return (
        <svg {...common}>
          <path d="M4 12h9l3-3 3 3-3 3-3-3" {...stroke} />
          <path d="M4 9v6" {...stroke} />
        </svg>
      );
    case "Gwarancja satysfakcji":
      return (
        <svg {...common}>
          <path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3z" {...stroke} />
          <path d="M9 12l2 2 4-4" {...stroke} />
        </svg>
      );
    default:
      return null;
  }
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

  if (groupSlug === "oslony-wewnetrzne" && /^plisy do okien dachowych$/.test(label)) {
    // Plisy dachowe (2026-09-19) - resolves to the same slug the virtual
    // item below uses, so the owner's future CRM tab just takes over.
    return "/produkt/plisy-dachowe";
  }

  if (groupSlug === "oslony-wewnetrzne" && /^plisy$/.test(label)) {
    // Live since 2026-09-16 - the landing, not the placeholder category page
    // (/kategoria/plisy and /produkt/plisy redirect there too, next.config.ts).
    return "/produkt/plisy";
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
  "https://images.unsplash.com/photo-1600607687920-4e2a09cf159d?auto=format&fit=crop&w=2200&q=80",
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
      "https://images.unsplash.com/photo-1611048268330-53de574cae3b?auto=format&fit=crop&w=1600&q=80",
    iconUrl: iconInside,
    items: [
      { label: "Rolety tradycyjne", iconUrl: iconInside, linkUrl: "/kategoria/oslony-wewnetrzne" },
      { label: "Rolety dzień - noc", iconUrl: iconInside, linkUrl: "/kategoria/rolety-dzien-noc" },
      { label: "Plisy", iconUrl: iconInside, linkUrl: "/produkt/plisy" },
      { label: "Żaluzje", iconUrl: iconInside, linkUrl: "/kategoria/zaluzje" },
      { label: "Rolety rzymskie", iconUrl: iconInside, linkUrl: "/produkt/rolety-rzymskie" },
      { label: "Rolety do okien dachowych", iconUrl: iconInside, linkUrl: "/produkt/rolety-dachowe" },
      { label: "Plisy do okien dachowych", iconUrl: iconInside, linkUrl: "/produkt/plisy-dachowe" },
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

/** Menu groups from the CRM config (snapshot or live), with the required
 * default sections guaranteed present. Module-level so the server-side
 * product-entry initialiser (resolveProductViewForSlug) shares it with
 * the component's own memo. */
function buildHeroMenuGroups(config: HomepageConfig | null, endpointOrigin: string): HeroMenuGroup[] {
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

  // Plisy dachowe (live 2026-09-19) have no tab in the CRM menu yet - shown
  // right after "Rolety do okien dachowych" until the owner adds one (a CRM
  // item "Plisy do okien dachowych" resolves to the same slug and wins).
  return withRequiredSections.map((group) => {
    if (String(group.slug || "").toLowerCase() !== "oslony-wewnetrzne") return group;
    const slugOf = (item: HeroMenuItem) => slugFromLink(item.linkUrl, item.label).toLowerCase();
    if (group.items.some((item) => slugOf(item) === "plisy-dachowe")) return group;
    const roofIndex = group.items.findIndex((item) => slugOf(item) === "rolety-dachowe");
    const injected: HeroMenuItem = {
      label: "Plisy do okien dachowych",
      iconUrl: (roofIndex >= 0 ? group.items[roofIndex].iconUrl : "") || group.iconUrl,
      linkUrl: "/produkt/plisy-dachowe",
    };
    const at = roofIndex >= 0 ? roofIndex + 1 : group.items.length;
    return { ...group, items: [...group.items.slice(0, at), injected, ...group.items.slice(at)] };
  });
}

function buildHeroMedia(config: HomepageConfig | null, endpointOrigin: string): HeroMedia[] {
  if (Array.isArray(config?.hero_media) && config!.hero_media!.length > 0) {
    return config!.hero_media!
      .map((item) => ({
        type: item?.type === "video" ? ("video" as const) : ("image" as const),
        url: absolutizeUrl(String(item?.url || "").trim(), endpointOrigin),
        label: String(item?.label || "").trim(),
      }))
      .filter((item) => item.url !== "");
  }
  return fallbackHeroSlides.map((url) => ({ type: "image" as const, url, label: "" }));
}

// Config endpoint origin as the module-level initialisers need it (the
// component's own endpointOrigin memo is the same value, just computed
// after the hooks that depend on this).
const INITIAL_CONFIG_ENDPOINT =
  process.env.NEXT_PUBLIC_CRM_SHOP_CONFIG_URL || "https://crm-keika.groovemedia.pl/biuro/api/shop/homepage_public";
const INITIAL_ENDPOINT_ORIGIN = (() => {
  try {
    return new URL(INITIAL_CONFIG_ENDPOINT).origin;
  } catch {
    return "https://crm-keika.groovemedia.pl";
  }
})();

/** Same object activateProductView() builds on a menu click - extracted so
 * the server render of a direct product entry (/moskitiery-ramkowe, see
 * app/moskitiery-ramkowe/page.tsx) can start with the product view already
 * mounted instead of a dark boot overlay + client-side activation. */
function buildProductView(
  group: HeroMenuGroup,
  groupIndex: number,
  subItem: HeroMenuItem,
  heroMedia: HeroMedia[],
): SelectedProductView {
  const shareSlug = slugFromLink(subItem.linkUrl, subItem.label);
  const heroImages = heroMedia.filter((entry) => entry.type === "image" && entry.url).map((entry) => entry.url);
  const gallery = [group.imageUrl, ...heroImages]
    .filter((url, index, array) => url && array.indexOf(url) === index)
    .slice(0, 8);
  return {
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
}

/** Products reachable by "?produkt=<slug>" before the owner adds their
 * menu tab in the CRM (plisy dachowe, 2026-09-19): a hidden menu item
 * attached to an existing group, used ONLY for URL resolution - never
 * rendered in the header / flyout. Once a real "Plisy do okien dachowych"
 * tab exists it resolves to the same slug (resolveMenuFallbackLink) and
 * wins, because the menu loop runs first. */
const VIRTUAL_PRODUCT_ITEMS: Record<string, { groupSlug: string; label: string; linkUrl: string }> = {
  "plisy-dachowe": { groupSlug: "oslony-wewnetrzne", label: "Plisy do okien dachowych", linkUrl: "/produkt/plisy-dachowe" },
};

function resolveVirtualProductItem(slug: string, groups: HeroMenuGroup[]): { group: HeroMenuGroup; groupIndex: number; item: HeroMenuItem } | null {
  const virtual = VIRTUAL_PRODUCT_ITEMS[String(slug || "").trim().toLowerCase()];
  if (!virtual || !groups.length) return null;
  const foundIndex = groups.findIndex((group) => String(group.slug || "").toLowerCase() === virtual.groupSlug);
  const groupIndex = foundIndex >= 0 ? foundIndex : 0;
  const group = groups[groupIndex];
  return { group, groupIndex, item: { label: virtual.label, iconUrl: group.iconUrl, linkUrl: virtual.linkUrl } };
}

/** Resolves a product slug against the (snapshot) config the way
 * activateFromUrl() does at runtime - null when the slug isn't a known
 * menu item. Pure, so it's safe in useState initialisers on the server. */
function resolveProductViewForSlug(
  slug: string,
  config: HomepageConfig | null,
  endpointOrigin: string,
): SelectedProductView | null {
  const wanted = String(slug || "").trim().toLowerCase();
  if (!wanted) return null;
  const groups = buildHeroMenuGroups(config, endpointOrigin);
  const heroMedia = buildHeroMedia(config, endpointOrigin);
  for (let groupIndex = 0; groupIndex < groups.length; groupIndex += 1) {
    const group = groups[groupIndex];
    for (const subItem of group.items) {
      if (slugFromLink(subItem.linkUrl, subItem.label).toLowerCase() !== wanted) continue;
      return buildProductView(group, groupIndex, subItem, heroMedia);
    }
  }
  const virtual = resolveVirtualProductItem(wanted, groups);
  if (virtual) return buildProductView(virtual.group, virtual.groupIndex, virtual.item, heroMedia);
  return null;
}

/** CRM-authored HTML (product description, instruction steps) sometimes
 * carries its own <h1> - the page already has one. Steps every h1 down to
 * h2 before injection (audit 2026-09-13: two H1s on the product view). */
/** "od X zł" z groszami tylko, gdy są (69,30 / 77). */
function formatStartingPrice(value: number): string {
  const hasFraction = Math.abs(value - Math.round(value)) >= 0.005;
  return value.toLocaleString("pl-PL", { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 });
}

function demoteHeadings(html: string): string {
  return String(html || "").replace(/<(\/?)h1(\s|>)/gi, "<$1h2$2");
}

/** Placeholder rendered (server-side too) inside the sticky config panel
 * until the product's configurator chunk arrives - keeps the panel's shape
 * and headline in the very first paint instead of an empty box. */
function ConfiguratorPanelSkeleton() {
  return (
    <div className="cfg-skeleton" aria-hidden="true">
      <header>
        <strong>Wyceń swoją moskitierę</strong>
      </header>
      <div className="cfg-skeleton-title" />
      <div className="cfg-skeleton-grid">
        {[0, 1, 2, 3, 4, 5, 6].map((index) => (
          <div key={index} className="cfg-skeleton-card" />
        ))}
      </div>
    </div>
  );
}

export default function Home({ initialProductSlug = "" }: { initialProductSlug?: string }) {
  // Direct product entry (/moskitiery-ramkowe) starts with the product view
  // already resolved from the build-time snapshot - server-rendered HTML
  // carries the real H1/price/chips and the boot overlay is skipped
  // entirely (audit 2026-09-13: LCP 9,8 s on 4G was the overlay waiting for
  // the configurator chunk, plus the hero copy blur-in leaking through).
  const initialProductView = useMemo(
    () =>
      resolveProductViewForSlug(
        initialProductSlug,
        HOMEPAGE_CONFIG_SNAPSHOT as unknown as HomepageConfig,
        INITIAL_ENDPOINT_ORIGIN,
      ),
    [initialProductSlug],
  );
  // Seed from the build-time snapshot so first paint has real branding, hero
  // media and menu instead of nothing / stock-photo fallbacks. The live
  // homepage_public fetch below still runs and swaps in anything that
  // differs (applyConfig hash-compares). This also removed the separate
  // configReady gate on the boot overlay - config is no longer awaited.
  const [config, setConfig] = useState<HomepageConfig | null>(
    HOMEPAGE_CONFIG_SNAPSHOT as unknown as HomepageConfig,
  );
  const [bootPhase, setBootPhase] = useState<"loading" | "reveal" | "ready">(initialProductView ? "ready" : "loading");
  const [openMenuIndex, setOpenMenuIndex] = useState<number | null>(null);
  const menuCardRefs = useRef<Array<HTMLElement | null>>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeHeroSlide, setActiveHeroSlide] = useState(0);
  const [heroSlidesReady, setHeroSlidesReady] = useState(false);
  // Gates the boot overlay alongside heroSlidesReady: on a direct
  // /?produkt=... entry the overlay must not lift until the code for that
  // product's (now dynamically imported) configurator panel has arrived,
  // otherwise the sticky config sidebar would flash in empty. On the plain
  // homepage there is no configurator to wait for, so it starts satisfied.
  // The boot hard-timeout below is still the backstop if the chunk request
  // itself stalls.
  // Never gates the boot any more (audit 2026-09-13) - the panel renders a
  // skeleton (see ConfiguratorPanelSkeleton / the dynamic() loading option)
  // until the chunk lands, so there's nothing to wait for. Kept as state so
  // the prefetch effect below still has something to flip.
  const [configuratorChunkReady, setConfiguratorChunkReady] = useState(true);
  const [cartSummary, setCartSummary] = useState<CartSummary>({ items: 0, total: 0 });
  const [cartItems, setCartItems] = useState<CartLineItem[]>([]);
  const [cartDisplayTotal, setCartDisplayTotal] = useState(0);
  const [cartIsBumping, setCartIsBumping] = useState(false);
  const [cartIsFlashing, setCartIsFlashing] = useState(false);
  const [cartTooltipOpen, setCartTooltipOpen] = useState(false);
  const [addToCartToast, setAddToCartToast] = useState<{
    productSlug: string;
    productLabel: string;
    /** moskitiery-ramkowe only - "zapas obwodu" upsell, same mechanism as
     * the live "Przy tym wymiarze płacisz za pełne..." hint shown during
     * configuration (see moskLeftoverCapacity()'s own doc comment), just
     * surfaced again here per live feedback: a customer who already closed
     * that hint never saw it, so it needs a second chance right in the
     * "Dodano do koszyka!" success moment too. */
    leftover?: { meters: number; value: number };
  } | null>(null);
  // Label of whichever locked product the visitor just tried to open via a
  // real navigation attempt (menu/flyout click) - see activateProductView()
  // below and lib/product-availability.ts. null hides the notice.
  const [productLockedNotice, setProductLockedNotice] = useState<string | null>(null);
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
  // Rolety dachowe landing (2026-09-18): the live CRM "dachowe" profile and
  // the window library feed the quick price, the fabrics guide and the
  // library teaser; rdPrefill hands the window / material chosen up top
  // into the configurator ("Konfiguruj to okno").
  const [rdProfile, setRdProfile] = useState<RoofBlindProfile | null>(null);
  const [rdLibrary, setRdLibrary] = useState<RoofWindowLibraryItem[]>([]);
  const [rdQuickMaterial, setRdQuickMaterial] = useState("");
  const [rdQuickDims, setRdQuickDims] = useState<{ widthMm: number; heightMm: number; label: string }>({ widthMm: 0, heightMm: 0, label: "" });
  const [rdPrefill, setRdPrefill] = useState<{ windowLibraryId?: number; windowQuery?: string; materialTypeId?: string } | null>(null);
  // Plisy dachowe (2026-09-19): fabrics/prices come off the plisy profile
  // (plisyProfile below), the window library is rdLibrary; pdPrefill hands
  // the window / collection chosen up top into the configurator.
  const [pdConfigKey, setPdConfigKey] = useState(0);
  const [pdLastResult, setPdLastResult] = useState<PlisyDachoweConfiguratorResult | null>(null);
  const [pdQuickGroup, setPdQuickGroup] = useState("");
  const [pdQuickDims, setPdQuickDims] = useState<{ widthMm: number; heightMm: number; label: string }>({ widthMm: 0, heightMm: 0, label: "" });
  const [pdPrefill, setPdPrefill] = useState<{ windowLibraryId?: number; windowQuery?: string; fabricGroupId?: string } | null>(null);
  // Same pattern again, for plisy's own <ConfiguratorPanel>
  // (features/plisy/) - see that folder's shared.ts for why its option data
  // is fetched live from the CRM instead of hardcoded like the two above.
  const [plisyConfigKey, setPlisyConfigKey] = useState(0);
  const [plisyLastResult, setPlisyLastResult] = useState<PlisyConfiguratorResult | null>(null);
  // Size typed into the "Ile za Twoje okno?" block at the top of the plisy
  // landing (2026-09-17) - handed to the configurator on "Konfiguruj to
  // okno" so it's never typed twice; cleared once a set reaches the cart.
  const [plisyPrefillDims, setPlisyPrefillDims] = useState<{ widthMm: number; heightMm: number } | null>(null);
  // The window size shared by "Ile za Twoje okno?" and the fabric-collection
  // comparison below it (owner, 2026-09-17): one size, priced in both.
  const [plisyQuickDims, setPlisyQuickDims] = useState({ widthMm: PLISY_DEFAULT_WIDTH_MM, heightMm: PLISY_DEFAULT_HEIGHT_MM });
  // Plisy landing copy prices itself from the live CRM matrix ("od 77 zł",
  // the per-collection examples) instead of the hand-typed CRM price_from,
  // which read "od 219 zł" against a 77 zł matrix minimum (audit
  // 2026-09-14). Same public profile the configurator fetches - cached by
  // fetchPlisyProfile, so it costs nothing extra once the panel mounts.
  const [plisyProfile, setPlisyProfile] = useState<PlisyProfile | null>(null);
  // Korekta procentowa ceny per produkt (CRM: Sklep WWW → Produkty →
  // "Korekta ceny (%)"), nakładana na ceny bazowe - patrz lib/price-adjustment.ts.
  const moskPriceAdjustmentPercent = useProductPriceAdjustment("moskitiery-ramkowe");
  // Rolety dachowe: w CRM produkt nazywa się "roleta-dachowa-dekolux", sklep
  // używa "rolety-dachowe" - honorujemy oba slugi.
  const roletyPriceAdjustmentPercentBySlug = useProductPriceAdjustment("rolety-dachowe");
  const roletyPriceAdjustmentPercentByCrmSlug = useProductPriceAdjustment("roleta-dachowa-dekolux");
  const roletyPriceAdjustmentPercent =
    roletyPriceAdjustmentPercentBySlug || roletyPriceAdjustmentPercentByCrmSlug;
  const plisyPriceAdjustmentPercent = useProductPriceAdjustment("plisy");
  const pdPriceAdjustmentPercent = useProductPriceAdjustment("plisy-dachowe");
  const moskPricePerMbPromo = applyPriceAdjustment(
    MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO,
    moskPriceAdjustmentPercent,
  );
  const moskPricePerMbStandard = applyPriceAdjustment(
    MOSKITIERY_RAMKOWE_PRICE_PER_MB_STANDARD,
    moskPriceAdjustmentPercent,
  );
  const roletyStartingPrice = rdProfile
    ? roofBlindStartingPrice(rdProfile, roletyPriceAdjustmentPercent)
    : applyPriceAdjustment(ROLETY_DACHOWE_STARTING_PRICE, roletyPriceAdjustmentPercent);
  // Plisy dachowe: window-plisa "od" x 1,25 with this product's own Korekta.
  const pdStartingPriceValue = plisyProfile
    ? pdStartingPrice(plisyProfile, pdPriceAdjustmentPercent)
    : applyPriceAdjustment(PD_STARTING_PRICE_FALLBACK, pdPriceAdjustmentPercent);
  // Desktop-only "Powiększ" toggle on .hero-product-config-panel (shared by
  // every product's configurator, applied once here instead of per-product).
  // Pure CSS state - no scroll position or config selection is touched by
  // toggling it, see the .is-expanded rules in globals.css. Actual smooth
  // animation between the two sizes is handled by setConfigExpanded() below
  // (a FLIP tween), not by a CSS transition - see that function's comment.
  const [isConfigExpanded, setIsConfigExpanded] = useState(false);
  // Owner (2026-09-16): "wyłącz opcję powiększenia konfiguratora". The
  // toggle, the FLIP tween and the .is-expanded CSS stay in place behind
  // this flag so it can come back with one edit.
  const CONFIG_EXPAND_ENABLED = false;
  const configPanelRef = useRef<HTMLElement | null>(null);
  // Mobile only: the floating bottom tab bar steps out of the way while the
  // configurator's "Dodaj do koszyka" button is in the strip of screen the
  // bar floats over. Owner report 2026-09-14, urgent: the bar sat on top of
  // that button after configuring, so on a phone the frame could not be
  // added to the cart at all.
  //
  // This asks the only question that matters - do the two rectangles overlap
  // right now - instead of the previous IntersectionObserver on the whole
  // panel: intersectionRatio is relative to the TARGET, and that panel is
  // several viewports tall, so its ratio never crossed any of the configured
  // thresholds and the callback stopped firing. Reading two rects inside a
  // rAF, only on the product view and only below the desktop breakpoint, is
  // cheap and cannot go stale.
  const [inAppBrowserBottomInset, setInAppBrowserBottomInset] = useState(0);
  const [hideBottomTabs, setHideBottomTabs] = useState(false);
  // No displayedProduct dependency: it is declared further down, and the
  // DOM answers the same question anyway - neither the panel nor the button
  // exists unless a configurator is mounted.
  useEffect(() => {
    let frame = 0;
    const check = () => {
      frame = 0;
      if (window.innerWidth > 1100) {
        setHideBottomTabs(false);
        return;
      }
      const viewportHeight = window.innerHeight;
      // The bar is fixed at bottom:1.1rem and is ~46 px tall; the extra
      // margin covers its shadow, the safe-area inset and the taller
      // in-app-browser variant (see inAppBrowserBottomInset below).
      const barZoneTop = viewportHeight - 92 - inAppBrowserBottomInset;

      // Owner call 2026-09-14: the bar goes away for the whole time the
      // customer is working in the configurator, not just when the CTA
      // happens to slide under it - picking colours and typing dimensions
      // needs the full screen, and the section links stay one scroll away.
      const panel =
        configPanelRef.current || document.querySelector<HTMLElement>(".hero-product-config-panel");
      if (panel) {
        const rect = panel.getBoundingClientRect();
        const visibleHeight = Math.min(rect.bottom, viewportHeight) - Math.max(rect.top, 0);
        // Enough of it on screen to count as "in the configurator" - a few
        // pixels peeking above the bottom edge must not kill the navigation.
        const reallyInView = visibleHeight >= Math.min(180, viewportHeight * 0.25);
        if (reallyInView && rect.top < viewportHeight && rect.bottom > barZoneTop) {
          setHideBottomTabs(true);
          return;
        }
      }

      // Belt and braces: even if the panel element is missing, the button
      // itself must never end up under the bar (that is the bug this whole
      // guard exists for - see the tests/smoke.spec.ts regression case).
      const cta = document.querySelector<HTMLElement>(".hero-product-add-to-cart");
      if (!cta) {
        setHideBottomTabs(false);
        return;
      }
      const ctaRect = cta.getBoundingClientRect();
      const ctaOnScreen = ctaRect.bottom > 0 && ctaRect.top < viewportHeight;
      setHideBottomTabs(ctaOnScreen && ctaRect.bottom > barZoneTop);
    };
    const schedule = () => {
      if (!frame) frame = window.requestAnimationFrame(check);
    };
    check();
    // capture:true - scroll events do not bubble, and on mobile the real
    // scroll container is .hero-full, not the window.
    window.addEventListener("scroll", schedule, { passive: true, capture: true });
    window.addEventListener("resize", schedule);
    // Layout can change with no scroll at all: a step folding shut, the
    // price block appearing the moment the last dimension is typed, the
    // on-screen keyboard closing. That is exactly when the panel grows past
    // the bar, so poll as a backstop.
    const interval = window.setInterval(check, 400);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      window.clearInterval(interval);
      window.removeEventListener("scroll", schedule, { capture: true } as EventListenerOptions);
      window.removeEventListener("resize", schedule);
    };
  }, [inAppBrowserBottomInset]);
  const configAnimCleanupTimerRef = useRef<number | null>(null);
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
  const [selectedProduct, setSelectedProduct] = useState<SelectedProductView | null>(initialProductView);
  const [displayedProduct, setDisplayedProduct] = useState<SelectedProductView | null>(initialProductView);
  const [isProductView, setIsProductView] = useState(Boolean(initialProductView));
  // Drives .hero-header.is-compact (mobile only, see globals.css): past an
  // 80px scroll the full header hides, leaving a pinned hamburger + small
  // cart icon. .hero-full - not window - is the real scroll container here
  // (see the scrollIntoView comments elsewhere in this file for why).
  const [isHeaderCompact, setIsHeaderCompact] = useState(false);
  // Facebook/Instagram's in-app browser draws its own bottom toolbar that
  // window.innerHeight doesn't know about (only window.visualViewport does)
  // - a pure-CSS `.hero-product-bottom-tabs { position: fixed; bottom: ... }`
  // anchors to innerHeight and ends up hidden behind that toolbar instead of
  // sitting on the real visible edge, so the bar reads as "not at the bottom
  // of the screen" there specifically. visualViewport.height + offsetTop is
  // the true visible height; the gap vs innerHeight becomes extra bottom
  // offset. Stays 0 in a normal mobile browser (Safari/Chrome), so nothing
  // changes there.
  useEffect(() => {
    if (typeof window === "undefined" || !window.visualViewport) {
      return;
    }
    const viewport = window.visualViewport;
    const updateInset = (): void => {
      const inset = Math.round(window.innerHeight - (viewport.height + viewport.offsetTop));
      setInAppBrowserBottomInset(Math.max(0, inset));
    };
    updateInset();
    viewport.addEventListener("resize", updateInset);
    viewport.addEventListener("scroll", updateInset);
    window.addEventListener("orientationchange", updateInset);
    return () => {
      viewport.removeEventListener("resize", updateInset);
      viewport.removeEventListener("scroll", updateInset);
      window.removeEventListener("orientationchange", updateInset);
    };
  }, []);
  // This page (the real destination for most traffic, including every Meta
  // ad click landing on / or /?produkt=...) never once called the CRM's own
  // visitor-tracking endpoint - only the separate /moskitiery landing page
  // did. "Odwiedzający" in the CRM was reporting almost nothing not because
  // visits weren't happening, but because they were never recorded. A
  // sessionStorage token groups the events from one visit together instead
  // of each becoming its own single-event "session".
  useEffect(() => {
    let sessionToken = "";
    try {
      const key = "keika_shop_session_token";
      sessionToken = window.sessionStorage.getItem(key) || "";
      if (!sessionToken) {
        sessionToken = `s_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
        window.sessionStorage.setItem(key, sessionToken);
      }
    } catch {
      // sessionStorage niedostępny (np. tryb prywatny) - event i tak poleci, bez grupowania w sesję.
    }
    void trackStorefrontEvent({
      event_name: "view_storefront",
      event_label: "homepage",
      page_slug: "/",
      session_token: sessionToken,
      device_type: window.innerWidth < 768 ? "mobile" : "desktop",
      referrer: document.referrer || "",
    }).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!displayedProduct) return;
    let sessionToken = "";
    try {
      sessionToken = window.sessionStorage.getItem("keika_shop_session_token") || "";
    } catch {
      // patrz komentarz wyżej
    }
    void trackStorefrontEvent({
      event_name: "view_product",
      event_label: productSlugFromSelected(displayedProduct),
      page_slug: `/?produkt=${productSlugFromSelected(displayedProduct)}`,
      session_token: sessionToken,
      device_type: window.innerWidth < 768 ? "mobile" : "desktop",
      meta: { product_slug: productSlugFromSelected(displayedProduct) },
    }).catch(() => null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedProduct]);
  useEffect(() => {
    if (!isProductView) {
      setIsHeaderCompact(false);
      return;
    }
    const container = document.querySelector<HTMLElement>(".hero-full");
    if (!container) return;
    function onScroll() {
      setIsHeaderCompact((container?.scrollTop || 0) > 80);
    }
    onScroll();
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, [isProductView]);
  // The cookie bar (position: fixed, bottom 0.75rem) sat right on top of
  // the floating Konfiguruj/Opis tabs on phones - one extra tap before the
  // configurator for every ad click that hadn't consented yet (plisy
  // landing analysis 2026-09-17). The bar lifts itself above the tabs via
  // this body class (globals.css: body.has-product-tabs .consent-bar).
  useEffect(() => {
    const active = isProductView && !hideBottomTabs;
    document.body.classList.toggle("has-product-tabs", active);
    return () => {
      document.body.classList.remove("has-product-tabs");
    };
  }, [isProductView, hideBottomTabs]);
  // Opis/Galeria/Opinie/Instrukcje are one continuous stacked page now, not
  // a tab-switcher - activeProductTab still exists, just repurposed to drive
  // which nav pill is highlighted (via the scroll-spy effect below) instead
  // of which content is rendered.
  const [activeProductTab, setActiveProductTab] = useState<ProductTabKey>("opis");
  // "Zamów dziś, wyślemy w <dzień>" - same real daily-capacity system
  // already driving this on the Allegro configurator (shipping_banner.php
  // proxies allegro_configurator_public_offer_shipping_banner() directly),
  // not a separate/fake promise - one shared production queue regardless of
  // which storefront the order came in through.
  const [shippingBanner, setShippingBanner] = useState<{
    headline: string;
    cta_text: string;
    cutoffHour: number;
    cutoffMinute: number;
  } | null>(null);
  // true until shipping_banner.php answers - a same-height placeholder
  // holds the banner's row so the video/description below don't jump.
  const [shippingBannerPending, setShippingBannerPending] = useState(true);
  const displayedProductSlugForPlisy = productSlugFromSelected(displayedProduct);
  useEffect(() => {
    if ((displayedProductSlugForPlisy !== "plisy" && displayedProductSlugForPlisy !== "plisy-dachowe") || plisyProfile) return;
    let cancelled = false;
    void fetchPlisyProfile().then((profile) => {
      if (!cancelled && profile) setPlisyProfile(profile);
    });
    return () => {
      cancelled = true;
    };
  }, [displayedProductSlugForPlisy, plisyProfile]);
  useEffect(() => {
    if (displayedProductSlugForPlisy !== "rolety-dachowe" || rdProfile) return;
    let cancelled = false;
    void fetchRoofBlindProfile().then((profile) => {
      if (cancelled) return;
      setRdProfile(profile);
      if (!rdQuickMaterial && profile.materialTypes[0]) setRdQuickMaterial(profile.materialTypes[0].id);
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [displayedProductSlugForPlisy, rdProfile]);
  // Separate effect: the profile effect above re-runs (and cancels) once the
  // profile lands, which silently dropped a slower library response live.
  useEffect(() => {
    if ((displayedProductSlugForPlisy !== "rolety-dachowe" && displayedProductSlugForPlisy !== "plisy-dachowe") || rdLibrary.length) return;
    let cancelled = false;
    void fetchRoofWindowLibrary().then((result) => {
      if (!cancelled) setRdLibrary(result.items);
    });
    return () => {
      cancelled = true;
    };
  }, [displayedProductSlugForPlisy, rdLibrary.length]);
  // Lowest price in the whole matrix (any table, STANDARD mount has no
  // surcharge) - the honest "od X zł" for the trust row.
  // Teksty z CRM (cena "od", FAQ) mogą zawierać {{cena_od}} - podstawiamy
  // aktualną najniższą cenę plisy (z korektą %), żeby kwoty w opisach nie
  // rozjeżdżały się z cennikiem po zmianie korekty.
  const plisyStartingPrice = useMemo(() => {
    if (!plisyProfile) return PLISY_STARTING_PRICE_FALLBACK;
    let min = Number.POSITIVE_INFINITY;
    for (const table of plisyProfile.tables) {
      for (const row of table.prices) {
        for (const cell of row) {
          if (typeof cell === "number" && Number.isFinite(cell) && cell > 0 && cell < min) min = cell;
        }
      }
    }
    if (!Number.isFinite(min)) return PLISY_STARTING_PRICE_FALLBACK;
    return applyPriceAdjustment(
      Math.max(0, min * (1 + plisyProfile.priceAdjustmentPercent / 100) + plisyProfile.priceAdjustmentAmount),
      plisyPriceAdjustmentPercent,
    );
  }, [plisyProfile, plisyPriceAdjustmentPercent]);
  const fillPricePlaceholders = (text: string): string =>
    text.replace(
      /{{s*cena_ods*}}/gi,
      `${formatStartingPrice(
        displayedProductSlugForPlisy === "rolety-dachowe" ? roletyStartingPrice : displayedProductSlugForPlisy === "plisy-dachowe" ? pdStartingPriceValue : plisyStartingPrice,
      )} zł`,
    );
  // "Ekspres" toggle (lib/express.ts) - the choice made here carries into
  // /koszyk's "Termin realizacji" via localStorage.
  const [expressSelected, setExpressSelectedState] = useState(false);
  useEffect(() => {
    setExpressSelectedState(isExpressSelected());
    const sync = () => setExpressSelectedState(isExpressSelected());
    window.addEventListener(EXPRESS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(EXPRESS_CHANGED_EVENT, sync);
  }, []);
  useEffect(() => {
    const slug = productSlugFromSelected(displayedProduct);
    if (!slug) {
      setShippingBanner(null);
      setShippingBannerPending(false);
      return;
    }
    setShippingBannerPending(true);
    let cancelled = false;
    fetch(`https://crm-keika.groovemedia.pl/biuro/api/shop-public/shipping_banner.php?product=${encodeURIComponent(slug)}`)
      .then((response) => response.json())
      .then(
        (json: {
          ok: boolean;
          banner?: {
            available?: boolean;
            headline?: string;
            cta_text?: string;
            cutoff_hour?: number;
            cutoff_minute?: number;
          };
        }) => {
          if (cancelled) return;
          const banner = json.ok ? json.banner : null;
          setShippingBanner(
            banner && banner.available && banner.headline
              ? {
                  headline: banner.headline,
                  cta_text: banner.cta_text || "",
                  cutoffHour: Number.isFinite(banner.cutoff_hour) ? Number(banner.cutoff_hour) : 15,
                  cutoffMinute: Number.isFinite(banner.cutoff_minute) ? Number(banner.cutoff_minute) : 0,
                }
              : null,
          );
          setShippingBannerPending(false);
        },
      )
      .catch(() => {
        if (cancelled) return;
        setShippingBanner(null);
        setShippingBannerPending(false);
      });
    return () => {
      cancelled = true;
    };
  }, [displayedProduct]);

  // "Tylko dzisiaj z kodem SEZON20" - the top-of-page promo banner (see
  // lib/promo.ts). Separate state from ConfiguratorPanel's own promo banner
  // near the price-in-cart - the two are siblings on this page with no
  // parent/child relationship, so PROMO_ACTIVATED_EVENT is what keeps them
  // in sync the instant either one is activated, not just after a remount.
  const [topPromoActive, setTopPromoActive] = useState(false);
  const [topPromoPreview, setTopPromoPreview] = useState<PromoPreview | null>(null);
  const [promoRenewToast, setPromoRenewToast] = useState(false);
  // false until the first client-side read of the promo state - the banner
  // row below is held by a same-height placeholder in the meantime so the
  // price/CTA block never jumps down after hydration (CLS 2026-09-14).
  const [topPromoResolved, setTopPromoResolved] = useState(false);
  // The header cart icon (badge, tooltip, animated total) showed the raw
  // pre-discount sum even with the promo active - it read cartSummary.total
  // directly instead of going through this. Percent-type discounts scale
  // the same regardless of what subtotal topPromoPreview itself was fetched
  // against, so this is safe to apply to the whole cart's total, not just
  // the single-product price topPromoPreview was originally fetched for.
  const [activeRescuePercent, setActiveRescuePercent] = useState(0);
  useEffect(() => {
    setActiveRescuePercent(getRescueGrant()?.percent || 0);
  }, []);
  const headerCartDiscountPercent =
    (topPromoActive && topPromoPreview?.type === "percent" ? topPromoPreview.value : 0) + activeRescuePercent;
  const cartTotalWithPromo =
    headerCartDiscountPercent > 0
      ? Math.max(0, cartSummary.total * (1 - headerCartDiscountPercent / 100))
      : cartSummary.total;
  useEffect(() => {
    // First-time visitor auto-activation happens HERE, before the first
    // client render of the banner - otherwise the banner painted its
    // shorter "Aktywuj rabat" variant for one effect cycle and then grew
    // (two layout shifts measured 2026-09-14). Same never-restamp guard as
    // promo-countdown-banner.tsx, which stays as a no-op backstop.
    if (getPromoActivatedAt() === null) activatePromoCode();
    setTopPromoActive(isPromoActive());
    const handleActivated = () => setTopPromoActive(isPromoActive());
    window.addEventListener(PROMO_ACTIVATED_EVENT, handleActivated);
    return () => window.removeEventListener(PROMO_ACTIVATED_EVENT, handleActivated);
  }, []);
  // Remarketing return ("?wroc=1", 2026-09-20): a customer brought back by
  // a retargeting ad whose 24 h SEZON20 window already ran out gets ONE
  // fresh window from the CRM (once per quote) - otherwise the ad promised
  // -20% and the cart charged full price (p90 of decisions is 6 days, the
  // window is 24 h). A first-time visitor on this device is handled by the
  // auto-activation just above; a still-running window is left alone.
  useEffect(() => {
    let wroc = "";
    let slug = "";
    try {
      const url = new URL(window.location.href);
      wroc = url.searchParams.get("wroc") || "";
      slug = (url.searchParams.get("produkt") || "").trim().toLowerCase();
    } catch {
      /* ignore */
    }
    if (!wroc) return;
    if (getPromoActivatedAt() !== null && !isPromoDeadlineExpired()) {
      trackShopStep("rm_return", "still_active", { product: slug });
      return;
    }
    if (hasPromoRenewalOnThisDevice()) {
      trackShopStep("rm_return", "already_renewed", { product: slug });
      return;
    }
    void import("@/lib/promo-save").then(({ renewPromoOnReturn }) =>
      renewPromoOnReturn(slug || undefined).then((result) => {
        trackShopStep("rm_return", result.renewed ? "renewed" : "not_renewed", { product: slug });
        if (!result.renewed) return;
        setTopPromoActive(true);
        setPromoRenewToast(true);
        window.setTimeout(() => setPromoRenewToast(false), 9000);
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    // The SEZON20 definition (type/value) is the same on every view and the
    // header cart is present on every view, so this has to load regardless
    // of which product (if any) is currently displayed. Gating it on
    // "moskitiery-ramkowe only" meant the header cart total silently dropped
    // the discount on the homepage (no displayedProduct) while showing it on
    // the product view. Percent discounts scale the same regardless of
    // subtotal, so the constant per-mb starting price works as the probe.
    let cancelled = false;
    fetchPromoPreview(MOSKITIERY_RAMKOWE_PRICE_PER_MB_PROMO).then((preview) => {
      if (cancelled) return;
      setTopPromoPreview(preview);
      // Only now can the banner row be released: the banner itself mounts
      // (and auto-activates SEZON20 for a first-time visitor) once this
      // preview exists - releasing on the earlier isPromoActive() read
      // collapsed the row for a moment and then re-expanded it (2 shifts).
      setTopPromoResolved(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  function activateTopPromo() {
    if (!topPromoPreview) return;
    setTopPromoActive(true);
    activatePromoCode();
    trackShopStep("promo_code_activated", "SEZON20", { source: "top_banner", amount: topPromoPreview.amount });
  }

  const opisSectionRef = useRef<HTMLElement | null>(null);
  const wizualizacjaSectionRef = useRef<HTMLElement | null>(null);
  const galeriaSectionRef = useRef<HTMLElement | null>(null);
  const opinieSectionRef = useRef<HTMLElement | null>(null);
  const instrukcjeSectionRef = useRef<HTMLElement | null>(null);
  const faqSectionRef = useRef<HTMLElement | null>(null);
  const productSectionRefs = useMemo<Record<ProductTabKey, React.RefObject<HTMLElement | null>>>(
    () => ({
      opis: opisSectionRef,
      wizualizacja: wizualizacjaSectionRef,
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
    trackShopStep("product_section_nav", key, { product_slug: productSlugFromSelected(displayedProduct) });
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

  // Shared by the bottom-tabs "Konfiguruj" button and the shipping
  // banner's "Oblicz cenę" CTA - same manual scroll-container computation
  // as scrollToProductSection above (mobile: .hero-full scrolls internally,
  // so a plain scrollIntoView on the target isn't reliable).
  function scrollToConfigPanel() {
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
  }

  // Scroll-spy: highlights whichever section's top has most recently
  // crossed the "just under the header" line as the active nav pill.
  useEffect(() => {
    if (!isProductView) return;
    const container = opisSectionRef.current?.closest<HTMLElement>(".hero-full");
    const sections: Array<[ProductTabKey, HTMLElement | null]> = [
      ["opis", opisSectionRef.current],
      ["wizualizacja", wizualizacjaSectionRef.current],
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
  // "" = the full reel; otherwise a GalleryCategory id (see
  // MOSKITIERY_RAMKOWE_GALLERY_CATEGORIES).
  const [galleryCategoryId, setGalleryCategoryId] = useState("");
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
  const [allegroRating, setAllegroRating] = useState<AllegroOfferRating | null>(() =>
    initialProductView ? ALLEGRO_RATING_SNAPSHOTS[productSlugFromSelected(initialProductView)] ?? null : null,
  );
  const [allegroRatingLoading, setAllegroRatingLoading] = useState(false);
  // Average/total recomputed from the full, unfiltered Allegro distribution
  // (adjustedReviewCount is an identity now - see its comment) so the
  // headline number, the bars and the "N opinii" count always agree with
  // the source listing.
  const displayRating = useMemo(() => {
    if (!allegroRating) return null;
    const kept = allegroRating.scoreDistribution
      .map((entry) => ({ stars: entry.stars, count: adjustedReviewCount(entry.stars, entry.count) }));
    const total = kept.reduce((sum, entry) => sum + entry.count, 0);
    const weightedSum = kept.reduce((sum, entry) => sum + entry.stars * entry.count, 0);
    return {
      averageScore: total > 0 ? weightedSum / total : allegroRating.averageScore,
      totalResponses: total,
    };
  }, [allegroRating]);
  const [visibleReviewCount, setVisibleReviewCount] = useState(REVIEWS_PAGE_SIZE);
  const [faqExpanded, setFaqExpanded] = useState(false);
  const [reviewStarFilter, setReviewStarFilter] = useState<number | null>(null);
  const [productLanding, setProductLanding] = useState<ProductLandingContent | null>(null);
  // Standalone modal for a single instruction step - same content as the
  // inline accordion in the Instrukcje section, but addressable from
  // anywhere on the site via a URL hash (#instrukcja-1, #instrukcja-2, ...)
  // so other parts of the page/site can link straight to one specific step
  // without needing to know about this component's internals.
  const [instructionModalIndex, setInstructionModalIndex] = useState<number | null>(null);
  // "Jak zmierzyć?" from the configurator's dimensions step opens straight
  // to the one real measurement step (with its video) and hides prev/next -
  // the business owner's explicit "wyświetlaj tylko instrukcję pomiaru",
  // not a jumping-off point into the fitting/assembly steps that happen to
  // share this same modal for the normal "Instrukcje" tab/deep-link case.
  const [instructionModalSingleStep, setInstructionModalSingleStep] = useState(false);
  // Instruction videos autoplay the instant their accordion row opens (and
  // pause + rewind the instant it closes) instead of relying on the
  // <video autoplay> heuristic, which only fires once on mount and doesn't
  // reliably re-trigger as a <details> element is toggled shut/open. One
  // ref per step, keyed by index.
  const instructionVideoRefs = useRef<Record<number, HTMLVideoElement | null>>({});
  const instructionModalVideoRef = useRef<HTMLVideoElement | null>(null);
  const activeInstructionSteps = useMemo<ProductInstructionStep[]>(() => {
    if (productLanding?.instructionSteps?.length) {
      // CRM-edited steps for plisy keep the animated measuring guide on the
      // "pomiar" step (a CRM text field cannot carry a React component).
      if (displayedProduct && productSlugFromSelected(displayedProduct) === "plisy") {
        return productLanding.instructionSteps.map((step) =>
          /pomiar/i.test(step.title) && !step.mediaUrl ? { ...step, customMedia: "plisy-measure" as const } : step,
        );
      }
      return productLanding.instructionSteps;
    }
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
        setInstructionModalSingleStep(false);
        setInstructionModalIndex(index);
      }
    };
    applyHash();
    window.addEventListener("hashchange", applyHash);
    return () => window.removeEventListener("hashchange", applyHash);
  }, [activeInstructionSteps]);

  // "Jak mierzyć?" from the landing (spec block) - opens the exact same
  // single-step measurement popup the configurator's dimensions step uses,
  // so there is one source of truth for the pomiar instruction.
  const openMeasurementInstructions = useCallback(() => {
    const measurementIndex = activeInstructionSteps.findIndex((step) =>
      normalizeMenuLabel(step.title).includes("pomiar"),
    );
    setInstructionModalSingleStep(true);
    setInstructionModalIndex(measurementIndex >= 0 ? measurementIndex : 0);
    trackShopStep("open_modal", "measurement_instructions", {
      product_slug: displayedProduct ? productSlugFromSelected(displayedProduct) : "",
      source: "landing_spec",
    });
  }, [activeInstructionSteps, displayedProduct]);
  // The "Instrukcja pomiaru" button inside the roof-blind window form opens
  // the same measurement popup the spec tile does.
  useEffect(() => {
    const handler = () => openMeasurementInstructions();
    window.addEventListener("keika:rd-open-measure-guide", handler);
    return () => window.removeEventListener("keika:rd-open-measure-guide", handler);
  }, [openMeasurementInstructions]);

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

  // Start fetching the code for the active product's configurator as early
  // as possible (in parallel with hydration + the content fetches) and flip
  // configuratorChunkReady once it lands, so the boot overlay can lift with
  // the panel already mounted. Failure resolves it too - a missing chunk
  // must never wedge the boot.
  useEffect(() => {
    const slug = productSlugFromSelected(displayedProduct);
    if (!slug) {
      setConfiguratorChunkReady(true);
      return;
    }
    let cancelled = false;
    const load =
      slug === "rolety-dachowe"
        ? import("@/features/rolety-dachowe/ConfiguratorPanel")
        : slug === "plisy-dachowe"
          ? import("@/features/plisy-dachowe/ConfiguratorPanel")
          : slug === "plisy"
            ? import("@/features/plisy/ConfiguratorPanel")
            : import("@/features/moskitiery-ramkowe/ConfiguratorPanel");
    load
      .then(() => {
        if (!cancelled) setConfiguratorChunkReady(true);
      })
      .catch(() => {
        if (!cancelled) setConfiguratorChunkReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [displayedProduct]);

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
          title: String(product.title || product.name || "").trim(),
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
    setFaqExpanded(false);
    if (!slug || !PRODUCT_SLUGS_WITH_ALLEGRO_RATING.has(slug)) {
      setAllegroRating(null);
      return;
    }
    // Seed the rating chip from the build-time snapshot the instant the
    // product view activates (still masked by the boot overlay) so it does
    // not pop in - and wrap the chip row - a second later. The live fetch
    // confirms/updates it; a failed or empty response keeps the snapshot
    // rather than blanking a chip we can show.
    const snapshot = ALLEGRO_RATING_SNAPSHOTS[slug];
    if (snapshot) setAllegroRating(snapshot);
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
        } else if (!snapshot) {
          setAllegroRating(null);
        }
      })
      .catch(() => {
        if (!cancelled && !snapshot) setAllegroRating(null);
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
    const fetchConfig = (endpoint: string) =>
      fetch(`${endpoint}?_ts=${Date.now()}`, { cache: "no-store" }).then((res) => res.json());

    const applyConfig = (nextConfig: HomepageConfig) => {
      const nextHash = JSON.stringify(nextConfig);
      if (nextHash === configHashRef.current) return;
      configHashRef.current = nextHash;
      if (!mounted) return;
      setProductPriceAdjustmentsFromConfig(nextConfig);
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
            .catch(() => {});
        });

    void pullConfig();
    // 10 s -> 10 min (audit 2026-09-13): the config changes a few times a
    // month, but every open tab was pulling the full ~157 KB homepage_public
    // payload 360x/hour (plus once per window focus) - ~58 MB/h per visitor
    // against the shared-host PHP CRM that also serves quote_save and the
    // Stripe webhook. The build-time snapshot already covers first paint and
    // the mount-time pull above still picks up any admin edit within seconds
    // of a fresh visit.
    intervalId = window.setInterval(() => {
      void pullConfig();
    }, 10 * 60 * 1000);

    return () => {
      mounted = false;
      if (intervalId !== null) window.clearInterval(intervalId);
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

  const heroMedia = useMemo(() => buildHeroMedia(config, endpointOrigin), [config, endpointOrigin]);

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

    // Probe the SAME optimized variant the .hero-slide background actually
    // renders (optimizeImageUrl(url, 2000, 70)), not the raw source. The
    // source images are 2-3 MB PNGs uploaded to the CRM at full resolution;
    // probing the raw URL made the boot overlay wait on a multi-megabyte
    // download that is never displayed (the visible background is the
    // ~200 KB WebP the optimizer returns), so heroSlidesReady only ever
    // resolved via the hard timeout on a slow connection.
    const probe = new Image();
    probe.decoding = "async";
    probe.onload = reveal;
    probe.onerror = reveal;
    probe.src = optimizeImageUrl(firstMedia.url, 2000, 70);

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
    const target = cartTotalWithPromo;
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
  }, [cartTotalWithPromo]);

  useEffect(() => {
    if (bootPhase !== "loading") return;
    // Config comes from the build-time snapshot now, so it no longer holds
    // the boot. heroSlidesReady only matters for the homepage hero carousel
    // - on a product view that carousel is .is-hidden, so don't wait on its
    // image there.
    if (!displayedProduct && !heroSlidesReady) return;
    if (!configuratorChunkReady) return;
    setBootPhase("reveal");
  }, [bootPhase, heroSlidesReady, configuratorChunkReady, displayedProduct]);

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
    // The reveal-phase entrance choreography (see .home-root.boot-reveal
    // rules in globals.css) staggers a title blur-in, an offer-panel
    // slide-in and a header fade over ~1.9 s - but on a direct /?produkt=
    // entry .hero-copy-content and .hero-menu-glass are already .is-hidden,
    // so that stagger animates nothing visible there. Only the plain
    // homepage actually plays it, so a product-view load can settle to
    // "ready" as soon as the overlay's own 0.56 s fade is comfortably done
    // instead of sitting on the spinner for the full stagger.
    const readyTimer = window.setTimeout(
      () => setBootPhase("ready"),
      displayedProduct ? 900 : 2100,
    );

    return () => {
      window.clearTimeout(readyTimer);
    };
  }, [bootPhase, displayedProduct]);

  const heroMenuGroups = useMemo(() => buildHeroMenuGroups(config, endpointOrigin), [config, endpointOrigin]);

  /** Toggles the "Powiększ" overlay (plisy only) with a real tween instead
   * of a plain class-swap. A CSS transition can't animate width/right/
   * top/height directly here: the collapsed state's width/right come from
   * grid/sticky layout ("auto" as far as those properties are concerned),
   * and CSS cannot interpolate to/from "auto" - a plain class toggle just
   * SNAPS instantly between the two sizes.
   * Fix is the standard FLIP technique: measure the real pixel rect right
   * before the class flips, let React+CSS apply the target class, measure
   * the real pixel rect right after, then play a Web Animations API tween
   * between those two concrete rects (real numbers on both ends, so
   * width/top/left genuinely reflow and interpolate frame by frame - an
   * earlier transform:scale() version looked smooth on paper but visibly
   * stretched the panel's own content while resizing, wrong for a slow,
   * deliberate open). WAAPI instead of a hand-rolled double-rAF + inline
   * transition: the browser's own animation timeline drives it once
   * started, and `.finished` gives an exact, no-magic-number cleanup point
   * instead of a guessed setTimeout duration. Once it finishes, the inline
   * overrides are cleared so the stylesheet (vw/rem-based, so still
   * responsive to a later window resize) owns the geometry again. */
  function setConfigExpanded(next: boolean) {
    const el = configPanelRef.current;
    if (!el || typeof window === "undefined") {
      setIsConfigExpanded(next);
      return;
    }
    // Cancel any still-running tween from a PREVIOUS toggle first - without
    // this, clicking the button again mid-animation lets the old tween's
    // completion handler wipe the inline styles THIS one is relying on.
    if (configAnimCleanupTimerRef.current !== null) {
      const prev = (el as HTMLElement & { __configAnim?: Animation }).__configAnim;
      prev?.cancel();
      configAnimCleanupTimerRef.current = null;
    }

    const firstRect = el.getBoundingClientRect();
    setIsConfigExpanded(next);

    requestAnimationFrame(() => {
      const target = configPanelRef.current;
      if (!target) return;
      const lastRect = target.getBoundingClientRect();
      if (lastRect.width === 0 || lastRect.height === 0) return;

      target.style.position = "fixed";
      target.style.right = "auto";
      target.style.bottom = "auto";
      target.style.margin = "0";

      const easing = "cubic-bezier(0.45, 0, 0.2, 1)";
      const anim = target.animate(
        [
          { top: `${firstRect.top}px`, left: `${firstRect.left}px`, width: `${firstRect.width}px`, height: `${firstRect.height}px` },
          { top: `${lastRect.top}px`, left: `${lastRect.left}px`, width: `${lastRect.width}px`, height: `${lastRect.height}px` },
        ],
        { duration: 680, easing, fill: "forwards" },
      );
      (target as HTMLElement & { __configAnim?: Animation }).__configAnim = anim;
      configAnimCleanupTimerRef.current = 1; // marks "an animation is in flight" - value itself is unused

      anim.finished
        .then(() => {
          configAnimCleanupTimerRef.current = null;
          const cleanupEl = configPanelRef.current;
          if (!cleanupEl) return;
          anim.cancel();
          cleanupEl.style.position = "";
          cleanupEl.style.right = "";
          cleanupEl.style.bottom = "";
          cleanupEl.style.margin = "";
        })
        .catch(() => {
          // Cancelled by a newer toggle - that call owns cleanup instead.
        });
    });
  }

  function activateProductView(
    group: HeroMenuGroup,
    groupIndex: number,
    subItem: HeroMenuItem,
    options?: { updateUrl?: boolean },
  ) {
    const shareSlug = slugFromLink(subItem.linkUrl, subItem.label);
    // options.updateUrl === false uniquely identifies the mount-time
    // "?produkt=..." URL resolution (activateFromUrl() below) rather than
    // an actual menu click - a direct/bookmarked link must keep working for
    // internal preview even while every click-through entry point is
    // locked, per explicit requirement. Every other call site (header mega
    // menu, in-page "Produkty" flyout) omits `options` entirely, so this is
    // a real user-initiated navigation attempt and gets the "w budowie"
    // notice instead of switching product.
    if (options?.updateUrl !== false && !isProductSlugLive(shareSlug)) {
      setProductLockedNotice(subItem.label);
      window.setTimeout(() => setProductLockedNotice(null), 3200);
      return;
    }
    const nextProduct = buildProductView(group, groupIndex, subItem, heroMedia);
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
      if (shareSlug === initialProductSlug) {
        // Already on this product's own route - no query needed.
        nextUrl.searchParams.delete("produkt");
      } else {
        nextUrl.searchParams.set("produkt", shareSlug);
      }
      window.history.pushState({ product: shareSlug }, "", `${nextUrl.pathname}${nextUrl.search}${nextUrl.hash}`);
    }
  }

  useEffect(() => {
    setActiveProductGallerySlide(0);
    setIsConfigExpanded(false);
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
      // ?produkt=... wins (product switching / resume links), otherwise the
      // route's own product (/moskitiery-ramkowe -> initialProductSlug).
      const slug =
        (current.searchParams.get("produkt") || "").trim().toLowerCase() ||
        String(initialProductSlug || "").trim().toLowerCase();
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
      const virtual = resolveVirtualProductItem(slug, heroMenuGroups);
      if (virtual) activateProductView(virtual.group, virtual.groupIndex, virtual.item, { updateUrl: false });
    };

    activateFromUrl();
    const onPopState = () => activateFromUrl();
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [heroMenuGroups, initialProductSlug]);

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
  const dimensionUnitPrice = billedMeters !== null ? billedMeters * moskPricePerMbPromo : null;
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
  // Width's own hard ceiling (250 cm, same as height's) - checked
  // independently of height's - see the matching comment in
  // features/moskitiery-ramkowe/shared.ts on OVERSIZE_SURCHARGE_TIER_2_MAX_MM.
  const widthOverAbsoluteMax = widthNum > OVERSIZE_MAX_WIDTH_MM;
  const requiredSurchargeForCurrentDims = hasValidDimensions
    ? moskOversizeSurchargeForDimension(Math.max(widthNum, heightNum))
    : 0;
  const surchargeSatisfied =
    requiredSurchargeForCurrentDims <= 0 ||
    (acceptedSurcharge !== null && acceptedSurcharge.width === widthNum && acceptedSurcharge.height === heightNum);
  const dimensionsBlocked =
    bothDimensionsOverTechnicalLimit || widthOverAbsoluteMax || requiredSurchargeForCurrentDims < 0 || !surchargeSatisfied;
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

  // NOTE: an exit-intent "rescue" modal used to be wired here, gated on this
  // component's own selectedHardwareId/selectedMeshId/dimensionWidth/
  // dimensionHeight state - but that state is dead for the real moskitiery-
  // ramkowe UI below, which delegates to <ConfiguratorPanel> (its own,
  // separate state - see features/moskitiery-ramkowe/ConfiguratorPanel.tsx's
  // top comment: "ported verbatim from the panel that used to live inline in
  // app/page.tsx"). Found live 2026-09-03 via a headless-browser test: every
  // trigger silently no-opped because hasRescueEligibleProgress could never
  // become true through the real UI. The feature now lives inside
  // ConfiguratorPanel itself (enableRescueModal prop), which has the real,
  // live progress state.

  // Resume link (?resume_token=...) - restores a rescued configuration
  // straight into the cart (same shape "Dodaj do koszyka" produces) rather
  // than trying to re-open live editing, which needs none of ConfiguratorPanel's
  // own selection-state mapping. Runs once on mount.
  const resumeHandledRef = useRef(false);
  const [rescueResumeToast, setRescueResumeToast] = useState<{
    productLabel: string;
    itemCount: number;
    discountPercent: number;
  } | null>(null);
  useEffect(() => {
    if (typeof window === "undefined" || resumeHandledRef.current) return;
    const current = new URL(window.location.href);
    const resumeToken = (current.searchParams.get("resume_token") || "").trim();
    if (!resumeToken) return;
    resumeHandledRef.current = true;
    void resolveResumeToken(resumeToken).then((resolved) => {
      history.replaceState(null, "", window.location.pathname + window.location.search.replace(/[?&]resume_token=[^&]*/, "").replace(/^&/, "?"));
      if (!resolved) return;
      if (resolved.items.length > 0) {
        // Every position the quote carried, not just the first - a saved
        // cart with several items used to silently lose all but one here.
        // addCartItem() re-reads storage itself on every call, so chaining
        // it in a loop (rather than seeding from this component's own
        // cartItems state, which this mount-only effect could otherwise see
        // stale) stays correct regardless of init timing.
        let items: CartLineItem[] = readCartItems();
        let addedCount = 0;
        for (const item of resolved.items) {
          if (findEquivalentCartItem(items, item)) continue;
          items = addCartItem(item);
          addedCount += 1;
        }
        setCartItems(items);
        setCartSummary(cartSummaryWithSurcharge(items));
        if (resolved.rescueDiscountPercent > 0) {
          setRescueGrant({ quoteCode: resolved.quoteCode, percent: resolved.rescueDiscountPercent });
        }
        // Only claim what was actually newly restored - reopening a link
        // whose items are already in this device's cart (see
        // findEquivalentCartItem() above) has nothing new to announce.
        if (addedCount > 0) {
          setRescueResumeToast({
            productLabel: resolved.items[0].productLabel,
            itemCount: addedCount,
            discountPercent: resolved.rescueDiscountPercent,
          });
          window.setTimeout(() => setRescueResumeToast(null), 6000);
        }
      }
      // Re-activate whatever site-wide promo (SEZON20 etc.) was active on
      // the device that saved this quote - independent of whether there was
      // a cart to restore (a promo-only link has nothing else to resume),
      // without this the discount the customer had already activated
      // silently doesn't carry over even though everything else did.
      // syncPromoDeadlineFromServer() carries the *real* remaining time
      // rather than starting a fresh 24h window on this device.
      if (resolved.promoCode) {
        activatePromoCode(resolved.promoCode);
        if (typeof resolved.promoDeadlineAtMs === "number") {
          syncPromoDeadlineFromServer(resolved.promoDeadlineAtMs);
        }
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // One H1 per view (audit 2026-09-13): the product title is the H1 on a
  // product view, so the hero carousel titles step down to plain text there.
  const HeroTitleTag: "h1" | "p" = displayedProduct ? "p" : "h1";

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
      {/* Always-visible SEZON20 countdown (replaces the first-visit modal -
          see promo-top-strip.tsx). Must stay a direct child of .home-root:
          globals.css offsets .hero-header/.hero-inner via
          .home-root:has(> .promo-top-strip). */}
      <PromoTopStrip productSlug={productSlugFromSelected(displayedProduct) || "moskitiery-ramkowe"} />
      <header className={`hero-header${isHeaderCompact ? " is-compact" : ""}`}>
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
              aria-label="Menu"
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
          {/* "Produkty" pill + flyout switcher - hidden for now on the
              business owner's instruction (only moskitiery-ramkowe is
              really live; rolety-dachowe isn't ready for customers to
              stumble into via this yet). SHOW_PRODUCT_SWITCHER_MENU is the
              one-line flip to bring it back once there's a real second
              product to switch to. */}
          {displayedProduct && SHOW_PRODUCT_SWITCHER_MENU ? (
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
          <a className="phone" href={`tel:${contactPhone.replace(/\s+/g, "")}`}>
            {contactPhone}
          </a>
          {/* Portal target for ConfiguratorPanel's <SaveShareWidget> (owns
              the real "is there a draft to save" state - see that
              component's own top comment for why it lives there and
              portals in here instead of floating). display:contents so it
              contributes nothing of its own to this flex row - the
              portaled button is the real flex item. */}
          <div id="header-save-share-slot" style={{ display: "contents" }} />
          {/* The nudge (chat-nudge.tsx) hangs off this wrapper, right under
              the icon, so it follows the sticky header in both its states. */}
          <div className="header-chat-wrap">
          {promoRenewToast ? (
            <div className="promo-renew-toast" role="status">
              <strong>Witaj ponownie!</strong> Rabat SEZON20 wraca na 24 h — naliczy się w koszyku.
            </div>
          ) : null}
          <ChatNudge productSlug={productSlugFromSelected(displayedProduct)} active={isProductView} />
          <button
            type="button"
            className="header-chat-button"
            onClick={() => openCrispChat()}
            aria-label="Otwórz czat z konsultantem"
          >
            <span className="header-chat-button-ping" aria-hidden="true" />
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path
                d="M4 12c0-4.42 3.58-8 8-8s8 3.58 8 8-3.58 8-8 8c-1.1 0-2.15-.22-3.1-.62L4 21l1.4-4.2A7.94 7.94 0 0 1 4 12Z"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle cx="8.5" cy="12" r="1" fill="currentColor" />
              <circle cx="12" cy="12" r="1" fill="currentColor" />
              <circle cx="15.5" cy="12" r="1" fill="currentColor" />
            </svg>
            <span className="header-chat-button-dot" aria-hidden="true" />
          </button>
          </div>
          <div
            className="header-cart-wrap"
            onMouseEnter={() => setCartTooltipOpen(true)}
            onMouseLeave={() => setCartTooltipOpen(false)}
          >
            <a
              className={`header-cart ${hasCartItems ? "has-items" : "is-empty"} ${cartIsBumping ? "is-bumping" : ""}`}
              href="/koszyk"
              aria-label={hasCartItems ? `Koszyk: ${cartQtyLabel}, ${formatPln(cartTotalWithPromo)}` : "Koszyk jest pusty"}
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
                      <strong>
                        {headerCartDiscountPercent > 0
                          ? formatPln(Math.max(0, item.total * (1 - headerCartDiscountPercent / 100)))
                          : formatPln(item.total)}
                      </strong>
                    </li>
                  ))}
                  {cartItems.length > 4 ? <li className="header-cart-tooltip-more">i {cartItems.length - 4} więcej…</li> : null}
                </ul>
                <div className="header-cart-tooltip-total">
                  <span>Razem</span>
                  <strong>{formatPln(cartTotalWithPromo)}</strong>
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
            style={
              displayedProduct
                ? undefined
                : { backgroundImage: `url(${optimizeImageUrl(firstHeroImageUrl, 2000, 70)})`, backgroundSize: "cover", backgroundPosition: "center" }
            }
          >
            {(displayedProduct ? [] : heroMedia).map((media, index) =>
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
          {!isProductView ? (
            <div className="hero-legal-strip" aria-label="Dane sprzedawcy">
              <span>{COMPANY_LEGAL.legalName} (marka {COMPANY_LEGAL.brand}) · {COMPANY_LEGAL.street}, {COMPANY_LEGAL.postalCode} {COMPANY_LEGAL.city} · NIP {COMPANY_LEGAL.nip}</span>
              <span><a href="/regulamin">Regulamin</a> · <a href="/legal/prywatnosc">Prywatność</a> · <a href="/legal/reklamacje">Reklamacje i zwroty</a> · <a href="/legal/dostawa-i-platnosc">Dostawa i płatność</a> · <a href="/kontakt">Kontakt</a></span>
            </div>
          ) : null}
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
                        <HeroTitleTag
                          key={`${slide.title}-${slide.eyebrow}-${index}`}
                          className={`hero-title-slide ${index === activeHeadline ? "is-active" : ""}`}
                        >
                          {slide.title || fallbackTitle}
                        </HeroTitleTag>
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
                  {displayedProduct ? (
                    <h1>
                      {productSlugFromSelected(displayedProduct) === "plisy"
                        ? productLanding?.title && productLanding.title.toLowerCase() !== "plisy"
                          ? productLanding.title
                          : PLISY_H1
                        : productSlugFromSelected(displayedProduct) === "rolety-dachowe"
                          ? productLanding?.title && !/dekolux/i.test(productLanding.title) && productLanding.title.toLowerCase() !== "rolety do okien dachowych"
                            ? productLanding.title
                            : RD_H1
                          : productSlugFromSelected(displayedProduct) === "plisy-dachowe"
                            ? productLanding?.title && productLanding.title.toLowerCase() !== "plisy do okien dachowych"
                              ? productLanding.title
                              : PD_H1
                            : displayedProduct.label}
                    </h1>
                  ) : null}
                    <div className="hero-product-content">
                      <section id="product-section-opis" ref={opisSectionRef} className="hero-product-section">
                      {displayedProduct ? (
                        productSlugFromSelected(displayedProduct) === "moskitiery-ramkowe" ? (
                          <div className="pl-landing">
                            {topPromoPreview || topPromoActive ? (
                              <PromoCountdownBanner code={PROMO_CODE} productSlug="moskitiery-ramkowe">
                                {(promo) => (
                                  <div className={`pl-sezon-banner ${topPromoActive ? "is-active" : ""}`}>
                                    <div className="pl-sezon-banner-top">
                                      <span className="pl-sezon-banner-badge" aria-hidden="true">
                                        {topPromoActive ? "✓" : "-20%"}
                                      </span>
                                      <div className="pl-sezon-banner-copy">
                                        <strong className="pl-sezon-banner-text">
                                          {topPromoActive ? (
                                            <>Kod SEZON20 aktywny</>
                                          ) : (
                                            <>Tylko dzisiaj: kod SEZON20</>
                                          )}
                                        </strong>
                                        <span className="pl-sezon-banner-sub">
                                          {topPromoActive
                                            ? promo
                                              ? (
                                                <>
                                                  Rabat ważny jeszcze <strong>{promo.remainingText}</strong>
                                                </>
                                              )
                                              : "Widzisz ceny z rabatem"
                                            : "Aktywuj i zobacz niższą cenę od razu"}
                                        </span>
                                      </div>
                                    </div>
                                    {!topPromoActive ? (
                                      <button type="button" className="pl-sezon-banner-cta" onClick={activateTopPromo}>
                                        Aktywuj rabat -20%
                                      </button>
                                    ) : promo ? (
                                      <button type="button" className="pl-sezon-banner-cta" onClick={promo.openModal}>
                                        Zapisz / wyślij link
                                      </button>
                                    ) : null}
                                  </div>
                                )}
                              </PromoCountdownBanner>
                            ) : !topPromoResolved ? (
                              <div className="pl-sezon-banner pl-sezon-banner--placeholder" aria-hidden="true" />
                            ) : null}
                            <div className="pl-trust-row">
                              <span className="pl-price">
                                {topPromoActive && topPromoPreview ? (
                                  <>
                                    <span className="pl-price-original">
                                      {moskPricePerMbPromo.toLocaleString("pl-PL", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}{" "}
                                      zł
                                    </span>
                                    <span className="price-per-mb-promo pl-price-sezon-active">
                                      {applyPromoToPrice(moskPricePerMbPromo, topPromoPreview)!.toLocaleString(
                                        "pl-PL",
                                        { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                                      )}{" "}
                                      zł
                                    </span>
                                    <span className="pl-price-unit"> / mb</span>
                                  </>
                                ) : (
                                  <>
                                    <span className="price-per-mb-promo">
                                      {moskPricePerMbPromo.toLocaleString("pl-PL", {
                                        minimumFractionDigits: 2,
                                        maximumFractionDigits: 2,
                                      })}{" "}
                                      zł
                                    </span>
                                    <span className="pl-price-unit"> / mb</span>
                                    {MOSKITIERY_RAMKOWE_PRICE_ON_PROMO ? (
                                      <span className="price-per-mb-standard">
                                        {moskPricePerMbStandard.toLocaleString("pl-PL", {
                                          minimumFractionDigits: 2,
                                          maximumFractionDigits: 2,
                                        })}{" "}
                                        zł
                                      </span>
                                    ) : null}
                                  </>
                                )}
                              </span>
                              {allegroRating && displayRating ? (
                                <span className="pl-chip pl-chip-rating">
                                  ★ {displayRating.averageScore.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                  <span className="pl-chip-muted"> · {displayRating.totalResponses} opinii</span>
                                </span>
                              ) : null}
                              <span className="pl-chip">5 lat gwarancji</span>
                              <span className="pl-chip">Darmowa dostawa od 79 zł</span>
                            </div>

                            <p className="pl-subtitle">
                              {productLanding?.subtitle ||
                                // Must equal the CRM product subtitle byte for byte: the CRM value
                                // replaces this after mount, and a different length shifted the
                                // whole block below (CLS 2026-09-14). Edit the copy in the CRM.
                                "Moskitiera okienna na aluminiowej ramie. Produkowana na wymiar - idealnie pod Twoje okno. Cena za 1 metr bieżący obwodu."}
                            </p>
                            {/* Mobile-only primary CTA (audit 2026-09-13): on a
                                phone the configurator sits below the whole
                                description, and the only strong button above
                                the fold used to be "Zapisz / wyślij link". */}
                            <button type="button" className="pl-mobile-price-cta" onClick={scrollToConfigPanel}>
                              Wyceń swoje okno w 30 sekund
                            </button>

                            {shippingBanner ? (
                              <div className="pl-shipping-banner">
                                <div className="pl-shipping-banner-headline">
                                  <span className="pl-shipping-banner-icon" aria-hidden="true">🚚</span>
                                  <strong>{shippingBanner.headline}</strong>
                                </div>
                                {shippingBanner.cta_text ? (
                                  <small className="pl-shipping-banner-subtext">{shippingBanner.cta_text}</small>
                                ) : null}
                                {/* "Ekspres" (P2, 2026-09-13): the standard
                                    line above is the real production plan;
                                    this jumps the queue for a flat fee. */}
                                {EXPRESS_ENABLED ? (
                                <label className={`pl-express-toggle ${expressSelected ? "is-on" : ""}`}>
                                  <input
                                    type="checkbox"
                                    checked={expressSelected}
                                    onChange={(event) => {
                                      const on = event.target.checked;
                                      setExpressSelected(on);
                                      setExpressSelectedState(on);
                                      trackShopStep("express_toggled", on ? "on" : "off", { place: "landing" });
                                    }}
                                  />
                                  <span className="pl-express-toggle-copy">
                                    <strong>
                                      ⚡ Potrzebujesz szybciej? Ekspres +
                                      {EXPRESS_FEE_AMOUNT.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                                    </strong>
                                    <small>
                                      Priorytet produkcji, wysyłka{" "}
                                      {computeExpressDispatch(new Date(), EXPRESS_CUTOFF.hour, EXPRESS_CUTOFF.minute).label}{" "}
                                      (zamówienie do {formatCutoff(EXPRESS_CUTOFF.hour, EXPRESS_CUTOFF.minute)} w dzień roboczy = wysyłka tego
                                      samego dnia). Wybór potwierdzisz w koszyku.
                                    </small>
                                  </span>
                                </label>
                                ) : null}
                                <button
                                  type="button"
                                  className="pl-inline-cta-button pl-shipping-banner-cta"
                                  onClick={scrollToConfigPanel}
                                >
                                  Sprawdź cenę swojej moskitiery
                                </button>
                              </div>
                            ) : shippingBannerPending ? (
                              <div className="pl-shipping-banner pl-shipping-banner--placeholder" aria-hidden="true" />
                            ) : null}

                            <video
                              className="pl-hero-banner"
                              src="/moskitiery-ramkowe-baner.mp4"
                              muted
                              loop
                              playsInline
                              preload="metadata"
                              ref={(el) => {
                                // Plays only while actually on screen (audit
                                // 2026-09-13): preload="auto" + a 0,4 s timer
                                // used to pull the whole 313 KB clip on every
                                // load, above or below the fold. dataset flag
                                // guards against observing twice if this ref
                                // callback re-runs for the same element.
                                if (!el || el.dataset.viewPlayArmed === "1") return;
                                el.dataset.viewPlayArmed = "1";
                                if (typeof IntersectionObserver === "undefined") {
                                  window.setTimeout(() => {
                                    el.play().catch(() => {});
                                  }, 400);
                                  return;
                                }
                                const observer = new IntersectionObserver(
                                  (entries) => {
                                    for (const entry of entries) {
                                      if (entry.isIntersecting) el.play().catch(() => {});
                                      else el.pause();
                                    }
                                  },
                                  { threshold: 0.25 },
                                );
                                observer.observe(el);
                              }}
                            />

                            <div className="pl-spec-grid">
                              {(productLanding?.specItems?.length ? productLanding.specItems : MOSKITIERY_RAMKOWE_SPEC_ITEMS).map(
                                (item, index, arr) => {
                                  const icon = moskitieryRamkoweSpecIcon(item.label);
                                  // CTA "jak mierzyć" lives in the "na wymiar i pod kolor"
                                  // block; if the CRM ever renames that item, fall back to
                                  // the first one so the CTA never disappears entirely.
                                  const measureItemIndex = Math.max(
                                    0,
                                    arr.findIndex((it) => /wymiar/i.test(it.label)),
                                  );
                                  const withMeasureCta = index === measureItemIndex;
                                  return (
                                    <div
                                      className={`pl-spec-item${withMeasureCta ? " pl-spec-item--wide" : ""}`}
                                      key={item.label}
                                    >
                                      {icon ? (
                                        <span className="pl-spec-icon">{icon}</span>
                                      ) : null}
                                      <div className="pl-spec-item-text">
                                        <span className="pl-spec-label">{item.label}</span>
                                        <span className="pl-spec-value">{item.value}</span>
                                        {withMeasureCta ? (
                                          <button
                                            type="button"
                                            className="pl-measure-cta"
                                            onClick={openMeasurementInstructions}
                                          >
                                            <span aria-hidden="true">📐</span>
                                            Jak mierzyć? Zobacz instrukcję pomiaru
                                          </button>
                                        ) : null}
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
                                dangerouslySetInnerHTML={{ __html: demoteHeadings(productLanding.description) }}
                              />
                            ) : null}
                            {resolveMainProductPhoto(displayedProduct, productLanding) ? (
                              <img
                                className="pl-description-photo"
                                src={optimizeImageUrl(resolveMainProductPhoto(displayedProduct, productLanding), 900)}
                                alt={displayedProduct.label}
                                loading="lazy"
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
                              <button
                                type="button"
                                className="pl-inline-cta-button pl-callout-cta"
                                onClick={scrollToConfigPanel}
                              >
                                Zamów teraz z rabatem -20%
                              </button>
                            </div>
                          </div>
                        ) : productSlugFromSelected(displayedProduct) === "plisy" ? (
                          <div className="pl-landing">
                            {/* Plisy landing (audit 2026-09-14) - built-in copy from
                                features/plisy/landing-content.ts, CRM fields take
                                over one by one once the owner fills them. SEZON20
                                applies to plisy (owner, 2026-09-14) but the plisy
                                configurator prices without the code, so the banner
                                says the discount lands in the cart. No Ekspres, no
                                dispatch counter here: plisy take 5-10 business days. */}
                            {topPromoPreview || topPromoActive ? (
                              <PromoCountdownBanner code={PROMO_CODE} productSlug="plisy">
                                {(promo) => (
                                  <div className={`pl-sezon-banner pl-sezon-banner--compact ${topPromoActive ? "is-active" : ""}`}>
                                    <div className="pl-sezon-banner-top">
                                      <span className="pl-sezon-banner-badge" aria-hidden="true">
                                        {topPromoActive ? "✓" : "-20%"}
                                      </span>
                                      <div className="pl-sezon-banner-copy">
                                        <strong className="pl-sezon-banner-text">
                                          {topPromoActive ? <>Kod SEZON20 aktywny</> : <>Tylko dzisiaj: kod SEZON20</>}
                                        </strong>
                                        <span className="pl-sezon-banner-sub">
                                          {topPromoActive ? (
                                            promo ? (
                                              <>
                                                -20% naliczy się w koszyku · jeszcze <strong>{promo.remainingText}</strong>
                                              </>
                                            ) : (
                                              "Rabat -20% naliczy się w koszyku"
                                            )
                                          ) : (
                                            "Aktywuj, a rabat -20% naliczy się w koszyku"
                                          )}
                                        </span>
                                      </div>
                                    </div>
                                    {!topPromoActive ? (
                                      <button type="button" className="pl-sezon-banner-cta" onClick={activateTopPromo}>
                                        Aktywuj -20%
                                      </button>
                                    ) : promo ? (
                                      <button type="button" className="pl-sezon-banner-link" onClick={promo.openModal}>
                                        Zapisz link
                                      </button>
                                    ) : null}
                                  </div>
                                )}
                              </PromoCountdownBanner>
                            ) : !topPromoResolved ? (
                              <div className="pl-sezon-banner pl-sezon-banner--compact pl-sezon-banner--placeholder" aria-hidden="true" />
                            ) : null}
                            <div className="pl-trust-row">
                              <span className="pl-price">
                                od {formatStartingPrice(plisyStartingPrice)} zł
                                <span className="pl-price-unit"> / szt.</span>
                              </span>
                              <span className="pl-chip">Realizacja {PLISY_LEAD_TIME_LABEL}</span>
                              <span className="pl-chip">Polski producent</span>
                              <span className="pl-chip">5 lat gwarancji</span>
                              <span className="pl-chip">30 dni na zwrot</span>
                              <span className="pl-chip">Darmowa dostawa od 79 zł</span>
                            </div>

                            <p className="pl-subtitle">
                              {isPlisyPlaceholderCopy(productLanding?.subtitle) ? PLISY_SUBTITLE : productLanding!.subtitle}
                            </p>

                            <PlisyHeroPhotos />

                            <div className="pl-spec-grid">
                              {(productLanding?.specItems?.length ? productLanding.specItems : PLISY_SPEC_ITEMS).map((item) => {
                                const icon = plisySpecIcon(item.label);
                                // "Jak mierzyć?" hangs off the sizing tile - same
                                // single-step popup the configurator's dimensions
                                // step and the Instrukcje tab open (MeasureGuide).
                                const withMeasureCta = /wymiar/i.test(item.label);
                                return (
                                  <div className={`pl-spec-item${withMeasureCta ? " pl-spec-item--wide" : ""}`} key={item.label}>
                                    {icon ? <span className="pl-spec-icon">{icon}</span> : null}
                                    <div className="pl-spec-item-text">
                                      <span className="pl-spec-label">{item.label}</span>
                                      <span className="pl-spec-value">{item.value}</span>
                                      {withMeasureCta ? (
                                        <button type="button" className="pl-measure-cta" onClick={openMeasurementInstructions}>
                                          <span aria-hidden="true">📐</span>
                                          Jak mierzyć? Zobacz animację pomiaru
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Pod galerią i zaletami, nad opisem produktu
                                (właściciel, 2026-09-18) - klient najpierw widzi
                                produkt, potem liczy; rozmiar stąd trafia do
                                porównania kolekcji niżej. */}
                            <PlisyQuickPrice
                              profile={plisyProfile}
                              promo={topPromoActive ? topPromoPreview : null}
                              widthMm={plisyQuickDims.widthMm}
                              heightMm={plisyQuickDims.heightMm}
                              onSizeChange={(widthMm, heightMm) => setPlisyQuickDims({ widthMm, heightMm })}
                              onConfigure={(widthMm, heightMm) => {
                                // Dims only - the panel re-seeds steps 1-4
                                // from its own saved draft and keeps the
                                // size step open with the price under it.
                                setPlisyLastResult(null);
                                setPlisyPrefillDims({ widthMm, heightMm });
                                setPlisyConfigKey((key) => key + 1);
                                scrollToConfigPanel();
                              }}
                            />

                            <h2 className="hero-product-section-title">Opis produktu</h2>
                            <div
                              className="pl-description"
                              dangerouslySetInnerHTML={{
                                __html: demoteHeadings(
                                  productLanding?.description && !isPlisyPlaceholderCopy(productLanding.description)
                                    ? productLanding.description
                                    : PLISY_DESCRIPTION_HTML,
                                ),
                              }}
                            />

                            <ul className="pl-feature-list">
                              {(productLanding?.featureBullets?.length ? productLanding.featureBullets : PLISY_FEATURE_BULLETS).map(
                                (bullet) => (
                                  <li key={bullet.lead}>
                                    <strong>{bullet.lead}</strong>
                                    {bullet.detail ? <span> — {bullet.detail}</span> : null}
                                  </li>
                                ),
                              )}
                            </ul>

                            <PlisyCollectionsPicker
                              profile={plisyProfile}
                              promo={topPromoPreview}
                              widthCm={plisyQuickDims.widthMm / 10}
                              heightCm={plisyQuickDims.heightMm / 10}
                              onSizeChange={(widthCm, heightCm) => setPlisyQuickDims({ widthMm: widthCm * 10, heightMm: heightCm * 10 })}
                              onQuote={scrollToConfigPanel}
                              onZoom={(title, urls, index) => setZoomPreview({ title, urls, index })}
                            />

                            <div className="pl-callout">
                              <strong>{productLanding?.callout?.title || PLISY_CALLOUT.title}</strong>
                              <p>{productLanding?.callout?.body || PLISY_CALLOUT.body}</p>
                              <button type="button" className="pl-inline-cta-button pl-callout-cta" onClick={scrollToConfigPanel}>
                                {PLISY_PRIMARY_CTA}
                              </button>
                            </div>
                          </div>
                        ) : productSlugFromSelected(displayedProduct) === "plisy-dachowe" ? (
                          <div className="pl-landing rd-landing pd-landing">
                            {/* Plisy dachowe landing (2026-09-19) - built-in copy from
                                features/plisy-dachowe/landing-content.ts; the roof-blind
                                section order (trust row, hero photos, spec grid, quick
                                price by window model, description, how it works,
                                fabric collections priced x1,25, hardware, library
                                teaser, callout). */}
                            <div className="pl-trust-row">
                              <span className="pl-price">
                                od {formatStartingPrice(pdStartingPriceValue)} zł
                                <span className="pl-price-unit"> / szt.</span>
                              </span>
                              <span className="pl-chip">{rdLibrary.length ? `${rdLibrary.length} modeli okien` : "420+ modeli okien"}</span>
                              <span className="pl-chip">Polski producent</span>
                              <span className="pl-chip">5 lat gwarancji</span>
                              <span className="pl-chip">30 dni na zwrot</span>
                              <span className="pl-chip">Darmowa dostawa od 79 zł</span>
                            </div>

                            <p className="pl-subtitle">{productLanding?.subtitle?.trim() ? productLanding.subtitle : PD_SUBTITLE}</p>

                            <PdHeroPhotos />

                            <div className="pl-spec-grid">
                              {(productLanding?.specItems?.length ? productLanding.specItems : PD_SPEC_ITEMS).map((item) => {
                                const icon = rdSpecIcon(item.label);
                                const withMeasureCta = /model/i.test(item.label);
                                return (
                                  <div className={`pl-spec-item${withMeasureCta ? " pl-spec-item--wide" : ""}`} key={item.label}>
                                    {icon ? <span className="pl-spec-icon">{icon}</span> : null}
                                    <div className="pl-spec-item-text">
                                      <span className="pl-spec-label">{item.label}</span>
                                      <span className="pl-spec-value">{item.value}</span>
                                      {withMeasureCta ? (
                                        <button type="button" className="pl-measure-cta" onClick={openMeasurementInstructions}>
                                          <span aria-hidden="true">📐</span>
                                          Okno spoza listy? Zobacz, jak zmierzyć
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <PdQuickPrice
                              profile={plisyProfile}
                              library={rdLibrary}
                              promo={topPromoActive ? topPromoPreview : null}
                              fabricGroupId={pdQuickGroup}
                              onFabricGroupChange={setPdQuickGroup}
                              onSelectionChange={(selection) =>
                                setPdQuickDims({
                                  widthMm: selection.widthMm,
                                  heightMm: selection.heightMm,
                                  label: selection.widthMm
                                    ? selection.item
                                      ? buildRoofWindowDisplayLabel(selection.item)
                                      : `${selection.widthMm} × ${selection.heightMm} mm`
                                    : "",
                                })
                              }
                              onConfigure={(selection) => {
                                setPdQuickDims({
                                  widthMm: selection.widthMm,
                                  heightMm: selection.heightMm,
                                  label: selection.item ? buildRoofWindowDisplayLabel(selection.item) : `${selection.widthMm} × ${selection.heightMm} mm`,
                                });
                                setPdLastResult(null);
                                setPdPrefill({
                                  windowLibraryId: selection.item && selection.item.id > 0 ? selection.item.id : undefined,
                                  windowQuery: selection.item ? buildRoofWindowDisplayLabel(selection.item) : undefined,
                                  fabricGroupId: selection.fabricGroupId || undefined,
                                });
                                setPdConfigKey((key) => key + 1);
                                scrollToConfigPanel();
                              }}
                            />

                            <h2 className="hero-product-section-title">Opis produktu</h2>
                            <div
                              className="pl-description"
                              dangerouslySetInnerHTML={{
                                __html: demoteHeadings(productLanding?.description?.trim() ? productLanding.description : PD_DESCRIPTION_HTML),
                              }}
                            />

                            <ul className="pl-feature-list">
                              {(productLanding?.featureBullets?.length ? productLanding.featureBullets : PD_FEATURE_BULLETS).map((bullet) => (
                                <li key={bullet.lead}>
                                  <strong>{bullet.lead}</strong>
                                  {bullet.detail ? <span> — {bullet.detail}</span> : null}
                                </li>
                              ))}
                            </ul>

                            <PdHowItWorks />

                            <PlisyCollectionsPicker
                              profile={plisyProfile}
                              promo={topPromoActive ? topPromoPreview : null}
                              widthCm={pdQuickDims.widthMm ? Math.round(pdQuickDims.widthMm / 10) : 78}
                              heightCm={pdQuickDims.heightMm ? Math.round(pdQuickDims.heightMm / 10) : 118}
                              onSizeChange={(widthCm, heightCm) => setPdQuickDims({ widthMm: widthCm * 10, heightMm: heightCm * 10, label: `${widthCm * 10} × ${heightCm * 10} mm` })}
                              onQuote={scrollToConfigPanel}
                              onZoom={(title, urls, index) => setZoomPreview({ title, urls, index })}
                              priceMultiplier={PD_PRICE_MULTIPLIER}
                              adjustmentSlug="plisy-dachowe"
                              title="Którą kolekcję tkanin wybrać?"
                              lead={`Te same pięć kolekcji co w plisach okiennych. Ceny poglądowe dla plisy dachowej ${pdQuickDims.label ? `do okna ${pdQuickDims.label}` : "78 × 118 cm (typowe okno dachowe)"} z białym osprzętem — dokładną cenę z kolorem osprzętu i tkaniny policzy konfigurator.`}
                              sizeLabelPrefix="Ceny dla plisy dachowej"
                              mountSuffix=""
                              ctaLabel={(name) => `Wyceń plisę dachową ${name} w konfiguratorze`}
                            />

                            <PdHardwareStrip onZoom={(title, urls, index) => setZoomPreview({ title, urls, index })} />

                            <RoofLibraryTeaser
                              library={rdLibrary}
                              onSearch={(query) => {
                                setPdLastResult(null);
                                setPdPrefill((prev) => ({ ...(prev || {}), windowLibraryId: undefined, windowQuery: query }));
                                setPdConfigKey((key) => key + 1);
                                scrollToConfigPanel();
                              }}
                            />

                            <div className="pl-callout">
                              <strong>{productLanding?.callout?.title || PD_CALLOUT.title}</strong>
                              <p>{productLanding?.callout?.body || PD_CALLOUT.body}</p>
                              <button type="button" className="pl-inline-cta-button pl-callout-cta" onClick={scrollToConfigPanel}>
                                {PD_PRIMARY_CTA}
                              </button>
                            </div>
                          </div>
                        ) : productSlugFromSelected(displayedProduct) === "rolety-dachowe" ? (
                          <div className="pl-landing rd-landing">
                            {/* Rolety dachowe landing (2026-09-18) - built-in copy
                                from features/rolety-dachowe/landing-content.ts, CRM
                                fields take over one by one once the owner fills
                                them. Same section order as plisy. */}
                            <div className="pl-trust-row">
                              <span className="pl-price">
                                od {formatStartingPrice(roletyStartingPrice)} zł
                                <span className="pl-price-unit"> / szt.</span>
                              </span>
                              <span className="pl-chip">{rdLibrary.length ? `${rdLibrary.length} modeli okien` : "420+ modeli okien"}</span>
                              <span className="pl-chip">Polski producent</span>
                              <span className="pl-chip">5 lat gwarancji</span>
                              <span className="pl-chip">30 dni na zwrot</span>
                              <span className="pl-chip">Darmowa dostawa od 79 zł</span>
                            </div>

                            <p className="pl-subtitle">
                              {isRdPlaceholderCopy(productLanding?.subtitle) ? RD_SUBTITLE : productLanding!.subtitle}
                            </p>

                            <RoofHeroPhotos />

                            <div className="pl-spec-grid">
                              {(productLanding?.specItems?.length ? productLanding.specItems : RD_SPEC_ITEMS).map((item) => {
                                const icon = rdSpecIcon(item.label);
                                const withMeasureCta = /model/i.test(item.label);
                                return (
                                  <div className={`pl-spec-item${withMeasureCta ? " pl-spec-item--wide" : ""}`} key={item.label}>
                                    {icon ? <span className="pl-spec-icon">{icon}</span> : null}
                                    <div className="pl-spec-item-text">
                                      <span className="pl-spec-label">{item.label}</span>
                                      <span className="pl-spec-value">{item.value}</span>
                                      {withMeasureCta ? (
                                        <button type="button" className="pl-measure-cta" onClick={openMeasurementInstructions}>
                                          <span aria-hidden="true">📐</span>
                                          Okno spoza listy? Zobacz, jak zmierzyć
                                        </button>
                                      ) : null}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            <RoofQuickPrice
                              profile={rdProfile}
                              library={rdLibrary}
                              promo={topPromoActive ? topPromoPreview : null}
                              materialTypeId={rdQuickMaterial}
                              onMaterialChange={setRdQuickMaterial}
                              onSelectionChange={(selection) =>
                                setRdQuickDims({
                                  widthMm: selection.widthMm,
                                  heightMm: selection.heightMm,
                                  label: selection.widthMm
                                    ? selection.item
                                      ? buildRoofWindowDisplayLabel(selection.item)
                                      : `${selection.widthMm} × ${selection.heightMm} mm`
                                    : "",
                                })
                              }
                              onConfigure={(selection) => {
                                setRdQuickDims({
                                  widthMm: selection.widthMm,
                                  heightMm: selection.heightMm,
                                  label: selection.item ? buildRoofWindowDisplayLabel(selection.item) : `${selection.widthMm} × ${selection.heightMm} mm`,
                                });
                                setRdLastResult(null);
                                setRdPrefill({
                                  windowLibraryId: selection.item && selection.item.id > 0 ? selection.item.id : undefined,
                                  windowQuery: selection.item ? buildRoofWindowDisplayLabel(selection.item) : undefined,
                                  materialTypeId: selection.materialTypeId || undefined,
                                });
                                setRdConfigKey((key) => key + 1);
                                scrollToConfigPanel();
                              }}
                            />

                            <h2 className="hero-product-section-title">Opis produktu</h2>
                            <div
                              className="pl-description"
                              dangerouslySetInnerHTML={{
                                __html: demoteHeadings(
                                  productLanding?.description && !isRdPlaceholderCopy(productLanding.description)
                                    ? productLanding.description
                                    : RD_DESCRIPTION_HTML,
                                ),
                              }}
                            />

                            <ul className="pl-feature-list">
                              {(productLanding?.featureBullets?.length ? productLanding.featureBullets : RD_FEATURE_BULLETS).map((bullet) => (
                                <li key={bullet.lead}>
                                  <strong>{bullet.lead}</strong>
                                  {bullet.detail ? <span> — {bullet.detail}</span> : null}
                                </li>
                              ))}
                            </ul>

                            <RoofHowItWorks />

                            <RoofFabricsGuide
                              profile={rdProfile}
                              promo={topPromoActive ? topPromoPreview : null}
                              widthMm={rdQuickDims.widthMm}
                              heightMm={rdQuickDims.heightMm}
                              sizeLabel={rdQuickDims.label}
                              activeMaterialTypeId={rdQuickMaterial}
                              onPick={(materialTypeId) => {
                                setRdQuickMaterial(materialTypeId);
                                setRdLastResult(null);
                                setRdPrefill((prev) => ({ ...(prev || {}), materialTypeId }));
                                setRdConfigKey((key) => key + 1);
                                scrollToConfigPanel();
                              }}
                              onZoom={(title, urls, index) => setZoomPreview({ title, urls, index })}
                            />

                            <RoofHardwareStrip profile={rdProfile} onZoom={(title, urls, index) => setZoomPreview({ title, urls, index })} />

                            <RoofLibraryTeaser
                              library={rdLibrary}
                              onSearch={(query) => {
                                setRdLastResult(null);
                                setRdPrefill((prev) => ({ ...(prev || {}), windowLibraryId: undefined, windowQuery: query }));
                                setRdConfigKey((key) => key + 1);
                                scrollToConfigPanel();
                              }}
                            />

                            <div className="pl-callout">
                              <strong>{productLanding?.callout?.title || RD_CALLOUT.title}</strong>
                              <p>{productLanding?.callout?.body || RD_CALLOUT.body}</p>
                              <button type="button" className="pl-inline-cta-button pl-callout-cta" onClick={scrollToConfigPanel}>
                                {RD_PRIMARY_CTA}
                              </button>
                            </div>
                          </div>
                        ) : productLanding && productLanding.sections.length > 0 ? (
                          <div className="pl-landing">
                            <h2 className="hero-product-section-title">Opis produktu</h2>
                            <div className="pl-trust-row">
                              {productLanding.priceFrom ? <span className="pl-price">{fillPricePlaceholders(productLanding.priceFrom)}</span> : null}
                              <span className="pl-chip">5 lat gwarancji</span>
                              <span className="pl-chip">Darmowa dostawa od 79 zł</span>
                            </div>
                            {productLanding.subtitle ? <p className="pl-subtitle">{productLanding.subtitle}</p> : null}
                            {resolveMainProductPhoto(displayedProduct, productLanding) ? (
                              <img
                                className="pl-description-photo"
                                src={optimizeImageUrl(resolveMainProductPhoto(displayedProduct, productLanding), 900)}
                                alt={displayedProduct.label}
                                loading="lazy"
                              />
                            ) : null}
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
                            {resolveMainProductPhoto(displayedProduct, productLanding) ? (
                              <img
                                className="pl-description-photo"
                                src={optimizeImageUrl(resolveMainProductPhoto(displayedProduct, productLanding), 900)}
                                alt={displayedProduct.label}
                                loading="lazy"
                              />
                            ) : null}
                          </>
                        )
                      ) : null}
                      </section>
                      {displayedProduct && productSlugFromSelected(displayedProduct) === "plisy" ? (
                        <section id="product-section-wizualizacja" ref={wizualizacjaSectionRef} className="hero-product-section">
                          <h2 className="hero-product-section-title">Wizualizacja</h2>
                          <div className="plisy-viz-section">
                            <h3 className="plisy-viz-title">Zobacz, jak działa plisa</h3>
                            <p className="plisy-viz-lead">
                              Przeciągnij górną i dolną listwę — plisa zasłoni dowolny fragment okna, resztę zostawi odsłoniętą.
                            </p>
                            <PlisyVisualizer />
                          </div>
                        </section>
                      ) : null}
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
                        // Plisy's categories are built per render because their
                        // fabric/hardware/mount photos come off the live CRM
                        // profile, not a hardcoded list (features/plisy/gallery.ts).
                        const plisyCategories =
                          productSlugFromSelected(displayedProduct) === "plisy"
                            ? buildPlisyGalleryCategories()
                            : productSlugFromSelected(displayedProduct) === "rolety-dachowe"
                              ? buildRdGalleryCategories()
                              : productSlugFromSelected(displayedProduct) === "plisy-dachowe"
                                ? buildPdGalleryCategories()
                                : [];
                        const builtinGallery =
                          productSlugFromSelected(displayedProduct) === "moskitiery-ramkowe"
                            ? MOSKITIERY_RAMKOWE_GALLERY_PHOTOS
                            : plisyCategories.length
                                ? plisyCategories.flatMap((category) => category.photos)
                                : displayedProduct.gallery;
                        const usingCrmGallery = Boolean(
                          productLanding?.gallery?.length && productLanding.gallery.length >= builtinGallery.length,
                        );
                        const allPhotos = usingCrmGallery ? productLanding!.gallery : builtinGallery;
                        // Categories only exist for the built-in set. A CRM-
                        // curated gallery is shown as one plain reel - the
                        // admin has no per-photo category field to fill in.
                        const galleryCategories =
                          usingCrmGallery
                            ? []
                            : productSlugFromSelected(displayedProduct) === "moskitiery-ramkowe"
                              ? MOSKITIERY_RAMKOWE_GALLERY_CATEGORIES
                              // One category is not a filter - it would render
                              // "Wszystkie 3 / Realizacje 3", two buttons for
                              // the same three photos. Tabs appear once plisy
                              // has more than one group worth splitting.
                              : plisyCategories.length > 1
                                ? plisyCategories
                                : [];
                        // Which group the photo on screen belongs to. Built from
                        // whichever category set is live, so plisy's dynamic
                        // categories get captions too.
                        const categoryByPhoto: Record<string, GalleryCategory> = Object.fromEntries(
                          galleryCategories.flatMap((category) =>
                            category.photos.map((photo) => [photo, category] as const),
                          ),
                        );
                        const activeCategory =
                          galleryCategories.find((category) => category.id === galleryCategoryId) || null;
                        const galleryPhotos = activeCategory ? activeCategory.photos : allPhotos;
                        const total = galleryPhotos.length;
                        const pickCategory = (id: string) => {
                          setGalleryCategoryId(id);
                          setActiveProductGallerySlide(0);
                        };
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
                        // Names the group the photo on screen belongs to -
                        // in the full reel it changes as you scroll, and for
                        // the customer group it is the disclaimer.
                        const shownCategory =
                          activeCategory || categoryByPhoto[galleryPhotos[activeProductGallerySlide]] || null;
                        const isCustomerPhoto = shownCategory?.id === "klienci";
                        return (
                          <div className="hero-product-gallery">
                            {galleryCategories.length ? (
                              <div className="gallery-cats" role="group" aria-label="Kategorie zdjęć">
                                <button
                                  type="button"
                                  className={`gallery-cat ${galleryCategoryId === "" ? "is-active" : ""}`}
                                  aria-pressed={galleryCategoryId === ""}
                                  onClick={() => pickCategory("")}
                                >
                                  Wszystkie <span>{allPhotos.length}</span>
                                </button>
                                {galleryCategories.map((category) => (
                                  <button
                                    key={category.id}
                                    type="button"
                                    className={`gallery-cat ${category.id === "klienci" ? "is-customer" : ""} ${
                                      galleryCategoryId === category.id ? "is-active" : ""
                                    }`}
                                    aria-pressed={galleryCategoryId === category.id}
                                    onClick={() => {
                                      pickCategory(category.id);
                                      trackShopStep("gallery_category", category.id, {
                                        product_slug: "moskitiery-ramkowe",
                                      });
                                    }}
                                  >
                                    {category.label} <span>{category.photos.length}</span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
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
                                        alt={
                                          categoryByPhoto[galleryPhotos[index]]?.id === "klienci"
                                            ? `${displayedProduct.label} - zdjęcie od klienta`
                                            : displayedProduct.label
                                        }
                                        loading={isActive ? "eager" : "lazy"}
                                      />
                                      {categoryByPhoto[galleryPhotos[index]]?.id === "klienci" ? (
                                        <span className="gallery-customer-badge">Zdjęcie klienta</span>
                                      ) : null}
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
                            {shownCategory ? (
                              <p className={`gallery-caption ${isCustomerPhoto ? "is-customer" : ""}`}>
                                <strong>{shownCategory.label}</strong>
                                <span>{shownCategory.note}</span>
                                <small>
                                  {activeProductGallerySlide + 1} / {total}
                                </small>
                              </p>
                            ) : null}
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
                                  <span className="allegro-rating-source">
                                    Oceny zweryfikowane zakupem - z naszej oferty na Allegro
                                  </span>
                                </div>
                                <div className="allegro-rating-distribution">
                                  {allegroRating.scoreDistribution.map((entry) => {
                                    // Real counts - see adjustedReviewCount (identity).
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
                        })() : productSlugFromSelected(displayedProduct) === "rolety-dachowe" ? (
                          <RoofReviews crmReviews={productLanding?.reviews?.length ? productLanding.reviews : undefined} />
                        ) : productSlugFromSelected(displayedProduct) === "plisy-dachowe" ? (
                          <PdReviews crmReviews={productLanding?.reviews?.length ? productLanding.reviews : undefined} />
                        ) : productSlugFromSelected(displayedProduct) === "plisy" ? (
                          <PlisyReviews crmReviews={productLanding?.reviews?.length ? productLanding.reviews : undefined} />
                        ) : (
                          <ul className="hero-product-reviews">
                            {displayedProduct.reviews.map((review) => (
                              <li key={review}>{review}</li>
                            ))}
                          </ul>
                        )
                      ) : null}
                      <div className="hero-product-section-cta">
                        <button type="button" className="pl-inline-cta-button" onClick={scrollToConfigPanel}>
                          {productSectionCtaLabel(displayedProduct)}
                        </button>
                      </div>
                      </section>
                      <section id="product-section-faq" ref={faqSectionRef} className="hero-product-section">
                        <h2 className="hero-product-section-title">FAQ - Pytania i Odpowiedzi</h2>
                        {(productLanding?.faq?.length
                          ? productLanding.faq
                          : builtinFaqForSlug(productSlugFromSelected(displayedProduct))
                        ).length ? (
                          <div className="hero-product-faq">
                            {(() => {
                              const faqEntries = productLanding?.faq?.length
                                ? productLanding.faq
                                : builtinFaqForSlug(productSlugFromSelected(displayedProduct));
                              const shownFaq = faqExpanded ? faqEntries : faqEntries.slice(0, FAQ_INITIAL_COUNT);
                              return (
                                <>
                                  {shownFaq.map((entry, index) => (
                                    <details key={`${entry.question}-${index}`} className="hero-product-faq-item">
                                      <summary>{entry.question}</summary>
                                      <p>{fillPricePlaceholders(entry.answer)}</p>
                                    </details>
                                  ))}
                                  {faqEntries.length > FAQ_INITIAL_COUNT ? (
                                    <button
                                      type="button"
                                      className="hero-product-faq-more"
                                      aria-expanded={faqExpanded}
                                      onClick={() => setFaqExpanded((prev) => !prev)}
                                    >
                                      {faqExpanded ? "Zwiń" : `Pokaż więcej (${faqEntries.length - FAQ_INITIAL_COUNT})`}
                                    </button>
                                  ) : null}
                                </>
                              );
                            })()}
                          </div>
                        ) : (
                          <p className="hero-product-faq-empty">Wkrótce dodamy tu odpowiedzi na najczęstsze pytania.</p>
                        )}
                        <div className="hero-product-section-cta">
                          <button type="button" className="pl-inline-cta-button" onClick={scrollToConfigPanel}>
                            {productSectionCtaLabel(displayedProduct)}
                          </button>
                        </div>
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
                              {step.customMedia === "plisy-measure" ? (
                                <div className="hero-product-instruction-media hero-product-instruction-media--guide">
                                  <PlisyMeasureGuide />
                                </div>
                              ) : step.embedUrl ? (
                                <div className="hero-product-instruction-media hero-product-instruction-media--embed">
                                  <iframe
                                    src={step.embedUrl}
                                    title={step.title}
                                    loading="lazy"
                                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                    allowFullScreen
                                  />
                                </div>
                              ) : step.mediaUrl ? (
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
                              <div className="hero-product-instruction-body" dangerouslySetInnerHTML={{ __html: demoteHeadings(step.body) }} />
                            </details>
                          ))}
                        </div>
                      ) : null}
                      </section>
                      <SiteFooter variant="landing" />
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
                      {(() => {
                        // Owner (2026-09-19): the menu should show at a glance
                        // which products are already launched.
                        const liveCount = item.items.filter((subItem) => isProductSlugLive(slugFromLink(subItem.linkUrl, subItem.label))).length;
                        return liveCount ? (
                          <span className="hero-menu-live-count">
                            {liveCount} {liveCount === 1 ? "produkt dostępny" : liveCount < 5 ? "produkty dostępne" : "produktów dostępnych"}
                          </span>
                        ) : (
                          <span className="hero-menu-live-count is-none">wkrótce</span>
                        );
                      })()}
                    </span>
                    <span className="hero-menu-chevron" aria-hidden="true">▾</span>
                  </button>
                  <ul className={`hero-menu-card-list ${openMenuIndex === index ? "is-open" : ""}`}>
                    {item.items.map((subItem) => (
                      <li key={`${item.title}-${subItem.label}`}>
                        <a
                          href={subItem.linkUrl}
                          className={isProductSlugLive(slugFromLink(subItem.linkUrl, subItem.label)) ? "is-live" : "is-soon"}
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
                          {isProductSlugLive(slugFromLink(subItem.linkUrl, subItem.label)) ? (
                            <span className="hero-menu-live-badge">Dostępne</span>
                          ) : (
                            <span className="hero-menu-soon-badge">wkrótce</span>
                          )}
                        </a>
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </aside>
            {displayedProduct ? (
              <aside
                ref={configPanelRef}
                className={`hero-product-config-panel ${isProductView ? "is-visible" : ""} ${
                  CONFIG_EXPAND_ENABLED && isConfigExpanded && productSlugFromSelected(displayedProduct) === "plisy" ? "is-expanded" : ""
                }`}
                aria-label="Konfigurator produktu"
              >
                {/* "Powiększ" is plisy-only for now (that's the product this
                    was built and asked for against) - gating on the slug
                    here, not just at the button, means the .is-expanded
                    class itself can never apply to another product's panel
                    even if state was somehow left over from switching. */}
                {CONFIG_EXPAND_ENABLED && productSlugFromSelected(displayedProduct) === "plisy" ? (
                  isConfigExpanded ? (
                    <button
                      type="button"
                      className="hero-config-collapse-toggle"
                      onClick={() => setConfigExpanded(false)}
                      aria-label="Zwiń konfigurator"
                      title="Zwiń konfigurator"
                    >
                      →
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="hero-config-expand-toggle"
                      onClick={() => setConfigExpanded(true)}
                      aria-label="Powiększ konfigurator"
                      title="Powiększ konfigurator"
                    >
                      <span aria-hidden="true">⤢</span> Powiększ
                    </button>
                  )
                ) : null}
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
                          {addToCartToast.leftover ? (
                            <p className="hero-product-added-toast-leftover">
                              <span aria-hidden="true">🧵</span> Zostało Ci jeszcze{" "}
                              <strong>
                                {addToCartToast.leftover.meters.toLocaleString("pl-PL", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                m
                              </strong>{" "}
                              obwodu, już opłacone (warte ok.{" "}
                              <strong>
                                {addToCartToast.leftover.value.toLocaleString("pl-PL", {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2,
                                })}{" "}
                                zł
                              </strong>
                              ) - wyceń kolejną moskitierę poniżej i wykorzystaj je za darmo.
                            </p>
                          ) : null}
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
                      enableRescueModal
                      enableSaveShareBanner
                      onZoom={(preview) => setZoomPreview(preview)}
                      onOpenInstructions={() => {
                        const measurementIndex = activeInstructionSteps.findIndex((step) =>
                          normalizeMenuLabel(step.title).includes("pomiar"),
                        );
                        setInstructionModalSingleStep(true);
                        setInstructionModalIndex(measurementIndex >= 0 ? measurementIndex : 0);
                      }}
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
                        const perimeterMeters = moskPerimeterMeters(result.widthMm, result.heightMm);
                        const billedMeters = moskBilledMeters(perimeterMeters);
                        // Same effective rate as the live in-configurator hint
                        // (.hero-product-leftover-hint, ConfiguratorPanel.tsx) -
                        // SEZON20-adjusted when active, not result.unitPrice
                        // (which is always the STANDARD rate; SEZON20 is applied
                        // as a separate order-level deduction in /koszyk, never
                        // baked into a cart item's own price) - so the two don't
                        // show two different zł figures for the same leftover.
                        const effectivePricePerMbForToast =
                          topPromoActive && topPromoPreview
                            ? (applyPromoToPrice(moskPricePerMbPromo, topPromoPreview) ??
                              moskPricePerMbPromo)
                            : moskPricePerMbPromo;
                        const leftover = moskLeftoverCapacity(perimeterMeters, billedMeters, effectivePricePerMbForToast);
                        setAddToCartToast({
                          productSlug: "moskitiery-ramkowe",
                          productLabel: displayedProduct.label,
                          leftover:
                            leftover.leftoverValue >= MIN_WORTHWHILE_LEFTOVER_SAVINGS_ZL
                              ? { meters: leftover.leftoverMeters, value: leftover.leftoverValue }
                              : undefined,
                        });
                        // Keeps an already-saved SEZON20 link "live" - real
                        // feedback 2026-09-06: a customer who saved/sent the
                        // link, then added another item, expected reopening
                        // that *same* link to reflect it. Silent no-op when
                        // there's no active promo/tracked quote yet.
                        if (isPromoActive()) {
                          void ensurePromoQuoteCode("moskitiery-ramkowe");
                        }
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
                        rdLastResult || rdPrefill
                          ? {
                              ...(rdLastResult
                                ? {
                                    hardwareId: rdLastResult.hardwareId,
                                    materialTypeId: rdLastResult.materialTypeId,
                                    fabricId: rdLastResult.fabricId,
                                  }
                                : {}),
                              ...(rdPrefill
                                ? {
                                    ...(rdPrefill.materialTypeId && !rdLastResult ? { materialTypeId: rdPrefill.materialTypeId } : {}),
                                    ...(rdPrefill.windowLibraryId ? { windowLibraryId: rdPrefill.windowLibraryId } : {}),
                                    ...(rdPrefill.windowQuery ? { windowQuery: rdPrefill.windowQuery } : {}),
                                  }
                                : {}),
                            }
                          : undefined
                      }
                      promo={topPromoActive ? topPromoPreview : null}
                      enableSaveShareBanner
                      enableRescueModal
                      submitLabel="Dodaj do koszyka"
                      onZoom={(preview) => setZoomPreview(preview)}
                      onSubmit={(result) => {
                        setRdLastResult(result);
                        setRdPrefill(null);
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
                          fabricColor: result.fabricColor || undefined,
                          hardwareColor: result.hardwareColor || undefined,
                          windowLibraryId: result.windowLibraryId || undefined,
                          windowCertain: result.windowCertain,
                          bracketCount: result.bracketCount,
                          nameplateAttachmentId: result.nameplateAttachmentId || undefined,
                          missingModelRequest: result.missingModelRequest || undefined,
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
                ) : productSlugFromSelected(displayedProduct) === "plisy-dachowe" ? (
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
                                setPdConfigKey((key) => key + 1);
                              }}
                            >
                              Wyceń podobną plisę
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAddToCartToast(null);
                                setPdLastResult(null);
                                setPdConfigKey((key) => key + 1);
                              }}
                            >
                              Wyceń nową plisę
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
                    <PlisyDachoweConfiguratorPanel
                      key={pdConfigKey}
                      initialValues={
                        pdLastResult || pdPrefill
                          ? {
                              ...(pdLastResult
                                ? {
                                    hardwareId: pdLastResult.hardwareId,
                                    fabricGroupId: pdLastResult.fabricGroupId,
                                    fabricId: pdLastResult.fabricId,
                                  }
                                : {}),
                              ...(pdPrefill
                                ? {
                                    ...(pdPrefill.fabricGroupId && !pdLastResult ? { fabricGroupId: pdPrefill.fabricGroupId } : {}),
                                    ...(pdPrefill.windowLibraryId ? { windowLibraryId: pdPrefill.windowLibraryId } : {}),
                                    ...(pdPrefill.windowQuery ? { windowQuery: pdPrefill.windowQuery } : {}),
                                  }
                                : {}),
                            }
                          : undefined
                      }
                      promo={topPromoActive ? topPromoPreview : null}
                      enableSaveShareBanner
                      enableRescueModal
                      submitLabel="Dodaj do koszyka"
                      onZoom={(preview) => setZoomPreview(preview)}
                      onSubmit={(result) => {
                        setPdLastResult(result);
                        setPdPrefill(null);
                        const item: CartLineItem = {
                          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                          productSlug: "plisy-dachowe",
                          productLabel: displayedProduct.label,
                          hardwareLabel: result.hardwareLabel,
                          meshLabel: `${result.fabricGroupLabel} — ${result.fabricLabel}`,
                          modelLabel: result.windowProducer ? `${result.windowProducer} ${result.windowModel}` : result.windowModel,
                          widthMm: result.widthMm,
                          heightMm: result.heightMm,
                          qty: result.qty,
                          price: result.unitPrice,
                          total: result.totalPrice,
                          imageUrl: result.hardwareImageUrl,
                          fabricColor: result.fabricColor || undefined,
                          hardwareColor: result.hardwareColor || undefined,
                          oversizeSurchargeAmount: result.oversizeSurchargeAmount || undefined,
                          windowLibraryId: result.windowLibraryId || undefined,
                          windowCertain: result.windowCertain,
                          nameplateAttachmentId: result.nameplateAttachmentId || undefined,
                          missingModelRequest: result.missingModelRequest || undefined,
                          createdAt: new Date().toISOString(),
                        };
                        const items = addCartItem(item);
                        setCartItems(items);
                        setCartSummary(cartSummaryWithSurcharge(items));
                        setCartIsBumping(true);
                        window.setTimeout(() => setCartIsBumping(false), 500);
                        setAddToCartToast({ productSlug: "plisy-dachowe", productLabel: displayedProduct.label });
                      }}
                    />
                  )
                ) : productSlugFromSelected(displayedProduct) === "plisy" ? (
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
                                setPlisyConfigKey((key) => key + 1);
                              }}
                            >
                              Wyceń podobną plisę
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setAddToCartToast(null);
                                setPlisyLastResult(null);
                                setPlisyConfigKey((key) => key + 1);
                              }}
                            >
                              Wyceń nową plisę
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
                    <PlisyConfiguratorPanel
                      key={plisyConfigKey}
                      initialValues={
                        plisyLastResult || plisyPrefillDims
                          ? {
                              ...(plisyLastResult
                                ? {
                                    mountId: plisyLastResult.mountId,
                                    hardwareId: plisyLastResult.hardwareId,
                                    fabricGroupId: plisyLastResult.fabricGroupId,
                                    fabricId: plisyLastResult.fabricId,
                                  }
                                : {}),
                              ...(plisyPrefillDims
                                ? { widthMm: plisyPrefillDims.widthMm, heightMm: plisyPrefillDims.heightMm }
                                : {}),
                            }
                          : undefined
                      }
                      promo={topPromoActive ? topPromoPreview : null}
                      submitLabel="Dodaj do koszyka"
                      onZoom={(preview) => setZoomPreview(preview)}
                      onSubmit={(result) => {
                        setPlisyLastResult(result);
                        setPlisyPrefillDims(null);
                        const item: CartLineItem = {
                          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                          productSlug: "plisy",
                          productLabel: displayedProduct.label,
                          hardwareLabel: result.hardwareLabel,
                          meshLabel: `${result.fabricGroupLabel} — ${result.fabricLabel}`,
                          mountLabel: result.mountLabel || undefined,
                          fabricColor: result.fabricColor || undefined,
                          hardwareColor: result.hardwareColor || undefined,
                          widthMm: result.widthMm,
                          heightMm: result.heightMm,
                          qty: result.qty,
                          price: result.unitPrice,
                          total: result.totalPrice,
                          createdAt: new Date().toISOString(),
                          oversizeSurchargeAmount: result.oversizeSurchargeAmount || undefined,
                        };
                        const items = addCartItem(item);
                        setCartItems(items);
                        setCartSummary(cartSummaryWithSurcharge(items));
                        setCartIsBumping(true);
                        window.setTimeout(() => setCartIsBumping(false), 500);
                        setAddToCartToast({ productSlug: "plisy", productLabel: displayedProduct.label });
                      }}
                      onAddVariant={(result) => {
                        // Every earlier position of a multi-size set (see
                        // ConfiguratorPanel.tsx's handleFinalSubmit) - adds
                        // quietly, no toast takeover, no config remount; only
                        // the set's last position goes through onSubmit above.
                        const item: CartLineItem = {
                          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                          productSlug: "plisy",
                          productLabel: displayedProduct.label,
                          hardwareLabel: result.hardwareLabel,
                          meshLabel: `${result.fabricGroupLabel} — ${result.fabricLabel}`,
                          mountLabel: result.mountLabel || undefined,
                          fabricColor: result.fabricColor || undefined,
                          hardwareColor: result.hardwareColor || undefined,
                          widthMm: result.widthMm,
                          heightMm: result.heightMm,
                          qty: result.qty,
                          price: result.unitPrice,
                          total: result.totalPrice,
                          createdAt: new Date().toISOString(),
                          oversizeSurchargeAmount: result.oversizeSurchargeAmount || undefined,
                        };
                        const items = addCartItem(item);
                        setCartItems(items);
                        setCartSummary(cartSummaryWithSurcharge(items));
                        setCartIsBumping(true);
                        window.setTimeout(() => setCartIsBumping(false), 500);
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
                              max={OVERSIZE_MAX_WIDTH_MM}
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
                              max={OVERSIZE_SURCHARGE_TIER_2_MAX_MM}
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
                        ) : widthOverAbsoluteMax ? (
                          <p className="hero-product-dimensions-error">
                            Maksymalna obsługiwana szerokość to 250 cm.
                          </p>
                        ) : requiredSurchargeForCurrentDims < 0 ? (
                          <p className="hero-product-dimensions-error">
                            Maksymalna obsługiwana wysokość to 250 cm.
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
                                    {moskPricePerMbPromo.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
                                  </span>
                                  {MOSKITIERY_RAMKOWE_PRICE_ON_PROMO ? (
                                    <span className="price-per-mb-standard">
                                      {moskPricePerMbStandard.toLocaleString("pl-PL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} zł
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
            <nav
              className={`hero-product-bottom-tabs ${isProductView ? "is-visible" : ""} ${hideBottomTabs ? "is-suppressed" : ""}`}
              aria-label="Sekcje produktu"
              style={
                inAppBrowserBottomInset > 0
                  ? { bottom: `calc(env(safe-area-inset-bottom, 0px) + 0.8rem + ${inAppBrowserBottomInset}px)` }
                  : undefined
              }
            >
              <button
                type="button"
                className="hero-product-bottom-tabs-configure"
                onClick={scrollToConfigPanel}
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
                {displayedProduct && productSlugFromSelected(displayedProduct) === "plisy" ? (
                  <button
                    type="button"
                    className={activeProductTab === "wizualizacja" ? "is-active" : ""}
                    onClick={() => scrollToProductSection("wizualizacja")}
                  >
                    Wizualizacja
                  </button>
                ) : null}
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
            setInstructionModalSingleStep(false);
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
            {activeInstructionSteps.length > 1 && !instructionModalSingleStep ? (
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
            {activeInstructionSteps.length > 1 && !instructionModalSingleStep ? (
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
            {activeInstructionSteps[instructionModalIndex].customMedia === "plisy-measure" ? (
              <div className="hero-product-instruction-media hero-product-instruction-media--guide">
                <PlisyMeasureGuide />
              </div>
            ) : activeInstructionSteps[instructionModalIndex].mediaUrl ? (
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
            {instructionModalSingleStep ? (
              <MeasurementHelp
                phone={contactPhone}
                productSlug={productSlugFromSelected(displayedProduct) || undefined}
                onOpenChat={() => {
                  setInstructionModalIndex(null);
                  setInstructionModalSingleStep(false);
                }}
              />
            ) : (
              <div
                className="hero-product-instruction-body"
                dangerouslySetInnerHTML={{ __html: demoteHeadings(activeInstructionSteps[instructionModalIndex].body) }}
              />
            )}
          </div>
        </div>
      ) : null}

      {infoModalSlug ? <InfoModal slug={infoModalSlug} onClose={() => setInfoModalSlug(null)} /> : null}

      {rescueResumeToast ? (
        <div className="rescue-resume-toast">
          <strong>Wczytaliśmy zapisaną wycenę!</strong>
          <span>
            {rescueResumeToast.itemCount > 1
              ? `${rescueResumeToast.itemCount} pozycje dodane do koszyka`
              : `${rescueResumeToast.productLabel} dodane do koszyka`}
            {rescueResumeToast.discountPercent > 0 ? ` - Twój rabat -${rescueResumeToast.discountPercent}% jest aktywny` : ""}.
          </span>
        </div>
      ) : null}

      {productLockedNotice ? (
        <div className="product-locked-toast" role="status">
          <strong>{productLockedNotice}</strong>
          <span>{PRODUCT_LOCKED_MESSAGE}</span>
        </div>
      ) : null}
    </div>
  );
}
