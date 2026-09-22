import { cache } from "react";

const DEFAULT_CRM_BASE = "https://crm-keika.groovemedia.pl";

export const crmBaseUrl =
  process.env.NEXT_PUBLIC_CRM_API_BASE_URL?.replace(/\/+$/, "") ||
  DEFAULT_CRM_BASE;

function crmUrl(path: string) {
  return `${crmBaseUrl}${path}`;
}

// Błędy i wolne odpowiedzi API CRM trafiają do analityki jako api_error /
// api_slow (etykieta = ścieżka bez parametrów) - "konfigurator się nie
// wczytał", "koszyk czekał 8 s" to realne powody ucieczek, niewidoczne
// w samych klikach. Sam endpoint analityki jest wyłączony, żeby błąd
// zapisu zdarzenia nie zapętlał kolejnych zdarzeń.
const API_SLOW_MS = 4000;
function reportApiHealth(path: string, startedAt: number, status: number | null, errorMessage: string): void {
  if (typeof window === "undefined" || path.includes("analytics_event")) return;
  const durationMs = Math.round(performance.now() - startedAt);
  const isError = status === null || status >= 400;
  if (!isError && durationMs < API_SLOW_MS) return;
  let sessionToken = "";
  try {
    sessionToken = window.sessionStorage.getItem("keika_shop_session_token") || "";
  } catch {
    // brak sessionStorage - zdarzenie i tak poleci
  }
  void trackStorefrontEvent({
    event_name: isError ? "api_error" : "api_slow",
    event_label: path.split("?")[0].slice(0, 120),
    page_slug: (window.location.pathname + window.location.search).slice(0, 120),
    session_token: sessionToken,
    device_type: window.innerWidth < 768 ? "mobile" : "desktop",
    meta: { status, ms: durationMs, message: errorMessage.slice(0, 200) },
  }).catch(() => null);
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T> {
  const startedAt = typeof performance !== "undefined" ? performance.now() : 0;
  let response: Response;
  try {
    response = await fetch(crmUrl(path), {
      ...init,
      headers: {
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...(init?.headers ?? {}),
      },
      cache: "no-store",
    });
  } catch (networkError) {
    reportApiHealth(path, startedAt, null, networkError instanceof Error ? networkError.message : "network error");
    throw networkError;
  }

  if (!response.ok) {
    const message = await response.text();
    reportApiHealth(path, startedAt, response.status, message);
    throw new Error(message || `Request failed for ${path}`);
  }
  reportApiHealth(path, startedAt, response.status, "");

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
  /** Przelew tradycyjny (CRM → Sklep WWW → checkout). false = opcja
   * ukryta w koszyku; CRM odrzuca wtedy też payment_provider=transfer. */
  transfer_enabled?: boolean;
  transfer_account_holder?: string;
  transfer_account_number?: string;
  transfer_bank_name?: string;
  transfer_holder_address?: string;
  /** Przelewy24 (umowa bezpośrednia) - CRM zwraca true tylko gdy ma klucze
   * (config/p24.local.php) i metoda jest włączona w ustawieniach. */
  p24_enabled?: boolean;
  p24_transfer_enabled?: boolean;
  p24_installments_enabled?: boolean;
  p24_paypo_enabled?: boolean;
};

/** Dane do przelewu tradycyjnego zwracane przy zamówieniu z
 * payment_provider=transfer (null dla innych metod). Tytuł = kod
 * zamówienia; `pending` = wpłata jeszcze niepotwierdzona w CRM. */
export type PublicOrderTransfer = {
  account_holder: string;
  account_number: string;
  bank_name: string;
  holder_address: string;
  title: string;
  amount: string | null;
  currency: string;
  booking_note: string;
  pending: boolean;
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

export type PublicOrderShipment = {
  carrier: string;
  tracking_number: string;
  tracking_link: string;
};

export type PublicOrder = {
  order_code: string;
  quote_code: string;
  product_slug: string;
  product_label: string;
  status: string;
  /** Human-facing status label (Polish) - use this for display instead of
   * `status`/the CRM's internal order_status vocabulary. */
  friendly_status: string;
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
  access_token?: string;
  /** The CRM's human production order number ("N/MM/RRRR"), once accepted -
   * empty until then. */
  crm_order_number: string;
  /** Estimated completion date, exactly as production entered it (free-form
   * text) - empty until production has actually planned it. Always show
   * this as an estimate, never a promise. */
  estimated_completion: string;
  invoice_issued: boolean;
  invoice_required: boolean;
  shipments: PublicOrderShipment[];
  transfer?: PublicOrderTransfer | null;
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
  visitor_id?: string;
  meta?: Record<string, boolean | number | string | null>;
}) {
  // Trwałe id przeglądarki dokładane do każdego zdarzenia (lib/analytics-context).
  let visitorId = payload.visitor_id || "";
  if (!visitorId && typeof window !== "undefined") {
    try {
      visitorId = window.localStorage.getItem("keika_visitor_id") || "";
    } catch {
      // brak localStorage - bez visitor_id
    }
  }
  return fetchJson<{ ok: boolean; stored_at: string }>(
    "/biuro/api/shop-public/analytics_event",
    {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        ...(visitorId ? { visitor_id: visitorId } : {}),
        ...(payload.page_slug ? { page_slug: payload.page_slug.slice(0, 120) } : {}),
      }),
    },
  );
}
