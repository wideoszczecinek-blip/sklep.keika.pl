export type OfertaVariant = {
  id: string;
  name: string;
  tagline: string;
  body: string;
  image?: string;
  imageAlt?: string;
  bullets?: string[];
  /** Która opcja z quoteOptions ma się zaznaczyć po "Wyceń ten wariant". */
  quoteOption?: string;
};

export type OfertaIcon = "shield" | "ruler" | "sun" | "wind" | "home" | "clock" | "palette" | "tools" | "leaf" | "eye";

export type OfertaFeature = { icon: OfertaIcon; title: string; body: string };
export type OfertaSpec = { label: string; value: string };
export type OfertaFaq = { q: string; a: string };
export type OfertaStep = { title: string; body: string };
export type OfertaGalleryItem = { src: string; alt: string; caption?: string };

export type OfertaContent = {
  slug: string;
  path: string;
  group: "wewnetrzne" | "zewnetrzne" | "taras" | "moskitiery";
  menuLabel: string;
  seoTitle: string;
  seoDescription: string;
  eyebrow: string;
  title: string;
  lead: string;
  hero: { src: string; alt: string; fit?: "cover" | "contain" };
  heroChips: string[];
  /** Nazwa produktu w zgłoszeniu do CRM (pole "Produkty"). */
  productLabel: string;
  /** Lista do wyboru w formularzu wyceny. */
  quoteOptions: string[];
  /** Skąd komponenty / system - pokazane dyskretnie w tabeli. */
  supplier?: { name: string; note: string };
  variants: { title: string; intro: string; items: OfertaVariant[] };
  features: OfertaFeature[];
  gallery: OfertaGalleryItem[];
  specs: { title: string; items: OfertaSpec[] };
  steps?: OfertaStep[];
  faq: OfertaFaq[];
  related: string[];
  /** Uwaga wewnętrzna dla właściciela (nie renderowana klientowi). */
  ownerNote?: string;
};
