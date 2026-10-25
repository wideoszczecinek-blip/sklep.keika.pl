import { SHOP_POLICY, SHOP_URL, formatPricePl, getPricedCatalog, resolveFaq, shippingFor } from "@/lib/agent-catalog";

// Plik produktowy wg specyfikacji feedu produktów OpenAI (ChatGPT shopping /
// Agentic Commerce Protocol, pola z developers.openai.com/commerce),
// 25.10.2026 - do zgłoszenia w programie sprzedawców ChatGPT. enable_checkout
// = false: zakup kończy się w naszym koszyku (link do strony produktu), bo
// natywne zakupy w ChatGPT wymagają osobnej umowy i integracji płatności.
export const revalidate = 3600;

export async function GET() {
  const catalog = await getPricedCatalog();
  const items = catalog.map((product) => {
    const shipping = shippingFor(product);
    return {
      enable_search: true,
      enable_checkout: false,
      id: product.sku,
      mpn: product.mpn,
      title: product.name,
      description: product.description,
      link: product.url,
      product_category: product.googleCategory,
      brand: "KEIKA",
      condition: "new",
      image_link: product.image,
      additional_image_link: product.extraImages,
      price: `${product.priceFrom.toFixed(2)} PLN`,
      price_note: `Cena od: ${product.priceNote}${product.priceUnit ? " (" + product.priceUnit + ")" : ""}. Produkt szyty na wymiar - dokładna cena po wpisaniu wymiaru na stronie produktu.`,
      availability: "in_stock",
      delivery_estimate: product.leadTime,
      shipping: `PL::Kurier:${shipping.toFixed(2)} PLN`,
      dimensions: product.sizes,
      seller_name: "KEIKA",
      seller_url: SHOP_URL,
      seller_privacy_policy: SHOP_URL + "/legal/prywatnosc",
      seller_tos: SHOP_POLICY.regulaminUrl,
      return_policy: SHOP_URL + "/legal/reklamacje",
      return_window: SHOP_POLICY.returnDays,
      warranty: `${SHOP_POLICY.warrantyYears} lat`,
      target_countries: ["PL"],
      store_country: "PL",
      q_and_a: resolveFaq(product)
        .slice(0, 10)
        .map((entry) => ({ q: entry.question, a: entry.answer })),
      product_highlights: [
        `Cena od ${formatPricePl(product.priceFrom)} zł`,
        `Wymiary: ${product.sizes}`,
        `Pomiar: ${product.measuring}`,
        `Montaż: ${product.mounting}`,
        ...product.options,
      ],
    };
  });
  const body = {
    seller: {
      name: "KEIKA",
      legal_name: SHOP_POLICY.legalName,
      url: SHOP_URL,
      country: "PL",
      currency: "PLN",
      contact: { phone: SHOP_POLICY.phone, email: SHOP_POLICY.email },
      address: `${SHOP_POLICY.street}, ${SHOP_POLICY.postalCode} ${SHOP_POLICY.city}, Polska`,
    },
    generated_at: new Date().toISOString(),
    items,
  };
  return new Response(JSON.stringify(body, null, 2), {
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "public, max-age=3600" },
  });
}
