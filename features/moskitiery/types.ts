export type CarouselSlide = {
  id: string;
  title: string;
  body: string;
  duration_ms: number;
};

export type BackgroundAsset = {
  id: string;
  label: string;
  image_url: string;
  alt: string;
};

export type OfferSnapshot = {
  title: string;
  price_amount: string;
  price_currency: string;
  status: string;
  thumbnail_url: string;
  offer_url: string;
  synced_at: string;
};

export type ChoiceOption = {
  id: string;
  label: string;
  value: string;
  subtitle: string;
  image_url: string;
  gallery_urls: string[];
  preview_layer_url: string;
  accent_color: string;
  offer_id: string;
  offer_snapshot: OfferSnapshot;
  price_delta?: number;
};

export type ChoiceStep = {
  id: string;
  type: "choice";
  title: string;
  subtitle: string;
  key: string;
  preview_layer_url: string;
  preview_render_mode: "solid" | "mesh";
  options: ChoiceOption[];
};

export type DimensionsStep = {
  id: string;
  type: "dimensions";
  title: string;
  subtitle: string;
  key: string;
  width_label: string;
  width_placeholder: string;
  width_unit: string;
  height_label: string;
  height_placeholder: string;
  height_unit: string;
};

export type ProductStep = ChoiceStep | DimensionsStep;

export type GuideSection = {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
};

export type PriceCalculation = {
  mode: "none" | "perimeter_started_interval" | "dimension_price_matrix";
  dimensions_step_key: string;
  interval_mm: number;
  perimeter_multiplier: number;
  minimum_units: number;
  width_field_key?: string;
  height_field_key?: string;
  quantity_field_key?: string;
  hardware_step_key?: string;
  fabric_step_key?: string;
  tables?: PriceMatrixTable[];
};

export type PriceMatrixTable = {
  id: string;
  name: string;
  hardware_ids: string[];
  fabric_group_ids: string[];
  width_breakpoints: number[];
  height_breakpoints: number[];
  prices: number[][];
};

export type PriceUnit = {
  value: number;
  label: string;
  description: string;
};

export type ProductConfigurator = {
  intro: string;
  measurement_guide_video_url: string;
  measurement_guide_sections: GuideSection[];
  steps: ProductStep[];
};

export type ProductEntry = {
  id: string;
  label: string;
  slug: string;
  offer_id: string;
  image_url: string;
  price_mode: "allegro" | "manual";
  manual_price_amount: string;
  manual_price_currency: string;
  display_price_amount: string;
  display_price_currency: string;
  pricing_calculation: PriceCalculation;
  configurator: ProductConfigurator;
  offer_snapshot: OfferSnapshot;
  price_unit: PriceUnit;
};

export type CategoryEntry = {
  id: string;
  label: string;
  slug: string;
  image_url: string;
  products: ProductEntry[];
};

export type AllegroConfiguratorConfig = {
  homepage: {
    carousel: CarouselSlide[];
    backgrounds: BackgroundAsset[];
  };
  catalog: {
    categories: CategoryEntry[];
  };
  updated_at: string | null;
  updated_by: string | null;
};

export type QuoteSummaryRow = {
  label: string;
  value: string;
  note: string;
};

export type QuotePosition = {
  id: string;
  product_slug: string;
  product_label: string;
  quantity: number;
  purchase_units: number | null;
  total_amount: string | null;
  currency: string;
  summary: string;
  summary_rows: QuoteSummaryRow[];
  choice_answers: Record<string, string>;
  dimensions_answers: Record<string, { width: string; height: string }>;
};

export type QuoteDraft = {
  quantity: number;
  summary_rows: QuoteSummaryRow[];
  choice_answers: Record<string, string>;
  dimensions_answers: Record<string, { width: string; height: string }>;
};

export type QuoteAnalyticsEvent = {
  type: string;
  label: string;
  at: string;
  elapsed_ms: number | null;
  meta: Record<string, boolean | number | string | null>;
};

export type QuoteAnalytics = {
  session_started_at: string;
  session_duration_seconds: number;
  total_duration_seconds: number;
  interaction_count: number;
  total_interaction_count: number;
  click_count: number;
  total_click_count: number;
  sessions_count: number;
  events: QuoteAnalyticsEvent[];
};

export type QuotePayload = {
  analytics?: QuoteAnalytics;
  draft?: QuoteDraft | null;
  positions?: QuotePosition[];
};

export type SavedQuote = {
  quote_code: string;
  resume_token?: string;
  product_slug: string;
  product_label: string;
  offer_url: string;
  offer_id: string;
  position_count: number;
  items_count: number;
  units_count: number;
  visit_count: number;
  total_amount: string | null;
  currency: string;
  summary_text: string;
  payload?: QuotePayload;
  analytics?: QuoteAnalytics;
  created_at: string;
  updated_at: string;
  last_seen_at: string;
};

export type StoredQuoteLink = {
  quote_code: string;
  resume_token: string;
  product_slug: string;
  product_label: string;
  saved_at: string;
};
