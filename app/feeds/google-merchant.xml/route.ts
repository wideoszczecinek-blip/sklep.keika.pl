import { SHOP_POLICY, SHOP_URL, getPricedCatalog, shippingFor } from "@/lib/agent-catalog";

// Plik produktowy w formacie Google Merchant Center (RSS 2.0 + przestrzeń
// g:), 25.10.2026 - do zgłoszenia w Merchant Center jako „źródło danych
// z adresu URL” (pobieranie co 24 h). Ten sam plik czytają Bing Merchant
// Center i Perplexity. Produkty szyte na wymiar: cena = najniższa cena,
// którą klient może zapłacić (ta sama co „od … zł” na stronie produktu),
// identifier_exists = no (własna produkcja, bez GTIN).
export const revalidate = 3600;

function xml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export async function GET() {
  const catalog = await getPricedCatalog();
  const items = catalog
    .map((product) => {
      const shipping = shippingFor(product);
      const extra = product.extraImages.map((url) => `      <g:additional_image_link>${xml(url)}</g:additional_image_link>`).join("\n");
      return [
        "    <item>",
        `      <g:id>${xml(product.sku)}</g:id>`,
        `      <title>${xml(product.name + " - KEIKA")}</title>`,
        `      <description>${xml(product.description)}</description>`,
        `      <link>${xml(product.url)}</link>`,
        `      <g:image_link>${xml(product.image)}</g:image_link>`,
        extra,
        `      <g:price>${product.priceFrom.toFixed(2)} PLN</g:price>`,
        "      <g:availability>in_stock</g:availability>",
        "      <g:condition>new</g:condition>",
        "      <g:brand>KEIKA</g:brand>",
        `      <g:mpn>${xml(product.mpn)}</g:mpn>`,
        "      <g:identifier_exists>no</g:identifier_exists>",
        `      <g:google_product_category>${product.googleCategoryId}</g:google_product_category>`,
        `      <g:product_type>${xml(product.productType)}</g:product_type>`,
        "      <g:shipping>",
        "        <g:country>PL</g:country>",
        `        <g:price>${shipping.toFixed(2)} PLN</g:price>`,
        `        <g:min_handling_time>${product.handlingDays[0]}</g:min_handling_time>`,
        `        <g:max_handling_time>${product.handlingDays[1]}</g:max_handling_time>`,
        "        <g:min_transit_time>1</g:min_transit_time>",
        "        <g:max_transit_time>2</g:max_transit_time>",
        "      </g:shipping>",
        `      <g:custom_label_0>${xml(product.slug)}</g:custom_label_0>`,
        `      <g:product_highlight>${xml(`${SHOP_POLICY.warrantyYears} lat gwarancji, ${SHOP_POLICY.returnDays} dni na zwrot`)}</g:product_highlight>`,
        `      <g:product_highlight>${xml("Wymiary: " + product.sizes)}</g:product_highlight>`,
        `      <g:product_highlight>${xml("Montaż: " + product.mounting)}</g:product_highlight>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");
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
