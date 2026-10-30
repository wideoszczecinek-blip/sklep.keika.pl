import { SHOP_POLICY, SHOP_URL, shippingFor, type PricedCatalogProduct } from "@/lib/agent-catalog";
import { getMerchantCatalog, type MerchantVariant } from "@/lib/merchant-feed";

// Plik produktowy w formacie Google Merchant Center (RSS 2.0 + przestrzeń
// g:), 25.10.2026 - do zgłoszenia w Merchant Center jako „źródło danych
// z adresu URL” (pobieranie co 24 h). Ten sam plik czytają Bing Merchant
// Center i Perplexity. Produkty produkowane na wymiar: cena = najniższa
// cena, którą klient może zapłacić (ta sama co „od … zł” na stronie
// produktu), identifier_exists = no (własna produkcja, bez GTIN).
//
// 30.10.2026: do 4 produktów ogólnych („na wymiar” - zostają, bo klienci
// szukają też tak) doszły warianty z g:item_group_id (lib/merchant-feed.ts):
// rolety i plisy do okien dachowych po modelu okna, plisy i moskitiery
// w popularnych wymiarach. Link wariantu otwiera stronę z ustawionym
// modelem / wymiarem i tą samą ceną w szybkiej wycenie i w danych
// strukturalnych.
export const revalidate = 3600;

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

type FeedItem = {
  id: string;
  title: string;
  description: string;
  link: string;
  price: number;
  product: PricedCatalogProduct;
  mpn: string;
  groupId?: string;
  size?: string;
  material?: string;
  labels: string[];
  highlights: string[];
};

function renderItem(item: FeedItem): string {
  const product = item.product;
  const shipping = shippingFor({ ...product, priceFrom: item.price });
  return [
    "    <item>",
    `      <g:id>${xml(item.id)}</g:id>`,
    item.groupId ? `      <g:item_group_id>${xml(item.groupId)}</g:item_group_id>` : "",
    `      <title>${xml(item.title.slice(0, 150))}</title>`,
    `      <description>${xml(item.description.slice(0, 5000))}</description>`,
    `      <link>${xml(item.link)}</link>`,
    `      <g:image_link>${xml(product.image)}</g:image_link>`,
    ...product.extraImages.map((url) => `      <g:additional_image_link>${xml(url)}</g:additional_image_link>`),
    `      <g:price>${item.price.toFixed(2)} PLN</g:price>`,
    "      <g:availability>in_stock</g:availability>",
    "      <g:condition>new</g:condition>",
    "      <g:brand>KEIKA</g:brand>",
    `      <g:mpn>${xml(item.mpn)}</g:mpn>`,
    "      <g:identifier_exists>no</g:identifier_exists>",
    `      <g:google_product_category>${product.googleCategoryId}</g:google_product_category>`,
    `      <g:product_type>${xml(product.productType)}</g:product_type>`,
    item.size ? `      <g:size>${xml(item.size.slice(0, 100))}</g:size>` : "",
    item.material ? `      <g:material>${xml(item.material.slice(0, 200))}</g:material>` : "",
    "      <g:shipping>",
    "        <g:country>PL</g:country>",
    `        <g:price>${shipping.toFixed(2)} PLN</g:price>`,
    `        <g:min_handling_time>${product.handlingDays[0]}</g:min_handling_time>`,
    `        <g:max_handling_time>${product.handlingDays[1]}</g:max_handling_time>`,
    "        <g:min_transit_time>1</g:min_transit_time>",
    "        <g:max_transit_time>2</g:max_transit_time>",
    "      </g:shipping>",
    ...item.labels.map((label, index) => (label ? `      <g:custom_label_${index}>${xml(label.slice(0, 100))}</g:custom_label_${index}>` : "")),
    ...item.highlights.map((text) => `      <g:product_highlight>${xml(text.slice(0, 150))}</g:product_highlight>`),
    "    </item>",
  ]
    .filter(Boolean)
    .join("\n");
}

const WARRANTY_HIGHLIGHT = `${SHOP_POLICY.warrantyYears} lat gwarancji, ${SHOP_POLICY.returnDays} dni na zwrot`;

function baseItem(product: PricedCatalogProduct): FeedItem {
  return {
    id: product.sku,
    title: product.name + " - KEIKA",
    description: product.description,
    link: product.url,
    price: product.priceFrom,
    product,
    mpn: product.mpn,
    // custom_label_0 = produkt, 1 = rodzaj pozycji (kampanie Shopping Agencji).
    labels: [product.slug, "na-wymiar"],
    highlights: [WARRANTY_HIGHLIGHT, "Wymiary: " + product.sizes, "Montaż: " + product.mounting],
  };
}

function variantItem(variant: MerchantVariant): FeedItem {
  const product = variant.base;
  const isWindow = variant.path.includes("/okno/");
  return {
    id: variant.id,
    title: variant.title,
    description: variant.description,
    link: variant.url,
    price: variant.price,
    product,
    mpn: "KEIKA-" + variant.id,
    groupId: variant.groupId,
    size: variant.size,
    material: variant.material,
    // custom_label_2 = producent okna (VELUX, FAKRO, ROTO…) - tylko do
    // podziału kampanii, nie do nazwy produktu.
    labels: [product.slug, isWindow ? "model-okna" : "wymiar", isWindow ? variant.size.split(" ")[0] : ""],
    highlights: [WARRANTY_HIGHLIGHT, isWindow ? "Dopasowana do okna " + variant.size : "Wymiar " + variant.size, "Montaż: " + product.mounting],
  };
}

export async function GET() {
  const { products, variants } = await getMerchantCatalog();
  const items = [...products.map(baseItem), ...variants.map(variantItem)].map(renderItem).join("\n");
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">
  <channel>
    <title>Sklep KEIKA - osłony okienne na wymiar</title>
    <link>${SHOP_URL}</link>
    <description>Moskitiery, plisy, rolety i plisy do okien dachowych na wymiar od producenta ze Szczecinka.</description>
${items}
  </channel>
</rss>
`;
  return new Response(body, {
    headers: { "content-type": "application/xml; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
