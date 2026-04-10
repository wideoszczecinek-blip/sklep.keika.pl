import { cache } from "react";

const DEFAULT_CRM_BASE = "https://crm-keika.groovemedia.pl";

export const crmBaseUrl =
  process.env.NEXT_PUBLIC_CRM_API_BASE_URL?.replace(/\/+$/, "") ||
  DEFAULT_CRM_BASE;

function crmUrl(path: string) {
  return `${crmBaseUrl}${path}`;
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(crmUrl(path), {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed for ${path}`);
  }

  return (await response.json()) as T;
}

export type SitePayload = {
  site_title: string;
  site_tagline: string;
  primary_domain: string;
  company_name: string;
  company_legal_name: string;
  company_address_line_1: string;
  company_address_line_2: string;
  company_postal_code: string;
  company_city: string;
  company_country: string;
  contact_phone: string;
  contact_email: string;
  contact_hours: string;
  logo_url: string;
  about_title: string;
  about_body_html: string;
  contact_title: string;
  contact_body_html: string;
};

export type CheckoutSettings = {
  payment_provider: string;
  blik_enabled: boolean;
  card_enabled: boolean;
  currency: string;
  terms_required_label: string;
  checkout_note_html: string;
};

export type SiteResponse = {
  ok: true;
  site: SitePayload;
  checkout: CheckoutSettings;
  updated_at: string | null;
  updated_by: string | null;
};

export type LandingSection = {
  id: string;
  label: string;
  title: string;
  title_html?: string;
  body_html: string;
  media_url?: string;
  media_alt?: string;
};

export type LandingFaq = {
  question: string;
  answer: string;
  question_html?: string;
  answer_html?: string;
};

export type LandingHeroSlide = {
  id: string;
  label: string;
  title_html: string;
  body_html: string;
  media_kind: "image" | "video";
  media_url: string;
  media_alt: string;
};

export type LandingMetric = {
  label_html: string;
  value_html: string;
  note_html: string;
};

export type LandingRichCard = {
  title_html: string;
  body_html: string;
};

export type LandingProofCard = {
  value_html: string;
  body_html: string;
};

export type LandingMeasurementStep = {
  step: string;
  title_html: string;
  body_html: string;
};

export type LandingPayload = {
  slug: string;
  product_slug: string;
  seo_title: string;
  seo_description: string;
  hero: {
    eyebrow: string;
    title: string;
    subtitle: string;
    cta_label: string;
    media_kind: "image" | "video";
    media_url: string;
    slides?: LandingHeroSlide[];
  };
  presentation?: {
    hero_hint_html?: string;
    hero_help_cta_label?: string;
    floating_badge_html?: string;
    floating_body_html?: string;
    spotlight_note_html?: string;
    story_primary_cta_label?: string;
    story_secondary_link_label?: string;
    measurement_primary_cta_label?: string;
    measurement_secondary_cta_label?: string;
    faq_title_html?: string;
    faq_intro_html?: string;
    config_notice_primary_html?: string;
    config_notice_secondary_html?: string;
    sticky_price_fallback_html?: string;
    metrics?: LandingMetric[];
    reassurance_cards?: LandingRichCard[];
    product_features?: LandingRichCard[];
    proof_cards?: LandingProofCard[];
    measurement_steps?: LandingMeasurementStep[];
  };
  trust_badges: string[];
  sections: LandingSection[];
  faq: LandingFaq[];
};

export type LandingResponse = {
  ok: true;
  landing: LandingPayload;
  updated_at: string | null;
  updated_by: string | null;
};

export type LegalPayload = {
  slug: string;
  title: string;
  body_html: string;
};

export type LegalResponse = {
  ok: true;
  page: LegalPayload;
};

export type ProductPayload = {
  name: string;
  title: string;
  slug: string;
  subtitle: string;
  description: string;
  price_from: string;
  badge: string;
  image_url: string;
  gallery_urls: string[];
  landing_sections: Array<{ title: string; body: string }>;
};

export type ProductResponse = {
  ok: true;
  group: {
    title: string;
    slug: string;
    description: string;
  } | null;
  product: ProductPayload;
};

export type PublicQuoteResponse = {
  ok: boolean;
  quote: import("@/features/moskitiery/types").SavedQuote | null;
};

export type PublicOrder = {
  order_code: string;
  quote_code: string;
  product_slug: string;
  product_label: string;
  status: string;
  payment_provider: string;
  payment_status: string;
  amount_total: string | null;
  currency: string;
  shipping_city: string;
  shipping_postcode: string;
  shipping_address_line_1: string;
  shipping_address_line_2: string;
  note_text: string;
  summary_text: string;
  payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  paid_at: string;
  customer_name?: string;
  customer_phone?: string;
  customer_email?: string;
};

export const fetchSiteContent = cache(async () => {
  return fetchJson<SiteResponse>("/biuro/api/shop-public/site");
});

export const fetchLandingContent = cache(async (slug: string) => {
  return fetchJson<LandingResponse>(
    `/biuro/api/shop-public/landing?slug=${encodeURIComponent(slug)}`,
  );
});

export const fetchLegalPage = cache(async (slug: string) => {
  return fetchJson<LegalResponse>(
    `/biuro/api/shop-public/legal?slug=${encodeURIComponent(slug)}`,
  );
});

export const fetchProductContent = cache(async (slug: string) => {
  return fetchJson<ProductResponse>(
    `/biuro/api/shop-public/product?slug=${encodeURIComponent(slug)}`,
  );
});

export async function fetchPublicQuote(quoteCode: string) {
  return fetchJson<PublicQuoteResponse>(
    `/biuro/api/shop-public/quote?quote_code=${encodeURIComponent(quoteCode)}`,
  );
}

export async function fetchOrderWithVerifier(orderCode: string, verifier: string) {
  return fetchJson<{ ok: boolean; order: PublicOrder }>(
    `/biuro/api/shop-public/order_get?order_code=${encodeURIComponent(orderCode)}&verifier=${encodeURIComponent(verifier)}`,
  );
}

export async function verifyOrderAccess(orderCode: string, verifier: string) {
  return fetchJson<{ ok: boolean; access_granted: boolean }>(
    "/biuro/api/shop-public/order_verify_access",
    {
      method: "POST",
      body: JSON.stringify({
        order_code: orderCode,
        verifier,
      }),
    },
  );
}

export async function trackStorefrontEvent(payload: {
  event_name: string;
  event_label?: string;
  page_slug?: string;
  quote_code?: string;
  order_code?: string;
  session_token?: string;
  device_type?: string;
  referrer?: string;
  meta?: Record<string, boolean | number | string | null>;
}) {
  return fetchJson<{ ok: boolean; stored_at: string }>(
    "/biuro/api/shop-public/analytics_event",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
}
